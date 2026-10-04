/**
 * RTS 격자 지도 (W-0029, P1) — 160×100 타일. 지형은 시드 노이즈로 만든다(같은 시드 = 같은 지도).
 *   0 풀(건설 가능) · 1 숲 · 2 언덕 · 3 물 — 풀만 짓는다. 가운데 거점 둘레는 늘 풀.
 * 순수 함수만 — 화면·저장과 무관하다. 사가국지 턴제와는 별개 모듈(`DG.rts`).
 */
(function (global) {
  'use strict';

  var W = 160, H = 100;
  var T = { GRASS: 0, FOREST: 1, HILL: 2, WATER: 3 };

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 값 노이즈 — cell 칸마다 난수 격자점, 사이는 부드럽게 이음 */
  function noise(seed, cell) {
    var r = rng(seed), gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = [], i;
    for (i = 0; i < gw * gh; i++) { g.push(r()); }
    function s(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), u = s(fx - ix), v = s(fy - iy);
      var a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    };
  }

  /** 거점(성) 자리 — 가운데 3×3 의 왼쪽 위 */
  function castleSite() { return { x: Math.floor(W / 2) - 1, y: Math.floor(H / 2) - 1, w: 3, h: 3 }; }

  /** 적 기지 자리 — 거점에서 가로로 56칸(시드가 홀수면 동쪽, 짝수면 서쪽), 같은 높이 3×3 */
  function enemySite(seed) { var c = castleSite(), east = (seed >>> 0) % 2 === 1; return { x: c.x + (east ? 56 : -56), y: c.y, w: 3, h: 3 }; }

  function generate(seed) {
    var tiles = new Uint8Array(W * H), elev = noise(seed, 16), elev2 = noise(seed + 101, 6), moist = noise(seed + 202, 10);
    var cx = W / 2, cy = H / 2, x, y, e, m, t, d, es = enemySite(seed), ex = es.x + 1.5, ey = es.y + 1.5;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        e = elev(x, y) * 0.75 + elev2(x, y) * 0.25;
        m = moist(x, y);
        d = Math.hypot(x - cx, y - cy);
        if (d < 12 || Math.hypot(x - ex, y - ey) < 8) { t = T.GRASS; }                 // 거점·적 기지 둘레는 반드시 풀
        else if (e < 0.30) { t = T.WATER; }
        else if (e > 0.72) { t = T.HILL; }
        else if (m > 0.62) { t = T.FOREST; }
        else { t = T.GRASS; }
        tiles[y * W + x] = t;
      }
    }
    return tiles;
  }

  function inBounds(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function idx(x, y) { return y * W + x; }
  /** 건설 가능한 땅인가(풀) */
  function buildable(tiles, x, y) { return inBounds(x, y) && tiles[idx(x, y)] === T.GRASS; }

  global.DG = global.DG || {};
  global.DG.rts = global.DG.rts || {};
  global.DG.rts.grid = { W: W, H: H, T: T, rng: rng, generate: generate, castleSite: castleSite, enemySite: enemySite, inBounds: inBounds, idx: idx, buildable: buildable };
})(typeof window !== 'undefined' ? window : this);
