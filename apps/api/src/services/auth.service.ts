import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { serializeUser } from '../utils/serializers.js';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

class AuthService {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);

    if (!user || !user.isActive) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);

    if (!ok) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      env.JWT_SECRET as Secret,
      { expiresIn: env.JWT_EXPIRES_IN } as SignOptions,
    );

    return {
      token,
      user: serializeUser(user),
    };
  }

  async me(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    return serializeUser(user);
  }
}

export const authService = new AuthService();
