/**
 * 시나리오 — 사가천하 "천하와 균열" 사건 카드 진행
 * ---------------------------------------------------------------
 * 표는 `data-scenario.js`(CARDS). 카드는 `event.js` 의 사연 카드(세 갈래 고르기)로 뜬다 — 이 파일은
 *   ① 표의 카드를 사연 정의(`E.addDef`)로 등록하고
 *   ② 사람 세력에게 정해진 때에 카드를 내는 원천(`E.addSource`)을 달고
 *   ③ 고른 뒤(`rtk:eventDone`) 끝낸 카드를 세이브에 적는다.
 * AI 세력에게는 안 뜬다(원천이 사람 세력만 본다). 새 판정은 없다 — 금·성 값·충성·우호 손잡이만 만진다.
 *
 * 단계(data-scenario.js STAGES) — own·debate·duel 카드는 고른 뒤 `scenario.stage = { id, kind, target, since }` 가 열리고, 끝나면 결과 카드 `<id>_end` 가 뜬다.
 *   성 차지는 목표 성(우리 성에 맞닿은 남의 성)을 얻거나 열 달이 지나면, 설전·일기토는 다음 달에 뜬다. 열려 있는 동안 본 사슬의 다음 카드가 쉰다.
 * 세이브: `rtk.state().scenario = { t0, done:{카드id:{k,turn}}, stage? }` — 없으면 빈 것. **옛 세이브**(시작 24달 뒤에 처음 만난 판)는
 *   지나온 길로 보고 1막을 건너뛴다. 끄는 법: `window.DG_NO_SCENARIO = true`(진단이 기본으로 켠다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function E() { return global.DG.event; }
  function R() { return global.DG.rtk; }
  function OFF() { return global.DG.off; }
  function CD() { return global.DG.scenarioData; }
  function on() { return !global.DG_NO_SCENARIO; }

  function save() {
    var st = R().state();
    if (!st.scenario || typeof st.scenario !== 'object') { st.scenario = {}; }
    var s = st.scenario;
    if (!s.done || typeof s.done !== 'object') { s.done = {}; }
    if (s.turnSeen !== undefined && (st.turn || 0) < s.turnSeen) { st.scenario = {}; s = st.scenario; s.done = {}; }   // 새 판(달이 되돌아갔다) — 처음부터
    s.turnSeen = st.turn || 0;
    if (s.t0 === undefined) {
      s.t0 = st.turn || 0;
      if ((st.turn || 0) > 24) { CD().CARDS.forEach(function (c) { s.done[c.id] = { k: '', turn: st.turn, legacy: true }; }); }   // 옛 세이브
    }
    return s;
  }

  function victoryKind() {
    var v = R().state().victories;
    if (v && v.length) { return v[0].kind; }
    var res = R().state().result;
    return res && res.kind ? res.kind : 'conquest';
  }

  /** 그 세력에서 무력이 가장 높은 사람 — {맹장} 칸 */
  function bravest(F) {
    var list = F ? OFF().ofForce(F) : [], best = null, i;
    for (i = 0; i < list.length; i++) {
      if (!best || global.DG.hero.stats(list[i].id).might > global.DG.hero.stats(best.id).might) { best = list[i]; }
    }
    return best ? E().h.nm(best.id) : '맹장';
  }

  function bravestId(F) {
    var list = F ? OFF().ofForce(F) : [], best = null, i;
    for (i = 0; i < list.length; i++) {
      if (!best || global.DG.hero.stats(list[i].id).might > global.DG.hero.stats(best.id).might) { best = list[i]; }
    }
    return best ? best.id : '';
  }

  function fill(text, c) {
    var b = c.b ? E().h.nm(c.b) : '이웃 군주';
    return String(text).replace(/\{책사\}/g, c.a ? E().h.nm(c.a) : '책사').replace(/\{이웃\}/g, b).replace(/\{맹장\}/g, c.force ? bravest(c.force) : '맹장');
  }

  /** 이웃 = 다른 살아 있는 세력 하나의 군주(가까운 쪽을 따지지 않고 첫 세력) */
  function neighbourLord(F) {
    var ids = R().liveForces(), i;
    for (i = 0; i < ids.length; i++) { if (ids[i] !== F) { return { force: ids[i], lord: OFF().lordOf(ids[i]) }; } }
    return null;
  }

  function apply(fx, c, F) {
    var h = E().h, cy = c.city;
    if (fx.t === 'gold') { h.gold(F, fx.n); }
    else if (fx.t === 'food') { h.adjust(cy, 'food', fx.n, 0, 999999999); }
    else if (fx.t === 'sec') { h.adjust(cy, 'sec', fx.n, 0, 100); }
    else if (fx.t === 'train') { h.adjust(cy, 'train', fx.n, 0, 100); }
    else if (fx.t === 'loyal' && c.a) { h.loyal(c.a, fx.n); }
    else if (fx.t === 'recruit') {
      if (h.isFree(fx.id)) { h.hire(fx.id, cy, F, fx.bonus || 0); }
      else if (h.mineOf(fx.id, F)) { h.loyal(fx.id, 5); }
    }
    else if (fx.t === 'loyalId') { if (E().h.mineOf(fx.id, F)) { h.loyal(fx.id, fx.n); } }
    else if (fx.t === 'quiz') {
      var q = core.save.quiz || (core.save.quiz = { learned: {}, wrongs: {}, total: 0, correct: 0, streak: 0, bestStreak: 0 });
      q.correct = (q.correct || 0) + fx.n;
    }
    else if (fx.t === 'recruitFree') {
      var pick = null;
      OFF().all().forEach(function (o) {
        if (!h.isFree(o.id) || CD().TIME_FOLK.indexOf(o.id) >= 0) { return; }
        if (!pick || OFF().stats(o.id).wisdom > OFF().stats(pick).wisdom) { pick = o.id; }
      });
      if (pick) { h.hire(pick, cy, F, fx.bonus || 0); }
    }
    else if (fx.t === 'lend' && c.b) {
      var nrec = OFF().rec(c.b), ncity = nrec && nrec.force ? R().citiesOf(nrec.force)[0] : '';
      if (ncity && h.isFree(fx.id)) { h.hire(fx.id, ncity, nrec.force, 0); }
    }
    else if (fx.t === 'rel' && c.b) {
      var rec = OFF().rec(c.b), DIP = global.DG.diplo;
      if (rec && rec.force && DIP && DIP.addRelation) { DIP.addRelation(F, rec.force, fx.n); }
    }
  }

  /** 결과 카드가 이겼는가 — 성 차지는 원천이 정해 넣고(ctx.won), 설전·일기토는 앞 단이 적은 결과(ctx.pre)를 본다 */
  function wonOf(sd, c) {
    if (sd.kind === 'own') { return !!c.won; }
    if (sd.kind === 'debate') { return !!c.pre && c.pre.ok >= 2; }
    return !!(c.pre && c.pre.won);
  }

  function registerStage(id, sd) {
    var cd = CD().card(id);
    E().addDef({
      id: id + '_end', name: sd.title, emoji: cd.emoji, tag: cd.tag, chain: true,
      valid: function () { return null; },
      pre: sd.kind === 'own' ? null : function (c) {
        return { kind: sd.kind, intro: fill(sd.intro, c), by: c.a, a: sd.kind === 'duel' ? bravestId(c.force) : '', d: sd.foe || '' };
      },
      text: function (c) { var br = wonOf(sd, c) ? sd.win : sd.lose; return fill(br.text, c) + ' (' + br.hint + ')'; },
      choices: [{
        k: 'def', label: '확인', hint: '', cost: 0,
        go: function (c, F) {
          var br = wonOf(sd, c) ? sd.win : sd.lose;
          br.fx.forEach(function (fx) { apply(fx, c, F); });
          return { text: fill(br.text, c) };
        }
      }]
    });
  }

  function register() {
    Object.keys(CD().STAGES).forEach(function (id) { registerStage(id, CD().STAGES[id]); });
    CD().CARDS.concat(CD().LORD, CD().SIDE).forEach(function (cd) {
      E().addDef({
        id: cd.id, name: cd.title, emoji: cd.emoji, tag: cd.tag, chain: true,
        valid: function () { return null; },
        text: function (c) {
          if (cd.textByK) { var pd = save().done[cd.textByK.from]; return fill((pd && cd.textByK[pd.k]) || cd.text, c); }      // 7막 — 앞 카드에서 고른 답별 글
          return fill(cd.textBy ? (cd.textBy[victoryKind()] || cd.text) : cd.text, c);
        },
        choices: cd.choices.map(function (ch) {
          return {
            k: ch.k, label: fill(ch.label, {}), hint: ch.hint, cost: ch.cost || 0,
            go: function (c, F) {
              ch.fx.forEach(function (fx) { apply(fx, c, F); });
              return { text: fill(ch.text, c) };
            }
          };
        })
      });
    });
  }

  function due(cd, F) {
    var st = R().state(), s = save(), since = (st.turn || 0) - s.t0;
    if (cd.when.victory && !((st.victories && st.victories.length) || (st.result && st.result.kind))) { return false; }
    if (cd.when.allTime) { return CD().TIME_FOLK.every(function (id) { return E().h.mineOf(id, F); }); }        // 7막 — 시간 틈 사람 아홉이 다 모였을 때
    if (cd.when.victory) { return true; }
    if (since >= cd.when.minTurn) { return true; }
    return !!(cd.when.orCities && R().citiesOf(F).length >= cd.when.orCities);
  }

  /** 단계가 열려 있으면 결과 카드 — 때가 안 됐으면 null */
  function stageFire(F) {
    var st = R().state(), s = save(), g = s.stage, sd = g && CD().STAGES[g.id], won = false;
    if (!sd) { delete s.stage; return null; }
    if (g.kind === 'own') {
      var cy = R().city(g.target);
      won = !!cy && cy.force === F;
      if (!won && (st.turn || 0) - g.since < sd.months) { return null; }
    }
    var cap = R().citiesOf(F)[0] || '', by = cap ? E().h.wisest(cap, F) : null, nb = neighbourLord(F);
    return { id: g.id + '_end', step: 1, ctx: { a: by ? by.id : '', b: nb && nb.lord ? nb.lord : '', city: cap, force: F, won: won } };
  }

  /** 성 차지 목표 — 우리 성에 맞닿은 남의 성 하나(어울리는 지역·땅 먼저, 병력 적은 성 먼저). 없으면 '' */
  function pickTarget(F, near, prov) {
    var mine = R().citiesOf(F), seen = {}, list = [];
    mine.forEach(function (id) {
      var cd = global.DG.cityData.find(id);
      (cd ? cd.adj : []).forEach(function (a) {
        var c = R().city(a);
        if (seen[a] || !c || c.force === F) { return; }
        seen[a] = 1;
        var ca = global.DG.cityData.find(a);
        list.push({ id: a, fit: prov && ca.prov === prov ? 0 : (near && ca.land === near ? 1 : 2), troops: c.troops || 0 });
      });
    });
    list.sort(function (x, y) { return x.fit - y.fit || x.troops - y.troops || (x.id < y.id ? -1 : 1); });
    return list.length ? list[0].id : '';
  }

  function beginStage(id, sd, F) {
    var s = save(), st = R().state(), target = '';
    if (sd.kind === 'own') {
      target = pickTarget(F, sd.near, sd.prov);
      if (!target) { return; }
    }
    if (sd.kind === 'duel' && E().h.mineOf(sd.foe, F)) { return; }
    s.stage = { id: id, kind: sd.kind, target: target, since: st.turn || 0 };
    if (target) {
      var nm = global.DG.cityData.find(target).name;
      core.log('🎯 ' + sd.title + ' — ' + nm + ' 을(를) ' + sd.months + '달 안에 차지하라', 'info');
      core.emit('toast', '🎯 목표 — ' + nm + ' 차지');
    }
  }

  /** 표(list)에서 다음 카드 하나 — 표 순서대로, 앞 카드가 끝나야 다음이 온다. 열전(lord)은 제 시나리오 카드만 본다 */
  function nextIn(list, F, lord) {
    var st = R().state(), s = save(), i;
    for (i = 0; i < list.length; i++) {
      if (lord && list[i].only !== st.scen) { continue; }
      if (s.done[list[i].id]) { continue; }
      if (!due(list[i], F)) { return null; }
      var cap = R().citiesOf(F)[0] || '', by = cap ? E().h.wisest(cap, F) : null, nb = neighbourLord(F);
      return { id: list[i].id, step: 1, ctx: { a: by ? by.id : '', b: nb && nb.lord ? nb.lord : '', city: cap, force: F } };
    }
    return null;
  }

  /** 사람 세력에게 다음 카드 하나 — 본 사슬 먼저, 아직 안 떴으면 이계 군주 열전(곁 사슬) */
  function source(F) {
    if (!on()) { return null; }
    var st = R().state();
    if (F !== st.me || !st.started || st.result) { return null; }
    if (save().stage) { return stageFire(F) || nextIn(CD().LORD, F, true) || nextSide(F); }       // 단계가 열려 있는 동안 본 사슬은 쉰다
    return nextIn(CD().CARDS, F, false) || nextIn(CD().LORD, F, true) || nextSide(F);
  }

  /** 곁가지 — 시간 틈 사람이 우리 사람이 된 지 열두 달이 지났으면 그 사람 고향 이야기(세이브 `scenario.seen[id]` = 처음 본 달) */
  var SIDE_MONTHS = 12;
  function nextSide(F) {
    var st = R().state(), s = save(), list = CD().SIDE, i, out = null;
    if (!s.seen || typeof s.seen !== 'object') { s.seen = {}; }
    for (i = 0; i < list.length; i++) {
      var who = list[i].who;
      if (!E().h.mineOf(who, F)) { continue; }
      if (s.seen[who] === undefined) { s.seen[who] = st.turn || 0; }
      if (!out && !s.done[list[i].id] && (st.turn || 0) - s.seen[who] >= SIDE_MONTHS) {
        var cap = R().citiesOf(F)[0] || '', nb = neighbourLord(F);
        out = { id: list[i].id, step: 1, ctx: { a: who, b: nb && nb.lord ? nb.lord : '', city: cap, force: F } };
      }
    }
    return out;
  }

  function onDone(e) {
    if (!on() || !e) { return; }
    var st = R().state(), sd = CD().STAGES, s;
    if (e.force !== st.me) { return; }
    if (/_end$/.test(e.id) && sd[e.id.slice(0, -4)]) { s = save(); delete s.stage; core.persist(); return; }      // 결과 카드 — 단계를 닫는다
    if (!CD().card(e.id)) { return; }
    save().done[e.id] = { k: e.k, turn: st.turn };
    if (sd[e.id]) { beginStage(e.id, sd[e.id], e.force); }
    core.persist();
  }

  /** 기록 시트용 — 카드마다 끝남·다음 */
  function lines() {
    if (!on()) { return []; }
    var s = save(), out = [], next = false, scen = R().state().scen;
    function add(c) {
      var d = s.done[c.id];
      out.push({ id: c.id, no: c.no, act: c.act, title: c.title, emoji: c.emoji, state: d ? (d.legacy ? 'legacy' : 'done') : (!next ? 'next' : 'wait'), k: d ? d.k : '' });
      if (!d && !next) { next = true; }
    }
    CD().CARDS.forEach(add);
    if (s.stage && CD().STAGES[s.stage.id]) {
      var gd = CD().STAGES[s.stage.id], gc = CD().card(s.stage.id), tc = s.stage.target && global.DG.cityData.find(s.stage.target);
      out.forEach(function (o) {
        if (o.id === s.stage.id) { o.state = 'goal'; o.note = gd.title + (tc ? ' — ' + tc.name + ' 차지 (' + Math.max(0, gd.months - ((R().state().turn || 0) - s.stage.since)) + '달 남음)' : ' — 곧'); }
        else if (o.state === 'next') { o.state = 'wait'; }
      });
    }
    next = false;
    CD().LORD.forEach(function (c) { if (c.only === scen) { add(c); } });      // 열전은 제 군주의 것만 — 곁 사슬이라 다음 표시도 따로
    return out;
  }

  var inited = false;
  function init() {
    if (inited) { return; }
    inited = true;
    register();
    E().addSource(source);
    core.on('rtk:eventDone', onDone);
  }

  global.DG = global.DG || {};
  global.DG.scenario = { init: init, source: source, lines: lines, on: on, state: save, card: function (id) { return CD().card(id); } };
  init();     // 정의·원천은 늘 등록하고, 켜고 끄는 것은 on()(DG_NO_SCENARIO)이 가른다
})(window);
