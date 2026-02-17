import { RuntimeService } from './runtime.service';

describe('RuntimeService', () => {
  it('lists servers without tool details', () => {
    const service = new RuntimeService();
    const servers = service.listServers();

    expect(servers.length).toBeGreaterThan(0);
    expect(servers[0]).not.toHaveProperty('tools');
  });

  it('gets server details by id', () => {
    const service = new RuntimeService();
    const detail = service.getServer('srv-1');

    expect(detail.id).toBe('srv-1');
    expect(detail.tools.length).toBeGreaterThan(0);
  });

  it('lists tools for specific server', () => {
    const service = new RuntimeService();
    const result = service.listTools('srv-1');

    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.tokenBudget).toBe(8000);
  });
});
