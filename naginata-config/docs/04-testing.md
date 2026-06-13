# 04. 検証方法

ビルド工程・テストフレームワークなしの静的ページのため、検証は以下の組み合わせで行う。

## 1. 構文チェック

```powershell
node --check app.js
```

## 2. デモモードによる手動確認

実機なしで UI 全体を確認できる。

- ブラウザで `index.html#demo` を開く（またはウェルカム画面の「デモデータで試す」）。
- WRITE は模擬（model 更新のみ）。COMMIT/未保存表示の遷移も確認可能。
- デモの配列はサンプルであり実機既定とは異なる（`loadDemo()` 内にハードコード）。

### 手動確認チェックリスト

- [ ] キーマップ: レイヤー切替、キー選択、かなパレットで割当 → キーキャップ刻印が即更新、橙→青ドット遷移
- [ ] キーマップ: 編集モードレイヤーで修飾トグル＋キーでストローク追加、チップ×で削除
- [ ] キーマップ: 「既定に戻す」「クリア」、キー操作タブを**開くだけ**では dirty にならないこと
- [ ] コンボ: 2キー選択で既存コンボが選択される、未定義コードで「作成」が出る、一覧クリックで選択
- [ ] パラメータ: スライダーと数値入力の同期、範囲クランプ
- [ ] 保存/読込: JSON 書き出し → 読み込みで同じ状態に戻る
- [ ] トップバー: 変更後に「● フラッシュ未保存」、COMMIT で解消
- [ ] ページ離脱警告（実機接続時のみ）

## 3. ヘッドレス Chrome によるスクリーンショット検証

開発時に使った手順。`#demo` ＋ 自動クリックスクリプトを仕込んだ一時 HTML で
任意の操作後の画面を撮れる。

```powershell
# 例: キーマップで K キーを選択した状態を撮る
$dir = "<repo>\naginata-config"
(Get-Content "$dir\index.html" -Raw) -replace '<script src="app.js"></script>', @'
<script src="app.js"></script>
<script>
setTimeout(() => {
  const cap = (q) => [...document.querySelectorAll('.keycap')]
    .find(c => c.querySelector('.qwerty')?.textContent === q);
  cap('K').click();
}, 300);
</script>
'@ | Set-Content "$dir\__test.html"

& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --window-size=1440,1300 `
  --screenshot="$env:TEMP\shot.png" --virtual-time-budget=5000 `
  "file:///<repo-as-url>/naginata-config/__test.html#demo"
```

- `__test*.html` は撮影後に削除すること（リポジトリに残さない）。
- DOM の状態確認だけなら `--dump-dom` ＋ `Select-String` が速い。
- 注意: `--virtual-time-budget` 下では setTimeout の発火とスクリーンショットの
  タイミングが前後することがある。描画結果が疑わしい場合は `--dump-dom` で
  クラス付与を直接確認する（開発中に sidebar の active 表示で一度誤検出した）。

## 4. 実機での確認項目（リリース前）

デモで代替できない経路:

- [ ] 接続ダイアログ → 読み出し一式（INFO/PARAMS/各セクション/MATRIX）
- [ ] 自動再接続（ページリロードで選択ダイアログなしに接続される）
- [ ] WRITE → COMMIT → 再起動 → 再接続して変更が反映されている
- [ ] かな最大バイト数超過のエラー表示（status≠OK 経路）
- [ ] キー学習（薙刀式キー押下の拒否 / 登録済み位置の拒否 / 新規追加）
- [ ] RESET → 既定に戻り再読込される
- [ ] 切断（USB抜去）でウェルカム画面に戻る
- [ ] JSON 読み込み → 全エントリが端末へ送信される（READ_OVERRIDES で確認）
