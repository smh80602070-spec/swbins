/**
 * 사냥터 3D 시차 층 — 순수 계산 (W-0161)
 * ---------------------------------------------------------------
 * 2D 층 그림(K-0020·K-0055 `story_*`, far·mid·near)을 3D 깊이 평면에 둘 자리. 그림을 세우는 것은 `side-view3d.js`,
 * 여기는 three 없이 도는 값만(진단 페이지는 3D 파일을 안 싣는다).
 *
 *   깊이   far −600 · mid −300 · near −40 (모두 인물 뒤) · 앞 풀 +36. 카메라가 원근이라 뒤 평면은 저절로 느리게
 *          (−600 ≈ 0.66배) 흐른다 — 시차를 따로 셈하지 않는다
 *   자리   far 는 2D drawBg 와 같은 화면 띠(하늘~땅 선)를 그 깊이로 역투영, mid·near 는 그 깊이의 땅(y 0)에 앉힌다.
 *          near 그림은 풀 송이가 아니라 위가 흐려지는 땅 띠라(2D 도 인물 뒤 땅 선 위에 깐다) 인물 앞에 두지 않는다 —
 *          발 가림은 side-view3d 가 앞 풀(deco grass) 한 줄로 한다
 *   손잡이 `story3d.parallax`(1 기본, 0 = 옛 도형 하늘·뒷배경)
 */
(function (global) {
  'use strict';

  var LAYER_Z = { far: -600, mid: -300, near: -40 }, FRONT_Z = 36;
  function on() { var C = global.DG.core; return !(C && C.tuned && !C.tuned('story3d.parallax', 1)); }
  /** 이 사냥터의 2D 배경 지역(2D side-view 와 같은 표) — 손잡이 0 이거나 표에 없으면 null */
  function regionOf(stg) {
    var M = global.DG.cfg && global.DG.cfg.mode2d;
    return on() && stg && M && M.region ? (M.region[stg.key] || null) : null;
  }
  /** 층 하나의 세계 사각형. L = layers.json 의 한 층, base = 땅 선(화면 y = stg.floor), H = 화면 키, D = 카메라 거리(Z=0 에서 1:1) */
  function layerRect(name, L, base, H, D) {
    var z = LAYER_Z[name], k = base / 540, dh = L.h * k, y = base - (540 - L.y) * k, f = (D - z) / D, lookY = base - H / 2;
    if (name === 'far') { dh = base; y = 0; }
    var top = lookY + (H / 2 - y) * f, bot = lookY + (H / 2 - (y + dh)) * f;
    if (name !== 'far') { top -= bot; bot = 0; }   // 그 깊이의 땅에 앉힌다(안 그러면 앞 땅이 띠 아래를 가린다)
    return { z: z, f: f, top: top, bot: bot, unitW: L.w * k * f };
  }

  /** W-0145 — 마을 하늘·안개가 누렇게 덮던 것(노을빛 0xe8b878 을 안개색으로 그대로 썼다): 채도를 k 만큼 회색 쪽으로 빼
   *  옅은 베이지로, 안개 시작을 0.35 → 0.6 으로 미뤄 가까운 집은 또렷하게. side-view3d 가 마을(town)에서만 부른다.
   *  손잡이 `story3d.townFog`(0.4, 0 = 옛 색·0.35) */
  function townFog(L, k) {
    var r = (L.sky >> 16) & 255, g = (L.sky >> 8) & 255, b = L.sky & 255, y = 0.299 * r + 0.587 * g + 0.114 * b;
    function m(c) { return Math.round(c + (y - c) * k); }
    var o = {}, key;
    for (key in L) { if (Object.prototype.hasOwnProperty.call(L, key)) { o[key] = L[key]; } }
    o.sky = (m(r) << 16) | (m(g) << 8) | m(b);
    o.nearK = k > 0 ? 0.6 : 0.35;
    return o;
  }

  global.DG = global.DG || {};
  global.DG.sideLayers3d = { LAYER_Z: LAYER_Z, FRONT_Z: FRONT_Z, on: on, regionOf: regionOf, layerRect: layerRect, townFog: townFog };
})(window);
