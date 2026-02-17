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

      <a-menu v-model:selected-keys="selectedKeys" theme="dark" mode="inline" @click="onMenuClick">
        <a-menu-item key="dashboard">
          <template #icon><DashboardOutlined /></template>
          <span>概览</span>
        </a-menu-item>
        <a-menu-item key="generator">
          <template #icon><ThunderboltOutlined /></template>
          <span>生成器</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
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
  import { ref, computed } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import {
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    DashboardOutlined,
    ThunderboltOutlined
  } from '@ant-design/icons-vue';
  import { useAppStore } from '@/store/app';

  const router = useRouter();
  const route = useRoute();
  const appStore = useAppStore();

  const currentYear = computed(() => new Date().getFullYear());

  /** 根据当前路由计算选中的菜单 key */
  const selectedKeys = ref<string[]>([getMenuKey(route.path)]);

  function getMenuKey(path: string): string {
    if (path.startsWith('/generator')) return 'generator';
    return 'dashboard';
  }

  const menuRouteMap: Record<string, string> = {
    dashboard: '/',
    generator: '/generator'
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
