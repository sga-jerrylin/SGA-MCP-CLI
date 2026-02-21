import { EventEmitter } from 'node:events';

import { IntegrationTester } from './integration-tester';

function frame(message: object): Buffer {
  const body = JSON.stringify(message);
  return Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

describe('IntegrationTester', () => {
  it('installs, builds, then runs initialize -> initialized -> tools/list over stdio', async () => {
    const mockExec = jest.fn().mockResolvedValue({ stdout: 'ok' });
    const writes: Buffer[] = [];
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const kill = jest.fn();

    const stdin = {
      write: jest.fn((chunk: Buffer) => {
        writes.push(Buffer.from(chunk));
        const payload = chunk.toString('utf8');

        if (payload.includes('"id":1') && payload.includes('"method":"initialize"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 1,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'demo', version: '1.0.0' }
              }
            })
          );
        }

        if (payload.includes('"id":2') && payload.includes('"method":"tools/list"')) {
          stdout.emit(
            'data',
            frame({
              jsonrpc: '2.0',
              id: 2,
              result: {
                tools: [{ name: 'list_pets' }, { name: 'get_pet' }]
              }
            })
          );
        }

        return true;
      })
    };

    const mockSpawn = jest.fn().mockReturnValue({
      pid: 1234,
      kill,
      stdin,
      stdout,
      stderr
    });

    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: mockSpawn as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://api.example.com',
      authEnv: { API_KEY: 'test-key' }
    });

    expect(result.passed).toBe(true);
    expect(result.toolsFound).toBe(2);
    expect(result.toolsCalled).toEqual([]);
    expect(mockExec).toHaveBeenNthCalledWith(
      1,
      'npm install',
      expect.objectContaining({ cwd: '/output/generated', timeout: 120_000 })
    );
    expect(mockExec).toHaveBeenNthCalledWith(
      2,
      'npm run build',
      expect.objectContaining({ cwd: '/output/generated', timeout: 120_000 })
    );
    expect(mockSpawn).toHaveBeenCalledWith(
      'node',
      ['dist/index.js'],
      expect.objectContaining({
        cwd: '/output/generated',
        windowsHide: true
      })
    );
    expect(writes).toHaveLength(3);
    const sent = writes.map((buffer) => buffer.toString('utf8'));
    expect(sent[0]).toContain('"method":"initialize"');
    expect(sent[1]).toContain('"method":"notifications/initialized"');
    expect(sent[2]).toContain('"method":"tools/list"');
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('returns failed report if install or build fails', async () => {
    const mockExec = jest.fn().mockRejectedValueOnce(new Error('tsc error'));
    const tester = new IntegrationTester({
      exec: mockExec,
      spawn: jest.fn() as never,
      startupWaitMs: 0
    });

    const result = await tester.run({
      dir: '/output/generated',
      baseUrl: 'https://x.com',
      authEnv: {}
    });

    expect(result.passed).toBe(false);
    expect(result.error).toContain('tsc error');
  });
});
