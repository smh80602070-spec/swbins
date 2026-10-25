/**
 * 4종횡 장비 세트 (W-0437 ① · 메이플 세트 효과·디아블로 세트 스킬 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 장비는 열 부위 × 네 단(data-gear GEAR 40)뿐이고 짝이 없었다(gear.setGrade 는 외곽선 색만):
 *   세트   SETS 한 줄 = 이름·조각(GEAR key)·짝 수별 효과(누적 — 4 를 채우면 2·3 도 다 붙음)
 *   효과   2·3 짝 = 공격·방어·체력 더하기(gear.bonus 합에 얹음) · 4 짝 = **세트 무예** 한 칸이 스킬 막대 끝에 붙는다
 *          (기력 0 · 쿨만 · 자동 사냥도 쓴다 — 벗으면 빠짐). 무예 모양은 data-job SKILLS 와 같은 칸(effect·mul·r)
 *   셈     요구 수준 미달(gear.bonus 가 안 세는 것)은 짝으로 안 센다
 * 지금 SETS 는 대역 둘 — K 생성기 표(W-0435: 세트 20)가 오면 이 표에 줄만 늘린다. 세이브 안 바뀜(낀 것에서 셈).
 * 손잡이 story.gearSet(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var SETS = [
    { key: 'set_ryong', name: '흑룡 채비', pieces: ['shoe4', 'glv4', 'cap4', 'ring4'],
      bonus: { 2: { atk: 8 }, 3: { hp: 120 }, 4: { def: 12 } },
      skill: { key: 'set_ryong', job: 'set', name: '흑룡파(黑龍波)', emoji: '🐉', cost: 0, cd: 12, max: 0, effect: 'aoe', mul: [3.2, 0], r: 150, desc: '흑룡 채비 네 점 — 주위를 크게 휩쓴다' } },
    { key: 'set_ok', name: '옥 장신구', pieces: ['ring3', 'neck3', 'ear3', 'glv3'],
      bonus: { 2: { hp: 60 }, 3: { atk: 6 }, 4: { def: 6 } },
      skill: { key: 'set_ok', job: 'set', name: '옥령탄(玉靈彈)', emoji: '💎', cost: 0, cd: 9, max: 0, effect: 'bolt', mul: [2.6, 0], desc: '옥 장신구 네 점 — 앞으로 꿰뚫는 기를 날린다' } }
  ];

  function core() { return global.DG.core; }
  function on() { var c = core(); return !(c && c.tuned && !+c.tuned('story.gearSet', 1)); }
  /** 낀 장비(gear.equipped) 중 요구 수준을 채운 것의 key 목록 */
  function wornKeys() {
    var G = global.DG.gear, C = core(), e = G && G.equipped ? G.equipped() : {}, out = [], k;
    for (k in e) { if (Object.prototype.hasOwnProperty.call(e, k) && e[k]) { var d = G.defOf ? G.defOf(e[k]) : null; if (d && C.save.player.level >= d.need) { out.push(e[k].key); } } }
    return out;
  }
  /** 세트마다 낀 짝 수 { key: n } */
  function counts(keys) {
    keys = keys || wornKeys(); var out = {};
    SETS.forEach(function (s) { out[s.key] = s.pieces.filter(function (p) { return keys.indexOf(p) >= 0; }).length; });
    return out;
  }
  /** 더할 능력치 {atk, def, hp} — 짝 수 이하 효과 누적 */
  function bonus(keys) {
    var sum = { atk: 0, def: 0, hp: 0 }; if (!on()) { return sum; }
    var c = counts(keys);
    SETS.forEach(function (s) { var n = c[s.key], k, st; for (k in s.bonus) { if (+k <= n) { for (st in s.bonus[k]) { sum[st] += s.bonus[k][st]; } } } });
    return sum;
  }
  /** 다 채운 세트의 무예들(스킬 막대 끝에 붙음) */
  function skills(keys) {
    if (!on()) { return []; }
    var c = counts(keys);
    return SETS.filter(function (s) { return s.skill && c[s.key] >= s.pieces.length; }).map(function (s) { return s.skill; });
  }
  function setOf(gearKey) { return SETS.filter(function (s) { return s.pieces.indexOf(gearKey) >= 0; })[0] || null; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** 장비 창 줄 — 낀 짝이 하나라도 있는 세트만 */
  function cardHtml() {
    if (!on()) { return ''; }
    var c = counts(), L = SETS.filter(function (s) { return c[s.key] > 0; }); if (!L.length) { return ''; }
    return '<div class="sec"><h4>🧩 세트</h4><div class="card">' + L.map(function (s) {
      var n = c[s.key], fx = Object.keys(s.bonus).map(function (k) { var b = s.bonus[k], t = Object.keys(b).map(function (st) { return ({ atk: '공격', def: '방어', hp: '체력' })[st] + ' +' + b[st]; }).join(' '); return '<span' + (+k <= n ? '' : ' class="muted"') + '>' + k + '짝 ' + t + '</span>'; }).join(' · ');
      return '<div class="stat-row"><span>' + esc(s.name) + ' <small class="muted">' + n + '/' + s.pieces.length + '</small></span></div><small>' + fx + ' · <span' + (n >= s.pieces.length ? '' : ' class="muted"') + '>' + s.pieces.length + '짝 ' + s.skill.emoji + ' ' + esc(s.skill.name) + '</span></small>';
    }).join('') + '</div></div>';
  }

  global.DG = global.DG || {};
  global.DG.gearSet = { SETS: SETS, counts: counts, bonus: bonus, skills: skills, setOf: setOf, cardHtml: cardHtml };
})(window);
