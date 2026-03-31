import { Prisma } from '@prisma/client';

import { projectRepository, type ProjectAggregate } from '../repositories/project.repository.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { toDecimal } from '../utils/decimal.js';
import {
  serializeBudgetItem,
  serializeExtractedField,
  serializeImplementationTask,
  serializeProject,
  serializeProjectDocument,
  serializeProjectRole,
  serializePurchaseOrder,
  serializePurchaseOrderItem,
  serializeReplenishmentEvent,
  serializeReplenishmentRule,
  serializeSupplier,
} from '../utils/serializers.js';
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from '../modules/project/project.schemas.js';

/**
 * Campos usados em @@unique(organizationName, procurementProcessNumber|contractNumber).
 * String vazia vira null — senão vários projetos com (mesmo órgão, "") quebram a UNIQUE no SQLite.
 */
export function normalizeOptionalUniqueText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const t = value.trim();
  return t === '' ? null : t;
}

export function mapProjectAggregate(project: ProjectAggregate) {
  return {
    ...serializeProject(project),
    documents: project.documents.map((document) => ({
      ...serializeProjectDocument(document),
      extractedFields: document.extractedFields.map(serializeExtractedField),
    })),
    roles: project.roles.map(serializeProjectRole),
    budgetItems: project.budgetItems.map((item) => ({
      ...serializeBudgetItem(item),
      sourceDocument: item.sourceDocument ? serializeProjectDocument(item.sourceDocument) : null,
      replenishmentRule: item.replenishmentRule
        ? {
            ...serializeReplenishmentRule(item.replenishmentRule),
            events: item.replenishmentRule.events.map(serializeReplenishmentEvent),
          }
        : null,
    })),
    purchaseOrders: project.purchaseOrders.map((order) => ({
      ...serializePurchaseOrder(order),
      supplier: order.supplier ? serializeSupplier(order.supplier) : null,
      generatedDocument: order.generatedDocument
        ? {
            id: order.generatedDocument.id,
            originalFileName: order.generatedDocument.originalFileName,
          }
        : null,
      items: order.items.map((item) => ({
        ...serializePurchaseOrderItem(item),
        budgetItem: serializeBudgetItem(item.budgetItem),
      })),
    })),
    implementationTasks: project.implementationTasks.map(serializeImplementationTask),
    counts: {
      documents: project.documents.length,
      roles: project.roles.length,
      budgetItems: project.budgetItems.length,
      purchaseOrders: project.purchaseOrders.length,
      implementationTasks: project.implementationTasks.length,
    },
  };
}

function toProjectCreateData(input: CreateProjectInput): Prisma.ProjectCreateInput {
  return {
    code: input.code,
    name: input.name,
    organizationName: input.organizationName,
    procurementProcessNumber: normalizeOptionalUniqueText(input.procurementProcessNumber),
    bidNumber: input.bidNumber ?? null,
    contractNumber: normalizeOptionalUniqueText(input.contractNumber),
    city: input.city ?? null,
    state: input.state ?? null,
    objectSummary: input.objectSummary ?? null,
    projectStatus: input.projectStatus,
    implementationStatus: input.implementationStatus,
    plannedSignatureDate: parseOptionalDate(input.plannedSignatureDate),
    plannedStartDate: parseOptionalDate(input.plannedStartDate),
    actualStartDate: parseOptionalDate(input.actualStartDate),
    contractDurationMonths: input.contractDurationMonths ?? 12,
    monthlyContractValue: toDecimal(input.monthlyContractValue),
    notes: input.notes ?? null,
  };
}

export function toProjectUpdateData(input: UpdateProjectInput): Prisma.ProjectUpdateInput {
  return {
    code: input.code,
    name: input.name,
    organizationName: input.organizationName,
    procurementProcessNumber:
      input.procurementProcessNumber !== undefined
        ? normalizeOptionalUniqueText(input.procurementProcessNumber)
        : undefined,
    bidNumber: input.bidNumber,
    contractNumber:
      input.contractNumber !== undefined ? normalizeOptionalUniqueText(input.contractNumber) : undefined,
    city: input.city,
    state: input.state,
    objectSummary: input.objectSummary,
    projectStatus: input.projectStatus,
    implementationStatus: input.implementationStatus,
    plannedSignatureDate:
      input.plannedSignatureDate !== undefined
        ? parseOptionalDate(input.plannedSignatureDate)
        : undefined,
    plannedStartDate:
      input.plannedStartDate !== undefined ? parseOptionalDate(input.plannedStartDate) : undefined,
    actualStartDate:
      input.actualStartDate !== undefined ? parseOptionalDate(input.actualStartDate) : undefined,
    contractDurationMonths: input.contractDurationMonths,
    monthlyContractValue:
      input.monthlyContractValue !== undefined ? toDecimal(input.monthlyContractValue) : undefined,
    notes: input.notes,
  };
}

class ProjectService {
  async createProject(input: CreateProjectInput) {
    const created = await projectRepository.create(toProjectCreateData(input));
    return mapProjectAggregate(created);
  }

  async listProjects(query: ListProjectsQuery) {
    const where: Prisma.ProjectWhereInput = {
      AND: [
        query.search
          ? {
              OR: [
                { code: { contains: query.search } },
                { name: { contains: query.search } },
                { organizationName: { contains: query.search } },
                { bidNumber: { contains: query.search } },
              ],
            }
          : {},
        query.projectStatus ? { projectStatus: query.projectStatus } : {},
        query.organizationName ? { organizationName: query.organizationName } : {},
      ],
    };

    const projects = await projectRepository.findMany(where);

    return projects.map((project) => ({
      ...serializeProject(project),
      counts: {
        documents: project.documents.length,
        roles: project.roles.length,
        budgetItems: project.budgetItems.length,
        purchaseOrders: project.purchaseOrders.length,
        implementationTasks: project.implementationTasks.length,
      },
    }));
  }

  async getProjectById(id: string) {
    const project = await projectRepository.findById(id);

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return mapProjectAggregate(project);
  }

  async updateProject(id: string, input: UpdateProjectInput) {
    const existing = await projectRepository.exists(id);

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const updated = await projectRepository.update(id, toProjectUpdateData(input));
    return mapProjectAggregate(updated);
  }

  async deleteProject(id: string) {
    const existing = await projectRepository.exists(id);

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    await projectRepository.delete(id);
  }
}

export const projectService = new ProjectService();
