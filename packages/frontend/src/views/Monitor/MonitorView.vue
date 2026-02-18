<template>
  <div class="monitor-view">
    <a-row :gutter="[16, 16]">
      <a-col :span="selectedRunId ? 10 : 24">
        <a-card title="CLI Agent Runs" :bordered="false">
          <template #extra>
            <a-button @click="fetchRuns" :loading="loading">
              <template #icon><ReloadOutlined /></template>刷新
            </a-button>
          </template>
          <a-table
            :columns="columns"
            :data-source="runs"
            row-key="runId"
            size="small"
            :pagination="{ pageSize: 10 }"
            :custom-row="customRow"
            :row-selection="{ selectedRowKeys: selectedRunId ? [selectedRunId] : [], type: 'radio', onChange: onSelectChange }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColorMap[record.status as AgentRunStatus]">
                  {{ record.status.toUpperCase() }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'startedAt'">
                {{ formatDateTime(record.startedAt) }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>

      <a-col v-if="selectedRunId" :span="14">
        <a-card :title="`Run Events: ${selectedRunId}`" :bordered="false">
          <template #extra>
            <a-button type="link" @click="closeLogs">关闭</a-button>
          </template>
          <div ref="logContainer" class="log-terminal">
            <div v-for="(event, index) in logs" :key="index" class="log-line">
              <span class="log-time">[{{ formatTime((event as any).timestamp) }}]</span>
              <a-tag :color="eventColorMap[event.type]" size="small" class="log-type">
                {{ event.type }}
              </a-tag>
              <span class="log-msg">{{ (event as any).message || (event as any).details || event.type }}</span>
            </div>
            <div v-if="logs.length === 0" class="log-empty">等待事件...</div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
  import { ReloadOutlined } from '@ant-design/icons-vue';
  import dayjs from 'dayjs';
  import http from '@/utils/http';
  import { useSse } from '@/hooks/useSse';
  import type { ApiResponse, SseEvent, SseLogEvent, AgentRun, AgentRunStatus } from '@mcp-claw/shared';

  const runs = ref<AgentRun[]>([]);
  const loading = ref(false);
  const selectedRunId = ref<string | null>(null);
  const logs = ref<SseEvent[]>([]);
  const logContainer = ref<HTMLElement | null>(null);

  const columns = [
    { title: 'Run ID', dataIndex: 'runId', key: 'runId', width: 120 },
    { title: 'Root', dataIndex: 'root', key: 'root', ellipsis: true },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100 },
    { title: 'Started At', dataIndex: 'startedAt', key: 'startedAt', width: 160 },
    { title: 'Events', dataIndex: 'eventCount', key: 'eventCount', width: 80 }
  ];

  const statusColorMap: Record<AgentRunStatus, string> = {
    running: 'blue',
    done: 'green',
    error: 'red'
  };

  const eventColorMap: Record<string, string> = {
    log: 'default',
    progress: 'processing',
    step_change: 'warning',
    done: 'success',
    error: 'error'
  };

  const fetchRuns = async () => {
    loading.value = true;
    try {
      const res = (await http.get<ApiResponse<AgentRun[]>>(
        '/monitor/cli-runs'
      )) as unknown as ApiResponse<AgentRun[]>;
      if (res.code === 0) {
        runs.value = res.data;
      }
    } finally {
      loading.value = false;
    }
  };

  const formatDateTime = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  const formatTime = (date?: string) => (date ? dayjs(date).format('HH:mm:ss') : dayjs().format('HH:mm:ss'));

  const customRow = (record: AgentRun) => {
    return {
      onClick: () => {
        selectRun(record.runId);
      },
      style: { cursor: 'pointer' }
    };
  };

  const onSelectChange = (selectedRowKeys: any[]) => {
    if (selectedRowKeys.length > 0) {
      selectRun(selectedRowKeys[0]);
    } else {
      closeLogs();
    }
  };

  let stopSse: (() => void) | null = null;

  const selectRun = (runId: string) => {
    if (selectedRunId.value === runId) return;
    
    closeLogs();
    selectedRunId.value = runId;
    logs.value = [];

    const { connect, disconnect } = useSse(`/api/monitor/cli-runs/${runId}/events`, (data) => {
      logs.value.push(data);
      scrollToBottom();
    });

    connect();
    stopSse = disconnect;
  };

  const closeLogs = () => {
    if (stopSse) {
      stopSse();
      stopSse = null;
    }
    selectedRunId.value = null;
    logs.value = [];
  };

  const scrollToBottom = () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  };

  const onMessage = (data: SseEvent) => {
    logs.value.push(data);
    scrollToBottom();
  };

  let pollTimer: number | null = null;

  onMounted(() => {
    fetchRuns();
    pollTimer = window.setInterval(fetchRuns, 10000);
  });

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (stopSse) stopSse();
  });

  watch(logs, () => {
    scrollToBottom();
  }, { deep: true });
</script>

<style scoped lang="less">
  .monitor-view {
    padding: 0;
  }

  .log-terminal {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    height: 500px;
    overflow-y: auto;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    border-radius: 4px;

    .log-line {
      margin-bottom: 4px;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 8px;

      .log-time {
        color: #888;
        white-space: nowrap;
      }

      .log-type {
        min-width: 80px;
        text-align: center;
        margin: 0;
      }

      .log-msg {
        word-break: break-all;
      }
    }

    .log-empty {
      color: #555;
      text-align: center;
      margin-top: 40px;
    }
  }
</style>
