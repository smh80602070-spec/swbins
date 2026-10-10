/**
 * 하늘 파노라마 — 단색 하늘 대신 그린 하늘 한 장이 둘러선다 (W-0140 ①, 배경 사실화)
 * ---------------------------------------------------------------
 * 여태 3D 하늘은 `lightingAt().bg` **색 하나**였다. 카메라를 들면 지평선 위가
 * 통째로 한 가지 파랑이었다. 자체툴이 시각 넷 × 시대 셋으로 그린 하늘
 * (`shared/assets/sky/sky_<때>_<시대>_1k.webp`, 등장방형 2:1, K-0090)이 이미
 * 있어 그것을 **카메라를 감싸는 공** 안쪽에 붙인다.
 *
 *   때     `lightingAt().phase` → dawn·noon·sunset·night (dusk → sunset, twilight 은 오전이면 dawn)
 *   시대   발밑 땅(`biome.zoneAt`)의 era — past·myth → past, modern → present,
 *          future → future, 고향(땅 없음) → present
 *   천후   비·눈·안개는 그린 맑은 하늘이 어울리지 않아 **옛 단색**으로 둔다
 *
 * **해가 그림 속 해 자리에서 비춘다.** `sky_markers.json` 의 방위·고도로
 * DirectionalLight 방향을 맞춘다 — 그림의 해와 그림자 방향이 어긋나지 않게.
 * 고도는 아래로 `sky3d.panoMinEl`(22°)까지만 — 새벽 그림의 해(6~8°)를 그대로
 * 쓰면 그림자가 화면 끝까지 늘어나고 그림자 상자 밖으로 샌다.
 *
 * 방위 규약: 이 판의 월드는 북 = +z · 동 = −x · 남 = −z · 서 = +x (옛 `lightingAt`
 * 이 "해는 동(−x)에서 떠" 한낮엔 −z 쪽에 있던 것과 같다). 그림은 u = 방위/360.
 *
 * **그림의 지평선을 고도 0 에 둔다.** 그림들은 내려다본 땅을 아래쪽에 그려 지평선이
 * 행 0.7 언저리다(`sky3d.panoHorizon` 0.68). 등장방형 그대로면 구름 띠가 땅 밑에
 * 숨는다 — 그 행 위를 0~90° 로 늘려 붙이고, 해 고도도 같은 식(`elOf`)으로 낸다.
 *
 * **안개가 그림의 지평선 색을 입는다.** 먼 땅이 안개로 녹아드는 색과 그 위
 * 하늘이 다르면 지평선에 금이 간다 — 지평선 행 바로 위 띠를 한 번 평균 내
 * `L.bg` 에 섞는다. 공의 아랫반은 그 지평선 행을 늘려 덮는다.
 *
 * 이 파일은 `L`(lightingAt 이 매 프레임 새로 만든 값)을 **고쳐서** 돌려줄 뿐이라
 * 물(`water3d`)·안개·해가 모두 같은 값을 따른다. `L.pano` 에 그림을 실어 주면
 * 물이 그 하늘을 비춘다. **판정에는 한 줄도 안 닿는다.** 손잡이 `sky3d.pano` 0
 * 이면 예전 단색 하늘이다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function ON() { return core.tuned('sky3d.pano', 1) ? true : false; }
  function MIN_EL() { return core.tuned('sky3d.panoMinEl', 22); }      // 해 고도 하한(도)
  function FOG_MIX() { return core.tuned('sky3d.panoFog', 0.85); }     // 안개가 그림 지평선 색을 얼마나 입나
  /** 그림 속 지평선 행(위에서 0~1). 그림들은 내려다본 땅을 아래 30% 쯤에 그려 둬 지평선이 0.5 가 아니라 0.7 언저리다 —
   *  등장방형 그대로(0.5)면 구름 띠가 땅 밑으로 숨어 화면엔 짙은 파랑 한 줄만 남는다(촬영으로 확인). 이 행을 고도 0 에 맞춘다 */
  function HORIZON() { return core.tuned('sky3d.panoHorizon', 0.68); }
  function DIST() { return 160; }                                       // 해를 플레이어에게서 얼마나 떨어뜨려 두나(m)

  /* ══ 값 층 — three 없이도 돈다 ═══════════════════════════ */

  var PLAIN = { rain: 1, snow: 1, fog: 1 };
  var ERA = { past: 'past', myth: 'past', modern: 'present', future: 'future' };

  /** lightingAt 의 phase(·시각) → 그림의 때 */
  function slotOf(phase, hour) {
    if (phase === 'day') { return 'noon'; }
    if (phase === 'dawn') { return 'dawn'; }
    if (phase === 'dusk') { return 'sunset'; }      // 그림 이름은 sunset(K-0090)
    if (phase === 'twilight') { return hour < 12 ? 'dawn' : 'sunset'; }
    return 'night';
  }
  /** 땅의 era → 그림의 시대 */
  function eraOf(zoneEra) { return ERA[zoneEra] || 'present'; }
  /** 그림 이름(sky_markers 키) — 단색으로 둘 천후면 null */
  function keyOf(o) {
    o = o || {};
    if (PLAIN[o.weather]) { return null; }
    return slotOf(o.phase, o.hour) + '_' + eraOf(o.era);
  }
  /** 그림 행 v(위에서 0~1) → 고도(도). 지평선 행 h 가 0°, 맨 위가 90° — 해 자리(sun_uv)도 이 식으로 고도를 낸다 */
  function elOf(v, h) { return Math.max(-90, Math.min(90, 90 * (1 - v / h))); }
  /** 방위·고도(도) → 월드 단위 벡터. 고도는 minEl 아래로 안 내린다 */
  function dirOf(az, el, minEl) {
    var a = az * Math.PI / 180, e = Math.max(el, minEl || 0) * Math.PI / 180;
    return { x: -Math.sin(a) * Math.cos(e), y: Math.sin(e), z: Math.cos(a) * Math.cos(e) };
  }

  /* ══ 그림 층 — three 가 있을 때만 산다 ═════════════════════ */

  var T = null, dome = null, markers = null, markAsk = false;
  var tex = {};              // key → { t: Texture, horizon: hex|null }
  var cur = null, eraMemo = null, eraAt = 0;
  var why = '-';

  function root() { var A = global.DG.assets3d; return A && A.root ? A.root() : null; }

  function wantMarkers() {
    if (markAsk || !global.fetch) { return; }
    var r = root(); if (!r) { return; }
    markAsk = true;
    global.fetch(r + 'sky/sky_markers.json').then(function (res) { return res.ok ? res.json() : null; })
      .then(function (j) { markers = j && j.skies ? j.skies : null; }, function () { markers = null; });
  }

  /** 그림 지평선 바로 위 띠의 평균색 — 안개가 입을 색 */
  function horizonOf(img) {
    try {
      var cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
      var g = cv.getContext('2d'); g.drawImage(img, 0, 0, 64, 32);
      var d = g.getImageData(0, Math.max(0, Math.floor((HORIZON() - 0.06) * 32)), 64, 2).data, r = 0, gg = 0, b = 0, n = d.length / 4;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      return (Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(b / n);
    } catch (e) { return null; }
  }

  function texOf(key) {
    if (tex[key]) { return tex[key]; }
    var r = root(), e = tex[key] = { t: null, horizon: null };
    if (!r || !T.TextureLoader) { why = '그림 경로 없음'; return e; }
    new T.TextureLoader().load(r + 'sky/sky_' + key + '_1k.webp', function (t) {
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = T.RepeatWrapping;
      /* 공의 UV 를 그림 규약으로 — u' = 0.25 − u (구 UV 는 −x 에서 시작해 반시계로 돈다, 머리말 방위 규약).
         밉맵은 끈다 — 물이 반사 방향에서 바로 u 를 셀 때 이음매(u 0↔1)에서 밉 단계가 튀어 줄이 선다 */
      t.repeat.set(-1, 1); t.offset.set(0.25, 0);
      t.generateMipmaps = false; t.minFilter = T.LinearFilter;
      t.needsUpdate = true;
      e.t = t; e.horizon = horizonOf(t.image);
    }, undefined, function () { why = '그림 못 받음 ' + key; });
    return e;
  }

  function ensureDome() {
    if (dome) { return dome; }
    var g = new T.SphereGeometry(900, 32, 16), uv = g.getAttribute('uv'), pos = g.getAttribute('position');
    /* 윗반은 고도 → 그림 행(elOf 의 거꾸로), 아랫반은 지평선 행을 늘려 덮는다 — 그림의 땅이 먼 땅 너머로 비치면 땅이 두 겹이 된다.
       UV 의 v 는 아래에서 위(flipY)라 1 − 행 */
    var h = HORIZON();
    for (var i = 0; i < pos.count; i++) {
      var el = Math.asin(Math.max(-1, Math.min(1, pos.getY(i) / 900))) * 180 / Math.PI;
      uv.setY(i, 1 - (el > 0 ? h * (1 - el / 90) : h));
    }
    uv.needsUpdate = true;
    var m = new T.MeshBasicMaterial({ side: T.BackSide, fog: false, depthWrite: false, depthTest: false });
    dome = new T.Mesh(g, m);
    dome.name = 'skypano'; dome.renderOrder = -1000; dome.frustumCulled = false;
    dome.castShadow = false; dome.receiveShadow = false;
    return dome;
  }

  function eraHere(pos) {
    var now = Date.now();
    if (now - eraAt < 1000 && eraAt) { return eraMemo; }
    eraAt = now;
    var BM = global.DG.biome, z = BM && BM.on && BM.on() && pos ? BM.zoneAt(pos.x, pos.y) : null;
    eraMemo = z ? z.era : null;
    return eraMemo;
  }

  function mixHex(a, b, k) { return global.DG.w3light.mixHex(a, b, k); }

  /**
   * 한 프레임 — `world3d.syncLight` 가 해·안개를 놓기 **전에** 부른다. `L` 을 고친다.
   * @param o { three, scene, camera, pos, dark }
   */
  function apply(L, o) {
    o = o || {};
    T = o.three || T;
    var key = (ON() && T && o.scene) ? keyOf({ phase: L.phase, hour: L.hour, weather: L.weather, era: eraHere(o.pos) }) : null;
    var e = key ? texOf(key) : null;
    if (key) { wantMarkers(); }
    if (!e || !e.t) {
      if (dome) { dome.visible = false; }
      cur = null; L.pano = null;
      return L;
    }
    var d = ensureDome();
    if (d.parent !== o.scene) { o.scene.add(d); }
    if (d.material.map !== e.t) { d.material.map = e.t; d.material.needsUpdate = true; }
    d.visible = true;
    if (o.camera) { d.position.copy(o.camera.position); }
    d.material.color.setScalar(1 - (o.dark || 0) * 0.5);
    cur = key;
    L.pano = e.t; L.panoKey = key; L.panoH = HORIZON();
    var mk = markers && markers[key];
    if (mk && typeof mk.sun_az === 'number') {
      var v = dirOf(mk.sun_az, mk.sun_uv ? elOf(mk.sun_uv[1], HORIZON()) : mk.sun_el, MIN_EL());
      L.sun.x = v.x * DIST(); L.sun.y = v.y * DIST(); L.sun.z = v.z * DIST();
    }
    if (e.horizon !== null) { L.bg = mixHex(L.bg, e.horizon, FOG_MIX()); }
    return L;
  }

  function stats() {
    return { on: ON(), cur: cur || '-', loaded: Object.keys(tex).filter(function (k) { return tex[k].t; }).length,
      markers: !!markers, dome: !!(dome && dome.visible), why: why };
  }

  global.DG = global.DG || {};
  global.DG.skypano3d = {
    /* 값 층 — 자가진단이 이것만 본다 */
    slotOf: slotOf, eraOf: eraOf, keyOf: keyOf, dirOf: dirOf, elOf: elOf, on: ON, horizon: HORIZON,
    /* 그림 층 */
    apply: apply, stats: stats
  };
})(window);
