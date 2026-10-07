/**
 * 사냥터 결과 등급 — 한 판이 끝날 때 S·A·B·C (PLAN §5-2 보강, W-0104 · 재미표준 B)
 * ---------------------------------------------------------------
 * 던파의 "한 판 결과 등급" 만 가져왔다. 들어갈 때(`side:enter`) 세기 시작해 나올 때(마을 복귀·쓰러짐)
 * side.js 가 `finish()` 를 불러 세션 카드(got.rank)에 얹는다.
 *
 *   세는 것   걸린 시간 · 피격 수(`onHurt` — side.js hurtMe 가 실제로 깎인 한 대마다) ·
 *             최대 콤보(`onHit` — 내 타격이 적에게 닿을 때마다 +1, 맞으면 0 으로)
 *   점수      피격 0→3·≤3→2·≤8→1 · 콤보 ≥20→3·≥10→2·≥5→1 · 시간 ≤3분→2·≤6분→1 (합 8)
 *   등급      7 이상 S · 5 이상 A · 3 이상 B · 그 밑 C
 *   문턱      MIN_KILLS(3) 마리 못 잡고 나온 판은 등급을 안 매긴다 — 들어갔다 바로 나오면 피격 0·짧은 시간이라 A 가 나왔다
 *
 * `rankOf` 는 순수 함수다. 세이브는 안 쓴다(한 판 안에서만 뜻이 있다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cur = null, MIN_KILLS = 3;

  /** 통계 → 등급. **순수 함수** */
  function rankOf(r) {
    var hits = r.hits || 0, combo = r.comboMax || 0, sec = r.sec || 0;
    var pt = (hits === 0 ? 3 : hits <= 3 ? 2 : hits <= 8 ? 1 : 0) +
             (combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0) +
             (sec <= 180 ? 2 : sec <= 360 ? 1 : 0);
    return { rank: pt >= 7 ? 'S' : pt >= 5 ? 'A' : pt >= 3 ? 'B' : 'C', pt: pt, hits: hits, comboMax: combo, sec: Math.round(sec) };
  }

  function start() { cur = { t0: Date.now(), hits: 0, combo: 0, comboMax: 0, kills: 0 }; }
  function onKill() { if (cur) { cur.kills++; } }
  function onHit() { if (!cur) { return; } cur.combo++; if (cur.combo > cur.comboMax) { cur.comboMax = cur.combo; } }
  function onHurt() { if (!cur) { return; } cur.hits++; cur.combo = 0; }
  /** 한 판을 닫는다 — 등급(없으면 null) */
  function finish() {
    if (!cur) { return null; }
    if (cur.kills < MIN_KILLS) { cur = null; return null; }
    var r = rankOf({ hits: cur.hits, comboMax: cur.comboMax, sec: (Date.now() - cur.t0) / 1000 });
    cur = null;
    return r;
  }
  function fmtSec(s) { var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  /** 세션 카드 한 줄 — "⭐ 이번 판 등급 A — 피격 3 · 콤보 12 · 2:40" */
  function line(r) { return r ? '⭐ 이번 판 등급 ' + r.rank + ' — 피격 ' + r.hits + ' · 콤보 ' + r.comboMax + ' · ' + fmtSec(r.sec) : ''; }

  core.on('side:enter', start);
  core.on('side:kill', onKill);

  global.DG = global.DG || {};
  global.DG.runRank = { MIN_KILLS: MIN_KILLS, rankOf: rankOf, start: start, onKill: onKill, onHit: onHit, onHurt: onHurt, finish: finish, line: line, state: function () { return cur; } };
})(window);
