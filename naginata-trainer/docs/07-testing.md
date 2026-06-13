# 07. テストと検証記録

最終更新: 2026-06-11

## テストの実行

```
node test/run-tests.js     # 自動テスト一式
```

ブラウザ実行パスの検証は `test/browser-probe.html` をブラウザで開く
(またはヘッドレスで DOM ダンプ)。`UNITS / FIRMWARE / DENNSYA / EMU` の各行が
PASS になることを確認する。

```powershell
& msedge --headless --disable-gpu --virtual-time-budget=2000 --dump-dom `
  "file:///.../test/browser-probe.html"
```

## テスト構成(test/run-tests.js)

| セクション | 内容 |
|-----------|------|
| 全レッスン: トークン化とキー定義 | 全 items が原文どおり分割でき、候補とキー定義を持つ |
| 全レッスン: 実機ローマ字で完走 | 各 item を実機表記(alts[0]連結)で打って完走 |
| 実機表記の固定値 | **romaji.rs のユニットテストと同一ケース**(かっこ=kakko 等)+連結送出(ふぁ=huxa) |
| ヘボン式・代替表記 | sha/cha/tsu/fu/thi、n+子音、xtu 等の受理 |
| ミス判定 | 前方一致失敗で miss、ん の n 持ち越し |
| キーガイド | KANA_KEYS と tokenize 結果の keys 対応 |
| 回帰: でんしゃ問題 | 下記の調査記録参照 |
| お題ファイル | txt/json/BOM/無効行除外/複数レッスン/不正JSON例外 |
| エミュレーションエンジン | 単打/タップ/長押し/各シフト面/combo2・3/窓による分離/押し順不問/IGNORE_PAIRS/連続シフト入力(18ケース)+ KanaMatcher |

設計方針: タイミング依存のエンジンは**時刻を引数で渡す純粋ロジック**にして、
setTimeout を使わずに決定的にテストする(ブラウザだけが performance.now() を渡す)。

## ブラウザ環境での確認手順(リリース前チェック)

1. `node test/run-tests.js` 全合格
2. `test/browser-probe.html` で DENNSYA / EMU が PASS
3. `index.html` をヘッドレスで dump-dom し、以下を確認:
   - lesson-card × 10、kb-key × 32、mode ラジオ × 2
   - `#view-menu` が active、`#emu-options` が初期非表示
4. 手動: 各モードでレッスン1を1周、効果音・演出・結果画面・ベスト保存を目視

## 検証記録

### 2026-06-11: ブラウザでテーブル未参照になるバグ(修正済み)

初版の romaji.js は `const D = globalThis` でデータを参照していたが、
**トップレベル const は globalThis に付かない**ため、ブラウザでは D.ROMAJI が undefined
だった(Node テストは require 経由のため検出できず)。
素の識別子参照(`{ ROMAJI, ... }`)に修正。同型の構造を持つ emulator.js は最初から
この方式で実装し、browser-probe.html でブラウザパスを常時検証する体制にした。

**教訓**: デュアル実行環境のコードは「Node テスト合格」だけでは不十分。
ブラウザ実行パスのプローブを必ず通すこと。

### 2026-06-11: 「でんしゃ=dennsixya」報告の調査(再現せず)

報告: ヒント/判定が `dennsixya` になり、実機送出の `dennsya` と不一致になる。

調査結果(すべて期待どおり `sya`):

1. Node で `tokenize('でんしゃ...')` → しゃ の alts[0] は `sya`、全文 `dennsya...` で完走
2. 実ブラウザ(headless Edge + browser-probe.html)でも同一結果
3. レッスンデータの実文字列をコードポイントで確認(U+3083 小書きゃ。異体字混入なし)
4. クロス積候補により `dennsixya` 形式**も**受理される(どちらを送出されても通る)

推定原因: ブラウザキャッシュ、または途中ミス後の旧ヒント表示
(当時は現在単位の途中からしか表示されず、buf=si の状態では残りが `xya` と見えた)の誤読。

対策: ヒントをお題全文の実機表記表示に変更(03章)+ 上記4点を回帰テスト化。

### 2026-06-11: エミュレーションで「さ/ざ」が入力不能(修正済み)

`RELEVANT`(処理対象キー集合)の生成が単打面・combo3 のキーしか拾っておらず、
**シフト面にしか現れない u キー**(単打=Backspace、シフト面=さ/ざ)が無視されていた。
`LAYER` のベースキーを RELEVANT に追加して修正。エンジンテスト
(`f+u=ざ`、`SP押しっぱなしで さ|よ`)が検出した。

## レビュー観点(今後の変更時)

- data.js を変更したら: 全レッスン完走テスト + レッスン語彙の「未習かな混入」目視
- romaji.js を変更したら: romaji.rs 同一ケースの固定値テストを必ず維持
  (実機互換の根拠。上流 romaji.rs が変わったらこちらも追従)
- emulator.js を変更したら: browser-probe.html の EMU 行も確認
- スコア式・ランク閾値の変更は既存ベスト記録との整合(score比較で更新)に注意
