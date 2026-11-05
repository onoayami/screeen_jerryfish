import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, '../..');
const expectedJapaneseDocs = [
  'docs/01_最短で動かす.md',
  'docs/02_画像と動きの設定.md',
  'docs/03_Macアプリの作成と配布.md',
  'docs/04_利用者向け説明書.md',
  'docs/05_配布前チェックリスト.md',
  'docs/06_A3実機検証.md',
];

function combinedOutput(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function writeExpectedDocs(root) {
  for (const relativePath of expectedJapaneseDocs) {
    const filePath = path.join(root, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `正常な説明：${relativePath}\n`, 'utf8');
  }
}

test('A3-11: the extracted-source inspector validates Japanese names and UTF-8 text', () => {
  const script = path.join(projectRoot, 'scripts', 'inspect-a3-extraction.mjs');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-a3-inspect-'));
  try {
    writeExpectedDocs(temporaryRoot);
    fs.writeFileSync(path.join(temporaryRoot, 'README.md'), 'read me\n', 'utf8');
    const reportPath = path.join(temporaryRoot, 'report.json');
    const result = spawnSync(process.execPath, [script, '--root', temporaryRoot, '--output', reportPath], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, combinedOutput(result));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.status, 'ok');
    assert.deepEqual(report.expectedJapanesePaths, expectedJapaneseDocs);
    assert.equal(typeof report.treeSha256, 'string');
    assert.match(report.treeSha256, /^[0-9a-f]{64}$/);
    assert.equal(report.errors.length, 0);

    const brokenPath = path.join(temporaryRoot, 'docs', '03_Macアプリの作成と配布.md');
    fs.writeFileSync(brokenPath, '壊れた\uFFFD本文\n', 'utf8');
    const broken = spawnSync(process.execPath, [script, '--root', temporaryRoot], { encoding: 'utf8' });
    assert.notEqual(broken.status, 0);
    assert.match(combinedOutput(broken), /03_Macアプリの作成と配布\.md/);
    assert.match(combinedOutput(broken), /U\+FFFD/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('A3-12: the Mac launcher uses an isolated exact-version validation workflow', () => {
  const launcherPath = path.join(projectRoot, 'A3-Mac実機検証.command');
  assert.ok(fs.existsSync(launcherPath), 'Mac validation launcher is missing');
  const source = fs.readFileSync(launcherPath, 'utf8');
  assert.match(source, /^#!\/bin\/bash/);
  assert.match(source, /uname -s/);
  assert.match(source, /Darwin/);
  assert.match(source, /mktemp -d/);
  assert.match(source, /source-before\.json/);
  assert.match(source, /source-after\.json/);
  assert.match(source, /treeSha256/);
  assert.match(source, /inspect-a3-extraction\.mjs/);
  assert.match(source, /rsync/);
  assert.match(source, /npm install[^\n]*--package-lock-only/);
  assert.match(source, /npm install[^\n]*--ignore-scripts/);
  assert.match(source, /npm install[^\n]*--save-exact/);
  assert.match(source, /electron@latest/);
  assert.match(source, /electron-builder@latest/);
  assert.match(source, /npm ci/);
  assert.match(source, /npm run check/);
  assert.match(source, /npm run test:release-a3/);
  assert.match(source, /npm run test:release-a2/);
  assert.match(source, /npm run test:release-a1/);
  assert.match(source, /npm run test:phase0:harness/);
  assert.match(source, /npm run test:phase0:known-defects/);
  assert.match(source, /npm run build:mac:universal/);
  assert.match(source, /CSC_IDENTITY_AUTO_DISCOVERY=false/);
  assert.match(source, /candidate-package\.json/);
  assert.match(source, /candidate-package-lock\.json/);
  assert.match(source, /ditto[^\n]*-c[^\n]*-k/);
  assert.doesNotMatch(source, /\bprintenv\b|export -p|security find-identity/);
});

test('A3-13: the Windows launcher performs strict UTF-8 and NFC checks only', () => {
  const scriptPath = path.join(projectRoot, 'A3-Windows解凍確認.ps1');
  const launcherPath = path.join(projectRoot, 'A3-Windows解凍確認.bat');
  assert.ok(fs.existsSync(scriptPath), 'Windows validation script is missing');
  assert.ok(fs.existsSync(launcherPath), 'Windows validation launcher is missing');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(source, /UTF8Encoding\(\$false,\s*\$true\)/);
  assert.match(source, /NormalizationForm\]::FormC/);
  assert.match(source, /U\+FFFD/);
  for (const relativePath of expectedJapaneseDocs) {
    assert.ok(source.includes(relativePath), relativePath);
  }
  assert.match(source, /A3-Windows解凍結果/);
  assert.doesNotMatch(source, /Get-ChildItem\s+Env:|Get-Item\s+Env:/i);
  assert.match(launcher, /powershell(?:\.exe)?/i);
  assert.match(launcher, /-NoProfile/i);
  assert.match(launcher, /A3-Windows解凍確認\.ps1/);
});

test('A3-14: fallback source packaging includes external-validation launchers and modes', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-a3-kit-zip-'));
  try {
    const sourceRoot = path.join(temporaryRoot, 'source');
    fs.mkdirSync(path.join(sourceRoot, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'characters', 'default', 'actions'), { recursive: true });
    writeExpectedDocs(sourceRoot);
    fs.writeFileSync(path.join(sourceRoot, 'A3-Mac実機検証.command'), '#!/bin/bash\n', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'A3-Windows解凍確認.ps1'), 'Write-Output ok\n', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'A3-Windows解凍確認.bat'), '@echo off\n', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'scripts', 'inspect-a3-extraction.mjs'), '// inspector\n', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'characters', 'default', 'actions', 'rest.svg'), '<svg/>\n');
    fs.writeFileSync(
      path.join(sourceRoot, 'characters', 'default', 'config.json'),
      `${JSON.stringify({ actions: [{ name: 'rest', file: 'actions/rest.svg' }] }, null, 2)}\n`,
      'utf8',
    );
    const output = path.join(temporaryRoot, 'kit.zip');
    const result = spawnSync('python3', [
      path.join(projectRoot, 'scripts', 'create-source-zip.py'),
      '--root', sourceRoot,
      '--output', output,
      '--prefix', 'desktop-mascot',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, combinedOutput(result));
    const inspect = spawnSync('python3', ['-c', [
      'import json,sys,zipfile',
      'with zipfile.ZipFile(sys.argv[1]) as z:',
      ' print(json.dumps([{"name":i.filename,"mode":(i.external_attr>>16)&0xffff,"flags":i.flag_bits} for i in z.infolist()]))',
    ].join('\n'), output], { encoding: 'utf8' });
    assert.equal(inspect.status, 0, combinedOutput(inspect));
    const entries = JSON.parse(inspect.stdout);
    const names = entries.map((entry) => entry.name);
    assert.ok(names.includes('desktop-mascot/A3-Mac実機検証.command'));
    assert.ok(names.includes('desktop-mascot/A3-Windows解凍確認.ps1'));
    assert.ok(names.includes('desktop-mascot/A3-Windows解凍確認.bat'));
    assert.ok(names.includes('desktop-mascot/scripts/inspect-a3-extraction.mjs'));
    const macEntry = entries.find((entry) => entry.name.endsWith('A3-Mac実機検証.command'));
    assert.equal(macEntry.mode, 0o100755);
    for (const entry of entries.filter((row) => /[^\x00-\x7f]/.test(row.name))) {
      assert.ok(entry.flags & 0x800, entry.name);
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('A3-15: the guide is double-click oriented and release builds require a lockfile', () => {
  const guidePath = path.join(projectRoot, 'docs', '06_A3実機検証.md');
  assert.ok(fs.existsSync(guidePath), 'external validation guide is missing');
  const guide = fs.readFileSync(guidePath, 'utf8');
  assert.match(guide, /ダブルクリック/);
  assert.match(guide, /原本.*変更し/);
  assert.match(guide, /Archive Utility|アーカイブユーティリティ/);
  assert.match(guide, /Windows.*標準|エクスプローラー/);
  assert.match(guide, /結果.*ZIP/);
  assert.match(guide, /未確認.*成功扱い/);

  const buildSource = fs.readFileSync(path.join(projectRoot, 'build-mac.command'), 'utf8');
  assert.doesNotMatch(buildSource, /npm install/);
  assert.match(buildSource, /package-lock\.json/);
  assert.match(buildSource, /npm ci/);
  assert.match(buildSource, /npm run build:mac:universal/);
});

test('A3-16: release-text validation covers PowerShell and batch launchers', () => {
  const checker = require(path.join(projectRoot, 'scripts', 'check-release-text.js'));
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-a3-launcher-text-'));
  try {
    fs.writeFileSync(path.join(temporaryRoot, 'broken.ps1'), '壊れた\uFFFD PowerShell\n', 'utf8');
    fs.writeFileSync(path.join(temporaryRoot, 'broken.bat'), '壊れた\uFFFD batch\n', 'utf8');
    const errors = checker.scanReleaseText(temporaryRoot);
    assert.ok(errors.some((error) => error.includes('broken.ps1') && error.includes('U+FFFD')));
    assert.ok(errors.some((error) => error.includes('broken.bat') && error.includes('U+FFFD')));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});


test('A3-17: locked setup and build paths preserve exact dependency versions', () => {
  const checker = require(path.join(projectRoot, 'scripts', 'check-build-lock.js'));
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mascot-a3-build-lock-'));
  try {
    const dependencies = { electron: '35.1.2', 'electron-builder': '26.0.12' };
    fs.writeFileSync(
      path.join(temporaryRoot, 'package.json'),
      `${JSON.stringify({ devDependencies: dependencies }, null, 2)}\n`,
      'utf8',
    );
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { devDependencies: dependencies },
        'node_modules/electron': { version: dependencies.electron },
        'node_modules/electron-builder': { version: dependencies['electron-builder'] },
      },
    };
    fs.writeFileSync(
      path.join(temporaryRoot, 'package-lock.json'),
      `${JSON.stringify(lock, null, 2)}\n`,
      'utf8',
    );
    assert.deepEqual(checker.validateBuildLock(temporaryRoot), []);
    lock.packages['node_modules/electron'].version = '0.0.0';
    fs.writeFileSync(
      path.join(temporaryRoot, 'package-lock.json'),
      `${JSON.stringify(lock, null, 2)}\n`,
      'utf8',
    );
    assert.ok(checker.validateBuildLock(temporaryRoot).some((error) => error.includes('electron')));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  for (const name of ['build:mac', 'build:mac:arm64', 'build:mac:x64', 'build:mac:universal']) {
    assert.match(packageJson.scripts[name], /^npm run check:build-lock && npm run check && /, name);
  }
  for (const name of ['setup.command', 'start.command']) {
    const source = fs.readFileSync(path.join(projectRoot, name), 'utf8');
    assert.match(source, /package-lock\.json/, name);
    assert.match(source, /npm ci/, name);
  }
});
