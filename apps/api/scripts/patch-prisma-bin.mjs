import { chmodSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePrismaBuildIndexPath, resolvePrismaPackageRoot } from './prisma-resolve.mjs';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '..');
const binDir = path.resolve(appRoot, 'node_modules/.bin');

const prismaShPath = path.resolve(binDir, 'prisma');
const prismaCmdPath = path.resolve(binDir, 'prisma.cmd');
const prismaPs1Path = path.resolve(binDir, 'prisma.ps1');

const shellWrapper = `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")

if [ -x "$basedir/node" ]; then
  exec "$basedir/node" "$basedir/../../scripts/prisma-cli.mjs" "$@"
else
  exec node "$basedir/../../scripts/prisma-cli.mjs" "$@"
fi
`;

const cmdWrapper = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0

IF EXIST "%dp0%\\node.exe" (
  SET "_prog=%dp0%\\node.exe"
) ELSE (
  SET "_prog=node"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)

endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\..\\..\\scripts\\prisma-cli.mjs" %*
`;

const ps1Wrapper = `#!/usr/bin/env pwsh
$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent

$exe=""
if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {
  $exe=".exe"
}
$ret=0
if (Test-Path "$basedir/node$exe") {
  if ($MyInvocation.ExpectingInput) {
    $input | & "$basedir/node$exe" "$basedir/../../scripts/prisma-cli.mjs" $args
  } else {
    & "$basedir/node$exe" "$basedir/../../scripts/prisma-cli.mjs" $args
  }
  $ret=$LASTEXITCODE
} else {
  if ($MyInvocation.ExpectingInput) {
    $input | & "node$exe" "$basedir/../../scripts/prisma-cli.mjs" $args
  } else {
    & "node$exe" "$basedir/../../scripts/prisma-cli.mjs" $args
  }
  $ret=$LASTEXITCODE
}
exit $ret
`;

if (!existsSync(binDir)) {
  console.warn('Prisma bin patch skipped because node_modules/.bin was not found yet.');
  process.exit(0);
}

function prismaBuildIndexLooksCorrupted() {
  const buildIndex = resolvePrismaBuildIndexPath(appRoot);
  if (!buildIndex || !existsSync(buildIndex)) {
    return false;
  }
  const head = readFileSync(buildIndex, 'utf8').slice(0, 500);
  return head.includes('basedir=$(dirname') || /^#!\/bin\/sh\r?\nbasedir=/m.test(head);
}

function reinstallPrismaPackage() {
  const pkg = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const spec = pkg.devDependencies?.prisma ?? pkg.dependencies?.prisma ?? '^6.19.0';
  const prismaDir = resolvePrismaPackageRoot(appRoot);
  console.warn('[patch-prisma-bin] prisma/build/index.js looks corrupted; reinstalling prisma package...');
  try {
    const resolved = existsSync(prismaDir) ? realpathSync(prismaDir) : prismaDir;
    rmSync(resolved, { recursive: true, force: true });
  } catch (err) {
    rmSync(prismaDir, { recursive: true, force: true });
  }
  const result = spawnSync('npm', ['install', `prisma@${spec}`, '--no-audit', '--no-fund'], {
    cwd: appRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error('[patch-prisma-bin] Failed to reinstall prisma. Clear Render build cache and redeploy.');
    process.exit(result.status ?? 1);
  }
}

/**
 * Em Linux/macOS, `node_modules/.bin/prisma` é um symlink para
 * `prisma/build/index.js`. Substituir esse ficheiro por um script shell **nunca** é
 * seguro aqui: se a remoção falhar, `writeFile` segue o symlink e corrompe o CLI.
 * No Windows precisamos de wrappers `.cmd`/`.ps1` para o workaround do generate;
 * no Unix deixamos o bin stock da npm (symlink → `build/index.js`).
 */
function safeWriteExecutable(filePath, content) {
  if (existsSync(filePath)) {
    try {
      rmSync(filePath, { force: true });
    } catch (err) {
      console.error(`Failed to remove ${filePath} before patching Prisma bin:`, err);
      process.exit(1);
    }
  }
  writeFileSync(filePath, content, 'utf8');
}

if (process.platform !== 'win32') {
  if (prismaBuildIndexLooksCorrupted()) {
    reinstallPrismaPackage();
  }
  console.log('Prisma bin patch skipped on non-Windows (stock prisma symlink is used).');
  process.exit(0);
}

safeWriteExecutable(prismaShPath, shellWrapper);
safeWriteExecutable(prismaCmdPath, cmdWrapper);
safeWriteExecutable(prismaPs1Path, ps1Wrapper);

chmodSync(prismaShPath, 0o755);

console.log('Prisma CLI wrapper patched successfully (Windows).');
