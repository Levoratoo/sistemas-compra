import type { UserRole } from '@prisma/client';

export type DbAuthUser = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export type ResolvedAuth = {
  userId: string;
  email: string;
  role: UserRole;
};

/**
 * Constrói o contexto de autenticação a partir do utilizador no banco.
 * O papel no JWT é ignorado — só o registo atual importa.
 */
export function resolveAuthFromDbUser(
  user: DbAuthUser | null,
): { ok: true; auth: ResolvedAuth } | { ok: false; reason: 'missing' | 'inactive' } {
  if (!user) {
    return { ok: false, reason: 'missing' };
  }
  if (!user.isActive) {
    return { ok: false, reason: 'inactive' };
  }
  return {
    ok: true,
    auth: {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
  };
}
