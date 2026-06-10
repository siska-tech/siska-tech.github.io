// =============================================================================
// かな → ローマ字（実機ファーム naginata-core/src/romaji.rs の移植）
// -----------------------------------------------------------------------------
// 訓令式ベース（si/ti/tu/hu/zi…）、撥音=常に "nn"、促音=次モーラ頭子音を重ねる、
// 長音 ー = "-"。実機がHID出力するローマ字と一致させ、IMEオフのローマ字判定に使う。
// =============================================================================

const ROMAJI_BASE = {
  "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
  "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
  "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
  "さ": "sa", "し": "si", "す": "su", "せ": "se", "そ": "so",
  "ざ": "za", "じ": "zi", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
  "た": "ta", "ち": "ti", "つ": "tu", "て": "te", "と": "to",
  "だ": "da", "ぢ": "di", "づ": "du", "で": "de", "ど": "do",
  "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
  "は": "ha", "ひ": "hi", "ふ": "hu", "へ": "he", "ほ": "ho",
  "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
  "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
  "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
  "や": "ya", "ゆ": "yu", "よ": "yo",
  "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
  "わ": "wa", "を": "wo", "ん": "nn",
  "ゔ": "vu", "ヴ": "vu", "ー": "-",
  "ぁ": "xa", "ぃ": "xi", "ぅ": "xu", "ぇ": "xe", "ぉ": "xo",
  "ゃ": "xya", "ゅ": "xyu", "ょ": "xyo", "ゎ": "xwa", "っ": "xtu",
};

const YOUON_CONSONANT = {
  "き": "k", "ぎ": "g", "し": "s", "じ": "z", "ち": "t", "ぢ": "d",
  "に": "n", "ひ": "h", "び": "b", "ぴ": "p", "み": "m", "り": "r",
};
const YOUON_VOWEL = { "ゃ": "ya", "ゅ": "yu", "ょ": "yo" };
const VOWELS = new Set(["a", "i", "u", "e", "o"]);

function kanaToRomaji(kana) {
  let out = "";
  const cs = [...kana];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const next = cs[i + 1];

    // 促音っ: 次モーラの頭子音を重ねる。無理なら xtu。
    if (c === "っ") {
      const r = next && ROMAJI_BASE[next];
      const first = r && r[0];
      if (first && !VOWELS.has(first) && /[a-z]/.test(first)) { out += first; continue; }
      out += "xtu"; continue;
    }
    // 拗音結合: い段かな + 小書きゃゅょ
    if (YOUON_CONSONANT[c] && next && YOUON_VOWEL[next]) {
      out += YOUON_CONSONANT[c] + YOUON_VOWEL[next];
      i++; continue;
    }
    if (ROMAJI_BASE[c]) out += ROMAJI_BASE[c];
    // 索引に無い文字（空白等）は無視
  }
  return out;
}

// かな各文字を消費した時点の累積ローマ字長を返す（進捗→かな位置の対応付け用）。
// cum[i] = targetKana の先頭 i+1 文字を打ち終えた時点のローマ字長。
function romajiCumulative(kana) {
  const cs = [...kana];
  let out = "";
  const cum = new Array(cs.length).fill(0);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], next = cs[i + 1];
    if (c === "っ") {
      const r = next && ROMAJI_BASE[next];
      const f = r && r[0];
      out += (f && !VOWELS.has(f) && /[a-z]/.test(f)) ? f : "xtu";
      cum[i] = out.length; continue;
    }
    if (YOUON_CONSONANT[c] && next && YOUON_VOWEL[next]) {
      out += YOUON_CONSONANT[c] + YOUON_VOWEL[next];
      cum[i] = out.length; i++; cum[i] = out.length; continue;
    }
    if (ROMAJI_BASE[c]) out += ROMAJI_BASE[c];
    cum[i] = out.length;
  }
  return { romaji: out, cum };
}

// ローマ字判定の寛容化: ヘボン式入力も受理する（si/ti/tu/hu/zi に正規化）。
function normalizeRomaji(s) {
  return s.toLowerCase()
    .replace(/shi/g, "si").replace(/chi/g, "ti").replace(/tsu/g, "tu")
    .replace(/fu/g, "hu").replace(/ji/g, "zi");
}

// --- ローマ字 自動訂正用: モーラ分解＋受理オートマトン ----------------------
// 各モーラの受理綴り（訓令式＋ヘボン式の異綴り）。撥音 ん は "nn" 固定（曖昧回避）。
function romajiVariants(kunrei) {
  const map = {
    "si": ["si", "shi"], "ti": ["ti", "chi"], "tu": ["tu", "tsu"],
    "hu": ["hu", "fu"], "zi": ["zi", "ji"],
    "sya": ["sya", "sha"], "syu": ["syu", "shu"], "syo": ["syo", "sho"],
    "tya": ["tya", "cha"], "tyu": ["tyu", "chu"], "tyo": ["tyo", "cho"],
    "zya": ["zya", "ja", "jya"], "zyu": ["zyu", "ju", "jyu"], "zyo": ["zyo", "jo", "jyo"],
    "nn": ["nn", "n"],
    "wo": ["wo", "o"],
    "xa": ["xa", "la"], "xi": ["xi", "li"], "xu": ["xu", "lu"],
    "xe": ["xe", "le"], "xo": ["xo", "lo"],
    "xya": ["xya", "lya"], "xyu": ["xyu", "lyu"], "xyo": ["xyo", "lyo"],
    "xtu": ["xtu", "ltu", "xtsu"], "xwa": ["xwa", "lwa"],
  };
  return map[kunrei] || [kunrei];
}

// targetKana を「打鍵モーラ」へ分解。各要素 {sp:[受理綴り], kanaLen}。
// 促音っ=次モーラ頭子音1文字、撥音ん="nn"、拗音=い段+小書きで1モーラ。
function romajiPieces(kana) {
  const cs = [...kana];
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], next = cs[i + 1];
    if (c === "っ") {
      const r = next && ROMAJI_BASE[next];
      const f = r && r[0];
      if (f && !VOWELS.has(f) && /[a-z]/.test(f)) out.push({ sp: [f], kanaLen: 1 });
      else out.push({ sp: romajiVariants("xtu"), kanaLen: 1 });
      continue;
    }
    if (YOUON_CONSONANT[c] && next && YOUON_VOWEL[next]) {
      out.push({ sp: romajiVariants(YOUON_CONSONANT[c] + YOUON_VOWEL[next]), kanaLen: 2 });
      i++; continue;
    }
    if (ROMAJI_BASE[c]) out.push({ sp: romajiVariants(ROMAJI_BASE[c]), kanaLen: 1 });
  }
  return out;
}

// raw（小文字・空白除去済み）を pieces に対して左から消費する。
// 返り値 status: "complete" 全一致 / "partial" 入力途中で妥当 / "error" 余分・不正。
//   ti=消費した raw 文字数, kana=確定したかな文字数。
function matchRomajiPieces(raw, pieces) {
  let ti = 0, p = 0, kana = 0;
  while (p < pieces.length) {
    const rest = raw.slice(ti);
    if (rest.length === 0) return { ti, kana, status: "partial" };
    let best = null;
    for (const sp of pieces[p].sp) {
      if (rest.startsWith(sp) && (!best || sp.length > best.length)) best = sp;
    }
    if (best) { ti += best.length; kana += pieces[p].kanaLen; p++; continue; }
    if (pieces[p].sp.some((sp) => sp.startsWith(rest))) return { ti, kana, status: "partial" };
    return { ti, kana, status: "error" };
  }
  return { ti, kana, status: ti === raw.length ? "complete" : "error" };
}

// typed（正規化済み）を canon（訓令式正準）に前方一致させる。
// 撥音 ん は canon では "nn" だが、単独 "n"（次がnでない/末尾）も受理する。
// 返り値: { ci: 一致した canon 文字数, ti: 消費した typed 文字数 }
//   ci → 累積ローマ字長として romajiCum と突き合わせ、かな位置に変換する。
//   ti < typed.length なら未消費の余分入力＝誤り。
function romajiMatchLen(typed, canon) {
  let ti = 0, ci = 0;
  while (ci < canon.length && ti < typed.length) {
    // 撥音: canon "nn" を 単独 "n" で受理（次の typed が n でない時）
    if (canon[ci] === "n" && canon[ci + 1] === "n" &&
        typed[ti] === "n" && typed[ti + 1] !== "n") {
      ti++; ci += 2; continue;
    }
    if (typed[ti] === canon[ci]) { ti++; ci++; continue; }
    break;
  }
  return { ci, ti };
}
