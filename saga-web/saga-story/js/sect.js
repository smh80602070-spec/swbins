/**
 * 4종횡 — 문파(NPC 길드) (W-0398 ① 웹 역이식 — 정본 고돗 G-0333 · 메이플 길드 구조만)
 * ---------------------------------------------------------------
 * 소속이 없었다 → ⚔️ 검각(공격)·💰 상단(금)·📜 서원(경험) 중 하나에 든다(나가면 공 0). 처치마다 공 +1·보스 +10,
 * 오늘의 문파 의뢰 사냥터(날·문파마다 돌아감)면 두 배. 공 100·300·700·1500·3000 → 제자·사형·장로·부문주·문주,
 * 단계마다 그 갈래 +2%(문주 +10%). 단계가 오르면 알림.
 *   세이브 save.sect = { id, pts } — 순수 추가. 손잡이 sect.on(1).
 *   걸린 자리(side.js): 처치 금(run.gold += gold)·경험(core.gainExp)·한 타(strike dmg) 에 mul('gold'|'exp'|'atk') · 사냥터 시트 카드(cardHtml) · side:kill 알림.
 */
(function (global) {
  'use strict';

  var SECTS = [
    { id: 'sword', emoji: '⚔️', name: '검각', kind: 'atk', desc: '공격 +2%/단계' },
    { id: 'trade', emoji: '💰', name: '상단', kind: 'gold', desc: '금 +2%/단계' },
    { id: 'school', emoji: '📜', name: '서원', kind: 'exp', desc: '경험 +2%/단계' },
  ];
  var STEPS = [100, 300, 700, 1500, 3000], RANKS = ['문외', '제자', '사형', '장로', '부문주', '문주'];

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('sect.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function book() { var s = core().save; if (!s.sect) { s.sect = { id: null, pts: 0 }; } return s.sect; }
  function byId(id) { for (var i = 0; i < SECTS.length; i++) { if (SECTS[i].id === id) { return SECTS[i]; } } return null; }
  function current() { return byId(book().id); }
  function stageOf(pts) { var s = 0, i; for (i = 0; i < STEPS.length; i++) { if ((pts || 0) >= STEPS[i]) { s = i + 1; } } return s; }
  function nextOf(pts) { for (var i = 0; i < STEPS.length; i++) { if ((pts || 0) < STEPS[i]) { return STEPS[i]; } } return null; }
  function rankName(s) { return RANKS[s] || RANKS[0]; }
  /** 갈래 배율 — 그 문파의 갈래만, 단계 ×2%(문주 = 5단계 = +10%) */
  function mul(kind) {
    if (!on()) { return 1; }
    var c = current(); if (!c || c.kind !== kind) { return 1; }
    return 1 + stageOf(book().pts) * 0.02;
  }
  /** 오늘의 의뢰 사냥터 — 날·문파로 돌아가는 보스 사냥터 하나 */
  function questStage(day) {
    var SD = global.DG.sideData, c = current(); if (!SD || !c) { return null; }
    var list = SD.STAGES.filter(function (s) { return s.boss; }); if (!list.length) { return null; }
    var d = day === undefined ? Math.floor(Date.now() / 86400000) : day, idx = (d + SECTS.indexOf(c) * 7) % list.length;
    return list[idx];
  }
  function join(id) {
    var c = byId(id); if (!c) { return { ok: false, why: '없는 문파' }; }
    var b = book(); if (b.id === id) { return { ok: false, why: '이미 ' + c.name }; }
    b.id = id; b.pts = 0;
    if (core().log) { core().log(c.emoji + ' ' + c.name + '에 들었다 — ' + c.desc, 'info'); }
    return { ok: true };
  }
  function leave() { var b = book(), c = current(); if (!c) { return { ok: false, why: '든 문파가 없다' }; } b.id = null; b.pts = 0; if (core().log) { core().log(c.emoji + ' ' + c.name + '을 나왔다 — 공 0', 'warn'); } return { ok: true }; }
  /** 처치 하나 — 돌아온 값 = 오른 공 */
  function onKill(e) {
    if (!on()) { return 0; }
    var b = book(), c = current(); if (!c) { return 0; }
    var pts = e && e.boss ? 10 : 1, q = questStage();
    if (q && e && e.stage === q.key) { pts *= 2; }
    var s0 = stageOf(b.pts); b.pts += pts;
    var s1 = stageOf(b.pts);
    if (s1 > s0 && core().log) { core().log(c.emoji + ' ' + c.name + ' ' + rankName(s1) + '이 되었다 — ' + c.kind + ' +' + (s1 * 2) + '%', 'good'); }
    return pts;
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function cardHtml() {
    if (!on()) { return ''; }
    var b = book(), c = current(), s = stageOf(b.pts), nx = nextOf(b.pts), q = questStage();
    var h = '<div class="sec"><h4>🏯 문파 <span class="muted">' + (c ? c.emoji + ' ' + esc(c.name) + ' · ' + esc(rankName(s)) + ' · 공 ' + b.pts + (nx ? '/' + nx : ' · 문주') + ' · ' + c.kind + ' +' + (s * 2) + '%' : '소속 없음') + '</span></h4><div class="card">';
    if (c) {
      h += '<div class="stat-row"><span>오늘 의뢰 사냥터 <small class="muted">공 두 배</small></span><span>' + (q ? esc(q.name) : '—') + '</span></div>' +
        '<small class="muted">처치 +1 · 보스 +10 · 100·300·700·1500·3000 → 제자·사형·장로·부문주·문주</small>' +
        '<button class="btn tiny ghost" data-sect="leave">나가기(공 0)</button>';
    } else {
      SECTS.forEach(function (x) { h += '<div class="stat-row"><span>' + x.emoji + ' ' + esc(x.name) + ' <small class="muted">' + esc(x.desc) + '</small></span><button class="btn tiny primary" data-sect="join:' + x.id + '">들기</button></div>'; });
    }
    return h + '</div></div>';
  }
  function bind() {
    var c = core(); if (!c || !c.on) { return; }
    c.on('side:kill', function (e) { onKill(e); });
    if (global.document) {
      global.document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-sect]') : null;
        if (!b) { return; }
        var a = b.getAttribute('data-sect'), r = a === 'leave' ? leave() : join(a.slice(5));
        if (!r.ok && c.emit) { c.emit('toast', r.why); }
        c.emit('changed'); if (c.persist) { c.persist(); }
      });
    }
  }
  if (global.DG && global.DG.core) { bind(); } else if (global.document) { global.document.addEventListener('DOMContentLoaded', bind); }

  global.DG = global.DG || {};
  global.DG.sect = { SECTS: SECTS, STEPS: STEPS, RANKS: RANKS, on: on, book: book, current: current, stageOf: stageOf, nextOf: nextOf, rankName: rankName, mul: mul, questStage: questStage, join: join, leave: leave, onKill: onKill, cardHtml: cardHtml };
})(window);
