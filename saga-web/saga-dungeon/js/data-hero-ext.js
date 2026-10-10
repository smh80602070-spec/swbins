/**
 * 인물 확장 — 현대·미래 30 (PLAN §5.7 시대 퓨전, §10-Q1)
 * ---------------------------------------------------------------
 * `data.js`(HEROES 105)는 **다섯 판 공통 사본**이라 함부로 못 늘린다 —
 * 늘리려면 다섯 벌 md5 를 맞춰야 한다(루트 CLAUDE.md). §10-Q1 이 확정한
 * 대로 "이 판 전용 확장 파일로 먼저 실험, 검증되면 다섯 판 공통 편입 여부를
 * 다시 정한다"를 그대로 따른다 — 그래서 `data.js` 는 한 글자도 안 건드리고,
 * 이 파일이 부팅 시 `DG.data.heroes`(=HEROES, 참조가 같다)에 30명을
 * **push** 한다. `find()`·`bio()`·도감·자가진단(가명 정책 포함) 전부
 * `DG.data.heroes` 를 그대로 읽으므로 이 30명도 다섯 판 나머지 넷엔 아직
 * 안 나오면서 이 판에서는 105명과 완전히 같은 대접을 받는다.
 *
 * **반드시 `data.js` 뒤에 실려야 한다**(index.html/_test.html 스크립트
 * 순서 — HEROES 가 아직 없으면 push 할 배열 자체가 없다).
 *
 * era 는 '현대'·'미래' 둘 — 기존 넷(삼국지·한국사·일본사·세계사)과
 * 나란히 도감 era 필터(ui.js)가 다섯째·여섯째 칸으로 받는다.
 * faction 은 나라·왕조 대신 업계·기관 이름(실명 정책과 무관 — 전부
 * 가상의 조직이다). trait 는 기존 넷(might/wisdom/virtue/command)을
 * 그대로 쓴다 — 다섯째 트레이트를 새로 안 만든다.
 *
 * 실명 정책: 이름·quote 모두 실제 인물·기업·기관명을 안 쓴다(가상
 * 오마주 — "그런 일을 하는 사람" 만 그렸다). `_test.html` 의 가명 정책
 * 진단이 `DG.data.heroes` 전체를 훑으므로 이 30명도 자동으로 검사된다.
 */
(function (global) {
  'use strict';

  var EXT_HEROES = [
    /* ── 현대(現代) 15 ────────────────────────────────────── */
    { id: 'md_ceo', sex: 'm',          name: '금상', era: '현대', faction: '재계',       rarity: 5, trait: 'command', stats: { might: 42, wisdom: 80, command: 100 }, hanja: '金想', emoji: '💼', quote: '사람을 남기는 셈이 결국 남는 장사요.' },
    { id: 'md_scientist', sex: 'm',    name: '현소', era: '현대', faction: '학계',       rarity: 5, trait: 'wisdom',  stats: { might: 18, wisdom: 100, command: 68 }, hanja: '玄素', emoji: '🔬', quote: '증명되지 않은 것도, 시도할 가치는 있습니다.' },
    { id: 'md_athlete', sex: 'm',      name: '쾌준', era: '현대', faction: '체육계',     rarity: 4, trait: 'might',   stats: { might: 97, wisdom: 38, command: 70 }, hanja: '快俊', emoji: '🏃', quote: '몸이 먼저 답을 압니다.' },
    { id: 'md_explorer', sex: 'm',     name: '원행', era: '현대', faction: '탐험대',     rarity: 4, trait: 'might',   stats: { might: 88, wisdom: 64, command: 66 }, hanja: '遠行', emoji: '🧭', quote: '지도에 없는 곳이라 가는 겁니다.' },
    { id: 'md_doctor', sex: 'f',       name: '인술', era: '현대', faction: '의료계',     rarity: 4, trait: 'virtue',  stats: { might: 28, wisdom: 92, command: 78 }, hanja: '仁術', emoji: '🩺', quote: '손이 늦으면 마음이라도 먼저 갑니다.' },
    { id: 'md_chef', sex: 'm',         name: '미공', era: '현대', faction: '요식업계',   rarity: 3, trait: 'virtue',  stats: { might: 34, wisdom: 80, command: 54 }, hanja: '味工', emoji: '🍳', quote: '맛은 정직함에서 옵니다.' },
    { id: 'md_pilot', sex: 'm',        name: '창공', era: '현대', faction: '항공업계',   rarity: 4, trait: 'might',   stats: { might: 82, wisdom: 66, command: 84 }, hanja: '蒼空', emoji: '✈️', quote: '이륙은 마지막 확인 뒤에 옵니다.' },
    { id: 'md_firefighter', sex: 'f',  name: '화진', era: '현대', faction: '소방청',     rarity: 4, trait: 'virtue',  stats: { might: 94, wisdom: 44, command: 68 }, hanja: '火鎭', emoji: '🚒', quote: '먼저 뛰어드는 게 제 일입니다.' },
    { id: 'md_developer', sex: 'f',    name: '율빈', era: '현대', faction: '게임업계',   rarity: 3, trait: 'wisdom',  stats: { might: 24, wisdom: 88, command: 56 }, hanja: '律彬', emoji: '🎮', quote: '버그도 이야기의 일부죠.' },
    { id: 'md_journalist', sex: 'm',   name: '필경', era: '현대', faction: '언론계',     rarity: 3, trait: 'wisdom',  stats: { might: 26, wisdom: 86, command: 64 }, hanja: '筆鏡', emoji: '📰', quote: '묻지 않으면 아무도 모릅니다.' },
    { id: 'md_architect', sex: 'f',    name: '축형', era: '현대', faction: '건축업계',   rarity: 3, trait: 'command', stats: { might: 30, wisdom: 78, command: 74 }, hanja: '築衡', emoji: '🏙️', quote: '무너지지 않는 게 첫째 미덕입니다.' },
    { id: 'md_musician', sex: 'm',     name: '현율', era: '현대', faction: '음악계',     rarity: 3, trait: 'command', stats: { might: 32, wisdom: 68, command: 82 }, hanja: '絃律', emoji: '🎻', quote: '박자는 마음이 먼저 맞춥니다.' },
    { id: 'md_lawyer', sex: 'm',       name: '정변', era: '현대', faction: '법조계',     rarity: 3, trait: 'command', stats: { might: 24, wisdom: 86, command: 76 }, hanja: '正辯', emoji: '⚖️', quote: '말보다 근거가 이깁니다.' },
    { id: 'md_photographer', sex: 'm', name: '순간', era: '현대', faction: '사진예술계', rarity: 3, trait: 'virtue',  stats: { might: 32, wisdom: 78, command: 48 }, hanja: '瞬間', emoji: '📷', quote: '지나가면 다시 안 옵니다.' },
    { id: 'md_entrepreneur', sex: 'f', name: '개척', era: '현대', faction: '창업계',     rarity: 4, trait: 'command', stats: { might: 46, wisdom: 74, command: 92 }, hanja: '開拓', emoji: '🚀', quote: '없던 길이라 제가 냅니다.' },

    /* ── 미래(未來) 15 ────────────────────────────────────── */
    { id: 'ft_astronaut', sex: 'f',       name: '성해',   era: '미래', faction: '우주개발청',   rarity: 5, trait: 'virtue',  stats: { might: 72, wisdom: 82, command: 90 }, hanja: '星海', emoji: '🧑‍🚀', quote: '돌아갈 곳이 없다는 게, 나아갈 이유입니다.' },
    { id: 'ft_hacker', sex: 'm',          name: '은선',   era: '미래', faction: '해커연합',     rarity: 4, trait: 'wisdom',  stats: { might: 22, wisdom: 98, command: 64 }, hanja: '隱線', emoji: '💻', quote: '문은 두드리는 게 아니라 찾는 겁니다.' },
    { id: 'ft_bioeng', sex: 'm',          name: '생결',   era: '미래', faction: '생명공학연구소', rarity: 4, trait: 'wisdom', stats: { might: 26, wisdom: 96, command: 70 }, hanja: '生結', emoji: '🧬', quote: '생명은 설계도가 아니라 과정입니다.' },
    { id: 'ft_dronecmd', sex: 'f',        name: '편대',   era: '미래', faction: '드론사령부',   rarity: 4, trait: 'command', stats: { might: 52, wisdom: 70, command: 94 }, hanja: '編隊', emoji: '🛸', quote: '눈이 백 개면 놓치는 게 없습니다.' },
    { id: 'ft_airesearch', sex: 'f',      name: '지연',   era: '미래', faction: 'AI연구소',     rarity: 4, trait: 'wisdom',  stats: { might: 16, wisdom: 100, command: 72 }, hanja: '智淵', emoji: '🤖', quote: '생각하는 기계보다 무서운 건 안 생각하는 사람입니다.' },
    { id: 'ft_cyberdoc', sex: 'm',        name: '접합',   era: '미래', faction: '사이버의학회', rarity: 3, trait: 'virtue',  stats: { might: 34, wisdom: 84, command: 58 }, hanja: '接合', emoji: '🦾', quote: '몸이 바뀌어도 사람은 안 바뀝니다.' },
    { id: 'ft_orbitmech', sex: 'f',       name: '궤도공', era: '미래', faction: '궤도정비단',   rarity: 3, trait: 'might',   stats: { might: 80, wisdom: 52, command: 60 }, hanja: '軌道工', emoji: '🛰️', quote: '떠 있는 것도 결국 손이 잡습니다.' },
    { id: 'ft_climateeng', sex: 'f',      name: '기후결', era: '미래', faction: '기후공학청',   rarity: 3, trait: 'command', stats: { might: 32, wisdom: 82, command: 66 }, hanja: '氣候結', emoji: '🌪️', quote: '날씨도 결국 설계할 수 있습니다.' },
    { id: 'ft_quantumphy', sex: 'f',      name: '양자현', era: '미래', faction: '양자물리연구원', rarity: 4, trait: 'wisdom', stats: { might: 20, wisdom: 99, command: 64 }, hanja: '量子玄', emoji: '⚛️', quote: '관측하기 전엔, 무엇도 정해지지 않습니다.' },
    { id: 'ft_nanotech', sex: 'f',        name: '미세공', era: '미래', faction: '나노기술원',   rarity: 3, trait: 'virtue',  stats: { might: 28, wisdom: 88, command: 52 }, hanja: '微細工', emoji: '🔬', quote: '작은 것이 가장 크게 바꿉니다.' },
    { id: 'ft_marspioneer', sex: 'm',     name: '화적',   era: '미래', faction: '화성개척단',   rarity: 4, trait: 'might',   stats: { might: 86, wisdom: 56, command: 78 }, hanja: '火赤', emoji: '🔴', quote: '붉은 땅도 결국 사람의 땅이 됩니다.' },
    { id: 'ft_roboteng', sex: 'f',        name: '관절공', era: '미래', faction: '로봇공학회',   rarity: 3, trait: 'might',   stats: { might: 62, wisdom: 72, command: 54 }, hanja: '關節工', emoji: '🦿', quote: '관절 하나가 걸음 전부를 바꿉니다.' },
    { id: 'ft_ewarfare', sex: 'f',        name: '신호전', era: '미래', faction: '전자전단',     rarity: 3, trait: 'might',   stats: { might: 68, wisdom: 66, command: 70 }, hanja: '信號戰', emoji: '📡', quote: '안 보이는 싸움이 진짜 싸움입니다.' },
    { id: 'ft_hologramartist', sex: 'm',  name: '환영사', era: '미래', faction: '홀로그램예술단', rarity: 3, trait: 'wisdom', stats: { might: 18, wisdom: 82, command: 56 }, hanja: '幻影師', emoji: '🎭', quote: '빛으로도 마음을 그릴 수 있습니다.' },
    { id: 'ft_fusioneng', sex: 'm',       name: '융로공', era: '미래', faction: '융합로기술단', rarity: 4, trait: 'wisdom',  stats: { might: 36, wisdom: 94, command: 74 }, hanja: '融爐工', emoji: '☢️', quote: '별의 불을 손안에 가둔 셈입니다.' }
  ];

  if (global.DG && global.DG.data && global.DG.data.heroes) {
    for (var i = 0; i < EXT_HEROES.length; i++) { global.DG.data.heroes.push(EXT_HEROES[i]); }
  }
})(window);
