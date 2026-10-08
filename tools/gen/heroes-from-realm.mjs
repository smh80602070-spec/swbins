#!/usr/bin/env node
/**
 * W-0115 — 사가천하 장수(초상이 있는 194, K-0021 명단 `tools/char-forge/data/roster.json` 의 src:"realm")를
 * 다섯 판 도감 `saga-web/<판>/js/data.js` 에 한 절씩 붙인다. 다시 돌리면 같은 결과(그 절들만 갈아 끼운다).
 *
 *   node tools/gen/heroes-from-realm.mjs          다섯 벌 data.js 를 쓰고 + 네 판 초상 manifest 에 194 id 를 합친다
 *   node tools/gen/heroes-from-realm.mjs --check  지금 파일이 생성 결과와 같은지만 본다(다르면 종료 1)
 *
 * 붙이는 절 셋(각 표 끝, 머리줄 `// ── 사가천하 장수(K-0021 명단) ──`):
 *   HEROES    원본 `saga-web/saga-realm/js/data-force.js`(읽기만)의 id·표시 글자(name·hanja·quote·emoji)·era·rarity·stats 그대로 +
 *             `realm: true`(사본 표시 — 사가천하 officer.js 가 걷어 내고 원본을 얹는다 · vroid-variant 가 원래 인물 색을 안 흔든다).
 *             다른 점 둘: 기질 `command`(통솔, 사가천하에만)는 도감 세 기질(설득 어필이 무·지·덕)에 없어 `virtue` 로
 *             (genchar 들이 virtue 를 통솔 쪽으로 보는 것과 같은 짝) · 세력 '삼국지'(원본 O() 의 자리표)는 첫 시나리오
 *             세력표로 위·촉·오·군웅, 어느 세력에도 없으면 재야.
 *   BIOS      열전 한 줄 — 지역·세력·기질·가장 높은 자질·등급으로 짓는다(실명 없음).
 *   FACTIONS  도감에 없는 세력(사가천하 도시 이름) — 빛깔은 지역(era)마다 하나, 표식은 도시 한자 첫 글자.
 * 초상: 네 판에 K-0087 이 파일을 놓았지만 manifest.js 에 안 적혀 있어, 파일이 있는 id 만 hero s·c 목록에 합친다.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const MARK = '    // ── 사가천하 장수(K-0021 명단) ──';
const check = process.argv.includes('--check');

/* 원본 — 모든 *OFFICERS 배열(시나리오 `use` 전 상태) + 도시(한자) + 지금 도감(세력표) */
const sb = { window: { DG: {} }, console, Math, Date };
sb.global = sb.window; sb.self = sb.window;
vm.createContext(sb);
/* 도감은 생성 절을 걷어 낸 원래 모습으로 읽는다(다시 돌려도 같은 결과) */
const stripped = fs.readFileSync(path.join(ROOT, 'saga-web/saga-go/js/data.js'), 'utf8').replace(/\r\n/g, '\n')
  .replace(/    \/\/ ── 사가천하 장수\(K-0021 명단\) ──[^]*?(?=\n  [\]}];)/g, '');
vm.runInContext(stripped, sb, { filename: 'data.js' });
for (const f of ['saga-web/saga-realm/js/data-force.js', 'saga-web/saga-realm/js/data-city.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
}
const DG = sb.window.DG, F = DG.forceData;
const officers = new Map();
for (const k of Object.keys(F)) {
  if (/OFFICERS$/.test(k) && Array.isArray(F[k])) for (const o of F[k]) if (o && o.id && !officers.has(o.id)) officers.set(o.id, o);
}
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/char-forge/data/roster.json'), 'utf8'));
const ids = roster.heroes.filter((r) => r.src === 'realm').map((r) => r.id);
if (!ids.length) { console.error('roster.json 에 src:"realm" 이 없다'); process.exit(1); }

/* 삼국지 장수 → 첫 시나리오 세력(군주 가명 세력 id → 도감 세력) */
const SANGUO = { cao: '위', bei: '촉', ce: '오' };
const forceOf = {};
for (const f of Object.values(F.FORCES || {})) for (const id of f.officers || []) forceOf[id] = SANGUO[f.id] || '군웅';
if (F.FORCES) for (const f of Object.values(F.FORCES)) if (f.lord) forceOf[f.lord] = SANGUO[f.id] || '군웅';

const REGION_COLOR = {
  '대진': '#8c6a3f', '균열': '#6a3f8c', '교주': '#2f8c7a', '일본': '#b0475a', '한국': '#3f6fae', '임읍': '#4f9a4a',
  '막북': '#9a8a5a', '남해': '#2f7fa8', '남중': '#7a8c2f', '폐허': '#7a6a6a', '실크로드': '#c08a3a', '묘역': '#4a5a6a',
  '천축': '#c0603a', '선비': '#5a7a9a', '서역': '#b09a4a',
};
const regionOf = (era) => String(era || '').replace(/\(가상\)$/, '');
const cityHanja = {};
for (const c of (DG.cityData && DG.cityData.CITIES) || []) if (c && c.name && c.hanja && !cityHanja[c.name]) cityHanja[c.name] = c.hanja;

const recs = ids.map((id) => {
  const o = officers.get(id);
  if (!o) { console.error('data-force.js 에 없는 id: ' + id); process.exit(1); }
  const faction = o.faction === '삼국지' ? (forceOf[o.id] || '재야') : o.faction;
  return { o, faction, trait: o.trait === 'command' ? 'virtue' : o.trait };
});

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const heroLines = recs.map(({ o, faction, trait }) => {
  const s = o.stats;
  let t = `    { id: ${q(o.id)}, name: ${q(o.name)}, era: ${q(o.era)}, faction: ${q(faction)}, rarity: ${o.rarity}, trait: ${q(trait)}, ` +
    `stats: { might: ${s.might}, wisdom: ${s.wisdom}, command: ${s.command} }, hanja: ${q(o.hanja)}, emoji: ${q(o.emoji)}, quote: ${q(o.quote)}`;
  if (o.monster) t += ', monster: true';
  if (o.boss) t += ', boss: true';
  return t + ', realm: true },';
});

const ROLE = { might: '무장', wisdom: '책사', virtue: '덕장', command: '장수' };
const DEED = {
  might: '창을 들면 앞을 막는 이가 드물었다.',
  wisdom: '계책 하나로 싸움의 판을 뒤집곤 했다.',
  command: '군을 부리면 대열이 끝까지 흐트러지지 않았다.',
};
const bioLines = recs.map(({ o, faction }) => {
  const s = o.stats;
  const top = s.might >= s.wisdom && s.might >= s.command ? 'might' : (s.wisdom >= s.command ? 'wisdom' : 'command');
  const region = o.era === '삼국지' ? '삼국' : regionOf(o.era);
  const role = (o.monster ? '이형(異形)의 ' : '') + (o.boss ? '우두머리' : ROLE[o.trait] || '장수');
  const tail = o.rarity >= 5 ? ' 그 이름이 천하에 울렸다.' : (o.rarity <= 2 ? ' 이름은 작아도 제 몫은 해냈다.' : '');
  return `    ${o.id}: ${q(`${region} ${faction} 쪽의 ${role}. ${DEED[top]}${tail}`)},`;
});

const factionLines = [];
const seenF = new Set(Object.keys(DG.data.factions));
for (const { o, faction } of recs) {
  if (seenF.has(faction)) continue;
  seenF.add(faction);
  const color = REGION_COLOR[regionOf(o.era)] || '#5b6572';
  const mark = (cityHanja[faction] || faction).charAt(0);
  factionLines.push(`    ${q(faction)}: { color: ${q(color)}, mark: ${q(mark)} },`);
}

const head = (n) => MARK + ` ${n} · 생성 node tools/gen/heroes-from-realm.mjs — 손으로 고치지 않는다(W-0115) ──\n`;
const SECTIONS = [
  { open: '  var HEROES = [', close: '\n  ];', body: head(ids.length) + heroLines.join('\n') + '\n' },
  { open: '  var BIOS = {', close: '\n  };', body: head(ids.length) + bioLines.join('\n') + '\n' },
  { open: '  var FACTIONS = {', close: '\n  };', body: head(factionLines.length) + factionLines.join('\n') + '\n' },
];

/* 표마다 닫는 줄 앞에 절을 넣는다(이미 절이 있으면 그 절을 갈아 끼운다) — 마지막 절은 끝 쉼표를 뗀다 */
function patch(src) {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let t = src.replace(/\r\n/g, '\n');
  for (const S of SECTIONS) {
    const start = t.indexOf(S.open);
    const end = t.indexOf(S.close, start);
    if (start < 0 || end < 0) throw new Error('표를 못 찾음: ' + S.open.trim());
    const body = t.slice(0, end + 1);
    const at = body.indexOf(MARK, start);
    const before = (at >= 0 ? body.slice(0, at) : body).replace(/([}'])(\s*)$/, '$1,$2');   // 앞 절 마지막 항목에 쉼표
    t = before + S.body.replace(/,\n$/, '\n') + t.slice(end + 1);
  }
  return t.replace(/\n/g, eol);
}

let bad = 0;
for (const g of GAMES) {
  const f = path.join(ROOT, 'saga-web', g, 'js', 'data.js');
  const cur = fs.readFileSync(f, 'utf8');
  const next = patch(cur);
  if (check) { if (cur !== next) { console.error('다름: ' + path.relative(ROOT, f)); bad++; } continue; }
  if (cur !== next) fs.writeFileSync(f, next);
}

/* 초상 manifest — 파일이 있는 194 id 를 hero s·c 에 합친다(bake.mjs 의 합치기와 같은 꼴) */
for (const g of GAMES) {
  const dir = path.join(ROOT, 'saga-web', g, 'assets', 'portraits');
  const mf = path.join(dir, 'manifest.js');
  if (!fs.existsSync(mf)) continue;
  const cur = fs.readFileSync(mf, 'utf8');
  const m = cur.match(/DG\.portraitDisk=(\{.*\});/s);
  if (!m) { console.error('manifest 꼴이 다름: ' + path.relative(ROOT, mf)); bad++; continue; }
  const M = JSON.parse(m[1]);
  for (const t of ['s', 'c']) {
    const set = new Set(String(M.ids.hero[t] || '').split(',').filter(Boolean));
    for (const id of ids) if (fs.existsSync(path.join(dir, 'hero', `${id}_${t}.webp`))) set.add(id);
    M.ids.hero[t] = [...set].sort().join(',');
  }
  const next = cur.replace(m[1], () => JSON.stringify(M));
  if (check) { if (cur !== next) { console.error('다름: ' + path.relative(ROOT, mf)); bad++; } continue; }
  if (cur !== next) fs.writeFileSync(mf, next);
}

console.log(`사가천하 장수 ${ids.length}(열전 ${bioLines.length} · 새 세력 ${factionLines.length}) → 다섯 판` + (check ? (bad ? ` — 다름 ${bad}` : ' — 최신') : ' — 씀'));
process.exit(bad ? 1 : 0);
