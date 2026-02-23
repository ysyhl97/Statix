export function normalizeTable(rows) {
  const max = rows.reduce((m, r) => Math.max(m, r.length), 0)
  return rows.map((r) => {
    const out = Array.from({ length: max }, (_, i) => r[i] ?? '')
    return out
  })
}

export function normalizeCellText(input) {
  return String(input).replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim()
}

export function decodeEscapes(input) {
  const s = String(input ?? '')
  return s
    .replace(/\\\\/g, '\\')
    .replace(/\\r\\n/g, '\r\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

export function indexToLetters(index) {
  let n = Number(index) + 1
  if (!Number.isFinite(n) || n <= 0) return 'A'
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
