import { Module } from '@nestjs/common';
import { MinioModule } from '../storage/minio.module';
import { PackageBuilderService } from './package-builder.service';
import { PackageSignerService } from './package-signer.service';
import { RepoController } from './repo.controller';
import { RepoService } from './repo.service';
import { SbomService } from './sbom.service';

@Module({
  imports: [MinioModule],
  controllers: [RepoController],
  providers: [RepoService, PackageBuilderService, PackageSignerService, SbomService],
  exports: [RepoService, PackageBuilderService, PackageSignerService, SbomService]
})
export class RepoModule {}
