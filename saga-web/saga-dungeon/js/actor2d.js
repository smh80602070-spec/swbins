/**
 * 사가나락 2D(아이소) 그림의 **사람**(내 영웅·동행·마을 사람)을 새 움직이는 그림(shared/js/mode2d.js 한 장 모드, K-0056 정면·옆·뒤 3장)으로 그린다 — W-0042.
 * dungeon-view.js 의 drawPlayer·drawCompanion·drawNpc 가 스탬프 앞에서 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 역할(role)로 풀 표를 고른다: me(내 영웅)·ally(동행)·npc(마을 사람). 같은 인물은 늘 같은 몸을 받는다(id 해시).
 * 몸 높이는 스탬프의 40·s px 에 맞춘다(`s * 40 * 1.2 / targetH` 가 배수 — 사가마을 actor2d 와 같은 식).
 */
(function (global) {
  'use strict';

  var MOUNT_K = { mt_dragon: 1.8 };   // 사람 키 1 로 본 탈것 높이(말·학 1.3 — 공용 표 horse) · W-0497

  /** role = 'me'|'ally'|'npc', ref = 도감 인물, (x,y) = 발 밑 가운데, s = 스탬프 배율, o = { facing(1|-1), walking, now, phase, wx, wy, ppu, pk(W-0203 보폭) } */
  function draw(ctx, role, ref, x, y, s, o) {
    var M = global.DG.mode2d;
    if (!M) { return false; }
    var pool = M.pick(role, (ref && (ref.id || ref.name)) || role);
    if (!pool) { return false; }
    o = o || {};
    var MT = global.DG.mount, mt = role === 'me' && !o.mounted && MT && MT.current ? MT.current() : null, C0 = global.DG.core;
    if (mt && C0 && C0.tuned && +C0.tuned('mount2d.on', 1) > 0) {   // W-0497 탈것 — 탈것 풀(mt_*)을 먼저 그리고 주인공을 안장 높이에 얹는다(내리면 이 길을 안 탄다)
      var tH0 = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40, hs = s * 40 * 1.2 / tH0, big = MOUNT_K[mt.id] || 1.3, hp = hs * tH0, fl = mt.kind === 'fly' ? hp * 0.6 : 0, ms0 = (o.now || Date.now()) + (o.phase || 0) * 160;
      if (M.draw(ctx, { pool: mt.id, clip: o.walking ? 'walk' : 'idle', facing: M.face ? M.face(o.dirX, o.dirY, o.facing) : o.facing, dirX: o.dirX, dirY: o.dirY, ms: ms0, x: x, y: y - fl, scale: hs * big })) {
        var o2 = {}, k2; for (k2 in o) { if (o.hasOwnProperty(k2)) { o2[k2] = o[k2]; } }
        o2.mounted = true; o2.walking = false; o2.wx = null;   // 말 위에선 다리를 걷지 않는다(앉기 시트가 없어 서기로)
        return draw(ctx, role, ref, x, y - fl - hp * big * 0.42 + hp * 0.05, s, o2);
      }
    } if (+(global.DG.core && global.DG.core.tuned ? global.DG.core.tuned("dg.footSink", 1) : 1) > 0) { y += 2.4 * s; }   // 10-29 발이 그림자 위로 떠 보인다(사용자) — 발 밑 가운데 기준을 몸 높이 5% 아래로(dg.footSink 0 = 옛)
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    var key = role + ':' + ((ref && (ref.id || ref.name)) || ''), ht = M.actT ? M.actT(key + ':hit', o.hurt) : null, at = M.actT ? M.actT(key + ':atk', o.atk) : null;   // W-0073 단계 4
    var ai = at !== null && M.actInfo ? M.actInfo(key + ':atk') : null, atkClip = (o.cast || (ai && ai.dur >= 0.3)) ? 'heavy' : (ai && ai.n % 2 === 0 ? 'attack2' : 'attack');   // 강공격 0.38초·스킬 = heavy, 평타는 연타 번갈아
    var clip = ht !== null ? 'hit' : (at !== null ? atkClip : (o.walking ? 'walk' : 'idle'));
    var TW = global.DG.town, town = role === 'npc' || !!(TW && TW.active && TW.active());   // W-0138 — 마을 사람·마을에 선 나/동행은 맨손 서기·걷기(공격·피격은 그대로)
    var wl = null, eqp, wb; if (!town && role !== 'npc' && ref && ref.id && global.DG.item && global.DG.item.equipped) { eqp = global.DG.item.equipped(ref.id).weapon; wb = eqp && !global.DG.item.isBroken(eqp) ? global.DG.item.baseOf(eqp) : null; wl = wb ? ({ staff: 'staff', gauntlet: 'fist' })[wb.look] || null : null; }   // K-0205 든 무기 → 공격 시트(staff·fist), 그 밖은 기본 attack
    return M.draw(ctx, { pool: pool, clip: clip, wpn: wl, t: ht !== null ? ht : at, facing: M.face ? M.face(o.dirX, o.dirY, o.facing) : o.facing, dirX: o.dirX, dirY: o.dirY, ms: (o.now || Date.now()) + (o.phase || 0) * 160, x: x, y: y, scale: s * 40 * 1.2 / tH, town: town, stride: (o.wx != null && M.pace) ? M.pace(o.pk || key, o.wx, o.wy, o.ppu, s * 48, o.now || Date.now()) : null });
  }

  global.DG = global.DG || {};
  global.DG.actor2d = { draw: draw };
})(window);
