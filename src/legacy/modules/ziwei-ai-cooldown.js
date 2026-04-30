export function createZiweiAiCooldownActions(options) {
  var cooldownTimer = 0

  function remainingSeconds() {
    var remainMs = Math.max(0, Number(options.ziweiAiCooldownUntil.value || 0) - Date.now())
    return Math.max(0, Math.ceil(remainMs / 1000))
  }

  function clearCooldownTimer() {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    cooldownTimer = 0
  }

  function startCooldown(ms, reasonText) {
    var fallbackMs = Number(options.rateLimitCooldownMs || 0)
    var cooldownMs = Math.max(1000, Number(ms || fallbackMs))
    options.ziweiAiCooldownUntil.value = Date.now() + cooldownMs
    var sec = Math.max(1, Math.ceil(cooldownMs / 1000))
    var reason = String(reasonText || '').trim()
    options.ziweiAiCooldownHint.value = reason || 'AI 请求过于频繁，请 ' + String(sec) + ' 秒后重试。'
    clearCooldownTimer()
    cooldownTimer = window.setTimeout(function () {
      options.ziweiAiCooldownUntil.value = 0
      options.ziweiAiCooldownHint.value = ''
      cooldownTimer = 0
    }, cooldownMs + 120)
  }

  function ensureRequestAllowed() {
    var cooldownSec = remainingSeconds()
    if (cooldownSec > 0) {
      var msg = options.ziweiAiCooldownHint.value || 'AI 请求过于频繁，请 ' + String(cooldownSec) + ' 秒后重试。'
      options.ziweiStatus.value = { type: 'info', text: msg }
      return false
    }
    var now = Date.now()
    var delta = now - Number(options.ziweiAiLastRequestAt.value || 0)
    var minIntervalMs = Math.max(0, Number(options.minIntervalMs || 0))
    if (delta > 0 && delta < minIntervalMs) {
      startCooldown(minIntervalMs - delta + 500, '请求过快，请稍后再试。')
      options.ziweiStatus.value = {
        type: 'info',
        text: options.ziweiAiCooldownHint.value || '请求过快，请稍后再试。'
      }
      return false
    }
    options.ziweiAiLastRequestAt.value = now
    return true
  }

  return {
    remainingSeconds,
    startCooldown,
    ensureRequestAllowed,
    clearCooldownTimer
  }
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_ZIWEI_AI_COOLDOWN = {
    createZiweiAiCooldownActions
  }
}
