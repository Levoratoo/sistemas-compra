import type { ReplenishmentEvent, ReplenishmentRule } from '@prisma/client';

import { budgetItemRepository } from '../repositories/budget-item.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { purchaseRepository } from '../repositories/purchase.repository.js';
import type { ReplenishmentRuleAggregate } from '../repositories/replenishment.repository.js';
import { replenishmentRepository } from '../repositories/replenishment.repository.js';
import { AppError } from '../utils/app-error.js';
import { calculateNextReplenishmentDate } from '../utils/replenishment.js';
import {
  serializeBudgetItem,
  serializePurchaseOrderItem,
  serializeReplenishmentEvent,
  serializeReplenishmentRule,
} from '../utils/serializers.js';
import type { CreateReplenishmentRuleInput } from '../modules/replenishment/replenishment.schemas.js';

function getCurrentEventStatus(rule: ReplenishmentRule, event: ReplenishmentEvent | null) {
  if (!rule.isEnabled) {
    return 'DISABLED';
  }

  if (!event) {
    return 'PENDING_BASE_DATE';
  }

  if (event.completedDate) {
    return 'COMPLETED';
  }

  const now = new Date();
  const warningDate = new Date(event.plannedDate);
  warningDate.setDate(warningDate.getDate() - rule.warningDays);

  if (event.plannedDate.getTime() < now.getTime()) {
    return 'OVERDUE';
  }

  if (warningDate.getTime() <= now.getTime()) {
    return 'UPCOMING';
  }

  return 'SCHEDULED';
}

function buildReplenishmentRuleResponse(rule: ReplenishmentRuleAggregate) {
  const pendingEvent = rule.events.find((event) => !event.completedDate) ?? null;

  return {
    ...serializeReplenishmentRule(rule),
    status: getCurrentEventStatus(rule, pendingEvent),
    budgetItem: serializeBudgetItem(rule.budgetItem),
    nextEvent: pendingEvent ? serializeReplenishmentEvent(pendingEvent) : null,
    events: rule.events.map((event) => ({
      ...serializeReplenishmentEvent(event),
      purchaseOrderItem: event.purchaseOrderItem
        ? serializePurchaseOrderItem(event.purchaseOrderItem)
        : null,
    })),
  };
}

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

class ReplenishmentService {
  private async syncNextEvent(rule: ReplenishmentRuleAggregate) {
    await replenishmentRepository.deletePendingEventsByRule(rule.id);

    if (!rule.isEnabled) {
      return null;
    }

    const latestCompletedEvent = await replenishmentRepository.findLatestCompletedEvent(rule.id);
    const latestDeliveredItem = await purchaseRepository.findLastDeliveredItemByBudgetItem(
      rule.budgetItemId,
    );

    const calculation = calculateNextReplenishmentDate(rule, {
      deliveredAt: latestDeliveredItem?.deliveredAt ?? null,
      projectStartDate:
        rule.budgetItem.project.actualStartDate ?? rule.budgetItem.project.plannedStartDate,
      lastReplenishmentDate: latestCompletedEvent?.completedDate ?? null,
    });

    if (!calculation) {
      return null;
    }

    return replenishmentRepository.createEvent({
      replenishmentRuleId: rule.id,
      purchaseOrderItemId:
        rule.triggerType === 'FROM_DELIVERY' ? latestDeliveredItem?.id ?? null : null,
      baseDateUsed: calculation.baseDateUsed,
      plannedDate: calculation.plannedDate,
      completedDate: null,
      notes: 'Evento gerado automaticamente pela regra de reposicao.',
    });
  }

  async createOrReplaceRule(budgetItemId: string, input: CreateReplenishmentRuleInput) {
    const budgetItem = await budgetItemRepository.findById(budgetItemId);

    if (!budgetItem) {
      throw new AppError('Budget item not found', 404);
    }

    const rule = await replenishmentRepository.upsertRuleByBudgetItem(
      budgetItemId,
      {
        budgetItemId,
        triggerType: input.triggerType,
        intervalUnit: input.intervalUnit,
        intervalValue: input.intervalValue,
        warningDays: input.warningDays ?? 30,
        baseDate: input.baseDate ? new Date(input.baseDate) : null,
        isEnabled: input.isEnabled ?? true,
        notes: input.notes ?? null,
      },
      {
        triggerType: input.triggerType,
        intervalUnit: input.intervalUnit,
        intervalValue: input.intervalValue,
        warningDays: input.warningDays ?? 30,
        baseDate: input.baseDate ? new Date(input.baseDate) : null,
        isEnabled: input.isEnabled ?? true,
        notes: input.notes ?? null,
      },
    );

    await this.syncNextEvent(rule);

    const refreshed = await replenishmentRepository.findByBudgetItemId(budgetItemId);

    if (!refreshed) {
      throw new AppError('Replenishment rule not found after sync', 500);
    }

    return buildReplenishmentRuleResponse(refreshed);
  }

  async syncRuleByBudgetItemId(budgetItemId: string) {
    const rule = await replenishmentRepository.findByBudgetItemId(budgetItemId);

    if (!rule) {
      return null;
    }

    await this.syncNextEvent(rule);
    return replenishmentRepository.findByBudgetItemId(budgetItemId);
  }

  async listProjectReplenishments(projectId: string) {
    await ensureProjectExists(projectId);
    const rules = await replenishmentRepository.listByProject(projectId);

    return rules.map(buildReplenishmentRuleResponse);
  }
}

export const replenishmentService = new ReplenishmentService();
