/**
 * 고정 세계 지도(世界地圖) — 마을 사이 들판을 미리 구워 둔다 (PLAN §5.12)
 * ---------------------------------------------------------------
 * 2026-09-24 사용자: "맵이 생성되는 중간중간에 캐릭터가 끼고 움직이지를 못한다 —
 * 전체를 미리 생성해서, 로그라이크처럼 랜덤이 아니라 특색 있게 지역을 꾸며 고정으로.
 * 원작처럼 특색 지역이 각각 있고, 현대·미래·과거가 다 있는 퓨전 원작."
 *
 * 끼던 까닭(고친 것):
 *   ① 들판 칸은 **지금 가장 가까운 마을**의 씨앗·테마로 뽑혔다. 마을 사이를 걷다
 *      가장 가까운 마을이 바뀌는 순간 둘레 들판 전체가 다른 씨앗으로 다시 뽑혀
 *      발밑에 나무·바위가 새로 섰다.
 *   ② 그림(`dungeon3d.buildField`)은 **로컬 칸 좌표**로, 충돌(`dungeon.fieldBlockedAt`)은
 *      **세계 칸 좌표**로 `chunkAt` 을 불렀다. 앵커가 (0,0)인 모루골 말고는
 *      "보이는 나무"와 "막히는 자리"가 서로 달랐다(보이지 않는 벽).
 *
 * 이제 들판 칸 하나는 **세계 칸 좌표(cx,cz)만으로** 정해진다 — 그 칸이 속한 지역(고정
 * 배치)과 그 칸에서 가장 가까운 마을(고정) 둘 다 칸의 성질이지 플레이어 위치가 아니다.
 * 그림·충돌·자동지도 세 곳이 이 파일 하나만 읽는다.
 *
 * 지역 아홉 — 모루골(세계 원점)을 가운데 두고 중원(가운데 원) + 여덟 방위.
 * 경계는 부드러운 고정 잡음으로 굽힌다(자로 그은 선이 안 보이게). 무작위가 아니다 —
 * 같은 칸은 어느 기기에서 몇 번을 걸어도 같은 지역·같은 지형이다.
 *
 * 순수 배치(`regionAt`)는 town.js 보다 먼저 실려야 한다 — 절차 생성 마을 100 의
 * 성격(biome)을 지역에서 받는다. 칸 굽기(`bake`·`info`·`pieces`)는 town·field3d 를
 * 부를 때 찾는다(지연 조회).
 */
(function (global) {
  'use strict';

  /* ── 지역 ─────────────────────────────────────────────────
   * era: past(과거) · modern(현대) · future(미래) · myth(신화) — 한 지역에 둘까지.
   * bias: field3d THEME_BIAS 와 같은 모양(가중치 배수) — 'region:<key>' 로 등록한다.
   * props: 이 지역에만 서는 시대 소품(field3d/dungeon3d 가 이미 그리는 t_* 다섯) · rate 는 칸 비율.
   * ground: 들판 땅 색. town: 이 지역에 앉는 절차 생성 마을의 성격(town-gen.js BIOME_KEYS).
   */
  var REGIONS = [
    { key: 'jungwon', name: '중원 벌판', hanja: '中原', era: ['past'], emoji: '🌾',
      desc: '기와와 초가 사이로 논두렁과 숲이 이어진다',
      bias: { forest: 1.9, camp: 1.6, road: 1.4, water: 0.9, ruin: 0.6, rock: 0.7, swamp: 0.4 },
      props: [], rate: 0, ground: 0x46632f, town: 'forest' },
    { key: 'neon', name: '잿빛 폐도시', hanja: '廢都市', era: ['modern'], emoji: '🏭',
      desc: '무너진 공장 굴뚝과 콘크리트 잔해, 멈춘 급수탑',
      bias: { ruin: 3.4, road: 2.6, rock: 1.2, forest: 0.12, water: 0.3, swamp: 0.2, camp: 0.8 },
      props: ['t_factory', 't_tower'], rate: 0.22, ground: 0x57524b, town: 'ruins' },
    { key: 'saltmarsh', name: '소금 개펄', hanja: '鹽田', era: ['past', 'modern'], emoji: '🦀',
      desc: '물 빠진 갯벌과 갈대, 바다를 보던 녹슨 관측탑',
      bias: { swamp: 4.5, water: 3.2, road: 0.8, forest: 0.2, rock: 0.4, ruin: 0.5 },
      props: ['t_tower'], rate: 0.09, ground: 0x6d6b52, town: 'swamp' },
    { key: 'hellgate', name: '지옥 균열', hanja: '地獄龜裂', era: ['myth'], emoji: '🔥',
      desc: '붉게 갈라진 바위와 동굴 아가리, 잎 없는 나무들',
      bias: { rock: 2.4, cave: 5.5, altar: 2.2, swamp: 2.2, forest: 0.05, water: 0.05, road: 0.5, camp: 0.2 },
      props: [], rate: 0, ground: 0x4d2621, town: 'mountain' },
    { key: 'solar', name: '태양 신도시', hanja: '新都市', era: ['future'], emoji: '🔆',
      desc: '태양광 판이 늘어선 개척지, 반듯한 길과 야영 천막',
      bias: { road: 2.8, camp: 4.0, forest: 0.35, ruin: 0.7, water: 0.8, rock: 0.5, swamp: 0.15 },
      props: ['t_solar'], rate: 0.24, ground: 0x5d6c3e, town: 'forest' },
    { key: 'silkroad', name: '서역 모랫길', hanja: '西域', era: ['past'], emoji: '🐫',
      desc: '대상(隊商)의 야영지와 모래에 반쯤 묻힌 옛 유적',
      bias: { rock: 1.8, ruin: 2.2, camp: 4.0, altar: 3.0, road: 1.4, forest: 0.04, water: 0.08, swamp: 0.04 },
      props: [], rate: 0, ground: 0xa08a5a, town: 'mountain' },
    { key: 'heaven', name: '천계 사당', hanja: '天界', era: ['myth', 'future'], emoji: '☁️',
      desc: '구름 위 사당과 빛으로 새긴 홀로그램 비석',
      bias: { altar: 7.0, road: 1.6, forest: 0.5, water: 1.4, ruin: 0.5, swamp: 0.05 },
      props: ['t_hologram'], rate: 0.12, ground: 0x6b6b8c, town: 'shrine' },
    { key: 'snowfort', name: '북방 설산', hanja: '北方雪山', era: ['past', 'modern'], emoji: '🏔️',
      desc: '눈 덮인 산성 폐허, 골짜기를 가로지르는 케이블카 기둥',
      bias: { rock: 2.2, ruin: 1.6, forest: 0.7, water: 0.2, swamp: 0.1, camp: 0.9 },
      props: ['t_pylon'], rate: 0.13, ground: 0x8e959d, town: 'mountain' },
    { key: 'scrap', name: '기계 황무지', hanja: '機械荒蕪', era: ['future'], emoji: '🤖',
      desc: '쓰러진 기계 더미 사이로 홀로그램 표지가 깜빡인다',
      bias: { ruin: 2.4, rock: 1.6, altar: 1.5, forest: 0.15, water: 0.2, swamp: 0.3, road: 0.9 },
      props: ['t_hologram', 't_pylon'], rate: 0.17, ground: 0x4b4553, town: 'ruins' }
  ];
  /* ── 지역 몬스터·위험도·우두머리(§5.13) ─────────────────────
   * lvl: 지역 기본 위험도 — 들판 ctx.floor 가 된다(적 세기·내 원소 피해·전리품·경험치가 같이 탄다).
   *      중원 0(예전 마을 들판과 같다), 가운데서 멀수록 3000 마다 +1(상한 30).
   * roster: 이 지역에 나오는 몬스터(data-enemy.js 표시 이름). 단계(tier)가 위험도를 넘는 것은 안 나온다.
   * boss: 지역 우두머리 — 고정 자리에 선다. base 는 몸(그림)을 빌려 올 몬스터. 이름은 전부 창작 */
  var FOES = {
    jungwon: { lvl: 0,
      roster: ['황건적', '산적', '도적떼', '들개', '떠돌이 병졸', '멧돼지', '말벌떼', '애기버섯', '이끼괴물',
               '왜구', '마적', '왕멧돼지', '왕말벌떼', '고목정', '거란 기병', '몽골 기병', '흑기병', '근위 기병'],
      boss: { id: 'rb_jungwon', name: '벌판 흑기 대장', emoji: '🐴', base: '흑기병', color: '#2a2a3a',
              desc: '중원 도적떼를 한데 거느린 검은 기병' } },
    neon: { lvl: 3,
      roster: ['들쥐떼', '강철랑', '동합귀', '역병쥐떼', '은신 첩자', '강철익수', '동력파룡', '그림자 자객',
               '심야 첩자', '왜군 조총병', '강철판갑', '칠흑 자객', '연노 사수', '초강폭룡'],
      boss: { id: 'rb_neon', name: '폐도시 폭주룡', emoji: '🏭', base: '초강폭룡', color: '#6a4a3a',
              desc: '멈춘 공장을 둥지 삼은 강철 짐승' } },
    saltmarsh: { lvl: 2,
      roster: ['독사', '청개구리', '늪슬라임', '집게괴', '철갑해', '늪 왕슬라임', '괴이두꺼비', '묵늪슬라임',
               '먹물 요괴', '흑사', '이무기', '독개구리', '심연늪슬라임', '심해 먹물귀', '수군 척후선',
               '흑이무기', '왕독개구리', '수군 함대', '심연촉수귀'],
      boss: { id: 'rb_saltmarsh', name: '개펄 촉수왕', emoji: '🐙', base: '심연촉수귀', color: '#2a4a5a',
              desc: '물 빠진 갯벌 밑에서 올라온 촉수' } },
    hellgate: { lvl: 6,
      roster: ['풋귀', '해골졸개', '원혼', '해골무사', '원귀', '해골귀', '가시귀', '구천혼', '해골척후', '탐귀',
               '해골법사', '악귀', '청귀', '해골대장', '백골귀왕', '탐욕귀왕', '철가시귀', '강시', '화염귀',
               '해골대법사', '대청귀', '역병강시', '겁화귀'],
      boss: { id: 'rb_hellgate', name: '균열 문지기 겁옥', emoji: '🔥', base: '겁화귀', color: '#8a1a10',
              desc: '갈라진 땅을 지키는 불의 문지기' } },
    solar: { lvl: 4,
      roster: ['강철랑', '동합귀', '홍슬라임', '결정슬라임', '강철익수', '동력파룡', '회오리 정령', '폭풍 정령',
               '강철판갑', '기계외안', '대가시슬라임', '폭풍거인', '초강폭룡'],
      boss: { id: 'rb_solar', name: '태양로 폭주 거신', emoji: '🔆', base: '폭풍거인', color: '#c9a020',
              desc: '과열된 태양로가 깨운 거인' } },
    silkroad: { lvl: 3,
      roster: ['들개', '독사', '오랑캐 궁수', '마적', '남만 코끼리병', '쾌조룡', '왕거미', '뿔공룡', '전상코끼리병',
               '여진 궁수', '볏공룡', '판갑룡', '독왕거미', '왕뿔공룡', '삼각뿔룡', '장경룡', '폭룡'],
      boss: { id: 'rb_silkroad', name: '모래바다 폭군', emoji: '🐫', base: '삼각뿔룡', color: '#b08a4a',
              desc: '대상 길목을 끊어 놓은 뿔 달린 폭군' } },
    heaven: { lvl: 5,
      roster: ['원혼', '구천혼', '회오리 정령', '산도깨비', '요술사', '폭풍 정령', '왕도깨비', '대요술사',
               '노산도깨비', '노왕도깨비', '기계외안', '강철촉수귀'],
      boss: { id: 'rb_heaven', name: '타락한 천장', emoji: '☁️', base: '대요술사', color: '#8a8ad9',
              desc: '하늘 사당을 버리고 칼을 든 옛 수호장' } },
    snowfort: { lvl: 4,
      roster: ['산적', '동굴슬라임', '홍슬라임', '산짐승 요괴', '산도깨비', '설인', '산야인', '산군', '외눈귀',
               '위군 창병', '노산야인', '대설인', '빙하대설인', '설산군주', '백두산군', '거인', '철갑 중장병'],
      boss: { id: 'rb_snowfort', name: '만년설 거한', emoji: '🏔️', base: '빙하대설인', color: '#c9d9e8',
              desc: '산성 폐허를 차지한 눈의 거한' } },
    scrap: { lvl: 6,
      roster: ['강철랑', '동합귀', '철갑해', '가시슬라임', '강철익수', '동력파룡', '청동거목', '진흙귀신',
               '강철판갑', '기계외안', '철가시귀', '왕진흙귀신', '심연진흙귀신', '태고진흙귀신', '초강폭룡', '강철촉수귀'],
      boss: { id: 'rb_scrap', name: '고철 거신', emoji: '🤖', base: '강철촉수귀', color: '#5a626e',
              desc: '쓰러진 기계를 모아 스스로 일어선 것' } }
  };
  var LEVEL_STEP = 3000, LEVEL_MAX = 30;

  var BY = {};
  REGIONS.forEach(function (r, i) {
    r.idx = i; BY[r.key] = r; r.theme = 'region:' + r.key;
    var f = FOES[r.key];
    r.lvl = f.lvl; r.roster = f.roster; r.boss = f.boss;
  });

  /** 들판 위험도(= 그 자리 ctx.floor) — 지역 기본값 + 가운데서 멀어진 만큼 */
  function levelAt(wx, wy) {
    var r = regionAt(wx, wy);
    if (r.key === 'jungwon') { return 0; }
    var far = Math.max(0, Math.hypot(wx, wy) - CENTER_R);
    return Math.min(LEVEL_MAX, r.lvl + Math.floor(far / LEVEL_STEP));
  }

  /**
   * 지역 우두머리 자리 — 방위 한가운데 반지름 28000(중원은 8500), 그 자리가 딴 지역이거나
   * 마을 발판에 너무 가까우면 반지름·각도를 정해진 순서로 조금씩 옮긴다(무작위 없음).
   */
  var spotCache = {};
  function placeSpot(key, cacheK, a0, r0) {
    if (spotCache[cacheK]) { return spotCache[cacheK]; }
    var R0 = BY[key], t = global.DG.town, k, best = null;
    if (!R0) { return null; }
    for (k = 0; k < 40; k++) {
      var dr = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 700, da = ((k >> 2) % 2 ? 1 : -1) * Math.floor(k / 4) * 0.05;
      var x = Math.round(Math.cos(a0 + da) * (r0 + dr)), y = Math.round(Math.sin(a0 + da) * (r0 + dr));
      if (regionAt(x, y) !== R0) { continue; }
      if (t && t.nearestTownId && t.footprintDist(t.nearestTownId(x, y), x, y) < 2200) { continue; }
      best = { x: x, y: y };
      break;
    }
    if (!best) { best = { x: Math.round(Math.cos(a0) * r0), y: Math.round(Math.sin(a0) * r0) }; }
    if (t && t.nearestTownId) { spotCache[cacheK] = best; }   // 마을이 실린 뒤에만 붙든다
    return best;
  }
  function bossSpot(key) {
    var si = SECTORS.indexOf(key), step = Math.PI * 2 / SECTORS.length;
    return placeSpot(key, 'boss:' + key, si < 0 ? Math.PI * 0.75 : si * step, si < 0 ? 8500 : 28000);
  }
  /**
   * 지역 사연 사슬(§5.14) 둘째 걸음 "흔적" 자리 — 우두머리보다 안쪽(반지름 19000, 중원 5200),
   * 방위 한가운데서 조금 비껴(+0.22 rad) 선다. 옮기는 규칙은 우두머리와 같다(무작위 없음).
   */
  function clueSpot(key) {
    var si = SECTORS.indexOf(key), step = Math.PI * 2 / SECTORS.length;
    return placeSpot(key, 'clue:' + key, si < 0 ? Math.PI * 1.6 : si * step + 0.22, si < 0 ? 5200 : 19000);
  }

  /** 가운데 원(중원) 반지름 — 손으로 지은 넷(모루골·갈대나루·자작재·소금벌, 앵커 ±6400)이 다 들어간다 */
  var CENTER_R = 11500;
  /** 여덟 방위 — 0 은 동쪽, 시계 방향(화면 y 가 남쪽). 이 순서가 곧 지역 배치다 */
  var SECTORS = ['neon', 'saltmarsh', 'hellgate', 'solar', 'silkroad', 'heaven', 'snowfort', 'scrap'];

  function mix(a, b) {
    var h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  /** 부드러운 고정 잡음 −1~1 (값 잡음, 격자 cell 마다 한 값·쌍선형 보간) */
  function noise(x, y, cell, salt) {
    var gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    var fx = x / cell - gx, fy = y / cell - gy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = mix(gx + salt, gy), b = mix(gx + 1 + salt, gy), c = mix(gx + salt, gy + 1), d = mix(gx + 1 + salt, gy + 1);
    return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * 2 - 1;
  }

  /** 세계 좌표 한 점의 지역 — 순수 함수 */
  function regionAt(wx, wy) {
    var r = Math.hypot(wx, wy) + noise(wx, wy, 5200, 811) * 1800;
    if (r < CENTER_R) { return BY.jungwon; }
    var a = Math.atan2(wy, wx) + noise(wx, wy, 7000, 433) * 0.22;
    var n = SECTORS.length, step = Math.PI * 2 / n;
    var i = Math.round(a / step);
    i = ((i % n) + n) % n;
    return BY[SECTORS[i]];
  }

  /* ── 굽기 ─────────────────────────────────────────────────
   * 세계 칸(CHUNK 200) ±BOUND 네모 전부 — 지역·주인 마을·종류를 표 하나에 담는다.
   * 부팅 뒤 잠깐씩 나눠 굽고(`bakeStep`, 한 번에 몇 줄), 아직 안 구운 칸을 물으면
   * 그 자리에서 같은 산식으로 셈한다 — 결과가 같으니 순서는 상관없다.
   * 소품 목록(pieces)은 칸을 처음 물을 때 만들어 **그대로 붙들어 둔다**(같은 칸은 늘 같은 배열).
   */
  var BOUND = 240;                    // ±48000 — 앵커 최대(46520)+마을 발판을 덮는다
  var SIDE = BOUND * 2 + 1;
  var KIND_LIST = ['town', 'forest', 'rock', 'ruin', 'road', 'water', 'cave', 'altar', 'camp', 'swamp'];
  var KIND_IDX = {};
  KIND_LIST.forEach(function (k, i) { KIND_IDX[k] = i + 1; });   // 0 = 아직 안 구움

  var grid = null;                    // { W, H, region:Uint8, owner:Uint8, ring:Uint8, kind:Uint8, rows }
  var pieceCache = {}, clutterCache = {}, cacheN = 0;
  var CACHE_MAX = 30000;
  var townIds = null;                 // 주인 마을 번호 → id

  function T() { return global.DG.town; }
  function F() { return global.DG.field3d; }

  function registerBias() {
    var f = F();
    if (!f || !f.setBias || registerBias.done) { return; }
    REGIONS.forEach(function (r) { f.setBias(r.theme, r.bias); });
    registerBias.done = true;
  }

  function ensureGrid(W, H) {
    if (grid && grid.W === W && grid.H === H) { return grid; }
    var t = T(), anchors = t && t.worldAnchors ? t.worldAnchors() : null;
    townIds = anchors ? Object.keys(anchors) : [];
    grid = { W: W, H: H, region: new Uint8Array(SIDE * SIDE), owner: new Uint8Array(SIDE * SIDE),
             ring: new Uint8Array(SIDE * SIDE), kind: new Uint8Array(SIDE * SIDE), rows: 0, anchors: anchors };
    pieceCache = {}; clutterCache = {}; cacheN = 0;
    return grid;
  }

  function inBound(cx, cz) { return cx >= -BOUND && cx <= BOUND && cz >= -BOUND && cz <= BOUND; }

  /** 칸 하나 셈하기(굽기와 즉석 조회가 같은 몸통을 쓴다) */
  function compute(g, cx, cz, k) {
    var f = F(), t = T();
    var C = f.CHUNK, wx = cx * C + C / 2, wz = cz * C + C / 2;
    var reg = regionAt(wx, wz);
    var oid = t.nearestTownId(wx, wz), oi = townIds.indexOf(oid);
    var a = g.anchors[oid] || { x: 0, y: 0 };
    var ring = f.ringOf(cx - Math.floor(a.x / C), cz - Math.floor(a.y / C), g.W, g.H);
    var kind = ring === 0 ? 'town' : f.kindOf(cx, cz, seedOf(reg), ring, reg.theme);
    g.region[k] = reg.idx + 1;
    g.owner[k] = oi + 1;
    g.ring[k] = Math.min(255, ring);
    g.kind[k] = KIND_IDX[kind] || 1;
  }

  function seedOf(reg) { return (reg.idx + 1) * 7919 + 20260924; }

  /**
   * 칸 하나의 성질 — 지역·주인 마을·주인 마을에서 몇 칸(ring)·종류.
   * W,H 는 마을 방 치수(데스크톱이면 커진다 — ring 0 이 발판을 덮어야 소품이 발판에 안 선다).
   */
  function info(cx, cz, W, H) {
    registerBias();
    var t = T(), f = F();
    if (!t || !f || !t.nearestTownId) { return null; }
    var g = ensureGrid(W, H);
    if (!inBound(cx, cz)) {
      var C = f.CHUNK, reg = regionAt(cx * C + C / 2, cz * C + C / 2);
      return { region: reg, owner: null, ring: 99, kind: 'rock', seed: seedOf(reg) };
    }
    var k = (cz + BOUND) * SIDE + (cx + BOUND);
    if (!g.kind[k]) { compute(g, cx, cz, k); }
    var rg = REGIONS[g.region[k] - 1];
    return { region: rg, owner: townIds[g.owner[k] - 1] || null, ring: g.ring[k],
             kind: KIND_LIST[g.kind[k] - 1], seed: seedOf(rg) };
  }

  function cacheKey(cx, cz) { return cx + ',' + cz; }
  function remember(which, key, v) {
    if (cacheN > CACHE_MAX) { pieceCache = {}; clutterCache = {}; cacheN = 0; }
    (which === 'c' ? clutterCache : pieceCache)[key] = v;   // 비워도 산식이 같아 다시 만든 배열도 같다
    cacheN++;
    return v;
  }

  /** 칸 하나에 서는 소품(충돌·그림 공용) — 세계 좌표 {t,x,z,s,rot,h}. 마을 발판(ring 0)은 빈 배열 */
  function pieces(cx, cz, W, H) {
    var inf = info(cx, cz, W, H);
    if (!inf || inf.ring === 0) { return []; }
    var key = cacheKey(cx, cz), c = pieceCache[key];
    if (c) { return c; }
    /* §5.19 — 밀도 1 이면 숲 칸 하나(200)에 나무 7~14 그루가 다 길을 막아 떼를 몰 자리가 없었다.
       손잡이 dg.worldDens(기본 0.5). 그림과 충돌이 이 한 배열을 같이 쓴다 */
    var list = F().chunkAt(cx, cz, inf.seed, inf.ring, (global.DG.core && global.DG.core.tuned ? global.DG.core.tuned('dg.worldDens', 0.5) : 1), inf.region.theme);
    return remember('p', key, list);
  }

  /**
   * 잡초 층 + 지역 시대 소품(판정 안 닿음). 시대 소품은 ring 2 밖, 물·동굴·길이 아닌 칸에
   * 지역 비율(rate)만큼 — 자리·종류 전부 칸 좌표 해시라 늘 같은 칸에 선다.
   */
  function clutter(cx, cz, W, H, dens) {
    var inf = info(cx, cz, W, H);
    if (!inf || inf.ring === 0) { return []; }
    var key = cacheKey(cx, cz) + ':' + Math.round((dens === undefined ? 1 : dens) * 100), c = clutterCache[key];
    if (c) { return c; }
    var f = F(), list = f.clutterAt(cx, cz, inf.seed, inf.ring, dens, inf.region.theme).slice();
    var R = inf.region, k = inf.kind;
    if (R.rate > 0 && inf.ring >= 2 && k !== 'water' && k !== 'cave' && k !== 'road' && k !== 'town') {
      var h = mix(cx * 977 + 31, cz * 613 - 17);
      if (h < R.rate) {
        var C = f.CHUNK;
        list.push({ t: R.props[Math.floor(mix(cx * 53 + 7, cz * 89 + 3) * R.props.length) % R.props.length],
          x: cx * C + C * (0.3 + mix(cx * 11, cz * 7 + 5) * 0.4), z: cz * C + C * (0.3 + mix(cz * 13, cx * 5 + 9) * 0.4),
          s: 1, rot: mix(cx * 71, cz * 53) * 6.28, h: 90 });
      }
    }
    return remember('c', key, list);
  }

  /** 자동지도용 종류('town' 이면 마을 발판) */
  function kindAt(cx, cz, W, H) { var i = info(cx, cz, W, H); return i ? i.kind : null; }

  /** 칸 하나를 미리 굽는다 — 한 번 부를 때 rows 줄씩. 다 구웠으면 true */
  function bakeStep(W, H, rows) {
    var t = T(), f = F();
    if (!t || !f || !t.nearestTownId) { return false; }
    registerBias();
    var g = ensureGrid(W, H), n = rows || 8, r, cx, k;
    for (r = 0; r < n && g.rows < SIDE; r++, g.rows++) {
      var cz = g.rows - BOUND;
      for (cx = -BOUND; cx <= BOUND; cx++) {
        k = (cz + BOUND) * SIDE + (cx + BOUND);
        if (!g.kind[k]) { compute(g, cx, cz, k); }
      }
    }
    return g.rows >= SIDE;
  }
  /** 다 구웠나 · 몇 줄까지 */
  function bakeProgress() { return grid ? grid.rows / SIDE : 0; }

  /** 굽는 동안 브라우저를 안 막게 — 잠깐씩 나눠 끝까지(부팅 뒤 한 번). 진단은 안 부른다 */
  var bakingFor = null;
  function bakeInBackground(W, H) {
    var key = W + 'x' + H;
    if (bakingFor === key) { return; }
    bakingFor = key;
    (function tick() {
      if (bakingFor !== key) { return; }
      /* 한 번에 4ms 까지만(한 줄 481칸 ≈ 수 ms) — 걷는 프레임을 안 먹게 */
      var done = false, now = function () { return global.performance ? global.performance.now() : Date.now(); };
      var t0 = now();
      try { do { done = bakeStep(W, H, 1); } while (!done && now() - t0 < 4); } catch (e) { done = true; }
      if (!done) { setTimeout(tick, 24); }
    })();
  }

  global.DG = global.DG || {};
  global.DG.worldMap = {
    REGIONS: REGIONS, byKey: function (k) { return BY[k] || null; }, CENTER_R: CENTER_R, BOUND: BOUND,
    regionAt: regionAt, info: info, pieces: pieces, clutter: clutter, kindAt: kindAt,
    levelAt: levelAt, bossSpot: bossSpot, clueSpot: clueSpot, LEVEL_STEP: LEVEL_STEP, LEVEL_MAX: LEVEL_MAX,
    bakeStep: bakeStep, bakeProgress: bakeProgress, bakeInBackground: bakeInBackground,
    /** 절차 생성 마을의 성격 — 그 앵커 자리 지역에서 받는다(town.js 가 부른다) */
    townBiomeAt: function (wx, wy) { return regionAt(wx, wy).town; },
    /** 자가진단 — 표를 비워 처음부터(굽기 없이 즉석 셈) */
    _reset: function () { grid = null; pieceCache = {}; clutterCache = {}; cacheN = 0; bakingFor = null; }
  };
})(window);
