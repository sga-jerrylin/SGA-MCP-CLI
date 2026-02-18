import { Module } from '@nestjs/common';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';
import { DockerService } from './docker.service';
import { SyncModule } from '../sync/sync.module';
import { RuntimeModule } from '../runtime/runtime.module';
import { MinioModule } from '../storage/minio.module';

@Module({
  imports: [MinioModule, SyncModule, RuntimeModule],
  controllers: [DeployController],
  providers: [DeployService, DockerService],
  exports: [DeployService]
})
export class DeployModule {}
