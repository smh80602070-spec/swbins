/**
 * 사명(使命) — 원작의 퀘스트
 * ---------------------------------------------------------------
 * 원작에서 사냥 다음으로 손이 자주 가던 것이 퀘스트다. 이 판에는 그 축이 없어
 * 사냥터에 들어갈 이유가 '경험치' 하나뿐이었다.
 *
 * 한 자리 = { key, name, need(레벨), goal, desc, reward }
 *   goal.type  'kill'    아무 적 n 마리          (stage 를 적으면 그 사냥터에서만)
 *              'boss'    보스 n 번
 *              'gather'  채집물 n 개            (kind 를 적으면 그 재료만, PLAN 15절 "아이템 수집")
 *              'visit'   서로 다른 사냥터 n 곳을 밟기 (PLAN 15절 "특정 장소 방문·탐험")
 *              'talk'    마을 사람에게 말 걸기 n 번 (PLAN 15절 "NPC 대화")
 *              'gear'    장비를 n 가지 갖추기 (낀 것 기준)
 *              'skill'   무예 레벨 합 n
 *              'gold'    금 n
 *              'level'   레벨 n
 *   reward     { exp, gold, potion, scroll, gear }
 *
 * **되받는 사명 셋**(`repeat: true`)은 바친 뒤 다시 받을 수 있다 — 원작의 반복 퀘스트다.
 */
(function (global) {
  'use strict';

  var QUESTS = [
    { key: 'q_first', name: '첫 사냥', need: 1, repeat: false,
      goal: { type: 'kill', n: 10 },
      desc: '허창 들판에 나가 열을 베고 오라.',
      reward: { exp: 60, gold: 200, potion: 3 } },

    { key: 'q_field', name: '들판을 비운다', need: 3, repeat: false,
      goal: { type: 'kill', n: 40, stage: 'field' },
      desc: '허창 들판의 적 마흔.',
      reward: { exp: 220, gold: 700, scroll: 'def100' } },

    { key: 'q_gear1', name: '몸을 갖춘다', need: 4, repeat: false,
      goal: { type: 'gear', n: 3 },
      desc: '무엇이든 세 자리를 채워 입어라. 맨몸으로는 오래 못 버틴다.',
      reward: { exp: 180, gold: 600, potion: 5 } },

    { key: 'q_boss1', name: '두목의 목', need: 5, repeat: false,
      goal: { type: 'boss', n: 1 },
      desc: '사냥터 안쪽을 지키는 자를 하나 베어라.',
      reward: { exp: 400, gold: 1200, scroll: 'atk60' } },

    { key: 'q_forest', name: '오림의 그늘', need: 6, repeat: false,
      goal: { type: 'kill', n: 60, stage: 'forest' },
      desc: '오림 숲의 적 예순.',
      reward: { exp: 700, gold: 2000, potion: 8 } },

    { key: 'q_gather1', name: '약초 캐기', need: 2, repeat: false,
      goal: { type: 'gather', n: 15 },
      desc: '들판을 다니며 캘 수 있는 것을 열다섯 개 모아라.',
      reward: { exp: 140, gold: 400, potion: 4 } },

    { key: 'q_explore1', name: '길을 넓힌다', need: 7, repeat: false,
      goal: { type: 'visit', n: 4 },
      desc: '서로 다른 사냥터 넷을 밟아 보라.',
      reward: { exp: 320, gold: 900, scroll: 'hp60' } },

    { key: 'q_talk1', name: '민심을 살핀다', need: 3, repeat: false,
      goal: { type: 'talk', n: 5 },
      desc: '마을 사람 다섯에게 말을 건네 보라.',
      reward: { exp: 160, gold: 450, potion: 3 } },

    { key: 'q_job', name: '길을 정한다', need: 10, repeat: false,
      goal: { type: 'skill', n: 1 },
      desc: '전직하고 무예에 점을 한 번 부어라.',
      reward: { exp: 500, gold: 1500, scroll: 'hp60' } },

    { key: 'q_gold1', name: '군자금', need: 8, repeat: false,
      goal: { type: 'gold', n: 8000 },
      desc: '금 팔천을 모아 보여라.',
      reward: { exp: 600, gold: 0, scroll: 'atk10' } },

    { key: 'q_cave', name: '굴혈로', need: 12, repeat: false,
      goal: { type: 'kill', n: 90, stage: 'cave' },
      desc: '한중 굴혈의 적 아흔.',
      reward: { exp: 1800, gold: 5000, scroll: 'def60' } },

    { key: 'q_gear2', name: '온몸을 갖춘다', need: 14, repeat: false,
      goal: { type: 'gear', n: 7 },
      desc: '일곱 자리를 다 채워 입어라.',
      reward: { exp: 2200, gold: 6000, scroll: 'hp10' } },

    { key: 'q_master', name: '무예를 익힌다', need: 18, repeat: false,
      goal: { type: 'skill', n: 20 },
      desc: '무예 레벨의 합이 스물에 이르도록 익혀라.',
      reward: { exp: 3000, gold: 8000, scroll: 'atk10' } },

    /* 호로곡·낙양 옛터·검각 암굴(2026-09-23) — Lv.18 뒤로 사명이 끊겨 있었다.
       사냥터마다 "베기 → 보스" 두 걸음, 경험치는 그 레벨 한두 칸 어치(core.expNeed) */
    { key: 'q_gorge', name: '호로곡의 불길', need: 25, repeat: false,
      goal: { type: 'kill', n: 120, stage: 'gorge' },
      desc: '호로곡의 정예 백스물.',
      reward: { exp: 25000, gold: 15000, scroll: 'atk60' } },

    { key: 'q_cinder', name: '그은 돌을 모은다', need: 25, repeat: false,
      goal: { type: 'gather', n: 20, kind: 'cinder' },
      desc: '불길에 그은 돌 스물. 저자에서 부적으로 벼릴 수 있다.',
      reward: { exp: 12000, gold: 8000, potion: 15 } },

    { key: 'q_gorge_boss', name: '골짜기의 주인', need: 30, repeat: false,
      goal: { type: 'boss', n: 1, stage: 'gorge' },
      desc: '호로곡 끝을 지키는 대장군을 베어라.',
      reward: { exp: 35000, gold: 20000, scroll: 'atk10' } },

    { key: 'q_ruin', name: '옛 도읍의 잿더미', need: 45, repeat: false,
      goal: { type: 'kill', n: 150, stage: 'ruin' },
      desc: '낙양 옛터의 적 백쉰.',
      reward: { exp: 60000, gold: 40000, scroll: 'def60' } },

    { key: 'q_ruin_boss', name: '폐도의 흉장', need: 50, repeat: false,
      goal: { type: 'boss', n: 1, stage: 'ruin' },
      desc: '잿더미 속 흉장을 베어라.',
      reward: { exp: 90000, gold: 60000, scroll: 'atk10' } },

    { key: 'q_deep', name: '검각 깊이', need: 70, repeat: false,
      goal: { type: 'kill', n: 180, stage: 'deepcave' },
      desc: '검각 암굴의 적 백여든.',
      reward: { exp: 140000, gold: 100000, scroll: 'hp10' } },

    { key: 'q_deep_boss', name: '암굴의 귀장', need: 75, repeat: false,
      goal: { type: 'boss', n: 1, stage: 'deepcave' },
      desc: '가장 깊은 굴의 귀장을 베어라.',
      reward: { exp: 200000, gold: 150000, scroll: 'atk10' } },

    /* 5부 문 너머 — 사냥터 셋마다 적 백여든 + 보스(레벨 문턱 72·74·76) */
    { key: 'q_beyond1', name: '문 너머 옛 전장', need: 72, repeat: false,
      goal: { type: 'kill', n: 180, stage: 'beyond_past' },
      desc: '문 너머 옛 전장의 적 백여든.',
      reward: { exp: 180000, gold: 130000, scroll: 'def60' } },

    { key: 'q_beyond1_boss', name: '전장의 원혼 장수', need: 72, repeat: false,
      goal: { type: 'boss', n: 1, stage: 'beyond_past' },
      desc: '깃발 무덤을 지키는 원혼 장수를 베어라.',
      reward: { exp: 260000, gold: 190000, scroll: 'atk10' } },

    { key: 'q_beyond2', name: '문 너머 무너진 도심', need: 74, repeat: false,
      goal: { type: 'kill', n: 190, stage: 'beyond_now' },
      desc: '문 너머 무너진 도심의 적 백아흔.',
      reward: { exp: 220000, gold: 160000, scroll: 'def60' } },

    { key: 'q_beyond2_boss', name: '도심의 통제관', need: 74, repeat: false,
      goal: { type: 'boss', n: 1, stage: 'beyond_now' },
      desc: '꺼지지 않는 신호를 쥔 통제관을 베어라.',
      reward: { exp: 320000, gold: 230000, scroll: 'hp10' } },

    { key: 'q_beyond3', name: '문 너머 궤도 기지', need: 76, repeat: false,
      goal: { type: 'kill', n: 200, stage: 'beyond_future' },
      desc: '문 너머 궤도 기지의 적 이백.',
      reward: { exp: 280000, gold: 200000, scroll: 'def60' } },

    { key: 'q_beyond3_boss', name: '기지의 감시관', need: 76, repeat: false,
      goal: { type: 'boss', n: 1, stage: 'beyond_future' },
      desc: '기지를 깨어 있게 한 감시관을 베어라.',
      reward: { exp: 400000, gold: 300000, scroll: 'atk10' } },

    /* 되받는 셋 — 바친 뒤 다시 받는다 */
    { key: 'r_hunt', name: '토벌령(討伐令)', need: 3, repeat: true,
      goal: { type: 'kill', n: 30 },
      desc: '어디서든 서른을 베어 오라. 관아는 늘 사람이 모자란다.',
      reward: { exp: 260, gold: 900, potion: 3 } },

    { key: 'r_boss', name: '수급(首級)', need: 7, repeat: true,
      goal: { type: 'boss', n: 2 },
      desc: '두목 둘의 목을 가져오라.',
      reward: { exp: 900, gold: 2600, scroll: 'def60' } },

    { key: 'r_purse', name: '군량 조달', need: 9, repeat: true,
      goal: { type: 'gold', n: 4000 },
      desc: '금 사천을 마련해 보여라. (바쳐도 금은 줄지 않는다)',
      reward: { exp: 700, gold: 0, potion: 6 } },

    { key: 'r_forage', name: '약재 상납', need: 4, repeat: true,
      goal: { type: 'gather', n: 20 },
      desc: '어디서든 캔 것 스물을 바쳐라.',
      reward: { exp: 240, gold: 500, potion: 4 } },

    { key: 'r_talk', name: '민심 순회', need: 6, repeat: true,
      goal: { type: 'talk', n: 8 },
      desc: '아무 마을에서나 여덟 번 말을 걸어라.',
      reward: { exp: 300, gold: 600, potion: 3 } },

    /* 일일 사명(PLAN 33절) — 되받는 사명과 달리 **하루에 한 번**만 바칠 수 있다
       (quest.js 의 lastDoneDay 가 잠근다, repeat 는 그대로 true 라 목록에 남는다).
       매일 들어올 이유를 주는 자리라 되받는 사명보다 보상을 후하게 잡았다 */
    { key: 'd_hunt', name: '일일 토벌', need: 2, repeat: true, daily: true,
      goal: { type: 'kill', n: 20 },
      desc: '오늘 하루, 스무 마리를 베어라. 자정이 지나면 다시 받을 수 있다.',
      reward: { exp: 500, gold: 1500, potion: 2 } },

    { key: 'd_gather', name: '일일 채집', need: 2, repeat: true, daily: true,
      goal: { type: 'gather', n: 12 },
      desc: '오늘 하루, 무엇이든 캔 것 열둘을 바쳐라. 자정이 지나면 다시 받을 수 있다.',
      reward: { exp: 350, gold: 800, potion: 2 } }
  ];

  function find(key) {
    for (var i = 0; i < QUESTS.length; i++) { if (QUESTS[i].key === key) { return QUESTS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.questData = { QUESTS: QUESTS, find: find };
})(window);
