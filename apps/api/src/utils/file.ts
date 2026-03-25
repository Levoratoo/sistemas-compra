import path from 'node:path';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

export function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function toRelativeProjectPath(absolutePath: string) {
  return path.relative(env.APP_ROOT, absolutePath).split(path.sep).join('/');
}

export function ensureRelativeStoragePath(storagePath: string) {
  const trimmedPath = storagePath.trim();

  if (!trimmedPath) {
    throw new AppError('Storage path must be a non-empty relative path.', 422);
  }

  if (path.isAbsolute(trimmedPath)) {
    throw new AppError('Storage path must be relative to the project.', 422);
  }

  const normalizedPath = trimmedPath.split(path.sep).join('/');
  const safePath = path.posix.normalize(normalizedPath);

  if (safePath === '..' || safePath.startsWith('../') || safePath.startsWith('/')) {
    throw new AppError('Storage path must stay inside the project directory.', 422);
  }

  return safePath;
}
