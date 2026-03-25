import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '..');
const distDir = path.resolve(appRoot, 'dist');

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
