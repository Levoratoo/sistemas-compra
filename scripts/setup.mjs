import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const rootDir = path.resolve(currentDir, '..');

function parseEnvFile(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function readBootstrapEnv() {
  const rootEnvPath = path.join(rootDir, '.env');
  const rootEnvExamplePath = path.join(rootDir, '.env.example');

  if (fs.existsSync(rootEnvPath)) {
    return {
      envPath: rootEnvPath,
      values: parseEnvFile(fs.readFileSync(rootEnvPath, 'utf8')),
    };
  }

  if (!fs.existsSync(rootEnvExamplePath)) {
    throw new Error('Arquivo .env.example nao encontrado na raiz do projeto.');
  }

  fs.copyFileSync(rootEnvExamplePath, rootEnvPath);

  return {
    envPath: rootEnvPath,
    values: parseEnvFile(fs.readFileSync(rootEnvPath, 'utf8')),
  };
}

function writeFile(targetPath, contents) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${contents.trim()}\n`, 'utf8');
}

const { envPath, values } = readBootstrapEnv();

const apiEnv = `
PORT=${values.PORT ?? '3000'}
CORS_ORIGIN=${values.CORS_ORIGIN ?? 'http://localhost:3001'}
DATABASE_URL=${values.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/sitecompras?schema=public'}
UPLOADS_DIR=${values.UPLOADS_DIR ?? './uploads'}
`;

const webEnv = `
NEXT_PUBLIC_API_URL=${values.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'}
`;

writeFile(path.join(rootDir, 'apps', 'api', '.env'), apiEnv);
writeFile(path.join(rootDir, 'apps', 'web', '.env'), webEnv);
fs.mkdirSync(path.join(rootDir, 'apps', 'api', 'uploads'), { recursive: true });

console.log(`Arquivos .env sincronizados a partir de ${path.relative(rootDir, envPath)}.`);
