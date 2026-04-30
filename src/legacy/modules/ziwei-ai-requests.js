async function ensureAuthReady(options, silent, authPrompt) {
  if (
    (!window.authApi || typeof window.authApi.invokeFunction !== 'function') &&
    typeof window.__loadSqldevAuthNow === 'function'
  ) {
    try {
      await window.__loadSqldevAuthNow()
    } catch (err) {
      console.warn('[SQLDev] Ziwei AI auth module load failed', err)
    }
  }
  if (!window.authApi || typeof window.authApi.invokeFunction !== 'function') {
    if (!silent) options.ziweiStatus.value = { type: 'error', text: '认证模块未初始化，无法调用 AI。' }
    return false
  }
  if (typeof window.authApi.getUserSync === 'function' && !window.authApi.getUserSync()) {
    if (!silent) {
      if (typeof window.authApi.openAuthModal === 'function') {
        window.authApi.openAuthModal(authPrompt)
      }
      options.ziweiStatus.value = { type: 'error', text: '未登录，无法调用 AI 服务。' }
    }
    return false
  }
  return true
}

function extractAnswer(data) {
  if (data && typeof data.answer === 'string') return String(data.answer || '').trim()
  if (data && data.analysis && typeof data.analysis.overview === 'string') {
    return String(data.analysis.overview || '').trim()
  }
  return ''
}

export function createZiweiAiRequestActions(options) {
  var analysisCache = new Map()
  var inFlightPromise = null
  var inFlightSignature = ''

  async function submitQuestion() {
    if (!options.ziweiChart.value) {
      options.ziweiStatus.value = { type: 'info', text: '请先完成排盘。' }
      return
    }
    if (options.ziweiAiQuestionLoading.value) return
    if (!(await ensureAuthReady(options, false, '请先登录后再使用 AI 问答'))) return

    var question = String(options.ziweiAiQuestionInput.value || '').trim()
    if (!question) {
      options.ziweiStatus.value = { type: 'info', text: '请输入问题后再发送。' }
      options.openSuggestions()
      return
    }
    if (!options.ensureRequestAllowed()) return

    options.ziweiAiQuestionLoading.value = true
    options.ziweiAiSuggestionOpen.value = false
    options.ziweiAiResult.value = null
    options.ziweiAiDone.value = false
    options.ziweiAiError.value = ''
    options.ziweiAiQuestionAnswer.value = ''
    options.ziweiStatus.value = { type: 'info', text: 'AI 正在思考中，请稍后...' }
    var startedAt = Date.now()
    try {
      var payload = options.buildAiPayload(options.ziweiChart.value)
      var result = await window.authApi.invokeFunction('ziwei-analysis', {
        mode: 'qa',
        style: 'pro',
        question: question,
        chart: payload
      })
      if (result && result.error) {
        var parsed = await options.parseInvokeError(result.error)
        var detail = String(parsed.detail || (result.error && result.error.message) || result.error || '请求失败')
        throw new Error(detail || '请求失败')
      }
      var answer = extractAnswer(result ? result.data : null)
      if (!answer) throw new Error('AI 未返回可用问答内容')
      options.ziweiAiQuestionAnswer.value = answer
      var elapsedMs = Date.now() - startedAt
      options.ziweiAiLastDurationMs.value = elapsedMs
      options.ziweiStatus.value = {
        type: 'success',
        text: 'AI 问答已生成（思考耗时 ' + options.formatDuration(elapsedMs) + '）。'
      }
    } catch (err) {
      var msg = String((err && err.message) || err || 'AI 问答失败')
      if (options.isRateLimitError(msg)) {
        options.startCooldown(options.rateLimitCooldownMs, '您的账户已达到速率限制，请稍后再试。')
        msg = options.ziweiAiCooldownHint.value || msg
      }
      if (!options.isRateLimitError(msg)) msg = options.mapErrorMessage(msg)
      options.ziweiStatus.value = { type: 'error', text: 'AI 问答失败：' + msg }
    } finally {
      options.ziweiAiQuestionLoading.value = false
    }
  }

  async function requestAnalysis(requestOptions) {
    var opt = requestOptions || {}
    var force = opt.force === true
    var silent = opt.silent === true
    if (!options.ziweiChart.value) {
      if (!silent) options.ziweiStatus.value = { type: 'info', text: '请先完成排盘。' }
      return
    }
    if (!(await ensureAuthReady(options, silent, '请先登录后再使用 AI 深度解盘'))) return
    if (!options.ensureRequestAllowed()) return

    var aiSignature = options.buildAiSignature(options.ziweiChart.value)
    if (!force && aiSignature && analysisCache.has(aiSignature)) {
      var cached = analysisCache.get(aiSignature)
      options.ziweiAiResult.value = cached
      options.ziweiAiDone.value = true
      options.ziweiAiError.value = ''
      options.ziweiAiUpdatedAt.value = Date.now()
      options.ziweiLastAiSignature.value = aiSignature
      if (!silent) options.ziweiStatus.value = { type: 'success', text: '已加载缓存的 AI 个性化解盘。' }
      return
    }
    if (inFlightPromise) {
      if (!silent) options.ziweiStatus.value = { type: 'info', text: 'AI 正在思考中，请勿重复点击。' }
      return inFlightPromise
    }
    if (options.ziweiAiLoading.value) {
      if (!silent) options.ziweiStatus.value = { type: 'info', text: 'AI 正在思考中，请稍后...' }
      return
    }

    var invokeAnalysis = async function (payload) {
      return await window.authApi.invokeFunction('ziwei-analysis', {
        signature: aiSignature,
        style: 'pro',
        chart: payload
      })
    }
    var primaryPayloadBuilder =
      options.primaryPayloadMode === 'compact' ? options.buildAiPayloadCompact : options.buildAiPayloadLite
    var secondaryPayloadBuilder =
      options.primaryPayloadMode === 'compact' ? options.buildAiPayloadLite : options.buildAiPayloadCompact
    var getErrorDetail = async function (rawErr) {
      var parsed = await options.parseInvokeError(rawErr)
      return String(parsed.detail || (rawErr && rawErr.message) || rawErr || '请求失败')
    }

    options.ziweiAiLoading.value = true
    options.ziweiAiError.value = ''
    options.ziweiAiLastDurationMs.value = 0
    var startedAt = Date.now()
    if (!silent) options.ziweiStatus.value = { type: 'info', text: 'AI 正在思考中，请稍后...' }
    try {
      inFlightSignature = aiSignature
      var result = null
      try {
        inFlightPromise = invokeAnalysis(primaryPayloadBuilder(options.ziweiChart.value))
        result = await inFlightPromise
        if (result && result.error) throw result.error
      } catch (firstErr) {
        var firstDetail = await getErrorDetail(firstErr)
        if (options.isRateLimitError(firstDetail)) throw new Error(firstDetail || '请求失败')
        if (!options.isComputeResourceError(firstDetail)) throw new Error(firstDetail || '请求失败')
        inFlightPromise = invokeAnalysis(secondaryPayloadBuilder(options.ziweiChart.value))
        result = await inFlightPromise
        if (result && result.error) {
          var secondDetail = await getErrorDetail(result.error)
          throw new Error(secondDetail || '请求失败')
        }
      }

      var data = result ? result.data : null
      var analysis = data && data.analysis ? data.analysis : null
      if (!analysis || typeof analysis.overview !== 'string' || !Array.isArray(analysis.sections)) {
        throw new Error('AI 返回格式异常')
      }

      options.ziweiAiResult.value = analysis
      options.ziweiAiDone.value = true
      options.ziweiAiError.value = ''
      options.ziweiAiUpdatedAt.value = Date.now()
      options.ziweiLastAiSignature.value = aiSignature
      if (aiSignature) {
        analysisCache.set(aiSignature, analysis)
        if (analysisCache.size > options.cacheMax) {
          var firstKey = analysisCache.keys().next().value
          if (firstKey) analysisCache.delete(firstKey)
        }
      }
      var elapsedMs = Date.now() - startedAt
      options.ziweiAiLastDurationMs.value = elapsedMs
      if (!silent) {
        options.ziweiStatus.value = {
          type: 'success',
          text: 'AI 个性化解盘已生成（思考耗时 ' + options.formatDuration(elapsedMs) + '）。'
        }
      }
    } catch (err) {
      var msg = String((err && err.message) || err || 'AI 请求失败')
      if (options.isRateLimitError(msg)) {
        options.startCooldown(options.rateLimitCooldownMs, '您的账户已达到速率限制，请稍后再试。')
        msg = options.ziweiAiCooldownHint.value || msg
      }
      if (!options.isRateLimitError(msg)) msg = options.mapErrorMessage(msg)
      options.ziweiAiDone.value = false
      options.ziweiAiError.value = msg
      options.ziweiAiLastDurationMs.value = Date.now() - startedAt
      if (!silent) options.ziweiStatus.value = { type: 'error', text: 'AI 深度解盘失败：' + msg }
    } finally {
      options.ziweiAiLoading.value = false
      inFlightPromise = null
      inFlightSignature = ''
    }
  }

  function getInFlightSignature() {
    return inFlightSignature
  }

  return {
    submitQuestion,
    requestAnalysis,
    getInFlightSignature
  }
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_ZIWEI_AI_REQUESTS = {
    createZiweiAiRequestActions
  }
}
