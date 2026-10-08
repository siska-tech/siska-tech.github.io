# Pure ONNX OCR WASM Demo

ブラウザ上で動作するPure ONNX OCRのデモアプリケーションです。

- `/pure-onnx-ocr/` … v0.1.0 のデモ（PP-OCRv5）
- `/pure-onnx-ocr/v0.3.1/` … v0.3.1 のデモ（最新。画面・機能は v0.2.0 と同じで、エンジンを v0.3.1 に更新。cross-origin isolated なブラウザではマルチスレッドで推論）
  - `coi-serviceworker.js` で COOP/COEP ヘッダを付け、`crossOriginIsolated` にする（初回の表示で Service Worker を登録して 1 回だけ再読み込みする）。Service Worker のスコープは `v0.3.1/` 以下
  - `pkg/` はシングルスレッド版、`pkg-threads/` はマルチスレッド版（`scripts/build_wasm.sh [--threads]` でビルドし、`wasm-opt -O3` で最適化）。`worker.js` は isolated なら `pkg-threads/` を、そうでなければ `pkg/` を読み込む
  - rayon のスレッドは `pkg-threads/snippets/.../workerHelpers.no-bundler.js` を使う入れ子の Worker。COEP ヘッダが付くように、`worker.js` と `pkg-threads/` は Service Worker のスコープ内に置く
- `/pure-onnx-ocr/v0.3.0/` … v0.3.1 への転送のみ（v0.3.0 のデモは v0.3.1 に置き換えた）
- `/pure-onnx-ocr/coi-poc/` … GitHub Pages のまま `crossOriginIsolated` にできるかを確かめる PoC（coi-serviceworker を使用。Service Worker のスコープはこのディレクトリのみ）
- `/pure-onnx-ocr/v0.2.0/` … v0.2.0 のデモ（PP-OCRv6 tiny / small / medium、PP-OCRv5、向き分類）
  - WASM は `bindings/wasm`（`pure-onnx-ocr-wasm`）を `wasm32-unknown-unknown` + SIMD でビルドし、`wasm-bindgen --target web` と `wasm-opt -O3` で生成
  - PP-OCRv6 と向き分類モデルは Hugging Face の PaddlePaddle 公式リポジトリからブラウザが直接取得します（本サイトでは再配布しません）

モデル・辞書のライセンス表記は [NOTICE.md](NOTICE.md) と [LICENSE-PaddleOCR.txt](LICENSE-PaddleOCR.txt) を参照してください。

## セットアップ

### 1. WASMモジュールのビルド

```bash
# wasm-packをインストール（初回のみ）
cargo install wasm-pack

# WASMモジュールをビルド
wasm-pack build --target web --features wasm
```

これにより `pkg/` ディレクトリにWASMモジュールが生成されます。

### 2. モデルファイルの準備

デモはデフォルトでサーバーからモデルファイルを読み込みます。以下の2つの方法から選択できます：

#### 方法A: サーバーから読み込む（デフォルト・推奨）

デモページは起動時に自動的にサーバーからモデルファイルを読み込みます。
デフォルトパス: `../../tests/fixtures/models/ppocrv5/`

- `det.onnx` - DBNet検出モデル（4.5MB）
- `rec.onnx` - SVTR認識モデル（16MB）
- `ppocrv5_dict.txt` - 認識辞書（72KB）

**パスの変更方法：**
`index.js` の `loadModelsFromServer()` 関数内の `modelBasePath` を変更してください。

```javascript
const modelBasePath = '/your/custom/path/models';
```

#### 方法B: ファイルをアップロード

デモページの「モデル読み込み方法」で「ファイルをアップロード」を選択すると、
ユーザーが任意のモデルファイルをアップロードできます。

- モデルファイルは切り替え可能です
- 異なるバージョンのモデルを試すことができます

**注意：**
- アップロードしたモデルは、次回サーバーから読み込むまで保持されます
- モデルを切り替えるには、再度アップロードするか「サーバーから読み込む」に切り替えてください

### 3. サーバーの起動

ブラウザから直接ファイルを開くのではなく、HTTPサーバーを起動してください：

```bash
# Python 3の場合
python -m http.server 8000

# Node.jsの場合（http-serverが必要）
npx http-server -p 8000

# または他の静的ファイルサーバーを使用
```

### 4. ブラウザで開く

`http://localhost:8000/examples/wasm-demo/index.html` にアクセスしてください。

## 使用方法

1. **モデルファイルの読み込み**
   - 検出モデル（det.onnx）、認識モデル（rec.onnx）、辞書ファイル（ppocrv5_dict.txt）を選択します。

2. **画像の選択**
   - 画像ファイルを選択するか、ドラッグ＆ドロップでアップロードします。

3. **設定の調整（オプション）**
   - 検出最大辺長、検出拡大率、認識バッチサイズを調整できます。

4. **OCR実行**
   - 「OCR実行」ボタンをクリックして処理を開始します。

5. **結果の確認**
   - OCR結果が表示されます。コピーやダウンロードも可能です。

## 注意事項

- モデルファイルは初回読み込み時にメモリに保持されます。大きなモデルファイルの場合は、読み込みに時間がかかることがあります。
- WASMモジュールのビルドには時間がかかることがあります。
- ブラウザのメモリ制限により、大きな画像の処理ができない場合があります。

