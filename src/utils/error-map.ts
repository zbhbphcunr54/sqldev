const ERROR_MESSAGE_MAP: Record<string, string> = {
  unauthorized: '登录已失效，请重新登录。',
  forbidden_user: '当前账号无权限访问该功能。',
  rate_limited: '请求过于频繁，请稍后重试。',
  ai_upstream_rate_limited: 'AI 服务繁忙，请稍后重试。',
  ai_request_timeout: 'AI 响应超时，请稍后重试。',
  ai_upstream_timeout: 'AI 上游超时，请稍后重试。',
  ai_upstream_auth_failed: 'AI 服务配置异常，请联系管理员。',
  ai_upstream_not_found: 'AI 接口地址配置错误，请检查服务端参数。',
  ai_upstream_unavailable: 'AI 服务暂不可用，请稍后重试。',
  ai_response_invalid: 'AI 返回格式异常，请稍后重试。',
  ai_analysis_failed: 'AI 解析失败，请稍后重试。'
}

export function mapErrorCodeToMessage(code: string): string {
  return ERROR_MESSAGE_MAP[code] || '请求失败，请稍后重试。'
}
