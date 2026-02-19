import { randomBytes } from 'node:crypto';
import type { LoginResponse, User } from '@sga/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly tokenStore = new Map<string, User>();

  public login(username: string, password: string): LoginResponse {
    if (username !== 'admin' || password !== 'admin123') {
      throw new UnauthorizedException('Invalid username or password');
    }

    const user: User = {
      id: 'u_admin',
      username: 'admin',
      role: 'admin'
    };
    const token = `mcp_${randomBytes(16).toString('hex')}`;

    this.tokenStore.set(token, user);
    return { token, user };
  }

  public getMe(token: string): User {
    const user = this.tokenStore.get(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }
}
