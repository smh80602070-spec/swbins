#!/usr/bin/env node
/**
 * 무인 기동 상주 프로그램 — K-0074 단계 4 대안(사용자 10-05 "스케줄러 말고 시작 프로그램으로, 시작·중지 컨트롤").
 * 작업 스케줄러 없이 이 프로세스가 켜져 있는 동안 매일 --at 시각(또는 --every 시간마다) run.mjs 를 띄우고,
 * 127.0.0.1:--port 에 제어 페이지를 연다: 상태 · 시작/중지 · 지금 실행 · 최근 로그.
 *
 *   node tools/autorun/daemon.mjs [--branch tools] [--at none|02:30] [--on-boot 5] [--every 0] [--port 8798] [--max-tickets 1] [--budget-usd 20] [--model claude-opus-5-5]
 *   제어: http://127.0.0.1:8798   (중지 = tools/autorun/STOP 파일, run.mjs 와 같은 스위치 · 지금 실행 = 즉시 한 번)
 *   시작 프로그램 등록: powershell -ExecutionPolicy Bypass -File tools/autorun/install-startup.ps1 (-Uninstall 로 해제)
 * 로그는 run.mjs 가 _log/ 에 남긴다. 이 파일은 세션을 직접 만들지 않고 run.mjs 를 자식으로 띄울 뿐이다.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STOP = path.join(HERE, 'STOP');
const LOG_DIR = path.join(HERE, '_log');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
/* --at HH:MM 매일 · --at none 예약 없음(수동만) · --every N 시간마다 · --on-boot M 데몬 시작 M분 뒤 한 번(PC 를 켜 둘 일이 없는 사용자 10-05) */
const BRANCH = opt('--branch', 'tools'), AT = opt('--at', 'none'), EVERY_H = +opt('--every', 0), ON_BOOT = +opt('--on-boot', 0), PORT = +opt('--port', 8798);
/* 무인 세션 = Opus 5.5(10-07 사용자 — 소넷 5.5 폐지, ARCH 머리말). --model 로 바꿀 수 있다 */
const LANES = ['tools', 'web', 'godot', 'unity'];   // run.mjs 갈래 표와 같다
const RUN_ARGS = ['--branch', BRANCH, '--max-tickets', opt('--max-tickets', '1'), '--budget-usd', opt('--budget-usd', '20'), '--model', opt('--model', 'claude-opus-5-5')];

const state = { branch: BRANCH, at: AT, everyH: EVERY_H, running: null, runningBranch: null, queued: [], startedAt: null, lastRun: null, lastExit: null, lastReason: '', runs: 0, bootedAt: new Date().toISOString() };
fs.mkdirSync(LOG_DIR, { recursive: true });
const paused = () => fs.existsSync(STOP);

function nextRunTime(from = new Date()) {
  if (ON_BOOT > 0 && state.runs === 0) return new Date(new Date(state.bootedAt).getTime() + ON_BOOT * 60 * 1000);
  if (EVERY_H > 0) return new Date((state.lastRun ? new Date(state.lastRun).getTime() : from.getTime()) + EVERY_H * 3600 * 1000);
  if (!/^\d{1,2}:\d{2}$/.test(AT)) return null;   // 'none' = 예약 없음, 트레이·제어 페이지의 "지금 실행"만
  const [h, m] = AT.split(':').map(Number);
  const t = new Date(from); t.setHours(h, m, 0, 0);
  if (t <= from) t.setDate(t.getDate() + 1);
  return t;
}
let next = nextRunTime();

/* branch: 다른 갈래로 한 번(K-0079 문맥 넘기기 — 대화 세션의 갈래를 이어 간다). 실행 중이면 갈래마다 하나씩 줄 세운다(같은 갈래 넘김은 한 번만) */
function runOnce(reason, branch = BRANCH) {
  if (state.running) {
    if (reason.startsWith('handoff') && !state.queued.some((x) => x.branch === branch)) state.queued.push({ reason, branch });
    return false;
  }
  if (paused() && reason !== 'manual') { state.lastReason = `${reason}: STOP 파일 있어 건너뜀`; return false; }
  const args = RUN_ARGS.slice(); args[1] = branch;
  const child = spawn(process.execPath, [path.join(HERE, 'run.mjs'), ...args], { cwd: path.resolve(HERE, '..', '..'), env: process.env, stdio: 'ignore' });
  state.running = child.pid; state.runningBranch = branch; state.startedAt = new Date().toISOString(); state.lastReason = reason; state.runs++;
  child.on('close', (code) => {
    state.running = null; state.runningBranch = null; state.lastRun = new Date().toISOString(); state.lastExit = code; next = nextRunTime();
    const qd = state.queued.shift();
    if (qd) runOnce(qd.reason, qd.branch);
  });
  return true;
}

setInterval(() => { if (next && !state.running && new Date() >= next) { const was = next; runOnce(ON_BOOT > 0 && state.runs === 0 ? 'on-boot' : 'schedule'); if (!state.running) { state.runs = Math.max(state.runs, 1); next = nextRunTime(new Date(was.getTime() + 60000)); } } }, 30 * 1000);

function latestLog() {
  const files = fs.existsSync(LOG_DIR) ? fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.log')).sort() : [];
  if (!files.length) return { name: '(없음)', tail: '' };
  const f = files[files.length - 1];
  const txt = fs.readFileSync(path.join(LOG_DIR, f), 'utf8');
  return { name: f, tail: txt.split('\n').slice(-40).join('\n') };
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function page() {
  const lg = latestLog();
  const st = state.running ? `실행 중 (pid ${state.running}, ${state.startedAt.slice(11, 19)}부터)` : paused() ? '중지됨 (STOP 파일)' : '대기 중';
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="15"><title>saga autorun</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;max-width:900px}button{font:inherit;padding:6px 14px;margin-right:8px}pre{background:#f4f4f4;padding:12px;overflow:auto;max-height:420px}td{padding:2px 10px 2px 0}</style>
<h2>saga autorun — ${esc(BRANCH)} 갈래</h2>
<table><tr><td>상태</td><td><b>${esc(st)}</b></td></tr>
<tr><td>다음 예정</td><td>${paused() ? '(중지 중)' : next ? esc(next.toLocaleString()) : '없음 — "지금 한 번 실행"이나 트레이 메뉴로'}${ON_BOOT && state.runs === 0 ? ` (데몬 시작 ${ON_BOOT}분 뒤 한 번)` : EVERY_H ? ` (매 ${EVERY_H}시간)` : /^\d{1,2}:\d{2}$/.test(AT) ? ` (매일 ${esc(AT)})` : ' (예약 없음)'}</td></tr>
<tr><td>마지막 실행</td><td>${state.lastRun ? esc(new Date(state.lastRun).toLocaleString()) + ` · exit ${state.lastExit}` : '없음'} ${esc(state.lastReason)}</td></tr>
<tr><td>실행 횟수</td><td>${state.runs} (데몬 시작 ${esc(new Date(state.bootedAt).toLocaleString())})</td></tr></table>
<p><form method="post" action="/api/start" style="display:inline"><button ${paused() ? '' : 'disabled'}>시작</button></form>
<form method="post" action="/api/stop" style="display:inline"><button ${paused() && !state.running ? 'disabled' : ''}>중지</button></form>
<form method="post" action="/api/run" style="display:inline"><button ${state.running ? 'disabled' : ''}>지금 한 번 실행</button></form></p>
<p>exit 0 = 정상 · 2 = STOP · 3 = 트리 더러움/갈라짐 · 4 = claude 실패. 중지는 STOP 파일(run.mjs 도 같은 스위치)이고, 실행 중이면 그 세션도 끊는다.</p>
<h3>최근 로그 — ${esc(lg.name)}</h3><pre>${esc(lg.tail)}</pre>`;
}

http.createServer((q, s) => {
  const u = q.url.split('?')[0];
  /* 브라우저의 다른 페이지가 POST 로 유료 세션을 띄우지 못하게: Origin 이 있으면 이 제어 페이지 것만(폼은 같은 출처로 보낸다) */
  const og = q.headers.origin;
  if (q.method === 'POST' && og && og !== `http://127.0.0.1:${PORT}` && og !== `http://localhost:${PORT}`) { s.writeHead(403); s.end('origin'); return; }
  if (q.method === 'POST' && u === '/api/stop') { fs.writeFileSync(STOP, new Date().toISOString()); if (state.running) { try { process.kill(state.running); } catch (e) { /* 이미 끝남 */ } } }
  else if (q.method === 'POST' && u === '/api/start') { if (paused()) fs.unlinkSync(STOP); next = nextRunTime(); }
  else if (q.method === 'POST' && u === '/api/run') {
    const qs = new URLSearchParams(q.url.split('?')[1] || '');
    if (qs.has('branch')) {                                      // K-0079 — 훅이 부르는 입구, JSON 으로 답한다(전용 헤더 필수 — 브라우저 단순 요청으로는 못 붙인다)
      if (q.headers['x-saga-handoff'] !== '1') { s.writeHead(403, { 'content-type': 'application/json' }); s.end(JSON.stringify({ ok: false, why: '헤더 없음' })); return; }
      const b = qs.get('branch');
      if (!LANES.includes(b)) { s.writeHead(400, { 'content-type': 'application/json' }); s.end(JSON.stringify({ ok: false, why: '모르는 갈래 ' + b })); return; }
      const started = runOnce('handoff:' + String(qs.get('from') || '').slice(0, 40), b);
      s.writeHead(202, { 'content-type': 'application/json' }); s.end(JSON.stringify({ ok: true, started, queued: state.queued.map((x) => x.branch), branch: b })); return;
    }
    runOnce('manual');
  }
  else if (u === '/api/status') { s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify({ ...state, paused: paused(), next })); return; }
  if (q.method === 'POST') { s.writeHead(303, { location: '/' }); s.end(); return; }
  s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(page());
}).listen(PORT, '127.0.0.1', () => console.log(`saga autorun daemon: http://127.0.0.1:${PORT} · ${BRANCH} · ${ON_BOOT ? '시작 ' + ON_BOOT + '분 뒤 한 번 · ' : ''}${EVERY_H ? '매 ' + EVERY_H + '시간' : /^\d{1,2}:\d{2}$/.test(AT) ? '매일 ' + AT : '예약 없음'} · 다음 ${next ? next.toLocaleString() : '없음'}`));
