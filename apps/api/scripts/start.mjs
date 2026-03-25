/**
 * Produção: aplica migrações pendentes e inicia o servidor.
 * Idempotente — `migrate deploy` só faz algo quando há migrações novas.
 *
 * Para pular migrações (ex.: troubleshooting): SKIP_PRISMA_MIGRATE_ON_START=1
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const prismaCli = path.join(appRoot, 'scripts/prisma-cli.mjs');

if (process.env.SKIP_PRISMA_MIGRATE_ON_START !== '1') {
  const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: appRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }
}

const server = spawnSync(process.execPath, [path.join(appRoot, 'dist/server.js')], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
});

process.exit(server.status ?? 0);
