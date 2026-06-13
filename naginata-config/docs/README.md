# naginata-config ドキュメント

薙刀式キーボード設定ツール（WebHID / VIAライクUI版）の実装仕様・設計資料。

ソースコードは親フォルダの 3 ファイル（ビルド工程なし・静的配信）:

| ファイル | 役割 |
|---|---|
| `index.html` | アプリシェル（トップバー・サイドバー・ウェルカム画面） |
| `app.js` | 全ロジック（HIDプロトコル層＋状態モデル＋UI描画。単一ファイル、依存なし） |
| `style.css` | VIA風ダークテーマ |

## ドキュメント構成

| 文書 | 内容 |
|---|---|
| [01-architecture.md](01-architecture.md) | 全体構成・状態モデル・書き込み戦略・主要な設計判断・既知の制約 |
| [02-protocol.md](02-protocol.md) | WebHID ベンダープロトコル v2 の仕様（コマンド・フレーミング・値エンコード） |
| [03-ui-spec.md](03-ui-spec.md) | 画面仕様（各ペインの挙動・キーキャップ表示状態・エディタドック・設定ファイル形式） |
| [04-testing.md](04-testing.md) | 検証方法（デモモード・ヘッドレスChromeでのスクリーンショット検証手順） |
| [05-future-work.md](05-future-work.md) | 将来拡張（修飾キーホールド・物理レイアウトの実機読み出し・パススルー/任意カスタムレイヤー。**全項目実装済み**・経緯と設計判断の記録） |

## 経緯

- 旧版はタブ＋テキスト行リスト形式の編集 UI（「端末へ送る」ボタンで一括送信）。
- 2026-06-11 に VIA ライクな UX（物理キーボード描画＋クリック選択＋下部パレット＋即時書込）へ全面刷新。
  この時点では HID プロトコル（v2）とファームウェアは無変更（UI 層のみの作り替え）。
- 2026-06-12 に 05-future-work の全項目を実装（fw 0.3 と同時改修）: capability ビットによる
  新旧 FW 自動判別・TAG_HOLD・READ_MATRIX_FULL/READ_LAYOUT・QWERTY パススルー／
  カスタムレイヤー（SEC_CUSTOM・MO(n)/TG(n)）。プロトコルは v2 のままワイヤ互換の追加のみ。

## ファームウェアとの同期が必要な箇所

`app.js` 内の以下のテーブルはファームウェア側の定義のミラーであり、ファーム変更時に手動同期が必要:

| `app.js` 内 | 同期元 |
|---|---|
| `CMD` / `SEC` / `CAP` / レポート構造 | `firmware/src/usb_config.rs` |
| `TAG_*` / `PSEUDO_*` / `PFLAG_*` | `naginata-core/src/config.rs` |
| `SYMBOLS`（記号名 → usage, modifiers） | `build.rs` の `symbol_to_keys` |
| `SC_LABEL`（スキャンコード → QWERTYラベル） | `layout/naginata.yaml` |
| `SHIFT_BITS`（シフトビット → 面名） | `layout/naginata.yaml` の `shifts` |
