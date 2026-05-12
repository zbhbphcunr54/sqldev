export function resolveLegacyMobileBreakpoint(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 1024
}
