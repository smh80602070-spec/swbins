/**
 * 4종횡 콤보 킬 (W-0423 ② · 정본 고돗 G-0345 / 유니티 U-0207 — 메이플 콤보 킬은 구조만, 수치는 우리 것)
 * ---------------------------------------------------------------
 * 몰아 잡아도 "빨리 이어 잡았다"가 남지 않았다:
 *   이음   처치가 WINDOW(5초) 안에 이어지면 수 +1, 아니면 1부터 · 3부터 그 자리에 「n 콤보 킬」(10·30·50 에서 색 진해짐)
 *   구슬   ORB_EVERY(10)마다 파란 경험치 구슬(떨어진 것 exporb) — ORB_PULL(3.5m ≈ 112px) 안이면 끌려와 닿으면
 *          그 적 경험치 × (3 + 콤보/10, 최대 8) · 「EXP +n」
 *   기록   이번 사냥 최고만(run.ck.best — 저장 안 함). runrank 연계(맞으면 0)와 따로.
 * side.js 처치(경험치 셈 뒤) onKill(run, fx, e, exp) · update 맨 앞 tick(run, dt) · 줍기 분기 pick(run, fx, d). 손잡이 story.comboKill(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var WINDOW = 5, ORB_EVERY = 10, ORB_PULL = 112, ORB_SPD = 420, MUL_MAX = 8;
  var TIERS = [[50, '#ff5a6e'], [30, '#ffa040'], [10, '#ffe066'], [3, '#ffffff']];

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('story.comboKill', 1)); }
  function ck(run) { if (!run.ck) { run.ck = { n: 0, best: 0, t: 0, last: -99 }; } return run.ck; }
  function colorOf(n) { for (var i = 0; i < TIERS.length; i++) { if (n >= TIERS[i][0]) { return TIERS[i][1]; } } return null; }
  function orbMul(n) { return Math.min(MUL_MAX, 3 + n / 10); }

  /** 처치 하나 — {n, orb(경험치 또는 0)} */
  function onKill(run, fx, e, exp) {
    if (!on() || !run || !e) { return null; }
    var s = ck(run);
    s.n = s.t - s.last <= WINDOW ? s.n + 1 : 1; s.last = s.t; if (s.n > s.best) { s.best = s.n; }
    var x = e.x + (e.w || 0) / 2, y = e.y, orb = 0, col = colorOf(s.n);
    if (col && fx) { fx.push({ t: 'itempop', x: x, y: y - 26, emoji: s.n >= 10 ? '🔥' : '⚡', text: s.n + ' 콤보 킬', color: col, life: 0.9 }); }
    if (s.n % ORB_EVERY === 0) {
      orb = Math.max(1, Math.round((exp || 0) * orbMul(s.n)));
      if (run.drops) { run.drops.push({ kind: 'exporb', x: x, y: y, vy: -260, n: orb }); }
    }
    return { n: s.n, orb: orb };
  }
  /** 매 틱 — 시계 + 가까운 구슬 끌기 */
  function tick(run, dt) {
    if (!run) { return; }
    var s = ck(run); s.t += dt;
    var p = run.player; if (!p || !run.drops) { return; }
    var px = p.x + 13, py = p.y + 54;
    run.drops.forEach(function (d) {
      if (d.kind !== 'exporb') { return; }
      var dx = px - d.x, dy = (py - 12) - d.y, L = Math.hypot(dx, dy);
      if (L < ORB_PULL && L > 1) { var k = Math.min(1, ORB_SPD * dt / L); d.x += dx * k; d.y += dy * k; d.vy = Math.min(d.vy, 0); }
    });
  }
  /** 줍기 — 경험치를 넣고 「EXP +n」 */
  function pick(run, fx, d) {
    var C = core(); C.gainExp(d.n); if (run) { run.expGained = (run.expGained || 0) + d.n; }
    if (fx) { fx.push({ t: 'itempop', x: d.x, y: d.y, emoji: '🔵', text: 'EXP +' + d.n, color: '#8fd0ff', life: 0.9 }); }
    return d.n;
  }
  function best(run) { return run && run.ck ? run.ck.best : 0; }

  global.DG = global.DG || {};
  global.DG.comboKill = { WINDOW: WINDOW, ORB_EVERY: ORB_EVERY, ORB_PULL: ORB_PULL, MUL_MAX: MUL_MAX, colorOf: colorOf, orbMul: orbMul, onKill: onKill, tick: tick, pick: pick, best: best };
})(window);
