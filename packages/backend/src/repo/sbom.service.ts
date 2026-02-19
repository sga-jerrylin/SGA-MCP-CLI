import type { Package } from '@sga/shared';
import { Injectable } from '@nestjs/common';

export interface SpdxLite {
  spdxVersion: string;
  name: string;
  packages: Array<{ name: string; version: string }>;
}

@Injectable()
export class SbomService {
  public generate(pkg: Package): SpdxLite {
    return {
      spdxVersion: 'SPDX-2.3',
      name: `${pkg.name}@${pkg.version}`,
      packages: [{ name: pkg.name, version: pkg.version }]
    };
  }
}
