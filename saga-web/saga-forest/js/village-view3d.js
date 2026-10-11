/**
 * 마을 화면 — 3D (PLAN 40절 PHASE 2, Player 3D + Tree/Rock/Vegetation)
 * ---------------------------------------------------------------
 * `village-view.js`(2D 구면 투영)는 이 파일이 있는지도 모른다 — **한 줄도
 * 안 건드렸다.** 대신 `#map3d` 캔버스에 별개의 WebGL 화면을 올리고, 켜져
 * 있을 때만 `#map`(2D)을 숨기고 이쪽을 보여 준다. 꺼지면(기본값) 예전 그대로다.
 *
 * **인물은 늘 원점(0,0,0)에 서 있고, 세상이 그 둘레를 돈다.** village.js 의
 * 마을 좌표(x,y)를 3D 세계로 그대로 옮기지 않는다 — `player.x/y` 를 뺀
 * **상대 좌표**로 나무·바위를 세운다. 걸으면 그것들이 인물 쪽으로 다가오고
 * 지나간다 — 2D 쪽 `project()`(구면 투영)가 늘 인물을 화면 한가운데 두는
 * 것과 같은 요령이다. 카메라는 그 위에서 **걷는 방향**만 따로 돈다(3인칭
 * 어깨너머 시점) — 이동(사물이 흐르는 것)과 시선(카메라가 도는 것)은 다른 일이다.
 *
 * **건물(전방·집·게시판…)도 2026-09-09부터 GLB 로 선다**(PLAN 6절 "작은
 * 마을"). 나무·바위와 똑같이 `SCATTER_KIND`에 한 줄 보태는 것으로 끝났다 —
 * village.js 의 props 는 처음부터 shop·home·board 같은 kind 를 갖고 있었고,
 * 이 화면이 그동안 그 kind 들을 표에서 빼 놓고만 있었을 뿐이다.
 *
 * **사물은 새로 흩뿌리지 않는다.** village.js 의 `V.raw().props`(이미 좌표
 * 해시로 정해진, 날마다 같은 자리)를 그대로 읽어 그중 나무·소나무·바위·꽃·
 * 잡초만 GLB 로 세운다(`SCATTER_KIND`). PLAN 10절 "중요한 장소는 랜덤
 * 배치하지 않는다"를 지키는 가장 쉬운 길은 **새 무작위를 아예 안 만드는 것**이다.
 *
 * **거리로 켜고 끈다** — 인물에서 `RENDER_R()` 안의 것만 세우고, 벗어나면
 * 치운다(PLAN 9절 "모바일 성능을 고려해 렌더링 수를 자동 조절"의 가장 단순한
 * 형태). `MAX_SCATTER()` 로 한 프레임에 새로 세우는 개수도 눌러 둔다 — 마을
 * 전체를 한 프레임에 다 지으면 순간 버벅인다.
 *
 * **땅바닥도 하나의 초록색이 아니다(PLAN 7절 지형 다양화).** `V.tileAt(tx,ty)`
 * 를 그대로 읽어 풀·흙길·모래·물·돌길을 색으로 가른다(색은 `villageData.TILES`
 * 에서 그대로 가져온다 — 2D 화면과 같은 색이다). 물은 살짝 낮춰 웅덩이처럼
 * 보이게 한다. 타일마다 메시를 만들지 않고 **종류별 `InstancedMesh` 하나**에
 * 자리만 채운다 — 인물 둘레 몇백 칸이라도 그리기 호출은 다섯 번뿐이다.
 *
 * **한 줄도 판정에 닿지 않는다.** village.js 의 걷기·채집·시간 계산은 이 파일이
 * 없어도 완전히 돈다 — 여기서는 `V.raw()`·`V.tileAt()`를 읽기만 한다.
 */
(function (global) {
  'use strict';

  var core = null;
  function C() { if (!core) { core = global.DG.core; } return core; }
  var A3 = null;
  function asset3d() { if (!A3) { A3 = global.DG.asset3d; } return A3; }
  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }

  /** 손잡이 — 2026-09-09부터 기본이 켜져 있다(3D로 시작). 사가나락(`dg3d.on`
   *  기본 1)와 시점을 맞췄다 — 그 전엔 "2D 가 그대로 간다"가 기본이었다.
   *  🧊 버튼이 이걸 뒤집는다(끄고 싶으면 여전히 끌 수 있다) */
  function ON() { return C().tuned('village3d.on', 1) ? true : false; }
  /** 안개 켜고 끄기(2026-09-10, "안개는 중요 하지 않으니 제거 하던지
   *  옵션에 키고 끄는걸 추가해 끄는게 기본이고") — §44 에서 FOG_FAR 를
   *  늘려 고치려 했던 것 자체를 사용자가 "중요하지 않다"고 되돌렸다.
   *  **기본은 꺼짐**(0) — 꺼져 있으면 안개가 아예 안 생겨 거리와 무관하게
   *  또렷이 보인다(멀리 있는 NPC 도 이걸로 해결된다). ⚙️ 설정 시트에서
   *  다시 켤 수도 있다(취향 문제로 남겨 둔다) — `village3d.quality` 와
   *  같은 결로 `core.tuned`/`setTune`(새로고침해도 유지) 에 저장한다 */
  function FOG_ON() { return C().tuned('village3d.fog', 0) ? true : false; }
  function setFogOn(v) {
    C().setTune('village3d.fog', v ? 1 : 0);
    var t = three();
    if (scene && t) {
      if (v) {
        if (!scene.fog) {
          scene.fog = new t.Fog(0x8fc7e8, FOG_NEAR, FOG_FAR);
          curBiome = null; curPhase = null; curWeatherSky = null;  // syncSky() 가 다음 프레임에 색을 새로 먹인다
        }
      } else {
        scene.fog = null;
      }
    }
    return FOG_ON();
  }
  /** 하늘 그라디언트(2026-09-19, "고품질 셀 셰이딩급" 요청 이어서 ③환경 레버) — PLAN §6.1
   *  이 예전부터 적어 둔 "camTiltMix 를 낮추는 게 아니라 원경 안개·하늘
   *  그라디언트로 지평선을 밝게" 를 실제로 얹는다. **기본 켬**(1) — 안개
   *  (기본 꺼짐)와 달리 그림자·InstancedMesh 처럼 드로우콜을 늘리는 게
   *  아니라 구 하나(`skyDome`)뿐이라 끌 이유가 안개만큼 크지 않다. */
  function SKY_ON() { return C().tuned('village3d.sky', 1) ? true : false; }
  function setSkyOn(v) {
    C().setTune('village3d.sky', v ? 1 : 0);
    if (skyDome) { skyDome.visible = SKY_ON(); }
    return SKY_ON();
  }
  function CAM_DIST() { return C().tuned('village3d.camDist', 7.5); }
  function CAM_HIGH() { return C().tuned('village3d.camHeight', 4); }
  /** 3/4 부감(쿼터뷰) 쪽 끝값 — 거리·기울기. tilt 가 클수록 카메라가 더 눕는다(수평 반지름이
   *  커지고 높이가 낮아진다), 작을수록 더 위에서 내리찍는 부감이 된다.
   *  **2026-09-02, 11 → 24 → 46 으로 올렸다가 도로 11 로.** 그때는 "버튼으로 클릭해서
   *  바꿨던 그 쿼터뷰"(첫 커밋 db12fe6, 실기기로 확인됨)를 원했던 것뿐이었다 — 세로
   *  드래그가 t=1 까지 실제로 안 닿아서(TILT_SENS 낮음) "덜 부감으로" 보인 걸 잘못
   *  짚고 화면 자체를 바꾼 착오였다. 그 사정과는 다르게, **2026-09-09 — camTiltMix
   *  기본을 1(부감 시작)로 바꾼(§8ec88ab) 당일 바로 "NPC가 3D에서 안 보이고 화면이
   *  너무 가깝다"는 새 신고가 왔다.** 계산해 보면 t=1 기본값에서도 카메라~플레이어
   *  거리가 겨우 9.95(월드단위, 캐릭터 키 1.7의 6배가 채 안 된다) — 숲 NPC 다섯은
   *  전부 호수·동굴·마을 같은 지형지물 자리에 고정이라 스폰에서 20~33타일 떨어져
   *  있는데(헤드리스 진단으로 실측), 이 거리에서는 방향을 알아도 화면에 걸리지 않는다.
   *  11 이 "틀렸다"는 뜻이 아니라 그때 확인된 그림은 지금과 다르다(그땐 버튼으로
   *  수동 전환, 지금은 시작부터 이 값) — 11→16 으로 45% 물렸다. 또 짚기 전에
   *  실기기로 먼저 확인할 것 */
  function ISO_DIST() { return C().tuned('village3d.isoDist', 16); }
  function ISO_TILT() { return C().tuned('village3d.isoTilt', 0.62); }
  function PLAYER_H() { return C().tuned('village3d.playerH', 1.7); }
  function GROUND_SIZE() { return C().tuned('village3d.groundSize', 400); }
  function FOV() { return C().tuned('village3d.fov', 55); }
  /** 쿼터뷰 쪽 화각 — 기본은 FOV() 와 같다(안 좁힌다). 정사영 흉내를 원하면 손잡이로 */
  function ISO_FOV() { return C().tuned('village3d.isoFov', FOV()); }
  /** 걸음이라고 볼 최소 속도(마을 좌표/초) — 이보다 느리면 멈춘 것으로 본다 */
  function MOVE_EPS() { return C().tuned('village3d.moveEps', 4); }
  /** 2026-09-10 "움직이는 모션을 더 자연스럽게" — 인물·짐승이 방향을 트는 빠르기
   *  (1/초, 지수감쇠 계수). 예전엔 걸음 방향(facingYaw)을 매 프레임 그대로
   *  대입해 한 프레임 만에 홱 돌아갔다(특히 팻말·자갈밭 지그재그로 걸을 때
   *  로봇처럼 스냅됐다) — 이제 이 빠르기로 부드럽게 좇아간다. 값이 클수록
   *  빨리 따라잡는다(8 → 약 0.35초 만에 목표각의 95%까지) */
  function TURN_RATE() { return C().tuned('village3d.turnRate', 8); }

  /** 마을 좌표 한 단위 = 몇 미터 — TILE(40단위)이 3.2m 쯤 되게 잡았다 */
  function WORLD_SCALE() { return C().tuned('village3d.worldScale', 0.08); }
  /** 인물에서 이 안(미터)에 있는 것만 3D 로 세운다 — 기본값은 품질 등급표(QUALITY_PRESET)를 탄다 */
  function RENDER_R() { return C().tuned('village3d.renderR', QUALITY_PRESET[tier()].renderR); }
  /** 벗어나면 치우는 거리 — RENDER_R 보다 살짝 넉넉해야 경계에서 깜빡이지 않는다 */
  function CULL_R() { return RENDER_R() + C().tuned('village3d.cullMargin', 6); }
  /** 한 프레임에 새로 세우는 최대 개수 — 마을을 한꺼번에 안 짓는다 */
  function MAX_BUILD_PER_STEP() { return C().tuned('village3d.maxBuildPerStep', 4); }
  /** 인물 둘레 몇 칸까지 색칠할까 (타일 수, 반지름) — 기본값도 품질 등급표를 탄다 */
  function GROUND_TILE_R() { return C().tuned('village3d.groundTileR', QUALITY_PRESET[tier()].groundTileR); }
  /** 물은 이만큼 낮춘다(미터) — 웅덩이처럼 보이게 */
  function WATER_DEPTH() { return C().tuned('village3d.waterDepth', 0.12); }
  /** 물 표현(PLAN 12절, 2026-09-09) — 파동 진폭(미터)·빈도·속도. 재질 컴파일 때
   *  한 번만 읽는다(카메라 손잡이처럼 매 프레임 바뀌지 않는다 — 3D 를 껐다 켜야
   *  반영된다, GROUND_SIZE()와 같은 성격) */
  function WATER_WAVE_AMP() { return C().tuned('village3d.waterWaveAmp', 0.045); }
  function WATER_WAVE_FREQ() { return C().tuned('village3d.waterWaveFreq', 1.4); }
  function WATER_WAVE_SPEED() { return C().tuned('village3d.waterWaveSpeed', 1.8); }
  /** 물결 반짝임(ripple) 점 — 물 칸 하나에 하나씩, 상한을 넘으면 먼저 찾은 것만 */
  function WATER_RIPPLE_CAP() { return C().tuned('village3d.waterRippleCap', 24); }

  /**
   * 그래픽 품질(PLAN 38절 "모바일 품질 프리셋" · PLAN 30절 "거리 기반 활성화") —
   * **프레임을 실측해 오가는 자동 조정까지는 안 만든다**(PLAN 38절은 "기기 성능을
   * 감지해서 기본값을 자동 설정한다"까지만 요구한다 — 이 판은 아직 그런 성능
   * 제보가 없어 과한 장치다). `village3d.quality`를 low/medium/high 로 고정하거나
   * 기본값 `'auto'`면 **켤 때 한 번** 기기를 보고 등급을 고른다.
   * (사가나락 `dungeon3d.js`의 `deviceScore`/`probeDevice`와 같은 요령이되, 그
   * 판의 프레임 실측 왕복 장치는 옮기지 않는다 — 다섯 판 공용 파일이 아니라서
   * 복붙이 아니라 **필요한 만큼만** 옮긴 것이다.)
   */
  var QUALITY_PRESET = {
    low:    { renderR: 26, groundTileR: 9,  dpr: 1,   shadow: false },
    medium: { renderR: 34, groundTileR: 12, dpr: 1.5, shadow: false },
    high:   { renderR: 40, groundTileR: 14, dpr: 2,   shadow: true }
  };
  function QUALITY() { return C().tuned('village3d.quality', 'auto'); }
  /** 순수 함수 — probe 값만으로 점수를 매긴다(scene·navigator 없이도 진단됨) */
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
  function tierFor(score) { return score >= 3 ? 'high' : (score >= 1 ? 'medium' : 'low'); }
  function probeDevice() {
    var n = global.navigator || {}, sc = global.screen || {};
    return {
      cores: n.hardwareConcurrency || 0, mem: n.deviceMemory || 0,
      w: sc.width || 0, h: sc.height || 0, dpr: global.devicePixelRatio || 1,
      touch: !!(('ontouchstart' in global) || (n.maxTouchPoints > 0))
    };
  }
  var autoTierCache = null;
  function autoTier() {
    if (!autoTierCache) { autoTierCache = tierFor(deviceScore(probeDevice())); }
    return autoTierCache;
  }
  /** 고정 값(low/medium/high)이면 그걸, 'auto'면 켤 때 한 번 잰 등급을 쓴다 */
  function tier() {
    var q = QUALITY();
    return (q === 'low' || q === 'medium' || q === 'high') ? q : autoTier();
  }

  /**
   * 설정 화면(⚙️, 2026-09-10)에서 고른다 — `village3d.quality` 손잡이에
   * **저장한다**(`core.setTune`, `yeoksa-village/tune` 에 남아 새로고침해도
   * 유지된다). 사가나락 `dungeon3d.js` 의 `D3.set()` 은 메모리에만 얹어 두고
   * 새로고침하면 사라지는데, 이 판은 `core.tuned` 가 있으니 그 손잡이를
   * 그대로 쓴다 — 장치가 따로 없다. 렌더러가 이미 서 있으면(3D 를 이미
   * 켠 채로 바꾸는 경우) 픽셀비도 즉시 다시 먹인다 — 그림자는 `step()` 이
   * 매 프레임 다시 먹이므로 여기서 건드리지 않아도 곧 따라온다.
   */
  function setQuality(level) {
    C().setTune('village3d.quality', level);
    if (renderer) {
      var q = QUALITY_PRESET[tier()];
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, q.dpr));
    }
    return tier();
  }

  var canvas = null, renderer = null, scene = null, camera = null;
  var ready = false, failed = false;

  /** 사람이 핀치·휠로 직접 조절하는 확대 — CAM_DIST()/CAM_HIGH() 손잡이와는 다른 값이다.
   *  1 이 기본(손잡이 값 그대로), 커지면 당겨서(확대) 가까이, 작아지면 물러나 멀리 본다 */
  var userZoom = 1;
  var USERZOOM_MIN = 0.5, USERZOOM_MAX = 2.2;
  var zoomPointers = {}, pinchDist0 = 0;

  /** 사람이 드래그로 돌리는 시점 — 걷는 방향(facingYaw)에 얹는 **덧각**이다.
   *  걸어도 안 지워진다(사가천하 국토지도의 자유회전과 같은 결). #map3d 는 3D 켜져
   *  있을 때 걷기가 키보드 몫이라 손가락 한 개 드래그를 그냥 시점 회전에 써도 된다 */
  var mouseYaw = 0;
  var YAW_SENS = 0.012;
  /** 세로 드래그로 잇는 시점 높이 — 0(어깨너머 3인칭)~1(3/4 부감/쿼터뷰) 연속값이다.
   *  세로 드래그로도, 🎥 버튼(2026-09-02 이후 추가, `game.js`)으로도 바뀐다.
   *  위로 끌면 부감(1)쪽으로, 아래로 끌면 어깨너머(0)쪽으로 자연스럽게 넘어간다.
   *  **2026-09-09 — 기본을 1(쿼터뷰)로 바꿨다.** 사가나락(`dg3d.tilt` 기본
   *  0.62, 이미 부감 쪽)와 시작 시점을 맞췄다 — 세이브에 안 묻는 세션 값이라
   *  매번 게임을 켤 때 이 값에서 시작한다(껐다 켜면 도로 1로 돌아온다) */
  var camTiltMix = 1;
  /** 2026-09-02 — 처음 값(0.0028, 끝까지 357px)은 실기기에서 짧게 몇 번 쓸어 올려서는
   *  1까지 안 닿았다("각도가 다르게 보인다"던 게 실은 t 가 중간에서 멎은 것이었다).
   *  손가락으로 한 번 쭉 그으면 끝까지 닿게 8 배 가까이 올렸다(125px 로 끝까지) */
  var TILT_SENS = 0.008;
  var dragId = null, dragLastX = 0, dragLastY = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function setCamTiltMix(v) { camTiltMix = clamp(v, 0, 1); }
  function zoomPointerCount() {
    var n = 0, k;
    for (k in zoomPointers) { if (Object.prototype.hasOwnProperty.call(zoomPointers, k)) { n++; } }
    return n;
  }
  function twoZoomPointerDist() {
    var ks = Object.keys(zoomPointers);
    if (ks.length < 2) { return 0; }
    var a = zoomPointers[ks[0]], b = zoomPointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function setUserZoom(z) { userZoom = clamp(z, USERZOOM_MIN, USERZOOM_MAX); }

  /** 확대·시점회전은 걷기 입력(#map3d 는 3D 켜져 있을 때 키보드로만 걷는다)과 안
   *  겹친다 — 휠(데스크톱)·두 손가락 핀치(폰)로 확대, 오른쪽 버튼 드래그(마우스)나
   *  한 손가락 드래그(폰)로 시점을 돌린다 */
  /* ── 3D 클릭 이동(2026-09-28, 실기 보고 Q12 "PC 에서 키보드 + 마우스 클릭(표시와 이동)") ──
   * 3D 가 켜지면 걷기는 키보드·조이스틱 몫이라 마우스 왼쪽이 비어 있었다(2D 는 누르면 그 자리로 걷는다).
   * 이제 왼쪽을 누르면 카메라 광선이 땅(y=0)에 닿는 곳으로 걷고, 누른 채 끌면 따라온다(2D 와 같은 결).
   * 터치는 한 손가락 끌기가 시점 회전이라 **짧은 탭**(0.3초·10px 안)만 걷기로 본다. 목표는 땅에 금빛 고리.
   * 3D 는 평평하다 — 마을 (x,y) → 3D ((x-px)·s, 0, (y-py)·s) 를 거꾸로 푼다(s = WORLD_SCALE) */
  function groundAt(clientX, clientY) {
    var t = three(), V = global.DG.village;
    if (!t || !camera || !canvas || !V) { return null; }
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) { return null; }
    var nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -((clientY - r.top) / r.height) * 2 + 1;
    camera.updateMatrixWorld();
    var o = camera.position.clone();
    var d = new t.Vector3(nx, ny, 0.5).unproject(camera).sub(o).normalize();
    if (d.y > -1e-4) { return null; }                    // 하늘을 짚었다
    var k = -o.y / d.y, s = WORLD_SCALE(), raw = V.raw();
    if (k > 600) { return null; }
    var X = o.x + d.x * k, Z = o.z + d.z * k;
    return { x: raw.player.x + X / s, y: raw.player.y + Z / s };
  }
  var walkPtr = null, tapPtr = null;
  function walkPick(e) {
    var g = groundAt(e.clientX, e.clientY), V = global.DG.village;
    if (g && V && V.walkTo) { V.walkTo(g.x, g.y); }
    return !!g;
  }
  /** 이 순간 카메라가 인물을 보는 방위(라디안) — camPose 의 az 그대로. 키·조이스틱을 이만큼 돌려
   *  "화면 위 = W" 가 되게 한다(village.js update). 오른쪽 끌기로 시점을 돌려도 W 는 화면 안쪽이다 */
  function camAz() { return mouseYaw + (1 - camTiltMix) * (facingYaw + Math.PI); }

  function bindCamControl(cv) {
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) { return; }
        walkPtr = e.pointerId;
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 안 되면 그대로 */ }
        walkPick(e);
        return;
      }
      tapPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
    });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerId === walkPtr && (e.buttons & 1)) { walkPick(e); }
      if (tapPtr && e.pointerId === tapPtr.id && Math.hypot(e.clientX - tapPtr.x, e.clientY - tapPtr.y) > 10) { tapPtr = null; }
    });
    function endWalk(e) {
      if (e.pointerId === walkPtr) {
        walkPtr = null;
        try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* 이문 없다 */ }
      }
      if (tapPtr && e.pointerId === tapPtr.id) {
        if (e.type === 'pointerup' && Date.now() - tapPtr.t < 300 && zoomPointerCount() <= 1) { walkPick(e); }
        tapPtr = null;
      }
    }
    cv.addEventListener('pointerup', endWalk);
    cv.addEventListener('pointercancel', endWalk);
    cv.addEventListener('wheel', function (e) {
      setUserZoom(userZoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') {
        if (e.button !== 2) { return; }         // 왼쪽은 그대로 비워 둔다(다른 조작과 안 겹치게)
        dragId = e.pointerId; dragLastX = e.clientX; dragLastY = e.clientY;
        return;
      }
      if (zoomPointerCount() === 0) { dragId = e.pointerId; dragLastX = e.clientX; dragLastY = e.clientY; }
      zoomPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (zoomPointerCount() === 2) { pinchDist0 = twoZoomPointerDist(); dragId = null; }
    });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerId === dragId) {
        mouseYaw -= (e.clientX - dragLastX) * YAW_SENS;
        /* 위로 끌면(clientY 가 줄어듦) 부감(1)쪽으로 — 그래서 부호를 뒤집는다 */
        setCamTiltMix(camTiltMix - (e.clientY - dragLastY) * TILT_SENS);
        dragLastX = e.clientX; dragLastY = e.clientY;
      }
      if (!zoomPointers[e.pointerId]) { return; }
      zoomPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (zoomPointerCount() === 2) {
        var nd = twoZoomPointerDist();
        if (pinchDist0 > 0 && nd > 0) { setUserZoom(userZoom * (nd / pinchDist0)); }
        pinchDist0 = nd;
      }
    });
    function endPointer(e) {
      if (e.pointerId === dragId) { dragId = null; }
      delete zoomPointers[e.pointerId];
      if (zoomPointerCount() < 2) { pinchDist0 = 0; }
    }
    cv.addEventListener('pointerup', endPointer);
    cv.addEventListener('pointercancel', endPointer);
  }

  var player = { group: null, mixer: null, actions: null, clipMap: null, action: null };
  var mount3 = { group: null, id: null, mixer: null, actions: null, clipMap: null, action: null, gen: 0 };   // 탈것(mount.js) 몸 — 탄 동안만 서고 내리면 치운다
  var lastPX = 0, lastPY = 0, haveLast = false, facingYaw = 0;

  /** village.js 사물 kind → asset3d 표의 kind. 여기 없는 kind는 3D 로 안 선다.
   *  deadTree·mossyRock·mushroom·bush·stump·log 는 PLAN 11절 Biome — 숲 고리에만
   *  나오고(village.js 의 BIOME_SCATTER), asset3d.js 에 이미 등록돼 있던 표라
   *  여기 줄만 보태면 그대로 선다 */
  var SCATTER_KIND = {
    tree: 'tree:common', pine: 'tree:pine', rock: 'rock', flower: 'flower', weed: 'grass',
    deadTree: 'tree:dead', mossyRock: 'rock:moss', mushroom: 'mushroom', herb: 'mushroom',
    bush: 'bush', stump: 'stump', log: 'log', plant: 'plant',
    tent: 'tent', campfire: 'campfire', bench: 'bench', well: 'well', lantern: 'lantern',
    mountain: 'mountain',
    /* 번들 시설(PLAN §5.3) — 새 GLB 없이 이미 등록된 키를 빌린다. 석비는 이끼 낀 선돌,
       반딧불이 정원은 덤불(밤엔 fireflyBoost 파티클이 위에 얹힌다). 조개 길은 소품이
       아니라 땅(`village.js` tileAt 의 모래)이다 */
    stele: 'rock:moss', fireflyplot: 'bush',
    /* 숲의 정령(PLAN §5.5) — 안 푼 터는 횃불(밤에 눈에 띄게), 푼 터는 꽃 한 송이 자국 */
    spiritmark: 'lantern', spiritdone: 'flower',
    /* 발견 밀도 격자(PLAN §5.5 ①) — 새 GLB 없이 기존 키를 빌린다: 상자=작은 상자, 병=풀 한 포기, 채집터=이끼 바위, 야영=천막+불 */
    oldpost: 'building:mail', starpost: 'lantern', rubble: 'rock:moss', rebuilt: 'gazebo',
    /* 축제 하루(PLAN §5.6) — 새 GLB 없이 기존 키: 안내판=표지판, 달집=모닥불, 줄=통나무, 솥=우물, 등롱=등 */
    festboard: 'building:board', festfire: 'campfire', festrope: 'log', festpot: 'well', festlantern: 'lantern',
    /* 방문객 조각(§5.9) — 새 GLB 없이: 나침반 조각=작은 상자, 도깨비불=등(밤에 빛난다) */
    visitcompass: 'building:mail', visitwisp: 'lantern', visitkid: 'bush', visitufo: 'building:mail', visitparcel: 'crate',
    gridchest: 'building:mail', gridbottle: 'plant', gridnode: 'rock:moss', gridcamp: 'tent', gridfire: 'campfire',
    /* 다리(2026-09-09) — asset3d.js 에 진작 등록만 되어 있던 'bridge' 를
       처음 쓴다(village.js 의 새 BRIDGE_TY 크로싱) */
    bridge: 'bridge',
    /* 짐승(PLAN 40절 PHASE 4 첫 칸) — village.js 의 raw().animals 도 이 표를
       그대로 타고 선다(아래 syncScatter() 가 props 배열에 이어 붙인다).
       토끼·다람쥐·오리·새(2026-09-09, PLAN 16절)는 data-village.js 의
       ANIMALS 에 새로 보탠 kind 라 이 한 줄씩만 이으면 그대로 선다 */
    deer: 'animal:an_deer', fox: 'animal:an_fox', wolf: 'animal:an_wolf',
    rabbit: 'animal:an_rabbit', squirrel: 'animal:an_squirrel',
    duck: 'animal:an_duck', bird: 'animal:an_bird',
    /* 개구리·뱀(2026-09-10, "동물들도 찾아봐") — mushroom·dark·rocky 바이옴이
       유독 짐승이 적어(mushroom 은 여우 하나뿐이었다) 보탰다 */
    frog: 'animal:an_frog', snake: 'animal:an_snake',
    /* 포자괴물(2026-09-10, "괴물이 나와도 되고" — 퓨전 방향) — village.js
       buildAnimals() 가 여우 대신 아주 드물게(8%) 세우는 버섯숲 전용 몬스터.
       다른 짐승과 같은 syncScatter()/Object Pool 경로를 그대로 탄다 */
    mushnub: 'monster:mushnub',
    /* 성간충(2026-09-14, PLAN 46-4 "다음에 이어갈 것") — village.js
       buildAnimals() 가 우주기지에만 아주 드물게(세이브 시드별 40%) 심는
       Enemy_Small 몬스터. mushnub 과 같은 syncScatter()/Object Pool 경로 */
    spacebug: 'monster:spacebug',
    /* 마을 3D 건물(PLAN 6절, 2026-09-09) — village.js `buildProps()`의 shop·
       board·home·mail·tailor·pole·museum kind 를 그대로 타고 선다. 마을당
       하나뿐인 고정 건물이라 나무처럼 변종을 섞지 않는다 */
    shop: 'building:shop', board: 'building:board', home: 'building:home',
    mail: 'building:mail', tailor: 'building:tailor', pole: 'building:pole',
    museum: 'building:museum', bench: 'building:bench',   // 제작대(W-0103) — 기존 Bench_1.glb
    /* 캠프 오두막(2026-09-09) — village.js buildProps() 의 hamletHouse kind 를
       그대로 타고 선다. 마을 건물과 같은 결(변종 없음, 자리 하나뿐).
       hamletHut(House_1)·hamletShed(House_3)는 같은 날 이어 얹은 두 번째·세
       번째 채 — kind 가 다르므로 역시 자리 하나뿐 규칙을 그대로 지킨다 */
    hamletHouse: 'building:hamletHouse', hamletHut: 'building:hamletHut',
    hamletShed: 'building:hamletShed',
    /* 두 번째 캠프(2026-09-09) — village.js buildProps() 의 hamlet2House kind.
       House_4, 첫 캠프의 세 채와 같은 결 */
    hamlet2House: 'building:hamlet2House',
    /* 폐허(2026-09-10, 퓨전 방향) — village.js buildProps() 의 ruinArch kind */
    ruinArch: 'ruin:arch',
    /* 폐허 확장(2026-09-11, PLAN 46-2절) — 진짜 탑성 폐허 스캔(building:ruinTower)
       과, 등록만 되고 여태 안 쓰이던 정자(gazebo, fence·cart가 그랬던 것과
       같은 결)를 폐허 자리에 처음 이었다 */
    ruinTower: 'building:ruinTower', gazebo: 'gazebo',
    /* 우주기지(PLAN 45절, 2026-09-11) — fence·cart는 asset3d.js에 진작
       등록만 되어 있던 것을 처음 쓴다(다리가 그랬던 것과 같은 결), crate는
       building:mail과 같은 파일을 새 kind로 쓴다 */
    crate: 'crate', fence: 'fence', cart: 'cart',
    /* 택배 접수대(PLAN 45절) — 마을 안 물건, mail(우편함)과 같은 파일을
       그대로 빌린다. courierPost는 deco:true가 아니라 syncScatter()가
       mail·shop 같은 마을 건물과 나란히 세운다 */
    courierPost: 'building:mail',
    /* 우주기지 확충(2026-09-14, PLAN 46-3절 "다음에 이어갈 것" — asset3d.js
       의 BLD_SPACE 주석 참고). 이 팩 자체의 건물·로버·메카를 처음 세운다 */
    spaceBase: 'building:spaceBase', spaceHouse: 'building:spaceHouse',
    spaceDome: 'building:spaceDome', solarPanel: 'solarPanel',
    rover: 'rover', mech: 'mech'
  };
  /** 2026-09-10 "움직이는 모션을 더 자연스럽게" — 이 표에 있는 kind만
   *  `syncScatter()`가 이동 방향으로 몸을 튼다. 나무·건물처럼 안 움직이는
   *  것까지 매 프레임 회전을 계산할 까닭이 없어 짐승 일곱 종만 추렸다 */
  var TURNING_KIND = {
    deer: 1, fox: 1, wolf: 1, rabbit: 1, squirrel: 1, duck: 1, bird: 1, frog: 1, snake: 1,
    mushnub: 1, spacebug: 1
  };
  /** 종류별로 실제 몇 미터로 세울까 — asset3d.build() 는 늘 키 1 로 눕혀 준다 */
  var SCATTER_H = {
    tree: 3.4, pine: 3.0, rock: 0.9, flower: 0.35, weed: 0.4,
    deadTree: 3.0, mossyRock: 0.9, mushroom: 0.5, herb: 0.5, bush: 0.8, stump: 0.6, log: 0.5, plant: 0.6,
    tent: 1.8, campfire: 0.5, bench: 0.5, well: 1.0, lantern: 1.6, mountain: 8.0,
    /* 다리(2026-09-09) — 정규화라 원본 비례는 모른다. 난간 높이쯤(well·lantern
       사이) 눈대중으로 잡았다 */
    bridge: 1.4,
    stele: 1.3, fireflyplot: 0.9, spiritmark: 1.5, spiritdone: 0.5,
    oldpost: 0.9, starpost: 2.0, rubble: 0.6, rebuilt: 1.1,
    festboard: 1.2, festfire: 0.5, festrope: 0.5, festpot: 1.0, festlantern: 1.6,
    visitcompass: 0.5, visitwisp: 0.9, visitkid: 0.9, visitufo: 0.45, visitparcel: 0.5,
    gridchest: 0.6, gridbottle: 0.35, gridnode: 0.9, gridcamp: 1.8, gridfire: 0.5,
    deer: 1.1, fox: 0.55, wolf: 0.95,
    rabbit: 0.3, squirrel: 0.25, duck: 0.35, bird: 0.2,
    /* 개구리·뱀 — 토끼·다람쥐보다도 작게, 땅에 붙어 다니는 쪽이라 낮게 잡았다 */
    frog: 0.18, snake: 0.15,
    /* 포자괴물 — 여우(0.55)보다 살짝 작게, 버섯 소품(mushroom 0.5)과 비슷한
       눈높이로 눈대중 잡았다 */
    mushnub: 0.5,
    /* 성간충 — 여우(0.55)보다 조금 작게, "Small" 이름값대로 눈대중 잡았다 */
    spacebug: 0.45,
    /* 건물 — home·tailor·museum(2026-09-19부터 Kenney Fantasy Town Kit
       킷배싱, 이전엔 PolyScan 실사 house_wooden 등)은 셋 다 비슷한 단층
       초가 비례라 키를 맞춰 나란히 서도 안 어색하다. signpost·
       banner_thin_red·box_small(KayKit)은 훨씬 작은 소품이라 낮게 잡는다 */
    shop: 3.0, home: 3.2, tailor: 2.8, museum: 3.4, board: 1.3, mail: 0.9, pole: 2.4, bench: 0.9,
    /* House_2·House_1·House_3(Quaternius) — 마을 건물(home 등,
       3.0~3.4m)보다 한 단 작게 잡아 "캠프의 소박한 오두막" 느낌을 준다.
       셋 다 정규화로 키 1 에서 시작하므로(build() 가 늘 그렇게 눕힌다) 실제
       원본 비례는 모른다 — 나란히 서도 다 같은 키로 안 보이게 일부러 조금씩
       다르게 잡았을 뿐이다 */
    hamletHouse: 2.4, hamletHut: 2.1, hamletShed: 2.3,
    /* House_4(Quaternius) — 두 번째 캠프의 유일한 채. 첫 캠프 셋과 같은
       눈대중 범위(2.1~2.4m) 안에서 살짝 다르게 잡았다 */
    hamlet2House: 2.2,
    /* 무너진 아치(Arch.glb) — 눈대중, 폐허 표지답게 나무보다는 낮고
       건물보다는 존재감 있게 */
    ruinArch: 2.6,
    /* 폐허 확장(2026-09-11, PLAN 46-2절) — 탑성 폐허(4층짜리 원본, 한쪽이
       무너진 실사 스캔)는 마을 건물(3.0~3.4)보다 확실히 높게, mountain(8.0)
       보다는 낮게 눈대중 잡았다. 정자(gazebo)는 쉼터 소품이라 well(1.0)
       정도 눈높이 */
    ruinTower: 4.4, gazebo: 1.1,
    /* 우주기지(PLAN 45절, 2026-09-11) — crate(box_small)는 mail(0.9)과
       같은 파일이라 같은 눈대중, fence·cart는 well(1.0)과 bench(0.5)
       사이 소품 눈대중 */
    crate: 0.9, fence: 1.1, cart: 0.9,
    /* 택배 접수대 — mail 과 같은 파일이니 같은 눈대중(0.9) */
    courierPost: 0.9,
    /* 우주기지 확충(2026-09-14, PLAN 46-3절) — 전부 정규화(키 1) 기준
       눈대중. spaceBase(본관)는 마을 건물(3.0~3.4)보다 조금 더 존재감
       있게, spaceHouse(오두막)는 캠프 오두막(2.1~2.4)과 비슷하게,
       spaceDome(측지돔)은 그 중간, solarPanel·rover는 낮은 소품·차량,
       mech는 사람 키보다 한 단 큰 로봇으로 잡았다 */
    spaceBase: 3.6, spaceHouse: 2.1, spaceDome: 2.6,
    solarPanel: 1.3, rover: 1.1, mech: 2.1
  };

  /**
   * 2026-09-09 — PLAN 40절 PHASE 7 "Scatter를 InstancedMesh로"를 좁혀서
   * 되살렸다(README "남은 일 표"에서 위험하다고 미뤄 뒀던 항목). 애니메이션·
   * 스켈레톤이 없는 이 여덟 종류만 대상이다 — 나무·바위·건물·짐승은 그림자
   * 개별 LOD(`applyShadowLOD`)·변종 다양성이 더 중요해 기존 Object Pool
   * 경로(아래 `scatter`/`scatterPool`)에 그대로 남긴다. 이 kind들은 `syncScatter()`
   * 루프에서 걸러지고(`if (INST_KIND[p.kind])` 체크), `syncInstScatter()`가 따로
   * 세운다 — `asset3d.partsFor()`가 프리미티브(재질 단위)를 주면 재질마다
   * InstancedMesh 하나를 만들어 같은 자리 행렬을 쓴다.
   */
  var INST_KIND = { weed: 1, flower: 1, mushroom: 1, herb: 1, plant: 1, stump: 1, log: 1, bush: 1 };

  /**
   * 2026-09-09 — 원작처럼 계절이 나무 겉모습을 바꾼다("남은 일 표"의
   * 가을·눈·자작나무 항목). `tree:common`(2D 'tree' kind)·`tree:pine`(2D 'pine'
   * kind) 둘만 대상이다 — 봄·여름은 기존 실사 나무 그대로(회귀 없음), 가을·겨울만
   * `asset3d.js`에 준비된 저다각형 표(`:autumn`/`:snow`, 자작나무는 tree:common
   * 쪽에 섞임)로 갈아 낀다. 고목 등은 계절 표가 따로 없어 그대로 둔다.
   */
  var SEASONAL_TREE_BASE = { 'tree:common': 1, 'tree:pine': 1 };
  function seasonalTreeKey(baseKey) {
    if (!SEASONAL_TREE_BASE[baseKey]) { return baseKey; }
    var VD = global.DG.villageData;
    if (!VD) { return baseKey; }
    var sk = VD.season().key;
    if (sk === 'autumn') { return baseKey + ':autumn'; }
    if (sk === 'winter') { return baseKey + ':snow'; }
    return baseKey;
  }
  var lastTreeSeason = null;
  /** 계절이 바뀌면 이미 지어 둔 'tree'·'pine' 인스턴스를 지운다 — 그대로 두면
   *  겨울에도 여름 나무가 계속 서 있는다(짓는 건 매번, 지우는 건 그룹이 실제로
   *  멀어질 때뿐이라). Object Pool 도 같이 비운다 — 지난 계절 모습을 다시 꺼내
   *  쓰면 안 된다 */
  function syncTreeSeason() {
    var VD = global.DG.villageData;
    var sk = VD ? VD.season().key : null;
    if (sk === lastTreeSeason) { return; }
    lastTreeSeason = sk;
    var id;
    for (id in scatter) {
      if (!Object.prototype.hasOwnProperty.call(scatter, id)) { continue; }
      if (scatter[id].kind !== 'tree' && scatter[id].kind !== 'pine') { continue; }
      if (scatter[id].group && scene) { scene.remove(scatter[id].group); }
      delete scatter[id];
    }
    scatterPool.tree = [];
    scatterPool.pine = [];
  }

  var scatter = {};   // propId → { group, kind, building, meshes, shadowOn }
  var npc3d = {};      // npc.id → { group, mixer, actions, clipMap, action, building }
  var res3d = {};      // resident.id(HEROES id) → { group, mixer, actions, clipMap, action, building, yaw, lastX, lastY }

  /**
   * 사물 재사용 창고(PLAN 40절 PHASE 7 Object Pool) — 걸어서 벗어난 나무·바위를
   * 그냥 버리지 않고 **같은 kind끼리** 쌓아 둔다. 인물이 온 길을 되짚어 걷는(왔다
   * 갔다 하는) 흔한 경우, 다시 지을 때 `asset3d.build()`(캐시 히트라 GLB 는
   * 새로 안 받지만 `cloneScene`·`normalize`(Box3 계산·traverse) 는 매번 다시
   * 돈다)를 또 부르지 않고 쌓아 둔 그룹을 그대로 꺼내 쓴다. GLB 표가 kind마다
   * 여러 변종(`oneOf`)을 섞어 골라도, 장식용 사물이라 변종이 살짝 바뀌어 보이는
   * 건 눈에 안 띈다 — 그 대신 재구성 비용을 통째로 아낀다.
   * 캡을 두는 건 무한정 쌓아 메모리를 먹지 않기 위해서다 — 캡을 넘으면
   * 그냥 버린다(진짜로 scene 에서 뺀다).
   */
  var scatterPool = {};        // kind → group[]
  var SCATTER_POOL_CAP = 24;
  function poolSize(kind) { return (scatterPool[kind] || []).length; }
  /** 순수(scene 없이도 동작) — group 은 `{visible}` 만 있으면 충분해 테스트가 mock 으로 확인한다 */
  function poolTake(kind) {
    var arr = scatterPool[kind];
    if (!arr || !arr.length) { return null; }
    var g = arr.pop();
    g.visible = true;
    return g;
  }
  function poolGive(kind, group) {
    var arr = scatterPool[kind] || (scatterPool[kind] = []);
    group.visible = false;
    if (arr.length >= SCATTER_POOL_CAP) {
      if (scene) { scene.remove(group); }   // 캡을 넘었다 — 안 쌓고 진짜로 치운다
      return;
    }
    arr.push(group);
  }

  /**
   * 거리 기반 그림자 LOD(PLAN 30절 "거리 기반 오브젝트 활성화" · PLAN 29절
   * "그림자 거리 제한") — 그림자는 렌더러에서 가장 비싼 항목 중 하나인데,
   * 화면 구석의 먼 나무 그림자는 눈에 잘 안 띈다. `SHADOW_R()` 안쪽만 그림자를
   * 드리우고 그 밖은 끈다(메시 지오메트리는 그대로라 "사라지는" 게 아니라
   * 그림자만 없어진다 — 이 판엔 저다각형 대타 메시가 없어 진짜 LOD 교체는
   * 못 한다는 PLAN 31절의 트레이드오프 그대로다).
   */
  function SHADOW_R() { return C().tuned('village3d.shadowR', 18); }
  /** 순수 함수 — 거리 d 가 반경 r 안이면 그림자를 켠다 */
  function wantShadowAt(d, r) { return d <= r; }
  function collectMeshes(g) {
    var list = [];
    g.traverse(function (o) { if (o.isMesh) { list.push(o); } });
    return list;
  }
  function applyShadowLOD(ent, d) {
    var want = wantShadowAt(d, SHADOW_R());
    if (ent.shadowOn === want) { return; }
    ent.shadowOn = want;
    var meshes = ent.meshes, i;
    if (!meshes) { return; }
    for (i = 0; i < meshes.length; i++) { meshes[i].castShadow = want; }
  }

  /** 타일 색 — villageData.TILES 에서 그대로 가져온다(2D 와 같은 색). floor(방 안)는
   *  마을 바닥에 안 나오니 뺀다. 색을 못 구하면(villageData 가 아직 안 실렸으면)
   *  이 표는 비고, 땅은 예전처럼 균일한 초록 한 장으로 남는다 */
  var TERRAIN_COLOR = null;
  function terrainColors() {
    if (TERRAIN_COLOR) { return TERRAIN_COLOR; }
    var VD = global.DG.villageData;
    if (!VD || !VD.TILES) { return {}; }
    TERRAIN_COLOR = {};
    var k;
    for (k in VD.TILES) {
      if (k === 'floor' || !Object.prototype.hasOwnProperty.call(VD.TILES, k)) { continue; }
      TERRAIN_COLOR[k] = VD.TILES[k].color;
    }
    return TERRAIN_COLOR;
  }
  var terrainMesh = {};     // kind → InstancedMesh
  var terrainCap = 0;       // 인스턴스 하나가 담을 수 있는 최대 칸 수
  var waterShader = null;   // onBeforeCompile 로 받아 둔 물결 셰이더(uTime 매 프레임 갱신용)
  var waterTime = 0;
  var waterRipple = null;           // 물결 반짝임 Points
  var waterRipplePos = null;        // Float32Array(cap*2) — 물 칸 중심의 (상대x,상대z)
  var waterRippleCount = 0;         // 이번에 실제로 채운 칸 수

  /** 타일 그림 — **2026-09-10 이전엔 2D 화면(village-view.js)과 같은
   *  Kenney tile_*.png 를 썼는데, 실제로 열어 보니 16x16 이 색 둘뿐인
   *  거의 단색 조각이었다(2026-09-02 커밋이 시트에서 잘라 오는 과정이
   *  깨져 있었던 것으로 보인다 — ASSET_LICENSES.md 는 여전히 "grass 그림"
   *  이라 적혀 있었지만 실물은 사실상 색 채우기와 다를 바 없었다).
   *  사용자가 "사가만리나 사가나락처럼"(둘 다 실제 CC0 사진 텍스처를 쓴다)
   *  요청해, 이미 저장소에 있는 CC0 1.0 텍스처를 **다른 판에서 그대로
   *  옮겨** 쓴다(그 판들도 opengameart/ambientCG/polyhaven CC0라 재배포
   *  제약이 없다) — 새로 받아오지 않았다:
   *   - grass  → `saga-go/assets/textures/land/grass1.webp`(ambientCG Grass005)
   *   - path   → `saga-go/assets/textures/land/road1.webp`(ambientCG Ground081, 흙길)
   *   - stone  → `saga-dungeon/assets/textures/dungeon/floor_stone.webp`(polyhaven)
   *  숲 고리 네 변종은 여전히 같은 grass 사진을 재질 색(`color`)으로 물들여
   *  쓴다. sand·water 는 이번엔 안 건드렸다(맞는 CC0 사진이 저장소에 없다 —
   *  다음에 손볼 때는 이 자리부터, 물은 어차피 위에 파동·반사 셰이더가
   *  덧입혀져 기본 그림 비중이 작다) */
  var TILE_TEX_SRC = {
    grass: 'assets/textures/land/grass.webp',
    grass_meadow: 'assets/textures/land/grass.webp',
    grass_dark: 'assets/textures/land/grass.webp',
    grass_mush: 'assets/textures/land/grass.webp',
    grass_rocky: 'assets/textures/land/grass.webp',
    path: 'assets/textures/land/dirt.webp',
    sand: 'assets/sprites2d/tile_sand.png',
    water: 'assets/sprites2d/tile_water.png',
    stone: 'assets/textures/land/stone.webp'
  };
  var tileTexCache = {};
  function tileTexture(kind) {
    var t = three();
    var src = TILE_TEX_SRC[kind];
    if (!src || !t) { return null; }
    if (tileTexCache[src]) { return tileTexCache[src]; }
    var tex = new t.TextureLoader().load(src);
    /* 예전엔 도트그림 보존용 NearestFilter 였는데, 이제 대부분 실사
       사진이라 LinearFilter + 밉맵으로 부드럽게 — 남은 sand·water 픽셀
       그림도 워낙 작아(16x16) 흐려져 보여도 눈에 띄지 않는다 */
    tex.magFilter = t.LinearFilter;
    tex.minFilter = t.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (t.SRGBColorSpace) { tex.colorSpace = t.SRGBColorSpace; }
    tileTexCache[src] = tex;
    return tex;
  }

  /** 바이옴별 하늘·안개 색(PLAN 11절 "색감"). green 은 예전부터 쓰던 하늘색 그대로 */
  var FOG_COLOR = { green: 0x8fc7e8, meadow: 0xbfe0a8, dark: 0x445a48, mushroom: 0x5f7a68, rocky: 0x9a988a };
  var curBiome = null, curPhase = null;
  var hemiLight = null, sunLight = null;
  var skyDome = null;

  /**
   * 시간대별 조명(PLAN 40절 PHASE 5 Day/Night — "처음에는 실제 시간 시스템까지
   * 만들 필요 없다. 간단한 day/night preset만 만든다" 그대로). `villageData.PHASES`
   * (2D 가 쓰는 그 표)의 key 를 그대로 받아 쓴다 — 새 시간 계산을 만들지 않는다.
   * dark 는 바이옴 하늘색에 곱하는 밝기(1 이 낮). sun/hemi 는 방향광/반구광 값이다.
   */
  var PHASE_DARK = { dawn: 0.55, day: 1.0, even: 0.7, night: 0.28 };
  var PHASE_SUN = {
    dawn:  { color: 0xffd9a0, intensity: 0.55 },
    day:   { color: 0xfff4e0, intensity: 1.0 },
    even:  { color: 0xff8a4a, intensity: 0.6 },
    night: { color: 0x8fa8ff, intensity: 0.2 }   // W-0145 0.12→0.2 — 밤 마을이 거의 검었다(평균 19/255)
  };
  var PHASE_HEMI = { dawn: 0.55, day: 0.9, even: 0.7, night: 0.7 };   // W-0112 저녁 0.6→0.7 · W-0145 밤 0.3→0.7(손잡이 village3d.nightHemi — 0.45 는 평균 24, 0.7 은 29.7 로 풀밭까지 읽힘. 하늘·안개는 PHASE_DARK 0.28 그대로라 밤으로 보인다)
  /** 날씨(PLAN 21절)도 하늘을 더 어둡히고 안개를 짙힌다(fog near/far 를 좁힌다) —
   *  clear 는 기준값(1) 그대로, cloud/rain/snow 순으로 점점 짙어진다 */
  var WEATHER_DARK = { clear: 1, cloud: 0.85, rain: 0.75, snow: 0.82 };   // W-0112 비 0.6→0.75 — 저녁×비가 0.36 까지 곱해져 마을이 안 읽혔다
  var WEATHER_FOG = { clear: 1, cloud: 0.85, rain: 0.5, snow: 0.68 };
  /* 2026-09-10 — "NPC가 여전히 안 보인다"는 재신고로 다시 보니, 2026-09-09
     카메라 거리 확대는 진짜 원인이 아니었다. 숲 NPC 여섯은 마을 중심에서
     67~113m 떨어진 고정 지형지물 자리에 서는데(호수·캠프·동굴 등), 안개
     먼 끝(far)이 160m 뿐이라 맑은 날에도 이미 절반 넘게 안개에 덮이고,
     비/눈이면(WEATHER_FOG 배율) far 가 80~125m 로 더 좁아져 가장 먼 나그네
     (113m)는 거의 안 보였다. NPC는 원래도 거리 컬링이 없어(주석 참고)
     장면엔 계속 세워지고 있었다 — 안개가 먹어 버렸을 뿐이다. far 를
     160→320 으로 넉넉히 늘려 맑은 날 기준 가장 먼 NPC도 안개 30%대로
     떨어지게 했다(다른 스캐터·지형 렌더 비용은 그대로 — fog 는 셰이더
     블렌딩 값이라 값만 바꿔도 공짜다) */
  var FOG_NEAR = 30, FOG_FAR = 320;
  var curWeatherSky = null;

  /** hex 색을 f(0~1)배 어둡게 — 순수 함수(진단에서 scene 없이도 확인 가능) */
  function darken(hex, f) {
    var r = Math.round(((hex >> 16) & 255) * f);
    var g = Math.round(((hex >> 8) & 255) * f);
    var b = Math.round((hex & 255) * f);
    return (r << 16) | (g << 8) | b;
  }

  /** hex 색을 f(0~1)만큼 흰색 쪽으로 — darken() 짝, 하늘 그라디언트 지평선 쪽에 쓴다 */
  function lighten(hex, f) {
    var r = Math.round(((hex >> 16) & 255) + (255 - ((hex >> 16) & 255)) * f);
    var g = Math.round(((hex >> 8) & 255) + (255 - ((hex >> 8) & 255)) * f);
    var b = Math.round((hex & 255) + (255 - (hex & 255)) * f);
    return (r << 16) | (g << 8) | b;
  }

  /** 시간대·날씨 밝기를 곱한 값 — 순수 함수 */
  function skyDark(ph, wk) {
    return (PHASE_DARK[ph] != null ? PHASE_DARK[ph] : 1) * (WEATHER_DARK[wk] != null ? WEATHER_DARK[wk] : 1);
  }

  /** 인물이 선 칸의 바이옴·시간대·날씨 중 하나라도 바뀔 때만 하늘·안개·조명을 새로 칠한다 */
  function syncSky() {
    var V = global.DG.village, VD = global.DG.villageData;
    if (!V || !V.biomeAt || !scene) { return; }
    /* 하늘 구는 카메라를 늘 둘러싸야 해서(원경 스카이박스) 색이 안 바뀌는
       프레임에도 위치만은 매번 옮긴다 — 바이옴 판정과 달리 카메라는 쉬지
       않고 움직인다 */
    if (skyDome && camera) { skyDome.position.copy(camera.position); }
    var raw = V.raw(), TILE = V.TILE;
    var b = V.biomeAt(Math.floor(raw.player.x / TILE), Math.floor(raw.player.y / TILE));
    var ph = (VD && VD.phaseOf) ? VD.phaseOf(new Date().getHours()).key : 'day';
    var wk = (VD && VD.weather) ? VD.weather().key : 'clear';
    if (b === curBiome && ph === curPhase && wk === curWeatherSky) { return; }
    curBiome = b; curPhase = ph; curWeatherSky = wk;
    var c = darken(FOG_COLOR[b] || FOG_COLOR.green, skyDark(ph, wk));
    scene.background.setHex(c);
    if (scene.fog) {                    // 꺼져 있으면(기본) 안개 자체가 없다
      scene.fog.color.setHex(c);
      var fogMul = WEATHER_FOG[wk] != null ? WEATHER_FOG[wk] : 1;
      scene.fog.near = FOG_NEAR * fogMul;
      scene.fog.far = FOG_FAR * fogMul;
    }
    if (skyDome) {
      skyDome.visible = SKY_ON();
      skyDome.material.uniforms.bottomColor.value.setHex(lighten(c, 0.35));
      skyDome.material.uniforms.topColor.value.setHex(darken(c, 0.55));
    }
    var sunCfg = PHASE_SUN[ph] || PHASE_SUN.day;
    if (sunLight) { sunLight.color.setHex(sunCfg.color); sunLight.intensity = sunCfg.intensity * (WEATHER_DARK[wk] != null ? WEATHER_DARK[wk] : 1); }
    if (hemiLight) { hemiLight.intensity = (ph === 'night' ? C().tuned('village3d.nightHemi', PHASE_HEMI.night) : PHASE_HEMI[ph] != null ? PHASE_HEMI[ph] : 0.9) * (WEATHER_DARK[wk] != null ? WEATHER_DARK[wk] : 1); }
  }

  /** 비/눈은 날씨 키가 그대로, 반딧불이(PLAN 22절)는 맑은 밤에만 — 순수 함수라 scene 없이도 확인된다 */
  function weatherShows(wk) { return { rain: wk === 'rain', snow: wk === 'snow' }; }
  function fireflyVisible(ph, wk) { return ph === 'night' && wk !== 'rain' && wk !== 'snow'; }

  /** 유성(PLAN 20절 "랜덤 이벤트" 예시, 2D 는 `town.js`의 `starNow()`+
   *  `village-view.js`의 `drawShootingStar()`로 이미 있다) — **같은 근원
   *  (town.starNow)** 을 3D 궤적으로 바꾸는 순수 함수. 새 난수·새 판정을
   *  만들지 않는다 — 2D 화면과 3D 화면이 늘 같은 순간에 같은 별을 본다.
   *  st 가 null(별이 안 흐르는 시각)이면 null. 있으면 st.x/st.y(자리 해시)를
   *  하늘 한 바퀴(각도)와 높이로, st.t(진행률 0~1)를 궤적 위의 위치와
   *  밝기(2D 와 같은 식 — 가운데서 가장 밝고 양끝에서 사라진다)로 편다 */
  var METEOR_R = 34, METEOR_H_MIN = 12, METEOR_H_SPREAD = 9, METEOR_DIST = 16;
  function meteorPose(st) {
    if (!st) { return null; }
    var ang = st.x * Math.PI * 2;
    var dirX = Math.cos(ang), dirZ = Math.sin(ang);
    var travel = (st.t - 0.5) * METEOR_DIST;
    return {
      x: dirX * METEOR_R + dirX * travel,
      y: METEOR_H_MIN + st.y * METEOR_H_SPREAD - st.t * 3.5,
      z: dirZ * METEOR_R + dirZ * travel,
      dirX: dirX, dirY: -0.55, dirZ: dirZ,
      alpha: Math.max(0, 1 - Math.abs(st.t - 0.5) * 1.6)
    };
  }

  /** 물결(PLAN 12절) — 칸의 세계 좌표(wx,wz)와 시각(time)만으로 그 칸이 지금
   *  얼마나 솟았는지 준다. **물 셰이더(GLSL, `waterMaterial()`)와 같은 식**을
   *  써서 반짝임 점(`syncWaterRipple`)이 실제 파동과 같은 위상으로 움직인다 —
   *  둘이 따로 놀면 반짝임이 물결과 어긋나 보인다. 순수 함수 */
  function waterWaveY(wx, wz, time) {
    return Math.sin((wx + wz) * WATER_WAVE_FREQ() + time * WATER_WAVE_SPEED()) * WATER_WAVE_AMP();
  }

  /** base(시작값) 에서 elapsed*speed 만큼 떨어뜨리고 height 로 감는다(modulo) —
   *  매 프레임 새 난수를 안 뽑고도 자연스럽게 반복 낙하한다. 순수 함수 */
  function wrapY(base, elapsed, speed, height) {
    var y = base - elapsed * speed;
    return ((y % height) + height) % height;
  }

  var WEATHER_FX = { rain: null, snow: null, firefly: null, fireflyBoost: null };
  var weatherClock = 0;
  var RAIN_N = 140, RAIN_H = 14, RAIN_SPEED = 9;
  var SNOW_N = 90, SNOW_H = 12, SNOW_SPEED = 1.6;
  /* 2026-09-19 — "고품질 셀 셰이딩급" 요청 이어서 파티클 확장: 40→64. Points 는 드로우콜
     하나뿐이라(정점 수만 늘어남) 이 정도 증가는 QUALITY_PRESET 등급과 무관하게
     저사양에서도 무리 없다고 보고 등급별 분기는 안 뒀다 — 체감 무거우면
     다음에 QUALITY_PRESET 표에 편입 */
  var FIREFLY_N = 64, FIREFLY_R = 18, FIREFLY_H = 3.2;
  /* PLAN §5.3 "밤 파티클 배율 ×3" — 사고 곤충 갈래를 다 채우면 서는
     반딧불이 정원(`fireflyplot`)만의 국지 무리. 앰비언트 반딧불이(위
     `FIREFLY_N` 셋)는 언제나 인물 둘레에 고르게 흩어지는데, 정원은
     "그 자리에 몰려든다"는 인상을 줘야 해서 훨씬 좁은 반경에 따로
     한 무리를 더 얹는다 — 두 무리를 합치면 그 자리만 유독 짙어 보인다.
     정확한 밀도 배율(×3)을 식으로 맞추기보다 **눈에 띄는 고정 수**를
     골랐다(실기 확인 전까지는 숫자 자체가 정답인지 알 수 없다). */
  var FIREFLY_BOOST_N = 36, FIREFLY_BOOST_R = 5, FIREFLY_BOOST_H = 2.4;

  /** 반딧불이 전용 부드러운 발광 스프라이트 — 캔버스 방사형 그라디언트 하나를
   *  런타임에 구워(별도 이미지 자산 없음) `PointsMaterial.map`으로 쓴다.
   *  가산 블렌딩과 같이 쓰면 각진 사각/원 점 대신 "밤에 번지는 빛" 인상을
   *  준다 — 비·눈은 그대로 예전 딱딱한 점(빗방울·눈은 오히려 또렷해야
   *  자연스럽다). `document` 가 없는 자리(자가진단 등)에선 조용히 null. */
  var fireflyGlowTex = null;
  function fireflyGlow(t) {
    if (fireflyGlowTex) { return fireflyGlowTex; }
    if (typeof document === 'undefined' || !document.createElement) { return null; }
    var size = 64, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    if (!ctx) { return null; }
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    fireflyGlowTex = new t.CanvasTexture(cv);
    return fireflyGlowTex;
  }

  /**
   * 비·눈·반딧불이 파티클(PLAN 21·22절)을 미리 지어 둔다. **인물은 늘
   * 원점(0,0,0)** 이므로 이 파티클도 원점 중심으로 흩뿌리면 따로 위치를
   * 옮기지 않아도 늘 인물 둘레에 보인다 — 실제로 바뀌는 건 낙하(y)뿐이다.
   */
  function buildWeatherFX(t) {
    var area = RENDER_R() * 1.3;

    function makePoints(n, spreadXZ, spreadY, size, color, opacity, glow) {
      var geo = new t.BufferGeometry();
      var pos = new Float32Array(n * 3);
      var base = new Float32Array(n);
      var i;
      for (i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() * 2 - 1) * spreadXZ;
        pos[i * 3 + 2] = (Math.random() * 2 - 1) * spreadXZ;
        base[i] = Math.random() * spreadY;
        pos[i * 3 + 1] = base[i];
      }
      geo.setAttribute('position', new t.BufferAttribute(pos, 3));
      var matOpts = { color: color, size: size, transparent: true, opacity: opacity, depthWrite: false };
      if (glow) {
        var tex = fireflyGlow(t);
        if (tex) { matOpts.map = tex; matOpts.blending = t.AdditiveBlending; matOpts.vertexColors = true; }
      }
      var mat = new t.PointsMaterial(matOpts);
      var pts = new t.Points(geo, mat);
      pts.visible = false;
      pts.userData.base = base;
      pts.userData.spreadY = spreadY;
      /* 반딧불이 반짝임(§ "고품질 셀 셰이딩급" 요청 이어서) — 정점색을 밝기 스칼라로
         써서(vertexColors, 세 채널 같은 값) 재질 고유색(노란빛)에 곱해진다.
         `floatStep(pts, true)` 가 매 프레임 이 값을 위아래 흔들림과 같은
         sin 계열로 다시 먹인다(위상만 다르게 줘 흔들림과 안 겹친다) */
      if (glow && matOpts.vertexColors) {
        var col = new Float32Array(n * 3);
        for (i = 0; i < n * 3; i++) { col[i] = 1; }
        geo.setAttribute('color', new t.BufferAttribute(col, 3));
      }
      scene.add(pts);
      return pts;
    }

    WEATHER_FX.rain = makePoints(RAIN_N, area, RAIN_H, 0.06, 0x9fc3e8, 0.55, false);
    WEATHER_FX.snow = makePoints(SNOW_N, area, SNOW_H, 0.14, 0xffffff, 0.9, false);
    WEATHER_FX.firefly = makePoints(FIREFLY_N, FIREFLY_R, FIREFLY_H, 0.28, 0xf6ef8a, 0.9, true);
    /* 정원 무리는 원점(인물)이 아니라 `fireflyplot`의 **세계 좌표**를 따라
       다녀야 하므로 `makePoints()`(늘 원점 중심)로 짓고 매 프레임
       `syncWeatherFX()`가 그 자리로 그룹을 옮긴다(스캐터 소품과 같은 요령,
       `syncScatter()`의 `(p.x-px)*scale` 변환 참고). */
    WEATHER_FX.fireflyBoost = makePoints(FIREFLY_BOOST_N, FIREFLY_BOOST_R, FIREFLY_BOOST_H, 0.28, 0xf6ef8a, 0.95, true);
  }

  /** PLAN §5.3 — 사고 곤충 갈래를 다 채우면 서는 그 시설을 찾는다(고정 자리
   *  하나뿐이지만 배열 전체를 본다). 순수 함수 — scene 없이도 값으로
   *  검증된다. */
  function fireflyPlotOf(props) {
    for (var i = 0; i < props.length; i++) { if (props[i].kind === 'fireflyplot') { return props[i]; } }
    return null;
  }

  var meteorGroup, meteorHead, meteorTail, meteorUpVec, meteorDirVec, METEOR_TAIL_LEN = 2.6;

  /** 유성(PLAN 20절) — 머리(작은 구, 자체발광) + 꼬리(뾰족한 원뿔, 진행
   *  반대 방향으로 눕혀 광원 없이도 빛나 보이게 `MeshBasicMaterial`+가산
   *  블렌딩) 한 벌만 미리 지어 두고 매 프레임 자리·밝기만 바꾼다(비/눈처럼
   *  파티클 다시 만들지 않는다 — 늘 하나뿐이라 그럴 필요가 없다) */
  function buildMeteor(t) {
    meteorGroup = new t.Group();
    meteorHead = new t.Mesh(
      new t.SphereGeometry(0.16, 8, 8),
      new t.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, depthWrite: false })
    );
    meteorTail = new t.Mesh(
      new t.ConeGeometry(0.13, METEOR_TAIL_LEN, 8, 1, true),
      new t.MeshBasicMaterial({
        color: 0xfff7d6, transparent: true, opacity: 0.55, depthWrite: false,
        blending: t.AdditiveBlending
      })
    );
    meteorTail.position.y = -METEOR_TAIL_LEN / 2;   // 원뿔 끝(반지름 0)이 머리에 붙고, 밑동이 뒤로 눕는다
    meteorGroup.add(meteorHead);
    meteorGroup.add(meteorTail);
    meteorGroup.visible = false;
    scene.add(meteorGroup);
    meteorUpVec = new t.Vector3(0, 1, 0);
    meteorDirVec = new t.Vector3();
  }

  /** 유성 — `town.starNow()`(2D 와 같은 근원)를 매 프레임 읽어 `meteorPose()`로
   *  자리·방향·밝기만 바꾼다. 흐르지 않는 대부분의 시간엔 group 을 숨길 뿐
   *  아무 계산도 안 한다 */
  function syncMeteor() {
    if (!meteorGroup) { return; }
    var Town = global.DG.town;
    var pose = meteorPose(Town && Town.starNow ? Town.starNow() : null);
    if (!pose) { meteorGroup.visible = false; return; }
    meteorGroup.visible = true;
    meteorGroup.position.set(pose.x, pose.y, pose.z);
    meteorDirVec.set(pose.dirX, pose.dirY, pose.dirZ).normalize();
    meteorGroup.quaternion.setFromUnitVectors(meteorUpVec, meteorDirVec);
    meteorHead.material.opacity = pose.alpha;
    meteorTail.material.opacity = pose.alpha * 0.55;
  }

  function fallStep(pts, speed) {
    var pos = pts.geometry.attributes.position, base = pts.userData.base, h = pts.userData.spreadY;
    for (var i = 0; i < base.length; i++) { pos.array[i * 3 + 1] = wrapY(base[i], weatherClock, speed, h); }
    pos.needsUpdate = true;
  }

  function floatStep(pts, twinkle) {
    var pos = pts.geometry.attributes.position, base = pts.userData.base;
    var col = twinkle ? pts.geometry.attributes.color : null;
    for (var i = 0; i < base.length; i++) {
      pos.array[i * 3 + 1] = base[i] + Math.sin(weatherClock * 0.8 + i) * 0.4 + 0.6;
      if (col) {
        /* 위상을 위아래 흔들림(0.8·+i)과 다르게(1.3·+i*1.7) 줘 밝기가 높이와
           박자를 맞춰 기계적으로 안 보이게 했다. 0.45~1.0 사이로만 어둡혀
           아예 안 보이는 순간은 없게(반딧불이가 완전히 꺼지면 사라진 것
           처럼 보인다) */
        var v = 0.725 + Math.sin(weatherClock * 1.3 + i * 1.7) * 0.275;
        col.array[i * 3] = col.array[i * 3 + 1] = col.array[i * 3 + 2] = v;
      }
    }
    pos.needsUpdate = true;
    if (col) { col.needsUpdate = true; }
  }

  /** 백중 불꽃(PLAN §5.6) — 등롱 셋을 다 밝히면(`festival.js` `complete()`가
   *  이미 쏘는 `village:fest` 를 그대로 듣는다, §5.8① 낚시 줌과 같은 결로
   *  festival.js 는 안 건드림) 하늘에 불꽃 세 발이 터진다. 새 GLB·이미지
   *  없이 반딧불이와 같은 Points 파티클을 한 발짜리 폭죽으로 돌려 쓴다 —
   *  다만 반딧불이(떠다님)와 달리 위로 쏘아 올렸다가 중력으로 퍼지며
   *  꺼지는 "터짐" 한 번뿐이라 슬롯을 셋(동시에 세 발) 미리 지어 둔다. */
  var FIREWORK_N = 40, FIREWORK_LIFE = 1.1, FIREWORK_GRAV = 2.4;
  var FIREWORK_COLORS = [[1, 0.55, 0.25], [1, 0.88, 0.35], [0.55, 0.82, 1], [1, 0.42, 0.6]];
  var fireworkBursts = [];   // { pts, t(연소 남은 시간, -1=꺼짐), queued(터지기까지 남은 시간, -1=대기 없음) }
  function buildFireworkBurst(t) {
    var geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.BufferAttribute(new Float32Array(FIREWORK_N * 3), 3));
    geo.setAttribute('color', new t.BufferAttribute(new Float32Array(FIREWORK_N * 3), 3));
    var matOpts = { size: 0.22, transparent: true, opacity: 0, vertexColors: true, depthWrite: false, blending: t.AdditiveBlending };
    var tex = fireflyGlow(t);
    if (tex) { matOpts.map = tex; }
    var pts = new t.Points(geo, new t.PointsMaterial(matOpts));
    pts.visible = false;
    pts.userData.vel = new Float32Array(FIREWORK_N * 3);
    scene.add(pts);
    return pts;
  }
  /** 3발 슬롯을 처음 쓸 때 짓는다(init() 을 거치지 않는 자가진단 등에서도
   *  scene 이 있으면 안전하게 늦게 지을 수 있게, buildWeatherFX 와 달리
   *  지연 생성으로 뒀다) */
  function ensureFireworkBursts(t) {
    while (fireworkBursts.length < 3) { fireworkBursts.push({ pts: buildFireworkBurst(t), t: -1, queued: -1 }); }
  }
  function fireBurst(b) {
    var pos = b.pts.geometry.attributes.position.array, col = b.pts.geometry.attributes.color.array, vel = b.pts.userData.vel;
    var c = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    var y = 5 + Math.random() * 1.5, i, a, sp;
    for (i = 0; i < FIREWORK_N; i++) {
      a = Math.random() * Math.PI * 2; sp = 1.8 + Math.random() * 2.2;
      pos[i * 3] = (Math.random() - 0.5) * 3; pos[i * 3 + 1] = y; pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
      vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = (Math.random() - 0.15) * 2.2; vel[i * 3 + 2] = Math.sin(a) * sp;
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.geometry.attributes.color.needsUpdate = true;
    b.pts.material.opacity = 1;
    b.pts.visible = true;
    b.t = FIREWORK_LIFE;
  }
  /** `village:fest`(백중 완성) 리스너가 부른다 — 세 발을 살짝 시차를 두고 예약 */
  function triggerFirework() {
    if (!scene || !three()) { return; }
    ensureFireworkBursts(three());
    fireworkBursts[0].queued = 0; fireworkBursts[1].queued = 0.55; fireworkBursts[2].queued = 1.15;
  }
  function stepFirework(dt) {
    for (var i = 0; i < fireworkBursts.length; i++) {
      var b = fireworkBursts[i];
      if (b.queued >= 0) {
        b.queued -= dt;
        if (b.queued <= 0) { b.queued = -1; fireBurst(b); }
        continue;
      }
      if (b.t < 0) { continue; }
      b.t -= dt;
      var pos = b.pts.geometry.attributes.position.array, vel = b.pts.userData.vel;
      for (var j = 0; j < FIREWORK_N; j++) {
        pos[j * 3] += vel[j * 3] * dt;
        pos[j * 3 + 1] += vel[j * 3 + 1] * dt; vel[j * 3 + 1] -= FIREWORK_GRAV * dt;
        pos[j * 3 + 2] += vel[j * 3 + 2] * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, b.t / FIREWORK_LIFE);
      if (b.t <= 0) { b.pts.visible = false; b.t = -1; }
    }
  }

  /** 물결 반짝임 점(PLAN 12절) 창고 — 자리는 `syncTerrain()`이 물 칸을 세우는
   *  김에 채워 준다(`waterRipplePos`). 칸 수 상한은 `terrainCap`처럼 초기화
   *  때 한 번만 정한다 */
  function buildWaterRipple(t) {
    var cap = WATER_RIPPLE_CAP();
    var geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.BufferAttribute(new Float32Array(cap * 3), 3));
    var mat = new t.PointsMaterial({ color: 0xeaf7ff, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false });
    waterRipple = new t.Points(geo, mat);
    waterRipple.visible = false;
    waterRipplePos = new Float32Array(cap * 2);   // (상대x,상대z) 쌍 — syncTerrain() 이 채운다
    waterRippleCount = 0;
    scene.add(waterRipple);
  }

  /** 물결(PLAN 12절) — 매 프레임(움직임 여부와 무관하게) 물 재질의 파동
   *  유니폼과 반짝임 점 높이를 시각(waterTime)으로 갱신한다. **자리 자체는
   *  안 다시 계산한다** — `syncTerrain()`이 채워 둔 `waterRipplePos`(물 칸이
   *  움직일 때만 갱신)를 그대로 읽고 y 하나만 `waterWaveY()`로 다시 잰다,
   *  그래서 서 있을 때도 물결은 돌지만 자리 재계산(비싼 쪽)은 안 한다 */
  function syncWaterRipple(dt) {
    waterTime += dt;
    if (waterShader) { waterShader.uniforms.uTime.value = waterTime; }
    if (!waterRipple) { return; }
    if (!waterRippleCount) { waterRipple.visible = false; return; }
    waterRipple.visible = true;
    var pos = waterRipple.geometry.attributes.position, rx, rz, i;
    for (i = 0; i < waterRippleCount; i++) {
      rx = waterRipplePos[i * 2]; rz = waterRipplePos[i * 2 + 1];
      pos.array[i * 3] = rx;
      pos.array[i * 3 + 1] = waterWaveY(rx, rz, waterTime) - WATER_DEPTH() + 0.05;
      pos.array[i * 3 + 2] = rz;
    }
    waterRipple.geometry.setDrawRange(0, waterRippleCount);
    pos.needsUpdate = true;
  }

  /** 날씨(town.js 의 그것)·시간대에 맞춰 파티클을 켜고 끈다 */
  function syncWeatherFX(dt) {
    if (!scene) { return; }
    var VD = global.DG.villageData;
    var wk = (VD && VD.weather) ? VD.weather().key : 'clear';
    weatherClock += dt;
    var shows = weatherShows(wk);
    var fly = fireflyVisible(curPhase, wk);

    if (WEATHER_FX.rain) {
      WEATHER_FX.rain.visible = shows.rain;
      if (shows.rain) { fallStep(WEATHER_FX.rain, RAIN_SPEED); }
    }
    if (WEATHER_FX.snow) {
      WEATHER_FX.snow.visible = shows.snow;
      if (shows.snow) { fallStep(WEATHER_FX.snow, SNOW_SPEED); }
    }
    if (WEATHER_FX.firefly) {
      WEATHER_FX.firefly.visible = fly;
      if (fly) { floatStep(WEATHER_FX.firefly, true); }
    }
    if (WEATHER_FX.fireflyBoost) {
      var V = global.DG.village, plot = null, raw = null, scale = WORLD_SCALE();
      if (fly && V) {
        raw = V.raw();
        var cullU = CULL_R() / scale;
        plot = fireflyPlotOf(raw.props);
        if (plot && Math.hypot(plot.x - raw.player.x, plot.y - raw.player.y) > cullU) { plot = null; }
      }
      WEATHER_FX.fireflyBoost.visible = !!plot;
      if (plot) {
        WEATHER_FX.fireflyBoost.position.set((plot.x - raw.player.x) * scale, 0, (plot.y - raw.player.y) * scale);
        floatStep(WEATHER_FX.fireflyBoost, true);
      }
    }
    stepFirework(dt);
  }

  /** three 자체가 없거나(파일 못 받음) WebGL 컨텍스트를 못 만들면 false */
  function available() { return !!three() && !failed; }
  /** 지금 화면에 이게 그려지고 있나 — 손잡이 + 초기화 성공 둘 다 참이어야 한다.
   *  **2026-09-10 고침** — 집·동굴 안(`indoors()`/`caveInside()`)은 이 3D
   *  화면이 전혀 모른다(방 자체를 3D로 세우지 않는다, PLAN에도 없다). 그런데
   *  `player.x/y`는 집·동굴 안에서도 **같은 칸**(문 앞 좌표)을 재사용하다 보니
   *  (`village.js`의 `enterHome()` 주석) 3D 를 기본으로 켠 채 집·동굴에
   *  들어가면 문 앞 바깥 풍경이 얼어붙은 채로 계속 떠 있고, 정작 방 안(가구·
   *  보물상자)은 어디에도 안 보였다 — 2D 캔버스가 `syncVisibility()`로 아예
   *  가려져 있었기 때문. 실내에선 3D를 끈 것처럼 굴어 2D 쪽(실제로 방을
   *  그리는 유일한 화면)이 저절로 앞에 나서게 한다 — 나가면 `step()`이
   *  매 프레임 다시 이 값을 보므로 따로 이벤트를 안 걸어도 곧바로 돌아온다. */
  /** 순수 함수로 뺐다 — `ready`(실제 WebGL 초기화 성공)와 무관하게 "지금 실내라서
   *  눌렸다"만 진단이 볼 수 있게. 자가진단은 `init()`을 안 부르므로(`DG_NO_DRAW`)
   *  `ready`가 늘 false라 `active()`만으로는 이 갈래를 확인할 수 없다 */
  function indoorSuppressed() {
    var V = global.DG.village;
    return !!(V && (V.indoors() || V.caveInside()));
  }
  function active() {
    if (!ON() || !ready) { return false; }
    return !indoorSuppressed();
  }

  /** HDRI 환경광(IBL) — Poly Haven CC0 "Alps Field"(사철 무료, 로그인 없이 받음).
   *  2026-09-02 사용자가 "사실처럼" 을 요청해 얹었다. **하늘 색은 안 바꾼다** —
   *  `scene.background` 는 그대로 바이옴별 단색(`syncFog`)에 맡기고, `scene.environment`
   *  에만 물려 반사·PBR 조명만 사실적으로 만든다. 실패해도(HDR 못 받음 등) 그냥
   *  옛 HemisphereLight+DirectionalLight 만으로 돈다 — 여기서도 "안 되면 조용히
   *  넘어간다" 원칙을 지킨다 */
  var HDRI_SRC = 'assets/hdri/alps_field_1k.hdr';
  function loadEnvironment(t) {
    if (!t.RGBELoader || !renderer) { return; }
    var pmrem = new t.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new t.RGBELoader().load(HDRI_SRC, function (hdr) {
      var envMap = pmrem.fromEquirectangular(hdr).texture;
      if (scene) { scene.environment = envMap; }
      hdr.dispose();
      pmrem.dispose();
    }, undefined, function () {
      pmrem.dispose();   // 못 받아도 조용히 — 옛 조명만으로 그대로 돈다
    });
  }

  /** 하늘 그라디언트 구(§ SKY_ON) — 카메라를 둘러싼 큰 뒤집힌 구 하나에
   *  수직 그라디언트 셰이더만 얹는다(텍스처·추가 지오메트리 없음, 드로우콜
   *  +1). `syncSky()`가 매 프레임 카메라 위치로 옮기고(항상 시야를 둘러싸게),
   *  바이옴·시간대·날씨가 바뀔 때만 위/아래 색을 새로 먹인다. 반지름
   *  380(카메라 far=400보다 안쪽, 가장 먼 지형·NPC(~113m)보다 훨씬 밖) —
   *  실제 3D 오브젝트라 별도 깊이 트릭 없이 거리로 자연히 맨 뒤에 선다. */
  function makeSkyDome(t) {
    if (!t) { return null; }
    var geo = new t.SphereGeometry(380, 24, 16);
    var mat = new t.ShaderMaterial({
      uniforms: {
        topColor: { value: new t.Color(0x4a7fd1) },
        bottomColor: { value: new t.Color(0xdcefff) },
        exponent: { value: 0.7 }
      },
      vertexShader: [
        'varying vec3 vWorldPos;',
        'void main() {',
        '  vWorldPos = ( modelMatrix * vec4( position, 1.0 ) ).xyz;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor;',
        'uniform vec3 bottomColor;',
        'uniform float exponent;',
        'varying vec3 vWorldPos;',
        'void main() {',
        '  float h = normalize( vWorldPos ).y;',
        '  float k = pow( max( h, 0.0 ), exponent );',
        '  gl_FragColor = vec4( mix( bottomColor, topColor, k ), 1.0 );',
        '}'
      ].join('\n'),
      side: t.BackSide,
      fog: false
    });
    var mesh = new t.Mesh(geo, mat);
    mesh.matrixAutoUpdate = true;
    mesh.visible = SKY_ON();
    return mesh;
  }

  function init(cv) {
    var t = three();
    canvas = cv;
    if (!t || !canvas) { failed = true; return; }
    try {
      renderer = new t.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch (e) { failed = true; return; }
    /* PLAN 38절 "모바일 품질 프리셋" — 켤 때 한 번 기기를 보고 고른 등급(low/medium/high)이
       픽셀비·그림자를 함께 정한다(등급이 세 갈래인데 손잡이를 따로 두면 조합이 어긋난다,
       사가나락 dungeon3d.js 의 QUALITY_PRESET과 같은 이유) */
    var q = QUALITY_PRESET[tier()];
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, q.dpr));
    /* 실사 텍스처(사람 Mixamo·나무껍질 등)가 톤매핑 없이 밋밋하게 뜨는 것을 막는다.
       색공간도 sRGB 로 맞춘다 — 안 맞으면 텍스처가 흐리게(감마 안 먹은 채로) 뜬다 */
    /* 2026-09-23 — ACES → Neutral(SAGA-DESIGN §6.1, 다른 판 post3d 와 같은 곡선). ACES 는 VRoid 인물 살색을
       회백색으로 탈색시키고 채도를 눌렀다(같은 장면 두 곡선 스크린샷 비교) */
    if (t.NeutralToneMapping) { renderer.toneMapping = t.NeutralToneMapping; }
    else if (t.ACESFilmicToneMapping) { renderer.toneMapping = t.ACESFilmicToneMapping; }
    renderer.toneMappingExposure = 1.0;
    if (t.SRGBColorSpace) { renderer.outputColorSpace = t.SRGBColorSpace; }
    renderer.shadowMap.enabled = q.shadow;
    if (t.PCFSoftShadowMap) { renderer.shadowMap.type = t.PCFSoftShadowMap; }

    scene = new t.Scene();
    scene.background = new t.Color(0x8fc7e8);
    scene.fog = FOG_ON() ? new t.Fog(0x8fc7e8, FOG_NEAR, FOG_FAR) : null;
    skyDome = makeSkyDome(t);
    if (skyDome) { scene.add(skyDome); }

    camera = new t.PerspectiveCamera(FOV(), 1, 0.1, 400);

    hemiLight = new t.HemisphereLight(0xffffff, 0x4a5a3a, 0.9);
    scene.add(hemiLight);
    sunLight = new t.DirectionalLight(0xfff4e0, 1.0);
    sunLight.position.set(-30, 40, 20);
    sunLight.castShadow = q.shadow;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -40; sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40; sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.bias = -0.0015;
    scene.add(sunLight);
    scene.add(sunLight.target);   // 인물은 늘 원점 — 해가 늘 원점을 비추게 고정

    var ground = new t.Mesh(
      new t.PlaneGeometry(GROUND_SIZE(), GROUND_SIZE()),
      (global.DG.toon3d ? global.DG.toon3d.lambertLike({ color: 0x63b04a }) : new t.MeshLambertMaterial({ color: 0x63b04a }))
    );
    ground.rotation.x = -Math.PI / 2;
    /* 색칠한 타일(y=0)보다 살짝 아래 — 이음매가 안 보인다. **물 칸(y=-WATER_DEPTH())
       보다는 반드시 더 깊어야 한다** — 안 그러면 이 배경판이 물 칸을 그대로
       덮어 가려 버린다(2026-09-09, CDP 스크린샷으로 처음 잡아낸 버그 — 물이
       파동·반사까지 다 얹었는데 화면엔 늘 초록만 보였다. 옛 값 -0.02는 기본
       WATER_DEPTH 0.12보다 얕아 물 칸이 통째로 이 판 밑에 깔려 있었다) */
    ground.position.y = -(WATER_DEPTH() + 0.02);
    ground.receiveShadow = true;
    scene.add(ground);

    loadEnvironment(t);
    initTerrain();
    buildWeatherFX(t);
    buildMeteor(t);
    resize();
    global.addEventListener('resize', resize);
    /* PLAN 40절 PHASE 6 · PLAN 25절 "orientationchange / resize 둘 다 처리한다" —
       구형 iOS Safari는 방향이 바뀌어도 resize 가 늦거나 안 올 때가 있다.
       resize()는 그냥 다시 불러도 결과가 같은 순수 계산(camera.aspect 등)이라
       두 번 걸려도 해가 없다 */
    global.addEventListener('orientationchange', resize);
    bindCamControl(canvas);
    ready = true;
    syncVisibility();
    buildPlayer();
    /* §5.8① 낚시 성공 줌 인 — `sfx.js`가 이미 듣는 같은 이벤트를 그대로
       구독한다(다른 상태 cast·miss 는 무시). `init()`은 `game.js`에서
       한 번만 부르므로 중복 구독 걱정이 없다. */
    C().on('village:fish', function (e) {
      if (e && e.state === 'catch') { triggerFishZoom(); }
    });
    /* 백중 불꽃(§5.6) — festival.js complete() 가 이미 쏘는 이벤트, 새로 안 건드림 */
    C().on('village:fest', function (e) {
      if (e && e.kind === 'lantern') { triggerFirework(); }
    });
    /* 땅이 바뀌었다(공사·조개 길) — `syncTerrain()` 은 인물이 안 움직이면 지면을 다시 안
       세우므로, 제자리에서 땅만 바뀌면 다음 걸음까지 옛 땅이 보인다. 캐시 키를 비운다 */
    C().on('village:terrain', function () { lastTermPx = null; });
  }

  /** 물 재질(PLAN 12절 "파동·반사") — 나머지 여덟 칸(MeshLambertMaterial)과
   *  달리 `MeshStandardMaterial`을 쓴다. **반사**는 새 렌더패스 없이 공짜로
   *  얻는다 — `scene.environment`(위 HDRI, `loadEnvironment()`)를 three.js가
   *  PBR 재질에 자동으로 물려 준다, 따로 envMap 을 지정할 필요가 없다.
   *  **파동**은 `onBeforeCompile`로 정점 셰이더에 한 줄 얹는다 — `waterWaveY()`와
   *  **같은 식**(주파수·속도·진폭 상수까지)을 GLSL로 그대로 옮겨, 반짝임 점
   *  (`syncWaterRipple`)과 실제 파도가 어긋나지 않게 한다. `instanceMatrix[3].xz`
   *  는 three.js 가 InstancedMesh 용으로 셰이더에 자동으로 얹어 주는 그 칸의
   *  월드 좌표라 새 유니폼 없이 칸마다 다른 위상을 낼 수 있다.
   *  **일부러 안 고친 것** — 칸마다 위상이 달라 이웃 물 칸과 맞닿는 가장자리가
   *  완전히 안 맞물린다(진폭이 4.5cm 뿐이라 눈에 크게 띄진 않는다). 물 전체를
   *  하나의 큰 평면으로 잇는 편이 이음매는 없겠지만 지금의 칸별 InstancedMesh
   *  구조를 갈아엎어야 해서 이번엔 안 건드렸다 */
  /** 물비늘 반짝임(2026-09-19, "고품질 셀 셰이딩급" 요청 이어서 §"물 재질도 다시 검토") —
   *  **재질 자체(PBR+HDRI 반사)는 그대로 둔다**, "반사는 공짜로 얻는다"는
   *  기존 이유가 여전히 맞다(§waterMaterial 머리말). 대신 같은 `onBeforeCompile`
   *  자리에 프래그먼트 항 하나만 더해 — 월드 xz 를 격자로 잘라 칸마다
   *  해시 난수를 뽑고, 문턱값을 넘는 칸만 `uTime`에 따라 반짝이게 한다
   *  (셀 셰이딩 애니메풍 스타일라이즈드 물의 "표면에 잔별처럼 반짝이는" 인상). 손잡이
   *  `village3d.waterSparkle`(기본 1) — 꺼지면 예전 그대로 순수 PBR 반사뿐. */
  function WATER_SPARKLE_ON() { return C().tuned('village3d.waterSparkle', 1) ? true : false; }
  function waterMaterial(t, color, map) {
    var mat = new t.MeshStandardMaterial({ color: color, map: map, roughness: 0.18, metalness: 0.25 });
    var amp = WATER_WAVE_AMP(), freq = WATER_WAVE_FREQ(), speed = WATER_WAVE_SPEED();
    var sparkle = WATER_SPARKLE_ON();
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '  transformed.y += sin((instanceMatrix[3].x + instanceMatrix[3].z) * ' + freq.toFixed(4) +
        ' + uTime * ' + speed.toFixed(4) + ') * ' + amp.toFixed(4) + ';'
      );
      if (sparkle) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vSparkleXZ;'
        ).replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvSparkleXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          '#include <common>\nuniform float uTime;\nvarying vec2 vSparkleXZ;\nfloat sparkleHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }'
        ).replace(
          '#include <dithering_fragment>',
          'vec2 sparkleCell = floor( vSparkleXZ * 3.0 );\n' +
          'float sparkleN = sparkleHash( sparkleCell + floor( uTime * 1.6 ) );\n' +
          'float sparkleGlint = step( 0.985, sparkleN ) * ( 0.5 + 0.5 * sin( uTime * 20.0 + sparkleN * 40.0 ) );\n' +
          'gl_FragColor.rgb += sparkleGlint * vec3( 1.0, 0.98, 0.85 ) * 0.6;\n' +
          '#include <dithering_fragment>'
        );
      }
      waterShader = shader;
    };
    return mat;
  }

  /** 종류별 InstancedMesh 를 미리 만들어 둔다 — 칸 수는 매 프레임 늘렸다 줄였다 한다 */
  function initTerrain() {
    var t = three();
    var colors = terrainColors(), k, tileM = tileMeters();
    var geo = new t.PlaneGeometry(tileM, tileM);
    geo.rotateX(-Math.PI / 2);
    /* 물만 잘게 나눈다(4×4) — 파동이 칸 하나를 통째로 기울이지 않고
       칸 안에서도 부드럽게 굽이치게. 나머지 여덟 칸은 안 바뀐 것과 같은 4각형 */
    var waterGeo = new t.PlaneGeometry(tileM, tileM, 4, 4);
    waterGeo.rotateX(-Math.PI / 2);
    var r = GROUND_TILE_R();
    terrainCap = (2 * r + 1) * (2 * r + 1);
    for (k in colors) {
      if (!Object.prototype.hasOwnProperty.call(colors, k)) { continue; }
      var mat = k === 'water' ?
        waterMaterial(t, new t.Color(colors[k]), tileTexture(k)) :
        (global.DG.toon3d ?
          global.DG.toon3d.lambertLike({ color: new t.Color(colors[k]), map: tileTexture(k) }) :
          new t.MeshLambertMaterial({ color: new t.Color(colors[k]), map: tileTexture(k) }));
      var im = new t.InstancedMesh(k === 'water' ? waterGeo : geo, mat, terrainCap);
      im.count = 0;
      scene.add(im);
      terrainMesh[k] = im;
    }
    buildWaterRipple(t);
  }

  /** 마을 좌표 한 타일(`V.TILE`)이 3D 로 몇 미터인지 — village.js 가 없으면(진단 등) 3.2m 기본값 */
  function tileMeters() {
    var V = global.DG.village;
    return (V ? V.TILE : 40) * WORLD_SCALE();
  }

  function resize() {
    if (!renderer || !camera) { return; }
    var w = global.innerWidth, h = global.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / (h || 1);
    camera.updateProjectionMatrix();
  }

  /** 2D 캔버스와 3D 캔버스는 **하나만 보인다** — 다른 화면의 두 배 켠 자리와 같은 원칙 */
  function syncVisibility() {
    var map2d = document.getElementById('map');
    if (!canvas) { return; }
    var on = active();
    canvas.style.display = on ? 'block' : 'none';
    if (map2d) { map2d.style.display = on ? 'none' : 'block'; }
  }

  function toggle() {
    if (!available()) { return false; }
    C().setTune('village3d.on', ON() ? 0 : 1);
    syncVisibility();
    return ON();
  }

  function buildPlayer() {
    var save = C().save;
    var heroId = (save.party && save.party[0]) || null;
    asset3d().build('hero', { id: heroId || 'me' }, function (g) {   // 동료가 아직 없으면 'me' — 빌린 몸(W-0074)이 고정 한 벌을 준다
      if (!g || !scene) { return; }
      player.group = g;
      player.mixer = g.userData.mixer || null;
      player.actions = g.userData.actions || null;
      player.clipMap = g.userData.clipMap || null;
      g.scale.setScalar(PLAYER_H());
      scene.add(g);
      playAction(player, 'idle');
    });
  }

  /** entity(player 또는 npc3d 한 칸)의 몸짓을 slot(idle/walk 등)으로 바꾼다 */
  function playAction(entity, slot) {
    if (!entity.actions || !entity.clipMap) { return; }
    var name = entity.clipMap[slot];
    if (!name || !entity.actions[name]) { return; }
    var act = entity.actions[name];
    if (entity.action === act) { return; }
    if (entity.action) { entity.action.fadeOut(0.15); }
    act.reset().fadeIn(0.15).play();
    entity.action = act;
  }

  /** 2026-09-10 "더 자연스럽게" — 여태 인물은 걷기·멈춤(idle) 둘만 오갔다.
   *  나무를 흔들거나 낚싯대를 던지거나 상자를 열어도 화면엔 아무 몸짓이 없이
   *  그냥 서 있었다 — `ui.js`의 `doInteract()`가 손을 쓴 순간마다 이 함수를
   *  불러 몸짓을 한 번 튼다. 남은 초(`actionTimer`)는 `syncCamera()`가
   *  매 프레임 줄이며, 그동안은 idle/walk 로 안 덮어쓴다(재생 도중 끊기지
   *  않는다) — 한 번 다 튼 뒤엔 저절로 걷기/멈춤으로 돌아온다. */
  var actionTimer = 0;

  /** §5.8① 낚시 성공 줌 인 — 0.2초 동안 카메라를 살짝 당겼다 되돌린다.
   *  `userZoom`(사람이 손으로 정한 배율)은 그대로 두고, 그 위에 잠깐
   *  덧씌우는 펄스라 손 배율과 안 부딪힌다. */
  var FISH_ZOOM_DUR = 0.2, FISH_ZOOM_PEAK = 0.18;
  var fishZoomTimer = 0;
  function triggerFishZoom() { fishZoomTimer = FISH_ZOOM_DUR; }

  function triggerAction() {
    if (!player.actions || !player.clipMap) { return; }
    var name = player.clipMap.interaction || player.clipMap.attack;
    if (!name || !player.actions[name]) { return; }
    var t = three(), act = player.actions[name];
    if (player.action && player.action !== act) { player.action.fadeOut(0.1); }
    act.reset();
    if (t && t.LoopOnce) { act.setLoop(t.LoopOnce, 1); act.clampWhenFinished = true; }
    act.fadeIn(0.1).play();
    player.action = act;
    var clip = act.getClip();
    actionTimer = (clip && clip.duration) ? clip.duration : 0.6;
  }

  /**
   * 카메라 자리 — **순수 함수다**(사가나락 dungeon3d.js 의 camAim/camAim3rd 와 같은 결이되,
   * 여기는 둘을 딱 자르지 않고 `t`(camTiltMix, 0~1)로 이어 붙인다 — **따로 켜는 버튼이
   * 없다**(2026-09-02 사용자 요청). t=0(어깨너머 3인칭)은 걷는 방향(facingYaw) 뒤를
   * 그대로 따라 돈다. t=1(3/4 부감/쿼터뷰)은 facingYaw 기여가 0 이 되어 걸어도 화면이
   * 안 돌아가는 원작 쿼터뷰가 된다 — 그 사이는 반지름·높이·방위 모두 선형으로 섞는다.
   * 인물은 늘 원점(0,0,0)이라 lookAt 은 호출부에서 고정값 하나로 처리한다.
   */
  function camPose(t, facingYaw, mouseYaw, radius0, height0, radius1, height1) {
    var radius = radius0 + (radius1 - radius0) * t;
    var height = height0 + (height1 - height0) * t;
    var az = mouseYaw + (1 - t) * (facingYaw + Math.PI);
    return { x: Math.sin(az) * radius, y: height, z: Math.cos(az) * radius };
  }

  /** 걸어갈 목표 고리 — village.js moveTarget() 이 있으면 그 땅에 금빛 고리(2D 의 타원과 같은 뜻),
   *  도착·키 입력으로 목표가 지워지면 숨긴다 */
  var walkMark = null;
  function syncWalkMark() {
    var t = three(), V = global.DG.village;
    if (!t || !scene || !V || !V.moveTarget) { return; }
    var mt = V.moveTarget();
    if (!mt) { if (walkMark) { walkMark.visible = false; } return; }
    if (!walkMark) {
      walkMark = new t.Mesh(new t.RingGeometry(0.42, 0.6, 32),
        new t.MeshBasicMaterial({ color: 0xffe296, transparent: true, opacity: 0.9, depthWrite: false, side: t.DoubleSide }));
      walkMark.rotation.x = -Math.PI / 2;
      walkMark.renderOrder = 5;
      scene.add(walkMark);
    }
    var raw = V.raw(), s = WORLD_SCALE(), k = 1 + Math.sin(Date.now() / 140) * 0.14;
    walkMark.position.set((mt.x - raw.player.x) * s, 0.06, (mt.y - raw.player.y) * s);
    walkMark.scale.set(k, k, k);
    walkMark.visible = true;
  }

  /** 화각도 t 로 섞는다 — 순수 함수. 좁아질수록(정사영에 가까워질수록) 원근 왜곡이 준다 */
  function camFov(t, fov0, fov1) { return fov0 + (fov1 - fov0) * t; }

  /** 순수 함수 — 각 a 를 목표 각 b 쪽으로 k(0~1)만큼 **최단 방향**으로 끌어당긴다.
   *  단순히 `a + (b-a)*k` 를 쓰면 -179°→+179° 처럼 경계를 넘는 회전이 반대
   *  방향(먼 길)으로 돌아버린다 — 각 차를 먼저 -π~π 로 접어(wrap) 최단 회전만
   *  고른다. `2026-09-10 "움직이는 모션을 더 자연스럽게"`로 신설 */
  /** 탈것(mount.js) — 발밑에 펫 몸을 세우고 나를 등 높이에 앉힌다. 떠서 가는 탈것은 HOVER 만큼 떠서 출렁인다 */
  function syncMount(dt, moving) {
    var MT = global.DG.mount, ref = MT && MT.petRef ? MT.petRef() : null, sc = scene;
    if (!sc || !player.group) { return; }
    if (mount3.group && (!ref || mount3.id !== ref.id)) {
      sc.remove(mount3.group); mount3.group = null; mount3.id = null; mount3.mixer = null; mount3.actions = null; mount3.clipMap = null; mount3.action = null; mount3.gen++;
    }
    if (!ref) { player.group.position.y = 0; return; }
    if (!mount3.group && mount3.id !== ref.id) {
      var gen = ++mount3.gen; mount3.id = ref.id;
      asset3d().build('pet', ref, function (g) {
        if (!g || gen !== mount3.gen || !scene) { return; }
        g.scale.setScalar(PLAYER_H() * MT.SCALE);
        mount3.group = g; mount3.mixer = g.userData.mixer || null; mount3.actions = g.userData.actions || null; mount3.clipMap = g.userData.clipMap || null;
        scene.add(g);
      });
    }
    var fly = MT.flying(), t = Date.now() / 1000, hover = fly ? PLAYER_H() * MT.HOVER + Math.sin(t * 3) * 0.08 : 0;
    player.group.position.y = PLAYER_H() * MT.RIDER_LIFT + hover;
    if (mount3.group) {
      mount3.group.position.set(0, hover, 0);
      mount3.group.rotation.y = facingYaw;
      if (mount3.actions && mount3.clipMap) {
        var slot = (moving || fly) ? 'walk' : 'idle', name = mount3.clipMap[slot] || mount3.clipMap.walk, act = name ? mount3.actions[name] : null;
        if (act && mount3.action !== act) { if (mount3.action) { mount3.action.fadeOut(0.15); } act.reset().fadeIn(0.15).play(); mount3.action = act; }
      }
      if (mount3.mixer) { mount3.mixer.update(dt); }
    }
  }

  function angleLerp(a, b, k) {
    var d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * k;
  }
  /** 순수 함수 — dt초 동안 TURN_RATE 로 지수감쇠한 보간 계수(0~1). 프레임이
   *  들쭉날쭉해도(저사양 폰) 같은 실제 시간엔 같은 만큼 돈다 */
  function turnLerpK(dt) { return 1 - Math.exp(-TURN_RATE() * Math.max(dt, 0)); }

  /** 걸음 방향 → 카메라가 뒤에서 도는 각. 마을 좌표(x,y) → 3D(x,-z 앞) */
  function syncCamera(dt) {
    var V = global.DG.village;
    if (!V) { return; }
    var raw = V.raw();
    var px = raw.player.x, py = raw.player.y;
    if (!haveLast) { lastPX = px; lastPY = py; haveLast = true; }
    var dx = px - lastPX, dy = py - lastPY;
    var moved = Math.hypot(dx, dy);
    var targetYaw = facingYaw;
    if (moved > MOVE_EPS() * (1 / 60)) {
      targetYaw = Math.atan2(dx, dy);
      if (actionTimer <= 0) { playAction(player, 'walk'); }
    } else if (actionTimer <= 0) {
      playAction(player, 'idle');
    }
    if (actionTimer > 0) { actionTimer = Math.max(0, actionTimer - dt); }
    lastPX = px; lastPY = py;
    /* 목표각으로 한 프레임 만에 스냅하지 않고 부드럽게 돈다 — 카메라(camPose)도
       이 같은 facingYaw 를 물려 쓰므로 몸과 시점이 같이, 같은 속도로 돈다 */
    facingYaw = angleLerp(facingYaw, targetYaw, turnLerpK(dt));

    if (player.group) { player.group.rotation.y = facingYaw; }
    syncMount(dt, moved > MOVE_EPS() * (1 / 60));

    /* userZoom 이 커질수록(확대) 거리를 좁힌다 — 그래서 여기선 나눈다.
       iso 쪽 끝값은 ISO_DIST()·ISO_TILT() 를 camPose 가 쓰던 (수평 반지름, 높이) 짝으로
       미리 풀어 둔다 — camPose 자체는 그 둘의 뜻(거리·기울기)을 몰라도 된다 */
    if (fishZoomTimer > 0) { fishZoomTimer = Math.max(0, fishZoomTimer - dt); }
    var zoomPulse = 1 + FISH_ZOOM_PEAK * (fishZoomTimer / FISH_ZOOM_DUR);
    var radius0 = CAM_DIST() / userZoom / zoomPulse, height0 = CAM_HIGH() / userZoom / zoomPulse;
    var isoDist = ISO_DIST(), isoTilt = ISO_TILT();
    var radius1 = (isoDist * isoTilt) / userZoom / zoomPulse,
        height1 = (isoDist * (1 - isoTilt * 0.55)) / userZoom / zoomPulse;
    var CZ3 = global.DG.cozyCam3d, pos = (CZ3 && CZ3.on()) ? (mouseYaw = 0, camTiltMix = 1, CZ3.pose(userZoom * zoomPulse, PLAYER_H() * 0.75)) : camPose(camTiltMix, facingYaw, mouseYaw, radius0, height0, radius1, height1);   // W-0160 스타듀 고정 시점(cozy-cam3d.js) — 안 돌고 위 = 북
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(0, PLAYER_H() * 0.75, 0);

    /* 화각도 거리·높이와 함께 섞는다 — 좁아질수록(정사영에 가까워질수록) 핵앤슬래시류
       특유의 평평한 쿼터뷰가 된다. fov 가 안 바뀐 프레임엔 updateProjectionMatrix
       를 또 부르지 않는다(third 에 머물 때 매 프레임 헛일하지 않게) */
    var fov = camFov(camTiltMix, FOV(), ISO_FOV());
    if (Math.abs(camera.fov - fov) > 1e-6) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * 나무·바위·꽃·잡초를 인물 둘레에 세운다 (PLAN 9절 ForestDecorator).
   * **새로 흩뿌리지 않는다** — `V.raw().props` 를 그대로 읽으므로 2D 에서
   * 보던 그 나무가 3D 에서도 같은 자리에 선다. 가깝지만 아직 없으면 짓고
   * (한 프레임에 `MAX_BUILD_PER_STEP()` 개까지만), 멀어지면 치운다.
   */
  function syncScatter(dt) {
    var V = global.DG.village;
    if (!V || !scene) { return; }
    syncTreeSeason();
    var raw = V.raw(), props = raw.props.concat(raw.animals || []), px = raw.player.x, py = raw.player.y;
    var scale = WORLD_SCALE(), renderU = RENDER_R() / scale, cullU = CULL_R() / scale;
    var within = {}, budget = MAX_BUILD_PER_STEP();
    var i, p, key, ent, d;

    for (i = 0; i < props.length; i++) {
      p = props[i];
      if (INST_KIND[p.kind]) { continue; }             // InstancedMesh 경로(syncInstScatter)가 대신 세운다
      key = seasonalTreeKey(SCATTER_KIND[p.kind]);
      if (!key) { continue; }
      d = Math.hypot(p.x - px, p.y - py);
      if (d > cullU) { continue; }                    // 완전히 멀다 — 후보에서도 뺀다
      within[p.id] = true;
      ent = scatter[p.id];
      if (ent && ent.group) {
        ent.group.position.set((p.x - px) * scale, 0, (p.y - py) * scale);
        if (ent.mixer) { ent.mixer.update(dt); }
        /* 짐승만 걷는 쪽으로 몸을 튼다(TURNING_KIND) — 이전 프레임 자리와
           비교해 방향을 잡고, 인물과 같은 지수감쇠로 부드럽게 돈다. 나무처럼
           안 움직이는 건 lastX/lastY 가 애초에 없어 여기 안 들어온다.
           **2026-09-10 마저 — 원본 GLB에 몸짓이 있으면(짐승은 보통 Idle·Walk
           를 갖고 있다) 걷는 동안만 walk 로 틀어 준다**(`asset3d.js`가 이제
           mixer·actions 를 실어 준다, 인물·NPC 와 같은 `playAction()`을 그대로
           쓴다) — 회전만 부드러워지고 다리는 안 움직이던 것까지 마저 고친다 */
        if (TURNING_KIND[p.kind] && ent.lastX != null) {
          var mdx = p.x - ent.lastX, mdy = p.y - ent.lastY;
          var movedNow = Math.hypot(mdx, mdy) > 0.01;
          if (movedNow) {
            ent.yaw = angleLerp(ent.yaw || 0, Math.atan2(mdx, mdy), turnLerpK(dt));
            ent.group.rotation.y = ent.yaw;
          }
          if (ent.actions) { playAction(ent, movedNow ? 'walk' : 'idle'); }
          ent.lastX = p.x; ent.lastY = p.y;
        }
        applyShadowLOD(ent, d);
        continue;
      }
      if (d > renderU) { continue; }                  // cull 과 render 사이 — 있으면 두고, 새로 안 짓는다
      if (ent && ent.building) { continue; }           // 이미 요청해 둔 것 — 또 부르지 않는다

      /* Object Pool(PLAN 40절 PHASE 7) — 같은 kind 를 쌓아 둔 게 있으면 새로
         짓지 않고 그대로 꺼내 쓴다. 예산(budget)을 안 쓴다 — 비동기 build() 가
         아니라 이미 다 만들어진 그룹을 자리만 옮기는 것이라 공짜에 가깝다 */
      var pooled = poolTake(p.kind);
      if (pooled) {
        pooled.scale.setScalar(SCATTER_H[p.kind] || 1);
        pooled.position.set((p.x - px) * scale, 0, (p.y - py) * scale);
        pooled.rotation.y = 0;
        ent = scatter[p.id] = {
          group: pooled, kind: p.kind, building: false, meshes: pooled.userData.lodMeshes, shadowOn: null,
          yaw: 0, lastX: TURNING_KIND[p.kind] ? p.x : null, lastY: TURNING_KIND[p.kind] ? p.y : null,
          /* 몸짓 — 창고 자리도 `asset3d.js`가 그룹의 userData 에 실어 둔 걸 그대로 물려받는다 */
          mixer: pooled.userData.mixer || null, actions: pooled.userData.actions || null,
          clipMap: pooled.userData.clipMap || null, action: null
        };
        if (scene && pooled.parent !== scene) { scene.add(pooled); }
        applyShadowLOD(ent, d);
        continue;
      }

      if (budget <= 0) { continue; }                   // 이번 프레임 몫을 다 썼다
      budget--;
      ent = scatter[p.id] = {
        group: null, kind: p.kind, building: true, meshes: null, shadowOn: null,
        yaw: 0, lastX: TURNING_KIND[p.kind] ? p.x : null, lastY: TURNING_KIND[p.kind] ? p.y : null,
        mixer: null, actions: null, clipMap: null, action: null
      };
      (function (id, kind, wx, wy, dist) {
        asset3d().build(key, { id: id }, function (g) {
          var cur = scatter[id];
          if (!cur) { return; }                        // 그새 멀어져 치워졌다
          cur.building = false;
          if (!g || !scene) { return; }
          g.scale.setScalar(SCATTER_H[kind] || 1);
          g.position.set((wx - px) * scale, 0, (wy - py) * scale);
          g.userData.lodMeshes = collectMeshes(g);
          cur.group = g;
          cur.meshes = g.userData.lodMeshes;
          cur.mixer = g.userData.mixer || null;
          cur.actions = g.userData.actions || null;
          cur.clipMap = g.userData.clipMap || null;
          applyShadowLOD(cur, dist);
          scene.add(g);
        });
      })(p.id, p.kind, p.x, p.y, d);
    }

    /* cullU 밖으로 나간 것만 치운다 — renderU~cullU 사이는 그대로 둔다(경계 깜빡임 방지) */
    for (key in scatter) {
      if (!Object.prototype.hasOwnProperty.call(scatter, key) || within[key]) { continue; }
      ent = scatter[key];
      if (ent.group) { poolGive(ent.kind, ent.group); }
      delete scatter[key];
    }
  }

  var instMesh = {};       // "url|primIdx" → InstancedMesh(재질 하나 몫)
  var instDummy = null;    // 행렬 조립용 임시 Object3D — terrainMesh 의 dummy 와 같은 결
  function instKey(url, i) { return url + '|' + i; }

  /** InstancedMesh 하나를 확보한다 — 자리가 모자라면(need > 지금 칸 수) 두 배로 새로 짓는다.
   *  순수하지 않다(scene·three 를 쓴다) — 자가진단은 instKey 처럼 순수한 조각만 검사한다. */
  function ensureInstMesh(key, geo, mat, need) {
    var im = instMesh[key];
    if (im && im.instanceMatrix.count >= need) { return im; }
    var t = three();
    var cap = Math.max(need, 8, im ? im.instanceMatrix.count * 2 : 0);
    var next = new t.InstancedMesh(geo, mat, cap);
    next.count = 0;
    /* 작은 장식물(잔디·꽃·버섯 등, 0.2~0.8m)이라 스스로 그림자를 드리우진
       않는다(InstancedMesh는 개별 인스턴스 그림자 on/off를 못 준다 — 켜면
       전부, 끄면 전부다. `applyShadowLOD`가 하던 거리별 개별 조절을 대신 못 하니
       아예 끈다. CLAUDE.md 최적화 순서 7번째 "shadow 조절"에 해당하는 선택이다).
       다른 사물의 그림자는 그대로 받는다(receiveShadow=true) — 바닥처럼 어색하지 않다 */
    next.castShadow = false;
    next.receiveShadow = true;
    if (im) { scene.remove(im); im.dispose(); }
    scene.add(next);
    instMesh[key] = next;
    return next;
  }

  /**
   * 잔디·꽃·버섯 등 여덟 종(PLAN 40절 PHASE 7, 위 INST_KIND)을 InstancedMesh로
   * 세운다. `syncScatter()`와 달리 Object Pool도, 예산(budget)도 없다 — 이미
   * 다 구운 지오메트리 자리만 갱신하는 것이라 비동기 build() 비용 자체가 없다.
   * `asset3d.partsFor()`가 아직 못 준 변종(로딩 중)은 이번 프레임엔 그냥
   * 건너뛴다 — 다음 프레임에 다시 물어보면 실린 뒤엔 나온다.
   */
  function syncInstScatter() {
    var V = global.DG.village, t = three();
    if (!V || !scene || !t) { return; }
    if (!instDummy) { instDummy = new t.Object3D(); }
    var raw = V.raw(), px = raw.player.x, py = raw.player.y;
    var scale = WORLD_SCALE(), renderU = RENDER_R() / scale;
    var props = raw.props, i, p, key3d, d, rec;
    var byUrl = {};   // url → { parts, items:[{x,z,h}] }

    for (i = 0; i < props.length; i++) {
      p = props[i];
      if (!INST_KIND[p.kind]) { continue; }
      key3d = SCATTER_KIND[p.kind];
      if (!key3d) { continue; }
      d = Math.hypot(p.x - px, p.y - py);
      if (d > renderU) { continue; }
      rec = asset3d().partsFor(key3d, { id: p.id });
      if (!rec) { continue; }        // 아직 안 실렸다
      var g = byUrl[rec.url] || (byUrl[rec.url] = { parts: rec.parts, items: [] });
      g.items.push({ x: (p.x - px) * scale, z: (p.y - py) * scale, h: SCATTER_H[p.kind] || 1 });
    }

    var url, grp, parts, j, part, im, idx, item, key;
    for (url in byUrl) {
      if (!Object.prototype.hasOwnProperty.call(byUrl, url)) { continue; }
      grp = byUrl[url];
      parts = grp.parts;
      /* 발열(2026-09-24) — 가만히 서 있어도 매 프레임 행렬을 다시 짜 GPU 로 통째로 다시 보냈다. 이번 자리 목록의
         지문이 지난번과 같으면(같은 메시·같은 개수) 건너뛴다 — 뽑거나 베어 목록이 바뀌면 지문이 바뀐다 */
      var sig = grp.items.length;
      for (idx = 0; idx < grp.items.length; idx++) {
        item = grp.items[idx];
        sig = (sig * 31 + item.x * 7.13 + item.z * 3.71 + item.h) % 1e9;
      }
      for (j = 0; j < parts.length; j++) {
        part = parts[j];
        key = instKey(url, j);
        im = ensureInstMesh(key, part.geometry, part.material, grp.items.length);
        if (im.userData.instSig === sig && im.count === grp.items.length) { continue; }
        im.userData.instSig = sig;
        for (idx = 0; idx < grp.items.length; idx++) {
          item = grp.items[idx];
          instDummy.position.set(item.x, 0, item.z);
          instDummy.scale.setScalar(item.h);
          instDummy.rotation.set(0, 0, 0);
          instDummy.updateMatrix();
          im.setMatrixAt(idx, instDummy.matrix);
        }
        im.count = grp.items.length;
        im.instanceMatrix.needsUpdate = true;
      }
    }
    /* 이번 프레임에 하나도 안 쓰인 변종(플레이어가 아예 멀어진 경우)은
       count 를 0 으로 낮춰야 유령처럼 남지 않는다 */
    for (key in instMesh) {
      if (!Object.prototype.hasOwnProperty.call(instMesh, key)) { continue; }
      if (usedInstKey(key, byUrl)) { continue; }
      instMesh[key].count = 0;
      instMesh[key].userData.instSig = null;
    }
  }
  /** 순수 함수 — key("url|idx")의 url이 이번 프레임 byUrl에 있었는지 */
  function usedInstKey(key, byUrl) {
    var url = key.slice(0, key.lastIndexOf('|'));
    return Object.prototype.hasOwnProperty.call(byUrl, url);
  }

  /**
   * 숲 NPC(PLAN 40절 PHASE 4, 2026-09-10부터 여섯)를 플레이어와 같은
   * GLB(`asset3d` 의 'hero' 표, Quaternius RPG Character Pack)로 세운다.
   * 자리가 고정이고 `V.raw().npcs`를 그대로 도는 구조라 늘어도 이 함수는
   * 안 건드린다 — 스캐터처럼 컬링·예산을 두지 않는다(수가 적어서 괜찮다).
   * 없으면 한 번만 짓고, 있으면 자리만 갱신.
   */
  function syncNpcs(dt) {
    var V = global.DG.village;
    if (!V || !scene) { return; }
    var raw = V.raw(), px = raw.player.x, py = raw.player.y, scale = WORLD_SCALE();
    var npcs = (raw.npcs || []).concat(raw.visitors || []), i, npc, slot, seenNpc = {};   // 방문객(§5.9)도 같은 길
    for (i = 0; i < npcs.length; i++) { seenNpc[npcs[i].id] = true; }
    /* 날이 바뀌어 떠난 방문객은 치운다 — 안 치우면 옛 자리(내 기준 상대 좌표)에 남아 나를 따라다닌다 */
    for (var oid in npc3d) {
      if (Object.prototype.hasOwnProperty.call(npc3d, oid) && !seenNpc[oid]) {
        if (npc3d[oid].group && scene) { scene.remove(npc3d[oid].group); }
        delete npc3d[oid];
      }
    }
    for (i = 0; i < npcs.length; i++) {
      npc = npcs[i];
      slot = npc3d[npc.id];
      if (!slot) {
        slot = npc3d[npc.id] = { group: null, mixer: null, actions: null, clipMap: null, action: null, building: true };
        (function (id, body) {
          /* §5.13 — 손님은 제 몸(body: 로봇·우주복·유령·도깨비·작업복)이 있으면 그것으로 선다 */
          asset3d().build('hero', body ? { id: id, body: body } : { id: id }, function (g) {
            var cur = npc3d[id];
            if (!cur) { return; }
            cur.building = false;
            if (!g || !scene) { return; }
            cur.group = g;
            cur.mixer = g.userData.mixer || null;
            cur.actions = g.userData.actions || null;
            cur.clipMap = g.userData.clipMap || null;
            g.scale.setScalar(PLAYER_H());
            scene.add(g);
            playAction(cur, 'idle');
          });
        })(npc.id, npc.body || null);
        continue;
      }
      if (!slot.group) { continue; }   // 아직 짓는 중
      slot.group.position.set((npc.x - px) * scale, 0, (npc.y - py) * scale);
      if (npc.gesture) { visitorGesture(slot, npc, px, py, dt); }
      if (slot.mixer) { slot.mixer.update(dt); }
    }
  }

  /**
   * 방문객 몸짓(§5.10) — 곁(2.2칸)에 오면 나를 돌아보고 4초마다 손짓(interaction 클립 한 번),
   * 부탁을 다 들어준 날(gesture 'dance')은 제자리에서 깡충 뛰며 천천히 돈다. 꼬마는 작게.
   */
  function visitorGesture(slot, npc, px, py, dt) {
    var V = global.DG.village, TL = V.TILE || 32, t = three();
    var dx = px - npc.x, dy = py - npc.y, near = Math.hypot(dx, dy) < TL * 2.2;
    slot.gT = (slot.gT || 0) + dt;
    if (npc.kid) { slot.group.scale.setScalar(PLAYER_H() * 0.7); }
    if (npc.gesture === 'dance') {
      slot.group.position.y = Math.abs(Math.sin(slot.gT * 5.5)) * 0.35 * PLAYER_H();
      slot.yaw = (slot.yaw || 0) + dt * 1.6;
      slot.group.rotation.y = slot.yaw;
      if (slot.actions) { playAction(slot, 'walk'); }
      return;
    }
    if (!near) {
      slot.waveCd = 0.6;
      if (npc.faceX !== undefined) {   // 수다(§5.11) — 상대를 본다
        slot.yaw = angleLerp(slot.yaw || 0, Math.atan2(npc.faceX - npc.x, npc.faceY - npc.y), turnLerpK(dt));
        slot.group.rotation.y = slot.yaw;
      }
      if (slot.waveT > 0) { slot.waveT -= dt; } else { playAction(slot, 'idle'); }
      return;
    }
    slot.yaw = angleLerp(slot.yaw || 0, Math.atan2(dx, dy), turnLerpK(dt));
    slot.group.rotation.y = slot.yaw;
    slot.waveCd = (slot.waveCd === undefined ? 0.6 : slot.waveCd) - dt;
    if (slot.waveT > 0) { slot.waveT -= dt; return; }
    if (slot.waveCd > 0 || !slot.actions || !slot.clipMap) { playAction(slot, 'idle'); return; }
    slot.waveCd = 4;
    var name = slot.clipMap.interaction || slot.clipMap.attack, act = name && slot.actions[name];
    if (!act) { return; }
    if (slot.action && slot.action !== act) { slot.action.fadeOut(0.12); }
    act.reset();
    if (t && t.LoopOnce) { act.setLoop(t.LoopOnce, 1); act.clampWhenFinished = true; }
    act.fadeIn(0.12).play();
    slot.action = act;
    var clip = act.getClip();
    slot.waveT = clip && clip.duration ? clip.duration : 0.8;
  }

  /**
   * 마을 주민(residents, `buildResidents()`가 HEROES 로스터에서 다섯 명을 뽑아
   * 마을 안에 흩어 놓는다 — `folk.js`가 매 프레임 어슬렁거리게 걸음도 준다)을
   * 세운다. **2026-09-11 발견 — 이 함수가 아예 없었다**: `syncNpcs()`는 숲
   * 고정 NPC 여섯(§44)만 다루고, 정작 마을 한복판에서 어슬렁대는 다섯 주민은
   * 2D(`village-view.js`의 `drawResident()`)에만 그려지고 3D에는 한 번도
   * 안 세워졌다 — "3D에서 NPC가 안 보인다" 신고가 안개·거리를 고친 뒤에도
   * 이어진 진짜 이유. 자리 갱신 방식은 `syncNpcs()`와 같되, 주민은 실제로
   * 걸어 다니므로(`folk.js`가 매 프레임 자리를 옮긴다) 걷는 쪽으로 몸을
   * 트는 것만 `syncScatter()`의 짐승 처리(TURNING_KIND)와 같은 결로 보탰다.
   */
  function syncResidents(dt) {
    var V = global.DG.village;
    if (!V || !scene) { return; }
    var raw = V.raw(), px = raw.player.x, py = raw.player.y, scale = WORLD_SCALE();
    var residents = raw.residents || [], i, res, slot;
    for (i = 0; i < residents.length; i++) {
      res = residents[i];
      slot = res3d[res.id];
      if (!slot) {
        slot = res3d[res.id] = {
          group: null, mixer: null, actions: null, clipMap: null, action: null,
          building: true, yaw: 0, lastX: res.x, lastY: res.y
        };
        (function (id) {
          asset3d().build('hero', { id: id }, function (g) {
            var cur = res3d[id];
            if (!cur) { return; }
            cur.building = false;
            if (!g || !scene) { return; }
            cur.group = g;
            cur.mixer = g.userData.mixer || null;
            cur.actions = g.userData.actions || null;
            cur.clipMap = g.userData.clipMap || null;
            g.scale.setScalar(PLAYER_H());
            scene.add(g);
            playAction(cur, 'idle');
          });
        })(res.id);
        continue;
      }
      if (!slot.group) { continue; }   // 아직 짓는 중
      slot.group.position.set((res.x - px) * scale, 0, (res.y - py) * scale);
      if (slot.mixer) { slot.mixer.update(dt); }
      var mdx = res.x - slot.lastX, mdy = res.y - slot.lastY;
      var movedNow = Math.hypot(mdx, mdy) > 0.01;
      if (movedNow) {
        slot.yaw = angleLerp(slot.yaw, Math.atan2(mdx, mdy), turnLerpK(dt));
        slot.group.rotation.y = slot.yaw;
      }
      if (slot.actions) { playAction(slot, movedNow ? 'walk' : 'idle'); }
      slot.lastX = res.x; slot.lastY = res.y;
    }
  }

  var dummy = null;
  var lastTermPx = null, lastTermPy = null, lastTermR = null, lastTermScale = null;

  /**
   * 인물 둘레 타일에 색을 입힌다 (PLAN 7절 지형 다양화 · PLAN 40절 Terrain).
   * `V.tileAt()` 을 그대로 읽으므로 2D 에서 보던 흙길·모래·물이 3D 에서도
   * 같은 자리에 있다 — 여기서도 새 지형을 만들지 않는다.
   */
  function syncTerrain() {
    var V = global.DG.village, t = three();
    if (!V || !scene || !t) { return; }
    var colors = terrainColors(), k;
    if (!Object.keys(colors).length) { return; }     // villageData 가 아직이면 예전 초록 한 장 그대로
    if (!dummy) { dummy = new t.Object3D(); }

    var raw = V.raw(), px = raw.player.x, py = raw.player.y, TILE = V.TILE;
    var scale = WORLD_SCALE();
    var r = GROUND_TILE_R();
    /* 인물이 조금도 안 움직였으면(제자리 idle) 841칸(반경14 기준)을 다시
       돌며 InstancedMesh 버퍼 9개를 통째로 GPU 로 재전송할 필요가 없다 —
       타일 색은 인물 위치만으로 정해지므로 자리가 그대로면 결과도 그대로다
       (감사로 찾은 최우선 낭비, 2026-09-08) */
    if (px === lastTermPx && py === lastTermPy && r === lastTermR && scale === lastTermScale) { return; }
    lastTermPx = px; lastTermPy = py; lastTermR = r; lastTermScale = scale;
    var ptx = Math.floor(px / TILE), pty = Math.floor(py / TILE);

    var idx = {}, kind, tx, ty, wx, wy, im, y;
    for (k in colors) { idx[k] = 0; }
    var rippleCap = WATER_RIPPLE_CAP(), rippleN = 0;

    for (ty = pty - r; ty <= pty + r; ty++) {
      for (tx = ptx - r; tx <= ptx + r; tx++) {
        kind = V.tileAt(tx, ty);
        im = terrainMesh[kind];
        if (!im || idx[kind] >= terrainCap) { continue; }   // 방 안 타일(floor)이나 자리가 다 찬 종류
        wx = tx * TILE + TILE * 0.5;
        wy = ty * TILE + TILE * 0.5;
        y = kind === 'water' ? -WATER_DEPTH() : 0;
        dummy.position.set((wx - px) * scale, y, (wy - py) * scale);
        dummy.updateMatrix();
        im.setMatrixAt(idx[kind]++, dummy.matrix);
        /* 물결 반짝임(PLAN 12절) — 물 칸을 세우는 김에 그 자리를 최대
           rippleCap 개까지만 같이 받아 둔다(새 순회를 더 만들지 않는다) */
        if (kind === 'water' && waterRipplePos && rippleN < rippleCap) {
          waterRipplePos[rippleN * 2] = (wx - px) * scale;
          waterRipplePos[rippleN * 2 + 1] = (wy - py) * scale;
          rippleN++;
        }
      }
    }
    for (k in terrainMesh) {
      if (!Object.prototype.hasOwnProperty.call(terrainMesh, k)) { continue; }
      terrainMesh[k].count = idx[k] || 0;
      terrainMesh[k].instanceMatrix.needsUpdate = true;
    }
    waterRippleCount = rippleN;
  }

  function step(dt) {
    /* 실내 출입은 이벤트를 새로 안 걸었다 — 매 프레임 이미 도는 이 자리에서
       active() 를 다시 재 보는 것만으로 충분하고(들고 나는 순간을 한 프레임
       안에 잡는다), syncVisibility() 자체도 같은 값을 다시 대입하면 그냥
       넘어가는 싸구려 대입이라 매번 불러도 비용이 없다 */
    syncVisibility();
    if (!active() || !renderer || !scene || !camera) { return; }
    /* 그림자 on/off 는 매 프레임 다시 먹인다(사가나락 dungeon3d.js 와 같은 요령) —
       설정 화면에서 등급을 바꿔도 3D 를 껐다 켤 필요 없이 곧바로 듣는다.
       같은 값을 매번 대입해도 three.js 쪽에서 그냥 넘어가므로 "바뀔 때만"을
       따로 가리지 않았다 */
    var q = QUALITY_PRESET[tier()];
    renderer.shadowMap.enabled = q.shadow;
    if (sunLight) { sunLight.castShadow = q.shadow; }
    if (player.mixer) { player.mixer.update(dt); }
    syncCamera(dt);
    syncWalkMark(); if (global.DG.cozyCam3d) { global.DG.cozyCam3d.syncGrid(three(), scene, global.DG.village, WORLD_SCALE()); if (global.DG.cozyCam3d.syncLamp) { global.DG.cozyCam3d.syncLamp(three(), scene, global.DG.village, WORLD_SCALE()); } }   // W-0160 풀밭 칸 격자
    syncTerrain();
    syncWaterRipple(dt);
    syncScatter(dt);
    syncInstScatter();
    syncNpcs(dt);
    syncResidents(dt);
    syncSky();
    syncWeatherFX(dt);
    syncMeteor();
    renderer.render(scene, camera);
  }

  global.DG = global.DG || {};
  global.DG.villageView3d = {
    init: init, resize: resize, step: step, toggle: toggle,
    active: active, available: available, on: ON,
    /** ui.js 의 doInteract() 가 손을 쓴 순간마다 부른다 — 나무 흔들기·낚시
     *  던지기·상자 열기 등에 몸짓 한 번(interaction/attack 클립). 그런 클립이
     *  없는 조합이면 조용히 아무 일도 안 한다 */
    triggerAction: triggerAction, triggerFishZoom: triggerFishZoom,
    /** 진단 전용 — 지금 한 번짜리 몸짓이 재생 중이면 남은 초(순수 상태 조회) */
    actionTimer: function () { return actionTimer; },
    fishZoomTimer: function () { return fishZoomTimer; },
    /** 진단·QA 전용 — 세로 드래그로 잇는 시점 높이(0 어깨너머~1 부감), 진단용 순수 함수 */
    camTiltMix: function () { return camTiltMix; },
    setCamTiltMix: setCamTiltMix,
    camPose: camPose, camFov: camFov,
    /** 진단 전용 — 2026-09-10 "움직이는 모션을 더 자연스럽게": 각도 보간·감쇠 순수 함수 */
    angleLerp: angleLerp, turnLerpK: turnLerpK,
    /** 진단 전용 — 지금 화면에 세워진 짐승이 걷는 쪽으로 몸을 트는 표 */
    turningKind: function () { return TURNING_KIND; },
    /** 진단 전용 — 표(순수 함수)와 지금 세운 개수 */
    scatterKind: function () { return SCATTER_KIND; },
    scatterCount: function () { return Object.keys(scatter).length; },
    /** 진단 전용 — 계절이 'tree' 겉모습을 바꾸는 표(가을·눈·자작나무) */
    seasonalTreeKey: seasonalTreeKey,
    /** 진단 전용 — PLAN 40절 PHASE 7: InstancedMesh 로 옮긴 장식물 표·개수 */
    instKind: function () { return INST_KIND; },
    instKey: instKey,
    usedInstKey: usedInstKey,
    instMeshCount: function () { return Object.keys(instMesh).length; },
    terrainColors: terrainColors,
    terrainCount: function (kind) {
      var im = terrainMesh[kind];
      return im ? im.count : 0;
    },
    /** 진단 전용 — 지금 하늘·안개에 먹인 바이옴 색 표 */
    fogColors: function () { return FOG_COLOR; },
    /** 진단 전용 — PLAN 40절 PHASE 5 Day/Night: 시간대별 밝기·조명 표, hex 어둡히기 순수 함수 */
    phaseLight: function () { return { dark: PHASE_DARK, sun: PHASE_SUN, hemi: PHASE_HEMI }; },
    darken: darken,
    /** 진단 전용 — PLAN 40절 PHASE 5 Weather/Ambient: 날씨→파티클, 밤 반딧불이, 낙하 감기(모두 순수 함수) */
    weatherShows: weatherShows,
    fireflyVisible: fireflyVisible,
    fireflyPlotOf: fireflyPlotOf,
    /** 진단 전용 — village.js 사물 kind 가 3D 에 서는가(표에 든 asset3d 키·눈높이) */
    scatterOf: function (kind) { return SCATTER_KIND[kind] ? { asset: SCATTER_KIND[kind], h: SCATTER_H[kind] } : null; },
    wrapY: wrapY,
    skyDark: skyDark,
    weatherFog: function (wk) { return WEATHER_FOG[wk] != null ? WEATHER_FOG[wk] : 1; },
    /** 진단 전용 — PLAN 40절 PHASE 6 Mobile 품질: 등급표(순수)와 기기 점수→등급 순수 함수 */
    qualityPreset: function () { return QUALITY_PRESET; },
    deviceScore: deviceScore,
    tierFor: tierFor,
    /** 설정 화면(⚙️) — 지금 실제로 도는 등급(low/medium/high), 손잡이 원값('auto' 포함), 고르기 */
    quality: tier, qualityRaw: QUALITY, setQuality: setQuality,
    fogOn: FOG_ON, setFogOn: setFogOn,
    /** 진단 전용 — 하늘 그라디언트 구(§ SKY_ON), 손잡이·인스턴스 조회 */
    skyOn: SKY_ON, setSkyOn: setSkyOn,
    skyDome: function () { return skyDome; },
    /** 진단 전용 — 물 반짝임 손잡이(재질 생성 시점 값이라 되돌리려면 3D 를 다시 켜야 한다) */
    waterSparkleOn: WATER_SPARKLE_ON,
    /** 진단 전용 — 2026-09-10 "실내에선 3D를 끈 것처럼" 고침: ready 와 무관하게
     *  지금 집·동굴 안이라 3D가 눌려 있는지만 순수하게 본다 */
    indoorSuppressed: indoorSuppressed,
    /** 진단 전용 — PLAN 40절 PHASE 7 Object Pool: kind별 재사용 창고(순수 함수, mock group 으로도 확인됨) */
    poolTake: poolTake,
    poolGive: poolGive,
    poolSize: poolSize,
    scatterPoolCap: function () { return SCATTER_POOL_CAP; },
    /** 진단 전용 — PLAN 40절 PHASE 7 LOD: 거리 기반 그림자 켜고 끄기 순수 함수 */
    wantShadowAt: wantShadowAt,
    /** 진단·QA 전용 — 사람이 핀치·휠로 조절한 확대 배율 */
    userZoom: function () { return userZoom; },
    setUserZoom: setUserZoom,
    /** 진단·QA 전용 — 사람이 드래그로 돌린 시점 덧각(라디안) */
    mouseYaw: function () { return mouseYaw; }, _nightLight: function () { return { hemi: C().tuned('village3d.nightHemi', PHASE_HEMI.night), sun: PHASE_SUN.night.intensity, even: PHASE_HEMI.even }; },   // W-0145 진단
    setMouseYaw: function (y) { mouseYaw = y; },
    /** Q12 — 카메라 방위(키·조이스틱을 돌리는 각)와 화면 한 점이 짚는 땅(마을 좌표). 진단·확인용으로도 쓴다 */
    camAz: camAz, groundAt: groundAt,
    /** 진단 전용 — PLAN 12절 물 표현: 파동 순수 함수와 반짝임 점 상태 */
    waterWaveY: waterWaveY,
    waterWaveAmp: WATER_WAVE_AMP, waterWaveSpeed: WATER_WAVE_SPEED,
    waterRippleCount: function () { return waterRippleCount; },
    /** 진단 전용 — 숲 NPC 3D 인물이 지금 몇 명 세워졌나(scene 에 실제로 올라간 group 수) */
    npcMeshCount: function () {
      var k, n = 0;
      for (k in npc3d) { if (Object.prototype.hasOwnProperty.call(npc3d, k) && npc3d[k].group) { n++; } }
      return n;
    },
    /** 진단 전용 — 2026-09-11 신설: 마을 주민(residents) 3D 인물이 지금 몇 명 세워졌나 */
    residentMeshCount: function () {
      var k, n = 0;
      for (k in res3d) { if (Object.prototype.hasOwnProperty.call(res3d, k) && res3d[k].group) { n++; } }
      return n;
    },
    /** 진단 전용 — camera 가 지금 원점(플레이어)에서 얼마나 떨어져 있나(world 단위) */
    camDistNow: function () { return camera ? camera.position.length() : null; },
    /** 진단 전용 — PLAN 20절 랜덤 이벤트(유성): town.starNow() → 3D 자리·방향·밝기 순수 함수 */
    meteorPose: meteorPose,
    meteorVisible: function () { return meteorGroup ? meteorGroup.visible : false; }
  };
})(typeof window !== 'undefined' ? window : this);
