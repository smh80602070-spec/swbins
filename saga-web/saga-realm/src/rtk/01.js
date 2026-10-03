/**
 * 삼국지 — 판(盤): 연·월 · 도시 · 내정 · 정산
 * ---------------------------------------------------------------
 * 이 판의 시간은 **달(月)** 이다. 한 달에 무장 한 사람이 명령 하나를 쓴다.
 * "다음 달" 을 누르면 다른 세력이 제 명령을 쓰고, 그 달의 살림이 정산된다.
 *
 *   금(金)    세력 금고 하나 — 어느 성에서 써도 같은 주머니다
 *   군량(糧)  **도시마다 따로** — 그래서 먼 성으로 출진하면 군량이 발목을 잡는다
 *
 * 원작이 금은 나라 살림으로, 군량은 성 살림으로 갈라 둔 데에는 까닭이 있다.
 * 둘을 합치면 "군량이 있는 곳으로 싸우러 간다" 는 판단이 통째로 사라진다.
 *
 * 전투는 war.js, 외교·계략은 diplo.js 다. 이 파일은 **평시(平時)** 만 맡는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var FD = global.DG.forceData;

  var START_YEAR = 194;              // 표가 연도를 안 적었을 때의 값
  /* 아래 둘은 core.tuned 로 뽑았다(2026-08-31, 어드민 '균형 손잡이' 탭) —
     이 판은 턴제라 모듈이 뜰 때 한 번만 읽는다. 바꾼 뒤 새로고침해야 듣는다. */
  var UPKEEP_PER_OFFICER = core.tuned('rtk.upkeep', 12);      // 무장 한 사람의 달 봉급 (금)
  var FOOD_PER_1000 = core.tuned('rtk.foodPer1000', 10);      // 병사 1000명이 한 달에 먹는 군량
  var HARVEST_MONTHS = [6, 10];     // 군량이 들어오는 달

  /* ── 내정 명령 ────────────────────────────────────────── */

  /* 이 달 성마다 마지막으로 내린 명령 — **화면 전용**(지도 위 태수 몸짓, PLAN §5-10 ②).
     세이브에 안 넣는다(state 밖). 판정은 이 표를 안 읽는다. endMonth 첫머리에 비우므로
     ▶ 다음 달 뒤엔 그 달 AI 가 내린 명령이, 내 차례 동안엔 내가 내린 명령이 남는다 */
  var monthOrders = {};
  function monthOrdersView() { return monthOrders; }
  /* 이 달 싸움 — 같은 화면 전용 기록(지도 위 전투 자리 모션, PLAN §5-10 ③). war.js 가 쏘는
     `rtk:battle` 보고에서 성마다 마지막 싸움의 뼈대만 옮겨 둔다. 비우는 때는 monthOrders 와 같다 */
  var monthBattles = {};
  function monthBattlesView() { return monthBattles; }
  /* 이 달 세작이 물어 온 재야 — 같은 화면 전용 기록(지도 위 세작, PLAN §5-10 ④). 성 → 무장 id */
  var monthScouts = {};
  function monthScoutsView() { return monthScouts; }
  core.on('rtk:battle', function (rep) {
    if (!rep || !rep.to) { return; }
    monthBattles[rep.to] = {
      to: rep.to, from: rep.from || null, force: rep.force || null, defForce: rep.defForce || null,
      a: rep.leadA || (rep.duel && rep.duel.a) || null, d: rep.leadD || (rep.duel && rep.duel.d) || null,
      result: rep.won ? 'atk' : (rep.routed ? 'def' : 'draw')
    };
  });

  /**
   *   stat   판정에 쓰는 자질
   *   gold   드는 금
   *   base/per  성과 = base + 자질 × per
   */
  var ORDERS = [
    { key: 'agri',   name: '개간', emoji: '🌾', stat: 'wisdom',  gold: 60,  base: 3, per: 0.055,
      desc: '논밭을 넓힌다. 수확이 늘어 군량이 넉넉해진다.' },
    { key: 'comm',   name: '상업', emoji: '🏪', stat: 'wisdom',  gold: 60,  base: 3, per: 0.055,
      desc: '저자를 키운다. 달마다 들어오는 금이 늘어난다.' },
    { key: 'tech',   name: '기술', emoji: '🔨', stat: 'wisdom',  gold: 100, base: 2, per: 0.04,
      desc: '병장기를 벼린다. 같은 병력이 더 세게 친다.' },
    { key: 'sec',    name: '치안', emoji: '🪧', stat: 'command', gold: 40,  base: 3, per: 0.05,
      desc: '민심을 다독인다. 낮으면 도적이 일고 백성이 흩어진다.' },
    { key: 'wall',   name: '축성', emoji: '🧱', stat: 'command', gold: 120, base: 60, per: 3.2,
      desc: '성벽을 높인다. 공성을 오래 버틴다.' },
    { key: 'draft',  name: '징병', emoji: '🪖', stat: 'command', gold: 200, base: 200, per: 9,
      desc: '백성을 병사로 뽑는다. 인구가 그만큼 준다.' },
    { key: 'train',  name: '훈련', emoji: '🎯', stat: 'might',   gold: 50,  base: 3, per: 0.05,
      desc: '훈련도를 올린다. 같은 병력이 더 오래 버틴다.' },
    { key: 'ships',  name: '조선', emoji: '🛶', stat: 'command', gold: 150, base: 4, per: 0.06,
      desc: '배를 짓는다. 물길은 배가 있어야 건넌다 (강을 낀 성에서만).' },
    { key: 'search', name: '수색', emoji: '🔍', stat: 'wisdom',  gold: 80,  base: 0, per: 0,
      desc: '재야에 묻힌 인재를 찾는다. 찾아야 등용할 수 있다.' },
    { key: 'hire',   name: '등용', emoji: '🤝', stat: 'wisdom',  gold: 150, base: 0, per: 0,
      desc: '찾아낸 재야나 사로잡은 포로를 부른다.' }
  ];

  function orderByKey(k) {
    for (var i = 0; i < ORDERS.length; i++) { if (ORDERS[i].key === k) { return ORDERS[i]; } }
    return null;
  }

  /* ── 재해 ─────────────────────────────────────────────── */

  var DISASTERS = [
    { key: 'drought', name: '가뭄', emoji: '🌵', months: 3, harvest: 0.5,  pop: 0,      text: '비가 오지 않아 논밭이 갈라졌다.' },
    { key: 'flood',   name: '수해', emoji: '🌊', months: 2, harvest: 0.6,  pop: -0.02,  wall: -400, text: '큰물이 나 둑과 성벽이 무너졌다.' },
    { key: 'plague',  name: '역병', emoji: '🦠', months: 3, harvest: 0.85, pop: -0.04,  troops: -0.05, text: '역병이 돌아 성 안이 조용하다.' },
    { key: 'locust',  name: '황충', emoji: '🦗', months: 2, harvest: 0.4,  pop: -0.01,  text: '메뚜기 떼가 하늘을 덮었다.' },
    { key: 'bumper',  name: '풍년', emoji: '🌻', months: 2, harvest: 1.6,  pop: 0.02,  good: true, text: '해가 좋아 이삭이 무겁다.' }
  ];

  function disasterByKey(k) {
    for (var i = 0; i < DISASTERS.length; i++) { if (DISASTERS[i].key === k) { return DISASTERS[i]; } }
    return null;
  }

  /* ── 상태 ─────────────────────────────────────────────── */

  /**
   * 세이브에 적힌 시나리오를 **다시 세워 준다**.
   * 세이브를 갈아 끼우거나(프로필) 새로고침해도 세력 표가 따라와야 한다 —
   * 이 한 줄이 없으면 208년 판을 열어 두고 새로고침했을 때 194년 표로 읽혀
   * 세력 이름과 색이 통째로 어긋난다.
   */
  var scenApplied = null;

  function state() {
    var s = core.save;
    if (!s.rtk) {
      s.rtk = {
        started: false, year: START_YEAR, month: 1, me: null, scen: '194',
        cities: {}, forces: {}, officers: {}, captives: {},
        camps: [], campSeq: 0,
        journeys: [], journeySeq: 0,
        result: null, turn: 0
      };
    }
    var want = s.rtk.scen || '194';
    if (scenApplied !== want) { FD.use(want, s.rtk.seed); scenApplied = want; }
    if (s.rtk.started) { migrateNewCities(s.rtk); ensureMilestone(s.rtk); }
    return s.rtk;
  }

  /** 통계 한 칸을 올린다 — `save.rtk.stats` 는 없으면 만든다(옛 세이브가 그대로 열린다). 일기토·설전 기록이 쓴다 */
  function bumpStat(key, n) {
    var st = state();
    st.stats = st.stats || {};
    st.stats[key] = (st.stats[key] || 0) + (n == null ? 1 : n);
    return st.stats[key];
  }

  /**
   * **옛 세이브 이사** — `setup()` 을 다시 부르지 않는 이어하기 세이브는
   * `data-city.js` 에 성을 늘려도(2026-09-03 한국 지역 확장) `st.cities` 가
   * 그 키를 못 얻는다. `realm3d.js`/`ui-rtk.js` 는 `CD.CITIES` 를 그때그때
   * 훑으므로 `st.cities[새성id]` 가 `undefined` 인 채 `.force` 를 읽다 그
   * 자리에서 터진다(실제로 배포판에서 겪었다 — TypeError, 화면이 통째로 안 뜸).
   * `state()` 가 부를 때마다 **없는 성만** 채운다(`setup()` 의 도시 초기화 +
   * `seedNeutral()` 과 같은 값) — 한 번 채우면 다음부터는 전부 있어 조용히 넘어간다.
   */
  var migratedCities = null, migratedLen = 0;   /* 다 채운 st.cities 와 성 수 — state() 가 부를 때마다 135성을 훑지 않게(W-0026) */  function migrateNewCities(st) { if (migratedCities === st.cities && migratedLen === CD.CITIES.length) { return false; }
    var off = global.DG.off;
    var changed = false;
    for (var i = 0; i < CD.CITIES.length; i++) {
      var d = CD.CITIES[i];
      if (st.cities[d.id]) { continue; }
      changed = true;
      var c = st.cities[d.id] = {
        force: null,
        agri: d.agri, comm: d.comm, tech: 100, sec: 60,
        pop: d.pop, troops: 0, food: 0, train: 40,
        wall: d.wall, maxWall: d.wall,
        ships: d.land === 'river' ? 60 : 0,
        gov: null, disaster: null, dLeft: 0
      };
      if (d.garrison) {
        c.troops = d.garrison;
        c.food = d.garrison * 2;
        var ids = (FD.KOREA_GARRISON && FD.KOREA_GARRISON[d.id]) ||
          (FD.JAPAN_GARRISON && FD.JAPAN_GARRISON[d.id]) ||
          (FD.JIAOZHOU_GARRISON && FD.JIAOZHOU_GARRISON[d.id]) ||
          (FD.XIYU_GARRISON && FD.XIYU_GARRISON[d.id]) ||
          (FD.NANZHONG_GARRISON && FD.NANZHONG_GARRISON[d.id]) ||
          (FD.TIANZHU_GARRISON && FD.TIANZHU_GARRISON[d.id]) ||
          (FD.MOBEI_GARRISON && FD.MOBEI_GARRISON[d.id]) ||
          (FD.LINYI_GARRISON && FD.LINYI_GARRISON[d.id]) ||
          (FD.FUTURE_GARRISON && FD.FUTURE_GARRISON[d.id]) ||
          (FD.RUIN_GARRISON && FD.RUIN_GARRISON[d.id]) ||
          (FD.TOMB_GARRISON && FD.TOMB_GARRISON[d.id]) ||
          (FD.DAQIN_GARRISON && FD.DAQIN_GARRISON[d.id]) ||
          (FD.XIANBEI_GARRISON && FD.XIANBEI_GARRISON[d.id]) ||
          (FD.NANHAI_GARRISON && FD.NANHAI_GARRISON[d.id]) ||
        (FD.SILK_GARRISON && FD.SILK_GARRISON[d.id]) || [];
        var gov = null;
        for (var j = 0; j < ids.length; j++) {
          var r = off.placeAt(ids[j], d.id, null);
          r.found = true;
          if (!gov) { gov = ids[j]; }
        }
        c.gov = gov;
      }
    }
    migratedCities = st.cities; migratedLen = CD.CITIES.length; if (changed) { core.persist(); }
    return changed;
  }

  function city(id) { return state().cities[id] || null; }
  function force(id) { return state().forces[id] || null; }
  function me() { return state().me; }
  function myForce() { return force(me()); }

  function isMine(cityId) {
    var c = city(cityId);
    return !!c && c.force === me();
  }

  /** 살아 있는 세력 id 목록 (도시를 하나라도 가진 것) */
  function liveForces() {
    var st = state(), out = [], k;
    for (k in st.forces) {
      if (Object.prototype.hasOwnProperty.call(st.forces, k) && citiesOf(k).length) { out.push(k); }
    }
    return out;
  }

  function citiesOf(forceId) {
    var st = state(), out = [], k;
    for (k in st.cities) {
      if (Object.prototype.hasOwnProperty.call(st.cities, k) && st.cities[k].force === forceId) {
        out.push(k);
      }
    }
    return out;
  }

  /* ── 판 세우기 ────────────────────────────────────────── */

  /**
   * 판을 세운다.
   * @param meId  내가 잡을 세력 id
   * @param scen  시나리오 id ('194' · '200' · '208' · 'blank' · 'rift' · 'chaos'). 없으면 194년
   * @param seed  섞는 시나리오('chaos')의 씨앗. 안 주면 새로 굴린다 — 세이브(`save.rtk.seed`)에 적어 둔다
   */
  function setup(meId, scen, seed) {
    var st = state();
    var rd = pendingRound; pendingRound = null;          // nextRound() 가 넘긴 이월분 — 일반 새 판은 없다
    monthOrders = {};
    monthBattles = {};
    monthScouts = {};
    var off = global.DG.off;
    var want = scen || '194';
    var sd = 0;
    if (FD.scenario(want).shuffle) {
      sd = (seed >>> 0) || ((Math.random() * 4294967296) >>> 0) || 1;
    }
    var sc = FD.use(want, sd);
    scenApplied = sc.id;
    st.scen = sc.id;
    st.seed = sd;
    st.started = true;
    st.year = sc.year || START_YEAR; st.month = 1; st.turn = 0;
    st.me = meId; st.result = null;
    st.victories = []; st.pactStreak = 0; st.topStreak = 0; st.challenge = null;
    st.round = rd ? rd.n : 1;                        // 회차(§5-14) — 새 판은 1회차, nextRound() 는 +1
    st.events = null; st.rel = {};                   // 사연·관계(§5-2) — 새 판은 이어받지 않는다(event.js 가 필요할 때 채운다)
    st.cities = {}; st.forces = {}; st.officers = {}; st.captives = {};
    st.camps = []; st.campSeq = 0;
    st.journeys = []; st.journeySeq = 0;

    var i, j;

    /* 도시 */
    for (i = 0; i < CD.CITIES.length; i++) {
      var d = CD.CITIES[i];
      st.cities[d.id] = {
        force: null,
        agri: d.agri, comm: d.comm, tech: 100, sec: 60,
        pop: d.pop, troops: 0, food: 0, train: 40,
        wall: d.wall, maxWall: d.wall,
        /* 강을 낀 성은 처음부터 배를 좀 갖고 있다 — 없이 시작하면 강동이 첫해
           내내 아무 데도 못 가고, 판이 그대로 언다 */
        ships: d.land === 'river' ? 60 : 0,
        gov: null, disaster: null, dLeft: 0
      };
    }

    /* 세력 · 무장 배치 */
    for (i = 0; i < FD.FORCES.length; i++) {
      var f = FD.FORCES[i];
      st.forces[f.id] = { gold: 2000 + f.cities.length * 400, allies: {}, truce: {} };
      for (j = 0; j < f.cities.length; j++) { st.cities[f.cities[j]].force = f.id; }

      var roster = FD.roster(f.id);
      for (j = 0; j < roster.length; j++) {
        var cityId = f.cities[j % f.cities.length];
        var r = off.placeAt(roster[j], cityId, f.id);
        r.loyal = off.baseLoyal(roster[j], f.id) + (roster[j] === f.lord ? 100 : 0);
        r.loyal = core.clamp(r.loyal, 0, 100);
      }
      /* 군주가 있는 성이 본거지 — 태수는 그 성의 으뜸 무장 */
      for (j = 0; j < f.cities.length; j++) {
        var here = off.atCity(f.cities[j], f.id);
        st.cities[f.cities[j]].gov = here.length ? here[0].id : null;
        st.cities[f.cities[j]].troops = startTroops(f, f.cities[j], st.cities[f.cities[j]]);
        st.cities[f.cities[j]].food = 8000 + st.cities[f.cities[j]].agri * 8;
      }
    }

    /* 어느 표에도 안 적힌 사람은 재야가 된다 — 200·208년의 여포·이각이 그렇다.
       한국 지역 수비 무장도 이 시점엔 force:null 이라 이 해시를 함께 타고
       아무 성에나 흩어진다 — 아래 seedNeutral() 이 곧바로 제자리로 되돌린다 */
    scatterFree();

    /* 세력 없는 성(한국 지역, 2026-09-03 확장) — 수비병·수비 무장을 채운다.
       scatterFree() **뒤에** 불러야 한다 — 위에서 흩어 놓은 한국 수비 무장의
       자리를 지정한 성으로 되돌려 놓는다(scatterFree()는 안 건드린다) */
    seedNeutral();

    /* 시나리오가 정한 맹약 — 적벽의 손·유 동맹이 여기서 선다 */
    var pacts = sc.pacts || [];
    for (i = 0; i < pacts.length; i++) {
      if (global.DG.diplo) {
        global.DG.diplo.setPact(pacts[i][0], pacts[i][1], pacts[i][2], pacts[i][3]);
      }
    }

    st.milestone = { idx: 0, at: 0, base: { core: coreCount(st, meId), cities: citiesOf(meId).length } };
    if (rd) { applyRound(st, meId, rd); }

    core.log('🏳️ ' + st.year + '년 봄 · ' + sc.name + '(' + sc.hanja + ') — ' +
      forceName(meId) + ' 의 깃발을 들었다.', 'good');
    core.emit('changed');
    core.persist();
    return st;
  }

  /**
   * 재야를 도시에 흩는다.
   * **결정적으로** 흩는다(이름 해시) — 다시 세워도 같은 사람이 같은 성에 있다.
   * 무작위로 흩으면 자가진단이 실행마다 다른 성을 짚는다.
   */
  function scatterFree() {
    var st = state();
    var off = global.DG.off;
    var pool = off.all();
    var placedCount = 0;
    for (var i = 0; i < pool.length; i++) {
      var h = pool[i];
      if (!h.stats) { continue; }
      if (st.officers[h.id] && st.officers[h.id].force) { continue; }
      var n = 0;
      for (var c = 0; c < h.id.length; c++) { n = (n * 31 + h.id.charCodeAt(c)) >>> 0; }
      var cityId = CD.CITIES[n % CD.CITIES.length].id;
      var r = off.placeAt(h.id, cityId, null);
      r.loyal = 0; r.found = false;
      placedCount++;
    }
    return placedCount;
  }

  /**
   * 세력 없는 성(한국 지역, `data-city.js`의 `garrison` 필드가 있는 성)을 채운다.
   * `setup()`이 처음 도시를 세울 때는 `FD.FORCES`에 실린 성만 병력을 받는다
   * (조사로 확인 — 세력 없는 성은 그냥 0으로 남는다). 그 성이 빈 채면 아무나
   * 걸어 들어가는 셈이라 "정복" 이라 할 게 없다 — 수비병·수비 무장을 준다.
   * 이 성의 수비 무장은 **수색 없이 바로 보인다**(`found:true`) — 성벽 뒤에
   * 있는 사람이 안 보이는 재야일 리 없다. `off.atCity()`는 found 여부를
   * 안 가리므로 전투(war.js)에서는 이미 문제없이 defOff 로 잡힌다.
   */
  function seedNeutral() {
    var st = state();
    var off = global.DG.off;
    for (var i = 0; i < CD.CITIES.length; i++) {
      var d = CD.CITIES[i];
      if (!d.garrison) { continue; }
      var c = st.cities[d.id];
      /* ④⑤ 시나리오는 확장 지역의 성을 처음부터 세력이 쥔다 — 그 성의 병력과 수비 무장은
         `setup()` 이 세력 표대로 이미 놓았으니 주인 없는 성의 수비대로 덮어쓰지 않는다 */
      if (c.force) { continue; }
      c.troops = d.garrison;
      c.food = d.garrison * 2;
      var ids = (FD.KOREA_GARRISON && FD.KOREA_GARRISON[d.id]) ||
        (FD.JAPAN_GARRISON && FD.JAPAN_GARRISON[d.id]) ||
        (FD.JIAOZHOU_GARRISON && FD.JIAOZHOU_GARRISON[d.id]) ||
        (FD.XIYU_GARRISON && FD.XIYU_GARRISON[d.id]) ||
        (FD.NANZHONG_GARRISON && FD.NANZHONG_GARRISON[d.id]) ||
        (FD.TIANZHU_GARRISON && FD.TIANZHU_GARRISON[d.id]) ||
        (FD.MOBEI_GARRISON && FD.MOBEI_GARRISON[d.id]) ||
        (FD.LINYI_GARRISON && FD.LINYI_GARRISON[d.id]) ||
        (FD.FUTURE_GARRISON && FD.FUTURE_GARRISON[d.id]) ||
        (FD.RUIN_GARRISON && FD.RUIN_GARRISON[d.id]) ||
        (FD.TOMB_GARRISON && FD.TOMB_GARRISON[d.id]) ||
        (FD.DAQIN_GARRISON && FD.DAQIN_GARRISON[d.id]) ||
        (FD.XIANBEI_GARRISON && FD.XIANBEI_GARRISON[d.id]) ||
        (FD.NANHAI_GARRISON && FD.NANHAI_GARRISON[d.id]) ||
        (FD.SILK_GARRISON && FD.SILK_GARRISON[d.id]) || [];
      var gov = null;
      for (var j = 0; j < ids.length; j++) {
        /* 다른 세력의 명부에 든 사람(④ 의 양평 수령 등)은 제자리에 둔다 */
        if (st.officers[ids[j]] && st.officers[ids[j]].force) { continue; }
        var r = off.placeAt(ids[j], d.id, null);
        r.found = true;
        if (!gov) { gov = ids[j]; }
      }
      c.gov = gov;
    }
  }

  /** 세력이 처음 쥔 성의 병력 — `troops` 가 숫자면 그 값, 'garrison' 이면 성의 수비병, 없으면 3000 + 인구/90 */
  function startTroops(f, cityId, c) {
    var d = CD.find(cityId);
    if (typeof f.troops === 'number') { return f.troops; }
    if (f.troops === 'garrison' && d && d.garrison) { return d.garrison; }
    return 3000 + Math.round(c.pop / 90);
  }

  function forceName(id) {
    if (!id) { return '주인 없음'; }     // 한국 지역 등 force:null 인 성 (2026-09-03)
    var f = FD.force(id);
    return f ? f.name : id;
  }

  /* ── 명령 ─────────────────────────────────────────────── */

  /** 이 도시에서 이 달에 아직 명령을 안 쓴 소속 무장 */
  function readyAt(cityId) {
    var c = city(cityId);
    if (!c) { return []; }
    var list = global.DG.off.atCity(cityId, c.force), out = [];
    for (var i = 0; i < list.length; i++) {
      var r = global.DG.off.rec(list[i].id);
      if (!r.done && !r.hurt) { out.push(list[i]); }
    }
    return out;
  }

  /** 내정 상한 — 지형이 정한다 (산성은 논밭이 좁다) */
  function capOf(cityId, key) {
    var d = CD.find(cityId);
    var land = CD.landOf(cityId);
    if (key === 'agri') { return Math.round(900 * land.agriCap); }
    if (key === 'comm') { return Math.round(900 * land.commCap); }
    if (key === 'tech') { return 900; }
    if (key === 'sec') { return 100; }
    if (key === 'train') { return 100; }
    if (key === 'ships') { return (d && d.land === 'river') ? 300 : 0; }
    if (key === 'wall') { return Math.round((d ? d.wall : 4000) * 2); }
    return 999999;
  }

  /**
   * 명령을 실행한다.
   * @returns {{ok:boolean, why:string, amount:number, crit:boolean, text:string}}
   */
  function order(cityId, officerId, orderKey) {
    var st = state();
    var off = global.DG.off;
    var c = city(cityId), o = orderByKey(orderKey), h = off.find(officerId);
    if (!c || !o || !h) { return { ok: false, why: '없는 명령' }; }
    var r = off.rec(officerId);
    if (r.city !== cityId) { return { ok: false, why: '그 성에 없습니다' }; }
    if (r.force !== c.force) { return { ok: false, why: '남의 무장입니다' }; }
    if (r.done) { return { ok: false, why: '이 달에 이미 명령을 썼습니다' }; }
    if (r.hurt) { return { ok: false, why: '부상 중입니다' }; }
    /* 배는 물가에서만 짓는다. 여기서 막지 않으면 금만 나가고 아무것도 안 는다 */
    if (orderKey === 'ships' && CD.find(cityId).land !== 'river') {
      return { ok: false, why: '물길이 없는 성입니다' };
    }
    var fs = force(c.force);
    if (!fs || fs.gold < o.gold) { return { ok: false, why: '금이 모자랍니다' }; }

    fs.gold -= o.gold;
    r.done = true;
    monthOrders[cityId] = { key: orderKey, officer: officerId };

    if (orderKey === 'search') { return doSearch(c, cityId, h, r); }
    if (orderKey === 'hire') { return doHire(c, cityId, h, r); }

    var sv = off.stats(officerId)[o.stat] || 0;
    /* 대성공 — 자질이 높을수록 잦다. 성과가 절반 더 붙는다 */
    var crit = Math.random() < core.clamp(sv / 400, 0.03, 0.28);
    var amount = Math.round((o.base + sv * o.per) * (crit ? 1.5 : 1));

    if (orderKey === 'draft') {
      /* 징병은 인구를 깎는다 — 사람이 없으면 병사도 없다 */
      var room = Math.floor(c.pop * 0.06) - c.troops;
      amount = Math.max(0, Math.min(amount, Math.max(0, room), Math.floor(c.pop / 12)));
      c.troops += amount;
      c.pop -= amount;
      /* 새 병사가 섞이면 훈련도가 내려간다 */
      if (c.troops > 0) {
        c.train = Math.round(c.train * (c.troops - amount) / c.troops);
      }
    } else {
      var cap = capOf(cityId, orderKey);
      var before = c[orderKey];
      c[orderKey] = Math.min(cap, before + amount);
      amount = c[orderKey] - before;
    }

    r.feats += 1;
    off.addLoyal(officerId, 1);
    off.gainExp(officerId, off.EXP.order);

    var txt = h.name + ' — ' + o.emoji + ' ' + o.name + ' ' +
      (amount > 0 ? '+' + core.fmt(amount) : '더 올릴 곳이 없다') + (crit && amount > 0 ? ' (대성공!)' : '');
    core.log('📋 ' + CD.find(cityId).name + ' · ' + txt, crit ? 'good' : 'info');
    core.emit('changed');
    return { ok: true, amount: amount, crit: crit, text: txt };
  }

  /** 수색 — 그 성에 묻힌 재야를 하나 찾아낸다 */
  function doSearch(c, cityId, h, r) {
    var off = global.DG.off;
    var hidden = [], all = off.freeAt(cityId, false), i;
    for (i = 0; i < all.length; i++) {
      if (!off.rec(all[i].id).found) { hidden.push(all[i]); }
    }
    if (!hidden.length) {
      core.log('🔍 ' + CD.find(cityId).name + ' — ' + h.name + ' 이 두루 찾았으나 아무도 없었다.', 'info');
      core.emit('changed');
      return { ok: true, amount: 0, found: null, text: '더 찾을 사람이 없다' };
    }
    /* 지력이 높을수록 귀한 사람을 알아본다 */
    var wis = off.stats(h.id).wisdom;
    hidden.sort(function (a, b) { return b.rarity - a.rarity; });
    var reach = core.clamp(Math.round(hidden.length * (wis / 130)), 1, hidden.length);
    var pickIdx = Math.floor(Math.random() * reach);
    var got = hidden[pickIdx];
    off.rec(got.id).found = true;
    core.log('🔍 ' + CD.find(cityId).name + ' — ' + h.name + ' 이 ' + got.name + ' 을(를) 찾아냈다!', 'good');
    core.emit('toast', '🔍 ' + got.name + ' 을(를) 찾았다');
    core.emit('changed');
    return { ok: true, amount: 1, found: got, text: got.name + ' 을(를) 찾았다' };
  }

  /** 등용 — 찾아낸 재야, 또는 이 성에 갇힌 포로 */
  function doHire(c, cityId, h, r) {
    var off = global.DG.off;
    var pool = off.freeAt(cityId, true);
    var st = state(), k;
    for (k in st.captives) {
      if (Object.prototype.hasOwnProperty.call(st.captives, k) && st.captives[k] === cityId) {
        var ch = off.find(k);
        if (ch) { pool.push(ch); }
      }
    }
    if (!pool.length) {
      core.emit('changed');
      return { ok: true, amount: 0, hired: null, text: '부를 사람이 없다 (먼저 수색하시오)' };
    }
    var target = pool[0];
    var res = tryHire(cityId, h.id, target.id);
    core.emit('changed');
    return res;
  }

  /**
   * 한 사람을 콕 집어 등용한다 (화면에서 고를 때).
   * 성공률은 **부르는 사람의 지력**과 **부름받는 사람의 콧대(등급)** 가 가른다.
   * @param mul 설전(PLAN §5-3)이 낸 배율 — 성공률에 곱한다. 없으면 1(예전 그대로, AI 도 안 넘긴다)
   */
  function tryHire(cityId, byId, targetId, mul) {
    var off = global.DG.off;
    var c = city(cityId);
    var by = off.find(byId), t = off.find(targetId);
    if (!c || !by || !t) { return { ok: false, why: '없는 사람' }; }
    var st = state();
    var wis = off.stats(byId).wisdom;
    var chance = core.clamp(0.28 + wis / 260 - (t.rarity - 2) * 0.09, 0.05, 0.9);
    /* 같은 성향이면 말이 통한다 */
    if (by.trait === t.trait) { chance += 0.10; }
    var captive = st.captives[targetId] === cityId;
    if (captive) { chance -= 0.15; }         // 잡혀 온 사람은 쉬이 굽히지 않는다
    if (mul != null && mul !== 1) { chance = core.clamp(chance * mul, 0.03, 0.95); }

    if (Math.random() > chance) {
      core.log('🤝 ' + by.name + ' 이 ' + t.name + ' 을(를) 청했으나 거절당했다.', 'info');
      return { ok: true, hired: null, chance: chance, text: t.name + ' 이(가) 사양했다' };
    }
    delete st.captives[targetId];
    var r = off.placeAt(targetId, cityId, c.force);
    r.loyal = off.baseLoyal(targetId, c.force);
    r.found = true;
    r.done = true;                            // 들어온 달에는 일하지 않는다
    core.log('🤝 ' + t.name + ' 이(가) ' + forceName(c.force) + ' 에 합류했다!', 'good');
    core.emit('toast', '🤝 ' + t.name + ' 합류!');
    return { ok: true, hired: t, chance: chance, text: t.name + ' 합류!' };
  }

  /** 태수 임명 — 그 성의 내정·수입에 자질이 얹힌다 */
  function setGov(cityId, officerId) {
    var c = city(cityId);
    var off = global.DG.off;
    if (!c) { return false; }
    if (officerId) {
      var r = off.rec(officerId);
      if (r.city !== cityId || r.force !== c.force) { return false; }
    }
    c.gov = officerId || null;
    core.emit('changed');
    return true;
  }

  /** 태수 보정 — 지력(수입)·통솔(치안 유지)을 본다. 1.0 ~ 1.35 */
  function govMul(cityId) {
    var c = city(cityId);
    if (!c || !c.gov) { return 1; }
    var s = global.DG.off.stats(c.gov);
    return 1 + (s.wisdom * 0.6 + s.command * 0.4) / 100 * core.tuned('rtk.govCap', 0.35);
  }

  /* ── 정산 ─────────────────────────────────────────────── */

  function harvestMul(cityId) {
    var c = city(cityId);
    if (!c || !c.disaster) { return 1; }
    var d = disasterByKey(c.disaster);
    return d ? d.harvest : 1;
  }

  /** 치안이 살림에 미치는 몫 — 0.5 ~ 1.0 */
  function secMul(cityId) {
    var c = city(cityId);
    return c ? 0.5 + core.clamp(c.sec, 0, 100) / 200 : 1;
  }

  /** 이 도시가 이 달에 낳는 금 */
  function goldOf(cityId) {
    var c = city(cityId);
    if (!c) { return 0; }
    return Math.round(c.comm * core.tuned('rtk.goldMul', 0.55) * secMul(cityId) * govMul(cityId) * harvestMul(cityId));
  }

  /** 수확 달에 이 도시가 낳는 군량 */
  function foodOf(cityId) {
    var c = city(cityId);
    if (!c) { return 0; }
    return Math.round(c.agri * core.tuned('rtk.foodMul', 6) * secMul(cityId) * govMul(cityId) * harvestMul(cityId));
  }

  /** 이 도시가 이 달에 먹는 군량 */
  function eatOf(cityId) {
    var c = city(cityId);
    if (!c) { return 0; }
    return Math.round(c.troops / 1000 * FOOD_PER_1000);
  }

  /* ── 시장 (2026-09-09, 경제 심화) ─────────────────────────
   * 지금까지 상업(comm)이 하는 일은 "달마다 금이 는다" 하나뿐이었다 —
   * 금과 군량은 완전히 남남이라, 금은 넘치는데 군량이 모자라도(혹은 그
   * 반대여도) 손쓸 길이 없었다. 저자가 큰 성일수록 환율을 후하게 쳐줘서,
   * 상업 투자의 값을 "수입" 하나에서 "아쉬울 때 자원을 맞바꿀 수 있다"로
   * 넓힌다. war.transfer 처럼 **명령이 아니다** — officer.done 을 안 쓰는
   * 물류라 그 달에 몇 번이든 쓸 수 있다.
   */
  function marketRate(cityId) {
    var c = city(cityId);
    return c ? core.clamp(0.35 + c.comm / 700, 0.35, 0.7) : 0.35;
  }

  /**
   * 시장에서 금↔군량을 맞바꾼다.
   * @param dir 'sell'(군량→금) | 'buy'(금→군량)
   */
  function trade(cityId, dir, amount) {
    var c = city(cityId);
    if (!c) { return { ok: false, why: '없는 성' }; }
    if (!c.force) { return { ok: false, why: '주인 없는 성입니다' }; }
    amount = Math.max(0, Math.round(amount || 0));
    if (!amount) { return { ok: false, why: '수량을 입력하세요' }; }
    var f = force(c.force);
    if (!f) { return { ok: false, why: '없는 세력' }; }
    var rate = marketRate(cityId);
    if (dir === 'sell') {
      if (amount > c.food) { return { ok: false, why: '군량이 모자랍니다' }; }
      var gained = Math.round(amount * rate);
      c.food -= amount; f.gold += gained;
      core.emit('changed');
      return { ok: true, dir: dir, food: -amount, gold: gained, rate: rate };
    }
    if (dir === 'buy') {
      var cost = Math.round(amount / rate);
      if (cost > f.gold) { return { ok: false, why: '금이 모자랍니다' }; }
      f.gold -= cost; c.food += amount;
      core.emit('changed');
      return { ok: true, dir: dir, food: amount, gold: -cost, rate: rate };
    }
    return { ok: false, why: '알 수 없는 방향' };
  }

  function settleMonth() {
    var st = state();
    var off = global.DG.off;
    var harvest = HARVEST_MONTHS.indexOf(st.month) >= 0;
    var k, c, f;

    /* 세력 금고 */
    for (k in st.forces) {
      if (!Object.prototype.hasOwnProperty.call(st.forces, k)) { continue; }
      f = st.forces[k];
      var cs = citiesOf(k), i, income = 0;
      for (i = 0; i < cs.length; i++) { income += goldOf(cs[i]); }
      var upkeep = off.ofForce(k).length * UPKEEP_PER_OFFICER;
      f.gold = Math.max(0, f.gold + income - upkeep);
      f.lastIncome = income; f.lastUpkeep = upkeep;
    }

    /* 도시 살림 */
    for (k in st.cities) {
      if (!Object.prototype.hasOwnProperty.call(st.cities, k)) { continue; }
      c = st.cities[k];
      if (!c.force) { continue; }

      /* 에워싸인 성은 들에 나가지 못한다 — **수확을 못 거둔다**.
         이것이 없으면 긴 포위가 수비 쪽에 아무 값도 물리지 못해,
         "성문을 닫고 버틴다" 가 언제나 옳은 수가 된다 */
      var sieged = global.DG.war ? global.DG.war.besieged(k) : false;
      if (harvest && !sieged) { c.food += foodOf(k); }
      c.food -= eatOf(k);
      if (c.food < 0) {
        /* 굶으면 병사가 흩어진다 — 이 판에서 가장 아픈 벌이다 */
        var lost = Math.min(c.troops, Math.round(-c.food / FOOD_PER_1000 * 1000));
        c.troops -= lost;
        c.food = 0;
        if (lost > 0) {
          core.log('🍚 ' + CD.find(k).name + ' — 군량이 떨어져 병사 ' + core.fmt(lost) + ' 이 흩어졌다', 'warn');
        }
      }

      /* 인구 — 치안과 논밭이 사람을 부른다 (에워싸인 성은 늘지 않는다) */
      var grow = sieged ? 0 : c.pop * 0.006 * (c.agri / 320) * (secMul(k) * 2 - 0.8);
      var dz = c.disaster ? disasterByKey(c.disaster) : null;
      if (dz && dz.pop) { grow += c.pop * dz.pop; }
      if (c.sec < 35) { grow -= c.pop * 0.008; }
      c.pop = Math.max(5000, Math.round(c.pop + grow));
      if (dz && dz.troops) { c.troops = Math.max(0, Math.round(c.troops * (1 + dz.troops))); }
      if (dz && dz.wall) { c.wall = Math.max(200, c.wall + dz.wall); }

      /* 치안은 가만두면 내려간다 */
      c.sec = core.clamp(c.sec - 1, 0, 100);

      /* 재해가 지나간다 */
      if (c.disaster) {
        c.dLeft -= 1;
        if (c.dLeft <= 0) {
          var was = disasterByKey(c.disaster);
          core.log((was && was.emoji ? was.emoji : '☀️') + ' ' + CD.find(k).name +
            ' — ' + (was ? was.name : '') + ' 이(가) 지나갔다', 'info');
          c.disaster = null;
        }
      }
    }

    /* 태수로 한 달을 앉아 있으면 그만큼 는다 — 자리가 사람을 기른다 */
    for (k in st.cities) {
      if (!Object.prototype.hasOwnProperty.call(st.cities, k)) { continue; }
      if (st.cities[k].force && st.cities[k].gov) {
        off.gainExp(st.cities[k].gov, off.EXP.gov);
      }
    }

    rollDisasters();
    rollScouting();
    driftLoyalty();
    /* 이탈은 충성이 움직인 **뒤에** 본다 — 먼저 보면 이 달에 깎인 이간이 안 먹는다 */
    if (global.DG.diplo) { global.DG.diplo.checkDefection(); }
    off.rollAging();
    checkResult();
  }

  /** 달마다 한 성쯤에 무슨 일이 난다 */
  function rollDisasters() {
    var st = state(), keys = Object.keys(st.cities);
    if (Math.random() > core.tuned('rtk.disasterChance', 0.42)) { return null; }
    var target = keys[Math.floor(Math.random() * keys.length)];
    var c = st.cities[target];
    if (!c || !c.force || c.disaster) { return null; }
    /* 치안이 낮은 성이 더 잘 무너진다 — 풍년은 그 반대 */
    var bad = Math.random() < core.clamp(0.55 + (60 - c.sec) / 200, 0.3, 0.9);
    var pool = DISASTERS.filter(function (d) { return !!d.good !== bad; });
    var d = pool[Math.floor(Math.random() * pool.length)];
    c.disaster = d.key; c.dLeft = d.months;
    core.log(d.emoji + ' ' + CD.find(target).name + ' — ' + d.text, d.good ? 'good' : 'warn');
    if (c.force === me()) { core.emit('toast', d.emoji + ' ' + CD.find(target).name + ' ' + d.name); }
    return { city: target, kind: d.key };
  }

  /**
   * 충성은 인연(baseLoyal)으로 **끌려간다**.
   * 위로 끌려가기만 하면 이탈이 영영 없고, 아래로만 두면 아무도 안 남는다.
   */
  function driftLoyalty() {
    var st = state(), off = global.DG.off, k;
    for (k in st.officers) {
      if (!Object.prototype.hasOwnProperty.call(st.officers, k)) { continue; }
      var r = st.officers[k];
      if (!r.force) { continue; }
      if (off.lordOf(r.force) === k) { r.loyal = 100; continue; }
      var base = off.baseLoyal(k, r.force);
      /* 큰 성에 있으면 대접받는 느낌이 난다 */
      var c = st.cities[r.city];
      if (c && c.sec >= 70) { base += 4; }
      if (c && c.sec < 30) { base -= 6; }
      r.loyal = core.clamp(Math.round(r.loyal + (base - r.loyal) * 0.25), 0, 100);
      if (r.hurt > 0) { r.hurt -= 1; }
    }
  }

  /** 상 — 금을 주어 충성을 올린다 */
  function reward(officerId, gold) {
    var off = global.DG.off;
    var r = off.rec(officerId);
    var f = force(r.force);
    if (!f || !r.force) { return { ok: false, why: '내 무장이 아닙니다' }; }
    gold = Math.max(50, Math.round(gold || 200));
    if (f.gold < gold) { return { ok: false, why: '금이 모자랍니다' }; }
    f.gold -= gold;
    var up = core.clamp(Math.round(gold / 40 * off.traitMul(officerId, 'rewardUp')), 1, 20);
    var now = off.addLoyal(officerId, up);
    var h = off.find(officerId);
    core.log('🎁 ' + h.name + ' 에게 금 ' + core.fmt(gold) + ' — 충성 ' + now, 'good');
    core.emit('changed');
    return { ok: true, loyal: now, up: up };
  }

  /* ── 학당 (문답 — 곁가지) ─────────────────────────────── */

  var LORE_PER_FIND = 6;        // 학식이 이만큼 차면 재야 하나가 저절로 드러난다

  /**
   * 문답을 맞혔을 때 quiz.js 가 부른다.
   * 문답은 이 판의 **곁가지**다 — 군자금과, 이따금 재야 하나를 드러내는 것까지.
   * 여기서 성을 넓히거나 병력을 주면 삼국지가 문답 게임이 되어 버린다.
   */
  /** 학구 특성 무장이 우리 편에 있으면 학당 상금 ×1.3 (여럿이어도 한 번만) */
  function prizeMul(forceId) {
    var team = global.DG.off.ofForce(forceId), m = 1, i;
    for (i = 0; i < team.length; i++) { m = Math.max(m, global.DG.off.traitMul(team[i].id, 'prize')); }
    return m;
  }

  function study(lv, gold, first) {
    var st = state();
    var f = myForce();
    if (!st.started || !f) { return null; }
    gold = Math.max(0, Math.round((gold || 0) * prizeMul(st.me)));
    f.gold += gold;
    var out = { gold: gold, found: null };
    if (!first) { return out; }
    st.lore = (st.lore || 0) + Math.max(1, lv || 1);
    while (st.lore >= LORE_PER_FIND) {
      st.lore -= LORE_PER_FIND;
      var got = revealFree();
      if (got) { out.found = got; }
    }
    return out;
  }

  /**
   * "무장 수집"(README 여덟 축, 2026-09-10) — 문답(학당)을 안 풀어도 매달
   * 조금씩 재야가 드러나는 축. **새 등용 판정을 만들지 않는다** — 이미 있는
   * `revealFree()`(문답이 학식을 채웠을 때 부르던 바로 그 함수)를 달마다
   * 작은 확률로 그대로 부른다. 세작(細作)이 저절로 소문을 물어 온다는 결이다.
   */
  function rollScouting() {
    if (Math.random() > core.tuned('rtk.scoutChance', 0.12)) { return null; }
    var got = revealFree();
    if (got) {
      var gr = global.DG.off.rec(got.id);
      if (gr && gr.city) { monthScouts[gr.city] = got.id; }
    }
    return got;
  }

  /** 우리 땅에 묻힌 재야 하나를 드러낸다 (가장 귀한 사람부터) */
  function revealFree(note) {
    var off = global.DG.off;
    var mine = citiesOf(me()), pool = [], i;
    for (i = 0; i < mine.length; i++) {
      var all = off.freeAt(mine[i], false);
      for (var j = 0; j < all.length; j++) {
        if (!off.rec(all[j].id).found) { pool.push(all[j]); }
      }
    }
    if (!pool.length) { return null; }
    pool.sort(function (a, b) { return b.rarity - a.rarity; });
    off.rec(pool[0].id).found = true;
    core.log('📚 ' + (note || '학식이 쌓여') + ' ' + pool[0].name + ' 의 이름이 들려왔다', 'good');
    core.emit('toast', '🔍 ' + pool[0].name + ' 이(가) 드러났다');
    return pool[0];
  }

  /* ── 승패 ─────────────────────────────────────────────── */

  function checkResult() {
    var st = state();
    if (st.result) { return st.result; }
    var mine = citiesOf(st.me);
    if (!mine.length) {
      st.result = 'lose';
      finalizeChallenge(st, 'lose');
      core.log('🏳️ 성을 모두 잃었다. ' + st.year + '년 ' + st.month + '월.', 'warn');
      core.emit('rtk:end', 'lose');
    } else if (mine.length === Object.keys(st.cities).length) {
      st.result = 'win';
      recordVictory(st, 'conquest');
      finalizeChallenge(st, 'win');
      core.log('👑 천하가 하나가 되었다! ' + st.year + '년 ' + st.month + '월.', 'good');
      core.emit('rtk:end', 'win');
    }
    return st.result;
  }

  /* ── 승리 조건 (PLAN §5-5) ───────────────────────────────
   * 정복(천하통일)은 예전 그대로 `st.result = 'win'` 으로 판을 닫는다. 나머지 넷은 **판을 닫지 않는다** —
   * 달성하면 `save.rtk.victories = [{kind, month}]` 에 **한 번만** 적고 결과 카드를 띄운다(이어하기가 기본).
   * 카운터 `pactStreak`·`topStreak` 은 달을 넘길 때마다 `tickVictories` 가 센다(옛 세이브는 칸이 없으면 0 에서).
   *   패권  관문 성(`landmark` 확장 지역 열 곳) 4곳 이상 + 세력 1위 — 둘을 함께 24달 잇는다
   *   문화  문답 정답 200 + 서로 다른 보물 8종(무장이 든 것) — 카운터 없이 지금 값으로 본다
   *   외교  살아 있는 다른 모든 세력과 동맹·화친 36달 연속
   *   생존  ⑤ 균열의 왕 전용 — 240달 버티기
   * 손잡이 `rtk.victory.<종류>` 를 0 으로 두면 그 조건은 꺼진다(어드민 '균형 손잡이').
   * ※ PLAN 초안의 "학식 상한" 은 이 판에 상한이라는 값이 없어(`st.lore` 는 쌓이기만 한다) 뺐다. */
  var VICTORY = {
    hegemony:  { name: '패권', emoji: '🏯', gates: 4, months: 24 },
    culture:   { name: '문화', emoji: '📚', correct: 200, relics: 8 },
    diplomacy: { name: '외교', emoji: '🕊️', months: 36 },
    survival:  { name: '생존', emoji: '🛡️', months: 240 }
  };
  var VICTORY_KINDS = ['hegemony', 'culture', 'diplomacy', 'survival'];
  var CONQUEST = { name: '천하통일', emoji: '👑' };

  function victoryOn(kind) { return core.tuned('rtk.victory.' + kind, 1) !== 0; }

  /** 이 판에서 겨룰 수 있는 승리 조건 — 생존은 이계로 시작하는 판만(균열·폐허·묘역), 꺼 둔 것은 뺀다 */
  function victoryKinds() {
    var st = state(), out = [], i;
    for (i = 0; i < VICTORY_KINDS.length; i++) {
      var k = VICTORY_KINDS[i];
      /* 생존은 이계로 시작하는 판(균열·폐허·묘역, 시나리오 표의 survival)만 */
      if (k === 'survival' && !FD.scenario(st.scen).survival) { continue; }
      if (victoryOn(k)) { out.push(k); }
    }
    return out;
  }

  function victoryDone(st, kind) {
    var v = st.victories || [], i;
    for (i = 0; i < v.length; i++) { if (v[i].kind === kind) { return true; } }
    return false;
  }

  function recordVictory(st, kind) {
    if (!st.victories) { st.victories = []; }
    if (!victoryDone(st, kind)) { st.victories.push({ kind: kind, month: st.turn || 0 }); }
  }

  function gateCount(st, forceId) {
    var n = 0, i;
    for (i = 0; i < CD.CITIES.length; i++) {
      var d = CD.CITIES[i];
      if (d.landmark && st.cities[d.id] && st.cities[d.id].force === forceId) { n++; }
    }
    return n;
  }

  function relicKinds(forceId) {
    var team = global.DG.off.ofForce(forceId), seen = {}, n = 0, i;
    for (i = 0; i < team.length; i++) {
      var it = global.DG.off.rec(team[i].id).item;
      if (it && !seen[it]) { seen[it] = 1; n++; }
    }
    return n;
  }

  function rankOf(forceId) {
    var rk = ranking(), i;
    for (i = 0; i < rk.length; i++) { if (rk[i].id === forceId) { return i + 1; } }
    return 0;
  }

  /** 지금 살아 있는 다른 세력 중 나와 동맹·화친이 아닌 곳의 수(외교 승리의 조건) */
  function unpacted(st) {
    var D = global.DG.diplo, ids = liveForces(), n = 0, i;
    for (i = 0; i < ids.length; i++) {
      if (ids[i] === st.me) { continue; }
      if (!D || !(D.alliedWith(st.me, ids[i]) || D.trucedWith(st.me, ids[i]))) { n++; }
    }
    return n;
  }

  /** 조건 하나의 진척 — { pct: 0~1, ok, note } (화면은 pct 막대와 note 한 줄) */
  function victoryProgress(kind) {
    var st = state(), V = VICTORY[kind], quiz = (core.save.quiz && core.save.quiz.correct) || 0;
    var hi = function (a, b) { return Math.min(1, a / b); };
    if (kind === 'hegemony') {
      var g = gateCount(st, st.me), pos = rankOf(st.me), sk = st.topStreak || 0;
      return { pct: sk / V.months, ok: sk >= V.months,
               note: '관문 ' + g + '/' + V.gates + ' · ' + (pos ? pos + '위' : '—') + ' · ' + sk + '/' + V.months + '달' };
    }
    if (kind === 'culture') {
      var rk = relicKinds(st.me);
      return { pct: (hi(quiz, V.correct) + hi(rk, V.relics)) / 2, ok: quiz >= V.correct && rk >= V.relics,
               note: '정답 ' + Math.min(quiz, V.correct) + '/' + V.correct + ' · 보물 ' + Math.min(rk, V.relics) + '/' + V.relics };
    }
    if (kind === 'diplomacy') {
      var ps = st.pactStreak || 0, bad = unpacted(st);
      return { pct: ps / V.months, ok: ps >= V.months,
               note: ps + '/' + V.months + '달' + (bad ? ' · 화친 안 한 세력 ' + bad : '') };
    }
    var t = st.turn || 0;   // survival
    return { pct: t / V.months, ok: t >= V.months, note: t + '/' + V.months + '달' };
  }

  /** 화면용 — 가장 가까운(이루지 못한) 승리 조건. 정복도 후보다. 없으면 null */
  function victoryNext() {
    var st = state();
    if (!st.started) { return null; }
    var best = null, ks = victoryKinds(), i;
    for (i = 0; i < ks.length; i++) {
      if (victoryDone(st, ks[i])) { continue; }
      var p = victoryProgress(ks[i]);
      if (!best || p.pct > best.pct) { best = { kind: ks[i], name: VICTORY[ks[i]].name + ' 승리', emoji: VICTORY[ks[i]].emoji, pct: p.pct, note: p.note }; }
    }
    var total = Object.keys(st.cities).length, mine = citiesOf(st.me).length;
    var cp = mine / Math.max(1, total);
    if (!best || cp > best.pct) {
      best = { kind: 'conquest', name: CONQUEST.name, emoji: CONQUEST.emoji, pct: cp, note: '성 ' + mine + '/' + total };
    }
    return best;
  }

  /** 결과 카드에 실을 것 — 걸린 달·성·인물 다섯·기록 셋·다음 도전 하나 */
  function resultCard(kind) {
    var st = state(), off = global.DG.off, team = off.ofForce(st.me), i, top = [];
    for (i = 0; i < team.length && i < 5; i++) { top.push({ name: team[i].name, power: off.power(team[i].id) }); }
    var total = Object.keys(st.cities).length, s = summary(st.me), q = (core.save.quiz && core.save.quiz.correct) || 0;
    var name = kind === 'conquest' ? CONQUEST.name : VICTORY[kind].name + ' 승리';
    var next = victoryNext();
    return {
      kind: kind, name: name, emoji: kind === 'conquest' ? CONQUEST.emoji : VICTORY[kind].emoji,
      month: st.turn || 0, year: st.year, mon: st.month, cities: s.cities, total: total, top: top,
      round: roundNo(), nr: canNextRound().ok ? roundPreview() : null,
      lines: [
        '성 ' + s.cities + '/' + total + ' · 병력 ' + core.fmt(s.troops) + ' · 금 ' + core.fmt(s.gold),
        '세력 ' + rankOf(st.me) + '위(살아 있는 ' + liveForces().length + ') · 무장 ' + s.officers + '명',
        '문답 정답 ' + q + ' · 보물 ' + relicKinds(st.me) + '종 · 이정표 ' + (st.milestone ? st.milestone.idx : 0) + '/5'
      ],
      next: next ? next.emoji + ' ' + next.name + ' — ' + next.note : ''
    };
  }

  /**
   * 달을 넘긴 뒤 부른다 — 카운터를 세고, 이번 달에 처음 이룬 승리 조건을 적고 카드를 띄운다.
   * 승패가 난 판은 세지 않는다(정복 판정은 checkResult 가 한다). @returns 이번에 이룬 종류 배열
   */
  function tickVictories() {
    var st = state(), out = [];
    if (!st.started || st.result) { return out; }
    var g = gateCount(st, st.me);
    st.topStreak = (g >= VICTORY.hegemony.gates && rankOf(st.me) === 1) ? (st.topStreak || 0) + 1 : 0;
    var others = liveForces().length - (citiesOf(st.me).length ? 1 : 0);
    st.pactStreak = (others > 0 && unpacted(st) === 0) ? (st.pactStreak || 0) + 1 : 0;
    var ks = victoryKinds(), i;
    for (i = 0; i < ks.length; i++) {
      if (victoryDone(st, ks[i]) || !victoryProgress(ks[i]).ok) { continue; }
      recordVictory(st, ks[i]);
      out.push(ks[i]);
      core.log('🏆 ' + VICTORY[ks[i]].name + ' 승리! ' + st.year + '년 ' + st.month + '월 — 판은 이어진다.', 'good');
    }
    for (i = 0; i < out.length; i++) { core.emit('rtk:victory', resultCard(out[i])); }
    if (out.length) { core.emit('changed'); }
    return out;
  }

  /* ── 다음 달 카드 + 주간 도전 (PLAN §5-7) ─────────────────
   * ① `monthReport` — 달을 넘긴 직후 화면이 띄울 요약 데이터. 이번 달 일어난 일 3줄(로그에서 중요도 상위), 금·군량·병력·성 증감,
   *    **다음 달 권고 1개**(`rtk-ai.pickOrder` 를 내 성마다 돌려 가장 급한 것 — AI 판단을 보여줄 뿐 새 판정 없음), 이정표·승리 진척, 도전 진척.
   * ② 주간 도전 — ISO 주 번호로 씨앗을 고정한 **무작위 판(chaos)** 을 60달 돌려 점수(성×10 + 무장 + 보물×20)를 겨룬다.
   *    `save.rtk.challenge = {week, seed, months, done, score}`(이번 판), 로컬 최고는 `save.rtkBest = { '2026-W38': 점수 }`
   *    (새 판을 세우면 rtk 칸이 비워져 최고 기록은 rtk 밖에 둔다 — PLAN 초안의 `challenge.best` 대신). 서버 없음.
   *    60달을 채우면 한 번만 끝내고 판은 이어진다. 그 전에 판이 닫히면(멸망·정복) 그 자리에서 끝낸다. */
  var CHALLENGE_MONTHS = 60;

  /** ISO 8601 주 — { year, week }. 월요일에 시작하고, 그 해 첫 목요일이 든 주가 1주 */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dow = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dow);
    var y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
    return { year: t.getUTCFullYear(), week: Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7) };
  }

  /** 그 날짜가 든 주의 도전 — { key: '2026-W38', seed } (같은 주는 늘 같은 씨앗) */
  function challengeWeek(date) {
    var w = isoWeek(date || new Date());
    var key = w.year + '-W' + (w.week < 10 ? '0' : '') + w.week;
    return { key: key, seed: (Math.imul(w.year * 100 + w.week, 2654435761) >>> 0) || 1 };
  }

  function heldRelics(forceId) {
    var team = global.DG.off.ofForce(forceId), n = 0, i;
    for (i = 0; i < team.length; i++) { if (global.DG.off.rec(team[i].id).item) { n++; } }
    return n;
  }

  /** 도전 점수 = 성 수×10 + 무장 수 + 보물×20 (보물은 무장이 든 개수) */
  function challengeScore(forceId) {
    forceId = forceId || me();
    return citiesOf(forceId).length * 10 + global.DG.off.ofForce(forceId).length + heldRelics(forceId) * 20;
  }

  function challengeCode(ch, score) {
    return 'SG-' + ch.week + '-' + score + '-' + (ch.seed >>> 0).toString(36);
  }

  function bests() {
    if (!core.save.rtkBest) { core.save.rtkBest = {}; }
    return core.save.rtkBest;
  }

  /** 이번 주 도전으로 새 판을 세운다 — 무작위 판(chaos)을 그 주의 씨앗으로 */
  function setupChallenge(meId, date) {
    var wk = challengeWeek(date);
    setup(meId, 'chaos', wk.seed);
    var st = state();
    st.challenge = { week: wk.key, seed: wk.seed, months: CHALLENGE_MONTHS, done: false, score: null };
    core.persist();
    return st.challenge;
  }

  /* ── 회차 — 결말 뒤 같은 깃발로 다시 (PLAN §5-14, 2026-09-30) ───────────
   * `nextRound()` 는 이긴 판(정복 또는 승리 조건 하나 이상)에서만 열린다. 같은 시나리오·같은 깃발로 처음부터 다시 세우되
   *   ① 다른 세력의 병력·금이 회차마다 ×0.2 씩 는다(최대 ×2)  ② 우리 금이 회차마다 +1500(최대 +6000)
   *   ③ 지난 회차에 우리 사람이던 **시간 틈 사람**(최대 둘, 능력 높은 순)이 첫 성에서 다시 합류한다.
   * 세이브: `save.rtk.round`(이번 판의 회차, 없으면 1) · `save.rtkRound = { clears: { 시나리오id: { round, month, kind } } }` — 새 판을 세워도 남게 rtk 밖에 둔다. */
  var ROUND_MAX = 9, ROUND_FOE_STEP = 0.2, ROUND_FOE_CAP = 2, ROUND_GOLD = 1500, ROUND_GOLD_CAP = 6000, ROUND_FOLK = 2;
  var pendingRound = null;

  function roundNo() { return state().round || 1; }

  function roundInfo() {
    var r = core.save.rtkRound;
    if (!r || typeof r !== 'object') { r = core.save.rtkRound = {}; }
    if (!r.clears || typeof r.clears !== 'object') { r.clears = {}; }
    return r;
  }

  /** 이긴 판인가 — 정복(result 'win')이거나 승리 조건 하나 이상 */
  function wonNow(st) {
    return !!st.started && st.result !== 'lose' && (st.result === 'win' || !!(st.victories && st.victories.length));
  }

  /** 지금 판에서 다음 회차를 열 수 있는가 — { ok, why? } */
  function canNextRound() {
    var st = state();
    if (!st.started) { return { ok: false, why: '판이 없습니다' }; }
    if (st.challenge) { return { ok: false, why: '주간 도전 판은 회차가 없습니다' }; }
    if (!wonNow(st)) { return { ok: false, why: '승리를 이룬 뒤에 열립니다' }; }
    if (roundNo() >= ROUND_MAX) { return { ok: false, why: ROUND_MAX + '회차가 끝입니다' }; }
    return { ok: true };
  }

  /** 다음 회차의 조건 미리보기 — { n, foe, gold, folk:[id] } (화면이 카드에 적는다) */
  function roundPreview() {
    var st = state(), n = roundNo() + 1, off = global.DG.off, SD = global.DG.scenarioData, folk = [];
    if (SD && SD.TIME_FOLK) {
      folk = SD.TIME_FOLK.filter(function (id) { return off.has(id) && off.rec(id).force === st.me; })
        .sort(function (a, b) { return off.power(b) - off.power(a); }).slice(0, ROUND_FOLK);
    }
    return { n: n, foe: Math.min(ROUND_FOE_CAP, 1 + ROUND_FOE_STEP * (n - 1)), gold: Math.min(ROUND_GOLD_CAP, ROUND_GOLD * (n - 1)), folk: folk };
  }

  /** 같은 시나리오·같은 깃발로 다음 회차를 세운다. 성공하면 { ok, n, ... } */
  function nextRound() {
    var chk = canNextRound();
    if (!chk.ok) { return chk; }
    var st = state(), pv = roundPreview(), me0 = st.me, scen0 = st.scen, kind = victoryKindOf(st);
    var rec = roundInfo().clears[scen0];
    if (!rec || rec.round < roundNo()) { roundInfo().clears[scen0] = { round: roundNo(), month: st.turn || 0, kind: kind }; }
    pendingRound = pv;
    setup(me0, scen0);
    return { ok: true, n: pv.n, foe: pv.foe, gold: pv.gold, folk: pv.folk.slice() };
  }

  function victoryKindOf(st) {
    if (st.victories && st.victories.length) { return st.victories[st.victories.length - 1].kind; }
    return st.result === 'win' ? 'conquest' : '';
  }

  /** 가장 높이 이긴 회차 — 시나리오 고르기 화면이 한 줄로 보인다 (없으면 0) */
  function roundBest() {
    var c = roundInfo().clears, best = 0, k;
    for (k in c) { if (Object.prototype.hasOwnProperty.call(c, k)) { best = Math.max(best, c[k].round || 0); } }
    return best;
  }

  /** setup() 꼬리에서 — 이월분을 새 판에 얹는다 */
  function applyRound(st, meId, rd) {
    var off = global.DG.off, k, i;
    for (k in st.cities) {
      if (Object.prototype.hasOwnProperty.call(st.cities, k) && st.cities[k].force && st.cities[k].force !== meId) {
        st.cities[k].troops = Math.round(st.cities[k].troops * rd.foe);
      }
    }
    for (k in st.forces) {
      if (Object.prototype.hasOwnProperty.call(st.forces, k) && k !== meId) { st.forces[k].gold = Math.round(st.forces[k].gold * rd.foe); }
    }
    if (st.forces[meId]) { st.forces[meId].gold += rd.gold; }
    var cap = citiesOf(meId)[0] || '', back = [];
    for (i = 0; i < rd.folk.length; i++) {
      var id = rd.folk[i];
      if (!cap || !off.has(id) || off.rec(id).force) { continue; }
      var r = off.placeAt(id, cap, meId);
      r.loyal = core.clamp(off.baseLoyal(id, meId) + 15, 0, 100);
      r.found = true; r.camp = null; r.journey = null;
      back.push(off.find(id).name);
    }
    core.log('🔁 ' + rd.n + '회차 — 다른 세력 병력·금 ×' + rd.foe.toFixed(1) + ' · 금 +' + core.fmt(rd.gold) +
      (back.length ? ' · 돌아온 사람 ' + back.join('·') : ''), 'good');
  }

  /** 도전을 끝낸다(한 번만) — 점수·최고 기록·공유 코드. 카드는 화면이 'rtk:challenge' 로 띄운다 */
  function finalizeChallenge(st, how) {
    var ch = st.challenge;
    if (!ch || ch.done) { return null; }
    ch.done = true;
    ch.score = how === 'lose' ? 0 : challengeScore(st.me);
    var b = bests(), prev = b[ch.week] || 0, isBest = ch.score > prev;
    if (isBest) { b[ch.week] = ch.score; }
    var out = { week: ch.week, score: ch.score, best: b[ch.week] || 0, isBest: isBest, how: how,
      months: st.turn || 0, code: challengeCode(ch, ch.score) };
    core.log('🎯 이번 주 도전 (' + ch.week + ') — 점수 ' + ch.score + (isBest ? ' · 최고 기록!' : ''), 'good');
    core.emit('rtk:challenge', out);
    return out;
  }

  /** 달을 넘긴 뒤 부른다 — 60달을 채웠으면 도전을 끝낸다 */
  function tickChallenge() {
    var st = state();
    if (!st.started || st.result || !st.challenge || st.challenge.done) { return null; }
    if ((st.turn || 0) < st.challenge.months) { return null; }
    return finalizeChallenge(st, 'time');
  }

  /** 화면용 — 이번 판의 도전 진척(없으면 null) */
  function challengeView() {
    var st = state();
    if (!st.started || !st.challenge) { return null; }
    var ch = st.challenge;
    return { week: ch.week, month: Math.min(st.turn || 0, ch.months), months: ch.months, done: !!ch.done,
      score: ch.done ? ch.score : challengeScore(st.me), best: bests()[ch.week] || 0, code: ch.done ? challengeCode(ch, ch.score) : '' };
  }

  /** 달을 넘기기 전 모습 — 증감과 "이번 달 새로 쌓인 로그" 를 가르는 기준 */
  function snapshot() {
    var st = state(), s = summary(st.me), log = core.save.log;
    return { gold: s.gold, food: s.food, troops: s.troops, cities: s.cities, head: log.length ? log[0] : null };
  }

  var LOG_KIND = { bad: 4, warn: 3, good: 2, info: 1 };

  /** 이번 달 새로 쌓인 로그 중 중요한 셋 — 종류(나쁜 소식 먼저)·핵심 낱말·내 세력 언급 순 */
  function monthLines(head) {
    var log = core.save.log, fresh = [], i, mine = forceName(state().me);
    for (i = 0; i < log.length; i++) { if (log[i] === head) { break; } fresh.push({ e: log[i], at: i }); }
    fresh.forEach(function (x) {
      x.score = (LOG_KIND[x.e.kind] || 1) + (/함락|멸망|이탈|가뭄|수해|역병|황충|풍년|일기토|입성|이정표|승리|즉위/.test(x.e.text) ? 2 : 0) +
        (mine && x.e.text.indexOf(mine) >= 0 ? 2 : 0);
    });
    fresh.sort(function (a, b) { return b.score - a.score || a.at - b.at; });
    var out = fresh.slice(0, 3).map(function (x) { return x.e.text; });
    return out.length ? out : ['이번 달은 별일 없이 지나갔다.'];
  }

  /** 다음 달 권고 1개 — 내 성마다 AI 가 고를 명령 중 가장 급한 것. 급함 순서는 pickOrder 안의 검사 순서를 따랐다(agri 는 끝이 밑바닥 기본값이라 뒤로) */
  var REC_RANK = { sec: 0, comm: 1, wall: 2, ships: 3, draft: 4, train: 5, tech: 6, agri: 7 };
  function recommend() {
    var st = state(), AI = global.DG.rtkAI, best = null;
    if (!AI || !AI.pickOrder) { return null; }
    citiesOf(st.me).forEach(function (id) {
      var key = AI.pickOrder(id, st.me), rk = REC_RANK[key] === undefined ? 9 : REC_RANK[key];
      if (!best || rk < best.rank) { best = { rank: rk, cityId: id, key: key }; }
    });
    if (!best) { return null; }
    var o = orderByKey(best.key), d = CD.find(best.cityId);
    if (!o || !d) { return null; }
    return { cityId: best.cityId, city: d.name, key: best.key, name: o.name, emoji: o.emoji, text: d.name + ' — ' + o.emoji + ' ' + o.name };
  }

  /** 카드 데이터(§3-B 규격) — `next` 는 다음 달 권고 한 줄 */
  function monthReport(snap) {
    var st = state(), s = summary(st.me), rec = recommend(), mv = milestoneView();
    return {
      year: st.year, month: st.month, turn: st.turn || 0,
      lines: monthLines(snap.head),
      gold: { from: snap.gold, to: s.gold }, food: { from: snap.food, to: s.food },
      troops: { from: snap.troops, to: s.troops }, cities: { from: snap.cities, to: s.cities },
      rec: rec, next: rec ? rec.text : '',
      milestone: mv && mv.cur ? { idx: mv.idx + 1, total: mv.total, name: mv.cur.name, cur: mv.progress.cur, need: mv.progress.need } : null,
      victory: victoryNext(), challenge: challengeView()
    };
  }

