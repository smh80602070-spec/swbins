/**
 * 마을 일과판(PLAN §5.1, 표준 A·H)·하루 마무리 카드(§5.2) — village.js 에서 떼어 냄(R-4, 줄 수 상한)
 * ---------------------------------------------------------------
 * 세이브는 village.js 의 `state()`(save.village) 그대로 — `tasks`·`dayMark`·`dayLog` 칸. 키는 새로 안 만든다.
 * village.js 는 같은 이름(counterOf·rollTasks·taskList·weeklyTaskInfo·checkTasks·snapshotDayMark·buildDayLog·sleepNow·
 * dayLogPending·dayLogInfo·dayLogSeen)으로 이리 넘기므로 바깥 호출(DG.village.taskList 등)은 그대로다.
 * 부르는 때는 전부 실행 중(rollDay·채집·init) — village.js 다음에 실린다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var VD = global.DG.villageData;
  function V() { return global.DG.village; }
  function st() { return V().state(); }
  function caughtCatCount(cat) { return V().caughtCatCount(cat); }

  /* ── 오늘의 일과판 (PLAN §5.1, 표준 A·H) ──────────────────────
   * 값을 내는 함수(`counterOf`·`taskList`·`weeklyTaskInfo`)는 세이브를 **읽기만**
   * 한다. 세이브가 바뀌는 곳은 `rollTasks()`(날이 바뀔 때, `rollDay()`가 부른다)
   * 와 `checkTasks()`(진행이 다 찼는지, 채집·선물·기증·잡초·배달 결과 자리마다
   * 한 줄씩 부른다) 둘뿐이다.
   */

  /** 일과 종류별 지금 값 — 전부 **팔아도 줄지 않는 누계**(`caughtCatCount`·
   *  `s.gathered`·`s.giftTotal`·`s.donateTotal`·`s.weedPulled`·`s.delivery.n`) */
  function counterOf(kind, cat) {
    var s = st();
    if (kind === 'gather') { return cat ? caughtCatCount(cat) : (s.gathered || 0); }
    if (kind === 'gatherAny') { return s.gathered || 0; }
    if (kind === 'gift') { return s.giftTotal || 0; }
    if (kind === 'donate') { return s.donateTotal || 0; }
    if (kind === 'weed') { return s.weedPulled || 0; }
    if (kind === 'deliver') { return (s.delivery && s.delivery.n) || 0; }
    if (kind === 'fest') { return global.DG.festival ? global.DG.festival.counter() : 0; }   // 행사날 놀이(PLAN §5.6)
    return 0;
  }

  /** 날이 바뀔 때만 부른다(`rollDay()` 안에서) — 오늘 셋 + 이번 주 하나를 새로 뽑는다.
   *  행사일이면 셋째(탐험) 줄이 그 행사 전용 과제로 바뀐다(§5.1 "행사날은 1줄 고정") */
  function rollTasks(d) {
    var s = st();
    var picks = VD.pickDayTasks(d).slice();
    var ev = VD.eventOf();     // town.js 의 event()와 같은 결 — 날짜 밀기(dayShift)는 아직 안 탄다
    var evTask = VD.eventTaskOf(ev);
    if (evTask) { picks[2] = evTask; }
    var allDoneBefore = s.tasks && s.tasks.list && s.tasks.list.length &&
      s.tasks.list.every(function (t) { return t.done; }) &&
      (!s.tasks.weekly || s.tasks.weekly.done);
    s.tasks = {
      day: d,
      list: picks.map(function (p) {
        return { key: p.key, name: p.name, kind: p.kind, cat: p.cat || null,
          need: p.n, reward: p.reward, base: counterOf(p.kind, p.cat), done: false };
      }),
      week: s.tasks ? s.tasks.week : null,
      weekly: s.tasks ? s.tasks.weekly : null,
      streak: allDoneBefore ? ((s.tasks && s.tasks.streak) || 0) + 1 : 0
    };
    var wk = global.DG.turnip ? global.DG.turnip.week(d) : Math.floor(d / 7);
    if (s.tasks.week !== wk || !s.tasks.weekly) {
      var wp = VD.pickWeekTask(wk);
      s.tasks.week = wk;
      s.tasks.weekly = { key: wp.key, name: wp.name, kind: wp.kind,
        need: wp.n, reward: wp.reward, base: counterOf(wp.kind, null), done: false };
    }
  }

  /** 화면이 보는 오늘 셋 — 진행·완료 여부까지 얹어 순수하게 낸다 */
  function taskList() {
    var s = st();
    if (!s.tasks || !s.tasks.list) { return []; }
    return s.tasks.list.map(function (t, i) {
      var have = Math.max(0, counterOf(t.kind, t.cat) - t.base);
      return { i: i, key: t.key, name: t.name, got: Math.min(have, t.need), need: t.need,
        pct: Math.min(100, Math.round(have / t.need * 100)), done: !!t.done };
    });
  }

  /** 화면이 보는 이번 주 과제 */
  function weeklyTaskInfo() {
    var s = st();
    if (!s.tasks || !s.tasks.weekly) { return null; }
    var w = s.tasks.weekly;
    var have = Math.max(0, counterOf(w.kind, null) - w.base);
    return { key: w.key, name: w.name, got: Math.min(have, w.need), need: w.need,
      pct: Math.min(100, Math.round(have / w.need * 100)), done: !!w.done };
  }

  function applyTaskReward(t) {
    core.save.player.gold += t.reward;
    core.gainFeat(2, '일과');
    core.log('✅ 일과 완료 — ' + t.name + ' · 🪙 +' + core.fmt(t.reward), 'good');
    core.emit('toast', '✅ ' + t.name + ' · 🪙 +' + t.reward);
  }

  /**
   * 진행이 다 찼는지 살핀다 — 채집(bagAdd)·선물(giveGift)·기증(museum.donate)
   * ·잡초(pullWeed)·배달(talkCourier) 결과 자리마다 한 줄씩 부른다.
   */
  function checkTasks() {
    var s = st();
    if (!s.tasks) { return []; }
    var filled = [], i;
    for (i = 0; i < (s.tasks.list || []).length; i++) {
      var t = s.tasks.list[i];
      if (t.done) { continue; }
      if (counterOf(t.kind, t.cat) - t.base >= t.need) { t.done = true; applyTaskReward(t); filled.push(t); }
    }
    var w = s.tasks.weekly;
    if (w && !w.done && counterOf(w.kind, null) - w.base >= w.need) {
      w.done = true; applyTaskReward(w); filled.push(w);
    }
    if (filled.length) { core.emit('changed'); }
    return filled;
  }

  /**
   * 하루 마무리 카드(§5.2, 표준 B)의 재료 — 날이 바뀔 때(`rollDay()`)만 다룬다.
   *   `snapshotDayMark()`  새 하루가 열리자마자 "그 시점" 값을 박아 둔다
   *   위 값과 **오늘 끝난 시점**(다음 rollDay() 첫머리) 값의 차이가 dayLog 다
   */
  function snapshotDayMark() {
    var s = st();
    s.dayMark = {
      gathered: s.gathered || 0,
      gold: core.save.player.gold,
      donated: s.donateTotal || 0,
      friend: JSON.parse(JSON.stringify(s.friend || {})),
      rating: global.DG.town ? global.DG.town.beauty().score : 0
    };
  }

  function buildDayLog(prevDay) {
    var s = st(), mark = s.dayMark;
    if (!mark) { return; }
    var bestId = null, bestUp = 0, id2;
    for (id2 in (s.friend || {})) {
      if (!Object.prototype.hasOwnProperty.call(s.friend, id2)) { continue; }
      var up = (s.friend[id2] || 0) - (mark.friend[id2] || 0);
      if (up > bestUp) { bestUp = up; bestId = id2; }
    }
    s.dayLog = {
      date: prevDay,
      gathered: Math.max(0, (s.gathered || 0) - mark.gathered),
      gold: core.save.player.gold - mark.gold,
      donated: Math.max(0, (s.donateTotal || 0) - mark.donated),
      metId: bestId, metUp: bestUp,
      ratingBefore: mark.rating, ratingAfter: global.DG.town ? global.DG.town.beauty().score : mark.rating,
      shown: false
    };
  }

  /**
   * §5.1 트리거 ① — 침구(요) 상호작용 "오늘을 마친다".
   * **`rollDay()`를 부르지 않는다**(실시간 규칙, PLAN §5.1) — 날짜·과제·
   * 마을은 그대로 두고, 지금까지 쌓인 값만 `buildDayLog()`로 미리 카드에
   * 띄워 본다. 자정이 넘으면 `rollDay()`가 다시 온전한 하루치로 갈아 낸다.
   */
  function sleepNow() {
    buildDayLog(st().day);
    core.persist();
    return { kind: 'sleep', text: '🛌 오늘을 돌아봅니다' };
  }

  /** 화면이 보는 어제 요약 — 아직 안 보여줬으면 true */
  function dayLogPending() { var l = st().dayLog; return !!(l && !l.shown); }
  /** 오늘 첫 일과 미리보기 = "내일 한 가지" */
  function dayLogInfo() {
    var l = st().dayLog;
    if (!l) { return null; }
    var next = taskList()[0];
    return {
      gathered: l.gathered, gold: l.gold, donated: l.donated,
      metId: l.metId, metUp: l.metUp,
      ratingBefore: l.ratingBefore, ratingAfter: l.ratingAfter,
      next: next ? next.name : null
    };
  }
  function dayLogSeen() { var l = st().dayLog; if (l) { l.shown = true; } }

  global.DG = global.DG || {};
  global.DG.villageTasks = {
    counterOf: counterOf, rollTasks: rollTasks, taskList: taskList, weeklyTaskInfo: weeklyTaskInfo, checkTasks: checkTasks,
    snapshotDayMark: snapshotDayMark, buildDayLog: buildDayLog, sleepNow: sleepNow,
    dayLogPending: dayLogPending, dayLogInfo: dayLogInfo, dayLogSeen: dayLogSeen
  };
})(window);
