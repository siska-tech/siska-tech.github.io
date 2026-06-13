// =============================================================================
// 薙刀式エミュレーションエンジン
// 通常のQWERTYキーボードの keydown/keyup から、実機ファームウェアの
// 同時打鍵判定(大岡式遅延確定)を簡易再現してかなを生成する。
// 変換テーブルは data.js の KANA_KEYS(かな→押下キー)を逆引きして構築。
// 時刻は引数で受け取る(ブラウザでは performance.now()、テストでは任意値)。
// =============================================================================
(function () {
  const D = typeof module !== 'undefined'
    ? require('./data.js')
    : { KANA_KEYS };

  // シフト能力キー: スペース(センター) / f・j(濁音) / v・m(半濁音) / q(小書き)
  const SHIFT_KEYS = new Set(['SP', 'f', 'j', 'v', 'm', 'q']);

  // 実機ではIME切替・Enterになる組み合わせ(かなを出さない)
  const IGNORE_PAIRS = new Set(['f,g', 'j,h', 'v,m']);

  // KANA_KEYS の逆引きテーブル
  const SINGLE = { SP: ' ' };       // 単打(タップ)
  const LAYER = {};                 // LAYER[シフトキー][ベースキー] = かな
  for (const s of SHIFT_KEYS) LAYER[s] = {};
  const COMBO2 = new Map();         // 'a,b'(ソート済み) → かな
  const COMBO3 = [];                // [keys[3], かな]
  for (const [kana, keys] of Object.entries(D.KANA_KEYS)) {
    if (keys.length === 1) {
      SINGLE[keys[0]] = kana;
    } else if (keys.length === 2) {
      if (SHIFT_KEYS.has(keys[0])) LAYER[keys[0]][keys[1]] = kana;
      else COMBO2.set([...keys].sort().join(','), kana);
    } else {
      COMBO3.push([keys, kana]);
    }
  }

  const RELEVANT = new Set([
    ...Object.keys(SINGLE), ...SHIFT_KEYS,
    ...Object.values(LAYER).flatMap((m) => Object.keys(m)), // u などレイヤ面のみのキー
    ...COMBO3.flatMap(([keys]) => keys),
  ]);

  // KeyboardEvent.code → エンジンのキー名(OSのキー配列設定に依存しない)
  const CODE2KEY = {
    KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r',
    KeyI: 'i', KeyO: 'o', KeyP: 'p',
    KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f', KeyG: 'g',
    KeyH: 'h', KeyJ: 'j', KeyK: 'k', KeyL: 'l', Semicolon: ';',
    KeyZ: 'z', KeyX: 'x', KeyC: 'c', KeyV: 'v', KeyB: 'b',
    KeyN: 'n', KeyM: 'm', Comma: ',', Period: '.', Slash: '/',
    Space: 'SP',
  };

  class NaginataEngine {
    constructor({ windowMs = 60, tapMs = 200, onEmit = () => {} } = {}) {
      this.windowMs = windowMs; // 同時押しとみなすキー間隔(実機は40ms)
      this.tapMs = tapMs;       // シフトキー単独タップとみなす押下時間の上限
      this.onEmit = onEmit;
      this.reset();
    }

    reset() {
      this.down = new Map();   // key → { t, used }
      this.pending = [];       // 未確定のキー(押下順)
      this.lastDownT = 0;
    }

    keydown(key, t) {
      if (!RELEVANT.has(key) || this.down.has(key)) return;
      this.flush(t); // 窓が閉じた保留分を先に確定(遅い連続打鍵を分離)
      this.down.set(key, { t, used: false });
      this.pending.push(key);
      this.lastDownT = t;
    }

    keyup(key, t) {
      if (!this.down.has(key)) return;
      this.flush(t);
      if (this.pending.includes(key)) {
        if (this.pending.length === 1 && SHIFT_KEYS.has(key)) {
          // シフトキー単独: タップなら単打かなを出す
          const info = this.down.get(key);
          if (!info.used && t - info.t <= this.tapMs) this._emit(SINGLE[key]);
        } else {
          this._resolve(); // キーを離した時点でチョード確定
        }
      }
      this.pending = this.pending.filter((k) => k !== key);
      this.down.delete(key);
    }

    // 判定窓の締め切り時刻(無ければ null)
    nextDeadline() {
      if (this.pending.length === 0) return null;
      if (this.pending.length === 1 && SHIFT_KEYS.has(this.pending[0])) return null;
      return this.lastDownT + this.windowMs;
    }

    // 締め切りを過ぎた保留分を確定する
    flush(t) {
      const dl = this.nextDeadline();
      if (dl !== null && t >= dl) this._resolve();
    }

    _emit(kana) {
      if (kana) this.onEmit(kana);
    }

    _markUsed(keys) {
      for (const k of keys) if (this.down.has(k)) this.down.get(k).used = true;
    }

    _resolve() {
      const nonShift = this.pending.filter((k) => !SHIFT_KEYS.has(k));
      const downShifts = [...this.down.keys()]
        .filter((k) => SHIFT_KEYS.has(k))
        .sort((a, b) => this.down.get(a).t - this.down.get(b).t);

      // 1) 3キーコンボ(外来音・濁音拗音など)
      //    保留中の非シフトキーをすべて含み、残りメンバが押下中のキーで賄える組
      for (const [keys, kana] of COMBO3) {
        if (nonShift.every((k) => keys.includes(k)) &&
            keys.some((k) => this.pending.includes(k)) &&
            keys.every((k) => this.pending.includes(k) || downShifts.includes(k))) {
          this._emit(kana);
          this._markUsed(keys);
          this.pending = this.pending.filter((k) => !keys.includes(k));
          return;
        }
      }

      // 2) 2キーコンボ(清音拗音)
      if (nonShift.length === 2) {
        const kana = COMBO2.get([...nonShift].sort().join(','));
        if (kana) {
          this._emit(kana);
          this.pending = this.pending.filter((k) => !nonShift.includes(k));
          return;
        }
      }

      // 3) 全員シフト能力キーのチョード(例: j+f=が、SP+v=、)
      //    いずれかをシフト、残りをベースとして解決できる組み合わせを探す
      if (nonShift.length === 0) {
        if (this.pending.length < 2) return; // シフト単独は保留継続
        for (const s of this.pending) {
          const others = this.pending.filter((k) => k !== s);
          if (others.every((o) => LAYER[s][o])) {
            for (const o of others) this._emit(LAYER[s][o]);
            this._markUsed([s, ...others]);
            this.pending = this.pending.filter((k) => k === s);
            return;
          }
        }
        // 解決不能な全シフトチョードは何も出さない(実機相当の空振り)
        const first = this.pending[0];
        this._markUsed(this.pending);
        this.pending = [first];
        return;
      }

      // 4) レイヤ(押下中シフト + ベースキー) / 単打
      for (const base of nonShift) {
        let out = null;
        let ignore = false;
        for (const s of downShifts) {
          if (LAYER[s][base]) {
            out = LAYER[s][base];
            this._markUsed([s]);
            break;
          }
          if (IGNORE_PAIRS.has(`${s},${base}`)) {
            ignore = true;
            this._markUsed([s]);
            break;
          }
        }
        if (!out && !ignore) out = SINGLE[base];
        this._emit(out);
      }
      this.pending = this.pending.filter((k) => !nonShift.includes(k));
    }
  }

  // かな列を直接照合するマッチャ(エミュレーションモード用)
  class KanaMatcher {
    constructor(units) {
      this.units = units;
      this.text = units.map((u) => u.text).join('');
      this.pos = 0;
      this.bounds = [];
      let acc = 0;
      for (const u of units) { acc += u.text.length; this.bounds.push(acc); }
    }

    get done() { return this.pos >= this.text.length; }

    get idx() {
      for (let i = 0; i < this.bounds.length; i++) {
        if (this.pos < this.bounds[i]) return i;
      }
      return this.units.length;
    }

    // 現在の単位の残りかな(キーガイド表示用)
    remaining() {
      const i = this.idx;
      if (i >= this.units.length) return '';
      const start = i > 0 ? this.bounds[i - 1] : 0;
      return this.units[i].text.slice(this.pos - start);
    }

    // かなチャンク(1〜2文字)を照合。'ok' | 'all' | 'miss'
    input(chunk) {
      if (this.done) return 'miss';
      if (this.text.startsWith(chunk, this.pos)) {
        this.pos += chunk.length;
        return this.done ? 'all' : 'ok';
      }
      return 'miss';
    }
  }

  const api = { NaginataEngine, KanaMatcher, CODE2KEY };
  if (typeof module !== 'undefined') module.exports = api;
  else Object.assign(globalThis, api);
})();
