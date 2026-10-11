/**
 * 연성(鍊成) · 승화(昇華) — 원작의 사탕과 진화
 * ---------------------------------------------------------------
 * 짐승을 잡아도 도감에 줄이 하나 늘 뿐이었다. 원작에서 잡는 이유의 절반은
 * **사탕**이다 — 같은 것을 여러 마리 잡아 그 자원으로 강화하고 진화시킨다.
 * 그 축이 이 판에는 통째로 없었다.
 *
 *   사탕(종별)     → 영초(靈草) 🌿   잡을 때마다 그 종의 것이 셋 들어온다
 *   별사탕(공통)   → 단사(丹砂) ✨   잡을 때마다 등급만큼 들어온다
 *   강화(파워업)   → 연성(鍊成)      영초 + 단사를 써서 보정을 올린다
 *   진화           → 승화(昇華)      영초를 많이 써서 상위 종이 된다
 *
 * **인물의 승급과는 다른 축이다.** 인물은 중복분(도감의 count)을 직접 태우고
 * (`hero.js` 의 `rankUp`), 펫은 자원을 모아 쓴다. 원작에서도 트레이너 레벨과
 * 몬스터 강화가 다른 축인 것과 같다 — 도감의 마리수는 기록이니 줄지 않는다.
 *
 * 옛 세이브도 인정한다. 부트에서 `migrate()` 가 한 번 돌아 **이미 잡아 둔 마리수를
 * 영초로 환산한다** — 그동안 잡은 것이 없던 일이 되면 안 된다.
 *
 * 승화 사슬(`CHAIN`)은 이 파일에만 있다. `data.js` 에 `evolve` 같은 칸을 만들지
 * 않았다 — 도감은 다섯 판이 **같은 내용**을 다섯 벌 들고 있고, 승화는 원작이
 * 원작인 이 판만의 축이다. 데이터를 건드리면 그 동일성이 깨진다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;

  /* 넷 다 어드민이 잡을 수 있는 손잡이다(`core.tuned`) — 켤 때 한 번 읽는다 */
  var MAX_LV = core.tuned('growth.maxLv', 20);
  var HERB_PER_CATCH = core.tuned('growth.herbPerCatch', 3);   // 원작의 사탕 3개
  var DUST_PER_RARITY = core.tuned('growth.dustPerRarity', 40); // 등급 × 이 값 = 단사
  var LV_STEP = core.tuned('growth.lvStep', 0.06);             // 한 단마다 보정 +6%

  /**
   * 승화 사슬 — **근거가 뚜렷한 것만 잇는다.** 원작에서도 모든 종이 진화하지 않는다.
   * 잉어는 데이터의 설명이 이미 말하고 있었다("용문을 오르면 용이 된다던가").
   */
  var CHAIN = {
    pt_carp:       { to: 'pt_cheongryong', herb: 100, why: '용문(龍門)을 오른다' },
    pt_tiger:      { to: 'pt_baekho',      herb: 50,  why: '산군(山君)이 사신(四神)의 자리에 오른다' },
    pt_crane:      { to: 'pt_jujak',       herb: 50,  why: '선비의 벗이 남방의 붉은 새가 된다' },
    pt_bear:       { to: 'pt_bulgasari',   herb: 25,  why: '쇠를 먹고 자란다' },
    pk_charmander: { to: 'pk_charizard',   herb: 100, why: '뿔도롱이 노을을 삼켜 날개를 얻는다' },
    pk_magikarp:   { to: 'pk_lapras',      herb: 100, why: '날주머니 둘이 한 몸이 된다' }
  };

  /* ── 세이브 칸 ────────────────────────────────────────── */

  /** 그 종의 성장 기록을 꺼낸다 (없으면 빈 것을 만든다) */
  function st(id) {
    if (!core.save.petGrow) { core.save.petGrow = {}; }
    var g = core.save.petGrow[id];
    if (!g) { g = core.save.petGrow[id] = { lv: 0, herb: 0 }; }
    if (typeof g.lv !== 'number') { g.lv = 0; }
    if (typeof g.herb !== 'number') { g.herb = 0; }
    return g;
  }

  /**
   * 옛 세이브 인정 — 이 축이 없던 때 잡아 둔 마리수를 영초로 환산한다.
   *
   * **st() 안에서 하지 않는다.** 그러면 두 가지가 어긋난다.
   *   - 읽기 경로(`info`·`herbOf`)는 칸을 만들지 않으니 환산이 영원히 안 일어난다
   *   - 반대로 첫 포획에서는 `registerDex` 가 이미 올린 마리수와 겹쳐
   *     영초가 셋이 아니라 여섯이 된다
   * 그래서 **부트에서 딱 한 번**(`game.js`) 부르고, 플래그로 다시 하지 않는다.
   *
   * @returns {number} 환산한 종의 수 (두 번째부터는 0)
   */
  function migrate() {
    if (!core.save.petGrow) { core.save.petGrow = {}; }
    if (core.save.petGrowV) { return 0; }
    var dx = core.save.dex.pets, n = 0, k;
    for (k in dx) {
      if (!Object.prototype.hasOwnProperty.call(dx, k)) { continue; }
      if (!core.save.petGrow[k]) {
        core.save.petGrow[k] = { lv: 0, herb: (dx[k].count || 0) * HERB_PER_CATCH };
        n++;
      }
    }
    core.save.petGrowV = 1;
    return n;
  }

  /** 저장된 기록 (세이브를 만들지 않는 읽기 전용) */
  function info(id) {
    var g = core.save.petGrow && core.save.petGrow[id];
    return { lv: (g && g.lv) || 0, herb: (g && g.herb) || 0 };
  }

  function dust() {
    if (typeof core.save.dust !== 'number') { core.save.dust = 0; }
    return core.save.dust;
  }

  function herbOf(id) { return info(id).herb; }
  function lvOf(id) { return info(id).lv; }

  /* ── 수급 ─────────────────────────────────────────────── */

  /**
   * 잡았다 — 원작처럼 그 종의 영초 셋과 등급만큼의 단사가 들어온다.
   * 첫 마리든 중복이든 같다(원작도 그렇다).
   * @returns {{herb:number, dust:number}}
   */
  function onCatch(pet) {
    if (!pet) { return { herb: 0, dust: 0 }; }
    var g = st(pet.id);
    var d = (pet.rarity || 1) * DUST_PER_RARITY;
    g.herb += HERB_PER_CATCH;
    core.save.dust = dust() + d;
    return { herb: HERB_PER_CATCH, dust: d };
  }

  /**
   * 밖에서 영초·단사를 넣는 유일한 통로 — 반려(buddy.js)가 걸어서 얻어 온다.
   * 수급은 이 파일 한 곳으로만 들어오게 둔다(세이브 칸을 아는 자리를 늘리지 않는다).
   */
  function addHerb(id, n) {
    if (!id || !(n > 0)) { return 0; }
    n = Math.round(n * (global.DG.starchart ? global.DG.starchart.herb() : 1));   // 성도(W-0181) — 약초 눈·무욕
    if (!(n > 0)) { return 0; }
    st(id).herb += n;
    return n;
  }

  function addDust(n) {
    if (!(n > 0)) { return 0; }
    n = Math.round(n * (global.DG.starchart ? global.DG.starchart.herb() : 1));   // 성도(W-0181)
    if (!(n > 0)) { return 0; }
    core.save.dust = dust() + n;
    return n;
  }

  /* ── 연성(강화) ───────────────────────────────────────── */

  /** 다음 한 단에 드는 값 — 올라갈수록 오른다(원작과 같다) */
  function refineCost(lv) {
    return { herb: 2 + Math.floor(lv / 4), dust: 100 + lv * 40 };
  }

  function refineCheck(id) {
    if (!core.save.dex.pets[id]) { return { ok: false, why: '미포획' }; }
    var g = info(id);
    if (g.lv >= MAX_LV) { return { ok: false, why: '최대 연성' }; }
    var c = refineCost(g.lv);
    if (g.herb < c.herb) { return { ok: false, why: '영초 부족', cost: c }; }
    if (dust() < c.dust) { return { ok: false, why: '단사 부족', cost: c }; }
    return { ok: true, cost: c };
  }

  /** 한 단 올린다 */
  function refine(id) {
    var chk = refineCheck(id);
    if (!chk.ok) { return false; }
    var g = st(id);
    g.herb -= chk.cost.herb;
    core.save.dust = dust() - chk.cost.dust;
    g.lv += 1;
    var p = data.find(id);
    core.log('🌿 ' + (p ? p.name : id) + ' 연성 ' + g.lv + '단', 'good');
    core.emit('toast', '🌿 ' + (p ? p.name : id) + ' 연성 ' + g.lv + '단 · ' +
      statKor(p) + ' +' + bonusOf(p));
    core.emit('changed');
    core.emit('growth:refine', { id: id, lv: g.lv });  // 소리 낼 자리 — 판정에는 안 닿는다(audio.js 참고)
    core.persist();
    return true;
  }

  /* ── 승화(진화) ───────────────────────────────────────── */

  function chainOf(id) { return CHAIN[id] || null; }

  function ascendCheck(id) {
    var c = CHAIN[id];
    if (!c) { return { ok: false, why: '승화하지 않는 종' }; }
    if (!core.save.dex.pets[id]) { return { ok: false, why: '미포획' }; }
    var to = data.find(c.to);
    if (!to) { return { ok: false, why: '상위 종 없음' }; }
    if (info(id).herb < c.herb) { return { ok: false, why: '영초 부족', cost: c, to: to }; }
    return { ok: true, cost: c, to: to };
  }

  /**
   * 승화한다. 상위 종이 도감에 들고, **연성 단계를 이어받는다**
   * (원작에서도 진화하면 강화가 승계된다).
   *
   * 원래 종은 도감에서 지우지 않는다 — 도감은 "무엇을 만났는가" 의 기록이고,
   * 이 판에서 펫은 개체가 아니라 **종**이다. 원작처럼 개체 하나가 사라지는 대신
   * 영초를 태우는 것으로 값을 치른다.
   */
  function ascend(id) {
    var chk = ascendCheck(id);
    if (!chk.ok) { return false; }
    var g = st(id);
    var to = chk.to;
    g.herb -= chk.cost.herb;

    var dx = core.save.dex.pets;
    if (!dx[to.id]) {
      dx[to.id] = { count: 1, firstAt: Date.now() };
      core.emit('dex:new', { cat: 'pets', id: to.id });
    } else {
      dx[to.id].count += 1;
    }
    var tg = st(to.id);
    tg.lv = Math.max(tg.lv, g.lv);

    var from = data.find(id);
    core.gainFeat(to.rarity * 8, '승화');
    core.log('✨ ' + (from ? from.name : id) + ' → ' + to.name + ' 승화! (' + chk.cost.why + ')', 'good');
    core.emit('toast', '✨ ' + to.name + ' 으로 승화 — ' + chk.cost.why);
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 화면이 읽는 값 ───────────────────────────────────── */

  /**
   * 장착 보정 — **연성이 실제로 힘이 되는 유일한 통로**다.
   * `hero.js` 의 stats() 가 이 값을 더한다. 여기 없으면(다른 판) 원래 값이 쓰인다.
   */
  function bonusOf(pet) {
    if (!pet || !pet.bonus) { return 0; }
    var v = pet.bonus.value * (1 + lvOf(pet.id) * LV_STEP);
    /* 반려로 세워 둔 종이면 우애만큼 더 붙는다(buddy.js). 세우지 않았으면 배율이 1 이라
       이 줄이 없던 때와 값이 같다 — 그 모듈이 없는 다른 판도 마찬가지다. */
    if (global.DG.buddy) { v *= global.DG.buddy.bonusMul(pet.id); }
    return Math.round(v);
  }

  function statKor(pet) {
    var m = { might: '무력', wisdom: '지력', command: '통솔', virtue: '덕망' };
    return (pet && pet.bonus && m[pet.bonus.stat]) || '';
  }

  /** 승화 사슬을 화면에 보여줄 때 — 어느 종이 무엇이 되는지 */
  function chainList() {
    var out = [], k;
    for (k in CHAIN) {
      if (!Object.prototype.hasOwnProperty.call(CHAIN, k)) { continue; }
      var from = data.find(k), to = data.find(CHAIN[k].to);
      if (from && to) { out.push({ from: from, to: to, herb: CHAIN[k].herb, why: CHAIN[k].why }); }
    }
    return out;
  }

  global.DG = global.DG || {};
  global.DG.growth = {
    MAX_LV: MAX_LV, HERB_PER_CATCH: HERB_PER_CATCH,
    DUST_PER_RARITY: DUST_PER_RARITY, LV_STEP: LV_STEP,
    CHAIN: CHAIN, chainOf: chainOf, chainList: chainList,
    info: info, herbOf: herbOf, lvOf: lvOf, dust: dust,
    migrate: migrate, onCatch: onCatch, addHerb: addHerb, addDust: addDust,
    refineCost: refineCost, refineCheck: refineCheck, refine: refine,
    ascendCheck: ascendCheck, ascend: ascend,
    bonusOf: bonusOf, statKor: statKor
  };
})(window);
