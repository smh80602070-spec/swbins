/**
 * saga-web 맵 편집기 — 3D 배치 화면(scene.html). 사가만리 `land.js` 의 `deco`(손으로 놓은 소품)를 고친다.
 *
 * 이 화면은 `/g/<판>/__scene.html` 에 얹혀 있어 **게임 js 를 게임과 같은 상대 경로로 그대로 부른다**
 * (land·world3d·prop3d·relief3d …). 그래서 그리는 계산이 게임과 같다:
 *   땅 높이    relief3d.heightAt           소품 모양   prop3d.parts(같은 자리 해시 → 같은 모델)
 *   해시 소품   world3d.propPlan            놓은 소품   land.decoAt → propPlan 과 같은 변환
 *   키 배율    prop3d.heightMul            돌림       p.rot 이 없으면 world3d 의 h1 해시와 같은 식
 * 편집기 쪽 값은 `deco` 배열 하나뿐이다(DG.land.region().deco 를 이 배열로 바꿔 끼워 게임 함수를 그대로 부른다).
 *
 * 기즈모는 three 번들에 TransformControls 가 없어 손으로 만들었다. 게임 소품은 땅에 붙고(y 없음) Y 축으로만 돌므로
 * 이동은 X·Z·XZ 판, 회전은 Y 고리, 크기는 고른 배율 하나다(집·탑은 폭·깊이도 같이).
 */
(function () {
  'use strict';

  var GAME = (/^\/g\/([a-z0-9-]+)\//.exec(location.pathname) || [])[1] || 'saga-go';
  /* 게임과 같은 순서로 부른다(index.html 의 순서에서 이 화면에 필요한 것만) */
  var SCRIPTS = {
    'saga-go': ['js/vendor/three.iife.js', 'js/core.js', 'js/perf.js', 'js/season.js', 'js/weather.js', 'js/land.js',
                'js/geo.js', 'js/world.js', 'js/prop3d.js', 'js/relief3d.js', 'js/world3d.js']
  };
  var GRID = 48;
  /* 게임 `instProp` 의 표 그대로 — 왼쪽이 소품 이름, 오른쪽이 prop3d 표 이름 */
  var GLB = { tree: 'tree', rock: 'rock', grass: 'grass', reed: 'grass', house: 'house', tower: 'tower', peak: 'peak',
              lamp: 'lamp', shrine: 'shrine', cave: 'cave', ruin: 'ruin', bridge: 'bridge', rice: 'rice', well: 'well',
              market: 'market', waterfall: 'waterfall', temple: 'temple' };
  var T_INFO = {
    tree:   { label: '나무', col: '#4f8a4a', h: 9 },     rock:  { label: '바위', col: '#8a8f8b', h: 2 },
    grass:  { label: '풀덤불', col: '#86b55a', h: 1 },   reed:  { label: '갈대', col: '#9fae6a', h: 1.6 },
    lamp:   { label: '등롱', col: '#e3b45a', h: 3.4 },   well:  { label: '우물', col: '#7fb0cc', h: 1.25 },
    market: { label: '장터', col: '#e39b5a', h: 1.3 },   house: { label: '집', col: '#c9b99a', h: 5, w: 8, d: 7 },
    tower:  { label: '탑', col: '#b0b4af', h: 18, w: 7, d: 7 }, scare: { label: '허수아비', col: '#b58b5a', h: 2.2 }
  };
  var LAND_COLOR = { grass: '#8fae6a', forest: '#5c7f4e', mount: '#9a9188', water: '#4a7fa6', road: '#c9bfa8', town: '#c2b49a', farm: '#7f9c5e' };
  var SOLID = { house: 1, tower: 1, well: 1, market: 1 };

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function log(t, ok) { var d = document.createElement('div'); d.className = ok ? 'ok' : 'bad'; d.textContent = (ok ? '✓ ' : '✗ ') + t; $('#log').prepend(d); }
  function fix(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }

  /* ── 상태 ─────────────────────────────────────────────── */
  var lands = [], L = null, deco = [], hash = '', sel = [], undoS = [], redoS = [], dirty = false;
  var mode = 'sel', snap = true, placing = null, types = [];
  var T, DG, renderer, scene, camera, groundMesh, gridLines, procGroup, decoGroup, footGroup, selGroup, gizmo, ghost;
  var cam = { tx: 0, ty: 0, tz: 0, r: 220, theta: 0.6, phi: 0.95 };
  var itemObj = {};         // di → Group
  var checkTimer = null;

  /* ── 게임 js 불러오기 ─────────────────────────────────── */
  function loadScripts(list, i, done) {
    if (i >= list.length) { done(); return; }
    var s = document.createElement('script');
    s.src = list[i];
    s.onload = function () { $('#loading').textContent = '게임 코드 ' + (i + 1) + '/' + list.length + ' — ' + list[i]; loadScripts(list, i + 1, done); };
    s.onerror = function () { $('#loading').textContent = '못 불렀다: ' + list[i]; };
    document.head.appendChild(s);
  }

  function h1(a, b) { return Math.min(0.999999, DG.core.hash2(a, b) * 2); }
  function groundY(x, z) { var R = DG.relief3d; return R && R.heightAt ? R.heightAt(x, z) : 0; }
  function cellOf(x, z) { return { gx: Math.floor(x / GRID), gy: Math.floor(z / GRID) }; }
  function region() { return DG.land.region(); }
  /* 편집 중인 배열을 게임 땅 객체에 끼운다 — 게임 함수(decoAt·propPlan·validate)가 이 값을 본다 */
  function syncRegion() { var r = region(); if (r) { r.deco = deco; } }

  /* ── 시작 ─────────────────────────────────────────────── */
  function boot() {
    var list = SCRIPTS[GAME];
    if (!list) { $('#loading').textContent = GAME + ' 는 3D 배치가 아직 없다(adapters/deco.js)'; return; }
    loadScripts(list, 0, function () {
      T = window.THREE; DG = window.DG;
      if (DG.weather && DG.weather.force) { DG.weather.force('clear'); }   // 비 오면 갈대가 잠겨 계획이 흔들린다
      initThree();
      fetch('/api/deco/list').then(function (r) { return r.json(); }).then(function (j) {
        lands = (j.items || []).filter(function (l) { return l.game === GAME; });
        $('#landSel').innerHTML = lands.map(function (l, i) { return '<option value="' + i + '">' + esc(l.game + ' · ' + l.name + ' (' + l.id + ')') + '</option>'; }).join('');
        if (!lands.length) { $('#loading').textContent = '이 판 land.js 에 deco 배열이 없다'; return; }
        pickLand(0);
      });
    });
  }

  function pickLand(i) {
    L = lands[i];
    DG.land.use(L.id);
    types = L.types || Object.keys(T_INFO);
    deco = JSON.parse(JSON.stringify(L.deco || []));
    hash = L.hash; sel = []; undoS = []; redoS = []; dirty = false;
    syncRegion();
    buildGround(); buildProc(); rebuildAllDeco(); renderPalette(); renderPlaces(); renderList(); renderInsp();
    showReport(L.report); frameAll(); updateBadge();
  }

  /* ── three ────────────────────────────────────────────── */
  function initThree() {
    var cv = $('#view');
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (T.SRGBColorSpace) { renderer.outputColorSpace = T.SRGBColorSpace; }
    scene = new T.Scene();
    scene.background = new T.Color(0x9cc3e6);
    scene.fog = new T.Fog(0x9cc3e6, 900, 2600);
    camera = new T.PerspectiveCamera(50, 1, 0.5, 6000);
    scene.add(new T.HemisphereLight(0xe8f1ff, 0x5a5040, 1.6));
    var sun = new T.DirectionalLight(0xfff1dc, 2.1);
    sun.position.set(300, 500, 200);
    scene.add(sun);
    procGroup = new T.Group(); decoGroup = new T.Group(); footGroup = new T.Group(); selGroup = new T.Group();
    scene.add(procGroup); scene.add(decoGroup); scene.add(footGroup); scene.add(selGroup);
    gizmo = makeGizmo(); scene.add(gizmo.root);
    window.addEventListener('resize', resize);
    resize();
    bindInput();
    (function loop() { requestAnimationFrame(loop); frame(); })();
  }
  function resize() {
    var c = $('#center'), w = c.clientWidth, h = c.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  function applyCam() {
    var p = cam.phi, t = cam.theta;
    camera.position.set(cam.tx + cam.r * Math.sin(p) * Math.sin(t), cam.ty + cam.r * Math.cos(p), cam.tz + cam.r * Math.sin(p) * Math.cos(t));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }
  function frame() {
    applyCam();
    if (gizmo.root.visible) {
      var d = camera.position.distanceTo(gizmo.root.position);
      gizmo.root.scale.setScalar(Math.max(0.5, d * 0.11));
    }
    renderer.render(scene, camera);
  }

  /* 땅 — 칸 색(게임 LAND_COLOR 와 같은 값)을 캔버스로 굽고 relief 높이로 민다 */
  function landBox() {
    var r = region(), w = r.map[0].length, h = r.map.length;
    return { x0: r.ox * GRID, z0: r.oy * GRID, w: w, h: h, x1: (r.ox + w) * GRID, z1: (r.oy + h) * GRID };
  }
  function buildGround() {
    if (groundMesh) { scene.remove(groundMesh); groundMesh.geometry.dispose(); }
    if (gridLines) { scene.remove(gridLines); gridLines.geometry.dispose(); }
    var r = region(), b = landBox(), PX = 16;
    var cv = document.createElement('canvas'); cv.width = b.w * PX; cv.height = b.h * PX;
    var c = cv.getContext('2d'), x, y;
    for (y = 0; y < b.h; y++) {
      for (x = 0; x < b.w; x++) {
        var e = r.legend[r.map[y].charAt(x)] || { kind: 'grass' };
        c.fillStyle = LAND_COLOR[e.kind] || '#777';
        c.fillRect(x * PX, y * PX, PX, PX);
        if (e.mark) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = 'bold 10px sans-serif'; c.fillText(r.map[y].charAt(x), x * PX + 4, y * PX + 12); }
      }
    }
    var tex = new T.CanvasTexture(cv);
    if (T.SRGBColorSpace) { tex.colorSpace = T.SRGBColorSpace; }
    tex.magFilter = T.NearestFilter;
    var SEG = 6, nx = b.w * SEG, nz = b.h * SEG, pos = [], uv = [], idx = [], i, j;
    for (j = 0; j <= nz; j++) {
      for (i = 0; i <= nx; i++) {
        var wx = b.x0 + i / SEG * GRID, wz = b.z0 + j / SEG * GRID;
        pos.push(wx, groundY(wx, wz), wz);
        uv.push(i / nx, 1 - j / nz);
      }
    }
    for (j = 0; j < nz; j++) {
      for (i = 0; i < nx; i++) {
        var a = j * (nx + 1) + i, bb = a + 1, cc = a + nx + 1, dd = cc + 1;
        idx.push(a, cc, bb, bb, cc, dd);
      }
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    groundMesh = new T.Mesh(g, new T.MeshLambertMaterial({ map: tex }));
    scene.add(groundMesh);
    /* 칸 경계 — 땅을 따라 조금 띄운 선 */
    var lp = [];
    function seg(ax, az, bx, bz) {
      var n = 12, k;
      for (k = 0; k < n; k++) {
        var x1 = ax + (bx - ax) * k / n, z1 = az + (bz - az) * k / n, x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n;
        lp.push(x1, groundY(x1, z1) + 0.25, z1, x2, groundY(x2, z2) + 0.25, z2);
      }
    }
    for (i = 0; i <= b.w; i++) { seg(b.x0 + i * GRID, b.z0, b.x0 + i * GRID, b.z1); }
    for (j = 0; j <= b.h; j++) { seg(b.x0, b.z0 + j * GRID, b.x1, b.z0 + j * GRID); }
    var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3));
    gridLines = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x1b2230, transparent: true, opacity: 0.35 }));
    gridLines.visible = $('#vGrid').checked;
    scene.add(gridLines);
  }

  /* ── 모델 ─────────────────────────────────────────────── */
  var PH = {};   // 모델을 못 받았을 때의 자리 표시 도형
  function placeholder(t) {
    if (PH[t]) { return PH[t]; }
    var info = T_INFO[t] || { col: '#999' }, g;
    if (t === 'tree' || t === 'grass' || t === 'reed') { g = new T.ConeGeometry(0.35, 1, 7); g.translate(0, 0.5, 0); }
    else if (t === 'rock') { g = new T.SphereGeometry(0.5, 8, 6); g.translate(0, 0.35, 0); }
    else if (t === 'lamp' || t === 'scare') { g = new T.CylinderGeometry(0.06, 0.06, 1, 6); g.translate(0, 0.5, 0); }
    else { g = new T.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); }
    PH[t] = { geometry: g, material: new T.MeshLambertMaterial({ color: new T.Color(info.col) }) };
    return PH[t];
  }
  /** 게임 `instGlb` 와 같은 값 — 모델 조각·키·돌림 */
  function modelOf(t, gx, gy, p) {
    var name = GLB[t], P3 = DG.prop3d;
    var sx = gx + Math.round(p.x), sy = gy + Math.round(p.z);
    var got = name && P3 ? P3.parts(name, sx, sy) : null;
    var ry = typeof p.rot === 'number' ? p.rot : h1(sx * 41 + 7, sy * 83 + 13) * Math.PI * 2;
    var hh = p.h * (name && P3 ? P3.heightMul(name) : 1);
    return { got: got, ry: ry, hh: hh, key: got ? got.url : 'ph:' + t };
  }

  /* 해시 소품 — 게임 propPlan 을 칸마다 불러(놓은 소품은 빼고) 인스턴스로 세운다 */
  var procPending = 0;
  function buildProc() {
    while (procGroup.children.length) { procGroup.remove(procGroup.children[0]); }
    var r = region(), keep = r.deco, b = landBox(), gx, gy, i, buckets = {}, water = [], fields = [];
    r.deco = [];
    try {
      for (gy = r.oy; gy < r.oy + b.h; gy++) {
        for (gx = r.ox; gx < r.ox + b.w; gx++) {
          var kind = DG.land.terrainAt(gx, gy);
          if (!kind) { continue; }
          var plan = DG.world3d.propPlan(kind, gx, gy, false);
          var ox = gx * GRID + GRID / 2, oz = gy * GRID + GRID / 2;
          for (i = 0; i < plan.length; i++) {
            var p = plan[i], x = ox + p.x, z = oz + p.z;
            if (p.t === 'water') { water.push({ x: ox, z: oz }); continue; }
            if (p.t === 'field') { fields.push({ x: x, z: z, w: p.w, d: p.d, rot: p.rot }); continue; }
            if (!GLB[p.t] && !T_INFO[p.t]) { continue; }
            var m = modelOf(p.t, gx, gy, p);
            var parts = m.got ? m.got.parts : [placeholder(p.t)];
            for (var k = 0; k < parts.length; k++) {
              var key = m.key + '#' + k;
              (buckets[key] || (buckets[key] = { part: parts[k], list: [] })).list.push({ x: x, z: z, ry: m.ry, s: m.hh });
            }
          }
        }
      }
    } finally { r.deco = keep; }
    var mtx = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), v = new T.Vector3(), sc = new T.Vector3();
    Object.keys(buckets).forEach(function (key) {
      var B = buckets[key], im = new T.InstancedMesh(B.part.geometry, B.part.material, B.list.length);
      B.list.forEach(function (o, n) {
        q.setFromAxisAngle(up, o.ry); v.set(o.x, groundY(o.x, o.z), o.z); sc.set(o.s, o.s, o.s);
        mtx.compose(v, q, sc); im.setMatrixAt(n, mtx);
      });
      im.instanceMatrix.needsUpdate = true;
      procGroup.add(im);
    });
    var wm = new T.MeshLambertMaterial({ color: 0x2f6f9e, transparent: true, opacity: 0.85 });
    water.forEach(function (w) {
      var m = new T.Mesh(new T.PlaneGeometry(GRID + 0.5, GRID + 0.5), wm);
      m.rotation.x = -Math.PI / 2; m.position.set(w.x, groundY(w.x, w.z) + 0.12, w.z); procGroup.add(m);
    });
    var fm = new T.MeshLambertMaterial({ color: 0x3f6b52 });
    fields.forEach(function (f) {
      var m = new T.Mesh(new T.BoxGeometry(f.w, 0.18, f.d), fm);
      m.rotation.y = f.rot; m.position.set(f.x, groundY(f.x, f.z) + 0.09, f.z); procGroup.add(m);
    });
    procGroup.visible = $('#vProc').checked;
    /* 모델이 늦게 오면 다시 짓는다(prop3d 가 받아 둔 것을 다시 쓰니 두 번째는 빠르다) */
    var st = DG.prop3d.stats();
    if (st.loading > 0 && procPending < 90) {
      procPending++;
      setTimeout(function () { buildProc(); rebuildAllDeco(); }, 700);
      $('#badge').textContent = '모델 받는 중… ' + st.ok + '/' + (st.ok + st.loading + st.fail);
      $('#loading').textContent = '모델 받는 중… ' + st.ok + '/' + (st.ok + st.loading + st.fail);
    } else {
      procPending = 0; updateBadge(); $('#loading').style.display = 'none';
      if (st.fail) { log('모델 ' + st.fail + '개를 못 받아 도형으로 둔다', false); }
    }
  }

  /* 놓은 소품 하나 — decoAt(게임 변환)을 거쳐 그 칸 계획과 같은 모양으로 */
  function planOf(di) {
    var d = deco[di], c = cellOf(d.x, d.z);
    var list = DG.land.decoAt(c.gx, c.gy);
    for (var i = 0; i < list.length; i++) { if (list[i].di === di) { return { p: list[i], gx: c.gx, gy: c.gy }; } }
    return null;       // 땅 밖·모르는 종류 — 게임이 안 세운다
  }
  function buildItem(di) {
    if (itemObj[di]) { decoGroup.remove(itemObj[di]); delete itemObj[di]; }
    var d = deco[di], g = new T.Group();
    g.userData.di = di;
    var pl = planOf(di);
    if (pl) {
      var m = modelOf(pl.p.t, pl.gx, pl.gy, pl.p);
      var parts = m.got ? m.got.parts : [placeholder(pl.p.t)];
      parts.forEach(function (pt) { var mesh = new T.Mesh(pt.geometry, pt.material); mesh.userData.di = di; g.add(mesh); });
      g.position.set(d.x, groundY(d.x, d.z), d.z);
      g.rotation.y = m.ry; g.scale.setScalar(m.hh);
    } else {
      /* 게임이 안 세우는 소품은 빨간 상자로 둔다(검사가 막는다) */
      var bad = new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshBasicMaterial({ color: 0xff3344, wireframe: true }));
      bad.userData.di = di; g.add(bad);
      g.position.set(d.x, groundY(d.x, d.z) + 1, d.z);
    }
    decoGroup.add(g);
    itemObj[di] = g;
  }
  function rebuildAllDeco() {
    syncRegion();
    while (decoGroup.children.length) { decoGroup.remove(decoGroup.children[0]); }
    itemObj = {};
    for (var i = 0; i < deco.length; i++) { buildItem(i); }
    buildFoot(); buildSel();
  }

  /* 벽 충돌 범위 — `houseRects` 와 같은 식(마을 칸 밖에 놓은 것도 벽이다 — houseRects 가 그 칸 deco 를 본다) */
  function rectOf(d) {
    if (d.t === 'house' || d.t === 'tower') { return { w: d.w > 0 ? d.w : 8, d: d.d > 0 ? d.d : (d.w > 0 ? d.w : 8) * 0.85, rot: d.rot || 0 }; }
    if (d.t === 'well') { return { w: d.h * 1.6, d: d.h * 1.6, rot: 0 }; }
    if (d.t === 'market') { return { w: d.h * 2.8, d: d.h * 1.8, rot: d.rot || 0 }; }
    return null;
  }
  function buildFoot() {
    while (footGroup.children.length) { footGroup.remove(footGroup.children[0]); }
    deco.forEach(function (d) {
      var rc = rectOf(d);
      if (!rc) { return; }
      var c = Math.cos(rc.rot), s = Math.sin(rc.rot), pts = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(function (k) {
        var lx = k[0] * rc.w / 2, lz = k[1] * rc.d / 2;
        /* houseRects 판정: lx = dx*c + dz*s, lz = -dx*s + dz*c 의 거꾸로 */
        var x = d.x + lx * c - lz * s, z = d.z + lx * s + lz * c;
        pts.push(new T.Vector3(x, groundY(x, z) + 0.35, z));
      });
      var ln = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xff9a3c }));
      footGroup.add(ln);
    });
    footGroup.visible = $('#vFoot').checked;
  }
  function buildSel() {
    while (selGroup.children.length) { selGroup.remove(selGroup.children[0]); }
    sel.forEach(function (di) { if (itemObj[di]) { selGroup.add(new T.BoxHelper(itemObj[di], 0xffd23a)); } });
    placeGizmo();
  }

  /* ── 기즈모 ───────────────────────────────────────────── */
  function makeGizmo() {
    var root = new T.Group(), H = {};
    function mat(col) { return new T.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.9 }); }
    function tag(o, axis, col) { o.userData.axis = axis; o.userData.col = col; o.renderOrder = 999; o.traverse(function (c) { c.userData.axis = axis; c.renderOrder = 999; }); return o; }
    function arrow(axis, col) {
      var g = new T.Group();
      var shaft = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1, 8), mat(col)); shaft.position.y = 0.5;
      var head = new T.Mesh(new T.ConeGeometry(0.1, 0.28, 12), mat(col)); head.position.y = 1.1;
      var hit = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 1.3, 6), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 0.65;
      g.add(shaft); g.add(head); g.add(hit);
      if (axis === 'x') { g.rotation.z = -Math.PI / 2; } else { g.rotation.x = Math.PI / 2; }
      return tag(g, axis, col);
    }
    H.move = new T.Group();
    H.move.add(arrow('x', 0xff4a4a)); H.move.add(arrow('z', 0x4a8cff));
    var pl = new T.Mesh(new T.PlaneGeometry(0.32, 0.32), new T.MeshBasicMaterial({ color: 0xffd23a, depthTest: false, transparent: true, opacity: 0.55, side: T.DoubleSide }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(0.3, 0, 0.3);
    H.move.add(tag(pl, 'xz', 0xffd23a));
    H.rot = new T.Group();
    var ring = new T.Mesh(new T.TorusGeometry(0.95, 0.03, 8, 64), mat(0x5ee06a)); ring.rotation.x = Math.PI / 2;
    var ringHit = new T.Mesh(new T.TorusGeometry(0.95, 0.12, 6, 32), new T.MeshBasicMaterial({ visible: false })); ringHit.rotation.x = Math.PI / 2;
    H.rot.add(tag(ring, 'rot', 0x5ee06a)); H.rot.add(tag(ringHit, 'rot', 0x5ee06a));
    H.scale = new T.Group();
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(function (k) {
      var cb = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.16), mat(0xffd23a)); cb.position.set(k[0] * 0.9, 0, k[1] * 0.9);
      H.scale.add(tag(cb, 'scale', 0xffd23a));
    });
    var sq = [];
    [[1, 1], [-1, 1], [-1, -1], [1, -1], [1, 1]].forEach(function (k) { sq.push(new T.Vector3(k[0] * 0.9, 0, k[1] * 0.9)); });
    var sqLine = new T.Line(new T.BufferGeometry().setFromPoints(sq), new T.LineBasicMaterial({ color: 0xffd23a, depthTest: false, transparent: true }));
    sqLine.renderOrder = 999; H.scale.add(sqLine);
    root.add(H.move); root.add(H.rot); root.add(H.scale);
    root.visible = false;
    return { root: root, H: H };
  }
  function pivot() {
    var x = 0, z = 0;
    sel.forEach(function (di) { x += deco[di].x; z += deco[di].z; });
    x /= sel.length; z /= sel.length;
    return new T.Vector3(x, groundY(x, z) + 0.3, z);
  }
  function placeGizmo() {
    var on = sel.length > 0 && mode !== 'sel';
    gizmo.root.visible = on;
    if (!on) { return; }
    gizmo.root.position.copy(pivot());
    gizmo.H.move.visible = mode === 'move'; gizmo.H.rot.visible = mode === 'rot'; gizmo.H.scale.visible = mode === 'scale';
  }
  function setMode(m) {
    mode = m;
    ['sel', 'move', 'rot', 'scale'].forEach(function (k) { $('#m' + { sel: 'Sel', move: 'Move', rot: 'Rot', scale: 'Scale' }[k]).classList.toggle('on', k === m); });
    placeGizmo();
  }

  /* ── 입력 ─────────────────────────────────────────────── */
  var drag = null, orbit = null, hover = null;
  function rayAt(e) {
    var rc = $('#view').getBoundingClientRect();
    var ndc = new T.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    var rr = new T.Raycaster(); rr.setFromCamera(ndc, camera);
    return rr;
  }
  function hitPlane(rr, y) {
    var pl = new T.Plane(new T.Vector3(0, 1, 0), -y), out = new T.Vector3();
    return rr.ray.intersectPlane(pl, out) ? out : null;
  }
  function hitGround(rr) { var h = rr.intersectObject(groundMesh, false); return h.length ? h[0].point : hitPlane(rr, 0); }
  function hitItem(rr) {
    var h = rr.intersectObjects(decoGroup.children, true);
    for (var i = 0; i < h.length; i++) { if (h[i].object.userData.di !== undefined) { return h[i].object.userData.di; } }
    return -1;
  }
  function hitHandle(rr) {
    if (!gizmo.root.visible) { return null; }
    var act = mode === 'move' ? gizmo.H.move : mode === 'rot' ? gizmo.H.rot : gizmo.H.scale;
    var h = rr.intersectObjects(act.children, true);
    for (var i = 0; i < h.length; i++) { if (h[i].object.userData.axis) { return h[i].object.userData.axis; } }
    return null;
  }
  function snapOn(e) { return e && (e.ctrlKey || e.metaKey) ? !snap : snap; }

  function bindInput() {
    var cv = $('#view');
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) {
      cv.focus();
      cv.setPointerCapture(e.pointerId);
      var rr = rayAt(e);
      if (e.button === 2 || e.button === 1) {
        if (e.button === 2 && placing) { setPlacing(null); return; }
        orbit = { pan: e.button === 1 || e.shiftKey, x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button !== 0) { return; }
      if (placing) { var gp = hitGround(rr); if (gp) { addItem(placing, gp.x, gp.z); } return; }
      var ax = hitHandle(rr);
      if (ax) { beginDrag(ax, hitPlane(rr, pivot().y)); return; }
      var di = hitItem(rr);
      if (di >= 0) {
        if (e.shiftKey) { toggleSel(di); return; }
        if (sel.indexOf(di) < 0) { setSel([di]); }
        beginDrag('xz', hitPlane(rr, pivot().y));   // 소품을 곧바로 끌면 땅 위로 옮긴다(어느 모드든)
        return;
      }
      drag = { marquee: true, x: e.clientX, y: e.clientY, add: e.shiftKey };
    });
    cv.addEventListener('pointermove', function (e) {
      if (orbit) {
        var dx = e.clientX - orbit.x, dy = e.clientY - orbit.y; orbit.x = e.clientX; orbit.y = e.clientY;
        if (orbit.pan) {
          /* 잡아 끄는 느낌 — 오른쪽으로 끌면 땅이 오른쪽으로(초점은 왼쪽으로) 간다 */
          var k = cam.r * 0.0016, rx = Math.cos(cam.theta), rz = -Math.sin(cam.theta), fx = -Math.sin(cam.theta), fz = -Math.cos(cam.theta);
          cam.tx += (-rx * dx + fx * dy) * k;
          cam.tz += (-rz * dx + fz * dy) * k;
          cam.ty = groundY(cam.tx, cam.tz);
        } else {
          cam.theta -= dx * 0.006;
          cam.phi = Math.max(0.08, Math.min(1.52, cam.phi - dy * 0.006));
        }
        return;
      }
      if (drag && drag.marquee) { showMarquee(e); return; }
      if (drag) { var dp = hitPlane(rayAt(e), drag.pv.y); if (dp) { moveDrag(dp, snapOn(e)); } return; }
      var rr = rayAt(e), gp = hitGround(rr);
      if (gp) { hud(gp); }
      if (placing && gp) { moveGhost(gp); }
      var ax = hitHandle(rr);
      if (ax !== hover) { hover = ax; highlight(ax); }
    });
    cv.addEventListener('pointerup', function (e) {
      if (orbit) { orbit = null; return; }
      if (drag && drag.marquee) { endMarquee(e); drag = null; return; }
      if (drag) { endDrag(); drag = null; }
    });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.r = Math.max(6, Math.min(2400, cam.r * (1 + Math.sign(e.deltaY) * 0.12)));
    }, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    $('#mSel').onclick = function () { setMode('sel'); };
    $('#mMove').onclick = function () { setMode('move'); };
    $('#mRot').onclick = function () { setMode('rot'); };
    $('#mScale').onclick = function () { setMode('scale'); };
    $('#bSnap').onclick = function () { snap = !snap; $('#bSnap').classList.toggle('on', snap); };
    $('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
    $('#bSave').onclick = save;
    $('#bReload').onclick = function () { if (!dirty || confirmLose()) { reload(); } };
    $('#bDup').onclick = duplicate; $('#bDel').onclick = removeSel;
    $('#bAll').onclick = function () { setSel(deco.map(function (_, i) { return i; })); };
    $('#landSel').onchange = function () { if (!dirty || confirmLose()) { pickLand(+$('#landSel').value); } };
    $('#vProc').onchange = function () { procGroup.visible = this.checked; };
    $('#vGrid').onchange = function () { gridLines.visible = this.checked; };
    $('#vFoot').onchange = function () { footGroup.visible = this.checked; };
    $('#bPlay').onclick = function () { play(false); };
    $('#bPlayHere').onclick = function () { play(true); };
  }
  function confirmLose() { return window.confirm('저장 안 한 배치가 있다. 버릴까?'); }
  function highlight(ax) {
    [gizmo.H.move, gizmo.H.rot, gizmo.H.scale].forEach(function (G) {
      G.traverse(function (o) {
        if (o.material && o.material.color && o.userData.axis && o.material.visible !== false) {
          o.material.color.setHex(o.userData.axis === ax ? 0xffffff : (o.userData.col || o.parent.userData.col || 0xffffff));
        }
      });
    });
  }

  /* 끌기는 **땅과 나란한 판(고른 것의 높이)** 위의 점으로 잰다 — 마우스는 그 점을 구해 넘길 뿐이다 */
  function beginDrag(axis, start) {
    var pv = pivot();
    if (!start) { return; }
    drag = { axis: axis, pv: pv, start: start, before: JSON.stringify(deco),
             items: sel.map(function (di) { var d = deco[di]; return { di: di, x: d.x, z: d.z, rot: d.rot || 0, h: d.h, w: d.w, d: d.d }; }),
             a0: Math.atan2(start.z - pv.z, start.x - pv.x), r0: Math.max(0.01, Math.hypot(start.x - pv.x, start.z - pv.z)), moved: false };
  }
  function moveDrag(p, sn) {
    if (drag.axis === 'x' || drag.axis === 'z' || drag.axis === 'xz') {
      var dx = p.x - drag.start.x, dz = p.z - drag.start.z;
      if (drag.axis === 'x') { dz = 0; } if (drag.axis === 'z') { dx = 0; }
      drag.items.forEach(function (o) {
        var nx = o.x + dx, nz = o.z + dz;
        if (sn) { nx = Math.round(nx * 2) / 2; nz = Math.round(nz * 2) / 2; }
        deco[o.di].x = nx; deco[o.di].z = nz;
      });
    } else if (drag.axis === 'rot') {
      var da = Math.atan2(p.z - drag.pv.z, p.x - drag.pv.x) - drag.a0;
      if (sn) { da = Math.round(da / (Math.PI / 12)) * (Math.PI / 12); }
      var c = Math.cos(da), s = Math.sin(da);
      drag.items.forEach(function (o) {
        var vx = o.x - drag.pv.x, vz = o.z - drag.pv.z;
        if (drag.items.length > 1) { deco[o.di].x = drag.pv.x + vx * c - vz * s; deco[o.di].z = drag.pv.z + vx * s + vz * c; }
        /* 화면에서 +x→+z 로 돈 만큼 three 의 rotation.y 는 거꾸로 준다 */
        var nr = o.rot - da;
        nr = ((nr % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        deco[o.di].rot = nr;
      });
    } else if (drag.axis === 'scale') {
      var k = Math.hypot(p.x - drag.pv.x, p.z - drag.pv.z) / drag.r0;
      if (sn) { k = Math.max(0.05, Math.round(k * 20) / 20); }
      drag.items.forEach(function (o) {
        var d = deco[o.di];
        d.h = Math.max(0.2, Math.min(80, o.h * k));
        if (o.w !== undefined) { d.w = Math.max(0.5, Math.min(60, o.w * k)); }
        if (o.d !== undefined) { d.d = Math.max(0.5, Math.min(60, o.d * k)); }
      });
    }
    drag.moved = true;
    syncRegion();
    drag.items.forEach(function (o) { buildItem(o.di); });
    buildFoot(); buildSel(); renderInsp(); hud(p);
  }
  function endDrag() {
    if (!drag.moved) { return; }
    undoS.push(drag.before); redoS = []; changed();
  }

  function showMarquee(e) {
    var rc = $('#center').getBoundingClientRect(), m = $('#marquee');
    var x0 = Math.min(drag.x, e.clientX) - rc.left, y0 = Math.min(drag.y, e.clientY) - rc.top;
    m.style.display = 'block'; m.style.left = x0 + 'px'; m.style.top = y0 + 'px';
    m.style.width = Math.abs(e.clientX - drag.x) + 'px'; m.style.height = Math.abs(e.clientY - drag.y) + 'px';
  }
  function endMarquee(e) {
    $('#marquee').style.display = 'none';
    var small = Math.abs(e.clientX - drag.x) < 4 && Math.abs(e.clientY - drag.y) < 4;
    if (small) { if (!drag.add) { setSel([]); } return; }
    var rc = $('#view').getBoundingClientRect();
    var x0 = Math.min(drag.x, e.clientX), x1 = Math.max(drag.x, e.clientX), y0 = Math.min(drag.y, e.clientY), y1 = Math.max(drag.y, e.clientY);
    var got = drag.add ? sel.slice() : [], v = new T.Vector3();
    deco.forEach(function (d, i) {
      v.set(d.x, groundY(d.x, d.z) + 1, d.z).project(camera);
      if (v.z > 1) { return; }
      var sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1 && got.indexOf(i) < 0) { got.push(i); }
    });
    setSel(got);
  }

  function onKey(e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    var ctl = e.ctrlKey || e.metaKey, k = e.key;
    if (k === 'F5' || k === 'F6') { e.preventDefault(); play(k === 'F6'); return; }
    if (ctl && (k === 's' || k === 'S')) { e.preventDefault(); save(); return; }
    if (typing) { return; }
    if (ctl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) { redo(); } else { undo(); } return; }
    if (ctl && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
    if (ctl && (k === 'd' || k === 'D')) { e.preventDefault(); duplicate(); return; }
    if (ctl && (k === 'a' || k === 'A')) { e.preventDefault(); setSel(deco.map(function (_, i) { return i; })); return; }
    if (ctl) { return; }
    if (k === 'q' || k === 'Q') { setMode('sel'); } else if (k === 'w' || k === 'W') { setMode('move'); }
    else if (k === 'e' || k === 'E') { setMode('rot'); } else if (k === 'r' || k === 'R') { setMode('scale'); }
    else if (k === 'g' || k === 'G') { $('#bSnap').click(); }
    else if (k === 'f' || k === 'F') { focusSel(); }
    else if (k === 'Home') { frameAll(); }
    else if (k === 't' || k === 'T') { cam.phi = cam.phi < 0.2 ? 0.95 : 0.08; }
    else if (k === 'Delete' || k === 'Backspace') { removeSel(); }
    else if (k === 'Escape') { if (placing) { setPlacing(null); } else { setSel([]); } }
    else if (k.indexOf('Arrow') === 0 && sel.length) { e.preventDefault(); nudge(k, e.shiftKey ? 5 : 0.5); }
  }
  /* 화살표로 조금씩 — 화면 방향 기준(위 = 카메라가 보는 쪽) */
  function nudge(k, step) {
    var fx = -Math.sin(cam.theta), fz = -Math.cos(cam.theta), rx = Math.cos(cam.theta), rz = -Math.sin(cam.theta);
    var dx = 0, dz = 0;
    if (k === 'ArrowUp') { dx = fx; dz = fz; } else if (k === 'ArrowDown') { dx = -fx; dz = -fz; }
    else if (k === 'ArrowLeft') { dx = -rx; dz = -rz; } else if (k === 'ArrowRight') { dx = rx; dz = rz; }
    /* 큰 축으로 붙인다 — 비스듬히 밀면 격자에서 벗어난다 */
    if (Math.abs(dx) > Math.abs(dz)) { dx = Math.sign(dx); dz = 0; } else { dz = Math.sign(dz); dx = 0; }
    edit(function () { sel.forEach(function (di) { deco[di].x += dx * step; deco[di].z += dz * step; }); });
  }

  /* ── 편집 ─────────────────────────────────────────────── */
  function edit(fn) {
    undoS.push(JSON.stringify(deco)); redoS = [];
    fn();
    rebuildAllDeco(); changed();
  }
  function changed() {
    dirty = true;
    renderList(); renderInsp(); updateBadge(); scheduleCheck();
  }
  function undo() {
    if (!undoS.length) { return; }
    redoS.push(JSON.stringify(deco)); deco = JSON.parse(undoS.pop());
    sel = sel.filter(function (di) { return di < deco.length; });
    rebuildAllDeco(); changed();
  }
  function redo() {
    if (!redoS.length) { return; }
    undoS.push(JSON.stringify(deco)); deco = JSON.parse(redoS.pop());
    sel = sel.filter(function (di) { return di < deco.length; });
    rebuildAllDeco(); changed();
  }
  function newItem(t, x, z) {
    var I = T_INFO[t] || { h: 2 }, o = { t: t, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, h: I.h };
    /* 나무·바위·풀은 자리마다 조금씩 달라야 숲으로 보인다(같은 키·같은 방향이면 복사한 티가 난다) */
    if (t === 'tree' || t === 'rock' || t === 'grass' || t === 'reed') {
      o.h = Math.round(I.h * (0.8 + Math.random() * 0.4) * 10) / 10;
      o.rot = Math.round(Math.random() * Math.PI * 2 * 100) / 100;
    } else { o.rot = 0; }
    if (I.w) { o.w = I.w; o.d = I.d; }
    return o;
  }
  function addItem(t, x, z) {
    edit(function () { deco.push(newItem(t, x, z)); sel = [deco.length - 1]; });
    log('놓음 ' + (T_INFO[t] || {}).label + ' (' + fix(x, 1) + ', ' + fix(z, 1) + ')', true);
  }
  function duplicate() {
    if (!sel.length) { return; }
    edit(function () {
      var n0 = deco.length;
      sel.forEach(function (di) { var c = JSON.parse(JSON.stringify(deco[di])); c.x += 2; c.z += 2; deco.push(c); });
      sel = []; for (var i = n0; i < deco.length; i++) { sel.push(i); }
    });
  }
  function removeSel() {
    if (!sel.length) { return; }
    var n = sel.length;
    edit(function () {
      var drop = {}; sel.forEach(function (di) { drop[di] = 1; });
      deco = deco.filter(function (_, i) { return !drop[i]; });
      sel = [];
    });
    log('지움 ' + n + '개', true);
  }
  function setSel(list) { sel = list.slice(); buildSel(); renderList(); renderInsp(); }
  function toggleSel(di) { var i = sel.indexOf(di); if (i >= 0) { sel.splice(i, 1); } else { sel.push(di); } setSel(sel); }

  function setPlacing(t) {
    placing = t;
    document.querySelectorAll('#palette button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    if (ghost) { scene.remove(ghost); ghost = null; }
    $('#view').style.cursor = t ? 'crosshair' : '';
    if (t) {
      var ph = placeholder(t);
      ghost = new T.Mesh(ph.geometry, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
      ghost.scale.setScalar((T_INFO[t] || { h: 2 }).h * (GLB[t] ? DG.prop3d.heightMul(GLB[t]) : 1));
      ghost.visible = false; scene.add(ghost);
    }
  }
  function moveGhost(p) { if (!ghost) { return; } ghost.visible = true; ghost.position.set(p.x, groundY(p.x, p.z), p.z); }

  /* ── 카메라 ───────────────────────────────────────────── */
  function frameAll() {
    var b = landBox();
    cam.tx = (b.x0 + b.x1) / 2; cam.tz = (b.z0 + b.z1) / 2; cam.ty = 0;
    cam.r = Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.95; cam.phi = 0.75;
  }
  function focusAt(x, z, r) { cam.tx = x; cam.tz = z; cam.ty = groundY(x, z); cam.r = r || 60; }
  function focusSel() {
    if (!sel.length) { return; }
    var pv = pivot(), far = 0;
    sel.forEach(function (di) { far = Math.max(far, Math.hypot(deco[di].x - pv.x, deco[di].z - pv.z), deco[di].h); });
    focusAt(pv.x, pv.z, Math.max(25, far * 3));
  }

  /* ── 패널 ─────────────────────────────────────────────── */
  function renderPalette() {
    $('#palette').innerHTML = types.map(function (t) {
      var I = T_INFO[t] || { label: t, col: '#999' };
      return '<button data-t="' + esc(t) + '"><span class="ic" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + I.col + ';margin-right:5px"></span>' + esc(I.label) + '</button>';
    }).join('');
    document.querySelectorAll('#palette button').forEach(function (b) { b.onclick = function () { setPlacing(placing === b.dataset.t ? null : b.dataset.t); }; });
  }
  function renderPlaces() {
    var r = region();
    $('#places').innerHTML = r.places.map(function (p, i) {
      return '<div class="it" data-i="' + i + '"><span class="ic" style="background:#cfd6ff">★</span><span>' + esc(p.name) + (p.hidden ? ' <span class="muted">숨은 곳</span>' : '') + '</span><span class="co">' + p.tx + ',' + p.ty + '</span></div>';
    }).join('');
    document.querySelectorAll('#places .it').forEach(function (d) {
      d.onclick = function () { var p = r.places[+d.dataset.i]; focusAt(p.tx * GRID + GRID / 2, p.ty * GRID + GRID / 2, 110); };
    });
  }
  function renderList() {
    $('#cnt').textContent = '(' + deco.length + ')';
    $('#items').innerHTML = deco.length ? deco.map(function (d, i) {
      var I = T_INFO[d.t] || { label: d.t, col: '#f33' };
      return '<div class="it' + (sel.indexOf(i) >= 0 ? ' sel' : '') + '" data-i="' + i + '"><span class="ic" style="background:' + I.col + '">' + (i + 1) + '</span>' +
        '<span>' + esc(I.label) + ' <span class="muted">' + fix(d.h, 1) + 'm</span></span><span class="co">' + fix(d.x, 1) + ', ' + fix(d.z, 1) + '</span></div>';
    }).join('') : '<div class="muted">아직 없다 — 위에서 종류를 누르고 땅을 클릭한다.</div>';
    document.querySelectorAll('#items .it').forEach(function (row) {
      var i = +row.dataset.i;
      row.onclick = function (e) { if (e.shiftKey || e.ctrlKey) { toggleSel(i); } else { setSel([i]); } };
      row.ondblclick = function () { setSel([i]); focusSel(); };
    });
  }
  function renderInsp() {
    var box = $('#insp');
    if (!sel.length) { box.className = 'muted'; box.innerHTML = '고른 소품이 없다.'; return; }
    box.className = '';
    if (sel.length > 1) {
      box.innerHTML = '<div>' + sel.length + '개 골랐다 — 기즈모로 함께 옮기고 돌리고 키운다.</div>' +
        '<div class="row"><button id="iSame">종류 바꾸기 →</button><select id="iSameT">' + types.map(function (t) { return '<option value="' + t + '">' + esc((T_INFO[t] || {}).label || t) + '</option>'; }).join('') + '</select></div>';
      $('#iSame').onclick = function () { var t = $('#iSameT').value; edit(function () { sel.forEach(function (di) { deco[di].t = t; }); }); };
      return;
    }
    var di = sel[0], d = deco[di], c = cellOf(d.x, d.z), kind = DG.land.terrainAt(c.gx, c.gy) || '땅 밖';
    var hasWD = d.t === 'house' || d.t === 'tower';
    var deg = Math.round(((d.rot || 0) * 180 / Math.PI) * 10) / 10;
    box.innerHTML = '<div class="kv">' +
      '<span>번호</span><span>#' + (di + 1) + ' · 칸 (' + c.gx + ',' + c.gy + ') ' + esc(kind) + '</span>' +
      '<span>종류</span><select data-k="t">' + types.map(function (t) { return '<option value="' + t + '"' + (t === d.t ? ' selected' : '') + '>' + esc((T_INFO[t] || {}).label || t) + ' (' + t + ')</option>'; }).join('') + '</select>' +
      '<span>x · z (m)</span><span class="pair"><input data-k="x" type="number" step="0.5" value="' + fix(d.x, 2) + '"><input data-k="z" type="number" step="0.5" value="' + fix(d.z, 2) + '"></span>' +
      '<span>키 h (m)</span><input data-k="h" type="number" step="0.1" min="0.2" max="80" value="' + fix(d.h, 2) + '">' +
      '<span>돌림 (°)</span><span class="pair"><input data-k="rotd" type="number" step="15" value="' + deg + '"><input data-k="rotr" type="range" min="0" max="360" step="1" value="' + ((deg % 360) + 360) % 360 + '"></span>' +
      (hasWD ? '<span>폭 w · 깊이 d</span><span class="pair"><input data-k="w" type="number" step="0.5" value="' + fix(d.w || 8, 2) + '"><input data-k="d" type="number" step="0.5" value="' + fix(d.d || (d.w || 8) * 0.85, 2) + '"></span>' +
        '<span>벽 밝기</span><input data-k="shade" type="range" min="0" max="1" step="0.05" value="' + (typeof d.shade === 'number' ? d.shade : 0.5) + '">' : '') +
      '</div><div class="muted" style="margin-top:6px">' +
      (hasWD ? '모델(GLB)은 키 h 로만 커진다. 폭·깊이는 벽 충돌과 모델이 안 왔을 때 상자 크기다.<br>' : '') +
      (SOLID[d.t] ? '사람이 부딪힌다(주황 선).' : '') + '</div>';
    box.querySelectorAll('[data-k]').forEach(function (inp) {
      var ev = inp.type === 'range' ? 'input' : 'change';
      var pushed = false;
      inp.addEventListener(ev, function () {
        var k = inp.dataset.k, v = inp.value;
        if (!pushed || ev === 'change') { undoS.push(JSON.stringify(deco)); redoS = []; pushed = ev === 'input'; }
        if (k === 't') { d.t = v; var I = T_INFO[v]; if (I && I.w && !(d.w > 0)) { d.w = I.w; d.d = I.d; } if (!(v === 'house' || v === 'tower')) { delete d.w; delete d.d; delete d.shade; } }
        else if (k === 'rotd' || k === 'rotr') { d.rot = ((+v % 360) + 360) % 360 * Math.PI / 180; }
        else if (k === 'shade') { d.shade = +v; }
        else if (isFinite(+v) && v !== '') { d[k] = +v; }
        syncRegion(); buildItem(di); buildFoot(); buildSel();
        dirty = true; updateBadge(); scheduleCheck(); renderList();
        if (ev === 'change') { renderInsp(); }
      });
      if (ev === 'input') { inp.addEventListener('change', function () { pushed = false; renderInsp(); }); }
    });
  }
  function hud(p) {
    var c = cellOf(p.x, p.z), kind = DG.land.terrainAt(c.gx, c.gy), mk = DG.land.markAt(c.gx, c.gy);
    $('#hud').textContent = 'x ' + fix(p.x, 1) + '  z ' + fix(p.z, 1) + '  높이 ' + fix(groundY(p.x, p.z), 1) + 'm\n칸 (' + c.gx + ',' + c.gy + ') ' +
      (kind || '땅 밖') + (mk ? ' · 표식 ' + mk : '') + (placing ? '\n놓기: ' + ((T_INFO[placing] || {}).label || placing) + ' — 클릭(계속), Esc 끝' : '');
  }
  function updateBadge() {
    var b = $('#badge');
    b.textContent = (dirty ? '● 고침 · ' : '') + '소품 ' + deco.length + '개';
    b.className = dirty ? 'warn' : 'muted';
  }

  /* ── 검사 ─────────────────────────────────────────────── */
  function scheduleCheck() {
    clearTimeout(checkTimer);
    localWarn();
    checkTimer = setTimeout(function () {
      fetch('/api/deco/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: L.game, id: L.id, deco: deco }) })
        .then(function (r) { return r.json(); }).then(function (rep) { if (rep.error) { showReport({ errors: [rep.error] }); } else { showReport(rep); } });
    }, 350);
  }
  function showReport(rep) {
    var e = (rep && rep.errors) || [];
    $('#report').innerHTML = e.length ? e.map(function (t) { return '<div class="bad">✗ ' + esc(t) + '</div>'; }).join('') : '<div class="ok">✓ 오류 없음</div>';
    localWarn();
  }
  /* 저장을 막지는 않지만 눈으로 볼 것 — 물 위·표식 칸·벽이 겹침·부딪히지 않는 집 */
  function obb(a, b) {
    function axes(r) { var c = Math.cos(r.rot), s = Math.sin(r.rot); return [[c, s], [-s, c]]; }
    function proj(r, ax) {
      var c = Math.cos(r.rot), s = Math.sin(r.rot), ext = Math.abs((r.w / 2) * (c * ax[0] + s * ax[1])) + Math.abs((r.d / 2) * (-s * ax[0] + c * ax[1]));
      var m = r.x * ax[0] + r.z * ax[1]; return [m - ext, m + ext];
    }
    var all = axes(a).concat(axes(b));
    for (var i = 0; i < all.length; i++) { var p = proj(a, all[i]), q = proj(b, all[i]); if (p[1] < q[0] || q[1] < p[0]) { return false; } }
    return true;
  }
  function localWarn() {
    var out = [], r = region(), keep = r.deco;
    var proc = {};
    deco.forEach(function (d, i) {
      var c = cellOf(d.x, d.z), kind = DG.land.terrainAt(c.gx, c.gy), mk = DG.land.markAt(c.gx, c.gy), nm = '#' + (i + 1) + ' ' + ((T_INFO[d.t] || {}).label || d.t);
      if (!kind) { return; }
      if (kind === 'water' && mk !== 'bridge' && d.t !== 'reed') { out.push(nm + ' — 물 위에 선다'); }
      if (mk) { out.push(nm + ' — 표식 칸(' + mk + ')이라 명소 모델과 겹칠 수 있다'); }
      var rc = rectOf(d);
      if (!rc) { return; }
      var A = { x: d.x, z: d.z, w: rc.w, d: rc.d, rot: rc.rot };
      /* 해시가 세운 집(놓은 것 빼고)과 겹치나 — 게임 houseRects 그대로 */
      var key = c.gx + ',' + c.gy;
      if (!proc[key]) { r.deco = []; try { proc[key] = DG.world3d.houseRects(c.gx, c.gy); } finally { r.deco = keep; } }
      if (proc[key].some(function (h) { return obb(A, h); })) { out.push(nm + ' — 해시가 세운 집·우물과 벽이 겹친다'); }
      deco.forEach(function (e2, j) {
        if (j <= i) { return; }
        var r2 = rectOf(e2);
        if (r2 && obb(A, { x: e2.x, z: e2.z, w: r2.w, d: r2.d, rot: r2.rot })) { out.push(nm + ' — #' + (j + 1) + ' 과 벽이 겹친다'); }
      });
    });
    $('#warns').innerHTML = out.length ? out.slice(0, 40).map(function (t) { return '<div class="warn">! ' + esc(t) + '</div>'; }).join('') + (out.length > 40 ? '<div class="muted">… ' + (out.length - 40) + '건 더</div>' : '')
      : '<div class="muted">없음</div>';
  }

  /* ── 저장·다시 읽기·실행 ──────────────────────────────── */
  function save() {
    if (!L) { return; }
    fetch('/api/deco/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: L.game, id: L.id, deco: deco, hash: hash }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) { log(j.error, false); if (j.report) { showReport(j.report); } return; }
        hash = j.hash; dirty = false; updateBadge();
        log(j.unchanged ? '바뀐 것 없음(파일 안 씀)' : '저장 — land.js deco ' + deco.length + '개' + (j.sw && j.sw.version ? ' · sw.js ' + j.sw.version : ''), true);
        if (!j.unchanged && window.SagaPlay) { window.SagaPlay.reloadIfOpen(); }
      }).catch(function (e) { log('저장 실패: ' + e.message, false); });
  }
  function reload() {
    fetch('/api/deco/list').then(function (r) { return r.json(); }).then(function (j) {
      lands = (j.items || []).filter(function (l) { return l.game === GAME; });
      var i = Math.max(0, lands.findIndex(function (l) { return L && l.id === L.id; }));
      pickLand(i); log('다시 읽음', true);
    });
  }
  function play(here) {
    if (!window.SagaPlay) { return; }
    var at = null;
    if (here) {
      var p = sel.length ? pivot() : new T.Vector3(cam.tx, 0, cam.tz);
      /* 소품 바로 위에 서면 벽에 갇힐 수 있어 카메라 쪽으로 조금 물린다 */
      at = { x: p.x + Math.sin(cam.theta) * 8, y: p.z + Math.cos(cam.theta) * 8 };
    }
    if (dirty) { log('저장 안 한 배치는 실행 창에 안 나온다(게임은 파일을 읽는다) — Ctrl+S 먼저', false); }
    window.SagaPlay.open(GAME, at);
  }

  /* 시험용 손잡이 — 마우스 없이 같은 함수를 부른다(jsdom 시험·콘솔). 좌표는 월드 미터 */
  window.SagaScene = {
    state: function () { return { deco: deco, sel: sel, dirty: dirty, mode: mode, hash: hash, undo: undoS.length, redo: redoS.length, ready: !!L }; },
    add: addItem, select: setSel, mode: setMode, undo: undo, redo: redo, duplicate: duplicate, remove: removeSel, save: save, nudge: nudge,
    drag: function (axis, from, to, sn) {
      beginDrag(axis, new T.Vector3(from.x, pivot().y, from.z));
      if (!drag) { return false; }
      moveDrag(new T.Vector3(to.x, drag.pv.y, to.z), !!sn); endDrag(); drag = null; return true;
    },
    pivot: function () { var p = pivot(); return { x: p.x, z: p.z }; },
    report: function () { return $('#report').textContent; },
    warns: function () { return $('#warns').textContent; },
    world: function () { return { proc: procGroup.children.length, deco: decoGroup.children.length, foot: footGroup.children.length }; }
  };
  boot();
})();
