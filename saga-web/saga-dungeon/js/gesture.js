/**
 * gesture.js — 몸짓(身振, PLAN §5.16) — 마을 사람·동행이 일과 명령에 맞춰 움직인다
 *
 * 왜 있나: 마을 사람 일곱은 늘 'idle' 로 서 있고, 동행은 걷기·치기뿐이었다 —
 * 대장간에서 세공을 해도 야장은 가만있고, 서명 무예를 질러도 동행은 모른 척했다.
 * 사가천하 §5-10 ② "태수 명령 몸짓" 과 같은 결로, **화면 층만** 바꾼다(판정·세이브 없음).
 *
 *   ① 인사   — 마을 사람에게 닿으면(town:npc) 그 사람이 손짓 + 👋 (1.0초)
 *   ② 일     — 그 사람이 연 시트에서 무엇을 하면(changed) 그 사람 일 몸짓 + 일 글자 (1.6초)
 *              야장은 망치질(attack)·행상은 흥정(interaction)… 표 `JOB`
 *   ③ 틈틈이 — 아무 일 없을 때도 사람마다 7~11초에 한 번 1.4초씩 제 일을 한다(글자 없음).
 *              주기·어긋남은 키 해시로 정해 늘 같다(Math.random 없음)
 *   ④ 호응   — 동행이 선두의 서명 무예에 맞춰 친다(❗ 호응 0.8초), 보스·우두머리·명소 주인을
 *              잡거나 레벨이 오르면 환호(🎉, jump 1.4초·통통 튐)
 *
 * 걷거나 치는 중(base 가 walk·run·attack·dodge·hit)인 배우는 몸짓 대신 제 동작을 그대로 두고
 * 글자만 띄운다 — 걸으며 제자리 손짓을 하면 미끄러져 보인다.
 * 손잡이 `dungeon.gesture`(기본 1, 0 이면 예전 그대로 — 몸짓·글자 없음).
 */
(function (global) {
  'use strict';

  var core = function () { return global.DG.core; };

  /** 마을 사람 일 — slot 은 asset3d SLOTS 이름(없는 클립은 mapClips 가 가까운 것으로 갈음) */
  var JOB = {
    captain:       { work: 'attack',      glyph: '⚔️', verb: '시범' },
    quarter:       { work: 'interaction', glyph: '📦', verb: '셈' },
    master:        { work: 'attack',      glyph: '📜', verb: '가르침' },
    smith:         { work: 'attack',      glyph: '🔨', verb: '벼림' },
    pedlar:        { work: 'interaction', glyph: '💰', verb: '흥정' },
    scribe:        { work: 'interaction', glyph: '✍️', verb: '적음' },
    herald:        { work: 'interaction', glyph: '📢', verb: '방문' },
    fieldmerchant: { work: 'interaction', glyph: '💰', verb: '흥정' },
    /* 세 시대 마을 손님(§5.20, town.js ERA_FOLK) */
    courier:       { work: 'interaction', glyph: '📦', verb: '배달' },
    officeworker:  { work: 'interaction', glyph: '📱', verb: '통화' },
    timetraveler:  { work: 'interaction', glyph: '⌛', verb: '좌표' },
    explorer:      { work: 'interaction', glyph: '📡', verb: '측정' }
  };

  /** 몸짓 갈래 — dur 초, slot 이 null 이면 그 사람 일(JOB.work) */
  var KIND = {
    greet: { dur: 1.0, slot: 'interaction', text: '👋' },
    serve: { dur: 1.6, slot: null,          text: null },
    rally: { dur: 0.8, slot: 'attack',      text: '❗ 호응' },
    sig:   { dur: 1.0, slot: 'attack',      text: '✨ 서명' },
    cheer: { dur: 1.4, slot: 'jump',        text: '🎉', bob: true }
  };

  var WORK_MIN = 7, WORK_SPAN = 5, WORK_DUR = 1.4;
  /** 이 동작 중이면 몸짓으로 덮지 않는다(글자만 띄운다) */
  var BUSY = { walk: 1, run: 1, sprint: 1, attack: 1, dodge: 1, hit: 1, death: 1 };

  var cues = {};          // key → { kind, t0, dur, slot, text, bob }
  var serving = null;     // { key, sheet } — 닿아서 연 시트의 주인

  function on() { var C = core(); return !C || !C.tuned || C.tuned('dungeon.gesture', 1) ? true : false; }
  function clock() { return Date.now() / 1000; }

  function hash(s) {
    var h = 2166136261, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /** ③ 틈틈이 — 이 사람의 주기(초)와 어긋남(초). 키가 같으면 늘 같다 */
  function workCycle(key) {
    var h = hash(key), period = WORK_MIN + (h % WORK_SPAN);
    return { period: period, offset: ((h >>> 5) % 1000) / 1000 * period };
  }
  function inWork(key, now) {
    if (!JOB[key]) { return false; }
    var c = workCycle(key), ph = (now + c.offset) % c.period;
    return ph >= 0 && ph < WORK_DUR;
  }

  function cue(key, kind, now, text) {
    if (!on() || !KIND[kind] || !key) { return null; }
    var K = KIND[kind], job = JOB[key];
    var slot = K.slot || (job ? job.work : 'interaction');
    var tx = text || K.text || (job ? job.glyph + ' ' + job.verb : '');
    var t0 = now === undefined ? clock() : now;
    cues[key] = { kind: kind, t0: t0, dur: K.dur, slot: slot, text: tx, bob: !!K.bob };
    return cues[key];
  }

  function active(key, now) {
    var c = cues[key];
    if (!c) { return null; }
    if (now < c.t0 || now >= c.t0 + c.dur) { if (now >= c.t0 + c.dur) { delete cues[key]; } return null; }
    return c;
  }

  /**
   * 이번 프레임 이 배우의 몸짓 — 순수(주어진 now 로만 정한다).
   * @param {string} key   NPC 키 또는 'ally'
   * @param {number} now   초
   * @param {string} base  몸짓이 없을 때의 동작(idle·walk·attack…)
   * @param {boolean} npc  마을 사람이면 ③ 틈틈이 일이 붙는다
   * @return {{slot:string, text:string, k:number, bob:number, kind:string}}
   */
  function plan(key, now, base, npc) {
    var b = base || 'idle';
    if (!on()) { return { slot: b, text: '', k: 0, bob: 0, kind: '' }; }
    var c = active(key, now);
    if (c) {
      var k = (now - c.t0) / c.dur;
      return {
        slot: BUSY[b] ? b : c.slot, text: c.text, k: k, kind: c.kind,
        bob: c.bob && !BUSY[b] ? Math.abs(Math.sin(k * Math.PI * 3)) : 0
      };
    }
    if (npc && !BUSY[b] && inWork(key, now)) { return { slot: JOB[key].work, text: '', k: 0, bob: 0, kind: 'work' }; }
    return { slot: b, text: '', k: 0, bob: 0, kind: '' };
  }

  function sheetNow() {
    var U = global.DG.ui;
    return U && U.openTab ? U.openTab() : null;
  }

  /** 사건 → 몸짓. 묶음(bind)이 부르고, 진단이 now 를 넣어 곧장 부른다 */
  function onEvent(name, p, now) {
    var t = now === undefined ? clock() : now;
    if (name === 'town:npc') {
      if (!p || !p.key) { return null; }
      serving = { key: p.key, sheet: p.sheet || null };
      return cue(p.key, 'greet', t);
    }
    if (name === 'changed') {
      if (!serving) { return null; }
      var sh = sheetNow();
      if (!sh || (serving.sheet && sh !== serving.sheet)) { serving = null; return null; }
      var cur = active(serving.key, t);
      if (cur && cur.kind === 'serve') { return null; }
      return cue(serving.key, 'serve', t);
    }
    if (name === 'dungeon:skill') {
      if (typeof p !== 'string') { return null; }
      if (p.indexOf('ally:') === 0) { return cue('ally', 'sig', t, /:combo$/.test(p) ? '⚡ 합격' : null); }   // §5.17 동행 서명
      return p.indexOf('sig:') === 0 ? cue('ally', 'rally', t) : null;
    }
    if (name === 'hero:levelup') { return cue('ally', 'cheer', t, '🎉 경하'); }
    if (name === 'dungeon:kill') { return p && p.e && p.e.boss ? cue('ally', 'cheer', t, '🎉 이겼다') : null; }
    if (name === 'regionboss:kill' || name === 'worldboss:kill' || name === 'dungeon:fixed') {
      return cue('ally', 'cheer', t, '🎉 이겼다');
    }
    return null;
  }

  var EVENTS = ['town:npc', 'changed', 'dungeon:skill', 'hero:levelup', 'dungeon:kill',
    'regionboss:kill', 'worldboss:kill', 'dungeon:fixed'];
  function bind() {
    var C = core();
    if (!C || !C.on) { return; }
    EVENTS.forEach(function (n) { C.on(n, function (p) { onEvent(n, p); }); });
  }

  function reset() { cues = {}; serving = null; }

  global.DG = global.DG || {};
  global.DG.gesture = {
    JOB: JOB, KIND: KIND, WORK_DUR: WORK_DUR, EVENTS: EVENTS,
    on: on, cue: cue, plan: plan, onEvent: onEvent, workCycle: workCycle, inWork: inWork,
    serving: function () { return serving; }, reset: reset
  };
  bind();
})(window);
