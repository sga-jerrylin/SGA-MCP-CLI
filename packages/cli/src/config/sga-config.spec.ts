import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { SgaConfig } from './sga-config';

describe('SgaConfig', () => {
  it('supports set/get with dot notation', () => {
    const root = mkdtempSync(join(tmpdir(), 'sga-config-'));
    const configPath = join(root, 'config.yaml');

    try {
      const config = new SgaConfig(configPath);
      config.set('model.coder', 'openai/gpt-5.2-codex');
      config.set('runtime.maxRetries', 3);
      config.set('flags.dryRun', true);

      expect(config.get('model.coder')).toBe('openai/gpt-5.2-codex');
      expect(config.get('runtime.maxRetries')).toBe(3);
      expect(config.get('flags.dryRun')).toBe(true);

      const reloaded = new SgaConfig(configPath);
      expect(reloaded.get('model.coder')).toBe('openai/gpt-5.2-codex');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns empty object when config file does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'sga-config-missing-'));
    const configPath = join(root, 'config.yaml');

    try {
      const config = new SgaConfig(configPath);
      expect(config.getAll()).toEqual({});
      expect(config.get('model.coder')).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
