import type { FolderSurfaceStyle, ProjectDocumentFolder } from '@prisma/client';

import { documentFolderRepository } from '../repositories/document-folder.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { AppError } from '../utils/app-error.js';
import { serializeProjectDocumentFolder } from '../utils/serializers.js';

export async function validateFolderForProject(projectId: string, folderId: string | null | undefined) {
  if (folderId == null || folderId === '') return;
  const folder = await documentFolderRepository.findByIdInProject(folderId, projectId);
  if (!folder) {
    throw new AppError('Pasta não encontrada neste projeto.', 404);
  }
}

function isUnderFolder(folders: ProjectDocumentFolder[], nodeId: string, ancestorId: string) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  let current: string | null | undefined = nodeId;
  while (current) {
    if (current === ancestorId) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

async function ensureProjectExists(projectId: string) {
  const ok = await projectRepository.exists(projectId);
  if (!ok) throw new AppError('Project not found', 404);
}

class DocumentFolderService {
  async listFolders(projectId: string) {
    await ensureProjectExists(projectId);
    const rows = await documentFolderRepository.listByProject(projectId);
    return rows.map(serializeProjectDocumentFolder);
  }

  async createFolder(
    projectId: string,
    input: {
      name: string;
      parentId?: string | null;
      colorHex?: string;
      iconEmoji?: string | null;
      surfaceStyle?: FolderSurfaceStyle;
    },
  ) {
    await ensureProjectExists(projectId);
    const name = input.name.trim();
    if (!name) {
      throw new AppError('Nome da pasta é obrigatório.', 422);
    }

    let parentId: string | null = input.parentId ?? null;
    if (parentId) {
      const parent = await documentFolderRepository.findByIdInProject(parentId, projectId);
      if (!parent) {
        throw new AppError('Pasta pai não encontrada neste projeto.', 404);
      }
    }

    const siblings = (await documentFolderRepository.listByProject(projectId)).filter(
      (f) => (f.parentId ?? null) === parentId,
    );
    if (siblings.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      throw new AppError('Já existe uma pasta com esse nome neste nível.', 409);
    }

    const created = await documentFolderRepository.create({
      projectId,
      parentId,
      name,
      colorHex: input.colorHex,
      iconEmoji: input.iconEmoji,
      surfaceStyle: input.surfaceStyle,
    });
    return serializeProjectDocumentFolder(created);
  }

  async updateFolder(
    projectId: string,
    folderId: string,
    input: {
      name?: string;
      parentId?: string | null;
      colorHex?: string;
      iconEmoji?: string | null;
      surfaceStyle?: FolderSurfaceStyle;
    },
  ) {
    await ensureProjectExists(projectId);
    const existing = await documentFolderRepository.findByIdInProject(folderId, projectId);
    if (!existing) {
      throw new AppError('Pasta não encontrada.', 404);
    }

    const allFolders = await documentFolderRepository.listByProject(projectId);

    let nextName = existing.name;
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new AppError('Nome da pasta é obrigatório.', 422);
      nextName = trimmed;
    }

    let nextParentId = existing.parentId;
    if (input.parentId !== undefined) {
      nextParentId = input.parentId;
    }

    if (nextParentId) {
      const parent = await documentFolderRepository.findByIdInProject(nextParentId, projectId);
      if (!parent) {
        throw new AppError('Pasta pai não encontrada neste projeto.', 404);
      }
      if (isUnderFolder(allFolders, nextParentId, folderId)) {
        throw new AppError('Não é possível mover a pasta para dentro dela mesma ou de uma subpasta.', 422);
      }
    }

    const parentForSiblings = nextParentId ?? null;
    const siblings = allFolders.filter(
      (f) => (f.parentId ?? null) === parentForSiblings && f.id !== folderId,
    );
    if (siblings.some((s) => s.name.toLowerCase() === nextName.toLowerCase())) {
      throw new AppError('Já existe uma pasta com esse nome neste nível.', 409);
    }

    const updated = await documentFolderRepository.update(folderId, {
      name: input.name !== undefined ? nextName : undefined,
      parentId: input.parentId !== undefined ? nextParentId : undefined,
      ...(input.colorHex !== undefined ? { colorHex: input.colorHex } : {}),
      ...(input.iconEmoji !== undefined ? { iconEmoji: input.iconEmoji } : {}),
      ...(input.surfaceStyle !== undefined ? { surfaceStyle: input.surfaceStyle } : {}),
    });
    return serializeProjectDocumentFolder(updated);
  }

  async deleteFolder(projectId: string, folderId: string) {
    await ensureProjectExists(projectId);
    const existing = await documentFolderRepository.findByIdInProject(folderId, projectId);
    if (!existing) {
      throw new AppError('Pasta não encontrada.', 404);
    }

    const childCount = await documentFolderRepository.countChildFolders(folderId, projectId);
    if (childCount > 0) {
      throw new AppError('Remova ou mova as subpastas antes de excluir esta pasta.', 409);
    }

    const docCount = await documentFolderRepository.countDocumentsInFolder(folderId);
    if (docCount > 0) {
      throw new AppError('Mova ou exclua os documentos desta pasta antes de excluí-la.', 409);
    }

    await documentFolderRepository.deleteById(folderId);
  }
}

export const documentFolderService = new DocumentFolderService();
