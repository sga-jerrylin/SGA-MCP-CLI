import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CredentialEntity } from './entities/credential.entity';
import { encryptAes256Gcm, decryptAes256Gcm } from './crypto/vault-crypto';

export interface SetCredentialInput {
  tenantId: string;
  serverId: string;
  keyName: string;
  plaintext: string;
  keyVersion: number;
}

@Injectable()
export class AuthVaultService {
  constructor(
    @InjectRepository(CredentialEntity)
    private readonly repo: Repository<CredentialEntity>,
    private readonly masterKey: Buffer
  ) {}

  async setCredential(input: SetCredentialInput): Promise<CredentialEntity> {
    const { tenantId, serverId, keyName, plaintext, keyVersion } = input;
    const aad = Buffer.from(JSON.stringify({ tenantId, serverId, keyName, keyVersion }));

    const { ciphertext, iv, authTag } = encryptAes256Gcm({
      key: this.masterKey,
      plaintext: Buffer.from(plaintext, 'utf-8'),
      aad
    });

    // Upsert: find existing or create new
    let credential = await this.repo.findOneBy({ tenantId, serverId, keyName });

    if (credential) {
      credential.encryptedValue = ciphertext;
      credential.encryptionIv = iv;
      credential.authTag = authTag;
      credential.keyVersion = keyVersion;
    } else {
      credential = this.repo.create({
        tenantId,
        serverId,
        keyName,
        encryptedValue: ciphertext,
        encryptionIv: iv,
        authTag,
        keyVersion
      });
    }

    return this.repo.save(credential);
  }

  async getCredentialPlaintext(
    tenantId: string,
    serverId: string,
    keyName: string
  ): Promise<string | null> {
    const credential = await this.repo.findOneBy({ tenantId, serverId, keyName });
    if (!credential) return null;

    const aad = Buffer.from(
      JSON.stringify({
        tenantId: credential.tenantId,
        serverId: credential.serverId,
        keyName: credential.keyName,
        keyVersion: credential.keyVersion
      })
    );

    const plaintext = decryptAes256Gcm({
      key: this.masterKey,
      ciphertext: credential.encryptedValue,
      iv: credential.encryptionIv,
      authTag: credential.authTag,
      aad
    });

    return plaintext.toString('utf-8');
  }

  async deleteCredential(tenantId: string, serverId: string, keyName: string): Promise<boolean> {
    const result = await this.repo.delete({ tenantId, serverId, keyName });
    return (result.affected ?? 0) > 0;
  }
}
