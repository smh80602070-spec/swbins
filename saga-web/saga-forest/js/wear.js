/**
 * 옷 — 침선방(針線房)
 * ---------------------------------------------------------------
 * 원작의 재봉실 자리다. 궁중에서 바느질을 맡던 이름을 빌렸다.
 *
 * 고르는 것은 넷 — **겉옷 · 머리 · 옷 빛 · 덧옷**.
 * 사면 옷장에 남고(`owned`), 옷장에 있는 것만 입는다. 값이 문턱이라
 * 가구·벽지처럼 "오늘 들어온 것" 을 두지 않았다 — 옷은 취향이기 때문이다.
 *
 * **sprite.js 는 한 줄도 고치지 않았다.** 고른 값이 그대로 `look`(armor·helm·cape)과
 * `color` 로 들어간다. 다만 스탬프 캐시가 `ref.id` 로 갈리므로, 그릴 때
 * **차림표(sig)를 붙인 가짜 id** 를 넘겨야 갈아입은 것이 화면에 반영된다
 * (`village-view.js` 의 drawMe 참조). 그 한 가지가 이 파일에서 가장 조심할 곳이다.
 *
 * 겉모습만 바뀐다 — 원작의 옷도 그렇다. 값이 붙는 자리는 마을이지 옷이 아니다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }

  var DEFAULT = { coat: 'leather', head: 'topknot', dye: 'none', cape: 'off' };

  /* ── 세이브 자리 ──────────────────────────────────────── */

  function st() {
    var s = V().state();
    if (!s.wear) { s.wear = { on: {}, owned: {} }; }
    if (!s.wear.on) { s.wear.on = {}; }
    if (!s.wear.owned) { s.wear.owned = {}; }
    var k;
    for (k in DEFAULT) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT, k)) { continue; }
      if (!s.wear.on[k]) { s.wear.on[k] = DEFAULT[k]; }
      /* 값이 0 인 것은 처음부터 옷장에 있다 */
      var p = VD().wearPart(k);
      for (var i = 0; i < p.list.length; i++) {
        if (p.list[i].price === 0 && !p.list[i].unlock) { s.wear.owned[k + ':' + p.list[i].key] = true; }
      }
    }
    return s.wear;
  }

  /** 조건으로 열리는 옷(예: 배달 30건 우주복) — 사는 게 아니라 채우면 옷장에 든다 */
  function unlocked(it) {
    return !!(it && it.unlock === 'deliver' && V().deliveryState().n >= it.at);
  }
  function owned(part, key) {
    return !!st().owned[part + ':' + key] || unlocked(VD().wearItem(part, key));
  }
  function wearing(part) { return st().on[part] || DEFAULT[part]; }
  function item(part) { return VD().wearItem(part, wearing(part)); }

  /* ── 사고 입기 ────────────────────────────────────────── */

  function buy(part, key) {
    var p = VD().wearPart(part);
    if (!p) { return { kind: 'no', text: '없는 칸입니다' }; }
    var it = p.list.filter(function (x) { return x.key === key; })[0];
    if (!it) { return { kind: 'no', text: '없는 물건입니다' }; }
    if (owned(part, key)) { return { kind: 'no', text: '이미 옷장에 있습니다' }; }
    if (it.unlock === 'deliver') { return { kind: 'no', text: '🔒 배달 ' + it.at + '건을 채우면 옷장에 듭니다' }; }
    var ip = global.DG.workshop ? global.DG.workshop.cost(it.price) : it.price;   // 솜씨도 사는 값(W-0184)
    if (core.save.player.gold < ip) {
      return { kind: 'no', text: '금이 모자랍니다 (🪙 ' + core.fmt(ip) + ')' };
    }
    core.save.player.gold -= ip;
    st().owned[part + ':' + key] = true;
    core.gainFeat(2, '옷');
    core.log('🧵 ' + it.name + ' 을(를) 지었다 (🪙 -' + core.fmt(it.price) + ')', 'info');
    core.emit('changed');
    core.persist();
    return { kind: 'buy', text: '🧵 ' + it.name + ' — 옷장에 들었습니다' };
  }

  /** 옷장에 있는 것으로 갈아입는다 */
  function set(part, key) {
    var p = VD().wearPart(part);
    if (!p) { return { kind: 'no', text: '없는 칸입니다' }; }
    if (!owned(part, key)) { return { kind: 'no', text: '아직 옷장에 없습니다' }; }
    st().on[part] = key;
    var it = VD().wearItem(part, key);
    core.log('🧵 ' + p.name + ' 을(를) ' + it.name + ' 으로 갈아입었다', 'info');
    core.emit('changed');
    core.persist();
    return { kind: 'wear', text: '🧵 ' + it.name + ' 으로 갈아입었다' };
  }

  /* ── 그림에 얹기 ──────────────────────────────────────── */

  /** 인물의 본래 외형에 지금 차림을 덮어쓴다 (원본은 건드리지 않는다) */
  function applyLook(look) {
    var out = {}, k;
    for (k in look) {
      if (Object.prototype.hasOwnProperty.call(look, k)) { out[k] = look[k]; }
    }
    var coat = VD().wearItem('coat', wearing('coat'));
    out.armor = (coat && coat.look) || wearing('coat');
    out.helm = wearing('head');
    out.cape = wearing('cape') === 'on';
    return out;
  }

  /** 옷 빛 — '그대로' 면 인물의 세력색을 쓴다 */
  function color(base) {
    var dye = VD().wearItem('dye', wearing('dye'));
    return dye && dye.c ? dye.c : base;
  }

  /**
   * 차림표 — 스탬프 캐시를 가르는 열쇠다.
   * 이게 없으면 갈아입어도 **옛 그림이 그대로 나온다**(캐시가 ref.id 로만 갈린다).
   */
  function sig() {
    return wearing('coat') + '/' + wearing('head') + '/' +
           wearing('dye') + '/' + wearing('cape');
  }

  function status() {
    var parts = VD().WEAR_PARTS.map(function (p) {
      return { part: p, now: VD().wearItem(p.key, wearing(p.key)),
               list: p.list.map(function (it) {
                 return { it: it, own: owned(p.key, it.key), on: wearing(p.key) === it.key };
               }) };
    });
    return { parts: parts, sig: sig(),
             name: VD().wearItem('dye', wearing('dye')).name + ' ' +
                   VD().wearItem('coat', wearing('coat')).name +
                   ' · ' + VD().wearItem('head', wearing('head')).name +
                   (wearing('cape') === 'on' ? ' · 덧옷' : '') };
  }

  global.DG = global.DG || {};
  global.DG.wear = {
    state: st, owned: owned, wearing: wearing, item: item,
    buy: buy, set: set, applyLook: applyLook, color: color, sig: sig, status: status
  };
})(window);
