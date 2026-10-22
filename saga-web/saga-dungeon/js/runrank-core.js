/**
 * 한 판 결과 등급 공용 엔진 — S·A·B·C·D (W-0378, 4종횡 W-0104·W-0289 에서 올림)
 * ---------------------------------------------------------------
 * 판마다 "한 판"이 다르다(4종횡 사냥터 · 2나락 던전 한 번). 그래서 엔진은 세기·점수·덤 배율만 갖고,
 * 저장 자리·급·덤 지급은 판 어댑터가 `make(opts)` 로 넘긴다.
 *
 *   세는 것   걸린 시간 · 피격 수(onHurt) · 최대 연계(onHit, 맞으면 0) · 처치 수(onKill)
 *   점수      피격 0→3 · ≤3+(t-1)→2 · ≤8+2(t-1)→1 · 연계 ≥20→3·≥10→2·≥5→1 · 시간 ≤180·360초×(1+0.25(t-1))→2·1 · 처치 ≥15→+1 (합 9)
 *   등급      7 이상 S · 5 이상 A · 3 이상 B · 1 이상 C · 0 은 D · 처치 MIN_KILLS(3) 미만이면 안 매김
 *   덤        살아서 나온 판만 — 판에서 주운 금 × BONUS(S 0.5 · A 0.2 · B 0.1), S 는 판 덤(opts.pay) 하나 더
 *
 * opts = { tierOf(stg) → 1~5, bestMap() → { key: 등급 }, bestKey(stg) → key|null, payGold(n), payS(r) → 글 한 마디|'' , now() }
 * `rankOf` 는 순수 함수다(세이브 안 씀).
 */
(function (global) {
  'use strict';

  var ORDER = ['D', 'C', 'B', 'A', 'S'];
  var BONUS = { S: 0.5, A: 0.2, B: 0.1 };
  var MIN_KILLS = 3;

  /** 통계 → 등급. **순수 함수** — r = { hits, comboMax, sec, kills, tier } */
  function rankOf(r) {
    var hits = r.hits || 0, combo = r.comboMax || 0, sec = r.sec || 0, kills = r.kills || 0;
    var t = Math.max(1, Math.min(5, r.tier || 1)), tm = 1 + 0.25 * (t - 1);
    var pt = (hits === 0 ? 3 : hits <= 3 + (t - 1) ? 2 : hits <= 8 + 2 * (t - 1) ? 1 : 0) +
             (combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0) +
             (sec <= 180 * tm ? 2 : sec <= 360 * tm ? 1 : 0) +
             (kills >= 15 ? 1 : 0);
    var rank = pt >= 7 ? 'S' : pt >= 5 ? 'A' : pt >= 3 ? 'B' : pt >= 1 ? 'C' : 'D';
    return { rank: rank, pt: pt, hits: hits, comboMax: combo, sec: Math.round(sec), kills: kills, tier: t };
  }
  function better(a, b) { return ORDER.indexOf(a) > ORDER.indexOf(b); }
  function fmtSec(s) { var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  function fmtN(n) { var C = global.DG && global.DG.core; return C && C.fmt ? C.fmt(n) : String(n); }

  /** 판 하나의 등급 세기 — 어댑터가 사건에 start·onKill·onHit·onHurt 를 걸고 끝에 finish */
  function make(opts) {
    var cur = null, now = opts.now || function () { return Date.now(); };
    function start() { cur = { t0: now(), hits: 0, combo: 0, comboMax: 0, kills: 0 }; }
    function onKill() { if (cur) { cur.kills++; } }
    function onHit() { if (!cur) { return; } cur.combo++; if (cur.combo > cur.comboMax) { cur.comboMax = cur.combo; } }
    function onHurt() { if (!cur) { return; } cur.hits++; cur.combo = 0; }
    function bestOf(key) { return (opts.bestMap() || {})[key] || null; }
    /** 한 판을 닫는다 — 등급(없으면 null). runGold = 이 판에서 주운 금(덤의 밑), dead = 쓰러져 나온 판(덤 없음) */
    function finish(stg, runGold, dead) {
      if (!cur) { return null; }
      if (cur.kills < MIN_KILLS) { cur = null; return null; }
      var r = rankOf({ hits: cur.hits, comboMax: cur.comboMax, sec: (now() - cur.t0) / 1000, kills: cur.kills, tier: opts.tierOf(stg) });
      cur = null;
      r.bonusGold = 0; r.shard = 0; r.extra = ''; r.best = false; r.dead = !!dead;
      if (!dead) {
        r.bonusGold = Math.round((runGold || 0) * (BONUS[r.rank] || 0));
        if (r.bonusGold) { opts.payGold(r.bonusGold); }
        if (r.rank === 'S' && opts.payS) { r.extra = opts.payS(r) || ''; }
      }
      var key = opts.bestKey(stg), bm = key ? opts.bestMap() : null;
      if (bm) {
        var old = bm[key] || null;
        if (!old || better(r.rank, old)) { bm[key] = r.rank; r.best = true; }
        r.prevBest = old;
      }
      return r;
    }
    /** 카드 한 줄 — "⭐ 이번 판 등급 A — 피격 3 · 콤보 12 · 2:40" */
    function line(r) { return r ? '⭐ 이번 판 등급 ' + r.rank + ' — 피격 ' + r.hits + ' · 콤보 ' + r.comboMax + ' · ' + fmtSec(r.sec) : ''; }
    /** 둘째 줄 — 덤·최고 기록(없으면 빈 글) */
    function line2(r) {
      if (!r) { return ''; }
      var p = [];
      if (r.bonusGold) { p.push('🪙 등급 덤 +' + fmtN(r.bonusGold)); }
      if (r.extra) { p.push(r.extra); }
      if (r.best) { p.push(r.prevBest ? '🏆 최고 기록 ' + r.prevBest + ' → ' + r.rank : '🏆 첫 기록 ' + r.rank); }
      if (r.dead) { p.push('쓰러져 덤 없음'); }
      return p.join(' · ');
    }
    return { start: start, onKill: onKill, onHit: onHit, onHurt: onHurt, finish: finish, line: line, line2: line2, bestOf: bestOf,
      state: function () { return cur; } };
  }

  global.DG = global.DG || {};
  global.DG.runRankCore = { ORDER: ORDER, BONUS: BONUS, MIN_KILLS: MIN_KILLS, rankOf: rankOf, better: better, make: make };
})(typeof window !== 'undefined' ? window : this);
