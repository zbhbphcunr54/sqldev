/* Public client config: URL + anon key are expected to be public in browser apps.
   Never put service-role or secret keys in frontend code. */
(function () {
  var fallbackUrl = 'https://ydlvispjdcffqvqhwhuk.supabase.co';
  var fallbackAnonKey = 'sb_publishable_0AaPGEhFpc4xrAMQesgdbQ_yrQQkE6N';

  var runtimeUrl = window.__SQDEV_SUPABASE_URL || '';
  var runtimeAnonKey = window.__SQDEV_SUPABASE_ANON_KEY || '';
  var runtimeZiweiAllowedEmails = window.__SQDEV_ZIWEI_ALLOWED_EMAILS || '';

  var url = window.SUPABASE_URL || runtimeUrl || fallbackUrl;
  var anonKey = window.SUPABASE_ANON_KEY || runtimeAnonKey || fallbackAnonKey;
  // Configure ZiWei access by email (comma-separated string or array).
  // Example:
  //   window.SQDEV_ZIWEI_ALLOWED_EMAILS = 'alice@example.com,bob@example.com'
  var ziweiAllowedEmails = window.SQDEV_ZIWEI_ALLOWED_EMAILS || runtimeZiweiAllowedEmails || '';

  var keyLower = String(anonKey || '').toLowerCase();
  if (keyLower.indexOf('service_role') >= 0 || keyLower.indexOf('sb_secret_') >= 0) {
    console.error('[supabase-config] Refused to expose a privileged Supabase key in the browser.');
    anonKey = '';
  }

  window.SUPABASE_URL = url;
  window.SUPABASE_ANON_KEY = anonKey;
  window.SQDEV_ZIWEI_ALLOWED_EMAILS = ziweiAllowedEmails;
  window.SUPABASE_CONFIG_SOURCE = (runtimeUrl || runtimeAnonKey) ? 'runtime' : 'fallback';
})();
