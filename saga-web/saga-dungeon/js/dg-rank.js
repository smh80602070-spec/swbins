/**
 * 2나락 한 판 결과 등급 — 던전에 들어가서(dungeon:enter) 나올 때까지(dungeon:end leave·dead) S~D (W-0378)
 * ---------------------------------------------------------------
 * 점수식·세기·덤 배율은 공용 shared/js/runrank-core.js(4종횡 W-0289 와 같은 식). 여기는 2나락 어댑터만.
 *
 *   세는 것   타격(dungeon:hit — strike 가 콤보를 올리는 그 줄) · 피격(dungeon:hurt — hurtPlayer 가 실제로 깎은 한 대) · 처치(dungeon:kill)
 *   급(tier)  나온 층 깊이 — 1~4 → 1 · 5~9 → 2 · 10~19 → 3 · 20~39 → 4 · 40~ → 5 (깊을수록 시간·피격을 봐준다)
 *   덤        살아서 나온 판만 — 이번 판에서 챙긴 금(settleLoot) × S 0.5·A 0.2·B 0.1, S 는 💎 보석(최하 등급) 하나 더
 *   최고      save.dgRankBest['f' + 5층 단위] = 등급 글자(옛 세이브 없음 = 빈 것)
 *   안 매김   시련·악몽 부적·난입(floor 0 으로 끝나는 판) — 그 판들은 자기 카드가 따로 있다
 *
 * 결과는 dungeon:end 사건 꾸러미에 e.rank 로 얹는다 — goals.js 카드가 그것을 읽는다(이 파일이 먼저 실려 먼저 듣는다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core, K = global.DG.runRankCore;
  if (!core || !K) { return; }

  function tierOf(floor) { var f = floor || 1; return f < 5 ? 1 : f < 10 ? 2 : f < 20 ? 3 : f < 40 ? 4 : 5; }
  function bestMap() { var s = core.save; if (!s.dgRankBest) { s.dgRankBest = {}; } return s.dgRankBest; }
  function bestKey(floor) { return floor > 0 ? 'f' + (Math.floor((floor - 1) / 5) * 5 + 1) : null; }
  function payS(r) {
    var GD = global.DG.gemData, IT = global.DG.item, gem = GD && GD.GEMS && GD.GEMS[(r.tier - 1) % GD.GEMS.length];
    if (!gem || !IT || !IT.addMat) { return ''; }
    IT.addMat('gem', gem.key, 0, 1); r.gem = gem.key;
    return (gem.emoji || '💎') + ' ' + gem.name + ' +1';
  }
  var R = K.make({ tierOf: tierOf, bestMap: bestMap, bestKey: bestKey, payGold: function (n) { core.save.player.gold += n; }, payS: payS });

  core.on('dungeon:enter', function () { R.start(); });
  core.on('dungeon:kill', R.onKill);
  core.on('dungeon:hit', R.onHit);
  core.on('dungeon:hurt', R.onHurt);
  core.on('dungeon:end', function (e) {
    if (!e) { return; }
    if (e.reason === 'leave' && e.floor > 0) { e.rank = R.finish(e.floor, e.loot ? e.loot.gold : 0, false); }
    else if (e.reason === 'dead' && e.floor > 0) { e.rank = R.finish(e.floor, 0, true); }
    else { R.finish(null, 0, true); }   // 시련·부적·난입 — 세던 것만 버린다(등급·기록 없음)
  });

  /** 끝 카드 두 줄(HTML) — ui.js showGoalsCard 가 부른다 */
  function cardHtml(r) {
    if (!r) { return ''; }
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var l2 = R.line2(r);
    return '<div class="dg-rank"><b>' + esc(R.line(r)) + '</b></div>' + (l2 ? '<div class="dg-rank-2 muted">' + esc(l2) + '</div>' : '');
  }

  global.DG = global.DG || {};
  global.DG.dgRank = { tierOf: tierOf, bestKey: bestKey, bestOf: R.bestOf, start: R.start, onKill: R.onKill, onHit: R.onHit, onHurt: R.onHurt,
    finish: R.finish, line: R.line, line2: R.line2, cardHtml: cardHtml, state: R.state };
})(typeof window !== 'undefined' ? window : this);
