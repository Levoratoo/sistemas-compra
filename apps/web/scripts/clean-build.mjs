import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const pathsToClean = ['.next'].map((target) => resolve(process.cwd(), target));

for (const targetPath of pathsToClean) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { force: true, recursive: true });
  }
}
