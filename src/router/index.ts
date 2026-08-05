import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // 服务器部署（Nginx 等）
  // history: createWebHistory(import.meta.env.BASE_URL),

  // GitHub Pages 静态部署时改用：
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/production-plan',
    },
    {
      path: '/production-plan',
      name: 'production-plan',
      component: () => import('@/views/ProductionPlanPage.vue'),
    },
    {
      path: '/power-plan',
      name: 'power-plan',
      component: () => import('@/views/PowerPlanPage.vue'),
    },
  ],
})

export default router
