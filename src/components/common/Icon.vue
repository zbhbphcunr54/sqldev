<script setup lang="ts">
/**
 * 通用 SVG 图标组件
 *
 * 使用方式：
 * <Icon name="grid" size="20" />
 *
 * 支持的图标：grid, layers, terminal, document, clock, document-text,
 *            sparkles, cog, clock-history, chevron-down, chevron-right,
 *            check, x, plus, minus, search, refresh
 */
defineProps<{
  name: string
  size?: number | string
  class?: string
}>()
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 20 20"
    fill="none"
    :class="$props.class"
    class="icon"
  >
    <!-- Grid / Squares-2x2 -->
    <template v-if="name === 'grid'">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" />
    </template>

    <!-- Layers / 堆叠 -->
    <template v-else-if="name === 'layers'">
      <path
        d="M10 2L2 7L10 12L18 7L10 2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M2 12L10 17L18 12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M2 9.5L10 14.5L18 9.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Terminal / 代码终端 -->
    <template v-else-if="name === 'terminal'">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M6 8L10 11L6 14"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M11 14H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Document / 证件 -->
    <template v-else-if="name === 'document'">
      <path
        d="M4 2H11L15 6V18H4V2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path d="M11 2V6H15" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </template>

    <!-- Clock / 时钟 -->
    <template v-else-if="name === 'clock'">
      <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M10 6V10L13 12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Document Text / 文件规则 -->
    <template v-else-if="name === 'document-text'">
      <path
        d="M4 2H11L15 6V18H4V2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path d="M11 2V6H15" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M7 10H13M7 13H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Sparkles / AI 星光 -->
    <template v-else-if="name === 'sparkles'">
      <path
        d="M10 2L11.5 6.5L16 8L11.5 9.5L10 14L8.5 9.5L4 8L8.5 6.5L10 2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M15 13L15.5 14.5L17 15L15.5 15.5L15 17L14.5 15.5L13 15L14.5 14.5L15 13Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M5 13L5.25 13.75L6 14L5.25 14.25L5 15L4.75 14.25L4 14L4.75 13.75L5 13Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </template>

    <!-- Cog / 齿轮设置 -->
    <template v-else-if="name === 'cog'">
      <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M10 2V4M10 16V18M18 10H16M4 10H2M15.5 4.5L14 6M6 14L4.5 15.5M15.5 15.5L14 14M6 6L4.5 4.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Clock History / 操作日志 -->
    <template v-else-if="name === 'clock-history'">
      <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M10 6V10L13 12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M6 4L5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <path d="M14 4L15 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Chevron Down -->
    <template v-else-if="name === 'chevron-down'">
      <path
        d="M4 7.5L10 13.5L16 7.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Chevron Right -->
    <template v-else-if="name === 'chevron-right'">
      <path
        d="M7.5 4L13.5 10L7.5 16"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Check -->
    <template v-else-if="name === 'check'">
      <path
        d="M4 10L8 14L16 6"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- X / Close -->
    <template v-else-if="name === 'x'">
      <path
        d="M5 5L15 15M15 5L5 15"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Plus -->
    <template v-else-if="name === 'plus'">
      <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Minus -->
    <template v-else-if="name === 'minus'">
      <path d="M4 10H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Search -->
    <template v-else-if="name === 'search'">
      <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5" />
      <path d="M13.5 13.5L18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Refresh -->
    <template v-else-if="name === 'refresh'">
      <path
        d="M4.5 9V6H7.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M4.5 6C5.5 3.5 8 2 10.5 2C14 2 16.5 4.5 16.5 8C16.5 11.5 14 14 10.5 14C8.5 14 6.5 13 5.5 11.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M15.5 11V14H18.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M15.5 14C14.5 16.5 12 18 9.5 18C6 18 3.5 15.5 3.5 12C3.5 8.5 6 6 9.5 6C11.5 6 13.5 7 14.5 8.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Arrow Left (for back navigation) -->
    <template v-else-if="name === 'arrow-left'">
      <path
        d="M19 10H5M5 10L11 4M5 10L11 16"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Copy -->
    <template v-else-if="name === 'copy'">
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M3 13V4C3 3.44772 3.44772 3 4 3H13"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Trash -->
    <template v-else-if="name === 'trash'">
      <path
        d="M3 5H17M7 5V3H13V5M8 8V14M12 8V14M5 5L6 17H14L15 5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Edit / Pencil -->
    <template v-else-if="name === 'edit'">
      <path
        d="M14.5 2.5L17.5 5.5L7 16L3 17L4 13L14.5 2.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path d="M13 4L16 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Warning -->
    <template v-else-if="name === 'warning'">
      <path
        d="M10 2L18.5 17H1.5L10 2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path d="M10 8V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
    </template>

    <!-- Info -->
    <template v-else-if="name === 'info'">
      <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
      <path d="M10 9V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="10" cy="6.5" r="0.5" fill="currentColor" />
    </template>

    <!-- Exclamation -->
    <template v-else-if="name === 'exclamation'">
      <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
      <path d="M10 7V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
    </template>

    <!-- Folder -->
    <template v-else-if="name === 'folder'">
      <path
        d="M2 5C2 4.44772 2.44772 4 3 4H7L9 6H17C17.5523 6 18 6.44772 18 7V15C18 15.5523 17.5523 16 17 16H3C2.44772 16 2 15.5523 2 15V5Z"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </template>

    <!-- Database -->
    <template v-else-if="name === 'database'">
      <ellipse cx="10" cy="5" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M3 5V15C3 16.1046 6.23858 17 10 17C13.7614 17 17 16.1046 17 15V5"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M3 10C3 11.1046 6.23858 12 10 12C13.7614 12 17 11.1046 17 10"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </template>

    <!-- Code -->
    <template v-else-if="name === 'code'">
      <path
        d="M6 7L2 10L6 13"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M14 7L18 10L14 13"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M12 4L8 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Eye -->
    <template v-else-if="name === 'eye'">
      <path
        d="M2 10C4 6 6.5 5 10 5C13.5 5 16 6 18 10C16 14 13.5 15 10 15C6.5 15 4 14 2 10Z"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
    </template>

    <!-- Eye Off (hidden) -->
    <template v-else-if="name === 'eye-off'">
      <path
        d="M2 10C4 6 6.5 5 10 5C13.5 5 16 6 18 10C16 14 13.5 15 10 15C6.5 15 4 14 2 10Z"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path d="M3 3L17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- User -->
    <template v-else-if="name === 'user'">
      <circle cx="10" cy="6" r="3" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M3 17C3 14.2386 6.13401 12 10 12C13.866 12 17 14.2386 17 17"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Users (multiple) -->
    <template v-else-if="name === 'users'">
      <circle cx="8" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M2 17C2 14.7909 4.68629 13 8 13"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <circle cx="14" cy="7" r="2" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M13 17C13 15.3431 14.3431 14 16 14C17.6569 14 19 15.3431 19 17"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Settings / Sliders -->
    <template v-else-if="name === 'sliders'">
      <path
        d="M4 5V17M10 3V17M16 7V17"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Link -->
    <template v-else-if="name === 'link'">
      <path
        d="M8 12H4C3.44772 12 3 11.5523 3 11V8C3 7.44772 3.44772 7 4 7H8C8.55228 7 9 7.44772 9 8V12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M12 8H16C16.5523 8 17 8.44772 17 9V12C17 12.5523 16.5523 13 16 13H12C11.4477 13 11 12.5523 11 12V8"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path d="M7 10H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- External Link -->
    <template v-else-if="name === 'external-link'">
      <path
        d="M10 3H17V10"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M13 7L17 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <path
        d="M7 13H3V17H13V13"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Filter -->
    <template v-else-if="name === 'filter'">
      <path
        d="M3 5H17M6 9H14M9 13H11"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Sort -->
    <template v-else-if="name === 'sort'">
      <path
        d="M4 6H16M4 10H12M4 14H8"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Star -->
    <template v-else-if="name === 'star'">
      <path
        d="M10 2L12.5 7L18 7.5L14 11.5L15 17L10 14L5 17L6 11.5L2 7.5L7.5 7L10 2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </template>

    <!-- Heart -->
    <template v-else-if="name === 'heart'">
      <path
        d="M10 16.5C10 16.5 3 12.5 3 7C3 5 4.5 3 6.5 3C8 3 9.5 4 10 5.5C10.5 4 12 3 13.5 3C15.5 3 17 5 17 7C17 12.5 10 16.5 10 16.5Z"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </template>

    <!-- Mail -->
    <template v-else-if="name === 'mail'">
      <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <path d="M3 7L10 11L17 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Calendar -->
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <path d="M3 8H17" stroke="currentColor" stroke-width="1.5" />
      <path d="M7 2V4M13 2V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Globe -->
    <template v-else-if="name === 'globe'">
      <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M2 10H18M10 2C12 5 12 15 10 18M10 2C8 5 8 15 10 18"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </template>

    <!-- Lock -->
    <template v-else-if="name === 'lock'">
      <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
    </template>

    <!-- Unlock -->
    <template v-else-if="name === 'unlock'">
      <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
    </template>

    <!-- Play -->
    <template v-else-if="name === 'play'">
      <path
        d="M6 4L16 10L6 16V4Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </template>

    <!-- Pause -->
    <template v-else-if="name === 'pause'">
      <path d="M6 4H8V16H6V4Z" stroke="currentColor" stroke-width="1.5" />
      <path d="M12 4H14V16H12V4Z" stroke="currentColor" stroke-width="1.5" />
    </template>

    <!-- Stop -->
    <template v-else-if="name === 'stop'">
      <rect x="4" y="4" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1.5" />
    </template>

    <!-- Download -->
    <template v-else-if="name === 'download'">
      <path
        d="M10 3V13M10 13L6 9M10 13L14 9"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M3 15V17H17V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Upload -->
    <template v-else-if="name === 'upload'">
      <path
        d="M10 17V7M10 7L6 11M10 7L14 11"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M3 15V17H17V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </template>

    <!-- Share -->
    <template v-else-if="name === 'share'">
      <circle cx="15" cy="5" r="2.5" stroke="currentColor" stroke-width="1.5" />
      <circle cx="5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
      <circle cx="15" cy="15" r="2.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M7.5 8.5L12.5 6.5M7.5 11.5L12.5 13.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Menu / Hamburger -->
    <template v-else-if="name === 'menu'">
      <path
        d="M3 6H17M3 10H17M3 14H17"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- More Horizontal -->
    <template v-else-if="name === 'more-horizontal'">
      <circle cx="5" cy="10" r="1" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </template>

    <!-- More Vertical -->
    <template v-else-if="name === 'more-vertical'">
      <circle cx="10" cy="5" r="1" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="10" cy="15" r="1" fill="currentColor" />
    </template>

    <!-- Sun (light mode) -->
    <template v-else-if="name === 'sun'">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M10 2V3.5M10 16.5V18M2 10H3.5M16.5 10H18M4.5 4.5L5.5 5.5M14.5 14.5L15.5 15.5M4.5 15.5L5.5 14.5M14.5 5.5L15.5 4.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>

    <!-- Moon (dark mode) -->
    <template v-else-if="name === 'moon'">
      <path
        d="M18 10C18 14.4183 14.4183 18 10 18C8.5 18 7.09375 17.5625 5.875 16.7812C8.3125 16.3125 10.2188 14.3125 10.2188 12C10.2188 9.6875 8.3125 7.6875 5.875 7.21875C7.09375 6.4375 8.5 6 10 6C14.4183 6 18 9.58175 18 10Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Fallback: renders nothing if icon not found -->
  </svg>
</template>

<style scoped>
.icon {
  display: inline-block;
  flex-shrink: 0;
}
</style>
