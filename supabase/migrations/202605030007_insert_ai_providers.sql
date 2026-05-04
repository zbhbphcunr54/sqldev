-- [2026-05-03] 插入 AI 供应商种子数据
-- 国际供应商
INSERT INTO public.ai_providers (slug, label, region, base_url, default_model, models, sort_order) VALUES
('openai',        'OpenAI',           'international', 'https://api.openai.com/v1',               'gpt-4o',            '["gpt-4o","gpt-4o-mini","gpt-4-turbo","o1-preview","o1-mini"]',                        10),
('claude',        'Anthropic Claude', 'international', 'https://api.anthropic.com/v1',             'claude-sonnet-4-20250514', '["claude-sonnet-4-20250514","claude-3-5-haiku-20241022","claude-3-opus-20240229"]', 20),
('openrouter',    'OpenRouter',       'international', 'https://openrouter.ai/api/v1',            'meta-llama/llama-3.3-70b-instruct', '["openai/gpt-4o","anthropic/claude-3.5-sonnet","meta-llama/llama-3.3-70b-instruct"]', 40),
('gemini',        'Google Gemini',    'international', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-2.0-flash', '["gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-flash"]', 45),
('github-models', 'GitHub Models',    'international', 'https://models.inference.ai.azure.com',   'gpt-4o',            '["gpt-4o","gpt-4o-mini","Phi-3.5-MoE-instruct"]',                                   50),
('groq',          'Groq',             'international', 'https://api.groq.com/openai/v1',          'llama-3.3-70b-versatile', '["llama-3.3-70b-versatile","llama-3.1-8b-instant","qwen3-32b"]',           70);

-- 非 OpenAI 兼容供应商的 API 格式标记
UPDATE public.ai_providers SET api_format = 'anthropic' WHERE slug = 'claude';

-- 国内供应商
INSERT INTO public.ai_providers (slug, label, region, base_url, default_model, models, sort_order) VALUES
('deepseek',      'DeepSeek',         'cn', 'https://api.deepseek.com/v1',              'deepseek-chat',     '["deepseek-chat","deepseek-v3","deepseek-reasoner"]',                                100),
('qwen',          'Qwen (通义千问)',    'cn', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-max', '["qwen-max","qwen-plus","qwen-turbo","qwen-long"]',                                       110),
('glm',           'ChatGLM (智谱)',    'cn', 'https://open.bigmodel.cn/api/paas/v4',   'glm-4-flash',       '["glm-4-flash","glm-4.7-flash","glm-4.5-air","glm-4"]',                              120),
('doubao',        'Doubao (豆包)',     'cn', 'https://ark.cn-beijing.volces.com/api/v3','doubao-pro-32k',    '["doubao-pro-32k","doubao-lite-32k"]',                                              130),
('ernie',         'ERNIE Bot (文心一言)','cn', 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop', 'ernie-4.0-8k', '["ernie-4.0-8k","ernie-3.5-8k","ernie-speed-8k"]',                        140),
('spark',         'Spark (讯飞星火)',   'cn', 'https://spark-api-open.xf-yun.com/v3',   'spark-lite',        '["spark-lite","generalv3.5","generalv3","generalv2"]',                               150),
('hunyuan',       'Hunyuan (混元)',    'cn', 'https://hunyuan.tencentcloudapi.com',    'hunyuan-lite',      '["hunyuan-lite","hunyuan-t1","hunyuan-turbos","hunyuan-pro"]',                       160),
('moonshot',      'Moonshot (月之暗面)','cn', 'https://api.moonshot.cn/v1',             'moonshot-v1-128k',  '["moonshot-v1-128k","moonshot-v1-32k","moonshot-v1-8k"]',                          170),
('siliconflow',   'SiliconFlow',      'cn', 'https://api.siliconflow.cn/v1',           'deepseek-ai/DeepSeek-V3', '["deepseek-ai/DeepSeek-V3","Qwen/Qwen2.5-72B-Instruct"]',                   190);

-- 非 OpenAI 兼容供应商的 API 格式标记
UPDATE public.ai_providers SET api_format = 'custom' WHERE slug IN ('ernie', 'hunyuan', 'spark');
