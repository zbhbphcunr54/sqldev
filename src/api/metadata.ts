import { edgeFn } from '@/api/http'
import { useTabId } from '@/composables/useTabId'

function tabIdHeaders() {
  return { extraHeaders: { 'X-Client-Tab-Id': useTabId() } }
}

export interface MetadataWorkspaceSummary {
  id: string
  name: string
  version: number
  updated_at: string
  created_at: string
}

export interface MetadataWorkspaceDetail {
  ok: boolean
  workspace: MetadataWorkspaceSummary & { last_writer_tab_id: string | null }
  records: MetadataRemoteRecord[]
  revisions: MetadataRemoteRevision[]
}

export interface MetadataRemoteRecord {
  id: string
  workspace_id: string
  display_order: number
  zh_name: string
  field_name: string
  attr_type: string
  length: string
  standard_code: string
  business_desc: string
  updated_at: string
}

export interface MetadataRemoteRevision {
  id: string
  record_id: string | null
  record_id_snapshot: string
  workspace_id: string
  version: string
  revision_note: string
  author: string
  type: string
  created_at: string
}

export interface MetadataSaveResponse {
  ok: boolean
  version?: number
}

export const metadataApi = {
  listWorkspaces: () =>
    edgeFn.get<{ ok: boolean; workspaces: MetadataWorkspaceSummary[] }>('/metadata'),

  getWorkspace: (workspaceId: string) =>
    edgeFn.get<MetadataWorkspaceDetail>(`/metadata/${workspaceId}`),

  fullSave: (workspaceId: string, body: {
    expectedVersion: number
    records: unknown[]
    revisions?: unknown[]
  }) =>
    edgeFn.put<MetadataSaveResponse>(`/metadata/${workspaceId}`, body, {
      skipRetry: true,
      ...tabIdHeaders()
    }),

  incrementalSave: (workspaceId: string, body: {
    expectedVersion: number
    creates?: unknown[]
    upserts?: unknown[]
    deletes?: string[]
    revisions?: unknown[]
  }) =>
    edgeFn.patch<MetadataSaveResponse>(`/metadata/${workspaceId}`, body, {
      skipRetry: true,
      ...tabIdHeaders()
    }),

  rebalance: (workspaceId: string, expectedVersion: number) =>
    edgeFn.post<MetadataSaveResponse>(`/metadata/${workspaceId}/rebalance`, {
      expectedVersion
    }, {
      skipRetry: true,
      ...tabIdHeaders()
    })
}
