# Phase 6: Final Integration, Testing & Polish — 前端详细计划

> **For Gemini/Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** 完成系统性集成优化，建立全链路自动化测试体系，实现国际化与全局错误处理，确保生产级交付质量。

---

### Task 6.1: 路由守卫与加载进度条 (NProgress)

**Files:**
- Modify: `packages/frontend/src/router/index.ts`
- Create: `packages/frontend/src/permission.ts`

**Step 1: 安装依赖**
```bash
pnpm add nprogress
pnpm add -D @types/nprogress
```

**Step 2: 配置权限守卫 (`src/permission.ts`)**
```typescript
import router from './router';
import { useUserStore } from '@/store/user';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { message } from 'ant-design-vue';

NProgress.configure({ showSpinner: false });

const whiteList = ['/login', '/404'];

router.beforeEach(async (to, from, next) => {
  NProgress.start();
  
  const userStore = useUserStore();
  const hasToken = localStorage.getItem('mcp_token');

  if (hasToken) {
    if (to.path === '/login') {
      next({ path: '/' });
      NProgress.done();
    } else {
      if (userStore.roles.length === 0) {
        try {
          // 获取用户信息和权限
          await userStore.getUserInfo();
          next({ ...to, replace: true });
        } catch (error) {
          // Token 失效
          await userStore.logout();
          message.error('登录已过期，请重新登录');
          next(`/login?redirect=${to.path}`);
          NProgress.done();
        }
      } else {
        // 权限判断 (Admin 路由拦截)
        if (to.meta.roles && !to.meta.roles.includes(userStore.role)) {
          next({ path: '/403' });
        } else {
          next();
        }
      }
    }
  } else {
    if (whiteList.indexOf(to.path) !== -1) {
      next();
    } else {
      next(`/login?redirect=${to.path}`);
      NProgress.done();
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});
```

**Step 3: 在 `main.ts` 引入**
```typescript
import './permission';
```

---

### Task 6.2: 国际化基础 (i18n)

**Files:**
- Create: `packages/frontend/src/locales/zh-CN.ts`
- Create: `packages/frontend/src/locales/en-US.ts`
- Create: `packages/frontend/src/locales/index.ts`
- Create: `packages/frontend/src/components/LangSelect/index.vue`

**Step 1: 安装依赖**
```bash
pnpm add vue-i18n@9
```

**Step 2: 配置 i18n 实例 (`src/locales/index.ts`)**
```typescript
import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: localStorage.getItem('lang') || 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

export default i18n;
```

**Step 3: 语言包示例 (`src/locales/zh-CN.ts`)**
```typescript
export default {
  route: {
    dashboard: '概览',
    generator: 'MCP 生成器',
    repository: '配置仓库',
    admin: '系统管理'
  },
  navbar: {
    logOut: '退出登录',
    profile: '个人中心'
  },
  generator: {
    createProject: '新建项目',
    importDoc: '导入文档',
    startGenerate: '开始生成'
  }
};
```

**Step 4: 语言切换组件 (`src/components/LangSelect/index.vue`)**
```vue
<template>
  <a-dropdown trigger="click">
    <div class="lang-select">
      <global-outlined style="font-size: 20px" />
    </div>
    <template #overlay>
      <a-menu @click="handleSetLanguage">
        <a-menu-item key="zh-CN" :disabled="locale === 'zh-CN'">
          简体中文
        </a-menu-item>
        <a-menu-item key="en-US" :disabled="locale === 'en-US'">
          English
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { GlobalOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

const { locale } = useI18n();

const handleSetLanguage = ({ key }: { key: string }) => {
  locale.value = key;
  localStorage.setItem('lang', key);
  message.success('Switch Language Success');
};
</script>
```

---

### Task 6.3: 全局错误边界 (ErrorBoundary)

**Files:**
- Create: `packages/frontend/src/components/ErrorBoundary/index.vue`
- Modify: `packages/frontend/src/App.vue`

**代码实现:**
```vue
<!-- packages/frontend/src/components/ErrorBoundary/index.vue -->
<template>
  <div v-if="hasError" class="error-boundary">
    <a-result
      status="500"
      title="500"
      sub-title="抱歉，系统发生未知错误。"
    >
      <template #extra>
        <a-space>
          <a-button type="primary" @click="reloadPage">刷新页面</a-button>
          <a-button @click="goHome">返回首页</a-button>
        </a-space>
      </template>
      <div class="desc">
        <p style="margin-bottom: 16px">
          <strong>错误详情:</strong>
        </p>
        <pre>{{ errorInfo }}</pre>
      </div>
    </a-result>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { useRouter } from 'vue-router';

const hasError = ref(false);
const errorInfo = ref('');
const router = useRouter();

onErrorCaptured((err, instance, info) => {
  console.error('全局错误捕获:', err, info);
  hasError.value = true;
  errorInfo.value = err.toString();
  // 阻止错误继续向上传播
  return false;
});

const reloadPage = () => window.location.reload();
const goHome = () => {
  hasError.value = false;
  router.push('/');
};
</script>

<style scoped>
.error-boundary {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f0f2f5;
}
.desc {
  text-align: left;
  background: #fff;
  padding: 16px;
  border-radius: 4px;
  max-width: 600px;
  overflow: auto;
}
</style>
```

---

### Task 6.4: Cypress E2E 测试环境搭建

**Files:**
- Create: `packages/frontend/cypress.config.ts`
- Create: `packages/frontend/cypress/support/e2e.ts`
- Create: `packages/frontend/cypress/support/commands.ts`

**Step 1: 安装依赖**
```bash
pnpm add -D cypress start-server-and-test
```

**Step 2: 配置文件 (`cypress.config.ts`)**
```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
```

**Step 3: 自定义命令 (`cypress/support/commands.ts`)**
```typescript
/// <reference types="cypress" />

Cypress.Commands.add('login', (username = 'admin', password = 'password') => {
  cy.session([username, password], () => {
    cy.request('POST', '/api/auth/login', { username, password }).then(({ body }) => {
      window.localStorage.setItem('mcp_token', body.data.token);
    });
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(username?: string, password?: string): Chainable<void>;
    }
  }
}
```

---

### Task 6.5: E2E 测试场景 1 - 生成器工作流

**Files:**
- Create: `packages/frontend/cypress/e2e/generator.cy.ts`

**代码实现:**
```typescript
describe('MCP Generator Workflow', () => {
  beforeEach(() => {
    // 模拟登录态
    cy.login();
    cy.visit('/generator');
  });

  it('should create a new project and start generation', () => {
    // 1. 点击新建项目
    cy.get('button').contains('新建').click();
    
    // 2. 填写表单
    cy.get('.ant-modal').should('be.visible');
    cy.get('input#project_name').type('E2E Test Project');
    // 模拟文件上传
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-api.md', { force: true });
    
    // 3. 提交并验证列表更新
    cy.get('.ant-modal-footer button.ant-btn-primary').click();
    cy.contains('.project-item', 'E2E Test Project').should('be.visible');

    // 4. 进入详情页
    cy.contains('.project-item', 'E2E Test Project').click();
    cy.get('.ant-card-head-title').should('contain', 'E2E Test Project');

    // 5. 点击开始生成
    cy.intercept('POST', '/api/generator/projects/*/start').as('startGen');
    cy.contains('button', '开始生成').click();
    cy.wait('@startGen');

    // 6. 验证日志终端输出
    cy.get('.terminal-container').should('contain', '开始解析文档...');
    cy.get('.terminal-container').should('contain', '代码生成中...');
  });
});
```

---

### Task 6.6: E2E 测试场景 2 - 部署工作流

**Files:**
- Create: `packages/frontend/cypress/e2e/deployment.cy.ts`

**代码实现:**
```typescript
describe('Deployment Workflow', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/runtime/deploy');
  });

  it('should select servers and deploy', () => {
    // 1. Step 1: 选择 Server
    cy.contains('选择 Server').should('have.class', 'ant-steps-item-active');
    cy.get('.ant-transfer-list-content-item').first().click(); // 选择第一个
    cy.get('.ant-transfer-operation button').first().click(); // 移入右侧
    cy.contains('button', '下一步').click();

    // 2. Step 2: 预览 YAML
    cy.contains('预览配置').should('have.class', 'ant-steps-item-active');
    cy.get('.editor-container').should('be.visible'); // Monaco Editor 存在
    // 验证 API 调用
    cy.intercept('POST', '/api/runtime/deploy/execute').as('deployExec');
    cy.contains('button', '下一步').click();

    // 3. Step 3: 执行部署
    cy.contains('执行部署').should('have.class', 'ant-steps-item-active');
    cy.wait('@deployExec');
    
    // 4. 验证成功状态
    cy.contains('部署成功').should('be.visible');
    cy.contains('button', '完成').click();
    cy.url().should('include', '/runtime/servers');
  });
});
```

---

### Task 6.7: E2E 测试场景 3 - 管理后台

**Files:**
- Create: `packages/frontend/cypress/e2e/admin.cy.ts`

**代码实现:**
```typescript
describe('Admin Management', () => {
  beforeEach(() => {
    cy.login('admin', 'admin123');
    cy.visit('/admin/tenants');
  });

  it('should manage tenants', () => {
    // 1. 新增租户
    cy.contains('button', '新增租户').click();
    cy.get('input#name').type('Cypress Corp');
    cy.get('input#domain').type('cypress.io');
    cy.get('button.ant-btn-primary').contains('确 定').click();

    // 2. 验证列表存在
    cy.contains('tr', 'Cypress Corp').should('exist');

    // 3. 禁用租户
    cy.contains('tr', 'Cypress Corp').within(() => {
      cy.contains('button', '停用').click();
    });
    // 处理 Popconfirm
    cy.get('.ant-popover-buttons button.ant-btn-primary').click();
    
    // 4. 验证状态变更
    cy.contains('tr', 'Cypress Corp').should('contain', '已禁用');
  });

  it('should manage api keys', () => {
    cy.visit('/admin/keys');
    cy.contains('button', '生成新 Key').click();
    // 验证 Key 生成弹窗
    cy.get('.ant-modal').should('contain', 'sk-mcp-');
  });
});
```

---

### Task 6.8: 构建优化配置 (Vite + Rollup)

**Files:**
- Modify: `packages/frontend/vite.config.ts`

**代码实现:**
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    vue(),
    // Gzip 压缩
    compression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // 构建分析
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // 分包策略
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
          'antd-vendor': ['ant-design-vue', '@ant-design/icons-vue'],
          'echarts-vendor': ['echarts'],
          'editor-vendor': ['monaco-editor'],
        },
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 2000,
  },
});
```

---

### Task 6.9: 响应式适配与主题优化

**Files:**
- Create: `packages/frontend/src/assets/styles/responsive.less`

**代码实现:**
```less
/* 移动端适配 (<768px) */
@media screen and (max-width: 768px) {
  .ant-layout-sider {
    display: none; /* 移动端隐藏侧边栏，改用抽屉式导航 */
  }
  
  .ant-layout-content {
    padding: 12px !important;
  }
  
  .monitor-container .ant-col {
    width: 100% !important;
    margin-bottom: 16px;
  }
}

/* 平板适配 (768px - 1024px) */
@media screen and (min-width: 768px) and (max-width: 1024px) {
  .ant-layout-sider {
    flex: 0 0 80px !important;
    max-width: 80px !important;
    min-width: 80px !important;
    width: 80px !important;
  }
  
  /* 侧边栏收缩状态样式 */
  .ant-menu-item span {
    display: none;
  }
}

/* 打印样式优化 */
@media print {
  .ant-layout-sider,
  .ant-layout-header,
  .ant-btn {
    display: none !important;
  }
  
  .ant-layout-content {
    margin: 0 !important;
    padding: 0 !important;
  }
}
```

---

### Task 6.10: Lighthouse 性能基线测试

**Files:**
- Create: `packages/frontend/scripts/lighthouse.js`

**代码实现:**
```javascript
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

(async () => {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse('http://localhost:5173', options);

  // `.report` is the HTML report as a string
  const reportHtml = runnerResult.report;
  const fs = require('fs');
  fs.writeFileSync('lh-report.html', reportHtml);

  // `.lhr` is the Lighthouse Result as a JSON object
  console.log('Report is done for', runnerResult.lhr.finalUrl);
  console.log('Performance score was', runnerResult.lhr.categories.performance.score * 100);

  await chrome.kill();

  // 性能门禁：低于 80 分则报错
  if (runnerResult.lhr.categories.performance.score < 0.8) {
    console.error('Performance score too low!');
    process.exit(1);
  }
})();
```

---

### Task 6.11: 验证与 Git 提交

**Step 1: 运行 Cypress 测试**
```bash
# Terminal 1: 启动前端
pnpm dev

# Terminal 2: 运行测试
pnpm cypress run
```
**期望输出**: All specs passed (generator.cy.ts, deployment.cy.ts, admin.cy.ts).

**Step 2: 运行构建**
```bash
pnpm build
```
**期望输出**: `dist/` 目录生成，vendor chunks 被正确拆分。

**Step 3: 提交代码**
```bash
git add packages/frontend
git commit -m "feat: phase 6 完成集成测试与性能优化"
```

CCB_DONE: 20260216-211558-753-18268-1
