/**
 * 4종횡 자동 퀘스트 어댑터(W-0338) — 공용 DG.autoquest 에 "지금 목표 목록"을 주고, 사냥은 있던 🤖 자동 사냥(auto.js)에 맡긴다.
 * 4종횡 자동은 "지금 사냥터에서 사냥"만 했다 — 사명을 따라가려면 게시판 손짓이 더 필요해 여기서 **공개 함수로만** 한다:
 *   quest.list/take/turnIn(사람이 사명 창에서 누르는 것과 같은 길) · side.enter(사냥터 고르기와 같은 길) · auto.setOn
 *   목표 차례 = 받은 사명 중 안 찬 것(사냥터가 정해진 토벌·보스 → 밟기 → 그 밖의 토벌·채집·금·레벨 → 대화·장비·무예는 맨 뒤)
 *   목표 사냥터 = 그 사명의 사냥터, 정해지지 않았으면 갈 수 있는 가장 깊은 곳(자동 사냥과 같은 고름) · 밟기는 아직 안 밟은 열린 곳
 *   ▶ #aq-go(목표판 #goalboard 오른쪽 아래) · 이동 키·땅 탭·조작판 = 멈춤 · 15초 안에 잡은 적이 있으면 서 있어도 막힘이 아니다
 */
(function (global) {
  'use strict';
  var core = global.DG.core, AQ = global.DG.autoquest;
  if (!AQ) { return; }
  var ORDER = { kill: 0, boss: 0, visit: 1, gather: 2, gold: 2, level: 2, talk: 3, gear: 3, skill: 3 };
  var TYPE = { kill: 'kill', boss: 'kill', visit: 'go', gather: 'collect', gold: 'collect', level: 'kill', talk: 'talk', gear: 'collect', skill: 'collect' };
  function S() { return global.DG.side; }
  function deepest() { var l = S().stages(), pick = null, i; for (i = 0; i < l.length; i++) { if (l[i].open && !l[i].ref.town) { pick = l[i].ref.key; } } return pick; }
  function stageFor(it) {
    var g = it.ref.goal;
    if ((g.type === 'kill' || g.type === 'boss') && g.stage) { return S().unlocked(g.stage) ? g.stage : null; }
    if (g.type === 'visit') {
      var rec = (global.DG.quest.state()[it.ref.key] || {}).visited || {}, l = S().stages(), i;
      for (i = 0; i < l.length; i++) { if (l[i].open && !l[i].ref.town && !rec[l[i].ref.key]) { return l[i].ref.key; } }
    }
    return deepest();
  }
  function goals() {
    var Q = global.DG.quest, out = [];
    if (!Q || !Q.list) { return out; }
    Q.list().filter(function (it) { return it.taken && !it.full; }).forEach(function (it, i) {
      var g = it.ref.goal;
      out.push({ id: 'q:' + it.ref.key, type: TYPE[g.type] || 'kill', label: '📜 ' + (it.ref.name || it.ref.key) + ' ' + Math.min(it.n, it.goal) + '/' + it.goal, x: null, y: null, left: Math.max(0, it.goal - it.n),
        stage: stageFor(it), o: (ORDER[g.type] == null ? 2 : ORDER[g.type]) * 100 + i });
    });
    return out.sort(function (a, b) { return a.o - b.o; });
  }
  /* 게시판 손짓 — 받을 수 있는 건 받고, 찬 건 바친다(1초마다) */
  function board() {
    var Q = global.DG.quest, n = 0;
    Q.list().forEach(function (it) {
      if (it.full) { if (Q.turnIn(it.ref.key)) { n++; } }
      else if (!it.taken && !it.lockedToday) { Q.take(it.ref.key); }
    });
    return n;
  }
  var accB = 0, accE = 0, lastKills = 0, killT = 0;
  function run(g, dt) {
    var A = global.DG.auto;
    if (!A.active()) { A.setOn(true); }
    accB += dt; accE += dt;
    if (accB >= 1) { accB = 0; board(); }
    var r = S().raw(), cur = r && r.stage ? r.stage.key : null;
    if (g.stage && cur !== g.stage && accE >= 2 && !(r && r.talk)) { accE = 0; S().enter(g.stage); }
    return g.label + (g.stage && cur !== g.stage ? ' — ' + g.stage + ' 으로' : ' · ' + A.status().doing);
  }
  function pos() { var r = S().raw(); return r && r.player ? r.player : null; }
  function busy() {
    var r = S().raw(), k = S().status().kills || 0, now = Date.now();
    if (k !== lastKills) { lastKills = k; killT = now; }
    return !!(!r || r.talk || now - killT < 15000 || (document.body && document.body.classList.contains('sheet-open')));
  }
  var prev = null;
  function begin(g) {
    var A = global.DG.auto;
    prev = { on: !!A.state().on, hunt: !!A.state().hunt };
    A.state().hunt = true;
    board();
    if (!A.active()) { A.setOn(true); }
    core.log('▶ 자동 퀘스트 — ' + (g.label || g.id), 'info');
  }
  function end(why) {
    var A = global.DG.auto;
    if (prev) { if (!prev.on && A.active()) { A.setOn(false); } A.state().hunt = prev.hunt; prev = null; }
    core.emit('toast', '⏸ 자동 퀘스트 — ' + (why || '멈춤'));
  }
  function unstick(n, g) {
    S().jump();
    if (n >= 2 && g.stage) { S().enter(g.stage); }   // 두 번째부터는 사냥터를 새로 연다(사람이 문으로 다시 들어오는 것과 같다)
    core.log('🤖 막힘 ' + n + ' — ' + (g.label || g.id), 'warn');
  }
  var q = AQ.make({ goals: goals, run: run, pos: pos, busy: busy, begin: begin, end: end, unstick: unstick, unit: 20, prestart: board });
  function stopOn(t) { return !!(t.tagName === 'CANVAS' || (t.closest && t.closest('#touchpad'))); }
  var btn = null, acc = 0;
  function update(dt) {
    q.tick(dt);
    acc += dt;
    if (acc < 0.25) { return; }
    acc = 0;
    if (!btn) { btn = AQ.button(q, 'aq-go', { on: '자동 퀘스트 멈춤', off: '자동 퀘스트 — 사명을 받고·채우고·바치기까지 대신(이동 조작하면 멈춤)' }, function () { return document.getElementById('goalboard'); }); }
    if (btn) { btn.paint(!!(q.status().on || goals().length || global.DG.quest.list().some(function (it) { return !it.taken && !it.lockedToday; }))); }
  }
  if (typeof document !== 'undefined') { AQ.watchInput(q, { stopOn: stopOn }); }
  global.DG.autoQuestSt = { q: q, goals: goals, board: board, update: update, start: q.start, stop: q.stop, status: q.status, _busy: busy, _stageFor: stageFor };
})(window);
