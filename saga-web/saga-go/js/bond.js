/**
 * 인연(因緣) — 동행 관계 (PLAN §5 ⑥)
 * ---------------------------------------------------------------
 * 인물이 "동료"가 되는 판인데 동료가 숫자(lv·rank)일 뿐이었다. 반려(`buddy.js`)가 펫에게 해
 * 준 것을 인물에게 — 파티 다섯이 **함께 걸은 거리**와 **함께 이긴 토벌**로 인연 0~3 이 쌓인다.
 *
 *   인연 1·2·3   걸음 2km·6km·15km  **또는**  토벌 승 3·10·25 (둘 중 먼저 닿는 쪽)
 *   능력 +2%/등급  `hero.stats()` 성장 배율 층(승급 특성과 같은 층)에서 곱한다 — 기본치 불변
 *   결(結)        같은 세력 둘이 함께 파티면 필살 기 충전 +10%(시대는 안 본다 — 넷뿐이라
 *                 파티 다섯이면 늘 켜진다. 세력은 56 곳이라 맞춰 편성해야 켜진다)
 *                 (`core.effect('kiPct')` 로 흘려 `rogue-action` 이 만들 때 읽는다 — 안 쌓인다)
 *   인연 3        인물 상세 초상 테두리가 금빛으로 바뀐다
 *
 * 인연은 **파티에 있을 때만** 오른다. 오르는 순간 한 마디(`data-bond.js`)가 토스트·로그로 뜬다.
 * 세이브 `heroes[id].bond{walk,wins,lv}`(선택 칸 — 없으면 0). 거리는 세션 안의 `mark` 로만 센다
 * (닫혀 있던 동안의 걸음은 안 친다 — 세이브를 되돌려도 안 튄다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var MAX_LV = 3;
  var WALK_AT = [2000, 6000, 15000];      // m
  var WINS_AT = [3, 10, 25];              // 토벌 승
  var STEP = 0.02;                        // 등급당 능력 +2%
  var KI_PCT = 10;                        // 결 — 필살 기 충전 +10%

  function data() { return global.DG.data; }

  /** 저장된 인연 기록(없으면 0) — 세이브를 만들지 않는 읽기 */
  function rec(id) {
    var g = core.save.heroes[id];
    var b = g && g.bond;
    return b ? { walk: b.walk || 0, wins: b.wins || 0, lv: b.lv || 0 } : { walk: 0, wins: 0, lv: 0 };
  }

  function slot(id) {
    var g = global.DG.hero.ensure(id);
    if (!g.bond) { g.bond = { walk: 0, wins: 0, lv: 0 }; }
    return g.bond;
  }

  /** 걸음·승수로 본 인연 등급 — 순수. 둘 중 높은 쪽 */
  function lvFor(walk, wins) {
    var lw = 0, lv = 0, i;
    for (i = 0; i < WALK_AT.length; i++) { if (walk >= WALK_AT[i]) { lw = i + 1; } }
    for (i = 0; i < WINS_AT.length; i++) { if (wins >= WINS_AT[i]) { lv = i + 1; } }
    return Math.min(MAX_LV, Math.max(lw, lv));
  }

  function lvOf(id) { return rec(id).lv; }

  /** 성장 배율에 곱할 인연 몫 — hero.stats() 가 부른다. 인연이 없으면 1 */
  function mulOf(id) { return 1 + STEP * lvOf(id) * (global.DG.starchart ? global.DG.starchart.bond() : 1); }   // 인연 몫 × 성도(W-0181)

  function strHash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
    return h >>> 0;
  }

  /** 이 인물이 이 등급에서 건네는 한 마디 — 순수. 같은 인물은 늘 같은 말 */
  function line(id, lv) {
    var h = data().find(id), T = global.DG.dataBond && global.DG.dataBond.LINES;
    if (!h || !T || lv < 1 || lv > MAX_LV) { return ''; }
    var pool = (T[h.trait] || T.virtue)[lv - 1];
    return pool[strHash(String(id)) % pool.length].replace('{name}', h.name);
  }

  /* ── 결(結) ────────────────────────────────────────────── */

  /** 파티에서 세력이 같은 두 인물 쌍 — 순수 */
  function pairs(party) {
    var out = [], D = data(), i, j;
    party = party || core.save.party || [];
    for (i = 0; i < party.length; i++) {
      var a = D.find(party[i]);
      if (!a) { continue; }
      for (j = i + 1; j < party.length; j++) {
        var b = D.find(party[j]);
        if (b && a.faction === b.faction) { out.push([a.id, b.id]); }
      }
    }
    return out;
  }

  function kiPct(party) { return pairs(party).length ? KI_PCT : 0; }

  /** core.effect() 훅 — 결이 있으면 필살 기 충전 +10%(쌓이지 않는다) */
  function bonus() {
    var k = kiPct();
    return k ? { kiPct: k } : {};
  }

  /** 이 인물과 결이 맞는 파티 동료 이름들 — 상세 화면용 */
  function partnersOf(id) {
    var out = [], D = data();
    pairs().forEach(function (p) {
      var other = p[0] === id ? p[1] : (p[1] === id ? p[0] : null);
      if (other) { var o = D.find(other); if (o) { out.push(o.name); } }
    });
    return out;
  }

  /* ── 쌓기 ──────────────────────────────────────────────── */

  function raise(id) {
    var b = slot(id);
    var lv = lvFor(b.walk, b.wins);
    if (lv <= b.lv) { return false; }
    b.lv = lv;
    var say = line(id, lv);
    core.log('🤝 인연 ' + lv + ' — ' + say, 'good');
    core.emit('toast', '🤝 ' + say);
    core.emit('bond:up', { id: id, lv: lv });
    core.emit('changed');
    core.persist();
    return true;
  }

  var mark = null;
  /** 매 프레임(game.js loop) — 파티 인물 모두에게 걸은 만큼 더한다 */
  function tick() {
    var d = core.save.player.distance;
    if (mark === null || mark > d) { mark = d; return 0; }      // 첫 호출·세이브를 되돌렸을 때
    var step = d - mark;
    if (step < 1) { return 0; }                                  // 1m 씩 모아서
    mark = d;
    var party = core.save.party || [], n = 0;
    for (var i = 0; i < party.length; i++) {
      if (!data().find(party[i])) { continue; }
      slot(party[i]).walk += step;
      if (raise(party[i])) { n++; }
    }
    return n;
  }

  /** 토벌에서 이겼다 — 파티 모두 승수 +1 (raid.js fight 가 부른다) */
  function onRaidWin() {
    var party = core.save.party || [], n = 0;
    for (var i = 0; i < party.length; i++) {
      if (!data().find(party[i])) { continue; }
      slot(party[i]).wins += 1;
      if (raise(party[i])) { n++; }
    }
    return n;
  }

  /** 상세 화면용 진행 — 다음 등급까지 */
  function progressOf(id) {
    var r = rec(id), nx = Math.min(MAX_LV, r.lv + 1);
    return {
      lv: r.lv, walk: r.walk, wins: r.wins, max: r.lv >= MAX_LV,
      needWalk: WALK_AT[nx - 1], needWins: WINS_AT[nx - 1]
    };
  }

  global.DG = global.DG || {};
  global.DG.bond = {
    MAX_LV: MAX_LV, WALK_AT: WALK_AT, WINS_AT: WINS_AT, STEP: STEP, KI_PCT: KI_PCT,
    /* 값을 내는 함수 — 순수하다. 세이브를 읽기만 한다 */
    rec: rec, lvFor: lvFor, lvOf: lvOf, mulOf: mulOf, line: line, pairs: pairs, kiPct: kiPct,
    bonus: bonus, partnersOf: partnersOf, progressOf: progressOf,
    /* 세이브가 바뀌는 곳은 여기 둘 */
    tick: tick, onRaidWin: onRaidWin,
    _resetForTest: function () { mark = null; }
  };
})(window);
