import { ref, onMounted, onUnmounted, nextTick, watch, type Ref } from 'vue'
import type { MetadataRecord, MetadataRevisionInfo } from '@/stores/workbench'

export interface ConnectorLine {
  id: string
  recordId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export function useConnectorLines(
  workspaceRef: Ref<HTMLElement | null>,
  tablePanelRef: Ref<HTMLElement | null>,
  tableScrollRef: Ref<HTMLElement | null>,
  revisionContentRef: Ref<HTMLElement | null>,
  rows: Ref<MetadataRecord[]>,
  revisions: Ref<MetadataRevisionInfo[]>
) {
  const svgLines = ref<ConnectorLine[]>([])

  function recalcLines(): void {
    if (!workspaceRef.value) {
      svgLines.value = []
      return
    }
    const wsRect = workspaceRef.value.getBoundingClientRect()
    const panelRight = tablePanelRef.value
      ? tablePanelRef.value.getBoundingClientRect().right - wsRect.left
      : wsRect.width / 2
    const lines: ConnectorLine[] = []

    for (const revision of revisions.value) {
      const rowEl = workspaceRef.value.querySelector(
        `[data-record-id="${revision.recordId}"]`
      ) as HTMLElement | null
      const tagEl = workspaceRef.value.querySelector(
        `[data-revision-id="${revision.id}"]`
      ) as HTMLElement | null

      if (!rowEl || !tagEl) continue

      const rowRect = rowEl.getBoundingClientRect()
      const tagRect = tagEl.getBoundingClientRect()

      const x1 = panelRight
      const y1 = rowRect.top + rowRect.height / 2 - wsRect.top
      const x2 = tagRect.left - wsRect.left
      const y2 = tagRect.top + tagRect.height / 2 - wsRect.top

      if (y1 < -50 || y1 > wsRect.height + 50 || y2 < -50 || y2 > wsRect.height + 50) continue

      lines.push({ id: revision.id, recordId: revision.recordId, x1, y1, x2, y2 })
    }

    svgLines.value = lines
  }

  function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
    const dx = Math.abs(x2 - x1)
    const cpOffset = Math.max(dx * 0.35, 30)
    return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`
  }

  let rafId = 0
  function scheduleRecalc(): void {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      recalcLines()
      rafId = 0
    })
  }

  let scrollSyncSource: 'table' | 'revision' | null = null

  function onTableScroll(): void {
    scheduleRecalc()
    if (scrollSyncSource === 'revision') return
    scrollSyncSource = 'table'
    const el = tableScrollRef.value
    const target = revisionContentRef.value
    if (el && target) {
      const maxFrom = el.scrollHeight - el.clientHeight
      const maxTo = target.scrollHeight - target.clientHeight
      if (maxFrom > 0 && maxTo > 0) {
        target.scrollTop = (el.scrollTop / maxFrom) * maxTo
      }
    }
    requestAnimationFrame(() => {
      scrollSyncSource = null
    })
  }

  function onRevisionScroll(): void {
    scheduleRecalc()
    if (scrollSyncSource === 'table') return
    scrollSyncSource = 'revision'
    const el = revisionContentRef.value
    const target = tableScrollRef.value
    if (el && target) {
      const maxFrom = el.scrollHeight - el.clientHeight
      const maxTo = target.scrollHeight - target.clientHeight
      if (maxFrom > 0 && maxTo > 0) {
        target.scrollTop = (el.scrollTop / maxFrom) * maxTo
      }
    }
    requestAnimationFrame(() => {
      scrollSyncSource = null
    })
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    nextTick(() => recalcLines())

    if (workspaceRef.value) {
      resizeObserver = new ResizeObserver(() => scheduleRecalc())
      resizeObserver.observe(workspaceRef.value)
    }

    tableScrollRef.value?.addEventListener('scroll', onTableScroll, { passive: true })
    revisionContentRef.value?.addEventListener('scroll', onRevisionScroll, { passive: true })
    window.addEventListener('resize', scheduleRecalc, { passive: true })
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    tableScrollRef.value?.removeEventListener('scroll', onTableScroll)
    revisionContentRef.value?.removeEventListener('scroll', onRevisionScroll)
    window.removeEventListener('resize', scheduleRecalc)
    if (rafId) cancelAnimationFrame(rafId)
  })

  watch([rows, revisions], () => nextTick(() => recalcLines()), { deep: true })

  return { svgLines, bezierPath, scheduleRecalc }
}
