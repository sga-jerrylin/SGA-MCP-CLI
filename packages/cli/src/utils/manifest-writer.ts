import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import type { IR } from '@sga/core';

export interface ManifestCredential {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface Manifest {
  name: string;
  version: string;
  description: string;
  category: string;
  toolsCount: number;
  credentials: ManifestCredential[];
}

type FsLike = Pick<typeof fs, 'writeFile'>;

function toKebab(code: string): string {
  const normalized = code
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || 'generated';
}

function toUpperSnake(code: string): string {
  const normalized = code
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'SERVICE';
}

function buildCredentials(ir: IR): ManifestCredential[] {
  const service = toUpperSnake(ir.system.code);
  const creds: ManifestCredential[] = [];

  // Always declare base URL
  creds.push({
    key: `${service}_BASE_URL`,
    label: '服务地址',
    type: 'string',
    required: true,
    description: `${ir.system.code} 的 API 基础地址`
  });

  // Add API Key when auth is required
  if (ir.system.authType !== 'none') {
    creds.push({
      key: `${service}_API_KEY`,
      label: 'API Key',
      type: 'secret',
      required: true,
      description: `API key for ${ir.system.code}`
    });
  }

  return creds;
}

function buildManifest(ir: IR): Manifest {
  return {
    name: `mcp-server-${toKebab(ir.system.code)}`,
    version: '1.0.0',
    description: `MCP server for ${ir.system.code} API`,
    category: 'api',
    toolsCount: ir.tools.length,
    credentials: buildCredentials(ir)
  };
}

export async function writeManifest(
  outputDir: string,
  ir: IR,
  fsImpl: FsLike = fs
): Promise<string> {
  const manifest = buildManifest(ir);
  const path = join(outputDir, 'manifest.json');
  await fsImpl.writeFile(path, JSON.stringify(manifest, null, 2), 'utf8');
  return path;
}
