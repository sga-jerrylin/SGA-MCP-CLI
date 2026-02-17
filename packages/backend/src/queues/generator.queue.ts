import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const GENERATOR_QUEUE = 'generator';

export interface GeneratorJobData {
  tenantId: string;
  serverId: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class GeneratorQueueProducer {
  constructor(private readonly queue: Queue) {}

  async enqueueGeneration(data: GeneratorJobData, opts?: { priority?: number; delay?: number }) {
    return this.queue.add('generate', data, {
      priority: opts?.priority,
      delay: opts?.delay,
      removeOnComplete: 100,
      removeOnFail: 500
    });
  }

  async getJobCounts() {
    return this.queue.getJobCounts();
  }
}
