# 05. 将来拡張案（ファームウェア改修を伴うもの）

ツール側だけでは実現できず、ファームウェア改修が前提となる機能の設計メモ。
着手時はここを起点にレビューする。

**実装状況（2026-06-12）**: 本書の全項目 — §1（ホールド）、§2 Tier 0/1/2
（動的グリッド・READ_MATRIX_FULL・READ_LAYOUT）、§3 Tier A/B（パススルー・任意カスタム
レイヤー）— は **実装済み**（fw 0.3 / capability ビット付き）。
ワイヤ仕様の確定版は [02-protocol.md](02-protocol.md) を正とする。
実機データ（未使用キー位置 `physical_left/right`・形状 `layout_left/right`）も
キー学習による採取値で **記入済み**（2026-06-12。左 30 / 右 29 キー、フラット格子＋
ESC/F行・端列・親指行）。

## 1. 修飾キーのホールド（押しっぱなし保持）【実装済み】

- 新タグ `tag=2 (TAG_HOLD)`（本体 `(usage, mod)` 1ペア）を追加
  （ワイヤ互換。EXTRA とカスタムレイヤー（§3 Tier B）で有効）。
- FW: `main.rs` の `Direct::Hold`。押下で保持リストへ追加、解放で除去し、
  `merge_held()` が全送出レポートへ修飾ビット＋空きスロットの usage を合成する
  （非修飾 usage の保持は最大 4 個）。
- ツール: 直接キーのキー操作エディタに「動作: タップ列 / ホールド」切替
  （capability TAG_HOLD があるときのみ表示）。

## 2. 物理レイアウトの実機からの読み出し

### 段階と実装状況

| Tier | FW改修 | 内容 | 状況 |
|---|---|---|---|
| 0 | 不要 | 描画グリッドの行・列範囲を実機データから動的に決定 | **実装済み**（`renderKeyboard()` が physMap から行・列集合を導出） |
| 1 | 小 | 全物理スイッチを列挙する新コマンド READ_MATRIX_FULL | **実装済み**（下記） |
| 2 | 中 | 形状データをFWに埋め込み読み出す（Vial方式、下記 READ_LAYOUT） | **実装済み**（下記） |

### Tier 1: READ_MATRIX_FULL（cmd 0x0c）【実装済み】

- args: `[2..3]`=start(u16le)。READ_MATRIX と同じページング形式。
- エントリ 5B: `[hand, row, col, sc, flags]`
  - `sc`: 薙刀式キーなら Set-1 スキャンコード、未割当なら 0
  - `flags`: bit0=薙刀式割当あり、bit1=EXTRA割当あり（読出時点）
- 収載対象は `layout/naginata.yaml` の `matrix_left/right` ∪ **`physical_left/right`（新設）**。
  build.rs が `PHYS_LEFT/RIGHT` スライスを生成する。実機の物理スイッチ位置は
  キー学習（READ_LASTKEY）で採取し **記入済み**（ESC・F1-F12・Del・左端 Macro1-4 列・
  右端 PageUp/PageDown/Home/End 列・親指行 Win/Enter/Lower/Raise/BS）。
- ツール側: 未割当キー（sc=0）を破線スタイルで描画し、キーマップ画面でクリックすると
  EXTRA 行を生成してドック編集。学習フローは旧FW・YAML未収載キー向けフォールバックとして残置。

### Tier 2: READ_LAYOUT（cmd 0x0d）【実装済み】

- `build.rs` が `layout/naginata.yaml` の **`layout_left/right`（新設）** から形状データを
  生成し FW フラッシュに埋め込む（`LAYOUT_LEFT/RIGHT`）。Vial が圧縮 KLE JSON を
  HID 経由で読ませるのと同じ発想のバイナリ版。
- 読み出しはページング（7 エントリ/頁）。1キー = 固定長 8B:
  `[hand, row, col, x, y, w, h, rot]`（x/y/w/h は 0.25u 単位、rot は i8 度。
  YAML には u 単位の float で書き、build.rs が量子化する）。
- ツール側: 絶対座標配置でキーキャップを描画（回転 transform 対応）。
  グリッド描画は旧FW・YAML 未記載向けフォールバック。capability LAYOUT は
  **YAML に形状データがあるときだけ立つ**（実機形状は記入済み: 全キー 1u の
  フラット格子、端列・F行は主ブロックから 0.5u 分離）。

### 互換性・検出【実装済み（一部変更）】

- 新コマンド追加のみならプロトコルはワイヤ互換（v2 のまま）。旧ツール × 新FW は無影響。
- 新ツール × 旧FW の検出: INFO 応答の capability ビットで即時判定する。
  **実装は payload `[16]`**（原案の `[8]` は既定テーブル件数 u16le×4 が `[8..15]` を
  使用済みだったため移設）。bit0=MATRIX_FULL, bit1=LAYOUT(予約), bit2=TAG_HOLD,
  bit3=PASSTHROUGH, bit4=CUSTOM_LAYERS(予約)。旧FWはゼロ埋め応答なので自動的に全機能オフ。
- ツール側は READ_MATRIX_FULL → READ_MATRIX 由来の合成（薙刀式キーのみ）の
  フォールバックで新旧 FW 両対応（READ_LAYOUT 実装時はその上に積む）。

## 3. 任意キーマップ（QWERTY等）の追加レイヤー — Lower/Raise 式

### 課題（現状）

入力経路が薙刀式エンジン（かな）＋編集モード＋直接キー（EXTRA）のみで、
**英数字を体系的に打つ手段がない**（日本語しか打てない）。QMK の MO()/TG() のように
「所定キーのホールド中」または「トグル」で QWERTY 等の任意キーマップへ切り替えたい。

### 鍵となる観察

物理キーは Set-1 スキャンコード（= QWERTY 配列そのもの）で管理されているため、
「薙刀式エンジンをバイパスして sc を対応する HID usage にそのまま変換して送出する」
**パススルーモード**なら、マッピングテーブル不要（エントリ 0 件）で素の QWERTY になる。

### 段階と実装状況

| Tier | FW改修 | 内容 | 状況 |
|---|---|---|---|
| A | 小〜中 | **パススルーモード**（QWERTY固定）。ホールド/トグルで薙刀式エンジンをバイパス | **実装済み** |
| B | 大 | **任意カスタムレイヤー**。レイヤーごとの sc→キー操作マップ＋未定義キーはパススルーに透過 | **実装済み** |

### Tier A: パススルーモード【実装済み】

- 有効中は同時打鍵判定を行わず、物理キーの press/release をそのまま HID レポートへ
  （`naginata_core::hid::sc_to_usage` の静的変換のみ。Shift 等の修飾キーも素直に通す。
  同時押しは 6 キー＋修飾まで）。
- **活性化キーの指定に新セクションは不要**: EXTRA（直接キー）の値の `(usage, mod)` 空間に
  内部擬似 usage（`0xF0`=MO(0)（ホールド中有効）、`0xF8`=TG(0)（トグル））を
  単独ペアで書く。FW 内部解釈のみで HID には出さない。
  ※原案の TG_PASS=0xF1 は Tier B の一般化（`0xF8|n`=TG(n)）と衝突するため **0xF8 に変更**して実装。
- IME 自動切替: params flags bit0 で有効化時 LANG2（IME OFF）・解除時 LANG1（IME ON）を
  自動送出（ツールのパラメータ画面にチェックボックス）。
- MO/TG の活性キー自体は EXTRA なのでパススルー中も常に判定される（解除可能）。

### Tier B: 任意カスタムレイヤー【実装済み】

- 新セクション `SEC.CUSTOM = 6`: key = `[layer_id, sc]`、値 = TAG_KEYS（TAG_HOLD・
  擬似 usage 単独ペアも可）。レイヤーごとの sc → キー操作マップ。**未定義の sc は
  パススルーへ透過**（QMK の KC_TRNS 相当が既定）。記号レイヤー等を自由に構成できる。
- 活性化は Tier A の擬似 usage を一般化: `0xF0 | layer_id`=MO(n)、`0xF8 | layer_id`=TG(n)
  （下位 3bit = layer id、最大 8 レイヤー。同時活性時は大きい番号が優先）。
  EXTRA だけでなくカスタムレイヤー内のキーにも割当可能で、レイヤー間遷移も組める。
- INFO に `maxCustomLayers`（=8）を追加（payload `[17]`。原案 `[9]` は件数領域と衝突するため移設）。
- IR 保存（フラッシュ）では custom セクションが**空のときは書かない**: カスタム未使用の
  設定は旧FWへのダウングレード後もそのまま読める（使用時は旧FWでは既定へフォールバック）。

### ツール側 UI【実装済み】

- レイヤーバーにカスタムレイヤーを追加表示（「＋ レイヤー追加」ボタン、上限 maxCustomLayers）。
  値エディタはキー操作タブのみ。未定義キーは「▽（透過）」表示（VIA の KC_TRNS 風）。
- キー操作パレットに「レイヤー操作」グループ（MO(n) / TG(n)。layer 0 は「QWERTY」表記）を追加。
- QWERTY レイヤーはパススルー透過のおかげで実質エントリ 0 件で成立する点をペイン内の注記で案内。

### 互換性・備考

- 新セクション＋擬似 usage の追加のみでワイヤ互換（v2 のまま）。
  capability ビットは payload `[16]` bit3=PASSTHROUGH、bit4=CUSTOM_LAYERS（共に実装済み）。
- Tier A / §1 / Tier B は「press/release 同期の状態管理」インフラ（`Direct` 分類・
  ホールドリスト・MO ホールド一覧＋TG マスク・透過押下状態）を共有する（main.rs engine_task）。
- ステージング/フラッシュ容量: エントリ総数上限は `MAX_CUSTOM = 96`（全レイヤー合算）。
  IR バッファ（3840B）超過時は COMMIT が ST_ERR を返す（serialize が None）。
