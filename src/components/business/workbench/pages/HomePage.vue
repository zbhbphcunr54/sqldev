<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { SECTION_MAP } from '../sidebar-menu'
import Icon from '@/components/common/Icon.vue'
import type { WorkbenchPage } from '@/stores/workbench'

const router = useRouter()

interface Step {
  title: string
  desc: string
}

interface FeatureGuide {
  page: WorkbenchPage
  icon: string
  title: string
  summary: string
  steps: Step[]
  linkText: string
}

const features: FeatureGuide[] = [
  {
    page: 'sqlConvert',
    icon: 'grid',
    title: 'SQL 转换',
    summary: '跨数据库 DDL / 函数 / 存储过程 AI 智能互转',
    steps: [
      { title: '选择 SQL 类型', desc: '在工具栏顶部选择 DDL、函数或存储过程，确定要转换的 SQL 类别。' },
      { title: '设置源与目标数据库', desc: '分别选择源数据库（如 Oracle）和目标数据库（如 PostgreSQL），点击中间箭头可快速互换。' },
      { title: '输入 SQL 语句', desc: '在左侧输入框粘贴或手动输入 SQL 代码，也可点击"加载示例"使用预设模板。' },
      { title: '开始转换', desc: '点击"开始转换"按钮或按 Ctrl+Enter，AI 将流式生成转换结果，右侧实时展示。' },
      { title: '查看结果与详情', desc: '转换完成后可复制结果，底部状态栏显示 AI 转换率、准确度评级和耗时详情。' }
    ],
    linkText: '前往使用'
  },
  {
    page: 'idTool',
    icon: 'document',
    title: '证件号码生成与校验',
    summary: '身份证号码和统一社会信用代码的生成与验证',
    steps: [
      { title: '选择证件类型', desc: '页面左侧为身份证工具，右侧为统一社会信用代码（USCC）工具，按需选择。' },
      { title: '设置生成条件', desc: '身份证：选择省、市、区县、出生年月日和性别。USCC：选择登记机关、组织类型和地区。' },
      { title: '点击生成', desc: '点击"生成"按钮，系统按规则计算出合法号码，结果显示在下方并可一键复制。' },
      { title: '校验已有号码', desc: '在校验区输入号码并点击"校验"，系统自动检测格式、出生日期和校验码是否正确。' }
    ],
    linkText: '前往使用'
  },
  {
    page: 'aiConfig',
    icon: 'sparkles',
    title: 'AI 供应商管理',
    summary: '新增、编辑、排序和删除 AI 供应商',
    steps: [
      { title: '查看供应商列表', desc: '进入 AI 助手配置页面，上方卡片区展示所有已添加的供应商，每张卡片显示名称、模型数量和状态。' },
      { title: '新增供应商', desc: '点击"新增供应商"按钮，填写名称、标识、区域（国内/海外）、API 格式和模型列表，保存即可。' },
      { title: '编辑供应商', desc: '点击供应商卡片进入编辑模式，可修改名称、Base URL、区域等信息，也可追加或删除可用模型。' },
      { title: '排序与删除', desc: '长按卡片可拖拽排序，点击卡片右上角删除按钮可移除供应商（需管理员权限）。' }
    ],
    linkText: '前往配置'
  },
  {
    page: 'aiConfig',
    icon: 'lock',
    title: 'KEY 配置与连接测试',
    summary: '为供应商配置 API Key 并验证连通性',
    steps: [
      { title: '进入 Key 管理区', desc: '在 AI 助手配置页面下方可看到 Key 列表表格，管理员管理全局 Key，普通用户管理个人 Key。' },
      { title: '新增 Key', desc: '点击"新增 Key"按钮，选择供应商和模型，填入 API Key 和 Base URL（可选），保存完成配置。' },
      { title: '测试连接', desc: '在 Key 列表的操作列点击"测试"按钮，系统向 AI 发送请求并返回延迟时间或错误信息。' },
      { title: '启用与停用', desc: '通过操作列的启用/停用按钮控制 Key 的激活状态，停用的 Key 不会被 SQL 转换等功能调用。' }
    ],
    linkText: '前往配置'
  },
  {
    page: 'aiConfig',
    icon: 'plus',
    title: '追加模型与删除模型',
    summary: '在同一 Key 下管理多个 AI 模型',
    steps: [
      { title: '找到目标 Key', desc: '在 Key 列表中找到要操作的行，同一 Key 下的多个模型会自动分组显示。' },
      { title: '追加模型', desc: '点击操作列的"+ 模型"按钮，系统弹出模型选择器，仅显示该 Key 尚未配置的模型供选择。' },
      { title: '切换查看模型', desc: '同组 Key 可通过上下箭头切换当前展示的模型，每个模型独立显示状态和测试结果。' },
      { title: '删除模型', desc: '在操作列点击删除按钮可移除单个模型配置，若该 Key 下只剩一个模型则整条记录一并删除。' }
    ],
    linkText: '前往管理'
  },
  {
    page: 'opLogs',
    icon: 'clock-history',
    title: '操作日志',
    summary: 'API 调用记录与审计日志查看',
    steps: [
      { title: '进入日志页面', desc: '在侧边栏点击"操作日志"或通过首页卡片跳转，即可查看所有操作记录列表。' },
      { title: '浏览日志列表', desc: '列表按时间倒序展示，每条记录包含操作类型、时间戳、请求参数摘要和执行状态。' },
      { title: '查看详情', desc: '点击任意记录展开详情面板，可查看完整的请求参数、响应结果和错误信息。' }
    ],
    linkText: '查看日志'
  }
]

const STEP_INTERVAL = 3500
const activeSteps = ref<number[]>(features.map(() => 0))
const paused = ref<boolean[]>(features.map(() => false))
const timers: ReturnType<typeof setInterval>[] = []

function startTimer(idx: number) {
  timers[idx] = setInterval(() => {
    if (!paused.value[idx]) {
      activeSteps.value[idx] = (activeSteps.value[idx] + 1) % features[idx].steps.length
    }
  }, STEP_INTERVAL)
}

function goStep(cardIdx: number, stepIdx: number) {
  activeSteps.value[cardIdx] = stepIdx
  clearInterval(timers[cardIdx])
  startTimer(cardIdx)
}

function pauseCard(idx: number) {
  paused.value[idx] = true
}

function resumeCard(idx: number) {
  paused.value[idx] = false
}

onMounted(() => {
  features.forEach((_, i) => startTimer(i))
})

onBeforeUnmount(() => {
  timers.forEach(clearInterval)
})

function navigateTo(page: WorkbenchPage): void {
  const path = SECTION_MAP[page]
  if (path) router.push(path)
}
</script>

<template>
  <div class="hp-page">
    <div class="hp-top-bar">
      <h1 class="hp-title">首页</h1>
      <p class="hp-subtitle">功能导航与使用指引</p>
    </div>

    <main class="hp-content">
      <section class="hp-welcome">
        <h2 class="hp-welcome-heading">欢迎使用 Dev Studio</h2>
        <p class="hp-welcome-desc">
          Dev Studio 是一套面向开发者的在线工具集，提供 SQL 跨数据库转换、证件号码生成与校验、AI
          供应商与模型管理等功能。下方每张卡片展示了对应功能的操作步骤，点击卡片可直接跳转。
        </p>
      </section>

      <section class="hp-grid">
        <div
          v-for="(feat, fi) in features"
          :key="feat.title"
          class="hp-card"
          @mouseenter="pauseCard(fi)"
          @mouseleave="resumeCard(fi)"
        >
          <!-- Header -->
          <div class="hp-card-header">
            <span class="hp-card-icon">
              <Icon :name="feat.icon" :size="20" />
            </span>
            <div class="hp-card-header-text">
              <h3 class="hp-card-title">{{ feat.title }}</h3>
              <p class="hp-card-summary">{{ feat.summary }}</p>
            </div>
          </div>

          <!-- Steps carousel -->
          <div class="hp-steps-area">
            <TransitionGroup name="hp-step-fade" tag="div" class="hp-step-viewport">
              <div
                v-for="(step, si) in feat.steps"
                v-show="activeSteps[fi] === si"
                :key="si"
                class="hp-step"
              >
                <span class="hp-step-num">{{ si + 1 }}</span>
                <div class="hp-step-body">
                  <span class="hp-step-title">{{ step.title }}</span>
                  <p class="hp-step-desc">{{ step.desc }}</p>
                </div>
              </div>
            </TransitionGroup>
          </div>

          <!-- Footer: dots + link -->
          <div class="hp-card-footer">
            <div class="hp-dots">
              <button
                v-for="(_, si) in feat.steps"
                :key="si"
                class="hp-dot"
                :class="{ 'hp-dot--active': activeSteps[fi] === si }"
                @click.stop="goStep(fi, si)"
              >
                <span class="hp-dot-fill" :class="{ 'hp-dot-fill--running': activeSteps[fi] === si && !paused[fi] }" />
              </button>
            </div>
            <button class="hp-card-link" @click.stop="navigateTo(feat.page)">
              {{ feat.linkText }} &#8250;
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.hp-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 12px;
  background: var(--color-page-panel);
  color: var(--color-page-text);
  overflow: hidden;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

.hp-top-bar {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 52px;
  padding: 0 24px;
  flex-shrink: 0;
}

.hp-title {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-page-text);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}

.hp-subtitle {
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  margin: 0;
}

.hp-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 40px;
}

/* Welcome */
.hp-welcome {
  margin-bottom: 28px;
}

.hp-welcome-heading {
  font-size: var(--text-xl, 20px);
  font-weight: 700;
  color: var(--color-page-text);
  margin: 0 0 8px;
  letter-spacing: var(--tracking-tight);
}

.hp-welcome-desc {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-page-text-subtle);
  margin: 0;
  max-width: 720px;
}

/* Grid */
.hp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}

/* Card */
.hp-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--color-page-bg);
  border: 1px solid var(--color-page-border-subtle, var(--color-page-border));
  border-radius: var(--radius-lg);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.hp-card:hover {
  border-color: var(--color-page-brand);
  box-shadow: var(--shadow-sm);
}

/* Card Header */
.hp-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.hp-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--color-accent-bg);
  color: var(--color-page-brand);
  flex-shrink: 0;
}

.hp-card-header-text {
  flex: 1;
  min-width: 0;
}

.hp-card-title {
  font-size: var(--text-base, 15px);
  font-weight: 600;
  color: var(--color-page-text);
  margin: 0;
  letter-spacing: var(--tracking-tight);
}

.hp-card-summary {
  font-size: var(--text-xs, 12px);
  color: var(--color-page-text-muted);
  margin: 3px 0 0;
}

/* Steps area */
.hp-steps-area {
  flex: 1;
  min-height: 88px;
  position: relative;
}

.hp-step-viewport {
  position: relative;
}

.hp-step {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.hp-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-page-brand);
  color: var(--color-btn-primary-text);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.hp-step-body {
  flex: 1;
  min-width: 0;
}

.hp-step-title {
  font-size: var(--text-sm, 13px);
  font-weight: 600;
  color: var(--color-page-text);
  display: block;
  margin-bottom: 3px;
}

.hp-step-desc {
  font-size: var(--text-xs, 12px);
  line-height: 1.55;
  color: var(--color-page-text-subtle);
  margin: 0;
}

/* Step transition */
.hp-step-fade-enter-active {
  transition: opacity 0.35s var(--ease-out);
}

.hp-step-fade-leave-active {
  transition: opacity 0.2s var(--ease-out);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.hp-step-fade-enter-from,
.hp-step-fade-leave-to {
  opacity: 0;
}

/* Footer */
.hp-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--color-page-border-subtle, var(--color-page-border));
}

.hp-dots {
  display: flex;
  gap: 6px;
}

.hp-dot {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-page-border);
  border: none;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  position: relative;
}

.hp-dot--active {
  background: var(--color-page-border);
}

.hp-dot-fill {
  position: absolute;
  inset: 0;
  border-radius: 2px;
  background: var(--color-page-brand);
  transform: scaleX(0);
  transform-origin: left;
}

.hp-dot--active .hp-dot-fill {
  transform: scaleX(1);
}

.hp-dot-fill--running {
  transform: scaleX(0);
  animation: hp-dot-progress 3.5s linear forwards;
}

@keyframes hp-dot-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.hp-card-link {
  font-size: var(--text-sm, 13px);
  font-weight: 600;
  color: var(--color-page-brand);
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--duration-fast) var(--ease-out);
}

.hp-card-link:hover {
  background: var(--color-accent-bg);
}

@media (max-width: 768px) {
  .hp-content {
    padding: 16px;
  }

  .hp-grid {
    grid-template-columns: 1fr;
  }
}
</style>
