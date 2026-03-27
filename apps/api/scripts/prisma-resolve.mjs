import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Com npm workspaces o pacote `prisma` pode ficar só na raiz do repo em `node_modules`,
 * não em `apps/api/node_modules/prisma`. `require.resolve` segue a resolução correta.
 */
export function resolvePrismaBuildIndexPath(appRoot) {
  const require = createRequire(path.join(appRoot, 'package.json'));
  try {
    return require.resolve('prisma/build/index.js');
  } catch {
    return null;
  }
}

export function resolvePrismaPackageRoot(appRoot) {
  const require = createRequire(path.join(appRoot, 'package.json'));
  try {
    return path.dirname(require.resolve('prisma/package.json'));
  } catch {
    return path.join(appRoot, 'node_modules/prisma');
  }
}
