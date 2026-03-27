import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '..');
const patchPrismaBinPath = path.resolve(appRoot, 'scripts/patch-prisma-bin.mjs');
const prismaCliWrapperPath = path.resolve(appRoot, 'scripts/prisma-cli.mjs');

/** Repara prisma/build/index.js no Linux (cache) antes do generate; no Windows aplica o patch dos bins. */
const patchResult = spawnSync(process.execPath, [patchPrismaBinPath], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
});
if (patchResult.status !== 0) {
  process.exit(patchResult.status ?? 1);
}

const result = spawnSync(process.execPath, [prismaCliWrapperPath, 'generate'], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
