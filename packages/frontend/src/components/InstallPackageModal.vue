<template>
  <a-modal
    :open="open"
    title="安装 MCP Server"
    ok-text="确认安装"
    cancel-text="取消"
    :confirm-loading="submitting"
    @cancel="closeModal"
    @ok="handleInstall"
  >
    <template v-if="currentPackage">
      <div class="package-summary">
        <div class="name">{{ currentPackage.name }}</div>
        <div class="meta">v{{ currentPackage.version }}</div>
        <div class="description">{{ currentPackage.description || '暂无描述' }}</div>
      </div>

      <CredentialForm
        v-if="credentialFields.length > 0"
        v-model="credentialValues"
        :fields="credentialFields"
      />

      <a-alert v-else message="此 Server 无需鉴权配置，可直接安装" type="info" show-icon />
    </template>
  </a-modal>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { message } from 'ant-design-vue';
  import type {
    ApiResponse,
    CredentialField,
    Package,
    SaveCredentialsRequest,
    SaveCredentialsResponse
  } from '@sga/shared';
  import http from '@/utils/http';
  import CredentialForm from './CredentialForm.vue';

  const props = defineProps<{
    open: boolean;
    package: Package | null;
  }>();

  const emit = defineEmits<{
    (event: 'update:open', value: boolean): void;
    (event: 'installed', packageId: string): void;
  }>();

  const submitting = ref(false);
  const credentialValues = ref<Record<string, string>>({});

  const currentPackage = computed(() => props.package);
  const credentialFields = computed<CredentialField[]>(
    () => currentPackage.value?.credentials ?? []
  );

  watch(
    () => [props.open, currentPackage.value?.id],
    ([isOpen]) => {
      if (!isOpen) {
        return;
      }
      const nextValues: Record<string, string> = {};
      for (const field of credentialFields.value) {
        nextValues[field.key] = '';
      }
      credentialValues.value = nextValues;
    }
  );

  const closeModal = (): void => {
    emit('update:open', false);
  };

  const validateRequiredFields = (): string | null => {
    for (const field of credentialFields.value) {
      if (!field.required) {
        continue;
      }
      const value = credentialValues.value[field.key];
      if (!value || value.trim().length === 0) {
        return field.label;
      }
    }
    return null;
  };

  const handleInstall = async (): Promise<void> => {
    if (!currentPackage.value) {
      return;
    }

    const missingLabel = validateRequiredFields();
    if (missingLabel) {
      message.error(`请填写必填项: ${missingLabel}`);
      return;
    }

    submitting.value = true;

    try {
      const payload: SaveCredentialsRequest = {
        credentials: credentialValues.value
      };
      const response = (await http.post<ApiResponse<SaveCredentialsResponse>>(
        `/runtime/credentials/${currentPackage.value.id}`,
        payload
      )) as unknown as ApiResponse<SaveCredentialsResponse>;

      message.success('安装成功');
      emit('installed', response.data.packageId);
      closeModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '安装失败';
      message.error(errorMessage || '安装失败');
    } finally {
      submitting.value = false;
    }
  };
</script>

<style scoped>
  .package-summary {
    margin-bottom: 16px;
  }

  .name {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 4px;
  }

  .meta {
    color: #595959;
    margin-bottom: 8px;
  }

  .description {
    color: #8c8c8c;
    margin-bottom: 12px;
  }
</style>
