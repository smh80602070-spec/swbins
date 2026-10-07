/**
 * 어댑터 — 사냥터(사가종횡 `js/data-side.js` `STAGES`). 옆으로 걷는 한 판의 폭(`width`)과
 * 발판 `plats [x,y,w]` · 줄 `ropes [x,top,bottom,kind]` · 문 `portals [x,toKey]` · 마을 사람 `npcs [x,key]` ·
 * 채집 `gathers [x,kind]` 를 고친다. 이름·하늘색·적 수준·보스는 안 고친다(콘텐츠 편집기 판별 표 몫).
 *
 * 검사: 고친 파일을 vm 에서 실행해 게임이 보는 그대로의 `DG.sideData` 를 얻고, 그 판 `_test.html` 이 보는 조건
 * (줄 수 ≥ 발판 수 · 문 하나 이상 · 문이 가리키는 사냥터가 있다)과 형식(폭 안·바닥 위·알려진 줄/사람/채집 갈래)을 막는다.
 * 되돌아오는 문이 없는 것·발판 윗면에 안 닿는 줄은 막지 않고 경고만 한다.
 *
 * 저장: 그 사냥터 객체 안에서 **바뀐 칸의 값만** 다시 쓴다(안 바뀐 칸은 줄바꿈·줄 맞춤까지 그대로). 없던 칸은 `portals` 뒤에 붙인다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const J = require('../lib/jsspan');

const FILE = 'data-side.js';
const sidePath = (root, g) => path.join(root, g, 'js', FILE);
const FIELDS = ['plats', 'ropes', 'portals', 'npcs', 'gathers'];
const ROPE_KINDS = ['rope', 'ladder'];
const WRAP = 100; // 이 열을 넘으면 줄을 바꾼다(기존 표기 폭 — 대개 80~100열)

function evalSide(text) {
  const win = {};
  win.window = win;
  vm.runInNewContext(text, win, { filename: FILE, timeout: 2000 });
  if (!win.DG || !win.DG.sideData) throw new Error('DG.sideData 가 없다');
  return win.DG.sideData;
}

function stageSpan(text, key) {
  const sp = J.varArraySpan(text, 'STAGES');
  for (const e of J.topElements(text, sp.open, sp.close)) {
    const v = J.keyValue(text, e.start, e.end, 'key');
    if (v && text.slice(v.start + 1, v.end) === key) return e;
  }
  throw new Error('사냥터 key 를 못 찾음: ' + key);
}

const isInt = (n) => Number.isInteger(n);

function check(text, key) {
  const S = evalSide(text);
  const st = S.STAGES.find((s) => s.key === key);
  if (!st) return { errors: ['사냥터가 없다: ' + key], warns: [], tally: {} };
  const errors = [], warns = [];
  const W = st.width, F = st.floor;
  const keys = S.STAGES.map((s) => s.key);
  const inW = (x) => isInt(x) && x >= 0 && x <= W;
  if (!isInt(W) || W < 400) errors.push('폭(width)이 400 미만이거나 정수가 아니다');
  (st.plats || []).forEach((p, i) => {
    const tag = '발판 ' + (i + 1);
    if (!Array.isArray(p) || p.length !== 3 || !p.every(isInt)) { errors.push(tag + ' 형식 [x, y, w] 가 아니다'); return; }
    if (p[2] <= 0) errors.push(tag + ' 폭이 0 이하');
    if (p[0] < 0 || p[0] + p[2] > W) errors.push(tag + ' 이 사냥터 폭 밖(' + p[0] + '~' + (p[0] + p[2]) + ' / ' + W + ')');
    if (p[1] <= 0 || p[1] >= F) errors.push(tag + ' 높이가 바닥(' + F + ') 아래이거나 0 이하');
  });
  (st.ropes || []).forEach((r, i) => {
    const tag = '줄 ' + (i + 1);
    if (!Array.isArray(r) || r.length !== 4 || !r.slice(0, 3).every(isInt)) { errors.push(tag + ' 형식 [x, top, bottom, kind] 가 아니다'); return; }
    if (!inW(r[0])) errors.push(tag + ' 이 사냥터 폭 밖');
    if (!(r[1] < r[2]) || r[2] > F || r[1] < 0) errors.push(tag + ' 위·아래 끝이 이상하다(위 < 아래 ≤ 바닥)');
    if (ROPE_KINDS.indexOf(r[3]) < 0) errors.push(tag + ' 갈래가 rope/ladder 가 아니다: ' + r[3]);
    const on = (st.plats || []).some((p) => p[1] === r[1] && r[0] >= p[0] && r[0] <= p[0] + p[2]);
    if (!on) warns.push(tag + ' 위 끝(' + r[1] + ')이 어느 발판 윗면에도 안 닿는다');
  });
  if ((st.ropes || []).length < (st.plats || []).length) errors.push('줄(' + (st.ropes || []).length + ')이 발판(' + (st.plats || []).length + ')보다 적다 — 진단 "줄" 이 깨진다');
  if (!(st.portals || []).length) errors.push('문이 하나도 없다 — 진단 "문" 이 깨진다');
  (st.portals || []).forEach((p, i) => {
    const tag = '문 ' + (i + 1);
    if (!Array.isArray(p) || p.length !== 2 || !inW(p[0])) { errors.push(tag + ' 형식 [x, toKey] 가 아니거나 폭 밖'); return; }
    if (keys.indexOf(p[1]) < 0) { errors.push(tag + ' 이 없는 사냥터를 가리킨다: ' + p[1]); return; }
    const back = (S.stage(p[1]).portals || []).some((q) => q[1] === key);
    if (!back) warns.push(tag + ' → ' + p[1] + ' 에서 되돌아오는 문이 없다');
  });
  keys.forEach((k) => {
    if (k === key) return;
    const toMe = (S.stage(k).portals || []).some((q) => q[1] === key);
    const fromMe = (st.portals || []).some((q) => q[1] === k);
    if (toMe && !fromMe) warns.push(k + ' 에서 오는 문이 있는데 돌아가는 문이 없다');
  });
  const kinds = (arr, known, label) => (arr || []).forEach((n, i) => {
    if (!Array.isArray(n) || n.length !== 2 || !inW(n[0])) { errors.push(label + ' ' + (i + 1) + ' 형식 [x, 갈래] 가 아니거나 폭 밖'); return; }
    if (known.indexOf(n[1]) < 0) errors.push(label + ' ' + (i + 1) + ' 모르는 갈래: ' + n[1]);
  });
  kinds(st.npcs, Object.keys(S.NPC_TALK || {}), '사람');
  kinds(st.gathers, Object.keys(S.GATHERS || {}), '채집');
  const tally = { 폭: W, 발판: (st.plats || []).length, 줄: (st.ropes || []).length, 문: (st.portals || []).length,
    사람: (st.npcs || []).length, 채집: (st.gathers || []).length };
  return { errors, warns, tally };
}

/** 배열의 배열을 `[[..], [..]]` 로 — WRAP 열을 넘으면 `[` 다음 열에 맞춰 줄을 바꾼다 */
function serializeRows(rows, col, eol) {
  const items = rows.map((r) => '[' + r.map(J.jsVal).join(', ') + ']');
  if (!items.length) return '[]';
  const pad = ' '.repeat(col + 1);
  const lines = [];
  let cur = '';
  items.forEach((it, i) => {
    const piece = it + (i < items.length - 1 ? ',' : '');
    if (cur && col + 1 + cur.length + 1 + piece.length > WRAP) { lines.push(cur); cur = piece; }
    else cur = cur ? cur + ' ' + piece : piece;
  });
  lines.push(cur);
  return '[' + lines.join(eol + pad) + ']';
}

const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

function rebuild(text, key, b) {
  const eol = J.eolOf(text);
  const cur = evalSide(text).STAGES.find((s) => s.key === key);
  const e = stageSpan(text, key);
  const edits = [];
  if (b.width !== undefined && b.width !== cur.width) {
    const v = J.keyValue(text, e.start, e.end, 'width');
    if (!v) throw new Error('width 칸이 없다');
    edits.push({ start: v.start, end: v.end, rep: String(b.width) });
  }
  const missing = [];
  for (const f of FIELDS) {
    if (b[f] === undefined || same(b[f], cur[f])) continue;
    const v = J.keyValue(text, e.start, e.end, f);
    if (v) edits.push({ start: v.start, end: v.end, rep: serializeRows(b[f], J.columnOf(text, v.start), eol) });
    else if (b[f].length) missing.push(f);
  }
  if (missing.length) {
    // 없던 칸 — portals 값 뒤(없으면 ropes·plats 뒤)에 같은 들여쓰기로 붙인다
    const anchorKey = ['portals', 'ropes', 'plats'].find((k) => J.keyValue(text, e.start, e.end, k));
    if (!anchorKey) throw new Error('칸을 붙일 자리를 못 찾음');
    const a = J.keyValue(text, e.start, e.end, anchorKey);
    const keyAt = text.lastIndexOf(anchorKey, a.start);
    const ind = J.lineIndent(text, keyAt);
    // 값 뒤 쉼표 다음에 새 줄로 끼운다 — 같은 줄에 다른 칸이 이어졌으면 그 칸은 새 줄 끝으로 따라온다
    let at = a.end + 1, pre = '', post = '';
    const m = /^[ \t]*,/.exec(text.slice(at));
    if (m) { at += m[0].length; post = ','; } else pre = ',';
    const body = missing.map((f) => f + ': ' + serializeRows(b[f], ind.length + f.length + 2, eol)).join(',' + eol + ind);
    edits.push({ start: at, end: at - 1, rep: pre + eol + ind + body + post });
  }
  let out = text;
  for (const d of edits.sort((x, y) => y.start - x.start)) out = out.slice(0, d.start) + d.rep + out.slice(d.end + 1);
  return out;
}

module.exports = {
  kind: 'side', label: '사냥터', page: 'side.html', FILE,
  file: sidePath, evalSide, check, rebuild, serializeRows,

  list(root, games, md5) {
    const out = [];
    for (const game of games) {
      let text;
      try { text = fs.readFileSync(sidePath(root, game), 'utf8'); } catch (e) { continue; }
      const S = evalSide(text);
      const stageKeys = S.STAGES.map((s) => ({ key: s.key, name: s.name }));
      for (const s of S.STAGES) {
        out.push({
          game, id: s.key, name: s.name, hash: md5(text), town: !!s.town, need: s.need, mood: s.mood, sky: s.sky, ground: s.ground,
          width: s.width, floor: s.floor, plats: s.plats || [], ropes: s.ropes || [], portals: s.portals || [],
          npcs: s.npcs || [], gathers: s.gathers || [],
          stageKeys, npcKinds: Object.keys(S.NPC_TALK || {}), gatherKinds: Object.keys(S.GATHERS || {}),
          report: check(text, s.key),
        });
      }
    }
    return out;
  },
  validateBody(b) {
    if (typeof b.id !== 'string' || !/^\w+$/.test(b.id)) return '모르는 사냥터 id';
    if (!Number.isInteger(b.width)) return 'width 가 정수가 아니다';
    const rows = (a, n, strAt) => Array.isArray(a) && a.every((r) => Array.isArray(r) && r.length === n &&
      r.every((v, i) => (strAt.indexOf(i) >= 0 ? typeof v === 'string' && /^\w+$/.test(v) : Number.isInteger(v))));
    if (!rows(b.plats, 3, [])) return 'plats 형식이 이상하다';
    if (!rows(b.ropes, 4, [3])) return 'ropes 형식이 이상하다';
    if (!rows(b.portals, 2, [1])) return 'portals 형식이 이상하다';
    if (!rows(b.npcs, 2, [1])) return 'npcs 형식이 이상하다';
    if (!rows(b.gathers, 2, [1])) return 'gathers 형식이 이상하다';
    return null;
  },
  apply: (text, b) => rebuild(text, b.id, b),
  checkText: (text, b) => check(text, b.id),
  guardTexts: () => null,
};
