// Import the WASM module
// Note: After running `wasm-pack build --target web --features wasm`, 
// the module will be available at ./pkg/pure_onnx_ocr.js
import init, { WasmOcrEngineBuilder } from './pkg/pure_onnx_ocr.js';

let engine = null;
let wasmInitialized = false;

// DOM elements
const modelSourceSelect = document.getElementById('modelSource');
const modelUploadSection = document.getElementById('modelUploadSection');
const detModelInput = document.getElementById('detModel');
const recModelInput = document.getElementById('recModel');
const dictionaryInput = document.getElementById('dictionary');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const ocrBtn = document.getElementById('ocrBtn');
const clearBtn = document.getElementById('clearBtn');
const resultSection = document.getElementById('resultSection');
const resultTextarea = document.getElementById('result');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusMessage = document.getElementById('statusMessage');
const detLimitSideLen = document.getElementById('detLimitSideLen');
const detUnclipRatio = document.getElementById('detUnclipRatio');
const recBatchSize = document.getElementById('recBatchSize');

// Model files
let detModelBytes = null;
let recModelBytes = null;
let dictionaryBytes = null;
let currentImageBytes = null;

// Model source: 'fetch' or 'upload'
let modelSource = 'fetch';

// Initialize WASM
async function initializeWasm() {
    if (wasmInitialized) return;

    try {
        showStatus('WASMモジュールを読み込んでいます...', 'loading');
        await init();
        wasmInitialized = true;
        showStatus('WASMモジュールの読み込みが完了しました。', 'success');
        
        // デフォルトでサーバーからモデルを読み込む
        if (modelSource === 'fetch') {
            await loadModelsFromServer();
        }
        
        updateButtonStates();
    } catch (error) {
        showStatus(`WASMモジュールの読み込みに失敗しました: ${error.message}`, 'error');
        console.error('WASM initialization error:', error);
    }
}

// Load models from server using fetch
async function loadModelsFromServer() {
    try {
        showStatus('モデルファイルをサーバーから読み込んでいます...', 'loading');
        
        // デフォルトのパス（必要に応じて変更してください）
        const modelBasePath = '../../tests/fixtures/models/ppocrv5';
        
        const [detResponse, recResponse, dictResponse] = await Promise.all([
            fetch(`${modelBasePath}/det.onnx`),
            fetch(`${modelBasePath}/rec.onnx`),
            fetch(`${modelBasePath}/ppocrv5_dict.txt`),
        ]);

        if (!detResponse.ok || !recResponse.ok || !dictResponse.ok) {
            throw new Error('モデルファイルが見つかりません。サーバーにモデルファイルを配置するか、ファイルアップロードを使用してください。');
        }

        detModelBytes = await detResponse.arrayBuffer();
        recModelBytes = await recResponse.arrayBuffer();
        dictionaryBytes = await dictResponse.arrayBuffer();

        showStatus('モデルファイルの読み込みが完了しました。', 'success');
        
        // エンジンを再構築
        await loadModels();
    } catch (error) {
        showStatus(`モデルファイルの読み込みに失敗しました: ${error.message}`, 'error');
        console.error('Model loading error:', error);
        // エラーの場合はアップロードモードに切り替えを促す
        modelSourceSelect.value = 'upload';
        onModelSourceChange();
    }
}

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsArrayBuffer(file);
    });
}

// Load model files
async function loadModels() {
    if (!detModelBytes || !recModelBytes || !dictionaryBytes) {
        return false;
    }

    try {
        showStatus('OCRエンジンを初期化しています...', 'loading');
        const builder = new WasmOcrEngineBuilder();

        const detLimit = parseInt(detLimitSideLen.value) || 960;
        const unclipRatio = parseFloat(detUnclipRatio.value) || 1.5;
        const batchSize = parseInt(recBatchSize.value) || 8;

        engine = builder
            .det_model_bytes(new Uint8Array(detModelBytes))
            .rec_model_bytes(new Uint8Array(recModelBytes))
            .dictionary_bytes(new Uint8Array(dictionaryBytes))
            .det_limit_side_len(detLimit)
            .det_unclip_ratio(unclipRatio)
            .rec_batch_size(batchSize)
            .build();

        showStatus('OCRエンジンの初期化が完了しました。', 'success');
        return true;
    } catch (error) {
        showStatus(`OCRエンジンの初期化に失敗しました: ${error.message}`, 'error');
        console.error('Engine initialization error:', error);
        return false;
    }
}

// Handle model source change
modelSourceSelect.addEventListener('change', onModelSourceChange);

function onModelSourceChange() {
    modelSource = modelSourceSelect.value;
    
    if (modelSource === 'upload') {
        modelUploadSection.classList.remove('hidden');
        // アップロードモードに切り替えた場合、既にアップロード済みのファイルがある場合は保持する
        // エンジンは再構築が必要なためクリア
        engine = null;
        showStatus('ファイルアップロードモードに切り替えました。各ファイルを個別に選択できます。', 'info');
    } else {
        modelUploadSection.classList.add('hidden');
        // fetchモードに戻った場合は、サーバーから再度読み込む
        loadModelsFromServer();
    }
    
    updateButtonStates();
}

// Handle model file inputs - 個別のファイルを切り替え可能にする
detModelInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            detModelBytes = await readFileAsArrayBuffer(file);
            showStatus('検出モデルを読み込みました。', 'success');
            // 他のファイルも読み込まれている場合はエンジンを再構築
            if (recModelBytes && dictionaryBytes) {
                await loadModels();
            } else {
                showStatus('認識モデルと辞書ファイルも読み込む必要があります。', 'info');
            }
            updateButtonStates();
        } catch (error) {
            showStatus(`検出モデルの読み込みに失敗しました: ${error.message}`, 'error');
        }
    }
});

recModelInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            recModelBytes = await readFileAsArrayBuffer(file);
            showStatus('認識モデルを読み込みました。', 'success');
            // 他のファイルも読み込まれている場合はエンジンを再構築
            if (detModelBytes && dictionaryBytes) {
                await loadModels();
            } else {
                showStatus('検出モデルと辞書ファイルも読み込む必要があります。', 'info');
            }
            updateButtonStates();
        } catch (error) {
            showStatus(`認識モデルの読み込みに失敗しました: ${error.message}`, 'error');
        }
    }
});

dictionaryInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            dictionaryBytes = await readFileAsArrayBuffer(file);
            showStatus('辞書ファイルを読み込みました。', 'success');
            // 他のファイルも読み込まれている場合はエンジンを再構築
            if (detModelBytes && recModelBytes) {
                await loadModels();
            } else {
                showStatus('検出モデルと認識モデルも読み込む必要があります。', 'info');
            }
            updateButtonStates();
        } catch (error) {
            showStatus(`辞書ファイルの読み込みに失敗しました: ${error.message}`, 'error');
        }
    }
});

// Handle image file input
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await handleImageFile(file);
    }
});

// Handle drag and drop
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadSection.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        await handleImageFile(file);
    } else {
        showStatus('画像ファイルを選択してください。', 'error');
    }
});

// Handle image file
async function handleImageFile(file) {
    try {
        currentImageBytes = await readFileAsArrayBuffer(file);
        
        // Show preview
        const blob = new Blob([currentImageBytes], { type: file.type });
        const url = URL.createObjectURL(blob);
        previewImage.src = url;
        previewSection.classList.remove('hidden');
        
        showStatus(`画像を読み込みました: ${file.name}`, 'success');
        updateButtonStates();
    } catch (error) {
        showStatus(`画像の読み込みに失敗しました: ${error.message}`, 'error');
    }
}

// Update button states
function updateButtonStates() {
    const hasModels = detModelBytes && recModelBytes && dictionaryBytes;
    const canRunOcr = wasmInitialized && hasModels && currentImageBytes;
    ocrBtn.disabled = !canRunOcr;
}

// Run OCR
ocrBtn.addEventListener('click', async () => {
    // エンジンがない、またはモデルが変更された場合は再構築
    if (!engine || !detModelBytes || !recModelBytes || !dictionaryBytes) {
        const success = await loadModels();
        if (!success) {
            return;
        }
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
        updateButtonStates();
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

// Copy results
copyBtn.addEventListener('click', () => {
    resultTextarea.select();
    document.execCommand('copy');
    showStatus('結果をクリップボードにコピーしました。', 'success');
});

// Download results
downloadBtn.addEventListener('click', () => {
    const blob = new Blob([resultTextarea.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr_results.txt';
    a.click();
    URL.revokeObjectURL(url);
    showStatus('結果をダウンロードしました。', 'success');
});

// Clear
clearBtn.addEventListener('click', () => {
    if (modelSource === 'upload') {
        detModelInput.value = '';
        recModelInput.value = '';
        dictionaryInput.value = '';
        detModelBytes = null;
        recModelBytes = null;
        dictionaryBytes = null;
        engine = null;
    }
    
    fileInput.value = '';
    currentImageBytes = null;
    
    previewSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    statusMessage.innerHTML = '';
    
    updateButtonStates();
    
    if (modelSource === 'fetch') {
        showStatus('モデルファイルをクリアしました。', 'info');
    } else {
        showStatus('モデルファイルと画像をクリアしました。', 'info');
    }
});

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.innerHTML = `<div class="${type}">${message}</div>`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 5000);
    }
}

// Initialize on load
window.addEventListener('load', () => {
    initializeWasm();
});

