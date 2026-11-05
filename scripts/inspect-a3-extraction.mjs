#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

export const EXPECTED_JAPANESE_PATHS = Object.freeze([
  'docs/01_最短で動かす.md',
  'docs/02_画像と動きの設定.md',
  'docs/03_Macアプリの作成と配布.md',
  'docs/04_利用者向け説明書.md',
  'docs/05_配布前チェックリスト.md',
  'docs/06_A3実機検証.md',
]);

const TEXT_EXTENSIONS = new Set([
  '.bat',
  '.command',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.py',
  '.txt',
]);
const EXCLUDED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules']);
const EXCLUDED_FILES = new Set(['.DS_Store']);
const FORBIDDEN_FILE_NAMES = new Set(['.env']);

function portablePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function inspectExtractedSource(root) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const rows = [];
  const normalizedPaths = new Map();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    errors.push('展開したプロジェクトフォルダが見つかりません。');
  } else {
    const walk = (directory) => {
      const entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
        if (EXCLUDED_FILES.has(entry.name)) continue;
        const filePath = path.join(directory, entry.name);
        const relativePath = portablePath(resolvedRoot, filePath);
        const normalizedPath = relativePath.normalize('NFC');

        if (relativePath.includes('\uFFFD')) {
          errors.push(`${relativePath}: ファイル名に置換文字U+FFFDがあります。`);
        }
        if (normalizedPaths.has(normalizedPath)) {
          errors.push(`${normalizedPath}: Unicode NFC正規化後に同名になるファイルがあります。`);
        } else {
          normalizedPaths.set(normalizedPath, relativePath);
        }
        if (entry.isSymbolicLink()) {
          errors.push(`${normalizedPath}: シンボリックリンクは検証対象にできません。`);
          continue;
        }
        if (entry.isDirectory()) {
          walk(filePath);
          continue;
        }
        if (!entry.isFile()) {
          errors.push(`${normalizedPath}: 通常ファイルではありません。`);
          continue;
        }
        if (FORBIDDEN_FILE_NAMES.has(entry.name) || entry.name.startsWith('.env.')) {
          errors.push(`${normalizedPath}: 秘密情報用ファイルは検証キットへ含めません。`);
        }

        let bytes;
        try {
          bytes = fs.readFileSync(filePath);
        } catch (error) {
          errors.push(`${normalizedPath}: ファイルを読めません（${error.message}）。`);
          continue;
        }
        if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          try {
            const text = decoder.decode(bytes);
            if (text.includes('\uFFFD')) {
              errors.push(`${normalizedPath}: 本文に置換文字U+FFFDがあります。`);
            }
            if (text !== text.normalize('NFC')) {
              errors.push(`${normalizedPath}: 本文をUnicode NFCへ統一してください。`);
            }
          } catch (error) {
            errors.push(`${normalizedPath}: UTF-8として読めません（${error.message}）。`);
          }
        }
        rows.push({ path: normalizedPath, sha256: sha256(bytes) });
      }
    };
    walk(resolvedRoot);
  }

  rows.sort((left, right) => left.path.localeCompare(right.path));
  const availablePaths = new Set(rows.map((row) => row.path));
  for (const expectedPath of EXPECTED_JAPANESE_PATHS) {
    if (!availablePaths.has(expectedPath)) {
      errors.push(`${expectedPath}: 標準解凍後に期待する日本語説明書が見つかりません。`);
    }
  }
  const treeInput = rows.map((row) => `${row.path}\0${row.sha256}\n`).join('');
  return {
    status: errors.length === 0 ? 'ok' : 'error',
    expectedJapanesePaths: [...EXPECTED_JAPANESE_PATHS],
    fileCount: rows.length,
    treeSha256: sha256(treeInput),
    errors,
  };
}

function parseArguments(values) {
  const args = { root: process.cwd(), output: null };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--root') args.root = values[++index];
    else if (value === '--output') args.output = values[++index];
    else throw new Error(`不明な引数です：${value}`);
    if (!args.root && value === '--root') throw new Error('--root の値がありません。');
    if (!args.output && value === '--output') throw new Error('--output の値がありません。');
  }
  return args;
}

function run() {
  let args;
  try {
    args = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const report = inspectExtractedSource(args.root);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), serialized, 'utf8');
  }
  if (report.status === 'ok') {
    console.log(`展開検査OK: ${report.fileCount}ファイル、日本語説明書${report.expectedJapanesePaths.length}件を確認しました。`);
  } else {
    console.error('展開検査で問題が見つかりました:');
    report.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) run();
