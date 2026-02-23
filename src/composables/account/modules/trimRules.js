export const normalizeRuleList = (raw) =>
  String(raw || '')
    .split(/[,\n]/g)
    .map((v) => String(v || '').trim())
    .filter(Boolean)

export const defaultTrimRules = () => ({
  token: { enabled: true, prefixes: ['auth_token='], suffixes: [] },
})

export const normalizeTrimRules = (raw) => {
  const next = defaultTrimRules()
  if (!raw || typeof raw !== 'object') return next

  Object.entries(raw).forEach(([key, value]) => {
    if (!key || key === 'ignore') return
    const prefixes = Array.isArray(value?.prefixes)
      ? value.prefixes.map((v) => String(v || '').trim()).filter(Boolean)
      : []
    const suffixes = Array.isArray(value?.suffixes)
      ? value.suffixes.map((v) => String(v || '').trim()).filter(Boolean)
      : []
    next[key] = { enabled: value?.enabled !== false, prefixes, suffixes }
  })
  return next
}

export const EMPTY_TRIM_RULE = Object.freeze({ enabled: false, prefixes: [], suffixes: [] })

export const trimValueByRule = (value, rule) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (!rule?.enabled) return raw

  let next = raw
  const prefixes = [...(rule.prefixes || [])].sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (prefix && next.startsWith(prefix)) {
      next = next.slice(prefix.length).trim()
      break
    }
  }

  const suffixes = [...(rule.suffixes || [])].sort((a, b) => b.length - a.length)
  for (const suffix of suffixes) {
    if (suffix && next.endsWith(suffix)) {
      next = next.slice(0, next.length - suffix.length).trim()
      break
    }
  }
  return next
}

export const applyColumnTrimByRules = (row, rules) => {
  const next = { ...row }
  Object.entries(rules || {}).forEach(([fieldKey, rule]) => {
    if (!rule?.enabled) return
    if (!Object.prototype.hasOwnProperty.call(next, fieldKey)) return
    next[fieldKey] = trimValueByRule(next[fieldKey], rule)
  })
  return next
}
