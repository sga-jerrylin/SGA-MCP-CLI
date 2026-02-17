import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptResult {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface EncryptOptions {
  key: Buffer;
  plaintext: Buffer;
  aad: Buffer;
}

export interface DecryptOptions {
  key: Buffer;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  aad: Buffer;
}

export function encryptAes256Gcm(opts: EncryptOptions): EncryptResult {
  if (opts.key.length !== 32) {
    throw new Error('Key must be 32 bytes for AES-256-GCM');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', opts.key, iv);
  cipher.setAAD(opts.aad);
  const ciphertext = Buffer.concat([cipher.update(opts.plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptAes256Gcm(opts: DecryptOptions): Buffer {
  if (opts.key.length !== 32) {
    throw new Error('Key must be 32 bytes for AES-256-GCM');
  }
  const decipher = createDecipheriv('aes-256-gcm', opts.key, opts.iv);
  decipher.setAuthTag(opts.authTag);
  decipher.setAAD(opts.aad);
  return Buffer.concat([decipher.update(opts.ciphertext), decipher.final()]);
}
