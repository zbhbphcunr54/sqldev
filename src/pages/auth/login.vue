<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatePanel from '@/components/common/StatePanel.vue'
import { useAuth } from '@/composables/useAuth'
import { sanitizeInternalRedirectPath } from '@/features/navigation/redirect'
import { mapErrorCodeToMessage } from '@/utils/error-map'

type AuthTab = 'password' | 'otp' | 'reset'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const tab = ref<AuthTab>('password')
const email = ref('')
const password = ref('')
const loading = ref(false)
const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' })

const redirectPath = computed(() => sanitizeInternalRedirectPath(route.query.redirect))

function setStatus(type: 'success' | 'error', text: string) {
  status.value = { type, text }
}

async function loginWithPassword() {
  loading.value = true
  status.value = { type: 'idle', text: '' }
  try {
    await auth.signInWithPassword(email.value.trim(), password.value)
  } catch {
    loading.value = false
    setStatus('error', mapErrorCodeToMessage('auth_password_failed'))
    return
  }
  loading.value = false
  await router.push(redirectPath.value)
}

async function loginWithOtp() {
  loading.value = true
  status.value = { type: 'idle', text: '' }
  try {
    await auth.signInWithOtp(email.value.trim())
  } catch {
    loading.value = false
    setStatus('error', mapErrorCodeToMessage('auth_otp_failed'))
    return
  }
  loading.value = false
  setStatus('success', mapErrorCodeToMessage('auth_otp_sent'))
}

async function resetPassword() {
  loading.value = true
  status.value = { type: 'idle', text: '' }
  try {
    await auth.resetPasswordByEmail(email.value.trim())
  } catch {
    loading.value = false
    setStatus('error', mapErrorCodeToMessage('auth_reset_failed'))
    return
  }
  loading.value = false
  setStatus('success', mapErrorCodeToMessage('auth_reset_sent'))
}
</script>

<template>
  <section class="mx-auto max-w-[420px] py-12">
    <StatePanel
      type="empty"
      title="账号登录"
      description="登录后可使用 SQL 转换、反馈与紫微 AI 功能。"
    >
      <div class="mt-4 rounded-card border border-border bg-panel p-4">
        <div class="grid grid-cols-3 gap-2">
          <button
            class="btn-secondary px-2 py-2 text-xs"
            :class="{ 'btn-primary': tab === 'password' }"
            @click="tab = 'password'"
          >
            密码登录
          </button>
          <button
            class="btn-secondary px-2 py-2 text-xs"
            :class="{ 'btn-primary': tab === 'otp' }"
            @click="tab = 'otp'"
          >
            验证码登录
          </button>
          <button
            class="btn-secondary px-2 py-2 text-xs"
            :class="{ 'btn-primary': tab === 'reset' }"
            @click="tab = 'reset'"
          >
            重置密码
          </button>
        </div>

        <form class="mt-4 space-y-3" @submit.prevent>
          <label class="block text-xs text-subtle" for="auth-email">邮箱</label>
          <input
            id="auth-email"
            v-model="email"
            type="email"
            class="input-control w-full"
            autocomplete="email"
          />

          <template v-if="tab === 'password'">
            <label class="block text-xs text-subtle" for="auth-password">密码</label>
            <input
              id="auth-password"
              v-model="password"
              type="password"
              class="input-control w-full"
              autocomplete="current-password"
            />
          </template>

          <p
            v-if="status.text"
            class="text-xs"
            :class="
              status.type === 'success'
                ? 'text-success'
                : status.type === 'error'
                  ? 'text-danger'
                  : 'text-subtle'
            "
          >
            {{ status.text }}
          </p>

          <button
            v-if="tab === 'password'"
            class="btn-primary w-full py-2.5 text-sm"
            :disabled="loading"
            @click="loginWithPassword"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>
          <button
            v-else-if="tab === 'otp'"
            class="btn-primary w-full py-2.5 text-sm"
            :disabled="loading"
            @click="loginWithOtp"
          >
            {{ loading ? '发送中...' : '发送验证码' }}
          </button>
          <button
            v-else
            class="btn-primary w-full py-2.5 text-sm"
            :disabled="loading"
            @click="resetPassword"
          >
            {{ loading ? '发送中...' : '发送重置邮件' }}
          </button>
        </form>
      </div>
    </StatePanel>
  </section>
</template>
