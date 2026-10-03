/**
 * 2D 모드 공용 부품 — 새 2D 스프라이트 시트(K-0015 산출, 판별 `assets/sprites2d_sheets/`)를 읽어 그린다. (W-0019)
 *
 * 시트 규격: `<풀>/<동작>.webp` 한 장 = 가로 프레임 8 × 세로 방향 3행(0 정면·1 옆·2 뒤, 반대 옆은 좌우 뒤집기),
 * 프레임 128px. 동작 idle/walk/attack/hit/death. `<풀>/manifest.json` 이 규격을, `index.json` 이 그 판이 가진 풀 목록을 준다.
 *
 * **정본은 saga-web/shared/js/mode2d.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 판마다 다른 것(풀 ↔ 인물·괴물 종류 표·지금 2D 모드인가)은 각 판 core.js 끝 `DG.cfg.mode2d` 가 준다(부를 때마다 읽으므로 로드 순서는 상관없다):
 *   { base, on(): bool, pools: { <종류>: [풀id…] }, poolH: { <풀id>: 프레임 안 몸 높이(px) }, targetH: 화면에 보일 보통 몸 높이(px), foot: 발 위치(프레임 높이 비율) }
 *   풀마다 몸 크기가 달라(고블린 50px·오크 102px / 프레임 128) poolH 로 같은 높이로 맞춘다. 호출의 scale 은 그 위에 곱하는 배수(보스 등)
 *
 * **자료가 없거나 아직 안 받았으면 아무 것도 안 그리고 false 를 돌려준다** — 부르는 쪽은 그 자리에서 기존 그림(코드 스탬프 등)을 그린다.
 * 즉 에셋이 빠져 있어도 오류 0, 기존 동작 그대로. 이미지는 처음 쓸 때 한 번만 받는다.
 */
(function (global) {
  'use strict';

  /** 판 설정 — 부를 때마다 읽는다(이 파일이 core.js 보다 먼저 로드돼도 된다) */
  function C() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }
  function base() { return C().base || 'assets/sprites2d_sheets/'; }
  var FRAMES = 8, PX = 128, FPS = { idle: 6, walk: 10, attack: 14, hit: 12, death: 10 };
  var ONCE = { attack: true, hit: true, death: true };      // 한 번 돌고 마지막 프레임에 머문다
  var ROW = { front: 0, side: 1, back: 2 };

  var imgs = {};          // 'pool/clip' → { img, ok, fail }
  var index = null, indexTried = false;

  /** 지금 2D 모드인가 — 판이 정한다(없으면 항상 참 — 이 부품을 부른 쪽이 이미 2D 자리에서 부른 것) */
  function isOn() { var c = C(); return c.on ? !!c.on() : true; }

  /** 같은 id 는 늘 같은 풀을 받는다(씨앗 해시) — 판별 표 `pools[종류]` 에서 고른다. 표에 없는 종류는 null(기존 그림) */
  function hashOf(seed) {
    var s = String(seed === undefined || seed === null ? '' : seed), h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function pick(kind, seed) {
    var list = (C().pools || {})[kind];
    if (!list || !list.length) { return null; }
    return list[hashOf(seed) % list.length];
  }

  /** 동작 안의 몇 번째 프레임인가 — 순수 함수. 한 번 도는 동작(attack·hit·death)은 마지막 프레임에 머문다 */
  function frameAt(clip, ms) {
    var fps = FPS[clip] || 8, i = Math.floor(Math.max(0, ms) / 1000 * fps);
    return ONCE[clip] ? Math.min(FRAMES - 1, i) : i % FRAMES;
  }

  /** 보는 쪽 → 시트의 (행, 좌우 뒤집기). 'left'/'right' 는 옆모습(오른쪽이 기준, 왼쪽은 뒤집기) */
  function dirOf(facing) {
    if (facing === 'front') { return { row: ROW.front, flip: false }; }
    if (facing === 'back') { return { row: ROW.back, flip: false }; }
    var left = facing === 'left' || (typeof facing === 'number' && facing < 0);
    return { row: ROW.side, flip: left };
  }

  function getImg(pool, clip) {
    var key = pool + '/' + clip, e = imgs[key];
    if (e) { return e; }
    e = imgs[key] = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };   // 파일이 없으면 영영 기존 그림 — 다시 받으려 들지 않는다
    im.src = base() + pool + '/' + clip + '.webp';
    e.img = im;
    return e;
  }

  /** 풀 하나를 미리 받아 둔다(없으면 조용히 건너뜀) */
  function preload(pool, clips) {
    (clips || ['idle', 'walk', 'attack', 'hit', 'death']).forEach(function (c) { getImg(pool, c); });
  }

  /**
   * 한 프레임을 그린다. o = { pool, clip, facing, ms, x, y(발 밑 가운데), scale(1 = 128px), alpha }
   * 받는 중이거나 파일이 없으면 false(→ 부른 쪽이 기존 그림을 그린다). 그렸으면 true.
   */
  function draw(ctx, o) {
    if (!ctx || !o || !o.pool || !isOn()) { return false; }
    var e = getImg(o.pool, o.clip || 'idle');
    if (!e.ok) {
      /* 받는 동안 몸이 깜박이지 않게 같은 풀의 idle 이 이미 있으면 그걸로 */
      var base = o.clip !== 'idle' ? imgs[o.pool + '/idle'] : null;
      if (!(base && base.ok)) { return false; }
      e = base; o = Object.assign({}, o, { clip: 'idle' });
    }
    var d = dirOf(o.facing), f = frameAt(o.clip || 'idle', o.ms || 0);
    var cf = C(), ph = (cf.poolH || {})[o.pool], sc = (ph ? (cf.targetH || 62) / ph : (cf.scale || 1)) * (o.scale || 1), w = PX * sc, h = PX * sc;
    ctx.save();
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true;
    if (d.flip) { ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.translate(-o.x, 0); }
    ctx.drawImage(e.img, f * PX, d.row * PX, PX, PX, o.x - w / 2, o.y - h * (cf.foot || 0.87), w, h);
    ctx.restore();
    return true;
  }

  /** 풀 목록(index.json)을 한 번 읽어 둔다 — 진단·미리 받기용. 없어도 오류 없음 */
  function loadIndex(cb) {
    if (index || indexTried || !global.fetch) { if (cb) { cb(index); } return; }
    indexTried = true;
    global.fetch(base() + 'index.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { index = j; if (cb) { cb(j); } })['catch'](function () { if (cb) { cb(null); } });
  }

  /* ───── 배경 층·바닥 타일 (K-0020 산출, 판별 `assets/web2d/{bg,tile}/`) ─────
     cfg: { bgBase: 'assets/web2d/bg/', tileBase: 'assets/web2d/tile/' }. 층 규격은 `<지역>.layers.json`
     = { far|mid|near: { y, h, speed, w } } (기준 높이 540 — 그릴 때 화면 높이에 맞춰 비율 환산). 이미지는 `<지역>_<층>.webp`, 좌우 왕복 이음. */
  var LAYERS = ['far', 'mid', 'near'];
  var bgs = {}, tiles = {};          // 지역 → { meta, imgs:{층:{img,ok,fail}}, fail }  /  타일id → { img, ok, fail, pat }
  function bgBase() { return C().bgBase || 'assets/web2d/bg/'; }
  function tileBase() { return C().tileBase || 'assets/web2d/tile/'; }
  function loadImg(url) {
    var e = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };
    im.src = url; e.img = im;
    return e;
  }
  function getBg(region) {
    var b = bgs[region];
    if (b) { return b; }
    b = bgs[region] = { meta: null, imgs: {}, fail: false };
    if (!global.fetch) { b.fail = true; return b; }
    LAYERS.forEach(function (l) { b.imgs[l] = loadImg(bgBase() + region + '_' + l + '.webp'); });
    global.fetch(bgBase() + region + '.layers.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { b.meta = j; } else { b.fail = true; } })['catch'](function () { b.fail = true; });
    return b;
  }
  /** 층 이미지 하나를 가로로 이어 그린다(홀수 칸은 좌우 뒤집어 왕복 — 이음매가 안 보인다). dx = 가로 이동(px) */
  function strip(ctx, img, y, dw, dh, W, dx) {
    var n = Math.floor(dx / dw), off = dx - n * dw, i, x;
    for (i = 0; i * dw - off < W; i++) {
      x = i * dw - off;
      if ((n + i) % 2 !== 0) { ctx.save(); ctx.translate(x + dw, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, y, dw, dh); ctx.restore(); }
      else { ctx.drawImage(img, x, y, dw, dh); }
    }
  }
  /**
   * 층 배경을 그린다 — o = { region, camX, W, H, base(땅 선 y, 기본 H), only: 'near'(그 층만, 없으면 셋 다) }.
   * far 는 하늘(0~base), mid·near 는 땅 선 위로 쌓이는 띠(아래 가장자리가 base). 받는 중이거나 없으면 false(→ 부른 쪽이 기존 하늘·뒷배경을 그린다).
   */
  function drawBg(ctx, o) {
    if (!ctx || !o || !o.region || !isOn()) { return false; }
    var b = getBg(o.region), m = b.meta;
    if (b.fail || !m) { return false; }
    var names = o.only ? [o.only] : LAYERS, base = o.base || o.H || 540, k = base / 540, any = false, i, L, e, dh, dw, y;
    for (i = 0; i < names.length; i++) {
      L = m[names[i]]; e = b.imgs[names[i]];
      if (!L || !e || !e.ok) { continue; }
      dh = L.h * k; y = base - (540 - L.y) * k; dw = L.w * k;
      if (names[i] === 'far') { dh = base; y = 0; }
      strip(ctx, e.img, y, dw, dh, o.W, (o.camX || 0) * (L.speed || 0));
      any = true;
    }
    return any;
  }

  /** 바닥 타일 한 장(256px) — 아직 못 받았으면 null */
  function tile(id) {
    var t = tiles[id];
    if (!t) { t = tiles[id] = loadImg(tileBase() + id + '.webp'); t.pat = null; }
    return t.ok ? t.img : null;
  }
  function tilePattern(ctx, id) {
    var im = tile(id), t = tiles[id];
    if (!im) { return null; }
    if (!t.pat && ctx && ctx.createPattern) { t.pat = ctx.createPattern(im, 'repeat'); }
    return t.pat;
  }
  /** 사각형을 타일로 채운다 — o = { id, x, y, w, h, dx, dy(스크롤), scale(기본 0.25 = 64px) }. 받는 중·없음 → false */
  function fillTile(ctx, o) {
    if (!ctx || !o || !isOn()) { return false; }
    var pat = tilePattern(ctx, o.id);
    if (!pat) { return false; }
    var s = o.scale || 0.25, dx = o.dx || 0, dy = o.dy || 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
    ctx.translate(o.x - dx, o.y - dy);
    ctx.scale(s, s);
    ctx.fillStyle = pat;
    ctx.fillRect(dx / s, dy / s, o.w / s, o.h / s);
    ctx.restore();
    return true;
  }

  global.DG = global.DG || {};
  global.DG.mode2d = {
    drawBg: drawBg, tile: tile, tilePattern: tilePattern, fillTile: fillTile,
    bgReady: function (region) { var b = bgs[region]; return !!(b && b.meta && LAYERS.every(function (l) { return b.imgs[l].ok; })); },
    bgFailed: function (region) { var b = bgs[region]; return b ? b.fail || LAYERS.some(function (l) { return b.imgs[l].fail; }) : null; },
    preloadBg: function (region) { getBg(region); },
    tileOk: function (id) { var t = tiles[id]; return t ? t.ok : null; },
    FRAMES: FRAMES, PX: PX, FPS: FPS,
    isOn: isOn, pick: pick, frameAt: frameAt, dirOf: dirOf, hashOf: hashOf,
    draw: draw, preload: preload, loadIndex: loadIndex,
    /** 진단용 — 그 풀·동작 이미지를 받았나(true/false), 아직 안 불렀으면 null */
    loaded: function (pool, clip) { var e = imgs[pool + '/' + clip]; return e ? e.ok : null; },
    failed: function (pool, clip) { var e = imgs[pool + '/' + clip]; return e ? e.fail : null; }
  };
})(typeof window !== 'undefined' ? window : this);
