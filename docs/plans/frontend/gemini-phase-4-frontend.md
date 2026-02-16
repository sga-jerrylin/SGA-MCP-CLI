# Phase 4: MCP Runtime & Deployment — 前端详细计划

> **For Gemini/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 实现 MCP Server 集群的部署与发布管理，包括多 Server 状态监控、docker-compose 预览以及全量工具库展示。

---

### Task 4.1: MCP Server 目录服务 UI

**Files:**
- Create: `packages/frontend/src/views/Runtime/ServerDirectory.vue`

**代码实现:**
```vue
<template>
  <div class="server-directory">
    <a-row :gutter="[16, 16]">
      <a-col v-for="server in servers" :key="server.id" :span="8">
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
              <a-progress :percent="server.tokenUsage" size="small" />
            </div>
          </div>
          <template #actions>
            <a-button type="link" size="small">配置</a-button>
            <a-button type="link" size="small">日志</a-button>
          </template>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

const servers = ref([]);
onMounted(async () => {
  const res: any = await http.get('/runtime/servers');
  servers.value = res.data;
});
</script>

<style scoped>
.server-card .stats { display: flex; justify-content: space-between; margin-top: 16px; }
.stat-item { flex: 1; }
.stat-item .label { font-size: 12px; color: #999; }
.stat-item .value { font-size: 18px; font-weight: bold; }
</style>
```

---

### Task 4.2: 部署发布页面 (DeployView)

**Files:**
- Create: `packages/frontend/src/views/Runtime/DeployView.vue`

**代码实现:**
```vue
<template>
  <div class="deploy-container">
    <a-card title="部署发布集群">
      <a-transfer
        v-model:target-keys="selectedServers"
        :data-source="allServers"
        :titles="['可用 Server', '已选 Server']"
        :render="item => item.title"
        style="margin-bottom: 24px"
      />
      
      <div class="preview-header">
        <span>预览 docker-compose.yml</span>
        <a-button size="small" @click="generateYaml">重新生成</a-button>
      </div>
      <div class="yaml-editor" ref="editorRef"></div>
      
      <div class="actions">
        <a-button type="primary" size="large" @click="handleDeploy">🚀 一键部署集群</a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as monaco from 'monaco-editor';

const editorRef = ref<HTMLElement>();
const selectedServers = ref<string[]>([]);
const allServers = ref([]);
let editor: any = null;

onMounted(() => {
  editor = monaco.editor.create(editorRef.value!, {
    value: 'version: "3.8"\nservices:\n  ...',
    language: 'yaml',
    theme: 'vs-dark',
    readOnly: true
  });
});

const generateYaml = async () => { /* API call */ };
const handleDeploy = async () => { /* Deployment logic */ };
</script>

<style scoped>
.yaml-editor { height: 400px; border: 1px solid #333; margin-top: 12px; }
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
.actions { margin-top: 24px; text-align: center; }
</style>
```

---

### Task 4.3: 系统概览拓扑图 (TopologyMap)

**Files:**
- Create: `packages/frontend/src/components/Runtime/TopologyMap.vue`

**代码实现:**
```vue
<template>
  <div ref="container" class="topology"></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import G6 from '@antv/g6';

const container = ref<HTMLElement>();

onMounted(() => {
  const graph = new G6.Graph({
    container: container.value!,
    width: 800,
    height: 500,
    layout: { type: 'radial', focusNode: 'hub', unitRadius: 100 },
    defaultNode: { size: 40, style: { fill: '#C6E5FF', stroke: '#5B8FF9' } }
  });
  
  const data = {
    nodes: [{ id: 'hub', label: 'Hub' }, { id: 's1', label: 'Server 1' }],
    edges: [{ source: 'hub', target: 's1' }]
  };
  graph.data(data);
  graph.render();
});
</script>
```

---

### Task 4.4: 工具库页面 (虚拟滚动实现)

**Files:**
- Create: `packages/frontend/src/views/Library/ToolLibrary.vue`

**代码实现:**
```vue
<template>
  <a-card title="全量工具库 (182 Tools)">
    <a-input-search placeholder="搜索工具名称或描述..." style="margin-bottom: 16px" />
    <div class="tool-list">
      <a-virtual-list :data="tools" :item-height="60" item-key="id">
        <template #renderItem="{ item }">
          <div class="tool-item">
            <div class="name">{{ item.name }}</div>
            <div class="desc">{{ item.description }}</div>
          </div>
        </template>
      </a-virtual-list>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const tools = ref(Array.from({ length: 182 }).map((_, i) => ({ id: i, name: `tool_${i}`, description: '...' })));
</script>

<style scoped>
.tool-item { height: 60px; padding: 8px; border-bottom: 1px solid #f0f0f0; }
.tool-item .name { font-weight: bold; }
.tool-item .desc { font-size: 12px; color: #999; }
</style>
```

---

### Task 4.5: Git 提交

```bash
git add packages/frontend
git commit -m "feat: 实现 MCP 运行环境管理和部署流程"
```

CCB_DONE: 20260216-005557-676-4224-8
