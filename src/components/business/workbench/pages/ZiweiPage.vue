<script setup lang="ts">
import { ref, watch } from 'vue'
import { useZiweiForm } from '@/composables/useZiweiForm'
import { useZiweiAI } from '@/composables/useZiweiAI'
import { useZiweiChart } from '@/composables/useZiweiChart'
import {
  getStarColorClass,
  getHuaTagClass,
  getPalaceLevelClass
} from '@/features/ziwei/star-classifier'
import { UI_LABELS } from '@/features/ziwei/ui-constants'
import FormSelect from '@/components/common/FormSelect.vue'
import ChartLegend from '@/components/business/ziwei/ChartLegend.vue'

/* ---------- 移动端 Tab 切换 ---------- */
const mobileTab = ref<'input' | 'chart' | 'ai'>('input')

/* ---------- 命盘宫位选中态 ---------- */
const selectedPalaceIdx = ref<number | null>(null)
function togglePalace(idx: number): void {
  selectedPalaceIdx.value = selectedPalaceIdx.value === idx ? null : idx
}

const {
  calendarType,
  solarYear,
  solarMonth,
  solarDay,
  lunarYear,
  lunarMonth,
  lunarDay,
  birthHour,
  birthMinute,
  gender,
  birthProvince,
  birthCity,
  profileName,
  school,
  showUserMenu,
  generating,
  status,
  chart,
  correctionText,
  shiChenCorrectionNotice,
  yearFormOptions,
  monthOptions,
  dayOptions,
  hourOptions,
  minuteOptions,
  provinceOptions,
  cityOptions,
  selectedLongitudeText,
  calendarTypeOptions,
  toggleUserMenu,
  closeUserMenu,
  handleGenerate
} = useZiweiForm()

const {
  aiLoading,
  aiError,
  aiResult,
  aiQuestionInput,
  aiQuestionLoading,
  aiQuestionAnswer,
  aiQuestionError,
  currentStep,
  aiButtonLabel,
  handleAiAnalysis,
  handleAiQuestion
} = useZiweiAI(chart, profileName, gender, school)

const { palaceGrid, centerInfo, chartMeta, daXianTimeline, liuNianTimeline } = useZiweiChart(
  chart,
  calendarType,
  solarYear,
  lunarYear
)

const stepLabels = [UI_LABELS.STEP_1, UI_LABELS.STEP_2, UI_LABELS.STEP_3]

/* 排盘完成后自动切换到命盘 Tab（移动端） */
watch(chart, (v) => {
  if (v) mobileTab.value = 'chart'
})
</script>

<template>
  <div class="flex flex-col min-h-full bg-bg text-text">
    <!-- 顶部导航栏 -->
    <header
      class="flex items-center justify-between shrink-0 px-6 ziwei-header bg-panel"
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accentBg text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 2C12 2 14 6 14 12C14 18 12 22 12 22"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M2 12C2 12 6 14 12 14C18 14 22 12 22 12"
              stroke="currentColor"
              stroke-width="2"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
        <div class="flex flex-col gap-0.5">
          <h1 class="text-base font-semibold text-text">{{ UI_LABELS.PAGE_TITLE }}</h1>
          <span class="text-xs text-subtle">{{ UI_LABELS.PAGE_SUBTITLE }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <button
            class="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-subtle hover:text-text transition-apple"
            aria-label="用户菜单"
            @click="toggleUserMenu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
          <Transition name="fade">
            <div
              v-if="showUserMenu"
              class="absolute top-full mt-2 right-0 w-60 bg-panel border border-border rounded-lg z-[100] overflow-hidden"
              style="box-shadow: 0 8px 24px var(--color-overlay)"
              @click.stop
            >
              <div class="flex items-center gap-3 px-4 py-3.5">
                <div
                  class="flex items-center justify-center w-10 h-10 rounded-full bg-accentBg text-accent"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
                    <path
                      d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-medium text-text">{{ UI_LABELS.USER_NAME }}</span>
                  <span class="text-xs text-subtle">{{ UI_LABELS.USER_EMAIL }}</span>
                </div>
              </div>
              <div class="h-px bg-border"></div>
              <button
                class="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-none text-sm text-text text-left cursor-pointer hover:bg-accentBg/50 transition-colors duration-150"
                tabindex="0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M16 17L21 12L16 7M21 12H9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>{{ UI_LABELS.MENU_LOGOUT }}</span>
              </button>
            </div>
          </Transition>
          <div v-if="showUserMenu" class="fixed inset-0 z-[99]" @click="closeUserMenu"></div>
        </div>
      </div>
    </header>

    <!-- 移动端 Tab 栏 -->
    <nav class="mobile-tab-bar flex lg:hidden border-b border-border bg-panel shrink-0">
      <button
        class="flex-1 py-2.5 text-xs font-medium text-center transition-colors duration-150"
        :class="mobileTab === 'input' ? 'text-accent border-b-2 border-accent bg-accentBg/40' : 'text-subtle'"
        @click="mobileTab = 'input'"
      >
        输入信息
      </button>
      <button
        class="flex-1 py-2.5 text-xs font-medium text-center transition-colors duration-150"
        :class="mobileTab === 'chart' ? 'text-accent border-b-2 border-accent bg-accentBg/40' : 'text-subtle'"
        @click="mobileTab = 'chart'"
      >
        命盘
      </button>
      <button
        class="flex-1 py-2.5 text-xs font-medium text-center transition-colors duration-150"
        :class="mobileTab === 'ai' ? 'text-accent border-b-2 border-accent bg-accentBg/40' : 'text-subtle'"
        @click="mobileTab = 'ai'"
      >
        AI 解读
      </button>
    </nav>

    <!-- 主内容区 -->
    <main class="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] overflow-hidden">
      <!-- 左栏：输入面板 -->
      <aside
        class="flex-col p-4 bg-panel border-r border-border overflow-y-auto"
        :class="mobileTab === 'input' ? 'flex' : 'hidden lg:flex'"
      >
        <div class="flex flex-col gap-2 mb-4">
          <button class="btn-primary w-full" :disabled="generating" @click="handleGenerate">
            {{ UI_LABELS.BTN_GENERATE }}
          </button>
          <button class="ziwei-btn-outline w-full gap-1.5 text-xs" :disabled="!chart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect
                x="8"
                y="14"
                width="8"
                height="8"
                rx="1"
                stroke="currentColor"
                stroke-width="2"
              />
              <path
                d="M16 10V18M16 18L12 14M16 18L20 14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M8 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V16"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            {{ UI_LABELS.BTN_SHARE }}
          </button>
        </div>

        <!-- 步骤指引 -->
        <div class="flex items-center justify-between p-3 bg-bg rounded-lg mb-4">
          <template v-for="(label, idx) in stepLabels" :key="'step-' + idx">
            <div class="flex flex-col items-center gap-1">
              <span
                class="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-all duration-200"
                :class="{
                  'bg-accentBg text-accent': currentStep === idx + 1,
                  'bg-successBg text-success': currentStep > idx + 1,
                  'bg-transparent border border-muted text-subtle': currentStep < idx + 1
                }"
                >{{ idx + 1 }}</span
              >
              <span
                class="text-[10px] text-center"
                :class="currentStep >= idx + 1 ? 'text-text' : 'text-subtle'"
                >{{ label }}</span
              >
            </div>
            <div v-if="idx < 2" class="flex-1 h-px mx-1 mb-4 bg-border"></div>
          </template>
        </div>

        <!-- 出生信息表单 -->
        <div class="flex flex-col gap-3 flex-1">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_PROFILE }}</label>
            <input
              v-model="profileName"
              type="text"
              :placeholder="UI_LABELS.PLACEHOLDER_PROFILE"
              class="input-control"
            />
            <span class="text-[10px] text-subtle">{{ UI_LABELS.HINT_PROFILE }}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_CALENDAR }}</label>
            <FormSelect v-model="calendarType" :options="calendarTypeOptions" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{
              calendarType === 'solar' ? UI_LABELS.LABEL_SOLAR_YEAR : UI_LABELS.LABEL_LUNAR_YEAR
            }}</label>
            <FormSelect
              v-if="calendarType === 'solar'"
              v-model="solarYear"
              :options="yearFormOptions"
            />
            <FormSelect v-else v-model="lunarYear" :options="yearFormOptions" />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{
                calendarType === 'solar' ? UI_LABELS.LABEL_MONTH : UI_LABELS.LABEL_LUNAR_MONTH
              }}</label>
              <FormSelect
                v-if="calendarType === 'solar'"
                v-model="solarMonth"
                :options="monthOptions"
              />
              <FormSelect v-else v-model="lunarMonth" :options="monthOptions" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{
                calendarType === 'solar' ? UI_LABELS.LABEL_DAY : UI_LABELS.LABEL_LUNAR_DAY
              }}</label>
              <FormSelect
                v-if="calendarType === 'solar'"
                v-model="solarDay"
                :options="dayOptions"
              />
              <FormSelect v-else v-model="lunarDay" :options="dayOptions" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_BIRTH_HOUR }}</label>
              <FormSelect v-model="birthHour" :options="hourOptions" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_BIRTH_MINUTE }}</label>
              <FormSelect v-model="birthMinute" :options="minuteOptions" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_PROVINCE }}</label>
              <FormSelect v-model="birthProvince" :options="provinceOptions" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_CITY }}</label>
              <FormSelect v-model="birthCity" :options="cityOptions" />
            </div>
          </div>

          <div class="rounded-md border border-border bg-bg px-3 py-2 text-[11px] text-subtle">
            <p>{{ UI_LABELS.LABEL_LONGITUDE }}：{{ selectedLongitudeText }}</p>
            <p class="mt-1 text-link">{{ UI_LABELS.HINT_TRUE_SOLAR }}</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_GENDER }}</label>
            <div class="flex gap-2">
              <label
                class="flex items-center gap-2 px-4 py-2 bg-bg border rounded-md text-sm cursor-pointer transition-all duration-150"
                :class="
                  gender === 'male'
                    ? 'border-accent bg-accentBg text-accent'
                    : 'border-border text-text'
                "
                tabindex="0"
                role="radio"
                aria-checked="true"
                @keydown.enter.prevent="gender = 'male'"
                @keydown.space.prevent="gender = 'male'"
              >
                <input v-model="gender" type="radio" value="male" class="hidden" />
                <span
                  class="w-4 h-4 rounded-full border-2 transition-all duration-150"
                  :class="gender === 'male' ? 'border-accent bg-accent' : 'border-border'"
                  :style="gender === 'male' ? { boxShadow: 'inset 0 0 0 3px var(--color-bg)' } : {}"
                ></span>
                <span>{{ UI_LABELS.LABEL_MALE }}</span>
              </label>
              <label
                class="flex items-center gap-2 px-4 py-2 bg-bg border rounded-md text-sm cursor-pointer transition-all duration-150"
                :class="
                  gender === 'female'
                    ? 'border-accent bg-accentBg text-accent'
                    : 'border-border text-text'
                "
                tabindex="0"
                role="radio"
                aria-checked="false"
                @keydown.enter.prevent="gender = 'female'"
                @keydown.space.prevent="gender = 'female'"
              >
                <input v-model="gender" type="radio" value="female" class="hidden" />
                <span
                  class="w-4 h-4 rounded-full border-2 transition-all duration-150"
                  :class="gender === 'female' ? 'border-accent bg-accent' : 'border-border'"
                  :style="
                    gender === 'female' ? { boxShadow: 'inset 0 0 0 3px var(--color-bg)' } : {}
                  "
                ></span>
                <span>{{ UI_LABELS.LABEL_FEMALE }}</span>
              </label>
            </div>
          </div>
        </div>

        <Transition name="slide-fade">
          <div
            v-if="status.text"
            class="mt-4 p-3 rounded-md text-xs"
            :class="status.type === 'success' ? 'bg-successBg text-success' : 'bg-dangerBg text-danger'"
          >
            {{ status.text }}
          </div>
        </Transition>
        <div
          v-if="shiChenCorrectionNotice"
          class="mt-3 rounded-md border border-border bg-panel2 px-3 py-2 text-[11px] text-warning"
        >
          {{ shiChenCorrectionNotice }}
        </div>
        <p
          v-else-if="correctionText"
          class="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-[11px] text-subtle"
        >
          {{ correctionText }}
        </p>
      </aside>

      <!-- 中栏：命盘主区域 -->
      <main
        class="flex-col items-center justify-center p-5 bg-bg overflow-y-auto"
        :class="mobileTab === 'chart' ? 'flex' : 'hidden lg:flex'"
      >
        <div
          v-if="!chart"
          class="flex flex-col items-center justify-center gap-4 flex-1 text-center"
        >
          <div class="text-muted">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
              <path
                d="M12 2C12 2 14 6 14 12C14 18 12 22 12 22"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="M2 12C2 12 6 14 12 14C18 14 22 12 22 12"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </div>
          <h3 class="text-lg text-text">{{ UI_LABELS.EMPTY_TITLE }}</h3>
          <p class="text-sm text-subtle leading-relaxed whitespace-pre-line">
            {{ UI_LABELS.EMPTY_DESC }}
          </p>
        </div>

        <div v-else class="flex flex-col gap-4 w-full">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-text">{{ UI_LABELS.CHART_TITLE }}</h2>
            <span class="text-sm text-subtle">{{ chartMeta }}</span>
          </div>
          <p v-if="centerInfo?.timeCorrectionText" class="text-xs text-subtle">
            {{ centerInfo.timeCorrectionText }}
          </p>

          <!-- 命盘核心信息卡 -->
          <div class="zw-summary-card">
            <div v-if="centerInfo" class="zw-summary-inner">
              <div class="zw-summary-left">
                <span class="zw-nayin">{{ centerInfo.yinYang?.charAt(0) || '阴' }}</span>
                <div class="zw-summary-meta">
                  <span class="zw-bureau">{{ centerInfo.bureau }}</span>
                  <span class="zw-gender-tag">{{ centerInfo.gender }}命</span>
                </div>
              </div>
              <div class="zw-summary-divider"></div>
              <div class="zw-summary-grid">
                <div class="zw-kv"><span class="zw-k">命宫</span><span class="zw-v">{{ centerInfo.mingBranch || '--' }}</span></div>
                <div class="zw-kv"><span class="zw-k">身宫</span><span class="zw-v">{{ centerInfo.shenBranch || '--' }}</span></div>
                <div class="zw-kv"><span class="zw-k">命主</span><span class="zw-v">{{ centerInfo.mingZhu || '--' }}</span></div>
                <div class="zw-kv"><span class="zw-k">身主</span><span class="zw-v">{{ centerInfo.shenZhu || '--' }}</span></div>
                <div class="zw-kv"><span class="zw-k">时辰</span><span class="zw-v">{{ centerInfo.shichenLabel || '--' }}</span></div>
                <div class="zw-kv"><span class="zw-k">出生</span><span class="zw-v">{{ centerInfo.inputClockText || '--' }}</span></div>
              </div>
              <div class="zw-summary-divider"></div>
              <div class="zw-summary-right">
                <span class="zw-lunar-text">{{ centerInfo.lunar || '--' }}</span>
                <span class="zw-age-text">{{ centerInfo.currentYear }}年 · {{ centerInfo.age }}岁</span>
                <span class="zw-daxian-info">大限：{{ centerInfo.currentDaXianLabel || '--' }}</span>
                <span class="zw-liunian-info">流年命宫：{{ centerInfo.currentLiuNianPalaceLabel || '--' }}</span>
                <span v-if="profileName" class="zw-profile-name">{{ profileName }}</span>
              </div>
            </div>
          </div>

          <!-- 十二宫位卡片 -->
          <div class="zw-palace-ring">
            <template v-for="(cell, index) in palaceGrid" :key="'pc-' + index">
              <div
                v-if="cell"
                class="zw-card"
                :class="{
                  'zw-card--ming': cell.isMing,
                  'zw-card--shen': cell.isShen,
                  'zw-card--daxian': cell.isCurrentDaXian,
                  'zw-card--selected': selectedPalaceIdx === index
                }"
                @click="togglePalace(index)"
              >
                <!-- 卡片头部 -->
                <div class="zw-card-head">
                  <div class="zw-card-title">
                    <span class="zw-palace-name">{{ cell.palace }}</span>
                    <span v-if="cell.isMing" class="zw-tag zw-tag--ming">命</span>
                    <span v-if="cell.isShen" class="zw-tag zw-tag--shen">身</span>
                    <span v-if="cell.isCurrentDaXian" class="zw-tag zw-tag--daxian">限</span>
                  </div>
                  <span class="zw-ganzhi">{{ cell.ganzhi }}</span>
                </div>
                <!-- 主星区 -->
                <div class="zw-stars-main">
                  <div
                    v-for="(star, sIdx) in cell.mainStars.slice(0, 4)"
                    :key="'ms-' + sIdx"
                    class="zw-star-row"
                  >
                    <span class="zw-star-name zw-star--major">
                      {{ star.name }}
                      <span
                        v-if="star.hua"
                        class="zw-hua-pill"
                        :class="getHuaTagClass(star.hua)"
                      >{{ star.hua }}</span>
                    </span>
                    <span
                      v-if="star.level"
                      class="zw-level"
                      :class="getPalaceLevelClass(star.level)"
                    >{{ star.level }}</span>
                  </div>
                </div>
                <!-- 辅星区（折叠态只显示计数，展开态显示全部） -->
                <div class="zw-stars-aux">
                  <template v-if="selectedPalaceIdx === index">
                    <div v-for="(star, sIdx) in cell.luckyStars" :key="'lk-' + sIdx" class="zw-star-row">
                      <span class="zw-star-name zw-star--luck">{{ star.name }}</span>
                    </div>
                    <div v-for="(star, sIdx) in cell.evilStars" :key="'ev-' + sIdx" class="zw-star-row">
                      <span class="zw-star-name zw-star--harm">{{ star.name }}</span>
                    </div>
                    <div v-for="(star, sIdx) in cell.miscStars" :key="'mi-' + sIdx" class="zw-star-row">
                      <span class="zw-star-name zw-star--misc">{{ star.name }}</span>
                    </div>
                  </template>
                  <template v-else>
                    <div class="zw-aux-summary">
                      <span v-if="cell.luckyStars.length" class="zw-aux-dot zw-dot--luck" :title="cell.luckyStars.map(s => s.name).join(' ')">{{ cell.luckyStars.length }}吉</span>
                      <span v-if="cell.evilStars.length" class="zw-aux-dot zw-dot--harm" :title="cell.evilStars.map(s => s.name).join(' ')">{{ cell.evilStars.length }}煞</span>
                      <span v-if="cell.miscStars.length" class="zw-aux-dot zw-dot--misc">{{ cell.miscStars.length }}辅</span>
                    </div>
                  </template>
                </div>
                <!-- 底部信息 -->
                <div class="zw-card-foot">
                  <span class="zw-changsheng">{{ cell.changSheng }}</span>
                  <span class="zw-daxian-age">{{ cell.daXianAge }}</span>
                </div>
                <div v-if="cell.liuNianPalaceName" class="zw-liunian-label">
                  {{ cell.liuNianPalaceName }}
                </div>
              </div>
            </template>
          </div>

          <!-- 大限/流年时间轴 -->
          <div class="zw-timeline-section">
            <div class="zw-timeline-row">
              <span class="zw-timeline-label">{{ UI_LABELS.TIMELINE_DAXIAN }}</span>
              <div class="zw-timeline-track">
                <div
                  v-for="(item, idx) in daXianTimeline"
                  :key="'dx-' + idx"
                  class="zw-timeline-item"
                >
                  <span class="zw-tl-range">{{ item.range }}</span>
                  <span class="zw-tl-branch">{{ item.branch }}</span>
                </div>
              </div>
            </div>
            <div class="zw-timeline-row">
              <span class="zw-timeline-label">{{ UI_LABELS.TIMELINE_LIUNIAN }}</span>
              <div class="zw-timeline-track">
                <div
                  v-for="(item, idx) in liuNianTimeline"
                  :key="'ln-' + idx"
                  class="zw-timeline-item"
                >
                  <span class="zw-tl-range">{{ item.year }}年</span>
                  <span class="zw-tl-branch">{{ item.ganzhi }}</span>
                </div>
              </div>
            </div>
          </div>

          <ChartLegend />
        </div>
      </main>

      <!-- 右栏：AI 功能面板 -->
      <aside
        class="flex-col p-4 bg-panel border-l border-border overflow-y-auto"
        :class="mobileTab === 'ai' ? 'flex' : 'hidden lg:flex'"
      >
        <span
          class="inline-block self-start mb-4 px-2.5 py-1 bg-accentBg text-accent text-[10px] font-bold rounded tracking-wider"
        >
          {{ UI_LABELS.AI_BADGE }}
        </span>

        <div class="flex flex-col gap-2.5">
          <h3 class="text-[15px] font-semibold text-text">{{ UI_LABELS.AI_TITLE }}</h3>
          <p class="text-xs text-subtle">
            {{ aiResult ? UI_LABELS.AI_DESC_GENERATED : UI_LABELS.AI_DESC_NOT_GENERATED }}
          </p>

          <button
            class="ziwei-btn-outline w-full gap-2 text-sm"
            :disabled="!chart || aiLoading"
            @click="handleAiAnalysis"
          >
            <span v-if="aiLoading" class="w-2 h-2 bg-accent rounded-full loading-dot"></span>
            {{ aiButtonLabel }}
          </button>

          <div
            v-if="aiError"
            class="p-2.5 bg-dangerBg border border-danger/30 rounded-md text-xs text-danger"
            role="alert"
          >
            {{ aiError }}
          </div>

          <p
            class="p-2.5 bg-accentBg border border-accentBorder rounded-md text-[11px] text-text leading-relaxed"
          >
            {{ UI_LABELS.AI_DISCLAIMER }}
          </p>
        </div>

        <hr class="border-panel2 my-4" />

        <div class="flex flex-col gap-2.5">
          <h4 class="text-sm font-semibold text-text">{{ UI_LABELS.QA_TITLE }}</h4>
          <p class="text-xs text-subtle">{{ UI_LABELS.QA_DESC }}</p>

          <div class="flex gap-2">
            <input
              v-model="aiQuestionInput"
              type="text"
              :placeholder="UI_LABELS.PLACEHOLDER_AI_QUESTION"
              :disabled="!aiResult"
              class="input-control flex-1"
            />
            <button
              class="w-10 bg-accent border-none rounded-md text-white cursor-pointer transition-colors duration-150 hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed"
              :class="{
                'opacity-50 cursor-not-allowed':
                  !aiResult || !aiQuestionInput.trim() || aiQuestionLoading
              }"
              :disabled="!aiResult || !aiQuestionInput.trim() || aiQuestionLoading"
              aria-label="发送问题"
              @click="handleAiQuestion"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="mx-auto">
                <path
                  d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div v-if="aiQuestionLoading" class="text-xs text-subtle">
            {{ UI_LABELS.HINT_AI_QA_LOADING }}
          </div>

          <div
            v-if="aiQuestionError"
            class="p-2.5 bg-dangerBg border border-danger/30 rounded-md text-xs text-danger"
            role="alert"
          >
            {{ aiQuestionError }}
          </div>

          <p class="text-[11px] text-subtle">
            {{ aiResult ? UI_LABELS.HINT_AI_QA_READY : UI_LABELS.HINT_AI_QA_NOT_READY }}
          </p>

          <div
            v-if="aiQuestionAnswer"
            class="mt-3 p-3 bg-bg border border-border rounded-md text-xs text-text leading-relaxed"
          >
            <p>{{ aiQuestionAnswer }}</p>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* 紫微专用描边按钮 — 使用柔和的边框色和文字色，避免强对比 */
.ziwei-btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  font-weight: 500;
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.ziwei-btn-outline:hover:not(:disabled) {
  border-color: var(--color-border-hover);
  background: var(--color-panel-2);
}

.ziwei-btn-outline:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ziwei-btn-outline:focus-visible {
  box-shadow: var(--shadow-focus-ring);
}

/* 标题栏高度与全局分割线对齐（56px header + 12px gap = 68px，与全局分割线同一水平线） */
.ziwei-header {
  height: calc(var(--header-height) + 12px);
}

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* ============================================
   Modern Ziwei Chart — Card-based Layout
   Apple HIG inspired, glassmorphism cards
   ============================================ */

/* --- Summary Card --- */
.zw-summary-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
}

.zw-summary-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.zw-summary-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zw-nayin {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-warning);
  line-height: 1;
}

.zw-summary-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zw-bureau {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.zw-gender-tag {
  font-size: 11px;
  color: var(--color-text-subtle);
}

.zw-summary-divider {
  width: 1px;
  height: 36px;
  background: var(--color-border);
  flex-shrink: 0;
}

.zw-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 4px 16px;
}

.zw-kv {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.zw-k {
  color: var(--color-text-muted);
}

.zw-v {
  color: var(--color-text);
  font-weight: 500;
}

.zw-summary-right {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: auto;
  text-align: right;
}

.zw-lunar-text {
  font-size: 12px;
  color: var(--color-text);
}

.zw-age-text {
  font-size: 11px;
  color: var(--color-text-subtle);
}

.zw-profile-name {
  font-size: 11px;
  color: var(--color-text-muted);
}

.zw-daxian-info {
  font-size: 11px;
  color: var(--color-daxian);
}

.zw-liunian-info {
  font-size: 11px;
  color: var(--color-liunian);
}

/* --- Palace Card Ring (3-col grid) --- */
.zw-palace-ring {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

/* --- Single Palace Card --- */
.zw-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 8px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition:
    box-shadow var(--duration-normal) var(--ease-apple),
    border-color var(--duration-normal) var(--ease-apple),
    transform var(--duration-fast) var(--ease-apple);
  min-height: 96px;
}

.zw-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.zw-card--selected {
  border-color: var(--color-accent-border);
  box-shadow: var(--shadow-md), 0 0 0 2px var(--color-accent-bg);
}

.zw-card--ming {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 3%, var(--color-panel));
}

.zw-card--shen {
  border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 3%, var(--color-panel));
}

.zw-card--daxian {
  background: var(--color-daxian-active-bg);
  border-color: color-mix(in srgb, var(--color-hua-lu) 40%, var(--color-border));
}

/* Card Head */
.zw-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.zw-card-title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zw-palace-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: var(--tracking-wide);
}

.zw-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  line-height: 14px;
}

.zw-tag--ming {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
}

.zw-tag--shen {
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.zw-tag--daxian {
  color: var(--color-hua-lu);
  background: color-mix(in srgb, var(--color-hua-lu) 14%, transparent);
}

.zw-ganzhi {
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-code);
}

/* Stars */
.zw-stars-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.zw-star-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.zw-star-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.zw-star--major {
  color: var(--color-major-star);
  font-weight: 600;
}

.zw-star--luck {
  color: var(--color-success);
  font-size: 11px;
}

.zw-star--harm {
  color: var(--color-danger);
  font-size: 11px;
}

.zw-star--misc {
  color: var(--color-text-subtle);
  font-size: 11px;
}

.zw-hua-pill {
  font-size: 9px;
  padding: 0 4px;
  border-radius: var(--radius-xs);
  margin-left: 2px;
  font-weight: 600;
}

.zw-level {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* Aux stars collapsed view */
.zw-stars-aux {
  margin-top: 4px;
  min-height: 16px;
}

.zw-aux-summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.zw-aux-dot {
  font-size: 10px;
  font-weight: 500;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  line-height: 18px;
}

.zw-dot--luck {
  color: var(--color-success);
  background: var(--color-success-bg);
}

.zw-dot--harm {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.zw-dot--misc {
  color: var(--color-text-subtle);
  background: var(--color-panel-2);
}

/* Card Footer */
.zw-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 4px;
}

.zw-changsheng {
  font-size: 10px;
  color: var(--color-text-muted);
}

.zw-daxian-age {
  font-size: 10px;
  color: var(--color-daxian);
  font-family: var(--font-code);
}

.zw-liunian-label {
  font-size: 9px;
  color: var(--color-liunian);
  text-align: right;
  margin-top: 2px;
}

/* --- Timeline Section --- */
.zw-timeline-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.zw-timeline-row {
  display: flex;
  background: var(--color-panel);
}

.zw-timeline-label {
  width: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-panel-2);
}

.zw-timeline-track {
  display: flex;
  flex: 1;
  overflow-x: auto;
}

.zw-timeline-item {
  flex: 1;
  min-width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-left: 1px solid var(--color-border);
}

.zw-tl-range {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text);
}

.zw-tl-branch {
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-code);
  margin-top: 2px;
}

.text-major-star {
  color: var(--color-major-star);
}

.text-link {
  color: var(--color-link);
}

.liunian-text {
  color: var(--color-liunian);
}

.hua-tag {
  color: var(--color-text);
}

.hua-lu {
  background: color-mix(in srgb, var(--color-hua-lu) 24%, transparent);
}

.hua-quan {
  background: color-mix(in srgb, var(--color-hua-quan) 24%, transparent);
}

.hua-ke {
  background: color-mix(in srgb, var(--color-hua-ke) 24%, transparent);
}

.hua-ji {
  background: color-mix(in srgb, var(--color-hua-ji) 24%, transparent);
}

/* Loading dot animation */
.loading-dot {
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Nav button borders via color-mix — removed (old 4×4 grid) */

/* Star level backgrounds via color-mix */
.level-miao {
  background: color-mix(in srgb, var(--color-page-success-alt) 20%, transparent);
  color: var(--color-page-success-alt);
}
.level-wang {
  background: color-mix(in srgb, var(--color-star-wang) 20%, transparent);
  color: var(--color-star-wang);
}
.level-de-li {
  background: color-mix(in srgb, var(--color-star-de-li) 20%, transparent);
  color: var(--color-star-de-li);
}
.level-li {
  background: color-mix(in srgb, var(--color-star-de-li) 20%, transparent);
  color: var(--color-star-de-li);
}
.level-ping {
  background: color-mix(in srgb, var(--color-star-ping) 20%, transparent);
  color: var(--color-star-ping);
}
.level-xian {
  background: color-mix(in srgb, var(--color-star-xian) 20%, transparent);
  color: var(--color-star-xian);
}

/* Vue transition classes */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 移动端 Tab 栏按钮热区 ≥ 44px（§15.4.4） */
.mobile-tab-bar button {
  min-height: 44px;
}

@media (max-width: 1023px) {
  /* 平板端：宫位卡片 2 列 */
  .zw-palace-ring {
    grid-template-columns: repeat(2, 1fr);
  }
  .zw-summary-right {
    margin-left: 0;
    text-align: left;
  }
}

@media (max-width: 600px) {
  /* 手机端：宫位卡片 2 列紧凑 */
  .zw-palace-ring {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .zw-card {
    padding: 8px 10px 6px;
    min-height: 80px;
  }
  .zw-palace-name {
    font-size: 12px;
  }
  .zw-star-name {
    font-size: 11px;
  }
  .zw-summary-inner {
    gap: 10px;
  }
  .zw-summary-divider {
    display: none;
  }
}
</style>
