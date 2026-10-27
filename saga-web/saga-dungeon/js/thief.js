/**
 * 2나락 보물 도둑 (W-0483 · 디아블로 3 보물 고블린 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 한 층에 한 번까지, 싸움 방에 들어설 때 CHANCE 로 「보물 도둑」이 하나 선다. 치지 않고 달아나며(내게서 멀어지는 쪽, 벽이면 벽 따라)
 * LIFE 초가 지나면 사라진다. 쓰러뜨리면 금 (GOLD × 층) + 전리품 DROPS 개(정예 굴림 BIAS).
 * 몸은 그 층의 보통 적(spawnEnemy) — 맞고 깨고 죽는 건 dungeon.js 그대로, 여기선 달아남·사라짐·쏟음만.
 * 세이브 없음 — run.thief(그 층)·적 e.thief. dungeon update 의 shrine.step 줄 끝에서 step(run, dt), 바닥 그리기 줄 끝에서 draw2d.
 * 손잡이 dungeon.thief(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var CHANCE = 0.12, LIFE = 15, SPEED = 150, HP_MUL = 2.5, GOLD = 60, DROPS = 2, BIAS = 25;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dungeon.thief', 1)); }
  function D() { return global.DG.dungeon; }
  function toast(m) { var C = core(); if (C && C.emit) { C.emit('toast', m); } }
  var hooked = false;

  /** 달아날 한 걸음(순수) — 나에게서 먼 쪽, 벽에 막히면 벽을 따라 미끄러진다. 반환 {x, y} */
  function flee(ex, ey, px, py, dt, W, H, wall) {
    var dx = ex - px, dy = ey - py, dl = Math.sqrt(dx * dx + dy * dy) || 1, s = SPEED * dt;
    var nx = ex + dx / dl * s, ny = ey + dy / dl * s, lo = wall + 14, hx = W - wall - 14, hy = H - wall - 14;
    if (nx < lo || nx > hx) { nx = Math.min(hx, Math.max(lo, nx)); ny = ey + (dy >= 0 ? 1 : -1) * s; }
    if (ny < lo || ny > hy) { ny = Math.min(hy, Math.max(lo, ny)); nx = ex + (dx >= 0 ? 1 : -1) * s; }
    return { x: Math.min(hx, Math.max(lo, nx)), y: Math.min(hy, Math.max(lo, ny)) };
  }

  /** 이 방에 세울지(순수 — roll 은 0~1) */
  function shouldSpawn(run, roll) {
    if (!run || !run.room || run.horde || run.trial || run.town || run.room.kind !== 'fight' || run.room.cleared) { return false; }
    if (run.thief && run.thief.floor === run.floor) { return false; }
    return roll < CHANCE;
  }

  function spawn(run) {
    var DR = D(), SP = DR && (DR._spawnEnemy || DR.spawnEnemy); if (!SP) { return null; }
    var W = DR.ROOM_W || 700, H = DR.ROOM_H || 440;
    var e = SP(run.floor || 1, false, { x: W * 0.7, y: H * 0.5, spawned: true });
    e.hp = e.hpMax = Math.round(e.hp * HP_MUL); e.dmg = 0; e.thief = { t: LIFE, x: e.x, y: e.y }; e.elite = null;
    run.room.enemies.push(e);
    run.thief = { floor: run.floor, room: run.room };
    toast('💰 보물 도둑 — ' + LIFE + '초 안에 잡아라');
    return e;
  }

  function hook() {
    var C = core(); if (hooked || !C || !C.on) { return; } hooked = true;
    C.on('dungeon:kill', function (d) {
      var run = D() && D().raw ? D().raw() : null; if (!run || !d || !d.e || !d.e.thief) { return; }
      var e = d.e, g = GOLD * Math.max(1, run.floor || 1), DR = D();
      if (run.room && run.room.drops) { run.room.drops.push({ kind: 'gold', gold: g, x: e.x, y: e.y }); }
      for (var i = 0; i < DROPS; i++) { if (DR && DR._dropItem && run.room) { DR._dropItem(run.room, e.x + (i - 0.5) * 18, e.y + 8, BIAS); } }
      toast('💰 보물 도둑을 잡았다 — 금 ' + g + ' · 전리품 ' + DROPS);
    });
  }

  function step(run, dt) {
    if (!on() || !run || !run.room || !run.player) { return; }
    hook();
    var room = run.room;
    if (room !== (run.thief && run.thief.seen)) {
      if (!run.thief || run.thief.floor !== run.floor) { run.thief = { floor: -1 }; }
      run.thief.seen = room;
      if (shouldSpawn(run, Math.random())) { spawn(run); run.thief.seen = room; }
    }
    var DR = D(), W = (DR && DR.ROOM_W) || 700, H = (DR && DR.ROOM_H) || 440, wall = (DR && DR.WALL) || 20, p = run.player;
    for (var i = room.enemies.length - 1; i >= 0; i--) {
      var e = room.enemies[i]; if (!e.thief || e.hp <= 0) { continue; }
      e.cd = 99;   // 치지 않는다
      var n = flee(e.thief.x, e.thief.y, p.x, p.y, dt, W, H, wall);   // AI 가 옮긴 자리는 버리고 지난 자리에서 달아난다
      e.x = e.thief.x = n.x; e.y = e.thief.y = n.y;
      e.thief.t -= dt;
      if (e.thief.t <= 0) { room.enemies.splice(i, 1); toast('💨 보물 도둑이 달아났다'); }
    }
  }

  function draw2d(ctx, m, proj) {
    var run = D() && D().raw ? D().raw() : null; if (!on() || !run || !run.room) { return; }
    run.room.enemies.forEach(function (e) {
      if (!e.thief || e.hp <= 0) { return; }
      var p = proj(m, e.x, e.y), sc = Math.max(0.7, m.s);
      ctx.save(); ctx.font = 'bold ' + Math.round(12 * sc) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd75a'; ctx.strokeStyle = '#000b'; ctx.lineWidth = 3;
      var t = '💰 보물 도둑 ' + Math.ceil(e.thief.t) + '초'; ctx.strokeText(t, p.x, p.y - 70 * sc); ctx.fillText(t, p.x, p.y - 70 * sc);
      ctx.restore();
    });
  }

  global.DG = global.DG || {};
  global.DG.thief = { CHANCE: CHANCE, LIFE: LIFE, SPEED: SPEED, GOLD: GOLD, DROPS: DROPS, flee: flee, shouldSpawn: shouldSpawn, spawn: spawn, step: step, draw2d: draw2d };
})(window);
