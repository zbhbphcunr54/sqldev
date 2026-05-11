-- [2026-05-03] 插入默认配置种子数据
-- 注意：敏感配置（如 API Key）需要管理员通过 UI 手动配置

-- 核心限流（必须）
INSERT INTO app_configs (category, key, value, value_type, is_active) VALUES
('rate_limit', 'ddl_requests', '10', 'number', true),
('rate_limit', 'ddl_window_ms', '60000', 'number', true),
('rate_limit', 'func_requests', '10', 'number', true),
('rate_limit', 'func_window_ms', '60000', 'number', true),
('rate_limit', 'proc_requests', '10', 'number', true),
('rate_limit', 'proc_window_ms', '60000', 'number', true),
('rate_limit', 'ziwei_requests', '30', 'number', true),
('rate_limit', 'ziwei_window_ms', '60000', 'number', true),
('rate_limit', 'feedback_requests', '10', 'number', true),
('rate_limit', 'feedback_window_ms', '60000', 'number', true),
('rate_limit', 'rules_requests', '10', 'number', true),
('rate_limit', 'rules_window_ms', '60000', 'number', true),
('rate_limit', 'store_mode', 'kv', 'string', true);

-- 功能配置
INSERT INTO app_configs (category, key, value, value_type, is_active) VALUES
('feedback', 'max_content_length', '1200', 'number', true),
('feedback', 'max_contact_length', '120', 'number', true),
('convert_verify', 'daily_limit', '10', 'number', true);

-- CORS 配置（通过 app_configs 表管理，不再硬编码）
INSERT INTO app_configs (category, key, value, value_type, is_active) VALUES
('cors', 'primary_origin', 'https://zbhbphcunr54.github.io', 'string', true),
('cors', 'allowed_origins', 'http://127.0.0.1:4173,http://localhost:5173,https://zbhbphcunr54.github.io', 'string', true),
('cors', 'allow_localhost', 'true', 'boolean', true);

-- 加密主密钥（AES-256-GCM，32字节 Base64）。部署前替换 PLACEHOLDER 为实际值
-- 生成命令: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
insert into app_configs (category, key, value, value_type, description, is_active) values
('system', 'encrypt_key', 'PLACEHOLDER_CHANGE_ME', 'string', 'AES-256-GCM 加密主密钥，用于加解密 ai_configs.api_key 等敏感字段', true);

