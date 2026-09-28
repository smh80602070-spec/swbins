/* rift.js — 비경(祕境): 5층 노드 지도 + 축복 3택 + 기억 조각 (PLAN §5-3)
 *
 * 사냥터 엔진(side.js)을 그대로 쓴다 — 비경 한 판은 "갈림길 방(hub)" 과 "층마다 만든 임시
 * 사냥터"를 side.js 의 `placeIn()` 으로 갈아 끼우는 것뿐이고, 판정(전투·피격·드랍)은 전부
 * side.js 가 한다. 이 파일은 **지도·축복·이벤트·보상**만 맡고, side.js 에는 곳곳에 한 줄짜리
 * 훅(run.rm 을 읽는 곱셈)만 있다.
 *
 * 흐름(save.rift.phase): boon(축복 3택) → map(다음 노드 고르기) → fight(전투·정예·수호장) /
 *   event(이벤트 선택) → 다시 map … → 5층 수호장을 쓰러뜨리면 클리어.
 * 죽거나 나가면 진행(축복·층)은 사라지고, 이미 받은 기억 조각(save.player.memFrag)만 남는다.
 *
 * 세이브: save.rift(진행 중일 때만), save.player.memFrag(조각)·memUp{hp}(영구 강화 단)·
 *   memOpen{축복key:true}(풀어 둔 축복), save.riftStat{runs,clears,best}.
 * 결정론: 지도·축복 후보·이벤트 결과는 seed 로만 정한다(진단·되돌아오기 때문). */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var RD = global.DG.riftData;
  var AXES = ['atk', 'def', 'util'];

  var summaryStash = null;   // 클리어로 나갈 때 leave() 가 카드에 얹을 요약

  /* ── 씨앗 난수(mulberry32) ─────────────────────────── */
  function rngOf(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function S() { return global.DG.side; }
  function cur() { return core.save.rift || null; }
  function pl() { return core.save.player; }
  function memUp() { var p = pl(); if (!p.memUp) { p.memUp = {}; } return p.memUp; }
  function memOpen() { var p = pl(); if (!p.memOpen) { p.memOpen = {}; } return p.memOpen; }
  function stat() {
    if (!core.save.riftStat) { core.save.riftStat = { runs: 0, clears: 0, best: 0 }; }
    return core.save.riftStat;
  }
  function run() { return S().raw(); }

  /* ── 갈림길 방 — 전투가 없는 안전한 임시 사냥터 ───── */
  var HUB = {
    key: 'rift', name: '🌀 비경 · 갈림길', need: 1, sky: ['#2a1f4a', '#5a3f7a'], mood: 'cave',
    ground: '#2c2440', width: 900, floor: 560, town: true, rift: true,
    plats: [], ropes: [], portals: [], npcs: [], gathers: [], enemyLv: 1, spawn: 0
  };

  /* ── 지도 ──────────────────────────────────────────── */

  /** 5층 노드 지도 — seed 하나로 정해진다. 층마다 2~3 노드, 5층은 수호장 하나.
   *  첫 세 층은 전투가 하나 보장되고, 4층에는 휴식이 보장된다. */
  function genMap(seed) {
    var r = rngOf((seed ^ 0x51f7a3) >>> 0), out = [], f, i;
    for (f = 0; f < RD.FLOORS - 1; f++) {
      var pool = RD.FLOOR_POOL[f].slice();
      var n = 2 + (r() < 0.5 ? 1 : 0);
      var kinds = [];
      var first = (f === RD.FLOORS - 2) ? 'rest' : 'battle';
      kinds.push(first);
      pool.splice(pool.indexOf(first), 1);
      /* 첫 층만 전투가 둘일 수 있다 — 나머지는 서로 다른 종류 */
      if (f === 0 && n === 3 && r() < 0.5) { kinds.push('battle'); }
      while (kinds.length < n && pool.length) {
        var k = pool.splice(Math.floor(r() * pool.length), 1)[0];
        if (kinds.indexOf(k) < 0 || k === 'battle') { kinds.push(k); }
      }
      /* 순서를 섞는다 */
      for (i = kinds.length - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1)), tmp = kinds[i]; kinds[i] = kinds[j]; kinds[j] = tmp;
      }
      out.push(kinds.map(function (kd) { return { kind: kd }; }));
    }
    out.push([{ kind: 'boss' }]);
    return out;
  }

  function mapOf(r) { return genMap((r || cur()).seed); }

  /* ── 주간 변형자 ───────────────────────────────────── */
  function variantOf(weekKey) {
    var s = 0, i;
    for (i = 0; i < weekKey.length; i++) { s = (s * 31 + weekKey.charCodeAt(i)) >>> 0; }
    return RD.VARIANTS[s % RD.VARIANTS.length];
  }
  function variantNow() {
    var r = cur();
    var key = r ? r.variant : variantOf(S().weekKey()).key;
    for (var i = 0; i < RD.VARIANTS.length; i++) { if (RD.VARIANTS[i].key === key) { return RD.VARIANTS[i]; } }
    return RD.VARIANTS[0];
  }

  /* ── 축복 ──────────────────────────────────────────── */

  function boonOpen(b) { return !b.locked || !!memOpen()[b.key]; }

  /** 이번 판에 뽑을 수 있는 축복 — 이미 가진 것·잠긴 것은 뺀다 */
  function candidates(axis, owned) {
    return RD.BOONS.filter(function (b) {
      return b.axis === axis && boonOpen(b) && owned.indexOf(b.key) < 0;
    });
  }

  /** 3택 — 서로 다른 축에서 하나씩(§3-D). 후보가 다 떨어진 축은 건너뛴다. seed·salt 로 정해진다 */
  function offerFor(seed, salt, owned) {
    var r = rngOf((seed ^ (salt * 7919 + 13)) >>> 0), out = [];
    AXES.forEach(function (ax) {
      var c = candidates(ax, owned);
      if (c.length) { out.push(c[Math.floor(r() * c.length)].key); }
    });
    return out;
  }

  var NOMODS = {
    dmg: 0, crit: 0, critMul: 0, leech: 0, bossDmg: 0, exec: 0,
    guard: 0, hpUp: 0, regen: 0, invuln: 0, shield: 0, revive: 0,
    speed: 0, mp: 0, dodge: 0, gold: 0, potion: 0, shard: 0,
    reward: 1, noPotion: false
  };

  /** 지금 가진 축복(과 주간 변형자)을 한 표로 더한다 — side.js 가 run.rm 으로 읽는다 */
  function modsFor(r) {
    var m = {}, k;
    for (k in NOMODS) { if (Object.prototype.hasOwnProperty.call(NOMODS, k)) { m[k] = NOMODS[k]; } }
    if (!r) { return m; }
    (r.boons || []).forEach(function (key) {
      var b = RD.boon(key);
      if (!b) { return; }
      for (var f in b.fx) { if (Object.prototype.hasOwnProperty.call(b.fx, f)) { m[f] += b.fx[f]; } }
    });
    var v = variantNow();
    if (v.reward) { m.reward = v.reward; }
    if (v.noPotion) { m.noPotion = true; }
    return m;
  }
  function mods() { return modsFor(cur()); }

  /** 축복 이름표 — "〈이름〉의 검세" (도감에서 이름을 읽는다) */
  function boonLabel(b) {
    var h = global.DG.data && global.DG.data.find ? global.DG.data.find(b.hero) : null;
    return (h ? h.name + ' 의 ' : '') + b.name;
  }

  /** run 에 지금 축복을 반영한다 — 최대 체력이 늘면 그만큼 즉시 채운다 */
  function syncRun() {
    var rn = run(), r = cur();
    if (!rn) { return; }
    rn.rift = true;
    rn.rm = modsFor(r);
    var newMax = Math.round(S().power().hp * (1 + rn.rm.hpUp));
    if (newMax !== rn.hpMax) {
      if (newMax > rn.hpMax) { rn.hp += newMax - rn.hpMax; }
      rn.hpMax = newMax;
      rn.hp = Math.min(rn.hp, rn.hpMax);
    }
  }

  function emitPhase() {
    core.emit('rift:phase', cur());
    core.emit('changed');
  }

  function saveHp() {
    var rn = run(), r = cur();
    if (rn && r && rn.hpMax > 0) { r.hpFrac = Math.max(0.05, Math.min(1, rn.hp / rn.hpMax)); }
  }

  /* ── 영구 강화(기억 조각) ─────────────────────────── */

  function memHpMul() { return 1 + RD.MEM_HP_STEP * (memUp().hp || 0); }
  function hpUpCost() { return 2 + ((memUp().hp || 0) + 1); }

  function buyHp() {
    var p = pl(), n = memUp().hp || 0;
    if (n >= RD.MEM_HP_MAX) { core.emit('toast', '이미 가장 높은 단입니다'); return false; }
    var cost = hpUpCost();
    if ((p.memFrag || 0) < cost) { core.emit('toast', '🧩 기억 조각이 모자랍니다 (' + cost + ' 필요)'); return false; }
    p.memFrag -= cost;
    memUp().hp = n + 1;
    core.persist();
    core.emit('changed');
    return true;
  }

  function unlockBoon(key) {
    var b = RD.boon(key), p = pl();
    if (!b || !b.locked || memOpen()[key]) { return false; }
    if ((p.memFrag || 0) < RD.UNLOCK_COST) { core.emit('toast', '🧩 기억 조각이 모자랍니다 (' + RD.UNLOCK_COST + ' 필요)'); return false; }
    p.memFrag -= RD.UNLOCK_COST;
    memOpen()[key] = true;
    core.persist();
    core.emit('changed');
    return true;
  }

  function addShards(n) {
    var r = cur();
    if (n <= 0) { return; }
    pl().memFrag = (pl().memFrag || 0) + n;
    if (r) { r.shards = (r.shards || 0) + n; }
  }

  /* ── 시작 ──────────────────────────────────────────── */

  function available() {
    if (pl().level < RD.NEED_LV) { return { ok: false, reason: 'Lv.' + RD.NEED_LV + ' 부터 열립니다' }; }
    if (!core.save.party.length) { return { ok: false, reason: '도감에서 인물을 하나 앞에 세우세요' }; }
    return { ok: true };
  }

  function pending() { return !!cur(); }

  function makeOffer(from) {
    var r = cur();
    var off = offerFor(r.seed, (r.offers || 0) + 1, r.boons);
    r.offers = (r.offers || 0) + 1;
    if (!off.length) { r.phase = 'map'; r.offer = null; return false; }
    r.phase = 'boon'; r.offer = off; r.offerFrom = from;
    return true;
  }

  function begin() {
    if (cur()) { return restore(); }
    var a = available();
    if (!a.ok) { core.emit('toast', '⚠️ ' + a.reason); return false; }
    var wk = S().weekKey();
    core.save.rift = {
      seed: ((Math.random() * 4294967296) >>> 0) || 1,
      floor: 0, phase: 'boon', path: [], boons: [], offers: 0, offer: null, offerFrom: 'start',
      cur: null, ev: null, weekKey: wk, variant: variantOf(wk).key,
      shards: 0, cleared: 0, revived: false, hpFrac: 1
    };
    stat().runs += 1;
    S().placeIn(HUB);
    syncRun();
    makeOffer('start');
    core.log('🌀 비경에 들어섰다 — ' + variantNow().name, 'info');
    core.persist();
    emitPhase();
    return true;
  }

  /** 새로 고침·다른 곳에서 돌아온 뒤 — 갈림길 방에 다시 서서 이어 간다 */
  function restore() {
    var r = cur();
    if (!r) { return false; }
    if (!S().placeIn(HUB)) { return false; }
    syncRun();
    var rn = run();
    rn.hp = Math.max(1, Math.round(rn.hpMax * (r.hpFrac || 1)));
    if (r.phase === 'fight' && r.cur) {
      /* 싸움 도중이었다면 그 층을 처음부터 다시 연다(쓰러뜨린 수는 잃는다) */
      var node = mapOf(r)[r.floor][r.cur.idx];
      startFight(node, r.cur.idx);
    }
    emitPhase();
    return true;
  }

  /* ── 노드 고르기 ──────────────────────────────────── */

  function choose(idx) {
    var r = cur();
    if (!r || r.phase !== 'map') { return false; }
    var row = mapOf(r)[r.floor];
    var node = row && row[idx];
    if (!node) { return false; }
    r.path.push(idx);
    if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss') {
      startFight(node, idx);
    } else if (node.kind === 'treasure') {
      treasure();
      floorDone('treasure');
    } else if (node.kind === 'rest') {
      rest();
      floorDone('rest');
    } else if (node.kind === 'event') {
      r.phase = 'event';
      var er = rngOf((r.seed ^ (r.floor * 977 + 31)) >>> 0);
      r.ev = { key: RD.EVENTS[Math.floor(er() * RD.EVENTS.length)].key, idx: idx };
      core.persist();
      emitPhase();
    }
    return true;
  }

  /* ── 층 스테이지 만들기 ───────────────────────────── */

  function openFields() {
    var out = [], all = S().stages(), i;
    for (i = 0; i < all.length; i++) {
      if (all[i].open && !all[i].ref.town && all[i].ref.spawn > 0) { out.push(all[i].ref); }
    }
    return out;
  }

  function floorStage(kind, floor, idx) {
    var fields = openFields(), r = cur();
    var rr = rngOf((r.seed ^ (floor * 131 + idx * 17 + 5)) >>> 0);
    var tpl = fields[Math.floor(rr() * fields.length)] || global.DG.sideData.stage('field');
    var base = 1, i;
    for (i = 0; i < fields.length; i++) { base = Math.max(base, fields[i].enemyLv); }
    var lv = base + ((floor + 1) >> 1) + (kind === 'boss' ? 1 : 0);
    var stg = {}, k;
    for (k in tpl) { if (Object.prototype.hasOwnProperty.call(tpl, k)) { stg[k] = tpl[k]; } }
    stg.key = 'rift';
    stg.name = '🌀 비경 ' + (floor + 1) + '층 · ' + RD.KINDS[kind].name;
    stg.enemyLv = lv; stg.spawn = 0; stg.town = false; stg.rift = true;
    stg.boss = null; stg.gateBoss = null; stg.gathers = []; stg.npcs = []; stg.portals = [];
    return stg;
  }

  function tune(e) {
    var v = variantNow();
    if (!e) { return e; }
    if (v.enemyHp) { e.hp = Math.round(e.hp * v.enemyHp); e.hpMax = e.hp; }
    if (v.enemyDmg) { e.dmg = Math.round(e.dmg * v.enemyDmg); }
    if (v.enemySpd) { e.spd = e.spd * v.enemySpd; }
    return e;
  }

  function spawnMinion(atX) { return tune(S().spawnEnemy(atX)); }

  function startFight(node, idx) {
    var r = cur(), kind = node.kind;
    var stg = floorStage(kind, r.floor, idx);
    if (!S().placeIn(stg)) { return false; }
    syncRun();
    var rn = run();
    rn.riftShield = !!rn.rm.shield;
    var goal = 0, i;
    if (kind === 'battle') {
      goal = RD.BATTLE_GOAL[Math.min(r.floor, RD.BATTLE_GOAL.length - 1)];
      for (i = 0; i < Math.min(5, goal); i++) { spawnMinion(); }
    } else if (kind === 'elite') {
      goal = 1;
      for (i = 0; i < RD.ELITE_ESCORT; i++) { spawnMinion(); }
      var el = tune(S().spawnEnemy(stg.width - 260, { hp: 7, dmg: 1.7 }));
      if (el) { el.riftElite = true; }
    } else {
      goal = 1;
      spawnBoss(stg);
      for (i = 0; i < 2; i++) { spawnMinion(); }
    }
    r.phase = 'fight';
    r.cur = { kind: kind, idx: idx, goal: goal, kills: 0 };
    r.offer = null;
    core.persist();
    emitPhase();
    return true;
  }

  function spawnBoss(stg) {
    var rn = run(), ed = global.DG.enemyData;
    var ref = ed ? ed.bossByName('관문 수호장') : { name: '관문 수호장', kind: 'human', color: '#5a5a6a' };
    var lv = stg.enemyLv;
    var bh = global.DG.side && global.DG.side.baseHpOf ? global.DG.side.baseHpOf(lv) : 18 * Math.pow(1.22, lv - 1);   // 초반 바닥(side.baseHpOf)
    var hp = Math.max(1, Math.round(bh * RD.BOSS_HP_MUL * core.tuned('enemy.hpMul', 1)));
    var e = {
      ref: ref, boss: true, riftBoss: true,
      x: stg.width - 220, y: stg.floor - 52, w: 52, h: 52,
      hp: hp, hpMax: hp,
      dmg: Math.round((4 + lv * 1.6) * RD.BOSS_DMG_MUL * core.tuned('enemy.dmgMul', 1)),
      dir: -1, spd: 38 + Math.min(40, lv * 2),
      phase: 0, hurt: 0, cd: 0, atkAnim: 0, chargeCd: 4 + Math.random() * 3, charge: 0
    };
    tune(e);
    rn.enemies.push(e);
    rn.boss = e;
    S().fx().push({ t: 'bossintro', name: ref.name, life: 1.8 });
    if (global.DG.sfx) { global.DG.sfx.play('boss'); }
    return e;
  }

  /* ── 싸움이 끝나는 곳 — side.js kill() 이 부른다 ──── */

  function clearField() {
    var rn = run();
    if (!rn) { return; }
    rn.enemies = []; rn.shots = []; rn.eshots = []; rn.boss = null;
  }

  /** 적 하나가 쓰러졌다 — 층이 끝나는지만 표시해 두고, 실제 정리는 tick() 이 update() 머리에서 한다
   *  (타격 반복문 한가운데서 무대를 갈아 끼우면 이미 든 배열이 어긋난다) */
  function onKill(e) {
    var r = cur(), rn = run();
    if (!r || !rn || r.phase !== 'fight' || !r.cur || r.cur.done) { return; }
    var c = r.cur;
    c.kills += 1;
    if (c.kind === 'battle') {
      if (c.kills >= c.goal) { c.done = true; rn.riftTick = true; return; }
      /* 한 번에 5마리까지만 — 목표까지 모자란 만큼 채운다 */
      if (rn.enemies.length + c.kills < c.goal) { spawnMinion(); }
    } else if (c.kind === 'elite') {
      if (e.riftElite) { c.done = true; rn.riftTick = true; return; }
    } else if (c.kind === 'boss') {
      if (e.riftBoss) { c.done = true; rn.riftTick = true; return; }
    }
    core.emit('changed');
  }

  /** side.js update() 머리에서 부른다 — 끝난 층을 정리하고 다음 화면을 연다 */
  function tick() {
    var r = cur(), rn = run();
    if (!r || !rn || !r.cur || !r.cur.done) { return; }
    var kind = r.cur.kind;
    clearField();
    if (kind === 'battle') { floorDone('battle'); }
    else if (kind === 'elite') { eliteDone(); }
    else { complete(); }
  }

  function eliteDone() {
    var m = mods();
    addShards(m.shard);
    floorDone('elite', 'elite');
  }

  /** 한 층을 마쳤다 — 조각 1, 다음 층으로. offerFrom 이 있으면 축복 3택을 한 번 더 연다 */
  function floorDone(kind, offerFrom) {
    var r = cur();
    saveHp();
    r.cleared += 1;
    addShards(1);
    r.floor += 1;
    r.cur = null;
    r.ev = null;
    if (r.floor > stat().best) { stat().best = r.floor; }
    S().placeIn(HUB);
    syncRun();
    if (offerFrom) { makeOffer(offerFrom); } else { r.phase = 'map'; r.offer = null; }
    core.log('🌀 비경 ' + r.floor + '층 통과 · 🧩 조각 ' + r.shards, 'info');
    core.persist();
    emitPhase();
  }

  /* ── 보물·휴식·이벤트 ────────────────────────────── */

  function floorLv() {
    var fields = openFields(), lv = 1;
    fields.forEach(function (f) { lv = Math.max(lv, f.enemyLv); });
    return lv + (((cur() ? cur().floor : 0) + 1) >> 1);
  }

  function treasure() {
    var rn = run(), lv = floorLv(), m = mods();
    var gold = Math.round((40 + lv * 12) * (0.8 + Math.random() * 0.6) * m.reward * (1 + m.gold) *
      core.tuned('gain.goldMul', 1));
    rn.gold += gold;
    var GG = global.DG.gear, GD = global.DG.gearData, bits = ['🪙 ' + gold], made = null;
    if (GG && GD) {
      made = GG.make(core.pick(GD.poolFor(lv)).key);
      if (GG.put(made)) { rn.gearFound += 1; bits.push('📦 ' + GG.nameOf(made)); }
      if (Math.random() < 0.5) {
        var sc = core.pick(GD.SCROLLS);
        GG.addScroll(sc.key, 1);
        bits.push('📜 ' + sc.name);
      }
    }
    core.emit('toast', '🎁 ' + bits.join(' · '));
    core.log('🎁 비경 보물 — ' + bits.join(' · '), 'good');
  }

  function rest() {
    var rn = run();
    rn.hp = Math.min(rn.hpMax, rn.hp + Math.round(rn.hpMax * 0.45));
    rn.mp = rn.mpMax;
    core.emit('toast', '🏕️ 숨을 골랐다 — 체력이 채워졌다');
  }

  function eventDef(key) {
    for (var i = 0; i < RD.EVENTS.length; i++) { if (RD.EVENTS[i].key === key) { return RD.EVENTS[i]; } }
    return null;
  }

  /** 이벤트 선택지 하나를 고른다 — 결과는 씨앗으로 정해진다(새로 고침해도 같다) */
  function pickEvent(optKey) {
    var r = cur(), rn = run();
    if (!r || r.phase !== 'event' || !r.ev) { return false; }
    var def = eventDef(r.ev.key), i, ok = false;
    for (i = 0; i < def.opts.length; i++) { if (def.opts[i].key === optKey) { ok = true; } }
    if (!ok) { return false; }
    var offerFrom = null;
    if (r.ev.key === 'altar' && optKey === 'give') {
      rn.hp = Math.max(1, rn.hp - Math.round(rn.hpMax * 0.2));
      offerFrom = 'altar';
    } else if (r.ev.key === 'spring') {
      if (optKey === 'drink') { rn.hp = Math.min(rn.hpMax, rn.hp + Math.round(rn.hpMax * 0.5)); }
      else { S().state().potions += 2; core.emit('toast', '🧪 탕약 +2'); }
    } else if (r.ev.key === 'gambler' && optKey === 'bet') {
      if ((pl().memFrag || 0) < 1) { core.emit('toast', '🧩 걸 조각이 없습니다'); return false; }
      var win = rngOf((r.seed ^ (r.floor * 4099 + 7)) >>> 0)() < 0.5;
      if (win) { pl().memFrag += 3; r.shards += 3; core.emit('toast', '🎲 이겼다! 🧩 +3'); }
      else { pl().memFrag -= 1; core.emit('toast', '🎲 졌다… 🧩 -1'); }
    }
    floorDone('event', offerFrom);
    return true;
  }

  /* ── 축복 고르기 ──────────────────────────────────── */

  function pickBoon(key) {
    var r = cur();
    if (!r || r.phase !== 'boon' || !r.offer || r.offer.indexOf(key) < 0) { return false; }
    r.boons.push(key);
    r.offer = null;
    r.phase = 'map';
    var b = RD.boon(key);
    core.log('✨ 축복 — ' + boonLabel(b) + ' (' + b.desc + ')', 'good');
    core.emit('toast', '✨ ' + boonLabel(b));
    syncRun();
    saveHp();
    core.persist();
    emitPhase();
    return true;
  }

  /* ── 전투 중 훅(side.js 가 부른다) ───────────────── */

  /** 층마다 첫 피격 하나를 막는다(방패) */
  function tryShield() {
    var rn = run();
    if (!rn || !rn.riftShield) { return false; }
    rn.riftShield = false;
    return true;
  }

  /** 쓰러질 때 한 번 40% 로 일어선다(불굴) */
  function tryRevive() {
    var r = cur(), rn = run();
    if (!r || !rn || !rn.rm || !rn.rm.revive || r.revived) { return false; }
    r.revived = true;
    rn.hp = Math.max(1, Math.round(rn.hpMax * 0.4));
    return true;
  }

  /* ── 클리어 ───────────────────────────────────────── */

  function complete() {
    var r = cur(), rn = run(), m = mods(), v = variantNow();
    var lv = floorLv(), bits = [];
    r.cleared += 1;
    var s = core.save.side;
    var GG = global.DG.gear, UD = global.DG.uniqueData, GD = global.DG.gearData;
    if (GG && UD && UD.UNIQUES.length) {
      var uq = UD.UNIQUES[(s.gateUniq || 0) % UD.UNIQUES.length];
      s.gateUniq = (s.gateUniq || 0) + 1;
      var made = GG.make(uq.key);
      if (GG.put(made)) { bits.push('⭐ ' + GG.nameOf(made)); rn.gearFound += 1; }
    }
    if (GG && GD) {
      var pool60 = GD.SCROLLS.filter(function (sc) { return sc.rate === 0.6; });
      var picked = [];
      for (var i = 0; i < 2; i++) {
        var sc = core.pick(pool60.length ? pool60 : GD.SCROLLS);
        GG.addScroll(sc.key, 1);
        picked.push(sc.name);
      }
      bits.push('📜 ' + picked.join(' · '));
    }
    var shards = 3 + m.shard + (v.shardBoss || 0);
    addShards(shards);
    bits.push('🧩 기억 조각 +' + shards);
    core.gainFeat(40 + lv * 5, '비경 정복');
    stat().clears += 1;
    stat().best = RD.FLOORS;
    core.log('🌀 비경을 정복했다! — ' + bits.join(' · '), 'good');
    core.emit('toast', '🌀 비경 정복!');
    summaryStash = { clear: true, floors: RD.FLOORS, shards: r.shards, boons: r.boons.length };
    core.save.rift = null;
    core.persist();
    core.emit('rift:phase', null);
    S().leave();
  }

  /* ── 끝(나감·쓰러짐) — side.js leave()/die() 가 부른다 ── */

  /** 진행을 지우고 카드에 얹을 요약을 돌려준다 */
  function onEnd(reason) {
    var r = cur();
    if (r) {
      var sum = { clear: false, dead: reason === 'dead', floors: r.cleared, shards: r.shards, boons: r.boons.length };
      core.save.rift = null;
      core.persist();
      core.emit('rift:phase', null);
      return sum;
    }
    var st = summaryStash;
    summaryStash = null;
    return st;
  }

  /** 지도 화면의 "포기" — 조각은 이미 받은 만큼 남는다 */
  function abandon() {
    if (!cur()) { return false; }
    if (!run()) {                       // 새로 고침 뒤 아직 못 돌아온 진행 — 그냥 지운다
      core.save.rift = null;
      core.persist();
      core.emit('rift:phase', null);
      return true;
    }
    S().leave();
    return true;
  }

  /** 화면이 읽는 요약 */
  function info() {
    var r = cur(), s = stat(), v = variantNow();
    var open = {};
    RD.BOONS.forEach(function (b) { if (boonOpen(b)) { open[b.key] = true; } });
    return {
      pending: !!r, phase: r ? r.phase : null, floor: r ? r.floor : 0,
      map: r ? mapOf(r) : null, path: r ? r.path : [],
      offer: r ? r.offer : null, ev: r ? r.ev : null, cur: r ? r.cur : null,
      boons: r ? r.boons.slice() : [], shards: pl().memFrag || 0, gained: r ? r.shards : 0,
      variant: v, memHp: memUp().hp || 0, hpCost: hpUpCost(), open: open,
      runs: s.runs, clears: s.clears, best: s.best, available: available()
    };
  }

  global.DG.rift = {
    genMap: genMap, mapOf: mapOf, offerFor: offerFor, modsFor: modsFor, mods: mods,
    variantOf: variantOf, variantNow: variantNow, boonLabel: boonLabel, eventDef: eventDef,
    memHpMul: memHpMul, buyHp: buyHp, unlockBoon: unlockBoon,
    available: available, pending: pending, begin: begin, restore: restore,
    choose: choose, pickBoon: pickBoon, pickEvent: pickEvent, abandon: abandon,
    onKill: onKill, tick: tick, onEnd: onEnd, tryShield: tryShield, tryRevive: tryRevive,
    info: info, hub: HUB
  };
})(window);
