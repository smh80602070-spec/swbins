#!/usr/bin/env node
/**
 * `saga-web/shared/assets/{characters3d,world3d}` 폴더의 GLB 이름 → `saga-web/shared/js/assets3d-ids.js` (W-0021)
 *
 *   node tools/gen-assets3d-ids.mjs           쓴다
 *   node tools/gen-assets3d-ids.mjs --check   쓰지 않고 지금 파일과 같은지만(다르면 종료 1 — precheck 가 부른다)
 *
 * 웹 3D 가 "이 영웅·이 지물은 통일 GLB 가 있나" 를 파일을 두드리지 않고 알게 하는 표다. 에셋은 자체툴(K-0019)이 놓으므로
 * 새 GLB 가 들어오면 이 명령을 다시 돌린다. 생성물 — 손으로 고치지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'saga-web', 'shared');
const names = d => fs.existsSync(path.join(SHARED, 'assets', d)) ? fs.readdirSync(path.join(SHARED, 'assets', d)).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)).sort() : [];
/* 8방향 무기 2D 시트(W-0073, K-0029 단계 5 `characters2d8/<id>/`) — { id: [칸 px, cam_z] }. 2D 가 파일을 두드리지 않고(404 없이) 고르고 발 위치를 계산한다 */
function sheets8() {
  const dir = path.join(SHARED, 'assets', 'characters2d8'), o = {};
  if (!fs.existsSync(dir)) return o;
  for (const id of fs.readdirSync(dir).sort()) {
    const mf = path.join(dir, id, 'manifest.json');
    if (!fs.existsSync(mf)) continue;
    try { const m = JSON.parse(fs.readFileSync(mf, 'utf8')); if (m.ndir === 8) o[id] = [m.px || 128, m.cam_z || 0.95]; } catch (e) { /* 깨진 manifest 는 뺀다 */ }
  }
  return o;
}
const out = path.join(SHARED, 'js', 'assets3d-ids.js');
const body = `/* 생성: tools/gen-assets3d-ids.mjs — 손으로 고치지 않는다. 통일 3D 에셋(shared/assets) GLB 이름 표(W-0021) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.assets3dIds = {
    hero: ${JSON.stringify(names('characters3d'))},
    world: ${JSON.stringify(names('world3d'))},
    hero2d8: ${JSON.stringify(sheets8())}
  };
})(typeof window !== 'undefined' ? window : this);
`;
const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
if (process.argv.includes('--check')) {
  if (cur === body) { console.log('OK assets3d-ids.js = 폴더 GLB 이름'); process.exit(0); }
  console.log('DIFF assets3d-ids.js ≠ shared/assets GLB — node tools/gen-assets3d-ids.mjs'); process.exit(1);
}
fs.writeFileSync(out, body);
console.log('쓴 것', out, '· 영웅', names('characters3d').length, '· 지물', names('world3d').length, '· 8방향 2D', Object.keys(sheets8()).length);
