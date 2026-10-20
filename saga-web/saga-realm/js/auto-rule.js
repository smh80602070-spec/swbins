/**
 * 5천하 시정 위임(W-0338) — 퀘스트가 없는 턴제라 "자동 퀘스트" 대신 **군주 목표 하나를 고르면 달마다 무장 명령을 대신 내린다**.
 * 다른 네 판과 같은 ▶ 단추·같은 공용 틀(DG.autoquest)을 쓴다 — 목표 = 고른 시정 하나, 한 박자 = 한 달(rtk:month 알림, 턴제라 프레임 루프가 없다).
 * 규칙을 새로 만들지 않는다 — 공개 함수만: rtk.readyAt/order/city/capOf/orderByKey/force/me/citiesOf/eatOf · rtkAI.bestFor/creedOf/tryEnvoy/tryWar · tech.cost.
 *   🌾 개발  — 성마다 개간·상업·기술·치안 중 상한 대비 가장 모자란 것
 *   🪖 징병  — 징병(인구 6% 까지) → 훈련 → 축성
 *   🕊️ 외교  — 달마다 사신 한 번(rtkAI.tryEnvoy — AI 가 쓰는 길), 남은 무장은 개발
 *   🚩 출진  — 징병·훈련으로 채우고, 칠 만하면 **확인 카드**(눌러야 rtkAI.tryWar)
 *   늘 먼저: 치안 45 밑이면 치안, 군량이 석 달치 밑이면 개간, 이웃 적이 8할 넘으면 징병·축성·훈련(AI 와 같은 비상선) · 금은 켠 때의 금(·성향 비축선 중 큰 것) 위로 쌓인 몫의 절반만 쓴다
 *   멈춤: ▶ 다시 누름 · 내 세력이 없어짐 · 판이 끝남(result)
 */
(function (global) {
  'use strict';
  var core = global.DG.core, AQ = global.DG.autoquest;
  if (!AQ) { return; }
  var GOALS = [
    { key: 'dev', emoji: '🌾', name: '개발' },
    { key: 'draft', emoji: '🪖', name: '징병' },
    { key: 'diplo', emoji: '🕊️', name: '외교' },
    { key: 'war', emoji: '🚩', name: '출진' }
  ];
  function R() { return global.DG.rtk; }
  function AI() { return global.DG.rtkAI; }
  function sv() { var s = core.save; if (!s.ruleAuto || typeof s.ruleAuto !== 'object') { s.ruleAuto = { goal: 'dev' }; } return s.ruleAuto; }
  function goalDef(k) { return GOALS.filter(function (g) { return g.key === k; })[0] || GOALS[0]; }
  function setGoal(k) { sv().goal = goalDef(k).key; core.persist(); paint(); return sv().goal; }
  function reserve() { var me = R().me(); return AI() && AI().creedOf ? AI().creedOf(me).keepGold : 900; }
  function costOf(key) { var me = R().me(), o = R().orderByKey(key); return o ? (global.DG.tech ? global.DG.tech.cost(me, key, o.gold) : o.gold) : 1e9; }
  /** 이 성에 이 목표로 낼 명령 하나(순수 — 상태를 안 바꾼다) */
  function pickFor(goal, cityId) {
    var c = R().city(cityId), cap = function (k) { return R().capOf(cityId, k) || 1; };
    if (c.sec < 45) { return 'sec'; }
    if (c.food < R().eatOf(cityId) * 3 && c.agri < cap('agri')) { return 'agri'; }
    /* 이웃 적 병력이 우리 병력의 8할을 넘으면 어느 목표든 지킴이 먼저(AI threatAt 과 같은 셈) — 개발만 하다 성을 잃었다(12달 진단 2성→1성) */
    var th = AI() && AI().threatAt ? AI().threatAt(R().me(), cityId) : 0;
    if (th > c.troops * 0.8) {
      if (c.troops < Math.floor(c.pop * 0.06) - 50) { return 'draft'; }
      if (c.wall < c.maxWall) { return 'wall'; }
      if (c.train < 90) { return 'train'; }
    }
    if (goal === 'draft' || goal === 'war') {
      if (c.troops < Math.floor(c.pop * 0.06) - 50) { return 'draft'; }
      if (c.train < (goal === 'war' ? 95 : 85)) { return 'train'; }
      if (c.wall < c.maxWall) { return 'wall'; }
    }
    var best = 'agri', br = 2;
    ['agri', 'comm', 'tech', 'sec'].forEach(function (k) { var r = (c[k] || 0) / cap(k); if (r < br) { br = r; best = k; } });
    return best;
  }
  /** 이 달 명령을 채운다 — 낸 명령 [{ city, key, who }] */
  function fill() {
    var me = R().me(), goal = sv().goal, out = [], f = R().force(me);
    if (!f) { return out; }
    /* 위임은 곳간을 깎지 않는다 — 켠 때의 금(과 성향 비축선 중 큰 것)이 바닥, 그 위로 쌓인 몫의 절반만 이 달에 쓴다
       (비축선만 지키게 했더니 12달에 금 3,200 → 451 — 위임 없이 굴리면 6,636 이었다) */
    var floor = Math.max(reserve(), sv().floor || 0), keep = f.gold - Math.max(0, f.gold - floor) * 0.5;
    if (goal === 'diplo' && AI().tryEnvoy && sv().envoyTurn !== R().state().turn) { sv().envoyTurn = R().state().turn; var ev = AI().tryEnvoy(me); if (ev) { out.push({ city: '-', key: 'envoy', who: '' }); } }
    R().citiesOf(me).forEach(function (cid) {
      var guard = 8;
      while (guard-- > 0) {
        var ready = R().readyAt(cid);
        if (!ready.length) { return; }
        var key = pickFor(goal, cid);
        if (f.gold - costOf(key) < keep) { return; }   // 비축선 아래로는 안 쓴다 — 위임이 나라 곳간을 비우지 않게
        var who = AI().bestFor(ready, key) || ready[0], r = R().order(cid, who.id, key);
        if (!r || !r.ok) { return; }
        out.push({ city: cid, key: key, who: who.id });
      }
    });
    sv().last = { turn: R().state().turn, n: out.length };
    return out;
  }
  /* 출진 확인 카드 — 위임이 저절로 싸움을 걸지 않는다(사용자가 눌러야 rtkAI.tryWar) */
  function warCard() {
    if (sv().goal !== 'war' || typeof document === 'undefined' || !document.body) { return; }
    var s = R().summary(R().me());
    if (!s || s.troops < 8000) { return; }
    var box = document.getElementById('aq-war');
    if (!box) { box = document.createElement('div'); box.id = 'aq-war'; document.body.appendChild(box); }
    box.style.cssText = 'position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:70;padding:10px 14px;border-radius:14px;background:rgba(12,14,20,.9);color:#fff;border:1px solid rgba(255,200,120,.5);display:flex;gap:8px;align-items:center;font-size:14px';
    box.innerHTML = '<span>🚩 병력 ' + core.fmt(s.troops) + ' — 칠 만한 성이 있으면 출진할까요?</span><button class="btn primary" data-aqw="go">출진</button><button class="btn ghost" data-aqw="no">이번 달 아님</button>';
    box.onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-aqw]');
      if (!b) { return; }
      var r = b.getAttribute('data-aqw') === 'go' ? AI().tryWar(R().me(), AI().creedOf(R().me())) : null;
      if (b.getAttribute('data-aqw') === 'go') { core.emit('toast', r ? '🚩 출진!' : '🚩 칠 만한 성이 없다 — 다음 달에 다시 본다'); }
      box.remove(); core.emit('changed');
    };
  }
  function goals() { var g = goalDef(sv().goal); return [{ id: 'rule:' + g.key, type: g.key === 'war' ? 'kill' : g.key === 'diplo' ? 'talk' : 'collect', label: g.emoji + ' ' + g.name + ' 위임', x: null, y: null, left: 1 }]; }
  function pause() {
    var st = R().state();
    if (!st.started) { return '판이 아직 없다'; }
    if (st.result) { return '판이 끝났다'; }
    if (!R().citiesOf(R().me()).length) { return '성이 없다'; }
    return null;
  }
  var lastN = 0;
  function run() { var o = fill(); lastN = o.length; warCard(); return '이 달 명령 ' + o.length + '개'; }
  function begin(g) { var f = R().force(R().me()); sv().on = true; sv().floor = f ? f.gold : 0; core.persist(); core.log('▶ 시정 위임 — ' + g.label, 'info'); }
  function end(why) { sv().on = false; core.persist(); var w = document.getElementById && document.getElementById('aq-war'); if (w) { w.remove(); } core.emit('toast', '⏸ 시정 위임 — ' + (why || '멈춤')); paint(); }
  /* 턴제 — 서 있어도 막힘이 아니다(pos 없음) */
  var q = AQ.make({ goals: goals, run: run, pause: pause, begin: begin, end: end });
  function start() { var ok = q.start(); if (ok) { q.tick(0); } paint(); return ok; }
  function stop(why) { return q.stop(why); }
  var btn = null, chips = null;
  function paint() {
    if (typeof document === 'undefined' || !document.body) { return; }
    var wal = function () { return document.getElementById('wallet'); };
    if (!btn) { btn = AQ.button(q, 'aq-go', { on: '시정 위임 멈춤', off: '시정 위임 — 고른 목표대로 달마다 무장 명령을 대신(출진은 확인 카드)', click: function () { if (q.status().on) { stop('손으로 끔'); } else { start(); } } }, wal); }
    var started = !!(R() && R().state && R().state().started && !R().state().result);
    if (btn) { btn.paint(started); }
    if (!chips) { chips = document.createElement('div'); chips.id = 'aq-rule'; document.body.appendChild(chips); chips.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-aqg]'); if (b) { setGoal(b.getAttribute('data-aqg')); } }); }
    var w = wal(), r = w ? w.getBoundingClientRect() : null, cur = sv().goal;
    var css = 'position:fixed;z-index:25;display:' + (started && btn && btn.el.style.display !== 'none' ? 'flex' : 'none') + ';gap:4px;' + (r && r.width ? 'top:' + Math.round(r.bottom + 6) + 'px;right:' + Math.round(global.innerWidth - r.right + 48) + 'px;' : 'top:120px;right:60px;');
    if (chips._k === css + cur) { return; }   // 'changed' 는 자주 온다 — 바뀔 때만 다시 그린다
    chips._k = css + cur; chips.style.cssText = css;
    chips.innerHTML =GOALS.map(function (g) { return '<button class="btn ' + (g.key === cur ? 'primary' : 'ghost') + '" data-aqg="' + g.key + '" title="' + g.name + ' 위임" style="min-height:36px;padding:2px 8px;font-size:13px">' + g.emoji + (g.key === cur ? ' ' + g.name : '') + '</button>'; }).join('');
  }
  core.on('rtk:month', function () { if (q.status().on) { q.tick(0); } paint(); });
  core.on('changed', function () { paint(); });
  global.DG.autoRule = { GOALS: GOALS, q: q, goals: goals, setGoal: setGoal, goal: function () { return sv().goal; }, pickFor: pickFor, fill: fill, start: start, stop: stop, status: q.status, reserve: reserve, paint: paint,
    /** 세이브에 켜 둔 채 다시 열면 이어서 위임한다(게임 시작 뒤 한 번) */
    resume: function () { if (sv().on && !q.status().on) { q.start(); } paint(); } };
})(window);
