import { CoreCodegenAdapter } from './core-codegen.adapter';

describe('CoreCodegenAdapter', () => {
  it('delegates markdown generation to McpClawCore', async () => {
    const core = {
      generate: jest.fn().mockResolvedValue({ manifestPath: '/tmp/manifest.json' })
    };

    const adapter = new CoreCodegenAdapter(core as any);
    const result = await adapter.run('# API DOC');

    expect(core.generate).toHaveBeenCalledWith({ kind: 'markdown', content: '# API DOC' });
    expect(result).toHaveProperty('manifestPath');
  });
});
