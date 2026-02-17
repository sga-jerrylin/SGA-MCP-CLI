import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly client: Minio.Client;

  constructor(config: {
    endPoint: string;
    accessKey: string;
    secretKey: string;
    useSSL?: boolean;
    port?: number;
  }) {
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      useSSL: config.useSSL ?? false,
      port: config.port ?? 9000
    });
  }

  async onModuleInit() {
    // Optionally verify connection on startup
  }

  getClient(): Minio.Client {
    return this.client;
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }

  async putObject(bucket: string, key: string, body: Buffer): Promise<unknown> {
    return this.client.putObject(bucket, key, body);
  }

  async getObject(bucket: string, key: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(bucket, key);
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    return this.client.removeObject(bucket, key);
  }

  async statObject(bucket: string, key: string): Promise<Minio.BucketItemStat> {
    return this.client.statObject(bucket, key);
  }
}
