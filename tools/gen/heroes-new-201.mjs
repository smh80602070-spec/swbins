#!/usr/bin/env node
/**
 * W-0116 — 도감 299 → 500: 새로 지은 가상 인물 201명을 다섯 판 도감 `saga-web/<판>/js/data.js` 에 한 절씩 붙인다.
 * 다시 돌리면 같은 결과(그 절들만 갈아 끼운다 — 이웃 절 W-0115 사가천하 장수는 안 건드린다).
 *
 *   node tools/gen/heroes-new-201.mjs          다섯 벌 data.js 를 쓴다
 *   node tools/gen/heroes-new-201.mjs --check  지금 파일이 생성 결과와 같은지만(다르면 종료 1)
 *
 * 전부 지은 인물이다(실존·원작 인물 아님 — 이름 정책). 퓨전(과거·현대·미래 한 자리, 09-24): 가상 나라 묶음 22 × 9 + 전설 3.
 *   과거 8 묶음 era `<나라>(가상)` · 현대 7 era `현대` · 미래 7 era `미래` · 전설 era `전설`.
 * 새 인물엔 `late: true` — 굽힌 에셋(초상·2D 시트·서명 무예)이 아직 없다는 표시. vroid-variant 셈·두 칸 판정, 사가나락 첫 동료·사가종횡 첫 몸,
 *   사가나락 데이터 수·서명 무예·2D 시트 진단이 `realm` 과 같이 뺀다(안 빼면 원래 105 의 색이 바뀐다).
 * 능력치는 id 해시 mulberry32 로 등급·기질 범위 안에서 결정적. 이름·id 가 지금 도감과 겹치면 멈춘다.
 * 표 한 줄 = '접미|이름|한자|기질(m 무·w 지·v 덕)|이모지|세력 번호|대사|열전'
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { patchSections, stripSections } from './data-section.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const MARK = '    // ── 새 가상 인물(W-0116) ──';
const check = process.argv.includes('--check');

const A = [5, 5, 4, 4, 4, 3, 3, 3, 3], B1 = [5, 4, 4, 4, 3, 3, 3, 3, 2], B2 = [5, 4, 4, 4, 4, 3, 3, 3, 3];
const GROUPS = [
  /* ── 과거 8 ── */
  { pre: 'aq', era: '사하(가상)', rar: A, color: '#c9a24a', factions: [['사하 성읍', '沙'], ['모래 대상', '商']], rows: [
    'yeolsa|열사|熱沙|m|🏜️|0|모래바람이 불면 내 칼도 같이 운다.|모래폭풍 속에서도 성문을 닫지 않고 사막 성읍을 홀로 지켜 낸 수문장.',
    'nokju|녹주|綠洲|v|🌴|0|물 한 모금이 사람을 살린다.|오아시스 우물을 다스리는 성주. 물을 공평하게 나눠 성읍의 다툼을 없앴다.',
    'gyeongbong|경봉|輕鋒|m|🗡️|1|짐보다 빠른 칼, 그게 대상의 법이다.|대상 행렬을 노리는 도적을 번번이 쫓아낸 호위대장.',
    'sanghwa|상화|商火|w|🪙|1|값은 흥정이 아니라 믿음으로 정해지오.|다섯 나라 말을 하며 낙타 백 마리를 부린 대상 우두머리.',
    'byeolgil|별길|星路|w|✨|1|길을 잃으면 하늘을 보시오.|별자리로 사막길을 읽는 길잡이. 그가 이끈 대상은 길을 잃은 적이 없다.',
    'dalgu|달구|達駒|v|🐪|1|낙타는 서두르지 않지만 멈추지도 않는다.|지친 짐승을 먼저 쉬게 하는 늙은 낙타지기.',
    'sapung|사풍|沙風|m|🌪️|0|바람을 등지면 반은 이긴 거다.|모래바람을 타고 싸우는 기병. 적이 눈을 뜨기 전에 이미 지나간다.',
    'cheongok|청옥|靑玉|w|💎|0|깨지기 쉬워도 빛은 곱지요.|유리 공방의 장인. 그가 분 잔은 멀리 동쪽 궁궐까지 팔려 갔다.',
    'saebom|새봄|新春|v|🌼|0|모래 위에도 꽃은 핀다.|사막 가장자리에 밭을 일군 농사꾼. 첫 싹이 오른 날 성읍이 잔치를 열었다.',
  ] },
  { pre: 'yk', era: '운령(가상)', rar: A, color: '#7f9fb5', factions: [['운령 관문', '嶺'], ['고원 유목', '牧']], rows: [
    'unsu|운수|雲守|m|🏔️|0|이 관문을 넘으려면 나를 먼저 넘어라.|구름 위 관문을 삼십 년 지킨 장수. 그가 선 동안 관문은 한 번도 뚫리지 않았다.',
    'cheonro|천로|天路|w|🧭|0|길은 산이 내주는 만큼만 열린다.|고원을 가로지르는 비단길을 처음 그려 낸 측량가.',
    'baekyeong|백영|白纓|m|🐎|1|말이 지치면 나도 지친다. 그래서 우린 안 지친다.|흰 갈기 말을 탄 유목 기수. 하루에 세 고개를 넘었다.',
    'seolmae|설매|雪梅|v|❄️|1|추위는 나눌수록 덜하다.|눈 속 천막촌을 돌보는 촌장. 겨울마다 양식을 고루 나눴다.',
    'amsu|암수|巖守|m|🪨|0|돌은 말이 없지만 무너지지도 않는다.|관문 성벽을 손수 쌓은 석수 출신 수비병.',
    'hyangdo|향도|香道|w|🍵|1|차 한 잔이면 적도 손님이 된다.|고원 찻길의 상인. 차 한 덩이로 두 부족의 싸움을 말렸다.',
    'sanyeom|산염|山鹽|v|🧂|0|소금 없이는 아무도 겨울을 못 넘는다.|고원 소금 우물을 지키는 일꾼들의 우두머리.',
    'pungdeung|풍등|風燈|w|🏮|0|바람에 띄운 등불이 길을 알린다.|봉우리마다 등불을 올려 소식을 잇던 신호지기.',
    'jinbaek|진백|眞白|m|🦅|1|매가 먼저 보고, 나는 그다음에 친다.|매를 부려 사냥하는 고원의 사냥꾼.',
  ] },
  { pre: 'hq', era: '해궁(가상)', rar: B1, color: '#2f7fae', factions: [['해궁', '宮'], ['진주 선단', '珠']], rows: [
    'yongpa|용파|龍波|m|🌊|0|바다가 성나면 나도 성난다.|해궁의 수군 대장. 폭풍 속에서 함대를 한 척도 잃지 않고 돌아왔다.',
    'jugwang|주광|珠光|v|🦪|1|깊이 잠길수록 빛나는 게 있다.|진주 선단을 이끄는 선장. 건진 진주를 마을과 똑같이 나눴다.',
    'mulgyeol|물결|水紋|w|🐚|0|물결 무늬만 봐도 내일 날씨를 안다.|바다를 읽는 점성가. 그의 예보로 배들이 폭풍을 피했다.',
    'eodeok|어덕|漁德|v|🎣|1|그물은 넓게, 욕심은 좁게.|어부들의 촌장. 어린 물고기는 늘 바다로 돌려보냈다.',
    'sanho|산호|珊瑚|w|🪸|0|산호는 천천히 자라도 무너지지 않는다.|바닷속 지도를 모은 해궁의 서고지기.',
    'jamsu|잠수|潛手|m|🤿|1|숨 한 번이면 바닥까지 간다.|선단 최고의 잠수꾼. 가라앉은 배를 혼자 건져 올렸다.',
    'dotdae|돛대|檣柱|m|⛵|1|바람이 없으면 노를 저으면 된다.|찢어진 돛을 바람 속에서 꿰맨 갑판장.',
    'haeryeong|해령|海靈|w|🐋|0|고래가 노래하면 바다가 잠잠해진다.|고래와 이야기한다는 해궁의 무녀.',
    'gaebeol|갯벌|潟原|v|🦀|1|갯벌은 물이 빠져야 보입니다.|갯벌에서 조개를 캐며 마을 아이들을 키운 사람.',
  ] },
  { pre: 'bw', era: '북원(가상)', rar: B2, color: '#8a7a5a', factions: [['북원 부족', '原'], ['설원 기마', '騎']], rows: [
    'cheolgi|철기|鐵騎|m|🐎|1|말발굽 소리가 곧 내 대답이다.|북원 설원 기마대를 이끈 대족장. 눈보라 속에서도 대열을 잃지 않았다.',
    'seolgu|설구|雪駒|m|🐺|1|늑대처럼 무리로, 늑대처럼 조용히.|눈밭에 발자국을 남기지 않는다는 설원의 척후 기수.',
    'gamu|가무|歌舞|v|🎶|0|노래가 끊기지 않으면 부족도 안 끊긴다.|부족의 옛 노래를 외워 전하는 이야기꾼.',
    'sungeom|순검|巡劍|m|⚔️|0|초원의 법은 칼끝보다 약속이 먼저다.|부족 사이의 약속을 지키게 하는 순찰 무사.',
    'hwaro|화로|火爐|v|🔥|0|불가에 앉으면 모두 한 식구다.|겨울 천막의 화로를 지키는 늙은 족장 어머니.',
    'sangwol|상월|霜月|w|🌙|0|서리 내린 달밤엔 발자국이 다 보인다.|달빛 아래 짐승 발자국을 읽는 사냥 길잡이.',
    'gomnae|곰내|熊川|m|🐻|1|곰은 겨울에 자도, 나는 안 잔다.|곰 가죽을 두른 장사. 맨손으로 수레를 들었다.',
    'yanggil|양길|羊吉|v|🐑|0|양떼가 배부르면 사람도 배부르다.|초원 목동들의 우두머리.',
    'bitnae|빛내|光川|w|🌌|1|오로라가 뜨는 밤엔 길이 열린다.|북쪽 하늘의 빛을 따라 지도를 그린 별지기.',
  ] },
  { pre: 'gm', era: '금마(가상)', rar: A, color: '#b08a2f', factions: [['금마성', '金'], ['광산 조합', '鑛']], rows: [
    'geumhyeol|금혈|金穴|v|🪙|0|금은 나눌 때 더 빛난다.|금마성의 여왕. 광산에서 난 돈을 길과 다리에 썼다.',
    'myeongseok|명석|明石|w|💎|1|돌 속을 보는 눈이 있으면 산이 말을 건다.|광맥을 귀신같이 찾아내는 광산 조합장.',
    'cheolbu|철부|鐵斧|m|🪓|1|도끼질 한 번에 바위가 갈라진다.|광부 출신으로 성의 장수가 된 사내.',
    'hwangma|황마|黃馬|m|🐴|0|금마성의 말은 금보다 귀하다.|금빛 말을 탄 근위대장.',
    'gaenghwa|갱화|坑火|w|🔦|1|갱도 속 불빛 하나가 백 명을 살린다.|갱도의 등불을 맡은 안전 감독.',
    'jeongdong|정동|精銅|w|⚒️|1|구리는 녹여야 쓸모가 생긴다.|불 앞을 떠나지 않는 제련소 장인.',
    'dolbae|돌배|石舟|v|🛶|1|광석도 사람도 물길로 실어 나른다.|광석을 실어 나르는 뱃사공.',
    'mahyang|마향|馬香|v|🌾|0|말은 좋은 풀을 먹어야 잘 달린다.|성의 마구간을 돌보는 마부.',
    'sanul|산울|山鬱|m|🛡️|0|산이 성벽이고 나는 그 문이다.|산길 요새를 지키는 문지기.',
  ] },
  { pre: 'sn', era: '석남(가상)', rar: B1, color: '#5a8a3a', factions: [['석남', '石'], ['밀림 촌락', '林']], rows: [
    'seokhwan|석환|石桓|m|🗿|0|돌을 쌓듯 나라를 쌓는다.|돌성 석남을 세운 장군.',
    'milhyang|밀향|密香|w|🌿|1|숲은 약초 창고다.|밀림 약초로 역병을 막아 낸 의원.',
    'horang|호랑|虎狼|m|🐅|1|숲에선 내가 길이다.|호랑이와 함께 다니는 밀림의 사냥꾼.',
    'nuri|누리|世界|v|🌏|0|모두가 누리는 게 나라다.|돌성과 밀림을 하나로 묶은 석남의 재상.',
    'deonggul|덩굴|蔓索|m|🪢|1|덩굴은 끊어도 다시 자란다.|덩굴줄로 나무 사이를 오가는 정찰병.',
    'gojeok|고적|古蹟|w|📜|0|돌에 새긴 글은 천 년을 간다.|돌비석을 새기는 기록관.',
    'ppuri|뿌리|根本|v|🌳|1|뿌리가 깊으면 바람에 안 쓰러진다.|숲의 큰 나무를 지키는 촌락 어른.',
    'bitdol|빛돌|光石|w|💡|0|어둠 속에서 빛나는 돌을 찾았다.|빛나는 돌을 등불로 쓴 발명가.',
    'saessak|새싹|新芽|v|🌱|1|작아도 자라는 중이다.|촌락의 어린 약초꾼.',
  ] },
  { pre: 'dk', era: '대곡(가상)', rar: A, color: '#9a6a3a', factions: [['대곡', '谷'], ['계곡 수호대', '守']], rows: [
    'gyedo|계도|溪刀|m|🗡️|1|계곡의 물처럼 끊임없이 친다.|계곡 수호대의 검객. 쉬지 않는 칼로 이름났다.',
    'pungnyeon|풍년|豐年|v|🌾|0|밭이 웃어야 나라가 웃는다.|대곡의 농사를 맡은 대신.',
    'suro|수로|水路|w|💧|0|물길을 바꾸면 땅이 바뀐다.|계곡에 수로를 내어 메마른 밭을 살린 기술자.',
    'amgyeol|암결|巖結|m|🧗|1|절벽은 오르는 사람에게만 길을 내준다.|절벽을 타는 수호대원.',
    'meari|메아리|山響|w|📣|1|계곡에선 한 마디가 열 마디가 된다.|메아리로 신호를 보내는 전령.',
    'gulttuk|굴뚝|煙突|v|🏭|0|연기가 오르면 밥 짓는 집이 있다는 뜻이다.|대곡 장터의 대장간 주인.',
    'jeoljeong|절정|絶頂|m|⛰️|1|꼭대기에 서야 다 보인다.|봉우리 망루의 파수꾼.',
    'mullae|물레|紡車|v|🧵|0|실을 자으면 마음도 가지런해진다.|베 짜는 마을의 장인.',
    'saneum|산음|山陰|w|🌫️|0|안개 속에서도 길은 있다.|계곡 안개를 읽는 길잡이.',
  ] },
  { pre: 'hl', era: '화림(가상)', rar: B2, color: '#c25a8a', factions: [['화림 서원', '書'], ['화림 궁', '花']], rows: [
    'hwaseo|화서|花書|w|📚|0|꽃이 피듯 글도 때가 되면 핀다.|화림 서원의 원장. 신분을 묻지 않고 학생을 받았다.',
    'baekhwa|백화|百花|v|🌸|1|백 가지 꽃이 피어야 봄이다.|화림 궁의 공주. 백성의 목소리를 듣는 날을 정했다.',
    'mukhyang|묵향|墨香|w|🖌️|0|먹 향기에 생각이 고인다.|서원의 서예가.',
    'geumsil|금실|錦絲|v|🧶|1|비단 한 필에 마을 한 해가 들어 있다.|궁의 비단 장인.',
    'gyeongun|경운|耕雲|w|☁️|0|구름을 갈아 비를 부른다는 말이 있지요.|날씨를 연구하는 서원 학자.',
    'damhwa|담화|談話|w|💬|0|말이 통하면 칼이 필요 없다.|외교를 맡은 서원 출신 사신.',
    'kkotbi|꽃비|花雨|m|🌺|1|꽃잎처럼 가볍게, 칼끝처럼 날카롭게.|궁의 호위 무사. 칼춤이 꽃비 같았다.',
    'jeongwon|정원|庭園|v|🏡|1|정원을 가꾸듯 사람을 가꾼다.|궁의 정원사.',
    'noeul|노을|夕霞|w|🌇|0|해가 질 때 가장 붉다.|늦은 나이에 서원에 들어온 늙은 학생.',
  ] },
  /* ── 현대 7 ── */
  { pre: 'nc', era: '현대', rar: A, color: '#d94ab0', factions: [['네온시 순찰대', '巡'], ['네온 상가', '市']], rows: [
    'bitsal|빛살|光矢|m|🚨|0|사이렌이 울리면 내가 간다.|네온시 순찰대 대장. 밤거리의 사건은 그가 먼저 닿았다.',
    'baekdo|백도|白道|w|🖥️|1|모든 문은 코드로 열린다.|상가 뒷골목의 천재 해커.',
    'hwalgi|활기|活氣|v|🛍️|1|손님이 웃어야 가게가 산다.|네온 상가 상인회장.',
    'yagyeong|야경|夜警|m|🔦|0|밤이 길수록 눈은 밝아진다.|야간 순찰 조장.',
    'sinho|신호|信號|w|🚦|0|신호만 잘 맞춰도 사고는 반으로 준다.|도시 교통 관제사.',
    'ullim|울림|響音|v|🎤|1|골목에도 노래는 필요하다.|골목 공연가.',
    'geori|거리|街路|m|🛹|1|길은 뛰는 사람 것이다.|스케이트보드를 타는 배달꾼.',
    'hamseong|함성|喊聲|v|📢|0|같이 외치면 무섭지 않다.|시민 모임 대표.',
    'jeongmyeong|정명|正明|w|🕵️|0|단서는 늘 사소한 데 있다.|사설 탐정.',
  ] },
  { pre: 'cs', era: '현대', rar: B2, color: '#6a6f7a', factions: [['철로 상회', '鐵'], ['기관사 조합', '機']], rows: [
    'cheolgil|철길|鐵路|v|🚂|0|철길이 닿는 곳에 장이 선다.|철로 상회 회장. 끊긴 노선을 다시 이어 마을을 살렸다.',
    'gijeok|기적|汽笛|m|🚆|1|기적 소리가 들리면 비켜서라.|급행열차 기관사.',
    'yeokjang|역장|驛長|v|🏷️|0|기차는 늦어도 손님은 기다리게 하지 않는다.|작은 역의 역장.',
    'hwamul|화물|貨物|w|📦|0|짐은 무게보다 순서다.|화물 배차 담당.',
    'seoktan|석탄|石炭|m|⛏️|1|불을 지키는 게 내 일이다.|기관차의 화부.',
    'gyeongjeok|경적|警笛|w|🔔|1|건널목은 내가 지킨다.|건널목지기.',
    'jeongbi|정비|整備|w|🔧|1|나사 하나가 기차를 세운다.|차량 정비사.',
    'seungmu|승무|乘務|v|🎫|0|손님 이름은 다 외웁니다.|열차 승무원.',
    'noseon|노선|路線|w|🗺️|0|선 하나 긋는 데 일 년이 걸렸다.|노선 설계사.',
  ] },
  { pre: 'mh', era: '현대', rar: B1, color: '#d94a4a', factions: [['무하 의료단', '醫'], ['응급 구조대', '救']], rows: [
    'muha|무하|無瑕|v|🩺|0|아픈 사람 앞에선 편이 없다.|무하 의료단을 세운 의사. 전쟁터 양편을 가리지 않고 치료했다.',
    'gugeup|구급|救急|m|🚑|1|삼 분이면 간다.|응급 구조대장.',
    'bungdae|붕대|繃帶|v|🩹|0|상처는 감싸 주면 아문다.|야전 간호사.',
    'yakseon|약선|藥膳|w|💊|0|약도 밥도 정성이다.|의료단의 약사.',
    'maekbak|맥박|脈搏|w|❤️|0|맥을 짚으면 마음까지 보인다.|심장 전문의.',
    'sabang|사방|四方|m|🧯|1|불길 속에도 길은 있다.|소방 구조대원.',
    'onyu|온유|溫柔|v|🤲|0|손을 잡아 주는 것도 치료다.|호스피스 봉사자.',
    'gangin|강인|强靭|m|💪|1|들것 하나는 혼자 든다.|들것 운반병.',
    'ganhui|간희|看喜|v|🍼|0|아기 울음이 제일 반가운 소리예요.|신생아실 견습 간호사.',
  ] },
  { pre: 'js', era: '현대', rar: B2, color: '#3a6ad9', factions: [['진성 방송국', '放'], ['현장 취재반', '取']], rows: [
    'bodo|보도|報道|w|📺|0|사실은 한 번만 말해도 충분하다.|진성 방송국 보도국장.',
    'hyeonjang|현장|現場|m|🎥|1|카메라는 뒤로 물러서지 않는다.|분쟁 지역을 누빈 취재 기자.',
    'jeonpa|전파|電波|w|📡|0|전파는 산도 넘는다.|송신소 기술자.',
    'eumseong|음성|音聲|v|🎙️|0|목소리에도 표정이 있다.|새벽 라디오 진행자.',
    'teukjong|특종|特種|w|📰|1|기다리면 온다, 특종은.|특종 기자.',
    'jamak|자막|字幕|w|⌨️|0|한 글자도 틀리면 안 된다.|생방송 자막 담당.',
    'jomyeong|조명|照明|v|💡|0|빛을 잘 두면 누구나 주인공이다.|스튜디오 조명 감독.',
    'dalli|달리|疾馳|m|🏍️|1|기사는 오토바이보다 빨라야 한다.|오토바이 취재원.',
    'saengbang|생방|生放|v|⏱️|0|삼, 이, 일, 큐.|생방송 무대 감독.',
  ] },
  { pre: 'kd', era: '현대', rar: A, color: '#3aa0a8', factions: [['청람 공대', '工'], ['로봇 동아리', '機']], rows: [
    'cheongram|청람|靑嵐|w|🎓|0|질문이 멈추면 공부도 멈춘다.|청람 공대 총장.',
    'cheolsim|철심|鐵心|m|🤖|1|내 로봇은 넘어져도 다시 선다.|로봇 대회 우승팀 주장.',
    'hoero|회로|回路|w|🔌|1|전기는 거짓말을 안 한다.|회로 설계 대학원생.',
    'seolgye|설계|設計|w|📐|0|도면이 맞으면 다리는 안 무너진다.|건축 교수.',
    'yongjeop|용접|鎔接|m|🔥|1|불꽃이 튀어야 붙는다.|공방 용접 조교.',
    'silheom|실험|實驗|w|🧪|0|실패도 결과다.|화학 실험실 연구원.',
    'nalgae|날개|飛翼|v|🛩️|1|날개는 같이 만들어야 난다.|모형 비행기 동아리장.',
    'seorim|서림|書林|v|📖|0|책은 빌려 가도 생각은 남는다.|공대 도서관 사서.',
    'jeonji|전지|電池|w|🔋|0|충전은 쉬는 시간이다.|배터리 연구 신입생.',
  ] },
  { pre: 'rg', era: '현대', rar: B1, color: '#e07a2a', factions: [['질주 리그', '走'], ['정비 팀', '整']], rows: [
    'jilju|질주|疾走|m|🏎️|0|브레이크는 이길 때 밟는 거다.|질주 리그 챔피언.',
    'suri|수리|修理|w|🔧|1|십 초면 바퀴 넷.|정비 팀장.',
    'gyeolseung|결승|決勝|m|🏁|0|결승선 앞에서 진짜 경주가 시작된다.|베테랑 레이서.',
    'gyesan|계산|計算|w|📊|1|바퀴 닳는 속도까지 계산한다.|레이스 전략가.',
    'eungwon|응원|應援|v|📣|0|함성이 바퀴를 민다.|응원단장.',
    'saekdong|색동|色動|v|🎨|1|차도 옷을 입는다.|차체 도색 장인.',
    'jagal|자갈|礫石|m|🪨|1|포장도로는 심심하다.|비포장 랠리 선수.',
    'singi|신기|新機|w|⚙️|1|엔진은 소리로 안다.|엔진 튜너.',
    'yeonseup|연습|練習|v|🚩|0|오늘도 한 바퀴만 더.|견습 드라이버.',
  ] },
  { pre: 'hb', era: '현대', rar: B2, color: '#4a8ad9', factions: [['하늘 비행단', '飛'], ['관제탑', '塔']], rows: [
    'bisang|비상|飛翔|m|✈️|0|하늘에선 망설이면 떨어진다.|하늘 비행단장.',
    'gwanje|관제|管制|w|🗼|1|하늘에도 길이 있고, 그 길은 내가 정한다.|관제탑 수석.',
    'sangae|산개|傘開|m|🪂|0|떨어지는 게 아니라 내려가는 거다.|낙하산 구조대원.',
    'gyeongro|경로|經路|w|🧭|1|구름 사이로 지름길이 있다.|비행단 항법사.',
    'hwaljuro|활주로|滑走路|v|🛬|1|모두 무사히 내리면 그게 오늘의 승리다.|활주로 정비반장.',
    'gisang|기상|氣象|w|🌦️|1|구름 모양이 내일을 말해 준다.|기상 관측원.',
    'seonhoe|선회|旋回|m|🌀|0|돌아서 가는 게 빠를 때도 있다.|곡예 비행사.',
    'jeomgeom|점검|點檢|v|📋|0|목록을 다 지워야 이륙한다.|이륙 전 점검 담당.',
    'mangwon|망원|望遠|w|🔭|0|멀리 봐야 안전하다.|망원경을 든 견습 관제사.',
  ] },
  /* ── 미래 7 ── */
  { pre: 'ob', era: '미래', rar: A, color: '#5a6ad9', factions: [['궤도 정거장', '軌'], ['우주 정비단', '宙']], rows: [
    'gongjeon|공전|公轉|v|🛰️|0|떨어지지 않는 건 계속 돌기 때문이다.|궤도 정거장의 사령관.',
    'seongun|성운|星雲|w|🌌|0|별이 태어나는 곳을 봤다.|정거장의 천문학자.',
    'mujung|무중|無重|m|🧑‍🚀|1|무게가 없으면 힘은 방향이다.|선외 활동 대원.',
    'sanso|산소|酸素|v|🫧|1|숨 쉬는 공기도 누군가 만든다.|생명 유지 담당.',
    'taeyang|태양|太陽|w|☀️|1|빛을 모으면 다 된다.|태양 전지판 기술자.',
    'yeonryo|연료|燃料|m|⛽|1|연료통이 찰 때까지 안 쉰다.|보급선 조종사.',
    'tongsin|통신|通信|w|📻|0|지구까지 삼 초 걸린다.|정거장 통신관.',
    'jungnyeok|중력|重力|m|🏋️|0|돌아가면 몸이 무거워진다, 그러니 지금 단련한다.|체력 담당 교관.',
    'byeolbit|별빛|星光|v|⭐|0|창밖이 늘 밤이라 별빛이 친구다.|정거장에서 태어난 아이.',
  ] },
  { pre: 'ac', era: '미래', rar: B2, color: '#2a8a9a', factions: [['아크 해저도시', '方'], ['심해 탐사대', '深']], rows: [
    'simyeon|심연|深淵|w|🌊|1|가장 깊은 곳이 가장 조용하다.|심해 탐사대장.',
    'suap|수압|水壓|m|🤿|1|누르는 만큼 버틴다.|심해 잠수병.',
    'haecho|해초|海草|v|🌿|0|바닷속 밭도 밭이다.|해저 농장 관리인.',
    'gipo|기포|氣泡|w|🫧|0|거품 하나에도 길이 있다.|공기 순환 기술자.',
    'balgwang|발광|發光|w|💡|1|어둠 속에선 빛나는 놈이 이긴다.|발광 생물 연구자.',
    'choeumpa|초음파|超音波|w|🔊|0|소리로 본다.|음파 탐지병.',
    'sumbi|숨비|潛息|m|🐬|0|물속에선 걷지 말고 날아라.|해저도시 경비 잠수정 조종사.',
    'haemun|해문|海門|v|🚪|0|문이 닫히면 다 같이 산다.|에어록 문지기.',
    'haebit|해빛|海光|v|🐚|0|언젠가 진짜 해를 볼 거예요.|해저에서 자란 소녀.',
  ] },
  { pre: 'ns', era: '미래', rar: A, color: '#9a4ad9', factions: [['신경망 도시', '網'], ['접속자 연합', '接']], rows: [
    'singyeong|신경|神經|w|🧠|0|도시 전체가 하나의 생각이다.|신경망 도시의 설계자.',
    'jeopsok|접속|接續|m|🥽|1|접속하면 나는 어디에나 있다.|접속자 연합의 투사.',
    'buho|부호|符號|w|🔣|1|암호는 말 없는 대화다.|암호 해독가.',
    'gieok|기억|記憶|v|💾|0|잊히지 않게 지키는 게 내 일이다.|기억 보관소 관리자.',
    'hakseup|학습|學習|w|📈|1|어제의 나보다 하나 더.|인공지능 조련사.',
    'eungdap|응답|應答|v|💬|0|부르면 대답합니다.|도시 안내 인공지능.',
    'banghwabyeok|방화벽|防火壁|m|🧱|1|여기서부터는 못 지나간다.|도시망의 보안 수호자.',
    'hwamyeon|화면|畫面|v|🖼️|0|보여 주는 게 다가 아니다.|가상 화가.',
    'yeongyeol|연결|連結|v|🔗|0|끊어진 줄도 다시 이을 수 있다.|신입 접속자.',
  ] },
  { pre: 'mr', era: '미래', rar: B2, color: '#c2502a', factions: [['화성 개척단', '火'], ['붉은 사막 기지', '基']], rows: [
    'gaecheok|개척|開拓|m|🚀|0|첫 발자국은 늘 무겁다.|화성 개척단장.',
    'jeoksa|적사|赤沙|m|🏜️|1|붉은 모래는 두렵지 않다.|사막 기지 경비대장.',
    'sumteo|숨터|息處|v|🏠|0|돔 하나가 마을이다.|거주 돔 관리인.',
    'gwangmul|광물|鑛物|w|⛏️|1|화성 돌에도 이야기가 있다.|개척단의 지질학자.',
    'bingha|빙하|氷河|w|🧊|0|얼음 밑에 물이 있다.|지하 얼음 탐사원.',
    'bakwi|바퀴|車輪|m|🛞|1|탐사차는 내 다리다.|탐사차 운전수.',
    'onsil|온실|溫室|v|🍅|0|토마토가 열리면 다 웃는다.|온실 농부.',
    'cheolgu|철구|鐵丘|w|📡|0|언덕 위 안테나가 지구와 우리를 잇는다.|통신 기지 운영자.',
    'cheotbom|첫봄|初春|v|👶|0|나는 화성에서 처음 태어났어요.|화성에서 태어난 첫 아이.',
  ] },
  { pre: 'gr', era: '미래', rar: B1, color: '#3a9a5a', factions: [['녹화 연합', '綠'], ['씨앗 은행', '種']], rows: [
    'nokhwa|녹화|綠化|v|🌳|0|사막도 숲이 될 수 있다.|녹화 연합 대표.',
    'ssiat|씨앗|種子|w|🌰|1|씨앗 하나에 숲 하나가 들어 있다.|씨앗 은행장.',
    'haetbit|햇빛|陽光|w|🌞|0|빛과 물이면 충분하다.|광합성 연구자.',
    'supgil|숲길|林道|m|🥾|1|숲을 지키려면 걸어야 한다.|산림 순찰대원.',
    'kkulbeol|꿀벌|蜜蜂|v|🐝|0|꿀벌이 없으면 꽃도 없다.|양봉가.',
    'iseul|이슬|朝露|w|💧|1|새벽 이슬도 모으면 강이 된다.|이슬 집수 기술자.',
    'bangpung|방풍|防風|m|🌬️|1|바람막이 숲이 마을을 지킨다.|방풍림 조성 대원.',
    'toyang|토양|土壤|w|🪱|0|흙이 살아야 다 산다.|흙 박사.',
    'mojong|모종|苗木|v|🪴|1|오늘 심은 건 내일 그늘이 된다.|묘목 심기 봉사자.',
  ] },
  { pre: 'tw', era: '미래', rar: A, color: '#8a7ad9', factions: [['시간 관측소', '時'], ['시계지기', '計']], rows: [
    'cheonryu|천류|天流|w|⏳|0|시간은 강처럼 흐르고, 나는 그 둑을 지킨다.|시간 관측소장.',
    'hoegwi|회귀|回歸|m|⌛|0|어제로 돌아가 본 적이 있다. 다시는 안 간다.|시간 틈 수색대장.',
    'topni|톱니|齒輪|w|⚙️|1|톱니 하나가 빠지면 시계는 멈춘다.|시계지기 장인.',
    'jongsori|종소리|鐘聲|v|🔔|1|종이 울리면 다들 제자리로.|관측소 종지기.',
    'yegyeon|예견|豫見|w|🔮|0|내일을 미리 본다고 바꿀 수 있는 건 아니다.|미래 관측관.',
    'girok|기록|記錄|v|📜|1|기록되지 않은 시간은 사라진다.|연대기 기록관.',
    'bunchim|분침|分針|m|🕰️|0|일 분이면 충분하다.|시간 틈 경비병.',
    'baekya|백야|白夜|w|🌗|1|해가 안 지는 날엔 시계를 믿는다.|극지 관측원.',
    'jogak|조각|片刻|v|🧩|0|깨진 시간 조각을 모으고 있어요.|견습 시계지기.',
  ] },
  { pre: 'fy', era: '미래', rar: B1, color: '#7ac0e0', factions: [['하늘섬', '空'], ['구름 정원', '雲']], rows: [
    'cheonggong|청공|靑空|m|🏝️|0|섬이 떠 있는 한 나는 떨어지지 않는다.|하늘섬의 수호기사.',
    'unwon|운원|雲園|v|☁️|1|구름도 가꾸면 정원이 된다.|구름 정원의 정원사.',
    'buyang|부양|浮揚|w|🎈|0|섬을 띄우는 건 결국 계산이다.|부양석 기술자.',
    'paran|파란|碧藍|m|🪁|1|바람만 있으면 어디든 간다.|연을 타고 섬 사이를 오가는 전령.',
    'mujigae|무지개|彩虹|v|🌈|1|비가 그치면 다리가 생긴다.|무지개 다리로 짐을 나르는 짐꾼.',
    'seomgil|섬길|島路|w|🗺️|0|섬과 섬 사이에도 길이 있다.|하늘 항로 지도꾼.',
    'ttangkkeut|땅끝|地端|m|🧗|0|끝이라고 생각하면 거기서 끝이다.|섬 가장자리 경비병.',
    'gitteol|깃털|羽毛|w|🪶|1|가볍다고 약한 건 아니다.|새와 함께 사는 섬 학자.',
    'baramgae|바람개|風犬|v|🐕|0|우리 개는 바람 냄새를 맡아요.|섬의 어린 목동.',
  ] },
];
/* ── 전설 3 — 어느 시대에도 속하지 않는다 ── */
const LEGENDS = { pre: 'lg', era: '전설', color: '#c8a84a', factions: [['전설', '傳']], rows: [
  'ilwol|일월|日月|v|🌓|0|해와 달이 함께 뜨는 날, 나는 돌아온다.|과거와 미래가 겹치는 날에만 나타난다는 전설의 왕.',
  'baekgeom|백검|白劍|m|⚔️|0|칼은 천 년을 기다렸다.|어느 시대에도 속하지 않은 떠돌이 검성.',
  'mugyeong|무경|無境|w|🌀|0|경계는 사람이 그은 선일 뿐.|시대의 경계를 걸어 다닌다는 현자.',
] };

/* ── 지금 도감(이 생성기 절을 걷어 낸 모습) — 겹침 검사·세력표 ── */
const sb = { window: { DG: {} }, console, Math, Date };
sb.global = sb.window; sb.self = sb.window;
vm.createContext(sb);
vm.runInContext(stripSections(fs.readFileSync(path.join(ROOT, 'saga-web/saga-go/js/data.js'), 'utf8'), MARK), sb, { filename: 'data.js' });
const D = sb.window.DG.data;
const usedId = new Set(D.heroes.map((h) => h.id)), usedName = new Set(D.heroes.map((h) => h.name));
/* 사가천하 장수 원본(도감에 안 붙은 것까지 — 시간 틈 사람 등)과도 이름·id 가 안 겹치게 */
for (const f of ['saga-web/saga-realm/js/data-force.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
for (const [k, v] of Object.entries(sb.window.DG.forceData || {})) if (/OFFICERS$/.test(k) && Array.isArray(v)) for (const o of v) if (o) { usedId.add(o.id); usedName.add(o.name); }

/* 결정적 능력치 — id 해시 mulberry32 */
function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TRAIT = { m: 'might', w: 'wisdom', v: 'virtue' }, STAT = { m: 'might', w: 'wisdom', v: 'command' };
function stats(id, rarity, t) {
  const r = rng(hash(id)), clamp = (v) => Math.max(18, Math.min(99, Math.round(v)));
  const top = clamp(55 + rarity * 8 + r() * 8 - 4), lift = (rarity - 3) * 4;
  const o = { might: clamp(28 + r() * 46 + lift), wisdom: clamp(28 + r() * 46 + lift), command: clamp(28 + r() * 46 + lift) };
  o[STAT[t]] = top;
  for (const k of Object.keys(o)) if (k !== STAT[t] && o[k] >= top) o[k] = top - 6 - Math.floor(r() * 8);
  return o;
}

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const heroLines = [], bioLines = [], factionLines = [], seenF = new Set(Object.keys(D.factions)), bad = [];
const ids = new Set(), names = new Set();
function addGroup(G, rarOf) {
  G.factions.forEach(([name, mark]) => { if (!seenF.has(name)) { seenF.add(name); factionLines.push(`    ${q(name)}: { color: ${q(G.color)}, mark: ${q(mark)} },`); } });
  G.rows.forEach((row, i) => {
    const [suf, name, hanja, t, emoji, fi, quote, bio] = row.split('|');
    const id = G.pre + '_' + suf, rarity = rarOf(i), faction = G.factions[+fi][0];
    if (!TRAIT[t] || !quote || !bio) bad.push('칸 모자람 ' + id);
    if (usedId.has(id) || ids.has(id)) bad.push('id 겹침 ' + id);
    if (usedName.has(name) || names.has(name)) bad.push('이름 겹침 ' + name + '(' + id + ')');
    ids.add(id); names.add(name);
    const s = stats(id, rarity, t);
    heroLines.push(`    { id: ${q(id)}, name: ${q(name)}, era: ${q(G.era)}, faction: ${q(faction)}, rarity: ${rarity}, trait: ${q(TRAIT[t])}, ` +
      `stats: { might: ${s.might}, wisdom: ${s.wisdom}, command: ${s.command} }, hanja: ${q(hanja)}, emoji: ${q(emoji)}, quote: ${q(quote)}, late: true },`);
    bioLines.push(`    ${id}: ${q(bio)},`);
  });
}
for (const G of GROUPS) { if (G.rows.length !== 9) bad.push(G.pre + ' 줄 수 ' + G.rows.length); addGroup(G, (i) => G.rar[i]); }
addGroup(LEGENDS, () => 5);
if (heroLines.length !== 201) bad.push('합계 ' + heroLines.length + ' ≠ 201');
if (bad.length) { console.error('멈춤 — ' + bad.join(' · ')); process.exit(1); }

const head = (n) => MARK + ` ${n} · 생성 node tools/gen/heroes-new-201.mjs — 손으로 고치지 않는다 ──\n`;
const SECTIONS = [
  { open: '  var HEROES = [', close: '\n  ];', body: head(heroLines.length) + heroLines.join('\n') + '\n' },
  { open: '  var BIOS = {', close: '\n  };', body: head(bioLines.length) + bioLines.join('\n') + '\n' },
  { open: '  var FACTIONS = {', close: '\n  };', body: head(factionLines.length) + factionLines.join('\n') + '\n' },
];

let diff = 0;
for (const g of GAMES) {
  const f = path.join(ROOT, 'saga-web', g, 'js', 'data.js');
  const cur = fs.readFileSync(f, 'utf8');
  const next = patchSections(cur, SECTIONS, MARK);
  if (check) { if (cur !== next) { console.error('다름: ' + path.relative(ROOT, f)); diff++; } continue; }
  if (cur !== next) fs.writeFileSync(f, next);
}
const rc = {}; heroLines.forEach((l) => { const m = /rarity: (\d)/.exec(l); rc[m[1]] = (rc[m[1]] || 0) + 1; });
console.log(`새 가상 인물 ${heroLines.length}(열전 ${bioLines.length} · 새 세력 ${factionLines.length} · 등급 ${Object.keys(rc).sort().reverse().map((k) => k + '성 ' + rc[k]).join(' ')}) → 다섯 판` + (check ? (diff ? ` — 다름 ${diff}` : ' — 최신') : ' — 씀'));
process.exit(diff ? 1 : 0);
