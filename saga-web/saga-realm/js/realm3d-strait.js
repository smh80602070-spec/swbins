/**
 * 5천하 3D 지도 해협(섬을 가르는 진짜 바다) — 해협 세기·땅 높이·바다 판정·땅 그림 — realm3d.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * realm3d.js 가 `bind({ cityData, three, hashOf, GROUND_SPAN, BIOME_COLOR, NOISE_AMP, smoothstep, baseNoise, cityBump, worldX, worldZ, SEA_LEVEL })` 로 손잡이를 넘기고 같은 이름으로 부른다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, cityData, three, hashOf, GROUND_SPAN, BIOME_COLOR, NOISE_AMP, smoothstep, baseNoise, cityBump, worldX, worldZ, SEA_LEVEL;
  var api = null;
  function bind(g) { if (G !== g) { G = g; cityData = g.cityData; three = g.three; hashOf = g.hashOf; GROUND_SPAN = g.GROUND_SPAN; BIOME_COLOR = g.BIOME_COLOR; NOISE_AMP = g.NOISE_AMP; smoothstep = g.smoothstep; baseNoise = g.baseNoise; cityBump = g.cityBump; worldX = g.worldX; worldZ = g.worldZ; SEA_LEVEL = g.SEA_LEVEL; } return api; }

  /* ── 해협(海峽) — 섬을 가르는 진짜 바다 ──────────────────────
   * `CD.isWater()`는 강(river) 지형끼리 맞닿으면 다 물길로 잡는데, 그 안에는
   * 양자강·한수 같은 **내륙 강**도 섞여 있다(실측해 보니 거리로는 못 가른다 —
   * 예컨대 대륙 안 수춘↔시상 19.7 이 김해↔대마도 11.7 보다 오히려 멀다).
   * 진짜로 **뭍을 갈라 섬을 만드는 바다**는 PLAN.md 26-2절에 적힌 이 다섯
   * 구간뿐이다(일본 열도를 대륙·서로 갈라놓는 대한해협·일기해협·간몬해협
   * 셋, 교주의 연안 항로 하나 — 김해↔대마도는 그 시작점) — 그래서 휴리스틱
   * 대신 여기 목록으로 못 박는다. 이 구간 둘레만 지형을 해수면 아래로
   * 파내려, 나머지 물길(내륙 강)은 예전 그대로 얇은 파란 길(addRoad)로 남는다. */
  var STRAITS = [
    ['gimhae', 'tsushima'], ['tsushima', 'iki'], ['iki', 'chikushi'],
    ['chikushi', 'izumo'], ['hepu', 'jiaozhi'],
    /* 2026-09-22 — 대진(안식↔려건, 감영이 실제로 못 건넌 "서해")·
       남해(합포↔주애 경주해협, 주애↔이주 대만해협) 세 구간을 더했다 */
    ['anxi', 'lijian'], ['hepu', 'zhuya'], ['zhuya', 'yizhou']
  ];
  var STRAIT_HALF_WIDTH = 30;      // 해협 폭의 절반(세계 단위) — 이 안쪽이 바다
  var STRAIT_DEPTH = 22;           // 해협 바닥이 SEA_LEVEL 아래로 파이는 깊이
  var STRAIT_LAND_MARGIN = 18;     // 구간 양 끝(=섬 성 그 자체)에서 이만큼은 절대 안 파인다
                                    // 성과 먼 빈 들판이 우연히 물에 잠기지 않도록 한다

  var straitSegs = null;
  function straitSegments() {
    if (straitSegs) { return straitSegs; }
    straitSegs = [];
    var i, a, b;
    for (i = 0; i < STRAITS.length; i++) {
      a = cityData().find(STRAITS[i][0]); b = cityData().find(STRAITS[i][1]);
      if (!a || !b) { continue; }
      var ax = worldX(a.x), az = worldZ(a.y), bx = worldX(b.x), bz = worldZ(b.y);
      straitSegs.push({ ax: ax, az: az, bx: bx, bz: bz, len: Math.hypot(bx - ax, bz - az) });
    }
    return straitSegs;
  }

  /** 가장 가까운 해협 구간까지 거리 → 0(구간 위)~1(폭 밖) 파임 비율.
   *  **두 축을 같이 본다** — ①구간에 대한 수직 거리(폭, STRAIT_HALF_WIDTH)
   *  ②구간을 따라 잰 거리(구간 양 끝에서 STRAIT_LAND_MARGIN 안쪽은 안 판다).
   *  둘째 축이 없으면 구간의 두 끝점 — 대마도·일기도 같은 **섬 성 그 자체** —
   *  이 자기 자리에서 거리 0 으로 잡혀 성이 통째로 물에 잠긴다. 가운데
   *  트인 바다만 파이고, 두 기슭은 smoothstep 으로 매끄럽게 뭍으로 돌아간다 */
  function straitFactor(wx, wz) {
    var segs = straitSegments(), i, s, best = 0;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      var dx = s.bx - s.ax, dz = s.bz - s.az, len2 = dx * dx + dz * dz;
      var tt = len2 > 0 ? ((wx - s.ax) * dx + (wz - s.az) * dz) / len2 : 0;
      tt = Math.max(0, Math.min(1, tt));
      var d = Math.hypot(wx - (s.ax + dx * tt), wz - (s.az + dz * tt));
      if (d >= STRAIT_HALF_WIDTH) { continue; }
      var fPerp = 1 - smoothstep(d / STRAIT_HALF_WIDTH);
      var margin = Math.min(STRAIT_LAND_MARGIN, s.len * 0.45);
      var alongEdge = Math.min(tt, 1 - tt) * s.len;
      var fAlong = margin > 0 ? smoothstep(Math.max(0, Math.min(1, alongEdge / margin))) : 1;
      var f = fPerp * fAlong;
      if (f > best) { best = f; }
    }
    return best;
  }

  /** 지형 높이 — 이 함수 하나가 바닥 · 성 · 소품 · 길 · 카메라가 다 같이 읽는
   *  단일 진실 값이다(따로 잰 높이를 쓰면 소품이 바닥에 파묻히거나 뜬다) */
  function elevAt(wx, wz) {
    var normal = baseNoise(wx, wz) * NOISE_AMP + cityBump(wx, wz);
    var f = straitFactor(wx, wz);
    if (!f) { return normal; }
    var seaFloor = SEA_LEVEL - STRAIT_DEPTH;
    return normal + (seaFloor - normal) * f;
  }

  /** 이 자리가 물속인가 — scatterAround·scatterField 등 소품을 흩는 자리마다
   *  물어봐서, 해협 한복판(트인 바다)에 나무·바위·집이 잠겨 서는 일을 막는다 */
  function isSea(wx, wz) { return elevAt(wx, wz) < SEA_LEVEL; }

  /** 바닥 — 단색 한 장이 밋밋해서(퀄리티 피드백) **성 지형(land)마다 다른 색을
   *  그 둘레로 은은하게 물들이고**(들판=풀빛·구릉=흙빛·강가=옅은 청록·산=잿빛),
   *  그 위에 옅은 얼룩 점묘를 얹는다. 실제 사진이 아니라 해시로 찍은 점묘·원이라
   *  매번 같다(진단 결정성과 같은 이유) — `cityData()` 가 성마다의 x·y·land 를
   *  훑을 뿐 새 데이터를 만들지 않는다("코드가 아니라 값을 재사용" 원칙). */
  function groundTexture() {
    var t = three();
    var size = 512;
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    var c = cv.getContext('2d');
    c.fillStyle = BIOME_COLOR.plain;
    c.fillRect(0, 0, size, size);

    function toPx(wx, wz) {
      return { x: (wx + GROUND_SPAN / 2) / GROUND_SPAN * size, y: (wz + GROUND_SPAN / 2) / GROUND_SPAN * size };
    }

    var cities = cityData().CITIES, i;
    for (i = 0; i < cities.length; i++) {
      var city = cities[i];
      var land = city.land || 'plain';
      if (land === 'plain') { continue; }        // 바탕색과 같아 그릴 것이 없다
      var col = BIOME_COLOR[land] || BIOME_COLOR.plain;
      var p = toPx(worldX(city.x), worldZ(city.y));
      var rad = size * 0.085;
      var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(p.x, p.y, rad, 0, Math.PI * 2); c.fill();
    }

    var n = 3200;
    for (i = 0; i < n; i++) {
      var hh = hashOf('gtex:' + i);
      var x = hh % size, y = (hh >> 9) % size, r = 1.4 + (hh % 3);
      var tone = (hh >> 18) % 3;
      c.fillStyle = tone === 0 ? 'rgba(120,150,70,0.10)' : (tone === 1 ? 'rgba(235,228,175,0.08)' : 'rgba(90,128,58,0.12)');
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }

    var tex = new t.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = t.ClampToEdgeWrapping;
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    return tex;
  }

  api = { bind: bind, straitFactor: straitFactor, elevAt: elevAt, isSea: isSea, groundTexture: groundTexture };
  global.DG = global.DG || {};
  global.DG.realm3dStrait = api;
})(typeof window !== 'undefined' ? window : this);
