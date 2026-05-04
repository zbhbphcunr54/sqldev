/**
 * [2026-05-03] 配置管理 Edge Function
 * 管理员可创建/更新/删除配置
 * 普通用户只读非加密配置
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'
import { encryptValue, decryptValue } from '../_shared/crypto.ts'
import { clearConfigCache } from '../_shared/app-config.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''

function getAdminClient() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('SERVICE_ROLE_KEY not configured')
  return createClient(SUPABASE_URL, key)
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// GET /app-config - 列出所有配置（管理员）
// GET /app-config?category=ziwei - 按分类列出
async function handleList(
  isAdmin: boolean,
  adminClient: ReturnType<typeof createClient>,
  category?: string
) {
  let query = adminClient.from('app_configs').select('*').order('category').order('key')

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())

  // 非管理员时隐藏加密值
  const results = (data || []).map((row: Record<string, unknown>) => {
    if (!isAdmin && row.is_encrypted) {
      return { ...row, value: '***ENCRYPTED***' }
    }
    return row
  })

  return jsonResponse(200, { ok: true, configs: results }, defaultCorsHeaders())
}

// POST /app-config - 创建配置
async function handleCreate(
  userId: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  const { category, key, value, value_type, description, is_encrypted } = body

  if (!category || !key) {
    return jsonResponse(400, { error: 'category and key are required' }, defaultCorsHeaders())
  }

  let finalValue = String(value || '')
  if (is_encrypted && finalValue) {
    finalValue = await encryptValue(finalValue)
  }

  const { data, error } = await adminClient
    .from('app_configs')
    .insert({
      category: String(category),
      key: String(key),
      value: finalValue,
      value_type: String(value_type || 'string'),
      description: description ? String(description) : null,
      is_encrypted: Boolean(is_encrypted),
      created_by: userId
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return jsonResponse(409, { error: 'config_already_exists' }, defaultCorsHeaders())
    }
    return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())
  }

  clearConfigCache()
  return jsonResponse(201, { ok: true, config: data }, defaultCorsHeaders())
}

// PATCH /app-config/:id - 更新配置
async function handleUpdate(
  id: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  // 获取现有配置判断是否加密
  const { data: existing } = await adminClient
    .from('app_configs')
    .select('is_encrypted')
    .eq('id', id)
    .single()

  if (!existing) {
    return jsonResponse(404, { error: 'config_not_found' }, defaultCorsHeaders())
  }

  const updateData: Record<string, unknown> = {}

  if (body.value !== undefined) {
    const isEncrypted = existing.is_encrypted || body.is_encrypted

    if (isEncrypted && String(body.value)) {
      updateData.value = await encryptValue(String(body.value))
      updateData.is_encrypted = true
    } else {
      updateData.value = body.value !== null ? String(body.value) : null
    }
  }

  if (body.value_type !== undefined) updateData.value_type = String(body.value_type)
  if (body.description !== undefined) {
    updateData.description = body.description !== null ? String(body.description) : null
  }
  if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active)

  const { data, error } = await adminClient
    .from('app_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())
  if (!data) return jsonResponse(404, { error: 'config_not_found' }, defaultCorsHeaders())

  clearConfigCache()
  return jsonResponse(200, { ok: true, config: data }, defaultCorsHeaders())
}

// DELETE /app-config/:id - 删除配置
async function handleDelete(id: string, adminClient: ReturnType<typeof createClient>) {
  const { error } = await adminClient.from('app_configs').delete().eq('id', id)
  if (error) return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())

  clearConfigCache()
  return jsonResponse(200, { ok: true }, defaultCorsHeaders())
}

// POST /app-config/clear-cache - 清除配置缓存（管理员）
async function handleClearCache() {
  clearConfigCache()
  return jsonResponse(200, { ok: true }, defaultCorsHeaders())
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

  try {
    // 认证
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const sessionState = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') || ''
    })

    if (sessionState.state !== 'valid') {
      return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    }

    const adminClient = getAdminClient()

    // 检查管理员权限
    const { data: userData } = await adminClient.auth.adminGetUserById(sessionState.userId)
    const isAdmin = userData?.app_metadata?.is_admin === true

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)

    // 特殊端点：清除缓存
    if (req.method === 'POST' && pathParts[pathParts.length - 1] === 'clear-cache') {
      if (!isAdmin) return jsonResponse(403, { error: 'admin_required' }, corsHeaders)
      return handleClearCache()
    }

    // 非管理员只读
    if (req.method === 'GET') {
      const category = url.searchParams.get('category') || undefined
      return handleList(isAdmin, adminClient, category)
    }

    if (!isAdmin) {
      return jsonResponse(403, { error: 'admin_required' }, corsHeaders)
    }

    const id = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null
    const body = await req.json().catch(() => null)

    if (req.method === 'POST' && !id) {
      return handleCreate(sessionState.userId, body || {}, adminClient)
    }

    if (req.method === 'PATCH' && id) {
      return handleUpdate(id, body || {}, adminClient)
    }

    if (req.method === 'DELETE' && id) {
      return handleDelete(id, adminClient)
    }

    return jsonResponse(404, { error: 'not_found' }, corsHeaders)
  } catch (err) {
    console.error('app-config error:', err)
    return errorResponse(500, sanitizeError(err), corsHeaders)
  }
})
