export const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981',
  'google-ai-studio': '#4285f4',
  'github-models': '#6e5494',
  anthropic: '#cc785c',
  qwen: '#f0883e',
  doubao: '#ff6b6b',
  ernie: '#00c853',
  'zhipu-ai': '#7c3aed',
  'minimax-ai': '#f97316',
  hunyuan: '#ff4757',
  spark: '#f5a623',
  modelscope: '#fb6f00',
  glm: '#4f46e5',
  deepseek: '#818cf8',
  groq: '#fbbf24',
  openrouter: '#f59e0b',
  mistral: '#e879f9',
  cerebras: '#06b6d4',
  together: '#8b5cf6',
  fireworks: '#ec4899',
  huggingface: '#ffd21e',
  'nvidia-nim': '#76b900',
  cohere: '#ee4266',
  cloudflare: '#f38020',
  xai: '#f97316',
  sambanova: '#e11d48',
  siliconflow: '#06b6d4',
  kluster: '#3b82f6',
  llm7: '#8b5cf6',
  fireworksai: '#ec4899'
}

export const PROVIDER_INITIALS: Record<string, string> = {
  openai: 'GPT',
  anthropic: 'CLD',
  'google-ai-studio': 'GEM',
  qwen: '通义',
  doubao: '豆包',
  ernie: '文心',
  deepseek: 'DS',
  groq: 'GRQ',
  openrouter: 'OR',
  mistral: 'MST',
  cerebras: 'CER',
  together: 'TOG',
  huggingface: 'HF',
  'nvidia-nim': 'NVD',
  cohere: 'COH',
  cloudflare: 'CF',
  'github-models': 'GH',
  xai: 'xAI',
  douyin: '抖音',
  minimax: 'MINI',
  'minimax-ai': 'MINI',
  hunyuan: '混元',
  spark: '讯飞',
  modelscope: '魔搭',
  glm: '智谱',
  'zhipu-ai': '智谱',
  sambanova: 'SN',
  siliconflow: 'SF',
  kluster: 'KLS',
  llm7: 'LLM7',
  fireworksai: 'FW'
}

export function getProviderColor(slug?: string | null): string {
  if (!slug) return '#8b949e'
  return PROVIDER_COLORS[slug] ?? '#8b949e'
}

export function getProviderInitials(slug?: string | null, label?: string | null): string {
  if (slug && PROVIDER_INITIALS[slug]) {
    return PROVIDER_INITIALS[slug]
  }

  const safeLabel = String(label ?? '').trim()
  if (safeLabel) {
    return safeLabel.slice(0, 2).toUpperCase()
  }

  const safeSlug = String(slug ?? '').trim()
  if (safeSlug) {
    return safeSlug.slice(0, 2).toUpperCase()
  }

  return 'AI'
}
