import { DataSource, DataSourceOptions } from 'typeorm';
import { Env } from '../config/env.schema';

export function createDataSourceOptions(env: Pick<Env, 'DATABASE_URL'>): DataSourceOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
    logging: false
  };
}

export function createDataSource(env: Pick<Env, 'DATABASE_URL'>): DataSource {
  return new DataSource(createDataSourceOptions(env));
}
