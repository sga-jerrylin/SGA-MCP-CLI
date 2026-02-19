<template>
  <a-modal
    title="导入接口文档"
    :open="visible"
    @cancel="$emit('update:visible', false)"
    @ok="handleImport"
  >
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
  import type { ApiResponse, Project } from '@sga/shared';

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

    const res = (await http.post<ApiResponse<Project>>('/generator/projects', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })) as unknown as ApiResponse<Project>;

    if (res.code === 0) {
      emit('update:visible', false);
      // Refresh list logic needed
    }
  };
</script>
