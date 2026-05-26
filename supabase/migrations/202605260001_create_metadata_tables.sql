-- ============================================================
-- metadata_workspaces
-- ============================================================
CREATE TABLE metadata_workspaces (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL DEFAULT '默认工作区',
  version        bigint      NOT NULL DEFAULT 1,
  last_writer_tab_id text,
  deleted_at     timestamptz,
  seed_from_local_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  metadata_workspaces IS '元数据工作区';
COMMENT ON COLUMN metadata_workspaces.version IS '乐观锁版本号，每次写入 +1';
COMMENT ON COLUMN metadata_workspaces.last_writer_tab_id IS '最近写入的浏览器标签页 ID';
COMMENT ON COLUMN metadata_workspaces.deleted_at IS '软删除时间戳，非 NULL 表示已删';
COMMENT ON COLUMN metadata_workspaces.seed_from_local_at IS 'localStorage 迁移标记';

CREATE INDEX idx_metadata_workspaces_user ON metadata_workspaces(user_id);

-- ============================================================
-- metadata_records
-- ============================================================
CREATE TABLE metadata_records (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES metadata_workspaces(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_order  numeric     NOT NULL DEFAULT 0,
  zh_name        text        NOT NULL DEFAULT '',
  field_name     text        NOT NULL DEFAULT '',
  attr_type      text        NOT NULL DEFAULT '',
  length         text        NOT NULL DEFAULT '',
  standard_code  text        NOT NULL DEFAULT '',
  business_desc  text        NOT NULL DEFAULT '',
  enum_values    jsonb,
  is_primary_key boolean     NOT NULL DEFAULT false,
  is_indexed     boolean     NOT NULL DEFAULT false,
  is_required    boolean     NOT NULL DEFAULT false,
  foreign_key    jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  metadata_records IS '元数据记录（字段定义）';
COMMENT ON COLUMN metadata_records.user_id IS '冗余列，与 workspace.user_id 同步，用于 RLS 直接比对';
COMMENT ON COLUMN metadata_records.display_order IS 'fractional indexing 排序值';
COMMENT ON COLUMN metadata_records.enum_values IS '枚举值列表 [{value, label?}]';
COMMENT ON COLUMN metadata_records.foreign_key IS '外键定义 {refTable, refField, onDelete, displayLabel?}';

CREATE UNIQUE INDEX idx_metadata_records_field_unique
  ON metadata_records(workspace_id, field_name) WHERE field_name <> '';

CREATE INDEX idx_metadata_records_user_ws
  ON metadata_records(user_id, workspace_id, id);

CREATE INDEX idx_metadata_records_workspace
  ON metadata_records(workspace_id);

-- ============================================================
-- metadata_revisions
-- ============================================================
CREATE TABLE metadata_revisions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id           uuid        REFERENCES metadata_records(id) ON DELETE SET NULL,
  record_id_snapshot  uuid        NOT NULL,
  field_name_snapshot text        NOT NULL DEFAULT '',
  workspace_id        uuid        NOT NULL REFERENCES metadata_workspaces(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version             text        NOT NULL DEFAULT 'v1.0.0',
  revision_note       text        NOT NULL DEFAULT '',
  author              text        NOT NULL DEFAULT '',
  type                text        NOT NULL DEFAULT 'update',
  snapshot            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  metadata_revisions IS '元数据修订记录（审计不可变）';
COMMENT ON COLUMN metadata_revisions.record_id IS '关联记录，删除时 SET NULL 保留修订历史';
COMMENT ON COLUMN metadata_revisions.record_id_snapshot IS '原始 record_id 备份，record 删除后仍可追溯';
COMMENT ON COLUMN metadata_revisions.field_name_snapshot IS '原始 field_name 备份';
COMMENT ON COLUMN metadata_revisions.type IS 'create | update | delete | correction';

CREATE INDEX idx_metadata_revisions_record_time
  ON metadata_revisions(record_id, created_at DESC, id DESC);

CREATE INDEX idx_metadata_revisions_ws_time
  ON metadata_revisions(workspace_id, created_at DESC, id DESC);

CREATE INDEX idx_metadata_revisions_created
  ON metadata_revisions(created_at);

-- ============================================================
-- Triggers
-- ============================================================
CREATE OR REPLACE FUNCTION metadata_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_metadata_workspaces_updated_at
  BEFORE UPDATE ON metadata_workspaces
  FOR EACH ROW EXECUTE FUNCTION metadata_update_timestamp();

CREATE TRIGGER trg_metadata_records_updated_at
  BEFORE UPDATE ON metadata_records
  FOR EACH ROW EXECUTE FUNCTION metadata_update_timestamp();

CREATE OR REPLACE FUNCTION metadata_sync_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := (SELECT user_id FROM metadata_workspaces WHERE id = NEW.workspace_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_metadata_records_sync_user_id
  BEFORE INSERT ON metadata_records
  FOR EACH ROW EXECUTE FUNCTION metadata_sync_user_id();

CREATE TRIGGER trg_metadata_revisions_sync_user_id
  BEFORE INSERT ON metadata_revisions
  FOR EACH ROW EXECUTE FUNCTION metadata_sync_user_id();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE metadata_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_revisions  ENABLE ROW LEVEL SECURITY;

-- workspaces
CREATE POLICY ws_select ON metadata_workspaces FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY ws_insert ON metadata_workspaces FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY ws_update ON metadata_workspaces FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY ws_delete ON metadata_workspaces FOR DELETE
  USING (user_id = auth.uid());

-- records (user_id 冗余列直接比对，不 JOIN)
CREATE POLICY rec_select ON metadata_records FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY rec_insert ON metadata_records FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY rec_update ON metadata_records FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY rec_delete ON metadata_records FOR DELETE
  USING (user_id = auth.uid());

-- revisions (仅 SELECT + INSERT，审计不可变)
CREATE POLICY rev_select ON metadata_revisions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY rev_insert ON metadata_revisions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- pg_cron cleanup jobs
-- ============================================================
SELECT cron.schedule(
  'cleanup-metadata-soft-deleted',
  '0 3 * * *',
  $$DELETE FROM metadata_workspaces WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days'$$
);

SELECT cron.schedule(
  'cleanup-metadata-old-snapshots',
  '0 3 1 * *',
  $$UPDATE metadata_revisions SET snapshot = NULL WHERE snapshot IS NOT NULL AND created_at < now() - interval '90 days'$$
);
