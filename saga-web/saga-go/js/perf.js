/**
 * 성능 — 버거우면 스스로 품질을 낮춘다 (3D 전환 PHASE 12)
 * ---------------------------------------------------------------
 * `PLAN.md` 28절이 우선순위를 못박아 두었다: **1 안정성 · 2 FPS · 3 로딩 · 4 그래픽**.
 * 그런데 이 판에는 **재기만 하고 아무 일도 안 하는 자리**가 있었다 — `game.js` 의
 * `tickFps` 는 숫자를 상자에 찍을 뿐이고, 품질 손잡이(`world3d.density` 따위)는
 * **사람이 어드민에서 손으로** 내려야 했다. 폰에서 버거운 사람이 그걸 알 리 없다.
 *
 * 여기서 프레임을 보고 **스스로 내린다**. 27절이 적어 둔 세 등급 그대로다.
 *
 *   HIGH    다 켠다
 *   MEDIUM  잔 사물 절반 · 사물 반경 0.75 · 비 알갱이 절반
 *   LOW     잔 사물 1/4 · 반경 0.55 · 짐승 절반 · **배우를 빌보드로** · 그림자 끔
 *
 * **내려가는 것은 빠르고 올라가는 것은 느리다.** 두 초 연속 버거우면 곧바로 내리고,
 * 열두 초 연속 넉넉해야 올린다 — 경계에서 오르내리면 그 자체가 더 나쁘다.
 *
 * **사람이 잡아 둔 손잡이를 뭉개지 않는다.** 손잡이 값을 덮어쓰는 대신 **곱한다** —
 * 어드민에서 `world3d.density` 를 0.5 로 두었다면 LOW 에서는 0.125 가 된다.
 * 그래서 세이브에도 아무것도 안 남는다(등급은 이 창이 열려 있는 동안의 사정이다).
 *
 * **판정에는 한 줄도 안 닿는다.** 손잡이 `perf.auto` 를 0 으로 두면 늘 HIGH 다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 스스로 내릴까 — 0 이면 늘 HIGH(사람이 잡은 대로만 간다) */
  function auto() { return core.tuned('perf.auto', 1) ? true : false; }
  /** 이 아래로 떨어지면 버거운 것으로 본다 */
  function LOW_FPS() { return core.tuned('perf.lowFps', 26); }
  /** 이 위로 올라가면 넉넉한 것으로 본다 (사이를 벌려 두어야 안 흔들린다) */
  function HIGH_FPS() { return core.tuned('perf.highFps', 48); }
  /** 내리기까지 버텨야 하는 시간(초) */
  function DOWN_SEC() { return core.tuned('perf.downSec', 2); }
  /** 올리기까지 버텨야 하는 시간(초) */
  function UP_SEC() { return core.tuned('perf.upSec', 12); }

  /* ── 세 등급 (PLAN 27절) ──────────────────────────────
   * 값은 **곱하는 배수**다. 1 이면 손잡이 그대로.
   *   prop    잔 사물 밀도      radius  사물 반경
   *   animal  짐승 무리 크기    sky     비·눈 알갱이
   *   mesh    배우를 입체로 세울까 (0 이면 1단계의 빌보드로 돌아간다)
   *   shadow  그림자를 드리울까
   *   post    후처리(블룸·색보정)를 걸까 — 자세한 값은 `post3d.js` 의 `TIER_POST`
   *           (톤매핑은 여기서 안 끈다. 캔버스에 바로 그리는 길에서도 걸린다)
   */
  var TIERS = [
    { key: 'HIGH', name: '높음', prop: 1, radius: 1, animal: 1, sky: 1, mesh: 1, shadow: 1, post: 1 },
    { key: 'MEDIUM', name: '보통', prop: 0.5, radius: 0.75, animal: 0.7, sky: 0.5, mesh: 1, shadow: 1, post: 1 },
    { key: 'LOW', name: '낮음', prop: 0.25, radius: 0.55, animal: 0.5, sky: 0.25, mesh: 0, shadow: 0, post: 0 }
  ];

  /* ── 기기 보기 (PLAN 27절 "기기 성능을 자동 감지한다") ──
   * 프레임을 재는 것만으로는 **처음 몇 초가 늘 버벅인다** — 폰에서 HIGH 로 켜고
   * 두 초를 버틴 뒤에야 내려간다. 켤 때 기기를 한 번 보고 **시작 등급**을 고른다.
   *
   * 무엇을 보나: 코어 수 · 메모리(GB) · 그릴 픽셀 수 · 터치 기기인가.
   * **점수를 내는 함수는 순수하다** — 값을 넣으면 답이 나오므로 자가진단이 값으로 본다.
   * (브라우저마다 `deviceMemory` 가 없기도 하다. 없으면 모르는 채로 셈한다)
   */
  function score(o) {
    var s = 0;
    var cores = o.cores || 0, mem = o.mem || 0;
    var px = (o.w || 0) * (o.h || 0) * (o.dpr || 1) * (o.dpr || 1);
    /* 코어 — 넷이면 보통, 여덟이면 넉넉 */
    s += cores >= 8 ? 2 : (cores >= 4 ? 1 : (cores > 0 ? 0 : 1));
    /* 메모리 — 크롬 계열만 알려 준다. 모르면 깎지도 더하지도 않는다 */
    s += mem >= 8 ? 2 : (mem >= 4 ? 1 : (mem > 0 ? 0 : 1));
    /* 그릴 픽셀 — 많을수록 무겁다. 폰의 3배 화면이 여기서 걸린다 */
    s += px > 4000000 ? -1 : (px > 1600000 ? 0 : 1);
    /* 터치 기기는 대개 폰이다 — 같은 점수면 한 단 낮게 본다 */
    if (o.touch) { s -= 1; }
    return s;
  }

  /** 점수 → 등급 번호. 순수 함수 */
  function tierOfScore(s) { return s >= 3 ? 0 : (s >= 1 ? 1 : 2); }

  /** 이 기기를 재 본다 — 브라우저가 없으면(진단) 아무것도 안 한다 */
  function probe() {
    var n = global.navigator || {};
    var sc = global.screen || {};
    return {
      cores: n.hardwareConcurrency || 0,
      mem: n.deviceMemory || 0,
      w: sc.width || 0, h: sc.height || 0,
      dpr: global.devicePixelRatio || 1,
      touch: !!(('ontouchstart' in global) || (n.maxTouchPoints > 0))
    };
  }

  var idx = 0;              // 지금 등급 (0 = HIGH)
  var started = false;
  var lowFor = 0, highFor = 0;
  var fps = 60, acc = 0, frames = 0, worst = 0;
  var changedAt = 0, changes = 0;

  /* 2026-09-28 — 자동을 끄면 늘 HIGH 로 봐서, 설정(⚙️)에서 "낮음"을 골라도(pin: auto=0 + startTier) 높음으로 돌았다
     (폰 발열 §6.1-B). 못박은 등급이 있으면 그것, 없으면 옛대로 HIGH */
  function tier() {
    if (auto()) { return TIERS[idx]; }
    var forced = core.tuned('perf.startTier', '');
    for (var i = 0; i < TIERS.length; i++) { if (TIERS[i].key === forced) { return TIERS[i]; } }
    return TIERS[0];
  }

  /**
   * 이 갈래의 배수 — 각 모듈이 제 손잡이에 **곱한다**.
   * 모르는 갈래는 1 을 준다(새 갈래가 생겨도 여기 없으면 그냥 안 깎인다).
   */
  function mul(key) {
    var t = tier();
    return t[key] === undefined ? 1 : t[key];
  }

  /** 배우를 입체로 세울까 · 그림자를 드리울까 · 후처리를 걸까 — 0/1 이라 따로 낸다 */
  function meshOk() { return mul('mesh') ? true : false; }
  function shadowOk() { return mul('shadow') ? true : false; }
  function postOk() { return mul('post') ? true : false; }

  /**
   * 등급을 정한다 — **순수 함수다.** 지금 등급과 최근 사정만 보고 다음 등급을 낸다.
   * 그래서 자가진단이 "20fps 가 3초 이어지면 어디로 가나" 를 값으로 물어볼 수 있다.
   */
  function decide(cur, f, lowSec, highSec) {
    if (f < LOW_FPS() && lowSec >= DOWN_SEC() && cur < TIERS.length - 1) { return cur + 1; }
    if (f > HIGH_FPS() && highSec >= UP_SEC() && cur > 0) { return cur - 1; }
    return cur;
  }

  /**
   * 켤 때 한 번 — 기기를 보고 시작 등급을 고른다.
   * 손잡이 `perf.startTier` 로 사람이 못박아 둘 수 있다(`HIGH`·`MEDIUM`·`LOW`).
   */
  function start() {
    if (started || global.DG_NO_DRAW) { return tier(); }
    started = true;
    var forced = core.tuned('perf.startTier', '');
    if (forced) { return set(forced); }
    if (!auto()) { return tier(); }
    var p = probe();
    idx = tierOfScore(score(p));
    if (idx > 0) {
      core.emit('toast', '⚙️ 이 기기에 맞춰 화면 품질을 ' + TIERS[idx].name + ' 으로 시작합니다');
    }
    return tier();
  }

  /**
   * 한 프레임. `game.js` 가 부른다.
   * **화면이 없으면 재지 않는다** — 자가진단은 rAF 가 거의 안 돌아 늘 버거워 보인다.
   */
  function tick(dt) {
    if (global.DG_NO_DRAW || !dt) { return idx; }
    if (!started) { start(); }
    frames++; acc += dt;
    if (dt * 1000 > worst) { worst = dt * 1000; }
    if (acc < 0.5) { return idx; }

    fps = frames / acc;
    frames = 0; acc = 0; worst = 0;

    if (fps < LOW_FPS()) { lowFor += 0.5; highFor = 0; }
    else if (fps > HIGH_FPS()) { highFor += 0.5; lowFor = 0; }
    else { lowFor = 0; highFor = 0; }

    if (!auto()) { return idx; }
    var next = decide(idx, fps, lowFor, highFor);
    if (next !== idx) {
      idx = next;
      lowFor = 0; highFor = 0;
      changes++;
      changedAt = Date.now();
      /* 조용히 바꾸지 않는다 — 갑자기 그림이 성글어지면 고장으로 보인다 */
      core.emit('toast', '⚙️ 화면 품질 ' + TIERS[idx].name +
        ' (' + Math.round(fps) + 'fps)');
      core.emit('perf', { tier: TIERS[idx].key, fps: fps });
    }
    return idx;
  }

  /** 사람이 직접 고를 때 (어드민·데모) — 메모리에만 얹는다(손잡이는 안 건드린다) */
  function set(key) {
    for (var i = 0; i < TIERS.length; i++) {
      if (TIERS[i].key === key) { idx = i; lowFor = 0; highFor = 0; return TIERS[i]; }
    }
    return tier();
  }

  /**
   * 설정 화면(⚙️, 2026-09-10)에서 등급을 못박는다 — **자동조절을 끄고**
   * (`perf.auto=0`) 다음에 켤 때도 이 등급에서 시작하도록(`perf.startTier`)
   * 손잡이 둘을 함께 저장한다. `set()` 과 달리 새로고침해도 유지된다.
   * 곧바로도 적용한다 — 다음 프레임부터 이 등급으로 그린다.
   */
  function pin(key) {
    core.setTune({ 'perf.auto': 0, 'perf.startTier': key });
    return set(key);
  }

  /** 자동(기기를 보고 시작 → 프레임에 맞춰 스스로 오르내림)으로 되돌린다 */
  function unpin() {
    core.setTune({ 'perf.auto': 1, 'perf.startTier': null });
  }

  /** 지금 등급이 사람이 못박은 것인가(true) 자동인가(false) — 설정 화면 표시용 */
  function pinned() { return !auto(); }

  function stats() {
    return {
      auto: auto(), tier: tier().key, fps: Math.round(fps),
      started: started, probe: probe(), score: score(probe()),
      lowFor: lowFor, highFor: highFor, changes: changes,
      mul: { prop: mul('prop'), radius: mul('radius'), animal: mul('animal'), sky: mul('sky') },
      mesh: meshOk(), shadow: shadowOk(), post: postOk()
    };
  }

  global.DG = global.DG || {};
  global.DG.perf = {
    TIERS: TIERS,
    auto: auto, tier: tier, mul: mul, meshOk: meshOk, shadowOk: shadowOk, postOk: postOk,
    /* 기기 보기 — `score`·`tierOfScore` 는 순수 함수다 */
    score: score, tierOfScore: tierOfScore, probe: probe, start: start,
    decide: decide, tick: tick, set: set, pin: pin, unpin: unpin, pinned: pinned, stats: stats,
    fps: function () { return fps; },
    reset: function () { idx = 0; lowFor = 0; highFor = 0; fps = 60; changes = 0; started = false; }
  };
})(window);
