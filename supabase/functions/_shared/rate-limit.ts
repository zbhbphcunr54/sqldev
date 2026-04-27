type RateBucket = { count: number; windowStart: number }
type RateLimitAllowed = { ok: true; remaining: number }
type RateLimitBlocked = { ok: false; retryAfter: number }

export interface RateLimiterOptions {
  scope: string
  windowMs: number
  maxRequests: number
  trackMax: number
  storeMode: string
}

export function createRateLimiter(options: RateLimiterOptions) {
  const rateBuckets = new Map<string, RateBucket>()
  let kvPromise: Promise<Deno.Kv | null> | null = null
  const storeMode = String(options.storeMode || '').trim().toLowerCase()

  function pruneRateBuckets(now: number) {
    if (rateBuckets.size <= options.trackMax) return
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart >= options.windowMs) rateBuckets.delete(key)
      if (rateBuckets.size <= options.trackMax) return
    }
    let toDrop = rateBuckets.size - options.trackMax
    for (const key of rateBuckets.keys()) {
      if (toDrop <= 0) break
      rateBuckets.delete(key)
      toDrop -= 1
    }
  }

  function consumeRateLimitMemory(key: string, now = Date.now()): RateLimitAllowed | RateLimitBlocked {
    let bucket = rateBuckets.get(key)
    if (!bucket || now - bucket.windowStart >= options.windowMs) {
      bucket = { count: 0, windowStart: now }
      rateBuckets.set(key, bucket)
    }
    if (bucket.count >= options.maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((options.windowMs - (now - bucket.windowStart)) / 1000))
      return { ok: false, retryAfter }
    }
    bucket.count += 1
    pruneRateBuckets(now)
    return { ok: true, remaining: Math.max(0, options.maxRequests - bucket.count) }
  }

  async function getRateKv(): Promise<Deno.Kv | null> {
    if (storeMode !== 'kv') return null
    if (typeof Deno.openKv !== 'function') return null
    if (!kvPromise) {
      try {
        kvPromise = Deno.openKv().then((kv) => kv).catch(() => null)
      } catch (_err) {
        kvPromise = Promise.resolve(null)
      }
    }
    return await kvPromise
  }

  async function consume(key: string, now = Date.now()): Promise<RateLimitAllowed | RateLimitBlocked> {
    const kv = await getRateKv()
    if (!kv) return consumeRateLimitMemory(key, now)

    const windowStart = now - (now % options.windowMs)
    const windowIndex = Math.floor(now / options.windowMs)
    const retryAfter = Math.max(1, Math.ceil((options.windowMs - (now - windowStart)) / 1000))
    const expireIn = Math.max(1000, options.windowMs - (now - windowStart) + 1500)
    const kvKey: Deno.KvKey = ['rate_limit', options.scope, key, windowIndex]

    for (let i = 0; i < 6; i += 1) {
      const entry = await kv.get<RateBucket>(kvKey)
      const count = Number(entry.value?.count || 0)
      if (count >= options.maxRequests) return { ok: false, retryAfter }
      const next: RateBucket = { count: count + 1, windowStart }
      const commit = await kv.atomic().check(entry).set(kvKey, next, { expireIn }).commit()
      if (commit.ok) {
        return { ok: true, remaining: Math.max(0, options.maxRequests - next.count) }
      }
    }

    return consumeRateLimitMemory(key, now)
  }

  return { consume }
}
