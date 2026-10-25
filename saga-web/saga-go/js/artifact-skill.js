/**
 * 1만리 보패 세트 기술 (W-0438 ① · 디아블로 세트 스킬 결 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 보패(artifact.js) 세트는 2·4 세트 숫자 효과뿐이었다 → **네 점을 맞춘 세트마다 기술 하나**가 들판 전투에서 저절로 터진다:
 *   발동   싸우는 동안(주변 R 안에 적) 앞에 선 인물의 4 세트마다 쿨(cd 초)이 돌면 그 자리 둘레 r(× KDV) 안 적 전부에
 *          그 인물 공격력 × mul 피해(세트 원소) · 띠 없이 들판 전투 「heavyGo」 연출 하나
 *   표     SKILL(세트 id → 기술) — K 생성기 표(W-0435: 세트 15)가 오면 줄만 늘린다. 세이브 안 바뀜(낀 보패에서 셈)
 * field-combat tick 의 step 줄 끝에서 tick(S, dt, px, py). 손잡이 go.artSkill(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var SKILL = {
    gladiator:   { name: '칼바람 베기', emoji: '⚔️', mul: 2.2, r: 3, cd: 9,  el: null },
    crimson:     { name: '불씨 터뜨림', emoji: '🔥', mul: 1.8, r: 3.5, cd: 10, el: 'fire' },
    viridescent: { name: '솔바람 회오리', emoji: '🌪️', mul: 1.6, r: 4, cd: 10, el: 'wind' },
    emblem:      { name: '봉화 일제사', emoji: '🚩', mul: 2.0, r: 3, cd: 11, el: null },
    depth:       { name: '나루 물결', emoji: '🌊', mul: 1.7, r: 3.5, cd: 10, el: 'water' }
  };
  var cds = {};   // 인물 id + 세트 → 남은 쿨

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('go.artSkill', 1)); }
  /** 그 인물이 네 점을 맞춘 세트들의 기술 [{set, ...}] */
  function skillsOf(id) {
    var A = global.DG.artifact; if (!on() || !A || !A.equippedOf) { return []; }
    var eq = A.equippedOf(id), cnt = {}, k, out = [];
    for (k in eq) { if (Object.prototype.hasOwnProperty.call(eq, k)) { var a = A.get(eq[k]); if (a) { cnt[a.set] = (cnt[a.set] || 0) + 1; } } }
    for (k in cnt) { if (cnt[k] >= 4 && SKILL[k]) { out.push(Object.assign({ set: k }, SKILL[k])); } }
    return out;
  }
  /** 매 틱 — 쿨을 돌리고, 적이 둘레에 있으면 터뜨린다. 터진 수 */
  function tick(S, dt, px, py) {
    var FC = global.DG.fieldCombat; if (!on() || !S || !FC || !S.party) { return 0; }
    var m = S.party[S.active]; if (!m || m.down || m.hp <= 0) { return 0; }
    var L = skillsOf(m.id), n = 0, kd = FC.KDVf ? FC.KDVf() : 1;
    L.forEach(function (sk) {
      var key = m.id + '|' + sk.set; cds[key] = (cds[key] == null ? 0 : cds[key]) - dt;
      if (cds[key] > 0) { return; }
      var foes = FC.foesWithin ? FC.foesWithin(S, px, py, sk.r * kd) : []; if (!foes.length) { return; }
      cds[key] = sk.cd; n++;
      foes.forEach(function (f) { FC.hitFoe(S, f, m, m.atk * sk.mul, sk.el || m.el, 'skill'); });
      if (FC.push) { FC.push(S, { t: 'heavyGo', x: px, y: py, art: sk.set }); }
    });
    return n;
  }

  global.DG = global.DG || {};
  global.DG.artifactSkill = { SKILL: SKILL, skillsOf: skillsOf, tick: tick, _reset: function () { cds = {}; } };
})(window);
