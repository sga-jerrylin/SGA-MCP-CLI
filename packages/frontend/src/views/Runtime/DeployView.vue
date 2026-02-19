<template>
  <div class="deploy-view">
    <a-card title="Deployment Cluster">
      <a-steps :current="currentStep" style="margin-bottom: 24px">
        <a-step title="Select Servers" />
        <a-step title="Preview Config" />
        <a-step title="Execute" />
      </a-steps>

      <div class="step-content">
        <div v-if="currentStep === 0" class="selection">
          <a-transfer
            v-model:target-keys="selectedKeys"
            :data-source="transferDataSource"
            :titles="['Available Servers', 'Selected Servers']"
            :render="(item: TransferItem) => item.title"
            style="width: 100%"
            list-style="flex: 1; height: 400px"
          />
        </div>

        <div v-if="currentStep === 1" class="preview">
          <div class="editor-header">
            <span>Generated docker-compose.yml</span>
            <a-button size="small" @click="copyYaml">Copy</a-button>
          </div>
          <div ref="editorContainer" class="editor-container"></div>
        </div>

        <div v-if="currentStep === 2" class="execution">
          <div class="status-info">
            <a-spin v-if="deploying" size="large" />
            <CheckCircleOutlined v-else style="color: #52c41a; font-size: 48px" />
            <div class="msg">{{ deployMsg }}</div>
          </div>
          <div class="deploy-logs">
            <div v-for="(log, i) in deployLogs" :key="i" class="log-line">> {{ log }}</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <a-button v-if="currentStep > 0" @click="prev">Previous</a-button>
        <a-button
          v-if="currentStep < 2"
          type="primary"
          :disabled="selectedKeys.length === 0"
          @click="next"
        >
          Next
        </a-button>
        <a-button
          v-if="currentStep === 2"
          type="primary"
          :disabled="deploying"
          @click="$router.push('/runtime/servers')"
        >
          Back to Servers
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
  import type { editor as MonacoEditor } from 'monaco-editor';
  import { CheckCircleOutlined } from '@ant-design/icons-vue';
  import { message } from 'ant-design-vue';
  import http from '@/utils/http';
  import type { ApiResponse, DeployPreview, DeployTask, McpServer } from '@sga/shared';

  interface TransferItem {
    key: string;
    title: string;
  }

  const currentStep = ref(0);
  const servers = ref<McpServer[]>([]);
  const selectedKeys = ref<string[]>([]);
  const yamlContent = ref('');
  const deploying = ref(false);
  const deployMsg = ref('Deployment task is preparing...');
  const deployLogs = ref<string[]>([]);

  const editorContainer = ref<HTMLElement | null>(null);
  let monacoModule: typeof import('monaco-editor') | null = null;
  let editor: MonacoEditor.IStandaloneCodeEditor | null = null;

  const transferDataSource = computed<TransferItem[]>(() =>
    servers.value.map((server) => ({ key: server.id, title: server.name }))
  );

  const fetchData = async () => {
    const res = (await http.get<ApiResponse<McpServer[]>>(
      '/runtime/servers'
    )) as unknown as ApiResponse<McpServer[]>;
    if (res.code === 0) {
      servers.value = res.data;
    }
  };

  const next = async () => {
    if (currentStep.value === 0) {
      const res = (await http.post<ApiResponse<DeployPreview>>('/deploy/preview', {
        serverIds: selectedKeys.value
      })) as unknown as ApiResponse<DeployPreview>;

      if (res.code === 0) {
        yamlContent.value = res.data.composeYaml;
        currentStep.value = 1;
        await nextTick();
        await initEditor();
      }
      return;
    }

    if (currentStep.value === 1) {
      const res = (await http.post<ApiResponse<DeployTask>>('/deploy/execute', {
        serverIds: selectedKeys.value
      })) as unknown as ApiResponse<DeployTask>;

      if (res.code === 0) {
        currentStep.value = 2;
        startDeploySimulation();
      }
    }
  };

  const prev = () => {
    currentStep.value -= 1;
  };

  const initEditor = async () => {
    if (!editorContainer.value) {
      return;
    }

    if (!monacoModule) {
      monacoModule = await import('monaco-editor');
    }

    if (editor) {
      editor.dispose();
      editor = null;
    }

    editor = monacoModule.editor.create(editorContainer.value, {
      value: yamlContent.value,
      language: 'yaml',
      theme: 'vs-dark',
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false }
    });
  };

  const copyYaml = () => {
    void navigator.clipboard.writeText(yamlContent.value);
    message.success('Copied to clipboard');
  };

  const startDeploySimulation = () => {
    deploying.value = true;
    deployLogs.value = ['[Docker] Pulling images...', '[Docker] Starting containers...'];

    setTimeout(() => {
      deployLogs.value.push('[Docker] mcp-server-1 started on port 8081');
      deployLogs.value.push('[Health] Verifying connections...');

      setTimeout(() => {
        deployLogs.value.push('[Health] All checks passed');
        deploying.value = false;
        deployMsg.value = 'Deployment completed successfully.';
      }, 1500);
    }, 1000);
  };

  onMounted(() => {
    void fetchData();
  });

  onUnmounted(() => {
    editor?.dispose();
    editor = null;
  });
</script>

<style scoped>
  .deploy-view {
    max-width: 1000px;
    margin: 0 auto;
  }

  .step-content {
    min-height: 450px;
    margin-bottom: 24px;
    padding: 20px;
    border: 1px dashed #eee;
    border-radius: 8px;
  }

  .editor-container {
    height: 400px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: #252526;
    color: #ccc;
    font-size: 12px;
  }

  .status-info {
    text-align: center;
    margin-top: 40px;
    margin-bottom: 40px;
  }

  .status-info .msg {
    margin-top: 16px;
    font-size: 18px;
    font-weight: 500;
  }

  .deploy-logs {
    background: #1e1e1e;
    color: #b5cea8;
    padding: 12px;
    font-family: monospace;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
