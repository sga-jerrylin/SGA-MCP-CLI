<template>
  <div class="key-management">
    <a-page-header
      title="API Key 管理"
      sub-title="管理租户的访问密钥"
      @back="$router.back()"
    >
      <template #extra>
        <a-button type="primary" @click="showCreateModal = true">生成新 Key</a-button>
      </template>
    </a-page-header>

    <a-card :bordered="false" style="margin-top: 16px">
      <a-table :columns="columns" :data-source="keys" :loading="loading" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="record.status === 'active' ? 'success' : 'default'"
              :text="record.status"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-popconfirm
              title="确定要撤销此 Key 吗？撤销后无法恢复。"
              @confirm="revokeKey(record)"
              :disabled="record.status !== 'active'"
            >
              <a-button type="link" danger :disabled="record.status !== 'active'">撤销</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建 Key 弹窗 -->
    <a-modal
      v-model:open="showCreateModal"
      title="生成新 API Key"
      @ok="handleCreate"
      :confirm-loading="creating"
    >
      <a-form layout="vertical">
        <a-form-item label="Key 名称" required>
          <a-input v-model:value="createName" placeholder="例如: 开发环境 Key" />
        </a-form-item>
        <a-form-item label="有效期">
          <a-select v-model:value="createExpiresIn">
            <a-select-option value="30d">30 天</a-select-option>
            <a-select-option value="90d">90 天</a-select-option>
            <a-select-option value="365d">1 年</a-select-option>
            <a-select-option value="never">永久</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Key 展示弹窗 (只显示一次) -->
    <a-modal
      v-model:open="showKeyResult"
      title="API Key 已生成"
      :footer="null"
      :mask-closable="false"
    >
      <a-alert
        message="请立即复制并保存此 Key，关闭后将不再显示。"
        type="warning"
        show-icon
        style="margin-bottom: 16px"
      />
      <div class="key-display">
        <a-input :value="newKeySecret" readonly />
        <a-button type="primary" @click="copyKey">复制</a-button>
      </div>
      <div style="text-align: center; margin-top: 24px">
        <a-button @click="showKeyResult = false">我已保存</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import http from '@/utils/http';
import type { ApiResponse, ApiKey, CreateApiKeyRequest, CreateApiKeyResponse } from '@sga/shared';

const route = useRoute();
const tenantId = route.params.tenantId as string;

const keys = ref<ApiKey[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const creating = ref(false);
const createName = ref('');
const createExpiresIn = ref('90d');

const showKeyResult = ref(false);
const newKeySecret = ref('');

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '前缀', dataIndex: 'prefix', key: 'prefix' },
  { title: '状态', key: 'status' },
  { title: '过期时间', dataIndex: 'expiresAt', key: 'expiresAt' },
  { title: '最后使用', dataIndex: 'lastUsedAt', key: 'lastUsedAt' },
  { title: '操作', key: 'action' }
];

const fetchKeys = async () => {
  loading.value = true;
  try {
    const res = (await http.get<ApiResponse<ApiKey[]>>(
      `/admin/tenants/${tenantId}/keys`
    )) as unknown as ApiResponse<ApiKey[]>;
    if (res.code === 0) {
      keys.value = res.data;
    }
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  if (!createName.value) {
    message.warning('请输入名称');
    return;
  }
  creating.value = true;
  try {
    const payload: CreateApiKeyRequest = {
      name: createName.value,
      expiresIn: createExpiresIn.value
    };
    const res = (await http.post<ApiResponse<CreateApiKeyResponse>>(
      `/admin/tenants/${tenantId}/keys`,
      payload
    )) as unknown as ApiResponse<CreateApiKeyResponse>;

    if (res.code === 0) {
      newKeySecret.value = res.data.key;
      showCreateModal.value = false;
      showKeyResult.value = true;
      createName.value = '';
      fetchKeys();
    }
  } finally {
    creating.value = false;
  }
};

const copyKey = () => {
  navigator.clipboard.writeText(newKeySecret.value);
  message.success('已复制到剪贴板');
};

const revokeKey = async (key: ApiKey) => {
  // Contract 中暂未定义 revoke 接口，Mock 或预留
  message.info('撤销功能暂未在 Contract 定义');
};

onMounted(() => {
  if (tenantId) {
    fetchKeys();
  } else {
    message.error('缺少 Tenant ID');
  }
});
</script>

<style scoped>
.key-display {
  display: flex;
  gap: 8px;
}
</style>
