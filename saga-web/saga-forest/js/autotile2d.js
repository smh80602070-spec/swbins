/**
 * autotile2d — K-0162 이음 타일(이중 격자 wang16-corner-dualgrid) 공용 읽기·고르기 (W-0390)
 * ---------------------------------------------------------------
 * 판 `assets/web2d/tile/tiles.json`: 쌍(pairs)마다 4×4 아틀라스(칸 px 256 · stride 272 · gutter 8)와 바탕 둘(a·b)·땅 종류 목록(kinds_a/kinds_b).
 * 반 칸(왼쪽 위로) 밀린 격자의 칸 (x,y) 네 모서리 = 땅 칸 (x,y)·(x+1,y)·(x,y+1)·(x+1,y+1), i = NW1+NE2+SW4+SE8(비트 = 그 모서리가 a).
 *
 *   var A = DG.autotile2d.make('assets/web2d/tile/');   A.ready() 가 true 면(tiles.json 받음) A.pick(k0, k1, k2, k3) → { img, sx, sy, sw, sh } | null
 *   한 바탕이면 바탕 타일, 두 바탕이 쌍이면 아틀라스 칸, 쌍이 없으면 NW 바탕(그림이 아직이면 null — 부른 쪽이 옛 길로).
 *   순수: baseOf·pairFor·dualIndex·cellOf·seamed — 진단이 _set(json) 으로 넣고 본다. 그림은 Image 캐시(loaded() 수가 늘면 부른 쪽이 캐시를 다시 굽는다).
 */
(function (global) {
  'use strict';

  function make(base) {
    var json = null, tried = false, imgs = {}, loaded = 0, kindBase = null;
    function load() {
      if (tried || !global.fetch) { return; }
      tried = true;
      global.fetch(base + 'tiles.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { json = j; kindBase = null; })['catch'](function () { json = null; });
    }
    function ready() { if (!json) { load(); } return !!(json && json.pairs); }
    function img(key, url) {
      var e = imgs[key];
      if (e) { return e.ok ? e.img : null; }
      if (typeof Image === 'undefined') { imgs[key] = { ok: false }; return null; }
      e = imgs[key] = { ok: false, img: new Image() };
      e.img.onload = function () { e.ok = true; loaded++; };
      e.img.src = url;
      return null;
    }
    function baseOf(kind) {
      if (!json || !json.pairs) { return null; }
      if (!kindBase) { kindBase = {}; Object.keys(json.pairs).forEach(function (k) { var P = json.pairs[k]; (P.kinds_a || []).forEach(function (x) { kindBase[x] = kindBase[x] || P.a; }); (P.kinds_b || []).forEach(function (x) { kindBase[x] = kindBase[x] || P.b; }); }); }
      return kindBase[kind] || null;
    }
    function pairFor(b1, b2) {
      if (!json || !json.pairs || !b1 || !b2 || b1 === b2) { return null; }
      var k, P;
      for (k in json.pairs) { if (!json.pairs.hasOwnProperty(k)) { continue; } P = json.pairs[k]; if (P.a === b1 && P.b === b2) { return { key: k, P: P, aFirst: true }; } if (P.a === b2 && P.b === b1) { return { key: k, P: P, aFirst: false }; } }
      return null;
    }
    function dualIndex(nwA, neA, swA, seA) { return (nwA ? 1 : 0) + (neA ? 2 : 0) + (swA ? 4 : 0) + (seA ? 8 : 0); }
    function px() { return (json && json.px) || 256; }
    function cellOf(i) { var ST = (json && json.stride) || 272, GU = (json && json.gutter) || 8; return [(i % 4) * ST + GU, Math.floor(i / 4) * ST + GU]; }
    function seamed(k1, k2) { var a = baseOf(k1), b = baseOf(k2); return !!(a && b && (a === b || pairFor(a, b))); }
    /** 네 모서리 땅 종류 → 그릴 것 */
    function pick(k0, k1, k2, k3) {
      var b0 = baseOf(k0), b1 = baseOf(k1), b2 = baseOf(k2), b3 = baseOf(k3), P = px(), im, pr, c, keys, set = {};
      if (!b0) { return null; }
      if (b0 === b1 && b0 === b2 && b0 === b3) { im = img(b0, base + b0 + '.webp'); return im ? { img: im, sx: 0, sy: 0, sw: im.naturalWidth || P, sh: im.naturalHeight || P, kind: 'base' } : null; }
      set[b0] = 1; if (b1) { set[b1] = 1; } if (b2) { set[b2] = 1; } if (b3) { set[b3] = 1; }
      keys = Object.keys(set); pr = keys.length === 2 ? pairFor(keys[0], keys[1]) : null;
      if (pr) {
        im = img('pair:' + pr.key, base + pr.P.atlas);
        if (!im) { return null; }
        c = cellOf(dualIndex(b0 === pr.P.a, b1 === pr.P.a, b2 === pr.P.a, b3 === pr.P.a));
        return { img: im, sx: c[0], sy: c[1], sw: P, sh: P, kind: 'pair', pair: pr.key };
      }
      im = img(b0, base + b0 + '.webp');
      return im ? { img: im, sx: 0, sy: 0, sw: im.naturalWidth || P, sh: im.naturalHeight || P, kind: 'nw' } : null;
    }
    return { base: base, load: load, ready: ready, json: function () { return json; }, baseOf: baseOf, pairFor: pairFor, dualIndex: dualIndex, cellOf: cellOf, px: px, seamed: seamed, pick: pick, loaded: function () { return loaded; }, _set: function (j) { json = j; kindBase = null; tried = true; } };
  }

  global.DG = global.DG || {};
  global.DG.autotile2d = { make: make };
})(typeof window !== 'undefined' ? window : this);
