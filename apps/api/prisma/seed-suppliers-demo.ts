/**
 * Cria ou atualiza os 2 fornecedores demo (DF + MADIS) por CNPJ — não apaga dados.
 *
 * Requer migração com colunas address, tradeName, cnd (já no repo).
 *
 * GitHub Actions: workflow "Seed demo suppliers" (usa secret DATABASE_URL)
 * Local: npm run db:seed:suppliers -w apps/api
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

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

const demoSuppliers = [
  {
    legalName: 'DF Distribuidora de ferragens LTDA',
    documentNumber: '11931451000169',
    address: 'av. brasil, N2559 - bairro região do lago',
    phone: '45 3039-5060',
    tradeName: null as string | null,
  },
  {
    legalName: 'MADIS UNIFORMES',
    tradeName: 'VEST BEM UNIFORMES',
    documentNumber: '21080449000187',
    address: 'RUA 716, 344 ITAPEMA SC',
    phone: '47 997096331',
  },
];

async function main() {
  for (const s of demoSuppliers) {
    await prisma.supplier.upsert({
      where: { documentNumber: s.documentNumber },
      create: {
        legalName: s.legalName,
        tradeName: s.tradeName ?? null,
        documentNumber: s.documentNumber,
        address: s.address ?? null,
        phone: s.phone ?? null,
      },
      update: {
        legalName: s.legalName,
        tradeName: s.tradeName ?? null,
        address: s.address ?? null,
        phone: s.phone ?? null,
      },
    });
    console.log(`Fornecedor OK: ${s.legalName} (${s.documentNumber})`);
  }

  console.log('seed-suppliers-demo concluído.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
