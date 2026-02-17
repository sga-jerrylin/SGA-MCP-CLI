<template>
  <div class="deploy-view">
    <a-card title="部署发布集群">
      <a-steps :current="currentStep" style="margin-bottom: 24px">
        <a-step title="选择 Server" />
        <a-step title="预览配置" />
        <a-step title="执行部署" />
      </a-steps>

      <div class="step-content">
        <!-- Step 0: Selection -->
        <div v-if="currentStep === 0" class="selection">
          <a-transfer
            v-model:target-keys="selectedKeys"
            :data-source="transferDataSource"
            :titles="['可用 Server', '待部署 Server']"
            :render="(item: any) => item.title"
            style="width: 100%"
            list-style="flex: 1; height: 400px"
          />
        </div>

        <!-- Step 1: Preview -->
        <div v-if="currentStep === 1" class="preview">
          <div class="editor-header">
            <span>自动生成的 docker-compose.yml</span>
            <a-button size="small" @click="copyYaml">复制</a-button>
          </div>
          <div ref="editorContainer" class="editor-container"></div>
        </div>

        <!-- Step 2: Execution -->
        <div v-if="currentStep === 2" class="execution">
          <div class="status-info">
            <a-spin v-if="deploying" size="large" />
            <check-circle-outlined v-else style="color: #52c41a; font-size: 48px" />
            <div class="msg">{{ deployMsg }}</div>
          </div>
          <div ref="logRef" class="deploy-logs">
            <div v-for="(log, i) in deployLogs" :key="i" class="log-line">> {{ log }}</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <a-button v-if="currentStep > 0" @click="prev">上一步</a-button>
        <a-button v-if="currentStep < 2" type="primary" :disabled="selectedKeys.length === 0" @click="next">下一步</a-button>
        <a-button v-if="currentStep === 2" type="primary" :disabled="deploying" @click="$router.push('/runtime/servers')">返回列表</a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted } from 'vue';
import { CheckCircleOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import * as monaco from 'monaco-editor';
import http from '@/utils/http';
import type { ApiResponse, McpServer, DeployPreview, DeployTask } from '@mcp-claw/shared';

const currentStep = ref(0);
const servers = ref<McpServer[]>([]);
const selectedKeys = ref<string[]>([]);
const yamlContent = ref('');
const deploying = ref(false);
const deployMsg = ref('部署任务准备中...');
const deployLogs = ref<string[]>([]);

const editorContainer = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

const transferDataSource = computed(() => 
  servers.value.map(s => ({ key: s.id, title: s.name }))
);

const fetchData = async () => {
  const res = await http.get<ApiResponse<McpServer[]>>('/runtime/servers') as unknown as ApiResponse<McpServer[]>;
  if (res.code === 0) servers.value = res.data;
};

const next = async () => {
  if (currentStep.value === 0) {
    // Generate Preview
    const res = await http.post<ApiResponse<DeployPreview>>('/deploy/preview', { serverIds: selectedKeys.value }) as unknown as ApiResponse<DeployPreview>;
    if (res.code === 0) {
      yamlContent.value = res.data.composeYaml;
      currentStep.value = 1;
      nextTick(() => initEditor());
    }
  } else if (currentStep.value === 1) {
    // Execute Deploy
    const res = await http.post<ApiResponse<DeployTask>>('/deploy/execute', { serverIds: selectedKeys.value }) as unknown as ApiResponse<DeployTask>;
    if (res.code === 0) {
      currentStep.value = 2;
      startDeploySimulation();
    }
  }
};

const prev = () => {
  currentStep.value--;
};

const initEditor = () => {
  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: yamlContent.value,
      language: 'yaml',
      theme: 'vs-dark',
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false }
    });
  }
};

const copyYaml = () => {
  navigator.clipboard.writeText(yamlContent.value);
  message.success('已复制到剪贴板');
};

const startDeploySimulation = () => {
  deploying.value = true;
  deployLogs.value = ['[Docker] Pulling images...', '[Docker] Starting containers...'];
  setTimeout(() => {
    deployLogs.value.push('[Docker] mcp-server-1 started on port 8081');
    deployLogs.value.push('[Health] Verifying connections...');
    setTimeout(() => {
      deployLogs.value.push('[Health] All 100% OK');
      deploying.value = false;
      deployMsg.value = '部署完成！所有 Server 已就绪。';
    }, 1500);
  }, 1000);
};

onMounted(fetchData);
onUnmounted(() => editor?.dispose());
</script>

<style scoped>
.deploy-view { max-width: 1000px; margin: 0 auto; }
.step-content { min-height: 450px; margin-bottom: 24px; padding: 20px; border: 1px dashed #eee; border-radius: 8px; }
.editor-container { height: 400px; }
.editor-header { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #252526; color: #ccc; font-size: 12px; }
.status-info { text-align: center; margin-top: 40px; margin-bottom: 40px; }
.status-info .msg { margin-top: 16px; font-size: 18px; font-weight: 500; }
.deploy-logs { background: #1e1e1e; color: #b5cea8; padding: 12px; font-family: monospace; border-radius: 4px; max-height: 200px; overflow-y: auto; }
.actions { display: flex; justify-content: flex-end; gap: 12px; }
</style>
