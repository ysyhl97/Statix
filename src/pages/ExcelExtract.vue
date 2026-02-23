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
import TopNav from '../components/TopNav.vue'
import { useExcelExtractor } from '../composables/excel/useExcelExtractor'

const {
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
} = useExcelExtractor()
</script>

