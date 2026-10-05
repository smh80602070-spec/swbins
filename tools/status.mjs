#!/usr/bin/env node
/**
 * 웹 다섯 판 상태표 — features.json(읽기만)·러너 결과(tools/_out/test-web.json)로 판별 완성도·WIP·큰 파일을 잰다.
 *
 *   node tools/status.mjs          표를 찍고 saga-web/STATE.md 를 덮어쓰고 README.md "현재" 절의 표 블록을 갱신
 *   node tools/status.mjs --big    js 1,500줄 초과 파일 목록(줄 수 내림차순)만
 *   node tools/status.mjs --json   같은 내용을 tools/_out/status.json 에도
 *   node tools/status.mjs --sheet <판>  D1·D2(+조작이 써진 D0) 기능 10개의 확인 시트 → tasks/sheets/<판>-<날짜>.md
 *
 * 완성도 % = 끝낸 기능 ÷ 전체(W-0069). 끝 = 기계로 닫을 수 있는 기능(human 아님)은 D2 이상, 재미·손맛·그림체(`human: true`)는 D3 이상(사람 ○). WIP = D0+D1, 10 을 넘으면 `초과`. 등급 규칙은 SAGA-ARCH §3.1.
 * 의존 없는 node 한 파일. features.json·게임 코드는 쓰지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'saga-web');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const BIG_LINES = 1500, WIP_MAX = 10, STATE_MAX = 8192;
const argv = process.argv.slice(2);

/* 완성도(W-0069) — 숫자·촬영으로 닫을 수 있는 건 D2 가 끝, 사람 몫(human:true: 재미·손맛·그림체)만 D3(사람 ○)가 끝 */
const isDone = x => (x.human === true ? (x.level === 'D3' || x.level === 'D4') : (x.level === 'D2' || x.level === 'D3' || x.level === 'D4'));
const humanOf = a => ({ n: a.filter(x => x.human === true).length, open: a.filter(x => x.human === true && x.level !== 'D3' && x.level !== 'D4').length });
function readJson(p, dflt) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return dflt; } }
function lineCount(p) { const b = fs.readFileSync(p); let n = 0; for (const c of b) if (c === 10) n++; return b.length && b[b.length - 1] !== 10 ? n + 1 : n; }

function bigFiles() {
  const out = [];
  for (const g of GAMES) {
    const dir = path.join(WEB, g, 'js');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (!f.endsWith('.js') || !fs.statSync(p).isFile()) continue; // vendor/·_expansion/ 같은 하위 폴더는 뺀다
      const n = lineCount(p);
      if (n > BIG_LINES) out.push({ file: `saga-web/${g}/js/${f}`, lines: n });
    }
  }
  return out.sort((a, b) => b.lines - a.lines);
}

if (argv.includes('--big')) {
  bigFiles().forEach(x => console.log(`${String(x.lines).padStart(6)}  ${x.file}`));
  process.exit(0);
}

/* ── 확인 시트(SAGA-ARCH §3.2) — 사람이 폰에서 ○/× 만 적는다 ───────────────── */
const si = argv.indexOf('--sheet');
if (si >= 0) {
  const game = argv[si + 1];
  if (!GAMES.includes(game)) { console.error('판 이름이 필요하다: ' + GAMES.join(' ')); process.exit(1); }
  const a = readJson(path.join(WEB, game, 'features.json'), []);
  /* 후보: D1·D2 + 조작(sheet)이 써진 D0. 조작 있는 것을 앞에, 그 안에서 since 오래된 순(같으면 파일 순서) */
  const cand = a.map((x, i) => ({ x, i })).filter(({ x }) => x.level === 'D1' || x.level === 'D2' || (x.level === 'D0' && x.sheet));
  cand.sort((u, v) => (!!v.x.sheet - !!u.x.sheet) || String(u.x.since).localeCompare(String(v.x.since)) || (u.i - v.i));
  const pick = cand.slice(0, 10).map(c => c.x);
  const base = 'https://smh8627-jpg.github.io/swbins/saga-web/' + game + '/';
  const d = new Date(); const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const cell = s => String(s).replace(/\|/g, '/').replace(/\s+/g, ' ');
  const L = [`# 확인 시트 — ${game}`, `${ymd} · 판 ${game} · 기능 ${pick.length}개`, '○/× 만 적어 주세요. 10개 넘게 보지 않아도 됩니다.', '',
    '| n | 기능 | 여는 법 | 조작 | 기대 | ○/× | 메모 |', '|---|---|---|---|---|---|---|'];
  pick.forEach((x, n) => {
    const s = x.sheet;
    const open = s ? `[열기](${base}index.html${s.open || ''})` + (s.preset ? ` · [관리](${base}_admin.html) "${s.preset}"` : '') : '-';
    const steps = s ? s.steps.map((t, k) => (k + 1) + ') ' + t).join(' ') : '조작 미작성';
    L.push(`| ${n + 1} | ${cell(x.name.slice(0, 22))} | ${open} | ${cell(steps)} | ${s ? cell(s.expect) : '-'} | | |`);
  });
  const file = path.join(ROOT, 'tasks', 'sheets', game + '-' + ymd.replace(/-/g, '') + '.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = L.join('\n') + '\n';
  fs.writeFileSync(file, body);
  console.log(path.relative(ROOT, file).replace(/\\/g, '/') + ' (' + Buffer.byteLength(body) + 'B, 기능 ' + pick.length + ', 조작 ' + pick.filter(x => x.sheet).length + ')');
  process.exit(0);
}

const runner = readJson(path.join(ROOT, 'tools', '_out', 'test-web.json'), {});
const rows = [];
for (const g of GAMES) {
  const a = readJson(path.join(WEB, g, 'features.json'), []);
  const lv = k => a.filter(x => x.level === k).length;
  const r = runner[g];
  const fails = new Set(r ? r.fails : []);
  const failFeatures = r ? a.filter(x => x.tests.some(t => fails.has(t))).map(x => x.id) : [];
  const d3 = a.filter(isDone).length, hum = humanOf(a), wip = lv('D0') + lv('D1');
  rows.push({
    game: g, total: a.length, D0: lv('D0'), D1: lv('D1'), D2: lv('D2'), D3p: d3, hum: hum,
    pct: a.length ? Math.round(d3 * 1000 / a.length) / 10 : 0, wip, over: wip > WIP_MAX,
    runner: r ? `${r.n}/${r.m}` : '-', failFeatures,
  });
}

function table() {
  const L = ['| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 n/m | 표시 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  rows.forEach(r => L.push(`| ${r.game} | ${r.total} | ${r.D0} | ${r.D1} | ${r.D2} | ${r.D3p} | ${r.pct}% | ${r.hum.n}(미확인 ${r.hum.open}) | ${r.wip} | ${r.over ? '초과' : '-'} | ${r.runner} | ${r.failFeatures.length ? 'FAIL ' + r.failFeatures.length : '-'} |`));
  return L.join('\n');
}

const big = bigFiles();
const at = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
function stateMd(bigN) {
  const L = [`<!-- 생성: tools/status.mjs · ${at} — 손으로 고치지 않는다(덮어쓴다) -->`, '# saga-web 상태', '',
    '완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1', '', table(), ''];
  const over = rows.filter(r => r.over).map(r => r.game);
  L.push('## 초과 판', '', over.length ? over.join(' · ') : '없음', '');
  const fl = rows.filter(r => r.failFeatures.length);
  if (fl.length) { L.push('## 러너 FAIL 이 걸린 기능', ''); fl.forEach(r => L.push(`- ${r.game}: ${r.failFeatures.join(', ')}`)); L.push(''); }
  L.push(`## js ${BIG_LINES}줄 초과 (상위 ${bigN})`, '');
  big.slice(0, bigN).forEach(x => L.push(`- ${x.lines} — ${x.file}`));
  if (big.length > bigN) L.push(`- … 외 ${big.length - bigN}개(\`node tools/status.mjs --big\`)`);
  return L.join('\n') + '\n';
}
let state = stateMd(10);
if (Buffer.byteLength(state) >= STATE_MAX) state = stateMd(5);
fs.writeFileSync(path.join(WEB, 'STATE.md'), state);

/* 루트 README "현재" 절 — 표 블록만 표식 사이에서 갈아 끼운다(표식이 없으면 그 절의 "트랙마다 상세 상태는" 줄 앞에 넣는다) */
const readme = path.join(ROOT, 'README.md');
let md = fs.readFileSync(readme, 'utf8');
const eol = md.includes('\r\n') ? '\r\n' : '\n';
const B = '<!-- status:begin -->', E = '<!-- status:end -->';
const block = [B, `웹 다섯 판 기능 등록부 현황(\`node tools/status.mjs\` 가 덮어씀 · ${at}):`, '', table(), E].join(eol);
const i = md.indexOf(B), j = md.indexOf(E);
if (i >= 0 && j > i) md = md.slice(0, i) + block + md.slice(j + E.length);
else {
  const anchor = md.indexOf('트랙마다 상세 상태는');
  if (anchor < 0) { console.error('README.md "현재" 절 자리를 못 찾음'); process.exit(1); }
  md = md.slice(0, anchor) + block + eol + eol + md.slice(anchor);
}
fs.writeFileSync(readme, md);

/* saga-unity — features.json(id 접두 un.) 로 saga-unity/docs/STATE.md 를 만든다(U-0004). 러너 결과는 saga-unity/.utmp/playtest_last.json({n,m,fails[]})이 있으면 쓴다. */
const UNITY = path.join(ROOT, 'saga-unity');
const UNITY_GAMES = [['un.go.', 'GO'], ['un.dg.', 'DUNGEON'], ['un.fs.', 'FOREST'], ['un.st.', 'STORY'], ['un.rk.', 'REALM']];
const uAll = readJson(path.join(UNITY, 'features.json'), []);
const uRun = readJson(path.join(UNITY, '.utmp', 'playtest_last.json'), null);
const uFails = new Set(uRun ? uRun.fails || [] : []);
const uRows = UNITY_GAMES.map(([pre, name]) => {
  const a = uAll.filter(x => x.id.startsWith(pre));
  const lv = k => a.filter(x => x.level === k).length;
  const d3 = a.filter(isDone).length, hum = humanOf(a), wip = lv('D0') + lv('D1');
  return { game: name, total: a.length, D0: lv('D0'), D1: lv('D1'), D2: lv('D2'), D3p: d3, hum: hum,
    pct: a.length ? Math.round(d3 * 1000 / a.length) / 10 : 0, wip, over: wip > WIP_MAX,
    failN: uRun ? a.filter(x => x.tests.some(t => uFails.has(t))).length : 0 };
});
function uTable() {
  const L = ['| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 | 표시 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  uRows.forEach(r => L.push(`| ${r.game} | ${r.total} | ${r.D0} | ${r.D1} | ${r.D2} | ${r.D3p} | ${r.pct}% | ${r.hum.n}(미확인 ${r.hum.open}) | ${r.wip} | ${r.over ? '초과' : '-'} | ${uRun ? `${uRun.n}/${uRun.m}` : '-'} | ${r.failN ? 'FAIL ' + r.failN : '-'} |`));
  return L.join('\n');
}
const uNoTest = uAll.filter(x => x.tests.length === 0).length;
const uState = [`<!-- 생성: tools/status.mjs · ${at} — 손으로 고치지 않는다(덮어쓴다) -->`, '# saga-unity 상태', '',
  '완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1 · 기능 목록 `saga-unity/features.json`', '',
  uTable(), '', `Playtest 가 안 붙은 기능(D0): ${uNoTest}개 — 목록은 features.json 에서 tests 가 빈 것`, ''].join('\n');
if (uAll.length) {
  fs.mkdirSync(path.join(UNITY, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(UNITY, 'docs', 'STATE.md'), uState);
}

/* saga-godot — features.json(id 접두 gd.) 로 saga-godot/docs/STATE.md 를 만든다(G-0002). 러너 결과는 saga-godot/tools/_out/probe_all.json({probes,results[{name,fails}]})이 있으면 쓴다(부분 실행이면 그 만큼만). */
const GODOT = path.join(ROOT, 'saga-godot');
const GODOT_GAMES = [['gd.go.', 'GO'], ['gd.dg.', 'DUNGEON'], ['gd.fs.', 'FOREST'], ['gd.st.', 'STORY'], ['gd.rk.', 'REALM']];
const gAll = readJson(path.join(GODOT, 'features.json'), []);
const gRun = readJson(path.join(GODOT, 'tools', '_out', 'probe_all.json'), null);
const gFails = new Set(gRun ? gRun.results.filter(x => x.fails > 0).map(x => x.name) : []);
const gRows = GODOT_GAMES.map(([pre, name]) => {
  const a = gAll.filter(x => x.id.startsWith(pre));
  const lv = k => a.filter(x => x.level === k).length;
  const d3 = a.filter(isDone).length, hum = humanOf(a), wip = lv('D0') + lv('D1');
  return { game: name, total: a.length, D0: lv('D0'), D1: lv('D1'), D2: lv('D2'), D3p: d3, hum: hum,
    pct: a.length ? Math.round(d3 * 1000 / a.length) / 10 : 0, wip, over: wip > WIP_MAX,
    failN: gRun ? a.filter(x => x.tests.some(t => gFails.has(t))).length : 0 };
});
function gTable() {
  const L = ['| 판 | 기능 | D0 | D1 | D2 | 끝 | 완성도 | 사람 몫 | WIP | 초과 | 러너 | 표시 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const run = gRun ? `${gRun.probes - gFails.size}/${gRun.probes}` : '-';
  gRows.forEach(r => L.push(`| ${r.game} | ${r.total} | ${r.D0} | ${r.D1} | ${r.D2} | ${r.D3p} | ${r.pct}% | ${r.hum.n}(미확인 ${r.hum.open}) | ${r.wip} | ${r.over ? '초과' : '-'} | ${run} | ${r.failN ? 'FAIL ' + r.failN : '-'} |`));
  return L.join('\n');
}
const gNoTest = gAll.filter(x => x.tests.length === 0).length;
const gState = [`<!-- 생성: tools/status.mjs · ${at} — 손으로 고치지 않는다(덮어쓴다) -->`, '# saga-godot 상태', '',
  '완성도 = 끝 ÷ 전체(끝 = 사람 몫 아님 D2+ · 사람 몫 human:true 는 D3+) · WIP = D0+D1(10 초과 시 `초과`) · 등급 규칙 SAGA-ARCH §3.1 · 기능 목록 `saga-godot/features.json` · 러너 = `tools/probe_all.sh`(마지막 실행의 통과/실행 probe 수)', '',
  gTable(), '', `probe 가 안 붙은 기능(D0): ${gNoTest}개 — 목록은 features.json 에서 tests 가 빈 것`, ''].join('\n');
if (gAll.length) {
  fs.mkdirSync(path.join(GODOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(GODOT, 'docs', 'STATE.md'), gState);
}

console.log(table());
console.log(`STATE.md 갱신 (${Buffer.byteLength(state)}B) · README.md "현재" 표 갱신`);
if (gAll.length) { console.log(gTable()); console.log(`saga-godot/docs/STATE.md 갱신 (${Buffer.byteLength(gState)}B)`); }
if (uAll.length) { console.log(uTable()); console.log(`saga-unity/docs/STATE.md 갱신 (${Buffer.byteLength(uState)}B)`); }
if (argv.includes('--json')) {
  fs.mkdirSync(path.join(ROOT, 'tools', '_out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tools', '_out', 'status.json'), JSON.stringify({ at, rows, big }, null, 1));
}
