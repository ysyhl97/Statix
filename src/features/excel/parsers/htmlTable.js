import { normalizeCellText, normalizeTable } from './shared'

export function parseHtmlTable(html) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const tables = Array.from(doc.querySelectorAll('table'))
    if (!tables.length) return []

    const countCells = (t) => {
      try {
        return Array.from(t.rows || []).reduce((sum, r) => sum + (r.cells?.length || 0), 0)
      } catch {
        return 0
      }
    }

    const table = tables.reduce((best, t) => {
      const a = best ? countCells(best) : 0
      const b = countCells(t)
      return b > a ? t : best
    }, null)

    if (!table) return []

    const rows = []
    const pending = []
    const trs = Array.from(table.rows || [])

    for (const tr of trs) {
      const row = []

      for (let i = 0; i < pending.length; i++) {
        if (!pending[i]) continue
        row[i] = pending[i].value
        pending[i].rowsLeft -= 1
        if (pending[i].rowsLeft <= 0) pending[i] = null
      }

      const cells = Array.from(tr.cells || [])
      let col = 0

      for (const cell of cells) {
        while (row[col] !== undefined) col++

        const colspan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10))
        const rowspan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10))
        const text = normalizeCellText(cell.textContent || '')

        for (let c = 0; c < colspan; c++) {
          row[col + c] = text
          if (rowspan > 1) pending[col + c] = { value: text, rowsLeft: rowspan - 1 }
        }

        col += colspan
      }

      rows.push(row)
    }

    return normalizeTable(rows)
  } catch {
    return []
  }
}
