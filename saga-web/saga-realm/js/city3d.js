/**
 * 성 안 — 3D 도시 화면 (PLAN README "Phase 6 성·도시")
 * ---------------------------------------------------------------
 * `ui-rtk.js`의 성 시트(`#sheet-body`)는 숫자만 늘어놓는다 — 이 파일은 그 시트
 * 위에 얹힌 `#city3d` 캔버스에 **그 숫자를 그대로 세운 작은 디오라마**를 띄운다.
 * 장식이 아니라 **읽는 화면**이다: 성벽 조각 수는 `wall/maxWall`(파손 비율),
 * 집 수는 인구, 시장 수는 상업, 밭떼기는 농업, 곳간 통나무는 군량을 그대로 딴다.
 *
 * `#city3d`는 `index.html`에서 `#sheet-body`의 형제로 한 번만 박혀 있다 —
 * `renderSheet()`가 `#sheet-body.innerHTML`을 갈아 끼워도 이 캔버스는 안 죽는다.
 * 그래서 렌더러를 매번 새로 만들지 않고, **성이 바뀌거나 그 성의 숫자가
 * 실제로 바뀌었을 때만** 다시 짓는다(`sig()` 로 스냅샷을 비교).
 *
 * 판정은 한 줄도 없다 — `rtk.city()`·`cityData.find()` 를 읽기만 한다.
 */
(function (global) {
  'use strict';

  var A3 = null;
  function asset3d() { if (!A3) { A3 = global.DG.asset3d; } return A3; }
  var CD = null;
  function cityData() { if (!CD) { CD = global.DG.cityData; } return CD; }
  var FD = null;
  function forceData() { if (!FD) { FD = global.DG.forceData; } return FD; }
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  function R() { return global.DG.rtk; }

  var TIER_H = { t1: 6, t2: 8, t3: 11 };
  function tierOf(maxWall) {
    var w = maxWall || 0;
    if (w >= 5600) { return 't3'; }
    if (w >= 4600) { return 't2'; }
    return 't1';
  }

  function forceColor(id) {
    var f = forceData().force(id);
    return f ? f.color : '#5b6572';
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ring(n, r, startAng) {
    var pts = [], i;
    for (i = 0; i < n; i++) {
      var a = startAng + (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  var canvas = null, renderer = null, scene = null, camera = null, dyn = null;
  var ready = false, failed = false, loopRunning = false;
  var rebuildSeq = 0;
  var curCityId = null, curSig = '';
  var spin = 0;
  var npcs = [];    // 걸어다니는 주민(2026-09-22) — build() 마다 새로 심고 tick() 이 오간다
  var workers = [];  // 제자리에서 훈련·일하는 주민(2026-09-22, 이어서) — 명령과는 안 엮는다(판정 없음),
                      // "성 안이 비어 보인다"는 지적에 우물·횃불처럼 **늘 있는 살림**으로 둔다
  var sheetEl = null;   // active() 가 매 프레임 부르므로 요소 자체는 캐시(감사, 2026-09-08)

  function available() { return !!three() && !failed; }
  function phone() { return !!(global.DG.deviceMode && global.DG.deviceMode.phone()); }
  /** W-0346 — 폰은 성 화면도 2D 가 기본(WebGL 하나가 지도의 두 배 메모리 — 10-18 pw-phone-budget 지도 15MB·성 35MB). 3D 는 그 탭에서 단추로만(deviceMode 'c3') */
  function ON() { var R = global.DG.realm3d, v = global.DG.core.tuned('city3d.on', 1) && !(R && R.wants3d && !R.wants3d()) ? true : false; return global.DG.deviceMode ? global.DG.deviceMode.want3d('c3', v) : v; }
  /** 끈다 — 만든 렌더러·장면을 버리고(WebGL 문맥까지 놓는다) 캔버스를 숨긴다. 다시 켜면 ensureInit 이 새로 짓는다 */
  function off() {
    var cv = canvas || document.getElementById('city3d');
    if (cv) { cv.style.display = 'none'; }
    if (renderer) { try { renderer.dispose(); if (renderer.forceContextLoss) { renderer.forceContextLoss(); } } catch (e) { /* 이미 잃음 */ } }
    renderer = null; scene = null; camera = null; dyn = null; ready = false; curCityId = null; curSig = ''; npcs = []; workers = [];
  }
  /** 꺼진 동안 성 시트 맨 위에 둘 2D 성 그림 + 3D 단추(판 설정 mode2d.prop2d 의 world2d 그림 — 지도 성 그림과 같은 것) */
  function stillHtml(cityId) {
    if (ON() || !three()) { return ''; }
    var c = R().city(cityId), d = cityData().find(cityId), A = global.DG.assets3d, t = (global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.prop2d) || {}, ef = global.DG.cfg && global.DG.cfg.mode2d && global.DG.cfg.mode2d.eraOf;
    var tier = tierOf(c && c.maxWall), p = t[tier === 't3' ? 'city:l' : tier === 't2' ? 'city:m' : 'city:s'], u = A && p && ((p.era && ef && d && A.spriteUrl(p.era + ef(d))) || A.spriteUrl(p.id));
    return '<div class="c3-still" style="display:flex;align-items:center;gap:10px;margin:0 0 8px">' + (u ? '<img src="' + u + '" alt="" style="width:96px;height:96px;object-fit:contain" loading="lazy">' : '') +
      '<button class="btn tiny ghost" data-act="c3-on" title="성 안을 3D 로 — 폰은 메모리를 더 씁니다">🧊 3D 로 보기</button></div>';
  }
  /** 3D 켜고 끄기(이 탭만 기억) */
  function set3d(on) { if (global.DG.deviceMode) { global.DG.deviceMode.mark('c3', !!on); } if (!on) { off(); } return ON(); }

  function active() {
    if (!sheetEl || !sheetEl.isConnected) { sheetEl = document.getElementById('sheet'); }
    return !!(ready && sheetEl && sheetEl.classList.contains('show') && sheetEl.getAttribute('data-tab') === 'city');
  }

  function ensureInit() {
    if (ready || failed) { return ready; }
    var t = three();
    canvas = document.getElementById('city3d');
    if (!t || !canvas) { failed = true; return false; }
    try {
      renderer = new t.WebGLRenderer({ canvas: canvas, antialias: !phone(), alpha: false });   // W-0346 폰 3D 는 안티앨리어스 끔
    } catch (e) { failed = true; return false; }
    renderer.setPixelRatio(phone() ? 1 : Math.min(global.devicePixelRatio || 1, 2));   // 폰은 화소비 1(realm3d low 와 같은 결)
    if (global.DG.toon3d && global.DG.toon3d.toneRenderer) { global.DG.toon3d.toneRenderer(renderer); }   // Neutral 톤매핑(2026-09-23)

    scene = new t.Scene();
    scene.background = (global.DG.toon3d && global.DG.toon3d.skyBackground) ? global.DG.toon3d.skyBackground(0xb9dcef) : new t.Color(0xb9dcef);   // 하늘 그라디언트(2026-09-23)
    scene.fog = new t.Fog(0xb9dcef, 34, 130);

    camera = new t.PerspectiveCamera(42, 1, 0.5, 400);

    var TNg = global.DG.toon3d, LG = TNg && TNg.lightGain ? TNg.lightGain() : 1;   // 톤매핑을 켜면 빛을 올린다(toon3d.toneRenderer)
    scene.add(new t.HemisphereLight(0xffffff, 0x4a5a3a, 1.0 * LG));
    var sun = new t.DirectionalLight(0xfff4e0, 1.05 * LG);
    sun.position.set(-14, 22, 10);
    scene.add(sun);

    var groundTN = global.DG.toon3d;
    var ground = new t.Mesh(
      new t.CircleGeometry(19, 28),
      groundTN ? groundTN.lambertLike({ color: 0xcfe0a0 }) : new t.MeshLambertMaterial({ color: 0xcfe0a0 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    dyn = new t.Group();
    scene.add(dyn);

    ready = true;
    resize();
    global.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!renderer || !camera || !canvas) { return; }
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 170;
    if (!w || !h) { return; }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /** 발밑 그림자 — 값싼 원 데칼(`realm3d.js`의 `addShadow`와 같은 요령) */
  var blobGeo = null, blobMat = null;
  function addShadow(x, z, r) {
    var t = three();
    if (!t || !dyn) { return; }
    if (!blobGeo) {
      blobGeo = new t.CircleGeometry(1, 16);
      blobMat = new t.MeshBasicMaterial({ color: 0x14140c, transparent: true, opacity: 0.28, depthWrite: false });
    }
    var m = new t.Mesh(blobGeo, blobMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    m.scale.setScalar(Math.max(0.4, r));
    dyn.add(m);
  }

  function addProp(kind, id, x, z, scaleH, rotY, seq) {
    asset3d().build(kind, { id: id }, function (g) {
      if (seq !== rebuildSeq || !g || !dyn) { return; }
      g.position.set(x, 0, z);
      g.rotation.y = rotY || 0;
      g.scale.setScalar(scaleH);
      dyn.add(g);
      addShadow(x, z, scaleH * 0.4);
    });
  }

  /** 걸어다니는 주민 2~3명 — "성 안에 아무것도 없어 심심하다"(2026-09-22 사용자 지적).
   *  `asset3d.buildHero()`는 실존 인물이 아닌 임의 id도 그 id 해시로 몸·옷을 하나 골라
   *  세운다(장수 아바타와 같은 경로) — 그 몸이 이미 갖춘 걷기 몸짓(mixer)을 `asset3d.step()`
   *  으로 튼다. 판정은 없다 — 두 점 사이를 왕복할 뿐이다. */
  function spawnVillagers(seq, h, cityId) {
    npcs = [];
    var count = clamp(Math.round(h / 5), 2, 3);
    var i;
    for (i = 0; i < count; i++) {
      var a1 = (i / count) * Math.PI * 2 + 0.5;
      var a2 = a1 + Math.PI * (0.55 + (i % 2) * 0.2);
      var r = h * (0.75 + (i % 2) * 0.35);
      var npc = {
        model: null,
        from: { x: Math.cos(a1) * r, z: Math.sin(a1) * r },
        to: { x: Math.cos(a2) * r * 0.75, z: Math.sin(a2) * r * 0.75 },
        dur: 8 + i * 2.5,
        t0: Date.now() / 1000 + i * 1.7
      };
      npcs.push(npc);
      (function (n) {
        asset3d().buildHero({ id: 'npc_' + cityId + '_' + i }, null, function (g) {
          if (seq !== rebuildSeq || !g || !dyn) { return; }
          g.scale.setScalar(0.85);
          g.position.set(n.from.x, 0, n.from.z);
          dyn.add(g);
          addShadow(n.from.x, n.from.z, 0.5);
          n.model = g;
        });
      })(npc);
    }
  }

  /** 걸어다니는 주민을 한 프레임 옮긴다 — 두 점 사이를 왕복(핑퐁), 걷는 방향으로 돈다 */
  function tickNpcs(now) {
    var i, n, el, cyc, frac, dx, dz;
    for (i = 0; i < npcs.length; i++) {
      n = npcs[i];
      if (!n.model) { continue; }
      el = Math.max(0, now - n.t0);
      cyc = (el % (n.dur * 2)) / n.dur;               // 0~2
      frac = cyc <= 1 ? cyc : (2 - cyc);               // 왕복(핑퐁) 0→1→0
      n.model.position.set(
        n.from.x + (n.to.x - n.from.x) * frac, 0,
        n.from.z + (n.to.z - n.from.z) * frac
      );
      dx = n.to.x - n.from.x; dz = n.to.z - n.from.z;
      if (cyc > 1) { dx = -dx; dz = -dz; }
      if (dx || dz) { n.model.rotation.y = Math.atan2(dx, dz); }
      asset3d().step(n.model, { anim: 'walk', t: now });
    }
  }

  /** 제자리에서 훈련·일하는 주민 둘 — "건설·훈련 모션도 있으면 좋겠다"(2026-09-22
   *  사용자 요청). 어느 명령을 썼는지는 안 읽는다(그런 상태 칸이 세이브에 아직
   *  없다) — 대신 우물·횃불처럼 **늘 있는 살림**으로 둔다. `attack`·`interaction`
   *  은 원샷 클립(`asset3d.js` ONE_SHOT)이라 `every`초마다 `force:true`로 다시
   *  틀어야 반복 동작처럼 보인다(한 번 튼 뒤 마지막 자세로 굳는 게 기본이다). */
  function spawnWorkers(seq, h, cityId) {
    workers = [];
    var specs = [
      { id: cityId + '_train', anim: 'attack', x: h * 0.75, z: -h * 0.7, every: 1.7 },
      { id: cityId + '_work', anim: 'interaction', x: -h * 1.15, z: h * 0.3, every: 2.2 }
    ];
    specs.forEach(function (sp) {
      var w = { model: null, anim: sp.anim, pose: sp.anim === 'attack' ? 'Pose_heavy' : 'Pose_pick', every: sp.every, next: 0 };
      workers.push(w);
      asset3d().buildHero({ id: 'npc_' + sp.id }, null, function (g) {
        if (seq !== rebuildSeq || !g || !dyn) { return; }
        g.scale.setScalar(0.85);
        g.position.set(sp.x, 0, sp.z);
        g.rotation.y = Math.atan2(-sp.x, -sp.z);   // 성 가운데 쪽을 보고 선다
        dyn.add(g);
        addShadow(sp.x, sp.z, 0.5);
        w.model = g;
      });
    });
  }

  /** 훈련·일하는 주민을 한 프레임 다룬다 — 원샷 동작을 `every`초마다 다시 튼다 */
  function tickWorkers(now) {
    var i, w;
    for (i = 0; i < workers.length; i++) {
      w = workers[i];
      if (!w.model) { continue; }
      var force = now >= w.next;
      if (force) { w.next = now + w.every; }
      asset3d().step(w.model, { anim: (w.model.userData.ownBody && global.DG.pose3d ? w.pose : null) || w.anim, t: now, force: force });   // W-0303 자체 몸짓 몸은 내리치기·줍기
    }
  }

  /** 성 하나를 통째로 다시 짓는다 — 숫자를 그대로 세운다 */
  function build(cityId) {
    var t = three();
    dyn.clear();
    rebuildSeq++;
    var seq = rebuildSeq;
    var d = cityData().find(cityId), c = R().city(cityId);
    if (!d || !c) { return; }
    var tier = tierOf(d.maxWall || d.wall || c.maxWall);
    var h = TIER_H[tier];
    var col = forceColor(c.force);
    var mine = c.force === R().me();

    asset3d().build('city:' + tier, { id: cityId + ':diorama', tint: col, flag: col }, function (g) {
      if (seq !== rebuildSeq || !g || !dyn) { return; }
      g.position.set(0, 0, 0);
      g.scale.setScalar(h);
      dyn.add(g);
      addShadow(0, 0, h * 0.45);
      if (mine) {
        var mring = new t.Mesh(
          new t.RingGeometry(h * 0.5, h * 0.62, 24),
          new t.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: t.DoubleSide })
        );
        mring.rotation.x = -Math.PI / 2;
        mring.position.set(0, 0.06, 0);
        dyn.add(mring);
      }
    });

    /* 성벽 — 파손 비율(wall/maxWall)만큼만 둘러선다. 포위로 깎이면 성벽이 준다 */
    var wallRatio = clamp((c.wall || 0) / (c.maxWall || 1), 0, 1);
    var wallN = Math.round(wallRatio * 6);
    ring(6, h * 0.95, 0).slice(0, wallN).forEach(function (p, i) {
      addProp('wall', cityId + ':wall:' + i, p[0], p[1], h * 0.55, Math.atan2(p[0], p[1]) + Math.PI / 2, seq);
    });

    /* 집 — 인구 */
    var houseN = clamp(Math.round((c.pop || 0) / 40000), 3, 9);
    ring(houseN, h * 1.5, 0.4).forEach(function (p, i) {
      addProp('house', cityId + ':house:' + i, p[0], p[1], h * 0.5 + ((i % 3) * 0.08), ((i * 47) % 628) / 100, seq);
    });

    /* 시장 — 상업 */
    var marketN = clamp(Math.round((c.comm || 0) / 80), 1, 5);
    var mi;
    for (mi = 0; mi < marketN; mi++) {
      var ma = 1.1 + mi * 0.5;
      addProp('market', cityId + ':market:' + mi, Math.cos(ma) * h * 1.05, Math.sin(ma) * h * 1.05, h * 0.45, ma, seq);
    }

    /* 밭 — 농업(꽃·덤불을 섞어 밭떼기처럼) */
    var farmN = clamp(Math.round((c.agri || 0) / 90), 2, 6);
    var fi;
    for (fi = 0; fi < farmN; fi++) {
      var fa = -1.4 + fi * 0.5;
      var kind = fi % 3 === 0 ? 'flower' : 'bush';
      addProp(kind, cityId + ':farm:' + fi, Math.cos(fa) * h * 1.4, Math.sin(fa) * h * 1.4, 0.9, fi, seq);
    }

    /* 곳간 — 군량 */
    var foodN = clamp(Math.round((c.food || 0) / 400) + 1, 1, 4);
    var gi;
    for (gi = 0; gi < foodN; gi++) {
      addProp('log', cityId + ':food:' + gi, -h * 0.9 - gi * 0.5, h * 0.6, 0.5, gi, seq);
    }

    /* 우물 · 횃불 — 늘 있는 살림. 치안이 높으면 횃불 하나가 더 선다 */
    addProp('well', cityId + ':well', h * 0.9, -h * 0.5, h * 0.4, 0, seq);
    addProp('torch', cityId + ':torchA', h * 0.55, h * 0.85, h * 0.35, 0, seq);
    addProp('torch', cityId + ':torchB', -h * 0.55, h * 0.85, h * 0.35, 0, seq);
    if ((c.sec || 0) >= 80) {
      addProp('torch', cityId + ':torchC', h * 1.0, h * 0.2, h * 0.32, 0, seq);
    }

    spawnVillagers(seq, h, cityId);
    spawnWorkers(seq, h, cityId);
  }

  function sig(cityId) {
    var c = R().city(cityId);
    if (!c) { return ''; }
    return [cityId, c.force, c.wall, c.maxWall, c.pop, c.comm, c.agri, c.food, c.sec].join(':');
  }

  /** 밖에서 부르는 단 하나의 입구 — 성이 다르거나 숫자가 바뀌었을 때만 다시 짓는다 */
  function render(cityId) {
    if (!ON()) { off(); return; }   // W-0346
    var cv = canvas || document.getElementById('city3d'); if (cv) { cv.style.display = ''; }
    if (!cityId || !ensureInit()) { return; }
    var s = sig(cityId);
    if (!(cityId === curCityId && s === curSig)) {
      curCityId = cityId; curSig = s;
      build(cityId);
    }
    resize();
    startLoop();
  }

  function startLoop() {
    if (loopRunning) { return; }
    loopRunning = true;
    requestAnimationFrame(tick);
  }

  var lastCityT = 0, aqC = null;
  function aqCity() { return aqC || (global.DG.autoq ? (aqC = global.DG.autoq.make('city3d')) : null); }
  /** 궤도 카메라를 손대지 않고 천천히 저절로 돈다 — 손잡이를 하나 더 두지 않는다 */
  function tick() {
    if (!active()) { loopRunning = false; return; }
    /* 화면에 보이는 채로 다른 창을 쓰는 중이면 렌더를 쉰다 — 안 그러면
       천천히 도는 카메라만으로도 계속 GPU 를 잡아먹는다(2026-09-08) */
    if (document.hidden || !document.hasFocus()) {
      global.setTimeout(function () { requestAnimationFrame(tick); }, 500);
      return;
    }
    /* 발열(2026-09-24) — 60 상한(손잡이 perf.fps). 120Hz 폰에서 초당 120번 그리던 헛그림만 막는다 */
    var nowMs = performance.now(), cfps = global.DG.core && global.DG.core.tuned ? global.DG.core.tuned('perf.fps', 60) : 60;
    /* W-0302 폰 예산 — 천천히 도는 장식 그림 칸이라 기본 30fps(손잡이 city3d.fps), 자동 품질(autoq)이 느리다고 보면 15 → 10fps·픽셀비 1 */
    var aq = aqCity(), capF = [global.DG.core.tuned('city3d.fps', 30), 15, 10][aq ? aq.st.down : 0];
    cfps = cfps > 0 ? Math.min(cfps, capF) : capF;
    if (cfps > 0 && nowMs - lastCityT < 1000 / cfps - 2) { requestAnimationFrame(tick); return; }
    if (aq && lastCityT && aq.note((nowMs - lastCityT) / 1000 * 16.7 / (1000 / cfps), true)) { renderer.setPixelRatio(1); }
    lastCityT = nowMs;
    spin += 0.0035;
    var dist = TIER_H.t3 * 2.6;
    camera.position.set(Math.sin(spin) * dist, TIER_H.t3 * 1.5, Math.cos(spin) * dist);
    camera.lookAt(0, TIER_H.t2 * 0.4, 0);
    tickNpcs(Date.now() / 1000);
    tickWorkers(Date.now() / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  global.DG = global.DG || {};
  global.DG.city3d = { available: available, render: render, on: ON, set3d: set3d, stillHtml: stillHtml, _live: function () { return !!renderer; } };

  /* 성 시트가 열린 채로 명령을 실행하면(달이 넘어가는 등) 숫자가 바뀐 만큼 다시 짓는다 */
  global.DG.core.on('changed', function () {
    if (curCityId && active()) { curSig = ''; render(curCityId); }
  });
})(window);
