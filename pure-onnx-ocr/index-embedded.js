// Example: WASMモジュールに埋め込まれたモデルを使用する場合
// このファイルは参考用です。実際にはモデルをビルド時に埋め込む必要があります。

// Import the WASM module
import init, { WasmOcrEngineBuilder, create_engine_with_embedded_models } from '../../pkg/pure_onnx_ocr.js';

let engine = null;
let wasmInitialized = false;

// DOM elements
const fileInput = document.getElementById('fileInput');
const ocrBtn = document.getElementById('ocrBtn');
const resultSection = document.getElementById('resultSection');
const resultTextarea = document.getElementById('result');
const statusMessage = document.getElementById('statusMessage');

// Initialize WASM
async function initializeWasm() {
    if (wasmInitialized) return;

    try {
        showStatus('WASMモジュールを読み込んでいます...', 'loading');
        await init();
        wasmInitialized = true;
        
        // 注意: 実際にモデルを埋め込む場合は、Rustコードで include_bytes! を使用して
        // ビルド時にモデルを埋め込む必要があります。
        // この例では、fetch を使ってモデルファイルを読み込みます。
        showStatus('モデルファイルを読み込んでいます...', 'loading');
        
        const [detBytes, recBytes, dictBytes] = await Promise.all([
            fetch('./ppocrv5/det.onnx').then(r => r.arrayBuffer()),
            fetch('./ppocrv5/rec.onnx').then(r => r.arrayBuffer()),
            fetch('./ppocrv5/ppocrv5_dict.txt').then(r => r.arrayBuffer()),
        ]);

        showStatus('OCRエンジンを初期化しています...', 'loading');
        engine = create_engine_with_embedded_models(
            new Uint8Array(detBytes),
            new Uint8Array(recBytes),
            new Uint8Array(dictBytes)
        );

        showStatus('準備完了！画像を選択してください。', 'success');
    } catch (error) {
        showStatus(`初期化に失敗しました: ${error.message}`, 'error');
        console.error('Initialization error:', error);
    }
}

// Handle image file input
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const bytes = await file.arrayBuffer();
        currentImageBytes = bytes;
        updateButtonStates();
    }
});

// Run OCR
ocrBtn.addEventListener('click', async () => {
    if (!engine) {
        showStatus('エンジンが初期化されていません。', 'error');
        return;
    }

    if (!currentImageBytes) {
        showStatus('画像を選択してください。', 'error');
        return;
    }

    try {
        showStatus('OCR処理を実行しています...', 'loading');
        ocrBtn.disabled = true;

        const imageArray = new Uint8Array(currentImageBytes);
        const resultJson = engine.run_from_bytes(imageArray);
        
        const results = JSON.parse(resultJson);
        displayResults(results);
        
        showStatus('OCR処理が完了しました。', 'success');
    } catch (error) {
        showStatus(`OCR処理に失敗しました: ${error.message}`, 'error');
        console.error('OCR error:', error);
    } finally {
        ocrBtn.disabled = false;
    }
});

// Display results
function displayResults(results) {
    if (!results || results.length === 0) {
        resultTextarea.value = 'テキストが検出されませんでした。';
        resultSection.classList.remove('hidden');
        return;
    }

    let output = '';
    results.forEach((result, index) => {
        output += `[${index + 1}] テキスト: ${result.text}\n`;
        output += `    信頼度: ${(result.confidence * 100).toFixed(2)}%\n`;
        output += `    座標: ${result.bounding_box}\n\n`;
    });

    resultTextarea.value = output;
    resultSection.classList.remove('hidden');
}

function updateButtonStates() {
    ocrBtn.disabled = !wasmInitialized || !engine || !currentImageBytes;
}

function showStatus(message, type = 'info') {
    statusMessage.innerHTML = `<div class="${type}">${message}</div>`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 5000);
    }
}

let currentImageBytes = null;

// Initialize on load
window.addEventListener('load', () => {
    initializeWasm();
});

