import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from './config/config.module';
import { DeployModule } from './deploy/deploy.module';
import { HealthController } from './health/health.controller';
import { RepoModule } from './repo/repo.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [ConfigModule, RepoModule, SyncModule, AdminModule, DeployModule, RuntimeModule],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
