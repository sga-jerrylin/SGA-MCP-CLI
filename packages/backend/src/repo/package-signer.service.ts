import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PackageSignerService {
  public sign(tarball: Buffer, secret: string): string {
    return createHmac('sha256', secret).update(tarball).digest('hex');
  }

  public verify(tarball: Buffer, signature: string, secret: string): boolean {
    const expected = this.sign(tarball, secret);
    const actualBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
