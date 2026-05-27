-- metadata_apply_put: 全量保存 records + revisions，乐观锁版本控制
CREATE OR REPLACE FUNCTION metadata_apply_put(
  p_workspace_id  uuid,
  p_payload       text,
  p_expected_version bigint DEFAULT 0,
  p_tab_id        text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_version bigint;
  v_new_version     bigint;
  v_payload         jsonb;
  v_records         jsonb;
  v_revisions       jsonb;
  v_record          jsonb;
  v_revision        jsonb;
  v_incoming_ids    uuid[];
BEGIN
  v_payload   := p_payload::jsonb;
  v_records   := v_payload -> 'records';
  v_revisions := v_payload -> 'revisions';

  -- 行锁 + 读取当前版本
  SELECT version INTO v_current_version
    FROM metadata_workspaces
   WHERE id = p_workspace_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- 乐观锁检查
  IF p_expected_version > 0 AND p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'version_conflict: expected=%, actual=%',
      p_expected_version, v_current_version;
  END IF;

  -- 收集传入的 record IDs
  SELECT array_agg((r ->> 'id')::uuid)
    INTO v_incoming_ids
    FROM jsonb_array_elements(v_records) AS r;

  -- UPSERT records
  FOR v_record IN SELECT * FROM jsonb_array_elements(v_records)
  LOOP
    INSERT INTO metadata_records (
      id, workspace_id, user_id,
      display_order, zh_name, field_name,
      attr_type, length, standard_code, business_desc
    ) VALUES (
      (v_record ->> 'id')::uuid,
      p_workspace_id,
      auth.uid(),
      COALESCE((v_record ->> 'display_order')::numeric, 0),
      COALESCE(v_record ->> 'zh_name', ''),
      COALESCE(v_record ->> 'field_name', ''),
      COALESCE(v_record ->> 'attr_type', ''),
      COALESCE(v_record ->> 'length', ''),
      COALESCE(v_record ->> 'standard_code', ''),
      COALESCE(v_record ->> 'business_desc', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      display_order  = EXCLUDED.display_order,
      zh_name        = EXCLUDED.zh_name,
      field_name     = EXCLUDED.field_name,
      attr_type      = EXCLUDED.attr_type,
      length         = EXCLUDED.length,
      standard_code  = EXCLUDED.standard_code,
      business_desc  = EXCLUDED.business_desc;
  END LOOP;

  -- 删除不在新列表中的 records（级联不会影响 revisions，因为 ON DELETE SET NULL）
  IF v_incoming_ids IS NOT NULL AND array_length(v_incoming_ids, 1) > 0 THEN
    DELETE FROM metadata_records
     WHERE workspace_id = p_workspace_id
       AND id <> ALL(v_incoming_ids);
  ELSE
    DELETE FROM metadata_records
     WHERE workspace_id = p_workspace_id;
  END IF;

  -- INSERT revisions（ON CONFLICT DO NOTHING，不可变）
  IF v_revisions IS NOT NULL AND jsonb_array_length(v_revisions) > 0 THEN
    FOR v_revision IN SELECT * FROM jsonb_array_elements(v_revisions)
    LOOP
      INSERT INTO metadata_revisions (
        id, record_id, record_id_snapshot, field_name_snapshot,
        workspace_id, user_id,
        version, revision_note, author, type
      ) VALUES (
        (v_revision ->> 'id')::uuid,
        CASE WHEN v_revision ->> 'record_id' IS NOT NULL
             THEN (v_revision ->> 'record_id')::uuid
             ELSE NULL END,
        (v_revision ->> 'record_id_snapshot')::uuid,
        COALESCE(v_revision ->> 'field_name_snapshot', ''),
        p_workspace_id,
        auth.uid(),
        COALESCE(v_revision ->> 'version', 'v1.0.0'),
        COALESCE(v_revision ->> 'revision_note', ''),
        COALESCE(v_revision ->> 'author', ''),
        COALESCE(v_revision ->> 'type', 'update')
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  -- 版本 +1，更新 tab_id
  v_new_version := v_current_version + 1;
  UPDATE metadata_workspaces
     SET version = v_new_version,
         last_writer_tab_id = p_tab_id
   WHERE id = p_workspace_id;

  RETURN jsonb_build_object('version', v_new_version);
END;
$$;

COMMENT ON FUNCTION metadata_apply_put IS '全量保存元数据 records + revisions，带乐观锁版本控制';


-- metadata_apply_patch: 增量保存（creates / upserts / deletes / revisions），乐观锁版本控制
CREATE OR REPLACE FUNCTION metadata_apply_patch(
  p_workspace_id     uuid,
  p_payload          text,
  p_expected_version bigint DEFAULT 0,
  p_tab_id           text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_version bigint;
  v_new_version     bigint;
  v_payload         jsonb;
  v_creates         jsonb;
  v_upserts         jsonb;
  v_deletes         jsonb;
  v_revisions       jsonb;
  v_record          jsonb;
  v_revision        jsonb;
  v_delete_ids      uuid[];
BEGIN
  v_payload   := p_payload::jsonb;
  v_creates   := v_payload -> 'creates';
  v_upserts   := v_payload -> 'upserts';
  v_deletes   := v_payload -> 'deletes';
  v_revisions := v_payload -> 'revisions';

  -- 行锁 + 读取当前版本
  SELECT version INTO v_current_version
    FROM metadata_workspaces
   WHERE id = p_workspace_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- 乐观锁检查
  IF p_expected_version > 0 AND p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'version_conflict: expected=%, actual=%',
      p_expected_version, v_current_version;
  END IF;

  -- creates: INSERT 新 records
  IF v_creates IS NOT NULL AND jsonb_array_length(v_creates) > 0 THEN
    FOR v_record IN SELECT * FROM jsonb_array_elements(v_creates)
    LOOP
      INSERT INTO metadata_records (
        id, workspace_id, user_id,
        display_order, zh_name, field_name,
        attr_type, length, standard_code, business_desc
      ) VALUES (
        (v_record ->> 'id')::uuid,
        p_workspace_id,
        auth.uid(),
        COALESCE((v_record ->> 'display_order')::numeric, 0),
        COALESCE(v_record ->> 'zh_name', ''),
        COALESCE(v_record ->> 'field_name', ''),
        COALESCE(v_record ->> 'attr_type', ''),
        COALESCE(v_record ->> 'length', ''),
        COALESCE(v_record ->> 'standard_code', ''),
        COALESCE(v_record ->> 'business_desc', '')
      );
    END LOOP;
  END IF;

  -- upserts: INSERT ... ON CONFLICT DO UPDATE
  IF v_upserts IS NOT NULL AND jsonb_array_length(v_upserts) > 0 THEN
    FOR v_record IN SELECT * FROM jsonb_array_elements(v_upserts)
    LOOP
      INSERT INTO metadata_records (
        id, workspace_id, user_id,
        display_order, zh_name, field_name,
        attr_type, length, standard_code, business_desc
      ) VALUES (
        (v_record ->> 'id')::uuid,
        p_workspace_id,
        auth.uid(),
        COALESCE((v_record ->> 'display_order')::numeric, 0),
        COALESCE(v_record ->> 'zh_name', ''),
        COALESCE(v_record ->> 'field_name', ''),
        COALESCE(v_record ->> 'attr_type', ''),
        COALESCE(v_record ->> 'length', ''),
        COALESCE(v_record ->> 'standard_code', ''),
        COALESCE(v_record ->> 'business_desc', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        display_order  = EXCLUDED.display_order,
        zh_name        = EXCLUDED.zh_name,
        field_name     = EXCLUDED.field_name,
        attr_type      = EXCLUDED.attr_type,
        length         = EXCLUDED.length,
        standard_code  = EXCLUDED.standard_code,
        business_desc  = EXCLUDED.business_desc;
    END LOOP;
  END IF;

  -- deletes: 删除指定 records
  IF v_deletes IS NOT NULL AND jsonb_array_length(v_deletes) > 0 THEN
    SELECT array_agg(d::text::uuid)
      INTO v_delete_ids
      FROM jsonb_array_elements_text(v_deletes) AS d;

    DELETE FROM metadata_records
     WHERE id = ANY(v_delete_ids)
       AND workspace_id = p_workspace_id;
  END IF;

  -- revisions: INSERT ON CONFLICT DO NOTHING（不可变）
  IF v_revisions IS NOT NULL AND jsonb_array_length(v_revisions) > 0 THEN
    FOR v_revision IN SELECT * FROM jsonb_array_elements(v_revisions)
    LOOP
      INSERT INTO metadata_revisions (
        id, record_id, record_id_snapshot, field_name_snapshot,
        workspace_id, user_id,
        version, revision_note, author, type
      ) VALUES (
        (v_revision ->> 'id')::uuid,
        CASE WHEN v_revision ->> 'record_id' IS NOT NULL
             THEN (v_revision ->> 'record_id')::uuid
             ELSE NULL END,
        (v_revision ->> 'record_id_snapshot')::uuid,
        COALESCE(v_revision ->> 'field_name_snapshot', ''),
        p_workspace_id,
        auth.uid(),
        COALESCE(v_revision ->> 'version', 'v1.0.0'),
        COALESCE(v_revision ->> 'revision_note', ''),
        COALESCE(v_revision ->> 'author', ''),
        COALESCE(v_revision ->> 'type', 'update')
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  -- 版本 +1，更新 tab_id
  v_new_version := v_current_version + 1;
  UPDATE metadata_workspaces
     SET version = v_new_version,
         last_writer_tab_id = p_tab_id
   WHERE id = p_workspace_id;

  RETURN jsonb_build_object('version', v_new_version);
END;
$$;

COMMENT ON FUNCTION metadata_apply_patch IS '增量保存元数据（creates/upserts/deletes/revisions），带乐观锁版本控制';


-- metadata_rebalance: 重排 display_order，乐观锁版本控制
CREATE OR REPLACE FUNCTION metadata_rebalance(
  p_workspace_id     uuid,
  p_expected_version bigint DEFAULT 0,
  p_tab_id           text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_version bigint;
  v_new_version     bigint;
BEGIN
  -- 行锁 + 读取当前版本
  SELECT version INTO v_current_version
    FROM metadata_workspaces
   WHERE id = p_workspace_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- 乐观锁检查
  IF p_expected_version > 0 AND p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'version_conflict: expected=%, actual=%',
      p_expected_version, v_current_version;
  END IF;

  -- 重排 display_order: 按当前 display_order + created_at 排序，赋连续整数
  UPDATE metadata_records
     SET display_order = sub.new_order
    FROM (
      SELECT id,
             row_number() OVER (ORDER BY display_order, created_at) AS new_order
        FROM metadata_records
       WHERE workspace_id = p_workspace_id
    ) sub
   WHERE metadata_records.id = sub.id;

  -- 版本 +1，更新 tab_id
  v_new_version := v_current_version + 1;
  UPDATE metadata_workspaces
     SET version = v_new_version,
         last_writer_tab_id = p_tab_id
   WHERE id = p_workspace_id;

  RETURN jsonb_build_object('version', v_new_version);
END;
$$;

COMMENT ON FUNCTION metadata_rebalance IS '重排元数据 records 的 display_order，带乐观锁版本控制';
