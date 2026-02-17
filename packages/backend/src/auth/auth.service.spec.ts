import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('logs in admin and returns token with user', () => {
    const service = new AuthService();
    const result = service.login('admin', 'admin123');

    expect(result.token.startsWith('mcp_')).toBe(true);
    expect(result.user).toEqual({
      id: 'u_admin',
      username: 'admin',
      role: 'admin'
    });
  });

  it('throws on invalid password', () => {
    const service = new AuthService();
    expect(() => service.login('admin', 'wrong')).toThrow(UnauthorizedException);
  });

  it('returns current user by token', () => {
    const service = new AuthService();
    const { token } = service.login('admin', 'admin123');

    const user = service.getMe(token);
    expect(user.username).toBe('admin');
  });
});
