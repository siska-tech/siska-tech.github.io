// =============================================================================
// ローマ字判定エンジン
// 練習テキスト(かな)をモーラ単位に分割し、各単位ごとにローマ字候補を生成して
// 入力1文字ずつ前方一致で照合する。
// 候補の先頭は常に実機(DividedKanaKeyboard)が送出する表記。
// =============================================================================
(function () {
  // ブラウザでは data.js のトップレベル const(グローバルレキシカル環境)を参照する
  const D = typeof module !== 'undefined'
    ? require('./data.js')
    : { ROMAJI, YOUON_CONS, YOUON_VOWEL, HEPBURN_YOUON, SPECIAL_UNITS, SMALL_KANA, KANA_KEYS };

  // 2かな結合単位(拗音・外来音)のローマ字候補を生成する
  function unitAlts(text) {
    if (text.length === 1) {
      return D.ROMAJI[text] ? D.ROMAJI[text].slice() : null;
    }
    const [c1, c2] = [...text];
    const alts = [];
    // い段 + ゃゅょ → 実機は「子音 + ya/yu/yo」を送出(例: きゃ → kya)
    if (D.YOUON_CONS[c1] && D.YOUON_VOWEL[c2]) {
      alts.push(D.YOUON_CONS[c1] + D.YOUON_VOWEL[c2]);
      if (D.HEPBURN_YOUON[text]) alts.push(...D.HEPBURN_YOUON[text]);
    }
    // 外来音など → 実機は「基本かな + 小書き」を連結送出(例: ふぁ → huxa)
    const a1 = D.ROMAJI[c1];
    const a2 = D.ROMAJI[c2];
    if (a1 && a2) {
      for (const x of a1) for (const y of a2) alts.push(x + y);
    }
    if (D.SPECIAL_UNITS[text]) alts.push(...D.SPECIAL_UNITS[text]);
    return alts.length ? [...new Set(alts)] : null;
  }

  // かな文字列をモーラ単位の配列に分割する。
  // 各要素: { text, alts(ローマ字候補・先頭が実機表記), keys(押下キー) }
  function tokenize(text) {
    const chars = [...text];
    const units = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const next = chars[i + 1];
      // 小書きかなは直前のかなと結合(っ・ん・記号の後には来ない前提)
      if (next && D.SMALL_KANA.has(next) && c !== 'っ' && c !== 'ん' && D.ROMAJI[c]) {
        const pair = c + next;
        const alts = unitAlts(pair);
        if (alts) {
          units.push({ text: pair, alts, keys: D.KANA_KEYS[pair] || null });
          i++;
          continue;
        }
      }
      if (c === 'っ' || c === 'ん') {
        units.push({ text: c, alts: null, keys: D.KANA_KEYS[c] }); // 候補は後段で文脈解決
        continue;
      }
      const alts = unitAlts(c);
      if (alts) {
        units.push({ text: c, alts, keys: D.KANA_KEYS[c] || null });
      }
      // テーブル外の文字(漢字・カタカナ等)は無視
    }
    resolveContext(units);
    return units;
  }

  const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

  // っ(次の子音を重ねる)と ん(nn / n)の候補を前後関係から確定する
  function resolveContext(units) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const next = units[i + 1];
      if (u.text === 'っ') {
        const alts = [];
        if (next && next.alts) {
          // 次単位の各候補の頭文字(子音)を重ねられる。実機表記の頭文字を先頭に。
          const heads = new Set();
          for (const a of next.alts) {
            const h = a[0];
            if (h && !VOWELS.has(h) && h !== 'n' && h !== '-' && /[a-z]/.test(h)) {
              heads.add(h);
            }
          }
          alts.push(...heads);
        }
        alts.push('xtu', 'ltu', 'xtsu', 'ltsu');
        u.alts = alts;
      } else if (u.text === 'ん') {
        const alts = ['nn', "n'"];
        // 実機は常に nn を送出。手打ち用に「n + 子音」も許容する。
        if (next && next.alts) {
          const h = next.alts[0][0];
          if (h && !VOWELS.has(h) && h !== 'n' && h !== 'y' && /[a-z]/.test(h)) {
            alts.push('n');
          }
        }
        u.alts = alts;
      }
    }
  }

  // 1単位ずつ前方一致で照合するマッチャ
  class Matcher {
    constructor(units) {
      this.units = units;
      this.idx = 0;        // 現在の単位
      this.buf = '';       // 現在の単位に対して入力済みのローマ字
      this.committed = []; // 確定済み単位ごとの実際の入力(全文ヒント表示用)
    }

    get done() { return this.idx >= this.units.length; }
    get current() { return this.units[this.idx] || null; }

    // 現在の単位で入力済み buf に前方一致する候補(表示用)。実機表記を優先。
    matchedAlt() {
      const u = this.current;
      if (!u) return '';
      return u.alts.find((a) => a.startsWith(this.buf)) || u.alts[0];
    }

    // 1文字入力。戻り値: 'progress' | 'unit' (単位確定) | 'all' (全文完了) | 'miss'
    input(ch) {
      if (this.done) return 'miss';
      const u = this.current;
      const nbuf = this.buf + ch;
      if (u.alts.some((a) => a.startsWith(nbuf))) {
        this.buf = nbuf;
        // 完全一致し、かつそれより長い候補が無ければ単位確定
        if (u.alts.includes(nbuf) &&
            !u.alts.some((a) => a.length > nbuf.length && a.startsWith(nbuf))) {
          return this._advance();
        }
        return 'progress';
      }
      // buf 自体が完全一致なら(例: ん に対する n)、単位を確定して次へ持ち越す
      if (u.alts.includes(this.buf)) {
        const r = this._advance();
        if (r === 'all') return 'miss'; // 末尾でのあふれ入力
        return this.input(ch);
      }
      return 'miss';
    }

    _advance() {
      this.committed.push(this.buf);
      this.idx++;
      this.buf = '';
      return this.done ? 'all' : 'unit';
    }
  }

  const api = { tokenize, Matcher };
  if (typeof module !== 'undefined') module.exports = api;
  else Object.assign(globalThis, api);
})();
