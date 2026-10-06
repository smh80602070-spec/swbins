/**
 * 사가스토리 2D(옆보기) 사냥터의 **주인공**을 새 움직이는 그림(shared/js/mode2d.js 한 장 모드, K-0056 정면·옆·뒤 3장)으로 그린다 — W-0041.
 * side-view.js 의 drawMe 가 스탬프 앞에서 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 같은 인물은 늘 같은 몸을 받는다(`DG.cfg.mode2d.pools.me` 에서 id 해시로). 몸 높이는 충돌 상자(P_H)에 맞춘다.
 */
(function (global) {
  'use strict';

  /** ref = 내 인물(도감), (x,y) = 발 밑 가운데, h = 몸 높이(px), o = { facing(1|-1), walking, now } */
  function me(ctx, ref, x, y, h, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick('me', (ref && (ref.id || ref.name)) || 'me');
    if (!pool) { return false; }
    o = o || {};
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 62;
    var ht = M.actT ? M.actT('me:hit', o.hurt) : null, at = M.actT ? M.actT('me:atk', o.atk) : null;   // W-0073 단계 4 — 맞음 > 공격 > 걷기 > 서기
    return M.draw(ctx, { pool: pool, clip: ht !== null ? 'hit' : (at !== null ? 'attack' : (o.walking ? 'walk' : 'idle')), t: ht !== null ? ht : at, facing: o.facing, ms: o.now || Date.now(), x: x, y: y, scale: h / tH });
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { me: me };
})(window);
