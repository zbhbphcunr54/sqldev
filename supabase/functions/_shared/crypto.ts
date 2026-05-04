/**
 * [2026-05-03] AES-256-GCM 加密工具
 * 用于加密/解密 AI 配置中的 API Key
 */
const ALGO = { name: 'AES-GCM', length: 256 }
const IV_LENGTH = 12
const TAG_LENGTH = 16

let cachedKey: CryptoKey | null = null

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const encryptKey = Deno.env.get('AI_CONFIG_ENCRYPT_KEY')
  if (!encryptKey) {
    throw new Error('AI_CONFIG_ENCRYPT_KEY environment variable is not set')
  }

  const raw = Uint8Array.from(atob(encryptKey), (c) => c.charCodeAt(0))
  cachedKey = await crypto.subtle.importKey('raw', raw, ALGO, false, ['encrypt', 'decrypt'])
  return cachedKey
}

/**
 * 加密明文字符串，返回 Uint8Array（包含 IV + 密文 + 认证标签）
 */
export async function encryptApiKey(plaintext: string): Promise<Uint8Array> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const enc = await crypto.subtle.encrypt(
    { ...ALGO, iv, tagLength: TAG_LENGTH * 8 },
    key,
    new TextEncoder().encode(plaintext)
  )

  const result = new Uint8Array(iv.length + enc.byteLength)
  result.set(iv)
  result.set(new Uint8Array(enc), iv.length)
  return result
}

/**
 * 解密加密数据（包含 IV + 密文 + 认证标签）
 */
export async function decryptApiKey(blob: Uint8Array): Promise<string> {
  const key = await getKey()
  const iv = blob.slice(0, IV_LENGTH)
  const enc = blob.slice(IV_LENGTH)

  const dec = await crypto.subtle.decrypt(
    { ...ALGO, iv, tagLength: TAG_LENGTH * 8 },
    key,
    enc
  )

  return new TextDecoder().decode(dec)
}

/**
 * 脱敏 API Key，返回 "sk-****xxxx" 格式
 */
export async function maskApiKey(encrypted: Uint8Array): Promise<string> {
  const plain = await decryptApiKey(encrypted)
  if (plain.length <= 8) return '****'
  return plain.slice(0, 4) + '****' + plain.slice(-4)
}

// ============================================================
// [2026-05-03] 新增：数据库存储用的加密/解密函数（Base64 编码）
// ============================================================

/**
 * 加密并返回 Base64 编码字符串（用于数据库 TEXT 存储）
 */
export async function encryptValue(plaintext: string): Promise<string> {
  const encrypted = await encryptApiKey(plaintext)
  return btoa(String.fromCharCode(...encrypted))
}

/**
 * 解密 Base64 编码的密文字符串
 */
export async function decryptValue(ciphertext: string): Promise<string> {
  const binary = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  return decryptApiKey(binary)
}
