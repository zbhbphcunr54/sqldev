const ERROR_MESSAGE_MAP: Record<string, string> = {
  // Auth errors
  unauthorized: '登录已失效，请重新登录。',
  forbidden_user: '当前账号无权限访问该功能。',
  auth_password_failed: '登录失败，请检查邮箱和密码。',
  auth_otp_failed: '验证码发送失败，请稍后重试。',
  auth_otp_sent: '验证码已发送，请检查邮箱。',
  auth_reset_failed: '重置邮件发送失败，请稍后重试。',
  auth_reset_sent: '重置邮件已发送，请检查邮箱。',
  auth_email_invalid: '邮箱格式不正确。',
  auth_password_too_short: '密码至少需要 6 位。',
  auth_password_mismatch: '两次输入的密码不一致。',
  auth_email_required: '请输入邮箱地址。',
  auth_password_required: '请输入密码。',
  auth_code_required: '请输入验证码。',
  auth_code_invalid: '验证码格式不正确。',
  auth_user_not_found: '用户不存在。',
  auth_invalid_credentials: '邮箱或密码错误。',
  auth_registration_failed: '注册失败，请稍后重试。',
  auth_social_login_failed: '第三方登录失败，请重试。',
  auth_logout_failed: '登出失败，请重试。',
  auth_session_expired: '会话已过期，请重新登录。',
  auth_email_not_confirmed: '邮箱未验证，请先完成邮箱验证。',
  auth_email_already_registered: '该邮箱已注册，请直接登录。',
  auth_password_same: '新密码不能与旧密码相同，请换一个新密码。',
  auth_weak_password: '密码需同时包含大写字母、小写字母、数字和特殊字符。',
  auth_rate_limited: '操作过于频繁，请稍后再试。',
  auth_otp_invalid: '验证码无效或已过期，请重新获取。',
  auth_network_error: '网络异常，请检查网络后重试。',

  // Rate limit / quota
  rate_limited: '请求过于频繁，请稍后重试。',
  quota_exceeded: '今日校验次数已用完，明天 00:00 重置。',

  // Convert/Verify
  invalid_kind: '不支持的转换类型。',
  missing_sql: '缺少原始 SQL 或转换后 SQL。',
  sql_too_long: 'SQL 内容过长，请缩短后重试。',
  verify_failed: 'AI 校验失败，请稍后重试。',
  verify_profile_not_found: '校验配置不存在。',
  verify_profile_save_failed: '校验配置保存失败。',
  verify_profile_delete_failed: '删除校验配置失败。',

  // AI upstream
  ai_upstream_rate_limited: 'AI 服务繁忙，请稍后重试。',
  ai_request_timeout: 'AI 响应超时，请稍后重试。',
  ai_upstream_timeout: 'AI 上游超时，请稍后重试。',
  ai_upstream_auth_failed: 'AI 服务配置异常，请联系管理员。',
  ai_upstream_not_found: 'AI 接口地址配置错误，请检查服务端参数。',
  ai_upstream_unavailable: 'AI 服务暂不可用，请稍后重试。',
  ai_response_invalid: 'AI 返回格式异常，请稍后重试。',
  ai_analysis_failed: 'AI 解析失败，请稍后重试。',

  // Network
  network_timeout: '网络请求超时，请稍后重试。',
  session_refresh_failed: '登录状态已过期，请重新登录。',

  // Feedback
  feedback_success: '建议已提交，感谢你的反馈。',
  feedback_invalid_payload: '建议内容格式不正确，请补充后再提交。',
  feedback_network_failed: '网络连接失败，请检查网络后重试。',
  feedback_service_unavailable: '反馈服务暂时不可用，请稍后重试。',
  feedback_submit_failed: '提交失败，请稍后重试。',

  // AI Config
  ai_config_limit_exceeded: '全站配置数已达上限（20 条），请删除不需要的配置后重试。',
  ai_config_not_found: '找不到指定的 AI 配置。',
  ai_config_test_failed: '连接测试失败，请检查 API Key 和地址。',
  ai_config_save_failed: '保存配置失败，请稍后重试。',
  ai_config_delete_failed: '删除配置失败，请稍后重试。',
  ai_config_activate_failed: '激活配置失败，请稍后重试。',

  // Misc
  provider_disabled: '该供应商已被禁用。',
  forbidden: '无权限执行此操作，请联系管理员。',
  server_error: '服务器错误，请稍后重试。',
  network_error: '网络连接失败，请检查网络后重试。',
  unknown_error: '发生未知错误，请稍后重试。'
}

export function mapErrorCodeToMessage(code: string): string {
  return ERROR_MESSAGE_MAP[code] || '请求失败，请稍后重试。'
}
