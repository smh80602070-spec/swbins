/**
 * 다섯 판 공용 구역 넘김 막 (W-0414) — 2나락 load-veil cut() 꼴을 판마다 쓰게 뗀 것.
 * ---------------------------------------------------------------
 * 사용자 10-25 「다섯판 모두 맵을 나눠서 하는걸로」「2d,3d 모두」 — 구역(땅·숲 구역·무대·지역·전술판)이 바뀌는 순간
 * 화면을 곧장 어둡게 덮고, 새 구역을 다 지은 뒤(판이 준 wait() 가 거짓) 걷는다. 눈앞에서 칸·소품이 솟는 모습을 막 아래로.
 *
 *   DG.zoneCut.cut({ wait, min, max })  wait() 참이면 아직 짓는 중 · min 최소 덮음(기본 180ms) · max 상한(손잡이 zoneCut.max 1600)
 *   DG.zoneCut.shown()                  덮여 있나
 *   DG.zoneCut.threeBusy()              three.js 기본 로딩 관리자(GLTFLoader 등 manager 안 준 것)가 받는 중인 수 > 0 — 3D 판 wait 에 공통으로
 *   DG.zoneCut.walls(scene, T)          W-0417 구역 경계 안개 벽 네 장 — .set(x0, z0, x1, z1, colorHex, h) 로 자리(바뀔 때만 다시 놓음). 아래가 짙고 위로 옅어지는 판,
 *                                       깊이 안 씀·안개(fog) 안 받음 — 구역 밖(안 지은 땅)을 자연스럽게 가린다. 손잡이 zoneCut.wall 1
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
  var wallTex = null;
  function walls(scene, T) {
    if (!scene || !T || !doc) { return null; }
    if (!wallTex) { var cv = doc.createElement('canvas'); cv.width = 4; cv.height = 128; var g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); wallTex = new T.CanvasTexture(cv); }
    var grp = new T.Group(), ms = [], i, key = '';
    for (i = 0; i < 4; i++) { var m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: wallTex, transparent: true, depthWrite: false, fog: false, side: T.DoubleSide, color: 0xc8d0d8 })); m.renderOrder = 5; grp.add(m); ms.push(m); }
    grp.name = 'zone-walls'; scene.add(grp);
    return { group: grp, set: function (x0, z0, x1, z1, col, h) {
      grp.visible = !!tuned('zoneCut.wall', 1); if (!grp.visible) { return; }
      h = h || 60; var k = [Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1), col, h].join(','); if (k === key) { return; } key = k;
      var w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      ms[0].scale.set(w, h, 1); ms[0].position.set(cx, h / 2, z0); ms[0].rotation.set(0, 0, 0);
      ms[1].scale.set(w, h, 1); ms[1].position.set(cx, h / 2, z1); ms[1].rotation.set(0, Math.PI, 0);
      ms[2].scale.set(d, h, 1); ms[2].position.set(x0, h / 2, cz); ms[2].rotation.set(0, Math.PI / 2, 0);
      ms[3].scale.set(d, h, 1); ms[3].position.set(x1, h / 2, cz); ms[3].rotation.set(0, -Math.PI / 2, 0);
      for (var j = 0; j < 4; j++) { ms[j].material.color.setHex(col == null ? 0xc8d0d8 : col); ms[j].material.map.flipY = true; }
    }, move: function (dx, dz) { grp.position.set(dx, 0, dz); } };
  }
  function hookKey(fn, o) { keys.push({ fn: fn, o: o || {}, last: null }); if (!ticking) { ticking = true; raf(step); } }
  global.DG = global.DG || {};
  global.DG.zoneCut = { cut: cut, hookKey: hookKey, threeBusy: threeBusy, walls: walls, shown: function () { return !!el && el.style.opacity === '1'; }, _busy: busy };
})(typeof window !== 'undefined' ? window : this);
