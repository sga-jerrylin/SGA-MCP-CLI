import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/config.service';
import { AuthVaultService } from './auth-vault.service';
import { CredentialEntity } from './entities/credential.entity';

function loadMasterKey(config: AppConfigService): Buffer {
  const filePath = config.get('MASTER_KEY_FILE');
  const raw = readFileSync(filePath);
  const text = raw.toString('utf8').trim();

  if (/^[0-9a-fA-F]{64}$/.test(text)) {
    return Buffer.from(text, 'hex');
  }

  const utf8 = Buffer.from(text, 'utf8');
  if (utf8.length === 32) {
    return utf8;
  }

  return raw;
}

export const VAULT_MASTER_KEY = 'VAULT_MASTER_KEY';

@Module({
  imports: [TypeOrmModule.forFeature([CredentialEntity])],
  providers: [
    {
      provide: VAULT_MASTER_KEY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => loadMasterKey(config)
    },
    AuthVaultService
  ],
  exports: [AuthVaultService]
})
export class AuthVaultModule {}
