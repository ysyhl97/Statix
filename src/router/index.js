import { createRouter, createWebHashHistory } from 'vue-router'

import InspirationCards from '../pages/InspirationCards.vue'
import ExcelExtract from '../pages/ExcelExtract.vue'
import AccountFormatter from '../pages/AccountFormatter.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/inspiration' },
    { path: '/inspiration', name: 'inspiration', component: InspirationCards },
    { path: '/excel', name: 'excel', component: ExcelExtract },
    { path: '/account', name: 'account', component: AccountFormatter },
    { path: '/:pathMatch(.*)*', redirect: '/inspiration' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})
