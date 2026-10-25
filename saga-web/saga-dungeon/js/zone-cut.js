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
 * W-0449(사용자 10-26 「맵 분할해도 되니 로딩되어서 생기게 하지는 마」):
 *   DG.zoneCut.netBusy()  페이지가 받는 중인 그림·모델(img src·fetch 의 glb/webp/png/jpg/ktx2/bin) 수 > 0 — 판 wait 와 함께 **늘** 기다린다(2D 도)
 *   걷기 = 바쁨이 끝나고 zoneCut.quiet(350ms) 조용한 뒤 · 상한 zoneCut.max 1600 → **12000**(받기가 끝나기 전에 걷혀 눈앞에서 솟던 것)
 *   첫 진입 — 타이틀(#acc-host)이 닫히는 순간 저절로 덮는다(넘김 키는 첫 값을 안 덮어 들어선 첫 장면이 그대로 솟았다)
 */
(function (global) {
  'use strict';
  var doc = global.document, el = null, at = 0, waits = [], minMs = 180, maxMs = 12000, ticking = false, keys = [], quietAt = 0;
  /* 받는 중 수 — img.src 놓기·fetch 를 감싼다(같은 img 는 한 번만 셈). 스크립트가 일찍 실려야 들어선 뒤 받기를 다 센다 */
  var netN = 0, ASSET = /\.(glb|gltf|webp|png|jpe?g|ktx2|bin)(\?|#|$)/i;
  (function hookNet() {
    var IP = global.HTMLImageElement && global.HTMLImageElement.prototype, d = IP && Object.getOwnPropertyDescriptor(IP, 'src');
    if (d && d.set && !IP.__zcHooked) {
      IP.__zcHooked = true;
      Object.defineProperty(IP, 'src', { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) {
        var me = this;
        if (!me.__zcN && ASSET.test(String(v))) {
          me.__zcN = 1; netN++;
          var done = function () { if (me.__zcN) { me.__zcN = 0; netN = Math.max(0, netN - 1); } me.removeEventListener('load', done); me.removeEventListener('error', done); };
          me.addEventListener('load', done); me.addEventListener('error', done);
          global.setTimeout(done, 20000);   // 끝을 못 알리는 그림은 20초에 놓는다
        }
        return d.set.call(me, v);
      } });
    }
    var f0 = global.fetch;
    if (f0 && !f0.__zc) {
      var f1 = function (u) {
        var url = typeof u === 'string' ? u : (u && u.url) || '', p = f0.apply(this, arguments);
        if (!ASSET.test(url)) { return p; }
        netN++;
        var off = function () { netN = Math.max(0, netN - 1); };
        return p.then(function (res) {
          if (!res || !res.clone || !res.ok) { off(); return res; }
          res.clone().arrayBuffer().then(off, off);   // 몸까지 다 받았을 때 놓는다
          return res;
        }, function (e) { off(); throw e; });
      };
      f1.__zc = true; global.fetch = f1;
    }
  })();
  function netBusy() { return netN > 0; }
  var peak = 1;
  function label(show, frac) { if (!el || !el.firstChild) { return; } var tx = el.querySelector('.zc-t'), br = el.querySelector('.zc-b'); if (tx) { tx.style.opacity = show ? '1' : '0'; } if (br) { br.style.opacity = show ? '1' : '0'; br.style.width = Math.round(100 * Math.max(0, Math.min(1, frac))) + '%'; } }
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
    if (netN > 0 || tN > 0) { return true; }
    for (var i = 0; i < waits.length; i++) { try { if (waits[i]()) { return true; } } catch (e) { /* 판 쪽 오류는 안 기다린다 */ } }
    return false;
  }
  function cut(o) {
    o = o || {};
    if (!doc || !doc.body || !tuned('zoneCut.on', 1)) { return false; }
    if (!el) { el = doc.createElement('div'); el.id = 'zone-cut2'; el.style.cssText = 'position:fixed;inset:0;z-index:62;background:#0b0907;opacity:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#e8d3a4;font:600 16px/1.4 serif;letter-spacing:.08em'; el.innerHTML = '<div class="zc-t" style="opacity:0;transition:opacity .3s">불러오는 중</div><div style="width:min(52vw,280px);height:3px;background:rgba(232,211,164,.15);border-radius:2px;overflow:hidden"><i class="zc-b" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#9c7a3c,#f0d58e);transition:width .2s;opacity:0"></i></div>'; doc.body.appendChild(el); }   /* W-0449 오래 덮이면(0.7초~) 글자·막대 — 까만 화면이 멈춘 듯 보이지 않게 */
    el.style.transition = 'none'; el.style.opacity = '1'; at = now(); peak = 1; label(0, 0);
    if (typeof o.wait === 'function') { waits.push(o.wait); }
    minMs = o.min != null ? +o.min : 180; maxMs = +(o.max || tuned('zoneCut.max', 12000)); quietAt = 0;
    if (!ticking) { ticking = true; raf(step); }
    return true;
  }
  function step() {
    var i, k;
    for (i = 0; i < keys.length; i++) { try { k = keys[i].fn(); } catch (e) { k = keys[i].last; } if (k != null && keys[i].last != null && k !== keys[i].last) { cut(keys[i].o); } if (k != null) { keys[i].last = k; } }
    if (el && el.style.opacity === '1') {
      var t = now(), ms = t - at;
      if (busy()) { quietAt = 0; } else if (!quietAt) { quietAt = t; }
      peak = Math.max(peak, netN + tN); label(ms > 700 ? 1 : 0, 1 - (netN + tN) / peak);
      var quiet = quietAt && t - quietAt >= tuned('zoneCut.quiet', 350);
      if (ms >= maxMs || (ms >= minMs && quiet)) { waits = []; el.style.transition = 'opacity .3s ease-out'; el.style.opacity = '0'; }
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
  /* 첫 진입 — 타이틀이 한 번 떴다가 닫히면 덮는다(그 뒤 판이 첫 장면을 짓는 동안) */
  if (doc && global.setInterval && !global.DG_NO_DRAW) {
    var seen = false, iv = global.setInterval(function () {
      var h = doc.getElementById('acc-host'), up = !!(h && h.classList.contains('show'));
      if (up) { seen = true; } else if (seen) { global.clearInterval(iv); threeBusy(); cut({ min: 500 }); }
    }, 50);
    global.setTimeout(function () { if (!seen) { global.clearInterval(iv); } }, 120000);
  }
  global.DG = global.DG || {};
  global.DG.zoneCut = { cut: cut, hookKey: hookKey, threeBusy: threeBusy, netBusy: netBusy, walls: walls, shown: function () { return !!el && el.style.opacity === '1'; }, _busy: busy };
})(typeof window !== 'undefined' ? window : this);
