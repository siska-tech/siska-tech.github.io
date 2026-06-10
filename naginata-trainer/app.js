// =============================================================================
// 薙刀式トレーナー アプリ本体
// =============================================================================

const $ = (sel) => document.querySelector(sel);

// --- 永続化（苦手キー適応用の単位別統計）------------------------------------
const STORE_KEY = "naginata-trainer-stats-v1";
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveStats() { localStorage.setItem(STORE_KEY, JSON.stringify(unitStats)); }
let unitStats = loadStats(); // unitStats[kana] = { n, err, ms }
function recordUnit(kana, ok, ms) {
  const s = (unitStats[kana] ||= { n: 0, err: 0, ms: 0 });
  s.n++; if (!ok) s.err++; if (ok) s.ms += ms;
  saveStats();
}
function difficulty(kana) {
  const s = unitStats[kana];
  if (!s || s.n === 0) return 0.5;
  const errRate = s.err / s.n;
  const avgMs = s.ms && (s.n - s.err) ? s.ms / (s.n - s.err) : 1500;
  return 0.15 + errRate * 1.5 + Math.min(1, avgMs / 3000) * 0.6;
}
function weightedPick(pool, weightFn) {
  const ws = pool.map(weightFn);
  const total = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// =============================================================================
// モード / 判定方式
// =============================================================================
const MODES = {
  drill:  { label: "暗記ドリル", pools: ["seion"] },
  text:   { label: "連続入力",   pools: null },
  chord:  { label: "同時打鍵",   pools: ["dakuon", "handakuon", "youon", "gairai"] },
  weak:   { label: "苦手重点",   pools: ["seion", "dakuon", "handakuon", "youon", "gairai", "small"] },
};
let mode = "text";
let judge = "position"; // "position" | "romaji"(IMEオフ) | "ime"(実機・IME経由)

let lessons = LESSONS.slice();

// --- 現在のお題 --------------------------------------------------------------
let units = [];        // [{kana, keys, cat, shifts}]
let pos = 0;
let unitStartTime = 0;
let firstTryOk = true;
let targetKana = "";       // units を連結した判定用かな列
let romajiTarget = "";     // targetKana の正準ローマ字（ヒント表示用）
let romajiCum = [];        // かな各文字までの累積ローマ字長
let romajiPieceArr = [];   // 打鍵モーラ分解（自動訂正の照合用）

// 連続入力系（romaji/ime）の進捗トラッキング（かな文字単位）
let lastKana = 0;
let lastErrored = false;
let lastGoodRaw = "";      // romaji: 直近の妥当な入力（誤打の自動取り消し用）
let confirmedRaw = "";     // romaji: 確定（完了モーラ）までの入力。これ以前は削除保護

let sess = null;
function resetSession() { sess = { correct: 0, miss: 0, start: 0, started: false }; updateStats(); }

// =============================================================================
// お題生成
// =============================================================================
function makeUnit(kana) {
  const info = KANA2KEYS[kana];
  return { kana, keys: info.keys, cat: info.cat, shifts: info.shifts };
}

function nextChallenge() {
  if (mode === "text") {
    const lesson = lessons[+$("#lesson").value] || lessons[0];
    const text = lesson.items[Math.floor(Math.random() * lesson.items.length)];
    units = tokenize(text).map(makeUnit);
  } else {
    const pool = MODES[mode].pools.flatMap((p) => POOL[p]);
    const weightFn = (mode === "weak") ? difficulty : () => 1;
    units = Array.from({ length: 12 }, () => makeUnit(weightedPick(pool, weightFn)));
  }
  targetKana = units.map((u) => u.kana).join("");
  if (judge === "romaji") {
    const rc = romajiCumulative(targetKana);
    romajiTarget = rc.romaji;
    romajiCum = rc.cum;
    romajiPieceArr = romajiPieces(targetKana);
  }
  pos = 0;
  firstTryOk = true;
  unitStartTime = performance.now();
  resetTypingInput();
  render();
}

// =============================================================================
// 描画
// =============================================================================
function buildKeyboard() {
  const make = (handName) => {
    const hand = document.createElement("div");
    hand.className = "hand " + handName;
    for (const row of KEYBOARD_ROWS[handName]) {
      const r = document.createElement("div");
      r.className = "krow";
      for (const sc of row) {
        const k = document.createElement("div");
        k.className = "key" + (SHIFT_SC.has(sc) ? " shiftcap" : "");
        k.dataset.sc = sc;
        k.innerHTML = `<span class="qw">${SC_QWERTY[sc]}</span>` +
          `<span class="ka">${SINGLE_KANA[sc] || ""}</span>`;
        r.appendChild(k);
      }
      hand.appendChild(r);
    }
    const tr = document.createElement("div");
    tr.className = "krow thumb";
    const sp = document.createElement("div");
    sp.className = "key space shiftcap";
    sp.dataset.sc = 0x39;
    sp.innerHTML = `<span class="qw">␣ shift</span>`;
    tr.appendChild(sp);
    hand.appendChild(tr);
    return hand;
  };
  const kb = $("#kbd");
  kb.innerHTML = "";
  kb.appendChild(make("left"));
  kb.appendChild(make("right"));
}

function keyEls(sc) { return document.querySelectorAll(`.key[data-sc="${sc}"]`); }

function render() {
  const line = $("#promptLine");
  line.classList.toggle("spaced", mode !== "text"); // ドリルは単位を離して表示
  line.innerHTML = "";
  units.forEach((u, i) => {
    const span = document.createElement("span");
    span.textContent = u.kana;
    span.className = i < pos ? "done" : i === pos ? "cur" : "todo";
    line.appendChild(span);
  });
  highlightExpected();
  if (judge === "position") showHeld();
  else updateKeyLabels(); // 実機モード: 現在のお題のレイヤーを表示
}

function clearKeyHints() {
  document.querySelectorAll(".key").forEach((k) => k.classList.remove("exp-base", "exp-shift"));
}

function highlightExpected() {
  clearKeyHints();
  const u = units[pos];
  const showHint = $("#showhint").checked;
  if (!u || !showHint) { renderHintText(u && showHint ? u : null); return; }
  const shiftSet = new Set(u.shifts);
  for (const sc of u.keys) {
    keyEls(sc).forEach((el) => el.classList.add(shiftSet.has(sc) ? "exp-shift" : "exp-base"));
  }
  renderHintText(u);
}

function renderHintText(u) {
  const h = $("#hint");
  if (!u) { h.innerHTML = ""; return; }
  const shiftSet = new Set(u.shifts);
  const chips = u.keys.map((sc) =>
    `<span class="chip ${shiftSet.has(sc) ? "shift" : "base"}">${SC_QWERTY[sc]}</span>`).join("");
  const sameTime = u.keys.length > 1 ? "<b>同時に</b> " : "";
  let extra = "";
  if (judge === "romaji") {
    // 現在位置からの残りローマ字（正準）を表示
    let off = 0;
    for (let i = 0; i < pos; i++) off += units[i].kana.length;
    const doneLen = off > 0 ? romajiCum[off - 1] : 0;
    const done = romajiTarget.slice(0, doneLen);
    const rest = romajiTarget.slice(doneLen);
    extra = `<span>ローマ字: <span class="rdone">${done}</span><b>${rest}</b></span>`;
  }
  h.innerHTML = `<span>次: <b style="font-size:18px">${u.kana}</b></span>` +
    `<span>${sameTime}${chips}</span>${extra}`;
}

function showHeld() {
  document.querySelectorAll(".key.held").forEach((k) => k.classList.remove("held"));
  for (const sc of held) keyEls(sc).forEach((el) => el.classList.add("held"));
}

// かな確定時にキー図を光らせる（位置モードの手応えを全モードで共有）
function pulseKeys(scList) {
  for (const sc of scList) keyEls(sc).forEach((el) => {
    el.classList.remove("pressed");
    void el.offsetWidth; // アニメ再起動
    el.classList.add("pressed");
    setTimeout(() => el.classList.remove("pressed"), 300);
  });
}
function pulseUnits(from, to) {
  for (let i = from; i < to && i < units.length; i++) pulseKeys(units[i].keys);
}

function updateStats() {
  $("#stCorrect").textContent = sess.correct;
  $("#stMiss").textContent = sess.miss;
  const total = sess.correct + sess.miss;
  $("#stAcc").textContent = (total ? Math.round((sess.correct / total) * 100) : 100) + "%";
  let kpm = 0;
  if (sess.started) {
    const min = (performance.now() - sess.start) / 60000;
    if (min > 0) kpm = Math.round(sess.correct / min);
  }
  $("#stKpm").textContent = kpm;
}

function flashBad() {
  const cur = document.querySelector(".prompt-line .cur");
  if (!cur) return;
  cur.classList.add("bad");
  setTimeout(() => cur && cur.classList.remove("bad"), 200);
}

// =============================================================================
// 判定A: 物理キー位置（同時打鍵コード検出）
// =============================================================================
let held = new Set();
let accum = new Set();
let chordActive = false;
let chordTimer = null;
let windowMs = 50;

function onKeyDown(e) {
  if (judge !== "position") return; // 他モードは入力欄に任せる
  const sc = CODE2SC[e.code];
  if (sc === undefined) return;
  e.preventDefault();
  SFX.resume();
  if (e.repeat) return;
  held.add(sc); accum.add(sc);
  showHeld(); updateKeyLabels();
  if (!chordActive) { chordActive = true; chordTimer = setTimeout(finalizeChord, windowMs); }
}

function onKeyUp(e) {
  if (judge !== "position") return;
  const sc = CODE2SC[e.code];
  if (sc === undefined) return;
  held.delete(sc);
  showHeld(); updateKeyLabels();
  if (chordActive && held.size === 0 && chordTimer) {
    clearTimeout(chordTimer); chordTimer = null; finalizeChord();
  }
}

function finalizeChord() {
  chordTimer = null;
  const chord = new Set(accum);
  accum = new Set();
  chordActive = false;
  if (chord.size > 0) evaluateChord(chord);
}

function setEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function evaluateChord(chord) {
  const u = units[pos];
  if (!u) return;
  if (!sess.started) { sess.started = true; sess.start = performance.now(); }
  const ok = setEqual(chord, new Set(u.keys));
  const ms = performance.now() - unitStartTime;
  if (ok) {
    sess.correct += u.kana.length;
    recordUnit(u.kana, firstTryOk, ms);
    pulseKeys(u.keys);
    pos++; firstTryOk = true; unitStartTime = performance.now();
    SFX.success();
    if (pos >= units.length) { SFX.complete(); updateStats(); setTimeout(nextChallenge, 320); return; }
    render();
  } else {
    sess.miss++; firstTryOk = false;
    recordUnit(u.kana, false, ms);
    SFX.fail(); flashBad();
  }
  updateStats();
}

// =============================================================================
// 判定B/C: 連続入力（入力欄を読む）— かな文字単位で進捗判定
//   ime    : 実機がローマ字HID出力→ホストIMEがかな化した結果（IME ON, 変換しない）
//   romaji : IMEオフのローマ字をそのまま（ヘボン式も許容）
// =============================================================================
function resetTypingInput() {
  const inp = $("#typeInput");
  if (inp) inp.value = "";
  lastKana = 0;
  lastErrored = false;
  lastGoodRaw = "";
  confirmedRaw = "";
}

// 確定済み文字を消そうとした時の合図（入力欄を一瞬光らせる）
function flashInput() {
  const inp = $("#typeInput");
  inp.classList.remove("flash");
  void inp.offsetWidth;
  inp.classList.add("flash");
  setTimeout(() => inp.classList.remove("flash"), 300);
}

function commonPrefixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
function unitIndexAt(charLen) { // かな文字数 → 単位インデックス
  let n = 0, idx = 0;
  for (; idx < units.length; idx++) { n += units[idx].kana.length; if (n > charLen) break; }
  return idx;
}

// かな文字進捗 kanaMatched と「余分入力エラー有無」から、得点・音・描画を更新
function applyLinearProgress(kanaMatched, hasError) {
  const oldPos = pos;
  if (kanaMatched > lastKana) {
    sess.correct += (kanaMatched - lastKana);
    lastKana = kanaMatched;
    lastErrored = false;
    SFX.success();
  } else if (hasError && !lastErrored) {
    sess.miss++;
    lastErrored = true;
    SFX.fail(); flashBad();
  } else if (!hasError) {
    lastErrored = false;
  }
  pos = unitIndexAt(kanaMatched);
  if (pos > oldPos) pulseUnits(oldPos, pos);
  render();
  updateStats();
  if (kanaMatched === targetKana.length && targetKana.length > 0) {
    SFX.complete();
    setTimeout(nextChallenge, 320);
  }
}

function onTypeInput() {
  if (judge === "ime") return handleIme();
  if (judge === "romaji") return handleRomaji();
}

function handleIme() {
  const inp = $("#typeInput");
  let value = inp.value.replace(/[ 　]/g, "");
  if (inp.value !== value) inp.value = value;

  // 末尾の未確定ローマ字を除いたかな列
  let kana = value.replace(/[a-zA-Z]+$/u, "");
  const romajiTail = value.slice(kana.length);

  // 確定済み（正解済み）かなの削除保護: 確定領域が崩れたら復元する
  const confirmed = targetKana.slice(0, lastKana);
  if (kana.length < confirmed.length || kana.slice(0, confirmed.length) !== confirmed) {
    value = confirmed + romajiTail;
    inp.value = value;
    kana = confirmed;
    flashInput();
  }

  if (!sess.started && kana.length) { sess.started = true; sess.start = performance.now(); }
  const matched = commonPrefixLen(kana, targetKana);
  applyLinearProgress(matched, kana.length > matched);
}

// ローマ字モード: 1打ごとに判定し、誤打は入力欄から自動で取り消す（BS不要）。
function handleRomaji() {
  const inp = $("#typeInput");
  let raw = inp.value.replace(/[ 　]/g, "").toLowerCase();
  if (inp.value !== raw) inp.value = raw; // 空白・大文字を即時除去

  // 確定済み（完了モーラ）の削除保護: 確定領域が削られたら復元する
  if (!raw.startsWith(confirmedRaw)) {
    inp.value = confirmedRaw;
    flashInput();
    return;
  }

  const res = matchRomajiPieces(raw, romajiPieceArr);

  if (res.status === "error") {       // 不正な打鍵 → 直前の妥当状態へ戻す
    inp.value = lastGoodRaw;
    sess.miss++;
    SFX.fail(); flashBad();
    updateStats();
    return;
  }
  lastGoodRaw = raw;
  confirmedRaw = raw.slice(0, res.ti); // 完了モーラまでを確定（以後は削除保護）
  if (!sess.started && raw.length) { sess.started = true; sess.start = performance.now(); }

  const oldPos = pos;
  if (res.kana > lastKana) {           // 新たにかなが確定
    sess.correct += (res.kana - lastKana);
    lastKana = res.kana;
    SFX.success();
  }
  pos = unitIndexAt(res.kana);
  if (pos > oldPos) pulseUnits(oldPos, pos);
  render();
  updateStats();
  if (res.status === "complete") { SFX.complete(); setTimeout(nextChallenge, 320); }
}

// レイヤーキー（保持シフトsc列）→ 面の名前
const LAYER_NAME = {
  "": "単打", [SHIFT.CENTER]: "センターシフト",
  [SHIFT.L_THUMB]: "濁音（右手）", [SHIFT.R_THUMB]: "濁音（左手）",
  [SHIFT.L_MID]: "半濁音（右手）", [SHIFT.R_MID]: "半濁音（左手）",
  [SHIFT.A_KEY]: "小書き",
};

// お題のかなが属する面のレイヤーキー（実シフト集合）を返す。
// 拗音・外来音は同時押しで shifts=[] のため単打面になる。
function layerKeyForUnit(u) {
  return u ? u.shifts.slice().sort((a, b) => a - b).join(",") : "";
}

let kbdBaseNote = "";

// キー図のかなラベルを切り替える。
//   位置判定: 実際に保持中のシフトキーのレイヤー。
//   実機モード: 現在のお題のかなが属するレイヤー（シフト面のキーマップが見える）。
function updateKeyLabels() {
  let key;
  if (judge === "position") {
    key = [...held].filter((sc) => SHIFT_SC.has(sc)).sort((a, b) => a - b).join(",");
  } else {
    key = layerKeyForUnit(units[pos]);
  }
  const map = LAYER_KANA[key] || LAYER_KANA[""] || {};
  document.querySelectorAll(".key").forEach((k) => {
    const ka = k.querySelector(".ka");
    if (ka) ka.textContent = map[+k.dataset.sc] || "";
  });
  // 面の名前を表示
  const name = LAYER_NAME[key] || "単打";
  $("#kbdNote").textContent = (key && key !== "")
    ? `${kbdBaseNote}　｜　表示中: ${name}面`
    : kbdBaseNote;
}

// =============================================================================
// カスタム読込
// =============================================================================
function populateLessonSelect() {
  const sel = $("#lesson");
  sel.innerHTML = "";
  lessons.forEach((l, i) => {
    const o = document.createElement("option");
    o.value = i; o.textContent = l.title;
    sel.appendChild(o);
  });
}

function loadLessonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseLessonFile(file.name, reader.result);
      if (!parsed.length) throw new Error("有効なレッスンがありません");
      lessons = parsed;
      populateLessonSelect();
      if (mode === "text") nextChallenge();
      alert(`例文を読み込みました（${parsed.length} レッスン）。`);
    } catch (e) { alert("読込失敗: " + e.message); }
  };
  reader.readAsText(file);
}

function loadKeymapFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyCustomKeymap(JSON.parse(reader.result));
      buildKeyboard();
      nextChallenge();
      alert("配列(キーマップ)を差し替えました。");
    } catch (e) { alert("配列読込失敗: " + e.message); }
  };
  reader.readAsText(file);
}

// =============================================================================
// 配線
// =============================================================================
function applyJudgeUI() {
  const typing = judge !== "position";
  $("#typeWrap").style.display = typing ? "block" : "none";
  $("#windowWrap").style.opacity = (judge === "position") ? 1 : 0.4;
  const inp = $("#typeInput");
  inp.placeholder = judge === "ime"
    ? "実機で入力（IMEをON / 変換せずそのまま打鍵）"
    : "ローマ字で入力（IMEはオフ）";
  kbdBaseNote = judge === "position"
    ? "緑=ベースキー / 橙=シフトキー。判定窓内に同時押し。"
    : (judge === "ime"
        ? "実機(IME)モード: IMEをONにし変換せず打鍵。キー図は今のかなの面を表示。"
        : "ローマ字モード: IMEオフでローマ字入力（ヘボン式可）。キー図は今のかなの面を表示。");
  $("#kbdNote").textContent = kbdBaseNote;
  // 非positionでは押下ハイライトを消し、ラベルを単打面へ戻す
  if (typing) { held.clear(); document.querySelectorAll(".key.held").forEach((k) => k.classList.remove("held")); }
  updateKeyLabels();
  if (typing) setTimeout(() => inp.focus(), 0);
}

function selectMode(m) {
  mode = m;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === m));
  $("#lessonWrap").style.display = (m === "text") ? "flex" : "none";
  resetSession();
  nextChallenge();
}

function init() {
  buildKeyboard();
  populateLessonSelect();
  $("#lesson").value = "4"; // 既定で実文（清音の短文）を表示し、例文が見えるようにする
  resetSession();

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => selectMode(t.dataset.mode)));

  $("#lesson").addEventListener("change", nextChallenge);
  $("#skip").addEventListener("click", nextChallenge);
  $("#showhint").addEventListener("change", () => highlightExpected());

  $("#judge").addEventListener("change", (e) => {
    judge = e.target.value;
    applyJudgeUI();
    resetSession();
    nextChallenge();
  });

  $("#sound").addEventListener("change", (e) => SFX.setEnabled(e.target.checked));
  $("#typeInput").addEventListener("input", onTypeInput);

  $("#lessonFile").addEventListener("change", (e) => {
    if (e.target.files[0]) loadLessonFile(e.target.files[0]); e.target.value = "";
  });
  $("#keymapFile").addEventListener("change", (e) => {
    if (e.target.files[0]) loadKeymapFile(e.target.files[0]); e.target.value = "";
  });
  $("#resetStats").addEventListener("click", () => {
    if (confirm("苦手キーの学習データを消去しますか？")) { unitStats = {}; saveStats(); alert("消去しました。"); }
  });

  const win = $("#window");
  const syncWin = () => { windowMs = +win.value; $("#windowVal").textContent = windowMs + "ms"; };
  win.addEventListener("input", syncWin); syncWin();

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  applyJudgeUI();
  selectMode("text");
}

document.addEventListener("DOMContentLoaded", init);
