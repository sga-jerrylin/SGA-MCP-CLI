import { assertOpenApiDocument } from './openapi-adapter';

describe('openapi adapter contract', () => {
  it('rejects documents without paths', () => {
    expect(() => assertOpenApiDocument({ openapi: '3.0.0' })).toThrow('OPENAPI_PATHS_REQUIRED');
  });
});
