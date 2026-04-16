/**
 * Produção: sobe o HTTP **em paralelo** com `migrate deploy`.
 * Antes o migrate corria com spawnSync *antes* do servidor — no Render o health check
 * expirava porque nada escutava na PORT a tempo.
 *
 * Para pular migrações no arranque: SKIP_PRISMA_MIGRATE_ON_START=1
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const prismaCli = path.join(appRoot, 'scripts/prisma-cli.mjs');
const serverJs = path.join(appRoot, 'dist/server.js');

const skipMigrate = process.env.SKIP_PRISMA_MIGRATE_ON_START === '1';
const failOnMigrateError = process.env.FAIL_ON_PRISMA_MIGRATE_ERROR === '1';

const server = spawn(process.execPath, [serverJs], {
  cwd: appRoot,
  env: process.env,
  stdio: 'inherit',
});

let migrateChild = null;

if (!skipMigrate) {
  migrateChild = spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: appRoot,
    env: process.env,
    stdio: 'inherit',
  });

  migrateChild.on('exit', (code, signal) => {
    if (code !== 0) {
      if (failOnMigrateError) {
        try {
          server.kill(signal ?? 'SIGTERM');
        } catch {
          // ignore
        }
        process.exit(code ?? 1);
      }

      console.warn(
        `[WARN] prisma migrate deploy falhou no startup (codigo ${code ?? 'desconhecido'}). ` +
          'A API continuara em execucao. Defina FAIL_ON_PRISMA_MIGRATE_ERROR=1 para tornar isso fatal.',
      );
    }
  });

  migrateChild.on('error', (error) => {
    if (failOnMigrateError) {
      console.error('[ERROR] Falha ao iniciar prisma migrate deploy.', error);
      try {
        server.kill('SIGTERM');
      } catch {
        // ignore
      }
      process.exit(1);
    }

    console.warn('[WARN] Falha ao iniciar prisma migrate deploy; a API continuara em execucao.', error);
  });
}

server.on('exit', (code, signal) => {
  if (migrateChild && !migrateChild.killed) {
    migrateChild.kill(signal ?? 'SIGTERM');
  }
  process.exit(code ?? 0);
});
