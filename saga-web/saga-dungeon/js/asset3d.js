/**
 * 3D 에셋 창고 — 사가만리와 같은 것을 쓴다 (사가나락 4단계, PLAN 4·5·6절)
 * ---------------------------------------------------------------
 * 여태 이 판의 사람·짐승·나무·바위는 `dungeon3d.js`가 상자를 쌓아 조립했다.
 * 손으로 빚은 것이라 가볍고 늘 도는 대신, 아무리 다듬어도 손으로 빚은 티가 난다.
 *
 * 사가만리가 몸이 갈라지는 문제를 근본에서 없앤 그 창고(Quaternius의 뼈대가
 * 완전히 같은 몸+옷+머리)를 **그대로** 옮겨 쓴다 — `assets/ASSET_LICENSES.md`
 * 에 적어 두었듯 `saga-go/assets/models/…`를 그대로 복사했다. 리타기팅도
 * `pickPieces`(부위 변형 고르기)도 필요 없는 것까지 그대로다.
 *
 * 이 판에는 사가만리의 `world3d.js`가 없으므로 **여기서 직접 세운다** — GLB 가
 * 없거나 실패하면 `dungeon3d.js`가 원래 그리던 상자로 조용히 남는다
 * (`build()`가 돌려주는 shell 은 처음부터 그 상자를 담고 있다가 GLB 가
 * 오면 그 자리에서 갈아 끼운다).
 *
 * **표를 읽는 함수는 three 없이도 돈다** — 자가진단이 그것만 따로 본다.
 * 세우는 함수만 three 를 쓴다.
 */
(function (global) {
  'use strict';

  var T = null;
  function three() { if (!T) { T = global.THREE || null; } return T; }
  /** 2026-09-20 — VRM(`/people/anime/`) 몸은 남의 몸짓(UAL1)을 뼈 이름표로 다시 굽는 대신 `anim-own.js` 가 코드로 짠
   *  자체 몸짓을 입는다(Mixamo 는 약관상 공개 저장소에 못 올린다). 기본 켜짐, `world3d.ownAnim`=0 이면 예전 길(UAL1) */
  function wantsOwnAnim(url) {
    return !!(global.DG.ownAnim && typeof url === 'string' && (url.indexOf('/people/anime/') >= 0 || url.indexOf('characters3d/') >= 0) && tuned('world3d.ownAnim', 1));
  }

  /* ── 손잡이 — 이 판의 core.js 에는 tuned 가 없다(dungeon3d.js 와 같은 사정) */
  var knobs = {};
  function tuned(k, def) {
    if (knobs[k] !== undefined) { return knobs[k]; }
    var D3 = global.DG.dungeon3d;
    if (D3 && D3.tuned) { return D3.tuned(k, def); }
    return def;
  }
  function set(k, v) { if (v === null || v === undefined) { delete knobs[k]; } else { knobs[k] = v; } return knobs; }
  function GLB_ON() { return tuned('asset3d.glb', 1) ? true : false; }
  /* W-0325 — GLB 가 올 몸의 대역 도형(갈색 상자)은 받는 동안 숨긴다(사용자 10-18 "로딩이 깨져 보임"). 실패·shapeGhostMs(20초) 넘도록 안 오면 다시 보인다.
     손잡이 dungeon3d.shapeGhost(0 = 숨김 · 1 = 옛 상자) · dungeon3d.shapeGhostMs. tracked = 화면 안 비율(가림막)·가까운 것 먼저(pump)가 보는 몸 목록 */
  var tracked = [];
  function ghostShape(shell, shape) { if (!shape) { return; } tracked.push(shell); if (tracked.length > 600) { tracked = tracked.filter(function (s) { return !!s.parent && s.userData.assetState === 'shape'; }); } if (tuned('dungeon3d.shapeGhost', 0)) { return; } shape.visible = false; shell.userData.ghost = shape; if (typeof setTimeout !== 'undefined') { setTimeout(function () { if (shell.userData.assetState === 'shape') { shape.visible = true; } }, tuned('dungeon3d.shapeGhostMs', 20000)); } }
  /* W-0449 남은 것(사용자 10-26 「로딩되어서 생기게 하지 마」) — 들어선 뒤 새로 나타나는 몸(떠돌이 적·손님)이 모델이 오는 순간 툭 생기던 것:
     껍데기가 생기고 250ms 넘어 온 모델은 0.4초 서서히 나타난다(이 모델 몫 재질만 잠깐 복제해 투명도를 올리고 끝나면 원래 재질로). 손잡이 asset3d.fadeIn(1) */
  function nowMs() { return global.performance && global.performance.now ? global.performance.now() : Date.now(); }
  function fadeIn(shell, model) {
    if (!+tuned('asset3d.fadeIn', 1) || !shell.userData.born || nowMs() - shell.userData.born < 250 || !global.requestAnimationFrame) { return; }
    var list = [], t0 = nowMs(), MS = 400;
    model.traverse(function (m) {
      if (!m.isMesh || !m.material) { return; }
      var orig = m.material, arr = Array.isArray(orig) ? orig : [orig], cl = arr.map(function (x) { var c = x.clone(); c.onBeforeCompile = x.onBeforeCompile; c.customProgramCacheKey = x.customProgramCacheKey; c.transparent = true; c.opacity = 0; c.userData.fadeBase = x.transparent ? x.opacity : 1; return c; });
      m.material = Array.isArray(orig) ? cl : cl[0]; list.push({ m: m, orig: orig, cl: cl });
    });
    if (!list.length) { return; }
    (function step() {
      var k = Math.min(1, (nowMs() - t0) / MS), e = k * k * (3 - 2 * k), i, j;
      for (i = 0; i < list.length; i++) { for (j = 0; j < list[i].cl.length; j++) { list[i].cl[j].opacity = list[i].cl[j].userData.fadeBase * e; } }
      if (k < 1) { global.requestAnimationFrame(step); return; }
      for (i = 0; i < list.length; i++) { if (list[i].m.material === (Array.isArray(list[i].orig) ? list[i].cl : list[i].cl[0])) { list[i].m.material = list[i].orig; } for (j = 0; j < list[i].cl.length; j++) { list[i].cl[j].dispose(); } }
    })();
  }
  function failShell(shell) { shell.userData.assetState = 'fail'; if (shell.userData.ghost) { shell.userData.ghost.visible = true; } }
  function noteShell(url, sh) { var A3c = global.DG.assets3d, cu = A3c && A3c.creatureFor ? A3c.creatureFor(url) : null, c = cache[cu || url]; if (c && c.state === 'queued') { (c.shells || (c.shells = [])).push(sh); } }

  /* ── 표 ─────────────────────────────────────────────── */
  var PEOPLE = 'assets/models/people/regular/';
  var ANIM_DIR = 'assets/models/anim/';
  var NATURE = 'assets/models/nature/';
  var NATURE_REAL = 'assets/models/nature/realistic/';
  var ANIMALS = 'assets/models/animals/';
  var ANIMALS_EXTRA = 'assets/models/animals_extra/';
  var ANIMALS_EXTRA2 = 'assets/models/animals_extra2/';
  var STANDIN = 'assets/models/standin/';   // 신수·오마주 대역 — 사가만리에서 복사(2026-09-23)
  var PROPS = 'assets/models/props/';
  var BLD = 'assets/models/buildings/';
  var BLD_REAL = 'assets/models/buildings/realistic/';
  var BLD_HEX = 'assets/models/buildings/hexagon/';
  var DUN = 'assets/models/dungeon/';
  var GEAR = 'assets/models/gear/';

  /* ── 사람 몸 조립표(사람 팩 갈래·VRoid) — R-4(10-11) 로 `asset3d-people.js` 에 옮겼다. 같은 이름으로 받아 둔다 ── */
  var PPL = global.DG.asset3dPeople;
  var HERO_RECIPES = PPL.HERO_RECIPES, HERO_RECIPES_LIGHT = PPL.HERO_RECIPES_LIGHT, HERO_RECIPES_ANIME = PPL.HERO_RECIPES_ANIME, applyVroid = PPL.applyVroid;
  function wantsAnimeAvatar() { return tuned('world3d.animeAvatar', 1) ? true : false; }

  /* 2026-09-04 — 나무·바위·덤불·통나무 실사화(사람은 Mixamo 재배포 금지로
     막다른 길, 자연물만 간다 — `saga-forest`가 이미 검증한 Poly Haven CC0
     사진측량 스캔을 그대로 복사해 옮겼다, `ASSET_LICENSES.md` 참고). 저다각형
     Quaternius 셋은 지우지 않고 여기 남겨 둔다 — 안 맞으면 DEFAULTS 의 해당
     줄을 이 값으로 되돌리면 그만이다. */
  var NATURE_STYLIZED = {};   // W-0322 — 옛 저다각형 되돌림 표는 비움(빌린 Quaternius 지움). 자연물은 cfg.assets3d.reg 의 자체 world3d

  /* 옛 조합형 — 표 기본에서는 빠졌다. 지우지 않고 남겨 둔다(되돌림 자리) */
  var HERO_RECIPES_FALLBACK = [
    { key: 'male_peasant_buzzed', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Peasant.gltf', hair: PEOPLE + 'Hair_Buzzed.gltf' },
    { key: 'male_ranger_long', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Ranger.gltf', hair: PEOPLE + 'Hair_Long.gltf' },
    { key: 'male_peasant_beard', body: PEOPLE + 'Superhero_Male_FullBody.gltf',
      outfit: PEOPLE + 'Male_Peasant.gltf', hair: PEOPLE + 'Hair_Beard.gltf' },
    { key: 'female_peasant_buns', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Peasant.gltf', hair: PEOPLE + 'Hair_Buns.gltf' },
    { key: 'female_ranger_simple', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Ranger.gltf', hair: PEOPLE + 'Hair_SimpleParted.gltf' },
    { key: 'female_peasant_buzzed', body: PEOPLE + 'Superhero_Female_FullBody.gltf',
      outfit: PEOPLE + 'Female_Peasant.gltf', hair: PEOPLE + 'Hair_BuzzedFemale.gltf' }
  ];
  var SKIP_AUTORETARGET = {};
  HERO_RECIPES.concat(HERO_RECIPES_FALLBACK).forEach(function (r) {
    SKIP_AUTORETARGET[r.body] = true;
    if (r.outfit) { SKIP_AUTORETARGET[r.outfit] = true; }
    if (r.hair) { SKIP_AUTORETARGET[r.hair] = true; }
  });
  var ANIM_SRC = ANIM_DIR + 'UAL1_Standard.glb';


  var DEFAULTS = {
    'hero': HERO_RECIPES,
    'hero_light': HERO_RECIPES_LIGHT,
    'beast': ANIMALS + 'Wolf.glb',
    /* 2026-09-05 — 여태 "딱 맞는 코끼리는 CC0 로 못 찾았다"고 적어 뒀던 대역(소)을
       진짜 코끼리로 갈아 끼운다. poly.pizza 가 이 판에서 완전히 열린 지(위 "도감
       초상" 절) 한참 지나서도 안 찾아봤던 것뿐 — 검색해 보니 Poly by Google 이
       CC-BY 로 바로 있었다(`assets/ASSET_LICENSES.md` 참고) */
    'beast_big': ANIMALS + 'Elephant.glb',
    /* 몬스터 다양화(사용자 요청, "캐릭터도 더 다양하게") — 짐승 형 적이 들개·
       코끼리병 둘뿐이라 늘 늑대 아니면 소(이젠 코끼리) 하나로만 갈렸다. 이미
       도감 초상용으로 받아 둔 Boar·Tiger(둘 다 CC-BY, 위 "도감 초상" 절 —
       새로 받을 것 없이 그대로 재사용)를 새 짐승 두 종(멧돼지·산군, `data-
       enemy.js`)에 얹는다. `dungeon3d.js`가 이제 이름 정규식(`/코끼리/`)
       대신 이 표의 키를 `body` 필드로 직접 받는다 — 더 늘어도 표만 고치면 된다 */
    'beast_boar': ANIMALS + 'Boar.glb',
    'beast_tiger': ANIMALS + 'Tiger.glb',
    /* 2026-09-07 — "몬스터 100개" 목표 첫 벌. KayKit Character Pack: Skeletons
       (CC0, 작가 GitHub 조직에서 직접 받음 — itch.io 아님, `assets/
       ASSET_LICENSES.md` 참고). 짐승이 아니라 사람 형 크리처라 `pet:`이 아닌
       `monster:`로 따로 묶는다 — 몸마다 근접·원거리·2인용 무기 조합 애니메이션
       90여 개가 이미 다 들어 있다(1H_Melee_*·2H_Melee_*·1H_Ranged_* 등, 클립
       이름이 QRPG와 달라도 `mapClips()` 낱말표가 이미 다 받는다). data-enemy.js
       배치·밸런스는 아직 안 건드렸다 — 자산만 갖춰 둔다. */
    'monster:skeleton_warrior': 'crea:skeleton_warrior',
    'monster:skeleton_mage': 'crea:skeleton_mage',
    'monster:skeleton_rogue': 'crea:skeleton_rogue',
    'monster:skeleton_minion': 'crea:skeleton_minion',
    /* 2026-09-07(이어서) — Quaternius "Ultimate Monsters Bundle"(CC0, poly.pizza
       미러로 받음 — 개별 몬스터 45종, 클립 이름이 `CharacterArmature|Idle`처럼
       `|` 로 묶여 있는데 `mapClips()`의 `normName()`이 이미 그 구분자를
       걷어내게 돼 있어(사가만리에서부터 있던 처리) 그대로 받는다). 표시 이름은
       수집 몬스터류를 연상시키는 것(Alpaking·Armabee 등)이 섞여 있으니
       실제 게임에 노출할 때 이름 정책(CLAUDE.md, 가명)을 지킨다 — 여기 키는
       내부 식별자일 뿐 화면에 그대로 안 띄운다. */
    'monster:alien': 'crea:alien_grunt',
    'monster:alien_2': 'crea:alien_grunt',
    'monster:alpaking_evolved': 'crea:armored_alpaca',   // W-0392 K-0180 자체 몸
    'monster:alpaking': 'crea:alpaking',
    'monster:armabee_evolved': 'crea:bumble_knight',
    'monster:armabee': 'crea:bumble_puff',
    'monster:birb': 'crea:birb',
    'monster:blue_demon': 'crea:demon_blue',
    'monster:bunny': 'crea:bunny',
    'monster:cactoro': 'crea:cactus_imp',
    'monster:cactoro_2': 'crea:cactus_imp',
    'monster:cat': 'crea:tabby_ball',
    'monster:chicken': 'crea:hen_ball',
    'monster:demon': 'crea:demon_red',
    'monster:demon_2': 'crea:demon_red',
    'monster:dino': 'crea:dino_pet',
    'monster:dragon_evolved': 'crea:dragon_evolved',
    'monster:dragon': 'crea:dragon',
    'monster:fish': 'crea:finback_brute',
    'monster:fish_2': 'crea:gape_fish',
    'monster:frog': 'crea:swamp_toad',
    'monster:ghost': 'crea:ghost',
    'monster:ghost_skull': 'crea:ghost_skull',
    'monster:glub_evolved': 'crea:glub_evolved',
    'monster:glub': 'crea:glub',
    'monster:goleling': 'crea:goleling',
    'monster:goleling_evolved': 'crea:goleling_evolved',
    'monster:green_blob': 'crea:moss_blob',
    'monster:green_spiky_blob': 'crea:spike_blob',
    'monster:hywirl': 'crea:hywirl',
    'monster:monkroose': 'crea:monkroose',
    'monster:mushnub': 'crea:mushnub',
    'monster:mushnub_evolved': 'crea:spore_cap',
    'monster:mushroom_king': 'crea:mushroom_lord',
    'monster:ninja': 'crea:shadow_ninja',
    'monster:ninja_2': 'crea:shadow_ninja',
    'monster:orc': 'crea:goblin_brute',
    'monster:orc_enemy': 'crea:orc_warrior',
    'monster:pigeon': 'crea:pigeon',
    'monster:pink_slime': 'crea:pink_slime',
    'monster:squidle': 'crea:squidle',
    'monster:tribal': 'crea:masked_tribal',
    'monster:wizard': 'crea:hat_wizard',
    'monster:yeti': 'crea:yeti',
    'monster:yeti_2': 'crea:yeti',
    /* 2026-09-07 — "몬스터 100개" 목표 2차분. poly.pizza "Animated Enemies"
       (Quaternius, CC0) 5종 전부 + 개별 몬스터 검색에서 건진 Quaternius CC0
       단품 4종(Zombie·Skeleton·Giant, 전부 `EnemyArmature|...` 계열이라
       Ultimate Monsters와 같은 낱말표로 받는다) + 커뮤니티 제작자 Charlie의
       Slime Enemy(CC-BY, 클립 6개 내장 — `assets/ASSET_LICENSES.md`에 저작자
       표시). Mimic(Quaternius)은 받아 봤지만 클립이 하나도 없어(정지 메시)
       "동작이 형태보다 우선" 원칙에 따라 뺐다. `monster:frog_enemy`는 기존
       `monster:frog`(Ultimate Monsters)와 다른 개체(UUID가 다름) — 이름이
       겹쳐 접미사로 구분. */
    'monster:snake': 'crea:snake',
    'monster:wasp': 'crea:wasp',
    'monster:rat': 'crea:rat',
    /* 세 시대 적(PLAN §5.20, 2026-09-25) — 사람 셋은 이미 받아 둔 poly.pizza 묶음(영웅 창고 hero_light 에도 있다),
       로봇 셋은 사가만리 `assets/models/foes/`(Quaternius CC0 cyberpunk pack)에서 복사. 전부 제 클립 내장 */
    'monster:era_punk': 'assets/models/people/polypizza_men/Punk.glb',
    'monster:era_hazmat': 'assets/models/people/polypizza_men/SWAT.glb',   // W-0441 HazmatMan(CC-BY) → 같은 현대 시대 사람 몸(색은 적 표)
    'monster:era_swat': 'assets/models/people/polypizza_men/SWAT.glb',
    'monster:era_drone': 'crea:robot_drone',
    'monster:era_walker': 'crea:robot_walker',
    'monster:era_hulk': 'crea:robot_large',
    /* 세 시대 마을 손님(§5.20) — `town.js` ERA_FOLK 의 model. 물들이지 않는다(제 옷이 곧 그 시대) */
    'folk:courier': 'assets/models/people/polypizza_men/Worker.glb',
    'folk:officeworker': 'assets/models/people/polypizza_women/Suit.glb',
    'folk:timetraveler': 'assets/models/people/polypizza_women/SciFiCharacter.glb',
    'folk:explorer': 'assets/models/people/polypizza_space/Astronaut1.glb',
    'monster:spider': 'crea:spider',
    'monster:frog_enemy': 'crea:frog_brute',
    'monster:zombie': 'crea:zombie',
    'monster:skeleton_solo': 'crea:skeleton',
    'monster:giant': 'crea:giant',
    'monster:slime_enemy': 'crea:slime',
    /* 2026-09-14 — PLAN "3안"(새 CC0 몬스터 에셋 조사). Quaternius "Animated
       Dinosaur Pack"(CC0, quaternius.itch.io/animated-lowpoly-dinosaurs —
       quaternius.com 최신 팩 다수가 QAL(재배포 금지)로 바뀌어 있어 이번엔
       팩 페이지에서 라이선스를 낱개로 다시 확인했다) 6종. 기존 `monster:dino`
       (Ultimate Monsters 소속, 뿔공룡/왕뿔공룡이 쓰는 그 하나뿐인 공룡)과는
       완전히 다른 개체 — 이름이 하나도 안 겹쳐 접미사 없이 그대로 받는다.
       전부 Armature 계열 클립(idle·walk·run·attack·death·jump)을 갖고 있어
       `mapClips()`의 낱말표를 그대로 받는다(Apatosaurus.glb 의 death 클립만
       원본 자체에 `Stegosaurus_Death`로 잘못 붙어 있었지만, 이름이 아니라
       "death"라는 낱말만 보고 고르므로 문제없이 그대로 잡힌다 — 원본 파일을
       고치지 않았다). `tools/glb-compress`로 재압축(6개, 1.9MB→0.7MB). */
    'monster:dino_apato': 'crea:apatosaurus',
    'monster:dino_para': 'crea:parasaurolophus',
    'monster:dino_stego': 'crea:stegosaurus',
    'monster:dino_trex': 'crea:trex',
    'monster:dino_tri': 'crea:triceratops',
    'monster:dino_raptor': 'crea:raptor',
    /* 2026-09-14(이어서) — "3안" 계속. OpenGameArt "Cute Animated Monsters"
       (Quaternius, CC0 — quaternius.com/packs/animatedmonster.html·
       quaternius.itch.io/lowpoly-animated-monsters 도 같은 팩, 다만 itch.io는
       결제 흐름이 막혀 있어 opengameart.org 미러로 받았다) 21종 중 다섯만
       골랐다 — 나머지는 이미 있는 개체와 겹치거나(Demon·Yeti·Cactus·
       Mushroom·Skull은 PEOPLE_MONSTERS_Q 쪽에 이미 있다) 이 판 결에
       안 맞아서(Alien·Alien_Tall — 2026-09-11 주석과 같은 이유로 제외)
       뺐다. FBX만 주는 팩이라 `fbx2gltf`(npm, 세션 스크래치, 저장소엔
       미커밋 — 이전 "캐릭터 12차분" 절 참고)로 변환했다. 전부 같은
       `MonsterArmature|*` 클립(Idle·Walk·Death·HitRecieve·Bite_Front·
       Bite_InPlace·Jump·Dance·Yes·No) — `mapClips()` 낱말표에 "bite"가
       없어 attack 슬롯은 이번에도 FALLBACK(→interaction→idle)으로 간다
       (2026-09-09 "Wizard.glb" 절과 같은 자리, 낱말표는 그대로 둔다).
       `tools/glb-compress`로 재압축(5개, 0.6MB→0.2MB). */
    'monster:cyclops': 'crea:cyclops_cute',
    'monster:crab': 'crea:crab_cute',
    'monster:cthulhu': 'crea:tentacle_imp',
    'monster:treant': 'crea:tree_walker',
    'monster:demon_green': 'crea:green_imp',
    /* 2026-09-04 — 도감(펫) 초상 실사화. "코드로 그리지 말고 에셋으로"가
       인물 초상은 이미 되는데(`portrait3d.js`) 펫(짐승)은 여태 빠져 있었다.
       펫 41종 중 신수(神獸) 11종·창작 짐승(옛 오마주) 16종은 CC0로 존재할 리 없는
       창작물이라 손 안 대고, **실제 동물 14종만** 이번에 채운다. `pet:` 로
       묶어 들판 소품(`beast`=늑대, `beast_big`=소)과는 다른 자리임을 표시한다.
       출처는 `assets/ASSET_LICENSES.md` "도감(펫) 초상" 절 참고 */
    'pet:jindo': ANIMALS + 'ShibaInu.glb',
    'pet:sapsal': ANIMALS + 'Husky.glb',
    'pet:tiger': ANIMALS + 'Tiger.glb',
    'pet:bear': ANIMALS + 'Bear.glb',
    'pet:magpie': STANDIN + 'Pigeon.glb',
    'pet:crane': ANIMALS + 'Crane.glb',
    'pet:toad': ANIMALS + 'Frog.glb',
    'pet:carp': ANIMALS + 'Koi.glb',
    'pet:panda': ANIMALS + 'Panda.glb',
    'pet:monkey': ANIMALS + 'Monkey.glb',
    'pet:deer': ANIMALS + 'Deer.glb',
    'pet:boar': ANIMALS + 'Boar.glb',
    'pet:owl': ANIMALS + 'Owl.glb',
    'pet:cat': 'crea:tabby_ball',   // W-0392 빌린 Cat → 자체
    /* 2026-09-07 — "펫 100개" 목표 1차분. poly.pizza 세 번들(전부 CC0,
       Quaternius 계열) — Farm Animal Pack(라마·돼지·퍼그·양·말·소·얼룩말),
       Animated Animal Pack(당나귀·알파카·황소·여우·수사슴·흰말·소·말 —
       사슴·시바견·허스키·늑대는 이미 위에 있어 뺐다), Animated Fish
       Bundle(물고기 3종·돌고래·상어·고래·쥐가오리). 종마다 걷기·달리기·
       공격·죽음 등 애니메이션 내장. `assets/models/animals_extra/`에
       따로 뒀다(기존 `animals/`와 출처가 달라 섞지 않음). */
    'pet:llama': ANIMALS_EXTRA + 'Llama.glb',
    'pet:pig': ANIMALS_EXTRA + 'Pig.glb',
    'pet:pug': ANIMALS_EXTRA + 'Pug.glb',
    'pet:sheep': ANIMALS_EXTRA + 'Sheep.glb',
    'pet:horse_farm': ANIMALS_EXTRA + 'Horse_Farm.glb',
    'pet:cow_farm': ANIMALS_EXTRA + 'Cow_Farm.glb',
    'pet:zebra': ANIMALS_EXTRA + 'Zebra.glb',
    'pet:cow': ANIMALS_EXTRA + 'Cow.glb',
    'pet:donkey': ANIMALS_EXTRA + 'Donkey.glb',
    'pet:alpaca': ANIMALS_EXTRA + 'Alpaca.glb',
    'pet:bull': ANIMALS_EXTRA + 'Bull.glb',
    'pet:fox': ANIMALS_EXTRA + 'Fox.glb',
    'pet:stag': ANIMALS_EXTRA + 'Stag.glb',
    'pet:white_horse': ANIMALS_EXTRA + 'White_Horse.glb',
    'pet:horse': ANIMALS_EXTRA + 'Horse.glb',
    'pet:fish_1': ANIMALS_EXTRA + 'Fish1.glb',
    'pet:fish_2': ANIMALS_EXTRA + 'Fish2.glb',
    'pet:fish_3': ANIMALS_EXTRA + 'Fish3.glb',
    'pet:dolphin': ANIMALS_EXTRA + 'Dolphin.glb',
    'pet:shark': ANIMALS_EXTRA + 'Shark.glb',
    'pet:whale': ANIMALS_EXTRA + 'Whale.glb',
    'pet:manta_ray': ANIMALS_EXTRA + 'MantaRay.glb',
    /* 2026-09-07(이어서) — poly.pizza 물고기 대형 번들(44zhHN1UbT, 위 fish
       번들 ZkGbjS8m8g와는 별개) 36종 + 공룡 번들(SmoLdBLO2K) 6종, 전부
       Quaternius CC0. `assets/models/animals_extra2/`에 따로 둠. */
    'pet:anglerfish': ANIMALS_EXTRA2 + 'Anglerfish.glb',
    'pet:apatosaurus': ANIMALS_EXTRA2 + 'Apatosaurus.glb',
    'pet:armored_catfish': ANIMALS_EXTRA2 + 'Armored_Catfish.glb',
    'pet:betta': ANIMALS_EXTRA2 + 'Betta.glb',
    'pet:black_lion_fish': ANIMALS_EXTRA2 + 'Black_Lion_Fish.glb',
    'pet:blobfish': ANIMALS_EXTRA2 + 'Blobfish.glb',
    'pet:blue_goldfish': ANIMALS_EXTRA2 + 'Blue_Goldfish.glb',
    'pet:blue_tang': ANIMALS_EXTRA2 + 'Blue_Tang.glb',
    'pet:butterfly_fish': ANIMALS_EXTRA2 + 'Butterfly_Fish.glb',
    'pet:cardinal_fish': ANIMALS_EXTRA2 + 'Cardinal_Fish.glb',
    'pet:clownfish': ANIMALS_EXTRA2 + 'Clownfish.glb',
    'pet:coral_grouper': ANIMALS_EXTRA2 + 'Coral_Grouper.glb',
    'pet:cowfish': ANIMALS_EXTRA2 + 'Cowfish.glb',
    'pet:flatfish': ANIMALS_EXTRA2 + 'Flatfish.glb',
    'pet:flower_horn': ANIMALS_EXTRA2 + 'Flower_Horn.glb',
    'pet:goblin_shark': ANIMALS_EXTRA2 + 'Goblin_Shark.glb',
    'pet:goldfish': ANIMALS_EXTRA2 + 'Goldfish.glb',
    'pet:humphead': ANIMALS_EXTRA2 + 'Humphead.glb',
    'pet:koi_2': ANIMALS_EXTRA2 + 'Koi.glb',
    'pet:lionfish': ANIMALS_EXTRA2 + 'Lionfish.glb',
    'pet:mandarin_fish': ANIMALS_EXTRA2 + 'Mandarin_Fish.glb',
    'pet:moorish_idol': ANIMALS_EXTRA2 + 'Moorish_Idol.glb',
    'pet:parasaurolophus': ANIMALS_EXTRA2 + 'Parasaurolophus.glb',
    'pet:parrot_fish': ANIMALS_EXTRA2 + 'Parrot_Fish.glb',
    'pet:piranha': ANIMALS_EXTRA2 + 'Piranha.glb',
    'pet:puffer': ANIMALS_EXTRA2 + 'Puffer.glb',
    'pet:red_snapper': ANIMALS_EXTRA2 + 'Red_Snapper.glb',
    'pet:royal_gramma': ANIMALS_EXTRA2 + 'Royal_Gramma.glb',
    'pet:shark_2': ANIMALS_EXTRA2 + 'Shark.glb',
    'pet:stegosaurus': ANIMALS_EXTRA2 + 'Stegosaurus.glb',
    'pet:sunfish': ANIMALS_EXTRA2 + 'Sunfish.glb',
    'pet:swordfish': ANIMALS_EXTRA2 + 'Swordfish.glb',
    'pet:t_rex': ANIMALS_EXTRA2 + 'T_Rex.glb',
    'pet:tang': ANIMALS_EXTRA2 + 'Tang.glb',
    'pet:tetra': ANIMALS_EXTRA2 + 'Tetra.glb',
    'pet:triceratops': ANIMALS_EXTRA2 + 'Triceratops.glb',
    'pet:tuna': ANIMALS_EXTRA2 + 'Tuna.glb',
    'pet:turbot': ANIMALS_EXTRA2 + 'Turbot.glb',
    'pet:velociraptor': ANIMALS_EXTRA2 + 'Velociraptor.glb',
    'pet:worm': ANIMALS_EXTRA2 + 'Worm.glb',
    'pet:yellow_tang': ANIMALS_EXTRA2 + 'Yellow_Tang.glb',
    'pet:zebra_clown_fish': ANIMALS_EXTRA2 + 'Zebra_Clown_Fish.glb',
    /* 2026-09-25 — **대역도 종마다 한 벌**(tools/asset-audit/CHARACTER_UNIQUENESS.md ④): 신수·오마주·까치 28종이 서로 안 겹친다 —
       Quaternius "Ultimate Monsters"(CC0) 열여덟 벌(용·유령·예티·버섯이…) + 코끼리(불가사리) · 범·여우·말·흰말은 같은 종이라 그 모델.
       다섯 판 같은 배정(사가만리 asset3d.js 주석). 아래는 옛 경위.
       신수·창작 짐승(옛 오마주) 대역(2026-09-23, 사용자 "사가만리처럼 대역 입히기") — CC0 로 있을 리 없는 창작물이라 예전엔 뺐다.
       사가만리가 형태별 풀에서 id 해시로 고른 것과 **같은 모델**을 입힌다(해태=당나귀·청룡=스테고사우루스 등, 세 판이 같은 대역).
       이 판에 없던 여섯(Birb·Pigeon·Snake 둘·Orc·Demon)만 사가만리에서 `standin/` 으로 복사, 나머지는 이미 있는 같은 종 모델 */
    'pet:samjogo': STANDIN + 'Birb.glb',
    'pet:haetae': 'crea:goleling',
    'pet:cheongryong': 'crea:dragon_evolved',
    'pet:baekho': ANIMALS + 'Tiger.glb',
    'pet:jujak': 'crea:hywirl',
    'pet:hyeonmu': STANDIN + 'Snake.glb',
    'pet:gumiho': ANIMALS_EXTRA + 'Fox.glb',
    'pet:dokkaebi': STANDIN + 'Orc.gltf',
    'pet:bulgasari': ANIMALS + 'Elephant.glb',
    'pet:jeoktoma': ANIMALS_EXTRA + 'Horse.glb',
    'pet:jeolyeong': ANIMALS_EXTRA + 'White_Horse.glb',
    'pet:pk_bulbasaur': 'crea:mushnub',
    'pet:pk_charmander': 'crea:dino_pet',
    'pet:pk_squirtle': 'crea:squidle',
    'pet:pk_magikarp': 'crea:glub',
    'pet:pk_pikachu': 'crea:bunny',
    'pet:pk_eevee': 'crea:monkroose',
    'pet:pk_slowbro': 'crea:pink_slime',
    'pet:pk_gengar': 'crea:ghost',
    'pet:pk_snorlax': 'crea:yeti',
    'pet:pk_lapras': 'crea:glub_evolved',
    'pet:pk_alakazam': 'crea:hat_wizard',
    'pet:pk_dragonite': 'crea:alpaking',
    'pet:pk_charizard': 'crea:dragon',
    'pet:pk_gyarados': STANDIN + 'Snake_angry.glb',
    'pet:pk_mewtwo': 'crea:alien_grunt',
    'pet:pk_mew': 'crea:tabby_ball',   // W-0392 빌린 Cat → 자체
    /* 2026-09-04(이어서) — 사용자가 "사가만리처럼 실사화"를 요청 → 사람은
       막다른 길(Mixamo 재배포 금지, 위 delam 주석 참고)이라 자연물만
       Poly Haven CC0 사진측량 스캔으로 갈아 끼웠다(`island_tree_02`,
       `saga-forest`가 이미 88% 심플리파이해 둔 4.86MB 짜리를 그대로 복사).
       옛 셋은 `NATURE_STYLIZED.tree`에 되돌림 자리로 남음 */
    /* 2026-09-04(이어서) — 같은 실사화, Poly Haven `dead_quiver_trunk`(선 채
       마른 줄기). 늪(swamp) Biome 에도 이 값이 그대로 쓰인다 */
    /* 2026-09-04(이어서) — 같은 실사화. `saga-forest`가 처음 갈아 끼웠던 5종
       그대로(맑은 바위 Rock_07·Stone_01 + 이끼 바위 MossRock_a·b·c) — 이 판은
       바위를 결 하나(`rock`)로만 두므로 다섯을 한 표에 섞는다(`rock:moss`로
       가르지 않는다, PLAN 7절 "이끼"는 이 다섯 중 셋이 그대로 맡는다) */
    /* 폐허의 기둥·무너진 벽 — 딱 맞는 "부러진 돌기둥" 낱개는 못 찾아
       `Arch.glb`(무너진 아치)로 대신한다. 사가만리가 이미 같은 후보를 적어 뒀다
       (`saga-go/assets/ASSET_LICENSES.md` "사당·폐허의 다른 후보") */
    /* 제단 — 사가만리가 "사당" 후보로 적어 둔 그 Temple 을 그대로 쓴다 */
    /* 동굴 입구 — 사가만리가 이미 "광산 어귀"로 적어 둔 그 Mine 을 그대로 쓴다 */
    /* 천막 — 2026-09-04, saga-forest 가 이미 받아 둔 진짜 텐트(survival_pack,
       CC0)를 그대로 옮겨 왔다. 여태 대역으로 쓰던 장터 좌판(MarketStand)은
       'stall'로 이름만 남겨 둔다(행상 좌판이 여전히 그 자리를 쓴다) */
    /* 모닥불 — 2026-09-04, saga-forest 가 받아 둔 medieval_village_pack 의
       Bonfire_Lit(CC0)로 갈아 끼웠다. 예전엔 "CC0로 딱 맞는 걸 못 찾았다"고
       적어 뒀던 자리다(도형 그대로 남겨 뒀었다) */
    /* 물(못) — 2026-09-05, 사용자 요청("물 텍스처 실사화")으로 찾아봤지만
       **타일링되는 물 표면 텍스처 자체가 CC0에 없었다**(Poly Haven·ambientCG
       둘 다 뒤졌다 — 물은 사진 텍스처로 잘 안 만드는 소재라 원천적으로
       드물다. ambientCG의 'Ice00x'는 얼어붙은 호수라 못과 안 맞아 걸렀다).
       대신 poly.pizza의 Poly by Google 'Pond'(CC-BY 3.0, saga-dungeon이
       Tiger·Bear 등에서 이미 쓰는 그 출처)를 통째로 썼다 — 바위 고리·
       연잎·물결 데칼까지 다 갖춘 완성 모델이라 여태 코드가 그리던 단색
       반투명 상자(그리고 field3d.js 가 따로 놓던 갈대)를 한 번에 대신한다.
       실사 텍스처는 아니지만(저다각형 팔레트 색이다, 다른 실사화와 결이
       다르다는 뜻) **코드가 그리던 도형을 실제 완성 에셋으로 바꿨다**는
       원칙은 그대로 지킨다. 출처는 `ASSET_LICENSES.md` 참고 */
    /* 표지판(들판의 'post') — SAGA WEB.md 11절 "표지판", 지난 여러 세션이
       "이 팩·다른 네 판 어디에도 CC0로 맞는 게 없다"고 적어 두고 도형으로
       남겨 뒀던 자리. 2026-09-05 — poly.pizza에서 Kenney의 'Signpost'
       (CC0, 로그인 없이 `static.poly.pizza` 직접 다운로드 확인)를 찾아
       채웠다. 원본 비율이 이미 세로가 최대 치수(0.46 대 가로 0.21)라
       'pond'처럼 가로세로를 뒤집어 풀 필요가 없다 — 다른 대다수 소품과
       같은 방식으로 그대로 `normalize()`에 맡긴다. 출처는
       `assets/ASSET_LICENSES.md` 참고 */
    /* 땅바닥 잡초 — PLAN 7·11절 "풀·꽃·덤불·버섯·통나무", 이 판에만 여태
       하나도 없었다(다른 네 판은 다 갖고 있다). 판정에는 안 닿는 순수 장식
       (field3d.js `clutterAt()`) */
    /* 2026-09-04(이어서) — 같은 실사화. Poly Haven `shrub_04`(세로로 선 다발이라
       이 판의 normalize()가 옆으로 안 늘린다, `saga-forest` 주석 참고) */
    /* 2026-09-04(이어서) — 같은 실사화. Poly Haven `dead_tree_trunk`·
       `dead_tree_trunk_02`(이름과 달리 쓰러진 통나무 — tree_dead가 아니라
       여기 자리가 원래 뜻에 맞는다, `saga-forest` 주석 참고) */
    /* 마을(모루골) 건물 — 집 넷은 자리마다 씨앗으로 섞어 세운다(나무·바위와 같은 요령).
       2026-09-04(이어서) — 실사화. PolyScan(CC0, 로그인 없이 무료 다운로드 확인)의
       사진측량 아님·PBR 모델 둘로 갈아 끼웠다 — 돌집(house_stone)·통나무집
       (house_wooden). 원본은 집+수레+양동이가 한 장면에 묶여 있어 `House`·`Wood`
       재질(집 몸체·지붕널) 노드만 추려 냈다(수레·양동이는 버렸다) — 탑과 같은
       trimesh 파이프라인, 텍스처는 4096→768px jpeg85. 출처는 `ASSET_LICENSES.md` */
    /* 2026-09-05 — 우물을 실사화. PolyScan에는 우물 자체가 없었지만
       KayKit(같은 작가, 이미 던전 소품에서 쓰는 그 CC0)의 다른 팩
       "Medieval Hexagon Pack"엔 있다 — 지난 재탐색 때 "CC0인데 저다각형
       스타일이 안 어울린다"고 접었던 그 팩이다. 사용자 지시("아무거나
       대체하면 됨 … 시대가 퓨전이야 여러가지를 합쳐도 상관없어")로 스타일
       통일 조건이 풀려 다시 꺼냈다. 이 팩은 itch.io 페이지 자체는 로그인
       뒤에 있지만(Sketchfab과 같은 부류), Kay Lousberg가 이 팩도 자기
       GitHub 조직에 그대로 미러해 뒀다(던전 소품과 같은 경로) —
       `KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`, 로그인 없이
       그대로 받았다. 색상별(blue·red·green·yellow·neutral) 진영 세트 중
       'blue'만 골랐다 — 이 판엔 진영 구분이 없어 하나면 된다. 원본은 이미
       .gltf+.bin+공용 텍스처 하나(작은 아틀라스, 팩 전체가 공유)로 완결돼
       있어 trimesh로 그대로 읽어 단일 glb로만 다시 구웠다(재질 분리·텍스처
       리사이즈 단계 자체가 필요 없었다 — PolyScan 사진측량과 달리 이
       팩은 원래도 저장이 가볍다). 출처는 `ASSET_LICENSES.md` 참고 */
    /* 2026-09-05 — 대장간을 실사화. PolyScan 카탈로그에 '대장간 건물'은
       원래도 없다(모루 소품 하나뿐, 위 재탐색 기록 참고) — 그런데 그 뒤
       카탈로그가 늘어 집 계열 세 번째(medieval-stone-and-wood-cottage)가
       새로 걸렸다. 사용자 지시("다른 건물로 변경해도 되니 있는 걸로
       위주로 해줘")를 따라 **모양은 집이지만 대장간 자리에** 앉혔다 —
       "대장간 모양"을 못 찾은 채 저다각형으로 5년 남느니, 돌집(화기에
       강한 석조)을 대장간으로 쓰는 편이 이 판의 다른 실사 건물과 결이
       맞는다. house_stone·house_wooden과 같은 trimesh 파이프라인
       (House·Wood 재질 노드만 추림, 4096→768px jpeg85) — 이번엔 원본에
       수레·양동이 같은 덤 오브젝트가 없어 그 단계가 필요 없었다.
       출처는 `ASSET_LICENSES.md` 참고 */
    /* 2026-09-05 — 여관·마방·방앗간도 같은 Medieval Hexagon Pack(위 우물
       주석 참고)에서 채웠다. 마방은 이 팩에 그 이름 그대로는 없다 — 병영
       (barracks)을 대신 앉혔다(사용자 지시로 역할·모양 일치를 요구하지
       않는다). 여관은 이 팩의 'tavern'(큰 맥주통이 통째로 간판을 겸하는
       모양 — 흔한 여관 도상은 아니지만 이 팩 자체의 방식이다), 방앗간은
      'windmill'(W-0321 — 풍차는 지웠다, 자체 mill_01 은 cfg.assets3d.reg) */
    /* SAGA WEB.md "E. 건물" 목록의 "탑" — 모루골(중심 마을)의 표지 건물로
       하나만 세운다. 2026-09-04 — Poly Haven `modular_fort_01`
       (성채 모듈 키트, CC0)에서 원형 탑 조각(`tower_round`) 하나만
       추려 옮겼다. 이 판엔 Blender·gltf-transform이 없어(다른 실사화는
       전부 이미 만들어진 파일을 복사했다) **처음으로 직접 변환**했다 —
       `trimesh`(Python)로 gltf+bin+diffuse 세 장만 받아(법선·거칠기 맵은
       이 판 재질(Lambert)에 안 쓰여 안 받음, `delam` 과 같은 이유) 768px
       재압축 후 단일 glb로 구웠다. 출처는 `ASSET_LICENSES.md` 참고.
       2026-09-05 — E 건물 목록(집·우물·대장간·여관·마방·방앗간) 여섯이
       이제 다 실사·CC0 에셋으로 찼다(모양이 정확히 원작 그대로는 아니다,
       사용자가 그래도 된다고 정했다) */
    /* 무기 'wpn:*' 열하나 — 옛 빌린 Quaternius·Poly 무기(models/weapons/)는 W-0321 에 지웠다. 자체 world3d 짝은 core.js cfg.assets3d.reg 가
       얹고(K-0116·W-0261), 못 얹으면 dungeon3d-gear 의 도형 그대로 */
    /* 몬스터 다양화 이어서 — 투구·왕관(`foeGear()`의 `look.helm`). 'helmet'(일반
       투구, **CC-BY 3.0**)·'crown'(왕관, CC0)만 채웠다. 출처는
       `assets/ASSET_LICENSES.md` 참고 */
    'gear:helmet': GEAR + 'helmet.glb',
    'gear:crown': GEAR + 'crown.glb',
    /* 2026-09-05(이어서) — 사용자 지시("모양이 완전히 안 맞아도 실사화가
       우선이다 · 못 찾으면 삭제하고 있는 걸로 대체")로 나머지 둘도 채웠다.
       `gapju`(원뿔형 동아시아 투구)는 CC0/CC-BY 어디에도 없어 **바이킹
       투구**(뿔 달린 서양 투구, **CC-BY 3.0**)로 대신한다 — 대장간=집
       모델과 같은 판단, 뿔이 있어도 "다른 투구를 쓴 정예"로는 충분히
       읽힌다. `cape`(망토)도 CC0 표준형은 없어 유일하게 찾은 완성
       망토 모델(**CC-BY 3.0**, 색이 이미 붉·금이라 세력색으로 덧물들이면
       탁해져 **tint 는 안 준다** — 항상 같은 붉·금 망토로, 지휘관급이라는
       인상은 여전히 준다)을 쓴다. `beard`(수염)는 마스카·콧수염 말고는
       진짜 CC0 턱수염 낱개가 없어 — **끝까지 찾아도 없어서 도형(각목)
       자체를 지웠다**(`foeGear()`의 `look.beard` 분기 삭제, 없으면 없는
       대로 둔다는 판단) */
    'gear:gapju': GEAR + 'viking_helmet.glb',
    'gear:cape': GEAR + 'cape.glb',
    /* 2026-09-06 — 갑주(tier, `foeGear()`의 `look.armor`). Quaternius
       "Ultimate RPG Items Bundle"(CC0)의 낱개 조각 — 위 무기·투구와 같은
       출처(poly.pizza). 출처는 `assets/ASSET_LICENSES.md` 참고 */
    'gear:armor:leather': GEAR + 'armor_leather.glb',
    'gear:armor:plate': GEAR + 'armor_metal.glb',
    /* 방 안 장식(PLAN 6절) — KayKit Dungeon Remastered(CC0). 여태 상자를 쌓아
       흉내 내던 자리를 실물로 갈아 끼운다. `dg:` 로 묶은 것은 **들판(field)의
       'pillar'·'wall' 과는 다른 자리**라는 뜻이다 — 저 둘은 사가만리에서 물려받은
       Arch.glb·Wall.glb 를 그대로 쓰므로 여기서 안 건드린다.
       출처는 `assets/ASSET_LICENSES.md` 참고 */
    /* 갇힌 우리(POI: 이벤트방) — 실제 감옥 창살 기둥. 자리마다 넷을 둘러 세운다 */
    /* 다음 방 문 — 열린 아치 하나만 받았다. 잠금·해금은 모델을 안 바꾸고
       색(tint)만 바꾼다 — 2D 가 오래 쓰던 신호(잠기면 어둡게, 풀리면 금빛)를
       그대로 지킨다 */
    /* 방 구석 잡동사니(순수 장식, PLAN 6절 보강) — 술통·상자 더미. 판정 신호가
       아니라서 GLB 를 못 받으면 그냥 안 세운다(다른 dg: 항목과 달리 fallback
       도형을 안 둔다) */
    /* 2026-09-04 — SAGA WEB.md 감사("의자·무기·방패" 소품)로 같은 KayKit 팩에서
       두 가지 더 받았다. 술통·상자와 같은 순수 장식 자리(방 구석)에 섞인다 */
    /* 2026-09-04 — PLAN §G "던전" 목록의 "함정". 판정(피해)은 손대지 않는다
       (밸런스는 사람이 정할 자리) — 방에 위험하다는 인상만 준다 */
    /* 보스방 벽 현수막 — 색은 세력이 아니라 "여기가 보스방" 신호라 하나로 고정 */
    /* 행상 좌판 — MarketStand(=`tent`) 위에 놓일 긴 상. 딱 맞는 "행상 수레"는
       못 찾아 대신한다 */
    /* 2026-09-04 — PLAN §G "던전" 목록의 "계단". 마지막 방의 문(`kind==='stair'`,
       dungeon.js의 makeDoors)은 다음 층으로 내려가는 자리인데, 3D는 여태
       다른 문과 똑같은 아치(dg:door)로만 그려 2D의 🪜 표시와 결이 안 맞았다.
       같은 KayKit 팩에서 실물 계단을 받아 이 문 하나만 갈아 끼운다 */
    /* 2026-09-04(이어서) — SAGA WEB.md "F. 소품" 목록의 "초"·"병". 같은
       KayKit 팩에서 받았다 — 키(key)·접시 더미는 세로가 짧고 가로가 길어
       (`normalize()`가 세로 기준으로 키를 맞추면 가로가 배로 부푼다) 이번엔
       건너뛰었다(부록 "안 되면 안 된다고 보고한다") */
    /* 2026-09-05 — 바로 위 주석이 "침대도 세로가 짧아 안 맞는다"고 적어
       뒀었는데, 실제 GLB 치수를 재 보니 틀렸다(키·접시와 달리 침대는
       세로가 40~55% — 이미 쓰고 있는 `dg:chest`(50%)와 같은 급이다).
       PolyScan "로그인 필요" 오판과 같은 종류의 실수 — 확인 없이 넘겨짚은
       것. `bed_decorated`(이불·베개 있는 완성형, KayKit 팩 — 맨 프레임보다
       한눈에 침대로 읽힌다)로 SAGA WEB.md "F. 소품"의 "침대"를 채운다 */
    /* 2026-09-05 — 같은 목록의 "책상". `dg:table`(긴 상, 행상 전용)과 갈라
       정사각 발판의 `table_small`을 쓴다 — 세로:가로 비율이 1:1:1이라
       `normalize()`와 가장 잘 맞는 모양이다 */
  };
  var REG = {};
  function restore() { var k; for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { REG[k] = DEFAULTS[k]; } } return REG; }
  restore();
  function register(key, url) { if (!key) { return REG; } if (url) { REG[key] = url; } else { delete REG[key]; } return REG; }

  /* 2026-09-14 — 진짜 버그 하나 잡음. `data-enemy.js`의 `body` 필드(예:
     'skeleton_minion'·'ghost'·'dragon_evolved')는 접두어 없는 맨 이름인데,
     "몬스터 100개" 확장(2026-09-07~11)이 DEFAULTS 에 채운 58종은 전부
     `monster:` 접두 키(`monster:skeleton_minion` 등)였다 — `dungeon3d.js`의
     foeBody 조립(`AS3.build(enemyDef.body, ...)`)은 그 접두어를 붙이는
     자리가 없어 REG[kind] 가 늘 undefined, `wants()` 가 false 를 돌려줘
     **GLB 를 하나도 못 받고 조용히 상자(fallback shape)로만 그려지고
     있었다**(예외가 안 나 자가진단·500회 스폰 검사 어느 것도 못 잡음 —
     둘 다 "구조가 맞는지"만 보지 "GLB 가 실제로 붙는지"는 안 봤다). 보스
     '천룡'(`dragon_evolved`)도 포함해 짐승형 94개 중 88개가 여기 걸려
     있었다(Node vm 으로 REG 대조해 직접 확인). 맨 이름이 안 잡히면
     `monster:` 를 붙여 한 번 더 찾는다 — dead 네임스페이스였던 `monster:`
     접두 키를 이제 실제로 연결한다. DEFAULTS·data-enemy.js 는 한 글자도
     안 건드렸다(주석 "여기는 안 건드리고 표만 고치면 된다"의 그 표 쪽 문제였다). */
  function lookup(kind) {   // W-0147 — 'crea:<id>' = 자체툴 몬스터 몸(통일 world 표 · 2D 시트·초상과 같은 monsterPortrait.idOf id), 없으면 null
    var A3 = global.DG.assets3d, cu = /^crea:/.test(kind) && A3 && A3.url ? A3.url('world', kind.slice(5)) : null, mk = 'monster:' + kind;
    if (cu || /^crea:/.test(kind)) { return cu ? { key: kind, url: cu } : null; }
    return REG[kind] ? { key: kind, url: lightOf(kind, REG[kind]) } : (REG[mk] ? { key: mk, url: REG[mk] } : null);
  }
  /* W-0186 — 폰(터치 + 짧은 변 ≤ 500px)이면 실사 자연물(나무 2.4MB·바위 300~600KB)을 옛 저다각형 표(NATURE_STYLIZED)로 — 1만리 W-0185 와 같은 규칙.
     표가 실사(realistic/)를 가리킬 때만 바꾼다(편집기로 갈아 낀 것은 그대로). 창이 열릴 때 한 번 정함. 손잡이 asset3d.light 1 = 늘 · 0 = 안 씀 · 그 밖 = 자동 */
  var lightAuto = null;
  function light() {
    var k = tuned('asset3d.light', 'auto');
    if (k === 1 || k === '1') { return true; }
    if (k === 0 || k === '0') { return false; }
    if (lightAuto === null) { var n = global.navigator || {}, w = global.innerWidth || 0, h = global.innerHeight || 0; lightAuto = !!((('ontouchstart' in global) || n.maxTouchPoints > 0) && w > 0 && h > 0 && Math.min(w, h) <= 500); }
    return lightAuto;
  }
  function lightOf(kind, url) { return NATURE_STYLIZED[kind] && light() && JSON.stringify(url).indexOf('/realistic/') >= 0 ? NATURE_STYLIZED[kind] : url; }

  function strHash(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }
  /** 목록 한 줄이 오브젝트면 `key`(레시피), 아니면 URL 문자열 자체가 그 항목의
   *  변치 않는 정체다 — 목록에서 몇 번째냐와 무관하다. */
  function itemId(item) { return (item && typeof item === 'object') ? (item.key || '') : String(item); }
  /**
   * 표 한 줄이 여럿이면 씨앗 문자열로 하나를 고른다 — 같은 자리는 늘 같은 것.
   *
   * 2026-09-07 — 예전엔 `h % list.length`(위치 기반 나머지)였다. "캐릭터
   * 100개" 목표로 `HERO_RECIPES_LIGHT`가 이 세션에서만 6→24→26→41 로 세 번
   * 늘었는데, **나머지 연산은 길이가 바뀌면 거의 모든 씨앗의 나머지 값이
   * 함께 바뀐다**(분산 캐싱에서 널리 알려진 함정) — 새 종을 추가할 때마다
   * 마을의 NPC·동행 **전원**이 이미 받아 둔 모델을 버리고 새 모델을 다시
   * 받는 꼴이었다. 폰 실기기 "여전히 느리다" 제보의 실제 몸통.
   *
   * Rendezvous(HRW) 해싱으로 바꾼다 — 항목마다 (씨앗+그 항목의 정체)를 따로
   * 해시해 가장 큰 값을 고른다. 표에 새 항목이 늘어도 **그 항목이 새로
   * 뽑히는 확률(1/새 길이)만큼만** 기존 씨앗이 바뀐다 — 전원이 흔들리던
   * 것과 달리 극소수만, 그것도 새로 추가된 항목으로만 옮겨간다.
   */
  function oneOf(list, seed) {
    if (!list) { return null; }
    if (typeof list === 'string') { return list; }
    if (!list.length) { return null; }
    var s = String(seed || '');
    var best = null, bestH = -1, i, h;
    for (i = 0; i < list.length; i++) {
      h = strHash(s + '|' + itemId(list[i]));
      if (h > bestH) { bestH = h; best = list[i]; }
    }
    return best;
  }
  function urlOf(kind, seed) {
    var h = lookup(kind);
    if (!h) { return null; }
    var v = oneOf(h.url, seed);
    if (v && typeof v === 'object') { return v.key || null; }
    return v;
  }
  /* 2026-09-07 — "한 장면에 하나뿐이라 무거워도 감당된다"던 foe·초상 가정이
     틀렸다: `dungeon.js`의 방 구성(`spawnEnemy` 루프)이 사람 형 적을 방 하나에
     여럿(2~5) 세우는 경우가 흔하다. 사람 형 적 이름마다 `oneOf()` 해시가
     제각각이라, 방에 들어서는 순간 서로 다른 MPFB 실사 몸(파일당 3.5~7.6MB,
     `retargetInto()` 골격 재배치까지) 여러 개를 동시에 새로 받는 꼴이었다 —
     NPC·동행을 hero_light로 묶었던 것과 똑같은 함정을 foe만 비켜 갔던 것.
     `me:`로 시작하는 리터럴(`meRenderParams()`의 `QRPG_SEEDS`, 이미 해시로
     QRPG 자리에만 떨어지게 손으로 확인해 둔 값)만 전체 표를 그대로 쓰고,
     그 밖(npc·ally·foe·초상 `hero:`)은 전부 가벼운 표만 고른다. */
  function heroKindFor(seed) {
    var s = String(seed || '');
    return (s.indexOf('me:') === 0) ? 'hero' : 'hero_light';
  }
  /* 2026-09-25 — "캐릭터 모두 다르게" ②(tools/asset-audit/CHARACTER_UNIQUENESS.md): 사람 적·보스·마을 사람은
     VRoid 네 벌 해시(한 몸당 수십 명) 대신 **이름마다 제 몸**을 손으로 짝지었다 — 모두 다른 hero_light 한 벌,
     역할에 어울리게(산적=바이킹·왜구=해적·마적=카우보이·기병=기사…). 도감 인물·동행·나는 VRoid 그대로.
     그림체는 Quaternius 저폴리 계열만(Kenney 블록형 제외), 세 시대 적·손님이 쓰는 파일(§5.20)도 뺐다.
     키는 buildHero 씨앗 — 적은 표시 이름, 마을 사람은 'npc:'+키. 손잡이 `asset3d.fixedBody`(0 = 옛 해시).
     ppmore_adventurer2·ppmore_soldier2 는 ppmen_adventurer·ppwomen_soldier 와 같은 GLB(md5 같음)라 안 쓴다(2026-09-25 2D 사람 시트로 발견) */
  var FIXED_HERO = {
    '황건적': 'ogau_worker_male', '산적': 'ogau_viking_male', '도적떼': 'kaykitadv_rogue_hooded',
    '떠돌이 병졸': 'ogau_soldier_male', '왜구': 'ogau_pirate_male', '마적': 'ogau_cowboy_male',
    '오랑캐 궁수': 'qrpg_ranger', '거란 기병': 'ogau_bluesoldier_male', '여진 궁수': 'ogau_elf',
    '몽골 기병': 'ogau_knight_male', '왜군 조총병': 'ogau_ninja_male', '위군 창병': 'ogau_viking_female',
    '수군 척후선': 'pppirate_henry', '철갑 중장병': 'ogaknight_char', '근위 기병': 'kaykitadv_knight',
    '연노 사수': 'ogau_bluesoldier_female', '수군 함대': 'pppirate_anne', '흑기병': 'ogau_knight_golden_male',
    '황건 두목': 'qrpg_warrior', '산채 두령': 'kaykitadv_barbarian', '왜구 선장': 'pppirate_piratecaptain',
    '오랑캐 족장': 'ppwide_soldier', '거란 도통': 'ogau_soldier_female', '몽골 만호장': 'ppmen_adventurer',
    '왜장': 'ogau_kimono_male', '위군 도독': 'ppmen_king', '관문 수호장': 'ogau_knight_golden_female',
    '적국 대장군': 'ppwomen_hoodedadventurer',
    'npc:captain': 'ppwomen_soldier', 'npc:quarter': 'ogau_worker_female', 'npc:master': 'qrpg_monk',
    'npc:smith': 'ogau_casual_bald', 'npc:pedlar': 'ppmen_farmer', 'npc:scribe': 'ogau_oldclassy_male',
    'npc:herald': 'ppmen_manlongsleeves', 'npc:fieldmerchant': 'ppmore_charsam'
  };
  var lightByKey = null;
  function fixedRecipe(seed) {
    if (!tuned('asset3d.fixedBody', 1)) { return null; }
    var k = FIXED_HERO[String(seed)];
    if (!k) { return null; }
    if (!lightByKey) { lightByKey = {}; HERO_RECIPES_LIGHT.forEach(function (r) { lightByKey[r.key] = r; }); }
    return lightByKey[k] || null;
  }

  function heroRecipe(seed) {
    var A3U = global.DG.assets3d, frec = (A3U && (A3U.heroRecipe(seed) || A3U.borrowRecipe(seed))) || fixedRecipe(seed);   // 통일 GLB(W-0021) 먼저, 제 몸 없으면 빌린 몸(W-0074)
    if (frec) { return frec; }
    if (wantsAnimeAvatar()) {
      var arec = oneOf(HERO_RECIPES_ANIME, seed);
      if (arec) { return arec; }
    }
    var h = lookup(heroKindFor(seed));
    if (!h) { return null; }
    var v = oneOf(h.url, seed);
    return (v && typeof v === 'object' && v.body) ? v : null;
  }
  function wants(kind, seed) {
    var k = (kind === 'hero') ? heroKindFor(seed) : kind;
    return GLB_ON() && !!urlOf(k, seed);
  }

  /* ── 애니메이션 이름 맞추기 — 사가만리와 같은 요령 ─────── */
  var SLOTS = ['idle', 'walk', 'run', 'sprint', 'attack', 'hit', 'dodge', 'death', 'interaction', 'jump', 'land'];
  /* 2026-09-07 — Wasp(poly.pizza Animated Enemies)는 걷기 없이 Attack·Death·
     Flying 셋뿐이라 idle 에 'fly' 낱말을 더해야 가만있을 때도 날갯짓이 돈다 */
  var WORDS = {
    idle: ['idle', 'stand', 'standing', 'breathe', 'rest', 'wait', 'loop', 'fly', 'flying', 'hover'],
    walk: ['walk', 'walking', 'locomotion', 'move'],
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
      if (name === w) { s = 100; } else if (name.indexOf(w) === 0) { s = 70; }
      else if (name.indexOf(w) >= 0) { s = 40; } else { continue; }
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

  /* ── 크기 맞추기 — 키 1 로 눕히고 세우는 쪽이 배율(mul)을 준다 ───── */
  function fit(box) {
    var h = (box.maxY - box.minY) || 1;
    var s = 1 / h;
    return { scale: s, dy: -box.minY * s, dx: -((box.minX + box.maxX) / 2) * s, dz: -((box.minZ + box.maxZ) / 2) * s };
  }
  function normalize(obj, mul) {
    var t = three();
    obj.updateMatrixWorld(true);
    var b = new t.Box3().setFromObject(obj);
    var f = fit({ minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z });
    var m = mul || 1;
    var wrap = new t.Group();
    obj.scale.setScalar(f.scale * m);
    obj.position.set(f.dx * m, f.dy * m, f.dz * m);
    wrap.add(obj);
    return wrap;
  }

  /* 2026-09-18 — PLAN §6.1-3 후속 과제. 외곽선은 **배우**(사람·짐승·몬스터
     GLB)만 받는다 — 이 asset3d.js 는 그것들과 나무·바위·건물·무기·갑주까지
     같은 `build()`/`delam()` 경로를 태우므로(사가만리처럼 소품 전용 파일이
     따로 없다), kind 문자열이 아니라 **최종 GLB 폴더**로 가른다. 폴더 셋은
     위 표(PEOPLE·PEOPLE_QRPG·PEOPLE_MONSTERS_Q·ANIMALS·ANIMALS_EXTRA*·
     `monsters/quaternius_dino`·`monsters/quaternius_cute`)가 전부
     `models/(people|animals|monsters)/` 밑이라 이 한 정규식으로 잡힌다.
     NATURE·PROPS·BLD·DUN·WPN·GEAR 는 전부 빠진다(의도, 방 경계·무기에
     테두리가 생기는 위험을 피한다 — 화면 확인 없이 짠 이번 손질에서도
     그 위험만은 여전히 안 무릅쓴다). */
  /* 2026-09-23 — animals_extra·animals_extra2(사가나락 "펫 100개" 모델)·standin(신수·오마주 대역)도 배우. 전엔 `animals/` 만 맞아 그 펫들이 외곽선·림 없이 구워졌다 */
  function isActorAsset(url) {
    return typeof url === 'string' && /\/models\/(people|animals|animals_extra2?|standin|monsters)\/|\/creatures3d\/|^crea:/.test(url);   // W-0356 자체 몸(creatures3d·crea:<id>)도 배우
  }

  /* 2026-09-19 — PLAN §6.1-5가 나중으로 미룬 "풀 바람 셰이더"(sway3d.js).
     잡초 GLB(`assets/models/nature/` 밑 Grass·Flowers·Bush·Shrub, 위
     `NATURE_STYLIZED`·`DEFAULTS` 표 참고)만 흔든다 — 나무·바위·통나무·
     표지판은 파일 이름으로 자동으로 빠진다(뿌리까지 통째로 흔들리면
     어색하다, 사가만리가 GLB 나무를 sway 밖에 둔 이유와 같다). `models/
     animals/` 밑 물고기 펫 `Flower_Horn.glb` 처럼 이름만 겹치는 것은
     폴더 접두(`/models/nature/`)로 먼저 걸러 안 걸린다. */
  function isSwayAsset(url) {
    return typeof url === 'string' && (/\/models\/nature\//.test(url) && /grass|flower|bush|shrub/i.test(url) || /\/world3d\/(grass_tuft|flower_patch|bush)_/.test(url));   // W-0322 자체 풀·꽃·덤불도
  }

  /* ── PBR 을 벗긴다 — 환경맵 없는 이 판의 조명에 그대로 쓰면 새까맣게
   *  선다(사가만리가 2026-08-29 에 먼저 밟은 함정, `SAGA-HANDOFF.md` 참고) */
  function delam(root, url) {
    var t = three();
    var TN = global.DG.toon3d;
    var toon = !!(TN && TN.TOON_ON());
    var wantOutline = !!(TN && TN.OUTLINE_ON()) && isActorAsset(url);
    var SW = global.DG.sway3d;
    var wantSway = !!SW && isSwayAsset(url);
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      /* **법선이 아예 없는 GLB**(2026-09-04, "House"·"Wood" 새까만 자리로
         잡힌 함정) — PolyScan 실사 스캔 일부는 좌표·UV만 있고 법선을 안
         담아 낸다. 법선이 없으면 Lambert 재질은 빛과 내적할 방향이 없어
         **조명 세기와 무관하게 통째로 새까맣게** 뜬다(재질·텍스처·그림자·
         SSAO 어느 것도 무관 — 줌을 당겨도 안 바뀌는 것이 이 함정의
         특징이다). 지오메트리에서 바로 계산해 채운다 */
      if (!o.geometry.attributes.normal) { o.geometry.computeVertexNormals(); }
      var one = Array.isArray(o.material) ? o.material : [o.material];
      var out = one.map(function (m) {
        if (!m || (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { return m; }
        var nm;
        /* 2026-09-17 — SAGA-DESIGN §6.1 적용분. 툰 손잡이가 켜져 있으면
           `toon3d.toonify()`(DoubleSide·알파클립까지 옮긴다), 꺼져 있으면
           예전 그대로 Lambert 로 벗긴다 */
        if (toon) {
          nm = TN.toonify(m);
          nm.side = t.DoubleSide;   // 이 판의 방침(위 주석) — 툰이어도 그대로 지킨다
          /* 2026-09-23 "고품질 셀 셰이딩급" 2단계 — 배우(사람·짐승·몬스터)에만 밝기 비례 림 라이트(toon3d.applyRimLight) */
          if (TN.applyRimLight && isActorAsset(url)) { TN.applyRimLight(nm); }
        } else {
          /* vertexColors 를 안 옮기면(정점빛깔로 색을 주고 baseColorFactor 는
             검게 비워 둔 옷감이 있다) 그 자리가 조명과 무관하게 통째로 새까맣게
             뜬다 — 2026-09-03, saga-realm 에서 먼저 밟은 함정 */
          nm = new t.MeshLambertMaterial({
            color: m.color ? m.color.clone() : new t.Color(0xffffff),
            map: m.map || null, vertexColors: !!m.vertexColors,
            transparent: !!m.transparent, opacity: m.opacity,
            alphaTest: m.alphaTest || 0,
            /* **뒤집힌 면(winding)도 있는 채로 받는다** — 2026-09-05, poly.pizza
               'Pond'(CC-BY)에서 물 표면 사각형 하나가 통째로 반대로 감겨 있어
               `side: m.side`(기본 FrontSide) 그대로 두면 이 각도에서 컬링돼
               안 보였다(지오메트리는 와이어프레임으로 확인하면 분명히 있다 —
               단면 컬링만의 문제). 실사 스캔·저다각형 팩 가릴 것 없이 이런
               면이 또 나올 수 있어 **항상 DoubleSide로 받는다** — 그리기 비용은
               미미하고, 맞는 면이면 결과가 똑같다 */
            side: t.DoubleSide
          });
        }
        /* PLAN §6.1-5 나머지 절반(풀 바람 셰이더, sway3d.js) — 잡초 GLB(위
           wantSway)만, 이 GLB 안의 재질 전부에 건다(잎·줄기가 낱장 메시로
           안 갈려 있어도 통째로 흔드는 편이 자연스럽다) */
        if (wantSway) { SW.swayify(nm); }
        return nm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    /* 외곽선 — 모델 안에서는 **가장 큰 부품 반지름 × 2% 한 폭**, 그 12% 보다 작은 부품(눈·이빨·발굽)은 안 두른다(사가종횡 delam 과 같다).
       예전엔 부품마다 제 반지름 × 3%(최소 0.006)라 반지름 0.002~0.03 인 동물 GLB 에서 외곽선이 부품보다 두꺼워 검은 파편이 번졌다(2026-09-23).
       VRoid 는 vroid-variant 가 이미 둘러 `_toonOutline` 로 건너뛴다. traverse 도중 자식을 더하지 않으려고 모아서 붙인다 */
    if (toon && wantOutline) {
      var olMs = [], olMax = 0;
      root.traverse(function (o) {
        if (!o.isMesh || !o.geometry || (o.userData && o.userData._toonOutline) || /_outline$/.test(o.name || '')) { return; }
        if (!o.geometry.boundingSphere) { o.geometry.computeBoundingSphere(); }
        var r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
        olMs.push({ m: o, r: r });
        if (r > olMax) { olMax = r; }
      });
      olMs.forEach(function (x) { if (olMax > 0 && x.r >= olMax * 0.12) { TN.outline(x.m, olMax * 0.02); } });
    }
  }

  var cache = {};
  /* 2026-09-07 — 압축 파이프라인 도입(마을 GLB 총량이 너무 무거워 폰이
     먹통 되던 것). `THREE.MeshoptDecoder`(entry.js에 새로 얹음, wasm이
     파일 안에 박혀 있어 file:// 단독판에서도 그대로 돈다)를 GLTFLoader에
     한 번만 물려 둔다 — 압축 안 된 옛 GLB는 이 디코더가 있어도 그냥
     무시되니(EXT_meshopt_compression 확장이 없으면 안 탄다) 회귀 걱정 없다. */
  function loader() {
    var t = three();
    if (!t || !t.GLTFLoader) { return null; }
    if (!loader.it) {
      loader.it = new t.GLTFLoader();
      if (t.MeshoptDecoder) { loader.it.setMeshoptDecoder(t.MeshoptDecoder); }
    }
    return loader.it;
  }
  function firstSkinned(obj) {
    var found = null;
    obj.traverse(function (o) { if (!found && o.isSkinnedMesh) { found = o; } });
    return found;
  }
  function cloneScene(gltf) {
    var t = three();
    if (t.SkeletonUtils && t.SkeletonUtils.clone) { return t.SkeletonUtils.clone(gltf.scene); }
    return gltf.scene.clone(true);
  }
  /* 2026-09-07 — 폰 실기기 "마을 진입 직후 먹통" 신고. 마을 하나가 GLB 서른
     예닐곱 개를 부르는데, 이 함수가 여태 제한 없이 `ld.load()`를 그 자리에서
     다 불렀다 — 응답이 비슷한 시각에 몰려 돌아오면 `GLTFLoader.parse()`(메인
     스레드, 디코드+지오메트리 조립)가 한 프레임도 못 그리고 줄줄이 이어져
     그 구간 전체가 먹통으로 보인다. **한 번에 도는 개수만 줄인다**(내려받는
     총량·최종 화면은 그대로) — 나머지는 줄을 서 있다가 하나 끝나는 대로 다음
     것이 시작돼, 파싱 사이사이 화면이 그려질 틈이 생긴다. */
  var MAX_INFLIGHT = 3;
  var inflight = 0;
  var startQ = [];
  /* W-0214 — 폰(light())이면 마을 사람 몸(withLazy 안에서 부른 받기)은 **낮은 줄**: 높은 줄(건물·나무·내 몸·동료)이 빈 지
     LOW_GAP ms 가 지나야 시작한다. 4G 폰에서 주민 몸 아홉(각 ~600KB)이 먼저 줄을 차지해 45초가 지나도 건물이 상자였다.
     같은 파일을 높은 쪽이 다시 부르면 높은 줄로 올린다. 손잡이 asset3d.lazyNpc(auto = 폰 · 1 · 0) */
  var lowQ = [], lowScope = false, lastHi = 0, lowTimer = null, LOW_GAP = 1500, lowSince = 0, LOW_MAX = 15000;   // LOW_MAX — 높은 쪽이 계속 이어져도 이만큼 지나면 푼다
  function LAZY_NPC() { var k = tuned('asset3d.lazyNpc', 'auto'); if (k === 1 || k === '1') { return true; } if (k === 0 || k === '0') { return false; } return true; }   // W-0275 auto = 모든 기기(옛: 폰만) — PC 도 사람 몸 아홉이 먼저 줄을 서서 건물이 상자로 남았다(사용자 10-17 "로딩 보기 싫어")
  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function withLazy(fn) { var keep = lowScope; lowScope = LAZY_NPC(); if (lowScope) { lastHi = Math.max(lastHi, nowMs()); } try { return fn(); } finally { lowScope = keep; } }
  function lowReady() {
    if (!lowQ.length) { return false; }
    var now = nowMs(), wait = Math.min(LOW_GAP - (now - lastHi), LOW_MAX - (now - lowSince));
    if (wait <= 0) { return true; }
    if (!lowTimer && typeof setTimeout !== 'undefined') { lowTimer = setTimeout(function () { lowTimer = null; pump(); }, wait + 20); }
    return false;
  }
  /** W-0325 — 높은 줄에서 카메라에 가장 가까운 몸을 기다리는 파일부터(몸이 안 걸린 파일 = 미리 받기·사람 우선은 거리 0 으로 앞). 손잡이 asset3d.nearFirst(1) */
  var nearV = null;
  function takeNear() {
    var D3 = global.DG.dungeon3d, cam = D3 && D3.camNode ? D3.camNode() : null, t = three();
    if (!tuned('asset3d.nearFirst', 1) || !cam || !t || startQ.length < 2) { return startQ.shift(); }
    nearV = nearV || new t.Vector3();
    var best = 0, bd = Infinity, i, j;
    for (i = 0; i < startQ.length; i++) {
      var c = cache[startQ[i]], d = c && c.shells && c.shells.length ? Infinity : 0;
      if (c && c.shells) { for (j = 0; j < c.shells.length; j++) { var s = c.shells[j]; if (!s.parent) { continue; } s.updateWorldMatrix(true, false); s.getWorldPosition(nearV); d = Math.min(d, nearV.distanceToSquared(cam.position)); } }
      if (d < bd) { bd = d; best = i; if (d === 0) { break; } }
    }
    return startQ.splice(best, 1)[0];
  }
  /** W-0325 가림막 — 카메라 시야 안 몸 중 GLB 가 된 비율(시야 안 몸이 없으면 1) */
  var frus = null, frM = null, boxV = null;
  function readyRatio() {
    var D3 = global.DG.dungeon3d, cam = D3 && D3.camNode ? D3.camNode() : null, t = three();
    if (!cam || !t) { return 1; }
    frus = frus || new t.Frustum(); frM = frM || new t.Matrix4(); boxV = boxV || new t.Vector3();
    cam.updateMatrixWorld(); frM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frus.setFromProjectionMatrix(frM);
    var glb = 0, all = 0, i;
    for (i = 0; i < tracked.length; i++) { var s = tracked[i], st = s.userData.assetState; if (!s.parent || st === 'fail') { continue; } s.getWorldPosition(boxV); if (!frus.containsPoint(boxV)) { continue; } all++; if (st === 'glb') { glb++; } }
    return all ? glb / all : 1;
  }
  function pump() {
    while (inflight < MAX_INFLIGHT && (startQ.length || lowReady())) {
      var url = startQ.length ? takeNear() : lowQ.shift();
      var c = cache[url];
      if (!c || c.state !== 'queued') { continue; }
      var ld = loader();
      if (!ld) { c.state = 'fail'; flush(c, null); continue; }
      c.state = 'load';
      inflight++;
      (function (url, c) {
        startLoad(ld, url, function (gltf) {
          /* 2026-09-08 — "사가나락 끊김" 추적. dungeon3d.js의 render()·
             game.js의 loop() 다섯 구간을 다 재도 여전히 dt=150~450ms대
             튐이 그 안 어디에도 안 잡혔다(합쳐도 몇~수십 ms) — GLTFLoader의
             `onLoad` 콜백(디코드 뒤 지오메트리 조립+여기 delam/flush)은
             rAF 프레임 밖(네트워크 응답이 도착한 그 순간)에서 실행되니
             render()/loop() 어느 쪽 실측에도 안 걸린다. flush()가 이
             URL을 기다리던 소비자(actorOf 등)를 전부 그 자리에서 동기로
             깨우므로, 대기자가 여럿이면 그 수만큼 cloneScene(SkeletonUtils
             .clone, 스킨드메시 깊은 복제) 비용이 한 번에 몰린다 — 유력 용의자. */
          var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          var waitN = c.waiting.length;
          inflight--;
          c.state = 'ok'; c.gltf = gltf;
          /* 2026-09-23 — VRoid(unlit → MeshBasic)는 delam 이 안 보는 재질이라 명암 없이 평면으로 떴다.
             먼저 툰 + 오픈월드 RPG식 얼굴 그림자로 바꾼다(다섯 판 공용 vroid-variant.js). 외곽선은 아래 delam 이 그대로 두른다 */
          if (global.DG.vroidVariant && global.DG.vroidVariant.shade) { global.DG.vroidVariant.shade(gltf.scene, url); }
          delam(gltf.scene, url);
          c.clips = gltf.animations || [];
          c.map = mapClips(c.clips.map(function (a) { return a.name; }));
          flush(c, c);
          pump();
          var ms = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
          if (ms > 15 && typeof console !== 'undefined') {
            console.log('[던전 GLB 도착후처리]', 'ms=' + ms.toFixed(1) + ' waiting=' + waitN + ' url=' + url);
          }
        }, function () {
          inflight--;
          c.state = 'fail'; flush(c, null);
          pump();
        });
      })(url, c);
    }
    prefetchAhead();
  }
  /* W-0215 — 받기와 조립 겹치기. 폰(느린 CPU)은 GLB 하나 조립(parse)에 1~6초가 걸리는데 그동안 칸을 쥐어 다음 받기가 늦게 나갔다.
     줄 앞 prefetchN 개는 바이트를 미리 받아 두고(bytes), 칸이 나면 그 바이트로 곧장 parse — 받기 실패·parse 실패면 옛 ld.load.
     손잡이 asset3d.prefetchBytes(auto = 폰 표 light() · 1 · 0)·asset3d.prefetchN(4) */
  var bytes = {};
  function PREF_ON() { var k = tuned('asset3d.prefetchBytes', 'auto'); if (k === 1 || k === '1') { return true; } if (k === 0 || k === '0') { return false; } return light(); }
  function prefetchAhead() {
    if (!PREF_ON() || typeof fetch === 'undefined') { return; }
    var want = +tuned('asset3d.prefetchN', 4) || 0, n = 0, i, u, c;
    for (i = 0; i < startQ.length && n < want; i++) {
      u = startQ[i]; c = cache[u];
      if (!c || c.state !== 'queued') { continue; }
      n++;
      if (!bytes[u]) { bytes[u] = fetch(u).then(function (r) { return r.ok ? r.arrayBuffer() : null; })['catch'](function () { return null; }); }
    }
  }
  function startLoad(ld, url, ok, bad) {
    var b = bytes[url];
    delete bytes[url];
    var plain = function () { ld.load(url, ok, null, bad); };
    if (!b || !ld.parse) { plain(); return; }
    b.then(function (buf) {
      if (!buf) { plain(); return; }
      var got = false;   // R-5 — ok 안에서 던지면 GLTFLoader 가 onError 로 돌린다: 그땐 옛 길로 다시 받지 않는다(ok 두 번·inflight 두 번 감소)
      try { ld.parse(buf, url.slice(0, url.lastIndexOf('/') + 1), function (g) { got = true; ok(g); }, function (e) { if (!got) { plain(); } else { if (typeof console !== 'undefined') { console.warn('[던전 GLB 후처리 오류]', url, e); } if (bad) { bad(e); } } }); } catch (e) { if (!got) { plain(); } }   // R-5(2) — ok 안 예외는 옛 ld.load 길처럼 bad 로(대기자 깨움·pump)
    });
  }
  function acquire(url, done) {
    var A3c = global.DG.assets3d, cu = A3c && A3c.creatureFor ? A3c.creatureFor(url) : null; if (cu) { url = cu; } var c = cache[url];   // W-0163 빌린 동물·탈것 → 자체판(creatures3d)
    if (c && c.state === 'ok') { done(c); return; }
    if (c && c.state === 'fail') { done(null); return; }
    if (c) { c.waiting.push(done); if (!lowScope && c.low && c.state === 'queued') { var li = lowQ.indexOf(url); if (li >= 0) { lowQ.splice(li, 1); } c.low = false; startQ.push(url); lastHi = nowMs(); pump(); } return; }   // W-0214 높은 쪽이 부르면 올린다
    c = cache[url] = { state: 'queued', waiting: [done], low: lowScope };
    if (lowScope) { if (!lowQ.length) { lowSince = nowMs(); } lowQ.push(url); } else { startQ.push(url); lastHi = nowMs(); }
    pump();
  }
  function flush(c, arg) { var w = c.waiting; c.waiting = []; for (var i = 0; i < w.length; i++) { w[i](arg); } }

  /** 원본(캐시된, delam() 끝난) 씬을 클론 없이 그대로 넘긴다 — 2026-09-06,
   *  `field-instance.js` 가 인스턴싱을 하려면 지오메트리·재질을 직접 읽어야
   *  하는데, `build()`/`buildHero()` 처럼 매번 `cloneScene()` 하면 인스턴싱의
   *  의미가 없어진다(공유해야 할 지오메트리를 오히려 늘리는 꼴). **받는 쪽은
   *  이 씬을 절대 변형하면 안 된다** — 다른 모든 소비자가 같은 참조를 쓴다 */
  function rawScene(url, done) { acquire(url, function (c) { done(c ? c.gltf.scene : null); }); }

  /** 이 재질을 hex 로 물들인다(흰 옷에 곱하는 값이라 너무 어두우면 안 된다) — 없으면 안 물들인다 */
  var tintCache = {};
  function applyTint(model, hex) {
    var t = three();
    if (!hex || !t) { return model; }
    var tc = new t.Color(hex);
    model.traverse(function (o) {
      if (!o.isMesh || !o.material) { return; }
      var src = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!src || src.isShaderMaterial) { return; }   // 외곽선 재질은 물들이지 않는다(2026-09-23)
      var key = (src.uuid || '') + '|' + hex;
      if (!tintCache[key]) {
        var TNc = global.DG.toon3d;
        var m = TNc && TNc.cloneMat ? TNc.cloneMat(src) : src.clone();   // 림 셰이더까지 옮긴다
        m.color = new t.Color(src.color ? src.color.getHex() : 0xffffff).multiply(tc);
        tintCache[key] = m;
      }
      o.material = tintCache[key];
    });
    return model;
  }

  /* ── 몸짓 옮겨 입히기(retarget) — 2026-09-05, MPFB 실사 몸을 들이며 saga-go
   * 에서 그대로 옮겨 온다(saga-go asset3d.js 참고, 뼈대 크기·뼈 이름표까지
   * 겪은 함정이 다 이 안에 있다). QRPG(제 클립 있음)는 이 길을 안 탄다 —
   * `buildHero()`가 `rec.anim !== rec.body`일 때만 부른다. */
  function sceneHeight(obj) {
    var t = three();
    var b = new t.Box3().setFromObject(obj);
    return Math.max(1e-4, b.max.y - b.min.y);
  }
  /** VRM Humanoid(VRoid, `J_Bip_C/L/R_*`) → 이 판 뼈 이름 표(2026-09-20, 사가마을
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
  /** 원본(src)의 클립들을 이 몸(c)에 맞게 다시 굽는다. 못 하면 빈 배열 —
   *  그러면 이 몸은 가만히 선다(뒤틀리는 것보다 낫다) */
  function retargetInto(c, src) {
    var t = three();
    if (!t || !t.SkeletonUtils || !t.SkeletonUtils.retargetClip) { return []; }
    var tgt = firstSkinned(c.gltf.scene), s = firstSkinned(src.gltf.scene);
    if (!tgt || !s) { return []; }
    /* 옮기는 동안 뼈가 실제로 움직이므로 사본으로 굴린다 — 원본을 굴리면
       그 모델을 쓰는 다른 배우가 같이 뒤틀린다 */
    var tc = cloneScene(c.gltf), sc = cloneScene(src.gltf);
    var tm = firstSkinned(tc), sm = firstSkinned(sc);
    if (!tm || !sm) { return []; }
    tc.updateMatrixWorld(true); sc.updateMatrixWorld(true);
    /* 뼈대 크기를 맞춘다 — retargetClip은 엉덩이(hip) 위치는 원본 값을
       그대로 옮기므로(preserveBonePositions), 두 뼈대 키 비율만큼 스케일을
       같이 넘겨야 발이 땅에서 뜨지 않는다 */
    var mul = sceneHeight(tc) / sceneHeight(sc);
    /* 뼈 이름표 — 이것이 없으면 옮겨지지 않는다(번들 SkeletonUtils가
       이름이 같은 뼈끼리만 잇는다) */
    var names = boneNameMap(tm, sm);
    if (!names.count) { return []; }
    var out = [], i, j, clip;
    for (i = 0; i < src.clips.length; i++) {
      try {
        clip = t.SkeletonUtils.retargetClip(tm, sm, src.clips[i],
          { hip: 'Hips', scale: mul, names: names.map });
        if (clip) {
          clip.name = src.clips[i].name;
          /* retargetClip이 굽는 트랙 이름(`.bones[뼈이름].quaternion`)은
             AnimationMixer가 루트=SkinnedMesh일 때만 푼다. 여기 루트는
             normalize()가 감싼 Group이라 못 내려가 조용히 안 움직인다 —
             뼈이름만 남긴 평범한 트랙 이름으로 바꾸면 Group에서부터
             재귀로 찾아 그대로 먹힌다(saga-go가 "팔이 T자" 버그로 먼저 잡음) */
          for (j = 0; j < clip.tracks.length; j++) {
            clip.tracks[j].name = clip.tracks[j].name.replace(/^\.bones\[([^\]]+)\]/, '$1');
          }
          out.push(clip);
        }
      } catch (e) { /* 이 클립 하나만 건너뛴다 */ }
    }
    return out;
  }

  /** 몸 하나 — 몸 위에 옷·머리를 얹어 한 뼈대에 묶는다(사가만리와 같은 요령,
   *  세 파일이 뼈 이름·순서까지 완전히 같아 그냥 bind() 하면 된다) */
  function assembleHero(parts, mul, tintHex, rec) {
    var bodyScene = cloneScene(parts.body.gltf);
    var master = firstSkinned(bodyScene);
    if (!master || !master.skeleton) { throw new Error('몸에 스켈레톤이 없다'); }
    var skeleton = master.skeleton;
    [parts.outfit, parts.hair].forEach(function (p) {
      if (!p || !p.gltf) { return; }
      var scene = cloneScene(p.gltf), meshes = [];
      scene.traverse(function (o) { if (o.isSkinnedMesh) { meshes.push(o); } });
      meshes.forEach(function (m) { m.bind(skeleton, m.bindMatrix); bodyScene.add(m); });
    });
    var model = normalize(bodyScene, mul);
    /* 2026-09-05 — 세력색 물들이기는 QRPG **흰 옷**(1,1,1)에 곱해 다양화하려고
       만든 장치인데, MPFB 실사 몸(사진 그대로의 살결·옷)에 그대로 곱히면
       얼굴이 초록·파랑으로 물든다(saga-go가 실기기로 먼저 밟은 버그, 같은
       파이프라인이라 그대로 옮아온다). 3D 에 **실제로 곱히는 것만** QRPG로 좁힌다 */
    var isQrpg = !!(rec && rec.key && rec.key.indexOf('qrpg_') === 0);
    applyTint(model, isQrpg ? tintHex : null);
    return model;
  }

  /**
   * 인물 하나 — 몸+옷+머리+몸짓을 한꺼번에 받아 온다.
   * @param seed      표에서 조합을 고를 씨앗(사람 id 등)
   * @param mul       세우는 키(로직 단위)
   * @param tintHex   물들일 색(없으면 원래 옷 빛깔 그대로)
   * @param makeShape 도형을 만드는 함수 — GLB 오기 전까지, 실패하면 계속 이것
   */
  /* 2026-09-08 — "사가나락 끊김" 추적 최종 확정: 실기기 로그 `[던전 GLB
     도착후처리] ms=465.1 waiting=2 url=.../UAL2_Standard.glb` 직후 프레임이
     그대로 `dt=507ms`로 튀었다(그 프레임의 render()/loop() 실측은 다
     몇 ms뿐). `retargetInto()`(cloneScene 두 번 + 클립마다 retargetClip,
     아래)가 무겁다는 건 알고 있었는데(2026-09-05 주석), **몸마다 한 번만
     굽어 캐시하는 것과 별개로 — 같은 순간 도착한 이 anim GLB를 기다리던
     서로 다른 몸 여럿(waiting=2)이 있으면 그 몸 수만큼의 retarget이
     `flush()` 한 자리에서 동기로 몰린다.** 각 `assemble()`을 이 대기줄에
     미뤄 **프레임당 최대 하나만** 돌게 한다 — 총 비용은 그대로지만(캐시는
     그대로 살아 있어 몸마다 한 번뿐), 여럿이 한 프레임에 몰리던 것만
     한 프레임에 하나씩 흩어 놓는다. */
  var heavyQ = [];
  function scheduleHeavy(fn) { heavyQ.push(fn); }
  function tick() {
    if (!heavyQ.length) { return; }
    var fn = heavyQ.shift();
    try { fn(); } catch (e) { if (typeof console !== 'undefined') { console.warn('[던전 GLB 조립 실패]', e); } }
  }

  function buildHero(seed, mul, tintHex, makeShape) {
    var t = three();
    var rec = heroRecipe(seed);
    var shell = new t.Group();
    var shape = makeShape ? makeShape() : null;
    if (shape) { shell.add(shape); }
    shell.userData.assetState = 'shape'; shell.userData.born = nowMs();
    shell.userData.body = rec ? rec.body : null;          // 재기(어느 몸 파일인가 — 사가나락 Q8 마을·던전 몸 비교)
    if (!GLB_ON() || !rec) { return shell; }
    ghostShape(shell, shape);

    var parts = {}, pending = 4;
    var own = !rec.anim && wantsOwnAnim(rec.body);   // VRM 몸 → 자체 몸짓(UAL1 을 받으러 가지 않는다)
    function onOne() { pending--; if (pending === 0) { scheduleHeavy(assemble); } }
    acquire(rec.body, function (c) { parts.body = c; onOne(); }); noteShell(rec.body, shell);
    /* outfit·hair 는 조합형(옛 Quaternius) 레시피에만 있다 — QRPG 통짜 스킨은
       둘 다 없으니 헛수고로 받으러 가지 않고 바로 다음 칸으로 넘어간다 */
    if (rec.outfit) { acquire(rec.outfit, function (c) { parts.outfit = c; onOne(); }); } else { onOne(); }
    if (rec.hair) { acquire(rec.hair, function (c) { parts.hair = c; onOne(); }); } else { onOne(); }
    var OAm = global.DG.ownAnim; if (own) { if (OAm && OAm.mocapOn && OAm.mocapOn()) { acquire(OAm.mocapUrl(), function (c) { parts.mocap = c; onOne(); }); } else { onOne(); } } else { acquire(rec.anim || ANIM_SRC, function (c) { parts.anim = c; onOne(); }); }

    function assemble() {
      if (!parts.body) { failShell(shell); return; }
      var model;
      try { model = assembleHero(parts, mul, tintHex, rec); applyVroid(model, rec, seed); }
      catch (e) { failShell(shell); return; }
      while (shell.children.length) { shell.remove(shell.children[0]); }
      shell.add(model);
      shell.userData.assetState = 'glb'; fadeIn(shell, model);
      var animC = parts.anim;
      if (own) {
        /* 몸이 조립된 장면에서 실제 뼈를 읽어 그 몸에 맞춰 굽는다 — 몸마다 한 번(캐시). 못 만들면 UAL1 길로 되돌아간다 */
        if (!parts.body.ownClips) { parts.body.ownRig = global.DG.ownAnim.restRig ? global.DG.ownAnim.restRig(model) : null; parts.body.ownClips = global.DG.ownAnim.clipsFor(model, t) || []; } if (parts.mocap && !parts.body.mocapIn && global.DG.ownAnim.mocapMerge) { parts.body.ownClips = global.DG.ownAnim.mocapMerge(model, parts.body.ownClips, parts.mocap, t); parts.body.mocapIn = true; }   // W-0171 ownRig = 정지 자세 뼈대(무기 몸짓을 나중에 굽는다)
        if (parts.body.ownClips.length) {
          var oc = parts.body.ownClips, om = new t.AnimationMixer(model), oa = {}, oi;
          for (oi = 0; oi < oc.length; oi++) { oa[oc[oi].name] = om.clipAction(oc[oi]); }
          shell.userData.mixer = om;
          shell.userData.actions = oa;
          shell.userData.clipMap = mapClips(oc.map(function (a) { return a.name; }));
          shell.userData.ownAnim = true; shell.userData.ownBody = parts.body;   // W-0171 무기 몸짓 캐시 자리
          animC = null;                              // 아래 UAL1 길은 건너뛴다
        } else {
          own = false;
          acquire(ANIM_SRC, function (c) { parts.anim = c; assemble(); });
          return;
        }
      }
      if (animC && animC.clips && animC.clips.length) {
        var clips = animC.clips;
        /* 2026-09-05 — 몸이 제 클립이 없어(QRPG는 있다, rec.anim===rec.body)
           ANIM_SRC(UAL1)를 빌려 왔다면 **그대로 물리면 안 된다** — UAL1 클립은
           뼈마다 위치까지 굽고 있어, 뼈 길이가 UAL1과 한 치도 안 다를 때만
           우연히 맞는다. 실제 인체 비례로 뽑은 몸(MPFB)은 뼈 길이가 달라
           raw로 물리면 팔다리가 틀어진다(saga-go가 먼저 밟은 "팔이 T자로 안
           움직인다" 버그). `retargetInto()`로 다시 구우면 위치는 이 몸의 것을
           지키고 회전만 옮겨 입으므로 뼈 길이가 달라도 맞는다. 몸마다 한 번만
           굽도록 parts.body(url 캐시 칸)에 매달아 둔다 */
        if (rec.anim !== rec.body) {
          if (!parts.body.heroClips) {
            parts.body.heroClips = retargetInto({ gltf: { scene: model } }, animC) || [];
          }
          if (parts.body.heroClips.length) { clips = parts.body.heroClips; }
        }
        var mx = new t.AnimationMixer(model);
        var acts = {}, i;
        for (i = 0; i < clips.length; i++) { acts[clips[i].name] = mx.clipAction(clips[i]); }
        shell.userData.mixer = mx; shell.userData.actions = acts;
        shell.userData.clipMap = mapClips(clips.map(function (a) { return a.name; }));
      }
    }
    return shell;
  }

  /** 사람이 아닌 홑짜리 GLB(짐승·나무·바위) 하나 — 부위 변형이 없으니 그대로 눕혀 세운다.
   *  2026-09-11 — "장애물·짐승형 몹이 늦게 뜨고 그 사이 멈칫한다"(실기기 제보).
   *  `buildHero()`의 `assemble()`은 위 2026-09-08 주석대로 이미 `scheduleHeavy()`로
   *  프레임당 하나만 돌게 미뤄 뒀는데, 이 함수(나무·바위·기둥·상자 — 들판 장애물
   *  전부와 짐승형 몹까지 여기로 온다)만 그 손질에서 빠져 있었다. 같은 URL을 기다리던
   *  여럿이 `flush()` 한 자리에서 동기로 `cloneScene`+`normalize`를 돌던 것이 원인 —
   *  같은 대기줄로 흘려보낸다(몸 조립과 경합하지만, 몰아서 도는 것보다 한 프레임에
   *  하나씩 흩어 놓는 쪽이 낫다). */
  function build(kind, seed, mul, tintHex, makeShape) {
    var t = three();
    var shell = new t.Group();
    var shape = makeShape ? makeShape() : null;
    if (shape) { shell.add(shape); }
    shell.userData.assetState = 'shape'; shell.userData.born = nowMs();
    if (!wants(kind, seed)) { return shell; }
    var url = urlOf(kind, seed);
    ghostShape(shell, shape);

    acquire(url, function (c) {
      if (!c) { failShell(shell); return; }
      scheduleHeavy(function () {
        var model;
        try {
          model = cloneScene(c.gltf);
          model = normalize(model, mul);
          applyTint(model, tintHex);
        } catch (e) { failShell(shell); return; }
        while (shell.children.length) { shell.remove(shell.children[0]); }
        shell.add(model);
        shell.userData.assetState = 'glb'; fadeIn(shell, model);
        if (shell.userData.cast) { model.traverse(function (m) { if (m.isMesh && !(m.material && m.material.side === 1)) { m.castShadow = true; } }); }   // W-0202 부른 쪽이 cast 를 달면(마을 집·우물·표식) 모델도 그림자 — 도형 대역은 이미 드리운다
        if (c.clips && c.clips.length) {
          var mx = new t.AnimationMixer(model);
          var acts = {}, i;
          for (i = 0; i < c.clips.length; i++) { acts[c.clips[i].name] = mx.clipAction(c.clips[i]); }
          shell.userData.mixer = mx; shell.userData.actions = acts; shell.userData.clipMap = c.map;
        }
      });
    });
    noteShell(url, shell);
    return shell;
  }

  /** 한 프레임 — GLB(뼈대 애니메이션)면 여기서 처리하고 true, 아니면 false */
  function step(node, o) {
    if (!node || !node.userData || !node.userData.mixer) { return false; }
    var u = node.userData;
    var want = o && o.anim, OA = global.DG.ownAnim, t = (o && o.t) || 0, dt = u.lastT === undefined ? 0 : Math.max(0, Math.min(0.25, t - u.lastT));
    /* W-0197 — 몸이 실제 움직인 거리(키/초)로 걷기·달리기·클립 빠르기(옛: 늘 걷기 1배속 — 발이 미끄러졌다) */
    var g = OA && OA.gaitOf && node.matrixWorld ? OA.gaitOf(u, null, node.matrixWorld.elements, dt) : null;
    if (!want) { want = (o && o.walking) ? (g ? g.slot : 'walk') : 'idle'; }
    play(node, want); u.lastT = t; if (!((u.shN = (u.shN || 0) + 1) % 30)) { node.traverse(function (m) { if (m.isMesh && !(m.material && m.material.side === 1)) { m.castShadow = true; } }); }   // W-0202 몸도 진짜 그림자(1만리 W-0199 그대로 — 30번에 한 번, 외곽선 뒷면 껍질 빼고, 그림자 꺼진 등급은 renderer 가 끔)
    u.mixer.timeScale = !(o && o.anim) && o && o.walking && g ? g.rate : 1;
    u.mixer.update(dt);
    return true;
  }
  function play(node, slot) {
    var u = node.userData;
    if (!u.mixer || u.anim === slot) { return false; }
    var OA = global.DG.ownAnim, name = (u.clipMap && u.clipMap[slot]) || (OA && OA.weaponAction && OA.extraSlot(slot) ? OA.weaponAction(u, slot, three()) || (u.clipMap && u.clipMap[slot.indexOf('Pose_') === 0 ? 'idle' : 'attack']) : null);   // W-0171 무기 몸짓 · W-0303 상황 몸짓(Pose_, 없으면 idle)
    var next = name && u.actions[name];
    if (!next) { return false; }
    var prev = u.curAct || (u.anim && u.clipMap[u.anim] && u.actions[u.clipMap[u.anim]]);   // 무기 몸짓 자리는 clipMap 에 없어 틀던 액션을 따로 든다
    next.reset().play();
    if (prev && prev !== next) { prev.crossFadeTo(next, OA && OA.blendOf ? OA.blendOf(slot) : 0.2, false); }   // W-0303 블렌드 무기 0.08·상황 0.25·나머지 0.2
    u.anim = slot; u.curAct = next;
    return true;
  }

  /** 맞으면 번쩍이는 재질들 — 배우가 GLB 든 상자든, 지금 보이는 모든 메시의
   *  재질을 사본으로 떼어 온다(사본이라야 배우끼리 안 부딪힌다) */
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
  function flashAllMat(mats, hurt, span) {
    if (!mats || !mats.length) { return; }
    var F = global.DG.fx3d;
    var k = F ? F.flashOf(hurt, span) : 0;
    for (var i = 0; i < mats.length; i++) { mats[i].emissive.setRGB(k, k * 0.8, k * 0.66); }
  }

  function stats() {
    var urls = Object.keys(cache), o = { registered: Object.keys(REG).length, loaded: 0, failed: 0 };
    for (var i = 0; i < urls.length; i++) {
      if (cache[urls[i]].state === 'ok') { o.loaded++; }
      if (cache[urls[i]].state === 'fail') { o.failed++; }
    }
    o.loader = !!loader();
    /* 로딩 표시(ui.js)가 쓴다 — cache 에 실제로 오른 URL 개수(GLB 파일 수) 대비
       도착(ok·fail 합)한 개수. `registered` 는 REG 의 종류 수(가구·나무… 이름표
       개수)라 파일 진행률과는 다른 값이다. */
    o.total = urls.length;
    o.pending = urls.length - o.loaded - o.failed;
    return o;
  }

  global.DG = global.DG || {};
  global.DG.asset3d = {
    REG: REG, register: register, lookup: lookup, urlOf: urlOf, wants: wants, oneOf: oneOf, light: light, _lightReset: function () { lightAuto = null; }, NATURE_STYLIZED: NATURE_STYLIZED,
    FIXED_HERO: FIXED_HERO, fixedRecipe: fixedRecipe,
    normName: normName, score: score, mapClips: mapClips, SLOTS: SLOTS, fit: fit,
    ready: function () { return !!three(); }, hasLoader: function () { return !!loader(); },
    DEFAULTS: DEFAULTS, restore: restore, heroRecipe: heroRecipe, ANIM_SRC: ANIM_SRC, withLazy: withLazy, lazyNpc: LAZY_NPC, readyRatio: readyRatio, tracked: function () { return tracked; }, ghostOf: function (s) { return s && s.userData ? s.userData.ghost || null : null; }, hiPending: function () { var n = 0, k; for (k in cache) { var c = cache[k]; if (c && !c.low && (c.state === 'queued' || c.state === 'load')) { n++; } } return n + heavyQ.length; },   /* W-0275 로딩 가림막 — 높은 줄(건물·내 몸·동료) 남은 수 */  lowQueue: function () { return lowQ.slice(); }, prefetchState: function () { return Object.keys(bytes).map(function (u) { return u.split('/').pop(); }); }, prefetchOn: PREF_ON, qState: function () { var n = nowMs(); return { inflight: inflight, start: startQ.length, low: lowQ.length, hiAgo: Math.round(n - lastHi), lowAgo: lowQ.length ? Math.round(n - lowSince) : null, timer: !!lowTimer, loading: Object.keys(cache).filter(function (u) { return cache[u].state === 'load'; }).map(function (u) { return u.split('/').slice(-2).join('/'); }), next: startQ.slice(0, 4).map(function (u) { return u.split('/').slice(-2).join('/'); }) }; }, ownAnimOf: function (rec) { return !!(rec && !rec.anim && wantsOwnAnim(rec.body)); },   // W-0213 buildHero 의 own 과 같은 식
    build: build, buildHero: buildHero, step: step, play: play, rawScene: rawScene, tick: tick,
    ownAllMat: ownAllMat, flashAllMat: flashAllMat,
    tuned: tuned, set: set, stats: stats, isActorAsset: isActorAsset, isSwayAsset: isSwayAsset,
    /** 진단 전용 — VRM 애니메 아바타 손잡이·레시피·뼈 매핑표 조회(2026-09-20) */
    wantsAnimeAvatar: wantsAnimeAvatar, wantsOwnAnim: wantsOwnAnim,
    heroRecipesAnime: function () { return HERO_RECIPES_ANIME; },
    vrmToUal1Bones: function () { return VRM_TO_UAL1_BONES; },
    boneNameMap: boneNameMap,
    clear: function () { var k; for (k in REG) { if (Object.prototype.hasOwnProperty.call(REG, k)) { delete REG[k]; } } cache = {}; return REG; }
  };
})(window);
