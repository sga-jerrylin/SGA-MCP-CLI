import { ToolRegistry } from './tool-registry';

describe('ToolRegistry', () => {
  it('registers and resolves tools by name', async () => {
    const registry = new ToolRegistry();
    registry.register('fs.scan', async () => ['a.md']);

    const tool = registry.get('fs.scan');
    await expect(tool?.({})).resolves.toEqual(['a.md']);
  });

  it('rejects duplicate tool registration', () => {
    const registry = new ToolRegistry();
    registry.register('fs.scan', async () => []);

    expect(() => registry.register('fs.scan', async () => [])).toThrow('duplicate tool');
  });
});
