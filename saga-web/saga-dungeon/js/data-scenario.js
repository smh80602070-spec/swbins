/**
 * 시나리오 표 — 사가블로 "이름이 지워지는 나라" (정본 `../../../scenario/saga-dungeon.md`)
 * ---------------------------------------------------------------
 * 지금은 **1막 · 중원의 난(과거 중심, 굴혈 1~5층) 세 장**만 있다. 2막~은 이 표 끝에 장을 덧붙이면 된다.
 * 인물은 전부 가상이다(이름 정책) — 'me' 는 부대 선두 인물(도감 가명)이다.
 *
 * 한 장 = { id, no, title, stage, need, after, mix, steps, reward, blurb, legacy? }
 *   mix   시대 섞기 — 과거·현대·미래가 **셋 다** 있어야 한다(시나리오 README §1-4, 진단이 지킨다)
 *   steps 차례대로 하나씩 — 아래 여섯 중 하나
 *     { t: 'talk',     scene: 장면 id }        대사 장면 — **마을에 있을 때만** 뜬다(굴혈 안에선 다음에)
 *     { t: 'kill',     n }                    몬스터를 이 단계가 시작된 뒤 n 마리
 *     { t: 'floor',    n }                    굴혈 n 층에 닿는다(최고 층)
 *     { t: 'chain',    key }                  그 지역 사연 사슬을 평정한다(quest.js 의 chain)
 *     { t: 'landmark', key }                  그 명소 층(FIXED)을 한 번 답파한다
 *     { t: 'rescue',   n }                    갇힌 인물을 이 단계가 시작된 뒤 n 번 구한다
 *   legacy { floor }   옛 세이브 — 최고 층이 그 이상이면 이 장은 보상 없이 지나온 길로 본다
 *   reward { exp, gold, feat }
 *
 * 장면 한 줄 = [누가, 말] — 누가 = 'me' 또는 CAST 키.
 */
(function (global) {
  'use strict';

  var CAST = {
    mukhyang: { name: '사관 묵향',        emoji: '📜' },
    gyogyo:   { name: '교두',             emoji: '🥋' },
    yeoldusi: { name: '시간 여행자 열두시', emoji: '⌛' },
    guard:    { name: '벌판 역참지기',    emoji: '🏮' }
  };

  var SCENES = {
    moru1: { title: '제1장 · 모루골 부임', lines: [
      ['mukhyang', '부임 첫날부터 황건 떼가 마을 어귀를 쳤습니다. 다행히 담이 버텼지요. 저는 이 마을 사관 묵향입니다.'],
      ['me', '기와 담 너머로 이상한 것이 지나갔습니다. 하늘을 나는 작은 쇠 눈알 같은 것이요.'],
      ['mukhyang', '정찰 드론이라 하더군요. 택배 기사 손님이 짐을 떨어뜨리고 도망갔는데, 그 짐도 이 시대 것이 아니었습니다.'],
      ['mukhyang', '그보다 큰일이 있습니다. 요즘 죽은 이들의 이름이 비석에서 지워집니다. 굴혈 쪽에서 시작된 일입니다. 우선 어귀의 무리부터 쓸어 주십시오.']
    ] },
    moru2: { title: '제1장 · 모루골 부임', lines: [
      ['mukhyang', '어귀가 조용해졌습니다. 무리의 창끝에 쓰인 글자 하나 없는 것을 보셨습니까? 이름을 모르는 병사들이었습니다.'],
      ['me', '굴혈이 저 아래에 열려 있다고 하셨지요. 첫 층을 보고 오겠습니다.']
    ] },
    moru3: { title: '제1장 · 모루골 부임', lines: [
      ['me', '첫 층에 닿았습니다. 벽에 이름 자국이 긁혀 있었는데, 누가 새겼다 지운 듯했습니다.'],
      ['mukhyang', '굴혈이 사람들의 이름을 먹고 있다는 소문이 사실인가 봅니다. 이 기록을 잇는 것이 제 일입니다. 더 내려가시면 제가 적겠습니다.'],
      ['gyogyo', '거기 새 부임자. 교두 노릇을 맡은 늙은이요. 벌판의 흑기 도적부터 정리하시오. 결사의 비석도 그다음에 알려 주겠소.']
    ] },
    flag1: { title: '제2장 · 흑기 도적의 밤', lines: [
      ['guard', '벌판 역참을 밤마다 검은 깃발 무리가 턴다오. 그 깃발에는 이름 하나 적혀 있지 않소. 대장의 갑옷에는 빛나는 문양이 박혀 있다는 소문도 있고.'],
      ['me', '폭주하는 젊은이들까지 도적 편에 붙었다지요. 이 벌판부터 잠재우겠습니다.']
    ] },
    flag2: { title: '제2장 · 흑기 도적의 밤', lines: [
      ['guard', '흑기 대장이 쓰러졌소! 이제 수레가 다시 다니겠소.'],
      ['gyogyo', '결사비가 열렸소. 결사로 들어서면 한 번 죽으면 끝이라, 각오가 있어야 하오.'],
      ['me', '깃발에 이름이 없던 까닭은 결국 알 수 없었습니다. 굴혈 안에 답이 있을 것 같습니다.']
    ] },
    tomb1: { title: '제3장 · 순장 왕릉', lines: [
      ['mukhyang', '굴혈 다섯째 층에는 옛 왕릉이 있습니다. 순장된 병사들이 아직도 칼을 쥐고 서 있다지요. 가장 안쪽 현실에 녹슨 장군이 있습니다.'],
      ['me', '왕릉의 벽마다 도굴꾼의 손전등 자국이 남아 있었습니다. 누군가 먼저 드나든 흔적입니다.'],
      ['mukhyang', '그 벽에 새 이름을 적는 빛 비석이 있다는 이야기도 들었습니다. 잘 살펴봐 주십시오.']
    ] },
    tomb2: { title: '제3장 · 순장 왕릉', lines: [
      ['yeoldusi', '살았다! 저는 시간 여행자 열두시입니다. 이 굴혈의 구멍은 우리 시대 지도에 없습니다 — 무명혈이라 불리는 지도에 없는 구멍이죠.'],
      ['me', '지도에 없는 구멍이라니. 이 땅의 이름을 먹는 것과 관계가 있습니까?'],
      ['yeoldusi', '있습니다. 이름이 지워진 곳은 앞날의 기록에서도 지워지지요. 더 깊은 곳에서 그 주인이 이름을 모으고 있을 겁니다.'],
      ['mukhyang', '기록해 두겠습니다. 1막은 여기까지입니다. 이름이 지워지는 나라의 끝을 함께 찾아봅시다.']
    ] }
  };

  var CHAPTERS = [
    { id: 'a1_moru', no: 1, title: '모루골 부임', stage: '모루골', need: 0, after: null,
      blurb: '부임 첫날 황건 떼가 마을 어귀를 친다. 사관 묵향이 "죽은 이들 이름이 비석에서 지워진다"고 털어놓는다.',
      mix: { past: '황건적·기와 마을', now: '택배 기사 손님이 떨어뜨린 짐', future: '정찰 드론' },
      legacy: { floor: 1 },
      steps: [
        { t: 'talk', scene: 'moru1' },
        { t: 'kill', n: 10 },
        { t: 'talk', scene: 'moru2' },
        { t: 'floor', n: 1 },
        { t: 'talk', scene: 'moru3' }
      ],
      reward: { exp: 60, gold: 300 } },

    { id: 'a1_blackflag', no: 2, title: '흑기 도적의 밤', stage: '중원 벌판', need: 0, after: 'a1_moru',
      blurb: '벌판 역참지기의 부탁으로 흑기 대장을 친다. 대장의 깃발에도 이름이 없다.',
      mix: { past: '흑기 도적·역참', now: '도적 편에 붙은 폭주 청년', future: '대장 갑옷의 빛 문양' },
      legacy: { floor: 3 },
      steps: [
        { t: 'talk', scene: 'flag1' },
        { t: 'chain', key: 'jungwon' },
        { t: 'talk', scene: 'flag2' }
      ],
      reward: { exp: 100, gold: 800 } },

    { id: 'a1_tomb', no: 3, title: '순장 왕릉', stage: '굴혈 1~5층', need: 0, after: 'a1_blackflag',
      blurb: '5층 왕릉의 녹슨 순장장군. 갇힌 시간 여행자 열두시가 "이 구멍은 미래 지도에 없다"고 말한다.',
      mix: { past: '순장 왕릉', now: '도굴꾼 손전등·굴착기', future: '빛 비석·시간 여행자' },
      legacy: { floor: 5 },
      steps: [
        { t: 'talk', scene: 'tomb1' },
        { t: 'floor', n: 5 },
        { t: 'landmark', key: 'tomb' },
        { t: 'rescue', n: 1 },
        { t: 'talk', scene: 'tomb2' }
      ],
      reward: { exp: 200, gold: 1500, feat: 20 } }
  ];

  function chapter(id) {
    for (var i = 0; i < CHAPTERS.length; i++) { if (CHAPTERS[i].id === id) { return CHAPTERS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.scenarioData = { CAST: CAST, SCENES: SCENES, CHAPTERS: CHAPTERS, chapter: chapter };
})(window);
