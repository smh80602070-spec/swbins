/**
 * 4종횡 2D — 시차 앞 층·시간대 색 (W-0296)
 * ---------------------------------------------------------------
 * 뒤 층 셋(far·mid·near)은 공용 mode2d.drawBg 가 `<지역>.layers.json` 의 speed 대로 이미 흘린다(far 0.2 · mid 0.5 · near 1.0 — K-0020 자료).
 * 여기는 그 앞을 맡는다:
 *
 *   앞 층   `assets/web2d/bg/<지역>_front.webp`(알파, 1920 폭, 아래 가장자리 = 화면 아래) — 인물·적 **앞**에 그려 발을 살짝 가린다.
 *           카메라보다 빨리(FRONT 1.15) 흘러 깊이가 선다. 그림은 자체툴 몫 — 없으면 아무것도 안 그린다(코드로 풀을 그리지 않는다)
 *   시간대  실제 시각 → 새벽·낮·노을·밤, 세계(배경·발판·사람)에 곱하기(multiply) 색 한 겹. 낮은 안 칠한다.
 *           손잡이 story2d.tod — 'auto'(기본·실제 시각) · 'off' · 'dawn'·'noon'·'sunset'·'night'(고정)
 *
 * **판정에는 한 줄도 안 닿는다.** DEPTH·todOf()·depthOk() 는 그림 없이 돈다 — 자가진단이 본다.
 */
(function (global) {
  'use strict';

  var DEPTH = { far: 0.2, mid: 0.5, near: 1.0, front: 1.15 };
  var TOD = {
    dawn: { color: '#ffd2b4', a: 0.32 },
    noon: null,
    sunset: { color: '#ffa774', a: 0.34 },
    night: { color: '#5b6aa8', a: 0.42 }
  };

  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function cfg() { return (global.DG && global.DG.cfg && global.DG.cfg.mode2d) || {}; }

  /** 시각(0~24) → 때(순수) — 5~8 새벽 · 8~17 낮 · 17~20 노을 · 그 밖 밤. 손잡이가 고정이면 그것 */
  function todOf(hour, force) {
    var f = force !== undefined ? force : tuned('story2d.tod', 'auto');
    if (f === 'off') { return null; }
    if (TOD.hasOwnProperty(f)) { return f; }
    var h = ((Number(hour) || 0) % 24 + 24) % 24;
    return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'noon' : h >= 17 && h < 20 ? 'sunset' : 'night';
  }
  /** 층 자료(layers.json)가 깊이대로인가 — far < mid ≤ near < 앞 층(순수) */
  function depthOk(meta) {
    if (!meta || !meta.far || !meta.mid || !meta.near) { return false; }
    return meta.far.speed < meta.mid.speed && meta.mid.speed <= meta.near.speed && meta.near.speed < DEPTH.front;
  }

  var fronts = {};    // 지역 → { img, ok, fail }
  function front(region) {
    var e = fronts[region];
    if (!e) {
      e = fronts[region] = { img: null, ok: false, fail: !global.Image };
      if (global.Image) {
        var im = new global.Image();
        im.onload = function () { e.ok = true; };
        im.onerror = function () { e.fail = true; };
        im.src = (cfg().bgBase || 'assets/web2d/bg/') + region + '_front.webp'; e.img = im;
      }
    }
    return e;
  }

  /** 앞 층 — o = { region, camX, W, H }. 그렸으면 true */
  function drawFront(ctx, o) {
    if (!ctx || !o || !o.region || !+tuned('story2d.front', 1)) { return false; }
    var e = front(o.region);
    if (!e.ok) { return false; }
    var port = o.W < o.H, k = o.H / 540 * (port ? +tuned('story2d.frontPortrait', 0.45) : 1);   // W-0343 세로 폰 — 화면 키로 키우면 1.9 배 확대까지 겹쳐 아래 1/3 을 덮었다 → 낮고 옅게
    var im = e.img, dw = (im.naturalWidth || 1920) * k, dh = (im.naturalHeight || 120) * k, y = Math.round(o.H - dh), a0 = ctx.globalAlpha;
    if (port) { ctx.globalAlpha = a0 * +tuned('story2d.frontPortraitA', 0.7); }
    var dx = (o.camX || 0) * DEPTH.front, n = Math.floor(dx / dw), off = dx - n * dw, i, x;
    for (i = 0; i * dw - off < o.W; i++) {
      x = Math.round(i * dw - off);
      if ((n + i) % 2 !== 0) { ctx.save(); ctx.translate(x + dw, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y, dw, dh); ctx.restore(); }   // 홀수 칸은 뒤집어 이음매를 숨긴다(drawBg 와 같은 요령)
      else { ctx.drawImage(im, x, y, dw, dh); }
    }
    ctx.globalAlpha = a0;
    return true;
  }

  /** 시간대 색 — 세계 위에 곱하기 한 겹. now = Date(진단은 시각만 바꿔 부른다). 칠했으면 그 때 이름 */
  function tint(ctx, W, H, now) {
    var key = todOf((now || new Date()).getHours()), t = key ? TOD[key] : null;
    if (!ctx || !t) { return key && !t ? key : null; }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = t.a;
    ctx.fillStyle = t.color;
    ctx.fillRect(-W, -H, W * 3, H * 3);      // 확대(CSS)·흔들림 이동이 걸려 있어도 다 덮게
    ctx.restore();
    return key;
  }

  global.DG = global.DG || {};
  global.DG.sideBg2d = {
    DEPTH: DEPTH, TOD: TOD, todOf: todOf, depthOk: depthOk,
    drawFront: drawFront, tint: tint,
    frontReady: function (region) { return !!(region && front(region).ok); }
  };
})(window);
