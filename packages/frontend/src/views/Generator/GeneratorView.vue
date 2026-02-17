<template>
  <div class="generator-container">
    <a-row :gutter="24">
      <a-col :span="6">
        <project-list />
      </a-col>
      <a-col :span="18">
        <project-detail v-if="generatorStore.currentProject" />
        <a-empty v-else description="请选择或创建一个项目" />
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
  import { useGeneratorStore } from '@/store/generator';
  import ProjectList from './components/ProjectList.vue';
  import ProjectDetail from './components/ProjectDetail.vue';

  const generatorStore = useGeneratorStore();
</script>
