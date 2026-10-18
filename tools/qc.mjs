#!/usr/bin/env node
/**
 * QC — 사람 대신 돌아가는 품질 점검 한 명령 (사용자 2026-10-07 "QC 를 직접 돌리는 로직 — 실기 요청할 때 자동으로").
 *
 *   node tools/qc.mjs                         웹 다섯 판 quick
 *   node tools/qc.mjs --game saga-go          한 판(여러 개는 쉼표)
 *   node tools/qc.mjs --branch web|godot|unity|tools   갈래 단위(autorun 이 티켓 세션 뒤에 부른다)
 *   --full        진단 3회(DIFF 검사)·3D 장면 촬영 전부·에셋 감사·Godot probe 까지
 *   --no-shots    촬영(playwright) 생략          --godot   Godot probe_all 도(exe 는 GODOT 환경변수 또는 스크래치패드에서 찾음)
 *   --play        플레이 QC 만(W-0270 — pw-play.mjs: 판마다 PC·폰으로 키·끌기·터치 이동 · ☰ 창 닫은 뒤 이동 · HUD 겹침 · 새로 고침 이어하기). 기본 실행에 든다(--no-shots 면 생략)
 *   --budget      폰 예산 측정을 실제로 돌린다(W-0302 pw-phone-budget.mjs, 판마다 1회 — 없으면 마지막 결과만 읽는다)
 *   --deploy      배포 확인만(W-0258 — 공개 Pages 주소에서 가입→시작→☰→새로 고침, pw-deploy.mjs). --branch web·--full 엔 늘 든다
 *
 * 하는 일(웹 판마다): ① 번들·shared 사본 최신인지(bundle --check·sync-shared --check) ② 진단 러너(test-web.mjs, RESULT n/m·실패 줄·DIFF)
 *   ③ 재미 표준 8 측정(_test.html 의 "재미표준 A~H" 줄 ○△× — 없는 판은 "측정 없음" 으로 기록) ④ 2D 한 장(pw-look2d)·3D 장면(pw-visual-close,
 *   5천하는 pw-rk-sheet 기계 확인) ⑤ features.json D0/D1(WIP)·완성도(status.mjs) ⑥ 게이트(precheck.sh)
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
const full = has('--full'), noShots = has('--no-shots'), deployOnly = has('--deploy'), playOnly = has('--play');
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
    /* W-0313 — 조립본(js/)이 조각(src/)과 같은가. 조립본만 고친 변경은 다음 조립에서 사라진다 */
    const b = run(process.execPath, [path.join(ROOT, 'tools', 'build-parts.mjs'), '--check']);
    const diffs = b.out.split('\n').filter((l) => /^DIFF /.test(l));
    row('조립본=조각', '다섯 판', b.code === 0 ? 'PASS' : 'FAIL', b.code === 0 ? (b.out.match(/^ok /gm) || []).length + '개 같음' : diffs.slice(0, 3).map((l) => l.slice(5, 140)).join(' | '), b.sec);
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
  /* W-0325 로딩 — 2나락 마을 진입 뒤 3·8초에 **보이는** 대역 상자(시야 안) 수 · 가림막. 3초 > 0 이거나 8초 > 10 이면 WARN(옛 QC 는 다 받은 화면만 찍어 못 잡았다) */
  if (games.includes('saga-dungeon')) {
    const r = run(process.execPath, ['dg-load-seq.mjs'], { cwd: PLAY, env, timeout: 6 * 60 * 1000 });
    const j = readJson(path.join(PLAY, 'results', 'dg-load-seq.json'), null), at = (ms) => j && (j.rows || []).find((x) => x.ms === ms);
    if (!at(3000) || at(3000).err) { row('로딩', nm('saga-dungeon'), 'FAIL', 'dg-load-seq 결과 없음 ' + ((j && j.err) || r.out.trim().split(String.fromCharCode(10)).pop() || ''), r.sec); }
    else {
      const a = at(3000), c = at(8000) || {}, warn = a.boxOnScreen > 0 || (c.boxOnScreen || 0) > 10;
      row('로딩', nm('saga-dungeon'), warn ? 'WARN' : 'PASS', '3초 시야 안 상자 ' + a.boxOnScreen + '(가림막 ' + (a.veil ? '덮음' : '걷힘') + ') · 8초 ' + c.boxOnScreen + ' · GLB ' + c.glb + ' · 숨은 대역 ' + c.ghost, r.sec);
      for (const ms of [3000, 8000]) { const f = path.join(PLAY, 'shots', 'dg_load_' + ms + '.png'); if (fs.existsSync(f)) { eyes.push({ game: 'saga-dungeon', what: '로딩 ' + ms / 1000 + '초(갈색 상자가 없나)', file: path.relative(ROOT, f) }); } }
    }
  }
  /* W-0327 갑자기 생긴 적 — 2나락 마을 들판을 60초 걸으며 처음 본 적이 그 순간 화면 안이면 센다(dg-popin, PC·폰). 연출(bornAt) 없이 화면 안 1 이상이면 WARN */
  if (games.includes('saga-dungeon')) {
    for (const ph of [false, true]) {
      const r = run(process.execPath, ['dg-popin.mjs', '--sec=60'].concat(ph ? ['--phone'] : []), { cwd: PLAY, env, timeout: 6 * 60 * 1000 });
      const j = readJson(path.join(PLAY, 'results', 'dg-popin' + (ph ? '-phone' : '') + '.json'), null), who = nm('saga-dungeon') + (ph ? ' 폰' : ' PC');
      if (!j || j.err || !j.samples) { row('갑자기 생긴 적', who, 'FAIL', 'dg-popin 결과 없음 ' + ((j && j.err) || r.out.trim().split(String.fromCharCode(10)).pop() || ''), r.sec); continue; }
      row('갑자기 생긴 적', who, j.popin ? 'WARN' : 'PASS', '화면 안 ' + j.popin + ' · 연출 ' + j.appear + ' · 화면 밖 ' + j.offscreen + ' / 새 적 ' + j.seen + (j.popin ? ' · 예 ' + j.list.filter((x) => !x.appear).slice(0, 3).map((x) => x.t + 'ms ' + x.d).join(', ') : ''), r.sec);
    }
  }
  /* W-0316 몸짓 판정 — 1만리 내 몸(실제 VRoid)에 자세 열둘을 걸어 판정 시점에 멈추고 뼈로 기대 범위를 본다(pose3d.check) + 모음판 눈 판정 */
  if (games.includes('saga-go')) {
    const r = run(process.execPath, ['pose-shot.mjs', 'qcpose'], { cwd: PLAY, env, timeout: 10 * 60 * 1000 });
    const j = readJson(path.join(PLAY, 'results', 'pose-shot.json'), null);
    if (!j || !j.poses || !j.poses.length) { row('몸짓 판정', nm('saga-go'), 'FAIL', 'pose-shot 결과 없음 ' + (j && j.err || r.out.trim().split('\n').pop() || ''), r.sec); }
    else {
      const bad = j.poses.filter((x) => !x.ok);
      row('몸짓 판정', nm('saga-go'), bad.length ? 'FAIL' : 'PASS', bad.length ? '× ' + bad.map((x) => x.pose + '(' + x.bad.join('/') + ')').join(' | ') : j.poses.length + '자세 기대 범위 안(실제 몸 뼈)', r.sec);
      run(process.execPath, ['pose-sheet.mjs', 'qcpose'], { cwd: PLAY, timeout: 2 * 60 * 1000 });
      const sheet = path.join(PLAY, 'shots', 'qcpose_sheet.jpg');
      if (fs.existsSync(sheet)) { eyes.push({ game: 'saga-go', what: '몸짓 모음판(자세 열둘 — 팔·다리가 자세 이름대로인가)', file: path.relative(ROOT, sheet) }); }
    }
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

/* ── ④-3 플레이 QC(W-0270) — 로컬 서버에서 판마다 PC(1280×720)·폰(390×844 터치)으로 사람처럼 조작: 키 4방향·끌기/터치 이동, ☰ 창 닫은 뒤 이동, HUD 겹침(WARN), 새로 고침 이어하기, 판별 덤. 결과 results/pw-play.json ── */
async function checkPlay() {
  if (noShots || !games.length) return;
  const b = await serve();
  const r = run(process.execPath, ['pw-play.mjs', ...games, '--base', b], { cwd: PLAY, timeout: 30 * 60 * 1000 });
  const j = readJson(path.join(PLAY, 'results', 'pw-play.json'), null);
  if (!j) { row('플레이', games.map(nm).join('·'), 'FAIL', 'pw-play 결과 없음 ' + (r.out.trim().split('\n').pop() || ''), r.sec); return; }
  row('렌더러', '플레이·촬영', j.gpu && !/swiftshader|llvmpipe|software/i.test(j.gpu) ? 'PASS' : 'WARN', (j.gpu || '모름') + (j.gpu && /swiftshader/i.test(j.gpu) ? ' — 소프트웨어라 FPS 판정 안 함(W-0314)' : ''));
  for (const g of games) {
    for (const x of (j.runs || []).filter((x) => x.game === g)) {
      const dev = x.device === 'phone' ? '폰' : 'PC';
      const bad = x.checks.filter((c) => !c.ok && !c.skip), warn = x.checks.filter((c) => c.ok && c.warn);
      row('플레이', nm(g) + ' ' + dev, bad.length ? 'FAIL' : (warn.length ? 'WARN' : 'PASS'), (bad.length ? '× ' + bad.map((c) => c.name + '(' + c.detail.slice(0, 60) + ')').join(' | ') : '') + (warn.length ? (bad.length ? ' · ' : '') + '△ ' + warn.map((c) => c.name + '(' + c.detail.slice(0, 50) + ')').join(' | ') : '') || x.checks.length + '항목', r.sec / (j.runs.length || 1));
    }
  }
}

/* ── ④-4 그래픽 기준선(W-0291) — 다섯 판 3D 를 높음 품질로 띄워 shared/gfx-baseline.json 의 기능이 켜졌는지(pw-gfx). 빠진 칸은 WARN(티켓 번호 함께) ── */
async function checkGfx() {
  if (noShots || !games.length) return;
  const b = await serve();
  const r = run(process.execPath, ['pw-gfx.mjs', ...games, '--base', b], { cwd: PLAY, timeout: 20 * 60 * 1000 });
  const j = readJson(path.join(PLAY, 'results', 'pw-gfx.json'), null);
  if (!j) { row('그래픽 기준선', games.map(nm).join('·'), 'FAIL', 'pw-gfx 결과 없음 ' + (r.out.trim().split(String.fromCharCode(10)).pop() || ''), r.sec); return; }
  for (const g of games) {
    const x = (j.runs || []).find((x) => x.game === g); if (!x) continue;
    const miss = x.rows.filter((q) => !q.na && !q.ok);
    row('그래픽 기준선', nm(g), x.err ? 'FAIL' : (miss.length ? 'WARN' : 'PASS'), x.err ? x.err : (miss.length ? '빠짐 ' + miss.map((q) => q.name + (q.ticket ? '(' + q.ticket + ')' : '')).join(' · ') : x.rows.filter((q) => !q.na).length + '항목 전부 켜짐'), r.sec / games.length);
  }
}

/* ── ④-5 폰 예산(W-0302) — 마지막 pw-phone-budget.mjs 결과(폰 흉내 · GPU · CPU 4배 감속)를 읽어 상한(용량·FPS·그리기 수)을 넘은 판은 WARN.
   측정이 25분쯤이라 QC 가 돌리진 않는다(--budget 을 주면 돌린다). 결과가 7일 넘게 묵으면 다시 재라고 WARN */
async function checkBudget() {
  if (!games.length) return;
  if (has('--budget')) { const b = await serve(); run(process.execPath, ['pw-phone-budget.mjs', ...games, '--gpu', '--runs=1', '--base', b], { cwd: PLAY, timeout: 60 * 60 * 1000 }); }
  const j = readJson(path.join(PLAY, 'results', 'pw-phone-budget.json'), null);
  if (!j) { row('폰 예산', games.map(nm).join('·'), 'WARN', '측정 없음 — node saga-web/tools/playcheck/pw-phone-budget.mjs --gpu'); return; }
  const B = j.budget || {};
  for (const g of games) {
    const x = (j.runs || []).find((q) => q.game === g);
    if (!x) { row('폰 예산', nm(g), 'WARN', '그 판 측정 없음'); continue; }
    const age = (Date.now() - Date.parse(x.at || j.at)) / 86400000;   // 판마다 잰 때(합쳐 쓰기)
    const sc = (x.scenes || []).map((q) => q.name + ' ' + q.fps + 'fps·그리기 ' + q.calls).join(' · ');
    row('폰 예산', nm(g), x.over && x.over.length || age > 7 ? 'WARN' : 'PASS', '첫 화면 ' + x.firstMB + 'MB/' + B.mb + ' · ' + sc + (x.over && x.over.length ? ' · 넘음 ' + x.over.join(', ') : '') + (age > 7 ? ' · 측정 ' + Math.round(age) + '일 묵음' : '') + (j.gpu ? '' : ' · swiftshader(FPS 상대값)'));
  }
}

/* ── ④-6 자동 품질(W-0314) — 마지막 폰 예산 결과의 장면마다 autoq 단계(aq)를 본다. 3마을·5천하는 auto 일 때 3초 평균 FPS 가 26 밑이면 한 단계 내린다.
   장면 FPS ≥ 30 이거나 한 단계라도 내려갔으면 PASS · FPS < 26 인데 그대로 HIGH 면 FAIL(W-0302 가 잡은 갇힘) · 결과에 aq 칸이 없으면 WARN(다시 재야) ── */
function checkAutoq() {
  const AQ_GAMES = ['saga-forest', 'saga-realm'].filter((g) => games.includes(g));
  if (!AQ_GAMES.length) return;
  const j = readJson(path.join(PLAY, 'results', 'pw-phone-budget.json'), null);
  for (const g of AQ_GAMES) {
    const x = j && (j.runs || []).find((q) => q.game === g);
    if (!x) { row('자동 품질', nm(g), 'WARN', '폰 예산 측정 없음 — node saga-web/tools/playcheck/pw-phone-budget.mjs ' + g); continue; }
    const sc = x.scenes || [];
    if (!sc.some((q) => q.aq)) { row('자동 품질', nm(g), 'WARN', '측정에 autoq 칸 없음(W-0314 전 결과) — 다시 재기'); continue; }
    const down = (q) => Object.values(q.aq || {}).reduce((a, b) => a + b, 0);
    const stuck = sc.filter((q) => q.fps < 26 && down(q) === 0);
    row('자동 품질', nm(g), stuck.length ? 'FAIL' : 'PASS', sc.map((q) => q.name + ' ' + q.fps + 'fps·내림 ' + down(q)).join(' · ') + (stuck.length ? ' · 갇힘 ' + stuck.map((q) => q.name).join(',') : ''));
  }
}

/* ── ④-7 CPU 상위(W-0315) — 함수별 자기 시간(pw-cpu-profile, 폰 흉내·GPU·CPU 4배)을 기준선(saga-web/tools/playcheck/baseline/cpu-<판>.json)과 견준다.
   기준선에 없던 함수가 10% 이상이거나, 있던 함수가 +5%p 이상 오르면 WARN(뼈대 중복 같은 성능 회귀 — W-0302). ( 로 시작하는 (program)·(garbage collector) 는 뺀다.
   --profile 이면 먼저 잰다(판마다 3회 ≈ 3분). 결과가 7일 넘게 묵으면 WARN. 기준선은 `node saga-web/tools/playcheck/pw-cpu-profile.mjs <판> --accept-baseline` 으로만 바뀐다 ── */
async function checkCpu() {
  if (!games.length) return;
  if (has('--profile')) { const b = await serve(); for (const g of games) { run(process.execPath, ['pw-cpu-profile.mjs', g, '--runs=3', '--base=' + b], { cwd: PLAY, timeout: 20 * 60 * 1000 }); } }
  for (const g of games) {
    const res = readJson(path.join(PLAY, 'results', 'pw-cpu-' + g + '.json'), null), base = readJson(path.join(PLAY, 'baseline', 'cpu-' + g + '.json'), null);
    if (!res || !res.rows) { row('CPU 상위', nm(g), 'WARN', '측정 없음 — node saga-web/tools/playcheck/pw-cpu-profile.mjs ' + g + ' --runs=3'); continue; }
    if (!base) { row('CPU 상위', nm(g), 'WARN', '기준선 없음 — pw-cpu-profile.mjs ' + g + ' --accept-baseline'); continue; }
    const age = res.at ? (Date.now() - Date.parse(res.at)) / 86400000 : 99;
    const keyOf = (r) => r.key || String(r.fn || '').replace(/ \[[^\]]*\]$/, '');   // 옛 결과(줄 번호 붙은 fn)도 읽는다
    const bm = new Map(base.rows.filter((r) => !/^\(/.test(keyOf(r))).map((r) => [keyOf(r), r.pct]));
    const bad = [];
    for (const r of res.rows) { const k = keyOf(r); if (/^\(/.test(k)) { continue; } const b = bm.get(k); if (b === undefined ? r.pct >= 10 : r.pct - b >= 5) { bad.push(k.slice(0, 60) + ' ' + (b === undefined ? '새 ' : b + '→') + r.pct + '%'); } }
    const top = res.rows.filter((r) => !/^\(/.test(keyOf(r))).slice(0, 2).map((r) => keyOf(r).split(' @')[0] + ' ' + r.pct + '%').join(' · ');
    row('CPU 상위', nm(g), bad.length || age > 7 ? 'WARN' : 'PASS', (bad.length ? '오름 ' + bad.slice(0, 3).join(' | ') : '기준선 안 · ' + top) + (age > 7 ? ' · 측정 ' + Math.round(age) + '일 묵음' : ''));
  }
}

/* ── ④-2 배포 확인(W-0258) — 로컬 서버가 아니라 공개 Pages 주소를 서비스 워커 켠 채 실제 클릭으로. 이 PC 네트워크 기준(사용자 기기 차단은 못 잡음) ── */
function checkDeploy() {
  if (!games.length) return;
  const r = run(process.execPath, ['pw-deploy.mjs', ...games], { cwd: PLAY, timeout: 20 * 60 * 1000 });
  const j = readJson(path.join(PLAY, 'results', 'pw-deploy.json'), null);
  if (!j) { row('배포 확인', games.map(nm).join('·'), 'FAIL', 'pw-deploy 결과 없음 ' + (r.out.trim().split('\n').pop() || ''), r.sec); return; }
  for (const x of j.games) {
    const failed = x.steps.filter((t) => !t.ok).map((t) => t.name + (t.why ? '(' + t.why + ')' : ''));
    const why = [failed.length ? '× ' + failed.join(', ') : '', x.errors.length ? '오류 ' + x.errors.slice(0, 2).join(' | ') : '', x.bad.length ? x.bad.slice(0, 2).join(' | ') : ''].filter(Boolean).join(' · ');
    const st = !x.ok ? 'FAIL' : (x.sameVersion ? 'PASS' : 'WARN');
    row('배포 확인', nm(x.game), st, x.ok ? (x.sameVersion ? '가입→시작→☰→새로 고침 ○ · 배포 ' + x.deployed : '흐름 ○ · 배포 버전 ' + x.deployed + ' ≠ 로컬 ' + x.local + '(푸시 뒤 배포 지연이면 몇 분 뒤 다시)') : why, null);
    const shot = path.join(PLAY, 'shots', 'deploy', x.game + '.png');
    if (fs.existsSync(shot)) eyes.push({ game: x.game, what: '배포 주소 마지막 화면', file: path.relative(ROOT, shot) });
  }
  if (!has('--deploy-later')) { checkDeployLater(); }
}

/* W-0317 ⑨ — 푸시 전 QC 의 배포 확인은 늘 "배포 버전 ≠ 로컬"(Pages 배포에 몇 분) WARN 이었다 → push.sh 가 푸시 뒤 `qc --deploy-later` 를 분리 실행해
   5분(QC_DEPLOY_WAIT 초) 뒤 공개 주소를 다시 보고 _out/deploy-last.json·.md 에 남긴다. 여기선 그 마지막 결과를 한 줄로(24시간 안이면) */
function checkDeployLater() {
  const j = readJson(path.join(OUT, 'deploy-last.json'), null);
  if (!j) { row('배포(푸시 뒤)', '다섯 판', 'WARN', '푸시 뒤 결과 없음 — push.sh 가 푸시 뒤 5분에 node tools/qc.mjs --deploy-later 를 띄운다'); return; }
  const age = (Date.now() - Date.parse(j.at)) / 3600000, bad = (j.games || []).filter((x) => !x.ok), lag = (j.games || []).filter((x) => x.ok && !x.sameVersion);
  row('배포(푸시 뒤)', '다섯 판', bad.length ? 'FAIL' : (lag.length || age > 24 ? 'WARN' : 'PASS'), (bad.length ? '× ' + bad.map((x) => nm(x.game)).join('·') + ' · ' : '') + (lag.length ? '버전 지연 ' + lag.map((x) => nm(x.game) + ' ' + x.deployed).join('·') + ' · ' : '') + (j.games || []).length + '판 · ' + j.at.slice(0, 16).replace('T', ' ') + 'Z' + (age > 24 ? ' · ' + Math.round(age) + '시간 묵음' : '') + (j.commit ? ' · ' + j.commit : ''));
}
async function deployLater() {
  const wait = +(process.env.QC_DEPLOY_WAIT || 300);
  await new Promise((r) => setTimeout(r, wait * 1000));
  checkDeploy();
  const j = readJson(path.join(PLAY, 'results', 'pw-deploy.json'), null), commit = run('git', ['log', '--oneline', '-1']).out.trim().slice(0, 70);
  const out = { at: new Date().toISOString(), wait, commit, games: j ? j.games.map((x) => ({ game: x.game, ok: x.ok, sameVersion: x.sameVersion, deployed: x.deployed, local: x.local })) : [] };
  fs.writeFileSync(path.join(OUT, 'deploy-last.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'deploy-last.md'), '# 푸시 뒤 배포 확인 ' + out.at + '\n\n' + (out.commit || '') + '\n\n| 판 | 흐름 | 배포 버전 | 로컬 |\n|---|---|---|---|\n' + out.games.map((x) => '| ' + nm(x.game) + ' | ' + (x.ok ? '○' : '×') + ' | ' + x.deployed + ' | ' + x.local + (x.sameVersion ? '' : ' ≠') + ' |').join('\n') + '\n');
  console.log('DEPLOY-LATER ' + out.games.map((x) => x.game + (x.ok ? (x.sameVersion ? ' ○' : ' △') : ' ×')).join(' · '));
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
    const done = feats.filter((f) => ['D2', 'D3', 'D4'].includes(f.level)).length;   // W-0312 끝 = D2 이상 하나(사람 몫 칸 폐지)
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
    if (has('--deploy-later')) { await deployLater(); process.exit(0); }   // W-0317 ⑨ push.sh 가 분리 실행
    if (deployOnly) { checkDeploy(); return; }
    if (playOnly) { await checkPlay(); stopServer(); return; }
    checkBundles();
    checkTests();
    await checkShots();
    await checkPlay();
    await checkGfx();
    await checkBudget();
    checkAutoq();
    await checkCpu();
    if (branch === 'web' || (full && !branch)) checkDeploy();
    checkStatus();
    if (branch === 'godot' || has('--godot') || (full && !branch)) checkGodot();
    if (branch === 'tools' || full) checkAssets();
    if (branch === 'unity') row('Unity 배치', 'PlaytestHeadless', 'SKIP', '유니티 배치는 엔진 있는 세션이 티켓 검증 칸 명령으로 돌린다(tasks/unity/QUEUE.md) — 결과 파일이 있으면 다음 판에서 읽게 한다');
    checkGate();
  } catch (e) { row('QC', '실행', 'FAIL', e.stack || String(e)); }
  finally { stopServer(); }
  process.exit(report());
})();
