/**
 * 1만리 들판 무리 습격 (W-0438 ③ · 디아블로·PoE 군단/몰이 사냥 — 구조만, 수치는 우리 것)
 * ---------------------------------------------------------------
 * 들판 처치(field:kill) EVERY(60, 손잡이 go.raid.every)마다 「무리 습격」 — 주인공 둘레에 무리가 둥글게 선다:
 *   파도   WAVES(3) — 파도마다 BASE+STEP×i 마리(그 자리 무리 꼴 FC.THEMES · 등급 FC.tierAt), 처음부터 쫓아옴. 다 잡으면 다음
 *   끝     셋 다 잡으면 금 killGold(등급)×REWARD 와 띠 「습격을 막았다」 · LIMIT(150)초 넘으면 남은 습격 무리는 흩어짐(사라짐)
 *   셈     이번 접속만(모듈 메모리) · 습격 무리(캠프 키 rd:) 처치는 안 셈
 * 캠프는 field-combat spawnCamp 를 그대로 — 처치 금·경험·업적도 보통 무리와 같다(캠프 정리 기록은 보통 무리처럼 RESPAWN 뒤 지워짐).
 * field-combat tick 의 step 줄 끝에서 tick(S, dt, px, py). 손잡이 go.raid(1, 0 = 끔 · 자가진단 기본 0).
 */
(function (global) {
  'use strict';

  var EVERY = 60, WAVES = 3, BASE = 4, STEP = 2, LIMIT = 150, REWARD = 12, RING = 7;
  var kills = 0, pending = false, raid = null, seq = 0;

  function core() { return global.DG.core; }
  function K(k, d) { var c = core(); return c && c.tuned ? +c.tuned('go.raid' + (k ? '.' + k : ''), d) : d; }
  function on() { return !!K('', global.DG_NO_DRAW ? 0 : 1); }   // 자가진단(DG_NO_DRAW)에선 기본 끔 — 앞 진단들의 처치가 쌓여 습격이 끼어들지 않게(제 진단만 켬)
  function every() { return Math.max(1, K('every', EVERY)); }
  function toast(m) { var U = global.DG.ui; if (U && U.toast && !global.DG_NO_DRAW) { U.toast(m); } }

  function campKey(i) { return 'rd:' + raid.id + ':' + i; }
  function spawnWave(S, px, py) {
    var FC = global.DG.fieldCombat, i = raid.i, n = BASE + STEP * i, th = FC.THEMES || [['boar']], list = th[(raid.id + i) % th.length], foes = [], k;
    for (k = 0; k < n; k++) { var a = k / n * Math.PI * 2; foes.push({ kind: list[k % list.length], dx: Math.cos(a) * RING, dy: Math.sin(a) * RING }); }
    var tier = FC.tierAt ? FC.tierAt(px, py) : 1;
    FC.spawnCamp(S, { key: campKey(i), x: px, y: py, tier: tier, kind: 'raid', foes: foes });
    (S.camps[campKey(i)].uids || []).forEach(function (u) { if (S.foes[u]) { S.foes[u].st = 'chase'; } });
    raid.tier = tier;
    toast('📯 무리 습격 ' + (i + 1) + '/' + WAVES + ' — ' + n + '마리');
  }
  function aliveIn(S, key) { var c = S.camps[key]; return c ? c.uids.filter(function (u) { var f = S.foes[u]; return f && !f.dead; }).length : 0; }
  function scatter(S) {
    for (var i = 0; i <= raid.i && i < WAVES; i++) { var key = campKey(i), c = S.camps[key]; if (c) { c.uids.forEach(function (u) { delete S.foes[u]; }); delete S.camps[key]; } }
  }

  /** 매 틱 — 시작·다음 파도·끝·흩어짐. raid 상태 또는 null */
  function tick(S, dt, px, py) {
    var FC = global.DG.fieldCombat; if (!on() || !S || !FC || !FC.spawnCamp) { return null; }
    if (!raid && pending) { pending = false; raid = { id: ++seq, i: 0, t: LIMIT }; spawnWave(S, px, py); return raid; }
    if (!raid) { return null; }
    raid.t -= dt;
    if (raid.t <= 0) { scatter(S); raid = null; toast('💨 습격 무리가 흩어졌다'); return null; }
    if (aliveIn(S, campKey(raid.i)) > 0) { return raid; }
    raid.i++;
    if (raid.i >= WAVES) {
      var gold = (FC.killGold ? FC.killGold(raid.tier || 1) : 50) * REWARD, C = core();
      if (C && C.save && C.save.player) { C.save.player.gold = (C.save.player.gold || 0) + gold; }
      toast('🏁 습격을 막았다 — 금 +' + gold); if (C && C.emit) { C.emit('field:raid', { gold: gold }); }
      raid = null; return null;
    }
    spawnWave(S, px, py); return raid;
  }
  function onKill(e) {
    if (!on() || !e || String(e.camp || '').indexOf('rd:') === 0 || raid) { return; }
    kills++; if (kills % every() === 0) { pending = true; }
  }
  function init() { var C = core(); if (C && C.on) { C.on('field:kill', onKill); } }
  if (global.DG && global.DG.core) { init(); }

  global.DG = global.DG || {};
  global.DG.fieldRaid = { EVERY: EVERY, WAVES: WAVES, BASE: BASE, STEP: STEP, LIMIT: LIMIT, every: every, tick: tick, onKill: onKill, aliveIn: aliveIn,
    state: function () { return { kills: kills, pending: pending, raid: raid }; }, _reset: function () { kills = 0; pending = false; raid = null; } };
})(window);
