import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppConfigService } from '../config/config.service';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: (config: AppConfigService) => {
        return new RedisService(config.get('REDIS_URL'));
      },
      inject: [AppConfigService]
    }
  ],
  exports: [RedisService]
})
export class RedisModule {}
