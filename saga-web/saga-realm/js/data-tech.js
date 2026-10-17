/**
 * 5천하 — 기술 나무 표 (W-0290, 문명·AoE 식 — 구조만, 이름·수치는 우리 것)
 * ---------------------------------------------------------------
 * 네 갈래(농·상·군·학) × 여섯 마디. 갈래 안에서는 **차례대로**만 연구한다(앞 마디가 문).
 *   stats  경륜도(statecraft.sum)와 같은 키 — goldPct·foodPct·govPct·plotPct·defPct·atkPct·troopPct·wallPct·hirePct·diploPct·expPct
 *   cost   { order, mul } — 그 내정 명령의 금 비용 배율(조선 -20% 등, rtk.order 가 tech.cost 로 묻는다)
 *   rule   'study' 연구점 +1/달 · 'wonder' 불가사의 문(학 3마디 — wonder.why 가 tech.wonderOpen 으로 묻는다)
 *   pts    마디 값(연구점) — 6·9·12·16·20·25
 */
(function (global) {
  'use strict';

  var PTS = [6, 9, 12, 16, 20, 25];
  var BRANCHES = [
    { key: 'farm',  name: '농', emoji: '🌾', desc: '군량과 백성', nodes: [
      { id: 'f1', name: '물꼬 트기',   desc: '군량 +5%',            stats: { foodPct: 5 } },
      { id: 'f2', name: '두벌 갈이',   desc: '군량 +5%',            stats: { foodPct: 5 } },
      { id: 'f3', name: '둔전 두기',   desc: '징병 성과 +5%',       stats: { troopPct: 5 } },
      { id: 'f4', name: '큰 곳간',     desc: '군량 +10%',           stats: { foodPct: 10 } },
      { id: 'f5', name: '향약 세우기', desc: '내정 +5%',            stats: { govPct: 5 } },
      { id: 'f6', name: '물레방아',    desc: '군량 +10%',           stats: { foodPct: 10 } }
    ] },
    { key: 'trade', name: '상', emoji: '🪙', desc: '금과 길', nodes: [
      { id: 't1', name: '저자 열기',   desc: '금 수입 +5%',         stats: { goldPct: 5 } },
      { id: 't2', name: '나루 짓기',   desc: '조선 비용 -20%',      cost: { order: 'ships', mul: 0.8 } },
      { id: 't3', name: '되 맞추기',   desc: '금 수입 +5%',         stats: { goldPct: 5 } },
      { id: 't4', name: '객주 두기',   desc: '등용 +10%',           stats: { hirePct: 10 } },
      { id: 't5', name: '소금 길',     desc: '금 수입 +10%',        stats: { goldPct: 10 } },
      { id: 't6', name: '먼 장사',     desc: '외교 +10%',           stats: { diploPct: 10 } }
    ] },
    { key: 'mil',   name: '군', emoji: '⚔️', desc: '창과 성벽', nodes: [
      { id: 'm1', name: '창 갈기',     desc: '공격 +4%',            stats: { atkPct: 4 } },
      { id: 'm2', name: '돌 성벽',     desc: '축성 성과 +10%',      stats: { wallPct: 10 } },
      { id: 'm3', name: '조련 틀',     desc: '훈련 비용 -20%',      cost: { order: 'train', mul: 0.8 } },
      { id: 'm4', name: '방패 벽',     desc: '수비 +5%',            stats: { defPct: 5 } },
      { id: 'm5', name: '쇠뇌 틀',     desc: '공격 +6%',            stats: { atkPct: 6 } },
      { id: 'm6', name: '군적 정리',   desc: '징병 성과 +10%',      stats: { troopPct: 10 } }
    ] },
    { key: 'learn', name: '학', emoji: '📜', desc: '글과 꾀', nodes: [
      { id: 'l1', name: '서당 열기',   desc: '내정 +5%',            stats: { govPct: 5 } },
      { id: 'l2', name: '글 모으기',   desc: '연구점 +1/달',        rule: 'study' },
      { id: 'l3', name: '큰 도면',     desc: '불가사의를 지을 수 있다', rule: 'wonder' },
      { id: 'l4', name: '꾀주머니',    desc: '계략 성공률 +5%',     stats: { plotPct: 5 } },
      { id: 'l5', name: '무장 교습',   desc: '경험 +10%',           stats: { expPct: 10 } },
      { id: 'l6', name: '태학 세우기', desc: '내정 +10% · 계략 +5%', stats: { govPct: 10, plotPct: 5 } }
    ] }
  ];
  BRANCHES.forEach(function (b) { b.nodes.forEach(function (n, i) { n.branch = b.key; n.pts = PTS[i]; n.idx = i; }); });

  /** AI 성향 → 갈래 차례 */
  var CREED_ORDER = {
    aggressive: ['mil', 'farm', 'trade', 'learn'],
    turtle:     ['farm', 'mil', 'learn', 'trade'],
    balanced:   ['trade', 'learn', 'farm', 'mil']
  };

  var BASE_PTS = 1, SCHOLAR_WIS = 85, SCHOLAR_MAX = 4;   // 달마다 1 + 지력 85 이상 무장(학자) 수(넷까지)

  global.DG = global.DG || {};
  global.DG.techData = { PTS: PTS, BRANCHES: BRANCHES, CREED_ORDER: CREED_ORDER, BASE_PTS: BASE_PTS, SCHOLAR_WIS: SCHOLAR_WIS, SCHOLAR_MAX: SCHOLAR_MAX,
    branch: function (k) { for (var i = 0; i < BRANCHES.length; i++) { if (BRANCHES[i].key === k) { return BRANCHES[i]; } } return null; },
    node: function (id) { for (var i = 0; i < BRANCHES.length; i++) { for (var j = 0; j < BRANCHES[i].nodes.length; j++) { if (BRANCHES[i].nodes[j].id === id) { return BRANCHES[i].nodes[j]; } } } return null; } };
})(window);
