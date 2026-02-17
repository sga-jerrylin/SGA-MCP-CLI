import { DeployService } from './deploy.service';

describe('DeployService', () => {
  it('returns deployment preview payload', () => {
    const service = new DeployService();
    const preview = service.preview({ serverIds: ['srv-1', 'srv-2'] });

    expect(preview.composeYaml).toContain('services:');
    expect(preview.servers).toHaveLength(2);
  });

  it('creates deploy task in pending status', () => {
    const service = new DeployService();
    const task = service.execute({ serverIds: ['srv-1'] });

    expect(task.status).toBe('pending');
    expect(task.serverIds).toEqual(['srv-1']);
  });
});
