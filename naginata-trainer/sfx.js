// =============================================================================
// 効果音（WebAudio で生成。外部音源ファイル不要 / file:// でも動作）
// はっきり聞き分けられるよう、成功=明るい上昇音、失敗=濁ったブザー、
// クリア=アルペジオのファンファーレにしている。
// =============================================================================
const SFX = (function () {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function resume() {
    if (!enabled) return;
    const c = ac();
    if (c.state === "suspended") c.resume();
  }

  // 1音。freq:Hz, dur:s, type, gain, delay:s
  function note(freq, dur, type, gain, delay) {
    const c = ac();
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005); // 立ち上がり
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // 周波数を滑らかに変える1音（スライド）
  function slide(f0, f1, dur, type, gain) {
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  return {
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },
    resume,
    // 打鍵成功: 明るい2音の上昇（ピコッ）
    success() {
      if (!enabled) return;
      note(784, 0.07, "triangle", 0.32, 0);      // G5
      note(1175, 0.11, "triangle", 0.30, 0.045); // D6
    },
    // 打鍵失敗: 濁った下降ブザー
    fail() {
      if (!enabled) return;
      slide(220, 110, 0.22, "sawtooth", 0.30);
      note(98, 0.22, "square", 0.18, 0);
    },
    // お題クリア: 上昇アルペジオ
    complete() {
      if (!enabled) return;
      const seq = [523, 659, 784, 1047]; // C5 E5 G5 C6
      seq.forEach((f, i) => note(f, 0.16, "triangle", 0.30, i * 0.085));
    },
  };
})();
