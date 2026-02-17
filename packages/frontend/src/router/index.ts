import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '概览' }
      },
      {
        path: 'generator',
        name: 'Generator',
        component: () => import('@/views/Generator.vue'),
        meta: { title: '生成器' }
      }
    ]
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫：更新页面标题
router.afterEach((to) => {
  const title = (to.meta?.title as string) || 'MCP Claw';
  document.title = `${title} - MCP Claw`;
});

export default router;
