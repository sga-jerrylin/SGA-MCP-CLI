import { PackageSignerService } from './package-signer.service';

describe('PackageSignerService', () => {
  it('signs tarball with HMAC-SHA256', () => {
    const service = new PackageSignerService();
    const signature = service.sign(Buffer.from('test-data'), 'secret');

    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifies valid and invalid signatures', () => {
    const service = new PackageSignerService();
    const tarball = Buffer.from('test-data');
    const secret = 'secret';
    const signature = service.sign(tarball, secret);

    expect(service.verify(tarball, signature, secret)).toBe(true);
    expect(service.verify(tarball, `${signature}x`, secret)).toBe(false);
  });
});
