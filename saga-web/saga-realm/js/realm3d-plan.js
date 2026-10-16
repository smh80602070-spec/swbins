/**
 * 5천하 지도 위 배우 계획(PLAN §5-10) — 원정 앞장·병종·태수 몸짓 표·떠돌이·싸움 자리·태수 후보·걷기 보간. realm3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * 대부분 순수 함수다. realm3d.js 가 `setup({ asset3d, ACTORS_ON, W, clamp, R, cityData, hashOf, cityTier, WORLD_SCALE, ACTOR_MAX, TIER_H })` 로 손잡이를 넘기고 같은 이름으로 부른다.
 * 상수(ORDER_GESTURES·GESTURE_*·WANDER_*·BATTLE_MAX·BOUT_S)는 realm3d.js 가 이 파일에서 읽어 같은 이름으로 둔다(이 파일이 먼저 실린다).
 */
(function (global) {
  'use strict';

  var asset3d, ACTORS_ON, W, clamp, R, cityData, hashOf, cityTier, WORLD_SCALE, ACTOR_MAX, TIER_H;
  var api = null;
  function setup(h) { asset3d = h.asset3d; ACTORS_ON = h.ACTORS_ON; W = h.W; clamp = h.clamp; R = h.R; cityData = h.cityData; hashOf = h.hashOf; cityTier = h.cityTier; WORLD_SCALE = h.WORLD_SCALE; ACTOR_MAX = h.ACTOR_MAX; TIER_H = h.TIER_H; return api; }

  /** 원정 무장 중 통솔이 가장 높은 사람이 앞장선다(같으면 목록 앞사람) */
  function leaderOf(ids) {
    var O = global.DG.off, best = null, bc = -1, i, c;
    for (i = 0; i < ids.length; i++) {
      c = (O && O.stats) ? (O.stats(ids[i]).command || 0) : 0;
      if (c > bc) { bc = c; best = ids[i]; }
    }
    return best;
  }
  /** 병사 n 명의 병종 — war.js `troopMixOf`(화면용 비율)를 따르고, 기병을
   *  결정적으로 사이사이 끼운다(battle3d 처럼 Math.random 을 안 쓴다 — 진단이
   *  같은 목록을 두 번 뽑아 비교한다). 원정은 늘 육로라 수군은 없다 */
  function soldierTypes(n, mix) {
    var cavN = Math.min(n, Math.round(n * ((mix && mix.cav) || 0)));
    var arr = [], i;
    for (i = 0; i < n; i++) { arr.push('inf'); }
    for (i = 0; i < cavN; i++) { arr[Math.floor((i + 0.5) * n / cavN)] = 'cav'; }
    return arr;
  }

  /** ② 태수 몸짓 — 내정 명령(rtk ORDERS 열 가지) → 표준 클립 슬롯(asset3d SLOTS) 우선순위.
   *  인물 몸(QRPG·VRoid 자체 몸짓)에 괭이질·망치질 같은 전용 클립이 없어 가까운 표준
   *  동작으로 갈음하고, 무슨 일인지는 머리 위 그림문자(명령 emoji)가 말한다. 몸에 없는
   *  슬롯(대체 별칭)은 건너뛰고 다음 것을 쓴다 — 다 없으면 idle */
  var ORDER_GESTURES = {
    agri:   ['interaction', 'attack'],   // 개간 — 허리 굽혀 줍기(PickUp) / 내리치기
    comm:   ['interaction', 'idle'],     // 상업 — 물건 집어 건네기
    tech:   ['attack', 'interaction'],   // 기술 — 두드리기
    sec:    ['interaction', 'idle'],     // 치안 — 살피기
    wall:   ['attack', 'interaction'],   // 축성 — 망치질
    draft:  ['jump', 'interaction'],     // 징병 — 뛰어올라 외치기
    train:  ['attack'],                  // 훈련 — 칼 휘두르기
    ships:  ['attack', 'interaction'],   // 조선 — 두드리기
    search: ['interaction', 'idle'],     // 수색 — 뒤져 보기
    hire:   ['interaction', 'idle']      // 등용 — 몸 굽혀 읍하기
  };
  var GESTURE_EVERY = 2.6;              // 초 — 몸짓 한 번 + 쉬기
  var GESTURE_ON = 1.3;                 // 그중 몸짓하는 앞부분

  /**
   * 순수 함수 — 이 달 지도에 설 배우 목록. `state` 만 읽고 아무것도 안 바꾼다.
   * 원정 원소: { kind:'journey', id, force, officer, x, y(지금 자리, 지도 좌표), px, py(지난달
   * 자리), elapsed, total, path, clip(움직일 때 클립), rest(설 때 클립), soldiers[] }
   * 태수 원소: { kind:'governor', id:'gov:<성>', city, force, officer, x, y(성문 앞), order(명령
   * key|null), emoji, clips(몸짓 슬롯 우선순위), rest }
   * 순서: 원정(내 것 → 병력 순 → id) 먼저, 남는 자리에 태수(이 달 명령한 곳·내 성·`opt.focus`
   * 에 가까운 곳 먼저). 상한 ACTOR_MAX. 손잡이 0 이면 빈 목록.
   * @param opt { orders: {성: {key}}(기본 rtk.monthOrders()), focus: {x,y}(지도 좌표, 카메라 중심) }
   */
  function actorPlan(st, opt) {
    if (!ACTORS_ON() || !st || !st.started) { return []; }
    var list = st.journeys || [], out = [], i;
    for (i = 0; i < list.length; i++) {
      var j = list[i];
      if (!j || !j.officers || !j.officers.length) { continue; }
      var pos = journeyPos(j);
      if (!pos) { continue; }
      var el = j.monthsElapsed || 0;
      var prev = journeyPos(j, Math.max(0, el - 1));
      var mix = (W() && W().troopMixOf) ? W().troopMixOf({ officers: j.officers, water: false }) : null;
      var n = clamp(Math.round((j.troops || 0) / 4000) + 2, 3, 5);
      out.push({
        kind: 'journey', id: j.id, force: j.force, officer: leaderOf(j.officers),
        troops: j.troops || 0, mine: j.force === st.me,
        x: pos.x, y: pos.y, px: prev.x, py: prev.y,
        elapsed: el, total: j.monthsTotal || 1, path: j.path,
        clip: 'walk', rest: 'idle', soldiers: soldierTypes(n, mix)
      });
    }
    out.sort(function (a, b) {
      if (a.mine !== b.mine) { return a.mine ? -1 : 1; }
      if (a.troops !== b.troops) { return b.troops - a.troops; }
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    out = out.slice(0, ACTOR_MAX);
    /* 싸움 자리는 장수 둘이라 두 칸을 쓴다(`slots`) — 상한은 사람 수로 센다 */
    var used = out.length, fights = battlePlan(st, opt || {}), k;
    for (k = 0; k < fights.length && used + 2 <= ACTOR_MAX; k++) { out.push(fights[k]); used += 2; }
    if (used < ACTOR_MAX) {
      /* ④ 재야·세작 — 태수가 150 성을 다 채우면 떠돌이가 설 자리가 없으니 WANDER_MAX 만큼은
         태수보다 먼저 떼어 둔다(쓸 사람이 없으면 태수가 그 자리도 쓴다) */
      var wand = wanderPlan(st, opt || {}).slice(0, Math.min(WANDER_MAX, ACTOR_MAX - used));
      var govs = governorPlan(st, opt || {}), busy = {};
      for (k = 0; k < out.length; k++) { if (out[k].kind === 'battle') { busy[out[k].city] = true; } }
      govs = govs.filter(function (g) { return !busy[g.city]; });   // 싸움 난 성은 태수 대신 싸움
      out = out.concat(govs.slice(0, ACTOR_MAX - used - wand.length), wand);
    }
    return out;
  }

  /** ④ 재야·세작 — 드러난(found) 재야가 주인 있는 성에서 이웃 성 쪽 길을 느리게
   *  오간다(수색 전 숨은 사람은 안 보인다 — 스포일러). 주인 없는 성의 사람은 재야가
   *  아니라 수비 무장이라 뺀다. 이 달 세작이 물어 온 사람(`rtk.monthScouts`)은 밤 톤(`spy`)
   *  으로 그 성 곁에 선다. 원소: { kind:'wander', id:'wander:<무장>', officer, city, toward,
   *  x0,y0 → x1,y1(오가는 두 끝, 지도 좌표), phase(0~1, id 해시), spy, force:null } */
  var WANDER_MAX = 4;
  var WANDER_REACH = 0.4;             // 이웃 성까지 거리의 이만큼만 나갔다 돌아온다
  var WANDER_PERIOD = 24;             // 초 — 한 번 다녀오는 데
  function wanderPlan(st, opt) {
    var rtkO = R(), O = global.DG.off, CDx = cityData();
    var scouts = opt.scouts || (rtkO && rtkO.monthScouts ? rtkO.monthScouts() : null) || {};
    var spyOf = {}, cid;
    for (cid in scouts) { if (Object.prototype.hasOwnProperty.call(scouts, cid)) { spyOf[scouts[cid]] = true; } }
    var focus = opt.focus || null, out = [], ids = Object.keys(st.officers || {}).sort(), i;
    for (i = 0; i < ids.length; i++) {
      var r = st.officers[ids[i]];
      if (!r || r.force || !r.found || !r.city || r.dead) { continue; }
      var cs = st.cities && st.cities[r.city], cd = CDx.find(r.city);
      if (!cs || !cs.force || !cd || !cd.adj || !cd.adj.length) { continue; }
      var h = hashOf(ids[i]), nb = CDx.find(cd.adj[h % cd.adj.length]);
      if (!nb) { continue; }
      var spy = !!spyOf[ids[i]];
      var score = focus ? Math.hypot(cd.x - focus.x, cd.y - focus.y) : 0;
      if (spy) { score -= 30; }
      if (cs.force === st.me) { score -= 10; }
      out.push({
        kind: 'wander', id: 'wander:' + ids[i], officer: ids[i], city: r.city, toward: nb.id, force: null,
        x0: cd.x, y0: cd.y, x1: cd.x + (nb.x - cd.x) * WANDER_REACH, y1: cd.y + (nb.y - cd.y) * WANDER_REACH,
        phase: (h % 1000) / 1000, spy: spy, clip: 'walk', rest: 'idle', score: score
      });
    }
    out.sort(function (p, q) {
      if (p.score !== q.score) { return p.score - q.score; }
      return p.id < q.id ? -1 : (p.id > q.id ? 1 : 0);
    });
    return out;
  }

  /** 순수 함수 — 떠돌이의 시각 s(초) 자리(지도 좌표)와 가는 쪽. 세작은 성 곁에 서 있다.
   *  한 주기에 x0 → x1 → x0 를 코사인으로 부드럽게(끝에서 잠깐 머뭇) 오간다 */
  function wanderPos(a, s) {
    if (a.spy) { return { x: a.x0 + (a.x1 - a.x0) * 0.12, y: a.y0 + (a.y1 - a.y0) * 0.12, out: true, moving: false }; }
    var u = ((s / WANDER_PERIOD) + a.phase) % 1;
    if (u < 0) { u += 1; }
    var k = (1 - Math.cos(u * Math.PI * 2)) / 2;          // 0 → 1 → 0
    return { x: a.x0 + (a.x1 - a.x0) * k, y: a.y0 + (a.y1 - a.y0) * k, out: u < 0.5,
             moving: Math.sin(u * Math.PI * 2) * Math.sin(u * Math.PI * 2) > 0.04 };
  }

  /** ③ 전투 자리 — 이 달 싸움 난 성마다, 공격해 온 쪽 진입로(성 → 출발 성 방향)에서
   *  두 지휘관이 맞붙는다. 원소: { kind:'battle', id:'fight:<성>', city, a, d(무장 id),
   *  force, defForce, result('atk'|'def'|'draw'), x, y(두 사람 가운데), dx, dy(공격군이
   *  바라보는 쪽, 단위 벡터), slots:2 }. 내 싸움 → 카메라 가까운 순 → id */
  var BATTLE_MAX = 6;
  function battlePlan(st, opt) {
    var rtkO = R();
    var fights = opt.battles || (rtkO && rtkO.monthBattles ? rtkO.monthBattles() : null) || {};
    var focus = opt.focus || null, CDx = cityData(), out = [], id;
    for (id in fights) {
      if (!Object.prototype.hasOwnProperty.call(fights, id)) { continue; }
      var f = fights[id], to = CDx.find(f.to);
      if (!to || !f.a || !f.d) { continue; }
      var fr = f.from ? CDx.find(f.from) : null;
      var ux = 0, uy = 1;                            // 출발 성을 모르면 성문 쪽(+y)
      if (fr) {
        var len = Math.hypot(fr.x - to.x, fr.y - to.y);
        if (len > 1e-6) { ux = (fr.x - to.x) / len; uy = (fr.y - to.y) / len; }
      }
      var foot = Math.max(3.2, TIER_H[cityTier(to)] * 0.5);
      var off = (foot + 6) / WORLD_SCALE();
      var mine = f.force === st.me || f.defForce === st.me;
      var score = focus ? Math.hypot(to.x - focus.x, to.y - focus.y) : 0;
      if (mine) { score -= 40; }
      out.push({
        kind: 'battle', id: 'fight:' + f.to, city: f.to, a: f.a, d: f.d, officer: f.a,
        force: f.force, defForce: f.defForce, result: f.result, mine: mine,
        x: to.x + ux * off, y: to.y + uy * off, dx: -ux, dy: -uy, slots: 2, score: score
      });
    }
    out.sort(function (p, q) {
      if (p.score !== q.score) { return p.score - q.score; }
      return p.id < q.id ? -1 : (p.id > q.id ? 1 : 0);
    });
    return out.slice(0, BATTLE_MAX);
  }

  /** 순수 함수 — 싸움 자리 연출표: 시각 s(초, 등장부터)에 두 사람(a 공격·d 수비)이 할
   *  동작. 합 셋(0.9초씩: 공격군 치기 → 수비군 치기 → 이긴 쪽 치기, 비기면 둘째 합까지)
   *  뒤 진 쪽은 death 에서 멈추고 이긴 쪽은 idle, 결과 깃발이 선다(flag). 비기면 아무도
   *  안 쓰러지고 둘 다 idle(진을 쳤다). `hit` 는 그 합이 막 시작됐는지(원샷 다시 틀기) */
  var BOUT_S = 0.9;
  function battleBeat(result, s) {
    var bout = Math.floor(s / BOUT_S), rounds = result === 'draw' ? 2 : 3;
    if (s < 0) { return { a: 'idle', d: 'idle', bout: -1, flag: false }; }
    if (bout < rounds) {
      var aHits = bout === 0 || (bout === 2 && result === 'atk');
      return aHits ? { a: 'attack', d: 'hit', bout: bout, flag: false }
                   : { a: 'hit', d: 'attack', bout: bout, flag: false };
    }
    if (result === 'atk') { return { a: 'idle', d: 'death', bout: rounds, flag: true }; }
    if (result === 'def') { return { a: 'death', d: 'idle', bout: rounds, flag: true }; }
    return { a: 'idle', d: 'idle', bout: rounds, flag: true };
  }

  /** 태수 후보 — 주인 있는 성에 태수가 앉아 있고 그 사람이 성 안에 있을 때 */
  function governorPlan(st, opt) {
    var rtkO = R();
    var orders = opt.orders || (rtkO && rtkO.monthOrders ? rtkO.monthOrders() : null) || {};
    var focus = opt.focus || null;
    var cities = cityData().CITIES, O = global.DG.off, out = [], i;
    for (i = 0; i < cities.length; i++) {
      var cd = cities[i], cs = st.cities && st.cities[cd.id];
      if (!cs || !cs.force || !cs.gov) { continue; }
      var rec = (O && O.rec) ? O.rec(cs.gov) : null;
      if (rec && (rec.city !== cd.id || rec.journey)) { continue; }
      var od = orders[cd.id], key = (od && ORDER_GESTURES[od.key]) ? od.key : null;
      var info = (key && rtkO && rtkO.orderByKey) ? rtkO.orderByKey(key) : null;
      /* 성문 앞 — 탑 밑동(footprint)보다 조금 더 앞(+z, 기본 카메라 쪽) */
      var foot = Math.max(3.2, TIER_H[cityTier(cd)] * 0.5);
      var gx = cd.x, gy = cd.y + (foot + 3.2) / WORLD_SCALE();
      var score = focus ? Math.hypot(cd.x - focus.x, cd.y - focus.y) : 0;
      if (key) { score -= 25; }
      if (cs.force === st.me) { score -= 10; }
      if (opt.pin === cd.id) { score -= 1000; }       // ⑤ 방금 누른 성의 태수는 반드시 선다
      out.push({
        kind: 'governor', id: 'gov:' + cd.id, city: cd.id, force: cs.force, officer: cs.gov,
        mine: cs.force === st.me, x: gx, y: gy, order: key, emoji: info ? info.emoji : null,
        clips: key ? ORDER_GESTURES[key].slice() : [], rest: 'idle', score: score
      });
    }
    out.sort(function (a, b) {
      if (a.score !== b.score) { return a.score - b.score; }
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    return out;
  }

  /** 순수 함수 — 걷기 보간 중 배우 자리(지도 좌표). frac 0 = 지난달(`fromEl`,
   *  안 주면 elapsed-1) 자리, 1 = 이번 달 자리(= `journeyPos(j)`). 길을 따라
   *  꺾이며 가므로 두 점을 곧게 잇는 것과 다르다 */
  function actorPos(a, frac, fromEl) {
    var from = (fromEl === undefined || fromEl === null) ? Math.max(0, a.elapsed - 1) : fromEl;
    var el = from + (a.elapsed - from) * clamp(frac, 0, 1);
    return journeyPos({ path: a.path, monthsTotal: a.total }, el);
  }

  /** 원정 하나가 경로 위 지금 어디쯤 있는가(화면 x·y) — `ui-rtk.js` 의
   *  `journeyPos()` 와 같은 구간별 실거리 보간이다(두 파일이 같은 값을
   *  따로 계산한다 — 2D·3D 가 별 모듈이라 공유할 자리가 마땅치 않다) */
  /*  `elapsed`(선택)를 주면 `j.monthsElapsed` 대신 그 값(소수 가능)으로 잰다 —
   *  배우가 지난달 자리→이번 달 자리로 길을 따라 걷는 보간(PLAN §5-10 ①)이
   *  같은 함수를 쓴다. 안 주면 예전 그대로다 */
  function journeyPos(j, elapsed) {
    var CDx = cityData();
    var path = j.path, i;
    if (!path || path.length < 2) {
      var only = path && CDx.find(path[0]);
      return only ? { x: only.x, y: only.y } : null;
    }
    var el = (elapsed === undefined || elapsed === null) ? (j.monthsElapsed || 0) : elapsed;
    var frac = clamp(el / (j.monthsTotal || 1), 0, 0.999);
    var segs = [], total = 0;
    for (i = 0; i < path.length - 1; i++) {
      var a = CDx.find(path[i]), b = CDx.find(path[i + 1]);
      if (!a || !b) { continue; }
      var len = Math.hypot(a.x - b.x, a.y - b.y);
      segs.push({ a: a, b: b, len: len });
      total += len;
    }
    if (!segs.length) { return null; }
    if (!total) { return { x: segs[0].a.x, y: segs[0].a.y }; }
    var target = frac * total, acc = 0;
    for (i = 0; i < segs.length; i++) {
      if (acc + segs[i].len >= target || i === segs.length - 1) {
        var sf = segs[i].len > 0 ? clamp((target - acc) / segs[i].len, 0, 1) : 0;
        return { x: segs[i].a.x + (segs[i].b.x - segs[i].a.x) * sf,
                 y: segs[i].a.y + (segs[i].b.y - segs[i].a.y) * sf };
      }
      acc += segs[i].len;
    }
    return { x: segs[segs.length - 1].b.x, y: segs[segs.length - 1].b.y };
  }

  api = { setup: setup, journeyPos: journeyPos, leaderOf: leaderOf, soldierTypes: soldierTypes, actorPlan: actorPlan, wanderPlan: wanderPlan, wanderPos: wanderPos, battlePlan: battlePlan, battleBeat: battleBeat, governorPlan: governorPlan, actorPos: actorPos,
    ORDER_GESTURES: ORDER_GESTURES, GESTURE_EVERY: GESTURE_EVERY, GESTURE_ON: GESTURE_ON, WANDER_MAX: WANDER_MAX, WANDER_REACH: WANDER_REACH, WANDER_PERIOD: WANDER_PERIOD, BATTLE_MAX: BATTLE_MAX, BOUT_S: BOUT_S };
  global.DG = global.DG || {};
  global.DG.realm3dPlan = api;
})(typeof window !== 'undefined' ? window : this);
