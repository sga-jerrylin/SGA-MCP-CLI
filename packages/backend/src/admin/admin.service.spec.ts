import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('lists and creates tenants', () => {
    const service = new AdminService();
    const before = service.listTenants().length;
    const created = service.createTenant({
      name: 'Tenant Two',
      contact: 'owner2@example.com'
    });
    const after = service.listTenants().length;

    expect(created.name).toBe('Tenant Two');
    expect(after).toBe(before + 1);
  });

  it('creates and revokes api keys', () => {
    const service = new AdminService();
    const tenant = service.createTenant({
      name: 'Key Tenant',
      contact: 'keys@example.com'
    });

    const createdKey = service.createKey(tenant.id, { name: 'CI Key', expiresIn: '24h' });
    const listedBeforeRevoke = service.listKeys(tenant.id);

    expect(createdKey.key.startsWith('mcp_')).toBe(true);
    expect(listedBeforeRevoke).toHaveLength(1);
    expect(listedBeforeRevoke[0].status).toBe('active');

    service.revokeKey(tenant.id, listedBeforeRevoke[0].id);
    const listedAfterRevoke = service.listKeys(tenant.id);

    expect(listedAfterRevoke[0].status).toBe('revoked');
  });
});
