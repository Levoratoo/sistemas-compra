import type { ProjectAggregate } from '../repositories/project.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { AppError } from '../utils/app-error.js';
import { decimalToNumber } from '../utils/decimal.js';
import { toIsoString } from '../utils/date.js';

type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

type ProjectAlert = {
  type:
    | 'ITEM_ABOVE_BID'
    | 'ITEM_WITHOUT_BID_REFERENCE'
    | 'REPLENISHMENT_OVERDUE'
    | 'REPLENISHMENT_UPCOMING';
  severity: AlertSeverity;
  title: string;
  message: string;
  projectId: string;
  budgetItemId?: string;
  purchaseOrderItemId?: string;
  plannedDate?: string | null;
};

function calculateBudgetItemPlannedTotal(item: ProjectAggregate['budgetItems'][number]) {
  const plannedQuantity = decimalToNumber(item.plannedQuantity);
  const bidUnitValue = decimalToNumber(item.bidUnitValue);

  if (plannedQuantity === null || bidUnitValue === null) {
    return null;
  }

  return plannedQuantity * bidUnitValue;
}

function calculatePurchaseOrderItemRealTotal(item: ProjectAggregate['purchaseOrders'][number]['items'][number]) {
  const quantity = decimalToNumber(item.quantityPurchased) ?? 0;
  const realUnitValue = decimalToNumber(item.realUnitValue) ?? 0;
  return quantity * realUnitValue;
}

function getPendingReplenishmentEvent(item: ProjectAggregate['budgetItems'][number]) {
  return item.replenishmentRule?.events.find((event) => !event.completedDate) ?? null;
}

function buildAlerts(project: ProjectAggregate): ProjectAlert[] {
  const alerts: ProjectAlert[] = [];
  const now = new Date();

  for (const purchaseOrder of project.purchaseOrders) {
    for (const item of purchaseOrder.items) {
      const realUnitValue = decimalToNumber(item.realUnitValue);
      const bidUnitValue = decimalToNumber(item.budgetItem.bidUnitValue);

      if (
        item.budgetItem.hasBidReference &&
        bidUnitValue !== null &&
        realUnitValue !== null &&
        realUnitValue > bidUnitValue
      ) {
        alerts.push({
          type: 'ITEM_ABOVE_BID',
          severity: 'CRITICAL',
          title: `Item acima da rubrica: ${item.budgetItem.name}`,
          message: `Valor real ${realUnitValue.toFixed(2)} acima do previsto ${bidUnitValue.toFixed(2)}.`,
          projectId: project.id,
          budgetItemId: item.budgetItemId,
          purchaseOrderItemId: item.id,
        });
      }

      if (!item.budgetItem.hasBidReference || bidUnitValue === null) {
        alerts.push({
          type: 'ITEM_WITHOUT_BID_REFERENCE',
          severity: 'WARNING',
          title: `Item sem rubrica: ${item.budgetItem.name}`,
          message: 'Compra real vinculada a item sem valor de licitacao confirmado.',
          projectId: project.id,
          budgetItemId: item.budgetItemId,
          purchaseOrderItemId: item.id,
        });
      }
    }
  }

  for (const budgetItem of project.budgetItems) {
    const pendingEvent = getPendingReplenishmentEvent(budgetItem);
    const warningDays = budgetItem.replenishmentRule?.warningDays ?? 0;

    if (!pendingEvent) {
      continue;
    }

    const warningDate = new Date(pendingEvent.plannedDate);
    warningDate.setDate(warningDate.getDate() - warningDays);

    if (pendingEvent.plannedDate.getTime() < now.getTime()) {
      alerts.push({
        type: 'REPLENISHMENT_OVERDUE',
        severity: 'CRITICAL',
        title: `Reposicao vencida: ${budgetItem.name}`,
        message: `Reposicao prevista para ${pendingEvent.plannedDate.toISOString()}.`,
        projectId: project.id,
        budgetItemId: budgetItem.id,
        plannedDate: toIsoString(pendingEvent.plannedDate),
      });
    } else if (warningDate.getTime() <= now.getTime()) {
      alerts.push({
        type: 'REPLENISHMENT_UPCOMING',
        severity: 'WARNING',
        title: `Reposicao proxima: ${budgetItem.name}`,
        message: `Reposicao prevista para ${pendingEvent.plannedDate.toISOString()}.`,
        projectId: project.id,
        budgetItemId: budgetItem.id,
        plannedDate: toIsoString(pendingEvent.plannedDate),
      });
    }
  }

  return alerts;
}

function buildProjectDashboard(project: ProjectAggregate) {
  const plannedComparableItems = project.budgetItems.filter(
    (item) =>
      !item.contextOnly &&
      item.hasBidReference &&
      item.bidUnitValue !== null &&
      item.plannedQuantity !== null,
  );

  const totalPlanned = plannedComparableItems.reduce((total, item) => {
    return total + (calculateBudgetItemPlannedTotal(item) ?? 0);
  }, 0);

  const totalRealized = project.purchaseOrders.reduce((projectTotal, purchaseOrder) => {
    return (
      projectTotal +
      purchaseOrder.items.reduce((orderTotal, item) => {
        return orderTotal + calculatePurchaseOrderItemRealTotal(item);
      }, 0)
    );
  }, 0);

  const comparableRealized = project.purchaseOrders.reduce((projectTotal, purchaseOrder) => {
    return (
      projectTotal +
      purchaseOrder.items.reduce((orderTotal, item) => {
        if (!item.budgetItem.hasBidReference || item.budgetItem.bidUnitValue === null) {
          return orderTotal;
        }

        return orderTotal + calculatePurchaseOrderItemRealTotal(item);
      }, 0)
    );
  }, 0);

  const itemsWithoutBidReference = project.budgetItems.filter(
    (item) => !item.hasBidReference || item.bidUnitValue === null,
  );

  const upcomingEvents = project.budgetItems
    .flatMap((budgetItem) => {
      const nextEvent = getPendingReplenishmentEvent(budgetItem);

      if (!nextEvent) {
        return [];
      }

      return [
        {
          budgetItemId: budgetItem.id,
          budgetItemName: budgetItem.name,
          plannedDate: toIsoString(nextEvent.plannedDate),
          warningDays: budgetItem.replenishmentRule?.warningDays ?? 0,
        },
      ];
    })
    .sort((left, right) => {
      if (!left.plannedDate || !right.plannedDate) {
        return 0;
      }

      return new Date(left.plannedDate).getTime() - new Date(right.plannedDate).getTime();
    });

  return {
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      organizationName: project.organizationName,
      projectStatus: project.projectStatus,
      implementationStatus: project.implementationStatus,
    },
    totalPlanned,
    totalRealized,
    savings: totalPlanned - comparableRealized,
    itemsWithoutBidReference: itemsWithoutBidReference.map((item) => ({
      id: item.id,
      name: item.name,
      itemCategory: item.itemCategory,
    })),
    upcomingEvents,
    alerts: buildAlerts(project),
  };
}

function buildConsolidatedDashboard(projects: ProjectAggregate[]) {
  const activeProjects = projects.filter((project) => project.projectStatus === 'ACTIVE');
  const projectsInImplementation = projects.filter(
    (project) => project.implementationStatus === 'IN_PROGRESS',
  );

  const dashboards = projects.map((project) => {
    const dashboard = buildProjectDashboard(project);
    const alerts = buildAlerts(project);
    const overdueReplenishments = alerts.filter(
      (alert) => alert.type === 'REPLENISHMENT_OVERDUE',
    ).length;
    const upcomingReplenishments = alerts.filter(
      (alert) => alert.type === 'REPLENISHMENT_UPCOMING',
    ).length;

    return {
      ...dashboard,
      overdueReplenishments,
      upcomingReplenishments,
    };
  });

  const upcomingEvents = dashboards
    .flatMap((dashboard) =>
      dashboard.upcomingEvents.map((event) => ({
        ...event,
        projectId: dashboard.project.id,
        projectCode: dashboard.project.code,
        projectName: dashboard.project.name,
      })),
    )
    .sort((left, right) => {
      if (!left.plannedDate || !right.plannedDate) {
        return 0;
      }

      return new Date(left.plannedDate).getTime() - new Date(right.plannedDate).getTime();
    });

  return {
    totalProjects: projects.length,
    totalActiveProjects: activeProjects.length,
    totalProjectsInImplementation: projectsInImplementation.length,
    totalPlanned: dashboards.reduce((total, dashboard) => total + dashboard.totalPlanned, 0),
    totalRealized: dashboards.reduce((total, dashboard) => total + dashboard.totalRealized, 0),
    totalSavings: dashboards.reduce((total, dashboard) => total + dashboard.savings, 0),
    totalItemsWithoutBidReference: dashboards.reduce(
      (total, dashboard) => total + dashboard.itemsWithoutBidReference.length,
      0,
    ),
    totalUpcomingReplenishments: dashboards.reduce(
      (total, dashboard) => total + dashboard.upcomingReplenishments,
      0,
    ),
    totalOverdueReplenishments: dashboards.reduce(
      (total, dashboard) => total + dashboard.overdueReplenishments,
      0,
    ),
    projects: dashboards.map((dashboard) => ({
      ...dashboard.project,
      totalPlanned: dashboard.totalPlanned,
      totalRealized: dashboard.totalRealized,
      savings: dashboard.savings,
      itemsWithoutBidReferenceCount: dashboard.itemsWithoutBidReference.length,
      alertsCount: dashboard.alerts.length,
    })),
    upcomingEvents: upcomingEvents.slice(0, 10),
    alerts: dashboards.flatMap((dashboard) => dashboard.alerts).slice(0, 20),
  };
}

class DashboardService {
  async getConsolidatedDashboard() {
    const projects = await projectRepository.findMany({
      projectStatus: {
        not: 'CANCELLED',
      },
    });

    return buildConsolidatedDashboard(projects);
  }

  async getProjectDashboard(projectId: string) {
    const project = await projectRepository.findById(projectId);

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return buildProjectDashboard(project);
  }

  async getProjectAlerts(projectId: string) {
    const project = await projectRepository.findById(projectId);

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return buildAlerts(project);
  }
}

export const dashboardService = new DashboardService();

export async function getProjectAlerts(projectId: string) {
  return dashboardService.getProjectAlerts(projectId);
}
