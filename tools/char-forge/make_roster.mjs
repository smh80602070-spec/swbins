#!/usr/bin/env node
/**
 * 인물 명단 뼈대 — 도감 105(saga-go/js/data.js) + 사가천하 장수(saga-realm/js/data-force.js, 초상이 있는 것)를
 * 한 표로 모아 tools/char-forge/data/roster.json 을 만든다(K-0021 단계 1). 읽기만 한다(게임 코드는 안 건드린다).
 *
 *   node tools/char-forge/make_roster.mjs          표를 찍고 roster.json 을 쓴다(없으면 만든다)
 *   node tools/char-forge/make_roster.mjs --check  파일이 지금 데이터와 같은지만 본다(다르면 종료 1)
 *
 * 항목: id(세이브·도감 id — 바꾸지 않는다) · src(codex|realm) · name(표시 가명) · era · faction · rarity · trait · emoji.
 * 성별·체형·몸 레시피는 다음 단계(K-0021 단계 3)가 채운다 — 데이터에 없는 값은 추측하지 않고 null.
 * 인원은 하드코딩하지 않는다: 초상(`saga-realm/assets/portraits/hero/<id>_s.webp`)이 있는 인물 + 도감 전원.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tools', 'char-forge', 'data', 'roster.json');
const check = process.argv.includes('--check');

const sb = { window: { DG: {} }, console, Math, Date };
sb.global = sb.window; sb.self = sb.window;
vm.createContext(sb);
for (const f of ['saga-web/saga-realm/js/data.js', 'saga-web/saga-realm/js/data-force.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
}
const DG = sb.window.DG;
const codex = DG.data.heroes;
const F = DG.forceData;

const portraitDir = path.join(ROOT, 'saga-web/saga-realm/assets/portraits/hero');
const hasPortrait = new Set(fs.readdirSync(portraitDir).filter((f) => f.endsWith('_s.webp')).map((f) => f.slice(0, -'_s.webp'.length)));

const officers = new Map();
for (const k of Object.keys(F)) {
  if (/OFFICERS$/.test(k) && Array.isArray(F[k])) for (const o of F[k]) if (o && o.id && !officers.has(o.id)) officers.set(o.id, o);
}

const row = (o, src) => ({
  id: o.id, src, name: o.name, era: o.era || null, faction: o.faction || null,
  rarity: o.rarity ?? null, trait: o.trait || null, emoji: o.emoji || null,
  gender: null, build: null,
});
const roster = [];
const seen = new Set();
for (const h of codex) { roster.push(row(h, 'codex')); seen.add(h.id); }
for (const o of [...officers.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  if (seen.has(o.id) || !hasPortrait.has(o.id)) continue;
  roster.push(row(o, 'realm')); seen.add(o.id);
}
const noPortrait = codex.filter((h) => !hasPortrait.has(h.id)).length;
const missing = [...hasPortrait].filter((i) => !seen.has(i));

const body = JSON.stringify({
  note: '인물 명단 뼈대(K-0021). 생성: node tools/char-forge/make_roster.mjs — 손으로 고치지 않는다. 성별·체형은 다음 단계가 채운다.',
  total: roster.length,
  by_src: { codex: roster.filter((r) => r.src === 'codex').length, realm: roster.filter((r) => r.src === 'realm').length },
  heroes: roster,
}, null, 1) + '\n';

console.log(`인물 ${roster.length}명 (도감 ${codex.length} + 사가천하 장수 ${roster.length - codex.length}) · 초상 있는 id ${hasPortrait.size} · 명단에 못 든 초상 ${missing.length} · 초상 없는 도감 ${noPortrait}`);
if (missing.length) console.log('명단에 없는 초상 id:', missing.slice(0, 10).join(', '));

if (check) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== body) { console.error('roster.json 이 지금 데이터와 다르다 — node tools/char-forge/make_roster.mjs'); process.exit(1); }
  console.log('roster.json 최신');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  console.log('쓴 파일: ' + path.relative(ROOT, OUT));
}
