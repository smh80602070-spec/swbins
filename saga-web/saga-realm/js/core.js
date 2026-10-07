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
  var SAVE_BASE = 'saga-realm/save';
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
        supplyCount: 0      // 보급 횟수 (짝수 번째마다 등용서)
      },
      items: { scroll: 3, feed: 5 },
      dex: { heroes: {}, pets: {} },     // { id: {count, firstAt} }
      heroes: {},                         // { heroId: {lv, exp, rank} } 인물 개별 성장
      party: [],                          // 동행 heroId 최대 5 — 선두가 지도 위 아바타
      petEquip: {},                       // { heroId: petId }
      quiz: {                             // 문답 (quiz.js) — 이제는 학당, 곁가지다
        learned: {}, wrongs: {}, total: 0, correct: 0, streak: 0, bestStreak: 0
      },
      /* 삼국지 판. rtk.js 가 스스로 채운다 — 여기서는 자리만 만든다.
         옛 세이브의 강역(territory)·건설(build)·자동(auto)은 2026-08-26 에
         걷어냈다. mergeDeep 이 남은 값을 지우지는 않으니 진행은 안 사라진다. */
      rtk: null,
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
   * 사가만리·사가마을·사가종횡·사가나락에 먼저 둔 것을 **같은 이름으로** 옮겼다.
   * 이 판에는 여태 없었다.
   *
   * **세이브와 다른 칸에 산다.** 세이브에 섞으면 프로필마다 규칙이 달라지고,
   * 세이브를 넘길 때 규칙까지 따라간다. 규칙은 "이 기기의 사정" 이지 진행이 아니다.
   *
   * **자가진단·데모는 읽지 않는다**(`DG_NO_TUNE`). 읽으면 손잡이를 잡아 둔 기기에서
   * 판정과 스크린샷이 흔들린다 — 씨앗을 고정한 것과 같은 이유다.
   *
   * 이 판은 **턴제**라 대부분의 손잡이(`rtk.*`)는 모듈이 뜰 때 상수를 한 번만
   * 읽는다 — 어드민에서 바꾼 뒤 게임 창을 새로고침해야 듣는다.
   */
  var TUNE_KEY = 'saga-realm/tune';
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
  var POKE_KEY = 'saga-realm/admin/poke';

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

  /** 세이브 스키마 버전 — SAGA-DESIGN §8-3 "aa4b8b8 류 재발 방지"(사가만리에서
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

  /** `changed` 묶기(W-0026) — 한 달을 넘기면 `changed` 가 ~60번 나가 매번 지도(성 135곳 SVG)를 다시 그렸다.
   *  batch 안에서는 `changed` 를 모았다가 끝에 한 번만 보낸다. 다른 이벤트는 그대로 바로 나간다 */
  var batchDepth = 0, batchedChanged = false;
  function batch(fn) {
    batchDepth++;
    try { return fn(); } finally { if (--batchDepth === 0 && batchedChanged) { batchedChanged = false; emit('changed'); } }
  }

  function emit(evt, payload) {
    if (evt === 'changed' && batchDepth) { batchedChanged = true; return; }
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
   * 보정 효과를 합산한다.
   *
   * 삼국지로 갈아엎으면서 **구역 특산·건물** 소스는 걷어냈다(2026-08-26).
   * 그 자리는 이제 성(城)의 농업·상업·기술이 맡고, 그 셈은 rtk.js 안에서 끝난다 —
   * 도시마다 값이 다르니 "게임 전체에 붙는 하나의 보정" 이라는 통로에 얹을 수가 없다.
   * 남은 소스는 사관 길조뿐이고, 자리는 확장이 붙을 때를 위해 남겨 둔다.
   * @param {string} key 없으면 전체 객체 반환
   */
  function effect(key) {
    var total = {};
    var srcs = [
      global.DG.ai && global.DG.ai.bonus                  // 사관 길조
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

  global.DG = global.DG || {};
  global.DG.core = {
    SAVE_BASE: SAVE_BASE,
    get SAVE_KEY() { return SAVE_KEY; },
    setSaveKey: setSaveKey,
    get save() { return save; },
    load: load, persist: persist, reset: reset,
    SAVE_VERSION: SAVE_VERSION, MIGRATIONS: MIGRATIONS, migrate: migrate,
    on: on, emit: emit, batch: batch,
    gainFeat: gainFeat, gainExp: gainExp, expNeed: expNeed,
    effect: effect,
    log: pushLog,
    TUNE_KEY: TUNE_KEY, POKE_KEY: POKE_KEY,
    tuned: tuned, tune: tuneAll, setTune: setTune, clearTune: clearTune,
    hash2: hash2, pick: pick, clamp: clamp, fmt: fmt, fmtTime: fmtTime
  };
})(window);

/* 판별 계정 설정 — saga-web/shared/js/account.js 가 읽는다(이 판만 다른 것) */
(function (global) {
  'use strict';
  /* 이 판의 진행 한 조각 — 플레이어 레벨은 이 판에서 안 오른다(경험치는 무장만 받는다,
     2026-09-23 점검). 그래서 늘 "Lv.1" 이던 자리를 지금 몇 년 몇 월·가진 성 수로 바꾼다.
     (account.js 가 `DG.account.realmBit` 로도 내준다 — ai.js 가 쓴다) */
  function realmBit(s) {
    var r = s && s.rtk;
    if (!r || !r.started) { return '시작 전'; }
    var mine = 0, k;
    for (k in (r.cities || {})) {
      if (Object.prototype.hasOwnProperty.call(r.cities, k) && r.me && r.cities[k].force === r.me) { mine++; }
    }
    return r.year + '년 ' + r.month + '월 · 성 ' + mine;
  }
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.account = {
    art: 'assets/store/realm_key',   // 타이틀 키 아트(K-0041, W-0050)
    name: '사가천하',
    emoji: '🏯',
    tag: '역사 인물로 여는 천하 정복 시뮬레이션',
    bit: realmBit
  };
})(window);

/* 판별 배경음 설정 — saga-web/shared/js/bgm.js 가 읽는다(이 판만 다른 것).
   곡 파일(assets/audio/bgm/)은 K-0004 가 만든다 — 아직 없어도 오류 없이 조용하다 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.bgm = {
    tracks: { town: 'saga-realm-town.ogg', field: 'saga-realm-field.ogg', battle: 'saga-realm-battle.ogg' },
    vol: 0.35,
    first: 'field',
    poll: 1000,
    /** 지금 틀 트랙 — 전황 카드가 떠 있으면 전투, 성 시트가 열려 있으면 마을(성 안), 아니면 국토 지도 */
    desired: function () {
      var d = global.document;
      if (!d) { return 'field'; }
      var enc = d.getElementById('encounter');
      if (enc && enc.classList.contains('battle')) { return 'battle'; }
      var sh = d.getElementById('sheet');
      if (sh && sh.classList.contains('show')) { return 'town'; }
      return 'field';
    }
  };
})(window);

/* 옷 무늬 설정 — saga-web/shared/js/vroid-variant.js 가 읽는다(W-0020). 무늬 64종(webp + patterns.json)은 자체툴이 shared/assets/patterns/ 에 놓는다 —
   없으면 기존 옷 그대로(표를 못 받으면 아무 것도 안 한다) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.assets3d = {
    /* 통일 3D 에셋(W-0021, shared/assets/world3d) — asset3d 키 → 그 판 9칸 id. 있는 자리만: 사당·성벽·횃불(화로)·집 */
    reg: { 'temple': ['chinese_hall_01'], 'wall': ['city_wall_segment_01'], 'torch': ['brazier_01'], 'house': ['silkroad_house_01'] },
    /* 빌린 몸(W-0074, shared/js/assets3d.js borrowRecipe) — 제 몸이 없는 사람(시간 틈 무장 아홉·도시 군중)도 시대 구분 없이 VRoid 통일 몸.
       이 판은 도감 105 + 장수 194 = 299 전부가 판 인물이라 pool: 'all'(얼굴이 장수와 겹친다 — NPC 몸이 더 오면 풀린다). named 는 서로 다른 몸 */
    borrow: {
      pool: 'all',
      named: ['tm_gangseo', 'tm_gongseok', 'tm_geumdam', 'tm_myeongbyeon', 'tm_doha', 'tm_seongyeon', 'tm_gwedo', 'tm_eunha', 'tm_yeongjeom']
    }
  };
  global.DG.cfg.mode2d = {
    /* 2D 국토 지도 꾸밈(W-0023) — 2D 모드 = 3D 지도가 안 서 있을 때. 땅 종류(land) → K-0020 `realm_*` 타일, 성 단계 → K-0017 `world2d` 스프라이트(map2d.js) */
    on: function () { var R3 = global.DG.realm3d; return !(R3 && R3.active && R3.active()); },
    tileBase: 'assets/web2d/tile/',
    still: { rts_inf_ally: 1, rts_inf_enemy: 1, rts_arc_ally: 1, rts_arc_enemy: 1, rts_cav_ally: 1, rts_cav_enemy: 1, hero_m: 1, hero_f: 1 },   // 한 장 모드 풀(W-0043·W-0047) — RTS 유닛 몸: K-0061 AI 몸(팀별) + 영웅
    tile: { plain: 'realm_grass', hill: 'realm_dirt', mount: 'realm_stone', river: 'realm_water' },
    prop2d: { 'city:s': { id: 'silkroad_house_01' }, 'city:m': { id: 'chinese_hall_01' }, 'city:l': { id: 'stone_tower_01' } }
  };
  global.DG.cfg.vroidPattern = { base: '../shared/assets/patterns/', repeat: 3 };   // 무늬는 판 폴더가 아니라 shared 에만 있다(W-0071) — 기준 주소 시험이 끝나기 전에 받아도 404 가 안 나게
})(window);
