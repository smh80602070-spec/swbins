/**
 * 4종횡 — 숨은 우두머리 (W-0398 ② 웹 역이식 — 정본 고돗 G-0319 · 데드 셀 구조만)
 * ---------------------------------------------------------------
 * 사냥터 보스는 늘 같은 것 하나였다 → 보스가 서는 사냥터의 오른쪽 끝자락에 "옛 비문"(닿으면 읽힘, 사냥터마다 기록).
 * 비문을 읽은 땅에서 그 보스를 첫 타부터 LIMIT(60)초 안에 쓰러뜨리면 DELAY(2)초 뒤 같은 사냥터에 숨은 우두머리(체력 ×2.5·피해 ×1.5·짙은 보라)가 서고,
 * 잡으면 금 +40 × 사냥터 lv(run.gold — 나올 때 정산) · 처치 기록.
 *   세이브 save.hidden = { steles: { 사냥터: 1 }, kills: { 사냥터: n } } — 순수 추가. 손잡이 hidden.on(1).
 *   걸린 자리(side.js): spawnBoss(opts)·_run 노출 · 보스 처치 자리 onBossKill(e, run) · 250ms 살피기(비문 닿음·첫 타 시각) · 사냥터 시트 카드.
 *   비문 그림은 안 그린다(사냥터 끝 STELE_X 안에 들면 읽힘 + 알림) — 10-19 3D/그림은 배선만.
 */
(function (global) {
  'use strict';

  var LIMIT = 60, DELAY = 2, HP_MUL = 2.5, DMG_MUL = 1.5, GOLD_PER_LV = 40, STELE_W = 90, COLOR = '#4a1f6e';

  function core() { return global.DG.core; }
  function S() { return global.DG.side; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('hidden.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function book() { var s = core().save; if (!s.hidden) { s.hidden = { steles: {}, kills: {} }; } return s.hidden; }
  function toast(msg) { if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast(msg); } else if (core().log) { core().log(msg, 'info'); } }
  function read(stage) { var b = book(); if (b.steles[stage]) { return false; } b.steles[stage] = 1; toast('📜 옛 비문을 읽었다 — 이 땅의 우두머리를 첫 타부터 ' + LIMIT + '초 안에 쓰러뜨리면…'); if (core().persist) { core().persist(); } return true; }
  function hasStele(stage) { return !!book().steles[stage]; }
  function killsOf(stage) { return book().kills[stage] || 0; }
  function rewardFor(lv) { return GOLD_PER_LV * Math.max(1, lv || 1); }
  /** 순수 판정 — 비문 읽은 땅 · 첫 타 시각 있음 · LIMIT 안 · 숨은 것이 아님 */
  function shouldSpawn(e, stage, now) { return !!(on() && e && !e.hidden && e.boss && hasStele(stage) && e._t0 && (now - e._t0) <= LIMIT * 1000); }

  var timer = null, pending = null;
  /** 250ms — 비문 닿음·보스 첫 타 */
  function watch() {
    var s = S(); if (!s || !s.active || !s.active() || !s._run) { return; }
    var run = s._run(); if (!run || !run.stage) { return; }
    var stg = run.stage, key = stg.key;
    if (stg.boss && run.player && run.player.x >= stg.width - STELE_W && !hasStele(key)) { read(key); }
    var b = run.boss; if (b && !b._t0 && b.hp < b.hpMax) { b._t0 = Date.now(); }
  }
  /** side.js 보스 처치 자리에서 — 숨은 우두머리면 상·기록, 아니면 조건 맞을 때 2초 뒤 세운다 */
  function onBossKill(e, run) {
    if (!on() || !e || !run || !run.stage) { return false; }
    var key = run.stage.key, s = S();
    if (e.hidden) {
      var g = rewardFor(run.stage.enemyLv); run.gold += g; book().kills[key] = killsOf(key) + 1;
      toast('👑 숨은 우두머리를 쓰러뜨렸다 — 금 +' + g + ' · ' + killsOf(key) + '번째'); if (core().persist) { core().persist(); }
      return true;
    }
    if (!shouldSpawn(e, key, Date.now())) { return false; }
    toast('…땅이 울린다. ' + DELAY + '초 뒤 숨은 우두머리가 선다');
    if (pending) { clearTimeout(pending); }
    pending = setTimeout(function () { pending = null; if (s.active && s.active() && s._run && s._run() && s._run().stage.key === key && s.spawnBoss) { s.spawnBoss({ hpMul: HP_MUL, dmgMul: DMG_MUL, color: COLOR, hidden: true }); } }, DELAY * 1000);
    return true;
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function cardHtml() {
    if (!on()) { return ''; }
    var SD = global.DG.sideData, b = book(); if (!SD) { return ''; }
    var rows = SD.STAGES.filter(function (x) { return x.boss; }).map(function (x) { return '<div class="stat-row"><span>' + esc(x.name) + ' <small class="muted">' + (b.steles[x.key] ? '비문 읽음' : '비문 — 오른쪽 끝') + '</small></span><span>' + (b.kills[x.key] ? '👑 ' + b.kills[x.key] : '—') + '</span></div>'; }).join('');
    return '<div class="sec"><h4>👑 숨은 우두머리 <span class="muted">비문 읽은 땅에서 보스를 첫 타부터 ' + LIMIT + '초 안에 → 체력 ×' + HP_MUL + '·피해 ×' + DMG_MUL + ' · 금 +' + GOLD_PER_LV + '×lv</span></h4><div class="card">' + rows + '</div></div>';
  }
  function bind() { if (timer || !global.setInterval) { return; } timer = setInterval(function () { try { watch(); } catch (e) { /* 살피기는 조용히 */ } }, 250); }
  if (global.document && !global.DG_NO_DRAW) { bind(); }

  global.DG = global.DG || {};
  global.DG.hiddenBoss = { LIMIT: LIMIT, DELAY: DELAY, HP_MUL: HP_MUL, DMG_MUL: DMG_MUL, GOLD_PER_LV: GOLD_PER_LV, STELE_W: STELE_W, on: on, book: book, read: read, hasStele: hasStele, killsOf: killsOf, rewardFor: rewardFor, shouldSpawn: shouldSpawn, watch: watch, onBossKill: onBossKill, cardHtml: cardHtml };
})(window);
