/**
 * 사가고 2D(평면·2.5D) 캔버스의 **인물**(찾아온 인물·마을 사람·나)을 2D 시트(shared/js/mode2d.js)로 그린다 — W-0019.
 * world.js 의 drawSpawn·drawNpc·drawPlayer 가 스탬프 대신 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 같은 인물은 늘 같은 몸을 받는다(`DG.cfg.mode2d.pools.human` 에서 id 해시로). 짐승은 시트에 풀이 없어 기존 스탬프.
 * world.js 는 큰 파일 상한이라 이 코드를 따로 뒀다(world.js 에는 stamp 앞 한 줄만 붙인다).
 */
(function (global) {
  'use strict';

  /** ref = 도감 인물(없으면 key), (x,y) = 발 밑 가운데, s = 스탬프 배율(몸 높이 ≈ 40·s px), o = { facing, moving, phase, now } */
  function human(ctx, ref, key, x, y, s, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick('human', (ref && (ref.id || ref.name)) || key);
    if (!pool) { return false; }
    o = o || {};
    var clip = o.moving ? 'walk' : 'idle';
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    return M.draw(ctx, { pool: pool, clip: clip, facing: o.facing, ms: (o.now || Date.now()) + (o.phase || 0) * 160, x: x, y: y, scale: s * 40 * 1.2 / tH });
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { human: human };
})(window);
