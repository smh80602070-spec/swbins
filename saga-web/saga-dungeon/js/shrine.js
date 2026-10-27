/**
 * 2나락 성소 (W-0477 · 정본 고돗 G-0406 · 디아블로 2 shrine — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 한 판(층)에 하나, 셋째~다섯째(층 해시) 방부터 첫 싸움 방에 빛기둥. 다가가면(R) 저절로 30초 센 몸 — 한 번만.
 *   분노 atkPct +40 · 방벽 guardPct +30 · 질풍 atkSpdPct +35 · 재물 goldPct +100 (전부 boonVal 이 run.buffs 에서 읽는 키)
 * 종류는 (층 + 지금까지 만난 성소 수) 차례로 넷이 돌아 두 성소가 다르다. 세이브 없음 — run.shrine(그 층)·run.room.shrine(자리).
 * dungeon update 의 cursedChest.step 줄 끝에서 step(run, dt), 바닥 그리기 줄 끝에서 draw2d. 손잡이 dungeon.shrine(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var R = 34, SEC = 30;
  var KINDS = [
    { key: 'rage',    name: '분노의 성소', emoji: '🔥', eff: 'atkPct',    v: 40,  col: '255,110,60' },
    { key: 'ward',    name: '방벽의 성소', emoji: '🛡️', eff: 'guardPct',  v: 30,  col: '90,170,255' },
    { key: 'gale',    name: '질풍의 성소', emoji: '🌪️', eff: 'atkSpdPct', v: 35,  col: '120,230,170' },
    { key: 'fortune', name: '재물의 성소', emoji: '💰', eff: 'goldPct',   v: 100, col: '255,215,80' }
  ];

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dungeon.shrine', 1)); }
  function D() { return global.DG.dungeon; }
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function toast(m) { var C = core(); if (C && C.emit) { C.emit('toast', m); } }
  /** 그 층 성소가 설 방 번호(0 부터) — 셋째(2)~다섯째(4), 방이 모자라면 -1(순수) */
  function roomFor(floor, total) { var want = 2 + Math.floor(h01('shrine:' + floor) * 3); if (want > total - 2) { want = total - 2; } return want >= 1 ? want : -1; }
  /** 종류(순수) — 층 + 만난 수 차례 */
  function kindFor(floor, n) { return KINDS[(((floor || 0) + (n || 0)) % KINDS.length + KINDS.length) % KINDS.length]; }
  /** 센 쪽이 남는 규칙(dungeon.js addBuff 와 같다) */
  function apply(run, k) {
    if (!run.buffs) { run.buffs = {}; }
    var cur = run.buffs[k.eff];
    if (!cur || cur.v <= k.v) { run.buffs[k.eff] = { v: k.v, t: SEC }; } else { cur.t = Math.max(cur.t, SEC); }
  }

  function step(run, dt) {
    if (!on() || !run || !run.room || !run.player || run.horde || run.trial || run.town) { return; }
    if (!run.shrine || run.shrine.floor !== run.floor) { run.shrine = { floor: run.floor, idx: roomFor(run.floor, run.roomTotal || 0), done: false, n: run.shrine ? run.shrine.n : 0 }; }
    var ss = run.shrine, room = run.room;
    if (!ss.done && !ss.placed && ss.idx >= 0 && !room.shrine && run.roomIdx >= ss.idx && room.kind === 'fight') {
      ss.placed = true;
      var W = (D() && D().ROOM_W) || 700, H = (D() && D().ROOM_H) || 440;
      room.shrine = { x: W * 0.3, y: H * 0.35, kind: kindFor(run.floor, ss.n).key, used: false };
    }
    var s = room.shrine; if (!s || s.used) { return; }
    var p = run.player;
    if (Math.hypot(p.x - s.x, p.y - s.y) <= R) {
      var k = KINDS.filter(function (x) { return x.key === s.kind; })[0];
      s.used = true; ss.done = true; ss.n += 1; apply(run, k);
      toast(k.emoji + ' ' + k.name + ' — ' + SEC + '초');
    }
  }

  function draw2d(ctx, m, proj, isoEllipse, now) {
    var run = D() && D().raw ? D().raw() : null, s = run && run.room && run.room.shrine; if (!on() || !s || s.used) { return; }
    var k = KINDS.filter(function (x) { return x.key === s.kind; })[0], p = proj(m, s.x, s.y), sc = Math.max(0.7, m.s), pulse = 0.55 + 0.25 * Math.sin(now / 220);
    ctx.save();
    ctx.beginPath(); isoEllipse(ctx, m, s.x, s.y, 22); ctx.fillStyle = 'rgba(' + k.col + ',' + (0.25 * pulse) + ')'; ctx.fill();
    var g = ctx.createLinearGradient(0, p.y - 90 * sc, 0, p.y);
    g.addColorStop(0, 'rgba(' + k.col + ',0)'); g.addColorStop(1, 'rgba(' + k.col + ',' + pulse + ')');
    ctx.fillStyle = g; ctx.fillRect(p.x - 9 * sc, p.y - 90 * sc, 18 * sc, 90 * sc);
    ctx.font = 'bold ' + Math.round(13 * sc) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000a'; ctx.lineWidth = 3;
    var t = k.emoji + ' ' + k.name; ctx.strokeText(t, p.x, p.y - 96 * sc); ctx.fillText(t, p.x, p.y - 96 * sc);
    ctx.restore();
  }

  global.DG = global.DG || {};
  global.DG.shrine = { R: R, SEC: SEC, KINDS: KINDS, roomFor: roomFor, kindFor: kindFor, step: step, draw2d: draw2d };
})(window);
