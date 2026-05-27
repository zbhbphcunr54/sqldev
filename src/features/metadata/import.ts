import type { MetadataRecord, MetadataRevisionInfo } from '@/stores/metadata'
import { uuid } from '@/lib/uuid'

export interface ImportResult {
  records: MetadataRecord[]
  revisions: MetadataRevisionInfo[]
  errors: string[]
}

const VALID_ATTR_TYPES = new Set(['string', 'number', 'date', 'datetime', 'boolean', 'enum', 'json'])

const ZH_HEADER_MAP: Record<string, keyof MetadataRecord> = {
  '序号': 'order',
  '中文名称': 'zhName',
  '字段名称': 'fieldName',
  '属性类型': 'attrType',
  '长度': 'length',
  '标准代码': 'standardCode',
  '业务说明': 'businessDesc'
}

const EN_HEADER_SET = new Set<string>(['order', 'zhName', 'fieldName', 'attrType', 'length', 'standardCode', 'businessDesc'])

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function resolveHeaderMap(headerRow: string[]): Map<number, keyof MetadataRecord> | null {
  const map = new Map<number, keyof MetadataRecord>()
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i].trim()
    if (ZH_HEADER_MAP[h]) {
      map.set(i, ZH_HEADER_MAP[h])
    } else if (EN_HEADER_SET.has(h)) {
      map.set(i, h as keyof MetadataRecord)
    }
  }
  return map.size > 0 ? map : null
}

function getTodayString(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function parseMetadataCsv(text: string): ImportResult {
  const errors: string[] = []
  const cleaned = stripBom(text)
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim())

  if (lines.length < 2) {
    return { records: [], revisions: [], errors: ['CSV 文件至少需要表头行和一行数据'] }
  }

  const headerFields = parseCsvLine(lines[0])
  const headerMap = resolveHeaderMap(headerFields)
  if (!headerMap) {
    return { records: [], revisions: [], errors: ['无法识别 CSV 表头，请使用中文或英文标准表头'] }
  }

  const records: MetadataRecord[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    const record: Partial<MetadataRecord> = {}
    headerMap.forEach((key, colIdx) => {
      record[key] = fields[colIdx]?.trim() ?? ''
    })

    records.push({
      id: `metadata-${uuid()}`,
      order: record.order ?? String(i),
      zhName: record.zhName ?? '',
      fieldName: record.fieldName ?? '',
      attrType: record.attrType ?? '',
      length: record.length ?? '',
      standardCode: record.standardCode ?? '',
      businessDesc: record.businessDesc ?? ''
    })
  }

  errors.push(...validateImportRecords(records))
  return { records, revisions: [], errors }
}

export function parseMetadataJson(text: string): ImportResult {
  const errors: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { records: [], revisions: [], errors: ['JSON 格式无效'] }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { records: [], revisions: [], errors: ['JSON 必须是一个对象'] }
  }

  const obj = parsed as Record<string, unknown>
  const rawRecords = Array.isArray(obj.records) ? obj.records : []
  const rawRevisions = Array.isArray(obj.revisions) ? obj.revisions : []

  if (rawRecords.length === 0) {
    return { records: [], revisions: [], errors: ['JSON 中没有找到 records 数组'] }
  }

  const records: MetadataRecord[] = rawRecords.map((r: Record<string, unknown>, i: number) => ({
    id: `metadata-${uuid()}`,
    order: String(r.order ?? i + 1),
    zhName: String(r.zhName ?? ''),
    fieldName: String(r.fieldName ?? ''),
    attrType: String(r.attrType ?? ''),
    length: String(r.length ?? ''),
    standardCode: String(r.standardCode ?? ''),
    businessDesc: String(r.businessDesc ?? '')
  }))

  const revisions: MetadataRevisionInfo[] = rawRevisions.map((r: Record<string, unknown>) => ({
    id: `metadata-revision-${uuid()}`,
    recordId: '',
    revisionDate: String(r.revisionDate ?? getTodayString()),
    version: String(r.version ?? 'v1.0.0'),
    revisionNote: String(r.revisionNote ?? ''),
    author: String(r.author ?? '')
  }))

  errors.push(...validateImportRecords(records))
  return { records, revisions, errors }
}

export function validateImportRecords(records: MetadataRecord[]): string[] {
  const errors: string[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const row = i + 1
    if (!r.zhName && !r.fieldName) {
      errors.push(`第 ${row} 行：中文名称和字段名称至少填一个`)
    }
    if (r.attrType && !VALID_ATTR_TYPES.has(r.attrType)) {
      errors.push(`第 ${row} 行：属性类型 "${r.attrType}" 无效`)
    }
  }
  return errors
}
