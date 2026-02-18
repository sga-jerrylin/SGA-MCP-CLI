import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: {
    authorization?: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly pathWhitelist = new Set(['/api/auth/login', '/api/health', '/api/auth/me']);

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const method = (request.method ?? 'GET').toUpperCase();
    const path = this.normalizePath(request.originalUrl ?? request.url ?? '');

    if (this.isWhitelisted(path, method)) {
      return true;
    }

    const token = this.extractBearerToken(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    return true;
  }

  private isWhitelisted(path: string, method: string): boolean {
    if (path === '/api/auth/login') {
      return method === 'POST';
    }

    if (path === '/api/health') {
      return method === 'GET';
    }

    if (path.startsWith('/api/monitor/cli-runs')) {
      return method === 'POST' || method === 'GET';
    }

    if (path === '/api/monitor/tool-calls') {
      return method === 'POST';
    }

    return this.pathWhitelist.has(path);
  }

  private normalizePath(url: string): string {
    const queryIndex = url.indexOf('?');
    return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return '';
    }

    return authorization.slice('Bearer '.length).trim();
  }
}
