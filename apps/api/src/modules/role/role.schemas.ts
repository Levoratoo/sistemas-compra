import { DataOriginType } from '@prisma/client';
import { z } from 'zod';

export const projectRoleParamsSchema = z.object({
  id: z.string().min(1),
});

function optionalTrimmedString() {
  return z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().trim().optional(),
  );
}

const roleBaseSchema = z.object({
  roleName: z.string().trim().min(1),
  cboCode: optionalTrimmedString(),
  workRegime: optionalTrimmedString(),
  workloadLabel: optionalTrimmedString(),
  allocationSector: optionalTrimmedString(),
  plannedPositions: z.coerce.number().int().nonnegative().optional(),
  employeesPerPosition: z.coerce.number().int().nonnegative().optional(),
  plannedHeadcount: z.coerce.number().int().nonnegative(),
  sourceType: z.nativeEnum(DataOriginType).optional(),
  sourceDocumentId: optionalTrimmedString(),
  sourceSheetName: optionalTrimmedString(),
  sourceCellRef: optionalTrimmedString(),
  sourcePage: z.coerce.number().int().nonnegative().optional(),
  sourceExcerpt: optionalTrimmedString(),
  notes: optionalTrimmedString(),
});

export const createProjectRoleSchema = roleBaseSchema;

export const roleIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateProjectRoleSchema = roleBaseSchema.partial();

export type CreateProjectRoleInput = z.infer<typeof createProjectRoleSchema>;
export type UpdateProjectRoleInput = z.infer<typeof updateProjectRoleSchema>;
