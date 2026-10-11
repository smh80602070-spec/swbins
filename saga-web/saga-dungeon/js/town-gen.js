/**
 * 2나락 절차 생성 마을 (R-4, 2026-10-11 `town.js` 1,840줄에서 떼어 냄)
 * ---------------------------------------------------------------
 * 이름 표(뜻말·지명 접미사)·바이옴 방 빛깔·직군 풀과 `generate(W)` — town.js 가 모듈을 실을 때 한 번 부른다.
 * 맵 편집기·콘텐츠 편집기가 town.js 에서 읽는 것(DECOR_MORU·TOWNS·MARKS·NPC_DEFS·BASE_W 줄·HAND_TOWN_DENSITY_*·
 * placePoints)은 하나도 안 옮겼다 — placePoints 는 town.js 에 두고 인자로 받는다. **Math.random 안 씀**(hash2 만).
 * `town.js` 보다 **먼저** 실린다(manifest).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  /**
   * 절차 생성 마을(PLAN §28-8 Phase 3, 2026-09-06) — 손으로 지은 넷에 더해,
   * 격자 위 빈 칸에 마을을 자동으로 앉힌다. **Math.random()을 안 쓴다** —
   * core.hash2(고정 입력...) 순수 해시로만 정해 자가진단의 공유 RNG
   * 수열을 안 건드린다(PLAN이 반복 경고하는 함정). 모듈 로드 시 한 번만
   * 돌고, 그 뒤로는 TOWNS[id]·WORLD_ANCHOR[id]·TOWN_ORDER에 손으로 지은
   * 마을과 완전히 같은 모양으로 섞여 들어간다 — build()·pickActiveTown·
   * 자동지도 등 나머지 코드는 "이게 손으로 지은 건지 절차 생성인지"
   * 전혀 모른다(새 분기 없음).
   *
   * 배치 — ANCHOR_DIST 간격 격자 칸(gx,gz)에 하나씩(이미 쓴 넷은 제외).
   * 격자라 간격이 늘 ANCHOR_DIST 이상이라 겹칠 수 없다("세계 앵커" 자가
   * 진단이 넷+생성분 전부를 다시 잰다). 후보를 결정적으로 뒤섞어 앞에서
   * 부터 GENERATED_TOWN_COUNT개를 쓴다.
   *
   * biome — 2×2 격자 블록 단위로 재서 이웃 마을끼리 성격이 뭉치게 한다
   * ("현실화" 요청, 2026-09-06 — 실제 지도를 베끼는 게 아니라 순수 절차
   * 규칙일 뿐이다). `theme.name`(표시 이름·HUD)과는 별도로 `theme.biome`
   * 에 "town:"+biome을 적어 두고, dungeon.js의 fieldBlockedAt·
   * dungeon3d.js의 buildField/clutterAt이 `biome||name` 순서로 THEME_BIAS
   * 를 찾게 살짝 고쳤다(없으면 예전처럼 name — 손으로 지은 넷은 회귀 없음).
   *
   * 이름 — 뜻말(NAME_DESC) + biome별 지명 접미사(NAME_SUFFIX)를 합친다
   * (예: 산 계열은 "재·령·봉"). 손으로 지은 넷과 안 겹치게 usedNames로 막는다.
   *
   * NPC·decor — `safePoint()`가 하던 "겹치면 밀어낸다"를 `placePoints()`로
   * 일반화했다(최소 간격만 지키는 범용 배치기). 직군은 7개 중 셋(위성
   * 마을과 같은 패턴), decor는 집 하나·우물 하나·횃불 둘(§28-7 밀도 보강
   * 이전 위성 마을과 같은 기본 구성 — 밀도는 Phase 4 몫, PLAN §44).
   */
  /* PLAN §28-8 "다음에 이어받을 것" — 20→100. 후보(GEN_GRID_RADIUS)를 5→6으로
     같이 올렸다 — 5는 (2*5+1)^2-4=117개뿐이라 100개를 뽑으면 남는 여유가
     17개뿐이었다(격자 후보가 부족하면 seededShuffle 뒤 앞에서부터 자르는
     로직이 그냥 못 채우고 조용히 100개 미만으로 멈춘다 — 에러가 안 나서
     알아채기 어렵다).
     2026-09-07 — "맵 배치가 부자연스럽다"(사용자) 후속으로 6→7. 100개를
     그대로 두고 후보 칸만 늘려(칸이 늘어도 뽑는 개수는 그대로라 밀도만
     낮아진다) 채움 비율을 165칸 중 100개(61%)에서 221칸 중 100개(45%)로
     낮춰 "칸마다 거의 다 찼다"는 느낌을 줄인다. 앵커 최대 거리
     (7*ANCHOR_DIST=44800, ANCHOR_DIST도 같은 날 4800→6400으로 올렸다)에
     방 반폭(1120)·흔들림(TOWN_JITTER 600)을 더해도 46520으로
     WORLD_LIMIT(60000)까지 13480 여유가 남는다 — 안전하다. */
  var GENERATED_TOWN_COUNT = 100;
  var GEN_GRID_RADIUS = 7;      // (2r+1)^2-4 후보
  var BIOME_KEYS = ['forest', 'ruins', 'swamp', 'mountain', 'shrine'];
  var NAME_DESC = [
    '달빛', '별빛', '청록', '백로', '흑요', '황금', '적송', '녹수', '심연', '유수',
    '한들', '설원', '풍차', '화전', '수련', '목단', '은강', '옥천', '자류', '비단',
    '안개', '노을', '새벽', '저녁', '구름', '바람', '이슬', '서리', '불꽃', '물결'
  ];
  var NAME_SUFFIX = {
    forest: ['골', '촌', '림'], ruins: ['성', '채', '루'], swamp: ['벌', '포', '늪'],
    mountain: ['재', '령', '봉'], shrine: ['당', '원', '단']
  };
  var BIOME_ROOM_COLOR = {
    forest:   { floor: '#2e3b28', wall: '#44543c', tint: 'rgba(140,190,110,0.10)' },
    ruins:    { floor: '#3a352c', wall: '#564f40', tint: 'rgba(200,180,140,0.10)' },
    swamp:    { floor: '#33362a', wall: '#4c5040', tint: 'rgba(150,170,110,0.10)' },
    mountain: { floor: '#33302e', wall: '#4d4946', tint: 'rgba(180,180,190,0.10)' },
    shrine:   { floor: '#302a3a', wall: '#493f56', tint: 'rgba(180,150,220,0.10)' }
  };
  var GEN_NPC_POOL = ['captain', 'quarter', 'master', 'smith', 'pedlar', 'scribe', 'herald'];

  /** 결정적 뒤섞기 — Fisher-Yates, 난수 자리에 core.hash2(seed)만 쓴다. */
  function seededShuffle(arr, salt) {
    var a = arr.slice(), i, j, tmp;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(core.hash2(salt + i * 31 + 1, salt * 7 + i * 13 + 3) * (i + 1));
      tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  /** 2×2 격자 블록 단위 biome — 이웃 칸끼리 같은 성격으로 뭉친다. */
  function macroBiome(gx, gz) {
    var mx = Math.floor(gx / 2), mz = Math.floor(gz / 2);
    var h = core.hash2(mx * 131 + 7, mz * 131 + 13);
    return BIOME_KEYS[Math.min(BIOME_KEYS.length - 1, Math.floor(h * BIOME_KEYS.length))];
  }
  function genName(biome, usedNames, salt) {
    var suf = NAME_SUFFIX[biome] || NAME_SUFFIX.forest, tries = 0, name, di, si;
    do {
      di = Math.floor(core.hash2(salt * 3 + tries * 17 + 1, salt + 5) * NAME_DESC.length);
      si = Math.floor(core.hash2(salt * 5 + tries * 11 + 2, salt + 9) * suf.length);
      name = NAME_DESC[Math.min(NAME_DESC.length - 1, di)] + suf[Math.min(suf.length - 1, si)];
      tries++;
    } while (usedNames[name] && tries < 50);
    usedNames[name] = true;
    return name;
  }

  /** 손으로 지은 넷 곁에 마을을 앉힌다 — town.js 가 제 표(TOWNS·TOWN_ORDER·WORLD_ANCHOR)와 placePoints·상수를 넘긴다(그 표에 그대로 쓴다) */
  function generate(W) {
    var TOWNS = W.TOWNS, TOWN_ORDER = W.TOWN_ORDER, WORLD_ANCHOR = W.WORLD_ANCHOR, placePoints = W.placePoints;
    var ANCHOR_DIST = W.ANCHOR_DIST, TOWN_JITTER = W.TOWN_JITTER, WALL = W.WALL;
    var usedNames = {}, i;
    for (i = 0; i < TOWN_ORDER.length; i++) { usedNames[TOWNS[TOWN_ORDER[i]].name] = true; }

    var candidates = [], gx, gz;
    for (gz = -GEN_GRID_RADIUS; gz <= GEN_GRID_RADIUS; gz++) {
      for (gx = -GEN_GRID_RADIUS; gx <= GEN_GRID_RADIUS; gx++) {
        if (gx === 0 && gz === 0) { continue; }         // moru
        if (gx === 1 && gz === 0) { continue; }         // galdae
        if (gx === 0 && gz === -1) { continue; }        // jajak
        if (gx === 0 && gz === 1) { continue; }          // sogeum
        candidates.push({ gx: gx, gz: gz });
      }
    }
    candidates = seededShuffle(candidates, 9001);

    var n = Math.min(GENERATED_TOWN_COUNT, candidates.length), idx;
    for (idx = 0; idx < n; idx++) {
      var cell = candidates[idx];
      var id = 'gen' + (idx + 1);
      var salt = 20000 + idx * 97;
      /* 2026-09-07 — 격자 원점 그대로 두면 완전한 바둑판으로 보인다(위
         ANCHOR_DIST 주석 참고). 결정적 해시로 방향·거리를 뽑아 최대
         TOWN_JITTER만큼 흔든다 — 칸을 벗어나는 일은 없다(반경이 칸
         절반보다 훨씬 작다), 그저 격자선 위에 안 놓인다. */
      var jitAng = core.hash2(salt + 71, salt + 73) * Math.PI * 2;
      var jitMag = core.hash2(salt + 79, salt + 83) * TOWN_JITTER;
      var anchor = {
        x: Math.round(cell.gx * ANCHOR_DIST + Math.cos(jitAng) * jitMag),
        y: Math.round(cell.gz * ANCHOR_DIST + Math.sin(jitAng) * jitMag)
      };
      /* 고정 세계 지도(§5.12) — 마을 성격은 그 자리 지역에서 받는다(설산엔 산 마을,
         개펄엔 늪 마을). world-map.js 가 없으면 옛 2×2 블록 규칙 */
      var WMg = global.DG.worldMap;
      var region = WMg ? WMg.regionAt(anchor.x, anchor.y) : null;
      var biome = region ? region.town : macroBiome(cell.gx, cell.gz);
      var name = genName(biome, usedNames, salt);
      var npcKeys = seededShuffle(GEN_NPC_POOL, salt + 3).slice(0, 3);
      /* 2026-09-07 — 사용자 실기기 제보("NPC들이 너무 붙어있다")로 100→150.
         NPC는 셋뿐이라(위 slice(0,3)) 이 방(BASE_W×BASE_H=560×380) 안에서
         150 간격은 여전히 넉넉히 자리를 찾는다. */
      var npcPts = placePoints(npcKeys.length, 150, [{ x: 195, y: 240 }], salt + 11);
      /* placePoints()가 간격을 못 지키면 이제 그 자리를 건너뛴다(위 함수
         주석 참고, 2026-09-06 후속 — 실기기 제보로 잡음: 억지로 겹치게
         놓았다가 스폰 바로 옆에 집이 서는 사고가 났었다) — 그래서 npcPts가
         npcKeys보다 짧을 수 있다. 인덱스로 바로 안 읽고 실제로 나온 점
         개수만큼만 NPC를 세운다(마을이 너무 빽빽하면 NPC가 하나 덜 설
         수 있다 — 겹치는 것보다 훨씬 낫다). */
      var npcs = npcPts.map(function (pt) {
        return { key: npcKeys[pt.i], x: Math.round(pt.x), y: Math.round(pt.y) };
      });
      var decorAvoid = [{ x: 195, y: 240 }].concat(npcPts);
      /* PLAN §28-8 Phase 4(2026-09-06) — 집·우물뿐이던 밀도를 기둥·균열
         둘을 더 얹어 손으로 지은 넷(모루골 등, pillar·crack이 이미 있다)에
         가깝게 맞춘다. 자리만 placePoints()로 늘리고, 씨앗은 기존 것과
         안 겹치는 salt 오프셋(+53·+61·+67 — 위 house/well이 쓰는 +31·+37과
         겹치지 않는 자리)로 결정적으로 뽑는다. */
      var decorPts = placePoints(4, 100, decorAvoid, salt + 23);   // 집·우물·기둥·균열(모자랄 수 있음)
      var houseSeed = Math.floor(core.hash2(salt + 31, salt + 37) * 1000);
      var crackAngle = core.hash2(salt + 53, salt + 59) * Math.PI * 2;
      var crackLen = 24 + core.hash2(salt + 61, salt + 67) * 20;
      var GEN_DECOR_TYPE = ['house', 'well', 'pillar', 'crack'];
      var decor = [
        { t: 'torch', x: 120, y: WALL - 4, seed: core.hash2(salt + 41, 1) * 6 },
        { t: 'torch', x: 440, y: WALL - 4, seed: core.hash2(salt + 43, 2) * 6 }
      ];
      for (var di = 0; di < decorPts.length; di++) {
        var dp = decorPts[di], dx = Math.round(dp.x), dy = Math.round(dp.y), dtype = GEN_DECOR_TYPE[dp.i];
        if (dtype === 'house') { decor.push({ t: 'house', x: dx, y: dy, h: 130, seed: houseSeed }); }
        else if (dtype === 'well') { decor.push({ t: 'well', x: dx, y: dy, h: 34 }); }
        else if (dtype === 'pillar') { decor.push({ t: 'pillar', x: dx, y: dy }); }
        else if (dtype === 'crack') { decor.push({ t: 'crack', x: dx, y: dy, a: crackAngle, len: crackLen }); }
      }
      var rc = BIOME_ROOM_COLOR[biome];
      TOWNS[id] = {
        id: id, name: name, dirFromHub: null,
        theme: { name: name, biome: 'town:' + biome, floor: rc.floor, wall: rc.wall, tint: rc.tint, town: true,
                 region: region ? region.key : null },
        hasGate: false,
        npcs: npcs, decor: decor, exits: []
      };
      WORLD_ANCHOR[id] = anchor;
      TOWN_ORDER.push(id);
    }
  }

  global.DG = global.DG || {};
  global.DG.townGen = {
    GENERATED_TOWN_COUNT: GENERATED_TOWN_COUNT, GEN_GRID_RADIUS: GEN_GRID_RADIUS, BIOME_KEYS: BIOME_KEYS, NAME_DESC: NAME_DESC, NAME_SUFFIX: NAME_SUFFIX,
    BIOME_ROOM_COLOR: BIOME_ROOM_COLOR, GEN_NPC_POOL: GEN_NPC_POOL, seededShuffle: seededShuffle, macroBiome: macroBiome, genName: genName, generate: generate
  };
})(window);
