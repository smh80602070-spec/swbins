/**
 * 사가마을 2D(구면 투영) 마을 그림의 **사람**(주민·방문객·나)을 2D 시트(shared/js/mode2d.js)로 그린다 — W-0019.
 * village-view.js 의 drawResident·drawNpc·drawMe·drawMeIn 이 스탬프 대신 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 역할(role)로 풀 표를 고른다: adult(어른 주민·방문객)·kid(아이)·me(나). 같은 사람은 늘 같은 몸을 받는다(id 해시).
 * village-view.js 는 큰 파일 상한이라 이 코드를 따로 뒀다(조각에는 stamp 앞 한 줄씩만 붙인다).
 */
(function (global) {
  'use strict';

  /** 풀 고르는 씨앗 — 순수. 나(me)의 ref.id 는 '<인물>#<차림>'(wear.sig — 옛 스탬프 캐시 열쇠)라 그대로 넘기면 제 시트를 못 찾고
   *  빌린 몸 + 옷 색 칸으로 갔다(W-0190: 주인공이 한 색 실루엣). 3D(village-view3d buildPlayer)처럼 인물 id 로 고른다 */
  function seedOf(role, ref, key) {
    var id = (ref && (ref.id || ref.name)) || key || role;
    return role === 'me' ? String(id).split('#')[0] || role : id;
  }

  /** role = 'adult'|'kid'|'me', ref = 도감 인물({id}), (x,y) = 발 밑 가운데, s = 스탬프 배율(몸 높이 ≈ 40·s px), o = { facing, moving, phase, now, wx, wy, ppu, pk(W-0203 보폭) } */
  function draw(ctx, role, ref, key, x, y, s, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick(role, seedOf(role, ref, key));
    if (!pool) { return false; }
    o = o || {};
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40, P3 = global.DG.pose3d, V = global.DG.village;
    var pose = role === 'me' && P3 ? ((V && V.fishState && V.fishState()) ? 'Pose_fish' : P3.life(P3.st2d || (P3.st2d = {}), (o.now || Date.now()) / 1000, !o.moving)) : null;   // W-0303 2D 대역 — 낚시 대기·쉬기
    return M.draw(ctx, { pool: pool, clip: o.moving ? 'walk' : 'idle', pose: pose, facing: M.face ? M.face(o.dirX, o.dirY, o.facing) : o.facing, dirX: o.dirX, dirY: o.dirY, ms: (o.now || Date.now()) + (o.phase || 0) * 160, x: x, y: y, scale: s * 40 * 1.2 / tH, town: true, stride: (o.wx != null && M.pace) ? M.pace(o.pk || key || role + ':' + seedOf(role, ref, key), o.wx, o.wy, o.ppu, s * 48, o.now || Date.now()) : null });   // W-0138 — 마을은 싸움이 없다: 맨손 서기·걷기 시트
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { draw: draw, seedOf: seedOf };
})(window);
