# Phase 0 実施結果 — desktop-mascot-ui v2.3.4

実施日：2026-10-31  
対象ZIP SHA-256：`009c8f66b9f2dcbb7bac2026636ba6322bb7993fe824ebbdd8a11b85c5b5fcfd`  
基準Gitコミット：`caf28d5`（tag: `v2.3.4-baseline`）  
環境：Linux / Node.js v24.22.1

## 結論

Phase 0の安全網構築は完了した。元のv2.3.4を保持した作業コピー、基準ハッシュ、使い捨てテスト環境、main／renderer／settings用VMローダー、T01〜T15の再現テスト、共通ルールの土台、Mac実機チェックリストを作成した。

製品バグの修正はまだ行っていない。T01〜T15はすべてv2.3.4で再現し、修正後に満たすべき期待値をTODOテストとして固定した。

## 基準保護

- 元ZIPと展開済みソースの36ファイルが完全一致することを確認した。
- 作業先を`desktop-mascot-ui-phase0`へ分離した。
- 元36ファイルのパス、容量、SHA-256を保存した。
- 35ファイルは現在も基準ハッシュと完全一致する。
- `package.json`の差分はPhase 0用テストスクリプト3件だけで、依存・ビルド・版番号は不変。
- 一時プロジェクトには元のv2.3.4 `package.json`を使う。
- 各テスト終了時に基準不変チェックを必ず実行する。

## テスト結果

### 安全網

- 4件実行
- 4件成功
- 失敗0件

確認内容：基準マニフェスト、一時フォルダ隔離、3種類のVMローダー、共通ルールモジュール。

### T01〜T15

- 15件実行
- 15件すべて既知バグとして再現
- 通常失敗0件
- TODO 15件
- スキップ0件

| ID | 実測結果 | 状態 | 次の修正先 |
|---|---|---|---|
| T01 | 外部リンクが実パスとして許可された | 再現 | #10 / Release A2 |
| T02 | `actions`ディレクトリが画像として通過した | 再現 | #10 / Release A2 |
| T03 | `previewActionIndex:null`が0として送信された | 再現 | #32 / Release B2 |
| T04 | 800×600でも1000pxのままで、負座標になる | 再現 | #09 / Release B5 |
| T05 | 重み10:1の選択比が1:1 | 再現 | #06 / Release D1 |
| T06 | margin 0でY=368、期待Y=408 | 再現 | #26 / Release B5 |
| T07 | 2回要求してもImage生成1回 | 再現 | #15 / Release C2 |
| T08 | localStorage例外が外へ漏れた | 再現 | #23 / Release B4 |
| T09 | コピー失敗後に配布用defaultが空になった | 再現 | #01 / Release A1 |
| T10 | 不正時間・速度・ディレクトリ参照でexit 0 | 再現 | #20 / Release A3 |
| T11 | `actions:[null]`でTypeError | 再現 | #20 / Release A3 |
| T12 | root `null`でTypeError | 再現 | #20 / Release A3 |
| T13 | 保存API 0回でも「保存済み・反映済み」 | 再現 | #05 / Release B2 |
| T14 | margin 0の開始位置が`{40,40}` | 再現 | #26 / Release B5 |
| T15 | 移動後に透過状態を再評価しない | 再現 | #07 / Release B4 |

## 追加した基盤

- `tests/phase0/helpers/workspace.mjs`：一時プロジェクトと基準保護
- `tests/phase0/helpers/dom-stub.mjs`：DOM／Canvas最小スタブ
- `tests/phase0/helpers/loaders.mjs`：実コードVMローダー
- `tests/phase0/harness.test.mjs`：安全網テスト
- `tests/phase0/known-defects.test.mjs`：T01〜T15
- `tests/phase0/T01-T15.md`：レビュー対応表
- `tests/phase0/mac-manual-checklist.md`：Mac実機項目
- `shared/config-rules.js`：設定ルールの共通化先
- `shared/asset-validation.js`：素材検証の共通化先

## 共通モジュールの扱い

Phase 0では共通モジュールをアプリ本体へ接続していない。現在の動作を変えず、Release A/Bでmain、settings、check-configから同じルールを参照できる置き場所だけを準備した。

## Mac実機で保留する項目

- T04：小画面・表示倍率・Dock変更後の実表示
- T09：権限拒否、容量不足、途中終了、次回起動復旧
- T13：Electron実画面での保存・反映表示
- T15：macOSの実クリック透過とドラッグ
- Spaces、フルスクリーン、スリープ、画面着脱
- Intel／Apple Silicon、最低対応macOS
- DMG、署名、公証、Gatekeeper

未実施項目を成功扱いにはしていない。

## Phase 0完了条件

- [x] v2.3.4基準ZIP・ソース・SHA-256を固定
- [x] 作業コピーと基準Gitタグを作成
- [x] テストが実データを変更しない構造を作成
- [x] T01〜T15を自動テストへ対応付け
- [x] T01〜T15をすべて再現
- [x] 共通設定・素材検証モジュールの置き場所を作成
- [x] Mac実機チェック項目を文書化
- [ ] Mac実機確認（Release A以降の修正後に実施）

## 次の着手点

Release A1として、#01・#02・#04をまとめて扱う。最初にT09のTODOを外して赤いテストにし、配布用defaultを`staging → 検証 → backup → rename`で切り替える実装を行う。未参照画像を含めないallowlistと、起動時の残留staging／backup復旧を同じトランザクション設計で扱う。
