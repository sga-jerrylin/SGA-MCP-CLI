import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { AppConfigService } from '../config/config.service';

@Global()
@Module({
  providers: [
    {
      provide: MinioService,
      useFactory: (config: AppConfigService) => {
        return new MinioService({
          endPoint: config.get('MINIO_ENDPOINT'),
          accessKey: config.get('MINIO_ACCESS_KEY'),
          secretKey: config.get('MINIO_SECRET_KEY')
        });
      },
      inject: [AppConfigService]
    }
  ],
  exports: [MinioService]
})
export class MinioModule {}
