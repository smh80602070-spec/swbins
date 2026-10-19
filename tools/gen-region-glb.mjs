#!/usr/bin/env node
/**
 * W-0319 — 1만리 이야기 지역 코드 도형 → 자체 world3d GLB 표를 만든다.
 *   node tools/gen-region-glb.mjs          saga-web/saga-go/js/region-glb-table.js 를 다시 쓴다
 *   node tools/gen-region-glb.mjs --check  다르면 종료 1
 * 원본 = tools/world-forge/data/k125_markers.json(K 몫 — 안 고친다). 지역마다 pair(짝)·built(새 GLB) 를 { model: { id, h?, parent?, hide? } } 로.
 * pair 의 n(여러 개)은 아직 코드 그대로(자리 여럿을 코드에서 읽어야 해서 — 티켓 메모). 손으로 덧붙이는 칸은 아래 OV.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/world-forge/data/k125_markers.json');
const OUT = path.join(ROOT, 'saga-web/saga-go/js/region-glb-table.js');
const W3 = path.join(ROOT, 'saga-web/shared/assets/world3d');
/* 손으로 덧붙임 — parent: GLB 를 o.<이름> 안에 넣는다(그 묶음이 움직임) · hide: o 에 쥐었지만 몸통이라 숨길 묶음 */
const OV = {
  frost: { ship: { parent: 'hull', hide: ['hull'] } }
};
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const table = {}, skipped = [], missing = [];
for (const [r, v] of Object.entries(j.regions)) {
  const t = {};
  for (const [k, e] of Object.entries(v.pair || {})) {
    if (e.n > 1) { skipped.push(r + '.' + k + '(n' + e.n + ')'); continue; }
    t[k] = { id: e.id, h: e.h };
  }
  for (const [k, e] of Object.entries(v.built || {})) {
    const o = typeof e === 'string' ? { id: e } : e;
    t[k] = o.h ? { id: o.id, h: o.h } : { id: o.id };
  }
  for (const [k, ov] of Object.entries(OV[r] || {})) { if (t[k]) { Object.assign(t[k], ov); } }
  for (const e of Object.values(t)) { if (!fs.existsSync(path.join(W3, e.id + '.glb'))) { missing.push(e.id); } }
  if (Object.keys(t).length) { table[r] = t; }
}
const n = Object.values(table).reduce((a, t) => a + Object.keys(t).length, 0);
const body = `/* 생성: tools/gen-region-glb.mjs(원본 tools/world-forge/data/k125_markers.json) — 손으로 고치지 않는다. W-0319 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.regionGlbTable = ${JSON.stringify(table)};
  global.DG.regionGlbSkipped = ${JSON.stringify(skipped)};
})(window);
`;
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== body) { console.log('DIFF region-glb-table.js — node tools/gen-region-glb.mjs'); process.exit(1); }
  console.log('OK region-glb-table ' + n); process.exit(0);
}
fs.writeFileSync(OUT, body);
console.log(`region-glb-table: 지역 ${Object.keys(table).length} · 항목 ${n} · n>1 미룸 ${skipped.length} [${skipped.join(' ')}] · 파일 없음 ${missing.length}${missing.length ? ' [' + missing.join(' ') + ']' : ''}`);
