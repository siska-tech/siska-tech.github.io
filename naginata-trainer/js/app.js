// =============================================================================
// アプリ本体: レッスン選択 → 練習 → 結果
// ゲーミフィケーション: コンボ・スコア・ランク・スター・XP/レベル
// =============================================================================
(function () {
  const $ = (sel) => document.querySelector(sel);

  const views = {
    menu: $('#view-menu'),
    practice: $('#view-practice'),
    result: $('#view-result'),
  };

  const state = {
    lesson: null,
    itemIdx: 0,
    matcher: null,
    mode: 'romaji',    // 'romaji' | 'emu'
    engine: null,      // エミュレーションモードの判定エンジン
    flushTimer: null,  // エンジンの判定窓タイマー
    startTime: null,   // 最初の打鍵で開始
    kanaDone: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    itemMisses: 0, // 現在のお題でのミス数(PERFECT判定用)
    timer: null,
  };

  function showView(name) {
    for (const [k, v] of Object.entries(views)) {
      v.classList.toggle('active', k === name);
    }
  }

  // --- 永続化 -------------------------------------------------------------------
  const LS = {
    best: (id) => `naginata-trainer:best:${id}`,
    xp: 'naginata-trainer:xp',
    imported: 'naginata-trainer:imported',
    mode: 'naginata-trainer:mode',
    emuWindow: 'naginata-trainer:emu-window',
  };

  function getMode() {
    return localStorage.getItem(LS.mode) === 'emu' ? 'emu' : 'romaji';
  }
  function getEmuWindow() {
    const v = Number(localStorage.getItem(LS.emuWindow));
    return v >= 30 && v <= 120 ? v : 60;
  }

  function loadBest(id) {
    try { return JSON.parse(localStorage.getItem(LS.best(id))); }
    catch { return null; }
  }

  function saveBest(id, rec) {
    const prev = loadBest(id);
    if (!prev || rec.score > (prev.score || 0)) {
      localStorage.setItem(LS.best(id), JSON.stringify(rec));
      return true;
    }
    return false;
  }

  function getXp() { return Number(localStorage.getItem(LS.xp)) || 0; }
  function setXp(v) { localStorage.setItem(LS.xp, String(v)); }

  // レベルL到達に必要な累計XP = 100 + 200 + ... + (L-1)*100
  function levelInfo(xp) {
    let level = 1;
    let rest = xp;
    while (rest >= level * 100) { rest -= level * 100; level++; }
    return { level, cur: rest, need: level * 100 };
  }

  function getImported() {
    try { return JSON.parse(localStorage.getItem(LS.imported)) || []; }
    catch { return []; }
  }
  function setImported(arr) { localStorage.setItem(LS.imported, JSON.stringify(arr)); }

  // --- ランク -------------------------------------------------------------------
  // 実効速度 = かな/分 × 正確率^2 で評価
  function rankOf(kpm, acc) {
    const eff = kpm * (acc / 100) ** 2;
    if (eff >= 100) return 'S';
    if (eff >= 70) return 'A';
    if (eff >= 45) return 'B';
    if (eff >= 25) return 'C';
    return 'D';
  }
  const RANK_STARS = { S: 3, A: 3, B: 2, C: 1, D: 0 };
  const RANK_XP_BONUS = { S: 100, A: 60, B: 30, C: 10, D: 0 };

  function starsHtml(n) {
    return '<span class="stars">' +
      [1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : ''}">★</span>`).join('') +
      '</span>';
  }

  // --- メニュー ---------------------------------------------------------------
  function renderLevelBar() {
    const info = levelInfo(getXp());
    $('#menu-level').textContent = `Lv.${info.level}`;
    $('#menu-xp-text').textContent = `${info.cur} / ${info.need} XP`;
    $('#menu-xp-fill').style.width = `${(info.cur / info.need) * 100}%`;
  }

  function lessonCard(lesson) {
    const best = loadBest(lesson.id);
    const card = document.createElement('button');
    card.className = 'lesson-card';
    card.innerHTML =
      `<span class="lesson-title">${esc(lesson.title)} ${best ? starsHtml(best.stars) : ''}</span>` +
      `<span class="lesson-desc">${esc(lesson.desc || '')}</span>` +
      `<span class="lesson-best">${best
        ? `ベスト: ${best.score}点 / ${best.kpm}かな分 / ランク${best.rank}`
        : '未プレイ'}</span>`;
    card.addEventListener('click', () => startLesson(lesson));
    return card;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function renderMenu() {
    renderLevelBar();
    const list = $('#lesson-list');
    list.innerHTML = '';
    for (const lesson of LESSONS) list.appendChild(lessonCard(lesson));

    const impList = $('#imported-list');
    impList.innerHTML = '';
    const imported = getImported();
    $('#imported-section').style.display = imported.length ? '' : 'none';
    for (const lesson of imported) {
      const wrap = document.createElement('div');
      wrap.className = 'imported-wrap';
      wrap.appendChild(lessonCard(lesson));
      const del = document.createElement('button');
      del.className = 'imported-del';
      del.title = 'このお題を削除';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        setImported(getImported().filter((l) => l.id !== lesson.id));
        localStorage.removeItem(LS.best(lesson.id));
        renderMenu();
      });
      wrap.appendChild(del);
      impList.appendChild(wrap);
    }

    $('#custom-start').onclick = () => {
      const text = $('#custom-text').value.trim();
      if (!text) return;
      const items = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      startLesson({ id: 'custom', title: 'カスタム練習', items });
    };
  }

  // --- お題ファイル読み込み -------------------------------------------------------
  function importMsg(text, isError) {
    const el = $('#import-msg');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  }

  async function importFiles(files) {
    let added = 0;
    const errors = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const lessons = parseLessonFile(file.name, text, tokenize);
        if (lessons.length === 0) {
          errors.push(`${file.name}: かなとして読める行がありません`);
          continue;
        }
        setImported(getImported().concat(lessons));
        added += lessons.length;
      } catch (err) {
        errors.push(`${file.name}: 読み込み失敗 (${err.message})`);
      }
    }
    importMsg(
      [added ? `${added} 件のお題を追加しました` : '', ...errors].filter(Boolean).join(' / '),
      errors.length > 0);
    renderMenu();
  }

  function setupImport() {
    const zone = $('#dropzone');
    $('#file-input').addEventListener('change', (e) => {
      importFiles([...e.target.files]);
      e.target.value = '';
    });
    for (const ev of ['dragover', 'dragenter']) {
      zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); });
    }
    for (const ev of ['dragleave', 'drop']) {
      zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); });
    }
    zone.addEventListener('drop', (e) => {
      const files = [...e.dataTransfer.files]
        .filter((f) => /\.(txt|json)$/i.test(f.name));
      if (files.length) importFiles(files);
      else importMsg('.txt / .json ファイルをドロップしてください', true);
    });
  }

  // --- 練習 -------------------------------------------------------------------
  function startLesson(lesson) {
    state.lesson = lesson;
    state.itemIdx = 0;
    state.startTime = null;
    state.kanaDone = 0;
    state.hits = 0;
    state.misses = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.score = 0;
    state.mode = getMode();
    clearTimeout(state.flushTimer);
    state.engine = state.mode === 'emu'
      ? new NaginataEngine({ windowMs: getEmuWindow(), onEmit: handleKana })
      : null;
    $('#practice-title').textContent = lesson.title;
    $('#practice-mode').textContent =
      state.mode === 'emu' ? 'エミュレーション' : 'ローマ字';
    clearInterval(state.timer);
    state.timer = setInterval(updateStats, 250);
    loadItem();
    updateStats();
    showView('practice');
  }

  function loadItem() {
    const item = state.lesson.items[state.itemIdx];
    const units = tokenize(item);
    if (units.length === 0) { nextItem(); return; }
    state.matcher = state.mode === 'emu' ? new KanaMatcher(units) : new Matcher(units);
    state.itemMisses = 0;
    if (state.engine) state.engine.reset();
    $('#practice-progress').textContent =
      `${state.itemIdx + 1} / ${state.lesson.items.length}`;
    renderTarget();
    updateHint();
    updateHighlight();
  }

  // 現在の単位(エミュレーションでは残りかな)に応じたキーボードハイライト
  function updateHighlight() {
    const m = state.matcher;
    let unit = null;
    if (!m.done) {
      if (state.mode === 'emu') {
        const rem = m.remaining();
        unit = { text: rem, keys: KANA_KEYS[rem] || null };
      } else {
        unit = m.current;
      }
    }
    highlightKeys($('#keyboard'), unit);
  }

  function renderTarget() {
    const el = $('#target-text');
    el.innerHTML = '';
    state.matcher.units.forEach((u, i) => {
      const span = document.createElement('span');
      span.textContent = u.text;
      span.className = i < state.matcher.idx ? 'done'
        : i === state.matcher.idx ? 'current' : '';
      el.appendChild(span);
    });
  }

  function keyLabel(k) {
    return k === 'SP' ? 'Space' : k === ';' ? ';' : k.toUpperCase();
  }

  // ローマ字モード: お題全体のローマ字を表示する。未入力部分は「実機が送出する
  // 表記」(= 各単位の第一候補)。入力済み部分は実際にタイプされた表記。
  // エミュレーションモード: 次のかなに必要な同時押しキーを表示する。
  function updateHint() {
    const m = state.matcher;
    const el = $('#romaji-hint');
    if (m.done) { el.innerHTML = ''; return; }
    if (state.mode === 'emu') {
      const rem = m.remaining();
      const keys = KANA_KEYS[rem] || KANA_KEYS[[...rem][0]] || [];
      el.innerHTML =
        `<span class="rest">${rem}</span> ` +
        keys.map((k) => `<span class="emu-key">${keyLabel(k)}</span>`).join('<span class="emu-plus">+</span>') +
        (keys.length > 1 ? '<span class="emu-note">同時押し</span>' : '');
      return;
    }
    const typed = m.committed.join('') + m.buf;
    const rest = m.matchedAlt().slice(m.buf.length) +
      m.units.slice(m.idx + 1).map((u) => u.alts[0]).join('');
    el.innerHTML =
      `<span class="typed">${typed}</span>` +
      `<span class="rest">${rest}</span>`;
  }

  function updateStats() {
    const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
    const min = Math.floor(elapsed / 60);
    const sec = Math.floor(elapsed % 60);
    $('#stat-time').textContent = `${min}:${String(sec).padStart(2, '0')}`;
    $('#stat-kpm').textContent = elapsed > 1
      ? Math.round((state.kanaDone / elapsed) * 60) : '-';
    const total = state.hits + state.misses;
    $('#stat-acc').textContent = total
      ? `${Math.round((state.hits / total) * 100)}%` : '-';
    $('#stat-miss').textContent = state.misses;
    $('#stat-score').textContent = state.score;
    const comboEl = $('#stat-combo');
    comboEl.textContent = state.combo;
    comboEl.classList.toggle('hot', state.combo >= 25);
  }

  // --- 演出 -------------------------------------------------------------------
  function popup(text, cls) {
    const layer = $('#fx-layer');
    const el = document.createElement('span');
    el.className = `fx-pop ${cls || ''}`;
    el.textContent = text;
    el.style.left = `${25 + Math.random() * 50}%`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  function comboMultiplier() {
    return 1 + Math.min(Math.floor(state.combo / 10), 4) * 0.25; // 最大 ×2
  }

  function targetCenter() {
    const r = $('#target-text').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // --- 入力共通処理 -------------------------------------------------------------
  function missFx() {
    state.misses++;
    state.itemMisses++;
    state.combo = 0;
    Sound.miss();
    const t = $('#target-text');
    t.classList.remove('miss-flash');
    void t.offsetWidth;
    t.classList.add('miss-flash');
  }

  // scoreUnits: スコア計算の単位数(ローマ字=1打鍵、エミュ=かな数)
  function hitFx(scoreUnits) {
    state.hits++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += Math.round(10 * comboMultiplier()) * scoreUnits;
    Sound.hit(state.combo);
    if (state.combo > 0 && state.combo % 25 === 0) {
      popup(`${state.combo} COMBO!`, 'fx-combo');
      Sound.combo();
      const c = targetCenter();
      Fx.burst(c.x, c.y - 30, { count: 30, colors: ['#ffb84c', '#ffd700', '#ff8cc0'], speed: 340 });
    }
  }

  // 1入力処理後の画面更新とお題完了判定
  function afterStep() {
    const m = state.matcher;
    if (m.done) {
      const c = targetCenter();
      if (state.itemMisses === 0) {
        const bonus = 100;
        state.score += bonus;
        popup(`PERFECT! +${bonus}`, 'fx-perfect');
        Sound.perfect();
        Fx.burst(c.x, c.y, { count: 44, colors: ['#ffd700', '#fff3b0', '#ffb84c'], speed: 380, size: 6 });
      } else {
        const bonus = 50;
        state.score += bonus;
        popup(`+${bonus}`, 'fx-bonus');
        Sound.word();
        Fx.burst(c.x, c.y, { count: 22 });
      }
      nextItem();
    } else {
      renderTarget();
      updateHint();
      updateHighlight();
    }
    updateStats();
  }

  // --- キー入力(ローマ字モード)---------------------------------------------------
  function inputRomaji(ch) {
    if (!state.startTime) state.startTime = Date.now();
    const m = state.matcher;
    const before = m.idx;
    const result = m.input(ch);
    if (result === 'miss') {
      missFx();
    } else {
      hitFx(1);
    }
    if (m.idx !== before) {
      for (let i = before; i < Math.min(m.idx, m.units.length); i++) {
        state.kanaDone += [...m.units[i].text].length;
      }
    }
    afterStep();
  }

  // --- かな入力(エミュレーションモード: エンジンの onEmit から呼ばれる)-----------
  function handleKana(chunk) {
    if (!views.practice.classList.contains('active')) return;
    if (chunk === ' ') return; // スペースの空振りタップは無視
    const m = state.matcher;
    const result = m.input(chunk);
    if (result === 'miss') {
      missFx();
    } else {
      hitFx(chunk.length);
      state.kanaDone += chunk.length;
    }
    afterStep();
  }

  // エンジンの判定窓が閉じるタイミングで保留分を確定させる
  function scheduleFlush() {
    clearTimeout(state.flushTimer);
    if (!state.engine) return;
    const dl = state.engine.nextDeadline();
    if (dl === null) return;
    state.flushTimer = setTimeout(() => {
      state.engine.flush(performance.now());
      scheduleFlush();
    }, Math.max(0, dl - performance.now()) + 2);
  }

  function onKeyDown(e) {
    if (!views.practice.classList.contains('active')) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (e.key === 'Escape') { backToMenu(); return; }
    // 実機は 、。の後に Enter(IME確定)を送出するため Enter は無視する
    if (e.key === 'Enter') { e.preventDefault(); return; }

    if (state.mode === 'emu') {
      const key = CODE2KEY[e.code];
      if (!key) return;
      e.preventDefault();
      if (!state.startTime) state.startTime = Date.now();
      state.engine.keydown(key, performance.now());
      scheduleFlush();
      return;
    }

    if (e.key.length !== 1) return;
    e.preventDefault();
    const ch = e.key.toLowerCase();
    if (!/[a-z0-9,.\-!?';:[\]\/ ]/.test(ch)) return;
    if (ch === ' ') return; // センターシフトの空振りタップは無視
    inputRomaji(ch);
  }

  function onKeyUp(e) {
    if (state.mode !== 'emu' || !state.engine) return;
    if (!views.practice.classList.contains('active')) return;
    const key = CODE2KEY[e.code];
    if (!key) return;
    state.engine.keyup(key, performance.now());
    scheduleFlush();
  }

  function nextItem() {
    state.itemIdx++;
    if (state.itemIdx >= state.lesson.items.length) {
      finishLesson();
    } else {
      loadItem();
    }
  }

  // --- 結果 -------------------------------------------------------------------
  function finishLesson() {
    clearInterval(state.timer);
    const elapsed = state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
    const kpm = elapsed > 0 ? Math.round((state.kanaDone / elapsed) * 60) : 0;
    const total = state.hits + state.misses;
    const acc = total ? Math.round((state.hits / total) * 100) : 100;
    const rank = rankOf(kpm, acc);
    const stars = RANK_STARS[rank];

    $('#result-kpm').textContent = kpm;
    $('#result-acc').textContent = `${acc}%`;
    $('#result-miss').textContent = state.misses;
    $('#result-time').textContent = `${elapsed.toFixed(1)} 秒`;
    $('#result-score').textContent = state.score;
    $('#result-combo').textContent = state.maxCombo;
    const rankEl = $('#result-rank');
    rankEl.textContent = rank;
    rankEl.className = `rank rank-${rank.toLowerCase()}`;
    $('#result-stars').innerHTML = starsHtml(stars);

    // XP・レベル
    const gained = Math.round(state.score / 10) + RANK_XP_BONUS[rank];
    const beforeLv = levelInfo(getXp()).level;
    setXp(getXp() + gained);
    const info = levelInfo(getXp());
    $('#result-xp-gain').textContent = `+${gained} XP`;
    $('#result-level').textContent = `Lv.${info.level}`;
    $('#result-xp-fill').style.width = `${(info.cur / info.need) * 100}%`;
    $('#result-xp-text').textContent = `${info.cur} / ${info.need} XP`;
    const leveledUp = info.level > beforeLv;
    $('#result-levelup').textContent = leveledUp ? '🎉 レベルアップ!' : '';

    const isBest = state.lesson.id !== 'custom' &&
      saveBest(state.lesson.id, { kpm, acc, score: state.score, rank, stars });
    $('#result-best').textContent = isBest ? '🏆 自己ベスト更新!' : '';

    const allPerfect = state.misses === 0;
    $('#result-perfect').textContent = allPerfect ? '✨ ALL PERFECT! ✨' : '';

    showView('result');
    Sound.finish(rank);
    if (allPerfect) {
      Fx.confetti({ count: 200, duration: 2600 });
      setTimeout(() => Sound.allPerfect(), 600);
    } else if (rank === 'S') {
      Fx.confetti();
    }
    if (leveledUp) setTimeout(() => Sound.levelup(), allPerfect ? 1400 : 700);
    else if (isBest) setTimeout(() => Sound.best(), allPerfect ? 1400 : 700);
  }

  function backToMenu() {
    clearInterval(state.timer);
    clearTimeout(state.flushTimer);
    if (state.engine) state.engine.reset();
    renderMenu();
    showView('menu');
  }

  // --- 入力モード設定 -------------------------------------------------------------
  function setupMode() {
    const radios = document.querySelectorAll('input[name="mode"]');
    for (const r of radios) {
      r.checked = r.value === getMode();
      r.addEventListener('change', () => {
        localStorage.setItem(LS.mode, r.value);
        updateModeUI();
      });
    }
    const slider = $('#emu-window');
    slider.value = getEmuWindow();
    $('#emu-window-val').textContent = slider.value;
    slider.addEventListener('input', () => {
      localStorage.setItem(LS.emuWindow, slider.value);
      $('#emu-window-val').textContent = slider.value;
    });
    updateModeUI();
  }

  function updateModeUI() {
    $('#emu-options').style.display = getMode() === 'emu' ? '' : 'none';
  }

  // --- IME 検出 ----------------------------------------------------------------
  document.addEventListener('compositionstart', () => {
    $('#ime-warning').classList.add('show');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Process' || e.keyCode === 229) {
      $('#ime-warning').classList.add('show');
    }
  }, true);

  // --- 初期化 -------------------------------------------------------------------
  function updateSoundBtn() {
    $('#btn-sound').textContent = Sound.muted ? '🔇' : '🔊';
    $('#btn-sound').title = Sound.muted ? '効果音をオンにする' : '効果音をオフにする';
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    // フォーカス喪失で keyup を取りこぼすためエンジンを初期化する
    clearTimeout(state.flushTimer);
    if (state.engine) state.engine.reset();
  });
  $('#btn-back').addEventListener('click', backToMenu);
  $('#btn-restart').addEventListener('click', () => startLesson(state.lesson));
  $('#result-retry').addEventListener('click', () => startLesson(state.lesson));
  $('#result-menu').addEventListener('click', backToMenu);
  $('#btn-sound').addEventListener('click', () => { Sound.toggle(); updateSoundBtn(); });
  $('#ime-warning .close').addEventListener('click', () => {
    $('#ime-warning').classList.remove('show');
  });

  setupImport();
  setupMode();
  updateSoundBtn();
  renderKeyboard($('#keyboard'));
  renderMenu();
  showView('menu');
})();
