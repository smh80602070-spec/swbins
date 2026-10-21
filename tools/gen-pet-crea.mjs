// W-0352 — 1만리 펫 2D 그림 짝 표를 sprite.js 의 생성 칸(/* gen:pet-crea */ 줄)에 쓴다. 손으로 고치지 않는다.
//   PET_CREA = 펫 id → 종 몸 2D 시트 id(shared/assets/creatures2d/<id>/, 출처 tools/world-forge/data/k143_sheet_targets.json pets_by_id 뒤집기)
//   PET_OWN  = 제 그림이 있는 펫 id — 이 펫은 시트보다 제 그림 먼저(3D 도 제 몸)(saga-go/assets/sprites2d/beast_<펫 id>.png, K-0120)
//   node tools/gen-pet-crea.mjs [--check]   (--check = 다르면 DIFF 출력·종료 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/world-forge/data/k143_sheet_targets.json');
const SPR = path.join(ROOT, 'saga-web/saga-go/js/sprite.js');
const IMG = path.join(ROOT, 'saga-web/saga-go/assets/sprites2d');
const CREA = path.join(ROOT, 'saga-web/shared/assets/creatures2d');

const by = JSON.parse(fs.readFileSync(SRC, 'utf8')).pets_by_id || {};
const crea = {};
for (const cid of Object.keys(by).sort()) {
  if (!fs.existsSync(path.join(CREA, cid, 'manifest.json'))) { continue; }   // 시트가 아직 없는 종은 넣지 않는다
  for (const pid of by[cid]) { if (!crea[pid]) { crea[pid] = cid; } }
}
const own0 = fs.readdirSync(IMG).filter((f) => /^beast_(pk|pt)_.+\.png$/.test(f)).map((f) => f.slice(6, -4)).sort(), own = own0;
/* 제 그림이 있는 펫(오마주 17)은 3D 도 제 몸(pet_<id>.glb, W-0148)이라 빌린 종 시트를 넣지 않는다 — 2D·3D 가 같은 동물 */
for (const pid of own) { delete crea[pid]; }
const sorted = Object.fromEntries(Object.keys(crea).sort().map((k) => [k, crea[k]]));
const line = '  var PET_CREA = ' + JSON.stringify(sorted) + ', PET_OWN = ' + JSON.stringify(Object.fromEntries(own.map((k) => [k, 1]))) + ';   /* gen:pet-crea — tools/gen-pet-crea.mjs 가 쓴다(W-0352) */';

const raw = fs.readFileSync(SPR, 'utf8'), nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/), at = lines.findIndex((l) => l.includes('/* gen:pet-crea'));
if (at < 0) { console.log('FAIL sprite.js 에 /* gen:pet-crea */ 줄이 없다'); process.exit(1); }
if (lines[at] === line) { console.log('OK 같음 · 시트 ' + Object.keys(sorted).length + ' · 제 그림 ' + own.length); process.exit(0); }
if (process.argv.includes('--check')) { console.log('DIFF sprite.js gen:pet-crea — node tools/gen-pet-crea.mjs'); process.exit(1); }
lines[at] = line;
fs.writeFileSync(SPR, lines.join(nl));
console.log('WROTE 시트 ' + Object.keys(sorted).length + ' · 제 그림 ' + own.length);
