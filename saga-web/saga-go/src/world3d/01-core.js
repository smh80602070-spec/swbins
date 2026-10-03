/**
 * 3D 렌더러 — 원작의 화면을 WebGL 로 옮긴다
 * ---------------------------------------------------------------
 * 여태 화면은 캔버스 2D 였다. 2.5D·3D 모드도 스프라이트를 원근으로 **세워 그린**
 * 가짜였다(`world.js` 의 `project()`). 원작은 지도 위에 진짜 3D 가 서 있고,
 * 그림자가 지면에 지고, 카메라가 낮게 깔려 따라다닌다. 그 층을 여기 만든다.
 *
 *   지면    실제 지도 타일을 **평면에 텍스처로** 깐다 (타일을 못 받으면 절차적 지형)
 *   사물    지도에 높이 정보가 없으니 `terrainAt` 격자로 **절차적으로 세운다**(`propPlan`)
 *   인물·짐승  `actor3d.js` 가 **도형으로 조립한 입체**를 세운다 (빌보드는 되돌림용)
 *   조명    시각과 천후를 보고 해가 뜨고 진다 (`lightingAt`)
 *   카메라  플레이어를 뒤에서 낮게 본다. 조우가 열리면 그쪽으로 다가간다
 *
 * **판정에는 한 줄도 닿지 않는다.** 좌표·스폰·거리는 전부 `world.js` 의 것을 읽기만
 * 하고, 여기서 만든 값은 화면에만 쓴다. 그래서 자가진단(`DG_NO_DRAW`)은 이 파일을
 * 켜지도 않고, 켜지지 않아도 게임은 그대로 돈다 — 대신 **값을 내는 함수**
 * (`lightingAt`·`propPlan`·`camAim`)는 three 없이도 돌아 진단이 그것만 따로 본다.
 *
 * WebGL 이 없거나 켜다 실패하면 **조용히 2D 로 돌아간다**(`available()` 이 false).
 * three.js 는 `js/vendor/three.iife.js` 한 덩이로 들어 있다 — PC 단독판이 `file://`
 * 로 열리는데 거기서는 `<script type="module">` 이 막히기 때문이다(그래서 IIFE 다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var T = null;                 // THREE (없으면 이 모듈은 통째로 잠든다)
  var renderer = null, scene = null, camera = null;
  var sun = null, sky = null;
  var groundGroup = null, propGroup = null, actorGroup = null, fxGroup = null;
  var tileMeshes = {};          // 지면 타일 { key: Mesh }
  var propMeshes = {};          // 건물·나무 { key: Object3D }
  var townDens = {};            // 'gx:gy' → 그 마을 칸을 지을 때 쓴 밀도(houseRects 가 보이는 집과 같은 계획을 뽑게)
  var actors = {};              // 배우 { key: {node, shadow, seen, …} }
  var texCache = {};            // 캔버스/이미지 텍스처
  var ready = false, failed = false;
  var canvas = null;
  var frame = 0;
  var lightNow = null;          // 이번 프레임의 조명 (probe 가 들여다본다)

  /* ── 규칙 값 (화면에만 쓰는 값이라 손잡이로 열어 둔다) ── */

  function TILE_SPAN() { return core.tuned('world3d.tileSpan', 3); }      // 타일 반경(장)
  /** 버거우면 스스로 깎는 배수 (`perf.js`) — 없으면 1 이라 예전과 같다 */
  function PF(key) { var P = global.DG.perf; return P ? P.mul(key) : 1; }
  function PROP_R() { return core.tuned('world3d.propRadius', 260) * PF('radius'); }
  /* 부수는 반경 — 짓는 반경(R)보다 크게 잡아 경계에서 왕복해도 짓고 부수고를
     되풀이하지 않는다 (PLAN 42절 ACTIVE/VISIBLE/UNLOAD) */
  function PROP_UR(R) { return R * core.tuned('world3d.unloadRadius', 1.4); }
  /** 잔 사물(나무·바위·풀)의 **진짜 모델**을 받는 거리(m, PLAN 36절 LOD).
   * 이 밖은 곧장 싼 도형(원뿔·공)으로 선다 — 진짜 모델은 도형보다 삼각형이
   * 백 배다(`prop3d.js` 의 `ON()` 과 같은 사정이지만, 그건 기기 등급으로
   * 가르고 이건 **거리**로 가른다) */
  function LOD_NEAR() { return core.tuned('world3d.lodNear', 90) * PF('radius'); }
  /** 잎·풀이 바람에 흔들릴까(PLAN 44절) — 0 이면 정지 화면(느린 기기용) */
  function SWAY_ON() { return core.tuned('world3d.sway', 1) ? true : false; }
  /** 흔들리는 폭(정점 좌표 배율) — 크면 과장되게 흔든다 */
  function SWAY_AMT() { return core.tuned('world3d.swayAmt', 0.06); }
  /** 등롱·사당 불이 일렁일까(PLAN 44절 "불꽃") — 0 이면 고정 밝기 */
  function FLAME_ON() { return core.tuned('world3d.flame', 1) ? true : false; }
  /** 일렁이는 폭(emissiveIntensity 배율) */
  function FLAME_AMT() { return core.tuned('world3d.flameAmt', 0.18); }
  /** 등롱·사당 위에 연기가 오를까(PLAN 44절) — 불과 같은 밤에만 보인다 */
  function SMOKE_ON() { return core.tuned('world3d.smoke', 1) ? true : false; }
  function CAM_DIST() { return core.tuned('world3d.camDist', 40); }       // 카메라 거리(m)
  function CAM_HIGH() { return core.tuned('world3d.camHeight', 15); }     // 카메라 높이(m)
  /** 사람 키(m) — 원작처럼 지도 위에서는 실제보다 크게 세운다(1.8m 면 안 보인다) */
  function ACTOR_H() { return core.tuned('world3d.actorH', 3.4); }
  /** 배우를 도형으로 세울까 — 0 이면 1단계의 빌보드로 돌아간다 */
  function MESH_ON() {
    var P = global.DG.perf;
    if (P && !P.meshOk()) { return false; }      // 가장 버거울 때는 빌보드로 돌아간다
    return core.tuned('world3d.mesh', 1) ? true : false;
  }
  /** 건물 밀도 배수 — 기기가 버거우면 여기를 내린다 */
  function DENSITY() { return core.tuned('world3d.density', 1) * PF('prop'); }
  /** 시각을 따라 해가 뜨고 질까 — 0 이면 늘 한낮.
   * 2026-08-30에 기본을 껐었다 — 밤을 다섯 번 밝혀도(색·세기·깊은밤 감쇠
   * 다 낮 수준까지 밀었다) 사용자가 실기기에서 계속 어둡다고 했고, 결국
   * "밤을 낮으로 바꿔 달라"고 해서 아예 밤 자체를 없앴었다.
   * **2026-09-10, 다시 켰다** — "지도도 더 자연스럽게 … 별도 보이고" 요청으로
   * 별(`sky3d.js`)을 넣으려면 밤이 실제로 뜻이 있어야 했다. 사용자가 "밤이라도
   * 밝게 해, 잘 보이게"로 확인 — 그래서 그날 최대한 밝혀 둔 밤 세기·색은
   * 한 글자도 안 건드렸다(아래 `lightingAt` 의 밤 최저치 주석 그대로), 사이클
   * 자체만 되살렸다. 손잡이는 그대로 있으니 0 으로 내리면 다시 늘 한낮이다 */
  function DAYNIGHT() { return core.tuned('world3d.dayNight', 1) ? true : false; }
  /** 비·눈에 강물이 불까 — 0 이면 늘 마른 날의 그림이다 */
  function WET() { return core.tuned('world3d.wetRiver', 1) ? true : false; }
  /** 세로 화면에서 카메라를 물릴까 — 0 이면 옛 그림(폰에서 지형지물이 화면을 덮는다) */
  function PORTRAIT_FIT() { return core.tuned('world3d.portraitFit', 1) ? true : false; }
  /** 물리는 정도의 상한(배) — 1 이면 안 물린다 */
  function PORTRAIT_MAX() { return core.tuned('world3d.portraitMax', 1.8); }

  /** 기본 시야각(도) — 가로 화면에서 쓰던 값 */
  function FOV() { return core.tuned('world3d.fov', 52); }
  /** 세로 화면에서 벌릴 수 있는 시야각의 상한(도) */
  function FOV_MAX() { return core.tuned('world3d.fovMax', 80); }

  /* 이 판의 거리·높이 값은 **PC 가로 화면**에서 잡혔다. three 의 fov 는 세로
     기준이라, 세로로 긴 폰(가로세로비 0.53)에서는 가로 시야가 PC 의 절반 밑으로
     좁아진다 — 같은 자리인데 건물과 나무가 화면을 덮는다.
     **카메라를 물리지는 않는다.** 물려 봤더니 안개(lightingAt 의 fog)가 가로
     화면 거리에 맞춰져 있어 화면이 통째로 하얘졌다 — 실제로 찍어 보고 접은 길이다.
     대신 **시야각만 벌린다**: 카메라는 제자리라 안개도 그림자 상자도 그대로다.
     REF 는 그 거리 값들이 잡힌 화면의 가로세로비다. */
  var REF_ASPECT = 1.5;
  var DEG = 180 / Math.PI;
  /** 이 화면에서 쓸 시야각(도). 가로 화면이면 기본값 그대로 */
  function fovFor(w, h) {
    var base = FOV();
    if (!PORTRAIT_FIT() || !w || !h) { return base; }
    var a = w / h;
    if (a >= REF_ASPECT) { return base; }
    /* 제곱근을 쓴다 — 가로 시야를 그대로 되찾으려면 폰에서 112도가 되어 휜다 */
    var mul = Math.min(PORTRAIT_MAX(), Math.sqrt(REF_ASPECT / a));
    var t = Math.tan(base / 2 / DEG) * mul;
    return Math.min(FOV_MAX(), 2 * Math.atan(t) * DEG);
  }

  /** 3D 로 그릴까 — 손잡이로 끌 수 있다(0 이면 예전 2D 화면) */
  function wanted() { var S = core.save && core.save.settings; return core.tuned('world.render3d', 1) && !(S && S.tilt === 0) ? true : false; }   // 시점 2D(tilt 0) = 2D 캔버스 판(W-0019 — "2D 단추를 누르면 전체가 2D")

  function available() { return ready && !failed; }
  function active() { return available() && wanted(); }

  /* ── 시간대 조명 ──────────────────────────────────────────
   * 원작에서 저녁에 나가면 화면이 저녁이다. 그 하나가 "지금 밖에 있다" 를 만든다.
   * 여기서는 **시각과 천후만 보고** 값을 낸다 — three 도 세이브도 안 본다.
   * 그래서 자가진단이 이 함수만 따로 굴려 볼 수 있다.
   */
  function mixHex(a, b, k) {
    k = k < 0 ? 0 : (k > 1 ? 1 : k);
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) |
           (Math.round(ag + (bg - ag) * k) << 8) |
           Math.round(ab + (bb - ab) * k);
  }
  /** 색의 밝기 (0~1) — 진단이 "밤이 더 어둡다" 를 값으로 본다 */
  function lum(hex) {
    return (((hex >> 16) & 255) * 0.299 + ((hex >> 8) & 255) * 0.587 + (hex & 255) * 0.114) / 255;
  }

  /* 다섯 번째 손질(2026-08-30) — 네 번째 손질(세기 대신 색을 밝힘)도 실기기에서
     "아직 어둡다"였다. 사용자가 "요즘 시대엔 조명이 밝다"고 확인 — 밤을
     어둡게 연출하는 무드 자체를 포기하고, **낮에 최대한 가깝게** 밝힌다.
     이 색표만으론 부족해 `lightingAt` 의 세기 최저치(1.4→1.7·1.2→1.4)와
     깊은 밤 추가 감쇠(0.82/0.85/0.42/0.30→0.90/0.90/0.36/0.18)도 같이 올렸다.
     `_test.html` 대비 문턱(한낮/깊은밤 하늘 2배, 밤 지도물감 0.7배)은 여전히
     넉넉히 통과한다(2.36배 · 0.61배) — 남은 차이는 색조(푸른 달빛 톤)뿐이다 */
  /* 여섯 번째 손질(2026-09-27, 헤드리스로 직접 찍어 확인) — 실기 "전체적으로 너무 어두워". 세기는 이미 올라 있어
     어둠의 정체는 **색**이었다: 밤 반구광 땅쪽(0x565f70)·지도 물감(0x939cb6)·짙은 남색 안개가 화면을 덮고,
     낮도 땅쪽 반사(0x53604a)가 어두운 녹갈색이라 벽이 칙칙했다. 밤은 푸른 톤만 남기고 밝히고, 낮 반사도 올린다 */
  var C_NIGHT = { sun: 0xdde6ff, sky: 0x6f86b3, hemiSky: 0x9fb4dc, hemiGnd: 0x7c8496, tint: 0xb4bdd4 };
  var C_GOLD = { sun: 0xffab63, sky: 0xe8946a, hemiSky: 0xf0b48a, hemiGnd: 0x6a5a4c, tint: 0xffd2b0 };
  var C_DAY = { sun: 0xfff0d0, sky: 0x8fb6d8, hemiSky: 0xdce9ff, hemiGnd: 0x7d8466, tint: 0xffffff };

  /**
   * @param ms    시각(생략하면 지금)
   * @param wkey  천후 키(clear·cloud·rain·wind·fog·snow). 생략하면 맑음
   */
  function lightingAt(ms, wkey) {
    var d = new Date(ms === undefined ? Date.now() : ms);
    var hour = d.getHours() + d.getMinutes() / 60;
    /* 해 고도 — 6시에 뜨고 18시에 진다. 실제 천문을 흉내 내지 않는다:
       위도·계절까지 넣으면 값은 정확해지지만 화면은 달라지지 않는다 */
    var alt = Math.sin((hour - 6) / 12 * Math.PI);
    if (!DAYNIGHT()) { alt = 0.9; hour = 12; }

    var phase = alt > 0.30 ? 'day'
      : (alt > 0.04 ? (hour < 12 ? 'dawn' : 'dusk')
        : (alt > -0.14 ? 'twilight'
          /* **깊은 밤** — `PLAN.md` 20절이 콕 집은 02:00 Deep Night 이다.
             자정부터 네 시까지, 밤 중에서도 가장 어두운 때. 23시는 그대로 `night`
             이라 이 갈래를 더해도 여태 값이 안 흔들린다 */
          : ((hour < 4) ? 'deepnight' : 'night')));

    /* 낮섞임(k)과 노을섞임(gold) 둘로 색을 만든다.
       노을은 해가 지평선 가까이 있을 때만 세다 — 한낮에도 섞으면 늘 누렇다 */
    var k = Math.max(0, Math.min(1, (alt + 0.14) / 0.62));
    var gold = Math.max(0, 1 - Math.abs(alt - 0.10) / 0.36);

    function pick(field) {
      var base = mixHex(C_NIGHT[field], C_DAY[field], k);
      return mixHex(base, C_GOLD[field], gold * 0.75);
    }

    var out = {
      hour: hour, alt: alt, phase: phase, night: phase === 'night',
      sun: {
        hex: pick('sun'),
        /* 밤 최저치 — 0.28→0.65→1.0→1.4 를 거쳐 1.7 까지 올렸다(2026-08-30,
           다섯 번째 손질). 세기·색 다 올려도 실기기에서 "아직 어둡다"는 게
           계속 나와, 사용자가 "요즘 시대엔 조명이 밝다" — 즉 무드보다 **밝게
           보이는 것 자체**를 원한다고 확인했다. 낮과의 차이는 이제 색조(푸른
           달빛 톤)만 남기고 세기 차이는 최소로 줄였다 */
        intensity: 1.7 + Math.max(0, alt) * 0.23,
        /* 해는 동(-x)에서 떠 서(+x)로 진다. 밤에는 달이 반대쪽에 뜬 셈 친다 */
        x: -Math.cos((hour - 6) / 12 * Math.PI) * 120,
        y: 40 + Math.abs(alt) * 110,
        z: -70 - Math.max(0, alt) * 40
      },
      /* 밤 최저치 — 위 sun 과 같은 이유·같은 다섯 번의 손질(0.52→0.85→1.2→1.4) */
      hemi: { sky: pick('hemiSky'), ground: pick('hemiGnd'), intensity: 1.95 + k * 0.3 },   // 2026-09-27 그늘진 벽이 거의 검게 — 1.4 → 1.95(헤드리스로 전후 확인)
      bg: pick('sky'),
      tint: pick('tint'),
      fog: { near: 150 + k * 110, far: 520 + k * 240 },       // 2026-09-27 밤 안개를 멀리(짙은 남색 벽이 화면을 덮었다)
      /* 밤에는 배우 발밑에 등불이 켜진다 (원작의 밤 화면에서 아바타가 안 묻히게) */
      lamp: alt < 0.06 ? Math.min(1, (0.06 - alt) * 4) : 0
    };

    /* 깊은 밤은 한 겹 더 어둡다. 대신 **등롱은 더 밝다** — 다 같이 어두워지면
       그냥 안 보이는 화면이 되고, 밤이 깊었다는 것이 안 읽힌다.
       (2026-08-30, 다섯 번째 손질로 이 겹도 옅게 줄였다 — 0.82/0.85/0.42/0.30
       → 0.90/0.90/0.36/0.18. `_test.html` 의 "한낮이 한밤(자정=깊은 밤)보다
       밝다" 문턱(하늘 밝기 비 2배)은 여전히 넉넉히 넘는다) */
    if (phase === 'deepnight') {
      out.sun.intensity *= 0.90;
      out.hemi.intensity *= 0.90;
      out.bg = mixHex(out.bg, 0x05070c, 0.2);
      out.tint = mixHex(out.tint, 0x2a3040, 0.1);
      out.lamp = 1;
    }

    var w = wkey || 'clear';
    if (w === 'rain') {
      out.sun.intensity *= 0.48; out.hemi.intensity *= 0.80;
      out.bg = mixHex(out.bg, 0x55606e, 0.55); out.tint = mixHex(out.tint, 0x8f99a8, 0.45);
      out.fog.far *= 0.46; out.fog.near *= 0.7;
    } else if (w === 'snow') {
      out.sun.intensity *= 0.66; out.hemi.intensity *= 1.05;
      out.bg = mixHex(out.bg, 0xc8d2de, 0.55); out.tint = mixHex(out.tint, 0xe0e8f0, 0.45);
      out.fog.far *= 0.52;
    } else if (w === 'fog') {
      out.sun.intensity *= 0.55; out.hemi.intensity *= 0.92;
      out.bg = mixHex(out.bg, 0xb8bcc0, 0.6); out.tint = mixHex(out.tint, 0xc2c6ca, 0.35);
      out.fog.far *= 0.26; out.fog.near *= 0.35;
    } else if (w === 'cloud') {
      out.sun.intensity *= 0.85; out.hemi.intensity *= 0.97;          // 2026-09-27 흐림이 화면을 칙칙하게 — 0.70 → 0.85
      out.bg = mixHex(out.bg, 0x8a929c, 0.3); out.tint = mixHex(out.tint, 0xb8bec6, 0.16);
      out.fog.far *= 0.78;
    } else if (w === 'wind') {
      out.fog.far *= 1.15;
    }
    out.weather = w;
    return out;
  }

  /* 데모가 밤·노을을 눈으로 확인할 때 쓰는 문 — 게임에서는 늘 null 이라 진짜 시계를 본다
     (`weather.force` 와 같은 방식이다: 밖에서 함수를 갈아 끼우면 안쪽 호출이 안 바뀐다) */
  var forcedMs = null;
  function forceTime(ms) {
    forcedMs = (ms === null || ms === undefined) ? null : ms;
    return forcedMs;
  }

  function weatherKey() {
    var FRw = global.DG.frost;
    if (FRw && FRw.snowingHere && FRw.snowingHere()) { return 'snow'; }   // §5 ⑲-27 서리봉 고원 안에서만 눈
    var W = global.DG.weather;
    return W ? W.current().key : 'clear';
  }

  /**
   * HDRI 환경광(IBL) — Poly Haven CC0 "Alps Field"(사가의숲이 이미 쓰는 파일을
   * 그대로 재사용, `assets/ASSET_LICENSES.md` 참고). 2026-09-04, 사용자가
   * "재질을 실사처럼" 요청해 얹는다. **하늘 색은 안 바꾼다** — `scene.background`
   * 는 그대로 `lightingAt()` 의 시각별 색에 맡기고, `scene.environment` 에만
   * 물려 PBR 재질(GLB 인물·건물)의 반사·거칠기만 사실적으로 만든다.
   *
   * **밤에 대낮 하늘이 그대로 비치면 안 된다** — 이 판은 예전에 ACES
   * 톤매핑을 걸었다가 밤 화면이 통째로 날아간 사고를 겪었다(`post3d.js`
   * 머리말 "ACES 로 갔다가 물러섰다" 참고). 같은 사고를 되풀이하지 않으려고
   * 톤매핑 곡선은 손 안 대고, 대신 환경광 **세기 자체**를 `syncLight()` 에서
   * `hemi.intensity`(이미 낮·밤·날씨별로 손으로 맞춰 둔 그 곡선)에 비례해
   * 매 프레임 같이 낮춘다/올린다 — 이 판의 밤은 원래도 그리 어둡지 않게
   * 맞춰져 있어(`lightingAt` 의 밤 최저치 주석 참고) 낮과 크게 다투지 않는다.
   * 못 받아도(느린 회선·file:// 단독판 등) 조용히 넘어가고 옛 조명만으로 돈다.
   */
  var IBL_SRC = 'assets/hdri/alps_field_1k.hdr';
  function IBL_ON() { return core.tuned('world3d.ibl', 1) ? true : false; }
  /** 얼마나 세게 섞나 — hemi.intensity(대략 1.4~1.7) 에 곱하는 비율.
   *  너무 세면 반사가 재질 색을 삼킨다(눈으로 보고 0.30으로 정함) */
  function IBL_SCALE() { return core.tuned('world3d.iblScale', 0.30); }
  function loadEnvironment() {
    if (!IBL_ON() || !T.RGBELoader || !T.PMREMGenerator || !renderer) { return; }
    var pmrem = new T.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new T.RGBELoader().load(IBL_SRC, function (hdr) {
      var envMap = pmrem.fromEquirectangular(hdr).texture;
      if (scene) { scene.environment = envMap; }
      hdr.dispose();
      pmrem.dispose();
    }, undefined, function () { pmrem.dispose(); });
  }

  /* ── 켜기 ─────────────────────────────────────────────── */

  function init(cv) {
    if (ready || failed) { return available(); }
    T = global.THREE || null;
    canvas = cv || document.getElementById('map3d');
    if (!T || !canvas) { failed = true; return false; }
    try {
      /* `preserveDrawingBuffer` — 평소에는 끈다(빠르다). 헤드리스 스크린샷에서는
         **켜야 한다**: WebGL 은 그린 직후 버퍼를 비우므로, rAF 가 거의 돌지 않는
         그 환경에서는 캡처 시점에 빈 캔버스가 찍힌다(밟아 본 함정이다).
         데모 페이지가 `DG_3D_PRESERVE` 로 켠다. */
      renderer = new T.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: false,
        preserveDrawingBuffer: !!global.DG_3D_PRESERVE
      });
      /* SAGA-DESIGN §6.1 "저비용 통일" — 픽셀 비율 상한 1.5(옛 2는 폰에서 과잉 렌더) */
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      /* 디버그: 그림자·안개를 끊어 원인을 좁힐 수 있게 (DG_3D_DEBUG) */
      if (!(global.DG_3D_DEBUG || {}).noShadow) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
      }
    } catch (e) {
      failed = true;
      return false;
    }

    scene = new T.Scene();
    /* 카메라가 낮으면 지평선 위가 보인다 — 검정이 아니라 하늘이 있어야 한다.
       안개는 그 하늘색으로 멀리서 스며들게 해 경계가 드러나지 않게 한다. */
    var L0 = lightingAt(undefined, weatherKey());
    var skyCol = new T.Color(L0.bg);
    scene.background = skyCol;
    renderer.setClearColor(skyCol, 1);       // background 와 별개로 못박아 둔다
    if (!(global.DG_3D_DEBUG || {}).noFog) {
      scene.fog = new T.Fog(L0.bg, L0.fog.near, L0.fog.far);
    }

    camera = new T.PerspectiveCamera(
      fovFor(canvas.clientWidth || global.innerWidth, canvas.clientHeight || global.innerHeight),
      1, 0.5, 1400);

    /* 빛은 둘뿐이다 — 하늘/땅에서 오는 반사광과, 그림자를 만드는 해 하나 */
    sky = new T.HemisphereLight(L0.hemi.sky, L0.hemi.ground, L0.hemi.intensity);
    scene.add(sky);
    sun = new T.DirectionalLight(L0.sun.hex, L0.sun.intensity);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(sun.target);
    /* 배우를 따라다니며 머리 위에 뜨던 등롱 불빛은 뺐다(2026-08-29) — 사용자가
       실기기에서 허공에 뜬 빛 덩이로 보인다고 지적했다. 밤 자체가 이제
       충분히 밝아(위 lightingAt 의 최저치) 따로 안 켜도 배우가 묻히지 않는다 */

    /* 후처리 — 톤매핑·블룸·색보정 (`post3d.js`, 그래픽 보강 16~18절).
       **렌더러를 만든 직후 켜야 한다** — 여기서 `toneMapping` 을 한 번 켜 두면
       뒤에 만드는 재질이 모두 그 상태로 컴파일된다. 늦게 켜면 씬 전체가
       한 번 다시 컴파일되며 화면이 멎는다 */
    if (global.DG.post3d) { global.DG.post3d.init(T, renderer); }
    loadEnvironment();

    groundGroup = new T.Group(); scene.add(groundGroup);
    propGroup = new T.Group(); scene.add(propGroup);
    actorGroup = new T.Group(); scene.add(actorGroup);
    fxGroup = new T.Group(); scene.add(fxGroup);

    bindEvents();
    /* 소품 모델(나무·바위·풀)을 미리 받아 둔다 — 안 받아 두면 처음 몇 초 동안
       원뿔 나무가 서 있다가 툭 바뀐다 (`prop3d.js`) */
    if (global.DG.prop3d) { global.DG.prop3d.preload(); }
    preloadLandTex();
    ready = true;
    resize();
    return true;
  }

  function resize() {
    if (!available() || !canvas) { return; }
    var w = canvas.clientWidth || global.innerWidth;
    var h = canvas.clientHeight || global.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.fov = fovFor(w, h);
    camera.updateProjectionMatrix();
    if (global.DG.post3d) { global.DG.post3d.resize(); }
  }

  /* 좌표 — world.js 는 미터 평면(x 동쪽, y 남쪽)이고 3D 는 y 가 높이다.
     **(x, y) → (x, 0, y)** 로 그대로 눕힌다. 축을 다시 정의하지 않는다. */

  /* ── 지면 ─────────────────────────────────────────────── */

  function tileTexture(img) {
    if (!img || !img.ready) { return null; }
    var key = img.src;
    if (texCache[key]) { return texCache[key]; }
    var tex = new T.Texture(img);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    texCache[key] = tex;
    return tex;
  }

  /* ── 손으로 그린 땅을 지면에 칠한다 ─────────────────
   * 여태 이 땅(`land.js`)은 **사물로만** 드러났다 — 판교 지도 위에 하북 마을의
   * 기와집이 서 있는 꼴이었다. 지면 그림 자체를 맞춘다.
   *
   * 지도 타일을 캔버스에 그대로 굽고, 그 위에 **48m 격자마다 제 색을 덧칠**한다.
   * 지도가 안 왔으면 색만 칠한다 — 오프라인에서도 이 땅은 이 땅으로 보인다.
   *
   * **가장자리는 흐린다.** 딱 잘리면 종이를 오려 붙인 것으로 보인다 —
   * 이웃 넷 중 몇이 이 땅인지 세어 그만큼만 진하게 칠한다.
   */
  var LAND_COLOR = {
    grass: '#8fae6a', forest: '#5c7f4e', mount: '#9a9188',
    water: '#4a7fa6', road: '#c9bfa8', town: '#c2b49a', farm: '#7f9c5e'
  };
  /** 덧칠을 할까 — 0 이면 예전처럼 실제 지도만 깔린다 */
  function LAND_PAINT() { return core.tuned('world3d.landPaint', 1) ? true : false; }
  /** 얼마나 진하게 — 1 이면 지도가 아예 안 비친다 */
  function PAINT_A() { return core.tuned('world3d.landPaintAlpha', 0.88); }

