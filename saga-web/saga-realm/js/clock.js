/**
 * clock.js — 진단·촬영용 가짜 시계(W-0316). 게임 중엔 아무것도 안 바꾼다(앞당김 0).
 *
 * 시간이 걸리는 상태(가만히 8초 → 앉기 `pose3d.life` 따위)를 진단이 실제 흐름으로 재려면 몇 초를 기다려야 했다 →
 * 판마다 시간 원천이 다르므로(1만리 렌더 시각 · 3마을 Date.now · 5천하 자체 시각) 그 값을 갈아 끼우지 않고, **받은 초에 앞당김을 더한다**.
 *   DG.clock.s(realS)  → realS + 앞당김(초)          pose3d.life·once 가 이것으로 시각을 읽는다
 *   DG.clock.advance(sec) · DG.clock.reset() · DG.clock.offset()
 * autoq 는 시각을 읽지 않고 프레임 간격(dt)을 받는다 — 진단은 그 간격을 흘려 넣는다(시계 불필요).
 */
(function (global) {
  'use strict';
  var off = 0;
  global.DG = global.DG || {};
  global.DG.clock = {
    s: function (realS) { return (+realS || 0) + off; },
    advance: function (sec) { off += +sec || 0; return off; },
    reset: function () { off = 0; return 0; },
    offset: function () { return off; }
  };
})(typeof window !== 'undefined' ? window : this);
