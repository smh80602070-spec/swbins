/**
 * 5천하 보물 세트 (W-0440 · W-0435 ⑤ — 디아블로 세트 결을 「한 세력이 나눠 지니는 보물」로, 구조만)
 * ---------------------------------------------------------------
 * 장수는 보물을 하나만 지닌다(data-item v1 · 장비창 없음). 그래서 세트는 **같은 세력 장수들이 한 세트의 보물을 나눠 지니면**
 * 그 보물을 지닌 장수 모두에게 효과가 붙는 꼴:
 *   셈     세트 조각을 지닌 같은 세력(살아 있는) 장수 수 n — 2 = 그 세트 능력치 +PCT2 · 3 = +PCT3(누적 아님, 큰 쪽)
 *   닿는 곳 data-item statBonus(heroId) 의 pct 칸(hero.js gearOf 계약 그대로) — 화면·판정이 같은 값
 * SETS 는 지금 있는 보물 아홉으로 셋 — K 생성기 표(W-0435: 보물 60·세트 10)가 오면 줄만 늘린다. 세이브 안 바뀜.
 * 세트 전법 — 둘 이상 모이면 격자 전술 유닛에 진형 효과 하나(무장 돌격진 공격 +3 · 군사 원거리 계책 사거리 +1 · 군주 진군 이동 +1). 손잡이 rt.treasureSet(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var PCT2 = 0.05, PCT3 = 0.1;
  var SETS = [
    { key: 'set_mujang', name: '무장의 채비', stat: 'might',   tactic: { name: '돌격진', atk: 3 }, pieces: ['itm_ironblade', 'itm_warhorse', 'itm_armor'] },
    { key: 'set_gunsa',  name: '군사의 채비', stat: 'wisdom',  tactic: { name: '원거리 계책', rng: 1 }, pieces: ['itm_scroll', 'itm_compass', 'itm_jade'] },
    { key: 'set_gunju',  name: '군주의 채비', stat: 'command', tactic: { name: '진군', mov: 1 }, pieces: ['itm_seal', 'itm_drum', 'itm_boneseal'] }
  ];

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('rt.treasureSet', 1)); }
  function setOf(itemId) { for (var i = 0; i < SETS.length; i++) { if (SETS[i].pieces.indexOf(itemId) >= 0) { return SETS[i]; } } return null; }
  /** 그 세력에서 세트 s 의 조각을 지닌 장수 수(조각 종류 기준 — 같은 보물 둘은 하나로) */
  function countIn(force, s) {
    var R = global.DG.rtk, m = R && R.state ? R.state().officers : null, got = {}, k; if (!m || !force) { return 0; }
    for (k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) { var r = m[k]; if (r && !r.dead && r.force === force && r.item && s.pieces.indexOf(r.item) >= 0) { got[r.item] = 1; } } }
    return Object.keys(got).length;
  }
  /** statBonus 결과 out 에 세트 % 를 얹는다 — 얹은 비율(0 이면 없음) */
  function apply(heroId, out) {
    var off = global.DG.off; if (!on() || !off || !off.has(heroId)) { return 0; }
    var r = off.rec(heroId), s = r && r.item ? setOf(r.item) : null; if (!s || r.dead) { return 0; }
    var n = countIn(r.force, s), p = n >= 3 ? PCT3 : (n >= 2 ? PCT2 : 0);
    if (p) { out.pct[s.stat] += p; }
    return p;
  }
  /** 세트 전법 — 격자 전술(tactics.js officerUnit) 유닛에 덧붙임: 그 장수 세트가 둘 이상 모였을 때만. 붙은 전법 이름은 u.tactic */
  function tactic(u) {
    var off = global.DG.off; if (!on() || !u || !off || !off.has(u.id)) { return u; }
    var r = off.rec(u.id), s = r && r.item ? setOf(r.item) : null; if (!s || !s.tactic || r.dead || countIn(r.force, s) < 2) { return u; }
    var t = s.tactic; if (t.atk) { u.atk += t.atk; } if (t.rng) { u.rng = Math.min(3, u.rng + t.rng); } if (t.mov) { u.mov += t.mov; }
    u.tactic = t.name; return u;
  }
  function label(itemId) { var s = setOf(itemId); return s ? s.name : ''; }

  global.DG = global.DG || {};
  global.DG.treasureSet = { SETS: SETS, PCT2: PCT2, PCT3: PCT3, setOf: setOf, countIn: countIn, apply: apply, tactic: tactic, label: label };
})(window);
