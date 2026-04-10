import { apiRequest } from '@/services/api-client';
import type { AuthUser, UserRole } from '@/types/api';

export type CreateUserPayload = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  releasedProjectIds?: string[];
};

export type UpdateUserPayload = {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  releasedProjectIds?: string[];
};

export function listUsers() {
  return apiRequest<AuthUser[]>('users');
}

export function createUser(payload: CreateUserPayload) {
  return apiRequest<AuthUser>('users', {
    method: 'POST',
    body: payload,
  });
}

export function updateUser(userId: string, payload: UpdateUserPayload) {
  return apiRequest<AuthUser>(`users/${userId}`, {
    method: 'PATCH',
    body: payload,
  });
}
