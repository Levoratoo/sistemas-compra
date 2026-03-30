/**
 * Cria ou atualiza só os 3 utilizadores demo (mesmas passwords que `seed.ts`).
 * Não apaga dados — seguro para correr na base de produção/staging quando ainda não há users.
 *
 * Render (Shell, com DATABASE_URL já definido pelo painel):
 *   cd apps/api && npx tsx prisma/seed-users-only.ts
 *
 * Local (com .env):
 *   npm run db:seed:users -w apps/api
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { PrismaClient, type UserRole } from '@prisma/client';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '..');

function resolveRuntimeDatabaseUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const relativePath = databaseUrl.replace(/^file:\.?\/?/, '');
  const absolutePath = path.resolve(appRoot, 'prisma', relativePath);
  return `file:${absolutePath.replace(/\\/g, '/')}`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveRuntimeDatabaseUrl(
        process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/sitecompras?schema=public',
      ),
    },
  },
});

const hashPassword = (plain: string) => bcrypt.hashSync(plain, 12);

const demoUsers: Array<{
  email: string;
  password: string;
  name: string;
  role: UserRole;
}> = [
  { email: 'admin@sitecompras.local', password: 'Admin@123', name: 'Administrador', role: 'ADMIN' },
  { email: 'usuario@sitecompras.local', password: 'Usuario@123', name: 'Usuário operacional', role: 'USER' },
  { email: 'aprovador@sitecompras.local', password: 'Aprovador@123', name: 'Aprovador', role: 'APPROVER' },
];

async function main() {
  for (const u of demoUsers) {
    const email = u.email.trim().toLowerCase();
    const passwordHash = hashPassword(u.password);

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        name: u.name,
        role: u.role,
        isActive: true,
      },
      update: {
        passwordHash,
        name: u.name,
        role: u.role,
        isActive: true,
      },
    });

    console.log(`User OK: ${email} (${u.role})`);
  }

  console.log('seed-users-only concluído.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
