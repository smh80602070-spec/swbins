/**
 * 시나리오 엔진 — 사가스토리 "이름 없는 떠돌이" 장(章) 진행
 * ---------------------------------------------------------------
 * 표는 `data-scenario.js`(CHAPTERS·SCENES). 여기는 **지금 어느 장 몇째 단계인지**를 세이브에 적고,
 * 그 단계가 채워졌는지 물어보며 하나씩 넘긴다. 새 시스템을 만들지 않는다 — 단계는 기존 것을 시킨다:
 *   stage   사냥터에 들어선다(`side:enter`·`side:travel`)
 *   talk    대사 장면 — `story.js` 의 검은 띠 장면(`DG.story.play`)
 *   mission 사명(`quest.js`) — 레벨이 되면 저절로 받고, 바치면 넘어간다
 *   gate    관문 대장(`side.js` gateWeek) — 그 마을 대장을 이긴 적이 있으면 넘어간다
 *   rift    비경(`rift.js`) — 이 단계가 시작된 뒤 5층을 끝까지 깨면(`riftStat.clears` 가 늘면) 넘어간다
 *   job     전직(`job.js`) — 그 차수 이상이면 넘어간다
 *
 * 세이브: `core.save.scenario = { v, init, done:{장id:1}, ch, step, said:{장면id:1}, titles:[] }`
 *   없으면 빈 것으로 본다(마이그레이션 불필요). **옛 세이브**는 장의 `legacy`(레벨 또는 전직 차수)를
 *   넘었으면 그 장을 보상 없이 끝낸 것으로 본다 — 지나온 길을 다시 걷게 하지 않는다.
 * 끄는 법: `window.DG_NO_SCENARIO = true`(진단이 기본으로 켠다).
 * 손잡이: 장면은 `DG_NO_STORY` 이거나 자동 순행 중이면 안 뜨고 미뤄진다(다음 'changed' 에 다시 본다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var busy = false;          // check() 재진입 막기 — 보상·저장이 'changed' 를 다시 부른다
  var sceneOpen = false;     // 지금 떠 있는 장면이 이 엔진 것인가

  function CD() { return global.DG.scenarioData; }
  function on() { return !global.DG_NO_SCENARIO; }

  function raw() {
    var s = core.save;
    if (!s.scenario || typeof s.scenario !== 'object') { s.scenario = {}; }
    var sc = s.scenario;
    if (!sc.done || typeof sc.done !== 'object') { sc.done = {}; }
    if (!sc.said || typeof sc.said !== 'object') { sc.said = {}; }
    if (!Array.isArray(sc.titles)) { sc.titles = []; }
    if (typeof sc.step !== 'number') { sc.step = 0; }
    if (!sc.init) {
      sc.init = 1;
      /* 옛 세이브 — 그 장의 legacy(레벨·전직 차수)를 넘었다면 지나온 길 */
      var lv = core.save.player.level, tier = jobTier();
      CD().CHAPTERS.forEach(function (c) {
        var g = c.legacy;
        if (g && (lv >= g.level || (g.tier && tier >= g.tier))) { sc.done[c.id] = 1; }
      });
      sc.ch = null; sc.step = 0;
    }
    return sc;
  }

  /** 아직 안 끝낸 첫 장 — 없으면 null(지금 있는 이야기는 다 봤다) */
  function current() {
    var s = raw(), L = CD().CHAPTERS;
    for (var i = 0; i < L.length; i++) { if (!s.done[L[i].id]) { return L[i]; } }
    return null;
  }

  function opened(ch) {
    return core.save.player.level >= (ch.need || 1) && (!ch.after || !!raw().done[ch.after]);
  }

  function stageName(key) {
    var SD = global.DG.sideData, list = SD.STAGES;
    for (var i = 0; i < list.length; i++) { if (list[i].key === key) { return list[i].name; } }
    return key;
  }

  function jobTier() {
    var j = global.DG.job && global.DG.job.cur();
    return j ? (j.tier || 0) : 0;
  }

  function clears() { return (core.save.riftStat && core.save.riftStat.clears) || 0; }

  function runStage() {
    var r = global.DG.side.raw && global.DG.side.raw();
    return r && r.stage ? r.stage.key : null;
  }

  function stepDone(step) {
    var Q = global.DG.quest;
    if (step.t === 'stage') { return runStage() === step.stage; }
    if (step.t === 'talk') { return !!raw().said[step.scene]; }
    if (step.t === 'mission') { return !!Q && Q.doneCount(step.quest) > 0; }
    if (step.t === 'job') { return jobTier() >= step.tier; }
    if (step.t === 'gate') { return !!(global.DG.side.state().gateWeek || {})[step.stage]; }
    if (step.t === 'rift') { var b = raw().riftBase; return typeof b === 'number' && clears() > b; }
    return true;
  }

  function scenePlayable(step) {
    if (step.at && runStage() !== step.at) { return false; }
    return true;
  }

  /** 이 단계를 시작한다 — 사명은 받고, 장면은 띄운다(못 띄우면 다음 'changed' 에 다시) */
  function begin(step) {
    var Q = global.DG.quest, ST = global.DG.story, d;
    if (step.t === 'rift' && typeof raw().riftBase !== 'number') { raw().riftBase = clears(); core.persist(); }
    if (step.t === 'mission' && Q) {
      d = global.DG.questData.find(step.quest);
      if (d && !Q.taken(step.quest) && core.save.player.level >= d.need) { Q.take(step.quest); }
    } else if (step.t === 'talk' && ST && !ST.isOpen() && scenePlayable(step)) {
      var sc = CD().SCENES[step.scene];
      if (step.at && ST.markSeen) { ST.markSeen(step.at); }
      if (sc && ST.play('scn:' + step.scene, sc.title, sc.lines, function () {
        sceneOpen = false;
        raw().said[step.scene] = 1;
        core.persist();
        check();
      })) { sceneOpen = true; }
    }
  }

  function grant(rw) {
    var bits = [];
    if (rw.exp) { core.gainExp(rw.exp); bits.push('경험치 ' + core.fmt(rw.exp)); }
    if (rw.gold) { core.save.player.gold += rw.gold; bits.push('🪙 ' + core.fmt(rw.gold)); }
    if (rw.memFrag) { core.save.player.memFrag = (core.save.player.memFrag || 0) + rw.memFrag; bits.push('🧩 기억 조각 ' + rw.memFrag); }
    if (rw.potion && global.DG.side) { global.DG.side.state().potions += rw.potion; bits.push('🧪 ' + rw.potion); }
    if (rw.scroll && global.DG.gear) {
      global.DG.gear.addScroll(rw.scroll, 1);
      bits.push('📜 ' + global.DG.gearData.scroll(rw.scroll).name);
    }
    if (rw.title) {
      var t = rw.title === 'job'
        ? '이름 없는 ' + (global.DG.job.cur().name || '떠돌이').replace(/\(.*\)$/, '')
        : rw.title;
      var s = raw();
      if (s.titles.indexOf(t) < 0) { s.titles.push(t); }
      bits.push('🏷️ 칭호 「' + t + '」');
    }
    return bits;
  }

  function finish(ch) {
    var s = raw();
    var bits = grant(ch.reward || {});
    s.done[ch.id] = 1;
    s.ch = null; s.step = 0;
    core.log('📖 제' + ch.no + '장 · ' + ch.title + ' — ' + (bits.join(' · ') || '끝'), 'good');
    core.emit('toast', '📖 제' + ch.no + '장 · ' + ch.title + ' 끝');
    core.emit('scenario:chapter', ch.id);
    core.persist();
    core.emit('changed');
  }

  /** 지금 단계가 채워졌으면 넘기고, 못 채웠으면 시작만 시켜 둔다 — 걸림돌이 나올 때까지 돈다 */
  function check() {
    if (!on() || busy) { return; }
    busy = true;
    try {
      for (var guard = 0; guard < 40; guard++) {
        var ch = current();
        if (!ch || !opened(ch)) { break; }
        var s = raw();
        if (s.ch !== ch.id) { s.ch = ch.id; s.step = 0; core.persist(); }
        var step = ch.steps[s.step];
        if (!step) { finish(ch); continue; }
        if (stepDone(step)) { s.step += 1; s.riftBase = undefined; core.persist(); continue; }
        begin(step);
        if (stepDone(step)) { continue; }       // 시작하자마자 채워진 것(이미 받아 둔 사명이 다 찼다는 뜻은 아님)
        break;
      }
    } finally { busy = false; }
  }

  /** 화면·목표판용 — 지금 할 일 한 줄. 이야기가 안 열렸거나 다 봤으면 null */
  function hint() {
    if (!on()) { return null; }
    var ch = current();
    if (!ch) { return null; }
    var pre = '📖 제' + ch.no + '장 · ' + ch.title;
    if (!opened(ch)) {
      var why = core.save.player.level < (ch.need || 1) ? 'Lv.' + ch.need + ' 이 되면 열린다' : '앞 장을 먼저';
      return { ch: ch, title: pre, text: why, locked: true };
    }
    var s = raw(), step = ch.steps[s.ch === ch.id ? s.step : 0];
    if (!step) { return { ch: ch, title: pre, text: '마무리', locked: false }; }
    var text = '';
    if (step.t === 'stage') { text = '🚪 ' + stageName(step.stage) + ' 으로 간다'; }
    else if (step.t === 'talk') { text = step.at ? '💬 ' + stageName(step.at) + ' 에서 말을 나눈다' : '💬 이야기를 듣는다'; }
    else if (step.t === 'job') {
      text = '🥋 무예창에서 ' + step.tier + '차 전직을 한다';
      var J = global.DG.job, JD = global.DG.jobData, why = null;
      if (J && JD) {
        JD.JOBS.forEach(function (j) { if (!why && j.tier === step.tier && j.from === core.save.job) { why = J.canJoin(j.key); } });
        if (why) { text += ' — ' + why; }
      }
    }
    else if (step.t === 'rift') {
      var RF = global.DG.rift, av = RF && RF.available();
      text = '🌀 비경(사냥터 목록)에서 5층 수호장까지 깬다' + (av && !av.ok ? ' — ' + av.reason : '');
    }
    else if (step.t === 'gate') {
      var gi = global.DG.side.gateInfo(step.stage);
      text = '🏯 ' + stageName(step.stage) + ' 의 대장 「' + (gi ? gi.name : '?') + '」 에게 도전한다';
      if (gi && gi.triedToday && !gi.ready) { text += ' (오늘은 이미 붙었다 — 내일)'; }
    }
    else if (step.t === 'mission') {
      var d = global.DG.questData.find(step.quest), Q = global.DG.quest;
      if (d && core.save.player.level < d.need) { text = '📋 「' + d.name + '」 — Lv.' + d.need + ' 이 되면 받는다'; }
      else if (d && Q && Q.taken(step.quest) && Q.full(step.quest)) { text = '📋 「' + d.name + '」 — 사명창에서 바친다'; }
      else if (d) { text = '📋 「' + d.name + '」 — ' + (Q ? Q.progress(step.quest) : 0) + '/' + d.goal.n; }
    }
    return { ch: ch, title: pre, text: text, locked: false, step: step };
  }

  /** 이야기 시트용 — 장마다 { ch, state: 'done'|'now'|'wait' } */
  function list() {
    var s = raw(), cur = current(), out = [];
    CD().CHAPTERS.forEach(function (c) {
      out.push({ ch: c, state: s.done[c.id] ? 'done' : (cur && cur.id === c.id && opened(c) ? 'now' : 'wait') });
    });
    return out;
  }

  /** 첫 발 장면(story.js)이 이 사냥터 장면을 이 엔진에 맡겼는가 — 아직 안 끝낸 장에 그 사냥터에서 하는 대사가
   *  있으면 그 대사가 첫 발 장면을 대신한다(신야성 "서막" 이 제1장 안 대사가 된 것처럼). 대신한 사냥터는 본 것으로 적는다 */
  function owns(stageKey) {
    if (!on()) { return false; }
    var s = raw(), L = CD().CHAPTERS;
    for (var i = 0; i < L.length; i++) {
      if (s.done[L[i].id]) { continue; }
      for (var j = 0; j < L[i].steps.length; j++) {
        if (L[i].steps[j].t === 'talk' && L[i].steps[j].at === stageKey) { return true; }
      }
    }
    return false;
  }

  var listening = false;
  function init() {
    if (!listening) {
      listening = true;
      ['side:enter', 'side:travel', 'changed', 'questdone', 'story:change'].forEach(function (e) {
        core.on(e, function () { if (!sceneOpen) { check(); } });
      });
    }
    check();
  }

  global.DG = global.DG || {};
  global.DG.scenario = {
    init: init, check: check, current: current, hint: hint, list: list, owns: owns, on: on,
    state: raw, titles: function () { return raw().titles.slice(); },
    /** 진단·어드민용 — 진행을 지운다(옛 세이브 판정도 다시 한다) */
    reset: function () { core.save.scenario = undefined; sceneOpen = false; }
  };
})(window);
