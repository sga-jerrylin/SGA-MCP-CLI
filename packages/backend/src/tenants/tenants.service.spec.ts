import { TenantsService } from './tenants.service';
import { TenantEntity } from './entities/tenant.entity';
import { Repository } from 'typeorm';

describe('TenantsService', () => {
  let service: TenantsService;
  let repo: jest.Mocked<Repository<TenantEntity>>;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn()
    } as any;
    service = new TenantsService(repo);
  });

  it('should create a tenant', async () => {
    const tenant = { id: '1', name: 'test-org', isActive: true } as TenantEntity;
    repo.create.mockReturnValue(tenant);
    repo.save.mockResolvedValue(tenant);

    const result = await service.create('test-org');

    expect(repo.create).toHaveBeenCalledWith({ name: 'test-org' });
    expect(repo.save).toHaveBeenCalledWith(tenant);
    expect(result.name).toBe('test-org');
  });

  it('should list all tenants', async () => {
    const tenants = [
      { id: '1', name: 'org-a' } as TenantEntity,
      { id: '2', name: 'org-b' } as TenantEntity
    ];
    repo.find.mockResolvedValue(tenants);

    const result = await service.findAll();
    expect(result).toHaveLength(2);
  });

  it('should find tenant by id', async () => {
    const tenant = { id: '1', name: 'org-a' } as TenantEntity;
    repo.findOneBy.mockResolvedValue(tenant);

    const result = await service.findById('1');
    expect(result).toEqual(tenant);
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' });
  });

  it('should deactivate a tenant', async () => {
    repo.update.mockResolvedValue({ affected: 1 } as any);

    await service.deactivate('1');
    expect(repo.update).toHaveBeenCalledWith('1', { isActive: false });
  });
});
