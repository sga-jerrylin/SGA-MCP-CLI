<template>
  <div class="tenant-management">
    <a-card title="租户管理" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="showCreateModal = true">
          <template #icon><PlusOutlined /></template>新增租户
        </a-button>
      </template>

      <a-table
        :columns="columns"
        :data-source="tenants"
        :loading="loading"
        row-key="id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'red'">
              {{ record.status === 'active' ? '启用' : '禁用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="manageKeys(record)">API Keys</a-button>
              <a-popconfirm
                :title="`确定要${record.status === 'active' ? '禁用' : '启用'}该租户吗？`"
                @confirm="toggleStatus(record)"
              >
                <a-button type="link" size="small" :danger="record.status === 'active'">
                  {{ record.status === 'active' ? '禁用' : '启用' }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建租户弹窗 -->
    <a-modal
      v-model:open="showCreateModal"
      title="新增租户"
      @ok="handleCreate"
      :confirm-loading="creating"
    >
      <a-form layout="vertical" :model="createForm">
        <a-form-item label="租户名称" required>
          <a-input v-model:value="createForm.name" placeholder="请输入公司或组织名称" />
        </a-form-item>
        <a-form-item label="联系人" required>
          <a-input v-model:value="createForm.contact" placeholder="请输入联系人邮箱" />
        </a-form-item>
        <a-form-item label="域名标识">
          <a-input v-model:value="createForm.domain" placeholder="可选，如 acme.com" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { PlusOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import http from '@/utils/http';
import type { ApiResponse, Tenant, CreateTenantRequest } from '@sga/shared';

const router = useRouter();
const tenants = ref<Tenant[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const creating = ref(false);

const createForm = reactive<CreateTenantRequest>({
  name: '',
  contact: '',
  domain: ''
});

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '联系人', dataIndex: 'contact', key: 'contact' },
  { title: '状态', key: 'status' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action' }
];

const fetchTenants = async () => {
  loading.value = true;
  try {
    const res = (await http.get<ApiResponse<Tenant[]>>(
      '/admin/tenants'
    )) as unknown as ApiResponse<Tenant[]>;
    if (res.code === 0) {
      tenants.value = res.data;
    }
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  if (!createForm.name || !createForm.contact) {
    message.warning('请填写必填项');
    return;
  }
  creating.value = true;
  try {
    const res = (await http.post<ApiResponse<Tenant>>(
      '/admin/tenants',
      createForm
    )) as unknown as ApiResponse<Tenant>;
    if (res.code === 0) {
      message.success('创建成功');
      showCreateModal.value = false;
      createForm.name = '';
      createForm.contact = '';
      createForm.domain = '';
      fetchTenants();
    }
  } finally {
    creating.value = false;
  }
};

const toggleStatus = async (tenant: Tenant) => {
  // 注意：Contract中暂时没有 PATCH /admin/tenants/:id 状态变更接口，这里仅做Mock演示或预留
  message.info('状态切换功能暂未在 Contract 定义，仅前端展示');
  // 实际开发应调用类似 await http.patch(`/admin/tenants/${tenant.id}`, { status: ... })
};

const manageKeys = (tenant: Tenant) => {
  router.push({ name: 'KeyManagement', params: { tenantId: tenant.id } });
};

onMounted(fetchTenants);
</script>
