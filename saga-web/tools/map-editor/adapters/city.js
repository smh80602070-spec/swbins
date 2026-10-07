/**
 * 어댑터 — 성 지도(사가천하 `js/data-city.js`). 성 점의 자리(`x`·`y`)·지형(`land`)과 길(`LINKS`)을 고친다.
 * 성 이름·설명·내정 값은 여기서 안 고친다(콘텐츠 편집기 판별 표 몫) — 그래서 실명 가드에 걸 글자도 없다.
 *
 * 검사: 고친 파일을 vm 에서 실행해 게임이 보는 그대로의 `DG.cityData` 를 얻고, 그 판 `_test.html` 의
 * 지도 진단과 같은 조건을 본다 — 없는 성을 가리키는 길(`_dropped`) · 길 없는 성 · 낙양에서 못 닿는 성 ·
 * 모르는 지형. 성 점이 `ui-rtk.js` 의 `MAP_VB`(지도 전체 범위) 밖이면 화면에서 잘리니 그것도 막는다.
 *
 * 저장: 바뀐 성 객체의 `x`·`y`·`land` 값 글자만 바꾸고, 길은 지운 쌍만 `LINKS` 에서 빼고 더한 쌍은 끝에 한 줄로 붙인다.
 * 주석·줄 맞춤·다른 값은 그대로 — 안 바꾸면 바이트까지 같다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const J = require('../lib/jsspan');

const FILE = 'data-city.js';
const cityPath = (root, g) => path.join(root, g, 'js', FILE);
const ID = 'cities';

function evalCity(text) {
  const win = {};
  win.window = win;
  vm.runInNewContext(text, win, { filename: FILE, timeout: 2000 });
  if (!win.DG || !win.DG.cityData) throw new Error('DG.cityData 가 없다');
  return win.DG.cityData;
}

/** 같은 판 ui-rtk.js 의 지도 전체 범위 — 못 찾으면 null(검사 생략) */
function mapBox(root, game) {
  try {
    const t = fs.readFileSync(path.join(root, game, 'js', 'ui-rtk.js'), 'utf8');
    const m = /var MAP_VB\s*=\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*w:\s*([\d.]+),\s*h:\s*([\d.]+)\s*\}/.exec(t);
    return m ? { x: +m[1], y: +m[2], w: +m[3], h: +m[4] } : null;
  } catch (e) { return null; }
}

const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function check(text, root, game) {
  const C = evalCity(text);
  const errors = [], warns = [];
  C._dropped.forEach((d) => errors.push('없는 성을 가리키는 길: ' + d));
  C.CITIES.forEach((c) => {
    if (!c.adj.length) errors.push('길이 하나도 없는 성: ' + c.name + '(' + c.id + ')');
    if (!C.LANDS[c.land || 'plain']) errors.push('모르는 지형 ' + c.land + ': ' + c.id);
    if (typeof c.x !== 'number' || typeof c.y !== 'number' || !isFinite(c.x) || !isFinite(c.y)) errors.push('좌표가 숫자가 아님: ' + c.id);
  });
  const hub = C.find('luoyang') ? 'luoyang' : C.CITIES[0].id;
  const far = C.CITIES.filter((c) => C.hops(hub, c.id) < 0);
  if (far.length) errors.push(C.find(hub).name + '에서 못 닿는 성 ' + far.length + ': ' + far.slice(0, 8).map((c) => c.name).join('·'));
  const box = root ? mapBox(root, game) : null;
  if (box) {
    C.CITIES.forEach((c) => {
      if (c.x < box.x || c.x > box.x + box.w || c.y < box.y || c.y > box.y + box.h) {
        errors.push(c.name + '(' + c.x + ',' + c.y + ') 이 지도 범위 밖 — ui-rtk.js MAP_VB 를 먼저 넓힌다');
      }
    });
  }
  const seen = {};
  C.LINKS.forEach((l) => { const k = pairKey(l[0], l[1]); if (seen[k]) warns.push('같은 길이 두 번: ' + l.join('-')); seen[k] = 1; });
  const tally = { 성: C.CITIES.length, 길: Object.keys(seen).length, 물길: C.WATERWAYS.length };
  if (C.find('luoyang') && C.find('chengdu')) tally['낙양→성도'] = C.hops('luoyang', 'chengdu');
  return { errors, warns, tally, box };
}

/** LINKS 배열 안에서 지운 쌍은 빼고 더한 쌍은 끝에 붙인다 */
function rebuildLinks(text, want) {
  const eol = J.eolOf(text);
  const sp = J.varArraySpan(text, 'LINKS');
  const els = J.topElements(text, sp.open, sp.close).map((e) => {
    const m = /^\[\s*'([^']*)'\s*,\s*'([^']*)'\s*\]$/.exec(text.slice(e.start, e.end + 1));
    return m ? { ...e, a: m[1], b: m[2], key: pairKey(m[1], m[2]) } : { ...e, key: null };
  });
  const wantSet = new Set(want.map((l) => pairKey(l[0], l[1])));
  const haveSet = new Set(els.map((e) => e.key).filter(Boolean));
  const drop = els.filter((e) => e.key && !wantSet.has(e.key));
  const addKeys = new Set();
  const add = want.filter((l) => { const k = pairKey(l[0], l[1]); if (haveSet.has(k) || addKeys.has(k)) return false; addKeys.add(k); return true; });
  if (!drop.length && !add.length) return text;
  const keep = els.filter((e) => drop.indexOf(e) < 0);
  if (!keep.length && !add.length) throw new Error('길을 전부 지울 수는 없다');

  let out = text;
  // 더하기 먼저(맨 뒤 원소 뒤에) — 뒤쪽부터 바꿔야 앞쪽 위치가 안 밀린다
  if (add.length) {
    const last = els[els.length - 1];
    const line = add.map((l) => '[' + J.jsStr(l[0]) + ', ' + J.jsStr(l[1]) + ']').join(', ');
    const at = last.end + 1;
    out = out.slice(0, at) + ',' + eol + J.lineIndent(text, last.start) + line + out.slice(at);
  }
  // 지우기 — 지울 구간을 먼저 다 정하고(더하기 뒤의 글에서, 위치는 더한 자리 앞이라 안 밀린다) 뒤에서부터 지운다.
  // 원소 뒤에 쉼표가 있으면 그것까지. 없으면(배열의 마지막 원소) 살아남은 마지막 원소 뒤 쉼표를 지운다.
  const cuts = [];
  for (const e of drop) {
    let t = e.end + 1;
    const after = /^[ \t]*,[ \t]*/.exec(out.slice(t));
    if (after) t += after[0].length;
    else if (keep.length) {
      const prev = keep[keep.length - 1];
      const c = out.indexOf(',', prev.end + 1);
      if (c > 0 && c < e.start) cuts.push({ s: c, t: c + 1, comma: true });
    }
    cuts.push({ s: e.start, t });
  }
  for (const c of cuts.sort((x, y) => y.s - x.s)) {
    const s = c.s;
    out = out.slice(0, s) + out.slice(c.t);
    if (c.comma) continue;
    // 원소가 빠져 빈 줄이 되었으면 그 줄을 지운다
    const ls = out.lastIndexOf('\n', s - 1) + 1;
    let le = out.indexOf('\n', s); if (le < 0) le = out.length;
    if (/^[ \t\r]*$/.test(out.slice(ls, le))) out = out.slice(0, ls) + out.slice(le + 1);
    else if (/^[ \t\r]*$/.test(out.slice(s, le))) {
      // 줄 끝 원소였으면 앞에 남은 공백을 걷는다
      let b = s; while (b > ls && (out[b - 1] === ' ' || out[b - 1] === '\t')) b--;
      out = out.slice(0, b) + out.slice(s);
    }
  }
  return out;
}

/** 성 객체마다 바뀐 x·y·land 값 글자만 바꾼다 */
function rebuildCities(text, cities) {
  const sp = J.varArraySpan(text, 'CITIES');
  const els = J.topElements(text, sp.open, sp.close);
  const byId = {};
  for (const e of els) {
    const v = J.keyValue(text, e.start, e.end, 'id');
    if (v) byId[text.slice(v.start + 1, v.end)] = e;
  }
  const edits = [];
  for (const c of cities) {
    const e = byId[c.id];
    if (!e) throw new Error('성 id 를 못 찾음: ' + c.id);
    for (const k of ['x', 'y', 'land']) {
      if (c[k] === undefined) continue;
      const v = J.keyValue(text, e.start, e.end, k);
      const nv = J.jsVal(c[k]);
      if (!v) { if (k === 'land' && c.land === 'plain') continue; throw new Error(c.id + ' 에 ' + k + ' 칸이 없다'); }
      const old = text.slice(v.start, v.end + 1);
      const same = k === 'land' ? old.slice(1, -1) === c.land : Number(old) === c[k];
      if (!same) edits.push({ start: v.start, end: v.end, rep: nv });
    }
  }
  let out = text;
  for (const d of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, d.start) + d.rep + out.slice(d.end + 1);
  return out;
}

module.exports = {
  kind: 'city', label: '성 지도', page: 'city.html', FILE,
  file: cityPath, evalCity, check, rebuildLinks, rebuildCities, mapBox,

  list(root, games, md5) {
    const out = [];
    for (const game of games) {
      let text;
      try { text = fs.readFileSync(cityPath(root, game), 'utf8'); } catch (e) { continue; }
      const C = evalCity(text);
      out.push({
        game, id: ID, name: '성 지도', hash: md5(text),
        cities: C.CITIES.map((c) => ({ id: c.id, name: c.name, prov: c.prov, x: c.x, y: c.y, land: c.land || 'plain', landmark: !!c.landmark })),
        links: C.LINKS.map((l) => [l[0], l[1]]),
        lands: Object.values(C.LANDS).map((l) => ({ key: l.key, name: l.name })),
        provinces: C.PROVINCES,
        report: check(text, root, game),
      });
    }
    return out;
  },
  validateBody(b) {
    if (b.id !== ID) return '모르는 지도 id';
    if (!Array.isArray(b.cities) || !b.cities.every((c) => c && typeof c.id === 'string' &&
      typeof c.x === 'number' && isFinite(c.x) && typeof c.y === 'number' && isFinite(c.y) && typeof c.land === 'string' && /^\w+$/.test(c.land))) return 'cities 형식이 이상하다';
    if (!Array.isArray(b.links) || !b.links.every((l) => Array.isArray(l) && l.length === 2 && l.every((s) => typeof s === 'string' && /^[\w-]+$/.test(s)))) return 'links 형식이 이상하다';
    return null;
  },
  apply: (text, b) => rebuildLinks(rebuildCities(text, b.cities), b.links),
  checkText: (text, b, root) => check(text, root, b.game),
  guardTexts: () => null,
};
