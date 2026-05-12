import { ref, computed, readonly, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

const EDGE_GAP = 24
const DRAG_THRESHOLD = 5

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function useDraggableFab(fabRef: Ref<HTMLElement | null>): {
  fabStyle: ComputedRef<Record<string, string>>
  dragging: Readonly<Ref<boolean>>
  justDragged: Readonly<Ref<boolean>>
  onPointerDown: (e: PointerEvent) => void
} {
  const x = ref<number | null>(null)
  const y = ref<number | null>(null)
  const dragging = ref(false)
  const justDragged = ref(false)

  let startPointerX = 0
  let startPointerY = 0
  let startFabX = 0
  let startFabY = 0
  let fabSize = 52
  let hasDragged = false

  function readCurrentPosition(): { left: number; top: number; size: number } | null {
    const el = fabRef.value
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { left: rect.left, top: rect.top, size: rect.width }
  }

  function clampToViewport(posX: number, posY: number): { x: number; y: number } {
    return {
      x: clamp(posX, 0, window.innerWidth - fabSize),
      y: clamp(posY, 0, window.innerHeight - fabSize)
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (!target.closest('.chat-fab')) return

    const pos = readCurrentPosition()
    if (!pos) return

    fabSize = pos.size
    x.value = pos.left
    y.value = pos.top
    startPointerX = e.clientX
    startPointerY = e.clientY
    startFabX = pos.left
    startFabY = pos.top
    hasDragged = false
    justDragged.value = false

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent): void {
    const dx = e.clientX - startPointerX
    const dy = e.clientY - startPointerY

    if (!hasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      hasDragged = true
      dragging.value = true
    }

    if (hasDragged) {
      const pos = clampToViewport(startFabX + dx, startFabY + dy)
      x.value = pos.x
      y.value = pos.y
    }
  }

  function onPointerUp(_e: PointerEvent): void {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)

    if (hasDragged) {
      const centerX = x.value! + fabSize / 2
      x.value = centerX < window.innerWidth / 2 ? EDGE_GAP : window.innerWidth - fabSize - EDGE_GAP
      y.value = clampToViewport(x.value!, y.value!).y
      dragging.value = false
      justDragged.value = true
    }

    hasDragged = false
  }

  function onResize(): void {
    if (x.value === null || y.value === null) return
    const pos = clampToViewport(x.value, y.value)
    x.value = pos.x
    y.value = pos.y
  }

  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  })

  const fabStyle = computed(() => {
    if (x.value === null || y.value === null) return {}
    return {
      top: `${y.value}px`,
      left: `${x.value}px`,
      right: 'auto',
      bottom: 'auto',
      transition: dragging.value
        ? 'none'
        : 'top var(--duration-normal) var(--ease-apple), left var(--duration-normal) var(--ease-apple)'
    }
  })

  return {
    fabStyle,
    dragging: readonly(dragging) as Readonly<Ref<boolean>>,
    justDragged: readonly(justDragged) as Readonly<Ref<boolean>>,
    onPointerDown
  }
}
