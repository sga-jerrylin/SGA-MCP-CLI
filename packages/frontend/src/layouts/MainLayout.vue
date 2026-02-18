<template>
  <a-layout class="main-layout">
    <a-layout-sider
      v-model:collapsed="appStore.sidebarCollapsed"
      collapsible
      breakpoint="lg"
      :trigger="null"
      class="main-layout__sider"
    >
      <div class="main-layout__logo">
        <span v-if="!appStore.sidebarCollapsed">MCP Claw</span>
        <span v-else>MC</span>
      </div>

      <a-menu
        v-model:selected-keys="selectedKeys"
        v-model:open-keys="openKeys"
        theme="dark"
        mode="inline"
        @click="onMenuClick"
      >
        <a-menu-item key="dashboard">
          <template #icon><DashboardOutlined /></template>
          <span>概览</span>
        </a-menu-item>
        <a-menu-item key="generator">
          <template #icon><ThunderboltOutlined /></template>
          <span>生成器</span>
        </a-menu-item>
        <a-menu-item key="library">
          <template #icon><ToolOutlined /></template>
          <span>工具库</span>
        </a-menu-item>
        <a-sub-menu key="runtime">
          <template #icon><DeploymentUnitOutlined /></template>
          <template #title>部署与运行时</template>
          <a-menu-item key="servers">Server 目录</a-menu-item>
          <a-menu-item key="deploy">部署发布</a-menu-item>
        </a-sub-menu>
        <a-menu-item key="repository">
          <template #icon><AppstoreOutlined /></template>
          <span>配置仓库</span>
        </a-menu-item>
        <a-menu-item key="monitor">
          <template #icon><LineChartOutlined /></template>
          <span>运行监控</span>
        </a-menu-item>

        <a-sub-menu key="admin">
          <template #icon><SettingOutlined /></template>
          <template #title>系统管理</template>
          <a-menu-item key="tenants">租户管理</a-menu-item>
          <a-menu-item key="ai-settings">AI 引擎</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>

    <a-layout :style="{ marginLeft: appStore.sidebarCollapsed ? '80px' : '200px' }">
      <a-layout-header class="main-layout__header">
        <div class="main-layout__header-left">
          <component
            :is="appStore.sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined"
            class="main-layout__trigger"
            @click="appStore.toggleSidebar"
          />
          <span class="main-layout__page-title">{{ currentPageTitle }}</span>
        </div>
        <div class="main-layout__header-status">
          <span class="status-dot" />
          <span>系统正常</span>
        </div>
      </a-layout-header>

      <a-layout-content class="main-layout__content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import {
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    DashboardOutlined,
    ThunderboltOutlined,
    AppstoreOutlined,
    SettingOutlined,
    ToolOutlined,
    DeploymentUnitOutlined,
    LineChartOutlined
  } from '@ant-design/icons-vue';
  import { useAppStore } from '@/store/app';

  const router = useRouter();
  const route = useRoute();
  const appStore = useAppStore();

  const selectedKeys = ref<string[]>([]);
  const openKeys = ref<string[]>(['admin']);

  const getMenuKey = (path: string): string => {
    if (path.startsWith('/generator')) return 'generator';
    if (path.startsWith('/library')) return 'library';
    if (path.startsWith('/runtime/servers')) return 'servers';
    if (path.startsWith('/runtime/deploy')) return 'deploy';
    if (path.startsWith('/repository')) return 'repository';
    if (path.startsWith('/monitor')) return 'monitor';
    if (path.startsWith('/admin/tenants')) return 'tenants';
    if (path.startsWith('/settings/ai')) return 'ai-settings';
    return 'dashboard';
  };

  watch(
    () => route.path,
    (path) => {
      selectedKeys.value = [getMenuKey(path)];
    },
    { immediate: true }
  );

  const menuRouteMap: Record<string, string> = {
    dashboard: '/',
    generator: '/generator',
    library: '/library',
    servers: '/runtime/servers',
    deploy: '/runtime/deploy',
    repository: '/repository',
    monitor: '/monitor',
    tenants: '/admin/tenants',
    'ai-settings': '/settings/ai'
  };

  const pageTitleMap: Record<string, string> = {
    dashboard: '概览',
    generator: '生成器',
    library: '工具库',
    servers: 'Server 目录',
    deploy: '部署发布',
    repository: '配置仓库',
    monitor: '运行监控',
    tenants: '租户管理',
    'ai-settings': 'AI 引擎'
  };

  const currentPageTitle = computed(() => {
    const key = getMenuKey(route.path);
    return pageTitleMap[key] ?? '概览';
  });

  function onMenuClick({ key }: { key: string }) {
    const target = menuRouteMap[key];
    if (target && route.path !== target) {
      router.push(target);
    }
  }
</script>

<style scoped>
  .main-layout {
    min-height: 100vh;
  }

  .main-layout__sider {
    overflow: auto;
    height: 100vh;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 10;
  }

  .main-layout__logo {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .main-layout__header {
    background: #fff;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 9;
    border-bottom: 1px solid var(--border);
  }

  .main-layout__header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .main-layout__trigger {
    font-size: 18px;
    cursor: pointer;
    transition: color 0.3s;
  }

  .main-layout__page-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-main);
  }

  .main-layout__header-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 14px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
  }

  .main-layout__trigger:hover {
    color: var(--primary);
  }

  .main-layout__content {
    margin: 24px;
    min-height: 280px;
    background: transparent;
  }
</style>
