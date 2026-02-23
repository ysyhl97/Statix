import { normalizeCellText, normalizeTable } from './shared'

export function parsePlainText(text) {
  const t = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!t.trim()) return []

  const lines = t.split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()

  const colCounts = lines.map((line) => line.split('\t').length)
  const expectedCols = Math.max(1, ...colCounts)

  const rows = []
  let current = null

  for (const line of lines) {
    const parts = line.split('\t')
    if (!current) {
      current = parts
      continue
    }

    // If a cell contains newlines, "text/plain" may break a single row into multiple lines.
    // When either side is still short of expected columns, treat this as continuation of last cell.
    if (expectedCols > 1 && (current.length < expectedCols || parts.length < expectedCols)) {
      const last = Math.max(0, current.length - 1)
      current[last] = `${current[last]}\n${parts[0] ?? ''}`
      current.push(...parts.slice(1))
      continue
    }

    rows.push(current)
    current = parts
  }

  if (current) rows.push(current)
  return normalizeTable(rows.map((r) => (r || []).map((c) => normalizeCellText(c))))
}
