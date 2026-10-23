/**
 * 3마을 자동 퀘스트 어댑터(W-0338) — 공용 DG.autoquest 에 "지금 목표 목록"을 주고, 실행은 있던 🤖 자동 마을살이(auto.js)에 맡긴다.
 * 규칙을 새로 만들지 않는다 — 공개 함수만: village.raw/requestOf/bagCount/questProgress · villageData.item/QUESTS · auto.setOn/state.
 *   목표 = ① 주민 부탁(가방에 이미 있는 것 먼저 — 건네기만 하면 되니) ② 마을 일(questProgress — 갈래 모으기·상자·사람 만나기)
 *   자동 마을살이가 채집하고, 부탁 몫이 차면 건넨다(🤝 심부름 깃발) · ▶ #aq-go(지갑 오른쪽 아래) · 이동 키·땅 탭·조이스틱 = 멈춤
 */
(function (global) {
  'use strict';
  var core = global.DG.core, AQ = global.DG.autoquest;
  if (!AQ) { return; }
  function V() { return global.DG.village; }
  /** 그 갈래를 지금 자동 마을살이가 구할 수 있나(W-0383) — 벌레 = 잠자리채, 나머지 = 마을에 그 갈래를 내는 사물(장식 아님)이 있고 도구가 있음(화석 = 삽).
      못 구하는 부탁이 맨 앞을 막아 첫 10분 내내 같은 목표였다(화석·거미·옛 동전) — 규칙은 auto.js freshProp·nearBug 그대로 */
  function canGet(cat, raw) {
    if (cat === 'bug') { return !!(global.DG.bug && global.DG.bug.hasNet && global.DG.bug.hasNet()); }
    var PR = global.DG.villageData.PROPS, props = (raw && raw.props) || [];
    for (var i = 0; i < props.length; i++) {
      var def = PR[props[i].kind];
      if (def && def.gather === cat && !props[i].deco && (!def.tool || V().hasTool(def.tool))) { return true; }
    }
    return false;
  }
  /* 오래 그대로인 부탁 돌리기(W-0383) — 갈래 안 무작위라(고둥) 낚시는 하는데 셈이 4분 넘게 0 이었다.
     **지금 목표인 동안** 셈이 STALE 넘게 안 늘면 마을 일 뒤로(셈이 늘면 다시 앞). 저장 안 함 */
  var STALE = 120000, seen = {}, lastAt = 0;
  function stale(id, have) {
    var now = Date.now(), dt = lastAt ? Math.min(now - lastAt, 2000) : 0, cur = q && q.status().goal, s = seen[id];
    if (!s || s.have !== have) { s = seen[id] = { have: have, ms: 0 }; }
    else if (cur && cur.id === id) { s.ms += dt; }
    return s.ms > STALE;
  }
  function goals() {
    var raw = V() && V().raw ? V().raw() : null, VD = global.DG.villageData, out = [];
    if (!raw || !raw.residents) { return out; }
    raw.residents.forEach(function (res) {
      var req = V().requestOf(res.id);
      if (!req || req.done) { return; }
      var it = VD.item(req.want), have = V().bagCount(req.want), full = have >= req.n, ok = full || !!(it && canGet(it.cat, raw)), id = 'rq:' + res.id + ':' + req.want, old = !full && ok && stale(id, have);
      out.push({ id: id, type: 'collect', label: '🤝 ' + (res.ref && res.ref.name || res.id) + ' — ' + (it ? it.name : req.want) + ' ' + Math.min(have, req.n) + '/' + req.n + (ok ? (old ? ' (2분째 그대로 — 뒤로)' : '') : ' (지금 자동으로 못 구함 — 뒤로)'),
        x: res.x, y: res.y, left: Math.max(0, req.n - have), o: full ? 0 : ok && !old ? 1 : 3 });   // 못 구하는·오래 그대로인 부탁은 마을 일(2) 뒤
    });
    Object.keys((VD && VD.QUESTS) || {}).forEach(function (k) {
      var p = V().questProgress(k);
      if (!p || p.done) { return; }
      var Qk = VD.QUESTS[k], can = Qk.type !== 'bagcat' || canGet(Qk.cat, raw), oldV = can && stale('vq:' + k, p.have);   // 마을 일도 못 구함(버섯숲 밖 약초)·오래 그대로면 뒤로(첫 10분 다섯 판 점검)
      out.push({ id: 'vq:' + k, type: Qk.type === 'meetnpc' ? 'talk' : 'collect', label: '📜 ' + (Qk.title || k) + ' ' + Math.min(p.have, p.need) + '/' + p.need + (can ? (oldV ? ' (2분째 그대로 — 뒤로)' : '') : ' (지금 자동으로 못 구함 — 뒤로)'), x: null, y: null, left: Math.max(0, p.need - p.have), o: can && !oldV ? 2 : 4 });
    });
    lastAt = Date.now();
    return out.sort(function (a, b) { return a.o - b.o; });
  }
  function pos() { var raw = V() && V().raw ? V().raw() : null; return raw && raw.player ? raw.player : null; }
  /* 낚시(입질 기다리기)·곤충(살금살금)은 제자리가 정상이다 — 10분 측정에서 낚시터에 선 것을 막힘으로 세어 ▶ 가 319초에 멈췄다 */
  function busy() { var d = global.DG.auto.status().doing || ''; return !!(/🎣|🦋|🛏️|🏠|입질|살금/.test(d) || (document.body && document.body.classList.contains('sheet-open'))); }
  var prev = null;
  function begin(g) {
    var A = global.DG.auto, s = A.state();
    prev = { on: !!s.on, errand: !!s.errand, gather: !!s.gather };
    s.errand = true; s.gather = true;
    if (!A.active()) { A.setOn(true); }
    core.log('▶ 자동 퀘스트 — ' + (g.label || g.id), 'info');
  }
  function end(why) {
    var A = global.DG.auto;
    if (prev) { if (!prev.on && A.active()) { A.setOn(false); } A.state().errand = prev.errand; A.state().gather = prev.gather; prev = null; }
    core.emit('toast', '⏸ 자동 퀘스트 — ' + (why || '멈춤'));
  }
  function run() { var A = global.DG.auto; if (!A.active()) { A.setOn(true); } return A.status().doing; }
  function unstick(n, g) {
    var p = pos(), a = Math.random() * Math.PI * 2, r = (2 + n) * 40;   // 한 칸 40 — 3~5칸 옆
    if (p && V().walkTo) { V().walkTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    core.log('🤖 막힘 ' + n + ' — ' + (g.label || g.id), 'warn');
  }
  /* 마을살이는 채집할 때 그 자리에 잠깐 선다 — 막힘은 "한 칸(40) 안에 30초" 로 잰다 */
  var q = AQ.make({ goals: goals, run: run, pos: pos, busy: busy, begin: begin, end: end, unstick: unstick, unit: 40 });
  function stopOn(t) { return !!(t.tagName === 'CANVAS' || (t.closest && t.closest('#vjoy, #vpad'))); }
  var btn = null, acc = 0;
  function update(dt) {
    q.tick(dt);
    acc += dt;
    if (acc < 0.25) { return; }
    acc = 0;
    if (!btn) { btn = AQ.button(q, 'aq-go', { on: '자동 퀘스트 멈춤', off: '자동 퀘스트 — 부탁·마을 일을 대신(이동 조작하면 멈춤)' }, function () { return document.getElementById('wallet'); }); }
    if (btn) { btn.paint(!!(q.status().on || goals().length)); }
  }
  if (typeof document !== 'undefined') { AQ.watchInput(q, { stopOn: stopOn }); }
  global.DG.autoQuestFs = { q: q, goals: goals, update: update, start: q.start, stop: q.stop, status: q.status, _busy: busy, _canGet: canGet, _seen: seen };
})(window);
