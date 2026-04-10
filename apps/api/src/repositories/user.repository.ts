import type { Prisma, UserRole } from '@prisma/client';

import { prisma } from '../config/prisma.js';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const releasedProjectsInclude = {
  releasedProjects: {
    include: {
      project: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

class UserRepository {
  /**
   * Contexto mínimo para cada requisição autenticada (sem releasedProjects).
   * O papel vem sempre daqui — nunca do payload do JWT.
   */
  findAuthContext(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: releasedProjectsInclude,
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: releasedProjectsInclude,
    });
  }

  findMany() {
    return prisma.user.findMany({
      include: releasedProjectsInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Primeiro utilizador ativo com o papel (ex.: aprovador para notificações). */
  findFirstActiveByRole(role: UserRole) {
    return prisma.user.findFirst({
      where: { role, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });
  }

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data: {
        ...data,
        email: normalizeEmail(data.email),
      },
      include: releasedProjectsInclude,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    const payload: Prisma.UserUpdateInput = { ...data };

    if (typeof payload.email === 'string') {
      payload.email = normalizeEmail(payload.email);
    }

    return prisma.user.update({
      where: { id },
      data: payload,
      include: releasedProjectsInclude,
    });
  }

  async hasReleasedProject(userId: string, projectId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        releasedProjects: {
          where: { projectId },
          select: { id: true },
        },
      },
    });

    return Boolean(user?.releasedProjects.length);
  }

  async listReleasedProjectIds(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        releasedProjects: {
          select: { projectId: true },
        },
      },
    });

    return (user?.releasedProjects ?? []).map((entry) => entry.projectId);
  }
}

export const userRepository = new UserRepository();
