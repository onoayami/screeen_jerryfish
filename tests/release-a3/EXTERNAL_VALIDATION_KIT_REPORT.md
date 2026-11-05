# Release A3 実機検証キット報告

実施日：2026-10-31
対象：desktop-mascot-ui v2.3.4
ブランチ：`release-a3-reproducible-validation`

## 判定

Mac／WindowsでA3の残項目を検証するためのダブルクリック式キットを作成し、Linux上で確認できる構文・静的検査・回帰テストを完了した。

これは実機確認の準備完了であり、#19または#30の完了判定ではない。Mac／Windowsから証跡が返るまで、A3全体と利用者向け最終配布版を完成扱いにしない。

## 赤テスト

- `6b6dfae` — `Add failing A3 external validation kit tests`
  - 展開検査、Macランチャー、Windowsランチャー、ZIP fallback、実機ガイド、`.ps1`／`.bat`文字コード検査の6件を赤にした。
- `fb9a806` — `Add failing locked dependency launcher test`
  - lockfile確定後も`setup.command`が`npm install`を使う問題を追加で赤にした。

## 実装内容

### Mac

- `A3-Mac実機検証.command`をダブルクリック入口にした。
- 配布ソースZIPをmacOSアーカイブユーティリティで展開した直後のフォルダだけを対象にする。
- 原本を`/tmp`へコピーし、一時コピーだけで依存候補を変更する。
- `electron@latest`と`electron-builder@latest`を一時コピーで解決し、`--save-exact`で具体版へ固定する。
- 候補`package.json`と`package-lock.json`を証跡へ保存するが、原本へ自動反映しない。
- `npm ci`、設定検査、A3・A2・A1・Phase 0・既知不具合、Universalビルドを実行する。
- 自動署名探索を停止したテストビルドとし、DMG検査、成果物SHA-256、アプリCPU構成を記録する。
- 実行前後の原本ツリーハッシュを照合する。
- 結果ZIPとビルド出力をデスクトップへ分離して作る。

### Windows

- `A3-Windows解凍確認.bat`からPowerShell検査をダブルクリック起動する。
- Windowsエクスプローラー標準展開後の6件の日本語説明書名を検査する。
- Unicode NFC、厳格UTF-8、本文／名前の`U+FFFD`を検査する。
- OS版、CPU、件数、結果だけをデスクトップの結果テキストへ保存する。

### 配布ビルド安全停止

- 4つの`npm run build:mac:*`は、Electron／electron-builderの完全固定とlockfile一致を先に検査する。
- `build-mac.command`はlockfileがなければ停止し、確定後は`npm ci`を使う。
- `setup.command`と`start.command`も、lockfileがある場合は`npm ci`を優先する。
- lockfileなしのローカル開発では警告付き`npm install`を許可するが、配布ビルドは許可しない。

## プライバシー境界

収集しないもの：

- 環境変数一覧
- Apple ID、パスワード、APIキー、トークン
- キーチェーン、証明書一覧
- 利用者名を含む絶対パス
- 元プロジェクトの私用・未参照ファイル

証跡ログ内のホームパスと一時フォルダパスは共有前に置換する。ビルド本体は大きいため、小さな証跡ZIPへ含めない。

## Linux上の自動確認

- 実機検証キット専用：7/7成功
- Release A3：15成功／0失敗／2TODO
- Release A2：14/14成功
- Release A1：15/15成功
- Phase 0 harness：4/4成功
- 既知不具合：6成功／9TODO／通常失敗0
- 配布テキスト：52ファイル成功（本報告追加前）
- 現在ツリー：66ファイルの展開検査成功（本報告追加前）
- 完全固定依存＋模擬lockfile：ビルド固定検査とPhase 0 package guard成功
- Bash、Node、Python構文：成功
- lockfileなしの配布ビルド：意図どおり安全停止

## 実機で残る確認

### #19

- Macで解決されたElectron／electron-builder具体版
- Node／npm版
- 候補lockfileからの`npm ci`
- Universalビルド
- Apple Silicon実起動
- Intel実起動
- 最低対応macOSの決定と実起動

### #30

- macOSアーカイブユーティリティ展開後の日本語名
- Windowsエクスプローラー展開後の日本語名
- 両OSの結果に`U+FFFD`がないこと

### 利用者向け最終配布

- 実画面、ドラッグ、クリック透過
- DMGからApplicationsへのコピーと起動
- Developer ID署名、公証、Gatekeeper

## 次の手順

1. 新しい検証キットZIPをMac標準機能で展開する。
2. `A3-Mac実機検証.command`をダブルクリックする。
3. デスクトップの結果ZIPを回収する。
4. Windowsでは標準展開後に`A3-Windows解凍確認.bat`をダブルクリックする。
5. 証跡をレビューして具体版、lockfile、Node、最低macOSを原本へ反映する。
6. 同じlockfileで再回帰し、#19・#30と`release-a3-complete`を判断する。
