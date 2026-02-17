import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let service: {
    login: jest.Mock<
      { token: string; user: { id: string; username: string; role: 'admin' | 'user' } },
      [string, string]
    >;
    getMe: jest.Mock<{ id: string; username: string; role: 'admin' | 'user' }, [string]>;
  };
  let controller: AuthController;

  beforeEach(() => {
    service = {
      login: jest.fn().mockReturnValue({
        token: 'mcp_token_123',
        user: { id: 'u_admin', username: 'admin', role: 'admin' }
      }),
      getMe: jest.fn().mockReturnValue({ id: 'u_admin', username: 'admin', role: 'admin' })
    };
    controller = new AuthController(service as unknown as AuthService);
  });

  it('returns login response wrapper', () => {
    const response = controller.login({ username: 'admin', password: 'admin123' });

    expect(service.login).toHaveBeenCalledWith('admin', 'admin123');
    expect(response.code).toBe(0);
    expect(response.data.token).toBe('mcp_token_123');
  });

  it('returns current user from bearer token', () => {
    const response = controller.getMe('Bearer mcp_token_123');

    expect(service.getMe).toHaveBeenCalledWith('mcp_token_123');
    expect(response.data.username).toBe('admin');
  });

  it('throws for missing bearer format', () => {
    expect(() => controller.getMe('mcp_token_123')).toThrow(UnauthorizedException);
  });
});
