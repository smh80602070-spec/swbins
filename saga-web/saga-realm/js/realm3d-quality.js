/**
 * 5천하 3D 그래픽 품질 3단 — 순수 함수(R-4 통합: realm3d.js 1500줄 상한 → 떼어 냄, DG.realm3dQuality)
 * ---------------------------------------------------------------
 * 그래픽 품질 3단(SAGA-DESIGN §8 성능 상한, PLAN §7-2 "성능 상한") — 이 판은
 * 걷는 인물이 없어 saga-forest `village-view3d.js` 처럼 "인물 주변 렌더
 * 반경"을 좁힐 대상이 없다. 대신 값이 큰 두 축만 등급표로 묶는다 —
 * 픽셀 비율(dpr, 폰 GPU 부담의 대부분)과 `scatterField()` 빈 들 소품 밀도
 * (전체 1070개 선 중 가장 큰 덩이). 성 둘레(`scatterAround`/`scatterSmall`,
 * 카메라가 늘 머무는 자리)는 등급과 무관하게 항상 다 세운다 — 그림 손실
 * 체감이 크고 수도 field 쪽보다 훨씬 적어서다. `deviceScore`/`probeDevice`는
 * saga-forest 것과 같은 요령(순수 함수 — three 없이도 헤드리스로 진단된다).
 * 등급을 고르고 손잡이를 읽는 쪽(tier·DPR·setQuality)은 realm3d.js 에 그대로.
 */
(function (global) {
  'use strict';
  var PRESET = {
    low:    { dpr: 1,   fieldDensity: 16 },
    medium: { dpr: 1.5, fieldDensity: 24 },
    high:   { dpr: 2,   fieldDensity: 32 }
  };
  function deviceScore(o) {
    var s = 0;
    var cores = o.cores || 0, mem = o.mem || 0;
    var px = (o.w || 0) * (o.h || 0) * (o.dpr || 1) * (o.dpr || 1);
    s += cores >= 8 ? 2 : (cores >= 4 ? 1 : (cores > 0 ? 0 : 1));
    s += mem >= 8 ? 2 : (mem >= 4 ? 1 : (mem > 0 ? 0 : (o.ios ? -1 : 1)));   // W-0333 iOS 는 deviceMemory 가 없다 — 모름을 "넉넉"이 아니라 "빠듯"으로
    s += px > 4000000 ? -1 : (px > 1600000 ? 0 : 1);
    if (o.touch) { s -= 1; }
    return s;
  }
  function tierFor(score) { return score >= 3 ? 'high' : (score >= 1 ? 'medium' : 'low'); }
  function probeDevice() {
    var n = global.navigator || {}, sc = global.screen || {};
    return {
      cores: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0,
      w: sc.width || 0, h: sc.height || 0, dpr: global.devicePixelRatio || 1,
      touch: !!(('ontouchstart' in global) || (n.maxTouchPoints > 0)), ios: /iPhone|iPad|iPod/.test(n.userAgent || '') || (/Macintosh/.test(n.userAgent || '') && n.maxTouchPoints > 1)
    };
  }
  global.DG = global.DG || {};
  global.DG.realm3dQuality = { PRESET: PRESET, deviceScore: deviceScore, tierFor: tierFor, probeDevice: probeDevice };
})(typeof window !== 'undefined' ? window : this);
