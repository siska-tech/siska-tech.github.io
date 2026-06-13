// =============================================================================
// 効果音(Web Audio API でその場で合成。外部ファイル不要)
// =============================================================================
(function () {
  let ctx = null;
  let muted = localStorage.getItem('naginata-trainer:muted') === '1';

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.15, when = 0, slide = 0 } = {}) {
    if (muted) return;
    try {
      const c = ac();
      const t = c.currentTime + when;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(slide, 1), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* 音が出せない環境では無視 */ }
  }

  function arpeggio(freqs, step = 0.06, dur = 0.1, opts = {}) {
    freqs.forEach((f, i) => tone(f, dur, { type: 'triangle', gain: 0.14, ...opts, when: i * step }));
  }

  // コンボが伸びるほど打鍵音の音程が上がる(C5メジャースケール)
  const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];

  const RANK_FANFARE = {
    S: [523.25, 659.25, 783.99, 1046.5, 1318.5],
    A: [523.25, 659.25, 783.99, 1046.5],
    B: [523.25, 659.25, 783.99],
    C: [523.25, 659.25],
    D: [329.63, 261.63],
  };

  const Sound = {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      localStorage.setItem('naginata-trainer:muted', muted ? '1' : '0');
      return muted;
    },
    // 打鍵音: 基音 + オクターブ上を重ねてキラッとした音に
    hit(combo = 0) {
      const f = SCALE[Math.min(Math.floor(combo / 5), SCALE.length - 1)];
      tone(f, 0.06, { type: 'triangle', gain: 0.13 });
      tone(f * 2, 0.04, { type: 'sine', gain: 0.06 });
    },
    // ミス音: ビープ + 低い「ドン」
    miss() {
      tone(150, 0.18, { type: 'sawtooth', gain: 0.16, slide: 50 });
      tone(60, 0.14, { type: 'square', gain: 0.1, slide: 35 });
    },
    word() {
      arpeggio([659.25, 783.99, 1046.5], 0.055, 0.12);
    },
    // ノーミスでお題クリア
    perfect() {
      arpeggio([1046.5, 1318.5, 1568.0, 2093.0], 0.05, 0.14, { gain: 0.12 });
    },
    combo() {
      arpeggio([1046.5, 1318.5, 1568.0, 2093.0], 0.045, 0.09, { type: 'square', gain: 0.07 });
    },
    finish(rank) {
      arpeggio(RANK_FANFARE[rank] || RANK_FANFARE.C, 0.11, 0.3, { gain: 0.15 });
    },
    best() {
      arpeggio([783.99, 1046.5, 1318.5, 1568.0], 0.08, 0.22, { gain: 0.13 });
    },
    levelup() {
      arpeggio([523.25, 783.99, 1046.5, 1568.0], 0.09, 0.3, { gain: 0.14 });
    },
    // 全お題ノーミスクリア
    allPerfect() {
      arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0], 0.09, 0.34, { gain: 0.14 });
      tone(2093.0, 0.5, { type: 'sine', gain: 0.08, when: 0.54 });
    },
  };

  globalThis.Sound = Sound;
})();
