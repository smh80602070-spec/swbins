  /* ── 달 넘기기 ────────────────────────────────────────── */

  /**
   * 다음 달로 넘긴다.
   *   1) 다른 세력이 명령을 쓴다 (ai)
   *   2) 살림을 정산한다
   *   3) 달을 올리고 명령표를 비운다
   */
  function endMonth() { return core.batch(endMonthRaw); }   /* changed 를 한 달에 한 번만(W-0026) */  function endMonthRaw() {
    var st = state();
    if (!st.started || st.result) { return null; }
    var snap = snapshot();

    monthOrders = {};
    monthBattles = {};
    monthScouts = {};
    global.DG.rtkAI.runAll();
    if (global.DG.war) { global.DG.war.resolveAll(); }
    if (global.DG.war) { global.DG.war.resolveJourneys(); }
    if (global.DG.diplo) { global.DG.diplo.monthly(); }
    settleMonth();

    st.month += 1;
    if (st.month > 12) { st.month = 1; st.year += 1; }
    st.turn += 1;

    var k;
    for (k in st.officers) {
      if (Object.prototype.hasOwnProperty.call(st.officers, k)) { st.officers[k].done = false; }
    }

    global.DG.off.tickAmbitions();
    if (global.DG.event) { global.DG.event.tick(); }     // 사연(§5-2) — 예약된 체인 → 새 사연, 세력마다 하나까지
    core.emit('rtk:month', { year: st.year, month: st.month });
    core.emit('changed');
    tickVictories();
    tickChallenge();
    checkMilestones();
    core.persist();
    return { year: st.year, month: st.month, report: monthReport(snap) };
  }

  /* ── 이정표 (PLAN §5-4) ─────────────────────────────────
   * `save.rtk.milestone = { idx, at, base:{core, cities} }` — idx 는 **깬 단 수**(0~5), at 은 마지막으로
   * 깬 달(turn), base 는 시작 때의 성 수(사다리의 눈금). 옛 세이브는 칸이 없으면 지금을 기준으로 0 에서 시작한다.
   * 표(`FD.milestonesFor`)는 조건과 보상만 갖고, 판정·지급은 여기 한 곳이다.
   */

  function coreCount(st, forceId) {
    var n = 0, k;
    for (k in st.cities) {
      if (!Object.prototype.hasOwnProperty.call(st.cities, k)) { continue; }
      var d = CD.find(k);
      if (st.cities[k].force === forceId && d && !d.garrison) { n++; }
    }
    return n;
  }

  function ensureMilestone(st) {
    if (st.milestone || !st.started || !st.me) { return; }
    var mine = 0, k;
    for (k in st.cities) {
      if (Object.prototype.hasOwnProperty.call(st.cities, k) && st.cities[k].force === st.me) { mine++; }
    }
    st.milestone = { idx: 0, at: st.turn || 0, base: { core: coreCount(st, st.me), cities: mine } };
  }

  /** 이 판의 이정표 표(조건이 풀린 다섯 단) */
  function milestones() {
    var st = state();
    ensureMilestone(st);
    return FD.milestonesFor(st.scen || '194', st.milestone ? st.milestone.base.core : 0);
  }

  /** 조건 하나의 진척 — { cur, need, ok, note } (막대는 cur/need) */
  function condProgress(cond) {
    var st = state(), mine = citiesOf(st.me), i, n = 0, tot = 0;
    if (cond.c === 'cities') {
      return { cur: mine.length, need: cond.n, ok: mine.length >= cond.n };
    }
    if (cond.c === 'core') {
      n = coreCount(st, st.me);
      return { cur: n, need: cond.n, ok: n >= cond.n };
    }
    if (cond.c === 'prov') {
      for (i = 0; i < CD.CITIES.length; i++) {
        if (CD.CITIES[i].prov !== cond.prov) { continue; }
        tot++;
        if (st.cities[CD.CITIES[i].id] && st.cities[CD.CITIES[i].id].force === st.me) { n++; }
      }
      var need = cond.all ? tot : 1;
      return { cur: Math.min(n, need), need: need, ok: n >= need };
    }
    if (cond.c === 'city') {
      var has = st.cities[cond.id] && st.cities[cond.id].force === st.me ? 1 : 0;
      return { cur: has, need: 1, ok: !!has };
    }
    if (cond.c === 'rank') {
      var rk = ranking(), pos = 0;
      for (i = 0; i < rk.length; i++) { if (rk[i].id === st.me) { pos = i + 1; break; } }
      return { cur: Math.min(mine.length, cond.min), need: cond.min,
               ok: !!pos && pos <= cond.n && mine.length >= cond.min,
               note: pos ? (pos + '위') : '' };
    }
    return { cur: 0, need: 1, ok: false };
  }

  /** 화면용 — 지금 겨냥하는 이정표와 진척. 다 깼으면 cur:null */
  function milestoneView() {
    var st = state();
    if (!st.started || !st.milestone) { return null; }
    var list = milestones(), idx = st.milestone.idx;
    var out = { idx: idx, total: list.length, cur: null, progress: null, list: list };
    if (idx < list.length) {
      out.cur = list[idx];
      out.progress = condProgress(list[idx].cond);
    }
    return out;
  }

  function awardMilestone(m, idx) {
    var st = state(), f = myForce(), off = global.DG.off, ID = global.DG.item;
    var got = { idx: idx, name: m.name, desc: m.desc, gold: m.gold || 0, found: [], relic: null };
    if (f && m.gold) { f.gold += m.gold; }
    var i;
    for (i = 0; i < (m.reveal || 0); i++) {
      var h = revealFree('이정표 「' + m.name + '」 — 소문이 돌아');
      if (h) { got.found.push(h.name); }
    }
    if (m.relic && ID) {
      var it = ID.randomItem(), team = off.ofForce(st.me), who = null;
      for (i = 0; i < team.length; i++) { if (!off.rec(team[i].id).item) { who = team[i]; break; } }
      if (!who && team.length) { who = team[0]; }
      if (who) {
        off.equip(who.id, it.id);
        got.relic = { emoji: it.emoji, name: it.name, who: who.name };
      }
    }
    core.log('🚩 이정표 ' + (idx + 1) + '/5 「' + m.name + '」 — ' + m.desc +
      ' (금 +' + core.fmt(got.gold) + ')', 'good');
    return got;
  }

  /**
   * 다음 달로 넘어갈 때(그리고 어드민이 부를 때) 깬 이정표를 지급한다.
   * 한 번에 여러 단을 깨면 차례로 모두 준다. 승패가 난 판은 세지 않는다.
   * @returns 이번에 깬 단들의 결과 배열
   */
  function checkMilestones() {
    var st = state(), out = [];
    if (!st.started || st.result || !st.milestone) { return out; }
    var list = milestones();
    while (st.milestone.idx < list.length) {
      var m = list[st.milestone.idx];
      if (!condProgress(m.cond).ok) { break; }
      out.push(awardMilestone(m, st.milestone.idx));
      st.milestone.idx += 1;
      st.milestone.at = st.turn;
    }
    if (out.length) { core.emit('rtk:milestone', out); core.emit('changed'); }
    return out;
  }

  /* ── 요약 (화면용) ────────────────────────────────────── */

  function summary(forceId) {
    forceId = forceId || me();
    var cs = citiesOf(forceId), i, troops = 0, food = 0, income = 0, ships = 0;
    for (i = 0; i < cs.length; i++) {
      troops += state().cities[cs[i]].troops;
      food += state().cities[cs[i]].food;
      ships += state().cities[cs[i]].ships || 0;
      income += goldOf(cs[i]);
    }
    var f = force(forceId) || { gold: 0 };
    var offs = global.DG.off.ofForce(forceId);
    return {
      id: forceId, name: forceName(forceId),
      cities: cs.length, gold: f.gold, income: income,
      upkeep: offs.length * UPKEEP_PER_OFFICER,
      troops: troops, food: food, ships: ships, officers: offs.length
    };
  }

  /** 세력 순위 — 도시 수 → 병력 순 */
  function ranking() {
    var ids = liveForces(), out = [], i;
    for (i = 0; i < ids.length; i++) { out.push(summary(ids[i])); }
    out.sort(function (a, b) { return b.cities - a.cities || b.troops - a.troops; });
    return out;
  }

  global.DG = global.DG || {};
  global.DG.rtk = {
    START_YEAR: START_YEAR, ORDERS: ORDERS, DISASTERS: DISASTERS,
    scen: function () { return state().scen || '194'; },
    UPKEEP_PER_OFFICER: UPKEEP_PER_OFFICER, FOOD_PER_1000: FOOD_PER_1000,
    HARVEST_MONTHS: HARVEST_MONTHS, LORE_PER_FIND: LORE_PER_FIND,
    orderByKey: orderByKey, disasterByKey: disasterByKey,
    state: state, city: city, force: force, me: me, myForce: myForce,
    isMine: isMine, citiesOf: citiesOf, liveForces: liveForces, forceName: forceName,
    setup: setup, scatterFree: scatterFree,
    milestones: milestones, milestoneView: milestoneView, condProgress: condProgress,
    checkMilestones: checkMilestones,
    challengeWeek: challengeWeek, challengeScore: challengeScore, challengeView: challengeView, setupChallenge: setupChallenge,
    tickChallenge: tickChallenge, monthReport: monthReport, snapshot: snapshot, recommend: recommend, isoWeek: isoWeek,
    CHALLENGE_MONTHS: CHALLENGE_MONTHS, bests: bests,
    roundNo: roundNo, canNextRound: canNextRound, roundPreview: roundPreview, nextRound: nextRound, roundBest: roundBest, ROUND_MAX: ROUND_MAX,
    VICTORY: VICTORY, victoryKinds: victoryKinds, victoryProgress: victoryProgress, victoryNext: victoryNext,
    victoryDone: function (k) { return victoryDone(state(), k); }, resultCard: resultCard, tickVictories: tickVictories,
    readyAt: readyAt, capOf: capOf, order: order, monthOrders: monthOrdersView, monthBattles: monthBattlesView, monthScouts: monthScoutsView, tryHire: tryHire, bumpStat: bumpStat,
    setGov: setGov, govMul: govMul, reward: reward,
    goldOf: goldOf, foodOf: foodOf, eatOf: eatOf, secMul: secMul, harvestMul: harvestMul,
    marketRate: marketRate, trade: trade,
    settleMonth: settleMonth, rollDisasters: rollDisasters, driftLoyalty: driftLoyalty,
    endMonth: endMonth, checkResult: checkResult,
    study: study, revealFree: revealFree, rollScouting: rollScouting,
    summary: summary, ranking: ranking
  };
})(window);
