import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/element-plus')) return 'element-plus'
          if (id.includes('node_modules/vue-router')) return 'vue-vendor'
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) return 'vue-vendor'
          if (id.includes('src/pages/AccountFormatter.vue') || id.includes('src/composables/account')) return 'tool-account'
          if (id.includes('src/pages/ExcelExtract.vue') || id.includes('src/composables/excel')) return 'tool-excel'
          if (id.includes('src/pages/TextWorkbench.vue') || id.includes('src/composables/text')) return 'tool-text'
          return undefined
        },
      },
    },
  },
})
