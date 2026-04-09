import type { UserRole } from '@prisma/client';

import { logger } from '../config/logger.js';
import { userRepository } from '../repositories/user.repository.js';
import { hashPassword } from './auth.service.js';

type DemoUser = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

const demoUsers: DemoUser[] = [
  { email: 'admin@sitecompras.local', password: 'Admin@123', name: 'Administrador', role: 'ADMIN' },
  { email: 'usuario@sitecompras.local', password: 'Usuario@123', name: 'Usuario operacional', role: 'USER' },
  { email: 'aprovador@sitecompras.local', password: 'Aprovador@123', name: 'Aprovador', role: 'APPROVER' },
  { email: 'supervisora@sitecompras.local', password: 'Supervisora@123', name: 'Supervisora', role: 'SUPERVISOR' },
];

function shouldAutoEnsureDemoUsers() {
  const raw = process.env.DEMO_USERS_AUTOSEED?.trim().toLowerCase();

  if (raw === 'false' || raw === '0' || raw === 'off') {
    return false;
  }

  if (raw === 'true' || raw === '1' || raw === 'on') {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
}

export async function ensureDemoUsers() {
  if (!shouldAutoEnsureDemoUsers()) {
    return;
  }

  for (const demoUser of demoUsers) {
    const existing = await userRepository.findByEmail(demoUser.email);
    const passwordHash = await hashPassword(demoUser.password);

    if (!existing) {
      await userRepository.create({
        email: demoUser.email,
        name: demoUser.name,
        role: demoUser.role,
        passwordHash,
        isActive: true,
      });
      continue;
    }

    await userRepository.update(existing.id, {
      name: demoUser.name,
      role: demoUser.role,
      passwordHash,
      isActive: true,
    });
  }

  logger.info('Usuarios demo garantidos para o ambiente atual.');
}
