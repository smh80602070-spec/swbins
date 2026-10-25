/**
 * 5천하 — 인재 천거 (W-0424 · 정본 고돗 G-0383 · 삼국지 천거 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 달 끝마다 결정적 굴림(그 달 번호 해시 < CHANCE 12%)이 서면, 내 장수 중 충성 LOYAL_MIN(60) 이상·지력 으뜸이
 * 내 성들에 숨어 있는 재야(수색과 같은 풀 — off.freeAt(성, false) 중 found 아닌 사람) 하나를 천거한다:
 *   그 사람 found = true(수색한 것과 같다 — 등용은 손으로) · 천거한 장수 충성 +LOYAL_ADD(5) · 기록·토스트 한 줄
 * 풀이 비었거나 맞는 장수가 없으면 아무 일 없음. 세이브 꼴 그대로(found·loyal 기존 칸). 내 세력만(AI 안 씀).
 * src/rtk/02.js 달 넘김 monthly 묶음(polity 곁) 한 줄에서 부른다. 손잡이 rtk.recommend(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var CHANCE = 0.12, LOYAL_MIN = 60, LOYAL_ADD = 5;
  var last = null;   // 이번 달 천거({by, got, city}) — 「이번 달」 창·진단

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('rtk.recommend', 1)); }
  function R() { return global.DG.rtk; }
  function OFF() { return global.DG.off; }
  /** 그 달에 천거가 서나(순수) — FNV-1a 32 */
  function rolls(month) {
    var s = 'recommend:' + month, h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296 < CHANCE;
  }
  /** 천거할 장수 — 내 세력·충성 60 이상·지력 으뜸(같으면 id 순) */
  function recommender() {
    var off = OFF(), list = off.ofForce(R().me()), best = null, bw = -1;
    list.forEach(function (h) {
      var r = off.rec(h.id); if (!r || r.dead || (r.loyal || 0) < LOYAL_MIN) { return; }
      var w = off.stats(h.id).wisdom;
      if (w > bw || (w === bw && best && h.id < best.id)) { bw = w; best = h; }
    });
    return best;
  }
  /** 내 성들의 숨은 재야 — 귀한 사람 먼저(수색과 같은 결) */
  function hiddenPool() {
    var off = OFF(), out = [];
    R().citiesOf(R().me()).forEach(function (cid) {
      off.freeAt(cid, false).forEach(function (h) { var r = off.rec(h.id); if (r && !r.found) { out.push({ h: h, city: cid }); } });
    });
    return out.sort(function (a, b) { return (b.h.rarity || 0) - (a.h.rarity || 0) || (a.h.id < b.h.id ? -1 : 1); });
  }

  /** 달 끝 — 천거가 서면 {by, got, city}, 아니면 null */
  function monthly(monthOverride) {
    last = null;
    if (!on() || !R() || !OFF()) { return null; }
    var st = R().state(); if (!st) { return null; }
    var month = monthOverride != null ? monthOverride : (st.turn || 0);
    if (!rolls(month)) { return null; }
    var by = recommender(), pool = by ? hiddenPool() : [];
    if (!by || !pool.length) { return null; }
    var pick = pool[0], c = core(), CD = global.DG.cityData, cn = CD && CD.find ? (CD.find(pick.city) || {}).name || pick.city : pick.city;
    OFF().rec(pick.h.id).found = true;
    OFF().addLoyal(by.id, LOYAL_ADD);
    var txt = '📜 ' + by.name + ' 이(가) ' + cn + ' 의 ' + pick.h.name + ' 을(를) 천거했다 — 등용할 수 있다 · ' + by.name + ' 충성 +' + LOYAL_ADD;
    if (c && c.log) { c.log(txt, 'good'); }
    if (c && c.emit) { c.emit('toast', '📜 ' + pick.h.name + ' 천거 — ' + by.name); }
    last = { by: by.id, got: pick.h.id, city: pick.city, text: txt };
    return last;
  }

  global.DG = global.DG || {};
  global.DG.recommend = { CHANCE: CHANCE, LOYAL_MIN: LOYAL_MIN, LOYAL_ADD: LOYAL_ADD, rolls: rolls, recommender: recommender, hiddenPool: hiddenPool, monthly: monthly, last: function () { return last; } };
})(window);
