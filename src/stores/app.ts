import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type SkinId =
  | 'violet-midnight'
  | 'cyber-ocean'
  | 'coral-sunset'
  | 'indigo-aurora'
  | 'teal-neutral'

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>('light')
  const resolvedTheme = ref<ResolvedTheme>('light')
  const skinId = ref<SkinId>('teal-neutral')
  const themeTouched = ref(false)

  function setTheme(mode: ThemeMode, options: { touched?: boolean } = {}): void {
    if (options.touched !== false) themeTouched.value = true
    themeMode.value = mode
  }

  function setResolvedTheme(theme: ResolvedTheme): void {
    resolvedTheme.value = theme
  }

  function setSkin(id: SkinId): void {
    skinId.value = id
  }

  function setThemeTouched(touched: boolean): void {
    themeTouched.value = touched
  }

  return {
    themeMode,
    resolvedTheme,
    skinId,
    themeTouched,
    setTheme,
    setResolvedTheme,
    setSkin,
    setThemeTouched
  }
})
