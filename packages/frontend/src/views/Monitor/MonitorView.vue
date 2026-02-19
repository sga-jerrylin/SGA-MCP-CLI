<template>
  <div class="monitor-view">
    <a-row :gutter="[16, 16]" style="margin-bottom: 16px">
      <a-col :span="24">
        <a-card title="System Overview" :bordered="false">
          <a-skeleton v-if="loadingMetrics" active />
          <a-row v-else :gutter="16">
            <a-col :span="6">
              <a-statistic title="Uptime" :value="metrics.uptime" suffix="s" />
            </a-col>
            <a-col :span="6">
              <a-statistic
                title="Memory Usage"
                :value="Math.round(metrics.memUsed / 1024 / 1024)"
                suffix="MB"
              />
            </a-col>
            <a-col :span="6">
              <a-statistic title="Active Servers" :value="metrics.totalServers" />
            </a-col>
            <a-col :span="6">
              <a-statistic title="Total Packages" :value="metrics.totalPackages" />
            </a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>

    <a-card title="CLI Agent Runs" :bordered="false">
      <template #extra>
        <a-button :loading="loadingRuns" @click="fetchRuns">
          <template #icon><ReloadOutlined /></template>
          Refresh
        </a-button>
      </template>

      <a-table
        row-key="runId"
        size="small"
        :columns="runColumns"
        :data-source="runs"
        :loading="loadingRuns"
        :pagination="{ pageSize: 10 }"
        :expand-row-by-click="true"
        @expand="onExpandRun"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="statusBadgeMap[(record as CliRunSummary).status]"
              :text="(record as CliRunSummary).status"
            />
          </template>
          <template v-else-if="column.key === 'startedAt'">
            {{ formatDate((record as CliRunSummary).startedAt) }}
          </template>
        </template>

        <template #expandedRowRender="{ record }">
          <div class="run-logs-wrapper">
            <div
              :ref="(el) => setLogContainerRef((record as CliRunSummary).runId, el)"
              class="run-logs-terminal"
            >
              <div
                v-for="(event, index) in runLogs[(record as CliRunSummary).runId] ?? []"
                :key="`${(record as CliRunSummary).runId}-${index}`"
                class="log-line"
              >
                <span class="log-time">[{{ formatTime(event.timestamp) }}]</span>
                <a-tag class="log-tag" :color="eventTagColor[event.type]">
                  {{ event.type }}
                </a-tag>
                <span class="log-message">{{ formatEventMessage(event) }}</span>
              </div>
              <div
                v-if="(runLogs[(record as CliRunSummary).runId] ?? []).length === 0"
                class="log-empty"
              >
                Waiting for events...
              </div>
            </div>
          </div>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
  import { ReloadOutlined } from '@ant-design/icons-vue';
  import dayjs from 'dayjs';
  import { nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
  import type { ComponentPublicInstance } from 'vue';
  import type { ApiResponse } from '@sga/shared';
  import http from '@/utils/http';

  interface SystemMetricsSnapshot {
    uptime: number;
    memUsed: number;
    activeRequests: number;
    totalPackages: number;
    totalServers: number;
  }

  type CliRunStatus = 'running' | 'done' | 'error';

  interface CliRunSummary {
    runId: string;
    root: string;
    status: CliRunStatus;
    startedAt: string;
    eventCount: number;
  }

  type CliRunEventType = 'log' | 'progress' | 'done' | 'error';

  interface CliRunEvent {
    type: CliRunEventType;
    message?: string;
    percent?: number;
    timestamp: string;
  }

  const metrics = ref<SystemMetricsSnapshot>({
    uptime: 0,
    memUsed: 0,
    activeRequests: 0,
    totalPackages: 0,
    totalServers: 0
  });
  const loadingMetrics = ref(false);

  const runs = ref<CliRunSummary[]>([]);
  const loadingRuns = ref(false);

  const runColumns = [
    { title: 'Run ID', dataIndex: 'runId', key: 'runId', width: 180 },
    { title: 'Root', dataIndex: 'root', key: 'root', ellipsis: true },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 140 },
    { title: 'Started At', dataIndex: 'startedAt', key: 'startedAt', width: 220 },
    { title: 'Event Count', dataIndex: 'eventCount', key: 'eventCount', width: 120 }
  ];

  const statusBadgeMap: Record<CliRunStatus, 'processing' | 'success' | 'error'> = {
    running: 'processing',
    done: 'success',
    error: 'error'
  };

  const eventTagColor: Record<CliRunEventType, string> = {
    log: 'default',
    progress: 'processing',
    done: 'success',
    error: 'error'
  };

  const runLogs = reactive<Record<string, CliRunEvent[]>>({});
  const runStreams = new Map<string, EventSource>();
  const logContainers = new Map<string, HTMLElement>();

  const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const isCliRunEventType = (value: unknown): value is CliRunEventType =>
    value === 'log' || value === 'progress' || value === 'done' || value === 'error';

  const parseCliRunEvent = (payload: string): CliRunEvent | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }

    if (!isObjectRecord(parsed) || !isCliRunEventType(parsed.type)) {
      return null;
    }

    return {
      type: parsed.type,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
      percent: typeof parsed.percent === 'number' ? parsed.percent : undefined,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString()
    };
  };

  const fetchMetrics = async (): Promise<void> => {
    loadingMetrics.value = true;
    try {
      const response = (await http.get<ApiResponse<SystemMetricsSnapshot>>(
        '/monitor/metrics'
      )) as unknown as ApiResponse<SystemMetricsSnapshot>;
      metrics.value = response.data;
    } finally {
      loadingMetrics.value = false;
    }
  };

  const fetchRuns = async (): Promise<void> => {
    loadingRuns.value = true;
    try {
      const response = (await http.get<ApiResponse<CliRunSummary[]>>(
        '/monitor/cli-runs'
      )) as unknown as ApiResponse<CliRunSummary[]>;
      runs.value = response.data;
    } finally {
      loadingRuns.value = false;
    }
  };

  const scrollLogsToBottom = (runId: string): void => {
    nextTick(() => {
      const element = logContainers.get(runId);
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  };

  type RefElement = Element | ComponentPublicInstance | null;

  const setLogContainerRef = (runId: string, source: RefElement): void => {
    const element = source instanceof HTMLElement ? source : null;
    if (element) {
      logContainers.set(runId, element);
      return;
    }
    logContainers.delete(runId);
  };

  const appendLogEvent = (runId: string, event: CliRunEvent): void => {
    if (!runLogs[runId]) {
      runLogs[runId] = [];
    }
    runLogs[runId].push(event);
    scrollLogsToBottom(runId);
  };

  const handleSseMessage = (runId: string, event: MessageEvent<string>): void => {
    const parsed = parseCliRunEvent(event.data);
    if (parsed) {
      appendLogEvent(runId, parsed);
    }
  };

  const openRunStream = (runId: string): void => {
    if (runStreams.has(runId)) {
      return;
    }

    runLogs[runId] = [];
    const stream = new EventSource(`/api/monitor/cli-runs/${encodeURIComponent(runId)}/events`);
    const eventTypes: CliRunEventType[] = ['log', 'progress', 'done', 'error'];

    stream.onmessage = (event) => handleSseMessage(runId, event);

    for (const eventType of eventTypes) {
      stream.addEventListener(eventType, (event) => {
        if (event instanceof MessageEvent) {
          handleSseMessage(runId, event);
        }
      });
    }

    runStreams.set(runId, stream);
  };

  const closeRunStream = (runId: string): void => {
    const stream = runStreams.get(runId);
    if (!stream) {
      return;
    }
    stream.close();
    runStreams.delete(runId);
  };

  const onExpandRun = (expanded: boolean, record: CliRunSummary): void => {
    if (expanded) {
      openRunStream(record.runId);
    } else {
      closeRunStream(record.runId);
    }
  };

  const formatDate = (value: string): string => dayjs(value).format('YYYY-MM-DD HH:mm:ss');
  const formatTime = (value: string): string => dayjs(value).format('HH:mm:ss');

  const formatEventMessage = (event: CliRunEvent): string => {
    if (event.type === 'progress' && typeof event.percent === 'number') {
      return `Progress ${event.percent}%`;
    }
    if (typeof event.message === 'string' && event.message.length > 0) {
      return event.message;
    }
    if (event.type === 'done') {
      return 'Run completed';
    }
    if (event.type === 'error') {
      return 'Run failed';
    }
    return 'Log event';
  };

  let pollTimer: number | null = null;

  onMounted(() => {
    void fetchMetrics();
    void fetchRuns();
    pollTimer = window.setInterval(() => {
      void fetchRuns();
    }, 10000);
  });

  onUnmounted(() => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    for (const stream of runStreams.values()) {
      stream.close();
    }
    runStreams.clear();
    logContainers.clear();
  });
</script>

<style scoped lang="less">
  .monitor-view {
    padding: 0;
  }

  .run-logs-wrapper {
    padding: 8px;
    background: #fafafa;
    border-radius: 4px;
  }

  .run-logs-terminal {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    border-radius: 4px;
    height: 280px;
    overflow-y: auto;
    font-family: Consolas, Monaco, 'Courier New', monospace;
    font-size: 12px;
  }

  .log-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.5;
    margin-bottom: 4px;
  }

  .log-time {
    color: #8a8a8a;
    white-space: nowrap;
  }

  .log-tag {
    min-width: 78px;
    text-align: center;
    margin: 0;
  }

  .log-message {
    word-break: break-word;
  }

  .log-empty {
    text-align: center;
    color: #777;
    margin-top: 20px;
  }
</style>
