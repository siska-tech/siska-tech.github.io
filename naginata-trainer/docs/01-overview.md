# 01. プロジェクト概要とアーキテクチャ

最終更新: 2026-06-11

## 目的

[薙刀式 v15fix](https://oookaaa.wixsite.com/naginata) かな配列の練習用Webアプリ。
[DividedKanaKeyboard](https://github.com/siska-tech/DividedKanaKeyboard)
(薙刀式をファームウェア実装した自作分割キーボード)の**実機ローマ字送出**をそのまま判定できることが第一要件。
加えて、実機なしでも配列を練習できる**薙刀式エミュレーションモード**を持つ。

## 要件(経緯順)

| # | 要件 | 対応 |
|---|------|------|
| 1 | 薙刀式の練習アプリ。実機のローマ字送出に対応 | ローマ字判定エンジン(02, 03章) |
| 2 | ゲーミフィケーション・効果音・演出 | コンボ/スコア/ランク/XP + Web Audio + パーティクル(05章) |
| 3 | お題ファイルを外部ファイルから追加 | .txt / .json 取り込み(06章) |
| 4 | 「でんしゃ」が dennsixya になり実機の dennsya と不一致(報告) | 調査の結果再現せず。全文ローマ字ヒント表示で対策(07章に調査記録) |
| 5 | 通常QWERTYで練習できるエミュレーションモード | 同時打鍵判定エンジン(04章) |

## 技術方針

- **ビルド不要の静的Webアプリ**。`index.html` をブラウザで開くだけで動作する。
  フレームワーク・外部ライブラリ・音声画像アセットは一切使わない。
- **デュアル実行環境**: 各JSはブラウザ(クラシックスクリプト)と Node(テスト)の両方で動く。
  - ブラウザ: トップレベル `const` はグローバルレキシカル環境で後続スクリプトから参照可能。
    関数・クラスは `Object.assign(globalThis, api)` で公開。
  - Node: `if (typeof module !== 'undefined') module.exports = api` で公開。
  - 注意: ブラウザでは `globalThis.ROMAJI` などは **undefined**(トップレベル const は
    globalThis に付かない)。romaji.js / emulator.js は素の識別子参照でフォールバックする。
    過去にここで実バグが発生した(07章)。

## モジュール構成と依存関係

```
index.html
  └─ スクリプト読み込み順(依存順。変更禁止):
     data.js      配列定義・ローマ字テーブル・レッスン(依存なし)
     romaji.js    トークナイザ + ローマ字マッチャ(← data.js)
     emulator.js  同時打鍵エンジン + かなマッチャ(← data.js)
     lessonio.js  お題ファイルパーサ(← tokenize を引数で受け取る)
     sound.js     効果音(依存なし)
     fx.js        パーティクル(依存なし、#fx-canvas を遅延取得)
     keyboard.js  キーボードガイド描画(← data.js)
     app.js       画面遷移・入力・統計(← 上記すべて)
```

## 画面構成(app.js の view 状態機械)

- `#view-menu` … レベルバー / 使い方 / 入力モード選択 / レッスン一覧 /
  追加お題一覧 / お題ファイル取り込み / カスタム練習
- `#view-practice` … 統計バー / お題かな表示 / ヒント行 / キーボードガイド / 凡例
- `#view-result` … ランク / スター / 統計 / XPバー / PERFECT表示
- `#fx-canvas` … 全画面固定のパーティクル層(pointer-events: none, z-index: 100)
- `#ime-warning` … IME ON 検出時のバナー(compositionstart / keyCode 229)

## 入力モード(2系統)

| モード | 入力 | 判定 | 用途 |
|--------|------|------|------|
| ローマ字 | keydown の文字 | romaji.js の `Matcher`(ローマ字前方一致) | 実機接続時 / 通常の手打ちローマ字 |
| エミュレーション | keydown/keyup の物理キー(`e.code`) | emulator.js の `NaginataEngine` → かな → `KanaMatcher` | 実機なしで配列の運指練習 |

モードは localStorage に永続化され、レッスン開始時(`startLesson`)に読み込まれる。
練習中のモード切替は次のレッスン開始から反映される。

## localStorage スキーマ

| キー | 内容 |
|------|------|
| `naginata-trainer:best:<lessonId>` | `{kpm, acc, score, rank, stars}` スコアが高い時のみ更新 |
| `naginata-trainer:xp` | 累計XP(数値文字列) |
| `naginata-trainer:imported` | 追加お題レッスンの配列(JSON) |
| `naginata-trainer:muted` | 効果音ミュート `'1'`/`'0'` |
| `naginata-trainer:mode` | `'romaji'` / `'emu'` |
| `naginata-trainer:emu-window` | 同時押し判定窓 ms(30〜120) |

## 既知の制約・実機との差異

- 実機の**編集モード**(D+F / C+V のカーソル・コピペ操作)は文字入力でないため対象外。
- 左手カッコ挿入マクロなど、ファームの yaml で「未収録」のものは同様に対象外。
- ベスト記録はモードを区別せず保存される(ローマ字とエミュでスコアの出方が多少違う)。
- エミュレーションの判定窓は既定60ms(実機40ms)、シフトタップ上限200ms(実機 tap_ms=40ms)。
  練習しやすさを優先した意図的な差(04章)。
- ローマ字モードはキーリピート(`e.repeat`)を無視する。
