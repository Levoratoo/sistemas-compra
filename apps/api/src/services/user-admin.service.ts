import type { UserRole } from '@prisma/client';

import { userRepository } from '../repositories/user.repository.js';
import type { CreateUserInput, UpdateUserInput } from '../modules/user/user-admin.schemas.js';
import { hashPassword } from '../services/auth.service.js';
import { AppError } from '../utils/app-error.js';
import { serializeUser } from '../utils/serializers.js';

class UserAdminService {
  async list() {
    const users = await userRepository.findMany();
    return users.map(serializeUser);
  }

  async create(input: CreateUserInput) {
    const existing = await userRepository.findByEmail(input.email);

    if (existing) {
      throw new AppError('Já existe um usuário com este e-mail.', 409);
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      email: input.email,
      name: input.name,
      role: input.role as UserRole,
      passwordHash,
      isActive: input.isActive ?? true,
    });

    return serializeUser(user);
  }

  async update(id: string, input: UpdateUserInput) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    if (input.email && input.email.trim().toLowerCase() !== user.email) {
      const taken = await userRepository.findByEmail(input.email);
      if (taken && taken.id !== id) {
        throw new AppError('Já existe um usuário com este e-mail.', 409);
      }
    }

    let passwordHash: string | undefined;

    if (input.password !== undefined && input.password !== '') {
      passwordHash = await hashPassword(input.password);
    }

    const updated = await userRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    });

    return serializeUser(updated);
  }
}

export const userAdminService = new UserAdminService();
