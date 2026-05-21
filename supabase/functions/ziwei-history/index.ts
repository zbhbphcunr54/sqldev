import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/response.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  allowMethods: 'OPTIONS'
})

await initCorsConfig()

Deno.serve((req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    if (!corsHeaders) {
      return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    }
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) {
    return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
  }

  return jsonResponse(
    410,
    {
      ok: false,
      error: 'ziwei_history_removed',
      message: '紫微历史查询功能已下线'
    },
    corsHeaders
  )
})
