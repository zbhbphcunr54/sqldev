function normalizeRuntimeValue(value) {
  var out = String(value || '').trim();
  // Keep compatibility when a static placeholder is not replaced.
  if (/^%VITE_[A-Z0-9_]+%$/.test(out)) return '';
  return out;
}

var runtimeUrl = normalizeRuntimeValue(import.meta.env.VITE_SUPABASE_URL || '');
var runtimeAnonKey = normalizeRuntimeValue(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
var runtimeZiweiAllowedEmails = normalizeRuntimeValue(import.meta.env.VITE_ZIWEI_ALLOWED_EMAILS || '');

var url = normalizeRuntimeValue(window.SUPABASE_URL || runtimeUrl);
var anonKey = normalizeRuntimeValue(window.SUPABASE_ANON_KEY || runtimeAnonKey);
var ziweiAllowedEmails = window.SQDEV_ZIWEI_ALLOWED_EMAILS || runtimeZiweiAllowedEmails || '';

var keyLower = String(anonKey || '').toLowerCase();
if (keyLower.indexOf('service_role') >= 0 || keyLower.indexOf('sb_secret_') >= 0) {
  console.error('[runtime-config] Refused to expose a privileged Supabase key in the browser.');
  anonKey = '';
}

if (!url || !anonKey) {
  console.error(
    '[runtime-config] Missing public Supabase runtime config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

window.__SQDEV_SUPABASE_URL = url;
window.__SQDEV_SUPABASE_ANON_KEY = anonKey;
window.__SQDEV_ZIWEI_ALLOWED_EMAILS = ziweiAllowedEmails;
window.SUPABASE_URL = url;
window.SUPABASE_ANON_KEY = anonKey;
window.SQDEV_ZIWEI_ALLOWED_EMAILS = ziweiAllowedEmails;
window.SUPABASE_CONFIG_SOURCE = (runtimeUrl || runtimeAnonKey) ? 'runtime' : 'missing';
