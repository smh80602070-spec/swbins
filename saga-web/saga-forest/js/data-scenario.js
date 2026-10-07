/**
 * 시나리오 표 — 사가마을 "하늘 금 우체통" (정본 `../../../scenario/saga-forest.md`)
 * ---------------------------------------------------------------
 * 지금은 **봄 · 옛 우체통(과거 중심) 네 장**과 **여름 · 금으로 온 손님들(현대 중심) 네 장**, **가을 · 앞날의 기록(미래 중심) 네 장**, **겨울 · 이어진 숲(세 시대) 네 장** — 사계절 열여섯 장 전부가 있다. 다음 계절은 이 표 끝에 장을 덧붙이면 된다.
 * 그 뒤 **둘째 해 봄 · 우체통의 답장 네 장**(결말 뒤, 손님은 호연)과 **둘째 해 여름 · 사진첩의 답장 네 장**(손님은 찰나)·**가을 · 앞날의 답장 네 장**(손님은 루미)·**겨울 · 이어 쓰는 숲 네 장**이 이어져 둘째 해 열여섯 장이 된다.
 * 싸움도 실패도 없다 — 장은 "하루에 조금씩" 크기고, 단계는 며칠에 걸쳐도 된다.
 * 인물은 전부 가상이다(이름 정책) — 'me' 는 마을 주인공(내 아바타 인물의 도감 가명).
 *
 * 한 장 = { id, no, season, title, stage, after, mix, steps, reward, blurb }
 *   mix   시대 섞기 — 과거·현대·미래가 **셋 다** 있어야 한다(시나리오 README §1-4, 진단이 지킨다)
 *   steps 차례대로 하나씩 — 아래 여덟 중 하나
 *     { t: 'talk',    scene: 장면 id }            대사 장면(글 상자) — 마을 어디서나
 *     { t: 'place',   n }                        집에 가구를 n 개 놓는다(가구는 처음 주는 기본 한 벌로 된다)
 *     { t: 'deliver', n }                        택배를 이 단계 시작 뒤 n 번 배달한다(접수대 ↔ 배달원)
 *     { t: 'forest',  key }                      그 이름 있는 숲에 든다
 *     { t: 'go',      spot }                     그 고정 자리(ruin 폐허·waterfall 폭포·spacebase 우주기지·cave 동굴 안)에 선다
 *     { t: 'bug',     n }                        곤충을 이 단계 시작 뒤 n 마리 잡는다
 *     { t: 'fish',    n }                        물고기를 이 단계 시작 뒤 n 마리 낚는다
 *     { t: 'cave',    n }                        동굴에 이 단계 시작 뒤 n 번 들어선다(폭포 뒤 굴 대신 기존 동굴)
 *     { t: 'settle',  n }                        방문 손님을 n 명 마을에 눌러앉게 한다(손님과 정이 쌓여야 해서 며칠 걸릴 수 있다)
 *     { t: 'gather',  cat, n }                   그 갈래(flower 꽃…)를 이 단계 시작 뒤 n 번 채집한다
 *     { t: 'fest',    key }                      그 행사 놀이를 올해 끝낸다 — 그날이 아니면 **기념 놀이**로 열어 준다(실제 달력을 기다리지 않는다)
 *     { t: 'heart',   n }                        주민·인물 누구든 하트 n 이상
 *     { t: 'donate',  cat, n }                   사고에 그 갈래(fossil 화석…)를 n 점 기증해 채운다
 *   talk 단계의 `by: 고르기id` — 그 고르기의 답에 따라 장면 id 가 `scene_답key`(안 골랐으면 첫 갈래)
 *   reward { gold, exp, feat, title }   title = 칭호(문자열)
 *
 * 장면 \`choice: { id, prompt, options:[{ key, label }] }\` — 마지막 줄 뒤 고르기 단추. 답은 \`save.village.scenario.choices[id]\`.
 * 장면 한 줄 = [누가, 말] — 누가 = 'me' 또는 CAST 키.
 */
(function (global) {
  'use strict';

  var CAST = {
    keeper:  { name: '숲지기 솔바람',    emoji: '🌲' },
    dareum:  { name: '택배 기사 달음',   emoji: '📦' },
    hoyeon:  { name: '여우 화상 호연',   emoji: '🦊' },
    k7:      { name: '시간 여행자 K-7',  emoji: '⌛' },
    pungnang:{ name: '난파 선원 풍랑',   emoji: '⚓' },
    chalna:  { name: '사진작가 찰나',    emoji: '📷' },
    explorer:{ name: '탐험가',           emoji: '🧭' },
    bandi:   { name: '도깨비불 반디',    emoji: '🔥' },
    dudu:    { name: '도깨비 대장 두두', emoji: '👹' },
    rumi:    { name: '불시착 탐사원 루미', emoji: '🧑‍🚀' },
    nabi:    { name: '곤충 박사 나비',   emoji: '🦋' }
  };

  var SCENES = {
    move1: { title: '봄 · 이사 오던 날', lines: [
      ['keeper', '이사 온 첫 밤이 저물었구려. 짐은 다 풀었소? 이 숲은 초가 지붕 사이로 별이 잘 들어오는 곳이라오.'],
      ['me', '짐을 풀다 보니 저 하늘에 가느다란 금이 하나 보입니다. 별똥별이 지나간 자국인가요?'],
      ['keeper', '금이라니… 이 늙은이는 처음 보오. 우선 집에 가구 하나라도 놓고 보시오. 집이 서야 마음이 놓이지.']
    ] },
    move2: { title: '봄 · 이사 오던 날', lines: [
      ['dareum', '으아아! 여기가 어디죠? 택배 기사 달음입니다! 금이 쫙 갈라지더니 이 소포와 함께 떨어졌어요.'],
      ['dareum', '받는 이가 "이 마을 새 이웃"인데, 보낸 날짜가 먼 앞날이에요. 상자 속에서 빛 편지가 새어 나오고요.'],
      ['keeper', '먼 앞날에서 온 소포라니. 접수대에 알려 배달 일부터 해 보시오. 그 길에 뭔가 보일 게요.']
    ] },
    post1: { title: '봄 · 폐허의 옛 우체통', lines: [
      ['keeper', '빛 편지가 가리키는 곳이 있소 — 탑성 폐허의 옛 우체통이오. 오래전 이곳을 오가던 편지가 지금도 쌓여 있다 하오.'],
      ['dareum', '억새 바람벌을 지나서 폐허까지 가면 된대요! 폐허 옆에는 오래된 공중전화가 서 있다던데, 우체통이 왜 전화 곁에 있을까요.']
    ] },
    post2: { title: '봄 · 폐허의 옛 우체통', lines: [
      ['me', '우체통이 정말 있었습니다. 안에는 붓글씨 편지, 택배 송장, 빛나는 홀로그램 도장이 찍힌 편지까지 섞여 있어요.'],
      ['keeper', '여러 시대의 편지가 한 통에 쌓였구려. 이 우체통이 버려진 채 오래 되어 시대 사이 우체통이 된 모양이오.'],
      ['dareum', '그럼 하늘의 금은 이 우체통이 부른 길이에요? 이 편지들을 마을로 배달해 봐요!']
    ] },
    fox1: { title: '봄 · 여우 화상의 봄 장터', lines: [
      ['hoyeon', '어이쿠, 금 사이로 넘어와 버렸군. 여우 화상 호연이오. 시대를 잃은 물건을 파는 장사꾼이지. 이 빛 부채는 앞날 것이고, 저 옛 방울은 이 땅 것이오.'],
      ['me', '삼짇날 꽃놀이를 연다는 소문이 있던데요, 장터를 그날 맞춰 열 수 있을까요?'],
      ['hoyeon', '꽃 다섯 송이만 모아 오시오. 꽃놀이에 쓸 꽃 좌판을 내가 펼치겠소.']
    ] },
    fox2: { title: '봄 · 여우 화상의 봄 장터', lines: [
      ['hoyeon', '꽃놀이 안내판 곁에 좌판을 폈소. 확성기가 딸린 장터라 소리가 멀리 가지. 꽃놀이를 마치면 이 마을에서 장사를 해도 되겠소?'],
      ['keeper', '이 마을에는 새 이웃이 반갑소. 호연 좌판은 마을 상점 칸에 내주지.']
    ] },
    fox3: { title: '봄 · 여우 화상의 봄 장터', lines: [
      ['hoyeon', '꽃놀이가 끝났구려. 빛 부채가 한 자루 남았소, 선물로 받아 두시오.'],
      ['me', '한 주민과 마음이 통했습니다. 이 마을이 좋아지고 있어요.']
    ] },
    sail1: { title: '여름 · 호수에 박힌 배', lines: [
      ['pungnang', '으으… 하늘이 갈라져 배째로 떨어졌소. 난파 선원 풍랑이오. 보시오, 호수에 옛 돛배가 박혀 버렸소. 뱃밑에는 빛나는 닻이 달려 있고.'],
      ['me', '수리하려면 삯이 꽤 들겠군요. 낚시로 물고기를 몇 마리 잡아다 드리면 도움이 될까요?'],
      ['pungnang', '고맙소! 낚시라면 이 몸이 가르치리다. 요즘 낚시 명인의 릴이라는 신기한 물건이 저자에 돈다지. 우선 물고기 세 마리만.']
    ] },
    sail2: { title: '여름 · 호수에 박힌 배', lines: [
      ['pungnang', '단오 창포못 낚시가 끝났구려! 그 값으로 뱃널 몇 장은 사겠소. 이 삯을 뱃길 손님에게 전해 주시겠소?'],
      ['me', '배달이라면 접수대를 거치면 되지요. 잠시 다녀오겠습니다.']
    ] },
    sail3: { title: '여름 · 호수에 박힌 배', lines: [
      ['pungnang', '삯이 닿았소! 뱃전에 평상 하나를 짜서 호숫가에 놓아 드리리다. 낚시 손님이 앉아 쉬어 가시오.'],
      ['me', '박힌 배가 이 마을 호수의 풍경이 되겠군요. 빛나는 닻은 밤에 보면 더 아름다울 것 같습니다.']
    ] },
    photo1: { title: '여름 · 숲 여덟의 사진', lines: [
      ['chalna', '안녕하세요! 사진작가 찰나예요. 앞날 기록에서 이 숲은 "사라진 숲"이라고 하더라고요. 사라지기 전에 찍어 두려고요.'],
      ['chalna', '숲 여덟을 다 돌 순 없으니 네 곳만요 — 푸른 솔숲, 버섯 요정골, 거인 바위 고개, 마지막으로 반딧불 참나무숲의 밤 사진이요.'],
      ['me', '거인 바위 고개의 선돌은 아주 오래된 것이라 들었습니다. 같이 가 봅시다.']
    ] },
    photo2: { title: '여름 · 숲 여덟의 사진', lines: [
      ['chalna', '반딧불 사이에서 작은 드론이 떠다니는 게 찍혔어요! 다른 시대 것이 이 숲을 기록하고 있나 봐요.'],
      ['me', '찰나 씨의 사진기와 드론이 같은 곳을 찍고 있었군요. 이 숲이 기억되고 있다는 뜻일지도요.'],
      ['chalna', '사진 액자를 넷 만들어 드릴게요. 마을 벽에 걸어 두면 숲이 사라지지 않을 거예요.']
    ] },
    fall1: { title: '여름 · 폭포 너머', lines: [
      ['explorer', '폭포 너머엔 뭐가 있는지 아무도 몰라. 이 폭포 뒤엔 굴이 있고 굴 벽에는 옛 글씨가, 바닥에는 미래의 발자국이 있다는 소문이 있지.'],
      ['me', '손전등은 제가 준비하겠습니다. 폭포 곁부터 가 보지요.']
    ] },
    fall2: { title: '여름 · 폭포 너머', lines: [
      ['explorer', '굴 벽에 옛 글씨가 가득이더군. 발자국 옆에는 빛 표식까지. 여러 시대 사람이 같은 굴을 지나갔다는 뜻이야.'],
      ['me', '편지 다발도 벽 틈에 꽂혀 있었습니다. 옛 우체통과 이어진 길일지도 모르겠어요.'],
      ['explorer', '도감에 "폭포 뒤 굴"을 적어 두자고. 또 새 수수께끼를 찾아 떠나야겠군.']
    ] },
    star1: { title: '여름 · 칠석, 별에 소원', lines: [
      ['bandi', '칠석이라고 별에 소원 빌러 몰려왔어! 나는 도깨비불 반디야. 밤길 안내는 내가 할게.'],
      ['dudu', '도깨비 대장 두두다! 오작교 등도 달고 주운 손전등도 켜 놓았지. 꼬마들아 줄 서라!'],
      ['me', '이 밤에 별에 소원을 빌고 나면 그 소원이 금으로 올라간다지요. 저도 빌어 보겠습니다.']
    ] },
    star2: { title: '여름 · 칠석, 별에 소원', lines: [
      ['dudu', '소원이 하늘 금으로 스르르 올라갔어! 재밌다! 이 마을 정말 살아 볼 만하겠는데?'],
      ['bandi', '두두는 말썽만 피워서 걱정이야. 대신 내가 잘 이끌게. 이 마을에 살아도 될까?'],
      ['me', '함께 지낼 손님이 있으면 마을이 더 밝아지겠지요.']
    ] },
    rumi1: { title: '가을 · 우주기지의 불시착', lines: [
      ['rumi', '탐사원 루미예요. 우주기지에 불시착했는데, 구조 신호가 닿으려면 300년이 걸린대요. 무전기는 이 땅 것이라 옛 봉투에 넣어야 신호가 가고.'],
      ['me', '봉투에 신호를? 옛 우체통이 신호를 앞날로 부치는 길이라는 말씀이지요?'],
      ['rumi', '네! 우선 기지 광석 세 개로 송신기를 고치고 싶어요. 도와주실 수 있어요?']
    ] },
    rumi2: { title: '가을 · 우주기지의 불시착', lines: [
      ['rumi', '신호가 우체통으로 들어갔어요! 옛 봉투에 담긴 신호가 300년 뒤에 닿는다니… 이제 기다릴 수 있어요.'],
      ['me', '탐사차 택배는 앞당겨서 오게 하겠습니다. 편지로 소식을 전해 주세요.']
    ] },
    ins1: { title: '가을 · 반딧불이 정원', lines: [
      ['nabi', '곤충 박사 나비예요! 반딧불이가 해마다 줄어드는 까닭을 찾고 있어요. 금 너머에서 새는 빛이 밤을 밝혀서 짝짓기를 방해하는 것 같아요.'],
      ['me', '채집망을 빌려 주시면 곤충을 다섯 마리 잡아 보겠습니다.'],
      ['nabi', '기록용으로 사고에도 기증해 주세요. 옛 정원 돌담 곁에서 반딧불이 정원을 다시 만들어 볼게요.']
    ] },
    ins2: { title: '가을 · 반딧불이 정원', lines: [
      ['nabi', '기증하신 곤충 덕에 빛 공해의 가설이 맞는지 확인했어요. 금에서 새는 빛이 문제였네요.'],
      ['me', '금을 닫을 수는 없어도 빛이 덜 새게 할 수는 있겠군요.']
    ] },
    har1: { title: '가을 · 한가위 줄다리기', lines: [
      ['keeper', '한가위라오. 주민과 손님을 두 편으로 갈라 줄다리기를 하고 달 아래서 송편을 나눕시다.'],
      ['chalna', '단체 사진을 찍어 드릴게요! 저기 K-7 씨가 잔치를 기록하러 오셨네요.'],
      ['k7', '기록 중입니다. 이 마을의 밤이 앞날 기록에 또렷이 남고 있어요.']
    ] },
    har2: { title: '가을 · 한가위 줄다리기', lines: [
      ['k7', '기록판의 "사라진 숲"이 거의 다 지워졌습니다. 이 마을을 기억하는 이들이 늘었어요.'],
      ['keeper', '잔치가 끝났으니 북쪽 동굴 부탁이나 살펴보시오. 동굴 끝에 이상한 빛 조각이 있다 하오.']
    ] },
    cave1: { title: '가을 · 북쪽 동굴의 조각', lines: [
      ['keeper', '북쪽 동굴 끝까지 가 보시오. 벽화가 있고 그 끝에 빛나는 결정이 박혀 있다 하오.'],
      ['explorer', '밧줄은 내가 걸어 두었지. 조심해서 들어가 봐.']
    ] },
    cave2: { title: '가을 · 북쪽 동굴의 조각', lines: [
      ['k7', '이 결정은 금의 조각입니다. 금은 우체통이 부르는 길이었어요. 결정을 만지면 금이 더 벌어질 수도, 잠잠해질 수도 있습니다.'],
      ['me', '금을 활짝 열어 두면 여러 시대 손님이 더 올 것이고, 조용히 해 달라면 밤이 고요해지겠지요.']
    ], choice: { id: 'crack', prompt: '금을 어떻게 할 것인가', options: [{ key: 'open', label: '금을 활짝 열어 둔다' }, { key: 'quiet', label: '조용히 해 달라 한다' }] } },
    let1: { title: '겨울 · 편지가 쌓이는 겨울', lines: [
      ['keeper', '옛 우체통에 앞날의 답장이 쌓였다오. 고맙다는 편지를 주민마다 전해 주시겠소?'],
      ['dareum', '붓글씨 편지에 택배 상자에 빛 편지까지, 한 상자에 세 시대가 담겼어요! 제가 나눠 실을게요.']
    ] },
    let2: { title: '겨울 · 편지가 쌓이는 겨울', lines: [
      ['keeper', '주민들이 편지를 읽고 웃었소. 편지꽂이 하나를 마련해 드리리다.'],
      ['me', '앞날의 이웃이 이 마을을 기억하고 있다는 편지였습니다.']
    ] },
    dong1: { title: '겨울 · 동지 팥죽 나눔', lines: [
      ['keeper', '동지 팥죽을 쑬 때가 되었소. 팥죽 솥 곁에 주민과 손님이 모이면 잔치가 차오르오.'],
      ['rumi', '온열 장치도 가져왔어요! 팥죽이 식지 않게요.']
    ] },
    dong2: { title: '겨울 · 동지 팥죽 나눔', lines: [
      ['keeper', '살러 온 손님이 둘이 되니 잔치가 찼구려. 이 마을이 참 따뜻해졌소.']
    ] },
    ny1: { title: '겨울 · 설날 세배 돌기', lines: [
      ['keeper', '설날이오. 한복 입은 주민마다 세배를 돌아 새해 인사를 나누시오. 복주머니를 드리겠소.'],
      ['k7', '새해 기록도 남기겠습니다. 이 마을의 새해 인사가 앞날 기록에 들어가요.']
    ] },
    moon1: { title: '겨울 · 대보름, 별 우체통', lines: [
      ['keeper', '대보름이오. 달집에 불을 놓으면 하늘 금이 옛 우체통 위로 내려온다는 말이 있소.'],
      ['chalna', '마지막 사진을 찍을게요. 달집 불빛이 금에 닿는 순간이요!'],
      ['k7', '기록판이 바뀌고 있습니다… "사라진 숲" 글자가 흐려지고 있어요.']
    ] },
    moon2_open: { title: '겨울 · 대보름, 별 우체통', lines: [
      ['k7', '"이어진 숲"! 기록판 글자가 바뀌었습니다. 금이 열려 있어서 여러 시대 손님이 모두 모였고, 별 우체통이 되어 하늘에 걸렸어요.'],
      ['keeper', '이제 이 마을은 잊히지 않소. 별 우체통을 마을 명소로 삼읍시다. 그대는 이어진 숲의 이웃이오.']
    ] },
    moon2_quiet: { title: '겨울 · 대보름, 별 우체통', lines: [
      ['k7', '"이어진 숲"! 기록판 글자가 바뀌었습니다. 금이 조용히 내려앉아 별 우체통이 고요한 밤에 걸렸어요.'],
      ['keeper', '조용한 밤이 이 마을에 어울리오. 별 우체통은 마을 명소요. 그대는 이어진 숲의 이웃이오.']
    ] },
    /* ── 둘째 해 봄 · 우체통의 답장 (정본 "결말 뒤 · 다음 해 자리" — 별 우체통으로 부친 편지에 여러 시대가 답한다) ── */
    rep1: { title: '둘째 해 봄 · 별 우체통의 첫 답장', lines: [
      ['keeper', '눈 녹은 아침에 별 우체통이 저 혼자 덜컹거렸소. 지난겨울 부친 편지에 답이 온 모양이오.'],
      ['dareum', '배달 왔습니다! 소인이 찍힌 데가 한 곳이 아니에요. 붓글씨 봉투, 택배 영수증 도장, 빛 도장까지 세 시대 답장이 한꺼번에요.'],
      ['me', '이걸 마을 사람들에게 하나씩 전해 드리면 되겠군요.']
    ] },
    rep2: { title: '둘째 해 봄 · 별 우체통의 첫 답장', lines: [
      ['dareum', '전해 주셔서 고맙습니다. 받은 분들 얼굴이 봄꽃 같더군요. 아직 우체통 안쪽에 답장이 한 통 더 남았는데 — 겉에 여우 그림이 그려져 있어요.'],
      ['keeper', '여우 그림이라면 호연이오. 그 사람 답장은 직접 받으러 가는 게 예의라오.']
    ] },
    hoy1: { title: '둘째 해 봄 · 호연의 답장', lines: [
      ['hoyeon', '답장은 우체통에 넣기 전에 얼굴 보고 전하는 게 장사꾼 예의요. 지난해 좌판을 내주어 고마웠소. 올해는 내가 대접하겠소.'],
      ['me', '대접이라니요. 저야 꽃 몇 송이 모았을 뿐인데요.'],
      ['hoyeon', '꽃 다섯 송이만 더 모아 오시오. 시대를 잃은 물건 중에 이 마을에 어울리는 걸 하나 골라 두었소.']
    ] },
    hoy2: { title: '둘째 해 봄 · 호연의 답장', lines: [
      ['hoyeon', '꽃이 곱구려. 이 옛 방울에 꽃잎을 달아 두면 봄바람에 절로 울지. 마을 이웃 마음이 이만큼 통하면 방울도 제 소리를 낸다오.'],
      ['keeper', '마을 사람과 정이 여섯 하트쯤 쌓이면 방울이 제 목소리를 낼 게요.']
    ] },
    hoy3: { title: '둘째 해 봄 · 호연의 답장', lines: [
      ['hoyeon', '방울이 우는구려! 옛 땅 방울 소리와 앞날 빛 부채 바람이 한자리에서 섞였소. 이게 답장이오. 이 마을은 시대가 오가는 길목이 되었소.'],
      ['me', '아직 모자란 이웃인데도 답장을 이렇게 받아도 되나요?'],
      ['hoyeon', '답장은 받는 이가 아니라 부친 이가 정하는 법이오. 부친 이는 그대였소.']
    ] },
    reb1: { title: '둘째 해 봄 · 다시 쌓는 옛 우체통', lines: [
      ['k7', '기록판이 갱신됐어요. "이어진 숲" 밑에 새 줄이 생겼는데 — "옛 우체통 복원 미완".'],
      ['keeper', '탑성 폐허의 옛 우체통은 별 우체통과 한 쌍이오. 한쪽만 서 있으면 답장이 길을 잃는다오.'],
      ['me', '폐허에 가서 무너진 자리를 살펴보겠습니다.']
    ] },
    reb2: { title: '둘째 해 봄 · 다시 쌓는 옛 우체통', lines: [
      ['dareum', '폐허 돌 위에 안전모 하나가 놓여 있었죠? 현대 공사장 물건이에요. 누군가 이미 쌓기 시작했다는 뜻이에요.'],
      ['k7', '설계도 홀로그램 조각도 나왔어요. 앞날 사람과 옛사람이 함께 쌓는 우체통이라니, 기록에 없던 일입니다.'],
      ['me', '편지 한 통만 더 배달하면 첫 돌을 놓을 수 있겠어요.']
    ] },
    ans1: { title: '둘째 해 봄 · 답장이 온 봄', lines: [
      ['keeper', '옛 우체통에 첫 돌이 놓였소. 이제 삼짇날 꽃놀이를 열어 새 우체통을 알리면 좋겠구려.'],
      ['hoyeon', '방울을 꽃가지에 달고 나가겠소. 이번 꽃전은 내가 빚소.'],
      ['dareum', '저는 답장 엽서를 한 장씩 돌리겠습니다. 이 마을 소인이 찍힌 엽서예요!']
    ] },
    ans2: { title: '둘째 해 봄 · 답장이 온 봄', lines: [
      ['k7', '꽃놀이가 끝났군요. 기록판 새 줄이 바뀌었어요 — "복원 미완"이 "이어 쌓는 중"으로요.'],
      ['keeper', '이 마을은 이제 편지를 받기만 하는 곳이 아니라 답장을 보내는 곳이오. 그대는 답장을 받는 이웃이오.'],
      ['me', '내년에도, 그다음에도 이 마을에서 편지를 부치겠습니다.']
    ] },
    /* ── 둘째 해 여름 · 사진첩의 답장 (손님 찰나) ── */
    sal1: { title: '둘째 해 여름 · 찰나의 사진첩', lines: [
      ['chalna', '여름 소나기가 막 그쳤어요. 별 우체통으로 부친 제 사진, 답장이 왔더라고요 — 옛 화공이 그림으로, 앞날 사람이 빛으로 답을 그려 보냈어요.'],
      ['me', '사진 한 장에 시대마다 다른 답이 붙는군요.'],
      ['chalna', '사진첩을 채울 물고기 세 마리만 낚아 주세요. 물고기가 물 위로 튀는 순간이 첫 장면이에요.']
    ] },
    sal2: { title: '둘째 해 여름 · 찰나의 사진첩', lines: [
      ['chalna', '찰칵! 튀어 오른 물고기와 무지개가 한 장에 담겼어요. 옛 화공 답장에는 붓으로 그린 물고기가, 빛 답장에는 움직이는 물방울이 붙었고요.'],
      ['keeper', '마을 여름이 이렇게 남는구려. 사진은 사라지는 것을 붙잡는 일이라 했소.']
    ] },
    lens1: { title: '둘째 해 여름 · 빌려 준 카메라', lines: [
      ['chalna', '제 카메라를 잠깐 빌려 드릴게요. 솔숲과 요정골, 두 숲의 여름을 찍어 오시면 답장 사진첩이 완성돼요.'],
      ['me', '카메라는 처음인데요. 어디를 찍으면 좋을까요?'],
      ['chalna', '눈에 띄는 것 말고, 제일 조용한 곳을 찍으세요. 조용한 곳에 시대가 겹쳐 보여요.']
    ] },
    lens2: { title: '둘째 해 여름 · 빌려 준 카메라', lines: [
      ['chalna', '솔숲의 그늘, 요정골의 버섯 불빛… 잘 찍으셨네요! 이 그늘 속에 옛 나무꾼이 지나가고, 저 불빛 속에 앞날 사람의 손전등이 겹쳐 있어요.'],
      ['pungnang', '허허, 내 젊은 날 뱃전에서 보던 등대불도 사진 한 장으로 남을 수 있소? 다음엔 나도 찍어 주오.']
    ] },
    night1: { title: '둘째 해 여름 · 반딧불 야간 촬영', lines: [
      ['chalna', '여름 사진의 마지막은 밤이에요. 반딧불 참나무숲의 불빛은 오래 노출해야 찍혀요. 반딧불이 세 마리만 앞에 앉히면 돼요.'],
      ['dareum', '저는 삼각대를 들게요! 배달 짐 중에 가장 가벼운 짐이 제일 든든하지요.']
    ] },
    night2: { title: '둘째 해 여름 · 반딧불 야간 촬영', lines: [
      ['chalna', '한 장 찍는 데 밤이 다 갔네요. 그런데 인화해 보니 반딧불 사이에 낯선 작은 불빛들이 줄지어 있어요 — 여러 시대가 보낸 답장 불빛 같아요.'],
      ['me', '반딧불과 답장이 한 장에 담겼군요.']
    ] },
    end1: { title: '둘째 해 여름 · 칠석, 한여름의 답장', lines: [
      ['keeper', '칠석날 밤에는 견우직녀가 하늘 금을 건넌다고들 하오. 사진첩을 별 우체통 앞에 펼쳐 놓읍시다.'],
      ['chalna', '답장 사진첩 마지막 장은 마을 사람 모두가 등불을 들고 서는 사진이에요. 함께 찍어요!']
    ] },
    end2: { title: '둘째 해 여름 · 칠석, 한여름의 답장', lines: [
      ['chalna', '찍었어요! 등불 든 사람들 사이에 옛 화공도, 앞날 사람도 서 있는 것 같지 않나요? 이 사진이 이 여름의 답장이에요.'],
      ['k7', '기록판이 갱신됐어요. "사진으로 남은 숲" — 앞날 기록에 사진 한 줄이 새로 생겼습니다.'],
      ['keeper', '그대는 이 마을의 사진 이웃이오. 사진첩은 마을 서고에 꽂아 두겠소.']
    ] },
    /* ── 둘째 해 가을 · 앞날의 답장 (손님 루미) ── */
    rum1: { title: '둘째 해 가을 · 루미의 답신', lines: [
      ['rumi', '모선 교신이 다시 잡혔어요! 지난가을 부친 편지가 우주기지 안테나에 닿았대요. 답신 상자 열쇠는 광석 세 덩이로 만든 열쇠래요.'],
      ['keeper', '광석이라면 이끼 돌너덜과 동굴에 넉넉하오.'],
      ['me', '광석 세 덩이를 모아 오겠습니다.']
    ] },
    rum2: { title: '둘째 해 가을 · 루미의 답신', lines: [
      ['rumi', '열쇠가 맞아요! 답신 상자에서 옛 붓 편지, 도하의 사진 편지, 빛 편지 세 통이 함께 나왔어요. 한 통은 배달해야 뜯을 수 있다고 적혀 있고요.'],
      ['dareum', '배달이라면 제 일이죠! 받는 이가 이 마을이라 소인을 마을 걸로 찍어 줄게요.']
    ] },
    rec1: { title: '둘째 해 가을 · 기록판의 새 줄', lines: [
      ['k7', '기록판을 갱신하려면 사고에 조개 세 점이 더 필요합니다. 물가에서 나는 것이 시간을 가장 오래 품거든요.'],
      ['me', '조개라면 호숫가와 강가에서 주워 오겠습니다.']
    ] },
    rec2: { title: '둘째 해 가을 · 기록판의 새 줄', lines: [
      ['k7', '기증 확인. 기록판 새 줄이 떴어요 — "이 숲은 편지를 주고받는 곳". 앞날에서는 드문 기록입니다.'],
      ['rumi', '모선에도 이 줄이 전해졌대요. 우리 시대 사람들이 이 숲을 부러워한다고요!']
    ] },
    har1: { title: '둘째 해 가을 · 한가위 답례', lines: [
      ['keeper', '한가위에는 받은 답장에 답례하는 법이오. 마을 사람 하나와 마음을 깊이 나눈 뒤에 잔치를 엽시다.'],
      ['dareum', '저는 송편 배달을 맡을게요. 시대마다 송편 모양이 다르다는 걸 알았어요!']
    ] },
    har2: { title: '둘째 해 가을 · 한가위 답례', lines: [
      ['rumi', '보름달이 이렇게 큰 줄 몰랐어요. 모선에서 본 달은 작았는데요.'],
      ['keeper', '달은 보는 자리에 따라 커지는 법이오. 그대가 이 마을에 뿌리를 내렸다는 뜻이기도 하고.']
    ] },
    ccv1: { title: '둘째 해 가을 · 동굴 끝의 답장 상자', lines: [
      ['k7', '마지막 답장 상자는 북쪽 동굴 끝에 있다고 기록에 나옵니다. 지난해 금 조각을 찾은 그 자리 뒤쪽이에요.'],
      ['me', '동굴에 다시 들어가 보겠습니다.']
    ] },
    ccv2: { title: '둘째 해 가을 · 동굴 끝의 답장 상자', lines: [
      ['k7', '답장 상자가 열렸어요. 안에 편지 한 통 — "이 숲을 잊지 않겠다. 앞날에서." 서명은 없는데 글씨는 이 마을 주민 글씨를 닮았어요.'],
      ['keeper', '앞날의 우리가 보낸 편지인지도 모르겠소. 그대는 앞날의 답장을 여는 이웃이오.']
    ] },
    /* ── 둘째 해 겨울 · 이어 쓰는 숲 (세 시대) ── */
    wl1: { title: '둘째 해 겨울 · 겨울 편지 답례', lines: [
      ['keeper', '겨울이 왔소. 올해는 편지를 받기만 하지 말고 이쪽에서 먼저 돌립시다. 배달 다섯을 마쳐 주시오.'],
      ['dareum', '눈길 배달은 발자국이 남아서 좋아요. 발자국이 길이 되니까요.']
    ] },
    wl2: { title: '둘째 해 겨울 · 겨울 편지 답례', lines: [
      ['dareum', '다 돌렸네요! 받은 사람 얼굴이 하나같이 밝아서 제 배달 가방도 가벼워졌어요.'],
      ['keeper', '먼저 부친 편지에는 답장이 세 시대에서 다시 올 것이오.']
    ] },
    wd1: { title: '둘째 해 겨울 · 동지 답례', lines: [
      ['keeper', '동지 팥죽을 쑤어 지난해 잔치에 못 온 이웃도 부릅시다. 주민과 마음이 여덟은 깊어져야 잔치가 참 잔치요.'],
      ['chalna', '저는 팥죽 김이 오르는 사진을 찍을게요. 김 속에 시대가 겹쳐 보이거든요.']
    ] },
    wd2: { title: '둘째 해 겨울 · 동지 답례', lines: [
      ['hoyeon', '팥죽 한 그릇에 옛 방울 소리가 은은하게 어울리는구려. 이웃이 이만큼 모였으니 이 마을은 이제 가게 열 만하오.'],
      ['pungnang', '뱃사람의 동지는 배를 묶어 두고 팥죽을 나누는 날이라오. 오늘은 마을에 배를 묶겠소.']
    ] },
    wy1: { title: '둘째 해 겨울 · 설날, 새 편지', lines: [
      ['keeper', '설날 세배는 지난해와 같소. 다만 올해는 세배 돌이에 편지 한 통씩을 들고 갑시다.'],
      ['dareum', '새해 첫 배달! 소인은 이 마을 우체통 도장으로 찍겠습니다.']
    ] },
    wy2: { title: '둘째 해 겨울 · 설날, 새 편지', lines: [
      ['k7', '설날 편지가 여러 시대로 나갔어요. 기록판에 처음 보는 이름들이 답장을 쓰기 시작했습니다.'],
      ['rumi', '모선에서도 새해 편지가 온다고 했어요. 이 숲의 소인이 인기래요!']
    ] },
    wm1: { title: '둘째 해 겨울 · 두 번째 대보름', lines: [
      ['keeper', '대보름달이 다시 떴소. 별 우체통과 옛 우체통이 나란히 섰으니 달집을 두 곳에 짓읍시다.'],
      ['k7', '기록판에 미완이던 줄이 하나 남았어요. "옛 우체통 복원". 오늘 밤 마무리하면 됩니다.']
    ] },
    wm2: { title: '둘째 해 겨울 · 두 번째 대보름', lines: [
      ['k7', '"이어 쌓는 중"이 "이어진 우체통"으로 바뀌었어요! 기록판에 더 쓸 줄이 없습니다 — 이 숲은 이제 기록이 아니라 이야기가 되었어요.'],
      ['keeper', '두 해를 함께 살았구려. 그대는 두 해째의 이어진 숲의 이웃이오. 내년에도 우체통은 열려 있을 것이오.'],
      ['me', '내년에도, 그다음에도 이 마을에서 편지를 부치겠습니다.']
    ] },
    mus1: { title: '봄 · 사고를 채우다', lines: [
      ['k7', '…착륙 성공. 시간 여행자 K-7, 기록원입니다. 저는 앞날의 기록을 들고 왔어요. 이 숲의 기록 칸은 "사라진 숲"입니다.'],
      ['me', '사라진 숲이라니요? 이 마을이 없어진다는 뜻입니까?'],
      ['k7', '잊힌 곳은 앞날에서 지워집니다. 사고에 화석을 채우면 그 줄이 흐려지는 걸 확인했어요. 화석 다섯 점만 넣어 보시겠습니까?']
    ] },
    mus2: { title: '봄 · 사고를 채우다', lines: [
      ['k7', '기록판의 "사라진 숲"이 한 줄 흐려졌습니다! 이 마을이 기억되기 시작했다는 뜻이에요. 그런데 부탁이 하나 있습니다.'],
      ['k7', '앞날 기록에 이 마을 이름을 적어 두고 싶습니다. 알려 주시겠어요?'],
      ['me', '마을 이름을 알려 주는 건 이 마을의 미래를 맡기는 일이지요. 정하겠습니다.']
    ], choice: { id: 'name', prompt: 'K-7 에게 마을 이름을 알려 줄까', options: [{ key: 'tell', label: '알려 준다' }, { key: 'secret', label: '비밀로 한다' }] } }
  };

  var CHAPTERS = [
    { id: 'sp_move', no: 1, season: 'spring', title: '이사 오던 날', stage: '마을 · 접수대', after: null,
      blurb: '짐을 풀던 밤, 하늘에 금이 가고 택배 기사 달음이 소포와 함께 떨어진다.',
      mix: { past: '초가·숲지기', now: '달음·택배 상자', future: '소포 속 빛 편지' },
      steps: [
        { t: 'talk', scene: 'move1' },
        { t: 'place', n: 1 },
        { t: 'talk', scene: 'move2' },
        { t: 'deliver', n: 1 }
      ],
      reward: { gold: 300, exp: 60 } },

    { id: 'sp_postbox', no: 2, season: 'spring', title: '폐허의 옛 우체통', stage: '억새 바람벌 → 탑성 폐허', after: 'sp_move',
      blurb: '빛 편지가 가리키는 곳 — 탑성 폐허의 옛 우체통. 안에 여러 시대 편지가 쌓여 있다.',
      mix: { past: '탑성 폐허·옛 우체통', now: '우체통 옆 공중전화', future: '편지 속 홀로그램 도장' },
      steps: [
        { t: 'talk', scene: 'post1' },
        { t: 'forest', key: 'eoksae' },
        { t: 'go', spot: 'ruin' },
        { t: 'talk', scene: 'post2' },
        { t: 'deliver', n: 1 }
      ],
      reward: { gold: 400, exp: 80 } },

    { id: 'sp_fox', no: 3, season: 'spring', title: '여우 화상의 봄 장터', stage: '꽃잎 언덕 · 마을 광장', after: 'sp_postbox',
      blurb: '호연이 금으로 넘어와 "시대를 잃은 물건"을 판다. 삼짇날 꽃놀이로 장터를 연다.',
      mix: { past: '여우 화상·꽃놀이', now: '장터 확성기', future: '호연 좌판의 빛 부채' },
      steps: [
        { t: 'talk', scene: 'fox1' },
        { t: 'gather', cat: 'flower', n: 5 },
        { t: 'talk', scene: 'fox2' },
        { t: 'fest', key: 'samjin' },
        { t: 'heart', n: 1 },
        { t: 'talk', scene: 'fox3' }
      ],
      reward: { gold: 500, exp: 100, feat: 10 } },

    { id: 'sp_museum', no: 4, season: 'spring', title: '사고를 채우다', stage: '사고 · 이끼 돌너덜', after: 'sp_fox',
      blurb: 'K-7 이 떨어져 "사라진 숲" 기록을 보인다. 사고에 화석을 채우면 기록 한 줄이 흐려진다.',
      mix: { past: '화석·석비', now: '사고 전시 조명', future: 'K-7 기록판' },
      steps: [
        { t: 'talk', scene: 'mus1' },
        { t: 'donate', cat: 'fossil', n: 5 },
        { t: 'talk', scene: 'mus2' }
      ],
      reward: { gold: 600, exp: 120, feat: 15 } },

    { id: 'su_sailor', no: 5, season: 'summer', title: '호수에 박힌 배', stage: '호수 · 강', after: 'sp_museum',
      blurb: '옛 배와 함께 떨어진 선원 풍랑 — 단오 창포못 낚시로 배 수리 값을 번다.',
      mix: { past: '옛 돛배·풍랑', now: '낚시 명인의 릴', future: '배 밑의 빛 닻' },
      steps: [
        { t: 'talk', scene: 'sail1' },
        { t: 'fish', n: 3 },
        { t: 'fest', key: 'dano' },
        { t: 'talk', scene: 'sail2' },
        { t: 'deliver', n: 1 },
        { t: 'talk', scene: 'sail3' }
      ],
      reward: { gold: 700, exp: 140 } },

    { id: 'su_photo', no: 6, season: 'summer', title: '숲 여덟의 사진', stage: '이름 있는 숲 여덟 중 넷', after: 'su_sailor',
      blurb: '찰나가 "사라지기 전에 찍어 두자"며 숲을 돈다. 반딧불 참나무숲 밤 사진이 마지막.',
      mix: { past: '거인 바위 고개 선돌', now: '찰나·사진기', future: '반딧불 사이 떠도는 드론' },
      steps: [
        { t: 'talk', scene: 'photo1' },
        { t: 'forest', key: 'solsup' },
        { t: 'forest', key: 'yoseong' },
        { t: 'forest', key: 'georin' },
        { t: 'forest', key: 'bandi' },
        { t: 'talk', scene: 'photo2' }
      ],
      reward: { gold: 800, exp: 160, feat: 10 } },

    { id: 'su_waterfall', no: 7, season: 'summer', title: '폭포 너머', stage: '폭포 · 동굴', after: 'su_photo',
      blurb: '탐험가의 수수께끼 — 폭포 뒤 굴에 옛 편지 다발과 미래의 발자국.',
      mix: { past: '굴 벽 옛 글씨', now: '탐험가 손전등', future: '발자국 옆 빛 표식' },
      steps: [
        { t: 'talk', scene: 'fall1' },
        { t: 'go', spot: 'waterfall' },
        { t: 'cave', n: 1 },
        { t: 'talk', scene: 'fall2' }
      ],
      reward: { gold: 900, exp: 180 } },

    { id: 'su_star', no: 8, season: 'summer', title: '칠석, 별에 소원', stage: '마을 · 어스름 고목숲', after: 'su_waterfall',
      blurb: '도깨비불 반디와 두두 패가 칠석 밤에 몰려온다. 손님 하나를 마을에 살게 한다.',
      mix: { past: '칠석 오작교 등', now: '두두가 주운 손전등', future: '소원이 금으로 올라가는 빛' },
      steps: [
        { t: 'talk', scene: 'star1' },
        { t: 'fest', key: 'chilseok' },
        { t: 'settle', n: 1 },
        { t: 'talk', scene: 'star2' }
      ],
      reward: { gold: 1000, exp: 200, feat: 20 } },

    { id: 'au_rumi', no: 9, season: 'autumn', title: '우주기지의 불시착', stage: '우주기지', after: 'su_star',
      blurb: '탐사원 루미 — 구조 신호가 300년 뒤에 닿는다. 옛 우체통으로 신호를 "부치자".',
      mix: { past: '우체통 봉투에 넣은 신호', now: '무전기', future: '우주기지·루미' },
      steps: [
        { t: 'talk', scene: 'rumi1' },
        { t: 'gather', cat: 'ore', n: 3 },
        { t: 'deliver', n: 1 },
        { t: 'talk', scene: 'rumi2' }
      ],
      reward: { gold: 1100, exp: 220 } },

    { id: 'au_insect', no: 10, season: 'autumn', title: '반딧불이 정원', stage: '반딧불 참나무숲 · 사고', after: 'au_rumi',
      blurb: '곤충 박사 나비가 반딧불이가 줄어드는 까닭을 찾는다 — 금 너머 빛 공해.',
      mix: { past: '옛 정원 돌담', now: '나비·채집망', future: '금에서 새는 빛' },
      steps: [
        { t: 'talk', scene: 'ins1' },
        { t: 'bug', n: 5 },
        { t: 'donate', cat: 'bug', n: 5 },
        { t: 'talk', scene: 'ins2' }
      ],
      reward: { gold: 1200, exp: 240 } },

    { id: 'au_harvest', no: 11, season: 'autumn', title: '한가위 줄다리기', stage: '마을 광장', after: 'au_insect',
      blurb: '주민·손님 모두 두 편으로 — 줄다리기 뒤 달 아래 잔치.',
      mix: { past: '줄다리기·송편', now: '찰나의 단체 사진', future: 'K-7이 잔치를 기록' },
      steps: [
        { t: 'talk', scene: 'har1' },
        { t: 'fest', key: 'chuseok' },
        { t: 'heart', n: 3 },
        { t: 'talk', scene: 'har2' }
      ],
      reward: { gold: 1300, exp: 260, feat: 15 } },

    { id: 'au_cave', no: 12, season: 'autumn', title: '북쪽 동굴의 조각', stage: '북쪽 동굴', after: 'au_harvest',
      blurb: '숲지기 부탁 "동굴의 보물" — 동굴 끝에 금의 조각. K-7: "금은 우체통이 부르는 길".',
      mix: { past: '동굴 벽화', now: '탐험가 밧줄', future: '금 조각 결정' },
      steps: [
        { t: 'talk', scene: 'cave1' },
        { t: 'go', spot: 'cave' },
        { t: 'talk', scene: 'cave2' }
      ],
      reward: { gold: 1400, exp: 280 } },

    { id: 'wi_letters', no: 13, season: 'winter', title: '편지가 쌓이는 겨울', stage: '마을 · 옛 우체통', after: 'au_cave',
      blurb: '앞날의 주민들에게서 답장이 온다 — 고맙다는 편지를 주민마다 전한다.',
      mix: { past: '붓글씨 편지', now: '택배 상자', future: '빛 편지' },
      steps: [
        { t: 'talk', scene: 'let1' },
        { t: 'deliver', n: 5 },
        { t: 'heart', n: 5 },
        { t: 'talk', scene: 'let2' }
      ],
      reward: { gold: 1500, exp: 300 } },

    { id: 'wi_dongji', no: 14, season: 'winter', title: '동지 팥죽 나눔', stage: '마을', after: 'wi_letters',
      blurb: '팥죽을 쑤어 손님·주민에게 — 살러 온 손님이 둘 이상이어야 잔치가 찬다.',
      mix: { past: '팥죽 솥', now: '보온 도시락', future: '루미의 온열 장치' },
      steps: [
        { t: 'talk', scene: 'dong1' },
        { t: 'fest', key: 'dongji' },
        { t: 'settle', n: 2 },
        { t: 'talk', scene: 'dong2' }
      ],
      reward: { gold: 1600, exp: 320 } },

    { id: 'wi_newyear', no: 15, season: 'winter', title: '설날 세배 돌기', stage: '마을 전체', after: 'wi_dongji',
      blurb: '주민·살러 온 손님 모두에게 세배.',
      mix: { past: '세배·한복', now: '새해 문자', future: 'K-7의 새해 기록' },
      steps: [
        { t: 'talk', scene: 'ny1' },
        { t: 'fest', key: 'seollal' }
      ],
      reward: { gold: 1700, exp: 340 } },

    { id: 'wi_moon', no: 16, season: 'winter', title: '대보름, 별 우체통', stage: '달집 · 옛 우체통', after: 'wi_newyear',
      blurb: '달집을 태우는 밤, 하늘 금이 우체통 위로 내려와 별 우체통이 된다. "사라진 숲"이 "이어진 숲"으로.',
      mix: { past: '달집', now: '찰나의 마지막 사진', future: '기록판 글자가 바뀜' },
      steps: [
        { t: 'talk', scene: 'moon1' },
        { t: 'fest', key: 'daeborum' },
        { t: 'go', spot: 'ruin' },
        { t: 'talk', scene: 'moon2', by: 'crack' }
      ],
      reward: { gold: 3000, exp: 600, feat: 50, title: '이어진 숲의 이웃' } },

    /* 둘째 해 봄 · 우체통의 답장 — 결말 뒤(별 우체통으로 부친 편지에 여러 시대가 답한다). 손님은 호연 */
    { id: 'y2_reply', no: 17, season: 'spring2', title: '별 우체통의 첫 답장', stage: '마을 · 별 우체통', after: 'wi_moon',
      blurb: '눈 녹은 아침, 지난겨울 부친 편지에 세 시대의 답장이 한꺼번에 도착한다.',
      mix: { past: '붓글씨 봉투', now: '택배 영수증 도장', future: '빛 도장 답신' },
      steps: [
        { t: 'talk', scene: 'rep1' },
        { t: 'deliver', n: 2 },
        { t: 'talk', scene: 'rep2' }
      ],
      reward: { gold: 800, exp: 150 } },

    { id: 'y2_hoyeon', no: 18, season: 'spring2', title: '호연의 답장', stage: '꽃잎 언덕 · 마을', after: 'y2_reply',
      blurb: '여우 화상 호연이 지난해 좌판의 답례로 옛 방울을 내놓는다. 이웃과 정이 쌓여야 방울이 운다.',
      mix: { past: '호연의 옛 방울', now: '호연이 배운 택배 송장', future: '빛 부채 바람' },
      steps: [
        { t: 'talk', scene: 'hoy1' },
        { t: 'gather', cat: 'flower', n: 5 },
        { t: 'talk', scene: 'hoy2' },
        { t: 'heart', n: 6 },
        { t: 'talk', scene: 'hoy3' }
      ],
      reward: { gold: 900, exp: 170, feat: 10 } },

    { id: 'y2_ruin', no: 19, season: 'spring2', title: '다시 쌓는 옛 우체통', stage: '탑성 폐허', after: 'y2_hoyeon',
      blurb: '기록판에 "옛 우체통 복원 미완" 줄이 생긴다. 폐허에서 옛사람과 앞날 사람이 함께 쌓은 흔적을 찾는다.',
      mix: { past: '무너진 탑성 돌', now: '공사용 안전모', future: '설계도 홀로그램' },
      steps: [
        { t: 'talk', scene: 'reb1' },
        { t: 'go', spot: 'ruin' },
        { t: 'talk', scene: 'reb2' },
        { t: 'deliver', n: 1 }
      ],
      reward: { gold: 1000, exp: 190, feat: 10 } },

    { id: 'y2_bloom', no: 20, season: 'spring2', title: '답장이 온 봄', stage: '마을 광장', after: 'y2_ruin',
      blurb: '옛 우체통에 첫 돌이 놓인 날, 삼짇날 꽃놀이로 새 우체통을 알린다. 기록판 줄이 "이어 쌓는 중"으로.',
      mix: { past: '삼짇날 꽃전', now: '마을 소인 답장 엽서', future: '기록판 새 줄' },
      steps: [
        { t: 'talk', scene: 'ans1' },
        { t: 'fest', key: 'samjin' },
        { t: 'talk', scene: 'ans2' }
      ],
      reward: { gold: 3500, exp: 700, feat: 60, title: '답장을 받는 이웃' } },

    /* 둘째 해 여름 · 사진첩의 답장 — 손님은 찰나(현대 사진작가). 봄 호연에 이어 */
    { id: 'y2_album', no: 21, season: 'summer2', title: '찰나의 사진첩', stage: '호수 · 강', after: 'y2_bloom',
      blurb: '소나기가 그친 여름, 찰나가 부친 사진에 옛 화공은 그림으로, 앞날 사람은 빛으로 답장한다. 사진첩을 채울 물고기를 낚는다.',
      mix: { past: '옛 화공의 붓 답장', now: '찰나의 사진첩', future: '빛 물방울 답장' },
      steps: [
        { t: 'talk', scene: 'sal1' },
        { t: 'fish', n: 3 },
        { t: 'talk', scene: 'sal2' }
      ],
      reward: { gold: 1100, exp: 210 } },

    { id: 'y2_lens', no: 22, season: 'summer2', title: '빌려 준 카메라', stage: '푸른 솔숲 · 버섯 요정골', after: 'y2_album',
      blurb: '찰나가 카메라를 빌려 준다. 조용한 두 숲의 여름을 찍는다.',
      mix: { past: '솔숲의 나무꾼 그림자', now: '빌린 카메라', future: '요정골의 손전등 불빛' },
      steps: [
        { t: 'talk', scene: 'lens1' },
        { t: 'forest', key: 'solsup' },
        { t: 'forest', key: 'yoseong' },
        { t: 'talk', scene: 'lens2' }
      ],
      reward: { gold: 1200, exp: 230, feat: 10 } },

    { id: 'y2_night', no: 23, season: 'summer2', title: '반딧불 야간 촬영', stage: '반딧불 참나무숲', after: 'y2_lens',
      blurb: '오래 노출해서 찍은 반딧불 사진에 여러 시대가 보낸 답장 불빛이 줄지어 선다.',
      mix: { past: '반딧불과 옛 등불', now: '달음이 든 삼각대', future: '답장 불빛 줄' },
      steps: [
        { t: 'talk', scene: 'night1' },
        { t: 'forest', key: 'bandi' },
        { t: 'bug', n: 3 },
        { t: 'talk', scene: 'night2' }
      ],
      reward: { gold: 1300, exp: 250, feat: 10 } },

    { id: 'y2_star', no: 24, season: 'summer2', title: '칠석, 한여름의 답장', stage: '마을 광장 · 별 우체통', after: 'y2_night',
      blurb: '칠석날 밤 등불 든 마을 사람들이 별 우체통 앞에서 함께 찍는 사진이 이 여름의 답장이 된다.',
      mix: { past: '칠석 등불', now: '단체 사진', future: '기록판의 사진 한 줄' },
      steps: [
        { t: 'talk', scene: 'end1' },
        { t: 'fest', key: 'chilseok' },
        { t: 'talk', scene: 'end2' }
      ],
      reward: { gold: 3800, exp: 760, feat: 70, title: '한여름의 사진 이웃' } },

    /* 둘째 해 가을 · 앞날의 답장 — 손님은 루미(미래 탐사원) */
    { id: 'y2_rumi', no: 25, season: 'autumn2', title: '루미의 답신', stage: '이끼 돌너덜 · 마을', after: 'y2_star',
      blurb: '우주기지 안테나에 닿은 답신 상자 — 광석으로 만든 열쇠로 열고, 한 통은 배달해야 뜯는다.',
      mix: { past: '옛 붓 편지', now: '도하의 사진 편지', future: '루미 모선의 빛 편지' },
      steps: [
        { t: 'talk', scene: 'rum1' },
        { t: 'gather', cat: 'ore', n: 3 },
        { t: 'talk', scene: 'rum2' },
        { t: 'deliver', n: 1 }
      ],
      reward: { gold: 1400, exp: 270 } },

    { id: 'y2_record', no: 26, season: 'autumn2', title: '기록판의 새 줄', stage: '사고 · 호수', after: 'y2_rumi',
      blurb: '사고에 조개를 채우면 K-7 의 기록판에 "편지를 주고받는 곳" 줄이 뜬다.',
      mix: { past: '사고의 조개 껍데기', now: '전시 조명', future: 'K-7 기록판 새 줄' },
      steps: [
        { t: 'talk', scene: 'rec1' },
        { t: 'donate', cat: 'shell', n: 3 },
        { t: 'talk', scene: 'rec2' }
      ],
      reward: { gold: 1500, exp: 290, feat: 10 } },

    { id: 'y2_moon', no: 27, season: 'autumn2', title: '한가위 답례', stage: '마을 광장', after: 'y2_record',
      blurb: '받은 답장에 답례하는 한가위 — 마을 사람과 마음을 깊이 나눈 뒤 잔치를 연다.',
      mix: { past: '송편과 보름달', now: '달음의 송편 배달', future: '루미가 본 큰 달' },
      steps: [
        { t: 'talk', scene: 'har1' },
        { t: 'heart', n: 8 },
        { t: 'fest', key: 'chuseok' },
        { t: 'talk', scene: 'har2' }
      ],
      reward: { gold: 1600, exp: 310, feat: 10 } },

    { id: 'y2_cavebox', no: 28, season: 'autumn2', title: '동굴 끝의 답장 상자', stage: '북쪽 동굴', after: 'y2_moon',
      blurb: '북쪽 동굴 끝의 마지막 답장 상자 — 앞날의 누군가가 보낸 편지 한 통.',
      mix: { past: '동굴 벽의 옛 글씨', now: '탐험가 밧줄 자국', future: '앞날의 편지' },
      steps: [
        { t: 'talk', scene: 'ccv1' },
        { t: 'cave', n: 1 },
        { t: 'talk', scene: 'ccv2' }
      ],
      reward: { gold: 4200, exp: 820, feat: 80, title: '앞날의 답장을 여는 이웃' } },

    /* 둘째 해 겨울 · 이어 쓰는 숲(세 시대) — 겨울 네 장 결말 */
    { id: 'y2_wletter', no: 29, season: 'winter2', title: '겨울 편지 답례', stage: '마을 · 옛 우체통', after: 'y2_cavebox',
      blurb: '올해는 이쪽에서 먼저 편지를 돌린다. 배달 다섯.',
      mix: { past: '붓글씨 편지', now: '달음의 눈길 배달', future: '빛 편지' },
      steps: [
        { t: 'talk', scene: 'wl1' },
        { t: 'deliver', n: 5 },
        { t: 'talk', scene: 'wl2' }
      ],
      reward: { gold: 1800, exp: 340 } },

    { id: 'y2_wdongji', no: 30, season: 'winter2', title: '동지 답례', stage: '마을', after: 'y2_wletter',
      blurb: '마음이 여덟 이상 깊어진 이웃과 동지 팥죽을 나눈다.',
      mix: { past: '팥죽 솥', now: '김 속 사진', future: '방울과 빛' },
      steps: [
        { t: 'talk', scene: 'wd1' },
        { t: 'heart', n: 8 },
        { t: 'fest', key: 'dongji' },
        { t: 'talk', scene: 'wd2' }
      ],
      reward: { gold: 1900, exp: 360, feat: 10 } },

    { id: 'y2_wyear', no: 31, season: 'winter2', title: '설날, 새 편지', stage: '마을 전체', after: 'y2_wdongji',
      blurb: '세배 돌이에 편지 한 통씩을 들고 간다.',
      mix: { past: '세배와 한복', now: '새해 소인', future: '모선의 새해 편지' },
      steps: [
        { t: 'talk', scene: 'wy1' },
        { t: 'fest', key: 'seollal' },
        { t: 'talk', scene: 'wy2' }
      ],
      reward: { gold: 2000, exp: 380, feat: 10 } },

    { id: 'y2_wmoon', no: 32, season: 'winter2', title: '두 번째 대보름', stage: '달집 · 옛 우체통', after: 'y2_wyear',
      blurb: '별 우체통과 옛 우체통이 나란히 선 밤, 기록판 "복원 미완" 줄이 "이어진 우체통"이 된다.',
      mix: { past: '달집', now: '마지막 단체 사진', future: '기록판 마지막 줄' },
      steps: [
        { t: 'talk', scene: 'wm1' },
        { t: 'fest', key: 'daeborum' },
        { t: 'go', spot: 'ruin' },
        { t: 'talk', scene: 'wm2' }
      ],
      reward: { gold: 6000, exp: 1200, feat: 120, title: '두 해째의 이어진 숲의 이웃' } }
  ];

  var SEASONS = { spring: '봄 · 옛 우체통', summer: '여름 · 금으로 온 손님들', autumn: '가을 · 앞날의 기록', winter: '겨울 · 이어진 숲', spring2: '둘째 해 봄 · 우체통의 답장', summer2: '둘째 해 여름 · 사진첩의 답장', autumn2: '둘째 해 가을 · 앞날의 답장', winter2: '둘째 해 겨울 · 이어 쓰는 숲' };

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
  global.DG.scenarioData = { CAST: CAST, SCENES: SCENES, CHAPTERS: CHAPTERS, SEASONS: SEASONS, chapter: chapter, choiceOf: choiceOf };
})(window);
