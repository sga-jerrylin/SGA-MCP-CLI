# Phase 1 (Backend, Codex) — Skeleton Setup Detailed Plan

Goal: get the Control Plane backend runnable, with DB/Redis/MinIO wiring, and a secure Auth Vault foundation that Phase 2+ can build on.

Conventions:
1. Paths in this plan are absolute Windows paths.
2. TDD loop per task: write test → run (fail) → implement → run (pass) → commit.
3. Commands assume pnpm workspace and Node already installed.

---

## Task 1.1: Add Health Endpoint (`GET /health`)

Files:
- Create: `E:\mcp\packages\backend\src\health\health.controller.ts`
- Create: `E:\mcp\packages\backend\src\health\health.controller.spec.ts`
- Modify: `E:\mcp\packages\backend\src\app.module.ts`

TDD:
1. Write `health.controller.spec.ts` expecting `{ status: 'ok' }`.
2. Run: `pnpm -C E:\mcp\packages\backend test -- health.controller.spec.ts` (expect FAIL).
3. Implement controller + module wiring.
4. Re-run tests (expect PASS).
5. Commit: `feat(backend): add health endpoint`

Key code:
```ts
// E:\mcp\packages\backend\src\health\health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Verify:
```powershell
curl http://localhost:3000/health
```
Expected:
```json
{"status":"ok","timestamp":"..."}
```

---

## Task 1.2: Bootstrap App Factory (testable `createApp()`)

Files:
- Create: `E:\mcp\packages\backend\src\bootstrap\create-app.ts`
- Create: `E:\mcp\packages\backend\src\bootstrap\create-app.spec.ts`
- Modify: `E:\mcp\packages\backend\src\main.ts`

TDD:
1. Write `create-app.spec.ts` with a fake `INestApplication` verifying `useGlobalPipes()` is called.
2. Run tests (expect FAIL).
3. Implement `createApp()` and refactor `main.ts` to call it.
4. Re-run tests (expect PASS).
5. Commit: `refactor(backend): introduce createApp bootstrap helper`

Key code:
```ts
// E:\mcp\packages\backend\src\bootstrap\create-app.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function createApp(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  return app;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend dev
```
Expected:
```
Backend running on http://localhost:3000
```

---

## Task 1.3: Add Env Validation (Zod) and Typed Config Service

Files:
- Create: `E:\mcp\packages\backend\src\config\env.schema.ts`
- Create: `E:\mcp\packages\backend\src\config\config.service.ts`
- Create: `E:\mcp\packages\backend\src\config\config.service.spec.ts`
- Modify: `E:\mcp\packages\backend\src\app.module.ts`

TDD:
1. Write tests: missing required env var should throw; valid env should parse.
2. Run tests (expect FAIL).
3. Implement schema + service.
4. Re-run tests (expect PASS).
5. Commit: `feat(backend): validate env with zod`

Key code:
```ts
// E:\mcp\packages\backend\src\config\env.schema.ts
import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  MINIO_ENDPOINT: z.string().min(1),
  MASTER_KEY_FILE: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;
```

Verify:
```powershell
$env:DATABASE_URL="postgres://mcp_hub:dev@localhost:5432/mcp_hub_dev"
pnpm -C E:\mcp\packages\backend test -- config.service.spec.ts
```
Expected: `PASS`.

---

## Task 1.4: Introduce Database Module (TypeORM) + Migration Harness

Files:
- Create: `E:\mcp\packages\backend\src\db\data-source.ts`
- Create: `E:\mcp\packages\backend\src\db\db.module.ts`
- Create: `E:\mcp\packages\backend\src\db\db.module.spec.ts`
- Modify: `E:\mcp\packages\backend\src\app.module.ts`

TDD:
1. Write `db.module.spec.ts` asserting module compiles and exports `DataSource`.
2. Run tests (expect FAIL).
3. Implement DataSource factory using `DATABASE_URL`.
4. Re-run tests (expect PASS).
5. Commit: `feat(backend): add db module and datasource config`

Key code:
```ts
// E:\mcp\packages\backend\src\db\data-source.ts
import { DataSource } from 'typeorm';
import { Env } from '../config/env.schema';

export function createDataSource(env: Env) {
  return new DataSource({
    type: 'postgres',
    url: env.DATABASE_URL,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
  });
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- db.module.spec.ts
```
Expected: `PASS`.

---

## Task 1.5: Add Tenant Entity + Service (mocked repository tests)

Files:
- Create: `E:\mcp\packages\backend\src\tenants\entities\tenant.entity.ts`
- Create: `E:\mcp\packages\backend\src\tenants\tenants.service.ts`
- Create: `E:\mcp\packages\backend\src\tenants\tenants.service.spec.ts`

TDD:
1. Write service tests with mocked TypeORM repository (create/list).
2. Run tests (expect FAIL).
3. Implement service.
4. Re-run tests (expect PASS).
5. Commit: `feat(tenants): add tenant service skeleton`

Key code:
```ts
// E:\mcp\packages\backend\src\tenants\entities\tenant.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ default: true })
  isActive!: boolean;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- tenants.service.spec.ts
```
Expected: `PASS`.

---

## Task 1.6: Add Credential Entity for Auth Vault

Files:
- Create: `E:\mcp\packages\backend\src\auth-vault\entities\credential.entity.ts`
- Create: `E:\mcp\packages\backend\src\auth-vault\entities\credential.entity.spec.ts`

TDD:
1. Write entity metadata test (columns present; constraints come via migrations later).
2. Run tests (expect FAIL).
3. Implement entity.
4. Re-run tests (expect PASS).
5. Commit: `feat(vault): add credential entity`

Key code:
```ts
// E:\mcp\packages\backend\src\auth-vault\entities\credential.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('credentials')
@Index(['tenantId', 'serverId', 'keyName'], { unique: true })
export class CredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 50 })
  @Index()
  serverId!: string;

  @Column({ length: 100 })
  keyName!: string;

  @Column('bytea')
  encryptedValue!: Buffer;

  @Column('bytea')
  encryptionIv!: Buffer;

  @Column('bytea')
  authTag!: Buffer;

  @Column('int')
  keyVersion!: number;
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- credential.entity.spec.ts
```
Expected: `PASS`.

---

## Task 1.7: Implement AES-256-GCM Crypto Helper (AAD bound)

Files:
- Create: `E:\mcp\packages\backend\src\auth-vault\crypto\vault-crypto.ts`
- Create: `E:\mcp\packages\backend\src\auth-vault\crypto\vault-crypto.spec.ts`

TDD:
1. Write tests: encrypt/decrypt roundtrip; AAD mismatch must throw.
2. Run tests (expect FAIL).
3. Implement `encrypt()`/`decrypt()` with `aes-256-gcm`.
4. Re-run tests (expect PASS).
5. Commit: `feat(vault): add aes-256-gcm crypto helper`

Key code:
```ts
// E:\mcp\packages\backend\src\auth-vault\crypto\vault-crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export function encryptAes256Gcm(opts: { key: Buffer; plaintext: Buffer; aad: Buffer }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', opts.key, iv);
  cipher.setAAD(opts.aad);
  const ciphertext = Buffer.concat([cipher.update(opts.plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- vault-crypto.spec.ts
```
Expected: `PASS`.

---

## Task 1.8: Vault Service (store/retrieve, repo mocked)

Files:
- Create: `E:\mcp\packages\backend\src\auth-vault\auth-vault.service.ts`
- Create: `E:\mcp\packages\backend\src\auth-vault\auth-vault.service.spec.ts`

TDD:
1. Write tests with mocked repo: `setCredential()` stores encrypted fields; `getCredentialPlaintext()` returns original.
2. Run tests (expect FAIL).
3. Implement service using `vault-crypto.ts` and AAD binding.
4. Re-run tests (expect PASS).
5. Commit: `feat(vault): add auth vault service (basic)`

Key code:
```ts
const aad = Buffer.from(JSON.stringify({ tenantId, serverId, keyName, keyVersion }));
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- auth-vault.service.spec.ts
```
Expected: `PASS`.

---

## Task 1.9: Redis Module + Health Ping

Files:
- Create: `E:\mcp\packages\backend\src\redis\redis.module.ts`
- Create: `E:\mcp\packages\backend\src\redis\redis.service.ts`
- Create: `E:\mcp\packages\backend\src\redis\redis.service.spec.ts`

TDD:
1. Write tests using a minimal mock for `ping()`.
2. Run tests (expect FAIL).
3. Implement service.
4. Re-run tests (expect PASS).
5. Commit: `feat(redis): add redis module`

Key code:
```ts
async ping(): Promise<'PONG'> {
  return (await this.client.ping()) as 'PONG';
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- redis.service.spec.ts
```
Expected: `PASS`.

---

## Task 1.10: BullMQ Queue Wiring (Generator queue)

Files:
- Create: `E:\mcp\packages\backend\src\queues\generator.queue.ts`
- Create: `E:\mcp\packages\backend\src\queues\generator.queue.spec.ts`

TDD:
1. Write tests that `enqueueGeneration()` calls `queue.add()` with expected payload.
2. Run tests (expect FAIL).
3. Implement queue wrapper.
4. Re-run tests (expect PASS).
5. Commit: `feat(queues): add generator queue producer`

Key code:
```ts
export const GENERATOR_QUEUE = 'generator';
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- generator.queue.spec.ts
```
Expected: `PASS`.

---

## Task 1.11: MinIO Client Module (typed wrapper)

Files:
- Create: `E:\mcp\packages\backend\src\storage\minio.module.ts`
- Create: `E:\mcp\packages\backend\src\storage\minio.service.ts`
- Create: `E:\mcp\packages\backend\src\storage\minio.service.spec.ts`

TDD:
1. Write tests with mocked MinIO SDK client verifying `putObject()` called with expected args.
2. Run tests (expect FAIL).
3. Implement wrapper.
4. Re-run tests (expect PASS).
5. Commit: `feat(storage): add minio wrapper service`

Key code:
```ts
async putObject(bucket: string, key: string, body: Buffer) {
  return this.client.putObject(bucket, key, body);
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- minio.service.spec.ts
```
Expected: `PASS`.

---

## Task 1.12: Tenant Context + RLS Helper (request-scoped)

Files:
- Create: `E:\mcp\packages\backend\src\tenancy\tenant-context.interceptor.ts`
- Create: `E:\mcp\packages\backend\src\tenancy\tenant-context.interceptor.spec.ts`

TDD:
1. Write test verifying interceptor issues `SET LOCAL app.current_tenant_id = $1` before handler runs.
2. Run tests (expect FAIL).
3. Implement interceptor (Phase 6 validates pooling correctness).
4. Re-run tests (expect PASS).
5. Commit: `feat(tenancy): add tenant context interceptor for RLS`

Key code:
```ts
await this.dataSource.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- tenant-context.interceptor.spec.ts
```
Expected: `PASS`.

---

## Task 1.13: Secret Redaction Utility (foundation for audit/logging)

Files:
- Create: `E:\mcp\packages\backend\src\security\redaction.ts`
- Create: `E:\mcp\packages\backend\src\security\redaction.spec.ts`

TDD:
1. Write tests redacting `Authorization: Bearer ...`, `api_key=...`, and common secret patterns.
2. Run tests (expect FAIL).
3. Implement `redactSecrets()` (regex + safe defaults).
4. Re-run tests (expect PASS).
5. Commit: `feat(security): add secret redaction helper`

Key code:
```ts
export function redactSecrets(input: string) {
  return input
    .replace(/Authorization:\\s*Bearer\\s+[^\\s]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/(api[_-]?key\\s*[:=]\\s*)[^\\s\"']+/gi, '$1[REDACTED]');
}
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- redaction.spec.ts
```
Expected: `PASS`.

