/**
 * 무기 · 치명타 — 오픈월드 RPG의 무기 종류·강화·벼림·울림 (PLAN §5 ⑲-5, 이름·수치는 §5 ⑳)
 * ---------------------------------------------------------------
 * 들판 전투(⑨)에서 인물마다 기본 공격이 같았고, 상자·무리에서 "쓸 것" 이 나오지 않았다.
 *
 *   종류 다섯   인물 id 해시로 정해진다(saga-godot `weapons.gd` type_of 와 같은 식) — 제 종류만 든다
 *   기본 공격   종류마다 배율·빠르기·사거리가 다르다(KIT) — 서책은 인물 원소, 활은 멀리 하나
 *   무기 열다섯 수련용 ★1 다섯(누구나 기본으로 든다·강화 안 함) · ★3 다섯 · ★4 다섯(부옵션 + 효과)
 *   강화·벼림   Lv 1~30, 상한은 무기 벼림 0~5 가 연다 · 같은 무기를 또 얻으면 울림(효과가 오른다)
 *   치명타      인물 기본 5%·50% + 무기 부옵션 + 보패(artifact.js) — 굴림은 field-combat.js
 *
 * 기본 공격 모양 비율은 saga-godot `field_combat.WEAPON_KIT` 을 이 판 칼에 맞춘 것, 무기 표 수치는 §5 ⑳ 의 이 판 것.
 * **들판 전투에만 탄다** — `hero.stats`·부대 전투력·사건 결투는 안 건드린다.
 * 세이브 `save.weapons = { inv: { 무기id: {lv, asc, ref} }, equip: { 인물id: 무기id } }` ·
 * 재료 `save.gearMat.ore`(강화석). 모두 읽는 쪽 기본값 — SAVE_VERSION 은 그대로.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var TYPES = ['sword', 'claymore', 'polearm', 'catalyst', 'bow'];
  var TYPE_NAMES = { sword: '칼', claymore: '대도', polearm: '창', catalyst: '서책', bow: '활' };
  var TYPE_ICON = { sword: '🗡️', claymore: '⚔️', polearm: '🔱', catalyst: '📖', bow: '🏹' };

  /*
   * 기본 공격 모양 — Godot 비율(0.35·0.4·0.6)을 이 판 칼(0.9·1.0·1.5)에 맞춰 ×2.5.
   * reach: 붙어 치는 사거리(m) · range: 멀리 하나를 치는 사거리 · heavy: 무거운 타격(깨뜨림) · el: 인물 원소로 친다
   */
  var KIT = {
    sword:    { mul: [0.9, 1.0, 1.5],     sec: [0.34, 0.34, 0.55], reach: 3.2 },
    claymore: { mul: [1.5, 1.75, 2.5],    sec: [0.58, 0.58, 0.92], reach: 3.7, heavy: true },
    polearm:  { mul: [0.75, 0.875, 1.25], sec: [0.28, 0.28, 0.46], reach: 4.2 },
    catalyst: { mul: [0.75, 0.875, 1.25], sec: [0.36, 0.36, 0.55], range: 7, el: true },
    bow:      { mul: [0.75, 0.75, 1.125], sec: [0.32, 0.32, 0.49], range: 14 }
  };

  var STAT_NAMES = { atk_pct: '공격력', crit_rate: '치명타 확률', crit_dmg: '치명타 피해', energy: '기력 획득', hp_pct: '체력' };
  var PASSIVE_NAMES = { n: '기본 공격 피해', s: '원소 스킬 피해', b: '원소 해방 피해', react: '원소 반응 피해' };

  /* §5 ⑳ 이 판 표. 갯바람 작살은 낚시 조합(fishing.js, ⑲-24)에서만 — 드롭은 'w_'+종류+'_'+등급 이라 안 섞인다 */
  var WEAPONS = {
    w_sword_0:    { name: '수련용 목검', type: 'sword',    rarity: 1, atk: 20 },
    w_claymore_0: { name: '수련용 목도', type: 'claymore', rarity: 1, atk: 20 },
    w_polearm_0:  { name: '수련용 장대', type: 'polearm',  rarity: 1, atk: 20 },
    w_catalyst_0: { name: '수련용 서첩', type: 'catalyst', rarity: 1, atk: 20 },
    w_bow_0:      { name: '수련용 단궁', type: 'bow',      rarity: 1, atk: 20 },
    w_sword_3:    { name: '청동 환도',     type: 'sword',    rarity: 3, atk: 34, sub: 'atk_pct',   subV: 0.07,  pas: 'n',     pasV: 0.12 },
    w_claymore_3: { name: '나무꾼 큰도끼', type: 'claymore', rarity: 3, atk: 34, sub: 'hp_pct',    subV: 0.07,  pas: 'b',     pasV: 0.12 },
    w_polearm_3:  { name: '대나무 창',     type: 'polearm',  rarity: 3, atk: 35, sub: 'crit_dmg',  subV: 0.09,  pas: 'n',     pasV: 0.12 },
    w_catalyst_3: { name: '해진 서책',     type: 'catalyst', rarity: 3, atk: 34, sub: 'energy',    subV: 0.08,  pas: 'react', pasV: 0.12 },
    w_bow_3:      { name: '사냥꾼 활',     type: 'bow',      rarity: 3, atk: 35, sub: 'crit_dmg',  subV: 0.09,  pas: 'n',     pasV: 0.12 },
    w_sword_4:    { name: '청하 보검',     type: 'sword',    rarity: 4, atk: 40, sub: 'crit_rate', subV: 0.035, pas: 's',     pasV: 0.16 },
    w_claymore_4: { name: '파도 참마도',   type: 'claymore', rarity: 4, atk: 38, sub: 'atk_pct',   subV: 0.08,  pas: 'react', pasV: 0.2 },
    w_polearm_4:  { name: '봉수 월도',     type: 'polearm',  rarity: 4, atk: 40, sub: 'energy',    subV: 0.06,  pas: 'b',     pasV: 0.16 },
    w_catalyst_4: { name: '별자리 두루마리', type: 'catalyst', rarity: 4, atk: 38, sub: 'atk_pct', subV: 0.08,  pas: 's',     pasV: 0.16 },
    w_bow_4:      { name: '갯바람 각궁',   type: 'bow',      rarity: 4, atk: 40, sub: 'crit_rate', subV: 0.035, pas: 'b',     pasV: 0.16 },
    w_polearm_catch: { name: '갯바람 작살', type: 'polearm', rarity: 4, atk: 41, sub: 'energy',    subV: 0.09,  pas: 'b',     pasV: 0.18 }
  };

  var MAX_LV = 30, MAX_ASC = 5, REFINE_MAX = 5, REFINE_OVER_ORE = 10;
  var ATK_PER_LV = 0.06, ATK_PER_ASC = 0.1, SUB_PER_LV = 0.12;
  var ASC_COST = [
    { gold: 250,  dust: 20 },
    { gold: 500,  dust: 40 },
    { gold: 750,  dust: 60 },
    { gold: 1000, dust: 80 },
    { gold: 1250, dust: 100 }
  ];
  var BASE_CRIT_RATE = 0.05, BASE_CRIT_DMG = 0.5;
  /* 강화석 — Godot 조각 1 · 강화석 5 · 정련 25 로 환산 */
  var CHEST_ORE = { common: 2, exquisite: 5, precious: 15, luxurious: 40 };
  var ELITE_ORE = 1;

  /* ── 표 ───────────────────────────────────────────────── */

  function info(wid) { return WEAPONS[wid] || WEAPONS.w_sword_0; }
  function defaultOf(type) { return 'w_' + type + '_0'; }
  function isShared(wid) { return info(wid).rarity <= 1; }

  /** 인물 → 종류. 주인공('_me')은 칼. 식은 Godot `type_of` 와 같다 */
  function typeOf(id) {
    if (!id || id === '_me') { return 'sword'; }
    var SM = global.DG.story && global.DG.story.MEMBERS;                 // ⑲-15 이야기 동료는 표
    if (SM && SM[id]) { return SM[id].weapon; }
    var h = 7;
    for (var i = 0; i < id.length; i++) { h = (h * 37 + id.charCodeAt(i)) & 0x7fffffff; }
    return TYPES[h % TYPES.length];
  }
  function cap(asc) { return Math.min(MAX_LV, 10 + 4 * Math.max(0, Math.min(MAX_ASC, asc || 0))); }
  function atkAt(wid, lv, asc) { return info(wid).atk * (1 + ATK_PER_LV * ((lv || 1) - 1) + ATK_PER_ASC * (asc || 0)); }
  function subAt(wid, lv) { var w = info(wid); return (w.subV || 0) * (1 + SUB_PER_LV * ((lv || 1) - 1)); }
  function passiveAt(wid, ref) { var w = info(wid); return (w.pasV || 0) * (1 + 0.25 * (Math.max(1, Math.min(REFINE_MAX, ref || 1)) - 1)); }
  /** 강화 n → n+1 */
  function upCost(lv) { return lv >= 1 && lv < MAX_LV ? { ore: 1 + Math.floor((lv - 1) / 5), gold: 15 * lv } : null; }
  function ascCost(asc) { return asc >= 0 && asc < MAX_ASC ? ASC_COST[asc] : null; }

  /** 상자 → 무기(옻칠 ★3 · 금박 ★4, 상자 id 해시로 종류 — Godot `chest_weapon` 식) */
  function chestWeapon(chestId, grade) {
    var r = grade === 'precious' ? 3 : (grade === 'luxurious' ? 4 : 0);
    if (!r) { return ''; }
    var h = 0;
    for (var i = 0; i < chestId.length; i++) { h = (h * 31 + chestId.charCodeAt(i)) & 0x7fffffff; }
    return 'w_' + TYPES[h % TYPES.length] + '_' + r;
  }

  /* ── 세이브 칸 ────────────────────────────────────────── */

  function sv() {
    var s = core.save;
    if (!s.weapons || typeof s.weapons !== 'object') { s.weapons = {}; }
    if (!s.weapons.inv) { s.weapons.inv = {}; }
    if (!s.weapons.equip) { s.weapons.equip = {}; }
    return s.weapons;
  }
  function mat() {
    var s = core.save;
    if (!s.gearMat || typeof s.gearMat !== 'object') { s.gearMat = {}; }
    if (typeof s.gearMat.ore !== 'number') { s.gearMat.ore = 0; }
    if (typeof s.gearMat.polish !== 'number') { s.gearMat.polish = 0; }
    return s.gearMat;
  }
  function ore() { var m = core.save.gearMat; return (m && m.ore) || 0; }
  function addOre(n) { if (n > 0) { mat().ore += n; } return n > 0 ? n : 0; }

  /** 가진 무기 기록(수련용은 늘 Lv1 — 세이브 없이) */
  function rec(wid) {
    if (!WEAPONS[wid]) { return null; }
    if (isShared(wid)) { return { lv: 1, asc: 0, ref: 1 }; }
    var r = core.save.weapons && core.save.weapons.inv && core.save.weapons.inv[wid];
    return r ? { lv: r.lv || 1, asc: r.asc || 0, ref: r.ref || 1 } : null;
  }
  function owned(wid) { return !!rec(wid); }

  /** 인물이 든 무기 — 없거나 종류가 안 맞으면 제 종류 수련용 */
  function equipped(id) {
    var t = typeOf(id), e = core.save.weapons && core.save.weapons.equip && core.save.weapons.equip[id];
    return e && WEAPONS[e] && WEAPONS[e].type === t && owned(e) ? e : defaultOf(t);
  }
  /** 그 무기를 든 인물(수련용은 여럿이 같이 들어 '') */
  function holderOf(wid) {
    if (isShared(wid)) { return ''; }
    var eq = (core.save.weapons && core.save.weapons.equip) || {}, k;
    for (k in eq) { if (Object.prototype.hasOwnProperty.call(eq, k) && eq[k] === wid) { return k; } }
    return '';
  }
  /** 인물이 들 수 있는 것 — 제 종류 수련용 + 가진 제 종류 */
  function choicesFor(id) {
    var t = typeOf(id), out = [defaultOf(t)], k;
    for (k in WEAPONS) {
      if (Object.prototype.hasOwnProperty.call(WEAPONS, k) && WEAPONS[k].type === t && !isShared(k) && owned(k)) { out.push(k); }
    }
    return out;
  }

  /* ── 얻기·들기 ────────────────────────────────────────── */

  /** 무기를 얻는다 — 처음이면 Lv1, 또 얻으면 울림 +1(5 가 넘치면 강화석 10). 글을 돌려준다 */
  function give(wid) {
    var w = WEAPONS[wid];
    if (!w || isShared(wid)) { return ''; }
    var inv = sv().inv, r = inv[wid];
    if (!r) {
      inv[wid] = { lv: 1, asc: 0, ref: 1 };
      core.emit('weapon:new', { id: wid });
      return TYPE_ICON[w.type] + ' ★' + w.rarity + ' ' + w.name;
    }
    if ((r.ref || 1) < REFINE_MAX) {
      r.ref = (r.ref || 1) + 1;
      return TYPE_ICON[w.type] + ' ' + w.name + ' 울림 ' + r.ref;
    }
    addOre(REFINE_OVER_ORE);
    return '🪨 강화석 +' + REFINE_OVER_ORE + '(' + w.name + ' 울림 끝)';
  }

  function equip(id, wid) {
    if (!core.save.dex.heroes[id] || !WEAPONS[wid] || WEAPONS[wid].type !== typeOf(id) || !owned(wid)) { return false; }
    var eq = sv().equip;
    if (isShared(wid)) { delete eq[id]; }
    else {
      var prev = holderOf(wid);
      if (prev && prev !== id) { delete eq[prev]; }        // 먼저 든 인물은 수련용으로
      eq[id] = wid;
    }
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 강화·벼림 ────────────────────────────────────────── */

  function upCheck(wid) {
    var r = rec(wid);
    if (!r) { return { ok: false, why: '없는 무기' }; }
    if (isShared(wid)) { return { ok: false, why: '수련용은 강화 안 함' }; }
    if (r.lv >= MAX_LV) { return { ok: false, why: '최대 레벨' }; }
    if (r.lv >= cap(r.asc)) { return { ok: false, why: '무기 벼림 필요', cap: true }; }
    var c = upCost(r.lv);
    if (ore() < c.ore) { return { ok: false, why: '강화석 부족', cost: c }; }
    if ((core.save.player.gold || 0) < c.gold) { return { ok: false, why: '금 부족', cost: c }; }
    return { ok: true, cost: c };
  }
  function up(wid) {
    var chk = upCheck(wid);
    if (!chk.ok) { return false; }
    var r = sv().inv[wid];
    mat().ore -= chk.cost.ore;
    core.save.player.gold -= chk.cost.gold;
    r.lv = (r.lv || 1) + 1;
    core.emit('toast', TYPE_ICON[info(wid).type] + ' ' + info(wid).name + ' Lv.' + r.lv + ' — 공격 ' + Math.round(atkAt(wid, r.lv, r.asc || 0)));
    core.emit('changed');
    core.persist();
    return true;
  }
  function ascCheck(wid) {
    var r = rec(wid);
    if (!r || isShared(wid)) { return { ok: false, why: '벼림 안 함' }; }
    if (r.asc >= MAX_ASC) { return { ok: false, why: '최대 벼림' }; }
    if (r.lv < cap(r.asc)) { return { ok: false, why: 'Lv.' + cap(r.asc) + ' 에서 벼림' }; }
    var c = ascCost(r.asc);
    if ((core.save.player.gold || 0) < c.gold) { return { ok: false, why: '금 부족', cost: c }; }
    if ((core.save.dust || 0) < c.dust) { return { ok: false, why: '단사 부족', cost: c }; }
    return { ok: true, cost: c };
  }
  function ascend(wid) {
    var chk = ascCheck(wid);
    if (!chk.ok) { return false; }
    var r = sv().inv[wid];
    core.save.player.gold -= chk.cost.gold;
    core.save.dust -= chk.cost.dust;
    r.asc = (r.asc || 0) + 1;
    core.emit('toast', '✨ ' + info(wid).name + ' 무기 벼림 ' + r.asc + ' — 상한 Lv.' + cap(r.asc));
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 들판 전투가 읽는 한 사람 몫 — 종류·모양·무기 공격·부옵션·효과 */
  function mods(id) {
    var wid = equipped(id), r = rec(wid) || { lv: 1, asc: 0, ref: 1 }, w = info(wid);
    var sub = {};
    if (w.sub) { sub[w.sub] = subAt(wid, r.lv); }
    return {
      wid: wid, type: w.type, kit: KIT[w.type], atk: atkAt(wid, r.lv, r.asc), sub: sub,
      pas: w.pas || null, pasV: w.pas ? passiveAt(wid, r.ref) : 0
    };
  }

  /* ── 얻는 곳 ──────────────────────────────────────────── */

  function onChest(ch) {
    var out = [], g = ch && ch.grade, o = CHEST_ORE[g] || 0;
    if (o) { addOre(o); out.push('🪨 강화석 +' + o); }
    var wid = ch && ch.id ? chestWeapon(ch.id, g) : '';
    if (wid) { out.push(give(wid)); }
    return out.join(' · ');
  }
  function onElite() { addOre(ELITE_ORE); return '🪨 +' + ELITE_ORE; }

  global.DG = global.DG || {};
  global.DG.weapon = {
    TYPES: TYPES, TYPE_NAMES: TYPE_NAMES, TYPE_ICON: TYPE_ICON, KIT: KIT, WEAPONS: WEAPONS,
    STAT_NAMES: STAT_NAMES, PASSIVE_NAMES: PASSIVE_NAMES,
    MAX_LV: MAX_LV, MAX_ASC: MAX_ASC, REFINE_MAX: REFINE_MAX, REFINE_OVER_ORE: REFINE_OVER_ORE,
    BASE_CRIT_RATE: BASE_CRIT_RATE, BASE_CRIT_DMG: BASE_CRIT_DMG, CHEST_ORE: CHEST_ORE,
    info: info, defaultOf: defaultOf, isShared: isShared, typeOf: typeOf, cap: cap,
    atkAt: atkAt, subAt: subAt, passiveAt: passiveAt, upCost: upCost, ascCost: ascCost, chestWeapon: chestWeapon,
    mat: mat, ore: ore, addOre: addOre, rec: rec, owned: owned, equipped: equipped, holderOf: holderOf, choicesFor: choicesFor,
    give: give, equip: equip, upCheck: upCheck, up: up, ascCheck: ascCheck, ascend: ascend,
    mods: mods, onChest: onChest, onElite: onElite
  };
})(window);
