// W-0360 — 판 손 배치 3D 모델(saga-web/<판>/assets/models/**)을 shared/assets/models 한 벌로 모은다.
// 단위 = models 아래 첫 폴더(+ 둘째가 폴더면 둘째까지, 예 people/mpfb_real · anim · standin) — .gltf·.bin·텍스처가 한 단위로 움직인다.
// 판마다 단위의 서명(파일 상대 경로 + md5 전부)을 보고, 같은 서명인 판이 둘 이상인 가장 큰 무리를 정본으로 shared 에 둔다.
// 서명이 다른 판(색 바꾼 사본·파일이 더 있는 판)은 제 것을 그대로 둔다. 판마다 옮긴 단위 목록을 js/models-shared.js 로 쓴다
// (공용 assets3d.creatureFor 가 그 목록으로 assets/models/… → shared 주소). shared 에 이미 같은 단위가 있으면 그것과 같아야만 모은다.
//   node tools/gen-models-shared.mjs           → 미리보기(단위·무리·줄어드는 MB)
//   node tools/gen-models-shared.mjs --write   → git mv(정본 한 판) · git rm(나머지 같은 판) · 판 js/models-shared.js
//   node tools/gen-models-shared.mjs --check   → 판 models-shared.js 가 지금 파일 배치와 맞나(옮긴 단위가 판에 남았거나 shared 에 없으면 FAIL)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'saga-web');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const rel = (base, f) => path.relative(base, f).replace(/\\/g, '/');
function unitOf(r) { const p = r.split('/'); return p.length > 2 ? p[0] + '/' + p[1] : p[0]; }
function units(base) {
  const out = {};
  for (const f of walk(base)) { const r = rel(base, f), u = unitOf(r); (out[u] = out[u] || []).push(r); }
  return out;
}
function sig(base, list) { return list.slice().sort().map((r) => r + ':' + md5(path.join(base, r))).join('\n'); }
const genFile = (g) => path.join(WEB, g, 'js', 'models-shared.js');
function readGen(g) { const f = genFile(g); if (!fs.existsSync(f)) { return []; } const m = /modelsShared = (\[.*?\]);/.exec(fs.readFileSync(f, 'utf8')); return m ? JSON.parse(m[1]) : []; }

if (check) {
  let bad = 0;
  for (const g of GAMES) {
    for (const u of readGen(g)) {
      if (!fs.existsSync(path.join(WEB, 'shared/assets/models', u))) { console.log('FAIL', g, u, 'shared 에 없음'); bad++; }
      if (fs.existsSync(path.join(WEB, g, 'assets/models', u))) { console.log('FAIL', g, u, '판에 아직 있음'); bad++; }
    }
  }
  console.log(bad ? 'MODELS_SHARED FAIL ' + bad : 'MODELS_SHARED OK');
  process.exit(bad ? 1 : 0);
}

const SH = path.join(WEB, 'shared/assets/models');
const per = {}, all = new Set();
for (const g of GAMES) { per[g] = units(path.join(WEB, g, 'assets/models')); Object.keys(per[g]).forEach((u) => all.add(u)); }
const shU = units(SH);
const plan = [];   // { u, src, games:[...], mb }
let saveMB = 0;
for (const u of [...all].sort()) {
  const bySig = {};
  for (const g of GAMES) { if (per[g][u]) { const s = sig(path.join(WEB, g, 'assets/models'), per[g][u]); (bySig[s] = bySig[s] || []).push(g); } }
  let best = null;
  for (const s of Object.keys(bySig)) { if (!best || bySig[s].length > bySig[best].length) { best = s; } }
  const gs = best ? bySig[best] : [];
  const already = shU[u] ? sig(SH, shU[u]) : null;
  if (already !== null) {
    const same = Object.keys(bySig).find((s) => s === already);
    if (!same) { continue; }                      // shared 에 다른 내용 — 안 섞는다
    const g2 = bySig[same]; const size = per[g2[0]][u].reduce((a, r) => a + fs.statSync(path.join(WEB, g2[0], 'assets/models', r)).size, 0) / 1048576;
    plan.push({ u, src: null, games: g2, mb: size * g2.length }); saveMB += size * g2.length; continue;
  }
  if (gs.length < 2) { continue; }
  const size = per[gs[0]][u].reduce((a, r) => a + fs.statSync(path.join(WEB, gs[0], 'assets/models', r)).size, 0) / 1048576;
  plan.push({ u, src: gs[0], games: gs, mb: size * (gs.length - 1) }); saveMB += size * (gs.length - 1);
}
plan.sort((a, b) => b.mb - a.mb);
for (const p of plan) { console.log(p.mb.toFixed(1).padStart(6) + 'MB', p.u, '←', p.games.map((g) => g.replace('saga-', '')).join(','), p.src ? '' : '(shared 에 이미)'); }
console.log('단위 ' + plan.length + ' · 줄어듦 ' + saveMB.toFixed(1) + 'MB');
if (!write) { process.exit(0); }

const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { stdio: 'pipe' });
const moved = {}; GAMES.forEach((g) => { moved[g] = new Set(readGen(g)); });
for (const p of plan) {
  if (p.src) {
    fs.mkdirSync(path.dirname(path.join(SH, p.u)), { recursive: true });
    git('mv', rel(ROOT, path.join(WEB, p.src, 'assets/models', p.u)), rel(ROOT, path.join(SH, p.u)));
  }
  for (const g of p.games) {
    if (g !== p.src) { git('rm', '-r', '-q', '--', rel(ROOT, path.join(WEB, g, 'assets/models', p.u))); }
    moved[g].add(p.u);
  }
}
for (const g of GAMES) {
  const list = [...moved[g]].sort();
  fs.writeFileSync(genFile(g), '/* tools/gen-models-shared.mjs 가 쓴다 — 손으로 고치지 않는다. 이 판이 shared/assets/models 한 벌로 옮긴 단위(W-0360) */\n'
    + '(function (g) { g.DG = g.DG || {}; g.DG.modelsShared = ' + JSON.stringify(list) + '; })(typeof window !== \'undefined\' ? window : this);\n');
  console.log('씀', g, list.length);
}
