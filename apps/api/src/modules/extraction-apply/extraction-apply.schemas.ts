import { TaskCategory, TaskStatus } from '@prisma/client';
import { z } from 'zod';

import { createBudgetItemSchema } from '../budget-item/budget-item.schemas.js';
import { createProjectRoleSchema } from '../role/role.schemas.js';
import { updateProjectSchema } from '../project/project.schemas.js';

export const applyExtractionParamsSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
});

const roleForApplySchema = createProjectRoleSchema.omit({
  sourceType: true,
  sourceDocumentId: true,
});

const budgetForApplySchema = createBudgetItemSchema.omit({
  sourceType: true,
  sourceDocumentId: true,
});

const taskForApplySchema = z.object({
  title: z.string().trim().min(1),
  category: z.nativeEnum(TaskCategory),
  description: z.string().trim().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().trim().optional().nullable(),
  sourcePage: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const applyExtractionBodySchema = z.object({
  project: updateProjectSchema.optional(),
  roles: z.array(roleForApplySchema).default([]),
  budgetItems: z.array(budgetForApplySchema).default([]),
  tasks: z.array(taskForApplySchema).default([]),
});

export type ApplyExtractionBody = z.infer<typeof applyExtractionBodySchema>;
