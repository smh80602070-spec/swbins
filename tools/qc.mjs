#!/usr/bin/env node
/**
 * QC — 사람 대신 돌아가는 품질 점검 한 명령 (사용자 2026-10-07 "QC 를 직접 돌리는 로직 — 실기 요청할 때 자동으로").
 *
 *   node tools/qc.mjs                         웹 다섯 판 quick
 *   node tools/qc.mjs --game saga-go          한 판(여러 개는 쉼표)
 *   node tools/qc.mjs --branch web|godot|unity|tools   갈래 단위(autorun 이 티켓 세션 뒤에 부른다)
 *   --full        진단 3회(DIFF 검사)·3D 장면 촬영 전부·에셋 감사·Godot probe 까지
 *   --no-shots    촬영(playwright) 생략          --godot   Godot probe_all 도(exe 는 GODOT 환경변수 또는 스크래치패드에서 찾음)
 *
 * 하는 일(웹 판마다): ① 번들·shared 사본 최신인지(bundle --check·sync-shared --check) ② 진단 러너(test-web.mjs, RESULT n/m·실패 줄·DIFF)
 *   ③ 재미 표준 8 측정(_test.html 의 "재미표준 A~H" 줄 ○△× — 없는 판은 "측정 없음" 으로 기록) ④ 2D 한 장(pw-look2d)·3D 장면(pw-visual-close,
 *   사가천하는 pw-rk-sheet 기계 확인) ⑤ features.json D0/D1(WIP)·완성도(status.mjs) ⑥ 게이트(precheck.sh)
 *   갈래 godot: probe_all.sh fails · 갈래 tools: asset-audit --quick --strict · 갈래 unity: 배치 실행은 그 PC 세션 몫이라 SKIP 으로 적는다.
 * 결과: 콘솔 표 + tools/_out/qc-last.json + tools/_out/qc/<일시>.md(이전 결과와 n/m·완성도 비교, **Claude 눈 판정 목록** = 찍힌 PNG 경로).
 *   눈 판정은 사람 몫이 아니다 — 세션이 Read 로 PNG 를 보고 ○△× 를 티켓 메모·features note 에 적는다(INTAKE §4, 사람은 재미·손맛·그림체 고르기만).
 * 종료 코드: FAIL 하나라도 있으면 1. 서버·크롬은 여기서 띄우고 여기서 끈다(빈 포트·PW_BASE — 다른 세션 :8871 과 안 겹친다).
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', '_out');
const QC_DIR = path.join(OUT, 'qc');
const PLAY = path.join(ROOT, 'saga-web', 'tools', 'playcheck');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const VISUAL3D = new Set(['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story']);   // pw-visual-close 가 아는 판
const LOOK2D = { 'saga-go': 'map', 'saga-dungeon': 'town', 'saga-forest': 'village', 'saga-story': 'field', 'saga-realm': 'map' };
const FUN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const full = has('--full'), noShots = has('--no-shots');
const branch = val('--branch');
let games = val('--game') ? val('--game').split(',') : GAMES;
if (branch && branch !== 'web') games = [];
games = games.filter((g) => GAMES.includes(g));

fs.mkdirSync(QC_DIR, { recursive: true });
const t0 = Date.now();
const rows = [];   // { area, target, status: PASS|FAIL|WARN|SKIP, detail, sec }
const eyes = [];   // { game, what, file }
const fun = {};    // game -> { A: '○', ... } | null
const names = (() => { try { return Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games.json'), 'utf8')).games.map((g) => [g.folder, g.name])); } catch (e) { return {}; } })();
const nm = (g) => names[g] || g;

function row(area, target, status, detail, sec) { rows.push({ area, target, status, detail: String(detail || '').slice(0, 300), sec: sec == null ? null : Math.round(sec) }); console.log(`${status.padEnd(4)} ${area} · ${target}${detail ? ' — ' + String(detail).split('\n')[0].slice(0, 160) : ''}`); }
function run(cmd, args, opt = {}) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: opt.cwd || ROOT, encoding: 'utf8', shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd), maxBuffer: 64 * 1024 * 1024, timeout: opt.timeout || 20 * 60 * 1000, env: { ...process.env, ...(opt.env || {}) } });
  return { code: r.status == null ? -1 : r.status, out: (r.stdout || '') + (r.stderr || ''), sec: (Date.now() - t) / 1000, err: r.error };
}
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };

/* ── 서버(촬영용) — 빈 포트에 띄우고 끝에 끈다 ── */
async function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let server = null, base = null;
async function serve() {
  if (server) return base;
  const port = await freePort();
  server = spawn(process.execPath, [path.join(PLAY, 'serve.mjs'), path.join(ROOT, 'saga-web'), String(port)], { cwd: PLAY, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}/`;
  await new Promise((r) => setTimeout(r, 800));
  return base;
}
function stopServer() { if (server) { try { server.kill(); } catch (e) { /* 이미 끝남 */ } server = null; } }

/* ── ① 번들·shared 사본 ── */
function checkBundles() {
  for (const g of games) {
    const r = run(process.execPath, [path.join(ROOT, 'saga-web', 'shared', 'build', 'bundle.mjs'), g, '--check']);
    row('번들', nm(g), r.code === 0 ? 'PASS' : 'FAIL', r.code === 0 ? 'dist/app.js 최신' : (r.out.trim().split('\n').pop() || '낡음 — node saga-web/shared/build/bundle.mjs ' + g), r.sec);
  }
  if (games.length) {
    const r = run(process.execPath, [path.join(ROOT, 'tools', 'sync-shared.mjs'), '--check']);
    row('shared 사본', '다섯 판', r.code === 0 ? 'PASS' : 'FAIL', r.code === 0 ? '정본과 같음' : r.out.trim().split('\n').slice(0, 3).join(' | '), r.sec);
  }
}

/* ── ② 진단 러너 + ③ 재미 표준 ── */
function funMarks(g) {
  const f = path.join(OUT, `last-${g}.html`);
  if (!fs.existsSync(f)) return null;
  const html = fs.readFileSync(f, 'utf8');
  const marks = {};
  const re = /(PASS|FAIL)<\/span> 재미표준 ([A-H])[^<\n]*?— ([○△×])/g;
  let m; while ((m = re.exec(html))) { marks[m[2]] = m[3]; }
  return Object.keys(marks).length ? marks : null;
}
function checkTests() {
  if (!games.length) return;
  const runs = full ? 3 : 1;
  const r = run(process.execPath, [path.join(ROOT, 'tools', 'test-web.mjs'), ...games, `--runs=${runs}`, '--dump'], { timeout: 40 * 60 * 1000 });
  const res = readJson(path.join(OUT, 'test-web.json'), {});
  for (const g of games) {
    const x = res[g];
    if (!x) { row('진단', nm(g), 'FAIL', 'test-web 결과 없음 ' + (r.err ? r.err.message : ''), r.sec / games.length); continue; }
    const diff = new RegExp(`${g} RESULT \\d+/\\d+ runs=\\d+ DIFF`).test(r.out);
    const ok = x.fails.length === 0 && x.n === x.m && !diff;
    row('진단', nm(g), ok ? 'PASS' : 'FAIL', `RESULT ${x.n}/${x.m}` + (runs > 1 ? (diff ? ' DIFF(비결정)' : ' x3 SAME') : '') + (x.fails.length ? ' · ' + x.fails.slice(0, 3).join(' | ') : ''), r.sec / games.length);
    const fm = funMarks(g);
    fun[g] = fm;
    if (fm) {
      const bad = FUN.filter((k) => fm[k] === '×'), part = FUN.filter((k) => fm[k] === '△'), none = FUN.filter((k) => !fm[k]);
      row('재미표준', nm(g), bad.length ? 'WARN' : 'PASS', FUN.map((k) => k + (fm[k] || '·')).join(' ') + (none.length ? ' · 측정 없음 ' + none.join('') : '') + (bad.length ? ' · × ' + bad.join('') : '') + (part.length ? ' · △ ' + part.join('') : ''));
    } else {
      row('재미표준', nm(g), 'WARN', '측정 진단 없음 — _test.html 에 "재미표준 A~H" 측정 8개를 붙일 것(ARCH §3.5)');
    }
  }
}

/* ── ④ 촬영 ── */
async function checkShots() {
  if (noShots || !games.length) return;
  const shots = path.join(PLAY, 'shots', 'qc');
  fs.mkdirSync(shots, { recursive: true });
  const b = await serve();
  const env = { PW_BASE: b };
  for (const g of games) {
    const dest = path.join(shots, `${g}-2d.png`);
    try { fs.unlinkSync(dest); } catch (e) { /* 없음 */ }
    const r = run(process.execPath, ['pw-look2d.mjs', g, dest, LOOK2D[g]], { cwd: PLAY, env, timeout: 4 * 60 * 1000 });
    const okFile = fs.existsSync(dest) && fs.statSync(dest).size > 20000;
    const exc = (r.out.match(/EXC [^\n]*/g) || []).slice(0, 2).join(' | ');
    row('2D 한 장', nm(g), okFile && !exc ? 'PASS' : (okFile ? 'WARN' : 'FAIL'), okFile ? `${Math.round(fs.statSync(dest).size / 1024)}KB` + (exc ? ' · ' + exc : '') : (r.out.trim().split('\n').pop() || '그림 없음'), r.sec);
    if (okFile) eyes.push({ game: g, what: '2D 모드 ' + LOOK2D[g], file: path.relative(ROOT, dest) });
  }
  const v3 = games.filter((g) => VISUAL3D.has(g));
  if (v3.length && (full || true)) {
    const r = run(process.execPath, ['pw-visual-close.mjs', ...v3], { cwd: PLAY, env, timeout: 30 * 60 * 1000 });
    const j = readJson(path.join(PLAY, 'results', 'pw-visual-close.json'), null);
    if (j) {
      row('3D 장면', v3.map(nm).join('·'), j.pass === j.total ? 'PASS' : 'FAIL', `${j.pass}/${j.total}` + (j.pass !== j.total ? ' · ' + (j.scenes || []).filter((s) => !s.ok).map((s) => s.game + ' ' + s.key).slice(0, 4).join(', ') : ''), r.sec);
      for (const s of (j.scenes || [])) { if (s.file) eyes.push({ game: s.game, what: '3D ' + s.key + ' ' + (s.title || ''), file: path.relative(ROOT, path.join(PLAY, s.file)) }); }
    } else row('3D 장면', v3.map(nm).join('·'), 'FAIL', 'pw-visual-close 결과 없음 ' + (r.out.trim().split('\n').pop() || ''), r.sec);
  }
  if (games.includes('saga-realm')) {
    const r = run(process.execPath, ['pw-rk-sheet.mjs'], { cwd: PLAY, env, timeout: 15 * 60 * 1000 });
    const j = readJson(path.join(PLAY, 'results', 'pw-rk-sheet.json'), null);
    row('기계 확인', nm('saga-realm'), j && j.pass === j.total ? 'PASS' : 'FAIL', j ? `${j.pass}/${j.total}` : 'pw-rk-sheet 결과 없음', r.sec);
    const dest = path.join(shots, 'saga-realm-rts.png');
    const r2 = run(process.execPath, ['pw-rts-shot.mjs', dest], { cwd: PLAY, env, timeout: 5 * 60 * 1000 });
    if (fs.existsSync(dest)) eyes.push({ game: 'saga-realm', what: 'RTS 화면', file: path.relative(ROOT, dest) });
    else row('RTS 한 장', nm('saga-realm'), 'WARN', r2.out.trim().split('\n').pop() || '그림 없음', r2.sec);
  }
  stopServer();
}

/* ── ⑤ 상태(완성도·WIP) ── */
function checkStatus() {
  if (!games.length) return null;
  const r = run(process.execPath, [path.join(ROOT, 'tools', 'status.mjs'), '--json']);
  const st = readJson(path.join(OUT, 'status.json'), null);
  for (const g of games) {
    const feats = readJson(path.join(ROOT, 'saga-web', g, 'features.json'), []);
    const d0 = feats.filter((f) => f.level === 'D0').length, d1 = feats.filter((f) => f.level === 'D1').length;
    const wipLim = (() => { const w = readJson(path.join(ROOT, 'tools', 'wip.json'), {}); return (w.flagship || []).includes('web:' + g.replace('saga-', '')) ? w.limit_flagship || 20 : w.limit || 10; })();
    const done = feats.filter((f) => (f.human ? f.level === 'D3' : ['D2', 'D3'].includes(f.level))).length;
    row('완성도', nm(g), d0 + d1 > wipLim ? 'WARN' : 'PASS', `${feats.length ? Math.round(done / feats.length * 100) : 0}% (${done}/${feats.length}) · D0 ${d0} · D1 ${d1} · WIP ${d0 + d1}/${wipLim}`, r.sec / games.length);
  }
  return st;
}

/* ── ⑥ 게이트 ── */
function checkGate() {
  const r = run('bash', [path.join(ROOT, 'tools', 'precheck.sh')], { timeout: 15 * 60 * 1000 });
  const fails = (r.out.match(/^(FAIL|OVER) .*$/gm) || []).slice(0, 4);
  row('게이트', 'precheck.sh', r.code === 0 ? 'PASS' : 'FAIL', r.code === 0 ? 'OK' : fails.join(' | ') || r.out.trim().split('\n').pop(), r.sec);
}

/* ── 갈래별 ── */
function findGodot() {
  if (process.env.GODOT && fs.existsSync(process.env.GODOT)) return process.env.GODOT;
  const tmp = path.join(process.env.LOCALAPPDATA || '', 'Temp', 'claude', 'C--swbins');
  try {
    const hits = [];
    for (const s of fs.readdirSync(tmp)) { const d = path.join(tmp, s, 'scratchpad', 'godot'); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/console\.exe$/i.test(f)) hits.push(path.join(d, f)); }
    hits.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return hits[0] || null;
  } catch (e) { return null; }
}
function checkGodot() {
  const exe = findGodot();
  if (!exe) { row('Godot probe', 'probe_all.sh', 'SKIP', 'Godot 콘솔 exe 없음(GODOT=<exe> 또는 saga-godot/CLAUDE.md 절차로 받기)'); return; }
  const r = run('bash', [path.join(ROOT, 'saga-godot', 'tools', 'probe_all.sh')], { env: { GODOT: exe }, timeout: 60 * 60 * 1000 });
  const m = /PROBE_ALL fails=(\d+) probes=(\d+)/.exec(r.out);
  row('Godot probe', 'probe_all.sh', m && m[1] === '0' ? 'PASS' : 'FAIL', m ? `fails=${m[1]} probes=${m[2]}` : (r.out.trim().split('\n').pop() || '결과 줄 없음'), r.sec);
}
function checkAssets() {
  const r = run('py', ['-3.12', path.join(ROOT, 'tools', 'asset-audit', 'audit.py'), '--quick', '--strict'], { env: { PYTHONUTF8: '1' }, timeout: 30 * 60 * 1000 });
  const red = (r.out.match(/🔴/g) || []).length;
  row('에셋 감사', 'audit.py --quick', r.code === 0 ? 'PASS' : 'FAIL', r.code === 0 ? '🔴 0' : `🔴 ${red} — tools/_out/asset-audit*`, r.sec);
}

/* ── 보고 ── */
function report() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2');
  const prev = readJson(path.join(OUT, 'qc-last.json'), null);
  const fails = rows.filter((r) => r.status === 'FAIL'), warns = rows.filter((r) => r.status === 'WARN');
  const cur = { at: new Date().toISOString(), args: argv.join(' '), games, branch, sec: Math.round((Date.now() - t0) / 1000), rows, fun, eyes, verdict: fails.length ? 'FAIL' : 'PASS' };
  fs.writeFileSync(path.join(OUT, 'qc-last.json'), JSON.stringify(cur, null, 1));
  const L = [];
  L.push(`# QC ${cur.at.slice(0, 16).replace('T', ' ')} — ${cur.verdict}${fails.length ? ' (FAIL ' + fails.length + ')' : ''}${warns.length ? ' · WARN ' + warns.length : ''} · ${cur.sec}초 · \`node tools/qc.mjs ${argv.join(' ')}\``);
  L.push('');
  L.push('| 영역 | 대상 | 결과 | 상세 | 초 |', '|---|---|---|---|---|');
  for (const r of rows) L.push(`| ${r.area} | ${r.target} | ${r.status} | ${r.detail.replace(/\|/g, '/')} | ${r.sec == null ? '' : r.sec} |`);
  if (Object.keys(fun).length) {
    L.push('', '## 재미 표준 8 (SAGA-DESIGN §3 · 측정 = _test.html "재미표준 X")', '', '| 판 | ' + FUN.join(' | ') + ' |', '|---|' + FUN.map(() => '---').join('|') + '|');
    for (const g of Object.keys(fun)) L.push(`| ${nm(g)} | ` + FUN.map((k) => (fun[g] && fun[g][k]) || '측정 없음').join(' | ') + ' |');
  }
  if (prev && prev.rows) {
    const diffs = [];
    for (const r of rows) {
      if (r.area !== '진단' && r.area !== '완성도') continue;
      const p = prev.rows.find((x) => x.area === r.area && x.target === r.target);
      if (p && p.detail.split(' · ')[0] !== r.detail.split(' · ')[0]) diffs.push(`${r.area} ${r.target}: ${p.detail.split(' · ')[0]} → ${r.detail.split(' · ')[0]}`);
      if (p && p.status !== r.status) diffs.push(`${r.area} ${r.target}: ${p.status} → ${r.status}`);
    }
    L.push('', `## 이전 QC(${prev.at.slice(0, 16).replace('T', ' ')})와 비교`, '', diffs.length ? diffs.map((d) => '- ' + d).join('\n') : '- 바뀐 것 없음');
  }
  if (eyes.length) {
    L.push('', '## Claude 눈 판정 목록 — 세션이 Read 로 보고 ○△× 를 티켓 메모·features note 에 적는다(사람 아님, INTAKE §4)', '');
    for (const e of eyes) L.push(`- [ ] ${nm(e.game)} · ${e.what} · \`${e.file.replace(/\\/g, '/')}\``);
  }
  const md = L.join('\n') + '\n';
  fs.writeFileSync(path.join(QC_DIR, `${stamp}.md`), md);
  fs.writeFileSync(path.join(OUT, 'qc-last.md'), md);
  console.log(`\nQC ${cur.verdict} · FAIL ${fails.length} · WARN ${warns.length} · ${cur.sec}초 → tools/_out/qc-last.md (사본 tools/_out/qc/${stamp}.md)`);
  if (eyes.length) console.log(`눈 판정 ${eyes.length}장 — 목록은 보고서 끝(세션이 Read 로 직접 본다)`);
  return fails.length ? 1 : 0;
}

(async () => {
  try {
    console.log(`QC 시작 — 갈래 ${branch || 'web'} · 판 ${games.map(nm).join('·') || '-'} · ${full ? 'full' : 'quick'}${noShots ? ' · 촬영 생략' : ''}`);
    checkBundles();
    checkTests();
    await checkShots();
    checkStatus();
    if (branch === 'godot' || has('--godot') || (full && !branch)) checkGodot();
    if (branch === 'tools' || full) checkAssets();
    if (branch === 'unity') row('Unity 배치', 'PlaytestHeadless', 'SKIP', '유니티 배치는 엔진 있는 세션이 티켓 검증 칸 명령으로 돌린다(tasks/unity/QUEUE.md) — 결과 파일이 있으면 다음 판에서 읽게 한다');
    checkGate();
  } catch (e) { row('QC', '실행', 'FAIL', e.stack || String(e)); }
  finally { stopServer(); }
  process.exit(report());
})();
