import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres.'),
  name: z.string().trim().min(1),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().optional(),
  releasedProjectIds: z.array(z.string().trim().min(1)).optional(),
});

export const updateUserSchema = z
  .object({
    email: z.string().trim().email().optional(),
    password: z.string().optional(),
    name: z.string().trim().min(1).optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    releasedProjectIds: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  })
  .refine(
    (data) =>
      data.password === undefined ||
      data.password === '' ||
      (typeof data.password === 'string' && data.password.length >= 8),
    { message: 'Senha deve ter pelo menos 8 caracteres.', path: ['password'] },
  );

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
