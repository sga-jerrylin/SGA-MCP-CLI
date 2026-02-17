import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { DataSource } from 'typeorm';

export const TENANT_HEADER = 'x-tenant-id';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers[TENANT_HEADER];

    if (!tenantId) {
      throw new BadRequestException(`Missing required header: ${TENANT_HEADER}`);
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new BadRequestException(`Invalid tenant ID format: ${TENANT_HEADER} must be a UUID`);
    }

    // Store tenant ID on request for downstream use
    request.tenantId = tenantId;

    return from(this.dataSource.query('SET LOCAL app.current_tenant_id = $1', [tenantId])).pipe(
      switchMap(() => next.handle())
    );
  }
}
