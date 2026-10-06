/**
 * 사가의숲 2D(구면 투영) 마을 그림의 **사람**(주민·방문객·나)을 2D 시트(shared/js/mode2d.js)로 그린다 — W-0019.
 * village-view.js 의 drawResident·drawNpc·drawMe·drawMeIn 이 스탬프 대신 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 역할(role)로 풀 표를 고른다: adult(어른 주민·방문객)·kid(아이)·me(나). 같은 사람은 늘 같은 몸을 받는다(id 해시).
 * village-view.js 는 큰 파일 상한이라 이 코드를 따로 뒀다(조각에는 stamp 앞 한 줄씩만 붙인다).
 */
(function (global) {
  'use strict';

  /** role = 'adult'|'kid'|'me', ref = 도감 인물({id}), (x,y) = 발 밑 가운데, s = 스탬프 배율(몸 높이 ≈ 40·s px), o = { facing, moving, phase, now } */
  function draw(ctx, role, ref, key, x, y, s, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick(role, (ref && (ref.id || ref.name)) || key || role);
    if (!pool) { return false; }
    o = o || {};
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    return M.draw(ctx, { pool: pool, clip: o.moving ? 'walk' : 'idle', facing: M.face ? M.face(o.dirX, o.dirY, o.facing) : o.facing, dirX: o.dirX, dirY: o.dirY, ms: (o.now || Date.now()) + (o.phase || 0) * 160, x: x, y: y, scale: s * 40 * 1.2 / tH });
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { draw: draw };
})(window);
