<template>
  <div v-cloak>
    <div class="app-wrapper text-page">
      <TopNav>
        <template #center>
          <div class="search-container">
            <div class="hub-intro">
              <div class="hub-title">在线 TXT 文本工作台</div>
              <div class="hub-sub">多标签新建 · 极速清洗 · 正则重组</div>
            </div>
          </div>
        </template>

        <template #actions>
          <div class="text-nav-status">
            <span class="text-nav-dot" aria-hidden="true"></span>
            <span class="text-nav-label">标签</span>
            <span class="text-nav-value">{{ tabs.length }}</span>
            <span class="excel-nav-sep" aria-hidden="true">·</span>
            <span class="text-nav-label">当前</span>
            <span class="text-nav-value">{{ activeLineCount }}</span>
            <span class="text-nav-label">行</span>
          </div>
        </template>
      </TopNav>

      <div class="text-layout">
        <div class="pane-card text-editor-card">
          <div class="text-editor-shell" :style="editorStyleVars">
            <div class="text-editor-shell-head">
              <el-tabs v-model="activeTabId" class="text-tabs" type="card" editable @edit="handleTabsEdit">
                <el-tab-pane
                  v-for="tab in tabs"
                  :key="tab.id"
                  :name="tab.id"
                  :closable="tabs.length > 1"
                >
                  <template #label>
                    <span class="text-tab-label" @dblclick.stop.prevent="promptRenameTab(tab.id)">
                      <span class="text-tab-dot" aria-hidden="true"></span>
                      <span class="text-tab-name">{{ tab.name }}</span>
                      <span class="text-tab-lines">{{ countLines(tab.text) }}</span>
                    </span>
                  </template>
                </el-tab-pane>
              </el-tabs>

              <div class="text-head-actions">
                <div class="text-font-control">
                  <span class="text-font-label">字号</span>
                  <el-slider
                    v-model="editorFontSize"
                    :min="12"
                    :max="32"
                    :step="1"
                    :show-tooltip="false"
                    class="text-font-slider"
                  />
                  <span class="text-font-value">{{ editorFontSize }}px</span>
                </div>

                <div class="text-action-group">
                  <el-button size="small" class="text-action-btn" @click="copyActiveText">复制全文</el-button>
                  <el-button size="small" class="text-action-btn" @click="clearActiveText">清空当前</el-button>
                </div>

                <div class="text-action-group">
                  <el-button size="small" class="text-action-btn" :disabled="!canUndo" @click="undo">撤销</el-button>
                  <el-button size="small" class="text-action-btn" :disabled="!canRedo" @click="redo">重做</el-button>
                </div>

                <div class="text-action-group">
                  <el-button size="small" class="text-action-btn" :disabled="!activeTab" @click="renameActiveTab">重命名</el-button>
                  <el-button size="small" class="text-action-btn is-emphasis" @click="openConfigDialog">配置</el-button>
                </div>
              </div>
            </div>

            <div class="text-editor-wrap">
              <div ref="gutterRef" class="text-line-gutter" aria-label="文本行号">
                <div class="text-line-gutter-inner">
                  <div
                    v-for="lineNo in lineNumbers"
                    :key="lineNo"
                    class="text-line-no"
                    :class="{ 'is-active': lineNo === activeCaretLine, 'is-match': matchedLineSet.has(lineNo) }"
                    role="button"
                    tabindex="0"
                    :title="`点击复制第 ${lineNo} 行（自动去首尾空格）`"
                    @click="copyLineByNumber(lineNo)"
                    @keydown.enter.prevent="copyLineByNumber(lineNo)"
                    @keydown.space.prevent="copyLineByNumber(lineNo)"
                  >
                    {{ lineNo }}
                  </div>
                </div>
              </div>

              <el-input
                ref="editorRef"
                :model-value="activeText"
                type="textarea"
                :autosize="false"
                :rows="18"
                resize="none"
                spellcheck="false"
                wrap="off"
                class="dialog-input text-textarea"
                placeholder="在这里粘贴或输入文本..."
                @input="handleTextInput"
              />
            </div>
          </div>
        </div>
      </div>

      <el-dialog
        v-model="configDialogVisible"
        class="text-config-dialog"
        title="文本处理配置"
        width="640px"
        top="8vh"
        :modal="false"
        :lock-scroll="false"
      >
        <div class="text-config-body">
          <div class="pane-title text-subtitle">高频清洗</div>
          <div class="text-action-grid">
            <el-button @click="removeBlankLines">去除多余空行</el-button>
            <el-button @click="trimEachLine">去除首尾空格</el-button>
            <el-button @click="dedupeLines">文本行去重</el-button>
          </div>

          <div class="pane-title text-subtitle">批量前后缀</div>
          <div class="text-form-grid">
            <el-input v-model="affixPrefix" class="dialog-input mini-input" placeholder="前缀" />
            <el-input v-model="affixSuffix" class="dialog-input mini-input" placeholder="后缀" />
            <el-button type="primary" @click="applyAffix">应用到每一行</el-button>
          </div>

          <div class="pane-title text-subtitle">正则替换</div>
          <div class="text-form-grid">
            <el-input
              v-model="regexPattern"
              class="dialog-input mini-input"
              placeholder="pattern（支持完整正则）"
            />
            <el-input
              v-model="regexReplacement"
              class="dialog-input mini-input"
              placeholder="replacement（支持 $1 等分组）"
            />
            <el-input v-model="regexFlags" class="dialog-input mini-input" placeholder="flags: gimsyu" />
            <el-button type="primary" @click="applyRegexReplace">执行替换</el-button>
          </div>
          <div class="text-regex-preview">
            <div class="text-regex-preview-status">
              <span class="text-regex-preview-label">匹配</span>
              <span class="text-regex-preview-value">{{ regexMatchCount }}</span>
              <span class="text-regex-preview-index">{{ activeMatchIndexLabel }}</span>
            </div>
            <div class="text-regex-preview-actions">
              <el-button size="small" class="text-action-btn" :disabled="!regexMatchCount" @click="focusPrevMatch">上一个</el-button>
              <el-button size="small" class="text-action-btn" :disabled="!regexMatchCount" @click="focusNextMatch">下一个</el-button>
            </div>
          </div>
          <div v-if="regexPreviewError" class="pane-hint text-regex-preview-hint is-error">{{ regexPreviewError }}</div>
          <div v-else class="pane-hint text-regex-preview-hint">
            已在左侧行号标记匹配行，可用“上一个/下一个”定位并选中命中片段。
          </div>

          <div class="pane-hint">快捷键：Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做。</div>
          <div class="pane-hint">flags 填 g 表示全局替换，留空表示只替换首个匹配。</div>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import TopNav from '../components/TopNav.vue'
import { useTextWorkbench } from '../composables/text/useTextWorkbench'

const {
  tabs,
  activeTabId,
  activeTab,
  activeText,
  activeLineCount,
  activeCaretLine,
  lineNumbers,
  canUndo,
  canRedo,
  editorFontSize,
  editorStyleVars,
  configDialogVisible,
  regexPattern,
  regexReplacement,
  regexFlags,
  regexPreviewError,
  regexMatchCount,
  activeMatchIndexLabel,
  matchedLineSet,
  affixPrefix,
  affixSuffix,
  editorRef,
  gutterRef,
  countLines,
  handleTextInput,
  handleTabsEdit,
  promptRenameTab,
  renameActiveTab,
  openConfigDialog,
  copyActiveText,
  copyLineByNumber,
  clearActiveText,
  removeBlankLines,
  trimEachLine,
  dedupeLines,
  applyAffix,
  applyRegexReplace,
  focusPrevMatch,
  focusNextMatch,
  undo,
  redo,
} = useTextWorkbench()
</script>
