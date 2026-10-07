/**
 * saga-web 편집기 공용 — 판 폴더를 편집기 서버에서 그대로 서빙한다(읽기 전용).
 *
 *   /play/<판>/...   편집기 안 "▶ 실행" 창. 게임을 그대로 띄운다.
 *   /g/<판>/...      편집기 화면이 그 판의 js·모델을 **게임과 같은 상대 경로**로 부를 때(3D 배치 화면).
 *   /play-panel.js   편집기 화면에 "▶ 실행" 창을 붙이는 공용 스크립트(같은 폴더 play-panel.js).
 *
 * 둘 다 같은 파일을 준다. 다른 점:
 *   - 캐시 안 함(`no-store`) — 편집기가 저장하면 다음 새로고침에 곧바로 새 파일이 온다.
 *   - `/play/<판>/sw.js` 는 **스스로 등록을 푸는 빈 서비스워커**를 준다. 진짜 sw.js 는 파일을 오래 쥐고 있어
 *     고친 뒤에도 옛 화면이 뜬다. 판 파일은 안 건드린다.
 *   - `/play/<판>/index.html` 끝에 시작 자리 스크립트를 붙인다(`?at=x,y`·`?in=곳` — 판마다 다르다, START 표).
 *
 * 편집기 서버는 게임 서버와 **출처(포트)가 달라** localStorage 도 따로다 — 실행 창의 세이브는
 * 연습용이고, 실제 게임(8791~) 세이브와 섞이지 않는다.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.vrm': 'model/gltf-binary',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.hdr': 'application/octet-stream', '.ktx2': 'image/ktx2',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const SW_STUB = [
  '/* 편집기 실행 창 전용 — 진짜 sw.js 대신. 등록되자마자 스스로 풀려 캐시를 안 쥔다 */',
  "self.addEventListener('install', function () { self.skipWaiting(); });",
  "self.addEventListener('activate', function (e) {",
  '  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })',
  '    .then(function () { return self.registration.unregister(); }));',
  '});',
  '',
].join('\n');

/* 시작 자리 — 판마다 세이브·지도 모양이 달라 여기 적는다. 없는 판은 `?at`·`?in` 을 무시한다.
   `?at=x,y` 는 그 판 편집기 좌표, `?in=<곳>` 은 그 좌표가 속한 곳(사냥터·마을·성 id).
   게임이 뜬 뒤 옮긴다(`_demo.html` 장면과 같은 요령 — 판 파일은 안 고친다).
     ready()     게임이 옮길 수 있는 상태면 손잡이(c), 아니면 null(새 세이브의 세력·인물 고르기 등 — 기다린다)
     off(c, A)   아직 목표 자리가 아니면 true
     put(c, A)   목표 자리로 옮긴다
   함수는 **브라우저에서** 돈다(toString 으로 붙인다) — 바깥 변수를 쓰지 말 것. */
const START = {
  /* 사가만리 — 월드 미터(맵 편집기 3D 배치 좌표 그대로) */
  'saga-go': {
    need: ['at'],
    ready: function () { var s = DG.core && DG.core.save; return s && s.player && s.player.pos ? s.player.pos : null; },
    off: function (p, A) { return Math.hypot(p.x - A.x, p.y - A.y) > 30; },
    put: function (p, A) { p.x = A.x; p.y = A.y; if (DG.world && DG.world.resize) { DG.world.resize(); } },
  },
  /* 사가종횡 — 사냥터 key + 그 사냥터 픽셀(x, 발 y). 레벨이 모자란 곳은 기록 없이 들여보낸다
     (연습용 세이브의 st().stage 를 안 바꾼다 — 게임의 비경 방 넣기와 같은 길) */
  'saga-story': {
    need: ['at', 'in'],
    ready: function () { var S = DG.side; return S && S.raw && S.raw() && DG.sideData ? S : null; },
    off: function (S, A) {
      if (A.bad) { return false; }
      var r = S.raw();
      return r.stage.key !== A.in || Math.abs(r.player.x + S.P_W / 2 - A.x) > 60;
    },
    put: function (S, A) {
      var r = S.raw();
      if (r.stage.key !== A.in) {
        var stg = null;
        DG.sideData.STAGES.forEach(function (s) { if (s.key === A.in) { stg = s; } });
        if (!stg) { A.bad = true; return; }
        if (S.unlocked(A.in)) { S.enter(A.in); } else { S.enter(null, stg); }
        r = S.raw();
        if (!r || r.stage.key !== A.in) { return; }
      }
      var p = r.player;
      p.x = A.x - S.P_W / 2; p.y = A.y - S.P_H;
      p.vx = 0; p.vy = 0; p.climb = null; p.onGround = false;
    },
  },
  /* 사가나락 — 손 마을 id + 그 마을 BASE 좌표(560×380 기준). 세계 좌표 = 앵커 + BASE × (방 크기 / BASE).
     방 크기는 창 폭 따라 달라(데스크톱 배율) 게임 안에서 잰다. 들판·던전에 있으면 마을로 나올 때까지 기다린다 */
  'saga-dungeon': {
    need: ['at', 'in'],
    consts: { file: 'js/town.js', re: /var\s+BASE_W\s*=\s*(\d+)\s*,\s*BASE_H\s*=\s*(\d+)/, keys: ['bw', 'bh'], dflt: [560, 380] },
    ready: function () { var T = DG.town; return T && T.active && T.active() && T.raw && T.raw() ? T : null; },
    off: function (T, A) {
      var r = T.raw(), w = T.worldAnchors()[A.in];
      if (!w) { return false; }
      return Math.hypot(r.player.x - (w.x + A.x * r.roomW / A.bw), r.player.y - (w.y + A.y * r.roomH / A.bh)) > 40;
    },
    put: function (T, A) {
      var r = T.raw(), w = T.worldAnchors()[A.in], p = r.player;
      p.x = w.x + A.x * r.roomW / A.bw; p.y = w.y + A.y * r.roomH / A.bh;
      p.dash = null;
    },
  },
  /* 사가천하 — 성 id. 판이 선 뒤(새 세이브면 세력을 고른 뒤) 그 성 시트를 열고 3D 지도를 그리로 돌린다.
     2D 지도 가운데는 게임이 밖에 안 내놓아 못 옮긴다. 세 번 돌려 두고 끝(3D 가 늦게 켜져도 따라가게) */
  'saga-realm': {
    need: ['in'],
    ready: function () { var R = DG.rtk; return R && R.state && R.state().started && DG.ui && DG.ui.openCity && DG.cityData ? R : null; },
    off: function (R, A) { return (A.k || 0) < 3; },
    put: function (R, A) {
      var d = DG.cityData.find(A.in);
      A.k = d ? (A.k || 0) + 1 : 9;
      if (!d) { return; }
      if (A.k === 1) { DG.ui.openCity(A.in); }
      if (DG.realm3d && DG.realm3d.panTo) { DG.realm3d.panTo(d.x, d.y, 20); }
    },
  },
};

/* 판 파일에서 상수를 읽어 A 에 얹는다(사가나락 BASE 크기) — 못 읽으면 기본값 */
function startConsts(game, root) {
  const c = START[game] && START[game].consts, out = {};
  if (!c) return out;
  let m = null;
  try { m = c.re.exec(fs.readFileSync(path.join(root, game, c.file), 'utf8')); } catch (e) { /* 기본값 */ }
  c.keys.forEach((k, i) => { out[k] = m ? +m[i + 1] : c.dflt[i]; });
  return out;
}

/* 세이브를 불러오거나 프로필을 고르면 자리가 되돌아갈 수 있어 **자리가 가만히 있을 때까지**
   몇 번 더 본다(벗어나 있으면 다시 옮긴다, 네 번 연속 제자리면 끝, 옮길 수 있게 된 뒤 최대 15초).
   옮길 수 있게 되기 전(세력·인물 고르기, 던전 안)은 2분까지 기다린다 */
function startScript(game, root) {
  const S = START[game];
  if (!S) return '';
  return '\n<script>/* 편집기 실행 창 — 시작 자리(?at=x,y · ?in=곳). 판 파일이 아니라 편집기가 붙인 것 */\n' +
    '(function () {\n' +
    "  var q = location.search, m = /[?&]at=(-?[\d.]+),(-?[\d.]+)/.exec(q), w = /[?&]in=([\w-]+)/.exec(q);\n" +
    '  var A = ' + JSON.stringify(startConsts(game, root || '')) + ';\n' +
    '  if (m) { A.x = +m[1]; A.y = +m[2]; } if (w) { A.in = w[1]; }\n' +
    '  var need = ' + JSON.stringify(S.need) + ';\n' +
    "  if (need.indexOf('at') >= 0 && !m || need.indexOf('in') >= 0 && !w) { return; }\n" +
    '  var ready = ' + S.ready.toString() + ';\n' +
    '  var off = ' + S.off.toString() + ';\n' +
    '  var put = ' + S.put.toString() + ';\n' +
    '  var n = 0, wait = 0, still = 0;\n' +
    '  function tick() {\n' +
    '    var c = null; try { c = ready(); } catch (e) { c = null; }\n' +
    '    if (c) {\n' +
    '      var o = false; try { o = off(c, A); } catch (e) { o = false; }\n' +
    "      if (o) { still = 0; try { put(c, A); } catch (e) { if (window.console) { console.warn('[편집기 시작 자리]', e); } } }\n" +
    '      else if (++still >= 4) { return; }\n' +
    '      if (++n >= 60) { return; }\n' +
    '    } else if (++wait >= 480) { return; }\n' +
    '    setTimeout(tick, 250);\n' +
    '  }\n' +
    "  window.addEventListener('load', function () { setTimeout(tick, 400); });\n" +
    '})();\n</script>\n';
}

function send404(res, msg) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg || 'not found');
}

/**
 * 요청이 /play/·/g/ 이면 처리하고 true. 아니면 false(부르는 쪽이 계속 판정).
 * @param root  saga-web/ 경로
 * @param games 판 폴더 이름 목록
 * @param extra { '<판>/<경로>': (res) => void } — /g/ 아래 가상 파일(편집기 화면을 판 경로에 얹을 때)
 */
function handle(req, res, u, root, games, extra) {
  if (req.method === 'GET' && u.pathname === '/play-panel.js') {
    res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'play-panel.js')));
    return true;
  }
  const m = /^\/(play|g)\/([a-z0-9-]+)(\/.*)?$/.exec(u.pathname);
  if (!m || req.method !== 'GET') return false;
  const kind = m[1], game = m[2];
  if (games.indexOf(game) < 0) { send404(res, '모르는 판'); return true; }
  if (!m[3]) { res.writeHead(302, { Location: '/' + kind + '/' + game + '/' + u.search }); res.end(); return true; }
  let rel;
  try { rel = decodeURIComponent(m[3].slice(1)); } catch (e) { send404(res); return true; }
  if (rel === '' ) rel = 'index.html';
  if (kind === 'g' && extra && extra[game + '/' + rel]) { extra[game + '/' + rel](res); return true; }
  const head = { 'Cache-Control': 'no-store' };
  if (kind === 'play' && rel === 'sw.js') {
    res.writeHead(200, Object.assign({ 'Content-Type': MIME['.js'] }, head));
    res.end(SW_STUB);
    return true;
  }
  const base = path.join(root, game);
  const target = path.resolve(base, rel);
  if (!target.startsWith(base + path.sep)) { res.writeHead(403); res.end('forbidden'); return true; }
  let st;
  try { st = fs.statSync(target); } catch (e) { send404(res); return true; }
  if (!st.isFile()) { send404(res); return true; }
  const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
  let body = fs.readFileSync(target);
  if (kind === 'play' && rel === 'index.html') {
    const s = startScript(game, root);
    if (s) {
      const html = body.toString('utf8');
      const at = html.lastIndexOf('</body>');
      body = Buffer.from(at >= 0 ? html.slice(0, at) + s + html.slice(at) : html + s, 'utf8');
    }
  }
  res.writeHead(200, Object.assign({ 'Content-Type': type, 'Content-Length': body.length }, head));
  res.end(body);
  return true;
}

module.exports = { handle, MIME, START, SW_STUB, startScript, startConsts };
