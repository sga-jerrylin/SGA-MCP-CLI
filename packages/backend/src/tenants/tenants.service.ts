import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>
  ) {}

  async create(name: string): Promise<TenantEntity> {
    const tenant = this.repo.create({ name });
    return this.repo.save(tenant);
  }

  async findAll(): Promise<TenantEntity[]> {
    return this.repo.find();
  }

  async findById(id: string): Promise<TenantEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async deactivate(id: string): Promise<void> {
    await this.repo.update(id, { isActive: false });
  }
}
