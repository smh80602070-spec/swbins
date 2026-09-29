/**
 * 마을 데이터 — 타일 · 사물 · 채집물 · 부탁
 * ---------------------------------------------------------------
 * 원작식 게임의 뼈대 데이터. 여기 한 줄을 늘리면 마을에 그것이 생긴다.
 * 규칙(무엇이 나오고 무엇을 주는지)은 village.js 가 읽기만 한다.
 */
(function (global) {
  'use strict';

  /** 땅 — 걸을 수 있는지(walk)와 색 */
  var TILES = {
    grass: { name: '풀', walk: true, color: '#63b04a', color2: '#6fbb52' },
    path:  { name: '흙길', walk: true, color: '#cbab74', color2: '#d5b681' },
    sand:  { name: '모래', walk: true, color: '#ecdfb0', color2: '#f2e7bd' },
    water: { name: '물', walk: false, color: '#4fbcda', color2: '#5cc7e2' },
    /* 돌길 — 공사(terrain.js)로만 생긴다. 마을 생성 해시는 이 타일을 내지 않는다 */
    stone: { name: '돌길', walk: true, color: '#a9a7a2', color2: '#b5b3ae' },
    floor: { name: '마루', walk: true, color: '#c2925c', color2: '#cc9d67' },
    /* 숲 고리 바이옴(PLAN 11절) — walk 는 grass 와 같다. 마을 안에는 안 나온다,
       village.js 의 biomeAt() 만 고른다 */
    grass_meadow: { name: '꽃밭',     walk: true, color: '#a8c860', color2: '#b2d16c' },
    grass_dark:   { name: '어둑숲',   walk: true, color: '#3c5f3e', color2: '#466b49' },
    grass_mush:   { name: '버섯숲',   walk: true, color: '#547a5c', color2: '#5f8567' },
    grass_rocky:  { name: '바위 지대', walk: true, color: '#8f9280', color2: '#999c89' }
  };

  /**
   * 사물 — 마을에 놓이는 것.
   *   gather 채집물 키 (없으면 그냥 장식)
   *   reset  다시 여물기까지 (일 단위)
   */
  var PROPS = {
    tree:   { name: '나무',   emoji: '🌳', gather: 'fruit',  reset: 1, hint: '흔든다' },
    pine:   { name: '소나무', emoji: '🌲', gather: 'nut',    reset: 1, hint: '흔든다' },
    rock:   { name: '바위',   emoji: '🪨', gather: 'ore',    reset: 1, hint: '캔다' },
    flower: { name: '꽃',     emoji: '🌸', gather: 'flower', reset: 1, hint: '꺾는다' },
    /* 버섯숲 바이옴에서만 나는 진짜 채집 자원(PLAN 18절 "약초", PLAN 40절
       PHASE 4 "Gathering") — village.js buildProps() 의 성긴 격자에서만 심고,
       장식용 mushroom(gather:null)과는 다른 kind 다 */
    herb:   { name: '약초밭', emoji: '🍃', gather: 'herb',   reset: 1, hint: '뜯는다' },
    spot:   { name: '낚시터', emoji: '🎣', gather: 'fish',   reset: 0, hint: '낚는다' },
    sapling:{ name: '묘목',   emoji: '🌱', gather: null,     reset: 0, hint: '자라는 중' },
    board:  { name: '게시판', emoji: '📋', gather: null,     reset: 0, hint: '읽는다' },
    shop:   { name: '전방',   emoji: '🏪', gather: null,     reset: 0, hint: '판다' },
    home:   { name: '내 집',  emoji: '🏠', gather: null,     reset: 0, hint: '들어간다' },
    mail:   { name: '우편함', emoji: '📮', gather: null,     reset: 0, hint: '열어 본다' },
    dig:    { name: '갈라진 자리', emoji: '🕳️', gather: 'fossil', reset: 1,
              hint: '판다', tool: 'spade' },
    shell:  { name: '조개',   emoji: '🐚', gather: 'shell',  reset: 1, hint: '줍는다' },
    museum: { name: '사고(史庫)', emoji: '🏛️', gather: null, reset: 0, hint: '들어간다' },
    /* 번들 시설(PLAN §5.3, 2026-09-17①) — 사고 갈래(MUSEUM_CATS)를 다 채우면
       village.js buildProps() 가 BUNDLES 표를 보고 심는다. 자리 표시만(①) —
       석비 문구·반딧불이 밤 파티클 배율은 다음 차례 */
    stele:      { name: '석비',   emoji: '🪧', gather: null, reset: 0, hint: '읽는다' },
    fireflyplot:{ name: '반딧불이 정원', emoji: '✨', gather: null, reset: 0, hint: '바라본다' },
    /* 숲의 정령(PLAN §5.5 ②) — spirit.js 가 숲 고리에 세운다. 터는 손이 닿고(수수께끼가 시작),
       푼 터는 deco 자국이다 */
    spiritmark: { name: '정령의 터', emoji: '✨', gather: null, reset: 0, hint: '살핀다' },
    spiritdone: { name: '정령이 다녀간 자리', emoji: '🍃', gather: null, reset: 0, hint: '' },
    /* 발견 밀도 격자(PLAN §5.5 ①) — grid.js 가 숲 고리 20타일 칸마다 하나씩 세운다. 손이 닿는 넷 + 야영 불(deco) */
    gridchest:  { name: '숲 보물상자', emoji: '🧰', gather: null, reset: 0, hint: '연다' },
    gridbottle: { name: '쪽지 병',     emoji: '🍾', gather: null, reset: 0, hint: '주워 읽는다' },
    gridnode:   { name: '빛나는 채집터', emoji: '💎', gather: null, reset: 0, hint: '캔다' },
    gridcamp:   { name: '나그네의 야영', emoji: '⛺', gather: null, reset: 0, hint: '말을 건다' },
    gridfire:   { name: '야영 불',     emoji: '🔥', gather: null, reset: 0, hint: '' },
    pole:   { name: '깃대',   emoji: '🚩', gather: null,     reset: 0, hint: '올려다본다' },
    weed:   { name: '잡초',   emoji: '🌿', gather: null,     reset: 0, hint: '뽑는다' },
    tailor: { name: '침선방(針線房)', emoji: '🧵', gather: null, reset: 0, hint: '옷을 고른다' },
    /* 숲 고리 바이옴 전용 사물(PLAN 11절) — 마을 안 사물과 달리 전부 deco:true 로만
       놓인다(village.js buildProps() 참고), 그래서 gather 는 의미가 없어 null 이다 */
    deadTree:  { name: '고목',      emoji: '🥀', gather: null, reset: 0, hint: '살펴본다' },
    mossyRock: { name: '이끼 바위', emoji: '🪨', gather: null, reset: 0, hint: '살펴본다' },
    mushroom:  { name: '버섯',      emoji: '🍄', gather: null, reset: 0, hint: '살펴본다' },
    bush:      { name: '덤불',      emoji: '🌿', gather: null, reset: 0, hint: '살펴본다' },
    stump:     { name: '그루터기',  emoji: '🪵', gather: null, reset: 0, hint: '살펴본다' },
    log:       { name: '통나무',    emoji: '🪵', gather: null, reset: 0, hint: '살펴본다' },
    /* 호수 테두리 물가 식생(PLAN 12절 "shoreline") — 갈대·부들 CC0 모델을 아직
       못 구해 asset3d.js 에 이미 있는 범용 'plant' 모델로 대신한다 */
    plant:     { name: '수초',      emoji: '🌾', gather: null, reset: 0, hint: '살펴본다' },
    /* 다리(2026-09-09) — 강을 건너는 유일한 자리(village.js BRIDGE_TY). 이
       칸 자체는 걸어서 지나가는 'path' 타일이고, 이 프롭은 그 위에 세우는
       Bridge.glb(2026-08-30부터 등록만 되어 있던 것)의 눈에 보이는 표시다 */
    bridge:    { name: '다리',      emoji: '🌉', gather: null, reset: 0, hint: '건넌다' },
    /* 폭포 표지(PLAN 40절 PHASE 3) — 이 판 땅에는 높이 축이 없어(terrain.js
       머리말 참고) 진짜 낙수는 못 만든다. 이 자리를 표시만 해 둔다 */
    waterfall: { name: '폭포',      emoji: '💦', gather: null, reset: 0, hint: '바라본다' },
    /* 작은 마을(숲 속 빈 캠프, PLAN 40절 PHASE 3) — asset3d.js 에 이미 등록된
       천막·모닥불·평상·우물·등롱을 모았다. 사람은 PHASE 4(NPC)에서 채운다 */
    tent:      { name: '천막',   emoji: '⛺', gather: null, reset: 0, hint: '들여다본다' },
    campfire:  { name: '모닥불', emoji: '🔥', gather: null, reset: 0, hint: '쬔다' },
    bench:     { name: '평상',   emoji: '🪑', gather: null, reset: 0, hint: '앉는다' },
    well:      { name: '우물',   emoji: '⛲', gather: null, reset: 0, hint: '들여다본다' },
    lantern:   { name: '등롱',   emoji: '🏮', gather: null, reset: 0, hint: '바라본다' },
    /* 캠프 오두막(2026-09-09) — House_1~4.glb(당장은 미사용, ASSET_LICENSES.md
       참고)를 처음 쓴다. 상인(merchant) NPC 뒤에 세워 "지나가다 만나는 빈
       캠프"였던 곳이 "누가 사는 캠프"로 보이게 한다 */
    hamletHouse: { name: '오두막', emoji: '🛖', gather: null, reset: 0, hint: '들여다본다' },
    /* 같은 날 이어서 — House_1 로 채 하나를 더 얹어 "상인 혼자 사는 오두막"을
       "여럿이 지내는 움집들"로 늘렸다 */
    hamletHut: { name: '움집', emoji: '🛖', gather: null, reset: 0, hint: '들여다본다' },
    /* 또 이어서 — House_3 로 채 하나를 더(House_4만 남는다) */
    hamletShed: { name: '흙집', emoji: '🛖', gather: null, reset: 0, hint: '들여다본다' },
    /* 두 번째 캠프(2026-09-09) — 첫 캠프와 다른 자리(hamlet2Spot)에 House_4로
       채 하나. 나그네가 하룻밤 묵어가는 외딴집이라 첫 캠프의 셋과 이름을
       구분한다 */
    hamlet2House: { name: '외딴집', emoji: '🛖', gather: null, reset: 0, hint: '들여다본다' },
    /* 폐허(2026-09-10, "시대 혼합 소품·폐허" — 퓨전 방향, PLAN 10절
       "폐허" 예시). 새로 안 받고 saga-go·saga-dungeon 이 이미 CC0 확인해
       둔 Quaternius 무너진 아치를 그대로 복사했다(순전히 장식, deco:true —
       캠프 소품과 같은 결) */
    ruinArch: { name: '무너진 아치', emoji: '🏚️', gather: null, reset: 0, hint: '바라본다' },
    /* 숨겨진 동굴(PLAN 40절 PHASE 3) — 입구 표지만. 안까지 들어가는 실내·
       보물(PLAN 40절 PHASE 4 "Treasure")은 다음 몫이다 */
    mountain:  { name: '바위산', emoji: '🗻', gather: null, reset: 0, hint: '올려다본다' },
    cave:      { name: '동굴 입구', emoji: '🕳️', gather: null, reset: 0, hint: '들어간다' },
    /* 우주기지(PLAN 45절, 2026-09-11 — "다른 마을·배달 알바") — 남서 먼
       대각선에 고정으로 선다. crate·fence·cart 는 asset3d.js 에 이미
       등록만 되어 있던(fence·cart) 또는 다른 자리에서 쓰던(crate, mail
       상자와 같은 파일) 모델을 그대로 빌린다 — 새 GLB를 안 받았다.
       전부 순수 장식(deco:true, 캠프 소품과 같은 결) */
    crate: { name: '보급 상자', emoji: '📦', gather: null, reset: 0, hint: '살펴본다' },
    fence: { name: '펜스', emoji: '🚧', gather: null, reset: 0, hint: '살펴본다' },
    cart:  { name: '수레', emoji: '🛒', gather: null, reset: 0, hint: '살펴본다' },
    /* 마을 쪽 배달 접수대 — 우편함(mail)과 다른 자리, 다른 kind. 소포가
       없을 때 손을 쓰면 하나 받는다(반복 가능, village.js pickupParcel()) */
    courierPost: { name: '택배 접수대', emoji: '📦', gather: null, reset: 0, hint: '소포를 고른다' },
    /* 택배 사슬(PLAN §5.7) — 폐허의 옛 우체통(배달 목적지). 손을 쓰면 폐허행 소포를 넣는다 */
    /* 축제 하루(PLAN §5.6) — festival.js 가 행사날에만 마을에 세운다 */
    festboard:   { name: '행사 안내판', emoji: '🎏', gather: null, reset: 0, hint: '읽는다' },
    festfire:    { name: '달집',        emoji: '🔥', gather: null, reset: 0, hint: '부럼을 태운다' },
    festrope:    { name: '줄다리기 줄', emoji: '🪢', gather: null, reset: 0, hint: '당긴다' },
    festpot:     { name: '팥죽 솥',     emoji: '🍲', gather: null, reset: 0, hint: '쑨다' },
    festlantern: { name: '등롱',        emoji: '🏮', gather: null, reset: 0, hint: '밝힌다' },
    /* 떠돌이 방문객(PLAN §5.9) — visitor.js 가 그날에만 바깥 숲에 흩는다 */
    visitcompass: { name: '나침반 조각', emoji: '🧭', gather: null, reset: 0, hint: '줍는다' },
    visitwisp:    { name: '도깨비불 조각', emoji: '👻', gather: null, reset: 0, hint: '담는다' },
    /* §5.10 — 숨바꼭질 꼬마(흔들리는 덤불)·탐사선 부품 */
    visitkid:     { name: '흔들리는 덤불', emoji: '🌿', gather: null, reset: 0, hint: '들춘다' },
    visitufo:     { name: '탐사선 부품',   emoji: '🔩', gather: null, reset: 0, hint: '줍는다' },
    visitparcel:  { name: '떨어진 소포',   emoji: '📦', gather: null, reset: 0, hint: '줍는다' },   // §5.13 택배 기사
    oldpost: { name: '옛 우체통', emoji: '📮', gather: null, reset: 0, hint: '소포를 넣는다' },
    /* 폐허 확장(PLAN 46-2절, 2026-09-11) — §45가 냈던 "과거" 목적지를
       아치 하나뿐이던 폐허(ruinSpot)에 실제로 채웠다. ruinTower는 진짜
       13~14세기 탑성 폐허 사진측량 스캔(saga-go에서 하드링크, 새로 안
       받음), gazebo는 asset3d.js에 등록만 되고 여태 안 쓰이던 정자 —
       "폐허를 발견한 나그네가 잠시 쉬어 가는" 자리로 곁들였다 */
    ruinTower: { name: '무너진 탑성', emoji: '🏰', gather: null, reset: 0, hint: '올려다본다' },
    gazebo: { name: '정자', emoji: '🏯', gather: null, reset: 0, hint: '앉아 쉰다' },
    /* 우주기지 확충(PLAN 46-3절, 2026-09-14) — 위 crate·fence·cart 는 다른
       자리에서 빌린 소품이었고, 이번엔 이 팩 자체의 건물·로버·메카를 처음
       받았다(전부 순전한 장식, deco:true — 2D 는 3D 가 못 뜨는 자리를 위한
       되돌림이라 emoji 도 함께 채운다) */
    spaceBase: { name: '우주기지 본관', emoji: '🏢', gather: null, reset: 0, hint: '올려다본다' },
    spaceHouse: { name: '기지 숙소', emoji: '🛰️', gather: null, reset: 0, hint: '들여다본다' },
    spaceDome: { name: '측지돔', emoji: '⛺', gather: null, reset: 0, hint: '들여다본다' },
    solarPanel: { name: '태양광판', emoji: '🔋', gather: null, reset: 0, hint: '살펴본다' },
    rover: { name: '탐사차', emoji: '🚙', gather: null, reset: 0, hint: '살펴본다' },
    mech: { name: '메카', emoji: '🤖', gather: null, reset: 0, hint: '올려다본다' }
  };

  /* ── 옷 ──────────────────────────────────────────────────
   * 원작의 재봉실 자리다. 궁중에서 바느질을 맡던 **침선방**의 이름을 빌렸다.
   *
   * 가구·벽지와 달리 **날마다 바뀌는 진열을 두지 않았다.** 옷은 취향이라
   * "오늘 것" 으로 막으면 답답하다 — 값이 문턱이면 충분하다.
   *
   * 고르는 것은 넷: 겉옷 · 머리 · 옷 빛 · 덧옷.
   * 이 값들은 sprite.js 의 `look`(armor · helm · cape)과 `color` 로 그대로 들어간다 —
   * 그림 코드는 한 줄도 고치지 않는다.
   */
  var WEAR_COATS = [
    { key: 'leather', name: '평상복',   price: 0 },
    { key: 'robe',    name: '도포',     price: 2400 },
    { key: 'coat',    name: '두루마기', price: 3600 },
    { key: 'plate',   name: '갑옷',     price: 6800 },
    /* 택배 사슬(PLAN §5.7) — 배달 30건을 채우면 옷장에 든다(짓는 게 아니라 받는 것). 그림은 갑옷 결을 빌린다 */
    { key: 'spacesuit', name: '배달원 우주복', price: 0, unlock: 'deliver', at: 30, look: 'plate' }
  ];

  var WEAR_HEADS = [
    { key: 'none',    name: '맨머리', price: 0 },
    { key: 'topknot', name: '상투',   price: 0 },
    { key: 'braid',   name: '댕기',   price: 900 },
    { key: 'scholar', name: '유건',   price: 1500 },
    { key: 'gat',     name: '갓',     price: 1800 },
    { key: 'hairpin', name: '족두리', price: 2600 },
    { key: 'helmet',  name: '전립',   price: 3200 }
  ];

  var WEAR_DYES = [
    { key: 'none',    name: '그대로', c: null,      price: 0 },
    { key: 'white',   name: '소색',   c: '#e4ddcc', price: 1200 },
    { key: 'ink',     name: '먹빛',   c: '#3a3f48', price: 1400 },
    { key: 'forest',  name: '풀빛',   c: '#3f7f4a', price: 1600 },
    { key: 'indigo',  name: '쪽빛',   c: '#3a6a9a', price: 1600 },
    { key: 'crimson', name: '다홍',   c: '#c0453a', price: 1800 },
    { key: 'gold',    name: '치자빛', c: '#d8a63c', price: 2200 },
    { key: 'plum',    name: '자주',   c: '#7a4a8a', price: 2400 }
  ];

  var WEAR_CAPES = [
    { key: 'off', name: '없음', price: 0 },
    { key: 'on',  name: '덧옷', price: 2000 }
  ];

  var WEAR_PARTS = [
    { key: 'coat', name: '겉옷', list: WEAR_COATS },
    { key: 'head', name: '머리', list: WEAR_HEADS },
    { key: 'dye',  name: '옷 빛', list: WEAR_DYES },
    { key: 'cape', name: '덧옷', list: WEAR_CAPES }
  ];

  function wearPart(key) {
    var p = WEAR_PARTS.filter(function (x) { return x.key === key; });
    return p[0] || null;
  }

  function wearItem(part, key) {
    var p = wearPart(part);
    if (!p) { return null; }
    var f = p.list.filter(function (x) { return x.key === key; });
    return f[0] || p.list[0];
  }

  /**
   * 주민의 성격 — 원작의 그 여덟 유형 자리다.
   * 인물 id 로 정해지니 늘 같다(세이브에 남기지 않는다).
   *
   *   ask/done/idle  말을 걸었을 때의 문구
   *   letter         편지 문구
   *   like           선물로 반기는 갈래
   *   req            주로 청하는 갈래
   *
   * 문구의 `{it}` 은 물건, `{n}` 은 개수, `{have}` 는 지금 가진 수로 바뀐다.
   */
  var FOLK_TYPES = [
    /* dislike(2026-09-17, PLAN §5.4 하트 취향표) — like 와 성격이 반대되는
       갈래 하나씩. 서사적으로 중요하진 않다(그냥 "안 맞는 것"이 하나 있어야
       선물에 -1 이 뜻을 가진다) — GIFT_CATS 안에서 like 와 겹치지 않게만 골랐다 */
    { key: 'hohyeop', name: '호협', icon: '🍶', desc: '활달하고 거침없다',
      like: 'fish', dislike: 'flower', req: ['fish', 'ore', 'fruit'],
      ask: '{it} {n}개만 구해 주시오! 사내끼리 긴말이 필요하겠소? ({have}/{n})',
      done: '과연! 시원시원하구려. 잘 받았소.',
      idle: '오늘은 자네 덕에 배가 부르오. 한잔 하려나?',
      letter: '어제 일은 참으로 시원했소. 사양 말고 받으시오!' },
    { key: 'geuneom', name: '근엄', icon: '📜', desc: '말이 짧고 무겁다',
      like: 'ore', dislike: 'bug', req: ['ore', 'nut', 'fossil'],
      ask: '{it}. {n}개. 부탁하네. ({have}/{n})',
      done: '수고했네.',
      idle: '되었네. 오늘은 그만하게.',
      letter: '받았네. 빈손으로 보내는 법이 아니라 하여 보내네.' },
    { key: 'dajeong', name: '다정', icon: '🌸', desc: '살갑고 말이 곱다',
      like: 'flower', dislike: 'ore', req: ['flower', 'fruit', 'shell'],
      ask: '{it} {n}개만 부탁드려도 될까요? 무리하진 마세요. ({have}/{n})',
      done: '어머, 정말 고마워요. 덕분에 오늘이 환하네요.',
      idle: '오늘은 정말 고마웠어요. 차 한잔 들고 가세요.',
      letter: '어제 일이 자꾸 생각나 붓을 들었어요. 작은 마음이에요.' },
    { key: 'hakgu', name: '학구', icon: '📖', desc: '아는 것을 꼭 말한다',
      like: 'fossil', dislike: 'fruit', req: ['nut', 'ore', 'fossil'],
      ask: '{it}은(는) 예로부터 귀히 여겼소. {n}개면 족하오. ({have}/{n})',
      done: '옳지. 이만한 물건은 흔치 않소. 기록해 두겠소.',
      idle: '오늘 얻은 것은 사고에 들일 만하오. 생각해 보시오.',
      letter: '어제 것을 살펴보니 과연 물건이었소. 답례를 보내오.' },
    { key: 'iksal', name: '익살', icon: '🎭', desc: '한마디에 농이 섞인다',
      like: 'bug', dislike: 'fossil', req: ['fruit', 'fish', 'bug'],
      ask: '{it} {n}개! 없으면 말고… 아니 있어야 하오. ({have}/{n})',
      done: '어이쿠, 진짜 가져왔네? 농이었는데!',
      idle: '오늘은 자네가 이겼소. 내일 두고 보세.',
      letter: '어제 것 잘 먹었소. 아니 잘 썼소. 아무튼 고맙소.' },
    { key: 'ujik', name: '우직', icon: '🌾', desc: '순박하고 곧다',
      like: 'fruit', dislike: 'shell', req: ['fruit', 'nut', 'shell'],
      ask: '{it} {n}개… 그거면 됩니다. ({have}/{n})',
      done: '고맙습니다. 잊지 않겠습니다.',
      idle: '오늘은 됐습니다. 정말 고맙습니다.',
      letter: '어제 일 잊지 않았습니다. 변변찮지만 보냅니다.' }
  ];

  /**
   * 하트 해제 문턱(PLAN §5.4) — 이번엔 **이름표만** 둔다(집 방문·고유 대화·
   * 동행·기념품 — 기념품은 2026-09-30 "주민 사연"으로 열렸다, HANDOFF 참고). 화면에 "다음: n♥ 에
   * …" 를 보여줄 자리가 있어야 하트가 왜 있는지 알 수 있어서, 문턱과 이름만
   * 먼저 채운다.
   */
  var HEART_UNLOCKS = [
    { at: 3,  name: '집 방문 허용' },
    { at: 5,  name: '고유 대화' },
    { at: 7,  name: '동행' },
    { at: 10, name: '기념품' }
  ];

  /**
   * 주민 사연 틀 셋(정본 scenario/saga-forest.md "주민 사연 칸", 하트 10 = 기념품 해제) — 주민은 도감 인물이라 무작위로 뽑힌다.
   * 그래서 이야기를 사람마다 새로 쓰지 않고 "{이름}" 칸이 있는 틀 셋(고향·꿈·선물) 가운데 인물 id 로 하나를 고르고, 도감 열전(bio) 한 줄을 끼운다.
   * {bio} 는 열전이 없으면 빈 채로(문장이 이어지게) 쓴다. 사람마다 한 번 — 받으면 기념품 값(금)과 업적을 준다.
   */
  var MEMENTO_FRAMES = [
    { key: 'home',  emoji: '🏡', text: '{이름}: 그대에게만 하는 얘기요. 내 고향 이야기를 한 번도 못 했구려. {bio} 그 하늘 아래 배운 것이 이 마을에서도 통하니 신기한 일이오.' },
    { key: 'dream', emoji: '🌠', text: '{이름}: 내 꿈을 말해도 웃지 않겠소? 이 마을에서 이웃과 오래오래 사는 것이오. {bio} 그런 꿈을 이루게 해 준 이가 바로 그대요.' },
    { key: 'gift',  emoji: '🎁', text: '{이름}: 이것을 받아 주시오. 오래 아껴 온 것인데 그대가 가질 때가 되었소. {bio} 정이란 이렇게 손에서 손으로 넘어가는 것이라 배웠소.' }
  ];
  var MEMENTO_GOLD = 3000, MEMENTO_FEAT = 20;

  /* ── 마을 ────────────────────────────────────────────────
   * 원작은 처음에 마을 이름을 묻고, 마을 기를 손수 그리게 한다.
   * 이름은 여기서 뽑고(바꿀 수 있다), 기는 바탕·무늬·무늬색 셋을 고르는 것으로 옮겼다.
   * 손으로 점을 찍는 도트 편집기는 이 판에 맞지 않는다 — 고르는 것으로 충분하다.
   */
  var TOWN_NAMES = [
    '솔뫼', '달내', '한터', '너울', '아사', '벌뫼', '새터', '도담',
    '미르내', '가온', '누리뫼', '하람', '별하', '윤슬', '아라', '단미'
  ];

  var FLAG_BGS = [
    { key: 'white', name: '흰빛', c: '#f2ece0' },
    { key: 'blue',  name: '쪽빛', c: '#2f6f9a' },
    { key: 'red',   name: '다홍', c: '#c04a3a' },
    { key: 'green', name: '풀빛', c: '#3f7f4a' },
    { key: 'black', name: '먹빛', c: '#33383f' },
    { key: 'gold',  name: '누른빛', c: '#d8a63c' }
  ];

  var FLAG_FGS = [
    { key: 'white', name: '흰빛', c: '#f6f2e8' },
    { key: 'black', name: '먹빛', c: '#2a2e34' },
    { key: 'red',   name: '다홍', c: '#d4503c' },
    { key: 'blue',  name: '쪽빛', c: '#3a7fb0' },
    { key: 'gold',  name: '누른빛', c: '#e8b93c' }
  ];

  /** 무늬 — 그리는 것은 village-view.js 의 drawFlagSym 이다 */
  var FLAG_SYMS = [
    { key: 'circle', name: '둥근 해' },
    { key: 'taegeuk', name: '태극' },
    { key: 'pine',   name: '솔' },
    { key: 'crane',  name: '학' },
    { key: 'mount',  name: '산' },
    { key: 'wave',   name: '물결' },
    { key: 'star',   name: '별' },
    { key: 'tiger',  name: '범 발자국' },
    /* 사고 네 갈래를 다 채우면 열리는 문양(PLAN §5.3) — `gate` 가 있는 것은 town.js
       `symLocked()` 가 잠근다 */
    { key: 'stele',  name: '사고비 (사고 완성)', gate: 'bundles' }
  ];

  /* ── 계절 행사 ────────────────────────────────────────────
   * 원작이 철마다 마을에 하루짜리 잔치를 두던 그 자리다.
   * 날짜는 **양력으로 고정**했다 — 음력을 계산하려면 표가 하나 더 필요하고,
   * 이 판에서 얻는 것보다 드는 것이 크다.
   *
   *   up   그날 그 갈래가 비싸게 팔린다
   *   tag  화면이 무엇을 더 그릴지 (moon · star · blossom · fire · 없으면 그대로)
   */
  var EVENTS = [
    { key: 'seollal', name: '설날', m: 1, d: 1, tag: 'newyear',
      hello: '새해 첫날입니다',
      desc: '주민에게 말을 걸면 세뱃돈을 줍니다 (사람마다 한 번).',
      /* 5.1 오늘의 일과 — 값을 올리는 up 칸이 없는 유일한 행사라 따로 적는다.
         "말을 걸면"의 실제 셈은 선물 카운터(giftTotal)로 대신한다 — 이 판엔
         "대화" 전용 카운터가 없다(§5.1 범위 밖, 있으면 더 정확해진다) */
      task: { key: 'ev_seollal', kind: 'gift', name: '설날 — 주민에게 선물하기', n: 1, reward: 200 } },
    { key: 'daeborum', name: '대보름', m: 2, d: 15, tag: 'moon', sky: 'clear',
      up: { cat: 'nut', mul: 2 },
      hello: '보름달이 큽니다',
      desc: '부럼(밤·잣·두릅) 값이 갑절입니다. 밤하늘의 달이 큽니다.' },
    { key: 'samjin', name: '삼짇날', m: 4, d: 3, tag: 'blossom', sky: 'clear',
      up: { cat: 'flower', mul: 2 },
      hello: '꽃놀이 가는 날입니다',
      desc: '꽃 값이 갑절입니다. 나무마다 벚빛이 돌고 꽃잎이 흩날립니다.' },
    { key: 'dano', name: '단오', m: 6, d: 5,
      up: { cat: 'flower', mul: 1.8 },
      hello: '창포에 머리 감는 날입니다',
      desc: '꽃 값이 오릅니다.' },
    { key: 'chilseok', name: '칠석', m: 7, d: 7, tag: 'star', sky: 'clear',
      up: { cat: 'bug', mul: 1.6 },
      hello: '견우와 직녀가 만나는 밤입니다',
      desc: '밤하늘의 별이 갑절입니다. 곤충 값이 오릅니다.' },
    { key: 'baekjung', name: '백중', m: 8, d: 15, tag: 'fire', sky: 'clear',
      up: { cat: 'fish', mul: 1.6 },
      hello: '호미를 씻고 노는 날입니다',
      desc: '밤에 불꽃이 오릅니다. 물고기 값이 오릅니다.' },
    { key: 'chuseok', name: '한가위', m: 9, d: 17, tag: 'moon', sky: 'clear',
      up: { cat: 'fruit', mul: 2 },
      hello: '더도 말고 덜도 말고 오늘만 같아라',
      desc: '과일 값이 갑절입니다. 밤하늘의 달이 큽니다.' },
    { key: 'dongji', name: '동지', m: 12, d: 22, sky: 'snow',
      up: { cat: 'fruit', mul: 1.5 },
      hello: '밤이 가장 긴 날입니다',
      desc: '팥죽을 쑤는 날. 열매 값이 오르고 눈이 잦습니다.' }
  ];

  /* ── 축제 하루(PLAN §5.6) — 행사마다 그날의 놀이 하나. festival.js 가 판정한다 ────────
   * kind: bow 세배 · burn 달집 · flowers 꽃놀이(sec 초 안에) · fish 낚시 · wish 소원 · lantern 등롱 · rope 줄다리기(sec 초 안에) · porridge 팥죽(cost 알)
   * n: 목표 수. gold: 완성 상금. furn: 완성 가구(FURNITURE 의 fest 항목 — 전방에서는 안 판다) */
  var FEST_PLAY = {
    seollal:  { kind: 'bow',      name: '세배 돌기',    how: '주민 3명에게 세배를 드립니다',                  n: 3,  gold: 600, furn: 'fest_seollal' },
    daeborum: { kind: 'burn',     name: '달집태우기',   how: '달집(모닥불)에 밤·잣 5알을 태웁니다',            n: 5,  gold: 500, furn: 'fest_daeborum' },
    samjin:   { kind: 'flowers',  name: '꽃놀이',       how: '안내판에서 시작 — 60초 안에 꽃 8송이',          n: 8,  gold: 500, furn: 'fest_samjin', sec: 60 },
    dano:     { kind: 'fish',     name: '창포못 낚시',  how: '오늘 물고기 5마리를 낚습니다',                  n: 5,  gold: 500, furn: 'fest_dano' },
    chilseok: { kind: 'wish',     name: '별에 소원',    how: '별똥별에 소원을 빕니다 — 내일 채집이 후해집니다', n: 1,  gold: 400, furn: 'fest_chilseok' },
    baekjung: { kind: 'lantern',  name: '등롱 밤 산책', how: '저녁·밤에 마을의 등롱 셋을 밝힙니다',           n: 3,  gold: 500, furn: 'fest_baekjung' },
    chuseok:  { kind: 'rope',     name: '줄다리기',     how: '줄을 10초 안에 30번 당깁니다',                  n: 30, gold: 700, furn: 'fest_chuseok', sec: 10 },
    dongji:   { kind: 'porridge', name: '팥죽 나눔',    how: '솥에 밤·잣 3알로 팥죽을 쑤어 주민 3명에게 나눕니다', n: 3, gold: 600, furn: 'fest_dongji', cost: 3 }
  };
  EVENTS.forEach(function (e) { if (FEST_PLAY[e.key]) { e.play = FEST_PLAY[e.key]; } });

  /* ── 오늘의 일과판 (PLAN §5.1, 표준 A·H) ──────────────────────
   * "채집·주민·탐험" 세 축에서 하루 하나씩, 날짜 해시로 뽑는다(`weatherOf`와
   * 같은 결 — 세이브에 안 남고 순수 함수로만 정해진다. `village.js`가 이 결과에
   * `base`(그날 시작 시점 카운터 값)만 얹어 세이브에 넣는다).
   * 행사가 있는 날은 셋째 줄(탐험)이 그 행사 전용 과제로 바뀐다. */
  var CAT_NAME = { flower: '꽃', fish: '물고기', herb: '약초', bug: '곤충', nut: '밤·잣', fruit: '열매' };

  var TASK_POOL = [
    { key: 'gather_flower', axis: 'gather', kind: 'gather', cat: 'flower', name: '꽃 3 모으기', n: 3, reward: 100 },
    { key: 'gather_fish',   axis: 'gather', kind: 'gather', cat: 'fish',   name: '물고기 2 모으기', n: 2, reward: 120 },
    { key: 'gather_herb',   axis: 'gather', kind: 'gather', cat: 'herb',   name: '약초 3 모으기', n: 3, reward: 100 },
    { key: 'gather_bug',    axis: 'gather', kind: 'gather', cat: 'bug',    name: '곤충 2 모으기', n: 2, reward: 110 },
    { key: 'gather_nut',    axis: 'gather', kind: 'gather', cat: 'nut',    name: '밤·잣 3 모으기', n: 3, reward: 100 },
    { key: 'gather_fruit',  axis: 'gather', kind: 'gather', cat: 'fruit',  name: '열매 3 모으기', n: 3, reward: 100 },
    { key: 'gift',   axis: 'social',  kind: 'gift',   name: '주민에게 선물하기', n: 1, reward: 90 },
    { key: 'donate', axis: 'explore', kind: 'donate', name: '사고에 기증하기', n: 1, reward: 130 },
    { key: 'weed',   axis: 'explore', kind: 'weed',   name: '잡초 5 뽑기', n: 5, reward: 80 },
    { key: 'deliver', axis: 'explore', kind: 'deliver', name: '택배 배달하기', n: 1, reward: 140 }
  ];
  var TASK_AXES = ['gather', 'social', 'explore'];

  /** 주간(월~일요일 대신 순무 장 주기 — turnip.js 의 기존 week() 를 그대로 빌린다) */
  var WEEKLY_POOL = [
    { key: 'w_gather', kind: 'gatherAny', name: '이번 주 무엇이든 20개 모으기', n: 20, reward: 600 },
    { key: 'w_gift',   kind: 'gift',      name: '이번 주 선물 3번 건네기', n: 3, reward: 600 },
    { key: 'w_donate', kind: 'donate',    name: '이번 주 사고에 3번 기증하기', n: 3, reward: 600 }
  ];

  /** 그날의 채집·주민·탐험 셋 — **순수 함수**(dayNum 만으로 정해진다) */
  function pickDayTasks(dayNum) {
    var out = [];
    for (var a = 0; a < TASK_AXES.length; a++) {
      var axis = TASK_AXES[a];
      var pool = TASK_POOL.filter(function (t) { return t.axis === axis; });
      var h = dayHash(dayNum * 131 + a * 907 + 13);
      out.push(pool[Math.min(pool.length - 1, Math.floor(h * pool.length))]);
    }
    return out;
  }

  /** 그날의 주간 과제 — **순수 함수**(weekNum 만으로 정해진다) */
  function pickWeekTask(weekNum) {
    var h = dayHash(weekNum * 733 + 5);
    return WEEKLY_POOL[Math.min(WEEKLY_POOL.length - 1, Math.floor(h * WEEKLY_POOL.length))];
  }

  /** 행사일의 고정 과제(있으면) — 셋째(탐험) 줄을 대신한다 */
  function eventTaskOf(ev) {
    if (!ev) { return null; }
    /* 축제 하루(PLAN §5.6) — 행사날 목표판 첫 줄은 그날의 놀이다. 진행은 festival.js 가 센다(kind 'fest') */
    if (ev.play) { return { key: 'ev_' + ev.key, kind: 'fest', name: ev.name + ' — ' + ev.play.name, n: ev.play.n, reward: 150 }; }
    if (ev.task) { return ev.task; }
    if (ev.up && ev.up.cat) {
      var nm = CAT_NAME[ev.up.cat] || ev.up.cat;
      return { key: 'ev_' + ev.key, kind: 'gather', cat: ev.up.cat,
        name: ev.name + ' — ' + nm + ' 3 모으기', n: 3, reward: 200 };
    }
    return null;
  }

  /* ── 날씨 ────────────────────────────────────────────────
   * **날짜로 정해진다.** 세이브에 남길 것이 없다 — 같은 날이면 같은 하늘이다.
   * 계절이 확률을 정한다(겨울엔 비 대신 눈).
   *
   * 달·별·불꽃을 보는 행사날은 **맑다**(`sky: 'clear'`). 한가위에 비가 오면
   * 큰 달을 볼 수 없으니, 그 하루만은 하늘을 고정한다. 동지는 반대로 눈이다.
   *
   * 이 파일은 core 를 모른다(불러오는 차례가 앞이다). 그래서 해시를 여기 따로 둔다.
   */
  var WEATHERS = {
    clear: { key: 'clear', name: '맑음', icon: '☀️' },
    cloud: { key: 'cloud', name: '흐림', icon: '☁️' },
    rain:  { key: 'rain',  name: '비',   icon: '🌧️' },
    snow:  { key: 'snow',  name: '눈',   icon: '🌨️' }
  };

  var WEATHER_ODDS = {
    spring: [['clear', 0.50], ['cloud', 0.30], ['rain', 0.20]],
    summer: [['clear', 0.45], ['cloud', 0.20], ['rain', 0.35]],
    autumn: [['clear', 0.55], ['cloud', 0.28], ['rain', 0.17]],
    winter: [['clear', 0.45], ['cloud', 0.25], ['snow', 0.30]]
  };

  function dayHash(n) {
    var t = (n * 2654435761) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 자가진단용 — 그날의 날씨를 억지로 고정한다. null 을 주면 다시 날짜 해시를 본다
   *  (`town.js` `_setStar`·`turnip.js` `_setOpen` 과 같은 결의 진단용 구멍 —
   *  `knob()` 은 자가진단이 안 읽으므로 별도로 둔다) */
  var weatherOverride = null;

  /** 그날의 날씨 */
  function weatherOf(date, seasonKey) {
    if (weatherOverride && WEATHERS[weatherOverride]) { return WEATHERS[weatherOverride]; }
    var k = knob('time.weather');
    if (k && WEATHERS[k]) { return WEATHERS[k]; }
    var dt = date || new Date();
    var ev = eventOf(dt);
    if (ev && ev.sky) { return WEATHERS[ev.sky]; }
    var se = seasonKey || seasonOf(dt.getMonth() + 1).key;
    var n = dt.getFullYear() * 372 + dt.getMonth() * 31 + dt.getDate();
    var h = dayHash(n * 13 + 7);
    var odds = WEATHER_ODDS[se] || WEATHER_ODDS.spring;
    for (var i = 0; i < odds.length; i++) {
      h -= odds[i][1];
      if (h <= 0) { return WEATHERS[odds[i][0]]; }
    }
    return WEATHERS.clear;
  }

  function weather() { return weatherOf(); }

  /** 지금 하늘에서 나오는 것인가 (rain 칸이 없으면 하늘을 안 탄다) */
  function inWeather(it, key) {
    if (!it.rain) { return true; }
    var rainy = (key || weather().key) === 'rain';
    if (it.rain === 'only') { return rainy; }
    if (it.rain === 'no') { return !rainy; }
    return true;
  }

  /** 그날의 행사 (없으면 null) */
  function eventOf(date) {
    var k = knob('time.event');
    if (k) {
      if (k === 'none') { return null; }
      var f = EVENTS.filter(function (x) { return x.key === k; });
      if (f[0]) { return f[0]; }
    }
    var dt = date || new Date();
    var m = dt.getMonth() + 1, d = dt.getDate();
    for (var i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].m === m && EVENTS[i].d === d) { return EVENTS[i]; }
    }
    return null;
  }

  /** 오늘 다음에 오는 행사와 며칠 남았는지 */
  function nextEventOf(date) {
    var dt = date || new Date();
    var y = dt.getFullYear();
    var today = new Date(y, dt.getMonth(), dt.getDate()).getTime();
    var best = null, bd = 1e9, i;
    for (i = 0; i < EVENTS.length; i++) {
      var e = EVENTS[i];
      var t = new Date(y, e.m - 1, e.d).getTime();
      if (t <= today) { t = new Date(y + 1, e.m - 1, e.d).getTime(); }
      var left = Math.round((t - today) / 86400000);
      if (left < bd) { bd = left; best = e; }
    }
    return best ? { event: best, left: bd } : null;
  }

  /**
   * 도구 — 전방에서 한 번 사면 계속 쓴다.
   * 원작이 잠자리채 없이는 벌레를 못 잡게 해 둔 그 자리다.
   */
  var TOOLS = {
    net:   { key: 'net', name: '잠자리채', emoji: '🥅', price: 800,
             desc: '곤충을 잡을 수 있게 됩니다' },
    spade: { key: 'spade', name: '삽', emoji: '🪏', price: 700,
             desc: '갈라진 자리를 파낼 수 있게 됩니다' },
    /* 개토패(開土牌) — 원작의 공사 면허. 이걸 사야 독에 🪧 공사 단추가 선다.
       값이 셋 중 가장 비싼 것은 일부러다 — 땅을 고치는 일은 마을을 어지간히
       돌아본 뒤에 손댈 일이다 */
    deed:  { key: 'deed', name: '개토패(開土牌)', emoji: '🪧', price: 4800,
             desc: '땅을 고쳐 길과 물길을 낼 수 있게 됩니다' }
  };

  /**
   * 가구 — 집 안에 놓는 것. 채집물과 **다른 칸(homeStock)** 에 쌓인다.
   *   set  계열. 같은 계열을 셋 이상 놓으면 집 평가에 보탬이 된다
   *   form 화면이 무엇으로 그릴지 (village-view.js 의 drawFurn)
   */
  var FURN_SETS = {
    anbang: { name: '안방', color: '#c98a4a' },
    sarang: { name: '사랑방', color: '#7a6a9a' },
    buok:   { name: '부엌', color: '#a85a3c' },
    ddeul:  { name: '뜰',   color: '#5a9a5a' },
    jange:  { name: '잔치', color: '#d0455a' }        // 행사 가구(PLAN §5.6) — 놀이를 끝내야 받는다
  };

  var FURNITURE = [
    { key: 'bangseok',  name: '방석',     price: 400,  set: 'anbang', form: 'cushion' },
    /* 2026-09-18 — §5.1 침구 트리거(HANDOFF 참고): 안방에 이걸 놓아야
       "오늘을 마친다" 상호작용이 생긴다. bed:true 가 그 표식이다. */
    { key: 'yo',        name: '요',       price: 1000, set: 'anbang', form: 'bedding', bed: true },
    { key: 'hwabun',    name: '화분',     price: 700,  set: 'ddeul',  form: 'plant' },
    { key: 'deungjan',  name: '등잔',     price: 800,  set: 'anbang', form: 'lamp' },
    { key: 'soban',     name: '소반',     price: 900,  set: 'anbang', form: 'table' },
    { key: 'mulhang',   name: '물항아리', price: 1100, set: 'buok',   form: 'vase' },
    { key: 'jokja',     name: '족자',     price: 1200, set: 'sarang', form: 'scroll' },
    { key: 'seoan',     name: '서안',     price: 1400, set: 'sarang', form: 'table' },
    { key: 'hwaro',     name: '화로',     price: 1500, set: 'buok',   form: 'brazier' },
    { key: 'mungab',    name: '문갑',     price: 1800, set: 'sarang', form: 'chest' },
    { key: 'bandaji',   name: '반닫이',   price: 2200, set: 'anbang', form: 'chest' },
    { key: 'dokja',     name: '도자기',   price: 2600, set: 'anbang', form: 'vase' },
    { key: 'badukpan',  name: '바둑판',   price: 3000, set: 'sarang', form: 'table' },
    { key: 'byeongpung', name: '병풍',    price: 3600, set: 'sarang', form: 'screen' },
    { key: 'geomungo',  name: '거문고',   price: 5200, set: 'sarang', form: 'gayageum' },
    /* 행사 가구 8(PLAN §5.6) — 행사 놀이를 끝내면 집 재고에 든다. fest 가 있으면 전방 진열·떨어지는 가구에서 빠진다 */
    { key: 'fest_seollal',   name: '복조리',     price: 1500, set: 'jange', form: 'vase',    fest: 'seollal' },
    { key: 'fest_daeborum',  name: '달집 화로',  price: 1500, set: 'jange', form: 'brazier', fest: 'daeborum' },
    { key: 'fest_samjin',    name: '꽃전 소반',  price: 1500, set: 'jange', form: 'table',   fest: 'samjin' },
    { key: 'fest_dano',      name: '창포 화분',  price: 1500, set: 'jange', form: 'plant',   fest: 'dano' },
    { key: 'fest_chilseok',  name: '오작교 족자', price: 1500, set: 'jange', form: 'scroll',  fest: 'chilseok' },
    { key: 'fest_baekjung',  name: '연등',       price: 1500, set: 'jange', form: 'lamp',    fest: 'baekjung' },
    { key: 'fest_chuseok',   name: '송편 상',    price: 1500, set: 'jange', form: 'table',   fest: 'chuseok' },
    { key: 'fest_dongji',    name: '팥죽 화로',  price: 1500, set: 'jange', form: 'brazier', fest: 'dongji' },
    /* 방문객 가구 6(PLAN §5.9) — 방문객 부탁을 들어주면 집 재고에 든다. fest 가 있으니 전방·떨어지는 가구에서 빠진다 */
    { key: 'visit_sailor', name: '선장의 궤짝',     price: 2400, set: 'jange', form: 'chest',   fest: 'visit' },
    { key: 'visit_wisp',   name: '도깨비 등롱',     price: 2400, set: 'jange', form: 'lamp',    fest: 'visit' },
    { key: 'visit_angler', name: '명인의 어탁',     price: 2000, set: 'jange', form: 'scroll',  fest: 'visit' },
    { key: 'visit_bug',    name: '나비 표본 액자',  price: 2000, set: 'jange', form: 'screen',  fest: 'visit' },
    { key: 'visit_future', name: '시간의 탁상시계', price: 3000, set: 'jange', form: 'vase',    fest: 'visit' },
    { key: 'visit_dokkaebi', name: '도깨비 방망이 탁자', price: 2400, set: 'jange', form: 'table', fest: 'visit' },
    { key: 'visit_alien',  name: '별 지도 액자',    price: 3000, set: 'jange', form: 'scroll',  fest: 'visit' },
    /* 현대 손님 둘(§5.13) */
    { key: 'visit_parcel', name: '소포 상자 탑',    price: 2200, set: 'jange', form: 'chest',   fest: 'visit' },
    { key: 'visit_photo',  name: '숲 사진첩 병풍',  price: 2200, set: 'jange', form: 'screen',  fest: 'visit' }
  ];

  var FURN = {};
  (function () {
    for (var i = 0; i < FURNITURE.length; i++) { FURN[FURNITURE[i].key] = FURNITURE[i]; }
  })();

  function furn(key) { return FURN[key] || null; }

  /**
   * 집의 단계 — 원작의 융자(대출)로 넓히는 그 자리.
   * 신청하면 그 자리에서 넓어지고 **빚이 생긴다**. 빚을 다 갚아야 다음을 신청할 수 있다.
   */
  var HOME_TIERS = [
    { name: '단칸방',       w: 7,  h: 5, cost: 0 },
    { name: '툇마루 딸린 방', w: 9,  h: 6, cost: 12000 },
    { name: '사랑채',       w: 11, h: 7, cost: 40000 },
    { name: '기와집',       w: 13, h: 8, cost: 120000 }
  ];

  /**
   * 벽지와 장판 — 방의 바탕을 갈아입힌다.
   * 원작에서 가구보다 먼저 방의 인상을 바꾸는 것이 이 둘이다.
   * 기본 한 벌은 값이 0 이고 처음부터 가지고 있다.
   */
  var WALLS = [
    { key: 'earth', name: '흙벽',   price: 0,    c: '#e6d8bd', trim: '#8a6440' },
    { key: 'hanji', name: '한지벽', price: 2000, c: '#f4ecda', trim: '#a08050' },
    { key: 'sol',   name: '솔빛벽', price: 3800, c: '#5f7f5a', trim: '#3f5f3a' },
    { key: 'muk',   name: '먹빛벽', price: 3200, c: '#5a5f6a', trim: '#383d46' },
    { key: 'dan',   name: '단청벽', price: 5200, c: '#c05a44', trim: '#2f5f7a' }
  ];

  var FLOORS = [
    { key: 'wood',   name: '마루',   price: 0,    a: '#c2925c', b: '#cc9d67' },
    { key: 'mat',    name: '돗자리', price: 1800, a: '#c8b98a', b: '#d2c495' },
    { key: 'jangpan', name: '장판',  price: 2200, a: '#d8b26a', b: '#e0bd77' },
    { key: 'stone',  name: '박석',   price: 3400, a: '#9aa0a6', b: '#a7adb3' },
    { key: 'ondol',  name: '구들장', price: 4200, a: '#b0a08a', b: '#bcac96' }
  ];

  var WALL = {}, FLOOR = {};
  (function () {
    var i;
    for (i = 0; i < WALLS.length; i++) { WALL[WALLS[i].key] = WALLS[i]; }
    for (i = 0; i < FLOORS.length; i++) { FLOOR[FLOORS[i].key] = FLOORS[i]; }
  })();

  function wall(key) { return WALL[key] || WALLS[0]; }
  function floor(key) { return FLOOR[key] || FLOORS[0]; }

  /**
   * 사고(史庫) 등급 — 기증한 **종 수**로 매긴다.
   * 원작의 박물관이 하던 일이다. 실록을 보관하던 그 이름을 빌렸다.
   */
  var MUSEUM_GRADES = [
    { at: 0,  name: '빈 사고' },
    { at: 5,  name: '문을 연 사고' },
    { at: 12, name: '갖춰지는 사고' },
    { at: 22, name: '이름난 사고' },
    { at: 32, name: '온전한 사고' }
  ];

  /** 사고에 들이는 갈래 — 원작의 네 전시실이다 */
  var MUSEUM_CATS = [
    { key: 'bug',    name: '곤충',   icon: '🦋' },
    { key: 'fish',   name: '물고기', icon: '🐟' },
    { key: 'fossil', name: '화석',   icon: '🦴' },
    { key: 'shell',  name: '조개',   icon: '🐚' }
  ];

  /**
   * 번들(PLAN §5.3 "마을 번들 — 모으면 마을이 변한다", 2026-09-17①) — 사고
   * 갈래를 다 채우면(museum.byCat() 의 done===total) village.js buildProps()
   * 가 그 갈래에 배정된 시설을 마을에 고정으로 심는다.
   *
   * PLAN 원안은 꽃·열매까지 6번들인데, **이 둘은 사고(MUSEUM_CATS)가 애초에
   * 안 받는 갈래**다(꽃·열매는 판매·선물용, 이 판에 기증 UI가 없다) — 기증
   * 갈래를 늘리는 건 그 자체로 정책 결정(선물·판매와 겹치는 물건을 사고에도
   * 받을지)이라 이번엔 안 건드리고 넷만 채운다. 다음 차례에 사용자와 확인.
   */
  var BUNDLES = {
    fossil: { facility: 'stele',       name: '화석 갈래 완결 — 석비' },
    bug:    { facility: 'fireflyplot', name: '곤충 갈래 완결 — 반딧불이 정원' },
    fish:   { facility: 'bench',       name: '물고기 갈래 완결 — 호숫가 평상' },
    shell:  { facility: 'shell',       name: '조개 갈래 완결 — 강가 조개 길' }
  };

  /** 집 평가 등급 — 점수가 오르면 이름이 바뀐다 (원작의 그 평가서) */
  var HOME_GRADES = [
    { at: 0,    name: '휑한 방' },
    { at: 30,   name: '살림이 든 방' },
    { at: 80,   name: '정갈한 집' },
    { at: 160,  name: '아취 있는 집' },
    { at: 280,  name: '이름난 집' },
    { at: 450,  name: '명가(名家)' }
  ];

  /**
   * 채집물 — 이름·값·희귀도.
   *   pick() 이 무게(w)로 하나를 고른다.
   */
  var ITEMS = {
    fruit: [
      { key: 'apple',  name: '능금',   emoji: '🍎', price: 40,  w: 50 },
      { key: 'peach',  name: '복숭아', emoji: '🍑', price: 70,  w: 30, season: ['summer'] },
      { key: 'persim', name: '홍시',   emoji: '🍊', price: 110, w: 20, season: ['autumn'] },
      { key: 'plum',   name: '매실',   emoji: '🟢', price: 90,  w: 22, season: ['spring'] },
      { key: 'citron', name: '유자',   emoji: '🍋', price: 160, w: 14, season: ['winter'] }
    ],
    nut: [
      { key: 'chest',  name: '밤',     emoji: '🌰', price: 35,  w: 60, season: ['autumn', 'winter'] },
      { key: 'pine',   name: '잣',     emoji: '🥜', price: 90,  w: 40 },
      { key: 'sprout', name: '두릅',   emoji: '🌱', price: 120, w: 26, season: ['spring'] }
    ],
    ore: [
      { key: 'iron',   name: '철석',   emoji: '⛏️', price: 80,  w: 55 },
      { key: 'copper', name: '구리',   emoji: '🟤', price: 130, w: 30 },
      { key: 'silver', name: '은괴',   emoji: '⚪', price: 260, w: 15 },
      /* 별조각 — 바위에서는 안 나온다(w: 0). 별똥별에 빈 소원의 답례로만 온다 */
      { key: 'stardust', name: '별조각', emoji: '✨', price: 700, w: 0 }
    ],
    flower: [
      { key: 'azalea', name: '진달래', emoji: '🌸', price: 30,  w: 55, season: ['spring'] },
      { key: 'mugung', name: '무궁화', emoji: '🌺', price: 60,  w: 30, season: ['summer'] },
      { key: 'orchid', name: '난초',   emoji: '🪻', price: 150, w: 15 },
      { key: 'maple',  name: '단풍',   emoji: '🍁', price: 70,  w: 40, season: ['autumn'] },
      { key: 'sulwha', name: '설중매', emoji: '🤍', price: 210, w: 12, season: ['winter'] },
      /* 교배로만 나는 꽃 — 저절로는 피지 않는다(w: 0). 심은 꽃 곁에 다른 꽃이 있어야 한다 */
      { key: 'geumnang', name: '금낭화', emoji: '💗', price: 320, w: 0, hybrid: true },
      { key: 'jaran',    name: '자란',   emoji: '💜', price: 380, w: 0, hybrid: true },
      { key: 'hongmae',  name: '홍매',   emoji: '❤️', price: 460, w: 0, hybrid: true }
    ],
    /* 숲 고리 버섯숲 바이옴 전용(PLAN 18절 "약초") — 산삼은 드물게만(w 낮음) */
    herb: [
      { key: 'mugwort',   name: '쑥',     emoji: '🌿', price: 45,  w: 55, season: ['spring'] },
      { key: 'bellroot',  name: '도라지', emoji: '🌱', price: 75,  w: 35 },
      { key: 'reishi',    name: '영지버섯', emoji: '🍄', price: 140, w: 20, season: ['autumn'] },
      { key: 'ginseng',   name: '산삼',   emoji: '🫚', price: 520, w: 4 }
    ],
    /**
     * 곤충 — 원작의 큰 축. 채집물과 달리 **시간대(phase)** 도 탄다.
     * 반딧불이는 여름 밤에만 날고, 겨울엔 거의 아무것도 없다(원작 그대로).
     * form 은 화면이 무엇으로 그릴지 정한다 (village-view.js 의 drawBug).
     */
    bug: [
      { key: 'cabbage', name: '배추흰나비', emoji: '🦋', price: 40,  w: 50,
        form: 'butterfly', wing: '#f4f2ea', body: '#6b6b60', rain: 'no',
        season: ['spring', 'summer'], phase: ['dawn', 'day'] },
      { key: 'ladybug', name: '무당벌레',   emoji: '🐞', price: 60,  w: 42,
        form: 'ladybug', wing: '#d8452f', body: '#2b2b2b',
        season: ['spring', 'summer'], phase: ['day'] },
      { key: 'swallow', name: '호랑나비',   emoji: '🦋', price: 180, w: 26,
        form: 'butterfly', wing: '#f2d24a', body: '#3a3a30', rain: 'no',
        season: ['spring', 'summer'], phase: ['day'] },
      { key: 'hopper',  name: '방아깨비',   emoji: '🦗', price: 110, w: 34,
        form: 'hopper', wing: '#6fae4a', body: '#4f8a34',
        season: ['summer', 'autumn'], phase: ['dawn', 'day', 'even'] },
      { key: 'dragon',  name: '잠자리',     emoji: '🪰', price: 90,  w: 36,
        form: 'dragonfly', wing: '#cfe6f2', body: '#c0533a', rain: 'no',
        season: ['summer', 'autumn'], phase: ['day', 'even'] },
      { key: 'cicada',  name: '참매미',     emoji: '🦗', price: 120, w: 30,
        form: 'cicada', wing: '#d8e4ea', body: '#4a4a3c', perch: 'tree', rain: 'no',
        season: ['summer'], phase: ['day'] },
      { key: 'longhorn', name: '하늘소',    emoji: '🪲', price: 260, w: 18,
        form: 'beetle', wing: '#4a4f5a', body: '#2e323a', perch: 'tree',
        season: ['summer'], phase: ['day', 'even'] },
      { key: 'mantis',  name: '사마귀',     emoji: '🦗', price: 200, w: 20,
        form: 'hopper', wing: '#8ab84a', body: '#5f8a2f',
        season: ['autumn'], phase: ['day', 'even'] },
      { key: 'cricket', name: '귀뚜라미',   emoji: '🦗', price: 150, w: 26,
        form: 'hopper', wing: '#6a5a3a', body: '#3f3524',
        season: ['autumn'], phase: ['even', 'night'] },
      { key: 'firefly', name: '반딧불이',   emoji: '✨', price: 380, w: 14,
        form: 'firefly', wing: '#f6f0b4', body: '#4a4a2e', glow: true,
        season: ['summer'], phase: ['even', 'night', 'dawn'] },
      { key: 'rhino',   name: '장수풍뎅이', emoji: '🪲', price: 420, w: 10,
        form: 'beetle', wing: '#5a3a24', body: '#3a2416', horn: true, perch: 'tree',
        season: ['summer'], phase: ['night', 'dawn'] },
      { key: 'stag',    name: '사슴벌레',   emoji: '🪲', price: 460, w: 9,
        form: 'beetle', wing: '#2e2620', body: '#1a1512', jaw: true, perch: 'tree',
        season: ['summer'], phase: ['night', 'dawn'] },
      /* 달팽이 — **비 오는 날에만** 기어 나온다. 원작도 비에는 나는 벌레가 줄고
         땅을 기는 것이 는다 */
      { key: 'snail',   name: '달팽이',     emoji: '🐌', price: 90,  w: 34,
        form: 'snail', wing: '#c8b48a', body: '#7a6a52', rain: 'only',
        phase: ['dawn', 'day', 'even'] },
      { key: 'spider',  name: '거미',       emoji: '🕷️', price: 200, w: 16,
        form: 'spider', wing: '#3a3a44', body: '#22222a',
        phase: ['even', 'night'] },
      /* 말벌 — **저절로 나오지 않는다**(swarm). 나무를 흔들다 벌집을 건드려야 만난다.
         쫓아오는 놈을 채로 받아치면 잡힌다 — 원작의 그 자리다 */
      { key: 'wasp',    name: '말벌',       emoji: '🐝', price: 480, w: 0,
        form: 'wasp', wing: '#f0c23a', body: '#2a2118', swarm: true }
    ],
    /**
     * 화석 — **갈라진 자리(dig)를 삽으로 판다**. 계절도 시간대도 타지 않는다.
     * 원작에서 하루 몇 자리가 마을 여기저기에 생기던 그 자리다.
     * 흙만 나오지는 않는다 — 값이 낮은 것이 자주 나올 뿐이다.
     */
    fossil: [
      { key: 'shard',  name: '토기 조각',   emoji: '🏺', price: 60,  w: 40 },
      { key: 'oldcoin', name: '옛 동전',    emoji: '🪙', price: 120, w: 30 },
      { key: 'fern',   name: '고사리 화석', emoji: '🌿', price: 180, w: 26 },
      { key: 'fishf',  name: '물고기 화석', emoji: '🐟', price: 220, w: 22 },
      { key: 'trilo',  name: '삼엽충 화석', emoji: '🪲', price: 260, w: 18 },
      { key: 'ammon',  name: '암모나이트',  emoji: '🐚', price: 300, w: 16 },
      { key: 'track',  name: '새 발자국',   emoji: '🐾', price: 340, w: 13 },
      { key: 'tooth',  name: '공룡 이빨',   emoji: '🦷', price: 480, w: 9 },
      { key: 'bone',   name: '공룡 뼈',     emoji: '🦴', price: 620, w: 6 },
      { key: 'tusk',   name: '매머드 엄니', emoji: '🦣', price: 900, w: 3 }
    ],
    /** 조개 — **모래밭에 떨어져 있다.** 도구가 없어도 줍는다 */
    shell: [
      { key: 'godung', name: '고둥',       emoji: '🐌', price: 50,  w: 42 },
      { key: 'sora',   name: '소라',       emoji: '🐚', price: 70,  w: 34 },
      { key: 'daehap', name: '대합',       emoji: '🦪', price: 90,  w: 28 },
      { key: 'urchin', name: '성게 껍질',  emoji: '🦔', price: 140, w: 18 },
      { key: 'abalone', name: '전복 껍데기', emoji: '🪞', price: 260, w: 10 },
      { key: 'pearl',  name: '진주',       emoji: '🤍', price: 900, w: 3 }
    ],
    fish: [
      { key: 'crucian', name: '붕어',  emoji: '🐟', price: 50,  w: 45 },
      { key: 'carp',    name: '잉어',  emoji: '🐠', price: 100, w: 30 },
      { key: 'catfish', name: '메기',  emoji: '🐡', price: 170, w: 18, season: ['summer'] },
      { key: 'sturgeon', name: '철갑상어', emoji: '🦈', price: 420, w: 7 },
      { key: 'trout',   name: '송어',  emoji: '🐟', price: 190, w: 16, season: ['spring', 'autumn'] },
      { key: 'smelt',   name: '빙어',  emoji: '🎐', price: 240, w: 14, season: ['winter'] },
      { key: 'loach',   name: '미꾸라지', emoji: '🪱', price: 130, w: 30, rain: 'only' }
    ]
  };

  var ALL = {};
  (function () {
    for (var k in ITEMS) {
      if (!Object.prototype.hasOwnProperty.call(ITEMS, k)) { continue; }
      for (var i = 0; i < ITEMS[k].length; i++) {
        ITEMS[k][i].cat = k;
        ALL[ITEMS[k][i].key] = ITEMS[k][i];
      }
    }
  })();

  /**
   * 계절 — 실제 달을 본다. 나는 것과 땅빛이 바뀐다.
   * 원작에서 계절마다 잡히는 것이 달라지는 그 자리다.
   */
  var SEASONS = [
    { key: 'spring', name: '봄', months: [3, 4, 5],    grass: '#7cc356', grass2: '#88cd60',
      tint: 'rgba(255,205,225,0.05)', hello: '꽃이 한창입니다' },
    { key: 'summer', name: '여름', months: [6, 7, 8],  grass: '#5aa93f', grass2: '#66b449',
      tint: 'rgba(255,240,150,0.04)', hello: '볕이 뜨겁습니다' },
    { key: 'autumn', name: '가을', months: [9, 10, 11], grass: '#a8a247', grass2: '#b3ad51',
      tint: 'rgba(255,175,95,0.06)', hello: '단풍이 곱습니다' },
    { key: 'winter', name: '겨울', months: [12, 1, 2], grass: '#e2ecf1', grass2: '#eaf2f6',
      tint: 'rgba(205,230,255,0.07)', hello: '눈이 내립니다' }
  ];

  /** @param {number} month 1~12 */
  function seasonOf(month) {
    for (var i = 0; i < SEASONS.length; i++) {
      if (SEASONS[i].months.indexOf(month) >= 0) { return SEASONS[i]; }
    }
    return SEASONS[0];
  }

  /** 어드민 손잡이 — 잡혀 있으면 그것으로 본다 (자가진단·데모는 안 읽는다) */
  function knob(key) {
    var c = global.DG && global.DG.core;
    return c ? c.tuned(key, '') : '';
  }

  function season() {
    var k = knob('time.season');
    if (k) {
      var f = SEASONS.filter(function (x) { return x.key === k; });
      if (f[0]) { return f[0]; }
    }
    return seasonOf(new Date().getMonth() + 1);
  }

  /** 지금 계절에 나는 것인가 (season 칸이 없으면 사철 난다) */
  function inSeason(it, key) {
    if (!it.season) { return true; }
    return it.season.indexOf(key || season().key) >= 0;
  }

  /** 지금 시간대에 나오는 것인가 (phase 칸이 없으면 온종일 나온다) */
  function inPhase(it, key) {
    if (!it.phase) { return true; }
    return it.phase.indexOf(key || phaseOf(new Date().getHours()).key) >= 0;
  }

  /** 무게로 하나 고르기 — **지금 계절과 지금 하늘**에 나는 것만 고른다 */
  function pick(cat, seasonKey, weatherKey) {
    var all = ITEMS[cat];
    if (!all) { return null; }
    var key = seasonKey || season().key;
    var wk = weatherKey || weather().key;
    var list = all.filter(function (it) {
      return inSeason(it, key) && inWeather(it, wk);
    });
    if (!list.length) { list = all; }
    var total = 0, i;
    for (i = 0; i < list.length; i++) { total += list[i].w; }
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i].w;
      if (r <= 0) { return list[i]; }
    }
    return list[0];
  }

  /** 교배로만 나는 꽃 하나 — 값이 낮은 쪽이 자주 나온다 */
  function pickHybrid() {
    var list = ITEMS.flower.filter(function (it) { return it.hybrid; });
    if (!list.length) { return null; }
    var w = [50, 30, 20], total = 0, i;
    for (i = 0; i < list.length; i++) { total += (w[i] || 10); }
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= (w[i] || 10);
      if (r <= 0) { return list[i]; }
    }
    return list[0];
  }

  /** 마을 평가 등급 — 잡초를 뽑고 꽃을 심어야 오른다 */
  var BEAUTY_GRADES = [
    { at: 0,   name: '거친 마을' },
    { at: 60,  name: '손이 간 마을' },
    { at: 100, name: '정갈한 마을' },
    { at: 150, name: '아름다운 마을' },
    { at: 200, name: '이름난 마을' }
  ];

  function item(key) { return ALL[key] || null; }

  /** 시간대 — 실제 시계를 본다. 하늘색과 인사말이 바뀐다 */
  var PHASES = [
    { key: 'dawn',  from: 5,  name: '새벽', sky: '#5c7ea8', light: 'rgba(130,150,205,0.18)', hello: '이른 아침입니다' },
    { key: 'day',   from: 8,  name: '낮',   sky: '#7ec8e8', light: 'rgba(0,0,0,0)',          hello: '해가 높습니다' },
    { key: 'even',  from: 17, name: '저녁', sky: '#e88a5a', light: 'rgba(215,120,65,0.16)',  hello: '노을이 붉습니다' },
    { key: 'night', from: 20, name: '밤',   sky: '#20305a', light: 'rgba(14,22,52,0.44)',    hello: '밤이 깊습니다' }
  ];

  function phaseOf(hour) {
    var k = knob('time.phase');
    if (k) {
      var f = PHASES.filter(function (x) { return x.key === k; });
      if (f[0]) { return f[0]; }
    }
    var p = PHASES[PHASES.length - 1];
    for (var i = 0; i < PHASES.length; i++) { if (hour >= PHASES[i].from) { p = PHASES[i]; } }
    return hour < PHASES[0].from ? PHASES[PHASES.length - 1] : p;
  }

  /** 주민 부탁 — 채집물을 몇 개 가져다 주면 금과 친밀도를 준다 */
  var REQUEST_N = [2, 3, 4];

  /** 짐승(PLAN 40절 PHASE 4 첫 칸) — 사슴·여우·늑대에 이어 2026-09-09,
   *  토끼·다람쥐·오리·새도 CC0(poly.pizza, Poly by Google, CC-BY 3.0)를
   *  찾아 채웠다(`asset3d.js` DEFAULTS 참고 — 이제 "아직 못 채운 자리"는
   *  없다).
   *  biomes 는 이 짐승이 사는 바이옴(village.js 의 biomeAt() 키) 목록,
   *  wander/flee 단위는 그림 좌표(TILE=40)다
   *
   *  **2026-09-10 "동물들도 찾아봐" — 개구리·뱀 보탰다.** 바이옴별로 세어
   *  보니 mushroom 은 여우 하나뿐이고 dark·rocky 도 둘씩이라 숲 고리를
   *  걸어도 그 근방은 유독 휑했다. 새로 안 받고 `saga-go`(Quaternius 짐승
   *  팩, CC0)가 이미 갖고 있던 개구리·뱀을 옮겼다 — 자세한 출처는
   *  `assets/ASSET_LICENSES.md`. 덤으로 이 둘은 원본 GLB에 Idle·Walk(개구리는
   *  Jump) 클립이 실제로 있는데, 확인해 보니 사슴·여우·늑대도 이미 그랬다
   *  (애초에 있던 클립을 3D 화면이 여태 안 읽고 있었을 뿐 — `asset3d.js`
   *  `buildGeneric()` 고침 참고). 토끼·다람쥐·오리·새 넷만 정말 정지 모델이다 */
  var ANIMALS = {
    deer: { name: '사슴', emoji: '🦌', speed: 22, wander: 90, flee: 220, fleeSpeed: 70, biomes: ['green', 'meadow'] },
    fox:  { name: '여우', emoji: '🦊', speed: 26, wander: 80, flee: 190, fleeSpeed: 78, biomes: ['mushroom', 'rocky'] },
    wolf: { name: '늑대', emoji: '🐺', speed: 24, wander: 100, flee: 200, fleeSpeed: 74, biomes: ['dark', 'rocky'] },
    rabbit:   { name: '토끼',   emoji: '🐇', speed: 20, wander: 60, flee: 200, fleeSpeed: 82, biomes: ['green', 'meadow'] },
    squirrel: { name: '다람쥐', emoji: '🐿️', speed: 18, wander: 55, flee: 180, fleeSpeed: 80, biomes: ['green', 'dark'] },
    duck:     { name: '오리',   emoji: '🦆', speed: 14, wander: 45, flee: 160, fleeSpeed: 60, biomes: ['meadow'] },
    bird:     { name: '새',     emoji: '🐦', speed: 20, wander: 70, flee: 210, fleeSpeed: 95, biomes: ['green', 'meadow'] },
    frog:  { name: '개구리', emoji: '🐸', speed: 10, wander: 35, flee: 150, fleeSpeed: 50, biomes: ['mushroom', 'dark'] },
    snake: { name: '뱀',     emoji: '🐍', speed: 12, wander: 50, flee: 170, fleeSpeed: 55, biomes: ['rocky', 'dark'] },
    /* 포자괴물(2026-09-10, "괴물이 나와도 되고" — 퓨전 방향, PLAN 20절 "몬스터
       습격" 예시를 새 전투 없이 채운 첫 걸음). 나머지 짐승과 똑같은 idle/
       wander/flee 만 탄다 — 새 상태·전투는 안 만들었다. `rare: true`라
       buildAnimals() 의 일반 바이옴 뽑기 풀에는 안 끼고, `MONSTER_BIOME`
       경유로 아주 드물게만(8%) 여우 대신 선다 */
    mushnub: { name: '포자괴물', emoji: '🍄', speed: 16, wander: 40, flee: 160, fleeSpeed: 58,
      biomes: ['mushroom'], rare: true },
    /* 성간충(2026-09-14, PLAN 46-4 "다음에 이어갈 것" — Enemy_*, 우주기지
       전용 희귀 몬스터). 포자괴물과 같은 결로 idle/wander/flee 만 탄다(새
       전투 없음). 다만 우주기지(spaceBaseSpot)는 BIOME_CELL 격자(22칸)보다
       작은 자리(7×7)라 위 MONSTER_BIOME 경유 뽑기에 안 걸린다 — village.js
       buildAnimals() 가 courier NPC 와 같은 방식(고정 위치, 세이브 시드별
       확률)으로 따로 심는다. biomes 를 다섯 다 적어 둔 건 실제로 그 다섯 중
       아무 데서나 나서가 아니라, 자가진단의 "제 바이옴에만 선다" 검사가 그
       자리의 biomeAt() 해시값(세이브마다 달라짐, 우주기지와는 무관하게
       계산된다)과 어긋나지 않게 하기 위해서다 */
    spacebug: { name: '성간충', emoji: '👾', speed: 14, wander: 30, flee: 170, fleeSpeed: 62,
      biomes: ['green', 'meadow', 'dark', 'mushroom', 'rocky'], rare: true }
  };

  /** 바이옴별로 아주 드물게 나오는 몬스터 — buildAnimals() 가 일반 뽑기 뒤에
   *  낮은 확률로만 덮어쓴다. 늘리려면 여기 한 줄 + 위 ANIMALS 에 rare:true
   *  종 하나만 보태면 된다 */
  var MONSTER_BIOME = { mushroom: 'mushnub' };

  /** 숲 NPC(PLAN 40절 PHASE 4 NPC 칸) — PLAN 10절 "고정 배치" 그대로,
   *  이미 세운 지형지물(동굴·호수·캠프·폭포·버섯숲)마다 한 명씩 붙인다.
   *  대화·퀘스트·아이템·발견정보(PLAN 17절 역할 넷)는 다음 칸(Interaction·
   *  Quest)에서 채운다 — 지금은 이름과 인사말 하나만 가진 "만날 수 있는
   *  사람"으로 세운다. HEROES 로스터의 실제 인물은 안 물린다(재사용하면
   *  사연 없는 다른 인물이 튀어나온다) — 대신 2D는 npc.id를 해시해 고른
   *  Kenney 사람 그림(residents와 같은 stamp(), 2026-09-10), 3D는 npc.id를
   *  그대로 hero GLB 조합의 씨앗으로 쓴다(둘 다 로스터 밖 제 얼굴).
   *  emoji는 대화창·초점 카드 같은 UI 표시용으로 여전히 쓴다 */
  var NPCS = {
    keeper:    { name: '숲지기', emoji: '🧙', line: '이 숲은 내가 돌본다 — 짐승을 함부로 놀라게 하지 마시게',
      uniq: [
        '이 숲에 처음 들어왔을 때는 나도 다치고 지친 몸이었네 — 나무들이 날 살려줬지, 이제 내가 갚는 걸세.',
        '가끔 밤이 늦도록 짐승 발소리를 들으러 나온다네 — 다들 괜찮은지, 그게 내 마지막 인사길.',
        '자네가 자주 오니 이 숲도 전보다 밝아진 것 같군 — 착각이 아닐 걸세.' ] },
    angler:    { name: '낚시꾼', emoji: '🎣', line: '이 물엔 씨알 좋은 놈들이 산다네',
      uniq: [
        '젊을 적엔 남의 배를 얻어 타고 먼 물까지 나갔었지 — 지금은 이 자리가 내 바다일세.',
        '물속 놈들 성정도 사람 같아 — 서두르면 놓치고, 참으면 무는 법이지.',
        '낚싯대 하나로 예까지 흘러왔네만, 후회는 없어. 자네도 그런 것 하나쯤 있지 않나.' ] },
    merchant:  { name: '상인',   emoji: '🧺', line: '먼 길 다니며 이것저것 모았지 — 나중에 풀어놓겠네',
      uniq: [
        '짐을 지고 떠도는 삶이 고단하다 싶다가도, 이 마을에 짐을 풀면 이상하게 마음이 놓이네.',
        '값을 잘 쳐주는 게 아니라, 정직하게 쳐주는 걸세 — 그게 오래가는 장사 비결이지.',
        '언젠가 여기 정착할까 생각도 하네 — 아직은 길 위가 더 편하지만.' ] },
    explorer:  { name: '탐험가', emoji: '🧭', line: '이 폭포 너머에 뭐가 있는지 아직 아무도 몰라',
      uniq: [
        '폭포 너머는 아직도 못 가봤네 — 자네와 함께라면 한번 가볼 만도 하겠군.',
        '길을 잃는 게 무섭지 않아, 못 찾는 게 무서울 뿐이지.',
        '이 숲 구석구석을 다 안다고 자부했는데, 매번 새로운 걸 보는구먼.' ] },
    herbalist: { name: '약초꾼', emoji: '🌿', line: '버섯 숲엔 좋은 약초가 지천이야',
      uniq: [
        '손끝으로 잎을 만지면 그 풀이 뭘 낫게 하는지 대충 감이 온다네 — 오래 하다 보니.',
        '쓴 약이 몸에 좋다지만, 나는 되도록 덜 쓰게 지으려 하네.',
        '이 버섯숲은 내 스승이나 다름없어 — 말은 안 해도 늘 뭔가를 가르쳐 주거든.' ] },
    /* 나그네(2026-09-10) — 두 번째 캠프(hamlet2Spot, 2026-09-09에 자리만
       열고 "사람은 아직 없다"고 남겨 뒀던 곳)에 처음 세우는 사람.
       외딴집에서 하룻밤 묵어가는 컨셉이라 여정에 먹을 것을 청한다 */
    wanderer:  { name: '나그네', emoji: '🎒', line: '이 외딴집에서 하룻밤 신세 좀 지고 있다네',
      uniq: [
        '하룻밤만, 하룻밤만 하다가 벌써 여러 날일세 — 이 외딴집이 생각보다 정이 가는군.',
        '떠도는 삶엔 정 붙일 곳이 없어야 편한데, 요즘은 자꾸 여기가 눈에 밟히는군.',
        '다음 길 떠날 때는 자네 이야기도 하나 가져가겠네.' ] },
    /* 배달원(2026-09-11, PLAN 45절 "다른 마을·배달 알바") — 우주기지
       (spaceBaseSpot, 남서 대각선 먼 자리)에 처음 세우는 사람. 다른 다섯과
       달리 **QUESTS 에 없다** — 한 번뿐인 부탁 대신, 마을 courierPost에서
       받은 소포를 이 사람에게 가져다 주면 몇 번이고 보상을 받는 반복
       일거리를 맡는다(talkNpc() 의 별도 분기, 아래 courier 특수 처리 참고) */
    courier:   { name: '배달원', emoji: '📦', line: '먼 길 오느라 고생했네 — 소포는 잘 챙겨 왔나?',
      uniq: [
        '매번 같은 길인데도 자네한테 소포 건넬 때는 발걸음이 가벼워지는 게 이상하지.',
        '먼 길 다니다 보면 사람 귀한 줄 알게 되네 — 자네 같은 사람 만나는 게 그 보람일세.',
        '이 짐 다 나르고 나면, 언젠가 나도 어디 한 군데 눌러앉고 싶어지더군.' ] }
  };

  /**
   * 숲 NPC 여섯의 부탁 — 하나씩, 한 번만(PLAN 19절 "미니 퀘스트").
   * **복잡한 시스템은 안 만든다** — PLAN 19절이 예로 든 넷(꽃 5개·잃어버린
   * 상자·짐승 발견·숲 깊은 곳 NPC)을 그대로 다섯 NPC에 하나씩 얹었고, 여섯
   * 번째(나그네)도 같은 bagcat 결로 얹었다.
   * type 은 village.js 의 questProgress() 가 셋만 안다(bagcat·chest·meetnpc).
   * **배달원(courier, 2026-09-11)은 이 표에 없다** — 반복 가능한 일이라
   * "한 번뿐인 부탁"을 전제하는 이 표·questProgress() 결과 안 맞는다.
   * village.js 의 talkNpc()가 courier만 따로 갈라 처리한다.
   */
  var QUESTS = {
    herbalist: { title: '약초 다섯 뿌리',
      description: '버섯 숲 약초를 다섯 뿌리만 캐다 주게',
      type: 'bagcat', cat: 'herb', count: 5, reward: 400 },
    angler: { title: '씨알 좋은 물고기',
      description: '물고기 세 마리만 낚아다 주게',
      type: 'bagcat', cat: 'fish', count: 3, reward: 350 },
    merchant: { title: '꽃 다섯 송이',
      description: '꽃 다섯 송이만 모아다 주게 — 팔 데가 있어',
      type: 'bagcat', cat: 'flower', count: 5, reward: 300 },
    /* 2026-09-10 — 나그네가 여섯 번째로 늘어 count 4 → 5(자신 뺀 나머지 전부).
       2026-09-11 — 배달원(courier)이 일곱 번째로 늘었지만 QUESTS가 없는
       특수 NPC라도 meetnpc는 "만나 봤나"만 보므로 그대로 세어진다 — count
       5 → 6(자신 뺀 나머지 여섯 전부) */
    explorer: { title: '숲의 나머지 사람들',
      description: '이 숲 다른 사람들도 다 만나고 왔나?',
      type: 'meetnpc', count: 6, reward: 500 },
    keeper: { title: '동굴의 보물',
      description: '북쪽 동굴에 보물이 숨어 있다던데, 찾았나?',
      type: 'chest', count: 1, reward: 300 },
    wanderer: { title: '길양식',
      description: '먼 길 갈 양식으로 밤·잣 네 알만 나눠 주게',
      type: 'bagcat', cat: 'nut', count: 4, reward: 320 }
  };

  global.DG = global.DG || {};
  /**
   * 등급(아이템·장비 등급 체계 — 사용자 요청 2026-09-10, 이 판 적용 2026-09-20) — 이 판엔 장비도 접사도 없고 물건마다 **값**이 있다.
   * 등급은 굴리지 않고 값에서 읽는다(값·세이브·판정에 안 닿는 이름표):
   *   goods   가구·옷·바닥·벽   <800 기본 · <1600 상급 · <2800 희귀 · <4200 영웅 · 그 이상 전설
   *   gather  채집물·물고기·벌레 <60 기본 · <120 상급 · <250 희귀 · <450 영웅 · 그 이상 전설
   * 이름·색·별은 도감 인물·펫이 쓰는 `data.js` 의 `RARITY` 와 같다.
   */
  var GRADE_CUTS = { goods: [800, 1600, 2800, 4200], gather: [60, 120, 250, 450] };
  function gradeOf(kind, price) {
    var cuts = GRADE_CUTS[kind] || GRADE_CUTS.goods, p = price || 0, r = 1;
    while (r <= cuts.length && p >= cuts[r - 1]) { r++; }
    var R = global.DG && global.DG.data && global.DG.data.rarity && global.DG.data.rarity[r];
    return { rank: r, name: R ? R.name : '', color: R ? R.color : '#9aa4b2', label: R ? R.label : '' };
  }

  /** 격자 만남 갈래(PLAN §5.5 ①) — w 는 뽑기 무게. 정령(여섯째)은 spirit.js 가 따로 세운다 */
  var ENCOUNTER_KINDS = {
    chest:  { name: '숲 보물상자',   emoji: '🧰', w: 5 },
    bottle: { name: '쪽지 병',       emoji: '🍾', w: 5 },
    node:   { name: '빛나는 채집터', emoji: '💎', w: 4 },
    herd:   { name: '짐승 무리',     emoji: '🦌', w: 3 },
    camp:   { name: '나그네의 야영', emoji: '⛺', w: 3 }
  };

  /* 택배 사슬(PLAN §5.7) — parcel.js 가 읽는다.
     소포 갈래 셋은 서로 다른 축이다: 보통(안전) · 깨지기(살금살금 걸어야, 대신 후하다) · 시간제한(빨라야, 대신 후하다).
     원안의 "시간제한 현실 5분" 은 이 판 걸음(118/초 = 약 3타일/초)에선 60타일도 20초라 아무 위험이 없어,
     시한을 거리에 비례(TIMED_BASE + TIMED_PER_TILE × 타일)로 줄였다. 걷기만 하면 넉넉하고 딴짓하면 늦는다 */
  var PARCEL_KINDS = {
    plain:   { name: '보통 소포',       emoji: '📦', mul: 1,   note: '조심할 게 없다' },
    fragile: { name: '깨지기 쉬운 소포', emoji: '🥚', mul: 1.6, brokenMul: 0.5, grace: 2, note: '살금살금 걸어야 한다 — 그냥 걸은 지 2초가 넘으면 깨진다' },
    timed:   { name: '시간제한 소포',   emoji: '⏱️', mul: 1.5, lateMul: 0.7,     note: '시한 안에 가져다 줘야 한다' }
  };
  var DELIVERY_DESTS = {
    space:   { name: '우주기지',        emoji: '🚀', npc: 'courier' },
    ruin:    { name: '폐허의 옛 우체통', emoji: '🏚️', prop: 'oldpost' },
    hamlet:  { name: '작은 마을',       emoji: '🏘️', npc: 'merchant' },
    hamlet2: { name: '외딴집',          emoji: '⛺', npc: 'wanderer' }
  };
  var DELIVERY_GRADES = [
    { at: 10, name: '수레',   note: '내 집 앞에 배달 수레가 선다', line: '택배 기사 달음: 수레가 생겼으니 이제 어엿한 동료예요! 바퀴 자국이 마을 길이 될 거예요.' },
    { at: 30, name: '우주복', note: '침선방 옷장에 배달원 우주복이 든다', line: '택배 기사 달음: 우주복이라니, 앞날 배달원 옷이에요! 이 마을 소포가 별까지 간다는 뜻이죠.' },
    { at: 60, name: '로버',   note: '우주기지의 탐사차에 앉아 볼 수 있다', line: '택배 기사 달음: 육십 건! 이제 탐사차도 몰 자격이 있어요. 길 없는 곳도 배달하러 가요!' }
  ];

  global.DG.villageData = {
    PARCEL_KINDS: PARCEL_KINDS, DELIVERY_DESTS: DELIVERY_DESTS, DELIVERY_GRADES: DELIVERY_GRADES,
    ENCOUNTER_KINDS: ENCOUNTER_KINDS,
    gradeOf: gradeOf,
    TILES: TILES, PROPS: PROPS, ITEMS: ITEMS, PHASES: PHASES, REQUEST_N: REQUEST_N,
    ANIMALS: ANIMALS, MONSTER_BIOME: MONSTER_BIOME, NPCS: NPCS, QUESTS: QUESTS,
    SEASONS: SEASONS, TOOLS: TOOLS,
    FURNITURE: FURNITURE, FURN_SETS: FURN_SETS, furn: furn,
    WALLS: WALLS, FLOORS: FLOORS, wall: wall, floor: floor,
    MUSEUM_GRADES: MUSEUM_GRADES, MUSEUM_CATS: MUSEUM_CATS, BUNDLES: BUNDLES,
    FOLK_TYPES: FOLK_TYPES, HEART_UNLOCKS: HEART_UNLOCKS, MEMENTO_FRAMES: MEMENTO_FRAMES, MEMENTO_GOLD: MEMENTO_GOLD, MEMENTO_FEAT: MEMENTO_FEAT,
    WEAR_PARTS: WEAR_PARTS, WEAR_COATS: WEAR_COATS, WEAR_HEADS: WEAR_HEADS,
    WEAR_DYES: WEAR_DYES, WEAR_CAPES: WEAR_CAPES,
    wearPart: wearPart, wearItem: wearItem,
    TOWN_NAMES: TOWN_NAMES, FLAG_BGS: FLAG_BGS, FLAG_FGS: FLAG_FGS, FLAG_SYMS: FLAG_SYMS,
    EVENTS: EVENTS, eventOf: eventOf, nextEventOf: nextEventOf,
    TASK_POOL: TASK_POOL, TASK_AXES: TASK_AXES, WEEKLY_POOL: WEEKLY_POOL, CAT_NAME: CAT_NAME,
    pickDayTasks: pickDayTasks, pickWeekTask: pickWeekTask, eventTaskOf: eventTaskOf,
    WEATHERS: WEATHERS, weather: weather, weatherOf: weatherOf, inWeather: inWeather,
    _setWeather: function (v) { weatherOverride = v; },
    HOME_TIERS: HOME_TIERS, HOME_GRADES: HOME_GRADES,
    pick: pick, pickHybrid: pickHybrid, item: item, phaseOf: phaseOf,
    BEAUTY_GRADES: BEAUTY_GRADES,
    season: season, seasonOf: seasonOf, inSeason: inSeason, inPhase: inPhase,
    all: function () { return ALL; }
  };
})(window);
