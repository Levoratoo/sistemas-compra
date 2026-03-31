import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';

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

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

async function resetDatabase() {
  await prisma.user.deleteMany();
  await prisma.replenishmentEvent.deleteMany();
  await prisma.replenishmentRule.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.projectRole.deleteMany();
  await prisma.extractedField.deleteMany();
  await prisma.projectDocument.deleteMany();
  await prisma.project.deleteMany();
}

async function main() {
  await resetDatabase();

  const [uniformSupplier, epiSupplier, techSupplier] = await Promise.all([
    prisma.supplier.create({
      data: {
        legalName: 'Alpha Uniformes Ltda',
        documentNumber: '12345678000101',
        contactName: 'Marina Costa',
        email: 'contato@alphauniformes.local',
        phone: '(11) 4000-1100',
      },
    }),
    prisma.supplier.create({
      data: {
        legalName: 'Delta EPIs Ltda',
        documentNumber: '98765432000177',
        contactName: 'Paulo Mendes',
        email: 'vendas@deltaepis.local',
        phone: '(19) 3500-2200',
      },
    }),
    prisma.supplier.create({
      data: {
        legalName: 'Prime Tecnologia Operacional Ltda',
        documentNumber: '11122233000144',
        contactName: 'Carla Nogueira',
        email: 'operacao@prime.local',
        phone: '(31) 3300-4500',
      },
    }),
  ]);

  await prisma.supplier.create({
    data: {
      legalName: 'DF Distribuidora de ferragens LTDA',
      documentNumber: '11931451000169',
      address: 'av. brasil, N2559 - bairro região do lago',
      phone: '45 3039-5060',
    },
  });
  await prisma.supplier.create({
    data: {
      legalName: 'MADIS UNIFORMES',
      tradeName: 'VEST BEM UNIFORMES',
      documentNumber: '21080449000187',
      address: 'RUA 716, 344 ITAPEMA SC',
      phone: '47 997096331',
    },
  });

  const project = await prisma.project.create({
    data: {
      code: 'HUJM-2026',
      name: 'Hospital Universitario Julio Muller',
      organizationName: 'EBSERH',
      procurementProcessNumber: '23532.000274/2024-71',
      bidNumber: '90.030/2025',
      contractNumber: 'CTR-2026-001',
      city: 'Cuiaba',
      state: 'MT',
      objectSummary:
        'Apoio administrativo, logistico e operacional com mao de obra dedicada e insumos.',
      projectStatus: 'ACTIVE',
      implementationStatus: 'IN_PROGRESS',
      plannedSignatureDate: new Date('2026-03-28T00:00:00.000Z'),
      plannedStartDate: new Date('2026-04-15T00:00:00.000Z'),
      actualStartDate: new Date('2026-05-01T00:00:00.000Z'),
      contractDurationMonths: 12,
      monthlyContractValue: decimal(410837.75),
      notes: 'Projeto seed para navegacao do MVP.',
      documents: {
        create: [
          {
            documentType: 'NOTICE',
            originalFileName: 'edital-pe-90030-2025.pdf',
            storagePath: 'uploads/seed/edital-pe-90030-2025.pdf',
            mimeType: 'application/pdf',
            processingStatus: 'PROCESSED',
            reviewStatus: 'REVIEWED',
            notes: 'Edital importado no seed.',
            extractedFields: {
              create: [
                {
                  targetType: 'PROJECT',
                  fieldKey: 'bidNumber',
                  proposedValue: '90.030/2025',
                  confirmedValue: '90.030/2025',
                  sourcePage: 1,
                  sourceExcerpt: 'Pregao Eletronico 90.030/2025',
                  confidenceScore: 0.98,
                  reviewStatus: 'CONFIRMED',
                },
                {
                  targetType: 'PROJECT',
                  fieldKey: 'organizationName',
                  proposedValue: 'EBSERH',
                  confirmedValue: 'EBSERH',
                  sourcePage: 1,
                  sourceExcerpt: 'Hospital Universitario Julio Muller / EBSERH',
                  confidenceScore: 0.94,
                  reviewStatus: 'CONFIRMED',
                },
              ],
            },
          },
          {
            documentType: 'CONTROL_SPREADSHEET',
            originalFileName: 'controle-compras-hujm.xlsx',
            storagePath: 'uploads/seed/controle-compras-hujm.xlsx',
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            processingStatus: 'PROCESSED',
            reviewStatus: 'REVIEWED',
          },
        ],
      },
      roles: {
        create: [
          {
            roleName: 'Recepcionista',
            workloadLabel: '44h',
            plannedPositions: 28,
            employeesPerPosition: 1,
            plannedHeadcount: 28,
            allocationSector: 'Recepcao',
          },
          {
            roleName: 'Maqueiro',
            workloadLabel: '12x36',
            plannedPositions: 18,
            employeesPerPosition: 2,
            plannedHeadcount: 36,
            allocationSector: 'Hotelaria',
          },
          {
            roleName: 'Almoxarife',
            workloadLabel: '44h',
            plannedPositions: 7,
            employeesPerPosition: 1,
            plannedHeadcount: 7,
            allocationSector: 'Almoxarifado',
          },
        ],
      },
      budgetItems: {
        create: [
          {
            itemCategory: 'UNIFORM',
            name: 'Camisa gola polo',
            unit: 'un',
            plannedQuantity: decimal(138),
            bidUnitValue: decimal(54.9),
            hasBidReference: true,
            sourceType: 'DOCUMENT_EXTRACTED',
            sourceSheetName: 'Uniformes',
            sourceCellRef: 'G63',
            notes: 'Item de uniforme com reposicao semestral.',
          },
          {
            itemCategory: 'EPI',
            name: 'Luva latex cano medio',
            unit: 'par',
            plannedQuantity: decimal(94),
            bidUnitValue: decimal(29.9),
            hasBidReference: true,
            sourceType: 'DOCUMENT_EXTRACTED',
            sourceSheetName: 'EPI',
            sourceCellRef: 'H8',
          },
          {
            itemCategory: 'EQUIPMENT',
            name: 'Headset',
            unit: 'un',
            plannedQuantity: decimal(4),
            bidUnitValue: decimal(129.9),
            hasBidReference: true,
            sourceType: 'DOCUMENT_EXTRACTED',
            sourceSheetName: 'Equipamentos',
            sourceCellRef: 'G16',
          },
          {
            itemCategory: 'OTHER',
            name: 'Servico de arte para cracha',
            unit: 'servico',
            plannedQuantity: decimal(1),
            hasBidReference: false,
            sourceType: 'MANUAL',
            notes: 'Item manual sem rubrica prevista.',
          },
        ],
      },
    },
    include: {
      budgetItems: true,
    },
  });

  const [camisa, luva, headset, arteCracha] = project.budgetItems;

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      projectId: project.id,
      supplierId: uniformSupplier.id,
      purchaseStatus: 'COMPLETED',
      purchaseDate: new Date('2026-03-12T00:00:00.000Z'),
      internalReference: 'PC-2026-001',
      glpiNumber: '2025148114',
      paymentSentAt: new Date('2026-03-10T00:00:00.000Z'),
      notes: 'Compra inicial da implantacao.',
      items: {
        create: [
          {
            budgetItemId: camisa.id,
            quantityPurchased: decimal(138),
            realUnitValue: decimal(52),
            expectedDeliveryDate: new Date('2026-03-20T00:00:00.000Z'),
            deliveredAt: new Date('2026-03-18T00:00:00.000Z'),
            deliveryStatus: 'DELIVERED',
          },
          {
            budgetItemId: luva.id,
            quantityPurchased: decimal(94),
            realUnitValue: decimal(31.4),
            expectedDeliveryDate: new Date('2026-03-22T00:00:00.000Z'),
            deliveryStatus: 'SCHEDULED',
          },
          {
            budgetItemId: arteCracha.id,
            quantityPurchased: decimal(1),
            realUnitValue: decimal(350),
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date('2026-03-15T00:00:00.000Z'),
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      projectId: project.id,
      supplierId: techSupplier.id,
      purchaseStatus: 'APPROVED',
      purchaseDate: new Date('2026-03-14T00:00:00.000Z'),
      internalReference: 'PC-2026-002',
      notes: 'Compra de equipamento de apoio.',
      items: {
        create: [
          {
            budgetItemId: headset.id,
            quantityPurchased: decimal(4),
            realUnitValue: decimal(35.39),
            expectedDeliveryDate: new Date('2026-03-25T00:00:00.000Z'),
            deliveryStatus: 'SCHEDULED',
          },
        ],
      },
    },
  });

  const camisaPurchaseItem = purchaseOrder.items.find((item) => item.budgetItemId === camisa.id);

  const camisaRule = await prisma.replenishmentRule.create({
    data: {
      budgetItemId: camisa.id,
      triggerType: 'FROM_DELIVERY',
      intervalUnit: 'MONTH',
      intervalValue: 6,
      warningDays: 30,
      notes: 'Reposicao semestral de uniforme.',
    },
  });

  await prisma.replenishmentEvent.create({
    data: {
      replenishmentRuleId: camisaRule.id,
      purchaseOrderItemId: camisaPurchaseItem?.id,
      baseDateUsed: new Date('2026-03-18T00:00:00.000Z'),
      plannedDate: new Date('2026-09-18T00:00:00.000Z'),
      notes: 'Primeira reposicao prevista automaticamente.',
    },
  });

  const luvaRule = await prisma.replenishmentRule.create({
    data: {
      budgetItemId: luva.id,
      triggerType: 'MANUAL',
      intervalUnit: 'MONTH',
      intervalValue: 3,
      warningDays: 20,
      baseDate: new Date('2026-04-01T00:00:00.000Z'),
      notes: 'Reposicao trimestral de EPI.',
    },
  });

  await prisma.replenishmentEvent.create({
    data: {
      replenishmentRuleId: luvaRule.id,
      baseDateUsed: new Date('2026-04-01T00:00:00.000Z'),
      plannedDate: new Date('2026-07-01T00:00:00.000Z'),
      notes: 'Evento inicial da regra manual.',
    },
  });

  await prisma.project.create({
    data: {
      code: 'TRC-2026',
      name: 'Tribunal Regional de Contas',
      organizationName: 'TRC',
      bidNumber: 'PE 009/2026',
      projectStatus: 'PLANNED',
      implementationStatus: 'NOT_STARTED',
      plannedStartDate: new Date('2026-06-20T00:00:00.000Z'),
      objectSummary:
        'Servicos de recepcao, portaria e apoio administrativo para sedes regionais.',
      contractDurationMonths: 12,
      budgetItems: {
        create: [
          {
            itemCategory: 'UNIFORM',
            name: 'Uniforme social',
            unit: 'kit',
            plannedQuantity: decimal(72),
            bidUnitValue: decimal(214),
          },
        ],
      },
      roles: {
        create: [
          {
            roleName: 'Recepcionista',
            workloadLabel: '12x36',
            plannedHeadcount: 20,
          },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      projectId: project.id,
      supplierId: epiSupplier.id,
      purchaseStatus: 'UNDER_REVIEW',
      purchaseDate: new Date('2026-03-19T00:00:00.000Z'),
      internalReference: 'PC-2026-003',
      notes: 'Cotacao complementar de EPIs.',
    },
  });

  const hashPassword = (plain: string) => bcrypt.hashSync(plain, 12);

  await prisma.user.create({
    data: {
      email: 'admin@sitecompras.local',
      passwordHash: hashPassword('Admin@123'),
      name: 'Administrador',
      role: 'ADMIN',
    },
  });
  await prisma.user.create({
    data: {
      email: 'usuario@sitecompras.local',
      passwordHash: hashPassword('Usuario@123'),
      name: 'Usuário operacional',
      role: 'USER',
    },
  });
  await prisma.user.create({
    data: {
      email: 'aprovador@sitecompras.local',
      passwordHash: hashPassword('Aprovador@123'),
      name: 'Aprovador',
      role: 'APPROVER',
    },
  });

  console.log('Seed concluida com sucesso.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
