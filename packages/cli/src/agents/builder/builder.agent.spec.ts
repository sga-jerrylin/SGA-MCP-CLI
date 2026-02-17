import { BuilderAgent } from './builder.agent';

describe('BuilderAgent', () => {
  it('runs codegen, writes files and installs dependencies', async () => {
    const adapter = { run: jest.fn().mockResolvedValue({ files: [{ path: 'client.ts', content: 'x' }] }) };
    const writer = { write: jest.fn().mockResolvedValue(['C:/repo/client.ts']) };
    const installer = { install: jest.fn().mockResolvedValue(undefined) };

    const agent = new BuilderAgent({ adapter: adapter as any, writer: writer as any, installer: installer as any });
    const result = await agent.run({ root: 'C:/repo', planDoc: '# doc' });

    expect(adapter.run).toHaveBeenCalledWith('# doc');
    expect(writer.write).toHaveBeenCalledTimes(1);
    expect(installer.install).toHaveBeenCalledWith('C:/repo');
    expect(result.writtenFiles).toHaveLength(1);
  });
});
