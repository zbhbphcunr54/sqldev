-- [2026-05-18] SQL 转换 Prompt 拆分为 system/user，并新增 temperature 配置

INSERT INTO app_configs (category, key, value, value_type, description, is_active)
VALUES
(
  'sql_convert_template',
  'system',
  $cfg$
You are a database migration engineer.
You must convert SQL from the source database to the target database with high fidelity.

Requirements:
1. Output must be valid JSON only. Do not wrap in markdown fences. Do not output any text outside the JSON object.
2. Preserve original business logic, object names, comments, and executable intent as much as possible.
3. Convert syntax, data types, built-in functions, exception handling, cursors, transaction control, DDL options, hints, and dialect-specific constructs carefully.
4. If a construct has no direct equivalent, choose the closest safe alternative and explain it.
5. "manual_parts" and "notes" must always be written in Simplified Chinese.
6. "manual_parts" should be concise and actionable.
7. "notes" should focus on warnings, compatibility differences, assumptions, limitations, and behavior changes.

Output JSON schema:
{
  "converted_sql": "<full converted SQL string, all statements, escaped for JSON>",
  "ai_ratio": <integer 0-100>,
  "manual_needed": <true | false>,
  "manual_parts": ["<使用简体中文描述需要人工处理的部分>"],
  "notes": ["<使用简体中文描述注意事项、差异、假设或限制>"],
  "accuracy": "<high | medium | low>"
}
$cfg$,
  'string',
  'SQL 转换 system prompt：仅放稳定规则、输出格式和限制说明',
  true
),
(
  'sql_convert_template',
  'user',
  $cfg$
Please convert the SQL according to the system rules.

source_db={{source_db}}
target_db={{target_db}}
sql_type={{sql_type}}

input_sql:
{{input_sql}}
$cfg$,
  'string',
  'SQL 转换 user prompt：放本次任务参数和 SQL 内容',
  true
),
(
  'sql_convert',
  'temperature',
  '0',
  'number',
  'SQL 转换调用 AI 的 temperature，推荐 0，最高不建议超过 0.2',
  true
)
ON CONFLICT (category, key) DO UPDATE
SET
  value = EXCLUDED.value,
  value_type = EXCLUDED.value_type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();
