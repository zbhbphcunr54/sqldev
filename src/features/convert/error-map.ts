export function mapConvertErrorMessage(code: unknown, status = 0): string {
  const errorCode = String(code || '')
    .trim()
    .toLowerCase()

  if (status === 401 || errorCode === 'unauthorized') {
    return '登录状态失效，请重新登录后重试'
  }

  if (status === 403) {
    return '当前访问来源未被允许，请使用已授权域名访问'
  }

  if (status === 413 || errorCode === 'payload_too_large') {
    return '请求内容过大，请精简后重试'
  }

  if (status === 429 || errorCode === 'rate_limited') {
    return '请求过于频繁，请稍后再试'
  }

  if (errorCode === 'invalid_json' || errorCode === 'payload_too_deep') {
    return '请求格式不合法，请刷新页面后重试'
  }

  if (errorCode === 'invalid_rules' || errorCode === 'rules_too_large') {
    return '规则配置过大或格式不正确，请调整后重试'
  }

  if (errorCode === 'invalid_kind' || errorCode === 'invalid_database_type') {
    return '转换参数不合法，请检查数据库类型与转换对象'
  }

  if (errorCode === 'input_empty') return '请输入待转换 SQL'
  if (errorCode === 'input_too_large') return '输入 SQL 过大（超过限制）'

  if (errorCode === 'engine_not_ready' || errorCode === 'server_not_ready') {
    return '转换服务暂未就绪，请稍后重试'
  }

  if (errorCode === 'engine_init_failed') {
    return '转换引擎加载失败，请重新部署 convert 函数后重试'
  }

  if (errorCode === 'conversion_failed') {
    return '转换执行失败，请检查 SQL 内容后重试'
  }

  if (errorCode === 'auth_unavailable') {
    return '鉴权服务暂时不可用，请稍后重试'
  }

  if (errorCode === 'internal_error' || status >= 500) {
    return '转换服务暂时异常，请稍后重试'
  }

  if (status >= 400) {
    return '转换请求失败，请检查输入后重试'
  }

  return '转换请求失败，请稍后重试'
}
