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
  const saveSettings = () => {
    /* API Call */
  };
</script>
