import { normalizeCellText, normalizeTable } from './shared'

export function parseRtfTable(rtf) {
  const src = String(rtf || '')
  if (!src.trim()) return []

  const cpgMatch = src.match(/\\ansicpg(\d+)/i)
  const cpg = cpgMatch ? Number(cpgMatch[1]) : 1252
  const encoding =
    cpg === 65001
      ? 'utf-8'
      : cpg === 54936
        ? 'gb18030'
        : cpg === 936
          ? 'gbk'
          : cpg === 950
            ? 'big5'
            : cpg === 1252
              ? 'windows-1252'
              : 'utf-8'

  const decodeBytes = (() => {
    let decoder = null
    return (bytes) => {
      if (!bytes?.length) return ''

      try {
        if (!decoder && typeof TextDecoder !== 'undefined') decoder = new TextDecoder(encoding)
      } catch {
        try {
          decoder = new TextDecoder('utf-8')
        } catch {
          decoder = null
        }
      }

      if (decoder) {
        try {
          return decoder.decode(new Uint8Array(bytes))
        } catch {}
      }

      return bytes.map((b) => String.fromCharCode(b)).join('')
    }
  })()

  const ignoreDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'themedata',
    'datastore',
    'filetbl',
    'revtbl',
    'xmlnstbl',
    'generator',
  ])

  const rows = []
  let row = []
  let cell = ''
  let byteBuf = []
  let cellJustEnded = false

  let ucSkip = 1
  let unicodeSkip = 0

  const ignoreStack = []
  let ignorable = false

  const flushBytes = () => {
    if (!byteBuf.length) return
    cell += decodeBytes(byteBuf)
    byteBuf = []
    cellJustEnded = false
  }

  const appendText = (t) => {
    if (!t) return
    flushBytes()
    cell += t
    cellJustEnded = false
  }

  const endCell = () => {
    flushBytes()
    row.push(normalizeCellText(cell))
    cell = ''
    cellJustEnded = true
  }

  const endRow = () => {
    flushBytes()
    if (!cellJustEnded && (cell.length || byteBuf.length)) endCell()
    if (row.length) rows.push(row)
    row = []
    cell = ''
    byteBuf = []
    cellJustEnded = false
  }

  const len = src.length
  for (let i = 0; i < len; ) {
    if (unicodeSkip > 0) {
      const ch = src[i]
      if (ch === '\\') {
        const next = src[i + 1]
        if (next === "'") {
          i += 4
          unicodeSkip--
          continue
        }
        if (next === '\\' || next === '{' || next === '}') {
          i += 2
          unicodeSkip--
          continue
        }

        let j = i + 1
        while (j < len && /[a-zA-Z]/.test(src[j])) j++
        if (src[j] === '-') j++
        while (j < len && /[0-9]/.test(src[j])) j++
        if (src[j] === ' ') j++
        i = j
        unicodeSkip--
        continue
      }

      i++
      unicodeSkip--
      continue
    }

    const ch = src[i]
    if (ch === '{') {
      ignoreStack.push(ignorable)
      i++
      continue
    }
    if (ch === '}') {
      ignorable = ignoreStack.pop() || false
      i++
      continue
    }

    if (ch !== '\\') {
      if (!ignorable) appendText(ch)
      i++
      continue
    }

    const next = src[i + 1]

    if (next === '\\' || next === '{' || next === '}') {
      if (!ignorable) appendText(next)
      i += 2
      continue
    }

    if (next === "'") {
      if (!ignorable) {
        const hex = src.slice(i + 2, i + 4)
        const b = Number.parseInt(hex, 16)
        if (Number.isFinite(b)) byteBuf.push(b)
      }
      i += 4
      continue
    }

    if (next === '*') {
      ignorable = true
      i += 2
      continue
    }

    let j = i + 1
    while (j < len && /[a-zA-Z]/.test(src[j])) j++
    const word = src.slice(i + 1, j)

    let sign = 1
    if (src[j] === '-') {
      sign = -1
      j++
    }

    let num = ''
    while (j < len && /[0-9]/.test(src[j])) {
      num += src[j]
      j++
    }

    const hasParam = num.length > 0
    const param = hasParam ? sign * Number(num) : null

    if (src[j] === ' ') j++
    i = j

    if (!word) continue

    if (ignorable) continue
    if (ignoreDestinations.has(word)) {
      ignorable = true
      continue
    }

    if (word === 'uc' && hasParam) {
      ucSkip = Math.max(0, param || 0)
      continue
    }

    if (word === 'u' && hasParam) {
      const code = (param || 0) < 0 ? (param || 0) + 65536 : param || 0
      if (Number.isFinite(code)) appendText(String.fromCharCode(code))
      unicodeSkip = ucSkip
      continue
    }

    if (word === 'par' || word === 'line') {
      appendText('\n')
      continue
    }

    if (word === 'tab') {
      appendText('\t')
      continue
    }

    if (word === 'cell') {
      endCell()
      continue
    }

    if (word === 'row') {
      endRow()
      continue
    }
  }

  flushBytes()
  if (!cellJustEnded && (cell.length || byteBuf.length)) endCell()
  if (row.length) rows.push(row)

  return normalizeTable(rows)
}
