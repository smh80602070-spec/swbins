/**
 * 사가나락 2D(아이소) 그림의 사람형 적을 2D 시트(shared/js/mode2d.js)로 그린다 — W-0019.
 * dungeon-view.js 의 drawFoe 가 스탬프 대신 먼저 부른다. 풀이 없거나 아직 안 받았으면 false → 부른 쪽이 기존 스탬프를 그린다.
 * 짐승형은 cfg.mode2d.beast 이름 표(K-0056 짐승 몸, W-0051)에 든 어울리는 적만 그리고 나머지는 false.
 * 관문 구간(tier)으로 풀을 고르고(`DG.cfg.mode2d.pools.t1~t4`), 이름으로 같은 적은 같은 몸을 받는다.
 * 몸 높이는 스탬프의 bodyH(40·s)와 맞춘다 — `bodyH * 1.45 / targetH` 가 배수(시트 몸이 프레임보다 작아 조금 키운다).
 */
(function (global) {
  'use strict';

  /** e = 적, p = 화면 좌표(발 밑 가운데), bodyH = 스탬프 몸 높이(px), now = 시각(ms) */
  var seen = typeof WeakMap === 'function' ? new WeakMap() : { get: function () { return null; }, set: function () {} }, HOLD = 360;   // 적 → { 지난 쿨·공격 시각·피격 시각 }
  function draw(ctx, e, p, bodyH, now) {
    var M = global.DG.mode2d, ref = e && e.ref;
    if (!M || !ref) { return false; }
    var bz = ref.kind === 'beast' ? (M.beastOf ? M.beastOf(ref.name) : null) : null;
    /* W-0129 — 사람형이 아닌 적은 몬스터 2D 시트(K-0090 ③, 몸 id = 초상과 같은 monsterPortrait.idOf). 받기 전·없으면 옛 길 */
    var MP = global.DG.monsterPortrait, cid = ref.kind !== 'human' && MP && MP.idOf ? MP.idOf(ref, !!e.boss) : null, crea = cid && M.creaPool ? M.creaPool(cid) : null;
    if (ref.kind === 'beast' && !bz && !crea) { return false; }
    var pool = crea || (bz ? bz.pool : M.pick('t' + (ref.tier || 1), ref.name));
    if (!pool) { return false; }
    var run = global.DG.dungeon.raw && global.DG.dungeon.raw(), px = run && run.player ? run.player.x : e.x - 1;
    /* W-0122 — 적엔 atkAnim 이 없어(플레이어·동행만 쓴다) 공격 동작이 영영 안 나왔고, 피격은 e.hurt(0.08 에서 시작)를 0.3 기준으로 세어 끝 80ms 만 보였다.
       게임 규칙은 안 건드리고 여기서 본다 — 공격 = 쿨(e.cd)이 다시 차오른 순간부터 HOLD ms, 피격 = e.hurt 가 켜진 순간부터 HOLD ms */
    var st = seen.get(e); if (!st) { st = { cd: e.cd || 0, atk: -1e9, hit: -1e9, hurt: 0 }; seen.set(e, st); }
    if ((e.cd || 0) > st.cd + 0.05) { st.atk = now; }
    if (e.hurt > 0 && !(st.hurt > 0)) { st.hit = now; }
    st.cd = e.cd || 0; st.hurt = e.hurt || 0;
    var clip = now - st.hit < HOLD ? 'hit' : (now - st.atk < HOLD ? 'attack' : (e.aggro ? 'walk' : 'idle'));
    var ms = clip === 'attack' ? now - st.atk : (clip === 'hit' ? now - st.hit : now + (e.phase || 0) * 160);
    var tH = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.targetH) || 40;
    return M.draw(ctx, { pool: pool, clip: clip, facing: px >= e.x ? 1 : -1, ms: ms, x: p.x, y: p.y, scale: bodyH * 1.45 / tH * (bz && !crea ? bz.k : 1) }) || (crea ? draw2(ctx, e, p, bodyH, now, bz, clip, ms, px, tH) : false);
  }

  /** 몬스터 시트를 아직 못 받았을 때 옛 길(짐승 이름 표·사람 풀) — 없으면 false(→ 스탬프) */
  function draw2(ctx, e, p, bodyH, now, bz, clip, ms, px, tH) {
    var M = global.DG.mode2d, ref = e.ref;
    if (ref.kind === 'beast' && !bz) { return false; }
    return M.draw(ctx, { pool: bz ? bz.pool : M.pick('t' + (ref.tier || 1), ref.name), clip: clip, facing: px >= e.x ? 1 : -1, ms: ms, x: p.x, y: p.y, scale: bodyH * 1.45 / tH * (bz ? bz.k : 1) });
  }

  global.DG = global.DG || {};
  global.DG.foe2d = { draw: draw };
})(window);
