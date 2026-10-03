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
  var SAVE_BASE = 'deungyong-go/save';
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
        pos: { x: 0, y: 0 },
        distance: 0,        // 누적 이동 거리 (m 환산)
        supplyMark: 0,      // 걷기 보급을 마지막으로 받은 거리
        supplyCount: 0,     // 보급 횟수 (짝수 번째마다 등용서)
        stationVisits: 0,   // 역참에 들른 누적 횟수 (기록용)
        trail: []           // 밟은 실제 위치 발자취 { lat, lng, kind, at } — 전체 지도(overworld.js, PLAN 25-1절)가 읽는다
      },
      items: { scroll: 3, feed: 5, treat: 2, incense: 1, prayer: 1 },
      boosts: {},                         // 쓴 물건의 효과가 언제까지인지 (bag.js)
      stations: {},                       // 역참 쉬는 시간 { 역참키: 마지막에 들른 시각 }
                                          // 다 쉰 항목은 station.js 가 물어볼 때 지운다
      forts: {},                          // 성채(=원작의 체육관) — fort.js
                                          //   { 성채키: { at, coll, day, dayGold } | { cool } }
      letters: {                          // 천거장(=원작의 알) — letter.js
        bag: [],                          //   받아만 둔 것 (최대 9)
        slots: [null, null, null],        //   행낭에 넣은 것 { g, startM } — 여기 있어야 거리를 센다
        opened: 0                         //   지금까지 연 수 (기록용)
      },
      dex: { heroes: {}, pets: {} },     // { id: {count, firstAt} }
      petGrow: {},                        // 펫 연성·승화 (growth.js) { petId: {lv, herb} }
                                          //   영초는 종별이라 여기, 단사는 공통이라 아래
      dust: 0,                            // 단사(丹砂) — 원작의 별사탕
      petGrowV: 0,                        // 옛 세이브 환산을 했는지 (growth.migrate)
      buddy: { id: null, mark: 0 },       // 반려(伴侶) — 원작의 버디 (buddy.js)
                                          //   mark 는 누적 거리 위의 기준점 (갈아타면 거기서 다시 센다)
      buddyLog: {},                       // { petId: {walked, fed, gained, since} }
                                          //   반려를 갈아도 남는 종별 기록 = 우애
      heroes: {},                         // { heroId: {lv, exp, rank, perks?, offer?} } 인물 개별 성장(perks·offer = perk.js)
      party: [],                          // 동행 heroId 최대 5 — 선두가 지도 위 아바타
      petEquip: {},                       // { heroId: petId }
      /* 확장(js/_expansion) 필드는 각 모듈이 스스로 만들고,
         옛 세이브의 값(gear·battle·dungeon 등)은 mergeDeep 이 보존한다.
         경영(territory·build)은 게임에서 뺐다 — 옛 세이브에 남아 있어도 아무도 읽지 않는다. */
      auto: {                             // 자동 순행 (auto.js) — 켠 상태도 기억한다
        on: false, meet: true, grow: true, omen: false
      },
      ai: {                               // 사관(AI) 사용 기록 · 길조 (ai.js)
        spent: 0, calls: 0, log: [], buff: null
      },
      settings: {
        tilt: 1,                           // 지도는 이제 밝은 지도(voyager) 한 종류뿐이다 — 스타일 버튼은 뺐다
        zoom3d: 4,                        // 3D 카메라 배율 (화면 값 · world.js)
        camZoom2d: 1,                     // 2D·2.5D 카메라 배율 (화면 값 · world.js)
        wide3in: false,                   // 3인치 모드 — 켜면 화면을 멀리서 본다
        mode: 'offline',                  // 'offline' | 'online' (net.js)
        aiBase: ''                        // 온라인 서버 주소 (빈 값 = 같은 출처)
      },
      log: [],
      tut: { done: [], d0: null }         // 첫 10분 안내(tutorial.js) — 새 세이브만 갖는다, 옛 세이브는 칸이 없어 끝난 것으로 본다
    };
  }

  var save = freshSave();

  /* ── 균형 손잡이(튜닝) ────────────────────────────────────
   * 규칙 상수를 밖에서 잡을 수 있게 하는 얇은 층이다. 어드민(`_admin.html`)이 쓴다.
   *
   * **세이브와 다른 칸에 산다.** 세이브에 섞으면 프로필마다 규칙이 달라지고,
   * 세이브를 넘길 때 규칙까지 따라간다. 규칙은 "이 기기의 사정"이지 진행이 아니다.
   *
   * **자가진단·데모는 읽지 않는다**(`DG_NO_TUNE`). 읽으면 손잡이를 잡아 둔 기기에서
   * 판정과 스크린샷이 흔들린다 — 씨앗을 고정한 것과 같은 이유다.
   * 그 자리에서도 `setTune()` 은 **메모리에만** 반영하고 저장하지 않는다.
   * (진단이 저장하면 실제 게임이 그 규칙으로 돌아 버린다)
   *
   * 값은 대부분 **모듈이 켜질 때 한 번** 읽는다 — 그래서 어드민에서 바꾸면
   * 게임 창을 새로고침해야 듣는다. 걸음 배속만 매번 읽어 곧바로 듣는다.
   */
  var TUNE_KEY = 'deungyong-go/tune';
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
    if (v === undefined || v === null) { return def; }
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
  var POKE_KEY = 'deungyong-go/admin/poke';

  /* 다른 창(어드민)에서 손잡이를 잡거나 세이브를 고치면 이 창도 안다.
     **어드민이 이긴다** — 게임 창이 들고 있던 것을 버리고 저장된 것을 다시 읽는다.
     (게임은 10초마다 persist 하므로, 안 그러면 어드민이 고친 값이 곧 덮인다) */
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

  /** 세이브 스키마 버전 — SAGA-DESIGN §8-3 "aa4b8b8 류 재발 방지".
   *  올릴 때는 SAVE_VERSION 을 올리고 `MIGRATIONS[옛버전]`에 손질 함수를 더한다
   *  (그 함수는 고친 뒤 `s.v`를 다음 버전으로 올려 돌려준다). **버전이 지금과
   *  정확히 같지 않다고 세이브를 통째로 버리지 않는다** — 예전엔 `parsed.v !== 1`
   *  이 하나라도 어긋나면 `load()`가 false 를 줘 그대로 새 세이브로 덮였다. */
  var SAVE_VERSION = 1;
  var MIGRATIONS = {};

  /** 순수 함수 — 옛 버전 세이브를 체인을 따라 최신까지 밀어 올린다.
   *  이을 손질이 없으면(사슬이 끊기면) 거기서 멈추고 있는 그대로 준다 —
   *  `mergeDeep(freshSave(), ...)` 가 남은 빈 자리를 채운다 */
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

  function expNeed(level) {
    return Math.round(50 * Math.pow(1.28, level - 1));
  }

  /* ── 효과 합산 ────────────────────────────────────────── */

  /**
   * 보정 효과를 합산한다. 이 게임에서 값을 내는 것은 **사관 길조(ai.bonus)뿐**이다.
   * 던전·장비는 yeoksa-dungeon 으로 갈라져 나갔고, 나머지 자리는 확장(js/_expansion)이
   * 붙을 때를 위해 남겨 둔다 — 없으면 건너뛴다.
   * @param {string} key 없으면 전체 객체 반환
   */
  function effect(key) {
    var total = {};
    /* 장비(item)·던전(dungeon)은 다섯 판으로 가를 때 saga-dungeon 으로 보냈다 —
       여기 남아 있던 참조는 늘 undefined 였다. 그 자리를 행낭(bag)이 쓴다. */
    var srcs = [
      global.DG.bag && global.DG.bag.bonus,
      global.DG.weather && global.DG.weather.bonus,
      global.DG.perk && global.DG.perk.bonus,           // 승급 특성 補 갈래(동행 중인 인물만)
      global.DG.bond && global.DG.bond.bonus,           // 인연 결(結) — 같은 세력·시대 둘이 파티면 필살 기 +10%
      global.DG.prestige && global.DG.prestige.bonus,   // 확장 보관분(_expansion)
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

  /** 좌표 기반 결정적 난수 (같은 좌표는 항상 같은 값 → 지도가 흔들리지 않는다) */
  function hash2(x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h >>> 0) / 4294967295;
  }

  function smooth01(t) { return t * t * (3 - 2 * t); }
  /** hash2 격자점을 부드럽게 이어 붙인 값 노이즈 — hash2 는 칸마다 완전히
   *  독립이라(소금·후추 노이즈) 지형 종류를 그걸로 직접 가르면 숲·산·마을이
   *  한 칸씩 흩어져 바둑판처럼 보인다(2026-09-08, 사용자 지적으로 발견).
   *  `scale` 은 무늬 한 칸의 폭(좌표 단위 — 이 판에서는 48m 격자 번호가
   *  그대로 들어온다) — 크면 넓게 뭉친다. `world.terrainAt` 이 쓴다. */
  function noise2(x, y, scale) {
    scale = scale || 8;
    var gx = x / scale, gy = y / scale;
    var x0 = Math.floor(gx), y0 = Math.floor(gy);
    var fx = smooth01(gx - x0), fy = smooth01(gy - y0);
    var n00 = hash2(x0, y0), n10 = hash2(x0 + 1, y0);
    var n01 = hash2(x0, y0 + 1), n11 = hash2(x0 + 1, y0 + 1);
    var nx0 = n00 + (n10 - n00) * fx, nx1 = n01 + (n11 - n01) * fx;
    return nx0 + (nx1 - nx0) * fy;
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

  global.DG = global.DG || {};
  global.DG.core = {
    SAVE_BASE: SAVE_BASE,
    get SAVE_KEY() { return SAVE_KEY; },
    setSaveKey: setSaveKey,
    get save() { return save; },
    load: load, persist: persist, reset: reset,
    SAVE_VERSION: SAVE_VERSION, MIGRATIONS: MIGRATIONS, migrate: migrate,
    on: on, emit: emit,
    TUNE_KEY: TUNE_KEY, POKE_KEY: POKE_KEY,
    tuned: tuned, tune: tuneAll, setTune: setTune, clearTune: clearTune,
    tuneCount: tuneCount,
    gainFeat: gainFeat, gainExp: gainExp, expNeed: expNeed,
    effect: effect,
    log: pushLog,
    hash2: hash2, noise2: noise2, pick: pick, clamp: clamp, fmt: fmt, fmtTime: fmtTime
  };
})(window);

/* 판별 계정 설정 — saga-web/shared/js/account.js 가 읽는다(이 판만 다른 것) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.account = {
    name: '사가고',
    emoji: '🗺️',
    tag: '역사 인물로 노는 위치기반 수집 게임',
    drawer: true   // 👤 단추를 도구 서랍(#tools-drawer) 안으로
  };
})(window);

/* 판별 SSAO 설정 — saga-web/shared/js/ssao3d.js 가 읽는다(이 판만 MEDIUM 등급에서도 켠다) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.ssao = { medium: { on: true, samples: 8, scale: 0.5 } };
})(window);

/* 판별 배경음 설정 — saga-web/shared/js/bgm.js 가 읽는다(이 판만 다른 것).
   곡 파일(assets/audio/bgm/)은 K-0004 가 만든다 — 아직 없어도 오류 없이 조용하다 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.bgm = {
    tracks: { field: 'saga-go-field.ogg', battle: 'saga-go-battle.ogg' },   // 마을이 따로 없는 걷기 판 — 들판과 교전
    vol: 0.35,
    first: 'field',
    poll: 1000,
    /** 지금 틀 트랙 — 들판 전투에 끌려들었으면 전투, 아니면 들판 */
    desired: function () {
      var fc = global.DG.fieldCombat;
      var S = fc && fc.state && fc.state();
      return S && fc.engaged(S) ? 'battle' : 'field';
    }
  };
})(window);

/* 판별 2D 모드 설정 — saga-web/shared/js/mode2d.js 가 읽는다(이 판만 다른 것).
   시트 풀(assets/sprites2d_sheets/)은 K-0015 가 만든다 — 없으면 기존 코드 스탬프 그대로, 오류 없음. 사람 풀 둘을 인물 id 해시로 나눠 쓴다 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.mode2d = {
    base: 'assets/sprites2d_sheets/',
    targetH: 40,                                 // 스탬프 s=1 일 때 몸 높이(px) — actor2d 가 s 를 배수로 곱한다
    foot: 0.87,
    tileBase: 'assets/web2d/tile/',
    /** 땅 종류(world.js terrainAt) → 2D 바닥 타일(K-0020 `go_*`) — 없는 종류는 옛 사진·색 */
    tile: { grass: 'go_grass', forest: 'go_dirt', mount: 'go_stone', road: 'go_sand', town: 'go_stone', farm: 'go_dirt', water: 'go_water' },
    /** 2D 모드인가 — 3D 장면이 안 서 있을 때(평면·2.5D 캔버스) */
    on: function () { var W3 = global.DG.world3d; return !(W3 && W3.active && W3.active()); },
    poolH: { pool_f_human_139: 91, pool_g_human_147: 89, pool_e_demon_128: 86, pool_e_undead_127: 79 },   // 프레임 안 몸 높이(px, pw-sheet-bbox.mjs 로 잼)
    pools: { human: ['pool_f_human_139', 'pool_g_human_147'] }
  };
})(window);

/* 옷 무늬 설정 — saga-web/shared/js/vroid-variant.js 가 읽는다(W-0020). 무늬 64종(webp + patterns.json)은 자체툴이 assets/patterns/ 에 놓는다 —
   없으면 기존 옷 그대로(표를 못 받으면 아무 것도 안 한다) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.assets3d = {
    /* 통일 3D 에셋(W-0021, shared/assets/world3d) — prop3d 소품 이름 → 그 판 9칸 id. 마을은 과거·현대·미래 한 자리라 집·등롱을 시대 섞어 쓴다 */
    prop: { house: ['eu_house_01', 'modern_block_01', 'future_dome_01'], lamp: ['street_lamp_01', 'signal_pylon_01'], well: ['well_01'] }
  };
  global.DG.cfg.vroidPattern = { base: 'assets/patterns/', repeat: 3 };
})(window);
