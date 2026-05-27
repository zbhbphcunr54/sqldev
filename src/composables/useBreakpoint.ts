import { ref, onScopeDispose } from 'vue'

export function useBreakpoint(maxWidth: number) {
  const mql = window.matchMedia(`(max-width: ${maxWidth}px)`)
  const matches = ref(mql.matches)

  function onChange(e: MediaQueryListEvent): void {
    matches.value = e.matches
  }

  mql.addEventListener('change', onChange)
  onScopeDispose(() => mql.removeEventListener('change', onChange))

  return matches
}
