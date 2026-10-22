/**
 * 1만리 무리 토벌 한 판 등급 — 첫 타격부터 무리 토벌('clear')까지 S~D (W-0379)
 * ---------------------------------------------------------------
 * 점수식·세기·덤 배율은 공용 shared/js/runrank-core.js(4종횡·2나락과 같은 식). 여기는 1만리 어댑터만.
 *
 *   세는 것   타격(hit — 들판의 hit 는 전부 내 편이 적을 친 것, 장판 틱 'zone'·피해 0 은 연계로 안 셈) ·
 *             피격(hurt dmg > 0 — 동료 누구든) · 처치(kill)
 *   한 판     세기 없을 때 첫 타격이 연다 → 무리·정예·우두머리 토벌(onClear)이 닫는다
 *   버림      전멸(wipe) · 수호자·숨은 터·이야기·인물 토벌 · 맞붙지 않은 채 IDLE_SEC(손잡이 go.rankIdle, 20초)
 *   급(tier)  무리 거리 등급 1~6 → 1~5
 *   덤        그 토벌 금 × S 0.5·A 0.2·B 0.1, S 는 그 토벌 단사만큼 한 번 더
 *   최고      save.goRankBest[무리 종류 plain·elite·boss] = 등급 글자(옛 세이브 없음 = 빈 것)
 *
 * field-combat handle 이 루프 첫 줄에서 onEv(e), 토벌 토스트 뒤에서 onClear(e, 금, 단사) 를 부른다.
 * 결과는 토벌 토스트 바로 다음 토스트 한 줄(새 창 없음 — 들판은 끊기지 않아야).
 */
(function (global) {
  'use strict';

  var K = global.DG && global.DG.runRankCore;
  if (!K) { return; }
  function core() { return global.DG.core; }
  function T(k, d) { var c = core(); return c && c.tuned ? c.tuned(k, d) : d; }
  function IDLE_SEC() { return T('go.rankIdle', 20); }
  var RANKED = { plain: 1, elite: 1, boss: 1 };

  var lastAt = 0, dustNow = 0;
  function bestMap() { var s = core().save; if (!s.goRankBest) { s.goRankBest = {}; } return s.goRankBest; }
  var R = K.make({
    tierOf: function (stg) { return Math.max(1, Math.min(5, (stg && stg.tier) || 1)); },
    bestMap: bestMap,
    bestKey: function (stg) { return stg && RANKED[stg.kind] ? stg.kind : null; },
    payGold: function (n) { var p = core().save.player; p.gold = (p.gold || 0) + n; },
    payS: function () { if (!dustNow) { return ''; } var s = core().save; s.dust = (s.dust || 0) + dustNow; return '✨ 단사 +' + dustNow; },
    now: function () { return Date.now(); }
  });
  function drop() { if (R.state()) { R.finish(null, 0, true); } }   // 세던 것만 버린다(등급·기록·덤 없음)

  /** 사건 하나 — handle 루프 첫 줄 */
  function onEv(e) {
    if (!e) { return; }
    var now = Date.now();
    if (R.state() && now - lastAt > IDLE_SEC() * 1000) { drop(); }   // 들판은 판의 끝이 없다 — 멍하면 버림
    if (e.t === 'hit') {
      if (!(e.dmg > 0) || e.immune) { return; }
      if (!R.state()) { R.start(); }
      lastAt = now;
      if (e.src !== 'zone') { R.onHit(); }
    } else if (e.t === 'hurt') {
      if (e.dmg > 0 && R.state()) { R.onHurt(); lastAt = now; }
    } else if (e.t === 'kill') {
      if (R.state()) { R.onKill(); lastAt = now; }
    } else if (e.t === 'wipe') {
      drop();
    } else if (e.t === 'clear' && !RANKED[e.kind]) {
      drop();                                                        // 수호자·숨은 터·이야기·인물 — 따로 보상이 있다
    }
  }

  /** 무리 토벌 — 'clear' 갈래 토스트 뒤. gold·dust = 그 토벌 금·단사. 등급(없으면 null) */
  function onClear(e, gold, dust) {
    if (!e || !RANKED[e.kind] || !R.state()) { return null; }
    dustNow = dust || 0;
    var r = R.finish({ kind: e.kind, tier: e.tier }, gold, false);
    dustNow = 0;
    if (!r) { return null; }
    var l2 = R.line2(r), msg = R.line(r).replace('이번 판', '토벌') + (l2 ? ' · ' + l2 : '');
    var U = global.DG.ui;
    if (U && U.toast) { U.toast(msg, r.rank === 'S' || r.rank === 'A' ? 'good' : 'info'); }
    var c = core(); if (c && c.log) { c.log(msg, 'battle'); }
    return r;
  }

  global.DG.goRank = { onEv: onEv, onClear: onClear, IDLE_SEC: IDLE_SEC, bestOf: R.bestOf, state: R.state, line: R.line, line2: R.line2 };
})(typeof window !== 'undefined' ? window : this);
