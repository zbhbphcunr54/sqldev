export const WORKBENCH_DEFAULT_SECTION = 'ddl'

export const WORKBENCH_SECTIONS = [
  'ddl',
  'function',
  'procedure',
  'id-tool',
  'ziwei',
  'rules',
  'ai-config'
] as const

export type WorkbenchSection = (typeof WORKBENCH_SECTIONS)[number]

export interface WorkbenchSectionNavItem {
  section: WorkbenchSection
  to: string
  label: string
  icon: string
}

export const WORKBENCH_SECTION_NAV_ITEMS: readonly WorkbenchSectionNavItem[] = [
  { section: 'ddl', to: '/workbench/ddl', label: 'DDL 翻译', icon: 'DDL' },
  { section: 'function', to: '/workbench/function', label: '函数翻译', icon: 'Fn' },
  { section: 'procedure', to: '/workbench/procedure', label: '存储过程', icon: 'Pr' },
  { section: 'id-tool', to: '/workbench/id-tool', label: '证件号码', icon: 'ID' },
  { section: 'ziwei', to: '/workbench/ziwei', label: '紫微斗数', icon: 'ZW' },
  { section: 'rules', to: '/workbench/rules', label: '映射规则', icon: 'RL' },
  { section: 'ai-config', to: '/workbench/ai-config', label: 'AI 助手配置', icon: 'AI' }
]

export function isWorkbenchSection(value: unknown): value is WorkbenchSection {
  return WORKBENCH_SECTIONS.includes(String(value || '') as WorkbenchSection)
}

export function normalizeWorkbenchSection(value: unknown): WorkbenchSection {
  const section = Array.isArray(value) ? value[0] : value
  return isWorkbenchSection(section) ? section : WORKBENCH_DEFAULT_SECTION
}

export function buildWorkbenchPath(sectionValue: unknown): string {
  return `/workbench/${normalizeWorkbenchSection(sectionValue)}`
}
