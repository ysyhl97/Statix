const DEFAULT_DELIMITERS = ['----', '---', '--', ':--', '::', ':', '|', '\t', ',', ';', '@']
const STANDARD_FIELDS = ['account', 'password', 'twofa', 'recovery_email', 'recovery_email_password', 'token', 'cookie']
const EXTRA_LIMIT = 6

export const BUILTIN_PARSE_TEMPLATES = []

const normalizeToken = (token) =>
  String(token || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[—–﹣]/g, '-')
    .replace(/[：﹕]/g, ':')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')

const normalizeLine = (line) => normalizeToken(String(line || '').replace(/\s+/g, ' '))
const isLikelyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
const isLikely2FA = (value) => {
  const v = String(value || '').trim()
  if (!v) return false
  if (v.startsWith('otpauth://')) return true
  return /^[A-Z2-7]{16,}$/.test(v.replace(/\s+/g, '').toUpperCase())
}
const isLikelyCookie = (value) => {
  const v = String(value || '')
  return v.includes('=') && v.includes(';')
}
const isLikelyToken = (value) => {
  const v = String(value || '').trim()
  return /^[A-Fa-f0-9]{32,}$/.test(v) || /^[A-Za-z0-9_-]{24,}$/.test(v)
}
const isLikelyAccount = (value) => {
  const v = String(value || '').trim()
  if (!v) return false
  if (isLikelyEmail(v)) return true
  return /^[A-Za-z0-9._-]{3,}$/.test(v)
}
const isLikelyPassword = (value) => String(value || '').length >= 1

const splitByDelimiter = (line, delimiter) => {
  if (!delimiter) return [line]
  return String(line || '')
    .split(delimiter)
    .map((part) => normalizeToken(part))
    .filter((part) => part !== '')
}

const scoreAccountPasswordPair = (account, password) => {
  let score = 0
  if (isLikelyAccount(account)) score += 8
  if (isLikelyPassword(password)) score += 6
  if (isLikelyEmail(account)) score += 4
  if (String(password || '').includes(' ')) score -= 2
  if (!String(password || '').trim()) score -= 10
  return score
}

const splitAtToken = (line, index, token) => {
  const left = normalizeToken(String(line || '').slice(0, index))
  const right = normalizeToken(String(line || '').slice(index + token.length))
  return [left, right].filter((part) => part !== '')
}

const splitByAtSafely = (line) => {
  const raw = String(line || '')
  const atIndexes = []
  for (let i = 0; i < raw.length; i += 1) if (raw[i] === '@') atIndexes.push(i)
  if (!atIndexes.length) return { parts: [normalizeLine(raw)], confidence: 0, ambiguous: false }

  const candidates = atIndexes.map((atIndex) => {
    const pair = splitAtToken(raw, atIndex, '@')
    const account = pair[0] || ''
    const password = normalizeToken(String(raw).slice(atIndex + 1))
    return { parts: [account, password].filter(Boolean), score: scoreAccountPasswordPair(account, password) }
  })

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const second = candidates[1]
  const ambiguous = !!second && Math.abs(best.score - second.score) <= 2
  const confidence = Math.max(0, Math.min(100, (best.score + 2) * 7))
  return { parts: best.parts, confidence, ambiguous }
}

const scoreParts = (parts, delimiter) => {
  if (!parts || parts.length < 2) return -999
  let score = 0
  if (parts[0]) score += 6
  if (parts[1]) score += 6
  if (parts.length >= 3) score += 2
  if (parts.some((part) => isLikely2FA(part))) score += 3
  if (parts.some((part) => isLikelyEmail(part))) score += 2
  if (parts.length > 10) score -= 2
  if (delimiter && delimiter.length <= 2 && parts.length > 8) score -= 2
  return score
}

const splitWithProfile = (line, delimiter) => {
  if (delimiter === '@') return splitByAtSafely(line)
  const parts = splitByDelimiter(line, delimiter)
  return { parts, confidence: Math.max(0, Math.min(100, scoreParts(parts, delimiter) * 5)), ambiguous: false }
}

const countOccurrences = (line, delimiter) => {
  const raw = String(line || '')
  if (!delimiter || !raw) return 0
  let count = 0
  let index = 0
  while (index <= raw.length - delimiter.length) {
    const found = raw.indexOf(delimiter, index)
    if (found === -1) break
    count += 1
    index = found + delimiter.length
  }
  return count
}

const buildDelimiterCandidates = (preferredDelimiter = '', legacyManualDelimiter = '') => {
  const set = new Set(DEFAULT_DELIMITERS)
  if (legacyManualDelimiter) set.add(legacyManualDelimiter)
  const defaults = [...set].sort((a, b) => b.length - a.length)
  if (!preferredDelimiter) return defaults
  return [preferredDelimiter, ...defaults.filter((item) => item !== preferredDelimiter)]
}

const buildDelimiterScores = (lines, preferredDelimiters) => {
  const results = []
  for (const delimiter of preferredDelimiters) {
    let totalScore = 0
    let validRows = 0
    let confidenceSum = 0
    let ambiguousRows = 0
    let hitLines = 0
    let collisionRows = 0
    for (const line of lines) {
      const splitResult = splitWithProfile(line, delimiter)
      const parts = splitResult.parts
      const score = scoreParts(parts, delimiter)
      const occurrences = countOccurrences(line, delimiter)
      totalScore += score
      confidenceSum += splitResult.confidence || 0
      if (splitResult.ambiguous) ambiguousRows += 1
      if (occurrences > 0) hitLines += 1
      const validPair = parts.length >= 2 && String(parts[0] || '').trim() && String(parts[1] || '').trim()
      if (validPair) validRows += 1
      if (delimiter.length <= 2 && occurrences >= 2 && !validPair) collisionRows += 1
    }

    const lineCount = lines.length || 1
    const successRate = validRows / lineCount
    const coverageRate = hitLines / lineCount
    const confidence = Math.round(confidenceSum / lineCount)
    const finalScore = totalScore + validRows * 8 + successRate * 50 + coverageRate * 18 + confidence * 0.25 - ambiguousRows * 14 - collisionRows * 18
    results.push({ delimiter, score: Math.round(finalScore), successRate: Number(successRate.toFixed(3)), confidence, ambiguousRows, hitLines, validRows, collisionRows })
  }
  return results.sort((a, b) => b.score - a.score)
}

const chooseBatchDelimiter = (candidates, preferredDelimiter) => {
  if (!candidates.length) return { delimiter: preferredDelimiter || '' }
  const best = candidates[0]
  if (!preferredDelimiter) return best
  const preferred = candidates.find((item) => item.delimiter === preferredDelimiter)
  if (!preferred) return best
  if (preferred.score >= best.score - 10) return preferred
  return best
}

const evaluateLineParts = (parts, splitResult, delimiter, strictMode, minConfidence) => {
  if (parts.length < 2) return { ok: false, reason: 'NO_DELIMITER' }
  const confidenceRaw = Math.max(0, Math.min(100, splitResult.confidence || scoreParts(parts, delimiter) * 5))
  if (strictMode && confidenceRaw < minConfidence) return { ok: false, reason: 'LOW_CONFIDENCE', detail: `confidence=${confidenceRaw}`, confidenceRaw }
  return { ok: true, confidenceRaw }
}

const tryFallbackLine = (line, index, primaryDelimiter, candidates, strictMode, minConfidence) => {
  let best = null
  for (const candidate of candidates) {
    if (!candidate?.delimiter || candidate.delimiter === primaryDelimiter) continue
    const splitResult = splitWithProfile(line, candidate.delimiter)
    const parts = splitResult.parts
    const evaluation = evaluateLineParts(parts, splitResult, candidate.delimiter, strictMode, minConfidence)
    if (!evaluation.ok) continue
    const rank = scoreParts(parts, candidate.delimiter) + (evaluation.confidenceRaw || 0) / 10
    if (!best || rank > best.rank) best = { parts, delimiter: candidate.delimiter, confidenceRaw: evaluation.confidenceRaw, rank }
  }
  return best ? { ...best, sourceLine: index + 1 } : null
}

const buildFailure = (lineNo, raw, delimiterGuess, tokens, reason, detail = '') => ({
  id: `${Date.now()}_${lineNo}_${Math.random().toString(36).slice(2, 8)}`,
  line: lineNo,
  raw,
  delimiterGuess,
  tokens,
  reason,
  detail,
  suggestionKey: `${delimiterGuess || 'none'}__${tokens.length}__${tokens
    .map((value) => {
      if (isLikelyEmail(value)) return 'email'
      if (isLikely2FA(value)) return '2fa'
      if (isLikelyCookie(value)) return 'cookie'
      if (isLikelyToken(value)) return 'token'
      return 'text'
    })
    .join('-')}`,
})

const mapByRoles = (tokens, positionRoles = [], customRoleKeys = []) => {
  const row = { account: '', password: '', twofa: '', recovery_email: '', recovery_email_password: '', token: '', cookie: '' }
  const extras = []
  const customSet = new Set(customRoleKeys)

  tokens.forEach((token, index) => {
    const value = String(token || '').trim()
    if (!value) return
    const role = positionRoles[index] || (index === 0 ? 'account' : index === 1 ? 'password' : 'ignore')
    if (role === 'account' && !row.account) row.account = value
    else if (role === 'password' && !row.password) row.password = value
    else if (role === 'twofa' && !row.twofa) row.twofa = value
    else if (role === 'token' && !row.token) row.token = value
    else if (role === 'cookie' && !row.cookie) row.cookie = value
    else if (role === 'recovery_email' && !row.recovery_email) row.recovery_email = value
    else if (role === 'recovery_email_password' && !row.recovery_email_password) row.recovery_email_password = value
    else if (customSet.has(role)) {
      if (!row[role]) row[role] = value
    } else if (role !== 'ignore') {
      if (!row[role]) row[role] = value
    }
    else extras.push(value)
  })

  const projected = {}
  for (let i = 0; i < EXTRA_LIMIT; i += 1) projected[`extra_${i + 1}`] = extras[i] || ''
  projected.overflow = extras.length > EXTRA_LIMIT ? extras.slice(EXTRA_LIMIT).join(' | ') : ''
  return { ...row, ...projected, tokens: [...tokens] }
}

export function parseAccountBatch(rawInput, options = {}) {
  const legacyMode = options.mode || ''
  const legacyManualDelimiter = String(options.manualDelimiter || '').trim()
  const preferredDelimiter = String(options.preferredDelimiter || '').trim() || (legacyMode === 'manual' ? legacyManualDelimiter : '')
  const strictMode = options.strictMode !== false
  const minConfidence = Number.isFinite(options.minConfidence) ? options.minConfidence : 60
  const positionRoles = Array.isArray(options.positionRoles) ? options.positionRoles.map((v) => String(v || '').trim()) : []
  const customRoleKeys = Array.isArray(options.customRoleKeys) ? options.customRoleKeys.map((v) => String(v || '').trim()).filter(Boolean) : []
  const delimiterCandidates = buildDelimiterCandidates(preferredDelimiter, legacyManualDelimiter)

  const lines = String(rawInput || '')
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean)

  if (!lines.length) {
    return {
      parsedRows: [],
      failedRows: [],
      profile: { delimiterMode: 'fixed', delimiter: '', confidence: 0, candidates: [], warnings: [], fallbackRows: 0, statsByDelimiter: [] },
      stats: { total: 0, success: 0, failed: 0 },
    }
  }

  const candidates = buildDelimiterScores(lines, delimiterCandidates)
  const batchCandidate = chooseBatchDelimiter(candidates, preferredDelimiter)
  const batchDelimiter = batchCandidate?.delimiter || preferredDelimiter || delimiterCandidates[0] || ''
  const warnings = []
  if (candidates.length > 1) {
    const best = candidates[0]
    const second = candidates[1]
    if (best && second && Math.abs(best.score - second.score) <= 12) warnings.push('分隔符候选分数接近，存在批次歧义')
  }
  if ((batchCandidate?.collisionRows || 0) > 0) warnings.push('检测到短分隔符冲突行，已对失败行执行回退解析')

  const parsedRows = []
  const failedRows = []
  let fallbackRows = 0

  lines.forEach((line, index) => {
    const primarySplit = splitWithProfile(line, batchDelimiter)
    const primaryEval = evaluateLineParts(primarySplit.parts, primarySplit, batchDelimiter, strictMode, minConfidence)
    let finalParts = primarySplit.parts
    let finalDelimiter = batchDelimiter
    let finalConfidence = primaryEval.confidenceRaw || 0
    let isValid = primaryEval.ok
    let failReason = primaryEval.reason
    let failDetail = primaryEval.detail || ''

    if (!primaryEval.ok) {
      const fallback = tryFallbackLine(line, index, batchDelimiter, candidates.slice(0, 3), strictMode, minConfidence)
      if (fallback) {
        finalParts = fallback.parts
        finalDelimiter = fallback.delimiter
        finalConfidence = fallback.confidenceRaw
        isValid = true
        fallbackRows += 1
      }
    }

    if (!isValid) {
      const fallbackTokens = line.split(/\s+/g).map((token) => normalizeToken(token)).filter(Boolean)
      failedRows.push(buildFailure(index + 1, line, finalDelimiter, fallbackTokens, failReason || 'NO_DELIMITER', failDetail))
      return
    }

    const row = mapByRoles(finalParts, positionRoles, customRoleKeys)
    parsedRows.push({
      ...row,
      meta: { delimiter: finalDelimiter, confidence: finalConfidence, sourceLine: index + 1 },
    })
  })

  const confidence = parsedRows.length ? Math.round(parsedRows.reduce((sum, row) => sum + (row.meta?.confidence || 0), 0) / parsedRows.length) : 0
  return {
    parsedRows,
    failedRows,
    profile: { delimiterMode: 'fixed', delimiter: batchDelimiter, confidence, candidates: candidates.slice(0, 5), warnings, fallbackRows, statsByDelimiter: candidates.slice(0, 5) },
    stats: { total: lines.length, success: parsedRows.length, failed: failedRows.length },
  }
}

export function guessTokenRole(token, index) {
  if (index === 0 && isLikelyAccount(token)) return 'account'
  if (index === 1) return 'password'
  if (isLikely2FA(token)) return 'twofa'
  if (isLikelyEmail(token)) return 'recovery_email'
  if (isLikelyCookie(token)) return 'cookie'
  if (isLikelyToken(token)) return 'token'
  return 'ignore'
}

export { STANDARD_FIELDS }
