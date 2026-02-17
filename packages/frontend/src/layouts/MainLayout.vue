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
        <component
          :is="appStore.sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined"
          class="main-layout__trigger"
          @click="appStore.toggleSidebar"
        />
      </a-layout-header>

      <a-layout-content class="main-layout__content">
        <router-view />
      </a-layout-content>

      <a-layout-footer class="main-layout__footer">
        MCP Claw &copy; {{ currentYear }}
      </a-layout-footer>
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
    DeploymentUnitOutlined
  } from '@ant-design/icons-vue';
  import { useAppStore } from '@/store/app';

  const router = useRouter();
  const route = useRoute();
  const appStore = useAppStore();

  const currentYear = computed(() => new Date().getFullYear());

  const selectedKeys = ref<string[]>([]);
  const openKeys = ref<string[]>(['admin']);

  const getMenuKey = (path: string): string => {
    if (path.startsWith('/generator')) return 'generator';
    if (path.startsWith('/library')) return 'library';
    if (path.startsWith('/runtime/servers')) return 'servers';
    if (path.startsWith('/runtime/deploy')) return 'deploy';
    if (path.startsWith('/repository')) return 'repository';
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
    tenants: '/admin/tenants',
    'ai-settings': '/settings/ai'
  };

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
    position: sticky;
    top: 0;
    z-index: 9;
    box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  }

  .main-layout__trigger {
    font-size: 18px;
    cursor: pointer;
    transition: color 0.3s;
  }

  .main-layout__trigger:hover {
    color: #1890ff;
  }

  .main-layout__content {
    margin: 24px;
    min-height: 280px;
  }

  .main-layout__footer {
    text-align: center;
    color: rgba(0, 0, 0, 0.45);
  }
</style>
