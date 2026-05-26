import { downloadTextFileByDom } from '@/utils/browser-dom'
import type { MetadataRecord, MetadataRevisionInfo } from '@/stores/workbench'

function getTodayString(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

const CSV_HEADERS = ['序号', '中文名称', '字段名称', '属性类型', '长度', '标准代码', '业务说明']

export function exportMetadataAsCsv(records: MetadataRecord[]): boolean {
  if (records.length === 0) return false

  const header = CSV_HEADERS.join(',')
  const rows = records.map((r) =>
    [r.order, r.zhName, r.fieldName, r.attrType, r.length, r.standardCode, r.businessDesc]
      .map(csvEscape)
      .join(',')
  )
  const content = '﻿' + [header, ...rows].join('\r\n')
  downloadTextFileByDom(content, `metadata-${getTodayString()}.csv`, 'text/csv;charset=utf-8')
  return true
}

export function exportMetadataAsJson(
  records: MetadataRecord[],
  revisions: MetadataRevisionInfo[]
): boolean {
  if (records.length === 0) return false

  const cleanRecords = records.map(({ id: _, ...rest }) => rest)
  const cleanRevisions = revisions.map(({ id: _, recordId: __, ...rest }) => rest)
  const payload = { records: cleanRecords, revisions: cleanRevisions }
  const content = JSON.stringify(payload, null, 2)
  downloadTextFileByDom(
    content,
    `metadata-${getTodayString()}.json`,
    'application/json;charset=utf-8'
  )
  return true
}
