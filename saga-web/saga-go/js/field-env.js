/**
 * 1만리 — 환경 연쇄 (W-0374 · 젤다 야숨 불 번짐·물 위 번개 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 원소 반응(field-combat REACT)은 적 몸에만 걸렸다 → 들판 땅이 받아친다(땅 칸 = world.terrainAt, 48m 칸):
 *   불길   불(fire) 타격을 맞은 적이 풀·숲·논 칸에 있으면 그 칸에 불길 LIFE 초 — TICK 초마다 그 칸·이웃 칸 적에게 불 피해(나 공격의 BURN_K, 불 원소 묻힘)
 *          SPREAD 초 뒤 이웃 풀 칸 하나로 한 번 번짐(번진 불은 더 안 번짐) · 불길은 MAX 개까지
 *   전류   번개(elec) 타격을 맞은 적이 물 칸이면 같은·이웃 물 칸의 다른 적에게 번개(공격 × SHOCK_K, 한 번)
 *   끄기   물(water) 타격은 그 칸 불길을 끈다
 * 피해는 field-combat hitFoe(src 'env' — 땅이 낸 피해는 다시 땅을 안 부른다)로만 넣는다. 나(플레이어)는 불길에 안 다친다.
 * field-combat.js 는 큰 파일 상한이라 이 파일에 두고 거기는 기존 줄 끝에서 부른다(hitFoe·step). 2D 불길은 world items(나무 깊이 줄 곁). 손잡이 go.envChain(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var CELL = 48, LIFE = 3, TICK = 0.5, SPREAD = 0.5, MAX = 12, BURN_K = 0.15, SHOCK_K = 0.6;
  var GRASS = { grass: 1, forest: 1, farm: 1 };
  var fires = [], busy = false;

  function core() { return global.DG.core; }
  function FC() { return global.DG.fieldCombat; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.envChain', 1)); }
  function terr() { var W = global.DG.world; return W && W.terrainAt ? W.terrainAt : null; }
  function cellOf(x, y) { return { tx: Math.floor(x / CELL), ty: Math.floor(y / CELL) }; }
  function fireAt(tx, ty) { for (var i = 0; i < fires.length; i++) { if (fires[i].tx === tx && fires[i].ty === ty) { return fires[i]; } } return null; }
  /** 이 칸에 불을 붙인다 — 붙였으면 true(풀 아닌 칸·이미 탐·가득이면 false) */
  function ignite(tx, ty, T, gen) {
    var t = T || terr();
    if (!t || !GRASS[t(tx, ty)] || fireAt(tx, ty) || fires.length >= MAX) { return false; }
    fires.push({ tx: tx, ty: ty, t: 0, acc: 0, spread: !!gen });   // 번진 불(gen 1)은 더 안 번진다 — 한 번만
    return true;
  }
  function douse(tx, ty) { for (var i = fires.length - 1; i >= 0; i--) { if (fires[i].tx === tx && fires[i].ty === ty) { fires.splice(i, 1); return true; } } return false; }
  function member(S) { return S && S.party ? S.party[S.active] : null; }
  function near(c, x, y) { var q = cellOf(x, y); return Math.abs(q.tx - c.tx) <= 1 && Math.abs(q.ty - c.ty) <= 1; }

  /** hitFoe 가 부른다 — 맞은 적 칸의 땅이 받아친다. 무엇을 했나 'fire'|'shock'|'douse'|null */
  function onHit(S, f, el, src) {
    if (!on() || busy || src === 'env' || !f || !el) { return null; }
    var T = terr(), c = cellOf(f.x, f.y), kind = T ? T(c.tx, c.ty) : null, F = FC(), m = member(S), L, i, n = 0;
    if (el === 'water') { return douse(c.tx, c.ty) ? 'douse' : null; }
    if (el === 'fire' && GRASS[kind]) { return ignite(c.tx, c.ty, T) ? 'fire' : null; }
    if (el === 'elec' && kind === 'water' && F && F.living && m) {
      busy = true;
      try {
        L = F.living(S);
        for (i = 0; i < L.length; i++) {
          var g = L[i];
          if (g === f || !near(c, g.x, g.y)) { continue; }
          var gc = cellOf(g.x, g.y);
          if (T(gc.tx, gc.ty) !== 'water') { continue; }
          F.hitFoe(S, g, m, m.atk * SHOCK_K, 'elec', 'env'); n++;
        }
      } finally { busy = false; }
      if (n && F.push) { F.push(S, { t: 'envShock', x: f.x, y: f.y, n: n }); }
      return n ? 'shock' : null;
    }
    return null;
  }

  /** field-combat step 이 부른다 — 불길 피해·번짐·꺼짐 */
  function tick(S, dt) {
    if (!on() || !fires.length || !(dt > 0)) { return; }
    var F = FC(), m = member(S), T = terr(), i, k, c, L;
    for (i = fires.length - 1; i >= 0; i--) {
      c = fires[i]; c.t += dt; c.acc += dt;
      if (c.acc >= TICK && F && F.living && m && S) {
        c.acc = 0; busy = true;
        try { L = F.living(S); for (k = 0; k < L.length; k++) { if (near(c, L[k].x, L[k].y)) { F.hitFoe(S, L[k], m, m.atk * BURN_K, 'fire', 'env'); } } } finally { busy = false; }
      }
      if (!c.spread && c.t >= SPREAD && T) {
        c.spread = true;
        var ds = [[1, 0], [-1, 0], [0, 1], [0, -1]], j0 = (Math.abs(c.tx * 7 + c.ty * 13)) % 4;
        for (k = 0; k < 4; k++) { var d = ds[(j0 + k) % 4]; if (ignite(c.tx + d[0], c.ty + d[1], T, 1)) { break; } }
      }
      if (c.t >= LIFE) { fires.splice(i, 1); }
    }
  }

  /** 2D — 불길 칸 하나(화면 x, y = 칸 가운데 발 밑, 칸 폭 w px). now ms */
  function draw2d(ctx, x, y, w, c, now) {
    var t = (now || 0) / 120, a = Math.max(0, Math.min(1, (LIFE - c.t) / 0.6)), i;
    ctx.save(); ctx.globalAlpha = a;
    var g = ctx.createRadialGradient(x, y - w * 0.15, 1, x, y - w * 0.15, w * 0.6);
    g.addColorStop(0, 'rgba(255,170,60,0.45)'); g.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - w * 0.15, w * 0.6, 0, Math.PI * 2); ctx.fill();
    for (i = 0; i < 5; i++) {
      var ox = (i - 2) * w * 0.16, h = w * (0.28 + 0.12 * Math.sin(t + i * 1.7));
      ctx.fillStyle = i % 2 ? '#ffd36a' : '#ff7a26';
      ctx.beginPath(); ctx.moveTo(x + ox - w * 0.07, y); ctx.quadraticCurveTo(x + ox + Math.sin(t * 1.3 + i) * w * 0.04, y - h * 1.6, x + ox + w * 0.07, y); ctx.fill();
    }
    ctx.restore();
  }

  global.DG = global.DG || {};
  global.DG.fieldEnv = { CELL: CELL, LIFE: LIFE, MAX: MAX, BURN_K: BURN_K, SHOCK_K: SHOCK_K, onHit: onHit, tick: tick, ignite: ignite, douse: douse, fires: function () { return fires; }, draw2d: draw2d, _reset: function () { fires = []; busy = false; } };
})(window);
