# Release C 資源上限・非同期ライフサイクル検証報告

実施日：2026-11-01
対象：desktop-mascot-ui v2.3.4 修正ブランチ

## 実装した契約

- 画像1ファイルを20MB以下に制限し、署名読込・デコードより前に拒否する。
- デコード後の画像を16MP以下に制限する。
- GIFを200フレーム以下、展開見積り256MP以下に制限する。
- 動作を最大100件に制限する。
- 実行画面とサイズ計測の画像処理を最大4並列に制限する。
- 追従エフェクトを最大100個に制限し、停止・非表示・再読込・終了時にDOMとタイマーを一括解放する。
- サイズ計測キャッシュを100件、TTL 6秒に制限し、失敗時削除とsize／mtime更新検知を行う。
- サイズ統一画面とJPG変換へ世代番号を付け、古い非同期結果を破棄する。
- JPG保存中はキャンセル系操作を無効化し、終了時にイベントとCanvasを解放する。
- JPGプレビューのBase64重複IPC転送を廃止する。

## 自動検証結果

- Release C専用：12/12 pass、todo 0、fail 0
- Release B：12/12 pass
- Release A3：15 pass、外部実機項目2 todo、fail 0
- Release A2：14/14 pass
- Release A1：15/15 pass
- Phase 0 harness：4/4 pass
- known defects：終了コード0（Release D対象のT05のみtodo）
- `npm run check`：成功
- JavaScript構文検査：成功
- `git diff --check`：成功

## 外部検証境界

Mac実機での長時間メモリ推移、署名・公証、Gatekeeper、Windows標準展開は、このLinux環境では実施済み扱いにしない。対応するA3外部検証項目は保留のままとする。
