# Phase 3: Config Repo & Cloud Admin — 前端详细计划

> **For Gemini/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 实现 MCP 配置仓库和云端管理后台，支持租户、API Key 管理及配置包上下架。

---

### Task 3.1: 仓库包列表展示

**Files:**
- Create: `packages/frontend/src/views/Repository/RepoView.vue`

**代码实现:**
```vue
<template>
  <div class="repo-container">
    <a-row :gutter="[16, 16]">
      <a-col :span="6" v-for="pkg in packages" :key="pkg.id">
        <a-card hoverable>
          <template #cover>
            <div class="pkg-cover">{{ pkg.category }}</div>
          </template>
          <a-card-meta :title="pkg.name" :description="pkg.description" />
          <template #actions>
            <a-button type="link" @click="handleInstall(pkg)">安装</a-button>
            <a-button type="link">详情</a-button>
          </template>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

const packages = ref([]);
onMounted(async () => {
  const res: any = await http.get('/repo/packages');
  packages.value = res.data;
});

const handleInstall = (pkg: any) => { /* Installation logic */ };
</script>

<style scoped>
.pkg-cover { height: 100px; background: #e6f7ff; display: flex; align-items: center; justify-content: center; font-weight: bold; }
</style>
```

---

### Task 3.2: 租户管理页面 (/admin/tenants)

**Files:**
- Create: `packages/frontend/src/views/Admin/TenantManagement.vue`

**代码实现:**
```vue
<template>
  <a-card title="租户管理">
    <template #extra>
      <a-button type="primary" @click="showAdd = true">新增租户</a-button>
    </template>
    <a-table :columns="columns" :data-source="tenants">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" @click="manageKeys(record)">API Keys</a-button>
            <a-button type="link" danger>禁用</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '联系人', dataIndex: 'contact', key: 'contact' },
  { title: '操作', key: 'action' }
];
const tenants = ref([]);
const showAdd = ref(false);
const manageKeys = (tenant: any) => { /* Navigation */ };
</script>
```

---

### Task 3.3: API Key 管理页面

**Files:**
- Create: `packages/frontend/src/views/Admin/KeyManagement.vue`

**代码实现:**
```vue
<template>
  <a-card title="API Key 管理">
    <a-alert message="API Key 仅在创建时显示一次，请妥善保存" type="warning" show-icon style="margin-bottom: 16px" />
    <a-button type="primary" style="margin-bottom: 16px" @click="generateKey">生成新 Key</a-button>
    <a-table :columns="columns" :data-source="keys" />
  </a-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const columns = [
  { title: '名称', dataIndex: 'name' },
  { title: '前缀', dataIndex: 'prefix' },
  { title: '过期时间', dataIndex: 'expiresAt' }
];
const keys = ref([]);
const generateKey = () => { /* API call and show result in modal */ };
</script>
```

---

### Task 3.4: 管理后台导航路由

**Files:**
- Modify: `packages/frontend/src/router/index.ts`

**代码实现:**
```typescript
const adminRoutes = {
  path: '/admin',
  component: MainLayout,
  children: [
    { path: 'tenants', component: () => import('@/views/Admin/TenantManagement.vue') },
    { path: 'keys', component: () => import('@/views/Admin/KeyManagement.vue') },
    { path: 'packages', component: () => import('@/views/Admin/PackageManagement.vue') }
  ]
};
```

---

### Task 3.5: Git 提交

```bash
git add packages/frontend
git commit -m "feat: 实现配置仓库和云端管理后台"
```

CCB_DONE: 20260216-005557-676-4224-8
