# Phase 5: Monitoring & Governance — 前端详细计划

> **For Gemini/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 实现运行监控大盘、审计日志以及全局系统配置。

---

### Task 5.1: 运行监控大盘 (ECharts 实现)

**Files:**
- Create: `packages/frontend/src/views/Monitor/MonitorView.vue`

**代码实现 (部分):**
```vue
<template>
  <div class="monitor-container">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-card title="实时 QPS趋势">
          <div ref="qpsChart" style="height: 300px"></div>
        </a-card>
      </a-col>
      <a-col :span="12">
        <a-card title="内存占用">
          <div ref="memChart" style="height: 300px"></div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as echarts from 'echarts';

const qpsChart = ref<HTMLElement>();
onMounted(() => {
  const chart = echarts.init(qpsChart.value!);
  chart.setOption({
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
    yAxis: { type: 'value' },
    series: [{ data: [150, 230, 224], type: 'line' }]
  });
});
</script>
```

---

### Task 5.2: 审计日志列表

**Files:**
- Create: `packages/frontend/src/views/Monitor/AuditLogs.vue`

**代码实现:**
```vue
<template>
  <a-card title="审计日志">
    <a-table :columns="columns" :data-source="logs">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'success' ? 'success' : 'error'">{{ record.status }}</a-tag>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const columns = [
  { title: '时间', dataIndex: 'timestamp' },
  { title: '用户', dataIndex: 'user' },
  { title: '动作', dataIndex: 'action' },
  { title: '状态', key: 'status' }
];
const logs = ref([]);
</script>
```

---

### Task 5.3: 系统设置页面

**Files:**
- Create: `packages/frontend/src/views/Settings/SystemSettings.vue`

**代码实现:**
```vue
<template>
  <a-tabs default-active-key="basic">
    <a-tab-pane key="basic" tab="基础设置">
      <a-form layout="vertical">
        <a-form-item label="系统名称"><a-input value="MCP Hub" /></a-form-item>
        <a-form-item label="默认语言"><a-select value="zh-CN"><a-select-option value="zh-CN">简体中文</a-select-option></a-select></a-form-item>
      </a-form>
    </a-tab-pane>
    <a-tab-pane key="security" tab="安全策略">
      <a-form-item label="Session 超时 (分钟)"><a-input-number :value="30" /></a-form-item>
    </a-tab-pane>
  </a-tabs>
</template>
```

---

### Task 5.4: Git 提交

```bash
git add packages/frontend
git commit -m "feat: 实现监控大盘和审计日志系统"
```

CCB_DONE: 20260216-005557-676-4224-8
