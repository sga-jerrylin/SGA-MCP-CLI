import type { ApiKey, CreateApiKeyResponse, CreateTenantRequest, Tenant } from '@sga/shared';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Tenant One',
    contact: 'owner@example.com',
    status: 'active',
    createdAt: '2026-02-01T00:00:00.000Z'
  };

  const apiKey: ApiKey = {
    id: 'key-1',
    name: 'Main key',
    prefix: 'mcp_abcd',
    expiresAt: '2026-05-01T00:00:00.000Z',
    status: 'active'
  };

  const createdKey: CreateApiKeyResponse = {
    id: 'key-1',
    name: 'Main key',
    key: 'mcp_secret',
    prefix: 'mcp_sec',
    expiresAt: '2026-05-01T00:00:00.000Z'
  };

  let service: {
    listTenants: jest.Mock<Tenant[], []>;
    createTenant: jest.Mock<Tenant, [CreateTenantRequest]>;
    listKeys: jest.Mock<ApiKey[], [string]>;
    createKey: jest.Mock<CreateApiKeyResponse, [string, { name: string; expiresIn?: string }]>;
    revokeKey: jest.Mock<void, [string, string]>;
  };
  let controller: AdminController;

  beforeEach(() => {
    service = {
      listTenants: jest.fn().mockReturnValue([tenant]),
      createTenant: jest.fn().mockReturnValue(tenant),
      listKeys: jest.fn().mockReturnValue([apiKey]),
      createKey: jest.fn().mockReturnValue(createdKey),
      revokeKey: jest.fn()
    };

    controller = new AdminController(service as unknown as AdminService);
  });

  it('lists tenants', () => {
    const response = controller.listTenants();
    expect(service.listTenants).toHaveBeenCalledTimes(1);
    expect(response.data).toEqual([tenant]);
  });

  it('creates tenant', () => {
    const req: CreateTenantRequest = { name: 'Tenant One', contact: 'owner@example.com' };
    const response = controller.createTenant(req);

    expect(service.createTenant).toHaveBeenCalledWith(req);
    expect(response.data.id).toBe('tenant-1');
  });

  it('lists api keys for tenant', () => {
    const response = controller.listKeys('tenant-1');

    expect(service.listKeys).toHaveBeenCalledWith('tenant-1');
    expect(response.data).toHaveLength(1);
  });

  it('creates api key for tenant', () => {
    const response = controller.createKey('tenant-1', { name: 'Main key', expiresIn: '30d' });

    expect(service.createKey).toHaveBeenCalledWith('tenant-1', {
      name: 'Main key',
      expiresIn: '30d'
    });
    expect(response.data.key).toBe('mcp_secret');
  });

  it('revokes api key', () => {
    const response = controller.revokeKey('tenant-1', 'key-1');

    expect(service.revokeKey).toHaveBeenCalledWith('tenant-1', 'key-1');
    expect(response.data.revoked).toBe(true);
  });
});
