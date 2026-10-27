/**
 * 5천하 — 민란 (W-0479 웹 역이식 — 정본 고돗 G-0410 · 코에이 삼국지 반란 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 치안(city.sec)이 LOW(20) 밑인 **내 세력 성**이 달 끝에 CHANCE(30%)로 들고일어난다:
 *   병력 −20% · 금 −3 × 인구/1000 · 진압 뒤 치안 +15. 굴림은 해시(시나리오|해|달|성) — Math.random 안 씀(진단 재현), 세이브 칸 없음.
 *   달 끝 묶음의 polity.monthly 와 같은 줄(settleMonth 앞)이라 굴림은 이번 달 정산 전 치안 기준. AI 세력 성은 건드리지 않는다.
 * 손잡이 rk.revolt.on(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var LOW = 20, CHANCE = 0.3, TROOP_PCT = 0.2, GOLD_PER_K = 3, SEC_UP = 15;

  function core() { return global.DG.core; }
  function on() { var c = core(); return !c || !c.tuned || +c.tuned('rk.revolt.on', 1) !== 0; }
  function R() { return global.DG.rtk; }
  function h01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  /** 굴림(순수) — 치안이 LOW 밑이고 해시가 CHANCE 밑이면 true */
  function roll(scen, year, month, cityId, sec) { return sec < LOW && h01(scen + '|' + year + '|' + month + '|' + cityId + '|revolt') < CHANCE; }
  /** 이 성에 민란을 일으킨다(굴림 뒤) — {troops, gold} 잃은 양 */
  function apply(c, f) {
    var lt = Math.floor((c.troops || 0) * TROOP_PCT), lg = Math.min(f ? f.gold : 0, Math.round(GOLD_PER_K * (c.pop || 0) / 1000));
    c.troops -= lt; if (f) { f.gold -= lg; } c.sec = Math.min(100, (c.sec || 0) + SEC_UP);
    return { troops: lt, gold: lg };
  }

  function monthly() {
    var rtk = R(); if (!on() || !rtk) { return; }
    var st = rtk.state(), me = rtk.me(), f = rtk.force(me), ids = rtk.citiesOf(me) || [], i, c, got, CD = global.DG.cityData, nm;
    for (i = 0; i < ids.length; i++) {
      c = rtk.city(ids[i]); if (!c || c.force !== me) { continue; }
      if (!roll(st.scen || '194', st.year, st.month, ids[i], c.sec)) { continue; }
      got = apply(c, f);
      nm = CD && CD.find && CD.find(ids[i]) ? CD.find(ids[i]).name : ids[i];
      core().log('🔥 ' + nm + ' 민란 — 병력 −' + got.troops + ' · 금 −' + got.gold + ' · 진압(치안 +' + SEC_UP + ')', 'bad');
      core().emit('toast', '🔥 ' + nm + ' 민란 — 병력 −' + got.troops + ' · 금 −' + got.gold);
    }
  }

  global.DG = global.DG || {};
  global.DG.revolt = { LOW: LOW, CHANCE: CHANCE, roll: roll, apply: apply, monthly: monthly };
})(window);
