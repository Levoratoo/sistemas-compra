import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '..');
const prismaCliWrapperPath = path.resolve(appRoot, 'scripts/prisma-cli.mjs');

const result = spawnSync(process.execPath, [prismaCliWrapperPath, 'generate'], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
