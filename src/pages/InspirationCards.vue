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
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TopNav from '../components/TopNav.vue'

const Icons = {
  Search: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M159.3 126.5l635.4 635.4-32.8 32.8-63.1-63.1c-100 70.6-224.2 101.4-350.5 76.5-120.3-23.7-224-96.2-282.6-198.6-67-117.1-59-266.3 19.8-376.1 76-105.8 206.1-163.6 337-147.2l61.2-61.2-32.8-32.8zM420.6 200.2c-106.6 21-196.9 97.4-232.4 199.1-39 111.7-5.5 237.5 76 319 86.6 86.6 219.7 110.1 328.6 62l-30.7-30.7c-78.6 25-168.1 9.3-233.1-47.1-70-60.8-95.9-159.2-63.4-245.9 29.6-78.9 98.4-138.8 181.7-157.9 14.1-3.2 28.5-4.8 42.8-4.8l-69.5-69.5z',
        }),
      ]),
  },
  Plus: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M480 480V128a32 32 0 0 1 64 0v352h352a32 32 0 1 1 0 64H544v352a32 32 0 1 1-64 0V544H128a32 32 0 0 1 0-64h352z',
        }),
      ]),
  },
  Setting: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372zM512 320a192 192 0 1 1 0 384 192 192 0 0 1 0-384zm0 64a128 128 0 1 0 0 256 128 128 0 0 0 0-256z',
        }),
      ]),
  },
  Edit: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M832 512a32 32 0 1 1 64 0v352a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h352a32 32 0 0 1 0 64H192v640h640V512z',
        }),
        h('path', {
          d: 'm469.952 554.24 52.8-7.52a32 32 0 0 1 22.784 5.504l.512.448 343.488-343.488a64 64 0 0 0-90.496-90.496L455.552 462.208a32 32 0 0 1-5.056 23.296l-7.296 52.48a32 32 0 0 1-46.848-6.144 32 32 0 0 1 6.144-46.848l52.48-7.296a32 32 0 0 1 23.296-5.056l343.488-343.488a64 64 0 0 0-90.496-90.496L387.776 472.576a96 96 0 0 0-15.168 69.888l21.888 157.44a32 32 0 0 0 36.48 27.2L588.416 705.28a96 96 0 0 0 69.888-15.168l343.488-343.488a32 32 0 0 1-45.248-45.248z',
        }),
      ]),
  },
  Delete: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M160 256H96a32 32 0 0 1 0-64h256V95.936a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32V192h256a32 32 0 1 1 0 64h-64v672a32 32 0 0 1-32 32H192a32 32 0 0 1-32-32V256zm448-64v-64H416v64h192zM224 256v640h576V256H224z',
        }),
      ]),
  },
  View: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M512 128c136.533 0 259.627 58.453 346.027 151.467a536.96 536.96 0 0 1 106.667 158.933 60.587 60.587 0 0 1 0 46.933A536.96 536.96 0 0 1 858.027 644.8C771.627 737.6 648.533 796.267 512 796.267s-259.627-58.453-346.027-151.467A536.96 536.96 0 0 1 59.307 485.867a60.587 60.587 0 0 1 0-46.933C92.16 348.8 178.56 230.4 292.267 172.8 359.04 142.933 434.347 128 512 128zm0 64c-112.427 0-217.173 53.333-294.4 136.533a473.6 473.6 0 0 0-89.6 133.333c23.04 52.907 53.76 98.56 89.6 133.333C294.827 678.613 399.573 731.733 512 731.733s217.173-53.333 294.4-136.533a473.6 473.6 0 0 0 89.6-133.333 473.6 473.6 0 0 0-89.6-133.333C729.173 245.333 624.427 192 512 192zm0 106.667a160 160 0 1 1 0 320 160 160 0 0 1 0-320zm0 64a96 96 0 1 0 0 192 96 96 0 0 0 0-192z',
        }),
      ]),
  },
  Check: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M406.656 706.944L195.84 496.256a32 32 0 1 0-45.248 45.248l256 256 512-512a32 32 0 0 0-45.248-45.248L406.592 706.944z',
        }),
      ]),
  },
  Rank: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M186.432 396.096h651.136c17.664 0 32-14.336 32-32s-14.336-32-32-32H186.432c-17.664 0-32 14.336-32 32s14.336 32 32 32zm0 260.288h651.136c17.664 0 32-14.336 32-32s-14.336-32-32-32H186.432c-17.664 0-32 14.336-32 32s14.336 32 32 32zM154.432 135.232C154.432 152.96 168.768 167.232 186.432 167.232h651.136c17.664 0 32-14.336 32-32s-14.336-32-32-32H186.432c-17.664 0-32 14.336-32 32z',
        }),
      ]),
  },
  Close: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 613.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L512 557.3 391.9 677.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L466.7 512 346.6 391.9c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L512 466.7l120.1-120.1c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L557.3 512l120.1 120.1z',
        }),
      ]),
  },
}

const STORAGE_KEY = 'fixed_notes_clean_v5'
const tableData = ref([])
const searchQuery = ref('')
const searchInputRef = ref(null)

const dialogVisible = ref(false)
const detailVisible = ref(false)
const isEdit = ref(false)
const form = ref({ id: null, tag: '', content: '' })
const detailItem = ref({})

const draggedIndex = ref(null)

const handleKeydown = (e) => {
  if (
    (e.key === '/' || (e.ctrlKey && e.key === 'k')) &&
    document.activeElement.tagName !== 'TEXTAREA' &&
    document.activeElement.tagName !== 'INPUT'
  ) {
    e.preventDefault()
    searchInputRef.value?.focus()
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault()
    openDialog()
  }
  if (dialogVisible.value && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    saveItem()
  }
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      tableData.value = data.map((i) => ({ ...i, justCopied: false }))
    } catch (e) {}
  }

  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(
  tableData,
  (val) => {
    const toSave = val.map(({ justCopied, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  },
  { deep: true }
)

const filteredData = computed(() => {
  if (!searchQuery.value) return tableData.value
  const q = searchQuery.value.toLowerCase()
  return tableData.value.filter(
    (i) =>
      (i.tag && i.tag.toLowerCase().includes(q)) ||
      (i.content && i.content.toLowerCase().includes(q))
  )
})

const stringToColor = (str) => {
  if (!str) return '#ccc'
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 70%, 65%)`
}

const getBlobGradient = (str) => {
  if (!str) return 'linear-gradient(135deg, #f3f4f6, #fff)'
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash) % 360
  return `linear-gradient(135deg, hsl(${h}, 90%, 92%), hsl(${(h + 40) % 360}, 90%, 96%))`
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const isToday = new Date().toDateString() === d.toDateString()
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return isToday ? `今天 ${timeStr}` : `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`
}

const triggerCopy = async (item) => {
  try {
    await navigator.clipboard.writeText(item.content)
    item.justCopied = true
    setTimeout(() => {
      item.justCopied = false
    }, 1000)
    ElMessage.success({ message: '已复制', duration: 1000, grouping: true })
  } catch (e) {}
}

const onDragStart = (index) => {
  draggedIndex.value = index
}
const onDragEnd = () => {
  draggedIndex.value = null
}
const onDrop = (index) => {
  if (searchQuery.value) return
  const from = draggedIndex.value
  if (from !== null && from !== index) {
    const item = tableData.value.splice(from, 1)[0]
    tableData.value.splice(index, 0, item)
  }
  onDragEnd()
}

const openDialog = (row) => {
  isEdit.value = !!row
  form.value = row ? { ...row } : { id: null, tag: '', content: '' }
  dialogVisible.value = true
  nextTick(() => document.querySelector('.custom-dialog input')?.focus())
}

const viewDetail = (row) => {
  detailItem.value = row
  detailVisible.value = true
}

const saveItem = () => {
  if (!form.value.content) {
    ElMessage.warning('内容不能为空')
    return
  }
  const tagVal = form.value.tag ? form.value.tag.trim() : ''
  if (isEdit.value) {
    const idx = tableData.value.findIndex((i) => i.id === form.value.id)
    if (idx !== -1) tableData.value[idx] = { ...form.value, tag: tagVal, id: form.value.id }
  } else {
    tableData.value.unshift({ id: Date.now(), tag: tagVal, content: form.value.content })
  }
  dialogVisible.value = false
}

const handleDelete = (item) => {
  ElMessageBox.confirm('确定删除吗？', '提示', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
    center: true,
  })
    .then(() => {
      tableData.value = tableData.value.filter((i) => i.id !== item.id)
    })
    .catch(() => {})
}

const handleFileCommand = (c) => {
  if (c === 'export') {
    const blob = new Blob([JSON.stringify(tableData.value, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `灵感碎片_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  } else if (c === 'import') document.getElementById('fileInput').click()
}

const importData = (e) => {
  const f = e.target.files[0]
  if (!f) return
  const r = new FileReader()
  r.onload = (ev) => {
    try {
      tableData.value = JSON.parse(ev.target.result)
      ElMessage.success('恢复成功')
    } catch (err) {
      ElMessage.error('文件格式错误')
    }
    e.target.value = ''
  }
  r.readAsText(f)
}
</script>
