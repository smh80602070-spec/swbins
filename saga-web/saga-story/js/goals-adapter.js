/**
 * 4종횡 「오늘」 어댑터 — W-0380. 공용 goals-panel.js 가 그린다.
 * 오늘 = 일일 사명(data-quest 의 daily — 일일 토벌·일일 채집, quest.list 그대로). 받아야 세고, 바치면 보상(사명 규칙 그대로 — claim 없음).
 * 이번 주 거리는 이 판에 없다(빈칸 대신 "없음" 한 줄). 날 갈림은 quest.js 와 같은 로컬 자정. 줄을 누르면 사냥터 시트(사명 절).
 */
(function (global) {
  'use strict';

  function untilHour(h) { var n = new Date(), t = new Date(n); t.setHours(h, 0, 0, 0); if (t <= n) { t.setDate(t.getDate() + 1); } return Math.round((t - n) / 1000); }
  function openField() { var U = global.DG.ui; if (U && U.openSheet) { U.openSheet('field'); } }

  function model() {
    var Q = global.DG.quest;
    if (!Q || !Q.list) { return { today: [], week: [], note: '사명이 아직 없습니다.' }; }
    var today = Q.list().filter(function (it) { return it.ref.daily; }).map(function (it) {
      var lab = it.ref.name + (it.lockedToday ? '' : (it.taken ? (it.full ? ' — 바치러 가기' : '') : ' — 받아야 셉니다'));
      return { label: lab, icon: it.ref.goal.type === 'kill' ? '⚔️' : '🌿', cur: it.lockedToday ? it.goal : (it.taken ? it.n : 0), max: it.goal, done: it.lockedToday, go: openField };
    });
    return {
      resetIn: untilHour(0),
      today: today,
      week: [],
      claim: null,
      note: today.length ? '일일 사명은 사냥터 사명 칸에서 받고 바칩니다 — 자정에 다시 받을 수 있습니다.' : 'Lv.2 부터 일일 사명이 열립니다.'
    };
  }

  global.DG = global.DG || {};
  global.DG.goalsAdapter = { model: model, title: '오늘' };
})(window);
