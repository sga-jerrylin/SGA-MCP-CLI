<template>
  <a-card title="MCP 项目" :bordered="false">
    <template #extra>
      <a-button type="primary" size="small" @click="showImport = true">新建</a-button>
    </template>
    <a-list :data-source="generatorStore.projects" item-layout="horizontal">
      <template #renderItem="{ item }">
        <a-list-item
          :class="{ active: generatorStore.currentProject?.id === item.id }"
          class="clickable"
          @click="generatorStore.currentProject = item"
        >
          <a-list-item-meta :title="item.name" :description="item.status" />
        </a-list-item>
      </template>
    </a-list>
    <import-modal v-model:visible="showImport" />
  </a-card>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useGeneratorStore } from '@/store/generator';
  import ImportModal from './ImportModal.vue';
  import http from '@/utils/http';
  import type { ApiResponse, PaginatedList, Project } from '@sga/shared';

  const generatorStore = useGeneratorStore();
  const showImport = ref(false);

  onMounted(async () => {
    const res = (await http.get<ApiResponse<PaginatedList<Project>>>(
      '/generator/projects'
    )) as unknown as ApiResponse<PaginatedList<Project>>;
    if (res.code === 0) {
      generatorStore.setProjects(res.data.items);
    }
  });
</script>

<style scoped>
  .clickable {
    cursor: pointer;
  }
  .clickable:hover {
    background-color: #f0f0f0;
  }
  .active {
    background-color: #e6f7ff;
  }
</style>
