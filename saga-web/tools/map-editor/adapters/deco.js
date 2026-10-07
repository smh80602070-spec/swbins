/**
 * 어댑터 — 3D 배치(사가만리 `js/land.js` 땅 객체의 `deco: [...]`, 손으로 놓은 소품).
 * 화면은 scene.html(three.js 3D 뷰포트 + 기즈모). 좌표는 월드 미터(x 동쪽 · z 남쪽).
 * 검사는 글자 지도와 같이 **게임 코드 그대로**: 고친 land.js 를 vm 에서 실행해 `validate()` 를 부른다
 * (그 안에 deco 검사 — 모르는 종류·값 범위·땅 밖 — 가 있다).
 * 저장은 `deco` 배열 구간만 바꾼다. 한 소품에 한 줄.
 */
'use strict';

const fs = require('fs');
const land = require('./land');
const { matchClose, jsStr } = require('../lib/jsspan');

const KEYS = ['t', 'x', 'z', 'h', 'rot', 'w', 'd', 'shade'];
/* 소수 자리 — 미터는 cm, 돌림은 0.001 라디안(0.06°)이면 눈으로 못 가른다 */
const round = (k, v) => {
  const f = k === 'rot' ? 1000 : k === 'shade' ? 100 : 100;
  return Math.round(v * f) / f;
};

/** 땅 id 의 `deco: [` 배열 구간 — 없으면 null(옛 land.js) */
function decoSpan(text, id) {
  const idAt = text.search(new RegExp("\\bid:\\s*'" + id.replace(/[^\w-]/g, '') + "'"));
  if (idAt < 0) throw new Error('땅 id 를 못 찾음: ' + id);
  // 이 땅 객체가 닫히기 전까지만 찾는다(다음 땅의 deco 를 잡지 않게)
  const objOpen = text.lastIndexOf('{', idAt);
  const objClose = matchClose(text, objOpen);
  const m = /\bdeco:\s*\[/.exec(text.slice(idAt, objClose));
  if (!m) return null;
  const open = idAt + m.index + m[0].length - 1;
  const close = matchClose(text, open);
  if (close < 0) throw new Error('deco 배열이 안 닫힘');
  return { open, close };
}

function serializeItem(p) {
  const keys = KEYS.filter((k) => p[k] !== undefined && p[k] !== null);
  return '{ ' + keys.map((k) => k + ': ' + (k === 't' ? jsStr(p[k]) : String(round(k, p[k])))).join(', ') + ' }';
}

function rebuild(text, id, deco) {
  const sp = decoSpan(text, id);
  if (!sp) throw new Error('이 땅에 deco 배열이 없다 — land.js 에 `deco: []` 부터 넣는다');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const ls = text.lastIndexOf('\n', sp.open);
  const baseInd = /^[ \t]*/.exec(text.slice(ls + 1))[0];
  const rep = deco.length
    ? '[' + eol + deco.map((p, i) => baseInd + '  ' + serializeItem(p) + (i < deco.length - 1 ? ',' : '')).join(eol) + eol + baseInd + ']'
    : '[]';
  return text.slice(0, sp.open) + rep + text.slice(sp.close + 1);
}

/** 들어온 값을 저장할 모양으로 — 모르는 키는 버리고 숫자는 반올림 */
function clean(deco) {
  return deco.map((p) => {
    const o = {};
    for (const k of KEYS) if (p[k] !== undefined && p[k] !== null && p[k] !== '') o[k] = k === 't' ? String(p[k]) : round(k, +p[k]);
    return o;
  });
}

function check(text, id) {
  const L = land.evalLand(text);
  L.use(id);
  const r = L.region();
  return { errors: L.validate(r), info: L.info(), types: L.DECO_T || [] };
}

module.exports = {
  kind: 'deco', label: '3D 배치', page: 'scene.html', FILE: land.FILE,
  file: land.file, decoSpan, rebuild, clean, check,

  list(root, games, md5) {
    const out = [];
    for (const game of games) {
      let text;
      try { text = fs.readFileSync(land.file(root, game), 'utf8'); } catch (e) { continue; }
      const L = land.evalLand(text);
      if (!L.DECO_T) continue;                        // deco 층이 없는 옛 land.js
      for (const r of Object.values(L.LANDS)) {
        if (!decoSpan(text, r.id)) continue;
        out.push({ game, id: r.id, name: r.name, ox: r.ox, oy: r.oy, map: r.map, legend: r.legend, places: r.places,
          deco: r.deco || [], types: L.DECO_T, hash: md5(text), report: check(text, r.id) });
      }
    }
    return out;
  },
  validateBody(b) {
    if (typeof b.id !== 'string') return '땅 id 가 없다';
    if (!Array.isArray(b.deco) || b.deco.length > 2000) return 'deco 가 배열이 아니다(또는 2000개 넘음)';
    if (!b.deco.every((p) => p && typeof p.t === 'string' && isFinite(p.x) && isFinite(p.z) && isFinite(p.h))) return 'deco 한 줄에 t·x·z·h 가 다 있어야 한다';
    return null;
  },
  apply: (text, b) => rebuild(text, b.id, clean(b.deco)),
  checkText: (text, b) => check(text, b.id),
  guardTexts: () => null,                              // 글자 칸이 없다(종류는 표에 있는 영문 id 뿐)
};
