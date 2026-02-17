import { TenantContextInterceptor, TENANT_HEADER } from './tenant-context.interceptor';
import { BadRequestException, CallHandler, ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { of, lastValueFrom } from 'rxjs';

describe('TenantContextInterceptor', () => {
  let interceptor: TenantContextInterceptor;
  let mockDataSource: jest.Mocked<DataSource>;
  const validTenantId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue(undefined)
    } as any;

    interceptor = new TenantContextInterceptor(mockDataSource);
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const request = { headers, tenantId: undefined as string | undefined };
    return {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any;
  }

  function createMockHandler(): CallHandler {
    return {
      handle: () => of({ data: 'response' })
    };
  }

  it('should set tenant context via SET LOCAL before handler runs', async () => {
    const context = createMockContext({ [TENANT_HEADER]: validTenantId });
    const handler = createMockHandler();

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(mockDataSource.query).toHaveBeenCalledWith('SET LOCAL app.current_tenant_id = $1', [
      validTenantId
    ]);
    expect(result).toEqual({ data: 'response' });
  });

  it('should store tenantId on request object', async () => {
    const request = {
      headers: { [TENANT_HEADER]: validTenantId },
      tenantId: undefined as string | undefined
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any;
    const handler = createMockHandler();

    await lastValueFrom(interceptor.intercept(context, handler));

    expect(request.tenantId).toBe(validTenantId);
  });

  it('should throw BadRequestException when tenant header is missing', () => {
    const context = createMockContext({});
    const handler = createMockHandler();

    expect(() => interceptor.intercept(context, handler)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for invalid UUID format', () => {
    const context = createMockContext({ [TENANT_HEADER]: 'not-a-uuid' });
    const handler = createMockHandler();

    expect(() => interceptor.intercept(context, handler)).toThrow(BadRequestException);
  });
});
