<template>
  <div v-cloak>
    <div class="app-wrapper excel-page">
      <TopNav>
        <template #center>
          <div class="search-container">
            <div class="hub-intro">
              <div class="hub-title">Excel列提取 / 格式化</div>
              <div class="hub-sub">复制 Excel 多行多列内容，按列提取并输出文本</div>
            </div>
          </div>
        </template>

        <template #actions>
          <div class="excel-nav-right">
            <div class="excel-nav-status" v-if="tableData.length">
              <span class="excel-nav-dot" aria-hidden="true"></span>
              <span>{{ tableRows }}×{{ tableCols }}</span>
              <span class="excel-nav-sep" aria-hidden="true">·</span>
              <span>已选 {{ selectedCols.length }} 列</span>
            </div>
            <div class="excel-nav-orbs" aria-hidden="true">
              <span class="excel-nav-orb excel-nav-orb--1"></span>
              <span class="excel-nav-orb excel-nav-orb--2"></span>
              <span class="excel-nav-orb excel-nav-orb--3"></span>
            </div>
          </div>
        </template>
      </TopNav>

      <div class="excel-layout">
        <div class="excel-column excel-column--main">
          <div class="pane-card">
            <div class="pane-title">输入（粘贴）</div>
            <el-input
              v-model="pastePad"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 2 }"
              placeholder="点击这里粘贴 (Ctrl+V)。将优先读取剪贴板的 HTML/RTF 表格并立即解析。"
              class="dialog-input excel-paste-input"
              @paste="handlePaste"
            />
            <div class="pane-hint">粘贴后这里不保留内容；请在“预览”中确认解析是否与 Excel 一致。</div>
            <div class="pane-meta" v-if="tableData.length">
              已识别 {{ tableRows }} 行 × {{ tableCols }} 列（{{
                parseSource === 'html' ? 'HTML 表格' : parseSource === 'rtf' ? 'RTF 表格' : '文本'
              }}）
            </div>
          </div>

          <div class="pane-card excel-control-card">
            <el-tabs v-model="controlTab" class="excel-control-tabs" stretch>
              <el-tab-pane name="settings">
                <template #label>
                  <span class="excel-tab-label">
                    <span class="excel-tab-dot" aria-hidden="true"></span>
                    设置
                  </span>
                </template>
                <div class="excel-settings-grid">
                  <div class="excel-settings-box excel-settings-box--wide">
                    <div class="excel-settings-head">
                      <div class="excel-settings-title">列选择</div>
                      <div class="excel-settings-sub" v-if="tableCols">
                        已选 {{ selectedCols.length }} / {{ tableCols }}（Shift 连选）
                      </div>
                      <div class="excel-settings-sub" v-else>粘贴后可选列</div>
                    </div>

                    <div class="excel-form-grid excel-form-grid--2">
                      <div>
                        <label class="form-label">提取列（默认首列 + 末列）</label>

                        <div class="excel-col-grid" :class="{ 'is-disabled': !tableCols }">
                          <button
                            v-for="opt in columnOptions"
                            :key="opt.value"
                            type="button"
                            class="excel-col-pill"
                            :class="{ 'is-selected': selectedColSet.has(opt.value) }"
                            :disabled="!tableCols"
                            @click="toggleCol(opt.value, $event)"
                          >
                            <span class="excel-col-pill-letter">{{ opt.col }}</span>
                            <span v-if="opt.hint" class="excel-col-pill-hint">{{ opt.hint }}</span>
                          </button>
                        </div>

                        <div class="excel-col-actions">
                          <el-button size="small" @click="selectFirstLast" :disabled="!tableCols">
                            首+末
                          </el-button>
                          <el-button size="small" @click="selectAllCols" :disabled="!tableCols"
                            >全选</el-button
                          >
                          <el-button
                            size="small"
                            @click="clearSelectedCols"
                            :disabled="!selectedCols.length"
                          >
                            清空
                          </el-button>
                        </div>
                      </div>
                      <div>
                        <label class="form-label">首行是表头（不参与输出）</label>
                        <el-switch v-model="firstRowIsHeader" />
                      </div>
                    </div>
                  </div>

                  <div class="excel-settings-box">
                    <div class="excel-settings-head">
                      <div class="excel-settings-title">序号</div>
                      <div class="excel-settings-sub">变量 {index}</div>
                    </div>

                    <div class="excel-form-grid excel-form-grid--3">
                      <div>
                        <label class="form-label">启用</label>
                        <el-switch v-model="enableIndex" />
                      </div>
                      <div>
                        <label class="form-label">开头</label>
                        <el-input-number
                          v-model="indexStart"
                          :min="-999999"
                          :max="999999"
                          :disabled="!enableIndex"
                        />
                      </div>
                      <div>
                        <label class="form-label">步进</label>
                        <el-input-number
                          v-model="indexStep"
                          :min="-999999"
                          :max="999999"
                          :disabled="!enableIndex"
                        />
                      </div>
                    </div>

                    <div class="pane-hint">
                      在“列格式”的前缀/后缀里写 {index} 即可（默认第一列前缀是 "{index}. "）。
                    </div>
                  </div>

                  <div class="excel-settings-box">
                    <div class="excel-settings-head">
                      <div class="excel-settings-title">输出</div>
                      <div class="excel-settings-sub">分隔符 / 清理</div>
                    </div>

                    <div class="excel-form-grid excel-form-grid--2">
                      <div>
                        <label class="form-label">行分隔符</label>
                        <el-input v-model="rowSeparatorInput" placeholder="默认 \\n" class="dialog-input" />
                        <div class="pane-hint">支持转义：\\n \\r\\n \\t</div>
                      </div>
                      <div>
                        <label class="form-label">列连接符</label>
                        <el-input v-model="columnJoinerInput" placeholder="默认 \\n" class="dialog-input" />
                        <div class="pane-hint">用于拼接同一行内的多列输出</div>
                      </div>
                    </div>

                    <div class="excel-form-grid excel-form-grid--2">
                      <div class="excel-inline">
                        <el-switch v-model="trimCell" />
                        <span class="excel-inline-label">去掉单元格首尾空格</span>
                      </div>
                      <div class="excel-inline">
                        <el-switch v-model="dropEmptyLines" />
                        <span class="excel-inline-label">删除空行输出</span>
                      </div>
                    </div>
                  </div>

                  <div class="excel-settings-box excel-settings-box--wide">
                    <div class="excel-settings-head">
                      <div class="excel-settings-title">列格式</div>
                      <div class="excel-settings-sub">每列前缀 / 后缀</div>
                    </div>

                    <div class="pane-hint" v-if="!selectedIndexes.length">请先选择要提取的列。</div>

                    <template v-else>
                      <div class="pane-hint">支持变量：{index}｜支持转义：\\t \\n</div>

                      <div class="excel-wrap-actions">
                        <el-button size="small" @click="applyWrapAll('', '')">清空全部</el-button>
                      </div>

                      <div class="excel-colfmt-list">
                        <div v-for="c in colFormats" :key="c.index" class="excel-colfmt-row">
                          <div class="excel-colfmt-label">
                            <div class="excel-colfmt-letter">{{ indexToLetters(c.index) }}</div>
                            <div class="excel-colfmt-name" v-if="headerRow[c.index]">
                              {{ headerRow[c.index] }}
                            </div>
                          </div>

                          <el-input
                            v-model="c.prefix"
                            size="small"
                            placeholder="前缀"
                            class="dialog-input mini-input"
                          />
                          <el-input
                            v-model="c.suffix"
                            size="small"
                            placeholder="后缀"
                            class="dialog-input mini-input"
                          />
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane
                name="preview"
                :disabled="!tableData.length"
              >
                <template #label>
                  <span class="excel-tab-label">
                    <span class="excel-tab-dot excel-tab-dot--sub" aria-hidden="true"></span>
                    预览
                  </span>
                </template>
                <div class="pane-hint" v-if="!tableData.length">请先粘贴 Excel 内容。</div>

                <template v-else>
                  <div class="pane-hint">用于检查行列结构是否解析正确（内容会省略显示）。</div>

                  <div class="excel-preview-table">
                    <table>
                      <thead>
                        <tr>
                          <th class="excel-preview-corner"></th>
                          <th
                            v-for="ci in previewColIndexes"
                            :key="ci"
                            :class="{ 'is-selected': selectedColSet.has(ci) }"
                            @click="toggleCol(ci, $event)"
                          >
                            {{ indexToLetters(ci) }}
                          </th>
                        </tr>
                        <tr v-if="firstRowIsHeader">
                          <th class="excel-preview-corner"></th>
                          <th
                            v-for="ci in previewColIndexes"
                            :key="ci"
                            :class="{ 'is-selected': selectedColSet.has(ci) }"
                            @click="toggleCol(ci, $event)"
                            :title="String(headerRow[ci] ?? '')"
                          >
                            <span v-if="String(headerRow[ci] ?? '')" class="excel-preview-cell">
                              {{ headerRow[ci] }}
                            </span>
                            <span v-else class="excel-preview-empty">(空)</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(r, ri) in previewRows" :key="ri">
                          <td class="excel-preview-rowno">{{ previewRowStart + ri }}</td>
                          <td
                            v-for="ci in previewColIndexes"
                            :key="ci"
                            :class="{
                              'is-selected': selectedColSet.has(ci),
                              'is-empty': !String(r[ci] ?? ''),
                            }"
                            :title="String(r[ci] ?? '')"
                          >
                            <span v-if="String(r[ci] ?? '')" class="excel-preview-cell">{{ r[ci] }}</span>
                            <span v-else class="excel-preview-empty">(空)</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>

        <div class="excel-column excel-column--output">
          <div class="pane-card excel-output-card">
            <div class="pane-title">输出</div>
            <div class="excel-output-wrap" :class="{ 'is-empty': !outputText }" @click="handleOutputClick">
              <el-input
                :model-value="outputText"
                type="textarea"
                :autosize="false"
                :rows="14"
                readonly
                placeholder="这里显示提取结果"
                class="dialog-input excel-output excel-output-fill"
              />
            </div>
            <div class="pane-meta">行数: {{ outputLineCount }} ｜字符: {{ outputCharCount }} ｜点击文本复制全部</div>
            <div class="excel-out-actions">
              <el-button @click="downloadResult">下载 .txt</el-button>
              <el-button @click="clearAll">清空</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import TopNav from '../components/TopNav.vue'

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
    return { value: i, col, hint, label: hint ? `${col} · ${hint}` : col }
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

function parseHtmlTable(html) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const tables = Array.from(doc.querySelectorAll('table'))
    if (!tables.length) return []

    const countCells = (t) => {
      try {
        return Array.from(t.rows || []).reduce((sum, r) => sum + (r.cells?.length || 0), 0)
      } catch (e) {
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
  } catch (e) {
    return []
  }
}

function parseRtfTable(rtf) {
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
      } catch (e) {
        try {
          decoder = new TextDecoder('utf-8')
        } catch (e2) {
          decoder = null
        }
      }

      if (decoder) {
        try {
          return decoder.decode(new Uint8Array(bytes))
        } catch (e) {}
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

function parsePlainText(text) {
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
    // Use a lightweight heuristic: when the current row or the next line doesn't reach the expected column count,
    // treat the line as a continuation of the last cell and keep consuming.
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

function normalizeTable(rows) {
  const max = rows.reduce((m, r) => Math.max(m, r.length), 0)
  return rows.map((r) => {
    const out = Array.from({ length: max }, (_, i) => r[i] ?? '')
    return out
  })
}

function normalizeCellText(input) {
  return String(input).replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim()
}

function decodeEscapes(input) {
  const s = String(input ?? '')
  return s
    .replace(/\\\\/g, '\\')
    .replace(/\\r\\n/g, '\r\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

function indexToLetters(index) {
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

</script>
