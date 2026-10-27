/**
 * 천후(天候) — 원작의 날씨 부스트
 * ---------------------------------------------------------------
 * 원작에서 날씨는 "오늘은 무엇이 잘 나오는가"를 정한다. 비가 오면 물 타입이 몰리고
 * 안개가 끼면 고스트가 나온다. 그날 나가는 이유가 날씨에서 생긴다.
 *
 * 이 판은 오프라인으로도 돌아야 해서 실제 기상 정보를 받지 않는다. 대신
 * **세 시간마다 바뀌는 결정론적 천후**를 둔다 — 같은 시각이면 어느 기기에서나 같다.
 * (실제 날씨를 쓰려면 net.js 에 통로를 하나 내면 되지만, 서버가 없어도 게임은
 *  그대로 돌아야 한다는 이 판의 규칙이 먼저다)
 *
 * 효과는 새 통로를 만들지 않는다 — `core.effect()` 가 이미 읽는 키로 낸다.
 * 무엇이 더 나오는지(인물/짐승·기질·신수)만 world.js 가 물어본다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 천후가 바뀌는 주기 */
  var SPAN_MS = 3 * 60 * 60 * 1000;

  /**
   * 천후 표.
   *   eff        core.effect 로 나가는 보정
   *   heroBias   인물이 나올 확률에 더한다 (기본 0.42)
   *   trait      그 기질의 인물이 더 자주 온다
   *   divine     신수가 나올 확률에 더한다
   */
  var KINDS = [
    { key: 'clear', name: '맑음', emoji: '☀️',
      text: '볕이 좋아 사람들이 길에 나섰다.',
      eff: { expPct: 10 }, heroBias: 0.10, trait: 'might' },
    { key: 'cloud', name: '흐림', emoji: '☁️',
      text: '구름이 낮게 깔려 글 읽기 좋은 날이다.',
      eff: { expPct: 5 }, heroBias: 0.06, trait: 'wisdom' },
    { key: 'rain', name: '비', emoji: '🌧️',
      text: '비가 내려 짐승들이 물가로 모인다.',
      eff: { catchPct: 8 }, heroBias: -0.16 },
    { key: 'wind', name: '바람', emoji: '🌬️',
      text: '바람이 세다. 멀리서 온 이들이 눈에 띈다.',
      eff: { spawnRarePct: 8 }, heroBias: 0.14 },
    { key: 'fog', name: '안개', emoji: '🌫️',
      text: '안개가 짙다. 예사롭지 않은 것이 어른거린다.',
      eff: { divinePct: 12 }, heroBias: -0.06, divine: 0.14 },
    { key: 'snow', name: '눈', emoji: '❄️',
      text: '눈이 쌓여 길에 인적이 드물다 — 대신 귀한 것이 온다.',
      eff: { spawnRarePct: 16 }, heroBias: 0, fewer: true }
  ];

  function kindOf(key) {
    for (var i = 0; i < KINDS.length; i++) { if (KINDS[i].key === key) { return KINDS[i]; } }
    return KINDS[0];
  }

  /* 이 판의 core.hash2 는 0~0.5 만 돌려준다(world.js 주석 참고) — 두 배로 편다 */
  function h01(a, b) { return Math.min(0.999999, core.hash2(a, b) * 2); }

  /**
   * 이 시각의 천후 — 세 시간마다 바뀌고, 같은 시각이면 늘 같다.
   *
   * **계절이 기울인다**(`season.js`, PLAN 37절) — 여름에 비가 잦고 겨울에 눈이 온다.
   * 계절이 없거나 꺼져 있으면 여섯을 고르게 뽑던 예전과 한 글자도 다르지 않다.
   * 이 판의 천후는 무엇이 잘 나오는지를 정하므로 **여기만 판정에 닿는다** —
   * 그래서 `season.weather` 손잡이 하나로 이 갈래만 따로 끌 수 있게 두었다.
   */
  function at(ms) {
    var slot = Math.floor((ms === undefined ? Date.now() : ms) / SPAN_MS);
    var h = h01(slot * 7919 + 13, slot * 104729 + 29);
    var S = global.DG.season;
    if (!S || !S.weatherOn()) {
      return KINDS[Math.min(KINDS.length - 1, Math.floor(h * KINDS.length))];
    }
    /* 가중치대로 뽑는다. 뽑는 주사위(h)는 그대로라 **같은 시각이면 여전히 같다** */
    var w = [], sum = 0, i;
    for (i = 0; i < KINDS.length; i++) {
      var v = Math.max(0, S.weatherWeight(KINDS[i].key, ms));
      w.push(v); sum += v;
    }
    if (sum <= 0) { return KINDS[0]; }
    var x = h * sum;
    for (i = 0; i < KINDS.length; i++) {
      x -= w[i];
      if (x <= 0) { return KINDS[i]; }
    }
    return KINDS[KINDS.length - 1];
  }

  /* 진단·데모가 천후를 하나로 붙들어 둘 때 쓰는 문. 게임에서는 늘 null 이다.
     (밖에서 `DG.weather.current` 를 갈아 끼워도 이 파일 안의 호출은 안 바뀐다 —
      그래서 공식 통로를 하나 둔다) */
  var forced = null;

  function current() { return forced || at(); }

  function force(key) { forced = key ? kindOf(key) : null; return current(); }

  /** 다음 천후로 바뀌기까지 */
  function leftMs() {
    var now = Date.now();
    return SPAN_MS - (now % SPAN_MS);
  }

  /** 다음에 올 천후 (화면이 미리 알려 준다) */
  function next() { return at(Date.now() + SPAN_MS); }

  /** core.effect() 가 읽어 간다 */
  function bonus() {
    var w = current();
    var out = {}, k;
    for (k in w.eff) {
      if (Object.prototype.hasOwnProperty.call(w.eff, k)) { out[k] = w.eff[k]; }
    }
    return out;
  }

  /** 인물이 나올 확률 (world.js 가 기본값에 더해 쓴다) */
  function heroBias() { return current().heroBias || 0; }

  /** 이 기질이면 더 자주 온다 (없으면 null) */
  function favorTrait() { return current().trait || null; }

  /** 신수가 나올 확률에 더한다 */
  function divineBias() { return current().divine || 0; }

  /** W-0475 날씨 부스트 — 그 날씨에 맞는 원소의 명단 공격 ×1.2(고돗 G-0408 표. 웹 원소엔 암이 없어 흐림=바위·안개=바람). 손잡이 weather.boost 0 이면 끔, 진단이 boostHold 를 걸면 boostWhenForced 가 참일 때만 */
  var BOOST = { clear: ['fire', 'grass'], cloud: ['rock'], rain: ['water', 'elec'], wind: ['wind'], fog: ['wind'], snow: ['ice'] };
  var BOOST_ICON = { fire: '🔥', water: '💧', elec: '⚡', wind: '🌪️', ice: '❄️', rock: '🪨', grass: '🌿' };
  function boostOf(key) { return BOOST[key] || []; }
  function boostOn() { return !(core.tuned && +core.tuned('weather.boost', 1) === 0) && (!global.DG.weather.boostHold || !!global.DG.weather.boostWhenForced); }   // 진단이 boostHold 로 기본 끔 — 시각 의존 축(PLAN §9), 부스트를 재는 진단만 boostWhenForced 로 켠다
  function boostMul(el) { return boostOn() && el && boostOf(current().key).indexOf(el) >= 0 ? 1.2 : 1; }
  function boostIcons() { return boostOn() ? boostOf(current().key).map(function (e) { return BOOST_ICON[e]; }).join('') : ''; }

  /** 눈처럼 인적이 드문 날이면 대상 수가 준다 */
  function fewer() { return !!current().fewer; }

  global.DG = global.DG || {};
  global.DG.weather = {
    KINDS: KINDS, SPAN_MS: SPAN_MS,
    kindOf: kindOf, at: at, current: current, next: next, leftMs: leftMs,
    force: force,
    get forced() { return forced; },
    bonus: bonus,
    heroBias: heroBias, favorTrait: favorTrait, divineBias: divineBias, fewer: fewer,
    BOOST: BOOST, boostOf: boostOf, boostMul: boostMul, boostIcons: boostIcons
  };
})(window);
