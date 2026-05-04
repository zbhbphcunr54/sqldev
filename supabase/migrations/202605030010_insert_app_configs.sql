-- [2026-05-03] 插入默认配置种子数据
-- 注意：敏感配置（如 API Key）需要管理员通过 UI 手动配置

-- CORS 配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('cors', 'primary_origin', 'https://gitzhengpeng.github.io', 'string', '前端主站域名，用于 CORS 白名单')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('cors', 'allowed_origins', '[]', 'jsonb', '额外允许的 CORS 域名列表，JSON 数组')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('cors', 'allow_localhost', 'false', 'boolean', '是否允许 localhost 开发调试')
ON CONFLICT (category, key) DO NOTHING;

-- 限流配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('rate_limit', 'convert_requests', '20', 'number', 'SQL 转换限流次数')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('rate_limit', 'convert_window_ms', '60000', 'number', 'SQL 转换限流窗口（毫秒）')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('rate_limit', 'feedback_requests', '10', 'number', '反馈提交限流次数')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('rate_limit', 'history_requests', '30', 'number', '历史记录限流次数')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('rate_limit', 'ziwei_requests', '6', 'number', '紫微分析限流次数')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('rate_limit', 'convert_verify_requests', '10', 'number', 'AI 校验限流次数')
ON CONFLICT (category, key) DO NOTHING;

-- 转换配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('convert', 'max_request_bytes', '6291456', 'number', '请求体最大字节（6MB）')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('convert', 'max_json_depth', '14', 'number', 'JSON 嵌套最大深度')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('convert', 'max_rules_bytes', '262144', 'number', '规则文件最大字节（256KB）')
ON CONFLICT (category, key) DO NOTHING;

-- AI 校验配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('convert_verify', 'max_sql_length', '50000', 'number', 'SQL 最大字符数')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('convert_verify', 'max_tokens', '4000', 'number', 'AI 校验最大 tokens')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('convert_verify', 'daily_limit', '10', 'number', '每日校验次数限制')
ON CONFLICT (category, key) DO NOTHING;

-- 紫微分析默认配置（非加密，API Key 需要单独管理）
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei', 'base_url', 'https://api.openai.com/v1', 'string', 'AI API 地址')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei', 'model', 'gpt-4.1-mini', 'string', '默认 AI 模型')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei', 'timeout_ms', '20000', 'number', 'AI 请求超时（毫秒）')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei', 'analysis_max_tokens', '900', 'number', '深度解读最大 tokens')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei', 'allowed_emails', '[]', 'jsonb', '允许访问的邮箱白名单，空数组表示不限制')
ON CONFLICT (category, key) DO NOTHING;

-- AI 问答配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei_qa', 'max_tokens', '520', 'number', '问答最大 tokens')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei_qa', 'max_question_chars', '220', 'number', '问题最大字符数')
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei_qa', 'suggestions', '[]', 'jsonb', '问答下拉建议列表，JSON 数组')
ON CONFLICT (category, key) DO NOTHING;

-- AI 图表配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('ziwei_chart', 'max_chart_chars', '12000', 'number', '图表解读最大字符数')
ON CONFLICT (category, key) DO NOTHING;

-- 系统配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
VALUES ('system', 'cron_secret', '', 'string', '定时任务调用密钥')
ON CONFLICT (category, key) DO NOTHING;
