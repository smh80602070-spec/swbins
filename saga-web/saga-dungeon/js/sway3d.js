/**
 * 잎·풀 흔들림 — PLAN §6.1 항목 5가 남긴 나머지 절반("풀 바람 셰이더")
 * ---------------------------------------------------------------
 * 잡초 층(`field3d.js` clutterAt() 의 grass·flower·bush, `dungeon3d.js`의
 * `reed`)에 `onBeforeCompile`로 정점 셰이더 한 줄을 보탠다 — 사가만리
 * `world3d.js`의 `swayify()`와 같은 요령을 그대로 옮겼다(셰이더 문자열은
 * 한 글자도 안 바꿈). 조명·안개·톤매핑 조각은 손 안 대고 `#include
 * <begin_vertex>` **뒤**에서 자리만 민다.
 *
 * 이 판은 두 갈래 모두에 건다(사가만리엔 없던 사정, `PLAN.md` §6.4 참고):
 *   1. `dungeon3d.js`의 `mat(hex,'sway')` — GLB 가 아직 안 왔거나 못 받은
 *      자리에 서는 도형 fallback(그룹·잎포기 상자). 이 판의 `box()`는
 *      낱개 Mesh 라 인스턴스 위상 해시가 없다 — 위상 0으로 통일해 흔든다
 *      (같은 재질을 나눠 쓰는 낱개끼리는 한 박자로 흔들린다).
 *   2. `asset3d.js`의 `delam()` — 잡초 GLB(`assets/models/nature/` 밑
 *      Grass·Flowers·Bush·Shrub, `isSwayAsset()` 참고)가 실제로 도착했을
 *      때. 나무·바위·통나무는 이 판별에서 자동으로 빠진다(뿌리까지
 *      통째로 흔들리면 어색하다 — 사가만리가 GLB 나무를 애초에 뺀 이유와
 *      같다, `world3d.js` 주석 참고).
 *
 * three 가 없으면(자가진단) 아무 것도 안 한다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /** 흔들림 손잡이 — 사가만리와 같은 키(`world3d.sway`)를 그대로 쓴다. 툰·외곽선
   *  (`toon3d.js`)이 그랬듯 어드민 UI(`dg3d.*`)엔 안 올리고 콘솔
   *  `DG.core.setTune('world3d.sway', 0)`으로만 잡는다 — 이 판 관례. */
  function SWAY_ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('world3d.sway', 1) ? true : false) : true;
  }
  function SWAY_AMT() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? core.tuned('world3d.swayAmt', 0.06) : 0.06;
  }

  /** `onBeforeCompile`의 본체 — 순수 문자열 치환이라 GPU 없이도 자가진단이
   *  결과를 값으로 잰다(`terrain3d.js`의 `patchShader`와 같은 요령). */
  function patchShader(shader) {
    shader.uniforms.uSwTime = { value: 0 };
    shader.uniforms.uSwAmt = { value: SWAY_AMT() };
    shader.vertexShader = 'uniform float uSwTime;\nuniform float uSwAmt;\n' +
      shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '#ifdef USE_INSTANCING\n' +
        '  float swPhase = dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719));\n' +
        '#else\n' +
        '  float swPhase = 0.0;\n' +
        '#endif\n' +
        '  float swLift = (transformed.y + 0.5) * uSwAmt;\n' +
        '  transformed.x += sin(uSwTime * 1.6 + swPhase) * swLift;\n' +
        '  transformed.z += cos(uSwTime * 1.3 + swPhase) * swLift * 0.6;\n');
    return shader;
  }

  var swayShaders = [], swayClock = 0, swayBroken = false;
  /** 재질 하나를 흔들리게 만든다 — `dungeon3d.js`의 `mat(hex,'sway')`,
   *  `asset3d.js`의 `delam()`(잡초 GLB) 둘에서만 부른다. */
  function swayify(m) {
    m.onBeforeCompile = function (shader) {
      patchShader(shader);
      swayShaders.push(shader);
    };
    /* 흔들리는 것과 안 흔들리는 재질은 다른 프로그램이다 — 캐시 키를 갈라야
       three 가 컴파일된 프로그램을 서로 나눠 쓰다 하나만 남기는 사고가 없다
       (`toon3d.js`의 외곽선 재질과 같은 이유) */
    m.customProgramCacheKey = function () { return 'sway'; };
  }

  /** 매 프레임 부른다(`dungeon3d.js`의 `render()` 안, `AS().tick()` 옆) — 이
   *  파일은 `render()`가 dt 를 안 넘겨줘서(사가만리 `world3d.js`의 `syncSway
   *  (dt)`와 다른 자리) 시계를 스스로 잰다. 꺼져 있으면 마지막 자세로 멎는다
   *  (`world3d.js`의 `syncSway` 주석과 같은 뜻). */
  var lastTickT = null;
  function tick() {
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var dt = lastTickT === null ? 0 : (now - lastTickT) / 1000;
    lastTickT = now;
    if (!SWAY_ON() || !swayShaders.length || swayBroken || dt <= 0 || dt > 0.5) { return; }
    try {
      swayClock += dt;
      var amt = SWAY_AMT(), i;
      for (i = 0; i < swayShaders.length; i++) {
        swayShaders[i].uniforms.uSwTime.value = swayClock;
        swayShaders[i].uniforms.uSwAmt.value = amt;
      }
    } catch (err) {
      swayBroken = true;
      if (global.console) { console.error('[sway3d] 잎·풀 흔들림에서 멎어 껐다', err); }
    }
  }

  global.DG = global.DG || {};
  global.DG.sway3d = {
    swayify: swayify, patchShader: patchShader, tick: tick,
    SWAY_ON: SWAY_ON, SWAY_AMT: SWAY_AMT,
    ready: function () { return !!three(); },
    /* 자가진단용 — 등록된 셰이더 수를 그대로 잰다(GPU 없이도 swayify() 가
       실제로 push 했는지 값으로 확인) */
    _registeredCount: function () { return swayShaders.length; }
  };
})(window);
