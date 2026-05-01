(function () {
  var modalMask = document.getElementById('feedback-modal-mask');
  var feedbackFab = document.getElementById('feedback-fab');
  var feedbackForm = document.getElementById('feedback-form');
  var feedbackCategory = document.getElementById('feedback-category');
  var feedbackContent = document.getElementById('feedback-content');
  var feedbackContact = document.getElementById('feedback-contact');
  var feedbackCount = document.getElementById('feedback-count');
  var feedbackStatus = document.getElementById('feedback-status');
  var feedbackSubmitBtn = document.getElementById('feedback-submit-btn');
  var feedbackCancelBtn = document.getElementById('feedback-cancel-btn');
  var feedbackCloseBtn = document.getElementById('feedback-close-btn');
  var FEEDBACK_QUEUE_KEY = 'sqldev_feedback_queue';
  var lastTrigger = null;
  var lastSource = 'unknown';
  var isSubmitting = false;

  if (!modalMask || !feedbackForm || !feedbackContent) return;

  function logFeedbackWarning(stage, err) {
    try {
      console.warn('[feedback] ' + stage, err);
    } catch (_consoleErr) {}
  }

  function getCurrentScene() {
    if (document.body.classList.contains('splash-active')) return 'splash';
    return 'workbench';
  }

  function setStatus(text, isError) {
    if (!feedbackStatus) return;
    feedbackStatus.textContent = text || '';
    feedbackStatus.classList.toggle('error', !!isError);
    feedbackStatus.classList.toggle('success', !!text && !isError);
  }

  function updateCount() {
    if (!feedbackCount || !feedbackContent) return;
    feedbackCount.textContent = String((feedbackContent.value || '').length);
  }

  function getFeedbackEndpoint() {
    if (window.SQDEV_FEEDBACK_ENDPOINT) return String(window.SQDEV_FEEDBACK_ENDPOINT);
    if (!window.SUPABASE_URL) return '';
    return String(window.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/feedback';
  }

  function setBusy(busy) {
    isSubmitting = !!busy;
    if (feedbackSubmitBtn) feedbackSubmitBtn.disabled = !!busy;
    if (feedbackCancelBtn) feedbackCancelBtn.disabled = !!busy;
    if (feedbackCloseBtn) feedbackCloseBtn.disabled = !!busy;
  }

  function openModal(source) {
    lastSource = source || 'manual';
    lastTrigger = document.activeElement;
    modalMask.hidden = false;
    document.body.classList.add('feedback-open');
    setStatus('', false);
    updateCount();
    try {
      var authApi = window.authApi;
      if (authApi && typeof authApi.getUserSync === 'function') {
        var user = authApi.getUserSync();
        if (user && user.email && feedbackContact && !feedbackContact.value.trim()) {
          feedbackContact.value = user.email;
        }
      }
    } catch (err) {
      logFeedbackWarning('prefill contact failed', err);
    }
    window.requestAnimationFrame(function () {
      if (feedbackContent) feedbackContent.focus();
    });
  }

  function closeModal() {
    if (isSubmitting) return;
    modalMask.hidden = true;
    document.body.classList.remove('feedback-open');
    setStatus('', false);
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      try { lastTrigger.focus(); } catch (err) { logFeedbackWarning('restore focus failed', err); }
    }
  }

  function showToast(text) {
    if (!text) return;
    var node = document.createElement('div');
    node.className = 'feedback-toast';
    node.textContent = text;
    document.body.appendChild(node);
    window.requestAnimationFrame(function () { node.classList.add('show'); });
    setTimeout(function () {
      node.classList.remove('show');
      setTimeout(function () {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }, 1800);
  }

  function showSuccessOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'feedback-success-overlay';
    var box = document.createElement('div');
    box.className = 'feedback-success-box';
    var icon = document.createElement('div');
    icon.className = 'feedback-success-icon';
    icon.innerHTML = '<svg viewBox="0 0 48 48" fill="none" width="48" height="48"><circle cx="24" cy="24" r="22" stroke="#22c55e" stroke-width="3"/><path d="M14 24l7 7 13-13" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var title = document.createElement('div');
    title.className = 'feedback-success-title';
    title.textContent = '提交成功';
    var desc = document.createElement('div');
    desc.className = 'feedback-success-desc';
    desc.textContent = '感谢你的反馈，我们会持续优化产品。';
    var btn = document.createElement('button');
    btn.className = 'feedback-success-btn';
    btn.type = 'button';
    btn.textContent = '确定';
    btn.addEventListener('click', function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      closeModal();
    });
    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(btn);
    overlay.appendChild(box);
    var modal = modalMask.querySelector('.feedback-modal');
    if (modal) {
      modal.appendChild(overlay);
    } else {
      modalMask.appendChild(overlay);
    }
    window.requestAnimationFrame(function () { overlay.classList.add('show'); });
  }

  function persistLocalFeedback(payload, reason) {
    var safePayload = {
      category: payload && payload.category ? String(payload.category) : 'other',
      content: payload && payload.content ? String(payload.content) : '',
      source: payload && payload.source ? String(payload.source) : 'unknown',
      scene: payload && payload.scene ? String(payload.scene) : getCurrentScene()
    };
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(FEEDBACK_QUEUE_KEY) || '[]');
      if (!Array.isArray(list)) list = [];
    } catch (err) {
      logFeedbackWarning('read local draft queue failed', err);
      list = [];
    }
    list.unshift({
      payload: safePayload,
      reason: String(reason || ''),
      savedAt: new Date().toISOString()
    });
    if (list.length > 30) list = list.slice(0, 30);
    try {
      localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(list));
    } catch (err) {
      logFeedbackWarning('persist local draft queue failed', err);
    }
  }

  function toErrorText(err) {
    return String((err && err.message) ? err.message : (err || '')).trim();
  }

  function buildFriendlyErrorMessage(err) {
    var msg = toErrorText(err).toLowerCase();
    var origin = String(window.location.origin || '').toLowerCase();
    var isLocalOrigin = origin.indexOf('127.0.0.1') >= 0 || origin.indexOf('localhost') >= 0;
    if (!msg) return '在线提交失败';
    if (msg.indexOf('feedback_timeout') >= 0 || msg.indexOf('aborted') >= 0) return '提交超时，请稍后重试';
    if (msg.indexOf('feedback_backend_not_configured') >= 0) return '反馈后端未配置';
    if (msg.indexOf('storage_insert_failed') >= 0) return '反馈数据写入失败（请检查 feedback_entries 表）';
    if (msg.indexOf('content_too_short') >= 0) return '建议内容过短';
    if (msg.indexOf('rate_limited') >= 0) return '提交过于频繁，请稍后再试';
    if (msg.indexOf('403') >= 0 || msg.indexOf('forbidden') >= 0) return '当前域名未被反馈接口允许（CORS）';
    if (msg.indexOf('404') >= 0 || msg.indexOf('not found') >= 0) return '反馈接口未部署（feedback）';
    if (msg.indexOf('failed to fetch') >= 0 || msg.indexOf('networkerror') >= 0 || msg.indexOf('fetch failed') >= 0) {
      if (isLocalOrigin) return '本地访问被拦截（CORS）。请开启 ALLOW_LOCALHOST_ORIGIN=1 并重新部署 feedback 函数';
      return '网络连接失败（可能是网络、代理或跨域策略问题）';
    }
    return '在线提交失败';
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    var controller = null;
    var timer = null;
    try {
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        options = Object.assign({}, options, { signal: controller.signal });
        timer = setTimeout(function () {
          try { controller.abort(); } catch (err) { logFeedbackWarning('abort timeout request failed', err); }
        }, timeoutMs);
      }
      return await fetch(url, options);
    } catch (err) {
      var msg = toErrorText(err).toLowerCase();
      if (msg.indexOf('abort') >= 0) throw new Error('FEEDBACK_TIMEOUT');
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function postFeedback(payload) {
    var authApi = window.authApi;
    var endpoint = getFeedbackEndpoint();
    if (!endpoint) throw new Error('FEEDBACK_ENDPOINT_UNAVAILABLE');
    var headers = { 'Content-Type': 'application/json' };
    if (window.SUPABASE_ANON_KEY) headers.apikey = window.SUPABASE_ANON_KEY;
    var accessToken = '';
    try {
      if (authApi && typeof authApi.getAccessToken === 'function') {
        accessToken = authApi.getAccessToken() || '';
      }
    } catch (err) {
      logFeedbackWarning('read access token failed', err);
    }
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    var timeoutMs = Number(window.SQDEV_FEEDBACK_TIMEOUT_MS) || 6500;
    var res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      credentials: 'omit'
    }, timeoutMs);
    if (!res.ok) {
      var bodyText = '';
      try { bodyText = await res.text(); } catch (err) { logFeedbackWarning('read error response failed', err); }
      throw new Error(bodyText || ('HTTP_' + res.status));
    }
    var data = null;
    try { data = await res.json(); } catch (err) { logFeedbackWarning('parse success response failed', err); }
    if (!data || data.ok !== true) {
      var rejected = 'ONLINE_SUBMIT_REJECTED';
      try { rejected = JSON.stringify(data); } catch (err) { logFeedbackWarning('serialize rejected response failed', err); }
      throw new Error(rejected);
    }
    return { channel: 'direct-endpoint' };
  }

  function buildPayload() {
    var content = (feedbackContent.value || '').trim();
    var contact = feedbackContact ? (feedbackContact.value || '').trim() : '';
    var category = feedbackCategory ? feedbackCategory.value : 'feature';
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    var authUser = null;
    try {
      if (window.authApi && typeof window.authApi.getUserSync === 'function') {
        authUser = window.authApi.getUserSync();
      }
    } catch (err) {
      logFeedbackWarning('read auth user failed', err);
    }
    return {
      category: category,
      content: content,
      contact: contact,
      source: lastSource,
      scene: getCurrentScene(),
      theme: theme,
      page: window.location.pathname + window.location.search,
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: authUser && authUser.id ? authUser.id : null,
      userEmail: authUser && authUser.email ? authUser.email : null
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;
    var content = (feedbackContent.value || '').trim();
    if (content.length < 6) {
      setStatus('建议内容至少 6 个字，请补充具体场景。', true);
      return;
    }
    var payload = buildPayload();
    setBusy(true);
    setStatus('正在提交...', false);
    try {
      await postFeedback(payload);
      feedbackForm.reset();
      updateCount();
      setStatus('', false);
      showSuccessOverlay();
    } catch (err) {
      var reason = toErrorText(err);
      persistLocalFeedback(payload, reason);
      setStatus(buildFriendlyErrorMessage(err) + '；已自动保存到本地草稿。', true);
      try { console.error('[feedback] submit failed:', reason); } catch (_err5) {}
      showToast('已保存到本地草稿');
    } finally {
      setBusy(false);
    }
  }

  if (feedbackForm) feedbackForm.addEventListener('submit', onSubmit);
  if (feedbackContent) feedbackContent.addEventListener('input', updateCount);
  if (feedbackFab) {
    feedbackFab.addEventListener('click', function () {
      openModal('floating-fab');
    });
  }
  if (feedbackCloseBtn) feedbackCloseBtn.addEventListener('click', closeModal);
  if (feedbackCancelBtn) feedbackCancelBtn.addEventListener('click', closeModal);
  modalMask.addEventListener('click', function (e) {
    if (e.target === modalMask) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalMask.hidden) closeModal();
  });

  window.openFeedbackModal = openModal;
})();
