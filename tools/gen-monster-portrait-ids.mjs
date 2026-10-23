// W-0354 — 2나락 몬스터 초상 짝 표를 monster-portrait.js 의 생성 줄(/* gen:mp-ids */)에 쓴다. 손으로 고치지 않는다.
//   HAS   = 초상이 있는 id(saga-dungeon/assets/portraits-monster/<id>_c.webp 파일 이름에서 — K-0121 종 몸·사람 적·옛 계열 32)
//   C2D   = 2D 시트가 있는 종 몸 id(saga-web/shared/assets/creatures2d/<id>/manifest.json — 적 body 와 겹치는 것만)
//           + W-0392: 2나락 공장 시트(saga-dungeon/assets/sprites2d_sheets/index.json factory, K-0170 42) — body 그대로 또는 index.json alias 로 닿는 것(값은 실제 폴더 이름)
//   HUMAN = 사람 적 이름 → 자체 NPC 몸 id(tools/ai-art/data/k121_targets.json humans[].self_body, 초상이 있는 것만)
//   node tools/gen-monster-portrait-ids.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'saga-web/saga-dungeon/assets/portraits-monster');
const SRC = path.join(ROOT, 'tools/ai-art/data/k121_targets.json');
const JS = path.join(ROOT, 'saga-web/saga-dungeon/js/monster-portrait.js');

const has = fs.readdirSync(DIR).filter((f) => /_c\.webp$/.test(f)).map((f) => f.slice(0, -7)).sort();
const set = new Set(has), human = {};
for (const h of (JSON.parse(fs.readFileSync(SRC, 'utf8')).humans || [])) { if (h && h.name && h.self_body && set.has(h.self_body)) { human[h.name] = h.self_body; } }
const C2 = path.join(ROOT, 'saga-web/shared/assets/creatures2d'), EN = fs.readFileSync(path.join(ROOT, 'saga-web/saga-dungeon/js/data-enemy.js'), 'utf8');
const bodies = new Set([...EN.matchAll(/body: *'([a-z0-9_]+)'/g)].map((m) => m[1])), c2dShared = fs.readdirSync(C2).filter((d) => bodies.has(d) && fs.existsSync(path.join(C2, d, 'manifest.json')));
const IDX = JSON.parse(fs.readFileSync(path.join(ROOT, 'saga-web/saga-dungeon/assets/sprites2d_sheets/index.json'), 'utf8')), FAC = new Set(IDX.factory || []), AL = Object.assign({ beast_big: 'dg_elephant' }, IDX.alias || IDX.factory_alias || {});   // W-0392 공장 시트 + 별명(코끼리병 body beast_big = 곰 still → dg_elephant)
const c2d = [...new Set(c2dShared.concat([...bodies].map((b) => AL[b] || b).filter((b) => FAC.has(b))))].sort();
const line = '  var HAS = ' + JSON.stringify(Object.fromEntries(has.map((k) => [k, 1]))) + ', HUMAN = ' + JSON.stringify(human) + ', C2D = ' + JSON.stringify(Object.fromEntries(c2d.map((k) => [k, 1]))) + ', SHEET_ALIAS = ' + JSON.stringify(Object.fromEntries(Object.keys(AL).filter((k) => bodies.has(k) && FAC.has(AL[k])).sort().map((k) => [k, AL[k]]))) + ';   /* gen:mp-ids — tools/gen-monster-portrait-ids.mjs 가 쓴다(W-0354) */';

const raw = fs.readFileSync(JS, 'utf8'), nl = raw.includes('\r\n') ? '\r\n' : '\n', lines = raw.split(/\r?\n/), at = lines.findIndex((l) => l.includes('/* gen:mp-ids'));
if (at < 0) { console.log('FAIL monster-portrait.js 에 /* gen:mp-ids */ 줄이 없다'); process.exit(1); }
if (lines[at] === line) { console.log('OK 같음 · 초상 ' + has.length + ' · 사람 짝 ' + Object.keys(human).length + ' · 2D 종 시트 ' + c2d.length); process.exit(0); }
if (process.argv.includes('--check')) { console.log('DIFF monster-portrait.js gen:mp-ids — node tools/gen-monster-portrait-ids.mjs'); process.exit(1); }
lines[at] = line;
fs.writeFileSync(JS, lines.join(nl));
console.log('WROTE 초상 ' + has.length + ' · 사람 짝 ' + Object.keys(human).length + ' · 2D 종 시트 ' + c2d.length);
