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
  var SAVE_BASE = 'yeoksa-dungeon/save';
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
      dex: { heroes: {}, pets: {}, regions: {}, relics: {}, boons: {}, worldBoss: {} },   // heroes/pets: { id: {count, firstAt} } · regions: { themeName: true } · relics(PLAN §60 후보4): { id: true } · boons(§5.1, "은사첩"): { key: true } · worldBoss(§5.4, "토벌첩"): { id: {count, firstAt} }
      heroes: {},                         // { heroId: {lv, exp, rank} } 인물 개별 성장
      party: [],                          // 동행 heroId 최대 5 — 선두가 지도 위 아바타
      petEquip: {},                       // { heroId: petId }
      /* 오버월드(PLAN 28-1절)에서 시작해, §28-8(2026-09-06)부터 연속 좌표계로
         바뀌었다. `pos` 가 진짜 상태(플레이어의 세계 좌표) — null 이면
         town.js 가 `current`(옛 세이브의 마을 id 하나) 를 보고 그 마을의
         앵커 자리로 한 번만 마이그레이션한다. `current` 는 그 마이그레이션
         출처로만 남겨 둔다(안 지운다 — mergeDeep 이 옛 세이브 값을 보존하는
         것과 같은 이유, 새 세이브는 그냥 기본값). `seen` 은 Phase 2(자동
         지도 포그오브워) — 밝힌 들판 칸을 "cx,cz" 키로 쌓는다. */
      town: { current: 'moru', pos: null, seen: {} },
      /* 외모 커스텀(2026-09-06) — styleSeed:0 은 지금까지의 고정 모습과
         100% 같다(`dungeon3d.js`가 0이면 시드를 'me' 그대로 쓴다, 회귀
         없음). tint:null 은 GLB 제 색 그대로(칠 안 함). */
      appearance: { styleSeed: 0, tint: null },
      /* 확장(js/_expansion) 필드는 각 모듈이 스스로 만들고,
         옛 세이브의 값(gear·battle·dungeon 등)은 mergeDeep 이 보존한다.
         경영(territory·build)은 게임에서 뺐다 — 옛 세이브에 남아 있어도 아무도 읽지 않는다. */
      auto: {                             // 자동 순회 (auto.js) — 켠 상태도 기억한다
        on: false, grow: true, review: true, retry: true
      },
      ai: {                               // 사관(AI) 사용 기록 · 길조 (ai.js)
        spent: 0, calls: 0, log: [], buff: null
      },
      /* 목표판(§5.6) — 실제 자리는 js/goals.js 의 S() 가 지연 초기화한다.
         여기 있는 건 새 세이브의 기본 모양일 뿐(mergeDeep 이 옛 세이브에 채운다). */
      goals: {
        counts: {},
        now: { idx: 0, base: 0 },
        session: { idx: 0, base: 0, start: Date.now(), gold0: 120, feat0: 0 },
        weekly: { week: null, base: {}, bundleDone: {}, claimed: false, poolIdx: 0, poolBase: 0 },
        daily: { date: null, base: {}, bundleDone: {}, claimed: false }
      },
      settings: {
        mapStyle: 0, tilt: 1,
        mode: 'offline',                  // 'offline' | 'online' (net.js)
        aiBase: '',                       // 온라인 서버 주소 (빈 값 = 같은 출처)
        sound: true,                      // 소리 (sfx.js) — 첫 눌림에서 깨어난다
        soundVol: 0.5,
        camZoom: 1,                        // 3D 카메라 확대(핀치·휠) — dungeon3d.js 의 dg3d.zoom 값
        shake: 1,                          // §5.8① 화면 흔들림 배율 0~2(2026-09-18, 멀미 배려)
        hitstop: true                      // §5.8① 타격 정지 on/off(2026-09-18)
      },
      log: []
    };
  }

  var save = freshSave();

  /* ── 균형 손잡이(튜닝) ────────────────────────────────────
   * 규칙 상수를 밖에서 잡을 수 있게 하는 얇은 층이다. 어드민(`_admin.html`)이 쓴다.
   * 사가고(`saga-go`)·사가의숲·사가스토리에 먼저 둔 것을 **같은 이름으로** 옮겼다.
   * 이 판에는 여태 없었다 — `dungeon3d.js`·`asset3d.js` 가 `core.tuned` 를
   * "있으면 쓰고 없으면 기본값" 으로 이미 짜 두어서, 이 층만 얹으면
   * `dg3d.*` 손잡이가 콘솔이 아니라 어드민에서 잡히고 **새로고침 뒤에도 남는다**.
   *
   * **세이브와 다른 칸에 산다.** 세이브에 섞으면 프로필마다 규칙이 달라지고,
   * 세이브를 넘길 때 규칙까지 따라간다. 규칙은 "이 기기의 사정" 이지 진행이 아니다.
   *
   * **자가진단·데모는 읽지 않는다**(`DG_NO_TUNE`). 읽으면 손잡이를 잡아 둔 기기에서
   * 판정과 스크린샷이 흔들린다 — 씨앗을 고정한 것과 같은 이유다.
   */
  var TUNE_KEY = 'yeoksa-dungeon/tune';
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
  var POKE_KEY = 'yeoksa-dungeon/admin/poke';

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
    /* 2026-09-08 — "사가블로 끊김" 재현 로그에서 dt가 300~600ms 튀는데
       dungeon3d.js의 render() 안(actors/occ/fx/present/room/field/finalize)은
       죄다 몇 ms뿐이라 render() 밖(=game.js loop()의 auto.update/
       dungeonView.update 쪽)에 무거운 게 있다는 뜻이었다. 자동저장은
       game.js의 10초 주기 호출만 재고 있었는데, persist()는 사실 그 말고도
       아이템 습득·전투 종료·레벨업 등 **게임 이벤트마다** 여기저기서(item.js·
       hero.js·dungeon.js·town.js 등) 직접 불린다 — 그 호출들은 이 실측이
       없어 안 보였다. 호출 자리를 다 찾아 감싸는 대신 **여기(진짜 몸통)
       하나에서** 재면 어디서 불렀든 다 잡힌다. */
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      save.lastSeen = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      console.warn('저장 실패', e);
    }
    var ms = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
    if (ms > 5) { console.log('[던전 자동저장] persist=' + ms.toFixed(1) + 'ms'); }
  }

  /**
   * **저장한 채로 비우지 않는다.** persist() 로 빈 세이브를 그대로 적으면
   * v:1 이 박힌 채로 남아 다음 load() 가 "있는 세이브"로 읽는다 — 그러면
   * game.js 의 `fresh = !core.load()` 가 false 가 되어 출사표(첫 인물 셋)가
   * 다시 안 나가고, 동행·도감이 영영 빈 채로 갇힌다(던전 입장도 막혀 있어
   * 벗어날 길이 없다). localStorage 자체를 지워야 다음 load() 가 "세이브 없음"
   * 을 돌려주고 fresh 가 제대로 true 가 된다.
   */
  function reset() {
    save = freshSave();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 사설 모드 등 */ }
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
    hash2: hash2, pick: pick, clamp: clamp, fmt: fmt, fmtTime: fmtTime
  };
})(window);

/* 판별 계정 설정 — saga-web/shared/js/account.js 가 읽는다(이 판만 다른 것) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.account = {
    name: '사가블로',
    emoji: '⚔️',
    tag: '역사 인물로 여는 핵앤슬래시 던전 크롤러'
  };
})(window);

/* 판별 후처리 설정 — saga-web/shared/js/post3d.js 가 읽는다(이 판만 MEDIUM 등급을 LOW 쪽으로 낮춘다) */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  /* 2026-09-09 폰 실기기 "품질을 낮춰줘 + 하얀 안개" 재신고 — 후처리(블룸·SSAO)는 가장 비싸고, AUTO 가 MEDIUM 으로 오갈 때마다
     syncTargets 가 렌더 타깃을 다시 만들어 그 프레임이 멎었다(§28-8 되먹임). MEDIUM 의 몫을 줄여 왕복 비용을 낮춘다. */
  global.DG.cfg.post = { medium: { post: 1, mips: 2, msaa: 0, scale: 0.65 } };
})(window);

/* 판별 배경음 설정 — saga-web/shared/js/bgm.js 가 읽는다(이 판만 다른 것).
   곡 파일(assets/audio/bgm/)은 K-0004 가 만든다 — 아직 없어도 오류 없이 조용하다 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.bgm = {
    tracks: { town: 'saga-dungeon-town.ogg', field: 'saga-dungeon-field.ogg', battle: 'saga-dungeon-battle.ogg' },
    vol: 0.35,
    first: 'town',
    poll: 1000,
    /** 지금 틀 트랙 — 굴혈(회차) 밖이면 마을, 보스·소보스·난입이면 전투, 그 밖의 굴혈은 던전 곡 */
    desired: function () {
      var DN = global.DG.dungeon;
      if (!DN || !DN.active()) { return 'town'; }
      var st = DN.status();
      if (st.horde || st.kind === 'boss' || st.kind === 'miniboss') { return 'battle'; }
      return 'field';
    }
  };
})(window);

/* 판별 2D 모드 설정 — saga-web/shared/js/mode2d.js 가 읽는다(이 판만 다른 것).
   시트 풀(assets/sprites2d_sheets/)은 K-0015 가 만든다 — 없으면 기존 코드 스탬프 그대로, 오류 없음. 관문 구간(tier 1~4)마다 풀을 나눠 쓴다 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};
  global.DG.cfg = global.DG.cfg || {};
  global.DG.cfg.mode2d = {
    base: 'assets/sprites2d_sheets/',
    targetH: 40,                                 // 던전 2D 의 사람형 몸 높이 기준(px, dungeon-view bodyH 40·s 와 같은 단위 — 호출이 배수를 곱한다)
    foot: 0.87,
    /** 2D 모드인가 — 3D 가 안 서 있을 때(= 아이소 2D 그림) */
    on: function () { var T = global.DG.dungeon3d; return !(T && T.active && T.active()); },
    poolH: { pool_d_goblin_118: 61, pool_e_orc_125: 90, pool_g_undead_143: 91, pool_basem_demon_104: 106 },   // 프레임 안 몸 높이(px, pw-sheet-bbox.mjs 로 잼)
    pools: {
      t1: ['pool_d_goblin_118'],
      t2: ['pool_e_orc_125', 'pool_d_goblin_118'],
      t3: ['pool_g_undead_143', 'pool_e_orc_125'],
      t4: ['pool_basem_demon_104', 'pool_g_undead_143']
    }
  };
})(window);
