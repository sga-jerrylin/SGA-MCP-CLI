import { createDataSourceOptions } from './data-source';

describe('DbModule', () => {
  it('should create data source options from env', () => {
    const opts = createDataSourceOptions({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb'
    });

    expect(opts.type).toBe('postgres');
    expect((opts as any).url).toBe('postgres://user:pass@localhost:5432/testdb');
    expect(opts.synchronize).toBe(false);
  });

  it('should point entities to **/*.entity pattern', () => {
    const opts = createDataSourceOptions({
      DATABASE_URL: 'postgres://localhost/test'
    });

    expect(opts.entities).toBeDefined();
    expect(Array.isArray(opts.entities)).toBe(true);
    expect((opts.entities as string[])[0]).toContain('.entity');
  });
});
