import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

function installAuthMocks() {
  const signOut = vi.fn(async () => ({ error: null }))
  const signInWithPassword = vi.fn(async () => ({
    data: {
      session: {
        user: {
          id: 'user-2',
          email: 'user2@example.com'
        }
      }
    },
    error: null
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn()
            }
          }
        })),
        signOut,
        signInWithPassword,
        signUp: vi.fn(),
        signInWithOtp: vi.fn(),
        verifyOtp: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn()
      }
    }
  }))

  vi.doMock('@/api/app-config', () => ({
    appConfigApi: {
      list: vi.fn(),
      getAdminStatus: vi.fn(async () => ({ ok: true, is_admin: false }))
    }
  }))

  vi.doMock('@/api/operation-logs', () => ({
    fetchOperationLogs: vi.fn(async () => ({ is_admin: false }))
  }))

  return { signOut, signInWithPassword }
}

async function waitForAsyncReset(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('auth privacy reset', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
  })

  it('clears SQL convert content when the current user signs out', async () => {
    const { signOut } = installAuthMocks()
    const { useAuthStore } = await import('@/stores/auth')
    const { useWorkbenchStore } = await import('@/stores/workbench')

    const auth = useAuthStore()
    const workbench = useWorkbenchStore()

    auth.user = { id: 'admin-1', email: 'admin@example.com' } as never
    workbench.inputSql = 'select * from admin_secret;'
    workbench.outputSql = 'SELECT * FROM admin_secret;'
    workbench.status = 'success'
    workbench.statusText = '转换完成'
    workbench.translateTimeMs = 321

    await auth.signOut()
    await waitForAsyncReset()

    expect(signOut).toHaveBeenCalledOnce()
    expect(workbench.inputSql).toBe('')
    expect(workbench.outputSql).toBe('')
    expect(workbench.status).toBe('idle')
    expect(workbench.statusText).toBe('工作台已就绪')
    expect(workbench.translateTimeMs).toBeNull()
  })

  it('clears SQL convert content when a different user signs in', async () => {
    const { signInWithPassword } = installAuthMocks()
    const { useAuthStore } = await import('@/stores/auth')
    const { useWorkbenchStore } = await import('@/stores/workbench')

    const auth = useAuthStore()
    const workbench = useWorkbenchStore()

    auth.user = { id: 'admin-1', email: 'admin@example.com' } as never
    workbench.inputSql = 'create table private_data(id number);'
    workbench.outputSql = 'CREATE TABLE private_data(id bigint);'
    workbench.status = 'success'

    await auth.signInWithPassword('user2@example.com', 'secret')
    await waitForAsyncReset()

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user2@example.com',
      password: 'secret'
    })
    expect(auth.user?.id).toBe('user-2')
    expect(workbench.inputSql).toBe('')
    expect(workbench.outputSql).toBe('')
    expect(workbench.status).toBe('idle')
  })

  it('clears AI config state when a different user signs in', async () => {
    installAuthMocks()
    const { useAuthStore } = await import('@/stores/auth')
    const { useAiStore } = await import('@/stores/ai')

    const auth = useAuthStore()
    const aiStore = useAiStore()

    auth.user = { id: 'admin-1', email: 'admin@example.com' } as never
    aiStore.providers = [
      {
        id: 'provider-1',
        label: 'DeepSeek',
        slug: 'deepseek',
        base_url: 'https://api.deepseek.com/v1',
        region: 'global',
        api_format: 'openai',
        models: ['deepseek-chat'],
        is_enabled: true,
        sort_order: 1
      }
    ] as never
    aiStore.personalConfigs = [
      {
        id: 'config-user-1',
        provider_id: 'provider-1',
        base_url: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        api_key_masked: 'sk-***1111',
        is_active: true,
        timeout_ms: 60000,
        is_encrypted: true,
        scope: 'user'
      }
    ] as never
    aiStore.globalConfigs = [
      {
        id: 'config-global-1',
        provider_id: 'provider-1',
        base_url: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        api_key_masked: 'sk-***9999',
        is_active: true,
        timeout_ms: 60000,
        is_encrypted: true,
        scope: 'global'
      }
    ] as never

    await auth.signInWithPassword('user2@example.com', 'secret')
    await waitForAsyncReset()

    expect(auth.user?.id).toBe('user-2')
    expect(aiStore.providers).toEqual([])
    expect(aiStore.personalConfigs).toEqual([])
    expect(aiStore.globalConfigs).toEqual([])
    expect(aiStore.activeConfig).toBeNull()
  })
})
