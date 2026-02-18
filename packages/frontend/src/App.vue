<template>
  <a-config-provider :theme="themeConfig">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { theme } from 'ant-design-vue';
  import { useAppStore } from '@/store/app';

  const appStore = useAppStore();

  const themeConfig = computed(() => ({
    algorithm: appStore.isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563eb',
      borderRadius: 8,
      fontFamily: "'Inter', system-ui, sans-serif"
    }
  }));
</script>

<style>
  body {
    margin: 0;
    padding: 0;
  }
</style>
