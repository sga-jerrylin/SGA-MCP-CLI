# Phase 3 (Backend, Codex) — Config Repository + Packaging + Cloud Admin Detailed Plan

Goal: produce signed, versioned configuration packages; implement cloud repository APIs; add tenant + API key lifecycle; ensure supply-chain verification (signature + SBOM) at publish/install.

---

## Task 3.1: Define Package Manifest Types + Validation

Files:
- Create: `E:\mcp\packages\backend\src\packages\manifest\manifest.ts`
- Create: `E:\mcp\packages\backend\src\packages\manifest\manifest.zod.ts`
- Create: `E:\mcp\packages\backend\src\packages\manifest\manifest.spec.ts`

TDD:
1. Spec: valid manifest passes; missing tool list fails.
2. Run tests (fail).
3. Implement types + Zod.
4. Re-run (pass).
5. Commit: `feat(packages): add manifest schema`

Key code:
```ts
export const ManifestZ = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\\d+\\.\\d+\\.\\d+(-.+)?$/),
  tools: z.array(z.object({ name: z.string().min(1) })).min(1),
});
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- manifest.spec.ts
```
Expected: `PASS`.

---

## Task 3.2: Package Builder — Tar/Gzip + SHA-256 Hash

Files:
- Create: `E:\mcp\packages\backend\src\packages\builder\package-builder.ts`
- Create: `E:\mcp\packages\backend\src\packages\builder\package-builder.spec.ts`

TDD:
1. Spec: given a folder fixture, builds `.tar.gz` and returns hash hex.
2. Run tests (fail).
3. Implement using `tar` library (node) and `crypto.createHash('sha256')`.
4. Re-run (pass).
5. Commit: `feat(packages): build tar.gz packages with sha256`

Key code:
```ts
const hash = createHash('sha256').update(tarGzBuffer).digest('hex');
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- package-builder.spec.ts
```
Expected: `PASS`.

---

## Task 3.3: Signing Service — RSA-SHA256 Sign Manifest Hash

Files:
- Create: `E:\mcp\packages\backend\src\packages\signing\signing.service.ts`
- Create: `E:\mcp\packages\backend\src\packages\signing\signing.service.spec.ts`

TDD:
1. Spec: signing then verifying with public key returns true.
2. Run tests (fail).
3. Implement `sign(hash)` + `verify(hash, sig)`.
4. Re-run (pass).
5. Commit: `feat(packages): add rsa-sha256 signing service`

Key code:
```ts
const sign = createSign('RSA-SHA256');
sign.update(Buffer.from(hashHex, 'hex'));
return sign.sign(privateKeyPem, 'base64');
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- signing.service.spec.ts
```
Expected: `PASS`.

---

## Task 3.4: SBOM Generator (Dependency Snapshot)

Files:
- Create: `E:\mcp\packages\backend\src\packages\sbom\sbom.service.ts`
- Create: `E:\mcp\packages\backend\src\packages\sbom\sbom.service.spec.ts`

TDD:
1. Spec: reads `package.json` and emits deterministic SBOM JSON.
2. Run tests (fail).
3. Implement minimal SBOM: package name + dependency map + generatedBy.
4. Re-run (pass).
5. Commit: `feat(packages): generate minimal sbom`

Key code:
```ts
return { package: name, dependencies: deps, generatedBy: 'mcp-hub', scanResult: { vulnerabilities: [] } };
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- sbom.service.spec.ts
```
Expected: `PASS`.

---

## Task 3.5: Repository Entities (Package/Version/Download Stats)

Files:
- Create: `E:\mcp\packages\backend\src\repository\db\package.entity.ts`
- Create: `E:\mcp\packages\backend\src\repository\db\package-version.entity.ts`
- Create: `E:\mcp\packages\backend\src\repository\db\download-log.entity.ts`
- Create: `E:\mcp\packages\backend\src\repository\db\repository.entities.spec.ts`

TDD:
1. Spec: unique constraints (`tenantId+name`, `packageId+version`) exist.
2. Run tests (fail).
3. Implement entities.
4. Re-run (pass).
5. Commit: `feat(repo): add repository entities`

Key code:
```ts
@Index(['packageId', 'version'], { unique: true })
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- repository.entities.spec.ts
```
Expected: `PASS`.

---

## Task 3.6: MinIO Layout for Repository (per-tenant bucket)

Files:
- Create: `E:\mcp\packages\backend\src\repository\storage\repo-storage.service.ts`
- Create: `E:\mcp\packages\backend\src\repository\storage\repo-storage.service.spec.ts`

TDD:
1. Spec: `putPackageVersion()` writes to `tenant-{tenantId}/packages/{name}/{version}.tar.gz`.
2. Run tests (fail).
3. Implement with MinIO wrapper from Phase 1.
4. Re-run (pass).
5. Commit: `feat(repo): store packages in minio per-tenant bucket`

Key code:
```ts
const bucket = `tenant-${tenantId}`;
const key = `packages/${pkgName}/${version}.tar.gz`;
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- repo-storage.service.spec.ts
```
Expected: `PASS`.

---

## Task 3.7: Publish API (`POST /packages/publish`) — Upload + Verify + Persist

Files:
- Create: `E:\mcp\packages\backend\src\repository\api\publish.controller.ts`
- Create: `E:\mcp\packages\backend\src\repository\api\publish.controller.spec.ts`
- Create: `E:\mcp\packages\backend\src\repository\repository.module.ts`

TDD:
1. Spec: rejects invalid signature; accepts valid and stores metadata.
2. Run tests (fail).
3. Implement controller calling builder+signing verify+storage.
4. Re-run (pass).
5. Commit: `feat(repo): add publish endpoint with signature verification`

Key code:
```ts
@Post('packages/publish')
@UseInterceptors(FileInterceptor('file'))
async publish(@UploadedFile() file: Express.Multer.File) { /* ... */ }
```

Verify:
```powershell
curl -F "file=@pkg.tar.gz" http://localhost:3000/packages/publish
```
Expected: `200` with package id/version.

---

## Task 3.8: List/Search API (`GET /packages`) + Pagination

Files:
- Create: `E:\mcp\packages\backend\src\repository\api\packages.controller.ts`
- Create: `E:\mcp\packages\backend\src\repository\api\packages.controller.spec.ts`

TDD:
1. Spec: returns paginated results and supports `q` filter.
2. Run tests (fail).
3. Implement service query with TypeORM.
4. Re-run (pass).
5. Commit: `feat(repo): add packages list/search endpoint`

Key code:
```ts
@Get('packages')
list(@Query('q') q?: string, @Query('page') page = '1') { /* ... */ }
```

Verify:
```powershell
curl "http://localhost:3000/packages?q=wecom&page=1"
```
Expected: `{"items":[...],"page":1,...}`.

---

## Task 3.9: Download API (`GET /packages/:id/download`) — Signed URL + Audit

Files:
- Create: `E:\mcp\packages\backend\src\repository\api\download.controller.ts`
- Create: `E:\mcp\packages\backend\src\repository\api\download.controller.spec.ts`

TDD:
1. Spec: returns pre-signed URL (or streams file) and writes download log.
2. Run tests (fail).
3. Implement.
4. Re-run (pass).
5. Commit: `feat(repo): add package download endpoint with audit`

Key code:
```ts
// Prefer: return MinIO presigned URL to offload API server.
```

Verify:
```powershell
curl -I http://localhost:3000/packages/<id>/download
```
Expected: `302` to signed URL or `200` stream.

---

## Task 3.10: Tenants API (CRUD) + RLS-safe access

Files:
- Create: `E:\mcp\packages\backend\src\tenants\api\tenants.controller.ts`
- Create: `E:\mcp\packages\backend\src\tenants\api\tenants.controller.spec.ts`

TDD:
1. Spec: create/list/disable tenant.
2. Run tests (fail).
3. Implement.
4. Re-run (pass).
5. Commit: `feat(tenants): add tenants CRUD api`

Verify:
```powershell
curl -X POST http://localhost:3000/api/tenants -H "Content-Type: application/json" -d "{\"name\":\"Acme\"}"
```
Expected: `200` with tenant id.

---

## Task 3.11: Tenant API Key Lifecycle (create/revoke, hash-only storage)

Files:
- Create: `E:\mcp\packages\backend\src\auth\tenant-api-keys\tenant-api-key.entity.ts`
- Create: `E:\mcp\packages\backend\src\auth\tenant-api-keys\tenant-api-key.service.ts`
- Create: `E:\mcp\packages\backend\src\auth\tenant-api-keys\tenant-api-key.service.spec.ts`
- Create: `E:\mcp\packages\backend\src\auth\tenant-api-keys\tenant-api-key.controller.ts`
- Create: `E:\mcp\packages\backend\src\auth\tenant-api-keys\tenant-api-key.controller.spec.ts`

TDD:
1. Spec: key is generated and returned once; DB stores only hash; revoke blocks validation.
2. Run tests (fail).
3. Implement (SHA-256 hash; scopes/quota fields).
4. Re-run (pass).
5. Commit: `feat(auth): add tenant api key lifecycle`

Key code:
```ts
const raw = randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(raw).digest('hex');
```

Verify:
```powershell
pnpm -C E:\mcp\packages\backend test -- tenant-api-key.service.spec.ts
```
Expected: `PASS`.

