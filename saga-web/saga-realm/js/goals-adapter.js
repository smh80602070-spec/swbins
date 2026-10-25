/**
 * 5천하 「오늘」 어댑터 — W-0380. 공용 goals-panel.js 가 그린다.
 * 오늘 = 오늘의 도전(12달 짧은 판), 이번 주 = 주간 도전(60달) — 둘 다 점수 겨루기라 보상 없음(claim 없음), 최고 기록(rtkBest)만 읽는다.
 * 지금 도전 판을 하고 있으면 진행 달(n/m)을, 아니면 최고 점수가 있나(1/1)로. 도전은 새 판 세우기에서 고른다.
 */
(function (global) {
  'use strict';

  function untilHour(h) { var n = new Date(), t = new Date(n); t.setHours(h, 0, 0, 0); if (t <= n) { t.setDate(t.getDate() + 1); } return Math.round((t - n) / 1000); }

  function recRow() { var RC = global.DG.recommend, l = RC && RC.last ? RC.last() : null, O = global.DG.off, h = l && O && O.find ? O.find(l.got) : null; return l ? [{ label: '천거 — ' + (h ? h.name : l.got) + ' 을(를) 등용할 수 있다', icon: '📜', cur: 1, max: 1, done: true }] : []; }
  function model() {
    var R = global.DG.rtk;
    if (!R || !R.challengeDay) { return { today: [], week: [], note: '도전이 아직 없습니다.' }; }
    var best = (global.DG.core.save.rtkBest) || {}, cv = R.challengeView ? R.challengeView() : null;
    function row(ch, daily, name, icon) {
      var mine = cv && cv.week === ch.key ? cv : null, b = best[ch.key] || 0;
      if (mine && !mine.done) { return { label: name + ' — 지금 ' + mine.month + '달째 · 점수 ' + mine.score, icon: icon, cur: mine.month, max: mine.months, done: false }; }
      return { label: name + (b ? ' — 최고 ' + b + '점' : ' — 아직 안 함'), icon: icon, cur: b ? 1 : 0, max: 1, done: !!b };
    }
    return {
      resetIn: untilHour(0),
      today: [row(R.challengeDay(), true, '오늘의 도전(12달)', '🎲')].concat(recRow()),   // W-0424 이번 달 천거가 있으면 한 줄
      week: [row(R.challengeWeek(), false, '주간 도전(60달)', '🏆')],
      claim: null,
      note: '점수 겨루기(성×10 + 무장 + 보물×20) — 보상은 없고 놓쳐도 잃는 것 없습니다. 새 판 세우기에서 고릅니다.'
    };
  }

  global.DG = global.DG || {};
  global.DG.goalsAdapter = { model: model, title: '오늘' };
})(window);
