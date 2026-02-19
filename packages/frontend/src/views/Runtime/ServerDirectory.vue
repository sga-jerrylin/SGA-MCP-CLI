<template>
  <div class="server-directory">
    <a-page-header title="Server 目录服务" sub-title="监控 13 个独立 MCP Server 的运行状态与 Token 预算">
      <template #extra>
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 Server 名称..."
          style="width: 250px; margin-right: 16px"
          @search="onSearch"
        />
        <a-button @click="fetchData"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="$router.push('/generator')">生成新 Server</a-button>
      </template>
    </a-page-header>

    <a-row :gutter="[16, 16]">
      <a-col v-for="server in filteredServers" :key="server.id" :xs="24" :sm="12" :md="8" :lg="6">
        <a-card :title="server.name" class="server-card">
          <template #extra>
            <a-badge :status="server.status === 'healthy' ? 'success' : 'error'" :text="server.status" />
          </template>
          <div class="stats">
            <div class="stat-item">
              <div class="label">工具数</div>
              <div class="value">{{ server.toolCount }}</div>
            </div>
            <div class="stat-item">
              <div class="label">Token 预算</div>
              <a-progress :percent="Math.round((server.tokenUsage / server.tokenBudget) * 100)" size="small" />
            </div>
          </div>
          <template #actions>
            <a-button type="link" size="small" @click="viewTools(server)">详情</a-button>
            <a-button type="link" size="small">日志</a-button>
          </template>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import http from '@/utils/http';
import type { ApiResponse, McpServer } from '@sga/shared';

const servers = ref<McpServer[]>([]);
const searchText = ref('');

const filteredServers = computed(() => {
  if (!searchText.value) return servers.value;
  return servers.value.filter(s => s.name.toLowerCase().includes(searchText.value.toLowerCase()));
});

const onSearch = (val: string) => {
  searchText.value = val;
};

const fetchData = async () => {
  try {
    const res = await http.get<ApiResponse<McpServer[]>>('/runtime/servers') as unknown as ApiResponse<McpServer[]>;
    if (res.code === 0) {
      servers.value = res.data;
    }
  } catch (error) {
    console.error('Failed to fetch servers', error);
  }
};

const viewTools = (server: McpServer) => {
  // Logic to show tool list modal or navigate
  console.log('Viewing tools for', server.name);
};

onMounted(fetchData);
</script>

<style scoped>
.server-card .stats { display: flex; justify-content: space-between; margin-top: 16px; }
.stat-item { flex: 1; }
.stat-item .label { font-size: 12px; color: #999; }
.stat-item .value { font-size: 18px; font-weight: bold; }
</style>
