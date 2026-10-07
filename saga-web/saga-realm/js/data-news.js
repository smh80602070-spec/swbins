/**
 * 사가천하 — 영내 소식 열둘 (PLAN §5-15, W-0105 리뉴얼 ⑤-1 · 재미표준 E·D·G)
 * ---------------------------------------------------------------
 * 달을 넘기면 내 성 가운데 하나에서 소식이 뜬다 — 그 성 태수(없으면 그 성에서 가장 지혜로운 우리 사람)의 초상과
 * 한 줄, 그리고 **세 갈래(축 고정)**: 💡 금(util) · ⚔️ 병(atk) · 🛡️ 민심(def). 하나를 고르면 다른 둘은 못 얻는다.
 *
 * 규칙은 `event.js`(뉴스 원천 `news`)가 정한다 — 여기는 표뿐. 갈래 효과는 **있는 손잡이만**:
 *   gold  세력 금(+)      troops  그 성 병사(+)      train  그 성 훈련(+)      sec  그 성 치안·민심(+)
 * 민심(def) 갈래는 값이 안 든다(event.js 규칙 — 금 없는 판에서도 늘 하나는 고를 수 있게).
 *
 * 대사 두 벌 — [거친 말(용맹·호전), 점잖은 말]. 이름·말투는 전부 창작이다(실명 금지 — data-force.js 가명 체계).
 * `{city}` 는 성 이름으로 바뀐다.
 */
(function (global) {
  'use strict';

  var NEWS = [
    { key: 'harvest', name: '풍년 소식', emoji: '🌾', text: '{city} 들녘에 이삭이 무겁다. 거둔 것을 어디에 쓸까.',
      lines: ['곳간이 터지겠소! 이참에 칼 쥘 놈들을 더 먹입시다.', '하늘이 도왔습니다. 백성과 나누면 오래 기억할 것입니다.'],
      util: { label: '세금으로 거둔다', hint: '금 +400', gold: 400 },
      atk:  { label: '군량으로 돌려 병사를 늘린다', hint: '병사 +400', troops: 400 },
      def:  { label: '백성에게 돌려준다', hint: '치안 +8', sec: 8 } },
    { key: 'drought', name: '가뭄 걱정', emoji: '🌵', text: '{city} 우물이 마른다는 말이 돈다.',
      lines: ['물이 없으면 칼도 녹슬지. 병영 우물부터 지킵시다.', '가물 때 곳간을 열면 민심이 단단해집니다.'],
      util: { label: '물값을 받고 우물을 판다', hint: '금 +200', gold: 200 },
      atk:  { label: '병영 우물부터 지킨다', hint: '훈련 +6', train: 6 },
      def:  { label: '곳간 물을 나눈다', hint: '치안 +7', sec: 7 } },
    { key: 'bandit', name: '도적 출몰', emoji: '🗡️', text: '{city} 고갯길에 도적이 들끓는다.',
      lines: ['소굴째 쓸어버리고 놈들 중 쓸 만한 건 군에 넣겠소.', '길목을 지키고 달래면 대부분은 돌아올 것입니다.'],
      util: { label: '통행세를 걷어 경비를 산다', hint: '금 +250', gold: 250 },
      atk:  { label: '토벌해 항복한 자를 병사로', hint: '병사 +350 · 훈련 +2', troops: 350, train: 2 },
      def:  { label: '순찰을 늘리고 달랜다', hint: '치안 +6', sec: 6 } },
    { key: 'talent', name: '인재 소문', emoji: '📜', text: '{city} 저잣거리에 재주 있는 이가 숨어 산다는 말이 돈다.',
      lines: ['글 읽는 놈이든 칼 쓰는 놈이든 데려다 부려 봅시다.', '예를 갖춰 찾아가면 마음을 열 것입니다.'],
      util: { label: '장사 셈을 맡긴다', hint: '금 +300', gold: 300 },
      atk:  { label: '교관으로 앉힌다', hint: '훈련 +8', train: 8 },
      def:  { label: '서당을 열게 한다', hint: '치안 +5', sec: 5 } },
    { key: 'relic', name: '유물 발견', emoji: '🏺', text: '{city} 옛 터에서 오래된 그릇과 쇠붙이가 나왔다.',
      lines: ['쇠붙이는 녹여 창날로 쓰면 그만이오.', '제를 올리고 모셔 두면 성 사람들이 자랑으로 여길 것입니다.'],
      util: { label: '상단에 판다', hint: '금 +450', gold: 450 },
      atk:  { label: '녹여 병장기를 만든다', hint: '훈련 +5 · 병사 +150', train: 5, troops: 150 },
      def:  { label: '사당에 모신다', hint: '치안 +8', sec: 8 } },
    { key: 'plague', name: '역병 기미', emoji: '🦠', text: '{city} 몇 집에서 열병이 돈다.',
      lines: ['병영에 퍼지기 전에 아픈 놈들은 내보내시오!', '의원을 보내 집집이 돌보게 하소서.'],
      util: { label: '약재를 사들여 되판다', hint: '금 +250', gold: 250 },
      atk:  { label: '병영부터 막는다', hint: '훈련 +5', train: 5 },
      def:  { label: '의원을 집집이 보낸다', hint: '치안 +7', sec: 7 } },
    { key: 'market', name: '장터 호황', emoji: '🏮', text: '{city} 장터에 먼 데 상인까지 몰려든다.',
      lines: ['장사꾼 쌈짓돈으로 말과 창을 삽시다.', '장세를 낮추면 내년에 더 많이 옵니다.'],
      util: { label: '장세를 올린다', hint: '금 +500', gold: 500 },
      atk:  { label: '말과 병장기를 사들인다', hint: '병사 +300 · 훈련 +3', troops: 300, train: 3 },
      def:  { label: '장세를 낮춰 붙든다', hint: '치안 +6', sec: 6 } },
    { key: 'desert', name: '탈영 소문', emoji: '🏃', text: '{city} 병영에서 밤마다 몇씩 빠져나간다고 한다.',
      lines: ['붙잡아 다시 세우고 기강을 잡겠소.', '집이 그리운 자들입니다. 품삯을 올려 주면 남습니다.'],
      util: { label: '빈 자리 몫을 거둔다', hint: '금 +200', gold: 200 },
      atk:  { label: '붙잡아 다시 훈련한다', hint: '훈련 +7', train: 7 },
      def:  { label: '고향 소식을 전해 달랜다', hint: '치안 +5', sec: 5 } },
    { key: 'counsel', name: '충신의 간언', emoji: '🪶', text: '{city} 에서 쓴소리를 담은 글이 올라왔다.',
      lines: ['말보다 칼이 빠르오. 그래도 들을 건 들읍시다.', '쓴 말이 약이 됩니다. 귀를 열어 주십시오.'],
      util: { label: '재정을 바로잡는다', hint: '금 +350', gold: 350 },
      atk:  { label: '군율을 바로잡는다', hint: '훈련 +7', train: 7 },
      def:  { label: '부역을 덜어 준다', hint: '치안 +8', sec: 8 } },
    { key: 'border', name: '국경 다툼', emoji: '🚩', text: '{city} 경계에서 이웃 마을과 논두렁 다툼이 났다.',
      lines: ['한 번 밀어붙이면 다시는 못 넘볼 거요.', '양쪽 어른을 불러 화해시키면 됩니다.'],
      util: { label: '땅값을 받고 넘긴다', hint: '금 +300', gold: 300 },
      atk:  { label: '경계에 병사를 세운다', hint: '병사 +250 · 훈련 +3', troops: 250, train: 3 },
      def:  { label: '어른들을 불러 화해시킨다', hint: '치안 +6', sec: 6 } },
    { key: 'steed', name: '명마 발견', emoji: '🐎', text: '{city} 목장에서 바람처럼 달리는 말이 태어났다.',
      lines: ['저 말이면 기병 열을 이끌 수 있소!', '귀한 말이니 성 잔치에 내어 모두 보게 합시다.'],
      util: { label: '비싼 값에 판다', hint: '금 +450', gold: 450 },
      atk:  { label: '기병대 종마로 쓴다', hint: '훈련 +8', train: 8 },
      def:  { label: '잔치에 내어 자랑한다', hint: '치안 +6', sec: 6 } },
    /* 퓨전(§5-12 시간 틈 사람) — 다른 때에서 흘러든 이야기 */
    { key: 'rift', name: '시간 틈 소문', emoji: '🌀', text: '{city} 하늘에 금이 가고, 낯선 옷을 입은 이가 빛나는 도구를 놓고 사라졌다.',
      lines: ['저 번쩍이는 걸 무기로 쓸 수 있으면 좋겠소.', '두려워 말라 이르고, 그 물건은 잘 거두어 둡시다.'],
      util: { label: '낯선 도구를 상단에 판다', hint: '금 +500', gold: 500 },
      atk:  { label: '빛나는 도구로 조련한다', hint: '훈련 +6 · 병사 +200', train: 6, troops: 200 },
      def:  { label: '성 사람들을 안심시킨다', hint: '치안 +8', sec: 8 } }
  ];
  var AXES = ['util', 'atk', 'def'];
  var CHANCE = 0.12;            // 손잡이 rtk.newsChance — 달마다 성마다
  var ROUGH = { brave: 1, warlike: 1 };   // 이 특성이면 거친 말

  function byKey(k) { for (var i = 0; i < NEWS.length; i++) { if (NEWS[i].key === k) { return NEWS[i]; } } return null; }

  global.DG = global.DG || {};
  global.DG.newsData = { NEWS: NEWS, AXES: AXES, CHANCE: CHANCE, ROUGH: ROUGH, byKey: byKey };
})(window);
