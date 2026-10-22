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
 * W-0378 — 점수식·세기·덤 배율은 공용 shared/js/runrank-core.js(DG.runRankCore). 여기는 4종횡 어댑터(급·저장 자리·기억 조각)만.
 */
(function (global) {
  'use strict';

  var core = global.DG.core, K = global.DG.runRankCore;

  /** 사냥터 급 1~5 — need(레벨 문턱)로 */
  function tierOf(stg) {
    var n = (stg && stg.need) || 1;
    return n < 5 ? 1 : n < 12 ? 2 : n < 25 ? 3 : n < 45 ? 4 : 5;
  }
  function bestMap() {
    var s = core.save; if (!s.side) { return {}; }
    if (!s.side.rankBest) { s.side.rankBest = {}; }
    return s.side.rankBest;
  }
  var R = K.make({
    tierOf: tierOf, bestMap: bestMap,
    bestKey: function (stg) { return stg && stg.key && core.save.side ? stg.key : null; },
    payGold: function (n) { core.save.player.gold += n; },
    payS: function (r) { r.shard = 1; core.save.player.memFrag = (core.save.player.memFrag || 0) + 1; return '🧩 기억 조각 +1'; }
  });

  core.on('side:enter', R.start);
  core.on('side:kill', R.onKill);

  global.DG = global.DG || {};
  global.DG.runRank = { MIN_KILLS: K.MIN_KILLS, ORDER: K.ORDER, BONUS: K.BONUS, tierOf: tierOf, rankOf: K.rankOf, start: R.start, onKill: R.onKill, onHit: R.onHit, onHurt: R.onHurt,
    finish: R.finish, line: R.line, line2: R.line2, bestOf: R.bestOf, state: R.state };
})(window);
