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
    } catch (_err) {}
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
      try { lastTrigger.focus(); } catch (_err) {}
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

  function persistLocalFeedback(payload, reason) {
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(FEEDBACK_QUEUE_KEY) || '[]');
      if (!Array.isArray(list)) list = [];
    } catch (_e) {
      list = [];
    }
    list.unshift({
      payload: payload,
      reason: String(reason || ''),
      savedAt: new Date().toISOString()
    });
    if (list.length > 30) list = list.slice(0, 30);
    try {
      localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(list));
    } catch (_err) {}
  }

  async function postFeedback(payload) {
    var authApi = window.authApi;
    if (authApi && typeof authApi.invokeFunction === 'function' && typeof authApi.getUserSync === 'function') {
      var user = authApi.getUserSync();
      if (user) {
        var authRes = await authApi.invokeFunction('feedback', payload);
        if (authRes && !authRes.error && authRes.data && authRes.data.ok) return { channel: 'auth-function' };
      }
    }
    var endpoint = getFeedbackEndpoint();
    if (!endpoint) throw new Error('FEEDBACK_ENDPOINT_UNAVAILABLE');
    var headers = { 'Content-Type': 'application/json' };
    if (window.SUPABASE_ANON_KEY) headers.apikey = window.SUPABASE_ANON_KEY;
    var accessToken = '';
    try {
      if (authApi && typeof authApi.getAccessToken === 'function') {
        accessToken = authApi.getAccessToken() || '';
      }
    } catch (_err) {}
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      credentials: 'omit'
    });
    if (!res.ok) {
      var bodyText = '';
      try { bodyText = await res.text(); } catch (_err2) {}
      throw new Error(bodyText || ('HTTP_' + res.status));
    }
    var data = null;
    try { data = await res.json(); } catch (_err3) {}
    if (!data || data.ok !== true) {
      throw new Error('ONLINE_SUBMIT_REJECTED');
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
    } catch (_err) {}
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
      setStatus('建议已提交，感谢你的反馈。', false);
      showToast('反馈已提交');
      setTimeout(function () { closeModal(); }, 520);
    } catch (err) {
      persistLocalFeedback(payload, err && err.message ? err.message : err);
      setStatus('在线提交失败，已自动保存到本地草稿。请稍后重试。', true);
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
