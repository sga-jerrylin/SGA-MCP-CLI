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
        meta: { title: 'Dashboard' }
      },
      {
        path: 'generator',
        name: 'Generator',
        component: () => import('@/views/Generator/GeneratorView.vue'),
        meta: { title: 'Generator' }
      },
      {
        path: 'runtime/servers',
        name: 'ServerDirectory',
        component: () => import('@/views/Runtime/ServerDirectory.vue'),
        meta: { title: 'Server Directory' }
      },
      {
        path: 'runtime/deploy',
        name: 'DeployView',
        component: () => import('@/views/Runtime/DeployView.vue'),
        meta: { title: 'Deploy' }
      },
      {
        path: 'library',
        name: 'ToolLibrary',
        component: () => import('@/views/Library/ToolLibrary.vue'),
        meta: { title: 'Library' }
      },
      {
        path: 'monitor',
        name: 'Monitor',
        component: () => import('@/views/Monitor/MonitorView.vue'),
        meta: { title: 'Monitor' }
      },
      {
        path: 'repository',
        name: 'Repository',
        component: () => import('@/views/Repository/RepoView.vue'),
        meta: { title: 'Repository' }
      },
      {
        path: 'admin/tenants',
        name: 'TenantManagement',
        component: () => import('@/views/Admin/TenantManagement.vue'),
        meta: { title: 'Tenant Management' }
      },
      {
        path: 'admin/tenants/:tenantId/keys',
        name: 'KeyManagement',
        component: () => import('@/views/Admin/KeyManagement.vue'),
        meta: { title: 'API Key Management' }
      },
      {
        path: 'settings/ai',
        name: 'AiSettings',
        component: () => import('@/views/Settings/AiEngineSettings.vue'),
        meta: { title: 'AI Settings' }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Auth/LoginView.vue'),
    meta: { title: 'Login' }
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('mcp_token');
  const isLoginPage = to.path === '/login';
  if (!token && !isLoginPage) {
    next('/login');
  } else if (token && isLoginPage) {
    next('/');
  } else {
    next();
  }
});

router.afterEach((to) => {
  const title = (to.meta?.title as string) || 'MCP Claw';
  document.title = `${title} - MCP Claw`;
});

export default router;
