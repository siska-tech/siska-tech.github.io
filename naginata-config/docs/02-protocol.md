# 02. WebHID ベンダープロトコル v2 仕様

ファームウェア `firmware/src/usb_config.rs` と一致していること。
プロトコルは v2 のまま、**ワイヤ互換の追加拡張**（READ_MATRIX_FULL / READ_LAYOUT / TAG_HOLD /
擬似 usage（レイヤー操作）/ SEC_CUSTOM / params flags / capability ビット）がある
（[05-future-work.md](05-future-work.md) の実装分）。
新ツール × 旧FW は INFO の capability ビット（旧FWは 0）で機能を自動無効化する。

## 1. デバイス識別・トランスポート

| 項目 | 値 |
|---|---|
| VID / PID | `0xc0de` / `0xcafe` |
| インタフェース | vendor HID (IF1)、usagePage `0xFF00`、usage `0x01` |
| レポート長 | 64 バイト固定（`REPORT_LEN`）、レポートID 0 |
| WebHID フィルタ | `{ vendorId: 0xc0de, usagePage: 0xff00, usage: 0x01 }` |

### フレーミング

```
OUT (host→dev): [0]=cmd  [1]=seq  [2..63]=args
IN  (dev→host): [0]=cmd  [1]=seq  [2]=status  [3..63]=payload
```

- `seq`: ホストが 1〜255 でインクリメント（1バイトでラップ）。応答照合は seq のみ。
- `status`: `0x00` = OK（`ST_OK`）。それ以外はエラー。
- ホスト側タイムアウト: 2000ms。
- 入力レポートのうち 63 バイト未満のもの（通常の 8B キーボード入力）は無視する。

## 2. コマンド一覧

| cmd | 名前 | args | 応答 payload |
|---|---|---|---|
| 0x01 | INFO | なし | 下表参照 |
| 0x02 | READ_DEFAULTS | `[2]`=section `[3..4]`=start(u16le) | ページング応答（§4） |
| 0x03 | READ_OVERRIDES | 同上 | 同上 |
| 0x04 | WRITE | `[2]`=section `[3..]`=key `[..]`=value | status のみ |
| 0x05 | COMMIT | なし | status のみ（ステージング→フラッシュ保存） |
| 0x06 | RESET | なし | status のみ（全オーバーライド消去） |
| 0x07 | REBOOT | なし | 応答が来ないことがある（切断は正常） |
| 0x08 | READ_PARAMS | なし | §3 参照 |
| 0x09 | WRITE_PARAMS | §3 の 10 バイト | status のみ |
| 0x0a | READ_MATRIX | `[2..3]`=start(u16le) | ページング応答、エントリ=4B（§5） |
| 0x0b | READ_LASTKEY | なし | `[3]`=hand `[4]`=row `[5]`=col `[6]`=有効フラグ(0なら未押下) |
| 0x0c | READ_MATRIX_FULL | `[2..3]`=start(u16le) | ページング応答、エントリ=5B（§5.1。capability MATRIX_FULL 必須） |
| 0x0d | READ_LAYOUT | `[2..3]`=start(u16le) | ページング応答、エントリ=8B（§5.2。capability LAYOUT 必須） |

注意: READ_MATRIX / READ_MATRIX_FULL / READ_LAYOUT / READ_LASTKEY は section を取らないため
start のオフセットが READ_DEFAULTS/OVERRIDES と 1 バイトずれる（READ_MATRIX は `[2..3]`）。

### INFO 応答 payload

| オフセット | 内容 |
|---|---|
| 3 | protoVer（=2） |
| 4 / 5 | fwMajor / fwMinor |
| 6 / 7 | maxKeys / maxKanaLen |
| 8..15 | u16le×4: LAYERS / COMBO2 / COMBO3 / MODE_LAYERS の既定テーブル件数 |
| 16 | **capability ビット**（旧FWは 0） |
| 17 | maxCustomLayers（=8。CUSTOM_LAYERS 対応 FW のみ） |

capability ビット（`[16]`。05-future-work の原案 `[8]` は件数で使用済みのため移設）:

| bit | 名前 | 意味 |
|---|---|---|
| 0 | MATRIX_FULL | READ_MATRIX_FULL（0x0c）対応 |
| 1 | LAYOUT | READ_LAYOUT（0x0d）対応。**YAML に形状データがある場合のみ立つ** |
| 2 | TAG_HOLD | 値タグ `tag=2`（ホールド）対応 |
| 3 | PASSTHROUGH | パススルーモード（擬似 usage MO(0)/TG(0)）対応 |
| 4 | CUSTOM_LAYERS | 任意カスタムレイヤー（SEC 6 + MO(n)/TG(n)）対応 |

## 3. パラメータ（READ_PARAMS / WRITE_PARAMS）

READ_PARAMS 応答 payload（オフセットは IN レポート先頭基準）:

| オフセット | 型 | 項目 | UI範囲 |
|---|---|---|---|
| 3 | u16le | window_ms（同時打鍵窓） | 5–200 |
| 5 | u16le | tap_ms（デバウンス/タップ） | 1–200 |
| 7 | u16le | repeat_delay_ms（リピート初回ディレイ） | 50–2000 |
| 9 | u16le | repeat_interval_ms（リピート間隔） | 5–1000 |
| 11 | u8 | led_brightness（LED輝度） | 0–255 |
| 12 | u8 | flags（動作フラグ。bit0=パススルー時 IME 自動切替） | — |

WRITE_PARAMS の args は同じ 6 項目を `[2]` から詰めた 10 バイト（u16le×4 + u8 + u8）。常に全項目送信。
旧ツールの 9 バイト送信は flags=0 として解釈される（互換）。flags は capability
PASSTHROUGH がある FW でのみ意味を持つ。

## 4. セクションとエントリ

| section | 名前 | key | 値の典型 |
|---|---|---|---|
| 1 | LAYERS | `[mask, sc]` (2B) | かな（単打・シフト面） |
| 2 | COMBO2 | `[sc, sc]` (2B, 昇順) | かな |
| 3 | COMBO3 | `[sc, sc, sc]` (3B, 昇順) | かな |
| 4 | MODES | `[mode, sc]` (2B) | キー操作（編集モード1/2） |
| 5 | EXTRA | `[hand, row, col]` (3B) | キー操作（直接キー。既定なし・差分のみ） |
| 6 | CUSTOM | `[layer_id, sc]` (2B) | キー操作（カスタムレイヤー。既定なし・差分のみ。capability CUSTOM_LAYERS 必須） |

CUSTOM の `layer_id` は 0..maxCustomLayers-1。**未定義の sc はパススルー（素の QWERTY）へ透過**
（QMK の KC_TRNS 相当が既定）。レイヤー 0 はエントリ 0 件で素の QWERTY になる。

- `mask` はシフトビットの OR: センター=0x01 右濁(J)=0x02 左濁(F)=0x04 右半(M)=0x08 左半(V)=0x10 小(Q)=0x20。0 は単打。
- `sc` は Set-1 スキャンコード（`SC_LABEL` 参照）。

### 読み出し（ページング）

READ_DEFAULTS / READ_OVERRIDES 応答:

```
[3]      (未使用)
[4..5]   next: u16le 次ページの開始インデックス
[6]      count: このレポートに含まれるエントリ数
[7..]    エントリ列（key + value の連結、可変長）
```

`count == 0` または `next <= start` で終端。ホストはガード上限 1000 ページ。

### 値エンコード

```
[tag] [len] [body...]
tag=0 (TAG_KANA): body = UTF-8 かな文字列（len バイト）
tag=1 (TAG_KEYS): body = (usage, modifiers) ペア × len/2
tag=2 (TAG_HOLD): body = (usage, modifiers) 1ペア（len=2 固定。capability TAG_HOLD 必須）
```

- modifiers は HID modifier ビット（Ctrl=1 Shift=2 Alt=4 GUI=8）。
- かなの最大長は INFO の `maxKanaLen`（バイト単位）。
- ストローク数の上限は INFO の `maxKeys`（UI では 1 レポートに収まることのみ検証）。
- TAG_HOLD は **EXTRA（直接キー）と CUSTOM（カスタムレイヤー）専用**。FW は物理キーの
  press/release に同期して HID レポートのビットを保持/解除する（タップではなく
  押しっぱなし。修飾キー向け）。他セクションに書いても無視される。

### 擬似 usage（レイヤー操作。capability PASSTHROUGH / CUSTOM_LAYERS）

EXTRA / CUSTOM の値に下記 usage を**単独ペア**（TAG_KEYS の 1 ペア、または TAG_HOLD）で書くと、
FW 内部解釈され HID には送出されない:

| usage | 名前 | 動作 |
|---|---|---|
| `0xF0 \| n` | MO(n) | ホールド中、レイヤー n を有効化（QMK の MO() 相当） |
| `0xF8 \| n` | TG(n) | 押すたびにレイヤー n をトグル（QMK の TG() 相当） |

- 下位 3bit = layer id（0..7）。**レイヤー 0 = 素の QWERTY パススルー**（MO(0)/TG(0) が
  旧称 MO_PASS/TG_PASS。capability PASSTHROUGH のみの FW では layer 0 だけ使える）。
- 複数レイヤーが同時に活性のときは**番号の大きいレイヤーが優先**。
- レイヤー活性中は薙刀式エンジンをバイパスし、CUSTOM のエントリ → なければ
  sc→HID usage の静的変換（パススルー）で press/release がそのまま流れる
  （Shift 等の修飾も素通し。同時押しは 6 キー＋修飾）。EXTRA（直接キー）は常に有効。
- params flags bit0 が立っていれば、レイヤー有効化時（非活性→活性）に LANG2（IME OFF）、
  全解除時に LANG1（IME ON）を自動送出する。

### 書き込み（WRITE）

```
args = [section, ...key, tag, len, ...body]
```

- **削除（オーバーライド除去）**: 値部を `[TAG_KANA, 0]` にして送る。
  ホストは「def があり cur == def（既定へ復帰）」または「def がなく cur が空」のとき削除として送る。
- args 全体は 62 バイト（64 − cmd − seq）以内でなければならない。
- WRITE はステージング（RAM）更新のみ。COMMIT でフラッシュ保存、再起動で反映。

## 5. 物理マトリクス（READ_MATRIX）

エントリは 4 バイト固定: `[hand, row, col, sc]`（hand: 0=左 1=右）。
sc が割り当てられている＝薙刀式キー。マトリクス上に存在するが READ_MATRIX に含まれない物理位置が
「未使用キー」で、EXTRA（直接キー）の割当対象。

### 5.1 全物理スイッチ（READ_MATRIX_FULL, 0x0c）

エントリは 5 バイト固定: `[hand, row, col, sc, flags]`。READ_MATRIX と同じページング形式。

- `sc`: 薙刀式キーなら Set-1 スキャンコード、未割当（未使用キー）なら 0。
- `flags`: bit0=薙刀式割当あり、bit1=EXTRA 割当あり（読出時点のステージング基準）。
- 収載対象は codegen の `matrix_left/right` ∪ `physical_left/right`
  （`naginata-core/layout/naginata.yaml`）。未使用キーを描画・クリック割当するには
  YAML の `physical_left/right` に物理スイッチ位置を列挙してファームを再ビルドする。
- ツールは capability MATRIX_FULL がなければ READ_MATRIX の結果から合成する
  （未使用キーは見えない＝旧来挙動）。

### 5.2 キー形状（READ_LAYOUT, 0x0d）

エントリは 8 バイト固定: `[hand, row, col, x, y, w, h, rot]`。同じページング形式（7 エントリ/頁）。

- `x/y/w/h`: 0.25u 単位（u8）。`rot`: 度（i8、キー中心まわり）。
- データ源は `naginata-core/layout/naginata.yaml` の `layout_left/right`（u 単位の float で記載、
  build.rs が量子化して FW フラッシュに埋め込む。Vial の圧縮 KLE と同じ発想のバイナリ版）。
- YAML 未記載なら capability LAYOUT が立たず、ツールはグリッド描画へフォールバックする。

## 6. キー学習（READ_LASTKEY）

直近に押された物理キーの位置を返す。UI の学習フロー:

1. 一度 READ_LASTKEY を呼んで直近の押下を捨てる（誤検出防止）
2. 100ms 間隔で最大 100 回ポーリング
3. 有効フラグが立ったら位置を判定:
   - `matrixMap` に存在 → 薙刀式キーなので拒否
   - EXTRA に登録済み → 拒否
   - それ以外 → 新規 EXTRA 行として追加し編集対象に選択

## 7. ライフサイクル

```
接続 → INFO → READ_PARAMS → 各セクション READ_DEFAULTS + READ_OVERRIDES
     → READ_MATRIX → READ_MATRIX_FULL → READ_LAYOUT（いずれも capability あり時）
     → EXTRA / CUSTOM の READ_OVERRIDES → UI 描画

編集 → WRITE（デバウンス、RAMステージング）→ … → COMMIT（フラッシュ）→ REBOOT（反映）
```

- フェーズ2ファーム初回書込みで旧 (v1) 設定は一度リセットされる。
- REBOOT 要求は応答なしで切断されることがあり、ホストはこれを正常系として扱う。
