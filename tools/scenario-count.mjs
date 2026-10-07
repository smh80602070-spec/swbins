#!/usr/bin/env node
/**
 * 시나리오 장 수 집계 — 세 트랙(웹·고돗·유니티)의 장 표 코드를 세어 scenario/README.md §7 "자동 집계" 표를 만든다.
 * 읽기만 한다(게임 코드·features.json 은 안 건드린다). 못 세는 칸은 '?' — 추측하지 않는다.
 *
 *   node tools/scenario-count.mjs            표를 찍고 tools/_out/scenario-counts.json 에도 쓴다
 *   node tools/scenario-count.mjs --write    scenario/README.md 의 <!-- scenario:begin/end --> 블록을 덮어쓴다
 *
 * 세는 규칙(트랙·판마다 장 표의 모양이 달라 규칙이 따로다)
 *   웹   사가만리      js/story.js 의 `id: 'chN'` 줄 수
 *        블로·숲·스토리  js/data-scenario.js 를 vm 에 돌려 DG.scenarioData.CHAPTERS.length
 *        사가천하    같은 방식, CARDS + LORD + SIDE 길이(사연 카드 사슬 + 열전 + 곁가지)
 *   고돗 사가만리      games/saga_go/data/story_chapters_*.gd 의 줄 머리 `\t{"id": "ch` 줄 수 (나머지 넷은 장 표 없음 = 0)
 *   유니티 사가만리    Assets/Games/SagaGo/Data/GoStory.cs 의 `Id = "chN"` 줄 수
 *        블로·숲·스토리  Resources/scenario_*.json 의 chapters 길이
 *        사가천하    Resources/scenario_realm.json 의 cards + side 길이
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const GAMES = [['go', '사가만리', 'saga-go'], ['dungeon', '사가나락', 'saga-dungeon'], ['forest', '사가마을', 'saga-forest'], ['story', '사가종횡', 'saga-story'], ['realm', '사가천하', 'saga-realm']];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const countRe = (text, re) => (text.match(re) || []).length;
function tryCount(fn) { try { const n = fn(); return Number.isFinite(n) ? n : '?'; } catch (e) { return '?'; } }

function webScenarioData(folder) {
  const sandbox = { window: { DG: {} }, console };
  sandbox.global = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(read(`saga-web/${folder}/js/data-scenario.js`), sandbox);
  return sandbox.window.DG.scenarioData;
}

const web = (key, folder) => tryCount(() => {
  if (key === 'go') return countRe(read('saga-web/saga-go/js/story.js'), /\bid: 'ch\d+'/g);
  const d = webScenarioData(folder);
  if (key === 'realm') return d.CARDS.length + d.LORD.length + d.SIDE.length;
  return d.CHAPTERS.length;
});

const godot = (key) => tryCount(() => {
  if (key !== 'go') return 0;
  const dir = 'saga-godot/games/saga_go/data';
  return fs.readdirSync(path.join(ROOT, dir)).filter((f) => /^story_chapters_\d+\.gd$/.test(f))
    .reduce((n, f) => n + countRe(read(`${dir}/${f}`), /^\t\{"id": "ch/gm), 0);
});

const unity = (key, folder) => tryCount(() => {
  const base = 'saga-unity/Assets/Games/';
  if (key === 'go') return countRe(read(`${base}SagaGo/Data/GoStory.cs`), /\bId = "ch\d+"/g);
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const j = JSON.parse(read(`${base}Saga${cap}/Resources/scenario_${key}.json`));
  if (key === 'realm') return j.cards.length + j.side.length;
  return j.chapters.length;
});

const rows = GAMES.map(([key, name, folder]) => ({ game: name, web: web(key, folder), godot: godot(key), unity: unity(key, folder) }));
const unknown = rows.reduce((n, r) => n + ['web', 'godot', 'unity'].filter((k) => r[k] === '?').length, 0);

const B = '<!-- scenario:begin -->', E = '<!-- scenario:end -->';
const table = [
  B,
  '<!-- 생성: node tools/scenario-count.mjs --write — 손으로 고치지 않는다(덮어쓴다). 세는 규칙은 그 파일 머리말 -->',
  '**자동 집계(정본 숫자)** — 장 표 코드를 직접 센 값. 아래 손 표는 설명용이라 낡을 수 있다.',
  '',
  '| 판 | 사가웹 | 사가고돗 | 사가유니티 |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.game} | ${r.web} | ${r.godot} | ${r.unity} |`),
  E,
].join('\n');

console.log(table);
console.log(`\n? 칸: ${unknown}`);
const outDir = path.join(ROOT, 'tools/_out');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'scenario-counts.json'), JSON.stringify(rows, null, 2));

if (argv.includes('--write')) {
  const p = path.join(ROOT, 'scenario/README.md');
  let s = fs.readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const block = table.split('\n').join(nl);
  const i = s.indexOf(B), j = s.indexOf(E);
  if (i >= 0 && j > i) s = s.slice(0, i) + block + s.slice(j + E.length);
  else {
    const h = s.indexOf('## 7. 진행표');
    if (h < 0) { console.error('README 에 "## 7. 진행표" 절이 없다'); process.exit(1); }
    const eol = s.indexOf('\n', h);
    s = s.slice(0, eol + 1) + nl + block + nl + s.slice(eol + 1);
  }
  fs.writeFileSync(p, s);
  console.log('scenario/README.md §7 갱신');
}
