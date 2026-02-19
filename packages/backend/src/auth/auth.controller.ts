import type { ApiResponse, LoginRequest, LoginResponse, User } from '@sga/shared';
import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post('login')
  public login(@Body() body: LoginRequest): ApiResponse<LoginResponse> {
    return {
      code: 0,
      message: 'ok',
      data: this.authService.login(body.username, body.password)
    };
  }

  @Get('me')
  public getMe(@Headers('authorization') authorization?: string): ApiResponse<User> {
    const token = this.extractBearerToken(authorization);
    return {
      code: 0,
      message: 'ok',
      data: this.authService.getMe(token)
    };
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    return authorization.slice('Bearer '.length).trim();
  }
}
