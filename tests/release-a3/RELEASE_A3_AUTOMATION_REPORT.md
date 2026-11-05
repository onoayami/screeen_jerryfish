# Release A3 自動化チェックポイント報告

実施日：2026-10-31
対象：desktop-mascot-ui v2.3.4
ブランチ：`release-a3-reproducible-validation`

## 判定

Release A3のうち、Linux／Node上で根拠を持って完了できる自動化を実装した。

- #20「build-timeとruntimeの設定検証共通化」：完了
- #31「文書本文の文字化けとフォルダ名違い」：完了
- #30「UTF-8ソースZIP作成と自動検査」：自動化部分は完了
- #19「Mac実機で確認した依存版・lockfile・Node・最低macOSの固定」：未完了
- #30のmacOS標準解凍／Windows実解凍：未確認

このチェックポイントは、A3全体または利用者向け最終配布版の完成判定ではない。

## Git履歴

- 赤テスト：`e0fd4ac` — `Add failing Release A3 reproducibility tests`
- 共通設定検証：`0ab1b1d` — `Unify runtime and build-time config validation`
- UTF-8 ZIP／文書検査：`68605fd` — `Add deterministic UTF-8 source packaging checks`

## 実装内容

### 共通設定検証

- `shared/config-rules.js`へ型、範囲、列挙値、最短≦最長、旧形式移行を集約した。
- runtimeと`npm run check`が同じ検証器を使用する。
- 未指定値だけ既定値へ移行し、明示された不正値は`actions[0].durationMs`など項目名付きで拒否する。
- build-timeでは通常ファイル、realpath、画像署名も共通素材検証へ接続した。
- T10・T11・T12をTODOから通常テストへ昇格した。

### 文書検査

- UTF-8として読めない配布テキストを拒否する。
- 置換文字`U+FFFD`をファイル名付きで報告する。
- 日本語ファイル名のUnicode NFCを検査する。
- 誤った固定名`desktop-mascot-starter`を説明書から削除し、配布ファイルによってフォルダ名が異なることを明記した。

### ソースZIP

- Python `zipfile`で順序、時刻、権限、圧縮条件、先頭フォルダ名を固定した。
- 全非ASCII名のUTF-8フラグ`0x800`を作成後に検査する。
- Gitがある場合は追跡ファイルを基本allowlistにする。
- `characters/default`は`config.json`と参照素材だけを含める。
- Gitがない展開環境では既知のソース構成だけを含める。
- `.git`、`node_modules`、`dist`、`.DS_Store`、`.env`、不明な直下ファイル、未参照画像を除外する。
- シンボリックリンク、欠落ファイル、素材外参照を拒否する。

## 自動テスト結果

- Release A3：8成功／0失敗／2TODO
- Release A2：14成功／0失敗
- Release A1：15成功／0失敗
- Phase 0 harness：4成功／0失敗
- 既知不具合：6成功／9TODO／通常失敗0
- `npm run check`：成功
- 配布テキスト：44ファイルを検査して成功（本報告追加前の計測）

## クリーンZIP検証

- 同じコミット済み入力から2回作成したZIPがバイト単位で一致した。
- Gitなしのクリーン展開先でも全自動テストと`npm run check`が成功した。
- クリーン展開先から再作成したZIPが元ZIPとバイト単位で一致した。
- 日本語名5件すべてにUTF-8フラグがあることを確認した。
- `characters/default`は設定1件と参照素材6件だけであることを確認した。
- 一時ファイル残留は0件だった。

最終チェックポイントZIPは、本報告をコミットしてタグを付けた後に再生成し、ファイル数・サイズ・SHA-256を外部メタデータとNotion計画ページへ記録する。

## 未完了・外部確認

### #19 依存固定

現状は`electron: latest`、`electron-builder: latest`で、`package-lock.json`と`engines`がない。npmレジストリ照会は実行環境のネットワーク制限でタイムアウトし、ローカルにも検証済み依存版やlockfileは残っていなかった。未確認の番号を推測して固定しない。

完了には、Mac実機で次を行う必要がある。

1. 検証対象のNode、npm、Electron、electron-builderを具体版で決定する。
2. `npm install --save-exact`で`package-lock.json`を生成する。
3. `npm ci`からApple Silicon／Intel向けビルドを行う。
4. 最低対応macOSと最新macOSで起動・DMGを確認する。
5. 同じlockfileから再構築した依存版が一致することを記録する。

### #30 外部解凍

Python `zipfile`での作成・展開・UTF-8フラグ検査は完了した。macOS標準解凍とWindowsで、5件の日本語説明書名が一致することは未確認である。

## GitHub退避

ユーザー指定の`onoayami/screeen_jerryfish`は、GitHub連携から空リポジトリであることを確認した。ローカルへ`origin`を設定し、forceなしでpushを試みたが、実行環境から`github.com`を名前解決できず停止した。GitHub側にはコミット、ブランチ、タグ、ファイルを作成していない。

履歴保全のため、このチェックポイントでは全ローカルブランチ・タグを含むGit bundleを作成し、検証・共有する。ネットワークが利用可能になった時点で、安定版A2を`main`、A3を`release-a3-reproducible-validation`としてforceなしでpushする。
