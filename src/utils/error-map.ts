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
  ai_analysis_failed: 'AI 解析失败，请稍后重试。',
  network_timeout: '网络请求超时，请稍后重试。',
  session_refresh_failed: '登录状态已过期，请重新登录。',
  auth_password_failed: '登录失败，请检查邮箱和密码。',
  auth_otp_failed: '验证码发送失败，请稍后重试。',
  auth_otp_sent: '验证码已发送，请检查邮箱。',
  auth_reset_failed: '重置邮件发送失败，请稍后重试。',
  auth_reset_sent: '重置邮件已发送，请检查邮箱。',
  feedback_success: '建议已提交，感谢你的反馈。',
  feedback_invalid_payload: '建议内容格式不正确，请补充后再提交。',
  feedback_network_failed: '网络连接失败，请检查网络后重试。',
  feedback_service_unavailable: '反馈服务暂时不可用，请稍后重试。',
  feedback_submit_failed: '提交失败，请稍后重试。'
}

export function mapErrorCodeToMessage(code: string): string {
  return ERROR_MESSAGE_MAP[code] || '请求失败，请稍后重试。'
}
