import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  findMany() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({
      data: {
        ...data,
        email: normalizeEmail(data.email),
      },
    });
  }

  update(id: string, data: Prisma.UserUncheckedUpdateInput) {
    const payload: Prisma.UserUncheckedUpdateInput = { ...data };

    if (typeof payload.email === 'string') {
      payload.email = normalizeEmail(payload.email);
    }

    return prisma.user.update({ where: { id }, data: payload });
  }
}

export const userRepository = new UserRepository();
