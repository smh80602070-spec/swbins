/**
 * 장비 — 줍고, 끼고, 주문서로 올리고, 상점에서 사고판다
 * ---------------------------------------------------------------
 * 이 파일은 **규칙만** 안다. 화면은 ui.js 가, 사냥터에서 떨구는 일은 side.js 가 한다.
 *
 * 세이브
 *   save.gear = {
 *     uid   : 다음에 줄 번호
 *     inv   : [ {uid, key, up, left, atk, def, hp} … ]   가방 (24칸)
 *     equip : { 부위: uid }                              낀 것
 *   }
 *   save.scrolls = { 주문서key: 개수 }
 *
 * 한 물건의 최종 값 = 데이터의 기본값 + 주문서로 붙은 값(atk/def/hp).
 * `up` 은 주문서를 **시도한** 횟수가 아니라 **붙은** 횟수다(원작 표기가 그렇다).
 * `left` 는 남은 업횟 — 실패해도 이것만 닳는다. 물건은 터지지 않는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var GD = global.DG.gearData;
  var UD = global.DG.uniqueData;   // 고유(固有) — data-unique.js. 없어도(옛 캐시 등) 그냥 안 나올 뿐 돈다

  /* 규칙 값은 균형 손잡이를 거친다 — 어드민이 잡고, 켜질 때 한 번 읽는다 */
  var BAG = core.tuned('gear.bag', 24);         // 가방 칸
  var DROP_MUL = core.tuned('drop.gearMul', 1); // 장비·주문서가 떨어질 확률 (배수)
  var SCROLL_MUL = core.tuned('scroll.rateMul', 1); // 주문서 성공률 (배수 — 1 을 넘으면 상한 1)
  var UNIQUE_CHANCE = core.tuned('drop.uniqueChance', 0.16); // 보스가 Lv.20 장비를 떨굴 때 고유로 바뀔 확률

  function st() {
    var s = core.save;
    if (!s.gear) { s.gear = { uid: 1, inv: [], equip: {} }; }
    if (!s.gear.inv) { s.gear.inv = []; }
    if (!s.gear.equip) { s.gear.equip = {}; }
    if (!s.gear.uid) { s.gear.uid = 1; }
    if (!s.scrolls) { s.scrolls = {}; }
    return s.gear;
  }

  /* ── 물건 ─────────────────────────────────────────────── */

  /** 물건 key 하나로 그 정의를 찾는다 — 고유(固有)가 먼저다(같은 key 를 밑감이 쓸 일은 없다) */
  function findDef(key) {
    var u = UD ? UD.find(key) : null;
    return u || GD.find(key);
  }

  /** 데이터 한 줄로 실물 하나를 찍어 낸다 */
  function make(key) {
    var def = findDef(key);
    if (!def) { return null; }
    var g = st();
    return { uid: g.uid++, key: key, up: 0, left: def.up, atk: 0, def: 0, hp: 0 };
  }

  function defOf(it) { return it ? findDef(it.key) : null; }

  /** 기본값 + 붙은 값 */
  function statsOf(it) {
    var d = defOf(it);
    if (!d) { return { atk: 0, def: 0, hp: 0 }; }
    return { atk: d.atk + (it.atk || 0), def: d.def + (it.def || 0), hp: d.hp + (it.hp || 0) };
  }

  function isUnique(it) { return !!(it && UD && UD.find(it.key)); }

  function nameOf(it) {
    var d = defOf(it);
    if (!d) { return '?'; }
    return (isUnique(it) ? '★ ' : '') + d.name + (it.up ? ' (+' + it.up + ')' : '');
  }

  function byUid(uid) {
    var g = st();
    for (var i = 0; i < g.inv.length; i++) { if (g.inv[i].uid === uid) { return g.inv[i]; } }
    return null;
  }

  function inv() { return st().inv.slice(); }

  function bagLeft() { return BAG - st().inv.length; }

  /** 가방에 넣는다 — 자리가 없으면 거절한다(원작의 그 답답함이 규칙이다) */
  function put(it) {
    if (!it) { return false; }
    var g = st();
    if (g.inv.length >= BAG) {
      core.emit('toast', '🎒 가방이 가득 찼습니다');
      return false;
    }
    g.inv.push(it);
    core.emit('changed');
    return true;
  }

  function drop(uid) {
    var g = st(), i;
    for (i = 0; i < g.inv.length; i++) {
      if (g.inv[i].uid === uid) { g.inv.splice(i, 1); core.emit('changed'); return true; }
    }
    return false;
  }

  /* ── 끼기 ─────────────────────────────────────────────── */

  function equipped() {
    var g = st(), out = {}, k;
    for (k in g.equip) {
      if (Object.prototype.hasOwnProperty.call(g.equip, k)) {
        var it = byUid(g.equip[k]);
        if (it) { out[k] = it; }
      }
    }
    return out;
  }

  function isEquipped(uid) {
    var g = st(), k;
    for (k in g.equip) {
      if (Object.prototype.hasOwnProperty.call(g.equip, k) && g.equip[k] === uid) { return true; }
    }
    return false;
  }

  /** 낀다 — 요구 수준을 못 채우면 거절한다 */
  function equip(uid) {
    var it = byUid(uid), d = defOf(it);
    if (!d) { return false; }
    if (core.save.player.level < d.need) {
      core.emit('toast', '⚠️ Lv.' + d.need + ' 부터 낄 수 있습니다');
      return false;
    }
    st().equip[d.slot] = uid;
    core.emit('changed');
    core.persist();
    return true;
  }

  function unequip(slotKey) {
    var g = st();
    if (!g.equip[slotKey]) { return false; }
    delete g.equip[slotKey];
    core.emit('changed');
    core.persist();
    return true;
  }

  /**
   * 낀 것의 합 — side.power() 가 이걸 얹는다.
   * 요구 수준을 못 채우게 된 물건(승급 전 세이브 등)은 세지 않는다.
   */
  function bonus() {
    var e = equipped(), sum = { atk: 0, def: 0, hp: 0 }, k;
    for (k in e) {
      if (!Object.prototype.hasOwnProperty.call(e, k)) { continue; }
      var d = defOf(e[k]);
      if (!d || core.save.player.level < d.need) { continue; }
      var s = statsOf(e[k]);
      sum.atk += s.atk; sum.def += s.def; sum.hp += s.hp;
    }
    if (global.DG.gearSet) { var sb = global.DG.gearSet.bonus(); sum.atk += sb.atk; sum.def += sb.def; sum.hp += sb.hp; }   // W-0437 세트 짝 효과
    return sum;
  }

  /**
   * 세트 등급(PLAN §6 성장 가시화 "장비 4단마다 외곽선 색", 2026-09-23) — 열 부위 중
   * **절반(SET_HALF 칸) 이상이 도달한 가장 높은 등급**. 빈 칸·요구 수준 미달(bonus() 가 안 세는 것)은
   * 0 으로 친다 → 무기 하나만 좋아서는 안 바뀌고, 한 단을 절반쯤 갈아입어야 넘어간다.
   * 등급 이름·색은 `gearData.grade`(RARITY)와 같다. 값·세이브에는 안 닿는다 — 보이는 테두리뿐이다
   */
  var SET_HALF = 5;
  function setGrade() {
    var e = equipped(), ranks = [], k;
    for (k in e) {
      if (!Object.prototype.hasOwnProperty.call(e, k)) { continue; }
      var d = defOf(e[k]);
      if (!d || core.save.player.level < d.need) { continue; }
      ranks.push(GD.grade(d).rank);
    }
    ranks.sort(function (a, b) { return b - a; });
    var r = ranks.length >= SET_HALF ? ranks[SET_HALF - 1] : 1;
    var g = GD.grade(null);                     // 기본(1) 이름·색
    if (r > 1) {
      var R = global.DG.data && global.DG.data.rarity && global.DG.data.rarity[r];
      g = { rank: r, name: R ? R.name : '', color: R ? R.color : g.color, label: R ? R.label : '' };
    }
    return g;
  }

  /**
   * 방어 → 덜 맞는 비율. 방어가 아무리 높아도 **6할까지만** 막는다
   * (넘게 두면 후반에 아무것도 안 아파진다).
   */
  function cut(def) {
    if (!def || def <= 0) { return 0; }
    return Math.min(0.6, def / (def + 40));
  }

  /* ── 주문서 ───────────────────────────────────────────── */

  function scrollCount(key) { st(); return core.save.scrolls[key] || 0; }

  function addScroll(key, n) {
    st();
    core.save.scrolls[key] = (core.save.scrolls[key] || 0) + (n || 1);
    core.emit('changed');
    return core.save.scrolls[key];
  }

  /** 주문서를 물건에 쓴다 — 실패해도 물건은 남고 업횟만 닳는다 */
  function apply(uid, scrollKey) {
    var it = byUid(uid), d = defOf(it), sc = GD.scroll(scrollKey);
    if (!it || !d || !sc) { return { ok: false, why: '없는 물건입니다' }; }
    if (scrollCount(scrollKey) <= 0) { return { ok: false, why: '주문서가 없습니다' }; }
    var kind = d.slot === 'weapon' ? 'weapon' : 'armor';
    if (sc['for'] !== kind) {
      return { ok: false, why: sc['for'] === 'weapon' ? '무기에만 씁니다' : '방어구에만 씁니다' };
    }
    if (it.left <= 0) { return { ok: false, why: '더 올릴 수 없습니다 (업횟 0)' }; }

    core.save.scrolls[scrollKey] -= 1;
    it.left -= 1;
    var hit = Math.random() < Math.min(1, sc.rate * SCROLL_MUL);
    if (hit) {
      it.up += 1;
      if (sc.atk) { it.atk = (it.atk || 0) + sc.atk; }
      if (sc.def) { it.def = (it.def || 0) + sc.def; }
      if (sc.hp) { it.hp = (it.hp || 0) + sc.hp; }
      sfx('scrollok');
      core.log('📜 ' + sc.name + ' 이(가) ' + d.name + ' 에 붙었다 (+' + it.up + ')', 'good');
      core.emit('toast', '✨ 성공! ' + nameOf(it));
    } else {
      sfx('scrollno');
      core.log('📜 ' + sc.name + ' 이(가) ' + d.name + ' 에서 흩어졌다 (업횟 ' + it.left + ')', 'bad');
      core.emit('toast', '💨 실패 — 업횟 ' + it.left + ' 남음');
    }
    core.emit('changed');
    core.persist();
    return { ok: true, hit: hit, left: it.left, up: it.up };
  }

  /* ── 상점 ─────────────────────────────────────────────── */

  /** 소리 한 번 — sfx.js 가 없어도 규칙은 그대로 돈다(진단·데모가 그렇다) */
  function sfx(key) {
    var S = global.DG.sfx;
    if (S) { S.play(key); }
  }

  var SELL_RATE = 0.3;          // 판 값은 산 값의 3할 (원작도 헐값이다)

  /* 이동 상인(PLAN 11절, 2026-09-10) — 사냥터에서 마주치면 잠깐 상점이 싸진다.
     상점을 위치에 매지 않고(이 판은 🏪 도구줄로 언제든 연다, 그 구조는 그대로
     둔다) **값에만** 얹는 잠깐의 버프라 새 UI가 필요 없다. `side.js`가
     `core.save.player.merchantUntil`(끝나는 시각)만 적어 두고, 여기서 그
     시각이 남아 있는 동안만 읽는다 */
  var MERCHANT_DISCOUNT = 0.7;
  function priceMul() {
    var u = core.save.player.merchantUntil || 0;
    return Date.now() < u ? MERCHANT_DISCOUNT : 1;
  }

  /** 원본을 물들이지 않고 price 칸만 바꾼 얕은 복사본을 낸다(할인 표시용) */
  function withPrice(d, mul) {
    if (mul === 1) { return d; }
    var c = {}, k;
    for (k in d) { if (d.hasOwnProperty(k)) { c[k] = d[k]; } }
    c.price = Math.round(d.price * mul);
    return c;
  }

  /** 지금 살 수 있는 것 — 레벨이 오르면 목록이 는다 */
  function shopList() {
    var lv = core.save.player.level, mul = priceMul();
    var gears = GD.GEAR.filter(function (g) { return g.need <= lv + 2; })
      .map(function (g) { return withPrice(g, mul); });
    var scrolls = GD.SCROLLS.map(function (s) { return withPrice(s, mul); });
    return { gears: gears, scrolls: scrolls, potion: { name: '탕약', price: Math.round(90 * mul) } };
  }

  function buyGear(key) {
    var d = GD.find(key);
    if (!d) { return false; }
    var price = Math.round(d.price * priceMul());
    if (core.save.player.gold < price) { core.emit('toast', '🪙 금이 모자랍니다'); return false; }
    if (bagLeft() <= 0) { core.emit('toast', '🎒 가방이 가득 찼습니다'); return false; }
    core.save.player.gold -= price;
    put(make(key));
    sfx('coin');
    core.log('🏪 ' + d.name + ' 을(를) 샀다 · 🪙 -' + core.fmt(price), 'info');
    core.persist();
    return true;
  }

  function buyScroll(key) {
    var sc = GD.scroll(key);
    if (!sc) { return false; }
    var price = Math.round(sc.price * priceMul());
    if (core.save.player.gold < price) { core.emit('toast', '🪙 금이 모자랍니다'); return false; }
    core.save.player.gold -= price;
    addScroll(key, 1);
    core.persist();
    return true;
  }

  function buyPotion(n) {
    n = n || 1;
    var price = shopList().potion.price * n;
    if (core.save.player.gold < price) { core.emit('toast', '🪙 금이 모자랍니다'); return false; }
    core.save.player.gold -= price;
    global.DG.side.state().potions += n;
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 캔 것으로 만들기(data-side.js RECIPES) ─────────────── */

  /** 모자란 재료 — { kind: 모자란 개수 }, 다 있으면 빈 객체 */
  function craftLack(key) {
    var r = global.DG.sideData.recipe(key), S = global.DG.side;
    if (!r || !S) { return null; }
    var mats = S.state().mats || {}, lack = {}, k;
    for (k in r.need) {
      if (r.need.hasOwnProperty(k) && (mats[k] || 0) < r.need[k]) { lack[k] = r.need[k] - (mats[k] || 0); }
    }
    return lack;
  }

  /** 재료를 덜고 탕약·주문서를 준다 — 모자라면 아무것도 안 덜린다 */
  function craft(key) {
    var r = global.DG.sideData.recipe(key), lack = craftLack(key);
    if (!r || !lack) { return false; }
    if (Object.keys(lack).length) { core.emit('toast', '🧺 캔 것이 모자랍니다'); return false; }
    var s = global.DG.side.state(), k;
    for (k in r.need) { if (r.need.hasOwnProperty(k)) { s.mats[k] -= r.need[k]; } }
    if (r.give.potion) { s.potions += r.give.potion; }
    if (r.give.scroll) { addScroll(r.give.scroll, 1); }
    sfx('coin');
    core.log('🧺 ' + r.name + ' 을(를) 만들었다', 'good');
    core.emit('toast', '🧺 ' + r.name + ' 완성');
    core.emit('side:craft', { key: key });
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 판다 — 끼고 있는 것은 못 판다 */
  function sell(uid) {
    var it = byUid(uid), d = defOf(it);
    if (!it || !d) { return false; }
    if (isEquipped(uid)) { core.emit('toast', '⚠️ 끼고 있는 것은 못 팝니다'); return false; }
    var got = Math.max(1, Math.round(d.price * SELL_RATE));
    core.save.player.gold += got;
    drop(uid);
    sfx('coin');
    core.log('🏪 ' + nameOf(it) + ' 을(를) 팔았다 · 🪙 +' + core.fmt(got), 'info');
    core.persist();
    return got;
  }

  /* ── 사냥터에서 떨어지는 것 ───────────────────────────── */

  /**
   * 적 하나가 무엇을 떨굴지 — side.js 가 부른다.
   * 장비는 드물게(보스는 자주), 주문서는 그보다 조금 더 자주 나온다.
   */
  function rollDrop(lv, boss) {
    var r = Math.random();
    var pwDrop = global.DG.constellation ? global.DG.constellation.drop() : 1;   // 성좌도(W-0183) 드롭·사냥꾼의 눈
    var gearRate = Math.min(1, (boss ? 0.9 : 0.035) * DROP_MUL * pwDrop);
    var scrollRate = Math.min(1 - gearRate, (boss ? 0.7 : 0.05) * DROP_MUL * pwDrop);
    if (r < gearRate) {
      var pool = GD.poolFor(lv);
      var picked = core.pick(pool);
      /* 고유(固有) — 보스가 그 부위의 마지막 단(Lv.20)을 떨굴 때만, 그것도 드물게
         이름 있는 물건으로 바뀐다. 낮은 단이 고유가 되면 표의 마지막 물건보다
         세져 버려 어색하다 */
      if (boss && UD && picked.need === 20 && Math.random() < UNIQUE_CHANCE) {
        var uq = UD.forBase(picked.key);
        if (uq) { return { kind: 'gear', key: uq.key, uniq: true }; }
      }
      return { kind: 'gear', key: picked.key };
    }
    if (r < gearRate + scrollRate) {
      /* 낮은 확률 주문서는 더 드물게 나온다 */
      var pool2 = GD.SCROLLS.filter(function (s) { return Math.random() < (s.rate < 0.5 ? 0.35 : 1); });
      var sc = core.pick(pool2.length ? pool2 : GD.SCROLLS);
      return { kind: 'scroll', key: sc.key };
    }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.gear = {
    BAG: BAG, SELL_RATE: SELL_RATE,
    state: st, make: make, put: put, drop: drop, inv: inv, bagLeft: bagLeft,
    byUid: byUid, defOf: defOf, statsOf: statsOf, nameOf: nameOf, isUnique: isUnique,
    equip: equip, unequip: unequip, equipped: equipped, isEquipped: isEquipped,
    bonus: bonus, cut: cut, setGrade: setGrade, SET_HALF: SET_HALF,
    scrollCount: scrollCount, addScroll: addScroll, apply: apply,
    shopList: shopList, buyGear: buyGear, buyScroll: buyScroll, buyPotion: buyPotion, sell: sell,
    craftLack: craftLack, craft: craft,
    rollDrop: rollDrop, priceMul: priceMul, MERCHANT_DISCOUNT: MERCHANT_DISCOUNT
  };
})(window);
