import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getJson, setJson } from '@/utils/storage'
import { uuid } from '@/lib/uuid'
import { useTabId } from '@/composables/useTabId'

const METADATA_CACHE_KEY = 'sqldev:workbench:metadata'

export interface MetadataRecord {
  id: string
  order: string
  zhName: string
  fieldName: string
  attrType: string
  length: string
  standardCode: string
  businessDesc: string
}

export interface MetadataRevisionInfo {
  id: string
  recordId: string
  revisionDate: string
  version: string
  revisionNote: string
  author: string
}

interface MetadataCacheData {
  version: 2
  records: MetadataRecord[]
  revisions: MetadataRevisionInfo[]
}

function createMetadataRecord(index: number): MetadataRecord {
  const order = String(index + 1)
  return {
    id: `metadata-${uuid()}`,
    order,
    zhName: '',
    fieldName: '',
    attrType: '',
    length: '',
    standardCode: '',
    businessDesc: ''
  }
}

function getTodayString(): string {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function createMetadataRevision(recordId: string, author = ''): MetadataRevisionInfo {
  return {
    id: `metadata-revision-${uuid()}`,
    recordId,
    revisionDate: getTodayString(),
    version: 'v1.0.0',
    revisionNote: '',
    author
  }
}

function createDefaultMetadataState(_author = ''): MetadataCacheData {
  const firstRecord = createMetadataRecord(0)
  return {
    version: 2,
    records: [firstRecord],
    revisions: []
  }
}

function normalizeMetadataRecords(records: MetadataRecord[]): MetadataRecord[] {
  if (records.length === 0) return [createMetadataRecord(0)]
  return records.map((record, index) => ({
    ...record,
    id: record.id || createMetadataRecord(index).id,
    order: record.order || String(index + 1),
    zhName: record.zhName || '',
    fieldName: record.fieldName || '',
    attrType: record.attrType || '',
    length: record.length || '',
    standardCode: record.standardCode || '',
    businessDesc: record.businessDesc || ''
  }))
}

function normalizeMetadataRevisions(
  revisions: MetadataRevisionInfo[],
  records: MetadataRecord[]
): MetadataRevisionInfo[] {
  const recordIds = new Set(records.map((record) => record.id))
  return revisions
    .filter((revision) => recordIds.has(revision.recordId))
    .map((revision) => ({
      id: revision.id || createMetadataRevision(revision.recordId).id,
      recordId: revision.recordId,
      revisionDate: revision.revisionDate || getTodayString(),
      version: revision.version || 'v1.0.0',
      revisionNote: revision.revisionNote || '',
      author: revision.author || ''
    }))
}

function getMetadataCache(): MetadataCacheData {
  const data = getJson<{
    version?: number
    records?: MetadataRecord[]
    revisions?: MetadataRevisionInfo[]
  } | null>(METADATA_CACHE_KEY, null)
  if (!data) return createDefaultMetadataState()
  const records = normalizeMetadataRecords(Array.isArray(data.records) ? data.records : [])
  return {
    version: 2,
    records,
    revisions: normalizeMetadataRevisions(
      Array.isArray(data.revisions) ? data.revisions : [],
      records
    )
  }
}

function persistMetadataCache(records: MetadataRecord[], revisions: MetadataRevisionInfo[]): void {
  setJson(METADATA_CACHE_KEY, {
    version: 2,
    records,
    revisions,
    _writerTabId: useTabId(),
    _lastWrittenAt: Date.now()
  })
}

export const useMetadataStore = defineStore('metadata', () => {
  const metadataCache = getMetadataCache()
  const metadataRecords = ref<MetadataRecord[]>(metadataCache.records)
  const metadataRevisions = ref<MetadataRevisionInfo[]>(metadataCache.revisions)

  function syncMetadataCache(): void {
    persistMetadataCache(metadataRecords.value, metadataRevisions.value)
  }

  function reorderMetadataRecords(): void {
    metadataRecords.value = metadataRecords.value.map((record, i) => ({
      ...record,
      order: String(i + 1)
    }))
    syncMetadataCache()
  }

  function moveMetadataRecord(id: string, direction: 'up' | 'down'): void {
    const arr = [...metadataRecords.value]
    const idx = arr.findIndex((r) => r.id === id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= arr.length) return
    ;[arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]]
    metadataRecords.value = arr
    reorderMetadataRecords()
  }

  function addMetadataRecord(_author = ''): void {
    const record = createMetadataRecord(metadataRecords.value.length)
    metadataRecords.value = [...metadataRecords.value, record]
    reorderMetadataRecords()
  }

  function updateMetadataRecord(
    id: string,
    field: keyof Omit<MetadataRecord, 'id'>,
    value: string
  ): void {
    metadataRecords.value = metadataRecords.value.map((record) =>
      record.id === id ? { ...record, [field]: value } : record
    )
    syncMetadataCache()
  }

  function deleteMetadataRecord(
    id: string,
    author = '',
    version = '',
    revisionNote = ''
  ): void {
    const idx = metadataRecords.value.findIndex((record) => record.id === id)
    if (idx === -1) return

    const filtered = metadataRecords.value.filter((record) => record.id !== id)
    const orphanRevisions = metadataRevisions.value.filter(
      (revision) => revision.recordId === id
    )

    if (filtered.length > 0) {
      const targetIdx = idx > 0 ? idx - 1 : 0
      const targetId = filtered[targetIdx].id
      const migratedRevisions = metadataRevisions.value.map((revision) =>
        revision.recordId === id ? { ...revision, recordId: targetId } : revision
      )
      metadataRecords.value = filtered
      metadataRevisions.value = migratedRevisions

      if (version && revisionNote) {
        const deleteRevision = createMetadataRevision(targetId, author)
        deleteRevision.version = version
        deleteRevision.revisionNote = revisionNote
        metadataRevisions.value = [...metadataRevisions.value, deleteRevision]
      }
    } else {
      const record = createMetadataRecord(0)
      metadataRecords.value = [record]
      const migratedRevisions = orphanRevisions.map((revision) => ({
        ...revision,
        recordId: record.id
      }))
      if (version && revisionNote) {
        const deleteRevision = createMetadataRevision(record.id, author)
        deleteRevision.version = version
        deleteRevision.revisionNote = revisionNote
        migratedRevisions.push(deleteRevision)
      }
      metadataRevisions.value = migratedRevisions
    }
    reorderMetadataRecords()
  }

  function updateMetadataRevision(
    id: string,
    field: keyof MetadataRevisionInfo,
    value: string
  ): void {
    metadataRevisions.value = metadataRevisions.value.map((revision) =>
      revision.id === id ? { ...revision, [field]: value } : revision
    )
    syncMetadataCache()
  }

  function addMetadataRevision(
    recordId: string,
    author = '',
    version = 'v1.0.0',
    revisionNote = ''
  ): void {
    if (!metadataRecords.value.some((record) => record.id === recordId)) return
    const revision = createMetadataRevision(recordId, author)
    revision.version = version
    revision.revisionNote = revisionNote
    metadataRevisions.value = [...metadataRevisions.value, revision]
    syncMetadataCache()
  }

  function ensureMetadataRevisions(): void {
    const before = metadataRevisions.value.length
    const pruned = metadataRevisions.value.filter((revision) =>
      metadataRecords.value.some((record) => record.id === revision.recordId)
    )
    if (pruned.length === before) return
    metadataRevisions.value = pruned
    syncMetadataCache()
  }

  function deleteMetadataRevision(id: string): void {
    const target = metadataRevisions.value.find((revision) => revision.id === id)
    if (!target) return
    const sameRecordCount = metadataRevisions.value.filter(
      (revision) => revision.recordId === target.recordId
    ).length
    if (sameRecordCount <= 1) return
    metadataRevisions.value = metadataRevisions.value.filter((revision) => revision.id !== id)
    syncMetadataCache()
  }

  function saveMetadataWorkspace(): void {
    syncMetadataCache()
  }

  function resetMetadataWorkspace(author = ''): void {
    const defaults = createDefaultMetadataState(author)
    metadataRecords.value = defaults.records
    metadataRevisions.value = defaults.revisions
    syncMetadataCache()
  }

  return {
    metadataRecords,
    metadataRevisions,
    addMetadataRecord,
    updateMetadataRecord,
    deleteMetadataRecord,
    moveMetadataRecord,
    reorderMetadataRecords,
    updateMetadataRevision,
    addMetadataRevision,
    ensureMetadataRevisions,
    deleteMetadataRevision,
    saveMetadataWorkspace,
    resetMetadataWorkspace
  }
})
