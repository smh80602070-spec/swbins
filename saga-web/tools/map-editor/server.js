/**
 * saga-web 맵 편집기 — 판마다 다른 "지도 데이터"를 브라우저에서 고치는 로컬 전용 서버.
 * 게임 서버가 아니다. `run-map-editor.bat` 으로 켤 때만 뜬다(포트 8800).
 *
 * 지도 모양은 판마다 달라서 **어댑터**(adapters/*.js) 하나가 한 가지 데이터 파일을 맡는다:
 *   land  글자 지도 — `js/land.js` map·places(사가만리)                         → map.html
 *   city  성 지도   — `js/data-city.js` 성 x·y·land + LINKS(사가천하)         → city.html
 *   side  사냥터    — `js/data-side.js` STAGES 발판·줄·문·사람·채집(사가종횡) → side.html
 *   deco  3D 배치   — `js/land.js` 땅의 deco(손으로 놓은 소품, 사가만리)          → scene.html
 *   town  마을      — `js/town.js` 손으로 지은 마을 넷의 장식·사람·표식(사가나락)  → town.html
 * 판 폴더에 그 파일이 있으면 저절로 목록에 뜬다.
 *
 * 어느 어댑터든 원칙은 같다: 검사는 고친 파일을 vm 에서 실행한 **게임 데이터 그대로** 로 하고,
 * 저장은 바뀐 구간만 바꿔 쓴다(안 바꾸면 바이트까지 같다).
 * 막는 것: 그새 파일이 바뀜(md5) · 파일 구문 오류 · 어댑터 검사 오류 · 표시 글자 실명. 저장하면 그 판 sw.js VERSION 을 한 번 올린다.
 *
 * 3D 배치 화면은 그 판의 게임 js(land·world3d·prop3d·relief3d …)를 **그대로 불러** 게임과 같은 계산으로 그린다 —
 * 그래서 화면을 `/g/<판>/__scene.html` 에 얹어 게임과 같은 상대 경로를 쓰게 한다(../lib/gameserve.js).
 * `/play/<판>/` 은 편집기 안 "▶ 실행" 창(연습용 세이브, 서비스워커 없음).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const realname = require('../content-editor/realname');
const swbump = require('../content-editor/swbump');
const land = require('./adapters/land');
const city = require('./adapters/city');
const side = require('./adapters/side');
const deco = require('./adapters/deco');
const town = require('./adapters/town');
const gameserve = require('../lib/gameserve');

// saga-web/ — 시험할 땐 SAGA_WEB_ROOT 로 복사본을 가리킨다
const ROOT = process.env.SAGA_WEB_ROOT ? path.resolve(process.env.SAGA_WEB_ROOT) : path.join(__dirname, '..', '..');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const PORT = +process.env.SAGA_EDITOR_PORT || 8800;   // 시험할 땐 다른 포트로
const ADAPTERS = { land, city, side, deco, town };
const PAGES = ['map.html', 'city.html', 'side.html', 'town.html', 'common.css', 'scene.js'];
/* 3D 배치 화면은 판 경로 밑에 얹는다 — 게임 js·모델을 게임과 같은 상대 경로로 부르려고 */
const SCENE_EXTRA = {};
for (const g of GAMES) {
  SCENE_EXTRA[g + '/__scene.html'] = (res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'scene.html')));
  };
}

const md5 = (t) => crypto.createHash('md5').update(t, 'utf8').digest('hex');
const landPath = (g) => land.file(ROOT, g);

function list(A) { return A.list(ROOT, GAMES, md5); }

function validateBody(A, b) {
  if (GAMES.indexOf(b.game) < 0) return '모르는 판';
  return A.validateBody(b);
}

function handleCheck(A, b) {
  const bad = validateBody(A, b); if (bad) return { error: bad };
  const next = A.apply(fs.readFileSync(A.file(ROOT, b.game), 'utf8'), b);
  return A.checkText(next, b, ROOT);
}

function handleSave(A, b) {
  const bad = validateBody(A, b); if (bad) return { error: bad };
  const file = A.file(ROOT, b.game);
  const cur = fs.readFileSync(file, 'utf8');
  if (md5(cur) !== b.hash) return { error: '그새 ' + A.FILE + ' 가 바뀌었다(다른 세션·편집기) — 새로고침 후 다시' };
  const next = A.apply(cur, b);
  try { new vm.Script(next, { filename: A.FILE }); } catch (e) { return { error: '파일 구문 오류(저장 안 함): ' + e.message }; }
  const rep = A.checkText(next, b, ROOT);
  if (rep.errors.length) return { error: '지도 오류(저장 안 함): ' + rep.errors.slice(0, 5).join(' · '), report: rep };
  const texts = A.guardTexts(b);
  if (texts) { const g = realname.guard(...texts); if (g) return { error: g }; }
  if (next === cur) return { ok: true, hash: md5(cur), report: rep, unchanged: true };
  fs.writeFileSync(file, next, 'utf8');
  return { ok: true, hash: md5(next), report: rep, sw: swbump.bump(path.join(ROOT, b.game), b.game) };
}

function readBody(req) {
  return new Promise((ok, no) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > 2e6) { no(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { no(e); } });
  });
}
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

if (require.main === module) {
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    const fail = (e) => send(res, 500, { error: e.message });
    try {
      const page = u.pathname === '/' ? 'map.html' : u.pathname.slice(1);
      if (req.method === 'GET' && PAGES.indexOf(page) >= 0) {
        const type = page.endsWith('.css') ? 'text/css' : page.endsWith('.js') ? 'text/javascript' : 'text/html';
        res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(path.join(__dirname, page)));
      }
      if (req.method === 'GET' && u.pathname === '/scene.html') {
        const first = GAMES.find((g) => fs.existsSync(deco.file(ROOT, g))) || GAMES[0];
        res.writeHead(302, { Location: '/g/' + (u.searchParams.get('game') || first) + '/__scene.html' });
        return res.end();
      }
      if (gameserve.handle(req, res, u, ROOT, GAMES, SCENE_EXTRA)) return;
      if (req.method === 'GET' && u.pathname === '/api/kinds') {
        return send(res, 200, { kinds: Object.values(ADAPTERS).map((A) => ({ kind: A.kind, label: A.label, page: A.page,
          games: GAMES.filter((g) => (A.has ? A.has(ROOT, g) : fs.existsSync(A.file(ROOT, g)))) })) });
      }
      // /api/<kind>/list · /api/<kind>/check · /api/<kind>/save  (옛 /api/lands·/api/check·/api/save 는 글자 지도)
      let m = /^\/api\/(\w+)\/(list|check|save)$/.exec(u.pathname);
      if (!m && /^\/api\/(lands|check|save)$/.test(u.pathname)) m = [null, 'land', u.pathname === '/api/lands' ? 'list' : u.pathname.slice(5)];
      const A = m && ADAPTERS[m[1]];
      if (A && req.method === 'GET' && m[2] === 'list') {
        const items = list(A);
        return send(res, 200, m[1] === 'land' && u.pathname === '/api/lands' ? { lands: items } : { items });
      }
      if (A && req.method === 'POST' && m[2] === 'check') return readBody(req).then((b) => send(res, 200, handleCheck(A, b))).catch(fail);
      if (A && req.method === 'POST' && m[2] === 'save') return readBody(req).then((b) => send(res, 200, handleSave(A, b))).catch(fail);
      send(res, 404, { error: 'not found' });
    } catch (e) { fail(e); }
  }).listen(PORT, '127.0.0.1', () => {
    console.log('saga-web 맵 편집기: http://127.0.0.1:' + PORT + '/');
    console.log('판 js 지도 데이터(land.js · data-city.js · data-side.js · 사가나락 town.js)를 직접 고칩니다. 게임 서버가 아닙니다. 끝나면 Ctrl+C.');
  });
}

module.exports = {
  // 글자 지도 — 옛 이름 그대로(tools/scene-layout/layout.mjs 가 evalLand 를 가져다 쓴다)
  evalLand: land.evalLand, regionSpans: land.regionSpans, rebuild: land.rebuild, check: land.check,
  lands: () => list(land), handleCheck: (b) => handleCheck(land, b), handleSave: (b) => handleSave(land, b),
  ROOT, landPath,
  // 어댑터 일반
  ADAPTERS, GAMES, list, handleCheckWith: handleCheck, handleSaveWith: handleSave,
};
