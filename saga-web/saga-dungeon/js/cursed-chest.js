/**
 * 2나락 저주받은 상자 (W-0421 ② · 정본 고돗 G-0380 · 디아블로 3 저주받은 상자 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 한 판(층)에 하나, 셋째·여섯째(층 해시) 방부터 첫 싸움 방에 보랏빛 상자:
 *   열림   다가가면(OPEN_R) 열려 DUR(24초) 동안 EVERY(6초)마다 WAVE(둘)씩 적이 고리 가장자리에서 몰려온다
 *   버팀   보랏빛 고리(RING — 1m ≈ 20 이라 9m ≈ 180 → 방 크기에 맞춰 140) 안에서 끝까지 버티면 전리품 셋(정예 굴림 bias 25)+금 60×층
 *   실패   고리 밖으로 나가거나 쓰러지면 상자가 닫히고 아무것도 없음(나온 적은 그대로)
 * 상태는 run.cursed(그 층의 방 번호·끝났나)와 run.room.cursedChest(자리·상태) — 세이브 없음.
 * dungeon update 첫 줄 끝에서 step(run, dt), 2D 바닥 그리기 줄 끝에서 draw2d. 적은 DG.dungeon._spawnEnemy, 전리품은 _dropItem.
 * 손잡이 dungeon.cursedChest(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var OPEN_R = 34, RING = 140, DUR = 24, EVERY = 6, WAVE = 2, LOOT_N = 3, LOOT_BIAS = 25, GOLD_PER_FLOOR = 60;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dungeon.cursedChest', 1)); }
  function D() { return global.DG.dungeon; }
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  /** 그 층 상자가 설 방 번호(0 부터) — 셋째(2) 또는 여섯째(5), 방이 모자라면 셋째(순수) */
  function roomFor(floor, total) { var want = h01('cursed:' + floor) < 0.5 ? 2 : 5; if (want > total - 2) { want = 2; } return want <= total - 2 ? want : -1; }
  function toast(m) { var C = core(); if (C && C.emit) { C.emit('toast', m); } }

  function place(run) {
    var W = (D() && D().ROOM_W) || 700, H = (D() && D().ROOM_H) || 440;
    run.room.cursedChest = { x: W * 0.55, y: H * 0.5, st: 'idle', t: 0, next: 0 };
  }
  function finish(run, c, ok) {
    c.st = ok ? 'won' : 'lost'; run.cursed.done = true;
    if (ok) {
      var DR = D(), room = run.room;
      for (var i = 0; i < LOOT_N; i++) { if (DR._dropItem) { DR._dropItem(room, c.x, c.y, LOOT_BIAS); } }
      var g = GOLD_PER_FLOOR * Math.max(1, run.floor || 1);
      room.drops.push({ kind: 'gold', gold: g, x: c.x + 20, y: c.y });
      toast('🟪 저주를 버텨 냈다 — 전리품 ' + LOOT_N + ' · 금 ' + g);
    } else { toast('🟪 상자가 닫혔다 — 저주를 못 버텼다'); }
    if (core() && core().emit) { core().emit('changed'); }
  }

  function step(run, dt) {
    if (!on() || !run || !run.room || !run.player || run.horde || run.trial || run.town) { return; }
    if (!run.cursed || run.cursed.floor !== run.floor) { run.cursed = { floor: run.floor, idx: roomFor(run.floor, run.roomTotal || 0), done: false }; }
    var cs = run.cursed, room = run.room;
    if (!cs.done && !cs.placed && cs.idx >= 0 && !room.cursedChest && run.roomIdx >= cs.idx && room.kind === 'fight') { cs.placed = true; place(run); }   // 그 번째 이후 첫 싸움 방(문을 골라 싸움 방이 아닐 수 있다)
    var c = room.cursedChest; if (!c || c.st === 'won' || c.st === 'lost') { return; }
    var p = run.player, d = Math.hypot(p.x - c.x, p.y - c.y);
    if (c.st === 'idle') {
      if (d <= OPEN_R) { c.st = 'open'; c.t = DUR; c.next = 0; toast('🟪 저주받은 상자 — ' + DUR + '초 동안 고리 안에서 버텨라'); }
      return;
    }
    if (run.hp <= 0 || d > RING) { finish(run, c, false); return; }
    c.t -= dt; c.next -= dt;
    if (c.next <= 0 && c.t > 0.5) {
      c.next = EVERY;
      var SP = D() && D()._spawnEnemy;
      for (var i = 0; i < WAVE && SP; i++) {
        var a = h01('cc:' + run.floor + ':' + c.t.toFixed(1) + ':' + i) * Math.PI * 2;
        room.enemies.push(SP(run.floor, false, { spawned: true, x: c.x + Math.cos(a) * RING * 0.9, y: c.y + Math.sin(a) * RING * 0.6 }));
      }
      room.cleared = false;
    }
    if (c.t <= 0) { finish(run, c, true); }
  }

  function draw2d(ctx, m, proj, isoEllipse, now) {
    var run = D() && D().raw ? D().raw() : null, c = run && run.room && run.room.cursedChest; if (!on() || !c || c.st === 'won' || c.st === 'lost') { return; }
    var p = proj(m, c.x, c.y), s = Math.max(0.7, m.s);
    ctx.save();
    if (c.st === 'open') {
      ctx.beginPath(); isoEllipse(ctx, m, c.x, c.y, RING); ctx.strokeStyle = 'rgba(176,92,255,' + (0.55 + 0.25 * Math.sin(now / 200)) + ')'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(140,60,220,0.08)'; ctx.fill();
    }
    ctx.beginPath(); isoEllipse(ctx, m, c.x, c.y, 16); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    var w = 26 * s, h = 18 * s, x = p.x - w / 2, y = p.y - h - 4 * s;
    var M = global.DG.mode2d, SH = 40 * s;   // K-0195 그림 — 못 받았으면 코드 도형
    if (M && M.drawSprite && M.drawSprite(ctx, { id: 'chest_cursed_01', x: p.x, y: p.y + 2 * s, h: SH })) { y = p.y - SH + 2 * s; } else {
      ctx.fillStyle = '#3d2052'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#6a3a8e'; ctx.fillRect(x, y, w, h * 0.38);
      ctx.strokeStyle = '#c9a0ff'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = c.st === 'open' ? '#ffe27a' : '#c9a0ff'; ctx.fillRect(p.x - 2.5 * s, y + h * 0.3, 5 * s, 6 * s);
    }
    if (c.st === 'open') { ctx.font = 'bold ' + Math.round(13 * s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8d2ff'; ctx.strokeStyle = '#000a'; ctx.lineWidth = 3; var tx = Math.ceil(c.t) + '초'; ctx.strokeText(tx, p.x, y - 6 * s); ctx.fillText(tx, p.x, y - 6 * s); }
    ctx.restore();
  }

  global.DG = global.DG || {};
  global.DG.cursedChest = { OPEN_R: OPEN_R, RING: RING, DUR: DUR, EVERY: EVERY, WAVE: WAVE, LOOT_N: LOOT_N, roomFor: roomFor, step: step, draw2d: draw2d };
})(window);
