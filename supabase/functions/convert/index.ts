import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

let engineReady = false
let convertDDLFn: ((input: string, from: string, to: string) => string) | null = null
let convertFunctionFn: ((input: string, from: string, to: string) => string) | null = null
let convertProcedureFn: ((input: string, from: string, to: string) => string) | null = null

async function ensureEngineReady() {
  if (engineReady) return
  const g = globalThis as Record<string, unknown>
  if (!g.localStorage) {
    g.localStorage = {
      getItem() {
        return null
      },
      setItem() {
        return undefined
      }
    }
  }
  await import('./samples.js')
  await import('./rules.js')
  const engineModule = (await import('./app-engine.js')) as {
    convertDDL?: (input: string, from: string, to: string) => string
    convertFunction?: (input: string, from: string, to: string) => string
    convertProcedure?: (input: string, from: string, to: string) => string
  }
  convertDDLFn = engineModule.convertDDL || null
  convertFunctionFn = engineModule.convertFunction || null
  convertProcedureFn = engineModule.convertProcedure || null
  engineReady = true
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  })
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7).trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'Server env missing SUPABASE_URL or SUPABASE_ANON_KEY' }, 500)
  }

  const token = bearerToken(req)
  if (!token) return json({ error: 'Unauthorized' }, 401)

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    const { data: userData, error: authError } = await authClient.auth.getUser()
    if (authError || !userData?.user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => null)
    const kind = String(body?.kind || '')
    const fromDb = String(body?.fromDb || '')
    const toDb = String(body?.toDb || '')
    const input = String(body?.input || '')

    if (!['ddl', 'func', 'proc'].includes(kind)) return json({ error: 'Invalid kind' }, 400)
    if (!['oracle', 'mysql', 'postgresql'].includes(fromDb) || !['oracle', 'mysql', 'postgresql'].includes(toDb)) {
      return json({ error: 'Invalid database type' }, 400)
    }
    if (!input.trim()) return json({ error: 'Input is empty' }, 400)
    if (input.length > 5 * 1024 * 1024) return json({ error: 'Input too large (max 5MB)' }, 400)

    await ensureEngineReady()
    let output = ''
    if (kind === 'ddl') {
      const fn = convertDDLFn
      if (typeof fn !== 'function') return json({ error: 'DDL engine not ready' }, 500)
      output = fn(input, fromDb, toDb)
    } else if (kind === 'func') {
      const fn = convertFunctionFn
      if (typeof fn !== 'function') return json({ error: 'Function engine not ready' }, 500)
      output = fn(input, fromDb, toDb)
    } else {
      const fn = convertProcedureFn
      if (typeof fn !== 'function') return json({ error: 'Procedure engine not ready' }, 500)
      output = fn(input, fromDb, toDb)
    }

    return json({ output, kind, fromDb, toDb })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
