export const WORKBENCH_DEFAULT_SECTION = 'home'

export const WORKBENCH_SECTIONS = [
  'home',
  'metadata',
  'sql-convert',
  'id-tool',
  'ziwei',
  'ai-config',
  'op-logs'
] as const

export type WorkbenchSection = (typeof WORKBENCH_SECTIONS)[number]

export interface WorkbenchSectionNavItem {
  section: WorkbenchSection
  to: string
  label: string
  icon: string
}

export interface WorkbenchSectionAccessConfig {
  canAccessZiweiTool?: boolean
}

export const WORKBENCH_SECTION_NAV_ITEMS: readonly WorkbenchSectionNavItem[] = [
  { section: 'home', to: '/workbench/home', label: '首页', icon: 'HOME' },
  { section: 'metadata', to: '/workbench/metadata', label: '元数据', icon: 'META' },
  { section: 'sql-convert', to: '/workbench/sql-convert', label: 'SQL 转换', icon: 'SQL' },
  { section: 'id-tool', to: '/workbench/id-tool', label: '证件号码', icon: 'ID' },
  { section: 'ziwei', to: '/workbench/ziwei', label: '紫微斗数', icon: 'ZW' },
  { section: 'ai-config', to: '/workbench/ai-config', label: 'AI 助手配置', icon: 'AI' },
  { section: 'op-logs', to: '/workbench/op-logs', label: '操作日志', icon: 'LOG' }
]

export function isWorkbenchSection(value: unknown): value is WorkbenchSection {
  return WORKBENCH_SECTIONS.includes(String(value || '') as WorkbenchSection)
}

export function normalizeWorkbenchSection(
  value: unknown,
  config: WorkbenchSectionAccessConfig = {}
): WorkbenchSection {
  const section = Array.isArray(value) ? value[0] : value
  const normalized = isWorkbenchSection(section) ? section : WORKBENCH_DEFAULT_SECTION
  if (normalized === 'ziwei' && config.canAccessZiweiTool === false) {
    return WORKBENCH_DEFAULT_SECTION
  }
  return normalized
}

export function buildWorkbenchPath(
  sectionValue: unknown,
  config: WorkbenchSectionAccessConfig = {}
): string {
  return `/workbench/${normalizeWorkbenchSection(sectionValue, config)}`
}
