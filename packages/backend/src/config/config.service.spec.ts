import { AppConfigService } from './config.service';

describe('AppConfigService', () => {
  const validEnv = {
    PORT: '3000',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
    REDIS_URL: 'redis://localhost:6379',
    MINIO_ENDPOINT: 'localhost',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MASTER_KEY_FILE: '/path/to/master.key'
  };

  it('should parse valid env', () => {
    const config = new AppConfigService(validEnv);
    expect(config.get('PORT')).toBe(3000);
    expect(config.get('DATABASE_URL')).toBe(validEnv.DATABASE_URL);
    expect(config.get('REDIS_URL')).toBe(validEnv.REDIS_URL);
    expect(config.get('MINIO_ENDPOINT')).toBe(validEnv.MINIO_ENDPOINT);
    expect(config.get('MASTER_KEY_FILE')).toBe(validEnv.MASTER_KEY_FILE);
  });

  it('should throw on missing required env var', () => {
    expect(() => new AppConfigService({})).toThrow('Invalid environment variables');
  });

  it('should default PORT to 3000 if not provided', () => {
    const env = { ...validEnv };
    delete (env as Record<string, string | undefined>).PORT;
    const config = new AppConfigService(env);
    expect(config.get('PORT')).toBe(3000);
  });

  it('should return frozen env from getAll()', () => {
    const config = new AppConfigService(validEnv);
    const all = config.getAll();
    expect(Object.isFrozen(all)).toBe(true);
    expect(all.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });
});
