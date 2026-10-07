/**
 * RTS 그림 연결 (W-0043) — 이미 있는 2D 에셋(타일 `realm_*`·건물 `world2d`·인물 `moving` 한 장 모드)을 RTS 격자 화면에 얹는다.
 * 에셋은 만들지도 고치지도 않는다(없는 것은 K-0061 요청). 그림이 없거나 아직 받는 중이면 모두 false → view.js 가 옛 색 칸·이모지 원을 그린다.
 * 좌표: ox,oy = 타일 (0,0) 의 화면 좌표, z = 한 타일의 화면 px.
 */
(function (global) {
  'use strict';

  function M() { return global.DG && global.DG.mode2d; }

  /** 땅 종류 → 타일(0 풀·1 숲·2 언덕·3 물). 숲은 풀 위에 어두운 초록을 얹는다 */
  var TERRAIN = { 0: 'forest_grass', 1: 'forest_grass', 2: 'forest_dirt', 3: 'go_water' };   // 풀은 위에서 본 사가마을 풀(realm_grass 는 옆보기 줄무늬)
  var ROAD = 'forest_dirt';
  var PER = { forest_grass: 1.6, forest_dirt: 2.2, go_water: 3, water: 4 };   // 타일 이미지(64px) 한 장이 덮는 칸 수 — 작을수록 또렷하다(돌은 판처럼 보여 크게 늘린다)

  /** 건물 → { id: world2d 스프라이트, k: 그리는 높이 = k × 긴 변(타일), rts: K-0061 AI 그림(있으면 우선), rk: 그 그림의 높이 배율 } */
  var BUILDINGS = {
    castle: { id: 'chinese_hall_01', k: 1.25, rts: 'fortress_01', rk: 1.15 },
    stronghold: { id: 'dungeon_gate_01', k: 1.25, rts: 'enemy_base_a', rk: 1.15 },
    house: { id: 'forest_cottage_01', k: 1.3 },
    farm: { id: 'barn_01', k: 1.15, rts: 'field_01', rk: 1.1 },
    market: { id: 'market_stall_01', k: 1.3 },
    workshop: { id: 'inn_01', k: 1.25, rts: 'workshop_01', rk: 1.2 },
    barracks: { id: 'tent_large_01', k: 1.35 },
    well: { id: 'well_01', k: 1.2 },
    tower: { id: 'stone_tower_01', k: 2.4 },
    wall: { id: 'wall_piece_01', k: 1.1 }
  };

  /** 유닛 → 몸(한 장 모드 풀) — K-0061 AI 몸 `rts_inf|arc|cav_ally|enemy`(팀 0 아군·1 적). 영웅은 장수 id 해시로 hero_m/hero_f */
  var UNIT_AI = { soldier: 'rts_inf', archer: 'rts_arc', cavalry: 'rts_cav' };
  var HERO_POOLS = ['hero_m', 'hero_f'];
  var BODY_TILES = { soldier: 1.7, archer: 1.7, cavalry: 1.9, hero: 2.1 };

  function poolOf(u) {
    if (u.t === 'hero') { return HERO_POOLS[M() ? M().hashOf(u.hid || u.id) % HERO_POOLS.length : 0]; }
    return UNIT_AI[u.t] ? UNIT_AI[u.t] + (u.team === 1 ? '_enemy' : '_ally') : null;
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

  /* ── 땅(부드러운 경계 + 반복 깨기, 화면 크기 캐시) ──────────────────────────────────────
     풀을 바탕으로 깔고, 숲·언덕·물은 각자 **번진 가장자리**를 가진 층으로 얹는다(칸 모양 마스크를 흐려서 쓴다). 그 위에 큰 얼룩 무늬(soft-light)로 타일 반복을 깬다.
     카메라·확대·화면 크기가 같으면 만든 그림을 그대로 쓴다(틱마다 다시 그리지 않는다). */
  var cache = { c: null, key: '', tiles: null }, noise = null, layers = {};

  /* ── K-0061 그림(`assets/web2d/rts/rts_*.webp`) — 길 조각·물 2프레임·이펙트 시트. 못 받았으면 null → 옛 그림 ─── */
  var RBASE = 'assets/web2d/rts/', rimgs = {};
  function rimg(name) {
    var e = rimgs[name];
    if (!e) {
      e = rimgs[name] = { img: null, ok: false };
      if (global.Image) { var im = new global.Image(); im.onload = function () { e.ok = true; }; im.src = RBASE + 'rts_' + name + '.webp'; e.img = im; }
    }
    return e.ok ? e.img : null;
  }
  /** UI 아이콘 <img> — 없으면 글자(이모지)가 대신 보인다 */
  function icon(name, fallback) { return '<img class="ic" src="' + RBASE + 'rts_icon_' + name + '.png" alt="' + (fallback || '') + '">'; }

  /** 길 조각 고르기 — 이웃(북·동·남·서)이 이어졌는지 → { name, rot(시계 방향 90° 수) }. 기준 그림: straight E·W · corner N·E · tee E·S·W(북 닫힘) · end W · cross · dot. 순수 함수 */
  function roadPiece(n, e, s, w) {
    var open = [!!n, !!e, !!s, !!w], c = open.filter(Boolean).length, i, r, a, b;
    if (c === 0) { return { name: 'dot', rot: 0 }; }
    if (c === 4) { return { name: 'cross', rot: 0 }; }
    if (c === 1) { i = open.indexOf(true); return { name: 'end', rot: (i - 3 + 4) % 4 }; }
    if (c === 3) { i = open.indexOf(false); return { name: 'tee', rot: i }; }
    if (open[0] && open[2]) { return { name: 'straight', rot: 1 }; }
    if (open[1] && open[3]) { return { name: 'straight', rot: 0 }; }
    a = open.indexOf(true); b = open.lastIndexOf(true);
    for (r = 0; r < 4; r++) { if (((0 + r) % 4 === a && (1 + r) % 4 === b) || ((1 + r) % 4 === a && (0 + r) % 4 === b)) { return { name: 'corner', rot: r }; } }
    return { name: 'dot', rot: 0 };
  }

  var ROAD_PIECES = ['dot', 'end', 'straight', 'corner', 'tee', 'cross'];

  /** 길 칸들을 조각으로 — 이웃이 길이거나 건물이면 열린 쪽(건물 문으로 이어지게). 조각이 다 안 받아졌으면 false(→ 흙 타일) */
  function roadsAuto(ctx, S, g, rects, ox, oy, z) {
    var i, imgs = {}, x, y, p, cx, cy;
    for (i = 0; i < ROAD_PIECES.length; i++) { imgs[ROAD_PIECES[i]] = rimg('road_' + ROAD_PIECES[i]); if (!imgs[ROAD_PIECES[i]]) { return false; } }
    function occ(xx, yy) { return g.inBounds(xx, yy) && !!S.occ[g.idx(xx, yy)]; }
    for (i = 0; i < rects.length; i++) {
      x = rects[i][0]; y = rects[i][1];
      p = roadPiece(occ(x, y - 1), occ(x + 1, y), occ(x, y + 1), occ(x - 1, y));
      cx = ox + (x + 0.5) * z; cy = oy + (y + 0.5) * z;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.rot * Math.PI / 2);
      ctx.drawImage(imgs[p.name], -z * 0.53, -z * 0.53, z * 1.06, z * 1.06);
      ctx.restore();
    }
    return true;
  }

  function shMax(S) { var Rr = global.DG.rts.rules; return Math.round(Rr.DEFS.stronghold.hp * Rr.DIFF.hp[S.diff === 0 || S.diff === 2 ? S.diff : 1]); }

  /** 전투 이펙트 — S.fx(타격 불꽃·화살, 전투 모델이 쌓는다)와 낮은 체력의 불(거점·적 기지). toScreen(x,y) → {x,y} */
  function fxs(ctx, S, toScreen, z, now) {
    var list = S.fx || [], i, f, age, im, p, q, t, sz, fr, ang;
    for (i = 0; i < list.length; i++) {
      f = list[i]; age = S.tick - f.t; if (age < 0) { continue; }
      if (f.k === 'hit') {
        im = rimg('fx_hitspark_a'); if (!im || age > 6) { continue; }
        fr = Math.min(5, Math.floor(age * 1.3)); p = toScreen(f.x, f.y); sz = z * 1.5;
        ctx.drawImage(im, fr * 128, 0, 128, 128, p.x - sz / 2, p.y - sz * 0.7, sz, sz);
      } else if (f.k === 'arrow') {
        im = rimg('fx_arrow_a'); if (!im || age > 3) { continue; }
        t = Math.min(1, age / 3); p = toScreen(f.x + (f.x2 - f.x) * t, f.y + (f.y2 - f.y) * t); q = toScreen(f.x2, f.y2);
        ang = Math.atan2(f.y2 - f.y, f.x2 - f.x); sz = z * 1.7;
        ctx.save(); ctx.translate(p.x, p.y - z * 0.5); ctx.rotate(ang); ctx.drawImage(im, 3 * 128, 0, 128, 128, -sz / 2, -sz / 2, sz, sz); ctx.restore();
      }
    }
    // 불 — 거점·적 기지 체력이 35% 아래면 지붕에서 불길
    im = rimg('fx_fire_a');
    if (im) {
      fr = Math.floor(now / 83) % 12;
      [[S.buildings[1], S.cHp / 400, 3], [S.buildings[-1], S.buildings[-1] ? S.buildings[-1].hp / shMax(S) : 1, 3]].forEach(function (e) {
        var b = e[0]; if (!b || e[1] >= 0.35 || e[1] <= 0) { return; }
        var c = toScreen(b.x + 1.5, b.y + 1.0), s2 = z * 2.4;
        ctx.drawImage(im, fr * 128, 0, 128, 128, c.x - s2 / 2, c.y - s2 * 0.8, s2, s2);
      });
    }
  }

  function mk(w, h) { var c = global.document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /** 큰 얼룩 — 값 노이즈 한 장(128px), 한 번만 만든다. 늘 같다(시드 고정) */
  function noiseTex() {
    if (noise) { return noise; }
    var c = mk(128, 128), x = c.getContext('2d'), im = x.createImageData(128, 128), g = [], i, j, u, v, a0, a1, a2, a3, n, k, N = 8;
    var seed = 20260824; function r() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    for (i = 0; i < N * N; i++) { g.push(r()); }
    for (j = 0; j < 128; j++) {
      for (i = 0; i < 128; i++) {
        u = i / 128 * N; v = j / 128 * N;
        var iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
        fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
        a0 = g[(iv % N) * N + (iu % N)]; a1 = g[(iv % N) * N + ((iu + 1) % N)]; a2 = g[((iv + 1) % N) * N + (iu % N)]; a3 = g[((iv + 1) % N) * N + ((iu + 1) % N)];
        n = (a0 + (a1 - a0) * fu) * (1 - fv) + (a2 + (a3 - a2) * fu) * fv;
        k = (j * 128 + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = Math.round(70 + n * 130); im.data[k + 3] = 255;
      }
    }
    x.putImageData(im, 0, 0);
    return (noise = c);
  }

  function fillWorld(cx, pat, per, x0, y0, w, h, ox, oy, z) {
    var s = per / 64;
    if (pat.setTransform && global.DOMMatrix) { pat.setTransform(new global.DOMMatrix([s, 0, 0, s, 0, 0])); }
    cx.save(); cx.translate(ox, oy); cx.scale(z, z); cx.fillStyle = pat; cx.fillRect(x0, y0, w, h); cx.restore();
  }

  /** 한 종류(t)의 번진 층 — 칸 모양을 마스크로 흐려 만들고, 그 안을 알맹이(content)로 채운다 */
  function layer(t, rects, W, H, dpr, ox, oy, z, content) {
    var lc = layers[t] || (layers[t] = mk(1, 1)), lx, m, mx, i;
    lc.width = Math.round(W * dpr); lc.height = Math.round(H * dpr);
    m = mk(Math.max(1, Math.ceil(W / 2)), Math.max(1, Math.ceil(H / 2))); mx = m.getContext('2d');
    mx.scale(0.5, 0.5); mx.translate(ox, oy); mx.scale(z, z); mx.fillStyle = '#fff'; mx.beginPath();
    for (i = 0; i < rects.length; i++) { mx.rect(rects[i][0] - 0.2, rects[i][1] - 0.2, 1.4, 1.4); }   // 번지면서 줄어드는 만큼 살짝 키운다
    mx.fill();
    lx = lc.getContext('2d'); lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.filter = 'blur(' + Math.max(1, z * 0.3 * dpr).toFixed(1) + 'px)'; lx.drawImage(m, 0, 0, lc.width, lc.height); lx.filter = 'none';
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    content(lx);
    return lc;
  }

  /** 물 두 번째 프레임을 천천히 비춘다(3.6초 주기) — 땅 그림 캐시 위에 얹는다 */
  function waterShimmer(ctx, W, H) {
    if (!cache.water2 || !layers[4]) { return false; }
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 1150); ctx.drawImage(layers[4], 0, 0, W, H); ctx.restore();
    return true;
  }

  /* ── K-0061 AI 땅(W-0047) — 숲·언덕 바닥, 풀 위 꽃 얼룩, 풀 칸에 덧씌우는 경계 조각 36 ───────────────────────────────
     풀을 바탕으로 깔고, 숲·언덕·물 칸은 **하드 마스크**로 제 바닥을 채운 뒤, 풀 칸마다 숲·언덕·물 이웃에 따라
     번지는 조각을 얹는다. 조각 규칙 — 변(N·E·S·W) = 그쪽 이웃이 해당 · 안쪽 구석 i + 열린 구석 = 인접한 두 변이 해당(iNE = 남·서) ·
     바깥 구석 o + 구석 = 대각 이웃만 해당. 숲·언덕·물끼리 맞닿는 곳엔 조각이 없다. 36조각+바닥 6+물 2가 다 받아졌을 때만 이 길로 간다 */
  var AI_PER = { forest: 2, hill: 2.4, water: 4, flower: 3 };                       // 한 장이 덮는 칸 수
  var TR_KINDS = { 1: 'forest', 2: 'hill', 3: 'water' };
  var TR_PIECES = ['N', 'E', 'S', 'W', 'iNE', 'iNW', 'iSE', 'iSW', 'oNE', 'oNW', 'oSE', 'oSW'];
  var AI_FLOWER_ODDS = 0.09;
  function aiReady() {
    var ok = true, i, k;
    ['forest_floor_1', 'hill_1', 'grass_flower_1', 'grass_flower_2', 'water_1', 'water_2'].forEach(function (n) { if (!rimg(n)) { ok = false; } });
    for (k in TR_KINDS) { for (i = 0; i < TR_PIECES.length; i++) { if (!rimg('tr_grass_' + TR_KINDS[k] + '_' + TR_PIECES[i])) { ok = false; } } }
    return ok;
  }
  /** 이웃 규칙 — 풀 칸 (x,y) 에서 종류 kk 로 그릴 조각 이름들. at(x,y) = 그 칸의 땅(범위 밖 -1). 순수 함수 */
  function transitionPieces(at, x, y, kk) {
    var n = at(x, y - 1) === kk, e = at(x + 1, y) === kk, s = at(x, y + 1) === kk, w = at(x - 1, y) === kk, out = [], used = { N: 0, E: 0, S: 0, W: 0 };
    if (s && w) { out.push('iNE'); used.S = used.W = 1; }
    if (s && e) { out.push('iNW'); used.S = used.E = 1; }
    if (n && w) { out.push('iSE'); used.N = used.W = 1; }
    if (n && e) { out.push('iSW'); used.N = used.E = 1; }
    if (n && !used.N) { out.push('N'); } if (e && !used.E) { out.push('E'); } if (s && !used.S) { out.push('S'); } if (w && !used.W) { out.push('W'); }
    if (at(x + 1, y - 1) === kk && !n && !e) { out.push('oNE'); }
    if (at(x - 1, y - 1) === kk && !n && !w) { out.push('oNW'); }
    if (at(x + 1, y + 1) === kk && !s && !e) { out.push('oSE'); }
    if (at(x - 1, y + 1) === kk && !s && !w) { out.push('oSW'); }
    return out;
  }
  /** 번지지 않는 마스크 층 — 칸 모양 그대로 알맹이를 채운 화면 크기 캔버스(layers[t]) */
  function hardLayer(t, rects, W, H, dpr, ox, oy, z, content) {
    var lc = layers[t] || (layers[t] = mk(1, 1)), lx, i;
    lc.width = Math.round(W * dpr); lc.height = Math.round(H * dpr);
    lx = lc.getContext('2d'); lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lx.save(); lx.translate(ox, oy); lx.scale(z, z); lx.beginPath();
    for (i = 0; i < rects.length; i++) { lx.rect(rects[i][0], rects[i][1], 1.03, 1.03); }
    lx.clip(); lx.setTransform(dpr, 0, 0, dpr, 0, 0); content(lx);
    lx.restore();
    return lc;
  }
  function patFill(cx, pat, per, rects, ox, oy, z) {
    var sc = per / 64, i;
    if (!rects.length) { return; }
    if (pat.setTransform && global.DOMMatrix) { pat.setTransform(new global.DOMMatrix([sc, 0, 0, sc, 0, 0])); }
    cx.save(); cx.translate(ox, oy); cx.scale(z, z); cx.fillStyle = pat; cx.beginPath();
    for (i = 0; i < rects.length; i++) { cx.rect(rects[i][0], rects[i][1], 1.03, 1.03); }
    cx.fill(); cx.restore();
  }
  function buildAi(cx, pg, tiles, g, x0, x1, y0, y1, ox, oy, z, W, H, dpr) {
    var gr = { f1: [], h1: [], w: [], c1: [], c2: [] }, x, y, t, h, kk, i, pcs, at, S1 = z + 1, w0 = x1 - x0 + 1, h0 = y1 - y0 + 1;
    function pat(n) { return cx.createPattern(rimg(n), 'repeat'); }
    at = function (xx, yy) { return g.inBounds(xx, yy) ? tiles[g.idx(xx, yy)] : -1; };
    fillWorld(cx, pg, PER.forest_grass, x0, y0, w0, h0, ox, oy, z);                                  // 바탕 = 풀
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        t = tiles[g.idx(x, y)]; h = hash2(x, y);
        if (t === 1) { gr.f1.push([x, y]); } else if (t === 2) { gr.h1.push([x, y]); } else if (t === 3) { gr.w.push([x, y]); }
        else if (t === 0 && ((h >>> 8) & 1023) / 1024 < AI_FLOWER_ODDS) { gr[(h >>> 4) & 1 ? 'c2' : 'c1'].push([x, y]); }
      }
    }
    ['c1', 'c2'].forEach(function (k, i2) {                                                           // 꽃 얼룩 — 번진 가장자리로 풀 위에
      if (gr[k].length) { cx.drawImage(layer(5 + i2, gr[k], W, H, dpr, ox, oy, z, function (lx) { lx.globalCompositeOperation = 'source-in'; fillWorld(lx, pat('grass_flower_' + (i2 + 1)), AI_PER.flower, x0, y0, w0, h0, ox, oy, z); }), 0, 0, W, H); }
    });
    patFill(cx, pat('forest_floor_1'), AI_PER.forest, gr.f1, ox, oy, z);   // 숲·언덕은 한 무늬로 — 칸마다 두 무늬를 섞으면 사각 이음매가 보였다
    patFill(cx, pat('hill_1'), AI_PER.hill, gr.h1, ox, oy, z);
    patFill(cx, pat('water_1'), AI_PER.water, gr.w, ox, oy, z);
    cache.water2 = false;
    if (gr.w.length) {                                                                                // 물 두 번째 프레임 층 — 그릴 때 번갈아 비친다
      hardLayer(4, gr.w, W, H, dpr, ox, oy, z, function (lx) { fillWorld(lx, pat('water_2'), AI_PER.water, x0, y0, w0, h0, ox, oy, z); });
      cache.water2 = true;
    }
    for (y = y0; y <= y1; y++) {                                                                      // 경계 조각 — 풀 칸마다
      for (x = x0; x <= x1; x++) {
        if (tiles[g.idx(x, y)] !== 0) { continue; }
        for (kk = 1; kk <= 3; kk++) {
          pcs = transitionPieces(at, x, y, kk);
          for (i = 0; i < pcs.length; i++) { cx.drawImage(rimg('tr_grass_' + TR_KINDS[kk] + '_' + pcs[i]), ox + x * z - 0.5, oy + y * z - 0.5, S1, S1); }
        }
      }
    }
  }

  /** 보이는 칸의 땅을 그린다 — 네 종류 타일이 모두 받아졌을 때만(하나라도 없으면 false → 옛 색 칸). W,H = 화면 크기(CSS px), dpr = 화면 배율 */
  function terrain(ctx, tiles, g, x0, x1, y0, y1, ox, oy, z, W, H, dpr) {
    var m = M(), t, x, y, groups = { 1: [], 2: [], 3: [] }, pg, ps, pw;
    if (!m || !m.tilePattern || !W || !H) { return false; }
    pg = m.tilePattern(ctx, TERRAIN[0]); ps = m.tilePattern(ctx, TERRAIN[2]); pw = m.tilePattern(ctx, TERRAIN[3]);
    if (!pg || !ps || !pw) { return false; }
    dpr = dpr || 1;
    var ai = aiReady(), key = [Math.round(ox * 2), Math.round(oy * 2), Math.round(z * 100), W, H, dpr, ai ? 1 : 0].join();
    if (cache.c && cache.key === key && cache.tiles === tiles) { ctx.drawImage(cache.c, 0, 0, W, H); waterShimmer(ctx, W, H); return true; }
    for (y = y0; y <= y1; y++) { for (x = x0; x <= x1; x++) { t = tiles[g.idx(x, y)]; if (t > 0) { groups[t].push([x, y]); } } }
    var c = cache.c || (cache.c = mk(1, 1)), cx;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); cx = c.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ai) { buildAi(cx, pg, tiles, g, x0, x1, y0, y1, ox, oy, z, W, H, dpr); } else {
    fillWorld(cx, pg, PER.forest_grass, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z);          // 바탕 = 풀
    if (groups[1].length) {                                                                      // 숲 = 풀 + 어두운 초록
      cx.drawImage(layer(1, groups[1], W, H, dpr, ox, oy, z, function (lx) {
        lx.globalCompositeOperation = 'source-in'; fillWorld(lx, pg, PER.forest_grass, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z);
        lx.globalCompositeOperation = 'source-atop'; lx.fillStyle = 'rgba(14,52,22,.38)'; lx.fillRect(0, 0, W, H);
      }), 0, 0, W, H);
    }
    if (groups[2].length) {                                                                      // 언덕 = 낙엽 흙 + 회색빛(돌 타일은 금속판처럼 보여 안 쓴다)
      cx.drawImage(layer(2, groups[2], W, H, dpr, ox, oy, z, function (lx) {
        lx.globalCompositeOperation = 'source-in'; fillWorld(lx, ps, PER.forest_dirt, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z);
        lx.globalCompositeOperation = 'source-atop'; lx.fillStyle = 'rgba(96,96,104,.5)'; lx.fillRect(0, 0, W, H);
      }), 0, 0, W, H);
    }
    cache.water2 = false;
    if (groups[3].length) {                                                                      // 물 = K-0061 물 2프레임(없으면 파란 바탕 + 물결)
      var w1 = rimg('water_1'), w2 = rimg('water_2'), p1 = w1 ? cx.createPattern(w1, 'repeat') : null, p2 = w2 ? cx.createPattern(w2, 'repeat') : null;
      if (p1 && p2) {
        cx.drawImage(layer(3, groups[3], W, H, dpr, ox, oy, z, function (lx) {
          lx.globalCompositeOperation = 'source-in'; fillWorld(lx, p1, PER.water, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z);
        }), 0, 0, W, H);
        layer(4, groups[3], W, H, dpr, ox, oy, z, function (lx) {   // 두 번째 프레임 — 그릴 때 번갈아 비친다
          lx.globalCompositeOperation = 'source-in'; fillWorld(lx, p2, PER.water, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z);
        });
        cache.water2 = true;
      } else {
        cx.drawImage(layer(3, groups[3], W, H, dpr, ox, oy, z, function (lx) {
          lx.globalCompositeOperation = 'source-in'; lx.fillStyle = '#3a82b6'; lx.fillRect(0, 0, W, H);
          lx.globalCompositeOperation = 'source-atop'; lx.globalAlpha = 0.34; fillWorld(lx, pw, PER.go_water, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z); lx.globalAlpha = 1;
        }), 0, 0, W, H);
      }
    }
    }   // ← 옛 번진 층 그림 끝
    // 큰 얼룩 — 타일 반복이 눈에 안 띄게(14칸마다 한 번 돌아오는 밝고 어두운 무늬)
    var nt = noiseTex(), np = cx.createPattern(nt, 'repeat');
    if (np) {
      cx.save(); cx.globalCompositeOperation = 'soft-light'; cx.globalAlpha = 0.55;
      fillWorld(cx, np, 14, x0, y0, x1 - x0 + 1, y1 - y0 + 1, ox, oy, z); cx.restore();
    }
    cache.key = key; cache.tiles = tiles;
    ctx.drawImage(c, 0, 0, W, H);
    return waterShimmer(ctx, W, H) || true;
  }

  /** 땅 장식(이미 있는 나무·바위·덤불 지물) — 숲 칸엔 나무, 언덕 칸엔 바위, 풀 칸엔 가끔 덤불. 칸 좌표 해시로 정해 늘 같은 자리·같은 종류.
   *  확대가 너무 작으면(z < 9px) 그리지 않는다. 위에서 아래로(y 순) 그려 앞쪽이 위에 겹친다. 그린 수를 돌려준다 */
  var DECOR = {
    1: { odds: 0.72, ids: ['tree_broadleaf_01', 'tree_broadleaf_02', 'tree_pine_01', 'tree_pine_02', 'tree_birch_01'], k: [1.9, 2.4] },
    2: { odds: 0.34, ids: ['rock_large_01', 'rock_small_01', 'rock_moss_01'], k: [0.8, 1.2] },
    0: { odds: 0.035, ids: ['bush_01', 'stump_01'], k: [0.8, 1.0] }
  };
  function hash2(x, y) { var h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return h; }
  function decor(ctx, tiles, g, x0, x1, y0, y1, ox, oy, z, occ) {
    var m = M(), n = 0, x, y, t, d, h, id, k;
    if (!m || !m.drawSprite || z < 9) { return 0; }
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        t = tiles[g.idx(x, y)]; d = DECOR[t];
        if (!d || (occ && occ[g.idx(x, y)])) { continue; }
        h = hash2(x, y);
        if ((h & 1023) / 1024 >= d.odds) { continue; }
        id = d.ids[(h >>> 10) % d.ids.length]; k = d.k[0] + ((h >>> 16) & 255) / 255 * (d.k[1] - d.k[0]);
        if (m.drawSprite(ctx, { id: id, x: ox + (x + 0.2 + ((h >>> 24) & 127) / 127 * 0.6) * z, y: oy + (y + 0.95) * z, h: k * z })) { n++; }
      }
    }
    return n;
  }

  /** 도로 칸들을 흙길 타일로 — 못 그리면 false */
  function roads(ctx, rects, ox, oy, z) { return fillTiles(ctx, ROAD, rects, ox, oy, z); }

  /** 이 건물은 그림이 준비됐나(받은 뒤에만 색 칸을 건너뛴다) — K-0061 AI 그림이 있으면 그것, 아니면 지물 */
  function spriteReady(type) { var d = BUILDINGS[type], m = M(); return !!(d && ((d.rts && rimg(d.rts)) || (m && m.spriteReady && m.spriteReady(d.id)))); }

  /** 적 기지 체력 단계 그림 — 66%↑ a · 33%↑ b · 아래 c (체력 모름 = a) */
  function baseName(b, S) { var f = S && b.hp !== undefined ? b.hp / shMax(S) : 1; return f > 0.66 ? 'enemy_base_a' : (f > 0.33 ? 'enemy_base_b' : 'enemy_base_c'); }

  /** 건물 그림을 y 순으로 그린다(아래쪽이 위에 겹치게). list = [{ b, d(건물 표 항목), x, y(화면 좌상단) }]. 그린 수 */
  function sprites(ctx, list, z, S) {
    var m = M(), n = 0, i, e, spec;
    if (!m || !m.drawSprite) { return 0; }
    list.sort(function (a, b) { return (a.b.y + a.d.h) - (b.b.y + b.d.h); });
    for (i = 0; i < list.length; i++) {
      e = list[i]; spec = BUILDINGS[e.b.t];
      if (!spec) { continue; }
      var nm = spec.rts ? (e.b.t === 'stronghold' ? baseName(e.b, S) : spec.rts) : null, im = nm ? rimg(nm) : null;
      if (im) {   // K-0061 AI 그림 — 발 밑 가운데에 세운다
        var hh = spec.rk * Math.max(e.d.w, e.d.h) * z;
        ctx.drawImage(im, e.x + e.d.w * z / 2 - hh / 2, e.y + e.d.h * z * 0.94 - hh * 0.97, hh, hh); n++;
      } else if (m.drawSprite(ctx, { id: spec.id, x: e.x + e.d.w * z / 2, y: e.y + e.d.h * z * 0.94, h: spec.k * Math.max(e.d.w, e.d.h) * z })) { n++; }
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
  global.DG.rts.art = { TERRAIN: TERRAIN, BUILDINGS: BUILDINGS, UNIT_AI: UNIT_AI, HERO_POOLS: HERO_POOLS, poolOf: poolOf, terrain: terrain, transitionPieces: transitionPieces, decor: decor, DECOR: DECOR, roads: roads, roadsAuto: roadsAuto, roadPiece: roadPiece, fxs: fxs, icon: icon, rimg: rimg, spriteReady: spriteReady, baseName: baseName, sprites: sprites, unit: unit };
})(typeof window !== 'undefined' ? window : this);
