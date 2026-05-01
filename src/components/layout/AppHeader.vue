<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, type ThemeMode } from '@/stores/app'
import { useAuth } from '@/composables/useAuth'
import { useAuthModal } from '@/composables/useAuthModal'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const auth = useAuth()
const authModal = useAuthModal()
const { isAuthenticated, user } = auth

const navItems = computed(() => [
  { to: '/', label: '首页' },
  { to: '/workbench', label: 'SQL 工作台' },
  { to: '/workbench/ziwei', label: '紫微斗数' }
])

async function handleSignOut() {
  await auth.signOut()
  await router.push('/')
}

function setTheme(mode: ThemeMode) {
  appStore.setTheme(mode)
}

function openLoginModal() {
  authModal.openModal({ redirectTo: route.fullPath || '/workbench/ddl' })
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-panel/95 backdrop-blur">
    <div class="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4">
      <div class="flex items-center gap-2">
        <div class="h-7 w-7 rounded-control bg-brand-500/15"></div>
        <p class="text-sm font-semibold tracking-wide text-text">SQLDev Studio</p>
      </div>

      <nav class="hidden items-center gap-1 md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="rounded-control px-3 py-2 text-sm text-subtle transition-colors hover:bg-panel2 hover:text-text"
          :class="{ 'bg-panel2 text-text': route.path === item.to }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <div class="hidden items-center rounded-control border border-border bg-panel2 p-1 sm:flex">
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': appStore.themeMode === 'light' }"
            aria-label="切换浅色主题"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': appStore.themeMode === 'dark' }"
            aria-label="切换深色主题"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': appStore.themeMode === 'system' }"
            aria-label="跟随系统主题"
            @click="setTheme('system')"
          >
            系统
          </button>
        </div>

        <button
          v-if="!isAuthenticated"
          class="rounded-control border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-panel2"
          type="button"
          @click="openLoginModal"
        >
          登录 / 注册
        </button>
        <div v-else class="flex items-center gap-2">
          <span class="hidden text-xs text-subtle sm:block">{{ user?.email }}</span>
          <button class="btn-secondary px-3 py-2 text-sm" @click="handleSignOut">退出</button>
        </div>
      </div>
    </div>
  </header>
</template>
