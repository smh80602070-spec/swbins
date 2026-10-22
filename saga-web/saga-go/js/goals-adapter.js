/**
 * 1만리 「오늘」 어댑터 — W-0380. 공용 goals-panel.js 가 그린다.
 * 오늘 = 일과 넷(daily.list), 이번 주 = 일과 도장(일곱이면 주간 보상), 마무리 보상은 **역참에서** 받는 규칙 그대로라 take 없이 상태만.
 * 날 갈림은 daily.js 와 같은 새벽 4시. 줄을 누르면 사명 시트(오늘의 일과가 맨 위).
 */
(function (global) {
  'use strict';

  function untilHour(h) { var n = new Date(), t = new Date(n); t.setHours(h, 0, 0, 0); if (t <= n) { t.setDate(t.getDate() + 1); } return Math.round((t - n) / 1000); }
  function openQuest() { var U = global.DG.ui; if (U && U.openSheet) { U.openSheet('quest'); } }

  function model() {
    var Dl = global.DG.daily;
    if (!Dl) { return { today: [], week: [], note: '일과가 아직 없습니다.' }; }
    var s = Dl.state(), bs = Dl.bonusState();
    return {
      resetIn: untilHour(Dl.DAY_START_H),
      today: Dl.list().map(function (t) { return { label: t.def.name, icon: t.def.emoji, cur: t.got, max: t.need, done: t.done, go: openQuest }; }),
      week: [{ label: '일과 도장 — 일곱이면 주간 보상', icon: '🎫', cur: s.stamps, max: Dl.STAMPS_FOR_WEEK, done: false, go: openQuest }],
      claim: { label: '마무리 보상(넷 다 하면)', state: bs, hint: '다 한 날 역참에 들르면 받습니다' },
      note: '하나 마칠 때마다 도장 하나 — 새벽 4시에 새로 뽑힙니다.'
    };
  }

  global.DG = global.DG || {};
  global.DG.goalsAdapter = { model: model, title: '오늘' };
})(window);
