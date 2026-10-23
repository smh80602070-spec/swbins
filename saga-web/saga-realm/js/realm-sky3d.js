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
 *   해    그림에 그려 넣은 해·달 자리(`sky_markers.json` 의 sun_uv)를 공용 하늘 공(shared skydome3d, W-0294) 규약으로 풀어
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
  function HORIZON() { return core.tuned('realm3d.panoHorizon', 0.68); }   // 그림 지평선 행 — 공용 하늘 공과 같은 값(W-0294)

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
    var uv = SUN_UV[key] || SUN_UV.noon_present, SD = global.DG.skydome3d;
    return SD.dirOf(uv[0] * 360, SD.elOf(uv[1], HORIZON()), minEl === undefined ? 25 : minEl);
  }
  function light(key) { return LIGHT[String(key).split('_')[0]] || LIGHT.noon; }

  /** 지금 판 — 이야기 다음 카드의 막·시나리오·달 */
  function current() {
    var R = global.DG.rtk, S = global.DG.scenario, st = R && R.state ? R.state() : {}, act = 1, i;
    var ls = S && S.lines ? S.lines() : [];
    for (i = 0; i < ls.length; i++) { act = ls[i].act || act; if (ls[i].state === 'next') { break; } }
    return { act: act, scen: st.scen, month: st.month };
  }

  /* ══ 그림 층 — 공·그림 받기·지평선 색은 공용 shared/js/skydome3d.js(W-0294) ═════ */

  var T = null, scene = null, sun = null, hemi = null, oldFog = null, camera = null;
  var shown = null, why = '-', LG = 1, fogHex = null;
  var sky = global.DG.skydome3d.make({ tune: 'realm3d', radius: 2000, minEl: 25, toneMapped: false, name: 'realmsky' });

  function applyLight(key) {
    var L = light(key), d = sunDir(key);
    if (sun) { sun.color.setHex(L.sun); sun.intensity = L.sunK * LG; sun.position.set(d.x * 300, d.y * 300, d.z * 300); }
    if (hemi) { hemi.color.setHex(L.hemi); hemi.groundColor.setHex(L.ground); hemi.intensity = L.hemiK * LG; }
  }

  function restore() {
    if (!scene || shown === null) { return; }
    sky.hide();
    if (scene.fog && oldFog !== null) { scene.fog.color.setHex(oldFog); }
    applyLight('noon_present');
    shown = null; fogHex = null;
  }

  /** 지금 판에 맞는 하늘을 고른다(바뀐 게 없으면 아무것도 안 한다) — 그림은 tick 이 받아 건다 */
  function refresh() {
    if (!T || !scene) { return null; }
    if (!ON()) { restore(); why = '손잡이 0'; return null; }
    var key = skyKey(current());
    if (key === shown) { return key; }
    shown = key; fogHex = null;
    applyLight(key);
    tick(camera);
    return key;
  }

  /** 매 틱(realm3d tick) — 공을 카메라에 붙이고, 그림이 들어오면 지평선 색을 안개에 */
  function tick(cam) {
    if (cam) { camera = cam; }
    if (!T || !scene || shown === null) { return; }
    var r = sky.frame({ three: T, scene: scene, camera: camera, key: shown });
    why = sky.stats().why;
    if (r && r.horizon !== null && r.horizon !== undefined && r.horizon !== fogHex && scene.fog) { fogHex = r.horizon; scene.fog.color.setHex(fogHex); }
  }

  /** realm3d.init 이 씬·빛을 만든 직후 한 번 */
  function attach(three, sc, sunLight, hemiLight) {
    T = three; scene = sc; sun = sunLight; hemi = hemiLight; shown = null;
    var A = global.DG.assets3d; if (A && A.url) { A.url('world', '_'); }      // 처음이면 에셋 뿌리를 정한다(동기 한 번) — 공용 공이 root() 를 읽는다
    var TN = global.DG.toon3d; LG = TN && TN.lightGain ? TN.lightGain() : 1;
    oldFog = sc.fog ? sc.fog.color.getHex() : null;
    refresh();
  }

  /* ── 재질 — 지도에 세우는 GLB 만(전투·도시 화면의 같은 GLB 는 원본 재질을 같이 쓰므로 사본 쪽 재질만 갈아 낀다) ── */
  /* 값 지문으로 모은다 — 성은 달마다 다시 지어지며(rebuild) 세력 색 사본을 새로 받으므로 uuid 로 모으면 끝없이 쌓인다 */
  var realMats = {};
  function sigOf(m) {
    return [m.color ? m.color.getHex() : -1, m.map ? m.map.uuid : '-', m.vertexColors ? 1 : 0, m.transparent ? 1 : 0, m.opacity, m.alphaTest || 0, m.side,
      glowName(m)].join(',');
  }
  /* W-0386 빛남 재질(glow_*)만 이름·emissive 를 옮긴다 — 버리면 화로 불꽃이 안 빛나고 nightglow3d 가 못 찾는다(나머지 재질은 그대로) */
  function glowName(m) { return m.emissive && m.name && m.name.indexOf('glow_') === 0 ? m.name : ''; }
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
      r.name = glowName(m);
      if (r.name) { r.emissive.copy(m.emissive); r.emissiveMap = m.emissiveMap || null; r.emissiveIntensity = m.emissiveIntensity; }
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
    attach: attach, refresh: refresh, tick: tick, realify: realify, _realMat: function (three, m) { var t0 = T; T = T || three; try { return realMat(m); } finally { T = t0; } },   // W-0386 진단 lights: function () { return { sun: sun, hemi: hemi }; },
    stats: function () { var n = 0, k; for (k in realMats) { if (Object.prototype.hasOwnProperty.call(realMats, k)) { n++; } } var ss = sky.stats(); return { on: ON(), shown: shown, why: why, dome: ss.dome, realMats: n }; }
  };
})(window);
