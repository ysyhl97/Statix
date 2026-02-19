const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const base32ToBytes = (input) => {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '')
  if (!cleaned) return null
  let bits = ''
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx < 0) return null
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return new Uint8Array(bytes)
}

const parseOtpAuth = (uri) => {
  try {
    const url = new URL(String(uri || '').trim())
    if (url.protocol !== 'otpauth:' || url.hostname !== 'totp') return null
    const secret = url.searchParams.get('secret') || ''
    const digits = Number.parseInt(url.searchParams.get('digits') || '6', 10)
    const period = Number.parseInt(url.searchParams.get('period') || '30', 10)
    const algorithm = String(url.searchParams.get('algorithm') || 'SHA1').toUpperCase()
    return { secret, digits: Number.isFinite(digits) ? digits : 6, period: Number.isFinite(period) ? period : 30, algorithm }
  } catch {
    return null
  }
}

const toCounterBytes = (counter) => {
  const out = new Uint8Array(8)
  let n = BigInt(counter)
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}

const algoName = (algorithm) => {
  const a = String(algorithm || 'SHA1').toUpperCase()
  if (a === 'SHA256') return 'SHA-256'
  if (a === 'SHA512') return 'SHA-512'
  return 'SHA-1'
}

const hotp = async (secretBytes, counter, digits, algorithm) => {
  if (!globalThis.crypto?.subtle) return ''
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: algoName(algorithm) }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, toCounterBytes(counter)))
  const offset = mac[mac.length - 1] & 0x0f
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff)
  const mod = 10 ** Math.max(6, Math.min(10, digits || 6))
  return String(code % mod).padStart(Math.max(6, Math.min(10, digits || 6)), '0')
}

export const generateCurrentOtp = async (value) => {
  const payload = await generateCurrentOtpPayload(value)
  return payload.code
}

export const generateCurrentOtpPayload = async (value) => {
  const raw = String(value || '').trim()
  if (!raw) return { code: '', period: 30, remaining: 0, expiresAt: 0, isValid: false }
  const parsed = raw.startsWith('otpauth://') ? parseOtpAuth(raw) : null
  const secret = parsed?.secret || raw
  const digits = parsed?.digits || 6
  const period = parsed?.period || 30
  const algorithm = parsed?.algorithm || 'SHA1'
  const safePeriod = Math.max(1, period)
  const secretBytes = base32ToBytes(secret)
  if (!secretBytes?.length) return { code: '', period: safePeriod, remaining: 0, expiresAt: 0, isValid: false }
  const nowSec = Date.now() / 1000
  const counter = Math.floor(nowSec / safePeriod)
  const remaining = Math.max(1, safePeriod - Math.floor(nowSec % safePeriod))
  const expiresAt = (counter + 1) * safePeriod * 1000
  try {
    const code = await hotp(secretBytes, counter, digits, algorithm)
    if (!code) return { code: '', period: safePeriod, remaining: 0, expiresAt: 0, isValid: false }
    return { code, period: safePeriod, remaining, expiresAt, isValid: true }
  } catch {
    return { code: '', period: safePeriod, remaining: 0, expiresAt: 0, isValid: false }
  }
}
