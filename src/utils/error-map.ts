const ERROR_MESSAGE_MAP: Record<string, string> = {
  // Auth
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
  ai_config_limit_exceeded: 'AI 配置数量校验失败，请联系管理员检查服务端限制。',
  ai_config_model_duplicate: '同一供应商下该模型已存在，请不要重复添加。',
  ai_config_not_found: '找不到指定的 AI 配置。',
  ai_config_test_failed: '连接测试失败，请检查 API Key 和地址。',
  ai_config_save_failed: '保存配置失败，请稍后重试。',
  ai_config_delete_failed: '删除配置失败，请稍后重试。',
  ai_config_activate_failed: '激活配置失败，请稍后重试。',
  failed_to_reorder_providers: '更新排序失败，权限不足或数据库错误。',
  orders_required_and_must_be_non_empty: '请求参数缺失，请刷新页面后重试。',
  invalid_order_format: '排序数据格式错误，请刷新页面后重试。',

  // AI Chat
  ai_chat_quota_exceeded: '今日 AI 对话次数已用完，明天 00:00 重置。',
  ai_chat_invalid_message: '消息内容不合法，请重新输入。',
  ai_chat_session_not_found: '对话不存在或已被删除。',

  // Convert / Workbench
  convert_input_empty: '请输入要翻译的 SQL 语句。',
  convert_failed: '翻译失败，请稍后重试。',
  file_read_failed: '文件读取失败。',
  file_loaded: '文件已加载。',
  copy_success: '已复制到剪贴板。',
  copy_failed: '复制失败。',
  copy_nothing: '没有可复制的内容。',
  download_nothing: '没有可下载的内容。',
  verify_prerequisite: '请先进行翻译后再使用 AI 校验。',
  verify_in_progress: 'AI 校验中，请稍候。',
  verify_complete: '校验完成。',

  // ID Tool
  id_district_load_failed: '行政区划数据加载失败。',
  id_birth_invalid: '出生日期不合法。',
  id_generate_success: '已生成合法身份证号码。',
  id_generate_failed: '生成失败。',
  id_format_error: '格式错误。',
  id_checksum_error: '校验码错误。',
  id_uscc_generated: '已生成统一社会信用代码。',
  id_input_required: '请输入证件号码。',

  // Ziwei
  ziwei_birth_invalid: '出生日期无效。',
  ziwei_birth_time_invalid: '出生时间无效。',
  ziwei_chart_failed: '排盘失败。',
  ziwei_ai_network_error: 'AI 分析网络异常，请检查网络后重试。',
  ziwei_ai_service_unavailable: 'AI 分析服务暂时不可用，请稍后重试。',
  ziwei_ai_quota_exceeded: '今日 AI 解读次数已用完。',
  ziwei_ai_unauthorized: '当前账号未开通紫微 AI 解读权限。',
  ziwei_qa_not_ready: '请先生成 AI 深度解盘后再提问。',
  ziwei_qa_failed: '问答请求失败，请稍后重试。',

  // History
  history_load_failed: '加载历史失败。',
  history_save_failed: '保存历史失败。',
  history_delete_failed: '删除历史失败。',

  // Operation Logs
  operation_logs_load_failed: '加载操作日志失败。',

  // App Config
  config_load_partial: '部分配置加载失败，请检查网络后重试。',
  config_clear_cache_failed: '清除缓存失败。',
  config_delete_failed: '删除配置失败。',
  config_status_update_failed: '状态更新失败。',
  config_save_failed: '保存配置失败。',
  config_validation_error: '请填写必填字段。',

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
