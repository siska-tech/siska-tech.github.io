// 簡易テスト: node test/run-tests.js
const D = require('../js/data.js');
const { tokenize, Matcher } = require('../js/romaji.js');

let failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.error(`  NG: ${msg}`); }
}

// 文字列を1文字ずつ Matcher に入力して完走できるか
function typeAll(text, input) {
  const m = new Matcher(tokenize(text));
  for (const ch of input) {
    const r = m.input(ch);
    if (r === 'miss') return { ok: false, at: ch, idx: m.idx, buf: m.buf };
  }
  return { ok: m.done, idx: m.idx, buf: m.buf };
}

// 実機ファームウェアが送出するローマ字(各単位の先頭候補を連結)
function firmwareRomaji(text) {
  return tokenize(text).map((u) => u.alts[0]).join('');
}

console.log('--- 全レッスン: トークン化とキー定義 ---');
for (const lesson of D.LESSONS) {
  for (const item of lesson.items) {
    const units = tokenize(item);
    const plain = [...item].filter((c) => c !== ' ').join('');
    assert(units.map((u) => u.text).join('') === plain,
      `${lesson.id} "${item}" のトークン化結果が原文と不一致`);
    for (const u of units) {
      assert(u.alts && u.alts.length > 0, `${lesson.id} "${item}" の「${u.text}」に候補なし`);
      assert(u.keys || D.KANA_KEYS[[...u.text][0]],
        `${lesson.id} "${item}" の「${u.text}」にキー定義なし`);
    }
  }
}

console.log('--- 全レッスン: 実機ローマ字で完走 ---');
for (const lesson of D.LESSONS) {
  for (const item of lesson.items) {
    const r = typeAll(item, firmwareRomaji(item));
    assert(r.ok, `${lesson.id} "${item}" 実機表記 "${firmwareRomaji(item)}" で失敗 (unit=${r.idx}, buf="${r.buf}", at="${r.at}")`);
  }
}

console.log('--- 実機表記の固定値チェック(romaji.rs のテストと同一) ---');
assert(firmwareRomaji('かう') === 'kau', 'かう=kau');
assert(firmwareRomaji('し') === 'si', 'し=si');
assert(firmwareRomaji('づ') === 'du', 'づ=du');
assert(firmwareRomaji('ん') === 'nn', 'ん=nn');
assert(firmwareRomaji('かんい') === 'kanni', `かんい=kanni (got ${firmwareRomaji('かんい')})`);
assert(firmwareRomaji('きゃ') === 'kya', 'きゃ=kya');
assert(firmwareRomaji('しゃ') === 'sya', 'しゃ=sya');
assert(firmwareRomaji('ちょ') === 'tyo', 'ちょ=tyo');
assert(firmwareRomaji('かっこ') === 'kakko', 'かっこ=kakko');
assert(firmwareRomaji('っ') === 'xtu', 'っ単独=xtu');
assert(firmwareRomaji('かー') === 'ka-', 'かー=ka-');
assert(firmwareRomaji('ふぁ') === 'huxa', 'ふぁ=huxa(実機は連結送出)');
assert(firmwareRomaji('じゃ') === 'zya', 'じゃ=zya');

console.log('--- ヘボン式・代替表記の受理 ---');
assert(typeAll('しゃしん', 'shashinn').ok, 'しゃしん=shashinn');
assert(typeAll('おちゃ', 'ocha').ok, 'おちゃ=ocha');
assert(typeAll('かんたん', 'kantann').ok, 'かんたん=kantann(n+子音)');
assert(typeAll('ふじさん', 'fujisann').ok, 'ふじさん=fujisann');
assert(typeAll('つき', 'tsuki').ok, 'つき=tsuki');
assert(typeAll('ぱーてぃー', 'pa-thi-').ok, 'ぱーてぃー=pa-thi-');
assert(typeAll('ぱーてぃー', 'pa-texi-').ok, 'ぱーてぃー=pa-texi-(実機)');
assert(typeAll('ふぁん', 'fann').ok, 'ふぁん=fann');
assert(typeAll('ふぁん', 'huxann').ok, 'ふぁん=huxann(実機)');
assert(typeAll('きっぷ', 'kippu').ok, 'きっぷ=kippu');
assert(typeAll('きっぷ', 'kixtupu').ok, 'きっぷ=kixtupu');
assert(typeAll('こんにちは', 'konnnitiha').ok, 'こんにちは=konnnitiha(実機)');
assert(typeAll('こんにちは', "kon'nichiha").ok, "こんにちは=kon'nichiha");

console.log('--- ミス判定 ---');
{
  const m = new Matcher(tokenize('かき'));
  assert(m.input('k') === 'progress', 'か: k で progress');
  assert(m.input('i') === 'miss', 'か: ki の i は miss');
  assert(m.input('a') === 'unit', 'か: ka で確定');
  assert(m.input('k') === 'progress' && m.input('i') === 'all', 'き: ki で完了');
}
{
  // ん + 子音: n 1つで次単位に持ち越し
  const m = new Matcher(tokenize('んか'));
  assert(m.input('n') === 'progress', 'ん: n で保留');
  assert(m.input('k') === 'progress', 'ん確定 + か: k へ持ち越し');
  assert(m.input('a') === 'all', 'か: ka で完了');
}

console.log('--- キーガイド ---');
assert(JSON.stringify(D.KANA_KEYS['きゃ']) === '["w","h"]', 'きゃ=[w,h]');
assert(JSON.stringify(D.KANA_KEYS['ぎゃ']) === '["j","w","h"]', 'ぎゃ=[j,w,h]');
assert(JSON.stringify(D.KANA_KEYS['さ']) === '["SP","u"]', 'さ=[SP,u]');
assert(JSON.stringify(tokenize('しゃ')[0].keys) === '["r","h"]', 'しゃ unit keys');
assert(JSON.stringify(tokenize('ふぁ')[0].keys) === '["v",";","j"]', 'ふぁ unit keys');

console.log('--- 回帰: でんしゃ問題(レッスン10の文章) ---');
{
  const s = 'でんしゃにのって、かいしゃへいきます。';
  // 実機が送出する表記は dennsya...(sixya ではない)
  assert(firmwareRomaji(s) === 'dennsyaninotte,kaisyaheikimasu.',
    `実機表記 (got ${firmwareRomaji(s)})`);
  // 実機表記そのままで完走できる
  assert(typeAll(s, 'dennsyaninotte,kaisyaheikimasu.').ok, 'dennsya... で完走');
  // 「し+小書きゃ」分割形(si+xya)でも完走できる
  assert(typeAll(s, 'dennsixyaninotte,kaisixyaheikimasu.').ok, 'dennsixya... でも完走');
  // 全文ヒント用: committed に実際の入力が単位ごとに残る
  const m = new Matcher(tokenize('でんしゃ'));
  for (const ch of 'dennsya') m.input(ch);
  assert(m.done && JSON.stringify(m.committed) === '["de","nn","sya"]',
    `committed 記録 (got ${JSON.stringify(m.committed)})`);
}

console.log('--- お題ファイルの読み込み ---');
{
  const { parseLessonFile } = require('../js/lessonio.js');
  // .txt: タイトル行 + コメント + 空行 + 無効行の除外
  const txt = '# どうぶつのなまえ\n# これはコメント\nねこ\nいぬ\n\nABC123\nうさぎ\n';
  const [l1] = parseLessonFile('animals.txt', txt, tokenize);
  assert(l1 && l1.title === 'どうぶつのなまえ', 'txt: タイトル取得');
  assert(JSON.stringify(l1.items) === '["ねこ","いぬ","うさぎ"]',
    `txt: 有効行のみ抽出 (got ${JSON.stringify(l1 && l1.items)})`);
  assert(l1.imported === true, 'txt: imported フラグ');

  // BOM 付き .txt
  const [l2] = parseLessonFile('bom.txt', '﻿ねこ\nいぬ\n', tokenize);
  assert(l2 && l2.items.length === 2, 'txt: BOM 付きでも読める');

  // .json 単一オブジェクト
  const [l3] = parseLessonFile('one.json',
    '{"title":"てすと","desc":"せつめい","items":["さくら","やま"]}', tokenize);
  assert(l3 && l3.title === 'てすと' && l3.items.length === 2, 'json: 単一レッスン');

  // .json 配列(複数レッスン)
  const ls = parseLessonFile('multi.json',
    '[{"title":"あ","items":["あい"]},{"title":"か","items":["かき"]}]', tokenize);
  assert(ls.length === 2 && ls[0].id !== ls[1].id, 'json: 複数レッスン + ID重複なし');

  // 全行無効 → 空配列
  assert(parseLessonFile('bad.txt', 'ABC\nXYZ\n', tokenize).length === 0,
    'txt: 有効行なしは空配列');

  // 不正JSON → 例外
  let threw = false;
  try { parseLessonFile('broken.json', '{bad', tokenize); } catch { threw = true; }
  assert(threw, 'json: 不正JSONは例外');
}

console.log('--- エミュレーションエンジン ---');
{
  const { NaginataEngine, KanaMatcher } = require('../js/emulator.js');
  function run(steps) {
    const out = [];
    const e = new NaginataEngine({ windowMs: 60, tapMs: 200, onEmit: (k) => out.push(k) });
    for (const [op, key, t] of steps) {
      if (op === 'd') e.keydown(key, t);
      else if (op === 'u') e.keyup(key, t);
      else e.flush(t);
    }
    return out.join('|');
  }

  // 単打(キーを離した時点で確定)
  assert(run([['d', 'd', 0], ['u', 'd', 30]]) === 'と', '単打: d=と');
  // 単打(窓の締め切りで確定)
  assert(run([['d', 'd', 0], ['f', null, 100]]) === 'と', '単打: flush で確定');
  // シフトキーのタップは単打かな
  assert(run([['d', 'f', 0], ['u', 'f', 100]]) === 'か', 'fタップ=か');
  assert(run([['d', 'j', 0], ['u', 'j', 100]]) === 'あ', 'jタップ=あ');
  // シフトキー長押し単独は無出力
  assert(run([['d', 'f', 0], ['u', 'f', 500]]) === '', 'f長押し単独=無出力');
  // 濁音: f を押しながら u
  assert(run([['d', 'f', 0], ['d', 'u', 300], ['u', 'u', 350], ['u', 'f', 400]]) === 'ざ',
    'f+u=ざ(fは後で離しても単打が出ない)');
  // センターシフト: スペースを押しながら
  assert(run([['d', 'SP', 0], ['d', 'a', 300], ['u', 'a', 350], ['u', 'SP', 400]]) === 'せ',
    'SP+a=せ');
  assert(run([['d', 'SP', 0], ['d', 'v', 300], ['u', 'v', 350], ['u', 'SP', 400]]) === '、',
    'SP+v=、');
  // スペース単独タップはスペース
  assert(run([['d', 'SP', 0], ['u', 'SP', 100]]) === ' ', 'SPタップ=空白');
  // 清音拗音 combo2
  assert(run([['d', 'w', 0], ['d', 'h', 20], ['u', 'w', 80], ['u', 'h', 90]]) === 'きゃ',
    'w+h=きゃ');
  // 窓を超えた打鍵は分離される
  assert(run([['d', 'w', 0], ['u', 'w', 40], ['d', 'h', 200], ['u', 'h', 240]]) === 'き|く',
    '遅い w→h は き|く');
  // 濁音拗音 combo3(j 押しっぱなし + w + h)
  assert(run([['d', 'j', 0], ['d', 'w', 100], ['d', 'h', 120], ['u', 'w', 180],
              ['u', 'h', 190], ['u', 'j', 300]]) === 'ぎゃ', 'j+w+h=ぎゃ');
  // 外来音 combo3(ふぁ = v+;+j)
  assert(run([['d', 'v', 0], ['d', ';', 20], ['d', 'j', 40], ['u', ';', 100],
              ['u', 'v', 110], ['u', 'j', 120]]) === 'ふぁ', 'v+;+j=ふぁ');
  // シフトキーどうしのチョード(が = j+f、押し順不問)
  assert(run([['d', 'j', 0], ['d', 'f', 20], ['u', 'f', 100], ['u', 'j', 110]]) === 'が',
    'j→f=が');
  assert(run([['d', 'f', 0], ['d', 'j', 20], ['u', 'j', 100], ['u', 'f', 110]]) === 'が',
    'f→j=が(逆順でも)');
  // 小書き(q+h=ゃ)
  assert(run([['d', 'q', 0], ['d', 'h', 20], ['u', 'h', 80], ['u', 'q', 90]]) === 'ゃ',
    'q+h=ゃ');
  // IME切替相当の組み合わせは無出力
  assert(run([['d', 'f', 0], ['d', 'g', 20], ['u', 'g', 80], ['u', 'f', 90]]) === '',
    'f+g=無出力(実機ではIME OFF)');
  // シフト押しっぱなしで連続入力
  assert(run([['d', 'SP', 0], ['d', 'u', 300], ['u', 'u', 350],
              ['d', 'i', 500], ['u', 'i', 550], ['u', 'SP', 600]]) === 'さ|よ',
    'SP押しっぱなしで さ|よ');

  // KanaMatcher
  const km = new KanaMatcher(tokenize('でんしゃ'));
  assert(km.input('で') === 'ok' && km.input('ん') === 'ok' && km.input('しゃ') === 'all',
    'KanaMatcher: で|ん|しゃ で完走');
  const km2 = new KanaMatcher(tokenize('しゃ'));
  assert(km2.input('し') === 'ok' && km2.remaining() === 'ゃ' && km2.input('ゃ') === 'all',
    'KanaMatcher: し+小書きゃ の分割入力と remaining');
  const km3 = new KanaMatcher(tokenize('きやく'));
  assert(km3.input('きゃ') === 'miss', 'KanaMatcher: きや に きゃ は miss');
}

if (failed) {
  console.error(`\n${failed} 件失敗`);
  process.exit(1);
}
console.log('\nすべてのテストに合格');
