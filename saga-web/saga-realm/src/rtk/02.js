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
    global.DG.rtk.checkMilestones();   // 이정표 — milestone.js
    core.persist();
    return { year: st.year, month: st.month, report: monthReport(snap) };
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
