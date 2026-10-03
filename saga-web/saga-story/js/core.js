/**
 * 코어 — 상태 / 저장 / 이벤트 버스 / 공용 계산
 * ---------------------------------------------------------------
 * 여기서 중요한 건 "공적(feat) 이벤트 버스"다.
 * 게임 행동이든 업무 이벤트든 전부 DG.core.gainFeat() 한 곳으로 들어온다.
 * 나중에 업무 연동을 붙일 때는 어댑터가 이 함수만 호출하면 되고,
 * 다른 코드는 손대지 않는다.
 */
(function (global) {
  'use strict';

  /* 세이브가 사는 곳. 뒤에 **프로필 id** 가 붙는다 — account.js 가 정해 준다.
   가입 개념이 없던 시절의 세이브는 '<base>/v1' 이고, 첫 가입 때 이어받는다. */
  var SAVE_BASE = 'yeoksa-side/save';
  var SAVE_KEY = SAVE_BASE + '/v1';

  /** 프로필이 정해지면 그 키로 갈아탄다 (반드시 load() 전에) */
  function setSaveKey(k) {
    if (k) { SAVE_KEY = k; }
    return SAVE_KEY;
  }

  /** 기본 세이브 */
  function freshSave() {
    return {
      v: 1,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      player: {
        title: '무명(無名)',
        level: 1,
        exp: 0,
        gold: 120,
        fame: 30,
        feat: 0,            // 공적 — 칭호의 연료
        featTotal: 0,       // 누적 공적 (칭호 계산용)
        memFrag: 0,         // 기억 조각(PLAN §5-3 메타 재화) — 관문 대장·비경이 준다
        memUp: {},          // 조각으로 산 영구 강화 단 { hp: 0~10 } (rift.js)
        memOpen: {},        // 조각으로 풀어 둔 축복 { 축복key: true } (rift.js)
        pos: { x: 0, y: 0 },
        distance: 0,        // 누적 이동 거리 (m 환산)
        supplyMark: 0,      // 걷기 보급을 마지막으로 받은 거리
        supplyCount: 0      // 보급 횟수 (짝수 번째마다 등용서)
      },
      rift: null,                         // 진행 중인 비경(rift.js) — 없으면 null
      riftStat: { runs: 0, clears: 0, best: 0 },
      items: { scroll: 3, feed: 5 },
      dex: { heroes: {}, pets: {} },     // { id: {count, firstAt} }
      heroes: {},                         // { heroId: {lv, exp, rank} } 인물 개별 성장
      party: [],                          // 동행 heroId 최대 5 — 선두가 지도 위 아바타
      petEquip: {},                       // { heroId: petId }
      /* 확장(js/_expansion) 필드는 각 모듈이 스스로 만들고,
         옛 세이브의 값(gear·battle·dungeon 등)은 mergeDeep 이 보존한다.
         경영(territory·build)은 게임에서 뺐다 — 옛 세이브에 남아 있어도 아무도 읽지 않는다. */
      auto: {                             // 자동 사냥 (auto.js) — 켠 상태도 기억한다
        on: false, hunt: true, potion: true, retry: true, review: true
      },
      ai: {                               // 사관(AI) 사용 기록 · 길조 (ai.js)
        spent: 0, calls: 0, log: [], buff: null
      },
      settings: {
        mapStyle: 0, tilt: 1,
        mode: 'offline',                  // 'offline' | 'online' (net.js)
        aiBase: ''                        // 온라인 서버 주소 (빈 값 = 같은 출처)
      },
      log: []
    };
  }

  var save = freshSave();

  /* ── 균형 손잡이(튜닝) ────────────────────────────────────
   * 규칙 상수를 밖에서 잡을 수 있게 하는 얇은 층이다. 어드민(`_admin.html`)이 쓴다.
   * 사가고(`saga-go`)·사가의숲(`saga-forest`)에 먼저 둔 것을 **같은 이름으로** 옮겼다.
   *
   * **세이브와 다른 칸에 산다.** 세이브에 섞으면 프로필마다 규칙이 달라지고,
   * 세이브를 넘길 때 규칙까지 따라간다. 규칙은 "이 기기의 사정" 이지 진행이 아니다.
   *
   * **자가진단·데모는 읽지 않는다**(`DG_NO_TUNE`). 읽으면 손잡이를 잡아 둔 기기에서
   * 판정과 스크린샷이 흔들린다 — 씨앗을 고정한 것과 같은 이유다.
   * 그 자리에서도 `setTune()` 은 메모리에만 반영하고 저장하지 않는다.
   *
   * 이 판에서 가장 값진 손잡이는 **물리(중력·점프·달리기)** 다.
   * 사이드스크롤은 손맛이 곧 게임이라, 수를 바꾸고 곧바로 뛰어 보는 것이 검증이다.
   */
  var TUNE_KEY = 'yeoksa-side/tune';
  var tuneCache = null;

  function tuneAll() {
    if (tuneCache) { return tuneCache; }
    tuneCache = {};
    if (global.DG_NO_TUNE) { return tuneCache; }
    try {
      var raw = localStorage.getItem(TUNE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') { tuneCache = o; }
      }
    } catch (e) { /* 깨져 있으면 기본값으로 돈다 */ }
    return tuneCache;
  }

  /** 손잡이가 잡혀 있으면 그 값, 아니면 코드의 기본값 */
  function tuned(key, def) {
    var v = tuneAll()[key];
    if (v === undefined || v === null || v === '') { return def; }
    if (typeof def === 'number') {
      var n = Number(v);
      return isFinite(n) ? n : def;
    }
    return v;
  }

  /** 하나 또는 여러 개를 잡는다. 값이 null 이면 그 손잡이를 놓는다 */
  function setTune(k, v) {
    var t = tuneAll(), o = {}, key;
    if (k && typeof k === 'object') { o = k; } else { o[k] = v; }
    for (key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) { continue; }
      if (o[key] === null || o[key] === undefined || o[key] === '') { delete t[key]; }
      else { t[key] = o[key]; }
    }
    saveTune();
    return t;
  }

  function clearTune() {
    tuneCache = {};
    saveTune();
  }

  function saveTune() {
    emit('tune', tuneCache);
    if (global.DG_NO_TUNE) { return; }          // 진단·데모는 남기지 않는다
    try {
      if (tuneCount()) { localStorage.setItem(TUNE_KEY, JSON.stringify(tuneCache)); }
      else { localStorage.removeItem(TUNE_KEY); }
    } catch (e) { /* 저장 못 해도 이번 판은 돈다 */ }
  }

  function tuneCount() {
    var t = tuneAll(), n = 0, k;
    for (k in t) { if (Object.prototype.hasOwnProperty.call(t, k)) { n++; } }
    return n;
  }

  /** 어드민이 세이브를 고친 뒤 두드리는 자리 — 게임 창이 그걸 보고 다시 읽는다 */
  var POKE_KEY = 'yeoksa-side/admin/poke';

  /* 다른 창(어드민)에서 손잡이를 잡거나 세이브를 고치면 이 창도 안다.
     **어드민이 이긴다** — 게임 창이 들고 있던 것을 버리고 저장된 것을 다시 읽는다.
     (게임은 틈틈이 persist 하므로, 안 그러면 어드민이 고친 값이 곧 덮인다) */
  global.addEventListener('storage', function (e) {
    if (e.key === TUNE_KEY) {
      tuneCache = null;
      emit('tune', tuneAll());
      emit('changed');
      return;
    }
    if (e.key === POKE_KEY) {
      load();
      emit('toast', '🎛️ 어드민이 세이브를 고쳤습니다 — 다시 읽었습니다');
      emit('changed');
    }
  });


  /* ── 저장 / 불러오기 ──────────────────────────────────── */

  /** 세이브 스키마 버전 — SAGA-DESIGN §8-3 "aa4b8b8 류 재발 방지"(사가고에서
   *  먼저 잡고 다섯 판 공통 지뢰라 여기도 옮긴다). 올릴 때는 SAVE_VERSION 을
   *  올리고 `MIGRATIONS[옛버전]`에 손질 함수를 더한다(고친 뒤 `s.v`를 다음
   *  버전으로 올려 돌려준다). **버전이 지금과 정확히 같지 않다고 세이브를
   *  통째로 버리지 않는다** — 예전엔 `parsed.v !== 1` 하나만 어긋나도 `load()`가
   *  false 를 줘 그대로 새 세이브로 덮였다. */
  var SAVE_VERSION = 1;
  var MIGRATIONS = {};

  /** 순수 함수 — 옛 버전 세이브를 체인을 따라 최신까지 밀어 올린다.
   *  이을 손질이 없으면(사슬이 끊기면) 거기서 멈추고 있는 그대로 준다 */
  function migrate(parsed) {
    var s = parsed, guard = 0;
    while (s && typeof s.v === 'number' && s.v < SAVE_VERSION && MIGRATIONS[s.v] && guard++ < 20) {
      s = MIGRATIONS[s.v](s);
    }
    return s;
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { return false; }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.v !== 'number') { return false; }
      parsed = migrate(parsed);
      // 누락 필드 보정 — 버전이 맞든 안 맞든 `freshSave()` 위에 덧씌워 빈 자리를 채운다
      var base = freshSave();
      save = mergeDeep(base, parsed);
      return true;
    } catch (e) {
      console.warn('세이브 불러오기 실패, 새로 시작합니다.', e);
      return false;
    }
  }

  function persist() {
    try {
      save.lastSeen = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      console.warn('저장 실패', e);
    }
  }

  function reset() {
    save = freshSave();
    persist();
  }

  function mergeDeep(base, over) {
    var out = {}, k;
    for (k in base) {
      if (!Object.prototype.hasOwnProperty.call(base, k)) { continue; }
      if (isPlain(base[k]) && isPlain(over && over[k])) {
        out[k] = mergeDeep(base[k], over[k]);
      } else if (over && Object.prototype.hasOwnProperty.call(over, k) && over[k] !== undefined) {
        out[k] = over[k];
      } else {
        out[k] = base[k];
      }
    }
    // base 에 없고 over 에만 있는 키(도감 항목 등)도 살린다
    for (k in over) {
      if (Object.prototype.hasOwnProperty.call(over, k) && !(k in out)) { out[k] = over[k]; }
    }
    return out;
  }

  function isPlain(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /* ── 이벤트 버스 ──────────────────────────────────────── */

  var listeners = {};

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  }

  function emit(evt, payload) {
    var fns = listeners[evt];
    if (!fns) { return; }
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](payload); } catch (e) { console.error('[' + evt + ']', e); }
    }
  }

  /* ── 공적(功績) ───────────────────────────────────────── */

  /**
   * 공적 획득 — 모든 성취가 이 한 곳으로 모인다.
   * @param {number} amount 공적량
   * @param {string} source 출처 라벨 ('등용', '포획', '답파', 나중엔 'Jira 종결' 등)
   */
  function gainFeat(amount, source) {
    amount = Math.max(0, Math.round(amount));
    if (!amount) { return; }
    save.player.feat += amount;
    save.player.featTotal += amount;
    emit('feat', { amount: amount, source: source });
    pushLog('공적 +' + amount + ' (' + source + ')', 'feat');
  }

  function gainExp(amount) {
    var mul = 1 + effect('expPct') / 100;
    amount = Math.round(amount * mul);
    save.player.exp += amount;
    var need = expNeed(save.player.level);
    while (save.player.exp >= need) {
      save.player.exp -= need;
      save.player.level += 1;
      pushLog('레벨 업! Lv.' + save.player.level, 'level');
      emit('levelup', save.player.level);
      need = expNeed(save.player.level);
    }
    return amount;
  }

  /* 경험치 곡선(2026-09-23, 사가스토리 사본만) — Lv.25 까지는 예전 그대로 1.28배씩,
     그 뒤로는 1.04배씩만 는다. 1.28배를 끝까지 두면 Lv.25→45 가 호로곡 정예 8.4만 마리,
     Lv.70 은 누적 44억이라 3·4차 전직(Lv.45·70)과 다섯째·여섯째 사냥터에 아무도 못 닿았다.
     처치 경험치는 적 수준에 1차로만 느는데(6+lv*4) 곡선은 지수라 벌어지기만 했다. */
  var EXP_KNEE = 25, EXP_LATE = 1.04;
  function expNeed(level) {
    if (level <= EXP_KNEE) { return Math.round(50 * Math.pow(1.28, level - 1)); }
    return Math.round(50 * Math.pow(1.28, EXP_KNEE - 1) * Math.pow(EXP_LATE, level - EXP_KNEE));
  }

  /* ── 효과 합산 ────────────────────────────────────────── */

  /**
   * 보정 효과를 합산한다. 지금 본편에서 값을 내는 것은 사관 길조(ai.bonus)뿐이고,
   * 나머지는 확장 모듈(js/_expansion)이 붙을 때를 위한 자리다 — 없으면 건너뛴다.
   * @param {string} key 없으면 전체 객체 반환
   */
  function effect(key) {
    var total = {};
    var srcs = [
      global.DG.item && global.DG.item.partyEffect,
      global.DG.dungeon && global.DG.dungeon.boonEffect,
      global.DG.prestige && global.DG.prestige.bonus,
      global.DG.idle && global.DG.idle.bonus,
      global.DG.ai && global.DG.ai.bonus
    ];
    for (var si = 0; si < srcs.length; si++) {
      if (!srcs[si]) { continue; }
      var add = srcs[si](), ak;
      for (ak in add) {
        if (Object.prototype.hasOwnProperty.call(add, ak)) {
          total[ak] = (total[ak] || 0) + add[ak];
        }
      }
    }
    if (key === undefined) { return total; }
    return total[key] || 0;
  }

  /* ── 로그 ─────────────────────────────────────────────── */

  function pushLog(text, kind) {
    save.log.unshift({ t: Date.now(), text: text, kind: kind || 'info' });
    if (save.log.length > 120) { save.log.length = 120; }
    emit('log', save.log[0]);
  }

  /* ── 유틸 ─────────────────────────────────────────────── */

  /** 좌표 기반 결정적 난수 (같은 좌표는 항상 같은 값 → 지형이 흔들리지 않는다)
   *
   * 마지막 xor 는 반드시 **부호 없는** 시프트(>>>)로 해야 한다. 부호 있는 >> 를 쓰면
   * 최상위 비트가 자기 자신과 xor 되어 늘 0 이 되고, 그래서 이 함수가 **0~0.5 만**
   * 돌려준다(0.9 같은 값이 절대 나오지 않는다). 지형 문턱값을 0.9 로 잡았더니 사물이
   * 하나도 안 생겨서 찾아낸 결함이다.
   *
   * 참고: 지도를 걷는 게임(deungyong-go)의 core.js 에는 아직 옛 식이 남아 있다.
   * 그쪽 지형 문턱값이 0~0.5 범위에 맞춰 손으로 맞춰져 있어서, 고치려면 지형을
   * 다시 눈으로 보며 조율해야 한다 — 네 프로젝트는 별개이므로 여기만 고쳐 둔다.
   */
  function hash2(x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e8) { return (n / 1e8).toFixed(2) + '억'; }
    if (n >= 1e4) { return (n / 1e4).toFixed(1) + '만'; }
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) { return sec + '초'; }
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) { return m + '분 ' + s + '초'; }
    var h = Math.floor(m / 60);
    return h + '시간 ' + (m % 60) + '분';
  }

  /* ── 손가락뿐인 기기인가 ──────────────────────────────────
   * 폰에는 Space 도 ↑ 도 없다. 그런데 안내는 그것을 누르라고 했다.
   * 사가의숲에 먼저 둔 것을 **같은 이름으로** 옮겼다.
   * **키보드가 있는 기기는 예전 문구 그대로다** — 그래서 자가진단 출력도 안 바뀐다
   * (헤드리스는 hover 가 있는 기기로 잡히므로 늘 키보드 쪽으로 떨어진다).
   */
  var TOUCH = null;

  function touchOnly() {
    if (TOUCH === null) {
      try {
        TOUCH = !!(global.matchMedia &&
                   global.matchMedia('(hover: none) and (pointer: coarse)').matches);
      } catch (e) { TOUCH = false; }
    }
    return TOUCH;
  }

  /** 누르라고 안내할 것 — 손가락이면 화면의 그 자리를, 아니면 키를 */
  function actHint() { return touchOnly() ? '✋' : 'Space'; }
  function upHint() { return touchOnly() ? '화면 위쪽' : '↑'; }
  function downHint() { return touchOnly() ? '화면 아래 가운데' : '↓'; }

  global.DG = global.DG || {};
  global.DG.core = {
    SAVE_BASE: SAVE_BASE,
    get SAVE_KEY() { return SAVE_KEY; },
    setSaveKey: setSaveKey,
    get save() { return save; },
    load: load, persist: persist, reset: reset,
    SAVE_VERSION: SAVE_VERSION, MIGRATIONS: MIGRATIONS, migrate: migrate,
    on: on, emit: emit,
    gainFeat: gainFeat, gainExp: gainExp, expNeed: expNeed,
    effect: effect,
    log: pushLog,
    TUNE_KEY: TUNE_KEY, POKE_KEY: POKE_KEY,
    tuned: tuned, tune: tuneAll, setTune: setTune, clearTune: clearTune,
    hash2: hash2, pick: pick, clamp: clamp, fmt: fmt, fmtTime: fmtTime,
    touchOnly: touchOnly, actHint: actHint, upHint: upHint, downHint: downHint
  };
})(window);

/* 판별 계정 설정 — saga-web/shared/js/account.js 가 읽는다(이 판만 다른 것) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.account = {
    name: '사가스토리',
    emoji: '🏃',
    tag: '역사 인물로 노는 옆으로 걷는 액션',
    settings: true   // 타이틀에 ⚙️ 설정 단추(ui 설정 시트를 곧장 연다)
  };
})(window);

/* 판별 배경음 설정 — saga-web/shared/js/bgm.js 가 읽는다(이 판만 다른 것) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.bgm = {
    tracks: { town: 'saga-story-town.ogg', forest: 'saga-story-field.ogg', battle: 'saga-story-battle.ogg' },   // 자체 곡(W-0020 2부) — 옛 OpenGameArt mp3 는 폴더에 그대로(되돌림: 이 줄을 town.mp3·forest.mp3·battle.mp3 로)
    vol: 0.4,
    first: 'town',
    /** 지금 틀 트랙 — 사냥 중이 아니면 마을, 보스면 전투, 마을 사냥터면 마을, 아니면 숲 */
    desired: function () {
      var side = global.DG.side;
      if (!side) { return 'town'; }
      var st = side.status();
      if (!st.active) { return 'town'; }
      if (st.boss) { return 'battle'; }
      if (st.stage && st.stage.town) { return 'town'; }
      return 'forest';
    }
  };
})(window);

/* 판별 후처리 설정 — saga-web/shared/js/post3d.js 가 읽는다(이 판만 MEDIUM 등급을 LOW 쪽으로 낮춘다) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  /* 사가블로가 폰 실기기 재신고로 맞춘 값을 그대로 물려받는다 — AUTO 등급이 MEDIUM 으로 오갈 때 렌더 타깃 재생성으로 프레임이 멎는 것을
     막으려 MEDIUM 의 몫을 LOW 에 가깝게 낮춘다. */
  global.DG.cfg.post = { medium: { post: 1, mips: 2, msaa: 0, scale: 0.65 } };
})(window);

/* 판별 2D 모드 설정 — saga-web/shared/js/mode2d.js 가 읽는다(이 판만 다른 것).
   시트 풀(assets/sprites2d_sheets/)은 K-0015 가 만든다 — 없으면 기존 코드 스탬프 그대로, 오류 없음. 적 단계(tier 1~4)마다 풀을 나눠 쓴다 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.mode2d = {
    base: 'assets/sprites2d_sheets/',
    bgBase: 'assets/web2d/bg/', tileBase: 'assets/web2d/tile/',
    /** 사냥터 key → 배경 지역(K-0020·K-0055 `story_*`)·바닥 타일 — 없는 key 는 기존 하늘·바닥색 */
    region: { sinya: 'story_field_meadow', heodo: 'story_field_meadow', field: 'story_field_meadow', gangneungjin: 'story_field_meadow', forest: 'story_forest',
      namjeongseong: 'story_mountain_shrine', gisanchae: 'story_mountain_shrine',
      cave: 'story_cave_mouth', deepcave: 'story_deep_cave', gorge: 'story_fire_gorge', ruin: 'story_old_battlefield',
      beyond_past: 'story_old_battlefield', beyond_now: 'story_ruined_city', beyond_future: 'story_orbital_base' },
    tile: { sky: 'story_grass', forest: 'story_dirt', cave: 'story_stone', fire: 'story_stone' },
    targetH: 62,                                 // 화면에 보일 보통 적 몸 높이(px) — 코드 스탬프 s 0.8 과 비슷하게
    foot: 0.87,                                  // 시트에서 발 위치(프레임 높이 비율)
    poolH: { pool_e_goblin_126: 50, pool_g_orc_141: 102, pool_basef_undead_111: 85, pool_f_demon_136: 97 },   // 프레임 안 몸 높이(px, 옆모습 알파 범위로 잼)
    /** 2D 모드인가 — 3D 바탕이 안 서 있을 때(= 2D 그림) */
    on: function () { var V = global.DG.sideView3d; return !(V && V.ready && V.ready()); },
    pools: {
      t1: ['pool_e_goblin_126'],
      t2: ['pool_g_orc_141', 'pool_e_goblin_126'],
      t3: ['pool_basef_undead_111', 'pool_g_orc_141'],
      t4: ['pool_f_demon_136', 'pool_basef_undead_111']
    }
  };
})(window);

/* 옷 무늬 설정 — saga-web/shared/js/vroid-variant.js 가 읽는다(W-0020). 무늬 64종(webp + patterns.json)은 자체툴이 assets/patterns/ 에 놓는다 —
   없으면 기존 옷 그대로(표를 못 받으면 아무 것도 안 한다) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.assets3d = {
    /* 통일 3D 에셋(W-0021, shared/assets/world3d) — asset3d 키 → 그 판 9칸 id. 있는 자리만: 집(한옥·민가·현대 — 과거·현대 한 자리) */
    reg: { 'house': ['hanok_01', 'jp_minka_01', 'modern_block_01'] }
  };
  global.DG.cfg.vroidPattern = { base: 'assets/patterns/', repeat: 3 };
})(window);
