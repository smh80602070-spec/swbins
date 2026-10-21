// W-0356 — 빌린 괴물 GLB 경로(assets/models/monsters/**) → 자체 몸 'crea:<id>'(공용 creatures3d)
// 짝: tools/world-forge/data/k122_monsters.json(pair·built·robots, 키 "폴더/이름") 먼저, 없으면 공용 assets3d.js 의
// CREATURE_DIR_OF·CREATURE_OF(W-0163·0178 동물·괴물 짝). 짝 없는 줄은 그대로 두고 출력에 남긴다(손으로 끼우지 않음).
//   node tools/gen-monster-crea-map.mjs          → 짝 목록·못 찾은 줄만 출력
//   node tools/gen-monster-crea-map.mjs --write  → 세 판 파일 치환
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'saga-web');
const FILES = ['saga-realm/js/data-force.js', 'saga-dungeon/js/asset3d.js', 'saga-forest/js/asset3d.js', 'saga-forest/js/visitor.js'];
const write = process.argv.includes('--write');

const k122 = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/world-forge/data/k122_monsters.json'), 'utf8'));
const K = Object.assign({}, k122.pair, k122.built, k122.robots);
globalThis.window = globalThis;
const req = createRequire(import.meta.url);
req(path.join(WEB, 'shared/js/assets3d-ids.js'));
req(path.join(WEB, 'shared/js/assets3d.js'));
const A3 = globalThis.DG.assets3d, HAVE = new Set(globalThis.DG.assets3dIds.creature || []);

function idFor(dir, name) {
  const key = dir + '/' + name;
  for (const k of [key, key + '(2)']) { if (K[k]) { return K[k]; } }
  if (A3.CREATURE_DIR_SKIP[dir] && A3.CREATURE_DIR_SKIP[dir][name]) { return null; }
  return (A3.CREATURE_DIR_OF[dir] && A3.CREATURE_DIR_OF[dir][name]) || A3.CREATURE_OF[name] || null;
}
// 경로 식 넷: 글자 그대로 · PEOPLE_MONSTERS_Q + '…' · MON + '…' · M + 'monsters/…'
const BASE = { PEOPLE_MONSTERS_Q: 'quaternius/', MON: '', M: '' };
const RE = /(?:\b(PEOPLE_MONSTERS_Q|MON|M) \+ )?'((?:assets\/models\/)?monsters\/)?([A-Za-z0-9_\/]*?)([A-Za-z][A-Za-z0-9_]*?)(?:_[0-9a-f]{8})?\.glb'/g;

const miss = [], hits = [];
for (const rel of FILES) {
  const file = path.join(WEB, rel);
  const src = fs.readFileSync(file, 'utf8');
  let n = 0;
  const out = src.replace(RE, (all, v, pre, sub, name) => {
    if (!v && !pre) { return all; }
    if (v === 'M' && !pre) { return all; }
    if (v && v !== 'M' && pre) { return all; }
    const rest = (v ? BASE[v] : '') + sub;   // "quaternius/" · "space/" · "" (monsters 바로 아래)
    const dir = rest.replace(/\/$/, '').split('/').pop() || 'monsters';
    const id = idFor(dir, name);
    if (!id || !HAVE.has(id)) { miss.push(rel + ' ' + dir + '/' + name + (id ? ' (id ' + id + ' 몸 없음)' : '')); return all; }
    hits.push(rel + ' ' + dir + '/' + name + ' → ' + id); n++;
    return "'crea:" + id + "'";
  });
  if (write && n) { fs.writeFileSync(file, out); }
  console.log(rel + ' 바꿈 ' + n);
}
console.log('짝 ' + hits.length + ' · 못 찾음 ' + miss.length);
for (const m of miss) { console.log('  ✗ ' + m); }
if (process.argv.includes('--list')) { for (const h of hits) { console.log('  ' + h); } }
