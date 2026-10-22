/**
 * 삼국지 — 다른 세력의 한 달
 * ---------------------------------------------------------------
 * 사람이 "다음 달" 을 누르면 나머지 열두 세력이 여기서 제 명령을 쓴다.
 *
 * **규칙을 새로 만들지 않는다.** 이 파일은 사람이 누를 수 있는 것만 부른다 —
 * `rtk.order` · `rtk.setGov` · `war.march` · `diplo.envoy` · `diplo.plot`.
 * AI 전용 지름길을 하나 만들면 그 순간 판정이 두 벌이 되어 균형을 못 본다.
 *
 * 성향(creed)은 data-force.js 가 정한다.
 *   aggressive  이길 만하면 친다 (조조 · 손책 · 여포 · 원술 · 공손찬)
 *   balanced    살림을 먼저 채우고 틈이 나면 친다
 *   turtle      웬만하면 지킨다 (유표 · 유장 · 장로 · 공융)
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var FD = global.DG.forceData;

  /**
   * 칠지 말지는 **war.forecast()** 가 정한다 — 진짜 전투식을 사본에 그대로 굴린다.
   * 성향이 정하는 것은 딱 하나, **얼마나 잃어도 받아들이는가**(lossCap)뿐이다.
   *
   * 어림식(병력 배수 문턱)으로 재던 때는 성벽 초깃값만 보고 판단해
   * 120개월에 다섯 번밖에 안 싸웠다. 판정을 두 벌 두지 않는다.
   */
  var CREED = {
    aggressive: { lossCap: 0.70, keepGold: 400,  plotRate: 0.25, envoyRate: 0.10 },
    balanced:   { lossCap: 0.50, keepGold: 900,  plotRate: 0.18, envoyRate: 0.20 },
    turtle:     { lossCap: 0.30, keepGold: 1500, plotRate: 0.10, envoyRate: 0.30 }
  };

  function creedOf(forceId) {
    var f = FD.force(forceId);
    return CREED[(f && f.creed) || 'balanced'] || CREED.balanced;
  }

  /* ── 이 성에 지금 가장 아쉬운 것 ────────────────────────── */

  /**
   * 명령 하나를 고른다.
   * 순서가 곧 우선순위다 — 위에 있는 조건이 먼저 걸린다.
   * (치안을 맨 앞에 둔 것은, 치안이 무너지면 나머지 살림이 통째로 새기 때문이다)
   */
  function pickOrder(cityId, forceId) {
    var R = global.DG.rtk;
    var c = R.city(cityId);
    var d = CD.find(cityId);
    var f = R.force(forceId);
    var keep = creedOf(forceId).keepGold;

    if (c.sec < 45) { return 'sec'; }
    /* 수확이 두 번 남았는데 군량이 한 달치도 없으면 논밭부터 */
    if (c.food < R.eatOf(cityId) * 3 && c.agri < R.capOf(cityId, 'agri')) { return 'agri'; }
    if (f.gold < keep && c.comm < R.capOf(cityId, 'comm')) { return 'comm'; }
    if (c.wall < c.maxWall * 0.7) { return 'wall'; }
    /* 물길을 낀 성은 배가 있어야 나간다 — 없으면 강동이 제자리에서 늙는다 */
    if (d.land === 'river' && c.ships < R.capOf(cityId, 'ships') * 0.4 &&
        f.gold > keep) { return 'ships'; }
    if (c.troops < c.pop * 0.035 && f.gold > keep) { return 'draft'; }
    if (c.train < 70) { return 'train'; }
    if (c.agri < R.capOf(cityId, 'agri') * 0.7) { return 'agri'; }
    if (c.comm < R.capOf(cityId, 'comm') * 0.7) { return 'comm'; }
    if (c.tech < 400) { return 'tech'; }
    if (c.sec < 85) { return 'sec'; }
    return 'agri';
  }

  /** 그 명령에 가장 맞는 사람을 고른다 — 자질이 맞아야 성과가 난다 */
  function bestFor(list, orderKey) {
    var R = global.DG.rtk, off = global.DG.off;
    var o = R.orderByKey(orderKey);
    if (!o || !list.length) { return null; }
    var best = null, bv = -1;
    for (var i = 0; i < list.length; i++) {
      var v = off.stats(list[i].id)[o.stat] || 0;
      if (v > bv) { bv = v; best = list[i]; }
    }
    return best;
  }

  /* ── 한 세력의 한 달 ──────────────────────────────────── */

  function runForce(forceId) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var cities = R.citiesOf(forceId);
    if (!cities.length) { return null; }
    var cr = creedOf(forceId);
    var acted = { orders: 0, march: null, plot: null, envoy: null };
    var i;

    /* 1) 태수가 비었으면 앉힌다 */
    for (i = 0; i < cities.length; i++) {
      var c = R.city(cities[i]);
      if (c.gov && off.rec(c.gov).city === cities[i] && off.rec(c.gov).force === forceId) { continue; }
      var here = off.atCity(cities[i], forceId);
      R.setGov(cities[i], here.length ? here[0].id : null);
    }

    /* 2) 진을 친 곳에 군량을 댄다 — 이것이 없으면 모든 포위가 두 달에 끝난다
          (출진할 때 들고 나가는 군량이 두 달치다) */
    acted.supply = trySupply(forceId);

    /* 2.5) 시장 — 군량이 위태로우면 사서 메우고, 금은 모자란데 군량이
       썩어날 만큼 남으면 판다. 사람이 쓰는 rtk.trade() 를 그대로 부른다 */
    acted.trade = tryTrade(forceId, cr);

    /* 3) 싸울 만한가 — 살림보다 먼저 본다(장수를 명령에 다 써 버리면 못 친다) */
    acted.march = tryWar(forceId, cr);

    /* 3.5) 공이 쌓인 사람을 올린다 — 관직이 사람을 붙들어 둔다 */
    acted.promote = tryPromote(forceId, cr);

    /* 4) 계략 · 외교 — 각각 한 달에 한 번까지 */
    if (Math.random() < cr.plotRate) { acted.plot = tryPlot(forceId); }
    if (Math.random() < cr.envoyRate) { acted.envoy = tryEnvoy(forceId); }

    /* 5) 남은 장수는 내정 */
    for (i = 0; i < cities.length; i++) {
      var ready = R.readyAt(cities[i]);
      for (var g = 0; g < ready.length; g++) {
        var key = pickOrder(cities[i], forceId);
        var who = bestFor(R.readyAt(cities[i]), key);
        if (!who) { break; }
        var res = R.order(cities[i], who.id, key);
        if (!res.ok) { break; }              // 금이 떨어졌다 — 이 세력은 여기까지
        acted.orders++;
      }
    }
    return acted;
  }

  /**
   * 진을 친 곳에 **군량만** 댄다.
   * 병력 증원은 사람 쪽 손잡이로 남겨 둔다 — AI 가 달마다 뒷마당을 비워 진영에
   * 몰아주면 균형이 통째로 달라진다(가늠·전투는 그대로인데 판이 쓸려 나간다).
   * 보내는 성의 두 달치는 남긴다 — 대 주다 제 성이 굶으면 그게 더 아프다.
   */
  function trySupply(forceId) {
    var R = global.DG.rtk, war = global.DG.war;
    if (!war.campsOf) { return null; }
    var list = war.campsOf(forceId), sent = 0, i;
    for (i = 0; i < list.length; i++) {
      var cp = list[i];
      var home = R.city(cp.from);
      if (!home || home.force !== forceId) { continue; }
      var eat = Math.round(cp.troops / 1000 * R.FOOD_PER_1000);
      var want = Math.max(0, eat * 2 - cp.food);
      var spare = Math.max(0, home.food - R.eatOf(cp.from) * 2);
      var food = Math.min(want, spare);
      if (food < 100) { continue; }
      if (war.supply(cp.id, 0, food, cp.from).ok) { sent += food; }
    }
    return sent || null;
  }

  /**
   * 시장에서 딱 한 성만 사고판다(한 달에 한 번, 사람이 손잡이 쓰듯).
   * **군량이 위태로우면 산다** — 굶어서 병력이 녹는 것보다 낫다.
   * **금이 모자라는데 군량이 썩어날 만큼 넉넉하면 판다** — 곳간에 쌓아만
   * 두는 대신 다른 명령에 쓸 금으로 바꾼다. 두 조건이 동시에 걸리는 성은
   * 없다(위태로움과 넉넉함은 반대말이라).
   */
  function tryTrade(forceId, cr) {
    var R = global.DG.rtk;
    var f = R.force(forceId);
    var cities = R.citiesOf(forceId), i;
    for (i = 0; i < cities.length; i++) {
      var c = R.city(cities[i]);
      var eat = R.eatOf(cities[i]);
      if (!eat) { continue; }
      if (c.food < eat * 1.5 && f.gold > cr.keepGold) {
        var rate = R.marketRate(cities[i]);
        var want = Math.round(eat * 2 - c.food);
        var afford = Math.floor((f.gold - cr.keepGold) * rate);
        var amt = Math.min(want, afford);
        if (amt < 50) { continue; }
        var r1 = R.trade(cities[i], 'buy', amt);
        if (r1.ok) { return { city: cities[i], dir: 'buy', amt: amt }; }
      } else if (c.food > eat * 6 && f.gold < cr.keepGold * 1.5) {
        var surplus = Math.round(c.food - eat * 4);
        if (surplus < 200) { continue; }
        var r2 = R.trade(cities[i], 'sell', surplus);
        if (r2.ok) { return { city: cities[i], dir: 'sell', amt: surplus }; }
      }
    }
    return null;
  }

  /** 그 성과 맞닿은 적 가운데 가장 센 수비 */
  function threatAt(forceId, cityId) {
    var R = global.DG.rtk;
    var adj = CD.find(cityId).adj, worst = 0, i;
    for (i = 0; i < adj.length; i++) {
      var c = R.city(adj[i]);
      if (c && c.force && c.force !== forceId && c.troops > worst) { worst = c.troops; }
    }
    return worst;
  }

  /**
   * 이 성이 이웃 싸움에 내줄 수 있는 병력.
   *
   * 절반까지 — **다만 제 성이 비면 못 준다.** 이 단서가 없으면 AI 가 뒷마당을
   * 텅 비운 채 전군을 몰아쳐 첫해에 판이 쓸려 나간다(가만히 둔 유비가 한 달,
   * 조조가 넉 달 만에 멸망했다). 실제로 그렇게 두고 열세 세력을 재 봤다.
   */
  function spareOf(forceId, cityId) {
    var R = global.DG.rtk;
    var c = R.city(cityId);
    if (!c || c.force !== forceId) { return 0; }
    var keep = Math.round(threatAt(forceId, cityId) * 0.6);
    return Math.max(0, Math.min(Math.floor(c.troops * 0.5), c.troops - keep));
  }

  /** 이웃한 우리 성에서 끌어올 수 있는 병력 */
  function gatherable(forceId, cityId) {
    var adj = CD.find(cityId).adj, sum = 0, i;
    for (i = 0; i < adj.length; i++) { sum += spareOf(forceId, adj[i]); }
    return sum;
  }

  /** 실제로 끌어온다 — 사람이 쓰는 war.transfer 를 그대로 쓴다 */
  function gather(forceId, cityId) {
    var R = global.DG.rtk;
    var adj = CD.find(cityId).adj, moved = 0, i;
    for (i = 0; i < adj.length; i++) {
      var t = spareOf(forceId, adj[i]);
      if (t < 200) { continue; }
      var f = Math.floor(R.city(adj[i]).food * 0.3);
      if (global.DG.war.transfer(adj[i], cityId, t, f).ok) { moved += t; }
    }
    return moved;
  }

  /**
   * 이길 만한 이웃 성이 있으면 친다.
   * **한 성의 병력만으로는 성벽을 못 넘는다** — 이웃한 우리 성에서 먼저 끌어모은다.
   * 이 단계를 빼면 어느 세력도 영영 출진하지 못한다.
   */
  function tryWar(forceId, cr) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var war = global.DG.war;
    var cities = R.citiesOf(forceId);
    var best = null, i, j;

    for (i = 0; i < cities.length; i++) {
      var from = R.city(cities[i]);
      var ready = R.readyAt(cities[i]);
      if (!ready.length) { continue; }
      var lead = off.sortByPower(ready).slice(0, 3).map(function (h) { return h.id; });
      var send = Math.floor((from.troops + gatherable(forceId, cities[i])) * 0.85);
      if (send < 800) { continue; }

      var adj = CD.find(cities[i]).adj;
      for (j = 0; j < adj.length; j++) {
        var to = R.city(adj[j]);
        if (!to || !to.force || to.force === forceId) { continue; }
        if (global.DG.diplo.blocked(forceId, to.force)) { continue; }
        /* 물길이면 배에 타는 만큼만 간다 — 배가 없으면 아예 못 간다 */
        var wet = CD.isWater(cities[i], adj[j]);
        var sendHere = wet ? Math.min(send, (from.ships || 0) * war.SHIP_CREW) : send;
        if (sendHere < 800) { continue; }
        var f = war.forecast(cities[i], adj[j], lead, sendHere);
        if (!f) { continue; }
        if (f.lossA > sendHere * cr.lossCap) { continue; }   // 이겨도 너무 비싸면 참는다
        /* 이 달에 못 떨어뜨려도 **성벽을 크게 깎으면** 친다.
           한 달 안에 끝날 싸움만 고르게 두면 공성이라는 것이 판에서 사라진다
           (수전은 성벽을 안 깎으므로 이 길로는 안 걸린다) */
        var grind = !f.won && !wet && f.wallTo < to.wall * 0.4 &&
          f.lossA < sendHere * cr.lossCap * 0.7;
        if (!f.won && !grind) { continue; }
        /* 우호가 높은 이웃은 맹약이 없어도 덜 매력적인 표적으로 친다 —
           격식(동맹·화친)만 전쟁을 막던 것을 관계 자체가 조금씩 미는 쪽으로
           바꿨다. 표적을 고를 여지가 있을 때만 순위를 흔들 뿐, f.won/grind
           문턱은 그대로라 "칠 만한가"의 판정 자체는 안 건드린다 */
        var rel = global.DG.diplo.relation(forceId, to.force);
        var gain = (f.won ? 1 : 0.35) - f.lossA / Math.max(1, sendHere) - rel / 500;
        if (!best || gain > best.gain) {
          best = { from: cities[i], to: adj[j], gain: gain, lead: lead,
                   send: sendHere, water: wet };
        }
      }
    }
    if (!best) { return null; }

    gather(forceId, best.from);
    /* 끌어모은 뒤의 실제 병력으로 다시 센다 — 예상보다 적게 모였을 수 있다.
       **다른 적을 앞에 둔 성은 다 비우지 않는다** — 나가서 이기고 뒤를 뺏기면 헛일이다 */
    var staging = R.city(best.from);
    var keepHome = Math.round(threatAt(forceId, best.from) * 0.5);
    var real = Math.min(Math.floor(staging.troops * 0.85),
                        Math.max(0, staging.troops - keepHome));
    if (best.water) { real = Math.min(real, (staging.ships || 0) * war.SHIP_CREW); }
    if (real < 800) { return null; }
    var chk = war.canMarch(best.from, best.to, real);
    if (!chk.ok) { return null; }
    for (var k = 0; k < best.lead.length; k++) { off.rec(best.lead[k]).done = true; }
    var rep = war.march(best.from, best.to, best.lead, real);
    return rep && rep.ok ? { from: best.from, to: best.to, won: rep.won, send: real } : null;
  }

  /**
   * 승진 — **사람이 쓰는 `off.promote` 를 그대로 부른다.**
   * 고르는 눈은 하나뿐이다: 올릴 수 있는 사람 가운데 **충성이 가장 낮은 사람**.
   * 원작에서 관직이 하는 일이 그것이다 — 떠나려는 사람을 붙든다.
   * 이 줄이 없으면 AI 는 120개월을 굴려도 승진이 한 단도 없고,
   * 사람 쪽만 관직 배수를 받아 판이 한쪽으로 기운다(실제로 그렇게 재 봤다).
   */
  function tryPromote(forceId, cr) {
    var R = global.DG.rtk, off = global.DG.off;
    var f = R.force(forceId);
    if (!f || !off.promoteCheck) { return null; }
    var list = off.ofForce(forceId), best = null, low = 101, i;
    for (i = 0; i < list.length; i++) {
      var chk = off.promoteCheck(list[i].id);
      if (!chk.ok) { continue; }
      /* 금고를 승진에 다 쓰지 않는다 — 성향이 정한 살림 밑돈은 남긴다 */
      if (f.gold - chk.cost.gold < (cr || creedOf(forceId)).keepGold) { continue; }
      var lo = off.loyalOf(list[i].id);
      if (lo < low) { low = lo; best = list[i]; }
    }
    if (!best) { return null; }
    var res = off.promote(best.id);
    return res.ok ? { id: best.id, rank: res.rank } : null;
  }

  function tryPlot(forceId) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var D = global.DG.diplo;
    var f = R.force(forceId);
    var cities = R.citiesOf(forceId), i, j;
    /* 지력이 가장 높은, 아직 안 쓴 사람이 건다 */
    var who = null, wv = -1;
    for (i = 0; i < cities.length; i++) {
      var ready = R.readyAt(cities[i]);
      for (j = 0; j < ready.length; j++) {
        var w = off.stats(ready[j].id).wisdom;
        if (w > wv) { wv = w; who = ready[j]; }
      }
    }
    if (!who || wv < 70) { return null; }

    /* 맞닿은 적 성 하나 */
    var targets = [];
    for (i = 0; i < cities.length; i++) {
      var adj = CD.find(cities[i]).adj;
      for (j = 0; j < adj.length; j++) {
        var c = R.city(adj[j]);
        if (c && c.force && c.force !== forceId && !D.blocked(forceId, c.force)) { targets.push(adj[j]); }
      }
    }
    if (!targets.length) { return null; }
    var target = targets[Math.floor(Math.random() * targets.length)];
    var kinds = ['discord', 'rumor', 'fire'];
    var kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (f.gold < D.plotByKey(kind).gold * 2) { return null; }
    var res = D.plot(kind, who.id, target, null);
    return res.ok ? { kind: kind, city: target, done: res.done } : null;
  }

  /**
   * 외교 한 수 — 상황에 따라 **동맹 · 화친 · 조공** 중 하나를 고른다.
   * 예전엔 화친 하나뿐이라 `diplo.commonEnemy()`가 사람 몫으로만 살아 있었다 —
   * AI 끼리는 아무리 판을 굴려도 동맹을 안 맺어(적벽처럼 시나리오가 못 박아
   * 주지 않는 한) "함께 맞서는" 그림이 안 나왔다. 이제 셋을 다 쓴다.
   */
  function tryEnvoy(forceId) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var D = global.DG.diplo;
    var f = R.force(forceId);
    var nb = D.neighbours(forceId).filter(function (x) { return !D.blocked(forceId, x); });
    if (!nb.length) { return null; }
    var mine = R.summary(forceId).cities;

    var who = null, wv = -1, cities = R.citiesOf(forceId), i, j;
    for (i = 0; i < cities.length; i++) {
      var ready = R.readyAt(cities[i]);
      for (j = 0; j < ready.length; j++) {
        var w = off.stats(ready[j].id).wisdom;
        if (w > wv) { wv = w; who = ready[j]; }
      }
    }
    if (!who) { return null; }

    /* 1) 공동의 적을 둔 이웃과는 동맹을 청한다 — 화친보다 값을 더 쓴다
          (동맹이 더 큰 다짐이다). 적벽의 손·유 동맹을 시나리오 밖에서도
          저절로 흉내 낼 수 있어야 "삼국지 같다" */
    var allyCand = nb.filter(function (x) {
      return !D.alliedWith(forceId, x) && D.commonEnemy(forceId, x) && D.relation(forceId, x) >= 40;
    });
    if (allyCand.length && f.gold >= 400) {
      var to1 = allyCand[Math.floor(Math.random() * allyCand.length)];
      var res1 = D.envoy('ally', to1, who.id, 300);
      return res1.ok ? { to: to1, kind: 'ally', done: res1.done } : null;
    }

    /* 2) 나보다 센 이웃에게 화친을 청한다 — 약한 쪽이 시간을 사는 것이 외교다 */
    var bySize = nb.slice().sort(function (a, b) { return R.summary(b).cities - R.summary(a).cities; });
    var to = bySize[0];
    if (R.summary(to).cities > mine) {
      if (f.gold < 400) { return null; }
      var res2 = D.envoy('truce', to, who.id, 150);
      return res2.ok ? { to: to, kind: 'truce', done: res2.done } : null;
    }

    /* 3) 딱히 위협도 동맹거리도 없으면, 금이 넉넉할 때 우호가 가장 낮은
          이웃에게 미리 조공을 보내 관계를 다져 둔다(위협이 닥친 뒤가 아니라
          미리 사 두는 시간이다) */
    if (f.gold >= 800) {
      var weakest = nb.slice().sort(function (a, b) { return D.relation(forceId, a) - D.relation(forceId, b); })[0];
      var res3 = D.envoy('tribute', weakest, who.id, 200);
      return res3.ok ? { to: weakest, kind: 'tribute', done: res3.done } : null;
    }
    return null;
  }

  /** 사람 것을 뺀 모든 세력이 한 달을 산다 */
  function runAll() {
    var R = global.DG.rtk;
    var ids = R.liveForces(), out = [], i;
    for (i = 0; i < ids.length; i++) {
      if (ids[i] === R.me()) { continue; }
      if (R.state().result) { break; }
      if (global.DG.statecraft) { global.DG.statecraft.aiSpend(ids[i]); }   // 경륜도(W-0182) — 쌓인 점수를 성향대로 찍는다
      if (global.DG.trade) { global.DG.trade.aiStep(ids[i]); } if (global.DG.wonder) { global.DG.wonder.aiStep(ids[i]); } if (global.DG.tech) { global.DG.tech.aiStep(ids[i]); }   // W-0279 금이 넉넉하면 불가사의를 짓는다 · W-0290 성향대로 연구
      out.push({ force: ids[i], did: runForce(ids[i]) });
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.rtkAI = {
    CREED: CREED, creedOf: creedOf,
    pickOrder: pickOrder, bestFor: bestFor,
    runForce: runForce, threatAt: threatAt, spareOf: spareOf,
    gatherable: gatherable, gather: gather,
    tryWar: tryWar, trySupply: trySupply, tryTrade: tryTrade, tryPromote: tryPromote,
    tryPlot: tryPlot, tryEnvoy: tryEnvoy,
    runAll: runAll
  };
})(window);
