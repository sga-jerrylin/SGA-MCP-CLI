import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './config.service';

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService()
    }
  ],
  exports: [AppConfigService]
})
export class ConfigModule {}
