/**
 * 적 데이터 — 관문에 나오는 무리
 * ---------------------------------------------------------------
 * tier 는 관문 구간이다.  1: 1~5관문 / 2: 6~12 / 3: 13~25 / 4: 26관문 이상
 * 각 관문의 마지막 파(10파)에는 보스가 혼자 나온다.
 */
(function (global) {
  'use strict';

  /* ── 저항(抵抗) — 원작의 몬스터 내성 ────────────────────────
   * 원작에서 "이놈은 불이 안 통한다" 를 아는 순간 손이 바뀐다.
   * 이 판에는 원소가 없으니 **때리는 두 결**로 갈랐다.
   *
   *   phys 물리(物理) — 평타 · 회전참 · 돌진
   *   chi  기(氣)     — 기공파
   *
   * `resist` 는 그 결의 피해를 몇 % 깎는지다(없으면 0).
   * **면역(100%)은 두지 않았다.** 원작의 면역은 스킬이 여덟 개일 때 성립하는
   * 장치인데, 이 판은 넷이고 그중 기(氣)는 하나뿐이라 물리 면역이 뜨면
   * 재냉각을 기다리는 것 말고 할 게 없어진다. 상한은 eliteOf 쪽에서 75% 로 막는다.
   *
   * 결은 겉모습을 따른다 — 철갑을 두른 것은 칼이 잘 안 들고,
   * 짐승·수군처럼 두껍지 않은 것은 기가 잘 안 통한다.
   */

  /* 2026-09-09 — PLAN §60 "지역마다 특색" 후속. `biome`는 마을 THEME_BIAS
     키(`town:forest` 등, `town:` 접두는 뗀 값)와 맞춰 tier1 잡졸만 태그했다
     — 마을 들판 로머는 `ctx.floor`가 늘 0이라 `tierOf(0)===1`, 실제로
     **tier1만 마을에 나온다**(tier2 이상은 던전 전용이라 여기 태그가
     의미 없다). 없으면(`떠돌이 병졸`처럼) 어느 지역에나 나오는 필러다.
     (같은 날 후속 — 아래 "GLB 자산 확장 2차" 로 성소(shrine) 에도 원혼
     하나를 얹어, 이제 다섯 마을 지역 전부 전용 몹이 하나 이상이다.) */
  var ENEMIES = [
    // tier 1 — 잡졸
    { name: '황건적', emoji: '🟡', kind: 'human', color: '#c9a83a', look: { weapon: 'club', helm: 'none', armor: 'leather' }, tier: 1, biome: 'ruins' },
    { name: '산적', emoji: '🪓', kind: 'human', color: '#6b5030', look: { weapon: 'axe', helm: 'none', armor: 'leather' }, tier: 1, biome: 'mountain' },
    { name: '도적떼', emoji: '🗡️', kind: 'human', color: '#5a4a58', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 1, biome: 'forest' },
    { name: '들개', emoji: '🐕', kind: 'beast', color: '#8a7358', form: 'quad', tier: 1, resist: { chi: 25 }, biome: 'forest' },
    { name: '떠돌이 병졸', emoji: '🥷', kind: 'human', color: '#6a6a74', look: { weapon: 'spear', helm: 'helmet', armor: 'leather' }, tier: 1 },
    /* 2026-09-05 — 짐승 형이 들개·코끼리병 둘뿐이라 다양화(사용자 요청).
       `body`는 asset3d.js REG 의 키 — 없으면 dungeon3d.js 가 기본 'beast'(늑대)로
       그린다. 멧돼지는 두꺼운 가죽이라 물리에 약간 강하고 기(氣)는 그대로 받는다 */
    { name: '멧돼지', emoji: '🐗', kind: 'beast', color: '#4a3a2a', form: 'quad', body: 'beast_boar', tier: 1, resist: { phys: 15 }, biome: 'swamp' },
    /* 2026-09-09 — PLAN §60 "GLB 자산 확장 2차". 남은 monster REG 35종을
       마저 배치한다(전부 새 다운로드 없음). 몬스터류를 연상시키는 원래
       이름(Alpaking·Armabee 등)과 순한 동물(토끼·고양이·닭·비둘기·물고기)·
       SF풍(에일리언)은 이름 정책·결 둘 다에 안 맞아 제외했다 — 그 여덟
       남짓은 이번에도 안 쓴다. */
    { name: '해골졸개', emoji: '💀', kind: 'beast', color: '#b8b0a0', form: 'ogre', body: 'skeleton_minion', tier: 1, resist: { phys: 10 }, biome: 'ruins' },
    { name: '원혼', emoji: '👻', kind: 'beast', color: '#d8d0e0', form: 'ogre', body: 'skeleton_solo', tier: 1, resist: { phys: 15 }, biome: 'shrine' },
    { name: '독사', emoji: '🐍', kind: 'beast', color: '#4a6a3a', form: 'serpent', body: 'snake', tier: 1, atkEl: 'pois', biome: 'swamp' },
    { name: '말벌떼', emoji: '🐝', kind: 'beast', color: '#d9c020', form: 'bird', body: 'wasp', tier: 1, atkEl: 'pois', biome: 'forest' },
    { name: '들쥐떼', emoji: '🐀', kind: 'beast', color: '#8a7a6a', form: 'quad', body: 'rat', tier: 1, biome: 'ruins' },
    { name: '청개구리', emoji: '🐸', kind: 'beast', color: '#5a9a5a', form: 'toad', body: 'frog', tier: 1, biome: 'swamp' },
    { name: '홍슬라임', emoji: '🩷', kind: 'beast', color: '#d97a9a', form: 'quad', body: 'pink_slime', tier: 1, biome: 'mountain' },
    { name: '늪슬라임', emoji: '🟢', kind: 'beast', color: '#4a8a6a', form: 'quad', body: 'glub', tier: 1, biome: 'swamp' },
    { name: '애기버섯', emoji: '🍄', kind: 'beast', color: '#8a5aa0', form: 'ogre', body: 'mushnub', tier: 1, atkEl: 'pois', biome: 'forest' },
    { name: '이끼괴물', emoji: '🟩', kind: 'beast', color: '#3a6a3a', form: 'quad', body: 'green_blob', tier: 1, biome: 'forest' },
    { name: '동굴슬라임', emoji: '🟣', kind: 'beast', color: '#6a5a8a', form: 'quad', body: 'slime_enemy', tier: 1, biome: 'mountain' },

    // tier 2 — 변방
    { name: '왜구', emoji: '⛵', kind: 'human', color: '#8a4a4a', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 2 },
    { name: '마적', emoji: '🐎', kind: 'human', color: '#7a5a3a', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 2 },
    { name: '오랑캐 궁수', emoji: '🏹', kind: 'human', color: '#7a6a4a', look: { weapon: 'bow', helm: 'none', armor: 'leather' }, tier: 2, atkEl: 'pois' },
    { name: '거란 기병', emoji: '🐴', kind: 'human', color: '#5a6a8a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 2, resist: { phys: 20 } },
    { name: '남만 코끼리병', emoji: '🐘', kind: 'beast', color: '#8a8a92', form: 'quad', body: 'beast_big', tier: 2, resist: { chi: 35, phys: 15 } },
    /* 2026-09-09 — PLAN §60 "GLB 자산 확장" 후속. 이미 받아 asset3d.js REG에
       등록만 돼 있던 몬스터 GLB(Quaternius Ultimate Monsters·KayKit
       Skeletons)를 처음으로 실제 적 표에 건다 — "새로 받을 것"보다 "이미
       있는데 안 불리던 것"이 훨씬 많았다(사가마을 InstancedMesh 사례와
       같은 갈래). `kind:'beast'`는 생물학적 분류가 아니라 렌더링 분기용
       표시다(dungeon3d.js가 kind==='beast'일 때만 `body` 키의 홑짜리
       GLB를 그린다, 그 밖은 사람 몸에 옷을 입힌다) — 코끼리병도 같은 이유로
       'beast'다. 해골·원귀·도깨비는 동아시아 민담 어휘로 옮겼다(오크·고블린
       같은 서양 판타지 낱말 대신). */
    { name: '해골무사', emoji: '💀', kind: 'beast', color: '#c9c2a8', form: 'ogre', body: 'skeleton_warrior', tier: 2, resist: { phys: 15 } },
    { name: '원귀', emoji: '👻', kind: 'beast', color: '#bfe0f0', form: 'ogre', body: 'ghost', tier: 2, resist: { phys: 35 } },
    { name: '산도깨비', emoji: '👹', kind: 'beast', color: '#5a7a3a', form: 'ogre', body: 'orc', tier: 2, resist: { phys: 10 } },
    { name: '해골도둑', emoji: '💀', kind: 'beast', color: '#a89ac9', form: 'ogre', body: 'skeleton_rogue', tier: 2, resist: { phys: 15 } },
    { name: '탐귀', emoji: '👺', kind: 'beast', color: '#6a3a4a', form: 'ogre', body: 'demon_2', tier: 2, resist: { chi: 15 } },
    { name: '해골귀', emoji: '💀', kind: 'beast', color: '#d8d8e8', form: 'ogre', body: 'ghost_skull', tier: 2, resist: { phys: 30 } },
    { name: '은신 첩자', emoji: '🥷', kind: 'beast', color: '#3a3a3a', form: 'ogre', body: 'ninja_2', tier: 2, resist: { phys: 10 } },
    { name: '늪 왕슬라임', emoji: '🟢', kind: 'beast', color: '#2a6a4a', form: 'quad', body: 'glub_evolved', tier: 2, resist: { phys: 10 } },
    { name: '왕버섯도깨비', emoji: '🍄', kind: 'beast', color: '#7a4a90', form: 'ogre', body: 'mushnub_evolved', tier: 2, resist: { chi: 10 }, atkEl: 'pois' },
    { name: '회오리 정령', emoji: '🌀', kind: 'beast', color: '#8ac9d9', form: 'ogre', body: 'hywirl', tier: 2, resist: { phys: 15 } },
    { name: '산짐승 요괴', emoji: '🐒', kind: 'beast', color: '#7a5a3a', form: 'quad', body: 'monkroose', tier: 2 },
    { name: '가시귀', emoji: '🌵', kind: 'beast', color: '#4a8a3a', form: 'ogre', body: 'cactoro', tier: 2, resist: { phys: 10 } },
    { name: '먹물 요괴', emoji: '🦑', kind: 'beast', color: '#3a3a6a', form: 'fish', body: 'squidle', tier: 2, resist: { chi: 15 } },
    { name: '왕거미', emoji: '🕷️', kind: 'beast', color: '#2a2a2a', form: 'quad', body: 'spider', tier: 2, atkEl: 'pois' },
    { name: '가시슬라임', emoji: '🟩', kind: 'beast', color: '#3a7a2a', form: 'quad', body: 'green_spiky_blob', tier: 2, resist: { phys: 15 } },

    // tier 3 — 정규군
    { name: '여진 궁수', emoji: '🎯', kind: 'human', color: '#6a7a5a', look: { weapon: 'bow', helm: 'none', armor: 'leather' }, tier: 3 },
    { name: '몽골 기병', emoji: '🏇', kind: 'human', color: '#8a7a5a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 3, resist: { phys: 25 } },
    { name: '왜군 조총병', emoji: '🔫', kind: 'human', color: '#7a4a4a', look: { weapon: 'staff', helm: 'none', armor: 'leather' }, tier: 3, atkEl: 'fire' },
    { name: '위군 창병', emoji: '⚔️', kind: 'human', color: '#31609f', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 3, resist: { phys: 20 } },
    { name: '수군 척후선', emoji: '🚤', kind: 'human', color: '#3a6a8a', look: { weapon: 'bow', helm: 'helmet', armor: 'leather' }, tier: 3, resist: { chi: 30 } },
    /* 산군(山君) — 호랑이의 옛 존칭(민담 표현, 실제 인물·시리즈 이름이 아니다).
       빠르고 사나운 맹수라 기·물리 둘 다 어느 정도 버틴다 */
    { name: '산군', emoji: '🐅', kind: 'beast', color: '#c9772f', form: 'quad', body: 'beast_tiger', tier: 3, resist: { chi: 25, phys: 15 } },
    { name: '해골법사', emoji: '🧙', kind: 'beast', color: '#8a6ac9', form: 'ogre', body: 'skeleton_mage', tier: 3, resist: { chi: 30 }, atkEl: 'lit' },
    { name: '진흙귀신', emoji: '🪨', kind: 'beast', color: '#7a6a52', form: 'ogre', body: 'goleling', tier: 3, resist: { phys: 25 } },
    { name: '설인', emoji: '❄️', kind: 'beast', color: '#cfe6f0', form: 'ogre', body: 'yeti', tier: 3, resist: { phys: 20 }, atkEl: 'cold' },
    { name: '독버섯 요괴', emoji: '🍄', kind: 'beast', color: '#9a6ac0', form: 'ogre', body: 'mushroom_king', tier: 3, resist: { chi: 15 }, atkEl: 'pois' },
    { name: '청귀', emoji: '😈', kind: 'beast', color: '#3a6a9a', form: 'ogre', body: 'blue_demon', tier: 3, resist: { chi: 25 }, atkEl: 'cold' },
    { name: '그림자 자객', emoji: '🥷', kind: 'beast', color: '#1a1a2a', form: 'ogre', body: 'ninja', tier: 3, resist: { phys: 20 } },
    { name: '요술사', emoji: '🧙', kind: 'beast', color: '#5a3a8a', form: 'ogre', body: 'wizard', tier: 3, resist: { chi: 25 }, atkEl: 'fire' },
    /* 이무기 — 용이 되지 못하고 남은 이무기(민담 표현, 실제 시리즈 이름이
       아니다). Dragon(기본형, dragon_evolved 는 이미 보스 '천룡'). */
    { name: '이무기', emoji: '🐍', kind: 'beast', color: '#3a5a4a', form: 'dragon', body: 'dragon', tier: 3, resist: { phys: 20, chi: 20 } },
    { name: '독개구리', emoji: '🐸', kind: 'beast', color: '#6a9a3a', form: 'toad', body: 'frog_enemy', tier: 3, resist: { chi: 15 }, atkEl: 'pois' },
    { name: '산야인', emoji: '🪓', kind: 'beast', color: '#6a4a3a', form: 'ogre', body: 'tribal', tier: 3, resist: { phys: 15 } },
    { name: '가시왕', emoji: '🌵', kind: 'beast', color: '#3a7a2a', form: 'ogre', body: 'cactoro_2', tier: 3, resist: { phys: 20 } },
    { name: '왕도깨비', emoji: '👹', kind: 'beast', color: '#3a5a2a', form: 'ogre', body: 'orc_enemy', tier: 3, resist: { phys: 20 } },
    { name: '뿔공룡', emoji: '🦖', kind: 'beast', color: '#7a6a3a', form: 'quad', body: 'dino', tier: 3, resist: { phys: 25 } },

    // tier 4 — 정예
    { name: '철갑 중장병', emoji: '🛡️', kind: 'human', color: '#6a6a7a', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate' }, tier: 4, resist: { phys: 40 } },
    { name: '근위 기병', emoji: '🐲', kind: 'human', color: '#8a3a4a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true }, tier: 4 },
    { name: '연노 사수', emoji: '🏹', kind: 'human', color: '#5a5a6a', look: { weapon: 'bow', helm: 'helmet', armor: 'plate' }, tier: 4, atkEl: 'lit' },
    { name: '수군 함대', emoji: '🚢', kind: 'human', color: '#3a5a7a', look: { weapon: 'sword', helm: 'helmet', armor: 'plate' }, tier: 4, resist: { chi: 40, phys: 15 }, atkEl: 'cold' },
    { name: '흑기병', emoji: '🖤', kind: 'human', color: '#3a3a44', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate', cape: true }, tier: 4, resist: { phys: 30, chi: 20 } },
    { name: '강시', emoji: '🧟', kind: 'beast', color: '#6a7a5a', form: 'ogre', body: 'zombie', tier: 4, resist: { phys: 20 } },
    { name: '화염귀', emoji: '😈', kind: 'beast', color: '#8a2a2a', form: 'ogre', body: 'demon', tier: 4, resist: { chi: 30 }, atkEl: 'fire' },
    { name: '왕진흙귀신', emoji: '🪨', kind: 'beast', color: '#5a4a3a', form: 'ogre', body: 'goleling_evolved', tier: 4, resist: { phys: 35 } },
    { name: '대설인', emoji: '❄️', kind: 'beast', color: '#b8d8e8', form: 'ogre', body: 'yeti_2', tier: 4, resist: { phys: 25 }, atkEl: 'cold' },
    { name: '거인', emoji: '🗿', kind: 'beast', color: '#6a6a6a', form: 'ogre', body: 'giant', tier: 4, resist: { phys: 40 } },

    /* 2026-09-11 — "몬스터도 마저 추가"(사용자). 승인된 짐승형 GLB 47종
       (남은 열셋 — alien·alpaking·armabee·bunny·cat·chicken·fish·pigeon류 —
       은 위 2026-09-09 주석대로 이름 정책·결에 안 맞아 여전히 제외한다)이
       전부 이미 하나씩만 쓰이고 있었다 — 그 몸을 그대로 재활용해(새 다운로드
       없음) 인접 티어에 더 강한(또는 같은 티어 다른 빛깔) 짝을 하나씩
       얹었다. `body`(따라서 GLB)는 원본과 같지만 `name`·`color`·`tier`·
       `resist`·`atkEl`은 다르게 잡아 같은 몸을 두 번째 몬스터로 세운다 —
       사람형 적들이 이미 하나의 몸 풀을 여럿이 나눠 쓰는 것과 같은 요령을
       짐승형에도 편 것뿐이다. 천룡(dragon_evolved)은 유일한 보스 전용
       자산이라 짝을 안 얹었다(둘째를 만들면 그 특별함이 옅어진다). */

    // tier 1 파생 → tier 2 (짐승 12종)
    { name: '왕멧돼지', emoji: '🐗', kind: 'beast', color: '#2a1c10', form: 'quad', body: 'beast_boar', tier: 2, resist: { phys: 25 } },
    { name: '해골척후', emoji: '💀', kind: 'beast', color: '#9a9080', form: 'ogre', body: 'skeleton_minion', tier: 2, resist: { phys: 20 } },
    { name: '구천혼', emoji: '👻', kind: 'beast', color: '#b8a8d8', form: 'ogre', body: 'skeleton_solo', tier: 2, resist: { phys: 25 } },
    { name: '흑사', emoji: '🐍', kind: 'beast', color: '#2a3a1a', form: 'serpent', body: 'snake', tier: 2, atkEl: 'pois', resist: { chi: 15 } },
    { name: '왕말벌떼', emoji: '🐝', kind: 'beast', color: '#a89010', form: 'bird', body: 'wasp', tier: 2, atkEl: 'pois', resist: { phys: 10 } },
    { name: '역병쥐떼', emoji: '🐀', kind: 'beast', color: '#5a4a3a', form: 'quad', body: 'rat', tier: 2, atkEl: 'pois', resist: { phys: 10 } },
    { name: '괴이두꺼비', emoji: '🐸', kind: 'beast', color: '#3a6a3a', form: 'toad', body: 'frog', tier: 2, resist: { chi: 15 } },
    { name: '대홍슬라임', emoji: '🩷', kind: 'beast', color: '#a83a5a', form: 'quad', body: 'pink_slime', tier: 2, resist: { phys: 20 } },
    { name: '묵늪슬라임', emoji: '🟢', kind: 'beast', color: '#2a4a3a', form: 'quad', body: 'glub', tier: 2, resist: { phys: 15, chi: 10 } },
    { name: '홀씨버섯', emoji: '🍄', kind: 'beast', color: '#5a3a70', form: 'ogre', body: 'mushnub', tier: 2, atkEl: 'pois', resist: { chi: 10 } },
    { name: '고목이끼괴물', emoji: '🟩', kind: 'beast', color: '#1a3a1a', form: 'quad', body: 'green_blob', tier: 2, resist: { phys: 15 } },
    { name: '결정슬라임', emoji: '🟣', kind: 'beast', color: '#4a3a6a', form: 'quad', body: 'slime_enemy', tier: 2, resist: { chi: 15 } },

    // tier 2 파생 → tier 3 (짐승 16종)
    { name: '전상코끼리병', emoji: '🐘', kind: 'beast', color: '#5a5a62', form: 'quad', body: 'beast_big', tier: 3, resist: { chi: 40, phys: 20 } },
    { name: '해골대장', emoji: '💀', kind: 'beast', color: '#8a8270', form: 'ogre', body: 'skeleton_warrior', tier: 3, resist: { phys: 20 } },
    { name: '악귀', emoji: '👻', kind: 'beast', color: '#7a9ab0', form: 'ogre', body: 'ghost', tier: 3, resist: { phys: 40 } },
    { name: '노산도깨비', emoji: '👹', kind: 'beast', color: '#3a5a1a', form: 'ogre', body: 'orc', tier: 3, resist: { phys: 15 } },
    { name: '해골암살자', emoji: '💀', kind: 'beast', color: '#6a5a8a', form: 'ogre', body: 'skeleton_rogue', tier: 3, resist: { phys: 20 } },
    { name: '탐욕귀왕', emoji: '👺', kind: 'beast', color: '#4a1a2a', form: 'ogre', body: 'demon_2', tier: 3, resist: { chi: 20 } },
    { name: '백골귀왕', emoji: '💀', kind: 'beast', color: '#8a80a0', form: 'ogre', body: 'ghost_skull', tier: 3, resist: { phys: 35 } },
    { name: '심야 첩자', emoji: '🥷', kind: 'beast', color: '#0a0a12', form: 'ogre', body: 'ninja_2', tier: 3, resist: { phys: 15 } },
    { name: '심연늪슬라임', emoji: '🟢', kind: 'beast', color: '#0a3a2a', form: 'quad', body: 'glub_evolved', tier: 3, resist: { phys: 15 } },
    { name: '포자군주', emoji: '🍄', kind: 'beast', color: '#5a2a70', form: 'ogre', body: 'mushnub_evolved', tier: 3, resist: { chi: 15 }, atkEl: 'pois' },
    { name: '폭풍 정령', emoji: '🌀', kind: 'beast', color: '#5a89a0', form: 'ogre', body: 'hywirl', tier: 3, resist: { phys: 20 } },
    { name: '노괴 산짐승', emoji: '🐒', kind: 'beast', color: '#4a3a1a', form: 'quad', body: 'monkroose', tier: 3 },
    { name: '철가시귀', emoji: '🌵', kind: 'beast', color: '#2a5a1a', form: 'ogre', body: 'cactoro', tier: 3, resist: { phys: 15 } },
    { name: '심해 먹물귀', emoji: '🦑', kind: 'beast', color: '#1a1a4a', form: 'fish', body: 'squidle', tier: 3, resist: { chi: 20 } },
    { name: '독왕거미', emoji: '🕷️', kind: 'beast', color: '#0a0a0a', form: 'quad', body: 'spider', tier: 3, atkEl: 'pois', resist: { phys: 15 } },
    { name: '대가시슬라임', emoji: '🟩', kind: 'beast', color: '#1a5a0a', form: 'quad', body: 'green_spiky_blob', tier: 3, resist: { phys: 20 } },

    // tier 3 파생 → tier 4 (짐승 14종)
    { name: '백두산군', emoji: '🐅', kind: 'beast', color: '#e0e0e0', form: 'quad', body: 'beast_tiger', tier: 4, resist: { chi: 30, phys: 20 } },
    { name: '해골대법사', emoji: '🧙', kind: 'beast', color: '#5a4a90', form: 'ogre', body: 'skeleton_mage', tier: 4, resist: { chi: 35 }, atkEl: 'lit' },
    { name: '심연진흙귀신', emoji: '🪨', kind: 'beast', color: '#3a2a1a', form: 'ogre', body: 'goleling', tier: 4, resist: { phys: 30 } },
    { name: '설산군주', emoji: '❄️', kind: 'beast', color: '#8ac0e0', form: 'ogre', body: 'yeti', tier: 4, resist: { phys: 25 }, atkEl: 'cold' },
    { name: '독버섯 대군주', emoji: '🍄', kind: 'beast', color: '#6a3a80', form: 'ogre', body: 'mushroom_king', tier: 4, resist: { chi: 20 }, atkEl: 'pois' },
    { name: '대청귀', emoji: '😈', kind: 'beast', color: '#1a3a6a', form: 'ogre', body: 'blue_demon', tier: 4, resist: { chi: 30 }, atkEl: 'cold' },
    { name: '칠흑 자객', emoji: '🥷', kind: 'beast', color: '#0a0a10', form: 'ogre', body: 'ninja', tier: 4, resist: { phys: 25 } },
    { name: '대요술사', emoji: '🧙', kind: 'beast', color: '#3a1a5a', form: 'ogre', body: 'wizard', tier: 4, resist: { chi: 30 }, atkEl: 'fire' },
    { name: '흑이무기', emoji: '🐍', kind: 'beast', color: '#1a2a2a', form: 'dragon', body: 'dragon', tier: 4, resist: { phys: 25, chi: 25 } },
    { name: '왕독개구리', emoji: '🐸', kind: 'beast', color: '#3a6a10', form: 'toad', body: 'frog_enemy', tier: 4, resist: { chi: 20 }, atkEl: 'pois' },
    { name: '노산야인', emoji: '🪓', kind: 'beast', color: '#3a2a1a', form: 'ogre', body: 'tribal', tier: 4, resist: { phys: 20 } },
    { name: '대가시왕', emoji: '🌵', kind: 'beast', color: '#1a5a0a', form: 'ogre', body: 'cactoro_2', tier: 4, resist: { phys: 25 } },
    { name: '노왕도깨비', emoji: '👹', kind: 'beast', color: '#1a3a0a', form: 'ogre', body: 'orc_enemy', tier: 4, resist: { phys: 25 } },
    { name: '왕뿔공룡', emoji: '🦖', kind: 'beast', color: '#4a3a1a', form: 'quad', body: 'dino', tier: 4, resist: { phys: 30 } },

    // tier 4 짝(같은 티어, 다른 빛깔 — 짐승 5종)
    { name: '역병강시', emoji: '🧟', kind: 'beast', color: '#3a5a2a', form: 'ogre', body: 'zombie', tier: 4, atkEl: 'pois', resist: { phys: 25 } },
    { name: '겁화귀', emoji: '😈', kind: 'beast', color: '#a81a1a', form: 'ogre', body: 'demon', tier: 4, resist: { chi: 35 }, atkEl: 'fire' },
    { name: '태고진흙귀신', emoji: '🪨', kind: 'beast', color: '#2a2018', form: 'ogre', body: 'goleling_evolved', tier: 4, resist: { phys: 40 } },
    { name: '빙하대설인', emoji: '❄️', kind: 'beast', color: '#d8f0f8', form: 'ogre', body: 'yeti_2', tier: 4, resist: { phys: 30 }, atkEl: 'cold' },
    { name: '폭풍거인', emoji: '🗿', kind: 'beast', color: '#4a4a5a', form: 'ogre', body: 'giant', tier: 4, atkEl: 'lit', resist: { phys: 45 } },

    /* 2026-09-14 — PLAN "3안"(새 CC0 몬스터 에셋 조사). 기존 몸 재활용이던
       2안(위 "짐승형 47종 파생")과 달리 이번엔 실제로 새 CC0 GLB 6종
       (Quaternius Animated Dinosaur Pack, `asset3d.js` REG 참고)을 받아
       왔다. 기존 '뿔공룡'(tier3)·'왕뿔공룡'(tier4, body:'dino')은 다른 팩의
       다른 개체라 그대로 두고, 이번 여섯은 각자 다른 몸(GLB)을 하나씩 쓴다
       — 이름은 실제 공룡 학명을 그대로 안 쓰고(정책상 문제는 없지만 이
       판의 관례를 따라) 생김새를 묘사하는 한자어로 옮겼다. */
    { name: '쾌조룡', emoji: '🦎', kind: 'beast', color: '#6a7a3a', form: 'quad', body: 'dino_raptor', tier: 2, resist: { phys: 10 } },
    { name: '볏공룡', emoji: '🦕', kind: 'beast', color: '#a0895a', form: 'quad', body: 'dino_para', tier: 3, resist: { phys: 15 } },
    { name: '판갑룡', emoji: '🦕', kind: 'beast', color: '#5a6a4a', form: 'quad', body: 'dino_stego', tier: 3, resist: { phys: 30 } },
    { name: '폭룡', emoji: '🦖', kind: 'beast', color: '#6a2a1a', form: 'quad', body: 'dino_trex', tier: 4, resist: { phys: 25 } },
    { name: '삼각뿔룡', emoji: '🦏', kind: 'beast', color: '#8a5a3a', form: 'quad', body: 'dino_tri', tier: 4, resist: { phys: 35 } },
    { name: '장경룡', emoji: '🦕', kind: 'beast', color: '#5a7a6a', form: 'quad', body: 'dino_apato', tier: 4, resist: { phys: 40 } },

    /* 2026-09-14(이어서) — "3안" 계속, OpenGameArt "Cute Animated Monsters"
       (Quaternius, CC0, asset3d.js 주석 참고)에서 새로 받은 다섯. 겹치는
       개체(Demon·Yeti·Cactus·Mushroom)는 이미 있어 안 쓰고, 새 몸 다섯만
       판에 얹는다 — 전부 실제 인물·시리즈와 무관한 창작 형상이라 이름
       정책에 걸리지 않는다(크툴루 신화의 그 이름은 내부 식별자 `body`
       에만 남기고 화면 이름은 다른 민담 어휘로 옮겼다). */
    { name: '풋귀', emoji: '👹', kind: 'beast', color: '#5a8a3a', form: 'ogre', body: 'demon_green', tier: 1 },
    { name: '집게괴', emoji: '🦀', kind: 'beast', color: '#a8503a', form: 'quad', body: 'crab', tier: 1, resist: { phys: 10 }, biome: 'swamp' },
    { name: '고목정', emoji: '🌳', kind: 'beast', color: '#4a6a3a', form: 'ogre', body: 'treant', tier: 2, resist: { phys: 10 }, biome: 'forest' },
    { name: '외눈귀', emoji: '👁️', kind: 'beast', color: '#7a6a5a', form: 'ogre', body: 'cyclops', tier: 3, resist: { phys: 15 }, biome: 'mountain' },
    { name: '심연촉수귀', emoji: '🐙', kind: 'beast', color: '#2a3a4a', form: 'dragon', body: 'cthulhu', tier: 4, resist: { chi: 20 } },

    /* 2026-09-18 — PLAN §5.7 시대 퓨전 "기계화 변종 10". 새 GLB 를 안 받고
       위 짐승형 파생과 똑같은 규칙(같은 body, 색·이름·수치만 다시 굴린다)
       을 한 번 더 썼다 — 다만 색은 금속 팔레트(은·동·강철회)로, 저항은
       phys/chi 대신 emp(§5.1 세계 축이 이미 쓰는 결)로 몰았다. "몸은
       그대로, 겉만 금속이다"라 새 이름도 실제 동물명이 아니라 그 겉을
       묘사한다 — 이름 정책에 걸릴 실명이 없다. */
    { name: '강철랑', emoji: '🐺', kind: 'beast', color: '#aab4bd', form: 'quad', tier: 1, resist: { emp: 30 } },
    { name: '동합귀', emoji: '👹', kind: 'beast', color: '#b87333', form: 'ogre', body: 'demon_green', tier: 1, resist: { emp: 30 } },
    { name: '철갑해', emoji: '🦀', kind: 'beast', color: '#8a95a0', form: 'quad', body: 'crab', tier: 1, resist: { emp: 25, phys: 10 }, biome: 'swamp' },
    { name: '강철익수', emoji: '🦎', kind: 'beast', color: '#7a8a94', form: 'quad', body: 'dino_raptor', tier: 2, resist: { emp: 35, phys: 10 } },
    { name: '동력파룡', emoji: '🦕', kind: 'beast', color: '#9aa8b4', form: 'quad', body: 'dino_para', tier: 2, resist: { emp: 35 }, atkEl: 'emp' },
    { name: '청동거목', emoji: '🌳', kind: 'beast', color: '#5f8a7a', form: 'ogre', body: 'treant', tier: 2, resist: { emp: 35, phys: 10 }, biome: 'forest' },
    { name: '강철판갑', emoji: '🦕', kind: 'beast', color: '#6a7480', form: 'quad', body: 'dino_stego', tier: 3, resist: { emp: 40, phys: 20 } },
    { name: '기계외안', emoji: '👁️', kind: 'beast', color: '#8a8f9a', form: 'ogre', body: 'cyclops', tier: 3, resist: { emp: 40 }, atkEl: 'emp', biome: 'mountain' },
    { name: '초강폭룡', emoji: '🦖', kind: 'beast', color: '#5a626e', form: 'quad', body: 'dino_trex', tier: 4, resist: { emp: 45, phys: 15 } },
    { name: '강철촉수귀', emoji: '🐙', kind: 'beast', color: '#4a5a68', form: 'dragon', body: 'cthulhu', tier: 4, resist: { emp: 45, chi: 10 }, atkEl: 'emp' }
  ];

  /* 세 시대 적(PLAN §5.20 · SAGA-DESIGN §13, 2026-09-25) — 위 기계화 변종은 "몸은 그대로, 겉만 금속"이라
     색만 다른 몸이었다. 이 여덟은 **저마다 제 몸**(제 클립 든 GLB, 기존 적이 안 쓰는 것)이다.
     ENEMIES 에 안 넣는다 — 던전 방·지역 명단 규칙(poolFor)은 그대로 두고, 들판에서만 `dungeon.js`
     pickEnemyRef 가 몫(`dg.eraMix`)만큼 그 지역 시대가 **아닌** 쪽에서 뽑는다. 단계마다 현대 하나·미래 하나.
     사람 모양이어도 kind 는 beast(제 몸 GLB 로 세우는 길) — 2D 는 form 으로 그린다. 원거리는 look.weapon(staff)
     으로 가르는 기존 규칙 그대로. 이름은 역할 묘사뿐이라 실명 없음 */
  var ERA_ENEMIES = [
    { name: '폭주 청년', emoji: '🛹', kind: 'beast', color: '#7a4a6a', form: 'ogre', body: 'era_punk', look: { weapon: 'club' }, tier: 1, era: 'modern', resist: { phys: 5 } },
    { name: '정찰 드론', emoji: '🛸', kind: 'beast', color: '#8a9aa8', form: 'bird', body: 'era_drone', look: { weapon: 'staff' }, tier: 1, era: 'future', resist: { emp: 20 }, atkEl: 'emp' },
    { name: '방역복 추적자', emoji: '☣️', kind: 'beast', color: '#c9b030', form: 'ogre', body: 'era_hazmat', tier: 2, era: 'modern', resist: { chi: 20 }, atkEl: 'pois' },
    { name: '경비 보행기', emoji: '🤖', kind: 'beast', color: '#7a8a9a', form: 'ogre', body: 'era_walker', tier: 2, era: 'future', resist: { emp: 30, phys: 10 } },
    { name: '진압 특공대', emoji: '🔫', kind: 'beast', color: '#3a3a44', form: 'ogre', body: 'era_swat', look: { weapon: 'staff' }, tier: 3, era: 'modern', resist: { phys: 20 } },
    { name: '별바다 손님', emoji: '👽', kind: 'beast', color: '#6ac08a', form: 'ogre', body: 'alien', tier: 3, era: 'future', resist: { chi: 25 }, atkEl: 'emp' },
    { name: '실험실 장갑벌', emoji: '🐝', kind: 'beast', color: '#b0703a', form: 'bird', body: 'armabee_evolved', tier: 4, era: 'modern', resist: { phys: 25 }, atkEl: 'pois' },
    { name: '강철 거신', emoji: '🦾', kind: 'beast', color: '#9a6a4a', form: 'ogre', body: 'era_hulk', look: { weapon: 'club' }, tier: 4, era: 'future', resist: { emp: 45, phys: 20 } }
  ];

  /* id(2026-09-18, §5.4 월드 보스) — 이전엔 아무도 개체를 식별할 필요가
     없어 없었다. `save.dex.worldBoss`(토벌첩)가 이 id 로 키를 삼는다.
     name 은 표시 글자(이름 정책 대상)라 id 는 로마자 슬러그로 뺐다. */
  var BOSSES = [
    { id: 'hwanggeon', name: '황건 두목', emoji: '👺', kind: 'human', color: '#c9a83a', look: { weapon: 'club', helm: 'none', armor: 'leather', beard: true }, tier: 1 },
    { id: 'sanchae', name: '산채 두령', emoji: '👹', kind: 'human', color: '#6b4a2a', look: { weapon: 'axe', helm: 'none', armor: 'leather', beard: true }, tier: 1 },
    { id: 'waegu', name: '왜구 선장', emoji: '🏴‍☠️', kind: 'human', color: '#8a3a3a', look: { weapon: 'sword', helm: 'none', armor: 'leather', cape: true }, tier: 2 },
    { id: 'orangkae', name: '오랑캐 족장', emoji: '🐺', kind: 'human', color: '#7a5a2a', look: { weapon: 'axe', helm: 'none', armor: 'leather', cape: true, beard: true }, tier: 2 },
    { id: 'georan', name: '거란 도통', emoji: '🦅', kind: 'human', color: '#4a6a9a', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate', cape: true }, tier: 2 },
    { id: 'monggol', name: '몽골 만호장', emoji: '🐴', kind: 'human', color: '#8a6a3a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true }, tier: 3 },
    { id: 'waejang', name: '왜장', emoji: '🗾', kind: 'human', color: '#7a3a3a', look: { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true }, tier: 3 },
    { id: 'wigun', name: '위군 도독', emoji: '🎖️', kind: 'human', color: '#31609f', look: { weapon: 'sword', helm: 'crown', armor: 'plate', cape: true }, tier: 3 },
    { id: 'gwanmun', name: '관문 수호장', emoji: '🏯', kind: 'human', color: '#5a5a6a', look: { weapon: 'halberd', helm: 'gapju', armor: 'plate', cape: true, beard: true }, tier: 4 },
    { id: 'jeokgukdae', name: '적국 대장군', emoji: '🐉', kind: 'human', color: '#7a2a3a', look: { weapon: 'halberd', helm: 'plume', armor: 'plate', cape: true }, tier: 4 },
    /* 천룡(天龍) — 동아시아 설화의 하늘을 다스리는 용. 실존 인물이 아니라
       신화 존재라 이름 정책(§ 하지 말 것)에 걸리지 않는다. */
    { id: 'cheonryong', name: '천룡', emoji: '🐲', kind: 'beast', color: '#2a5a8a', form: 'dragon', body: 'dragon_evolved', tier: 4, resist: { phys: 25, chi: 25 }, atkEl: 'fire' }
  ];

  function tierOf(stage) {
    if (stage <= 5) { return 1; }
    if (stage <= 12) { return 2; }
    if (stage <= 25) { return 3; }
    return 4;
  }

  global.DG = global.DG || {};
  global.DG.enemyData = {
    /** 표시 이름으로 찾기(§5.13 지역 우두머리가 몸을 빌린다) */
    byName: function (n) {
      var i;
      for (i = 0; i < ENEMIES.length; i++) { if (ENEMIES[i].name === n) { return ENEMIES[i]; } }
      for (i = 0; i < ERA_ENEMIES.length; i++) { if (ERA_ENEMIES[i].name === n) { return ERA_ENEMIES[i]; } }
      return null;
    },
    enemies: ENEMIES,
    eraEnemies: ERA_ENEMIES,
    /**
     * 세 시대 적 풀(§5.20) — `eras` 에 든 시대만, 이 관문 단계(t) 이하, 지금 단계는 세 몫(poolFor 명단 규칙과 같은 무게).
     * 맞는 게 없으면 빈 배열
     */
    eraPoolFor: function (stage, eras) {
      var t = tierOf(stage), out = [], i, e;
      for (i = 0; i < ERA_ENEMIES.length; i++) {
        e = ERA_ENEMIES[i];
        if (e.tier > t || !eras || eras.indexOf(e.era) < 0) { continue; }
        out.push(e);
        if (e.tier === t) { out.push(e, e); }
      }
      return out;
    },
    bosses: BOSSES,
    tierOf: tierOf,
    /**
     * 해당 관문에 어울리는 적 풀.
     * @param biome 마을 지역색(PLAN §60) — `town:forest`의 `forest` 부분처럼
     *   `biome` 접두 없는 값. 없으면(전부 그렇던 옛 호출) 예전과 100% 같다.
     *   태그된 몬스터가 하나도 안 남으면(그 biome에 어울리는 게 없으면)
     *   조용히 tier 전체 풀로 되돌아간다 — 자리가 텅 비는 일은 없다.
     */
    poolFor: function (stage, boss, biome, roster) {
      var t = tierOf(stage);
      var src = boss ? BOSSES : ENEMIES;
      /* 지역 명단(§5.13, world-map.js) — 이 위험도가 감당하는 단계(t 이하)만, 지금 단계는 세 몫.
         명단에 맞는 게 하나도 없으면 아래 옛 규칙으로 */
      if (roster && roster.length && !boss) {
        var rp = [], ri, e;
        for (ri = 0; ri < ENEMIES.length; ri++) {
          e = ENEMIES[ri];
          if (e.tier > t || roster.indexOf(e.name) < 0) { continue; }
          rp.push(e);
          if (e.tier === t) { rp.push(e, e); }
        }
        if (rp.length) { return rp; }
      }
      var pool = src.filter(function (e) { return e.tier === t; });
      if (biome) {
        var biomePool = pool.filter(function (e) { return !e.biome || e.biome === biome; });
        if (biomePool.length) { pool = biomePool; }
      }
      return pool.length ? pool : src;
    }
  };
})(window);
