import { createRouter, createWebHashHistory } from 'vue-router'

const InspirationCards = () => import('../pages/InspirationCards.vue')
const ExcelExtract = () => import('../pages/ExcelExtract.vue')
const AccountFormatter = () => import('../pages/AccountFormatter.vue')
const TextWorkbench = () => import('../pages/TextWorkbench.vue')

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/inspiration' },
    { path: '/inspiration', name: 'inspiration', component: InspirationCards },
    { path: '/excel', name: 'excel', component: ExcelExtract },
    { path: '/account', name: 'account', component: AccountFormatter },
    { path: '/text', name: 'text', component: TextWorkbench },
    { path: '/:pathMatch(.*)*', redirect: '/inspiration' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})
