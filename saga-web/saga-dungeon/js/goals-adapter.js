/**
 * 2나락 「오늘」 어댑터 — W-0380. 공용 goals-panel.js 가 그린다.
 * 오늘·이번 주 = 목표판의 일일·주간 고정 묶음(goals.bundles — 읽기만). 묶음을 다 채우면 보상은 목표판이 저절로 준다(claim auto).
 * 날 갈림은 goals.js 와 같은 로컬 자정. 줄을 누르면 목표 시트.
 */
(function (global) {
  'use strict';

  function untilHour(h) { var n = new Date(), t = new Date(n); t.setHours(h, 0, 0, 0); if (t <= n) { t.setDate(t.getDate() + 1); } return Math.round((t - n) / 1000); }
  function openQuest() { var U = global.DG.ui; if (U && U.openSheet) { U.openSheet('quest'); } }

  function model() {
    var G = global.DG.goals, b = G && G.bundles ? G.bundles() : null;
    if (!b) { return { today: [], week: [], note: '목표판이 아직 없습니다.' }; }
    function rows(list, icon) { return list.map(function (r) { return { label: r.label, icon: icon, cur: r.cur, max: r.max, done: r.done, go: openQuest }; }); }
    return {
      resetIn: untilHour(0),
      today: rows(b.daily, '📜'),
      week: rows(b.weekly, '🗓️'),
      claim: { label: '일일 묶음 — 금 +100 · 감정서 +1', state: b.dailyClaimed ? 'paid' : 'auto', hint: '주간 묶음은 전설 장비 확정' + (b.weeklyClaimed ? ' — 이번 주 받음' : '') },
      note: '묶음을 다 채우면 보상은 저절로 들어옵니다.'
    };
  }

  global.DG = global.DG || {};
  global.DG.goalsAdapter = { model: model, title: '오늘' };
})(window);
