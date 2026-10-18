/**
 * renderer3d — 렌더러 고르기(W-0310 ⑤ WebGPU 길, 축소판 — 사용자 10-18 결정): 손잡이 `go3d.webgpu`(0) 가 1 이면 WebGPU 를 시도하고,
 *   못 켜면 **WebGL 로 자동 되돌리고 콘솔 한 줄**만 남긴다. 판 코드는 `DG.renderer3d.make(THREE, opts)` 한 줄로 받는다(없으면 옛 WebGLRenderer 그대로).
 *   WebGPU 가 켜지는 조건 셋: 손잡이 1 · 브라우저 `navigator.gpu` 있음 · three 빌드에 `WebGPURenderer` 있음(지금 vendor/three.iife.js 는 WebGL 빌드라 없다 —
 *   진짜 WebGPU 렌더는 three/webgpu ESM 빌드 + TSL 셰이더 재작성이 필요해 별도 창). 순수 `decide(knob, hasGpu, hasClass)` 는 three 없이 돈다 — 자가진단이 본다.
 *   `kind()`·`why()` 로 지금 렌더러 종류와 이유를 묻는다(시연 stats·측정 표에 찍는다).
 */
(function (global) {
  'use strict';
  function tn(k, d) { var c = global.DG && global.DG.core; return c && c.tuned ? c.tuned(k, d) : d; }
  function KNOB() { return (tn('go3d.webgpu', 0) || global.DG_WEBGPU) ? true : false; }   // 손잡이 또는 페이지 플래그(_demo.html#…,webgpu=1 — 3D 가 서기 전에 읽힌다)
  var state = { kind: 'none', why: '' };

  /** 순수 — 어느 렌더러로 가나. 돌아오는 값 { kind: 'webgpu'|'webgl', why } */
  function decide(knob, hasGpu, hasClass) {
    if (!knob) { return { kind: 'webgl', why: '손잡이 go3d.webgpu=0' }; }
    if (!hasGpu) { return { kind: 'webgl', why: 'navigator.gpu 없음(브라우저가 WebGPU 를 안 줌) → WebGL 로' }; }
    if (!hasClass) { return { kind: 'webgl', why: 'navigator.gpu 있음 · three 빌드에 WebGPURenderer 없음(WebGL 빌드) → WebGL 로' }; }
    return { kind: 'webgpu', why: '손잡이 1 · navigator.gpu · WebGPURenderer 셋 다 있음' };
  }

  /** 렌더러 하나 — WebGPU 가 되면 그것, 아니면 WebGLRenderer(opts 그대로). 콘솔 한 줄은 손잡이가 켜졌을 때만 */
  function make(t, opts) {
    var d = decide(KNOB(), !!(global.navigator && global.navigator.gpu), !!(t && t.WebGPURenderer));
    state.kind = d.kind; state.why = d.why;
    if (d.kind === 'webgpu') {
      try {
        var r = new t.WebGPURenderer(opts); if (r.init) { r.init(); }
        if (global.console) { console.info('[renderer3d] WebGPU 켬 — ' + d.why); }
        return r;
      } catch (e) { state.kind = 'webgl'; state.why = 'WebGPURenderer 생성 실패(' + (e && e.message) + ') → WebGL 로'; }
    }
    if (KNOB() && global.console) { console.info('[renderer3d] ' + state.why); }
    return new t.WebGLRenderer(opts);
  }

  global.DG = global.DG || {};
  global.DG.renderer3d = { make: make, decide: decide, kind: function () { return state.kind; }, why: function () { return state.why; }, KNOB: KNOB, gpuAvailable: function () { return !!(global.navigator && global.navigator.gpu); } };
})(window);
