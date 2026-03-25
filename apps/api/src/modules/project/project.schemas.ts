import { ImplementationStatus, ProjectStatus } from '@prisma/client';
import { z } from 'zod';

export const projectIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().optional(),
  projectStatus: z.nativeEnum(ProjectStatus).optional(),
  organizationName: z.string().trim().optional(),
});

export const createProjectSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  organizationName: z.string().trim().min(1),
  procurementProcessNumber: z.string().trim().optional(),
  bidNumber: z.string().trim().optional(),
  contractNumber: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  objectSummary: z.string().trim().optional(),
  projectStatus: z.nativeEnum(ProjectStatus).default(ProjectStatus.DRAFT),
  implementationStatus: z
    .nativeEnum(ImplementationStatus)
    .default(ImplementationStatus.NOT_STARTED),
  plannedSignatureDate: z.string().trim().optional().nullable(),
  plannedStartDate: z.string().trim().optional().nullable(),
  actualStartDate: z.string().trim().optional().nullable(),
  contractDurationMonths: z.coerce.number().int().positive().max(120).optional(),
  monthlyContractValue: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().trim().optional(),
});

export const updateProjectSchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  organizationName: z.string().trim().min(1).optional(),
  procurementProcessNumber: z.string().trim().optional().nullable(),
  bidNumber: z.string().trim().optional().nullable(),
  contractNumber: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  objectSummary: z.string().trim().optional().nullable(),
  projectStatus: z.nativeEnum(ProjectStatus).optional(),
  implementationStatus: z.nativeEnum(ImplementationStatus).optional(),
  plannedSignatureDate: z.string().trim().optional().nullable(),
  plannedStartDate: z.string().trim().optional().nullable(),
  actualStartDate: z.string().trim().optional().nullable(),
  contractDurationMonths: z.coerce.number().int().positive().max(120).optional(),
  monthlyContractValue: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
