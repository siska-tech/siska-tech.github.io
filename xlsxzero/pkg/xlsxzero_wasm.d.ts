/* tslint:disable */
/* eslint-disable */
/**
 * Get version information
 */
export function get_version(): string;
/**
 * Initialize panic hook for better error messages in the browser
 */
export function init(): void;
/**
 * Convert Excel file (as bytes) to Markdown string
 *
 * # Arguments
 * * `excel_bytes` - Excel file content as a Uint8Array from JavaScript
 *
 * # Returns
 * * Success: Markdown string
 * * Error: Error message string
 */
export function convert_excel_to_markdown(excel_bytes: Uint8Array): string;
/**
 * Convert Excel file with custom options
 *
 * # Arguments
 * * `excel_bytes` - Excel file content as a Uint8Array from JavaScript
 * * `sheet_index` - Optional sheet index (0-based), null for all sheets
 * * `merge_strategy` - Merge strategy: "data_duplication" or "html_fallback"
 * * `date_format` - Date format: "iso8601" or custom format string
 *
 * # Returns
 * * Success: Markdown string
 * * Error: Error message string
 */
export function convert_excel_to_markdown_custom(excel_bytes: Uint8Array, sheet_index?: number | null, merge_strategy?: string | null, date_format?: string | null): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly convert_excel_to_markdown: (a: number, b: number) => [number, number, number, number];
  readonly convert_excel_to_markdown_custom: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
  readonly get_version: () => [number, number];
  readonly init: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
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
