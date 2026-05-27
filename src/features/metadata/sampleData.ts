import type { MetadataRecord, MetadataRevisionInfo } from '@/stores/metadata'
import { uuid } from '@/lib/uuid'

function getTodayString(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function createSampleRecords(): MetadataRecord[] {
  return [
    { id: `metadata-${uuid()}`, order: '1', zhName: '客户编号', fieldName: 'customer_id', attrType: 'string', length: '32', standardCode: 'STD_001', businessDesc: '全局唯一客户标识' },
    { id: `metadata-${uuid()}`, order: '2', zhName: '客户名称', fieldName: 'customer_name', attrType: 'string', length: '128', standardCode: '', businessDesc: '客户全名或企业名称' },
    { id: `metadata-${uuid()}`, order: '3', zhName: '手机号码', fieldName: 'phone', attrType: 'string', length: '20', standardCode: 'STD_010', businessDesc: '联系手机号，格式 +86xxxxxxxxxx' },
    { id: `metadata-${uuid()}`, order: '4', zhName: '注册日期', fieldName: 'register_date', attrType: 'date', length: '', standardCode: '', businessDesc: '首次注册日期' },
    { id: `metadata-${uuid()}`, order: '5', zhName: '是否激活', fieldName: 'is_active', attrType: 'boolean', length: '', standardCode: '', businessDesc: '账户是否处于激活状态' }
  ]
}

export function createSampleRevisions(records: MetadataRecord[]): MetadataRevisionInfo[] {
  if (records.length === 0) return []
  const today = getTodayString()
  return [
    { id: `metadata-revision-${uuid()}`, recordId: records[0].id, revisionDate: today, version: 'v1.0.0', revisionNote: '初始版本 — 示例数据', author: '系统' }
  ]
}
