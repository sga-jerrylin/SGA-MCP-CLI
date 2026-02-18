<template>
  <div class="dashboard-view">
    <a-page-header title="概览" sub-title="系统总览与状态监控" />

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card :loading="loading">
          <a-statistic title="MCP 服务" :value="summary?.activeServers ?? 0" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card :loading="loading">
          <a-statistic title="今日请求" :value="summary?.totalCallsLast24h ?? 0" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card :loading="loading">
          <a-statistic title="总包数" :value="summary?.totalPackages ?? 0" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card :loading="loading">
          <a-statistic title="运行时间" :value="uptimeLabel" />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
      <a-col :xs="24" :lg="14">
        <a-card title="24h 调用趋势" :loading="loading">
          <div v-if="trendBars.length > 0" class="trend-chart">
            <div v-for="bar in trendBars" :key="bar.hour" class="trend-bar-item">
              <span class="trend-count">{{ bar.count }}</span>
              <div class="trend-bar-track">
                <div class="trend-bar-fill" :style="{ height: `${bar.heightPercent}%` }" />
              </div>
              <span class="trend-label">{{ bar.label }}</span>
            </div>
          </div>
          <a-empty v-else description="No trend data" />
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="10">
        <a-card title="Top Tools" :loading="loading">
          <a-table
            row-key="toolName"
            size="small"
            :columns="toolColumns"
            :data-source="summary?.topTools ?? []"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'lastCalledAt'">
                {{ formatDate((record as ToolCallStat).lastCalledAt) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
  import type { ApiResponse, DashboardSummary, ToolCallStat } from '@mcp-claw/shared';
  import dayjs from 'dayjs';
  import { computed, onMounted, ref } from 'vue';
  import http from '@/utils/http';

  const loading = ref(false);
  const summary = ref<DashboardSummary | null>(null);

  const toolColumns = [
    { title: 'Tool', dataIndex: 'toolName', key: 'toolName' },
    { title: 'Server', dataIndex: 'serverName', key: 'serverName' },
    { title: 'Calls', dataIndex: 'callCount', key: 'callCount', width: 90 },
    { title: 'Last Called', dataIndex: 'lastCalledAt', key: 'lastCalledAt', width: 170 }
  ];

  const uptimeLabel = computed(() => {
    const totalSeconds = summary.value?.uptimeSeconds ?? 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  });

  const trendBars = computed(() => {
    const points = summary.value?.hourlyTrend ?? [];
    const maxValue = Math.max(1, ...points.map((point) => point.count));

    return points.map((point) => ({
      hour: point.hour,
      label: dayjs(point.hour).format('HH:mm'),
      count: point.count,
      heightPercent: Math.max(6, Math.round((point.count / maxValue) * 100))
    }));
  });

  const formatDate = (value: string): string => dayjs(value).format('MM-DD HH:mm:ss');

  const fetchDashboard = async (): Promise<void> => {
    loading.value = true;
    try {
      const response = (await http.get<ApiResponse<DashboardSummary>>(
        '/monitor/dashboard'
      )) as unknown as ApiResponse<DashboardSummary>;
      summary.value = response.data;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    void fetchDashboard();
  });
</script>

<style scoped lang="less">
  .dashboard-view {
    padding: 0;
  }

  .trend-chart {
    display: grid;
    grid-template-columns: repeat(24, minmax(0, 1fr));
    gap: 6px;
    align-items: end;
    min-height: 210px;
    overflow-x: auto;
    padding-bottom: 8px;
  }

  .trend-bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .trend-count {
    font-size: 11px;
    color: #475569;
  }

  .trend-bar-track {
    width: 100%;
    height: 120px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #f1f5f9;
    padding: 4px;
  }

  .trend-bar-fill {
    width: 100%;
    background: #2563eb;
    border-radius: 4px;
    transition: height 0.2s ease;
  }

  .trend-label {
    font-size: 11px;
    color: #64748b;
  }
</style>
