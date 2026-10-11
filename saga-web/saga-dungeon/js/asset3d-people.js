/**
 * 2나락 3D 사람 몸 조립표 (R-4, 2026-10-11 `asset3d.js` 1,732줄에서 떼어 냄)
 * ---------------------------------------------------------------
 * 사람 팩 갈래마다 몸·클립 파일을 엮은 표 — HERO_RECIPES(QRPG 여섯 + MPFB) · HERO_RECIPES_LIGHT(NPC·동행·사람 형 적·초상) ·
 * HERO_RECIPES_ANIME(VRoid) · applyVroid. `asset3d.js` 는 같은 이름으로 받아 두므로 DEFAULTS·heroRecipe 등은 그대로다.
 * **표 길이·순서를 바꾸면 dungeon3d.js 의 QRPG_SEEDS(손으로 확인한 해시 자리)가 튄다** — 아래 원래 주석 그대로.
 * `asset3d.js` 보다 **먼저** 실린다(manifest).
 */
(function (global) {
  'use strict';
  /* 2026-09-03 — 다른 네 판과 같은 이유로 사람 기본을 갈아 끼운다. Quaternius
     "RPG Character Pack"(CC0, 전사·궁수·도적·성직자·마법사·수도승 6종)은 몸 파일
     하나에 걷기·공격·사망 클립이 다 들어 있어 옷·머리·ANIM_SRC 몸짓이 필요 없다 */
  var PEOPLE_QRPG = 'assets/models/people/quaternius_rpg/';
  var HERO_RECIPES = ['Warrior', 'Ranger', 'Rogue', 'Cleric', 'Wizard', 'Monk'].map(function (n) {
    var f = PEOPLE_QRPG + n + '.glb';
    return { key: 'qrpg_' + n.toLowerCase(), body: f, anim: f };
  });
  /* 2026-09-07 — 마을 하나에 사람(NPC·동행)이 여럿 서는데, 아래에서 HERO_RECIPES
     에 MPFB 실사 스무 벌(파일당 3.5~4.3MB, 제 클립이 없어 7.6MB ANIM_SRC 리타깃까지
     끼얹는다)이 얹히면 사람마다 서로 다른 그 무거운 파일을 하나씩 새로 받으러
     간다 — 모바일 LTE에서 "느리다" 신고의 실제 몸통. 이 여섯 벌(QRPG, 파일당
     1.6~2.1MB·제 클립 내장)만 따로 쥐어 두고, NPC·동행은 여기서만 고른다(아래
     heroRecipe 참고). **같은 날 뒤늦게 발견 — foe·초상도 방마다 사람 형 적이
     여럿(`dungeon.js` spawnEnemy 루프) 서는 흔한 경우라 "하나뿐" 가정이
     틀렸다, heroKindFor에서 이쪽도 이 표로 묶었다(아래 참고).** */
  var HERO_RECIPES_LIGHT = HERO_RECIPES.slice();

  /* 2026-09-07 — "캐릭터 100개" 목표의 첫 벌. Kenney "Blocky Characters"(CC0,
     kenney.nl 직접 배포, itch.io 아님)는 몸 열여덟 벌이 **제 애니메이션
     클립을 스물일곱 개씩 내장**(idle·walk·sprint·attack-melee-*·die·
     pick-up·emote-*·interact-* 등 — 이름이 QRPG와 달라도 `mapClips()`의
     낱말표(WORDS)가 이미 다 받는 이름들이다, 새로 안 건드림)한 QRPG와 같은
     갈래라 리타깃이 필요 없다. **`HERO_RECIPES`(전체 표) 말고 여기
     `HERO_RECIPES_LIGHT`에만 얹는다** — `HERO_RECIPES`에 얹으면 배열 길이가
     늘어 `dungeon3d.js`의 `QRPG_SEEDS`(손으로 확인해 둔 특정 해시값)가 다른
     자리로 튄다. hero_light는 그런 손으로 확인한 자리가 없어(NPC·동행·사람 형
     적·초상이 그냥 제 이름으로 해시할 뿐) 여기 보태는 건 안전하다. */
  var PEOPLE_KENNEY = 'assets/models/people/kenney_blocky/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r'].map(function (letter) {
      var f = PEOPLE_KENNEY + 'character-' + letter + '.glb';
      return { key: 'kenney_' + letter, body: f, anim: f };
    })
  );

  /* 2026-09-20 — "고품질 셀 셰이딩급" VRM 애니메 아바타(사가마을 asset3d.js에서 먼저 만든 것,
     경위는 saga-forest HANDOFF.md 2026-09-19 절)를 이 판에도 옮긴다. VRoid Studio
     공식 CC0 샘플 AvatarSample_A/B/C(github.com/madjin/vrm-samples) + 이 저장소가
     GUI 자동화로 새로 빚은 avatar_custom_01 — 넷 다 사가마을과 같은 파일(md5 동일,
     assets/ASSET_LICENSES.md 참고). **`HERO_RECIPES`/`HERO_RECIPES_LIGHT`에는
     안 얹는다** — 위 §"캐릭터 100개" 주석대로 그 두 표 길이가 늘면
     `dungeon3d.js`의 `QRPG_SEEDS`(손으로 확인해 둔 해시 자리)가 다른 자리로
     튄다. 그래서 완전히 별도 표로 두고 `heroRecipe()`에 우선 분기 하나만
     더한다. **기본은 꺼짐**(0) — 손잡이를 켜기 전엔 기존 배정에 전혀 안
     끼어든다. */
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

  /* 2026-09-07(이어서) — 사용자가 itch.io 팩 둘을 직접 받아 전달: Quaternius
     "Universal Base Characters"(몸, 제 클립 없음) + "Universal Animation
     Library 2"(UAL2, 클립 43개 — Sword_*·Shield_*·Zombie_*·TreeChopping 등
     리치 콤보). MPFB와 같은 "몸만 있고 리타깃으로 움직인다" 갈래지만,
     압축이 유난히 잘 먹어(원본 15~16MB 각각 → 380·409KB, 텍스처가 컸을 뿐
     지오메트리는 가벼운 덕) MPFB(3.5~4.3MB)보다 훨씬 가볍다 — 격리 렌더
     (`_retargettest.html`, 신규)로 `buildHero()`→`retargetInto()` 실제
     경로까지 통째로 돌려 Sword_Regular_A 클립 재생 상태를 스크린샷으로
     확인, 팔다리 뒤틀림 없이 정상 리타깃됨을 봤다. `anim` 필드로 전역
     `ANIM_SRC`(UAL1, MPFB 전용) 대신 UAL2를 **레시피별로** 지정한다 —
     기존 MPFB 쪽은 한 글자도 안 건드린다. */
  var UAL2_SRC = 'assets/models/anim/UAL2_Standard.glb';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat([
    { key: 'universal_male', body: 'assets/models/people/universal_base/Superhero_Male.glb', anim: UAL2_SRC },
    { key: 'universal_female', body: 'assets/models/people/universal_base/Superhero_Female.glb', anim: UAL2_SRC }
  ]);

  /* 2026-09-07(이어서) — poly.pizza "Animated Men Pack"(4종, CharacterArmature|*
     클립)·"Ultimate Modular Men Pack"(11종, HumanArmature|Man_* 클립). 전부
     CC0, 제 클립 내장이라 QRPG·Kenney Blocky와 같은 갈래(리타깃 불필요).
     `assets/models/people/polypizza_men/`에 둠. */
  var PEOPLE_PP_MEN = 'assets/models/people/polypizza_men/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['ManInSuit', 'Man1', 'Man2', 'ManLongSleeves', 'Adventurer', 'King', 'Farmer',
      'HoodieCharacter', 'BeachCharacter', 'CasualCharacter', 'Worker', 'Punk', 'SWAT',
      'BusinessMan', 'Astronaut'].map(function (n) {
      var f = PEOPLE_PP_MEN + n + '.glb';
      return { key: 'ppmen_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-07(이어서) — poly.pizza "Ultimate Modular Women Pack"(10종,
     CharacterArmature|* 클립 — 위 남성 팩과 같은 낱말표라 mapClips() 그대로
     받는다). 전부 Quaternius 저작, CC0 5종·CC-BY 5종 혼합(`assets/
     ASSET_LICENSES.md`에 저작자 표시 기록). "Animated Woman"이 두 벌이라
     키가 겹치지 않게 순번을 붙였다. `assets/models/people/polypizza_women/`
     에 둠. */
  var PEOPLE_PP_WOMEN = 'assets/models/people/polypizza_women/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['SciFiCharacter', 'Witch', 'Worker', 'Suit', 'Soldier',
      'AnimatedWoman1', 'Punk', 'Adventurer', 'HoodedAdventurer', 'AnimatedWoman2'].map(function (n) {
      var f = PEOPLE_PP_WOMEN + n + '.glb';
      return { key: 'ppwomen_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09 — PLAN §60 "캐릭터 100개" 목표 이어감(71→78). poly.pizza에서
     제 클립을 내장한 것만 추가로 골랐다(검색에 나온 정지 메시·중복
     UUID는 제외 — 예: "Knight"류는 클립이 하나뿐이라, "Ninja"류는 이미
     `monster:ninja_2`로 등록된 것과 UUID가 같아 뺐다). `HERO_RECIPES`
     (전체 표)가 아니라 여기 `HERO_RECIPES_LIGHT`에만 얹는 것도 위와
     같은 이유(QRPG_SEEDS 해시 보호)다. */
  var PEOPLE_PP_MORE = 'assets/models/people/polypizza_more/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['CharMatt', 'CharShaun', 'CharSam', 'Soldier2', 'Adventurer2',
      'CharacterAnimated', 'AnimatedWizard'].map(function (n) {
      var f = PEOPLE_PP_MORE + n + '.glb';
      return { key: 'ppmore_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — "캐릭터 100개" 계속. poly.pizza "Animated Women
     Pack"(Quaternius, CC0, `bundle/Animated-Women-Pack-HHSKxnk1mY`) 4종 —
     `Ultimate Modular Women Pack`(위 `ppwomen_*`)과는 별개 번들이라
     UUID 겹침 없음(모델 페이지에서 static.poly.pizza uuid로 직접 확인).
     `HumanArmature|Female_*` 낱말표, `mapClips()`가 기존 word 표(walk·
     run·idle·death·jump 등 이름에 그 낱말이 그대로 들어 있다)로 그대로
     받는다 — attack 은 Punch/SwordSlash 로 받고, hit·dodge 는 FALLBACK
     (→idle, →run/walk)로 채워짐.
     **압축 보류** — `tools/glb-compress`의 `package-lock.json`이 사내망
     전용 사설 레지스트리(172.17.1.200:8081, `C:\link` 네트워크)의
     `resolved` URL을 그대로 담고 있어 이 환경에서 npm install 이
     ETIMEDOUT 으로 막힌다. 그 lockfile 을 고치는 것도 권한 분류기가
     "의존성 변경"으로 막아 이번엔 원본 그대로 등록했다(4종 합쳐
     2.0MB — 이미 비슷한 급의 압축된 세트와 큰 차이 없는 크기다). 다음에
     `tools/glb-compress` 를 이 저장소 네트워크에서 쓸 수 있게 lockfile
     을 공개 레지스트리로 되돌린 뒤, 이 폴더부터 마저 압축할 것. */
  var PEOPLE_PP_WOMEN2 = 'assets/models/people/polypizza_women2/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['Woman', 'WomanCasual', 'WomanTankTop', 'WomanDress'].map(function (n) {
      var f = PEOPLE_PP_WOMEN2 + n + '.glb';
      return { key: 'ppwomen2_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서, 압축 도구 고친 뒤) — "캐릭터 100개" 계속.
     `Ultimate Space Kit`(Quaternius, CC0, `bundle/Ultimate-Space-Kit-
     YWh743lqGX`)의 Astronaut 는 이 번들 안에만 3벌(색·소재만 다른
     텍스처 변형, 뼈대·클립은 동일) — 이미 쓴 `ppmen_astronaut`(Ultimate
     Modular Men Pack 소속, UUID 다름)와는 별개 자산이다. 같은 번들의
     Enemy Small/Large/Flying·Mech·Rover 는 로봇/외계생물이라 이 표
     (사람형)가 아니라 몬스터 트랙 후보로 남겨 둔다(등록 안 함).
     `CharacterArmature|*` 낱말표, `mapClips()` 그대로 받음. */
  var PEOPLE_PP_SPACE = 'assets/models/people/polypizza_space/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['Astronaut1', 'Astronaut2', 'Astronaut3'].map(function (n) {
      var f = PEOPLE_PP_SPACE + n + '.glb';
      return { key: 'ppspace_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — "캐릭터 100개" 계속. KayKit "Adventurers Character
     Pack"(Kay Lousberg, CC0, GitHub `KayKit-Game-Assets/KayKit-Character-
     Pack-Adventures-1.0` 직접 받음 — itch.io 아님, 이미 몬스터 트랙에서 쓴
     KayKit Skeletons와 같은 출처 요령) 5종 — Barbarian·Knight·Mage·Rogue·
     Rogue_Hooded. 몸 하나에 제 클립을 **76개**(Idle·Walking_A/B/C·
     Running_A/B·Dodge_*·Hit_A/B·Death_A/B·1H/2H_Melee_Attack_*·Interact·
     Jump_* 등) 내장 — 다른 어떤 팩보다 촘촘하다. `mapClips()` word 표가
     "Walking"·"Running"·"Attack"·"Dodge"·"Hit"·"Death"·"Interact" 낱말을
     그대로 하위문자열로 잡아 리타깃 없이 바로 받는다.
     **무게 확인** — 압축 후 1.95~1.97MB/벌(멀티메시 12~14개, 모듈형 갑주
     조각). `HERO_RECIPES_LIGHT`의 기존 최중량 레시피 QRPG(1.6~2.1MB)와
     같은 급 — `hero_light`에서 뺀 MPFB(3.5~4.3MB, 위 §참고)와는 다른
     체급이라 이 표에 얹어도 그 때 걸렸던 "마을마다 무거운 파일 새로 받기"
     함정을 다시 밟지 않는다. */
  var PEOPLE_KAYKIT_ADV = 'assets/models/people/kaykit_adventurers/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['Barbarian', 'Knight', 'Mage', 'Rogue', 'Rogue_Hooded'].map(function (n) {
      var f = PEOPLE_KAYKIT_ADV + n + '.glb';
      return { key: 'kaykitadv_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — "캐릭터 100개" 계속. `Pirate kit`(Quaternius, CC0,
     `poly.pizza/bundle/Pirate-kit-0q5ulmIYqQ`)의 사람형 3종 — Pirate
     Captain·Anne·Henry.
     **원본 클립 이름이 깨져 있었다** — `CharacterArmature|CharacterArmature|
     CharacterArmature|<Stem>|CharacterArmature|<Stem 다시, 81자 상한에서
     잘림>` 꼴로 내보내져(이 번들 특유의 익스포트 문제로 보인다 — 같은
     `CharacterArmature|*` 계열인 `ppmore_*`·`ppspace_*`는 안 그렇다,
     확인해 봄) `Death`→`Dea`·`HitReact`→``(빈 문자열)·`Punch`→`Pun`처럼
     꼬리가 잘렸다. `mapClips()`가 마지막 `|` 뒤 조각만 보므로 이 잘린
     꼬리로는 death·attack·hit 슬롯이 전부 idle로 새 버렸다(직접
     재현해 확인). **원본 데이터는 안 건드리고 이름만 고쳤다** — 3번째
     `|` 조각(늘 안 잘리고 온전한 진짜 어간)을 읽어 `CharacterArmature|
     <Stem>`으로 다시 쓰는 스크립트(세션 임시, 커밋 안 함)를 한 번
     돌렸다. glTF JSON 청크만 재작성하고 BIN 청크(스켈레톤·키프레임)는
     바이트 그대로 복사 — `gltf-transform inspect`로 파일이 여전히
     유효한지, 압축 전/후 `mapClips()` 결과가 death·attack(Punch)·
     hit(HitReact)까지 전부 실제 클립으로 잡히는지(전엔 셋 다 idle
     대체였다) 확인 후 등록했다. */
  var PEOPLE_PP_PIRATE = 'assets/models/people/polypizza_pirate/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['PirateCaptain', 'Anne', 'Henry'].map(function (n) {
      var f = PEOPLE_PP_PIRATE + n + '.glb';
      return { key: 'pppirate_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — "캐릭터 100개" 계속. `Post Apocalypse Pack`
     (Quaternius, CC0)을 훑다가 사람형 하나(Lis, 나머지는 좀비·차 소품 등)를
     더 찾았다 — 이 파일은 위 Pirate kit과 달리 클립 이름이 안 깨져 있다
     (대조 확인). */
  var PEOPLE_PP_APOC = 'assets/models/people/polypizza_apoc/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat([
    { key: 'ppapoc_lis', body: PEOPLE_PP_APOC + 'Lis.glb', anim: PEOPLE_PP_APOC + 'Lis.glb' }
  ]);

  /* 2026-09-09(이어서) — "캐릭터 100개" 계속. poly.pizza `/search/hazmat`
     에서 같은 방호복 컨셉을 두 작가에게서 찾았다 — 서로 다른 몸(리그)이라
     따로 등록. `Character Hazmat`(Quaternius, CC0)은 클립 17개
     (CharacterArmature|* 계열, 안 깨짐) — 다른 Quaternius 팩과 같은
     수준. `Hazmat Man`(Charlie, CC-BY 3.0)은 클립이 idle·
     run_anydirection·death 셋뿐이라 얇지만(공격·피격은 FALLBACK으로
     idle 대체) 실제로 존재하고 몸도 확연히 다르다(작가가 달라 스타일이
     다름) — 등록. */
  var PEOPLE_PP_HAZMAT = 'assets/models/people/polypizza_hazmat/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat([
    { key: 'pphazmat_char', body: PEOPLE_PP_HAZMAT + 'CharHazmat.glb', anim: PEOPLE_PP_HAZMAT + 'CharHazmat.glb' },
    { key: 'pphazmat_man', body: PEOPLE_PP_HAZMAT + 'HazmatMan.glb', anim: PEOPLE_PP_HAZMAT + 'HazmatMan.glb' }
  ]);

  /* 2026-09-09(이어서) — "캐릭터 100개" 계속. 검색어를 훨씬 넓혀(queen·
     sniper·medic·assassin·paladin·gladiator·boxer·orc·angel·demon·
     superhero·teacher·swordsman·mercenary·sorcerer·barbarian·elf·dwarf·
     사장 40여 개) 훑었다 — 대부분 poly.pizza가 "Animated" 태그를 달아
     둔 것도 실제로 받아 보면 클립이 0개였다(Female Fighter·Supersup·
     King(2번째 개체)·Voxel Character Male·OLDMAN·Student·Soldier
     (madtrollstudio)·Tiny Mage 등 — 전부 스킵). 그물을 넓혀 실제로
     쓸 수 있던 건 둘뿐: */
  var PEOPLE_PP_WIDE = 'assets/models/people/polypizza_wide/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat([
    /* "superhero" 검색 → Character Soldier(Quaternius, CC0). 클립 14개,
       CharacterArmature|* 계열, 안 깨짐. */
    { key: 'ppwide_soldier', body: PEOPLE_PP_WIDE + 'CharSoldier.glb', anim: PEOPLE_PP_WIDE + 'CharSoldier.glb' },
    /* "druid" 검색(엉뚱한 검색어에 걸림) → Wizard(Quaternius, CC0). 클립
       9개(Idle·Walk·Death·HitRecieve·Dance·Bite_Front 등) — attack 슬롯은
       못 채워 FALLBACK(→interaction→idle)으로 간다. */
    { key: 'ppwide_wizard', body: PEOPLE_PP_WIDE + 'Wizard.glb', anim: PEOPLE_PP_WIDE + 'Wizard.glb' }
  ]);

  /* 2026-09-09(이어서) — "다른 곳도 찾아봐" — poly.pizza를 벗어나 다른
     CC0 출처를 훑다가 Kenney 공식 사이트(`kenney.nl`)에 아직 안 쓴
     사람 캐릭터 팩이 있는 걸 찾았다. `Animated Characters Protagonists`
     (`kenney.nl/assets/animated-characters-protagonists`)는 FBX만 주고
     클립도 idle·jump·run 셋뿐이라(이 판에 FBX→glTF 변환 도구가 없다,
     `Blocky Characters` 절 참고와 같은 이유) 보류. `Mini Characters`
     (`kenney.nl/assets/mini-characters`, CC0, 12벌 — female-a~f·
     male-a~f)는 **GLB 형식을 직접 준다**(`Models/GLB format/`), 클립도
     32개(`static`·`idle`·`walk`·`sprint`·`attack-melee-*`·`die`·
     `emote-*`·`interact-*`·`wheelchair-*` 등) — `Blocky Characters`와
     똑같은 낱말표라 `mapClips()` 그대로 받는다(리타깃 불필요).
     **원본은 텍스처가 GLB 밖(`Textures/colormap.png`, 캐릭터 12벌이
     공유)에 있어** `tools/glb-compress`가 그 상대경로를 못 찾고 처음엔
     실패했다 — 압축 전에 그 텍스처를 같은 폴더에 잠깐 복사해 두고
     압축(그 과정에서 텍스처가 GLB 안으로 박힌다), 끝난 뒤 이제 안
     쓰는 원본 `Textures/` 폴더는 지웠다(`Blocky Characters`도 폴더에
     안 남아 있는 것과 같은 모양). */
  var PEOPLE_KENNEY_MINI = 'assets/models/people/kenney_mini/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f',
      'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f'].map(function (n) {
      var f = PEOPLE_KENNEY_MINI + 'character-' + n + '.glb';
      return { key: 'kmini_' + n, body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — "다른 곳도 찾아봐"를 계속. OpenGameArt.org의
     Quaternius 업로더 페이지(`opengameart.org/content/all-cc0-uploader-
     quaternius`)에서 poly.pizza에는 없던 큰 팩을 찾았다 — poly.pizza가
     자체 CDN(glTF/GLB 직접)으로 갈아탄 뒤에도 OpenGameArt엔 예전 원본
     업로드(Blend/FBX/OBJ만)가 그대로 남아 있다.
     **이 판엔 FBX→glTF 변환 도구가 없어 여태 보류해 왔는데**(다른
     FBX 전용 자산 항목들 참고), npm 패키지 `fbx2gltf`(페이스북 공식
     `FBX2glTF` 바이너리를 감싼 것)를 세션 스크래치 폴더에 설치해
     실제로 돌려 보니 **한 번에 깨끗하게 변환됐다**(스켈레톤·클립
     이름·개수 그대로, `gltf-transform inspect`로도 정상 검증) — 이제
     이 갈래가 막혀 있던 게 아니라 "도구를 안 갖췄던 것"뿐이었다.
     이 저장소엔 도구 자체를 커밋하지 않았다(세션 스크래치에서만
     썼다, `tools/glb-compress`처럼 상시 도구로 두려면 다음에 정식으로
     들일 것) — 변환된 결과 GLB만 커밋한다.

     `Ultimate Animated Character Pack`(Quaternius, CC0,
     `opengameart.org/content/animated-characters-pack`, 48.4MB zip)은
     50벌 넘게(휴먼·엘프·좀비·닌자·카우보이·고블린 등) 들어 있다.
     사람형 중 다양한 15벌만 골랐다(좀비·고블린·소품(모자·머리카락
     단품)·이미 가진 것과 너무 겹치는 Casual/Soldier류는 제외):
     Elf·Wizard·Witch·Doctor_Male_Old·Doctor_Female_Young·Cowboy_Male·
     Cowboy_Female·Chef_Male·Kimono_Female·Viking_Male·Pirate_Female·
     OldClassy_Male·Knight_Golden_Male·Ninja_Sand·Suit_Male. 클립
     11개씩(Defeat·Idle·PickUp·Punch·RecieveHit·Shoot_OneHanded·
     SitDown·StandUp·Victory·Walk·Walk_Carry) — `mapClips()`가 death·
     idle·interaction·attack·hit·walk를 실제 클립으로, run·sprint·
     dodge는 walk로 채운다. */
  var PEOPLE_OGA_ULTIMATE = 'assets/models/people/oga_ultimate/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['Elf', 'Wizard', 'Witch', 'Doctor_Male_Old', 'Doctor_Female_Young',
      'Cowboy_Male', 'Cowboy_Female', 'Chef_Male', 'Kimono_Female', 'Viking_Male',
      'Pirate_Female', 'OldClassy_Male', 'Knight_Golden_Male', 'Ninja_Sand', 'Suit_Male'].map(function (n) {
      var f = PEOPLE_OGA_ULTIMATE + n + '.glb';
      return { key: 'ogau_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — 사용자 요청("나머지 20벌도 마저 등록해줘")으로
     `Ultimate Animated Character Pack`에서 안 쓰고 남겨 뒀던 사람형을
     마저 등록한다(실제로는 27벌 — 좀비·고블린·동물(Cow·Pug)·소품 단품
     (Chef_Hat·Cowboy_Hair·Ninja_Male_Hair·VikingHelmet)만 빼면 이만큼
     남는다). 같은 팩·같은 클립 11개(위 15벌과 동일한 `CharacterArmature|
     Defeat·Idle·PickUp·Punch·RecieveHit·Shoot_OneHanded·SitDown·
     StandUp·Victory·Walk·Walk_Carry`) — 변환·검증 방식도 동일. */
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat(
    ['BaseCharacter', 'BlueSoldier_Female', 'BlueSoldier_Male', 'Casual_Bald',
      'Casual_Female', 'Casual_Male', 'Casual2_Female', 'Casual2_Male',
      'Casual3_Female', 'Casual3_Male', 'Chef_Female', 'Doctor_Female_Old',
      'Doctor_Male_Young', 'Kimono_Male', 'Knight_Golden_Female', 'Knight_Male',
      'Ninja_Female', 'Ninja_Male', 'Ninja_Sand_Female', 'OldClassy_Female',
      'Pirate_Male', 'Soldier_Female', 'Soldier_Male', 'Suit_Female',
      'Viking_Female', 'Worker_Female', 'Worker_Male'].map(function (n) {
      var f = PEOPLE_OGA_ULTIMATE + n + '.glb';
      return { key: 'ogau_' + n.toLowerCase(), body: f, anim: f };
    })
  );

  /* 2026-09-09(이어서) — 같은 업로더 페이지의 `LowPoly Animated Knight`
     (`opengameart.org/content/lowpoly-animated-knight`, CC0, 2.5MB) —
     poly.pizza·itch.io 양쪽 다 결제/변환 문제로 막혀 있던 바로 그
     Knight를 OpenGameArt 원본에서 우회해 받았다. `HumanArmature|*`
     낱말표(위 팩과는 다른 계열), 클립 12개(Death·Idle·
     Idle_swordLeft/Right·Jump·Roll·Roll_sword·Run·Run_swordAttack/
     Right·swordAttackJump·Walking). */
  var PEOPLE_OGA_KNIGHT = 'assets/models/people/oga_knight/';
  HERO_RECIPES_LIGHT = HERO_RECIPES_LIGHT.concat([
    { key: 'ogaknight_char', body: PEOPLE_OGA_KNIGHT + 'KnightCharacter.glb', anim: PEOPLE_OGA_KNIGHT + 'KnightCharacter.glb' }
  ]);

  /* 2026-09-05 — 사용자 요청("캐릭터도 더 다양하게") — QRPG 여섯 벌뿐이던 몸을
     `saga-go`가 이미 검증해 둔 MPFB2(makehumancommunity.org, CC0 도구) 실사
     인물 스무 벌로 늘린다. **파일을 그대로 복사했다**(saga-go/assets/models/
     people/mpfb_real/) — 눈가 빨갛게 깨지던 버그를 이미 다 고친 뒤의 최종
     본이라 이 판에서 다시 겪을 함정이 없다(자세한 경위는 saga-go의
     asset3d.js·ASSET_LICENSES.md 참고, 여기서는 목록만 옮긴다).
     `anim` 필드가 없다 — QRPG 와 달리 몸에 제 클립이 없어 `buildHero()`가
     공용 `ANIM_SRC`(UAL1)를 빌려 `retargetInto()`로 다시 굽는다(아래) */
  var PEOPLE_MPFB = 'assets/models/people/mpfb_real/';
  HERO_RECIPES = HERO_RECIPES.concat([
    { key: 'mpfb_male', body: PEOPLE_MPFB + 'male.glb' },
    { key: 'mpfb_female', body: PEOPLE_MPFB + 'female.glb' },
    { key: 'mpfb_v3', body: PEOPLE_MPFB + 'v3.glb' },
    { key: 'mpfb_v7', body: PEOPLE_MPFB + 'v7.glb' },
    { key: 'mpfb_v8', body: PEOPLE_MPFB + 'v8.glb' },
    { key: 'mpfb_v9', body: PEOPLE_MPFB + 'v9.glb' },
    { key: 'mpfb_v10', body: PEOPLE_MPFB + 'v10.glb' },
    { key: 'mpfb_v11', body: PEOPLE_MPFB + 'v11.glb' },
    { key: 'mpfb_v12', body: PEOPLE_MPFB + 'v12.glb' },
    { key: 'mpfb_v13', body: PEOPLE_MPFB + 'v13.glb' },
    { key: 'mpfb_v14', body: PEOPLE_MPFB + 'v14.glb' },
    { key: 'mpfb_v15', body: PEOPLE_MPFB + 'v15.glb' },
    { key: 'mpfb_v16', body: PEOPLE_MPFB + 'v16.glb' },
    { key: 'mpfb_v17', body: PEOPLE_MPFB + 'v17.glb' },
    { key: 'mpfb_v18', body: PEOPLE_MPFB + 'v18.glb' },
    { key: 'mpfb_v19', body: PEOPLE_MPFB + 'v19.glb' },
    { key: 'mpfb_v20', body: PEOPLE_MPFB + 'v20.glb' },
    { key: 'mpfb_v21', body: PEOPLE_MPFB + 'v21.glb' },
    { key: 'mpfb_v22', body: PEOPLE_MPFB + 'v22.glb' },
    { key: 'mpfb_v23', body: PEOPLE_MPFB + 'v23.glb' }
  ]);

  global.DG = global.DG || {};
  global.DG.asset3dPeople = {
    HERO_RECIPES: HERO_RECIPES, HERO_RECIPES_LIGHT: HERO_RECIPES_LIGHT, HERO_RECIPES_ANIME: HERO_RECIPES_ANIME, applyVroid: applyVroid
  };
})(window);
