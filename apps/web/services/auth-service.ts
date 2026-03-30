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
    skipAuth: true,
  });
  const token = typeof data.token === 'string' ? data.token.trim() : '';
  if (!token) {
    throw new Error('Resposta de login inválida: token em falta. Tente novamente.');
  }
  setStoredToken(token);
  return { ...data, token };
}

export async function fetchCurrentUser() {
  return apiRequest<AuthUser>('auth/me');
}

export function logoutClient() {
  setStoredToken(null);
}
