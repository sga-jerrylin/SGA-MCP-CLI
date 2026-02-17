import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { DeployModule } from './deploy/deploy.module';
import { GeneratorModule } from './generator/generator.module';
import { HealthController } from './health/health.controller';
import { MonitorModule } from './monitor/monitor.module';
import { RedisModule } from './redis/redis.module';
import { RepoModule } from './repo/repo.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    RepoModule,
    SyncModule,
    AdminModule,
    DeployModule,
    RuntimeModule,
    AuthModule,
    GeneratorModule,
    MonitorModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
