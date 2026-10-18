/**
 * 라이브옵스 수신(W-0271) + 운영 서버 연결(W-0326) — 부팅 뒤 `../shared/ops/live.json` 을 읽어 공지 카드·점검 띠·새 버전 띠를 띄운다.
 * live.json 의 `server` 가 비어 있지 않으면(saga-ops/server.mjs) 그 서버에 익명 기기 id 로 로그인해
 * 서버 플래그(즉시)·우편·상품 표를 받고 `track` 버퍼를 보낸다. 서버가 없거나 죽어도 게임은 그대로(전부 조용히 실패).
 *
 *   DG.ops.live()            마지막으로 읽은 live.json(+서버 플래그 덮어쓴 것, 없으면 null)
 *   DG.ops.track(ev, data)   운영 지표 한 줄 — localStorage 링버퍼 100건 → 서버가 있으면 30초마다·숨길 때(beacon) 보낸다
 *   DG.ops.dump()            track 버퍼(지원 탭에 붙여넣는 꼴)
 *   DG.ops.refresh()         다시 읽어 띄운다(진단·콘솔 확인용)
 *   DG.ops.server()·session()·flags()·products()   연결 상태·기능 플래그(flags[game] 또는 flags['*'])·판매 중 상품
 *   DG.ops.mail()·claim(id)·onMail(fn)             미수령 우편 · 받기(→ items) · 받은 items 를 판이 지급하는 갈고리 fn(items, mail)
 *   DG.ops.buy(productId, provider, payload)       영수증 검증 요청(서버가 플랫폼 확인 → 우편) · DG.ops.saveUp(data, rev)·saveDown()  세이브 동기화(수동)
 *
 * 본 공지 id 는 localStorage `saga-ops/seen/<판>` — 같은 공지는 한 번만. live.json 의 games 가 비면 다섯 판 전부.
 * 기기 id `saga-ops/device`(판 공통) · 세션 `saga-ops/session/<판>` · 세이브 키·앱 id 는 안 건드린다.
 * 버전 비교는 `sw.js` 의 `var VERSION = '<이름>-v<a>.<b>.<c>'` 마지막 수들(같은 출처 GET, no-store) — 못 읽으면 띠 없음.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var GAME = (function () { var m = /\/(saga-go|saga-dungeon|saga-forest|saga-story|saga-realm)\//.exec(global.location ? global.location.pathname : ''); return m ? m[1] : null; })();
  var SEEN_KEY = 'saga-ops/seen/' + GAME, TRACK_KEY = 'saga-ops/track/' + GAME, TRACK_MAX = 100;
  var DEV_KEY = 'saga-ops/device', SESS_KEY = 'saga-ops/session/' + GAME;
  var live = null, shown = null, mine = null;
  var srv = '', sess = null, flagsNow = {}, productsNow = [], mailsNow = [], mailCbs = [], timers = [], errN = 0, banned = null;

  function lsGet(k) { try { return JSON.parse(global.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 꽉 참·사생활 모드 */ } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function forMe(x) { return !x.games || !x.games.length || x.games.indexOf(GAME) >= 0; }
  function inWindow(x) { var t = today(); return (!x.from || x.from <= t) && (!x.to || t <= x.to); }
  function verNums(s) { var m = /v(\d+)\.(\d+)\.(\d+)/.exec(String(s || '')); return m ? [+m[1], +m[2], +m[3]] : null; }
  function older(a, b) { var x = verNums(a), y = verNums(b); if (!x || !y) { return false; } for (var i = 0; i < 3; i++) { if (x[i] !== y[i]) { return x[i] < y[i]; } } return false; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function css() {
    if (doc.getElementById('ops-css')) { return; }
    var st = doc.createElement('style'); st.id = 'ops-css';
    st.textContent = '#ops-band{position:fixed;left:0;right:0;top:0;z-index:9000;padding:6px 12px;font:14px/1.4 sans-serif;color:#fff;background:#8a2d2d;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.4)}' +
      '#ops-band.ver{background:#2d5a8a}#ops-band button{margin-left:10px;padding:2px 10px;border:1px solid #fff;border-radius:4px;background:transparent;color:#fff;cursor:pointer}' +
      '#ops-card,#ops-mail{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:9001;width:min(92vw,420px);padding:14px 16px;border:1px solid #c9a86a;border-radius:8px;background:#1d1a16;color:#f1e8d6;font:14px/1.5 sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6)}' +
      '#ops-card h3,#ops-mail h3{margin:0 0 6px;font-size:16px;color:#f3d79a}#ops-card p{margin:0 0 10px;white-space:pre-wrap}#ops-card button,#ops-mail button{float:right;padding:4px 14px;border:1px solid #c9a86a;border-radius:4px;background:#3a3025;color:#f1e8d6;cursor:pointer}' +
      '#ops-mail ul{list-style:none;margin:0 0 8px;padding:0;max-height:40vh;overflow:auto}#ops-mail li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #3a3025}#ops-mail li button{float:none;padding:2px 10px}#ops-mail small{color:#b9a98a}';
    doc.head.appendChild(st);
  }
  function band(kind, msg, btn, onBtn) {
    var el = doc.getElementById('ops-band');
    if (!msg) { if (el) { el.remove(); } return; }
    css();
    if (!el) { el = doc.createElement('div'); el.id = 'ops-band'; doc.body.appendChild(el); }
    el.className = kind; el.innerHTML = esc(msg) + (btn ? '<button type="button">' + esc(btn) + '</button>' : '');
    var b = el.querySelector('button'); if (b) { b.addEventListener('click', onBtn || function () { el.remove(); }); }
  }
  function card(n, done) {
    css();
    var old = doc.getElementById('ops-card'); if (old) { old.remove(); }
    var el = doc.createElement('div'); el.id = 'ops-card';
    el.innerHTML = '<h3>' + esc(n.title || '공지') + '</h3><p>' + esc(n.body || '') + '</p><button type="button">닫기</button>';
    el.querySelector('button').addEventListener('click', function () { el.remove(); done(); });
    doc.body.appendChild(el);
  }
  function showNotices() {
    var seen = lsGet(SEEN_KEY) || [], list = (live.notices || []).filter(function (n) { return n && n.id && forMe(n) && inWindow(n) && seen.indexOf(n.id) < 0; });
    (function next() { var n = list.shift(); if (!n) { return; } card(n, function () { seen.push(n.id); lsSet(SEEN_KEY, seen.slice(-200)); next(); }); })();
  }
  function apply() {
    if (!live || !doc.body) { return; }
    var m = live.maintenance;
    if (banned) { band('maint', '⛔ 이 계정은 정지 중입니다' + (banned.reason ? ' — ' + banned.reason : '') + (banned.until ? ' (' + new Date(banned.until).toLocaleDateString() + ' 까지)' : ''), null); }
    else if (m && m.on && forMe(m)) { band('maint', '🛠 점검 중 — ' + (m.msg || '잠시 뒤 다시 열어 주세요'), null); }
    else if (shown && shown.minBand) { band('ver', shown.minBand, '새로 고침', function () { global.location.reload(); }); }
    else { band('', ''); }
    showNotices();
  }
  function checkVersion() {
    var want = live && live.minVersion && live.minVersion[GAME];
    if (!global.fetch || (mine && !want)) { return Promise.resolve(); }
    return global.fetch('sw.js', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = /var VERSION = '([^']+)'/.exec(t); mine = m ? m[1] : null;
      shown = { mine: mine, want: want, minBand: (want && mine && older(mine, want)) ? '새 버전(' + want + ')이 있습니다 — 새로 고침하면 반영됩니다' : null };
    }).catch(function () { shown = null; });
  }

  /* ── 서버(W-0326) ── */
  function deviceId() {
    var d = lsGet(DEV_KEY);
    if (!d) {
      var c = global.crypto;
      d = 'd_' + (c && c.randomUUID ? c.randomUUID().replace(/-/g, '') : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12)));
      lsSet(DEV_KEY, d);
    }
    return d;
  }
  function api(method, p, body) {
    if (!srv || !global.fetch) { return Promise.reject(new Error('no server')); }
    var h = { 'Content-Type': 'application/json' }; if (sess && sess.token) { h['X-Session'] = sess.token; }
    return global.fetch(srv + p, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.status === 401 && sess) { sess = null; lsSet(SESS_KEY, null); }
        if (r.status === 403 && j && j.banned) { banned = j.banned; apply(); }
        return { code: r.status, ok: r.ok, j: j };
      });
    });
  }
  function login() {
    var s = lsGet(SESS_KEY);
    if (s && s.token && s.expires > Date.now() + 864e5) { sess = s; return Promise.resolve(sess); }
    return api('POST', '/v1/account/login', { device: deviceId(), game: GAME }).then(function (r) {
      if (r.ok && r.j && r.j.token) { sess = { uid: r.j.uid, token: r.j.token, expires: r.j.expires }; lsSet(SESS_KEY, sess); banned = null; return sess; }
      return null;
    });
  }
  function flush() {
    var buf = lsGet(TRACK_KEY) || [];
    if (!buf.length || !sess) { return Promise.resolve(0); }
    var batch = buf.slice(0, 200);
    return api('POST', '/v1/events', { game: GAME, events: batch }).then(function (r) {
      if (!r.ok) { return 0; }
      var now = lsGet(TRACK_KEY) || [];                              // 보내는 사이 쌓인 건 남긴다(시각으로 가름)
      var lastT = batch[batch.length - 1].t;
      lsSet(TRACK_KEY, now.filter(function (e) { return e.t > lastT; }));
      return batch.length;
    }).catch(function () { return 0; });
  }
  function beacon() {
    var buf = lsGet(TRACK_KEY) || [];
    if (!srv || !sess || !buf.length || !global.navigator || !global.navigator.sendBeacon) { return; }
    try {
      var ok = global.navigator.sendBeacon(srv + '/v1/events', new global.Blob([JSON.stringify({ game: GAME, token: sess.token, events: buf.slice(0, 200) })], { type: 'application/json' }));
      if (ok) { lsSet(TRACK_KEY, buf.slice(200)); }
    } catch (e) { /* 조용히 */ }
  }
  function pullFlags() {
    return api('GET', '/v1/flags?game=' + GAME).then(function (r) {
      if (!r.ok || !r.j) { return null; }
      var j = r.j; flagsNow = j.flags || {}; productsNow = j.products || [];
      live = Object.assign({}, live || {}, { notices: j.notices || [], maintenance: j.maintenance || { on: false }, minVersion: j.minVersion || {}, events: j.events || [], flags: flagsNow, products: productsNow, pay: j.pay, fromServer: true });
      return checkVersion().then(function () { apply(); return j; });
    }).catch(function () { return null; });
  }
  function pullMail() {
    return api('GET', '/v1/mail?game=' + GAME).then(function (r) {
      mailsNow = (r.ok && r.j && r.j.mails) || [];
      if (mailsNow.length) { mailBox(); }
      return mailsNow;
    }).catch(function () { return mailsNow; });
  }
  function claim(id) {
    return api('POST', '/v1/mail/' + id + '/claim', {}).then(function (r) {
      if (!r.ok || !r.j || !r.j.ok) { return null; }
      var m = null; mailsNow = mailsNow.filter(function (x) { if (x.id === id) { m = x; return false; } return true; });
      if (!r.j.already) { for (var i = 0; i < mailCbs.length; i++) { try { mailCbs[i](r.j.items || [], m || { id: id, title: r.j.title }); } catch (e) { /* 판 갈고리 오류는 삼킨다 */ } } }
      track('mail_claim', { id: id, n: (r.j.items || []).length });
      return r.j.items || [];
    });
  }
  function mailBox() {
    if (!doc.body) { return; }
    css();
    var el = doc.getElementById('ops-mail');
    if (!mailsNow.length) { if (el) { el.remove(); } return; }
    if (!el) { el = doc.createElement('div'); el.id = 'ops-mail'; doc.body.appendChild(el); }
    el.innerHTML = '<h3>📬 우편 ' + mailsNow.length + '</h3><ul>' + mailsNow.map(function (m) {
      var it = (m.items || []).map(function (x) { return esc((x.id || x.kind || '') + (x.n ? ' ×' + x.n : '')); }).join(', ');
      return '<li><span>' + esc(m.title) + '<br><small>' + esc(m.body || '') + (it ? ' · ' + it : '') + '</small></span><button type="button" data-id="' + m.id + '">받기</button></li>';
    }).join('') + '</ul><button type="button" data-close="1">닫기</button>';
    el.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('button') : null; if (!b) { return; }
      if (b.getAttribute('data-close')) { el.remove(); return; }
      var id = +b.getAttribute('data-id'); b.disabled = true; b.textContent = '…';
      claim(id).then(function (items) { if (items && !mailCbs.length) { b.textContent = '받음'; } mailBox(); });
    });
  }
  function buy(productId, provider, payload) {
    return api('POST', '/v1/receipt', { game: GAME, provider: provider, productId: productId, payload: payload || {} }).then(function (r) {
      track('buy', { p: productId, ok: !!(r.j && r.j.ok), why: r.j && r.j.why });
      if (r.j && r.j.ok) { pullMail(); }
      return r.j;
    });
  }
  function connect() {
    srv = String(global.DG_OPS_URL || (live && live.server) || '').replace(/\/+$/, '');
    if (!srv || banned) { return Promise.resolve(null); }
    return login().then(function (s) {
      if (!s) { return null; }
      track('boot', { v: mine, w: global.innerWidth, h: global.innerHeight, m: global.matchMedia && global.matchMedia('(pointer:coarse)').matches ? 1 : 0 });
      while (timers.length) { global.clearInterval(timers.pop()); }
      timers.push(global.setInterval(flush, 30000), global.setInterval(pullFlags, 300000), global.setInterval(pullMail, 180000));
      return pullFlags().then(flush).then(pullMail).then(function () { return s; });
    }).catch(function () { return null; });
  }
  function refresh() {
    if (!GAME || !global.fetch) { return Promise.resolve(null); }
    return global.fetch('../shared/ops/live.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      live = (j && typeof j === 'object') ? j : null;
      return checkVersion().then(function () { apply(); return connect(); }).then(function () { return live; });
    }).catch(function () { return null; });
  }
  function track(ev, data) {
    var buf = lsGet(TRACK_KEY) || [];
    buf.push({ t: Date.now(), ev: String(ev || ''), d: data == null ? null : data });
    if (buf.length > TRACK_MAX) { buf = buf.slice(buf.length - TRACK_MAX); }
    lsSet(TRACK_KEY, buf);
  }
  function dump() { return { game: GAME, at: new Date().toISOString(), device: lsGet(DEV_KEY), uid: sess && sess.uid, server: srv || null, track: lsGet(TRACK_KEY) || [], seen: lsGet(SEEN_KEY) || [] }; }
  function saveUp(data, rev) { return api('PUT', '/v1/save/' + GAME, rev == null ? { data: data } : { data: data, rev: rev }).then(function (r) { return r.j; }); }
  function saveDown() { return api('GET', '/v1/save/' + GAME).then(function (r) { return r.ok ? r.j : null; }); }

  global.DG = global.DG || {};
  global.DG.ops = {
    GAME: GAME, live: function () { return live; }, refresh: refresh, track: track, dump: dump, _seenKey: SEEN_KEY, _trackKey: TRACK_KEY,
    server: function () { return srv || null; }, session: function () { return sess; }, flags: function () { return flagsNow; }, products: function () { return productsNow; }, banned: function () { return banned; },
    mail: function () { return mailsNow; }, claim: claim, onMail: function (fn) { if (typeof fn === 'function') { mailCbs.push(fn); } }, buy: buy, saveUp: saveUp, saveDown: saveDown,
    flush: flush, login: login, pullFlags: pullFlags, pullMail: pullMail, device: deviceId
  };
  if (GAME && !global.DG_NO_OPS && !global.DG_NO_DRAW) {
    var start = function () { global.setTimeout(function () { refresh(); }, 3000); };
    if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', start); } else { start(); }
    global.addEventListener('error', function (e) { if (errN++ < 20) { track('error', { msg: String(e && e.message || '').slice(0, 300), src: String(e && e.filename || '').split('/').pop(), line: e && e.lineno }); } });
    global.addEventListener('unhandledrejection', function (e) { if (errN++ < 20) { track('error', { msg: 'unhandled: ' + String(e && e.reason && (e.reason.message || e.reason)).slice(0, 300) }); } });
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') { beacon(); } else if (srv && sess) { pullMail(); } });   // 탭에 돌아오면 우편 확인
    global.addEventListener('pagehide', beacon);
  }
})(window);
