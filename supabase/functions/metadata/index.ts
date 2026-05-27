import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig, handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, logEdgeError, sanitizeError } from '../_shared/response.ts'
import { parseJsonBody, getClientIp } from '../_shared/request.ts'
import { createLogger } from '../_shared/operation-logger.ts'
import { getSupabaseEnv } from '../_shared/app-config.ts'

const corsHelpers = createCorsHelpers({
  allowMethods: 'GET, PUT, PATCH, POST, OPTIONS'
})

await initCorsConfig()

const { url: SUPABASE_URL } = getSupabaseEnv()
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

function getUserClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
}

interface RouteContext {
  userId: string
  email: string
  tabId: string
  clientIp: string
  supabase: ReturnType<typeof createClient>
  corsHeaders: Record<string, string>
}

// ── Route: POST /metadata (create workspace) ──

async function handleCreateWorkspace(ctx: RouteContext, req: Request) {
  const body = await parseJsonBody<{ name?: string }>(req).catch(() => null)
  const name = body?.name || '默认工作区'

  const { data, error } = await ctx.supabase
    .from('metadata_workspaces')
    .insert({ user_id: ctx.userId, name })
    .select('id, name, version, updated_at, created_at')
    .single()

  if (error) {
    logEdgeError('metadata', 'createWorkspace', error)
    return errorResponse(500, sanitizeError(error), ctx.corsHeaders)
  }
  return jsonResponse(200, { ok: true, workspace: data }, ctx.corsHeaders)
}

// ── Route: GET /metadata (list workspaces) ──

async function handleListWorkspaces(ctx: RouteContext) {
  const { data, error } = await ctx.supabase
    .from('metadata_workspaces')
    .select('id, name, version, updated_at, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    logEdgeError('metadata', 'listWorkspaces', error)
    return errorResponse(500, sanitizeError(error), ctx.corsHeaders)
  }
  return jsonResponse(200, { ok: true, workspaces: data ?? [] }, ctx.corsHeaders)
}

// ── Route: GET /metadata/:id (workspace detail) ──

async function handleGetWorkspace(ctx: RouteContext, workspaceId: string) {
  const { data: ws, error: wsErr } = await ctx.supabase
    .from('metadata_workspaces')
    .select('id, name, version, last_writer_tab_id, updated_at, created_at')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .single()

  if (wsErr || !ws) {
    return errorResponse(404, 'workspace_not_found', ctx.corsHeaders)
  }

  const { data: records } = await ctx.supabase
    .from('metadata_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('display_order', { ascending: true })

  const { data: revisions } = await ctx.supabase
    .from('metadata_revisions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  return jsonResponse(200, {
    ok: true,
    workspace: ws,
    records: records ?? [],
    revisions: revisions ?? []
  }, ctx.corsHeaders)
}

// ── Route: PUT /metadata/:id (full save) ──

async function handleFullSave(ctx: RouteContext, workspaceId: string, req: Request) {
  const body = await parseJsonBody<{
    expectedVersion: number
    records: Record<string, unknown>[]
    revisions: Record<string, unknown>[]
  }>(req)
  if (!body || !Array.isArray(body.records)) {
    return errorResponse(400, 'invalid_body', ctx.corsHeaders)
  }

  const { data, error } = await ctx.supabase.rpc('metadata_apply_put', {
    p_workspace_id: workspaceId,
    p_payload: JSON.stringify({ records: body.records, revisions: body.revisions ?? [] }),
    p_expected_version: body.expectedVersion ?? 0,
    p_tab_id: ctx.tabId
  })

  if (error) {
    if (error.message?.includes('version_conflict')) {
      return jsonResponse(409, { ok: false, error: 'version_conflict', detail: error.details }, ctx.corsHeaders)
    }
    logEdgeError('metadata', 'fullSave', error)
    return errorResponse(500, sanitizeError(error), ctx.corsHeaders)
  }

  const logger = createLogger({ userId: ctx.userId, userEmail: ctx.email, clientIp: ctx.clientIp })
  logger('metadata_save', {
    workspaceId,
    recordCount: body.records.length,
    version: body.expectedVersion
  })

  return jsonResponse(200, { ok: true, ...(data ?? {}) }, ctx.corsHeaders)
}

// ── Route: PATCH /metadata/:id (incremental save) ──

async function handlePatch(ctx: RouteContext, workspaceId: string, req: Request) {
  const body = await parseJsonBody<{
    expectedVersion: number
    creates?: Record<string, unknown>[]
    upserts?: Record<string, unknown>[]
    deletes?: string[]
    revisions?: Record<string, unknown>[]
  }>(req)
  if (!body) {
    return errorResponse(400, 'invalid_body', ctx.corsHeaders)
  }

  const { data, error } = await ctx.supabase.rpc('metadata_apply_patch', {
    p_workspace_id: workspaceId,
    p_payload: JSON.stringify({
      creates: body.creates ?? [],
      upserts: body.upserts ?? [],
      deletes: body.deletes ?? [],
      revisions: body.revisions ?? []
    }),
    p_expected_version: body.expectedVersion ?? 0,
    p_tab_id: ctx.tabId
  })

  if (error) {
    if (error.message?.includes('version_conflict')) {
      return jsonResponse(409, { ok: false, error: 'version_conflict', detail: error.details }, ctx.corsHeaders)
    }
    if (error.message?.includes('precision_exhausted')) {
      return errorResponse(422, 'precision_exhausted', ctx.corsHeaders)
    }
    logEdgeError('metadata', 'patch', error)
    return errorResponse(500, sanitizeError(error), ctx.corsHeaders)
  }

  const logger = createLogger({ userId: ctx.userId, userEmail: ctx.email, clientIp: ctx.clientIp })
  logger('metadata_patch', {
    workspaceId,
    creates: (body.creates ?? []).length,
    upserts: (body.upserts ?? []).length,
    deletes: (body.deletes ?? []).length,
    version: body.expectedVersion
  })

  return jsonResponse(200, { ok: true, ...(data ?? {}) }, ctx.corsHeaders)
}

// ── Route: POST /metadata/:id/rebalance ──

async function handleRebalance(ctx: RouteContext, workspaceId: string, req: Request) {
  const body = await parseJsonBody<{ expectedVersion?: number }>(req)

  const { data, error } = await ctx.supabase.rpc('metadata_rebalance', {
    p_workspace_id: workspaceId,
    p_expected_version: body?.expectedVersion ?? 0,
    p_tab_id: ctx.tabId
  })

  if (error) {
    if (error.message?.includes('version_conflict')) {
      return jsonResponse(409, { ok: false, error: 'version_conflict', detail: error.details }, ctx.corsHeaders)
    }
    logEdgeError('metadata', 'rebalance', error)
    return errorResponse(500, sanitizeError(error), ctx.corsHeaders)
  }

  const logger = createLogger({ userId: ctx.userId, userEmail: ctx.email, clientIp: ctx.clientIp })
  logger('metadata_rebalance', { workspaceId })

  return jsonResponse(200, { ok: true, ...(data ?? {}) }, ctx.corsHeaders)
}

// ── Main handler ──

Deno.serve(async (req) => {
  const corsResult = handleCors(req, corsHelpers)
  if (corsResult) return corsResult

  const corsHeaders = corsHelpers.buildCorsHeaders(req) ?? corsHelpers.defaultCorsHeaders()

  try {
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return errorResponse(401, 'unauthorized', corsHeaders)

    const session = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (session.state !== 'valid') return errorResponse(401, 'unauthorized', corsHeaders)

    const ctx: RouteContext = {
      userId: session.userId,
      email: session.email,
      tabId: req.headers.get('x-client-tab-id') ?? '',
      clientIp: getClientIp(req),
      supabase: getUserClient(token),
      corsHeaders
    }

    const url = new URL(req.url)
    const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
    // Expected: ["metadata"] or ["metadata", "<id>"] or ["metadata", "<id>", "rebalance"]
    const funcIdx = segments.indexOf('metadata')
    const idSegment = funcIdx >= 0 ? segments[funcIdx + 1] : undefined
    const actionSegment = funcIdx >= 0 ? segments[funcIdx + 2] : undefined

    // POST /metadata — create workspace
    if (req.method === 'POST' && !idSegment) {
      return await handleCreateWorkspace(ctx, req)
    }

    // GET /metadata — list workspaces
    if (req.method === 'GET' && !idSegment) {
      return await handleListWorkspaces(ctx)
    }

    // GET /metadata/:id — workspace detail
    if (req.method === 'GET' && idSegment && !actionSegment) {
      return await handleGetWorkspace(ctx, idSegment)
    }

    // PUT /metadata/:id — full save
    if (req.method === 'PUT' && idSegment && !actionSegment) {
      return await handleFullSave(ctx, idSegment, req)
    }

    // PATCH /metadata/:id — incremental save
    if (req.method === 'PATCH' && idSegment && !actionSegment) {
      return await handlePatch(ctx, idSegment, req)
    }

    // POST /metadata/:id/rebalance
    if (req.method === 'POST' && idSegment && actionSegment === 'rebalance') {
      return await handleRebalance(ctx, idSegment, req)
    }

    return errorResponse(404, 'not_found', corsHeaders)
  } catch (err) {
    logEdgeError('metadata', 'handler', err)
    return errorResponse(500, sanitizeError(err), corsHelpers.buildCorsHeaders(req) ?? corsHelpers.defaultCorsHeaders())
  }
})
