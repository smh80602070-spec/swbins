/**
 * 움직이는 대화 초상(W-0193, K-0049) — 스승 16명의 평온 줄 얼굴을 깜빡이고·말하는 동안 입이 움직이고·숨쉬듯 오르내리게 그린다.
 * 그림 `assets/portraits/live/<id>/` = base.webp(768×1024) + 부위 패치(eye: blink_half·blink, mouth: mouth_half·mouth_a·mouth_o, 알파) + live.json
 * (규격 tools/ai-art/split_portrait_layers.py 머리말 — parts[부위].box 자리에 frames 그림을 얹는다, motion.blink·talk·breath·sway).
 * 칸에는 평온 카드와 같은 자르기(CARD_BOX, 150:172)로 그린다. 표정 줄(기쁨·분노…)은 story-face.js 의 정지 표정 그림 — 표정 그림엔 패치 상자가 안 맞아 섞지 않는다.
 * 루프는 붙은 캔버스가 문서에 있을 때만 돈다(대화창이 닫히면 다음 프레임에 멈춤).
 */
(function (global) {
  'use strict';

  var BASE = 'assets/portraits/live/';
  var CARD = [34, 24, 734, 827];   // pack_web_portraits.py CARD_BOX — 평온 카드 `_c` 와 같은 구도
  var people = {};                // id → { spec, img: {이름: Image}, ok, fail }
  var mounts = [];                // { cv, id, talkFrom, talkTo, blinkAt, seed }
  var raf = 0, frames = 0;

  /** 순수 — 시각 t(ms)의 한 장면. o = { blinkAt(깜빡임 시작 ms|null), talkFrom, talkTo(말하는 구간 ms) } → { eye, mouth, scaleY, deg } */
  function liveFrame(spec, t, o) {
    var m = (spec && spec.motion) || {}, r = { eye: null, mouth: null, scaleY: 1, deg: 0 }, b = m.blink, k = m.talk, i;
    o = o || {};
    if (b && b.seq && o.blinkAt !== null && o.blinkAt !== undefined && t >= o.blinkAt) {
      i = Math.floor((t - o.blinkAt) / (b.frame_ms || 60));
      if (i < b.seq.length) { r.eye = b.seq[i]; }
    }
    if (k && k.seq && o.talkFrom !== undefined && t >= o.talkFrom && t < o.talkTo) {
      r.mouth = k.seq[Math.floor((t - o.talkFrom) / (k.frame_ms || 110)) % k.seq.length];
    }
    if (m.breath) { r.scaleY = 1 + (m.breath.amp || 0) * (0.5 + 0.5 * Math.sin(t / 1000 / (m.breath.period_s || 3.6) * Math.PI * 2)); }
    if (m.sway) { r.deg = (m.sway.deg || 0) * Math.sin(t / 1000 / (m.sway.period_s || 5) * Math.PI * 2); }
    return r;
  }
  /** 순수 — 다음 깜빡임 시작(ms). rnd 0..1 로 every_s 범위 안 */
  function nextBlink(spec, now, rnd) {
    var e = (spec && spec.motion && spec.motion.blink && spec.motion.blink.every_s) || [3, 6];
    return now + (e[0] + (e[1] - e[0]) * rnd) * 1000;
  }
  /** 순수 — 대사 글자 수 → 말하는 시간(ms) */
  function talkMs(text) { return Math.min(4000, Math.max(500, String(text || '').length * 40)); }

  var IDS = ['eu_davinci', 'eu_leonidas', 'jp_hanzo', 'jp_himiko', 'jp_musashi', 'jp_tomoegozen', 'jp_yoshitsune', 'kr_gyebaek',
    'sg_ganning', 'sg_huangzhong', 'sg_lubu', 'sg_taishici', 'sg_zhugeliang', 'wd_genghis', 'wd_ibnsina', 'wd_shaka'];
  function has(id) { return IDS.indexOf(id) >= 0; }

  /** 한 사람 그림을 받는다(한 번만) — 다 받으면 ok, 하나라도 못 받으면 fail(→ 캔버스를 걷고 숨겨 둔 정지 초상) */
  function load(id) {
    var p = people[id];
    if (p || !has(id) || !global.fetch || !global.Image) { return p || null; }
    p = people[id] = { spec: null, img: {}, ok: false, fail: false };
    global.fetch(BASE + id + '/live.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) { p.fail = true; return; }
      var names = [j.base], left;
      Object.keys(j.parts || {}).forEach(function (k) { var f = j.parts[k].frames || {}; Object.keys(f).forEach(function (n) { names.push(f[n]); }); });
      left = names.length;
      names.forEach(function (n) {
        var im = new global.Image();
        im.onload = function () { if (--left === 0) { p.spec = j; p.ok = true; } };
        im.onerror = function () { p.fail = true; };
        im.src = BASE + id + '/' + n;
        p.img[n] = im;
      });
    })['catch'](function () { p.fail = true; });
    return p;
  }

  /** 프레임 이름 → 그 부위 { box, file } */
  function partOf(spec, name) {
    var ks = Object.keys(spec.parts || {}), i, f;
    for (i = 0; i < ks.length; i++) { f = spec.parts[ks[i]].frames || {}; if (f[name]) { return { box: spec.parts[ks[i]].box, file: f[name] }; } }
    return null;
  }

  function drawOne(mt, now) {
    var p = people[mt.id], cv = mt.cv, g, w, h, sx, sy, fr, part, pv;
    if (!p || !p.ok) { return; }
    if (mt.blinkAt === null || now > mt.blinkAt + 1000) { mt.blinkAt = nextBlink(p.spec, now, (mt.seed = (mt.seed * 9301 + 49297) % 233280) / 233280); }
    g = cv.getContext('2d'); w = cv.width; h = cv.height;
    sx = w / (CARD[2] - CARD[0]); sy = h / (CARD[3] - CARD[1]);
    fr = liveFrame(p.spec, now, mt);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    pv = ((p.spec.motion && p.spec.motion.sway && p.spec.motion.sway.pivot_y) || 0.78) * p.spec.size[1];
    g.translate(w / 2, (pv - CARD[1]) * sy); g.rotate(fr.deg * Math.PI / 180); g.translate(-w / 2, -(pv - CARD[1]) * sy);
    g.translate(0, h); g.scale(1, fr.scaleY); g.translate(0, -h);
    g.drawImage(p.img[p.spec.base], CARD[0], CARD[1], CARD[2] - CARD[0], CARD[3] - CARD[1], 0, 0, w, h);
    [fr.eye, fr.mouth].forEach(function (n) {
      if (!n || !(part = partOf(p.spec, n))) { return; }
      var b = part.box;
      g.drawImage(p.img[part.file], (b[0] - CARD[0]) * sx, (b[1] - CARD[1]) * sy, (b[2] - b[0]) * sx, (b[3] - b[1]) * sy);
    });
  }

  function tick() {
    raf = 0;
    var now = Date.now();
    mounts = mounts.filter(function (mt) {
      if (!mt.cv.isConnected) { return false; }
      var p = people[mt.id];
      if (p && p.fail) { swapBack(mt.cv); return false; }
      drawOne(mt, now);
      return true;
    });
    frames++;
    if (mounts.length) { raf = global.requestAnimationFrame(tick); }
  }
  /** 못 받았으면 캔버스를 걷고 숨겨 둔 정지 초상을 꺼낸다 */
  function swapBack(cv) { var f = cv.nextElementSibling; if (f && f.hidden) { f.hidden = false; } if (cv.parentNode) { cv.parentNode.removeChild(cv); } }

  /** 문서의 아직 안 붙은 `canvas[data-live]` 를 붙인다(story-face 가 대화창 HTML 을 쓴 직후 부른다) */
  function scan() {
    if (!global.document) { return; }
    var list = global.document.querySelectorAll('canvas[data-live]:not([data-live-on])'), i, cv, dpr = global.devicePixelRatio || 1;
    for (i = 0; i < list.length; i++) {
      cv = list[i]; cv.setAttribute('data-live-on', '1');
      cv.width = Math.round((cv.clientWidth || 104) * dpr); cv.height = Math.round((cv.clientHeight || 119) * dpr);
      var id = cv.getAttribute('data-live'), now = Date.now(), tm = +cv.getAttribute('data-talk') || 0;
      load(id);
      mounts.push({ cv: cv, id: id, talkFrom: now, talkTo: now + tm, blinkAt: null, seed: (id.length * 7919 + now) % 233280 });
    }
    if (mounts.length && !raf && global.requestAnimationFrame) { raf = global.requestAnimationFrame(tick); }
  }

  /** 얼굴 칸 HTML — 이 사람이 살아 있는 초상이 있고 그림을 아직 못 받은 게 아니면 캔버스(+ 숨긴 정지 초상), 아니면 null */
  function html(id, text, fallback) {
    var p = load(id);
    if (!p || p.fail) { return null; }
    if (global.setTimeout) { global.setTimeout(scan, 0); }
    return '<canvas class="pt story-live" data-live="' + id + '" data-talk="' + talkMs(text) + '"></canvas><span class="story-fb" hidden>' + fallback + '</span>';
  }

  global.DG = global.DG || {};
  global.DG.livePortrait = {
    liveFrame: liveFrame, nextBlink: nextBlink, talkMs: talkMs, has: has, html: html, scan: scan, IDS: IDS,
    active: function () { return mounts.length; }, _blinkNow: function () { var t = Date.now(); mounts.forEach(function (m) { m.blinkAt = t; }); },   // 촬영·진단용 — 지금 깜빡임
    running: function () { return !!raf; }, _frames: function () { return frames; }
  };
})(window);
