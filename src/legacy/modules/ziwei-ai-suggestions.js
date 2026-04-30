function isLikelyMojibakeZh(text) {
  if (
    window.SQLDEV_ZIWEI_PRESENTATION_UTILS &&
    typeof window.SQLDEV_ZIWEI_PRESENTATION_UTILS.isLikelyMojibakeZh === 'function'
  ) {
    return window.SQLDEV_ZIWEI_PRESENTATION_UTILS.isLikelyMojibakeZh(text)
  }
  var t = String(text || '')
  if (!t) return false
  var hit = (t.match(/[閿涢妴閸欓梻鐠囬幋娴犻惃閹琞]/g) || []).length
  return hit >= 2
}

function normalizeZiweiQaSuggestionText(text) {
  if (
    window.SQLDEV_ZIWEI_PRESENTATION_UTILS &&
    typeof window.SQLDEV_ZIWEI_PRESENTATION_UTILS.normalizeZiweiQaSuggestionText === 'function'
  ) {
    return window.SQLDEV_ZIWEI_PRESENTATION_UTILS.normalizeZiweiQaSuggestionText(text)
  }
  var t = String(text || '').trim()
  if (!t) return ''
  return t.replace(/身体[^与和及、，,\s/-]{1,2}健康/g, '身体与健康')
}

export function createZiweiAiSuggestionActions(options) {
  function updateLayout() {
    var wrapEl = options.ziweiAiQaInputWrapRef.value
    if (!wrapEl || typeof wrapEl.getBoundingClientRect !== 'function') return
    var wrapRect = wrapEl.getBoundingClientRect()
    var viewportH = Number(window.innerHeight || document.documentElement.clientHeight || 0)
    if (!Number.isFinite(viewportH) || viewportH <= 0) viewportH = 800

    var spaceBelow = Math.max(0, viewportH - wrapRect.bottom - 12)
    var spaceAbove = Math.max(0, wrapRect.top - 12)
    var shouldOpenUp = spaceBelow < 260 && spaceAbove > spaceBelow
    options.ziweiAiSuggestionPlacement.value = shouldOpenUp ? 'up' : 'down'
    var available = shouldOpenUp ? spaceAbove : spaceBelow
    var itemCount = Array.isArray(options.ziweiAiSuggestionsFiltered.value)
      ? options.ziweiAiSuggestionsFiltered.value.length
      : 0
    var desired = Math.max(1, Math.min(itemCount, 10)) * 40 + 10
    var nextHeight = Math.floor(Math.min(available, desired))
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) nextHeight = desired
    options.ziweiAiSuggestionMaxHeight.value = Math.max(140, Math.min(560, nextHeight))
  }

  function scheduleLayout() {
    options.nextTick(function () {
      window.requestAnimationFrame(updateLayout)
    })
  }

  function openSuggestions() {
    options.ziweiAiSuggestionOpen.value = true
    scheduleLayout()
  }

  function pickSuggestion(value) {
    var text = ''
    if (value && typeof value === 'object') {
      text = String(value.text || value.label || '').trim()
    } else {
      text = String(value || '').trim()
    }
    if (!text) return
    options.ziweiAiQuestionInput.value = text
    options.ziweiAiSuggestionOpen.value = false
  }

  async function loadServerConfig() {
    if (!window.authApi || typeof window.authApi.invokeFunction !== 'function') return
    if (typeof window.authApi.getUserSync === 'function' && !window.authApi.getUserSync()) return
    try {
      var result = await window.authApi.invokeFunction('ziwei-analysis', {
        mode: 'config'
      })
      if (result && result.error) return
      var data = result ? result.data : null
      var cfg = data && data.config && typeof data.config === 'object' ? data.config : null
      if (!cfg) return

      if (Array.isArray(cfg.suggestions)) {
        var suggestions = cfg.suggestions
          .map(function (item) {
            return normalizeZiweiQaSuggestionText(item)
          })
          .filter(function (item) {
            return !isLikelyMojibakeZh(item)
          })
          .filter(Boolean)
          .slice(0, 12)
        options.ziweiAiQaSuggestions.value = suggestions
      }
    } catch (err) {
      console.warn('[SQLDev] Ziwei AI config load failed', err)
    }
  }

  return {
    updateLayout,
    scheduleLayout,
    openSuggestions,
    pickSuggestion,
    loadServerConfig
  }
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_ZIWEI_AI_SUGGESTIONS = {
    createZiweiAiSuggestionActions
  }
}
