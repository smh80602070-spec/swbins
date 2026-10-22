/**
 * 1만리 — 말 위 전투 (W-0304 · 엘든 링 토렌트·붉은사막 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 탈것은 이동뿐이라 싸움이 붙으면 저절로 내렸다(mount.js tick) → 손잡이 go.mountFight(1) 이면 탄 채로 싸운다:
 *   베기    지상 탈것 위 평타 = 그대로 치되 달리는 빠르기만큼 피해 ×(1 + SPEED_K × 빠르기 비율)
 *   돌진    강공격 키 — 탄 채면 기력 대신 쿨 CHARGE_CD(6초): 둘레 적을 쳐 ×CHARGE_MUL 피해 + 넘어뜨림(기절 1초)
 *   낙마    탄 채 맞으면 말에서 떨어지고 FALL_MS(0.8초) 동안 칠 수 없다
 *   비행    날고 있으면 칼은 안 닿는다(평타 막힘) — 원소 기술·원소 구슬(skill·burst)만
 *   포획    조우 창이 열리면 mount.js 가 내린다(그대로) — 짐승은 내려서 잡는다
 * field-combat.js 는 큰 파일 상한이라 이 파일에 두고 거기는 기존 줄 끝에서 부른다(hitMul·blockMelee·charge·onHurt).
 */
(function (global) {
  'use strict';

  var SPEED_K = 0.5, CHARGE_CD = 6, CHARGE_MUL = 1.6, FALL_MS = 800, STUN = 1;
  var cd = 0, fallenUntil = 0, lastX = null, lastY = null, spd = 0, vmax = 1;

  function core() { return global.DG.core; }
  function MT() { return global.DG.mount; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.mountFight', 1)); }
  function riding() { var M = MT(); return !!(on() && M && M.active && M.active() && !(M.flying && M.flying())); }
  function flying() { var M = MT(); return !!(on() && M && M.active && M.active() && M.flying && M.flying()); }
  function fallen(now) { return (now || Date.now()) < fallenUntil; }
  /** 빠르기 비율 0..1 — 탄 동안 잰 걸음 빠르기 ÷ 그동안 가장 빠르던 값 */
  function speed01() { return riding() ? Math.max(0, Math.min(1, spd / Math.max(1e-6, vmax))) : 0; }

  /** 평타를 막나 — 날고 있거나 막 떨어졌으면 */
  function blockMelee() { return on() && (flying() || fallen()); }
  /** 적에게 주는 피해 곱 — 지상 탈것 위의 평타·강타만 */
  function hitMul(src) { return riding() && (src === 'basic' || src === 'heavy' || src === 'charge') ? 1 + SPEED_K * speed01() : 1; }

  /** 돌진 — { ok, n, cd } */
  function charge(S, px, py) {
    var FC = global.DG.fieldCombat;
    if (!riding() || !FC || !S) { return { ok: false }; }
    if (cd > 0) { return { ok: false, cd: cd }; }
    var m = S.party && S.party[S.active];
    if (!m || m.down) { return { ok: false }; }
    var r = 3.5 * (FC.KDVf ? FC.KDVf() : 1), L = FC.foesWithin ? FC.foesWithin(S, px, py, r) : [], i, n = 0;
    cd = CHARGE_CD;
    for (i = 0; i < L.length; i++) { FC.hitFoe(S, L[i], m, m.atk * CHARGE_MUL, m.el, 'charge'); L[i].stun = Math.max(L[i].stun || 0, STUN); n++; }
    if (FC.push) { FC.push(S, { t: 'heavyGo', x: px, y: py, mount: true }); }
    core().emit('mount:charge', { n: n });
    if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast('🐎 돌진! ' + (n ? n + ' 쳐 넘김' : '') + ' (쿨 ' + CHARGE_CD + '초)'); }
    return { ok: true, n: n, cd: cd };
  }
  /** 탄 채 맞음 — 낙마 */
  function onHurt() {
    if (!on() || !MT() || !MT().active || !MT().active()) { return false; }
    MT().dismount('맞아서 말에서 떨어졌다');
    fallenUntil = Date.now() + FALL_MS;
    return true;
  }
  function tick(dt) {
    if (cd > 0) { cd = Math.max(0, cd - (dt || 0)); }
    var p = core() && core().save && core().save.player && core().save.player.pos;
    if (!p || !(dt > 0)) { return; }
    if (lastX !== null && riding()) { var v = Math.hypot(p.x - lastX, p.y - lastY) / dt; spd = spd * 0.7 + v * 0.3; if (spd > vmax) { vmax = spd; } } else { spd = 0; }
    lastX = p.x; lastY = p.y;
  }

  global.DG = global.DG || {};
  global.DG.mountCombat = { SPEED_K: SPEED_K, CHARGE_CD: CHARGE_CD, CHARGE_MUL: CHARGE_MUL, FALL_MS: FALL_MS, riding: riding, flying: flying, fallen: fallen, speed01: speed01, blockMelee: blockMelee, hitMul: hitMul, charge: charge, onHurt: onHurt, tick: tick, on: on,
    cd: function () { return cd; }, _set: function (o) { if ('cd' in o) { cd = o.cd; } if ('spd' in o) { spd = o.spd; } if ('vmax' in o) { vmax = o.vmax; } if ('fallenUntil' in o) { fallenUntil = o.fallenUntil; } } };
})(window);
