import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getJson, setJson } from '@/utils/storage'
import { uuid } from '@/lib/uuid'
import { useTabId } from '@/composables/useTabId'
import {
  metadataApi,
  type MetadataRemoteRecord,
  type MetadataRemoteRevision
} from '@/api/metadata'

const METADATA_CACHE_KEY = 'sqldev:workbench:metadata'
const REMOTE_SYNC_DEBOUNCE_MS = 1000

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

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

// ── ID prefix mapping ──

function stripRecordPrefix(id: string): string {
  return id.startsWith('metadata-') ? id.slice('metadata-'.length) : id
}

function addRecordPrefix(id: string): string {
  return id.startsWith('metadata-') ? id : `metadata-${id}`
}

function stripRevisionPrefix(id: string): string {
  return id.startsWith('metadata-revision-') ? id.slice('metadata-revision-'.length) : id
}

function addRevisionPrefix(id: string): string {
  return id.startsWith('metadata-revision-') ? id : `metadata-revision-${id}`
}

// ── Field mapping: Store ↔ DB ──

function toRemoteRecord(r: MetadataRecord): Record<string, unknown> {
  return {
    id: stripRecordPrefix(r.id),
    display_order: Number(r.order) || 0,
    zh_name: r.zhName,
    field_name: r.fieldName,
    attr_type: r.attrType,
    length: r.length,
    standard_code: r.standardCode,
    business_desc: r.businessDesc
  }
}

function toRemoteRevision(r: MetadataRevisionInfo, records: MetadataRecord[]): Record<string, unknown> {
  const record = records.find(rec => rec.id === r.recordId)
  return {
    id: stripRevisionPrefix(r.id),
    record_id: stripRecordPrefix(r.recordId),
    record_id_snapshot: stripRecordPrefix(r.recordId),
    field_name_snapshot: record?.fieldName ?? '',
    version: r.version,
    revision_note: r.revisionNote,
    author: r.author,
    type: 'update'
  }
}

function fromRemoteRecord(r: MetadataRemoteRecord, index: number): MetadataRecord {
  return {
    id: addRecordPrefix(r.id),
    order: r.display_order != null ? String(r.display_order) : String(index + 1),
    zhName: r.zh_name ?? '',
    fieldName: r.field_name ?? '',
    attrType: r.attr_type ?? '',
    length: r.length ?? '',
    standardCode: r.standard_code ?? '',
    businessDesc: r.business_desc ?? ''
  }
}

function fromRemoteRevision(r: MetadataRemoteRevision): MetadataRevisionInfo {
  return {
    id: addRevisionPrefix(r.id),
    recordId: addRecordPrefix(r.record_id_snapshot ?? r.record_id ?? ''),
    revisionDate: r.created_at ? r.created_at.slice(0, 10) : getTodayString(),
    version: r.version ?? 'v1.0.0',
    revisionNote: r.revision_note ?? '',
    author: r.author ?? ''
  }
}

// ── Helpers ──

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

function createDefaultMetadataState(): MetadataCacheData {
  return { version: 2, records: [], revisions: [] }
}

function normalizeMetadataRecords(records: MetadataRecord[]): MetadataRecord[] {
  if (records.length === 0) return []
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

  // ── Remote sync state ──
  const currentWorkspaceId = ref<string | null>(null)
  const serverVersion = ref<number>(0)
  const syncStatus = ref<SyncStatus>('idle')
  let _syncTimer: ReturnType<typeof setTimeout> | null = null

  // ── Dirty tracking (runtime only, not persisted) ──
  const _dirtyRecordIds = new Set<string>()
  const _deletedRecordIds = new Set<string>()
  const _newRevisionIds = new Set<string>()

  function syncMetadataCache(): void {
    persistMetadataCache(metadataRecords.value, metadataRevisions.value)
    schedulePushToRemote()
  }

  function schedulePushToRemote(): void {
    if (_syncTimer) clearTimeout(_syncTimer)
    _syncTimer = setTimeout(() => {
      _syncTimer = null
      pushToRemote()
    }, REMOTE_SYNC_DEBOUNCE_MS)
  }

  async function pushFullToRemote(): Promise<void> {
    if (!currentWorkspaceId.value) return
    syncStatus.value = 'syncing'
    try {
      const records = metadataRecords.value.map(toRemoteRecord)
      const revisions = metadataRevisions.value.map(r => toRemoteRevision(r, metadataRecords.value))
      const res = await metadataApi.fullSave(currentWorkspaceId.value, {
        expectedVersion: serverVersion.value,
        records,
        revisions
      })
      if (res.ok && res.version) {
        serverVersion.value = res.version
      }
      _dirtyRecordIds.clear()
      _deletedRecordIds.clear()
      _newRevisionIds.clear()
      syncStatus.value = 'synced'
    } catch (err) {
      syncStatus.value = 'error'
      console.error('[metadata] pushFullToRemote failed:', err)
    }
  }

  async function pushToRemote(): Promise<void> {
    if (!currentWorkspaceId.value) return

    const hasDirty = _dirtyRecordIds.size > 0 || _deletedRecordIds.size > 0 || _newRevisionIds.size > 0
    if (!hasDirty) return

    if (serverVersion.value === 0) {
      return pushFullToRemote()
    }

    syncStatus.value = 'syncing'
    try {
      const upserts = [..._dirtyRecordIds]
        .map(id => metadataRecords.value.find(r => r.id === id))
        .filter((r): r is MetadataRecord => r != null)
        .map(toRemoteRecord)

      const deletes = [..._deletedRecordIds]

      const revisions = [..._newRevisionIds]
        .map(id => metadataRevisions.value.find(r => r.id === id))
        .filter((r): r is MetadataRevisionInfo => r != null)
        .map(r => toRemoteRevision(r, metadataRecords.value))

      const res = await metadataApi.incrementalSave(currentWorkspaceId.value, {
        expectedVersion: serverVersion.value,
        ...(upserts.length > 0 ? { upserts } : {}),
        ...(deletes.length > 0 ? { deletes } : {}),
        ...(revisions.length > 0 ? { revisions } : {})
      })

      if (res.ok && res.version) {
        serverVersion.value = res.version
      }
      _dirtyRecordIds.clear()
      _deletedRecordIds.clear()
      _newRevisionIds.clear()
      syncStatus.value = 'synced'
    } catch (err) {
      syncStatus.value = 'error'
      console.error('[metadata] pushToRemote (patch) failed:', err)
    }
  }

  async function initRemoteSync(): Promise<void> {
    let authStore: { user: { id: string } | null }
    try {
      const mod = await import('@/stores/auth')
      authStore = mod.useAuthStore()
    } catch {
      return
    }
    if (!authStore.user) return

    try {
      const listRes = await metadataApi.listWorkspaces()
      const workspaces = listRes.workspaces ?? []

      if (workspaces.length === 0) {
        const createRes = await metadataApi.createWorkspace()
        currentWorkspaceId.value = createRes.workspace.id
        serverVersion.value = createRes.workspace.version
        const hasSubstantiveData = metadataRecords.value.some(r => r.zhName || r.fieldName)
        if (hasSubstantiveData) {
          await pushFullToRemote()
        }
      } else {
        const ws = workspaces[0]
        currentWorkspaceId.value = ws.id
        const detail = await metadataApi.getWorkspace(ws.id)
        serverVersion.value = detail.workspace.version

        const remoteRecords = (detail.records ?? []).map(fromRemoteRecord)
        const remoteRevisions = (detail.revisions ?? []).map(fromRemoteRevision)

        if (remoteRecords.length > 0) {
          metadataRecords.value = remoteRecords
          metadataRevisions.value = normalizeMetadataRevisions(remoteRevisions, remoteRecords)
          persistMetadataCache(metadataRecords.value, metadataRevisions.value)
        } else {
          const hasSubstantiveData = metadataRecords.value.some(r => r.zhName || r.fieldName)
          if (hasSubstantiveData) {
            await pushFullToRemote()
          }
        }
      }
    } catch (err) {
      console.error('[metadata] initRemoteSync failed:', err)
    }
  }

  function reorderMetadataRecords(): void {
    metadataRecords.value = metadataRecords.value.map((record, i) => ({
      ...record,
      order: String(i + 1)
    }))
    for (const r of metadataRecords.value) _dirtyRecordIds.add(r.id)
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
    _dirtyRecordIds.add(record.id)
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
    _dirtyRecordIds.add(id)
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

    _deletedRecordIds.add(stripRecordPrefix(id))
    _dirtyRecordIds.delete(id)

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
      reorderMetadataRecords()
    } else {
      metadataRecords.value = []
      metadataRevisions.value = []
      syncMetadataCache()
    }
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
    _newRevisionIds.add(revision.id)
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

  function deleteMetadataRecordsBatch(ids: string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    for (const id of ids) {
      _deletedRecordIds.add(stripRecordPrefix(id))
      _dirtyRecordIds.delete(id)
    }
    const filtered = metadataRecords.value.filter(r => !idSet.has(r.id))
    if (filtered.length === 0) {
      metadataRecords.value = []
      metadataRevisions.value = []
      syncMetadataCache()
    } else {
      metadataRevisions.value = metadataRevisions.value.filter(
        rev => !idSet.has(rev.recordId)
      )
      metadataRecords.value = filtered
      reorderMetadataRecords()
    }
  }

  function batchUpdateAttrType(ids: string[], attrType: string): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    metadataRecords.value = metadataRecords.value.map(r =>
      idSet.has(r.id) ? { ...r, attrType } : r
    )
    for (const id of ids) _dirtyRecordIds.add(id)
    syncMetadataCache()
  }

  function saveMetadataWorkspace(): void {
    for (const r of metadataRecords.value) _dirtyRecordIds.add(r.id)
    for (const r of metadataRevisions.value) _newRevisionIds.add(r.id)
    syncMetadataCache()
  }

  function resetMetadataWorkspace(): void {
    metadataRecords.value = []
    metadataRevisions.value = []
    persistMetadataCache(metadataRecords.value, metadataRevisions.value)
    pushFullToRemote()
  }

  return {
    metadataRecords,
    metadataRevisions,
    currentWorkspaceId,
    serverVersion,
    syncStatus,
    initRemoteSync,
    pushToRemote,
    pushFullToRemote,
    addMetadataRecord,
    updateMetadataRecord,
    deleteMetadataRecord,
    deleteMetadataRecordsBatch,
    batchUpdateAttrType,
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
