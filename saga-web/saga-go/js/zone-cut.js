/**
 * 다섯 판 공용 구역 넘김 막 (W-0414) — 2나락 load-veil cut() 꼴을 판마다 쓰게 뗀 것.
 * ---------------------------------------------------------------
 * 사용자 10-25 「다섯판 모두 맵을 나눠서 하는걸로」「2d,3d 모두」 — 구역(땅·숲 구역·무대·지역·전술판)이 바뀌는 순간
 * 화면을 곧장 어둡게 덮고, 새 구역을 다 지은 뒤(판이 준 wait() 가 거짓) 걷는다. 눈앞에서 칸·소품이 솟는 모습을 막 아래로.
 *
 *   DG.zoneCut.cut({ wait, min, max })  wait() 참이면 아직 짓는 중 · min 최소 덮음(기본 180ms) · max 상한(손잡이 zoneCut.max 1600)
 *   DG.zoneCut.shown()                  덮여 있나
 *   DG.zoneCut.threeBusy()              three.js 기본 로딩 관리자(GLTFLoader 등 manager 안 준 것)가 받는 중인 수 > 0 — 3D 판 wait 에 공통으로
 *   DG.zoneCut.hookKey(fnKey, opts)     매 프레임 fnKey() 를 보고 값이 바뀌면 cut(opts) — 걸어서 넘는 경계용(첫 값은 안 덮음)
 * 손잡이 zoneCut.on 1(0 = 옛 그대로). 판정·세이브는 안 건드린다(그리기만 가린다). id 는 2나락 #zone-cut 과 겹치지 않게 #zone-cut2.
 */
(function (global) {
  'use strict';
  var doc = global.document, el = null, at = 0, waits = [], minMs = 180, maxMs = 1600, ticking = false, keys = [];
  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? +C.tuned(k, d) : d; }
  function now() { return global.performance && global.performance.now ? global.performance.now() : Date.now(); }
  function raf(fn) { return global.requestAnimationFrame ? global.requestAnimationFrame(fn) : global.setTimeout(fn, 16); }
  /* three 기본 로딩 관리자를 한 번 감싸 받는 중 수를 센다(감싸기 전 시작한 것은 못 세 0 아래로는 안 내림) */
  var tN = 0, tHooked = false;
  function threeBusy() {
    var T = global.THREE, M = T && T.DefaultLoadingManager;
    if (M && !tHooked) { tHooked = true; var s0 = M.itemStart, e0 = M.itemEnd, r0 = M.itemError;
      M.itemStart = function (u) { tN++; return s0.apply(this, arguments); };
      M.itemEnd = function (u) { tN = Math.max(0, tN - 1); return e0.apply(this, arguments); };
      M.itemError = function (u) { tN = Math.max(0, tN - 1); return r0.apply(this, arguments); }; }
    return tN > 0;
  }
  function busy() {
    for (var i = 0; i < waits.length; i++) { try { if (waits[i]()) { return true; } } catch (e) { /* 판 쪽 오류는 안 기다린다 */ } }
    return false;
  }
  function cut(o) {
    o = o || {};
    if (!doc || !doc.body || !tuned('zoneCut.on', 1)) { return false; }
    if (!el) { el = doc.createElement('div'); el.id = 'zone-cut2'; el.style.cssText = 'position:fixed;inset:0;z-index:62;background:#0b0907;opacity:0;pointer-events:none'; doc.body.appendChild(el); }
    el.style.transition = 'none'; el.style.opacity = '1'; at = now();
    if (typeof o.wait === 'function') { waits.push(o.wait); }
    minMs = o.min != null ? +o.min : 180; maxMs = +(o.max || tuned('zoneCut.max', 1600));
    if (!ticking) { ticking = true; raf(step); }
    return true;
  }
  function step() {
    var i, k;
    for (i = 0; i < keys.length; i++) { try { k = keys[i].fn(); } catch (e) { k = keys[i].last; } if (k != null && keys[i].last != null && k !== keys[i].last) { cut(keys[i].o); } if (k != null) { keys[i].last = k; } }
    if (el && el.style.opacity === '1') {
      var ms = now() - at;
      if (!(ms < minMs || (ms < maxMs && busy()))) { waits = []; el.style.transition = 'opacity .3s ease-out'; el.style.opacity = '0'; }
    }
    if (keys.length || (el && el.style.opacity === '1')) { raf(step); } else { ticking = false; }
  }
  function hookKey(fn, o) { keys.push({ fn: fn, o: o || {}, last: null }); if (!ticking) { ticking = true; raf(step); } }
  global.DG = global.DG || {};
  global.DG.zoneCut = { cut: cut, hookKey: hookKey, threeBusy: threeBusy, shown: function () { return !!el && el.style.opacity === '1'; }, _busy: busy };
})(typeof window !== 'undefined' ? window : this);
