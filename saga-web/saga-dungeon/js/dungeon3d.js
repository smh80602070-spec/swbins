/**
 * 3D 던전 — 방을 진짜 입체로 세운다 (3D 전환 1단계)
 * ---------------------------------------------------------------
 * 여태 던전 화면은 캔버스 2D 였다. 아이소메트릭이라 입체로 보이지만 **그리는 것은
 * 납작한 마름모**다(`dungeon-view.js` 의 `proj()`). 그 층 옆에 three.js 로 진짜
 * 3D 를 세운다.
 *
 * `PLAN.md` 가 못박아 둔 구조를 그대로 지킨다 — **게임 로직과 렌더링을 분리**
 * (3절). 다행히 이 판은 처음부터 그렇게 지어져 있다:
 *
 *   `dungeon.js`       판정. 좌표·체력·쿨다운·전리품. **여기는 한 줄도 안 건드린다**
 *   `dungeon-view.js`  캔버스 2D 화면 + 조작판(HUD)·입력
 *   `dungeon3d.js`     ← 여기. 같은 상태를 읽어 **입체로** 세운다
 *
 * 조작판·입력·시트는 그대로 DOM 이다. 3D 가 켜지면 **캔버스 그리기만** 건너뛴다.
 *
 * 카메라는 8절대로 **3/4 top-down** 이고 회전은 막았다(원작이 그렇다).
 * 그림은 37절의 *Stylized Dark Fantasy* — 어둡게 깔고 횃불로 도려낸다.
 *
 * **WebGL 이 없거나 켜다 실패하면 조용히 2D 로 돌아간다.** 자가진단(`DG_NO_DRAW`)은
 * 이 파일을 켜지도 않고, 켜지지 않아도 게임은 그대로 돈다 — 대신 **값을 내는 함수**
 * (`camAim`·`lightPlan`)는 three 없이도 돌아 진단이 그것만 따로 본다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var T = null;
  var renderer = null, scene = null, camera = null;
  var floorMesh = null, wallGroup = null, actorGroup = null, fxGroup = null;
  var fieldGroup = null;           // 방 밖 들판 (2단계)
  var fieldKey = null;             // 지금 세워 둔 들판의 씨앗+반경
  /* 고정 세계 지도(§5.12) — 걸어서 창이 옮겨갈 때는 새 들판을 **뒤에서 다 지은 뒤 한 번에**
     갈아 끼운다(예전엔 지우고 나서 여러 프레임에 걸쳐 채워, 걷는 도중 땅이 비었다 차올랐다).
     fieldTarget 은 지금 공사 중인 묶음(piece()·타일이 여기에 붙는다) */
  var fieldTarget = null, fieldNext = null, lastFieldWm = null;
  /** 마을·들판(run.town)은 세계 좌표로 짓는다 — 던전 방 둘레는 예전 그대로(방 씨앗) */
  function worldFieldOn(run) { return !!(run && run.town && global.DG.worldMap && global.DG.field3d); }
  var amb = null, key = null, torch = null, moveMark = null;
  var canvas = null;
  var fieldBuildErrShown = {};   // buildRoom/buildField 실패 토스트 — 메시지별 1회만(§57 후속)
  var ready = false, failed = false;
  var actors = {};                 // 배우 { key: {node, seen} }
  var frame = 0;
  var camPos = null, camLook = null;
  var camAnc = null;               // camPos·camLook 이 기대는 앵커(바뀌면 rebaseCam 이 옮긴다)
  var roomKey = null;              // 지금 세워 둔 방 (바뀌면 벽을 다시 세운다)
  var fieldWinKey = null;          // 지금 세워 둔 들판 창 위치 (roomKey와 분리 — 아래 buildRoom 주석 참고)
  /** 가림 페이드(§56, 2026-09-06 실기기 제보 "큰 물체 때문에 안 보여") —
   *  카메라~플레이어 사이에 낀 것을 옅게 만든다. `raycaster`는 지연 생성.
   *  `occFade`는 일반 Mesh(건물·벽·`piece()` 소품)를 uuid로, `occInst`는
   *  나무·바위 같은 자연물(field-instance.js가 InstancedMesh로 묶는다 —
   *  인스턴스 하나만 투명하게는 못 만들어 그 인스턴스만 숨긴다)를
   *  "meshUuid:instanceId"로 추적한다. 둘 다 매 프레임 갱신 뒤 이번에
   *  안 걸린 것만 원래대로 되돌린다. */
  var raycaster = null;
  var occFade = {}, occInst = {};
  var occDirScratch = null, occScaleScratch = null; // updateOcclusion() 프레임당 재사용

  /**
   * 지금 그리는 장면 — 마을이거나 던전이다.
   *
   * `dungeon-view.js` 의 같은 이름 함수와 **한 글자도 다르지 않아야 한다.**
   * 그쪽은 마을이면 `DG.town` 을 그리라고 넘기는데 이쪽이 던전만 보고 있으면,
   * 마을에서 `DG.dungeon.raw()` 가 `null` 이라 render() 가 첫 줄에서 나가 버린다.
   * 그러면 2D 는 "3D 가 그렸다" 고 믿어 캔버스를 지우고, 3D 는 아무것도 안 그려
   * **마을이 통째로 검은 화면**이 된다(실제로 그랬다).
   */
  function d() {
    var T2 = global.DG.town;
    return (T2 && T2.active()) ? T2 : global.DG.dungeon;
  }
  function isTown() { var T2 = global.DG.town; return !!(T2 && T2.active()); }

  /* ── 손잡이 ───────────────────────────────────────────
   * **이 판의 `core.js` 에는 손잡이(`tuned`)가 없다** — 사가만리에만 있는 기능이다.
   * 그래서 있으면 쓰고 없으면 기본값으로 간다. 값을 바꿔 보려면 콘솔에서
   * `DG.dungeon3d.set('dg3d.dark', 0.5)` 를 두드리면 된다.
   */
  var knobs = {};
  function tuned(k, def) {
    if (knobs[k] !== undefined) { return knobs[k]; }
    if (core.tuned) { return core.tuned(k, def); }
    return def;
  }
  function set(k, v) {
    if (v === null || v === undefined) { delete knobs[k]; } else { knobs[k] = v; }
    roomKey = null; fieldWinKey = null;    // 방·들판을 다시 세워 값이 곧바로 듣게 한다
    return knobs;
  }

  /** 3D 로 그릴까 — 0 이면 예전 캔버스 화면이다 */
  function wanted() { return tuned('dg3d.on', 1) ? true : false; }
  /** 카메라가 방을 얼마나 담을까 (작을수록 당겨 본다) */
  function ZOOM() { return tuned('dg3d.zoom', 1); }
  /**
   * 사람이 핀치·휠로 직접 조절하는 확대 — **`dg3d.zoom` 손잡이와는 다른 값이다.**
   * 저건 콘솔로 튜닝하는 개발용 상수고, 이건 `core.save.settings.camZoom` 에
   * 저장돼 프로필마다 남는 사용자 값이다. 손가락으로 벌리면(=확대) 커지도록
   * (2D `dungeon-view.js` 의 `ZOOM` 과 같은 결) 잡았는데, `ZOOM()`(거리 배수,
   * 작을수록 가깝다)에는 **나눠서** 먹인다 — 그래야 두 화면(2D·3D)에서 손가락을
   * 벌리는 동작이 똑같이 "가까워진다" 로 느껴진다. 값 자체는 `dungeon-view.js`
   * 가 핀치·휠로 적어 두고, 여기서는 읽기만 한다.
   */
  function USERZOOM() {
    try {
      var v = core.save && core.save.settings ? core.save.settings.camZoom : 1;
      v = (v === undefined || v === null) ? 1 : v;
      /* 아래 한계 0.4 는 dungeon-view.js 의 CAM_ZOOM_MIN(0.32)보다 높으면 안 된다
         — 더 높으면 거기서 낮춰 둔 값이 여기서 도로 잘린다(2026-09-07). */
      return v < 0.3 ? 0.3 : (v > 2.5 ? 2.5 : v);
    } catch (e) { return 1; }
  }
  /** 카메라 기울기 — 0 은 완전 위, 1 은 낮게. 원작은 3/4 쯤이다.
   *  §28-5(2026-09-06) — 0.62→0.4(부감 47°→62.9°)로 낮췄다가 FOV를 좁힌
   *  것과 겹쳐 "너무 가까워서 몹도 안 보인다"는 실기기 피드백으로 그날
   *  바로 되돌렸다(§28-5 되돌림 기록 참고) — 0.62 그대로 둔다. */
  function TILT() { return tuned('dg3d.tilt', 0.62); }
  /** 어둠의 깊이 — 1 이면 횃불 밖이 새까맣다 */
  function DARK() { return tuned('dg3d.dark', 0.45); }
  /** 방 밖 들판을 세울까 (2단계) — 0 이면 1단계의 허공에 뜬 상자로 돌아간다 */
  function FIELD() { return tuned('dg3d.field', 1) ? true : false; }

  /**
   * 그래픽 품질 — PLAN 19절 "LOW/MEDIUM/HIGH/AUTO". 콘솔에서
   * `DG.dungeon3d.set('dg3d.quality','low')` 로 고정하거나, 기본값인
   * `'auto'` 로 두면 **실측 프레임 시간**(`updatePerf` 가 매 프레임 잰다)에
   * 맞춰 스스로 오간다. 값 자체는 등급 표(`QUALITY_PRESET`) 하나로 들판
   * 반경·밀도·그림자를 한꺼번에 정한다 — 등급이 세 갈래인데 손잡이가
   * 셋(fieldR·fieldDens·shadow)이면 조합이 어긋날 수 있어서다.
   * `dg3d.fieldR`·`dg3d.fieldDens` 를 손으로 직접 지정해 두면(콘솔 손잡이)
   * 그 값이 등급표보다 **우선한다** — `tuned()` 가 `knobs` 를 먼저 보기
   * 때문에 자동으로 그렇게 된다.
   */
  var QUALITY_PRESET = {
    /* 2026-09-01 — "너무 오픈월드 같지 않다"(사용자). 반경을 배로 넉넉히 늘렸다 —
       buildField()는 방에 들어올 때 한 번만 세우고(1090행) AS3.build()가 조각을
       인스턴스로 재활용해(사가만리에서 검증된 패턴) 반경을 키워도 프레임 비용은
       거의 그대로다. low/medium/high 순서(자가진단이 보는 것)만 지켰다. */
    /* 2026-09-08 — "장애물이 너무 많다"(사용자). 세 등급 다 밀도를 절반으로
       낮췄다(순서 자체는 그대로 low<medium<high — 자가진단이 그 순서만 본다) */
    /* 2026-09-09 — "이동시 멈추고 맵이 생기면 느려진다"(폰 실기기 재신고).
       세 등급 다 한 단 더 낮춘다 — 특히 MEDIUM 의 그림자를 껐다(그림자는
       렌더러에서 가장 비싼 항목인데, AUTO 가 잠깐씩 MEDIUM 으로 오갈 때마다
       그 비용이 통째로 붙었다 뗐다 해 끊김의 한 갈래였다). 순서(low<medium<high,
       그림자 low=false·high=true)는 자가진단이 보는 것이라 그대로 지켰다. */
    low: { fieldR: 1, fieldDens: 0.16, shadow: false },
    medium: { fieldR: 2, fieldDens: 0.25, shadow: false },
    high: { fieldR: 4, fieldDens: 0.375, shadow: true }
  };
  function QUALITY() { return tuned('dg3d.quality', 'auto'); }
  /* 2026-09-07 — 폰 실기기 재신고("마을 진입 직후 먹통이 될 정도로 느림").
     `autoLevel`을 늘 'high'로 켜 두고 프레임을 실측해야만 내려가는데, 마을
     첫 진입은 GLB 36개+`fieldR`(HIGH=6) 몫 인스턴스를 그 등급 그대로 한꺼번에
     세운다 — 첫 프레임이 끝나기 전엔 `updatePerf()`가 한 번도 안 돌아 실측
     자체가 없다("몇 프레임 버거우면 내린다"가 통하려면 그 몇 프레임을 버틸
     여유가 있어야 하는데, 폰에서는 그 첫 프레임 자체가 수 초~수십 초짜리라
     "먹통"으로 읽힌다). `saga-go`의 `js/perf.js`가 이미 켤 때 기기를 한 번
     보고 시작 등급을 고르는 손잡이(`probe`·`score`·`start`)를 두고 있어 —
     같은 요령을 옮긴다. 코어 수·메모리·화면 픽셀·터치 여부로 점수를 매겨
     시작 등급만 낮춘다(그 뒤로는 여느 때처럼 실측이 올리고 내린다). */
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
  var autoLevel = startLevelFor(deviceScore(probeDevice())); // AUTO 가 지금 고른 등급(시작은 기기 보기)
  var perfEma = 16.7;                   // 프레임 시간 이동평균(ms) — 처음엔 60fps 로 가정
  var lastFrameT = null;
  /* 2026-09-07 — "로딩하자마자부터 화면 전체가 계속 깜빡인다"(실기기·PC 둘 다,
     콘솔은 조용함) 제보. perfEma 가 문턱(20ms·33ms) 바로 옆에서 맴돌면
     `autoLevel`이 매 프레임 뒤집힐 수 있는데, `post3d.js`의 렌더 타깃은
     등급이 바뀔 때마다(scale·msaa가 등급마다 달라서) 그 자리에서 버리고
     새로 만든다(`syncTargets` 주석 — "프레임마다 타깃을 다시 만들면 그것만으로
     화면이 멎는다") — 그걸 초당 수십 번 하면 프레임 예외 하나 없이도 화면이
     깜빡인다. 문턱을 오간 뒤 일정 시간(쿨다운)이 지나기 전에는 등급을 또
     안 바꾸게 막아 진동을 끊는다. */
  var lastLevelChangeT = 0;
  var LEVEL_COOLDOWN_MS = 1500;
  /* 2026-09-08 — 실기기 로그로 실측: MEDIUM(ema 38~41ms, 33 문턱을 넘겨
     LOW 가 이상적인데도)에 몇 초씩 눌러앉는 걸 봤다 — LOW 자신도 순간순간
     ema 가 튀어(로그에 tier=low인데 ema=52.8ms 인 줄이 있었다) 잠깐
     가벼워 보이는 틈에 곧장 MEDIUM 으로 다시 올라섰다가 그 무게에 데는
     되풀이로 보인다. **내려가는 건 그대로 빠르게, 올라가는 건 훨씬
     오래 두고 봐야** 이 왕복을 줄인다 — "뿌옇게(안개·블룸이 진해지는
     MEDIUM/HIGH) 되면 끊긴다"는 제보와 정확히 들어맞는 패턴. */
  var LEVEL_COOLDOWN_UP_MS = 6000;
  /* 2026-09-08 — "이동하면 계속 끊기고 화면이 갈색에 갇힌다" 제보(콘솔 예외
     없음). buildRoom/buildField(무거운 동기 작업)가 걸린 프레임은 dtMs가
     확 튀는데, 그 값이 perfEma 에 그대로 섞이면 등급이 떨어지고, 등급은
     FIELD_R()(=rk 에 실리는 들판 반경)도 정하므로 등급이 바뀌는 것 자체가
     또 재구성을 부른다 — 재구성→측정치 오염→등급 변경→재구성… 으로 이어지는
     되먹임 고리였다. 재구성이 있었던 다음 프레임의 측정치는 평균에서 뺀다
     (탭 전환 때 500ms 넘는 값을 이미 빼는 것과 같은 취지). */
  var lastFrameHadBuild = false;
  var lastSpikeLogT = 0;     // 즉시-튐 로거(아래 updatePerf) 스팸 방지 쿨다운 타이머
  /* 2026-09-08 — 실기기 로그로 실측 확인: "tier=high ema=92.2ms" (등급이 막
     바뀐 바로 그 프레임). `post3d.js`의 `syncTargets`가 등급이 바뀔 때마다
     GPU 렌더 타깃(프레임버퍼)을 새로 만드는 비용 자체가 그 프레임을 90ms대로
     만들었다 — buildRoom/buildField 재구성과는 별개의 무거움이다. 그 비용이
     다음 프레임 dtMs로 그대로 측정돼 등급을 또 떨어뜨리고, 떨어지면 또
     타깃을 새로 만들어 되먹임이 계속됐다(fieldR 6→4→2로 계속 밀리던 로그가
     그 증거). 등급이 바뀐 바로 다음 프레임의 측정치도 build 와 같은 요령으로
     평균에서 뺀다. */
  var skipNextEma = false;
  /* 2026-09-08 — ema는 build 프레임을 일부러 평균에서 빼므로(위 lastFrameHadBuild
     주석) 정작 끊김의 크기를 안 보여준다. 실기기 재현 때 숫자로 바로 보게
     buildRoom·buildField(창 설정)·fieldJobFinalize(인스턴싱 마무리, 유일하게
     예산 없이 한 프레임에 몰아 짓는 자리) 각각의 실측 ms를 따로 잰다. */
  var lastRoomBuildMs = 0, lastFieldSetupMs = 0, lastFieldFinalizeMs = 0;
  /* 2026-09-08 — room/field/finalize가 다 0인데도(build=false) 튐이 계속
     실측됐다("사가나락 끊김 추적" 2차) — 그렇다면 무게는 buildRoom/buildField
     가 아니라 **매 프레임** 도는 다른 구간(배우 갱신·오클루전·후처리)에 있다는
     뜻이다. 이 넷은 (build 여부와 무관하게) **매 프레임 새로 잰다** — build류와
     달리 sticky(옛 값 그대로 echo)로 안 남게, 다음 튐 로그가 그 직전 프레임의
     진짜 breakdown을 보여주게 한다. */
  var lastActorsMs = 0, lastOcclusionMs = 0, lastFxMs = 0, lastPresentMs = 0;

  /** ms 평균 → "이상적인" 등급(지금 등급과 무관하게, 이 프레임 시간만 보면
   *  어디가 맞는지). **순수 함수다** — 자가진단이 실제 프레임 없이 이것만 본다. */
  function autoLevelFor(emaMs) {
    if (emaMs > 33) { return 'low'; }     // 30fps 아래
    if (emaMs > 20) { return 'medium'; }  // ~50fps 아래
    return 'high';
  }
  var LEVEL_ORDER = ['low', 'medium', 'high'];
  function levelIdx(l) { var i = LEVEL_ORDER.indexOf(l); return i < 0 ? 2 : i; }
  /* 2026-09-08 — 실기기 로그로 실측: "low(ema=16.8, fieldR=2)" 다음 줄이 바로
     "high(ema=94.5, fieldR=6)" 였다. LOW 는 물체가 적어(fieldR=2) ema 가
     가볍게 나오는 게 당연한데, autoLevelFor 는 그 가벼운 값만 보고 곧장
     HIGH(물체 9배 가까이 늘어남, fieldR=6)로 판정했다 — MEDIUM 을 건너뛴
     것이다. 이 기기는 HIGH 를 못 견뎌(ema=94.5ms≈10fps) 다음 순간 도로
     LOW 로 떨어지고, 다시 가벼워 보이니 또 HIGH 로 뛰는 되풀이였다("여전히
     느려" 제보의 실제 정체 — 주기적으로 몇 초씩 정지하듯 버벅였을 것).
     이상적인 등급이 아무리 멀어도(low→high) **한 단계씩만** 옮긴다 — MEDIUM
     을 먼저 겪어 그 등급의 진짜 무게를 재고 나서야 HIGH 를 시도하게 된다. */
  function stepTowards(curLevel, idealLevel) {
    var ci = levelIdx(curLevel), ii = levelIdx(idealLevel);
    if (ii > ci) { return LEVEL_ORDER[ci + 1]; }
    if (ii < ci) { return LEVEL_ORDER[ci - 1]; }
    return curLevel;
  }
  /** QUALITY() 가 low/medium/high 로 고정돼 있으면 그걸, 'auto' 면 방금 잰 등급을 쓴다 */
  function effectiveLevel() {
    var q = QUALITY();
    return (q === 'low' || q === 'medium' || q === 'high') ? q : autoLevel;
  }
  /**
   * 매 프레임 부른다 — 실제 경과 시간을 재 이동평균에 얹고, AUTO 등급을
   * 다시 고른다. 탭을 다른 데 갔다 오면 한 프레임이 몇 초씩 뛸 수 있어
   * 그런 값(500ms 넘는 간격)은 평균에 안 섞는다.
   */
  function updatePerf() {
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var skipThis = skipNextEma;
    skipNextEma = false;
    if (lastFrameT !== null) {
      var dtMs = now - lastFrameT;
      /* 프레임 상한(game.js frameGapMs — 시트가 덮으면 30fps)이 걸리면 간격이 늘 33ms 라 그대로 재면 멀쩡한 폰도 LOW 로
         떨어진다 — 상한 간격으로 60fps 기준으로 되돌린다. 10fps 이하로 묶인 동안은 재지도 찍지도 않는다 */
      var GM = global.DG.game, capMs = GM && GM.frameGapMs ? GM.frameGapMs() : 0;
      if (capMs >= 50) { lastFrameT = now; return; }
      if (capMs > 16.7) { dtMs = dtMs * 16.7 / capMs; }
      /* 2026-09-08 — "여전히 끊겨" 재확인 로그가 매번 깨끗했다(ema 16~20ms,
         튄 프레임 하나 없이). 2초마다 한 번(120프레임)만 찍는 표본이 문제였다
         — 짧은 튐 한 프레임은 이동평균(0.9 가중)이 다음 표본 찍기 전에
         거의 다 지워버려 로그에 안 잡힌다. 튄 그 프레임을 **그 즉시**(표본
         주기와 무관하게) 잡아 찍는다 — build 프레임이라 ema 평균엔 안
         섞여도 이건 무조건 찍는다, 사용자가 "느껴지는" 바로 그 순간이니까. */
      if (dtMs > 40 && dtMs < 2000 && now - lastSpikeLogT > 400) {
        lastSpikeLogT = now;
        var spikeMsg = 'dt=' + dtMs.toFixed(1) + 'ms build=' + lastFrameHadBuild +
          ' skipEma=' + skipThis + ' tier=' + effectiveLevel() +
          ' actors=' + lastActorsMs.toFixed(1) + ' occ=' + lastOcclusionMs.toFixed(1) +
          ' fx=' + lastFxMs.toFixed(1) + ' present=' + lastPresentMs.toFixed(1) +
          ' room=' + lastRoomBuildMs.toFixed(1) + ' field=' + lastFieldSetupMs.toFixed(1) +
          ' finalize=' + lastFieldFinalizeMs.toFixed(1);
        if (global.console) { console.log('[던전 3D 튐]', spikeMsg); }
      }
      if (dtMs > 0 && dtMs < 500 && !lastFrameHadBuild && !skipThis) {
        perfEma = perfEma * 0.9 + dtMs * 0.1;
        var next = stepTowards(autoLevel, autoLevelFor(perfEma));
        if (next !== autoLevel) {
          var isUp = levelIdx(next) > levelIdx(autoLevel);
          var cooldown = isUp ? LEVEL_COOLDOWN_UP_MS : LEVEL_COOLDOWN_MS;
          if (now - lastLevelChangeT >= cooldown) {
            autoLevel = next;
            lastLevelChangeT = now;
            skipNextEma = true;
          }
        }
      }
    }
    lastFrameT = now;
    lastFrameHadBuild = false;
  }

  /**
   * `post3d.js`·`ssao3d.js`(사가만리에서 그대로 옮겨 옴, 그래픽 보강)는
   * `global.DG.perf.tier().key` 를 읽어 등급을 고른다. 이 판은 프레임을
   * 스스로 재는 손잡이(`updatePerf`·`effectiveLevel`)가 이미 따로 있어
   * `perf.js` 파일 자체는 안 옮기고, 그 결과를 같은 모양으로만 내주는
   * 얇은 다리를 놓는다. **진짜 `perf.js` 가 나중에 생기면 안 덮는다.**
   */
  global.DG = global.DG || {};
  if (!global.DG.perf) {
    global.DG.perf = { tier: function () { return { key: effectiveLevel().toUpperCase() }; } };
  }

  /** 들판을 몇 조각까지 세울까 (PLAN 6절 — 멀면 안 세운다) */
  function FIELD_R() { return tuned('dg3d.fieldR', QUALITY_PRESET[effectiveLevel()].fieldR); }
  /** 들판 밀도 배수 — 버거우면 여기를 내린다 */
  function FIELD_D() { return tuned('dg3d.fieldDens', QUALITY_PRESET[effectiveLevel()].fieldDens); }
  /** 통로가 있는 마을만 시야를 살짝 넓힌다(PLAN §28-2 Phase 3) — CHUNK 몇 개 정도.
   *  **`FIELD_R()` 자체는 안 건드린다** — POI 배치·필드 몬스터 반경(`fieldRadiusUnits()`)
   *  같은 다른 소비자에 번지면 안 되는 값이라, 그림(`buildField()`)과 안개
   *  (`render()`)가 쓰는 "얼마나 세울까"에만 국한한 별도 값이다. 던전 층은
   *  `run.corridors`가 없어 늘 `FIELD_R()`과 완전히 같다 — 회귀 없음.
   *  마을은 늘 통로가 있으므로(exits가 최소 하나), 시야가 사방으로 조금
   *  더 넓어진다 — 통로 결 안쪽 몇 조각은 그 목적지 테마로 실제로 보이고,
   *  그 뒤로는 지금처럼 안개가 덮는다(통로 전체 길이를 다 보여주진 않는다 —
   *  안개가 방향별로 다르게 걸리지 않는 three.js 기본 Fog의 한계다). */
  var CORRIDOR_VIS_MARGIN = 2;
  function fieldVisR(run) { return FIELD_R() + ((run && run.corridors && run.corridors.length) ? CORRIDOR_VIS_MARGIN : 0); }
  /** 그림자를 켤까 — LOW 에서는 렌더러의 가장 비싼 항목부터 끈다 */
  function SHADOW() { return tuned('dg3d.shadow', QUALITY_PRESET[effectiveLevel()].shadow) ? true : false; }
  /**
   * 마을(모루골)도 3D 로 그릴까 — **기본이 1로 켜졌다** (사용자 요청, 2026-08-30).
   *
   * 처음엔 마을에 집·우물·대장간 같은 건물 자리가 아예 없어서(NPC 여섯 명과
   * 횃불·기둥뿐) 켜면 빈 돌방에 사람만 서 있는 꼴이라 꺼 두었다. 그래서 던전과
   * 같은 순서로 — `town.js` 의 `DECOR` 에 집 셋·우물·대장간을 얹고
   * (`js/asset3d.js` 의 `house`·`well`·`blacksmith`, `saga-go` 의 건물 창고를
   * 그대로 옮겼다) 이 방의 `buildRoom()` 이 그 자리를 GLB 로 세우게 고친 뒤에
   * 켰다. 도로 끄려면 콘솔에서 `DG.dungeon3d.set('dg3d.town', 0)`.
   */
  function TOWN3D() { return tuned('dg3d.town', 1) ? true : false; }

  function available() { return ready && !failed; }
  function active() {
    if (!available() || !wanted()) { return false; }
    return isTown() ? TOWN3D() : true;
  }

  /* ── 값을 내는 함수 (three 없이도 돈다) ────────────────
   * 자가진단이 이것만 따로 굴린다 — 화면이 없어도 카메라와 조명은 값이다.
   */

  /** PerspectiveCamera FOV(도) — §28-5(2026-09-06)에서 34°로 좁혀 봤다가,
   *  narrow FOV가 던전 방 안 주변 몹까지 화면 밖으로 밀어내(방 "대각선"이
   *  화면에 들어가는 것과 "플레이어 주변에서 벌어지는 전투가 다 보이는 것"은
   *  다른 요구였다) 그날 바로 46°로 되돌렸다. **다시 좁힐 거면 반드시 실제
   *  전투 중(적이 여럿·플레이어 주변에 흩어진 상태)에 눈으로 확인부터.** */
  var FOV_DEG = 46;
  /** 던전 쪽 camAim() dist 배수 — FOV_DEG(46°)에 맞춰 눈으로 잡은 값,
   *  건드리지 않는다(§28-5 되돌림 기록 참고). */
  var DUNGEON_DIST_MUL = 1.05;

  /**
   * 앵커가 바뀐 프레임에 카메라를 같은 **세계** 자리로 옮긴다 — 순수 함수다.
   * 들판 한복판에서 `nearestTownId` 가 넘어가면 `run.anchor` 가 다른 마을
   * 것으로 바뀌어 로컬 좌표(세계 − 앵커)가 한 프레임에 통째로 튄다. 그런데
   * camPos·camLook 은 옛 로컬값에 남아 있어 0.14 lerp 가 수천 유닛을 몇 초에
   * 걸쳐 쓸고 가며 화면이 휘청였다(PLAN §7.1-2 "anchor 점프"). 옛 앵커 −
   * 새 앵커만큼 둘 다 밀어 주면 세계 기준으론 제자리라 lerp 가 평소대로 돈다.
   * pos·look 은 {x,y,z}(Vector3 도 된다), 앵커는 {x,y}(y 가 3D 의 z). 옮겼으면 true.
   */
  function rebaseCam(pos, look, oldAnc, newAnc) {
    if (!pos || !look || !oldAnc || !newAnc) { return false; }
    var dx = oldAnc.x - newAnc.x, dz = oldAnc.y - newAnc.y;
    if (!dx && !dz) { return false; }
    pos.x += dx; pos.z += dz;
    look.x += dx; look.z += dz;
    return true;
  }

  /**
   * 카메라가 어디에 서서 어디를 보나 — **순수 함수다.**
   * 방 가운데를 기준으로 플레이어 쪽으로 조금 끌린다(8절 "플레이어를 정확히
   * 따라가되 너무 흔들리지 않게"). 방을 벗어나 흐르지 않게 **가둔다**.
   */
  function camAim(px, py, W, H, zoom, tilt, close, groundY) {
    var z = (zoom === undefined || zoom <= 0) ? 1 : zoom;
    var tl = tilt === undefined ? 0.62 : tilt;
    var gy = groundY || 0;
    /* 방 대각선을 화면에 담을 거리 — 방이 커지면 저절로 물러난다.
       **계수를 눈으로 맞췄다**: 화면에 담기는 세로는 대략 2·dist·tan(fov/2) 인데
       fov 46° 면 0.85·dist 다. 방 대각선(666)을 담으려면 dist 는 그만큼 커야 한다 —
       0.62 로 두었더니 방이 화면 밖으로 나가 어둠만 찍혔다.
       **`close`(마을 전용, 2026-09-02) — 사가마을 쿼터뷰만큼 가깝게 해 달라는
       요청.** 던전 방은 벽 밖이 어둠뿐이라 위 0.62 실패가 그대로 재현되지만,
       마을·필드는 담이 없는 열린 땅이라 화면 밖으로 나가도 그냥 덜 보일 뿐이다
       — 그래서 마을에서만 훨씬 당겨 본다. 던전 쪽 1.05 는 그대로 둔다(연출·조작
       감각이 거기 맞춰져 있다, 2026-09-01 마을 세로화면 건과 같은 원칙) */
    /* §5.19 — 방이 700×440 으로 커지면 카메라도 그만큼(1.24배) 물러난다 — 방을 다 담는 이 설계
       (벽 밖 어둠이 화면을 먹지 않게, 진단 "카메라가 방을 담을 만큼")를 그대로 지킨다. 떼가 한눈에 든다 */
    var span = Math.sqrt(W * W + H * H);
    var dist = span * (close ? 0.4 : DUNGEON_DIST_MUL) * z;
    /* 플레이어를 따라가되 던전 방(!close)에서는 가운데로 **절반만** 당긴다.
       온전히 따라가면 벽에 붙었을 때 방 밖 검은 여백이 화면 절반을 차지한다.
       **§54 후속(2026-09-06, 실기기 제보 "들판 끝으로 가면 캐릭터가 안
       보이고 카메라가 안 따라간다")** — 마을·필드(close)는 담이 없어(주석
       위 참고) 이 절반-당김이 애초에 필요 없는데, `dungeon.js`가 여기 그대로
       기댔다. §28-8(오픈월드 A안)부터 마을 좌표가 방 하나(0..W) 안이 아니라
       세계 전체에 걸쳐 있어서, 방 가운데(W/2)에서 절반만 당기면 플레이어가
       방 밖으로(수백~수천 단위) 나갈수록 카메라가 그 절반만큼씩 계속 뒤처져
       결국 화면 밖으로 밀려났다 — 코너 미니맵과 같은 뿌리(§54)의 다른
       증상이다. close 는 온전히(1.0) 따라가게 한다 — 방(!close)은 회귀 없음. */
    var followMul = close ? 1 : 0.55;
    var cx = W / 2 + (px - W / 2) * followMul;
    var cy = H / 2 + (py - H / 2) * followMul;
    var high = dist * (1 - tl * 0.55);
    var back = dist * tl;
    /* **2026-09-06 실기기 제보** — "바닥 높낮이 때문에 캐릭터가 다 가려지고
       화면이 못 따라간다." 방 밖 들판은 `field3d.js`의 `heightAt()`로 기복이
       진다(언덕·비탈)인데, 카메라는 늘 y=0 바닥을 본다고 가정하고 있었다 —
       플레이어가 언덕에 올라서도 카메라의 `pos`·`look`은 그대로라 캐릭터가
       땅(언덕) 밑에 파묻힌 것처럼 가려졌다. `groundY`(플레이어가 선 자리의
       `heightAt()` 값, 호출부가 넘긴다)를 두 자리에 함께 얹어 카메라 전체가
       그 높이만큼 같이 오르내리게 한다 — 방 안(늘 0)에서는 이 값이 0이라
       회귀가 없다. */
    return {
      pos: { x: cx, y: high + gy, z: cy + back },
      look: { x: cx, y: gy, z: cy },
      dist: dist
    };
  }

  /**
   * 이 층·이 방의 조명 — **순수 함수다.** 층이 깊어질수록 어둡고,
   * 보스 방은 붉게 깔린다(37절 "강한 명암 · 선명한 실루엣").
   */
  function lightPlan(floor, roomKind, dark) {
    var dk = dark === undefined ? 0.82 : dark;
    var deep = Math.min(1, Math.max(0, (floor - 1) / 40));   // 40층에서 가장 깊다
    var boss = roomKind === 'boss';
    /* 마을은 **불을 피워 둔 자리**다 — 던전의 어둠 손잡이를 그대로 물리면
       사람 여섯이 어둠에 잠겨 누가 누구인지 안 보인다. 2D 마을이 어둠을
       0.74 → 0.30 으로 옅게 깔던 그 뜻을 3D 에서도 지킨다. */
    if (roomKind === 'town') {
      /* 2026-09-07 — 실기기(모바일) 재신고: 한 단 올린 것으로도 여전히
         "새까맣게 보인다·너무 느리다" — 사용자가 아예 마을의 "횃불만 켜 둔
         어둠" 컨셉 자체를 없애 달라고 요청(D2 감성보다 눈에 보이는 게 우선).
         배경(`bgHex`, scene.background·fog 색으로 그대로 쓰인다 — 아래
         2130행)이 여전히 어두우면 GLB 가 늦게 실리는 동안(모바일 LTE, 사람
         GLB 여럿) 화면 대부분이 그 어두운 배경 그대로 보이는 시간이 길어져
         "안 보인다" 로 읽힌다. 낮처럼 밝게 — 배경·주변광·직사광 모두 확 올리고
         어두운 색상 자체를 버린다.
         2026-09-09 — 그런데 이번엔 그 밝은 배경 자체가 황갈색(0xb9ab82)이라,
         모바일에서 GLB가 뜨기 전까지 화면 전체가 "갈색"으로 오래 노출되는
         재신고("전체 갈색임·잘안보여"). 사용자가 횃불 톤(조명) 자체가 필요
         없다고 재정정 — torchIntensity를 0으로 내리고, 배경·주변광·직사광의
         색을 호박색(amber) 계열에서 중립(뉴트럴)한 밝은 회백색으로 바꿔
         "갈색"으로 읽히는 색 자체를 없앴다.
         2026-09-09(같은 날 재신고) — 이번엔 "하얀 안개가 화면을 덮는다"로
         뒤집혔다. ambient 2.0 + keyIntensity 1.9 + 거의 흰색인 배경(0xd7dde2,
         RGB 밝기 ~0.86)이 겹쳐 `post3d.js`의 블룸 문턱(threshold 0.9, knee로
         0.45부터 걸린다)을 화면 대부분이 넘겨 버렸다 — 밝은 배경 자체가
         블룸으로 번져 화면 전체에 허연 안개처럼 깔린 것(진짜 `scene.fog`가
         아니라 블룸 블로아웃). 밝기는 유지하되(어둡다는 재신고를 또 부르면
         안 된다) 블룸 문턱을 확실히 넘지 않는 선까지 낮췄다.
         2026-09-11 재신고 — "바닥이 하얀색" (마을 건물 안 바닥·마을 발판·
         마을 들판 셋 다). 블룸이 아니라 **바닥 재질 자체**가 씻기는 것 —
         ambient 1.3 + key 1.2 를 근백색(0xeef1f4·0xf4f7fb)에 곱하면 합이
         2를 훌쩍 넘어, 어두운 층 색(`stone`)을 입힌 바닥도 노출로 밀려
         흰 쪽에 바짝 붙는다. 이번엔 밝기 자체를 낮춘다(어둡다는 재신고가
         또 오면 이 수치가 범인 후보 1순위) — 대신 들판 바닥에 무늬를
         입혀(아래 `groundTex`) 노출이 밀려도 "흰 판"이 아니라 "밝은 땅"으로
         읽히게 같이 손봤다. */
      return {
        ambient: 1.45, ambientHex: 0xe7eaed,   // W-0111 — 1.05/0.95 는 물리 조명 기준 마을 평균 밝기 15/255
        keyIntensity: 1.25, keyHex: 0xecf0f3,
        torchIntensity: 0, torchHex: 0xffc070, torchRange: 420,
        fog: { near: 1400, far: 3200 },
        bgHex: 0xaeb4ba, boss: false, deep: 0, town: true
      };
    }
    return {
      /* 바탕 밝기 — 어둠 손잡이와 깊이가 함께 깎는다 */
      ambient: (0.62 - deep * 0.20) * (1 - dk * 0.45),
      ambientHex: boss ? 0x3a1c1c : 0x2a2f3c,
      /* 위에서 내리는 빛 하나 — 실루엣을 만든다 */
      keyIntensity: (1.35 - deep * 0.30) * (1 - dk * 0.30),
      keyHex: boss ? 0xff9a7a : 0xbfd0e8,
      /* 플레이어를 따라다니는 횃불 — 원작에서 방을 도려내는 그 빛.
         **세기가 천 단위인 것은 오타가 아니다.** three 는 r155 부터 점광이 물리
         단위(칸델라)라, 예전 감각으로 2 를 주면 **아무것도 안 밝아진다**.
         이 방의 단위는 미터가 아니라 논리 좌표(방이 560×360)라 더 그렇다 */
      torchIntensity: 2200 + dk * 2600,
      torchHex: 0xffb45a,
      torchRange: 300 - deep * 70,
      /* 안개는 **방을 삼키지 않을 만큼만**. 카메라가 700쯤 밖에 서므로
         far 를 600 으로 두면 방 전체가 안개에 잠긴다(밟아 본 함정) */
      fog: { near: 320, far: 1500 - deep * 300 },
      bgHex: boss ? 0x120708 : 0x070809,
      boss: boss, deep: deep
    };
  }

  /**
   * `post3d.js`(사가만리에서 옮겨 옴)의 색보정·블룸은 **해 고도**(alt, -1~1)로
   * 결을 잡는다 — 이 판(지하)에는 해가 없으니 `lightPlan()`이 이미 낸 깊이·
   * 마을 여부로 흉내 낸 값을 준다. **순수 함수다.**
   *   마을(횃불 켜 둔 밝은 자리) → 노을에 가까운 값(따뜻하게, 블룸은 약하게)
   *   던전 → 늘 밤에 가까운 값(블룸이 세져 횃불·발광 소품이 어둠 속에서 도드라진다),
   *          층이 깊을수록 더 어둡고, 보스방은 한 번 더 어둡다
   */
  function postAlt(L) {
    if (!L) { return -0.5; }
    if (L.town) { return 0.4; }
    var a = 0.5 - (L.deep || 0) * 1.3 - (L.boss ? 0.3 : 0);
    return Math.max(-1, Math.min(1, a));
  }

  /** HDRI 환경광(IBL) — 사가만리·사가마을이 쓰는 것과 **같은 파일**(Poly Haven
   *  CC0 "Alps Field", md5 까지 같다)을 재사용한다. 사용자가 "사가만리처럼
   *  실사화" 를 요청해 얹었다(2026-09-04) — 사가만리도 사람 리그 자체는
   *  막다른 길이라 포기하고 **재질 반사만** 이걸로 개선했다, 여기도 같은
   *  선택. `scene.background`·톤매핑(`post3d.js`, `NeutralToneMapping`으로
   *  이미 손으로 맞춘 값)은 **안 건드린다** — `scene.environment` 에만
   *  물려 PBR·Lambert 재질의 반사 성분만 사실적으로 만든다. HDR 을 못 받아도
   *  (오프라인 등) 그냥 옛 HemisphereLight+DirectionalLight+횃불만으로
   *  조용히 돈다. */
  var HDRI_SRC = 'assets/hdri/alps_field_1k.hdr';
  function loadEnvironment() {
    if (!T.RGBELoader || !renderer) { return; }
    var pmrem = new T.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new T.RGBELoader().load(HDRI_SRC, function (hdr) {
      var envMap = pmrem.fromEquirectangular(hdr).texture;
      if (scene) { scene.environment = envMap; }
      hdr.dispose();
      pmrem.dispose();
    }, undefined, function () {
      pmrem.dispose();   // 못 받아도 조용히 — 옛 조명만으로 그대로 돈다
    });
  }

  /* ── 켜기 ───────────────────────────────────────────── */

  function init(el) {
    if (ready || failed) { return available(); }
    if (global.DG_NO_DRAW) { failed = true; return false; }
    T = global.THREE || null;
    if (!T || !el) {
      failed = true;
      /* 조용히 2D 로 떨어지면 "왜 안 보이는지" 를 아무도 못 찾는다(실제로 놓친 적이
         있다) — THREE 가 없다는 건 vendor/three.iife.js 가 안 실렸다는 뜻이라
         꼭 콘솔에 남긴다. */
      if (!T) { console.warn('[던전 3D] THREE 가 없다 — js/vendor/three.iife.js 로드를 확인할 것. 2D 로 돌아간다.'); }
      return false;
    }
    canvas = el;
    try {
      renderer = new T.WebGLRenderer({
        canvas: el, antialias: true, alpha: false,
        preserveDrawingBuffer: !!global.DG_3D_PRESERVE
      });
    } catch (e) {
      failed = true;
      console.warn('[던전 3D] WebGL 렌더러를 못 세웠다 — 이 브라우저/기기가 WebGL 을 못 쓰는 것으로 보인다. 2D 로 돌아간다.', e);
      return false;
    }
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV_DEG, 1, 1, 3000);

    amb = new T.HemisphereLight(0x2a2f3c, 0x0a0a0c, 0.4);
    scene.add(amb);
    key = new T.DirectionalLight(0xbfd0e8, 0.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    /* 그림자 카메라(정사영) 틀 — **여기가 빠져 있었다.** three.js 의
       DirectionalLight 그림자 카메라 기본값은 ±5(near 0.5·far 500) 다,
       사람 손바닥만 한 방을 찍는 값이다. 이 방은 560×360 이 넘는데
       그 밖은 그림자가 안 찍히는 게 아니라 **정사영 절두체 가장자리에서
       잘려 커다란 검은 조각으로 번진다** — 실기기(PC 스크린샷)에서
       "1층 시작하자마자 캐릭터를 가린다" 로 보인 그 쐐기꼴이 이것이다.
       방 대각선(최대 820×520 짜리 데스크톱 마을까지 감안)을 넉넉히
       담게 잡는다. */
    key.shadow.camera.left = -520; key.shadow.camera.right = 520;
    key.shadow.camera.top = 520; key.shadow.camera.bottom = -520;
    key.shadow.camera.near = 10; key.shadow.camera.far = 900;
    scene.add(key);
    scene.add(key.target);
    /* 횃불 — 플레이어를 따라다닌다. 원작의 그 도려낸 빛이다 */
    torch = new T.PointLight(0xffb45a, 2200, 300, 1.4);
    scene.add(torch);

    /* 2026-09-09 — "클릭한 곳이 안 보인다" 재신고. moveTo() 로 찍은 걷기
       목표를 바닥에 원으로 표시한다 — d().moveTarget()이 있는 동안만
       보이고, 도착하거나 다른 입력(조이스틱 등, setInput 이 target 을
       지운다)이 오면 그 다음 프레임에 저절로 사라진다. */
    moveMark = new T.Mesh(
      new T.RingGeometry(14, 22, 28),
      new T.MeshBasicMaterial({
        color: 0xd8bd7c, transparent: true, opacity: 0.85,
        depthWrite: false, side: T.DoubleSide
      })
    );
    moveMark.rotation.x = -Math.PI / 2;
    moveMark.visible = false;
    moveMark.renderOrder = 5;
    scene.add(moveMark);

    wallGroup = new T.Group(); scene.add(wallGroup);
    actorGroup = new T.Group(); scene.add(actorGroup);
    fxGroup = new T.Group(); scene.add(fxGroup);
    fieldGroup = new T.Group(); scene.add(fieldGroup);

    /* 전투 연출 (3단계) — 글리프판과 풀을 세운다 */
    if (global.DG.fx3d) { global.DG.fx3d.init(T, fxGroup); }

    /* 후처리 — 톤매핑·블룸·색보정·SSAO(사가만리에서 그대로 옮겨 옴). ssao3d 는
       post3d 가 제 렌더러로 알아서 켠다(post3d.js 의 init() 끝자락 참고) */
    if (global.DG.post3d) { global.DG.post3d.init(T, renderer); }

    loadEnvironment();

    ready = true;
    resize();
    return true;
  }

  /* 발열(2026-09-24 "핸드폰 불남") — dungeon-view.js draw() 가 **매 프레임** 이 함수를 부르고, 여기서 post3d.resize() 가
     curW=0 으로 지워 후처리 렌더 타깃(HalfFloat·MSAA·깊이·블룸)을 매 프레임 버리고 새로 지었다.
     크기·픽셀비가 그대로면 아무것도 안 한다 */
  var lastRW = 0, lastRH = 0, lastRPR = 0;
  function resize() {
    if (!available() || !canvas) { return; }
    var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, pr = renderer.getPixelRatio();
    if (w === lastRW && h === lastRH && pr === lastRPR) { return; }
    lastRW = w; lastRH = h; lastRPR = pr;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (global.DG.post3d) { global.DG.post3d.resize(); }
  }

  /* ── 방 ─────────────────────────────────────────────
   * 바닥 하나와 벽 넷. 방이 바뀌면 다시 세운다 — 방마다 크기가 같으므로
   * 색과 소품만 갈린다(층 테마).
   */
  var geoCache = {}, matCache = {};
  function geo(name, make) { if (!geoCache[name]) { geoCache[name] = make(); } return geoCache[name]; }
  /** SAGA-DESIGN §6.1 — 툰 재질 손잡이(`world3d.toon`, 기본 1). 꺼지면 옛 Lambert */
  function TOON_ON() {
    var TN = global.DG.toon3d;
    return !!(TN && TN.TOON_ON());
  }
  function mat(hex, opt) {
    var toon = TOON_ON();
    var k = hex + '|' + (opt || '') + '|' + (toon ? 't' : 'l');
    if (matCache[k]) { return matCache[k]; }
    var TN = global.DG.toon3d;
    var m = toon
      ? new T.MeshToonMaterial({ color: new T.Color(hex), gradientMap: TN.ramp() })
      : new T.MeshLambertMaterial({ color: new T.Color(hex) });
    if (opt === 'flat') { m.flatShading = true; }
    if (opt === 'glow') { m.emissive = new T.Color(hex); m.emissiveIntensity = 0.7; }
    if (opt === 'water') { m.transparent = true; m.opacity = 0.78; m.depthWrite = false; }
    /* PLAN §6.1 항목 5(풀 바람 셰이더, sway3d.js) — 잡초 층 도형 fallback만
       흔든다(GLB 는 asset3d.js delam() 이 따로 건다). BoxGeometry 는 면마다
       정점이 안 갈려 있어 flatShading 이 원래도 no-op 이라 opt 를 'flat'
       대신 'sway'로 바꿔도 겉모습이 달라지지 않는다(§6.4 교체표 참고) */
    if (opt === 'sway' && global.DG.sway3d) { global.DG.sway3d.swayify(m); }
    matCache[k] = m;
    return m;
  }

  function box(g, x, y, z, sx, sy, sz, hex, opt, cast) {
    var m = new T.Mesh(geo('box', function () { return new T.BoxGeometry(1, 1, 1); }), mat(hex, opt));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (cast) { m.castShadow = true; }
    g.add(m);
    return m;
  }

  /** 바닥·벽 돌 텍스처(2026-09-04, 사용자 요청 "실사화") — Poly Haven CC0
   *  사진측량 텍스처(`assets/ASSET_LICENSES.md` 참고). 방 안 다른 소품
   *  (상자·우물·사당·기둥 등)은 그대로 `mat()`의 단색을 쓴다 — 여기 둘
   *  (바닥 한 판, 방 경계 벽 넷)만 입힌다. `texMat`이 만드는 재질도
   *  `MeshLambertMaterial`이라 원소(환경맵) 처리는 그대로 간다 — 재질
   *  종류 자체는 안 바꿨다. 색은 여전히 층 테마(`stone`)가 물들인다
   *  (텍스처 × material.color, three 기본 동작) — 사용자가 IBL 이후에도
   *  요구한 "층마다 다른 색"은 그대로 산다.
   *  2026-09-04(이어서) — 사용자가 "단조로운 텍스처"라고 짚었다: 방마다
   *  같은 그림 하나만 반복되면 층 테마 색만 다를 뿐 다 같은 방으로 보인다.
   *  나무·바위처럼 **여러 장 중 방 씨앗으로 하나씩** 고르게 늘렸다(새 판정
   *  없음 — `buildClutter`가 귀퉁이 소품을 고르는 것과 같은 요령). */
  var FLOOR_TEX = ['assets/textures/dungeon/floor_stone.webp',
    'assets/textures/dungeon/floor_stone_2.webp', 'assets/textures/dungeon/floor_stone_3.webp'];
  var WALL_TEX = ['assets/textures/dungeon/wall_stone.webp',
    'assets/textures/dungeon/wall_stone_2.webp', 'assets/textures/dungeon/wall_stone_3.webp'];
  function pickTex(list, run, salt) {
    var F = global.DG.field3d;
    if (!F) { return list[0]; }
    var h = F.seedOf(run.floor, run.roomIdx, salt);
    return list[h % list.length];
  }
  var TILE = 70;               // 세계 단위 하나당 텍스처 한 칸 (바닥·벽 공통)
  var rawTexCache = {}, texWaiters = {};
  /** url 하나당 텍스처를 하나만 실어 두고, 실린 뒤에 할 일은 `onTexReady`로 받는다.
   *  **실기기 제보로 걸린 버그(2026-09-04)** — 예전엔 `texMat()`이 이 텍스처를
   *  `.clone()`해 재질에 바로 물렸는데, `TextureLoader.load()`는 그림을 비동기로
   *  받아오는 데다 `.clone()`은 그 순간의 `image`(아직 비어 있다)만 그대로 베낀다.
   *  그래서 복제본은 원본이 나중에 그림을 받아도 **영영 그 그림을 못 받고**
   *  까맣게(재질 색 × 빈 텍스처 = 검정) 남았다 — three.js 콘솔의
   *  "Texture marked for update but no image data found" 경고가 그 증거다.
   *  방·벽마다 반복 값(`repU`·`repV`)이 달라 clone 자체는 필요하니, **로드가
   *  끝난 뒤에만** clone 하도록 미룬다. */
  /** 실제로 새로 요청한 횟수(같은 url 재요청은 0) — PLAN §28-4 Phase 4 실측용.
   *  게임 동작에는 안 쓴다, `_texLoadCount()`로만 내준다. */
  var texLoadCount = 0;
  function rawTex(url) {
    if (rawTexCache[url]) { return rawTexCache[url]; }
    texLoadCount++;
    var tx = new T.TextureLoader().load(url, function () {
      var ws = texWaiters[url] || [];
      delete texWaiters[url];
      for (var i = 0; i < ws.length; i++) { ws[i](); }
    });
    tx.wrapS = tx.wrapT = T.RepeatWrapping;
    if (T.SRGBColorSpace) { tx.colorSpace = T.SRGBColorSpace; }
    rawTexCache[url] = tx;
    return tx;
  }
  function onTexReady(url, fn) {
    var tx = rawTexCache[url];
    if (tx && tx.image) { fn(); return; }
    (texWaiters[url] = texWaiters[url] || []).push(fn);
  }
  var texMatCache = {};
  function texMat(hex, url, repU, repV) {
    var toon = TOON_ON();
    var k = hex + '|' + url + '|' + repU.toFixed(2) + '|' + repV.toFixed(2) + '|' + (toon ? 't' : 'l');
    if (texMatCache[k]) { return texMatCache[k]; }
    var base = rawTex(url);
    /* 로드가 끝나기 전에는 **맵 없이 층 색만**으로 그린다 — 예전의 단색
       바닥으로 잠깐 보이는 것뿐, 다시는 안 까매진다(맵을 아예 안 물리면
       Lambert/Toon 재질은 그냥 `color`로 칠한다). 로드가 끝나면 그제서야
       clone 해서 물린다. */
    var m = toon
      ? new T.MeshToonMaterial({ color: new T.Color(hex), flatShading: true, gradientMap: global.DG.toon3d.ramp() })
      : new T.MeshLambertMaterial({ color: new T.Color(hex), flatShading: true });
    onTexReady(url, function () {
      var tx = base.clone();
      tx.wrapS = tx.wrapT = T.RepeatWrapping;
      if (T.SRGBColorSpace) { tx.colorSpace = T.SRGBColorSpace; }
      tx.repeat.set(repU, repV);
      tx.needsUpdate = true;
      m.map = tx;
      m.needsUpdate = true;
    });
    texMatCache[k] = m;
    return m;
  }
  /** 텍스처 입힌 상자 — 방 경계 벽 전용(`box()`와 달리 단색이 아니라
   *  `texMat`을 쓴다). 반복 횟수는 넓은 면(가로×세로) 기준으로만 잡는다
   *  — 두께(안 보이는 옆면)는 신경 안 쓴다, 이 판의 다른 상자들도 그렇다 */
  function texBox(g, x, y, z, sx, sy, sz, hex, url, cast) {
    var m = new T.Mesh(geo('box', function () { return new T.BoxGeometry(1, 1, 1); }),
      texMat(hex, url, sx / TILE, sy / TILE));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (cast) { m.castShadow = true; }
    g.add(m);
    return m;
  }

  /** 들판·마을 땅 — 여태 민무늬 단색 상자였다(`mix(stone,...)` 한 색을 그대로
   *  칠했다). 마을 조명이 밝을 때(위 `lightPlan` 'town' 참고) 단색은 노출에
   *  밀려 "흰 판"으로 보인다는 제보(2026-09-11) — 사가만리(`world3d.js`의
   *  `terrainTexture`)처럼 캔버스에 얼룩무늬를 구워 반복해 깐다.
   *  2026-09-11(같은 날, 실기기 재신고) — 처음엔 이 텍스처를 **테마 색(hex)
   *  마다 따로** 구웠다. 마을·통로마다 테마가 달라(`themeHex`) 처음 보는
   *  색을 만날 때마다 캔버스에 반점 260개를 그 자리에서 그렸는데, 이게
   *  동기 작업이라 폰에서 그 프레임을 확 잡아먹어 "걷다가 특정 자리에서
   *  멈췄다 풀린다"로 나타났다 — 방금 추가한 무늬 자체가 멈춤의 범인이었다.
   *  `texMat`(바로 위)가 이미 쓰는 원칙 그대로 고친다: **무늬(회색조 반점)는
   *  딱 한 번만** 굽고, 테마 색은 `material.color`가 곱해서 낸다(텍스처 ×
   *  color, three 기본 동작) — 테마가 몇 개든 캔버스 작업은 최초 1회뿐이라
   *  이후 어떤 테마를 만나도 멈출 일이 없다. 무늬는 고정 씨앗 해시라 항상
   *  같다(Math.random 아님) — 자가진단 결정론도 안 깨진다. */
  var GROUND_TEX_UNIT = 260;      // 세계 단위 이만큼마다 무늬 한 판을 반복한다
  var groundNoiseTex = null, groundMatCache = {};
  function groundNoise() {
    if (groundNoiseTex) { return groundNoiseTex; }
    var S = 128;
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var c = cv.getContext('2d');
    c.fillStyle = 'rgb(128,128,128)';       // 중립 회색 — material.color가 곱해져 실제 색을 낸다
    c.fillRect(0, 0, S, S);
    var h = 20260911, i, n = 260;
    for (i = 0; i < n; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      var x = h % S;
      h = (h * 1664525 + 1013904223) >>> 0;
      var y = h % S;
      h = (h * 1664525 + 1013904223) >>> 0;
      var v = 128 + (h % 90) - 45;          // 밝기 반점(83~217) — 색이 아니라 밝기만 흔든다
      h = (h * 1664525 + 1013904223) >>> 0;
      var rad = 2 + (h % 6);
      c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
    var tx = new T.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = T.RepeatWrapping;
    if (T.SRGBColorSpace) { tx.colorSpace = T.SRGBColorSpace; }
    groundNoiseTex = tx;
    return tx;
  }
  function groundMat(hex, repU, repV) {
    var toon = TOON_ON();
    var kk = hex + '|' + repU.toFixed(2) + '|' + repV.toFixed(2) + '|' + (toon ? 't' : 'l');
    if (groundMatCache[kk]) { return groundMatCache[kk]; }
    var tx = groundNoise().clone();
    tx.needsUpdate = true;
    tx.repeat.set(repU, repV);
    var m = toon
      ? new T.MeshToonMaterial({ color: new T.Color(hex), map: tx, flatShading: true, gradientMap: global.DG.toon3d.ramp() })
      : new T.MeshLambertMaterial({ color: new T.Color(hex), map: tx, flatShading: true });
    groundMatCache[kk] = m;
    return m;
  }
  function groundBox(g, x, y, z, sx, sy, sz, hex, cast) {
    var m = new T.Mesh(geo('box', function () { return new T.BoxGeometry(1, 1, 1); }),
      groundMat(hex, Math.max(1, sx / GROUND_TEX_UNIT), Math.max(1, sz / GROUND_TEX_UNIT)));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (cast) { m.castShadow = true; }
    g.add(m);
    return m;
  }
  /* 2026-09-18 — PLAN §6.1-5, 들판 칸 바닥만(`fieldJobChunk`) 트라이플레이너
     3타일(잔디·흙·돌, `js/terrain3d.js`)로 — 계단처럼 놓인 칸끼리 옆면(경사
     큰 면)이 드러나도 늘어지지 않는다. 아주 먼 배경(`skirt`)은 여전히
     `groundBox()`(노이즈 반점) — 카메라에서 멀어 디테일 차이가 안 보이고,
     `terrain3d`가 없거나 텍스처가 아직 안 실렸으면 조용히 이쪽으로 돌아간다. */
  function fieldTileBox(g, x, y, z, sx, sy, sz, hex, cast) {
    var TR = global.DG.terrain3d;
    var tm = TR ? TR.fieldGroundMaterial(hex) : null;
    if (!tm) { return groundBox(g, x, y, z, sx, sy, sz, hex, cast); }
    var m = new T.Mesh(geo('box', function () { return new T.BoxGeometry(1, 1, 1); }), tm);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (cast) { m.castShadow = true; }
    g.add(m);
    return m;
  }

  /** 층 테마 색 — `data-dungeon.js` 의 테마를 읽어 돌 색을 정한다 */
  function themeHex(run) {
    var DD = global.DG.dataDungeon;
    var t = run.theme || (DD ? DD.themeOf(run.floor) : null);
    var c = t && t.wall ? t.wall : '#3a3f4a';
    return parseInt(String(c).replace('#', ''), 16);
  }

  /**
   * 방 구석 잡동사니(PLAN 6절 방 안 장식 보강) — 술통·상자 더미. 판정과
   * 무관한 순수 장식이라 GLB 를 못 받으면 그냥 안 세운다(fallback 없음).
   * 네 귀퉁이에서 50 만큼 들어온 자리만 쓴다 — 문은 늘 오른쪽 벽 가운데
   * 쪽에 서므로(`makeDoors`) 이 자리와 안 겹친다. 씨앗은 `field3d.seedOf`
   * 를 그대로 빌려 쓴다(다섯이 이미 같은 씨앗으로 들판을 흩뿌리고 있다) —
   * 같은 방은 늘 같은 귀퉁이에 같은 것이 선다.
   */
  var CLUTTER_KIND = ['dg:barrel', 'dg:crate', 'dg:crates', 'dg:chair', 'dg:shield', 'dg:spikes',
    'dg:candle', 'dg:bottle', 'dg:bed', 'dg:desk'];
  function buildClutter(run, W, H) {
    var F = global.DG.field3d;
    var AS3 = AS();
    if (!F || !AS3) { return; }
    var seed = F.seedOf(run.floor, run.roomIdx, 'clutter');
    var corners = [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]];
    for (var i = 0; i < corners.length; i++) {
      var h = (seed + i * 2654435761) >>> 0;
      if (h % 5 < 3) { continue; }      // 다섯 중 셋은 비워 둔다 — 안 그러면 붐빈다
      var kind = CLUTTER_KIND[h % CLUTTER_KIND.length];
      var mul = kind === 'dg:crates' ? 52 : (kind === 'dg:barrel' ? 42 :
        (kind === 'dg:chair' ? 34 : (kind === 'dg:shield' ? 30 :
        (kind === 'dg:spikes' ? 48 : (kind === 'dg:candle' ? 22 :
        (kind === 'dg:bottle' ? 20 : (kind === 'dg:bed' ? 34 :
        (kind === 'dg:desk' ? 26 : 28))))))));
      var cnode = AS3.build(kind, seed + ':' + i, mul, null, null);
      if (!cnode) { continue; }
      cnode.position.set(corners[i][0], 0, corners[i][1]);
      cnode.rotation.y = (h % 360) * Math.PI / 180;
      wallGroup.add(cnode);
    }
  }

  function buildRoom(run) {
    var W = d().ROOM_W, H = d().ROOM_H, WALL = d().WALL;
    /* 앞에서부터 지우면 Object3D.remove() 의 indexOf+splice 가 매번 배열을
       통째로 당겨 O(n²)가 된다 — 뒤에서부터 지워 O(n)으로(감사, 2026-09-08) */
    for (var wgi = wallGroup.children.length - 1; wgi >= 0; wgi--) { wallGroup.remove(wallGroup.children[wgi]); }
    var stone = themeHex(run); if (!run.town) { stone = mix(stone, 0xffffff, tuned('dungeon3d.roomLift', 0.65)); }   // W-0145 방 바닥·벽 물감을 흰 쪽으로(층 테마 돌색이 짙어 무늬를 곱하면 반사율이 0 에 가까웠다 — W-0111 마을과 같은 뿌리), 손잡이 0 = 옛

    /* 바닥 — 한 판으로 깐다. 2026-09-04 이전엔 단색이었다("격자 무늬는
       텍스처 대신 얇은 홈으로" 라 적혀 있었지만 그 홈 자체가 구현된 적은
       없었다 — 실제로는 그냥 민무늬 색이었다). 사용자가 "실사화"를 요청해
       Poly Haven CC0 돌바닥 사진측량 텍스처로 갈아 끼웠다 */
    if (!floorMesh) {
      floorMesh = new T.Mesh(geo('floor', function () { return new T.PlaneGeometry(1, 1); }),
        mat(0x2a2a30, 'flat'));
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);
    }
    var floorTex = pickTex(FLOOR_TEX, run, 'floortex');
    var wallTex = pickTex(WALL_TEX, run, 'walltex');
    floorMesh.position.set(W / 2, 0, H / 2);
    floorMesh.scale.set(W, H, 1);
    floorMesh.material = texMat(run.town ? mix(stone, 0xffffff, 0.4) : mix(stone, 0x1a1a20, 0.25), floorTex, W / TILE, H / TILE);   // W-0111 마을 바닥은 흰 쪽

    /* 벽 넷 — 뒤쪽 둘은 높고 앞쪽 둘은 낮다. 안 낮추면 방 안이 안 보인다.
       마을(run.town)은 사방으로 필드에 걸어 나갈 수 있는데(town.js 의
       fieldBoundPlayer), 북·서쪽만 높은 벽 그대로 두면 걸어나갈 수 있는데도
       막힌 벽처럼 보인다 — 마을만 그 둘도 낮춘다.
       2026-09-04 — 바닥과 같은 이유로 돌벽 텍스처(Poly Haven CC0)를 입혔다.
       색은 여전히 층 테마(`stone`)가 물들인다(텍스처 × material.color) */
    var lo = 16, hi = run.town ? lo : 70;
    texBox(wallGroup, W / 2, hi / 2, -WALL / 2, W + WALL * 2, hi, WALL, stone, wallTex, true);
    texBox(wallGroup, -WALL / 2, hi / 2, H / 2, WALL, hi, H, stone, wallTex, true);
    texBox(wallGroup, W / 2, lo / 2, H + WALL / 2, W + WALL * 2, lo, WALL, mix(stone, 0x000000, 0.3), wallTex, false);
    texBox(wallGroup, W + WALL / 2, lo / 2, H / 2, WALL, lo, H, mix(stone, 0x000000, 0.3), wallTex, false);

    /* 방마다 다른 소품 — 상자·우물·사당은 판정이 자리를 정해 준다 */
    var r = run.room;
    if (r && r.chest && !r.chest.taken) {
      /* KayKit Dungeon Remastered(CC0) 상자 — 출처는 assets/ASSET_LICENSES.md.
         GLB 를 못 받으면(오프라인·실패) 여태 쓰던 상자 도형이 그대로 남는다 */
      var AS3c = AS();
      var chestShape = function () {
        var sg = new T.Group();
        box(sg, 0, 9, 0, 26, 18, 20, 0x8a6a34, 'flat', true);
        box(sg, 0, 19, 0, 28, 4, 22, 0xd9b45a, 'glow', false);
        return sg;
      };
      var chnode = AS3c ? AS3c.build('dg:chest', 'poi:' + r.chest.x + ':' + r.chest.y,
        20, null, chestShape) : chestShape();
      chnode.position.set(r.chest.x, 0, r.chest.y);
      wallGroup.add(chnode);
    }
    if (r && r.grave) {
      /* 유품(§5.2) — 마을 서약비('vow' 표식, 위 buildActor)와 같은 비석
         도형을 재사용한다(PLAN 원문 "비석 GLB 재사용"). 회수했어도(taken)
         플레이어가 이 방을 떠나기 전까지는 자리를 남겨 둔다 — 방금 밟은
         자리가 지워지면 "됐다"는 확인이 안 서 보인다. */
      box(wallGroup, r.grave.x, 17, r.grave.y, 16, 34, 8, 0x6a6a75, 'flat', true);
      box(wallGroup, r.grave.x, 36, r.grave.y, 12, 4, 10,
        r.grave.taken ? 0x555b66 : 0xe06565, 'glow', false);
    }
    if (r && r.well && !r.well.used) {
      box(wallGroup, r.well.x, 11, r.well.y, 30, 22, 30, 0x555b66, 'flat', true);
      box(wallGroup, r.well.x, 22, r.well.y, 22, 2, 22, 0x3aa9c9, 'glow', false);
    }
    if (r && r.shrine && !r.shrine.used) {
      box(wallGroup, r.shrine.x, 16, r.shrine.y, 18, 32, 18, 0x6a5c8c, 'flat', true);
      box(wallGroup, r.shrine.x, 34, r.shrine.y, 10, 10, 10, 0xc9a3ff, 'glow', false);
    }
    if (r && r.vein && !r.vein.used) {
      /* 채광방(POI: Cave) — 돌무더기에 박힌 광맥. 상자·우물·사당과 같은
         "바닥에 박힌 소품" 요령이다 */
      box(wallGroup, r.vein.x, 8, r.vein.y, 34, 16, 30, mix(stone, 0x000000, 0.3), 'flat', true);
      box(wallGroup, r.vein.x - 6, 13, r.vein.y + 4, 8, 8, 8, 0x7ee091, 'glow', false);
      box(wallGroup, r.vein.x + 7, 12, r.vein.y - 3, 7, 7, 7, 0xe8c15a, 'glow', false);
    }
    if (r && r.merchant && !r.merchant.used) {
      /* 행상(POI: Merchant) — 마을 장터의 그 좌판(`stall`/MarketStand GLB)을
         똑같이 세운다. 다 팔았으면(=used) 좌판을 걷은 것으로 보고 안 세운다.
         2026-09-04 — 들판의 야영 천막(`tent`)이 진짜 텐트로 갈아 끼워지면서
         좌판 몫으로 `stall` 키를 따로 갈랐다(장터 좌판과 야영 텐트는 다른 물건이다) */
      var AS3m = AS();
      var standShape = function () {
        var sg = new T.Group();
        box(sg, 0, 34, 0, 46, 68, 40, 0x5a4a3a, 'flat', true);
        return sg;
      };
      var stnode = AS3m ? AS3m.build('stall', 'poi:' + r.merchant.x + ':' + r.merchant.y,
        68, null, standShape) : standShape();
      stnode.position.set(r.merchant.x, 0, r.merchant.y);
      wallGroup.add(stnode);
      /* 곁상 — KayKit 긴 상(CC0). 좌판만 덜렁 서 있던 자리에 곁들인다.
         순수 장식이라 fallback 없이, GLB 를 못 받으면 안 세운다 */
      if (AS3m) {
        var mtnode = AS3m.build('dg:table', 'poi:' + r.merchant.x + ':' + r.merchant.y + ':t',
          30, null, null);
        mtnode.position.set(r.merchant.x + 40, 0, r.merchant.y + 10);
        mtnode.rotation.y = Math.PI / 2;
        wallGroup.add(mtnode);
      }
    }
    if (r && r.puzzle) {
      /* 퍼즐방(POI: Puzzle) — 제단 셋. 맞게 밟은 자리는 금빛으로 켜진다 —
         2D 의 🔆/🗿 아이콘과 같은 신호를 3D 에서도 준다 */
      var pods3 = r.puzzle.pods;
      for (var pzk = 0; pzk < pods3.length; pzk++) {
        var pod3 = pods3[pzk];
        box(wallGroup, pod3.x, 5, pod3.y, 22, 10, 22, mix(stone, 0xffffff, 0.1), 'flat', true);
        box(wallGroup, pod3.x, 12, pod3.y, 9, 9, 9,
          pod3.lit ? 0xe8c15a : 0x555b66, pod3.lit ? 'glow' : 'flat', false);
      }
    }
    if (r && r.captive) {
      /* 이벤트방(POI: Event) — 갇힌 우리. 풀려나면(freed) 창살을 걷고
         금빛 표식만 남긴다(2D 의 🙏/⛓️ 와 같은 신호) */
      var cp = r.captive;
      if (!cp.freed) {
        box(wallGroup, cp.x, 20, cp.y, 34, 40, 34, 0x2a2a30, 'flat', true);
        /* 창살 — KayKit 의 barrier_column(감옥 기둥, CC0)을 네 귀퉁이에 둘러
           세운다. 평평한 판 둘로 흉내 내던 자리보다 실제 우리처럼 보인다 */
        var AS3g = AS();
        var cageShape = function () {
          var sg = new T.Group();
          box(sg, 0, 18, 0, 4, 36, 4, 0x8a8a92, 'flat', false);
          return sg;
        };
        var cageCorners = [[-15, -15], [15, -15], [-15, 15], [15, 15]];
        for (var ccI = 0; ccI < cageCorners.length; ccI++) {
          var ccnode = AS3g ? AS3g.build('dg:cage',
            'room:' + Math.round(cp.x) + ':' + Math.round(cp.y) + ':' + ccI,
            38, null, cageShape) : cageShape();
          ccnode.position.set(cp.x + cageCorners[ccI][0], 0, cp.y + cageCorners[ccI][1]);
          wallGroup.add(ccnode);
        }
      } else {
        box(wallGroup, cp.x, 6, cp.y, 26, 3, 26, 0xffd489, 'glow', false);
      }
    }
    if (r && r.forage) {
      /* 채집·낚시방(POI: Forage) — 약초는 낮은 풀포기(항아리보다 작고
         납작하다 — 스치기만 하면 되는 것이라 굳이 위압적일 필요가 없다),
         못은 파란 판(우물과 같은 요령이지만 둥글게 보이도록 얇고 넓게 깐다) */
      var fg3 = r.forage;
      for (var fh3 = 0; fh3 < fg3.herbs.length; fh3++) {
        var hb3 = fg3.herbs[fh3];
        if (hb3.picked) { continue; }
        box(wallGroup, hb3.x, 4, hb3.y, 14, 8, 14, 0x4a7a3a, 'flat', false);
        box(wallGroup, hb3.x, 9, hb3.y, 6, 6, 6, 0x8fd15a, 'glow', false);
      }
      if (fg3.pond && !fg3.pond.used) {
        box(wallGroup, fg3.pond.x, 2, fg3.pond.y, 46, 3, 34, 0x2a6a8a, 'glow', false);
      }
    }
    /* 장식 — 기둥·횃불·바닥 균열. 판정이 자리를 정해 두고(`decor`) 2D 가 오래 그려
       온 것들이다. 이것이 없으면 방이 **빈 상자**로 보인다 — 마을은 특히 그렇다
       (모루골의 집과 불이 전부 여기 들어 있다).
       항아리(`jar`)는 부수면 사라지므로 여기 세우지 않는다 — 방이 바뀔 때만 도는
       자리라 부순 뒤에도 남는다. 그것은 배우로 다룰 몫이다. */
    var dec = (r && r.decor) || [], dj, o;
    for (dj = 0; dj < dec.length; dj++) {
      o = dec[dj];
      if (o.t === 'pillar') {
        /* KayKit 기둥(CC0) — 들판(field, piece()의 'pillar')이 쓰는 Arch.glb 와는
           다른 자리(dg:pillar)다. 저건 폐허 조각, 이건 방 안 건축 기둥이라
           딴 GLB 를 쓴다 */
        var AS3rp = AS();
        var roomPillarShape = function () {
          var sg = new T.Group();
          box(sg, 0, 34, 0, 22, 68, 22, mix(stone, 0xffffff, 0.08), 'flat', true);
          box(sg, 0, 70, 0, 28, 6, 28, mix(stone, 0x000000, 0.2), 'flat', true);
          return sg;
        };
        var rpnode = AS3rp ? AS3rp.build('dg:pillar',
          'room:' + Math.round(o.x) + ':' + Math.round(o.y), 76, null, roomPillarShape)
          : roomPillarShape();
        rpnode.position.set(o.x, 0, o.y);
        wallGroup.add(rpnode);
      } else if (o.t === 'torch') {
        /* KayKit 횃불(CC0) — 실물 모델 위에 기존 발광 표식은 그대로 얹는다.
           어둠 손잡이가 만드는 실제 빛(`torch` PointLight)은 플레이어를 따라
           도는 딴 값이라 이 표식은 어디까지나 "여기 횃불이 있다"는 신호다 */
        var AS3to = AS();
        var torchShape = function () {
          var sg = new T.Group();
          box(sg, 0, 20, 0, 6, 40, 6, 0x4a3a2a, 'flat', false);
          box(sg, 0, 44, 0, 11, 11, 11, 0xffb45a, 'glow', false);
          return sg;
        };
        var tonode = AS3to ? AS3to.build('dg:torch',
          'room:' + Math.round(o.x) + ':' + Math.round(o.y), 46, null, torchShape)
          : torchShape();
        tonode.position.set(o.x, 0, o.y);
        wallGroup.add(tonode);
        box(wallGroup, o.x, 42, o.y, 9, 9, 9, 0xffb45a, 'glow', false);
      } else if (o.t === 'crack') {
        var cl = o.len || 30;
        var cm = box(wallGroup, o.x, 0.6, o.y, cl, 1.2, 4, mix(stone, 0x000000, 0.7), 'flat', false);
        cm.rotation.y = -(o.a || 0);
        /* 비밀(POI: Secret) — 찾기 전엔 여느 균열과 똑같다. 찾은 뒤에만
           금빛 반짝임을 얹는다(2D 의 ✨ 와 같은 신호) */
        if (o.secret && o.found) {
          box(wallGroup, o.x, 4, o.y, 6, 6, 6, 0xffd489, 'glow', false);
        }
      } else if (o.t === 'house') {
        /* 마을(모루골) 집 — `town.js`의 `DECOR`에만 나온다(던전 방엔 없다).
           넷을 자리 씨앗으로 섞어 세운다 — 나무·바위와 같은 요령(`piece()` 참고) */
        var AS3h = AS();
        var houseShape = function () {
          var sg = new T.Group();
          box(sg, 0, o.h / 2, 0, 90, o.h, 80, mix(stone, 0xffffff, 0.1), 'flat', true);
          box(sg, 0, o.h + 14, 0, 100, 28, 92, mix(stone, 0x000000, 0.32), 'flat', true);
          return sg;
        };
        var hnode = AS3h ? AS3h.build('house', 'town:' + o.x + ':' + o.y,
          o.h * 1.3, null, houseShape) : houseShape();
        hnode.position.set(o.x, 0, o.y);
        wallGroup.add(hnode);
      } else if (o.t === 'well') {
        var AS3w = AS();
        var wellShape = function () {
          var sg = new T.Group();
          box(sg, 0, o.h * 0.4, 0, 30, o.h * 0.8, 30, mix(stone, 0x000000, 0.2), 'flat', true);
          return sg;
        };
        var wenode = AS3w ? AS3w.build('well', 'town:' + o.x + ':' + o.y,
          o.h, null, wellShape) : wellShape();
        wenode.position.set(o.x, 0, o.y);
        wallGroup.add(wenode);
      } else if (o.t === 'blacksmith') {
        var AS3b = AS();
        var smithShape = function () {
          var sg = new T.Group();
          box(sg, 0, o.h / 2, 0, 100, o.h, 90, mix(stone, 0x000000, 0.25), 'flat', true);
          return sg;
        };
        var smnode = AS3b ? AS3b.build('blacksmith', 'town:' + o.x + ':' + o.y,
          o.h * 1.2, null, smithShape) : smithShape();
        smnode.position.set(o.x, 0, o.y);
        wallGroup.add(smnode);
      } else if (o.t === 'inn' || o.t === 'stable' || o.t === 'mill') {
        /* 2026-09-04 — 위성 마을 하나씩만의 건물(여관·마방·방앗간). `house`와
           같은 요령(집 모양 상자)을 fallback 으로 쓴다 */
        var AS3v = AS();
        var villageShape = function () {
          var sg = new T.Group();
          box(sg, 0, o.h / 2, 0, 96, o.h, 84, mix(stone, 0xffffff, 0.08), 'flat', true);
          box(sg, 0, o.h + 12, 0, 106, 24, 96, mix(stone, 0x000000, 0.3), 'flat', true);
          return sg;
        };
        var vnode = AS3v ? AS3v.build(o.t, 'town:' + o.x + ':' + o.y,
          o.h * 1.25, null, villageShape) : villageShape();
        vnode.position.set(o.x, 0, o.y);
        wallGroup.add(vnode);
      } else if (o.t === 'belltower') {
        /* SAGA WEB.md "E. 건물"의 "탑" — 모루골 표지 건물 하나. 집보다
           가늘고 훨씬 높게(fallback 도 그렇게) */
        var AS3t2 = AS();
        var towerShape = function () {
          var sg = new T.Group();
          box(sg, 0, o.h * 0.5, 0, 46, o.h, 46, mix(stone, 0xffffff, 0.08), 'flat', true);
          box(sg, 0, o.h + 16, 0, 54, 32, 54, mix(stone, 0x000000, 0.3), 'flat', true);
          return sg;
        };
        var t2node = AS3t2 ? AS3t2.build('belltower', 'town:' + o.x + ':' + o.y,
          o.h * 1.9, null, towerShape) : towerShape();
        t2node.position.set(o.x, 0, o.y);
        wallGroup.add(t2node);
      }
    }

    /* 방 구석 잡동사니 — POI·장식이 다 선 다음에 얹는다(먼저 세운 것들과
       자리가 겹치지 않게 귀퉁이만 쓴다) */
    buildClutter(run, W, H);

    /* 보스방 — 뒷벽에 현수막을 걸어 무게감을 준다(PLAN 37절 "강한 명암·
       선명한 실루엣"). 세력색이 아니라 "여기 보스"라는 신호라 색 하나로 고정 */
    if (r && r.kind === 'boss') {
      var AS3bn = AS();
      if (AS3bn) {
        var bannerOffsets = [-90, 90], bnI;
        for (bnI = 0; bnI < bannerOffsets.length; bnI++) {
          var bnnode = AS3bn.build('dg:banner', 'room:boss:' + bnI, 70, null, null);
          bnnode.position.set(W / 2 + bannerOffsets[bnI], 20, -WALL / 2 + 3);
          wallGroup.add(bnnode);
        }
      }
    }

    /* 문 — 다음 방으로 가는 자리. **늘 동쪽(오른쪽) 벽에 선다** — 2D
       (`dungeon-view.js`의 `ROOM_W - 10`)·미니맵(`minimap.js`)이 이미 그 자리만
       그린다(`makeDoors`가 y만 정하고 x는 안 정하는 것도 그래서다 — 방향이
       여럿이라 값이 빠진 게 아니라 애초에 방향이 하나뿐이라 값이 필요 없었다).
       그래서 여기 회전은 문마다 다른 값이 아니라 **고정값**이다 — 새 값을
       판정에 보태지 않고 렌더링 쪽에서만 안다(dungeon.js 는 한 줄도 안 건드린다) */
    if (r && r.doors) {
      var AS3d = AS();
      for (var i = 0; i < r.doors.length; i++) {
        var dr = r.doors[i];
        var doorTint = r.cleared ? 0xffd489 : 0x4a4f5a;
        var isStair = dr.kind === 'stair';
        var doorShape = function () {
          var sg = new T.Group();
          box(sg, 0, 14, 0, 24, 28, 8, doorTint, r.cleared ? 'glow' : 'flat', false);
          return sg;
        };
        /* 마지막 방의 문(다음 층으로 내려가는 자리)만 실물 계단으로 갈아
           끼운다 — 2D 의 🪜 표시와 같은 신호를 3D 도 갖게 하려는 것이다.
           GLB 를 못 받으면 다른 문과 같은 아치 도형으로 조용히 돌아간다 */
        var drnode = AS3d ? AS3d.build(isStair ? 'dg:stairs' : 'dg:door',
          'room:door:' + i, isStair ? 42 : 30, doorTint, doorShape) : doorShape();
        drnode.position.set(W, 0, dr.y);
        drnode.rotation.y = Math.PI / 2;
        wallGroup.add(drnode);
        /* 열림 신호는 색(tint)만으론 부족하다(모델은 emissive 로 안 빛난다) —
           2D 가 오래 쓰던 "풀리면 금빛" 신호를 작은 발광 표식으로 보탠다 */
        if (r.cleared) { box(wallGroup, W - 6, 16, dr.y, 6, 20, 6, 0xffd489, 'glow', false); }
      }
    }
  }

  /** 2026-09-06 — 인스턴싱 대상 여덟 가지(뼈대 애니메이션 없는 순수 자연물).
   *  `js/field-instance.js` 참고. mul 공식은 옛 piece() 가 AS3.build() 에 넘기던
   *  값을 그대로 옮긴 것 — 여기서 바꾸면 GLB 크기가 달라진다. */
  var NATURAL_KIND = { tree: 1, tree_dead: 1, rock: 1, bush: 1, grass: 1, flower: 1, mushroom: 1, log: 1 };
  var NATURAL_MUL = {
    tree: function (p, s) { return p.h * 1.35 * s; },
    tree_dead: function (p, s) { return p.h * 1.2 * s; },
    rock: function (p, s) { return p.h * 0.9 * s; },
    bush: function (p, s) { return p.h * 1.6 * s; },
    grass: function (p, s) { return p.h * 1.6 * s; },
    flower: function (p, s) { return p.h * 1.6 * s; },
    mushroom: function (p, s) { return p.h * 1.6 * s; },
    log: function (p, s) { return p.h * 1.0 * s; }
  };
  function natItem(F, p, seed, W, H) {
    var s = p.s || 1;
    return {
      kind: p.t, seed: seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
      x: p.x, y: F.heightAt(p.x, p.z, seed, W, H), z: p.z, rot: p.rot || 0,
      h: p.h, s: s, mul: NATURAL_MUL[p.t](p, s)
    };
  }

  /* ── 들판 (2단계) ────────────────────────────────────
   * `field3d.js` 가 **무엇이 어디 서는지**를 값으로 낸다. 여기서는 그 목록을 받아
   * 도형으로 세우기만 한다 — 판단과 그림을 갈라 둔 것이다(진단이 값만 본다).
   *
   * 나무·바위·덤불·풀·꽃·버섯·통나무·죽은나무(정적 자연물 여덟 가지)는 개별
   * `piece()` 대신 한꺼번에 모아 `field-instance.js`(InstancedMesh)로 세운다 —
   * 조각마다 개별 draw call 이 붙던 자리를 kind·GLB 파일당 몇 개로 줄인다.
   * 모듈이 없으면(방어적 기본값) 옛 방식(개별 piece())으로 그대로 돌아간다.
   */
  /* 2026-09-08 — "움직이면 끊긴다" 실기기 로그 실측(LOW 등급인데도
     ema=82ms). 범인은 이 함수 자신이었다 — 칸(최대 (2R+1)² 개)마다 땅 한
     장·초목·바위를 전부 **한 프레임에** 동기로 짓는다. 재구성 빈도를
     줄여도(위 fldStep) 재구성 자체의 무게는 그대로라 걸을 때마다 한 번씩
     그 무게가 통째로 튄다. 통짜 함수를 "시작"(창 정하고 짤 칸 목록만 세움)과
     "한 조각 짓기"로 쪼개, 매 프레임 예산(FIELD_BUILD_BUDGET_MS)만큼만
     짓고 나머지는 다음 프레임으로 넘긴다 — 총 짓는 시간은 같아도 한 프레임에
     몰리지 않아 히트(hitch)가 없다. */
  var fieldJob = null;
  var FIELD_BUILD_BUDGET_MS = 4;

  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /** 창을 정하고 지을 칸 목록만 세운다 — 무거운 건 하나도 안 짓는다(순간). */
  function buildField(run, cx0, cz0, keepOld) {
    var F = global.DG.field3d;
    if (!fieldGroup) { return; }
    /* 진행 중이던 뒷공사는 버린다(새 창이 이긴다) */
    if (fieldNext) { scene.remove(fieldNext); fieldNext = null; }
    var wm = worldFieldOn(run);
    if (keepOld && F && FIELD()) {
      /* 뒤에서 짓기 — 옛 들판은 끝날 때까지 그대로 보인다(fieldJobFinalize 가 갈아 끼운다) */
      fieldNext = new T.Group();
      fieldNext.visible = false;
      scene.add(fieldNext);
      fieldTarget = fieldNext;
      fieldJob = null;
      buildFieldJob(run, cx0 | 0, cz0 | 0, wm, F);
      return;
    }
    fieldTarget = fieldGroup;
    /* 걸어서 들판 창이 옮겨갈 때마다(fwRk 변경) 여기가 **동기로** 도는데,
       세운 반경이 넓을수록(natItems 인스턴싱 전이면 조각 하나하나가 개별
       Mesh라) fieldGroup 자식이 수백 개까지도 간다. 앞에서부터 지우면
       Object3D.remove() 의 indexOf+splice 가 매번 배열을 통째로 당겨
       O(n²)가 돼, 이 한 줄이 "걸으면 멈췄다가 다시 움직인다"는 제보의
       바로 그 순간(들판 창 재구성 프레임)에 정확히 걸린다 — buildRoom()
       에서 먼저 찾은 것과 같은 패턴(감사, 2026-09-08). 뒤에서부터
       지우면 O(n). */
    for (var fgi = fieldGroup.children.length - 1; fgi >= 0; fgi--) { fieldGroup.remove(fieldGroup.children[fgi]); }
    fieldJob = null;
    if (!F || !FIELD()) { fieldKey = null; return; }
    /* PLAN §57 — cx0,cz0(호출부가 플레이어 쪽으로 맞춰 준 창 중심, 없으면
       0=방 중심)만큼 통째로 밀어 짓는다. anc는 그대로라 seed 산식(cx,cz를
       그대로 먹는 heightAt/chunkAt/clutterAt)은 안 바뀐다 — 창이 옮겨가도
       "같은 자리는 늘 같은 지형"이 유지된다. */
    cx0 = cx0 | 0; cz0 = cz0 | 0;
    buildFieldJob(run, cx0, cz0, wm, F);
  }

  /** 지을 칸 목록과 공사 묶음(fieldTarget)을 정한다 — 무거운 건 하나도 안 짓는다 */
  function buildFieldJob(run, cx0, cz0, wm, F) {
    var W = d().ROOM_W, H = d().ROOM_H;
    var DD = global.DG.dataDungeon;
    var th = run.theme || (DD ? DD.themeOf(run.floor) : null);
    var seed = F.seedOf(run.floor, run.roomIdx, th && th.name);
    var R = fieldVisR(run), dens = FIELD_D();
    var stone = themeHex(run);
    /* 땅 밑색 — 원래 0.62 로 무조건 `0x141018`(거의 검정) 쪽에 바짝 붙여
       **실기기 "들판에 새까만 사각형"** 으로 이어졌다(2026-09-04, 세 번째
       재조사). 마을(town)의 조명(`lightPlan`의 ambient 0.86·key 1.15)은
       던전보다 훨씬 밝은데, 바탕색 자체가 이미 짙으면 Lambert 재질은
       빛을 아무리 받아도 그 짙기를 못 넘는다 — 길(0x4a3f30, 밝은 갈색)
       조각만 점점이 놓인 옆에서 나머지 땅이 통째로 새까맣게 도드라져
       보인 것이 이 값이었다(고립 시험 `_inspect_black_tmp.html`로 실측:
       0.62일 때 화면 RGB 20,12,7 — 사실상 검정, 0.15로는 35,24,13으로
       뚜렷이 갈색이 남는다). 마을만 옅게 — 던전 안(지하) 특유의 어두운
       분위기는 그대로 둔다(그쪽은 제보가 없었다, `lightPlan`도 원래 어둡게
       짠 자리라 손 안 댐). */
    var groundK = run.town ? -0.4 : 0.62;   // W-0111 — 마을은 음수 = 흰 쪽으로 섞는다(0.15 로 검정 쪽에 섞으니 3D 마을 평균 밝기 15/255)
    var FI = global.DG.fieldInstance;

    /* 2026-09-08 — "맵이 없는 데는 낭떨어지 같다" 제보. 세운 반경(R칸) 밖은
       지금까지 아무 것도 없어, 안개가 다 덮기 전까지는 배경색 허공이 그대로
       드러났다(LOW처럼 R이 작을수록 두드러진다 — 카메라 거리가 세운
       가장자리보다 멀 수 있어 아래 안개 클램프와 다투는 자리이기도 하다).
       세운 칸보다 한참 낮은 자리에 아주 큰 민무늬 판 하나(그림자 없음,
       draw call 1개뿐)를 깔아 "끊긴 낭떨어지" 대신 "저 멀리 낮은 벌판"으로
       보이게 한다 — 칸별 비용은 그대로다(buildField 한 번에 하나뿐). */
    var skirt = groundBox(fieldTarget, cx0 * F.CHUNK, -260, cz0 * F.CHUNK, 6000, 40, 6000,
      groundK < 0 ? mix(stone, 0xffffff, -groundK) : mix(stone, 0x141018, groundK), false);
    skirt.receiveShadow = false;

    var coords = [];
    for (var cz = cz0 - R; cz <= cz0 + R; cz++) {
      for (var cx = cx0 - R; cx <= cx0 + R; cx++) { coords.push(cx, cz); }
    }
    fieldJob = {
      F: F, coords: coords, idx: 0, W: W, H: H, seed: seed, R: R, dens: dens,
      stone: stone, groundK: groundK, th: th, FI: FI, natItems: FI ? [] : null,
      corridors: run.corridors, wm: wm, g: fieldTarget
    };
    lastFieldWm = wm;
  }

  /**
   * 고정 세계 지도 칸 하나(§5.12) — 세계 칸 좌표·세계 좌표 그대로 짓는다(fieldGroup 을
   * 앵커만큼 밀어 화면 로컬로 맞춘다, render 참고). 소품은 충돌(dungeon.fieldBlockedAt)이
   * 읽는 **같은 배열**이다 — 밀도(그래픽 등급)로 나무 수를 줄이지 않는다(줄이면 안 보이는 나무에 막힌다).
   * 마을 발판(ring 0)은 땅만 조금 낮게 깐다 — 지금 마을의 바닥이 그 위를 덮는다.
   */
  function fieldJobChunkWorld(J, cx, cz) {
    var WM = global.DG.worldMap, F = J.F, C = F.CHUNK, i;
    var inf = WM.info(cx, cz, J.W, J.H);
    if (!inf) { return; }
    var tile = fieldTileBox(J.g, cx * C + C / 2, inf.ring === 0 ? -7 : -6, cz * C + C / 2,
      C + 2, 12, C + 2, J.groundK < 0 ? mix(inf.region.ground, 0xffffff, -J.groundK) : mix(inf.region.ground, 0x141018, J.groundK), false);
    tile.receiveShadow = true;
    if (inf.ring === 0) { return; }
    var list = WM.pieces(cx, cz, J.W, J.H);
    for (i = 0; i < list.length; i++) {
      if (J.FI && NATURAL_KIND[list[i].t]) { J.natItems.push(natItem(F, list[i], inf.seed, J.W, J.H)); }
      else { piece(list[i], inf.seed, J.W, J.H, J.stone); }
    }
    var deco = WM.clutter(cx, cz, J.W, J.H, J.dens);
    for (i = 0; i < deco.length; i++) {
      if (J.FI && NATURAL_KIND[deco[i].t]) { J.natItems.push(natItem(F, deco[i], inf.seed, J.W, J.H)); }
      else { piece(deco[i], inf.seed, J.W, J.H, J.stone); }
    }
  }

  /** 칸 하나 — 옛 buildField() 이중 루프의 몸통 그대로(짓는 내용은 안 바뀜) */
  function fieldJobChunk(J, cx, cz) {
    if (J.wm) { fieldJobChunkWorld(J, cx, cz); return; }
    var F = J.F, W = J.W, H = J.H, seed = J.seed, dens = J.dens, stone = J.stone,
      groundK = J.groundK, th = J.th, FI = J.FI, natItems = J.natItems, i;
    var ring = F.ringOf(cx, cz, W, H);
    if (ring === 0) { return; }               // 방이 걸친 조각은 방 바닥이 맡는다
    var gx = cx * F.CHUNK, gz = cz * F.CHUNK;
    var hh = F.heightAt(gx + F.CHUNK / 2, gz + F.CHUNK / 2, seed, W, H);
    var tile = fieldTileBox(J.g, gx + F.CHUNK / 2, hh - 6, gz + F.CHUNK / 2,
      F.CHUNK + 2, 12, F.CHUNK + 2, groundK < 0 ? mix(stone, 0xffffff, -groundK) : mix(stone, 0x141018, groundK), false);
    tile.receiveShadow = true;

    /* 통로(PLAN §28-2 Phase 3, §28-4 Phase 2·3) — 이 조각이 마을 사이
       통로의 결 안이면 목적지 테마(`통로:<id>`)로, 던전 계단문 통로의
       결 안이면 `통로:계단`으로, 그 밖(방-방 통로 포함)은 지금 층/마을
       테마로. `run.corridors`가 없으면 늘 null — fieldBlockedAt()과
       정확히 같은 판정을 쓴다. */
    var cTheme = (J.corridors && F.corridorNameAt) ? F.corridorNameAt(cx, cz, W, H, J.corridors) : null;
    /* th.biome(PLAN §28-8 Phase 3) — dungeon.js의 fieldBlockedAt과
       같은 이유로 같은 자리에 같은 순서로 얹었다(그림 대 판정이
       어긋나면 안 된다). seed(위)는 그대로 th.name — 마을마다 고유한
       지형 패턴은 유지하고, 가중치 표만 biome으로 묶는다. */
    var list = F.chunkAt(cx, cz, seed, ring, dens, cTheme || (th && (th.biome || th.name)));
    for (i = 0; i < list.length; i++) {
      if (FI && NATURAL_KIND[list[i].t]) { natItems.push(natItem(F, list[i], seed, W, H)); }
      else { piece(list[i], seed, W, H, stone); }
    }
    /* 잡초 층 — 순수 장식(판정 안 닿음), field3d.js clutterAt() 참고.
       `th`(층 테마)를 같이 넘긴다 — PLAN 9절 Biome, 2026-09-05 field3d.js
       kindOf() 감사 참고: 색깔만 다르고 오브젝트 비율은 안 갈리던 것을 고쳤다 */
    if (F.clutterAt) {
      var deco = F.clutterAt(cx, cz, seed, ring, dens, cTheme || (th && (th.biome || th.name)));
      for (i = 0; i < deco.length; i++) {
        if (FI && NATURAL_KIND[deco[i].t]) { natItems.push(natItem(F, deco[i], seed, W, H)); }
        else { piece(deco[i], seed, W, H, stone); }
      }
    }
  }

  /** 목록을 다 돌면 인스턴싱 마무리 — 옛 buildField() 꼬리 그대로 */
  function fieldJobFinalize(J) {
    var natItems = J.natItems, FI = J.FI, i;
    if (FI && natItems && natItems.length) {
      var built = FI.build(natItems);
      if (built && built.children && built.children.length) { J.g.add(built); }
      else {
        /* 방어적 — 인스턴싱이 뭔가 잘못돼(폴백조차 못 세웠으면) 아무것도
           안 보이는 것보다는 옛 개별 piece() 방식으로 되돌아간다. */
        for (i = 0; i < natItems.length; i++) {
          var ni = natItems[i];
          piece({ t: ni.kind, x: ni.x, z: ni.z, s: ni.s, rot: ni.rot, h: ni.h }, J.seed, J.W, J.H, J.stone);
        }
      }
    }
    fieldKey = J.seed + ':' + J.R + ':' + Math.round(J.dens * 100);
    /* 뒤에서 지은 것이면 이제 옛 들판을 걷고 한 번에 갈아 끼운다(뒤에서부터 옮겨 O(n)) */
    if (J.g && J.g !== fieldGroup) {
      for (i = fieldGroup.children.length - 1; i >= 0; i--) { fieldGroup.remove(fieldGroup.children[i]); }
      while (J.g.children.length) { fieldGroup.add(J.g.children[J.g.children.length - 1]); }
      scene.remove(J.g);
      if (fieldNext === J.g) { fieldNext = null; }
    }
  }

  /** 매 프레임 부른다 — 진행 중인 들판 공사가 있으면 예산만큼만 이어 짓는다. */
  function fieldJobStep() {
    if (!fieldJob) { return; }
    lastFrameHadBuild = true;   // 조각 몇 개라도 지었으면 이 프레임 측정치도 평균에서 뺀다
    var J = fieldJob;
    fieldTarget = J.g || fieldGroup;
    var deadline = nowMs() + FIELD_BUILD_BUDGET_MS;
    while (J.idx < J.coords.length && nowMs() < deadline) {
      var cx = J.coords[J.idx], cz = J.coords[J.idx + 1];
      J.idx += 2;
      fieldJobChunk(J, cx, cz);
    }
    if (J.idx >= J.coords.length) {
      var finT0 = nowMs();
      fieldJobFinalize(J);
      lastFieldFinalizeMs = nowMs() - finT0;
      fieldJob = null;
      fieldTarget = null;
    }
  }

  /** 들판 조각 하나를 도형으로 세운다 — 나무·바위는 사가만리와 같은 GLB, 나머지는
   *  여전히 도형이다(PLAN 4절의 우선순위 ⑤나무 ⑥바위까지만 이번에 옮겼다) */
  function piece(p, seed, W, H, stone) {
    var F = global.DG.field3d;
    var g = fieldTarget || fieldGroup;
    var y = F.heightAt(p.x, p.z, seed, W, H);
    var s = p.s || 1;
    var AS3 = AS();
    if (p.t === 'tree') {
      var treeShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.22, 0, 9 * s, p.h * 0.44, 9 * s, 0x3a2c1e, 'flat', true);
        box(sg, 0, p.h * 0.68, 0, p.h * 0.62 * s, p.h * 0.7, p.h * 0.62 * s, 0x24361f, 'flat', true);
        return sg;
      };
      var tnode = AS3 ? AS3.build('tree', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.35 * s, null, treeShape) : treeShape();
      tnode.position.set(p.x, y, p.z);
      tnode.rotation.y = p.rot || 0;
      g.add(tnode);
    } else if (p.t === 'tree_dead') {
      /* 늪(swamp) 전용 — 잎이 없는 마른 줄기 하나만 남긴다(뭉치 없이) */
      var deadShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.5, 0, 7 * s, p.h, 7 * s, 0x2a2016, 'flat', true);
        return sg;
      };
      var dtnode = AS3 ? AS3.build('tree_dead', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.2 * s, null, deadShape) : deadShape();
      dtnode.position.set(p.x, y, p.z);
      dtnode.rotation.y = p.rot || 0;
      g.add(dtnode);
    } else if (p.t === 'rock') {
      var rockShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.4, 0, p.h * 1.3 * s, p.h * 0.9, p.h * 1.1 * s, mix(stone, 0x000000, 0.35), 'flat', true);
        return sg;
      };
      var rnode = AS3 ? AS3.build('rock', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 0.9 * s, null, rockShape) : rockShape();
      rnode.position.set(p.x, y, p.z);
      rnode.rotation.y = p.rot || 0;
      g.add(rnode);
    } else if (p.t === 'pillar') {
      /* 폐허의 부러진 기둥 — 꼭 맞는 낱개 기둥 에셋이 없어 무너진 아치(Arch)로
         대신한다(사가만리가 이미 "사당·폐허의 다른 후보"로 적어 둔 것) */
      var pillarShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 16, p.h, 16, mix(stone, 0xffffff, 0.12), 'flat', true);
        return sg;
      };
      var pnode = AS3 ? AS3.build('pillar', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h, null, pillarShape) : pillarShape();
      pnode.position.set(p.x, y, p.z);
      g.add(pnode);
    } else if (p.t === 'wall') {
      var wallShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 90, p.h, 14, mix(stone, 0x000000, 0.2), 'flat', true);
        return sg;
      };
      var wnode = AS3 ? AS3.build('wall', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h, null, wallShape) : wallShape();
      wnode.position.set(p.x, y, p.z);
      wnode.rotation.y = p.rot || 0;
      g.add(wnode);
    } else if (p.t === 'path') {
      var pt = box(g, p.x, y + 1, p.z, F.CHUNK + 2, 3, 46, 0x4a3f30, 'flat', false);
      pt.rotation.y = p.rot;
      pt.receiveShadow = true;
      /* PLAN §6.1 마지막 조각(길 데칼, road3d.js, 2026-09-19) — 단색 상자
         대신 흙 텍스처 + 가장자리 알파 페이드로 갈아 끼운다. 못 받으면
         (자가진단 등, three 없음) 위 단색 상자 그대로 남는다(fallback) */
      var RD = global.DG.road3d;
      var roadMat = RD ? RD.material((F.CHUNK + 2) / TILE) : null;
      if (roadMat) { pt.material = roadMat; }
    } else if (p.t === 'post') {
      /* 2026-09-05 — 표지판을 실사화(Kenney CC0 'signpost', asset3d.js 참고).
         못 받으면 옛 도형(기둥+판)으로 그대로 돌아간다 */
      var postShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 6, p.h, 6, 0x5a4a34, 'flat', true);
        box(sg, 0, p.h, 0, 30, 8, 4, 0x6b5a3f, 'flat', false);
        return sg;
      };
      var pnode = AS3 ? AS3.build('post', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.15, null, postShape) : postShape();
      pnode.position.set(p.x, y, p.z);
      pnode.rotation.y = p.rot || 0;
      g.add(pnode);
    } else if (p.t === 'pond') {
      /* 2026-09-05 — 단색 반투명 상자를 실제 에셋(바위 고리+연잎+물결 데칼,
         'pond' 키, `asset3d.js` 참고)으로 갈아 끼웠다. `normalize()`는
         세로(Y) 기준으로만 배율을 잡는데 이 에셋은 **가로로 넓은** 지형물이라,
         원본의 가로:세로 비(약 2.35:1)를 거꾸로 풀어 원하는 가로 폭에 맞는
         mul(세로)을 역산한다 — 그래야 결과 가로 폭이 옛 상자와 같은 자리에
         맞아떨어진다. 못 받으면(단독판 등) 옛 상자 그대로 돌아간다(fallback) */
      var pondW = F.CHUNK * 0.8 * s;
      var pondMul = pondW * 0.4247;
      var pondShape = function () {
        var sg = new T.Group();
        var pd = box(sg, 0, 2, 0, pondW, 3, F.CHUNK * 0.7 * s, 0x1f4a63, 'flat', false);
        pd.material = mat(0x1f4a63, 'water');
        return sg;
      };
      var pdnode = AS3 ? AS3.build('pond', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        pondMul, null, pondShape) : pondShape();
      pdnode.position.set(p.x, y, p.z);
      pdnode.rotation.y = ((Math.round(p.x) + Math.round(p.z)) % 360) * Math.PI / 180;
      g.add(pdnode);
    } else if (p.t === 'reed') {
      /* 갈대는 이 판에 GLB 가 없다(위 §6.4) — 도형 그대로, 그래서 늘 흔들린다 */
      box(g, p.x, y + p.h / 2, p.z, 3, p.h, 3, 0x3f5a34, 'sway', false);
    } else if (p.t === 'cavemouth') {
      /* 동굴 입구 — 사가만리가 이미 "광산 어귀"로 적어 둔 그 Mine 을 세운다 */
      var caveShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h * 0.45, 0, p.h * 1.5, p.h, p.h * 1.2, mix(stone, 0x000000, 0.5), 'flat', true);
        return sg;
      };
      var cvnode = AS3 ? AS3.build('cavemouth', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.3, null, caveShape) : caveShape();
      cvnode.position.set(p.x, y, p.z);
      cvnode.rotation.y = p.rot || 0;
      g.add(cvnode);
      /* 입구는 **새까맣다** — 빛이 안 닿는 자리가 있어야 굴로 보인다(GLB 위에도 그대로 얹는다) */
      box(g, p.x, y + p.h * 0.3, p.z + p.h * 0.6, p.h * 0.5, p.h * 0.55, 6,
        0x000000, '', false).rotation.y = p.rot;
    } else if (p.t === 'altar') {
      /* 제단 — 사가만리가 "사당" 후보로 적어 둔 Temple 을 세운다. 도형이 얹던
         떠 있는 보랏빛 구슬은 **표식이라 그대로 남긴다**(멀리서도 제단인 줄 안다) */
      var altarShape = function () {
        var sg = new T.Group();
        box(sg, 0, 6, 0, 60, 12, 60, mix(stone, 0xffffff, 0.2), 'flat', true);
        box(sg, 0, p.h * 0.6, 0, 20, p.h * 0.8, 20, 0x4a3f6b, 'flat', true);
        return sg;
      };
      var alnode = AS3 ? AS3.build('altar', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.1, null, altarShape) : altarShape();
      alnode.position.set(p.x, y, p.z);
      g.add(alnode);
      box(g, p.x, y + p.h + 6, p.z, 14, 14, 14, 0xc9a3ff, 'glow', false);
    } else if (p.t === 'tent') {
      /* 천막 — 2026-09-04, saga-forest 가 받아 둔 진짜 텐트(survival_pack,
         CC0)로 갈아 끼웠다. 옛 대역(MarketStand)은 행상 좌판만의 `stall`
         키로 옮겨 갔다(위 buildActor() 의 POI: Merchant 참고) */
      var tentShape = function () {
        var sg = new T.Group();
        box(sg, 0, p.h / 2, 0, 44, p.h, 40, 0x5a4a3a, 'flat', true);
        return sg;
      };
      var tenode = AS3 ? AS3.build('tent', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h, null, tentShape) : tentShape();
      tenode.position.set(p.x, y, p.z);
      tenode.rotation.y = p.rot || 0;
      g.add(tenode);
    } else if (p.t === 'fire') {
      /* 모닥불 — 2026-09-04, saga-forest 가 받아 둔 medieval_village_pack 의
         Bonfire_Lit(CC0)로 갈아 끼웠다. 잿더미+불씨 도형은 fallback 으로 남긴다 */
      var fireShape = function () {
        var sg = new T.Group();
        box(sg, 0, 4, 0, 26, 8, 26, 0x2f2a24, 'flat', false);
        box(sg, 0, p.h, 0, 14, 16, 14, 0xff7a2a, 'glow', false);
        return sg;
      };
      var finode = AS3 ? AS3.build('campfire', seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.6, null, fireShape) : fireShape();
      finode.position.set(p.x, y, p.z);
      g.add(finode);
    } else if (p.t === 'grass' || p.t === 'flower' || p.t === 'bush' ||
               p.t === 'mushroom' || p.t === 'log') {
      /* 잡초 층(field3d.js clutterAt()) — 순수 장식. 종류마다 도형 fallback 을
         다르게 둬서 GLB 가 못 오는 자리(file:// 단독판 등)에서도 그 성격이 읽힌다 */
      var clutterCol = p.t === 'flower' ? 0xd88fc0 : (p.t === 'log' ? 0x4a3826 :
        (p.t === 'mushroom' ? 0xc94f4f : 0x3f5a34));
      /* 풀·꽃·덤불만 바람에 흔든다(PLAN §6.1-5 나머지 절반, sway3d.js) — 통나무·
         버섯은 뿌리·갓이 뻣뻣해 그대로 'flat' */
      var clutterOpt = (p.t === 'grass' || p.t === 'flower' || p.t === 'bush') ? 'sway' : 'flat';
      var clutterShape = function () {
        var sg = new T.Group();
        if (p.t === 'log') { box(sg, 0, p.h / 2, 0, p.h * 2.2, p.h, p.h * 0.9, clutterCol, clutterOpt, false); }
        else { box(sg, 0, p.h / 2, 0, p.h * 0.7, p.h, p.h * 0.7, clutterCol, clutterOpt, false); }
        return sg;
      };
      var clnode2 = AS3 ? AS3.build(p.t, seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * (p.t === 'log' ? 1 : 1.6) * s, null, clutterShape) : clutterShape();
      clnode2.position.set(p.x, y, p.z);
      clnode2.rotation.y = p.rot || 0;
      g.add(clnode2);
    } else if (p.t === 't_factory' || p.t === 't_solar' || p.t === 't_tower' ||
               p.t === 't_pylon' || p.t === 't_hologram') {
      /* §5.7 시대 퓨전(2026-09-18) — biome 마다 하나(field3d.js eraLayerAt()).
         전부 실제 GLB 가 없다(현대·미래 소품 팩을 아직 못 구했다) — PLAN
         원문이 "CC0 조합 또는 절차 생성" 둘 다 열어 둬 이번엔 절차 생성으로
         간다. 나중에 GLB 를 구하면 AS3.build 의 이 키로만 등록하면
         자동으로 갈아 끼워진다(다른 소품과 같은 결). */
      var eraShape = function () {
        var sg = new T.Group();
        if (p.t === 't_factory') {
          /* 고분 옆 폐공장 굴뚝 — 붉은 벽돌색 원통 모양(상자로 근사) + 검은 아가리 */
          box(sg, 0, p.h * 0.5, 0, 22, p.h, 22, 0x5a3a30, 'flat', true);
          box(sg, 0, p.h, 0, 14, 6, 14, 0x1a1a1a, 'flat', false);
        } else if (p.t === 't_solar') {
          /* 기와집 옆 태양광 판 — 기둥 하나 + 기울어진 짙은 남색 판 */
          box(sg, 0, p.h * 0.32, 0, 5, p.h * 0.64, 5, 0x5a5a5a, 'flat', true);
          var panel = box(sg, 0, p.h * 0.62, 0, 46, 4, 30, 0x1c3a5e, 'flat', true);
          panel.rotation.x = -0.4;
        } else if (p.t === 't_tower') {
          /* 늪 위 녹슨 관측탑 — 가는 기둥 넷 + 꼭대기 전망대(녹슨 주황) */
          var lp = 16;
          box(sg, lp, p.h * 0.5, lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, -lp, p.h * 0.5, lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, lp, p.h * 0.5, -lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, -lp, p.h * 0.5, -lp, 6, p.h, 6, 0x6b4a34, 'flat', true);
          box(sg, 0, p.h, 0, 44, 10, 44, 0x9a5a2e, 'flat', true);
        } else if (p.t === 't_pylon') {
          /* 산채에 케이블카 기둥 — 회색 격자 기둥 + 가로 활대 */
          box(sg, 0, p.h * 0.5, 0, 14, p.h, 14, 0x7a7f88, 'flat', true);
          box(sg, 0, p.h * 0.96, 0, 64, 6, 10, 0x5a5f68, 'flat', true);
        } else {
          /* 사당에 홀로그램 비석 — 돌 받침(제단과 같은 재질) + 청록 발광 기둥 */
          box(sg, 0, 6, 0, 40, 12, 40, mix(stone, 0xffffff, 0.2), 'flat', true);
          box(sg, 0, p.h * 0.5, 0, 16, p.h * 0.9, 4, 0x5adfe8, 'glow', false);
        }
        return sg;
      };
      var eranode = AS3 ? AS3.build(p.t, seed + ':' + Math.round(p.x) + ':' + Math.round(p.z),
        p.h * 1.1, null, eraShape) : eraShape();
      eranode.position.set(p.x, y, p.z);
      eranode.rotation.y = p.rot || 0;
      g.add(eranode);
    }
  }

  function mix(a, b, k) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) |
           (Math.round(ag + (bg - ag) * k) << 8) |
            Math.round(ab + (bb - ab) * k);
  }

  /* ── 맞은 순간 번쩍인다 (3단계 · PLAN 51절 Hit Flash) ──────
   * 재질은 `mat()` 이 색마다 하나씩 만들어 모든 배우가 나눠 쓴다.
   * 그대로 만지면 적 하나가 맞을 때 방 전체가 번쩍인다 —
   * 그래서 **몸통만** 사본을 들려 준다.
   */
  function ownMat(m) { m.material = m.material.clone(); return m.material; }

  /* ── 배우 ───────────────────────────────────────────
   * 사람과 적을 도형으로 조립한다. 원작 에셋은 안 쓴다 —
   * 크기·색만 판정에서 읽어 온다(체력·등급이 그림에 드러나야 한다).
   */
  /* ── 이름표 ─────────────────────────────────────────
   * 마을에서는 **누구인지가 곧 기능**이다 — 야장에게 가야 물건을 박고, 행상에게
   * 가야 산다. 2D 는 머리 위에 글자를 얹어 그것을 알렸다. 3D 에서 그 글자가
   * 사라지면 마당에 사람 여섯이 말없이 서 있는 그림이 된다.
   * 글자판은 이름마다 하나만 만들어 두고 돌려 쓴다(아홉 장이면 끝이다).
   */
  var labelTexCache = {};
  function labelTex(text) {
    if (labelTexCache[text]) { return labelTexCache[text]; }
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var c = cv.getContext('2d');
    c.font = '600 27px "Malgun Gothic", system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var w = Math.min(248, c.measureText(text).width + 22);
    c.fillStyle = 'rgba(6,7,10,0.62)';
    c.fillRect((256 - w) / 2, 13, w, 38);
    c.fillStyle = '#f2e4c2';
    c.fillText(text, 128, 33);
    var t = new T.CanvasTexture(cv);
    t.needsUpdate = true;
    labelTexCache[text] = t;
    return t;
  }

  /** 이름표 한 장 — 카메라를 늘 마주 본다. `depthTest` 를 끈 것은 기둥 뒤에
      선 사람도 누구인지 읽히게 하려는 것이다(마을이라 그래도 된다) */
  function labelNode(text, y, w) {
    var m = new T.SpriteMaterial({ map: labelTex(text), transparent: true, depthTest: false });
    var s = new T.Sprite(m);
    s.position.set(0, y, 0);
    s.scale.set(w, w / 4, 1);
    s.userData.w = w;
    return s;
  }
  /** 세로 폰 — 가로 시야가 좁아 이름표 한 장이 화면 폭 절반을 덮었다(2026-09-27 실기 신고
      "세로 화면에 뜨는 게 너무 많다"). 화면비만큼 줄이되 0.62배 밑으로는 안 내린다 */
  function labelK() {
    var asp = camera && camera.aspect || 1;
    return asp < 1 ? Math.max(0.62, asp * 1.35) : 1;
  }

  /**
   * 마을의 사람·표식 하나에 "말이 걸리나" 를 입힌다.
   * 이름표 아홉 장이 늘 같은 진하기로 떠 있으면 마당이 글자로 덮인다 —
   * **멀리 있는 것은 흐리게**, 말이 걸리는 거리에 들면 진하게 하고 발밑 고리를 켠다.
   */
  function townMark(node, dist, talkR) {
    var near = dist < talkR;
    if (node.userData.ring) { node.userData.ring.visible = near; }
    var lb = node.userData.label;
    if (lb && lb.material) {
      lb.material.opacity = near ? 1 : core.clamp(1 - (dist - talkR) / 260, 0.34, 0.9);
      var lw = (lb.userData.w || lb.scale.x) * labelK();
      if (lb.scale.x !== lw) { lb.scale.set(lw, lw / 4, 1); }
    }
  }

  function hexOf(css, def) {
    if (!css) { return def; }
    var n = parseInt(String(css).replace('#', ''), 16);
    return isNaN(n) ? def : n;
  }

  /** asset3d — 사가만리와 같은 것을 쓴다(사가나락 4단계, `assets/ASSET_LICENSES.md`) */
  function AS() { return global.DG.asset3d; }
  /** 몸짓(§5.16, `gesture.js`) — 손잡이 dungeon.gesture 가 0 이면 plan 이 늘 base 를 돌려준다 */
  function GS() { return global.DG.gesture; }

  /** 몸짓 글자 풍선 — 머리 위로 살짝 떠오르며 처음·끝에 옅어진다. 글자가 바뀔 때만 새로 짓는다 */
  function gestureBubble(node, g, y) {
    var u = node.userData, text = g && g.text;
    if (!text) { if (u.bubble) { u.bubble.visible = false; } return; }
    if (!u.bubble || u.bubbleText !== text) {
      if (u.bubble) { node.remove(u.bubble); }
      u.bubble = labelNode(text, y, 60);
      u.bubbleText = text;
      node.add(u.bubble);
    }
    var k = g.k || 0;
    u.bubble.visible = true;
    u.bubble.position.y = y + k * 6;
    u.bubble.material.opacity = core.clamp(Math.min(k * 6, (1 - k) * 4), 0, 1);
  }

  /** 로딩 우선순위(PLAN 39절) — 마을 한 곳이 GLB 36개를 부른다(집·나무·바위…,
   *  buildRoom()·buildField() 가 곧 부른다). 그런데 정작 화면에서 가장 먼저
   *  눈에 들어와야 할 **나(플레이어)·마을 사람**은 그 뒤 actorOf() 루프에서
   *  제일 나중에 요청돼 늘 꼴찌로 밀렸다(CDP로 실측 — 당시 기본 시드가 여전히
   *  리터럴 'me'라 골랐던 v20.glb 가 39개 중 31번째였다). 버림받는 GLB 는
   *  없다 — 그냥 **네트워크 큐에 올리는 순서**만 사람이 먼저다.
   *  `rawScene()` 은 아무것도 세우지 않고 캐시에 굽기만 하므로(부작용 없음),
   *  잠시 뒤 buildRoom()/buildField() 가 배경 소품을 부르고 나서 actorOf() 가
   *  같은 url 을 또 부르면 이미 도착해 있거나 대기열 앞자리에 있다.
   *  **2026-09-07** — `touch('me')` 리터럴을 `meRenderParams().seed`로 바꿨다.
   *  실제로 몸을 지을 때(`actorOf('me', ...)`→`meRenderParams()`)는 이미
   *  QRPG_SEEDS 로 묶여 있는데, 여기 프리페치만 옛 리터럴 'me'를 그대로 써서
   *  실제로 안 쓸 무거운 MPFB 몸(+7.6MB 리타깃 원본)을 헛되이 큐에 올리고
   *  있었다 — 우선순위를 아무리 앞으로 당겨도 그 자체가 헛수고였다. */
  function prefetchActors(run) {
    var AS3 = AS();
    if (!AS3 || !AS3.heroRecipe || !AS3.rawScene) { return; }
    function touch(seed) {
      if (!AS3.wants('hero', seed)) { return; }
      var rec = AS3.heroRecipe(seed);
      if (!rec) { return; }
      var noop = function () {};
      AS3.rawScene(rec.body, noop);
      if (rec.outfit) { AS3.rawScene(rec.outfit, noop); }
      if (rec.hair) { AS3.rawScene(rec.hair, noop); }
      AS3.rawScene(rec.anim || AS3.ANIM_SRC, noop);
    }
    touch(meRenderParams().seed);
    var ns = (run.room && run.room.npcs) || [];
    for (var i = 0; i < ns.length; i++) { if (!ns[i].model) { touch('npc:' + (ns[i].key || '')); } }   // 제 몸 손님(§5.20)은 사람 창고를 안 당긴다
  }

  /** 지역 진입 전 미리 로드(PLAN 39절 나머지 절반) — 들길(exit_*) 표식에
   *  다가서면(도착보다 한참 전, `PREFETCH_EXIT_R`) 그 목적지 마을의 건물
   *  종류(house·well·inn 등, `town.js`의 decor)를 `prefetchActors()`와
   *  같은 요령(`rawScene()`, 세우지 않고 캐시에만 굽는다)으로 미리 당긴다.
   *  마을마다 딱 한 번만(`prefetchedTowns`) — 다시 다가서도 헛수고 안 한다.
   *  이미 방문한 마을의 건물 종류(house·well 등)는 어차피 URL 캐시에
   *  남아 있어 이 함수가 새로 할 일이 없다 — **처음 가 보는 위성 마을의
   *  전용 건물**(inn·stable·mill 등 아직 한 번도 안 부른 것)에만 실제 효과가 있다. */
  var prefetchedTowns = {};
  var PREFETCH_EXIT_R = 240;
  function prefetchTownDest(toId) {
    if (prefetchedTowns[toId]) { return; }
    var AS3 = AS(), TW = global.DG.town;
    if (!AS3 || !AS3.REG || !AS3.rawScene || !TW || !TW.decorTypesOf) { return; }
    prefetchedTowns[toId] = true;
    var types = TW.decorTypesOf(toId), noop = function () {};
    for (var i = 0; i < types.length; i++) {
      var reg = AS3.REG[types[i]];
      if (!reg) { continue; }
      var list = Array.isArray(reg) ? reg : [reg];
      for (var j = 0; j < list.length; j++) {
        if (typeof list[j] === 'string') { AS3.rawScene(list[j], noop); }
      }
    }
  }

  /** 로딩 이음매 없애기(PLAN §28-2 Phase 4, 던전 굴혈 입구 전용으로 남음) —
   *  §28-8(2026-09-06, 오픈월드 A안)부터 town.js는 마을↔마을 exit_* 표식을
   *  더는 안 세운다(걸어서 자연히 건너간다) — `run.corridors`도 늘 비어
   *  있다. 그래서 여기 아래 `run.corridors` 분기는 이제 **아무 마을
   *  exit_* 에도 안 걸린다**(그런 마크 자체가 없다) — 실제로 남는 건
   *  `exit_dungeon`(굴혈) 하나뿐이고, 그건 늘 표식 자체 거리 fallback으로
   *  간다. **"이웃 마을 자산을 미리 당긴다"는 몫은 아래 새 함수
   *  `maybePrefetchNearbyTowns()`가 이어받았다** — 표식이 아니라 마을
   *  발판 자체와의 거리(`town.js`의 `nearbyTownIds`)로 건다. 이 함수와
   *  `run.corridors` 분기는 안 지웠다(굴혈 fallback 경로는 여전히 쓰이고,
   *  corridors 분기도 언젠가 되살릴 수 있어 남겨 둔다). */
  function maybePrefetchCorridor(run, mo, p) {
    var toId = mo.key.slice(5), TW = global.DG.town;
    var list = run && run.corridors, cor = null, i;
    if (list) {
      for (i = 0; i < list.length; i++) { if (list[i].to === toId) { cor = list[i]; break; } }
    }
    if (cor && TW && TW.exitPointRaw) {
      var ep = TW.exitPointRaw(cor.dir);
      if (Math.hypot(ep.x - p.x, ep.y - p.y) < PREFETCH_EXIT_R) { prefetchTownDest(toId); }
      return;
    }
    if (Math.hypot(mo.x - p.x, mo.y - p.y) < PREFETCH_EXIT_R) { prefetchTownDest(toId); }
  }

  /** 이웃 마을 자산 프리페치(PLAN §28-8 후속, 2026-09-06) — 위 주석이
   *  적어 둔 "지금 아무도 안 부른다"를 실제로 고친다. 마을 발판 자체와의
   *  거리(`town.js`의 `nearbyTownIds` — 활성 반경보다 넉넉히(900) 여유를
   *  둬 도착보다 한참 전에 걸린다)로 아직 활성은 아니지만 곧 활성이 될
   *  이웃을 매 프레임 값싸게(마을 104개라 해 봤자 O(수백)) 걸러, 그
   *  마을들의 decor 자산만 `prefetchTownDest()`(마을당 한 번만 실제로
   *  일한다)로 미리 굽는다. 마을일 때만 뜻이 있다(`run.town`). */
  function maybePrefetchNearbyTowns(run, p) {
    var TW = global.DG.town, i;
    if (!run.town || !TW || !TW.nearbyTownIds) { return; }
    var ids = TW.nearbyTownIds(p.x, p.y);
    for (i = 0; i < ids.length; i++) { prefetchTownDest(ids[i]); }
  }

  /** 던전 로딩 이음매(PLAN §28-4 Phase 4) — "먼저 재본다"고 적어 둔 대로
   *  코드부터 확인했다: 방 소품(`dg:pillar`·`dg:torch`·`dg:door`·`dg:stairs`
   *  등)은 `asset3d.js`의 `REG` 표가 전부 **단일 문자열**이라 방마다 똑같은
   *  URL 하나뿐이다 — 첫 방에서 한 번 받으면 그 뒤로는 어느 방이든 캐시
   *  그대로 쓴다(마을처럼 방마다 다른 GLB 가 없다, 그래서 §28-2 Phase 4와
   *  달리 소품 프리페치는 필요 없다). 그런데 **바닥·벽 텍스처(`pickTex()`)는
   *  다르다** — `FLOOR_TEX`/`WALL_TEX` 각각 석 장 중`seedOf(floor,roomIdx,salt)`
   *  로 방마다 새로 고른다(2026-09-04, 나무·바위처럼 방 씨앗으로 고르게 늘린
   *  자리 — 위 주석 참고). 그래서 같은 층 안에서도 방을 넘어갈 때마다 다른
   *  석 장 중 하나가 걸릴 수 있고, 그 URL 이 처음 걸리는 자리면 `buildRoom()`
   *  이 부르는 순간에야 `TextureLoader`가 비동기로 받아 **도착 전까지 민무늬
   *  색으로 잠깐 보인다** — 이것이 진짜 이음매다. `goRoom()`은 RNG 없이
   *  `roomIdx += 1`(고정), `descend()`도 `floor += 1`·`roomIdx = 0`(고정)이라
   *  다음 방의 (floor,roomIdx)를 미리 안다 — §28-2 Phase 4와 같은 요령으로
   *  통로 초입(문 근처, `PREFETCH_DOOR_R`)에서 그 텍스처만 미리 당긴다. */
  var prefetchedRoomTex = {};
  var PREFETCH_DOOR_R = 160;      // 문 통로(1 CHUNK=200)보다 짧게 — 도착 전에 반드시 걸린다
  /** 이 문을 넘으면 도착할 (floor,roomIdx) — 순수 함수, RNG 없음.
   *  `goRoom()`(dungeon.js)의 `roomIdx += 1`, `descend()`의 `floor += 1`·
   *  `roomIdx = 0`과 **정확히 같은 산수**를 미리 계산한다(자가진단이 이 둘을
   *  나란히 대조한다). */
  function nextRoomFor(run, co) {
    return co.kind === 'stair' ? { floor: run.floor + 1, roomIdx: 0 }
                               : { floor: run.floor, roomIdx: run.roomIdx + 1 };
  }
  /** `run.corridors`의 문별 통로(PLAN §28-4 Phase 2, `{dir,lane,laneAt,extra,kind}`)
   *  중 플레이어가 지금 결 안에 든 것들의 다음 방을 돌려준다 — **순수 함수다**
   *  (T·rawTex 등 3D 부작용 없음, 자가진단이 T 없이도 이 함수만 직접 본다).
   *  마을 통로(`corridorsFor()`)는 `laneAt`이 없어 여기서 자연히 걸러진다
   *  (`corridorNameAt()`/`corridorExtra()`와 같은 구분법). */
  function doorPrefetchTargets(run, p) {
    var list = run && run.corridors, out = [], edgeX, i, co;
    if (!list) { return out; }
    edgeX = d().ROOM_W - d().WALL;
    for (i = 0; i < list.length; i++) {
      co = list[i];
      if (co.dir !== 'E' || co.laneAt == null) { continue; }
      if (Math.hypot(p.x - edgeX, p.y - co.laneAt) < PREFETCH_DOOR_R) { out.push(nextRoomFor(run, co)); }
    }
    return out;
  }
  function prefetchRoomTex(floor, roomIdx) {
    var key = floor + ':' + roomIdx;
    if (prefetchedRoomTex[key]) { return; }
    prefetchedRoomTex[key] = true;
    var fake = { floor: floor, roomIdx: roomIdx };
    rawTex(pickTex(FLOOR_TEX, fake, 'floortex'));
    rawTex(pickTex(WALL_TEX, fake, 'walltex'));
  }
  function maybePrefetchDoorTex(run, p) {
    var targets = doorPrefetchTargets(run, p), i;
    for (i = 0; i < targets.length; i++) { prefetchRoomTex(targets[i].floor, targets[i].roomIdx); }
  }

  /* 2026-09-05 — 플레이어가 실제로 장착한 무기의 `look`(sword·club·spear·
     bow·axe·staff·guandao·staff·scroll·fan·brush, `data-item.js` 참고).
     `js/skill.js`의 `classOf()`가 같은 자리를 읽지만 그 함수는 비공개
     (heroId 를 밖에서 이미 안다고 가정)라, 여기서는 `leadId()`가 하던 것
     (`core.save.party[0]`)을 그대로 다시 읽는다 — 새 export 를 안 늘리려는
     선택이다 */
  /** 그 인물이 실제로 장착한 무기의 look. id를 안 주면 선두(party[0]) —
   *  2026-09-06 동행(§51) 추가 전엔 늘 선두만 봤어서 id 인자가 없었다. */
  function weaponLookOf(id) {
    var core = global.DG.core, IT = global.DG.item;
    if (!core || !IT || !core.save || !core.save.party) { return 'sword'; }
    id = id || core.save.party[0];
    if (!id) { return 'sword'; }
    var w = IT.equipped(id).weapon;
    if (!w || IT.isBroken(w)) { return 'sword'; }
    var base = IT.baseOf(w);
    return (base && base.look) || 'sword';
  }
  /* 2026-09-06 — 투구·갑주도 weaponLookOf와 같은 요령으로 읽는다. 없거나
     부서졌으면 'none'(foeGear는 'none'이면 아무 것도 안 그린다). */
  function helmLookOf(id) {
    var core = global.DG.core, IT = global.DG.item;
    if (!core || !IT || !core.save || !core.save.party) { return 'none'; }
    id = id || core.save.party[0];
    if (!id) { return 'none'; }
    var h = IT.equipped(id).helm;
    if (!h || IT.isBroken(h)) { return 'none'; }
    var base = IT.baseOf(h);
    return (base && base.look) || 'none';
  }
  function armorLookOf(id) {
    var core = global.DG.core, IT = global.DG.item;
    if (!core || !IT || !core.save || !core.save.party) { return 'none'; }
    id = id || core.save.party[0];
    if (!id) { return 'none'; }
    var a = IT.equipped(id).armor;
    if (!a || IT.isBroken(a)) { return 'none'; }
    var base = IT.baseOf(a);
    return (base && base.look) || 'none';
  }
  /** 무기+투구+갑주를 한 번에 — foeGear(look) 한 번으로 셋 다 그리게 넘긴다 */
  function meLookOf(id) {
    return { weapon: weaponLookOf(id), helm: helmLookOf(id), armor: armorLookOf(id) };
  }
  /* 2026-09-06 — 외모 커스텀(`core.save.appearance = {styleSeed, tint}`).
     1 이상은 `'me:'+styleSeed`를 그대로 해시하지 않고 **미리 검증한 시드 표
     (QRPG_SEEDS)만 고른다** — `asset3d.js`의 `oneOf()`가 26종 레시피(QRPG 6·
     MPFB 실사 20종) 중 하나를 해시로 고르는데, 여기서 MPFB 쪽(`mpfb_female`
     등)이 걸리면 실기기 확인 중 CDP 헤드리스에서 렌더러가 그대로 죽는 게
     실제로 재현됐다(GPU 프로세스 강제 종료, `retargetInto()` 골격 재배치
     쪽 문제로 보이나 원인까지는 못 좁혔다). QRPG 6종은 이미 매 프레임
     안전하게 도는 몸(무기·투구·갑주 다 이 위에 얹는다)이고 tint 도 이쪽에만
     먹으므로("일부 스타일엔 색이 안 먹을 수 있음" 캐벗을 아예 없앤다),
     커스텀 화면은 이 여섯만 내준다.
     QRPG_SEEDS[i] 문자열은 `'me:'+i`가 아니라, `oneOf()`의 해시가 실제로
     QRPG 인덱스(0~5)에 떨어지는 걸 미리 찾아 둔 값이다(PowerShell로
     `h=(h*31+charCode)&0xFFFFFFFF; h%26`을 손으로 굴려 확인) — 문자열이
     안 예뻐 보여도 바꾸면 다른 레시피로 튄다, 손대지 말 것.
     **2026-09-07 되돌림 — styleSeed:0(기본값·옛 세이브)도 QRPG_SEEDS[0]으로
     묶는다.** 원래는 "리터럴 'me' 그대로 둬 회귀 없음"이었는데, 'me' 자체가
     해시로 `mpfb_v20`(3.5~4.3MB 몸 + 제 클립이 없어 7.6MB `ANIM_SRC` 리타깃
     까지 추가로 받는다)에 떨어진다 — 커스텀 화면에서 막 잡아낸 바로 그
     MPFB 위험군과 같은 갈래다. 모바일 LTE에서 "너무 느리다"(2026-09-07
     재신고) 원인이 이것으로 보인다 — 위 렌더러 크래시 위험까지 겹쳐 "회귀
     없음"보다 안전이 우선이라 판단했다. 대부분의 플레이어는 커스텀 화면을
     안 열어 봤을 default(styleSeed:0)가 곧 이 갈래라 영향이 가장 크다. */
  var QRPG_SEEDS = ['me:0', 'me:1', 'me:15', 'me:16', 'me:17', 'me:18'];
  function meRenderParams() {
    var core = global.DG.core;
    var ap = (core && core.save && core.save.appearance) || {};
    var n = ap.styleSeed || 0;
    var seed = (n >= 1 && n <= QRPG_SEEDS.length) ? QRPG_SEEDS[n - 1] : QRPG_SEEDS[0];
    return { seed: seed, tint: hexOf(ap.tint, null) };
  }
  function npcShape(nc) {
    var sg = new T.Group();
    box(sg, 0, 15, 0, 13, 20, 10, nc, 'flat', true);
    box(sg, 0, 30, 0, 11, 11, 11, 0xe8c9a4, 'flat', true);
    box(sg, 0, 38, 0, 14, 4, 14, 0x2f333c, 'flat', false);
    return sg;
  }
  function foeShape(r, hh, col) {
    var sg = new T.Group();
    box(sg, 0, hh / 2, 0, r * 1.5, hh, r * 1.2, col, 'flat', true);
    box(sg, 0, hh + r * 0.5, 0, r * 0.9, r * 0.9, r * 0.9, mix(col, 0xffffff, 0.2), 'flat', true);
    return sg;
  }

  /**
   * 몬스터 다양화(PLAN 14절) — 사람 형 적의 무기·투구·망토·수염을 `data-enemy.js`
   * 의 `look` 그대로 걸친다. 옛 도형 시절부터 있던 정보였는데(황건적은 몽둥이,
   * 왜장은 투구+망토…) 3D 화면엔 여태 하나도 안 실렸다 — 다들 같은 사람 모델에
   * 색만 다른 채로 섰다. GLB 갈아 끼우기와 별개로 **`g`(바깥 껍데기)에 얹는다** —
   * `foeBody` 안쪽은 GLB 가 늦게 와서 통째로 갈릴 수 있지만 이 장식은 그대로다.
   */
  /* 2026-09-05 — SAGA WEB.md "F. 소품" 목록의 "무기". 몸은 실사 GLB(QRPG
     창고)인데 무기만 도형(각목)이던 자리를 poly.pizza Quaternius CC0 무기로
     갈아 끼운다. 옛 도형은 fallback 으로 그대로 남긴다(`AS3.build`가 GLB
     실패 시 이 함수를 그대로 부른다) — 위치·자리는 옛 값과 같다.
     mul 은 옛 도형의 길이(r 배수)를 그대로 옮긴 값이다.
     2026-09-05(이어서) — `data-item.js`의 무기 `look` 열 가지를 다 받도록
     `guandao`(월도, spear 재사용)·`scroll`(병서)·`fan`·`brush`(선채·필묵,
     둘 다 붓 모델 하나 공유)를 더했다. 몬스터(`foeGear`)·플레이어 본인
     (`buildActor`의 `kind==='me'`) 둘 다 이 표 하나를 같이 쓴다 —
     `attachWeapon()`으로 뽑아냈다(전엔 `foeGear()` 안에만 있었다) */
  var WPN_MUL = {
    club: 1.3, axe: 1.7, sword: 1.8, spear: 2.6, halberd: 2.8, guandao: 2.8,
    staff: 2.3, bow: 1.7, scroll: 1.0, fan: 1.5, brush: 1.5,
    /* §5.7 시대 퓨전(2026-09-18) — 전자창은 halberd 급 길이, 동력장갑은
       자루 없이 손을 감싸는 상자라 club 보다도 짧다. */
    lance_e: 2.7, gauntlet: 1.2
  };
  function attachWeapon(g, weapon, handX, handZ, shoulderY, r) {
    var wcol = 0xb9c2cf, woodcol = 0x5a4a34;
    var AS3 = AS();
    if (weapon === 'club') {
      var clubShape = function () {
        var sg = new T.Group();
        box(sg, 0, r * 0.55, 0, r * 0.5, r * 1.1, r * 0.5, woodcol, 'flat', true);
        return sg;
      };
      var wnode = AS3 ? AS3.build('wpn:club', 'foe', r * WPN_MUL.club, null, clubShape) : clubShape();
      wnode.position.set(handX, shoulderY, handZ);
      g.add(wnode);
    } else if (weapon === 'axe') {
      var axeShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.2, r * 1.6, r * 0.2, woodcol, 'flat', true);
        box(sg, 0, r * 0.7, 0, r * 0.85, r * 0.5, r * 0.14, wcol, 'flat', true);
        return sg;
      };
      var anode = AS3 ? AS3.build('wpn:axe', 'foe', r * WPN_MUL.axe, null, axeShape) : axeShape();
      anode.position.set(handX, shoulderY, handZ);
      g.add(anode);
    } else if (weapon === 'sword') {
      var swordShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.15, r * 1.7, r * 0.15, wcol, 'flat', true);
        return sg;
      };
      var snode = AS3 ? AS3.build('wpn:sword', 'foe', r * WPN_MUL.sword, null, swordShape) : swordShape();
      snode.position.set(handX, shoulderY, handZ);
      g.add(snode);
    } else if (weapon === 'spear' || weapon === 'halberd' || weapon === 'guandao') {
      var isHalberd = weapon === 'halberd' || weapon === 'guandao';
      var poleShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * (isHalberd ? 2.8 : 2.6), r * 0.12, woodcol, 'flat', true);
        if (isHalberd) { box(sg, 0, r * 1.3, 0, r * 0.85, r * 0.6, r * 0.15, wcol, 'flat', true); }
        else { box(sg, 0, r * 1.2, 0, r * 0.13, r * 0.5, r * 0.13, wcol, 'flat', true); }
        return sg;
      };
      var pnode2 = AS3 ? AS3.build('wpn:' + weapon, 'foe', r * WPN_MUL[weapon], null, poleShape) : poleShape();
      pnode2.position.set(handX, shoulderY, handZ);
      g.add(pnode2);
    } else if (weapon === 'staff') {
      var staffShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * 2.2, r * 0.12, woodcol, 'flat', true);
        box(sg, 0, r * 1.1, 0, r * 0.4, r * 0.4, r * 0.4, 0x9fe8ff, 'glow', false);
        return sg;
      };
      var stnode = AS3 ? AS3.build('wpn:staff', 'foe', r * WPN_MUL.staff, null, staffShape) : staffShape();
      stnode.position.set(handX, shoulderY, handZ);
      g.add(stnode);
    } else if (weapon === 'bow') {
      /* 활은 칼·창과 달리 손 높이를 **가운데** 두고 위아래로 뻗는다. GLB 는
         `normalize()`가 바닥을 y=0 에 놓으므로(다른 무기와 같은 규약),
         도형(fallback)도 활을 그 규약에 맞춰 `bmul/2` 만큼 들어 그려 둔다 —
         그래야 GLB 든 도형이든 바깥 위치는 늘 같은 한 줄(`shoulderY - bmul/2`)로
         가운데를 맞춘다(비동기로 GLB 가 늦게 와도 위치가 안 흔들린다) */
      var bmul = r * WPN_MUL.bow;
      var bowShape = function () {
        var sg = new T.Group();
        var bow = new T.Mesh(geo('bowArc', function () { return new T.TorusGeometry(1, 0.09, 5, 10, Math.PI * 1.4); }),
          mat(woodcol, 'flat'));
        bow.scale.setScalar(r * 0.85);
        bow.position.y = bmul * 0.5;
        bow.rotation.z = Math.PI / 2;
        bow.castShadow = true;
        sg.add(bow);
        return sg;
      };
      var bnode = AS3 ? AS3.build('wpn:bow', 'foe', bmul, null, bowShape) : bowShape();
      bnode.position.set(handX, shoulderY - bmul * 0.5, handZ);
      g.add(bnode);
    } else if (weapon === 'scroll' || weapon === 'fan' || weapon === 'brush') {
      /* 병서(scroll)·선채(fan)·필묵(brush) — 다 가는 막대를 쥔 실루엣이라
         하나의 얇은 막대 fallback 을 같이 쓴다(fan·brush 는 실제 GLB 도
         하나를 공유한다, `asset3d.js` 참고) */
      var thinShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.1, r * WPN_MUL[weapon], r * 0.1, woodcol, 'flat', true);
        return sg;
      };
      var tnode = AS3 ? AS3.build('wpn:' + weapon, 'foe', r * WPN_MUL[weapon], null, thinShape) : thinShape();
      tnode.position.set(handX, shoulderY, handZ);
      g.add(tnode);
    } else if (weapon === 'lance_e') {
      /* §5.7 시대 퓨전(2026-09-18) — 전자창(電子槍). 자루 비례는 halberd와
         같지만 날 대신 발광 촉(staff의 파란 정육면체 결)을 얹어 "미래
         무기"임을 실루엣으로 알린다. 실제 GLB 는 없다 — 이 fallback 이 늘 쓰인다
         (AS3.build 는 'wpn:lance_e' 자산이 없으면 그대로 fallback 만 돌려준다). */
      var laceShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.12, r * 2.6, r * 0.12, wcol, 'flat', true);
        box(sg, 0, r * 1.25, 0, r * 0.22, r * 0.7, r * 0.22, 0x6fe0ff, 'glow', false);
        return sg;
      };
      var lnode = AS3 ? AS3.build('wpn:lance_e', 'foe', r * WPN_MUL.lance_e, null, laceShape) : laceShape();
      lnode.position.set(handX, shoulderY, handZ);
      g.add(lnode);
    } else if (weapon === 'gauntlet') {
      /* §5.7 시대 퓨전(2026-09-18) — 동력장갑(動力裝甲). 자루가 없는 첫
         무기라 다른 branches처럼 긴 막대를 안 세우고, 손 둘레를 감싸는
         짧고 두꺼운 상자 + 발광 너클로 그린다. */
      var gauShape = function () {
        var sg = new T.Group();
        box(sg, 0, 0, 0, r * 0.55, r * 0.55, r * 0.55, wcol, 'flat', true);
        box(sg, 0, r * 0.32, r * 0.3, r * 0.5, r * 0.16, r * 0.16, 0xff8c3c, 'glow', false);
        return sg;
      };
      var gnode = AS3 ? AS3.build('wpn:gauntlet', 'foe', r * WPN_MUL.gauntlet, null, gauShape) : gauShape();
      gnode.position.set(handX, shoulderY, handZ);
      g.add(gnode);
    }
  }
  function foeGear(g, look, hh, r, tint, humanGlb) {   // humanGlb: GLB 로 설 사람 몸(레시피 있고 GLB 켜짐)엔 갑주·투구를 안 씌운다(VRM 을 화분처럼 덮었다, W-0100) — 도형 몸은 상자 신호 그대로
    var handX = r * 1.05, handZ = r * 0.25, shoulderY = hh * 0.68;
    var woodcol = 0x5a4a34;
    var AS3 = AS();
    attachWeapon(g, look.weapon, handX, handZ, shoulderY, r);
    /* 2026-09-06 — 갑주(tier). data-item.js/data-enemy.js에 `look.armor`
       필드는 있었지만 여태 아무도 안 그렸다(적도 플레이어도) — 실제 갑주
       GLB가 없으니 몸통을 감싸는 색 다른 상자로 "가죽/판금" 실루엣 신호만
       준다. 나중에 진짜 갑주 GLB를 구하면 이 키(`gear:armor:*`)로 등록만
       하면 AS3.build가 자동으로 갈아 끼운다. */
    if (!humanGlb && (look.armor === 'leather' || look.armor === 'plate')) {
      var armMul = hh * 0.62;
      var armFallback = function () {
        var sg = new T.Group();
        var acol = look.armor === 'plate' ? 0x8a8f9a : 0x5a4632;
        box(sg, 0, armMul * 0.5, 0, r * 1.3, armMul, r * 1.15, acol, 'flat', true);
        return sg;
      };
      wornGear('gear:armor:' + look.armor, armMul, hh * 0.12, armFallback);
    }
    /* 2026-09-05 — 투구(`helmet`)·왕관(`crown`)을 실사화(poly.pizza). 모자·
       망토류는 칼·창과 달리 몸을 **가운데(또는 제자리)** 두고 걸치는
       물건이라(활과 같은 사정), `normalize()`가 바닥을 y=0 에 두는 규약과
       어긋난다 — fallback 도형도 그 규약(바닥이 0)에 맞춰 다시 그려서,
       도형이든 GLB든 이 한 줄(`bottomY, mul` 또는 `centerY - mul/2`)로
       늘 같은 자리를 잡는다. */
    function wornGear(kind, mul, bottomY, fallbackFn, tintHex) {
      var node = AS3 ? AS3.build(kind, 'foe', mul, tintHex || null, fallbackFn) : fallbackFn();
      node.position.y += bottomY;
      g.add(node);
    }
    function wornGearCentered(kind, mul, centerY, fallbackFn, tintHex) {
      wornGear(kind, mul, centerY - mul * 0.5, fallbackFn, tintHex);
    }
    if (look.cape) {
      /* 2026-09-05(이어서) — 사용자 지시로 CC-BY 완성 망토 모델로 갈아 끼웠다.
         이미 붉·금으로 칠해진 모델이라 tint 를 주면(곱연산) 세력색에 따라
         탁해진다 — 그래서 **GLB 는 tint 없이 제 색 그대로**, fallback 만
         옛 방식대로 세력색을 쓴다(둘의 표현이 달라도 "망토가 있다/없다"
         라는 실루엣 신호는 같다) */
      var capeMul = hh * 0.7, capeBottomY = hh * 0.07;
      var capeFallback = function () {
        var sg = new T.Group();
        box(sg, 0, capeMul * 0.5, 0, r * 1.25, capeMul, r * 0.13,
          mix(tint, 0x000000, 0.25), 'flat', true);
        return sg;
      };
      var capeNode = AS3 ? AS3.build('gear:cape', 'foe', capeMul, null, capeFallback) : capeFallback();
      capeNode.position.set(0, capeBottomY, -r * 0.85);
      capeNode.rotation.x = -0.1;
      g.add(capeNode);
    }
    var headY = hh + r * 0.5, helm = humanGlb ? 'none' : look.helm;
    if (helm === 'helmet' || helm === 'plume') {
      var helmMul = r * 0.7;
      var helmFallback = function () {
        var sg = new T.Group();
        box(sg, 0, helmMul * 0.5, 0, r * 1.0, helmMul, r * 1.0, 0x5a5a62, 'flat', true);
        return sg;
      };
      wornGearCentered('gear:helmet', helmMul, headY + r * 0.35, helmFallback);
      if (helm === 'plume') {
        box(g, 0, headY + r * 0.85, 0, r * 0.2, r * 0.85, r * 0.2, mix(tint, 0xff5a3a, 0.5), 'glow', false);
      }
    } else if (helm === 'gapju') {
      /* 2026-09-05(이어서) — "gapju"(원뿔형 동아시아 투구)란 이름의 CC0/CC-BY는
         끝까지 못 찾았다 — 대신 바이킹 투구(뿔 달림, CC-BY 3.0)를 쓴다.
         대장간=집 모델과 같은 판단: 모양이 정확히 안 맞아도 "이 적은 다른
         투구를 썼다"는 다양성 신호는 충분히 준다 */
      var gapjuMul = r * 0.8;
      var gapjuFallback = function () {
        var sg = new T.Group();
        var cone = new T.Mesh(geo('helmCone', function () { return new T.ConeGeometry(1, 1.3, 8); }),
          mat(woodcol, 'flat'));
        cone.scale.setScalar(r * 0.65);
        cone.position.y = gapjuMul * 0.5;
        cone.castShadow = true;
        sg.add(cone);
        return sg;
      };
      wornGearCentered('gear:gapju', gapjuMul, headY + r * 0.55, gapjuFallback);
    } else if (helm === 'crown') {
      var crownMul = r * 0.86;
      var crownFallback = function () {
        var sg = new T.Group();
        var ring = new T.Mesh(geo('crownRing', function () { return new T.TorusGeometry(1, 0.18, 6, 12); }),
          mat(0xe8c15a, 'glow'));
        ring.scale.setScalar(r * 0.55);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = crownMul * 0.5;
        sg.add(ring);
        return sg;
      };
      wornGearCentered('gear:crown', crownMul, headY + r * 0.5, crownFallback);
    }
    /* look.beard — 2026-09-05, 끝까지 찾아도 진짜 CC0 턱수염 낱개 모델이
       없었다(마스카·콧수염뿐). 실사화 원칙(사용자 지시: 개조·대체가 안
       되면 도형 대신 없는 채로 둔다)에 따라 이 분기를 지웠다 — 수염 있는
       적도 이제 수염 없이 나온다 */
  }

  /** 지금 보이는 것(도형이든 GLB 든) 위 모든 메시의 재질 사본 — 맞으면 이걸 번쩍인다.
   *  GLB 가 도형에서 갈아 끼워지는 순간 사본이 낡으므로, 그 전환(assetState)이
   *  바뀔 때만 다시 뜬다(매 프레임 새로 뜨면 낭비다). */
  function ensureFlash(node) {
    var AS3 = AS();
    var st = node.userData.assetState;
    if (node.userData.flash && node.userData.flashState === st) { return node.userData.flash; }
    var mats = AS3 ? AS3.ownAllMat(node.children[0]) : [];
    node.userData.flash = mats;
    node.userData.flashState = st;
    return mats;
  }

  /** 그림자(shade) 정예의 분신 — 판정엔 있어도 3D 는 여태 본체와 똑같이 서
   *  있었다(몬스터 다양화가 남긴 숙제). 지금 보이는 메시를 사본 떠서 반투명
   *  보랏빛으로 물들인다. `ensureFlash` 와 달리 **`mixerNode`(진짜 shell) 의
   *  `assetState`** 를 직접 본다 — 분신은 수명이 짧아 상자에서 GLB 로 갈아
   *  끼워지는 순간을 놓치면 그냥 평범한 적으로 보인다. */
  function ensureShade(node) {
    var body = node.userData.mixerNode;
    if (!body) { return; }
    var st = body.userData.assetState;
    if (node.userData.shadeState === st) { return; }
    var purple = new T.Color(0x9a7ad9);
    body.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var srcM = Array.isArray(o.material) ? o.material[0] : o.material, TNc = global.DG.toon3d;
      var m = TNc && TNc.cloneMat ? TNc.cloneMat(srcM) : srcM.clone();   // 림·얼굴 셰이더까지 옮긴다(2026-09-23)
      m.transparent = true;
      m.opacity = 0.5;
      m.depthWrite = false;
      if (m.emissive) { m.emissive.copy(purple); m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.5); }
      else if (m.color) { m.color.lerp(purple, 0.4); }
      o.material = Array.isArray(o.material) ? [m] : m;
    });
    node.userData.shadeState = st;
  }

  function buildActor(kind, ref) {
    var g = new T.Group();
    var AS3 = AS();
    if (kind === 'npc') {
      /* 마을 사람 — 사가만리와 같은 GLB(사람 창고)를 쓴다. 진영색 대신
         **이 사람 고유의 옷 빛깔**로 물들인다(town.js 의 뜻 그대로) */
      var nc = hexOf(ref && ref.color, 0x8a6f4e);
      /* 세 시대 손님(§5.20)은 제 몸(`folk:*`, 제 클립·제 옷) — 물들이지 않는다 */
      var body = AS3 && ref && ref.model ? AS3.build(ref.model, 'npc:' + ref.key, 40, null, function () { return npcShape(nc); }) :
        AS3 ? AS3.buildHero('npc:' + ((ref && ref.key) || ''), 40, ref && ref.color,
        function () { return npcShape(nc); }) : npcShape(nc);
      g.add(body);
      g.userData.mixerNode = body;
      /* 발밑 고리 — 말이 걸리는 거리에 들어서면 켜진다 */
      var nr = box(g, 0, 0.8, 0, 44, 1.6, 44, 0xffd489, 'glow', false);
      nr.visible = false;
      g.userData.ring = nr;
      g.userData.label = labelNode(((ref && ref.emoji) || '') + ' ' + ((ref && ref.name) || ''), 54, 72);
      g.add(g.userData.label);
      return g;
    }
    if (kind === 'mark') {
      /* 표식 — 사람이 아니라 **밟는 것**이다. 셋의 성격이 달라 빛깔로 가른다 */
      var mkey = (ref && ref.key) || '';
      /* PLAN §28-4 Phase 1 — 굴혈이 마을방 고정 표식(gate)에서 들길
         (exit_dungeon)로 옮겨졌지만, 초록 팻말(isExit)이 아니라 여전히
         굴혈다운 검은 구멍으로 보여야 한다 — isGate로 함께 묶는다. */
      var isGate = mkey === 'gate' || mkey === 'exit_dungeon';
      var isExit = mkey.indexOf('exit_') === 0 && !isGate;
      var glow = mkey === 'waypoint' ? 0x3aa9c9 : (mkey === 'vow' ? 0xe06565 :
        (isExit ? 0x7fd858 : 0xffb45a));
      var base = isGate ? 0x14161c : 0x4a4f5a;
      box(g, 0, 2.5, 0, 46, 5, 46, base, 'flat', false);         // 밟는 자리
      if (isGate) {
        /* 굴혈 — 내려가는 구멍이다. 기둥을 세우지 않고 **바닥을 뚫어** 보이게 한다 */
        box(g, 0, 4, 0, 30, 3, 30, 0x000000, 'flat', false);
        box(g, 0, 6, 0, 22, 1.5, 22, glow, 'glow', false);
      } else if (mkey === 'waypoint') {
        box(g, 0, 12, 0, 20, 20, 20, 0x2a3a4a, 'flat', true);
        box(g, 0, 25, 0, 26, 4, 26, glow, 'glow', false);
      } else if (isExit) {
        /* 들길(오버월드, PLAN 28-1절) — 비석이 아니라 **팻말**이다.
           장대 하나에 판을 얹어 "여기서 다른 마을로" 라는 느낌을 준다. */
        box(g, 0, 20, 0, 6, 40, 6, 0x5c4632, 'flat', true);
        box(g, 0, 34, 0, 26, 8, 3, glow, 'glow', false);
      } else {
        box(g, 0, 17, 0, 16, 34, 8, 0x6a6a75, 'flat', true);     // 비석
        box(g, 0, 36, 0, 12, 4, 10, glow, 'glow', false);
      }
      var mr = box(g, 0, 0.8, 0, 56, 1.6, 56, glow, 'glow', false);
      mr.visible = false;
      g.userData.ring = mr;
      g.userData.label = labelNode(((ref && ref.emoji) || '') + ' ' + ((ref && ref.name) || ''), 50, 82);
      g.add(g.userData.label);
      return g;
    }
    if (kind === 'me') {
      var meParams = meRenderParams();
      /* 2026-09-09 — GLB 도착 전 흰빛 도는 각목 도형(옛 meShape())이 실기기에서
         "저 하얀 캐릭터 없애는 게 낫겠다"는 신고를 받았다. 도형을 아예 안
         넘기면 `buildHero`가 GLB 다 실릴 때까지 shell을 비워 둔다 —
         빈 자리보다는 낫다던 placeholder를, 사용자가 빈 자리 쪽을 골랐다. */
      var meBody = AS3 ? AS3.buildHero(meParams.seed, 42, meParams.tint, null) : new T.Group();
      g.add(meBody);
      g.userData.mixerNode = meBody;
      /* 실제 장착 무기·투구·갑주는 GLB 진행 상태와 무관하게 `g`(바깥 껍데기)에
         따로 얹는다(`foeGear()`가 내부에서 `attachWeapon`을 부른다). */
      foeGear(g, meLookOf(), 31.2, 12, null, !!(AS3 && meBody.userData.body && AS3.tuned('asset3d.glb', 1)));
      return g;
    }
    if (kind === 'mount') {
      /* 탈것(mount.js) — 펫 몸(말·학·용)을 발밑에 세운다. GLB 가 오기 전엔 도형 */
      var mrf = ref || {};
      var mBody = AS3 ? AS3.build(mrf.model || 'pet:horse', 'mount:' + (mrf.id || ''), mrf.h || 46, null, function () { return foeShape(12, mrf.h || 46, 0x8a6a45); }) : new T.Group();
      g.add(mBody);
      g.userData.mixerNode = mBody;
      return g;
    }
    if (kind === 'ally') {
      /* 동행(同行, PLAN §51) — 부대 2번째 인물. 'me'와 같은 몸(buildHero) ·
         장비(foeGear) 조립이지만, seed를 그 인물 id로 박아 선두와
         다른 조합(생김새)이 나오게 한다 — `npc:'+key`와 같은 요령이다. */
      var allyId = (ref && ref.id) || 'ally';
      var allyBody = AS3 ? AS3.buildHero('ally:' + allyId, 42, null, null) : new T.Group();
      g.add(allyBody);
      g.userData.mixerNode = allyBody;
      foeGear(g, meLookOf(allyId), 31.2, 12, null, !!(AS3 && allyBody.userData.body && AS3.tuned('asset3d.glb', 1)));
      return g;
    }
    var r = (ref && ref.r) || 12;
    var enemyDef = ref && ref.ref;                    // data-enemy.js 의 그 줄(kind·color·look)
    /* 정예는 여덟 갈래(날쌘·완강한·사나운·되살아나는·가시 돋친·그림자·철갑·호신)
       마다 제 빛깔이 `ELITES` 표에 이미 있는데(`js/dungeon.js`), 3D 는 여태
       전부 같은 보랏빛으로 뭉뚱그렸다 — 그 표의 색을 그대로 쓴다 */
    var DGd = global.DG.dungeon;
    var eliteDef = ref && ref.elite && DGd ? DGd.eliteOf(ref.elite) : null;
    var col = ref && ref.boss ? 0x9a3a3a : (eliteDef ? hexOf(eliteDef.color, 0x8a5cc0) :
      hexOf(enemyDef && enemyDef.color, 0x6a6a75));
    var hh = r * (ref && ref.boss ? 2.6 : 1.9);
    var isBeast = !!(enemyDef && enemyDef.kind === 'beast');
    var foeBody;
    if (AS3 && isBeast) {
      /* 짐승 형 적 — data-enemy.js 의 `body` 필드로 실제 GLB 를 고른다(없으면
         기본 'beast'=늑대). 2026-09-05 — 몬스터 다양화 하면서 이름 정규식
         (`/코끼리/`으로 큰 놈만 가르던 것)을 표 필드로 뺐다 — 종류가 더 늘어도 여기는 안 건드리고 data-enemy.js·asset3d.js REG 만 고치면 된다.
         세력색은 안 물들인다(짐승 제 털빛이 맞다). W-0147 — 자체툴 새 몸(보스 12·계열 20, 2D 시트·초상과 같은 id)이 있으면 그것 먼저, 없으면 옛 표 */
      var MPd = global.DG.monsterPortrait, cid = MPd && MPd.idOf ? MPd.idOf(enemyDef, !!(ref && ref.boss)) : null;
      foeBody = AS3.build((cid && AS3.wants('crea:' + cid, 'foe') ? 'crea:' + cid : null) || (enemyDef && enemyDef.body) || 'beast',
        (ref && ref.ref && ref.ref.name) || 'beast',
        hh + r * 0.95, null, function () { return foeShape(r, hh, col); });
    } else if (AS3) {
      /* 사람 형 적(황건적·왜구…) — 사람 창고 GLB. 보스·정예가 아니면
         **이 적의 원래 빛깔**(data-enemy.js 의 color)로 물들인다 */
      var tint = ref && (ref.boss || ref.elite) ? col : (enemyDef && enemyDef.color) || null;
      foeBody = AS3.buildHero((enemyDef && enemyDef.name) || 'foe', hh + r * 0.95, tint,
        function () { return foeShape(r, hh, col); });
    } else {
      foeBody = foeShape(r, hh, col);
    }
    g.add(foeBody);
    g.userData.mixerNode = foeBody;
    /* 엘리트·보스는 눈이 빛난다 — 실루엣만으로 위험을 읽게 한다(GLB 위에도 그대로 얹는다) */
    if (ref && (ref.boss || ref.elite)) {
      box(g, 0, hh + r * 0.6, r * 0.5, r * 0.7, r * 0.2, r * 0.2, 0xff5a3a, 'glow', false);
    }
    /* 정예는 발밑에 제 빛깔 고리를 켠다 — 위 눈빛은 "정예다" 만 알리고,
       이 고리 색이 "무슨 정예인지" 를 멀리서도 가른다 */
    if (eliteDef) {
      box(g, 0, 1.2, 0, r * 2.3, 2, r * 2.3, hexOf(eliteDef.color, 0x8a5cc0), 'glow', false);
    }
    /* 몬스터 다양화 — 사람 형 적은 무기·투구·망토·수염을 `look` 데이터 그대로
       걸친다. 옛 도형 시절부터 있던 정보인데 여태 3D 화면엔 하나도 안 실렸다 */
    if (!isBeast && enemyDef && enemyDef.look) {
      /* 세계 보스(§5.4) 부위 파괴 — 부서진 조각만 'none'으로 덮어써서 넘긴다.
         enemyDef.look(=e.ref.look) 자체는 절대 안 건드린다 — 그 보스종의
         공용 정의라, 고치면 다음에 스폰되는 같은 보스까지 무기 없이 나온다. */
      var lk = enemyDef.look;
      if (ref && ref.worldBoss && (ref.wbWeaponBroken || ref.wbArmorBroken || ref.wbHelmBroken)) {
        lk = {
          weapon: ref.wbWeaponBroken ? 'none' : lk.weapon,
          helm: ref.wbHelmBroken ? 'none' : lk.helm,
          armor: ref.wbArmorBroken ? 'none' : lk.armor,
          beard: lk.beard, cape: lk.cape
        };
      }
      foeGear(g, lk, hh, r, col, !!(AS3 && !isBeast && foeBody.userData.body && AS3.tuned('asset3d.glb', 1)));
    }
    return g;
  }

  function actorOf(k, kind, ref) {
    var a = actors[k];
    if (a) { a.seen = frame; return a; }
    var node = buildActor(kind, ref);
    actorGroup.add(node);
    actors[k] = { node: node, seen: frame, ang: 0 };
    return actors[k];
  }

  function sweep() {
    for (var k in actors) {
      if (!Object.prototype.hasOwnProperty.call(actors, k)) { continue; }
      if (actors[k].seen === frame) { continue; }
      actorGroup.remove(actors[k].node);
      delete actors[k];
    }
  }

  /** 가림 페이드(§56, 실기기 제보 "큰 물체 때문에 캐릭터가 안 보여") —
   *  카메라에서 플레이어(대략 가슴 높이)로 광선을 쏴, 그 사이(끝은 살짝
   *  물려 플레이어 자신·발밑 땅은 빼고)에 낀 `wallGroup`·`fieldGroup`
   *  물체만 옅게 만든다. 일반 Mesh(건물·담장·`piece()` 소품)는 재질을
   *  복제해 투명(`opacity` 0.2)으로 — 다른 물체와 재질을 캐시로 나눠
   *  쓰므로(`mat()`) 복제 없이 opacity 를 바로 건드리면 같은 색 전부가
   *  같이 흐려진다. 나무·바위 같은 자연물은 `field-instance.js`가
   *  `InstancedMesh` 하나로 묶어(성능) 인스턴스 하나만 투명하게 못
   *  만드므로, 그 인스턴스만 행렬을 아주 작게 눌러 숨긴다(진짜 페이드는
   *  아니지만 "캐릭터가 안 보인다"는 문제는 그대로 없앤다) — 안 걸리게
   *  되면 원래 행렬로 되돌린다. 매 프레임 새로 걸린 것만 걸고, 이번에
   *  안 걸린 것은 전부 원상복구한다. */
  function updateOcclusion(fromPos, toX, toY, toZ) {
    if (!T || !wallGroup || !fieldGroup) { return; }
    var dx = toX - fromPos.x, dy = toY - fromPos.y, dz = toZ - fromPos.z;
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var k, key;
    if (dist < 30) {
      /* 너무 가까우면(방금 층 진입 등) 광선을 안 쏜다 — 남은 가림만 되돌린다 */
      for (k in occFade) { occFade[k].mesh.material = occFade[k].orig; delete occFade[k]; }
      for (key in occInst) { occInst[key].mesh.setMatrixAt(occInst[key].id, occInst[key].orig); occInst[key].mesh.instanceMatrix.needsUpdate = true; delete occInst[key]; }
      return;
    }
    if (!raycaster) { raycaster = new T.Raycaster(); }
    if (!occDirScratch) { occDirScratch = new T.Vector3(); }
    occDirScratch.set(dx / dist, dy / dist, dz / dist);
    raycaster.set(fromPos, occDirScratch);
    raycaster.near = Math.max(0, dist * 0.06);   // 카메라 렌즈 바로 앞은 뺀다
    raycaster.far = Math.max(0, dist - 26);       // 플레이어 자신·발밑은 뺀다
    var hits = raycaster.far > raycaster.near ? raycaster.intersectObjects([wallGroup, fieldGroup], true) : [];
    var hitMesh = {}, hitInst = {}, i, h;
    for (i = 0; i < hits.length; i++) {
      h = hits[i];
      if (h.object.isInstancedMesh) {
        key = h.object.uuid + ':' + h.instanceId;
        hitInst[key] = true;
        if (!occInst[key]) {
          var m4 = new T.Matrix4();
          h.object.getMatrixAt(h.instanceId, m4);
          if (!occScaleScratch) { occScaleScratch = new T.Vector3(0.001, 0.001, 0.001); }
          var hidden = m4.clone().scale(occScaleScratch);
          h.object.setMatrixAt(h.instanceId, hidden);
          h.object.instanceMatrix.needsUpdate = true;
          occInst[key] = { mesh: h.object, id: h.instanceId, orig: m4 };
        }
      } else if (h.object.isMesh && h.object.material) {
        var mesh = h.object;
        hitMesh[mesh.uuid] = true;
        if (!occFade[mesh.uuid]) {
          if (!mesh.userData.__fadeMat) {
            var fm = (global.DG.toon3d && global.DG.toon3d.cloneMat) ? global.DG.toon3d.cloneMat(mesh.material) : mesh.material.clone();
            fm.transparent = true; fm.depthWrite = false; fm.opacity = 0.2;
            mesh.userData.__fadeMat = fm;
          }
          occFade[mesh.uuid] = { mesh: mesh, orig: mesh.material };
          mesh.material = mesh.userData.__fadeMat;
        }
      }
    }
    for (k in occFade) {
      if (!hitMesh[k]) { occFade[k].mesh.material = occFade[k].orig; delete occFade[k]; }
    }
    for (key in occInst) {
      if (!hitInst[key]) {
        occInst[key].mesh.setMatrixAt(occInst[key].id, occInst[key].orig);
        occInst[key].mesh.instanceMatrix.needsUpdate = true;
        delete occInst[key];
      }
    }
  }

  /* ── 한 프레임 ───────────────────────────────────────── */

  function render() {
    if (!active()) { return false; }
    var run = d().raw();
    if (!run) { return false; }
    frame++;
    updatePerf();
    /* 렌더러가 이미 서 있을 때만 — init() 전에는 손댈 게 없다.
       `enabled` 만 바꾸면 되고, 매 프레임 대입해도 three.js 쪽에서 값이
       같으면 그냥 넘어가니 "등급이 바뀔 때만" 을 따로 가리지 않았다. */
    if (renderer) { renderer.shadowMap.enabled = SHADOW(); }

    /* PLAN §28-8(오픈월드 A안, 2026-09-06 Phase 4에서 찾음) — 마을은 이제
       `run.player`·`room.npcs`·`room.marks`·`shots`·`foeShots`가 전부
       **세계 좌표**(앵커 포함)다. 그런데 이 3D 장면(바닥·벽·들판 땅)은
       처음부터 **방 하나 로컬 좌표**(0..ROOM_W, 0..ROOM_H 안팎)로 지어
       왔고 바꾸지 않았다 — 그게 맞다, `buildRoom()`/`buildField()`를 24개
       마을마다 다른 좌표로 다시 짓는 것보다 훨씬 싸다(방 자체는 마을마다
       똑같이 생겼으니). 대신 **화면(이 파일)이 세계 좌표를 읽는 자리마다
       앵커를 빼 로컬로 되돌린다** — 카메라·빛·플레이어·NPC·표식·투사체
       전부. 앵커가 (0,0)인 모루골만 우연히 맞았고(로컬==세계), 나머지
       23개 마을은 카메라가 세계 좌표(예: 갈대나루 스폰 근방 5190,480)를
       그대로 보라고 지시받는데 바닥·벽은 로컬(560,380) 언저리에 그대로
       있어 화면 전체가 새까맣게 나오는 회귀였다(CDP로 실측 — 넓은 창에서
       갈대나루·절차 생성 마을 전부 재현, 모루골만 정상). 던전은 `run.anchor`
       가 없어(항상 undefined) `{0,0}`으로 떨어지므로 회귀 없음. */
    var anc = run.anchor || { x: 0, y: 0 };
    var p0 = run.player;
    var p0x = p0.x - anc.x, p0y = p0.y - anc.y;   // 세계 → 로컬(위 anc 주석)
    /* 고정 세계 지도(§5.12) — 마을·들판의 들판 묶음은 세계 좌표로 지어 두고 묶음째
       앵커만큼 민다. 앵커가 바뀌어도(마을 사이를 걸어도) 다시 지을 필요가 없다 */
    var wmNow = worldFieldOn(run);
    if (fieldGroup) { fieldGroup.position.set(wmNow ? -anc.x : 0, 0, wmNow ? -anc.y : 0); }

    var W = d().ROOM_W, H = d().ROOM_H;
    /* 지형 높낮이(2026-09-06 실기기 제보 — "바닥 높낮이 때문에 캐릭터가
       다 가려짐") — 나·적·마을 사람은 지금까지 늘 y=0 에 그려졌는데,
       `buildField()`가 세우는 방 밖 들판 땅은 `heightAt()`로 기복이 진다
       (언덕에 올라서면 땅이 캐릭터보다 위로 솟아 캐릭터가 파묻힌 것처럼
       가려졌다). **`buildField()`가 쓰는 것과 정확히 같은 seed 산식**이어야
       그림(땅)과 액터가 같은 높이를 본다 — 다르면 "보이는 땅과 선 높이가
       어긋나는" 새 버그가 생긴다. 방 안(늘 0)에서는 이 값이 늘 0이라
       회귀가 없다. */
    var terrF = global.DG.field3d;
    var terrDD = global.DG.dataDungeon;
    var terrTh = run.theme || (terrDD ? terrDD.themeOf(run.floor) : null);
    var terrSeed = terrF ? terrF.seedOf(run.floor, run.roomIdx, terrTh && terrTh.name) : 0;
    function groundYAt(gx, gz) { return terrF ? terrF.heightAt(gx, gz, terrSeed, W, H) : 0; }
    /* 퍼즐방은 제단이 켜질 때마다(맞게 밟을 때마다) 그림도 다시 세워야 한다 —
       `rk` 에 진행도를 안 넣으면 데이터는 바뀌어도 화면은 그대로 남는다 */
    var pzProg = (run.room && run.room.puzzle) ? ':pz' + run.room.puzzle.progress : '';
    /* 이벤트방(구출)도 같은 사정이다 — 풀려난 순간 갇힌 우리 그림을 갈아 끼운다 */
    var capProg = (run.room && run.room.captive) ? (':cap' + (run.room.captive.freed ? 1 : 0)) : '';
    /* 비밀(POI: Secret)도 마찬가지 — 찾은 순간 반짝임을 얹어야 한다 */
    var secFound = 0;
    if (run.room && run.room.decor) {
      for (var sdi = 0; sdi < run.room.decor.length; sdi++) {
        if (run.room.decor[sdi].secret && run.room.decor[sdi].found) { secFound = 1; break; }
      }
    }
    /* 채집·낚시방도 같은 사정 — 약초를 뜯거나 못에서 손맛을 보면 그림도
       다시 세워야 한다(안 그러면 뜯은 풀이 그대로 남아 보인다) */
    var forageProg = '';
    if (run.room && run.room.forage) {
      var fgp = run.room.forage, fgPicked = 0;
      for (var fgpi = 0; fgpi < fgp.herbs.length; fgpi++) { if (fgp.herbs[fgpi].picked) { fgPicked++; } }
      forageProg = ':fg' + fgPicked + (fgp.pond && fgp.pond.used ? 'p1' : 'p0');
    }
    /* PLAN §57 — 마을은 rk가 (town/roomIdx/cleared 등) 절대 안 바뀌는 값들
       뿐이라, buildField()가 스폰 근방(cx,cz -R..R, 늘 anc=0 중심)에 딱
       한 번만 세워졌다. 스폰에서 그 반경(R) 밖으로 걸어 나가면 애초에
       세운 적 없는 자리라 바닥이 통째로 빈다(실기기 재현: PLAN.md 참고).
       anc(마을 앵커)는 그대로 두고(바꾸면 heightAt/chunkAt의 seed 산식이
       전부 anc-상대 로컬 좌표를 먹어 "고쳐 지을 때마다 언덕이 들썩이는"
       새 버그가 난다 — PLAN §57이 이미 이 함정을 적어 뒀다) 대신 **buildField가
       짓는 창(-R..R)의 중심을 플레이어 쪽으로 옮겨 다시 짓는다.** 창 중심을
       fldStep(=R-2, 최소 1) 단위로 반올림해 rk에 실어 두면, 플레이어가 그
       버킷 절반(fldStep/2 ≤ R-2) 이상 벗어날 때만(=아직 이전 창 안에
       있을 때 미리) 다시 짓는다 — 매 프레임 다시 짓는 낭비도, 창 가장자리에
       닿고 나서야 뒤늦게 짓는 틈도 없다. */
    var fldR = (terrF && FIELD()) ? fieldVisR(run) : 0;
    /* 2026-09-08 — "움직이면 계속 끊긴다" 실기기 제보. LOW 등급(FIELD_R()=2)
       에서는 이 값이 max(1, 2-2)=1 칸(200유닛)뿐이라, 절반(100유닛)만
       걸어도 창을 벗어나 buildField()가 다시 걸린다 — 가벼우라고 낮춘 LOW가
       오히려 재구성을 가장 자주 부르는 역설이었다. 최소 2칸으로 넉넉히
       잡아 저사양일수록 더 자주 재구성하는 역전을 없앤다. */
    var fldStep = Math.max(2, fldR - 1);
    var fldCx0 = 0, fldCz0 = 0;
    if (terrF && FIELD()) {
      /* 세계 지도 판은 창 중심도 세계 칸으로 — 앵커가 바뀌어도 창이 안 튄다 */
      fldCx0 = Math.round(Math.round((wmNow ? p0.x : p0x) / terrF.CHUNK) / fldStep) * fldStep;
      fldCz0 = Math.round(Math.round((wmNow ? p0.y : p0y) / terrF.CHUNK) / fldStep) * fldStep;
    }
    /* 2026-09-08 — buildField() 자체는 위 프레임 예산제 커밋으로 가벼워졌는데도
       "이동하면 계속 끊긴다" 제보가 실기기(PC·폰 둘 다)에서 이어졌다. 범인은
       옆에서 같이 걸리던 **buildRoom()** — 옛 `rk` 하나에 방 정체성과 들판 창
       위치(`:fw...`)를 같이 실어 뒀던 탓에, **방을 나간 적도 없는데 걸어서
       들판 창만 옮겨도 벽·바닥 텍스처를 다시 잡고 상자/우물/사당 GLB 를
       다시 클론**했다(방마다 한 번이면 될 무거운 동기 작업이 한 칸 걸을
       때마다 반복). 방 정체성(roomKey)과 들판 창(fieldWinKey)을 갈라
       buildRoom()/prefetchActors() 는 **방이 실제로 바뀔 때만** 돈다. */
    var roomRk = (run.town ? 'town' : run.floor) + ':' + run.roomIdx + ':' +
             (run.room && run.room.cleared ? 'c' : 'o') + pzProg + capProg + ':sec' + secFound + forageProg;
    var fwRk = (wmNow ? 'w' : '') + fldCx0 + '_' + fldCz0;
    var roomChanged = (roomRk !== roomKey);
    if (roomChanged) {
      roomKey = roomRk;
      lastFrameHadBuild = true;
      var roomT0 = nowMs();
      try {
        prefetchActors(run); buildRoom(run);
      } catch (e) {
        if (global.console) { console.warn('[던전 3D] 방을 다시 짓다가 실패 — 이번 칸은 옛 그림 그대로 둔다', e); }
        try {
          var emsg2 = String((e && e.message) || e);
          if (core && core.emit && !fieldBuildErrShown[emsg2]) {
            fieldBuildErrShown[emsg2] = true;
            core.emit('toast', '⚠️ 방 재구성 실패: ' + emsg2.slice(0, 140));
          }
        } catch (e3) { /* 토스트 자체가 죽어도 렌더는 계속 이어간다 */ }
      }
      lastRoomBuildMs = nowMs() - roomT0;
    }
    /* 2026-09-07 — "이동할 때마다 화면이 갈색(배경)이 된다"(PC·모바일 둘 다)
       제보. 들판 창이 걸을 때마다(칸 경계를 넘을 때마다) 다시 걸리는데,
       여기가 던지면 **이번 칸은 옛 그림 그대로 두고 카메라·렌더는 그대로
       이어간다** — 그 프레임은 `renderer.render()`까지 항상 가게. 메시지별
       1회만 띄워 도배를 막는다. */
    /* 세계 지도 판끼리(마을→마을·마을→들판)는 방이 바뀌어도 들판은 같은 세계라
       창이 그대로면 다시 짓지 않는다 — 창이 옮겨가면 뒤에서 짓고 갈아 끼운다 */
    var wmStay = wmNow && lastFieldWm === true;
    if ((roomChanged && !wmStay) || fwRk !== fieldWinKey) {
      fieldWinKey = fwRk;
      lastFrameHadBuild = true;
      var fieldT0 = nowMs();
      try {
        buildField(run, fldCx0, fldCz0, wmStay || !roomChanged);
      } catch (e) {
        if (global.console) { console.warn('[던전 3D] 들판을 다시 짓다가 실패 — 이번 칸은 옛 그림 그대로 둔다', e); }
        try {
          var emsg3 = String((e && e.message) || e);
          if (core && core.emit && !fieldBuildErrShown[emsg3]) {
            fieldBuildErrShown[emsg3] = true;
            core.emit('toast', '⚠️ 지형 재구성 실패: ' + emsg3.slice(0, 140));
          }
        } catch (e4) { /* 토스트 자체가 죽어도 렌더는 계속 이어간다 */ }
      }
      lastFieldSetupMs = nowMs() - fieldT0;
    }
    /* buildField()는 이제 창만 정해 두고, 실제 짓기는 매 프레임 예산만큼만
       나눠 진행한다(위 fieldJobStep 주석) — 위 if가 안 돈 프레임에도 진행 중인
       공사가 있으면 계속 이어야 하므로 if 블록 밖, 매 프레임 부른다. */
    fieldJobStep();
    /* GLB 도착(네트워크 콜백, rAF 밖)이 몰아 놓은 buildHero() 조립(retarget
       포함, asset3d.js 참고)을 프레임당 하나씩만 흘려보낸다 — fieldJobStep과
       같은 예산제 요령. */
    if (AS()) { AS().tick(); }
    /* 잎·풀 흔들림 시계(PLAN §6.1-5 나머지 절반, sway3d.js) — 이 render()는
       dt 를 안 들고 있어(위 AS().tick()과 같은 사정) sway3d 가 스스로 잰다 */
    if (global.DG.sway3d) { global.DG.sway3d.tick(); }

    /* 조명 */
    var L = lightPlan(run.floor, run.room && run.room.kind, DARK()); if (!L.town) { L.ambientHex = mix(L.ambientHex, 0xb8c4d6, tuned('dungeon3d.roomAmb', 0.5)); }   // W-0145 방 반구광 색을 밝은 회청 쪽으로(짙은 남색 0x2a2f3c 이라 횃불 밖 바닥이 검었다) — 손잡이 0 = 옛
    amb.intensity = L.ambient;
    amb.color.setHex(L.ambientHex);
    /* **다섯 번째 재조사(2026-09-04)의 진짜 원인** — `HemisphereLight`는
       하늘쪽(`.color`)·땅쪽(`.groundColor`) 색을 따로 갖는데, 바로 위 줄은
       하늘쪽만 매 프레임 방 밝기에 맞춰 갈아 끼우고 **땅쪽은 init()의
       `0x0a0a0c`(거의 검정)에 그대로 박혀 있었다.** 위를 보는 면(바닥)은
       하늘쪽 색을 거의 그대로 받아 밝지만, 옆·아래를 보는 면(벽·비탈진
       소품)은 그 짙게 박힌 땅쪽 색과 섞여 방향광이 안 닿는 쪽에서 거의
       새까매진다 — 카메라 거리·그림자맵·SSAO 어느 것과도 무관해서(순수
       반구광 계산 문제) 줌·그림자 끄기·SSAO 끄기 전부 안 먹혔던 것이다.
       마을처럼 하늘쪽이 밝은 방일수록 이 어긋남이 도드라진다(땅쪽만
       계속 어두우니까). 땅쪽도 하늘쪽 절반 밝기로 같이 따라가게 한다 —
       완전히 맞추면(둘 다 동일) 벽의 입체감(면마다 다른 밝기)이 사라져
       밋밋해지므로, 여전히 하늘보다는 어둡게 두어 방향성은 살린다. */
    /* 마을은 어둠 자체를 없앴으니(위 lightPlan town 가지) 땅쪽도 하늘쪽만큼
       그대로 밝게 — 여기서 절반을 검게 섞으면 그 결정이 도로 무효가 된다. */
    amb.groundColor.setHex(L.town ? L.ambientHex : mix(L.ambientHex, 0x000000, 0.5));
    key.intensity = L.keyIntensity;
    key.color.setHex(L.keyHex);
    /* 그림자 카메라(±520, 위 init 참고)는 방 크기에 맞춘 상자라 방 밖
       들판까지는 안 덮는다 — 그 상자 밖에 있는 조각은 그림자맵 텍스처를
       가장자리로 clamp해 읽어 "그림자 진 것"으로 잘못 판정된다(three.js의
       방향광 그림자 흔한 함정). 그 결과가 필드에서 본 "각진 새까만 사각형"
       버그였다(2026-09-04, 사용자 제보로 발견) — 방 중심에 고정해 두던
       빛의 위치·과녁을 **플레이어를 따라가게** 바꿔 상자 자체를 늘 플레이어
       둘레에 두면, 들판 어디를 걷든 그 자리는 늘 상자 안이라 이 문제가
       안 생긴다. 빛과 과녁 사이의 상대 위치(각도)는 그대로 유지한다. */
    key.target.position.set(p0x, 0, p0y);
    key.position.set(p0x + (W * 0.3 - W / 2), 260, p0y + (H * 0.1 - H / 2));
    key.target.updateMatrixWorld();
    /* 맞으면 · 위태로우면 바탕과 안개가 붉어진다 (3단계) */
    var FX = global.DG.fx3d;
    var lowHp = run.hpMax ? core.clamp((0.34 - run.hp / run.hpMax) / 0.34, 0, 1) : 0;
    var bgHex = FX ? FX.hurtTint(L.bgHex, p0.hurt, lowHp) : L.bgHex;
    if (FX) { amb.color.setHex(FX.hurtTint(L.ambientHex, p0.hurt, lowHp * 0.6)); }

    /* 안개 거리를 **실제로 세운 들판 반경**(`FIELD_R()`, 등급마다 다르다)을
       넘지 않게 누른다. `lightPlan()`이 못박은 안개값(마을 far 2100 등)이
       세운 땅의 가장자리보다 훨씬 멀면, 안개가 다 가리기도 전에 땅이 먼저
       끊겨 그 자리가 배경색 그대로 드러난다 — **네 번째 재조사(2026-09-04)
       진짜 원인**. 마을은 조명이 밝아(`lightPlan`의 town 가지) 안 가려진
       가장자리 땅이 거의 원래 밝기 그대로 보이다가 뚝 끊기니 "각진 새까만
       사각형"으로 도드라졌다 — LOW 등급(`FIELD_R()`=2, 가장자리 500)은
       안개 시작(near 620)보다도 세운 땅이 짧아 아예 안개를 한 번도 못
       거치고 끊겼다. 세운 가장자리에서 **정확히** 안개가 다 덮이게 맞춘다. */
    var fogNear = L.fog.near, fogFar = L.fog.far;
    if (FIELD()) {
      var F2 = global.DG.field3d;
      if (F2) {
        /* fieldVisR(run) 을 쓴다 — 통로 있는 마을은 buildField()가 이미 그만큼
           더 세우므로(PLAN §28-2 Phase 3), 안개도 같이 물려야 "세운 가장자리 =
           안개가 다 덮는 자리" 라는 위 대전제가 안 깨진다. 던전 층은 corridors가
           없어 fieldVisR(run) === FIELD_R() — 이 줄만으로는 회귀가 없다. */
        var builtEdge = (fieldVisR(run) + 0.5) * F2.CHUNK;
        fogFar = Math.min(fogFar, builtEdge);
        fogNear = Math.min(fogNear, builtEdge * 0.4);
        if (fogNear >= fogFar) { fogNear = fogFar * 0.4; }
      }
    }
    var p = run.player;
    var plx = p.x - anc.x, ply = p.y - anc.y;   // 세계 → 로컬(위 anc 주석)
    var meGroundY = groundYAt(plx, ply);
    torch.intensity = L.torchIntensity;
    torch.color.setHex(L.torchHex);
    torch.distance = L.torchRange;
    torch.position.set(plx, meGroundY + 46, ply);

    var moveTgt = d().moveTarget ? d().moveTarget() : null;
    if (moveTgt) {
      var mtx = moveTgt.x - anc.x, mty = moveTgt.y - anc.y;
      moveMark.position.set(mtx, groundYAt(mtx, mty) + 2, mty);
      moveMark.visible = true;
      var pulse = 1 + Math.sin(nowMs() / 140) * 0.14;
      moveMark.scale.set(pulse, pulse, pulse);
    } else {
      moveMark.visible = false;
    }

    var AS3 = AS();
    var nowT = Date.now() / 1000, OAw = global.DG.ownAnim;   // W-0171 무기 몸짓

    var actorsT0 = nowMs();
    /* 나 */
    var me = actorOf('me', 'me', null);
    me.node.position.set(plx, meGroundY, ply);
    /* 걷는 방향을 그대로 돌린다 — 예전엔 `p.facing`(좌우 ±1)만 봐서 위·아래로
       걸어도 몸은 늘 옆(왼쪽/오른쪽)만 보고 있었다. `p.dirX`·`p.dirY`(마지막
       이동 방향, 스킬 방향과 같은 값)를 쓰면 적·NPC 가 나를 볼 때 쓰는
       `atan2(dx, dy)`와 같은 결로 앞·뒤·대각선까지 다 돈다. */
    if (p.walking) { me.ang = Math.atan2(p.dirX || (p.facing || 1), p.dirY || 0.001); }
    me.node.rotation.y = me.ang;
    /* 걸으면 위아래로 튄다 — 도형으로 남아 있을 때만 도드라진다(GLB 는 제 다리로 걷는다).
       땅 높이(meGroundY) 위에 얹는다 — 안 그러면 언덕에서 튈 때마다 땅 밑으로 파고든다 */
    me.node.position.y = meGroundY + (p.walking ? Math.abs(Math.sin(p.phase || 0)) * 2.2 : 0);
    /* 탈것(mount.js) — 말·학·용은 발밑에 서고 나는 그 등 높이에 앉는다. 뜬 탈것은 HOVER 만큼 띄워 출렁 */
    var MT3 = global.DG.mount, mtRef = MT3 && MT3.active && MT3.active() ? MT3.bodyRef() : null;
    if (mtRef) {
      var mtA = actorOf('mount', 'mount', mtRef), bob = MT3.flying() ? Math.sin(nowT * 3) * 1.6 : 0;
      mtA.node.position.set(plx, meGroundY + MT3.mountLift() + bob, ply);
      if (p.walking || MT3.flying()) { mtA.ang = me.ang; }
      mtA.node.rotation.y = mtA.ang;
      me.node.position.y = meGroundY + MT3.lift() + bob;
      if (AS3) { AS3.step(mtA.node.userData.mixerNode, { t: nowT, walking: !!p.walking || MT3.flying(), anim: 'idle' }); }
    }
    if (AS3) {
      AS3.step(me.node.userData.mixerNode, { t: nowT, walking: !!p.walking && !mtRef,
        anim: p.dodge ? 'dodge' : ((OAw && OAw.attackSlot ? OAw.attackSlot(p._wpn || (p._wpn = {}), p.castAnim ? 0 : Math.max(0, p.atkAnim || 0), nowT, function () { var IT = global.DG.item, w = IT ? IT.equipped(core.save.party[0]).weapon : null; return w && !IT.isBroken(w) ? (IT.baseOf(w) || {}).look : 'sword'; }, function () { var R = global.DG.dungeon && global.DG.dungeon.raw ? global.DG.dungeon.raw() : null; return ((R && R.combo) || 1) - 1; }) : null) || (p.atkAnim > 0 ? (p.castAnim ? 'interaction' : 'attack') : (p.walking && !mtRef ? 'walk' : 'idle'))) });   // W-0171 무기·연속 단 몸짓
      AS3.flashAllMat(ensureFlash(me.node), p.hurt, 0.28);
    }

    /* 동행(同行, PLAN §51) — 부대 2번째 인물. 'me'와 같은 요령(걷는 방향
       회전·걸음 튐·GLB 애니메이션)을 그대로 따라간다. dungeon.js의
       updateCompanion()이 매 틱 c.x·c.y·c.dirX·c.dirY·c.walking·c.atkAnim을
       이미 판정 층에서 굴려 두므로, 여기(화면 층)는 그 값을 그대로 읽기만
       한다 — 새 판정을 만들지 않는다. */
    var c = run.companion;
    if (c) {
      var allyGroundY = groundYAt(c.x, c.y);
      var ally = actorOf('ally', 'ally', c);
      ally.node.position.set(c.x, allyGroundY, c.y);
      if (c.walking) { ally.ang = Math.atan2(c.dirX || (c.facing || 1), c.dirY || 0.001); }
      ally.node.rotation.y = ally.ang;
      ally.node.position.y = allyGroundY + (c.walking ? Math.abs(Math.sin(c.phase || 0)) * 2.2 : 0);
      /* §5.16 몸짓 — 서명 무예에 호응(❗)·보스·레벨업에 환호(🎉, 통통 튄다). 걷거나 치는 중이면 글자만 */
      var allyBase = c.atkAnim > 0 ? 'attack' : (c.walking ? 'walk' : 'idle');
      var allyG = GS() ? GS().plan('ally', nowT, allyBase, false) : null;
      if (allyG && allyG.bob) { ally.node.position.y += allyG.bob * 7; }
      gestureBubble(ally.node, allyG, 62);
      if (AS3) {
        AS3.step(ally.node.userData.mixerNode, { t: nowT, walking: !!c.walking, anim: allyG ? allyG.slot : allyBase });
      }
    }
    /* c가 없으면(부대 2번째 인물이 없는 회차) 그냥 actorOf('ally',...)를 이번
       프레임에 안 부른다 — sweep()가 "이번 프레임에 안 쓰인 배우"를 알아서
       치운다(아래), 여기서 따로 지울 함수를 안 만들어도 된다. */

    /* 적 */
    var es = (run.room && run.room.enemies) || [], i;
    for (i = 0; i < es.length; i++) {
      var e = es[i];
      if (e.hp <= 0) {
        /* §5.19 쓰러짐 — 사라지지 않고 맞은 쪽으로 날아가 뒤로 넘어진 뒤 가라앉는다(잡졸 0.7초·정예/보스 1초).
           방향은 판정 층 kill() 이 남긴 dieDx/dieDy. 그림만 — 판정은 이미 끝났다 */
        if (e.dieDx === undefined) { continue; }
        if (e._dieT0 === undefined) { e._dieT0 = nowT; }
        var DIE = e.dieBig ? 1.0 : 0.7, du = (nowT - e._dieT0) / DIE;
        if (du > 1) { continue; }
        /* §5.19 2차 흩어짐 — dieF(세게 맞을수록 멀리·높이)·dieSpin(공중에서 빙글) 은 판정 층 dieScatter() 가 남긴다 */
        var dF = e.dieF || 1;
        var fly = (e.dieBig ? 10 : 28) * dF * (1 - (1 - du) * (1 - du));
        var dxw = e.x + e.dieDx * fly, dyw = e.y + e.dieDy * fly;
        var da3 = actorOf('e' + i + ':' + (e.ref && e.ref.id), 'foe', e);
        da3.node.rotation.order = 'YXZ';
        da3.node.rotation.y = Math.atan2(-e.dieDx, -e.dieDy) + (e.dieSpin || 0) * Math.min(1, du * 1.6) * 4;
        da3.node.rotation.x = -Math.min(1, du * 1.8) * 1.35;
        da3.node.position.set(dxw, groundYAt(dxw, dyw) + Math.sin(Math.min(1, du * 1.6) * Math.PI) * (e.dieBig ? 3 : 10) * Math.min(1.6, dF) -
          (du > 0.72 ? (du - 0.72) / 0.28 * 8 : 0), dyw);
        if (AS3) { AS3.step(da3.node.userData.mixerNode, { t: nowT, walking: false, anim: 'death' }); }
        continue;
      }
      /* 세계 보스(§5.4) 부위 파괴 — 키에 부서진 부위를 섞어 넣으면 부서질
         때마다 actorOf 가 새 몸(새 look)을 짓는다. sweep() 이 옛 키를
         "이번 프레임에 안 보였다"로 알아서 치운다 — 수동 정리 필요 없다. */
      var wbk = e.worldBoss ? (':' + (e.wbWeaponBroken ? 1 : 0) + (e.wbArmorBroken ? 1 : 0) + (e.wbHelmBroken ? 1 : 0)) : '';
      var a = actorOf('e' + i + ':' + (e.ref && e.ref.id) + wbk, 'foe', e);
      a.node.position.set(e.x, groundYAt(e.x, e.y), e.y);
      a.node.rotation.y = Math.atan2(p.x - e.x, p.y - e.y);
      a.node.rotation.x = 0;
      /* 맞은 직후에는 흔들린다 · §5.19 움찔(hit 모션)은 0.28초 — 판정의 80ms 플래시로는 모션이 안 보였다 */
      if (e.hurt > 0) { a.node.position.x += (Math.random() - 0.5) * 3; e._hitUntil = nowT + 0.28; }
      if (AS3) {
        /* 어그로(2026-09-10) — 아직 못 알아챈 적은 사거리 판정과 무관하게
           'idle'(마을 NPC와 같은 이름, 아래 townMark 자리와 같은 결)이다.
           안 그러면 안 쫓아오는데 걷는 시늉만 제자리서 계속하는 것처럼 보인다. */
        var eWalking = e.aggro && Math.hypot(p.x - e.x, p.y - e.y) > (e.r || 12) + (d().P_R || 13) + 8;
        var eAnim = (e.hurt > 0 || nowT < (e._hitUntil || 0)) ? 'hit' : (!e.aggro ? 'idle' : (eWalking ? 'walk' : 'attack'));
        AS3.step(a.node.userData.mixerNode, { t: nowT, walking: eWalking, anim: eAnim });
        /* §5.8① 피격 플래시 80ms(2026-09-18) — span 을 e.hurt 초기값(dungeon.js
           strike() 의 0.08)과 맞춰야 최고 밝기(1.0)에 실제로 닿는다 */
        AS3.flashAllMat(ensureFlash(a.node), e.hurt, 0.08);
        if (e.shade) { ensureShade(a.node); }
      }
    }

    /* 마을 사람과 표식 — 던전 방에는 없는 것들이다(`room.npcs` · `room.marks`).
       판정은 이미 이 둘을 방 안에 놓아 두었다 — 여기서는 세우기만 한다. */
    var TW = global.DG.town;
    var talkR = (TW && TW.TALK_R) || 40;
    var ns = (run.room && run.room.npcs) || [];
    for (i = 0; i < ns.length; i++) {
      var np = ns[i];
      var na = actorOf('n' + np.key, 'npc', np);
      na.node.position.set(np.x - anc.x, 0, np.y - anc.y);
      na.node.rotation.y = Math.atan2(p.x - np.x, p.y - np.y);   // 다가서면 나를 본다(둘 다 세계 좌표라 차는 그대로)
      townMark(na.node, Math.hypot(np.x - p.x, np.y - p.y), talkR);
      /* §5.16 몸짓 — 닿으면 인사(👋), 연 시트에서 일을 보면 제 일 몸짓(🔨 벼림…), 틈틈이 혼자 일한다 */
      var npG = GS() ? GS().plan(np.key, nowT, 'idle', true) : null;
      gestureBubble(na.node, npG, 70);
      if (AS3) { AS3.step(na.node.userData.mixerNode, { t: nowT, walking: false, anim: npG ? npG.slot : 'idle' }); }
    }
    var mks = (run.room && run.room.marks) || [];
    for (i = 0; i < mks.length; i++) {
      var mo = mks[i];
      var ma = actorOf('m' + mo.key, 'mark', mo);
      ma.node.position.set(mo.x - anc.x, 0, mo.y - anc.y);
      var mDist = Math.hypot(mo.x - p.x, mo.y - p.y);
      townMark(ma.node, mDist, talkR);
      if (mo.key.indexOf('exit_') === 0) {
        maybePrefetchCorridor(run, mo, p);
      }
    }
    maybePrefetchDoorTex(run, p);   // PLAN §28-4 Phase 4 — 마을엔 run.corridors에 laneAt이 없어 그대로 넘어간다
    maybePrefetchNearbyTowns(run, p);   // PLAN §28-8 후속 — 표식이 아니라 마을 발판과의 거리로, 던전은 !run.town이라 안 걸림

    /* 바닥의 전리품 — 등급색으로 빛나는 낮은 조각 */
    var ds = (run.room && run.room.drops) || [];
    for (i = 0; i < ds.length; i++) {
      var dp = ds[i];
      var da = actorOf('d' + i, 'drop', null);
      /* 자리(i)는 같아도 떨어진 물건이 바뀌면 다시 짓는다 — 옛 색이 남던 것 */
      if (!da.node.userData.built || da.node.userData.ref !== dp) {
        while (da.node.children.length) { da.node.remove(da.node.children[0]); }
        if (!(global.DG.loot3d && global.DG.loot3d.add(da.node, dp, T, dropHex(dp)))) { box(da.node, 0, 3, 0, 12, 6, 12, global.DG.loot3d ? global.DG.loot3d.hexOf(dp, dropHex(dp)) : dropHex(dp), 'glow', false); }   // W-0146 아이콘 + 등급 받침(loot3d.js), 아이콘 없으면 옛 상자(종류 색)
        var bm = lootBeam(dp);
        if (bm) { da.node.add(bm); }
        da.node.userData.built = true;
        da.node.userData.ref = dp;
      }
      da.node.position.set(dp.x, 0, dp.y);
      da.node.rotation.y = frame * 0.02;
    }

    /* 기공파 — 판정이 굴리는 투사체를 그대로 세운다 */
    var ss = run.shots || [];
    for (i = 0; i < ss.length; i++) {
      var sh = ss[i];
      var sa = actorOf('s' + i, 'shot', null);
      if (!sa.node.userData.built) {
        while (sa.node.children.length) { sa.node.remove(sa.node.children[0]); }
        /* 알과 꼬리. 재질은 사본이다 — 원소마다 색이 다르다 */
        var sc0 = box(sa.node, 0, 0, 0, 10, 10, 10, 0x9fe8ff, 'glow', false);
        var st0 = box(sa.node, 0, 0, -9, 6, 6, 22, 0x9fe8ff, 'glow', false);
        sa.node.userData.shotMat = [ownMat(sc0), ownMat(st0)];
        sa.node.userData.shotMat[1].transparent = true;
        sa.node.userData.shotMat[1].opacity = 0.45;
        sa.node.userData.built = true;
      }
      /* 원소 색은 판정이 이미 들고 있다 (shots[].color) */
      var shex = FX ? FX.shotHex(sh) : 0x9fe8ff;
      var sm = sa.node.userData.shotMat, sj;
      for (sj = 0; sm && sj < sm.length; sj++) {
        sm[sj].color.setHex(shex);
        if (sm[sj].emissive) { sm[sj].emissive.setHex(shex); }
      }
      sa.node.position.set(sh.x - anc.x, 22, sh.y - anc.y);
      sa.node.rotation.y = Math.atan2(sh.dx || 0, sh.dy || 0);
    }

    /* 궁수·조총병이 쏜 것 — 판정이 굴리는 그대로, 색만 기본을 다르게 둔다
       (몬스터 다양화 — 나에게 오는 화살이라는 걸 한눈에 가른다) */
    var fss = run.foeShots || [];
    for (i = 0; i < fss.length; i++) {
      var fsh = fss[i];
      var fa = actorOf('f' + i, 'shot', null);
      if (!fa.node.userData.built) {
        while (fa.node.children.length) { fa.node.remove(fa.node.children[0]); }
        var fc0 = box(fa.node, 0, 0, 0, 8, 8, 8, 0xe08a5a, 'glow', false);
        var ft0 = box(fa.node, 0, 0, -8, 4, 4, 18, 0xe08a5a, 'glow', false);
        fa.node.userData.shotMat = [ownMat(fc0), ownMat(ft0)];
        fa.node.userData.shotMat[1].transparent = true;
        fa.node.userData.shotMat[1].opacity = 0.45;
        fa.node.userData.built = true;
      }
      var fhex = FX ? FX.shotHex({ color: fsh.color || '#e08a5a' }) : 0xe08a5a;
      var fm = fa.node.userData.shotMat, fj;
      for (fj = 0; fm && fj < fm.length; fj++) {
        fm[fj].color.setHex(fhex);
        if (fm[fj].emissive) { fm[fj].emissive.setHex(fhex); }
      }
      fa.node.position.set(fsh.x - anc.x, 20, fsh.y - anc.y);
      fa.node.rotation.y = Math.atan2(fsh.dx || 0, fsh.dy || 0);
    }

    sweep();
    lastActorsMs = nowMs() - actorsT0;

    /* 카메라 — 회전은 막는다(8절). 부드럽게 따라온다 */
    /* 마을은 세로 폰 화면에서 너무 멀리·작게 보인다는 실기기 지적(2026-09-01)에
       맞춰 물러나는 폭을 줄였다 — 예전엔 기본 1.15배 + 세로 화면에서 최대 1.5배
       까지 더 물러났는데(1.15×1.5=1.725배), 마당(560×380) 전체를 한눈에 담으려던
       뜻이 지나쳐 사람이 개미만 해졌다. 지금은 기본은 던전과 같게 두고 세로
       화면에서만 최대 1.2배로 줄여 잡는다 — 여전히 화면비 보정은 하되 덜 물러난다.
       던전 쪽 거리는 그대로다(연출·조작 감각이 거기 맞춰져 있다). */
    var zNow = ZOOM() / USERZOOM();
    if (run.town) {
      var asp = camera.aspect || 1;
      zNow *= (asp < 1 ? Math.min(1.2, 1 / Math.max(0.7, asp)) : 1);
    }
    var BC3 = global.DG.beltCam3d, aim = (!run.town && BC3 && BC3.on()) ? BC3.beltCam(plx, ply, W, H, { aspect: camera.aspect, fov: camera.fov, zoom: zNow, gy: meGroundY }) : camAim(plx, ply, W, H, zNow, TILT(), !!run.town, meGroundY);   // W-0158 벨트 카메라(belt-cam3d.js), 손잡이 0 = 옛
    /* 2026-09-08 — 실기기 로그로 실측: 화질이 진짜로 low 로 떨어질 때(가끔
       실제로 무거운 프레임이 있어 정당하게 떨어진다) low 의 안개 거리(500)가
       사용자가 확대·축소로 물러난 실제 카메라 거리(`aim.dist`, 줌에 따라
       500 을 훌쩍 넘을 수 있다)보다 짧으면, 카메라 자신이 이미 안개 너머에
       있는 꼴이라 화면 대부분이 배경색으로 덮인다 — "갈색이 화면을 가린다"
       제보의 실제 원인. 등급과 무관하게 **카메라가 서 있는 자리까지는 항상
       안개 밖**이게 최소 거리를 보장한다. */
    /* 2026-09-10 — 사용자가 "안개는 다 제거해"·"화면이 안보여"로 안개 자체를
       없애 달라고 요청했다. 위 fogNear/fogFar 계산(들판 가장자리에 맞추기·
       카메라가 늘 안개 밖에 있게 하기)은 그동안 반복된 "화면이 갈색/안
       보인다" 제보의 근본 원인이 전부 안개-카메라 거리 상호작용이었다 —
       안개 자체를 끄면 그 버그 부류가 통째로 없어진다. `scene.background`
       (하늘·배경색)는 안개와 별개라 그대로 둔다. 대신 들판 가장자리(세운
       땅이 끊기는 자리)가 이제 안개로 안 가려지므로 그 각진 경계가 보일
       수 있다 — 다음에 "땅 끝이 각져 보인다"는 제보가 오면 이 트레이드오프
       때문이다(안개를 다시 켜는 대신 땅을 더 넓게 세우는 쪽으로 풀 것). */
    scene.fog = null;
    scene.background = new T.Color(bgHex);
    if (frame % 120 === 0) {
      var diagMsg = '📊 tier=' + effectiveLevel() + ' ema=' + perfEma.toFixed(1) +
        'ms fogFar=' + fogFar.toFixed(0) + ' fieldR=' + fldR + ' camDist=' + aim.dist.toFixed(0) +
        ' room=' + lastRoomBuildMs.toFixed(1) + 'ms field=' + lastFieldSetupMs.toFixed(1) +
        'ms finalize=' + lastFieldFinalizeMs.toFixed(1) + 'ms';
      if (global.console) { console.log('[던전 3D 진단]', diagMsg); }
      /* 2026-09-08 — 이 셋을 안 지우면 "몇 초 전에 딱 한 번 있었던 값"이
         다음 줄에도 그대로 찍혀 "매번 다시 짓는다"는 착시를 준다(실기기
         로그에서 room=3.2ms가 7줄 내내 똑같이 찍힌 게 그 증거 — 이번 로그
         구간엔 방을 한 번도 안 나갔다는 뜻이었다). 찍고 나면 0으로 되돌려,
         다음 2초 구간에 실제로 안 일어나면 0으로 보이게 한다. */
      lastRoomBuildMs = 0; lastFieldSetupMs = 0; lastFieldFinalizeMs = 0;
    }
    var want = new T.Vector3(aim.pos.x, aim.pos.y, aim.pos.z);
    var look = new T.Vector3(aim.look.x, aim.look.y, aim.look.z);
    if (!camPos) { camPos = want.clone(); camLook = look.clone(); }
    else { rebaseCam(camPos, camLook, camAnc, anc); }
    camAnc = { x: anc.x, y: anc.y };
    camPos.lerp(want, 0.14);
    camLook.lerp(look, 0.14);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    var occT0 = nowMs();
    /* 카메라-캐릭터 사이 가림은 시각 보정용이라 60fps 로 다시 쏠 필요가
       없다 — 격프레임(30fps)으로도 안 티 난다(감사로 찾은 raycast 비용
       절감, 2026-09-08). 건너뛴 프레임은 지난 결과를 그대로 둔다. */
    if (frame % 2 === 0) { updateOcclusion(camera.position, plx, meGroundY + 44, ply); }
    lastOcclusionMs = nowMs() - occT0;
    var fxT0 = nowMs();
    if (FX) {
      /* 화면 흔들림 — 상한은 fx3d 가 진다 (51절) */
      var sk = FX.shakeAmt();
      if (sk > 0) {
        camera.position.x += (Math.random() - 0.5) * sk * 0.9;
        camera.position.y += (Math.random() - 0.5) * sk * 0.6;
        camera.updateMatrixWorld();
      }
      /* 연출은 카메라가 정해진 뒤에 앉힌다 */
      FX.step(run, d().fx(), camera);
    }
    lastFxMs = nowMs() - fxT0;

    /* 후처리를 거치거나(있고 켜져 있을 때) 곧바로 그린다 — 사가만리 `world3d.js`
       의 `present()` 와 같은 꼴이다. **두 길 다 톤매핑은 한 번 걸린다**
       (`post3d.js` 머리 참고) */
    var presentT0 = nowMs();
    if (global.DG.fieldInstance && global.DG.fieldInstance.cull) { global.DG.fieldInstance.cull(camera, scene); }
    var P3 = global.DG.post3d;
    if (P3) {
      if (P3.draw(renderer, scene, camera, { alt: postAlt(L), weather: 'clear' })) {
        lastPresentMs = nowMs() - presentT0;
        return true;
      }
      /* 후처리가 켜졌다 꺼졌을 수 있다(등급이 LOW 로 내려간 순간) — 마지막으로
         쓰던 렌더 타깃이 물려 있으면 캔버스가 검게 남는다 */
      renderer.setRenderTarget(null);
    }
    renderer.render(scene, camera);
    lastPresentMs = nowMs() - presentT0;
    return true;
  }

  /**
   * 전리품 빛기둥(§5.9) — 명품 이상은 떨어진 자리에서 등급색 기둥이 선다(원작 3편).
   * 명품 옅고 짧게 · 보물 · 전설/고유 굵고 높게. 안개를 뚫게 fog:false.
   */
  function lootBeam(dp) {
    var it = dp && dp.kind === 'item' ? dp.item : null;
    var tier = it ? (it.tier || 0) : 0;
    if (!it || (tier < 2 && !it.uniq)) { return null; }
    var IT = global.DG.itemData || null, col = '#ffff64';
    try { col = (IT && IT.TIERS && IT.TIERS[tier]) ? IT.TIERS[tier].color : (tier >= 4 ? '#c7a76c' : (tier === 3 ? '#00c000' : '#ffff64')); } catch (e) { /* 색은 없어도 선다 */ }
    if (it.uniq) { col = '#f0a53a'; }
    var big = tier >= 4 || !!it.uniq, h = big ? 260 : (tier === 3 ? 180 : 110);
    var m = new T.Mesh(new T.CylinderGeometry(big ? 5 : 3.5, big ? 5 : 3.5, h, 10, 1, true),
      new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: big ? 0.42 : 0.28,
        depthWrite: false, fog: false, side: T.DoubleSide }));
    m.position.y = h / 2;
    m.renderOrder = 4;
    return m;
  }

  function dropHex(dp) {
    var it = dp && (dp.item || dp);
    var g = it && it.grade;
    var D = global.DG.data;
    if (g && D && D.rarity && D.rarity[g]) {
      return parseInt(String(D.rarity[g].color).replace('#', ''), 16);
    }
    return 0xd9d9e0;
  }

  /** 눈으로 확인할 때 */
  function stats() {
    if (!available()) { return { none: true, failed: failed }; }
    var drawn = 0;
    scene.traverse(function (o) { if (o.isMesh) { drawn++; } });
    var run = d().raw();
    return {
      ready: ready, failed: failed, wanted: wanted(), town: isTown(),
      drawn: drawn, actors: Object.keys(actors).length,
      room: roomKey, floor: run ? run.floor : 0,
      cam: camPos ? [Math.round(camPos.x), Math.round(camPos.y), Math.round(camPos.z)].join(',') : '-',
      fx: global.DG.fx3d ? global.DG.fx3d.stats() : null,
      quality: effectiveLevel(), perfEma: Math.round(perfEma * 10) / 10,
      shadow: SHADOW()
    };
  }

  global.DG = global.DG || {};
  global.DG.dungeon3d = {
    init: init, resize: resize, render: render,
    available: available, active: active, wanted: wanted,
    /* 값을 내는 함수 — three 없이도 돈다(자가진단이 이것만 따로 본다) */
    camAim: camAim, userZoom: USERZOOM, lightPlan: lightPlan,
    /** PLAN §7.1-2 — 앵커가 바뀐 프레임의 카메라 옮기기(순수 함수, 진단용) */
    _rebaseCam: rebaseCam,
    /** PLAN 19절 — 그래픽 품질 AUTO. ms 평균 → 등급의 순수 매핑(진단용) */
    autoLevelFor: autoLevelFor, quality: effectiveLevel,
    /** 2026-09-07 — 켤 때 시작 등급을 고르는 기기 점수 매김(진단용, 순수 함수) */
    _deviceScore: deviceScore, _startLevelFor: startLevelFor,
    fieldR: FIELD_R, fieldDens: FIELD_D, shadow: SHADOW,
    /** 자가진단용 — 실제 프레임 없이 이동평균을 강제로 넣어 등급이 바뀌는지 본다 */
    _setPerfEma: function (ms) { perfEma = ms; autoLevel = autoLevelFor(ms); },
    /** 들판이 몇 조각인지 (2단계) */
    fieldKey: function () { return fieldKey; },
    three: function () { return T; },
    addFx: function (n) { if (fxGroup && n) { fxGroup.add(n); } return n; },
    camNode: function () { return camera; },
    /** 손잡이 — 이 판에는 어드민이 없어 콘솔·데모가 두드린다 */
    set: set, tuned: tuned, _roomLight: function () { return { lift: tuned('dungeon3d.roomLift', 0.65), amb: tuned('dungeon3d.roomAmb', 0.5) }; },   // W-0145 진단
    stats: stats,
    /** PLAN §28-4 Phase 4 — 순수 함수만 자가진단에 내준다(T 없이도 돈다) */
    _doorPrefetchTargets: doorPrefetchTargets, _nextRoomFor: nextRoomFor,
    _pickTex: pickTex, _FLOOR_TEX: FLOOR_TEX, _WALL_TEX: WALL_TEX,
    /** 실측용(init() 뒤에만 의미 있다) — 실제 텍스처 요청 횟수·캐시 존재 여부 */
    _texLoadCount: function () { return texLoadCount; },
    /** PLAN §28-8 후속 — render()가 실제로 프리페치를 걸었는지(단순 순수
     *  함수 계산이 아니라 render() 안에서 진짜 불렀는지) 자가진단이 본다 */
    _prefetchedTownIds: function () { return Object.keys(prefetchedTowns); },
    _texCached: function (url) { return !!rawTexCache[url]; },
    /** 자가진단용 — 장비→겉모습(look) 순수 함수 (PLAN §28-8 후속) */
    _weaponLookOf: weaponLookOf, _helmLookOf: helmLookOf, _armorLookOf: armorLookOf,
    _meLookOf: meLookOf, _meRenderParams: meRenderParams,
    /** 외모 커스텀 화면 전용 — 'me' 배우는 매 프레임 "이번에도 보였나"만
     *  체크하고(sweep()) 다시 안 지어지므로(장비 갈아입어도 같다, 알려진
     *  한계), 스타일/색을 고른 직후에만 이걸로 명시적으로 다시 짓는다. */
    refreshMe: function () { delete actors['me']; },
    /** 재기 — 지금 내 배우의 몸 파일·상태(사가나락 Q8 "던전에 들어가면 캐릭터가 바뀜") */
    meBody: function () { var a = actors['me'], m = a && a.node && a.node.userData.mixerNode; return m ? { body: m.userData.body, state: m.userData.assetState, seed: meRenderParams().seed } : null; }, _meMix: function () { var a = actors['me']; return a && a.node ? a.node.userData.mixerNode : null; },   // W-0171 진단·촬영
    /** §56 가림 페이드 — 실측용(init() 뒤에만 의미 있다) */
    _occCounts: function () { return { fade: Object.keys(occFade).length, inst: Object.keys(occInst).length }; }
  };
})(window);
