# NOTICE — pure-onnx-ocr デモ

このディレクトリ（`/pure-onnx-ocr/`）のデモで使用しているソフトウェアとモデルのライセンス表記です。

## pure-onnx-ocr

- `pkg/`（v0.1.0）、`v0.2.0/pkg/`（v0.2.0）、`v0.3.0/pkg/`（v0.3.0）の WebAssembly モジュールは
  [pure-onnx-ocr](https://github.com/siska-tech/pure-onnx-ocr) をビルドしたものです。
- ライセンス: Apache License 2.0

## coi-serviceworker

- `coi-poc/coi-serviceworker.js` は [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) v0.1.7 を改変せずに配置したものです。
- Copyright (c) 2021 Guido Zuidhof
- ライセンス: MIT License（全文: [coi-poc/LICENSE-coi-serviceworker.txt](coi-poc/LICENSE-coi-serviceworker.txt)）

## PaddleOCR（モデル・辞書）

- 提供元: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
- Copyright (c) 2016 PaddlePaddle Authors. All Rights Reserved.
- ライセンス: Apache License 2.0（全文: [LICENSE-PaddleOCR.txt](LICENSE-PaddleOCR.txt)）

### 本サイトに配置しているファイル（再配布）

| ファイル | 内容 |
| :--- | :--- |
| `ppocrv5/det.onnx` | PaddleOCR PP-OCRv5 テキスト検出モデル（ONNX 形式） |
| `ppocrv5/rec.onnx` | PaddleOCR PP-OCRv5 テキスト認識モデル（ONNX 形式） |
| `ppocrv5/ppocrv5_dict.txt` | PaddleOCR PP-OCRv5 認識辞書（`ppocr/utils/dict/ppocrv5_dict.txt`） |

本サイトでは、これらのファイルの内容に変更を加えていません。

### 実行時にブラウザが直接読み込むモデル（本サイトでは再配布していません）

v0.2.0 / v0.3.0 デモは、以下のモデルを Hugging Face 上の PaddlePaddle 公式リポジトリから直接ダウンロードします。

- [PaddlePaddle/PP-OCRv6_{tiny,small,medium}_det_onnx](https://huggingface.co/PaddlePaddle)
- [PaddlePaddle/PP-OCRv6_{tiny,small,medium}_rec_onnx](https://huggingface.co/PaddlePaddle)
- [PaddlePaddle/PP-LCNet_x0_25_textline_ori_onnx](https://huggingface.co/PaddlePaddle/PP-LCNet_x0_25_textline_ori_onnx)
- [PaddlePaddle/PP-LCNet_x1_0_doc_ori_onnx](https://huggingface.co/PaddlePaddle/PP-LCNet_x1_0_doc_ori_onnx)

これらのモデルの利用条件は、各リポジトリに記載されたライセンスに従います。

---

本デモは PaddlePaddle / Baidu による公式のものではありません。
