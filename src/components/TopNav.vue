<template>
  <div class="header-bar">
    <div class="nav-left">
      <div class="brand" style="cursor: pointer" @click="goDefault">
        <div class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 1024 1024" fill="currentColor" style="width: 20px">
            <path
              d="M128 128h320v320H128V128zm0 448h320v320H128V576zm448-448h320v320H576V128zm0 448h320v320H576V576z"
            />
          </svg>
        </div>
        <span class="brand-name">Statix</span>
      </div>

      <nav class="nav-tabs" aria-label="工具切换">
        <RouterLink v-for="i in navItems" :key="i.to" :to="i.to" class="nav-tab">
          <span v-if="i.icon" class="nav-tab-icon" aria-hidden="true">
            <component :is="i.icon" />
          </span>
          <span class="nav-tab-label">{{ i.label }}</span>
        </RouterLink>
      </nav>
    </div>

    <slot name="center" />
    <slot name="actions" />
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { useRouter } from 'vue-router'

const NavIcons = {
  Spark: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M512 128l92 260h260l-210 152 80 260-222-152-222 152 80-260-210-152h260l92-260z',
        }),
      ]),
  },
  Table: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M192 224h640a64 64 0 0 1 64 64v448a64 64 0 0 1-64 64H192a64 64 0 0 1-64-64V288a64 64 0 0 1 64-64zm0 64v448h640V288H192zm0 128h640v64H192v-64zm0 160h640v64H192v-64zm160-288h64v512h-64V288zm256 0h64v512h-64V288z',
        }),
      ]),
  },
  Key: {
    render: () =>
      h('svg', { viewBox: '0 0 1024 1024', fill: 'currentColor' }, [
        h('path', {
          d: 'M352 544a192 192 0 1 1 154.9-305.3L928 240a32 32 0 0 1 0 64h-64v96a32 32 0 0 1-32 32h-64v64a32 32 0 0 1-32 32h-96a32 32 0 0 1-32-32v-30.4l-56.5-.2A191.4 191.4 0 0 1 352 544zm0-64a128 128 0 1 0 0-256 128 128 0 0 0 0 256z',
        }),
      ]),
  },
}

const props = defineProps({
  items: {
    type: Array,
    default: () => [
      { label: '灵感碎片', to: '/inspiration' },
      { label: 'Excel提取', to: '/excel' },
      { label: '账号卡密', to: '/account' },
    ],
  },
  defaultTo: { type: String, default: '/inspiration' },
})

const navItems = computed(() =>
  (props.items || []).map((i) => ({
    ...i,
    icon:
      i.icon ??
      (i.to === '/inspiration'
        ? NavIcons.Spark
        : i.to === '/excel'
          ? NavIcons.Table
          : i.to === '/account'
            ? NavIcons.Key
            : undefined),
  }))
)

const router = useRouter()
const goDefault = () => router.push(props.defaultTo)
</script>
