/**
 * 4종횡 사냥터 몰이 파도 (W-0437 ③ · 디아블로·PoE 군단/몰이 사냥 — 구조만, 수치는 우리 것)
 * ---------------------------------------------------------------
 * 같은 사냥터 잡몹 처치 EVERY(150, 손잡이 st.huntWave.every)마다 「몰이」가 시작된다:
 *   파도   WAVES(5) — 파도마다 그 터 몹 BASE+STEP×i 마리가 주인공 양옆에서 몰려온다. 그 파도를 다 잡으면 다음 파도
 *   대장   마지막 파도엔 대장 하나(몸 ×1.4·체력 ×8·피해 ×1.6, 이름 「몰이 대장」)
 *   끝     다 잡으면 전리품 둘(장비 표 보스 몫)·띠 「몰이 끝」 · LIMIT(120)초 안 못 끝내면 남은 몰이 몹은 흩어짐(사라짐)
 *   셈     이번 접속만(모듈 메모리) · 비경·관문 대장·마을 무대는 안 셈 · 엘리트(field-elite)와 따로
 * side.js 처치 onKill(run, fx, e)(fieldElite 곁) · update 맨 앞 tick(run, dt). 손잡이 st.huntWave(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var EVERY = 150, WAVES = 5, BASE = 4, STEP = 2, LIMIT = 120, LOOT = 2;
  var BOSS_SZ = 1.4, BOSS_HP = 8, BOSS_DMG = 1.6;
  var counts = {};   // 사냥터 key → 처치 수

  function core() { return global.DG.core; }
  function K(k, d) { var c = core(); return c && c.tuned ? +c.tuned('st.huntWave' + (k ? '.' + k : ''), d) : d; }
  function on() { return !!K('', 1); }
  function every() { return Math.max(1, K('every', EVERY)); }
  function allowed(run) { var s = run && run.stage; return !!(s && !s.town && !s.rift && !s.gateArena && !run.rift); }
  function banner(run, fx, head, text) {
    if (fx) { fx.push({ t: 'bossintro', head: head, name: text, x: run.player ? run.player.x : 0, y: 0, life: 1.8 }); }
    var C = core(); if (C && C.emit) { C.emit('toast', head + ' — ' + text); }
  }
  /** 파도 i(0 부터) 띄우기 — 양옆 번갈아 */
  function spawnWave(run, fx) {
    var S = global.DG.side, hw = run.hw, p = run.player, w = (run.stage && run.stage.width) || 2000, n = BASE + STEP * hw.i, last = hw.i === WAVES - 1, k, e;
    for (k = 0; k < n; k++) {
      var side = k % 2 ? 1 : -1, x = Math.max(40, Math.min(w - 60, (p ? p.x : 400) + side * (300 + (k >> 1) * 40)));
      e = S && S.spawnEnemy ? S.spawnEnemy(x) : null; if (e) { e.wave = hw.id; e.rare = false; e.mini = false; }
    }
    if (last && S && S.spawnEnemy) {
      e = S.spawnEnemy(Math.max(40, Math.min(w - 60, (p ? p.x : 400) + 360)), { hp: BOSS_HP, dmg: BOSS_DMG });
      if (e) { var sz = Math.round(34 * BOSS_SZ); e.y -= (sz - e.h); e.w = sz; e.h = sz; e.sz = BOSS_SZ; e.mini = false; e.rare = false; e.wave = hw.id; e.waveBoss = true; e.ref = Object.assign({}, e.ref, { name: '몰이 대장 ' + e.ref.name }); }
    }
    banner(run, fx, '📯 몰이 ' + (hw.i + 1) + '/' + WAVES, last ? '대장이 나왔다' : n + '마리가 몰려온다');
  }
  function alive(run) { var id = run.hw && run.hw.id; return (run.enemies || []).filter(function (e) { return e.wave === id && e.hp > 0; }).length; }
  function start(run, fx) { run.hw = { id: (run.hw && run.hw.id || 0) + 1, i: 0, t: LIMIT, active: true }; spawnWave(run, fx); return run.hw; }
  function loot(run) {
    var G = global.DG.gear, lv = (run.stage && run.stage.enemyLv) || 1, p = run.player || { x: 400, y: 300 }, i, got;
    for (i = 0; i < LOOT && G && G.rollDrop; i++) { got = G.rollDrop(lv, true); if (got) { run.drops.push({ kind: got.kind, key: got.key, uniq: !!got.uniq, x: p.x + 20 + i * 22, y: p.y, vy: -260, n: 1 }); } }
  }

  /** 처치 하나 — 몰이를 시작했으면 run.hw */
  function onKill(run, fx, e) {
    if (!on() || !run || !e || e.boss || !allowed(run)) { return null; }
    if (run.hw && run.hw.active) { return null; }   // 몰이 중엔 셈 안 함(다음 파도는 tick 이 띄움)
    if (e.wave || e.elite || e.eliteBoss) { return null; }
    var key = run.stage.key; counts[key] = (counts[key] || 0) + 1;
    return counts[key] % every() === 0 ? start(run, fx) : null;
  }
  /** 매 틱 — 파도를 다 잡으면 다음, 끝나면 전리품 · 시간 다하면 흩어짐 */
  function tick(run, dt, fx) {
    var hw = run && run.hw; if (!hw || !hw.active) { return; }
    hw.t -= dt;
    if (hw.t <= 0) {
      run.enemies = run.enemies.filter(function (e) { return e.wave !== hw.id; }); hw.active = false;
      var C = core(); if (C && C.emit) { C.emit('toast', '💨 몰이가 흩어졌다'); } return;
    }
    if (alive(run) > 0) { return; }
    hw.i++;
    if (hw.i >= WAVES) { hw.active = false; loot(run); banner(run, fx || (global.DG.side && global.DG.side.fx ? global.DG.side.fx() : null), '🏁 몰이 끝', '전리품 ' + LOOT); return; }
    spawnWave(run, fx || (global.DG.side && global.DG.side.fx ? global.DG.side.fx() : null));
  }
  function state(key) { return key ? (counts[key] || 0) : counts; }

  global.DG = global.DG || {};
  global.DG.huntWave = { EVERY: EVERY, WAVES: WAVES, BASE: BASE, STEP: STEP, LIMIT: LIMIT, every: every, onKill: onKill, tick: tick, start: start, alive: alive, state: state,
    _reset: function () { counts = {}; } };
})(window);
