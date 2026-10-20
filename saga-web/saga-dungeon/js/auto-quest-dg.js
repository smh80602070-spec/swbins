/**
 * 2나락 자동 퀘스트 어댑터(W-0338) — 공용 DG.autoquest 에 "지금 목표 목록"을 주고, 실행은 있던 🤖 자동 순회(📜 퀘스트 깃발)에 맡긴다.
 * 규칙을 새로 만들지 않는다(auto.js 원칙) — 공개 함수만: quest.status · auto._questFieldGoal/_mainReq/setOn/state · town.raw · dungeon.active.
 *   목표 차례 = 자동이 실제로 고르는 차례: ① 들판 사연 걸음(가장 가까운 것) ② 메인 퀘스트(던전) ③ 지역 의뢰·이벤트·무작위(순회가 저절로 채움)
 *   ▶ #aq-go(목표판 #goals 오른쪽 아래) · 이동 키·땅 탭·조이스틱 = 멈춤 · 던전 안은 던전 자동이 맡아 막힘을 안 센다 · 끝나면 원래 자동 상태로
 */
(function (global) {
  'use strict';
  var core = global.DG.core, AQ = global.DG.autoquest;
  if (!AQ) { return; }
  var STEP_TYPE = ['kill', 'go', 'kill', 'kill'];          // 사연 걸음 0 토벌 · 1 흔적 · 2 정예 · 3 우두머리
  function strip(s) { return String(s || '').replace(/\s*\d+\/\d+$/, ''); }
  function goals() {
    var Q = global.DG.quest, A = global.DG.auto, T = global.DG.town, out = [];
    if (!Q || !Q.status) { return out; }
    var st = Q.status(), tr = T && T.raw ? T.raw() : null;
    var fg = A && A._questFieldGoal && tr && !global.DG.dungeon.active() ? A._questFieldGoal(tr) : null;
    var chs = (st.chains || []).filter(function (c) { return !c.locked && !c.done; });
    if (fg) {
      var ch = chs.filter(function (c) { return fg.label.indexOf(c.title) >= 0; })[0];
      out.push({ id: ch ? 'ch:' + ch.key + ':' + ch.step : 'field:' + strip(fg.label), type: ch ? STEP_TYPE[ch.step] || 'go' : 'go', label: strip(fg.label), x: fg.x, y: fg.y, left: ch ? ch.need - ch.have : 1 });
    }
    if (st.main) { out.push({ id: 'main:' + st.mainIdx, type: 'enter', label: '⚔️ ' + st.main.name, x: null, y: null, left: st.main.need - st.main.have }); }
    chs.forEach(function (c) { var id = 'ch:' + c.key + ':' + c.step; if (!out.some(function (g) { return g.id === id; })) { out.push({ id: id, type: STEP_TYPE[c.step] || 'go', label: (c.emoji || '📜') + ' ' + c.title + ' · ' + c.stepName, x: null, y: null, left: c.need - c.have }); } });
    (st.regions || []).forEach(function (r, i) { if (!r.locked && !r.done) { out.push({ id: 'rg:' + i, type: 'kill', label: '🗺️ ' + r.name, x: null, y: null, left: r.need - r.have }); } });
    if (st.event) { out.push({ id: 'ev:' + st.event.name, type: 'kill', label: '🎪 ' + st.event.name, x: null, y: null, left: st.event.need - st.event.have }); }
    return out;
  }
  function pos() { var T = global.DG.town, tr = T && T.raw ? T.raw() : null; return tr && tr.player ? tr.player : null; }
  function busy() {
    return !!(global.DG.dungeon.active() || (document.body && document.body.classList.contains('sheet-open')) || (global.DG.ui && global.DG.ui.cutsceneOn && global.DG.ui.cutsceneOn()));
  }
  var prev = null;
  function begin(g) {
    var A = global.DG.auto, s = A.state();
    prev = { on: !!s.on, quest: !!s.quest };
    s.quest = true;
    if (!A.active()) { A.setOn(true); }
    core.log('▶ 자동 퀘스트 — ' + (g.label || g.id), 'info');
  }
  function end(why) {
    var A = global.DG.auto;
    if (prev) { if (!prev.on && A.active()) { A.setOn(false); } A.state().quest = prev.quest; prev = null; }
    core.emit('toast', '⏸ 자동 퀘스트 — ' + (why || '멈춤'));
  }
  function run() { var A = global.DG.auto; if (!A.active()) { A.setOn(true); } return A.status().doing; }
  function unstick(n, g) {
    var T = global.DG.town, p = pos(), a = Math.random() * Math.PI * 2, r = (2 + n) * 160;   // 2나락 마을 걸음 158보/초 — 2~5초 거리
    if (p && T && T.moveTo) { T.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    core.log('🤖 막힘 ' + n + ' — ' + (g.label || g.id) + ' · 옆으로 비켜 간다', 'warn');
  }
  var q = AQ.make({ goals: goals, run: run, pos: pos, busy: busy, begin: begin, end: end, unstick: unstick, unit: 20 });
  function stopOn(t) { return !!(t.tagName === 'CANVAS' || (t.closest && t.closest('#dg-joy'))); }
  var btn = null, acc = 0;
  function update(dt) {
    q.tick(dt);
    acc += dt;
    if (acc < 0.25) { return; }
    acc = 0;
    if (!btn) { btn = AQ.button(q, 'aq-go', { on: '자동 퀘스트 멈춤', off: '자동 퀘스트 — 이 목표를 끝까지 대신(이동 조작하면 멈춤)' }, function () { return document.getElementById('goals'); }); }
    if (btn) { btn.paint(!!(global.DG.town && global.DG.town.active && global.DG.town.active() && goals().length)); }
  }
  if (typeof document !== 'undefined') { AQ.watchInput(q, { stopOn: stopOn }); }
  global.DG.autoQuestDg = { q: q, goals: goals, update: update, start: q.start, stop: q.stop, status: q.status, _busy: busy };
})(window);
