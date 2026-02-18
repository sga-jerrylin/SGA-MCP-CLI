<template>
  <div class="ai-engine-settings">
    <a-card title="AI 引擎设置" :bordered="false">
      <template #extra>
        <a-space>
          <a-button @click="testConnectivity" :loading="testing">测试连通性</a-button>
          <a-button type="primary" @click="saveSettings">保存配置</a-button>
        </a-space>
      </template>

      <a-form layout="vertical" :model="settings">
        <a-row :gutter="24">
          <a-col :span="8">
            <a-form-item label="文档解析模型 (LLM_PARSER_MODEL)">
              <a-select v-model:value="settings.parserModel" placeholder="请选择模型">
                <a-select-option v-for="m in models" :key="m.id" :value="m.id">
                  {{ m.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="代码生成模型 (LLM_CODER_MODEL)">
              <a-select v-model:value="settings.coderModel" placeholder="请选择模型">
                <a-select-option v-for="m in models" :key="m.id" :value="m.id">
                  {{ m.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Agent 决策模型 (LLM_AGENT_MODEL)">
              <a-select v-model:value="settings.agentModel" placeholder="请选择模型">
                <a-select-option v-for="m in models" :key="m.id" :value="m.id">
                  {{ m.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-alert
          message="配置说明"
          description="当前的设置仅保存在本地浏览器中用于前端展示。真实的生产环境配置需修改后端 .env 文件。保存后请重启后端服务以使新模型生效。"
          type="info"
          show-icon
          style="margin-top: 24px"
        />
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
  import { reactive, onMounted, ref } from 'vue';
  import { message } from 'ant-design-vue';
  import http from '@/utils/http';

  interface AiSettings {
    parserModel: string;
    coderModel: string;
    agentModel: string;
  }

  const SETTINGS_KEY = 'mcp_ai_settings';

  const models = [
    { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' },
    { id: 'openai/gpt-5.2-codex', name: 'GPT-5.2 Codex' },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { id: 'z-ai/glm-5', name: 'GLM-5' },
    { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5' },
    { id: 'minimax/minimax-m2.5', name: 'Minimax M2.5' }
  ];

  const settings = reactive<AiSettings>({
    parserModel: 'anthropic/claude-haiku-4.5',
    coderModel: 'anthropic/claude-sonnet-4.5',
    agentModel: 'anthropic/claude-sonnet-4.5'
  });

  const testing = ref(false);

  const loadSettings = () => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.assign(settings, parsed);
      } catch (e) {
        console.error('Failed to parse AI settings', e);
      }
    }
  };

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    message.success('保存成功（重启后端生效）');
  };

  const testConnectivity = async () => {
    testing.value = true;
    try {
      // http.get handles prefix /api automatically
      await http.get('/health');
      message.success('连通性测试成功 (200 OK)');
    } catch (error) {
      // Error message is usually handled by http interceptor, 
      // but we can add specific context here if needed.
      console.error('Connectivity test failed', error);
    } finally {
      testing.value = false;
    }
  };

  onMounted(() => {
    loadSettings();
  });
</script>

<style scoped lang="less">
  .ai-engine-settings {
    padding: 0;
  }
</style>
