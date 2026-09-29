/**
 * 시나리오 표 — 사가스토리 "이름 없는 떠돌이" (정본 `../../../scenario/saga-story.md`)
 * ---------------------------------------------------------------
 * 지금은 **1부 · 무명(과거 중심, Lv 1~10) 네 장**과 **2부 · 갈래(현대 중심, Lv 10~25) 네 장**, **3부 · 불길(미래 중심, Lv 25~45) 네 장**, **4부 · 난세의 문(세 시대 모두, Lv 45~70) 네 장**이 있다. 결말 뒤 **5부 · 문 너머(세 시대, Lv 72~76) 세 장**이 이어진다(사냥터 beyond_* 셋). 6부~는 이 표 끝에 장을 덧붙이면 된다.
 * 인물은 전부 가상이다(이름 정책) — 'me' 는 앞에 세운 도감 인물, 'mentor' 는 그 갈래의 스승(도감 가명).
 *
 * 한 장 = { id, no, title, stage, need, after, mix, steps, reward, blurb }
 *   need   열리는 레벨 · after  먼저 끝나야 하는 장 id
 *   mix    시대 섞기 — 과거·현대·미래가 **셋 다** 있어야 한다(시나리오 README §1-4, 진단이 지킨다)
 *   steps  차례대로 하나씩 — 아래 넷 중 하나
 *     { t: 'stage',   stage: 사냥터 key }           그 사냥터에 들어선다
 *     { t: 'talk',    scene: 장면 id, at?: key, by?: 고르기id }
 *                                                   대사 장면(at 이 있으면 그 사냥터 안에서만 뜬다). 장면에 `choice` 가 있으면 끝에서 고르기 단추가 뜬다.
 *                                                   `by` 가 있으면 그 고르기의 답에 따라 장면 id 는 `scene_답key`(예: name3_close)
 *     { t: 'mission', quest: 사명 key }             그 사명을 바친다(레벨이 되면 저절로 받는다)
 *     { t: 'job',     tier: 1 }                     n차 전직을 한다
 *     { t: 'gate',    stage: 사냥터 key }           그 마을 관문 대장을 이긴다(이긴 적이 있으면 그것으로 됨)
 *     { t: 'rift' }                                 비경(5층)을 이 단계가 시작된 뒤 한 번 끝까지 깬다
 *   legacy { level, tier }  옛 세이브 — 레벨이 그 이상이거나 전직이 tier 이상이면 이 장은 보상 없이 지나온 길로 본다
 *   reward { exp, gold, potion, scroll, memFrag, title }   memFrag = 비경 기억 조각(🧩)     title 'job' = "이름 없는 " + 방금 고른 직업 이름
 *
 * 장면 `choice: { id, prompt, options:[{ key, label, title? }] }` — 고른 답은 `save.scenario.choices[id]`, `title` 이 있으면 칭호가 된다.
 * 장면 한 줄 = [누가, 감정, 말] — `data-side.js` 의 STORY 와 같은 틀(EMOTES 키).
 */
(function (global) {
  'use strict';

  var CAST = {
    deokbo:  { name: '신야성 촌로 덕보', emoji: '🧓' },
    courier: { name: '택배 기사',        emoji: '📦' },
    sori:    { name: '척후병 소리',      emoji: '🐎' },
    mentor:  { name: '스승',            emoji: '🥋' },
    hankeot: { name: '여행자 한컷',      emoji: '📷' },
    ieum:    { name: '탐사 대원 이음',   emoji: '🧭' },
    townsman:{ name: '남정성 사람',      emoji: '🏮' },
    ashen:   { name: '잿빛 사자',        emoji: '🌫️' },
    gwijang: { name: '암굴 귀장',        emoji: '👹' },
    yakson:  { name: '의원 약손',        emoji: '⚕️' },
    lamp:    { name: '길잡이 등불이',    emoji: '🏮' }
  };

  var SCENES = {
    sinya1: { title: '제1장 · 서막', lines: [
      ['deokbo', 'worry', '성 밖이 도적 천지라네. 그런데 자네, 이름이 어떻게 되나?'],
      ['me', 'shock', '…기억나지 않습니다. 서쪽에서 걸어왔다는 것밖에는.'],
      ['deokbo', 'calm', '이름 없는 떠돌이라. 요즘은 그런 사람이 많지. 성 밖에서 주운 건데, 이 네모난 판이 자네 것인가? 만지면 불이 들어와.'],
      ['me', 'shock', '처음 봅니다. 그런데… 손에 익습니다.'],
      ['deokbo', 'worry', '도적 하나는 칼 대신 푸른 빛이 나는 검을 들었다더군. 예삿놈들이 아닐세.'],
      ['me', 'fire', '그럼 길부터 트겠습니다. 들판에서 열을 베고 오지요.']
    ] },
    sinya2: { title: '제1장 · 서막', lines: [
      ['deokbo', 'joy', '벌써 열을 베고 왔나! 이름 없는 손이 제일 빠르다더니.'],
      ['deokbo', 'calm', '허도로 가게. 장터에 없는 것이 없어. 신야성 밖 소식도 그리로 모이지.']
    ] },
    heodo1: { title: '제2장 · 허도 가는 길', lines: [
      ['courier', 'shock', '저기요! 이 짐, 주소가 없어요. 받는 이 칸에 옛 땅 이름만 잔뜩이고…'],
      ['courier', 'worry', '상자를 흔들면 푸른 빛이 지도처럼 펼쳐져요. 이런 길은 어디에도 없는데.'],
      ['me', 'calm', '길이 없어도 짐은 어디론가 가려던 것이겠지요. 저도 몸부터 갖춰야겠습니다.']
    ] },
    heodo2: { title: '제2장 · 허도 가는 길', lines: [
      ['courier', 'joy', '든든해 보이시네요! 저자가 이 근방에서 제일 큽니다. 부족하면 언제든 들르세요.'],
      ['courier', 'calm', '짐은… 제가 좀 더 헤매 보겠습니다. 들판 소식이 궁금하시면 척후병을 찾으세요.']
    ] },
    field1: { title: '제3장 · 허창 들판의 두목', lines: [
      ['sori', 'worry', '황건 두목의 진에 요즘 못 보던 병기가 들어갔소. 잿빛 떼쥐가 뛰고, 하늘엔 작은 눈알 같은 것이 뜨오.'],
      ['me', 'shock', '눈알 같은 것이라니, 정찰 짐승입니까?'],
      ['sori', 'anger', '짐승이 아니라 날아다니는 쇠붙이요. 들판을 비우지 않고는 두목 근처에도 못 가오.'],
      ['me', 'fire', '먼저 들판을 비우고, 그다음에 두목의 목을 보겠습니다.']
    ] },
    field2: { title: '제3장 · 허창 들판의 두목', lines: [
      ['sori', 'joy', '두목이 쓰러졌소! 진 한복판에서 푸른 빛 조각이 나왔는데, 누가 남긴 건지 모르겠소.'],
      ['me', 'worry', '누가 대 주지 않고서야 도적이 저런 병기를 가질 수 없지요.'],
      ['sori', 'calm', '이제 허도의 스승을 찾아가 보시오. 열 번은 넘게 해가 진 자라면 배울 자격이 있소.']
    ] },
    job1: { title: '제4장 · 첫 스승', lines: [
      ['mentor', 'calm', '이름 없는 자가 제일 빨리 배운다. 이름에 매여 있지 않으니까.'],
      ['mentor', 'fire', '저 표적지를 보아라. 누가 세웠는지 모르나, 이 땅의 것이 아닌 나무로 만들었다. 내 무기도 그렇다. 어느 시대 것인지 나도 모른다.'],
      ['mentor', 'calm', '🥋 무예창을 열어 네 길을 골라라. 무사·궁수·협객·방사 — 고른 길이 네 첫 이름이 된다.']
    ] },
    job2: { title: '제4장 · 첫 스승', lines: [
      ['mentor', 'joy', '골랐구나. 이제 너는 이름 없는 채로 한 갈래를 얻었다.'],
      ['mentor', 'calm', '동쪽 강릉진 부두에 쇠로 된 배가 걸려 있다더라. 그 배의 사진을 찍는 여행자가 있다지 — 만나 보아라.'],
      ['me', 'fire', '가겠습니다. 이름은 가는 길에서 찾지요.']
    ] },
    port1: { title: '제5장 · 강릉진 부두', lines: [
      ['hankeot', 'shock', '아, 마침 잘 오셨어요! 이 사진 좀 보세요. 부두에 쇠 화물선이 걸려 있는데, 배 뒤로 바다가 안 찍혀요. 텅 빈 하늘만요.'],
      ['me', 'shock', '옛 나루에 쇠로 된 배라니… 실물은 더 기이하겠군요.'],
      ['hankeot', 'worry', '조종실엔 푸른 빛 판이 깜박여요. 그 배를 차지한 게 왜구 선장인데, 부두 문지기 노릇을 하죠.'],
      ['me', 'fire', '선장부터 만나 보겠습니다. 문이 그 사람 손에 있다면요.']
    ] },
    port2: { title: '제5장 · 강릉진 부두', lines: [
      ['hankeot', 'joy', '선장이 쓰러졌어요! 쇠배 조종실 판에서 지도 같은 게 나왔는데요.'],
      ['me', 'calm', '이 나루도, 이 바다도 아닌 물길이 그려져 있습니다. 없는 바다의 지도군요.'],
      ['hankeot', 'worry', '지도 끝이 오림 숲 쪽을 가리켜요. 거기서 발소리가 자기 것만 들리지 않는다는 말이 돌고요.']
    ] },
    forest2: { title: '제6장 · 오림의 그늘', lines: [
      ['wanderer', 'worry', '그림자의 정체가 벼락 말벌 떼였다니… 나무에 박혀 서 있던 쇠 보행기도 봤소?'],
      ['me', 'calm', '경비를 서듯 서 있었습니다. 지키는 것이 무엇인지는 알 수 없고요.'],
      ['wanderer', 'calm', '남정성으로 가 보시오. 성 사람들이 무슨 소문을 알고 있소.']
    ] },
    nam2: { title: '제7장 · 민심을 살핀다', lines: [
      ['townsman', 'worry', '밤마다 굴 쪽에서 빛이 샌다오. 가로등 하나 없는 골목에 하나만 켜져 있고, 그 불빛이 굴 입구와 똑같은 색이오.'],
      ['me', 'shock', '가로등과 굴 입구의 빛이 한 줄기라는 말씀이십니까?'],
      ['townsman', 'anger', '위군 도독이 굴혈에 진을 친 뒤로 시작된 일이오. 누가 가서 좀 봐 주시오.'],
      ['me', 'fire', '길을 정했습니다. 굴혈로 가겠습니다.']
    ] },
    cave1: { title: '제8장 · 한중 굴혈', lines: [
      ['ieum', 'shock', '살았다… 도독 진 깊은 곳에 묶여 있었습니다. 저는 탐사 대원 이음, 먼 시대에서 문을 쫓아 왔습니다.'],
      ['ieum', 'worry', '이 땅의 전쟁에 다른 시대 병기가 섞이는 건 새어 든 것입니다. 동쪽 끝에 난세의 문이 있어요.'],
      ['me', 'fire', '문이라. 그렇다면 이름 없는 제 손에도 할 일이 있겠군요.'],
      ['ieum', 'joy', '마을마다 서 있겠습니다. 소식이 닿으면 어디서든 말을 거세요. 우선 둘째 스승부터 찾으세요.']
    ] },
    gisan1: { title: '제9장 · 기산채의 사자', lines: [
      ['guard', 'worry', '산채 두령이 요즘 빛이 나는 병기를 쥐고 있소. 창고엔 쇠 대롱이 쌓였는데, 그게 불을 뿜으면 활이 무슨 소용이오.'],
      ['ashen', 'calm', '…좋은 물건이오. 값만 치르면 누구 손에든 가지. 시대가 무슨 상관이겠소.'],
      ['me', 'shock', '잠깐! 방금 그 도포 차림이 발소리도 없이 사라졌습니다.'],
      ['guard', 'worry', '잿빛 사자라고들 하오. 두령이 누구에게 병기를 받는지 이제 알겠소.']
    ] },
    gisan2: { title: '제9장 · 기산채의 사자', lines: [
      ['guard', 'joy', '군자금이 모였소! 이걸로 산채 아래 길을 열 병량을 사겠소.'],
      ['me', 'anger', '잿빛 사자가 그 병기를 어디서 가져오는지 알아야 합니다. 이대로면 전쟁이 끝나지 않아요.'],
      ['guard', 'worry', '호로곡 쪽에서 불길이 올랐소. 그쪽이 더 급하오.']
    ] },
    gorge2: { title: '제10장 · 호로곡의 불길', lines: [
      ['yakson', 'worry', '부상병을 다 옮겼소. 이상한 일이 있었소 — 불길 속에서 강철 거인이 걸어 나왔는데 불이 붙지 않더이다.'],
      ['me', 'shock', '진압 특공대 같은 것들도 보았습니다. 이 땅의 전쟁이 아닙니다.'],
      ['yakson', 'calm', '적국 대장군의 갑주에도 푸른 빛 판이 박혀 있었소. 이음이라는 대원을 찾아가시오. 문 이야기를 아는 이요.']
    ] },
    lab1: { title: '제11장 · 비경의 기억', lines: [
      ['ieum', 'calm', '제 탐사 등으로 비경을 엽니다. 이 층들은 문이 남긴 기억의 껍질이에요. 돌 발판에 박힌 표지판이 보이면 다른 시대의 흔적입니다.'],
      ['ieum', 'worry', '5층 수호장을 쓰러뜨리면 잃어버린 조각이 나올지도 몰라요. 도중에 나가도 얻은 조각은 남습니다.'],
      ['me', 'fire', '제 이름이 없는 까닭이 거기 있다면 가야지요.']
    ] },
    lab2: { title: '제11장 · 비경의 기억', lines: [
      ['me', 'shock', '…기억났습니다. 저는 문 너머에서 왔어요. 문이 열릴 때 떨어져 이 땅에 나왔습니다.'],
      ['ieum', 'worry', '그래서 이름이 없었던 거군요. 문 너머에 두고 온 이름이 있을 겁니다.'],
      ['me', 'fire', '그 이름을 찾으러 문까지 가겠습니다. 잿빛 사자보다 먼저요.']
    ] },
    job31: { title: '제12장 · 셋째 스승', lines: [
      ['mentor+', 'calm', '네 이름은 문 너머에 두고 왔구나. 내 방 벽의 이 오래된 사진을 보아라 — 이 땅에서 찍을 수 없는 색이다.'],
      ['mentor+', 'fire', '내 칼날에 비친 것이 무엇이냐. 나도 오래 전에 문을 본 적이 있다. 이제 셋째 자리를 열어 주마.'],
      ['mentor+', 'calm', '🥋 무예창에서 3차 전직을 하여라.']
    ] },
    job32: { title: '제12장 · 셋째 스승', lines: [
      ['mentor', 'joy', '셋째 자리에 올랐다. 이제 네 손은 이름 없는 채로도 이 땅에서 가장 빠르다.'],
      ['mentor', 'worry', '잿빛 사자가 옛 도읍 낙양으로 갔다는 소문이다. 도포를 벗게 될 것이다 — 가서 확인하여라.'],
      ['me', 'fire', '다녀오겠습니다. 이름을 찾는 길이 그쪽에 있습니다.']
    ] },
    luoyang2: { title: '제13장 · 옛 도읍의 잿더미', lines: [
      ['ashen', 'anger', '…도포가 걸리적거리는군. 어차피 이 땅에서 오래 못 입을 옷이었다.'],
      ['me', 'shock', '당신이 폐도 흉장이었습니까! 무너진 궁궐 한복판에서 전철 소리가 났던 까닭이군요.'],
      ['ashen', 'calm', '병기를 대 준 것은 나요. 문이 열려 있는 한 어느 시대 물건이든 흘러오지. 잿더미 위 기계 갑주는 덤이었소.'],
      ['me', 'fire', '그럼 문 앞에서 다시 만납시다. 문을 닫으려는 사람이 여기 있으니까요.']
    ] },
    depth2: { title: '제14장 · 검각 깊이', lines: [
      ['ieum', 'calm', '여기부터는 빛이 안 닿습니다. 제 탐사 등을 앞세울게요.'],
      ['hankeot', 'joy', '조명은 제가 맡을게요! 암굴 석벽에 이 땅 것이 아닌 색이 번져 있어요. 사진 한 장만!'],
      ['me', 'calm', '석벽이 점점 따뜻해집니다. 문이 가까운가 봅니다.'],
      ['ieum', 'worry', '문 앞엔 귀장이 서 있을 거예요. 전쟁이 끝나지 않게 문을 연 자입니다.']
    ] },
    gate1: { title: '제15장 · 난세의 문', lines: [
      ['gwijang', 'anger', '전쟁이 끝나면 문도 닫히지… 그러니 끝나지 않게 했다. 옛 갑옷 속에 든 것은 사람이 아니다.'],
      ['me', 'anger', '그 때문에 수많은 시대가 이 땅에 새어 들었습니다. 이제 끝입니다.'],
      ['gwijang', 'shock', '문이 흔들린다…! 문 둘레의 전선이 무너진다. 이제 문은 네가 정해라.']
    ] },
    gate2: { title: '제15장 · 난세의 문', lines: [
      ['ieum', 'worry', '문이 흔들리며 빛 소용돌이가 일어요. 닫으면 새어 드는 시대도 멎지만 저는 제 시대로 돌아가야 해요.'],
      ['ieum', 'calm', '지키면 당신이 문지기가 됩니다. 문은 열린 채, 새어 드는 것을 막는 쪽이에요.'],
      ['me', 'fire', '이름 없는 제가, 이 문 앞에서 정합니다.']
    ], choice: { id: 'gate', prompt: '난세의 문을 어떻게 할 것인가',
      options: [{ key: 'close', label: '문을 닫는다' }, { key: 'keep', label: '문을 지킨다' }] } },
    name1: { title: '제16장 · 이름', lines: [
      ['mentor+', 'calm', '이름 없이 여기까지 왔구나. 마지막 자리다. 한컷의 사진 속 너는 이 땅의 사람이 아니더구나.'],
      ['mentor+', 'fire', '이음이 돌아갈 빛이 문 앞에서 기다린다. 서둘러 마지막 전직을 마쳐라.'],
      ['mentor+', 'calm', '🥋 무예창에서 4차 전직을 하여라.']
    ] },
    name2: { title: '제16장 · 이름', lines: [
      ['mentor', 'joy', '넷째 자리에 올랐다. 이제 이름을 붙일 때다. 남이 붙여 준 것 말고, 네가 붙이는 이름.'],
      ['me', 'calm', '문 너머에 두고 온 이름은 잃었지만, 이 땅에서 걸어온 길이 이름이 되겠습니다.']
    ], choice: { id: 'name', prompt: '스스로 붙일 칭호',
      options: [
        { key: 'found', label: '이름을 되찾은 자', title: '이름을 되찾은 자' },
        { key: 'wander', label: '문 너머의 나그네', title: '문 너머의 나그네' },
        { key: 'none', label: '이름 없이 걷는 자', title: '이름 없이 걷는 자' }] } },
    beyond1: { title: '제17장 · 문 너머 옛 전장', lines: [
      ['lamp', 'shock', '문 저편 땅이 온통 깃발 무덤이오. 어느 시대의 전장인지 표지 하나 없소.'],
      ['hankeot', 'worry', '사진기 초점이 자꾸 나가요. 여긴 시간이 겹쳐 찍혀요. 창 든 그림자와 총 든 그림자가 한자리에…'],
      ['me', 'calm', '문을 지키는 것은 문 이쪽만이 아니었군요. 넘어온 것이 있으면 넘어간 자리도 있겠지요.'],
      ['lamp', 'joy', '다음은 무너진 도시 쪽이오. 전철 소리 같은 것이 들리오.']
    ] },
    beyond2: { title: '제18장 · 문 너머 무너진 도심', lines: [
      ['hankeot', 'shock', '여기가… 도시였어요? 간판은 남았는데 글자가 다 거꾸로예요.'],
      ['lamp', 'calm', '신호등이 켜질 때마다 옛 전장에서 넘어온 그림자가 길을 건너오. 문이 이쪽과 저쪽을 자꾸 섞어 놓소.'],
      ['me', 'anger', '문이 열려 있는 한 섞임은 멈추지 않겠군요.'],
      ['hankeot', 'worry', '마지막 신호는 하늘에서 와요. 궤도 기지가 아직 깨어 있대요.']
    ] },
    beyond3_close: { title: '제19장 · 문 너머 궤도 기지', lines: [
      ['ieum', 'joy', '(기지 통신) 제 시대에서도 이 기지 불빛이 보여요! 문이 닫혔는데도 신호가 남아 있었어요.'],
      ['me', 'shock', '이곳에서 문 너머의 전부가 보입니다 — 옛 전장, 무너진 도시, 그리고 저 별.'],
      ['hankeot', 'calm', '찍었어요. 세 시대가 한 장에 담겼어요. 문 이쪽 사람들에게 보여 줄 거예요.'],
      ['me', 'fire', '닫은 문 저편이라도 잊지는 않겠습니다. 다음 길로 가지요.']
    ] },
    beyond3_keep: { title: '제19장 · 문 너머 궤도 기지', lines: [
      ['ieum', 'joy', '기지 등불이 켜졌어요! 제가 나고 자란 곳의 등불과 같은 색이에요. 문지기님, 여기까지 오셨군요.'],
      ['me', 'shock', '이곳에서 문 너머의 전부가 보입니다 — 옛 전장, 무너진 도시, 그리고 저 별.'],
      ['hankeot', 'calm', '찍었어요. 세 시대가 한 장에 담겼어요. 문 이쪽 사람들에게 보여 줄 거예요.'],
      ['me', 'fire', '문을 지키려면 저쪽을 알아야 하지요. 이제 알았습니다. 다음 길로 가지요.']
    ] },
    name3_close: { title: '제16장 · 이름', lines: [
      ['ieum', 'joy', '문이 닫혔으니 저는 제 시대로 돌아갑니다. 이 시대에 새어 든 것들은 남겠지만, 더는 늘지 않을 거예요.'],
      ['hankeot', 'joy', '마지막 사진이에요. 이름 없던 분이 웃고 있네요.'],
      ['me', 'fire', '이름은 얻었으니 남은 길은 제 발로 걷겠습니다. 고맙습니다, 두 분.']
    ] },
    name3_keep: { title: '제16장 · 이름', lines: [
      ['ieum', 'worry', '문지기가 되신다니… 저는 이 시대 소식을 문 너머에 전하겠습니다. 문은 열린 채, 당신이 지켜 주세요.'],
      ['hankeot', 'joy', '문 너머엔 다른 하늘이 있대요. 다음에 오면 사진 한 장만 부탁해요!'],
      ['me', 'fire', '이름은 얻었습니다. 문 너머 층이 열리는 날까지 이 자리를 지키겠습니다.']
    ] },
    cave2: { title: '제8장 · 한중 굴혈', lines: [
      ['mentor', 'calm', '이름 없는 채로 둘째 자리에 올랐구나. 이름이 없으니 남의 시대 기술도 그대로 배우는군.'],
      ['mentor', 'fire', '더 큰 불길이 기산채 쪽에서 오른다 한다. 다음 길은 스스로 정하되, 잿빛 자를 조심하라.'],
      ['me', 'fire', '명심하겠습니다. 이름을 얻을 때까지 걷겠습니다.']
    ] }
  };

  var CHAPTERS = [
    { id: 'p1_sinya', no: 1, title: '서막 · 신야성', stage: '신야성', need: 1, after: null,
      blurb: '이름을 묻는 촌로 앞에서 대답하지 못한다. 성 밖은 도적 천지다.',
      mix: { past: '성문·촌로', now: '성 밖에서 주운 휴대폰', future: '도적이 든 빛 칼' },
      legacy: { level: 10, tier: 1 },
      steps: [
        { t: 'stage', stage: 'sinya' },
        { t: 'talk', scene: 'sinya1', at: 'sinya' },
        { t: 'mission', quest: 'q_first' },
        { t: 'talk', scene: 'sinya2' }
      ],
      reward: { exp: 80, gold: 300 } },

    { id: 'p1_heodo', no: 2, title: '허도 가는 길', stage: '허도', need: 1, after: 'p1_sinya',
      blurb: '허도 장터의 택배 기사가 주소 없는 짐을 들고 헤맨다.',
      mix: { past: '허도 장터', now: '택배 기사', future: '짐 속 빛 지도' },
      legacy: { level: 10, tier: 1 },
      steps: [
        { t: 'stage', stage: 'heodo' },
        { t: 'talk', scene: 'heodo1', at: 'heodo' },
        { t: 'mission', quest: 'q_gear1' },
        { t: 'talk', scene: 'heodo2' }
      ],
      reward: { exp: 150, gold: 500, potion: 3 } },

    { id: 'p1_field', no: 3, title: '허창 들판의 두목', stage: '허창 들판', need: 1, after: 'p1_heodo',
      blurb: '척후병과 들판을 정찰한다. 황건 두목의 진에 다른 시대의 병기가 섞였다.',
      mix: { past: '황건적', now: '잿빛 떼쥐', future: '정찰 드론' },
      legacy: { level: 10, tier: 1 },
      steps: [
        { t: 'stage', stage: 'field' },
        { t: 'talk', scene: 'field1', at: 'field' },
        { t: 'mission', quest: 'q_field' },
        { t: 'mission', quest: 'q_boss1' },
        { t: 'talk', scene: 'field2' }
      ],
      reward: { exp: 400, gold: 1200, scroll: 'def100' } },

    { id: 'p1_job', no: 4, title: '첫 스승', stage: '허도', need: 10, after: 'p1_field',
      blurb: '허도의 스승에게 첫 전직을 배운다. "이름 없는 자가 제일 빨리 배운다."',
      mix: { past: '스승 도장', now: '연습용 표적지', future: '스승이 가진 시대 모를 무기' },
      steps: [
        { t: 'talk', scene: 'job1', at: 'heodo' },
        { t: 'job', tier: 1 },
        { t: 'talk', scene: 'job2' }
      ],
      legacy: { level: 10, tier: 1 },
      reward: { exp: 600, gold: 2000, title: 'job' } },

    { id: 'p2_port', no: 5, title: '강릉진 부두', stage: '강릉진', need: 10, after: 'p1_job',
      blurb: '부두에 쇠 화물선이 걸려 있다. 여행자 한컷의 사진 속 배는 "없는 바다"에 떠 있다.',
      mix: { past: '옛 나루', now: '쇠 화물선·한컷', future: '화물선 조종실 빛 판' },
      legacy: { level: 25, tier: 2 },
      steps: [
        { t: 'stage', stage: 'gangneungjin' },
        { t: 'talk', scene: 'port1', at: 'gangneungjin' },
        { t: 'gate', stage: 'gangneungjin' },
        { t: 'talk', scene: 'port2' }
      ],
      reward: { exp: 1200, gold: 3000, scroll: 'hp60' } },

    { id: 'p2_forest', no: 6, title: '오림의 그늘', stage: '오림 숲', need: 10, after: 'p2_port',
      blurb: '나그네가 "그림자를 조심하라" 한다. 그림자는 벼락 말벌 떼다.',
      mix: { past: '숲 사당', now: '벼락 말벌(변이 곤충)', future: '나무에 박힌 경비 보행기' },
      legacy: { level: 25, tier: 2 },
      steps: [
        { t: 'stage', stage: 'forest' },
        { t: 'mission', quest: 'q_forest' },
        { t: 'mission', quest: 'q_gather1' },
        { t: 'talk', scene: 'forest2' }
      ],
      reward: { exp: 1500, gold: 3000, potion: 8 } },

    { id: 'p2_namjeong', no: 7, title: '민심을 살핀다', stage: '남정성', need: 12, after: 'p2_forest',
      blurb: '성 사람들이 "밤마다 굴에서 빛이 샌다"고 한다.',
      mix: { past: '성 민가', now: '가로등 하나가 켜진 골목', future: '굴 입구 빛' },
      legacy: { level: 25, tier: 2 },
      steps: [
        { t: 'stage', stage: 'namjeongseong' },
        { t: 'mission', quest: 'q_talk1' },
        { t: 'mission', quest: 'q_job' },
        { t: 'talk', scene: 'nam2' }
      ],
      reward: { exp: 2000, gold: 4000, scroll: 'atk10' } },

    { id: 'p2_cave', no: 8, title: '한중 굴혈', stage: '한중 굴혈', need: 25, after: 'p2_namjeong',
      blurb: '위군 도독의 진 깊은 곳에서 탐사 대원 이음을 구한다. 둘째 스승에게 2차 전직을 배운다.',
      mix: { past: '위군 진', now: '굴 속 발전기', future: '이음·탐사 장비' },
      steps: [
        { t: 'stage', stage: 'cave' },
        { t: 'mission', quest: 'q_cave' },
        { t: 'talk', scene: 'cave1' },
        { t: 'job', tier: 2 },
        { t: 'talk', scene: 'cave2' }
      ],
      legacy: { level: 25, tier: 2 },
      reward: { exp: 4000, gold: 8000, title: 'job' } },

    { id: 'p3_gisan', no: 9, title: '기산채의 사자', stage: '기산채', need: 25, after: 'p2_cave',
      blurb: '산채 두령에게 빛 병기를 대 주는 잿빛 사자가 나타났다 사라진다.',
      mix: { past: '산채', now: '산채 창고 기관총', future: '빛 병기·잿빛 사자' },
      legacy: { level: 45, tier: 3 },
      steps: [
        { t: 'stage', stage: 'gisanchae' },
        { t: 'talk', scene: 'gisan1', at: 'gisanchae' },
        { t: 'mission', quest: 'q_gold1' },
        { t: 'talk', scene: 'gisan2' }
      ],
      reward: { exp: 8000, gold: 10000, scroll: 'def60' } },

    { id: 'p3_gorge', no: 10, title: '호로곡의 불길', stage: '호로곡', need: 25, after: 'p3_gisan',
      blurb: '골짜기 전체가 탄다. 의원 약손과 부상병을 옮기고 적국 대장군을 친다.',
      mix: { past: '의원·약초', now: '진압 특공대', future: '불길 속 강철 거신' },
      legacy: { level: 45, tier: 3 },
      steps: [
        { t: 'stage', stage: 'gorge' },
        { t: 'mission', quest: 'q_gorge' },
        { t: 'mission', quest: 'q_cinder' },
        { t: 'mission', quest: 'q_gorge_boss' },
        { t: 'talk', scene: 'gorge2' }
      ],
      reward: { exp: 20000, gold: 15000, potion: 15 } },

    { id: 'p3_labyrinth', no: 11, title: '비경의 기억', stage: '비경', need: 30, after: 'p3_gorge',
      blurb: '이음이 여는 5층 비경. 관문 수호장을 치면 잃은 기억 조각이 나온다 — 떠돌이도 문에서 떨어졌다.',
      mix: { past: '비경 돌 발판', now: '발판에 박힌 표지판', future: '기억 조각 홀로그램' },
      legacy: { level: 45, tier: 3 },
      steps: [
        { t: 'talk', scene: 'lab1' },
        { t: 'rift' },
        { t: 'talk', scene: 'lab2' }
      ],
      reward: { exp: 30000, gold: 20000, memFrag: 3 } },

    { id: 'p3_job', no: 12, title: '셋째 스승', stage: '허도', need: 45, after: 'p3_labyrinth',
      blurb: '허도의 스승이 "네 이름은 문 너머에 두고 왔구나" 하며 3차 전직을 준다.',
      mix: { past: '스승', now: '스승의 오래된 사진', future: '스승의 칼에 비친 문' },
      legacy: { level: 45, tier: 3 },
      steps: [
        { t: 'talk', scene: 'job31', at: 'heodo' },
        { t: 'job', tier: 3 },
        { t: 'talk', scene: 'job32' }
      ],
      reward: { exp: 40000, gold: 30000, title: 'job' } },

    { id: 'p4_luoyang', no: 13, title: '옛 도읍의 잿더미', stage: '낙양 옛터', need: 45, after: 'p3_job',
      blurb: '잿빛 사자가 도포를 벗는다 — 옛 도읍을 쥔 폐도 흉장이다.',
      mix: { past: '무너진 궁궐', now: '잿더미 속 전철', future: '흉장의 기계 갑주' },
      legacy: { level: 70, tier: 4 },
      steps: [
        { t: 'stage', stage: 'ruin' },
        { t: 'mission', quest: 'q_ruin' },
        { t: 'mission', quest: 'q_ruin_boss' },
        { t: 'talk', scene: 'luoyang2' }
      ],
      reward: { exp: 40000, gold: 30000, potion: 20 } },

    { id: 'p4_depth', no: 14, title: '검각 깊이', stage: '검각 암굴', need: 70, after: 'p4_luoyang',
      blurb: '빛이 닿지 않는 깊이. 이음과 한컷이 문 앞까지 길을 비춘다.',
      mix: { past: '암굴 석벽', now: '한컷의 조명', future: '이음의 탐사 등' },
      legacy: { level: 70, tier: 4 },
      steps: [
        { t: 'stage', stage: 'deepcave' },
        { t: 'mission', quest: 'q_deep' },
        { t: 'talk', scene: 'depth2' }
      ],
      reward: { exp: 70000, gold: 50000, scroll: 'def60' } },

    { id: 'p4_gate', no: 15, title: '난세의 문', stage: '검각 암굴 끝', need: 70, after: 'p4_depth',
      blurb: '암굴 귀장 — 전쟁이 끝나지 않게 문을 연 자. 쓰러뜨리면 문이 흔들린다. 닫을지 지킬지 정한다.',
      mix: { past: '귀장의 옛 갑옷', now: '문 둘레 전선', future: '문의 빛 소용돌이' },
      legacy: { level: 70, tier: 4 },
      steps: [
        { t: 'mission', quest: 'q_deep_boss' },
        { t: 'talk', scene: 'gate1' },
        { t: 'talk', scene: 'gate2' }
      ],
      reward: { exp: 120000, gold: 100000, scroll: 'hp10' } },

    { id: 'p4_name', no: 16, title: '이름', stage: '허도', need: 70, after: 'p4_gate',
      blurb: '넷째 스승이 마지막 전직을 준다. 떠돌이는 스스로 칭호를 고른다.',
      mix: { past: '스승', now: '한컷의 마지막 사진', future: '이음이 돌아가는 빛' },
      legacy: { level: 70, tier: 4 },
      steps: [
        { t: 'talk', scene: 'name1', at: 'heodo' },
        { t: 'job', tier: 4 },
        { t: 'talk', scene: 'name2' },
        { t: 'talk', scene: 'name3', by: 'gate' }
      ],
      reward: { exp: 200000, gold: 150000, title: 'job' } },

    /* 5부 · 문 너머(결말 뒤, Lv72~) — 이음·한컷과 문 너머 길잡이 등불이와 함께 문 저편 세 시대를 차례로 걷는다. 사냥터는 data-side.js beyond_* */
    { id: 'p5_past', no: 17, title: '문 너머 옛 전장', stage: '문 너머 옛 전장', need: 72, after: 'p4_name',
      blurb: '문 저편 첫째 땅 — 깃발 무덤 위에 창 든 그림자와 총 든 그림자가 겹쳐 선다.',
      mix: { past: '깃발 무덤의 옛 창병', now: '한컷의 초점 나간 사진기', future: '그림자 속 총 든 병사' },
      steps: [
        { t: 'stage', stage: 'beyond_past' },
        { t: 'mission', quest: 'q_beyond1' },
        { t: 'mission', quest: 'q_beyond1_boss' },
        { t: 'talk', scene: 'beyond1' }
      ],
      reward: { exp: 300000, gold: 220000, potion: 30 } },

    { id: 'p5_now', no: 18, title: '문 너머 무너진 도심', stage: '문 너머 무너진 도심', need: 74, after: 'p5_past',
      blurb: '문 저편 둘째 땅 — 거꾸로 쓴 간판 아래 신호등이 켜질 때마다 그림자가 길을 건넌다.',
      mix: { past: '건너오는 옛 그림자', now: '거꾸로 쓴 간판과 신호등', future: '하늘에서 오는 마지막 신호' },
      steps: [
        { t: 'stage', stage: 'beyond_now' },
        { t: 'mission', quest: 'q_beyond2' },
        { t: 'mission', quest: 'q_beyond2_boss' },
        { t: 'talk', scene: 'beyond2' }
      ],
      reward: { exp: 400000, gold: 280000, scroll: 'atk10' } },

    { id: 'p5_future', no: 19, title: '문 너머 궤도 기지', stage: '문 너머 궤도 기지', need: 76, after: 'p5_now',
      blurb: '문 저편 마지막 땅 — 깨어 있는 궤도 기지에서 세 시대가 한 장에 담긴다.',
      mix: { past: '기지 창밖의 옛 전장', now: '한컷이 찍은 한 장', future: '이음이 나고 자란 기지 등불' },
      steps: [
        { t: 'stage', stage: 'beyond_future' },
        { t: 'mission', quest: 'q_beyond3' },
        { t: 'mission', quest: 'q_beyond3_boss' },
        { t: 'talk', scene: 'beyond3', by: 'gate' }
      ],
      reward: { exp: 600000, gold: 400000, scroll: 'hp10' } }
  ];

  /** 장면에 달린 고르기를 id 로 찾는다 */
  function choiceOf(id) {
    for (var k in SCENES) {
      if (Object.prototype.hasOwnProperty.call(SCENES, k) && SCENES[k].choice && SCENES[k].choice.id === id) { return SCENES[k].choice; }
    }
    return null;
  }

  function chapter(id) {
    for (var i = 0; i < CHAPTERS.length; i++) { if (CHAPTERS[i].id === id) { return CHAPTERS[i]; } }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.scenarioData = { CAST: CAST, SCENES: SCENES, CHAPTERS: CHAPTERS, chapter: chapter, choiceOf: choiceOf };
})(window);
