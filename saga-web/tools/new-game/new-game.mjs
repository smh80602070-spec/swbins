#!/usr/bin/env node
/**
 * 새 판 뼈대 생성기 — saga-web 여섯 번째(일곱 번째…) 게임의 빈 틀을 바로 도는 상태로 만든다.
 *
 *   node saga-web/tools/new-game/new-game.mjs --folder saga-xxx --title 사가무엇 --port 8796 \
 *        --save-base saga-xxx/save [--origin "원작 오마주 한 줄"] [--three] [--dry]
 *
 * 만드는 것(saga-web/<folder>/):
 *   index.html · css/style.css · js/{errlog,data,core,game}.js · sw.js · manifest.json · icons/
 *   _test.html(RESULT n/n, 씨앗 mulberry32(20260824)) · run.bat · start_server.bat
 *   CLAUDE.md · PLAN.md(SAGA-DESIGN §9.3 틀) · HANDOFF.md · README.md · assets/ASSET_LICENSES.md
 * 복사해 오는 것: js/data.js(도감 — saga-go 정본), js/errlog.js(키만 바꿈), icons/(임시 — 바꿔 끼울 것),
 *   --three 면 js/vendor/three.iife.js(MeshoptDecoder 든 번들).
 * 새로 쓰는 것: core(세이브·프로필·씨앗 난수)·game(들판을 걸으며 인물 등용 — 최소한의 실제 놀이)은
 *   다섯 판의 core/account 와 코드를 나누지 않는다(판마다 얽힌 곳이 많아 복사하면 오히려 깨진다).
 *
 * 막는 것: 이미 있는 폴더 · 다른 판이 쓰는 포트/세이브 키/manifest id · 폴더 이름 형식.
 * 등록은 하지 않는다 — 끝에 "손으로 등록할 곳" 목록을 출력하고 새 판 HANDOFF.md 에도 적는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..');           // saga-web/
const CANON = path.join(WEB, 'saga-go');              // 도감 정본
const DONOR = path.join(WEB, 'saga-forest');          // errlog·icons·three 번들

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);

const folder = arg('folder');
const title = arg('title');
const port = Number(arg('port'));
const saveBase = arg('save-base', folder ? folder + '/save' : null);
const origin = arg('origin', '(원작 오마주 — PLAN §1 에서 정한다)');
const withThree = flag('three');
const dry = flag('dry');
const outRoot = arg('out', WEB);                      // 시험용: 다른 곳에 만들어 보기

function die(msg) { console.error('✘ ' + msg); process.exit(1); }
if (!folder || !title || !port) {
  die('사용법: node new-game.mjs --folder saga-xxx --title 사가무엇 --port 8796 [--save-base saga-xxx/save] [--origin "..."] [--three] [--dry] [--out 폴더]');
}
if (!/^saga-[a-z][a-z0-9-]*$/.test(folder)) die('폴더 이름은 saga-소문자 형식: ' + folder);
if (!(port >= 1024 && port <= 65535)) die('포트가 이상하다: ' + port);
if (!/^[a-z0-9-]+\/save$/.test(saveBase)) die('세이브 키는 "<이름>/save" 형식: ' + saveBase);

// ── 겹침 검사: 다른 판 폴더를 훑어 포트·세이브 키·manifest id 를 모은다 ─────────────
const taken = { port: new Map(), save: new Map(), id: new Map() };
for (const g of fs.readdirSync(WEB)) {
  const d = path.join(WEB, g);
  if (!fs.statSync(d).isDirectory()) continue;
  const rd = (f) => { try { return fs.readFileSync(path.join(d, f), 'utf8'); } catch { return ''; } };
  const rb = rd('run.bat') + rd('start_server.bat');
  for (const m of rb.matchAll(/PORT=(\d+)/g)) taken.port.set(Number(m[1]), g);
  const core = rd('js/core.js');
  const sb = /SAVE_BASE\s*=\s*'([^']+)'/.exec(core);
  if (sb) taken.save.set(sb[1], g);
  const man = rd('manifest.json');
  const id = /"id"\s*:\s*"([^"]+)"/.exec(man);
  if (id) taken.id.set(id[1], g);
}
taken.port.set(8799, 'tools/content-editor');
taken.port.set(8800, 'tools/map-editor');
taken.port.set(8801, '사가 엔진(swbins4 저장소)');
const target = path.join(outRoot, folder);
if (fs.existsSync(target)) die('이미 있다: ' + target);
if (taken.port.has(port)) die(`포트 ${port} 는 ${taken.port.get(port)} 가 쓴다`);
if (taken.save.has(saveBase)) die(`세이브 키 ${saveBase} 는 ${taken.save.get(saveBase)} 가 쓴다`);
if (taken.id.has(folder)) die(`manifest id ${folder} 는 ${taken.id.get(folder)} 가 쓴다`);

const errKey = saveBase.replace(/\/save$/, '') + '/errlog';
const verPrefix = folder.replace(/^saga-/, '');

// ── 파일 내용 ──────────────────────────────────────────────────────────────
const files = {};

files['index.html'] = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>${title}</title>
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<canvas id="field"></canvas>
<div id="hud">
  <div class="glass" id="who"></div>
  <div class="glass" id="count"></div>
</div>
<div class="glass" id="toast" hidden></div>
<div id="title" class="glass">
  <h1>${title}</h1>
  <p class="sub">${origin.replace(/[<>&]/g, '')}</p>
  <input id="name" maxlength="12" placeholder="이름">
  <button id="start">시작</button>
  <div id="profiles"></div>
</div>
<script src="js/errlog.js"></script>
<script src="js/data.js"></script>
<script src="js/core.js"></script>
${withThree ? '<script src="js/vendor/three.iife.js"></script>\n' : ''}<script src="js/game.js"></script>
<script>
if ('serviceWorker' in navigator && /^(https:|http:\\/\\/(localhost|127\\.0\\.0\\.1))/.test(location.href)) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
</script>
</body>
</html>
`;

files['css/style.css'] = `:root { --bg: #12141a; --glass: rgba(20,24,32,.72); --line: rgba(255,255,255,.12); --text: #eef0f4; --sub: #9aa3b2; --accent: #e0b25a; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 15px/1.5 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; overflow: hidden; touch-action: none; }
#field { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
.glass { background: var(--glass); border: 1px solid var(--line); border-radius: 12px; backdrop-filter: blur(8px); padding: 8px 12px; }
#hud { position: fixed; top: max(10px, env(safe-area-inset-top)); left: 10px; right: 10px; display: flex; justify-content: space-between; pointer-events: none; }
#toast { position: fixed; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: 90vw; }
#title { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92vw, 360px); text-align: center; padding: 22px; }
#title h1 { margin: 0 0 4px; color: var(--accent); }
#title .sub { margin: 0 0 14px; color: var(--sub); font-size: 13px; }
#title input, #title button { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--line); background: #1c2029; color: var(--text); font-size: 15px; margin-top: 6px; }
#title button { background: var(--accent); color: #1a1406; font-weight: 700; cursor: pointer; }
#profiles button { background: #1c2029; color: var(--text); font-weight: 400; }
`;

files['js/core.js'] = `/**
 * core — 세이브·프로필·씨앗 난수 (${title})
 * ---------------------------------------------------------------
 * 세이브 키: \`${saveBase}/<프로필id>\` — 루트 CLAUDE.md: 세이브 키는 한번 정하면 바꾸지 않는다.
 * 프로필 목록: \`${saveBase.replace(/\/save$/, '')}/profiles\`
 * 난수: 진단(_test.html)이 DG.core.seed(20260824) 로 고정한다.
 */
(function (g) {
  'use strict';
  var DG = g.DG = g.DG || {};
  var SAVE_BASE = '${saveBase}';
  var PROFILES_KEY = '${saveBase.replace(/\/save$/, '')}/profiles';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32((Date.now() ^ 0x5a17) >>> 0);

  function readJson(k, d) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function freshState() { return { v: 1, roster: [], pos: { x: 0, y: 0 }, steps: 0, created: Date.now() }; }

  /* 세이브 스키마 v1: { v, roster:[heroId], pos:{x,y}, steps, created } — 바꿀 땐 v 를 올리고 migrate 에 칸을 더한다 */
  function migrate(s) {
    if (!s || typeof s !== 'object') { return freshState(); }
    if (!s.v) { s.v = 1; }
    if (!Array.isArray(s.roster)) { s.roster = []; }
    if (!s.pos) { s.pos = { x: 0, y: 0 }; }
    return s;
  }

  var core = {
    SAVE_BASE: SAVE_BASE,
    seed: function (n) { rnd = mulberry32(n >>> 0); },
    rand: function () { return rnd(); },
    pick: function (arr) { return arr[Math.floor(rnd() * arr.length)]; },
    profiles: function () { return readJson(PROFILES_KEY, []); },
    createProfile: function (name) {
      var list = core.profiles();
      var id = 'p' + Date.now().toString(36) + Math.floor(rnd() * 1e4).toString(36);
      list.push({ id: id, name: String(name || '이름 없음').slice(0, 12), at: Date.now() });
      writeJson(PROFILES_KEY, list);
      return id;
    },
    keyOf: function (pid) { return SAVE_BASE + '/' + pid; },
    load: function (pid) { return migrate(readJson(core.keyOf(pid), null)); },
    save: function (pid, s) { return writeJson(core.keyOf(pid), s); },
    heroes: function () { return (DG.data && DG.data.heroes) || []; },
  };
  DG.core = core;
})(window);
`;

files['js/game.js'] = `/**
 * game — 들판을 걸으며 역사 인물을 만나 등용한다 (${title} 뼈대)
 * ---------------------------------------------------------------
 * 이건 생성기가 깐 "바로 도는 최소 놀이"다. PLAN §5 에서 이 판만의 메커니즘을 정하면 갈아엎는다.
 * 조작: 방향키/WASD, 폰은 화면을 누른 채 끌기. 인물 표식에 닿으면 등용 → 세이브.
 */
(function (g) {
  'use strict';
  var DG = g.DG, C = DG.core;
  var cv = document.getElementById('field'), cx = cv.getContext('2d');
  var st = null, pid = null, meets = [], keys = {}, drag = null, toastT = 0;
  var SPEED = 3.2, MEET_R = 22, SPAWN = 12;

  function fit() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', fit); fit();

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false; toastT = 150;
  }
  function spawn() {
    var pool = C.heroes().filter(function (h) { return st.roster.indexOf(h.id) < 0; });
    while (meets.length < SPAWN && pool.length) {
      var h = C.pick(pool);
      meets.push({ id: h.id, name: h.name, emoji: h.emoji || '👤', rarity: h.rarity || 1,
        x: st.pos.x + (C.rand() - .5) * 900, y: st.pos.y + (C.rand() - .5) * 900 });
      pool.splice(pool.indexOf(h), 1);
    }
  }
  function hud() {
    var list = C.profiles(), me = list.filter(function (p) { return p.id === pid; })[0];
    document.getElementById('who').textContent = me ? me.name : '';
    document.getElementById('count').textContent = '등용 ' + st.roster.length + ' / ' + C.heroes().length;
  }
  function step() {
    var dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    var dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (drag) { dx = drag.dx; dy = drag.dy; }
    var len = Math.hypot(dx, dy);
    if (len > 0) { st.pos.x += dx / len * SPEED; st.pos.y += dy / len * SPEED; st.steps++; }
    for (var i = meets.length - 1; i >= 0; i--) {
      var m = meets[i];
      if (Math.hypot(m.x - st.pos.x, m.y - st.pos.y) < MEET_R) {
        st.roster.push(m.id); meets.splice(i, 1);
        toast(m.emoji + ' ' + m.name + ' 등용!'); C.save(pid, st); hud(); spawn();
      } else if (Math.hypot(m.x - st.pos.x, m.y - st.pos.y) > 1400) { meets.splice(i, 1); }
    }
    if (meets.length < SPAWN) { spawn(); }
    if (st.steps % 120 === 0) { C.save(pid, st); }
    if (toastT > 0 && --toastT === 0) { document.getElementById('toast').hidden = true; }
  }
  function draw() {
    var w = cv.width, h = cv.height, s = devicePixelRatio;
    cx.fillStyle = '#1d2a1f'; cx.fillRect(0, 0, w, h);
    cx.save(); cx.translate(w / 2 - st.pos.x * s, h / 2 - st.pos.y * s); cx.scale(s, s);
    cx.strokeStyle = 'rgba(255,255,255,.05)';
    var gx = Math.floor((st.pos.x - w) / 64) * 64, gy = Math.floor((st.pos.y - h) / 64) * 64;
    for (var x = gx; x < st.pos.x + w; x += 64) { cx.beginPath(); cx.moveTo(x, gy); cx.lineTo(x, st.pos.y + h); cx.stroke(); }
    for (var y = gy; y < st.pos.y + h; y += 64) { cx.beginPath(); cx.moveTo(gx, y); cx.lineTo(st.pos.x + w, y); cx.stroke(); }
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    meets.forEach(function (m) {
      cx.fillStyle = ['#888', '#9aa3b2', '#5ec26a', '#5b8cff', '#b06cff', '#e0b25a'][m.rarity] || '#888';
      cx.beginPath(); cx.arc(m.x, m.y, 16, 0, Math.PI * 2); cx.fill();
      cx.font = '18px sans-serif'; cx.fillText(m.emoji, m.x, m.y + 1);
      cx.font = '11px sans-serif'; cx.fillStyle = '#eef0f4'; cx.fillText(m.name, m.x, m.y + 28);
    });
    cx.fillStyle = '#e0b25a'; cx.beginPath(); cx.arc(st.pos.x, st.pos.y, 12, 0, Math.PI * 2); cx.fill();
    cx.restore();
  }
  function loop() { step(); draw(); requestAnimationFrame(loop); }

  function begin(id) {
    pid = id; st = C.load(pid);
    document.getElementById('title').hidden = true;
    spawn(); hud(); loop();
  }
  addEventListener('keydown', function (e) { keys[e.key] = true; });
  addEventListener('keyup', function (e) { keys[e.key] = false; });
  cv.addEventListener('pointerdown', function (e) { drag = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; });
  addEventListener('pointermove', function (e) { if (drag) { drag.dx = e.clientX - drag.x0; drag.dy = e.clientY - drag.y0; } });
  addEventListener('pointerup', function () { drag = null; });
  addEventListener('pagehide', function () { if (pid) { C.save(pid, st); } });

  var pl = document.getElementById('profiles');
  C.profiles().forEach(function (p) {
    var b = document.createElement('button'); b.textContent = p.name + ' 이어하기'; b.onclick = function () { begin(p.id); }; pl.appendChild(b);
  });
  document.getElementById('start').onclick = function () {
    begin(C.createProfile(document.getElementById('name').value.trim() || '나그네'));
  };

  DG.game = { begin: begin, state: function () { return st; }, meets: function () { return meets; }, step: step };
})(window);
`;

files['sw.js'] = `/**
 * 서비스 워커 — ${title} 오프라인 뼈대
 * 파일을 늘렸으면 SHELL 에 넣고 **VERSION 도 같이 올린다** — 안 올리면 옛 캐시가 계속 나온다.
 * 같은 출처는 네트워크 먼저(no-store), 실패하면 캐시(사가마을 sw.js 가 밟은 함정을 그대로 피한다).
 */
var VERSION = '${verPrefix}-v0.1.0';
var APP_CACHE = '${verPrefix}-app-' + VERSION;
var SHELL = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/errlog.js', './js/data.js', './js/core.js', './js/game.js',${withThree ? "\n  './js/vendor/three.iife.js'," : ''}
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(APP_CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' }))['catch'](function () { return null; }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k !== APP_CACHE ? caches['delete'](k) : null; }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) { return; }
  e.respondWith(fetch(req, { cache: 'no-store' }).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(APP_CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  })['catch'](function () { return caches.match(req, { ignoreSearch: true }); }));
});
`;

files['manifest.json'] = JSON.stringify({
  name: title, short_name: title, description: origin, lang: 'ko',
  start_url: './index.html', scope: './', id: folder, display: 'fullscreen',
  display_override: ['fullscreen', 'standalone', 'minimal-ui'], orientation: 'any',
  background_color: '#12141a', theme_color: '#12141a', categories: ['games', 'entertainment'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
}, null, 2) + '\n';

const bat = (open) => `@echo off\r\nREM ${folder} local server\r\nset PORT=${port}\r\ncd /d "%~dp0"\r\n${open ? 'start "" http://127.0.0.1:%PORT%/index.html\r\n' : ''}python -m http.server %PORT% --bind 0.0.0.0\r\n`;
files['run.bat'] = bat(true);
files['start_server.bat'] = bat(false);

files['_test.html'] = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>${title} 자가진단</title>
<link rel="stylesheet" href="css/style.css">
<style>
  body { overflow: auto; }
  #report { padding: 16px; font-family: Consolas, monospace; font-size: 13px; line-height: 1.8; position: relative; z-index: 50; background: rgba(10,12,16,.9); }
  .pass { color: #5ec26a; } .fail { color: #e06565; }
</style>
</head>
<body>
<canvas id="field"></canvas>
<div id="hud"><div id="who"></div><div id="count"></div></div>
<div id="toast" hidden></div>
<div id="title"><input id="name"><button id="start"></button><div id="profiles"></div></div>
<div id="report">진단 중…</div>
<script>
/* 진단 규칙(루트 CLAUDE.md "검증"): 씨앗 mulberry32(20260824) 고정 · 결과는 document.title = "RESULT n/n" ·
   세 번 돌려 한 줄도 안 달라야 한다. 진단은 진짜 세이브를 건드리지 않게 시험 프로필을 만들고 끝에 지운다. */
var errors = [];
addEventListener('error', function (e) { errors.push(e.message); });
</script>
<script src="js/errlog.js"></script>
<script src="js/data.js"></script>
<script src="js/core.js"></script>
<script>DG.core.seed(20260824);</script>
<script src="js/game.js"></script>
<script>
(function () {
  var out = [], C = DG.core;
  function t(name, fn) {
    try { var r = fn(); out.push((r ? '<span class="pass">PASS</span> ' : '<span class="fail">FAIL</span> ') + name + (typeof r === 'string' ? ' — ' + r : '')); }
    catch (e) { out.push('<span class="fail">FAIL</span> ' + name + ' — ' + e.message); }
  }
  setTimeout(function () {
    var PK = '${saveBase.replace(/\/save$/, '')}/profiles', keepProfiles = localStorage.getItem(PK);  // 진짜 프로필 목록은 그대로 되돌린다
    var pid = C.createProfile('진단');
    try {
      t('도감이 실렸다(data.js 인물·펫)', function () {
        return C.heroes().length > 0 && DG.data.pets.length > 0 && (C.heroes().length + '명 · 펫 ' + DG.data.pets.length);
      });
      t('세이브 키 형식 — ${saveBase}/(프로필 id)', function () { return C.keyOf(pid).indexOf('${saveBase}/') === 0 && '${saveBase}/(시험 프로필)'; });
      t('세이브 왕복 — 쓰고 읽으면 같다', function () {
        var s = C.load(pid); s.roster = ['x1', 'x2']; s.pos = { x: 7, y: -3 }; C.save(pid, s);
        var r = C.load(pid); return r.roster.join() === 'x1,x2' && r.pos.x === 7 && r.v === 1;
      });
      t('옛/깨진 세이브도 migrate 가 살린다', function () {
        localStorage.setItem(C.keyOf(pid), JSON.stringify({ roster: 'bad' }));
        var r = C.load(pid); return Array.isArray(r.roster) && r.v === 1 && !!r.pos;
      });
      t('씨앗 고정 — 같은 씨앗이면 같은 수열', function () {
        C.seed(20260824); var a = [C.rand(), C.rand(), C.rand()];
        C.seed(20260824); var b = [C.rand(), C.rand(), C.rand()];
        return a.join() === b.join() && a[0].toFixed(6);
      });
      t('놀이 한 바퀴 — 인물 곁으로 가면 등용되고 세이브된다', function () {
        localStorage.removeItem(C.keyOf(pid)); C.seed(20260824);
        DG.game.begin(pid);
        var m = DG.game.meets()[0], s = DG.game.state();
        if (!m) { throw new Error('표식이 안 생김'); }
        s.pos.x = m.x; s.pos.y = m.y; DG.game.step();
        return C.load(pid).roster.indexOf(m.id) >= 0 && ('등용 ' + m.id);
      });
      t('실명 가드 — 표시 이름에 알려진 실명이 없다(도감은 콘텐츠 편집기가 지킨다)', function () {
        var BLACK = ['유비', '관우', '조조', '이순신', '나폴레옹', '카이사르'];
        var hit = C.heroes().filter(function (h) { return BLACK.some(function (n) { return (h.name || '').indexOf(n) >= 0; }); });
        return hit.length === 0 || ('걸림: ' + hit.map(function (h) { return h.id; }).join(',')) === '';
      });
      t('런타임 에러 없음', function () { return errors.length === 0 || ('에러: ' + errors.join(' | ')) === ''; });
    } finally {
      localStorage.removeItem(C.keyOf(pid));
      if (keepProfiles === null) { localStorage.removeItem(PK); } else { localStorage.setItem(PK, keepProfiles); }
    }
    var fail = out.filter(function (s) { return s.indexOf('FAIL') >= 0; }).length;
    document.getElementById('report').innerHTML = '<h3>${title} 자가진단 — ' + (out.length - fail) + '/' + out.length + ' 통과</h3>' + out.join('<br>');
    document.title = 'RESULT ' + (out.length - fail) + '/' + out.length;
  }, 300);
})();
</script>
</body>
</html>
`;

const checklist = [
  `아래 넷은 register.mjs 로 한 번에: node saga-web/tools/new-game/register.mjs --folder ${folder} --title ${title} --port ${port} --save-base ${saveBase} --origin "${origin}"`,
  `  · 루트 CLAUDE.md "다섯 판" 표에 한 줄(게임·폴더 ${folder}·포트 ${port}·세이브 키 ${saveBase}/<프로필>)`,
  `  · tools/precheck.sh 의 targets 기본값과 data.js md5 판 목록에 ${folder}`,
  `  · tools/asset-audit/audit.py 의 WEB_GAMES 에 ${folder}`,
  `  · saga-web/tools/content-editor/server.js 의 GAMES 에 ${folder}(도감을 여섯 벌 함께 고치려면)`,
  `C:\\swbins2\\services.json 허브 카드(별개 저장소, register.mjs 안 건드림)`,
  `icons/ 는 사가마을 것을 임시로 복사했다 — 이 판 아이콘으로 바꿀 것(register.mjs 안 건드림)`,
];

files['CLAUDE.md'] = `# ${folder} (${title})

정본은 이 폴더 \`PLAN.md\`(SAGA-DESIGN §9.3 틀), 이 판 세션 이력은 \`HANDOFF.md\`(append-only), 저장소 규칙은 루트 \`../../CLAUDE.md\`.

- 세이브 키 \`${saveBase}/<프로필>\`·manifest id \`${folder}\` 는 바꾸지 않는다(진행이 사라진다).
- \`js/data.js\` 는 다섯 판 공용 도감의 복사본이다 — 고칠 땐 콘텐츠 편집기로 여러 벌 함께.
- 세션 기록은 \`HANDOFF.md\` 에만 append 한다. \`PLAN.md\` 는 결정이 바뀔 때만 고친다.
- 진단: \`_test.html\` → \`RESULT n/n\`(씨앗 20260824). 로컬: \`run.bat\`(포트 ${port}).
`;

files['PLAN.md'] = `# ${title} PLAN — 정본

## 0. 읽는 법
이 파일엔 날짜 기록을 쓰지 않는다(이력은 \`HANDOFF.md\`). 목차는 \`grep -n "^## " PLAN.md\`.

## 1. 정체성
- 한 줄: (정할 것)
- 원작 오마주: ${origin}
- 이 판만의 차별점 / 인물이 되는 것 / 플레이어 판타지: (정할 것)

## 2. 반드시 지킬 것
- 세이브 키 \`${saveBase}/<프로필>\`, manifest id \`${folder}\` 불변. 이름 정책·에셋 정책은 루트 CLAUDE.md.

## 3. 현재 시스템 지도
| 시스템 | 주 파일 | 상태 | 진단 항목 |
|---|---|---|---|
| 세이브·프로필·씨앗 난수 | js/core.js | 완료(뼈대) | 세이브 왕복 · migrate · 씨앗 고정 |
| 들판 걷기·인물 등용 | js/game.js | 부분(뼈대 놀이) | 놀이 한 바퀴 |
| 오프라인 | sw.js | 완료(뼈대) | — |

## 4. 재미 진단
SAGA-DESIGN §3 표준 8 각각 ○△× — (뼈대라 전부 ×에서 시작)

## 5. 게임성 확장
후보 6~8, 각각 9필드(참고 게임 / 채우는 표준 / 왜 / 메커니즘 / 수치 / UI·조작 / 세이브 스키마·마이그레이션 / 진단 항목 / 범위·우선순위·불변규칙 충돌).

## 6. 그래픽·에셋
판별 팔레트 24색, SAGA-DESIGN §7.2 변형 계획. 바깥 에셋은 \`assets/ASSET_LICENSES.md\` 에 먼저 적는다.

## 7. 버그·안정화
(실기 확인 대기 목록)

## 8. 로드맵
| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 안정화 — 뼈대 진단 통과, 실기 확인 | 진행 |

## 9. 검증
\`node -c js/*.js\` · \`_test.html\` → \`RESULT n/n\`(세 번 같은지). 헤드리스 스크린샷 금지(루트 CLAUDE.md).

## 10. 열린 질문
- 이 판의 원작·핵심 메커니즘은?
`;

files['HANDOFF.md'] = `# ${folder} HANDOFF — 이력(append-only)

## 뼈대 생성 — \`saga-web/tools/new-game/new-game.mjs\`

폴더 \`${folder}\` · 제목 ${title} · 포트 ${port} · 세이브 키 \`${saveBase}/<프로필>\` · three 번들 ${withThree ? '넣음' : '안 넣음'}.

**손으로 등록할 곳**(생성기는 다른 판·도구 파일을 건드리지 않는다):
${checklist.map((c) => '- [ ] ' + c).join('\n')}
`;

files['README.md'] = `# ${title}

## 현재
뼈대 — 들판을 걸으며 도감 인물을 만나 등용한다. \`run.bat\` → http://127.0.0.1:${port}/ · 진단 \`_test.html\`.
`;

files['assets/ASSET_LICENSES.md'] = `# 에셋 출처와 라이선스 (${folder})

바깥에서 가져온 에셋은 넣기 전에 여기 먼저 적는다. **여기 없는 파일은 이 폴더에 두지 않는다.**
이 저장소는 공개라 재배포가 허용되지 않는 에셋은 받지 않는다. 점검: \`py -3 tools/asset-audit/audit.py --game ${folder}\`
(새 판은 audit 의 WEB_GAMES 에 먼저 넣어야 잡힌다).

## 임시 아이콘
\`icons/\` 는 사가마을 아이콘을 복사해 둔 것이다(이 저장소 자체 제작물) — 이 판 아이콘으로 바꿀 것.
`;

// ── 복사해 오는 것 ─────────────────────────────────────────────────────────
const copies = [
  [path.join(CANON, 'js', 'data.js'), 'js/data.js', null],
  [path.join(DONOR, 'js', 'errlog.js'), 'js/errlog.js', (s) => s.replace(/'yeoksa-village\/errlog'/g, `'${errKey}'`)],
];
for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) copies.push([path.join(DONOR, 'icons', f), 'icons/' + f, null]);
if (withThree) copies.push([path.join(DONOR, 'js', 'vendor', 'three.iife.js'), 'js/vendor/three.iife.js', null]);

// ── 쓰기 ───────────────────────────────────────────────────────────────────
const plan = [...Object.keys(files), ...copies.map((c) => c[1])].sort();
console.log(`${dry ? '[dry] ' : ''}${target} — 파일 ${plan.length}개`);
plan.forEach((p) => console.log('  ' + p));
if (!dry) {
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(target, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
  }
  for (const [src, rel, tf] of copies) {
    const p = path.join(target, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (tf) {
      const s = fs.readFileSync(src, 'utf8');
      const out = tf(s);
      if (out === s) die('복사 변환이 안 먹었다(원본이 바뀐 듯): ' + src);
      fs.writeFileSync(p, out, 'utf8');
    } else fs.copyFileSync(src, p);
  }
}
console.log('\n손으로 등록할 곳(새 판 HANDOFF.md 에도 적었다):');
checklist.forEach((c) => console.log('  - ' + c));
