<template>
  <div v-cloak>
    <div class="app-wrapper account-page">
      <TopNav>
        <template #center>
          <div class="search-container">
            <div class="hub-intro">
              <div class="hub-title">账号卡密格式化 V3</div>
              <div class="hub-sub">按字段排序映射：第1字段对应第1段分词</div>
            </div>
          </div>
        </template>
      </TopNav>

      <div class="account-layout account-layout--v2">
        <div class="pane-card account-input-card">
          <div class="account-input-sections">
            <div class="account-section-card account-section-card--input excel-settings-box">
              <div class="pane-title">输入内容</div>
              <el-input
                v-model="rawInput"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 8 }"
                placeholder="每行一组账号卡密，优先按所选/输入分隔符解析"
                class="dialog-input account-input"
              />
              <div class="account-actions">
                <el-button class="account-btn account-btn--subtle" @click="clearAll">清空</el-button>
              </div>
            </div>

            <div class="account-section-card account-section-card--config excel-settings-box">
              <div class="pane-title">解析参数</div>
              <div class="account-settings-grid">
                <div class="excel-inline excel-inline--auto">
                  <span class="excel-inline-label">分隔符</span>
                  <el-input v-model="delimiterInput" placeholder="分隔符（可手动输入，例如 ----）" class="dialog-input mini-input" />
                </div>
                <div class="account-trim-panel">
                  <div class="account-trim-head">
                    <span class="excel-inline-label">字段前后缀过滤</span>
                    <el-switch v-model="trimEnabled" />
                  </div>
                  <div class="account-trim-grid">
                    <el-select v-model="trimEditorField" class="dialog-input mini-input">
                      <el-option v-for="opt in trimFieldOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                    <el-input
                      v-model="trimPrefixInput"
                      placeholder="前缀（逗号/换行分隔），默认 auth_token="
                      class="dialog-input mini-input"
                    />
                    <el-input
                      v-model="trimSuffixInput"
                      placeholder="后缀（逗号/换行分隔）"
                      class="dialog-input mini-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="sampleTokens.length"
              class="account-section-card account-section-card--mapping account-sample-mapper account-failed-item--fix excel-settings-box"
            >
              <div class="pane-title">字段排序映射</div>
              <div class="account-failed-head">
                <span class="pane-hint">拖拽字段排序，顺序即分词映射顺序</span>
                <span class="pane-hint">参与 {{ activeSortCount }} / 总 {{ orderedFieldItems.length }}</span>
              </div>

              <div class="account-option-add">
                <el-input v-model="newCustomFieldName" class="dialog-input mini-input" placeholder="新增字段名，例如 代理" />
                <el-button size="small" type="primary" class="account-btn account-btn--primary" @click="addCustomRole">新增字段</el-button>
                <el-button size="small" class="account-btn account-btn--subtle" @click="resetFieldOrder">恢复默认排序</el-button>
              </div>

              <div class="account-field-order-list">
                <div
                  v-for="(field, idx) in orderedFieldItems"
                  :key="`field_${field.key}`"
                  class="account-field-order-chip"
                  draggable="true"
                  :class="{ 'is-dragging': dragFieldKey === field.key, 'is-active': field.active, 'is-inactive': !field.active }"
                  @dragstart="onFieldDragStart($event, field.key)"
                  @dragend="onFieldDragEnd"
                  @dragover.prevent
                  @drop="onFieldDrop($event, field.key)"
                >
                  <span v-if="field.active" class="account-field-rank-badge">#{{ field.rank }}</span>
                  <span class="account-field-order-chip-handle">≡</span>
                  <span>{{ field.label }}</span>
                  <span v-if="!field.active" class="account-field-state-tag">未参与</span>
                  <span class="account-field-order-chip-actions">
                    <button
                      type="button"
                      class="account-field-order-chip-btn"
                      :disabled="idx === 0"
                      @click="moveFieldByDelta(field.key, -1)"
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      class="account-field-order-chip-btn"
                      :disabled="idx === orderedFieldItems.length - 1"
                      @click="moveFieldByDelta(field.key, 1)"
                    >
                      下移
                    </button>
                  </span>
                </div>
              </div>

              <div v-if="overflowTokenCount > 0" class="pane-hint">
                超出字段数量的 {{ overflowTokenCount }} 段已自动归为忽略
              </div>
            </div>
          </div>

          <div class="account-meta-grid account-meta-grid--footer excel-settings-box">
            <div class="pane-meta">总计 {{ stats.total }} 行，成功 {{ stats.success }}，失败 {{ stats.failed }}</div>
            <div class="pane-meta">批次分隔符：{{ parseProfile.delimiter || '未识别' }}</div>
          </div>
        </div>

        <div class="pane-card account-result-card">
          <div class="account-result-head">
            <div class="account-result-head-left">
              <div class="pane-title">结果预览</div>
              <div v-if="lastPickedLabel" class="account-picked-badge">{{ lastPickedLabel }}</div>
            </div>
            <div class="account-result-head-right">
              <div class="pane-hint">共 {{ tableRows.length }} 条</div>
            </div>
          </div>
          <div class="account-result-table-wrap">
            <el-table :data="tableRows" height="100%" empty-text="暂无结果" class="account-table" :row-class-name="rowClassName">
              <el-table-column label="#" width="70">
                <template #default="{ $index }">{{ $index + 1 }}</template>
              </el-table-column>
              <el-table-column v-for="col in tableColumns" :key="col.key" :prop="col.key" :label="col.label" :min-width="col.minWidth">
                <template #default="{ row, $index }">
                  <div
                    v-if="col.key !== '__otp_code__'"
                    class="account-cell"
                    :title="String(row[col.key] || '')"
                    :class="{
                      'account-cell-selected': selectedRowIndex === $index && selectedColKey === col.key,
                    }"
                    @click="onTableCellClick(row, col.key, $index)"
                  >
                    {{ row[col.key] }}
                  </div>
                  <div
                    v-else
                    class="account-otp-cell"
                    :class="[
                      otpPhaseClass(row, $index),
                      {
                        'account-cell-selected': selectedRowIndex === $index && selectedColKey === col.key,
                        'account-otp-sleeping': isOtpSleeping(row, $index),
                        'account-otp-hovering': isOtpHovering(row, $index),
                      },
                    ]"
                    :style="otpCellStyle(row, $index)"
                    @pointerenter="onOtpPointerEnter(row, $index, $event)"
                    @pointermove="onOtpPointerMove(row, $index, $event)"
                    @pointerleave="onOtpPointerLeave(row, $index)"
                    @click="onOtpCellClick(row, $index)"
                  >
                    <div class="account-otp-progress-wrap">
                      <div class="account-otp-progress-shell">
                        <el-progress
                          class="account-otp-progress"
                          type="dashboard"
                          :show-text="false"
                          :stroke-width="10"
                          :percentage="otpProgressPercent(getOtpState(row, $index))"
                          :color="otpProgressColor(getOtpState(row, $index))"
                        />
                        <div class="account-otp-content">
                          <span v-if="otpHasCode(getOtpState(row, $index))" class="account-otp-code">
                            {{ otpDisplayCode(getOtpState(row, $index)) }}
                          </span>
                          <span v-else class="account-otp-idle-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                              <path
                                d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm.75 10.44V7.5a.75.75 0 0 0-1.5 0v5.25a.75.75 0 0 0 .33.62l3.5 2.34a.75.75 0 1 0 .84-1.24z"
                              />
                            </svg>
                          </span>
                        </div>
                      </div>
                      <span class="account-otp-countdown account-otp-countdown-bottom">{{ otpCountdownText(getOtpState(row, $index)) }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import TopNav from '../components/TopNav.vue'
import { useAccountFormatter } from '../composables/account/useAccountFormatter'

const {
  rawInput,
  delimiterInput,
  trimEnabled,
  trimEditorField,
  trimFieldOptions,
  trimPrefixInput,
  trimSuffixInput,
  sampleTokens,
  activeSortCount,
  orderedFieldItems,
  dragFieldKey,
  newCustomFieldName,
  addCustomRole,
  resetFieldOrder,
  moveFieldByDelta,
  onFieldDragStart,
  onFieldDragEnd,
  onFieldDrop,
  overflowTokenCount,
  stats,
  parseProfile,
  lastPickedLabel,
  tableRows,
  tableColumns,
  selectedRowIndex,
  selectedColKey,
  getOtpState,
  isOtpSleeping,
  otpPhaseClass,
  otpHasCode,
  otpDisplayCode,
  otpCountdownText,
  otpProgressPercent,
  otpProgressColor,
  isOtpHovering,
  otpCellStyle,
  onOtpPointerEnter,
  onOtpPointerMove,
  onOtpPointerLeave,
  onTableCellClick,
  onOtpCellClick,
  rowClassName,
  clearAll,
} = useAccountFormatter()
</script>

