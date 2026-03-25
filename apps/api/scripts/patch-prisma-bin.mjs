import { chmodSync, existsSync, lstatSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/**
 * Em Linux/macOS, `node_modules/.bin/prisma` costuma ser um symlink para
 * `prisma/build/index.js`. Escrever por cima segue o symlink e **corrompe** o CLI
 * real do Prisma. Removemos o link/ficheiro antes de gravar o nosso wrapper.
 */
function safeWriteExecutable(filePath, content) {
  if (existsSync(filePath)) {
    try {
      const st = lstatSync(filePath);
      if (st.isSymbolicLink() || st.isFile()) {
        unlinkSync(filePath);
      }
    } catch {
      // ignora
    }
  }
  writeFileSync(filePath, content, 'utf8');
}

safeWriteExecutable(prismaShPath, shellWrapper);
safeWriteExecutable(prismaCmdPath, cmdWrapper);
safeWriteExecutable(prismaPs1Path, ps1Wrapper);

chmodSync(prismaShPath, 0o755);

console.log('Prisma CLI wrapper patched successfully.');
