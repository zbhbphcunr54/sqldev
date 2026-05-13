<script setup lang="ts">
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

    <!-- 主内容区 -->
    <main class="flex-1 grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] overflow-hidden">
      <!-- 左栏：输入面板 -->
      <aside class="flex flex-col p-4 bg-panel border-r border-border overflow-y-auto">
        <div class="flex flex-col gap-2 mb-4">
          <button class="btn-primary w-full" :disabled="generating" @click="handleGenerate">
            {{ UI_LABELS.BTN_GENERATE }}
          </button>
          <button class="btn-secondary w-full gap-1.5 text-xs" :disabled="!chart">
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
      <main class="flex flex-col items-center justify-center p-5 bg-bg overflow-y-auto">
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

          <!-- 命盘区域 -->
          <div class="flex justify-center overflow-x-auto">
            <div class="relative p-6">
              <span class="absolute top-0 left-1/2 -translate-x-1/2 text-[11px] text-subtle">{{
                UI_LABELS.COMPASS_TOP
              }}</span>
              <span class="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] text-subtle">{{
                UI_LABELS.COMPASS_BOTTOM
              }}</span>
              <span class="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] text-subtle">{{
                UI_LABELS.COMPASS_LEFT
              }}</span>
              <span class="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] text-subtle">{{
                UI_LABELS.COMPASS_RIGHT
              }}</span>

              <div class="ziwei-board grid gap-px border border-border bg-border">
                <template v-for="(cell, index) in palaceGrid" :key="'cell-' + index">
                  <!-- 中央区域 -->
                  <div
                    v-if="index === 5 || index === 6 || index === 9 || index === 10"
                    class="flex items-center justify-center p-1.5 bg-panel2 text-[10px]"
                  >
                    <div v-if="(index === 6 || index === 9) && centerInfo" class="text-center">
                      <div v-if="index === 6" class="flex items-center justify-center gap-2 mb-2">
                        <span class="text-lg text-warning">{{
                          centerInfo.yinYang?.charAt(0) || '阴'
                        }}</span>
                        <span class="text-xs font-semibold text-text">{{ centerInfo.bureau }}</span>
                        <span class="text-[10px] text-text">{{ centerInfo.gender }}</span>
                      </div>
                      <div v-if="index === 6" class="text-[9px] text-text leading-relaxed">
                        <p class="my-0.5">命主：{{ centerInfo.mingZhu || '--' }}</p>
                        <p class="my-0.5">命宫：{{ centerInfo.mingBranch || '--' }}宫</p>
                        <p class="my-0.5">身宫：{{ centerInfo.shenBranch || '--' }}宫</p>
                        <p class="my-0.5">时辰：{{ centerInfo.shichenLabel || '--' }}</p>
                        <p class="mt-1 text-[10px] text-text">
                          {{ centerInfo.currentYear }}年·{{ centerInfo.age }}岁
                        </p>
                      </div>
                      <div v-if="index === 9" class="text-[9px] text-text">
                        <p class="my-0.5">{{ centerInfo.lunar || '--' }}</p>
                        <p class="my-0.5">出生时：{{ centerInfo.inputClockText || '--' }}</p>
                        <p class="my-0.5">当前大限：{{ centerInfo.currentDaXianLabel || '--' }}</p>
                        <p class="my-0.5">流年命宫：{{ centerInfo.currentLiuNianPalaceLabel || '--' }}</p>
                        <p class="mt-1 text-text">命主：{{ profileName || '--' }}</p>
                      </div>
                    </div>
                  </div>
                  <!-- 十二宫格 -->
                  <div
                    v-else-if="cell"
                    class="palace-cell flex flex-col p-1.5 bg-panel3 text-[10px] border border-border"
                    :class="{
                      'border-accent z-[1]': cell.isMing,
                      'palace-shen': cell.isShen,
                      'palace-daxian-active': cell.isCurrentDaXian
                    }"
                  >
                    <div class="flex justify-between items-center pb-1 border-b border-border mb-1">
                      <span class="font-semibold text-text text-[11px]">
                        {{ cell.palace }}
                        <span v-if="cell.isMing" class="inline-block ml-1 palace-mark palace-mark-ming">命</span>
                        <span v-if="cell.isShen" class="inline-block ml-1 palace-mark palace-mark-shen">身</span>
                      </span>
                      <span class="text-[9px] text-subtle font-mono">{{ cell.ganzhi }}</span>
                    </div>
                    <div class="flex flex-col gap-0.5 flex-1 overflow-hidden">
                      <div
                        v-for="(star, sIdx) in cell.mainStars.slice(0, 4)"
                        :key="'main-' + sIdx"
                        class="flex items-center gap-1"
                      >
                        <span class="inline-flex items-center gap-0.5 font-semibold text-[10px] text-major-star">
                          ★ {{ star.name }}
                          <span
                            v-if="star.hua"
                            class="text-[8px] px-[3px] rounded-[3px]"
                            :class="getHuaTagClass(star.hua)"
                            >{{ star.hua }}</span
                          >
                        </span>
                        <span
                          v-if="star.level"
                          class="text-[8px] px-0.5 rounded-[2px]"
                          :class="getPalaceLevelClass(star.level)"
                          >{{ star.level }}</span
                        >
                      </div>
                      <div
                        v-for="(star, sIdx) in cell.luckyStars.slice(0, 2)"
                        :key="'lucky-' + sIdx"
                        class="flex items-center gap-1"
                      >
                        <span
                          class="inline-flex items-center gap-0.5 font-mono text-[10px]"
                          :class="getStarColorClass('luck')"
                        >
                          {{ star.name }}
                        </span>
                      </div>
                      <div
                        v-for="(star, sIdx) in cell.evilStars.slice(0, 2)"
                        :key="'evil-' + sIdx"
                        class="flex items-center gap-1"
                      >
                        <span class="inline-flex items-center gap-0.5 font-mono text-[10px] text-danger">
                          {{ star.name }}
                        </span>
                      </div>
                      <div v-if="cell.miscStars.length" class="text-[9px] text-link truncate">
                        {{ cell.miscStars.slice(0, 3).map((item) => item.name).join(' ') }}
                      </div>
                    </div>
                    <div class="flex justify-between items-center text-[9px] text-subtle mt-auto">
                      <span>{{ cell.changSheng }}</span>
                      <span>{{ cell.daXianAge }}</span>
                    </div>
                    <div class="mt-0.5 flex justify-between items-center text-[9px]">
                      <span v-if="cell.isCurrentDaXian" class="text-warning">▶ 当前大限</span>
                      <span v-else class="text-transparent">.</span>
                      <span class="liunian-text">{{ cell.liuNianPalaceName }}</span>
                    </div>
                  </div>
                  <!-- 空格子 -->
                  <div v-else class="p-1.5 bg-panel2"></div>
                </template>
              </div>
            </div>
          </div>

          <!-- 功能按钮组 -->
          <div class="flex gap-2 flex-wrap">
            <button
              class="nav-btn-ming px-3 py-1.5 bg-panel3 border rounded-md text-xs font-medium cursor-pointer transition-all duration-150 hover:bg-panel2 text-text"
            >
              {{ UI_LABELS.NAV_MING }}
            </button>
            <button
              class="nav-btn-qianyi px-3 py-1.5 bg-panel3 border rounded-md text-xs font-medium cursor-pointer transition-all duration-150 hover:bg-panel2 text-text"
            >
              {{ UI_LABELS.NAV_QIANYI }}
            </button>
            <button
              class="nav-btn-ke px-3 py-1.5 bg-panel3 border rounded-md text-xs font-medium cursor-pointer transition-all duration-150 hover:bg-panel2 text-text"
            >
              {{ UI_LABELS.NAV_KE }}
            </button>
            <button
              class="nav-btn-jiao px-3 py-1.5 bg-panel3 border rounded-md text-xs font-medium cursor-pointer transition-all duration-150 hover:bg-panel2 text-text"
            >
              {{ UI_LABELS.NAV_JIAO }}
            </button>
          </div>

          <!-- 大限/流年 -->
          <div class="bg-panel3 border border-border rounded-lg overflow-hidden">
            <div class="flex border-b border-border last:border-b-0">
              <span
                class="w-[60px] shrink-0 p-2.5 bg-panel2 text-[11px] font-semibold text-text flex items-center"
                >{{ UI_LABELS.TIMELINE_DAXIAN }}</span
              >
              <div class="flex flex-1 overflow-x-auto">
                <div
                  v-for="(item, idx) in daXianTimeline"
                  :key="'dx-' + idx"
                  class="flex-1 min-w-[60px] p-2 border-l border-border text-center"
                >
                  <span class="block text-[10px] font-semibold text-text">{{ item.range }}</span>
                  <span class="block text-[9px] text-subtle mt-0.5 font-mono">{{
                    item.branch
                  }}</span>
                </div>
              </div>
            </div>
            <div class="flex">
              <span
                class="w-[60px] shrink-0 p-2.5 bg-panel2 text-[11px] font-semibold text-text flex items-center"
                >{{ UI_LABELS.TIMELINE_LIUNIAN }}</span
              >
              <div class="flex flex-1 overflow-x-auto">
                <div
                  v-for="(item, idx) in liuNianTimeline"
                  :key="'ln-' + idx"
                  class="flex-1 min-w-[60px] p-2 border-l border-border text-center"
                >
                  <span class="block text-[10px] font-semibold text-text">{{ item.year }}年</span>
                  <span class="block text-[9px] text-subtle mt-0.5 font-mono">{{
                    item.ganzhi
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <ChartLegend />
        </div>
      </main>

      <!-- 右栏：AI 功能面板 -->
      <aside class="flex flex-col p-4 bg-panel border-l border-border overflow-y-auto">
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
            class="btn-secondary w-full gap-2 text-sm"
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

/* 4×4 宫格 */
.ziwei-board {
  width: min(92vw, 820px);
  aspect-ratio: 1 / 1;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
}

.palace-cell {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.palace-cell:hover {
  opacity: 0.85;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-link) 45%, transparent);
  transform: translateY(-1px);
}

.palace-shen {
  background: color-mix(in srgb, var(--color-link) 10%, var(--color-panel-3));
}

.palace-daxian-active {
  background: var(--color-daxian-active-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-hua-lu) 35%, transparent);
}

.palace-mark {
  border-radius: 3px;
  padding: 0 4px;
  font-size: 9px;
  line-height: 14px;
}

.palace-mark-ming {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
}

.palace-mark-shen {
  color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 14%, transparent);
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

/* Nav button borders via color-mix */
.nav-btn-ming {
  border-color: color-mix(in srgb, var(--color-page-success-alt) 60%, transparent);
}
.nav-btn-qianyi {
  border-color: color-mix(in srgb, var(--color-page-warning-alt) 60%, transparent);
}
.nav-btn-ke {
  border-color: color-mix(in srgb, var(--color-page-link) 60%, transparent);
}
.nav-btn-jiao {
  border-color: color-mix(in srgb, var(--color-purple) 60%, transparent);
}

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

@media (max-width: 1024px) {
  .input-panel,
  .ai-panel {
    display: none;
  }
}

@media (max-width: 600px) {
  .ziwei-board {
    width: 98vw;
    font-size: 10px;
  }
}
</style>
