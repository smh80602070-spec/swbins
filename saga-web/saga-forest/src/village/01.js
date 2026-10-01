/**
 * 마을 — 원작식 놀이의 규칙
 * ---------------------------------------------------------------
 * 순환은 셋이다:
 *   걷는다   마을을 돌아다닌다 (지도가 아니라 손으로 만든 한 마을)
 *   모은다   나무를 흔들고 바위를 캐고 물가에서 낚는다 — 사물마다 하루 한 번
 *   나눈다   주민의 부탁을 들어주고, 남은 것은 전방에 판다
 *
 * 화면은 village-view.js 가, 규칙은 여기가 맡는다. 이 파일은 캔버스를 모른다.
 *
 * 마을 생김새는 **좌표 해시로 정해진다**(core.hash2). 그래서 같은 마을이 늘 같은
 * 모습이고, 세이브에 타일을 다 적어 둘 필요가 없다 — 바뀐 것(캔 자리·심은 것)만
 * 세이브에 남긴다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var VD = global.DG.villageData;

  var W = 30, H = 20;            // 마을 크기 (타일)
  var TILE = 40;                 // 한 타일 = 몇 단위 (그림 크기와 무관한 논리값)
  var SPEED = 118;               // 걸음 (단위/초)
  var REACH = 46;                // 사물에 손이 닿는 거리

  /* 걸음 배속만 **매번 읽는다** — 어드민에서 돌리면 곧바로 듣는다.
     나머지 손잡이는 모듈이 켜질 때 한 번 읽으므로 새로고침이 필요하다 */
  function speedMul() { return core.tuned('walk.speedMul', 1); }

  var player = { x: W * TILE * 0.5, y: H * TILE * 0.55, vx: 0, vy: 0,
                 facing: 1, phase: 0, walking: false };
  var target = null;             // 탭한 지점
  var keys = {};
  var props = [];                // 마을에 놓인 사물 (마을 생성 때 정해진다)
  var residents = [];            // 주민 (세이브에 id 만 남고 자리는 여기서)
  var animals = [];              // 짐승 — 세이브에 안 남는다. 거동은 animal.js 가 맡는다
  var npcs = [];                 // 숲 NPC — 고정 자리, 세이브에 안 남는다

  /* ── 세이브 자리 ──────────────────────────────────────── */

  function st() {
    var s = core.save;
    if (!s.village) {
      s.village = {
        seed: Math.floor(Math.random() * 1e9),
        bag: {},                 // { itemKey: n }
        used: {},                // { propId: 마지막으로 딴 날짜(일 단위) }
        friend: {},              // { heroId: 친밀도 } — 옛 값, 세배 삯·§5.2 카드가 여전히 쓴다
        hearts: {},              // { heroId: { h: 0~10, lastTalk, gainDay, gained } } — PLAN §5.4
                                 // lastTalk·gainDay 는 다른 곳의 gifted·wrote 와 같은 결로 s.day(정수) 를 넣는다
        planted: [],             // 심어 둔 것 { x, y, kind, day, from }
        residents: [],           // 이 마을에 사는 인물 id
        requests: {},            // { heroId: {want, n, done} }
        tools: {},               // { net: true, spade: true } — 전방에서 산 도구
        donated: {},             // { itemKey: true } — 사고에 들인 것 (museum.js)
        gifted: {},              // { heroId: 마지막으로 선물한 날 }
        wrote: {},               // { heroId: 마지막으로 편지를 부친 날 }
        weeds: [],               // 잡초 { x, y } — 안 뽑으면 쌓인다
        terrain: {},             // { "tx,ty": 타일 } — 사람이 고친 칸만 (terrain.js)
        soldGold: 0,             // 전방에 판 금 누계 (전방이 자라는 기준)
        wish: null,              // 별똥별에 빈 소원 { day, n, last }
        wear: null,              // 차림 { on, owned } (wear.js)
        turnip: null,            // 순무 { n, buy, week } (turnip.js)
        caught: {},              // { itemKey: n } — 처음 잡은 것까지 다 센다 (도감)
        mail: [], moveIn: {}, leaving: {}, replied: {},   // 편지·이사 (mail.js)
        home: null,              // 집 (home.js 가 채운다)
        day: today(),
        sold: 0, gathered: 0, helped: 0
      };
    }
    if (!s.village.hearts) { s.village.hearts = {}; }
    if (!s.village.tools) { s.village.tools = {}; }
    if (!s.village.caught) { s.village.caught = {}; }
    if (!s.village.donated) { s.village.donated = {}; }
    if (!s.village.gifted) { s.village.gifted = {}; }
    if (!s.village.memento) { s.village.memento = {}; }      // 하트 10 주민 사연을 들은 사람 { id: 틀 key }
    if (!s.village.weeds) { s.village.weeds = []; }
    if (!s.village.terrain) { s.village.terrain = {}; }
    if (s.village.soldGold === undefined) { s.village.soldGold = 0; }
    return s.village;
  }

  /**
   * 오늘 (그 고장 자정 기준 일 단위) — 하루가 지나면 채집물이 다시 여문다.
   *
   * 부호가 뒤집혀 있었다. `getTimezoneOffset()` 은 KST 에서 **-540** 이므로
   * 그 고장 시각은 `getTime() - offset*60000`(= UTC+9h)이다. 옛 식은 9시간을
   * **빼서** 날이 자정이 아니라 저녁 여섯 시에 바뀌었다.
   * 순무 장(일요일 아침)을 넣으며 요일이 어긋나 드러났다.
   */
  function today() {
    var d = new Date();
    var n = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
    /* 어드민의 '날짜 밀기' — 하루를 넘겨 보거나 일요일로 가 볼 때 쓴다.
       요일·하루 몫·잡초·편지가 한꺼번에 그날 것이 된다 */
    return n + core.tuned('time.dayShift', 0);
  }

  /* ── 마을 만들기 ──────────────────────────────────────── */

  /** 마을 밖 "숲 고리" 폭(타일) — PLAN 40절 PHASE 3 "넓은 Forest Map". 이 너머는
   *  여전히 물(세상 끝)이라 걸어서 무한히 못 나간다. 실기기 성능 보면 admin 에서
   *  줄일 수 있게 손잡이로 뒀다.
   *  **2026-09-09, 20 → 32.** `BIOME_CELL`(22)보다 겨우 2칸 넓은 20에서는 어느 방향으로
   *  걸어도 바이옴 하나(운 나쁘면 한 칸의 일부)만 스치고 세상 끝(물)에 닿아, PLAN
   *  11절이 약속한 다섯 바이옴이 실제로는 거의 안 보였다. 32는 `BIOME_CELL`의 1.45배라
   *  대부분 방향에서 바이옴 하나를 온전히 지나 다음 바이옴 초입까지 걷게 된다. 호수·강·
   *  캠프·동굴은 전부 이 값에 비례해 고정 배치되므로(PLAN 10절) 좌표를 새로 안 짜도
   *  저절로 더 멀리 물러난다. 프롭 총수는 고리 넓이 비례라 2배 남짓 늘어난다 —
   *  느려지면 admin '숲' 탭에서 이 값 하나만 낮추면 된다(코드 손볼 필요 없음). */
  function forestMargin() { return core.tuned('forest.margin', 32); }

  /* ── 숲 고리 바이옴(PLAN 11절) ────────────────────────────
   * 마을 밖을 한 가지 잔디로 두지 않고 큼직한 구역(BIOME_CELL 타일 정사각형)으로
   * 갈라 다섯 가지 분위기를 준다. 칸 좌표를 seed 와 함께 해시하므로 같은 세이브는
   * 늘 같은 바이옴 지도를 갖는다 — tileAt() 처럼 저장할 필요가 없다.
   *
   * 색감·사물 종류만 다룬다. ambient sound·몬스터·아이템(PLAN 11절이 함께 적은
   * 항목)은 이 게임에 아직 그런 체계 자체가 없어 이번 단계에는 안 넣는다.
   */
  var BIOMES = ['green', 'meadow', 'dark', 'mushroom', 'rocky'];
  var BIOME_CELL = 22;
  /** 바이옴별 땅 색 — data-village.js 의 TILES 키. green 은 기존 그대로 'grass' */
  var BIOME_TILE = {
    green: 'grass', meadow: 'grass_meadow', dark: 'grass_dark',
    mushroom: 'grass_mush', rocky: 'grass_rocky'
  };
  /** 숲 고리 자연 바닥인지 — 공사(terrain.js)로 딴 걸 깐 자리는 걸러야 하므로
   *  buildProps() 가 tileAt() 결과를 이 표로 되짚어 본다 */
  var GRASS_FAMILY = { grass: 1, grass_meadow: 1, grass_dark: 1, grass_mush: 1, grass_rocky: 1 };

  /* ── 이름 있는 숲 여덟(PLAN §5.12, SAGA-DESIGN §12 — 2026-09-24 사용자 "랜덤이 아닌 특색 있는 지역") ──
   * 예전엔 BIOME_CELL 칸마다 **세이브 씨앗**으로 다섯 바이옴을 흩었다(세이브마다 다른 모자이크).
   * 이제 마을을 가운데 두고 방위 여덟으로 고정된 숲이 선다 — 어느 세이브·기기든 같은 땅이다.
   * 경계는 BIOME_CELL 칸 좌표만으로 정해지는 흔들림(±0.2 rad)으로 굽힌다(씨앗을 안 본다).
   * biome 은 위 다섯 중 하나 — 땅 색·사물 문턱·짐승·채집 갈래는 그 바이옴 표를 그대로 탄다. */
  var FORESTS = [
    { key: 'eoksae', name: '억새 바람벌', hanja: '芒原', emoji: '🌾', biome: 'meadow', desc: '은빛 억새가 바람 따라 눕는 너른 벌' },
    { key: 'yoseong', name: '버섯 요정골', hanja: '菌谷', emoji: '🍄', biome: 'mushroom', desc: '밤이면 버섯갓이 초롱처럼 빛나는 골짜기' },
    { key: 'solsup', name: '푸른 솔숲', hanja: '靑松林', emoji: '🌲', biome: 'green', desc: '솔향이 짙은 오래된 소나무 숲' },
    { key: 'neoldeol', name: '이끼 돌너덜', hanja: '苔石', emoji: '🪨', biome: 'rocky', desc: '이끼 낀 돌이 무너져 쌓인 비탈' },
    { key: 'eoseureum', name: '어스름 고목숲', hanja: '暮林', emoji: '🌑', biome: 'dark', desc: '말라 죽은 고목 사이로 해가 잘 들지 않는다' },
    { key: 'kkotip', name: '꽃잎 언덕', hanja: '花丘', emoji: '🌸', biome: 'meadow', desc: '철마다 다른 꽃이 언덕을 덮는다' },
    { key: 'georin', name: '거인 바위 고개', hanja: '巨岩嶺', emoji: '⛰️', biome: 'rocky', desc: '거인이 굴려 놓았다는 바위가 길을 막는다' },
    { key: 'bandi', name: '반딧불 참나무숲', hanja: '螢林', emoji: '✨', biome: 'green', desc: '여름밤 반딧불이 참나무 사이를 떠돈다' }
  ];
  var FOREST_BY = {};
  FORESTS.forEach(function (f, i) { f.sector = i; FOREST_BY[f.key] = f; });
  /** 이 칸의 숲 — 마을 가운데서 본 방위(0 = 동쪽, 화면 y 가 남쪽이라 시계 방향) */
  function forestAt(tx, ty) {
    var cx = Math.floor(tx / BIOME_CELL), cy = Math.floor(ty / BIOME_CELL);
    var a = Math.atan2(ty + 0.5 - H / 2, tx + 0.5 - W / 2) + (core.hash2(cx * 733 + 17, cy * 617 + 29) - 0.5) * 0.4;
    return FORESTS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  }
  function biomeAt(tx, ty) { return forestAt(tx, ty).biome; }
  /** 마을 밖이면 선 숲, 안이면 null */
  function forestOfPlayer() {
    var tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
    if (tx >= 0 && ty >= 0 && tx < W && ty < H) { return null; }
    return forestAt(tx, ty);
  }
  var forestNow = null, forestT = 0;
  /** 숲이 바뀌면 이름 한 줄(1초 넘게 머물 때만 — 경계를 스칠 때 깜빡이지 않게) */
  var forestPend = null, forestPendT = 0;
  function stepForest(dt) {
    forestT -= dt;
    if (forestT > 0) { return; }
    forestT = 0.3;
    var f = forestOfPlayer(), k = f ? f.key : 'village';
    if (forestNow === null) { forestNow = k; return; }
    if (k === forestNow) { forestPend = null; forestPendT = 0; return; }
    if (k !== forestPend) { forestPend = k; forestPendT = 0; return; }
    forestPendT += 0.3;
    if (forestPendT < 1) { return; }
    forestNow = k; forestPend = null; forestPendT = 0;
    if (f) {
      core.log(f.emoji + ' ' + f.name + '(' + f.hanja + ') — ' + f.desc, 'info');
      core.emit('toast', f.emoji + ' ' + f.name + ' — ' + f.desc);
      core.emit('forest:enter', { key: f.key });
    }
  }

  /** 바이옴별 사물 문턱표 — 원래(기존 green) 문턱과 밀도를 그대로 두고, 나머지
   *  넷은 같은 방식(fh 하나로 내림차순 문턱을 훑는다)으로 그 바이옴다운 사물만 낸다 */
  var BIOME_SCATTER = {
    green:    [[0.80, 'tree'], [0.68, 'pine'], [0.60, 'rock'], [0.50, 'flower']],
    meadow:   [[0.78, 'flower'], [0.55, 'flower'], [0.45, 'bush'], [0.38, 'tree']],
    dark:     [[0.78, 'deadTree'], [0.62, 'deadTree'], [0.50, 'mossyRock'], [0.42, 'pine']],
    mushroom: [[0.80, 'mushroom'], [0.64, 'mushroom'], [0.52, 'stump'], [0.44, 'log']],
    rocky:    [[0.78, 'rock'], [0.62, 'mossyRock'], [0.50, 'rock'], [0.40, 'pine']]
  };

  /* ── 호수(PLAN 40절 PHASE 3 세 번째 칸) ──────────────────────
   * PLAN 10절 "중요한 장소는 랜덤 배치하지 않는다"에 호수가 들어 있다 — 그래서
   * 좌표 해시가 아니라 **margin(forestMargin) 에 비례한 고정 자리**에 판다.
   * 마을 서쪽, 세로 가운데. margin 을 admin 에서 낮춰도 고리 밖으로 안 튀어
   * 나가게 반지름을 그 안에서만 잡고, 고리가 아예 좁으면(< LAKE_MIN_MARGIN)
   * 호수 자체를 포기한다(작은 웅덩이보다 없는 편이 낫다고 봤다).
   */
  var LAKE_MIN_MARGIN = 10;
  function lakeCenter() {
    var m = forestMargin();
    if (m < LAKE_MIN_MARGIN) { return null; }
    var tx = -Math.round(m * 0.5);
    var r = Math.min(5, Math.max(2, Math.floor((m - Math.abs(tx) - 1) / 1.6)));
    return { tx: tx, ty: Math.floor(H * 0.5), r: r };
  }
  /** 타원(가로로 1.6배 길다)로 판다 — 실제 호수처럼 둥글기만 하면 심심하다 */
  function inLake(tx, ty) {
    var c = lakeCenter();
    if (!c) { return false; }
    var dx = (tx - c.tx) / 1.6, dy = ty - c.ty;
    return dx * dx + dy * dy <= c.r * c.r;
  }
  /** 호수 테두리 바로 바깥 한 겹 — 여기에만 물가 식생(plant)을 흘려 넣는다 */
  function nearLakeShore(tx, ty) {
    var c = lakeCenter();
    if (!c) { return false; }
    var dx = (tx - c.tx) / 1.6, dy = ty - c.ty;
    var d2 = dx * dx + dy * dy;
    var rr = c.r + 1.6;
    return d2 > c.r * c.r && d2 <= rr * rr;
  }

  /* ── 강(PLAN 40절 PHASE 3 네 번째 칸) ────────────────────────
   * 호수 동쪽 기슭에서 남북으로 흐른다 — **호수를 기준점으로 삼는다**(새 좌표
   * 해시를 안 만든다). 그래서 margin 이 좁아 호수가 사라지면(`lakeCenter()` 가
   * null) 강도 같이 사라진다 — PLAN 10절 "고정 배치"를 호수 하나로 지키면
   * 강도 저절로 지켜지는 셈이다. 살짝 구불거리게 sin 으로 흔든다.
   */
  var RIVER_HALF_W = 1.4;
  function riverCenterX(ty) {
    var c = lakeCenter();
    if (!c) { return null; }
    return c.tx + c.r * 1.3 + Math.sin(ty * 0.30) * 2.5;
  }
  function inRiver(tx, ty) {
    var cx = riverCenterX(ty);
    if (cx === null) { return false; }
    return Math.abs(tx - cx) <= RIVER_HALF_W;
  }
  /** 강둑 한 겹 — 호수 테두리와 같은 방식으로 물가 식생을 흘려 넣는다 */
  function nearRiverBank(tx, ty) {
    var cx = riverCenterX(ty);
    if (cx === null) { return false; }
    var d = Math.abs(tx - cx);
    return d > RIVER_HALF_W && d <= RIVER_HALF_W * 2;
  }

  /* ── 다리(2026-09-09, "다른 추가할 사항 없는지" 훑다가 찾음) ─────────
   * **강이 처음부터 끝(ty 전체)까지 끊김 없이 막혀 있었다** — `riverCenterX()`가
   * ty 에 어떤 제한도 안 두고 늘 값을 낸다. `terrain.js`(공사)도 "마을 밖은
   * 못 한다"고 막혀 있어 사용자가 직접 다리를 놓을 수도 없었다. 그 결과
   * **호수(와 그 서쪽 바이옴 전부)가 걸어서는 아예 못 가는 자리**였다 —
   * `asset3d.js`에 `'bridge': Bridge.glb`가 진작에(2026-08-30, 사가고에서
   * 그대로 옮겨 옴) 등록만 되고 한 번도 안 쓰인 게 그 증거다.
   *
   * 마을 자체의 동서 도로(`tileAt()`의 "가운데 가로로 흙길", `ty === H*0.5`
   * 줄)와 **같은 줄**에 다리를 놓는다 — 마을 안 도로를 따라 걷다 보면 저절로
   * 다리에 닿는다. 강폭(`RIVER_HALF_W`)만큼만 뚫어 강 자체는 다른 줄에서
   * 여전히 막혀 있다(다리가 아니면 여전히 못 건넌다 — "아무 데서나 건넌다"가
   * 아니라 "고정된 한 자리로만 건넌다"는 PLAN 10절과 같은 결).
   */
  var BRIDGE_TY = Math.floor(H * 0.5);
  function inBridge(tx, ty) {
    if (ty !== BRIDGE_TY) { return false; }
    var cx = riverCenterX(ty);
    if (cx === null) { return false; }
    return Math.abs(tx - cx) <= RIVER_HALF_W;
  }

  /* ── 폭포(PLAN 40절 PHASE 3 다섯 번째 칸) ─────────────────────
   * 강줄기를 따라 호수에서 남쪽으로 내려간 고정 한 자리다(margin 을 벗어나지
   * 않게 자른다) — 강이 없으면(호수가 없으면) 폭포도 없다.
   *
   * **진짜 낙차는 못 만든다** — `terrain.js` 머리말대로 이 판 땅에는 애초에
   * 높이 축이 없다(절벽을 안 넣은 것과 같은 이유). 그래서 이번 칸은 "여기가
   * 폭포다"라는 **고정 표지**만 세운다 — 판정(tileAt)은 그 칸도 여전히 강물
   * (water)이고, 화면에는 기존 rock 렌더를 좌우에 세워 여울처럼 보이게만
   * 한다. 물줄기·물보라 같은 실제 낙수 효과(PLAN 12절)는 호수·강 때부터
   * 미뤄 온 "물 표현" 손질 몫으로 그대로 남긴다.
   */
  function waterfallSpot() {
    var c = lakeCenter();
    if (!c) { return null; }
    var m = forestMargin();
    var ty = Math.min(H + m - 3, c.ty + 26);
    var cx = riverCenterX(ty);
    if (cx === null) { return null; }
    return { tx: Math.round(cx), ty: ty };
  }

  /* ── 작은 마을(PLAN 40절 PHASE 3 여섯 번째 칸) ─────────────────
   * 호수·강과 겹치지 않게 반대쪽(동쪽)에 고정 캠프를 하나 세운다 — PLAN 10절
   * "고정 배치" 그대로. 한옥(전방·내 집처럼)을 새로 그리는 대신, `asset3d.js`에
   * 이미 등록돼 있던 천막·모닥불·평상·우물·등롱을 모아 놓는다 — 여기 사는
   * 사람은 아직 없다(NPC·대화는 PLAN 17절, PHASE 4 몫). 지금은 "지나가다
   * 발견하는 빈 캠프" 하나만 세운다.
   */
  var HAMLET_MIN_MARGIN = 10;
  function hamletSpot() {
    var m = forestMargin();
    if (m < HAMLET_MIN_MARGIN) { return null; }
    return { tx: W + Math.round(m * 0.55), ty: Math.floor(H * 0.35) };
  }
  /** 캠프 둘레 7×5 칸 — 이 안에는 바이옴 장식(나무·바위 등)을 안 심는다 */
  function inHamlet(tx, ty) {
    var h = hamletSpot();
    if (!h) { return false; }
    return tx >= h.tx - 3 && tx <= h.tx + 3 && ty >= h.ty - 2 && ty <= h.ty + 2;
  }

  /* ── 두 번째 캠프(2026-09-09, 사용자 지시 "두 번째 캠프 새로 열어") ──────
   * 첫 캠프(동)·호수(서)·폭포/강(남서)·동굴(북)이 이미 찬 방향 사이 빈틈 —
   * 남쪽으로 깊게, 동쪽으로는 얕게 잡아 첫 캠프(동, y=0.35H)와도 강·폭포
   * (서쪽, x 음수대)와도 안 겹친다. 첫 캠프보다 작고 수수하게 — "나그네가
   * 하룻밤 묵어가는 외딴집" 하나뿐이다(우물 없음, 천막·모닥불·평상·등롱
   * 하나씩만). 사람은 아직 없다 — 첫 캠프의 상인도 PHASE 3가 아니라 PHASE 4
   * (NPC)에서 나중에 채워진 것과 같은 순서다.
   */
  var HAMLET2_MIN_MARGIN = 14;
  function hamlet2Spot() {
    var m = forestMargin();
    if (m < HAMLET2_MIN_MARGIN) { return null; }
    return { tx: W + Math.round(m * 0.15), ty: H + Math.round(m * 0.6) };
  }
  /** 첫 캠프와 같은 7×5 칸 — 자리는 작아도 비우는 둘레는 맞춘다 */
  function inHamlet2(tx, ty) {
    var h = hamlet2Spot();
    if (!h) { return false; }
    return tx >= h.tx - 3 && tx <= h.tx + 3 && ty >= h.ty - 2 && ty <= h.ty + 2;
  }

  /* ── 폐허(2026-09-10, "시대 혼합 소품·폐허" — 퓨전 방향, PLAN 10절 예시)
   * 호수(서·중간 높이)·캠프(동)·폭포(호수와 같은 x대, 남쪽)·캠프2(동남
   * 구석)·동굴(북, 중앙보다 동쪽)이 다 찬 뒤 남은 방향 — **서북쪽**
   * (호수와 같은 서쪽 x대이지만 중간이 아니라 훨씬 북쪽)에 놓는다.
   */
  var RUIN_MIN_MARGIN = 12;
  function ruinSpot() {
    var m = forestMargin();
    if (m < RUIN_MIN_MARGIN) { return null; }
    return { tx: -Math.round(m * 0.5), ty: -Math.round(m * 0.45) };
  }
  /** 폐허 둘레 5×4 칸 — 바이옴 장식·짐승·채집을 비운다(다른 고정 장소와 같은 결) */
  function inRuin(tx, ty) {
    var r = ruinSpot();
    if (!r) { return false; }
    return tx >= r.tx - 2 && tx <= r.tx + 2 && ty >= r.ty - 2 && ty <= r.ty + 1;
  }

  /* ── 우주기지(PLAN 45절, 2026-09-11 — "다른 마을·배달 알바") ───────
   * 사용자가 고른 세 결정: ① 처음부터 지도에 있는 고정 마을(발견형 아님)
   * ② 기존 다섯(서북 폐허·북 동굴·동 캠프1·동남 캠프2·서 호수)과 안 겹치는
   * **더 먼 대각선**(남서) ③ 배달은 무제한 반복. `SPACEBASE_MIN_MARGIN`을
   * 다른 고정 자리(10~14)보다 훨씬 높게, 비율(0.7·0.75)도 더 크게 잡아
   * "더 먼"을 좌표로 그대로 나타낸다.
   */
  var SPACEBASE_MIN_MARGIN = 20;
  function spaceBaseSpot() {
    var m = forestMargin();
    if (m < SPACEBASE_MIN_MARGIN) { return null; }
    return { tx: -Math.round(m * 0.7), ty: H + Math.round(m * 0.75) };
  }
  /** 우주기지 둘레 7×7 칸 — 다른 고정 자리와 같은 결로 바이옴 장식·채집·짐승을 비운다 */
  function inSpaceBase(tx, ty) {
    var b = spaceBaseSpot();
    if (!b) { return false; }
    return tx >= b.tx - 3 && tx <= b.tx + 3 && ty >= b.ty - 3 && ty <= b.ty + 3;
  }

  /* ── 숨겨진 동굴(PLAN 40절 PHASE 3 마지막 칸) ────────────────────
   * 호수(서)·캠프(동)·폭포(강 남쪽)와 안 겹치는 마지막 방향 — **북쪽**에
   * 고정한다. PLAN 10절이 "던전 입구"도 고정 배치로 못 박아 둔 것과 같은
   * 이유다. `mountain`(바위산) 모델 하나를 뒤에 세우고 `mossyRock` 둘로
   * 입구를 좁힌 다음, `cave`(동굴 입구) 표지를 그 앞에 둔다.
   *
   * **안까지는 못 들어간다.** 폭포와 같은 사정으로, 안에 들어갈 방(집처럼
   * 딴 좌표계로 옮겨 가는 실내)과 그 안의 보물(PLAN 18절 탐험 콘텐츠·PLAN 40절
   * PHASE 4 "Treasure")을 만드는 건 이번 칸이 아니라 다음 몫이다. 지금은
   * "숲을 걷다 찾아내는 동굴 입구" 표지 하나만 세운다.
   */
  var CAVE_MIN_MARGIN = 10;
  function caveSpot() {
    var m = forestMargin();
    if (m < CAVE_MIN_MARGIN) { return null; }
    return { tx: Math.floor(W * 0.75), ty: -Math.round(m * 0.55) };
  }
  /** 동굴 둘레 5×5 칸 — 바이옴 장식을 비운다 */
  function inCave(tx, ty) {
    var c = caveSpot();
    if (!c) { return false; }
    return tx >= c.tx - 2 && tx <= c.tx + 2 && ty >= c.ty - 2 && ty <= c.ty + 2;
  }

  /* ── 동굴 안(PLAN 18절 "보물상자" · PLAN 40절 PHASE 4 "Treasure") ─────
   * 집(home.js)과 같은 요령이다 — 딴 좌표계로 옮겨 가는 평평한 실내, 문은
   * 뒷벽 가운데, 나갈 땐 문에서 손을 쓴다. **집과 안을 공유하지 않는다**
   * (indoors 는 집 전용, caveIn 은 동굴 전용 — 둘 다 켜지는 일은 없게
   * enterHome()/enterCave() 양쪽에서 서로를 막는다). 방 크기는 안 늘어난다
   * (집의 HOME_TIERS 같은 증축이 없다) — 보물상자 셋을 넣을 만큼만.
   */
  /* 2026-09-10 — 깊은 칸(3줄) 추가, 보스방(PLAN 10절 "보스 지역"·퓨전 방향).
     기존 6줄(상자 셋)은 그대로 두고 뒤에 이어 붙였을 뿐이다 */
  var CAVE_ROOM = { tw: 8, th: 9 };
  function caveRoom() { return { tw: CAVE_ROOM.tw, th: CAVE_ROOM.th, w: CAVE_ROOM.tw * TILE, h: CAVE_ROOM.th * TILE }; }
  /** 문은 집과 같은 자리(뒷벽 가운데) */
  function caveDoor() { return { x: Math.floor(CAVE_ROOM.tw / 2) * TILE + TILE * 0.5, y: TILE * 0.8 }; }
  /** 상자 셋 — 고정 자리(PLAN 10절), 값은 안쪽일수록 커진다 */
  var CAVE_CHESTS = [
    { id: 'chest0', x: TILE * 2 + TILE * 0.5, y: TILE * 3 + TILE * 0.5, reward: 600 },
    { id: 'chest1', x: TILE * 6 + TILE * 0.5, y: TILE * 2.2 + TILE * 0.5, reward: 1000 },
    { id: 'chest2', x: TILE * 4 + TILE * 0.5, y: TILE * 4.6 + TILE * 0.5, reward: 1800 }
  ];
  /** 보스방(2026-09-10, "괴물이 나와도 되고" 퓨전 방향, PLAN 10절 "보스
   *  지역") — 새 전투는 안 만들었다. 상자 셋을 다 열어야 이 상자가 열리고
   *  (`bossUnlocked()`), 그전엔 "포자대왕이 지키고 있다"는 안내만 준다.
   *  깊은 칸(뒤에 이어 붙인 3줄)에 혼자 서 있다 */
  var CAVE_BOSS_CHEST = { id: 'bossChest', x: TILE * 4 + TILE * 0.5, y: TILE * 7.6 + TILE * 0.5, reward: 3500 };
  function caveBossChest() { return CAVE_BOSS_CHEST; }
  function bossUnlocked() {
    var o = st().caveOpened || {};
    return !!(o.chest0 && o.chest1 && o.chest2);
  }
  function caveChests() { return CAVE_CHESTS.concat([CAVE_BOSS_CHEST]); }
  function chestOpened(id) { return !!(st().caveOpened || {})[id]; }
  function caveInside() { return caveIn; }

  function enterCave() {
    if (indoors || caveIn) { return null; }
    outPos = { x: player.x, y: player.y };
    caveIn = true;
    target = null;
    var d = caveDoor();
    player.x = d.x; player.y = d.y - TILE * 0.6;
    core.emit('village:cave', { inside: true });
    core.emit('changed');
    return { kind: 'cave', text: '🕳️ 동굴 안으로 들어섰다' };
  }

  function leaveCave() {
    if (!caveIn) { return null; }
    caveIn = false;
    target = null;
    if (outPos) { player.x = outPos.x; player.y = outPos.y; }
    outPos = null;
    core.emit('village:cave', { inside: false });
    core.emit('changed');
    core.persist();
    return { kind: 'cave', text: '🕳️ 동굴 밖으로 나왔다' };
  }

  /** 상자 하나를 연다 — 사물처럼 날마다 다시 차지 않는다(장식·채집물과 달리
   *  **한 번뿐인 발견**이다), 프로필당 한 번만 */
  function openChest(c) {
    var s = st();
    if (!s.caveOpened) { s.caveOpened = {}; }
    if (c.id === 'bossChest' && !bossUnlocked()) {
      return { kind: 'locked', text: '👹 포자대왕이 지키고 있다 — 먼저 다른 상자 셋을 다 찾아야 한다' };
    }
    if (s.caveOpened[c.id]) { return { kind: 'empty', text: '이미 열어 본 상자입니다' }; }
    s.caveOpened[c.id] = true;
    core.save.player.gold += c.reward;
    core.gainFeat(1, '보물');
    core.gainExp(c.id === 'bossChest' ? 40 : 10);
    core.log((c.id === 'bossChest' ? '👑 포자대왕의 보물에서 ' : '📦 보물상자에서 ') +
      '🪙 ' + core.fmt(c.reward) + ' 을 찾았다', 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'treasure', text: (c.id === 'bossChest' ? '👑 ' : '📦 ') + '🪙 ' + core.fmt(c.reward) };
  }

  /* 강가 조개 길(PLAN §5.3) — 조개 갈래 번들을 다 채우면 강 동쪽 기슭에 모래길이 깔린다.
     세이브에 칸을 쓰지 않는다: `buildProps()` 가 조건(사고 갈래 완결)과 강 자리에서 매번
     다시 세워 두는 표(`"tx,ty":1`)이고, `tileAt()` 은 **잔디 칸이면서 사람이 안 고친 칸**만
     모래로 바꾼다(물·길·공사한 땅은 그대로). 완결 전엔 null 이라 예전과 한 글자도 다르지 않다. */
  var shellPath = null;
  var SHELL_PATH_ROWS_UP = 4, SHELL_PATH_ROWS_DOWN = 1, SHELL_PATH_WIDTH = 2;

  function computeShellPath() {
    shellPath = null;
    var MU = global.DG.museum, lc = lakeCenter();
    if (!MU || !MU.byCat || !lc) { return; }
    var list = MU.byCat(), i, done = false;
    for (i = 0; i < list.length; i++) {
      var bd = VD.BUNDLES[list[i].cat.key];
      if (bd && bd.facility === 'shell' && list[i].total > 0 && list[i].done >= list[i].total) { done = true; }
    }
    if (!done) { return; }
    var path = {}, ty, k;
    for (ty = lc.ty - SHELL_PATH_ROWS_UP; ty <= lc.ty + SHELL_PATH_ROWS_DOWN; ty++) {
      var rx = riverCenterX(ty);
      if (rx === null) { continue; }
      var x0 = Math.floor(rx + RIVER_HALF_W) + 1;              // 물 바로 동쪽 첫 칸
      for (k = 0; k < SHELL_PATH_WIDTH; k++) { path[(x0 + k) + ',' + ty] = 1; }
    }
    shellPath = path;
  }

  /** 숲 고리에 사물(정령의 터 따위)을 새로 세워도 되는 자리인가 — 마을 안·캠프·동굴·폐허·
   *  우주기지·물·다리와, 그 둘레 두 칸 안은 아니다. 공사(terrain.js)와 무관한 **자연 지형** 기준이라
   *  세이브와 상관없이 늘 같은 답이다 */
  function ringSpotOk(tx, ty) {
    var dx, dy;
    /* 숲 채집 노드('gn…')는 바이옴 칸 한가운데에 선다 — 그 둘레 세 칸은 피한다(노드를 지우지 않는다) */
    var gx = Math.floor(tx / BIOME_CELL) * BIOME_CELL + Math.floor(BIOME_CELL / 2);
    var gy = Math.floor(ty / BIOME_CELL) * BIOME_CELL + Math.floor(BIOME_CELL / 2);
    if (Math.abs(tx - gx) <= 3 && Math.abs(ty - gy) <= 3) { return false; }
    for (dy = -2; dy <= 2; dy += 2) {
      for (dx = -2; dx <= 2; dx += 2) {
        var x = tx + dx, y = ty + dy;
        if (x >= -1 && y >= -1 && x <= W && y <= H) { return false; }
        if (inHamlet(x, y) || inHamlet2(x, y) || inCave(x, y) || inRuin(x, y) || inSpaceBase(x, y)) { return false; }
        if (inLake(x, y) || inRiver(x, y) || inBridge(x, y)) { return false; }
      }
    }
    return true;
  }

  function tileAt(tx, ty) {
    var t = tileBase(tx, ty);
    if (shellPath && GRASS_FAMILY[t] && shellPath[tx + ',' + ty]) {
      var s = st();
      if (!(s.terrain && s.terrain[tx + ',' + ty])) { return 'sand'; }   // 사람이 고친 칸은 그 사람 것
    }
    return t;
  }

  function tileBase(tx, ty) {
    var s = st();
    /* 사람이 고친 칸이 먼저다 (`terrain.js` 의 공사). 안 고친 마을은 이 표가 비어 있어
       예전 그대로 해시로 풀린다 — 세이브가 늘지 않는 까닭이 이것이다 */
    if (s.terrain) {
      var ov = s.terrain[tx + ',' + ty];
      if (ov) { return ov; }
    }
    if (tx >= 0 && ty >= 0 && tx < W && ty < H) {
      var h = core.hash2(tx + s.seed % 977, ty + (s.seed >> 7) % 883);
      /* 가운데 가로로 흙길, 아래쪽에 못(물) */
      if (ty === Math.floor(H * 0.5)) { return 'path'; }
      if (tx === Math.floor(W * 0.5)) { return 'path'; }
      if (ty >= H - 4 && tx > 3 && tx < 11) { return h > 0.22 ? 'water' : 'sand'; }
      if (ty >= H - 5 && tx > 2 && tx < 13) { return 'sand'; }
      return 'grass';
    }
    /* 마을 밖 — 숲 고리(PLAN 11절 Biome 로 갈린 잔디, PLAN 12절 고정 호수·강)
       아니면 세상 끝(물) */
    var m = forestMargin();
    if (tx < -m || ty < -m || tx >= W + m || ty >= H + m) { return 'water'; }
    if (inBridge(tx, ty)) { return 'path'; }              // 강을 건너는 유일한 자리
    if (inLake(tx, ty) || inRiver(tx, ty)) { return 'water'; }
    /* 우주기지(PLAN 45절) — 다른 다섯 고정 자리는 바이옴 잔디 그대로인데,
       여기만 "착륙장" 느낌을 주려 이미 있는 'sand' 타일을 빌린다(새 타일
       종류를 안 늘렸다 — TILES·terrainColors() 둘 다 손 안 댔다) */
    if (inSpaceBase(tx, ty)) { return 'sand'; }
    return BIOME_TILE[biomeAt(tx, ty)];
  }

  /* ── 집 안 / 살금살금 ─────────────────────────────────────
   * 집에 들어가면 **같은 player 객체가 방 좌표를 쓴다**. 걷기·바라보는 쪽·걸음 위상을
   * 그대로 물려받으려면 이 편이 낫다 — 밖의 자리는 outPos 에 넣어 두었다가 되돌린다.
   */
  var indoors = false;
  var caveIn = false;          // 동굴 안 — indoors 와 같은 자리(outPos)를 쓰되 서로 안 겹친다
  var outPos = null;
  var sneakOn = false;         // 🐾 단추. Shift 를 누르고 있어도 같다
  var autoSneak = false;       // 자동이 벌레에 다가갈 때만 켠다 (사용자 설정을 건드리지 않는다)

  function inside() { return indoors; }

  function sneaking() { return !!(sneakOn || keys.shift || autoSneak); }

  /** 자동 전용 — 사용자가 누른 🐾 와 섞이지 않게 칸을 따로 둔다 */
  function setAutoSneak(v) { autoSneak = !!v; }

  function toggleSneak() {
    sneakOn = !sneakOn;
    core.emit('changed');
    return sneakOn;
  }

  function enterHome() {
    if (indoors || caveIn) { return null; }
    var d = global.DG.home.door();
    outPos = { x: player.x, y: player.y };
    indoors = true;
    target = null;
    player.x = d.x; player.y = d.y - TILE * 0.6;
    core.emit('village:home', { inside: true });
    core.emit('changed');
    return { kind: 'home', text: '🏠 집에 들어왔다 — 문 앞에서 손을 쓰면 나갑니다' };
  }

  function leaveHome() {
    if (!indoors) { return null; }
    indoors = false;
    target = null;
    if (outPos) { player.x = outPos.x; player.y = outPos.y; }
    outPos = null;
    core.emit('village:home', { inside: false });
    core.emit('changed');
    core.persist();
    return { kind: 'home', text: '🏠 밖으로 나왔다' };
  }

  function walkable(x, y) {
    if (caveIn) {
      var cr = caveRoom();
      return x > 8 && y > 30 && x < cr.w - 8 && y < cr.h - 6;
    }
    if (indoors) {
      /* 방 안 — 벽에 붙지 않게 안쪽으로 조금 물린다. 위쪽은 뒷벽이 서 있다 */
      var r = global.DG.home.room();
      return x > 8 && y > 30 && x < r.w - 8 && y < r.h - 6;
    }
    var t = tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
    return VD.TILES[t] && VD.TILES[t].walk;
  }

  /**
   * 사물 배치 — 해시로 정하므로 늘 같은 마을이다.
   *
   * id 는 **자리**로 짓는다(`p<tx>_<ty>`). 순번으로 지으면 공사(`terrain.js`)로
   * 사물이 하나 생기거나 사라질 때 뒤 번호가 전부 밀려, 오늘 이미 딴 표시(`used`)가
   * 엉뚱한 나무에 붙는다.
   */
  function buildProps() {
    var s = st();
    props = [];
    computeShellPath();          // 아래 타일 순회보다 먼저 — 조개 길이 깔린 자리는 사물이 안 선다
    core.emit('village:terrain'); // 땅이 바뀌었을 수 있다 — 3D 지면 캐시(제자리 idle)를 털게 한다
    var tx, ty;
    for (ty = 0; ty < H; ty++) {
      for (tx = 0; tx < W; tx++) {
        var t = tileAt(tx, ty);
        var h = core.hash2(tx * 31 + s.seed % 613, ty * 17 + s.seed % 419);
        /* 갈라진 자리와 조개는 **날짜를 섞은 해시**로 정한다 — 원작처럼 아침마다
           자리가 바뀐다. 그래서 마을을 한 바퀴 도는 일이 날마다 새로 생긴다 */
        var hd = core.hash2(tx * 53 + s.day % 991, ty * 29 + (s.day * 7) % 877);
        var x = tx * TILE + TILE * 0.5, y = ty * TILE + TILE * 0.5;
        var pid = 'p' + tx + '_' + ty;
        if (t === 'grass' && !(global.DG.festival && global.DG.festival.blocked(tx, ty))) {
          if (h > 0.93) { props.push({ id: pid, kind: 'tree', x: x, y: y }); }
          else if (h > 0.90) { props.push({ id: pid, kind: 'pine', x: x, y: y }); }
          else if (h > 0.875) { props.push({ id: pid, kind: 'rock', x: x, y: y }); }
          else if (h > 0.845) { props.push({ id: pid, kind: 'flower', x: x, y: y }); }
          else if (hd > 0.974) { props.push({ id: pid, kind: 'dig', x: x, y: y }); }
        } else if (t === 'sand') {
          if (h > 0.80) { props.push({ id: pid, kind: 'spot', x: x, y: y }); }
          else if (hd > 0.86) { props.push({ id: pid, kind: 'shell', x: x, y: y }); }
        }
      }
    }
    /* 마을 건물 — 가운데 길가에 고정으로 둔다 (찾기 쉬워야 한다) */
    var cx = Math.floor(W * 0.5), cy = Math.floor(H * 0.5);
    props.push({ id: 'shop', kind: 'shop', x: (cx - 3) * TILE + 20, y: (cy - 1) * TILE + 20 });
    props.push({ id: 'board', kind: 'board', x: cx * TILE + 20, y: (cy + 1) * TILE + 20 });
    /* 내 집과 우편함은 나란히 둔다 — 원작에서도 우편함은 집 앞에 있다 */
    props.push({ id: 'home', kind: 'home', x: (cx + 3) * TILE + 20, y: (cy - 1) * TILE + 20 });
    props.push({ id: 'mail', kind: 'mail', x: (cx + 3) * TILE + 20, y: (cy + 1) * TILE + 6 });
    props.push({ id: 'tailor', kind: 'tailor',
                 x: (cx - 3) * TILE + 20, y: (cy + 2) * TILE + 20 });
    props.push({ id: 'pole', kind: 'pole', x: (cx + 1) * TILE + 20, y: (cy + 1) * TILE + 14 });
    /* 잡초 — 세이브에 자리가 남는다. 안 뽑으면 날마다 는다 */
    var wd = s.weeds || [];
    for (var wi = 0; wi < wd.length; wi++) {
      props.push({ id: 'wd' + wi, kind: 'weed', x: wd[wi].x, y: wd[wi].y });
    }
    /* 사고(史庫) — 전방 건너편. 기증은 이 앞에서만 받는다 */
    props.push({ id: 'museum', kind: 'museum', x: (cx - 6) * TILE + 20, y: (cy + 1) * TILE + 20 });

    /* 번들 시설(PLAN §5.3, 2026-09-17①) — 사고 갈래(museum.byCat())를 다
       채우면 그 갈래에 배정된 시설(VD.BUNDLES)이 마을에 고정으로 선다.
       캠프·museum 과 같은 결로 **해시가 아니라 세이브 조건부 고정 자리**다
       — 완결이 풀리면(예: 팔아서 다시 갈래가 안 채워지는 일은 없다, donated
       는 한 번 들이면 안 지워진다) 계속 서 있는다. 호수·강 기반 자리는
       `lakeCenter()`가 null(고리가 좁아 호수를 포기한 판)이면 같이 건너뛴다. */
    var MU5_3 = global.DG.museum;
    if (MU5_3) {
      var byc5_3 = MU5_3.byCat(), lc5_3 = lakeCenter();
      for (var bci5_3 = 0; bci5_3 < byc5_3.length; bci5_3++) {
        var bc5_3 = byc5_3[bci5_3];
        if (bc5_3.total <= 0 || bc5_3.done < bc5_3.total) { continue; }
        var bd5_3 = VD.BUNDLES[bc5_3.cat.key];
        if (!bd5_3) { continue; }
        if (bd5_3.facility === 'stele') {
          props.push({ id: 'bundle_fossil', kind: 'stele',
            x: (cx - 6) * TILE - 26, y: (cy + 1) * TILE + 20 });
        } else if (bd5_3.facility === 'fireflyplot') {
          props.push({ id: 'bundle_bug', kind: 'fireflyplot',
            x: (cx + 2) * TILE + 20, y: (cy + 2) * TILE + 20 });
        } else if (bd5_3.facility === 'bench' && lc5_3) {
          props.push({ id: 'bundle_fish', kind: 'bench',
            x: (lc5_3.tx + lc5_3.r * 1.6 + 1) * TILE + TILE * 0.5,
            y: lc5_3.ty * TILE + TILE * 0.5 });
        } else if (bd5_3.facility === 'shell' && lc5_3) {
          var srx5_3 = riverCenterX(lc5_3.ty - 2);
          if (srx5_3 !== null) {
            props.push({ id: 'bundle_shell0', kind: 'shell',
              x: (srx5_3 + RIVER_HALF_W + 0.6) * TILE + TILE * 0.5, y: (lc5_3.ty - 2) * TILE + TILE * 0.5 });
            props.push({ id: 'bundle_shell1', kind: 'shell',
              x: (srx5_3 + RIVER_HALF_W + 0.6) * TILE + TILE * 0.5, y: (lc5_3.ty - 1) * TILE + TILE * 0.5 });
          }
        }
      }
    }

    /* 숲 고리(PLAN 40절 PHASE 3 "넓은 Forest Map" + PLAN 11절 Biome) — 마을 밖에
       바이옴을 따라 사물을 흩뿌린다. id 접두 'f' 로 마을 것('p'..)과 겹치지 않게
       가른다.
       **`deco:true`로 채집 대상에서는 뺀다** — 이번 단계는 "걸어 나갈 공간"만
       여는 것이지 자원을 늘리는 게 아니다(PLAN 40절 PHASE 4 "Gathering" 몫).
       실제로 뺀 것을 안 하면 `focus()`·`auto.js`가 새로 생긴 수천 그루를 진짜
       채집 대상으로 삼아 하루 벌이가 몇 배로 뛴다 — 자가진단으로 잡았다 */
    var m = forestMargin();
    var SPI = global.DG.spirit, GRD = global.DG.grid;
    for (ty = -m; ty < H + m; ty++) {
      for (tx = -m; tx < W + m; tx++) {
        if (tx >= 0 && ty >= 0 && tx < W && ty < H) { continue; }   // 마을 안은 위에서 이미 채웠다
        if (inHamlet(tx, ty)) { continue; }                         // 작은 마을 자리는 비워 둔다
        if (inHamlet2(tx, ty)) { continue; }                        // 두 번째 캠프 자리도 비워 둔다
        if (inCave(tx, ty)) { continue; }                           // 동굴 자리도 비워 둔다
        if (inRuin(tx, ty)) { continue; }                           // 폐허 자리도 비워 둔다
        if (inSpaceBase(tx, ty)) { continue; }                      // 우주기지 자리도 비워 둔다
        if (!GRASS_FAMILY[tileAt(tx, ty)]) { continue; }            // 공사로 딴 걸 깔았으면 스킵
        if (SPI && SPI.blocked(tx, ty)) { continue; }               // 정령의 터 둘레는 비워 둔다(PLAN §5.5)
        if (GRD && GRD.blocked(tx, ty)) { continue; }               // 격자 만남 둘레도 비워 둔다(PLAN §5.5 ①)
        if (global.DG.visitor && global.DG.visitor.blocked(tx, ty)) { continue; }   // 방문객 조각 자리(§5.9)
        var fh = core.hash2(tx * 31 + s.seed % 613 + 2000, ty * 17 + s.seed % 419 + 2000);
        var fx = tx * TILE + TILE * 0.5, fy = ty * TILE + TILE * 0.5;
        var fid = 'f' + tx + '_' + ty;
        if ((nearLakeShore(tx, ty) || nearRiverBank(tx, ty)) && fh > 0.55) {
          props.push({ id: fid, kind: 'plant', x: fx, y: fy, deco: true });
          continue;
        }
        var table = BIOME_SCATTER[biomeAt(tx, ty)] || BIOME_SCATTER.green;
        for (var bi = 0; bi < table.length; bi++) {
          if (fh > table[bi][0]) { props.push({ id: fid, kind: table[bi][1], x: fx, y: fy, deco: true }); break; }
        }
      }
    }

    /* 숲의 정령 60(PLAN §5.5 ②) — 터 표지는 고리 사물이 다 선 뒤에 얹는다(둘레 두 칸은 위에서 비웠다).
       푼 터는 deco(손이 안 닿는 자국), 안 푼 터는 손이 닿아 수수께끼가 시작된다 */
    if (SPI) { Array.prototype.push.apply(props, SPI.marks()); }
    /* 발견 밀도 격자(PLAN §5.5 ①) — 20타일 칸마다 상자·쪽지 병·채집터·야영 하나. 짐승 무리는 buildAnimals() 몫 */
    if (GRD) { Array.prototype.push.apply(props, GRD.marks()); }
    /* 축제 하루(PLAN §5.6) — 행사날에만 서는 안내판·놀이 소품 */
    if (global.DG.festival) { Array.prototype.push.apply(props, global.DG.festival.marks()); }
    /* 떠돌이 방문객(PLAN §5.9) — 선원·도깨비불 날엔 바깥 숲에 조각 다섯 */
    if (global.DG.visitor) { Array.prototype.push.apply(props, global.DG.visitor.marks()); }

    /* 다리(2026-09-09) — 마을 도로와 같은 줄(BRIDGE_TY)에 실제로 건널 수 있는
       자리가 생겼으니, `Bridge.glb`(2026-08-30부터 등록만 되고 안 쓰이던 것)를
       그 위에 세운다. tileAt() 이 이미 그 칸을 'path'로 내주므로 GRASS_FAMILY
       가 아니라 바이옴 장식·채집·짐승이 저절로 안 겹친다(위 루프가 이미
       걸러 준다) */
    var br = riverCenterX(BRIDGE_TY);
    if (br !== null) {
      props.push({ id: 'bridge', kind: 'bridge',
        x: Math.round(br) * TILE + TILE * 0.5, y: BRIDGE_TY * TILE + TILE * 0.5, deco: true });
    }

    /* 폭포 표지(PLAN 40절 PHASE 3 다섯 번째 칸) — 강이 있을 때만, 늘 같은 자리.
       좌우에 기존 rock 렌더(3D 모델도 이미 등록돼 있다)를 세워 여울처럼 보이게
       한다 — 새 3D 코드 없이 마크만 남긴다 */
    var wf = waterfallSpot();
    if (wf) {
      var wx = wf.tx * TILE + TILE * 0.5, wy = wf.ty * TILE + TILE * 0.5;
      props.push({ id: 'waterfall', kind: 'waterfall', x: wx, y: wy, deco: true });
      props.push({ id: 'waterfallRockL', kind: 'rock', x: wx - TILE * 0.9, y: wy - TILE * 0.25, deco: true });
      props.push({ id: 'waterfallRockR', kind: 'rock', x: wx + TILE * 0.9, y: wy + TILE * 0.2, deco: true });
    }

    /* 작은 마을(PLAN 40절 PHASE 3 여섯 번째 칸) — 캠프 하나. 상인(merchant) NPC는
       buildNpcs() 가 세운다(PHASE 4). **2026-09-09 — 오두막(hamletHouse) 신설**,
       House_1~4.glb(그동안 미사용, ASSET_LICENSES.md)를 처음 쓴다. 상인 뒤(더
       북쪽)에 세워 "지나가다 만나는 빈 캠프"였던 곳이 "누가 사는 캠프"로 보이게
       한다 — 위성 마을·집 다양화를 미뤄 둔 첫 걸음(README 2026-09-09 마을 3D
       건물 항목 참고). **같은 날 이어서 — 움집(hamletHut, House_1) 한 채 더**,
       "상인 혼자 사는 오두막"에서 "여럿이 지내는 움집들"로 늘렸다. **또
       이어서 — 흙집(hamletShed, House_3) 한 채 더**(사용자 지시로 이 캠프에
       계속 얹었다, House_4만 남는다) */
    var hs = hamletSpot();
    if (hs) {
      var hx = hs.tx * TILE + TILE * 0.5, hy = hs.ty * TILE + TILE * 0.5;
      props.push({ id: 'hamletTentA', kind: 'tent', x: hx - TILE * 1.4, y: hy - TILE * 0.6, deco: true });
      props.push({ id: 'hamletTentB', kind: 'tent', x: hx + TILE * 1.2, y: hy - TILE * 0.8, deco: true });
      props.push({ id: 'hamletFire', kind: 'campfire', x: hx, y: hy, deco: true });
      props.push({ id: 'hamletBenchA', kind: 'bench', x: hx - TILE * 0.6, y: hy + TILE * 0.7, deco: true });
      props.push({ id: 'hamletBenchB', kind: 'bench', x: hx + TILE * 0.6, y: hy + TILE * 0.7, deco: true });
      props.push({ id: 'hamletWell', kind: 'well', x: hx + TILE * 1.6, y: hy + TILE * 0.4, deco: true });
      props.push({ id: 'hamletLanternA', kind: 'lantern', x: hx - TILE * 1.8, y: hy + TILE * 0.2, deco: true });
      props.push({ id: 'hamletLanternB', kind: 'lantern', x: hx + TILE * 1.8, y: hy - TILE * 0.2, deco: true });
      props.push({ id: 'hamletHouse', kind: 'hamletHouse', x: hx - TILE * 0.2, y: hy - TILE * 1.9, deco: true });
      props.push({ id: 'hamletHut', kind: 'hamletHut', x: hx + TILE * 2.4, y: hy - TILE * 1.3, deco: true });
      props.push({ id: 'hamletShed', kind: 'hamletShed', x: hx - TILE * 2.6, y: hy + TILE * 1.5, deco: true });
    }

    /* 두 번째 캠프(PLAN 10절 "고정 배치", 2026-09-09) — 첫 캠프보다 작고
       수수하다. House_4를 이번에 처음 쓴다 — 이걸로 House_1~4 넷을 다
       썼다. 사람은 아직 없다(첫 캠프의 상인처럼 나중 몫) */
    var hs2 = hamlet2Spot();
    if (hs2) {
      var h2x = hs2.tx * TILE + TILE * 0.5, h2y = hs2.ty * TILE + TILE * 0.5;
      props.push({ id: 'hamlet2Tent', kind: 'tent', x: h2x - TILE * 1.1, y: h2y - TILE * 0.5, deco: true });
      props.push({ id: 'hamlet2Fire', kind: 'campfire', x: h2x, y: h2y, deco: true });
      props.push({ id: 'hamlet2Bench', kind: 'bench', x: h2x + TILE * 0.6, y: h2y + TILE * 0.6, deco: true });
      props.push({ id: 'hamlet2Lantern', kind: 'lantern', x: h2x - TILE * 1.3, y: h2y + TILE * 0.3, deco: true });
      props.push({ id: 'hamlet2House', kind: 'hamlet2House', x: h2x + TILE * 0.2, y: h2y - TILE * 1.6, deco: true });
    }

    /* 폐허(PLAN 10절 "고정 배치", 2026-09-10 — "시대 혼합 소품·폐허" 퓨전
       방향). 무너진 아치 하나 + 이끼바위 둘로 "옛날에 뭔가 있었던 자리"
       느낌만 준다 — 전부 순수 장식(deco:true), 상호작용은 없다.
       **2026-09-11 확장(PLAN 46-2절)** — §45가 제안했던 "과거" 목적지를
       이 자리에 실제로 채웠다: 진짜 탑성 폐허(ruinTower, saga-go에서
       하드링크한 사진측량 스캔)를 아치 뒤에 세우고, 정자(gazebo)를 앞에
       놓아 "무너진 성터를 나그네가 지나가다 쉬어 가는" 자리로 마무리했다.
       기존 인터랙션 자리(inRuin 5×4칸)를 안 넓혔다 — 전부 그 안에 들어간다 */
    var rs = ruinSpot();
    if (rs) {
      var rx = rs.tx * TILE + TILE * 0.5, ry = rs.ty * TILE + TILE * 0.5;
      props.push({ id: 'ruinArch', kind: 'ruinArch', x: rx, y: ry, deco: true });
      props.push({ id: 'ruinRockL', kind: 'mossyRock', x: rx - TILE * 1.3, y: ry + TILE * 0.4, deco: true });
      props.push({ id: 'ruinRockR', kind: 'mossyRock', x: rx + TILE * 1.4, y: ry + TILE * 0.3, deco: true });
      props.push({ id: 'ruinTower', kind: 'ruinTower', x: rx - TILE * 0.3, y: ry - TILE * 0.9, deco: true });
      props.push({ id: 'ruinGazebo', kind: 'gazebo', x: rx + TILE * 0.5, y: ry + TILE * 0.8, deco: true });
      /* 돌무더기 여섯 — 탑성 조각(사고 갈래 ruin)이 나오는 손이 닿는 자리. 위 장식과 안 겹치게 잡았고 하루 한 번씩 뒤진다 */
      [[-2.6, -0.4], [-0.6, 1.7], [2.5, 0.9], [1.9, -0.9], [-1.2, -1.6], [0.6, -1.7]].forEach(function (o, i) {
        props.push({ id: 'ruinRubble' + i, kind: 'rubble', x: rx + o[0] * TILE, y: ry + o[1] * TILE });
      });
    }

    /* 숨겨진 동굴(PLAN 40절 PHASE 3 마지막 칸 + PHASE 4 "Treasure") — 바위산·
       이끼바위 둘은 여전히 순수 장식(deco:true)이지만, **입구(caveMouth)는
       이제 손이 닿는다**(PHASE 3 때는 표지만이라 deco:true였다 — focus()가
       deco 사물은 거르므로, 안까지 여는 지금은 이 한 줄만 빼면 된다) */
    var cs = caveSpot();
    if (cs) {
      var cvx = cs.tx * TILE + TILE * 0.5, cvy = cs.ty * TILE + TILE * 0.5;
      props.push({ id: 'caveMount', kind: 'mountain', x: cvx, y: cvy - TILE * 0.4, deco: true });
      props.push({ id: 'caveRockL', kind: 'mossyRock', x: cvx - TILE * 0.7, y: cvy + TILE * 0.5, deco: true });
      props.push({ id: 'caveRockR', kind: 'mossyRock', x: cvx + TILE * 0.7, y: cvy + TILE * 0.5, deco: true });
      props.push({ id: 'caveMouth', kind: 'cave', x: cvx, y: cvy + TILE * 0.8 });
    }

    /* 우주기지(PLAN 45절, 2026-09-11) — 남서 먼 대각선. 새 GLB를 안 받고
       이미 있는(다른 자리에서 쓰거나 등록만 되어 있던) 모델만 빌렸다 —
       crate는 mail 상자와 같은 box_small.gltf.glb, fence·cart는 asset3d.js
       에 진작 등록만 되고 여태 3D scatter에 안 이어져 있던 것을 처음 쓴다
       (다리(bridge)가 그랬던 것과 같은 결). 배달원(courier)은
       buildNpcs()가 세운다(다른 다섯 NPC와 같은 순서) */
    var sb = spaceBaseSpot();
    if (sb) {
      var sbx = sb.tx * TILE + TILE * 0.5, sby = sb.ty * TILE + TILE * 0.5;
      props.push({ id: 'spaceCrateA', kind: 'crate', x: sbx - TILE * 1.2, y: sby - TILE * 0.5, deco: true });
      props.push({ id: 'spaceCrateB', kind: 'crate', x: sbx - TILE * 0.6, y: sby - TILE * 1.0, deco: true });
      props.push({ id: 'spaceFence', kind: 'fence', x: sbx + TILE * 1.6, y: sby + TILE * 0.2, deco: true });
      props.push({ id: 'spaceCart', kind: 'cart', x: sbx + TILE * 0.9, y: sby - TILE * 1.1, deco: true });
      props.push({ id: 'spaceLantern', kind: 'lantern', x: sbx - TILE * 1.7, y: sby + TILE * 0.6, deco: true });
      /* 우주기지 확충(2026-09-14, PLAN 46-3절 "다음에 이어갈 것" — asset3d.js
         의 BLD_SPACE 주석 참고) — 이 팩 자체의 건물·로버·메카를 처음 얹는다.
         전부 deco:true(순전히 장식, 새 상호작용 없음), 위 다섯 개·배달원
         (courier, sb 중심 + 0.4칸)과 안 겹치게 7×7 자리(inSpaceBase) 안에서
         자리를 나눠 잡았다 */
      props.push({ id: 'spaceBase', kind: 'spaceBase', x: sbx - TILE * 0.3, y: sby - TILE * 2.4, deco: true });
      props.push({ id: 'spaceHouse', kind: 'spaceHouse', x: sbx - TILE * 2.5, y: sby - TILE * 0.3, deco: true });
      props.push({ id: 'spaceDome', kind: 'spaceDome', x: sbx + TILE * 2.6, y: sby - TILE * 0.7, deco: true });
      props.push({ id: 'spaceSolar', kind: 'solarPanel', x: sbx - TILE * 0.9, y: sby - TILE * 1.7, deco: true });
      /* 배달 등급 60건 이상이면 탐사차에 앉아 볼 수 있다(PLAN §5.7 "탑승" 암시) */
      props.push({ id: 'spaceRover', kind: 'rover', x: sbx + TILE * 1.8, y: sby + TILE * 1.8,
                   deco: !(global.DG.parcel && global.DG.parcel.grade() >= 3) });
      props.push({ id: 'spaceMech', kind: 'mech', x: sbx - TILE * 2.2, y: sby + TILE * 1.7, deco: true });
    }

    /* 택배 접수대(PLAN 45절) — 우편함(mail) 곁, 마을 안. 우편함과 다른
       kind라 mail.js의 편지·이사 상태를 건드리지 않는다 — village.js
       자체 상태(st().delivery)만 쓴다 */
    props.push({ id: 'courierPost', kind: 'courierPost', x: (cx + 3) * TILE + 20, y: (cy + 1) * TILE + 46 });
    /* 택배 사슬(PLAN §5.7) — 폐허의 옛 우체통(폐허행 소포를 넣는 곳)과, 배달 10건부터 내 집 앞에 서는 수레 */
    var rsp = ruinSpot();
    if (rsp) {
      props.push({ id: 'oldpost', kind: 'oldpost', x: rsp.tx * TILE + TILE * 0.5 - TILE * 1.9, y: rsp.ty * TILE + TILE * 0.5 + TILE * 0.9 });
    }
    if (global.DG.parcel && global.DG.parcel.grade() >= 1) {
      props.push({ id: 'deliveryCart', kind: 'cart', x: (cx + 3) * TILE + 20 + TILE * 1.4, y: (cy - 1) * TILE + 20 + TILE * 0.9, deco: true });
    }

    /* 숲 고리 real 채집 자원(PLAN 18절 "채집" · PLAN 40절 PHASE 4 "Gathering") —
       위 숲 고리 사물은 전부 deco:true(장식)라 채집이 안 된다(PHASE 3 몫은
       "걸어 나갈 공간"만 여는 것이었다). 여기서부터가 그 다음 몫이다.
       **animal.js 와 같은 성긴 격자**(BIOME_CELL 칸마다 많아야 하나)에만
       심는다 — 조밀한 장식 격자(위 for 문)와 같은 밀도로 늘리면 2026-08-31에
       잡혔던 하루벌이 폭증(수천 그루 × 채집)이 되풀이된다. id 접두 'gn'
       (gather node)으로 장식('f')·마을('p') 어느 쪽과도 안 겹친다. */
    var FOREST_GATHER_KIND = { green: 'tree', meadow: 'flower', dark: 'pine', mushroom: 'herb', rocky: 'rock' };
    var gcxMin = Math.floor(-m / BIOME_CELL), gcxMax = Math.ceil((W + m) / BIOME_CELL);
    var gcyMin = Math.floor(-m / BIOME_CELL), gcyMax = Math.ceil((H + m) / BIOME_CELL);
    for (var gcy = gcyMin; gcy <= gcyMax; gcy++) {
      for (var gcx = gcxMin; gcx <= gcxMax; gcx++) {
        var gtx = gcx * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        var gty = gcy * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        if (!(gtx >= -m && gty >= -m && gtx < W + m && gty < H + m)) { continue; }
        if (gtx >= 0 && gty >= 0 && gtx < W && gty < H) { continue; }     // 마을 안은 기존 사물 몫
        if (inHamlet(gtx, gty) || inHamlet2(gtx, gty) || inCave(gtx, gty) || inRuin(gtx, gty) ||
            inSpaceBase(gtx, gty)) { continue; }
        if (!GRASS_FAMILY[tileAt(gtx, gty)]) { continue; }
        var ggate = core.hash2(gcx * 271 + s.seed % 503, gcy * 337 + (s.seed >> 5) % 467);
        if (ggate > 0.55) { continue; }                                  // animal.js 와 같은 문턱 — 45%만
        var gkind = FOREST_GATHER_KIND[biomeAt(gtx, gty)];
        if (!gkind) { continue; }
        props.push({ id: 'gn' + gcx + '_' + gcy, kind: gkind,
                     x: gtx * TILE + TILE * 0.5, y: gty * TILE + TILE * 0.5 });
      }
    }
    /* 별 우체통(정본 트랙 메모 "별 우체통 장식 하나") — 이야기 겨울 대보름(wi_moon)을 마치면 광장 곁에 선다. 세이브 조건부 고정 자리(번들 시설과 같은 결) */
    var scn_sp = st().scenario;
    if (scn_sp && scn_sp.done && scn_sp.done.wi_moon) {
      var spOff = [[3, -3], [4, -2], [-3, -3], [4, 3], [-4, 3], [2, -4], [5, 0], [-5, -1]], spBest = null, spi, spj;
      for (spi = 0; spi < spOff.length && !spBest; spi++) {                // 다른 소품(나무·집 …)에서 1.4칸 이상 떨어진 첫 자리
        var spx = (cx + spOff[spi][0]) * TILE + 20, spy = (cy + spOff[spi][1]) * TILE + 20, spOk = true;
        for (spj = 0; spj < props.length; spj++) { if (Math.hypot(props[spj].x - spx, props[spj].y - spy) < TILE * 1.4) { spOk = false; break; } }
        if (spOk) { spBest = { x: spx, y: spy }; }
      }
      if (!spBest) { spBest = { x: (cx + 3) * TILE + 20, y: (cy - 3) * TILE + 20 }; }
      props.push({ id: 'starpost', kind: 'starpost', x: spBest.x, y: spBest.y });
    }
    /* 다시 쌓은 정자(다섯째 번들 ruin) — 탑성 조각 갈래를 다 채우면 광장 곁 빈자리에 선다. 별 우체통과 같은 결의 세이브 조건부 고정 자리 */
    var MU_RB = global.DG.museum;
    if (MU_RB && MU_RB.catStatus) {
      var rbSt = MU_RB.catStatus('ruin');
      if (rbSt.total > 0 && rbSt.done >= rbSt.total) {
        var rbOff = [[-3, 3], [-4, -3], [5, -3], [-5, 1], [3, 4], [-2, -4], [5, 3], [-6, -1]], rbBest = null, rbi, rbj;
        for (rbi = 0; rbi < rbOff.length && !rbBest; rbi++) {
          var rbx = (cx + rbOff[rbi][0]) * TILE + 20, rby = (cy + rbOff[rbi][1]) * TILE + 20, rbOk = true;
          for (rbj = 0; rbj < props.length; rbj++) { if (Math.hypot(props[rbj].x - rbx, props[rbj].y - rby) < TILE * 1.6) { rbOk = false; break; } }
          if (rbOk) { rbBest = { x: rbx, y: rby }; }
        }
        if (!rbBest) { rbBest = { x: (cx - 3) * TILE + 20, y: (cy + 3) * TILE + 20 }; }
        props.push({ id: 'bundle_ruin', kind: 'rebuilt', x: rbBest.x, y: rbBest.y });
      }
    }
  }

  /* ── 심기 ─────────────────────────────────────────────────
   * 원작에서 과일을 묻으면 나무가 되는 그 자리다.
   * 심은 것은 세이브에 남고, 사흘이 지나면 묘목이 자란다.
   *   열매 → 나무 · 밤/잣 → 소나무 · 꽃 → 꽃
   * 캐거나 낚은 것은 심을 수 없다(광물·물고기).
   */

  var PLANT_DAYS = core.tuned('plant.days', 3);
  var PLANT_KIND = { fruit: 'tree', nut: 'pine', flower: 'flower' };

  /** 심은 것을 사물 목록에 반영한다 — 다 자랐으면 나무로, 아직이면 묘목으로 */
  function syncPlanted() {
    var s = st();
    if (!s.planted) { s.planted = []; }
    /* 심어 둔 것만 걷어내고 다시 넣는다 (원래 있던 사물은 건드리지 않는다) */
    props = props.filter(function (pr) { return pr.id.indexOf('pl') !== 0; });
    for (var i = 0; i < s.planted.length; i++) {
      var rec = s.planted[i];
      var grown = (s.day - rec.day) >= PLANT_DAYS;
      props.push({
        id: 'pl' + i, kind: grown ? rec.kind : 'sapling',
        x: rec.x, y: rec.y, planted: true,
        leftDays: Math.max(0, PLANT_DAYS - (s.day - rec.day))
      });
    }
    markHybrids();
  }

  /**
   * 꽃 교배 — **심은 꽃 곁에 다른 꽃이 있으면** 드문 색이 핀다.
   * 원작에서 꽃을 나란히 심어 두던 그 자리다.
   *
   * 판정은 **자리 해시**로 한다(무작위가 아니다). 그래야 심어 놓고 사흘 뒤에 와도
   * 같은 결과가 나오고, 어디에 심을지가 놀이가 된다.
   */
  var HYBRID_NEAR = TILE * 1.6;

  function markHybrids() {
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (!p.planted || p.kind !== 'flower') { continue; }
      var near = 0;
      for (var j = 0; j < props.length; j++) {
        if (j === i || props[j].kind !== 'flower') { continue; }
        if (Math.hypot(props[j].x - p.x, props[j].y - p.y) <= HYBRID_NEAR) { near++; }
      }
      p.hybrid = near > 0 && core.hash2(Math.round(p.x), Math.round(p.y)) > 0.45;
    }
  }

  /** 지금 자리에 심을 수 있나 (풀밭이어야 하고, 곁에 다른 사물이 없어야 한다) */
  function canPlantHere() {
    var t = tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (t !== 'grass') { return { ok: false, why: '풀밭에만 심을 수 있습니다' }; }
    for (var i = 0; i < props.length; i++) {
      if (Math.hypot(props[i].x - player.x, props[i].y - player.y) < TILE * 0.9) {
        return { ok: false, why: '너무 붙어 있습니다' };
      }
    }
    return { ok: true };
  }

  /** 가방의 것 하나를 심는다 */
  function plant(key) {
    var s = st(), it = VD.item(key);
    if (!it) { return null; }
    if (bagCount(key) < 1) { return { kind: 'no', text: '가진 것이 없습니다' }; }
    var kind = PLANT_KIND[it.cat];
    if (!kind) {
      return { kind: 'no', text: it.name + '은(는) 심을 수 없습니다 (열매·씨앗·꽃만)' };
    }
    var spot = canPlantHere();
    if (!spot.ok) { return { kind: 'no', text: spot.why }; }

    s.bag[key] -= 1;
    if (!s.planted) { s.planted = []; }
    s.planted.push({ x: player.x, y: player.y, kind: kind, day: s.day, from: key });
    syncPlanted();
    core.gainFeat(2, '심기');
    core.log('🌱 ' + it.name + ' 을 심었다 — ' + PLANT_DAYS + '일 뒤에 자랍니다', 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'plant', text: '🌱 ' + it.name + ' 을 심었다 (' + PLANT_DAYS + '일)' };
  }

  /** 심을 수 있는 가방 항목만 */
  function plantable() {
    return bagList().filter(function (e) { return !!PLANT_KIND[e.item.cat]; });
  }

  /** 주민 — 처음 들어올 때 다섯 명이 이사 와 있다 */
  function buildResidents() {
    var s = st();
    if (!s.residents.length) {
      var pool = global.DG.data.heroes.slice();
      for (var i = 0; i < 5 && pool.length; i++) {
        var idx = Math.floor(Math.random() * pool.length);
        s.residents.push(pool[idx].id);
        pool.splice(idx, 1);
      }
    }
    residents = [];
    for (var j = 0; j < s.residents.length; j++) {
      var h = global.DG.data.find(s.residents[j]);
      if (!h) { continue; }
      /* 자리는 마을 안 고정 좌표 — 주민마다 다른 곳에 선다 */
      var a = core.hash2(j * 131 + 7, s.seed % 331) * Math.PI * 2;
      var r = (0.18 + core.hash2(j * 57, 11) * 0.26) * W * TILE;
      var x = core.clamp(W * TILE * 0.5 + Math.cos(a) * r, TILE, (W - 1) * TILE);
      var y = core.clamp(H * TILE * 0.5 + Math.sin(a) * r * 0.6, TILE, (H - 1) * TILE);
      residents.push({ id: h.id, ref: h, x: x, y: y, facing: 1, phase: j,
                       home: { x: x, y: y }, aim: null });
    }
  }

  /** 짐승 자리 잡기(PLAN 40절 PHASE 4 첫 칸) — BIOME_CELL 한 칸에 한 마리
   *  꼴로, 그 칸 바이옴에 사는 짐승 중 하나를 (좌표+seed 해시로) 고른다.
   *  절반이 넘는 칸은 비워 둔다 — 다 채우면 숲이 동물원이 된다. 마을·
   *  캠프·동굴 자리와 물 위에는 안 세운다. 거동(어슬렁·달아남)은
   *  animal.js 가 매 프레임 맡는다 — 여기서는 **터(home)만** 정한다 */
  function buildAnimals() {
    var s = st();
    animals = [];
    var m = forestMargin();
    var cxMin = Math.floor(-m / BIOME_CELL), cxMax = Math.ceil((W + m) / BIOME_CELL);
    var cyMin = Math.floor(-m / BIOME_CELL), cyMax = Math.ceil((H + m) / BIOME_CELL);
    var cx, cy;
    for (cy = cyMin; cy <= cyMax; cy++) {
      for (cx = cxMin; cx <= cxMax; cx++) {
        var tx = cx * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        var ty = cy * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        if (tx >= -m && ty >= -m && tx < W + m && ty < H + m &&
            !(tx >= 0 && ty >= 0 && tx < W && ty < H) &&
            !inHamlet(tx, ty) && !inHamlet2(tx, ty) && !inCave(tx, ty) && !inRuin(tx, ty) &&
            !inSpaceBase(tx, ty) &&
            GRASS_FAMILY[tileAt(tx, ty)]) {
          var hgate = core.hash2(cx * 211 + s.seed % 701, cy * 179 + (s.seed >> 4) % 659);
          if (hgate > 0.55) { continue; }              // 칸의 절반 넘게는 비워 둔다
          var biome = biomeAt(tx, ty);
          var pool = [], k;
          for (k in VD.ANIMALS) {
            if (VD.ANIMALS.hasOwnProperty(k) && !VD.ANIMALS[k].rare &&
                VD.ANIMALS[k].biomes.indexOf(biome) >= 0) { pool.push(k); }
          }
          if (!pool.length) { continue; }
          var hpick = core.hash2(cx * 97 + 3, cy * 131 + 5);
          var kind = pool[Math.floor(hpick * pool.length) % pool.length];
          /* 몬스터(2026-09-10) — 일반 뽑기 뒤에 아주 드물게만(8%) 덮어쓴다.
             새 난수 스트림 없이 다른 좌표 계수의 hash2 하나만 더 쓴다 —
             기존 hgate·hpick 흐름은 그대로라 여우 등 기존 짐승 수·자리는
             안 흔들린다(그 칸이 몬스터로 바뀔 때만 대신 선다) */
          var monKind = VD.MONSTER_BIOME && VD.MONSTER_BIOME[biome];
          if (monKind) {
            var hmon = core.hash2(cx * 53 + 17 + s.seed % 331, cy * 61 + 29 + (s.seed >> 3) % 293);
            if (hmon < 0.08) { kind = monKind; }
          }
          var wx = tx * TILE + TILE * 0.5, wy = ty * TILE + TILE * 0.5;
          animals.push({ id: 'a' + cx + '_' + cy, kind: kind, x: wx, y: wy,
                         home: { x: wx, y: wy }, facing: 1, state: 'idle', aim: null, pause: 0 });
        }
      }
    }
    /* 우주기지 전용 희귀 몬스터(2026-09-14, PLAN 46-4 "다음에 이어갈 것" —
       Enemy_*, 성간충). 우주기지(spaceBaseSpot)는 BIOME_CELL(22칸)보다 작은
       자리(7×7)라 위 격자 뽑기에는 안 걸린다 — courier NPC(§45)와 같은
       방식(고정 위치, 세이브 시드별 확률)으로 따로 심는다. 새 전투는
       없다(다른 짐승과 같은 idle/wander/flee) */
    var sb2 = spaceBaseSpot();
    if (sb2 && VD.ANIMALS.spacebug) {
      var hbug = core.hash2((s.seed % 733) + 11, ((s.seed >> 5) % 691) + 19);
      if (hbug < 0.4) {
        var sbx2 = sb2.tx * TILE + TILE * 0.5, sby2 = sb2.ty * TILE + TILE * 0.5;
        var bx = sbx2 + TILE * 0.6, by = sby2 + TILE * 2.3;
        animals.push({ id: 'spacebug', kind: 'spacebug', x: bx, y: by,
                       home: { x: bx, y: by }, facing: 1, state: 'idle', aim: null, pause: 0 });
      }
    }

    /* 짐승 무리(PLAN §5.5 ①) — 격자 칸 하나가 "무리" 로 뽑히면 그 바이옴 짐승 셋이 모여 선다.
       위 BIOME_CELL 뽑기와 별개(같은 흐름·난수를 안 건드려 기존 짐승 수·자리는 그대로) */
    var GRDH = global.DG.grid;
    if (GRDH) {
      GRDH.herds().forEach(function (hc) {
        var pool = [], k;
        for (k in VD.ANIMALS) {
          if (VD.ANIMALS.hasOwnProperty(k) && !VD.ANIMALS[k].rare && VD.ANIMALS[k].biomes.indexOf(hc.biome) >= 0) { pool.push(k); }
        }
        if (!pool.length) { return; }
        var hk = pool[Math.floor(core.hash2(hc.cx * 83 + 1 + s.seed % 353, hc.cy * 79 + 2) * pool.length) % pool.length];
        var offs = [[-1.2, 0], [1.2, 0.6], [0, -1.2]], oi;
        for (oi = 0; oi < offs.length; oi++) {
          var hx = (hc.tx + 0.5 + offs[oi][0]) * TILE, hy = (hc.ty + 0.5 + offs[oi][1]) * TILE;
          animals.push({ id: 'ah' + hc.key + '_' + oi, kind: hk, x: hx, y: hy,
                         home: { x: hx, y: hy }, facing: 1, state: 'idle', aim: null, pause: 0 });
        }
      });
    }
  }

  /** 링(숲 고리) 안에서 어느 바이옴이 처음 나오는 칸을 준다 — 좌표 순서로
   *  훑으므로(위→아래, 왼→오른) 늘 같은 칸이다. herbalist 를 버섯 숲 어딘가에
   *  붙일 때 쓴다.
   *  **2026-09-10 고침** — margin(forestMargin) 이 얕은 링만 훑다 보니 씨앗에
   *  따라 그 링 안에 'mushroom' 칸이 하나도 없을 수 있어(바이옴이 좌표 해시라
   *  세이브마다 다르다) `null`을 돌려줬다. 그러면 `buildNpcs()`가 herbalist를
   *  아예 안 세워 "NPC 하나가 안 보인다"는 신고로 이어졌다 — 링을 훑으며 맞는
   *  바이옴이 없어도 **지나친 첫 유효 칸**(grass-family, 마을 시설 밖)을
   *  대역으로 쌓아 뒀다가 끝까지 못 찾으면 그걸 돌려준다. */
  function firstBiomeSpot(biome) {
    var m = forestMargin();
    var cxMin = Math.floor(-m / BIOME_CELL), cxMax = Math.ceil((W + m) / BIOME_CELL);
    var cyMin = Math.floor(-m / BIOME_CELL), cyMax = Math.ceil((H + m) / BIOME_CELL);
    var cx, cy, fallback = null;
    for (cy = cyMin; cy <= cyMax; cy++) {
      for (cx = cxMin; cx <= cxMax; cx++) {
        var tx = cx * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        var ty = cy * BIOME_CELL + Math.floor(BIOME_CELL / 2);
        if (tx >= 0 && ty >= 0 && tx < W && ty < H) { continue; }
        if (inHamlet(tx, ty) || inHamlet2(tx, ty) || inCave(tx, ty) || inRuin(tx, ty)) { continue; }
        if (!GRASS_FAMILY[tileAt(tx, ty)]) { continue; }
        if (biomeAt(tx, ty) === biome) { return { tx: tx, ty: ty }; }
        if (!fallback) { fallback = { tx: tx, ty: ty }; }
      }
    }
    return fallback;
  }

