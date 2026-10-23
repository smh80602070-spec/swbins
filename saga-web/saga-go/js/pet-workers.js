/**
 * 1만리 — 신수 일꾼 (W-0395 ③ 웹 역이식 — 정본 고돗 G-0328 · 팰월드 구조만)
 * ---------------------------------------------------------------
 * 쉼터에서 쉬면(rest:sit) 가진 신수(도감 dex.pets 에 잡힌 kind 'divine') 중 앉힌 둘(MAX)이 실제 시간으로 재료를 모은다 —
 * 한 마리가 EVERY_MIN(30)분에 하나, 상한 CAP(24). 종별 특기는 id 해시로 둘 중 하나: ⛏️ 캐기 → 인장 조각(shard) · 🌿 뜯기 → 사료(feed).
 * 다시 쉼터에 들면 모은 것을 가방에 받는다(가방이 차면 남는다). 앉히기·일으키기는 나 시트 「🐾 신수 일꾼」 칸(data-worker).
 *
 *   세이브 save.rest.workers = { pets: [id…], at: ms, held: { shard: n, feed: n } } — rest 안 순수 추가. 손잡이 workers.on(1)·every(30)·cap(24).
 *   순수 함수 jobOf(id) · due(now) 는 진단이 쓴다. 자동 앉히기: 처음 쉴 때 일꾼이 비었으면 가진 신수 앞 둘을 앉힌다(사람 손 없이도 굴러가게).
 */
(function (global) {
  'use strict';

  var MAX = 2;
  var JOBS = { dig: { key: 'dig', name: '캐기', icon: '⛏️', item: 'shard' }, pick: { key: 'pick', name: '뜯기', icon: '🌿', item: 'feed' } };

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('workers.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function data() { return global.DG.data; }
  function book() {
    var s = core().save; if (!s.rest) { s.rest = { lit: [], at: null }; }
    if (!s.rest.workers) { s.rest.workers = { pets: [], at: 0, held: {} }; }
    return s.rest.workers;
  }
  function hash(id) { var h = 0, i; for (i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) >>> 0; } return h; }
  function jobOf(id) { return hash(String(id)) % 2 ? JOBS.pick : JOBS.dig; }
  /** 가진 신수 — 도감에 잡힌 kind 'divine' */
  function owned() {
    var dex = core().save.dex || {}, got = dex.pets || {}, out = [];
    (data().pets || []).forEach(function (p) { if (p.kind === 'divine' && got[p.id]) { out.push(p); } });
    return out;
  }
  function seated() { return book().pets.slice(); }
  function isSeated(id) { return book().pets.indexOf(id) >= 0; }
  function seat(id) {
    var b = book(), ok = owned().some(function (p) { return p.id === id; });
    if (!ok) { return { ok: false, why: '가진 신수가 아니다' }; }
    if (isSeated(id)) { return { ok: false, why: '이미 앉아 있다' }; }
    if (b.pets.length >= MAX) { return { ok: false, why: '자리는 ' + MAX + '칸' }; }
    settle(Date.now()); b.pets.push(id); b.at = Date.now();
    return { ok: true };
  }
  function unseat(id) { var b = book(), i = b.pets.indexOf(id); if (i < 0) { return { ok: false, why: '앉아 있지 않다' }; } settle(Date.now()); b.pets.splice(i, 1); return { ok: true }; }

  /** 지금까지 쌓인 것을 held 로 옮기고 시계를 맞춘다 — 한 마리 every 분에 하나 · 전체 상한 cap */
  function settle(now) {
    var b = book(), every = K('every', 30) * 60000, cap = K('cap', 24), total = 0, k;
    if (!b.pets.length || !b.at) { b.at = now; return 0; }
    var n = Math.floor((now - b.at) / every);
    if (n <= 0) { return 0; }
    for (k in b.held) { if (b.held.hasOwnProperty(k)) { total += b.held[k]; } }
    var gained = 0;
    b.pets.forEach(function (id) { var j = jobOf(id), give = Math.max(0, Math.min(n, cap - total - gained)); b.held[j.item] = (b.held[j.item] || 0) + give; gained += give; });
    b.at += n * every;
    return gained;
  }
  function due(now) { settle(now); var b = book(), t = 0, k; for (k in b.held) { if (b.held.hasOwnProperty(k)) { t += b.held[k]; } } return t; }

  /** 쉼터에 들었을 때 — 모은 것을 가방으로. 처음이면 가진 신수 앞 둘을 앉힌다 */
  function collect(now) {
    if (!on()) { return 0; }
    var b = book(), B = global.DG.bag, got = 0, k;
    if (!b.pets.length) { owned().slice(0, MAX).forEach(function (p) { b.pets.push(p.id); }); b.at = now || Date.now(); if (b.pets.length) { toast('🐾 신수 ' + b.pets.length + '마리가 쉼터에 앉아 일을 시작했다'); } return 0; }
    settle(now || Date.now());
    for (k in b.held) {
      if (!b.held.hasOwnProperty(k) || !b.held[k]) { continue; }
      var give = B && B.add ? B.add(k, b.held[k]) : 0;
      b.held[k] -= give; got += give;
    }
    if (got) { toast('🐾 신수 일꾼이 모은 것 ' + got + '개를 받았다'); }
    return got;
  }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast(msg); } }

  /** 나 시트 칸 */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function html() {
    if (!on()) { return ''; }
    var own = owned(), b = book(), c = core();
    if (!own.length) { return ''; }
    settle(Date.now());
    var held = Object.keys(b.held).filter(function (k) { return b.held[k] > 0; }).map(function (k) { return k + ' ' + b.held[k]; }).join(' · ');
    var out = '<div class="sec"><h4>🐾 신수 일꾼 <span class="muted">' + b.pets.length + '/' + MAX + ' · ' + K('every', 30) + '분에 하나 · 상한 ' + K('cap', 24) + (held ? ' · 모은 것 ' + esc(held) : '') + '</span></h4>';
    own.forEach(function (p) {
      var j = jobOf(p.id), s = isSeated(p.id);
      out += '<div class="pc-row"><span>' + (p.emoji || '🐾') + ' ' + esc(p.name) + ' <small class="muted">' + j.icon + ' ' + j.name + ' → ' + (c.fmt ? '' : '') + j.item + '</small></span>' +
        '<button class="btn tiny' + (s ? '' : ' primary') + '" data-worker="' + (s ? 'up:' : 'sit:') + p.id + '">' + (s ? '일으키기' : '앉히기') + '</button></div>';
    });
    return out + '<small class="muted">쉼터에서 쉬면 모은 것을 받습니다.</small></div>';
  }
  function bind() {
    var c = core(); if (!c || !c.on) { return; }
    c.on('rest:sit', function () { collect(Date.now()); });
    if (global.document) {
      global.document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-worker]') : null;
        if (!b) { return; }
        var a = b.getAttribute('data-worker'), r = a.indexOf('sit:') === 0 ? seat(a.slice(4)) : unseat(a.slice(3));
        if (!r.ok) { toast(r.why); }
        c.emit('changed'); if (c.persist) { c.persist(); }
      });
    }
  }
  if (global.DG && global.DG.core) { bind(); } else if (global.document) { global.document.addEventListener('DOMContentLoaded', bind); }

  global.DG = global.DG || {};
  global.DG.petWorkers = { MAX: MAX, JOBS: JOBS, on: on, book: book, jobOf: jobOf, owned: owned, seated: seated, seat: seat, unseat: unseat, settle: settle, due: due, collect: collect, html: html, bind: bind };
})(window);
