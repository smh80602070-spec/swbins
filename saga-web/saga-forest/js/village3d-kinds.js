/**
 * 3마을 3D 소품 종류 표 넷 — village-view3d.js 에서 떼어 냄(R-4, 줄 수 상한). 순수 자료(함수 없음).
 * ---------------------------------------------------------------
 * village-view3d.js 가 같은 이름(SCATTER_KIND·TURNING_KIND·SCATTER_H·INST_KIND)으로 받아 쓰고, 진단·어드민은 그쪽
 * 내보내기(scatterKind()·turningKind()·instKind()·scatterOf())로 본다. village-view3d.js 보다 먼저 실린다.
 */
(function (global) {
  'use strict';

  /** village.js 사물 kind → asset3d 표의 kind. 여기 없는 kind는 3D 로 안 선다.
   *  deadTree·mossyRock·mushroom·bush·stump·log 는 PLAN 11절 Biome — 숲 고리에만
   *  나오고(village.js 의 BIOME_SCATTER), asset3d.js 에 이미 등록돼 있던 표라
   *  여기 줄만 보태면 그대로 선다 */
  var SCATTER_KIND = {
    tree: 'tree:common', pine: 'tree:pine', rock: 'rock', flower: 'flower', weed: 'grass',
    deadTree: 'tree:dead', mossyRock: 'rock:moss', mushroom: 'mushroom', herb: 'mushroom',
    bush: 'bush', stump: 'stump', log: 'log', plant: 'plant',
    tent: 'tent', campfire: 'campfire', bench: 'bench', well: 'well', lantern: 'lantern',
    mountain: 'mountain',
    /* 번들 시설(PLAN §5.3) — 새 GLB 없이 이미 등록된 키를 빌린다. 석비는 이끼 낀 선돌,
       반딧불이 정원은 덤불(밤엔 fireflyBoost 파티클이 위에 얹힌다). 조개 길은 소품이
       아니라 땅(`village.js` tileAt 의 모래)이다 */
    stele: 'rock:moss', fireflyplot: 'bush',
    /* 숲의 정령(PLAN §5.5) — 안 푼 터는 횃불(밤에 눈에 띄게), 푼 터는 꽃 한 송이 자국 */
    spiritmark: 'lantern', spiritdone: 'flower',
    /* 발견 밀도 격자(PLAN §5.5 ①) — 새 GLB 없이 기존 키를 빌린다: 상자=작은 상자, 병=풀 한 포기, 채집터=이끼 바위, 야영=천막+불 */
    oldpost: 'building:mail', starpost: 'lantern', rubble: 'rock:moss', rebuilt: 'gazebo',
    /* 축제 하루(PLAN §5.6) — 새 GLB 없이 기존 키: 안내판=표지판, 달집=모닥불, 줄=통나무, 솥=우물, 등롱=등 */
    festboard: 'building:board', festfire: 'campfire', festrope: 'log', festpot: 'well', festlantern: 'lantern',
    /* 방문객 조각(§5.9) — 새 GLB 없이: 나침반 조각=작은 상자, 도깨비불=등(밤에 빛난다) */
    visitcompass: 'building:mail', visitwisp: 'lantern', visitkid: 'bush', visitufo: 'building:mail', visitparcel: 'crate',
    gridchest: 'building:mail', gridbottle: 'plant', gridnode: 'rock:moss', gridcamp: 'tent', gridfire: 'campfire',
    /* 다리(2026-09-09) — asset3d.js 에 진작 등록만 되어 있던 'bridge' 를
       처음 쓴다(village.js 의 새 BRIDGE_TY 크로싱) */
    bridge: 'bridge',
    /* 짐승(PLAN 40절 PHASE 4 첫 칸) — village.js 의 raw().animals 도 이 표를
       그대로 타고 선다(아래 syncScatter() 가 props 배열에 이어 붙인다).
       토끼·다람쥐·오리·새(2026-09-09, PLAN 16절)는 data-village.js 의
       ANIMALS 에 새로 보탠 kind 라 이 한 줄씩만 이으면 그대로 선다 */
    deer: 'animal:an_deer', fox: 'animal:an_fox', wolf: 'animal:an_wolf',
    rabbit: 'animal:an_rabbit', squirrel: 'animal:an_squirrel',
    duck: 'animal:an_duck', bird: 'animal:an_bird',
    /* 개구리·뱀(2026-09-10, "동물들도 찾아봐") — mushroom·dark·rocky 바이옴이
       유독 짐승이 적어(mushroom 은 여우 하나뿐이었다) 보탰다 */
    frog: 'animal:an_frog', snake: 'animal:an_snake',
    /* 포자괴물(2026-09-10, "괴물이 나와도 되고" — 퓨전 방향) — village.js
       buildAnimals() 가 여우 대신 아주 드물게(8%) 세우는 버섯숲 전용 몬스터.
       다른 짐승과 같은 syncScatter()/Object Pool 경로를 그대로 탄다 */
    mushnub: 'monster:mushnub',
    /* 성간충(2026-09-14, PLAN 46-4 "다음에 이어갈 것") — village.js
       buildAnimals() 가 우주기지에만 아주 드물게(세이브 시드별 40%) 심는
       Enemy_Small 몬스터. mushnub 과 같은 syncScatter()/Object Pool 경로 */
    spacebug: 'monster:spacebug',
    /* 마을 3D 건물(PLAN 6절, 2026-09-09) — village.js `buildProps()`의 shop·
       board·home·mail·tailor·pole·museum kind 를 그대로 타고 선다. 마을당
       하나뿐인 고정 건물이라 나무처럼 변종을 섞지 않는다 */
    shop: 'building:shop', board: 'building:board', home: 'building:home',
    mail: 'building:mail', tailor: 'building:tailor', pole: 'building:pole',
    museum: 'building:museum', bench: 'building:bench',   // 제작대(W-0103) — 기존 Bench_1.glb
    /* 캠프 오두막(2026-09-09) — village.js buildProps() 의 hamletHouse kind 를
       그대로 타고 선다. 마을 건물과 같은 결(변종 없음, 자리 하나뿐).
       hamletHut(House_1)·hamletShed(House_3)는 같은 날 이어 얹은 두 번째·세
       번째 채 — kind 가 다르므로 역시 자리 하나뿐 규칙을 그대로 지킨다 */
    hamletHouse: 'building:hamletHouse', hamletHut: 'building:hamletHut',
    hamletShed: 'building:hamletShed',
    /* 두 번째 캠프(2026-09-09) — village.js buildProps() 의 hamlet2House kind.
       House_4, 첫 캠프의 세 채와 같은 결 */
    hamlet2House: 'building:hamlet2House',
    /* 폐허(2026-09-10, 퓨전 방향) — village.js buildProps() 의 ruinArch kind */
    ruinArch: 'ruin:arch',
    /* 폐허 확장(2026-09-11, PLAN 46-2절) — 진짜 탑성 폐허 스캔(building:ruinTower)
       과, 등록만 되고 여태 안 쓰이던 정자(gazebo, fence·cart가 그랬던 것과
       같은 결)를 폐허 자리에 처음 이었다 */
    ruinTower: 'building:ruinTower', gazebo: 'gazebo',
    /* 우주기지(PLAN 45절, 2026-09-11) — fence·cart는 asset3d.js에 진작
       등록만 되어 있던 것을 처음 쓴다(다리가 그랬던 것과 같은 결), crate는
       building:mail과 같은 파일을 새 kind로 쓴다 */
    crate: 'crate', fence: 'fence', cart: 'cart',
    /* 택배 접수대(PLAN 45절) — 마을 안 물건, mail(우편함)과 같은 파일을
       그대로 빌린다. courierPost는 deco:true가 아니라 syncScatter()가
       mail·shop 같은 마을 건물과 나란히 세운다 */
    courierPost: 'building:mail',
    /* 우주기지 확충(2026-09-14, PLAN 46-3절 "다음에 이어갈 것" — asset3d.js
       의 BLD_SPACE 주석 참고). 이 팩 자체의 건물·로버·메카를 처음 세운다 */
    spaceBase: 'building:spaceBase', spaceHouse: 'building:spaceHouse',
    spaceDome: 'building:spaceDome', solarPanel: 'solarPanel',
    rover: 'rover', mech: 'mech'
  };
  /** 2026-09-10 "움직이는 모션을 더 자연스럽게" — 이 표에 있는 kind만
   *  `syncScatter()`가 이동 방향으로 몸을 튼다. 나무·건물처럼 안 움직이는
   *  것까지 매 프레임 회전을 계산할 까닭이 없어 짐승 일곱 종만 추렸다 */
  var TURNING_KIND = {
    deer: 1, fox: 1, wolf: 1, rabbit: 1, squirrel: 1, duck: 1, bird: 1, frog: 1, snake: 1,
    mushnub: 1, spacebug: 1
  };
  /** 종류별로 실제 몇 미터로 세울까 — asset3d.build() 는 늘 키 1 로 눕혀 준다 */
  var SCATTER_H = {
    tree: 3.4, pine: 3.0, rock: 0.9, flower: 0.35, weed: 0.4,
    deadTree: 3.0, mossyRock: 0.9, mushroom: 0.5, herb: 0.5, bush: 0.8, stump: 0.6, log: 0.5, plant: 0.6,
    tent: 1.8, campfire: 0.5, bench: 0.5, well: 1.0, lantern: 1.6, mountain: 8.0,
    /* 다리(2026-09-09) — 정규화라 원본 비례는 모른다. 난간 높이쯤(well·lantern
       사이) 눈대중으로 잡았다 */
    bridge: 1.4,
    stele: 1.3, fireflyplot: 0.9, spiritmark: 1.5, spiritdone: 0.5,
    oldpost: 0.9, starpost: 2.0, rubble: 0.6, rebuilt: 1.1,
    festboard: 1.2, festfire: 0.5, festrope: 0.5, festpot: 1.0, festlantern: 1.6,
    visitcompass: 0.5, visitwisp: 0.9, visitkid: 0.9, visitufo: 0.45, visitparcel: 0.5,
    gridchest: 0.6, gridbottle: 0.35, gridnode: 0.9, gridcamp: 1.8, gridfire: 0.5,
    deer: 1.1, fox: 0.55, wolf: 0.95,
    rabbit: 0.3, squirrel: 0.25, duck: 0.35, bird: 0.2,
    /* 개구리·뱀 — 토끼·다람쥐보다도 작게, 땅에 붙어 다니는 쪽이라 낮게 잡았다 */
    frog: 0.18, snake: 0.15,
    /* 포자괴물 — 여우(0.55)보다 살짝 작게, 버섯 소품(mushroom 0.5)과 비슷한
       눈높이로 눈대중 잡았다 */
    mushnub: 0.5,
    /* 성간충 — 여우(0.55)보다 조금 작게, "Small" 이름값대로 눈대중 잡았다 */
    spacebug: 0.45,
    /* 건물 — home·tailor·museum(2026-09-19부터 Kenney Fantasy Town Kit
       킷배싱, 이전엔 PolyScan 실사 house_wooden 등)은 셋 다 비슷한 단층
       초가 비례라 키를 맞춰 나란히 서도 안 어색하다. signpost·
       banner_thin_red·box_small(KayKit)은 훨씬 작은 소품이라 낮게 잡는다 */
    shop: 3.0, home: 3.2, tailor: 2.8, museum: 3.4, board: 1.3, mail: 0.9, pole: 2.4, bench: 0.9,
    /* House_2·House_1·House_3(Quaternius) — 마을 건물(home 등,
       3.0~3.4m)보다 한 단 작게 잡아 "캠프의 소박한 오두막" 느낌을 준다.
       셋 다 정규화로 키 1 에서 시작하므로(build() 가 늘 그렇게 눕힌다) 실제
       원본 비례는 모른다 — 나란히 서도 다 같은 키로 안 보이게 일부러 조금씩
       다르게 잡았을 뿐이다 */
    hamletHouse: 2.4, hamletHut: 2.1, hamletShed: 2.3,
    /* House_4(Quaternius) — 두 번째 캠프의 유일한 채. 첫 캠프 셋과 같은
       눈대중 범위(2.1~2.4m) 안에서 살짝 다르게 잡았다 */
    hamlet2House: 2.2,
    /* 무너진 아치(Arch.glb) — 눈대중, 폐허 표지답게 나무보다는 낮고
       건물보다는 존재감 있게 */
    ruinArch: 2.6,
    /* 폐허 확장(2026-09-11, PLAN 46-2절) — 탑성 폐허(4층짜리 원본, 한쪽이
       무너진 실사 스캔)는 마을 건물(3.0~3.4)보다 확실히 높게, mountain(8.0)
       보다는 낮게 눈대중 잡았다. 정자(gazebo)는 쉼터 소품이라 well(1.0)
       정도 눈높이 */
    ruinTower: 4.4, gazebo: 1.1,
    /* 우주기지(PLAN 45절, 2026-09-11) — crate(box_small)는 mail(0.9)과
       같은 파일이라 같은 눈대중, fence·cart는 well(1.0)과 bench(0.5)
       사이 소품 눈대중 */
    crate: 0.9, fence: 1.1, cart: 0.9,
    /* 택배 접수대 — mail 과 같은 파일이니 같은 눈대중(0.9) */
    courierPost: 0.9,
    /* 우주기지 확충(2026-09-14, PLAN 46-3절) — 전부 정규화(키 1) 기준
       눈대중. spaceBase(본관)는 마을 건물(3.0~3.4)보다 조금 더 존재감
       있게, spaceHouse(오두막)는 캠프 오두막(2.1~2.4)과 비슷하게,
       spaceDome(측지돔)은 그 중간, solarPanel·rover는 낮은 소품·차량,
       mech는 사람 키보다 한 단 큰 로봇으로 잡았다 */
    spaceBase: 3.6, spaceHouse: 2.1, spaceDome: 2.6,
    solarPanel: 1.3, rover: 1.1, mech: 2.1
  };

  /**
   * 2026-09-09 — PLAN 40절 PHASE 7 "Scatter를 InstancedMesh로"를 좁혀서
   * 되살렸다(README "남은 일 표"에서 위험하다고 미뤄 뒀던 항목). 애니메이션·
   * 스켈레톤이 없는 이 여덟 종류만 대상이다 — 나무·바위·건물·짐승은 그림자
   * 개별 LOD(`applyShadowLOD`)·변종 다양성이 더 중요해 기존 Object Pool
   * 경로(아래 `scatter`/`scatterPool`)에 그대로 남긴다. 이 kind들은 `syncScatter()`
   * 루프에서 걸러지고(`if (INST_KIND[p.kind])` 체크), `syncInstScatter()`가 따로
   * 세운다 — `asset3d.partsFor()`가 프리미티브(재질 단위)를 주면 재질마다
   * InstancedMesh 하나를 만들어 같은 자리 행렬을 쓴다.
   */
  var INST_KIND = { weed: 1, flower: 1, mushroom: 1, herb: 1, plant: 1, stump: 1, log: 1, bush: 1 };

  global.DG = global.DG || {};
  global.DG.village3dKinds = { SCATTER_KIND: SCATTER_KIND, TURNING_KIND: TURNING_KIND, SCATTER_H: SCATTER_H, INST_KIND: INST_KIND };
})(window);
