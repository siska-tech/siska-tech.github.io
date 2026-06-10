// 薙刀式キーボード 設定ツール（#12 フェーズ2）— WebHID で vendor HID(IF1) と read/write する。
//
// プロトコル v2（64B固定, firmware/src/usb_config.rs と一致）:
//   OUT(host→dev): [0]=cmd [1]=seq [2..]=args
//   IN (dev→host): [0]=cmd [1]=seq [2]=status [3..]=payload
// 既定値は静的テーブル(phf)由来、差分はステージング。JS でマージして表示。
// 反映: WRITE 系はステージング更新のみ → COMMIT でフラッシュ保存 → 再起動で有効。

'use strict';

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
};
const SEC = { LAYERS: 1, COMBO2: 2, COMBO3: 3, MODES: 4, EXTRA: 5 };
const ST_OK = 0x00;
const TAG_KANA = 0;
const TAG_KEYS = 1;

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
const LABEL_SC = Object.fromEntries(Object.entries(SC_LABEL).map(([k, v]) => [v.toUpperCase(), +k]));
const scLabel = (sc) => SC_LABEL[sc] || ('0x' + sc.toString(16));

// シフトビット → 面名（layout/naginata.yaml shifts と一致）。
const SHIFT_BITS = [
  [0x01, 'センター'], [0x02, '右濁(j)'], [0x04, '左濁(f)'],
  [0x08, '右半(m)'], [0x10, '左半(v)'], [0x20, '小(q)'],
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
// チップは (usage, modifiers) 1ペア＝1ストローク。修飾は report の modifier バイトに乗る。
const LETTERS = Array.from({ length: 26 }, (_, i) => [String.fromCharCode(65 + i), 0x04 + i, 0]);
const DIGITS = [['1', 0x1e, 0], ['2', 0x1f, 0], ['3', 0x20, 0], ['4', 0x21, 0], ['5', 0x22, 0],
  ['6', 0x23, 0], ['7', 0x24, 0], ['8', 0x25, 0], ['9', 0x26, 0], ['0', 0x27, 0]];
// 修飾キー単体（タップ。押しっぱなし保持はスコープC・未対応）。
const MODKEYS = [['Ctrl', 0xe0, 0], ['Shift', 0xe1, 0], ['Alt', 0xe2, 0], ['AltGr', 0xe6, 0], ['RShift', 0xe5, 0]];
const BASE_KEYS = [...SYMBOLS.filter((s) => s[2] === 0), ...LETTERS, ...DIGITS, ...MODKEYS];
const USAGE_NAME = {};
for (const [n, u, m] of BASE_KEYS) if (m === 0 && !(u in USAGE_NAME)) USAGE_NAME[u] = n;
// 修飾チェックボックス（HID modifier ビット: Ctrl=1 Shift=2 Alt=4 GUI=8）。
const MOD_DEFS = [['Ctrl', 1], ['Shift', 2], ['Alt', 4], ['GUI', 8]];

// (usage,mod) → 表示名。完全一致プリセット優先、無ければ 修飾接頭辞＋ベース名。
function symName(u, m) {
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
  { key: 'window_ms', label: '同時打鍵窓 [ms]', min: 5, max: 200 },
  { key: 'tap_ms', label: 'デバウンス/タップ [ms]', min: 1, max: 200 },
  { key: 'repeat_delay_ms', label: 'リピート初回ディレイ [ms]', min: 50, max: 2000 },
  { key: 'repeat_interval_ms', label: 'リピート間隔 [ms]', min: 5, max: 1000 },
  { key: 'led_brightness', label: 'LED輝度 (0–255, 255=最大)', min: 0, max: 255 },
];

const utf8enc = new TextEncoder();
const utf8dec = new TextDecoder('utf-8');

let device = null;
let seq = 0;
const pending = new Map();

let info = null;
let params = {};
// 各セクションの行モデル。行 = { key:[..], def:val|null, init:val, cur:val, ovr:bool }
//   val = { tag:0, kana:"" } | { tag:1, keys:[[u,m],..] }
const model = { layers: [], combo2: [], combo3: [], modes: [], extra: [] };
let matrixMap = {}; // "hand,row,col" -> sc

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const $ = (id) => document.getElementById(id);
const statusEl = () => $('status');
function setStatus(text, cls) {
  statusEl().textContent = text;
  statusEl().className = 'status' + (cls ? ' ' + cls : '');
}

// ---- WebHID 送受信 ----
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

// ---- 値デコード/比較 ----
function decodeValue(d, p) {
  const tag = d.getUint8(p);
  const len = d.getUint8(p + 1);
  let off = p + 2;
  if (tag === TAG_KANA) {
    const b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = d.getUint8(off + i);
    return { value: { tag: TAG_KANA, kana: utf8dec.decode(b) }, next: off + len };
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
  return v.tag === TAG_KANA ? { tag: 0, kana: v.kana } : { tag: 1, keys: v.keys.map((p) => p.slice()) };
}
function valuesEqual(a, b) {
  if (!a || !b || a.tag !== b.tag) return false;
  if (a.tag === TAG_KANA) return a.kana === b.kana;
  if (a.keys.length !== b.keys.length) return false;
  return a.keys.every((p, i) => p[0] === b.keys[i][0] && p[1] === b.keys[i][1]);
}
const keyId = (key) => key.join(',');

// ---- 読み出し ----
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
  device = devices[0];
  if (!device.opened) await device.open();
  device.addEventListener('inputreport', onInputReport);
  $('rereadBtn').disabled = false;
  await readAll();
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
  };
  const dp = await sendCommand(CMD.READ_PARAMS);
  params = {
    window_ms: dp.getUint16(3, true),
    tap_ms: dp.getUint16(5, true),
    repeat_delay_ms: dp.getUint16(7, true),
    repeat_interval_ms: dp.getUint16(9, true),
    led_brightness: dp.getUint8(11),
  };

  for (const [name, sec] of [['layers', SEC.LAYERS], ['combo2', SEC.COMBO2], ['combo3', SEC.COMBO3], ['modes', SEC.MODES]]) {
    const defs = await readSection(CMD.READ_DEFAULTS, sec);
    const ovr = await readSection(CMD.READ_OVERRIDES, sec);
    model[name] = mergeSection(defs, ovr);
  }
  await readMatrix();
  // 直接キー(EXTRA): 既定なし、差分のみ。行は key=[hand,row,col]。
  const exOvr = await readSection(CMD.READ_OVERRIDES, SEC.EXTRA);
  model.extra = exOvr.map((e) => ({ key: e.key, def: null, init: clone(e.value), cur: clone(e.value), ovr: true }));

  renderParams();
  renderLayout();
  renderLayers();
  renderCombos();
  renderModes();
  $('panel').style.display = '';
  setStatus(`接続: ${device.productName}  (proto ${info.protoVer}, fw ${info.fwMajor}.${info.fwMinor}, layers ${model.layers.length} / combo2 ${model.combo2.length} / combo3 ${model.combo3.length} / modes ${model.modes.length})`, 'ok');
}

// ---- パラメータ ----
function renderParams() {
  const grid = $('paramsGrid');
  grid.innerHTML = '';
  for (const f of PARAM_FIELDS) {
    const wrap = document.createElement('label');
    wrap.className = 'param';
    wrap.innerHTML = `<span>${f.label}</span>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = f.min; input.max = f.max; input.value = params[f.key];
    input.addEventListener('change', () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = params[f.key];
      v = Math.max(f.min, Math.min(f.max, v));
      input.value = v; params[f.key] = v;
    });
    wrap.appendChild(input);
    grid.appendChild(wrap);
  }
}

// ---- 値エディタ（かな or キー操作）----
function makeValueEditor(row, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'veditor';
  if (row.cur.tag === TAG_KANA) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = row.cur.kana;
    input.maxLength = 4;
    input.spellcheck = false;
    input.className = 'kana-in';
    input.addEventListener('input', () => { row.cur.kana = input.value; onChange(); });
    wrap.appendChild(input);
  } else {
    const chips = document.createElement('div');
    chips.className = 'chips';
    const rerender = () => {
      chips.innerHTML = '';
      row.cur.keys.forEach(([u, m], idx) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = symName(u, m);
        const x = document.createElement('button');
        x.textContent = '×'; x.className = 'chipx';
        x.addEventListener('click', () => { row.cur.keys.splice(idx, 1); rerender(); onChange(); });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
      // 合成: 修飾チェック（Ctrl/Shift/Alt/GUI）＋ベースキー選択 → (usage, mod) チップを追加。
      const adder = document.createElement('span');
      adder.className = 'adder';
      const cbs = [];
      for (const [lbl, bit] of MOD_DEFS) {
        const l = document.createElement('label');
        l.className = 'modcb';
        l.title = lbl;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cbs.push([cb, bit]);
        l.appendChild(cb);
        l.appendChild(document.createTextNode(lbl[0])); // C/S/A/G
        adder.appendChild(l);
      }
      const sel = document.createElement('select');
      sel.className = 'symsel';
      sel.innerHTML = '<option value="">＋キー</option>' +
        BASE_KEYS.map(([n], i) => `<option value="${i}">${n}</option>`).join('');
      sel.addEventListener('change', () => {
        if (sel.value !== '') {
          const [, u, bm] = BASE_KEYS[+sel.value];
          let m = bm;
          for (const [cb, bit] of cbs) if (cb.checked) m |= bit;
          row.cur.keys.push([u, m]);
          rerender();
          onChange();
        }
      });
      adder.appendChild(sel);
      chips.appendChild(adder);
    };
    rerender();
    wrap.appendChild(chips);
  }
  return wrap;
}

function makeRow(row, label, onChange) {
  const div = document.createElement('div');
  div.className = 'erow';
  const lab = document.createElement('div');
  lab.className = 'elabel';
  lab.textContent = label;
  div.appendChild(lab);
  div.appendChild(makeValueEditor(row, () => { markRow(div, row); onChange(); }));
  const reset = document.createElement('button');
  reset.className = 'reset';
  reset.textContent = '既定';
  reset.title = '既定へ戻す';
  reset.addEventListener('click', () => {
    if (row.def) { row.cur = clone(row.def); }
    else { row.cur = row.cur.tag === TAG_KANA ? { tag: 0, kana: '' } : { tag: 1, keys: [] }; }
    onChange();
    // 再描画は呼び出し側 render に委ねる
    div.replaceWith(makeRow(row, label, onChange));
  });
  div.appendChild(reset);
  markRow(div, row);
  return div;
}
function markRow(div, row) {
  const dirty = !valuesEqual(row.cur, row.init);
  div.classList.toggle('dirty-row', dirty);
}

// ---- layers タブ（面ごと）----
function renderLayers() {
  const root = $('layersGroups');
  root.innerHTML = '';
  const byMask = new Map();
  for (const r of model.layers) {
    const mask = r.key[0];
    if (!byMask.has(mask)) byMask.set(mask, []);
    byMask.get(mask).push(r);
  }
  const masks = [...byMask.keys()].sort((a, b) => a - b);
  for (const mask of masks) {
    const sec = document.createElement('div');
    sec.className = 'group';
    sec.innerHTML = `<h3>${maskLabel(mask)}</h3>`;
    const rows = byMask.get(mask).sort((a, b) => a.key[1] - b.key[1]);
    for (const r of rows) {
      sec.appendChild(makeRow(r, scLabel(r.key[1]), () => updateDirty('layers', 'layersDirty')));
    }
    root.appendChild(sec);
  }
  updateDirty('layers', 'layersDirty');
}

// ---- combos タブ ----
function renderCombos() {
  renderComboList('combo2', $('combo2List'), 2);
  renderComboList('combo3', $('combo3List'), 3);
}
function comboLabel(key) {
  return key.map(scLabel).join('+');
}
function renderComboList(name, root, n) {
  root.innerHTML = '';
  for (const r of model[name].sort((a, b) => keyId(a.key).localeCompare(keyId(b.key)))) {
    root.appendChild(makeRow(r, comboLabel(r.key), () => updateDirty(name === 'combo2' ? 'combo2' : 'combo3', 'combosDirty')));
  }
  // 新規追加フォーム
  const add = document.createElement('div');
  add.className = 'addform';
  const keyInputs = [];
  for (let i = 0; i < n; i++) {
    const ki = document.createElement('input');
    ki.placeholder = 'キー' + (i + 1); ki.className = 'keyin'; ki.maxLength = 5;
    keyInputs.push(ki); add.appendChild(ki);
  }
  const kana = document.createElement('input');
  kana.placeholder = 'かな'; kana.className = 'kana-in'; kana.maxLength = 4;
  add.appendChild(kana);
  const btn = document.createElement('button');
  btn.textContent = '追加';
  btn.addEventListener('click', () => {
    const scs = keyInputs.map((ki) => LABEL_SC[ki.value.trim().toUpperCase()]);
    if (scs.some((s) => s === undefined) || !kana.value) {
      setStatus('追加: キーは QWERTY 文字（例 W H）、かなを入力してください', 'err');
      return;
    }
    scs.sort((a, b) => a - b);
    if (model[name].some((r) => keyId(r.key) === keyId(scs))) {
      setStatus('そのコンボは既に存在します', 'err');
      return;
    }
    const v = { tag: 0, kana: kana.value };
    model[name].push({ key: scs, def: null, init: { tag: 0, kana: '' }, cur: v, ovr: false });
    renderCombos();
    updateDirty(name, 'combosDirty');
  });
  add.appendChild(btn);
  root.appendChild(add);
}

// ---- modes タブ ----
function renderModes() {
  const root = $('modesGroups');
  root.innerHTML = '';
  const byMode = new Map();
  for (const r of model.modes) {
    const m = r.key[0];
    if (!byMode.has(m)) byMode.set(m, []);
    byMode.get(m).push(r);
  }
  for (const m of [...byMode.keys()].sort((a, b) => a - b)) {
    const sec = document.createElement('div');
    sec.className = 'group';
    sec.innerHTML = `<h3>${modeLabel(m)}</h3>`;
    for (const r of byMode.get(m).sort((a, b) => a.key[1] - b.key[1])) {
      sec.appendChild(makeRow(r, scLabel(r.key[1]), () => updateDirty('modes', 'modesDirty')));
    }
    root.appendChild(sec);
  }
  updateDirty('modes', 'modesDirty');
}

function updateDirty(name, elId) {
  const n = model[name].filter((r) => !valuesEqual(r.cur, r.init)).length;
  $(elId).textContent = n ? `${n}件 未送信` : '';
}

// ---- レイアウトタブ ----
function findLayerRow(mask, sc) {
  return model.layers.find((r) => r.key[0] === mask && r.key[1] === sc);
}
function updateLayoutDirty() {
  const n = model.layers.filter((r) => !valuesEqual(r.cur, r.init)).length +
    model.extra.filter((r) => !valuesEqual(r.cur, r.init)).length;
  $('layoutDirty').textContent = n ? `${n}件 未送信` : '';
}
function renderLayout() {
  renderHandGrid($('kbdLeft'), '左手 単打面', 0, [1, 2, 3, 4, 5]);
  renderHandGrid($('kbdRight'), '右手 単打面', 1, [5, 4, 3, 2, 1]);
  renderExtra();
}
function renderHandGrid(root, title, hand, colOrder) {
  root.innerHTML = `<h3>${title}</h3>`;
  const grid = document.createElement('div');
  grid.className = 'kbgrid';
  for (const row of [1, 2, 3, 4]) {
    const rowdiv = document.createElement('div');
    rowdiv.className = 'kbrow';
    for (const col of colOrder) {
      const sc = matrixMap[`${hand},${row},${col}`];
      const cell = document.createElement('div');
      cell.className = 'kbcell';
      if (sc === undefined) {
        cell.classList.add('empty');
      } else {
        cell.innerHTML = `<div class="kbk">${scLabel(sc)}</div>`;
        const r = findLayerRow(0, sc);
        if (r) {
          cell.appendChild(makeValueEditor(r, () => {
            updateLayoutDirty();
            updateDirty('layers', 'layersDirty');
          }));
        }
      }
      rowdiv.appendChild(cell);
    }
    grid.appendChild(rowdiv);
  }
  root.appendChild(grid);
}
function renderExtra() {
  const root = $('extraList');
  root.innerHTML = '';
  for (const r of model.extra) {
    const div = document.createElement('div');
    div.className = 'erow';
    const lab = document.createElement('div');
    lab.className = 'elabel';
    lab.textContent = `物理 ${r.key[0] ? '右' : '左'} r${r.key[1]} c${r.key[2]}`;
    div.appendChild(lab);
    div.appendChild(makeValueEditor(r, () => { markRow(div, r); updateLayoutDirty(); }));
    const del = document.createElement('button');
    del.className = 'reset';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      if (r.ovr) { r.cur = { tag: 1, keys: [] }; } // 送信時に remove
      else { model.extra = model.extra.filter((x) => x !== r); }
      renderExtra();
      updateLayoutDirty();
    });
    div.appendChild(del);
    markRow(div, r);
    root.appendChild(div);
  }
  updateLayoutDirty();
}
async function learnKey() {
  await sendCommand(CMD.READ_LASTKEY); // 直近の押下を drain（誤検出防止）
  $('learnStatus').textContent = '端末で割り当てたい物理キーを押してください…';
  $('learnStatus').className = 'status';
  for (let i = 0; i < 100; i++) {
    const d = await sendCommand(CMD.READ_LASTKEY);
    if (d.getUint8(6)) {
      const hand = d.getUint8(3), row = d.getUint8(4), col = d.getUint8(5);
      if (matrixMap[`${hand},${row},${col}`] !== undefined) {
        $('learnStatus').textContent = 'それは薙刀式キーです。未割当の物理キーを押してください。';
        $('learnStatus').className = 'status err';
      } else if (model.extra.some((r) => r.key[0] === hand && r.key[1] === row && r.key[2] === col)) {
        $('learnStatus').textContent = 'その位置は既に登録済みです。';
        $('learnStatus').className = 'status err';
      } else {
        model.extra.push({ key: [hand, row, col], def: null, init: { tag: 1, keys: [] }, cur: { tag: 1, keys: [] }, ovr: false });
        renderExtra();
        $('learnStatus').textContent = `学習: 物理 ${hand ? '右' : '左'} r${row} c${col} を追加。記号を割り当てて送信してください。`;
        $('learnStatus').className = 'status ok';
      }
      return;
    }
    await sleep(100);
  }
  $('learnStatus').textContent = '学習タイムアウト（キー入力がありませんでした）。';
  $('learnStatus').className = 'status err';
}
async function writeLayout() {
  await writeSectionRows(SEC.LAYERS, 'layers', 'layoutDirty');
  await writeSectionRows(SEC.EXTRA, 'extra', 'layoutDirty');
  renderExtra();
}

// ---- 書き込み ----
function valueBytes(v, isRemove) {
  if (isRemove) return [TAG_KANA, 0];
  if (v.tag === TAG_KANA) {
    const b = utf8enc.encode(v.kana || '');
    return [TAG_KANA, b.length, ...b];
  }
  const flat = [];
  (v.keys || []).forEach(([u, m]) => flat.push(u, m));
  return [TAG_KEYS, flat.length, ...flat];
}
function isEmptyVal(v) {
  return v.tag === TAG_KANA ? !v.kana : v.keys.length === 0;
}

async function writeSectionRows(section, name, elId) {
  const changed = model[name].filter((r) => !valuesEqual(r.cur, r.init));
  if (!changed.length) {
    setStatus('変更はありません', '');
    return;
  }
  for (const r of changed) {
    const revert = r.def && valuesEqual(r.cur, r.def);
    const remove = revert || (!r.def && isEmptyVal(r.cur));
    if (r.cur.tag === TAG_KANA && !remove && info && utf8enc.encode(r.cur.kana).length > info.maxKanaLen) {
      setStatus(`「${r.cur.kana}」が長すぎます（最大${info.maxKanaLen}バイト）`, 'err');
      return;
    }
    const args = [section, ...r.key, ...valueBytes(r.cur, remove)];
    if (args.length > REPORT_LEN - 2) { setStatus('1エントリが大きすぎます（キー数を減らしてください）', 'err'); return; }
    const resp = await sendCommand(CMD.WRITE, args);
    if (resp.getUint8(2) !== ST_OK) { setStatus('送信失敗（容量超過?）', 'err'); return; }
    r.init = clone(r.cur);
    r.ovr = !remove;
  }
  updateDirty(name, elId);
  setStatus(`${changed.length}件を送信しました（COMMITで保存）`, 'ok');
}

async function writeParams() {
  const a = new Uint8Array(9);
  const dv = new DataView(a.buffer);
  dv.setUint16(0, params.window_ms, true);
  dv.setUint16(2, params.tap_ms, true);
  dv.setUint16(4, params.repeat_delay_ms, true);
  dv.setUint16(6, params.repeat_interval_ms, true);
  dv.setUint8(8, params.led_brightness);
  const r = await sendCommand(CMD.WRITE_PARAMS, Array.from(a));
  setStatus(r.getUint8(2) === ST_OK ? 'パラメータを送信しました（COMMITで保存）' : 'パラメータ送信失敗', r.getUint8(2) === ST_OK ? 'ok' : 'err');
}

async function commit() {
  const r = await sendCommand(CMD.COMMIT);
  setStatus(r.getUint8(2) === ST_OK ? 'フラッシュへ保存しました。再起動で反映されます。' : 'COMMIT 失敗', r.getUint8(2) === ST_OK ? 'ok' : 'err');
}
async function reboot() {
  setStatus('再起動を要求しました…');
  try { await sendCommand(CMD.REBOOT); } catch (e) { /* 切断で応答無しは正常 */ }
  $('panel').style.display = 'none';
  $('rereadBtn').disabled = true;
  device = null;
  setStatus('端末が再起動しました。再度「端末に接続」してください。', '');
}
async function resetDefaults() {
  if (!confirm('全ユーザ設定を消去して codegen 既定へ戻します。よろしいですか？')) return;
  const r = await sendCommand(CMD.RESET);
  if (r.getUint8(2) === ST_OK) { setStatus('既定へリセットしました。再起動で反映されます。', 'ok'); await readAll(); }
  else setStatus('RESET 失敗', 'err');
}

// ---- タブ ----
function initTabs() {
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      document.querySelectorAll('.tabpane').forEach((p) => (p.style.display = 'none'));
      $('tab-' + t.dataset.tab).style.display = '';
    });
  });
}

function init() {
  if (!('hid' in navigator)) {
    $('unsupported').style.display = '';
    $('connectBtn').disabled = true;
    return;
  }
  initTabs();
  const guard = (fn) => () => fn().catch((e) => setStatus(e.message, 'err'));
  $('connectBtn').addEventListener('click', guard(connect));
  $('rereadBtn').addEventListener('click', guard(readAll));
  $('writeParamsBtn').addEventListener('click', guard(writeParams));
  $('learnBtn').addEventListener('click', guard(learnKey));
  $('writeLayoutBtn').addEventListener('click', guard(writeLayout));
  $('writeLayersBtn').addEventListener('click', guard(() => writeSectionRows(SEC.LAYERS, 'layers', 'layersDirty')));
  $('writeCombosBtn').addEventListener('click', guard(async () => {
    await writeSectionRows(SEC.COMBO2, 'combo2', 'combosDirty');
    await writeSectionRows(SEC.COMBO3, 'combo3', 'combosDirty');
  }));
  $('writeModesBtn').addEventListener('click', guard(() => writeSectionRows(SEC.MODES, 'modes', 'modesDirty')));
  $('commitBtn').addEventListener('click', guard(commit));
  $('rebootBtn').addEventListener('click', guard(reboot));
  $('resetBtn').addEventListener('click', guard(resetDefaults));
}

init();
