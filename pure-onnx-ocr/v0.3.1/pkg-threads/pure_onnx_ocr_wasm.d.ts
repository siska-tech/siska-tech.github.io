/* tslint:disable */
/* eslint-disable */
/**
 * Whether this build runs inference on multiple threads (`true` only for
 * the `threads` build).
 */
export function threadsSupported(): boolean;
export function initThreadPool(num_threads: number): Promise<any>;
export function wbg_rayon_start_worker(receiver: number): void;
/**
 * Chroma subsampling format
 */
export enum ChromaSampling {
  /**
   * Both vertically and horizontally subsampled.
   */
  Cs420 = 0,
  /**
   * Horizontally subsampled.
   */
  Cs422 = 1,
  /**
   * Not subsampled.
   */
  Cs444 = 2,
  /**
   * Monochrome.
   */
  Cs400 = 3,
}
/**
 * OCR engine. `run` is synchronous; call it from a Web Worker to keep the
 * page responsive.
 */
export class OcrEngine {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Same as `run`, plus stage timings in milliseconds and the detected
   * page orientation: `{ results, timings, docOrientationAngle }`.
   */
  runWithMetrics(image: Uint8Array): object;
  /**
   * Runs OCR on an encoded image (PNG, JPEG, ...).
   *
   * Returns `[{ text, confidence, box, polygon }, ...]`: `box` is the rotated
   * 4-point rectangle (top-left first, clockwise). `polygon` contains the
   * engine's bounding-box exterior without its repeated closing point;
   * it is not the original detection contour. Coordinates are input pixels.
   */
  run(image: Uint8Array): Array<any>;
  /**
   * Number of threads this engine runs inference on.
   */
  readonly inferenceThreads: number;
}
/**
 * Builder mirroring `pure_onnx_ocr::OcrEngineBuilder` with in-memory inputs.
 */
export class OcrEngineBuilder {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * `"max"` (default) bounds the longest side, `"min"` the shortest side.
   */
  detLimitType(limit_type: string): OcrEngineBuilder;
  /**
   * Recognition batch size (default 1; with tract, one crop per batch is
   * fastest because it avoids padding crops to a common width).
   */
  recBatchSize(size: number): OcrEngineBuilder;
  /**
   * Plain text dictionary (one character per line), e.g. `ppocrv5_dict.txt`.
   */
  dictionaryText(text: string): OcrEngineBuilder;
  /**
   * Number of inference threads. Defaults to the size of the pool started
   * by `initThreadPool` and is capped to it; always 1 in the
   * single-threaded build. Same as the Rust builder's `inference_threads`.
   */
  inferenceThreads(threads: number): OcrEngineBuilder;
  /**
   * Detection size limit (default 960, longest side).
   */
  detLimitSideLen(len: number): OcrEngineBuilder;
  /**
   * Optional document orientation classifier (`PP-LCNet_x1_0_doc_ori`).
   */
  docOrientationModel(model: Uint8Array, config_yaml: string): OcrEngineBuilder;
  /**
   * Optional text-line orientation classifier (`PP-LCNet_x0_25_textline_ori`).
   */
  textlineOrientationModel(model: Uint8Array, config_yaml: string): OcrEngineBuilder;
  constructor();
  /**
   * Loads the models and returns a ready engine.
   */
  build(): OcrEngine;
  /**
   * `"rotated"` (default) or `"axis"`.
   */
  cropMode(mode: string): OcrEngineBuilder;
  /**
   * Detection model: `inference.onnx` bytes and `inference.yml` text.
   */
  detModel(model: Uint8Array, config_yaml: string): OcrEngineBuilder;
  /**
   * Recognition model: `inference.onnx` bytes and `inference.yml` text
   * (the dictionary embedded in the YAML is used).
   */
  recModel(model: Uint8Array, config_yaml: string): OcrEngineBuilder;
}
export class wbg_rayon_PoolBuilder {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  numThreads(): number;
  build(): void;
  mainJS(): string;
  receiver(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly __wbg_ocrengine_free: (a: number, b: number) => void;
  readonly __wbg_ocrenginebuilder_free: (a: number, b: number) => void;
  readonly ocrengine_inferenceThreads: (a: number) => number;
  readonly ocrengine_run: (a: number, b: number, c: number) => [number, number, number];
  readonly ocrengine_runWithMetrics: (a: number, b: number, c: number) => [number, number, number];
  readonly ocrenginebuilder_build: (a: number) => [number, number, number];
  readonly ocrenginebuilder_cropMode: (a: number, b: number, c: number) => [number, number, number];
  readonly ocrenginebuilder_detLimitSideLen: (a: number, b: number) => number;
  readonly ocrenginebuilder_detLimitType: (a: number, b: number, c: number) => [number, number, number];
  readonly ocrenginebuilder_detModel: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly ocrenginebuilder_dictionaryText: (a: number, b: number, c: number) => number;
  readonly ocrenginebuilder_docOrientationModel: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly ocrenginebuilder_inferenceThreads: (a: number, b: number) => number;
  readonly ocrenginebuilder_new: () => number;
  readonly ocrenginebuilder_recBatchSize: (a: number, b: number) => number;
  readonly ocrenginebuilder_recModel: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly ocrenginebuilder_textlineOrientationModel: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly threadsSupported: () => number;
  readonly __wbg_wbg_rayon_poolbuilder_free: (a: number, b: number) => void;
  readonly initThreadPool: (a: number) => any;
  readonly wbg_rayon_poolbuilder_build: (a: number) => void;
  readonly wbg_rayon_poolbuilder_mainJS: (a: number) => any;
  readonly wbg_rayon_poolbuilder_numThreads: (a: number) => number;
  readonly wbg_rayon_poolbuilder_receiver: (a: number) => number;
  readonly wbg_rayon_start_worker: (a: number) => void;
  readonly memory: WebAssembly.Memory;
  readonly __wbindgen_exn_store_command_export: (a: number) => void;
  readonly __externref_table_alloc_command_export: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc_command_export: (a: number, b: number) => number;
  readonly __wbindgen_realloc_command_export: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc_command_export: (a: number) => void;
  readonly __wbindgen_thread_destroy: (a?: number, b?: number, c?: number) => void;
  readonly __wbindgen_start: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput, memory?: WebAssembly.Memory, thread_stack_size?: number }} module - Passing `SyncInitInput` directly is deprecated.
* @param {WebAssembly.Memory} memory - Deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput, memory?: WebAssembly.Memory, thread_stack_size?: number } | SyncInitInput, memory?: WebAssembly.Memory): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput>, memory?: WebAssembly.Memory, thread_stack_size?: number }} module_or_path - Passing `InitInput` directly is deprecated.
* @param {WebAssembly.Memory} memory - Deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput>, memory?: WebAssembly.Memory, thread_stack_size?: number } | InitInput | Promise<InitInput>, memory?: WebAssembly.Memory): Promise<InitOutput>;
