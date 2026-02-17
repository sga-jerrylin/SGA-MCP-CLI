import { MinioService } from './minio.service';

// Mock minio
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(false),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue({ etag: 'abc123', versionId: null }),
    getObject: jest.fn().mockResolvedValue({ on: jest.fn(), read: jest.fn() }),
    removeObject: jest.fn().mockResolvedValue(undefined),
    statObject: jest.fn().mockResolvedValue({ size: 1024, etag: 'abc123' })
  }))
}));

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(() => {
    service = new MinioService({
      endPoint: 'localhost',
      accessKey: 'minioadmin',
      secretKey: 'minioadmin'
    });
  });

  it('should expose raw client', () => {
    expect(service.getClient()).toBeDefined();
  });

  it('should ensure bucket exists (create if not)', async () => {
    await service.ensureBucket('test-bucket');
    const client = service.getClient();
    expect(client.bucketExists).toHaveBeenCalledWith('test-bucket');
    expect(client.makeBucket).toHaveBeenCalledWith('test-bucket');
  });

  it('should put object', async () => {
    const body = Buffer.from('hello');
    const result = await service.putObject('bucket', 'key.txt', body);
    expect(service.getClient().putObject).toHaveBeenCalledWith('bucket', 'key.txt', body);
    expect(result).toHaveProperty('etag');
  });

  it('should get object', async () => {
    const stream = await service.getObject('bucket', 'key.txt');
    expect(service.getClient().getObject).toHaveBeenCalledWith('bucket', 'key.txt');
    expect(stream).toBeDefined();
  });

  it('should remove object', async () => {
    await service.removeObject('bucket', 'key.txt');
    expect(service.getClient().removeObject).toHaveBeenCalledWith('bucket', 'key.txt');
  });

  it('should stat object', async () => {
    const stat = await service.statObject('bucket', 'key.txt');
    expect(stat).toHaveProperty('size', 1024);
  });
});
