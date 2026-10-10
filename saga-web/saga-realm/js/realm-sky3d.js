/**
 * 5천하 3D 지도 — 하늘 파노라마·햇빛·재질 (W-0141)
 * ---------------------------------------------------------------
 * 지도 3D(`realm3d.js`)의 하늘은 단색(그라디언트) 배경 + 고정 안개색이었다.
 * 여기서 자체 하늘 그림(`shared/assets/sky/sky_<시각>_<시대>_1k.webp`, 등장방형
 * 2:1, K-0067)을 배경으로 깔고, 빛을 그 그림에 맞춘다.
 *
 *   시대  이야기 막 1~3 = past · 4~6 = present · 7~9 = future (균열·혼돈 시나리오는 future)
 *   시각  달(턴 시계) — 봄·여름 noon · 가을(9~11월) sunset · 겨울(12~2월) dawn.
 *         밤(night)은 손잡이 `realm3d.skyTime`(auto|dawn|noon|sunset|night)로만 — 지도가 어두우면 판을 못 읽는다
 *   해    그림에 그려 넣은 해·달 자리(`sky_markers.json` 의 sun_uv)를 three 의 등장방형 규약으로 풀어
 *         DirectionalLight 방향으로 — 다만 지도 판독을 위해 고도는 25° 밑으로 안 내린다
 *   안개  파노라마 지평선 바로 위 띠의 평균색 — 먼 땅이 하늘 그림 속으로 녹는다
 *   재질  지도에 세우는 성·소품(GLB)만 툰 → 표준(PBR) 재질(색·무늬는 그대로, 거칠기 0.8·금속 0)
 *
 * **판정에는 한 줄도 안 닿는다.** 손잡이 `realm3d.real` 0 이면 예전 화면(단색 하늘·툰)이다.
 * 값을 내는 함수(eraOf·todOf·skyKey·skyFile·sunDir·light)는 three 없이 돈다 — 자가진단이 그것만 본다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  function ON() { return core.tuned('realm3d.real', 1) ? true : false; }

  /* sky_markers.json 의 sun_uv(밤은 달) — 그림을 다시 그리면 같이 고친다(K-0067) */
  var SUN_UV = {
    dawn_past: [0.2639, 0.4556], dawn_present: [0.2972, 0.4667], dawn_future: [0.2639, 0.4556],
    noon_past: [0.5111, 0.1111], noon_present: [0.5, 0.1556], noon_future: [0.4361, 0.1333],
    sunset_past: [0.7361, 0.4722], sunset_present: [0.7194, 0.4778], sunset_future: [0.7361, 0.4778],
    night_past: [0.5889, 0.1889], night_present: [0.5694, 0.2667], night_future: [0.5694, 0.2667]
  };
  var TODS = ['dawn', 'noon', 'sunset', 'night'];

  /* 시각마다 빛 — noon 이 realm3d 의 옛 값(해 0xfff4e0 ×1.0, 반구 ×0.95)이다 */
  var LIGHT = {
    dawn:   { sun: 0xffd9bc, sunK: 0.85, hemi: 0xfff0e6, ground: 0x4a5040, hemiK: 0.85 },
    noon:   { sun: 0xfff4e0, sunK: 1.0,  hemi: 0xffffff, ground: 0x4a5a3a, hemiK: 0.95 },
    sunset: { sun: 0xffbf86, sunK: 0.9,  hemi: 0xffe4cc, ground: 0x4a4436, hemiK: 0.8 },
    night:  { sun: 0xa9bcff, sunK: 0.45, hemi: 0x8fa0d0, ground: 0x283040, hemiK: 0.55 }
  };

  /* ══ 값 층 — three 없이도 돈다 ═══════════════════════════ */

  function eraOf(act, scen) {
    if (scen === 'rift' || scen === 'chaos') { return 'future'; }
    var a = act || 1;
    return a <= 3 ? 'past' : (a <= 6 ? 'present' : 'future');
  }
  function todOf(month, force) {
    var f = force || core.tuned('realm3d.skyTime', 'auto');
    if (TODS.indexOf(f) >= 0) { return f; }
    var m = ((((month || 1) - 1) % 12) + 12) % 12 + 1;
    if (m === 12 || m <= 2) { return 'dawn'; }
    return m >= 9 ? 'sunset' : 'noon';
  }
  /** @param o { act, scen, month, time } → 'noon_past' 식 */
  function skyKey(o) { o = o || {}; return todOf(o.month, o.time) + '_' + eraOf(o.act, o.scen); }
  /** 에셋 뿌리(`assets3d.root()`) 아래 상대 주소 */
  function skyFile(o) { return 'sky/sky_' + skyKey(o) + '_1k.webp'; }
  /** 그림 속 해 자리 → 해가 있는 쪽 단위 벡터(three 등장방형: u = atan(z,x)/2π + 0.5, 그림 위가 v 0).
   *  minEl(도) 아래로는 안 내린다 — 방위만 그림을 따른다 */
  function sunDir(key, minEl) {
    var uv = SUN_UV[key] || SUN_UV.noon_present;
    var phi = (uv[0] - 0.5) * Math.PI * 2, el = (0.5 - uv[1]) * Math.PI;
    el = Math.max(el, (minEl === undefined ? 25 : minEl) * Math.PI / 180);
    return { x: Math.cos(phi) * Math.cos(el), y: Math.sin(el), z: Math.sin(phi) * Math.cos(el) };
  }
  function light(key) { return LIGHT[String(key).split('_')[0]] || LIGHT.noon; }

  /** 지금 판 — 이야기 다음 카드의 막·시나리오·달 */
  function current() {
    var R = global.DG.rtk, S = global.DG.scenario, st = R && R.state ? R.state() : {}, act = 1, i;
    var ls = S && S.lines ? S.lines() : [];
    for (i = 0; i < ls.length; i++) { act = ls[i].act || act; if (ls[i].state === 'next') { break; } }
    return { act: act, scen: st.scen, month: st.month };
  }

  /* ══ 그림 층 — three 가 있을 때만 산다 ═════════════════════ */

  var T = null, scene = null, sun = null, hemi = null, oldFog = null;
  var texCache = {}, fogCache = {}, shown = null, why = '-', LG = 1;

  function root() {
    var A = global.DG.assets3d;
    if (!A) { return null; }
    if (A.url) { A.url('world', '_'); }      // 처음이면 뿌리를 정한다(동기 한 번)
    return A.root ? A.root() : null;
  }

  /** 지평선 바로 위 띠(v 0.40~0.49)의 평균색 */
  function horizonColor(img) {
    try {
      var cv = global.document.createElement('canvas'); cv.width = 64; cv.height = 32;
      var g = cv.getContext('2d'); g.drawImage(img, 0, 0, 64, 32);
      var d = g.getImageData(0, 13, 64, 3).data, r = 0, gg = 0, b = 0, n = d.length / 4, i;
      for (i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      return ((Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(b / n)) >>> 0;
    } catch (e) { return null; }
  }

  function applyLight(key) {
    var L = light(key), d = sunDir(key);
    if (sun) { sun.color.setHex(L.sun); sun.intensity = L.sunK * LG; sun.position.set(d.x * 300, d.y * 300, d.z * 300); }
    if (hemi) { hemi.color.setHex(L.hemi); hemi.groundColor.setHex(L.ground); hemi.intensity = L.hemiK * LG; }
  }

  /* 하늘 공 — scene.background 에 등장방형 그림을 걸면 three 가 큐브맵으로 바꾸는데, 헤드리스(swiftshader)에서
     카메라를 끄는 동안 탭이 통째로 죽었다(W-0141 촬영). 카메라를 따라다니는 안쪽 면 공 한 개로 그린다 — 안개·깊이 안 받음.
     공의 무늬 u 는 three 등장방형 규약(sunDir)과 좌우가 반대라 repeat.x = -1 로 맞춘다 */
  var dome = null;
  function domeOf() {
    if (dome) { return dome; }
    dome = new T.Mesh(new T.SphereGeometry(2000, 48, 24), new T.MeshBasicMaterial({ side: T.BackSide, fog: false, depthWrite: false, depthTest: false, toneMapped: false }));
    dome.frustumCulled = false; dome.renderOrder = -1000; dome.visible = false;
    dome.onBeforeRender = function (r, sc, cam) { dome.position.copy(cam.position); dome.updateMatrixWorld(true); };
    scene.add(dome);
    return dome;
  }
  function showSky(tx) {
    var d = domeOf();
    d.material.map = tx; d.material.needsUpdate = true; d.visible = true;
  }

  function restore() {
    if (!scene || shown === null) { return; }
    if (dome) { dome.visible = false; }
    if (scene.fog && oldFog !== null) { scene.fog.color.setHex(oldFog); }
    applyLight('noon_present');
    shown = null;
  }

  /** 지금 판에 맞는 하늘을 건다(바뀐 게 없으면 아무것도 안 한다) */
  function refresh() {
    if (!T || !scene) { return null; }
    if (!ON()) { restore(); why = '손잡이 0'; return null; }
    var key = skyKey(current());
    if (key === shown) { return key; }
    var base = root();
    if (!base) { why = '에셋 뿌리 없음'; return null; }
    shown = key;
    applyLight(key);
    var tex = texCache[key];
    if (tex) { showSky(tex); if (fogCache[key] !== undefined && scene.fog) { scene.fog.color.setHex(fogCache[key]); } return key; }
    new T.TextureLoader().load(base + 'sky/sky_' + key + '_1k.webp', function (tx) {
      tx.wrapS = T.RepeatWrapping; tx.repeat.x = -1;
      if (T.SRGBColorSpace) { tx.colorSpace = T.SRGBColorSpace; }
      texCache[key] = tx;
      var hc = tx.image ? horizonColor(tx.image) : null;
      if (hc !== null) { fogCache[key] = hc; }
      if (shown !== key || !scene) { return; }
      showSky(tx);
      if (hc !== null && scene.fog) { scene.fog.color.setHex(hc); }
      why = 'ok';
    }, undefined, function () { why = '그림 못 받음 ' + key; if (shown === key) { restore(); } });
    return key;
  }

  /** realm3d.init 이 씬·빛을 만든 직후 한 번 */
  function attach(three, sc, sunLight, hemiLight) {
    T = three; scene = sc; sun = sunLight; hemi = hemiLight;
    var TN = global.DG.toon3d; LG = TN && TN.lightGain ? TN.lightGain() : 1;
    oldFog = sc.fog ? sc.fog.color.getHex() : null;
    refresh();
  }

  /* ── 재질 — 지도에 세우는 GLB 만(전투·도시 화면의 같은 GLB 는 원본 재질을 같이 쓰므로 사본 쪽 재질만 갈아 낀다) ── */
  /* 값 지문으로 모은다 — 성은 달마다 다시 지어지며(rebuild) 세력 색 사본을 새로 받으므로 uuid 로 모으면 끝없이 쌓인다 */
  var realMats = {};
  function sigOf(m) {
    return [m.color ? m.color.getHex() : -1, m.map ? m.map.uuid : '-', m.vertexColors ? 1 : 0, m.transparent ? 1 : 0, m.opacity, m.alphaTest || 0, m.side].join(',');
  }
  function realMat(m) {
    if (!m || m.isMeshStandardMaterial || (!m.isMeshToonMaterial && !m.isMeshLambertMaterial)) { return m; }
    var sg = sigOf(m), r = realMats[sg];
    if (!r) {
      r = realMats[sg] = new T.MeshStandardMaterial({
        color: m.color ? m.color.clone() : new T.Color(0xffffff), map: m.map || null, vertexColors: !!m.vertexColors,
        transparent: !!m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, side: m.side,
        roughness: core.tuned('realm3d.roughness', 0.8), metalness: 0
      });
      r.userData.srcName = (m.userData && m.userData.srcName) || m.name || '';
    }
    return r;
  }
  /** GLB 사본 하나 — 스킨(사람·짐승)은 툰 그대로, 나머지 부품만 표준 재질로. 그대로 돌려준다 */
  function realify(g) {
    if (!g || !T || !ON() || !T.MeshStandardMaterial) { return g; }
    g.traverse(function (o) {
      if (!o.isMesh || o.isSkinnedMesh || !o.material || (o.userData && o.userData._toonOutline)) { return; }
      o.material = Array.isArray(o.material) ? o.material.map(realMat) : realMat(o.material);
    });
    return g;
  }

  core.on('rtk:month', function () { refresh(); });
  core.on('changed', function () { refresh(); });

  global.DG = global.DG || {};
  global.DG.realmSky3d = {
    /* 값 층 — 자가진단이 본다 */
    eraOf: eraOf, todOf: todOf, skyKey: skyKey, skyFile: skyFile, sunDir: sunDir, light: light, current: current, SUN_UV: SUN_UV,
    /* 그림 층 */
    attach: attach, refresh: refresh, realify: realify, lights: function () { return { sun: sun, hemi: hemi }; },
    stats: function () { var n = 0, k; for (k in realMats) { if (Object.prototype.hasOwnProperty.call(realMats, k)) { n++; } } return { on: ON(), shown: shown, why: why, realMats: n }; }
  };
})(window);
