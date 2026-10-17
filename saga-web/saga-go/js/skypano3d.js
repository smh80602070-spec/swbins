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
  function FOG_MIX() { return core.tuned('sky3d.panoFog', 0.85); }     // 안개가 그림 지평선 색을 얼마나 입나
  /** 그림 속 지평선 행(위에서 0~1). 그림들은 내려다본 땅을 아래 30% 쯤에 그려 둬 지평선이 0.5 가 아니라 0.7 언저리다 —
   *  등장방형 그대로(0.5)면 구름 띠가 땅 밑으로 숨어 화면엔 짙은 파랑 한 줄만 남는다(촬영으로 확인). 이 행을 고도 0 에 맞춘다 */
  function HORIZON() { return core.tuned('sky3d.panoHorizon', 0.68); }
  function DIST() { return 160; }                                       // 해를 플레이어에게서 얼마나 떨어뜨려 두나(m)

  /* ══ 값 층·그림 층은 공용 shared/js/skydome3d.js(W-0294) — 이 파일은 1만리 lightingAt 의 L 을 고치는 자리만 ══ */

  var SD = global.DG.skydome3d;
  var sky = SD.make({ tune: 'sky3d', radius: 900, minEl: 22, name: 'skypano' });
  var eraMemo = null, eraAt = 0;

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
    var r = (ON() && o.scene) ? sky.frame({ three: o.three, scene: o.scene, camera: o.camera, phase: L.phase, hour: L.hour, weather: L.weather, era: eraHere(o.pos), dark: o.dark }) : (sky.hide(), null);
    if (!r) { L.pano = null; return L; }
    L.pano = r.tex; L.panoKey = r.key; L.panoH = r.H;
    if (r.sun) { L.sun.x = r.sun.x * DIST(); L.sun.y = r.sun.y * DIST(); L.sun.z = r.sun.z * DIST(); }
    if (r.horizon !== null && r.horizon !== undefined) { L.bg = mixHex(L.bg, r.horizon, FOG_MIX()); }
    return L;
  }

  function stats() { return sky.stats(); }

  global.DG = global.DG || {};
  global.DG.skypano3d = {
    /* 값 층 — 자가진단이 이것만 본다(공용과 같은 함수) */
    slotOf: SD.slotOf, eraOf: SD.eraOf, keyOf: SD.keyOf, dirOf: SD.dirOf, elOf: SD.elOf, on: ON, horizon: HORIZON,
    /* 그림 층 */
    apply: apply, stats: stats
  };
})(window);
