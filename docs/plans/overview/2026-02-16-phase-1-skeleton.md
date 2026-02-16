# Phase 1: 骨架搭建 — 详细计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 前后端项目可运行，基础模块创建，认证功能就绪

**时间:** 1 周

**并行策略:** Codex（后端）和 Gemini（前端）同时开工，Claude 协调和审查

---

## 后端任务（Codex 负责）

### Task 1.1: NestJS 项目初始化

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/main.ts`
- Create: `packages/backend/src/app.module.ts`
- Create: `packages/backend/src/app.controller.ts`
- Create: `packages/backend/nest-cli.json`

**Step 1: 创建 main.ts**

```typescript
// packages/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS（开发环境）
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
}

bootstrap();
```

**Step 2: 创建 app.module.ts**

```typescript
// packages/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'mcp_hub',
      password: 'dev_password',
      database: 'mcp_hub_dev',
      autoLoadEntities: true,
      synchronize: false, // 生产环境必须 false
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Step 3: 创建 app.controller.ts（健康检查）**

```typescript
// packages/backend/src/app.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

**Step 4: 测试启动**

```bash
cd packages/backend
pnpm dev
```

**Expected output:**
```
🚀 Backend running on http://localhost:3000
```

**Step 5: 验证健康检查**

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-02-16T10:00:00.000Z"}
```

**Step 6: Commit**

```bash
git add packages/backend/src/
git commit -m "feat(backend): NestJS 项目初始化 + 健康检查端点"
```

---

### Task 1.2: Auth Vault 基础模块

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/auth-vault/auth-vault.module.ts`
- Create: `packages/backend/src/auth-vault/auth-vault.service.ts`
- Create: `packages/backend/src/auth-vault/entities/credential.entity.ts`
- Create: `packages/backend/src/auth-vault/dto/encrypt-credential.dto.ts`
- Create: `packages/backend/src/auth-vault/auth-vault.service.spec.ts`

**Step 1: 创建 Credential Entity**

```typescript
// packages/backend/src/auth-vault/entities/credential.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('credentials')
@Index(['tenantId', 'serverId', 'keyName'], { unique: true })
export class Credential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @Index()
  serverId: string;

  @Column({ length: 100 })
  keyName: string;

  @Column('bytea')
  encryptedValue: Buffer;

  @Column('bytea')
  encryptionIv: Buffer;

  @Column('bytea')
  authTag: Buffer;

  @Column('int')
  keyVersion: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedAt: Date | null;
}
```

**Step 2: 创建 DTO**

```typescript
// packages/backend/src/auth-vault/dto/encrypt-credential.dto.ts
import { IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class EncryptCredentialDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  serverId: string;

  @IsString()
  keyName: string;

  @IsString()
  plaintext: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class DecryptCredentialDto {
  @IsUUID()
  credentialId: string;

  @IsUUID()
  tenantId: string;
}
```

**Step 3: 创建 Service（TDD）**

**先写测试:**

```typescript
// packages/backend/src/auth-vault/auth-vault.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthVaultService } from './auth-vault.service';
import { Credential } from './entities/credential.entity';

describe('AuthVaultService', () => {
  let service: AuthVaultService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthVaultService,
        {
          provide: getRepositoryToken(Credential),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuthVaultService>(AuthVaultService);
  });

  it('should encrypt and decrypt credential', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const serverId = 'test-server';
    const keyName = 'api_key';
    const plaintext = 'secret-key-12345';

    // Encrypt
    const encryptedCred = await service.encrypt({
      tenantId,
      serverId,
      keyName,
      plaintext,
    });

    expect(encryptedCred).toHaveProperty('encryptedValue');
    expect(encryptedCred).toHaveProperty('encryptionIv');
    expect(encryptedCred).toHaveProperty('authTag');
    expect(encryptedCred.keyVersion).toBe(1);

    // Mock repository save
    mockRepository.save.mockResolvedValue({
      id: 'credential-id-123',
      ...encryptedCred,
      tenantId,
      serverId,
      keyName,
    });

    const savedCred = await mockRepository.save(encryptedCred);

    // Decrypt
    const decrypted = await service.decrypt(
      savedCred,
      tenantId,
      serverId,
      keyName
    );

    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption with wrong AAD context', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const serverId = 'test-server';
    const keyName = 'api_key';
    const plaintext = 'secret-key-12345';

    const encryptedCred = await service.encrypt({
      tenantId,
      serverId,
      keyName,
      plaintext,
    });

    // Try decrypt with wrong tenant ID (AAD mismatch)
    await expect(
      service.decrypt(
        encryptedCred as any,
        'wrong-tenant-id',
        serverId,
        keyName
      )
    ).rejects.toThrow('Decryption failed');
  });
});
```

**Step 4: 运行测试（应该失败）**

```bash
cd packages/backend
pnpm test auth-vault.service.spec
```

**Expected:** FAIL (service not implemented)

**Step 5: 实现 Service**

```typescript
// packages/backend/src/auth-vault/auth-vault.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Credential } from './entities/credential.entity';
import { EncryptCredentialDto } from './dto/encrypt-credential.dto';

@Injectable()
export class AuthVaultService {
  private masterKeys: Map<number, Buffer>;
  private currentKeyVersion = 1;

  constructor(
    @InjectRepository(Credential)
    private credentialRepo: Repository<Credential>
  ) {
    // 从环境变量或 Docker secrets 加载主密钥
    // 开发环境用固定密钥（生产必须用 secrets）
    this.masterKeys = new Map();
    this.masterKeys.set(
      1,
      Buffer.from('0'.repeat(64), 'hex') // 32字节 = 256bit
    );
  }

  async encrypt(dto: EncryptCredentialDto) {
    const { tenantId, serverId, keyName, plaintext } = dto;
    const keyVersion = this.currentKeyVersion;
    const masterKey = this.masterKeys.get(keyVersion);

    if (!masterKey) {
      throw new Error(`Master key version ${keyVersion} not found`);
    }

    const iv = randomBytes(12); // GCM 标准 IV 长度

    // AAD: 绑定租户、Server、密钥名称、版本
    const aad = Buffer.from(
      JSON.stringify({ tenantId, serverId, keyName, keyVersion })
    );

    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encryptedValue: encrypted,
      encryptionIv: iv,
      authTag,
      keyVersion,
    };
  }

  async decrypt(
    credential: Credential,
    tenantId: string,
    serverId: string,
    keyName: string
  ): Promise<string> {
    const masterKey = this.masterKeys.get(credential.keyVersion);
    if (!masterKey) {
      throw new Error(`Master key version ${credential.keyVersion} not found`);
    }

    // 重建 AAD（必须与加密时一致）
    const aad = Buffer.from(
      JSON.stringify({
        tenantId,
        serverId,
        keyName,
        keyVersion: credential.keyVersion,
      })
    );

    const decipher = createDecipheriv(
      'aes-256-gcm',
      masterKey,
      credential.encryptionIv
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(credential.authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(credential.encryptedValue),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err) {
      throw new Error('Decryption failed: tampered or mismatched context');
    }
  }

  async saveCredential(dto: EncryptCredentialDto): Promise<Credential> {
    const encrypted = await this.encrypt(dto);

    const credential = this.credentialRepo.create({
      tenantId: dto.tenantId,
      serverId: dto.serverId,
      keyName: dto.keyName,
      ...encrypted,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    return this.credentialRepo.save(credential);
  }

  async getCredential(
    tenantId: string,
    serverId: string,
    keyName: string
  ): Promise<string> {
    const credential = await this.credentialRepo.findOne({
      where: { tenantId, serverId, keyName },
    });

    if (!credential) {
      throw new Error('Credential not found');
    }

    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new Error('Credential expired');
    }

    // 更新最后访问时间
    await this.credentialRepo.update(credential.id, {
      lastAccessedAt: new Date(),
    });

    return this.decrypt(credential, tenantId, serverId, keyName);
  }
}
```

**Step 6: 再次运行测试（应该通过）**

```bash
pnpm test auth-vault.service.spec
```

**Expected:** PASS

**Step 7: 创建 Module**

```typescript
// packages/backend/src/auth-vault/auth-vault.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthVaultService } from './auth-vault.service';
import { Credential } from './entities/credential.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Credential])],
  providers: [AuthVaultService],
  exports: [AuthVaultService],
})
export class AuthVaultModule {}
```

**Step 8: 注册到 AppModule**

```typescript
// packages/backend/src/app.module.ts
import { AuthVaultModule } from './auth-vault/auth-vault.module';

@Module({
  imports: [
    // ... existing
    AuthVaultModule,
  ],
  // ...
})
export class AppModule {}
```

**Step 9: Commit**

```bash
git add packages/backend/src/auth-vault/
git commit -m "feat(backend): Auth Vault 基础模块（AES-256-GCM + AAD）"
```

---

### Task 1.3: Redis + BullMQ 配置

**负责人:** Codex

**Files:**
- Create: `packages/backend/src/queue/queue.module.ts`
- Create: `packages/backend/src/queue/queue.service.ts`

（简化示例，完整代码见 Phase 2）

```typescript
// packages/backend/src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'generator',
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
```

**Commit:**

```bash
git commit -m "feat(backend): Redis + BullMQ 队列配置"
```

---

### Task 1.4: MinIO 对接

**负责人:** Codex

（简化，完整代码见 Phase 3）

```typescript
// packages/backend/src/storage/storage.service.ts
import { Injectable } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
  private minioClient: Minio.Client;

  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'mcp_hub_admin',
      secretKey: 'dev_password',
    });
  }

  async uploadFile(
    bucketName: string,
    objectName: string,
    filePath: string
  ): Promise<void> {
    await this.minioClient.fPutObject(bucketName, objectName, filePath);
  }
}
```

**Commit:**

```bash
git commit -m "feat(backend): MinIO 对接基础服务"
```

---

## 前端任务（Gemini 负责）

### Task 1.5: Vue3 项目初始化

**负责人:** Gemini

**Files:**
- Create: `packages/frontend/src/App.vue`
- Create: `packages/frontend/src/main.ts`
- Create: `packages/frontend/src/router/index.ts`
- Create: `packages/frontend/src/stores/user.ts`

**Step 1: 创建 main.ts**

```typescript
// packages/frontend/src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(Antd);

app.mount('#app');
```

**Step 2: 创建 App.vue**

```vue
<!-- packages/frontend/src/App.vue -->
<template>
  <a-config-provider :theme="{ token: { colorPrimary: '#2563eb' } }">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
// 主题配置：蓝色主色调（与 demo 一致）
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f5f5;
}
</style>
```

**Step 3: 创建路由**

```typescript
// packages/frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      component: () => import('../views/Dashboard.vue'),
    },
    {
      path: '/login',
      component: () => import('../views/Login.vue'),
    },
  ],
});

export default router;
```

**Step 4: 创建 Pinia Store**

```typescript
// packages/frontend/src/stores/user.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const username = ref<string>('');

  function setToken(newToken: string) {
    token.value = newToken;
    localStorage.setItem('token', newToken);
  }

  function logout() {
    token.value = null;
    localStorage.removeItem('token');
  }

  return { token, username, setToken, logout };
});
```

**Step 5: 启动前端**

```bash
cd packages/frontend
pnpm dev
```

**Expected output:**
```
  ➜  Local:   http://localhost:5173/
```

**Step 6: Commit**

```bash
git add packages/frontend/src/
git commit -m "feat(frontend): Vue3 项目初始化 + 路由 + Pinia Store"
```

---

### Task 1.6: 布局框架（侧边栏 + 主内容区）

**负责人:** Gemini

**Files:**
- Create: `packages/frontend/src/layouts/MainLayout.vue`
- Create: `packages/frontend/src/views/Dashboard.vue`

**Step 1: 创建 MainLayout**

```vue
<!-- packages/frontend/src/layouts/MainLayout.vue -->
<template>
  <a-layout style="min-height: 100vh">
    <!-- 侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :style="{ background: '#1a1f2e' }"
      collapsible
    >
      <div class="logo">
        <h2 style="color: #fff; text-align: center; padding: 20px 0">
          {{ collapsed ? 'MCP' : 'MCP Hub' }}
        </h2>
      </div>

      <a-menu
        v-model:selectedKeys="selectedKeys"
        theme="dark"
        mode="inline"
        :style="{ background: '#1a1f2e' }"
      >
        <a-menu-item key="dashboard">
          <template #icon><DashboardOutlined /></template>
          <span>系统概览</span>
        </a-menu-item>

        <a-sub-menu key="workbench">
          <template #icon><CodeOutlined /></template>
          <template #title>开发工作台</template>
          <a-menu-item key="generator">MCP 生成器</a-menu-item>
          <a-menu-item key="repository">配置仓库</a-menu-item>
          <a-menu-item key="ai-settings">AI 引擎设置</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="pipeline">
          <template #icon><ApiOutlined /></template>
          <template #title>交付流水线</template>
          <a-menu-item key="connections">连接与鉴权</a-menu-item>
          <a-menu-item key="tools">工具库</a-menu-item>
          <a-menu-item key="deploy">部署发布</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="operations">
          <template #icon><MonitorOutlined /></template>
          <template #title>运维治理</template>
          <a-menu-item key="monitoring">运行监控</a-menu-item>
          <a-menu-item key="audit">审计日志</a-menu-item>
        </a-sub-menu>

        <a-menu-item key="settings">
          <template #icon><SettingOutlined /></template>
          <span>系统设置</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <!-- 主内容区 -->
    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 24px">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <h3>{{ pageTitle }}</h3>
          <a-dropdown>
            <a-button type="text">
              <UserOutlined />
              {{ username }}
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="handleLogout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content style="margin: 16px">
        <div style="padding: 24px; background: #fff; min-height: 360px">
          <slot />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../stores/user';
import {
  DashboardOutlined,
  CodeOutlined,
  ApiOutlined,
  MonitorOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const collapsed = ref(false);
const selectedKeys = ref<string[]>(['dashboard']);
const username = computed(() => userStore.username || 'Admin');

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    dashboard: '系统概览',
    generator: 'MCP 生成器',
    repository: '配置仓库',
    deploy: '部署发布',
    monitoring: '运行监控',
  };
  return titles[selectedKeys.value[0]] || 'MCP Hub';
});

function handleLogout() {
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.logo {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
```

**Step 2: 创建 Dashboard 页面**

```vue
<!-- packages/frontend/src/views/Dashboard.vue -->
<template>
  <main-layout>
    <a-row :gutter="16">
      <a-col :span="6">
        <a-card title="MCP Server 总数">
          <a-statistic :value="13" suffix="个" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card title="工具总数">
          <a-statistic :value="182" suffix="个" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card title="运行中 Server">
          <a-statistic :value="10" :value-style="{ color: '#3f8600' }" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card title="生成项目">
          <a-statistic :value="5" suffix="个" />
        </a-card>
      </a-col>
    </a-row>

    <a-card title="Server 健康状态" style="margin-top: 16px">
      <div>拓扑图占位（Phase 4 实现 AntV G6）</div>
    </a-card>
  </main-layout>
</template>

<script setup lang="ts">
import MainLayout from '../layouts/MainLayout.vue';
</script>
```

**Step 3: 更新路由**

```typescript
// packages/frontend/src/router/index.ts
import MainLayout from '../layouts/MainLayout.vue';

{
  path: '/dashboard',
  component: () => import('../views/Dashboard.vue'),
}
```

**Step 4: 访问测试**

访问 `http://localhost:5173/dashboard`

**Expected:** 看到侧边栏 + 4 个统计卡片

**Step 5: Commit**

```bash
git add packages/frontend/src/layouts/ packages/frontend/src/views/
git commit -m "feat(frontend): 布局框架（侧边栏导航 + 主内容区）"
```

---

### Task 1.7: 组件库基础

**负责人:** Gemini

**Files:**
- Create: `packages/frontend/src/components/DynamicForm.vue`
- Create: `packages/frontend/src/components/LogTerminal.vue`
- Create: `packages/frontend/src/components/SchemaViewer.vue`

（简化示例，完整实现见 Phase 2-4）

```vue
<!-- packages/frontend/src/components/LogTerminal.vue -->
<template>
  <div class="log-terminal">
    <div class="terminal-header">
      <span>{{ title }}</span>
      <a-button size="small" @click="clear">清空</a-button>
    </div>
    <div class="terminal-body" ref="terminalRef">
      <div v-for="(log, i) in logs" :key="i" class="log-line">
        [{{ log.timestamp }}] {{ log.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

interface LogEntry {
  timestamp: string;
  message: string;
}

const props = defineProps<{
  title?: string;
  logs: LogEntry[];
}>();

const terminalRef = ref<HTMLDivElement | null>(null);

function clear() {
  // emit event
}

// 自动滚动到底部
watch(() => props.logs, async () => {
  await nextTick();
  if (terminalRef.value) {
    terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
  }
});
</script>

<style scoped>
.log-terminal {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  background: #f0f0f0;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.terminal-body {
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  padding: 12px;
  height: 400px;
  overflow-y: auto;
}

.log-line {
  margin-bottom: 4px;
}
</style>
```

**Commit:**

```bash
git commit -m "feat(frontend): 通用组件（LogTerminal/DynamicForm/SchemaViewer 占位）"
```

---

## Phase 1 验收标准

**后端（Codex）:**
- [x] NestJS 项目可运行
- [x] 健康检查 `GET /health` 返回 200
- [x] Auth Vault 模块单元测试通过
- [x] TypeORM 连接 PostgreSQL 成功
- [x] Redis + BullMQ 配置完成
- [x] MinIO 连接测试通过

**前端（Gemini）:**
- [x] Vue3 项目可运行
- [x] 布局框架显示正确（侧边栏 + 主内容区）
- [x] Dashboard 页面 4 个统计卡片
- [x] 路由导航工作正常
- [x] Pinia Store 初始化

**验证命令:**

```bash
# 后端
curl http://localhost:3000/health
cd packages/backend && pnpm test

# 前端
# 访问 http://localhost:5173/dashboard
```

---

## 下一步

Phase 1 完成后，进入 **Phase 2: AI 生成引擎 + 安全基础**

**关键任务:**
- 文档解析器（Markdown → IR）
- 代码生成器（IR → Connector 代码）
- Sandbox Worker（隔离执行）
- Auth Vault 完整实现（主密钥轮换）
- MCP 生成器前端页面

**预计时间:** 2 周
