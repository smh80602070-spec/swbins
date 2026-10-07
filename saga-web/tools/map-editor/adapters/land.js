/**
 * 어댑터 — 글자 지도(사가만리 `js/land.js`). 땅 객체의 `map: [...]`(글자 줄)·`places: [...]`(명소)를 고친다.
 * 검사는 **게임 코드 그대로**: 고친 land.js 를 vm 에서 실행해 그 판의 `validate()`·`roadIslands()`·`tally()` 를 부른다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { matchClose, jsStr } = require('../lib/jsspan');

const FILE = 'land.js';
const landPath = (root, g) => path.join(root, g, 'js', FILE);

/** land.js 를 실행해 DG.land 를 얻는다(DG.core.tuned 만 흉내 — 손잡이는 전부 켠 것으로) */
function evalLand(text) {
  const win = { DG: { core: { tuned: (k, d) => (d == null ? 1 : d) } } };
  win.window = win;
  vm.runInNewContext(text, win, { filename: 'land.js', timeout: 2000 });
  return win.DG.land;
}

/** 땅 id 의 map/places 배열 구간 [open, close] — `id: '<id>'` 뒤 처음 나오는 `map: [` 와 `places: [` */
function regionSpans(text, id) {
  const idAt = text.search(new RegExp("\\bid:\\s*'" + id.replace(/[^\w-]/g, '') + "'"));
  if (idAt < 0) throw new Error('땅 id 를 못 찾음: ' + id);
  const span = (key) => {
    const m = new RegExp('\\b' + key + ':\\s*\\[').exec(text.slice(idAt));
    if (!m) throw new Error(key + ' 배열을 못 찾음');
    const open = idAt + m.index + m[0].length - 1;
    const close = matchClose(text, open);
    if (close < 0) throw new Error(key + ' 배열이 안 닫힘');
    return { open, close };
  };
  return { map: span('map'), places: span('places') };
}

function indentBefore(text, open) {
  const nl = text.indexOf('\n', open);
  const m = /^[ \t]*/.exec(text.slice(nl + 1));
  return m ? m[0] : '      ';
}
function serializeMap(rows, ind, eol, closeInd) {
  return '[' + eol + rows.map((r, i) => ind + jsStr(r) + (i < rows.length - 1 ? ',' : '')).join(eol) + eol + closeInd + ']';
}
function serializePlaces(places, ind, eol, closeInd) {
  const one = (p) => {
    const keys = ['id', 'name', 'tx', 'ty', 'hidden'].filter((k) => p[k] !== undefined)
      .concat(Object.keys(p).filter((k) => ['id', 'name', 'tx', 'ty', 'hidden'].indexOf(k) < 0));
    return '{ ' + keys.filter((k) => !(k === 'hidden' && !p[k])).map((k) => {
      const v = p[k];
      return k + ': ' + (typeof v === 'number' || typeof v === 'boolean' ? String(v) : jsStr(v));
    }).join(', ') + ' }';
  };
  return '[' + eol + places.map((p, i) => ind + one(p) + (i < places.length - 1 ? ',' : '')).join(eol) + eol + closeInd + ']';
}
function rebuild(text, id, map, places) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const sp = regionSpans(text, id);
  const closeInd = (s) => { const ls = text.lastIndexOf('\n', s.close); return /^[ \t]*/.exec(text.slice(ls + 1))[0]; };
  // 뒤쪽 구간부터 바꿔야 앞쪽 위치가 안 밀린다
  const parts = [['map', sp.map, serializeMap(map, indentBefore(text, sp.map.open), eol, closeInd(sp.map))],
    ['places', sp.places, serializePlaces(places, indentBefore(text, sp.places.open), eol, closeInd(sp.places))]]
    .sort((a, b) => b[1].open - a[1].open);
  let out = text;
  for (const [, s, rep] of parts) out = out.slice(0, s.open) + rep + out.slice(s.close + 1);
  return out;
}

function check(text, id) {
  const L = evalLand(text);
  L.use(id);
  const r = L.region();
  return { errors: L.validate(r), islands: L.roadIslands(r), tally: L.tally(r), info: L.info() };
}

module.exports = {
  kind: 'land', label: '글자 지도', page: 'map.html', FILE,
  file: landPath, evalLand, regionSpans, rebuild, check,

  /** 판마다 land.js 의 땅 목록(LANDS) */
  list(root, games, md5) {
    const out = [];
    for (const game of games) {
      let text;
      try { text = fs.readFileSync(landPath(root, game), 'utf8'); } catch (e) { continue; }
      const L = evalLand(text);
      for (const [key, r] of Object.entries(L.LANDS)) {
        out.push({ game, key, id: r.id, name: r.name, ox: r.ox, oy: r.oy, map: r.map, legend: r.legend, places: r.places,
          hash: md5(text), report: check(text, r.id) });
      }
    }
    return out;
  },
  validateBody(b) {
    if (!Array.isArray(b.map) || !b.map.length || !b.map.every((r) => typeof r === 'string')) return 'map 이 글자 줄 배열이 아니다';
    if (!Array.isArray(b.places) || !b.places.every((p) => p && typeof p.id === 'string' && Number.isInteger(p.tx) && Number.isInteger(p.ty))) return 'places 형식이 이상하다';
    return null;
  },
  apply: (text, b) => rebuild(text, b.id, b.map, b.places),
  checkText: (text, b) => check(text, b.id),
  guardTexts: (b) => ['명소 이름', ...b.places.map((p) => p.name)],
};
