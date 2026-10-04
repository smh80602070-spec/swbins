/**
 * RTS 그림 연결 (W-0043) — 이미 있는 2D 에셋(타일 `realm_*`·건물 `world2d`·인물 `moving` 한 장 모드)을 RTS 격자 화면에 얹는다.
 * 에셋은 만들지도 고치지도 않는다(없는 것은 K-0061 요청). 그림이 없거나 아직 받는 중이면 모두 false → view.js 가 옛 색 칸·이모지 원을 그린다.
 * 좌표: ox,oy = 타일 (0,0) 의 화면 좌표, z = 한 타일의 화면 px.
 */
(function (global) {
  'use strict';

  function M() { return global.DG && global.DG.mode2d; }

  /** 땅 종류 → 타일(0 풀·1 숲·2 언덕·3 물). 숲은 풀 위에 어두운 초록을 얹는다 */
  var TERRAIN = { 0: 'realm_grass', 1: 'realm_grass', 2: 'realm_stone', 3: 'realm_water' };
  var ROAD = 'realm_dirt';
  var PER = { realm_grass: 2, realm_water: 3, realm_stone: 5, realm_dirt: 2 };   // 타일 이미지(64px) 한 장이 덮는 칸 수 — 작을수록 또렷하다(돌은 판처럼 보여 크게 늘린다)

  /** 건물 → { id: world2d 스프라이트, k: 그리는 높이 = k × 긴 변(타일) } */
  var BUILDINGS = {
    castle: { id: 'chinese_hall_01', k: 1.25 },
    stronghold: { id: 'dungeon_gate_01', k: 1.25 },
    house: { id: 'forest_cottage_01', k: 1.3 },
    farm: { id: 'barn_01', k: 1.15 },
    market: { id: 'market_stall_01', k: 1.3 },
    workshop: { id: 'inn_01', k: 1.25 },
    barracks: { id: 'tent_large_01', k: 1.35 },
    well: { id: 'well_01', k: 1.2 },
    tower: { id: 'stone_tower_01', k: 2.4 },
    wall: { id: 'wall_piece_01', k: 1.1 }
  };

  /** 유닛 → 몸(한 장 모드 풀) — 영웅은 장수 id 해시로 hero_m/hero_f, 기병은 지금은 보병 몸(전용 그림은 K-0061 요청) */
  var UNIT_POOL = { soldier: 'companion_warrior', archer: 'companion_archer', cavalry: 'companion_warrior' };
  var HERO_POOLS = ['hero_m', 'hero_f'];
  var BODY_TILES = { soldier: 1.7, archer: 1.7, cavalry: 1.9, hero: 2.1 };

  function poolOf(u) {
    if (u.t === 'hero') { return HERO_POOLS[M() ? M().hashOf(u.hid || u.id) % HERO_POOLS.length : 0]; }
    return UNIT_POOL[u.t] || null;
  }

  /** 타일 이미지로 칸 모음을 채운다 — rects = [[x,y](칸 좌표)…], 그림이 칸 좌표에 맞게 이어진다. 못 그리면 false */
  function fillTiles(ctx, id, rects, ox, oy, z) {
    var m = M(), pat = m && m.tilePattern ? m.tilePattern(ctx, id) : null, i;
    if (!pat || !rects.length) { return !!pat; }
    var s = (PER[id] || 2) / 64;
    if (pat.setTransform && global.DOMMatrix) { pat.setTransform(new global.DOMMatrix([s, 0, 0, s, 0, 0])); }
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(z, z);
    ctx.fillStyle = pat;
    ctx.beginPath();
    for (i = 0; i < rects.length; i++) { ctx.rect(rects[i][0], rects[i][1], 1.03, 1.03); }   // 모서리 틈이 안 보이게 살짝 겹친다
    ctx.fill();
    ctx.restore();
    return true;
  }

  function tint(ctx, rects, color, ox, oy, z) {
    if (!rects.length) { return; }
    ctx.save(); ctx.translate(ox, oy); ctx.scale(z, z); ctx.fillStyle = color; ctx.beginPath();
    rects.forEach(function (r) { ctx.rect(r[0], r[1], 1.03, 1.03); });
    ctx.fill(); ctx.restore();
  }

  /** 보이는 칸의 땅을 그린다 — 네 종류 타일이 모두 받아졌을 때만(하나라도 없으면 false → 옛 색 칸) */
  function terrain(ctx, tiles, g, x0, x1, y0, y1, ox, oy, z) {
    var m = M(), t, x, y, groups = { 0: [], 1: [], 2: [], 3: [] };
    if (!m || !m.tilePattern) { return false; }
    for (t in TERRAIN) { if (!m.tilePattern(ctx, TERRAIN[t])) { return false; } }
    for (y = y0; y <= y1; y++) { for (x = x0; x <= x1; x++) { groups[tiles[g.idx(x, y)]].push([x, y]); } }
    for (t in groups) { fillTiles(ctx, TERRAIN[t], groups[t], ox, oy, z); }
    tint(ctx, groups[1], 'rgba(18,58,24,.42)', ox, oy, z);   // 숲 — 어두운 초록 덮개
    tint(ctx, groups[2], 'rgba(70,62,52,.34)', ox, oy, z);   // 언덕 — 흙빛 덮개(돌 타일이 판처럼 보이는 것을 눌러 준다)
    return true;
  }

  /** 도로 칸들을 흙길 타일로 — 못 그리면 false */
  function roads(ctx, rects, ox, oy, z) { return fillTiles(ctx, ROAD, rects, ox, oy, z); }

  /** 이 건물은 그림이 준비됐나(받은 뒤에만 색 칸을 건너뛴다) */
  function spriteReady(type) { var d = BUILDINGS[type], m = M(); return !!(d && m && m.spriteReady && m.spriteReady(d.id)); }

  /** 건물 그림을 y 순으로 그린다(아래쪽이 위에 겹치게). list = [{ b, d(건물 표 항목), x, y(화면 좌상단) }]. 그린 수 */
  function sprites(ctx, list, z) {
    var m = M(), n = 0, i, e, spec;
    if (!m || !m.drawSprite) { return 0; }
    list.sort(function (a, b) { return (a.b.y + a.d.h) - (b.b.y + b.d.h); });
    for (i = 0; i < list.length; i++) {
      e = list[i]; spec = BUILDINGS[e.b.t];
      if (!spec) { continue; }
      if (m.drawSprite(ctx, { id: spec.id, x: e.x + e.d.w * z / 2, y: e.y + e.d.h * z * 0.94, h: spec.k * Math.max(e.d.w, e.d.h) * z })) { n++; }
    }
    return n;
  }

  /** 유닛 하나를 그린다 — u, p(화면 좌표 = 발 밑), z. 그림이 없으면 false(→ 색 원) */
  function unit(ctx, u, p, z, now) {
    var m = M(), pool = poolOf(u), clip, ms;
    if (!m || !pool || !m.draw) { return false; }
    clip = (u.cd | 0) >= 7 ? 'attack' : ((u.path && u.path.length) ? 'walk' : 'idle');
    ms = clip === 'attack' ? (10 - (u.cd | 0)) * 100 : now + (u.id | 0) * 137;
    return m.draw(ctx, { pool: pool, clip: clip, facing: u.face || (u.team === 1 ? -1 : 1), ms: ms, x: p.x, y: p.y + z * 0.35, scale: (BODY_TILES[u.t] || 1.7) * z / 62 });
  }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.art = { TERRAIN: TERRAIN, BUILDINGS: BUILDINGS, UNIT_POOL: UNIT_POOL, HERO_POOLS: HERO_POOLS, poolOf: poolOf, terrain: terrain, roads: roads, spriteReady: spriteReady, sprites: sprites, unit: unit };
})(typeof window !== 'undefined' ? window : this);
