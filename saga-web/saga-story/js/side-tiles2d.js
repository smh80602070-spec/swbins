/**
 * 4종횡 2D — 메이플식 타일 조각 그리기 (W-0296)
 * ---------------------------------------------------------------
 * 발판·밧줄·사다리·바닥을 **타일 조각**으로 그린다. 그림은 자체툴 K-0135 몫이고, 키는 둘이 약속한 그대로다:
 *
 *   assets/web2d/tile/<지역>-{plat_l,plat_m,plat_r}.png   발판 왼끝·가운데(가로 이음)·오른끝 — 48×24
 *   assets/web2d/tile/<지역>-{rope,ladder}.png            세로 이음 — 48×48
 *   assets/web2d/tile/<지역>-{ground,ground_top}.png      바닥 속·바닥 윗면(풀·이끼 테) — 48×48
 *   (<지역> = cfg.mode2d.region 값 = assets/web2d/bg/*.layers.json 이름, 예 story_field_meadow)
 *
 * 그 조각들이 다 실려야 그 부분을 그리고 true — 받는 중·없음이면 false 를 돌려 부른 쪽(side-view.js)이 지금 도형을 그린다.
 * 그래서 그림이 오기 전에도 화면은 그대로고, 오면 손대지 않고 바뀐다. 픽셀은 정수 자리에 찍는다(타일 사이 틈 없음).
 * **판정(side.js 발판·줄 좌표)은 읽기만 한다.** platSegs()·partsOf() 는 그림 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';

  var UNIT = 48, PLAT_H = 24;
  var PARTS = { plat: ['plat_l', 'plat_m', 'plat_r'], rope: ['rope'], ladder: ['ladder'], ground: ['ground', 'ground_top'] };

  function base() { var c = global.DG && global.DG.cfg && global.DG.cfg.mode2d; return (c && c.tileBase) || 'assets/web2d/tile/'; }
  function on() { var C = global.DG && global.DG.core; return !(C && C.tuned && !+C.tuned('story2d.tiles', 1)); }

  /** 발판 폭 w 를 조각으로 — 왼끝·가운데 n 개·오른끝. 끝 둘보다 좁으면 끝 둘을 반씩 줄인다. 마지막 가운데 조각은 남은 폭만큼만(잘라 그린다) */
  function platSegs(w, unit) {
    var u = unit || UNIT, out = [], x;
    w = Math.max(0, Math.round(w || 0));
    if (w <= 0) { return out; }
    if (w < u * 2) { var h = Math.floor(w / 2); out.push({ part: 'plat_l', x: 0, w: h }); out.push({ part: 'plat_r', x: h, w: w - h }); return out; }
    out.push({ part: 'plat_l', x: 0, w: u });
    for (x = u; x < w - u; x += u) { out.push({ part: 'plat_m', x: x, w: Math.min(u, w - u - x) }); }
    out.push({ part: 'plat_r', x: w - u, w: u });
    return out;
  }
  /** 무엇을 그리는 데 어떤 조각 파일이 필요한가(순수) */
  function partsOf(kind) { return (PARTS[kind] || []).slice(); }
  function fileOf(region, part) { return base() + region + '-' + part + '.png'; }

  var imgs = {};      // 파일 → { img, ok, fail }
  function img(region, part) {
    var url = fileOf(region, part), e = imgs[url];
    if (!e) {
      e = imgs[url] = { img: null, ok: false, fail: !global.Image };
      if (global.Image) {
        var im = new global.Image();
        im.onload = function () { e.ok = true; };
        im.onerror = function () { e.fail = true; };   // 없으면 영영 옛 도형 — 다시 두드리지 않는다
        im.src = url; e.img = im;
      }
    }
    return e;
  }
  /** 그 종류의 조각이 다 실렸나 — 하나라도 받는 중·없음이면 null */
  function set(region, kind) {
    if (!region || !on()) { return null; }
    var ps = PARTS[kind], o = {}, i, e;
    for (i = 0; i < ps.length; i++) { e = img(region, ps[i]); if (!e.ok) { return null; } o[ps[i]] = e.img; }
    return o;
  }

  /** 바닥 — 땅 선(floor)부터 아래로. 윗줄은 ground_top(풀 테), 그 아래는 ground 반복. camX 로 흐른다 */
  function drawGround(ctx, region, camX, W, H, floor) {
    var t = set(region, 'ground');
    if (!t || !ctx) { return false; }
    var off = -(((Math.round(camX) % UNIT) + UNIT) % UNIT), x, y, fl = Math.round(floor);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (y = fl + UNIT; y < H; y += UNIT) { for (x = off; x < W; x += UNIT) { ctx.drawImage(t.ground, x, y, UNIT, UNIT); } }
    for (x = off; x < W; x += UNIT) { ctx.drawImage(t.ground_top, x, fl, UNIT, UNIT); }
    ctx.restore();
    return true;
  }

  function stats() {
    var n = 0, ok = 0, fail = 0, k;
    for (k in imgs) { if (Object.prototype.hasOwnProperty.call(imgs, k)) { n++; if (imgs[k].ok) { ok++; } if (imgs[k].fail) { fail++; } } }
    return { files: n, ok: ok, fail: fail, on: on() };
  }

  global.DG = global.DG || {};
  global.DG.sideTiles2d = {
    UNIT: UNIT, PLAT_H: PLAT_H,
    platSegs: platSegs, partsOf: partsOf, fileOf: fileOf,
    drawGround: drawGround, ready: function (region, kind) { return !!set(region, kind); }, stats: stats
  };
})(window);
