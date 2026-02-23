<template>
  <div v-cloak>
    <div class="app-wrapper">
      <!-- Header -->
      <TopNav>
        <template #center>
          <div class="search-container">
            <el-input
              v-model="searchQuery"
              class="custom-search"
              placeholder="搜索灵感..."
              ref="searchInputRef"
            >
              <template #prefix>
                <component
                  :is="Icons.Search"
                  style="width: 18px; color: #9ca3af; margin-right: 4px"
                ></component>
              </template>
              <template #suffix>
                <component
                  v-if="searchQuery"
                  :is="Icons.Close"
                  @click="searchQuery = ''"
                  style="width: 16px; cursor: pointer; color: #999; margin-right: 4px"
                ></component>
              </template>
            </el-input>
          </div>
        </template>

        <template #actions>
          <div class="actions">
            <el-dropdown @command="handleFileCommand" trigger="click">
              <button class="btn-circle btn-secondary" title="设置">
                <component :is="Icons.Setting" style="width: 20px"></component>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="export">📤 导出备份</el-dropdown-item>
                  <el-dropdown-item command="import">📥 恢复数据</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <el-tooltip content="新建 (Ctrl+I)" placement="bottom">
              <button class="btn-circle btn-primary" @click="openDialog()">
                <component :is="Icons.Plus" style="width: 22px"></component>
              </button>
            </el-tooltip>
          </div>
        </template>
      </TopNav>

      <!-- Content Grid -->
      <div class="card-grid" @dragover.prevent>
        <div
          v-for="(item, index) in filteredData"
          :key="item.id"
          class="note-card"
          :class="{ copied: item.justCopied }"
          :draggable="!searchQuery"
          @dragstart="onDragStart(index)"
          @dragend="onDragEnd"
          @drop="onDrop(index)"
        >
          <div class="card-blob" :style="{ background: getBlobGradient(item.tag) }"></div>

          <div class="card-header">
            <div class="tag-badge">
              <div class="tag-dot" :style="{ background: stringToColor(item.tag) }"></div>
              {{ item.tag || '未分类' }}
            </div>
            <div v-if="!searchQuery" style="cursor: grab; color: #e5e7eb">
              <component :is="Icons.Rank" style="width: 14px"></component>
            </div>
          </div>

          <div class="card-body" @click="triggerCopy(item)">
            <div class="text-content">{{ item.content }}</div>
            <div class="copy-overlay">
              <component
                :is="Icons.Check"
                style="width: 36px; margin-bottom: 8px"
              ></component>
              <span>已复制</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="time-meta">{{ formatTime(item.id) }}</div>
            <div class="action-btns">
              <button class="icon-btn" @click.stop="viewDetail(item)">
                <component :is="Icons.View" style="width: 16px"></component>
              </button>
              <button class="icon-btn" @click.stop="openDialog(item)">
                <component :is="Icons.Edit" style="width: 16px"></component>
              </button>
              <button class="icon-btn danger" @click.stop="handleDelete(item)">
                <component :is="Icons.Delete" style="width: 16px"></component>
              </button>
            </div>
          </div>
        </div>

        <el-empty
          v-if="filteredData.length === 0"
          description="没有找到灵感碎片"
          style="grid-column: 1 / -1; margin-top: 40px"
        ></el-empty>
      </div>
    </div>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑碎片' : '记录灵感'"
      width="460px"
      class="custom-dialog"
      align-center
    >
      <div style="margin-bottom: 16px">
        <label class="form-label">标签</label>
        <el-input
          v-model="form.tag"
          placeholder="例如: 设计 / 代码 / 随笔"
          class="dialog-input"
        ></el-input>
      </div>
      <div>
        <label class="form-label">内容</label>
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="6"
          placeholder="在此输入内容..."
          resize="none"
          class="dialog-input"
        ></el-input>
      </div>
      <template #footer>
        <span style="display: flex; justify-content: flex-end; gap: 10px">
          <el-button @click="dialogVisible = false" round>取消</el-button>
          <el-button type="primary" @click="saveItem" round color="#6366f1">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      :title="detailItem.tag || '详细内容'"
      width="600px"
      class="custom-dialog"
      align-center
    >
      <div
        style="
          background: #f8fafc;
          padding: 20px;
          border-radius: 12px;
          line-height: 1.6;
          color: #333;
          white-space: pre-wrap;
        "
      >
        {{ detailItem.content }}
      </div>
    </el-dialog>

    <input
      type="file"
      id="fileInput"
      style="display: none"
      accept=".json"
      @change="importData"
    />
  </div>
</template>

<script setup>
import TopNav from '../components/TopNav.vue'
import { useInspirationCards } from '../composables/inspiration/useInspirationCards'

const {
  Icons,
  searchQuery,
  searchInputRef,
  dialogVisible,
  detailVisible,
  isEdit,
  form,
  detailItem,
  filteredData,
  stringToColor,
  getBlobGradient,
  formatTime,
  triggerCopy,
  onDragStart,
  onDragEnd,
  onDrop,
  openDialog,
  viewDetail,
  saveItem,
  handleDelete,
  handleFileCommand,
  importData,
} = useInspirationCards()
</script>

