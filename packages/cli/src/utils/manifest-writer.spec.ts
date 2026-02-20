import { join } from 'node:path';

import type { IR } from '@sga/core';

import { writeManifest } from './manifest-writer';

const mockFs = {
  writeFile: jest.fn().mockResolvedValue(undefined)
};

const ir: IR = {
  system: {
    code: 'pet-store',
    baseUrl: 'https://petstore.example.com',
    authType: 'bearer'
  },
  tools: [
    {
      name: 'list_pets',
      description: 'List all pets',
      method: 'GET',
      path: '/pets',
      params: [],
      needsConfirmation: false,
      isAsync: false
    },
    {
      name: 'create_pet',
      description: 'Create a pet',
      method: 'POST',
      path: '/pets',
      params: [],
      needsConfirmation: false,
      isAsync: false
    }
  ]
};

describe('writeManifest', () => {
  beforeEach(() => {
    mockFs.writeFile.mockClear();
  });

  it('writes manifest.json with correct shape', async () => {
    await writeManifest('/output/dir', ir, mockFs as never);

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      join('/output/dir', 'manifest.json'),
      expect.stringContaining('"name"'),
      'utf8'
    );

    const written = JSON.parse(String(mockFs.writeFile.mock.calls[0]?.[1] ?? '{}')) as Record<
      string,
      unknown
    >;
    expect(written.name).toBe('mcp-server-pet-store');
    expect(written.version).toBe('1.0.0');
    expect(written.toolsCount).toBe(2);
    expect(written.credentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'PET_STORE_API_KEY', required: true })
      ])
    );
  });
});
