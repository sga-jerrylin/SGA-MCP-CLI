import type { ApiResponse, LoginResponse } from '../../../shared/types/api.ts';
import { createLoginResponseFixture } from './contract-fixtures.ts';

const body = createLoginResponseFixture();

const typed: ApiResponse<LoginResponse> = body;
if (typed.code !== 0) {
  throw new Error('auth response code must be 0');
}
if (!typed.data.token || !typed.data.user?.id) {
  throw new Error('auth response missing token/user id');
}
