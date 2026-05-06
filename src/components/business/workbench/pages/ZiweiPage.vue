<!-- [2026-05-06] 紫微斗数命盘页面 - 完整深色主题设计 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { computeZiweiChart, validateBirthDate, validateBirthTime, type ZiweiChart } from '@/features/ziwei/compute'
import { requestZiweiAnalysis } from '@/api/ziwei-analysis'

const router = useRouter()

// ==================== 状态 ====================

const showUserMenu = ref(false)

// 输入表单状态
const calendarType = ref<'solar' | 'lunar'>('solar')
const solarYear = ref('1990')
const solarMonth = ref('06')
const solarDay = ref('15')
const lunarYear = ref('1990')
const lunarMonth = ref('5')
const lunarDay = ref('23')
const lunarLeap = ref(false)
const birthHour = ref('12')
const birthMinute = ref('00')
const gender = ref<'male' | 'female'>('male')
const profileName = ref('')
const school = ref<'traditional' | 'flying'>('traditional')

// 排盘状态
const generating = ref(false)
const status = ref<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })

// 命盘数据
const chart = ref<ZiweiChart | null>(null)

// AI 状态
const aiLoading = ref(false)
const aiError = ref('')
const aiResult = ref<{
  overview: string
  sections: Array<{ title: string; summary: string }>
} | null>(null)
const aiQuestionInput = ref('')
const aiQuestionLoading = ref(false)
const aiQuestionAnswer = ref('')

// ==================== 选项数据 ====================

const yearOptions = computed(() => {
  const years = []
  for (let y = 2010; y >= 1920; y--) years.push(String(y))
  return years
})

const monthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1).padStart(2, '0')
  }))
})

const dayOptions = computed(() => {
  return Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1).padStart(2, '0')
  }))
})

const hourOptions = computed(() => {
  return Array.from({ length: 24 }, (_, i) => ({
    value: String(i).padStart(2, '0'),
    label: `${String(i).padStart(2, '0')}时`
  }))
})

const minuteOptions = computed(() => {
  return Array.from({ length: 60 }, (_, i) => ({
    value: String(i).padStart(2, '0'),
    label: `${String(i).padStart(2, '0')}分`
  }))
})

// 历史命例
const historyExamples = [
  { value: '', label: '快速加载历史命例' },
  { value: '1', label: '示例命例 1' },
  { value: '2', label: '示例命例 2' }
]
const selectedHistory = ref('')

// 当前步骤
const currentStep = computed(() => {
  if (!chart.value) return 1
  if (!aiResult.value) return 2
  return 3
})

const aiButtonLabel = computed(() => {
  if (aiLoading.value) return 'AI 分析中...'
  if (aiResult.value) return '重新生成'
  return 'AI 深度解盘'
})

// ==================== 函数 ====================

function toggleUserMenu(): void {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu(): void {
  showUserMenu.value = false
}

function goBack(): void {
  router.push('/')
}

function clearForm(): void {
  profileName.value = ''
  calendarType.value = 'solar'
  solarYear.value = '1990'
  solarMonth.value = '06'
  solarDay.value = '15'
  birthHour.value = '12'
  birthMinute.value = '00'
  gender.value = 'male'
  chart.value = null
  aiResult.value = null
  status.value = { type: '', text: '' }
}

async function handleGenerate(): Promise<void> {
  generating.value = true
  status.value = { type: '', text: '' }

  try {
    const dateValidation = calendarType.value === 'solar'
      ? validateBirthDate(calendarType.value, solarYear.value, solarMonth.value, solarDay.value)
      : validateBirthDate(calendarType.value, lunarYear.value, lunarMonth.value, lunarDay.value, lunarLeap.value)

    if (!dateValidation.valid) {
      status.value = { type: 'error', text: dateValidation.error || '出生日期无效' }
      return
    }

    const timeValidation = validateBirthTime(birthHour.value, birthMinute.value)
    if (!timeValidation.valid) {
      status.value = { type: 'error', text: timeValidation.error || '出生时间无效' }
      return
    }

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
      clockMode: 'standard',
      timezoneOffset: '8',
      longitude: '120.000',
      xiaoXianRule: 'yearBranch',
      liuNianRule: 'yearForward'
    })

    if (result.ok && result.chart) {
      chart.value = result.chart
      status.value = { type: 'success', text: '排盘完成。' }
    } else {
      status.value = { type: 'error', text: result.error || '排盘失败' }
    }
  } catch (err) {
    status.value = { type: 'error', text: String(err) }
  } finally {
    generating.value = false
  }
}

async function handleAiAnalysis(): Promise<void> {
  if (!chart.value) return

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
  try {
    // TODO: 实际调用 API
    aiQuestionAnswer.value = '问答功能开发中...'
  } finally {
    aiQuestionLoading.value = false
  }
}

// ==================== 命盘辅助函数 ====================

const palaceMap: Record<string, string> = {
  '子': '命宫', '丑': '兄弟', '寅': '夫妻', '卯': '子女',
  '辰': '财帛', '巳': '疾厄', '午': '迁移', '未': '仆役',
  '申': '官禄', '酉': '田宅', '戌': '父母', '亥': '福德'
}

function getPalaceName(branch: string): string {
  return palaceMap[branch] || branch
}

// 星曜类型分类
function getStarType(starName: string): 'main' | 'luck' | 'power' | 'harm' | 'assist' {
  // 主星（甲级星）
  const mainStars = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']
  if (mainStars.includes(starName)) return 'main'

  // 吉星
  const luckStars = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马']
  if (luckStars.includes(starName)) return 'luck'

  // 煞星
  const harmStars = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天空']
  if (harmStars.includes(starName)) return 'harm'

  // 四化
  if (['化禄', '化权', '化科', '化忌'].includes(starName)) return 'power'

  return 'assist'
}

function getStarClass(starType: string): string {
  const map: Record<string, string> = {
    main: 'star-main',
    luck: 'star-luck',
    power: 'star-power',
    harm: 'star-harm',
    assist: 'star-assist'
  }
  return map[starType] || 'star-assist'
}

function getHuaTagClass(hua: string): string {
  const map: Record<string, string> = {
    '禄': 'tag-lu',
    '权': 'tag-quan',
    '科': 'tag-ke',
    '忌': 'tag-ji'
  }
  return map[hua] || ''
}

// 星曜属性（庙旺利平陷）
function getPalaceLevelClass(level: string): string {
  const map: Record<string, string> = {
    '庙': 'level-miao',
    '旺': 'level-wang',
    '利': 'level-li',
    '平': 'level-ping',
    '陷': 'level-xian'
  }
  return map[level] || ''
}

// 4×4 宫格顺序
// 布局:
// 1.寅(夫妻)  2.卯(子女)  3.辰(财帛)  4.巳(疾厄)
// 5.子(命宫)   6.[中央]   7.[中央]    8.午(迁移)
// 9.亥(福德)   10.[中央]  11.[中央]   12.未(仆役)
// 13.戌(父母) 14.酉(田宅) 15.申(官禄) 16.丑(兄弟)
const palaceOrder = [
  '寅', '卯', '辰', '巳',
  '子', null, null, '午',
  '亥', null, null, '未',
  '戌', '酉', '申', '丑'
]

// 构建命盘网格数据
const palaceGrid = computed(() => {
  if (!chart.value?.boardCells) return []

  const cells = chart.value.boardCells

  return palaceOrder.map(branch => {
    if (!branch) return null

    const cell = cells.find(c => c.branch === branch)
    if (!cell) return null

    const allStars: Array<{
      name: string
      type: string
      hua?: string
      level?: string
    }> = []

    // 主星
    ;(cell.mainStars || []).forEach(s => {
      allStars.push({
        name: s.name,
        type: getStarType(s.name),
        hua: s.huaTags?.[0],
        level: s.level
      })
    })

    // 辅星
    ;(cell.assistStars || []).forEach(s => {
      allStars.push({
        name: s.name,
        type: getStarType(s.name)
      })
    })

    // 杂星
    ;(cell.miscStars || []).forEach(s => {
      allStars.push({
        name: s.name,
        type: getStarType(s.name)
      })
    })

    return {
      branch,
      palace: getPalaceName(branch),
      ganzhi: cell.stemBranch || '',
      stars: allStars,
      changSheng: cell.changSheng || '',
      daXianAge: cell.daXian || '',
      isMing: branch === chart.value?.center?.mingBranch,
      isShen: branch === chart.value?.center?.shenBranch
    }
  })
})

// 中央信息区数据
const centerInfo = computed(() => {
  if (!chart.value?.center) return null
  const c = chart.value.center

  // 计算当前年龄
  let age = ''
  if (c.yearGanZhi) {
    const birthYear = parseInt(calendarType.value === 'solar' ? solarYear.value : lunarYear.value)
    const currentYear = new Date().getFullYear()
    age = String(currentYear - birthYear)
  }

  return {
    yearGanzhi: c.yearGanZhi || '',
    bureau: c.bureauLabel || '',
    gender: c.genderLabel || '',
    lunar: c.lunarText || '',
    yinYang: c.naYinLabel || '',
    mingZhu: c.mingZhu || '',
    mingBranch: c.mingBranch || '',
    shenBranch: c.shenBranch || '',
    shenZhu: c.shenZhu || '',
    age: age,
    currentYear: new Date().getFullYear()
  }
})

// 元信息（标题行右侧）
const chartMeta = computed(() => {
  if (!centerInfo.value) return ''
  return `${centerInfo.value.yearGanzhi}·${centerInfo.value.bureau}·${centerInfo.value.gender}命`
})

// 大限数据（10个年龄段）
const daXianTimeline = computed(() => {
  const timeline = chart.value?.daXianTimeline || []
  return timeline.slice(0, 10)
})

// 流年数据
const liuNianTimeline = computed(() => {
  const timeline = chart.value?.liuNianTimeline || []
  return timeline.slice(0, 12)
})
</script>

<template>
  <div class="ziwei-page">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <div class="header-left">
        <div class="header-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 2C12 2 14 6 14 12C14 18 12 22 12 22" stroke="currentColor" stroke-width="2"/>
            <path d="M2 12C2 12 6 14 12 14C18 14 22 12 22 12" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        <div class="header-title-group">
          <h1 class="header-title">紫微斗数命盘</h1>
          <span class="header-subtitle">公历／农历输入，自动排出完整方盘命盘</span>
        </div>
      </div>

      <div class="header-right">
        <button class="btn-back" @click="goBack">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5L5 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>返回首页</span>
        </button>

        <div class="menu-wrapper">
          <button class="btn-menu" @click="toggleUserMenu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>

          <Transition name="fade">
            <div v-if="showUserMenu" class="user-menu" @click.stop>
              <div class="user-info">
                <div class="user-avatar">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
                    <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="user-details">
                  <span class="user-name">开发者</span>
                  <span class="user-email">developer@local.dev</span>
                </div>
              </div>
              <div class="menu-divider"></div>
              <button class="menu-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M16 17L21 12L16 7M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>退出登录</span>
              </button>
            </div>
          </Transition>
          <div v-if="showUserMenu" class="menu-backdrop" @click="closeUserMenu"></div>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="page-content">
      <!-- ==================== 左栏：输入面板 ==================== -->
      <aside class="input-panel">
        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button class="btn-generate" @click="handleGenerate" :disabled="generating">
            排盘
          </button>
          <button class="btn-share" :disabled="!chart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="8" y="14" width="8" height="8" rx="1" stroke="currentColor" stroke-width="2"/>
              <path d="M16 10V18M16 18L12 14M16 18L20 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            分享海报
          </button>
        </div>

        <!-- 步骤指引 -->
        <div class="steps-guide">
          <div class="step-item" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
            <span class="step-num">1</span>
            <span class="step-text">填写出生时间</span>
          </div>
          <div class="step-line"></div>
          <div class="step-item" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
            <span class="step-num">2</span>
            <span class="step-text">点击排盘</span>
          </div>
          <div class="step-line"></div>
          <div class="step-item" :class="{ active: currentStep === 3 }">
            <span class="step-num">3</span>
            <span class="step-text">点击 AI 解读</span>
          </div>
        </div>

        <!-- 出生信息表单 -->
        <div class="form-section">
          <!-- 命主名称 -->
          <div class="form-field">
            <label>命主名称（可选）</label>
            <input type="text" v-model="profileName" placeholder="例如：张明远" />
            <span class="field-hint">用于生成个性化解读</span>
          </div>

          <!-- 历注输入 -->
          <div class="form-field">
            <label>历注输入</label>
            <select v-model="calendarType">
              <option value="solar">公历输入</option>
              <option value="lunar">农历输入</option>
            </select>
          </div>

          <!-- 年份 -->
          <div class="form-field">
            <label>{{ calendarType === 'solar' ? '公历年份' : '农历年份' }}</label>
            <select v-if="calendarType === 'solar'" v-model="solarYear">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
            <select v-else v-model="lunarYear">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
          </div>

          <!-- 月份/日期 -->
          <div class="form-row">
            <div class="form-field">
              <label>{{ calendarType === 'solar' ? '月份' : '农历月份' }}</label>
              <select v-if="calendarType === 'solar'" v-model="solarMonth">
                <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}月</option>
              </select>
              <select v-else v-model="lunarMonth">
                <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}月</option>
              </select>
            </div>
            <div class="form-field">
              <label>{{ calendarType === 'solar' ? '日期' : '农历日期' }}</label>
              <select v-if="calendarType === 'solar'" v-model="solarDay">
                <option v-for="d in dayOptions" :key="d.value" :value="d.value">{{ d.label }}日</option>
              </select>
              <select v-else v-model="lunarDay">
                <option v-for="d in dayOptions" :key="d.value" :value="d.value">{{ d.label }}日</option>
              </select>
            </div>
          </div>

          <!-- 出生时间 -->
          <div class="form-row">
            <div class="form-field">
              <label>出生小时(24h)</label>
              <select v-model="birthHour">
                <option v-for="h in hourOptions" :key="h.value" :value="h.value">{{ h.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>出生分钟</label>
              <select v-model="birthMinute">
                <option v-for="m in minuteOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
          </div>

          <!-- 性别 -->
          <div class="form-field">
            <label>性别</label>
            <div class="radio-group">
              <label class="radio-item" :class="{ active: gender === 'male' }">
                <input type="radio" v-model="gender" value="male" />
                <span class="radio-circle"></span>
                <span>男</span>
              </label>
              <label class="radio-item" :class="{ active: gender === 'female' }">
                <input type="radio" v-model="gender" value="female" />
                <span class="radio-circle"></span>
                <span>女</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 历史命例 -->
        <div class="history-section">
          <div class="history-row">
            <select v-model="selectedHistory" class="history-select">
              <option v-for="h in historyExamples" :key="h.value" :value="h.value">{{ h.label }}</option>
            </select>
            <button class="btn-clear" @click="clearForm">清空</button>
          </div>
        </div>

        <!-- 状态提示 -->
        <Transition name="slide-fade">
          <div v-if="status.text && status.type === 'success'" class="status-toast success">
            {{ status.text }}
          </div>
        </Transition>
      </aside>

      <!-- ==================== 中栏：命盘主区域 ==================== -->
      <main class="chart-panel">
        <div v-if="!chart" class="empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 2C12 2 14 6 14 12C14 18 12 22 12 22" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 12C2 12 6 14 12 14C18 14 22 12 22 12" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
          <h3>等待排盘</h3>
          <p>填写出生信息后点击「排盘」按钮<br/>将生成完整紫微斗数方盘</p>
        </div>

        <div v-else class="chart-content">
          <!-- 标题行 -->
          <div class="chart-header">
            <h2 class="chart-title">图片命盘</h2>
            <span class="chart-meta">{{ chartMeta }}</span>
          </div>

          <!-- 命盘区域 -->
          <div class="board-wrapper">
            <div class="board-container">
              <!-- 方位标注 -->
              <div class="compass-label compass-top">正南方</div>
              <div class="compass-label compass-right">正西方</div>
              <div class="compass-label compass-bottom">正北方</div>
              <div class="compass-label compass-left">正东方</div>

              <!-- 4×4 宫格 -->
              <div class="ziwei-board">
                <template v-for="(cell, index) in palaceGrid" :key="'cell-' + index">
                  <!-- 中央区域 -->
                  <div v-if="index === 5 || index === 6 || index === 9 || index === 10" class="palace center-area">
                    <div v-if="index === 6 || index === 9" class="center-info">
                      <div v-if="index === 6" class="center-main">
                        <span class="center-yinyang">{{ centerInfo?.yinYang?.charAt(0) || '阴' }}</span>
                        <span class="center-bureau">{{ centerInfo?.bureau }}</span>
                        <span class="center-gender">{{ centerInfo?.gender }}</span>
                      </div>
                      <div v-if="index === 6" class="center-details">
                        <p>命主：{{ centerInfo?.mingZhu || '--' }}</p>
                        <p>命宫：{{ centerInfo?.mingBranch || '--' }}宫</p>
                        <p>身宫：{{ centerInfo?.shenBranch || '--' }}宫</p>
                        <p class="center-year">{{ centerInfo?.currentYear }}年·{{ centerInfo?.age }}岁</p>
                      </div>
                      <div v-if="index === 9" class="center-lunar">
                        <p>{{ centerInfo?.lunar || '--' }}</p>
                        <p class="center-name">命主：{{ profileName || '--' }}</p>
                      </div>
                    </div>
                  </div>
                  <!-- 十二宫格 -->
                  <div v-else-if="cell" class="palace" :class="{ 'palace-ming': cell.isMing, 'palace-shen': cell.isShen }">
                    <div class="palace-header">
                      <span class="palace-name">{{ cell.palace }}</span>
                      <span class="palace-ganzhi">{{ cell.ganzhi }}</span>
                    </div>
                    <div class="palace-stars">
                      <div v-for="(star, sIdx) in cell.stars.slice(0, 5)" :key="'star-' + sIdx" class="star-row">
                        <span class="star-item" :class="getStarClass(star.type)">
                          <span class="star-name">{{ star.name }}</span>
                          <span v-if="star.hua" class="star-hua-tag" :class="getHuaTagClass(star.hua)">{{ star.hua }}</span>
                        </span>
                        <span v-if="star.level" class="star-level" :class="getPalaceLevelClass(star.level)">{{ star.level }}</span>
                      </div>
                    </div>
                    <div class="palace-footer">
                      <span class="palace-changsheng">{{ cell.changSheng }}</span>
                      <span class="palace-daxian">{{ cell.daXianAge }}</span>
                    </div>
                  </div>
                  <!-- 空格子 -->
                  <div v-else class="palace empty-palace"></div>
                </template>
              </div>
            </div>
          </div>

          <!-- 功能按钮组 -->
          <div class="chart-nav-btns">
            <button class="nav-btn ming">命宫</button>
            <button class="nav-btn qianyi">迁移宫</button>
            <button class="nav-btn ke">科天梁</button>
            <button class="nav-btn jiao">全交图</button>
          </div>

          <!-- 大限/流年行 -->
          <div class="timeline-section">
            <div class="timeline-row">
              <span class="timeline-label">大限</span>
              <div class="timeline-cells">
                <div v-for="(item, idx) in daXianTimeline" :key="'dx-' + idx" class="timeline-cell">
                  <span class="cell-age">{{ item.range }}</span>
                  <span class="cell-branch">{{ item.branch }}</span>
                </div>
              </div>
            </div>
            <div class="timeline-row">
              <span class="timeline-label">流年</span>
              <div class="timeline-cells">
                <div v-for="(item, idx) in liuNianTimeline" :key="'ln-' + idx" class="timeline-cell">
                  <span class="cell-year">{{ item.year }}年</span>
                  <span class="cell-ganzhi">{{ item.ganzhi }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- ==================== 右栏：AI 功能面板 ==================== -->
      <aside class="ai-panel">
        <div class="ai-badge">AI POWERED</div>

        <div class="ai-section">
          <h3 class="ai-title">AI 个性化解盘</h3>
          <p class="ai-desc">{{ aiResult ? '已生成' : '基于当前命盘信息生成，未生成' }}</p>

          <button class="btn-ai" @click="handleAiAnalysis" :disabled="!chart || aiLoading">
            <span v-if="aiLoading" class="loading-dot"></span>
            {{ aiButtonLabel }}
          </button>

          <p class="ai-disclaimer">本分析仅供参考娱乐，不代代专业建议。</p>
        </div>

        <div class="ai-divider"></div>

        <div class="qa-section">
          <h4 class="qa-title">向 AI 命盘问问</h4>
          <p class="qa-desc">可直接输入问题，或点击查看推荐提问问题</p>

          <div class="qa-input-row">
            <input
              type="text"
              v-model="aiQuestionInput"
              placeholder="输入你的问题..."
              :disabled="!aiResult"
            />
            <button class="btn-send" :disabled="!aiResult || !aiQuestionInput.trim()" @click="handleAiQuestion">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <p class="qa-hint">{{ aiResult ? '已生成 AI 解盘，可以开始提问' : '先点击"排盘"，再生成 AI 深度解盘' }}</p>

          <!-- AI 回答 -->
          <div v-if="aiQuestionAnswer" class="ai-answer">
            <p>{{ aiQuestionAnswer }}</p>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* ==================== 页面布局 ==================== */
.ziwei-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #0d1117;
  color: #e6edf3;
}

/* ==================== 顶部导航栏 ==================== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(88, 166, 255, 0.15);
  border-radius: 10px;
  color: #58a6ff;
}

.header-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f0f6fc;
}

.header-subtitle {
  font-size: 12px;
  color: #8b949e;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
}

.btn-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-menu:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #c9d1d9;
}

/* 用户菜单 */
.menu-wrapper {
  position: relative;
}

.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(88, 166, 255, 0.15);
  border-radius: 50%;
  color: #58a6ff;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #f0f6fc;
}

.user-email {
  font-size: 12px;
  color: #8b949e;
}

.menu-divider {
  height: 1px;
  background: #30363d;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.menu-item svg {
  color: #8b949e;
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* ==================== 主内容区 ==================== */
.page-content {
  flex: 1;
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  overflow: hidden;
}

/* ==================== 左栏：输入面板 ==================== */
.input-panel {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #161b22;
  border-right: 1px solid #30363d;
  overflow-y: auto;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.btn-generate {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: #1f6feb;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-generate:hover:not(:disabled) {
  background: #388bfd;
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-share {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-share:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
  color: #c9d1d9;
}

.btn-share:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 步骤指引 */
.steps-guide {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #0d1117;
  border-radius: 8px;
  margin-bottom: 16px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #30363d;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: #8b949e;
  transition: all 0.2s;
}

.step-item.active .step-num {
  background: #1f6feb;
  color: #fff;
}

.step-item.completed .step-num {
  background: #238636;
  color: #fff;
}

.step-text {
  font-size: 10px;
  color: #8b949e;
  text-align: center;
}

.step-item.active .step-text {
  color: #c9d1d9;
}

.step-line {
  flex: 1;
  height: 1px;
  background: #30363d;
  margin: 0 4px;
  margin-bottom: 16px;
}

/* 表单 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 12px;
  color: #8b949e;
}

.form-field input,
.form-field select {
  padding: 8px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #f0f6fc;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.form-field input:focus,
.form-field select:focus {
  border-color: #58a6ff;
}

.form-field input::placeholder {
  color: #484f58;
}

.form-field select option {
  background: #161b22;
}

.field-hint {
  font-size: 10px;
  color: #6e7681;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* 性别单选 */
.radio-group {
  display: flex;
  gap: 8px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.radio-item input {
  display: none;
}

.radio-circle {
  width: 16px;
  height: 16px;
  border: 2px solid #30363d;
  border-radius: 50%;
  transition: all 0.15s;
}

.radio-item.active {
  border-color: #1f6feb;
  background: rgba(31, 111, 235, 0.1);
  color: #58a6ff;
}

.radio-item.active .radio-circle {
  border-color: #1f6feb;
  background: #1f6feb;
  box-shadow: inset 0 0 0 3px #0d1117;
}

/* 历史命例 */
.history-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #21262d;
}

.history-row {
  display: flex;
  gap: 8px;
}

.history-select {
  flex: 1;
  padding: 8px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #f0f6fc;
  font-size: 12px;
  outline: none;
}

.history-select option {
  background: #161b22;
}

.btn-clear {
  padding: 8px 12px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-clear:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
}

/* 状态提示 */
.status-toast {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 12px;
}

.status-toast.success {
  background: rgba(46, 160, 67, 0.12);
  color: #3fb950;
}

/* ==================== 中栏：命盘主区域 ==================== */
.chart-panel {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: #0d1117;
  overflow-y: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
}

.empty-icon {
  color: #30363d;
}

.empty-state h3 {
  margin: 0;
  font-size: 18px;
  color: #f0f6fc;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: #8b949e;
  line-height: 1.6;
}

.chart-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f0f6fc;
}

.chart-meta {
  font-size: 13px;
  color: #8b949e;
}

/* 命盘区域 */
.board-wrapper {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.board-container {
  position: relative;
  padding: 24px;
}

/* 方位标注 */
.compass-label {
  position: absolute;
  font-size: 11px;
  color: #6e7681;
}

.compass-top {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.compass-bottom {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.compass-left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.compass-right {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

/* 4×4 宫格 */
.ziwei-board {
  display: grid;
  grid-template-columns: repeat(4, 110px);
  grid-template-rows: repeat(4, 110px);
  border: 1px solid #30363d;
  background: #30363d;
  gap: 1px;
}

.palace {
  display: flex;
  flex-direction: column;
  padding: 6px 8px;
  background: #161b22;
  font-size: 10px;
}

.palace.palace-ming {
  border: 2px solid #1f6feb;
  z-index: 1;
}

.palace.palace-shen {
  background: rgba(88, 166, 255, 0.05);
}

.palace.center-area {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1f26;
}

.palace.empty-palace {
  background: #1a1f26;
}

.palace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}

.palace-name {
  font-weight: 600;
  color: #f0f6fc;
  font-size: 11px;
}

.palace-ganzhi {
  font-size: 9px;
  color: #8b949e;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, serif;
}

.palace-stars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.star-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.star-name {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, serif;
  font-size: 10px;
}

/* 星曜颜色 */
.star-main .star-name {
  color: #f85149;
}

.star-main .star-name::before {
  content: '★';
  margin-right: 1px;
}

.star-luck .star-name {
  color: #3fb950;
}

.star-power .star-name {
  color: #f0883e;
}

.star-harm .star-name {
  color: #f0883e;
}

.star-assist .star-name {
  color: #58a6ff;
  font-size: 9px;
}

/* 四化标签 */
.star-hua-tag {
  font-size: 8px;
  padding: 0 3px;
  border-radius: 3px;
  color: #fff;
}

.tag-lu {
  background: #3fb950;
}

.tag-quan {
  background: #f0883e;
}

.tag-ke {
  background: #58a6ff;
}

.tag-ji {
  background: #f85149;
}

/* 星曜属性标签 */
.star-level {
  font-size: 8px;
  padding: 0 2px;
  border-radius: 2px;
}

.level-miao {
  background: rgba(63, 185, 80, 0.2);
  color: #3fb950;
}

.level-wang {
  background: rgba(88, 166, 255, 0.2);
  color: #58a6ff;
}

.level-li {
  background: rgba(240, 136, 62, 0.2);
  color: #f0883e;
}

.level-ping {
  background: rgba(139, 148, 158, 0.2);
  color: #8b949e;
}

.level-xian {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
}

.palace-footer {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #6e7681;
  margin-top: auto;
}

/* 中央信息区 */
.center-info {
  text-align: center;
}

.center-main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.center-yinyang {
  font-size: 18px;
  color: #f0883e;
}

.center-bureau {
  font-size: 12px;
  font-weight: 600;
  color: #f0f6fc;
}

.center-gender {
  font-size: 10px;
  color: #8b949e;
}

.center-details {
  font-size: 9px;
  color: #8b949e;
  line-height: 1.6;
}

.center-details p {
  margin: 2px 0;
}

.center-year {
  margin-top: 4px;
  font-size: 10px;
  color: #f0f6fc;
}

.center-lunar {
  font-size: 9px;
  color: #8b949e;
}

.center-lunar p {
  margin: 2px 0;
}

.center-name {
  margin-top: 4px;
  color: #f0f6fc;
}

/* 功能按钮组 */
.chart-nav-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-btn {
  padding: 6px 12px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-btn:hover {
  background: #21262d;
}

.nav-btn.ming {
  color: #3fb950;
  border-color: rgba(63, 185, 80, 0.3);
}

.nav-btn.qianyi {
  color: #f0883e;
  border-color: rgba(240, 136, 62, 0.3);
}

.nav-btn.ke {
  color: #58a6ff;
  border-color: rgba(88, 166, 255, 0.3);
}

.nav-btn.jiao {
  color: #a78bfa;
  border-color: rgba(167, 139, 250, 0.3);
}

/* 大限/流年行 */
.timeline-section {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
}

.timeline-row {
  display: flex;
  border-bottom: 1px solid #30363d;
}

.timeline-row:last-child {
  border-bottom: none;
}

.timeline-label {
  width: 60px;
  padding: 10px;
  background: #1a1f26;
  font-size: 11px;
  font-weight: 600;
  color: #8b949e;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.timeline-cells {
  display: flex;
  flex: 1;
  overflow-x: auto;
}

.timeline-cell {
  flex: 1;
  min-width: 60px;
  padding: 8px;
  border-left: 1px solid #30363d;
  text-align: center;
}

.cell-age,
.cell-year {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #f0f6fc;
}

.cell-branch,
.cell-ganzhi {
  display: block;
  font-size: 9px;
  color: #8b949e;
  margin-top: 2px;
  font-family: 'JetBrains Mono', monospace;
}

/* ==================== 右栏：AI 功能面板 ==================== */
.ai-panel {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #161b22;
  border-left: 1px solid #30363d;
  overflow-y: auto;
}

.ai-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 4px;
  letter-spacing: 0.05em;
  align-self: flex-start;
  margin-bottom: 16px;
}

.ai-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
}

.ai-desc {
  margin: 0;
  font-size: 12px;
  color: #8b949e;
}

.btn-ai {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ai:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
}

.btn-ai:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-dot {
  width: 8px;
  height: 8px;
  background: #58a6ff;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ai-disclaimer {
  margin: 0;
  padding: 10px 12px;
  background: rgba(88, 166, 255, 0.05);
  border: 1px solid rgba(88, 166, 255, 0.15);
  border-radius: 6px;
  font-size: 11px;
  color: #8b949e;
  line-height: 1.5;
}

.ai-divider {
  height: 1px;
  background: #21262d;
  margin: 16px 0;
}

.qa-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qa-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f0f6fc;
}

.qa-desc {
  margin: 0;
  font-size: 12px;
  color: #8b949e;
}

.qa-input-row {
  display: flex;
  gap: 8px;
}

.qa-input-row input {
  flex: 1;
  padding: 10px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #f0f6fc;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.qa-input-row input:focus {
  border-color: #58a6ff;
}

.qa-input-row input::placeholder {
  color: #484f58;
}

.qa-input-row input:disabled {
  opacity: 0.5;
}

.btn-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  background: #1f6feb;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-send:hover:not(:disabled) {
  background: #388bfd;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qa-hint {
  margin: 0;
  font-size: 11px;
  color: #6e7681;
}

.ai-answer {
  margin-top: 12px;
  padding: 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 12px;
  color: #f0f6fc;
  line-height: 1.6;
}

/* ==================== 过渡动画 ==================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
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

/* ==================== 响应式 ==================== */
@media (max-width: 1200px) {
  .page-content {
    grid-template-columns: 220px 1fr 260px;
  }
}

@media (max-width: 1024px) {
  .page-content {
    grid-template-columns: 1fr;
  }

  .input-panel,
  .ai-panel {
    display: none;
  }

  .chart-panel {
    flex: 1;
  }
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
