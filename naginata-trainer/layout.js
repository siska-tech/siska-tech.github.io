// =============================================================================
// 薙刀式 v15 配列データ（naginata-core/layout/naginata.yaml の写し）
// -----------------------------------------------------------------------------
// このファイルは「かな → 押すべきキー集合(sc)」の逆引き索引を構築する。
// sc は薙刀式 .txt と同じ QWERTY スキャンコードID（Set-1系）。space=0x39。
// 物理キー位置で判定するため、ブラウザの event.code を sc へ写像する。
// =============================================================================

// --- ブラウザ event.code → sc（物理キー位置・配列非依存）---------------------
const CODE2SC = {
  KeyQ: 0x10, KeyW: 0x11, KeyE: 0x12, KeyR: 0x13, KeyT: 0x14,
  KeyY: 0x15, KeyU: 0x16, KeyI: 0x17, KeyO: 0x18, KeyP: 0x19,
  KeyA: 0x1e, KeyS: 0x1f, KeyD: 0x20, KeyF: 0x21, KeyG: 0x22,
  KeyH: 0x23, KeyJ: 0x24, KeyK: 0x25, KeyL: 0x26, Semicolon: 0x27,
  KeyZ: 0x2c, KeyX: 0x2d, KeyC: 0x2e, KeyV: 0x2f, KeyB: 0x30,
  KeyN: 0x31, KeyM: 0x32, Comma: 0x33, Period: 0x34, Slash: 0x35,
  Space: 0x39,
};

// --- sc → QWERTY 表示ラベル ---------------------------------------------------
const SC_QWERTY = {
  0x10: "Q", 0x11: "W", 0x12: "E", 0x13: "R", 0x14: "T",
  0x15: "Y", 0x16: "U", 0x17: "I", 0x18: "O", 0x19: "P",
  0x1e: "A", 0x1f: "S", 0x20: "D", 0x21: "F", 0x22: "G",
  0x23: "H", 0x24: "J", 0x25: "K", 0x26: "L", 0x27: ";",
  0x2c: "Z", 0x2d: "X", 0x2e: "C", 0x2f: "V", 0x30: "B",
  0x31: "N", 0x32: "M", 0x33: ",", 0x34: ".", 0x35: "/",
  0x39: "␣",
};

// --- シフト能力キー -----------------------------------------------------------
const SHIFT = {
  CENTER: 0x39, // space: センターシフト
  R_THUMB: 0x24, // j 右親
  L_THUMB: 0x21, // f 左親
  R_MID: 0x32, // m 右中
  L_MID: 0x2f, // v 左中
  A_KEY: 0x10, // q あ位置（小書き）
};
// シフトキーの sc 集合（キー図で印を付ける用）
const SHIFT_SC = new Set(Object.values(SHIFT));

// --- レイヤ定義（when: シフト名配列, kana: [sc, かな]）------------------------
const LAYERS = [
  // 単打面
  { when: [], cat: "seion", kana: [
    [0x10, "ヴ"], [0x11, "き"], [0x12, "て"], [0x13, "し"], [0x17, "る"],
    [0x18, "す"], [0x19, "へ"], [0x1e, "ろ"], [0x1f, "け"], [0x20, "と"],
    [0x21, "か"], [0x22, "っ"], [0x23, "く"], [0x24, "あ"], [0x25, "い"],
    [0x26, "う"], [0x27, "ー"], [0x2c, "ほ"], [0x2d, "ひ"], [0x2e, "は"],
    [0x2f, "こ"], [0x30, "そ"], [0x31, "た"], [0x32, "な"], [0x33, "ん"],
    [0x34, "ら"], [0x35, "れ"],
  ]},
  // センターシフト面
  { when: ["CENTER"], cat: "seion", kana: [
    [0x11, "ぬ"], [0x12, "り"], [0x13, "ね"], [0x16, "さ"], [0x17, "よ"],
    [0x18, "え"], [0x19, "ゆ"], [0x1e, "せ"], [0x1f, "め"], [0x20, "に"],
    [0x21, "ま"], [0x22, "ち"], [0x23, "や"], [0x24, "の"], [0x25, "も"],
    [0x26, "つ"], [0x27, "ふ"], [0x2e, "を"], [0x30, "み"], [0x31, "お"],
    [0x33, "む"], [0x34, "わ"],
  ]},
  // 濁音（右手かな = 左濁 L_THUMB=f）
  { when: ["L_THUMB"], cat: "dakuon", kana: [
    [0x16, "ざ"], [0x18, "ず"], [0x19, "べ"], [0x23, "ぐ"],
    [0x26, "づ"], [0x27, "ぶ"], [0x31, "だ"],
  ]},
  // 濁音（左手かな = 右濁 R_THUMB=j）
  { when: ["R_THUMB"], cat: "dakuon", kana: [
    [0x11, "ぎ"], [0x12, "で"], [0x13, "じ"], [0x1e, "ぜ"], [0x1f, "げ"],
    [0x20, "ど"], [0x21, "が"], [0x22, "ぢ"], [0x2c, "ぼ"], [0x2d, "び"],
    [0x2e, "ば"], [0x2f, "ご"], [0x30, "ぞ"],
  ]},
  // 半濁音（右手かな = 左半 L_MID=v）
  { when: ["L_MID"], cat: "handakuon", kana: [
    [0x19, "ぺ"], [0x27, "ぷ"],
  ]},
  // 半濁音（左手かな = 右半 R_MID=m）
  { when: ["R_MID"], cat: "handakuon", kana: [
    [0x2c, "ぽ"], [0x2d, "ぴ"], [0x2e, "ぱ"],
  ]},
  // 小書き（A_KEY=q）
  { when: ["A_KEY"], cat: "small", kana: [
    [0x17, "ょ"], [0x18, "ぇ"], [0x19, "ゅ"], [0x23, "ゃ"], [0x24, "ぁ"],
    [0x25, "ぃ"], [0x26, "ぅ"], [0x31, "ぉ"], [0x34, "ゎ"],
  ]},
];

// --- 2キー同時押し（清音拗音）-------------------------------------------------
const COMBO2 = [
  [[0x11, 0x23], "きゃ"], [[0x11, 0x19], "きゅ"], [[0x11, 0x17], "きょ"],
  [[0x12, 0x23], "りゃ"], [[0x12, 0x19], "りゅ"], [[0x12, 0x17], "りょ"],
  [[0x13, 0x23], "しゃ"], [[0x13, 0x19], "しゅ"], [[0x13, 0x17], "しょ"],
  [[0x20, 0x23], "にゃ"], [[0x20, 0x19], "にゅ"], [[0x20, 0x17], "にょ"],
  [[0x22, 0x23], "ちゃ"], [[0x22, 0x19], "ちゅ"], [[0x22, 0x17], "ちょ"],
  [[0x2d, 0x23], "ひゃ"], [[0x2d, 0x19], "ひゅ"], [[0x2d, 0x17], "ひょ"],
  [[0x30, 0x23], "みゃ"], [[0x30, 0x19], "みゅ"], [[0x30, 0x17], "みょ"],
];

// --- 3キー同時押し（外来音・濁音拗音・半濁音拗音）----------------------------
const COMBO3 = [
  [[0x32, 0x12, 0x25], "てぃ"], [[0x32, 0x12, 0x19], "てゅ"],
  [[0x24, 0x12, 0x25], "でぃ"], [[0x24, 0x12, 0x19], "でゅ"],
  [[0x32, 0x20, 0x26], "とぅ"], [[0x24, 0x20, 0x26], "どぅ"],
  [[0x32, 0x13, 0x18], "しぇ"], [[0x32, 0x22, 0x18], "ちぇ"],
  [[0x24, 0x13, 0x18], "じぇ"], [[0x24, 0x22, 0x18], "ぢぇ"],
  [[0x2f, 0x27, 0x24], "ふぁ"], [[0x2f, 0x27, 0x25], "ふぃ"],
  [[0x2f, 0x27, 0x18], "ふぇ"], [[0x2f, 0x27, 0x31], "ふぉ"],
  [[0x2f, 0x27, 0x19], "ふゅ"],
  [[0x32, 0x10, 0x24], "ヴぁ"], [[0x32, 0x10, 0x25], "ヴぃ"],
  [[0x32, 0x10, 0x18], "ヴぇ"], [[0x32, 0x10, 0x31], "ヴぉ"],
  [[0x32, 0x10, 0x19], "ヴゅ"],
  [[0x2f, 0x26, 0x25], "うぃ"], [[0x2f, 0x26, 0x18], "うぇ"],
  [[0x2f, 0x26, 0x31], "うぉ"], [[0x2f, 0x25, 0x18], "いぇ"],
  [[0x2f, 0x26, 0x24], "つぁ"],
  [[0x2f, 0x23, 0x24], "くぁ"], [[0x2f, 0x23, 0x25], "くぃ"],
  [[0x2f, 0x23, 0x18], "くぇ"], [[0x2f, 0x23, 0x31], "くぉ"],
  [[0x2f, 0x23, 0x34], "くゎ"],
  [[0x21, 0x23, 0x24], "ぐぁ"], [[0x21, 0x23, 0x25], "ぐぃ"],
  [[0x21, 0x23, 0x18], "ぐぇ"], [[0x21, 0x23, 0x31], "ぐぉ"],
  [[0x21, 0x23, 0x34], "ぐゎ"],
  [[0x24, 0x11, 0x23], "ぎゃ"], [[0x24, 0x11, 0x19], "ぎゅ"], [[0x24, 0x11, 0x17], "ぎょ"],
  [[0x24, 0x13, 0x23], "じゃ"], [[0x24, 0x13, 0x19], "じゅ"], [[0x24, 0x13, 0x17], "じょ"],
  [[0x24, 0x22, 0x23], "ぢゃ"], [[0x24, 0x22, 0x19], "ぢゅ"], [[0x24, 0x22, 0x17], "ぢょ"],
  [[0x24, 0x2d, 0x23], "びゃ"], [[0x24, 0x2d, 0x19], "びゅ"], [[0x24, 0x2d, 0x17], "びょ"],
  [[0x32, 0x2d, 0x23], "ぴゃ"], [[0x32, 0x2d, 0x19], "ぴゅ"], [[0x32, 0x2d, 0x17], "ぴょ"],
];

// --- 句読点（センターシフト面の特殊セル）-------------------------------------
const PUNCT = [
  [[0x39, 0x2f], "、"], // CENTER + v
  [[0x39, 0x32], "。"], // CENTER + m
];

// =============================================================================
// 逆引き索引の構築
// =============================================================================

// かな → { keys:[sc...], cat, shifts:[sc...] }
const KANA2KEYS = {};
// 単打面 sc → かな（キー図のラベル用）
const SINGLE_KANA = {};
// カテゴリ別の出題プール（かな文字列の配列）
const POOL = { seion: [], dakuon: [], handakuon: [], small: [], youon: [], gairai: [] };

// 逆引き索引を（再）構築する。custom keymap 読込時も同じ関数で作り直す。
function buildIndex(layers, combo2, combo3, punct) {
  for (const k of Object.keys(KANA2KEYS)) delete KANA2KEYS[k];
  for (const k of Object.keys(SINGLE_KANA)) delete SINGLE_KANA[k];
  for (const k of Object.keys(POOL)) POOL[k] = [];

  // 衝突時は「キー数が少ない方」を優先採用。
  // shifts は「そのレイヤーの実シフト集合」（when由来）。ベースキーが
  // シフト位置(M/F/J/V/Q/space)に一致しても、それはシフト扱いしない。
  function add(kana, keys, cat, shifts) {
    const uniq = [...new Set(keys)].sort((a, b) => a - b);
    const prev = KANA2KEYS[kana];
    if (prev && prev.keys.length <= uniq.length) return;
    const sh = [...new Set(shifts)].sort((a, b) => a - b);
    KANA2KEYS[kana] = { keys: uniq, cat, shifts: sh };
  }

  for (const layer of layers) {
    const shiftScs = layer.when.map((n) => SHIFT[n]);
    for (const [sc, k] of layer.kana) {
      add(k, [...shiftScs, sc], layer.cat, shiftScs);
      if (layer.when.length === 0) SINGLE_KANA[sc] = k;
    }
  }
  for (const [keys, k] of combo2) add(k, keys, "youon", []);   // 同時押し（シフトではない）
  for (const [keys, k] of combo3) add(k, keys, "gairai", []);
  for (const [keys, k] of punct) add(k, keys, "seion", [SHIFT.CENTER]); // 、。= センター

  // 出題プールをカテゴリ別に集約（重複除去）
  for (const [k, v] of Object.entries(KANA2KEYS)) {
    if (POOL[v.cat] && !POOL[v.cat].includes(k)) POOL[v.cat].push(k);
  }

  buildLayerKana(layers);
}

// 保持中シフトキー集合 → そのレイヤーの { sc: かな }（キー図のライブ表示用）。
// キーは保持シフトの sc を昇順連結した文字列（単打面は ""）。
const LAYER_KANA = {};
function buildLayerKana(layers) {
  for (const k of Object.keys(LAYER_KANA)) delete LAYER_KANA[k];
  for (const layer of layers) {
    const key = layer.when.map((n) => SHIFT[n]).sort((a, b) => a - b).join(",");
    const m = {};
    for (const [sc, k] of layer.kana) m[sc] = k;
    LAYER_KANA[key] = m;
  }
}

buildIndex(LAYERS, COMBO2, COMBO3, PUNCT);

// カスタム配列(JSON)を適用して索引を作り直す。
// data: { layers?, combo2?, combo3?, punct? }（sc は数値 or "0x.." 文字列）
function applyCustomKeymap(data) {
  const norm = (sc) => (typeof sc === "string" ? parseInt(sc, 16) : sc);
  const layers = (data.layers || LAYERS).map((L) => ({
    when: L.when || [], cat: L.cat || "seion",
    kana: (L.kana || []).map(([s, k]) => [norm(s), k]),
  }));
  const cv = (list, def) => (list ? list.map(([ks, k]) => [ks.map(norm), k]) : def);
  buildIndex(layers, cv(data.combo2, COMBO2), cv(data.combo3, COMBO3), cv(data.punct, PUNCT));
}

// --- キー図の物理レイアウト（左右5列）----------------------------------------
const KEYBOARD_ROWS = {
  left: [
    [0x10, 0x11, 0x12, 0x13, 0x14],
    [0x1e, 0x1f, 0x20, 0x21, 0x22],
    [0x2c, 0x2d, 0x2e, 0x2f, 0x30],
  ],
  right: [
    [0x15, 0x16, 0x17, 0x18, 0x19],
    [0x23, 0x24, 0x25, 0x26, 0x27],
    [0x31, 0x32, 0x33, 0x34, 0x35],
  ],
};

// かな文字列を入力単位へ分割（最長一致 2文字 → 1文字）
function tokenize(text) {
  const units = [];
  let i = 0;
  while (i < text.length) {
    const two = text.substr(i, 2);
    if (text.length - i >= 2 && KANA2KEYS[two]) {
      units.push(two);
      i += 2;
    } else {
      const one = text[i];
      if (KANA2KEYS[one]) units.push(one);
      // 索引に無い文字（空白等）はスキップ
      i += 1;
    }
  }
  return units;
}
