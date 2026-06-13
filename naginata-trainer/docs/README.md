# 設計資料

naginata-trainer の実装仕様・設計判断のレビュー用資料。

| ドキュメント | 内容 |
|--------------|------|
| [01-overview.md](01-overview.md) | 要件・アーキテクチャ・モジュール構成・localStorage スキーマ・既知の制約 |
| [02-layout-data.md](02-layout-data.md) | 配列データ(data.js)の構造と出典、変更時の注意 |
| [03-romaji-matching.md](03-romaji-matching.md) | ローマ字判定エンジン(トークナイズ・候補生成・Matcher 状態機械) |
| [04-emulation-engine.md](04-emulation-engine.md) | 薙刀式エミュレーション(同時打鍵判定アルゴリズム・実機との差異) |
| [05-gamification.md](05-gamification.md) | スコア・ランク・XP・効果音・画面演出の仕様 |
| [06-lesson-files.md](06-lesson-files.md) | 外部お題ファイル(.txt/.json)の形式とバリデーション |
| [07-testing.md](07-testing.md) | テスト構成・リリース前チェック・バグ/調査の検証記録 |

読む順序は番号どおり。コードレビュー時は 02(データ規約)→ 03/04(判定ロジック)を
先に読むと app.js が追いやすい。
