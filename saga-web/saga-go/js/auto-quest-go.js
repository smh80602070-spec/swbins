/**
 * 1만리 자동 퀘스트 어댑터(W-0337) — 공용 DG.autoquest 에 "지금 목표 목록"을 주고, 실행은 있던 자동(DG.auto 📖 이야기 깃발 + 🤖 자동 전투)에 맡긴다.
 * 규칙을 새로 만들지 않는다(auto.js 첫째 원칙) — 공개 함수만: story.step/targetOf/keyOf · quest.list · auto.setOn/state · world.walkTo.
 *   목표 = ① 따라가는 줄(📖 이야기 또는 🔷 세계 임무)의 지금 단계 ② 받아 둔 일일 사명(안 끝난 것) — 순행이 저절로 채운다
 *   ▶ 단추 #aq-go(목표 줄 곁) · 아무 이동 조작(이동 키·지도 탭·조이스틱) = 멈춤 · 모두 쓰러지면 멈춤 · 끝나면 원래 자동 상태로 되돌린다
 *   막힘(30초 제자리) → auto.js 옆걸음(_sidestep) 더 멀리, 세 번 넘으면 멈추고 이유를 알린다
 */
(function (global) {
  'use strict';
  var core = global.DG.core, AQ = global.DG.autoquest;
  if (!AQ) { return; }
  /* 이야기 단계 종류 → 공용 다섯(+meet) */
  var TYPE = { gather: 'collect', cook: 'collect', domain: 'enter', boss: 'kill', duel: 'kill', defend: 'kill', kill: 'kill', go: 'go', climb: 'go', sky: 'go', follow: 'go', chase: 'go', seal: 'go', light: 'go', party: 'talk' };
  var QK = { catch: 'meet', recruit: 'meet', rare: 'meet', station: 'go', rogue: 'go', fort: 'kill', walk: 'go', letter: 'collect' };
  function typeOf(st) { var S = global.DG.story; return S && S.isTalk && S.isTalk(st) ? 'talk' : (TYPE[st.type] || 'go'); }
  function questType(kind) { return QK[kind] || 'go'; }
  function goals() {
    var S = global.DG.story, Q = global.DG.quest, out = [], st = S && S.on && S.on() ? S.step() : null;
    if (st) {
      var t = S.targetOf(st);
      out.push({ id: S.keyOf(), type: typeOf(st), label: (S.tracking() ? '🔷 ' : '📖 ') + (st.text || st.type), x: t ? t.x : null, y: t ? t.y : null,
        left: st.type === 'gather' ? Math.max(0, (st.count || 0) - S.gathered()) : 1 });
    }
    if (Q && Q.list) {
      Q.list().forEach(function (q) { if (!q.done) { out.push({ id: 'dq:' + q.key, type: questType(q.def.kind), label: q.def.emoji + ' ' + q.def.name, x: null, y: null, left: q.need - q.got }); } });
    }
    return out;
  }
  function pos() { return core.save.player.pos; }
  function busy() {
    var S = global.DG.story, FC = global.DG.fieldCombat, FS = FC && FC.state ? FC.state() : null, p = pos(), DM = global.DG.domain;
    return !!((S && S.talking && S.talking()) || (FS && FC.inCombat && FC.inCombat(FS, p.x, p.y)) || (global.DG.encounter && global.DG.encounter.active) ||
      (DM && DM.active && DM.active()) || (document.body && document.body.classList.contains('sheet-open')));
  }
  function pause() {
    var FC = global.DG.fieldCombat, FS = FC && FC.state ? FC.state() : null;
    if (FS && FS.party && FS.party.length && FS.party.every(function (m) { return m.down; })) { return '모두 쓰러짐'; }
    return null;
  }
  var prev = null;
  function begin(g) {
    var A = global.DG.auto, s = A.state();
    prev = { on: !!s.on, story: !!s.story };
    s.story = true;                          // 이야기 목표가 먼저 — 사명은 순행이 채운다
    if (!A.active()) { A.setOn(true); }
    core.log('▶ 자동 퀘스트 — ' + (g.label || g.id), 'info');
  }
  function end(why) {
    var A = global.DG.auto;
    if (prev) { if (!prev.on && A.active()) { A.setOn(false); } A.state().story = prev.story; prev = null; }
    core.emit('toast', '⏸ 자동 퀘스트 — ' + (why || '멈춤'));
  }
  function run(g) { var A = global.DG.auto; if (!A.active()) { A.setOn(true); } return A.status().doing; }
  function unstick(n, g) {
    var p = pos(), a = Math.random() * Math.PI * 2, r = 10 + 8 * n;
    if (global.DG.auto._sidestep) { global.DG.auto._sidestep(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    else if (global.DG.world && global.DG.world.walkTo) { global.DG.world.walkTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, false); }
    core.log('🤖 막힘 ' + n + ' — ' + (g.label || g.id) + ' · ' + Math.round(r) + 'm 비켜 간다', 'warn');
  }
  var q = AQ.make({ goals: goals, run: run, pos: pos, busy: busy, pause: pause, begin: begin, end: end, unstick: unstick });
  function moveKeys() { var W = global.DG.world, km = W && W.keymap ? W.keymap() : null, out = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'], k; if (km) { for (k in km) { if (out.indexOf(km[k]) < 0) { out.push(km[k]); } } } return out; }
  function stopOn(t) { return !!(t.tagName === 'CANVAS' || (t.closest && t.closest('#gjoy, #gpad'))); }
  var btn = null, acc = 0;
  function update(dt) {
    q.tick(dt);
    acc += dt;
    if (acc < 0.25) { return; }
    acc = 0;
    if (!btn) { btn = AQ.button(q, 'aq-go', { on: '자동 퀘스트 멈춤', off: '자동 퀘스트 — 이 목표를 끝까지 대신(이동 조작하면 멈춤)' }); }
    var W = global.DG.world, S = global.DG.story;
    if (btn) { btn.paint(!!(W && W.mode !== 'geo' && !(S && S.talking && S.talking()) && goals().length)); }
  }
  if (typeof document !== 'undefined') { AQ.watchInput(q, { keys: moveKeys, stopOn: stopOn }); }
  global.DG.autoQuestGo = { q: q, goals: goals, typeOf: typeOf, questType: questType, update: update, start: q.start, stop: q.stop, status: q.status, _busy: busy, _pause: pause };
})(window);
