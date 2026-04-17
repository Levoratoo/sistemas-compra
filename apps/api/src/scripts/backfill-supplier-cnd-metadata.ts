import 'dotenv/config';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { extractSupplierCndMetadataFromFile } from '../utils/supplier-cnd-parser.js';
import { ensureRelativeStoragePath } from '../utils/file.js';
import { refreshSupplierCndAggregateFields } from '../services/supplier-cnd-sync.service.js';

async function readMasterBuffer(masterStoragePath: string): Promise<Buffer> {
  const relative = ensureRelativeStoragePath(masterStoragePath);
  const absolute = path.resolve(env.APP_ROOT, relative);
  return readFile(absolute);
}

async function main() {
  const attachments = await prisma.supplierCndAttachment.findMany({
    orderBy: [{ supplierId: 'asc' }, { createdAt: 'desc' }],
  });

  let attachmentUpdated = 0;
  let skipped = 0;

  for (const attachment of attachments) {
    try {
      const buffer = await readMasterBuffer(attachment.masterStoragePath);
      const parsed = await extractSupplierCndMetadataFromFile(
        buffer,
        attachment.originalFileName,
        attachment.mimeType,
      );

      if (!parsed?.validUntil) {
        skipped += 1;
        continue;
      }

      await prisma.supplierCndAttachment.update({
        where: { id: attachment.id },
        data: {
          parsedIssuedAt: parsed.issuedAt ?? null,
          parsedValidUntil: parsed.validUntil,
          parsedControlCode: parsed.controlCode ?? null,
        },
      });

      attachmentUpdated += 1;
    } catch {
      skipped += 1;
    }
  }

  const supplierIds = [...new Set(attachments.map((a) => a.supplierId))];
  for (const supplierId of supplierIds) {
    await refreshSupplierCndAggregateFields(supplierId);
  }

  console.log(
    `[backfill-cnd-metadata] anexos com parsed preenchido: ${attachmentUpdated}; ignorados/sem validade: ${skipped}; fornecedores reagregados: ${supplierIds.length}`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('[backfill-cnd-metadata] falhou:', error);
  process.exit(1);
});
