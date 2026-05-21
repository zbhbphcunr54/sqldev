-- [2026-05-18] 停用旧版 unified SQL 转换模板，强制改走 system/user 两段配置

update app_configs
set
  is_active = false,
  description = coalesce(description, '') || '（已停用：请改用 sql_convert_template.system / sql_convert_template.user）',
  updated_at = now()
where category = 'sql_convert_template'
  and key = 'unified'
  and is_active = true;
