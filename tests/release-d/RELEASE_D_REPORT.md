# Release D 仕様整合・表示品質・保守性 検証報告

実施日：2026-11-01
対象：desktop-mascot-ui v2.3.4 修正ブランチ

## 対応した項目

- **#06** 現在の動作も重み付き抽選へ含め、2動作・重み10:1の長期選択回数を約10:1にした。同じ動作の連続を許容し、選択回数と表示時間が別であることをUI・README・説明書へ明記した。
- **#27** マスコット位置描画を`translate3d`へ変更し、動作名編集は該当カードだけを更新するようにした。ディスプレイ選択はソートを廃止して1回走査にした。
- **#28** 未使用の`migrateLegacyDefaultFootprint`だけを削除し、現役の汎用移行とハッシュ一覧を維持した。680px以下に重複していたサイズ管理CSSを削除した。
- **#29** 901〜1120pxで画像・移動・エフェクトの内部フォームを1列化した。

## 自動検証結果

- Release D専用：9/9 pass、todo 0、fail 0
- 実ブラウザ表示：760／900／901／1000／1120px、文字拡大、長い動作名で横はみ出しなし
- Release C：12/12 pass
- Release B：12/12 pass
- Release A3：15 pass、外部実機項目2 todo、fail 0
- Release A2：14/14 pass
- Release A1：15/15 pass
- Phase 0 harness：4/4 pass
- known defects T01〜T15：15/15 pass、todo 0
- `npm run check`：成功（配布テキスト57ファイル）
- 全JavaScript構文検査：成功
- `git diff --check`：成功

## 検証境界

`translate3d`化、DOM局所更新、ディスプレイ1回走査は自動回帰で固定した。Mac実機でのCPU・フレーム時間、アプリ実起動、署名・公証・Gatekeeper、およびWindows標準展開は、このLinux環境では実施済み扱いにしない。A3の外部検証2項目は保留のままとする。
