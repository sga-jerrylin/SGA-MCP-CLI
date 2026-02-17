import { randomBytes } from 'crypto';
import { AuthVaultService } from './auth-vault.service';
import { CredentialEntity } from './entities/credential.entity';
import { Repository } from 'typeorm';

describe('AuthVaultService', () => {
  let service: AuthVaultService;
  let repo: jest.Mocked<Repository<CredentialEntity>>;
  const masterKey = randomBytes(32);

  beforeEach(() => {
    repo = {
      create: jest.fn((data) => ({ id: 'cred-1', ...data }) as any),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      delete: jest.fn()
    } as any;

    service = new AuthVaultService(repo, masterKey);
  });

  describe('setCredential', () => {
    it('should encrypt and store a new credential', async () => {
      repo.findOneBy.mockResolvedValue(null);

      const result = await service.setCredential({
        tenantId: 'tenant-1',
        serverId: 'server-1',
        keyName: 'api_key',
        plaintext: 'sk-secret-12345',
        keyVersion: 1
      });

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.encryptedValue).toBeInstanceOf(Buffer);
      expect(result.encryptionIv).toBeInstanceOf(Buffer);
      expect(result.authTag).toBeInstanceOf(Buffer);
      // Encrypted value should NOT equal plaintext
      expect(result.encryptedValue.toString('utf-8')).not.toBe('sk-secret-12345');
    });

    it('should update an existing credential', async () => {
      const existing = {
        id: 'cred-1',
        tenantId: 'tenant-1',
        serverId: 'server-1',
        keyName: 'api_key',
        encryptedValue: Buffer.alloc(16),
        encryptionIv: Buffer.alloc(12),
        authTag: Buffer.alloc(16),
        keyVersion: 1
      } as CredentialEntity;
      repo.findOneBy.mockResolvedValue(existing);

      await service.setCredential({
        tenantId: 'tenant-1',
        serverId: 'server-1',
        keyName: 'api_key',
        plaintext: 'new-secret',
        keyVersion: 2
      });

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ keyVersion: 2 }));
    });
  });

  describe('getCredentialPlaintext', () => {
    it('should decrypt and return the original plaintext', async () => {
      // First store a credential
      repo.findOneBy.mockResolvedValueOnce(null);
      const stored = await service.setCredential({
        tenantId: 'tenant-1',
        serverId: 'server-1',
        keyName: 'api_key',
        plaintext: 'my-secret-value',
        keyVersion: 1
      });

      // Now mock findOneBy to return the stored credential
      repo.findOneBy.mockResolvedValueOnce(stored);

      const result = await service.getCredentialPlaintext('tenant-1', 'server-1', 'api_key');
      expect(result).toBe('my-secret-value');
    });

    it('should return null for non-existent credential', async () => {
      repo.findOneBy.mockResolvedValue(null);

      const result = await service.getCredentialPlaintext('tenant-x', 'server-x', 'nope');
      expect(result).toBeNull();
    });
  });

  describe('deleteCredential', () => {
    it('should delete and return true if found', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });
      const result = await service.deleteCredential('t1', 's1', 'k1');
      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      repo.delete.mockResolvedValue({ affected: 0, raw: [] });
      const result = await service.deleteCredential('t1', 's1', 'k1');
      expect(result).toBe(false);
    });
  });
});
