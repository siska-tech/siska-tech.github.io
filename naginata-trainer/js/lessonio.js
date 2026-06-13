// =============================================================================
// 外部お題ファイルの読み込み
//   .txt  : 1行1問。「#」で始まる行はコメント(最初の1つはレッスンタイトル)。
//   .json : { "title", "desc", "items": [...] } または、その配列。
// =============================================================================
(function () {
  function makeId() {
    return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // tokenizeFn でかなとして解釈できる行だけを残す
  function normalize(title, desc, items, fileName, tokenizeFn) {
    const valid = items.map((s) => String(s).trim())
      .filter((s) => s && tokenizeFn(s).length > 0);
    if (valid.length === 0) return null;
    return {
      id: makeId(),
      title: title || fileName.replace(/\.(txt|json)$/i, ''),
      desc: desc || `${fileName} から追加(${valid.length}問)`,
      items: valid,
      imported: true,
    };
  }

  // ファイル1つ → レッスン配列(JSONは複数レッスンを含められる)
  function parseLessonFile(fileName, text, tokenizeFn) {
    const trimmed = text.replace(/^﻿/, '').trim();
    if (!trimmed) return [];
    if (/\.json$/i.test(fileName) || /^[\[{]/.test(trimmed)) {
      let data = JSON.parse(trimmed); // 不正JSONは例外 → 呼び出し側で表示
      if (!Array.isArray(data)) data = [data];
      return data
        .filter((d) => d && Array.isArray(d.items))
        .map((d) => normalize(d.title, d.desc, d.items, fileName, tokenizeFn))
        .filter(Boolean);
    }
    let title = null;
    const items = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      if (s.startsWith('#')) {
        if (title === null) title = s.replace(/^#+\s*/, '');
        continue;
      }
      items.push(s);
    }
    const lesson = normalize(title, '', items, fileName, tokenizeFn);
    return lesson ? [lesson] : [];
  }

  const api = { parseLessonFile };
  if (typeof module !== 'undefined') module.exports = api;
  else Object.assign(globalThis, api);
})();
