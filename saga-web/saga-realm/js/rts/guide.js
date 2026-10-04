/**
 * RTS 다음 할 일 안내 (W-0040) — 판 상태를 보고 지금 가장 먼저 할 일 한 줄을 돌려준다. 순수 함수, 저장 칸 없음(상태에서 매번 구한다).
 *
 * 화면은 마우스를 올린 칸이 없을 때(폰은 늘) 이 줄을 아래 안내 칸에 보인다. 순서: 끝남 → 습격 임박 → 건설 → 군대 → 영웅 → 진격.
 */
(function (global) {
  'use strict';

  function R() { return global.DG.rts; }

  function countOf(s, t) { var n = 0, id; for (id in s.buildings) { if (s.buildings[id].t === t) { n++; } } return n; }

  /** 지금 할 일 한 줄 — { key, text }. key 는 진단·화면 표시용 짧은 이름 */
  function next(s) {
    var U = R().units, army, heroes, soon, sb = s.buildings[-1], days;
    if (s.won) { return { key: 'won', text: '🏆 적 기지를 무너뜨렸다 — 평정!' }; }
    if (s.over) { return { key: 'over', text: '💀 거점이 무너졌다' }; }
    days = R().combat ? R().combat.daysToRaid(s) : -1;
    army = U.count(s, 0);
    heroes = R().heroes ? R().heroes.countAll(s) : 0;
    soon = days >= 0 && days <= 1;
    if (soon && countOf(s, 'barracks') === 0) { return { key: 'raid-soon', text: '⚠️ 곧 적이 온다 — 도로에 이어 군영을 지어 병사를 모으세요' }; }
    if (!countOf(s, 'house')) { return { key: 'house', text: '🛣️ 도로를 깔고 🏠 주거를 지어 사람을 모으세요(주거는 도로로 거점에 이어져야 합니다)' }; }
    if (!countOf(s, 'farm')) { return { key: 'farm', text: '🌾 농지를 지어 식량을 확보하세요' }; }
    if (!countOf(s, 'barracks')) { return { key: 'barracks', text: '⚔️ 도로에 이어 군영을 지으세요 — 병사를 뽑는 곳입니다' }; }
    if (army < 3) { return { key: 'train', text: '🗡️ 군영을 눌러 병사를 모집하세요(보병·궁병·기병)' }; }
    if (!heroes && R().heroes) { return { key: 'hero', text: '⭐ 군영에서 영웅을 모집하세요 — 장수 한 명이 강한 유닛이 됩니다' }; }
    if (soon) { return { key: 'defend', text: '🛡️ 곧 적이 온다 — 군대를 거점 가까이 두고 🗼 망루·🧱 성벽으로 막으세요' }; }
    if (sb && sb.hp > 0) {
      return { key: 'march', text: '🏴 군대를 골라(끌어서 박스 · 폰은 전군 선택) 적 기지로 보내세요 — 기지는 ' + (sb.x > R().grid.castleSite().x ? '동쪽' : '서쪽') + ' 멀리' };
    }
    return { key: 'idle', text: '' };
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.guide = { next: next, text: function (s) { return next(s).text; } };
})(typeof window !== 'undefined' ? window : this);
