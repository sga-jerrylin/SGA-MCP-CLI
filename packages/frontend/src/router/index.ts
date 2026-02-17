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
        path: 'runtime/servers',
        name: 'ServerDirectory',
        component: () => import('@/views/Runtime/ServerDirectory.vue'),
        meta: { title: 'Server 目录' }
      },
      {
        path: 'runtime/deploy',
        name: 'DeployView',
        component: () => import('@/views/Runtime/DeployView.vue'),
        meta: { title: '部署发布' }
      },
      {
        path: 'library',
        name: 'ToolLibrary',
        component: () => import('@/views/Library/ToolLibrary.vue'),
        meta: { title: '工具库' }
      },
      {
        path: 'repository',
        name: 'Repository',
        component: () => import('@/views/Repository/RepoView.vue'),
        meta: { title: '配置仓库' }
      },
      {
        path: 'admin/tenants',
        name: 'TenantManagement',
        component: () => import('@/views/Admin/TenantManagement.vue'),
        meta: { title: '租户管理' }
      },
      {
        path: 'admin/tenants/:tenantId/keys',
        name: 'KeyManagement',
        component: () => import('@/views/Admin/KeyManagement.vue'),
        meta: { title: 'API Key 管理' }
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
