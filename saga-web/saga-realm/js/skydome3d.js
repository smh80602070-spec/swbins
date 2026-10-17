/**
 * 하늘 공 — 그린 하늘 한 장(등장방형)이 카메라를 둘러싼다 · 다섯 판 공용 (W-0294 그래픽 기준선)
 * ---------------------------------------------------------------
 * 1만리 `skypano3d.js`(W-0140 ①)에서 판 독립 부분만 떼어 올렸다. 자체툴이 시각 넷 × 시대 셋으로
 * 그린 하늘(`shared/assets/sky/sky_<때>_<시대>_1k.webp`, K-0090)을 카메라를 감싸는 공 안쪽에 붙이고,
 * 그림 속 해 자리(`sky_markers.json` 방위·고도)를 단위 벡터로, 그림 지평선 바로 위 띠의 평균색을
 * 안개·배경색 후보로 돌려준다. **해·안개를 실제로 바꾸는 건 부르는 판이다** — 판마다 해가 따라가는
 * 자리(플레이어·원점·초점)와 거리, 그림자 상자 크기가 달라서다.
 *
 *   때     dawn·noon·sunset·night — slotOf(phase, hour)(1만리 lightingAt 의 phase) 또는 slotOfHour(시각)
 *   시대   past·present·future — eraOf(땅 era: myth→past, modern→present)
 *   천후   비·눈·안개는 그린 맑은 하늘이 어울리지 않아 keyOf 가 null(공을 숨긴다 — 판의 옛 하늘)
 *
 * 공의 UV: 그림의 지평선 행(손잡이 `<tune>.panoHorizon`, 0.68)을 고도 0 에, 윗반은 고도 → 행으로 늘리고
 * 아랫반은 지평선 행을 늘려 덮는다(그림 속 땅이 먼 땅 너머로 비치면 땅이 두 겹이 된다).
 * 방위 규약: 북 = +z · 동 = −x(1만리). 그림은 u = 방위/360.
 *
 *   var sky = DG.skydome3d.make({ tune: 'village3d', radius: 360, minEl: 35, dim: 1 });
 *   var r = sky.frame({ three: T, scene: scene, camera: camera, key: 'noon_past', dark: 0 });
 *   // r = null(안 그림) | { key, tex, horizon: hex|null, sun: {x,y,z}|null, H }
 *
 * **판정에는 한 줄도 안 닿는다.** 값 층(slotOf·slotOfHour·eraOf·keyOf·elOf·dirOf)은 three 없이 돈다.
 */
(function (global) {
  'use strict';

  function core() { return global.DG && global.DG.core; }
  function tuned(k, d) { var C = core(); return C && C.tuned ? C.tuned(k, d) : d; }

  /* ══ 값 층 — three 없이도 돈다 ═══════════════════════════ */

  var PLAIN = { rain: 1, snow: 1, fog: 1, storm: 1, blizzard: 1, sandstorm: 1 };
  var ERA = { past: 'past', myth: 'past', present: 'present', modern: 'present', future: 'future' };
  var SLOTS = { dawn: 1, noon: 1, sunset: 1, night: 1 };

  /** phase(day·dawn·dusk·twilight·night …)·시각 → 그림의 때 */
  function slotOf(phase, hour) {
    if (SLOTS[phase]) { return phase; }
    if (phase === 'day' || phase === 'morning' || phase === 'afternoon') { return 'noon'; }
    if (phase === 'dusk' || phase === 'evening' || phase === 'even') { return 'sunset'; }      // 그림 이름은 sunset(K-0090)
    if (phase === 'twilight') { return hour < 12 ? 'dawn' : 'sunset'; }
    return 'night';
  }
  /** 시각(0~24) → 그림의 때 — 5~8 dawn · 8~17 noon · 17~20 sunset · 그 밖 night */
  function slotOfHour(h) {
    h = ((Number(h) || 0) % 24 + 24) % 24;
    if (h >= 5 && h < 8) { return 'dawn'; }
    if (h >= 8 && h < 17) { return 'noon'; }
    if (h >= 17 && h < 20) { return 'sunset'; }
    return 'night';
  }
  /** 땅의 era → 그림의 시대 */
  function eraOf(zoneEra) { return ERA[zoneEra] || 'present'; }
  /** 그림 이름(sky_markers 키) — 단색으로 둘 천후면 null. o.slot 이 있으면 그것을, 없으면 phase·hour 로 */
  function keyOf(o) {
    o = o || {};
    if (PLAIN[o.weather]) { return null; }
    return (SLOTS[o.slot] ? o.slot : slotOf(o.phase, o.hour)) + '_' + eraOf(o.era);
  }
  /** 그림 행 v(위에서 0~1) → 고도(도). 지평선 행 h 가 0°, 맨 위가 90° */
  function elOf(v, h) { return Math.max(-90, Math.min(90, 90 * (1 - v / h))); }
  /** 방위·고도(도) → 월드 단위 벡터. 고도는 minEl 아래로 안 내린다 */
  function dirOf(az, el, minEl) {
    var a = az * Math.PI / 180, e = Math.max(el, minEl || 0) * Math.PI / 180;
    return { x: -Math.sin(a) * Math.cos(e), y: Math.sin(e), z: Math.cos(a) * Math.cos(e) };
  }

  /* ══ 그림 층 — 페이지에 하나(그림·표지는 판 안 인스턴스끼리 같이 쓴다) ══ */

  var markers = null, markAsk = false;
  var tex = {};              // key → { t: Texture, img }
  function root() { var A = global.DG && global.DG.assets3d; return A && A.root ? A.root() : null; }

  function wantMarkers() {
    if (markAsk || !global.fetch) { return; }
    var r = root(); if (!r) { return; }
    markAsk = true;
    global.fetch(r + 'sky/sky_markers.json').then(function (res) { return res.ok ? res.json() : null; })
      .then(function (j) { markers = j && j.skies ? j.skies : null; }, function () { markers = null; });
  }

  /** 그림 지평선 바로 위 띠의 평균색 */
  function horizonOf(img, H) {
    try {
      var cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
      var g = cv.getContext('2d'); g.drawImage(img, 0, 0, 64, 32);
      var d = g.getImageData(0, Math.max(0, Math.floor((H - 0.06) * 32)), 64, 2).data, r = 0, gg = 0, b = 0, n = d.length / 4;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      return (Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(b / n);
    } catch (e) { return null; }
  }

  function texOf(T, key, onErr) {
    if (tex[key]) { return tex[key]; }
    var r = root(), e = tex[key] = { t: null, img: null, hz: {} };
    if (!r || !T.TextureLoader) { onErr('그림 경로 없음'); return e; }
    new T.TextureLoader().load(r + 'sky/sky_' + key + '_1k.webp', function (t) {
      if (T.SRGBColorSpace) { t.colorSpace = T.SRGBColorSpace; }
      t.wrapS = T.RepeatWrapping;
      /* 공의 UV 를 그림 규약으로 — u' = 0.25 − u (구 UV 는 −x 에서 시작해 반시계로 돈다, 머리말 방위 규약).
         밉맵은 끈다 — 물이 반사 방향에서 바로 u 를 셀 때 이음매(u 0↔1)에서 밉 단계가 튀어 줄이 선다 */
      t.repeat.set(-1, 1); t.offset.set(0.25, 0);
      t.generateMipmaps = false; t.minFilter = T.LinearFilter;
      t.needsUpdate = true;
      e.t = t; e.img = t.image;
    }, undefined, function () { delete tex[key]; onErr('그림 못 받음 ' + key); });
    return e;
  }

  /**
   * 판 하나의 하늘 공.
   * @param opt { tune: 손잡이 앞말('sky3d' → sky3d.pano·sky3d.panoMinEl·sky3d.panoHorizon), radius: 공 반지름(카메라 far 안쪽),
   *              minEl: 해 고도 하한(도), dim: 그림 밝기 곱(블룸 문턱이 낮은 판), name: 공 이름 }
   */
  function make(opt) {
    opt = opt || {};
    var P = opt.tune || 'sky3d', RADIUS = opt.radius || 900, DIM = opt.dim === undefined ? 1 : opt.dim;
    var dome = null, domeH = null, cur = null, why = '-', T = null;
    function ON() { return tuned(P + '.pano', 1) ? true : false; }
    function H() { return tuned(P + '.panoHorizon', 0.68); }
    function MIN_EL() { return tuned(P + '.panoMinEl', opt.minEl === undefined ? 22 : opt.minEl); }

    function ensureDome() {
      var h = H();
      if (dome && domeH === h) { return dome; }
      var g = new T.SphereGeometry(RADIUS, 32, 16), uv = g.getAttribute('uv'), pos = g.getAttribute('position');
      for (var i = 0; i < pos.count; i++) {
        var el = Math.asin(Math.max(-1, Math.min(1, pos.getY(i) / RADIUS))) * 180 / Math.PI;
        uv.setY(i, 1 - (el > 0 ? h * (1 - el / 90) : h));      // UV v 는 아래에서 위(flipY)라 1 − 행
      }
      uv.needsUpdate = true;
      if (dome) { dome.geometry.dispose(); dome.geometry = g; domeH = h; return dome; }
      var m = new T.MeshBasicMaterial({ side: T.BackSide, fog: false, depthWrite: false, depthTest: false, toneMapped: opt.toneMapped !== false });
      dome = new T.Mesh(g, m);
      dome.name = opt.name || 'skypano'; dome.renderOrder = -1000; dome.frustumCulled = false;
      dome.castShadow = false; dome.receiveShadow = false;
      dome.userData.noShadow = 1;
      domeH = h;
      return dome;
    }

    function hide() { if (dome) { dome.visible = false; } cur = null; }

    /**
     * 한 프레임. o = { three, scene, camera, key | (slot|phase, hour, weather, era), dark(0~1) }.
     * 그릴 그림이 없거나(손잡이 0·천후·아직 못 받음) 하면 공을 숨기고 null.
     */
    function frame(o) {
      o = o || {};
      T = o.three || T;
      if (!T || !o.scene || !ON()) { hide(); if (!ON()) { why = '손잡이 0'; } return null; }
      var key = o.key !== undefined ? o.key : keyOf(o);
      if (!key) { hide(); why = '천후'; return null; }
      wantMarkers();
      var e = texOf(T, key, function (w) { why = w; });
      if (!e.t) { hide(); return null; }
      var d = ensureDome();
      if (d.parent !== o.scene) { o.scene.add(d); }
      if (d.material.map !== e.t) { d.material.map = e.t; d.material.needsUpdate = true; }
      d.visible = true;
      if (o.camera) { d.position.copy(o.camera.position); }
      d.material.color.setScalar(DIM * (1 - (o.dark || 0) * 0.5));
      cur = key; why = 'ok';
      var h = H();
      if (e.hz[h] === undefined) { e.hz[h] = e.img ? horizonOf(e.img, h) : null; }
      var mk = markers && markers[key], sun = null;
      if (mk && typeof mk.sun_az === 'number') { sun = dirOf(mk.sun_az, mk.sun_uv ? elOf(mk.sun_uv[1], h) : mk.sun_el, MIN_EL()); }
      return { key: key, tex: e.t, horizon: e.hz[h], sun: sun, H: h };
    }

    function stats() {
      return { on: ON(), cur: cur || '-', loaded: Object.keys(tex).filter(function (k) { return tex[k].t; }).length,
        markers: !!markers, dome: !!(dome && dome.visible), radius: RADIUS, why: why };
    }

    /**
     * frame + 해 자리 + 옛 하늘 숨기기 — 판에 줄을 못 늘릴 때 한 호출로 잇는다.
     * o 에 더해: sun(DirectionalLight) · sunAt({x,y,z}, 해가 비추는 자리 — 기본 원점) · sunDist(기본 100) ·
     *            alt(그림이 없을 때만 보일 옛 하늘 메시) · altOn(옛 하늘을 원래 켜 두나, 기본 true)
     * 그림이 안 걸리면 해를 처음 자리로 돌려놓는다.
     */
    var sunHome = null, sunMoved = false;
    function drive(o) {
      o = o || {};
      var r = frame(o), L = o.sun;
      if (o.alt) { o.alt.visible = !r && o.altOn !== false; }
      if (L && L.position) {
        if (!sunHome) { sunHome = L.position.clone ? L.position.clone() : { x: L.position.x, y: L.position.y, z: L.position.z }; }
        if (r && r.sun) {
          var a = o.sunAt || { x: 0, y: 0, z: 0 }, k = o.sunDist || 100;
          L.position.set(a.x + r.sun.x * k, a.y + r.sun.y * k, a.z + r.sun.z * k); sunMoved = true;
        } else if (sunMoved) { L.position.set(sunHome.x, sunHome.y, sunHome.z); sunMoved = false; }
      }
      return r;
    }

    return { frame: frame, drive: drive, hide: hide, stats: stats, on: ON, horizon: H, dome: function () { return dome; } };
  }

  /** 이름별 인스턴스 하나(판 코드가 변수 줄 없이 부를 수 있게) — 처음 부를 때의 opt 로 만든다 */
  var made = {};
  function get(name, opt) { return made[name] || (made[name] = make(opt)); }
  /** 이름별 상태(진단·촬영용) */
  function statsAll() { var o = {}, k; for (k in made) { if (Object.prototype.hasOwnProperty.call(made, k)) { o[k] = made[k].stats(); } } return o; }

  /** 두 색 섞기(0 = a, 1 = b) */
  function mixHex(a, b, k) {
    k = Math.max(0, Math.min(1, k));
    var r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
    var g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
    var bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
    return (r << 16) | (g << 8) | bl;
  }

  global.DG = global.DG || {};
  global.DG.skydome3d = {
    /* 값 층 — 자가진단이 이것만 본다 */
    slotOf: slotOf, slotOfHour: slotOfHour, eraOf: eraOf, keyOf: keyOf, elOf: elOf, dirOf: dirOf, mixHex: mixHex,
    /* 그림 층 */
    make: make, get: get, stats: statsAll,
    markers: function () { return markers; }
  };
})(window);
