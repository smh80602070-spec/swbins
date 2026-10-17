/**
 * 사냥터 결과 등급 — 한 판이 끝날 때 S·A·B·C·D (PLAN §5-2 보강, W-0104 → W-0289 넓힘)
 * ---------------------------------------------------------------
 * 던파의 "한 판 결과 등급" 구조만 가져왔다. 들어갈 때(`side:enter`) 세기 시작해 나올 때(마을 복귀·쓰러짐)
 * side.js 가 `finish(stage, runGold, dead)` 를 불러 세션 카드(got.rank)에 얹는다.
 *
 *   세는 것   걸린 시간 · 피격 수(`onHurt` — hurtMe 가 실제로 깎인 한 대마다) · 최대 연계(`onHit` — 내 타격이 닿을 때마다 +1, 맞으면 0) · 처치 수(`side:kill`)
 *   급(tier)  사냥터 need(레벨 문턱)로 1~5 — 깊은 곳일수록 시간은 길게 봐주고 피격도 한두 대 더 봐준다
 *   점수      피격 0→3 · ≤3+(t-1)→2 · ≤8+2(t-1)→1 · 연계 ≥20→3·≥10→2·≥5→1 · 시간 ≤180·360초×(1+0.25(t-1))→2·1 · 처치 ≥15→+1 (합 9)
 *   등급      7 이상 S · 5 이상 A · 3 이상 B · 1 이상 C · 0 은 D
 *   문턱      MIN_KILLS(3) 마리 못 잡고 나온 판은 등급을 안 매긴다 — 들어갔다 바로 나오면 피격 0·짧은 시간이라 A 가 나왔다
 *   덤        살아서 나온 판만 — S 금 ×1.5(판에서 주운 금의 절반을 더) + 🧩 기억 조각 1 · A ×1.2 · B ×1.1 · C·D 없음
 *   최고      save.side.rankBest[사냥터 key] = 등급 글자(옛 세이브 없음 = 빈 것). 갱신이면 카드에 "최고 기록"
 *
 * `rankOf` 는 순수 함수다(세이브 안 씀). 덤·최고 기록만 finish 가 세이브에 쓴다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cur = null, MIN_KILLS = 3;
  var ORDER = ['D', 'C', 'B', 'A', 'S'];
  var BONUS = { S: 0.5, A: 0.2, B: 0.1 };
  var SHARD_ON_S = 1;

  /** 사냥터 급 1~5 — need(레벨 문턱)로 */
  function tierOf(stg) {
    var n = (stg && stg.need) || 1;
    return n < 5 ? 1 : n < 12 ? 2 : n < 25 ? 3 : n < 45 ? 4 : 5;
  }

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

  function start() { cur = { t0: Date.now(), hits: 0, combo: 0, comboMax: 0, kills: 0 }; }
  function onKill() { if (cur) { cur.kills++; } }
  function onHit() { if (!cur) { return; } cur.combo++; if (cur.combo > cur.comboMax) { cur.comboMax = cur.combo; } }
  function onHurt() { if (!cur) { return; } cur.hits++; cur.combo = 0; }

  function bestMap() {
    var s = core.save; if (!s.side) { return {}; }
    if (!s.side.rankBest) { s.side.rankBest = {}; }
    return s.side.rankBest;
  }
  function bestOf(stageKey) { return bestMap()[stageKey] || null; }
  function better(a, b) { return ORDER.indexOf(a) > ORDER.indexOf(b); }

  /**
   * 한 판을 닫는다 — 등급(없으면 null).
   * @param stg     사냥터(key·need) — 없으면 급 1·최고 기록 안 남김
   * @param runGold 이 판에서 주운 금(덤의 밑)
   * @param dead    쓰러져 나온 판이면 덤 없음(등급은 매긴다)
   */
  function finish(stg, runGold, dead) {
    if (!cur) { return null; }
    if (cur.kills < MIN_KILLS) { cur = null; return null; }
    var r = rankOf({ hits: cur.hits, comboMax: cur.comboMax, sec: (Date.now() - cur.t0) / 1000, kills: cur.kills, tier: tierOf(stg) });
    cur = null;
    r.bonusGold = 0; r.shard = 0; r.best = false; r.dead = !!dead;
    if (!dead) {
      var mul = BONUS[r.rank] || 0;
      r.bonusGold = Math.round((runGold || 0) * mul);
      if (r.rank === 'S') { r.shard = SHARD_ON_S; }
      if (r.bonusGold) { core.save.player.gold += r.bonusGold; }
      if (r.shard) { core.save.player.memFrag = (core.save.player.memFrag || 0) + r.shard; }
    }
    if (stg && stg.key && core.save.side) {
      var bm = bestMap(), old = bm[stg.key] || null;
      if (!old || better(r.rank, old)) { bm[stg.key] = r.rank; r.best = true; }
      r.prevBest = old;
    }
    return r;
  }

  function fmtSec(s) { var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  /** 세션 카드 한 줄 — "⭐ 이번 판 등급 A — 피격 3 · 콤보 12 · 2:40" */
  function line(r) { return r ? '⭐ 이번 판 등급 ' + r.rank + ' — 피격 ' + r.hits + ' · 콤보 ' + r.comboMax + ' · ' + fmtSec(r.sec) : ''; }
  /** 둘째 줄 — 덤·최고 기록(없으면 빈 글) */
  function line2(r) {
    if (!r) { return ''; }
    var p = [];
    if (r.bonusGold) { p.push('🪙 등급 덤 +' + core.fmt(r.bonusGold)); }
    if (r.shard) { p.push('🧩 기억 조각 +' + r.shard); }
    if (r.best) { p.push(r.prevBest ? '🏆 최고 기록 ' + r.prevBest + ' → ' + r.rank : '🏆 첫 기록 ' + r.rank); }
    if (r.dead) { p.push('쓰러져 덤 없음'); }
    return p.join(' · ');
  }

  core.on('side:enter', start);
  core.on('side:kill', onKill);

  global.DG = global.DG || {};
  global.DG.runRank = { MIN_KILLS: MIN_KILLS, ORDER: ORDER, BONUS: BONUS, tierOf: tierOf, rankOf: rankOf, start: start, onKill: onKill, onHit: onHit, onHurt: onHurt,
    finish: finish, line: line, line2: line2, bestOf: bestOf, state: function () { return cur; } };
})(window);
