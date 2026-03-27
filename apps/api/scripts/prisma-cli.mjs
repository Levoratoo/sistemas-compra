import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '..');
const prismaCliPath = path.resolve(appRoot, 'node_modules/prisma/build/index.js');

function prismaCliLooksLikeShellScript() {
  const head = readFileSync(prismaCliPath, 'utf8').slice(0, 500);
  return head.includes('basedir=$(dirname');
}
const generatedClientPath = path.resolve(appRoot, 'node_modules/.prisma/client/index.d.ts');
const generatedSchemaPath = path.resolve(appRoot, 'node_modules/.prisma/client/schema.prisma');
const sourceSchemaPath = path.resolve(appRoot, 'prisma/schema.prisma');
const args = process.argv.slice(2);

function generatedClientLooksUsable() {
  if (!existsSync(generatedClientPath)) {
    return false;
  }

  const generatedTypes = readFileSync(generatedClientPath, 'utf8');

  return (
    generatedTypes.includes('ProjectRole') &&
    generatedTypes.includes('BudgetItem') &&
    generatedTypes.includes('PurchaseOrder') &&
    generatedTypes.includes('ReplenishmentRule') &&
    generatedTypes.includes('DataOriginType')
  );
}

function syncGeneratedSchemaFile() {
  if (!existsSync(sourceSchemaPath) || !existsSync(path.dirname(generatedSchemaPath))) {
    return;
  }

  copyFileSync(sourceSchemaPath, generatedSchemaPath);
}

function runPrismaCli(cliArgs) {
  return spawnSync(process.execPath, [prismaCliPath, ...cliArgs], {
    cwd: appRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

if (!existsSync(prismaCliPath)) {
  console.error('Prisma CLI not found. Run npm install first.');
  process.exit(1);
}

if (prismaCliLooksLikeShellScript()) {
  console.error(
    'node_modules/prisma/build/index.js looks like a shell script (corrupted). ' +
      'Remove node_modules and reinstall (e.g. npm ci). The Prisma bin patch must remove .bin/prisma before writing.',
  );
  process.exit(1);
}

const result = runPrismaCli(args);

if (result.error) {
  throw result.error;
}

const isGenerateCommand = args[0] === 'generate';

if (isGenerateCommand && result.status !== 0 && generatedClientLooksUsable()) {
  console.warn(
    'Prisma generate hit a Windows engine lock, but the generated client is already usable. Continuing.',
  );
  syncGeneratedSchemaFile();
  console.log('Prisma Client ready.');
  process.exit(0);
}

if (isGenerateCommand && result.status === 0) {
  syncGeneratedSchemaFile();
  console.log('Prisma Client ready.');
}

process.exit(result.status ?? 0);
