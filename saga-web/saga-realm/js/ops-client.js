/**
 * 라이브옵스 수신(W-0271) — 부팅 뒤 `../shared/ops/live.json` 을 읽어 공지 카드·점검 띠·새 버전 띠를 띄운다.
 * 운영 콘솔(saga-web/tools/ops, :8802)이 그 파일을 쓴다. 판 코드는 안 건드린다 — 실패는 전부 조용히(게임을 절대 막지 않는다).
 *
 *   DG.ops.live()            마지막으로 읽은 live.json(없으면 null)
 *   DG.ops.track(ev, data)   운영 지표 한 줄 — localStorage 링버퍼 100건(서버가 생기면 보내는 한 줄만 바꾼다)
 *   DG.ops.dump()            track 버퍼(지원 탭에 붙여넣는 꼴)
 *   DG.ops.refresh()         다시 읽어 띄운다(진단·콘솔 확인용)
 *
 * 본 공지 id 는 localStorage `saga-ops/seen/<판>` — 같은 공지는 한 번만. live.json 의 games 가 비면 다섯 판 전부.
 * 버전 비교는 `sw.js` 의 `var VERSION = '<이름>-v<a>.<b>.<c>'` 마지막 수들(같은 출처 GET, no-store) — 못 읽으면 띠 없음.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var GAME = (function () { var m = /\/(saga-go|saga-dungeon|saga-forest|saga-story|saga-realm)\//.exec(global.location ? global.location.pathname : ''); return m ? m[1] : null; })();
  var SEEN_KEY = 'saga-ops/seen/' + GAME, TRACK_KEY = 'saga-ops/track/' + GAME, TRACK_MAX = 100;
  var live = null, shown = null;

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
      '#ops-card{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:9001;width:min(92vw,420px);padding:14px 16px;border:1px solid #c9a86a;border-radius:8px;background:#1d1a16;color:#f1e8d6;font:14px/1.5 sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6)}' +
      '#ops-card h3{margin:0 0 6px;font-size:16px;color:#f3d79a}#ops-card p{margin:0 0 10px;white-space:pre-wrap}#ops-card button{float:right;padding:4px 14px;border:1px solid #c9a86a;border-radius:4px;background:#3a3025;color:#f1e8d6;cursor:pointer}';
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
    if (m && m.on && forMe(m)) { band('maint', '🛠 점검 중 — ' + (m.msg || '잠시 뒤 다시 열어 주세요'), null); }
    else if (shown && shown.minBand) { band('ver', shown.minBand, '새로 고침', function () { global.location.reload(); }); }
    else { band('', ''); }
    showNotices();
  }
  function checkVersion() {
    var want = live && live.minVersion && live.minVersion[GAME];
    if (!want || !global.fetch) { return Promise.resolve(); }
    return global.fetch('sw.js', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = /var VERSION = '([^']+)'/.exec(t), mine = m ? m[1] : null;
      shown = { mine: mine, want: want, minBand: (mine && older(mine, want)) ? '새 버전(' + want + ')이 있습니다 — 새로 고침하면 반영됩니다' : null };
    }).catch(function () { shown = null; });
  }
  function refresh() {
    if (!GAME || !global.fetch) { return Promise.resolve(null); }
    return global.fetch('../shared/ops/live.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      live = (j && typeof j === 'object') ? j : null;
      return checkVersion().then(function () { apply(); return live; });
    }).catch(function () { return null; });
  }
  function track(ev, data) {
    var buf = lsGet(TRACK_KEY) || [];
    buf.push({ t: Date.now(), ev: String(ev || ''), d: data == null ? null : data });
    if (buf.length > TRACK_MAX) { buf = buf.slice(buf.length - TRACK_MAX); }
    lsSet(TRACK_KEY, buf);
  }
  function dump() { return { game: GAME, at: new Date().toISOString(), track: lsGet(TRACK_KEY) || [], seen: lsGet(SEEN_KEY) || [] }; }

  global.DG = global.DG || {};
  global.DG.ops = { GAME: GAME, live: function () { return live; }, refresh: refresh, track: track, dump: dump, _seenKey: SEEN_KEY, _trackKey: TRACK_KEY };
  if (GAME && !global.DG_NO_OPS && !global.DG_NO_DRAW) {
    var start = function () { global.setTimeout(function () { refresh(); }, 3000); };
    if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', start); } else { start(); }
  }
})(window);
