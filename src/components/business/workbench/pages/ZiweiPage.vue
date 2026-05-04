<!-- [2026-05-04] 新增：紫微斗数命盘页面 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClipboard } from '@/composables/useClipboard'
import { computeZiweiChart, validateBirthDate, validateBirthTime, type ZiweiChart } from '@/features/ziwei/compute'
import { requestZiweiAnalysis } from '@/api/ziwei-analysis'

const { copyToClipboard } = useClipboard()

// Form state
const calendarType = ref<'solar' | 'lunar'>('solar')
const solarYear = ref('1990')
const solarMonth = ref('01')
const solarDay = ref('01')
const lunarYear = ref('1990')
const lunarMonth = ref('1')
const lunarDay = ref('1')
const lunarLeap = ref(false)
const birthHour = ref('12')
const birthMinute = ref('00')
const gender = ref<'male' | 'female'>('male')
const profileName = ref('')
const school = ref<'traditional' | 'flying'>('traditional')
const advancedOpen = ref(false)
const clockMode = ref('standard')
const timezoneOffset = ref('8')
const longitude = ref('120.000')
const xiaoXianRule = ref('yearBranch')
const liuNianRule = ref('yearForward')

// Chart state
const chart = ref<ZiweiChart | null>(null)
const generating = ref(false)
const status = ref<{ type: string; text: string }>({ type: 'info', text: '' })
const copyDone = ref(false)

// AI state
const aiLoading = ref(false)
const aiError = ref('')
const aiResult = ref<{
  overview: string
  sections: Array<{ title: string; summary: string; evidence?: string[]; advice?: string[] }>
  yearFocus?: { summary: string; opportunities?: string[]; risks?: string[] }
} | null>(null)
const aiQuestionInput = ref('')
const aiQuestionAnswer = ref('')
const aiQuestionLoading = ref(false)
const aiQuestionSuggestionsOpen = ref(false)
const aiCopyDone = ref(false)

// Computed
const yearOptions = computed(() => {
  const years = []
  for (let y = 2100; y >= 1900; y--) years.push(String(y))
  return years
})

const monthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => {
    const v = String(i + 1).padStart(2, '0')
    return { value: v, label: v }
  })
})

const hourOptions = computed(() => {
  return Array.from({ length: 24 }, (_, i) => {
    const v = String(i).padStart(2, '0')
    const label = i === 0 ? '子时（23-01）' :
      i === 1 ? '丑时（01-03）' :
      i === 2 ? '寅时（03-05）' :
      i === 3 ? '卯时（05-07）' :
      i === 4 ? '辰时（07-09）' :
      i === 5 ? '巳时（09-11）' :
      i === 6 ? '午时（11-13）' :
      i === 7 ? '未时（13-15）' :
      i === 8 ? '申时（15-17）' :
      i === 9 ? '酉时（17-19）' :
      i === 10 ? '戌时（19-21）' :
      i === 11 ? '亥时（21-23）' :
      `${v}:00`
    return { value: v, label }
  })
})

const minuteOptions = computed(() => {
  return Array.from({ length: 60 }, (_, i) => {
    return { value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }
  })
})

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
]

const schoolOptions = [
  { value: 'traditional', label: '传统四化' },
  { value: 'flying', label: '飞星四化' }
]

const clockModeOptions = [
  { value: 'standard', label: '标准时间' },
  { value: 'trueSolar', label: '真太阳时' }
]

const timezoneOptions = [
  { value: '8', label: 'UTC+8 北京' },
  { value: '7', label: 'UTC+7' },
  { value: '9', label: 'UTC+9' }
]

const xiaoXianOptions = [
  { value: 'yearBranch', label: '年支起小限（默认）' },
  { value: 'mingStart', label: '命宫起小限' }
]

const liuNianOptions = [
  { value: 'yearForward', label: '年支顺排' },
  { value: 'followDaXian', label: '随大限顺逆' }
]

const generateButtonLabel = computed(() => generating.value ? '排盘中...' : '排盘')

const aiButtonLabel = computed(() => {
  if (aiLoading.value) return 'AI 分析中...'
  if (aiResult.value) return '重新生成'
  return 'AI 深度解盘'
})

// Actions
async function handleGenerate(): Promise<void> {
  generating.value = true
  status.value = { type: 'info', text: '正在排盘...' }

  try {
    // Validate birth date
    const dateValidation = calendarType.value === 'solar'
      ? validateBirthDate(calendarType.value, solarYear.value, solarMonth.value, solarDay.value)
      : validateBirthDate(calendarType.value, lunarYear.value, lunarMonth.value, lunarDay.value, lunarLeap.value)

    if (!dateValidation.valid) {
      status.value = { type: 'error', text: dateValidation.error || '出生日期无效' }
      return
    }

    // Validate birth time
    const timeValidation = validateBirthTime(birthHour.value, birthMinute.value)
    if (!timeValidation.valid) {
      status.value = { type: 'error', text: timeValidation.error || '出生时间无效' }
      return
    }

    // Compute chart
    const result = computeZiweiChart({
      calendarType: calendarType.value,
      solarYear: solarYear.value,
      solarMonth: solarMonth.value,
      solarDay: solarDay.value,
      lunarYear: lunarYear.value,
      lunarMonth: lunarMonth.value,
      lunarDay: lunarDay.value,
      lunarLeap: lunarLeap.value,
      birthHour: birthHour.value,
      birthMinute: birthMinute.value,
      gender: gender.value,
      school: school.value,
      clockMode: clockMode.value as 'standard' | 'trueSolar',
      timezoneOffset: timezoneOffset.value,
      longitude: longitude.value,
      xiaoXianRule: xiaoXianRule.value,
      liuNianRule: liuNianRule.value
    })

    if (result.ok && result.chart) {
      chart.value = result.chart
      status.value = { type: 'success', text: '排盘完成' }
    } else {
      status.value = { type: 'error', text: result.error || '排盘失败' }
    }
  } catch (err) {
    status.value = { type: 'error', text: String(err) }
  } finally {
    generating.value = false
  }
}

async function handleCopy(): Promise<void> {
  if (!chart.value?.text) return
  const success = await copyToClipboard(chart.value.text)
  if (success) {
    copyDone.value = true
    setTimeout(() => { copyDone.value = false }, 2000)
  }
}

async function handleAiAnalysis(): Promise<void> {
  if (!chart.value) {
    aiError.value = '请先完成排盘'
    return
  }

  aiLoading.value = true
  aiError.value = ''

  try {
    const result = await requestZiweiAnalysis({
      chart: chart.value,
      profileName: profileName.value,
      gender: gender.value,
      school: school.value
    })

    if (result.ok && result.data) {
      aiResult.value = result.data
    } else {
      aiError.value = result.error || 'AI 分析失败'
    }
  } catch (err) {
    aiError.value = String(err)
  } finally {
    aiLoading.value = false
  }
}

async function handleAiQuestion(): Promise<void> {
  if (!aiQuestionInput.value.trim() || !aiResult.value) return
  aiQuestionLoading.value = true
  // TODO(@future): Implement QA endpoint - POST /ziwei-qa with chart context and question
  // Current implementation shows placeholder message
  setTimeout(() => {
    aiQuestionAnswer.value = '问答功能开发中...'
    aiQuestionLoading.value = false
  }, 1500)
}

const palaceAreaClass = (cell: Record<string, unknown>): string => {
  const area = String(cell.area || '')
  const isMing = cell.isMing ? 'ming' : ''
  const isShen = cell.isShen ? 'shen' : ''
  return [area, isMing, isShen].filter(Boolean).join(' ')
}

const branchName = (branch: string): string => {
  const map: Record<string, string> = {
    '子': '命宫', '丑': '兄弟', '寅': '夫妻', '卯': '子女',
    '辰': '财帛', '巳': '疾厄', '午': '迁移', '未': '仆役',
    '申': '官禄', '酉': '田宅', '戌': '父母', '亥': '福德'
  }
  return map[branch] || branch
}
</script>

<template>
  <div class="ziwei-page">
    <div class="ziwei-layout">
      <!-- Left Sidebar - Input Form -->
      <aside class="ziwei-input-card">
        <div class="ziwei-actions ziwei-actions-top">
          <button class="idtool-btn primary" :disabled="generating" @click="handleGenerate">
            {{ generateButtonLabel }}
          </button>
        </div>

        <div class="ziwei-left-scroll">
          <!-- Steps -->
          <section class="ziwei-left-section">
            <div class="ziwei-input-head">
              <h3 class="ziwei-input-title">排盘步骤</h3>
              <div class="ziwei-flow">
                <span class="ziwei-flow-step"><em>1</em><b>填写出生时间</b></span>
                <span class="ziwei-flow-step"><em>2</em><b>点击排盘</b></span>
                <span class="ziwei-flow-step"><em>3</em><b>点击 AI 解读</b></span>
              </div>
            </div>
          </section>

          <!-- Birth Info -->
          <section class="ziwei-left-section">
            <div class="ziwei-input-head">
              <h3 class="ziwei-input-title">出生信息</h3>
            </div>
            <div class="ziwei-form-grid">
              <label class="idtool-field full">
                <span>命例名称（可选）</span>
                <input type="text" v-model="profileName" maxlength="64" placeholder="例如：张明远 1990-06-15" />
              </label>

              <label class="idtool-field full">
                <span>历法输入</span>
                <select v-model="calendarType">
                  <option value="solar">公历输入</option>
                  <option value="lunar">农历输入</option>
                </select>
              </label>

              <template v-if="calendarType === 'solar'">
                <label class="idtool-field full">
                  <span>公历年份</span>
                  <select v-model="solarYear">
                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
                  </select>
                </label>
                <label class="idtool-field">
                  <span>月份</span>
                  <select v-model="solarMonth">
                    <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }} 月</option>
                  </select>
                </label>
                <label class="idtool-field">
                  <span>日期</span>
                  <select v-model="solarDay">
                    <option v-for="d in 31" :key="d" :value="String(d).padStart(2, '0')">{{ d }} 日</option>
                  </select>
                </label>
              </template>

              <template v-else>
                <label class="idtool-field full">
                  <span>农历年份</span>
                  <select v-model="lunarYear">
                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
                  </select>
                </label>
                <label class="idtool-field">
                  <span>农历月份</span>
                  <select v-model="lunarMonth">
                    <option v-for="m in 12" :key="m" :value="String(m)">{{ m }} 月</option>
                  </select>
                </label>
                <label class="idtool-field">
                  <span>农历日期</span>
                  <select v-model="lunarDay">
                    <option v-for="d in 30" :key="d" :value="String(d)">{{ d }}</option>
                  </select>
                </label>
                <label class="idtool-field full">
                  <span>闰月</span>
                  <div class="ziwei-leap-row">
                    <label class="idtool-radio">
                      <input type="checkbox" v-model="lunarLeap" />
                      闰月
                    </label>
                  </div>
                </label>
              </template>

              <label class="idtool-field">
                <span>出生小时</span>
                <select v-model="birthHour">
                  <option v-for="h in hourOptions" :key="h.value" :value="h.value">{{ h.label }}</option>
                </select>
              </label>
              <label class="idtool-field">
                <span>出生分钟</span>
                <select v-model="birthMinute">
                  <option v-for="m in minuteOptions" :key="m.value" :value="m.value">{{ m.label }} 分</option>
                </select>
              </label>

              <label class="idtool-field full">
                <span>性别</span>
                <div class="idtool-inline">
                  <label class="idtool-radio" v-for="opt in genderOptions" :key="opt.value">
                    <input type="radio" :value="opt.value" v-model="gender" />
                    {{ opt.label }}
                  </label>
                </div>
              </label>

              <label class="idtool-field full">
                <span>流派模式</span>
                <div class="ziwei-toggle">
                  <button
                    v-for="opt in schoolOptions"
                    :key="opt.value"
                    class="ziwei-toggle-btn"
                    :class="{ active: school === opt.value }"
                    type="button"
                    @click="school = opt.value as 'traditional' | 'flying'"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </label>
            </div>
          </section>

          <!-- Advanced Settings -->
          <section class="ziwei-left-section">
            <div class="ziwei-input-head">
              <h3 class="ziwei-input-title">高级参数</h3>
            </div>
            <button
              class="ziwei-advanced-toggle"
              type="button"
              @click="advancedOpen = !advancedOpen"
            >
              <strong>{{ advancedOpen ? '折叠' : '展示' }}</strong>
            </button>
            <div class="ziwei-form-grid ziwei-advanced-grid" v-if="advancedOpen">
              <label class="idtool-field">
                <span>校时模式</span>
                <select v-model="clockMode">
                  <option v-for="opt in clockModeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <label class="idtool-field">
                <span>时区</span>
                <select v-model="timezoneOffset" :disabled="clockMode !== 'trueSolar'">
                  <option v-for="opt in timezoneOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <label class="idtool-field">
                <span>出生地经度</span>
                <input type="number" step="0.001" min="-180" max="180" v-model="longitude" :disabled="clockMode !== 'trueSolar'" />
              </label>
              <label class="idtool-field">
                <span>小限起法</span>
                <select v-model="xiaoXianRule">
                  <option v-for="opt in xiaoXianOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <label class="idtool-field">
                <span>流年起法</span>
                <select v-model="liuNianRule">
                  <option v-for="opt in liuNianOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <div v-if="status.text" class="idtool-result" :class="status.type">
          {{ status.text }}
        </div>
      </aside>

      <!-- Main Chart Area -->
      <main class="ziwei-chart-wrap">
        <article class="ziwei-empty" v-if="!chart">
          <h4>等待排盘</h4>
          <p>选择出生信息后点击"排盘"，将生成完整紫微斗数方盘。</p>
        </article>

        <section class="ziwei-image-panel" v-else>
          <header class="ziwei-panel-head">
            <h4>图片命盘</h4>
            <span>{{ chart.center?.yearGanZhi }} · {{ chart.center?.bureauLabel }} · {{ chart.center?.genderLabel }}命</span>
          </header>

          <div class="ziwei-board-shell">
            <div class="ziwei-board-compass ziwei-board-compass-top">正南方</div>
            <div class="ziwei-board-compass ziwei-board-compass-right">正西方</div>
            <div class="ziwei-board-compass ziwei-board-compass-bottom">正北方</div>
            <div class="ziwei-board-compass ziwei-board-compass-left">正东方</div>

            <div class="ziwei-board">
              <section
                v-for="cell in chart.boardCells"
                :key="'zw-cell-' + cell.branch"
                class="ziwei-palace"
                :class="palaceAreaClass(cell)"
              >
                <header class="ziwei-palace-head">
                  <span class="ziwei-palace-name">{{ branchName(String(cell.branch)) }}</span>
                  <span class="ziwei-palace-gz">{{ cell.stemBranch }}</span>
                </header>
                <div class="ziwei-star-row main">
                  <span v-if="cell.mainStars?.length" v-for="star in cell.mainStars" :key="star.name" class="ziwei-star-tag">
                    <span class="ziwei-star main"><strong>★{{ star.name }}</strong></span>
                    <span v-if="star.huaTags?.length" v-for="tag in star.huaTags" :key="tag" class="ziwei-hua-tag" :data-hua="tag">{{ tag }}</span>
                  </span>
                  <span v-else class="ziwei-star-placeholder">--</span>
                </div>
                <div class="ziwei-star-row assist">
                  <span v-if="cell.assistStars?.length" v-for="star in cell.assistStars" :key="star.name" class="ziwei-star-tag">
                    <span class="ziwei-star">{{ star.name }}</span>
                  </span>
                  <span v-else class="ziwei-star-placeholder">--</span>
                </div>
                <div class="ziwei-star-row misc">
                  <span v-if="cell.miscStars?.length" v-for="star in cell.miscStars" :key="star.name" class="ziwei-star-tag">
                    <span class="ziwei-star">{{ star.name }}</span>
                  </span>
                  <span v-else class="ziwei-star-placeholder">--</span>
                </div>
                <footer class="ziwei-palace-foot">
                  <span>{{ cell.changSheng || '--' }}</span>
                  <span>{{ cell.daXian }}</span>
                  <span>{{ cell.branch }}</span>
                </footer>
              </section>

              <section class="ziwei-center">
                <h4>命盘信息</h4>
                <div class="ziwei-center-info">
                  <p><strong>姓名：</strong><span>{{ profileName || '--' }}</span></p>
                  <p><strong>五行局：</strong><span>{{ chart.center?.bureauLabel || '--' }}</span></p>
                  <p><strong>农历：</strong><span>{{ chart.center?.lunarText || '--' }}</span></p>
                  <p><strong>身主：</strong><span>{{ chart.center?.shenZhu || '--' }}</span></p>
                  <p><strong>身宫：</strong><span>{{ chart.center?.shenBranch || '--' }}宫</span></p>
                  <p><strong>命主：</strong><span>{{ chart.center?.mingZhu || '--' }}</span></p>
                  <p><strong>命宫：</strong><span>{{ chart.center?.mingBranch || '--' }}宫</span></p>
                  <p><strong>五行：</strong><span>{{ chart.center?.naYinLabel || '--' }}</span></p>
                </div>
                <div class="ziwei-center-actions">
                  <button class="ziwei-center-action-btn" type="button">解命盘</button>
                </div>
              </section>
            </div>
          </div>

          <div class="ziwei-timeline">
            <div class="ziwei-timeline-row">
              <div class="ziwei-timeline-label">大限</div>
              <div class="ziwei-timeline-cell" v-for="item in chart.daXianTimeline" :key="'zw-dx-' + item.range">
                <strong>{{ item.range }}</strong>
                <span>{{ item.branch }} {{ item.palaceName }}</span>
              </div>
            </div>
            <div class="ziwei-timeline-row">
              <div class="ziwei-timeline-label">流年</div>
              <div class="ziwei-timeline-cell" v-for="item in chart.liuNianTimeline" :key="'zw-ln-' + item.year">
                <strong>{{ item.year }}年</strong>
                <span>{{ item.ganzhi }} {{ item.age }}岁</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- Right Sidebar - AI Analysis -->
      <aside class="ziwei-pro-grid">
        <section class="ziwei-pro-card ziwei-ai-card">
          <header class="ziwei-pro-head ziwei-ai-head">
            <p class="ziwei-ai-badge">AI POWERED</p>
            <h4>AI 个性化解盘</h4>
            <span>{{ aiResult ? '已生成' : '未生成' }}</span>
          </header>

          <div class="ziwei-ai-top-actions">
            <button
              class="idtool-btn ghost ziwei-ai-btn"
              :disabled="!chart || aiLoading"
              @click="handleAiAnalysis"
            >
              <span class="ziwei-loading-dot" v-if="aiLoading"></span>
              {{ aiButtonLabel }}
            </button>
          </div>

          <p class="ziwei-ai-disclaimer-top">本分析仅供参考娱乐，不替代专业建议。</p>

          <div class="ziwei-pro-body ziwei-ai-body">
            <p v-if="aiLoading">AI 正在思考中，请稍后...</p>
            <p v-else-if="aiError" class="error">{{ aiError }}</p>
            <p v-else-if="!aiResult">先点击"排盘"，再生成 AI 深度解盘。</p>

            <template v-if="aiResult">
              <p class="ziwei-ai-overview">{{ aiResult.overview }}</p>
              <article class="ziwei-ai-section" v-for="(sec, idx) in aiResult.sections" :key="'ai-sec-' + idx">
                <h5>{{ sec.title }}</h5>
                <p>{{ sec.summary }}</p>
                <p v-if="sec.evidence?.length"><strong>依据：</strong>{{ sec.evidence.join('；') }}</p>
                <p v-if="sec.advice?.length"><strong>建议：</strong>{{ sec.advice.join('；') }}</p>
              </article>

              <div class="ziwei-ai-block" v-if="aiResult.yearFocus">
                <h6>年度焦点</h6>
                <p>{{ aiResult.yearFocus.summary }}</p>
                <p v-if="aiResult.yearFocus.opportunities?.length"><strong>机会：</strong>{{ aiResult.yearFocus.opportunities.join('；') }}</p>
                <p v-if="aiResult.yearFocus.risks?.length"><strong>风险：</strong>{{ aiResult.yearFocus.risks.join('；') }}</p>
              </div>
            </template>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.ziwei-page {
  flex: 1;
  overflow: hidden;
}

.ziwei-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.ziwei-input-card {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-panel);
  overflow: hidden;
}

.ziwei-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.ziwei-actions-top {
  background: var(--color-panel-2);
}

.idtool-btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.idtool-btn.primary {
  background: var(--color-brand-500);
  border-color: var(--color-brand-500);
  color: white;
}

.idtool-btn.ghost {
  background: transparent;
}

.idtool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ziwei-left-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.ziwei-left-section {
  margin-bottom: 16px;
}

.ziwei-input-head {
  margin-bottom: 12px;
}

.ziwei-input-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.ziwei-flow {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-subtle);
}

.ziwei-flow-step {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ziwei-flow-step em {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-brand-500);
  color: white;
  border-radius: 50%;
  font-style: normal;
  font-size: 10px;
}

.ziwei-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ziwei-form-grid .full {
  grid-column: 1 / -1;
}

.idtool-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.idtool-field > span {
  font-size: 11px;
  color: var(--color-text-subtle);
}

.idtool-field select,
.idtool-field input {
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 12px;
}

.idtool-field select:focus,
.idtool-field input:focus {
  outline: none;
  border-color: var(--color-brand-500);
}

.idtool-inline {
  display: flex;
  gap: 12px;
}

.idtool-radio {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
}

.ziwei-toggle {
  display: flex;
  gap: 4px;
}

.ziwei-toggle-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-panel);
  color: var(--color-text-subtle);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.ziwei-toggle-btn.active {
  background: var(--color-brand-500);
  border-color: var(--color-brand-500);
  color: white;
}

.ziwei-leap-row {
  padding: 4px 0;
}

.ziwei-advanced-toggle {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.ziwei-advanced-grid {
  margin-top: 12px;
}

.idtool-result {
  padding: 12px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
}

.idtool-result.info { color: var(--color-text-subtle); }
.idtool-result.success { color: var(--color-success); background: rgba(21, 145, 95, 0.1); }
.idtool-result.error { color: var(--color-danger); background: rgba(214, 69, 69, 0.1); }

/* Main Chart Area */
.ziwei-chart-wrap {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg);
}

.ziwei-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-subtle);
  text-align: center;
}

.ziwei-empty h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--color-text);
}

.ziwei-empty p {
  margin: 0;
  font-size: 13px;
  max-width: 300px;
}

.ziwei-image-panel {
  padding: 16px;
}

.ziwei-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ziwei-panel-head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.ziwei-panel-head span {
  font-size: 12px;
  color: var(--color-text-subtle);
}

.ziwei-board-shell {
  position: relative;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
}

.ziwei-board-compass {
  position: absolute;
  font-size: 10px;
  color: var(--color-text-subtle);
}

.ziwei-board-compass-top { top: 4px; left: 50%; transform: translateX(-50%); }
.ziwei-board-compass-right { right: 4px; top: 50%; transform: translateY(-50%); }
.ziwei-board-compass-bottom { bottom: 4px; left: 50%; transform: translateX(-50%); }
.ziwei-board-compass-left { left: 4px; top: 50%; transform: translateY(-50%); }

.ziwei-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, auto);
  gap: 1px;
  background: var(--color-border);
}

.ziwei-palace {
  background: var(--color-panel);
  padding: 6px;
  min-height: 80px;
  font-size: 10px;
}

.ziwei-palace.ming { border: 2px solid var(--color-brand-500); }
.ziwei-palace.shen { background: var(--color-panel-2); }

.ziwei-palace-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ziwei-palace-name { font-weight: 600; color: var(--color-text); }
.ziwei-palace-gz { color: var(--color-text-subtle); }

.ziwei-star-row {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 2px;
}

.ziwei-star-row.main .ziwei-star { color: #c0392b; }
.ziwei-star-row.assist .ziwei-star { color: #2980b9; }
.ziwei-star-row.misc .ziwei-star { color: #27ae60; font-size: 9px; }

.ziwei-star-tag {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.ziwei-hua-tag {
  padding: 0 2px;
  border-radius: 2px;
  font-size: 8px;
  background: #f39c12;
  color: white;
}

.ziwei-hua-tag[data-hua="禄"] { background: #27ae60; }
.ziwei-hua-tag[data-hua="权"] { background: #e74c3c; }
.ziwei-hua-tag[data-hua="科"] { background: #3498db; }
.ziwei-hua-tag[data-hua="忌"] { background: #8e44ad; }

.ziwei-star-placeholder { color: var(--color-text-subtle); }

.ziwei-palace-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 9px;
  color: var(--color-text-subtle);
}

.ziwei-center {
  grid-column: 2;
  grid-row: 2;
  background: var(--color-panel);
  padding: 8px;
  text-align: center;
  border: 1px solid var(--color-border);
}

.ziwei-center h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.ziwei-center-info {
  font-size: 10px;
  text-align: left;
}

.ziwei-center-info p {
  margin: 2px 0;
}

.ziwei-center-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  justify-content: center;
}

.ziwei-center-action-btn {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  font-size: 10px;
  cursor: pointer;
}

.ziwei-timeline {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.ziwei-timeline-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.ziwei-timeline-row:last-child {
  border-bottom: none;
}

.ziwei-timeline-label {
  width: 60px;
  padding: 8px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-panel-2);
  flex-shrink: 0;
}

.ziwei-timeline-cell {
  flex: 1;
  padding: 6px 8px;
  border-left: 1px solid var(--color-border);
  font-size: 10px;
}

.ziwei-timeline-cell strong {
  display: block;
  color: var(--color-text);
}

.ziwei-timeline-cell span {
  color: var(--color-text-subtle);
}

/* Right Sidebar */
.ziwei-pro-grid {
  width: 300px;
  flex-shrink: 0;
  background: var(--color-panel);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
}

.ziwei-pro-card {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.ziwei-pro-head {
  margin-bottom: 12px;
}

.ziwei-ai-badge {
  display: inline-block;
  padding: 2px 6px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 9px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.ziwei-pro-head h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}

.ziwei-pro-head span {
  font-size: 11px;
  color: var(--color-text-subtle);
}

.ziwei-ai-top-actions {
  margin-bottom: 12px;
}

.ziwei-ai-btn {
  width: 100%;
}

.ziwei-loading-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--color-brand-500);
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ziwei-ai-disclaimer-top {
  padding: 8px;
  background: var(--color-panel-2);
  border-radius: 4px;
  font-size: 10px;
  color: var(--color-text-subtle);
  margin-bottom: 12px;
}

.ziwei-ai-body {
  font-size: 12px;
}

.ziwei-ai-body .error {
  color: var(--color-danger);
}

.ziwei-ai-overview {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 12px;
}

.ziwei-ai-section {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.ziwei-ai-section:last-child {
  border-bottom: none;
}

.ziwei-ai-section h5 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
}

.ziwei-ai-section p {
  margin: 4px 0;
  color: var(--color-text-subtle);
}

.ziwei-ai-block {
  padding: 8px;
  background: var(--color-panel-2);
  border-radius: 4px;
}

.ziwei-ai-block h6 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 1024px) {
  .ziwei-layout {
    flex-direction: column;
  }

  .ziwei-input-card,
  .ziwei-pro-grid {
    width: 100%;
    height: auto;
    max-height: 50vh;
  }
}
</style>
