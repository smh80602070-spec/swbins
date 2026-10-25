/**
 * 3마을 도구 등급·채집꾼 한 벌 (W-0439 · W-0435 ④ — 디아블로 등급 색·세트 결을 채집에, 구조만)
 * ---------------------------------------------------------------
 * 3마을은 싸움 판이 아니라 장비·군단은 안 맞는다(W-0435 판정). 승급 도구(잠자리채·삽, craft.js Lv)에:
 *   등급   Lv1 일반 · Lv2 고급 · Lv3 희귀 · Lv4 영웅 · Lv5 전설(이번에 새 단 — data-village lvMax 5·레시피 net5·spade5)
 *   한 벌  두 도구가 다 희귀(Lv3) 이상 = 「채집꾼 한 벌」 수확 확률 +SET_P · 다 전설(Lv5) = 희귀 무게 ×SET_RARE 도 —
 *          craft.perk() 결과에 얹는다(축 3택과 따로)
 * 세이브 안 바뀜(tools[key].lv 에서 셈). 손잡이 fo.toolSet(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var GRADES = [null,
    { name: '일반', color: '#c8c8c8' }, { name: '고급', color: '#7fd07f' }, { name: '희귀', color: '#6aa8ff' },
    { name: '영웅', color: '#c27fff' }, { name: '전설', color: '#ffb347' }];
  var SET_TOOLS = ['net', 'spade'], SET_P = 0.1, SET_RARE = 1.25;

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('fo.toolSet', 1)); }
  function lvOf(key) { var CR = global.DG.craft, t = CR && CR.rec ? CR.rec(key) : null; return t ? t.lv : 0; }
  function grade(lv) { return GRADES[Math.max(1, Math.min(5, lv || 1))]; }
  /** 한 벌 단계 — 0 없음 · 1 희귀 한 벌 · 2 전설 한 벌 */
  function setTier(lvs) {
    if (!on()) { return 0; }
    var L = lvs || SET_TOOLS.map(lvOf), m = Math.min.apply(null, L);
    return m >= 5 ? 2 : (m >= 3 ? 1 : 0);
  }
  /** craft.perk 결과 p 에 한 벌 효과를 얹는다(그 도구가 한 벌 도구일 때만) */
  function applyPerk(key, p, lvs) {
    if (SET_TOOLS.indexOf(key) < 0) { return p; }
    var t = setTier(lvs); if (!t) { return p; }
    p.extraP = Math.min(0.9, p.extraP + SET_P); if (t >= 2) { p.rareMul *= SET_RARE; }
    p.set = t; return p;
  }
  function label(lv) { var g = grade(lv); return g ? g.name : ''; }

  global.DG = global.DG || {};
  global.DG.toolGrade = { GRADES: GRADES, SET_TOOLS: SET_TOOLS, SET_P: SET_P, SET_RARE: SET_RARE, grade: grade, label: label, setTier: setTier, applyPerk: applyPerk };
})(window);
