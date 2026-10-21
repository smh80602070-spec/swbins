/**
 * 2D 겹 배경 — 오딘스피어 문법(W-0336): 그림 배경 5~7 겹, 깊이마다 다른 빠르기·층 사이 안개색·빛 띠. 다섯 판 공용.
 *
 * ── 규격(자체툴이 그림을 만들 때) ──────────────────────────────────────────────
 *   폴더 `<cfg.mode2d.parallaxBase | assets/web2d/bg2d/>`<장소>/layers.json + 층 그림(알파 WebP, 가로로 이어지게 — 홀수 칸은 뒤집어 이음매를 숨긴다)
 *   layers.json
 *     { "fog": "#9fb6c8",                                   층 사이 안개색(먼 층일수록 진하게 섞는다)
 *       "layers": [ { "img": "sky.webp", "depth": 0.02, "top": 0, "h": 1 },          하늘 — 화면 전체
 *                   { "img": "far.webp", "depth": 0.15, "bottom": 0.62, "h": 0.40, "fog": 0.45 },
 *                   { "img": "mid.webp", "depth": 0.40, "bottom": 0.74, "h": 0.40, "fog": 0.25 },
 *                   { "img": "near.webp", "depth": 0.75, "bottom": 0.86, "h": 0.36, "fog": 0.1 },
 *                   { "img": "ground.webp", "depth": 1.0, "bottom": 1, "h": 0.22 },
 *                   { "img": "front.webp", "depth": 1.25, "bottom": 1, "h": 0.12, "front": true, "alpha": 0.85 } ],
 *       "light": { "color": "#ffe2a8", "a": 0.18, "angle": -20 } }       빛 띠(선택) — 하늘·먼 층 위 비스듬한 빛
 *   depth 0 = 안 움직임 · 1 = 카메라와 같이(땅) · 1 넘음 = 앞 층(인물 앞에 그린다, "front": true). bottom·top·h 는 화면 키 비율.
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────────────────────
 *   DG.parallax2d.draw(ctx, 장소, { camX, camY, W, H, front })   front 가 참이면 앞 층만, 아니면 뒤 층 전부. 그렸으면 true
 *   mode2d.drawBg 가 맨 앞에서 drawFor(ctx, o) 를 부른다 — 손잡이 `parallax2d.on`: 0(기본) 끔 · 1 그 장소 layers.json 이 있으면 · 2 대역(_stub, 코드로 칠한 층)
 *   layerX(depth, camX, tileW) 순수(진단) · '_stub' 장소는 그림 없이 코드로 칠한다(보기·대역).
 * 정본은 saga-web/shared/js/parallax2d.js — 판별 사본은 tools/sync-shared.mjs.
 */
(function (global) {
  'use strict';
  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function cfg() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }
  function base() { return cfg().parallaxBase || 'assets/web2d/bg2d/'; }

  /** 층 가로 어긋남(순수) — 0 ≤ 값 < tileW */
  function layerX(depth, camX, tileW) { var d = (+camX || 0) * (+depth || 0), w = Math.max(1, tileW); return ((d % w) + w) % w; }

  /* ── 대역 장소(_stub) — 코드로 칠한 하늘·산·언덕·숲·땅·앞 풀 ── */
  var STUB_W = 1024;
  function mk(w, h, paint) { var c = global.document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }
  function hills(ctx, w, h, amp, fr, ph, fill) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(0, h);
    for (var x = 0; x <= w; x += 8) { var u = x / w * Math.PI * 2; ctx.lineTo(x, h * 0.35 + amp * h * (0.5 + 0.3 * Math.sin(u * fr + ph) + 0.2 * Math.sin(u * fr * 2.3 + ph * 1.7))); }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  function trees(ctx, w, h, n, fill, seed) {
    ctx.fillStyle = fill;
    for (var i = 0; i < n; i++) { var x = (i + 0.5) * w / n + Math.sin(i * 7.1 + seed) * w / n * 0.3, th = h * (0.55 + 0.35 * Math.abs(Math.sin(i * 3.3 + seed))), tw = th * 0.45;
      ctx.beginPath(); ctx.moveTo(x, h - th); ctx.lineTo(x - tw / 2, h); ctx.lineTo(x + tw / 2, h); ctx.closePath(); ctx.fill(); }
  }
  var stub = null;
  function stubPlace() {
    if (stub) { return stub; }
    if (!global.document) { return null; }
    var L = [
      { depth: 0.02, top: 0, h: 1, img: mk(STUB_W, 256, function (c, w, h) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5f86b8'); g.addColorStop(0.7, '#c9d9e6'); g.addColorStop(1, '#f2e6cf'); c.fillStyle = g; c.fillRect(0, 0, w, h); }) },
      { depth: 0.12, bottom: 0.62, h: 0.42, fog: 0.5, img: mk(STUB_W, 256, function (c, w, h) { hills(c, w, h, 0.9, 2, 0.4, '#6c7f9e'); }) },
      { depth: 0.35, bottom: 0.74, h: 0.40, fog: 0.3, img: mk(STUB_W, 256, function (c, w, h) { hills(c, w, h, 0.7, 3, 1.9, '#557a63'); trees(c, w, h, 14, '#47684f', 1); }) },
      { depth: 0.7, bottom: 0.86, h: 0.34, fog: 0.12, img: mk(STUB_W, 256, function (c, w, h) { trees(c, w, h, 9, '#2f4f3a', 4); hills(c, w, h, 0.25, 4, 0.7, '#3d6247'); }) },
      { depth: 1.0, bottom: 1, h: 0.2, img: mk(STUB_W, 128, function (c, w, h) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8a7350'); g.addColorStop(1, '#5c4a32'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#6f9a4e'; c.fillRect(0, 0, w, h * 0.12); }) },
      { depth: 1.3, bottom: 1, h: 0.1, front: true, alpha: 0.9, img: mk(STUB_W, 96, function (c, w, h) { c.fillStyle = '#24402a'; for (var x = 0; x < w; x += 6) { var gh = h * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.07))); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 3, h - gh); c.lineTo(x + 6, h); c.fill(); } }) }
    ];
    stub = { ok: true, meta: { fog: '#b9c8d4', light: { color: '#ffe2a8', a: 0.16, angle: -18 }, layers: L }, imgs: null };
    return stub;
  }

  /* ── 받기 ── */
  var places = {};
  function placeOf(id) {
    if (id === '_stub') { return stubPlace(); }
    var p = places[id];
    if (p) { return p.ok ? p : null; }
    p = places[id] = { ok: false, meta: null };
    if (!global.fetch) { return null; }
    global.fetch(base() + id + '/layers.json').then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) {
      var n = (j.layers || []).length, done = 0;
      (j.layers || []).forEach(function (L) {
        var im = new global.Image(); im.onload = im.onerror = function () { if (++done >= n) { p.ok = true; } }; im.src = base() + id + '/' + L.img; L.img = im;
      });
      p.meta = j; if (!n) { p.ok = true; }
    }, function () { p.fail = true; });
    return null;
  }

  function ready(im) { return im && (im.getContext || (im.complete && im.naturalWidth)); }
  /** W-0353 층 안개 — 그림의 알파 안에만 안개색을 얹은 사본(원래 크기, 층마다 하나 · 안개색·세기가 바뀌면 다시). 옛: 띠 전체 fillRect 라 알파 밖(하늘 자리)까지 사각형으로 칠했다 */
  function fogged(L, fog) {
    var k = fog + '|' + L.fog, c = L._fogC;
    if (c && c.k === k) { return c.cv; }
    if (!global.document) { return null; }
    var iw = L.img.width || L.img.naturalWidth, ih = L.img.height || L.img.naturalHeight, cv = global.document.createElement('canvas'), g;
    cv.width = iw; cv.height = ih; g = cv.getContext('2d');
    g.drawImage(L.img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = Math.min(1, Math.max(0, +L.fog)); g.fillStyle = fog; g.fillRect(0, 0, iw, ih);
    L._fogC = { k: k, cv: cv };
    return cv;
  }
  function draw(ctx, id, o) {
    var P = placeOf(id); if (!P || !ctx || !o) { return false; }
    var m = P.meta, W = o.W, H = o.H, L, i, any = false, fog = m.fog;
    for (i = 0; i < (m.layers || []).length; i++) {
      L = m.layers[i];
      if (!!L.front !== !!o.front || !ready(L.img)) { continue; }
      var iw = L.img.width || L.img.naturalWidth, ih = L.img.height || L.img.naturalHeight, dh = (L.h || 1) * H, dw = iw * dh / ih;
      var y = L.top !== undefined ? L.top * H : (L.bottom !== undefined ? L.bottom : 1) * H - dh;
      y -= (+o.camY || 0) * (L.depth || 0) * 0.3;
      var off = layerX(L.depth, o.camX, dw), n = Math.floor(((+o.camX || 0) * (L.depth || 0)) / dw), k, x, src = fog && L.fog ? (fogged(L, fog) || L.img) : L.img;
      ctx.save();
      if (L.alpha !== undefined) { ctx.globalAlpha = L.alpha; }
      for (k = 0; k * dw - off < W; k++) {
        x = Math.round(k * dw - off);
        if ((n + k) % 2 !== 0) { ctx.save(); ctx.translate(x + dw, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, y, dw + 1, dh); ctx.restore(); }
        else { ctx.drawImage(src, x, y, dw + 1, dh); }
      }
      /* 층 사이 안개 — 먼 층일수록 진하게(대기 원근) · W-0353 위 fogged 사본이 그림 모양 안에만 칠한다 */
      ctx.restore();
      if (!o.front && m.light && i === 1) {   // 빛 띠 — 하늘·먼 산 위
        ctx.save(); ctx.globalAlpha = m.light.a || 0.15; ctx.fillStyle = m.light.color || '#fff';
        ctx.translate(W * 0.7, 0); ctx.rotate((m.light.angle || -20) * Math.PI / 180);
        ctx.fillRect(-W * 0.06, -H * 0.2, W * 0.12, H * 1.6); ctx.fillRect(W * 0.12, -H * 0.2, W * 0.05, H * 1.6);
        ctx.restore();
      }
      any = true;
    }
    return any;
  }
  /** mode2d.drawBg 의 갈래 — o = { region, camX, W, H, base } · 손잡이 parallax2d.on 0 이면 아무것도 안 한다 */
  function drawFor(ctx, o) {
    var cf = global.DG.cfg && global.DG.cfg.mode2d, mode = +tuned('parallax2d.on', (cf && cf.parallaxOn) || 0);   // W-0353 판 기본값(cfg.mode2d.parallaxOn — 4종횡 1)
    if (!mode || !o) { return false; }
    return draw(ctx, mode >= 2 ? '_stub' : o.region, { camX: o.camX, camY: o.camY, W: o.W, H: o.base || o.H, front: !!o.front });
  }

  global.DG = global.DG || {};
  global.DG.parallax2d = { layerX: layerX, draw: draw, drawFor: drawFor, has: function (id) { return !!placeOf(id); } };
})(window);
