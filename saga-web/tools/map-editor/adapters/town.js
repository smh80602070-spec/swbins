/**
 * 어댑터 — 사가나락 손으로 지은 마을 넷(`saga-dungeon/js/town.js`)의 배치. 화면은 town.html(위에서 본 2D 방).
 *   장식   모루골 `var DECOR_MORU = [...]`, 갈대나루·자작재·소금벌 `TOWNS[id].decor`
 *   사람   `TOWNS[id].npcs` [{ key, x, y }]
 *   표식   모루골 `var MARKS = [...]`(역참·결사비·난입 — 굴혈은 방에 안 선다) — 자리만, 더하고 빼지 않는다
 * 좌표는 전부 BASE_W×BASE_H(560×380) 기준 — 게임이 scalePt 로 실제 방 크기에 늘린다.
 *
 * 저장은 대사·퀘스트 편집기의 jslit(값 글자 자리 그대로 고치기)로 **바뀐 값 자리만** 바꾼다 — 줄마다 붙은 날짜 주석이 산다.
 * 식으로 적힌 값(횃불 `y: WALL - 4`)은 그대로 두고, 옮기면 그때만 숫자로 쓴다. 항목은 origin(옛 자리 번호)으로 맞춰 끼우고 옮긴다.
 *
 * 검사(게임 코드·`_test.html` 이 거는 규칙 그대로):
 *   오류  모르는 장식 종류(dungeon3d 가 그리는 10종 밖) · 방 밖 · 큰 건물이 스폰(195,240)에서 95 안(카메라가 벽에 박힌다 — 벨타워 함정)
 *        · 사람·표식이 통행 영역(벽+몸 반지름) 밖 · 사람끼리·사람과 표식이 80 안(TALK_R×2 — 한 자리에서 둘이 걸린다) · 모르는 직군
 *   경고  사람이 장식과 55 안(HAND_NPC_DECOR_CLEAR — 게임이 퍼뜨릴 때 덜 벌린다) · 건물끼리 너무 붙음 · 우물이 스폰 95 안 · 같은 직군 둘
 * 밀도 보강 장식(`HAND_TOWN_DENSITY_*`)은 코드가 손 장식을 **피해** 자동으로 놓으므로, 장식을 옮기면 그것들도 따라 움직인다 —
 * 검사 결과 `auto` 에 게임 함수(placePoints·hash2) 원문을 vm 에서 돌린 그 자리를 실어 화면이 점선으로 그린다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const J = require('../../content-editor/jslit');
const { matchClose } = require('../lib/jsspan');

const FILE = 'town.js';
const GAME = 'saga-dungeon';
const file = (root, g) => path.join(root, g, 'js', FILE);
const HAND = ['moru', 'galdae', 'jajak', 'sogeum'];
const TYPES = ['house', 'inn', 'stable', 'mill', 'blacksmith', 'belltower', 'well', 'pillar', 'torch', 'crack'];
const BUILDINGS = ['house', 'inn', 'stable', 'mill', 'blacksmith', 'belltower'];
const SPAWN = { x: 195, y: 240 };
const KEYS = ['t', 'x', 'y', 'h', 'seed', 'a', 'len'];

/** var BASE_W = 560, BASE_H = 380, WALL = 30, P_R = 13; 같은 상수 — 식(WALL - 4) 풀이용 */
function consts(text) {
  const out = {};
  const m = /var\s+BASE_W\s*=[^;]+;/.exec(text);
  if (m) m[0].replace(/(\w+)\s*=\s*(-?\d+(?:\.\d+)?)/g, (_, k, v) => { out[k] = +v; });
  const n = /var\s+(HAND_NPC_DECOR_CLEAR)\s*=\s*(\d+)/.exec(text);
  if (n) out[n[1]] = +n[2];
  return out;
}
function evalRaw(src, C) {
  try { const v = vm.runInNewContext('(' + src + ')', Object.assign({}, C), { timeout: 200 }); return typeof v === 'number' ? v : null; } catch (e) { return null; }
}
/** 파일 → 편집기 값. 식(raw) 숫자는 풀어 주고 원문은 곁에(yRaw 등) 둔다 */
function readTowns(text) {
  const C = consts(text);
  const topDecor = J.parseVar(text, 'DECOR_MORU'), towns = J.parseVar(text, 'TOWNS'), marks = J.parseVar(text, 'MARKS'), defs = J.parseVar(text, 'NPC_DEFS');
  if (!topDecor || !towns || !marks) throw new Error('town.js 에서 DECOR_MORU·TOWNS·MARKS 를 못 찾음');
  const tv = J.toValue(towns);
  const flat = (o) => {
    const r = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (J.isRawVal(v)) { const n = evalRaw(v.$raw, C); r[k] = n; r[k + 'Raw'] = v.$raw; } else r[k] = v;
    }
    return r;
  };
  const out = {};
  for (const id of HAND) {
    const t = tv[id];
    if (!t) continue;
    const decor = id === 'moru' ? J.toValue(topDecor) : t.decor;
    out[id] = {
      id, name: t.name, theme: t.theme && !J.isRawVal(t.theme) ? { floor: t.theme.floor, wall: t.theme.wall } : {},
      hasGate: t.hasGate === true,
      npcs: (t.npcs || []).map(flat),
      decor: Array.isArray(decor) ? decor.map(flat) : [],
      marks: id === 'moru' ? J.toValue(marks).map((m) => ({ key: m.key, name: m.name, x: m.x, y: m.y })) : [],
    };
  }
  const npcDefs = defs ? Object.fromEntries(Object.entries(J.toValue(defs)).map(([k, v]) => [k, { name: v.name, emoji: v.emoji }])) : {};
  return { C, towns: out, npcDefs };
}

/* ── 저장 — 편집기 값 → 파일 값(식은 안 옮겼으면 그대로) ─────────── */
function toFileItem(item, old, keys, C) {
  const o = {};
  const order = old ? Object.keys(old).concat(keys.filter((k) => !(k in old))) : keys;
  for (const k of order) {
    if (item[k] === undefined || item[k] === null || item[k] === '') continue;
    const was = old && old[k];
    if (J.isRawVal(was) && evalRaw(was.$raw, C) === item[k]) { o[k] = was; continue; }   // 식 그대로(값이 안 바뀜)
    o[k] = item[k];
  }
  return o;
}
function patchList(text, node, items, origin, keys) {
  const C = consts(text);
  const oldVals = node.items.map(J.toValue);
  const vals = items.map((it, j) => toFileItem(it, origin && origin[j] >= 0 ? oldVals[origin[j]] : null, keys, C));
  return J.patchTop(text, node, vals, null, origin, { rawToValue: true }).text;
}
function townNode(text, id, prop) {
  const towns = J.parseVar(text, 'TOWNS');
  const t = towns.props.find((p) => p.k === id);
  if (!t || t.v.t !== 'obj') throw new Error('TOWNS.' + id + ' 를 못 찾음');
  const p = t.v.props.find((q) => q.k === prop);
  if (!p) throw new Error('TOWNS.' + id + '.' + prop + ' 를 못 찾음');
  return p.v;
}
function rebuild(text, b) {
  let t = text;
  const og = b.origin || {};
  // 장식
  const dn = b.id === 'moru' ? J.parseVar(t, 'DECOR_MORU') : townNode(t, b.id, 'decor');
  if (dn.t !== 'arr') throw new Error('장식이 배열이 아니다');
  t = patchList(t, dn, b.decor, og.decor, KEYS);
  // 사람
  t = patchList(t, townNode(t, b.id, 'npcs'), b.npcs, og.npcs, ['key', 'x', 'y']);
  // 표식(모루골, 자리만) — key 로 맞춘다
  if (b.id === 'moru' && Array.isArray(b.marks)) {
    const mn = J.parseVar(t, 'MARKS');
    const old = mn.items.map(J.toValue);
    const vals = old.map((m) => { const nb = b.marks.find((x) => x.key === m.key); return nb ? Object.assign({}, m, { x: nb.x, y: nb.y }) : m; });
    t = J.patchTop(t, mn, vals, 'key').text;
  }
  return t;
}

/* ── 밀도 보강(자동 장식) — 게임 코드 그대로 ─────────────── */
/** 파일에서 `function 이름(...) { ... }` 원문을 꺼낸다 */
function fnSource(text, name) {
  const at = text.indexOf('function ' + name + '(');
  if (at < 0) return null;
  const open = text.indexOf('{', at);
  const close = matchClose(text, open);
  return close < 0 ? null : text.slice(at, close + 1);
}
/**
 * 게임이 모듈을 불러올 때 손 마을 넷에 더 얹는 집·기둥(`addHandTownDensity`) — town.js 의 `placePoints` 와 core.js 의 `hash2` 원문을
 * vm 에서 그대로 돌려 같은 자리를 낸다. 손 장식·사람(퍼뜨리기 전)·스폰에서 100 떨어진 곳이라, 손 장식을 옮기면 이것도 움직인다.
 * 사람을 퍼뜨릴 때(handTownNpcSpread) 이것도 장애물이다.
 */
function autoDecor(text, root, id, T, C) {
  try {
    const salts = J.toValue(J.parseVar(text, 'HAND_TOWN_DENSITY_SALT')), types = J.toValue(J.parseVar(text, 'HAND_TOWN_DENSITY_TYPE'));
    const pp = fnSource(text, 'placePoints'), h2 = fnSource(fs.readFileSync(path.join(root, GAME, 'js', 'core.js'), 'utf8'), 'hash2');
    if (!salts || !types || !pp || !h2 || !salts[id]) return [];
    const ctx = Object.assign({}, C);
    vm.runInNewContext(h2 + '; var core = { hash2: hash2 }; ' + pp + '; this.placePoints = placePoints;', ctx, { timeout: 500 });
    const avoid = [{ x: SPAWN.x, y: SPAWN.y }].concat(T.decor.map((d) => ({ x: d.x, y: d.y })), T.npcs.map((n) => ({ x: n.x, y: n.y })));
    return ctx.placePoints(types.length, 100, avoid, salts[id]).map((e) => ({ t: types[e.i], x: Math.round(e.x), y: Math.round(e.y) }));
  } catch (e) { return []; }
}

/* ── 검사 ─────────────────────────────────────────── */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function check(text, id, root) {
  const R = readTowns(text), T = R.towns[id], C = R.C;
  if (!T) return { errors: ['마을이 없다: ' + id], warns: [], tally: {} };
  const W = C.BASE_W || 560, H = C.BASE_H || 380, WALL = C.WALL || 30, PR = C.P_R || 13;
  const lo = WALL + PR, hiX = W - lo, hiY = H - lo;
  const E = [], Wn = [];
  const nm = (d, i) => '장식 ' + (i + 1) + ' ' + d.t;
  T.decor.forEach((d, i) => {
    if (TYPES.indexOf(d.t) < 0) E.push(nm(d, i) + ' — 게임(dungeon3d)이 모르는 종류');
    if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) { E.push(nm(d, i) + ' — 자리가 숫자가 아니다'); return; }
    if (d.x < 0 || d.x > W || d.y < 0 || d.y > H) E.push(nm(d, i) + ' — 방(' + W + '×' + H + ') 밖');
    if (BUILDINGS.indexOf(d.t) >= 0) {
      const s = dist(d, SPAWN);
      if (s < 95) E.push(nm(d, i) + ' — 스폰(195,240)에서 ' + Math.round(s) + ' — 95 안이면 시작하자마자 카메라가 벽에 박힌다');
      if (!(d.h > 0)) Wn.push(nm(d, i) + ' — 키(h)가 없다(기본 키로 선다)');
    }
    if (d.t === 'well' && dist(d, SPAWN) < 95) Wn.push(nm(d, i) + ' — 우물이 스폰에서 ' + Math.round(dist(d, SPAWN)) + '(95 안)');
    if (d.t === 'crack' && !(d.len > 0)) Wn.push(nm(d, i) + ' — 균열 길이(len)가 없다');
  });
  const bs = T.decor.filter((d) => BUILDINGS.indexOf(d.t) >= 0);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    if (dist(bs[i], bs[j]) < 70) Wn.push(bs[i].t + '(' + bs[i].x + ',' + bs[i].y + ')·' + bs[j].t + '(' + bs[j].x + ',' + bs[j].y + ') — 건물끼리 ' + Math.round(dist(bs[i], bs[j])) + '(70 안, 벽이 겹친다)');
  }
  const people = T.npcs.map((n) => ({ key: n.key, x: n.x, y: n.y, who: '사람 ' + n.key }));
  const marks = T.marks.filter((m) => m.key !== 'gate' && m.key.indexOf('exit_') !== 0).map((m) => ({ key: m.key, x: m.x, y: m.y, who: '표식 ' + m.key }));
  const seen = {};
  T.npcs.forEach((n) => {
    if (!R.npcDefs[n.key]) E.push('사람 ' + n.key + ' — NPC_DEFS 에 없는 직군');
    if (seen[n.key]) Wn.push('사람 ' + n.key + ' — 한 마을에 둘');
    seen[n.key] = 1;
  });
  people.concat(marks).forEach((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { E.push(p.who + ' — 자리가 숫자가 아니다'); return; }
    if (p.x < lo || p.x > hiX || p.y < lo || p.y > hiY) E.push(p.who + ' (' + p.x + ',' + p.y + ') — 통행 영역(' + lo + '~' + hiX + ', ' + lo + '~' + hiY + ') 밖');
  });
  const talk = people.concat(marks);
  for (let i = 0; i < talk.length; i++) for (let j = i + 1; j < talk.length; j++) {
    const d = dist(talk[i], talk[j]);
    if (d < 80) E.push(talk[i].who + '·' + talk[j].who + ' — ' + Math.round(d) + ' 떨어짐(80 안이면 한 자리에서 둘이 동시에 걸린다)');
  }
  const clear = C.HAND_NPC_DECOR_CLEAR || 55;
  people.forEach((p) => T.decor.forEach((d) => {
    if (d.t === 'torch' || d.t === 'crack') return;
    const s = dist(p, d);
    if (s < clear) Wn.push(p.who + '·' + d.t + '(' + d.x + ',' + d.y + ') — ' + Math.round(s) + '(소품과 ' + clear + ' 안 — 문간에 선다)');
  }));
  const tally = { 사람: T.npcs.length, 장식: T.decor.length, 건물: bs.length };
  if (T.marks.length) tally.표식 = T.marks.length;
  const auto = root ? autoDecor(text, root, id, T, C) : [];
  if (auto.length) tally.자동 = auto.length;
  return { errors: E, warns: Wn, tally, auto };
}

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
module.exports = {
  kind: 'town', label: '마을(사가나락)', page: 'town.html', FILE, file, readTowns, check, rebuild, TYPES,
  /** 이 판에 손으로 지은 마을이 있나 — 다른 판에도 town.js 가 있어(사가마을) 파일만으론 못 가른다 */
  has(root, g) {
    if (g !== GAME) return false;
    try { const t = fs.readFileSync(file(root, g), 'utf8'); return !!(J.parseVar(t, 'TOWNS') && J.parseVar(t, 'DECOR_MORU')); } catch (e) { return false; }
  },
  list(root, games, md5) {
    const out = [];
    for (const game of games) {
      if (!this.has(root, game)) continue;
      const text = fs.readFileSync(file(root, game), 'utf8');
      const R = readTowns(text);
      for (const id of HAND) {
        const T = R.towns[id];
        if (!T) continue;
        out.push(Object.assign({ game, hash: md5(text), base: { W: R.C.BASE_W, H: R.C.BASE_H, WALL: R.C.WALL, P_R: R.C.P_R },
          spawn: SPAWN, npcDefs: R.npcDefs, types: TYPES, buildings: BUILDINGS, report: check(text, id, root) }, T));
      }
    }
    return out;
  },
  validateBody(b) {
    if (HAND.indexOf(b.id) < 0) return '모르는 마을 id';
    const okList = (a, f) => Array.isArray(a) && a.every((x) => x && typeof x === 'object' && f(x));
    if (!okList(b.decor, (d) => /^[a-z]+$/.test(d.t) && isInt(d.x) && isInt(d.y) &&
      ['h', 'len'].every((k) => d[k] === undefined || d[k] === null || isInt(d[k])) && ['seed', 'a'].every((k) => d[k] === undefined || d[k] === null || isNum(d[k])))) return '장식 형식이 이상하다';
    if (!okList(b.npcs, (n) => /^\w+$/.test(n.key) && isInt(n.x) && isInt(n.y))) return '사람 형식이 이상하다';
    if (b.marks !== undefined && !okList(b.marks, (m) => /^\w+$/.test(m.key) && isInt(m.x) && isInt(m.y))) return '표식 형식이 이상하다';
    const og = b.origin || {};
    for (const k of ['decor', 'npcs']) {
      if (og[k] === undefined) continue;
      if (!Array.isArray(og[k]) || og[k].length !== b[k].length || !og[k].every((o) => isInt(o) && o >= -1)) return 'origin.' + k + ' 가 이상하다';
    }
    return null;
  },
  apply: (text, b) => rebuild(text, b),
  checkText: (text, b, root) => check(text, b.id, root),
  guardTexts: () => null,
};
