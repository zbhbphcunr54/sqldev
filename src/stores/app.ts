import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'sqldev:theme'

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')

  const resolvedTheme = computed<'light' | 'dark'>(() => {
    if (themeMode.value !== 'system') return themeMode.value
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  function setTheme(mode: ThemeMode): void {
    themeMode.value = mode
  }

  function applyTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  watch(
    [themeMode, resolvedTheme],
    ([mode, resolved]) => {
      localStorage.setItem(STORAGE_KEY, mode)
      applyTheme(resolved)
    },
    { immediate: true }
  )

  return {
    themeMode,
    resolvedTheme,
    setTheme
  }
})
