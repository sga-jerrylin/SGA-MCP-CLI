import { createHash, randomBytes } from 'node:crypto';
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateTenantRequest,
  Tenant
} from '@sga/shared';
import { Injectable } from '@nestjs/common';

type StoredApiKey = ApiKey & { hash: string };

@Injectable()
export class AdminService {
  private readonly tenants: Tenant[] = [
    {
      id: 'tenant-default',
      name: 'Default Tenant',
      contact: 'admin@example.com',
      status: 'active',
      createdAt: new Date('2026-02-01T00:00:00.000Z').toISOString()
    }
  ];

  private readonly keyStore = new Map<string, StoredApiKey[]>();

  public listTenants(): Tenant[] {
    return [...this.tenants];
  }

  public createTenant(req: CreateTenantRequest): Tenant {
    const tenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: req.name,
      contact: req.contact,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    this.tenants.push(tenant);
    return tenant;
  }

  public listKeys(tenantId: string): ApiKey[] {
    const keys = this.keyStore.get(tenantId) ?? [];
    return keys.map(({ hash: _hash, ...rest }) => rest);
  }

  public createKey(tenantId: string, req: CreateApiKeyRequest): CreateApiKeyResponse {
    const rawKey = `mcp_${randomBytes(16).toString('hex')}`;
    const expiresAt = this.resolveExpiry(req.expiresIn);
    const prefix = rawKey.slice(0, 8);
    const key: StoredApiKey = {
      id: `key-${Date.now()}`,
      name: req.name,
      prefix,
      expiresAt,
      status: 'active',
      hash: this.hash(rawKey)
    };

    const existing = this.keyStore.get(tenantId) ?? [];
    existing.push(key);
    this.keyStore.set(tenantId, existing);

    return {
      id: key.id,
      name: key.name,
      key: rawKey,
      prefix,
      expiresAt
    };
  }

  public revokeKey(tenantId: string, keyId: string): void {
    const keys = this.keyStore.get(tenantId) ?? [];
    const target = keys.find((key) => key.id === keyId);
    if (target) {
      target.status = 'revoked';
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private resolveExpiry(expiresIn?: string): string {
    const fallbackDays = 90;
    const normalized = expiresIn ?? `${fallbackDays}d`;
    const match = /^(\d+)([dh])$/.exec(normalized);

    if (!match) {
      return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const value = Number(match[1]);
    const unit = match[2];
    const durationMs = unit === 'h' ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;

    return new Date(Date.now() + durationMs).toISOString();
  }
}
