  /* ── 여러 달에 걸치는 원정 ───────────────────────────── */

  /**
   * 진(陣)을 친다 — 원정이 다음 달로 이어진다.
   * 병력도 장수도 성으로 돌아가지 않는다. `off.rec(id).camp` 가 붙는 동안
   * 그 사람은 **성에 없는 사람**이라 내정도 못 하고 수비에도 안 선다.
   */
  function encamp(fromId, toId, atk, baggage, report) {
    var R = global.DG.rtk, off = global.DG.off;
    var st = R.state();
    st.campSeq = (st.campSeq || 0) + 1;
    var cp = {
      id: 'camp' + st.campSeq,
      force: atk.force, from: fromId, to: toId,
      troops: atk.troops, officers: atk.officers.slice(),
      train: atk.train, tech: atk.tech, morale: atk.morale,
      water: !!atk.water, ships: atk.ships || 0,
      food: baggage, months: 1
    };
    camps().push(cp);
    for (var i = 0; i < cp.officers.length; i++) { off.rec(cp.officers[i]).camp = cp.id; }
    report.log.push('🏕️ 물러나지 않고 성 밖에 진을 쳤다 — 치중 ' + core.fmt(cp.food) +
      ' (' + monthsLeft(cp) + '달치)');
    core.log('🏕️ ' + R.forceName(cp.force) + ' 이(가) ' + CD.find(toId).name +
      ' 을(를) 에워쌌다', 'info');
    core.emit('rtk:camp', { kind: 'set', camp: cp.id, to: toId, force: cp.force });
    return cp;
  }

  /** 진영을 목록에서 뺀다 — 장수에 붙은 표시도 함께 뗀다 */
  function drop(cp) {
    var off = global.DG.off, list = camps(), i = list.indexOf(cp);
    if (i >= 0) { list.splice(i, 1); }
    for (i = 0; i < cp.officers.length; i++) { off.rec(cp.officers[i]).camp = null; }
  }

  /** 물러날 곳 — 출진한 성이 아직 우리 것이면 그리로, 아니면 가장 가까운 우리 성 */
  function homeFor(cp) {
    var R = global.DG.rtk;
    var from = R.city(cp.from);
    if (from && from.force === cp.force) { return cp.from; }
    var mine = R.citiesOf(cp.force), best = null, bd = 1e9, i, d;
    for (i = 0; i < mine.length; i++) {
      d = CD.hops(cp.to, mine[i]);
      if (d >= 0 && d < bd) { bd = d; best = mine[i]; }
    }
    return best;
  }

  /** 포위를 푼다 */
  function retreat(cp, why) {
    var R = global.DG.rtk, off = global.DG.off;
    var home = homeFor(cp);
    if (!home) { return disband(cp); }
    var h = R.city(home), i;
    h.troops += cp.troops; h.food += cp.food; h.ships = (h.ships || 0) + (cp.ships || 0);
    for (i = 0; i < cp.officers.length; i++) {
      off.placeAt(cp.officers[i], home, cp.force);
      off.addLoyal(cp.officers[i], -2);
    }
    drop(cp);
    core.log('↩️ ' + R.forceName(cp.force) + ' 이(가) ' + CD.find(cp.to).name +
      ' 의 포위를 풀었다 — ' + why + ' ' + CD.find(home).name + ' 으로 물러났다', 'warn');
    core.emit('rtk:camp', { kind: 'retreat', camp: cp.id, to: cp.to, home: home, why: why });
    return { ok: true, kind: 'retreat', campId: cp.id, to: cp.to, home: home, why: why };
  }

  /** 그 사이 우리 깃발이 올랐다 (동맹이 뺏었거나 계략이 통했거나) — 그대로 들어간다 */
  function enterCity(cp) {
    var R = global.DG.rtk, off = global.DG.off;
    var to = R.city(cp.to), i;
    to.troops += cp.troops; to.food += cp.food; to.ships = (to.ships || 0) + (cp.ships || 0);
    for (i = 0; i < cp.officers.length; i++) {
      off.placeAt(cp.officers[i], cp.to, cp.force);
    }
    drop(cp);
    core.log('🚩 ' + CD.find(cp.to).name + ' 에 이미 우리 깃발이 올라 그대로 입성했다', 'good');
    core.emit('rtk:camp', { kind: 'enter', camp: cp.id, to: cp.to });
    return { ok: true, kind: 'enter', campId: cp.id, to: cp.to };
  }

  /**
   * 돌아갈 나라가 사라졌다 — 원정군이 그 자리에서 흩어진다.
   * 장수는 **사로잡힌 것으로 둔다**. 그냥 지우면 판에서 사람이 조용히 사라진다
   * (성이 떨어질 때 수비 무장을 흩는 것과 같은 까닭이다).
   */
  function disband(cp) {
    var R = global.DG.rtk, off = global.DG.off, st = R.state(), i, id;
    for (i = 0; i < cp.officers.length; i++) {
      id = cp.officers[i];
      off.placeAt(id, cp.to, null);
      off.rec(id).found = true;
      off.rec(id).loyal = 0;
      st.captives[id] = cp.to;
    }
    drop(cp);
    core.log('🏳️ 돌아갈 곳을 잃은 원정군이 ' + CD.find(cp.to).name + ' 앞에서 흩어졌다', 'warn');
    core.emit('rtk:camp', { kind: 'disband', camp: cp.id, to: cp.to });
    return { ok: true, kind: 'disband', campId: cp.id, to: cp.to };
  }

  /** 일기토에서 다친 장수는 진을 떠나 돌아간다 */
  function sendHomeHurt(cp, was) {
    var off = global.DG.off, home = homeFor(cp), i;
    for (i = 0; i < was.length; i++) {
      if (cp.officers.indexOf(was[i]) >= 0) { continue; }
      off.rec(was[i]).camp = null;
      if (home) { off.placeAt(was[i], home, cp.force); }
    }
  }

  /**
   * 보급 — 진영에 병력과 치중을 보낸다.
   * 보내는 곳은 **그 진영과 맞닿은 우리 성**이다. 이것이 있어야 원정이 두 달을 넘긴다
   * (출진할 때 들고 나가는 군량이 두 달치라 보급이 없으면 거기서 끝난다).
   */
  function supply(campId, troops, food, fromId) {
    var R = global.DG.rtk;
    var cp = campById(campId);
    if (!cp) { return { ok: false, why: '없는 진영입니다' }; }
    fromId = fromId || cp.from;
    var from = R.city(fromId);
    if (!from || from.force !== cp.force) { return { ok: false, why: '우리 성이 아닙니다' }; }
    if (CD.find(fromId).adj.indexOf(cp.to) < 0) {
      return { ok: false, why: '진영과 맞닿아 있지 않습니다' };
    }
    troops = Math.max(0, Math.round(troops || 0));
    food = Math.max(0, Math.round(food || 0));
    if (troops > from.troops || food > from.food) { return { ok: false, why: '보낼 것이 모자랍니다' }; }
    if (!troops && !food) { return { ok: false, why: '보낼 것이 없습니다' }; }
    /* 물 위의 진영은 **배에 타는 만큼만** 늘어난다 */
    if (cp.water && troops > 0) {
      var room = Math.max(0, (cp.ships || 0) * SHIP_CREW - cp.troops);
      if (troops > room) {
        return { ok: false, why: '배가 모자랍니다 (' + (cp.ships || 0) + '척에 ' +
          core.fmt(room) + '명 더 탑니다)' };
      }
    }
    from.troops -= troops; from.food -= food;
    /* 갓 온 병사가 섞이면 훈련도가 내려간다 — 성에서 징병할 때와 같다 */
    if (troops > 0 && cp.troops + troops > 0) {
      cp.train = Math.round((cp.train * cp.troops + from.train * troops) / (cp.troops + troops));
    }
    cp.troops += troops; cp.food += food;
    core.emit('changed');
    core.persist();
    return { ok: true, troops: troops, food: food, left: monthsLeft(cp) };
  }

  /** 사람이 스스로 포위를 푼다 */
  function withdraw(campId) {
    var cp = campById(campId);
    if (!cp) { return { ok: false, why: '없는 진영입니다' }; }
    var res = retreat(cp, '스스로 군을 거두어');
    core.emit('changed');
    core.persist();
    return res;
  }

  /**
   * 진영 하나의 한 달.
   * **march 와 같은 `fight()` 를 쓴다** — 여기에만 있는 판정을 만들면 판정이 두 벌이 된다.
   */
  function resolveCamp(cp) {
    var R = global.DG.rtk, off = global.DG.off;
    var to = R.city(cp.to);
    if (!to) { drop(cp); return null; }

    if (!R.citiesOf(cp.force).length) { return disband(cp); }
    if (to.force === cp.force) { return enterCity(cp); }
    if (global.DG.diplo && global.DG.diplo.blocked(cp.force, to.force)) {
      return retreat(cp, '맹약이 맺어져');
    }

    /* 치중 — 한 달치를 먹는다.
       한 달치를 못 채우면 **굶어 흩어지기 전에 군을 돌린다.** 성처럼
       모자란 만큼을 그대로 병사에서 깎으면(settleMonth 의 식) 치중이 떨어지는
       그 달에 원정군이 통째로 사라진다 — 성은 물러날 데가 없지만 진영은 있다. */
    var eat = Math.round(cp.troops / 1000 * R.FOOD_PER_1000);
    if (cp.food < eat) {
      var lost = Math.round(cp.troops * 0.2);
      cp.troops = Math.max(0, cp.troops - lost);
      cp.food = 0;
      if (lost > 0) {
        core.log('🍚 ' + CD.find(cp.to).name + ' 진중 — 군량이 떨어져 병사 ' +
          core.fmt(lost) + ' 이 흩어졌다', 'warn');
      }
      return retreat(cp, '군량이 떨어져');
    }
    cp.food -= eat;

    /* 진이 길어질수록 사기가 깎인다 */
    cp.morale *= CAMP_DECAY;
    if (cp.morale < CAMP_QUIT || cp.troops < CAMP_MIN) { return retreat(cp, '군이 지쳐'); }

    var relief = reinforce(cp.to);
    var was = cp.officers.slice();
    var land = CD.landOf(cp.to);
    var atk = {
      side: 'atk', force: cp.force, troops: cp.troops, start: cp.troops,
      train: cp.train, tech: cp.tech, officers: cp.officers, morale: cp.morale,
      water: !!cp.water, ships: cp.ships || 0
    };
    var def = {
      side: 'def', force: to.force, troops: to.troops, start: to.troops,
      train: to.train, tech: to.tech,
      officers: off.atCity(cp.to, to.force).map(function (h) { return h.id; }), morale: 1,
      water: !!cp.water, ships: cp.water ? (to.ships || 0) : 0
    };

    off.gainExpAll(cp.officers, off.EXP.siege);

    var report = fight(atk, def, to, cp.to, land, false);
    report.from = cp.from; report.to = cp.to; report.relief = relief;
    report.force = cp.force; report.defForce = def.force;
    report.campId = cp.id; report.siege = true; report.months = cp.months;
    report.log.splice(1, 0, '🏕️ ' + cp.months + '달째 에워싸고 있다 — 사기 ' +
      Math.round(cp.morale * 100) + ' · 치중 ' + core.fmt(cp.food) +
      ' (' + monthsLeft(cp) + '달치)');
    if (relief > 0) {
      report.log.splice(2, 0, '🚩 이웃 성에서 구원군 ' + core.fmt(relief) + ' 이 들어왔다');
    }

    cp.troops = atk.troops; cp.morale = atk.morale; cp.ships = atk.ships || 0;
    sendHomeHurt(cp, was);

    if (report.won) {
      to.food += cp.food;
      capture(cp.to, cp.force, atk, def, report);
      drop(cp);
    } else if (report.routed) {
      to.troops = def.troops;
      if (cp.water) { to.ships = def.ships; }
      retreat(cp, '공격군이 무너져');
    } else {
      to.troops = def.troops;
      if (cp.water) { to.ships = def.ships; }
      cp.months += 1;
    }
    core.emit('rtk:battle', report);
    return report;
  }

  /**
   * endMonth 가 부른다 — 서 있는 진영이 저마다 한 달을 더 산다.
   * 목록을 **베껴 두고** 돈다 — 도중에 함락·철군으로 목록이 줄기 때문이다.
   */
  function resolveAll() {
    var list = camps().slice(), out = [], i, r;
    for (i = 0; i < list.length; i++) {
      r = resolveCamp(list[i]);
      if (r) { out.push(r); }
    }
    if (out.length) { core.emit('changed'); core.persist(); }
    return out.length ? out : null;
  }

  global.DG.war = {
    ROUNDS: ROUNDS, ROUT: ROUT, DUEL_GAP: DUEL_GAP, SHIP_CREW: SHIP_CREW,
    CAMP_DECAY: CAMP_DECAY, CAMP_QUIT: CAMP_QUIT, CAMP_MIN: CAMP_MIN,
    armyPower: armyPower, troopMixOf: troopMixOf, topBy: topBy, duel: duel, fireRoll: fireRoll,
    duelBegin: duelBegin, duelSet: duelSet, duelHand: duelHand, duelAlive: duelAlive, duelRound: duelRound, duelEnd: duelEnd, duelBout: duelBout, duelAuto: duelAuto,
    STANCES: STANCES, BOUT_ROUNDS: BOUT_ROUNDS, BOUT_MUL: BOUT_MUL,
    FORMATIONS: FORMATIONS, formationOf: formationOf, TACTICS: TACTICS, tacticFor: tacticFor, stepRound: stepRound,
    HISTORY_BRANCHES: HISTORY_BRANCHES, checkHistoryBranch: checkHistoryBranch,
    reinforce: reinforce, reliefOf: reliefOf, forecast: forecast,
    canMarch: canMarch, march: march, marchInteractive: marchInteractive, capture: capture,
    transfer: transfer, moveOfficer: moveOfficer,
    camps: camps, campsOf: campsOf, campById: campById, campAt: campAt,
    besieged: besieged, monthsLeft: monthsLeft,
    supply: supply, withdraw: withdraw,
    resolveCamp: resolveCamp, resolveAll: resolveAll,
    fight: fight, encamp: encamp   // 원정(journey.js)이 쓴다 — 원정 함수들은 journey.js 가 이 이름표에 붙인다
  };
})(window);
