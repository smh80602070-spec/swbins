/**
 * 시나리오 표 — 사가블로 "이름이 지워지는 나라" (정본 `../../../scenario/saga-dungeon.md`)
 * ---------------------------------------------------------------
 * 1막 · 중원의 난(과거)·2막 · 잿빛과 소금(현대)·3막 · 불타는 남쪽(미래+신화)·4막 · 모래와 눈과 고철·5막 · 이름 없는 곳 — 다섯 막 열여섯 장 + 결말 뒤 6막 · 비석 너머 세 장이 있다.
 * 카드의 defend(태양로 제어반)·climb(케이블카)·duel(무명왕 세 단계)·31층 새 명소 층은 새 시스템이 있어야 해서 만들지 않고 이야기 장면으로 대신했다(정본 트랙 메모). 6막~은 이 표 끝에 장을 덧붙이면 된다.
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
 *     { t: 'region',   key }                  큰 지도에서 그 지역에 처음 발을 들인다(사연 사슬이 열린 것으로 봄)
 *   talk 단계의 `by: 고르기id` — 그 고르기의 답에 따라 장면 id 가 `scene_답key`(안 골랐으면 첫 갈래)
 *   legacy { floor }   옛 세이브 — 최고 층이 그 이상이면 이 장은 보상 없이 지나온 길로 본다
 *   reward { exp, gold, feat, title }   title = 칭호(문자열)
 *
 * 장면 `choice: { id, prompt, options:[{ key, label, reward? }] }` — 마지막 줄 뒤에 고르기 단추가 뜬다. 답은 `save.scenario.choices[id]`, `reward` 는 고른 즉시 준다.
 * 장면 한 줄 = [누가, 말] — 누가 = 'me' 또는 CAST 키.
 */
(function (global) {
  'use strict';

  var CAST = {
    mukhyang: { name: '사관 묵향',        emoji: '📜' },
    gyogyo:   { name: '교두',             emoji: '🥋' },
    yeoldusi: { name: '시간 여행자 열두시', emoji: '⌛' },
    guard:    { name: '벌판 역참지기',    emoji: '🏮' },
    danchu:   { name: '고물 줍는 아이 단추', emoji: '🧒' },
    boatman:  { name: '염전 늙은 뱃사공', emoji: '🚣' },
    lord:     { name: '망루성 성주의 망령', emoji: '👑' },
    soyeon:   { name: '떠돌이 퇴마사 소연', emoji: '🔮' },
    mechanic: { name: '개척지 정비공',    emoji: '🔧' },
    mumyeong: { name: '이름을 삼키는 목소리', emoji: '🌑' },
    caravan:  { name: '대상 우두머리',    emoji: '🐫' },
    cable:    { name: '케이블카 기사',    emoji: '🚡' },
    kkik:     { name: '수리 로봇 끽',     emoji: '🤖' },
    taoist:   { name: '사당지기 도사',    emoji: '☁️' }
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
    fac1: { title: '제4장 · 멈춘 공장의 심장', lines: [
      ['danchu', '아저씨, 공장 굴뚝에서 쇠 긁는 소리가 밤새 나요. 무서워서 못 가겠어요. 고물을 주우러 가야 하는데.'],
      ['me', '공장 아래에 옛 성벽이 있다더군요. 방역복 차림의 누가 폐도시를 훑고 다닌다는 말도 들었습니다.'],
      ['danchu', '맞아요, 회색 옷 입은 이들이 있어요. 공장의 심장이 굴혈로 이어진 관이래요. 부탁이에요!']
    ] },
    fac2: { title: '제4장 · 멈춘 공장의 심장', lines: [
      ['danchu', '소리가 멎었어요! 폭주룡도 없어졌고요. 고철을 한 아름 주웠어요.'],
      ['me', '공장 심장의 관은 굴혈로 이어져 있었습니다. 굴혈의 이름 먹는 소리와 같은 결이더군요.'],
      ['danchu', '이 고물 상점은 아저씨께 드릴게요. 필요한 부품이 있을 거예요.']
    ] },
    tide1: { title: '제5장 · 물 빠진 바다의 노래', lines: [
      ['boatman', '썰물 때마다 갯벌 밑에서 무언가 운다오. 배가 셋이나 사라졌소. 바다가 이름을 부르며 물러갔다고들 하지.'],
      ['me', '녹슨 관측탑이 갯벌 한가운데 서 있다지요. 실험실 장갑을 두른 것들도 보입니다.'],
      ['boatman', '뱃노래 가락이 갯벌 밑에서 되돌아 나오는 밤이 있소. 촉수왕이 그걸 흉내 내는 것 같소.']
    ] },
    tide2: { title: '제5장 · 물 빠진 바다의 노래', lines: [
      ['boatman', '밀물이 제 소리로 돌아왔소. 소금 한 섬을 받아 주시오.'],
      ['me', '갯벌이 부르던 이름은 결국 배 셋의 사공들 이름이었습니다. 이제 그 이름이 굴혈에 남는 일은 없겠지요.'],
      ['gyogyo', '망루성 성주가 이름을 잃어 성을 떠나지 못한다는 소문이오. 10층으로 내려가 보시오.']
    ] },
    fort1: { title: '제6장 · 무너진 망루성', lines: [
      ['lord', '내… 이름이 무엇이었더냐. 비상등만 깜박이는 성문 앞에서 수백 해를 서 있었다. 투구 속의 이 기계 눈은 누가 심었느냐.'],
      ['mukhyang', '제 기록에 남은 성주의 이름을 찾았습니다. 돌려주면 망령이 성을 떠나겠지만, 이름을 봉인하면 성이 그 갑주를 내놓을 것입니다.'],
      ['me', '이름을 돌려줄지, 봉인할지 — 결정은 제가 하겠습니다.']
    ], choice: { id: 'fort', prompt: '성주의 이름을 어떻게 할 것인가',
      options: [{ key: 'restore', label: '이름을 돌려준다', reward: { feat: 30 } }, { key: 'seal', label: '이름을 봉인한다', reward: { gold: 3000 } }] } },
    fort2_restore: { title: '제6장 · 무너진 망루성', lines: [
      ['lord', '이제 기억난다. 그 이름을 내 것이라 부르니 가슴이 가볍다. 성을 떠나마. 네게 가호를 남긴다.'],
      ['mukhyang', '이름 하나가 돌아왔습니다. 굴혈이 삼킨 이름들 중 하나를 되찾은 셈이지요.']
    ] },
    fort2_seal: { title: '제6장 · 무너진 망루성', lines: [
      ['lord', '이름을 빼앗겼지만… 성을 지킬 갑주는 남는군. 가져가라, 이 조각을.'],
      ['mukhyang', '봉인된 이름은 제 기록에 따로 적어 두겠습니다. 어떤 결정이든 기록은 남습니다.']
    ] },
    rg1: { title: '제7장 · 갈라진 땅의 문지기', lines: [
      ['soyeon', '떠돌이 퇴마사 소연이오. 균열은 무명혈의 곁가지요. 문지기 겁옥이 그 문을 지키며 이름을 걸러 내고 있소.'],
      ['me', '균열에 버스 한 대가 떨어져 있었습니다. 안에는 아무도 없고 창문마다 별바다 손님들이 매달려 있더군요.'],
      ['soyeon', '시대 손님이오. 문이 열리는 대로 다른 시대의 것이 끼어들지. 봉인비 앞에서 문지기를 상대해 주시오.']
    ] },
    rg2: { title: '제7장 · 갈라진 땅의 문지기', lines: [
      ['soyeon', '봉인비에 새 글자가 새겨졌소. 균열이 멈췄고 부적 던전도 열 수 있게 되었소. 이 부적을 받으시오.'],
      ['mukhyang', '문지기의 창끝에도 이름이 없었습니다. 겁옥이라는 이름조차 누군가에게서 빌린 듯했지요.']
    ] },
    sf1: { title: '제8장 · 과열된 태양로', lines: [
      ['mechanic', '태양로 온도가 계속 올라요. 발전 설비도 미쳐 날뛰고, 거신 하나가 로 한복판에 선 채 움직이지 않아요. 개척지 우물 곁에 천막을 쳤는데 밤마다 뜨겁습니다.'],
      ['me', '균열의 열을 먹고 폭주하는군요. 제어반 근처까지 무리를 몰아내겠습니다.']
    ] },
    sf2: { title: '제8장 · 과열된 태양로', lines: [
      ['mechanic', '태양판 위로 다시 새가 앉았어요! 개척지에 불이 들어왔습니다.'],
      ['me', '거신의 등에서 굴혈로 이어지는 관을 보았습니다. 이 열도 굴혈에서 온 것이더군요.']
    ] },
    bw1: { title: '제9장 · 흑풍 산채', lines: [
      ['mukhyang', '15층에 흑풍 산채가 있습니다. 채주는 이름을 팔아 힘을 샀다고 합니다. 무전기와 총포까지 갖췄다는 소문이에요.'],
      ['me', '경비 보행기가 산채 앞에 서 있는 것도 보았습니다. 도적들이 다른 시대의 것을 산 셈이군요.']
    ] },
    bw2: { title: '제9장 · 흑풍 산채', lines: [
      ['mukhyang', '채주가 쓰러졌습니다. 그의 이름은 채주가 되기 전에 지워졌더군요. 굴혈이 이름을 사 간 것입니다.'],
      ['me', '한 사람의 이름이 아니라, 이름이 팔리는 장사가 있었던 것입니다.']
    ] },
    pal1: { title: '제10장 · 가라앉은 용궁', lines: [
      ['mukhyang', '20층은 물에 잠긴 용궁입니다. 용궁 기와 아래로 잠수 장비의 잔해가 흩어져 있고, 수압 돔이 반쯤 남아 있다고 합니다.'],
      ['me', '용궁지기를 상대해야 아래로 갈 수 있겠지요. 내려가 보겠습니다.']
    ] },
    pal2: { title: '제10장 · 가라앉은 용궁', lines: [
      ['mumyeong', '…이름을 다오. 너도 이름이 있지 않으냐. 나는 그것을 먹으며 자랐다. 이름을 다오.'],
      ['me', '누구냐! 바닥에서 목소리가 들립니다. 이름을 먹는다고?'],
      ['mukhyang', '무명혈의 주인입니다. 이 굴혈 전체가 그의 몸이었어요. 기록을 서둘러야 합니다.']
    ] },
    car1: { title: '제11장 · 끊긴 대상 길', lines: [
      ['caravan', '서역 길목이 막힌 지 석 달째요. 낙타도 짐도 돌아오지 않소. 모래에 트럭이 박혀 있고 묻힌 유적 속에서는 빛 문이 열려 있다는 말도 있소.'],
      ['me', '모래바다 폭군이 길을 막고 있다지요. 대상 길부터 열겠습니다.']
    ] },
    car2: { title: '제11장 · 끊긴 대상 길', lines: [
      ['caravan', '방울 소리가 다시 들리오! 비단 한 필을 남기고 가겠소. 이 길이 열렸으니 더 많은 이름이 돌아올 게요.']
    ] },
    snow1: { title: '제12장 · 산성의 거한', lines: [
      ['cable', '산성 폐허에 누가 눌러앉아 케이블카가 끊겼어요. 골짜기가 고립됐습니다. 칸 안에 커다란 손자국이 얼어붙어 있었고요.'],
      ['me', '케이블카를 다시 돌려 산성으로 오르겠습니다. 거한이 있다면 그 자리에서 만나지요.']
    ] },
    snow2: { title: '제12장 · 산성의 거한', lines: [
      ['cable', '케이블카가 다시 움직여요! 골짜기에 불빛이 켜졌습니다.'],
      ['me', '거한의 몸에 냉각관이 박혀 있었습니다. 산 위의 눈은 이 땅의 것이 아니었군요.']
    ] },
    scr1: { title: '제13장 · 스스로 일어선 고철', lines: [
      ['kkik', '끽… 제 이름은 끽입니다. 쓰러진 기계들이 하나씩 사라져요. 누군가 모으고 있어요. 저는 제 이름을 꽉 붙잡아서 멀쩡합니다.'],
      ['me', '이름을 먹고 일어선 기계라면 고철 거신이겠군요. 옛 감시탑 곁으로 가 보겠습니다.']
    ] },
    scr2: { title: '제13장 · 스스로 일어선 고철', lines: [
      ['kkik', '황무지의 기계들이 잠들었어요. 이제 나사 한 줌을 드릴게요. 저도 함께 갈래요. 이름을 지키는 법을 알려 드릴 수 있어요.'],
      ['me', '든든한 동행이 생겼습니다. 마을에서 수리도 부탁드리겠습니다.']
    ] },
    hg1: { title: '제14장 · 업화 대문', lines: [
      ['mukhyang', '25층 업화 대문입니다. 돌기둥에 경고 표지판이 붙어 있고, 문지기의 기계 팔이 문을 지킵니다. 문 너머는 천계로 이어져 있다지요.'],
      ['me', '경고 표지판은 어느 시대 글자로 쓰여 있었습니다. 문 너머가 두렵지만 가야겠습니다.']
    ] },
    hg2: { title: '제14장 · 업화 대문', lines: [
      ['mukhyang', '문이 열렸습니다. 이제 천계 사당이 눈앞입니다. 마지막 막이 다가옵니다.'],
      ['me', '이름이 돌아오는 날까지 걷겠습니다.']
    ] },
    hv1: { title: '제15장 · 칼을 든 수호장', lines: [
      ['taoist', '하늘 사당의 수호장이 사당을 버렸소. 그 칼끝이 이제 우리를 향하오. 비석에 빛이 꺼지고 엘리베이터도 무너졌소.'],
      ['me', '수호장은 무명왕에게 이름을 판 첫 장수라 들었습니다. 구름 위 금궐까지 올라가겠습니다.']
    ] },
    hv2: { title: '제15장 · 칼을 든 수호장', lines: [
      ['taoist', '비석에 빛이 돌아왔소. 구주를 평정한 이는 그대가 되겠구려.'],
      ['mukhyang', '타락 천장군이 쓰러졌습니다. 이제 남은 것은 이름을 먹는 자 하나입니다. 무명왕이 눈앞에 있습니다.']
    ] },
    nl1: { title: '제16장 · 이름 없는 곳', lines: [
      ['mumyeong', '어서 오라. 내가 먹은 이름들이 세 시대의 모습으로 나를 지킨다 — 장수, 폭주족, 기계. 너도 이름을 내놓으라.'],
      ['me', '지워진 이름은 돌려받겠습니다. 비석 숲에 이름을 되돌리는 것이 제 일입니다.'],
      ['mukhyang', '제 기록에 적은 이름이 모두 이곳에 있습니다. 하나씩 되찾읍시다.']
    ] },
    nl2_restore: { title: '제16장 · 이름 없는 곳', lines: [
      ['mumyeong', '…이름들이 돌아간다. 비석이 다시 글자를 얻는구나.'],
      ['lord', '내 이름도 돌아왔으니 이 싸움에 함께하겠다. 성을 떠나 네 곁에 서리라.'],
      ['mukhyang', '기록이 끝났습니다. 지워졌던 비석의 이름이 모두 되돌아왔어요. 당신은 이름을 찾은 자입니다.']
    ] },
    nl2_seal: { title: '제16장 · 이름 없는 곳', lines: [
      ['mumyeong', '…이름들이 돌아간다. 비석이 다시 글자를 얻는구나.'],
      ['mukhyang', '봉인했던 망루성 성주의 이름은 제 기록에 따로 남겨 두었습니다. 다 돌려주지는 못했지만 대부분 되돌렸어요.'],
      ['me', '기록은 남았고 굴혈은 조용해졌습니다. 저는 이름을 찾은 자로 남겠습니다.']
    ] },
    /* ── 6막 · 비석 너머 (정본 "결말 뒤 · 다음 막 자리") — 되돌아온 이름 가운데 주인이 없는 이름 하나가 새 틈을 연다 ── */
    or1: { title: '제17장 · 주인 없는 이름', lines: [
      ['mukhyang', '이상합니다. 이름은 모두 돌아왔는데 비석 한 구석에 글자가 하나 남았어요. 어느 기록에도 없는 이름입니다.'],
      ['danchu', '이 글자, 도시 잔해 조각에도 새겨져 있었어요! 주인이 없는 이름이라 어디에도 돌려줄 데가 없대요.'],
      ['me', '주인 없는 이름이 비석 아래 새 틈을 열고 있군요. 굴혈을 더 내려가 보겠습니다.']
    ] },
    or2: { title: '제17장 · 주인 없는 이름', lines: [
      ['kkik', '삐걱— 32층 지도에 없는 문. 문틀에는 빛 기둥의 글자가, 문짝에는 비석 숲의 이끼가 붙어 있어요.'],
      ['mukhyang', '이름 하나가 세 시대를 다 건너와 이 문 앞에 섰다는 뜻이겠지요. 기록해 두겠습니다.'],
      ['me', '문 너머에 주인을 찾아 주러 가겠습니다.']
    ] },
    fd1: { title: '제18장 · 갈대나루의 새 틈', lines: [
      ['boatman', '갈대나루에 밤마다 배 없는 노 소리가 난다오. 노 젓는 이가 누구든 이름이 없으니 물이 대답을 안 해.'],
      ['soyeon', '틈이 나루터까지 번졌어요. 이름 없는 노꾼이 배를 저어 시대를 건너다니고 있더군요.'],
      ['me', '굴혈 34층에 그 노꾼의 배가 정박해 있을 것 같습니다. 내려가 보겠습니다.']
    ] },
    fd2: { title: '제18장 · 갈대나루의 새 틈', lines: [
      ['kkik', '34층 물가에서 배 한 척 발견! 뱃머리에 새겨진 글자를 스캔했어요 — 도시 잔해 조각의 그 글자와 같은 획이에요.'],
      ['boatman', '내 늙은 눈에도 알겠소. 저 노꾼은 이름을 잃은 게 아니라 이름을 지키려고 스스로 지운 사람이오.'],
      ['mukhyang', '그렇다면 마지막 문 너머에서 이름을 되돌려 줄 수 있습니다.']
    ] },
    bd1: { title: '제19장 · 비석 너머', lines: [
      ['mumyeong', '(작은 목소리로) 내가 삼킨 이름 중에 삼켜지지 않은 하나가 있었다. 그 이름이 내 뱃속에서 문을 열었지.'],
      ['me', '삼킨 이름을 지키려는 이름이 있었다는 말이군요.'],
      ['soyeon', '문 너머 36층에 그가 기다려요. 이번에는 싸우러가 아니라 이름을 돌려주러 가는 길이에요.']
    ] },
    bd2: { title: '제19장 · 비석 너머', lines: [
      ['taoist', '비석 너머에도 비석이 있었구려. 그 위에 글자를 새기는 이는 늘 새 이름을 얻는다 하오.'],
      ['danchu', '제가 새겨 봐도 돼요? …이름은 "이 땅을 걸어온 사람"으로 하래요!'],
      ['mukhyang', '주인 없던 이름이 주인을 얻었습니다. 기록을 맺겠습니다 — 당신은 비석 너머의 이름입니다.']
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
      reward: { exp: 200, gold: 1500, feat: 20 } },

    { id: 'a2_factory', no: 4, title: '멈춘 공장의 심장', stage: '잿빛 폐도시', need: 0, after: 'a1_tomb',
      blurb: '단추의 부탁 — 멈춘 공장 굴뚝에서 폭주룡이 난다. 공장 심장은 굴혈로 이어진 관이다.',
      mix: { past: '공장 밑 옛 성벽', now: '공장·급수탑·단추', future: '방역복 추적자' },
      legacy: { floor: 7 },
      steps: [
        { t: 'region', key: 'neon' },
        { t: 'talk', scene: 'fac1' },
        { t: 'chain', key: 'neon' },
        { t: 'talk', scene: 'fac2' }
      ],
      reward: { exp: 300, gold: 2500 } },

    { id: 'a2_tideflat', no: 5, title: '물 빠진 바다의 노래', stage: '소금 개펄', need: 0, after: 'a2_factory',
      blurb: '염전 늙은 뱃사공이 "바다가 이름을 부르며 물러갔다"고 한다. 녹슨 관측탑 아래 촉수왕.',
      mix: { past: '염전·뱃노래', now: '녹슨 관측탑', future: '실험실 장갑벌' },
      legacy: { floor: 8 },
      steps: [
        { t: 'region', key: 'saltmarsh' },
        { t: 'talk', scene: 'tide1' },
        { t: 'chain', key: 'saltmarsh' },
        { t: 'talk', scene: 'tide2' }
      ],
      reward: { exp: 400, gold: 3500 } },

    { id: 'a2_watchtower', no: 6, title: '무너진 망루성', stage: '굴혈 6~10층', need: 0, after: 'a2_tideflat',
      blurb: '10층 성주의 망령은 제 이름을 잃어 성을 떠나지 못한다. 묵향의 기록에서 이름을 찾아 줄지 고른다.',
      mix: { past: '망루성·성주', now: '성 안 비상등·철문', future: '성주 투구에 박힌 기계 눈' },
      legacy: { floor: 10 },
      steps: [
        { t: 'floor', n: 10 },
        { t: 'talk', scene: 'fort1' },
        { t: 'landmark', key: 'fort' },
        { t: 'talk', scene: 'fort2', by: 'fort' }
      ],
      reward: { exp: 600, gold: 5000, feat: 30 } },

    { id: 'a3_riftgate', no: 7, title: '갈라진 땅의 문지기', stage: '지옥 균열', need: 0, after: 'a2_watchtower',
      blurb: '퇴마사 소연이 쫓던 문지기 겁옥 — 균열은 무명혈의 곁가지.',
      mix: { past: '퇴마사·부적', now: '균열에 떨어진 버스', future: '균열 속 별바다 손님' },
      legacy: { floor: 11 },
      steps: [{ t: 'region', key: 'hellgate' }, { t: 'talk', scene: 'rg1' }, { t: 'chain', key: 'hellgate' }, { t: 'talk', scene: 'rg2' }],
      reward: { exp: 900, gold: 8000 } },

    { id: 'a3_sunfurnace', no: 8, title: '과열된 태양로', stage: '태양 신도시', need: 0, after: 'a3_riftgate',
      blurb: '개척지 정비공 — 태양로가 균열의 열을 먹고 폭주한다.',
      mix: { past: '개척지 우물·천막', now: '발전 설비', future: '태양로 거신' },
      legacy: { floor: 13 },
      steps: [{ t: 'region', key: 'solar' }, { t: 'talk', scene: 'sf1' }, { t: 'chain', key: 'solar' }, { t: 'talk', scene: 'sf2' }],
      reward: { exp: 1100, gold: 9000 } },

    { id: 'a3_blackwind', no: 9, title: '흑풍 산채', stage: '굴혈 11~15층', need: 0, after: 'a3_sunfurnace',
      blurb: '15층 흑풍 채주 — 도적 떼가 이름을 팔아 힘을 샀다.',
      mix: { past: '산채 도적', now: '채주의 무전기·총포', future: '경비 보행기' },
      legacy: { floor: 15 },
      steps: [{ t: 'talk', scene: 'bw1' }, { t: 'floor', n: 15 }, { t: 'landmark', key: 'bandit' }, { t: 'talk', scene: 'bw2' }],
      reward: { exp: 1300, gold: 10000, feat: 40 } },

    { id: 'a3_palace', no: 10, title: '가라앉은 용궁', stage: '굴혈 16~20층', need: 0, after: 'a3_blackwind',
      blurb: '20층 용궁지기를 치자 바닥에서 처음으로 목소리가 들린다 — "이름을 다오".',
      mix: { past: '용궁 기와', now: '잠수 장비 잔해', future: '수압 돔' },
      legacy: { floor: 20 },
      steps: [{ t: 'talk', scene: 'pal1' }, { t: 'floor', n: 20 }, { t: 'landmark', key: 'palace' }, { t: 'talk', scene: 'pal2' }],
      reward: { exp: 1600, gold: 12000, feat: 50 } },

    { id: 'a4_caravan', no: 11, title: '끊긴 대상 길', stage: '서역 모랫길', need: 0, after: 'a3_palace',
      blurb: '대상 우두머리 — 모래가 묻힌 유적째 대상 길을 삼켰다.',
      mix: { past: '대상·묻힌 유적', now: '모래에 박힌 트럭', future: '유적 속 빛 문' },
      legacy: { floor: 21 },
      steps: [{ t: 'region', key: 'silkroad' }, { t: 'talk', scene: 'car1' }, { t: 'chain', key: 'silkroad' }, { t: 'talk', scene: 'car2' }],
      reward: { exp: 2000, gold: 15000 } },

    { id: 'a4_snowfort', no: 12, title: '산성의 거한', stage: '북방 설산', need: 0, after: 'a4_caravan',
      blurb: '케이블카 기사 — 멈춘 케이블카를 다시 돌려 산성으로.',
      mix: { past: '산성 폐허', now: '케이블카', future: '거한 몸의 냉각관' },
      legacy: { floor: 22 },
      steps: [{ t: 'region', key: 'snowfort' }, { t: 'talk', scene: 'snow1' }, { t: 'chain', key: 'snowfort' }, { t: 'talk', scene: 'snow2' }],
      reward: { exp: 2200, gold: 17000 } },

    { id: 'a4_scrap', no: 13, title: '스스로 일어선 고철', stage: '기계 황무지', need: 0, after: 'a4_snowfort',
      blurb: '수리 로봇 끽 — 고철 거신은 이름을 먹고 일어선 기계다. 끽은 제 이름을 지켜 멀쩡하다.',
      mix: { past: '황무지 옛 감시탑', now: '기계 더미·폐차', future: '홀로그램 표지·끽' },
      legacy: { floor: 23 },
      steps: [{ t: 'region', key: 'scrap' }, { t: 'talk', scene: 'scr1' }, { t: 'chain', key: 'scrap' }, { t: 'talk', scene: 'scr2' }],
      reward: { exp: 2400, gold: 20000 } },

    { id: 'a4_hellgate', no: 14, title: '업화 대문', stage: '굴혈 21~25층', need: 0, after: 'a4_scrap',
      blurb: '25층 업화 문지기 — 문 너머가 천계로 이어진다.',
      mix: { past: '지옥문 돌기둥', now: '문에 걸린 경고 표지판', future: '문지기의 기계 팔' },
      legacy: { floor: 25 },
      steps: [{ t: 'talk', scene: 'hg1' }, { t: 'floor', n: 25 }, { t: 'landmark', key: 'hellgate' }, { t: 'talk', scene: 'hg2' }],
      reward: { exp: 2800, gold: 25000, feat: 60 } },

    { id: 'a5_heaven', no: 15, title: '칼을 든 수호장 · 구름 위 금궐', stage: '천계 사당 · 굴혈 26~30층', need: 0, after: 'a4_hellgate',
      blurb: '사당지기 도사의 사슬을 끝내고 30층 금궐 — 타락 천장군은 무명왕에게 이름을 판 첫 장수.',
      mix: { past: '사당·도사', now: '사당 안 무너진 엘리베이터', future: '홀로그램 비석' },
      legacy: { floor: 30 },
      steps: [{ t: 'talk', scene: 'hv1' }, { t: 'chain', key: 'heaven' }, { t: 'floor', n: 30 }, { t: 'landmark', key: 'heaven' }, { t: 'talk', scene: 'hv2' }],
      reward: { exp: 4000, gold: 40000, feat: 100 } },

    { id: 'a5_nameless', no: 16, title: '이름 없는 곳', stage: '굴혈 끝', need: 0, after: 'a5_heaven',
      blurb: '무명왕 — 먹은 이름들이 세 시대 모습으로 번갈아 나온다. 지워졌던 비석 이름이 되돌아온다. (31층 전투는 아직 없다 — 이야기로 맺는다)',
      mix: { past: '비석 숲', now: '도시 잔해 조각', future: '빛 기둥' },
      steps: [{ t: 'talk', scene: 'nl1' }, { t: 'talk', scene: 'nl2', by: 'fort' }],
      reward: { exp: 8000, gold: 80000, feat: 200, title: '이름을 찾은 자' } },

    /* 6막 · 비석 너머(결말 뒤) — 굴혈이 31층 너머로 이어진다. 새 명소 층은 만들지 않고 최고 층으로 센다 */
    { id: 'a6_orphan', no: 17, title: '주인 없는 이름', stage: '굴혈 32층', need: 0, after: 'a5_nameless',
      blurb: '이름은 모두 돌아왔는데 비석 한 구석에 어느 기록에도 없는 글자가 남았다. 그 이름이 새 틈을 연다.',
      mix: { past: '비석 구석의 낯선 글자', now: '도시 잔해 조각의 같은 글자', future: '문틀의 빛 기둥 글자' },
      steps: [{ t: 'talk', scene: 'or1' }, { t: 'floor', n: 32 }, { t: 'talk', scene: 'or2' }],
      reward: { exp: 10000, gold: 100000, feat: 150 } },

    { id: 'a6_ford', no: 18, title: '갈대나루의 새 틈', stage: '굴혈 34층', need: 0, after: 'a6_orphan',
      blurb: '밤마다 배 없는 노 소리가 나는 갈대나루. 이름 없는 노꾼은 이름을 잃은 것이 아니라 지키려고 지운 사람이다.',
      mix: { past: '뱃사공의 옛 노 소리', now: '퇴마사의 부적', future: '수리 로봇의 스캔' },
      steps: [{ t: 'talk', scene: 'fd1' }, { t: 'floor', n: 34 }, { t: 'talk', scene: 'fd2' }],
      reward: { exp: 12000, gold: 120000, feat: 150 } },

    { id: 'a6_beyond', no: 19, title: '비석 너머', stage: '굴혈 36층', need: 0, after: 'a6_ford',
      blurb: '삼켜지지 않은 이름이 문 너머에서 기다린다. 싸우러 가는 길이 아니라 이름을 돌려주러 가는 길.',
      mix: { past: '비석 위의 비석', now: '아이가 새긴 이름', future: '문 너머 빛 기둥' },
      steps: [{ t: 'talk', scene: 'bd1' }, { t: 'floor', n: 36 }, { t: 'talk', scene: 'bd2' }],
      reward: { exp: 16000, gold: 160000, feat: 250, title: '비석 너머의 이름' } }
  ];

  /** 장면에 달린 고르기를 id 로 찾는다 */
  function choiceOf(id) {
    for (var k in SCENES) {
      if (Object.prototype.hasOwnProperty.call(SCENES, k) && SCENES[k].choice && SCENES[k].choice.id === id) { return SCENES[k].choice; }
    }
    return null;
  }

  var ACTS = { 1: '1막 · 중원의 난', 2: '2막 · 잿빛과 소금', 3: '3막 · 불타는 남쪽', 4: '4막 · 모래와 눈과 고철', 5: '5막 · 이름 없는 곳', 6: '6막 · 비석 너머' };
  function actOf(ch) { return Number(String(ch.id).charAt(1)) || 1; }

  function chapter(id) {
    for (var i = 0; i < CHAPTERS.length; i++) { if (CHAPTERS[i].id === id) { return CHAPTERS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.scenarioData = { CAST: CAST, SCENES: SCENES, CHAPTERS: CHAPTERS, ACTS: ACTS, actOf: actOf, chapter: chapter, choiceOf: choiceOf };
})(window);
