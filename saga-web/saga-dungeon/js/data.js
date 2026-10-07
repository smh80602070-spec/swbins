/**
 * 캐릭터 데이터
 * ---------------------------------------------------------------
 * 코드를 건드리지 않고 이 파일만 늘려서 캐릭터를 추가한다.
 *
 * [인물] 등용(登用) 대상. 삼국지 / 한국사.
 *   id       : 고유키 (도감 저장에 쓰이므로 한 번 정하면 바꾸지 않는다)
 *   name     : 표시 이름
 *   era      : 시대 그룹 (도감 탭 분류)
 *   faction  : 세력 (위/촉/오/고구려/조선 …)
 *   rarity   : 1~5 (높을수록 조우 확률 낮고 요구 명성 높음)
 *   trait    : 'might'(무) | 'wisdom'(지) | 'virtue'(덕)  ← 설득 시 통하는 어필 방향
 *   stats    : 무력/지력/통솔
 *   emoji    : 지도·도감 표시용 (나중에 이미지로 교체 가능)
 *   quote    : 등용 성공 대사
 *
 * [펫] 포획 대상. 실존 동물 + 신수(神獸).
 *   kind     : 'beast'(동물) | 'divine'(신수)
 *   bonus    : 장착 시 인물에게 주는 보정
 *   catchBase: 기본 포획 확률(0~1). 미니게임 정확도로 가감된다.
 */
(function (global) {
  'use strict';

  var HEROES = [
    // ── 삼국지 ─────────────────────────────────────────────
    { id: 'sg_guanyu',    name: '명운',       era: '삼국지', faction: '촉',   rarity: 5, trait: 'virtue', stats: { might: 97, wisdom: 75, command: 95 }, hanja: '明雲', emoji: '🗡️', quote: '의(義)를 아는 이와 함께라면 어디든 가겠소.' },
    { id: 'sg_zhangfei',  name: '뇌호',       era: '삼국지', faction: '촉',   rarity: 4, trait: 'might',  stats: { might: 98, wisdom: 45, command: 80 }, hanja: '雷虎', emoji: '🍶', quote: '술이나 한잔 하며 이야기하세!' },
    { id: 'sg_zhaoyun',   name: '은창',       era: '삼국지', faction: '촉',   rarity: 5, trait: 'virtue', stats: { might: 96, wisdom: 76, command: 91 }, hanja: '銀槍', emoji: '🐎', quote: '한 몸 바쳐 주공을 지키겠습니다.' },
    { id: 'sg_zhugeliang',name: '현책',     era: '삼국지', faction: '촉',   rarity: 5, trait: 'wisdom', stats: { might: 38, wisdom: 100, command: 92 }, hanja: '玄策', emoji: '🪭', quote: '삼고초려의 뜻, 잊지 않겠습니다.' },
    { id: 'sg_liubei',    name: '인형',       era: '삼국지', faction: '촉',   rarity: 5, trait: 'virtue', stats: { might: 72, wisdom: 78, command: 90 }, hanja: '仁衡', emoji: '👑', quote: '백성을 생각하는 마음이 같구려.' },
    { id: 'sg_machao',    name: '서풍',       era: '삼국지', faction: '촉',   rarity: 4, trait: 'might',  stats: { might: 97, wisdom: 44, command: 87 }, hanja: '西風', emoji: '🏇', quote: '서량의 창끝을 빌려주겠다.' },
    { id: 'sg_huangzhong',name: '노궁',       era: '삼국지', faction: '촉',   rarity: 4, trait: 'might',  stats: { might: 93, wisdom: 62, command: 85 }, hanja: '老弓', emoji: '🏹', quote: '늙었다 얕보지 마라!' },
    { id: 'sg_caocao',    name: '패헌',       era: '삼국지', faction: '위',   rarity: 5, trait: 'wisdom', stats: { might: 72, wisdom: 96, command: 98 }, hanja: '霸軒', emoji: '⚔️', quote: '내가 천하를 저버릴지언정, 천하가 나를 저버리게 두지 않는다.' },
    { id: 'sg_simayi',    name: '은인',     era: '삼국지', faction: '위',   rarity: 5, trait: 'wisdom', stats: { might: 63, wisdom: 98, command: 94 }, hanja: '隱忍', emoji: '🕸️', quote: '때를 기다릴 줄 아는 자가 이깁니다.' },
    { id: 'sg_xiahoudun', name: '언무',     era: '삼국지', faction: '위',   rarity: 4, trait: 'might',  stats: { might: 92, wisdom: 58, command: 88 }, hanja: '彦武', emoji: '🩹', quote: '이 한쪽 눈으로도 적은 충분히 보인다.' },
    { id: 'sg_zhangliao', name: '철벽',       era: '삼국지', faction: '위',   rarity: 4, trait: 'might',  stats: { might: 94, wisdom: 78, command: 93 }, hanja: '鐵壁', emoji: '🛡️', quote: '팔백으로 십만을 막아 보이겠소.' },
    { id: 'sg_xunyu',     name: '청안',       era: '삼국지', faction: '위',   rarity: 4, trait: 'wisdom', stats: { might: 30, wisdom: 96, command: 70 }, hanja: '淸眼', emoji: '📜', quote: '왕좌지재(王佐之才)라 불러주시니 부끄럽습니다.' },
    { id: 'sg_sunquan',   name: '벽해',       era: '삼국지', faction: '오',   rarity: 4, trait: 'virtue', stats: { might: 70, wisdom: 86, command: 89 }, hanja: '碧海', emoji: '🔷', quote: '강동은 손을 잡을 줄 아는 자를 반깁니다.' },
    { id: 'sg_zhouyu',    name: '화풍',       era: '삼국지', faction: '오',   rarity: 5, trait: 'wisdom', stats: { might: 71, wisdom: 96, command: 97 }, hanja: '火風', emoji: '🔥', quote: '동남풍이 불면, 그때가 우리의 때입니다.' },
    { id: 'sg_luxun',     name: '담연',       era: '삼국지', faction: '오',   rarity: 4, trait: 'wisdom', stats: { might: 66, wisdom: 95, command: 94 }, hanja: '淡然', emoji: '🌊', quote: '서두르지 않는 것이 제 병법입니다.' },
    { id: 'sg_taishici',  name: '궁성',     era: '삼국지', faction: '오',   rarity: 4, trait: 'might',  stats: { might: 93, wisdom: 66, command: 82 }, hanja: '弓星', emoji: '🎯', quote: '활 솜씨를 보여드리지요.' },
    { id: 'sg_ganning',   name: '영진',       era: '삼국지', faction: '오',   rarity: 3, trait: 'might',  stats: { might: 94, wisdom: 60, command: 79 }, hanja: '鈴陣', emoji: '🔔', quote: '방울 소리가 들리면 이미 늦은 것이다.' },
    { id: 'sg_lubu',      name: '패창',       era: '삼국지', faction: '군웅', rarity: 5, trait: 'might',  stats: { might: 100, wisdom: 26, command: 88 }, hanja: '霸槍', emoji: '🐉', quote: '천하무쌍! 나를 막을 자가 있나?' },
    { id: 'sg_diaochan',  name: '월영',       era: '삼국지', faction: '군웅', rarity: 5, trait: 'virtue', stats: { might: 20, wisdom: 88, command: 40 }, hanja: '月影', emoji: '🌙', quote: '이 몸이 도움이 된다면요.' },
    { id: 'sg_pangtong',  name: '봉래',       era: '삼국지', faction: '촉',   rarity: 4, trait: 'wisdom', stats: { might: 40, wisdom: 97, command: 80 }, hanja: '鳳來', emoji: '🦅', quote: '봉래가 여기 있습니다.' },
    { id: 'sg_huatuo',    name: '신침',       era: '삼국지', faction: '재야', rarity: 4, trait: 'virtue', stats: { might: 15, wisdom: 92, command: 20 }, hanja: '神鍼', emoji: '💊', quote: '사람을 살리는 일이라면 함께하지요.' },
    { id: 'sg_menghuo',   name: '만왕',       era: '삼국지', faction: '남만', rarity: 3, trait: 'might',  stats: { might: 88, wisdom: 40, command: 76 }, hanja: '蠻王', emoji: '🐘', quote: '일곱 번 져도 여덟 번 일어난다!' },

    // ── 한국사 ─────────────────────────────────────────────
    { id: 'kr_yisunsin',  name: '해장',     era: '한국사', faction: '조선',   rarity: 5, trait: 'virtue', stats: { might: 92, wisdom: 98, command: 100 }, hanja: '海將', emoji: '🚢', quote: '아직 신에게는 열두 척의 배가 남아 있사옵니다.' },
    { id: 'kr_euljimundeok', name: '현묘', era: '한국사', faction: '고구려', rarity: 5, trait: 'wisdom', stats: { might: 88, wisdom: 97, command: 98 }, hanja: '玄妙', emoji: '🌊', quote: '만족함을 알고 그만두기를 권하노라.' },
    { id: 'kr_ganggamchan',  name: '강우',   era: '한국사', faction: '고려',   rarity: 5, trait: 'wisdom', stats: { might: 80, wisdom: 96, command: 97 }, hanja: '江雨', emoji: '⛰️', quote: '강물을 터뜨릴 준비는 끝났소.' },
    { id: 'kr_kimyusin',  name: '화랑준',     era: '한국사', faction: '신라',   rarity: 5, trait: 'might',  stats: { might: 95, wisdom: 88, command: 96 }, hanja: '花郞俊', emoji: '🗡️', quote: '삼한을 하나로 잇겠소.' },
    { id: 'kr_gyebaek',   name: '결사',       era: '한국사', faction: '백제',   rarity: 4, trait: 'might',  stats: { might: 94, wisdom: 70, command: 90 }, hanja: '決死', emoji: '🛡️', quote: '오천으로 오만을 맞겠다.' },
    { id: 'kr_yeongaesomun', name: '철령', era: '한국사', faction: '고구려', rarity: 5, trait: 'might', stats: { might: 96, wisdom: 82, command: 95 }, hanja: '鐵嶺', emoji: '🪓', quote: '요동의 성벽은 무너지지 않는다.' },
    { id: 'kr_gwanggaeto',name: '정복왕', era: '한국사', faction: '고구려', rarity: 5, trait: 'might',  stats: { might: 97, wisdom: 85, command: 99 }, hanja: '征服王', emoji: '🏇', quote: '북으로, 더 북으로 나아가자.' },
    { id: 'kr_sejong',    name: '훈민',   era: '한국사', faction: '조선',   rarity: 5, trait: 'wisdom', stats: { might: 40, wisdom: 100, command: 95 }, hanja: '訓民', emoji: '📖', quote: '백성이 쉽게 익혀 날로 쓰게 하고자 함이라.' },
    { id: 'kr_jangyeongsil', name: '성시',  era: '한국사', faction: '조선',   rarity: 4, trait: 'wisdom', stats: { might: 25, wisdom: 97, command: 45 }, hanja: '星時', emoji: '⏱️', quote: '해 그림자로 시간을 재어 보이겠습니다.' },
    { id: 'kr_choemuseon',name: '화포공',     era: '한국사', faction: '고려',   rarity: 4, trait: 'wisdom', stats: { might: 55, wisdom: 94, command: 70 }, hanja: '火砲工', emoji: '🧨', quote: '화약이라면 제게 맡기시지요.' },
    { id: 'kr_daejoyeong',name: '요동패',     era: '한국사', faction: '발해',   rarity: 5, trait: 'command',stats: { might: 90, wisdom: 88, command: 96 }, hanja: '遼東覇', emoji: '🌅', quote: '고구려의 뒤를 잇겠소.' },
    { id: 'kr_wanggeon',  name: '통합공',       era: '한국사', faction: '고려',   rarity: 5, trait: 'virtue', stats: { might: 82, wisdom: 88, command: 94 }, hanja: '統合公', emoji: '👑', quote: '흩어진 것을 다시 모으는 일이오.' },
    { id: 'kr_jeongyakyong', name: '만기',  era: '한국사', faction: '조선',   rarity: 4, trait: 'wisdom', stats: { might: 20, wisdom: 98, command: 60 }, hanja: '萬機', emoji: '🏗️', quote: '거중기로 백성의 짐을 덜겠습니다.' },
    { id: 'kr_heojun',    name: '활인',       era: '한국사', faction: '조선',   rarity: 4, trait: 'virtue', stats: { might: 15, wisdom: 95, command: 40 }, hanja: '活人', emoji: '🌿', quote: '병 앞에 귀천이 어디 있겠습니까.' },
    { id: 'kr_sinsaimdang', name: '초충당', era: '한국사', faction: '조선',   rarity: 4, trait: 'virtue', stats: { might: 12, wisdom: 92, command: 55 }, hanja: '草蟲堂', emoji: '🎨', quote: '붓끝에 마음을 담을 뿐입니다.' },
    { id: 'kr_ahnjunggeun', name: '동양평',   era: '한국사', faction: '대한제국', rarity: 5, trait: 'virtue', stats: { might: 88, wisdom: 90, command: 85 }, hanja: '東洋平', emoji: '🕊️', quote: '하루라도 글을 읽지 않으면 입에 가시가 돋는다.' },
    { id: 'kr_yugwansun', name: '소녀화',     era: '한국사', faction: '일제강점기', rarity: 5, trait: 'virtue', stats: { might: 60, wisdom: 80, command: 88 }, hanja: '少女花', emoji: '🔔', quote: '나라에 바칠 목숨이 하나뿐인 것이 슬플 따름입니다.' },
    { id: 'kr_kimgu',     name: '자강',       era: '한국사', faction: '일제강점기', rarity: 5, trait: 'virtue', stats: { might: 70, wisdom: 92, command: 94 }, hanja: '自强', emoji: '🇰🇷', quote: '나의 소원은 오직 완전한 자주독립이오.' },
    { id: 'kr_wonhyo',    name: '각원',       era: '한국사', faction: '신라',   rarity: 4, trait: 'wisdom', stats: { might: 30, wisdom: 96, command: 50 }, hanja: '覺圓', emoji: '🪷', quote: '모든 것은 마음이 짓는 것이오.' },
    { id: 'kr_kimjeongho',name: '방각',     era: '한국사', faction: '조선',   rarity: 4, trait: 'wisdom', stats: { might: 35, wisdom: 93, command: 40 }, hanja: '方刻', emoji: '🗺️', quote: '이 땅을 한 장에 담아보겠습니다.' },
    { id: 'kr_gwakjaeu',  name: '초모의',     era: '한국사', faction: '조선',   rarity: 4, trait: 'might',  stats: { might: 89, wisdom: 80, command: 88 }, hanja: '草募義', emoji: '🔴', quote: '홍의(紅衣)를 보면 왜적이 달아난다 하더이다.' },
    { id: 'kr_nongae',    name: '화영',       era: '한국사', faction: '조선',   rarity: 4, trait: 'virtue', stats: { might: 55, wisdom: 70, command: 50 }, hanja: '花影', emoji: '🌸', quote: '남강의 물결을 기억해 주십시오.' },
    { id: 'kr_yihwang',   name: '경헌',       era: '한국사', faction: '조선',   rarity: 3, trait: 'wisdom', stats: { might: 15, wisdom: 95, command: 55 }, hanja: '敬軒', emoji: '📚', quote: '경(敬)으로써 마음을 바로 합니다.' },
    { id: 'kr_yii',       name: '문형',       era: '한국사', faction: '조선',   rarity: 3, trait: 'wisdom', stats: { might: 20, wisdom: 96, command: 65 }, hanja: '文衡', emoji: '✒️', quote: '십만 양병이 늦지 않았기를 바랍니다.' },
    { id: 'kr_hwanghui',  name: '균형공',       era: '한국사', faction: '조선',   rarity: 3, trait: 'virtue', stats: { might: 18, wisdom: 90, command: 75 }, hanja: '均衡公', emoji: '⚖️', quote: '네 말도 옳고, 네 말도 옳다.' },
    { id: 'kr_jeongmongju', name: '청죽',   era: '한국사', faction: '고려',   rarity: 4, trait: 'virtue', stats: { might: 35, wisdom: 93, command: 68 }, hanja: '靑竹', emoji: '🌉', quote: '일백 번 고쳐 죽어도 마음은 하나입니다.' },

    // ── 일본사 ─────────────────────────────────────────────
    // 2026-09-10 신설. era 라벨은 '일본사' — 한국사·삼국지와 같은 결로 hanja 칸에 실제 한자를 넣는다.
    { id: 'jp_himiko',    name: '여왕영',   era: '일본사', faction: '야마타이',   rarity: 5, trait: 'wisdom', stats: { might: 20, wisdom: 98, command: 80 }, hanja: '女王影', emoji: '🔮', quote: '귀도(鬼道)로 백성의 마음을 다스리오.' },
    { id: 'jp_taira',     name: '평가주',   era: '일본사', faction: '다이라가',   rarity: 4, trait: 'wisdom', stats: { might: 70, wisdom: 80, command: 92 }, hanja: '平家主', emoji: '⚓', quote: '헤이케(平家) 아니면 사람이 아니다.' },
    { id: 'jp_yoritomo',  name: '막부조',   era: '일본사', faction: '가마쿠라막부', rarity: 5, trait: 'wisdom', stats: { might: 65, wisdom: 90, command: 97 }, hanja: '幕府祖', emoji: '🏯', quote: '무사의 세상을 열겠다.' },
    { id: 'jp_yoshitsune', name: '비장군',  era: '일본사', faction: '겐지가',     rarity: 5, trait: 'might',  stats: { might: 95, wisdom: 80, command: 88 }, hanja: '悲將軍', emoji: '⚔️', quote: '형의 그늘 아래서도 활은 빗나가지 않았다.' },
    { id: 'jp_murasaki', name: '원씨필',   era: '일본사', faction: '헤이안',     rarity: 4, trait: 'wisdom', stats: { might: 10, wisdom: 99, command: 40 }, hanja: '源氏筆', emoji: '🖋️', quote: '덧없는 세상, 이야기로 남기겠소.' },
    { id: 'jp_seishonagon', name: '침초필', era: '일본사', faction: '헤이안',     rarity: 3, trait: 'wisdom', stats: { might: 8,  wisdom: 96, command: 35 }, hanja: '枕草筆', emoji: '📝', quote: '봄은 새벽이 가장 좋습니다.' },
    { id: 'jp_tomoegozen', name: '여무연',  era: '일본사', faction: '겐지가',     rarity: 4, trait: 'might',  stats: { might: 90, wisdom: 60, command: 78 }, hanja: '女武蓮', emoji: '🗡️', quote: '여인이라 활을 못 당길 이유가 없소.' },
    { id: 'jp_nobunaga',  name: '화천마',   era: '일본사', faction: '오다가',     rarity: 5, trait: 'might',  stats: { might: 88, wisdom: 90, command: 97 }, hanja: '火天魔', emoji: '🔥', quote: '울지 않는 새는 베어버린다.' },
    { id: 'jp_hideyoshi', name: '태합원',   era: '일본사', faction: '도요토미가', rarity: 5, trait: 'wisdom', stats: { might: 60, wisdom: 96, command: 96 }, hanja: '太閤猿', emoji: '🐒', quote: '천하는 재주로도 쥘 수 있소.' },
    { id: 'jp_ieyasu',    name: '인내옹',   era: '일본사', faction: '도쿠가와막부', rarity: 5, trait: 'virtue', stats: { might: 70, wisdom: 94, command: 98 }, hanja: '忍耐翁', emoji: '🐢', quote: '두견새는 울 때까지 기다리면 되오.' },
    { id: 'jp_shingen',   name: '풍림화',   era: '일본사', faction: '다케다가',   rarity: 5, trait: 'might',  stats: { might: 90, wisdom: 88, command: 95 }, hanja: '風林火', emoji: '⛰️', quote: '바람처럼 빠르고 숲처럼 고요하게.' },
    { id: 'jp_kenshin',   name: '군신아',   era: '일본사', faction: '우에스기가', rarity: 5, trait: 'virtue', stats: { might: 93, wisdom: 85, command: 94 }, hanja: '軍神牙', emoji: '❄️', quote: '적에게 소금을 보내지 않을 이유가 없소.' },
    { id: 'jp_masamune',  name: '독안룡',   era: '일본사', faction: '다테가',     rarity: 4, trait: 'might',  stats: { might: 91, wisdom: 82, command: 90 }, hanja: '獨眼龍', emoji: '🐉', quote: '한쪽 눈으로도 천하는 다 보인다.' },
    { id: 'jp_yukimura',  name: '일번창',   era: '일본사', faction: '사나다가',   rarity: 5, trait: 'might',  stats: { might: 96, wisdom: 75, command: 89 }, hanja: '日番槍', emoji: '🔴', quote: '오사카의 마지막 창은 내가 쥐겠소.' },
    { id: 'jp_musashi',   name: '이도인',   era: '일본사', faction: '낭인',       rarity: 4, trait: 'might',  stats: { might: 97, wisdom: 70, command: 60 }, hanja: '二刀人', emoji: '🗡️', quote: '천 일의 연습, 만 일의 단련.' },
    { id: 'jp_hanzo',     name: '암영조',   era: '일본사', faction: '이가',       rarity: 4, trait: 'wisdom', stats: { might: 75, wisdom: 88, command: 65 }, hanja: '暗影祖', emoji: '🥷', quote: '그림자는 소리를 남기지 않는다.' },
    { id: 'jp_mitsukuni', name: '천하부',   era: '일본사', faction: '도쿠가와막부', rarity: 3, trait: 'wisdom', stats: { might: 30, wisdom: 92, command: 75 }, hanja: '天下副', emoji: '📖', quote: '이 나라의 역사를 편찬하겠소.' },
    { id: 'jp_naosuke',   name: '개항로',   era: '일본사', faction: '도쿠가와막부', rarity: 3, trait: 'wisdom', stats: { might: 25, wisdom: 90, command: 80 }, hanja: '開港老', emoji: '⚓', quote: '문을 여는 것도 나라를 지키는 길이오.' },
    { id: 'jp_saigo',     name: '최후향',   era: '일본사', faction: '메이지유신', rarity: 5, trait: 'virtue', stats: { might: 85, wisdom: 80, command: 92 }, hanja: '最後鄕', emoji: '🐕', quote: '경천애인(敬天愛人), 하늘을 공경하고 사람을 사랑하라.' },
    { id: 'jp_ryoma',     name: '해원랑',   era: '일본사', faction: '메이지유신', rarity: 4, trait: 'wisdom', stats: { might: 55, wisdom: 92, command: 85 }, hanja: '海援郞', emoji: '⛵', quote: '세상을 다시 씻어내야 하오.' },

    // ── 세계사 (2026-09-10, '유럽사'에서 개명 + 비유럽 세계 각지 인물 보강) ──────
    // 이 판은 한자 문화권이 아니어서 hanja 칸에 원어 표기를 넣는다(도감이 이름 아래 작게 쓴다).
    { id: 'eu_caesar',    name: '발레리안',   era: '세계사', faction: '로마',     rarity: 5, trait: 'wisdom', stats: { might: 78, wisdom: 92, command: 98 }, hanja: 'Valerian', emoji: '🏛️', quote: '왔노라, 보았노라, 그리고 함께 가겠노라.' },
    { id: 'eu_alexander', name: '카시안더', era: '세계사', faction: '마케도니아', rarity: 5, trait: 'might', stats: { might: 94, wisdom: 88, command: 97 }, hanja: 'Kassiander', emoji: '🐎', quote: '세상의 끝까지 가 보고 싶지 않은가.' },
    { id: 'eu_hannibal',  name: '마그나로',     era: '세계사', faction: '카르타고', rarity: 5, trait: 'wisdom', stats: { might: 85, wisdom: 95, command: 94 }, hanja: 'Magnaro', emoji: '🐘', quote: '길이 없다면 알프스를 넘어 만들면 된다.' },
    { id: 'eu_charlemagne', name: '로타리안', era: '세계사', faction: '프랑크',   rarity: 5, trait: 'virtue', stats: { might: 85, wisdom: 82, command: 95 }, hanja: 'Lotharian', emoji: '👑', quote: '검과 글을 함께 쥔 나라를 세우려 하오.' },
    { id: 'eu_joan',      name: '셀렌느',  era: '세계사', faction: '프랑스',   rarity: 5, trait: 'virtue', stats: { might: 78, wisdom: 70, command: 92 }, hanja: 'Selenne', emoji: '⚜️', quote: '두려움은 제 것이 아닙니다. 깃발을 드십시오.' },
    { id: 'eu_napoleon',  name: '발데나르',   era: '세계사', faction: '프랑스',   rarity: 5, trait: 'wisdom', stats: { might: 80, wisdom: 96, command: 99 }, hanja: 'Baldenar', emoji: '🎖️', quote: '불가능이라는 말은 겁쟁이의 변명이오.' },
    { id: 'eu_davinci',   name: '마라노',    era: '세계사', faction: '이탈리아', rarity: 5, trait: 'wisdom', stats: { might: 25, wisdom: 100, command: 58 }, hanja: 'Marano', emoji: '🪶', quote: '아직 그리지 못한 것이 너무 많소.' },
    { id: 'eu_augustus',  name: '세레누스', era: '세계사', faction: '로마',   rarity: 4, trait: 'wisdom', stats: { might: 55, wisdom: 94, command: 92 }, hanja: 'Serenus', emoji: '🦅', quote: '벽돌의 도시를 대리석으로 바꾸겠소.' },
    { id: 'eu_scipio',    name: '코르비날',   era: '세계사', faction: '로마',     rarity: 4, trait: 'might',  stats: { might: 82, wisdom: 88, command: 90 }, hanja: 'Corvinal', emoji: '🛡️', quote: '마그나로를 이기는 법은 마그나로에게 배웠소.' },
    { id: 'eu_leonidas',  name: '테살로르', era: '세계사', faction: '스파르타', rarity: 4, trait: 'might',  stats: { might: 92, wisdom: 60, command: 86 }, hanja: 'Thessalor', emoji: '🔺', quote: '와서 가져가라.' },
    { id: 'eu_aurelius',  name: '베렌델', era: '세계사', faction: '로마',   rarity: 4, trait: 'virtue', stats: { might: 58, wisdom: 96, command: 84 }, hanja: 'Verendel', emoji: '📖', quote: '오늘 할 수 있는 선(善)을 미루지 마시오.' },
    { id: 'eu_richard',   name: '코드윈', era: '세계사', faction: '잉글랜드', rarity: 4, trait: 'might',  stats: { might: 93, wisdom: 65, command: 86 }, hanja: 'Cordwin', emoji: '🦁', quote: '사자의 심장은 물러서는 법을 모른다.' },
    { id: 'eu_william',   name: '펜드릭', era: '세계사', faction: '노르만',   rarity: 4, trait: 'might',  stats: { might: 88, wisdom: 78, command: 90 }, hanja: 'Fendric', emoji: '🏹', quote: '바다를 건넜으면 배는 태워야 하오.' },
    { id: 'eu_harald',    name: '오스트바르드',       era: '세계사', faction: '노르웨이', rarity: 4, trait: 'might',  stats: { might: 95, wisdom: 62, command: 84 }, hanja: 'Ostvard', emoji: '🪓', quote: '북쪽에서 왔다. 노를 저을 줄 아는가.' },
    { id: 'eu_frederick', name: '바실로른', era: '세계사', faction: '프로이센', rarity: 4, trait: 'wisdom', stats: { might: 78, wisdom: 93, command: 95 }, hanja: 'Vasilorn', emoji: '🎼', quote: '왕은 나라의 첫째 종복이오.' },
    { id: 'eu_peter',     name: '볼카노프', era: '세계사', faction: '러시아',   rarity: 4, trait: 'might',  stats: { might: 82, wisdom: 90, command: 93 }, hanja: 'Volkanov', emoji: '⚓', quote: '바다로 나가는 창을 열어야 하오.' },
    { id: 'eu_elizabeth', name: '코리넬레', era: '세계사', faction: '잉글랜드', rarity: 4, trait: 'wisdom', stats: { might: 25, wisdom: 95, command: 90 }, hanja: 'Corinelle', emoji: '💍', quote: '나는 이 나라와 혼인했소.' },
    { id: 'eu_nelson',    name: '애쉬그레이브',       era: '세계사', faction: '잉글랜드', rarity: 4, trait: 'might',  stats: { might: 85, wisdom: 88, command: 92 }, hanja: 'Ashgrave', emoji: '🔭', quote: '나라가 각자의 본분을 기대하고 있다.' },
    { id: 'eu_machiavelli', name: '반토렐리', era: '세계사', faction: '이탈리아', rarity: 4, trait: 'wisdom', stats: { might: 22, wisdom: 96, command: 70 }, hanja: 'Vantorelli', emoji: '🖋️', quote: '사랑받기 어렵다면, 적어도 얕보이지는 마시오.' },
    { id: 'eu_newton',    name: '할베린',       era: '세계사', faction: '잉글랜드', rarity: 3, trait: 'wisdom', stats: { might: 15, wisdom: 100, command: 48 }, hanja: 'Halberin', emoji: '🍎', quote: '거인의 어깨에 올라섰을 뿐이오.' },
    { id: 'eu_michelangelo', name: '첼로리니', era: '세계사', faction: '이탈리아', rarity: 3, trait: 'wisdom', stats: { might: 32, wisdom: 94, command: 54 }, hanja: 'Cellorini', emoji: '🗿', quote: '돌 안에 이미 있는 것을 꺼낼 뿐이오.' },
    { id: 'eu_eleanor',   name: '바엘린', era: '세계사', faction: '프랑스',   rarity: 3, trait: 'virtue', stats: { might: 20, wisdom: 90, command: 78 }, hanja: 'Vaellyn', emoji: '🌹', quote: '두 왕국의 왕비였으니, 셈은 제가 하겠소.' },

    // ── 세계사, 비유럽 보강(2026-09-10) ────────────────────
    { id: 'wd_ashoka',    name: '법륜왕', era: '세계사', faction: '마우리아',     rarity: 5, trait: 'virtue', stats: { might: 60, wisdom: 92, command: 90 }, hanja: 'Dharmandra', emoji: '☸️', quote: '칼로 얻은 땅을 이제 법으로 다스리겠다.' },
    { id: 'wd_akbar',     name: '관용제', era: '세계사', faction: '무굴',         rarity: 5, trait: 'wisdom', stats: { might: 75, wisdom: 93, command: 95 }, hanja: 'Akbaran', emoji: '🕌', quote: '믿음은 강요로 얻어지지 않는다.' },
    { id: 'wd_saladin',   name: '의검주', era: '세계사', faction: '아이유브',     rarity: 5, trait: 'virtue', stats: { might: 88, wisdom: 90, command: 96 }, hanja: 'Salahin', emoji: '🌙', quote: '예루살렘의 문은 자비로도 열린다.' },
    { id: 'wd_suleiman',  name: '장려제', era: '세계사', faction: '오스만',       rarity: 5, trait: 'wisdom', stats: { might: 80, wisdom: 95, command: 97 }, hanja: 'Suleyman', emoji: '🕌', quote: '법과 영광을 함께 세우겠다.' },
    { id: 'wd_ibnsina',   name: '의철인', era: '세계사', faction: '페르시아',     rarity: 4, trait: 'wisdom', stats: { might: 10, wisdom: 99, command: 40 }, hanja: 'Sinardo', emoji: '📗', quote: '몸의 이치를 책 한 권에 담겠소.' },
    { id: 'wd_genghis',   name: '초원패', era: '세계사', faction: '몽골제국',     rarity: 5, trait: 'might',  stats: { might: 96, wisdom: 85, command: 99 }, hanja: 'Tengoran', emoji: '🏹', quote: '세상의 끝까지 말을 달리겠다.' },
    { id: 'wd_khubilai',  name: '대원조', era: '세계사', faction: '원',           rarity: 5, trait: 'wisdom', stats: { might: 75, wisdom: 90, command: 95 }, hanja: 'Khuvilan', emoji: '🐎', quote: '초원과 중원을 하나로 잇겠다.' },
    { id: 'wd_mansamusa', name: '황금왕', era: '세계사', faction: '말리제국',     rarity: 5, trait: 'virtue', stats: { might: 55, wisdom: 88, command: 90 }, hanja: 'Mansaren', emoji: '🪙', quote: '금은 나눌수록 내 것이 된다.' },
    { id: 'wd_shaka',     name: '창군왕', era: '세계사', faction: '줄루왕국',     rarity: 4, trait: 'might',  stats: { might: 94, wisdom: 75, command: 92 }, hanja: 'Shakandu', emoji: '🛡️', quote: '짧은 창이 긴 창을 이긴다.' },
    { id: 'wd_cleopatra', name: '나일화', era: '세계사', faction: '프톨레마이오스', rarity: 5, trait: 'wisdom', stats: { might: 30, wisdom: 95, command: 88 }, hanja: 'Cleonara', emoji: '🐍', quote: '나일강은 아직 나의 편이오.' },
    { id: 'wd_pachacuti', name: '태양개', era: '세계사', faction: '잉카제국',     rarity: 4, trait: 'wisdom', stats: { might: 65, wisdom: 88, command: 93 }, hanja: 'Pachaneth', emoji: '🏔️', quote: '세상을 뒤바꾸는 자, 그것이 나의 이름이다.' },
    { id: 'wd_moctezuma', name: '독수리주', era: '세계사', faction: '아즈텍',   rarity: 4, trait: 'virtue', stats: { might: 60, wisdom: 82, command: 85 }, hanja: 'Moctezan', emoji: '🦅', quote: '별들이 낯선 자들의 도착을 알렸다.' },
    { id: 'wd_ibnbattuta', name: '천리객', era: '세계사', faction: '여행자',    rarity: 3, trait: 'wisdom', stats: { might: 20, wisdom: 90, command: 50 }, hanja: 'Battutan', emoji: '🧭', quote: '길이 있는 한 걸음을 멈추지 않겠소.' },
    { id: 'wd_hammurabi', name: '율법석', era: '세계사', faction: '바빌로니아', rarity: 4, trait: 'virtue', stats: { might: 50, wisdom: 92, command: 88 }, hanja: 'Hammuran', emoji: '🪨', quote: '눈에는 눈, 이에는 이, 돌에 새겨 두겠다.' },
    { id: 'wd_attila',    name: '재앙편', era: '세계사', faction: '훈제국',     rarity: 5, trait: 'might',  stats: { might: 95, wisdom: 78, command: 94 }, hanja: 'Attilan', emoji: '🐎', quote: '신의 채찍이 여기 있다.' }
  ];

  var PETS = [
    // ── 신수 ───────────────────────────────────────────────
    { id: 'pt_samjogo',   name: '삼족오',     kind: 'divine', rarity: 5, emoji: '🐦‍⬛', catchBase: 0.24, bonus: { stat: 'wisdom',  value: 12 }, desc: '고구려 벽화의 세 발 까마귀. 해를 품고 난다.' },
    { id: 'pt_haetae',    name: '해태',       kind: 'divine', rarity: 5, emoji: '🦁', catchBase: 0.24, bonus: { stat: 'command', value: 12 }, desc: '시비와 선악을 가리는 상상의 짐승.' },
    { id: 'pt_cheongryong', name: '청룡',     kind: 'divine', rarity: 5, emoji: '🐉', catchBase: 0.20, bonus: { stat: 'might',   value: 14 }, desc: '동방을 지키는 사신(四神).' },
    { id: 'pt_baekho',    name: '백호',       kind: 'divine', rarity: 5, emoji: '🐅', catchBase: 0.20, bonus: { stat: 'might',   value: 13 }, desc: '서방을 지키는 흰 범.' },
    { id: 'pt_jujak',     name: '주작',       kind: 'divine', rarity: 5, emoji: '🔥', catchBase: 0.20, bonus: { stat: 'wisdom',  value: 13 }, desc: '남방을 지키는 붉은 새.' },
    { id: 'pt_hyeonmu',   name: '현무',       kind: 'divine', rarity: 5, emoji: '🐢', catchBase: 0.20, bonus: { stat: 'command', value: 13 }, desc: '북방을 지키는 거북과 뱀.' },
    { id: 'pt_gumiho',    name: '구미호',     kind: 'divine', rarity: 4, emoji: '🦊', catchBase: 0.30, bonus: { stat: 'wisdom',  value: 9 },  desc: '꼬리 아홉의 여우. 사람 말을 알아듣는다.' },
    { id: 'pt_dokkaebi',  name: '도깨비',     kind: 'divine', rarity: 4, emoji: '👹', catchBase: 0.32, bonus: { stat: 'might',   value: 9 },  desc: '방망이 하나로 뭐든 만들어낸다.' },
    { id: 'pt_bulgasari', name: '불가사리',   kind: 'divine', rarity: 4, emoji: '🐻‍❄️', catchBase: 0.30, bonus: { stat: 'command', value: 9 }, desc: '쇠를 먹고 자라는 짐승.' },
    { id: 'pt_jeoktoma',  name: '홍염마',     kind: 'divine', rarity: 5, emoji: '🐴', catchBase: 0.22, bonus: { stat: 'might',   value: 11 }, desc: '하루에 천 리를 달린다는 전설의 명마.' },
    { id: 'pt_jeolyeong', name: '섬영마',     kind: 'divine', rarity: 4, emoji: '🐎', catchBase: 0.30, bonus: { stat: 'command', value: 8 },  desc: '위기에 빠진 주인을 태우고 홀로 달아났다는 준마.' },

    // ── 동물 ───────────────────────────────────────────────
    { id: 'pt_jindo',     name: '진돗개',     kind: 'beast',  rarity: 3, emoji: '🐕', catchBase: 0.48, bonus: { stat: 'command', value: 5 }, desc: '한번 정한 주인은 바꾸지 않는다.' },
    { id: 'pt_sapsal',    name: '삽살개',     kind: 'beast',  rarity: 3, emoji: '🐩', catchBase: 0.48, bonus: { stat: 'virtue',  value: 5 }, desc: '액운을 쫓는다는 털북숭이.' },
    { id: 'pt_tiger',     name: '백두산호랑이', kind: 'beast', rarity: 4, emoji: '🐯', catchBase: 0.30, bonus: { stat: 'might',  value: 8 }, desc: '산군(山君)이라 불린 이 땅의 주인.' },
    { id: 'pt_bear',      name: '반달가슴곰', kind: 'beast',  rarity: 3, emoji: '🐻', catchBase: 0.44, bonus: { stat: 'might',   value: 6 }, desc: '가슴에 반달을 품었다.' },
    { id: 'pt_magpie',    name: '까치',       kind: 'beast',  rarity: 2, emoji: '🐦', catchBase: 0.62, bonus: { stat: 'wisdom',  value: 3 }, desc: '좋은 소식을 물어온다.' },
    { id: 'pt_crane',     name: '학',         kind: 'beast',  rarity: 3, emoji: '🕊️', catchBase: 0.46, bonus: { stat: 'wisdom',  value: 5 }, desc: '선비의 벗.' },
    { id: 'pt_toad',      name: '두꺼비',     kind: 'beast',  rarity: 2, emoji: '🐸', catchBase: 0.66, bonus: { stat: 'command', value: 3 }, desc: '복을 부른다는 집지킴이.' },
    { id: 'pt_carp',      name: '잉어',       kind: 'beast',  rarity: 2, emoji: '🐟', catchBase: 0.66, bonus: { stat: 'wisdom',  value: 3 }, desc: '용문을 오르면 용이 된다던가.' },
    { id: 'pt_panda',     name: '판다',       kind: 'beast',  rarity: 4, emoji: '🐼', catchBase: 0.34, bonus: { stat: 'virtue',  value: 7 }, desc: '촉(蜀) 땅의 대나무 숲에 산다.' },
    { id: 'pt_monkey',    name: '원숭이',     kind: 'beast',  rarity: 2, emoji: '🐒', catchBase: 0.64, bonus: { stat: 'might',   value: 3 }, desc: '재주가 많고 손이 빠르다.' },
    { id: 'pt_deer',      name: '사슴',       kind: 'beast',  rarity: 2, emoji: '🦌', catchBase: 0.64, bonus: { stat: 'virtue',  value: 3 }, desc: '녹용은 예로부터 귀한 약재.' },
    { id: 'pt_boar',      name: '멧돼지',     kind: 'beast',  rarity: 3, emoji: '🐗', catchBase: 0.50, bonus: { stat: 'might',   value: 5 }, desc: '한번 달리면 멈추지 않는다.' },
    { id: 'pt_owl',       name: '올빼미',     kind: 'beast',  rarity: 3, emoji: '🦉', catchBase: 0.48, bonus: { stat: 'wisdom',  value: 5 }, desc: '밤에만 모습을 드러낸다.' },
    { id: 'pt_cat',       name: '고양이',     kind: 'beast',  rarity: 2, emoji: '🐈', catchBase: 0.60, bonus: { stat: 'wisdom',  value: 3 }, desc: '내킬 때만 따라온다.' },
    /* 2026-09-09 — PLAN §60 "GLB 자산 확장" 후속(펫). asset3d.js REG에
       등록만 돼 있던 64종을 전부 도감에 얹는다(사용자 확정 — "숫자
       우선"). 아래는 위 14종처럼 한반도 설화 동물은 아니지만(이국·관상용·
       고생물), 이미 판다처럼 비한반도 동물도 이 자리에 섞여 있었다.
       `id`는 `pt_<asset3d.js REG 키>`로 그대로 맞춰 3D가 저절로 물린다
       — 사가나락 밖 네 판은 이 REG가 없어 신수·창작 짐승 27종이 이미 그래
       왔듯 그림 없이 이름·이모지만 뜬다(기존과 같은 동작, 회귀 아님). */
    { id: 'pt_fox',       name: '여우',       kind: 'beast', rarity: 3, emoji: '🦊', catchBase: 0.46, bonus: { stat: 'wisdom',  value: 5 }, desc: '꾀가 많아 쉽사리 안 잡힌다.' },
    { id: 'pt_dolphin',   name: '돌고래',     kind: 'beast', rarity: 3, emoji: '🐬', catchBase: 0.40, bonus: { stat: 'wisdom',  value: 6 }, desc: '무리 지어 뱃길을 따라온다.' },
    { id: 'pt_shark',     name: '상어',       kind: 'beast', rarity: 3, emoji: '🦈', catchBase: 0.34, bonus: { stat: 'might',   value: 7 }, desc: '먼 바다의 지배자.' },
    { id: 'pt_whale',     name: '고래',       kind: 'beast', rarity: 4, emoji: '🐋', catchBase: 0.26, bonus: { stat: 'command', value: 9 }, desc: '바다에서 가장 큰 숨을 쉰다.' },
    { id: 'pt_manta_ray', name: '쥐가오리',   kind: 'beast', rarity: 3, emoji: '🐡', catchBase: 0.38, bonus: { stat: 'virtue',  value: 6 }, desc: '넓은 날개로 물살을 가른다.' },
    { id: 'pt_fish_1',    name: '붕어',       kind: 'beast', rarity: 1, emoji: '🐟', catchBase: 0.70, bonus: { stat: 'wisdom',  value: 2 }, desc: '냇가 어디에나 있다.' },
    { id: 'pt_fish_2',    name: '송사리',     kind: 'beast', rarity: 1, emoji: '🐟', catchBase: 0.72, bonus: { stat: 'wisdom',  value: 2 }, desc: '떼 지어 다니는 작은 물고기.' },
    { id: 'pt_fish_3',    name: '메기',       kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.58, bonus: { stat: 'might',   value: 4 }, desc: '수염으로 어둠 속 먹이를 찾는다.' },
    { id: 'pt_stag',      name: '큰사슴',     kind: 'beast', rarity: 3, emoji: '🦌', catchBase: 0.44, bonus: { stat: 'virtue',  value: 6 }, desc: '뿔이 큰 만큼 걸음이 신중하다.' },
    { id: 'pt_white_horse', name: '백마',     kind: 'beast', rarity: 3, emoji: '🐎', catchBase: 0.42, bonus: { stat: 'command', value: 6 }, desc: '장수가 타는 흰 말.' },
    { id: 'pt_horse',     name: '말',         kind: 'beast', rarity: 2, emoji: '🐴', catchBase: 0.54, bonus: { stat: 'command', value: 4 }, desc: '사람과 함께 달려온 짐승.' },
    { id: 'pt_llama',     name: '라마',       kind: 'beast', rarity: 2, emoji: '🦙', catchBase: 0.56, bonus: { stat: 'virtue',  value: 4 }, desc: '먼 나라에서 온 짐 나르는 짐승.' },
    { id: 'pt_pig',       name: '돼지',       kind: 'beast', rarity: 1, emoji: '🐖', catchBase: 0.68, bonus: { stat: 'command', value: 3 }, desc: '복을 부른다고 여겨진다.' },
    { id: 'pt_pug',       name: '발바리',     kind: 'beast', rarity: 2, emoji: '🐶', catchBase: 0.62, bonus: { stat: 'virtue',  value: 3 }, desc: '작고 붙임성이 좋다.' },
    { id: 'pt_sheep',     name: '양',         kind: 'beast', rarity: 2, emoji: '🐑', catchBase: 0.58, bonus: { stat: 'virtue',  value: 4 }, desc: '무리를 지어 순하게 다닌다.' },
    { id: 'pt_horse_farm', name: '짐말',      kind: 'beast', rarity: 1, emoji: '🐴', catchBase: 0.64, bonus: { stat: 'might',   value: 3 }, desc: '밭일과 짐 나르기를 함께 한다.' },
    { id: 'pt_cow_farm',  name: '젖소',       kind: 'beast', rarity: 1, emoji: '🐄', catchBase: 0.66, bonus: { stat: 'virtue',  value: 3 }, desc: '아침마다 젖을 내준다.' },
    { id: 'pt_zebra',     name: '얼룩말',     kind: 'beast', rarity: 3, emoji: '🦓', catchBase: 0.42, bonus: { stat: 'might',   value: 5 }, desc: '먼 나라 초원에서 온 줄무늬 말.' },
    { id: 'pt_cow',       name: '들소',       kind: 'beast', rarity: 2, emoji: '🐂', catchBase: 0.52, bonus: { stat: 'might',   value: 4 }, desc: '들판을 함께 지키는 힘센 짐승.' },
    { id: 'pt_donkey',    name: '당나귀',     kind: 'beast', rarity: 2, emoji: '🫏', catchBase: 0.56, bonus: { stat: 'command', value: 4 }, desc: '고집이 세지만 짐을 잘 진다.' },
    { id: 'pt_alpaca',    name: '알파카',     kind: 'beast', rarity: 3, emoji: '🦙', catchBase: 0.48, bonus: { stat: 'virtue',  value: 5 }, desc: '복슬복슬한 털을 두르고 있다.' },
    { id: 'pt_bull',      name: '황소',       kind: 'beast', rarity: 3, emoji: '🐂', catchBase: 0.42, bonus: { stat: 'might',   value: 6 }, desc: '뿔을 낮추면 아무도 못 막는다.' },
    { id: 'pt_anglerfish', name: '아귀',      kind: 'beast', rarity: 2, emoji: '🎣', catchBase: 0.50, bonus: { stat: 'wisdom',  value: 4 }, desc: '제 몸의 등불로 먹이를 홀린다.' },
    { id: 'pt_apatosaurus', name: '장룡',     kind: 'beast', rarity: 4, emoji: '🦕', catchBase: 0.28, bonus: { stat: 'command', value: 8 }, desc: '목이 긴 옛 짐승, 발걸음이 땅을 울린다.' },
    { id: 'pt_armored_catfish', name: '갑옷메기', kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.54, bonus: { stat: 'might',   value: 4 }, desc: '비늘이 갑옷처럼 단단하다.' },
    { id: 'pt_betta',     name: '베타',       kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.56, bonus: { stat: 'virtue',  value: 4 }, desc: '지느러미를 부채처럼 편다.' },
    { id: 'pt_black_lion_fish', name: '검은쏠배감펭', kind: 'beast', rarity: 3, emoji: '🐡', catchBase: 0.40, bonus: { stat: 'might',   value: 5 }, desc: '가시마다 독을 품었다.' },
    { id: 'pt_blobfish',  name: '심해물컹이', kind: 'beast', rarity: 2, emoji: '🫧', catchBase: 0.58, bonus: { stat: 'wisdom',  value: 3 }, desc: '깊은 물에서만 제 모양을 지킨다.' },
    { id: 'pt_blue_goldfish', name: '청금붕어', kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.56, bonus: { stat: 'wisdom',  value: 4 }, desc: '흔치 않은 푸른 빛깔의 금붕어.' },
    { id: 'pt_blue_tang', name: '청줄돔',     kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.54, bonus: { stat: 'wisdom',  value: 4 }, desc: '산호 사이를 파랗게 가른다.' },
    { id: 'pt_butterfly_fish', name: '나비고기', kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.56, bonus: { stat: 'virtue',  value: 4 }, desc: '나비처럼 팔랑이며 헤엄친다.' },
    { id: 'pt_cardinal_fish', name: '홍줄고기', kind: 'beast', rarity: 1, emoji: '🐠', catchBase: 0.66, bonus: { stat: 'virtue',  value: 3 }, desc: '붉은 줄무늬로 무리를 알아본다.' },
    { id: 'pt_clownfish', name: '흰동가리',   kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.58, bonus: { stat: 'virtue',  value: 4 }, desc: '말미잘 속에 숨어 산다.' },
    { id: 'pt_coral_grouper', name: '붉은바리', kind: 'beast', rarity: 3, emoji: '🐟', catchBase: 0.42, bonus: { stat: 'might',   value: 5 }, desc: '산호 그늘에서 매복한다.' },
    { id: 'pt_cowfish',   name: '소뿔고기',   kind: 'beast', rarity: 2, emoji: '🐡', catchBase: 0.54, bonus: { stat: 'command', value: 4 }, desc: '머리에 작은 뿔이 돋았다.' },
    { id: 'pt_flatfish',  name: '넙치',       kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.56, bonus: { stat: 'wisdom',  value: 4 }, desc: '바닥에 납작 엎드려 숨는다.' },
    { id: 'pt_flower_horn', name: '꽃뿔고기', kind: 'beast', rarity: 3, emoji: '🐠', catchBase: 0.44, bonus: { stat: 'command', value: 5 }, desc: '이마의 혹이 꽃봉오리 같다.' },
    { id: 'pt_goblin_shark', name: '도깨비상어', kind: 'beast', rarity: 4, emoji: '🦈', catchBase: 0.30, bonus: { stat: 'might',   value: 7 }, desc: '주둥이가 도깨비처럼 길다.' },
    { id: 'pt_goldfish',  name: '금붕어',     kind: 'beast', rarity: 1, emoji: '🐠', catchBase: 0.70, bonus: { stat: 'wisdom',  value: 2 }, desc: '연못에서 가장 흔한 벗.' },
    { id: 'pt_humphead',  name: '혹돔',       kind: 'beast', rarity: 3, emoji: '🐟', catchBase: 0.40, bonus: { stat: 'wisdom',  value: 5 }, desc: '이마의 혹이 나이를 말해 준다.' },
    { id: 'pt_koi_2',     name: '비단잉어',   kind: 'beast', rarity: 3, emoji: '🎏', catchBase: 0.44, bonus: { stat: 'virtue',  value: 5 }, desc: '색이 곱다고 연못마다 기른다.' },
    { id: 'pt_lionfish',  name: '쏠배감펭',   kind: 'beast', rarity: 3, emoji: '🐡', catchBase: 0.42, bonus: { stat: 'might',   value: 5 }, desc: '화려한 지느러미에 독이 숨었다.' },
    { id: 'pt_mandarin_fish', name: '만다린고비', kind: 'beast', rarity: 3, emoji: '🐠', catchBase: 0.40, bonus: { stat: 'virtue',  value: 5 }, desc: '작지만 빛깔이 가장 곱다.' },
    { id: 'pt_moorish_idol', name: '깃대돔',  kind: 'beast', rarity: 3, emoji: '🐠', catchBase: 0.42, bonus: { stat: 'virtue',  value: 5 }, desc: '등지느러미가 깃대처럼 솟았다.' },
    { id: 'pt_parasaurolophus', name: '관룡', kind: 'beast', rarity: 4, emoji: '🦕', catchBase: 0.28, bonus: { stat: 'wisdom',  value: 8 }, desc: '볏으로 소리를 멀리 보낸다는 옛 짐승.' },
    { id: 'pt_parrot_fish', name: '앵무고기', kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.54, bonus: { stat: 'wisdom',  value: 4 }, desc: '부리 같은 이로 산호를 쪼아 먹는다.' },
    { id: 'pt_piranha',   name: '피라냐',     kind: 'beast', rarity: 3, emoji: '🐟', catchBase: 0.40, bonus: { stat: 'might',   value: 6 }, desc: '이가 날카로워 방심할 수 없다.' },
    { id: 'pt_puffer',    name: '복어',       kind: 'beast', rarity: 2, emoji: '🐡', catchBase: 0.52, bonus: { stat: 'wisdom',  value: 4 }, desc: '놀라면 몸을 한껏 부풀린다.' },
    { id: 'pt_red_snapper', name: '붉돔',     kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.52, bonus: { stat: 'might',   value: 4 }, desc: '잔칫상에도 오르는 붉은 물고기.' },
    { id: 'pt_royal_gramma', name: '자주고기', kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.54, bonus: { stat: 'virtue',  value: 4 }, desc: '보라와 노랑이 반씩 갈렸다.' },
    { id: 'pt_shark_2',   name: '백상아리',   kind: 'beast', rarity: 4, emoji: '🦈', catchBase: 0.26, bonus: { stat: 'might',   value: 8 }, desc: '먼 바다에서 가장 두려운 이빨.' },
    { id: 'pt_stegosaurus', name: '판룡',     kind: 'beast', rarity: 4, emoji: '🦕', catchBase: 0.28, bonus: { stat: 'command', value: 8 }, desc: '등에 돌판을 두른 옛 짐승.' },
    { id: 'pt_sunfish',   name: '개복치',     kind: 'beast', rarity: 3, emoji: '🐡', catchBase: 0.42, bonus: { stat: 'virtue',  value: 5 }, desc: '느긋해 보여도 잘 놀란다.' },
    { id: 'pt_swordfish', name: '황새치',     kind: 'beast', rarity: 3, emoji: '🐟', catchBase: 0.38, bonus: { stat: 'might',   value: 6 }, desc: '긴 주둥이로 물살을 가른다.' },
    { id: 'pt_t_rex',     name: '폭군용',     kind: 'beast', rarity: 5, emoji: '🦖', catchBase: 0.20, bonus: { stat: 'might',   value: 12 }, desc: '옛 짐승 중 가장 사나웠다는 왕.' },
    { id: 'pt_tang',      name: '탱돔',       kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.56, bonus: { stat: 'wisdom',  value: 4 }, desc: '산호밭을 오가며 이끼를 뜯는다.' },
    { id: 'pt_tetra',     name: '테트라',     kind: 'beast', rarity: 1, emoji: '🐟', catchBase: 0.68, bonus: { stat: 'virtue',  value: 3 }, desc: '작은 몸으로 떼 지어 다닌다.' },
    { id: 'pt_triceratops', name: '삼각뿔용', kind: 'beast', rarity: 4, emoji: '🦕', catchBase: 0.28, bonus: { stat: 'might',   value: 8 }, desc: '뿔 셋으로 무엇도 두렵지 않았다.' },
    { id: 'pt_tuna',      name: '참치',       kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.50, bonus: { stat: 'might',   value: 4 }, desc: '먼바다를 쉬지 않고 헤엄친다.' },
    { id: 'pt_turbot',    name: '돌가자미',   kind: 'beast', rarity: 2, emoji: '🐟', catchBase: 0.52, bonus: { stat: 'wisdom',  value: 4 }, desc: '바닥돌 빛깔로 몸을 숨긴다.' },
    { id: 'pt_velociraptor', name: '날쌘용',  kind: 'beast', rarity: 4, emoji: '🦖', catchBase: 0.30, bonus: { stat: 'might',   value: 7 }, desc: '무리 지어 몰아치는 옛 사냥꾼.' },
    { id: 'pt_worm',      name: '지렁이',     kind: 'beast', rarity: 1, emoji: '🪱', catchBase: 0.74, bonus: { stat: 'virtue',  value: 2 }, desc: '땅을 갈아 흙을 되살린다.' },
    { id: 'pt_yellow_tang', name: '노랑탱돔', kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.56, bonus: { stat: 'wisdom',  value: 4 }, desc: '샛노란 빛깔이 산호밭에서 눈에 띈다.' },
    { id: 'pt_zebra_clown_fish', name: '줄무늬흰동가리', kind: 'beast', rarity: 2, emoji: '🐠', catchBase: 0.56, bonus: { stat: 'virtue',  value: 4 }, desc: '흰동가리보다 줄이 하나 더 있다.' },

    // ── 창작 짐승 열여섯 ───────────────────────────────────
    // 2026-09-26 옛 오마주 자리를 새 종으로(id 는 세이브 호환으로 그대로). 전설급은 신수(divine) 자리에 앉힌다.
    { id: 'pk_bulbasaur', name: '삿갓동이',   kind: 'beast',  rarity: 2, emoji: '🍄', catchBase: 0.66, bonus: { stat: 'virtue',  value: 3 }, desc: '비 갠 뒤 숲 그늘에서 푸른 삿갓을 쓰고 걸어 나온다.' },
    { id: 'pk_charmander', name: '뿔도롱',    kind: 'beast',  rarity: 2, emoji: '🦎', catchBase: 0.64, bonus: { stat: 'might',   value: 3 }, desc: '이마의 뿔 하나로 바위를 긁어 제 길을 낸다.' },
    { id: 'pk_squirtle',  name: '뿔낙지',     kind: 'beast',  rarity: 2, emoji: '🦑', catchBase: 0.66, bonus: { stat: 'command', value: 3 }, desc: '갯바위 틈에 살며 긴 팔로 먹이를 끌어당긴다.' },
    { id: 'pk_magikarp',  name: '날주머니',     kind: 'beast',  rarity: 2, emoji: '🫐', catchBase: 0.70, bonus: { stat: 'wisdom',  value: 2 }, desc: '작은 날개로 한 뼘씩 떠올라 밤이슬을 모은다.' },
    { id: 'pk_pikachu',   name: '방아토끼',     kind: 'beast',  rarity: 3, emoji: '🐇', catchBase: 0.48, bonus: { stat: 'might',   value: 5 }, desc: '달에서 떡방아를 찧다 내려왔다는 흰 토끼.' },
    { id: 'pk_eevee',     name: '이끼잔나비',     kind: 'beast',  rarity: 3, emoji: '🐒', catchBase: 0.48, bonus: { stat: 'virtue',  value: 5 }, desc: '등에 이끼가 자라도 개의치 않는 느긋한 잔나비.' },
    { id: 'pk_slowbro',   name: '묵방울',     kind: 'beast',  rarity: 3, emoji: '🫧', catchBase: 0.50, bonus: { stat: 'wisdom',  value: 5 }, desc: '말랑한 몸으로 굴러다니다 무엇이든 감싸 버린다.' },
    { id: 'pk_gengar',    name: '어둑귀',       kind: 'beast',  rarity: 3, emoji: '👻', catchBase: 0.44, bonus: { stat: 'wisdom',  value: 6 }, desc: '초롱불이 꺼지면 두 뿔을 내밀고 길 잃은 이를 놀린다.' },
    { id: 'pk_snorlax',   name: '눈머리',     kind: 'beast',  rarity: 4, emoji: '❄️', catchBase: 0.34, bonus: { stat: 'command', value: 8 }, desc: '눈보라 치는 날 산마루에서 커다란 웃음소리가 들린다.' },
    { id: 'pk_lapras',    name: '겹날주머니',   kind: 'beast',  rarity: 4, emoji: '🪽', catchBase: 0.34, bonus: { stat: 'virtue',  value: 8 }, desc: '날주머니 둘이 한 몸이 되어 먼 산까지 떠간다.' },
    { id: 'pk_alakazam',  name: '고깔도사',       kind: 'beast',  rarity: 4, emoji: '🧙', catchBase: 0.32, bonus: { stat: 'wisdom',  value: 9 }, desc: '고깔 아래서 별자리를 외며 앞날을 점친다.' },
    { id: 'pk_dragonite', name: '누렁날개',     kind: 'beast',  rarity: 4, emoji: '🐤', catchBase: 0.30, bonus: { stat: 'command', value: 9 }, desc: '거친 두건을 쓰고 들판 위를 낮게 난다.' },
    { id: 'pk_charizard', name: '노을용',     kind: 'beast',  rarity: 5, emoji: '🐉', catchBase: 0.22, bonus: { stat: 'might',   value: 13 }, desc: '저녁노을을 등지고 날 때 비늘이 불처럼 빛난다.' },
    { id: 'pk_gyarados',  name: '물이무기',   kind: 'beast',  rarity: 5, emoji: '🐍', catchBase: 0.22, bonus: { stat: 'might',   value: 13 }, desc: '천 년을 채우지 못해 용이 되지 못한 뱀. 깊은 소에서 때를 기다린다.' },
    { id: 'pk_mewtwo',    name: '별손님',       kind: 'divine', rarity: 5, emoji: '🌌', catchBase: 0.18, bonus: { stat: 'wisdom',  value: 15 }, desc: '별똥별이 떨어진 밤에 나타나 말없이 하늘을 올려다본다.' },
    { id: 'pk_mew',       name: '복고양이',         kind: 'divine', rarity: 5, emoji: '🐱', catchBase: 0.18, bonus: { stat: 'virtue',  value: 15 }, desc: '문간에 앉아 있으면 그 집에 복이 든다고 한다.' }
  ];


  /**
   * 열전(列傳) — 상세 화면에 한 줄로 뜨는 인물 소개.
   * 인물을 추가할 때 여기 한 줄을 같이 넣으면 되고, 빠뜨려도 화면은 깨지지 않는다.
   */
  var BIOS = {
    sg_guanyu:     '의로 맺은 인연을 저버리지 않고, 홀로 여러 관문을 뚫어 낸 뒤 마침내 벗을 다시 만났다. 그 의리가 후대에 신처럼 떠받들어졌다.',
    sg_zhangfei:   '좁은 다리 하나를 혼자 막아서서 뒤쫓던 대군의 발을 묶었다. 고함 한 번으로 적진을 얼어붙게 한 사내.',
    sg_zhaoyun:    '주군의 어린 아들을 품에 안고 겹겹의 적진을 홀로 뚫고 나왔다. 한 몸이 곧 방패였다.',
    sg_zhugeliang: '초야에서 나와 세 세력이 나뉘어 설 그림을 그렸다. 여러 차례 북쪽으로 군을 몰았고, 마지막 진중에서 별이 졌다.',
    sg_liubei:     '짚신과 돗자리를 팔던 몸에서 일어나 한 나라의 황제에 올랐다. 사람의 마음을 얻는 일에서만은 누구에게도 지지 않았다.',
    sg_machao:     '서쪽 변방의 기병을 이끌고 한때 천하의 패자를 다리 어귀까지 몰아붙였다. 변방의 부족들이 그를 하늘이 내린 장수라 불렀다.',
    sg_huangzhong: '험한 산자락에서 노장의 활 한 발로 적장을 베었다. 나이는 숫자일 뿐임을 몸으로 증명한 사람.',
    sg_caocao:     '난세를 헤쳐 나간 효웅. 시를 짓고 황무지에 둔전을 열었으며, 북방을 하나로 묶어 한 나라의 기틀을 세웠다.',
    sg_simayi:     '남쪽 책사의 북벌을 맞서 싸우는 대신 버티는 것으로 받아냈다. 참는 법을 아는 자가 끝내 천하를 가져갔다.',
    sg_xiahoudun:  '한쪽 눈을 잃고도 선봉을 내놓지 않았다. 주군이 자신과 같은 수레에 태운 단 하나뿐인 장수.',
    sg_zhangliao:  '국경 요새에서 팔백 기로 십만 대군의 진을 흔들어 놓았다. 남쪽 나라 아이들이 그 이름 한 마디에 울음을 그쳤다는 이야기가 전해진다.',
    sg_xunyu:      '패자의 곁에서 계책을 세운 책사. 큰 싸움의 승부처를 정확히 짚어냈으나, 끝내 주군과 뜻이 갈렸다.',
    sg_sunquan:    '형의 뒤를 이어 강 건너 땅을 지켰다. 서쪽의 세력과 손을 잡는 결단으로 큰 싸움에서 살아남았다.',
    sg_zhouyu:     '강 위에서 불로 적의 수군을 태워 큰 승리를 이끌었다. 거문고 가락도 놓치지 않는다 하여 풍류랑으로도 불렸다.',
    sg_luxun:      '산기슭에 진을 친 대군을 불로 되돌려 보냈다. 서두르지 않는 것이 그의 병법이었다.',
    sg_taishici:   '한때의 맹장과 맞붙어 승부를 가리지 못했던 무장. 활을 쏘면 빗나가는 일이 없었다.',
    sg_ganning:    '강을 떠돌던 수적 출신. 방울을 달고 백여 명으로 대군의 진영을 밤에 기습했다.',
    sg_lubu:       '긴 창과 명마의 주인. 무예로는 천하에 겨룰 자가 없었으나, 사람을 믿는 법을 끝내 배우지 못했다.',
    sg_diaochan:   '권세를 쥔 자와 그 밑의 맹장 사이를 갈라놓은 계책의 중심에 있었다. 정사에는 이름이 없고 이야기에만 남았다.',
    sg_pangtong:   '이름난 책사와 나란히 불린 재사. 한 성 밑에서 화살에 맞아 뜻을 다 펴지 못하고 스러졌다.',
    sg_huatuo:     '마비되는 약으로 통증을 잠재우고 배를 열었다는 명의. 짐승의 움직임을 본뜬 건강 체조를 남겼다.',
    sg_menghuo:    '남쪽 변방 부족들의 왕. 일곱 번 사로잡히고 일곱 번 풀려난 뒤에야 비로소 마음으로 승복했다.',

    kr_yisunsin:   '남쪽 바다에서 스물세 번 싸워 스물세 번 이겼다. 가장 어려웠던 싸움에서는 배 열두 척으로 적선 삼백을 막아 냈다.',
    kr_euljimundeok: '대륙에서 밀려온 삼십만 대군을 강물의 수공으로 쓸어냈다. 시 한 수로 적장을 조롱할 만큼 배포가 컸다.',
    kr_ganggamchan: '국경의 관문에서 북방 십만 대군을 강물과 함께 몰아냈다. 예순을 넘긴 나이에도 전장에 선 문신이었다.',
    kr_kimyusin:   '여러 싸움터를 넘어 세 나라를 하나로 잇는 데 앞장섰다. 칼이자 동시에 정치였던 인물.',
    kr_gyebaek:    '오천의 결사대를 이끌고 열 배가 넘는 대군을 벌판에서 맞았다. 스스로 물러설 곳을 지운 채였다.',
    kr_yeongaesomun: '대륙 황제가 몸소 이끈 친정을 국경의 산성에서 꺾었다. 요동의 성벽은 그가 지키는 한 무너지지 않았다.',
    kr_gwanggaeto: '스물의 나이에 왕위에 올라 북으로 요동, 남으로 강줄기까지 영토를 넓혔다. 비석 하나가 그 발자취를 지금도 전한다.',
    kr_sejong:     '백성이 쓸 수 있는 새 글자를 만들어 나누어 주었다. 비 재는 기구와 물시계, 하늘의 셈법이 한 시대에 함께 태어났다.',
    kr_jangyeongsil: '낮은 신분에서 높은 품계에 올랐다. 스스로 움직이는 물시계와 해시계로 나라의 시간을 세웠다.',
    kr_choemuseon: '화약 제조법을 손에 넣어 화약 관청을 세웠다. 바닷가 어귀에서 적선 수백 척을 불태웠다.',
    kr_daejoyeong: '험한 고갯길에서 대륙 군대를 꺾고 새 나라를 세웠다. 앞선 나라의 이름을 북쪽 땅에서 이어받았다.',
    kr_wanggeon:   '갈라진 세 나라를 하나로 묶어 새 왕조를 열었다. 지방 호족을 적으로 두지 않고 혼인으로 품었다.',
    kr_jeongyakyong: '수백 권의 저술과 도르래를 이용한 축성 기구를 남겼다. 유배지에서 관리의 마음가짐을 논한 책을 썼다.',
    kr_heojun:     '수십 권짜리 의학 전서를 남겼다. 신분의 귀천을 가리지 않고 처방을 적은 어의였다.',
    kr_sinsaimdang: '풀벌레 그림으로 이름난 화가이자 큰 학자를 길러낸 어머니. 붓과 자녀 교육을 함께 남겼다.',
    kr_ahnjunggeun: '대륙의 역참에서 침략의 원흉을 저격했다. 옥중에서 동양의 평화를 논한 글을 쓰다 순국했다.',
    kr_yugwansun:  '고향 장터에서 만세를 외치며 앞장섰다. 옥중에서 채 스물이 되기 전에 짧은 삶을 마쳤다.',
    kr_kimgu:      '망명 정부를 끝까지 지켰다. 자신의 회고록에 "나라의 소원"을 적어 두었다.',
    kr_wonhyo:     '우연히 마신 물 한 모금으로 깨달아 먼 유학길을 되돌렸다. 한마음(一心)으로 여러 종파를 하나로 보았다.',
    kr_kimjeongho: '나라 전체를 담은 지도를 스스로 새겨 만들었다. 발로 직접 걸어 땅을 한 장에 담은 사람.',
    kr_gwakjaeu:   '붉은 옷을 입고 의병을 모아 이끌어 붉은옷장군이라 불렸다. 나루터에서 적군의 북상을 막아 냈다.',
    kr_nongae:     '성이 떨어진 강가 누각에서 적장을 안고 강물에 몸을 던졌다.',
    kr_yihwang:    '산자락 서당에서 후학을 길렀다. 그림으로 정리한 학문의 길을 임금에게 올려 보였다.',
    kr_yii:        '아홉 차례 과거에서 장원을 차지했다. 미리 군사를 기르자 청했으나 끝내 받아들여지지 않았다.',
    kr_hwanghui:   '세 임금을 섬기며 오랜 세월 재상 자리를 지켰다. 서로 다투는 아랫사람 양쪽 모두에게 옳다고 했다는 일화가 전해진다.',
    kr_jeongmongju: '옛 왕조의 마지막 충신. 변치 않는 마음을 노래한 시조를 남기고 다리 위에서 쓰러졌다.',

    jp_himiko:     '주술과 점으로 섬나라의 작은 연맹을 다스린 여왕. 사서에는 이름 대신 그림자만 남았다.',
    jp_taira:      '자기 가문 아니면 사람 취급을 안 할 만큼 일족을 조정 곳곳에 채웠다. 바다 위 마지막 싸움에서 그 영화가 가라앉았다.',
    jp_yoritomo:   '아우의 공을 시기해 내치면서도 무사 정권의 틀을 세웠다. 동쪽 거점에 첫 막부를 열었다.',
    jp_yoshitsune: '여러 싸움에서 연전연승했으나 끝내 형에게 쫓겨 먼 북쪽 땅에서 스스로 생을 마쳤다.',
    jp_murasaki:   '궁중의 여관으로 지내며 한 귀공자의 일생을 다룬 장편 이야기를 썼다. 세계에서 손꼽히게 오래된 장편소설로 남았다.',
    jp_seishonagon: '왕비를 가까이서 모시며 일상의 단상을 수필로 적었다. 계절의 첫 순간을 놓치지 않는 눈을 가졌다.',
    jp_tomoegozen: '한 지방 무장을 따라 싸운 여무사. 물러서지 않는 창끝으로 이름을 남겼다.',
    jp_nobunaga:   '골짜기에서 기습으로 몇 배가 넘는 대군을 꺾었다. 천하를 무력으로 하나 되게 하겠다며 옛 질서를 부수다가 한 사찰에서 급습당해 스러졌다.',
    jp_hideyoshi:  '미천한 신분에서 최고 관직에 올라 나라를 통일했다. 재주와 언변으로 사람을 부리는 데 능했다.',
    jp_ieyasu:     '들판에서의 마지막 큰 싸움에서 승부를 뒤집었다. 때가 올 때까지 기다린 끝에 오래가는 막부를 세웠다.',
    jp_shingen:    '산악 지방의 호랑이라 불렸다. 자신의 깃발 아래 북쪽의 라이벌과 다섯 차례나 맞붙었다.',
    jp_kenshin:    '군신이라 불린 북쪽 지방의 용. 곤경에 빠진 라이벌에게 소금을 보내며 의로 싸웠다.',
    jp_masamune:   '한쪽 눈을 잃고도 동북 지방의 패자가 되었다. 외눈의 용이라는 별명이 그 위세를 말해 준다.',
    jp_yukimura:   '큰 성을 지키는 마지막 싸움에서 적 총대장의 본진을 두 번이나 흔들었다. 그 나라 제일의 병사라 불렸다.',
    jp_musashi:    '두 자루 검을 함께 쓰는 유파를 세워 수십 번의 결투에서 지지 않았다. 병법서 한 권에 검의 이치를 남겼다.',
    jp_hanzo:      '은신술을 쓰는 집단의 우두머리로 한 패자를 섬겼다. 그림자처럼 움직이고 흔적을 남기지 않았다.',
    jp_mitsukuni:  '한 지방의 번주로 나라의 역사서 편찬을 시작했다. 후대엔 천하를 떠도는 은거 재상의 이야기로 전해졌다.',
    jp_naosuke:    '개항을 밀어붙이다 궁성 문밖에서 습격당해 죽었다. 문을 연 대가를 목숨으로 치렀다.',
    jp_saigo:      '유신의 공신이었으나 훗날 옛 무사들과 함께 반란에 나섰다가 스러졌다.',
    jp_ryoma:      '적대하던 두 번을 중매해 막부를 무너뜨릴 길을 열었다. 새 시대를 보지 못하고 옛 도읍에서 암살됐다.',

    eu_caesar:     '북쪽 변경을 평정하고 돌아오지 않는 강을 건넜다. 종신 집정관이 된 이듬해 회의장에서 쓰러졌다.',
    eu_alexander:  '스무 살에 왕위에 올라 동쪽 대제국을 넘어 먼 땅까지 나아갔다. 서른을 갓 넘긴 나이에 원정 중 병으로 죽었다.',
    eu_hannibal:   '코끼리를 끌고 높은 산맥을 넘어 적국의 안마당을 십수 년 동안 누볐다. 한 들판의 싸움에서 완벽한 포위 전술을 보여 주었다.',
    eu_charlemagne: '여러 부족을 하나로 묶어 큰 나라를 세우고 황제의 관을 받았다. 궁정에 학교를 세워 학문을 되살렸다.',
    eu_joan:       '열일곱 시골 소녀의 몸으로 군을 이끌어 포위된 도시를 풀어냈다. 채 스물이 되기 전에 화형대의 불길 속에서 갔다.',
    eu_napoleon:   '포병 하급 장교에서 황제 자리까지 올랐다. 대륙의 지도를 다시 그렸으나, 마지막 큰 싸움에서 지고 외딴섬에서 생을 마쳤다.',
    eu_davinci:    '그림과 인체 해부와 나는 기계의 설계를 한 공책에 함께 적었다. 끝내지 않은 것이 끝낸 것보다 많았다.',
    eu_augustus:   '오랜 내전을 끝내고 새로운 통치 체제를 세웠다. 수십 년의 평화가 그의 시대의 이름으로 불린다.',
    eu_scipio:     '북아프리카 벌판에서 숙적의 명장을 꺾어 오랜 전쟁을 끝냈다. 이기고 돌아온 뒤 오히려 본국 정치에서 시달렸다.',
    eu_leonidas:   '삼백의 정예로 좁은 협곡 길을 막아섰다. 길이 뚫린 뒤에도 그 자리를 끝내 떠나지 않았다.',
    eu_aurelius:   '전장의 천막 안에서 스스로에게 쓰는 성찰의 글을 남겼다. 황제였으나 스스로를 다스리는 데 더 힘썼다.',
    eu_richard:    '원정군을 이끌어 이슬람 명장과 맞섰다. 왕위에 있던 십 년 중 본국에 머문 것은 반 년 남짓이었다.',
    eu_william:    '해협 건너 싸움에서 이겨 섬나라의 주인이 되었다. 온 나라의 땅과 재산을 세어 책 한 권에 담았다.',
    eu_harald:     '먼 남쪽 제국의 근위대에서 이름을 얻고 돌아와 왕이 되었다. 마지막 원정길의 다리 위에서 화살에 갔다.',
    eu_frederick:  '악기를 불고 먼 학자와 편지를 주고받으며 변경의 땅을 지켰다. 스스로를 나라의 첫째 종복이라 불렀다.',
    eu_peter:      '손수 배 만드는 법을 배우러 먼 서쪽 나라로 떠났다. 늪 위에 새 도시를 세워 바다로 가는 창을 열었다.',
    eu_elizabeth:  '수십 년을 홀로 왕좌에 앉아 이웃 강국의 대함대를 물리쳤다. 혼인을 묻는 신하에게 나라와 혼인했다고 답했다.',
    eu_nelson:     '한쪽 눈과 한쪽 팔을 잃고도 함대를 이끌었다. 마지막 큰 해전에서 이기고 그 갑판 위에서 숨을 놓았다.',
    eu_machiavelli: '도시 공화국의 관리로 일하다 실각해 시골 농장에서 정치를 논한 책을 썼다. 있어야 할 것 대신 있는 그대로를 적었다.',
    eu_newton:     '전염병으로 대학이 문을 닫은 해에 새로운 계산법과 힘의 법칙을 함께 얻었다. 말년에는 화폐를 관리하며 위조범을 잡는 일에 힘썼다.',
    eu_michelangelo: '큰 예배당 천장을 여러 해 동안 올려다보며 그렸다. 화가보다 조각가로 불리기를 더 좋아했다.',
    eu_eleanor:    '이웃한 두 왕국 모두의 왕비였고, 두 왕의 어머니이기도 했다. 여든이 넘어서도 말을 타고 다녔다.',

    wd_ashoka:     '한 정복 전쟁의 참상을 보고 크게 뉘우쳐 가르침에 귀의했다. 돌기둥에 새긴 법령을 제국 곳곳에 세웠다.',
    wd_akbar:      '서로 다른 종교의 인재를 함께 등용하고 차별 세금을 없앴다. 자신의 왕조를 그 대륙 최대의 세력으로 세웠다.',
    wd_saladin:    '원정군에게서 성지를 되찾고도 포로를 살려 보냈다. 적마저 그 너그러움을 기렸다.',
    wd_suleiman:   '자신의 제국 영토를 유럽 깊숙이까지 넓히고 법전을 정비했다. 이웃 나라들은 그를 장엄한 자라 불렀다.',
    wd_ibnsina:    '방대한 의학서를 남겨 수백 년 동안 먼 대륙 의학의 교과서가 되었다. 철학과 의술을 한 몸에 지녔다.',
    wd_genghis:    '흩어진 초원 부족들을 하나로 묶어 역사상 가장 넓은 땅을 정복했다. 초원 나름의 법을 세워 다스렸다.',
    wd_khubilai:   '초원 제국을 새 왕조로 세우고 넓은 중원을 다스렸다. 먼 서쪽에서 온 여행자가 그 궁정의 화려함을 기록으로 남겼다.',
    wd_mansamusa:  '성지 순례길에 금을 아낌없이 뿌려 지나는 도시들의 물가를 흔들었다. 자신의 나라를 세계지도에 처음으로 새겨 넣었다.',
    wd_shaka:      '짧은 창과 새로운 진법으로 자신의 부족을 남쪽 대륙의 패자로 세웠다. 군사 혁신의 이름으로 후대에 남았다.',
    wd_cleopatra:  '두 대국의 실력자들 사이를 오가며 자신의 왕국을 지켰다. 마지막 해전에서 패한 뒤 스스로 삶을 거두었다.',
    wd_pachacuti:  '산중의 도시국가를 대제국으로 키웠다. 구름 위 산성 도시가 그 시대에 세워졌다고 전해진다.',
    wd_moctezuma:  '한 대제국 최전성기의 지배자였으나, 바다 건너에서 온 낯선 이들 앞에서 제국이 흔들리기 시작했다.',
    wd_ibnbattuta: '삼십 년 동안 세 대륙을 떠돌았다. 자신의 여행기에 그 먼 발자취를 남겼다.',
    wd_hammurabi:  '고대 도시국가의 왕으로 이백여 조항의 법전을 돌기둥에 새겼다. 눈에는 눈, 이에는 이의 원칙을 세웠다.',
    wd_attila:     '동서로 나뉜 대제국을 함께 떨게 한 초원 기마민족의 왕. 스스로를 신이 내린 채찍이라 불렀다.'
  };

  /** 세력별 카드 색과 문양 — 인물 카드에 쓰인다 */
  var FACTIONS = {
    '촉':       { color: '#2f7d5c', mark: '蜀' },
    '위':       { color: '#31609f', mark: '魏' },
    '오':       { color: '#a03f3f', mark: '吳' },
    '군웅':     { color: '#6d5c8c', mark: '群' },
    '재야':     { color: '#5b6572', mark: '野' },
    '남만':     { color: '#7c5c2c', mark: '蠻' },
    '고구려':   { color: '#3a6ea5', mark: '高' },
    '백제':     { color: '#7a5aa8', mark: '濟' },
    '신라':     { color: '#b08a2e', mark: '羅' },
    '발해':     { color: '#2f7069', mark: '渤' },
    '고려':     { color: '#2e6c50', mark: '麗' },
    '조선':     { color: '#8b5c2c', mark: '朝' },
    '대한제국': { color: '#7c3d3d', mark: '韓' },
    '일제강점기': { color: '#4b4b5c', mark: '義' },
    /* 유럽사 — 한자 표식이 없으니 mark 는 라틴 한 글자로 둔다 */
    '로마':       { color: '#9c3d3d', mark: 'R' },
    '마케도니아': { color: '#b8892e', mark: 'M' },
    '카르타고':   { color: '#7c4a8c', mark: 'C' },
    '스파르타':   { color: '#a03a2e', mark: 'Λ' },
    '프랑크':     { color: '#3f6ba5', mark: 'F' },
    '프랑스':     { color: '#2f4f9f', mark: '⚜' },
    '잉글랜드':   { color: '#8b3a3a', mark: 'E' },
    '노르만':     { color: '#5a6a8c', mark: 'N' },
    '노르웨이':   { color: '#3a6a7a', mark: 'ᚱ' },
    '이탈리아':   { color: '#2f7d5c', mark: 'I' },
    '러시아':     { color: '#4a5a8c', mark: 'Р' },
    '프로이센':   { color: '#3a3a4c', mark: 'P' },

    /* 일본사(2026-09-10) — 한자 문화권이라 한 글자 한자로 표식을 단다 */
    '야마타이':     { color: '#6d4c8c', mark: '邪' },
    '다이라가':     { color: '#8b3a3a', mark: '平' },
    '가마쿠라막부': { color: '#3a5a6a', mark: '鎌' },
    '겐지가':       { color: '#4a6a8c', mark: '源' },
    '헤이안':       { color: '#7a5a8c', mark: '安' },
    '오다가':       { color: '#a03f2e', mark: '織' },
    '도요토미가':   { color: '#b8892e', mark: '豊' },
    '도쿠가와막부': { color: '#3a4a6a', mark: '徳' },
    '다케다가':     { color: '#5c7a3a', mark: '武' },
    '우에스기가':   { color: '#4a7a8c', mark: '上' },
    '다테가':       { color: '#6a3a3a', mark: '伊' },
    '사나다가':     { color: '#a03a2e', mark: '眞' },
    '낭인':         { color: '#5b6572', mark: '浪' },
    '이가':         { color: '#2e2e3a', mark: '忍' },
    '메이지유신':   { color: '#2f7d5c', mark: '明' },

    /* 세계사(2026-09-10, 비유럽) — 한자 문화권이 아니면 유럽사와 같은 결로 라틴 한 글자 */
    '마우리아':       { color: '#b8892e', mark: 'A' },
    '무굴':           { color: '#2f7069', mark: 'M' },
    '아이유브':       { color: '#3f8c5c', mark: 'S' },
    '오스만':         { color: '#8b3a3a', mark: 'O' },
    '페르시아':       { color: '#4a5a8c', mark: 'P' },
    '몽골제국':       { color: '#7c5c2c', mark: 'G' },
    '원':             { color: '#a03f3f', mark: 'Y' },
    '말리제국':       { color: '#b09a2e', mark: 'K' },
    '줄루왕국':       { color: '#7a3a2e', mark: 'Z' },
    '프톨레마이오스': { color: '#3a6a8c', mark: 'E' },
    '잉카제국':       { color: '#8c6a2e', mark: 'I' },
    '아즈텍':         { color: '#6a8c3a', mark: 'X' },
    '여행자':         { color: '#5b6572', mark: '✦' },
    '바빌로니아':     { color: '#5a4a8c', mark: 'B' },
    '훈제국':         { color: '#4a4a4a', mark: 'H' }
  };

  /** 기질 표기 */
  var TRAIT_MARK = { might: '武', wisdom: '智', virtue: '德' };

  /** 등급별 표시 정보. `name` 은 2026-09-10 추가 — 그동안 별 개수(`label`)만
   *  있고 말로 된 등급 이름이 없었다("아이템·장비 등급 체계를 다섯 판 전체에"
   *  요청, 사가나락 `data-item.js`의 상품→전설 다섯 단과 같은 결로 "기본→전설"
   *  로 이름 붙였다). **사가만리는 등용서·사료 같은 소모품만 있고 장비 체계
   *  자체가 없어(`bag.js` 머리말 참고) 장비에 등급을 얹지 않는다** — 이미
   *  있던 인물·펫의 1~5 등급(`rarity`)에 이름만 보탰다, 숫자·색·별 개수는
   *  그대로라 세이브·정렬 로직에 영향 없다. */
  var RARITY = {
    1: { label: '★',      color: '#9aa4b2', name: '기본' },
    2: { label: '★★',     color: '#5ec26a', name: '상급' },
    3: { label: '★★★',    color: '#4aa3f0', name: '희귀' },
    4: { label: '★★★★',   color: '#b06bf0', name: '영웅' },
    5: { label: '★★★★★',  color: '#f0a53a', name: '전설' }
  };

  /** 설득 어필 방향 (인물 trait 과 맞으면 호감도 크게 상승) */
  var APPEALS = [
    { key: 'might',  label: '무(武)로 겨루자', desc: '힘과 담대함으로 마음을 얻는다', emoji: '⚔️' },
    { key: 'wisdom', label: '지(智)를 논하자', desc: '식견과 계책으로 마음을 얻는다', emoji: '📜' },
    { key: 'virtue', label: '덕(德)으로 청하자', desc: '진심과 예로써 마음을 얻는다', emoji: '🙏' }
  ];

  global.DG = global.DG || {};
  global.DG.data = {
    heroes: HEROES,
    pets: PETS,
    rarity: RARITY,
    appeals: APPEALS,
    factions: FACTIONS,
    traitMark: TRAIT_MARK,
    /** 세력 정보 (없는 세력은 기본색) */
    faction: function (name) {
      return FACTIONS[name] || { color: '#5b6572', mark: '·' };
    },
    /** 열전 한 줄 (없으면 빈 문자열). 정적 BIOS에 없으면 절차적 생성기
     *  (`js/genchar.js`(한국)·`js/genchar-jp.js`(일본)·`js/genchar-cn.js`
     *  (중국)·`js/genchar-xy.js`(서역), saga-go 전용)의 것을 시도한다 — 그 모듈들이 없는 나머지
     *  네 판에서는 그냥 빈 문자열로 그친다(회귀 아님). */
    bio: function (id) {
      if (BIOS[id]) { return BIOS[id]; }
      return (global.DG.genchar && global.DG.genchar.bio(id)) ||
        (global.DG.gencharJp && global.DG.gencharJp.bio(id)) ||
        (global.DG.gencharCn && global.DG.gencharCn.bio(id)) ||
        (global.DG.gencharXy && global.DG.gencharXy.bio(id)) || '';
    },
    /** id 로 찾기. 정적 HEROES/PETS에 없으면 절차적 생성기(있는 판에서만)로
     *  되살린다 — 세이브에는 id만 있으면 되므로 정적 배열에 없어도 된다. */
    find: function (id) {
      var i;
      for (i = 0; i < HEROES.length; i++) { if (HEROES[i].id === id) { return HEROES[i]; } }
      for (i = 0; i < PETS.length; i++) { if (PETS[i].id === id) { return PETS[i]; } }
      return (global.DG.genchar && global.DG.genchar.find(id)) ||
        (global.DG.gencharJp && global.DG.gencharJp.find(id)) ||
        (global.DG.gencharCn && global.DG.gencharCn.find(id)) ||
        (global.DG.gencharXy && global.DG.gencharXy.find(id)) || null;
    }
  };
})(window);
