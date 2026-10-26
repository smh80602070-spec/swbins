/**
 * 2나락 3D 시작 등급 — 기기 점수 순수 함수(R-4 통합: dungeon3d.js 줄 상한 → 떼어 냄, DG.dungeon3dQuality)
 * ---------------------------------------------------------------
 * 코어 수·메모리·화면 픽셀·터치 여부로 점수를 매겨 **시작 등급만** 고른다(그 뒤로는 dungeon3d.js 의 실측이 올리고 내린다).
 * saga-go `js/perf.js` 의 probe·score·start 와 같은 요령. three 없이 헤드리스로 진단된다.
 * (5천하 realm3d-quality.js 와 비슷하지만 iOS 메모리 처리가 없는 옛 판본 그대로 — 값이 바뀌면 시작 등급이 달라져 합치지 않음)
 */
(function (global) {
  'use strict';
  function deviceScore(o) {
    var s = 0;
    var cores = o.cores || 0, mem = o.mem || 0;
    var px = (o.w || 0) * (o.h || 0) * (o.dpr || 1) * (o.dpr || 1);
    s += cores >= 8 ? 2 : (cores >= 4 ? 1 : (cores > 0 ? 0 : 1));
    s += mem >= 8 ? 2 : (mem >= 4 ? 1 : (mem > 0 ? 0 : 1));
    s += px > 4000000 ? -1 : (px > 1600000 ? 0 : 1);
    if (o.touch) { s -= 1; }
    return s;
  }
  function startLevelFor(s) { return s >= 3 ? 'high' : (s >= 1 ? 'medium' : 'low'); }
  function probeDevice() {
    var n = global.navigator || {}, sc = global.screen || {};
    return {
      cores: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0,
      w: sc.width || 0, h: sc.height || 0, dpr: global.devicePixelRatio || 1,
      touch: !!(('ontouchstart' in global) || (n.maxTouchPoints > 0))
    };
  }
  global.DG = global.DG || {};
  global.DG.dungeon3dQuality = { deviceScore: deviceScore, startLevelFor: startLevelFor, probeDevice: probeDevice };
})(typeof window !== 'undefined' ? window : this);
