/**
 * 2D 들판 — 지도 앱 대신 게임 타일 세계 (W-0130, 기준작 젤다 「신들의 트라이포스」·포켓몬 HGSS 들판)
 * ---------------------------------------------------------------
 * 옛 2D(시점 2D)는 실제 길지도(OSM 그림 타일) 위에 작은 소품이 선 **지도 앱** 화면이었다(사용자 10-09 "2d 넘 구림").
 * 실제 길·물·건물 배치는 그대로 두고(땅 종류 = world.terrainAt — land → geo(OSM) → 노이즈), 그림만 게임 들판으로:
 *
 *   ① 땅      world.js drawFallback 이 칸(48m)마다 땅 종류 타일(K-0020 go_*)을 깐다 — 이 손잡이가 켜지면 OSM 그림 대신 늘 이 길
 *   ② 결      칸 안 잔결(밝고 어두운 점·마을 포장 줄눈·물 잔물결) — 칸 밝기 흔들기는 바둑판으로 드러나 뺐다
 *   ③ 경계    종류가 바뀌는 칸 가장자리에 물가 거품·길 가장자리 그늘·숲 가장자리 그늘
 *   ④ 소품    숲 = 나무 둘(활엽·소나무·자작), 산 = 바위·소나무, 풀밭 = 가끔 풀포기·꽃·덤불, 논밭 = 가끔 건초 — 전부 world2d 그림(에셋)
 *
 * 그림·칸 고르기는 좌표 해시라 프레임마다 안 바뀐다(지글거림 없음). 손잡이 `world.field2d` 0 이면 옛 지도.
 */
(function (global) {
  'use strict';

  var CELL = 48;
  function zoomMul() { var C = core(); return C && C.tuned ? +C.tuned('world.field2dZoom', 2.0) : 2.0; }   // W-0204 1.7 → 2.0 (몸도 bodyK 로 이 확대를 따른다 — 몸 60 → ≈120px/720)
  /** 땅 종류 대표 색(타일 평균 근사) — 경계 번짐에 쓴다 */
  var KCOL = { grass: [95, 159, 72], forest: [63, 110, 54], mount: [139, 134, 120], road: [202, 168, 119], town: [169, 166, 158], farm: [141, 108, 64], water: [62, 143, 178] };
  /** 땅 종류 바탕색 — 젤다 「신들의 트라이포스」 들판 팔레트(맑고 부드러운 중간 톤) */
  var BASE = { grass: '#5f9f48', forest: '#3f6e36', mount: '#8b8678', road: '#caa877', town: '#a9a69e', farm: '#8d6c40', water: '#3e8fb2' };
  /** W-0211 — 봄·가을·겨울 들(grass)·논밭(farm)은 계절 색을 섞는다(3D ground3d.seasonPaint 와 같은 규칙). 손잡이 world.field2dSeason 0.5 ·
   *  여름·계절 꺼짐·손잡이 0 = null(옛 BASE·KCOL). 계절 열쇠로 캐시 — 칸마다 섞기 계산 안 함 */
  var seasonMemo = { k: null, c: {} };
  function seasonRgb(kind) {
    var S = global.DG.season, C = core(), a = C && C.tuned ? +C.tuned('world.field2dSeason', 0.5) : 0.5, s, mk, hx, b, t;
    if ((kind !== 'grass' && kind !== 'farm') || !S || !S.on || !S.on() || !(a > 0)) { return null; }
    s = S.now(); if (!s || s.key === 'summer') { return null; }
    mk = s.key + ':' + a; if (seasonMemo.k !== mk) { seasonMemo = { k: mk, c: {} }; }
    if (!seasonMemo.c[kind]) {
      hx = parseInt(String(kind === 'farm' ? s.field : s.grass).replace('#', ''), 16); b = KCOL[kind]; t = Math.min(1, a);
      seasonMemo.c[kind] = [Math.round(b[0] + (((hx >> 16) & 255) - b[0]) * t), Math.round(b[1] + (((hx >> 8) & 255) - b[1]) * t), Math.round(b[2] + ((hx & 255) - b[2]) * t)];
    }
    return seasonMemo.c[kind];
  }
  function rgbOf(kind) { return seasonRgb(kind) || KCOL[kind]; }
  /** 잔결 점 두 색 — 계절이면 섞은 바탕을 밝게(×1.3)·어둡게(×0.5), 아니면 옛 SPECK */
  function speckOf(kind) {
    var c = seasonRgb(kind), m = seasonMemo, f;
    if (!c) { return SPECK[kind]; }
    if (!m.s) { m.s = {}; }
    if (!m.s[kind]) { f = function (k, al) { return 'rgba(' + Math.min(255, Math.round(c[0] * k)) + ',' + Math.min(255, Math.round(c[1] * k)) + ',' + Math.min(255, Math.round(c[2] * k)) + ',' + al + ')'; }; m.s[kind] = [f(1.3, 0.55), f(0.5, 0.5)]; }
    return m.s[kind];
  }
  function color(kind) { var c = seasonRgb(kind); return c ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : (BASE[kind] || '#5f9f48'); }
  /** 잔결 색(밝은 점·어두운 점) */
  var SPECK = { grass: ['rgba(140,200,90,0.55)', 'rgba(40,90,30,0.5)'], forest: ['rgba(90,140,70,0.45)', 'rgba(20,45,18,0.55)'], mount: ['rgba(190,185,170,0.5)', 'rgba(70,66,58,0.5)'], road: ['rgba(235,210,160,0.6)', 'rgba(140,105,65,0.45)'], farm: ['rgba(170,130,80,0.5)', 'rgba(90,60,30,0.5)'], water: ['rgba(200,235,250,0.45)', 'rgba(30,90,130,0.4)'], town: ['rgba(215,212,205,0.5)', 'rgba(110,108,104,0.45)'] };
  function core() { return global.DG.core; }
  function on() { var C = core(); return !!(C && C.tuned ? C.tuned('world.field2d', 1) : 1); }

  /** 좌표 해시 0..1 — 순수(core.hash2 는 이 판만 0~0.5 라 따로 둔다) */
  function h01(x, y, s) {
    var n = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177 | 0; n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  /** 땅 종류 → 세울 그림 [id, 칸 대비 키, 확률] — 순수 표 */
  var PROPS = {
    forest: [['tree_broadleaf_01', 1.25, 1], ['tree_pine_01', 1.35, 1], ['tree_broadleaf_02', 1.2, 1], ['tree_birch_01', 1.25, 1], ['tree_broadleaf_03', 1.2, 1], ['bush_02', 0.5, 1]],
    mount: [['rock_large_01', 0.55, 0.5], ['tree_pine_02', 1.3, 0.5], ['rock_outcrop_01', 0.6, 0.45], ['rock_moss_01', 0.45, 0.45], ['tree_pine_03', 1.25, 0.45]],
    grass: [['grass_tuft_01', 0.26, 0.16], ['grass_tuft_02', 0.26, 0.16], ['flower_patch_01', 0.3, 0.1], ['bush_01', 0.42, 0.08], ['rock_small_01', 0.22, 0.05], ['tree_broadleaf_01', 1.2, 0.05]],
    farm: [['haystack_01', 0.5, 0.12], ['grass_tuft_02', 0.24, 0.1]],
    town: [['street_lamp_01', 0.6, 0.06], ['barrel_01', 0.3, 0.06]]
  };
  /** 숲 칸은 나무 둘, 나머지는 하나까지 */
  var PER_CELL = { forest: 2, mount: 1, grass: 1, farm: 1, town: 1 };

  /** 이 칸에 세울 소품 [{ id, dx, dy(칸 안 0..1), k }] — 순수 */
  function propsAt(kind, tx, ty) {
    var L = PROPS[kind], out = [], n = PER_CELL[kind] || 0, i, r, p;
    if (!L) { return out; }
    for (i = 0; i < n; i++) {
      p = L[Math.floor(h01(tx, ty, 11 + i) * L.length)];
      r = h01(tx, ty, 23 + i);
      if (r > p[2]) { continue; }
      out.push({ id: p[0], dx: 0.15 + 0.7 * h01(tx, ty, 37 + i), dy: 0.2 + 0.7 * h01(tx, ty, 41 + i), k: p[1] * (0.85 + 0.3 * h01(tx, ty, 53 + i)) });
    }
    return out;
  }

  /** 경계 한 변의 색 — 이웃이 물이면 거품, 길이면 그늘, 숲이면 짙은 그늘. 같은 종류면 null */
  function edgeColor(me, nb) {
    if (me === nb) { return null; }
    if (me === 'water') { return 'rgba(230,245,255,0.55)'; }   // 물 쪽 가장자리에 거품 띠
    if (nb === 'water') { return 'rgba(40,60,40,0.35)'; }      // 물가 둑 그늘
    if (me === 'road') { return 'rgba(0,0,0,0.28)'; }
    if (nb === 'forest') { return 'rgba(10,25,12,0.3)'; }
    return 'rgba(0,0,0,0.14)';
  }

  /** 칸 잔결 — 좌표 해시 점(풀·흙·돌 알갱이), 마을은 포장 줄눈, 물은 잔물결 줄 */
  function texture(ctx, kind, tx, ty, sx, sy, T) {
    var sp = speckOf(kind), i, r, x, y;
    if (!sp) { return; }
    if (kind === 'town') {
      ctx.strokeStyle = 'rgba(90,88,84,0.28)'; ctx.lineWidth = Math.max(1, T * 0.012);
      for (i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx, sy + T * i / 4); ctx.lineTo(sx + T, sy + T * i / 4); ctx.stroke(); }
      for (i = 0; i < 4; i++) { var off = (i % 2) * T / 8; for (var j = 0; j < 4; j++) { x = sx + off + T * j / 4; ctx.beginPath(); ctx.moveTo(x, sy + T * i / 4); ctx.lineTo(x, sy + T * (i + 1) / 4); ctx.stroke(); } }
      return;
    }
    if (kind === 'water') {
      ctx.strokeStyle = sp[0]; ctx.lineWidth = Math.max(1, T * 0.018);
      for (i = 0; i < 3; i++) { x = sx + T * h01(tx, ty, 61 + i) * 0.7; y = sy + T * (0.2 + 0.3 * i + 0.1 * h01(tx, ty, 67 + i)); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + T * 0.08, y - T * 0.03, x + T * 0.16, y); ctx.stroke(); }
      return;
    }
    for (i = 0; i < 10; i++) {
      r = T * (0.012 + 0.02 * h01(tx, ty, 71 + i));
      x = sx + T * h01(tx, ty, 81 + i); y = sy + T * h01(tx, ty, 91 + i);
      ctx.fillStyle = sp[i % 2]; ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** 이웃(nb) 색을 이 칸 변(x0,y0 에서 안쪽 방향 dx,dy)으로 번지게 — 칸 폭의 35% */
  function blend(ctx, me, nb, x0, y0, dx, dy, Tw, Th) {
    if (me === nb || !KCOL[nb]) { return; }
    var c = rgbOf(nb), d = (dx ? Tw : Th) * 0.35, g = ctx.createLinearGradient(x0, y0, x0 + dx * d, y0 + dy * d);
    g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.55)'); g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
    ctx.fillStyle = g;
    if (dx) { ctx.fillRect(dx > 0 ? x0 : x0 - d, y0, d, Th); } else { ctx.fillRect(x0, dy > 0 ? y0 : y0 - d, Tw, d); }
  }

  /**
   * drawFallback 뒤에 부른다 — 결·경계·소품. terrainAt(tx, ty) = world.js 의 칸 → 땅 종류.
   * ctx 는 지면 캔버스, (camX, camY) 는 화면 좌상단이 가리키는 월드 좌표(m), sc = 1m 당 px
   */
  /* W-0372 — 나무를 땅 단계에서 그리면 인물이 늘 그 위에 덧그려져 "나무를 밟고 다녔다"(사용자 10-22). 키 큰 소품(k ≥ TALL)은 목록(tall)으로 넘겨
     world 가 인물과 발 y 로 함께 정렬해 그리고, 줄기는 작은 상자로 걷기를 막는다. 손잡이 go.propDepth·go.treeBlock(0 = 옛) */
  var TALL = 0.9, tall = [];
  function tallOn() { var C = core(); return !(C && C.tuned && !+C.tuned('go.propDepth', 1)); }
  /** 둘레 3×3 칸 나무 줄기 상자 [{x, z, w, d, rot}] — world 의 hitsHouse 꼴(세계 좌표). 꺼져 있으면 [] — 순수(지형 함수만 씀) */
  function treeRects(x, y, terrainAt) {
    var C = core(), out = [], gx0 = Math.floor(x / CELL), gy0 = Math.floor(y / CELL), tx, ty, ps, i, w;
    if (!on() || !terrainAt || (C && C.tuned && !+C.tuned('go.treeBlock', 1))) { return out; }
    for (ty = gy0 - 1; ty <= gy0 + 1; ty++) { for (tx = gx0 - 1; tx <= gx0 + 1; tx++) {
      ps = propsAt(terrainAt(tx, ty), tx, ty);
      for (i = 0; i < ps.length; i++) { if (ps[i].k >= TALL) { w = 0.12 * CELL * ps[i].k; out.push({ x: (tx + ps[i].dx) * CELL, z: (ty + ps[i].dy) * CELL, w: w, d: w * 0.6, rot: 0 }); } }
    } }
    return out;
  }
  /* W-0389 ② — 결(texture)·경계 번짐(blend)·테두리(edge)는 칸 그림이 좌표 해시라 프레임마다 같다 → CH×CH 칸 조각 캔버스에 한 번 굽고(열쇠 = 줌 T·계절) 매 프레임엔
     조각만 붙인다(폰 2D 들판 13fps 의 주범 — 보이는 칸 70여 개 × 타원 10·그라데이션 4·칠 8 을 매 프레임 다시 그리던 것). 조각 경계는 이웃 조각 원점까지 늘려 1px 틈을 막는다.
     소품(④)은 그대로 매 프레임(인물과 발 y 정렬). 손잡이 world.field2dCache 0 = 옛 길(A/B) */
  /* W-0390 — K-0162 이음 타일(이중 격자 wang16-corner-dualgrid): assets/web2d/tile/tiles.json — 쌍(grass_dirt…)마다 4×4 아틀라스(칸 PX 256 · stride 272 · gutter 8),
     반 칸(왼쪽 위로) 밀린 격자의 칸 (x,y) 네 모서리 = 땅 칸 (x,y)·(x+1,y)·(x,y+1)·(x+1,y+1), i = NW1+NE2+SW4+SE8(비트 = 그 모서리가 a). 땅 종류 → 바탕 타일(kinds_a/kinds_b).
     네 모서리가 한 바탕이면 바탕 타일 한 장, 두 바탕이 쌍이면 아틀라스 칸, 쌍이 없으면 NW 바탕 + 옛 번짐(blend). 조각 캐시 안에서만 깐다(받은 그림 수가 열쇠 — 늦게 오면 다시 굽는다).
     손잡이 world.autotile(1 · 0 = 옛 색 바탕 + 결) */
  var dualMiss = 0, TILE_BASE = 'assets/web2d/tile/', tjson = null, tjTried = false, timgs = {}, tLoaded = 0, kindBase = null;
  function autotileOn() { var C = core(); return !(C && C.tuned && !+C.tuned('world.autotile', 1)); }
  function loadTiles() {
    if (tjTried || !global.fetch) { return; }
    tjTried = true;
    global.fetch(TILE_BASE + 'tiles.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { tjson = j; kindBase = null; })['catch'](function () { tjson = null; });
  }
  function timg(key, url) {
    var e = timgs[key];
    if (e) { if (!e.ok) { dualMiss++; } return e.ok ? e.img : null; }
    dualMiss++;
    if (typeof Image === 'undefined') { timgs[key] = { ok: false }; return null; }
    e = timgs[key] = { ok: false, img: new Image() };
    e.img.onload = function () { e.ok = true; tLoaded++; };
    e.img.src = url;
    return null;
  }
  /** 땅 종류 → 바탕 타일 id(go_grass …) — tiles.json 쌍의 kinds_a/kinds_b 에서(순수, json 필요) */
  function baseOf(kind) {
    if (!tjson || !tjson.pairs) { return null; }
    if (!kindBase) { kindBase = {}; Object.keys(tjson.pairs).forEach(function (k) { var P = tjson.pairs[k]; (P.kinds_a || []).forEach(function (x) { kindBase[x] = kindBase[x] || P.a; }); (P.kinds_b || []).forEach(function (x) { kindBase[x] = kindBase[x] || P.b; }); }); }
    return kindBase[kind] || null;
  }
  /** 두 바탕의 쌍 — { key, P, aFirst }(a 가 첫째 바탕인가) 또는 null(순수) */
  function pairFor(b1, b2) {
    if (!tjson || !tjson.pairs || !b1 || !b2 || b1 === b2) { return null; }
    var k, P;
    for (k in tjson.pairs) { if (!tjson.pairs.hasOwnProperty(k)) { continue; } P = tjson.pairs[k]; if (P.a === b1 && P.b === b2) { return { key: k, P: P, aFirst: true }; } if (P.a === b2 && P.b === b1) { return { key: k, P: P, aFirst: false }; } }
    return null;
  }
  function dualIndex(nwA, neA, swA, seA) { return (nwA ? 1 : 0) + (neA ? 2 : 0) + (swA ? 4 : 0) + (seA ? 8 : 0); }
  /** 조각 캔버스에 이중 격자 바탕을 깐다 — 조각 원점 = 땅 칸 (cx*CH, cy*CH). 돌아온 값 = 그린 칸 수(그림 없으면 0) */
  function drawDual(g, cx, cy, T, b, terrainAt) {
    if (!autotileOn() || !tjson) { if (!tjson) { loadTiles(); } return 0; }
    var x0 = cx * CH - 1, y0 = cy * CH - 1, x, y, n = 0, k0, k1, k2, k3, b0, b1, b2, b3, px, py, img, pr, i, cell, ST = (tjson.stride || 272), GU = (tjson.gutter || 8), PX = (tjson.px || 256);
    for (y = y0; y < y0 + CH + 1; y++) { for (x = x0; x < x0 + CH + 1; x++) {
      k0 = terrainAt(x, y); k1 = terrainAt(x + 1, y); k2 = terrainAt(x, y + 1); k3 = terrainAt(x + 1, y + 1);
      b0 = baseOf(k0); b1 = baseOf(k1); b2 = baseOf(k2); b3 = baseOf(k3);
      if (!b0) { continue; }
      px = Math.round(((x - cx * CH) + 0.5) * T); py = Math.round(((y - cy * CH) + 0.5) * T);
      var pw = Math.round(((x - cx * CH) + 1.5) * T) - px, ph = Math.round(((y - cy * CH) + 1.5) * T) - py;
      if (b0 === b1 && b0 === b2 && b0 === b3) { img = timg(b0, TILE_BASE + b0 + '.webp'); if (img) { g.drawImage(img, px, py, pw, ph); n++; } continue; }
      var set = {}; set[b0] = 1; if (b1) { set[b1] = 1; } if (b2) { set[b2] = 1; } if (b3) { set[b3] = 1; }
      var keys = Object.keys(set); pr = keys.length === 2 ? pairFor(keys[0], keys[1]) : null;
      if (pr) {
        img = timg('pair:' + pr.key, TILE_BASE + pr.P.atlas);
        if (!img) { continue; }
        i = dualIndex(b0 === pr.P.a, b1 === pr.P.a, b2 === pr.P.a, b3 === pr.P.a);
        cell = [(i % 4) * ST + GU, Math.floor(i / 4) * ST + GU];
        g.drawImage(img, cell[0], cell[1], PX, PX, px, py, pw, ph); n++;
      } else { img = timg(b0, TILE_BASE + b0 + '.webp'); if (img) { g.drawImage(img, px, py, pw, ph); n++; } }
    } }
    return n;
  }
  /** 이 칸과 이웃이 아틀라스로 이어지는가(결·번짐을 건너뛸 수 있나) — 순수(json 필요) */
  function seamed(kind, nb) { var a = baseOf(kind), b = baseOf(nb); return !!(a && b && (a === b || pairFor(a, b))); }
  /* W-0389 ③-4 — 걷기 초반이 깎이던 것: 열쇠에 받은 타일 그림 수가 들어 있어 그림이 하나 올 때마다 보이는 조각 전부를 한 프레임에 다시 구웠다.
     이제 그림이 빠진 채 구운 조각(miss)만 표시해 두고 프레임마다 하나씩 다시 굽는다(그 사이엔 옛 조각) · 굽기가 없는 프레임엔 걷는 쪽 바깥 한 줄을 하나 미리 굽는다.
     손잡이 world.field2dPrebake 1(0 = 미리 굽기 끔) · 셈 = chunkStats() */
  var CH = 8, chunks = {}, chunkN = 0, CHUNK_MAX = 28, chunkKey = null, chunkK = 1, frameBakes = 0, lastCam = null, ST = { bakes: 0, rebakes: 0, pre: 0, ms: 0, resets: 0, px: 0, cap: 28 };
  /** W-0413 조각 한 변 칸 수 — 화면 배율과 상관없이 8칸이면 폰 2264px(≈20MB)·PC ≈3400px(≈46MB) 조각을 28장까지 들었다(chunkStats 실측 T 283).
   *  조각 한 장이 손잡이 world.field2dChunkPx(768) 안에 들도록 1~8칸 — 0 이면 옛 8칸. 순수 */
  function chunkCells(T, k) { var C = core(), mx = C && C.tuned ? +C.tuned('world.field2dChunkPx', 768) : 768; if (!(mx > 0) || !(T > 0)) { return 8; } return Math.max(1, Math.min(8, Math.floor(mx / (T * (k || 1))))); }
  function cacheOn() { var C = core(); return !(C && C.tuned && !+C.tuned('world.field2dCache', 1)) && typeof document !== 'undefined' && !global.DG_NO_DRAW; }
  /** 칸 하나의 땅 그림(결·경계·테두리) — 화면/조각 어디에 그리든 같다 */
  function paintTile(g, kind, tx, ty, sx, sy, Tw, Th, T, b, terrainAt, dual) {
    if (!dual || !baseOf(kind)) { texture(g, kind, tx, ty, sx, sy, T); }   // W-0390 아틀라스 바탕이면 결은 그림에 있다
    var nE = terrainAt(tx + 1, ty), nW = terrainAt(tx - 1, ty), nS = terrainAt(tx, ty + 1), nN = terrainAt(tx, ty - 1);
    if (!dual || !seamed(kind, nE)) { blend(g, kind, nE, sx + Tw, sy, -1, 0, Tw, Th); } if (!dual || !seamed(kind, nW)) { blend(g, kind, nW, sx, sy, 1, 0, Tw, Th); }
    if (!dual || !seamed(kind, nS)) { blend(g, kind, nS, sx, sy + Th, 0, -1, Tw, Th); } if (!dual || !seamed(kind, nN)) { blend(g, kind, nN, sx, sy, 0, 1, Tw, Th); }
    var c = edgeColor(kind, terrainAt(tx + 1, ty)); if (c) { g.fillStyle = c; g.fillRect(sx + Tw - b, sy, b, Th); }
    c = edgeColor(kind, terrainAt(tx, ty + 1)); if (c) { g.fillStyle = c; g.fillRect(sx, sy + Th - b, Tw, b); }
    c = edgeColor(kind, terrainAt(tx - 1, ty)); if (c) { g.fillStyle = c; g.fillRect(sx, sy, b, Th); }
    c = edgeColor(kind, terrainAt(tx, ty - 1)); if (c) { g.fillStyle = c; g.fillRect(sx, sy, Tw, b); }
  }
  /** 조각(cx, cy) 캔버스 — 없으면 굽는다. 조각 안 칸 경계는 조각 원점 기준 정수 px */
  function chunkOf(cx, cy, T, b, terrainAt, pre) {
    var k = cx + ',' + cy, c = chunks[k], cv, t0 = global.performance ? global.performance.now() : 0;
    if (c && !(frameBakes < 1 && ((c.miss && c.ld !== tLoaded) || (c.pmiss && anyReady(c.pmiss))))) { if (!pre) { c.at = ++chunkN; } return c.cv; }
    /* W-0389 ③-4 — 조각은 땅 캔버스 실제 배율(chunkK = 화소비, 땅은 1.5 까지)로 굽는다: 1배로 구우면 1.5배로 늘어나 결·소품이 매 프레임 그리던 때보다 흐렸다 */
    var px = Math.round(CH * T * chunkK), g, i, j, sx, sy, Tw, Th;
    if (c) { cv = c.cv; g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); ST.rebakes++; } else { cv = document.createElement('canvas'); cv.width = Math.max(1, px); cv.height = Math.max(1, px); g = cv.getContext('2d'); }
    g.setTransform(chunkK, 0, 0, chunkK, 0, 0);
    frameBakes++; ST.px = px; dualMiss = 0;
    var dual = drawDual(g, cx, cy, T, b, terrainAt) > 0, miss = dualMiss > 0, ld = tLoaded;   // W-0390 이중 격자 바탕(그림 왔을 때만)
    for (j = 0; j < CH; j++) { for (i = 0; i < CH; i++) {
      sx = Math.round(i * T); sy = Math.round(j * T); Tw = Math.round((i + 1) * T) - sx; Th = Math.round((j + 1) * T) - sy;
      paintTile(g, terrainAt(cx * CH + i, cy * CH + j), cx * CH + i, cy * CH + j, sx, sy, Tw, Th, T, b, terrainAt, dual);
    } }
    var pmiss = propsBaked() ? bakeProps(g, cx, cy, T, terrainAt) : null;   // W-0389 ③-4 땅 소품 + 큰 소품 그림자
    if (c) { c.miss = miss; c.ld = ld; c.pmiss = pmiss; }
    else {
      if (Object.keys(chunks).length >= CHUNK_MAX) { var old = null, oa = Infinity, kk; for (kk in chunks) { if (chunks[kk].at < oa) { oa = chunks[kk].at; old = kk; } } if (old) { delete chunks[old]; } }
      chunks[k] = { cv: cv, at: ++chunkN, miss: miss, ld: ld, pmiss: pmiss }; ST.bakes++; if (pre) { ST.pre++; }
    }
    if (global.performance) { ST.ms += global.performance.now() - t0; }
    return cv;
  }
  function chunkStats() { return { n: Object.keys(chunks).length, key: chunkKey, bakes: ST.bakes, rebakes: ST.rebakes, pre: ST.pre, ms: Math.round(ST.ms), resets: ST.resets, px: ST.px, cap: ST.cap, ch: CH, mb: Math.round(Object.keys(chunks).length * ST.px * ST.px * 4 / 1048576) }; }
  /* W-0389 ③-4 — 숲으로 걸어 들어가면 보이는 소품이 수백 개(큰 나무 96→267)라 매 프레임 낱개 그리기(그림자 타원 둘·save/restore·그림)가
     걷기 FPS 를 깎았다(30초 걷기에 프레임당 fill 272→937). 인물보다 늘 아래인 땅 소품(키 < TALL)은 그림자까지 조각에 굽고, 인물과 앞뒤를 가리는
     큰 소품은 그림자만 조각에 굽는다(그림은 매 프레임 — world 가 shadow:false 로). 조각 경계를 넘는 소품은 이웃 칸까지 훑어 양쪽 조각에 같이 그린다.
     그림이 아직 없는 소품 id 는 pmiss — 받아지면 그 조각만 다시 굽는다. 손잡이 world.field2dProps 1(0 = 옛 매 프레임) */
  function propsBaked() { var C = core(), M = global.DG && global.DG.mode2d; return !!(M && M.drawSprite && M.spriteShadow && M.spriteReady) && !(C && C.tuned && !+C.tuned('world.field2dProps', 1)); }
  function anyReady(ids) { var M = global.DG.mode2d; for (var i = 0; i < ids.length; i++) { if (M.spriteReady(ids[i])) { return true; } } return false; }
  /** 조각(cx, cy) 캔버스 g 에 소품을 굽는다 — 돌아온 값 = 그림이 아직 없는 id 목록(없으면 null) */
  function bakeProps(g, cx, cy, T, terrainAt) {
    var M = global.DG.mode2d, deep = tallOn(), x0 = cx * CH, y0 = cy * CH, tx, ty, ps, i, p, lo = [], hi = [], miss = {}, o;
    for (ty = y0 - 1; ty <= y0 + CH + 1; ty++) { for (tx = x0 - 1; tx <= x0 + CH; tx++) {
      ps = propsAt(terrainAt(tx, ty), tx, ty);
      for (i = 0; i < ps.length; i++) { p = ps[i]; o = { id: p.id, x: (tx - x0 + p.dx) * T, y: (ty - y0 + p.dy) * T, h: T * p.k }; (deep && p.k >= TALL ? hi : lo).push(o); }
    } }
    lo.sort(function (a, b2) { return a.y - b2.y; });
    for (i = 0; i < lo.length; i++) { if (!M.drawSprite(g, lo[i])) { miss[lo[i].id] = 1; } }
    for (i = 0; i < hi.length; i++) { if (!M.spriteShadow(g, hi[i])) { miss[hi[i].id] = 1; } }
    var ids = Object.keys(miss);
    return ids.length ? ids : null;
  }
  function prebakeOn() { var C = core(); return !(C && C.tuned && !+C.tuned('world.field2dPrebake', 1)); }
  function decorate(ctx, camX, camY, W, H, sc, terrainAt) {
    if (!on() || !terrainAt) { return false; }
    var M = global.DG.mode2d, T = CELL * sc, b = Math.max(2, T * 0.07);
    var t0x = Math.floor(camX / CELL) - 1, t1x = Math.ceil((camX + W / sc) / CELL) + 1;
    var t0y = Math.floor(camY / CELL) - 1, t1y = Math.ceil((camY + H / sc) / CELL) + 2;
    var tx, ty, kind, sx, sy, props = [], ps, i, deep = tallOn(), useCache = cacheOn(), baked = useCache && propsBaked(); tall = [];
    if (useCache) {
      var tf = ctx.getTransform ? ctx.getTransform() : null; chunkK = tf && tf.a > 0 ? Math.min(2, tf.a) : 1; CH = chunkCells(T, chunkK);
      var key = CH + 'c|' + chunkK.toFixed(2) + '|' + T.toFixed(3) + '|' + (seasonMemo.k || '') + '|' + b + '|' + (autotileOn() ? 'a' + (tjson ? 'j' : '') : 'x') + (propsBaked() ? 'p' + (deep ? 'd' : '') : '');
      if (chunkKey !== key) { chunks = {}; chunkKey = key; ST.resets++; }
      var c0x = Math.floor(t0x / CH), c1x = Math.floor(t1x / CH), c0y = Math.floor(t0y / CH), c1y = Math.floor(t1y / CH), cx, cy, ox, oy, nx, ny;
      frameBakes = 0; CHUNK_MAX = ST.cap = Math.max(28, (c1x - c0x + 3) * (c1y - c0y + 3) + 4);
      for (cy = c0y; cy <= c1y; cy++) { for (cx = c0x; cx <= c1x; cx++) {
        ox = Math.round((cx * CH * CELL - camX) * sc); oy = Math.round((cy * CH * CELL - camY) * sc);
        nx = Math.round(((cx + 1) * CH * CELL - camX) * sc); ny = Math.round(((cy + 1) * CH * CELL - camY) * sc);
        ctx.drawImage(chunkOf(cx, cy, T, b, terrainAt), ox, oy, nx - ox, ny - oy);
      } }
      /* 미리 굽기 — 이 프레임 굽기가 없을 때만, 걷는 쪽(카메라 움직임) 바깥 한 줄에서 아직 없는 조각 하나 */
      var mvx = lastCam ? camX - lastCam[0] : 0, mvy = lastCam ? camY - lastCam[1] : 0; lastCam = [camX, camY];
      if (!frameBakes && prebakeOn() && (mvx || mvy)) {
        var rx0 = c0x - (mvx < 0 ? 1 : 0), rx1 = c1x + (mvx > 0 ? 1 : 0), ry0 = c0y - (mvy < 0 ? 1 : 0), ry1 = c1y + (mvy > 0 ? 1 : 0), done = false;
        for (cy = ry0; cy <= ry1 && !done; cy++) { for (cx = rx0; cx <= rx1 && !done; cx++) {
          if ((cx < c0x || cx > c1x || cy < c0y || cy > c1y) && !chunks[cx + ',' + cy]) { chunkOf(cx, cy, T, b, terrainAt, true); done = true; }
        } }
      }
    }
    for (ty = t0y; ty <= t1y; ty++) {
      for (tx = t0x; tx <= t1x; tx++) {
        kind = terrainAt(tx, ty);
        /* 칸 경계를 정수 픽셀로 — 반투명 칠이 1px 겹쳐 격자선이 서던 것 */
        sx = Math.round((tx * CELL - camX) * sc); sy = Math.round((ty * CELL - camY) * sc);
        var Tw = Math.round(((tx + 1) * CELL - camX) * sc) - sx, Th = Math.round(((ty + 1) * CELL - camY) * sc) - sy;
        if (!useCache) { paintTile(ctx, kind, tx, ty, sx, sy, Tw, Th, T, b, terrainAt); }
        if (ty <= t1y - 1) {
          ps = propsAt(kind, tx, ty);
          for (i = 0; i < ps.length; i++) { if (deep && ps[i].k >= TALL) { tall.push({ id: ps[i].id, wx: (tx + ps[i].dx) * CELL, wy: (ty + ps[i].dy) * CELL, k: ps[i].k, sb: baked }); continue; } if (baked) { continue; } props.push({ id: ps[i].id, x: sx + ps[i].dx * T, y: sy + ps[i].dy * T, h: T * ps[i].k }); }
        }
      }
    }
    /* ④ 소품 — 아래(앞)에 있는 것이 위에 오게 */
    if (M && M.drawSprite) {
      props.sort(function (a, b2) { return a.y - b2.y; });
      for (i = 0; i < props.length; i++) { M.drawSprite(ctx, props[i]); }
    }
    return true;
  }

  global.DG = global.DG || {};
  /** W-0226 — 2D(평면·2.5D) 걷기 빠르기(m/초). 2D 는 몸(≈120px)이 지도 칸(48m ≈ 100px)만 해서 3D 빠르기(8m/초)면 화면에선
   *  0.15 몸/초 — 제자리걸음처럼 기어갔다(사용자 10-15 "넘 느리고 자연스럽지 않다 · 젤다처럼"). 화면 몸 높이/초로 맞춘다 —
   *  손잡이 world.walk2dBps 1.8(젤다 「신들의 트라이포스」 걸음 ≈ 2~3 몸/초, 달리기 ×2.2 ≈ 4). bodyM = 화면 몸 높이를 미터로,
   *  base = 3D 빠르기 — 그보다 느려지진 않고, 손잡이 0 이면 base(옛 걸음). 순수 */
  function walkMps(bodyM, base) {
    var C = core(), bps = C && C.tuned ? +C.tuned('world.walk2dBps', 1.8) : 1.8;
    if (!(bodyM > 0) || !(bps > 0)) { return base; }
    return Math.max(base, bps * bodyM);
  }
  /** W-0226 — 걷기 시트 한 바퀴(두 발) 길이 배율. 공용 mode2d.strideK 0.9 몸은 빨라진 2D 걸음엔 종종걸음 — 1만리 2D 는 ×1.45(≈1.3 몸,
   *  1.8 몸/초면 한 바퀴 1.4번/초 ≈ 걸음 2.8/초). 손잡이 world.stride2d */
  /** W-0228 — 2D 떠돌이(야생 인물·펫) 어슬렁거림 = { v 빠르기 m/초, r 반경 m } — 화면 몸 높이로: 손잡이 world.wander2dBps 0.7 몸/초·
   *  world.wander2dR 1.6 몸(3D 값 15m·2.6m/초보다 작아지진 않게 부른 쪽이 max). bodyM ≤ 0 이면 null — 순수 */
  function wander(bodyM) {
    var C = core(), t = function (k, d) { return C && C.tuned ? +C.tuned(k, d) : d; };
    if (!(bodyM > 0)) { return null; }
    return { v: Math.max(0, t('world.wander2dBps', 0.7)) * bodyM, r: Math.max(0, t('world.wander2dR', 1.6)) * bodyM };
  }
  /** W-0232 — 2D 마을 사람 걸음(m/초) = 손잡이 world.npc2dBps 0.6 × 몸 높이(m). bodyM ≤ 0 이면 0 — 순수 */
  function npcMps(bodyM) { var C = core(), b = C && C.tuned ? +C.tuned('world.npc2dBps', 0.6) : 0.6; return bodyM > 0 && b > 0 ? b * bodyM : 0; }
  function strideMul() { var C = core(); return C && C.tuned ? Math.max(0.3, +C.tuned('world.stride2d', 1.45)) : 1.45; }

  global.DG.field2d = { tall: function () { return tall; }, chunkStats: chunkStats, _chunkCells: chunkCells, paintTile: paintTile, autotile: { on: autotileOn, baseOf: baseOf, pairFor: pairFor, dualIndex: dualIndex, seamed: seamed, loaded: function () { return tLoaded; }, json: function () { return tjson; }, _set: function (j) { tjson = j; kindBase = null; tjTried = true; } }, treeRects: treeRects, TALL: TALL, walkMps: walkMps, strideMul: strideMul, wander: wander, npcMps: npcMps, CELL: CELL, color: color, BASE: BASE, zoomMul: zoomMul, KCOL: KCOL, on: on, h01: h01, PROPS: PROPS, propsAt: propsAt, edgeColor: edgeColor, decorate: decorate, seasonRgb: seasonRgb };
})(typeof window !== 'undefined' ? window : this);
