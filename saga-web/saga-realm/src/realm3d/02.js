  /* ── 지도 위 배우(PLAN §5-10 "리얼리티") ───────────────────
   * ① 원정군 — 🚩 하나 대신 이끄는 장수(일기토와 같은 3D 몸, 세력색)와 병사
   * 3~5가 길 위에 선다. ▶ 다음 달로 원정이 한 달 나아가면 ACTOR_TWEEN_MS 동안
   * 지난달 자리 → 이번 달 자리로 **길을 따라** 걷는다(`journeyPos(j, 소수 달)`)
   * — 판정은 war.js 가 이미 끝냈고 여기선 화면만 움직인다. 누가·어디서·무슨
   * 클립인지는 순수 함수 `actorPlan(state)`가 정하고(three 없이 진단된다),
   * 그리는 쪽(`syncActors`·`tickActors`)은 그 목록대로 배우를 만들고·옮기고·
   * 지울 뿐이다. 배우는 `dyn` 이 아니라 `actorGrp` 에 산다 — `changed`(판정
   * 하나마다 울린다)로 `rebuild()` 가 돌 때마다 장수 GLB 를 다시 받으면 걷던
   * 걸음이 끊기기 때문이다. */
  var ACTOR_MAX = 24;               // 한 화면 배우 상한(원정 장수 우선 → 태수 → 재야, §5-10 수치)
  var ACTOR_TWEEN_MS = 1500;        // 지난달 자리 → 이번 달 자리 걷기
  var HERO_SCALE = 5;               // 몸 키 1(normalize) → 성 탑(7~14) 옆에서 사람 크기로 읽히게
  var SOLDIER_SCALE = 1.7;          // 병사 도형(키 약 1.8) → 장수보다 살짝 작게
  var TROOP_SCALE = 4.2;            // 병사 몸(키 1, 기병은 말 키 1.2) → 장수(5)보다 살짝 작게

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

  /* 병사 — 몸통·머리·창(기병은 말 몸통을 더한다). 모양·재질은 전부 공유.
   * 2026-09-25 부터는 몸(`asset3d.buildTrooper`)이 올 때까지 서 있는 자리 표시일 뿐이다 */
  var soldierGeo = null, soldierMats = {};
  function soldierMat(hex) {
    var t = three(), TN = global.DG.toon3d;
    if (!soldierMats[hex]) {
      soldierMats[hex] = TN ? TN.lambertLike({ color: hex }) : new t.MeshLambertMaterial({ color: hex });
    }
    return soldierMats[hex];
  }
  function soldierMesh(color, kind) {
    var t = three();
    if (!soldierGeo) {
      soldierGeo = {
        body: new t.CylinderGeometry(0.3, 0.38, 1.25, 6),
        head: new t.SphereGeometry(0.27, 8, 6),
        spear: new t.CylinderGeometry(0.035, 0.035, 2.4, 4),
        horse: new t.BoxGeometry(0.55, 0.7, 1.55)
      };
    }
    var g = new t.Group(), lift = kind === 'cav' ? 0.75 : 0;
    var hex = new t.Color(color).getHex();
    if (kind === 'cav') {
      var horse = new t.Mesh(soldierGeo.horse, soldierMat(0x5a4028));
      horse.position.y = 0.5;
      g.add(horse);
    }
    var body = new t.Mesh(soldierGeo.body, soldierMat(hex));
    body.position.y = 0.62 + lift;
    g.add(body);
    var head = new t.Mesh(soldierGeo.head, soldierMat(0xe8c9a0));
    head.position.y = 1.5 + lift;
    g.add(head);
    var spear = new t.Mesh(soldierGeo.spear, soldierMat(0x6b5533));
    spear.position.set(0.42, 1.2 + lift, 0.1);
    g.add(spear);
    return g;
  }

  function makeActor(a) {
    var t = three();
    var grp = new t.Group(), col = a.kind === 'wander' ? (a.spy ? SPY_TINT : WANDER_TINT) : forceColor(a.force), k;
    var c = { grp: grp, hero: null, soldiers: [], lastElapsed: a.elapsed, fromEl: a.elapsed, t0: null, plan: a, dead: false,
              sig: actorSig(a), badge: null, badgeKey: null, gOn: false, seed: (hashOf(a.id) % 100) / 37 };
    var sl = a.soldiers || [], rowZ = -3.6, rowD = 0;
    for (k = 0; k < sl.length; k++) {
      /* 두 줄씩 — 줄 깊이는 말이 끼면 말 길이만큼(몸 키 1.2 × 1.33 × TROOP_SCALE ≈ 6.7) */
      if (k % 2 === 0) {
        rowZ -= rowD;
        rowD = (sl[k] === 'cav' || sl[k + 1] === 'cav') ? 7 : 3;
      }
      /* 병사 자리(s) 하나에 도형을 먼저 세우고, 몸이 오면 도형을 걷어 몸으로 바꾼다 */
      var s = new t.Group(), prim = soldierMesh(col, sl[k]);
      prim.scale.setScalar(SOLDIER_SCALE);
      s.add(prim);
      /* 장수 뒤로 두 줄 — 로컬 +z 가 걸어가는 쪽(아래 rotation.y 와 짝). 기병은 말 길이만큼 한 칸 더 옆 */
      s.userData.ox = (k % 2 ? 1 : -1) * (sl[k] === 'cav' ? 2.6 : 2.1);
      s.userData.oz = rowZ - (rowD - 3) / 2;
      s.userData.seed = k * 1.7;
      grp.add(s);
      c.soldiers.push(s);
      if (TROOP_MODEL() && asset3d() && asset3d().buildTrooper) { dressSoldier(c, s, prim, sl[k], col); }
    }
    if (blobGeo) {
      var blob = new t.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.05;
      blob.scale.setScalar(1.8);
      grp.add(blob);
    }
    actorGrp.add(grp);
    var O = global.DG.off;
    if (a.kind === 'battle') { makeDuelists(c, a, O); return c; }
    var ref = (O && O.find && a.officer) ? O.find(a.officer) : null;
    if (ref && asset3d() && asset3d().buildHero) {
      asset3d().buildHero(ref, col, function (m) {
        if (c.dead || !m) { return; }
        m.scale.setScalar(HERO_SCALE);
        grp.add(m);
        c.hero = m;
      });
    }
    return c;
  }
  function dressSoldier(c, s, prim, kind, col) {
    asset3d().buildTrooper(kind, col, function (m) {
      if (c.dead || !m) { return; }
      m.scale.setScalar(TROOP_SCALE);
      s.remove(prim);
      s.add(m);
      s.userData.model = m;
    });
  }
  /** 싸움 자리 — 두 지휘관을 마주 세운다(공격군 로컬 -z·수비군 +z, 그룹은 공격군이 보는
   *  쪽으로 돈다). 결과 깃발은 이긴 쪽 색(비기면 ⛺) — 연출이 끝날 때까지 숨겨 둔다 */
  var DUEL_GAP = 2.0;
  function makeDuelists(c, a, O) {
    c.t0 = now();
    c.duel = { a: null, d: null, bout: -2 };
    var A3 = asset3d();
    [['a', a.a, a.force, -DUEL_GAP, 0], ['d', a.d, a.defForce, DUEL_GAP, Math.PI]].forEach(function (s) {
      var ref = (O && O.find) ? O.find(s[1]) : null;
      if (!ref || !A3 || !A3.buildHero) { return; }
      A3.buildHero(ref, forceColor(s[2]), function (m) {
        if (c.dead || !m) { return; }
        m.scale.setScalar(HERO_SCALE);
        m.position.z = s[3];
        m.rotation.y = s[4];
        c.grp.add(m);
        c.duel[s[0]] = m;
        if (s[0] === 'a') { c.hero = m; }
      });
    });
    if (a.result === 'draw') {
      c.flag = emojiSprite('⛺', 4.2);
      c.flag.position.set(2.6, 3.4, 0);
    } else {
      c.flag = banner(forceColor(a.result === 'atk' ? a.force : a.defForce));
      c.flag.scale.setScalar(2.2);
      c.flag.position.set(2.6, 0, 0);
    }
    c.flag.visible = false;
    c.grp.add(c.flag);
  }
  /** 떠돌이·세작 — 세력이 없어 흙빛(재야), 세작은 밤빛에 몸을 어둡게 */
  var WANDER_TINT = '#8a7a5c', SPY_TINT = '#2c3148';
  function tickWander(c, a, tms, A3) {
    var p = wanderPos(a, tms / 1000);
    var wx = worldX(p.x), wz = worldZ(p.y);
    c.grp.position.set(wx, elevAt(wx, wz), wz);
    var hx = worldX(a.x1) - worldX(a.x0), hz = worldZ(a.y1) - worldZ(a.y0);
    if (!p.out) { hx = -hx; hz = -hz; }
    if (hx * hx + hz * hz > 1e-6) { c.grp.rotation.y = Math.atan2(hx, hz); }
    if (c.hero && A3 && A3.step) { A3.step(c.hero, { anim: p.moving ? a.clip : a.rest, t: tms / 1000 }); }
  }
  function tickBattle(c, a, tms, A3) {
    var wx = worldX(a.x), wz = worldZ(a.y);
    c.grp.position.set(wx, elevAt(wx, wz), wz);
    c.grp.rotation.y = Math.atan2(a.dx, a.dy);   // 로컬 +z = 공격군이 성 쪽으로 보는 방향
    var beat = battleBeat(a.result, (tms - c.t0) / 1000);
    var fresh = beat.bout !== c.duel.bout;
    c.duel.bout = beat.bout;
    if (c.flag) { c.flag.visible = beat.flag; }
    if (!A3 || !A3.step) { return; }
    if (c.duel.a) { A3.step(c.duel.a, { anim: beat.a, force: fresh, t: tms / 1000 }); }
    if (c.duel.d) { A3.step(c.duel.d, { anim: beat.d, force: fresh, t: tms / 1000 }); }
  }

  /** 같은 id 라도 사람·세력이 바뀌면(태수 교체·성 함락) 몸을 새로 지어야 한다 */
  function actorSig(a) {
    return a.kind + '|' + a.officer + '|' + a.force + (a.kind === 'battle' ? '|' + a.d + '|' + a.result : '') +
      (a.kind === 'wander' ? '|' + (a.spy ? 'spy' : '') : '');
  }
  /** 태수 머리 위 명령 그림문자 — 명령이 바뀔 때만 갈아 끼운다 */
  function syncBadge(c, a) {
    var key = a.kind === 'governor' ? a.order : (a.kind === 'wander' && a.spy ? 'spy' : null);
    if (c.badgeKey === key) { return; }
    if (c.badge) { c.grp.remove(c.badge); c.badge = null; }
    c.badgeKey = key;
    if (key === 'spy') {
      c.badge = emojiSprite('🌙', 3.2);
      c.badge.position.y = HERO_SCALE + 2.0;
      c.grp.add(c.badge);
      return;
    }
    if (key && a.emoji) {
      c.badge = emojiSprite(a.emoji, 3.4);
      c.badge.position.y = HERO_SCALE + 2.2;
      c.grp.add(c.badge);
    }
  }
  /** 몸에 실제로 있는 첫 슬롯(별칭으로 떨어진 것은 건너뛴다) — 없으면 null */
  function gestureSlot(model, clips) {
    var cm = model && model.userData && model.userData.clipMap, i;
    if (!cm) { return null; }
    for (i = 0; i < clips.length; i++) {
      if (cm[clips[i]] && !(cm.alias && cm.alias[clips[i]])) { return clips[i]; }
    }
    return null;
  }
  function dropActor(id) {
    var c = actorCache[id];
    if (!c) { return; }
    c.dead = true;
    if (c.hero && c.hero.userData.mixer) { c.hero.userData.mixer.stopAllAction(); }
    (c.soldiers || []).forEach(function (s) {
      var m = s.userData.model;
      if (m && m.userData.mixer) { m.userData.mixer.stopAllAction(); }
    });
    if (c.duel && c.duel.d && c.duel.d.userData.mixer) { c.duel.d.userData.mixer.stopAllAction(); }
    actorGrp.remove(c.grp);
    delete actorCache[id];
  }

  /** ⑤ 순수 함수 — 성을 눌렀을 때 카메라가 갈 곳(세계 좌표 x·z, 거리, 기울기). 태수가 있으면
   *  성문 앞 태수 자리, 없으면 성 한가운데. 가깝게(ZOOM_DIST) 낮게(ZOOM_PITCH) 다가가
   *  사람 키가 읽히게 한다. 없는 성이면 null */
  var ZOOM_DIST = 105, ZOOM_PITCH = 0.62;
  function zoomFor(cityId, st) {
    var cd = cityData().find(cityId);
    if (!cd) { return null; }
    var mx = cd.x, my = cd.y;
    var g = st ? governorPlan(st, { pin: cityId, orders: {} }).filter(function (a) { return a.city === cityId; })[0] : null;
    if (g) { mx = g.x; my = g.y; }
    return { x: clampPan(worldX(mx)), z: clampPan(worldZ(my)),
             dist: clamp(ZOOM_DIST, DIST_MIN(), DIST_MAX()), pitch: clamp(ZOOM_PITCH, PITCH_MIN(), PITCH_MAX()) };
  }
  var pinCity = null;               // 방금 누른 성(태수 자리를 보장한다)
  function zoomToCity(cityId) {
    if (!CITY_ZOOM() || !ACTORS_ON()) { return; }
    var st = R() && R().state ? R().state() : null;
    var z = zoomFor(cityId, st);
    if (!z) { return; }
    pinCity = cityId;
    targetPivotX = z.x; targetPivotZ = z.z; targetDist = z.dist; targetPitch = z.pitch;
    if (st) { syncActors(st); }
  }

  /** 카메라 궤도 중심(세계 좌표) → 지도 좌표 — 태수는 가까운 성부터 뽑는다 */
  function focusMap() { return { x: pivotX / WORLD_SCALE() + 50, y: pivotZ / WORLD_SCALE() + 50 }; }
  var lastSyncX = 0, lastSyncZ = 0;
  var RESYNC_PAN = 60;              // 궤도 중심이 이만큼(세계 단위) 옮겨 가면 태수를 다시 뽑는다

  /** `rebuild()` 끝에서 — 목록대로 배우를 두고, 원정이 한 달 나아갔으면 걷기를 건다 */
  function syncActors(st) {
    if (!actorGrp || !three()) { return; }
    var plan = actorPlan(st, { focus: focusMap(), pin: pinCity }), seen = {}, i, id;
    lastSyncX = pivotX; lastSyncZ = pivotZ;
    for (i = 0; i < plan.length; i++) {
      var a = plan[i], c = actorCache[a.id];
      seen[a.id] = true;
      if (c && c.sig !== actorSig(a)) { dropActor(a.id); c = null; }
      if (!c) { c = actorCache[a.id] = makeActor(a); }
      syncBadge(c, a);
      if (a.elapsed !== c.lastElapsed) {
        /* 걷는 도중 또 한 달이 넘어가면(빨리 누르기) 지금 선 자리에서 이어 걷는다 */
        c.fromEl = (c.t0 !== null && typeof c.curEl === 'number') ? c.curEl : c.lastElapsed;
        c.t0 = now();
        c.lastElapsed = a.elapsed;
      }
      c.plan = a;
    }
    for (id in actorCache) {
      if (Object.prototype.hasOwnProperty.call(actorCache, id) && !seen[id]) { dropActor(id); }
    }
  }

  /** 태수 — 성문 앞에 서서, 이 달 명령이 있으면 GESTURE_EVERY 마다 그 몸짓을 한 번 */
  function tickGovernor(c, a, tms, A3) {
    var wx = worldX(a.x), wz = worldZ(a.y);
    c.grp.position.set(wx, elevAt(wx, wz), wz);
    c.grp.rotation.y = 0;                       // 로컬 +z = 기본 카메라 쪽을 본다
    if (c.badge) { c.badge.position.y = HERO_SCALE + 2.2 + Math.sin(tms / 420 + c.seed) * 0.35; }
    if (!c.hero || !A3 || !A3.step) { return; }
    var slot = a.order ? gestureSlot(c.hero, a.clips) : null;
    var on = !!slot && ((tms / 1000 + c.seed) % GESTURE_EVERY) < GESTURE_ON;
    var start = on && !c.gOn;
    c.gOn = on;
    A3.step(c.hero, { anim: on ? slot : a.rest, force: start, t: tms / 1000 });
  }

  /** 매 프레임 — 멀면(LOD) 배우를 숨기고 🚩 로 돌아간다. 보일 때만 mixer 를 돌린다 */
  function tickActors(tms) {
    if (!actorGrp) { return; }
    var lod = !ACTORS_ON() || dist > ACTOR_LOD(), id;
    actorGrp.visible = !lod;
    for (id in journeyFlags) {
      if (!Object.prototype.hasOwnProperty.call(journeyFlags, id)) { continue; }
      var ac = actorCache[id];
      journeyFlags[id].visible = lod || !(ac && ac.hero);
    }
    if (lod) { return; }
    if (Math.hypot(pivotX - lastSyncX, pivotZ - lastSyncZ) > RESYNC_PAN && R() && R().state) { syncActors(R().state()); }
    var A3 = asset3d();
    for (id in actorCache) {
      if (!Object.prototype.hasOwnProperty.call(actorCache, id)) { continue; }
      var c = actorCache[id], a = c.plan;
      if (a.kind === 'governor') { tickGovernor(c, a, tms, A3); continue; }
      if (a.kind === 'battle') { tickBattle(c, a, tms, A3); continue; }
      if (a.kind === 'wander') { tickWander(c, a, tms, A3); continue; }
      var moving = c.t0 !== null;
      var frac = moving ? Math.min(1, (tms - c.t0) / ACTOR_TWEEN_MS) : 1;
      var el = moving ? c.fromEl + (a.elapsed - c.fromEl) * frac : a.elapsed;
      c.curEl = el;
      var jj = { path: a.path, monthsTotal: a.total };
      var p = journeyPos(jj, el), ahead = journeyPos(jj, el + 0.05);
      if (!p) { continue; }
      var wx = worldX(p.x), wz = worldZ(p.y), gy = elevAt(wx, wz);
      var hx = worldX(ahead.x) - wx, hz = worldZ(ahead.y) - wz;
      if (hx * hx + hz * hz > 1e-6) { c.grp.rotation.y = Math.atan2(hx, hz); }
      c.grp.position.set(wx, gy, wz);
      /* 병사 발을 제 자리 지형에 붙인다(언덕에서 뜨거나 묻히지 않게). 몸이 온 병사는 걷기 클립, 도형은 걸을 때 까딱 */
      var ry = c.grp.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry), k;
      for (k = 0; k < c.soldiers.length; k++) {
        var s = c.soldiers[k], u = s.userData;
        var sx = wx + u.ox * cs + u.oz * sn, sz = wz - u.ox * sn + u.oz * cs;
        var bob = (moving && !u.model) ? Math.abs(Math.sin(tms / 150 + u.seed)) * 0.45 : 0;
        s.position.set(u.ox, elevAt(sx, sz) - gy + bob, u.oz);
        if (u.model && A3 && A3.step) { A3.step(u.model, { anim: moving ? a.clip : a.rest, t: tms / 1000 + u.seed }); }
      }
      if (c.hero && A3 && A3.step) { A3.step(c.hero, { anim: moving ? a.clip : a.rest, t: tms / 1000 }); }
      if (moving && frac >= 1) { c.t0 = null; }
    }
  }

  /** 성과 성 사이 길 — 평지 구간은 예전처럼 한 토막, 언덕·산을 지나는 긴
   *  구간은 몇 토막으로 나눠 지형을 따라 오르내리게 한다(2026-09-04, 높낮이
   *  지형을 얹으며 — 안 나누면 길이 산허리를 그대로 뚫고 지나간다). 토막마다
   *  3D 로 기울여야 해서 Y 축(방향) 뿐 아니라 X 축(오르내림 경사)도 돌린다 */
  /* 성이 바뀔 때마다(core.on('changed')) 지도 전체를 다시 지어서, 길
     토막마다(30여 개 성의 인접 관계 × 최대 8토막) 매번 지오메트리·머티리얼을
     새로 만들었다 — 단위 박스 하나를 스케일만 바꿔 재사용하고, 머티리얼은
     (색·투명도) 조합별로 캐시한다(감사, 2026-09-08) */
  var roadBoxGeo = null, roadMats = {};
  function addRoadSegment(p1, p2, opt) {
    var t = three();
    if (!roadBoxGeo) { roadBoxGeo = new t.BoxGeometry(1, 1, 1); }
    var dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
    var flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy) || 0.001;
    var mkey = opt.color + ':' + opt.opacity;
    var mat = roadMats[mkey];
    if (!mat) { mat = roadMats[mkey] = (opt.water && global.DG.realmWater3d && global.DG.realmWater3d.material(t, 0x3f8cbf)) || new t.MeshBasicMaterial({ color: new t.Color(opt.color), transparent: true, opacity: opt.opacity }); }   // W-0141 강은 물결
    var mesh = new t.Mesh(roadBoxGeo, mat);
    mesh.scale.set(opt.width, 0.06, len);
    mesh.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + opt.y, (p1.z + p2.z) / 2);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.rotation.x = -Math.atan2(dy, flat || 0.001);
    dyn.add(mesh);
  }

  function addRoad(a, b, opt) {
    var ax = worldX(a.x), az = worldZ(a.y), bx = worldX(b.x), bz = worldZ(b.y);
    var flatLen = Math.hypot(bx - ax, bz - az);
    var n = clamp(Math.round(flatLen / 40), 2, 8), i;
    var prev = { x: ax, y: elevAt(ax, az), z: az };
    for (i = 1; i <= n; i++) {
      var f = i / n;
      var px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
      var cur = { x: px, y: elevAt(px, pz), z: pz };
      addRoadSegment(prev, cur, opt);
      prev = cur;
    }
  }

  /** 지형지물 — 산은 봉우리, 구릉은 낮은 둔덕, 나머지는 나무·바위를 몇 개 흩는다.
   *  같은 성은 늘 같은 자리에 같은 것이 선다(해시 기반 — 매번 안 흔들린다, static) */
  function scatterAround(city, seq, grp) {
    var cx = worldX(city.x), cz = worldZ(city.y);
    /* 2026-09-10 — "맵이 텅 비어 보인다" 피드백으로 성 하나당 1개씩 늘렸다.
       카메라가 가장 오래 머무는 자리(성 바로 곁)라 여기를 조금만 늘려도
       체감이 크고, 성 하나당 늘어난 수(93성 × 1)도 저 아래 scatterField
       증가분보다 훨씬 적어 성능 부담이 작다.
       2026-09-11 — "아직도 텅 비어 보인다"는 재지적으로 한 번 더 늘렸다. */
    var n = city.land === 'mount' ? 4 : (city.land === 'hill' ? 4 : 5);
    var i;
    for (i = 0; i < n; i++) {
      var hh = hashOf(city.id + ':' + i);
      var ang = ((hh % 360) / 360) * Math.PI * 2;
      var r = 6 + (hh % 5);
      var px = cx + Math.cos(ang) * r, pz = cz + Math.sin(ang) * r;
      if (isSea(px, pz)) { continue; }
      var kind = city.land === 'mount' ? 'mount' : (((hh >> 4) % 3) === 0 ? 'rock' : 'tree');
      var scaleH = kind === 'mount' ? (7 + (hh % 5)) : (kind === 'rock' ? 0.9 : (2.2 + (hh % 12) / 10));
      addProp(kind, city.id + ':' + kind + ':' + i, px, pz, scaleH, (hh % 628) / 100, seq, grp);
    }
  }

  /** 성 사이 빈 들 — 성마다 두르는 `scatterAround`/`scatterSmall` 는 성 둘레
   *  6~13 유닛에만 꽂혀서, 그 사이 넓은 빈칸은 늘 판판했다(퀄리티 피드백,
   *  2026-09-04). 성 좌표를 담는 사각형을 격자로 훑으며 **가장 가까운 성의
   *  land** 를 물려받아 그 결에 맞는 소품을 흩는다. 성 발밑(반경 16유닛)은
   *  건너뛴다 — `cityDressing`이 이미 그 자리를 쓴다. 칸 좌표 하나로 심을지·
   *  무엇을·어디에를 다 정해 늘 같은 그림이 선다.
   *
   *  2026-09-10 — "맵이 아직 텅 빈 것 같다, 자연스럽고 아름답게" 피드백으로
   *  칸마다 확률을 18%→26%로 올렸다(칸 크기는 그대로 18 — 성능을 생각해
   *  칸 수 자체는 안 늘리고 당첨률만 올렸다, 전체 소품 수는 약 605→874개
   *  선이다). 또한 평야·강가 들판 당첨 칸의 12%는 나무 대신 **작은 화전
   *  마을**(집 한 채 + 우물)을 세운다 — `cityDressing`이 이미 쓰는 CC0
   *  집·우물을 그대로 재사용한다("건물이나 주변 환경이나" 다 비어 보인다는
   *  지적에 자연물만이 아니라 사람 손길도 보태려는 것).
   *
   *  2026-09-11 — 같은 재지적으로 확률을 26%→32%, 화전 마을 비율도
   *  12%→16%로 한 번 더 올렸다(전체 소품 수는 약 874→1070개 선).
   *
   *  전부 성 좌표·land(둘 다 static)만으로 정해진다(static) — 2026-09-14,
   *  `buildStaticOnce()`가 한 번만 부른다. */
  function scatterField(seq, grp) {
    var cities = cityData().CITIES, i, k;
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (i = 0; i < cities.length; i++) {
      var wx = worldX(cities[i].x), wz = worldZ(cities[i].y);
      if (wx < minX) { minX = wx; } if (wx > maxX) { maxX = wx; }
      if (wz < minZ) { minZ = wz; } if (wz > maxZ) { maxZ = wz; }
    }
    var pad = 30, cell = 18;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;

    for (var gx = minX; gx < maxX; gx += cell) {
      for (var gz = minZ; gz < maxZ; gz += cell) {
        var hh = hashOf('field:' + Math.round(gx) + ':' + Math.round(gz));
        if (hh % 100 >= FIELD_DENSITY()) { continue; }
        var jx = gx + ((hh >> 6) % cell) - cell / 2;
        var jz = gz + ((hh >> 12) % cell) - cell / 2;
        if (isSea(jx, jz)) { continue; }   // 해협 트인 바다 — 여기엔 안 심는다

        var near = null, nd = Infinity;
        for (k = 0; k < cities.length; k++) {
          var d = Math.hypot(jx - worldX(cities[k].x), jz - worldZ(cities[k].y));
          if (d < nd) { nd = d; near = cities[k]; }
        }
        if (!near || nd < 16) { continue; }

        var land = near.land || 'plain';
        var pick = (hh >> 18) % 10;
        var kind, scaleH;
        /* 화전 마을 — 평야·강가에서만, 당첨 칸의 16%(hh 상위 비트를 또 하나
           쓴다 — 위치·종류 결정과 안 겹치게) */
        if ((land === 'plain' || land === 'river') && ((hh >> 22) % 100) < 16) {
          addProp('house', 'field:' + Math.round(jx) + ':' + Math.round(jz) + ':house',
            jx, jz, 1.6 + (hh % 5) / 10, (hh % 628) / 100, seq, grp);
          addProp('well', 'field:' + Math.round(jx) + ':' + Math.round(jz) + ':well',
            jx + 2.4, jz + 1.6, 0.7, 0, seq, grp);
          continue;
        }
        if (land === 'mount') {
          kind = pick < 6 ? 'rock' : 'mount';
          scaleH = kind === 'mount' ? (5 + (hh % 4)) : 0.8;
        } else if (land === 'hill') {
          kind = pick < 5 ? 'rock' : (pick < 8 ? 'bush' : 'tree');
          scaleH = kind === 'tree' ? (1.8 + (hh % 8) / 10) : 0.8;
        } else if (land === 'river') {
          kind = pick < 6 ? 'grass' : (pick < 9 ? 'bush' : 'tree');
          scaleH = kind === 'tree' ? (2 + (hh % 8) / 10) : 0.7;
        } else {
          kind = pick < 7 ? 'tree' : (pick < 9 ? 'bush' : 'flower');
          scaleH = kind === 'tree' ? (2 + (hh % 14) / 10) : 0.7;
        }
        addProp(kind, 'field:' + Math.round(jx) + ':' + Math.round(jz), jx, jz, scaleH, (hh % 628) / 100, seq, grp);
      }
    }
  }

  function buildCity(city, cst, me) {
    var t = three();
    var mine = cst.force === me;
    var tier = cityTier(city);
    var h = TIER_H[tier];
    var col = forceColor(cst.force);
    var seq = rebuildSeq;
    asset3d().build('city:' + tier, { id: city.id, tint: col, flag: col }, function (g) {
      if (seq !== rebuildSeq || !g || !dyn) { return; }
      var cx = worldX(city.x), cz = worldZ(city.y), gy = elevAt(cx, cz);
      g.position.set(cx, gy, cz);
      g.scale.setScalar(h);
      dyn.add(global.DG.realmSky3d ? global.DG.realmSky3d.realify(g) : g);   // W-0141

      var footprint = Math.max(3.2, h * 0.5);
      addShadow(cx, cz, footprint * 0.9);
      /* 성 둘레 잔장식(우물·횃불·성벽 등)은 소유(force)와 무관한 정적 소품이라
         2026-09-14부터 여기서 안 짓는다 — `buildStaticOnce()`가 성마다 한 번만
         짓는다(PLAN 27절 성능 최적화, 아래 그 함수 머리말 참고). */
      var hitGeo = new t.CylinderGeometry(footprint, footprint, h, 10);
      var hit = new t.Mesh(hitGeo, new t.MeshBasicMaterial({ visible: false }));
      hit.position.set(cx, gy + h / 2, cz);
      hit.userData.cityId = city.id;
      dyn.add(hit);
      hitMeshes.push(hit);

      /* 내 성은 밑동에 밝은 고리를 둘러 눈에 띄게 한다 */
      if (mine) {
        var ring = new t.Mesh(
          new t.RingGeometry(footprint * 1.05, footprint * 1.35, 24),
          new t.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: t.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, gy + 0.08, cz);
        dyn.add(ring);
      }

      /* 포위 — 숨쉬는 다홍 고리 */
      if (W() && W().besieged(city.id)) {
        var pr = new t.Mesh(
          new t.RingGeometry(footprint * 1.5, footprint * 1.75, 24),
          new t.MeshBasicMaterial({ color: 0xe0663f, transparent: true, opacity: 0.7, side: t.DoubleSide })
        );
        pr.rotation.x = -Math.PI / 2;
        pr.position.set(cx, gy + 0.09, cz);
        dyn.add(pr);
        pulseRings.push({ mesh: pr, base: footprint * 1.6 });
      }

      /* 재해·풍년 — 고리(포위보다 바깥) + 떠다니는 그림문자. rtk.js 가 이미
         `cst.disaster` 로 매기고 있는 것을 그대로 읽을 뿐이다 */
      if (cst.disaster) {
        var dInfo = R().disasterByKey(cst.disaster);
        if (dInfo) {
          var dr = new t.Mesh(
            new t.RingGeometry(footprint * 1.9, footprint * 2.15, 24),
            new t.MeshBasicMaterial({
              color: dInfo.good ? 0xf3d24a : 0x8a5a2a, transparent: true, opacity: 0.55, side: t.DoubleSide
            })
          );
          dr.rotation.x = -Math.PI / 2;
          dr.position.set(cx, gy + 0.1, cz);
          dyn.add(dr);

          var spr = emojiSprite(dInfo.emoji, h * 0.9);
          var baseY = gy + h * 1.25;
          spr.position.set(cx, baseY, cz);
          dyn.add(spr);
          floaters.push({ mesh: spr, baseY: baseY, amp: h * 0.12, seed: hashOf(city.id) % 100 });
        }
      }
    });
  }

  /** 지형 소품(나무·바위·잔풀·성 둘레 장식·강가 웅덩이·빈 들의 화전 마을 등)을
   *  **딱 한 번만** 짓는다 — 2026-09-14, 성능 최적화(PLAN 27절 "필요하지 않은
   *  오브젝트 업데이트 중지"). 전부 성 좌표·land·maxWall처럼 세력이 바뀌어도
   *  안 변하는 static 값만으로 정해지는데, 예전엔 `rebuild()`가
   *  `core.on('changed')`(무장 등용·시장 거래·행군 등 판정 하나마다 울린다,
   *  달 넘김 뿐이 아니다)마다 이 소품들(지역 열한 곳 기준 2천 개 안팎)을
   *  통째로 허물고 다시 지었다 — `scatterField()`만 해도 격자 칸 수 ×
   *  성 수(90여 곳)만큼 최근접 성을 다시 찾는 반복이라, 화면과 무관한 명령
   *  하나에도 그 계산과 GLB 인스턴스 생성이 고스란히 다시 돌았다. `statGrp`는
   *  `clearDyn()`이 안 건드리는 별도 그룹이라 여기 얹은 것은 게임이 끝날
   *  때까지(페이지가 살아있는 동안) 그대로 남는다 — 성 목록 자체가
   *  시나리오·세력이 바뀌어도 안 바뀌므로 다시 지을 이유가 없다. */
  function buildStaticOnce() {
    if (staticBuilt || !statGrp) { return; }
    statPending++;                      // 다 부르기 전에 묶이지 않게(동기로 떨어지는 도형 소품이 있다)
    staticBuilt = true;
    var cities = cityData().CITIES, i;
    for (i = 0; i < cities.length; i++) {
      var city = cities[i];
      var tier = cityTier(city), h = TIER_H[tier], footprint = Math.max(3.2, h * 0.5);
      cityDressing(city, tier, h, footprint, 0, statGrp);
      scatterAround(city, 0, statGrp);
      scatterSmall(city, 0, statGrp);
      riverPond(city, 0, statGrp);
    }
    scatterField(0, statGrp);
    statPending--;
    maybeFreezeStatic();
  }

  /** 성·길·진영을 다시 짓는다 — 세력이 바뀌거나(정벌) 달이 넘어갈 때(`changed`
   *  가 울릴 때마다). 2026-09-14부터 지형 소품은 여기 없다 — `buildStaticOnce()`
   *  가 따로, 한 번만 짓는다(위 머리말 참고). */
  function rebuild() {
    if (!ready) { return; }
    rebuildSeq++;
    clearDyn();
    var st = R().state();
    if (!st || !st.started) { syncActors(null); return; }
    buildStaticOnce();
    var cities = cityData().CITIES, i, j, drawn = {};

    for (i = 0; i < cities.length; i++) {
      var a = cities[i];
      for (j = 0; j < a.adj.length; j++) {
        var b = cityData().find(a.adj[j]);
        if (!b) { continue; }
        var key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if (drawn[key]) { continue; }
        drawn[key] = true;
        var fa = st.cities[a.id].force, fb = st.cities[b.id].force;
        var same = fa && fa === fb;
        var water = cityData().isWater(a.id, b.id);
        if (water) {
          addRoad(a, b, { color: '#5aa9d8', opacity: 0.75, width: 3.2, y: 0.03, water: 1 });
        } else if (same) {
          addRoad(a, b, { color: forceColor(fa), opacity: 0.6, width: 1.6, y: 0.05 });
        } else {
          addRoad(a, b, { color: '#9aa3ad', opacity: 0.22, width: 1.2, y: 0.05 });
        }
      }
    }

    var seq = rebuildSeq;
    for (i = 0; i < cities.length; i++) {
      buildCity(cities[i], st.cities[cities[i].id], st.me);
    }

    /* 진(陣) — 물러나지 않고 성 밖에 진 친 부대. 내 것·남의 것 다 세운다
       (이 판은 애초에 안 가린 정보라 — enemyCity() 도 적 성 살림을 그대로 보여준다) */
    var camps = W() ? W().camps() : [];
    for (i = 0; i < camps.length; i++) { buildCamp(camps[i], seq); }

    /* 원정 — 가고 있는 중인 부대(2026-09-04). camp 와 달리 아직 어느 성도
       에워싸지 않은, 오가는 중인 상태다 */
    var journeys = W() ? W().journeys() : [];
    for (i = 0; i < journeys.length; i++) { buildJourney(journeys[i], seq); }

    /* 배우(PLAN §5-10) — 다시 짓지 않고 목표만 갈아 준다 */
    syncActors(st);
  }

  /* ── 카메라 조작 (드래그 회전 · 휠/핀치 확대) ─────────── */

  var pointers = {};
  var dragMoved = false, pinchDist = 0;
  var ROT_SPEED = 0.006, ZOOM_SPEED = 0.6, WHEEL_SPEED = 0.15;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function pointerCount() {
    var n = 0, k;
    for (k in pointers) { if (pointers.hasOwnProperty(k)) { n++; } }
    return n;
  }

  /** 탄 것의 표(userData) 그대로 넘긴다 — `.cityId` 아니면 `.campId` */
  function pickHit(clientX, clientY) {
    var t = three();
    if (!t || !camera || !hitMeshes.length) { return null; }
    var rect = canvas.getBoundingClientRect();
    var ndc = new t.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    var ray = new t.Raycaster();
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(hitMeshes);
    return hits.length ? hits[0].object.userData : null;
  }

  function bindPointer() {
    canvas.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (ex) { /* noop */ }
      if (pointerCount() === 1) { dragMoved = false; }
      if (pointerCount() === 2) { pinchDist = twoPointerDist(); }
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pointers[e.pointerId];
      if (!p) { return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (pointerCount() === 1) {
        targetYaw -= dx * ROT_SPEED;
        targetPitch = clamp(targetPitch + dy * ROT_SPEED, PITCH_MIN(), PITCH_MAX());
        if (Math.abs(dx) + Math.abs(dy) > 2) { dragMoved = true; }
      } else if (pointerCount() === 2) {
        var nd = twoPointerDist();
        targetDist = clamp(targetDist - (nd - pinchDist) * ZOOM_SPEED, DIST_MIN(), DIST_MAX());
        pinchDist = nd;
        dragMoved = true;
      }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    function endPointer(e) {
      var p = pointers[e.pointerId];
      delete pointers[e.pointerId];
      if (p && !dragMoved && pointerCount() === 0) {
        var hit = pickHit(e.clientX, e.clientY);
        if (hit && hit.campId && global.DG.ui) { global.DG.ui.openSheet('camp'); }
        else if (hit && hit.cityId && global.DG.ui) { zoomToCity(hit.cityId); global.DG.ui.openCity(hit.cityId); }
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', function (e) {
      targetDist = clamp(targetDist + e.deltaY * WHEEL_SPEED, DIST_MIN(), DIST_MAX());
      e.preventDefault();
    }, { passive: false });
  }

  function twoPointerDist() {
    var ks = Object.keys(pointers);
    if (ks.length < 2) { return 0; }
    var a = pointers[ks[0]], b = pointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* ── 루프 ─────────────────────────────────────────────── */

  function startLoop() {
    if (loopRunning) { return; }
    loopRunning = true;
    requestAnimationFrame(tick);
  }

  /* 발열(2026-09-24 "핸드폰 불남") — 턴제 지도인데 멈춰 있어도 초당 60·120번 다시 그렸다. 그림은 그대로 두고 헛그림만 막는다:
     상한 60(손잡이 `perf.fps`, 0 = 상한 없음) · 카메라가 멎고 행군·배우 보간이 없으면 30(숨 쉬는 몸짓·깃발 까딱은 그대로 움직인다)
     · 좁은 화면에서 시트가 덮으면 30 · 전투·만남 창(#encounter, 화면 전체)이 덮으면 10 */
  var lastTickT = 0;
  function mapBusy() {
    var e = 1e-3;
    if (Math.abs(targetYaw - yaw) > e || Math.abs(targetPitch - pitch) > e || Math.abs(targetDist - dist) > 0.05 ||
        Math.abs(targetPivotX - pivotX) > 0.05 || Math.abs(targetPivotZ - pivotZ) > 0.05) { return true; }
    if (marches.length) { return true; }
    for (var id in actorCache) { if (Object.prototype.hasOwnProperty.call(actorCache, id) && actorCache[id].t0 !== null) { return true; } }
    return false;
  }
  function tickGapMs() {
    var fps = C().tuned ? C().tuned('perf.fps', 60) : 60;
    var enc = document.getElementById('encounter');
    if (enc && enc.classList.contains('show')) { return 100; }
    var b = document.body;
    var sheet = b && b.classList.contains('sheet-open') && (global.innerWidth || 0) <= 780;
    if (sheet || !mapBusy()) { fps = fps ? Math.min(fps, 30) : 30; }
    return fps > 0 ? 1000 / fps : 0;
  }

  function tick(now) {
    if (!active()) { loopRunning = false; return; }
    /* 화면에 보이는 채로 다른 창을 쓰는 중이면 렌더를 쉰다 — 안 그러면
       천천히 도는 카메라만으로도 계속 GPU 를 잡아먹는다(2026-09-08) */
    if (document.hidden || !document.hasFocus()) {
      global.setTimeout(function () { requestAnimationFrame(tick); }, 500);
      return;
    }
    var gap = tickGapMs();
    if (gap && (now || 0) - lastTickT < gap - 2) { requestAnimationFrame(tick); return; }
    lastTickT = now || 0;
    yaw += (targetYaw - yaw) * 0.15;
    pitch += (targetPitch - pitch) * 0.15;
    dist += (targetDist - dist) * 0.15;
    pivotX += (targetPivotX - pivotX) * 0.15;
    pivotZ += (targetPivotZ - pivotZ) * 0.15;

    if (global.DG.mount && global.DG.mount.frame) { global.DG.mount.frame(); }       // 비행 단추·내림 판정(mount.js)
    var flyBob = flightOn ? Math.sin((now || 0) / 800) * 2.2 : 0;                  // 나는 동안 살짝 출렁
    camera.position.set(
      pivotX + Math.cos(pitch) * Math.sin(yaw) * dist,
      Math.sin(pitch) * dist + pivotY + 6 + flyBob,
      pivotZ + Math.cos(pitch) * Math.cos(yaw) * dist
    );
    camera.lookAt(pivotX, pivotY + 6, pivotZ);
    /* 안개는 카메라 거리를 따라간다 — 260~900 으로 고정해 두면 멀리 물러날 때
       (dist 최대 900) 중심(피벗)까지가 이미 안개 끝이라 지도 전체가 뿌옇다.
       바닥값은 예전 값이라 가까이서 볼 때는 그대로다 */
    if (scene.fog) {
      scene.fog.near = Math.max(260, dist * 1.15);
      scene.fog.far = Math.max(900, dist * 3.4);
    }

    var t = now || 0;
    for (var i = 0; i < pulseRings.length; i++) {
      var s = 1 + Math.sin(t / 400 + i) * 0.08;
      pulseRings[i].mesh.scale.setScalar(s);
    }
    for (var j = 0; j < floaters.length; j++) {
      var fl = floaters[j];
      fl.mesh.position.y = fl.baseY + Math.sin(t / 450 + fl.seed) * fl.amp;
    }
    for (var m = marches.length - 1; m >= 0; m--) {
      var mm = marches[m];
      /* tick(now) 의 매개변수 now 가 모듈 함수 now() 를 가린다(같은 단위 —
         rAF 타임스탬프도 performance.now() 기준이라 매개변수를 그대로 쓴다) */
      var frac = Math.min(1, (t - mm.t0) / mm.dur);
      var mx = mm.ax + (mm.bx - mm.ax) * frac, mz = mm.az + (mm.bz - mm.az) * frac;
      mm.grp.position.set(mx, elevAt(mx, mz), mz);
      if (frac >= 1) { fx.remove(mm.grp); marches.splice(m, 1); }
    }
    tickActors(t);
    statCull();

    if (global.DG.realmWater3d) { global.DG.realmWater3d.tick(t, scene, tier()); } renderer.render(scene, camera);   // W-0141 물결 시계
    requestAnimationFrame(tick);
  }

  global.DG = global.DG || {};
  global.DG.realm3d = {
    available: available,
    active: active,
    /** 진단 — 정적 소품 묶기 결과 {props, meshes, draws} (아직이면 null)·순수 재질 지문 */
    staticInstStats: function () { return statFreezeStats; },
    staticCullStats: function () { return { all: statCullStat.all, drawn: statCullStat.drawn, runs: statCullStat.runs }; }, _matSig: matSig, _tickGapMs: tickGapMs,
    init: init,
    toggle: toggle,
    rebuild: rebuild,
    showMarch: showMarch,
    /* PLAN §5-10 지도 위 배우 — three 없이 도는 순수 함수(_test.html) */
    actorPlan: actorPlan,
    actorPos: actorPos,
    journeyPos: journeyPos,
    ACTOR_MAX: ACTOR_MAX,
    ORDER_GESTURES: ORDER_GESTURES,
    battleBeat: battleBeat,
    wanderPos: wanderPos,
    zoomFor: zoomFor,
    WANDER_MAX: WANDER_MAX,
    BATTLE_MAX: BATTLE_MAX,
    panBy: panBy,
    setFlight: setFlight,
    flying: flying,
    focusMap: focusMap,
    panTo: panTo,
    /* SAGA-DESIGN §7-2 "3D 진단 공백" — three 없이도 도는 순수 함수라 _test.html 이 부른다 */
    elevAt: elevAt,
    straitFactor: straitFactor,
    isSea: isSea,
    /* SAGA-DESIGN §8 성능 상한(PLAN §7-2) — 품질 등급 손잡이, 순수 함수도 같이 */
    setQuality: setQuality,
    tier: tier,
    deviceScore: deviceScore,
    tierFor: tierFor,
    qualityPreset: function () { return QUALITY_PRESET; }
  };

  /* 세력이 바뀌거나(정벌·외교) 달이 넘어가면 다시 짓는다 — 켜져 있을 때만.
   * core.js 는 이 스크립트보다 앞서 실려 있다(index.html 순서) */
  global.DG.core.on('changed', function () { if (active()) { rebuild(); } });
})(window);
