# Phase 1: Skeleton & Infrastructure — 前端详细计划

> **For Gemini/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 搭建 MCP Hub 的 Monorepo 骨架，初始化 Core、CLI 和 Frontend 包结构。

---

### Task 1.1: 初始化 Monorepo 结构

**Files:**
- Create: `package.json` (Root)
- Create: `pnpm-workspace.yaml`

**Step 1: 创建根目录 package.json**
```json
{
  "name": "mcp-claw-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "eslint": "^8.50.0"
  }
}
```

**Step 2: 配置 pnpm-workspace.yaml**
```yaml
packages:
  - 'packages/*'
```

---

### Task 1.2: 创建 @mcp-claw/core 骨架

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

**代码实现 (package.json):**
```json
{
  "name": "@mcp-claw/core",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "zod": "^3.22.4",
    "axios": "^1.6.2"
  }
}
```

---

### Task 1.3: 创建 @mcp-claw/cli 骨架

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`

**代码实现 (package.json):**
```json
{
  "name": "@mcp-claw/cli",
  "version": "0.1.0",
  "bin": {
    "mcp-claw": "dist/bin/mcp-claw.js"
  },
  "dependencies": {
    "@mcp-claw/core": "workspace:*",
    "commander": "^11.1.0"
  }
}
```

---

### Task 1.4: 初始化 Frontend (Vite)

**Files:**
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/vite.config.ts`

**代码实现 (package.json):**
```json
{
  "name": "@mcp-claw/frontend",
  "version": "0.1.0",
  "dependencies": {
    "vue": "^3.4.0",
    "ant-design-vue": "^4.1.0",
    "pinia": "^2.1.7",
    "vue-router": "^4.2.5"
  }
}
```

---

### Task 1.5: 建立全局 TypeScript 类型定义

**Files:**
- Create: `packages/frontend/src/types/index.ts`
- Create: `packages/frontend/src/types/user.ts`

**代码实现:**
```typescript
// packages/frontend/src/types/index.ts
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export type ThemeMode = 'light' | 'dark';

// packages/frontend/src/types/user.ts
export interface UserInfo {
  id: string;
  username: string;
  role: 'admin' | 'user';
  avatar?: string;
  tenantId?: string;
}
```

---

### Task 1.6: 封装 Axios 请求工具

**Files:**
- Create: `packages/frontend/src/utils/http.ts`

**代码实现:**
```typescript
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { message } from 'ant-design-vue';

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('mcp_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response;
    if (data.code !== 0) {
      message.error(data.message || '业务请求失败');
    }
    return data;
  },
  (error) => {
    const { response } = error;
    if (response?.status === 401) {
      message.warning('登录已过期');
    } else {
      message.error(error.message || '请求故障');
    }
    return Promise.reject(error);
  }
);

export default http;
```

---

### Task 1.7: 建立 Pinia 状态管理

**Files:**
- Create: `packages/frontend/src/store/app.ts`

**代码实现:**
```typescript
import { defineStore } from 'pinia';
import { ThemeMode } from '@/types';

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false,
    theme: 'light' as ThemeMode
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }
});
```

---

### Task 1.8: 响应式主布局 (MainLayout)

**Files:**
- Create: `packages/frontend/src/layouts/MainLayout.vue`

**代码实现:**
```vue
<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="appStore.sidebarCollapsed" collapsible>
      <div class="logo">MCP Hub</div>
      <a-menu v-model:selectedKeys="selectedKeys" theme="dark" mode="inline">
        <a-menu-item key="dashboard" @click="$router.push('/')">概览</a-menu-item>
        <a-menu-item key="generator" @click="$router.push('/generator')">生成器</a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 24px">
        <menu-unfold-outlined v-if="appStore.sidebarCollapsed" @click="appStore.toggleSidebar" />
        <menu-fold-outlined v-else @click="appStore.toggleSidebar" />
      </a-layout-header>
      <a-layout-content style="margin: 24px">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '@/store/app';

const appStore = useAppStore();
const selectedKeys = ref(['dashboard']);
</script>
```

---

### Task 1.9: 路由配置 (Vue Router)

**Files:**
- Create: `packages/frontend/src/router/index.ts`

**代码实现:**
```typescript
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', component: () => import('@/views/Dashboard.vue') },
      { path: 'generator', component: () => import('@/views/Generator.vue') }
    ]
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});
```

---

### Task 1.10: 验证与构建测试

**Step 1: 安装依赖**
Run: `pnpm install` in root

**Step 2: 验证 core 构建**
Run: `pnpm --filter @mcp-claw/core build`

**Step 3: 验证 cli 构建**
Run: `pnpm --filter @mcp-claw/cli build`

**Step 4: 验证 frontend 构建**
Run: `pnpm --filter @mcp-claw/frontend build`

---

### Task 1.11: Git 提交

```bash
git add .
git commit -m "feat: init monorepo structure with core, cli and frontend"
```

CCB_DONE: 20260217-012439-279-18268-3
