/**
 * Cria ou atualiza so os 4 usuarios demo (mesmas senhas do `seed.ts`).
 * Nao apaga dados e pode ser usado para repor acessos locais, staging ou producao.
 *
 * Render:
 *   cd apps/api && npx tsx prisma/seed-users-only.ts
 *
 * Local:
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
  { email: 'usuario@sitecompras.local', password: 'Usuario@123', name: 'Usuario operacional', role: 'USER' },
  { email: 'aprovador@sitecompras.local', password: 'Aprovador@123', name: 'Aprovador', role: 'APPROVER' },
  { email: 'supervisora@sitecompras.local', password: 'Supervisora@123', name: 'Supervisora', role: 'SUPERVISOR' },
];

async function main() {
  for (const user of demoUsers) {
    const email = user.email.trim().toLowerCase();
    const passwordHash = hashPassword(user.password);

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        name: user.name,
        role: user.role,
        isActive: true,
      },
      update: {
        passwordHash,
        name: user.name,
        role: user.role,
        isActive: true,
      },
    });

    console.log(`User OK: ${email} (${user.role})`);
  }

  console.log('seed-users-only concluido.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
