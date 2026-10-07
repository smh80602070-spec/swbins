/**
 * 목표판 — 지금·이번 세션·이번 주 세 줄 + 세션 카드 + 일일/주간
 * ---------------------------------------------------------------
 * PLAN §5.6. 재료(유적·던전·상인·인물 합류)는 다 있는데 그것을 "화면 위
 * 3줄"로 엮는 자리가 없었다 — 여기가 그 자리다. **판정 파일은 한 줄도
 * 안 건드린다** — 전부 이미 나가는 사건(core.on)만 듣는다.
 *
 * 세이브: save.goals = {
 *   counts: { relic, hero, merchant, roadmark, room, floor, levelup, clearLeave } — 평생 누적, 안 줄어든다.
 *   now:     { idx, base }                         — "지금" 줄 회전 자리
 *   session: { idx, base, start, gold0, feat0 }     — "이번 세션" 줄 + 카드 기준값
 *   weekly:  { week, base:{}, bundleDone:{}, claimed, poolIdx, poolBase }
 *   daily:   { date, base:{}, bundleDone:{}, claimed }
 * }
 *
 * 월드 보스(5.4)·부적 던전(5.3)은 아직 없다 — 주간 묶음 표에는 넣어 두되
 * `stub:true` 로 막아, 다 안 갖춰진 시스템 때문에 목표가 영영 못 채워지는
 * 일이 없게 한다(완성 조건에서 스텁은 아예 뺀다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* ── 후보 표 ──────────────────────────────────────────── */

  var NOW_POOL = [
    { id: 'n_relic',    counter: 'relic',    target: 1, label: '가까운 유적 찾기' },
    { id: 'n_room',     counter: 'room',     target: 1, label: '이 방 정리' },
    { id: 'n_roadmark', counter: 'roadmark', target: 1, label: '길 위 발견거리 밟기' },
    { id: 'n_merchant', counter: 'merchant', target: 1, label: '방물장수 만나기' },
    { id: 'n_floor',    counter: 'floor',    target: 1, label: '한 층 내려가기' }
  ];

  var SESSION_POOL = [
    { id: 's_floor3',    counter: 'floor',      target: 3, label: '3층 내려가기' },
    { id: 's_leave1',    counter: 'clearLeave', target: 1, label: '노획물 챙겨 탈출하기' },
    { id: 's_merchant1', counter: 'merchant',   target: 1, label: '방물장수 만나기' },
    { id: 's_levelup1',  counter: 'levelup',    target: 1, label: '인물 성장(레벨업) 1회' },
    { id: 's_relic2',    counter: 'relic',      target: 2, label: '유적 2곳 찾기' }
  ];

  var WEEKLY_POOL = [
    { id: 'w_hero1',   counter: 'hero',       target: 1, label: '새 인물 합류' },
    { id: 'w_floor5',  counter: 'floor',      target: 5, label: '5개 층 내려가기' },
    { id: 'w_relic5',  counter: 'relic',      target: 5, label: '유적 5곳 찾기' },
    { id: 'w_leave3',  counter: 'clearLeave', target: 3, label: '던전 3회 탈출' }
  ];

  /* 일일/주간 고정 묶음 — 전부 채우면 한 번 보너스 (§5.6 "일일/주간") */
  var DAILY_BUNDLE = [
    { id: 'd_relic',    counter: 'relic',    target: 1, label: '유적 1곳' },
    { id: 'd_merchant', counter: 'merchant', target: 1, label: '방물장수 1회' },
    { id: 'd_floor3',   counter: 'floor',    target: 3, label: '3개 층' }
  ];
  var WEEKLY_BUNDLE = [
    /* 2026-09-18 — §5.4(월드 보스) 코드분이 들어와 스텁을 풀었다(주석대로
       "두 시스템이 들어오면" 이었지만 이번 세션은 §5.4 하나만 다룬다 —
       w_sigil 은 §5.3 완성 뒤에도 여전히 stub 다, 별도로 카운터를 잇는
       세션이 필요하다). */
    { id: 'w_worldboss', counter: 'worldboss', target: 1, label: '월드 보스 1회' },
    { id: 'w_sigil',     stub: true, label: '부적 티어 3(§5.3, 미구현)' },
    { id: 'w_hero',      counter: 'hero', target: 1, label: '인물 합류 1' }
  ];

  var COUNTER_KEYS = ['relic', 'hero', 'merchant', 'roadmark', 'room', 'floor', 'levelup', 'clearLeave', 'worldboss'];

  /* ── 날짜 키 (로컬 달력, saga-story quest.js todayKey() 와 같은 결) ──── */

  function todayKey(t) {
    var d = new Date(t || Date.now());
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }
  /** 월요일 시작 주차 키 */
  function weekKey(t) {
    var d = new Date(t || Date.now());
    d.setHours(0, 0, 0, 0);
    var day = d.getDay();                         // 0=일 … 6=토
    var diff = (day === 0 ? -6 : 1) - day;         // 그 주의 월요일까지 며칠
    d.setDate(d.getDate() + diff);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  /* ── 세이브 ───────────────────────────────────────────── */

  function snapshot(counts) {
    var out = {}, i;
    for (i = 0; i < COUNTER_KEYS.length; i++) { out[COUNTER_KEYS[i]] = counts[COUNTER_KEYS[i]] || 0; }
    return out;
  }

  function S() {
    var s = core.save;
    if (!s.goals) {
      s.goals = {
        counts: {},
        now: { idx: 0, base: 0 },
        session: { idx: 0, base: 0, start: Date.now(), gold0: s.player.gold, feat0: s.player.featTotal },
        weekly: { week: null, base: {}, bundleDone: {}, claimed: false, poolIdx: 0, poolBase: 0 },
        daily: { date: null, base: {}, bundleDone: {}, claimed: false }
      };
    }
    var g = s.goals;
    if (!g.counts) { g.counts = {}; }
    if (!g.now) { g.now = { idx: 0, base: 0 }; }
    if (!g.session) { g.session = { idx: 0, base: 0, start: Date.now(), gold0: s.player.gold, feat0: s.player.featTotal }; }
    if (!g.weekly) { g.weekly = { week: null, base: {}, bundleDone: {}, claimed: false, poolIdx: 0, poolBase: 0 }; }
    if (!g.daily) { g.daily = { date: null, base: {}, bundleDone: {}, claimed: false }; }
    ensureDaily(g);
    ensureWeekly(g);
    return g;
  }

  function ensureDaily(g) {
    var k = todayKey();
    if (g.daily.date === k) { return; }
    g.daily.date = k;
    g.daily.base = snapshot(g.counts);
    g.daily.bundleDone = {};
    g.daily.claimed = false;
  }

  function ensureWeekly(g) {
    var k = weekKey();
    if (g.weekly.week === k) { return; }
    g.weekly.week = k;
    g.weekly.base = snapshot(g.counts);
    g.weekly.bundleDone = {};
    g.weekly.claimed = false;
    g.weekly.poolIdx = 0;
    g.weekly.poolBase = 0;
  }

  function bump(counterKey) {
    var g = S();
    g.counts[counterKey] = (g.counts[counterKey] || 0) + 1;
    core.emit('changed');
  }

  /* ── "지금"·"이번 세션" 줄 — 후보 회전 ────────────────── */

  function progressOf(cand, base, counts) {
    return Math.max(0, (counts[cand.counter] || 0) - (base || 0));
  }

  /** pool 을 돌며 state.idx 후보가 다 찼으면 다음으로 넘긴다. {cand, progress} 를 낸다 */
  function ensureLine(state, pool, counts) {
    var cand = pool[state.idx % pool.length];
    var progress = progressOf(cand, state.base, counts);
    var guard = 0;
    while (progress >= cand.target && guard < pool.length) {
      state.idx = (state.idx + 1) % pool.length;
      cand = pool[state.idx % pool.length];
      state.base = counts[cand.counter] || 0;
      progress = progressOf(cand, state.base, counts);
      guard++;
    }
    return { cand: cand, progress: progress };
  }

  /* ── 도감 진척 % (ui.js DEX_COMPLETE 와 같은 셈, 여긴 순수 계산만) ── */

  function dexPct() {
    var D = global.DG.data, DD = global.DG.dungeonData, T = global.DG.town;
    var dex = core.save.dex || {};
    var cats = [
      ['heroes', D ? D.heroes.length : 0],
      ['pets', D ? D.pets.length : 0],
      ['regions', DD ? DD.THEMES.length : 0],
      ['relics', (T && T.fieldRelics) ? T.fieldRelics().length : 0]
    ];
    var owned = 0, total = 0, i;
    for (i = 0; i < cats.length; i++) {
      owned += Object.keys(dex[cats[i][0]] || {}).length;
      total += cats[i][1];
    }
    return total ? Math.round(owned / total * 100) : 0;
  }

  /* ── 일일/주간 묶음 진행 + 보너스 지급 ────────────────── */

  function bundleStatus(bundle, base, doneMap, counts) {
    var need = [], i, item, prog;
    for (i = 0; i < bundle.length; i++) {
      item = bundle[i];
      if (item.stub) { continue; }               // 미구현 항목은 완성 조건에서 뺀다
      if (doneMap[item.id]) { continue; }
      prog = Math.max(0, (counts[item.counter] || 0) - (base[item.counter] || 0));
      if (prog >= item.target) { doneMap[item.id] = true; continue; }
      need.push({ item: item, progress: prog });
    }
    return need;                                  // 비었으면(스텁 제외) 전부 완료
  }

  function claimDaily(g) {
    if (g.daily.claimed) { return; }
    g.daily.claimed = true;
    core.save.player.gold += 100;
    core.save.items.scroll = (core.save.items.scroll || 0) + 1;
    core.log('📋 일일 완료 · 금 +100 · 감정서 +1', 'good');
    core.emit('toast', '📋 일일 목표 완료 — 금 +100 · 감정서 +1');
  }

  function claimWeekly(g) {
    if (g.weekly.claimed) { return; }
    g.weekly.claimed = true;
    var IT = global.DG.item;
    if (IT) {
      var floor = (global.DG.dungeon ? global.DG.dungeon.status().best : 1) || 1;
      IT.add(IT.roll(floor, { tier: 4 }));
    }
    core.log('📋 주간 완료 · 전설 확정 지급', 'good');
    core.emit('toast', '📋 주간 목표 완료 — 전설 장비 확정 지급');
  }

  /* ── 공개: 지금 세 줄 ─────────────────────────────────── */

  function lines() {
    var g = S();
    var now = ensureLine(g.now, NOW_POOL, g.counts);
    var session = ensureLine(g.session, SESSION_POOL, g.counts);

    var weekNeed = bundleStatus(WEEKLY_BUNDLE, g.weekly.base, g.weekly.bundleDone, g.counts);
    var weekly;
    if (weekNeed.length) {
      weekly = { cand: weekNeed[0].item, progress: weekNeed[0].progress, bundle: true };
    } else {
      claimWeekly(g);
      var wp = { idx: g.weekly.poolIdx, base: g.weekly.poolBase };
      var r = ensureLine(wp, WEEKLY_POOL, g.counts);
      g.weekly.poolIdx = wp.idx; g.weekly.poolBase = wp.base;
      weekly = { cand: r.cand, progress: r.progress, bundle: false };
    }

    /* 일일 묶음은 화면 줄이 아니라 배경에서만 검사(§5.6 은 3줄만 규정) */
    var dayNeed = bundleStatus(DAILY_BUNDLE, g.daily.base, g.daily.bundleDone, g.counts);
    if (!dayNeed.length) { claimDaily(g); }

    return {
      now: { label: now.cand.label, progress: now.progress, target: now.cand.target },
      session: { label: session.cand.label, progress: session.progress, target: session.cand.target },
      weekly: { label: weekly.cand.label, progress: weekly.progress, target: weekly.cand.target || 0 }
    };
  }

  /* ── 세션 카드 ────────────────────────────────────────── */

  function buildCard(reason, floor, payload) {
    var g = S();
    var sess = g.session;
    var card = {
      reason: reason,
      floor: floor,
      gold: Math.round(core.save.player.gold - (sess.gold0 || 0)),
      feat: Math.round(core.save.player.featTotal - (sess.feat0 || 0)),
      dexPct: dexPct(),
      next: lines().session.label
    };
    if ((reason === 'leave' || reason === 'horde' || reason === 'nightmare' ||
         reason === 'trial' || reason === 'trial-fail') && payload && payload.loot) {
      card.items = payload.loot.items || 0;
    } else if (reason === 'dead' && payload && payload.lost) {
      card.lostGold = payload.lost.gold || 0;
      card.lostItems = payload.lost.items || 0;
      /* §5.2 — 잃은 게 있어 유품이 남았으면 "다음 할 것"을 그 회수로 덮는다.
         난입(§5.5)·부적(§5.3) 사망은 유품이 안 생기므로 건너뛴다. */
      if (!payload.horde && !payload.nightmare) {
        var DGN = global.DG.dungeon, grave = DGN && DGN.graveOf && DGN.graveOf();
        if (grave && grave.floor === floor) { card.next = '제' + floor + '층 유품 회수'; }
      }
    }
    /* 난입(§5.5) — 생존 초를 카드에 얹는다. 완주(reason:'horde')든 도중
       사망(reason:'dead', payload.horde 있음)이든 공통이다. */
    if (payload && payload.horde) { card.hordeSecs = payload.horde.secs || 0; }
    /* 부적 던전(§5.3) — 완주(reason:'nightmare')·도중 사망(reason:'dead',
       payload.nightmare 있음)·시간 초과(reason:'nightmare-fail') 셋 다
       카드에서 티어를 알아야 한다. */
    if (payload && payload.nightmare) {
      card.nmTier = payload.nightmare.tier;
      card.nmNext = !!payload.nightmare.nextSigil;
    }
    if (reason === 'nightmare-fail') { card.nmFail = true; }
    /* W-0102 — 보통 사망: 어디서·누구에게·무슨 피해 + 남는 것 + 은총에서 다시(grace.js) */
    if (reason === 'dead' && global.DG.grace) { global.DG.grace.decorate(card, payload); }
    /* 시련(§5.11) — 단계·걸린 시간·순위·새로 열린 단계 */
    if (payload && payload.trial) {
      card.trialLv = payload.trial.lv;
      if (payload.trial.sec != null) { card.trialSec = payload.trial.sec; }
      if (payload.trial.rank) { card.trialRank = payload.trial.rank; }
      if (payload.trial.open) { card.trialOpen = payload.trial.open; }
    }
    /* 세션을 여기서 닫는다 — 다음 판은 새 기준값에서 다시 잰다 */
    sess.start = Date.now();
    sess.gold0 = core.save.player.gold;
    sess.feat0 = core.save.player.featTotal;
    sess.idx = 0;
    sess.base = g.counts[SESSION_POOL[0].counter] || 0;
    return card;
  }

  /* ── 부팅 ─────────────────────────────────────────────── */

  function init() {
    S();                                          // 세이브 자리 보장 + 일일/주간 굴림
    core.on('dex:new', function (p) {
      if (!p) { return; }
      if (p.cat === 'relics') { bump('relic'); }
      else if (p.cat === 'heroes') { bump('hero'); }
    });
    core.on('town:npc', function (o) { if (o && o.key === 'fieldmerchant') { bump('merchant'); } });
    core.on('worldboss:kill', function () { bump('worldboss'); });   // §5.4 처치(dungeon.js grantWorldBossReward)
    core.on('town:mark', function (o) { if (o && o.roadMark) { bump('roadmark'); } });
    core.on('dungeon:room', function () { bump('room'); });
    core.on('dungeon:floor', function () { bump('floor'); });
    /* 목표 문구가 "인물 성장(레벨업)"이라 인물(hero.js) 레벨업을 센다(2026-09-23). 예전엔 core
       'levelup'(플레이어 레벨 — 이 판에선 표시 말고 쓰임이 없다)을 세어 문구와 달랐다 */
    core.on('hero:levelup', function () { bump('levelup'); });
    core.on('dungeon:end', function (e) {
      if (!e) { return; }
      if (e.reason === 'leave') { bump('clearLeave'); }
      var card = buildCard(e.reason, e.floor, e);
      core.emit('goals:card', card);
      core.emit('changed');
    });
    /* 탭을 닫을 때(§5.6 네 계기 중 하나) — 볼 사람이 없어 카드를 띄우진
       않지만, 세션은 여기서 마감해 다음에 열었을 때 새 세션으로 잰다. */
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { buildCard('hidden', 0, null); }
      });
    }
  }

  global.DG.goals = {
    init: init,
    lines: lines,
    todayKey: todayKey,
    weekKey: weekKey,
    dexPct: dexPct,
    /** 자가진단용 — 판정 없이 카운터를 직접 올려 본다 */
    _bump: bump,
    /** 자가진단용 — 세이브 자리를 직접 들여다본다 */
    _state: S,
    /** 자가진단용 — 후보 표(순서가 곧 idx 매핑) */
    _pools: { now: NOW_POOL, session: SESSION_POOL, weekly: WEEKLY_POOL }
  };

}(window));
