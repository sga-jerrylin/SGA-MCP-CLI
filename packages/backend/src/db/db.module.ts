import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/config.service';
import { createDataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        return createDataSourceOptions({
          DATABASE_URL: config.get('DATABASE_URL')
        });
      }
    })
  ]
})
export class DbModule {}
