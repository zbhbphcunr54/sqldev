<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'

const router = useRouter()
const auth = useAuth()
const authModal = useAuthModal()
const { open, view, loginMode, message, redirectTo } = authModal

const email = ref('')
const password = ref('')
const code = ref('')
const resetPassword = ref('')
const resetConfirm = ref('')
const resetCode = ref('')
const resetCodeSent = ref(false)
const resetCompleted = ref(false)
const busy = ref(false)
const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' })
const showPassword = ref(false)
const showResetPassword = ref(false)
const showResetConfirm = ref(false)
const firstInputRef = ref<HTMLInputElement | null>(null)

const isResetView = computed(() => view.value === 'reset')
const modalTitle = computed(() => (isResetView.value ? '重置密码' : '账号登录'))
const modalDesc = computed(() =>
  isResetView.value
    ? '输入邮箱、新密码和邮箱验证码，完成后请使用新密码重新登录。'
    : '支持密码和验证码两种登录方式，可自行切换。'
)

function setStatus(type: 'idle' | 'success' | 'error', text = ''): void {
  status.value = { type, text }
}

function localizeAuthError(error: unknown, fallback: string): string {
  const raw = String(error instanceof Error ? error.message : error || '').trim()
  const msg = raw.toLowerCase()
  if (!msg) return fallback
  if (msg.includes('invalid login credentials')) return '邮箱或密码错误'
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return '邮箱未验证，请先完成邮箱验证'
  }
  if (msg.includes('user already registered')) return '该邮箱已注册，请直接登录'
  if (msg.includes('new password should be different from the old password')) {
    return '新密码不能与旧密码相同，请换一个新密码'
  }
  if (msg.includes('password should contain at least one character of each')) {
    return '密码需同时包含大写字母、小写字母、数字和特殊字符'
  }
  if (msg.includes('password should be at least') || msg.includes('password is too short')) {
    return '密码至少 6 位'
  }
  if (msg.includes('invalid email') || msg.includes('email address')) return '邮箱格式不正确'
  if (
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('over_email_send_rate_limit')
  ) {
    return '操作过于频繁，请稍后再试'
  }
  if (
    msg.includes('invalid otp') ||
    msg.includes('otp') ||
    msg.includes('expired') ||
    msg.includes('token')
  ) {
    return '验证码无效或已过期，请重新获取'
  }
  if (
    msg.includes('networkerror') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed')
  ) {
    return '网络异常，请检查网络后重试'
  }
  return fallback
}

function resetTransientState(): void {
  password.value = ''
  code.value = ''
  resetPassword.value = ''
  resetConfirm.value = ''
  resetCode.value = ''
  resetCodeSent.value = false
  resetCompleted.value = false
  busy.value = false
  showPassword.value = false
  showResetPassword.value = false
  showResetConfirm.value = false
  setStatus('idle')
}

function closeModal(): void {
  authModal.closeModal()
  resetTransientState()
}

async function finishLogin(successText = '登录成功'): Promise<void> {
  setStatus('success', successText)
  closeModal()
  await router.push(redirectTo.value || '/workbench/ddl')
}

async function loginWithPassword(): Promise<void> {
  if (busy.value) return
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail || !password.value) {
    setStatus('error', '请输入邮箱和密码')
    return
  }
  busy.value = true
  setStatus('idle')
  try {
    await auth.signInWithPassword(normalizedEmail, password.value)
    await finishLogin('登录成功')
  } catch (error) {
    setStatus('error', localizeAuthError(error, '登录失败'))
  } finally {
    busy.value = false
  }
}

async function registerWithPassword(): Promise<void> {
  if (busy.value) return
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail || !password.value) {
    setStatus('error', '请输入邮箱和密码')
    return
  }
  busy.value = true
  setStatus('idle')
  try {
    await auth.signUpWithPassword(normalizedEmail, password.value)
    if (auth.isAuthenticated.value) {
      await finishLogin('注册成功')
      return
    }
    setStatus('success', '注册成功。若项目开启邮箱验证，请先在邮件中完成验证后再登录。')
  } catch (error) {
    setStatus('error', localizeAuthError(error, '注册失败'))
  } finally {
    busy.value = false
  }
}

async function sendLoginCode(): Promise<void> {
  if (busy.value) return
  const normalizedEmail = email.value.trim()
  if (!normalizedEmail) {
    setStatus('error', '请先输入邮箱')
    return
  }
  busy.value = true
  setStatus('idle')
  try {
    await auth.sendEmailCode(normalizedEmail)
    setStatus('success', '验证码已发送，请输入验证码后点击“验证码登录”。')
  } catch (error) {
    setStatus('error', localizeAuthError(error, '发送验证码失败'))
  } finally {
    busy.value = false
  }
}

async function loginWithCode(): Promise<void> {
  if (busy.value) return
  const normalizedEmail = email.value.trim()
  const token = code.value.trim()
  if (!normalizedEmail || !token) {
    setStatus('error', '请输入邮箱和验证码')
    return
  }
  busy.value = true
  setStatus('idle')
  try {
    await auth.verifyEmailCode(normalizedEmail, token)
    await finishLogin('登录成功')
  } catch (error) {
    setStatus('error', localizeAuthError(error, '验证码登录失败'))
  } finally {
    busy.value = false
  }
}

function enterReset(): void {
  authModal.enterReset()
  resetPassword.value = ''
  resetConfirm.value = ''
  resetCode.value = ''
  resetCodeSent.value = false
  resetCompleted.value = false
  setStatus('success', message.value || '请先输入新密码，然后发送验证码。')
}

function validateResetForm(): { normalizedEmail: string; nextPassword: string } | null {
  const normalizedEmail = email.value.trim()
  const nextPassword = resetPassword.value.trim()
  const confirmPassword = resetConfirm.value.trim()
  if (!normalizedEmail) {
    setStatus('error', '请先输入邮箱')
    return null
  }
  if (!nextPassword) {
    setStatus('error', '请输入新密码')
    return null
  }
  if (nextPassword.length < 6) {
    setStatus('error', '密码至少 6 位')
    return null
  }
  if (nextPassword !== confirmPassword) {
    setStatus('error', '两次输入的新密码不一致')
    return null
  }
  return { normalizedEmail, nextPassword }
}

async function sendResetCode(): Promise<void> {
  if (busy.value) return
  const resetInfo = validateResetForm()
  if (!resetInfo) return
  busy.value = true
  setStatus('idle')
  try {
    await auth.sendEmailCode(resetInfo.normalizedEmail)
    resetCodeSent.value = true
    setStatus('success', '验证码已发送，请查收邮箱后输入验证码。')
  } catch (error) {
    setStatus('error', localizeAuthError(error, '发送验证码失败'))
  } finally {
    busy.value = false
  }
}

async function submitResetPassword(): Promise<void> {
  if (busy.value || resetCompleted.value) return
  const resetInfo = validateResetForm()
  const token = resetCode.value.trim()
  if (!resetInfo) return
  if (!token) {
    setStatus('error', '请输入验证码')
    return
  }
  busy.value = true
  setStatus('idle')
  try {
    await auth.resetPasswordWithCode(resetInfo.normalizedEmail, token, resetInfo.nextPassword)
    resetCompleted.value = true
    resetCodeSent.value = false
    setStatus('success', '重置密码成功，请点击“重新登录”返回登录弹框。')
  } catch (error) {
    setStatus('error', localizeAuthError(error, '重置密码失败'))
  } finally {
    busy.value = false
  }
}

function exitReset(): void {
  authModal.exitReset(resetCompleted.value ? '请使用新密码重新登录。' : '')
  resetCompleted.value = false
  resetCodeSent.value = false
  resetPassword.value = ''
  resetConfirm.value = ''
  resetCode.value = ''
  setStatus(message.value ? 'success' : 'idle', message.value)
}

function onMaskClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) closeModal()
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  setStatus(message.value ? 'success' : 'idle', message.value)
  await nextTick()
  firstInputRef.value?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="auth-modal-mask" @click="onMaskClick" @keydown.esc="closeModal">
      <div
        class="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
      >
        <div class="auth-modal-head">
          <h3 id="auth-modal-title">{{ modalTitle }}</h3>
          <button class="auth-close" type="button" aria-label="关闭" @click="closeModal">
            &times;
          </button>
        </div>
        <p id="auth-modal-desc" class="auth-modal-desc">{{ modalDesc }}</p>

        <div v-if="!isResetView" class="auth-mode-switch" role="tablist" aria-label="登录方式">
          <button
            class="auth-mode-btn"
            :class="{ active: loginMode === 'password' }"
            type="button"
            role="tab"
            :aria-selected="loginMode === 'password'"
            @click="authModal.setLoginMode('password')"
          >
            密码登录
          </button>
          <button
            class="auth-mode-btn"
            :class="{ active: loginMode === 'code' }"
            type="button"
            role="tab"
            :aria-selected="loginMode === 'code'"
            @click="authModal.setLoginMode('code')"
          >
            验证码登录
          </button>
        </div>

        <form
          v-if="!isResetView && loginMode === 'password'"
          class="auth-form"
          autocomplete="on"
          @submit.prevent="loginWithPassword"
        >
          <label class="auth-label" for="auth-email-password">邮箱</label>
          <input
            id="auth-email-password"
            ref="firstInputRef"
            v-model="email"
            class="auth-input"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            required
          />
          <label class="auth-label" for="auth-password">密码</label>
          <div class="auth-password-field">
            <input
              id="auth-password"
              v-model="password"
              class="auth-input auth-input-password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="至少 6 位"
              required
            />
            <button
              class="auth-password-toggle"
              :class="{ active: showPassword }"
              type="button"
              aria-label="显示或隐藏密码"
              @click="showPassword = !showPassword"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="auth-password-toggle-slash" aria-hidden="true"></span>
            </button>
          </div>
          <div class="auth-inline-actions">
            <button class="auth-text-btn" type="button" @click="enterReset">忘记密码？</button>
          </div>
          <p
            v-if="status.text"
            class="auth-status"
            :class="{ error: status.type === 'error' }"
            aria-live="polite"
          >
            {{ status.text }}
          </p>
          <div class="auth-actions">
            <button class="auth-btn" type="button" :disabled="busy" @click="registerWithPassword">
              密码注册
            </button>
            <button class="auth-btn primary" type="submit" :disabled="busy">
              {{ busy ? '登录中...' : '密码登录' }}
            </button>
          </div>
        </form>

        <form
          v-else-if="!isResetView"
          class="auth-form"
          autocomplete="on"
          @submit.prevent="loginWithCode"
        >
          <label class="auth-label" for="auth-email-code">邮箱</label>
          <input
            id="auth-email-code"
            ref="firstInputRef"
            v-model="email"
            class="auth-input"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            required
          />
          <label class="auth-label" for="auth-code">验证码</label>
          <input
            id="auth-code"
            v-model="code"
            class="auth-input"
            name="otp"
            type="text"
            autocomplete="one-time-code"
            inputmode="numeric"
            placeholder="请输入邮箱收到的验证码"
            required
          />
          <p
            v-if="status.text"
            class="auth-status"
            :class="{ error: status.type === 'error' }"
            aria-live="polite"
          >
            {{ status.text }}
          </p>
          <div class="auth-actions">
            <button class="auth-btn" type="button" :disabled="busy" @click="sendLoginCode">
              {{ busy ? '发送中...' : '发送验证码' }}
            </button>
            <button class="auth-btn primary" type="submit" :disabled="busy">
              {{ busy ? '登录中...' : '验证码登录' }}
            </button>
          </div>
        </form>

        <form v-else class="auth-form" autocomplete="on" @submit.prevent="submitResetPassword">
          <label class="auth-label" for="auth-email-reset">邮箱</label>
          <input
            id="auth-email-reset"
            ref="firstInputRef"
            v-model="email"
            class="auth-input"
            name="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            :readonly="resetCompleted"
            required
          />
          <label class="auth-label" for="auth-reset-password">新密码</label>
          <div class="auth-password-field">
            <input
              id="auth-reset-password"
              v-model="resetPassword"
              class="auth-input auth-input-password"
              name="new-password"
              :type="showResetPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请输入新密码"
              required
              :readonly="resetCompleted"
            />
            <button
              class="auth-password-toggle"
              :class="{ active: showResetPassword }"
              type="button"
              aria-label="显示或隐藏新密码"
              @click="showResetPassword = !showResetPassword"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="auth-password-toggle-slash" aria-hidden="true"></span>
            </button>
          </div>
          <label class="auth-label" for="auth-reset-confirm">确认新密码</label>
          <div class="auth-password-field">
            <input
              id="auth-reset-confirm"
              v-model="resetConfirm"
              class="auth-input auth-input-password"
              name="confirm-password"
              :type="showResetConfirm ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请再次输入新密码"
              required
              :readonly="resetCompleted"
            />
            <button
              class="auth-password-toggle"
              :class="{ active: showResetConfirm }"
              type="button"
              aria-label="显示或隐藏确认密码"
              @click="showResetConfirm = !showResetConfirm"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="auth-password-toggle-slash" aria-hidden="true"></span>
            </button>
          </div>
          <p class="auth-input-hint">密码需同时包含大写字母、小写字母、数字和特殊字符</p>
          <label class="auth-label" for="auth-reset-code">验证码</label>
          <input
            id="auth-reset-code"
            v-model="resetCode"
            class="auth-input"
            name="otp"
            type="text"
            autocomplete="one-time-code"
            inputmode="numeric"
            placeholder="请输入邮箱收到的验证码"
            required
            :readonly="resetCompleted"
          />
          <p
            v-if="status.text"
            class="auth-status"
            :class="{ error: status.type === 'error' }"
            aria-live="polite"
          >
            {{ status.text }}
          </p>
          <div class="auth-actions auth-reset-actions">
            <button
              class="auth-btn"
              type="button"
              :disabled="busy || resetCompleted"
              @click="sendResetCode"
            >
              {{ resetCodeSent ? '重新发送验证码' : '发送验证码' }}
            </button>
            <button class="auth-btn primary" type="submit" :disabled="busy || resetCompleted">
              {{ busy ? '重置中...' : '确定重置' }}
            </button>
          </div>
          <div class="auth-inline-actions auth-reset-footer">
            <button class="auth-text-btn" type="button" @click="exitReset">
              {{ resetCompleted ? '重新登录' : '返回登录' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.auth-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(2, 6, 23, 0.58);
  backdrop-filter: blur(4px);
}

.auth-modal {
  width: min(420px, 96vw);
  padding: 16px 16px 14px;
  text-align: left;
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(8, 14, 27, 0.95) 100%);
  box-shadow: 0 14px 40px rgba(2, 6, 23, 0.45);
}

.auth-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.auth-modal-head h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 16px;
}

.auth-close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  color: #94a3b8;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.auth-close:hover {
  color: #e2e8f0;
  background: rgba(148, 163, 184, 0.12);
}

.auth-modal-desc {
  margin: 0 0 10px;
  color: #94a3b8;
  font-size: 12px;
}

.auth-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.auth-mode-btn,
.auth-btn {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 8px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.7);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}

.auth-mode-btn {
  padding: 7px 10px;
  font-size: 12px;
}

.auth-mode-btn:hover,
.auth-btn:hover {
  border-color: #60a5fa;
  color: #e2e8f0;
  background: rgba(30, 41, 59, 0.8);
}

.auth-mode-btn.active,
.auth-btn.primary {
  border-color: #2563eb;
  color: #fff;
  background: #2563eb;
}

.auth-btn.primary:hover {
  background: #1d4ed8;
}

.auth-form {
  display: block;
}

.auth-label {
  display: block;
  margin: 8px 0 5px;
  color: #cbd5e1;
  font-size: 12px;
}

.auth-input {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.78);
  font-size: 13px;
}

.auth-input-password {
  padding-right: 40px;
}

.auth-input::placeholder {
  color: #64748b;
}

.auth-input:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.24);
}

.auth-input[type='password']::-ms-reveal,
.auth-input[type='password']::-ms-clear {
  display: none;
}

.auth-password-field {
  position: relative;
}

.auth-password-toggle {
  position: absolute;
  top: 50%;
  right: 10px;
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  color: #94a3b8;
  background: none;
  cursor: pointer;
  transform: translateY(-50%);
}

.auth-password-toggle:hover {
  color: #e2e8f0;
}

.auth-password-toggle svg {
  width: 18px;
  height: 18px;
}

.auth-password-toggle-slash {
  position: absolute;
  width: 18px;
  height: 1.6px;
  background: currentColor;
  transform: rotate(-35deg) scaleX(0);
  transition: transform 0.15s ease;
}

.auth-password-toggle.active .auth-password-toggle-slash {
  transform: rotate(-35deg) scaleX(1);
}

.auth-input-hint,
.auth-status {
  font-size: 12px;
}

.auth-input-hint {
  margin: 5px 0 0;
  color: #94a3b8;
  line-height: 1.5;
}

.auth-status {
  min-height: 18px;
  margin: 8px 0 0;
  color: #67e8f9;
}

.auth-status.error {
  color: #fca5a5;
}

.auth-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.auth-btn {
  flex: 1;
  padding: 8px 10px;
}

.auth-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.auth-inline-actions {
  margin-top: 6px;
  text-align: right;
}

.auth-text-btn {
  border: 0;
  color: #93c5fd;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}

.auth-text-btn:hover {
  color: #bfdbfe;
  text-decoration: underline;
}

[data-theme='light'] .auth-modal-mask {
  background: rgba(15, 23, 42, 0.24);
}

[data-theme='light'] .auth-modal {
  border-color: rgba(37, 99, 235, 0.22);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.96));
  box-shadow: 0 18px 54px rgba(15, 23, 42, 0.18);
}

[data-theme='light'] .auth-modal-head h3 {
  color: #0f172a;
}

[data-theme='light'] .auth-modal-desc,
[data-theme='light'] .auth-input-hint {
  color: #64748b;
}

[data-theme='light'] .auth-mode-btn,
[data-theme='light'] .auth-btn,
[data-theme='light'] .auth-input {
  border-color: rgba(148, 163, 184, 0.42);
  color: #0f172a;
  background: rgba(255, 255, 255, 0.86);
}

[data-theme='light'] .auth-mode-btn:hover,
[data-theme='light'] .auth-btn:hover {
  border-color: #2563eb;
  background: #eff6ff;
}

[data-theme='light'] .auth-mode-btn.active,
[data-theme='light'] .auth-btn.primary {
  color: #fff;
  background: #2563eb;
}

[data-theme='light'] .auth-label {
  color: #334155;
}

[data-theme='light'] .auth-status {
  color: #0369a1;
}

[data-theme='light'] .auth-status.error {
  color: #b91c1c;
}
</style>
