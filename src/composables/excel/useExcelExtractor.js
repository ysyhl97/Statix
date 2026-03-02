import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { decodeEscapes, indexToLetters, parseHtmlTable, parsePlainText, parseRtfTable } from '../../features/excel/parsers'

export function useExcelExtractor() {
  
  const pastePad = ref('')
  const tableData = ref([])
  const parseSource = ref('')
  
  const controlTab = ref('settings')
  
  const selectedCols = ref([])
  const firstRowIsHeader = ref(false)
  
  const rowSeparatorInput = ref('\\n')
  const columnJoinerInput = ref('\\n')
  
  const enableIndex = ref(true)
  const indexStart = ref(1)
  const indexStep = ref(1)
  
  const trimCell = ref(true)
  const dropEmptyLines = ref(true)
  
  const applyIndexTpl = (tpl, indexVal) => {
    const raw = String(tpl ?? '')
  
    if (!enableIndex.value) {
      const cleaned = raw
        .replace(/(\{index\}|\{i\})\.\s*/g, '')
        .replace(/\{index\}|\{i\}/g, '')
      return decodeEscapes(cleaned)
    }
  
    const idx = String(indexVal ?? '')
    return decodeEscapes(raw.replace(/\{index\}|\{i\}/g, idx))
  }
  
  const tableRows = computed(() => tableData.value.length)
  const tableCols = computed(() => tableData.value.reduce((m, r) => Math.max(m, r.length), 0))
  
  const headerRow = computed(() => (firstRowIsHeader.value ? tableData.value[0] || [] : []))
  const dataRows = computed(() => (firstRowIsHeader.value ? tableData.value.slice(1) : tableData.value))
  
  const normalizeIndexList = (list, maxCols) => {
    const max = Math.max(0, Number(maxCols) || 0)
    const out = new Set()
    for (const v of Array.isArray(list) ? list : []) {
      const n = Number(v)
      if (!Number.isFinite(n)) continue
      const i = Math.trunc(n)
      if (i >= 0 && i < max) out.add(i)
    }
    return Array.from(out).sort((a, b) => a - b)
  }
  
  const selectedIndexes = computed(() => normalizeIndexList(selectedCols.value, tableCols.value))
  const selectedColSet = computed(() => new Set(selectedIndexes.value))
  const lastColClicked = ref(null)
  
  const columnOptions = computed(() => {
    const cols = tableCols.value
    const hintRow = firstRowIsHeader.value ? headerRow.value : tableData.value[0] || []
    return Array.from({ length: cols }, (_, i) => {
      const hint = hintRow?.[i] ? String(hintRow[i]) : ''
      const col = indexToLetters(i)
      return { value: i, col, hint, label: hint ? `${col} 路 ${hint}` : col }
    })
  })
  
  const onSelectedColsChange = () => {
    const normalized = selectedIndexes.value
    if (
      normalized.length !== selectedCols.value.length ||
      normalized.some((v, i) => v !== selectedCols.value[i])
    ) {
      selectedCols.value = normalized
    }
  }
  
  const selectFirstLast = () => {
    const max = tableCols.value
    if (!max) {
      selectedCols.value = []
      return
    }
    const last = max - 1
    selectedCols.value = last === 0 ? [0] : [0, last]
  }
  
  const selectAllCols = () => {
    const max = tableCols.value
    if (!max) {
      selectedCols.value = []
      return
    }
    selectedCols.value = Array.from({ length: max }, (_, i) => i)
  }
  
  const clearSelectedCols = () => {
    selectedCols.value = []
  }
  
  const toggleCol = (col, evt) => {
    const c = Math.trunc(Number(col))
    if (!Number.isFinite(c) || c < 0 || c >= tableCols.value) return
  
    const shift = !!evt?.shiftKey
  
    if (shift && Number.isFinite(lastColClicked.value)) {
      const a = Math.min(lastColClicked.value, c)
      const b = Math.max(lastColClicked.value, c)
      const range = Array.from({ length: b - a + 1 }, (_, i) => a + i)
      const set = new Set(selectedIndexes.value)
      const allSelected = range.every((i) => set.has(i))
      for (const i of range) {
        if (allSelected) set.delete(i)
        else set.add(i)
      }
      selectedCols.value = Array.from(set).sort((x, y) => x - y)
    } else {
      selectedCols.value = selectedColSet.value.has(c)
        ? selectedIndexes.value.filter((i) => i !== c)
        : [...selectedIndexes.value, c]
    }
  
    onSelectedColsChange()
    lastColClicked.value = c
  }
  
  const colFormats = ref([])
  
  watch(
    selectedIndexes,
    (idxs) => {
      const list = Array.isArray(idxs) ? idxs : []
      const first = list.length ? list[0] : null
      const byIndex = new Map((colFormats.value || []).map((c) => [c.index, c]))
      colFormats.value = list.map((i) => {
        const prev = byIndex.get(i)
        if (prev) return prev
        return { index: i, prefix: i === first ? '{index}.' : '', suffix: '' }
      })
    },
    { immediate: true }
  )
  
  const colFormatMap = computed(() => new Map((colFormats.value || []).map((c) => [c.index, c])))
  
  const applyWrapAll = (prefix, suffix) => {
    const p = String(prefix ?? '')
    const s = String(suffix ?? '')
    colFormats.value = (colFormats.value || []).map((c) => ({ ...c, prefix: p, suffix: s }))
  }
  
  const outputResult = computed(() => {
    if (!dataRows.value.length || !selectedIndexes.value.length) return { text: '', lineCount: 0, charCount: 0 }
  
    const rowSep = decodeEscapes(rowSeparatorInput.value || '\\n')
    const colSep = decodeEscapes(columnJoinerInput.value)
    const fmtMap = colFormatMap.value
  
    let outIdx = 0
    const lines = []
  
    for (let r = 0; r < dataRows.value.length; r++) {
      const row = dataRows.value[r] || []
  
      const indexVal = enableIndex.value ? String(indexStart.value + outIdx * indexStep.value) : ''
  
      const parts = selectedIndexes.value.map((ci) => {
        const fmt = fmtMap.get(ci)
        const prefix = applyIndexTpl(fmt?.prefix, indexVal)
        const suffix = applyIndexTpl(fmt?.suffix, indexVal)
        let value = row?.[ci] ?? ''
        if (trimCell.value && typeof value === 'string') value = value.trim()
        return `${prefix}${value}${suffix}`
      })
  
      const line = parts.join(colSep)
      if (dropEmptyLines.value && !line.trim()) continue
      lines.push(line)
      outIdx++
    }
  
    const text = lines.join(rowSep)
    return { text, lineCount: lines.length, charCount: text.length }
  })
  
  const outputText = computed(() => outputResult.value.text)
  const outputLineCount = computed(() => outputResult.value.lineCount)
  const outputCharCount = computed(() => outputResult.value.charCount)
  
  const previewColIndexes = computed(() => Array.from({ length: tableCols.value }, (_, i) => i))
  const previewRowStart = computed(() => (firstRowIsHeader.value ? 2 : 1))
  const previewRows = computed(() => dataRows.value.slice(0, 12))
  
  const readItemString = (item) =>
    new Promise((resolve) => {
      try {
        item.getAsString((s) => resolve(String(s ?? '')))
      } catch (e) {
        resolve('')
      }
    })
  
  const handlePaste = async (e) => {
    const cd = e?.clipboardData
  
    let html = ''
    let rtf = ''
    let text = ''
  
    try {
      html = cd?.getData('text/html') || ''
    } catch (err) {}
  
    try {
      rtf = cd?.getData('text/rtf') || ''
    } catch (err) {}
  
    try {
      text = cd?.getData('text/plain') || ''
    } catch (err) {}
  
    if ((!html || !rtf || !text) && cd?.items?.length) {
      const items = Array.from(cd.items)
      for (const item of items) {
        if (!html && item.type === 'text/html') html = await readItemString(item)
        if (!rtf && item.type === 'text/rtf') rtf = await readItemString(item)
        if (!text && item.type === 'text/plain') text = await readItemString(item)
        if (html && text) break
      }
    }
  
    // In some environments event.clipboardData returns empty; try Clipboard API as a fallback (requires secure context).
    if ((!html || !rtf || !text) && navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read()
        for (const item of items) {
          if (!html && item.types?.includes('text/html')) {
            const blob = await item.getType('text/html')
            html = await blob.text()
          }
          if (!rtf && item.types?.includes('text/rtf')) {
            const blob = await item.getType('text/rtf')
            rtf = await blob.text()
          }
          if (!text && item.types?.includes('text/plain')) {
            const blob = await item.getType('text/plain')
            text = await blob.text()
          }
          if (html && text) break
        }
      } catch (err) {}
    }
  
    if (!html && !rtf && !text) return
    e.preventDefault()
  
    pastePad.value = ''
  
    let parsed = []
    let used = ''
  
    if (html) {
      parsed = parseHtmlTable(html)
      if (parsed.length) used = 'html'
    }
  
    if (!parsed.length && rtf) {
      parsed = parseRtfTable(rtf)
      if (parsed.length) used = 'rtf'
    }
  
    if (!parsed.length && text) {
      parsed = parsePlainText(text)
      if (parsed.length) used = 'text'
    }
  
    if (!parsed.length) {
      tableData.value = []
      parseSource.value = ''
      ElMessage.warning('未识别到表格内容')
      return
    }
  
    tableData.value = parsed
    parseSource.value = used
    selectFirstLast()
    ElMessage.success(`已识别 ${parsed.length} 行 × ${parsed[0]?.length || 0} 列`)
  }
  
  const clearAll = () => {
    pastePad.value = ''
    tableData.value = []
    parseSource.value = ''
    selectedCols.value = []
    lastColClicked.value = null
    controlTab.value = 'settings'
  }
  
  const copyText = async (txt, okMsg) => {
    const text = String(txt ?? '')
    if (!text) {
      ElMessage.warning('没有可复制的内容')
      return false
    }
  
    const msg = String(okMsg || '已复制')
  
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success({ message: msg, duration: 900, grouping: true })
      return true
    } catch (e) {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      ElMessage.success({ message: msg, duration: 900, grouping: true })
      return true
    }
  }
  
  const handleOutputClick = async (evt) => {
    const txt = outputText.value
    if (!txt) {
      ElMessage.warning('没有可复制的内容')
      return
    }
  
    await copyText(txt, '已复制全部')
  }
  
  const downloadResult = () => {
    const txt = outputText.value
    if (!txt) {
      ElMessage.warning('没有可下载的内容')
      return
    }
  
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `excel_extract_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return {
    pastePad,
    tableData,
    parseSource,
    controlTab,
    selectedCols,
    firstRowIsHeader,
    rowSeparatorInput,
    columnJoinerInput,
    enableIndex,
    indexStart,
    indexStep,
    trimCell,
    dropEmptyLines,
    tableRows,
    tableCols,
    headerRow,
    selectedIndexes,
    selectedColSet,
    columnOptions,
    selectFirstLast,
    selectAllCols,
    clearSelectedCols,
    toggleCol,
    colFormats,
    applyWrapAll,
    outputText,
    outputLineCount,
    outputCharCount,
    previewColIndexes,
    previewRowStart,
    previewRows,
    handlePaste,
    clearAll,
    handleOutputClick,
    downloadResult,
    indexToLetters,
  }
}
