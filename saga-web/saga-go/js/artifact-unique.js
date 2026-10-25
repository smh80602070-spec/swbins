/**
 * 1만리 고유 보패 (W-0438 ② · 디아블로 고유 아이템 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 보패는 세트·주/부옵션만 굴리는 물건이었다 → ★5 가 나올 때 CHANCE(8%)로 **고유**가 된다(art.uq = key, 순수 추가):
 *   고정   그 고유의 능력치 한 줄(stats) + 4 세트급 효과 한 줄(four — field-combat 이 읽는 같은 키)을 세트와 따로 더한다
 *   이름   보패 이름 앞에 「⭐ <고유 이름>」
 *   굴림   보패 씨앗에서 따로 뽑는 난수(seed × 7 + 3) — 다른 굴림(주·부옵션)은 그대로라 같은 씨앗이면 늘 같다
 * UQ 표는 대역 넷 — K 생성기 표(W-0435: 고유 보패 40)가 오면 줄만 늘린다. 손잡이 go.artUnique(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var CHANCE = 0.08;
  var UQ = {
    uq_mugwang:  { name: '무광 비녀',   stats: { atk_pct: 0.12 },   four: { normal_melee: 0.2 }, desc: '공격력 +12% · 칼·대도·창 기본 공격 피해 +20%' },
    uq_pungnyu:  { name: '풍류 피리',   stats: { energy: 0.2 },     four: { react_swirl: 0.3 },  desc: '기력 획득 +20% · 회오리 피해 +30%' },
    uq_ilgwang:  { name: '일광 가락지', stats: { crit_rate: 0.08 }, four: { skill_dmg: 0.15 },   desc: '치명 확률 +8% · 원소 스킬 피해 +15%' },
    uq_hwaseong: { name: '화성 향낭',   stats: { elem_fire: 0.15 }, four: { react_fire: 0.2 },   desc: '화 피해 +15% · 물안개·녹임·터짐·들불 피해 +20%' }
  };
  var KEYS = Object.keys(UQ);

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('go.artUnique', 1)); }
  /** 새 보패 굴림 — ★5 만, 씨앗으로 정해짐. 고유 key 또는 null */
  function roll(seed, rarity) {
    var A = global.DG.artifact; if (!on() || rarity < 5 || !A || !A.mulberry32) { return null; }
    var r = A.mulberry32(((seed >>> 0) * 7 + 3) >>> 0);
    return r() < CHANCE ? KEYS[Math.floor(r() * KEYS.length) % KEYS.length] : null;
  }
  /** 셈 — statsOf 의 addStat·four 에 고유 줄을 더한다 */
  function apply(art, addStat, four) {
    var u = art && art.uq && on() ? UQ[art.uq] : null, k; if (!u) { return false; }
    for (k in u.stats) { addStat(k, u.stats[k]); }
    for (k in u.four) { four[k] = (four[k] || 0) + u.four[k]; }
    return true;
  }
  function nameOf(art) { var u = art && art.uq ? UQ[art.uq] : null; return u ? '⭐ ' + u.name + ' · ' : ''; }

  global.DG = global.DG || {};
  global.DG.artifactUnique = { CHANCE: CHANCE, UQ: UQ, roll: roll, apply: apply, nameOf: nameOf };
})(window);
