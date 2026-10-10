/**
 * 사가나락 2D(아이소) 그림의 **사람**(내 영웅·동행·마을 사람)을 새 움직이는 그림(shared/js/mode2d.js 한 장 모드, K-0056 정면·옆·뒤 3장)으로 그린다 — W-0042.
 * dungeon-view.js 의 drawPlayer·drawCompanion·drawNpc 가 스탬프 앞에서 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 역할(role)로 풀 표를 고른다: me(내 영웅)·ally(동행)·npc(마을 사람). 같은 인물은 늘 같은 몸을 받는다(id 해시).
 * 몸 높이는 스탬프의 40·s px 에 맞춘다(`s * 40 * 1.2 / targetH` 가 배수 — 사가마을 actor2d 와 같은 식).
 */
(function (global) {
  'use strict';

  /** role = 'me'|'ally'|'npc', ref = 도감 인물, (x,y) = 발 밑 가운데, s = 스탬프 배율, o = { facing(1|-1), walking, now, phase } */
  function draw(ctx, role, ref, x, y, s, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick(role, (ref && (ref.id || ref.name)) || role);
    if (!pool) { return false; }
    o = o || {};
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    var key = role + ':' + ((ref && (ref.id || ref.name)) || ''), ht = M.actT ? M.actT(key + ':hit', o.hurt) : null, at = M.actT ? M.actT(key + ':atk', o.atk) : null;   // W-0073 단계 4
    var ai = at !== null && M.actInfo ? M.actInfo(key + ':atk') : null, atkClip = (o.cast || (ai && ai.dur >= 0.3)) ? 'heavy' : (ai && ai.n % 2 === 0 ? 'attack2' : 'attack');   // 강공격 0.38초·스킬 = heavy, 평타는 연타 번갈아
    var clip = ht !== null ? 'hit' : (at !== null ? atkClip : (o.walking ? 'walk' : 'idle'));
    var TW = global.DG.town, town = role === 'npc' || !!(TW && TW.active && TW.active());   // W-0138 — 마을 사람·마을에 선 나/동행은 맨손 서기·걷기(공격·피격은 그대로)
    return M.draw(ctx, { pool: pool, clip: clip, t: ht !== null ? ht : at, facing: M.face ? M.face(o.dirX, o.dirY, o.facing) : o.facing, dirX: o.dirX, dirY: o.dirY, ms: (o.now || Date.now()) + (o.phase || 0) * 160, x: x, y: y, scale: s * 40 * 1.2 / tH, town: town });
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { draw: draw };
})(window);
