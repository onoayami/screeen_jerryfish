#!/bin/bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.jsが見つかりません。Node.jsのLTS版を入れてください。"
  open "https://nodejs.org/"
  read -r -p "Enterキーで閉じます。"
  exit 1
fi

if [ ! -f "package-lock.json" ]; then
  echo "配布ビルドを安全停止しました。"
  echo "Mac実機で確認したpackage-lock.jsonがまだありません。"
  echo "先に A3-Mac実機検証.command をダブルクリックしてください。"
  open "docs/06_A3実機検証.md"
  read -r -p "Enterキーで閉じます。"
  exit 1
fi

echo "固定済み依存をクリーンインストールします…"
npm ci

echo "Apple Silicon・Intel両対応のMacアプリを作成します…"
npm run build:mac:universal
open "dist"

echo "distフォルダに配布用ファイルを作成しました。"
read -r -p "Enterキーで閉じます。"
