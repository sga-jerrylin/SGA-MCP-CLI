# Phase 2: AI Engine & Generator — 前端详细计划

> **For Gemini/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 实现 MCP 生成器核心功能，基于 `@mcp-claw/shared` 类型定义，包括文档导入、实时生成进度展示 (SSE) 和 AI 引擎配置。

---

### Task 2.1: 建立 Generator 状态管理

**Files:**
- Create: `packages/frontend/src/store/generator.ts`

**代码实现:**
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Project, SseLogEvent } from '@mcp-claw/shared';

export const useGeneratorStore = defineStore('generator', {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    logs: [] as SseLogEvent[],
    isGenerating: false,
    progress: 0
  }),
  actions: {
    addLog(log: SseLogEvent) {
      this.logs.push(log);
      if (this.logs.length > 1000) this.logs.shift();
    },
    updateProgress(p: number) {
      this.progress = p;
    },
    setProjects(projects: Project[]) {
      this.projects = projects;
    }
  }
});
```

---

### Task 2.2: 实现 SSE 实时通讯 Hook (useSse)

**Files:**
- Create: `packages/frontend/src/hooks/useSse.ts`

**代码实现:**
```typescript
import { ref, onUnmounted } from 'vue';
import type { SseEvent } from '@mcp-claw/shared';

export function useSse(url: string, onMessage: (data: SseEvent) => void) {
  const status = ref<'connecting' | 'open' | 'closed'>('closed');
  let eventSource: EventSource | null = null;

  const connect = () => {
    eventSource = new EventSource(url);
    status.value = 'connecting';

    eventSource.onopen = () => { status.value = 'open'; };
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as SseEvent;
      onMessage(data);
    };
    eventSource.onerror = () => {
      status.value = 'closed';
      eventSource?.close();
    };
  };

  const disconnect = () => {
    eventSource?.close();
    status.value = 'closed';
  };

  onUnmounted(disconnect);

  return { status, connect, disconnect };
}
```

---

### Task 2.3: MCP 生成器主页面布局 (GeneratorView)

**Files:**
- Create: `packages/frontend/src/views/Generator/GeneratorView.vue`

**代码实现:**
```vue
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
```

---

### Task 2.4: 项目列表组件

**Files:**
- Create: `packages/frontend/src/views/Generator/components/ProjectList.vue`

**代码实现:**
```vue
<template>
  <a-card title="MCP 项目" :bordered="false">
    <template #extra>
      <a-button type="primary" size="small" @click="showImport = true">新建</a-button>
    </template>
    <a-list :data-source="generatorStore.projects" item-layout="horizontal">
      <template #renderItem="{ item }">
        <a-list-item 
          :class="{ active: generatorStore.currentProject?.id === item.id }"
          @click="generatorStore.currentProject = item"
          class="clickable"
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
import type { ApiResponse, PaginatedList, Project } from '@mcp-claw/shared';

const generatorStore = useGeneratorStore();
const showImport = ref(false);

onMounted(async () => {
  const res = await http.get<ApiResponse<PaginatedList<Project>>>('/generator/projects');
  if (res.code === 0) {
    generatorStore.setProjects(res.data.items);
  }
});
</script>
```

---

### Task 2.5: 文档导入弹窗

**Files:**
- Create: `packages/frontend/src/views/Generator/components/ImportModal.vue`

**代码实现:**
```vue
<template>
  <a-modal title="导入接口文档" :visible="visible" @cancel="$emit('update:visible', false)" @ok="handleImport">
    <a-form layout="vertical">
      <a-form-item label="项目名称">
        <a-input v-model:value="form.name" placeholder="例如: 企微消息工具" />
      </a-form-item>
      <a-form-item label="上传文档">
        <a-upload-dragger name="file" :multiple="false" :before-upload="beforeUpload">
          <p class="ant-upload-drag-icon"><inbox-outlined /></p>
          <p>点击或拖拽 Markdown/OpenAPI 文件到此区域</p>
        </a-upload-dragger>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import http from '@/utils/http';
import type { ApiResponse, Project } from '@mcp-claw/shared';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits(['update:visible']);
const form = reactive({ name: '', file: null as File | null });

const beforeUpload = (file: File) => {
  form.file = file;
  return false;
};

const handleImport = async () => {
  if (!form.file) return;
  const formData = new FormData();
  formData.append('name', form.name);
  formData.append('document', form.file);

  const res = await http.post<ApiResponse<Project>>('/generator/projects', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  if (res.code === 0) {
    emit('update:visible', false);
    // Refresh list logic needed
  }
};
</script>
```

---

### Task 2.6: 日志终端组件 (LogTerminal)

**Files:**
- Create: `packages/frontend/src/components/Generator/LogTerminal.vue`

**代码实现:**
```vue
<template>
  <div class="terminal" ref="terminalRef">
    <div v-for="(log, index) in logs" :key="index" :class="['log-line', log.level]">
      <span class="timestamp">[{{ log.timestamp }}]</span>
      <span class="message">{{ log.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { SseLogEvent } from '@mcp-claw/shared';

const props = defineProps<{ logs: SseLogEvent[] }>();
const terminalRef = ref<HTMLElement>();

watch(() => props.logs.length, () => {
  nextTick(() => {
    if (terminalRef.value) {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
    }
  });
});
</script>

<style scoped>
.terminal { height: 300px; background: #1e1e1e; color: #d4d4d4; padding: 12px; overflow-y: auto; font-family: monospace; }
.log-line.info { color: #569cd6; }
.log-line.error { color: #f44747; }
.log-line.success { color: #6a9955; }
</style>
```

---

### Task 2.7: 项目详情与生成控制 (ProjectDetail)

**Files:**
- Create: `packages/frontend/src/views/Generator/components/ProjectDetail.vue`

**代码实现:**
```vue
<template>
  <a-card :title="project.name">
    <template #extra>
      <a-button type="primary" :loading="isGenerating" @click="startGeneration">🚀 开始生成</a-button>
    </template>
    
    <a-steps :current="currentStep" size="small" style="margin-bottom: 24px">
      <a-step title="文档解析" />
      <a-step title="代码生成" />
      <a-step title="自动修复" />
      <a-step title="测试运行" />
    </a-steps>

    <a-progress :percent="progress" status="active" />
    
    <a-tabs default-active-key="logs" style="margin-top: 24px">
      <a-tab-pane key="logs" tab="实时日志">
        <log-terminal :logs="generatorStore.logs" />
      </a-tab-pane>
      <a-tab-pane key="tools" tab="生成的工具">
        <p>Tool list placeholder (Artifacts)</p>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGeneratorStore } from '@/store/generator';
import { useSse } from '@/hooks/useSse';
import LogTerminal from '@/components/Generator/LogTerminal.vue';
import http from '@/utils/http';
import type { ApiResponse, GenerateRun, StartGenerateRequest } from '@mcp-claw/shared';

const generatorStore = useGeneratorStore();
const project = computed(() => generatorStore.currentProject!);
const isGenerating = computed(() => generatorStore.isGenerating);
const progress = computed(() => generatorStore.progress);

// 使用 SseEvent 类型
const { connect } = useSse(`/api/generator/projects/${project.value.id}/events`, (data) => {
  if (data.type === 'log') generatorStore.addLog(data);
  if (data.type === 'progress') generatorStore.updateProgress(data.percent);
});

const startGeneration = async () => {
  const payload: StartGenerateRequest = {
    parserModel: 'claude-3-haiku',
    coderModel: 'claude-3-5-sonnet'
  };
  
  const res = await http.post<ApiResponse<GenerateRun>>(`/generator/projects/${project.value.id}/start`, payload);
  if (res.code === 0) {
    generatorStore.isGenerating = true;
    connect();
  }
};
</script>
```

---

### Task 2.8: AI 引擎配置页面

**Files:**
- Create: `packages/frontend/src/views/Settings/AiEngineSettings.vue`

**代码实现:**
```vue
<template>
  <a-card title="AI 引擎设置">
    <a-form layout="vertical">
      <a-form-item label="文档解析模型">
        <a-select v-model:value="settings.parserModel">
          <a-select-option value="claude-3-haiku">Claude 3 Haiku</a-select-option>
          <a-select-option value="gpt-4o-mini">GPT-4o Mini</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="代码生成模型">
        <a-select v-model:value="settings.coderModel">
          <a-select-option value="claude-3-5-sonnet">Claude 3.5 Sonnet</a-select-option>
          <a-select-option value="gpt-4o">GPT-4o</a-select-option>
        </a-select>
      </a-form-item>
      <a-button type="primary" @click="saveSettings">保存配置</a-button>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
const settings = reactive({ parserModel: 'claude-3-haiku', coderModel: 'claude-3-5-sonnet' });
const saveSettings = () => { /* API Call */ };
</script>
```

---

### Task 2.9: 集成测试验证 (SSE)

**Step 1: 模拟 SSE 响应**
确保后端 `/api/generator/projects/:id/events` 能每秒推送一个 JSON 字符串。

**Step 2: 验证 UI**
点击 "开始生成"，观察日志终端是否自动滚动，进度条是否更新。

---

### Task 2.10: Git 提交

```bash
git add packages/frontend/src
git commit -m "feat: phase 2 updated with shared types"
```

CCB_DONE: 20260217-013824-681-18268-5
