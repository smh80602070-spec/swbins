/**
 * 4종횡 줍는 펫 (W-0478 · 정본 고돗 G-0407 · 메이플 펫 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 작은 신수(🦊)가 주인공을 따라다니다 둘레(R)에 떨어진 금·탕약을 주워 온다 — 줍는 걸음을 덜어 손맛은 싸움에.
 *   줍기   0.25초마다 반경 R 안 가장 가까운 gold·potion 으로 달려가 닿으면 그 drop 을 주인공 자리로 옮긴다 →
 *          다음 프레임 side.js 줍기 분기가 토스트·소리·탕약 수를 처리(기존 길 그대로). 장비·두루마리·콤보 구슬은 안 줍는다.
 *   웹 차이 금은 처치 때 이미 run.gold 에 셈이라 주워도 셈은 그대로(코인 정리) — 효과는 탕약.
 * 판 안 상태 run.pet = {x, y} (세이브 없음). update 의 comboKill.tick 줄 끝에서 step(run, dt), 떨어진 것 그리기 뒤 draw.
 * 손잡이 story.petFetch(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var R = 220, FOLLOW = 260, RUN = 300, BEHIND = 36, TOUCH = 14, SCAN = 0.25, KINDS = { gold: 1, potion: 1 }, P_W = 26, P_H = 54;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('story.petFetch', 1)); }
  /** 줍을 것(순수) — 반경 안 gold·potion 중 가장 가까운 drop, 없으면 null */
  function pick(drops, px, py, r) {
    var best = null, bd = r, i, d, L;
    for (i = 0; i < (drops || []).length; i++) {
      d = drops[i]; if (!KINDS[d.kind]) { continue; }
      L = Math.hypot(d.x - px, d.y - py); if (L <= bd) { bd = L; best = d; }
    }
    return best;
  }
  function towards(pet, tx, ty, spd, dt) {
    var dx = tx - pet.x, dy = ty - pet.y, L = Math.hypot(dx, dy); if (L < 0.5) { return; }
    var k = Math.min(1, spd * dt / L); pet.x += dx * k; pet.y += dy * k;
  }

  function step(run, dt) {
    if (!on() || !run || !run.player || !run.drops) { return; }
    var p = run.player, px = p.x + P_W / 2, py = p.y + P_H, home = { x: px - (p.facing || 1) * BEHIND, y: py - 10 };
    var pet = run.pet;
    if (!pet || run.petDrops !== run.drops || Math.hypot(pet.x - px, pet.y - py) > 900) { pet = run.pet = { x: home.x, y: home.y, t: 0, tgt: null }; run.petDrops = run.drops; }
    pet.t -= dt;
    if (pet.t <= 0) { pet.t = SCAN; pet.tgt = pick(run.drops, px, py, R); }
    var tg = pet.tgt;
    if (tg && run.drops.indexOf(tg) < 0) { tg = pet.tgt = null; }
    if (tg) {
      towards(pet, tg.x, tg.y, RUN, dt);
      if (Math.hypot(tg.x - pet.x, tg.y - pet.y) <= TOUCH) { tg.x = px; tg.y = py; tg.vy = 0; pet.tgt = null; }
    } else { towards(pet, home.x, home.y, FOLLOW, dt); }
  }

  function draw(ctx, camX, run) {
    var pet = run && run.pet; if (!on() || !pet) { return; }
    ctx.font = '20px "Segoe UI Emoji", system-ui'; ctx.textAlign = 'center';
    (global.DG.mode2d || { mark: function (c, s, x, y) { c.fillText(s, x, y); } }).mark(ctx, '🦊', pet.x - camX, pet.y);
  }

  global.DG = global.DG || {};
  global.DG.petFetch = { R: R, pick: pick, step: step, draw: draw };
})(window);
