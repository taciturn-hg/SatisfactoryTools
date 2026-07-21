import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
