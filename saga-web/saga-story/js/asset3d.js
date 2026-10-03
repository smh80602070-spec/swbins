/**
 * 3D 에셋 창고 — 사냥터 지형지물·사람·짐승을 GLB 로 세운다 (PLAN 36절 Phase 2)
 * ---------------------------------------------------------------
 * saga-forest·saga-realm·saga-dungeon 의 `asset3d.js` 와 같은 요령이다.
 * `side-view3d.js` 가 GLB 를 못 받으면 조용히 도형(원뿔·구·캡슐)으로 남는다 —
 * **한 줄도 판정에 닿지 않는다**, side.js 는 이 파일을 모른다.
 *
 * 인물(주인공·사람 형 적)은 몸+옷+머리 넷을 한 뼈대에 묶는 조합형이다
 * (`buildHero`, 사가블로의 `asset3d.js`에서 그대로 옮겼다) — 셋이 뼈 이름·순서까지
 * 완전히 같아 옮겨 입히기(retarget)가 필요 없다. 짐승 형 적(들개·코끼리병)은
 * 조합 없이 홑 GLB 하나로 선다(늑대·소로 대신한다 — 몸집 큰 짐승의 CC0 대역).
 *
 * file:// (PC 단독판)에서는 GLB 를 못 받는다(브라우저가 막는다). 실패해도 조용히
 * 넘어가므로 단독판은 도형인 채로 그대로 돈다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  /** 2026-09-20 — VRM(`/people/anime/`) 몸은 남의 몸짓(UAL1)을 뼈 이름표로 다시 굽는 대신 `anim-own.js` 가 코드로 짠
   *  자체 몸짓을 입는다(Mixamo 는 약관상 공개 저장소에 못 올린다). 기본 켜짐, `world3d.ownAnim`=0 이면 예전 길(UAL1) */
  function wantsOwnAnim(url) {
    return !!(global.DG.ownAnim && typeof url === 'string' && (url.indexOf('/people/anime/') >= 0 || url.indexOf('characters3d/') >= 0) && (global.DG.core && global.DG.core.tuned ? global.DG.core.tuned('world3d.ownAnim', 1) : 1));
  }

  var NAT = 'assets/models/nature/';
  var PEOPLE = 'assets/models/people/regular/';
  var ANIMALS = 'assets/models/animals/';
  var ANIMALS_EXTRA = 'assets/models/animals_extra/';   // 2026-09-23 사가블로에서 복사(펫 초상)
  var ANIMALS_EXTRA2 = 'assets/models/animals_extra2/';
  var STANDIN = 'assets/models/standin/';   // 신수·오마주 대역 — 사가고에서 복사(2026-09-23)
  var BUILDINGS = 'assets/models/buildings/';
  var PROPS = 'assets/models/props/';
  var FOES = 'assets/models/foes/', FOLK = 'assets/models/people/folk/';
  var ANIM_SRC = 'assets/models/anim/UAL1_Standard.glb';

  /* 2026-09-03 — 사가의숲·사가고와 같은 이유로 사람 기본을 갈아 끼운다. Quaternius
     "RPG Character Pack"(CC0, 전사·궁수·도적·성직자·마법사·수도승 6종)은 몸 파일
     하나에 걷기·공격·사망 클립이 다 들어 있어 옷·머리·ANIM_SRC 몸짓이 필요 없다 —
     `anim` 을 `body` 와 같은 파일로 준다. 자세한 사정은
     `saga-forest/assets/ASSET_LICENSES.md` 참고 */
  var PEOPLE_QRPG = 'assets/models/people/quaternius_rpg/';
  var HERO_RECIPES = ['Warrior', 'Ranger', 'Rogue', 'Cleric', 'Wizard', 'Monk'].map(function (n) {
    var f = PEOPLE_QRPG + n + '.glb';
    return { key: 'qrpg_' + n.toLowerCase(), body: f, anim: f };
  });

  /* 옛 조합형(몸+옷+머리) — 표 기본에서는 빠졌다. 지우지 않고 남겨 둔다(되돌림
     자리). `register('hero', HERO_RECIPES_FALLBACK)` 로 되돌릴 수 있다 */
  var HERO_RECIPES_FALLBACK = [
    { key: 'male_peasant_buzzed', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Peasant.gltf', hair: PEOPLE + 'Hair_Buzzed.gltf' },
    { key: 'male_ranger_long', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Ranger.gltf', hair: PEOPLE + 'Hair_Long.gltf' },
    { key: 'female_peasant_buns', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Peasant.gltf', hair: PEOPLE + 'Hair_Buns.gltf' },
    { key: 'female_ranger_simple', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Ranger.gltf', hair: PEOPLE + 'Hair_SimpleParted.gltf' }
  ];

  /* 2026-09-10 — 외형 다양화(saga-go 의 MPFB2 몸 20종을 그대로 복사, CC0,
   * 자세한 것은 assets/ASSET_LICENSES.md). saga-go 의 MPFB 몸은 제 클립이
   * 0개라 뼈 길이가 다른 ANIM_SRC(UAL1)를 raw 로 물리면 팔다리가 뒤틀린다
   * (saga-go 가 겪은 버그) — **같은 날 뒤이어** saga-go 의 `retargetInto()`
   * 계열(`firstSkinned`·`boneNameMap`·`sceneHeight`·`retargetInto`, 아래
   * `assembleHero` 앞)을 옮겨 오고 `buildHero()`의 `assemble()`에서 몸마다
   * 한 번만 다시 구워 입히도록 이어 붙였다 — 이 판은 `side-view3d.js`가
   * `asset3d.buildHero()`를 **실제 플레이 화면**에서 부르므로(위
   * HERO_RECIPES_FALLBACK 과 달리 죽은 자리가 아니다), 이제 DEFAULTS.hero
   * 에도 실제로 걸리는 이 20종이 바로 실기 확인 대상이 된다(아래
   * `.concat`). */
  var PEOPLE_MPFB = 'assets/models/people/mpfb_real/';
  var HERO_RECIPES_MPFB = ['female', 'male', 'v3', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12',
    'v13', 'v14', 'v15', 'v16', 'v17', 'v18', 'v19', 'v20', 'v21', 'v22', 'v23']
    .map(function (n) { return { key: 'mpfb_' + n, body: PEOPLE_MPFB + n + '.glb' }; });
  HERO_RECIPES = HERO_RECIPES.concat(HERO_RECIPES_MPFB);

  /** 표 — 지형지물은 사냥터 mood 어휘, 사람·짐승은 PLAN 36절 Phase 2 어휘 */
  var DEFAULTS = {
    'tree:near': [NAT + 'CommonTree_1.glb', NAT + 'CommonTree_2.glb', NAT + 'CommonTree_3.glb'],
    'tree:far': [NAT + 'PineTree_1.glb', NAT + 'PineTree_2.glb'],
    'rock': [NAT + 'Rock_1.glb', NAT + 'Rock_2.glb', NAT + 'Rock_3.glb'],
    'hill': [NAT + 'Mountain_1.glb', NAT + 'Mountain_2.glb'],
    /* 발밑 밀도(PLAN 6·7절 "맵을 볼 때 매번 똑같은 나무만" 없애기, 2026-09-04) —
       배경 지형지물과 달리 z=0(사람이 걷는 그 깊이) 가까이 놓는 작은 것들.
       cave·fire 는 식생이 없는 곳이라 뺐다(이끼 바위만 cave 에) */
    'bush': [NAT + 'Bush_1.glb', NAT + 'Bush_2.glb'],
    'flower': [NAT + 'Flowers.glb'],
    'grass': [NAT + 'Grass_2.glb', NAT + 'Grass_Short.glb'],
    'moss_rock': [NAT + 'Rock_Moss_1.glb'],
    /* 마을 정취(PLAN 3절 "시작 마을", 2026-09-04) — town:true 인 사냥터(신야성·
       허도·강릉진·남정성·기산채)의 배경. saga-dungeon·saga-realm 의 집·우물,
       saga-forest 의 울타리를 그대로 복사했다(같은 CC0) */
    'house': [BUILDINGS + 'House_1.glb', BUILDINGS + 'House_2.glb',
              BUILDINGS + 'House_3.glb', BUILDINGS + 'House_4.glb'],
    'well': BUILDINGS + 'Well.glb',
    'fence': PROPS + 'Fence.glb',
    'hero': HERO_RECIPES,
    /* 몬스터 다양화 — 코끼리병처럼 몸집 큰 짐승형 적은 소 GLB 로 대신한다
       (딱 맞는 코끼리는 CC0 로 못 찾았다, 늑대만 쓰면 다 같은 크기·모양이 된다) */
    'beast': ANIMALS + 'Wolf.glb',
    'beast_big': ANIMALS + 'Cow.glb',
    /* 비전투 동물(PLAN 9절, 2026-09-09) — 싸우지 않는 배경 짐승. saga-forest 가
       이미 받아 둔 사슴·여우 GLB(같은 Quaternius Animals Pack)를 재사용한다 */
    'critter:deer': ANIMALS + 'Deer.glb',
    'critter:fox': ANIMALS + 'Fox.glb',
    /* 도감 초상 3D화 확장(2026-09-14) — 사슴·여우와 같은 집안(소)의 펫 셋
       (들소·젖소·황소)도 이미 있는 Cow.glb 를 그대로 재사용한다. 새 GLB
       없이 등록만 하면 된다는 게 portrait3d.js 의 사슴·구미호 판단과 같다 */
    'critter:cow': ANIMALS + 'Cow.glb',
    /* 도감 초상 3D화 확장, 개과(2026-09-14, 이어서) — saga-dungeon 이 이미
       받아 둔 ShibaInu.glb·Husky.glb 를 그대로 복사했다(같은 CC0, 위 소
       셋과 같은 창고 saga-dungeon). saga-dungeon이 먼저 정한 짝(진돗개=
       ShibaInu, 삽살개=Husky, "북슬북슬한 털이 가장 가까웠다")을 그대로
       따른다. 발바리는 소형견이라 이 셋 어디에도 안 맞아 2D로 남긴다 —
       그래서 여기 'critter:wolf' 는 따로 안 둔다(portrait3d.js 참고) */
    'critter:shiba': ANIMALS + 'ShibaInu.glb',
    'critter:husky': ANIMALS + 'Husky.glb',
    /* 도감 초상 3D화 — **실제 동물 펫 전부**(2026-09-23). 사가블로가 받아 둔 Quaternius CC0(범·곰·물고기·공룡 등)를
       `animals/`·`animals_extra/`·`animals_extra2/` 에 그대로 복사하고 키만 붙였다(출처는 사가블로 `ASSET_LICENSES.md`). 위 다섯 키
       (사슴·여우·소·시바·허스키)는 옆면 뷰가 부르므로 그대로 두고, 큰사슴·황소·젖소는 이제 제 모델이 있어 옮겼다(portrait3d PET_MAP).
       발바리도 이제 Pug 가 있다(예전 "소형견 CC0 없음" 판단은 이걸로 풀림). 신수·창작 짐승(옛 오마주)는 여전히 뺀다 */
    'critter:tiger': ANIMALS + 'Tiger.glb',
    'critter:bear': ANIMALS + 'Bear.glb',
    'critter:magpie': STANDIN + 'Pigeon.glb',
    'critter:crane': ANIMALS + 'Crane.glb',
    'critter:toad': ANIMALS + 'Frog.glb',
    'critter:carp': ANIMALS + 'Koi.glb',
    'critter:panda': ANIMALS + 'Panda.glb',
    'critter:monkey': ANIMALS + 'Monkey.glb',
    'critter:boar': ANIMALS + 'Boar.glb',
    'critter:owl': ANIMALS + 'Owl.glb',
    'critter:cat': ANIMALS + 'Cat.glb',
    'critter:llama': ANIMALS_EXTRA + 'Llama.glb',
    'critter:pig': ANIMALS_EXTRA + 'Pig.glb',
    'critter:pug': ANIMALS_EXTRA + 'Pug.glb',
    'critter:sheep': ANIMALS_EXTRA + 'Sheep.glb',
    'critter:horse_farm': ANIMALS_EXTRA + 'Horse_Farm.glb',
    'critter:cow_farm': ANIMALS_EXTRA + 'Cow_Farm.glb',
    'critter:zebra': ANIMALS_EXTRA + 'Zebra.glb',
    'critter:donkey': ANIMALS_EXTRA + 'Donkey.glb',
    'critter:alpaca': ANIMALS_EXTRA + 'Alpaca.glb',
    'critter:bull': ANIMALS_EXTRA + 'Bull.glb',
    'critter:stag': ANIMALS_EXTRA + 'Stag.glb',
    'critter:white_horse': ANIMALS_EXTRA + 'White_Horse.glb',
    'critter:horse': ANIMALS_EXTRA + 'Horse.glb',
    'critter:white_horse': ANIMALS_EXTRA + 'White_Horse.glb',   // 탈것(mount.js)
    'critter:fish_1': ANIMALS_EXTRA + 'Fish1.glb',
    'critter:fish_2': ANIMALS_EXTRA + 'Fish2.glb',
    'critter:fish_3': ANIMALS_EXTRA + 'Fish3.glb',
    'critter:dolphin': ANIMALS_EXTRA + 'Dolphin.glb',
    'critter:shark': ANIMALS_EXTRA + 'Shark.glb',
    'critter:whale': ANIMALS_EXTRA + 'Whale.glb',
    'critter:manta_ray': ANIMALS_EXTRA + 'MantaRay.glb',
    'critter:anglerfish': ANIMALS_EXTRA2 + 'Anglerfish.glb',
    'critter:apatosaurus': ANIMALS_EXTRA2 + 'Apatosaurus.glb',
    'critter:armored_catfish': ANIMALS_EXTRA2 + 'Armored_Catfish.glb',
    'critter:betta': ANIMALS_EXTRA2 + 'Betta.glb',
    'critter:black_lion_fish': ANIMALS_EXTRA2 + 'Black_Lion_Fish.glb',
    'critter:blobfish': ANIMALS_EXTRA2 + 'Blobfish.glb',
    'critter:blue_goldfish': ANIMALS_EXTRA2 + 'Blue_Goldfish.glb',
    'critter:blue_tang': ANIMALS_EXTRA2 + 'Blue_Tang.glb',
    'critter:butterfly_fish': ANIMALS_EXTRA2 + 'Butterfly_Fish.glb',
    'critter:cardinal_fish': ANIMALS_EXTRA2 + 'Cardinal_Fish.glb',
    'critter:clownfish': ANIMALS_EXTRA2 + 'Clownfish.glb',
    'critter:coral_grouper': ANIMALS_EXTRA2 + 'Coral_Grouper.glb',
    'critter:cowfish': ANIMALS_EXTRA2 + 'Cowfish.glb',
    'critter:flatfish': ANIMALS_EXTRA2 + 'Flatfish.glb',
    'critter:flower_horn': ANIMALS_EXTRA2 + 'Flower_Horn.glb',
    'critter:goblin_shark': ANIMALS_EXTRA2 + 'Goblin_Shark.glb',
    'critter:goldfish': ANIMALS_EXTRA2 + 'Goldfish.glb',
    'critter:humphead': ANIMALS_EXTRA2 + 'Humphead.glb',
    'critter:koi_2': ANIMALS_EXTRA2 + 'Koi.glb',
    'critter:lionfish': ANIMALS_EXTRA2 + 'Lionfish.glb',
    'critter:mandarin_fish': ANIMALS_EXTRA2 + 'Mandarin_Fish.glb',
    'critter:moorish_idol': ANIMALS_EXTRA2 + 'Moorish_Idol.glb',
    'critter:parasaurolophus': ANIMALS_EXTRA2 + 'Parasaurolophus.glb',
    'critter:parrot_fish': ANIMALS_EXTRA2 + 'Parrot_Fish.glb',
    'critter:piranha': ANIMALS_EXTRA2 + 'Piranha.glb',
    'critter:puffer': ANIMALS_EXTRA2 + 'Puffer.glb',
    'critter:red_snapper': ANIMALS_EXTRA2 + 'Red_Snapper.glb',
    'critter:royal_gramma': ANIMALS_EXTRA2 + 'Royal_Gramma.glb',
    'critter:shark_2': ANIMALS_EXTRA2 + 'Shark.glb',
    'critter:stegosaurus': ANIMALS_EXTRA2 + 'Stegosaurus.glb',
    'critter:sunfish': ANIMALS_EXTRA2 + 'Sunfish.glb',
    'critter:swordfish': ANIMALS_EXTRA2 + 'Swordfish.glb',
    'critter:t_rex': ANIMALS_EXTRA2 + 'T_Rex.glb',
    'critter:tang': ANIMALS_EXTRA2 + 'Tang.glb',
    'critter:tetra': ANIMALS_EXTRA2 + 'Tetra.glb',
    'critter:triceratops': ANIMALS_EXTRA2 + 'Triceratops.glb',
    'critter:tuna': ANIMALS_EXTRA2 + 'Tuna.glb',
    'critter:turbot': ANIMALS_EXTRA2 + 'Turbot.glb',
    'critter:velociraptor': ANIMALS_EXTRA2 + 'Velociraptor.glb',
    'critter:worm': ANIMALS_EXTRA2 + 'Worm.glb',
    'critter:yellow_tang': ANIMALS_EXTRA2 + 'Yellow_Tang.glb',
    'critter:zebra_clown_fish': ANIMALS_EXTRA2 + 'Zebra_Clown_Fish.glb',
    /* 2026-09-25 — **대역도 종마다 한 벌**(tools/asset-audit/CHARACTER_UNIQUENESS.md ④): 신수·오마주·까치 28종이 서로 안 겹친다 —
       Quaternius "Ultimate Monsters"(CC0) 열여덟 벌(용·유령·예티·버섯이…) + 코끼리(불가사리) · 범·여우·말·흰말은 같은 종이라 그 모델.
       다섯 판 같은 배정(사가고 asset3d.js 주석). 아래는 옛 경위.
       신수·창작 짐승(옛 오마주) 대역(2026-09-23, 사용자 "사가고처럼 대역 입히기") — CC0 로 있을 리 없는 창작물이라 예전엔 뺐다.
       사가고가 형태별 풀에서 id 해시로 고른 것과 **같은 모델**을 입힌다(해태=당나귀·청룡=스테고사우루스 등, 세 판이 같은 대역).
       이 판에 없던 여섯(Birb·Pigeon·Snake 둘·Orc·Demon)만 사가고에서 `standin/` 으로 복사, 나머지는 이미 있는 같은 종 모델 */
    'critter:samjogo': STANDIN + 'Birb.glb',
    'critter:haetae': STANDIN + 'Goleling.glb',
    'critter:cheongryong': STANDIN + 'Dragon_Evolved.glb',
    'critter:baekho': ANIMALS + 'Tiger.glb',
    'critter:jujak': STANDIN + 'Hywirl.glb',
    'critter:hyeonmu': STANDIN + 'Snake.glb',
    'critter:dokkaebi': STANDIN + 'Orc.gltf',
    'critter:bulgasari': STANDIN + 'Elephant.glb',
    'critter:jeoktoma': ANIMALS_EXTRA + 'Horse.glb',
    'critter:jeolyeong': ANIMALS_EXTRA + 'White_Horse.glb',
    'critter:pk_bulbasaur': STANDIN + 'Mushnub.glb',
    'critter:pk_charmander': STANDIN + 'Dino.glb',
    'critter:pk_squirtle': STANDIN + 'Squidle.glb',
    'critter:pk_magikarp': STANDIN + 'Glub.glb',
    'critter:pk_pikachu': STANDIN + 'Bunny.glb',
    'critter:pk_eevee': STANDIN + 'Monkroose.glb',
    'critter:pk_slowbro': STANDIN + 'Pink_Slime.glb',
    'critter:pk_gengar': STANDIN + 'Ghost.glb',
    'critter:pk_snorlax': STANDIN + 'Yeti.glb',
    'critter:pk_lapras': STANDIN + 'Glub_Evolved.glb',
    'critter:pk_alakazam': STANDIN + 'Wizard.glb',
    'critter:pk_dragonite': STANDIN + 'Alpaking.glb',
    'critter:pk_charizard': STANDIN + 'Dragon.glb',
    'critter:pk_gyarados': STANDIN + 'Snake_angry.glb',
    'critter:pk_mewtwo': STANDIN + 'Alien_2.glb',
    'critter:pk_mew': STANDIN + 'Cat_Monster.glb',
    /* 랜덤 이벤트(PLAN 11절, 2026-09-09) — saga-dungeon 이 이미 받아 둔 KayKit
       상자를 그대로 재사용한다 */
    'chest': PROPS + 'Chest.glb',
    /* 세 시대 사람·적(PLAN §5-12 · SAGA-DESIGN §13) — 사가고 ⑱ 과 같은 Quaternius CC0 파일을 복사해 왔다.
       전부 제 클립(걷기·대기·공격·죽음) 내장이라 `buildModel()` 이 몸과 몸짓을 같은 파일로 세운다.
       현대·미래 적(`data-side.js` ERA_ENEMIES)·마을 사람(NPC_TALK 의 model) 만 이 키를 쓴다 */
    'foe:rat': FOES + 'Rat.glb',
    'foe:wasp': FOES + 'Wasp.glb',
    'foe:zombie': FOES + 'Zombie.glb',
    'foe:drone': FOES + 'Robot_Drone.glb',
    'foe:walker': FOES + 'Robot_Walker.glb',
    'foe:alien': FOES + 'Alien.glb',
    'foe:hulk': FOES + 'Robot_Large.glb',
    'foe:swat': FOLK + 'm_SWAT.glb',
    'folk:worker': FOLK + 'm_Worker.glb',
    'folk:hoodie': FOLK + 'm_Hoodie.glb',
    'folk:scifi': FOLK + 'w_SciFi.glb',
    'folk:astronaut': FOLK + 's_Astronaut1.glb'
  };

  var REG = {};
  function restore() {
    var k;
    REG = {};
    for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { REG[k] = DEFAULTS[k]; } }
    return REG;
  }
  restore();

  function register(key, url) {
    if (!key) { return REG; }
    if (url) { REG[key] = url; } else { delete REG[key]; }
    return REG;
  }

  function clear() { REG = {}; return REG; }

  /** 표에서 첫 히트 — 없으면 null. three 없이도 돈다 */
  function lookup(kind) { return REG[kind] ? { key: kind, url: REG[kind] } : null; }

  /** 표의 한 줄이 여럿이면 그중 하나를 고른다 — seed 로 늘 같은 것 */
  function oneOf(list, seed) {
    if (!list) { return null; }
    if (typeof list === 'string') { return list; }
    if (!list.length) { return null; }
    var s = String(seed || ''), i, h = 0;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return list[h % list.length];
  }

  /* ── 여기서부터 three 가 필요하다 ─────────────────────── */

  var loaderInst = null;
  /* 압축(EXT_meshopt_compression) GLB 는 디코더 없이 조용히 실패한다 — 사가의숲 asset3d.js 와 같은 요령(2026-09-23 tools/asset-audit 가 찾음) */
  function gltfLoader() {
    var t = three();
    if (!t || !t.GLTFLoader) { return null; }
    if (!loaderInst) {
      loaderInst = new t.GLTFLoader();
      if (t.MeshoptDecoder) { loaderInst.setMeshoptDecoder(t.MeshoptDecoder); }
    }
    return loaderInst;
  }

  /**
   * 받은 그대로의 PBR 재질을 벗긴다 — Quaternius 모델은 환경맵(IBL) 없이 서면
   * 거의 새까맣게 보인다. 빛깔만 남기고 Lambert 로 바꾼다(다른 판에서 실제로
   * 겪은 문제, 같은 고침).
   */
  /* 외곽선(2026-09-23) — 배우 GLB(사람·짐승)만. 사가블로 `isActorAsset()` 과 같은 판별 */
  /* 2026-09-23 — animals_extra·animals_extra2(사가블로 "펫 100개" 모델)·standin(신수·오마주 대역)도 배우. 전엔 `animals/` 만 맞아 그 펫들이 외곽선·림 없이 구워졌다 */
  function isActorAsset(url) {
    return typeof url === 'string' && /\/models\/(people|animals|animals_extra2?|standin|monsters)\//.test(url);
  }

  function delam(root, url) {
    var t = three();
    var TN = global.DG.toon3d;
    var toon = !!(TN && TN.TOON_ON());
    var wantOutline = toon && !!(TN.OUTLINE_ON && TN.OUTLINE_ON()) && isActorAsset(url);
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      /* 법선이 아예 없는 GLB(2026-09-23 예방 — 사가국지 킷배싱 탑이 이것으로 새까맸다): GLTFLoader 는 이때 flatShading 을 켜
         주지만 toonify 가 만드는 MeshToonMaterial 은 flatShading 을 안 받아(r169) 법선 0 → 통째로 새까맣다.
         사가블로 delam 이 2026-09-04 에 먼저 밟은 함정과 같은 처방 — 지오메트리에서 계산해 채운다 */
      if (o.geometry && o.geometry.attributes.position && !o.geometry.attributes.normal) { o.geometry.computeVertexNormals(); }
      var one = Array.isArray(o.material) ? o.material : [o.material];
      var out = one.map(function (m) {
        if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { return m; }
        /* 2026-09-17 — SAGA-DESIGN §6.1: 손잡이가 켜져 있으면 툰으로, 꺼지면 예전 Lambert */
        if (toon) {
          var tm = TN.toonify(m);
          /* 2026-09-23 "고품질 셀 셰이딩급" 2단계 — 배우(사람·짐승)에만 밝기 비례 림 라이트(toon3d.applyRimLight) */
          if (TN.applyRimLight && isActorAsset(url)) { TN.applyRimLight(tm); }
          return tm;
        }
        /* vertexColors 를 안 옮기면(정점빛깔로 색을 주고 baseColorFactor 는
           검게 비워 둔 옷감이 있다) 그 자리가 조명과 무관하게 통째로 새까맣게
           뜬다 — saga-realm 에서 먼저 잡은 원인(2026-09-03) */
        return new t.MeshLambertMaterial({
          color: m.color ? m.color.clone() : new t.Color(0xffffff),
          map: m.map || null, vertexColors: !!m.vertexColors,
          transparent: !!m.transparent, opacity: m.opacity,
          alphaTest: m.alphaTest || 0, side: m.side
        });
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    root.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    if (wantOutline) {
      /* 한 모델 안에서는 **가장 큰 부품 반지름 기준 한 폭**으로 — 부품마다 제 반지름으로 재면
         머리카락·얼굴이 몸보다 가늘어 들쭉날쭉하다. 그 12% 보다 작은 부품(눈·이빨)은 안 두른다
         (검은 점이 된다). traverse 도중 자식을 더하지 않으려고 모아서 붙인다 */
      var ms = [], maxR = 0;
      root.traverse(function (o) {
        if (!o.isMesh || (o.material && o.material.transparent)) { return; }
        if (!o.geometry.boundingSphere) { o.geometry.computeBoundingSphere(); }
        var r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
        ms.push({ m: o, r: r });
        if (r > maxR) { maxR = r; }
      });
      var w = maxR * TN.OUTLINE_K;
      ms.forEach(function (x) { if (x.r >= maxR * TN.OUTLINE_MIN_PART) { TN.outline(x.m, w); } });
    }
  }

  var cache = {};   // url → { state: 'load'|'ok'|'fail', gltf, waiting: [cb] }
  var built = 0, broke = '';

  function flush(c, arg) {
    var w = c.waiting; c.waiting = [];
    for (var i = 0; i < w.length; i++) { w[i](arg); }
  }

  /** GLB 하나를 받아 캐시한다 — 같은 url 을 몇이 동시에 물어도 한 번만 받는다 */
  function acquire(url, done) {
    var c = cache[url];
    if (c && c.state === 'ok') { done(c); return; }
    if (c && c.state === 'fail') { done(null); return; }
    if (c) { c.waiting.push(done); return; }

    var ld = gltfLoader();
    if (!ld) { cache[url] = { state: 'fail', waiting: [] }; done(null); return; }
    c = cache[url] = { state: 'load', waiting: [done] };
    ld.load(url, function (gltf) {
      c.state = 'ok';
      c.gltf = gltf;
      /* 2026-09-23 — VRoid(unlit → MeshBasic)는 delam 이 안 보는 재질이라 명암 없이 평면으로 떴다.
         먼저 툰 + 오픈월드 RPG식 얼굴 그림자로 바꾼다(다섯 판 공용 vroid-variant.js). 외곽선은 아래 delam 이 그대로 두른다 */
      if (global.DG.vroidVariant && global.DG.vroidVariant.shade) { global.DG.vroidVariant.shade(gltf.scene, url); }
      delam(gltf.scene, url);
      c.clips = gltf.animations || [];
      flush(c, c);
    }, undefined, function () {
      c.state = 'fail';
      flush(c, null);
    });
  }

  /** 뼈대가 있으면(사람) SkeletonUtils 로 복제한다 — 그냥 복제하면 뼈대를 나눠 쓴다
   *  (배우 여럿이 같이 걷는다). 뼈대가 없는 나무·바위는 어차피 평범한 복제와 같다 */
  function cloneScene(gltf) {
    var t = three();
    if (t.SkeletonUtils && t.SkeletonUtils.clone) { return t.SkeletonUtils.clone(gltf.scene); }
    return gltf.scene.clone(true);
  }

  /* 2026-09-20 — "고품질 셀 셰이딩급" VRM 애니메 아바타(사가의숲 asset3d.js에서 먼저 만든 것,
     경위는 saga-forest HANDOFF.md 2026-09-19 절)를 이 판에도 옮긴다. VRoid Studio
     공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples) + 이 저장소가
     GUI 자동화로 새로 빚은 avatar_custom_01 — 넷 다 사가의숲과 같은 파일(md5 동일,
     assets/ASSET_LICENSES.md 참고). **기본은 꺼짐**(0) — 손잡이를 켜기 전엔
     기존 QRPG/MPFB 배정에 전혀 안 끼어든다. */
  var PEOPLE_ANIME = 'assets/models/people/anime/';
  var HERO_RECIPES_ANIME = ['a', 'b', 'c'].map(function (n) {
    return { key: 'anime_avatar_' + n, body: PEOPLE_ANIME + 'avatar_sample_' + n + '.glb' };
  }).concat([
    { key: 'anime_avatar_custom01', body: PEOPLE_ANIME + 'avatar_custom_01.glb' }
  ]);
  /** 2026-09-20 — VRoid 몸이면 인물 id 로 머리·옷·눈 색을 바꾼다(vroid-variant.js, 다섯 판 공용). 다른 몸엔 안 건다 */
  function applyVroid(model, rec, id) {
    var V = global.DG && global.DG.vroidVariant;
    if (V && rec && V.isVroid(rec.body)) { V.faceFront(model, rec.body); V.apply(model, id); }   // 정면 -Z → +Z 로 돌려 세운 뒤 색 변형
  }
  function wantsAnimeAvatar() {
    var C = global.DG.core;
    return (C && C.tuned && C.tuned('world3d.animeAvatar', 1)) ? true : false;
  }

  /* 2026-09-25 — "캐릭터 모두 다르게" ②(tools/asset-audit/CHARACTER_UNIQUENESS.md): 사람 적·보스·마을 사람은 VRoid 네 벌
     해시 대신 **이름마다 제 몸** — 모두 다른 한 벌을 역할에 맞게 손으로 짝지었다(사가블로 `asset3d.js` FIXED_HERO 와 같은
     이름은 같은 몸). 파일은 사가블로 hero_light 창고(Quaternius·poly.pizza·KayKit CC0)에서 `people/fixed/` 로 복사, 전부
     제 클립 내장이라 body = anim. 도감 인물·주인공·파티는 VRoid 그대로. 키는 buildHero 씨앗 — 적은 표시 이름, 마을 사람은
     'npc:'+역할. 손잡이 `asset3d.fixedBody`(0 = 옛 해시) */
  var FIXED_HERO = {
    '황건적': 'F:oga_ultimate_Worker_Male.glb',
    '산적': 'F:oga_ultimate_Viking_Male.glb',
    '도적떼': 'F:kaykit_adventurers_Rogue_Hooded.glb',
    '떠돌이 병졸': 'F:oga_ultimate_Soldier_Male.glb',
    '왜구': 'F:oga_ultimate_Pirate_Male.glb',
    '마적': 'F:oga_ultimate_Cowboy_Male.glb',
    '오랑캐 궁수': 'Q:Ranger.glb',
    '거란 기병': 'F:oga_ultimate_BlueSoldier_Male.glb',
    '여진 궁수': 'F:polypizza_more_Adventurer2.glb',
    '몽골 기병': 'F:oga_ultimate_Knight_Male.glb',
    '왜군 조총병': 'F:oga_ultimate_Ninja_Male.glb',
    '위군 창병': 'F:polypizza_more_Soldier2.glb',
    '수군 척후선': 'F:polypizza_pirate_Henry.glb',
    '철갑 중장병': 'F:oga_knight_KnightCharacter.glb',
    '근위 기병': 'F:kaykit_adventurers_Knight.glb',
    '연노 사수': 'F:oga_ultimate_BlueSoldier_Female.glb',
    '수군 함대': 'F:polypizza_pirate_Anne.glb',
    '흑기병': 'F:oga_ultimate_Knight_Golden_Male.glb',
    '황건 두목': 'Q:Warrior.glb',
    '산채 두령': 'F:kaykit_adventurers_Barbarian.glb',
    '왜구 선장': 'F:polypizza_pirate_PirateCaptain.glb',
    '오랑캐 족장': 'F:polypizza_wide_CharSoldier.glb',
    '거란 도통': 'F:oga_ultimate_Soldier_Female.glb',
    '몽골 만호장': 'F:polypizza_men_Adventurer.glb',
    '왜장': 'F:oga_ultimate_Kimono_Male.glb',
    '위군 도독': 'F:polypizza_men_King.glb',
    '관문 수호장': 'F:oga_ultimate_Knight_Golden_Female.glb',
    '적국 대장군': 'F:polypizza_women_HoodedAdventurer.glb',
    '노략 궁수': 'F:polypizza_women_Adventurer.glb',
    '유민 폭도': 'F:oga_ultimate_Casual3_Male.glb',
    '요동 철기': 'Q:Cleric.glb',
    '왜군 낭인': 'F:oga_ultimate_Ninja_Sand.glb',
    '중장 방패병': 'F:oga_ultimate_Viking_Female.glb',
    '중장 창병': 'F:polypizza_women_Soldier.glb',
    '자객대': 'F:oga_ultimate_Ninja_Female.glb',
    '창귀병(槍鬼兵)': 'F:kaykit_adventurers_Rogue.glb',
    '황실 궁병': 'F:oga_ultimate_Elf.glb',
    '뇌격 기병': 'F:kaykit_adventurers_Mage.glb',
    '폐도 흉장': 'F:polypizza_apoc_Lis.glb',
    '암굴 귀장': 'F:polypizza_wide_Wizard.glb',
    '전장 원혼 장수': 'Q:Monk.glb',                 // 5부 문 너머 보스 셋
    '폐허 도심 통제관': 'Q:Rogue.glb',
    '궤도 기지 감시관': 'Q:Wizard.glb',
    'npc:elder': 'F:oga_ultimate_OldClassy_Male.glb',
    'npc:guard': 'F:polypizza_men_Man2.glb',
    'npc:merchant': 'F:oga_ultimate_Chef_Male.glb',
    'npc:wanderer': 'F:oga_ultimate_Casual_Male.glb',
    'npc:healer': 'F:oga_ultimate_Doctor_Female_Young.glb'
  };
  function fixedRecipe(seed) {
    var C = global.DG.core;
    if (C && C.tuned && !C.tuned('asset3d.fixedBody', 1)) { return null; }
    var f = FIXED_HERO[String(seed)];
    if (!f) { return null; }
    var url = f.replace(/^F:/, 'assets/models/people/fixed/').replace(/^Q:/, 'assets/models/people/quaternius_rpg/');
    return { key: 'fixed:' + seed, body: url, anim: url };
  }

  /** 표에서 이 씨앗이 고를 몸+옷+머리 조합 — 조합 객체일 때만 돌려준다 */
  function heroRecipe(seed) {
    var frec = (global.DG.assets3d && global.DG.assets3d.heroRecipe(seed)) || fixedRecipe(seed);   // 통일 GLB(W-0021) 먼저
    if (frec) { return frec; }
    if (wantsAnimeAvatar()) {
      var arec = oneOf(HERO_RECIPES_ANIME, seed);
      if (arec) { return arec; }
    }
    var h = lookup('hero');
    if (!h) { return null; }
    var v = oneOf(h.url, seed);
    return (v && typeof v === 'object' && v.body) ? v : null;
  }

  /** 이 재질을 hex 로 물들인다(흰 옷에 곱하는 값이라 너무 어두우면 안 된다) — 없으면 안 물들인다.
   *  짐승은 제 털빛이 맞으므로 부르지 않는다(다른 판과 같은 규칙) */
  var tintCache = {};
  function applyTint(model, hex) {
    var t = three();
    if (!hex) { return model; }
    var tc = new t.Color(hex), TNc = global.DG.toon3d;
    /* 2026-09-23 — VRoid 몸이면 **옷(_CLOTH)에만** 세력 색을 입힌다. 예전엔 피부·얼굴·눈·머리까지 통째로 곱해
       초상·주인공이 파랑·초록 단색으로 물들었다(스크린샷). 외곽선(ShaderMaterial)도 건너뛰고, 복제는
       cloneMat 으로 — 기본 clone() 은 얼굴 그림자·림 셰이더를 떨군다 */
    var vroid = false;
    model.traverse(function (o) { if (o.isMesh && o.material && /_CLOTH|_SKIN|_HAIR/.test(o.material.name || '')) { vroid = true; } });
    model.traverse(function (o) {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.color || o.material.isShaderMaterial) { return; }
      var src = o.material;
      if (vroid && !/_CLOTH/.test(src.name || '')) { return; }
      var key = (src.uuid || '') + '|' + hex;
      if (!tintCache[key]) {
        var m = TNc && TNc.cloneMat ? TNc.cloneMat(src) : src.clone();
        m.color = new t.Color(src.color ? src.color.getHex() : 0xffffff).multiply(tc);
        /* 2026-09-28 실기 Q10 — VRoid 가 아닌 저폴리 사람은 무늬 없는 단색 부품(피부·옷)이라 짙은 적 빛깔(#6b5030 등)을
           곱하면 피부까지 흑갈색이 되고 툰 음영까지 겹쳐 **새까만 실루엣**으로 섰다(헤드리스 사진 — 곁의 적 절반).
           흰색과 섞은 색만 곱하고(asset3d.tintMix 0.45), 원래 밝기의 절반 밑으로는 안 내린다. VRoid 옷은 옛 그대로 */
        if (!vroid) {
          var Cm = global.DG.core, mix = Cm && Cm.tuned ? Cm.tuned('asset3d.tintMix', 0.45) : 0.45;
          var base = new t.Color(src.color ? src.color.getHex() : 0xffffff);
          m.color = base.clone().multiply(new t.Color(1, 1, 1).lerp(tc, mix));
          var lum = function (c) { return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };
          var l0 = lum(base), l1 = lum(m.color);
          if (l0 > 0 && l1 < l0 * 0.5) { m.color.multiplyScalar(Math.min(4, l0 * 0.5 / Math.max(l1, 1e-3))); }
        }
        tintCache[key] = m;
      }
      o.material = tintCache[key];
    });
    return model;
  }

  /** 키 1 로 눕혀 담는다 — `mul` 로 실제 크기를 준다(사물마다 원하는 높이가 다르다) */
  function normalize(obj, mul) {
    var t = three();
    obj.updateMatrixWorld(true);
    var b = new t.Box3().setFromObject(obj);
    var h = (b.max.y - b.min.y) || 1;
    var s = (mul || 1) / h;
    var wrap = new t.Group();
    obj.scale.setScalar(s);
    obj.position.set(-((b.min.x + b.max.x) / 2) * s, -b.min.y * s, -((b.min.z + b.max.z) / 2) * s);
    wrap.add(obj);
    return wrap;
  }

  /* ── 애니메이션 이름 맞추기 (saga-forest·saga-dungeon 의 asset3d.js 와 같다) ──
   * 모델마다 클립 이름이 제각각이다. 이름을 씻어 놓고 **점수를 매겨** 가장 잘
   * 맞는 것부터 자리를 채운다. three 없이도 도는 순수 함수라 진단이 렌더러 없이
   * 검사할 수 있다. */
  var SLOTS = ['idle', 'walk', 'run', 'sprint', 'attack', 'hit', 'dodge', 'death', 'interaction', 'jump', 'land'];
  var WORDS = {
    idle: ['idle', 'stand', 'standing', 'breathe', 'rest', 'wait', 'loop'],
    walk: ['walk', 'walking', 'locomotion', 'move', 'flying'],   // 'flying' — 말벌(`Wasp_Flying`, 걷기 클립 없음)
    run: ['run', 'running', 'jog'],
    sprint: ['sprint', 'runfast', 'fastrun', 'dash'],
    attack: ['attack', 'atk', 'slash', 'swing', 'strike', 'punch', 'shoot', 'cast'],
    hit: ['hit', 'hurt', 'damage', 'gethit', 'takedamage', 'impact', 'flinch'],
    dodge: ['dodge', 'roll', 'evade', 'sidestep'],
    death: ['death', 'die', 'dead', 'dying', 'defeat'],
    interaction: ['interact', 'interaction', 'use', 'pick', 'gather', 'talk', 'open', 'action'],
    jump: ['jump', 'leap', 'hop'],
    land: ['land', 'landing']
  };
  function normName(s) {
    var n = String(s || '');
    if (n.indexOf('|') >= 0) { n = n.split('|').pop(); }
    n = n.replace(/\.\d+$/, '');
    return n.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function score(slot, name) {
    var ws = WORDS[slot] || [], i, w, best = 0, s;
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (name === w) { s = 100; }
      else if (name.indexOf(w) === 0) { s = 70; }
      else if (name.indexOf(w) >= 0) { s = 40; }
      else { continue; }
      s -= i;
      if (s > best) { best = s; }
    }
    return best;
  }
  var FALLBACK = {
    run: ['walk', 'idle'], sprint: ['run', 'walk'], walk: ['run', 'idle'],
    hit: ['idle'], dodge: ['run', 'walk'], attack: ['interaction', 'idle'],
    death: ['hit', 'idle'], interaction: ['idle'], idle: ['walk'], jump: ['idle'], land: ['idle']
  };
  function mapClips(names) {
    var list = (names || []).map(function (n) { return { raw: n, n: normName(n) }; });
    var pairs = [], si, ci, sc;
    for (si = 0; si < SLOTS.length; si++) {
      for (ci = 0; ci < list.length; ci++) {
        sc = score(SLOTS[si], list[ci].n);
        if (sc > 0) { pairs.push({ slot: SLOTS[si], raw: list[ci].raw, s: sc, si: si, ci: ci }); }
      }
    }
    pairs.sort(function (a, b) { return (b.s - a.s) || (a.si - b.si) || (a.ci - b.ci); });
    var out = {}, taken = {}, i, p;
    for (i = 0; i < pairs.length; i++) {
      p = pairs[i];
      if (out[p.slot] || taken[p.raw]) { continue; }
      out[p.slot] = p.raw; taken[p.raw] = true;
    }
    var alias = {}, j, alt;
    for (i = 0; i < SLOTS.length; i++) {
      if (out[SLOTS[i]]) { continue; }
      alt = FALLBACK[SLOTS[i]] || [];
      for (j = 0; j < alt.length; j++) {
        if (out[alt[j]]) { out[SLOTS[i]] = out[alt[j]]; alias[SLOTS[i]] = alt[j]; break; }
      }
    }
    out.alias = alias;
    return out;
  }

  /** 이 장면의 키(m) — 뼈대 크기를 견줄 때 쓴다(saga-go `asset3d.js`에서 옮김) */
  function sceneHeight(obj) {
    var t = three();
    var b = new t.Box3().setFromObject(obj);
    return Math.max(1e-4, b.max.y - b.min.y);
  }

  function firstSkinned(obj) {
    var found = null;
    obj.traverse(function (o) { if (!found && o.isSkinnedMesh) { found = o; } });
    return found;
  }

  /** VRM Humanoid(VRoid, `J_Bip_C/L/R_*`) → 이 판 뼈 이름 표(2026-09-20, 사가의숲
   *  asset3d.js에서 옮김). 손가락은 뺐다 — 이 판 로코모션 클립이 손가락을 안
   *  건드려 굳이 안 옮겨도 무방하다. 항등 매칭이 하나도 안 걸리는 VRM 몸에만
   *  덧붙는 보충표라, 기존 QRPG·MPFB(이미 이름이 같아 항등만으로 되던 몸)는 이
   *  표를 안 거친다 — 손 안 댐. */
  var VRM_TO_UAL1_BONES = {
    J_Bip_C_Hips: 'pelvis', J_Bip_C_Spine: 'spine_01', J_Bip_C_Chest: 'spine_02',
    J_Bip_C_UpperChest: 'spine_03', J_Bip_C_Neck: 'neck_01', J_Bip_C_Head: 'Head',
    J_Bip_L_Shoulder: 'clavicle_l', J_Bip_L_UpperArm: 'upperarm_l', J_Bip_L_LowerArm: 'lowerarm_l', J_Bip_L_Hand: 'hand_l',
    J_Bip_R_Shoulder: 'clavicle_r', J_Bip_R_UpperArm: 'upperarm_r', J_Bip_R_LowerArm: 'lowerarm_r', J_Bip_R_Hand: 'hand_r',
    J_Bip_L_UpperLeg: 'thigh_l', J_Bip_L_LowerLeg: 'calf_l', J_Bip_L_Foot: 'foot_l', J_Bip_L_ToeBase: 'ball_l',
    J_Bip_R_UpperLeg: 'thigh_r', J_Bip_R_LowerLeg: 'calf_r', J_Bip_R_Foot: 'foot_r', J_Bip_R_ToeBase: 'ball_r'
  };

  /** 목표 뼈 이름 → 원본 뼈 이름 표. 이름이 같은 것만 먼저 잇고(항등) —
   *  saga-go `asset3d.js`의 `boneNameMap()`과 동일 — 그 위에 VRM 표를
   *  덧붙인다(항등으로 이미 잡힌 이름은 건드리지 않는다). */
  function boneNameMap(tm, sm) {
    var map = {}, n = 0, i, vname;
    if (!tm.skeleton || !sm.skeleton) { return { map: map, count: 0 }; }
    var have = {}, sb = sm.skeleton.bones, tb = tm.skeleton.bones;
    for (i = 0; i < sb.length; i++) { have[sb[i].name] = 1; }
    for (i = 0; i < tb.length; i++) {
      if (have[tb[i].name]) { map[tb[i].name] = tb[i].name; n++; }
    }
    for (i = 0; i < tb.length; i++) {
      if (map[tb[i].name]) { continue; }
      vname = VRM_TO_UAL1_BONES[tb[i].name];
      if (vname && have[vname]) { map[tb[i].name] = vname; n++; }
    }
    return { map: map, count: n };
  }

  /**
   * 원본(src, 제 몸짓을 가진 모델)의 클립을 이 몸(c)에 맞게 다시 굽는다 —
   * saga-go 의 `retargetInto()`를 그대로 옮겼다. 뼈 길이가 달라도 맞는 이유,
   * "팔이 T자로 안 움직인다" 버그를 왜 이렇게 고쳤는지는 saga-go
   * `asset3d.js`의 같은 이름 함수 주석 참고.
   *
   * **`c` 는 반드시 정규화(normalize) 전의 원본 캐시 칸을 준다** — 이 판은
   * `heightPx`가 배우마다 다르다(보통 58, 거대 75.4, 우두머리 110.2, 초상
   * 1 등). 이미 그 배율로 눕힌 모델을 기준으로 재면 몸마다 한 번만 굽는
   * 캐시(`parts.body.heroClips`)가 처음 잰 배율에 고정돼 다른 배율로 부른
   * 다음 배우가 다 뒤틀린다. 원본 그대로(정규화 전) 재서 구우면 그 값은
   * 배율과 무관하고, 나중에 `normalize()`가 감싼 바깥 그룹을 통째로
   * 늘려도(뼈의 로컬 값은 그대로 두고 바깥 스케일만 곱하므로) 비례가
   * 그대로 유지된다.
   */
  function retargetInto(c, src) {
    var t = three();
    if (!t || !t.SkeletonUtils || !t.SkeletonUtils.retargetClip) { return []; }
    var tgt = firstSkinned(c.gltf.scene), s = firstSkinned(src.gltf.scene);
    if (!tgt || !s) { return []; }
    /* 옮기는 동안 뼈가 실제로 움직이므로 사본으로 굴린다 —
       원본을 굴리면 그 모델을 쓰는 다른 배우가 같이 뒤틀린다 */
    var tc = cloneScene(c.gltf), sc = cloneScene(src.gltf);
    var tm = firstSkinned(tc), sm = firstSkinned(sc);
    if (!tm || !sm) { return []; }
    tc.updateMatrixWorld(true); sc.updateMatrixWorld(true);

    var mul = sceneHeight(tc) / sceneHeight(sc);
    var names = boneNameMap(tm, sm);
    if (!names.count) { return []; }

    var out = [], i, j, clip;
    for (i = 0; i < src.clips.length; i++) {
      try {
        clip = t.SkeletonUtils.retargetClip(tm, sm, src.clips[i],
          { hip: 'Hips', scale: mul, names: names.map });
        if (clip) {
          clip.name = src.clips[i].name;
          for (j = 0; j < clip.tracks.length; j++) {
            clip.tracks[j].name = clip.tracks[j].name.replace(/^\.bones\[([^\]]+)\]/, '$1');
          }
          out.push(clip);
        }
      } catch (e) { /* 이 클립 하나만 건너뛴다 */ }
    }
    return out;
  }

  /**
   * 인물 하나 — **몸 위에 옷·머리를 얹어 한 뼈대에 묶는다.** 셋 다 뼈 이름·순서가
   * 완전히 같으므로 스킨 메시를 몸의 스켈레톤에 다시 물리기만 하면 된다.
   */
  function assembleHero(parts, heightPx, tintHex) {
    var bodyScene = cloneScene(parts.body.gltf);
    var master = null;
    bodyScene.traverse(function (o) { if (!master && o.isSkinnedMesh) { master = o; } });
    if (!master || !master.skeleton) { throw new Error('몸에 스켈레톤이 없다'); }
    var skeleton = master.skeleton;

    [parts.outfit, parts.hair].forEach(function (p) {
      if (!p || !p.gltf) { return; }
      var scene = cloneScene(p.gltf);
      var meshes = [];
      scene.traverse(function (o) { if (o.isSkinnedMesh) { meshes.push(o); } });
      meshes.forEach(function (m) { m.bind(skeleton, m.bindMatrix); bodyScene.add(m); });
    });

    var model = normalize(bodyScene, heightPx);
    applyTint(model, tintHex);
    return model;
  }

  /**
   * 인물 하나를 몸+옷+머리+몸짓(UAL1) 넷을 받아 조합한다(비동기, 콜백 방식).
   * 실패하거나 표에 조합이 없으면 cb(null) 로 부른다 — 부르는 쪽은 그러면
   * 지금처럼 도형(캡슐)을 그린다.
   *
   * @param seed      표에서 조합을 고를 씨앗(사람 id·적 이름 등)
   * @param heightPx  다 세운 뒤 세로 높이(이 판의 좌표는 픽셀이다)
   * @param tintHex   물들일 색(없으면 원래 옷 빛깔 그대로) — 짐승은 안 부른다
   */
  function buildHero(seed, heightPx, tintHex, cb) { buildRecipe(heroRecipe(seed), seed, heightPx, tintHex, cb); }

  /** 표 키 하나(`foe:*`·`folk:*`)를 제 클립 든 몸으로 세운다 — 물들이지 않는다(제 빛깔이 곧 그 시대 옷). 없으면 cb(null) */
  function modelRecipe(key) {
    var url = REG[key];
    return typeof url === 'string' ? { key: key, body: url, anim: url } : null;
  }
  function buildModel(key, heightPx, cb) { buildRecipe(modelRecipe(key), key, heightPx, null, cb); }

  function buildRecipe(rec, seed, heightPx, tintHex, cb) {
    var t = three();
    if (!rec || !t) { cb(null); return; }

    var parts = {}, pending = 4;
    var own = !rec.anim && wantsOwnAnim(rec.body);   // VRM 몸 → 자체 몸짓(UAL1 을 받으러 가지 않는다)
    function onOne() { pending--; if (pending === 0) { assemble(); } }
    acquire(rec.body, function (c) { parts.body = c; onOne(); });
    /* outfit·hair 는 조합형(옛 Quaternius) 레시피에만 있다 — QRPG 통짜 스킨은
       둘 다 없으니 헛수고로 받으러 가지 않고 바로 다음 칸으로 넘어간다 */
    if (rec.outfit) { acquire(rec.outfit, function (c) { parts.outfit = c; onOne(); }); } else { onOne(); }
    if (rec.hair) { acquire(rec.hair, function (c) { parts.hair = c; onOne(); }); } else { onOne(); }
    if (own) { onOne(); } else { acquire(rec.anim || ANIM_SRC, function (c) { parts.anim = c; onOne(); }); }

    function assemble() {
      if (!parts.body) { cb(null); return; }
      var model;
      try {
        model = assembleHero(parts, heightPx, tintHex);
        applyVroid(model, rec, seed);
      } catch (e) {
        broke = (e && e.message) ? e.message : 'hero assemble 실패';
        cb(null);
        return;
      }
      built++;
      var animC = parts.anim;
      if (own) {
        /* 몸이 조립된 장면에서 실제 뼈를 읽어 그 몸에 맞춰 굽는다 — 몸마다 한 번(캐시). 못 만들면 UAL1 길로 되돌아간다 */
        if (!parts.body.ownClips) { parts.body.ownClips = global.DG.ownAnim.clipsFor(model, t) || []; }
        if (parts.body.ownClips.length) {
          var oc = parts.body.ownClips, om = new t.AnimationMixer(model.children[0]), oa = {}, oi;
          for (oi = 0; oi < oc.length; oi++) { oa[oc[oi].name] = om.clipAction(oc[oi]); }
          model.userData.mixer = om;
          model.userData.actions = oa;
          model.userData.clipMap = mapClips(oc.map(function (a) { return a.name; }));
          model.userData.ownAnim = true;
          animC = null;                              // 아래 UAL1 길은 건너뛴다
        } else {
          own = false;
          acquire(ANIM_SRC, function (c) { parts.anim = c; assemble(); });
          return;
        }
      }
      if (animC && animC.clips && animC.clips.length) {
        var clips = animC.clips;
        /* 몸에 제 몸짓이 없어(rec.anim 이 rec.body 와 다른 파일 — 즉 ANIM_SRC 를
           빌려 옴) MPFB 같은 실사 몸은 뼈 길이가 ANIM_SRC 와 달라 raw 로 물리면
           팔다리가 뒤틀린다(saga-go 가 겪은 버그, 위 `retargetInto` 주석 참고) —
           다시 구워 입힌다. **`parts.body`(정규화 전 원본 캐시 칸)를 기준으로
           재고 굽는다** — `heightPx`가 배우마다 달라도 이 캐시는 그대로
           재사용된다(위 `retargetInto` 주석 참고). 몸마다 한 번만 굽는다 */
        if (rec.anim !== rec.body) {
          if (!parts.body.heroClips) {
            parts.body.heroClips = retargetInto(parts.body, animC) || [];
          }
          if (parts.body.heroClips.length) { clips = parts.body.heroClips; }
        }
        var mx = new t.AnimationMixer(model.children[0]);
        var acts = {}, i;
        for (i = 0; i < clips.length; i++) { acts[clips[i].name] = mx.clipAction(clips[i]); }
        model.userData.mixer = mx;
        model.userData.actions = acts;
        model.userData.clipMap = mapClips(clips.map(function (a) { return a.name; }));
      }
      cb(model);
    }
  }

  /**
   * 지형지물 하나 — 표에서 골라 그대로 받아 키 `heightPx` 로 눕힌다 (비동기, 콜백 방식).
   * 실패하거나 three/GLTFLoader 가 없거나 표에 없으면 cb(null) 로 부른다 —
   * 부르는 쪽(side-view3d.js)은 그러면 지금처럼 도형을 그린다.
   *
   * @param kind      'tree:near' | 'tree:far' | 'rock' | 'hill'
   * @param seed      같은 자리는 늘 같은 모델이 걸리게 하는 값(자리 좌표 등)
   * @param heightPx  다 세운 뒤 세로 높이(이 판의 좌표는 픽셀이다)
   */
  function build(kind, seed, heightPx, cb) {
    var hit = lookup(kind);
    if (!hit) { cb(null); return; }
    var url = oneOf(hit.url, seed);
    if (!url || typeof url !== 'string') { cb(null); return; }
    acquire(url, function (c) {
      if (!c || !c.gltf) { cb(null); return; }
      built++;
      var model;
      try {
        model = normalize(cloneScene(c.gltf), heightPx);
      } catch (e) {
        broke = (e && e.message) ? e.message : (kind + ' 조립 실패');
        cb(null);
        return;
      }
      cb(model);
    });
  }

  /** 맞으면 번쩍이는 재질들 — 배우가 GLB 든 도형이든, 지금 보이는 모든 메시의
   *  재질을 사본으로 떼어 온다(사본이라야 배우끼리 안 부딪힌다 — tintCache 를
   *  공유하는 재질을 그대로 건드리면 같은 옷을 입은 다른 배우까지 번쩍인다) */
  function ownAllMat(root) {
    var out = [];
    if (!root) { return out; }
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var srcM = Array.isArray(o.material) ? o.material[0] : o.material, TNc = global.DG.toon3d;
      var m = TNc && TNc.cloneMat ? TNc.cloneMat(srcM) : srcM.clone();   // 림·얼굴 셰이더까지 옮긴다(2026-09-23)
      o.material = m;
      if (m.emissive) { out.push(m); }
    });
    return out;
  }

  global.DG = global.DG || {};
  global.DG.asset3d = {
    register: register,
    restore: restore,
    clear: clear,
    lookup: lookup,
    oneOf: oneOf,
    heroRecipe: heroRecipe, FIXED_HERO: FIXED_HERO, fixedRecipe: fixedRecipe,
    mapClips: mapClips,
    build: build,
    buildHero: buildHero,
    buildModel: buildModel, modelRecipe: modelRecipe,
    ownAllMat: ownAllMat,
    three: three,
    REG: function () { return REG; },
    stats: function () { return { built: built, broke: broke }; },
    /** 진단 전용 — VRM 애니메 아바타 손잡이·레시피·뼈 매핑표 조회(2026-09-20) */
    wantsAnimeAvatar: wantsAnimeAvatar, wantsOwnAnim: wantsOwnAnim,
    heroRecipesAnime: function () { return HERO_RECIPES_ANIME; },
    vrmToUal1Bones: function () { return VRM_TO_UAL1_BONES; },
    boneNameMap: boneNameMap
  };
})(typeof window !== 'undefined' ? window : this);
