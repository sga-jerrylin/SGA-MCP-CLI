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
        component: () => import('@/views/Generator/GeneratorView.vue'),
        meta: { title: '生成器' }
      },
      {
        path: 'settings/ai',
        name: 'AiSettings',
        component: () => import('@/views/Settings/AiEngineSettings.vue'),
        meta: { title: 'AI 引擎设置' }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Auth/LoginView.vue'),
    meta: { title: '登录' }
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
