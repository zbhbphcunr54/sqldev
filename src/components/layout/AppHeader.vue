<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import SkinPicker from '@/components/common/SkinPicker.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated, user, canAccessZiweiTool } = auth

const showUserMenu = ref(false)

const navItems = computed(() => [
  { to: '/', label: '首页' },
  { to: '/workbench', label: 'SQL 工作台' },
  { to: '/workbench/ziwei', label: '紫微斗数' }
])

const isNavActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

async function handleSignOut() {
  await auth.signOut()
  await router.push('/')
}

function openLoginModal() {
  authModal.openModal({ redirectTo: route.fullPath || '/workbench/ddl' })
}

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (showUserMenu.value && !target.closest('.user-menu-container')) {
    showUserMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="app-header">
    <div class="app-header-inner">
      <!-- Brand -->
      <div class="header-brand">
        <div class="brand-logo">SQL</div>
        <span class="brand-name">SQLDev Studio</span>
      </div>

      <!-- Navigation Links -->
      <nav class="header-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          v-show="item.to !== '/workbench/ziwei' || canAccessZiweiTool"
          :to="item.to"
          class="nav-link"
          :class="{ active: isNavActive(item.to) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- Actions -->
      <div class="header-actions">
        <SkinPicker />
        <!-- Theme Switch -->
        <ThemeToggle variant="text" />

        <!-- User Menu (Authenticated) -->
        <div v-if="isAuthenticated" class="user-menu-container relative">
          <button
            class="user-menu-trigger"
            title="用户菜单"
            aria-haspopup="true"
            :aria-expanded="showUserMenu"
            @click.stop="showUserMenu = !showUserMenu"
          >
            <!-- 三个点图标 -->
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showUserMenu" class="user-dropdown">
              <div class="dropdown-user-info">
                <div class="dropdown-avatar">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <circle cx="8" cy="5" r="3" />
                    <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  </svg>
                </div>
                <div class="dropdown-user-text">
                  <span class="dropdown-email">{{ user?.email }}</span>
                </div>
              </div>

              <div class="dropdown-section-row">
                <span class="dropdown-section-title">外观</span>
                <SkinPicker />
              </div>
              <ThemeToggle variant="icon" />

              <div class="dropdown-divider"></div>
              <RouterLink to="/ai-config" class="dropdown-item" @click="showUserMenu = false">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M10 3v2M10 16v2M3 10h2M16 10h2" stroke-linecap="round" />
                  <circle cx="10" cy="10" r="3" />
                  <path d="M5.5 5.5l1.4 1.4M13.1 13.1l1.4 1.4M5.5 14.5l1.4-1.4M13.1 6.9l1.4-1.4" />
                </svg>
                AI 配置
              </RouterLink>
              <RouterLink to="/operation-logs" class="dropdown-item" @click="showUserMenu = false">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M4 6h12M4 10h8M4 14h10" stroke-linecap="round" />
                </svg>
                操作日志
              </RouterLink>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" @click="handleSignOut">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M7 5H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M13 8l4 3-4 3M9 11h8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                退出登录
              </button>
            </div>
          </Transition>
        </div>

        <!-- Login Button (Not Authenticated) -->
        <button v-if="!isAuthenticated" class="login-btn" type="button" @click="openLoginModal">
          登录 / 注册
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--header-height, 56px);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--color-border);
}

[data-theme='dark'] .app-header {
  background: var(--glass-bg);
}

.app-header-inner {
  max-width: var(--content-max-width);
  height: 100%;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.header-nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-subtle);
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-apple);
}

.nav-link:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-link.active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login-btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
  box-shadow: var(--shadow-button);
}

.login-btn:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-hover);
}

.user-menu-container {
  position: relative;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-panel);
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.user-menu-trigger:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
  transform: translateY(-1px);
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 240px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 8px;
  z-index: 50;
}

.dropdown-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.dropdown-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropdown-user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-email {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  word-break: break-all;
}

.dropdown-section-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 4px;
}

.dropdown-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 6px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.dropdown-item:hover {
  background: var(--color-panel-2);
}

.dropdown-item.danger {
  color: var(--color-danger);
}

.dropdown-item.danger:hover {
  background: var(--color-danger-bg);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-normal) var(--ease-spring);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

@media (max-width: 768px) {
  .header-nav {
    display: none;
  }
}
</style>
