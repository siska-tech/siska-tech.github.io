// Runs pure-onnx-ocr v0.3.1 in a Web Worker so the page stays responsive while
// the (synchronous) WebAssembly inference runs.
//
// When the page is cross-origin isolated (coi-serviceworker.js adds the
// COOP/COEP headers), the multi-threaded build in ./pkg-threads is used: its
// rayon threads are nested Workers started from this Worker. Otherwise, or if
// it fails to start, the single-threaded build in ./pkg is used.

const CACHE_NAME = "pure-onnx-ocr-models-v1";
let engine = null;
let wasm = null;

// `threads`: 0 = all logical CPUs, 1 = single-threaded build, n = n threads.
async function loadWasm(threads) {
  if (threads !== 1 && self.crossOriginIsolated) {
    try {
      const module = await import("./pkg-threads/pure_onnx_ocr_wasm.js");
      await module.default();
      const poolSize = threads || Math.min(navigator.hardwareConcurrency || 4, 8);
      progress(`スレッドプールを起動中（${poolSize} スレッド）`, 0, 0);
      await module.initThreadPool(poolSize);
      return { module, build: "threads" };
    } catch (error) {
      console.warn("multi-threaded build unavailable, using the single-threaded one:", error);
    }
  }
  const module = await import("./pkg/pure_onnx_ocr_wasm.js");
  await module.default();
  return { module, build: "single" };
}

function progress(label, loaded, total) {
  self.postMessage({ type: "progress", label, loaded, total });
}

// Fetches a file, reporting download progress. Files from Hugging Face are kept
// in the Cache API so they are downloaded only once.
async function fetchFile(url, label) {
  const cacheable = url.startsWith("https://");
  let cache = null;
  if (cacheable && self.caches) {
    try {
      cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) {
        progress(`${label} (キャッシュ)`, 1, 1);
        return new Uint8Array(await hit.arrayBuffer());
      }
    } catch {
      cache = null;
    }
  }

  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`${label} をダウンロードできませんでした（${url}）: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${url} の取得に失敗しました (HTTP ${response.status})`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress(label, loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  if (cache) {
    try {
      await cache.put(url, new Response(bytes));
    } catch {
      // Quota exceeded or private mode: just skip caching.
    }
  }
  return bytes;
}

const decoder = new TextDecoder();
const fetchText = async (url, label) => decoder.decode(await fetchFile(url, label));

// A model is `{ onnx, yml, label }`; `yml` may be null for legacy single-file
// models (e.g. PP-OCRv5 det.onnx / rec.onnx).
async function loadModel(model) {
  const bytes = await fetchFile(model.onnx, `${model.label} (onnx)`);
  const yml = model.yml ? await fetchText(model.yml, `${model.label} (yml)`) : "";
  return [bytes, yml];
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      const started = performance.now();
      // The thread pool can only be started once per Worker; the page starts
      // a new Worker when the thread count changes.
      wasm ??= await loadWasm(data.threads ?? 0);
      engine?.free();
      engine = null;
      let builder = new wasm.module.OcrEngineBuilder()
        .detModel(...(await loadModel(data.det)))
        .recModel(...(await loadModel(data.rec)));
      if (data.dictionary) {
        builder = builder.dictionaryText(await fetchText(data.dictionary, "辞書"));
      }
      if (data.textlineOrientation) {
        builder = builder.textlineOrientationModel(...(await loadModel(data.textlineOrientation)));
      }
      if (data.docOrientation) {
        builder = builder.docOrientationModel(...(await loadModel(data.docOrientation)));
      }
      builder = builder.detLimitSideLen(data.detLimitSideLen);
      progress("エンジンを構築中", 0, 0);
      engine = builder.build();
      self.postMessage({
        type: "loaded",
        ms: performance.now() - started,
        build: wasm.build,
        threads: engine.inferenceThreads,
        crossOriginIsolated: self.crossOriginIsolated,
      });
    } else if (data.type === "run") {
      const output = engine.runWithMetrics(new Uint8Array(data.image));
      self.postMessage({
        type: "result",
        results: output.results,
        timings: output.timings,
        docOrientationAngle: output.docOrientationAngle,
      });
    }
  } catch (error) {
    self.postMessage({ type: "error", message: String(error && error.message ? error.message : error) });
  }
};
