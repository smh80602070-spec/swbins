/**
 * 사가종횡 2D(옆보기) 사냥터의 **주인공**을 새 움직이는 그림(shared/js/mode2d.js 한 장 모드, K-0056 정면·옆·뒤 3장)으로 그린다 — W-0041.
 * side-view.js 의 drawMe 가 스탬프 앞에서 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 같은 인물은 늘 같은 몸을 받는다(`DG.cfg.mode2d.pools.me` 에서 id 해시로). 몸 높이는 충돌 상자(P_H)에 맞춘다.
 */
(function (global) {
  'use strict';

  /** W-0296 공중 몸짓 — 오르는 중 jump · 내려오는 중 fall, 진행률 t(0..1)는 그 상태로 머문 시간 / AIR_MS. 땅에 서면 null(→ 걷기·서기). 순수에 가깝다(시각만 받는다) */
  var AIR_MS = 420, airSt = { clip: null, at: 0 };
  function airClip(air, vy, now) {
    if (!air) { airSt.clip = null; return null; }
    var c = (vy || 0) < 0 ? 'jump' : 'fall';
    if (airSt.clip !== c) { airSt.clip = c; airSt.at = now; }
    return { clip: c, t: Math.min(1, Math.max(0, (now - airSt.at) / AIR_MS)) };
  }

  /** ref = 내 인물(도감), (x,y) = 발 밑 가운데, h = 몸 높이(px), o = { facing(1|-1), walking, now, wx, wy, ppu(W-0203 보폭), air(공중), vy(세로 속도 — 음수 = 오름) } */
  function me(ctx, ref, x, y, h, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick('me', (ref && (ref.id || ref.name)) || 'me');
    if (!pool) { return false; }
    o = o || {};
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 62;
    var ht = M.actT ? M.actT('me:hit', o.hurt) : null, at = M.actT ? M.actT('me:atk', o.atk) : null;   // W-0073 단계 4 — 맞음 > 공격 > 공중 > 걷기 > 서기 · W-0445 무기 종류(look.weapon)를 넘겨 컷아웃이 무기별 공격(팩)
    var now = o.now || Date.now(), ac = airClip(o.air, o.vy, now), clip = ht !== null ? 'hit' : (at !== null ? 'attack' : (ac ? ac.clip : (o.walking ? 'walk' : 'idle')));
    return M.draw(ctx, { pool: pool, clip: clip, t: ht !== null ? ht : (at !== null ? at : (ac ? ac.t : null)), facing: o.facing, weapon: ref && ref.look ? ref.look.weapon : null, ms: o.now || Date.now(), x: x, y: y, scale: h / tH, stride: (o.wx != null && M.pace) ? M.pace('me', o.wx, o.wy, o.ppu, h, o.now || Date.now()) : null });
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { me: me, airClip: airClip, AIR_MS: AIR_MS };
})(window);
