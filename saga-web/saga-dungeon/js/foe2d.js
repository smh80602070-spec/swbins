/**
 * 사가블로 2D(아이소) 그림의 사람형 적을 2D 시트(shared/js/mode2d.js)로 그린다 — W-0019.
 * dungeon-view.js 의 drawFoe 가 스탬프 대신 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 짐승형은 cfg.mode2d.beast 이름 표(K-0056 짐승 몸, W-0051)에 든 어울리는 적만 그리고 나머지는 false.
 * 관문 구간(tier)으로 풀을 고르고(`DG.cfg.mode2d.pools.t1~t4`), 이름으로 같은 적은 같은 몸을 받는다.
 * 몸 높이는 스탬프의 bodyH(40·s)와 맞춘다 — `bodyH * 1.45 / targetH` 가 배수(시트 몸이 프레임보다 작아 조금 키운다).
 */
(function (global) {
  'use strict';

  /** e = 적, p = 화면 좌표(발 밑 가운데), bodyH = 스탬프 몸 높이(px), now = 시각(ms) */
  function draw(ctx, e, p, bodyH, now) {
    var M = global.DG.mode2d, ref = e && e.ref;
    if (!M || !ref) { return false; }
    var bz = ref.kind === 'beast' ? (M.beastOf ? M.beastOf(ref.name) : null) : null;
    if (ref.kind === 'beast' && !bz) { return false; }
    var pool = bz ? bz.pool : M.pick('t' + (ref.tier || 1), ref.name);
    if (!pool) { return false; }
    var run = global.DG.dungeon.raw && global.DG.dungeon.raw(), px = run && run.player ? run.player.x : e.x - 1;
    var clip = e.hurt > 0 ? 'hit' : (e.atkAnim > 0 ? 'attack' : (e.aggro ? 'walk' : 'idle'));
    var ms = clip === 'attack' ? Math.max(0, 0.3 - e.atkAnim) * 1000 : (clip === 'hit' ? Math.max(0, 0.3 - e.hurt) * 1000 : now + (e.phase || 0) * 160);
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    return M.draw(ctx, { pool: pool, clip: clip, facing: px >= e.x ? 1 : -1, ms: ms, x: p.x, y: p.y, scale: bodyH * 1.45 / tH * (bz ? bz.k : 1) });
  }

  global.DG = global.DG || {};
  global.DG.foe2d = { draw: draw };
})(window);
