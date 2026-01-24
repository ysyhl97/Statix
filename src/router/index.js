import { createRouter, createWebHashHistory } from 'vue-router'

import InspirationCards from '../pages/InspirationCards.vue'
import ExcelExtract from '../pages/ExcelExtract.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/inspiration' },
    { path: '/inspiration', name: 'inspiration', component: InspirationCards },
    { path: '/excel', name: 'excel', component: ExcelExtract },
    { path: '/:pathMatch(.*)*', redirect: '/inspiration' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})
