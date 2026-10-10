/**
 * 지역(地域) — 오픈월드 RPG식 지역 지도 (PLAN §5 ⑩, 2026-09-24 사용자 선택 "맵형태도")
 * ---------------------------------------------------------------
 * 손그림 땅 밖은 노이즈 들판이 끝없이 같았다. 세상을 **1.2km 지터 격자 보로노이**로
 * 나눠 지역마다 풍경을 준다.
 *
 *   고향 들녘   원점 지역 — 옛 지형 비율 그대로(회귀 없음), 랜드마크 대신 고향 마을
 *   푸른 벌판 · 대숲 골짜기 · 붉은 협곡 · 안개 늪 · 옛 성터 고원
 *
 * 바이옴이 바꾸는 것: 노이즈 지형 문턱(물·산·숲·마을 비율 — `world.terrainAt`),
 * 기복 세기(`relief3d`), 들판 적 무리 꼴(`field-combat` ⑨). 손으로 그린 땅과 실제
 * GPS 지형(OSM)은 그대로다 — 그쪽이 먼저 답한다.
 *
 * 지역 한가운데 **랜드마크**(탑)가 서고 금빛 기둥이 멀리서 보인다. 25m 안에 가면
 * 지역 발견 + **순간이동 지점**이 열린다 — 전체 지도(M)에서 눌러 건너뛴다(키보드
 * 모드만, 실제 GPS 로 걷는 중엔 안 된다). 지역 경계를 넘으면 이름 띠가 뜬다.
 *
 * 판정 층(`cellAt`·`regionAt`·`bandAt`·`reliefAt`·`biomeAt`·`landmarks`)은 순수
 * 함수다. 세이브는 `save.regions = { 지역키: 발견 시각 }` 하나(읽는 쪽 기본값).
 *
 * §5 ⑮ 고정 특색 지역(2026-09-24 사용자 "전체 지역을 랜덤이 아닌 사가나락처럼 각각 특색 있는
 * 지역으로", 전 프로젝트 공통) — 칸의 바이옴·이름을 해시로 뽑지 않는다. 고향을 가운데 두고
 * 방위 여덟 × 고리 둘(안쪽 6km · 바깥) = **이름 있는 땅 열여섯**(`ZONES`)이 고정 배치되고,
 * 칸은 제가 속한 땅의 바이옴·지명 표를 받는다. 경계는 칸 좌표만으로 정해지는 고정 흔들림으로
 * 굽힌다(자로 그은 선이 안 보이게). 땅이 바뀌면 큰 이름 띠(이모지·이름·한자·사연).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { return core().tuned('biome.' + key, def); }
  function on() { return K('on', 1) ? true : false; }

  var SIZE = 1200;          // 지역 격자(m)
  var BLEND = 260;          // 경계에서 섞이는 폭(m)
  var LM_CLEAR = 34;        // 랜드마크 둘레는 들로 비운다(물 위에 탑이 서지 않게)
  var FIND_R = 25;          // 이만큼 다가가면 발견

  /* share = [물, 산, 숲, 마을] %, 나머지가 들. 고향은 world.js 옛 비율 그대로 */
  var BIOMES = {
    home:   { key: 'home',   name: '고향 들녘',   noun: '들녘', desc: '숲과 마을이 뒤섞인 첫 땅',     share: [14, 18, 36, 12], relief: 1.0,  color: '#9bc46f' },
    plain:  { key: 'plain',  name: '푸른 벌판',   noun: '벌판', desc: '바람이 먼저 닿는 너른 들',     share: [8, 8, 22, 12],   relief: 0.75, color: '#c3dc6a', themes: [0, 3, 4, 6], elites: [2], boss: 0.05 },
    bamboo: { key: 'bamboo', name: '대숲 골짜기', noun: '대숲', desc: '하늘을 가린 짙은 숲',          share: [10, 14, 52, 10], relief: 1.15, color: '#5ea85a', themes: [1, 0, 4, 7], elites: [0], boss: 0.04 },
    canyon: { key: 'canyon', name: '붉은 협곡',   noun: '협곡', desc: '불도깨비가 사는 바위 골',      share: [5, 46, 12, 7],   relief: 1.9,  color: '#e0824e', themes: [1, 4, 5, 8], elites: [0], boss: 0.09 },
    marsh:  { key: 'marsh',  name: '안개 늪',     noun: '늪',   desc: '물두꺼비 울음이 번지는 물가',  share: [34, 4, 30, 8],   relief: 0.5,  color: '#5fb3b3', themes: [2, 5, 6], elites: [1], boss: 0.04 },
    ruins:  { key: 'ruins',  name: '옛 성터 고원', noun: '고원', desc: '무너진 성벽 위로 번개가 친다', share: [6, 26, 14, 20],  relief: 1.4,  color: '#b3a3dc', themes: [3, 4, 5, 8], elites: [2], boss: 0.1 }
  };


  /* ── 고정 특색 지역(§5 ⑮) ──────────────────────────────────────────
   * 방위 여덟(0 = +x 쪽, 칸 좌표 각도 순) × 고리 둘. era: past·modern·future·myth(퓨전 — 사가나락 §5.12 와 같은 결).
   * biome 은 위 다섯 중 하나(지형 문턱·기복·무리 꼴을 그대로 빌린다), places 는 그 땅 칸들의 지명. 이름은 전부 창작 */
  var RING_R = 6000;
  var ZONES = [
    /* 안쪽 고리 — 걸어서 닿는 이웃 땅 */
    { key: 'cheongpung', ring: 0, name: '청풍 벌판', hanja: '淸風', emoji: '🌾', biome: 'plain', era: 'past',
      desc: '바람개비가 도는 너른 들 — 봄이면 종달새가 먼저 운다',
      places: ['바람개비 언덕', '여울목', '종달새 들', '느티 마당', '보리밭 둑', '청풍 나루'] },
    { key: 'galdae', ring: 0, name: '갈대 나루', hanja: '蘆津', emoji: '🦆', biome: 'marsh', era: 'past',
      desc: '갈대 사이로 나룻배가 잠든 물가',
      places: ['갈대 숲길', '옛 나루터', '물새 섬', '버들 여울', '안개 선착장', '두꺼비 못'] },
    { key: 'jugeup', ring: 0, name: '대숲 고을', hanja: '竹邑', emoji: '🎋', biome: 'bamboo', era: 'past',
      desc: '하늘을 가린 대나무 사이로 옛 고을 기와가 보인다',
      places: ['죽림 오솔길', '학이 앉은 골', '바람 대숲', '옛 고을 터', '이슬 계곡', '대숲 사당'] },
    { key: 'gamagol', ring: 0, name: '가마골', hanja: '窯谷', emoji: '🏺', biome: 'canyon', era: 'past',
      desc: '도자기 가마 연기가 붉은 바위 골을 채운다',
      places: ['불가마 터', '붉은 벼랑', '가마꾼 마을', '노을 바위', '깨진 항아리 골', '화염 고개'] },
    { key: 'gojeong', ring: 0, name: '옛 성터 언덕', hanja: '古城', emoji: '🏯', biome: 'ruins', era: 'past',
      desc: '무너진 성벽이 언덕을 두른다 — 밤이면 옛 병사들이 돈다',
      places: ['무너진 성문', '망루 터', '돌거인 언덕', '잊힌 우물', '옛 왕의 길', '봉화 둑'] },
    { key: 'dalho', ring: 0, name: '달그림자 호수', hanja: '月影湖', emoji: '🌙', biome: 'marsh', era: 'myth',
      desc: '달이 두 개 비친다는 안개 호수',
      places: ['달그림자 물가', '잠긴 사당', '물안개 섬', '은빛 여울', '용궁 나루', '거울 못'] },
    { key: 'solryeong', ring: 0, name: '솔숲 고개', hanja: '松嶺', emoji: '🌲', biome: 'bamboo', era: 'past',
      desc: '소나무 고개 너머 산적이 길을 막는다',
      places: ['솔바람 고개', '산적 망루', '송진 골', '호랑이 바위', '약초 비탈', '고개 주막'] },
    { key: 'hwanggeum', ring: 0, name: '황금 들녘', hanja: '黃金野', emoji: '🌻', biome: 'plain', era: 'modern',
      desc: '해바라기 밭 사이로 녹슨 경운기와 전봇대가 서 있다',
      places: ['해바라기 밭', '녹슨 경운기', '전봇대 길', '양봉 언덕', '허수아비 들', '간이역 터'] },
    /* 바깥 고리 — 멀리 떠나야 닿는 땅(현대·미래·신화가 섞인다) */
    { key: 'neon', ring: 1, name: '잿빛 폐도시', hanja: '廢都市', emoji: '🏭', biome: 'ruins', era: 'modern',
      desc: '멈춘 공장 굴뚝과 무너진 고가도로',
      places: ['멈춘 공장', '무너진 고가', '네온 간판 거리', '지하철 입구', '녹슨 급수탑', '빈 주차장'] },
    { key: 'saltflat', ring: 1, name: '소금 갯벌', hanja: '鹽田', emoji: '🦀', biome: 'marsh', era: 'modern',
      desc: '물 빠진 갯벌에 녹슨 관측탑이 기울어 있다',
      places: ['소금 창고', '녹슨 관측탑', '갯골', '염전 둑', '난파선', '칠게 벌'] },
    { key: 'dragon', ring: 1, name: '용의 협곡', hanja: '龍峽', emoji: '🐉', biome: 'canyon', era: 'myth',
      desc: '거대한 발톱 자국이 난 붉은 협곡 — 하늘에서 불이 떨어진다',
      places: ['용 발톱 벼랑', '불비 골', '비늘 바위', '용알 둥지', '화산 입', '천둥 다리'] },
    { key: 'solar', ring: 1, name: '태양 신도시', hanja: '新都市', emoji: '🔆', biome: 'plain', era: 'future',
      desc: '태양광 판이 끝없이 늘어선 개척지',
      places: ['태양광 들', '반듯한 신작로', '개척 천막촌', '충전탑', '드론 활주로', '유리 온실'] },
    { key: 'silkroad', ring: 1, name: '서역 모랫길', hanja: '西域', emoji: '🐫', biome: 'canyon', era: 'past',
      desc: '대상의 낙타 방울이 모래바람 속에 울린다',
      places: ['대상 야영지', '모래 묻힌 탑', '오아시스', '낙타 방울 고개', '붉은 사구', '비단길 관문'] },
    { key: 'heaven', ring: 1, name: '천계 구름 사당', hanja: '天界', emoji: '☁️', biome: 'ruins', era: 'myth',
      desc: '구름 위 사당과 빛으로 새긴 홀로그램 비석',
      places: ['구름 사당', '빛의 비석', '선녀 계단', '별자리 제단', '천문 누각', '무지개 다리'] },
    { key: 'snowfort', ring: 1, name: '북방 설산', hanja: '北方雪山', emoji: '🏔️', biome: 'ruins', era: 'modern',
      desc: '눈 덮인 산성과 케이블카 기둥이 골짜기를 가로지른다',
      places: ['눈 덮인 산성', '케이블카 기둥', '얼음 폭포', '설인 굴', '북풍 고개', '만년설 봉'] },
    { key: 'scrap', ring: 1, name: '기계 황무지', hanja: '機械荒蕪', emoji: '🤖', biome: 'plain', era: 'future',
      desc: '쓰러진 기계 더미 사이로 홀로그램 표지가 깜빡인다',
      places: ['고철 산', '쓰러진 거신', '홀로그램 표지', '기름 늪', '부품 시장', '정지한 공장'] }
  ];
  /* 땅 전용 퓨전 소품(§5 ⑰ 넷째 · SAGA-DESIGN §13 "전체 퓨전 — 과거·현대·미래를 한 자리에").
     main = 제 색깔(세우는 몫 60%), mix = 나머지 시대(40%). 땅마다 main+mix 에 과거·현대·미래가 다 든다.
     키는 prop3d FUSION 표 */
  var ZONE_PROPS = {
    cheongpung: { main: ['windmill', 'hay', 'cart'], mix: ['streetlight', 'solar_low'] },
    galdae:     { main: ['barrel', 'crate'], mix: ['antenna', 'radar'] },
    jugeup:     { main: ['cart', 'bonfire', 'barrel'], mix: ['traffic', 'dome'] },
    gamagol:    { main: ['cauldron', 'bonfire'], mix: ['propane', 'turret'] },
    gojeong:    { main: ['wall', 'crate'], mix: ['stop', 'turret'] },
    dalho:      { main: ['tree_light', 'tree_float'], mix: ['barrel', 'lamp2', 'radar'] },
    solryeong:  { main: ['tent', 'bonfire'], mix: ['lamp2', 'rover'] },
    hwanggeum:  { main: ['streetlight', 'propane'], mix: ['hay', 'cart', 'solar'] },
    neon:       { main: ['ac', 'lamp2', 'stop'], mix: ['wall', 'tank'] },
    saltflat:   { main: ['antenna', 'propane'], mix: ['barrel', 'crate', 'rover'] },
    dragon:     { main: ['tree_lava'], mix: ['bonfire', 'propane', 'turret'] },
    solar:      { main: ['solar', 'dome', 'capsule'], mix: ['windmill', 'streetlight'] },
    silkroad:   { main: ['tent', 'cactus', 'palm'], mix: ['propane', 'rover'] },
    heaven:     { main: ['tree_float', 'tree_spiral'], mix: ['wall', 'lamp2', 'dome'] },
    snowfort:   { main: ['pylon', 'antenna', 'pine_snow', 'rock_snow'], mix: ['tent', 'radar'] },
    scrap:      { main: ['tank', 'turret', 'rover'], mix: ['cart', 'ac'] }
  };
  var ZBY = {};
  ZONES.forEach(function (z, i) { z.sector = i % 8; ZBY[z.key] = z; z.props = ZONE_PROPS[z.key] || null; });
  /** 칸(i, j)의 땅 — 칸 좌표만으로(고정 흔들림으로 경계를 굽힌다). 고향 칸은 null */
  function zoneOfCell(i, j) {
    if (i === 0 && j === 0) { return null; }
    var a = Math.atan2(j, i) + (h3(i, j, 17) - 0.5) * 0.34;
    var sec = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    var d = Math.hypot(i, j) * SIZE + (h3(i, j, 19) - 0.5) * SIZE;
    return ZONES[(d < RING_R ? 0 : 8) + sec];
  }

  /* 노이즈 누적 분포 → 문턱(world.js 가 400만 표본으로 잰 분위수에 끝점만 더했다) */
  var CDF = [[0, 0], [0.14, 0.1614], [0.32, 0.2106], [0.68, 0.2905], [0.80, 0.3211], [1.0, 0.5]];
  function invCdf(q) {
    for (var i = 1; i < CDF.length; i++) {
      if (q <= CDF[i][0]) {
        var a = CDF[i - 1], b = CDF[i], t = (q - a[0]) / ((b[0] - a[0]) || 1);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return 0.5;
  }
  function bandOf(B) {
    if (B._band) { return B._band; }
    var s = B.share, c = 0, out = [];
    for (var i = 0; i < 4; i++) { c += s[i] / 100; out.push(invCdf(c)); }
    B._band = { water: out[0], mount: out[1], forest: out[2], town: out[3] };
    return B._band;
  }

  function h3(a, b, s) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  var cellCache = {}, cellCount = 0;
  /** 격자 한 칸 = 지역 하나. 가운데·바이옴·이름이 칸 좌표만으로 정해진다 */
  function cellAt(i, j) {
    var k = i + '_' + j;
    var c = cellCache[k];
    if (c) { return c; }
    var home = i === 0 && j === 0;
    var z = home ? null : zoneOfCell(i, j);
    var bk = home ? 'home' : z.biome;
    var B = BIOMES[bk];
    c = {
      key: k, i: i, j: j, biome: bk, zone: z ? z.key : 'home',
      x: (i + (h3(i, j, 1) - 0.5) * 0.7) * SIZE,
      y: (j + (h3(i, j, 2) - 0.5) * 0.7) * SIZE,
      name: home ? B.name : z.places[Math.floor(h3(i, j, 5) * 2 * z.places.length) % z.places.length]
    };
    if (home) { c.x = 0; c.y = 0; }
    if (cellCount > 3000) { cellCache = {}; cellCount = 0; }
    cellCache[k] = c; cellCount++;
    return c;
  }

  /** 이 자리는 어느 지역이냐 — 가장 가까운 가운데(와 둘째) */
  function regionAt(x, y) {
    var i0 = Math.floor((x + SIZE / 2) / SIZE), j0 = Math.floor((y + SIZE / 2) / SIZE);
    var best = null, second = null, d1 = Infinity, d2 = Infinity;
    for (var dj = -1; dj <= 1; dj++) {
      for (var di = -1; di <= 1; di++) {
        var c = cellAt(i0 + di, j0 + dj);
        var d = Math.hypot(c.x - x, c.y - y);
        if (d < d1) { second = best; d2 = d1; best = c; d1 = d; }
        else if (d < d2) { second = c; d2 = d; }
      }
    }
    return { cell: best, second: second, d1: d1, d2: d2 };
  }

  function biomeAt(x, y) { return BIOMES[regionAt(x, y).cell.biome]; }

  /**
   * 섞는 비율 — 둘레 아홉 지역마다 (그 거리 − 가장 가까운 거리)가 BLEND 안이면
   * 1 에서 0 으로 준다. 둘째만 섞으면 세 지역이 만나는 자리에서 "둘째"가 바뀌는
   * 순간 값이 튄다(진단이 잡았다) — 아홉을 다 가중하면 어디서든 이어진다.
   */
  function mix(x, y) {
    var i0 = Math.floor((x + SIZE / 2) / SIZE), j0 = Math.floor((y + SIZE / 2) / SIZE);
    var cs = [], ds = [], d1 = Infinity, near = null, k;
    for (var dj = -1; dj <= 1; dj++) {
      for (var di = -1; di <= 1; di++) {
        var c = cellAt(i0 + di, j0 + dj), d = Math.hypot(c.x - x, c.y - y);
        cs.push(c); ds.push(d);
        if (d < d1) { d1 = d; near = c; }
      }
    }
    var ws = [], sum = 0;
    for (k = 0; k < cs.length; k++) {
      var t = 1 - (ds[k] - d1) / BLEND;
      var w = t > 0 ? t * t * (3 - 2 * t) : 0;
      ws.push(w); sum += w;
    }
    for (k = 0; k < ws.length; k++) { ws[k] /= sum; }
    return { cells: cs, ws: ws, near: near, d1: d1 };
  }

  /** 노이즈 지형 문턱 — 경계에서 이웃 바이옴과 섞인다(선이 안 생긴다). 순수 함수 */
  function bandAt(x, y) {
    var m = mix(x, y), o = { water: 0, mount: 0, forest: 0, town: 0 };
    for (var k = 0; k < m.cells.length; k++) {
      if (!m.ws[k]) { continue; }
      var b = bandOf(BIOMES[m.cells[k].biome]);
      o.water += b.water * m.ws[k]; o.mount += b.mount * m.ws[k];
      o.forest += b.forest * m.ws[k]; o.town += b.town * m.ws[k];
    }
    o.clear = m.d1 < LM_CLEAR && m.near.biome !== 'home';
    return o;
  }

  /** 기복 배수 — 협곡은 험하고 늪은 평평하다(화면 층) */
  function reliefAt(x, y) {
    var m = mix(x, y), r = 0;
    for (var k = 0; k < m.cells.length; k++) { r += BIOMES[m.cells[k].biome].relief * m.ws[k]; }
    return r;
  }

  /** 내 둘레 랜드마크(고향 제외) — 가까운 순 */
  function landmarks(x, y, R) {
    var out = [], rad = Math.ceil((R || 1500) / SIZE) + 1;
    var i0 = Math.floor((x + SIZE / 2) / SIZE), j0 = Math.floor((y + SIZE / 2) / SIZE);
    for (var dj = -rad; dj <= rad; dj++) {
      for (var di = -rad; di <= rad; di++) {
        var c = cellAt(i0 + di, j0 + dj);
        if (c.biome === 'home') { continue; }
        var d = Math.hypot(c.x - x, c.y - y);
        if (d <= (R || 1500)) { out.push({ key: c.key, x: c.x, y: c.y, biome: c.biome, name: c.name, dist: d }); }
      }
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  /* ══ 런타임 ═══════════════════════════════════════════════ */
  function regions() {
    var s = core().save;
    if (!s.regions || typeof s.regions !== 'object') { s.regions = {}; }
    return s.regions;
  }
  function found(key) { return key === '0_0' || !!regions()[key]; }

  /** 발견 — 처음 한 번만 보상. 순간이동 지점이 열린다 */
  function discover(key) {
    if (found(key)) { return false; }
    var c = core(), g = regions();
    g[key] = Date.now();
    var FC = global.DG.fieldCombat, parts = key.split('_');
    var cell = cellAt(+parts[0], +parts[1]);
    var tier = FC ? FC.tierAt(cell.x, cell.y) : 1;
    var gold = 60 + 30 * tier;
    c.save.player.gold = (c.save.player.gold || 0) + gold;
    c.save.dust = (c.save.dust || 0) + 2;
    if (c.gainExp) { c.gainExp(40); }
    c.log('🗼 지역 발견 — ' + cell.name + ' (금 +' + gold + ' · 순간이동 지점)', 'discover');
    if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast('🗼 ' + cell.name + ' 발견! 순간이동 지점이 열렸다 (M)'); }
    if (global.DG.audio) { try { global.DG.audio.play('discover'); } catch (e) { /* 소리는 없어도 된다 */ } }
    c.emit('region:found', { key: key, name: cell.name });
    c.persist();
    return true;
  }

  /** 순간이동 지점 목록 — 고향 마을 + 발견한 랜드마크 */
  function waypoints() {
    var out = [{ key: '0_0', x: 0, y: 0, name: '고향 마을', biome: 'home' }];
    var g = regions();
    for (var k in g) {
      if (!g.hasOwnProperty(k)) { continue; }
      var p = k.split('_'), c = cellAt(+p[0], +p[1]);
      out.push({ key: k, x: c.x, y: c.y, name: c.name, biome: c.biome });
    }
    return out;
  }

  /** 순간이동 — 키보드 모드만(실제 GPS 로 걷는 중엔 몸이 거기 있다). 성공하면 true */
  function teleport(key) {
    var W = global.DG.world;
    if (!W || W.mode !== 'keyboard' || !found(key)) { return false; }
    var p = key.split('_'), c = cellAt(+p[0], +p[1]);
    var pos = core().save.player.pos;
    pos.x = c.x; pos.y = c.y + 8;
    if (W.walkTo) { W.walkTo(pos.x, pos.y); }
    core().log('🌀 순간이동 — ' + c.name, 'move');
    core().emit('region:teleport', { key: key });
    return true;
  }

  /* ══ ⑬ 지역 사명 — 지역마다 세 단(탑 찾기 → 그 지역 무리 토벌 → 탑 곁 수호자) ══════
   * 단은 **앞에서부터 차례로** 채워진다 — 탑을 찾기 전에 무리를 쳐 두면 셈은 쌓이고, 탑을
   * 찾는 순간 둘째 단까지 한꺼번에 넘어간다. 보상은 넘어간 단마다 한 번(`paid`). 첫 단 보상은
   * 발견(`discover`)이 이미 준다. 진행은 save.missions = { 지역키: { clears, paid } } */
  var MISSION_CLEARS = 2;
  function missions() {
    var s = core().save;
    if (!s.missions || typeof s.missions !== 'object') { s.missions = {}; }
    return s.missions;
  }
  /** 순수 함수 — st = { found, clears, guard } → 세 단과 지금 단 */
  function missionView(st) {
    var n = Math.min(MISSION_CLEARS, st.clears || 0);
    var steps = [
      { k: 'find', text: '가운데 탑을 찾아라', done: !!st.found },
      { k: 'clear', text: '이 지역 무리 토벌 ' + n + '/' + MISSION_CLEARS, done: (st.clears || 0) >= MISSION_CLEARS },
      { k: 'guard', text: '탑 곁 수호자를 쓰러뜨려라', done: !!st.guard }
    ];
    var stage = 0;
    while (stage < steps.length && steps[stage].done) { stage++; }
    return { steps: steps, stage: stage, next: steps[stage] || null, done: stage === steps.length };
  }
  function missionState(key) {
    var m = missions()[key] || {}, fs = core().save.field;
    return { found: found(key), clears: m.clears || 0, guard: !!(fs && fs.guards && fs.guards[key]), paid: m.paid || 0 };
  }
  /** 단이 넘어갔으면 보상 — 둘째 단 금 80×등급·단사 2, 셋째(평정) 금 200×등급·단사 10 */
  function progressMission(key) {
    if (!key || key === '0_0') { return null; }
    var c = core(), g = missions(), st = missionState(key), v = missionView(st);
    var m = g[key] || (g[key] = { clears: 0, paid: 0 });
    if (v.stage <= (m.paid || 0)) { return v; }
    var p = key.split('_'), cell = cellAt(+p[0], +p[1]);
    var FC = global.DG.fieldCombat, tier = FC ? FC.tierAt(cell.x, cell.y) : 1;
    if (v.stage >= 2 && (m.paid || 0) < 2) {
      var g2 = 80 * tier;
      c.save.player.gold = (c.save.player.gold || 0) + g2;
      c.save.dust = (c.save.dust || 0) + 2;
      c.log('📜 ' + cell.name + ' 사명 2/3 — 무리를 몰아냈다 (금 +' + g2 + ')', 'discover');
      if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast('📜 ' + cell.name + ' 사명 2/3 — 이제 탑 곁 수호자'); }
    }
    if (v.done) {
      var g3 = 200 * tier;
      c.save.player.gold = (c.save.player.gold || 0) + g3;
      c.save.dust = (c.save.dust || 0) + 10;
      c.log('🏯 ' + cell.name + ' 평정 — 사명 3/3 (금 +' + g3 + ' · 단사 +10)', 'discover');
      if (global.DG.ui && global.DG.ui.toast) { global.DG.ui.toast('🏯 ' + cell.name + ' 평정! 금 +' + g3 + ' · 단사 +10'); }
      c.emit('region:settled', { key: key, name: cell.name });
    }
    m.paid = v.stage;
    c.persist();
    return v;
  }
  function onFieldClear(e) {
    if (!e || e.x === undefined || !on()) { return; }
    var key = regionAt(e.x, e.y).cell.key;
    if (key === '0_0') { return; }
    var g = missions(), m = g[key] || (g[key] = { clears: 0, paid: 0 });
    m.clears = (m.clears || 0) + 1;
    progressMission(key);
  }
  var subscribed = false;
  function subscribe() {
    if (subscribed || !core() || !core().on) { return; }
    subscribed = true;
    core().on('field:clear', onFieldClear);
    core().on('field:guard', function (e) { if (e && e.region) { progressMission(e.region); } });
    core().on('region:found', function (e) { if (e && e.key) { progressMission(e.key); } });
  }

  var missionEl = null, missionTxt = '';
  function paintMission(cell) {
    if (!global.document || global.DG_NO_DRAW) { return; }
    var txt = '';
    if (cell.biome !== 'home') {
      var v = missionView(missionState(cell.key));
      if (!v.done) { txt = '📜 ' + cell.name + ' 사명 ' + v.stage + '/3 · ' + v.next.text; }
    }
    if (txt === missionTxt) { return; }
    missionTxt = txt;
    if (!missionEl) {
      missionEl = document.createElement('div');
      missionEl.id = 'region-mission';
      document.body.appendChild(missionEl);
    }
    missionEl.textContent = txt;
    missionEl.style.display = txt ? '' : 'none';
  }

  var lastKey = null, lastZone = null, bannerEl = null, bannerT = 0, acc = 0;
  var beams = {};

  function banner(cell) {
    if (!global.document || global.DG_NO_DRAW) { return; }
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'region-banner';
      document.body.appendChild(bannerEl);
    }
    var B = BIOMES[cell.biome], z = ZBY[cell.zone];
    bannerEl.style.setProperty('--bc', B.color);
    var head = z && cell.zone !== lastZone ? z.emoji + ' ' + z.name + '(' + z.hanja + ')' : (z ? z.emoji + ' ' + z.name + ' · ' + cell.name : cell.name);
    var sub = z && cell.zone !== lastZone ? z.desc + ' — ' + cell.name : (z ? z.desc : B.desc);
    bannerEl.innerHTML = '<b>' + head + '</b><small>' + sub + (found(cell.key) ? '' : ' · 가운데 탑을 찾아라') + '</small>';
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    bannerT = 3.2;
  }

  function tick(dt) {
    if (!on() || !core() || !core().save) { return; }
    subscribe();
    var pos = core().save.player.pos;
    acc += dt;
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0 && bannerEl) { bannerEl.classList.remove('show'); } }
    if (acc < 0.25) { return; }
    acc = 0;
    var r = regionAt(pos.x, pos.y);
    if (r.cell.key !== lastKey) {
      if (lastKey !== null) { banner(r.cell); }
      lastKey = r.cell.key;
      if (r.cell.zone !== lastZone) {
        if (lastZone !== null) { core().emit('zone:enter', { key: r.cell.zone }); }
        lastZone = r.cell.zone;
      }
    }
    var c = r.cell;
    if (c.biome !== 'home' && !found(c.key) && Math.hypot(pos.x - c.x, pos.y - c.y) < FIND_R) { discover(c.key); }
    if (!global.DG_NO_DRAW) { paintBeams(pos); paintMission(c); if (global.DG.landmark3d) { global.DG.landmark3d.paint(pos); } }   // W-0162 거리 이름표(landmark3d.js)
  }

  /* 빛기둥 — 안개를 뚫고 멀리서 보인다(fog:false). 못 찾은 곳은 금빛, 찾은 곳은 옅은 푸른빛 */
  function paintBeams(pos) {
    var w = global.DG.world3d;
    if (!w || !w.active || !w.active()) { return; }
    var T3 = w.three();
    if (!T3) { return; }
    var list = landmarks(pos.x, pos.y, 1350), seen = {}, i;
    for (i = 0; i < list.length; i++) {
      var L = list[i], f = found(L.key);
      seen[L.key] = true;
      var b = beams[L.key];
      if (!b || b.userData.found !== f) {
        if (b) { w.removeFx(b); b.geometry.dispose(); b.material.dispose(); }
        var geo = new T3.CylinderGeometry(f ? 0.8 : 1.6, f ? 0.8 : 1.6, 160, 12, 1, true);
        var mat = new T3.MeshBasicMaterial({ color: f ? '#9fd8ff' : '#ffd36b', transparent: true,
          opacity: f ? 0.18 : 0.34, depthWrite: false, fog: false, side: T3.DoubleSide });
        b = beams[L.key] = new T3.Mesh(geo, mat);
        b.userData.found = f;
        w.addFx(b);
      }
      b.position.set(L.x, (w.groundY ? w.groundY(L.x, L.y) : 0) + 80, L.y);
    }
    for (var k in beams) {
      if (beams.hasOwnProperty(k) && !seen[k]) {
        w.removeFx(beams[k]); beams[k].geometry.dispose(); beams[k].material.dispose();
        delete beams[k];
      }
    }
  }

  global.DG = global.DG || {};
  global.DG.biome = {
    BIOMES: BIOMES, SIZE: SIZE, BLEND: BLEND, FIND_R: FIND_R,
    on: on, cellAt: cellAt, regionAt: regionAt, biomeAt: biomeAt, bandAt: bandAt, reliefAt: reliefAt,
    landmarks: landmarks, bandOf: bandOf, invCdf: invCdf,
    ZONES: ZONES, RING_R: RING_R, zoneOfCell: zoneOfCell,
    zoneByKey: function (k) { return ZBY[k] || null; },
    /** 이 자리의 땅(고향이면 null) */
    zoneAt: function (x, y) { return ZBY[regionAt(x, y).cell.zone] || null; },
    found: found, discover: discover, waypoints: waypoints, teleport: teleport, tick: tick,
    MISSION_CLEARS: MISSION_CLEARS, missionView: missionView, missionState: missionState, progressMission: progressMission,
    subscribe: subscribe,
    _resetForTest: function () { lastKey = null; lastZone = null; acc = 0; }
  };
})(window);
