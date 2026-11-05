'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_DEPENDENCIES = ['electron', 'electron-builder'];
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function validateBuildLock(root = path.resolve(__dirname, '..')) {
  const errors = [];
  const packagePath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(packagePath)) return ['package.jsonが見つかりません。'];
  if (!fs.existsSync(lockPath)) {
    return ['package-lock.jsonがありません。A3-Mac実機検証.commandで依存候補を検証してください。'];
  }

  let packageJson;
  let lock;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    errors.push(`package.jsonを読めません：${error.message}`);
    return errors;
  }
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (error) {
    errors.push(`package-lock.jsonを読めません：${error.message}`);
    return errors;
  }

  const lockedRoot = lock.packages && lock.packages[''];
  if (!lockedRoot || typeof lockedRoot !== 'object') {
    errors.push('package-lock.jsonのルート依存情報がありません。');
    return errors;
  }
  for (const dependency of REQUIRED_DEPENDENCIES) {
    const declared = packageJson.devDependencies && packageJson.devDependencies[dependency];
    const lockedDeclaration = lockedRoot.devDependencies && lockedRoot.devDependencies[dependency];
    const resolved = lock.packages[`node_modules/${dependency}`]
      && lock.packages[`node_modules/${dependency}`].version;
    if (typeof declared !== 'string' || !EXACT_VERSION.test(declared)) {
      errors.push(`${dependency}を完全な版番号へ固定してください（現在：${declared || '未指定'}）。`);
      continue;
    }
    if (lockedDeclaration !== declared) {
      errors.push(`${dependency}のpackage.jsonとpackage-lock.jsonが一致しません。`);
    }
    if (resolved !== declared) {
      errors.push(`${dependency}の解決版が固定値と一致しません（${resolved || '未解決'}）。`);
    }
  }
  return errors;
}

function run() {
  const errors = validateBuildLock();
  if (errors.length > 0) {
    console.error('\n配布ビルドを停止しました:\n');
    errors.forEach((error) => console.error(`- ${error}`));
    console.error('\n未確認のlatest依存で配布物を作らないための安全停止です。\n');
    process.exitCode = 1;
    return;
  }
  console.log('依存固定OK: Electron・electron-builder・package-lock.jsonが一致しています。');
}

if (require.main === module) run();

module.exports = { validateBuildLock };
