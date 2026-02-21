import { BuilderAgent } from './builder.agent';

describe('BuilderAgent', () => {
  it('runs codegen, writes files and installs dependencies', async () => {
    const adapter = {
      run: jest.fn().mockResolvedValue({ files: [{ path: 'client.ts', content: 'x' }] })
    };
    const writer = { write: jest.fn().mockResolvedValue(['C:/repo/client.ts']) };
    const installer = { install: jest.fn().mockResolvedValue(undefined) };

    const agent = new BuilderAgent({
      adapter: adapter as any,
      writer: writer as any,
      installer: installer as any
    });
    const result = await agent.run({ root: 'C:/repo', planDoc: '# doc' });

    expect(adapter.run).toHaveBeenCalledWith('# doc');
    expect(writer.write).toHaveBeenCalledTimes(1);
    expect(installer.install).toHaveBeenCalledWith('C:/repo');
    expect(result.writtenFiles).toHaveLength(1);
  });

  it('prefers deterministic template rendering when planDoc is valid IR JSON', async () => {
    const adapter = { run: jest.fn() };
    const writer = { write: jest.fn().mockResolvedValue(['C:/repo/src/server.ts']) };
    const installer = { install: jest.fn().mockResolvedValue(undefined) };
    const agent = new BuilderAgent({
      adapter: adapter as any,
      writer: writer as any,
      installer: installer as any
    });

    const planDoc = JSON.stringify({
      system: {
        code: 'demo-api',
        baseUrl: 'https://api.example.com',
        authType: 'none'
      },
      tools: [
        {
          name: 'list_items',
          description: 'List items',
          method: 'GET',
          path: '/items',
          needsConfirmation: false,
          isAsync: false,
          params: []
        }
      ]
    });

    const result = await agent.run({ root: 'C:/repo', planDoc });

    expect(adapter.run).not.toHaveBeenCalled();
    expect(writer.write).toHaveBeenCalledTimes(1);
    const filesArg = writer.write.mock.calls[0][1] as Array<{ path: string; content: string }>;
    expect(filesArg.map((file) => file.path)).toEqual([
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/http-client.ts',
      'src/server.ts',
      'manifest.json'
    ]);
    expect(installer.install).toHaveBeenCalledWith('C:/repo');
    expect(result.writtenFiles).toEqual(['C:/repo/src/server.ts']);
  });
});
