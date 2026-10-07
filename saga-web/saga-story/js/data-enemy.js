/**
 * 적 데이터 — 관문에 나오는 무리
 * ---------------------------------------------------------------
 * tier 는 관문 구간이다.  1: 1~5관문 / 2: 6~12 / 3: 13~25 / 4: 26관문 이상
 * 각 관문의 마지막 파(10파)에는 보스가 혼자 나온다.
 */
(function (global) {
  'use strict';

  var ENEMIES = [
    // tier 1 — 잡졸
    { name: '황건적', emoji: '🟡', kind: 'human', color: '#c9a83a', look: { weapon: 'club', helm: 'none', armor: 'leather' }, tier: 1 },
    { name: '산적', emoji: '🪓', kind: 'human', color: '#6b5030', look: { weapon: 'axe', helm: 'none', armor: 'leather' }, tier: 1 },
    { name: '도적떼', emoji: '🗡️', kind: 'human', color: '#5a4a58', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 1 },
    { name: '들개', emoji: '🐕', kind: 'beast', color: '#8a7358', form: 'quad', tier: 1 },
    { name: '떠돌이 병졸', emoji: '🥷', kind: 'human', color: '#6a6a74', look: { weapon: 'spear', helm: 'helmet', armor: 'leather' }, tier: 1 },
    /* 2026-09-11("몹 종류도 늘려줘") — 잡졸엔 원거리형이 아예 없었다(enemyRole()이
       ranged 로 가르는 조건은 활·조총뿐). 노략 궁수로 그 자리를 채운다 */
    { name: '노략 궁수', emoji: '🏹', kind: 'human', color: '#9a8a5a', look: { weapon: 'bow', helm: 'none', armor: 'leather' }, tier: 1 },
    { name: '유민 폭도', emoji: '🔨', kind: 'human', color: '#7a6a4a', look: { weapon: 'club', helm: 'none', armor: 'leather' }, tier: 1 },
    { name: '굶주린 승냥이', emoji: '🐺', kind: 'beast', color: '#6a5a48', form: 'quad', tier: 1 },

    // tier 2 — 변방
    { name: '왜구', emoji: '⛵', kind: 'human', color: '#8a4a4a', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 2 },
    { name: '마적', emoji: '🐎', kind: 'human', color: '#7a5a3a', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 2 },
    { name: '오랑캐 궁수', emoji: '🏹', kind: 'human', color: '#7a6a4a', look: { weapon: 'bow', helm: 'none', armor: 'leather' }, tier: 2 },
    { name: '거란 기병', emoji: '🐴', kind: 'human', color: '#5a6a8a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 2 },
    { name: '남만 코끼리병', emoji: '🐘', kind: 'beast', color: '#8a8a92', form: 'quad', tier: 2 },
    /* 2026-09-11 — 탱커형(코끼리·미늘창)이 하나뿐이라 미늘창 쪽으로 하나 더.
       요동 철기는 두 번째 돌진형(기병)이다 */
    { name: '요동 철기', emoji: '🐴', kind: 'human', color: '#4a5a7a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 2 },
    { name: '왜군 낭인', emoji: '⚔️', kind: 'human', color: '#5a3a3a', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 2 },
    { name: '중장 방패병', emoji: '🛡️', kind: 'human', color: '#4a4a5a', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate' }, tier: 2 },

    // tier 3 — 정규군
    { name: '여진 궁수', emoji: '🎯', kind: 'human', color: '#6a7a5a', look: { weapon: 'bow', helm: 'none', armor: 'leather' }, tier: 3 },
    { name: '몽골 기병', emoji: '🏇', kind: 'human', color: '#8a7a5a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 3 },
    { name: '왜군 조총병', emoji: '🔫', kind: 'human', color: '#7a4a4a', look: { weapon: 'staff', helm: 'none', armor: 'leather' }, tier: 3 },
    { name: '위군 창병', emoji: '⚔️', kind: 'human', color: '#31609f', look: { weapon: 'spear', helm: 'helmet', armor: 'plate' }, tier: 3 },
    { name: '수군 척후선', emoji: '🚤', kind: 'human', color: '#3a6a8a', look: { weapon: 'bow', helm: 'helmet', armor: 'leather' }, tier: 3 },
    /* 2026-09-11 — 3관문대는 탱커형(미늘창)이 하나도 없었다. 중장 창병으로
       그 자리를 채운다. 자객대는 근접형, 산짐승 무리는 짐승형(마법형 굴림
       대상은 근접형뿐이라 짐승은 안 걸린다 — 그대로 둔다) */
    { name: '중장 창병', emoji: '🛡️', kind: 'human', color: '#3a4a6a', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate' }, tier: 3 },
    { name: '자객대', emoji: '🗡️', kind: 'human', color: '#2a2a3a', look: { weapon: 'sword', helm: 'none', armor: 'leather' }, tier: 3 },
    { name: '산짐승 무리', emoji: '🐗', kind: 'beast', color: '#4a3a2a', form: 'quad', tier: 3 },

    // tier 4 — 정예
    { name: '철갑 중장병', emoji: '🛡️', kind: 'human', color: '#6a6a7a', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate' }, tier: 4 },
    { name: '근위 기병', emoji: '🐲', kind: 'human', color: '#8a3a4a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true }, tier: 4 },
    { name: '연노 사수', emoji: '🏹', kind: 'human', color: '#5a5a6a', look: { weapon: 'bow', helm: 'helmet', armor: 'plate' }, tier: 4 },
    { name: '수군 함대', emoji: '🚢', kind: 'human', color: '#3a5a7a', look: { weapon: 'sword', helm: 'helmet', armor: 'plate' }, tier: 4 },
    { name: '흑기병', emoji: '🖤', kind: 'human', color: '#3a3a44', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate', cape: true }, tier: 4 },
    /* 2026-09-11 — 4관문대(정예)에도 셋을 더해 다섯 관문대 전부 골고루 늘렸다 */
    { name: '창귀병(槍鬼兵)', emoji: '👻', kind: 'human', color: '#5a2a3a', look: { weapon: 'sword', helm: 'helmet', armor: 'plate' }, tier: 4 },
    { name: '황실 궁병', emoji: '🏹', kind: 'human', color: '#6a5a8a', look: { weapon: 'bow', helm: 'helmet', armor: 'plate' }, tier: 4 },
    { name: '뇌격 기병', emoji: '⚡', kind: 'human', color: '#3a3a5a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true }, tier: 4 }
  ];

  var BOSSES = [
    { name: '황건 두목', emoji: '👺', kind: 'human', color: '#c9a83a', look: { weapon: 'club', helm: 'none', armor: 'leather', beard: true }, tier: 1 },
    { name: '산채 두령', emoji: '👹', kind: 'human', color: '#6b4a2a', look: { weapon: 'axe', helm: 'none', armor: 'leather', beard: true }, tier: 1 },
    { name: '왜구 선장', emoji: '🏴‍☠️', kind: 'human', color: '#8a3a3a', look: { weapon: 'sword', helm: 'none', armor: 'leather', cape: true }, tier: 2 },
    { name: '오랑캐 족장', emoji: '🐺', kind: 'human', color: '#7a5a2a', look: { weapon: 'axe', helm: 'none', armor: 'leather', cape: true, beard: true }, tier: 2 },
    { name: '거란 도통', emoji: '🦅', kind: 'human', color: '#4a6a9a', look: { weapon: 'halberd', helm: 'helmet', armor: 'plate', cape: true }, tier: 2 },
    { name: '몽골 만호장', emoji: '🐴', kind: 'human', color: '#8a6a3a', look: { weapon: 'spear', helm: 'helmet', armor: 'plate', cape: true }, tier: 3 },
    { name: '왜장', emoji: '🗾', kind: 'human', color: '#7a3a3a', look: { weapon: 'sword', helm: 'gapju', armor: 'plate', cape: true }, tier: 3 },
    { name: '위군 도독', emoji: '🎖️', kind: 'human', color: '#31609f', look: { weapon: 'sword', helm: 'crown', armor: 'plate', cape: true }, tier: 3 },
    { name: '관문 수호장', emoji: '🏯', kind: 'human', color: '#5a5a6a', look: { weapon: 'halberd', helm: 'gapju', armor: 'plate', cape: true, beard: true }, tier: 4 },
    { name: '적국 대장군', emoji: '🐉', kind: 'human', color: '#7a2a3a', look: { weapon: 'halberd', helm: 'plume', armor: 'plate', cape: true }, tier: 4 },
    /* 사가종횡 다섯째·여섯째 사냥터(낙양 옛터·검각 암굴) 보스 — 있는 칸만 쓴다(새 필드 없음) */
    { name: '폐도 흉장', emoji: '🔥', kind: 'human', color: '#4a3a32', look: { weapon: 'axe', helm: 'plume', armor: 'plate', cape: true, beard: true }, tier: 4 },
    { name: '암굴 귀장', emoji: '👻', kind: 'human', color: '#3a3456', look: { weapon: 'spear', helm: 'gapju', armor: 'plate', cape: true }, tier: 4 },
    /* 사가종횡 5부 문 너머 사냥터 셋 보스 — 있는 칸만 쓴다(새 필드 없음) */
    { name: '전장 원혼 장수', emoji: '🏴', kind: 'human', color: '#6a4a34', look: { weapon: 'halberd', helm: 'plume', armor: 'plate', cape: true, beard: true }, tier: 4 },
    { name: '폐허 도심 통제관', emoji: '🚦', kind: 'human', color: '#4a5560', look: { weapon: 'sword', helm: 'helmet', armor: 'plate', cape: true }, tier: 4 },
    { name: '궤도 기지 감시관', emoji: '🛰️', kind: 'human', color: '#2a3a6a', look: { weapon: 'spear', helm: 'crown', armor: 'plate', cape: true }, tier: 4 }
  ];

  function tierOf(stage) {
    if (stage <= 5) { return 1; }
    if (stage <= 12) { return 2; }
    if (stage <= 25) { return 3; }
    return 4;
  }

  global.DG = global.DG || {};
  global.DG.enemyData = {
    enemies: ENEMIES,
    bosses: BOSSES,
    tierOf: tierOf,
    /** 이름으로 보스 하나 (사냥터마다 고정 보스를 두는 데 쓴다) */
    bossByName: function (n) {
      for (var i = 0; i < BOSSES.length; i++) { if (BOSSES[i].name === n) { return BOSSES[i]; } }
      return BOSSES[0];
    },
    /** 해당 관문에 어울리는 적 풀 */
    poolFor: function (stage, boss) {
      var t = tierOf(stage);
      var src = boss ? BOSSES : ENEMIES;
      var pool = src.filter(function (e) { return e.tier === t; });
      return pool.length ? pool : src;
    }
  };
})(window);
