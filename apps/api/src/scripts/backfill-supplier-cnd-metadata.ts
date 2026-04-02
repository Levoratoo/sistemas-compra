import 'dotenv/config';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { extractSupplierCndMetadataFromFile } from '../utils/supplier-cnd-parser.js';
import { ensureRelativeStoragePath } from '../utils/file.js';

async function readMasterBuffer(masterStoragePath: string): Promise<Buffer> {
  const relative = ensureRelativeStoragePath(masterStoragePath);
  const absolute = path.resolve(env.APP_ROOT, relative);
  return readFile(absolute);
}

async function main() {
  const attachments = await prisma.supplierCndAttachment.findMany({
    orderBy: [{ supplierId: 'asc' }, { createdAt: 'desc' }],
  });

  const attachmentsBySupplier = new Map<string, (typeof attachments)>();
  for (const attachment of attachments) {
    const current = attachmentsBySupplier.get(attachment.supplierId) ?? [];
    current.push(attachment);
    attachmentsBySupplier.set(attachment.supplierId, current);
  }

  let updated = 0;
  let skipped = 0;

  for (const [supplierId, supplierAttachments] of attachmentsBySupplier.entries()) {
    let applied = false;

    for (const attachment of supplierAttachments) {
      const buffer = await readMasterBuffer(attachment.masterStoragePath);
      const parsed = await extractSupplierCndMetadataFromFile(
        buffer,
        attachment.originalFileName,
        attachment.mimeType,
      );

      if (!parsed?.validUntil) {
        continue;
      }

      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          cndIssuedAt: parsed.issuedAt,
          cndValidUntil: parsed.validUntil,
          cndControlCode: parsed.controlCode ?? null,
          cndSourceFileName: attachment.originalFileName,
        },
      });

      updated += 1;
      applied = true;
      break;
    }

    if (!applied) {
      skipped += 1;
    }
  }

  console.log(`[backfill-cnd-metadata] fornecedores atualizados: ${updated}; sem leitura automatica: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('[backfill-cnd-metadata] falhou:', error);
  process.exit(1);
});
