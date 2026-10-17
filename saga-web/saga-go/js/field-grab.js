/**
 * 1만리 들판 전투 — 잡기·던지기 (W-0277, 붉은사막식 맨손 한 수 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * C 키(폰은 ✊ 단추 — 잡을 수 있는 적이 가까울 때만 빛난다)로 1.5m 안 가장 가까운 잡몹을 잡아(0.3초 들기) 바라보는 쪽
 * 5m 로 던진다(0.45초). 떨어진 자리 2m 안 적이 1.5초 넘어지고(던져진 적도), 던져진 적은 공격력 ×1.2 피해. 보스는 잡히지
 * 않고 밀쳐진다(2.5m, 0.4초 휘청). 쿨 6초. 키: G 는 요리 창(cooking.js)이 이미 써서 C 로 했다.
 *
 * field-combat.js 는 줄 상한이라 여기 둔다 — 그쪽은 실을 때 bind() 로 속 함수를 넘기고, step()·act('grab') 에서 한 줄씩 부른다.
 * 손잡이(core.tuned 'field.*'): grabR 1.5 · grabCd 6 · grabThrow 5 · grabLand 2 · grabDown 1.5 · grabMul 1.2 · grabShove 2.5.
 * 판정만 — 화면(고리·글자·흔들림)은 field-combat handle() 이 'grab'·'throwLand'·'shove' 이벤트로 그린다.
 */
(function (global) {
  'use strict';

  var I = null;     // field-combat 속 함수(bind)
  var LIFT = 0.3, FLY = 0.45;

  function bind(api) { I = api; }
  function K(k, d) { return I && I.K ? I.K(k, d) : d; }
  function KDV() { return I && I.KDV ? I.KDV() : 1; }
  function GRAB_R() { return K('grabR', 1.5) * KDV(); }
  function CD() { return K('grabCd', 6); }
  function THROW_M() { return K('grabThrow', 5) * KDV(); }
  function LAND_R() { return K('grabLand', 2) * KDV(); }
  function DOWN_T() { return K('grabDown', 1.5); }
  function MUL() { return K('grabMul', 1.2); }
  function SHOVE_M() { return K('grabShove', 2.5) * KDV(); }

  function isBoss(f) { var F = I && I.FOES && I.FOES[f.kind]; return !!(F && F.boss); }
  /** 지금 잡을(밀칠) 적 — 없으면 null. 쿨·이미 든 중이면 null */
  function target(S, px, py) {
    if (!I || !S || S.grab || S.grabCd > 0) { return null; }
    var m = I.active(S);
    if (!m || m.down) { return null; }
    return I.nearestFoe(S, px, py, GRAB_R());
  }

  function grab(S, px, py) {
    if (!I || !S) { return { ok: false }; }
    var m = I.active(S);
    if (!m || m.down || S.grab) { return { ok: false }; }
    if (S.grabCd > 0) { I.push(S, { t: 'grabCd', left: S.grabCd }); return { ok: false, cd: S.grabCd }; }
    var f = I.nearestFoe(S, px, py, GRAB_R());
    if (!f) { return { ok: false, none: true }; }
    var dx = f.x - px, dy = f.y - py, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    S.grabCd = CD();
    if (isBoss(f)) {
      var kt = I.KB_T || 0.25, sm = SHOVE_M();
      f.kb = { vx: ux * sm / kt, vy: uy * sm / kt, t: kt };
      f.stun = Math.max(f.stun || 0, 0.4);
      I.push(S, { t: 'shove', uid: f.uid, x: f.x, y: f.y });
      return { ok: true, shove: true, uid: f.uid };
    }
    var fx = S.lastDx || 0, fy = S.lastDy || 0, fl = Math.hypot(fx, fy);
    if (fl < 1e-6) { fx = ux; fy = uy; fl = 1; }
    S.grab = { f: f, m: m, t: 0, dx: fx / fl, dy: fy / fl, lx: px, ly: py, tx: 0, ty: 0, flying: false };
    f.stun = 99; f.kb = null;
    I.push(S, { t: 'grab', uid: f.uid, x: f.x, y: f.y });
    return { ok: true, uid: f.uid };
  }

  /** 매 틱(field-combat step 이 부른다) — 쿨이 돌고, 든 적을 옮기고, 닿으면 넘어뜨린다 */
  function step(S, dt, px, py) {
    if (!S) { return; }
    if (S.grabCd > 0) { S.grabCd = Math.max(0, S.grabCd - dt); }
    var g = S.grab;
    if (!g) { return; }
    var f = g.f;
    if (f.dead) { S.grab = null; return; }
    g.t += dt;
    if (g.t < LIFT) { f.x = px; f.y = py; g.lx = px; g.ly = py; f.stun = 99; return; }
    if (!g.flying) { g.flying = true; g.tx = g.lx + g.dx * THROW_M(); g.ty = g.ly + g.dy * THROW_M(); }
    var k = Math.min(1, (g.t - LIFT) / FLY);
    f.x = g.lx + (g.tx - g.lx) * k; f.y = g.ly + (g.ty - g.ly) * k;
    if (k < 1) { return; }
    land(S, g);
  }

  function land(S, g) {
    var f = g.f, n = 0, i;
    S.grab = null;
    f.stun = 0;                                    // 넘어짐 보정(×1.3)이 던지기 배수(×1.2)에 얹히지 않게 — 맞힌 뒤 넘어뜨린다
    var hit = I.hitFoe(S, f, g.m, g.m.atk * MUL(), null, 'throw');
    if (!f.dead) { f.stun = DOWN_T(); }
    var near = I.foesWithin(S, f.x, f.y, LAND_R());
    for (i = 0; i < near.length; i++) { if (near[i] !== f) { near[i].stun = Math.max(near[i].stun || 0, DOWN_T()); n++; } }
    I.push(S, { t: 'throwLand', uid: f.uid, x: f.x, y: f.y, r: LAND_R(), n: n, dmg: hit ? hit.dmg : 0 });
  }

  global.DG = global.DG || {};
  global.DG.fieldGrab = {
    bind: bind, grab: grab, step: step, target: target, isBoss: isBoss,
    LIFT: LIFT, FLY: FLY, GRAB_R: GRAB_R, CD: CD, THROW_M: THROW_M, LAND_R: LAND_R, DOWN_T: DOWN_T, MUL: MUL
  };
})(window);
