import { setStoredToken } from '@/lib/auth-storage';
import { apiRequest } from '@/services/api-client';
import type { AuthUser } from '@/types/api';

export type LoginResult = {
  token: string;
  user: AuthUser;
};

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  setStoredToken(null);
  const data = await apiRequest<LoginResult>('auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setStoredToken(data.token);
  return data;
}

export async function fetchCurrentUser() {
  return apiRequest<AuthUser>('auth/me');
}

export function logoutClient() {
  setStoredToken(null);
}
