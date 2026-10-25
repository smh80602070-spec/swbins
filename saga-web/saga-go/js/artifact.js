/**
 * 보패(寶貝) — 장신구 다섯 칸·주/부옵션·세트 (PLAN §5 ⑲-5, 이름·수치는 §5 ⑳)
 * ---------------------------------------------------------------
 *   부위 다섯   패옥(체력)·비녀(공격력)은 주옵션이 정해져 있고, 가락지·향낭·관모는 부위마다 고른다
 *   ★4·★5      최대 +12 · +15, 부옵션 처음 2~3 · 3~4. +3 마다 넷 미만이면 새로 하나, 넷이면 하나가 오른다
 *   세트 다섯   2 세트·4 세트 효과(SETS) — 이름·수치는 PLAN §5 ⑳ 표(이 판 것)
 *   강화·분해   연마석으로 강화, 분해하면 연마석이 돌아온다. 가진 것 상한 200(넘치면 안 낀 ★4 부터 분해)
 *
 * 무작위는 보패마다 번호로 정한 씨앗(mulberry32)으로 굴린다 — 진단·세이브가 늘 같게.
 * 주옵션 곡선·부옵션 한 번·굴림 셋·칸 구성은 모두 §5 ⑳ 의 이 판 수치다. 칸·세트 id 는 세이브 키라 그대로.
 * **들판 전투에만 탄다**(field-combat.js memberOf). 세이브 `save.artifacts = { seq, list }`,
 * 연마석은 `save.gearMat.polish`(weapon.js 와 같은 칸). SAVE_VERSION 은 그대로.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var SLOTS = ['flower', 'plume', 'sands', 'goblet', 'circlet'];
  var SLOT_NAMES = { flower: '패옥', plume: '비녀', sands: '가락지', goblet: '향낭', circlet: '관모' };
  var SLOT_ICON = { flower: '📿', plume: '📍', sands: '💍', goblet: '👝', circlet: '👑' };
  var STAT_NAMES = {
    hp: '체력', atk: '공격력', def: '방어력', hp_pct: '체력%', atk_pct: '공격력%', def_pct: '방어력%',
    energy: '기력 획득', crit_rate: '치명타 확률', crit_dmg: '치명타 피해',
    elem_fire: '화 피해', elem_water: '수 피해', elem_elec: '뇌 피해', elem_wind: '풍 피해',
    elem_ice: '빙 피해', elem_rock: '암 피해', elem_grass: '초 피해', elem_phys: '물리 피해'
  };
  var FLAT = { hp: 1, atk: 1, def: 1 };
  /* 주옵션 ★5 [+0, +15] — §5 ⑳ */
  var MAIN = {
    hp: [80, 480], atk: [20, 120],
    atk_pct: [0.06, 0.42], hp_pct: [0.06, 0.42], def_pct: [0.08, 0.52],
    energy: [0.07, 0.46], crit_rate: [0.04, 0.28], crit_dmg: [0.08, 0.56],
    elem_fire: [0.06, 0.42], elem_water: [0.06, 0.42], elem_elec: [0.06, 0.42], elem_wind: [0.06, 0.42],
    elem_ice: [0.06, 0.42], elem_rock: [0.06, 0.42], elem_grass: [0.06, 0.42], elem_phys: [0.08, 0.52]
  };
  /* 칸 구성 — 가락지 = 치명, 향낭 = 원소·체력·방어, 관모 = 기력 */
  var SLOT_MAINS = {
    flower: ['hp'],
    plume: ['atk'],
    sands: ['atk_pct', 'crit_rate', 'crit_dmg'],
    goblet: ['hp_pct', 'def_pct', 'elem_fire', 'elem_water', 'elem_elec', 'elem_wind', 'elem_ice', 'elem_rock', 'elem_grass', 'elem_phys'],
    circlet: ['atk_pct', 'hp_pct', 'def_pct', 'energy']
  };
  /* 부옵션 ★5 한 번 최대치 */
  var SUB_ROLL = { hp: 30, atk: 8, def: 5, hp_pct: 0.05, atk_pct: 0.05, def_pct: 0.065, energy: 0.055, crit_rate: 0.033, crit_dmg: 0.066 };
  var SUB_KEYS = ['hp', 'atk', 'def', 'hp_pct', 'atk_pct', 'def_pct', 'energy', 'crit_rate', 'crit_dmg'];
  var ROLL_TIERS = [0.75, 0.85, 1.0];
  var RARITY_MUL = { 4: 0.8, 5: 1.0 };
  var MAX_LV = { 4: 12, 5: 15 };
  var STEP = 3;                                          // 이 단마다 부옵션 하나
  var SALVAGE = { 4: 1, 5: 2 };
  var CAP = 200;

  var SETS = {
    gladiator:   { name: '떠돌이 무사', two: { atk_pct: 0.15 },   four: { normal_melee: 0.3 },  text2: '공격력 +15%', text4: '칼·대도·창 기본 공격 피해 +30%' },
    crimson:     { name: '대장간 불씨', two: { elem_fire: 0.12 }, four: { react_fire: 0.35 },   text2: '화 피해 +12%', text4: '물안개·녹임·터짐·들불 피해 +35%' },
    viridescent: { name: '솔바람 피리', two: { elem_wind: 0.12 }, four: { react_swirl: 0.5 },   text2: '풍 피해 +12%', text4: '회오리 피해 +50%' },
    emblem:      { name: '봉화 깃발',   two: { energy: 0.18 },    four: { burst_dmg: 0.2 },     text2: '기력 획득 +18%', text4: '원소 해방 피해 +20%' },
    depth:       { name: '나루 안개',   two: { elem_water: 0.12 }, four: { skill_dmg: 0.25 },   text2: '수 피해 +12%', text4: '원소 스킬 피해 +25%' }
  };
  var SET_IDS = ['gladiator', 'crimson', 'viridescent', 'emblem', 'depth'];
  var FIRE_REACTIONS = { vaporize: 1, melt: 1, overload: 1, burning: 1 };

  /* 얻는 곳 */
  var CHEST_ARTS = { exquisite: [4], precious: [5], luxurious: [5, 5] };

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) | 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  /* ── 생성(순수) ───────────────────────────────────────── */

  function roll(key, rarity, r) { return SUB_ROLL[key] * RARITY_MUL[rarity] * pick(r, ROLL_TIERS); }
  function addSub(art, r) {
    var pool = SUB_KEYS.filter(function (k) {
      if (k === art.main) { return false; }
      for (var i = 0; i < art.subs.length; i++) { if (art.subs[i][0] === k) { return false; } }
      return true;
    });
    var key = pick(r, pool);
    art.subs.push([key, roll(key, art.rarity, r)]);
  }
  /** 새 보패 하나 — set·slot 이 비면 씨앗으로 고른다 */
  function generate(seed, rarity, setId, slot) {
    var r = mulberry32(seed);
    rarity = rarity >= 5 ? 5 : 4;
    if (!setId) { setId = pick(r, SET_IDS); }
    if (!slot) { slot = pick(r, SLOTS); }
    var art = { set: setId, slot: slot, rarity: rarity, lv: 0, spent: 0, main: pick(r, SLOT_MAINS[slot]), subs: [], seed: seed >>> 0, owner: '' };
    var n = (rarity >= 5 ? 3 : 2) + (r() < 0.25 ? 1 : 0);
    for (var i = 0; i < n; i++) { addSub(art, r); }
    var uq = global.DG.artifactUnique ? global.DG.artifactUnique.roll(seed, rarity) : null; if (uq) { art.uq = uq; }   // W-0438 ② 고유(★5 · 씨앗 따로)
    return art;
  }
  /** +3 에 닿을 때 — 넷 미만이면 새로, 넷이면 하나 올린다(씨앗 = 보패 씨앗 × 31 + Lv) */
  function onStep(art) {
    var r = mulberry32(art.seed * 31 + art.lv);
    if (art.subs.length < 4) { addSub(art, r); }
    else { var s = pick(r, art.subs); s[1] += roll(s[0], art.rarity, r); }
  }
  function mainValue(art) {
    var t = MAIN[art.main];
    return (t[0] + (t[1] - t[0]) * art.lv / MAX_LV[5]) * RARITY_MUL[art.rarity];
  }
  function statText(key, v) {
    return FLAT[key] ? STAT_NAMES[key] + ' +' + Math.round(v) : STAT_NAMES[key] + ' +' + (v * 100).toFixed(1) + '%';
  }
  /** 강화 +n → +n+1 */
  function upCost(lv) { var p = Math.ceil(0.6 * (lv + 1)); return { polish: p, gold: 12 * p }; }
  function salvageValue(art) { return SALVAGE[art.rarity] + Math.floor((art.spent || 0) * 0.8); }

  /* ── 세이브 칸 ────────────────────────────────────────── */

  function sv() {
    var s = core.save;
    if (!s.artifacts || typeof s.artifacts !== 'object') { s.artifacts = {}; }
    if (typeof s.artifacts.seq !== 'number') { s.artifacts.seq = 0; }
    if (!s.artifacts.list) { s.artifacts.list = {}; }
    return s.artifacts;
  }
  function list() { return (core.save.artifacts && core.save.artifacts.list) || {}; }
  function get(uid) { return list()[uid] || null; }
  function count() { return Object.keys(list()).length; }
  function mat() { return global.DG.weapon ? global.DG.weapon.mat() : (core.save.gearMat = core.save.gearMat || { ore: 0, polish: 0 }); }
  function polish() { var m = core.save.gearMat; return (m && m.polish) || 0; }

  /** 하나 얻는다 — 번호 씨앗으로 만들고, 상한을 넘으면 안 낀 ★4 부터 분해 */
  function add(rarity, setId, slot) {
    var a = sv();
    a.seq += 1;
    var uid = 'a' + a.seq;
    a.list[uid] = generate((20260824 + a.seq * 7919) >>> 0, rarity, setId, slot);
    trim(uid);
    return uid;
  }
  function trim(keep) {
    var L = list(), over = count() - CAP, k;
    while (over > 0) {
      var worst = null;
      for (k in L) {
        if (!Object.prototype.hasOwnProperty.call(L, k) || k === keep || L[k].owner) { continue; }
        var w = L[k];
        if (!worst || w.rarity < L[worst].rarity || (w.rarity === L[worst].rarity && w.lv < L[worst].lv)) { worst = k; }
      }
      if (!worst) { break; }
      salvage(worst, true);
      over--;
    }
  }
  function salvage(uid, quiet) {
    var art = get(uid);
    if (!art || art.owner) { return 0; }
    var v = salvageValue(art);
    mat().polish += v;
    delete sv().list[uid];
    if (!quiet) { core.emit('changed'); core.persist(); }
    return v;
  }
  /** 안 낀 ★4 를 모두 분해 — 돌아온 연마석 수 */
  function salvageLoose4() {
    var L = list(), got = 0, n = 0, k;
    for (k in L) {
      if (Object.prototype.hasOwnProperty.call(L, k) && L[k].rarity === 4 && !L[k].owner) { got += salvage(k, true); n++; }
    }
    if (n) { core.emit('toast', '🏺 ★4 ' + n + '개 분해 — 연마석 +' + got); core.emit('changed'); core.persist(); }
    return got;
  }

  /* ── 끼기·강화 ────────────────────────────────────────── */

  function equippedOf(id) {
    var L = list(), out = {}, k;
    for (k in L) { if (Object.prototype.hasOwnProperty.call(L, k) && L[k].owner === id) { out[L[k].slot] = k; } }
    return out;
  }
  function equip(id, uid) {
    var art = get(uid);
    if (!art || !core.save.dex.heroes[id]) { return false; }
    var cur = equippedOf(id)[art.slot];
    if (cur && cur !== uid) { list()[cur].owner = ''; }
    art.owner = id;                                        // 다른 인물이 끼고 있었으면 그쪽에서 빠진다
    core.emit('changed');
    core.persist();
    return true;
  }
  function unequip(uid) {
    var art = get(uid);
    if (!art) { return false; }
    art.owner = '';
    core.emit('changed');
    core.persist();
    return true;
  }
  function upCheck(uid) {
    var art = get(uid);
    if (!art) { return { ok: false, why: '없음' }; }
    if (art.lv >= MAX_LV[art.rarity]) { return { ok: false, why: '최대 강화' }; }
    var c = upCost(art.lv);
    if (polish() < c.polish) { return { ok: false, why: '연마석 부족', cost: c }; }
    if ((core.save.player.gold || 0) < c.gold) { return { ok: false, why: '금 부족', cost: c }; }
    return { ok: true, cost: c };
  }
  function up(uid) {
    var chk = upCheck(uid);
    if (!chk.ok) { return false; }
    var art = get(uid);
    mat().polish -= chk.cost.polish;
    core.save.player.gold -= chk.cost.gold;
    art.spent = (art.spent || 0) + chk.cost.polish;
    art.lv += 1;
    if (art.lv % STEP === 0) { onStep(art); }
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 끼고 있는 것의 합 + 켜진 세트 — { stats: {키: 값}, four: {키: 값}, sets: [{id, n}] } */
  function statsOf(id) {
    var eq = equippedOf(id), stats = {}, four = {}, cnt = {}, slot, k, i;
    function addStat(key, v) { stats[key] = (stats[key] || 0) + v; }
    for (slot in eq) {
      if (!Object.prototype.hasOwnProperty.call(eq, slot)) { continue; }
      var art = get(eq[slot]);
      addStat(art.main, mainValue(art));
      for (i = 0; i < art.subs.length; i++) { addStat(art.subs[i][0], art.subs[i][1]); } if (global.DG.artifactUnique) { global.DG.artifactUnique.apply(art, addStat, four); }   // W-0438 ② 고유 줄
      cnt[art.set] = (cnt[art.set] || 0) + 1;
    }
    var sets = [];
    for (k in cnt) {
      if (!Object.prototype.hasOwnProperty.call(cnt, k)) { continue; }
      if (cnt[k] >= 2) {
        var S2 = SETS[k].two, key;
        for (key in S2) { if (Object.prototype.hasOwnProperty.call(S2, key)) { addStat(key, S2[key]); } }
        sets.push({ id: k, n: cnt[k] });
      }
      if (cnt[k] >= 4) {
        var S4 = SETS[k].four;
        for (key in S4) { if (Object.prototype.hasOwnProperty.call(S4, key)) { four[key] = (four[key] || 0) + S4[key]; } }
      }
    }
    return { stats: stats, four: four, sets: sets };
  }

  /* ── 얻는 곳 ──────────────────────────────────────────── */

  function label(uid) {
    var a = get(uid);
    return a ? SLOT_ICON[a.slot] + ' ★' + a.rarity + ' ' + (global.DG.artifactUnique ? global.DG.artifactUnique.nameOf(a) : '') + SETS[a.set].name + ' ' + SLOT_NAMES[a.slot] : '';
  }
  function onChest(grade) {
    var rs = CHEST_ARTS[grade] || [], out = [];
    for (var i = 0; i < rs.length; i++) { out.push(label(add(rs[i]))); }
    return out.join(' · ');
  }
  function onElite() { return label(add(4)); }

  global.DG = global.DG || {};
  global.DG.artifact = {
    SLOTS: SLOTS, SLOT_NAMES: SLOT_NAMES, SLOT_ICON: SLOT_ICON, STAT_NAMES: STAT_NAMES, MAIN: MAIN, SLOT_MAINS: SLOT_MAINS,
    SUB_ROLL: SUB_ROLL, ROLL_TIERS: ROLL_TIERS, RARITY_MUL: RARITY_MUL, MAX_LV: MAX_LV, STEP: STEP, SALVAGE: SALVAGE, CAP: CAP,
    SETS: SETS, SET_IDS: SET_IDS, FIRE_REACTIONS: FIRE_REACTIONS, CHEST_ARTS: CHEST_ARTS,
    mulberry32: mulberry32, generate: generate, onStep: onStep, mainValue: mainValue, statText: statText,
    upCost: upCost, salvageValue: salvageValue,
    list: list, get: get, count: count, polish: polish, add: add, salvage: salvage, salvageLoose4: salvageLoose4,
    equippedOf: equippedOf, equip: equip, unequip: unequip, upCheck: upCheck, up: up, statsOf: statsOf,
    label: label, onChest: onChest, onElite: onElite
  };
})(window);
