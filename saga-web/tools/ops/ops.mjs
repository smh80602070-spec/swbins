#!/usr/bin/env node
/**
 * 운영 콘솔 서버(W-0271) — 의존 없는 node 한 파일. 127.0.0.1 만 듣는다(푸시는 안 한다 — 사람이 `bash tools/push.sh`).
 *
 *   node saga-web/tools/ops/ops.mjs [--port 8802]     http://127.0.0.1:8802/
 *   node saga-web/tools/ops/ops.mjs --check            서버 없이 overview 한 번 찍고 종료(검증용)
 *
 * API
 *   GET  /api/overview            다섯 판: 로컬 sw VERSION · 배포 VERSION(pw-deploy.json) · 번들 최신(bundle --check) · 완성도(features.json)
 *                                 · 마지막 QC(tools/_out/qc-last.json) · 플레이 QC(pw-play.json) · 바로가기
 *   GET  /api/live  PUT /api/live  shared/ops/live.json 읽기·쓰기(꼴 검사: notices[]·maintenance{}·minVersion{}·events[])
 *   POST /api/run {cmd: 'qc'|'play'|'deploy', games: []}   한 번에 하나 · GET /api/run/log → { running, cmd, lines }
 *   GET  /shots/<경로>            saga-web/tools/playcheck/shots/ 사진
 *   서버 탭(W-0326)은 브라우저가 saga-ops(server.mjs, 기본 :8810)에 직접 간다 — 이 콘솔 서버는 중계하지 않는다(운영 열쇠를 여기 안 둔다).
 *   --check 는 live.json 의 server 가 있으면 /v1/health 도 찍는다. 한 바퀴 시험은 `node saga-ops/test.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..');            // saga-web
const ROOT = path.resolve(WEB, '..');                   // 저장소
const PLAY = path.join(WEB, 'tools', 'playcheck');
const LIVE = path.join(WEB, 'shared', 'ops', 'live.json');
const argv = process.argv.slice(2);
const PORT = +(argv[argv.indexOf('--port') + 1] || 0) || 8802;
const PAGES = 'https://smh80602070-spec.github.io/swbins/saga-web/';
const GAMES = [
  { id: 'saga-go', name: '1만리', port: 8791, saveKey: 'deungyong-go/save' },
  { id: 'saga-dungeon', name: '2나락', port: 8792, saveKey: 'yeoksa-dungeon/save' },
  { id: 'saga-forest', name: '3마을', port: 8793, saveKey: 'yeoksa-village/save' },
  { id: 'saga-story', name: '4종횡', port: 8794, saveKey: 'yeoksa-side/save' },
  { id: 'saga-realm', name: '5천하', port: 8795, saveKey: 'saga-realm/save' }
];
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };
const localVer = (g) => { const m = /var VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(WEB, g, 'sw.js'), 'utf8')); return m ? m[1] : null; };
const isDone = (x) => (x.human === true ? (x.level === 'D3' || x.level === 'D4') : (x.level === 'D2' || x.level === 'D3' || x.level === 'D4'));   // status.mjs 와 같은 셈

function overview() {
  const deploy = readJson(path.join(PLAY, 'results', 'pw-deploy.json'), null);
  const play = readJson(path.join(PLAY, 'results', 'pw-play.json'), null);
  const qc = readJson(path.join(ROOT, 'tools', '_out', 'qc-last.json'), null);
  const games = GAMES.map((g) => {
    const feats = readJson(path.join(WEB, g.id, 'features.json'), []);
    const b = spawnSync(process.execPath, [path.join(WEB, 'shared', 'build', 'bundle.mjs'), g.id, '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    const dep = deploy && (deploy.games || []).find((x) => x.game === g.id);
    const pl = play ? (play.runs || []).filter((x) => x.game === g.id) : [];
    const qrows = qc ? (qc.rows || []).filter((r) => r.target === g.name || (r.target || '').split('·').includes(g.name)) : [];
    return {
      ...g, localVersion: localVer(g.id),
      deployed: dep ? { version: dep.deployed, same: dep.sameVersion, ok: dep.ok, at: deploy.at } : null,
      bundleFresh: b.status === 0,
      features: { total: feats.length, done: feats.filter(isDone).length, d0: feats.filter((x) => x.level === 'D0').length, d1: feats.filter((x) => x.level === 'D1').length, human: feats.filter((x) => x.human === true && !isDone(x)).length },
      qc: qc ? { at: qc.at, verdict: qc.verdict, fail: qrows.filter((r) => r.status === 'FAIL').map((r) => r.area), warn: qrows.filter((r) => r.status === 'WARN').map((r) => r.area), rows: qrows.length } : null,
      play: pl.length ? { at: play.at, ok: pl.every((x) => x.ok), runs: pl.map((x) => ({ device: x.device, ok: x.ok, fails: x.fails, warns: x.warns, shots: x.shots.map((s) => s.replace(/\\/g, '/').split('/shots/')[1]) })) } : null,
      links: { local: `http://127.0.0.1:${g.port}/`, admin: `http://127.0.0.1:${g.port}/_admin.html`, demo: `http://127.0.0.1:${g.port}/_demo.html`, pages: PAGES + g.id + '/' }
    };
  });
  return { at: new Date().toISOString(), pages: PAGES, games, qc: qc ? { at: qc.at, verdict: qc.verdict, args: qc.args, sec: qc.sec } : null, live: readJson(LIVE, null) };
}

/* ── 실행(한 번에 하나) ── */
const run = { proc: null, cmd: null, lines: [], at: null };
function startRun(cmd, games) {
  if (run.proc) { return { ok: false, why: '이미 도는 중: ' + run.cmd }; }
  const gl = (games && games.length ? games : GAMES.map((g) => g.id)).filter((g) => GAMES.some((x) => x.id === g));
  let args, cwd = ROOT;
  if (cmd === 'qc') { args = [path.join(ROOT, 'tools', 'qc.mjs'), '--game', gl.join(',')]; }
  else if (cmd === 'play') { args = [path.join(PLAY, 'pw-play.mjs'), ...gl]; cwd = PLAY; }
  else if (cmd === 'deploy') { args = [path.join(PLAY, 'pw-deploy.mjs'), ...gl]; cwd = PLAY; }
  else { return { ok: false, why: '모르는 cmd' }; }
  run.cmd = cmd + ' ' + gl.join(','); run.lines = []; run.at = new Date().toISOString();
  let srv = null;
  if (cmd === 'play') {   // 플레이 QC 는 로컬 서버가 필요하다 — 같이 띄우고 끝나면 끈다
    srv = spawn(process.execPath, [path.join(PLAY, 'serve.mjs'), WEB, '8874'], { cwd: PLAY, stdio: 'ignore' });
    args.push('--base', 'http://127.0.0.1:8874/');
  }
  const p = spawn(process.execPath, args, { cwd, env: { ...process.env } });
  run.proc = p;
  const push = (s) => { for (const l of String(s).split(/\r?\n/)) { if (l.trim()) { run.lines.push(l.slice(0, 400)); } } if (run.lines.length > 400) { run.lines = run.lines.slice(-400); } };
  p.stdout.on('data', push); p.stderr.on('data', push);
  p.on('close', (code) => { push(`[끝 code ${code}]`); run.proc = null; if (srv) { try { srv.kill(); } catch (e) { /* 이미 끝남 */ } } });
  return { ok: true, cmd: run.cmd };
}

/* ── live.json ── */
function validLive(j) {
  if (!j || typeof j !== 'object') { return '객체가 아님'; }
  if (!Array.isArray(j.notices)) { return 'notices 가 배열이 아님'; }
  for (const n of j.notices) { if (!n || !n.id || !n.title) { return '공지엔 id·title 이 있어야 함'; } }
  if (!j.maintenance || typeof j.maintenance !== 'object') { return 'maintenance 가 객체가 아님'; }
  if (j.minVersion && typeof j.minVersion !== 'object') { return 'minVersion 이 객체가 아님'; }
  if (j.events && !Array.isArray(j.events)) { return 'events 가 배열이 아님'; }
  if (j.server != null && (typeof j.server !== 'string' || (j.server && !/^https?:\/\//.test(j.server)))) { return 'server 는 http(s) URL 문자열(빈 칸 = 서버 없음)'; }
  return null;
}

if (argv.includes('--check')) {
  const o = overview();
  console.log(o.games.map((g) => `${g.name} ${g.localVersion} 번들${g.bundleFresh ? '○' : '×'} 완성 ${g.features.done}/${g.features.total} 배포 ${g.deployed ? (g.deployed.same ? '같음' : '다름 ' + g.deployed.version) : '-'} QC ${g.qc ? g.qc.verdict : '-'} 플레이 ${g.play ? (g.play.ok ? 'OK' : 'FAIL ' + g.play.runs.filter((r) => !r.ok).map((r) => r.device + ':' + r.fails.join('/')).join(' ')) : '-'}`).join('\n'));
  const sv = o.live && o.live.server;
  const health = sv ? await fetch(sv.replace(/\/+$/, '') + '/v1/health', { signal: AbortSignal.timeout(3000) }).then((r) => r.json()).then((h) => (h && h.ok ? '연결 ○ db ' + h.db : '응답 이상')).catch((e) => '연결 × ' + e.message) : '없음(live.json server 빈 칸)';
  console.log('OPS-CHECK OK live ' + (o.live ? '읽음' : '없음') + ' · 서버 ' + health);
  process.exit(0);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.css': 'text/css; charset=utf-8' };
const send = (res, code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
const json = (res, o, code) => send(res, code || 200, JSON.stringify(o));
const body = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 2e6) { req.destroy(); } }); req.on('end', () => r(s)); });

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/' || u.pathname === '/index.html') { return send(res, 200, fs.readFileSync(path.join(HERE, 'index.html')), MIME['.html']); }
    if (u.pathname === '/api/overview') { return json(res, overview()); }
    if (u.pathname === '/api/live' && req.method === 'GET') { return json(res, readJson(LIVE, null) || { notices: [], maintenance: { on: false, msg: '', games: [] }, minVersion: {}, events: [] }); }
    if (u.pathname === '/api/live' && req.method === 'PUT') {
      let j; try { j = JSON.parse(await body(req)); } catch (e) { return json(res, { ok: false, why: 'JSON 아님' }, 400); }
      const why = validLive(j); if (why) { return json(res, { ok: false, why }, 400); }
      const old = readJson(LIVE, {});
      const out = { _: old._ || '라이브옵스 데이터(W-0271)', updatedAt: new Date().toISOString().slice(0, 10), notices: j.notices, maintenance: j.maintenance, minVersion: j.minVersion || {}, events: j.events || [] };
      fs.writeFileSync(LIVE, JSON.stringify(out, null, 1) + '\n');
      return json(res, { ok: true, live: out, note: '저장됨 — 배포에 실리려면 커밋·푸시(bash tools/push.sh)' });
    }
    if (u.pathname === '/api/run' && req.method === 'POST') { let j = {}; try { j = JSON.parse(await body(req) || '{}'); } catch (e) { /* 빈 몸 */ } return json(res, startRun(j.cmd, j.games)); }
    if (u.pathname === '/api/run/log') { return json(res, { running: !!run.proc, cmd: run.cmd, at: run.at, lines: run.lines }); }
    if (u.pathname.startsWith('/shots/')) {
      const f = path.join(PLAY, 'shots', decodeURIComponent(u.pathname.slice(7)).replace(/\.\./g, ''));
      if (!f.startsWith(path.join(PLAY, 'shots')) || !fs.existsSync(f)) { return send(res, 404, 'none', 'text/plain'); }
      return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
    }
    send(res, 404, 'not found', 'text/plain');
  } catch (e) { json(res, { ok: false, why: e.message }, 500); }
}).listen(PORT, '127.0.0.1', () => console.log(`운영 콘솔 http://127.0.0.1:${PORT}/  (Ctrl+C 로 끝)`));
