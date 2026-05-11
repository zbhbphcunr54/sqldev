-- 202605110010_unified_rate_limit_configs.sql
-- 统一全局限流、AI 对话、AI 配置、反馈、CORS 配置项
-- 消除硬编码值，全部走 app_configs 管理

-- 全局限流默认值（A1）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('rate_limit', 'max_requests', '10', 'number', '全局每分钟最大请求数（默认值）', true),
('rate_limit', 'window_ms', '60000', 'number', '全局限流窗口（毫秒）', true)
ON CONFLICT (category, key) DO NOTHING;

-- AI 对话配置补充（A2）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('ai_chat', 'max_message_length', '4000', 'number', '用户消息最大长度（字符数）', true),
('ai_chat', 'max_sessions', '50', 'number', '会话列表最大返回条数', true)
ON CONFLICT (category, key) DO NOTHING;

-- AI 配置管理补充（A3）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('ai_config', 'max_configs_global', '20', 'number', 'AI 配置全局最大数量', true),
('ai', 'test_cooldown_seconds', '10', 'number', 'AI 配置测试冷却时间（秒）', true)
ON CONFLICT (category, key) DO NOTHING;

-- 反馈配置补充（A5）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('feedback', 'min_content_length', '6', 'number', '反馈内容最小长度', true)
ON CONFLICT (category, key) DO NOTHING;

-- CORS 配置补充（A7）
INSERT INTO app_configs (category, key, value, value_type, description, is_active) VALUES
('cors', 'allow_headers', 'authorization, x-client-info, apikey, content-type', 'string', 'CORS 允许的请求头', true),
('cors', 'allow_methods', 'GET, POST, PATCH, DELETE, OPTIONS', 'string', 'CORS 允许的 HTTP 方法', true)
ON CONFLICT (category, key) DO NOTHING;
