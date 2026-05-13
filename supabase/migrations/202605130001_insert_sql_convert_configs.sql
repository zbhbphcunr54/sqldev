-- [2026-05-13] 插入 SQL 转换（AI 驱动）的 app_configs 配置种子数据
-- 数据库列表、Prompt 模板、参数限制全部走 app_configs 管理

-- 支持的数据库列表（JSON 字符串数组）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert', 'databases',
  '["oracle","mysql","postgresql","kingbasees","dm8","yashan","gaussdb","goldendb","oceanbase_oracle","oceanbase_mysql","tdsql_mysql","tdsql_pg","tidb","gbase_8a","gbase_8c","gbase_8s","hivesql"]',
  'jsonb', '支持的源/目标数据库 slug 列表，前端和后端共用', true);

-- SQL 转换参数限制
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert', 'max_input_length', '100000', 'number', '单次转换最大输入 SQL 字符数', true),
('sql_convert', 'timeout_ms', '120000', 'number', 'AI 请求超时毫秒数', true);

-- 统一 SQL 转换 Prompt 模板（支持 DDL / 函数 / 存储过程，自动检测并转换）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('sql_convert_template', 'unified',
  'You are an expert database migration engineer. Convert the following SQL from {{source_db}} to {{target_db}}.
The SQL may be DDL (CREATE TABLE / indexes / constraints / partitions), a stored function, a stored procedure, or a mix of these.
Auto-detect the type(s) and convert accordingly.

Conversion rules:
1. Map all data types precisely between {{source_db}} and {{target_db}}. If a type has no direct equivalent, pick the closest match and flag it.
2. Convert all constructs: syntax, built-in functions, system tables, hints, compiler directives, exception handling, cursors, transaction control, DDL options.
3. Preserve original logic, naming, comments, and formatting as much as possible.
4. Mark every change site with a brief inline comment explaining the behavioral difference, limitation, or trade-off.

Output format — valid JSON only, no markdown fences, no extra text outside the JSON object:
{
  "converted_sql": "<full converted SQL string, all statements, escaped for JSON>",
  "ai_ratio": <integer 0-100, percentage of SQL statements fully auto-converted without manual concern>,
  "manual_needed": <true | false, whether any part requires human review or manual rewrite>,
  "manual_parts": ["<description of each portion that needs manual attention>"],
  "notes": ["<important warnings, behavioral differences, assumptions, or limitations>"],
  "accuracy": "<high | medium | low, overall confidence in conversion correctness>"
}

Source SQL:
{{input_sql}}',
  'string', '统一 SQL 转换 system prompt 模板（DDL/函数/存储过程通用），输出结构化 JSON', true);

-- 限流配置（sql-convert 专用）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('rate_limit', 'sql_convert_requests', '20', 'number', 'sql-convert 每个窗口期最大请求数', true),
('rate_limit', 'sql_convert_window_ms', '60000', 'number', 'sql-convert 限流窗口毫秒数', true),
('rate_limit', 'sql_convert_track_max', '2000', 'number', 'sql-convert 限流追踪表上限', true),
('rate_limit', 'sql_convert_store_mode', 'kv', 'string', 'sql-convert 限流存储模式：kv / memory', true);
