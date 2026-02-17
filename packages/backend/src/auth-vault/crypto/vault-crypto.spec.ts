import { randomBytes } from 'crypto';
import { encryptAes256Gcm, decryptAes256Gcm } from './vault-crypto';

describe('vault-crypto', () => {
  const key = randomBytes(32);
  const plaintext = Buffer.from('super-secret-api-key-12345');
  const aad = Buffer.from(
    JSON.stringify({ tenantId: 't1', serverId: 's1', keyName: 'k1', keyVersion: 1 })
  );

  describe('encryptAes256Gcm', () => {
    it('should return ciphertext, iv, and authTag', () => {
      const result = encryptAes256Gcm({ key, plaintext, aad });

      expect(result.ciphertext).toBeInstanceOf(Buffer);
      expect(result.iv).toBeInstanceOf(Buffer);
      expect(result.authTag).toBeInstanceOf(Buffer);
      expect(result.iv.length).toBe(12);
      expect(result.authTag.length).toBe(16);
      expect(result.ciphertext.toString()).not.toBe(plaintext.toString());
    });

    it('should reject invalid key length', () => {
      expect(() => encryptAes256Gcm({ key: Buffer.alloc(16), plaintext, aad })).toThrow(
        'Key must be 32 bytes'
      );
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('should decrypt back to original plaintext', () => {
      const encrypted = encryptAes256Gcm({ key, plaintext, aad });
      const decrypted = decryptAes256Gcm({
        key,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        aad
      });

      expect(decrypted.toString()).toBe(plaintext.toString());
    });

    it('should fail with wrong AAD', () => {
      const encrypted = encryptAes256Gcm({ key, plaintext, aad });
      const wrongAad = Buffer.from('wrong-aad');

      expect(() =>
        decryptAes256Gcm({
          key,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          aad: wrongAad
        })
      ).toThrow();
    });

    it('should fail with wrong key', () => {
      const encrypted = encryptAes256Gcm({ key, plaintext, aad });
      const wrongKey = randomBytes(32);

      expect(() =>
        decryptAes256Gcm({
          key: wrongKey,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          aad
        })
      ).toThrow();
    });

    it('should fail with tampered ciphertext', () => {
      const encrypted = encryptAes256Gcm({ key, plaintext, aad });
      const tampered = Buffer.from(encrypted.ciphertext);
      tampered[0] ^= 0xff;

      expect(() =>
        decryptAes256Gcm({
          key,
          ciphertext: tampered,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          aad
        })
      ).toThrow();
    });
  });
});
