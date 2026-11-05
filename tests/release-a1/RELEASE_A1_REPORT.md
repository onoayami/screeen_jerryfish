# Release A1 検証レポート

実施日：2026-10-31
対象：v2.3.4 Phase 0完了状態からのRelease A1（#01・#02・#04）

## 対応範囲

- 配布用`characters/default`の更新を、staging・backup・swap・rollback方式へ変更。
- `config.json`、`actions[].file`、`actions[].effect.file`だけを配布allowlistとしてコピー。
- 通常ファイル、許可拡張子、source内realpath、画像署名、コピー前後SHA-256、staging内の完全なファイル集合を検証。
- 初回利用者フォルダ作成と旧初期素材移行も原子的な置換へ変更。
- 残留stagingとbackupを次回起動時に安全側へ復旧。
- 配布反映失敗を構造化結果として設定画面へ返し、具体的なエラーを表示。
- `BrowserWindow.loadFile()`と起動初期化の失敗をエラーダイアログへ接続。
- 実行時共通モジュールをelectron-builderの配布対象へ追加。

## 自動検証

- Release A1専用テスト：15/15成功。
  - コピー失敗時の旧default保持
  - allowlist以外の素材除外
  - 初回作成失敗時の部分フォルダ掃除
  - swap失敗時のrollback
  - 中断状態からのbackup復旧
  - 成功時の直前backup保持
  - 画像署名不一致の拒否
  - シンボリックリンクの拒否
  - `loadFile()`拒否の通知
  - 起動初期化失敗の通知と安全終了
  - 実行時モジュールの配布対象確認
  - 旧素材移行時の元拡張子維持
  - 旧素材移行失敗時のrollback
  - コピー後SHA-256不一致の拒否
  - rollback失敗時のbackup保護と次回復旧
- Phase 0 harness：4/4成功。
- 既知不具合テスト：T09成功、残り14件はTODO、通常失敗0件。
- `npm run check`：成功。
- テスト前後の現在ソース：同一。
- staging・backup・移行一時ファイルのテスト残留：0件。

## 修正済み判定

- #01 配布反映時の先行削除による既存default消失：修正済み。
- #02 利用者フォルダ全体コピーによる未参照・私的素材混入：修正済み。
- #04 起動／画面読込失敗が無言になる経路：修正済み。
- T09はTODOから通常成功へ変更。

## 未確認・次工程

- Mac実機でのElectron画面・トレイ・設定画面操作。
- electron-builderによるDMG／ZIP生成。
- Apple Silicon／Intel Mac双方での初回起動と更新失敗試験。
- コード署名、公証、Gatekeeper確認。
- Release A2以降の14件の既知不具合。

この段階はRelease A1の実装・自動検証完了であり、利用者向け最終配布版の完成判定ではない。
