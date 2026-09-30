/**
 * 사고(史庫) — 원작의 박물관
 * ---------------------------------------------------------------
 * 실록을 보관하던 그 이름을 빌렸다. 하는 일은 원작의 박물관과 같다.
 *
 * **도감과 사고는 다른 것이다.**
 *   도감(`village.caught`)  한 번이라도 손에 넣은 것 — 팔아도 지워지지 않는다
 *   사고(`village.donated`) **들여 놓은 것** — 가방에서 한 점이 실제로 빠져나간다
 *
 * 원작이 그 둘을 갈라 둔 까닭이 있다. 잡는 것과 남기는 것은 다른 결심이다.
 * 값나가는 것을 팔지 않고 들여 놓는 데에 값이 있어야 한다 — 그래서 기증은
 * 금이 아니라 **명성**을 준다.
 *
 * 기증은 **사고 앞에서만** 받는다. 어디서나 되면 건물이 마을에 있을 까닭이 없다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }

  function st() { return V().state(); }

  /** 사고에 이미 들인 것인가 */
  function donated(key) { return !!st().donated[key]; }

  /** 사고 곁에 서 있나 — 기증은 여기서만 받는다 */
  function near() {
    var raw = V().raw(), p = raw.player;
    if (V().indoors() || V().caveInside()) { return false; }
    for (var i = 0; i < raw.props.length; i++) {
      if (raw.props[i].kind !== 'museum') { continue; }
      return Math.hypot(raw.props[i].x - p.x, raw.props[i].y - p.y) < V().REACH * 1.8;
    }
    return false;
  }

  function canDonate(key) {
    var it = VD().item(key);
    if (!it) { return { ok: false, why: '없는 물건입니다' }; }
    if (donated(key)) { return { ok: false, why: '이미 사고에 있습니다' }; }
    if (V().bagCount(key) < 1) { return { ok: false, why: '가방에 없습니다' }; }
    if (!near()) { return { ok: false, why: '사고(🏛️) 앞으로 가야 받습니다' }; }
    return { ok: true };
  }

  /** 갈래 하나(bug/fish/fossil/shell)의 done/total — byCat() 은 넷을 한꺼번에
   *  훑어 매번 만들기엔 과하니, donate() 는 이 홑겹만 쓴다 */
  function catStatus(catKey) {
    var all = VD().ITEMS[catKey] || [], done = 0;
    for (var i = 0; i < all.length; i++) { if (donated(all[i].key)) { done++; } }
    return { done: done, total: all.length };
  }

  function donate(key) {
    var chk = canDonate(key);
    if (!chk.ok) { return { kind: 'no', text: chk.why }; }
    var s = st(), it = VD().item(key);
    var before = count().done;
    var catBefore = catStatus(it.cat);

    s.bag[key] -= 1;
    s.donated[key] = true;
    s.donateTotal = (s.donateTotal || 0) + 1;   // 오늘의 일과(§5.1) — donated 는 종류별 한 번뿐이라 따로 센다
    var fame = 20 + Math.floor(it.price / 10);
    core.save.player.fame += fame;
    core.gainFeat(3, '기증');
    core.gainExp(12);

    /* 번들(PLAN §5.3) — 이 기증으로 갈래가 막 다 채워졌으면 마을 시설이 선다.
       village.js buildProps() 는 날짜가 넘어갈 때만 저절로 도니, 시설이
       완성 "순간" 바로 보이려면 여기서 한 번 더 불러야 한다 */
    var catAfter = catStatus(it.cat);
    var bundle = VD().BUNDLES && VD().BUNDLES[it.cat];
    var justCompleted = !!bundle && catBefore.done < catBefore.total && catAfter.done >= catAfter.total;
    if (justCompleted && V().buildProps) { V().buildProps(); }

    var text = '🏛️ ' + it.emoji + ' ' + it.name + ' 을(를) 사고에 들였다 — 🎖️ +' + fame;
    if (justCompleted) { text += ' — 🎉 ' + bundle.name + '!'; }
    core.log(text, 'good');
    if (V().checkTasks) { V().checkTasks(); }
    core.emit('changed');
    core.persist();

    var after = count().done;
    return { kind: 'donate', text: text,
             grew: grade(after).name !== grade(before).name,
             bundleCompleted: justCompleted ? it.cat : null };
  }

  /** 갈래별 현황 */
  function byCat() {
    var out = [], cats = VD().MUSEUM_CATS, i, j;
    for (i = 0; i < cats.length; i++) {
      var all = VD().ITEMS[cats[i].key] || [];
      var done = 0;
      for (j = 0; j < all.length; j++) { if (donated(all[j].key)) { done++; } }
      out.push({ cat: cats[i], all: all, done: done, total: all.length });
    }
    return out;
  }

  function count() {
    var list = byCat(), done = 0, total = 0;
    for (var i = 0; i < list.length; i++) { done += list[i].done; total += list[i].total; }
    return { done: done, total: total };
  }

  /** PLAN §5.3 "안 한 것" 목록의 마지막 한 줄 — 네 번들(곤충·물고기·화석·조개)
   *  이 전부 다 찼는가. `town.js` `beauty()`가 마을 평가 최고 등급 상한을
   *  여기에 건다(§5.8②가 그날 생겨 비로소 연결 대상이 생겼다, 2026-09-18). */
  function allBundlesDone() {
    var list = byCat();
    for (var i = 0; i < list.length; i++) {
      if (list[i].cat.bonus) { continue; }       // 덤 갈래(탑성 조각)는 상한에 안 든다
      if (list[i].total <= 0 || list[i].done < list[i].total) { return false; }
    }
    return list.length > 0;
  }

  function grade(n) {
    var G = VD().MUSEUM_GRADES, g = G[0];
    if (n === undefined) { n = count().done; }
    for (var i = 0; i < G.length; i++) { if (n >= G[i].at) { g = G[i]; } }
    return g;
  }

  /** 지금 가방에 있는 것 중 아직 사고에 없는 것 */
  function offerable() {
    var list = V().bagList(), out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i].item;
      if (VD().MUSEUM_CATS.filter(function (c) { return c.key === it.cat; }).length === 0) { continue; }
      if (donated(it.key)) { continue; }
      out.push(list[i]);
    }
    return out;
  }

  function status() {
    var c = count();
    return { done: c.done, total: c.total, grade: grade(c.done).name,
             near: near(), cats: byCat(), offer: offerable() };
  }

  global.DG = global.DG || {};
  global.DG.museum = {
    donated: donated, near: near, canDonate: canDonate, donate: donate,
    byCat: byCat, count: count, grade: grade, offerable: offerable, status: status,
    allBundlesDone: allBundlesDone, catStatus: catStatus
  };
})(window);
