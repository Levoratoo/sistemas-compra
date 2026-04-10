import type { Notification, UserRole } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { toIsoString } from '../utils/date.js';
import { effectiveNextReplenishmentDate, isReplenishmentAttentionActive } from '../utils/replenishment-dates.js';

function serializeNotification(n: Notification) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: toIsoString(n.readAt),
    projectId: n.projectId,
    budgetItemId: n.budgetItemId,
    createdAt: toIsoString(n.createdAt),
    updatedAt: toIsoString(n.updatedAt),
  };
}

/**
 * Cria/atualiza notificações de “reposição em até 30 dias” e remove as que já não aplicam.
 */
async function syncReplenishmentDueSoon(userId: string, role: UserRole) {
  const projectFilter =
    role === 'SUPERVISOR' ? await userRepository.listReleasedProjectIds(userId) : null;

  if (projectFilter !== null && projectFilter.length === 0) {
    await prisma.notification.deleteMany({
      where: { userId, type: 'REPLENISHMENT_DUE_SOON' },
    });
    return;
  }

  const items = await prisma.budgetItem.findMany({
    where: {
      ...(projectFilter !== null ? { projectId: { in: projectFilter } } : {}),
      replenishmentCycleConfirmedAt: null,
      OR: [{ nextReplenishmentExpectedAt: { not: null } }, { opDeliveredAt: { not: null } }],
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      nextReplenishmentExpectedAt: true,
      opDeliveredAt: true,
      project: { select: { name: true } },
    },
  });

  const inWindowIds = new Set<string>();

  for (const it of items) {
    const eff = effectiveNextReplenishmentDate(it);
    if (eff && isReplenishmentAttentionActive(eff, 30)) {
      inWindowIds.add(it.id);
      const title = 'Atenção: reposição';
      const body = `${it.name} — ${it.project.name}. Já entrou na janela de reposição (30 dias antes até confirmar).`;

      await prisma.notification.upsert({
        where: {
          userId_type_budgetItemId: {
            userId,
            type: 'REPLENISHMENT_DUE_SOON',
            budgetItemId: it.id,
          },
        },
        create: {
          userId,
          type: 'REPLENISHMENT_DUE_SOON',
          title,
          body,
          projectId: it.projectId,
          budgetItemId: it.id,
        },
        update: {
          title,
          body,
        },
      });
    }
  }

  if (inWindowIds.size === 0) {
    await prisma.notification.deleteMany({
      where: { userId, type: 'REPLENISHMENT_DUE_SOON' },
    });
  } else {
    await prisma.notification.deleteMany({
      where: {
        userId,
        type: 'REPLENISHMENT_DUE_SOON',
        budgetItemId: { notIn: [...inWindowIds] },
      },
    });
  }
}

class NotificationService {
  async listForUser(userId: string, role: UserRole) {
    await syncReplenishmentDueSoon(userId, role);

    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    return rows.map(serializeNotification);
  }

  async markRead(userId: string, notificationId: string) {
    const row = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!row) {
      throw new AppError('Notificação não encontrada.', 404);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return serializeNotification(updated);
  }

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async unreadCount(userId: string, role: UserRole) {
    await syncReplenishmentDueSoon(userId, role);
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}

export const notificationService = new NotificationService();
