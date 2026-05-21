import type { WorkbenchPage } from '@/stores/workbench'

export interface MenuItem {
  key: string
  label: string
  icon: string
  page?: WorkbenchPage
  route?: string
}

export interface MenuGroup {
  key: string
  title: string | null
  collapsible: boolean
  items: MenuItem[]
}

export interface MenuAccessOptions {
  canAccessZiweiTool?: boolean
}

export const SECTION_MAP: Record<string, string> = {
  sqlConvert: '/workbench/sql-convert',
  idTool: '/workbench/id-tool',
  ziweiTool: '/workbench/ziwei',
  aiConfig: '/workbench/ai-config',
  opLogs: '/workbench/op-logs'
}

export function buildMenuGroups(options: MenuAccessOptions = {}): MenuGroup[] {
  const groups: MenuGroup[] = [
    {
      key: 'sqlTools',
      title: null,
      collapsible: false,
      items: [{ key: 'sqlConvert', label: 'SQL 转换', icon: 'grid', page: 'sqlConvert' }]
    },
    {
      key: 'testTools',
      title: '测试工具',
      collapsible: true,
      items: [
        { key: 'idTool', label: '证件号码生成', icon: 'document', page: 'idTool' },
        { key: 'ziweiTool', label: '紫微斗数命盘', icon: 'clock', page: 'ziweiTool' }
      ]
    },
    {
      key: 'settings',
      title: '设置',
      collapsible: true,
      items: [
        { key: 'aiConfig', label: 'AI 助手配置', icon: 'sparkles', page: 'aiConfig' },
        { key: 'opLogs', label: '操作日志', icon: 'clock-history', page: 'opLogs' }
      ]
    }
  ]

  if (options.canAccessZiweiTool === false) {
    return groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.page !== 'ziweiTool')
    }))
  }

  return groups
}
