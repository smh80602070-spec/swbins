/**
 * 4종횡 — 띄우기·공중 콤보 (W-0345 · 던전앤파이터·엘소드 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 맞은 적은 가로로만 밀렸다(strike e.kx) → ↑ 를 누른 채 치면(원소 기술 제외) 올려치기:
 *   launch(e)   보스·관문 대장·탱커는 안 뜬다 · e.vy = −JUMP×LAUNCH_K · e.air = true · e.airHits = 0 · e.groundY = e.y
 *   juggle(e)   떠 있는 적을 또 치면 airHits < MAX_HITS 면 다시 튕김(−JUMP×JUGGLE_K), 상한이면 안 튕기고 떨어진다
 *   tick(e,…)   중력으로 내려오고 groundY 에 닿으면 떨어짐 피해 dmg × FALL_K(마지막 친 힘 기준) + 'land' 효과, 상태 지움
 * 떠 있는 동안 적은 걷기·몸 닿기 공격을 안 한다(side 조각 02 의 적 루프가 e.air 를 본다). 데이터 칸·세이브 없음(e.* 은 런타임).
 * 본보기 side-just.js — side.js 는 큰 파일 상한이라 이 파일에 두고 거기 기존 줄 끝에서 부른다. 손잡이 side.launch(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var LAUNCH_K = 0.7, JUGGLE_K = 0.3, MAX_HITS = 4, FALL_K = 0.5;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('side.launch', 1)); }
  function jump() { var C = core(); return C && C.tuned ? +C.tuned('side.jump', 760) : 760; }
  function immune(e) { return !e || e.boss || e.gate || e.gateBoss || e.role === 'tank'; }
  function airborne(e) { return !!(e && e.air); }

  /** 올려치기 — 떴으면 true */
  function launch(e, dmg) {
    if (!on() || immune(e) || e.air) { return false; }
    e.air = true; e.airHits = 0; e.groundY = e.y; e.vy = -jump() * LAUNCH_K; e.lastHitDmg = dmg || 0; e.kx = 0;
    return true;
  }
  /** 떠 있는 적 추가타 — 다시 튕겼으면 true(상한이면 false — 그대로 떨어진다) */
  function juggle(e, dmg) {
    if (!airborne(e)) { return false; }
    e.lastHitDmg = dmg || e.lastHitDmg || 0;
    if (e.airHits >= MAX_HITS) { return false; }
    e.airHits += 1; e.vy = -jump() * JUGGLE_K;
    return true;
  }
  /** 한 틱 — 착지했으면 떨어짐 피해 값(그 외 0). onLand(e, dmg) 는 부른 쪽이 피해·효과를 넣는다 */
  function tick(e, dt, grav, onLand) {
    if (!airborne(e) || !(dt > 0)) { return 0; }
    e.y += e.vy * dt; e.vy += (grav || 1900) * dt;
    if (e.vy > 0 && e.y >= e.groundY) {
      var d = Math.max(1, Math.round((e.lastHitDmg || 0) * FALL_K));
      e.y = e.groundY; e.vy = 0; e.air = false; e.airHits = 0;
      if (onLand) { onLand(e, d); }
      return d;
    }
    return 0;
  }
  /** strike 의 넉백 갈래 — ↑ 눌림·원소 아님이면 띄우기/저글. 띄우기·저글이 맡았으면 true(옛 가로 넉백 대신) */
  function onStrike(e, up, elem, dmg) {
    if (!on() || !e) { return false; }
    if (airborne(e)) { juggle(e, dmg); return true; }
    if (up && !elem) { return launch(e, dmg); }
    return false;
  }

  global.DG = global.DG || {};
  global.DG.sideLaunch = { LAUNCH_K: LAUNCH_K, JUGGLE_K: JUGGLE_K, MAX_HITS: MAX_HITS, FALL_K: FALL_K, launch: launch, juggle: juggle, tick: tick, airborne: airborne, onStrike: onStrike, immune: immune };
})(window);
