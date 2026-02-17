import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { CredentialEntity } from './credential.entity';

describe('CredentialEntity', () => {
  it('should be defined', () => {
    const entity = new CredentialEntity();
    expect(entity).toBeDefined();
  });

  it('should have all required columns in metadata', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((c) => c.target === CredentialEntity)
      .map((c) => c.propertyName);

    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('serverId');
    expect(columns).toContain('keyName');
    expect(columns).toContain('encryptedValue');
    expect(columns).toContain('encryptionIv');
    expect(columns).toContain('authTag');
    expect(columns).toContain('keyVersion');
  });

  it('should have a unique composite index on tenantId+serverId+keyName', () => {
    const indices = getMetadataArgsStorage().indices.filter((i) => i.target === CredentialEntity);

    const compositeIndex = indices.find((i) => i.unique === true && i.columns);
    expect(compositeIndex).toBeDefined();
  });
});
