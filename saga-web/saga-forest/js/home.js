/**
 * 집 — 들어가서 꾸미는 한 칸
 * ---------------------------------------------------------------
 * 원작의 집을 옮겼다. 축은 셋이다.
 *
 *   **산다**   전방에 날마다 가구 넉 점이 들어온다 (그날 것은 그날만)
 *   **놓는다** 집 안에서 선 자리에 놓는다 — 심기와 **같은 규칙**이다
 *              (규칙을 새로 만들지 않는다: 서 있는 자리가 곧 놓는 자리)
 *   **넓힌다** 증축을 신청하면 그 자리에서 넓어지고 **빚이 생긴다**.
 *              빚을 다 갚아야 다음을 신청할 수 있다 — 원작의 융자다
 *
 * 놓은 것으로 **집 평가**가 매겨진다(값·수·계열). 등급이 오르면 이름이 바뀌고,
 * 날이 바뀔 때 평가서가 편지로 온다(mail.js).
 *
 * 실내는 **휘지 않는다.** 마을은 구면에 감겨 있지만 방은 평평한 3/4 시점이다 —
 * 원작도 그렇다. 그 차이가 "안에 들어왔다" 는 느낌을 만든다.
 *
 * 규칙만 맡는다 — 그리는 것은 village-view.js 의 drawHome 이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }

  var SHOP_N = 4;              // 전방에 날마다 들어오는 가구 수 (전방이 크면 는다)

  /* ── 세이브 자리 ──────────────────────────────────────── */

  function st() {
    var s = V().state();
    if (!s.home) {
      s.home = { tier: 0, debt: 0, items: [], stock: {}, best: 0,
                 wall: 'earth', floor: 'wood', walls: {}, floors: {} };
    }
    if (!s.home.stock) { s.home.stock = {}; }
    if (!s.home.items) { s.home.items = []; }
    if (!s.home.walls) { s.home.walls = {}; }
    if (!s.home.floors) { s.home.floors = {}; }
    /* 기본 한 벌은 처음부터 가지고 있다 (값이 0 이다) */
    s.home.walls.earth = true;
    s.home.floors.wood = true;
    if (!s.home.wall) { s.home.wall = 'earth'; }
    if (!s.home.floor) { s.home.floor = 'wood'; }
    return s.home;
  }

  function tier() { return VD().HOME_TIERS[core.clamp(st().tier, 0, VD().HOME_TIERS.length - 1)]; }
  function debt() { return st().debt || 0; }

  /** 방의 크기 (마을 단위) — 타일 수 × TILE */
  function room() {
    var t = tier(), T = V().TILE;
    return { tw: t.w, th: t.h, w: t.w * T, h: t.h * T, name: t.name };
  }

  /**
   * 문은 **뒷벽 가운데**다. 원작의 방도 그렇다 — 문이 화면 안쪽 벽에 있어야
   * "안에 들어와 있다" 는 그림이 된다. 여기서 손을 쓰면 밖으로 나간다.
   */
  function door() {
    var r = room(), T = V().TILE;
    return { x: Math.floor(r.tw / 2) * T + T * 0.5, y: T * 0.8 };
  }

  /* ── 창고 ─────────────────────────────────────────────── */

  function stockCount(key) { return st().stock[key] || 0; }

  function stockList() {
    var s = st(), out = [], k;
    for (k in s.stock) {
      if (!Object.prototype.hasOwnProperty.call(s.stock, k) || !s.stock[k]) { continue; }
      var f = VD().furn(k);
      if (f) { out.push({ furn: f, n: s.stock[k] }); }
    }
    out.sort(function (a, b) { return b.furn.price - a.furn.price; });
    return out;
  }

  function stockAdd(key, n) {
    var s = st();
    s.stock[key] = (s.stock[key] || 0) + (n || 1);
  }

  /* ── 전방의 오늘 진열 ─────────────────────────────────────
   * 날짜 해시로 고른다 — 그러니 오늘 것은 오늘만이고, 같은 날이면 늘 같다.
   */
  function shopToday() {
    var all = VD().FURNITURE.filter(function (f) { return !f.fest; }), day = V().state().day;   // 행사 가구는 안 판다(PLAN §5.6)
    var n = SHOP_N + (V().shopLevel ? V().shopLevel().add : 0);
    var out = [], used = {};
    for (var i = 0; i < n * 4 && out.length < n; i++) {
      var idx = Math.floor(core.hash2(day * 31 + i * 97, day % 617 + 7) * all.length) % all.length;
      if (used[idx]) { continue; }
      used[idx] = true;
      out.push(all[idx]);
    }
    return out;
  }

  /* ── 벽지와 장판 ──────────────────────────────────────────
   * 가구보다 먼저 방의 인상을 바꾸는 것이 이 둘이다.
   * 진열도 가구와 같은 규칙 — **날짜 해시**라 오늘 것은 오늘뿐이다.
   */

  function finishList(kind) { return kind === 'wall' ? VD().WALLS : VD().FLOORS; }
  function ownedMap(kind) { return kind === 'wall' ? st().walls : st().floors; }

  /** 오늘 전방에 들어온 벽지 하나 · 장판 하나 (기본 한 벌은 진열하지 않는다) */
  function shopFinish() {
    var day = V().state().day, out = {};
    ['wall', 'floor'].forEach(function (kind) {
      var all = finishList(kind).filter(function (f) { return f.price > 0; });
      var i = Math.floor(core.hash2(day * 17 + (kind === 'wall' ? 11 : 47),
                                    day % 733 + 5) * all.length) % all.length;
      out[kind] = all[i];
    });
    return out;
  }

  function ownsFinish(kind, key) { return !!ownedMap(kind)[key]; }

  function buyFinish(kind, key) {
    var f = finishList(kind).filter(function (x) { return x.key === key; })[0];
    var word = kind === 'wall' ? '벽지' : '장판';
    if (!f) { return { kind: 'no', text: '없는 물건입니다' }; }
    if (ownsFinish(kind, key)) { return { kind: 'no', text: '이미 가지고 있습니다' }; }
    var today = shopFinish()[kind];
    if (!today || today.key !== key) {
      return { kind: 'no', text: f.name + '은(는) 오늘 들어오지 않았습니다' };
    }
    var fp = wsCost(f.price);
    if (core.save.player.gold < fp) {
      return { kind: 'no', text: '금이 모자랍니다 (🪙 ' + core.fmt(fp) + ')' };
    }
    core.save.player.gold -= fp;
    ownedMap(kind)[key] = true;
    core.log('🎨 ' + word + ' ' + f.name + ' 을(를) 샀다 (🪙 -' + core.fmt(f.price) + ')', 'info');
    core.emit('changed');
    core.persist();
    return { kind: 'buy', text: '🎨 ' + f.name + ' — 집 시트에서 갈아 끼웁니다' };
  }

  /** 가진 것 중에서 골라 바른다 */
  function setFinish(kind, key) {
    if (!ownsFinish(kind, key)) { return { kind: 'no', text: '아직 가지고 있지 않습니다' }; }
    var s = st();
    if (kind === 'wall') { s.wall = key; } else { s.floor = key; }
    var f = kind === 'wall' ? VD().wall(key) : VD().floor(key);
    core.log('🎨 ' + (kind === 'wall' ? '벽을' : '바닥을') + ' ' + f.name + ' 으로 바꿨다', 'info');
    core.emit('changed');
    core.persist();
    return { kind: 'finish', text: '🎨 ' + f.name + ' 으로 바꿨다' };
  }

  function wallNow() { return VD().wall(st().wall); }
  function floorNow() { return VD().floor(st().floor); }

  /** 사는 값 — 솜씨도 알뜰·구두쇠(W-0184) */
  function wsCost(p) { return global.DG.workshop ? global.DG.workshop.cost(p) : p; }
  function buy(key) {
    var f = VD().furn(key);
    if (!f) { return { kind: 'no', text: '없는 물건입니다' }; }
    var today = shopToday();
    var listed = today.filter(function (x) { return x.key === key; }).length > 0;
    if (!listed) { return { kind: 'no', text: f.name + '은(는) 오늘 들어오지 않았습니다' }; }
    var fp = wsCost(f.price);
    if (core.save.player.gold < fp) {
      return { kind: 'no', text: '금이 모자랍니다 (🪙 ' + core.fmt(fp) + ')' };
    }
    core.save.player.gold -= fp;
    stockAdd(key, 1);
    core.log('🪑 ' + f.name + ' 을(를) 샀다 (🪙 -' + core.fmt(f.price) + ')', 'info');
    core.emit('changed');
    core.persist();
    return { kind: 'buy', text: '🪑 ' + f.name + ' 을(를) 샀다 — 집 안에서 놓을 수 있습니다' };
  }

  /** 창고의 가구를 되판다 — 산값의 절반 */
  function sell(key) {
    var f = VD().furn(key);
    if (!f || stockCount(key) < 1) { return { kind: 'no', text: '창고에 없습니다' }; }
    var s = st();
    s.stock[key] -= 1;
    var gold = Math.floor(f.price / 2);
    core.save.player.gold += gold;
    core.log('🪙 ' + f.name + ' 을(를) 되팔았다 (+' + core.fmt(gold) + ')', 'info');
    core.emit('changed');
    core.persist();
    return { kind: 'sell', text: '🪙 +' + core.fmt(gold) };
  }

  /* ── 놓기 · 집어 들기 ─────────────────────────────────── */

  /** 그 자리(타일)에 이미 놓인 가구 */
  function at(x, y) {
    var s = st(), T = V().TILE;
    var tx = Math.floor(x / T), ty = Math.floor(y / T);
    for (var i = 0; i < s.items.length; i++) {
      var it = s.items[i];
      if (Math.floor(it.x / T) === tx && Math.floor(it.y / T) === ty) { return it; }
    }
    return null;
  }

  /** 지금 선 자리에 놓을 수 있나 */
  function canPlaceHere() {
    if (!V().indoors()) { return { ok: false, why: '집 안에서만 놓을 수 있습니다' }; }
    var p = V().raw().player;
    if (at(p.x, p.y)) { return { ok: false, why: '그 자리엔 이미 무언가 있습니다' }; }
    var d = door();
    if (Math.hypot(d.x - p.x, d.y - p.y) < V().TILE * 0.9) {
      return { ok: false, why: '문 앞은 비워 둡니다' };
    }
    return { ok: true };
  }

  /** 창고의 것 하나를 지금 선 자리에 놓는다 */
  function place(key) {
    var f = VD().furn(key);
    if (!f) { return null; }
    if (stockCount(key) < 1) { return { kind: 'no', text: '창고에 없습니다' }; }
    var spot = canPlaceHere();
    if (!spot.ok) { return { kind: 'no', text: spot.why }; }
    var s = st(), p = V().raw().player, T = V().TILE;
    s.stock[key] -= 1;
    s.items.push({ key: key, x: Math.floor(p.x / T) * T + T * 0.5,
                            y: Math.floor(p.y / T) * T + T * 0.5 });
    core.gainFeat(2, '집 꾸미기');
    core.log('🪑 ' + f.name + ' 을(를) 놓았다', 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'place', text: '🪑 ' + f.name + ' 을(를) 놓았다' };
  }

  /** 놓인 것을 다시 창고로 */
  function pickUp(item) {
    var s = st(), i = s.items.indexOf(item);
    if (i < 0) { return null; }
    s.items.splice(i, 1);
    stockAdd(item.key, 1);
    var f = VD().furn(item.key);
    core.emit('changed');
    core.persist();
    return { kind: 'pick', text: '🪑 ' + (f ? f.name : '가구') + ' 을(를) 거두었다' };
  }

  /* ── 집 평가 ──────────────────────────────────────────────
   * 원작의 그 평가서. 값과 수와 **계열**을 본다 —
   * 비싼 것 하나보다 어울리는 것 여럿이 낫다.
   */
  function score() {
    var s = st(), sets = {}, sum = 0, i;
    for (i = 0; i < s.items.length; i++) {
      var f = VD().furn(s.items[i].key);
      if (!f) { continue; }
      sum += f.price / 50;
      sets[f.set] = (sets[f.set] || 0) + 1;
    }
    sum += s.items.length * 2;
    var bonus = 0, k;
    for (k in sets) {
      if (!Object.prototype.hasOwnProperty.call(sets, k)) { continue; }
      if (sets[k] >= 5) { bonus += 45; }
      else if (sets[k] >= 3) { bonus += 25; }
    }
    sum += bonus;
    sum += st().tier * 20;                 // 넓은 집은 그 자체로 점수다
    /* 벽지·장판을 갈아 끼운 것도 값이다 — 원작의 평가도 그 둘을 본다 */
    var fin = 0;
    if (s.wall !== 'earth') { fin += 12; }
    if (s.floor !== 'wood') { fin += 12; }
    sum += fin;
    return { total: Math.round(sum), sets: sets, bonus: bonus, finish: fin,
             n: s.items.length };
  }

  function grade(total) {
    var G = VD().HOME_GRADES;
    var g = G[0];
    if (total === undefined) { total = score().total; }
    for (var i = 0; i < G.length; i++) { if (total >= G[i].at) { g = G[i]; } }
    return g;
  }

  /* ── 증축(융자) ───────────────────────────────────────── */

  function nextTier() {
    var T = VD().HOME_TIERS;
    return st().tier + 1 < T.length ? T[st().tier + 1] : null;
  }

  function expand() {
    var nx = nextTier();
    if (!nx) { return { kind: 'no', text: '더 넓힐 수 없습니다 — 이미 가장 큰 집입니다' }; }
    if (debt() > 0) {
      return { kind: 'no', text: '빚이 남아 있습니다 (🪙 ' + core.fmt(debt()) + ') — 다 갚고 신청하세요' };
    }
    var s = st();
    s.tier += 1;
    s.debt = nx.cost;
    core.gainFeat(10, '증축');
    core.log('🏠 ' + nx.name + ' 으로 넓혔다 — 빚 🪙 ' + core.fmt(nx.cost) + ' 이 생겼다', 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'expand', text: '🏠 ' + nx.name + ' — 빚 🪙 ' + core.fmt(nx.cost) };
  }

  /** 빚을 갚는다. n 을 주지 않으면 갚을 수 있는 만큼 */
  function repay(n) {
    var s = st();
    if (!s.debt) { return { kind: 'no', text: '갚을 빚이 없습니다' }; }
    var pay = Math.min(n || s.debt, s.debt, core.save.player.gold);
    if (pay <= 0) { return { kind: 'no', text: '금이 없습니다' }; }
    core.save.player.gold -= pay;
    s.debt -= pay;
    if (s.debt <= 0) {
      s.debt = 0;
      core.save.player.fame += 40;
      core.log('🏠 빚을 다 갚았다 — 🎖️ +40', 'good');
    } else {
      core.log('🪙 빚을 갚았다 (-' + core.fmt(pay) + ') — 남은 빚 ' + core.fmt(s.debt), 'info');
    }
    core.emit('changed');
    core.persist();
    return { kind: 'repay', text: '🪙 -' + core.fmt(pay) +
             (s.debt ? ' · 남은 빚 ' + core.fmt(s.debt) : ' · 빚을 다 갚았습니다') };
  }

  function status() {
    var sc = score();
    return {
      tier: st().tier, room: room(), debt: debt(),
      score: sc.total, grade: grade(sc.total).name, n: sc.n, bonus: sc.bonus,
      next: nextTier(), stock: stockList(), shop: shopToday(),
      inside: V().indoors(),
      wall: wallNow(), floor: floorNow(),
      walls: VD().WALLS.filter(function (f) { return ownsFinish('wall', f.key); }),
      floors: VD().FLOORS.filter(function (f) { return ownsFinish('floor', f.key); }),
      shopFinish: shopFinish(), finish: sc.finish
    };
  }

  global.DG = global.DG || {};
  global.DG.home = {
    state: st, room: room, door: door, tier: tier, debt: debt,
    stockList: stockList, stockCount: stockCount, stockAdd: stockAdd,
    shopToday: shopToday, buy: buy, sell: sell,
    shopFinish: shopFinish, buyFinish: buyFinish, setFinish: setFinish,
    ownsFinish: ownsFinish, wallNow: wallNow, floorNow: floorNow,
    at: at, place: place, pickUp: pickUp, canPlaceHere: canPlaceHere,
    score: score, grade: grade, expand: expand, repay: repay,
    nextTier: nextTier, status: status
  };
})(window);
