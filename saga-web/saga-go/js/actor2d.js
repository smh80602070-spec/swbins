/**
 * 사가만리 2D(평면·2.5D) 캔버스의 **인물**(찾아온 인물·마을 사람·나)을 2D 시트(shared/js/mode2d.js)로 그린다 — W-0019.
 * world.js 의 drawSpawn·drawNpc·drawPlayer 가 스탬프 대신 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 같은 인물은 늘 같은 몸을 받는다(`DG.cfg.mode2d.pools.human` 에서 id 해시로). 짐승은 시트에 풀이 없어 기존 스탬프.
 * world.js 는 큰 파일 상한이라 이 코드를 따로 뒀다(world.js 에는 stamp 앞 한 줄만 붙인다).
 */
(function (global) {
  'use strict';

  /** ref = 도감 인물(없으면 key), (x,y) = 발 밑 가운데, s = 스탬프 배율(몸 높이 ≈ 40·s px), o = { facing, moving, phase, now, wx, wy, ppu, pk(W-0203 보폭 — 세계 좌표·화면 px/단위·배우 열쇠) } */
  function human(ctx, ref, key, x, y, s, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick(key === 'player' ? 'me' : 'human', (ref && (ref.id || ref.name)) || key);   // 나(player)는 주인공 몸(hero_m/f), 나머지 인물은 마을 사람 몸
    if (!pool) { return false; }
    o = o || {};
    var P3 = global.DG.pose3d, FSs = key === 'player' && global.DG.fishing && global.DG.fishing.state ? global.DG.fishing.state().state : null, pose = key === 'player' && P3 ? ((FSs === 'wait' || FSs === 'nibble') ? 'Pose_fish' : P3.life(P3.st2d || (P3.st2d = {}), (o.now || Date.now()) / 1000, !o.moving)) : null;   // W-0303 2D 대역 — 낚시 대기·쉬기(K 동작 시트 전)
    var clip = o.moving ? 'walk' : 'idle', act = key === 'player' && global.DG.fieldCombat && global.DG.fieldCombat.anim2d ? global.DG.fieldCombat.anim2d('me') : null, actT = null;
    /* W-0224 — 들판 전투 몸짓: 맞음 → hit · 강공격·필살·낙하 → heavy · 평타 → attack/attack2 번갈아(2나락 actor2d 와 같은 꼴). 진행도는 mode2d.actT(남은 초) */
    if (act && M.actT) { var ak = 'me:' + (act.clip === 'hit' ? 'hit' : 'atk'); actT = M.actT(ak, act.left); var ai = M.actInfo ? M.actInfo(ak) : null; clip = act.clip === 'hit' ? 'hit' : (act.clip === 'heavy' || act.clip === 'cast' ? act.clip : (ai && ai.n % 2 === 0 ? 'attack2' : 'attack')); }
    else if (key === 'player' && M.actT) { M.actT('me:atk', 0); M.actT('me:hit', 0); }
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    var drawn = M.draw(ctx, { pool: pool, clip: clip, t: actT, facing: M.face ? M.face(o.dirX, o.dirY, o.facing) : o.facing, dirX: o.dirX, dirY: o.dirY, ms: (o.now || Date.now()) + (o.phase || 0) * 160, x: x, y: y, scale: s * 40 * 1.2 / tH, stride: (o.wx != null && M.pace) ? M.pace(o.pk || key || pool, o.wx, o.wy, o.ppu, s * 48 * (global.DG.field2d && global.DG.field2d.strideMul ? global.DG.field2d.strideMul() : 1), o.now || Date.now()) : null, pose: act ? null : pose });
    if (drawn && key === 'player') { rankStars(ctx, ref, x, y, s); }
    return drawn;
  }

  /** W-0237 승급 별 — 2D 의 나(선두) 머리 위에 승급 1~5 만큼 금빛 ★(3D 는 발밑 금테). 읽기만(save.heroes) */
  function rankStars(ctx, ref, x, y, s) {
    var C = global.DG.core, hs = C && C.save && C.save.heroes, g = ref && ref.id && hs ? hs[ref.id] : null, rk = g ? Math.max(0, Math.min(5, g.rank | 0)) : 0;
    if (!rk) { return 0; }
    ctx.save(); ctx.font = 'bold ' + Math.round(Math.max(10, s * 6)) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#e8c25a';
    var t = new Array(rk + 1).join('★'), ty = y - s * 48 * 1.12; ctx.strokeText(t, x, ty); ctx.fillText(t, x, ty); ctx.restore();
    return rk;
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { human: human, rankStars: rankStars };
})(window);
