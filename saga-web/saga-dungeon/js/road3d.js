/**
 * 길(road) 데칼 — PLAN §6.1 항목 5가 마지막으로 남긴 조각("길은 여전히 도형이다")
 * ---------------------------------------------------------------
 * `dungeon3d.js`의 `p.t==='path'`가 단색 상자(0x4a3f30)로만 그리던 길을,
 * `terrain3d.js`가 이미 싣는 흙 텍스처(`assets/textures/land/dirt.webp`) +
 * 가장자리 알파 페이드로 갈아 끼운다. 진짜 `THREE.DecalGeometry` 투영은 안
 * 쓴다 — 이 판의 길은 처음부터 독립된 평판(방향·크기가 늘 고정, 그림자는
 * 안 드리우고 받기만 하는 순수 장식)이라 텍스처 + 가장자리 흐림만으로
 * "바닥에 스민 흙길"처럼 보인다.
 *
 * `BoxGeometry(1,1,1)` 윗면 UV는 `vUv.y`(박스 로컬 z축=길 폭)가 0..1 을
 * 그대로 쓴다 — 한복판(0.5)에서 알파 1, 가장자리(0·1)로 갈수록 0으로
 * smoothstep 페이드해 잔디(들판 트라이플레이너 지형)에 스미듯 섞인다.
 * `onBeforeCompile`로 `#include <map_fragment>` 뒤에 알파만 깎는다(색은
 * 안 건드림, `terrain3d.js`·`sway3d.js`와 같은 요령).
 *
 * **텍스처는 `terrain3d.js`처럼 동기로 물린다**(`TextureLoader.load()`,
 * 그림은 비동기로 와도 텍스처 객체 자체는 그 자리에 있다) — 재질 만드는
 * 그 순간부터 `map`이 있어야 `USE_MAP`(그리고 `vUv` varying)이 첫 컴파일부터
 * 정해진다. `dungeon3d.js`의 `texMat()`처럼 맵을 나중에 갈아 끼우면, 처음
 * 컴파일 때 `USE_UV`가 안 잡혀 `vUv`가 아예 없는 셰이더에 이 파일이
 * `vUv.y`를 참조하다 컴파일 에러가 난다 — 그 함정을 피한다.
 *
 * three 가 없으면(자가진단) 아무 것도 안 한다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  var TEX_URL = 'assets/textures/land/dirt.webp';
  var tex = null;
  function loadTex() {
    if (tex) { return tex; }
    var t = three();
    if (!t) { return null; }
    tex = new t.TextureLoader().load(TEX_URL);
    tex.wrapS = t.RepeatWrapping;        // 길이 방향(반복)
    tex.wrapT = t.ClampToEdgeWrapping;   // 폭 방향 — 가장자리 페이드가 한 번만 걸리게 안 반복
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    return tex;
  }

  /* 이 셰이더의 uv varying 이름 — 새 three(r152~)는 map 용 `vMapUv`, 옛 것은 `vUv` 다. 맞는 것을 골라야 컴파일이 된다 */
  function uvName() {
    var t = three(), rev = t ? parseInt(t.REVISION, 10) : 0;      // 셰이더 청크는 include 가 풀리기 전이라 글자로 못 고른다 — three 버전으로 고른다
    return rev >= 151 ? 'vMapUv' : 'vUv';
  }
  function fadeBody(uv) {
    return [
      '  float k_roadFade = min(smoothstep(0.0, 0.22, ' + uv + '.y), smoothstep(1.0, 0.78, ' + uv + '.y));',
      '  diffuseColor.a *= k_roadFade;'
    ].join('\n');
  }

  /** `onBeforeCompile`의 본체 — 순수 문자열 치환이라 GPU 없이도 자가진단이
   *  결과를 값으로 잰다(`terrain3d.js`의 `patchShader`와 같은 요령). */
  function patchShader(shader) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n' + fadeBody(uvName()));
    return shader;
  }

  var mat = null;
  /** 길 재질 — 한 번만 만들어 모든 길 조각이 나눠 쓴다(이 판의 길 상자는
   *  크기가 늘 같다, `dungeon3d.js`의 `F.CHUNK+2 × 46` 고정). `repeatU`는
   *  길이(가로) 방향 반복 횟수만 받는다 — 폭(세로) 쪽은 위 가장자리 페이드가
   *  한 번만 걸려야 하니 항상 1. */
  function material(repeatU) {
    var t = three();
    if (!t) { return null; }
    if (mat) { return mat; }
    var tx = loadTex();
    if (!tx) { return null; }
    tx.repeat.set(repeatU || 1, 1);
    var TN = global.DG.toon3d;
    var toon = !!(TN && TN.TOON_ON());
    mat = toon
      ? new t.MeshToonMaterial({ color: new t.Color(0xffffff), map: tx, flatShading: true, gradientMap: TN.ramp() })
      : new t.MeshLambertMaterial({ color: new t.Color(0xffffff), map: tx, flatShading: true });
    mat.transparent = true;
    mat.depthWrite = false;   // 길은 이미 바닥보다 1유닛 띄워 그린다(dungeon3d.js) — 겹쳐도 z파이팅 없음
    mat.onBeforeCompile = function (shader) { patchShader(shader); };
    /* 알파 페이드가 셰이더 구조 자체를 바꾸므로 캐시 키를 갈라야 한다
       (`terrain3d.js`·`sway3d.js`와 같은 이유) */
    mat.customProgramCacheKey = function () { return 'roadFade'; };
    return mat;
  }

  global.DG = global.DG || {};
  global.DG.road3d = {
    material: material, patchShader: patchShader,
    ready: function () { return !!three(); }
  };
})(window);
