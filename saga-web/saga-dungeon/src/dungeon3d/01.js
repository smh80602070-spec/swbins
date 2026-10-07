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
        ambient: 1.05, ambientHex: 0xe7eaed,
        keyIntensity: 0.95, keyHex: 0xecf0f3,
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
    var stone = themeHex(run);

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
    floorMesh.material = texMat(mix(stone, 0x1a1a20, 0.25), floorTex, W / TILE, H / TILE);

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

