#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

pause() {
  read -r -p "Enterキーで閉じます。" _ || true
}

handle_error() {
  local status=$?
  trap - ERR
  echo ""
  echo "エラーで停止しました。上のメッセージを確認してください。"
  pause
  exit "$status"
}

trap handle_error ERR

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.jsが見つかりません。先にsetup.commandをダブルクリックしてください。"
  pause
  exit 1
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  if [ -f package-lock.json ] && node scripts/check-build-lock.js >/dev/null 2>&1; then
    echo "確認済みの固定依存を準備します…"
    npm ci
  else
    echo "注意：依存が未固定の開発途中版です（ローカル確認用。配布ビルドには使えません）。"
    npm install --no-package-lock
  fi
fi

npm start
