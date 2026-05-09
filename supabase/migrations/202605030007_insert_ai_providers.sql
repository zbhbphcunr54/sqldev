-- [2026-05-07] 插入免费 AI 供应商种子数据（基于 free-llm-api-providers 文档）
-- 国际供应商（Tier 1：永久免费）
INSERT INTO public.ai_providers (slug, label, region, base_url, default_model, models, sort_order) VALUES
('google-ai-studio', 'Google AI Studio (Gemini)', 'international', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-2.5-flash', '["gemini-2.5-pro","gemini-2.5-flash","gemini-2.5-flash-lite","gemma-4-31b-it"]', 10),
('groq',             'Groq',                      'international', 'https://api.groq.com/openai/v1',                   'llama-3.3-70b-versatile', '["llama-3.3-70b-versatile","llama-4-scout","qwen3-32b","gpt-oss-20b"]', 20),
('openrouter',       'OpenRouter',                 'international', 'https://openrouter.ai/api/v1',                     'deepseek/deepseek-r1-0528:free', '["deepseek/deepseek-r1-0528:free","deepseek/deepseek-chat-v3-0324:free","qwen/qwen3.6-plus:free","qwen/qwen3-coder-480b-a35b:free","meta-llama/llama-4-scout:free","meta-llama/llama-4-maverick:free","meta-llama/llama-3.3-70b-instruct:free","google/gemma-4-31b-it:free","nvidia/nemotron-3-super-120b-a12b:free","openai/gpt-oss-120b:free","minimax/minimax-m2.5:free","mistralai/devstral-2512:free"]', 30),
('mistral',          'Mistral AI',                 'international', 'https://api.mistral.ai/v1',                        'mistral-large-latest', '["mistral-large-latest","mistral-small-latest","codestral-latest","pixtral-12b-2409"]', 40),
('cerebras',         'Cerebras',                   'international', 'https://api.cerebras.ai/v1',                       'llama-3.3-70b', '["llama-3.3-70b","llama-3.1-8b","qwen-3-32b","qwen-3-235b"]', 50),
('github-models',    'GitHub Models',              'international', 'https://models.inference.ai.azure.com',            'gpt-4o', '["gpt-4o","gpt-4.1","o3","grok-3","llama-3.3-70b","phi-4"]', 60),
('cloudflare',       'Cloudflare Workers AI',      'international', 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run', '@cf/meta/llama-3.2-3b-instruct', '["@cf/meta/llama-3.2-3b-instruct","@cf/mistral/mistral-7b-instruct-v0.2"]', 70),
('nvidia-nim',       'NVIDIA NIM',                 'international', 'https://integrate.api.nvidia.com/v1',              'deepseek-r1', '["deepseek-r1","deepseek-v3.1","llama-3.3-70b","kimi-k2.5"]', 80),
('cohere',           'Cohere',                     'international', 'https://api.cohere.ai/v1',                         'command-r-plus', '["command-r-plus","command-r","embed-v4","rerank-v3"]', 90),
('huggingface',      'HuggingFace Inference',      'international', 'https://api-inference.huggingface.co/models',      'meta-llama/Llama-3.3-70B-Instruct', '["meta-llama/Llama-3.3-70B-Instruct","mistralai/Mistral-7B-Instruct-v0.2"]', 100),
('llm7',             'LLM7.io',                    'international', 'https://api.llm7.io/v1',                           'llama-3.3-70b', '["llama-3.3-70b"]', 110),
('sambanova',        'SambaNova',                  'international', 'https://api.sambanova.ai/v1',                      'llama-3.3-70b', '["llama-3.3-70b","llama-3.1-405b","qwen-2.5-72b"]', 120);

-- 国内供应商
INSERT INTO public.ai_providers (slug, label, region, base_url, default_model, models, sort_order) VALUES
('siliconflow',   'SiliconFlow (硅基流动)',   'cn', 'https://api.siliconflow.cn/v1',                              'Qwen/Qwen2-7B-Instruct', '["Qwen/Qwen2-7B-Instruct","Qwen/Qwen2-1.5B-Instruct","THUDM/glm-4-9b-chat","THUDM/chatglm3-6b","internlm/internlm2_5-7b-chat","meta-llama/Meta-Llama-3.1-8B-Instruct","mistralai/Mistral-7B-Instruct-v0.2","01-ai/Yi-1.5-9B-Chat-16K"]', 200),
('glm',           'ChatGLM (智谱 AI)',        'cn', 'https://open.bigmodel.cn/api/paas/v4',                       'glm-4-flash', '["glm-4-flash","glm-4-air"]', 210),
('deepseek',      'DeepSeek (深度求索)',       'cn', 'https://api.deepseek.com/v1',                                'deepseek-chat', '["deepseek-chat","deepseek-reasoner"]', 220),
('qwen',          'Qwen (通义千问)',          'cn', 'https://dashscope.aliyuncs.com/compatible-mode/v1',           'qwen-turbo', '["qwen-turbo","qwen-long"]', 230),
('ernie',         'ERNIE Bot (百度文心)',      'cn', 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop', 'ernie-speed', '["ernie-speed","ernie-lite"]', 240),
('doubao',        'Doubao (豆包)',            'cn', 'https://ark.cn-beijing.volces.com/api/v3',                    'doubao-lite', '["doubao-lite","doubao-pro"]', 250),
('hunyuan',       'Hunyuan (腾讯混元)',       'cn', 'https://hunyuan.tencentcloudapi.com',                         'hunyuan-lite', '["hunyuan-lite","hunyuan-3-preview"]', 260),
('spark',         'Spark (讯飞星火)',         'cn', 'wss://spark-api.xf-yun.com',                                  'spark-lite', '["spark-lite","spark-pro"]', 270),
('modelscope',    'ModelScope (魔搭社区)',    'cn', 'https://api-inference.modelscope.cn/v1',                       'qwen-turbo', '["qwen-turbo"]', 280);

-- Tier 2：免费试用额度供应商（额度可能过期）
INSERT INTO public.ai_providers (slug, label, region, base_url, default_model, models, sort_order) VALUES
('xai',           'xAI',              'international', 'https://api.x.ai/v1',                    'grok-4', '["grok-4","grok-4.1-fast"]', 300),
('fireworks',     'Fireworks AI',     'international', 'https://api.fireworks.ai/inference/v1',   'accounts/fireworks/models/llama-v3p1-405b-instruct', '["accounts/fireworks/models/llama-v3p1-405b-instruct","accounts/fireworks/models/deepseek-r1"]', 310),
('ai21',          'AI21 Labs',        'international', 'https://api.ai21.com/studio/v1',         'jamba-large', '["jamba-large","jamba-mini"]', 320),
('anthropic',     'Anthropic',        'international', 'https://api.anthropic.com/v1',           'claude-sonnet-4-20250514', '["claude-sonnet-4-20250514","claude-opus-4-20250514"]', 330),
('openai',        'OpenAI',           'international', 'https://api.openai.com/v1',              'gpt-4o', '["gpt-4o","gpt-4.1"]', 340),
('together',      'Together AI',      'international', 'https://api.together.xyz/v1',            'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', '["meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8","deepseek-ai/DeepSeek-R1"]', 350),
('kluster',       'Kluster AI',       'international', 'https://api.kluster.ai/v1',              'deepseek-r1', '["deepseek-r1","llama-4","qwen3-235b"]', 360);

-- 非 OpenAI 兼容供应商的 API 格式标记
UPDATE public.ai_providers SET api_format = 'anthropic' WHERE slug = 'anthropic';
UPDATE public.ai_providers SET api_format = 'custom' WHERE slug IN ('ernie', 'hunyuan', 'spark', 'cloudflare', 'cohere');
UPDATE public.ai_providers SET api_format = 'ollama' WHERE slug = 'ollama-cloud';
