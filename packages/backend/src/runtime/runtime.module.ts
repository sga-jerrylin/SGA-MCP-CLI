import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthVaultModule } from '../auth-vault/auth-vault.module';
import { CredentialEntity } from '../auth-vault/entities/credential.entity';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';
import { MinioModule } from '../storage/minio.module';

@Module({
  imports: [MinioModule, AuthVaultModule, TypeOrmModule.forFeature([CredentialEntity])],
  controllers: [RuntimeController],
  providers: [RuntimeService],
  exports: [RuntimeService]
})
export class RuntimeModule {}
