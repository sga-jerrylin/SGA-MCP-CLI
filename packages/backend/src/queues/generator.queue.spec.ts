import { GeneratorQueueProducer, GeneratorJobData, GENERATOR_QUEUE } from './generator.queue';
import { Queue } from 'bullmq';

describe('GeneratorQueueProducer', () => {
  let producer: GeneratorQueueProducer;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1', name: 'generate' }),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 5 })
    } as any;

    producer = new GeneratorQueueProducer(mockQueue);
  });

  it('should have correct queue name constant', () => {
    expect(GENERATOR_QUEUE).toBe('generator');
  });

  it('should enqueue a generation job', async () => {
    const data: GeneratorJobData = {
      tenantId: 'tenant-1',
      serverId: 'server-1',
      prompt: 'Generate something'
    };

    const result = await producer.enqueueGeneration(data);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'generate',
      data,
      expect.objectContaining({
        removeOnComplete: 100,
        removeOnFail: 500
      })
    );
    expect(result).toHaveProperty('id', 'job-1');
  });

  it('should pass priority and delay options', async () => {
    const data: GeneratorJobData = {
      tenantId: 'tenant-1',
      serverId: 'server-1',
      prompt: 'test'
    };

    await producer.enqueueGeneration(data, { priority: 1, delay: 5000 });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'generate',
      data,
      expect.objectContaining({
        priority: 1,
        delay: 5000
      })
    );
  });

  it('should get job counts', async () => {
    const counts = await producer.getJobCounts();
    expect(counts).toHaveProperty('waiting', 0);
    expect(counts).toHaveProperty('completed', 5);
  });
});
