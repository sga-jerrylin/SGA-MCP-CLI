import { RedisService } from './redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue('value'),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK')
  }));
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    service = new RedisService('redis://localhost:6379');
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should ping and return PONG', async () => {
    const result = await service.ping();
    expect(result).toBe('PONG');
  });

  it('should get a value', async () => {
    const result = await service.get('test-key');
    expect(result).toBe('value');
  });

  it('should set a value', async () => {
    await expect(service.set('key', 'val')).resolves.not.toThrow();
  });

  it('should set a value with TTL', async () => {
    await expect(service.set('key', 'val', 60)).resolves.not.toThrow();
  });

  it('should delete a key', async () => {
    const result = await service.del('key');
    expect(result).toBe(1);
  });

  it('should expose the raw client', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
  });
});
