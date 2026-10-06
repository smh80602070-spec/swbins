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
  var FRAMES = 8, PX = 128, FPS = { idle: 6, walk: 10, attack: 14, attack2: 14, heavy: 11, hit: 12, death: 10, knockdown: 10 };
  var ONCE = { attack: true, attack2: true, heavy: true, hit: true, death: true, knockdown: true };      // 한 번 돌고 마지막 프레임에 머문다
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
  /** 짐승형 적 → { pool, k } (W-0051) — 판 cfg.mode2d.beast = { 이름: ['beast_wolf', 몸 배수] } 에 든 어울리는 적만. 없으면 null(옛 스탬프) */
  function beastOf(name) {
    var t = (C().beast || {})[name];
    return t && isStill(t[0]) ? { pool: t[0], k: t[1] || 1 } : null;
  }

  /* ── VRoid 2D 시트(W-0074 2D) — 사람은 시대 구분 없이 VRoid 로 만든 시트(`shared/assets/characters2d/<id>/`, 규격은 위와 같음)로.
     판 설정 `cfg.mode2d.vroid2d = { kinds: [사람 종류…], h: 프레임 안 몸 높이(px), foot }` 가 있는 판·종류만. 제 시트가 있는 인물(도감·장수 299)은
     제 것, 없는 사람(주민·적·나)은 3D 와 같은 빌린 몸(assets3d.borrowRecipe) — 2D·3D 에서 같은 사람이 같은 몸. 통일 에셋 시험이 안 됐으면 null(옛 풀) */
  var VPRE = 'vroid:';
  function vroidPick(kind, seed) {
    var v = C().vroid2d, A = global.DG && global.DG.assets3d;
    if (!v || (v.kinds || []).indexOf(kind) < 0 || !A || !A.state || A.state() !== 'ok') { return null; }
    var id = String(seed === undefined || seed === null ? '' : seed);
    if (id && A.has('hero', id)) { return VPRE + id; }
    var r = A.borrowRecipe && A.borrowRecipe(id || kind);
    return r && r.key && r.key.indexOf('uni:') === 0 ? VPRE + r.key.slice(4) : null;
  }
  function isVroid(pool) { return typeof pool === 'string' && pool.indexOf(VPRE) === 0; }

  function pick(kind, seed) {
    var vp = vroidPick(kind, seed);
    if (vp) { return vp; }
    var list = (C().pools || {})[kind];
    if (!list || !list.length) { return null; }
    return list[hashOf(seed) % list.length];
  }

  /** 동작 안의 몇 번째 프레임인가 — 순수 함수. 한 번 도는 동작(attack·hit·death)은 마지막 프레임에 머문다 */
  function frameAt(clip, ms) {
    var fps = FPS[clip] || 8, i = Math.floor(Math.max(0, ms) / 1000 * fps);
    return ONCE[clip] ? Math.min(FRAMES - 1, i) : i % FRAMES;
  }

  /** 움직인 쪽 → 보는 쪽(W-0073 단계 1) — 세로가 가로보다 확실히 크면 'front'(화면 아래로)·'back'(위로), 아니면 좌우 side(±1).
   *  (dx, dy) 는 마지막 이동 방향(멈춰도 남겨 둔 값) — 위로 걷다 서면 뒷모습 그대로. 둘 다 0 이면 side */
  function face(dx, dy, side) {
    dx = +dx || 0; dy = +dy || 0;
    return Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'front' : 'back') : side;
  }

  /** 보는 쪽 → 시트의 (행, 좌우 뒤집기). 'left'/'right' 는 옆모습(오른쪽이 기준, 왼쪽은 뒤집기) */
  function dirOf(facing) {
    if (facing === 'front') { return { row: ROW.front, flip: false }; }
    if (facing === 'back') { return { row: ROW.back, flip: false }; }
    var left = facing === 'left' || (typeof facing === 'number' && facing < 0);
    return { row: ROW.side, flip: left };
  }

  /* ── 8방향 무기 시트(W-0073, K-0029 단계 5) — `characters2d8/<id>/<역할>.webp` 8프레임 × 5행(d0 정면·d1 오른쪽 앞 3/4·d2 오른쪽 옆·
     d3 오른쪽 뒤 3/4·d4 뒤, 왼쪽 셋은 d1~d3 좌우 뒤집기). 어느 인물에 있나·칸 크기·카메라 높이는 assets3d-ids `hero2d8 = {id: [px, cam_z]}`
     (폴더에서 생성 — 파일을 두드리지 않아 404 가 없다). 표에 없으면 지금 3행 시트 그대로 */
  var ROLES8 = { idle: 1, walk: 1, attack: 1, attack2: 1, heavy: 1, hit: 1, death: 1, knockdown: 1 };
  var PPM = 51.2;   // 1m = 51.2px — 128 칸(2.5m)·192 칸(3.75m) 공통(K-0029 manifest px_per_m)
  function sheet8(pool) {
    var t = isVroid(pool) && global.DG && global.DG.assets3dIds && global.DG.assets3dIds.hero2d8;
    return (t && t[pool.slice(VPRE.length)]) || null;
  }
  /** 동작 이름 → 시트에 있는 역할. 8방향은 8역할, 3행 시트는 idle·walk·attack·hit·death 다섯(나머지는 가까운 것) */
  function roleOf(clip, eight) {
    clip = clip || 'idle';
    if (eight) { return ROLES8[clip] ? clip : (/^attack/.test(clip) ? 'attack' : 'idle'); }
    return { attack2: 'attack', heavy: 'attack', knockdown: 'death' }[clip] || (FPS[clip] && clip) || 'idle';   // 3행 시트에 없는 이름은 idle(없는 파일 404 막기)
  }
  /** 움직인 쪽(dx, dy — 화면 아래가 +) → 8방향 행·뒤집기. 45° 칸. 둘 다 0 이면 facing('front'·'back'·±1·'left'/'right')으로 */
  function dirOf8(dx, dy, facing) {
    dx = +dx || 0; dy = +dy || 0;
    var k;
    if (dx || dy) { k = Math.round(Math.atan2(dx, dy) / (Math.PI / 4)); }      // 0 정면(아래) · 2 오른쪽 · ±4 뒤 · 음수 = 왼쪽
    else if (facing === 'front') { k = 0; } else if (facing === 'back') { k = 4; }
    else { k = (facing === 'left' || (typeof facing === 'number' && facing < 0)) ? -2 : 2; }
    if (k === -4) { k = 4; }
    return { row: Math.abs(k), flip: k < 0 };
  }

  function getImg(pool, clip, eight) {
    var key = pool + '/' + clip + (eight ? '#8' : ''), e = imgs[key];
    if (e) { return e; }
    e = imgs[key] = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };   // 파일이 없으면 영영 기존 그림 — 다시 받으려 들지 않는다
    im.src = isVroid(pool) ? global.DG.assets3d.root() + (eight ? 'characters2d8/' : 'characters2d/') + pool.slice(VPRE.length) + '/' + clip + '.webp' : base() + pool + '/' + clip + '.webp';
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
    if (isStill(o.pool)) { return drawStill(ctx, o); }      // 한 장 모드 풀(W-0032)
    var s8 = sheet8(o.pool), eight = !!s8, role = roleOf(o.clip, eight), e = getImg(o.pool, role, eight);
    if (eight && !e.ok) {
      /* 8방향이 아직 안 왔으면(받는 중·실패) 같은 사람의 3행 시트로 — 몸이 깜박이지 않게 */
      eight = false; s8 = null; role = roleOf(o.clip, false); e = getImg(o.pool, role, false);
    }
    if (!e.ok) {
      /* 받는 동안 몸이 깜박이지 않게 같은 풀의 idle 이 이미 있으면 그걸로 */
      var base = role !== 'idle' ? imgs[o.pool + '/idle' + (eight ? '#8' : '')] : null;
      if (!(base && base.ok)) { return false; }
      e = base; role = 'idle';
    }
    var P = eight ? s8[0] : PX, d = eight ? dirOf8(o.dirX, o.dirY, o.facing) : dirOf(o.facing), f = frameAt(role, o.ms || 0);
    var cf = C(), vr = isVroid(o.pool) && cf.vroid2d, ph = vr ? (vr.h || 85) : (cf.poolH || {})[o.pool], sc = (ph ? (cf.targetH || 62) / ph : (cf.scale || 1)) * (o.scale || 1), w = P * sc, h = P * sc;
    var foot = eight ? (P / 2 + s8[1] * PPM + 1.5) / P : ((vr && vr.foot) || cf.foot || 0.87);   // 8방향 칸: 가운데 + 카메라 높이(실측 114/128·156/192 와 ±1px)
    ctx.save();
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true;
    if (d.flip) { ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.translate(-o.x, 0); }
    ctx.drawImage(e.img, f * P, d.row * P, P, P, o.x - w / 2, o.y - h * foot, w, h);
    ctx.restore();
    return true;
  }

  /* ── 한 장 모드(W-0032) — K-0056 정면·옆·뒤 정지 그림 3장(256px 알파, 발 밑 y≈251, 몸 높이 ≈240)에 걸음·숨쉬기를 코드로 얹는다.
     `cfg.still = { <풀id>: true }` 인 풀만 이 길로 온다. 그림 `<stillBase>/<풀>/<front|side|back>.webp`(기본 assets/web2d/moving/) — 면이 없으면 side 로 대신 */
  var SPX = 256, SBODY = 240, SFOOT = 252 / 256, SVIEW = ['front', 'side', 'back'];
  var stills = {};        // '풀/면' → { img, ok, fail }
  function stillBase() { return C().stillBase || 'assets/web2d/moving/'; }
  function isStill(pool) { var s = C().still; return !!(s && s[pool]); }
  function getStill(pool, view) {
    var key = pool + '/' + view, e = stills[key];
    if (e) { return e; }
    e = stills[key] = { img: null, ok: false, fail: false };
    if (!global.Image) { e.fail = true; return e; }
    var im = new global.Image();
    im.onload = function () { e.ok = true; };
    im.onerror = function () { e.fail = true; };
    im.src = stillBase() + pool + '/' + view + '.webp';
    e.img = im;
    return e;
  }
  /** 동작·시각 → 몸짓 { dx(몸 높이 비율·앞으로), dy(위로 −), rot(라디안), sx, sy, alpha } — 순수 함수 */
  function stillPose(clip, ms) {
    var p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, alpha: 1 }, t = Math.max(0, ms || 0), a, k;
    if (clip === 'walk') {
      a = t / 1000 * Math.PI * 2 * 2.2; k = Math.abs(Math.sin(a));
      p.dy = -0.035 * k; p.rot = Math.sin(a) * 0.05; p.sy = 1 + 0.02 * k; p.sx = 1 - 0.015 * k;
    } else if (clip === 'attack') {
      k = Math.sin(Math.min(1, t / 450) * Math.PI);
      p.dx = 0.14 * k; p.rot = 0.12 * k; p.sx = 1 + 0.06 * k; p.sy = 1 - 0.05 * k;
    } else if (clip === 'hit') {
      k = Math.min(1, t / 400);
      p.dx = Math.sin(k * 30) * 0.03 * (1 - k); p.alpha = 0.6 + 0.4 * Math.abs(Math.cos(k * 18));
    } else if (clip === 'death') {
      k = Math.min(1, t / 800);
      p.rot = 1.45 * k; p.dy = 0.02 * k; p.alpha = 1 - 0.6 * k;
    } else {
      a = Math.sin(t / 1000 * Math.PI * 2 * 0.8);
      p.sy = 1 + 0.015 * a; p.sx = 1 - 0.008 * a;
    }
    return p;
  }
  /** o = draw 와 같다({ pool, clip, facing, ms, x, y(발 밑 가운데), scale, alpha }). 몸 높이 = targetH × scale. 그림이 없으면 false */
  function drawStill(ctx, o) {
    var d = dirOf(o.facing), e = getStill(o.pool, SVIEW[d.row]);
    if (e.fail && d.row !== 1) { e = getStill(o.pool, 'side'); }
    if (!e.ok) { return false; }
    var cf = C(), bodyH = (cf.targetH || 62) * (o.scale || 1), sc = bodyH / SBODY, w = SPX * sc, h = SPX * sc;
    var ps = stillPose(o.clip || 'idle', o.ms || 0);
    ctx.save();
    ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * ps.alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.translate(o.x, o.y);                         // 발 밑 가운데가 원점
    if (d.flip) { ctx.scale(-1, 1); }
    ctx.translate(ps.dx * bodyH, ps.dy * bodyH);
    ctx.rotate(ps.rot);
    ctx.scale(ps.sx, ps.sy);
    ctx.drawImage(e.img, -w / 2, -h * SFOOT, w, h);
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

  /** 건물 실내 그림(K-0025, W-0045) — 방 그림과 앞가림 층(투명) 주소. 2D 모드가 아니면 null(3D 는 그림 없이 글만). cfg.interiorBase 로 폴더를 바꾼다 */
  function interiorUrls(id) {
    if (!id || !isOn()) { return null; }
    var b = C().interiorBase || 'assets/web2d/interior/';
    return { back: b + id + '.webp', front: b + id + '_front.webp' };
  }

  /** 땅 종류 → 타일 주소(cfg.tile 표). 2D 모드가 아니거나 표에 없으면 null — 자기 텍스처 로더가 있는 판(사가고)이 주소만 빌린다 */
  function tileUrl(kind) { var c = C(); return c.tile && c.tile[kind] && isOn() ? tileBase() + c.tile[kind] + '.webp' : null; }

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

  /**
   * 아이소 바닥(마름모)을 타일로 채운다 — 사가블로. o = { id, a,b,c,d,e,f(방 좌표 → 화면 변환 행렬), W, H(방 크기), unit(타일 한 장이 덮는 방 좌표 폭, 기본 160), tint, tintAlpha }.
   * 타일 위에 tint(테마 바닥색)를 얹어 층 분위기를 남긴다. 그렸으면 true — 부른 쪽은 칸 색칠을 건너뛴다. 못 받았으면 false.
   */
  function fillIso(ctx, o) {
    if (!ctx || !o || !o.id || !isOn()) { return false; }
    var pat = tilePattern(ctx, o.id);
    if (!pat) { return false; }
    var s = (o.unit || 160) / 256;
    ctx.save();
    ctx.transform(o.a, o.b, o.c, o.d, o.e, o.f);
    ctx.fillStyle = pat; ctx.save(); ctx.scale(s, s); ctx.fillRect(0, 0, o.W / s, o.H / s); ctx.restore();
    if (o.tint) { ctx.globalAlpha = o.tintAlpha === undefined ? 0.6 : o.tintAlpha; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, o.W, o.H); }
    ctx.restore();
    return true;
  }

  /* ───── 건물·지물 스프라이트(K-0017 산출, `shared/assets/world2d/<id>.webp`) — 판 설정 `prop2d: { 종류: { id, h } }` ─────
     h = 그 종류가 화면에서 보일 키(px, 확대 k=1 기준). 못 받았거나 표에 없으면 false → 부른 쪽이 옛 그림(코드 도형)을 그린다. */
  var sprites = {};   // id → { img, ok, fail, box:{sx,sy,sw,sh} }
  function spriteOf(id) {
    var A = global.DG && global.DG.assets3d, u = A && A.spriteUrl && A.spriteUrl(id), e = sprites[id];
    if (!u) { return null; }
    if (!e) {
      e = sprites[id] = loadImg(u);
      var im = e.img, done = im.onload;
      im.onload = function () {
        try {   // 알파가 있는 범위만 잘라 쓴다(256px 칸에 여백이 있다)
          var c = global.document.createElement('canvas'), x, y, d, w = im.naturalWidth, h = im.naturalHeight, x0 = w, y0 = h, x1 = -1, y1 = -1;
          c.width = w; c.height = h; var g = c.getContext('2d'); g.drawImage(im, 0, 0); d = g.getImageData(0, 0, w, h).data;
          for (y = 0; y < h; y++) { for (x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) { x0 = x; } if (x > x1) { x1 = x; } if (y < y0) { y0 = y; } if (y > y1) { y1 = y; } } } }
          e.box = x1 >= 0 ? { sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 } : { sx: 0, sy: 0, sw: w, sh: h };
        } catch (err) { e.box = { sx: 0, sy: 0, sw: im.naturalWidth, sh: im.naturalHeight }; }
        e.ok = true;
      };
    }
    return e.ok && e.box ? e : null;
  }
  /** 스프라이트 하나를 발 밑 가운데 (x, y) 에 키 h(px) 로 그린다. 그렸으면 true */
  function drawSprite(ctx, o) {
    if (!ctx || !o || !o.id || !isOn()) { return false; }
    var e = spriteOf(o.id);
    if (!e) { return false; }
    var b = e.box, h = o.h, w = h * b.sw / b.sh;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, w * 0.38, Math.max(2, h * 0.07), 0, 0, Math.PI * 2); ctx.fill();   // 발 밑 그림자
    if (o.alpha !== undefined) { ctx.globalAlpha = o.alpha; }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(e.img, b.sx, b.sy, b.sw, b.sh, o.x - w / 2, o.y - h, w, h);
    ctx.restore();
    return true;
  }
  /** 판 표(`DG.cfg.mode2d.prop2d`)의 종류 하나를 그린다 — k 는 확대 배율. 표에 없으면 false */
  function drawKind(ctx, kind, x, y, k, seed) {
    var t = C().prop2d, p = t && t[kind], id = p && (p.ids ? p.ids[hashOf(seed) % p.ids.length] : p.id);   // ids = 여러 모양 중 씨앗 해시로 하나
    return p ? drawSprite(ctx, { id: id, x: x, y: y, h: p.h * (k || 1) }) : false;
  }
  /** 표에 이 종류가 있고 2D 모드인가 — 부르는 쪽이 정렬 목록에 넣을지 정할 때 */
  function hasKind(kind) { var t = C().prop2d; return !!(t && t[kind]) && isOn(); }

  global.DG = global.DG || {};
  global.DG.mode2d = {
    drawSprite: drawSprite, drawKind: drawKind, hasKind: hasKind, spriteReady: function (id) { return !!spriteOf(id); },
    fillIso: fillIso,
    interiorUrls: interiorUrls,
    drawBg: drawBg, tile: tile, tileUrl: tileUrl, tilePattern: tilePattern, fillTile: fillTile,
    bgReady: function (region) { var b = bgs[region]; return !!(b && b.meta && LAYERS.every(function (l) { return b.imgs[l].ok; })); },
    bgFailed: function (region) { var b = bgs[region]; return b ? b.fail || LAYERS.some(function (l) { return b.imgs[l].fail; }) : null; },
    preloadBg: function (region) { getBg(region); },
    tileOk: function (id) { var t = tiles[id]; return t ? t.ok : null; },
    FRAMES: FRAMES, PX: PX, FPS: FPS,
    isOn: isOn, pick: pick, vroidPick: vroidPick, face: face, dirOf8: dirOf8, roleOf: roleOf, sheet8: sheet8, beastOf: beastOf, frameAt: frameAt, dirOf: dirOf, hashOf: hashOf,
    draw: draw, preload: preload, loadIndex: loadIndex,
    drawStill: drawStill, stillPose: stillPose, isStill: isStill,
    stillLoaded: function (pool, view) { var e = stills[pool + '/' + view]; return e ? e.ok : null; },
    /** 진단용 — 그 풀·동작 이미지를 받았나(true/false), 아직 안 불렀으면 null */
    loaded: function (pool, clip) { var e = imgs[pool + '/' + clip]; return e ? e.ok : null; },
    failed: function (pool, clip) { var e = imgs[pool + '/' + clip]; return e ? e.fail : null; }
  };
})(typeof window !== 'undefined' ? window : this);
