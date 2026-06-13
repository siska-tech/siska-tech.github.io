# 01. アーキテクチャ・状態モデル・設計判断

## 1. 全体構成

```
┌─────────────────────────────── app.js ───────────────────────────────┐
│                                                                      │
│  プロトコル層                状態モデル              UI層              │
│  ─────────────              ─────────────          ─────────────     │
│  sendCommand()       ←→     model.{layers,         renderApp()       │
│  onInputReport()            combo2, combo3,         ├ renderKeymapPane│
│  readSection()              modes, extra, custom}   ├ renderCombosPane│
│  readMatrix()               params / info           ├ renderExtraPane │
│  readMatrixFull()           matrixMap / physMap     ├ renderParamsPane│
│  readLayout()               layoutMap               └ renderFilePane  │
│  pushRow() / pushParams()   state（UI状態）          renderDock()      │
│  commit()/reboot()/reset()                                            │
│                                                     renderDock()      │
└──────────────────────────────────────────────────────────────────────┘
```

- フレームワーク・ビルド工程なし。素の DOM API（`document.createElement` ベースのヘルパ `el()`）。
- 描画は「ペイン丸ごと再構築」(`renderApp()`) ＋ 値変更時の軽量更新 (`refreshAfterEdit()`) の 2 段構え。

## 2. 状態モデル

### 2.1 行（エントリ）モデル

全セクション（layers / combo2 / combo3 / modes / extra）共通の行構造:

```js
row = {
  key:  [..],        // LAYERS:[mask,sc] MODES:[mode,sc] COMBO2:[sc,sc]
                     // COMBO3:[sc,sc,sc] EXTRA:[hand,row,col] CUSTOM:[layer,sc]
  def:  val | null,  // codegen既定値（READ_DEFAULTS由来）。nullなら既定なし
  init: val,         // 端末RAMステージング上の現在値（最後に送信成功した値）
  cur:  val,         // UI上の編集値
  ovr:  bool,        // 端末上にオーバーライドとして存在するか
}
val = { tag: 0, kana: "..." }          // TAG_KANA: UTF-8かな文字列
    | { tag: 1, keys: [[usage, mod]] } // TAG_KEYS: ストローク列
    | { tag: 2, hold: [usage, mod] }   // TAG_HOLD: 押しっぱなし保持（EXTRA専用, capability HOLD）
```

### 2.2 3値の関係と派生状態

```
def（フラッシュ内静的既定） ← READ_DEFAULTS
init（端末RAMステージング）  ← READ_OVERRIDES で上書き / WRITE成功で更新
cur（UI編集値）             ← ユーザ操作
```

| 派生状態 | 定義 | UI表示 |
|---|---|---|
| dirty（送信待ち） | `cur ≠ init` | キーキャップ右上に橙ドット。デバウンス後に自動送信され解消 |
| overridden（変更済） | `def有: cur ≠ def` / `def無: cur が空でない` | キーキャップ右上に青ドット |
| uncommitted（フラッシュ未保存） | WRITE/WRITE_PARAMS 成功後、COMMIT 前 | トップバーに「● フラッシュ未保存」＋COMMITボタン強調＋離脱警告 |

### 2.3 マージ規則（読み出し時）

`mergeSection(defaults, overrides)`:
1. defaults の各エントリ → `{def:v, init:v, cur:v, ovr:false}`
2. overrides で同一 key があれば `init/cur` を上書きし `ovr:true`
3. defaults に無い override は `def:null` の行として追加

EXTRA は既定が存在しないため overrides のみ読む。

### 2.4 UI状態（`state`）

```js
state = {
  pane: 'keymap'|'combos'|'extra'|'params'|'file',
  layer: {kind:'mask'|'mode'|'custom', val},  // キーマップペインの選択レイヤー
  addedCustom: [id..],               // セッション中に「＋ レイヤー追加」したカスタムレイヤー
  sel: {name, section, row, label, kanaOk, keysOk, deletable, holdOk, passOk},  // ドックの編集対象
  editorTab: 'kana'|'keys'|null,     // ドックのタブ（nullなら値のtagから自動）
  chord: [sc..],                     // コンボペインで選択中のキー列（昇順ソート）
  uncommitted: bool,
  demo: bool,
}
```

`holdOk`/`passOk` は capability（HOLD / PASSTHROUGH）のある FW で EXTRA・カスタムレイヤーの
行を選択したときだけ true（キー操作エディタにホールド切替・レイヤー操作グループを出す）。

## 3. 書き込み戦略（即時WRITE＋デバウンス）

旧版の「編集を貯めて『端末へ送る』ボタンで一括送信」を廃止し、VIA同様の即時反映に変更した。

- 端末側の WRITE は **RAMステージングのみ**で安価・低リスク（電源断/再起動で消える）なため、編集のたびに送って問題ない。
- 行単位デバウンス: `stageRow()` が 350ms（既定値ボタン等の単発操作は 0ms）後に `pushRow()`。
  タイマーは `writeTimers` に行ID（`name:keyId`）で管理し、連続編集は最後の値だけ送る。
- パラメータは `stageParams()` で 400ms デバウンス → `WRITE_PARAMS`（5項目を常に一括送信）。
- COMMIT 直前に `flushAllStaged()` で全タイマーを破棄し、`cur ≠ init` の全行を同期送信してから COMMIT を発行する（デバウンス待ちの取りこぼし防止）。

### 3.1 削除（remove）の判定

`pushRow()` 内:

```
revert = def があり cur == def        → オーバーライド削除（既定に戻る）
remove = revert または (def なしで cur が空)
```

remove 時の WRITE 値は `[TAG_KANA, 0]`。
注意: 「def ありの行に空値を書く」場合は remove 扱いにならないが、空かな値のエンコードも
`[TAG_KANA, 0, (本体なし)]` で **ワイヤ上は同一バイト列**になる（旧版から同じ挙動。
解釈はファームウェア側に依存）。

### 3.2 バリデーション（送信前）

- かな値: UTF-8 バイト長が `info.maxKanaLen` 以下
- 全体: `args` が 62 バイト（`REPORT_LEN - 2`）以下
- 端末応答 status ≠ 0x00 → エラー表示し `init` を更新しない（dirty のまま残る）

## 4. 主要な設計判断

| 判断 | 理由 |
|---|---|
| 即時WRITE（バッチ送信ボタン廃止） | VIAのUX。端末側がRAMステージングなので失敗コストが低い。永続化はCOMMITに集約 |
| かなパレットは**追記式**（クリックで入力欄に追加） | 拗音「きゃ」等の複数文字値があるため置換式にできない。入力欄が常に正の値を表示 |
| 「キー操作」タブを開いただけでは値を変換しない | 閲覧だけで dirty 化し、COMMIT 時に空値が送られる事故を防ぐ。変換はキー追加操作時のみ |
| 未定義の (mask,sc) 位置もクリックで編集可能 | `layerRow(layer, sc, create=true)` が空行を遅延生成。空のままなら dirty にならず送信もされない |
| 編集モードの新規行は TAG_KEYS、シフト面は TAG_KANA を初期タグに | 各セクションの典型値に合わせる（タブ操作でいつでも切替可能） |
| コンボの新規作成はキーボード上のコード選択から | 旧版のテキスト入力（"W H" 等）より誤入力が少なく、既存コンボと自動照合できる |
| デモモード | 実機なしでのUI確認・スクリーンショット検証用。配列はサンプルであり実機既定と異なる旨を表示 |
| 自動再接続（`navigator.hid.getDevices()`） | 一度許可した端末はページ再訪時に選択ダイアログなしで接続（VIA同様） |

## 5. 既知の制約・注意点

- **修飾キーのホールド（押しっぱなし保持）は capability HOLD のある FW（0.3+）でのみ対応**。
  EXTRA（直接キー）限定で、値 `tag=2 TAG_HOLD`（`(usage, mod)` 1ペア）を書くと
  ファームが物理キーの press/release に同期して HID レポートのビットを保持/解除する
  （非修飾 usage の同時保持は最大 4 個）。旧FW では UI に切替が出ず、`MODKEYS` の
  単体割当は従来どおりタップ動作。詳細は [02-protocol.md](02-protocol.md) /
  [05-future-work.md](05-future-work.md) §1。
- **キーボード描画のグリッドは実機データから動的に決定**（physMap の行・列集合）。
  capability MATRIX_FULL のある FW では READ_MATRIX_FULL で未使用物理キーも破線表示され、
  クリックで EXTRA 割当できる（YAML `physical_left/right` への収載が必要）。
  capability LAYOUT（YAML `layout_left/right` 記載時）では READ_LAYOUT の形状データで
  実機通りの絶対座標描画（スタッガー・回転対応）になる。旧FW では薙刀式キーのみの
  グリッド描画（READ_MATRIX 由来）。
- **レイヤー（パススルー/カスタム）**（capability PASSTHROUGH / CUSTOM_LAYERS）:
  擬似 usage `0xF0|n`=MO(n) / `0xF8|n`=TG(n) を EXTRA かカスタムレイヤー内のキーに
  単独割当すると薙刀式エンジンをバイパスするレイヤーを有効化できる。layer 0 = 素の
  QWERTY、1..7 = SEC_CUSTOM のカスタムレイヤー（未割当キーは QWERTY へ透過）。
  IME 自動切替は params flags bit0。
- ストロークの修飾は HID modifier ビット（Ctrl=1 Shift=2 Alt=4 GUI=8）として 1 ペア
  `(usage, mod)` = 1 ストロークに乗る。複数キー同時押下の連続ストローク列として送出される。
- コンボのキー列は**昇順ソートした sc** で正規化して照合・保存する。
- RESET はデモモードでは無効（実機のみ）。キー学習（READ_LASTKEY ポーリング）も実機のみ。
- `seq` は 1 バイトでラップする。タイムアウトは 2 秒。応答の照合は seq のみ（cmd は見ない）。
- 設定は USB に挿した（マスタ）半身のフラッシュに保存される。
- 旧版 UI にあった「学習済み直接キーの行削除」は、ドックの「削除」ボタン
  （未送信なら model から除去、送信済みなら空値 WRITE = remove）に統合。
