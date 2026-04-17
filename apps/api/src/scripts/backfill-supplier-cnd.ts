/**
 * Liga documentos CND antigos (só na documentação do projeto) ao modelo global
 * `SupplierCndAttachment` e replica cópias em projetos que ainda não tinham o ficheiro.
 *
 * Uso (na pasta apps/api): `npx tsx src/scripts/backfill-supplier-cnd.ts`
 */
import 'dotenv/config';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { CND_ROOT_FOLDER_NAME } from '../constants/documentation-folders.js';
import { buildSupplierCndFolderLabel } from '../services/supplier-cnd-folders.service.js';
import {
  persistSupplierCndMasterFile,
  replicateSupplierCndAttachmentToProject,
  SUPPLIER_CND_DOCUMENT_NOTES,
} from '../services/supplier-cnd-sync.service.js';
import { ensureRelativeStoragePath } from '../utils/file.js';

async function readDocBuffer(storagePath: string): Promise<Buffer> {
  const relative = ensureRelativeStoragePath(storagePath);
  const absolute = path.resolve(env.APP_ROOT, relative);
  return readFile(absolute);
}

function resolveSupplierForDoc(
  suppliers: { id: string; legalName: string }[],
  folderName: string,
): { id: string; legalName: string } | null {
  const target = folderName.trim().toLowerCase();
  const matches = suppliers.filter(
    (s) => buildSupplierCndFolderLabel(s.legalName).toLowerCase() === target,
  );
  if (matches.length === 1) {
    return matches[0]!;
  }
  if (matches.length > 1) {
    console.warn(`[backfill] Vários fornecedores para pasta "${folderName}" — ignorado.`);
  }
  return null;
}

async function main() {
  const suppliers = await prisma.supplier.findMany({ select: { id: true, legalName: true } });

  const docs = await prisma.projectDocument.findMany({
    where: {
      notes: SUPPLIER_CND_DOCUMENT_NOTES,
      documentType: 'OTHER_ATTACHMENT',
      supplierCndAttachmentId: null,
      folderId: { not: null },
    },
    include: { folder: { include: { parent: true } } },
    orderBy: { createdAt: 'asc' },
  });

  type DocRow = (typeof docs)[number];
  const eligible: DocRow[] = [];
  for (const doc of docs) {
    const folder = doc.folder;
    if (!folder?.parent) {
      continue;
    }
    if (folder.parent.name.trim().toLowerCase() !== CND_ROOT_FOLDER_NAME.toLowerCase()) {
      continue;
    }
    eligible.push(doc);
  }

  if (eligible.length === 0) {
    console.log('[backfill] Nenhum documento CND legível para migrar (ou já migrados).');
    await prisma.$disconnect();
    return;
  }

  const groups = new Map<string, DocRow[]>();
  for (const doc of eligible) {
    const folderName = doc.folder!.name;
    const supplier = resolveSupplierForDoc(suppliers, folderName);
    if (!supplier) {
      console.warn(`[backfill] Fornecedor não encontrado para pasta "${folderName}" — doc ${doc.id}`);
      continue;
    }
    const key = `${supplier.id}::${doc.originalFileName.trim().toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }

  let created = 0;
  let linked = 0;
  let replicated = 0;

  const allProjects = await prisma.project.findMany({ select: { id: true } });

  for (const [, groupDocs] of groups) {
    if (groupDocs.length === 0) {
      continue;
    }
    groupDocs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const first = groupDocs[0]!;
    const folderName = first.folder!.name;
    const supplier = resolveSupplierForDoc(suppliers, folderName);
    if (!supplier) {
      continue;
    }

    const buffer = await readDocBuffer(first.storagePath);
    const attachment = await persistSupplierCndMasterFile(
      supplier.id,
      first.originalFileName,
      buffer,
      first.mimeType ?? undefined,
      'FEDERAL',
      null,
      first.fileSizeBytes ?? buffer.length,
    );
    created += 1;

    const projectIdsWithDoc = new Set(groupDocs.map((d) => d.projectId));
    for (const doc of groupDocs) {
      await prisma.projectDocument.update({
        where: { id: doc.id },
        data: { supplierCndAttachmentId: attachment.id },
      });
      linked += 1;
    }

    for (const { id: projectId } of allProjects) {
      if (projectIdsWithDoc.has(projectId)) {
        continue;
      }
      await replicateSupplierCndAttachmentToProject(projectId, supplier.legalName, attachment, 'FEDERAL', buffer);
      replicated += 1;
    }
  }

  console.log(
    `[backfill] Concluído: ${created} anexo(s) global(is), ${linked} documento(s) ligado(s), ${replicated} réplica(s) em projetos.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('[backfill] Falhou:', error);
  process.exit(1);
});
