// 薙刀式キーボード 設定ツール — VIAライクUI版。
// WebHID で vendor HID(IF1) と read/write する。
//
// プロトコル v2（64B固定, firmware/src/usb_config.rs と一致）:
//   OUT(host→dev): [0]=cmd [1]=seq [2..]=args
//   IN (dev→host): [0]=cmd [1]=seq [2]=status [3..]=payload
// 既定値は静的テーブル(phf)由来、差分はステージング。JS でマージして表示。
// UX: 編集は即座に WRITE（RAMステージング）→ COMMIT でフラッシュ保存 → 再起動で有効。

'use strict';

// ============================================================ プロトコル定数

const REPORT_LEN = 64;
const FILTERS = [{ vendorId: 0xc0de, usagePage: 0xff00, usage: 0x01 }];

const CMD = {
  INFO: 0x01,
  READ_DEFAULTS: 0x02,
  READ_OVERRIDES: 0x03,
  WRITE: 0x04,
  COMMIT: 0x05,
  RESET: 0x06,
  REBOOT: 0x07,
  READ_PARAMS: 0x08,
  WRITE_PARAMS: 0x09,
  READ_MATRIX: 0x0a,
  READ_LASTKEY: 0x0b,
  READ_MATRIX_FULL: 0x0c, // 全物理スイッチ列挙（capability MATRIX_FULL 必須）
  READ_LAYOUT: 0x0d, // キー形状読み出し（capability LAYOUT 必須）
};
const SEC = { LAYERS: 1, COMBO2: 2, COMBO3: 3, MODES: 4, EXTRA: 5, CUSTOM: 6 };
const ST_OK = 0x00;
const TAG_KANA = 0;
const TAG_KEYS = 1;
const TAG_HOLD = 2; // 押しっぱなし保持 (usage,mod) 1ペア（capability HOLD 必須）

// INFO 応答 [16] の capability ビット（旧FWは 0 = 全機能なし）。
const CAP = { MATRIX_FULL: 0x01, LAYOUT: 0x02, HOLD: 0x04, PASSTHROUGH: 0x08, CUSTOM_LAYERS: 0x10 };
const hasCap = (bit) => !!(info && (info.caps & bit));

// 内部擬似 usage（レイヤー活性化。FW 内部解釈のみで HID には出ない）。
// 0xF0|n = MO(n)（ホールド中）、0xF8|n = TG(n)（トグル）。layer 0 = QWERTY パススルー、
// 1..7 = カスタムレイヤー（未割当キーはパススルーへ透過）。
const PSEUDO_MO_BASE = 0xf0;
const PSEUDO_TG_BASE = 0xf8;
const isPseudo = (u) => u >= PSEUDO_MO_BASE;
const customLabel = (n) => (n === 0 ? 'QWERTY' : `カスタム${n}`);

// Params.flags のビット。
const PFLAG_PASS_IME = 0x01; // パススルー有効化時 LANG2 / 解除時 LANG1 を自動送出

// sc(Set-1 スキャンコード) → QWERTY 物理キーラベル（layout/naginata.yaml 準拠）。
const SC_LABEL = {
  0x02: '1', 0x03: '2', 0x04: '3', 0x05: '4', 0x06: '5',
  0x07: '6', 0x08: '7', 0x09: '8', 0x0a: '9', 0x0b: '0',
  0x10: 'Q', 0x11: 'W', 0x12: 'E', 0x13: 'R', 0x14: 'T',
  0x15: 'Y', 0x16: 'U', 0x17: 'I', 0x18: 'O', 0x19: 'P',
  0x1e: 'A', 0x1f: 'S', 0x20: 'D', 0x21: 'F', 0x22: 'G',
  0x23: 'H', 0x24: 'J', 0x25: 'K', 0x26: 'L', 0x27: ';',
  0x2c: 'Z', 0x2d: 'X', 0x2e: 'C', 0x2f: 'V', 0x30: 'B',
  0x31: 'N', 0x32: 'M', 0x33: ',', 0x34: '.', 0x35: '/',
  0x39: 'Space',
};
const scLabel = (sc) => SC_LABEL[sc] || ('0x' + sc.toString(16));

// シフトビット → 面名（layout/naginata.yaml shifts と一致）。
const SHIFT_BITS = [
  [0x01, 'センター'], [0x02, '右濁(J)'], [0x04, '左濁(F)'],
  [0x08, '右半(M)'], [0x10, '左半(V)'], [0x20, '小(Q)'],
];
function maskLabel(mask) {
  if (mask === 0) return '単打';
  const parts = SHIFT_BITS.filter(([b]) => mask & b).map(([, n]) => n);
  return parts.length ? parts.join('+') : ('mask 0x' + mask.toString(16));
}
const modeLabel = (m) => '編集モード' + m;

// 記号名 → [usage, modifiers]（build.rs symbol_to_keys のミラー。CTRL=1, SHIFT=2。要同期）。
const SYMBOLS = [
  ['LANG1', 0x90, 0], ['LANG2', 0x91, 0], ['Enter', 0x28, 0], ['Esc', 0x29, 0],
  ['BS', 0x2a, 0], ['Tab', 0x2b, 0], ['Space', 0x2c, 0], ['Del', 0x4c, 0],
  ['Home', 0x4a, 0], ['End', 0x4d, 0], ['Right', 0x4f, 0], ['Left', 0x50, 0],
  ['Down', 0x51, 0], ['Up', 0x52, 0], ['Comma', 0x36, 0], ['Period', 0x37, 0],
  ['S-Left', 0x50, 2], ['S-Right', 0x4f, 2], ['S-Up', 0x52, 2], ['S-Down', 0x51, 2],
  ['S-Home', 0x4a, 2], ['S-End', 0x4d, 2],
  ['C-c', 0x06, 1], ['C-x', 0x1b, 1], ['C-v', 0x19, 1], ['C-y', 0x1c, 1],
  ['C-z', 0x1d, 1], ['C-i', 0x0c, 1], ['C-u', 0x18, 1], ['C-s', 0x16, 1],
  // 直接キー(#12 フェーズ3 未使用キー割当)用の追加記号。firmware は raw (usage,mod) で扱う。
  ['F1', 0x3a, 0], ['F2', 0x3b, 0], ['F3', 0x3c, 0], ['F4', 0x3d, 0],
  ['F5', 0x3e, 0], ['F6', 0x3f, 0], ['F7', 0x40, 0], ['F8', 0x41, 0],
  ['F9', 0x42, 0], ['F10', 0x43, 0], ['F11', 0x44, 0], ['F12', 0x45, 0],
  ['PageUp', 0x4b, 0], ['PageDown', 0x4e, 0], ['Insert', 0x49, 0],
  ['Win', 0xe3, 0], ['App/Menu', 0x65, 0], ['CapsLock', 0x39, 0],
];
const SYM_BY_CODE = Object.fromEntries(SYMBOLS.map(([n, u, m]) => [u + ',' + m, n]));

// 直接キー合成用のベースキー（修飾なし）: プリセットの修飾なし＋A-Z＋数字＋修飾キー単体。
const LETTERS = Array.from({ length: 26 }, (_, i) => [String.fromCharCode(65 + i), 0x04 + i, 0]);
const DIGITS = [['1', 0x1e, 0], ['2', 0x1f, 0], ['3', 0x20, 0], ['4', 0x21, 0], ['5', 0x22, 0],
  ['6', 0x23, 0], ['7', 0x24, 0], ['8', 0x25, 0], ['9', 0x26, 0], ['0', 0x27, 0]];
// 修飾キー単体（タップ。押しっぱなし保持は未対応）。
const MODKEYS = [['Ctrl', 0xe0, 0], ['Shift', 0xe1, 0], ['Alt', 0xe2, 0], ['AltGr', 0xe6, 0], ['RShift', 0xe5, 0]];
const BASE_KEYS = [...SYMBOLS.filter((s) => s[2] === 0), ...LETTERS, ...DIGITS, ...MODKEYS];
const USAGE_NAME = {};
for (const [n, u, m] of BASE_KEYS) if (m === 0 && !(u in USAGE_NAME)) USAGE_NAME[u] = n;
// 修飾チェックボックス（HID modifier ビット: Ctrl=1 Shift=2 Alt=4 GUI=8）。
const MOD_DEFS = [['Ctrl', 1], ['Shift', 2], ['Alt', 4], ['GUI', 8]];

// (usage,mod) → 表示名。完全一致プリセット優先、無ければ 修飾接頭辞＋ベース名。
function symName(u, m) {
  if (isPseudo(u)) {
    const n = u & 7;
    return customLabel(n) + (u >= PSEUDO_TG_BASE ? '(切替)' : '(押下中)');
  }
  if (SYM_BY_CODE[u + ',' + m]) return SYM_BY_CODE[u + ',' + m];
  const base = USAGE_NAME[u] || ('0x' + u.toString(16));
  let p = '';
  if (m & 1) p += 'C-';
  if (m & 2) p += 'S-';
  if (m & 4) p += 'A-';
  if (m & 8) p += 'G-';
  return p + base;
}

const PARAM_FIELDS = [
  { key: 'window_ms', label: '同時打鍵窓', unit: 'ms', min: 5, max: 200,
    desc: '同時押し判定の時間窓。小さいほど同時判定がシビアに。' },
  { key: 'tap_ms', label: 'デバウンス / タップ', unit: 'ms', min: 1, max: 200,
    desc: 'チャタリング除去とタップ判定の時間。' },
  { key: 'repeat_delay_ms', label: 'リピート初回ディレイ', unit: 'ms', min: 50, max: 2000,
    desc: 'キーを押し続けてからリピートが始まるまでの時間。' },
  { key: 'repeat_interval_ms', label: 'リピート間隔', unit: 'ms', min: 5, max: 1000,
    desc: 'リピート中のキー送出間隔。' },
  { key: 'led_brightness', label: 'LED輝度', unit: '', min: 0, max: 255,
    desc: '0 = 消灯、255 = 最大。' },
];

// かなパレット（クリックで入力欄へ追加）。
const KANA_GROUPS = [
  ['清音', 'あいうえお かきくけこ さしすせそ たちつてと なにぬねの はひふへほ まみむめも や　ゆ　よ らりるれろ わ　を　ん'],
  ['濁音・半濁音', 'がぎぐげご ざじずぜぞ だぢづでど ばびぶべぼ ぱぴぷぺぽ ゔ'],
  ['小書き・記号', 'ぁぃぅぇぉ ゃゅょ っ ー 、。 ・「」'],
];

const utf8enc = new TextEncoder();
const utf8dec = new TextDecoder('utf-8');

// ============================================================ 状態

let device = null;
let seq = 0;
const pending = new Map();

let info = null;
let params = {};
// 各セクションの行モデル。行 = { key:[..], def:val|null, init:val, cur:val, ovr:bool }
//   val = { tag:0, kana:"" } | { tag:1, keys:[[u,m],..] }
const model = { layers: [], combo2: [], combo3: [], modes: [], extra: [], custom: [] };
let matrixMap = {}; // "hand,row,col" -> sc（薙刀式キーのみ）
// 全物理スイッチ "hand,row,col" -> { sc, flags }（READ_MATRIX_FULL。旧FWは matrixMap から合成）。
// sc=0 が未使用キー（EXTRA 割当候補）。flags: bit0=薙刀式, bit1=EXTRA割当あり（読出時点）。
let physMap = {};
// キー形状 "hand,row,col" -> { x, y, w, h, rot }（READ_LAYOUT。x/y/w/h は 0.25u 単位、rot は度）。
// 空ならグリッド描画へフォールバック。
let layoutMap = {};

const state = {
  pane: 'keymap',       // keymap | combos | extra | params | file
  layer: null,          // {kind:'mask'|'mode'|'custom', val}
  addedCustom: [],      // 「＋ レイヤー追加」でこのセッション中に追加したカスタムレイヤー id
  sel: null,            // {name, section, row, label, kanaOk, keysOk}
  editorTab: null,      // 'kana' | 'keys'（選択中の値エディタタブ）
  chord: [],            // コンボペインで選択中の sc 列
  uncommitted: false,   // WRITE 済みで COMMIT 未実行
  demo: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

function setStatus(text, cls) {
  const el = $('status');
  el.textContent = text || '';
  el.className = 'status' + (cls ? ' ' + cls : '');
  if (text && cls !== 'err') {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000);
  }
}

// ============================================================ WebHID 送受信

function onInputReport(event) {
  const d = event.data;
  if (d.byteLength < REPORT_LEN - 1) return; // 8B のキーボード入力は無視
  const s = d.getUint8(1);
  const r = pending.get(s);
  if (r) {
    pending.delete(s);
    r(d);
  }
}
function sendCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const s = (seq = (seq + 1) & 0xff);
    const out = new Uint8Array(REPORT_LEN);
    out[0] = cmd;
    out[1] = s;
    for (let i = 0; i < args.length && i < REPORT_LEN - 2; i++) out[2 + i] = args[i];
    const timer = setTimeout(() => {
      if (pending.has(s)) {
        pending.delete(s);
        reject(new Error('応答タイムアウト cmd=0x' + cmd.toString(16)));
      }
    }, 2000);
    pending.set(s, (d) => {
      clearTimeout(timer);
      resolve(d);
    });
    device.sendReport(0, out).catch((e) => {
      clearTimeout(timer);
      pending.delete(s);
      reject(e);
    });
  });
}

// ============================================================ 値デコード/比較

function decodeValue(d, p) {
  const tag = d.getUint8(p);
  const len = d.getUint8(p + 1);
  let off = p + 2;
  if (tag === TAG_KANA) {
    const b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = d.getUint8(off + i);
    return { value: { tag: TAG_KANA, kana: utf8dec.decode(b) }, next: off + len };
  } else if (tag === TAG_HOLD) {
    return { value: { tag: TAG_HOLD, hold: [d.getUint8(off), d.getUint8(off + 1)] }, next: off + len };
  } else {
    const keys = [];
    for (let i = 0; i < len; i += 2) keys.push([d.getUint8(off + i), d.getUint8(off + i + 1)]);
    return { value: { tag: TAG_KEYS, keys }, next: off + len };
  }
}
function decodeEntry(section, d, off) {
  if (section === SEC.COMBO3 || section === SEC.EXTRA) {
    const key = [d.getUint8(off), d.getUint8(off + 1), d.getUint8(off + 2)];
    const { value, next } = decodeValue(d, off + 3);
    return { entry: { key, value }, no: next };
  }
  const key = [d.getUint8(off), d.getUint8(off + 1)];
  const { value, next } = decodeValue(d, off + 2);
  return { entry: { key, value }, no: next };
}
function clone(v) {
  if (v.tag === TAG_KANA) return { tag: 0, kana: v.kana };
  if (v.tag === TAG_HOLD) return { tag: 2, hold: v.hold.slice() };
  return { tag: 1, keys: v.keys.map((p) => p.slice()) };
}
function valuesEqual(a, b) {
  if (!a || !b || a.tag !== b.tag) return false;
  if (a.tag === TAG_KANA) return a.kana === b.kana;
  if (a.tag === TAG_HOLD) return a.hold[0] === b.hold[0] && a.hold[1] === b.hold[1];
  if (a.keys.length !== b.keys.length) return false;
  return a.keys.every((p, i) => p[0] === b.keys[i][0] && p[1] === b.keys[i][1]);
}
const keyId = (key) => key.join(',');
function isEmptyVal(v) {
  if (v.tag === TAG_KANA) return !v.kana;
  if (v.tag === TAG_HOLD) return !v.hold[0] && !v.hold[1];
  return v.keys.length === 0;
}
function valueText(v) {
  if (!v || isEmptyVal(v)) return '';
  if (v.tag === TAG_KANA) return v.kana;
  if (v.tag === TAG_HOLD) return symName(v.hold[0], v.hold[1]) + '⤓'; // ホールド表示
  return v.keys.map(([u, m]) => symName(u, m)).join(' ');
}

// ============================================================ 読み出し

async function readSection(cmd, section) {
  const out = [];
  let start = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const d = await sendCommand(cmd, [section, start & 0xff, (start >> 8) & 0xff]);
    const next = d.getUint8(4) | (d.getUint8(5) << 8);
    const count = d.getUint8(6);
    let off = 7;
    for (let i = 0; i < count; i++) {
      const { entry, no } = decodeEntry(section, d, off);
      out.push(entry);
      off = no;
    }
    if (count === 0 || next <= start) break;
    start = next;
  }
  return out;
}
async function readMatrix() {
  matrixMap = {};
  let start = 0;
  for (let g = 0; g < 1000; g++) {
    const d = await sendCommand(CMD.READ_MATRIX, [start & 0xff, (start >> 8) & 0xff]);
    const next = d.getUint8(4) | (d.getUint8(5) << 8);
    const count = d.getUint8(6);
    let off = 7;
    for (let i = 0; i < count; i++) {
      const hand = d.getUint8(off), row = d.getUint8(off + 1), col = d.getUint8(off + 2), sc = d.getUint8(off + 3);
      matrixMap[`${hand},${row},${col}`] = sc;
      off += 4;
    }
    if (count === 0 || next <= start) break;
    start = next;
  }
}

// 全物理スイッチ（READ_MATRIX_FULL, entry 5B=[hand,row,col,sc,flags]）。
// 旧FW（capability なし）では matrixMap から合成（薙刀式キーのみ＝旧来挙動）。
async function readMatrixFull() {
  physMap = {};
  if (!hasCap(CAP.MATRIX_FULL)) {
    for (const [k, sc] of Object.entries(matrixMap)) physMap[k] = { sc, flags: 1 };
    return;
  }
  let start = 0;
  for (let g = 0; g < 1000; g++) {
    const d = await sendCommand(CMD.READ_MATRIX_FULL, [start & 0xff, (start >> 8) & 0xff]);
    const next = d.getUint8(4) | (d.getUint8(5) << 8);
    const count = d.getUint8(6);
    let off = 7;
    for (let i = 0; i < count; i++) {
      const hand = d.getUint8(off), row = d.getUint8(off + 1), col = d.getUint8(off + 2);
      physMap[`${hand},${row},${col}`] = { sc: d.getUint8(off + 3), flags: d.getUint8(off + 4) };
      off += 5;
    }
    if (count === 0 || next <= start) break;
    start = next;
  }
}

// キー形状（READ_LAYOUT, entry 8B=[hand,row,col,x,y,w,h,rot]）。capability なしなら空のまま。
async function readLayout() {
  layoutMap = {};
  if (!hasCap(CAP.LAYOUT)) return;
  let start = 0;
  for (let g = 0; g < 1000; g++) {
    const d = await sendCommand(CMD.READ_LAYOUT, [start & 0xff, (start >> 8) & 0xff]);
    const next = d.getUint8(4) | (d.getUint8(5) << 8);
    const count = d.getUint8(6);
    let off = 7;
    for (let i = 0; i < count; i++) {
      const hand = d.getUint8(off), row = d.getUint8(off + 1), col = d.getUint8(off + 2);
      layoutMap[`${hand},${row},${col}`] = {
        x: d.getUint8(off + 3), y: d.getUint8(off + 4),
        w: d.getUint8(off + 5), h: d.getUint8(off + 6),
        rot: d.getInt8(off + 7),
      };
      off += 8;
    }
    if (count === 0 || next <= start) break;
    start = next;
  }
}

function mergeSection(defaults, overrides) {
  const rows = defaults.map((e) => ({ key: e.key, def: e.value, init: clone(e.value), cur: clone(e.value), ovr: false }));
  const byId = new Map(rows.map((r) => [keyId(r.key), r]));
  for (const o of overrides) {
    const r = byId.get(keyId(o.key));
    if (r) {
      r.ovr = true;
      r.init = clone(o.value);
      r.cur = clone(o.value);
    } else {
      const nr = { key: o.key, def: null, init: clone(o.value), cur: clone(o.value), ovr: true };
      rows.push(nr);
      byId.set(keyId(o.key), nr);
    }
  }
  return rows;
}

async function connect() {
  let devices;
  try {
    devices = await navigator.hid.requestDevice({ filters: FILTERS });
  } catch (e) {
    setStatus('接続失敗: ' + e.message, 'err');
    return;
  }
  if (!devices || !devices.length) {
    setStatus('デバイスが選択されませんでした', 'err');
    return;
  }
  await openDevice(devices[0]);
}

async function autoConnect() {
  if (!('hid' in navigator)) return;
  try {
    const devices = await navigator.hid.getDevices();
    const d = devices.find((x) => x.vendorId === 0xc0de &&
      x.collections.some((c) => c.usagePage === 0xff00));
    if (d) await openDevice(d);
  } catch (e) { /* 自動接続失敗は無視（手動接続可能） */ }
}

async function openDevice(d) {
  device = d;
  state.demo = false;
  if (!device.opened) await device.open();
  device.addEventListener('inputreport', onInputReport);
  await readAll();
}

function onDisconnect(e) {
  if (device && e.device === device) {
    device = null;
    showWelcome();
    setStatus('端末が切断されました', 'err');
  }
}

async function readAll() {
  setStatus('読み出し中…');
  const di = await sendCommand(CMD.INFO);
  info = {
    protoVer: di.getUint8(3),
    fwMajor: di.getUint8(4),
    fwMinor: di.getUint8(5),
    maxKeys: di.getUint8(6),
    maxKanaLen: di.getUint8(7),
    caps: di.getUint8(16), // capability ビット（旧FWは 0）
    maxCustomLayers: di.getUint8(17) || 8, // CUSTOM_LAYERS 対応 FW のレイヤー数上限
  };
  const dp = await sendCommand(CMD.READ_PARAMS);
  params = {
    window_ms: dp.getUint16(3, true),
    tap_ms: dp.getUint16(5, true),
    repeat_delay_ms: dp.getUint16(7, true),
    repeat_interval_ms: dp.getUint16(9, true),
    led_brightness: dp.getUint8(11),
    flags: dp.getUint8(12), // 動作フラグ（旧FWは 0）
  };

  for (const [name, sec] of [['layers', SEC.LAYERS], ['combo2', SEC.COMBO2], ['combo3', SEC.COMBO3], ['modes', SEC.MODES]]) {
    const defs = await readSection(CMD.READ_DEFAULTS, sec);
    const ovr = await readSection(CMD.READ_OVERRIDES, sec);
    model[name] = mergeSection(defs, ovr);
  }
  await readMatrix();
  await readMatrixFull();
  await readLayout();
  // 直接キー(EXTRA): 既定なし、差分のみ。行は key=[hand,row,col]。
  const exOvr = await readSection(CMD.READ_OVERRIDES, SEC.EXTRA);
  model.extra = exOvr.map((e) => ({ key: e.key, def: null, init: clone(e.value), cur: clone(e.value), ovr: true }));
  // カスタムレイヤー: 既定なし、差分のみ。行は key=[layer, sc]。
  model.custom = [];
  if (hasCap(CAP.CUSTOM_LAYERS)) {
    const cuOvr = await readSection(CMD.READ_OVERRIDES, SEC.CUSTOM);
    model.custom = cuOvr.map((e) => ({ key: e.key, def: null, init: clone(e.value), cur: clone(e.value), ovr: true }));
  }

  afterLoad(`${device.productName} ・ fw ${info.fwMajor}.${info.fwMinor} ・ proto ${info.protoVer}`);
}

function afterLoad(devLabel) {
  state.layer = layerList()[0] || null;
  state.sel = null;
  state.chord = [];
  $('devName').textContent = devLabel;
  $('rereadBtn').disabled = state.demo;
  $('commitBtn').disabled = false;
  $('rebootBtn').disabled = state.demo;
  $('welcome').style.display = 'none';
  $('paneRoot').style.display = '';
  setStatus('読み込み完了', 'ok');
  renderApp();
}

function showWelcome() {
  $('welcome').style.display = '';
  $('paneRoot').style.display = 'none';
  $('devName').textContent = '';
  $('rereadBtn').disabled = true;
  $('commitBtn').disabled = true;
  $('rebootBtn').disabled = true;
}

// ============================================================ 書き込み（即時・デバウンス）

const writeTimers = new Map();

// 編集のたびに呼ぶ: UI更新＋デバウンス書込（RAMステージング）。
function stageRow(name, section, row, delay = 350) {
  refreshAfterEdit();
  const id = name + ':' + keyId(row.key);
  clearTimeout(writeTimers.get(id));
  writeTimers.set(id, setTimeout(() => {
    writeTimers.delete(id);
    pushRow(name, section, row).catch((e) => setStatus(e.message, 'err'));
  }, delay));
}

async function pushRow(name, section, row) {
  if (valuesEqual(row.cur, row.init)) return;
  const revert = row.def && valuesEqual(row.cur, row.def);
  const remove = revert || (!row.def && isEmptyVal(row.cur));
  if (row.cur.tag === TAG_KANA && !remove && info && utf8enc.encode(row.cur.kana).length > info.maxKanaLen) {
    setStatus(`「${row.cur.kana}」が長すぎます（最大${info.maxKanaLen}バイト）`, 'err');
    return;
  }
  if (state.demo) {
    row.init = clone(row.cur);
    row.ovr = !remove;
    markUncommitted();
    refreshAfterEdit();
    return;
  }
  if (!device) return;
  const args = [section, ...row.key, ...valueBytes(row.cur, remove)];
  if (args.length > REPORT_LEN - 2) {
    setStatus('1エントリが大きすぎます（キー数を減らしてください）', 'err');
    return;
  }
  const resp = await sendCommand(CMD.WRITE, args);
  if (resp.getUint8(2) !== ST_OK) {
    setStatus('送信失敗（容量超過?）', 'err');
    return;
  }
  row.init = clone(row.cur);
  row.ovr = !remove;
  markUncommitted();
  refreshAfterEdit();
  setStatus('端末へ送信しました（未保存）', 'ok');
}

// 編集途中（デバウンス待ち）の行を全部すぐ送る。
async function flushAllStaged() {
  for (const [id, t] of [...writeTimers]) {
    clearTimeout(t);
    writeTimers.delete(id);
  }
  for (const [name, section] of [
    ['layers', SEC.LAYERS], ['combo2', SEC.COMBO2], ['combo3', SEC.COMBO3],
    ['modes', SEC.MODES], ['extra', SEC.EXTRA], ['custom', SEC.CUSTOM],
  ]) {
    for (const row of model[name]) {
      if (!valuesEqual(row.cur, row.init)) await pushRow(name, section, row);
    }
  }
}

function valueBytes(v, isRemove) {
  if (isRemove) return [TAG_KANA, 0];
  if (v.tag === TAG_KANA) {
    const b = utf8enc.encode(v.kana || '');
    return [TAG_KANA, b.length, ...b];
  }
  if (v.tag === TAG_HOLD) return [TAG_HOLD, 2, v.hold[0], v.hold[1]];
  const flat = [];
  (v.keys || []).forEach(([u, m]) => flat.push(u, m));
  return [TAG_KEYS, flat.length, ...flat];
}

let paramTimer = null;
function stageParams() {
  clearTimeout(paramTimer);
  paramTimer = setTimeout(() => {
    pushParams().catch((e) => setStatus(e.message, 'err'));
  }, 400);
}
async function pushParams() {
  if (state.demo) { markUncommitted(); return; }
  if (!device) return;
  const a = new Uint8Array(10);
  const dv = new DataView(a.buffer);
  dv.setUint16(0, params.window_ms, true);
  dv.setUint16(2, params.tap_ms, true);
  dv.setUint16(4, params.repeat_delay_ms, true);
  dv.setUint16(6, params.repeat_interval_ms, true);
  dv.setUint8(8, params.led_brightness);
  dv.setUint8(9, params.flags || 0); // 旧FWは args[11] を読まない（無害）
  const r = await sendCommand(CMD.WRITE_PARAMS, Array.from(a));
  if (r.getUint8(2) === ST_OK) {
    markUncommitted();
    setStatus('パラメータを送信しました（未保存）', 'ok');
  } else {
    setStatus('パラメータ送信失敗', 'err');
  }
}

function markUncommitted() {
  state.uncommitted = true;
  updateCommitState();
}
function updateCommitState() {
  const el = $('commitState');
  if (state.uncommitted) {
    el.textContent = '● フラッシュ未保存';
    el.className = 'commit-state dirty';
    $('commitBtn').classList.add('attention');
  } else {
    el.textContent = '';
    el.className = 'commit-state';
    $('commitBtn').classList.remove('attention');
  }
}

async function commit() {
  await flushAllStaged();
  if (state.demo) {
    state.uncommitted = false;
    updateCommitState();
    setStatus('（デモ）保存しました', 'ok');
    return;
  }
  const r = await sendCommand(CMD.COMMIT);
  if (r.getUint8(2) === ST_OK) {
    state.uncommitted = false;
    updateCommitState();
    setStatus('フラッシュへ保存しました。再起動で反映されます。', 'ok');
  } else {
    setStatus('COMMIT 失敗', 'err');
  }
}
async function reboot() {
  setStatus('再起動を要求しました…');
  try { await sendCommand(CMD.REBOOT); } catch (e) { /* 切断で応答無しは正常 */ }
  device = null;
  state.uncommitted = false;
  updateCommitState();
  showWelcome();
  setStatus('端末が再起動しました。再度「端末に接続」してください。', '');
}
async function resetDefaults() {
  if (!confirm('全ユーザ設定を消去して既定へ戻します。よろしいですか？')) return;
  if (state.demo) { setStatus('（デモ）リセットは実機接続時のみ', 'err'); return; }
  const r = await sendCommand(CMD.RESET);
  if (r.getUint8(2) === ST_OK) {
    setStatus('既定へリセットしました。再起動で反映されます。', 'ok');
    await readAll();
  } else {
    setStatus('RESET 失敗', 'err');
  }
}

// ============================================================ レイヤー・行ヘルパ

function layerList() {
  const masks = [...new Set(model.layers.map((r) => r.key[0]))].sort((a, b) => a - b);
  const modes = [...new Set(model.modes.map((r) => r.key[0]))].sort((a, b) => a - b);
  // カスタムレイヤー: エントリのあるレイヤー ∪ セッション中に追加したレイヤー。
  const customs = hasCap(CAP.CUSTOM_LAYERS)
    ? [...new Set([...model.custom.map((r) => r.key[0]), ...state.addedCustom])].sort((a, b) => a - b)
    : [];
  return [
    ...masks.map((m) => ({ kind: 'mask', val: m, label: maskLabel(m) })),
    ...modes.map((m) => ({ kind: 'mode', val: m, label: modeLabel(m) })),
    ...customs.map((n) => ({ kind: 'custom', val: n, label: customLabel(n) })),
  ];
}
function layerStore(layer) {
  if (layer.kind === 'mask') return { name: 'layers', section: SEC.LAYERS };
  if (layer.kind === 'custom') return { name: 'custom', section: SEC.CUSTOM };
  return { name: 'modes', section: SEC.MODES };
}
function layerRow(layer, sc, create) {
  const { name } = layerStore(layer);
  let row = model[name].find((r) => r.key[0] === layer.val && r.key[1] === sc);
  if (!row && create) {
    // 未定義位置への新規割当。シフト面はかな、編集モード/カスタムはキー操作を既定タグに。
    const empty = layer.kind === 'mask' ? { tag: 0, kana: '' } : { tag: 1, keys: [] };
    row = { key: [layer.val, sc], def: null, init: clone(empty), cur: clone(empty), ovr: false };
    model[name].push(row);
  }
  return row;
}
// EXTRA（直接キー）行の検索/遅延生成。key=[hand,row,col]。
function extraRow(hand, row, col, create) {
  let r = model.extra.find((x) => x.key[0] === hand && x.key[1] === row && x.key[2] === col);
  if (!r && create) {
    r = { key: [hand, row, col], def: null, init: { tag: 1, keys: [] }, cur: { tag: 1, keys: [] }, ovr: false };
    model.extra.push(r);
  }
  return r;
}
// EXTRA 行をドックの編集対象に選択（ホールド/パススルーは capability があるときのみ提示）。
function selectExtra(row) {
  state.sel = {
    name: 'extra', section: SEC.EXTRA, row,
    label: `物理 ${row.key[0] ? '右' : '左'} r${row.key[1]} c${row.key[2]}`,
    kanaOk: false, keysOk: true, deletable: true,
    holdOk: hasCap(CAP.HOLD), passOk: hasCap(CAP.PASSTHROUGH),
  };
  state.editorTab = null;
}

function rowDirty(r) {
  return !valuesEqual(r.cur, r.init);
}
function rowOverridden(r) {
  return r.def ? !valuesEqual(r.cur, r.def) : !isEmptyVal(r.cur);
}

// ============================================================ UI: 全体

function renderApp() {
  document.querySelectorAll('.navbtn').forEach((b) =>
    b.classList.toggle('active', b.dataset.pane === state.pane));
  const root = $('paneRoot');
  root.innerHTML = '';
  if (state.pane === 'keymap') renderKeymapPane(root);
  else if (state.pane === 'combos') renderCombosPane(root);
  else if (state.pane === 'extra') renderExtraPane(root);
  else if (state.pane === 'params') renderParamsPane(root);
  else if (state.pane === 'file') renderFilePane(root);
}

// 値編集後の軽量リフレッシュ（キーキャップの刻印・ダーティ表示のみ更新）。
function refreshAfterEdit() {
  document.querySelectorAll('.keycap[data-rowref]').forEach((cell) => {
    const r = cellRowRefs.get(cell.dataset.rowref);
    if (!r) return;
    const legend = cell.querySelector('.legend');
    if (legend) legend.textContent = valueText(r.cur);
    cell.classList.toggle('overridden', rowOverridden(r));
    cell.classList.toggle('pending', rowDirty(r));
  });
  document.querySelectorAll('[data-comboref]').forEach((el) => {
    const r = cellRowRefs.get(el.dataset.comboref);
    if (!r) return;
    const v = el.querySelector('.combo-val');
    if (v) v.textContent = valueText(r.cur) || '（空）';
    el.classList.toggle('overridden', rowOverridden(r));
  });
}

// 描画中セル → 行オブジェクトの対応（refreshAfterEdit 用）。
const cellRowRefs = new Map();
let rowRefSeq = 0;
function refRow(r) {
  const id = 'r' + (rowRefSeq++);
  cellRowRefs.set(id, r);
  return id;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ============================================================ UI: キーボード描画

// 1キー分のキーキャップ要素を作る（グリッド/絶対座標配置で共用）。
function makeKeycap(hand, row, col, opts) {
  const p = physMap[`${hand},${row},${col}`];
  if (!p) return el('div', 'keycap empty');
  if (!p.sc) {
    // 未使用物理キー（薙刀式 sc なし）= EXTRA（直接キー）の割当対象。
    const cell = el('div', 'keycap unused');
    cell.appendChild(el('div', 'qwerty', `r${row}c${col}`));
    const r = extraRow(hand, row, col, false);
    cell.appendChild(el('div', 'legend', r ? valueText(r.cur) : ''));
    if (r) {
      cell.dataset.rowref = refRow(r);
      if (rowOverridden(r)) cell.classList.add('overridden');
      if (rowDirty(r)) cell.classList.add('pending');
      if (state.sel && state.sel.row === r) cell.classList.add('selected');
    }
    if (opts.onUnused) cell.addEventListener('click', () => opts.onUnused(hand, row, col));
    else cell.classList.add('inert');
    return cell;
  }
  const sc = p.sc;
  const cell = el('div', 'keycap');
  cell.appendChild(el('div', 'qwerty', scLabel(sc)));
  cell.appendChild(el('div', 'legend', opts.legendFor(sc)));
  if (opts.classFor) for (const c of opts.classFor(sc)) cell.classList.add(c);
  if (opts.rowFor) {
    const r = opts.rowFor(sc);
    if (r) cell.dataset.rowref = refRow(r);
  }
  cell.addEventListener('click', () => opts.onClick(sc));
  return cell;
}

// opts: { legendFor(sc), classFor(sc)?, rowFor(sc)?, onClick(sc), onUnused(hand,row,col)? }
// 形状データ（layoutMap, READ_LAYOUT）があれば実機通りの絶対座標で描画（#05 §2 Tier 2）。
// なければグリッド描画: 行・列範囲は physMap（実機データ）から動的に決定する（Tier 0）。
// sc=0 の未使用物理キーは破線で描画し、onUnused があればクリックで EXTRA 割当へ（Tier 1）。
function renderKeyboard(opts) {
  cellRowRefs.clear();
  rowRefSeq = 0;
  const wrap = el('div', 'kb');
  const useLayout = Object.keys(layoutMap).length > 0;
  const rowSet = new Set();
  const colSets = [new Set(), new Set()];
  for (const k of Object.keys(physMap)) {
    const [h, r, c] = k.split(',').map(Number);
    rowSet.add(r);
    if (colSets[h]) colSets[h].add(c);
  }
  const rows = [...rowSet].sort((a, b) => a - b);
  for (const hand of [0, 1]) {
    if (useLayout) {
      // 絶対座標配置。U = 16px / 0.25u（1u = 64px、グリッド時のキー幅と同一）。
      const U = 16;
      const half = el('div', 'kbhalf-abs');
      let maxX = 0;
      let maxY = 0;
      const noCoord = []; // 形状未記載キーのフォールバック（最下段へグリッド配置）
      const keys = Object.keys(physMap).filter((k) => +k.split(',')[0] === hand);
      for (const k of keys) {
        const [, r, c] = k.split(',').map(Number);
        const cell = makeKeycap(hand, r, c, opts);
        const lo = layoutMap[k];
        if (!lo) {
          noCoord.push(cell);
          continue;
        }
        cell.classList.add('abs');
        cell.style.left = lo.x * U + 'px';
        cell.style.top = lo.y * U + 'px';
        cell.style.width = lo.w * U - 6 + 'px';
        cell.style.height = lo.h * U - 8 + 'px';
        if (lo.rot) cell.style.transform = `rotate(${lo.rot}deg)`;
        maxX = Math.max(maxX, (lo.x + lo.w) * U);
        maxY = Math.max(maxY, (lo.y + lo.h) * U);
        half.appendChild(cell);
      }
      noCoord.forEach((cell, i) => {
        cell.classList.add('abs');
        cell.style.left = i * 4 * U + 'px';
        cell.style.top = maxY + 8 + 'px';
        cell.style.width = 4 * U - 6 + 'px';
        cell.style.height = 4 * U - 8 + 'px';
        half.appendChild(cell);
      });
      if (noCoord.length) {
        maxY += 8 + 4 * U;
        maxX = Math.max(maxX, noCoord.length * 4 * U);
      }
      half.style.width = maxX + 'px';
      half.style.height = maxY + 'px';
      wrap.appendChild(half);
      continue;
    }
    const half = el('div', 'kbhalf');
    const cols = [...colSets[hand]].sort((a, b) => a - b);
    const colOrder = hand === 0 ? cols : [...cols].reverse();
    for (const row of rows) {
      const rowdiv = el('div', 'kbrow');
      for (const col of colOrder) {
        rowdiv.appendChild(makeKeycap(hand, row, col, opts));
      }
      half.appendChild(rowdiv);
    }
    wrap.appendChild(half);
  }
  return wrap;
}

// ============================================================ UI: キーマップペイン

function renderKeymapPane(root) {
  const layers = layerList();
  if (!layers.some((l) => state.layer && l.kind === state.layer.kind && l.val === state.layer.val)) {
    state.layer = layers[0] || null;
  }

  // レイヤーバー
  const bar = el('div', 'layerbar');
  for (const l of layers) {
    const b = el('button', 'layerbtn', l.label);
    if (state.layer && l.kind === state.layer.kind && l.val === state.layer.val) b.classList.add('active');
    b.addEventListener('click', () => {
      state.layer = l;
      state.sel = null;
      state.editorTab = null;
      renderApp();
    });
    bar.appendChild(b);
  }
  // カスタムレイヤー追加（capability CUSTOM_LAYERS のある FW のみ）。
  if (hasCap(CAP.CUSTOM_LAYERS)) {
    const used = new Set(layers.filter((l) => l.kind === 'custom').map((l) => l.val));
    const max = info.maxCustomLayers || 8;
    let next = -1;
    for (let n = 0; n < max; n++) if (!used.has(n)) { next = n; break; }
    if (next >= 0) {
      const add = el('button', 'layerbtn', '＋ レイヤー追加');
      add.title = `カスタムレイヤー（QWERTY 透過）を追加（最大 ${max}）`;
      add.addEventListener('click', () => {
        state.addedCustom.push(next);
        state.layer = { kind: 'custom', val: next, label: customLabel(next) };
        state.sel = null;
        state.editorTab = null;
        renderApp();
      });
      bar.appendChild(add);
    }
  }
  root.appendChild(bar);

  // キーボード
  const layer = state.layer;
  if (!layer) {
    root.appendChild(el('p', 'note', 'レイヤーがありません。'));
    return;
  }
  const kb = renderKeyboard({
    legendFor: (sc) => {
      const r = layerRow(layer, sc, false);
      // カスタムレイヤーの未割当キーは QWERTY へ透過（▽ で表示）。
      if (layer.kind === 'custom') return r && !isEmptyVal(r.cur) ? valueText(r.cur) : '▽';
      return r ? valueText(r.cur) : '';
    },
    rowFor: (sc) => layerRow(layer, sc, false),
    classFor: (sc) => {
      const cls = [];
      const r = layerRow(layer, sc, false);
      if (layer.kind === 'custom' && (!r || isEmptyVal(r.cur))) cls.push('trns');
      if (r && rowOverridden(r)) cls.push('overridden');
      if (r && rowDirty(r)) cls.push('pending');
      if (state.sel && state.sel.row === r && r) cls.push('selected');
      return cls;
    },
    onClick: (sc) => {
      const row = layerRow(layer, sc, true);
      const { name, section } = layerStore(layer);
      state.sel = {
        name, section, row,
        label: `${scLabel(sc)} ・ ${layer.label}`,
        kanaOk: layer.kind === 'mask',
        keysOk: true,
        deletable: layer.kind === 'custom',
        holdOk: layer.kind === 'custom' && hasCap(CAP.HOLD),
        passOk: layer.kind === 'custom' && hasCap(CAP.PASSTHROUGH),
      };
      state.editorTab = null;
      renderApp();
    },
    // 未使用物理キー → クリックで EXTRA（直接キー）をその場で割当（#05 §2 Tier 1）。
    onUnused: (hand, row, col) => {
      selectExtra(extraRow(hand, row, col, true));
      renderApp();
    },
  });
  root.appendChild(kb);

  const legendNote = el('p', 'kbnote');
  legendNote.innerHTML = 'キーをクリックして下のパレットから割当。<span class="dot ovr"></span> 既定から変更済 ・ <span class="dot pend"></span> 送信待ち' +
    (Object.values(physMap).some((p) => !p.sc) ? ' ・ 破線 = 未使用物理キー（クリックで直接キーを割当）' : '');
  root.appendChild(legendNote);

  if (layer.kind === 'custom') {
    root.appendChild(el('p', 'note',
      'カスタムレイヤーでは未割当キー（▽）が素の QWERTY へ透過します（エントリ 0 件のレイヤー = 素の QWERTY）。' +
      `レイヤーの有効化は MO/TG キー（${customLabel(layer.val)} 押下中/切替）を「直接キー」か他レイヤーのキーに割り当ててください。`));
  }

  root.appendChild(renderDock());
}

// ============================================================ UI: 値エディタドック（VIAの下部パレット相当）

function renderDock() {
  const dock = el('div', 'dock');
  const sel = state.sel;
  if (!sel) {
    dock.appendChild(el('div', 'dock-hint', 'キーを選択してください'));
    return dock;
  }
  const row = sel.row;

  // 左: 選択情報・操作
  const side = el('div', 'dock-side');
  side.appendChild(el('div', 'dock-key', sel.label));
  const curVal = el('div', 'dock-cur');
  const renderCur = () => { curVal.textContent = valueText(row.cur) || '（空）'; };
  renderCur();
  side.appendChild(curVal);
  if (row.def) {
    side.appendChild(el('div', 'dock-def', '既定: ' + (valueText(row.def) || '（空）')));
    const btn = el('button', 'small', '既定に戻す');
    btn.addEventListener('click', () => {
      row.cur = clone(row.def);
      stageRow(sel.name, sel.section, row, 0);
      renderApp();
    });
    side.appendChild(btn);
  }
  const clearBtn = el('button', 'small', sel.deletable ? '削除' : 'クリア');
  clearBtn.addEventListener('click', () => {
    row.cur = row.cur.tag === TAG_KANA ? { tag: 0, kana: '' } : { tag: 1, keys: [] };
    stageRow(sel.name, sel.section, row, 0);
    if (sel.deletable && !row.ovr && !rowDirty(row)) {
      model[sel.name] = model[sel.name].filter((x) => x !== row);
      state.sel = null;
    }
    renderApp();
  });
  side.appendChild(clearBtn);
  dock.appendChild(side);

  // 右: タブ付きパレット
  const main = el('div', 'dock-main');
  const tabs = el('div', 'dock-tabs');
  const body = el('div', 'dock-body');
  let tab = state.editorTab || (row.cur.tag === TAG_KANA ? 'kana' : 'keys');
  if (!sel.kanaOk) tab = 'keys';

  const tabDefs = [];
  if (sel.kanaOk) tabDefs.push(['kana', 'かな']);
  if (sel.keysOk !== false) tabDefs.push(['keys', 'キー操作']);
  for (const [id, label] of tabDefs) {
    const b = el('button', 'dock-tab' + (tab === id ? ' active' : ''), label);
    b.addEventListener('click', () => {
      state.editorTab = id;
      renderApp();
    });
    tabs.appendChild(b);
  }
  main.appendChild(tabs);

  if (tab === 'kana') renderKanaEditor(body, sel, renderCur);
  else renderKeysEditor(body, sel, renderCur);
  main.appendChild(body);
  dock.appendChild(main);
  return dock;
}

function renderKanaEditor(body, sel, renderCur) {
  const row = sel.row;
  const line = el('div', 'kana-line');
  const input = el('input', 'kana-input');
  input.type = 'text';
  input.spellcheck = false;
  input.placeholder = 'かなを入力';
  input.value = row.cur.tag === TAG_KANA ? row.cur.kana : '';
  const apply = () => {
    row.cur = { tag: TAG_KANA, kana: input.value };
    renderCur();
    stageRow(sel.name, sel.section, row);
  };
  input.addEventListener('input', apply);
  line.appendChild(input);
  const bs = el('button', 'small', '⌫');
  bs.title = '1文字削除';
  bs.addEventListener('click', () => { input.value = [...input.value].slice(0, -1).join(''); apply(); });
  line.appendChild(bs);
  if (info && info.maxKanaLen) line.appendChild(el('span', 'kana-limit', `最大 ${info.maxKanaLen} バイト`));
  body.appendChild(line);

  for (const [gname, chars] of KANA_GROUPS) {
    const g = el('div', 'palgroup');
    g.appendChild(el('div', 'palgroup-name', gname));
    const grid = el('div', 'palgrid kanagrid');
    for (const ch of chars.replace(/\s+/g, '')) {
      if (ch === '　') { grid.appendChild(el('span', 'palspacer')); continue; }
      const b = el('button', 'palkey', ch);
      b.addEventListener('click', () => {
        input.value += ch;
        apply();
      });
      grid.appendChild(b);
    }
    g.appendChild(grid);
    body.appendChild(g);
  }
}

function renderKeysEditor(body, sel, renderCur) {
  const row = sel.row;
  const holdMode = () => row.cur.tag === TAG_HOLD;

  // 動作切替（タップ列 / ホールド）。EXTRA かつ FW が TAG_HOLD 対応のときのみ。
  if (sel.holdOk) {
    const typebar = el('div', 'modbar');
    typebar.appendChild(el('span', 'chips-label', '動作:'));
    const mkType = (lbl, isHold) => {
      const b = el('button', 'modtgl' + ((holdMode() === isHold) ? ' on' : ''), lbl);
      b.addEventListener('click', () => {
        if (holdMode() === isHold) return;
        if (isHold) {
          // 既存のタップ列の先頭キーを引き継ぐ（なければ空 = 未送信のまま）。
          const first = row.cur.tag === TAG_KEYS && row.cur.keys.length ? row.cur.keys[0] : [0, 0];
          row.cur = { tag: TAG_HOLD, hold: [first[0], first[1]] };
        } else {
          row.cur = { tag: TAG_KEYS, keys: isEmptyVal(row.cur) ? [] : [row.cur.hold.slice()] };
        }
        stageRow(sel.name, sel.section, row);
        renderApp();
      });
      return b;
    };
    typebar.appendChild(mkType('タップ列', false));
    typebar.appendChild(mkType('ホールド', true));
    typebar.appendChild(el('span', 'modhint',
      holdMode() ? '物理キーを押している間、選んだ 1 キーを押しっぱなしにします（修飾キー向け）'
                 : '押下時にストローク列を一回送出します'));
    body.appendChild(typebar);
  }

  // 現在のストローク列（チップ）。タブを開いただけでは値を変換しない（キー追加時に変換）。
  const chips = el('div', 'chips');
  const curKeys = () => (row.cur.tag === TAG_KEYS ? row.cur.keys : []);
  const rerenderChips = () => {
    chips.innerHTML = '';
    chips.appendChild(el('span', 'chips-label', holdMode() ? '保持キー:' : '割当列:'));
    if (holdMode()) {
      if (isEmptyVal(row.cur)) chips.appendChild(el('span', 'chips-empty', '（なし。下のパレットから1キー選択）'));
      else chips.appendChild(el('span', 'chip', symName(row.cur.hold[0], row.cur.hold[1])));
      return;
    }
    if (!curKeys().length) chips.appendChild(el('span', 'chips-empty', '（なし）'));
    curKeys().forEach(([u, m], idx) => {
      const chip = el('span', 'chip', symName(u, m));
      const x = el('button', 'chipx', '×');
      x.addEventListener('click', () => {
        if (row.cur.tag !== TAG_KEYS) return;
        row.cur.keys.splice(idx, 1);
        rerenderChips();
        renderCur();
        stageRow(sel.name, sel.section, row);
        refreshAfterEdit();
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
  };
  rerenderChips();
  body.appendChild(chips);

  // 修飾トグル
  const modbar = el('div', 'modbar');
  modbar.appendChild(el('span', 'chips-label', '修飾:'));
  const modState = { v: 0 };
  for (const [lbl, bit] of MOD_DEFS) {
    const b = el('button', 'modtgl', lbl);
    b.addEventListener('click', () => {
      modState.v ^= bit;
      b.classList.toggle('on', !!(modState.v & bit));
    });
    modbar.appendChild(b);
  }
  modbar.appendChild(el('span', 'modhint', 'クリックしたキーに付与してストロークを追加'));
  body.appendChild(modbar);

  // キー操作パレット
  const groups = [
    ['編集・移動', SYMBOLS.filter((s) => s[1] < 0xf0 && (s[2] !== 0 || ['LANG1', 'LANG2', 'Enter', 'Esc', 'BS', 'Tab', 'Space', 'Del', 'Home', 'End', 'Right', 'Left', 'Down', 'Up', 'Comma', 'Period'].includes(s[0])))],
    ['ファンクション・特殊', SYMBOLS.filter((s) => s[2] === 0 && /^F\d|PageUp|PageDown|Insert|Win|App|CapsLock/.test(s[0]))],
    ['文字', [...LETTERS, ...DIGITS]],
    ['修飾キー単体', MODKEYS],
  ];
  if (sel.passOk) {
    // レイヤー活性化キー（擬似 usage の単独ペアで置換）。MO(n)=押下中 / TG(n)=切替。
    // カスタムレイヤー対応 FW では全レイヤー分、なければ QWERTY（layer 0）のみ。
    const maxL = hasCap(CAP.CUSTOM_LAYERS) ? (info.maxCustomLayers || 8) : 1;
    const ops = [];
    for (let n = 0; n < maxL; n++) ops.push([symName(PSEUDO_MO_BASE | n, 0), PSEUDO_MO_BASE | n, 0]);
    for (let n = 0; n < maxL; n++) ops.push([symName(PSEUDO_TG_BASE | n, 0), PSEUDO_TG_BASE | n, 0]);
    groups.push(['レイヤー操作', ops]);
  }
  for (const [gname, keys] of groups) {
    const g = el('div', 'palgroup');
    g.appendChild(el('div', 'palgroup-name', gname));
    const grid = el('div', 'palgrid');
    for (const [n, u, bm] of keys) {
      const b = el('button', 'palkey', n);
      b.addEventListener('click', () => {
        if (isPseudo(u)) {
          // 擬似 usage は単独でのみ有効（FW は単独ペアのみ解釈）。
          row.cur = { tag: TAG_KEYS, keys: [[u, 0]] };
        } else if (holdMode()) {
          row.cur = { tag: TAG_HOLD, hold: [u, bm | modState.v] };
        } else {
          row.cur = { tag: TAG_KEYS, keys: [...curKeys(), [u, bm | modState.v]] };
        }
        rerenderChips();
        renderCur();
        stageRow(sel.name, sel.section, row);
        refreshAfterEdit();
      });
      grid.appendChild(b);
    }
    g.appendChild(grid);
    body.appendChild(g);
  }
  if (sel.passOk) {
    body.appendChild(el('p', 'note',
      'レイヤー操作キーは薙刀式エンジンをバイパスする QWERTY/カスタムレイヤーを有効化します' +
      '（押下中=ホールドの間だけ、切替=押すたびトグル）。IME 自動切替はパラメータ画面で設定できます。'));
  }
}

// ============================================================ UI: コンボペイン

function renderCombosPane(root) {
  root.appendChild(el('p', 'note', 'キーボード上で 2〜3 キーをクリックして選択すると、そのコンボを編集・新規作成できます。'));

  const chord = state.chord;
  const kb = renderKeyboard({
    legendFor: (sc) => {
      const r = layerRow({ kind: 'mask', val: 0 }, sc, false);
      return r ? valueText(r.cur) : '';
    },
    classFor: (sc) => (chord.includes(sc) ? ['selected'] : []),
    onClick: (sc) => {
      if (chord.includes(sc)) state.chord = chord.filter((x) => x !== sc);
      else if (chord.length < 3) state.chord = [...chord, sc].sort((a, b) => a - b);
      else state.chord = [sc];
      syncChordSelection();
      renderApp();
    },
  });
  root.appendChild(kb);

  // 選択中チョードの編集エリア
  if (chord.length >= 2) {
    const name = chord.length === 2 ? 'combo2' : 'combo3';
    const section = chord.length === 2 ? SEC.COMBO2 : SEC.COMBO3;
    const existing = model[name].find((r) => keyId(r.key) === keyId(chord));
    if (!existing) {
      const make = el('div', 'combo-new');
      make.appendChild(el('span', '', chord.map(scLabel).join(' + ') + ' は未定義です。'));
      const btn = el('button', 'primary', 'このコンボを作成');
      btn.addEventListener('click', () => {
        const row = { key: [...chord], def: null, init: { tag: 0, kana: '' }, cur: { tag: 0, kana: '' }, ovr: false };
        model[name].push(row);
        selectCombo(name, section, row);
        renderApp();
      });
      make.appendChild(btn);
      root.appendChild(make);
    }
  } else {
    root.appendChild(el('p', 'kbnote', `選択中: ${chord.length ? chord.map(scLabel).join(' + ') : 'なし'}（2〜3キー選ぶと編集できます）`));
  }

  root.appendChild(renderDock());

  // コンボ一覧
  for (const [name, section, title] of [['combo2', SEC.COMBO2, '2キーコンボ'], ['combo3', SEC.COMBO3, '3キーコンボ']]) {
    const card = el('div', 'card');
    card.appendChild(el('h3', '', title));
    const list = el('div', 'combolist');
    const rows = [...model[name]].sort((a, b) => keyId(a.key).localeCompare(keyId(b.key)));
    for (const r of rows) {
      if (!r.def && isEmptyVal(r.cur) && !rowDirty(r) && state.sel?.row !== r) continue;
      const item = el('button', 'comboitem');
      item.dataset.comboref = refRow(r);
      if (rowOverridden(r)) item.classList.add('overridden');
      if (state.sel && state.sel.row === r) item.classList.add('selected');
      const keys = el('span', 'combo-keys');
      for (const sc of r.key) keys.appendChild(el('kbd', '', scLabel(sc)));
      item.appendChild(keys);
      item.appendChild(el('span', 'combo-arrow', '→'));
      item.appendChild(el('span', 'combo-val', valueText(r.cur) || '（空）'));
      item.addEventListener('click', () => {
        state.chord = [...r.key];
        selectCombo(name, section, r);
        renderApp();
      });
      list.appendChild(item);
    }
    if (!list.children.length) list.appendChild(el('p', 'note', 'なし'));
    card.appendChild(list);
    root.appendChild(card);
  }
}

function selectCombo(name, section, row) {
  state.sel = {
    name, section, row,
    label: row.key.map(scLabel).join(' + '),
    kanaOk: true,
    keysOk: true,
    deletable: !row.def,
  };
  state.editorTab = null;
}

function syncChordSelection() {
  const chord = state.chord;
  state.sel = null;
  if (chord.length >= 2) {
    const name = chord.length === 2 ? 'combo2' : 'combo3';
    const section = chord.length === 2 ? SEC.COMBO2 : SEC.COMBO3;
    const row = model[name].find((r) => keyId(r.key) === keyId(chord));
    if (row) selectCombo(name, section, row);
  }
}

// ============================================================ UI: 直接キーペイン

function renderExtraPane(root) {
  root.appendChild(el('p', 'note',
    '薙刀式で使っていない物理キーに、直接キー（F1-12 / Del / 矢印 / Win 等）やストローク列を割り当てます。' +
    (hasCap(CAP.MATRIX_FULL) && Object.values(physMap).some((p) => !p.sc)
      ? 'キーマップ画面の破線キーをクリックして直接割り当てるか、「キーを学習」で位置を取り込みます。'
      : '「キーを学習」を押してから端末上で対象キーを押すと位置を取り込みます。')));

  const bar = el('div', 'bar');
  const learnBtn = el('button', 'primary', '＋ キーを学習');
  const learnStatus = el('span', 'status');
  learnBtn.addEventListener('click', () => {
    learnKey(learnStatus, learnBtn).catch((e) => { learnStatus.textContent = e.message; learnStatus.className = 'status err'; });
  });
  bar.appendChild(learnBtn);
  bar.appendChild(learnStatus);
  root.appendChild(bar);

  const card = el('div', 'card');
  card.appendChild(el('h3', '', '割当済みの直接キー'));
  const list = el('div', 'combolist');
  for (const r of model.extra) {
    // 破線キークリックで生成されただけの空行は一覧に出さない（送信もされない）。
    if (!r.ovr && isEmptyVal(r.cur) && !rowDirty(r) && state.sel?.row !== r) continue;
    const item = el('button', 'comboitem');
    item.dataset.comboref = refRow(r);
    if (state.sel && state.sel.row === r) item.classList.add('selected');
    const keys = el('span', 'combo-keys');
    keys.appendChild(el('kbd', '', `${r.key[0] ? '右' : '左'} r${r.key[1]} c${r.key[2]}`));
    item.appendChild(keys);
    item.appendChild(el('span', 'combo-arrow', '→'));
    item.appendChild(el('span', 'combo-val', valueText(r.cur) || '（空）'));
    item.addEventListener('click', () => {
      selectExtra(r);
      renderApp();
    });
    list.appendChild(item);
  }
  if (!list.children.length) list.appendChild(el('p', 'note', 'まだありません。'));
  card.appendChild(list);
  root.appendChild(card);

  root.appendChild(renderDock());
}

async function learnKey(statusEl, btn) {
  if (state.demo || !device) {
    statusEl.textContent = 'キー学習は実機接続時のみ使えます。';
    statusEl.className = 'status err';
    return;
  }
  btn.disabled = true;
  try {
    await sendCommand(CMD.READ_LASTKEY); // 直近の押下を drain（誤検出防止）
    statusEl.textContent = '端末で割り当てたい物理キーを押してください…';
    statusEl.className = 'status';
    for (let i = 0; i < 100; i++) {
      const d = await sendCommand(CMD.READ_LASTKEY);
      if (d.getUint8(6)) {
        const hand = d.getUint8(3), row = d.getUint8(4), col = d.getUint8(5);
        if (matrixMap[`${hand},${row},${col}`] !== undefined) {
          statusEl.textContent = 'それは薙刀式キーです。未割当の物理キーを押してください。';
          statusEl.className = 'status err';
        } else if (model.extra.some((r) => r.key[0] === hand && r.key[1] === row && r.key[2] === col)) {
          statusEl.textContent = 'その位置は既に登録済みです。';
          statusEl.className = 'status err';
        } else {
          // 学習で見つけた位置が READ_MATRIX_FULL に未収載なら描画にも反映しておく。
          if (!physMap[`${hand},${row},${col}`]) physMap[`${hand},${row},${col}`] = { sc: 0, flags: 0 };
          selectExtra(extraRow(hand, row, col, true));
          renderApp();
          setStatus(`学習: 物理 ${hand ? '右' : '左'} r${row} c${col} を追加。キーを割り当ててください。`, 'ok');
        }
        return;
      }
      await sleep(100);
    }
    statusEl.textContent = '学習タイムアウト（キー入力がありませんでした）。';
    statusEl.className = 'status err';
  } finally {
    btn.disabled = false;
  }
}

// ============================================================ UI: パラメータペイン

function renderParamsPane(root) {
  const card = el('div', 'card');
  card.appendChild(el('h3', '', 'タイミング・LED'));
  for (const f of PARAM_FIELDS) {
    const rowEl = el('div', 'paramrow');
    const head = el('div', 'paramhead');
    head.appendChild(el('span', 'paramlabel', f.label + (f.unit ? ` [${f.unit}]` : '')));
    const num = el('input', 'paramnum');
    num.type = 'number';
    num.min = f.min; num.max = f.max;
    num.value = params[f.key];
    head.appendChild(num);
    rowEl.appendChild(head);
    const slider = el('input', 'paramslider');
    slider.type = 'range';
    slider.min = f.min; slider.max = f.max;
    slider.value = params[f.key];
    const setVal = (v) => {
      v = Math.max(f.min, Math.min(f.max, isNaN(v) ? params[f.key] : v));
      params[f.key] = v;
      num.value = v;
      slider.value = v;
      stageParams();
    };
    slider.addEventListener('input', () => setVal(parseInt(slider.value, 10)));
    num.addEventListener('change', () => setVal(parseInt(num.value, 10)));
    rowEl.appendChild(slider);
    rowEl.appendChild(el('p', 'paramdesc', f.desc));
    card.appendChild(rowEl);
  }
  root.appendChild(card);

  // パススルーモード設定（capability があるFWのみ）。
  if (hasCap(CAP.PASSTHROUGH)) {
    const card2 = el('div', 'card');
    card2.appendChild(el('h3', '', 'パススルーモード（QWERTY）'));
    const rowEl = el('div', 'paramrow');
    const head = el('div', 'paramhead');
    const lbl = el('label', 'paramlabel');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!(params.flags & PFLAG_PASS_IME);
    cb.addEventListener('change', () => {
      params.flags = (params.flags & ~PFLAG_PASS_IME) | (cb.checked ? PFLAG_PASS_IME : 0);
      stageParams();
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' IME を自動切替する'));
    head.appendChild(lbl);
    rowEl.appendChild(head);
    rowEl.appendChild(el('p', 'paramdesc',
      'パススルー有効化時に英数（LANG2）、解除時にかな（LANG1）を自動送出します。' +
      '活性化キーは「直接キー」で QWERTY(押下中) / QWERTY(切替) を割り当ててください。'));
    card2.appendChild(rowEl);
    root.appendChild(card2);
  }
}

// ============================================================ UI: 保存/読込ペイン

function renderFilePane(root) {
  const c1 = el('div', 'card');
  c1.appendChild(el('h3', '', '端末への保存'));
  c1.appendChild(el('p', 'note', '編集内容は即座に端末RAMへ送られますが、電源を切ると消えます。「保存 (COMMIT)」でフラッシュへ書き込み、再起動後に反映されます。'));
  const a1 = el('div', 'actions');
  const cb = el('button', 'primary', '保存 (COMMIT)');
  cb.addEventListener('click', () => commit().catch((e) => setStatus(e.message, 'err')));
  const rb = el('button', '', '再起動して反映');
  rb.disabled = state.demo;
  rb.addEventListener('click', () => reboot().catch((e) => setStatus(e.message, 'err')));
  a1.appendChild(cb);
  a1.appendChild(rb);
  c1.appendChild(a1);
  root.appendChild(c1);

  const c2 = el('div', 'card');
  c2.appendChild(el('h3', '', '設定ファイル (JSON)'));
  c2.appendChild(el('p', 'note', '既定からの変更分とパラメータをファイルへ書き出し・読み込みできます。バックアップや他端末への移行に。'));
  const a2 = el('div', 'actions');
  const exBtn = el('button', '', '書き出し');
  exBtn.addEventListener('click', exportJson);
  const imBtn = el('button', '', '読み込み');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.style.display = 'none';
  file.addEventListener('change', () => {
    if (file.files[0]) importJson(file.files[0]).catch((e) => setStatus('読み込み失敗: ' + e.message, 'err'));
    file.value = '';
  });
  imBtn.addEventListener('click', () => file.click());
  a2.appendChild(exBtn);
  a2.appendChild(imBtn);
  a2.appendChild(file);
  c2.appendChild(a2);
  root.appendChild(c2);

  const c3 = el('div', 'card danger-card');
  c3.appendChild(el('h3', '', '初期化'));
  c3.appendChild(el('p', 'note', '端末の全ユーザ設定を消去して既定へ戻します。'));
  const a3 = el('div', 'actions');
  const rs = el('button', 'danger', 'RESET（既定へ戻す）');
  rs.addEventListener('click', () => resetDefaults().catch((e) => setStatus(e.message, 'err')));
  a3.appendChild(rs);
  c3.appendChild(a3);
  root.appendChild(c3);

  const foot = el('p', 'finehint');
  foot.textContent = 'VID/PID 0xc0de:0xcafe / vendor HID usagePage 0xFF00 / proto v2。設定は USB に挿した（マスタ）半身のフラッシュに保存されます。';
  root.appendChild(foot);
}

function serializeValue(v) {
  if (v.tag === TAG_KANA) return { kana: v.kana };
  if (v.tag === TAG_HOLD) return { hold: v.hold.slice() };
  return { keys: v.keys.map((p) => p.slice()) };
}
function deserializeValue(o) {
  if (o && typeof o.kana === 'string') return { tag: TAG_KANA, kana: o.kana };
  if (o && Array.isArray(o.hold)) return { tag: TAG_HOLD, hold: [o.hold[0] | 0, o.hold[1] | 0] };
  if (o && Array.isArray(o.keys)) return { tag: TAG_KEYS, keys: o.keys.map((p) => [p[0] | 0, p[1] | 0]) };
  return null;
}

function exportJson() {
  const out = { app: 'naginata-config', version: 2, params: { ...params } };
  for (const name of ['layers', 'combo2', 'combo3', 'modes', 'extra', 'custom']) {
    out[name] = model[name]
      .filter((r) => rowOverridden(r))
      .map((r) => ({ key: r.key.slice(), value: serializeValue(r.cur) }));
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'naginata-config.json';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('設定を書き出しました', 'ok');
}

async function importJson(fileObj) {
  const data = JSON.parse(await fileObj.text());
  if (data.app !== 'naginata-config') throw new Error('このツールの設定ファイルではありません');
  if (data.params) {
    for (const f of PARAM_FIELDS) {
      if (typeof data.params[f.key] === 'number') {
        params[f.key] = Math.max(f.min, Math.min(f.max, data.params[f.key]));
      }
    }
    if (typeof data.params.flags === 'number') params.flags = data.params.flags & 0xff;
    stageParams();
  }
  let applied = 0;
  for (const name of ['layers', 'combo2', 'combo3', 'modes', 'extra', 'custom']) {
    if (!Array.isArray(data[name])) continue;
    for (const e of data[name]) {
      const v = deserializeValue(e.value);
      if (!v || !Array.isArray(e.key)) continue;
      let row = model[name].find((r) => keyId(r.key) === keyId(e.key));
      if (!row) {
        const empty = v.tag === TAG_KANA ? { tag: 0, kana: '' } : { tag: 1, keys: [] };
        row = { key: e.key.map((x) => x | 0), def: null, init: clone(empty), cur: clone(empty), ovr: false };
        model[name].push(row);
      }
      row.cur = clone(v);
      if (rowDirty(row)) applied++;
    }
  }
  await flushAllStaged();
  state.sel = null;
  renderApp();
  setStatus(`設定ファイルを読み込みました（${applied}件 変更 → 端末へ送信済・未保存）`, 'ok');
}

// ============================================================ デモモード

function loadDemo() {
  state.demo = true;
  device = null;
  info = {
    protoVer: 2, fwMajor: 0, fwMinor: 0, maxKeys: 6, maxKanaLen: 12,
    caps: CAP.MATRIX_FULL | CAP.LAYOUT | CAP.HOLD | CAP.PASSTHROUGH | CAP.CUSTOM_LAYERS, // 新機能のUI確認用
    maxCustomLayers: 8,
  };
  params = { window_ms: 60, tap_ms: 10, repeat_delay_ms: 250, repeat_interval_ms: 30, led_brightness: 128, flags: 0 };

  matrixMap = {};
  const L = [['Q', 'W', 'E', 'R', 'T'], ['A', 'S', 'D', 'F', 'G'], ['Z', 'X', 'C', 'V', 'B']];
  const R = [['Y', 'U', 'I', 'O', 'P'], ['H', 'J', 'K', 'L', ';'], ['N', 'M', ',', '.', '/']];
  const lbl2sc = Object.fromEntries(Object.entries(SC_LABEL).map(([k, v]) => [v, +k]));
  L.forEach((rw, ri) => rw.forEach((lb, ci) => { matrixMap[`0,${ri + 1},${ci + 1}`] = lbl2sc[lb]; }));
  R.forEach((rw, ri) => rw.forEach((lb, ci) => { matrixMap[`1,${ri + 1},${5 - ci}`] = lbl2sc[lb]; }));
  matrixMap['0,4,5'] = lbl2sc['Space'];

  // READ_MATRIX_FULL 相当: 薙刀式キー＋未使用物理キー（破線・クリック割当のデモ）。
  physMap = {};
  for (const [k, sc] of Object.entries(matrixMap)) physMap[k] = { sc, flags: 1 };
  for (const k of ['0,0,1', '0,0,3', '0,4,4', '1,0,3', '1,0,5', '1,4,4', '1,4,5']) {
    physMap[k] = { sc: 0, flags: 0 };
  }

  // READ_LAYOUT 相当: カラムスタッガー＋親指キー回転（形状描画のデモ。0.25u 単位）。
  layoutMap = {};
  const stag = { 1: 3, 2: 1, 3: 0, 4: 1, 5: 2 }; // 列ごとの縦オフセット（0.25u）
  for (const k of Object.keys(physMap)) {
    const [h, r, c] = k.split(',').map(Number);
    const x = (h === 0 ? c - 1 : 5 - c) * 4;
    if (r === 4) {
      layoutMap[k] = { x: x + (h === 0 ? 2 : -2), y: 15, w: 5, h: 4, rot: h === 0 ? 12 : -12 };
    } else {
      layoutMap[k] = { x, y: r * 4 + (stag[c] ?? 0), w: 4, h: 4, rot: 0 };
    }
  }

  // デモ用サンプル配列（実機の既定とは異なります）。
  const kanaRows = (mask, defs) => Object.entries(defs).map(([lb, kana]) => ({
    key: [mask, lbl2sc[lb]], value: { tag: 0, kana },
  }));
  const keyRows = (mask, defs) => Object.entries(defs).map(([lb, names]) => ({
    key: [mask, lbl2sc[lb]],
    value: { tag: 1, keys: names.map((n) => { const s = SYMBOLS.find((x) => x[0] === n); return [s[1], s[2]]; }) },
  }));
  const layerDefs = [
    ...kanaRows(0x00, { W: 'き', E: 'て', R: 'し', U: 'と', I: 'か', O: 'っ', A: 'ろ', S: 'に', D: 'な', G: 'さ', H: 'く', K: 'い', L: 'う', Z: 'ほ', X: 'ひ', C: 'は', B: 'め', N: 'む', ',': 'ね', '.': '。', '/': '・' }),
    ...keyRows(0x00, { T: ['Left'], Y: ['Right'], Space: ['Space'] }),
    ...kanaRows(0x01, { W: 'ぎ', E: 'で', R: 'じ', U: 'ど', I: 'が', K: 'ぃ', L: 'ぅ' }),
    ...kanaRows(0x02, { W: 'ぎ', E: 'で', R: 'じ', C: 'ば' }),
    ...kanaRows(0x04, { U: 'ど', I: 'が', N: 'ぶ' }),
    ...kanaRows(0x08, { C: 'ぱ' }),
    ...kanaRows(0x10, { N: 'ぷ' }),
    ...kanaRows(0x20, { K: 'ぃ', O: 'ょ' }),
  ];
  model.layers = mergeSection(layerDefs, []);
  model.combo2 = mergeSection([
    { key: [lbl2sc['D'], lbl2sc['F']].sort((a, b) => a - b), value: { tag: 0, kana: 'ん' } },
    { key: [lbl2sc['J'], lbl2sc['K']].sort((a, b) => a - b), value: { tag: 0, kana: 'っ' } },
  ], []);
  model.combo3 = mergeSection([
    { key: [lbl2sc['J'], lbl2sc['K'], lbl2sc['L']].sort((a, b) => a - b), value: { tag: 0, kana: 'でも' } },
  ], []);
  const modeKeys = (m, defs) => Object.entries(defs).map(([lb, names]) => ({
    key: [m, lbl2sc[lb]],
    value: { tag: 1, keys: names.map((n) => { const s = SYMBOLS.find((x) => x[0] === n); return [s[1], s[2]]; }) },
  }));
  model.modes = mergeSection([
    ...modeKeys(1, { H: ['Left'], J: ['Down'], K: ['Up'], L: ['Right'], Y: ['Home'], O: ['End'], U: ['C-x'], I: ['C-c'], P: ['C-v'] }),
    ...modeKeys(2, { H: ['S-Left'], J: ['S-Down'], K: ['S-Up'], L: ['S-Right'], U: ['C-z'], I: ['C-y'] }),
  ], []);
  model.extra = [];
  // カスタムレイヤーのサンプル（layer 1 に記号を数個。他キーは QWERTY へ透過）。
  const cu = (lb, u, m) => ({
    key: [1, lbl2sc[lb]], def: null,
    init: { tag: 1, keys: [[u, m]] }, cur: { tag: 1, keys: [[u, m]] }, ovr: true,
  });
  model.custom = [cu('Q', 0x1e, 2), cu('W', 0x1f, 2), cu('E', 0x20, 2)]; // ! @ #
  state.addedCustom = [];
  state.uncommitted = false;
  updateCommitState();
  afterLoad('デモモード（実機なし・サンプル配列）');
}

// ============================================================ 初期化

function initNav() {
  document.querySelectorAll('.navbtn').forEach((b) => {
    b.addEventListener('click', () => {
      state.pane = b.dataset.pane;
      state.sel = null;
      state.editorTab = null;
      renderApp();
    });
  });
}

function init() {
  const guard = (fn) => () => fn().catch((e) => setStatus(e.message, 'err'));
  initNav();
  if (!('hid' in navigator)) {
    $('unsupported').style.display = '';
    $('connectBtn').disabled = true;
    $('connectBtn2').disabled = true;
  } else {
    navigator.hid.addEventListener('disconnect', onDisconnect);
    if (location.hash !== '#demo') autoConnect();
  }
  if (location.hash === '#demo') loadDemo();
  $('connectBtn').addEventListener('click', guard(connect));
  $('connectBtn2').addEventListener('click', guard(connect));
  $('demoBtn').addEventListener('click', loadDemo);
  $('demoBtn2').addEventListener('click', loadDemo);
  $('rereadBtn').addEventListener('click', guard(readAll));
  $('commitBtn').addEventListener('click', guard(commit));
  $('rebootBtn').addEventListener('click', guard(reboot));
  window.addEventListener('beforeunload', (e) => {
    if (state.uncommitted && !state.demo) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

init();
