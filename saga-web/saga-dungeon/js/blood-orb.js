/**
 * 2나락 피 구슬 (W-0421 ① · 정본 고돗 G-0344 · 디아블로 3 체력 구슬 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 회복이 단약 벨트뿐이라 싸움 한가운데서 물러나 마시게 된다 → 적이 쓰러질 때 그 자리에 붉게 빛나는 구슬:
 *   떨굼   잡졸 CHANCE(22%) · 정예 1 · 우두머리 BOSS_N(3)
 *   끌림   PULL 안에 들면 나에게 끌려와(SPEED) 닿으면(TOUCH) 최대 체력 HEAL_PCT(12%) 회복·「+n」
 *   남음   체력이 가득이면 안 끌리고 남는다(뒤에 쓰라고) · LIFE(25초) 뒤 흐려져 사라짐
 * 단위는 방 논리 좌표(700×440 — 1m ≈ 20). 구슬은 그 방(run.room.bloodOrbs)에만 — 방을 나가면 사라진다. 세이브 없음.
 * dungeon:kill 사건을 듣고, dungeon update 첫 줄 끝에서 step(run, dt), 2D 바닥 그리기 줄 끝에서 draw2d. 손잡이 dungeon.bloodOrb(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var CHANCE = 0.22, BOSS_N = 3, PULL = 60, SPEED = 180, TOUCH = 14, HEAL_PCT = 12, LIFE = 25;
  var hooked = false, rng = null;
  /** 결정적 굴림(진단의 씨앗 수열을 안 건드린다) — 그 판 처치 수·자리 해시 */
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('dungeon.bloodOrb', 1)); }
  function D() { return global.DG.dungeon; }
  function orbsOf(room) { if (!room.bloodOrbs) { room.bloodOrbs = []; } return room.bloodOrbs; }

  /** 쓰러진 적 하나 — 떨굴 수(순수에 가깝게: rng 만) */
  function countFor(e, k) { if (!e) { return 0; } if (e.boss) { return BOSS_N; } if (e.elite) { return 1; } var r = rng ? rng() : h01('orb:' + (k || 0) + ':' + Math.round(e.x) + ':' + Math.round(e.y)); return r < CHANCE ? 1 : 0; }
  function onKill(d) {
    if (!on() || !d || !d.e || !D() || !D().raw) { return 0; }
    var run = D().raw(); if (!run || !run.room) { return 0; }
    var n = countFor(d.e, run.kills), L = orbsOf(run.room);
    for (var i = 0; i < n; i++) { L.push({ x: d.e.x + (n > 1 ? (i - 1) * 16 : 0), y: d.e.y + (n > 1 ? (i % 2) * 10 : 0), t: LIFE }); }
    return n;
  }
  function hook() { var C = core(); if (hooked || !C || !C.on) { return; } hooked = true; C.on('dungeon:kill', onKill); }
  hook();

  function step(run, dt) {
    hook();
    if (!on() || !run || !run.room || !run.room.bloodOrbs || !run.room.bloodOrbs.length || !run.player) { return; }
    var L = run.room.bloodOrbs, p = run.player, full = run.hp >= run.hpMax;
    for (var i = L.length - 1; i >= 0; i--) {
      var o = L[i]; o.t -= dt;
      if (o.t <= 0) { L.splice(i, 1); continue; }
      var dx = p.x - o.x, dy = p.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (full || d > PULL) { continue; }
      if (d <= TOUCH) {
        var n = Math.round(run.hpMax * HEAL_PCT / 100); run.hp = Math.min(run.hpMax, run.hp + n);
        var fx = D() && D().fx ? D().fx() : null; if (fx) { fx.push({ t: 'get', x: p.x, y: p.y, text: '+' + n, color: '#ff5a4a', life: 0.9 }); }
        L.splice(i, 1); full = run.hp >= run.hpMax;
        continue;
      }
      var mv = Math.min(d, SPEED * dt); o.x += dx / d * mv; o.y += dy / d * mv;
    }
  }

  function draw2d(ctx, m, proj, isoEllipse, now) {
    var run = D() && D().raw ? D().raw() : null; if (!on() || !run || !run.room || !run.room.bloodOrbs) { return; }
    run.room.bloodOrbs.forEach(function (o, i) {
      var p = proj(m, o.x, o.y), s = Math.max(0.7, m.s), a = o.t < 3 ? o.t / 3 : 1, bob = Math.sin((now + i * 250) / 260) * 2;
      ctx.save(); ctx.globalAlpha = a;
      ctx.beginPath(); isoEllipse(ctx, m, o.x, o.y, 5); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y - 7 + bob, 9 * s, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,60,50,0.28)'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y - 7 + bob, 5 * s, 0, Math.PI * 2); ctx.fillStyle = '#d8252a'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - 1.5 * s, p.y - 9 + bob, 1.8 * s, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,220,210,0.85)'; ctx.fill();
      ctx.restore();
    });
  }

  global.DG = global.DG || {};
  global.DG.bloodOrb = { CHANCE: CHANCE, BOSS_N: BOSS_N, PULL: PULL, HEAL_PCT: HEAL_PCT, LIFE: LIFE, countFor: countFor, onKill: onKill, step: step, draw2d: draw2d,
    _rng: function (f) { rng = f || null; } };
})(window);
