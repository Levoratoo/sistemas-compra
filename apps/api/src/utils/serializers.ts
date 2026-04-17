import type {
  BudgetItem,
  ExtractedField,
  ImplementationTask,
  MissingItemReport,
  MissingItemReportAttachment,
  Project,
  User,
  ProjectDocument,
  ProjectDocumentFolder,
  ProjectRole,
  PurchaseOrder,
  PurchaseOrderItem,
  ReplenishmentEvent,
  ReplenishmentRule,
  Supplier,
  SupplierCndAttachment,
} from '@prisma/client';

import { decimalToNumber } from './decimal.js';
import { toIsoString } from './date.js';
import { deriveDualSupplierCndStatus } from './supplier-cnd-status.js';

type UserWithReleasedProjects = User & {
  releasedProjects?: Array<{
    project: Pick<Project, 'id' | 'code' | 'name'>;
  }>;
};

export function serializeUser(user: UserWithReleasedProjects) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    releasedProjects: (user.releasedProjects ?? []).map((entry) => ({
      id: entry.project.id,
      code: entry.project.code,
      name: entry.project.name,
    })),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

export function serializeProject(project: Project) {
  return {
    ...project,
    monthlyContractValue: decimalToNumber(project.monthlyContractValue),
    createdAt: toIsoString(project.createdAt),
    updatedAt: toIsoString(project.updatedAt),
    plannedSignatureDate: toIsoString(project.plannedSignatureDate),
    plannedStartDate: toIsoString(project.plannedStartDate),
    actualStartDate: toIsoString(project.actualStartDate),
  };
}

export function serializeProjectDocument(document: ProjectDocument) {
  return {
    ...document,
    documentDate: toIsoString(document.documentDate),
    createdAt: toIsoString(document.createdAt),
    updatedAt: toIsoString(document.updatedAt),
  };
}

export function serializeProjectDocumentFolder(folder: ProjectDocumentFolder) {
  return {
    ...folder,
    createdAt: toIsoString(folder.createdAt),
    updatedAt: toIsoString(folder.updatedAt),
  };
}

export function serializeExtractedField(field: ExtractedField) {
  return {
    ...field,
    createdAt: toIsoString(field.createdAt),
    updatedAt: toIsoString(field.updatedAt),
  };
}

export function serializeProjectRole(role: ProjectRole) {
  return {
    ...role,
    createdAt: toIsoString(role.createdAt),
    updatedAt: toIsoString(role.updatedAt),
  };
}

export function serializeImplementationTask(task: ImplementationTask) {
  return {
    ...task,
    dueDate: toIsoString(task.dueDate),
    createdAt: toIsoString(task.createdAt),
    updatedAt: toIsoString(task.updatedAt),
  };
}

export function serializeMissingItemReportAttachment(att: MissingItemReportAttachment) {
  return {
    ...att,
    createdAt: toIsoString(att.createdAt),
  };
}

type MissingItemReportWithAttachments = MissingItemReport & {
  attachments?: MissingItemReportAttachment[];
};

export function serializeMissingItemReport(report: MissingItemReportWithAttachments) {
  const { attachments: rawAttachments, requestDate, ownerApprovedAt, createdAt, updatedAt, ...rest } = report;

  return {
    ...rest,
    requestDate: toIsoString(requestDate),
    ownerApprovedAt: toIsoString(ownerApprovedAt),
    createdAt: toIsoString(createdAt),
    updatedAt: toIsoString(updatedAt),
    attachments: (rawAttachments ?? []).map(serializeMissingItemReportAttachment),
  };
}

type MissingItemReportProjectListRow = MissingItemReportWithAttachments & {
  project?: { organizationName: string };
};

/** Resposta de GET por projeto: inclui órgão (contrato) para a vista em planilha. */
export function serializeMissingItemReportForProjectList(row: MissingItemReportProjectListRow) {
  const { project, ...report } = row;
  return {
    ...serializeMissingItemReport(report),
    organizationName: project?.organizationName ?? '',
  };
}

type PendingMissingItemRow = MissingItemReportWithAttachments & {
  project: { id: string; code: string; name: string };
};

export function serializePendingMissingItemReport(row: PendingMissingItemRow) {
  const { project, ...report } = row;
  return {
    ...serializeMissingItemReport(report),
    project: { id: project.id, code: project.code, name: project.name },
  };
}

export function serializeBudgetItem(item: BudgetItem) {
  return {
    ...item,
    plannedQuantity: decimalToNumber(item.plannedQuantity),
    bidUnitValue: decimalToNumber(item.bidUnitValue),
    rubricMaxValue: decimalToNumber(item.rubricMaxValue),
    purchasedValue: decimalToNumber(item.purchasedValue),
    administrativeFeePercent: decimalToNumber(item.administrativeFeePercent),
    actualUnitValue: decimalToNumber(item.actualUnitValue),
    opPaymentSentAt: toIsoString(item.opPaymentSentAt),
    opExpectedDeliveryAt: toIsoString(item.opExpectedDeliveryAt),
    opDeliveredAt: toIsoString(item.opDeliveredAt),
    nextReplenishmentExpectedAt: toIsoString(item.nextReplenishmentExpectedAt),
    replenishmentCycleConfirmedAt: toIsoString(item.replenishmentCycleConfirmedAt),
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  };
}

type SupplierWithCndAttachments = Supplier & {
  cndAttachments?: SupplierCndAttachment[];
};

function pickLatestScopedAttachment(
  attachments: SupplierCndAttachment[] | undefined,
  scope: 'FEDERAL' | 'STATE',
): SupplierCndAttachment | undefined {
  if (!attachments?.length) {
    return undefined;
  }

  let best: SupplierCndAttachment | undefined;
  for (const att of attachments) {
    if (att.scope !== scope) {
      continue;
    }
    if (!best || att.createdAt.getTime() > best.createdAt.getTime()) {
      best = att;
    }
  }

  return best;
}

function serializeSupplierCndScopeSnapshot(att: SupplierCndAttachment | undefined) {
  if (!att?.parsedValidUntil) {
    return null;
  }

  return {
    issuedAt: toIsoString(att.parsedIssuedAt),
    validUntil: toIsoString(att.parsedValidUntil),
    controlCode: att.parsedControlCode,
    originalFileName: att.originalFileName,
  };
}

export function serializeSupplier(supplier: SupplierWithCndAttachments) {
  const { cndAttachments, ...rest } = supplier;
  const federalAtt = pickLatestScopedAttachment(cndAttachments, 'FEDERAL');
  const stateAtt = pickLatestScopedAttachment(cndAttachments, 'STATE');

  const cndFederal = serializeSupplierCndScopeSnapshot(federalAtt);
  const cndState = serializeSupplierCndScopeSnapshot(stateAtt);

  const cndDerived = deriveDualSupplierCndStatus(
    federalAtt?.parsedValidUntil ?? null,
    stateAtt?.parsedValidUntil ?? null,
  );

  return {
    ...rest,
    cndIssuedAt: toIsoString(rest.cndIssuedAt),
    cndValidUntil: toIsoString(rest.cndValidUntil),
    createdAt: toIsoString(rest.createdAt),
    updatedAt: toIsoString(rest.updatedAt),
    cndStatus: cndDerived.status,
    cndDaysUntilExpiration: cndDerived.daysUntilExpiration,
    cndFederal,
    cndState,
  };
}

export function serializePurchaseOrder(order: PurchaseOrder) {
  return {
    ...order,
    purchaseDate: toIsoString(order.purchaseDate),
    expectedDeliveryDate: toIsoString(order.expectedDeliveryDate),
    paymentSentAt: toIsoString(order.paymentSentAt),
    createdAt: toIsoString(order.createdAt),
    updatedAt: toIsoString(order.updatedAt),
  };
}

export function serializePurchaseOrderItem(item: PurchaseOrderItem) {
  return {
    ...item,
    quantityPurchased: decimalToNumber(item.quantityPurchased),
    realUnitValue: decimalToNumber(item.realUnitValue),
    expectedDeliveryDate: toIsoString(item.expectedDeliveryDate),
    deliveredAt: toIsoString(item.deliveredAt),
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  };
}

export function serializeReplenishmentRule(rule: ReplenishmentRule) {
  return {
    ...rule,
    baseDate: toIsoString(rule.baseDate),
    createdAt: toIsoString(rule.createdAt),
    updatedAt: toIsoString(rule.updatedAt),
  };
}

export function serializeReplenishmentEvent(event: ReplenishmentEvent) {
  return {
    ...event,
    baseDateUsed: toIsoString(event.baseDateUsed),
    plannedDate: toIsoString(event.plannedDate),
    completedDate: toIsoString(event.completedDate),
    createdAt: toIsoString(event.createdAt),
    updatedAt: toIsoString(event.updatedAt),
  };
}
