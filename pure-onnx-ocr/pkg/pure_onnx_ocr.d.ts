/* tslint:disable */
/* eslint-disable */
/**
 * Creates a WASM OCR engine with embedded models.
 *
 * This function uses `include_bytes!` to embed model files at compile time.
 * Note: This will significantly increase the WASM module size (~20MB+).
 *
 * # Example
 *
 * ```rust,no_run
 * // In your Rust code (when building WASM)
 * use pure_onnx_ocr::wasm::WasmOcrEngineBuilder;
 *
 * let det_bytes = include_bytes!("../../tests/fixtures/models/ppocrv5/det.onnx");
 * let rec_bytes = include_bytes!("../../tests/fixtures/models/ppocrv5/rec.onnx");
 * let dict_bytes = include_bytes!("../../tests/fixtures/models/ppocrv5/ppocrv5_dict.txt");
 *
 * let builder = WasmOcrEngineBuilder::new()
 *     .det_model_bytes(det_bytes)
 *     .rec_model_bytes(rec_bytes)
 *     .dictionary_bytes(dict_bytes)
 *     .build()?;
 * ```
 */
export function create_engine_with_embedded_models(det_model_bytes: Uint8Array, rec_model_bytes: Uint8Array, dictionary_bytes: Uint8Array): WasmOcrEngine;
export function init(): void;
/**
 * WASM-compatible OCR engine that loads models from memory.
 */
export class WasmOcrEngine {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Runs OCR on an image from bytes (JPEG, PNG, etc.).
   *
   * # Arguments
   * * `image_bytes` - Image file as bytes
   *
   * # Returns
   * JSON string containing OCR results
   */
  run_from_bytes(image_bytes: Uint8Array): string;
}
/**
 * WASM-compatible OCR engine builder.
 */
export class WasmOcrEngineBuilder {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Creates a new builder instance.
   */
  constructor();
  /**
   * Sets the detection model bytes.
   */
  det_model_bytes(bytes: Uint8Array): WasmOcrEngineBuilder;
  /**
   * Sets the recognition model bytes.
   */
  rec_model_bytes(bytes: Uint8Array): WasmOcrEngineBuilder;
  /**
   * Sets the dictionary bytes.
   */
  dictionary_bytes(bytes: Uint8Array): WasmOcrEngineBuilder;
  /**
   * Sets the detection limit side length.
   */
  det_limit_side_len(len: number): WasmOcrEngineBuilder;
  /**
   * Sets the detection unclip ratio.
   */
  det_unclip_ratio(ratio: number): WasmOcrEngineBuilder;
  /**
   * Sets the recognition batch size.
   */
  rec_batch_size(size: number): WasmOcrEngineBuilder;
  /**
   * Builds the OCR engine.
   */
  build(): WasmOcrEngine;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmocrengine_free: (a: number, b: number) => void;
  readonly wasmocrengine_run_from_bytes: (a: number, b: number, c: number) => [number, number, number, number];
  readonly __wbg_wasmocrenginebuilder_free: (a: number, b: number) => void;
  readonly wasmocrenginebuilder_new: () => number;
  readonly wasmocrenginebuilder_det_model_bytes: (a: number, b: number, c: number) => number;
  readonly wasmocrenginebuilder_rec_model_bytes: (a: number, b: number, c: number) => number;
  readonly wasmocrenginebuilder_dictionary_bytes: (a: number, b: number, c: number) => number;
  readonly wasmocrenginebuilder_det_limit_side_len: (a: number, b: number) => number;
  readonly wasmocrenginebuilder_det_unclip_ratio: (a: number, b: number) => number;
  readonly wasmocrenginebuilder_rec_batch_size: (a: number, b: number) => number;
  readonly wasmocrenginebuilder_build: (a: number) => [number, number, number];
  readonly create_engine_with_embedded_models: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly init: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
