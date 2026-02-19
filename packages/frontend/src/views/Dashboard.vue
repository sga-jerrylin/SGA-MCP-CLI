<template>
  <div class="dashboard-view">
    <!-- ── 页面头部 ───────────────────────────────── -->
    <div class="dash-header">
      <h2 class="dash-title">系统概览</h2>
      <div class="dash-status">
        <span class="status-dot" />
        <span>MCP Runtime：运行中</span>
        <span class="status-sep">|</span>
        <span>版本：v{{ appVersion }}</span>
        <span class="status-sep">|</span>
        <span>运行时间：{{ uptimeLabel }}</span>
      </div>
    </div>

    <!-- ── Hub 拓扑图 ─────────────────────────────── -->
    <a-card :bordered="false" class="hub-card">
      <div class="hub-layout">
        <!-- 上游业务系统 -->
        <div class="hub-side">
          <div class="hub-side-header">
            上游业务系统
            <span class="hub-badge">{{ upstreamSystems.length }}</span>
          </div>
          <div class="hub-list">
            <div
              v-for="sys in upstreamSystems"
              :key="sys.id"
              class="hub-item"
              :class="{ 'hub-item--active': sys.online }"
            >
              <span class="hub-item-icon">{{ sys.icon }}</span>
              <div class="hub-item-info">
                <div class="hub-item-name">{{ sys.name }}</div>
                <div class="hub-item-meta">{{ sys.env }} / {{ sys.auth }}</div>
              </div>
              <span class="hub-dot" :class="sys.online ? 'hub-dot--green' : 'hub-dot--gray'" />
            </div>
          </div>
        </div>

        <!-- 连线 左侧 -->
        <div class="hub-connector">
          <div class="hub-line" />
          <div class="hub-arrow-head">▶</div>
        </div>

        <!-- MCP HUB 中心 -->
        <div class="hub-center">
          <div class="hub-ring hub-ring--outer">
            <div class="hub-ring hub-ring--middle">
              <div class="hub-core">
                <span class="hub-core-icon">⚙</span>
                <span class="hub-core-label">Runtime</span>
              </div>
            </div>
          </div>
          <div class="hub-shards">
            <span class="hub-shards-num">{{ summary?.activeServers ?? 0 }}</span>
            <span class="hub-shards-label">SHARDS</span>
          </div>
          <div class="hub-center-title">MCP HUB（本机）</div>
        </div>

        <!-- 连线 右侧 -->
        <div class="hub-connector">
          <div class="hub-arrow-head">▶</div>
          <div class="hub-line" />
        </div>

        <!-- 下游 AGENT -->
        <div class="hub-side">
          <div class="hub-side-header">
            下游 AGENT
            <span class="hub-badge">{{ downstreamAgents.length }}</span>
          </div>
          <div class="hub-list">
            <div v-for="agent in downstreamAgents" :key="agent.id" class="hub-item hub-item--agent">
              <span class="hub-item-icon">{{ agent.icon }}</span>
              <div class="hub-item-info">
                <div class="hub-item-name">{{ agent.name }}</div>
                <div class="hub-item-meta">{{ agent.sub }}</div>
              </div>
              <span class="hub-item-time">{{ agent.lastSeen }}</span>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <!-- ── 大指标行 ──────────────────────────────── -->
    <div class="metrics-row">
      <div class="metric-item" :class="{ 'metric-item--loading': loading }">
        <div class="metric-value">{{ summary?.totalPackages ?? 0 }}</div>
        <div class="metric-label">已发布工具</div>
      </div>
      <div class="metric-divider" />
      <div class="metric-item">
        <div class="metric-value metric-value--green">99.9%</div>
        <div class="metric-label">今日成功率</div>
      </div>
      <div class="metric-divider" />
      <div class="metric-item">
        <div class="metric-value">{{ summary?.totalCallsLast24h ?? 0 }}</div>
        <div class="metric-label">今日请求总量</div>
      </div>
      <div class="metric-divider" />
      <div class="metric-item">
        <div class="metric-value metric-value--blue">{{ avgLatencyMs }}ms</div>
        <div class="metric-label">平均耗时</div>
      </div>
    </div>

    <!-- ── 图表行 ─────────────────────────────────── -->
    <a-row :gutter="[16, 16]">
      <!-- 24h 调用量趋势 -->
      <a-col :xs="24" :lg="12">
        <a-card title="24h 调用量趋势" :bordered="false" :loading="loading">
          <div v-if="trendBars.length > 0" class="trend-chart">
            <div v-for="bar in trendBars" :key="bar.hour" class="trend-col">
              <div class="trend-bar-wrap">
                <div class="trend-bar" :style="{ height: `${bar.heightPercent}%` }">
                  <span v-if="bar.count > 0" class="trend-tip">{{ bar.count }}</span>
                </div>
              </div>
              <span class="trend-label">{{ bar.label }}</span>
            </div>
          </div>
          <a-empty v-else description="暂无数据" />
        </a-card>
      </a-col>

      <!-- Top 5 热门工具 -->
      <a-col :xs="24" :lg="7">
        <a-card title="Top 5 热门工具" :bordered="false" :loading="loading">
          <div class="top-tools">
            <div v-for="(tool, index) in topFiveTools" :key="tool.toolName" class="top-tool-row">
              <span class="tool-rank" :class="`tool-rank--${index + 1}`">{{ index + 1 }}</span>
              <div class="tool-info">
                <div class="tool-name">{{ tool.toolName }}</div>
                <div class="tool-server">{{ tool.serverName }}</div>
              </div>
              <span class="tool-count">{{ tool.callCount }}</span>
            </div>
            <a-empty v-if="topFiveTools.length === 0" description="暂无数据" />
          </div>
        </a-card>
      </a-col>

      <!-- 错误分布 -->
      <a-col :xs="24" :lg="5">
        <a-card title="错误分布 (Last 1h)" :bordered="false">
          <div class="error-dist">
            <div class="donut-wrap">
              <div class="donut" />
              <div class="donut-hole">
                <span class="donut-center-num">{{ totalErrors }}</span>
                <span class="donut-center-label">次错误</span>
              </div>
            </div>
            <div class="error-legend">
              <div v-for="item in errorSegments" :key="item.label" class="legend-item">
                <span class="legend-dot" :style="{ background: item.color }" />
                <span class="legend-label">{{ item.label }}</span>
                <span class="legend-pct">{{ item.pct }}%</span>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
  import type { ApiResponse, DashboardSummary, ToolCallStat } from '@sga/shared';
  import dayjs from 'dayjs';
  import { computed, onMounted, ref } from 'vue';
  import http from '@/utils/http';

  // ── 状态 ───────────────────────────────────────
  const loading = ref(false);
  const summary = ref<DashboardSummary | null>(null);
  const appVersion = '1.0.2';

  // ── Mock：上游系统 ───────────────────────────────
  const upstreamSystems = [
    { id: 1, name: '金蝶 Cloud', env: 'PROD', auth: 'OAuth2', icon: '🏭', online: true },
    { id: 2, name: '用友 U8', env: 'PROD', auth: 'ApiKey', icon: '📦', online: true },
    { id: 3, name: 'Oracle EBS', env: 'PROD', auth: 'JWT', icon: '🔶', online: true },
    { id: 4, name: 'Shopify', env: 'SBX', auth: 'OAuth2', icon: '🛍️', online: false }
  ];

  // ── Mock：下游 Agent ─────────────────────────────
  const downstreamAgents = [
    { id: 1, name: 'OpenClaw', sub: 'HR Bot', icon: '🤖', lastSeen: '刚刚' },
    { id: 2, name: 'Dify App', sub: 'Finance Asst', icon: '💬', lastSeen: '1m前' },
    { id: 3, name: 'DingTalk', sub: 'Group Chat', icon: '🔔', lastSeen: '3m前' },
    { id: 4, name: 'Test Agent', sub: 'Sandbox', icon: '🧪', lastSeen: '12m前' }
  ];

  // ── Mock：错误分布 ────────────────────────────────
  const errorSegments = [
    { label: 'Validation', pct: 80, color: '#2563eb' },
    { label: 'Auth', pct: 15, color: '#f59e0b' },
    { label: 'Timeout', pct: 5, color: '#ef4444' }
  ];
  const totalErrors = 24;

  // ── Mock：平均延迟（从 topTools durationMs 估算）───
  const avgLatencyMs = 142;

  // ── 计算属性 ────────────────────────────────────
  const uptimeLabel = computed(() => {
    const s = summary.value?.uptimeSeconds ?? 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  });

  const topFiveTools = computed<ToolCallStat[]>(() => {
    return (summary.value?.topTools ?? []).slice(0, 5);
  });

  const trendBars = computed(() => {
    const points = summary.value?.hourlyTrend ?? [];
    const max = Math.max(1, ...points.map((p) => p.count));
    return points.map((p) => ({
      hour: p.hour,
      label: dayjs(p.hour).format('HH'),
      count: p.count,
      heightPercent: Math.max(4, Math.round((p.count / max) * 100))
    }));
  });

  // ── 数据加载 ────────────────────────────────────
  const fetchDashboard = async (): Promise<void> => {
    loading.value = true;
    try {
      const res = (await http.get<ApiResponse<DashboardSummary>>(
        '/monitor/dashboard'
      )) as unknown as ApiResponse<DashboardSummary>;
      summary.value = res.data;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    void fetchDashboard();
  });
</script>

<style scoped lang="less">
  // ── 布局变量 ─────────────────────────────────────
  @blue: #2563eb;
  @blue-light: #eff6ff;
  @green: #16a34a;
  @amber: #f59e0b;
  @red: #ef4444;
  @text-primary: #0f172a;
  @text-secondary: #64748b;
  @border: #e2e8f0;
  @card-radius: 12px;

  .dashboard-view {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  // ── 页面头部 ─────────────────────────────────────
  .dash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
  }

  .dash-title {
    font-size: 20px;
    font-weight: 700;
    color: @text-primary;
    margin: 0;
  }

  .dash-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: @text-secondary;
    background: #f8fafc;
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid @border;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: @green;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25);
    }
    50% {
      box-shadow: 0 0 0 5px rgba(22, 163, 74, 0.08);
    }
  }

  .status-sep {
    color: @border;
    font-size: 14px;
  }

  // ── Hub 拓扑 ─────────────────────────────────────
  .hub-card {
    border-radius: @card-radius !important;
    :deep(.ant-card-body) {
      padding: 20px 24px;
    }
  }

  .hub-layout {
    display: flex;
    align-items: center;
    gap: 0;
    min-height: 240px;
  }

  .hub-side {
    flex: 1;
    min-width: 0;
  }

  .hub-side-header {
    font-size: 13px;
    font-weight: 600;
    color: @text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .hub-badge {
    background: @blue;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
  }

  .hub-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hub-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid @border;
    background: #fafafa;
    transition: border-color 0.2s;

    &--active {
      border-color: #bfdbfe;
      background: @blue-light;
    }

    &--agent {
      background: #f9fafb;
    }
  }

  .hub-item-icon {
    font-size: 18px;
    line-height: 1;
    flex-shrink: 0;
  }

  .hub-item-info {
    flex: 1;
    min-width: 0;
  }

  .hub-item-name {
    font-size: 13px;
    font-weight: 600;
    color: @text-primary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hub-item-meta {
    font-size: 11px;
    color: @text-secondary;
    margin-top: 1px;
  }

  .hub-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &--green {
      background: @green;
    }
    &--gray {
      background: #cbd5e1;
    }
  }

  .hub-item-time {
    font-size: 11px;
    color: @text-secondary;
    white-space: nowrap;
  }

  // ── 连接器 ───────────────────────────────────────
  .hub-connector {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 0 8px;
  }

  .hub-line {
    width: 40px;
    height: 2px;
    background: repeating-linear-gradient(
      90deg,
      @blue 0px,
      @blue 6px,
      transparent 6px,
      transparent 12px
    );
  }

  .hub-arrow-head {
    color: @blue;
    font-size: 12px;
    line-height: 1;
  }

  // ── Hub 中心 ─────────────────────────────────────
  .hub-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    padding: 0 8px;
  }

  .hub-ring {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;

    &--outer {
      width: 120px;
      height: 120px;
      border: 2px dashed #bfdbfe;
      background: transparent;
    }

    &--middle {
      width: 92px;
      height: 92px;
      border: 2px solid @blue;
      background: @blue-light;
    }
  }

  .hub-core {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: #1e3a5f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .hub-core-icon {
    font-size: 20px;
    line-height: 1;
  }

  .hub-core-label {
    font-size: 10px;
    font-weight: 700;
    color: #93c5fd;
    letter-spacing: 0.5px;
  }

  .hub-shards {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
  }

  .hub-shards-num {
    font-size: 22px;
    font-weight: 800;
    color: @blue;
  }

  .hub-shards-label {
    font-size: 10px;
    font-weight: 600;
    color: @text-secondary;
    letter-spacing: 1px;
  }

  .hub-center-title {
    font-size: 12px;
    font-weight: 600;
    color: @text-secondary;
    white-space: nowrap;
  }

  // ── 大指标行 ─────────────────────────────────────
  .metrics-row {
    display: flex;
    align-items: center;
    background: #fff;
    border-radius: @card-radius;
    border: 1px solid @border;
    padding: 20px 32px;
    gap: 0;
  }

  .metric-item {
    flex: 1;
    text-align: center;
    padding: 4px 0;

    &--loading .metric-value {
      opacity: 0.4;
    }
  }

  .metric-value {
    font-size: 32px;
    font-weight: 800;
    color: @text-primary;
    line-height: 1.1;
    letter-spacing: -1px;

    &--green {
      color: @green;
    }
    &--blue {
      color: @blue;
    }
  }

  .metric-label {
    font-size: 13px;
    color: @text-secondary;
    margin-top: 4px;
  }

  .metric-divider {
    width: 1px;
    height: 48px;
    background: @border;
    flex-shrink: 0;
  }

  // ── 趋势图 ───────────────────────────────────────
  .trend-chart {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 160px;
    padding-bottom: 24px;
    position: relative;
  }

  .trend-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
    justify-content: flex-end;
  }

  .trend-bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .trend-bar {
    width: 100%;
    background: @blue;
    border-radius: 3px 3px 0 0;
    min-height: 3px;
    transition: height 0.3s ease;
    position: relative;

    &:hover .trend-tip {
      opacity: 1;
    }
  }

  .trend-tip {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    background: @text-primary;
    color: #fff;
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
  }

  .trend-label {
    font-size: 10px;
    color: @text-secondary;
    width: 100%;
    text-align: center;
    line-height: 1;
  }

  // ── Top 5 工具 ───────────────────────────────────
  .top-tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .top-tool-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tool-rank {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
    color: #fff;

    &--1 {
      background: #ef4444;
    }
    &--2 {
      background: @amber;
    }
    &--3 {
      background: @blue;
    }
    &--4 {
      background: #8b5cf6;
    }
    &--5 {
      background: #64748b;
    }
  }

  .tool-info {
    flex: 1;
    min-width: 0;
  }

  .tool-name {
    font-size: 13px;
    font-weight: 600;
    color: @text-primary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tool-server {
    font-size: 11px;
    color: @text-secondary;
  }

  .tool-count {
    font-size: 14px;
    font-weight: 700;
    color: @blue;
    flex-shrink: 0;
  }

  // ── 错误分布 Donut ────────────────────────────────
  .error-dist {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .donut-wrap {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .donut {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: conic-gradient(@blue 0deg 288deg, @amber 288deg 342deg, @red 342deg 360deg);
  }

  .donut-hole {
    position: absolute;
    inset: 26%;
    background: #fff;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .donut-center-num {
    font-size: 16px;
    font-weight: 800;
    color: @text-primary;
    line-height: 1;
  }

  .donut-center-label {
    font-size: 10px;
    color: @text-secondary;
  }

  .error-legend {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    flex: 1;
    color: @text-secondary;
  }

  .legend-pct {
    font-weight: 600;
    color: @text-primary;
  }
</style>
