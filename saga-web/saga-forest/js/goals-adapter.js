/**
 * 3마을 「오늘」 어댑터 — W-0380. 공용 goals-panel.js 가 그린다.
 * 오늘 = 일과 셋(village taskList), 이번 주 = 이번 주 과제(weeklyTaskInfo). 보상은 일과마다 다 한 자리에서 바로 들어온다(claim 없음).
 * 마을의 하루는 게임 안 시각(자면 새 날)이라 남은 시간은 안 적는다. 줄을 누르면 마을 시트(일과판이 맨 위).
 */
(function (global) {
  'use strict';

  function openTown() { var U = global.DG.ui; if (U && U.openSheet) { U.openSheet('town'); } }

  function model() {
    var V = global.DG.village;
    if (!V || !V.taskList) { return { today: [], week: [], note: '일과가 아직 없습니다.' }; }
    var w = V.weeklyTaskInfo ? V.weeklyTaskInfo() : null;
    return {
      resetIn: null,
      today: V.taskList().map(function (t) { return { label: t.name, icon: '🌿', cur: t.got, max: t.need, done: t.done, go: openTown }; }).concat(global.DG.fishDerby && global.DG.fishDerby.row() ? [global.DG.fishDerby.row()] : []).concat(global.DG.crops && global.DG.crops.row() ? [global.DG.crops.row()] : []).concat(global.DG.birthday && global.DG.birthday.row() ? [global.DG.birthday.row()] : []),   // W-0422 일요일 낚시 대회
      week: w ? [{ label: w.name, icon: '🗓️', cur: w.got, max: w.need, done: w.done, go: openTown }] : [],
      claim: null,
      note: '일과는 하나씩 다 한 자리에서 보상이 들어옵니다 — 자고 일어나면 새 일과.'
    };
  }

  global.DG = global.DG || {};
  global.DG.goalsAdapter = { model: model, title: '오늘' };
})(window);
