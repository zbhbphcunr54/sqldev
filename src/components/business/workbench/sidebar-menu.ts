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

export const SECTION_MAP: Record<string, string> = {
  ddl: '/workbench/ddl',
  func: '/workbench/function',
  proc: '/workbench/procedure',
  idTool: '/workbench/id-tool',
  ziweiTool: '/workbench/ziwei',
  rules: '/workbench/rules',
  aiConfig: '/workbench/ai-config',
  appConfig: '/workbench/app-config',
  opLogs: '/workbench/op-logs'
}

export function buildMenuGroups(): MenuGroup[] {
  return [
    {
      key: 'sqlTools',
      title: null,
      collapsible: false,
      items: [
        { key: 'ddl', label: 'DDL 语句', icon: 'grid', page: 'ddl' },
        { key: 'func', label: '函数', icon: 'layers', page: 'func' },
        { key: 'proc', label: '存储过程', icon: 'terminal', page: 'proc' }
      ]
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
        { key: 'rules', label: '映射规则', icon: 'document-text', page: 'rules' },
        { key: 'aiConfig', label: 'AI 助手配置', icon: 'sparkles', page: 'aiConfig' },
        { key: 'appConfig', label: '应用配置', icon: 'cog', page: 'appConfig' },
        { key: 'opLogs', label: '操作日志', icon: 'clock-history', page: 'opLogs' }
      ]
    }
  ]
}
