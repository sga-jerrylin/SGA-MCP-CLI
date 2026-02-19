import type { DeployPreview, DeployTask } from '@sga/shared';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';

describe('DeployController', () => {
  const preview: DeployPreview = {
    composeYaml: 'version: "3.9"\nservices:\n  s1:\n    image: x',
    nginxConf: 'location /s1/ { ... }',
    servers: [{ serverId: 's1', name: 'Server s1', port: 8081, toolCount: 20 }]
  };
  const task: DeployTask = {
    id: 'deploy-1',
    status: 'pending',
    serverIds: ['s1'],
    startedAt: '2026-02-01T00:00:00.000Z'
  };

  let service: {
    preview: jest.Mock<Promise<DeployPreview>, [{ serverIds: string[] }]>;
    execute: jest.Mock<Promise<DeployTask>, [{ serverIds: string[]; composeOverride?: string }]>;
    getTask: jest.Mock<DeployTask, [string]>;
  };
  let controller: DeployController;

  beforeEach(() => {
    service = {
      preview: jest.fn().mockResolvedValue(preview),
      execute: jest.fn().mockResolvedValue(task),
      getTask: jest.fn().mockReturnValue(task)
    };
    controller = new DeployController(service as unknown as DeployService);
  });

  it('builds preview from body serverIds', async () => {
    const response = await controller.preview({ serverIds: ['s1', 's2'] });

    expect(service.preview).toHaveBeenCalledWith({ serverIds: ['s1', 's2'] });
    expect(response.data.servers).toHaveLength(1);
  });

  it('delegates execute request', async () => {
    const response = await controller.execute({ serverIds: ['s1'] });

    expect(service.execute).toHaveBeenCalledWith({ serverIds: ['s1'] });
    expect(response.data.status).toBe('pending');
  });

  it('returns deploy task by id', () => {
    const response = controller.getTask('deploy-1');

    expect(service.getTask).toHaveBeenCalledWith('deploy-1');
    expect(response.data.id).toBe('deploy-1');
  });
});
