/**
 * 던전 데이터 — 층 테마 · 방 종류 · 은사(恩賜)
 * ---------------------------------------------------------------
 * 던전은 로그라이크다. 한 회차(run) 안에서만 강해지고, 죽으면 그 회차가 끝난다.
 *
 *   층 테마   층수에 따라 배경·적 성향이 바뀐다 (5층 단위)
 *   방 종류   전투방 · 보물방 · 우물방(회복) · 사당방 · 계단방 · 보스방
 *   은사      층을 깨면 셋 중 하나를 고른다. 회차가 끝나면 사라진다
 *             (영구 강화는 환생 도장(prestige.js) 쪽이 담당한다)
 *
 * 은사를 추가할 때는 BOONS 에 한 줄만 넣는다. dungeon.js 는 eff 를 읽기만 한다.
 */
(function (global) {
  'use strict';

  /** 층 테마 — from 층부터 적용 */
  var THEMES = [
    { from: 1,  name: '고분(古墳)',   floor: '#2a2620', wall: '#4a4238', tint: 'rgba(120,100,70,0.10)' },
    { from: 6,  name: '폐성(廢城)',   floor: '#242830', wall: '#3d4450', tint: 'rgba(90,110,150,0.10)' },
    { from: 11, name: '산채(山寨)',   floor: '#232a24', wall: '#3a4a38', tint: 'rgba(90,140,90,0.10)' },
    { from: 16, name: '수궁(水宮)',   floor: '#1e2a30', wall: '#2f4650', tint: 'rgba(70,140,170,0.12)' },
    { from: 21, name: '지옥문(地獄門)', floor: '#2c1f1f', wall: '#4d2e2e', tint: 'rgba(180,70,60,0.12)' },
    { from: 26, name: '천계(天界)',   floor: '#2a2536', wall: '#453c58', tint: 'rgba(160,130,220,0.12)' }
  ];

  /**
   * 명소 층(名所層) — PLAN §5.15. 층 테마 여섯마다 테마 끝 층(5·10·15·20·25·30)은 **손으로 짠 고정 층**이다.
   * 원작 2편의 고정 퀘스트 구역(늘 같은 모양·같은 주인) 자리 — 나머지 층은 지금처럼 문 갈림길.
   * 방 다섯이 늘 같은 순서로 이어지고(문은 하나, 다음 방 이름이 붙는다), 방마다 기둥 배치(pat)·
   * 적 명단·자리가 늘 같다. 마지막 방은 층 주인(guard — 몸은 base 몬스터를 빌린다, 이름은 창작).
   * foes: [이름, 수, 정예면 true]. 방 종류(kind)는 ROOMS 의 것을 그대로 쓴다(상자·우물·사당 판정 재사용).
   * guard.sig — 층 주인 고유 수(§5.18). kind 여섯: summon(체력 문턱마다 졸개) · rain(원 n 개) · hops(연속 돌진)
   *   · vortex(끌어당긴 뒤 둘레 폭발) · pool(불바닥이 남는다) · cross(+/× 번갈아 줄 넷). 판정은 dungeon.js guardZones.
   */
  var FIXED = [
    { floor: 5, key: 'tomb', name: '순장 왕릉', hanja: '殉葬王陵', emoji: '⚱️',
      intro: '돌길 양옆으로 순장된 병사들의 무덤이 늘어서 있다 — 가장 안쪽 현실에 무언가 깨어 있다',
      guard: { name: '녹슨 순장장군', emoji: '🦴', base: '해골대장', color: '#8a7a5a', desc: '왕을 따라 묻힌 장군이 아직 칼을 쥐고 있다',
        sig: { name: '순장 호령', kind: 'summon', at: [0.66, 0.33], add: '해골졸개', n: 2, line: '순장된 병사들이 무덤에서 일어난다' } },
      rooms: [
        { kind: 'fight', title: '참배길', pat: 'hall', foes: [['해골졸개', 4], ['원혼', 2]] },
        { kind: 'shrine', title: '제기방', pat: 'open', foes: [['풋귀', 2]] },
        { kind: 'elite', title: '순장갱', pat: 'ring', foes: [['해골무사', 1, true], ['해골졸개', 3]] },
        { kind: 'trove', title: '부장품실', pat: 'cross', foes: [['해골척후', 2]] },
        { kind: 'boss', title: '현실(玄室)', pat: 'cross', foes: [['해골무사', 2]] }
      ] },
    { floor: 10, key: 'fort', name: '무너진 망루성', hanja: '望樓城', emoji: '🏯',
      intro: '성문은 부서졌고 망루에는 아직 불이 켜져 있다 — 성주가 성을 버리지 않았다',
      guard: { name: '망루성 성주의 망령', emoji: '👑', base: '철갑 중장병', color: '#5a6a8a', desc: '함락된 날의 갑옷 그대로 성을 지킨다',
        sig: { name: '망루 화살비', kind: 'rain', cd: 7, warn: 0.9, r: 42, n: 3, spread: 55, mul: 1.2, el: 'phys', color: '#d9c27a' } },
      rooms: [
        { kind: 'fight', title: '부서진 성문', pat: 'hall', foes: [['떠돌이 병졸', 3], ['위군 창병', 2], ['연노 사수', 1]] },
        { kind: 'well', title: '병영 우물', pat: 'open', foes: [] },
        { kind: 'cave', title: '무기고', pat: 'cross', foes: [['위군 창병', 2]] },
        { kind: 'elite', title: '망루', pat: 'ring', foes: [['왜군 조총병', 1, true], ['연노 사수', 2]] },
        { kind: 'boss', title: '성주각', pat: 'hall', foes: [['철갑 중장병', 2]] }
      ] },
    { floor: 15, key: 'bandit', name: '흑풍 산채', hanja: '黑風山寨', emoji: '🏴',
      intro: '목책 너머로 검은 깃발이 펄럭인다 — 잡혀 온 사람들의 소리가 들린다',
      guard: { name: '흑풍 채주', emoji: '🐯', base: '산군', color: '#3a3a2a', desc: '범 가죽을 두른 산채의 우두머리',
        sig: { name: '흑풍 삼연돌', kind: 'hops', cd: 8, warn: 0.45, r: 34, hops: 3, mul: 0.9, el: 'phys', color: '#b09a5a' } },
      rooms: [
        { kind: 'fight', title: '목책 어귀', pat: 'hall', foes: [['산적', 4], ['도적떼', 2]] },
        { kind: 'event', title: '포로 우리', pat: 'open', foes: [['산적', 3]] },
        { kind: 'forage', title: '약초밭', pat: 'open', foes: [['멧돼지', 1]] },
        { kind: 'elite', title: '두령방', pat: 'cross', foes: [['마적', 1, true], ['산적', 3]] },
        { kind: 'boss', title: '취의청(聚義廳)', pat: 'ring', foes: [['마적', 2]] }
      ] },
    { floor: 20, key: 'palace', name: '가라앉은 용궁', hanja: '沈龍宮', emoji: '🐚',
      intro: '산호 기둥 사이로 물빛이 일렁인다 — 용좌에는 주인 대신 다른 것이 앉아 있다',
      guard: { name: '심연 용궁지기', emoji: '🐉', base: '흑이무기', color: '#1a4a6a', desc: '용이 되지 못한 채 용궁을 차지한 것',
        sig: { name: '심연 소용돌이', kind: 'vortex', cd: 9, warn: 1.2, r: 95, pull: 60, mul: 1.4, el: 'cold', color: '#5ab4ff' } },
      rooms: [
        { kind: 'fight', title: '산호길', pat: 'hall', foes: [['철갑해', 3], ['집게괴', 2], ['늪슬라임', 2]] },
        { kind: 'well', title: '진주 샘', pat: 'ring', foes: [] },
        { kind: 'puzzle', title: '수정 기관', pat: 'open', foes: [] },
        { kind: 'elite', title: '해마 마구간', pat: 'cross', foes: [['이무기', 1, true], ['심해 먹물귀', 2]] },
        { kind: 'boss', title: '용좌', pat: 'ring', foes: [['철갑해', 2]] }
      ] },
    { floor: 25, key: 'hellgate', name: '업화 대문', hanja: '業火大門', emoji: '⛩️',
      intro: '재가 눈처럼 내린다 — 거대한 문 앞에서 망자들이 줄을 서 있다',
      guard: { name: '업화 문지기', emoji: '🔥', base: '겁화귀', color: '#8a2a10', desc: '죄의 무게를 재어 문을 여는 불의 수문장',
        sig: { name: '업화 장판', kind: 'pool', cd: 6, warn: 0.8, r: 46, mul: 0.6, last: 6, poolMul: 0.2, maxPools: 4, el: 'fire', color: '#ff6a2a' } },
      rooms: [
        { kind: 'fight', title: '재의 다리', pat: 'hall', foes: [['화염귀', 2], ['해골귀', 3], ['가시귀', 2]] },
        { kind: 'shrine', title: '망자의 저울', pat: 'open', foes: [['원귀', 2]] },
        { kind: 'event', title: '고문실', pat: 'cross', foes: [['악귀', 3]] },
        { kind: 'elite', title: '불가마', pat: 'ring', foes: [['철가시귀', 1, true], ['역병강시', 2]] },
        { kind: 'boss', title: '대문', pat: 'hall', foes: [['화염귀', 2]] }
      ] },
    { floor: 30, key: 'heaven', name: '구름 위 금궐', hanja: '金闕', emoji: '🏛️',
      intro: '구름다리 끝에 금빛 궁궐이 떠 있다 — 천장군이 문을 닫고 칼을 뽑았다',
      guard: { name: '타락 천장군', emoji: '⚡', base: '대요술사', color: '#8a8ad9', desc: '하늘 문을 지키다 스스로 문이 되어 버린 장군',
        sig: { name: '천뢰 십자', kind: 'cross', cd: 8, warn: 1.0, r: 22, arms: 4, count: 5, gap: 48, mul: 1.3, el: 'lit', color: '#c9b8ff' } },
      rooms: [
        { kind: 'fight', title: '구름다리', pat: 'hall', foes: [['회오리 정령', 2], ['폭풍 정령', 2], ['산도깨비', 2]] },
        { kind: 'well', title: '선녀 샘', pat: 'ring', foes: [] },
        { kind: 'puzzle', title: '별자리 기관', pat: 'open', foes: [['요술사', 1]] },
        { kind: 'elite', title: '천병 사열장', pat: 'cross', foes: [['노왕도깨비', 1, true], ['요술사', 2]] },
        { kind: 'boss', title: '금궐 정전', pat: 'hall', foes: [['폭풍 정령', 2]] }
      ] },
    /* 31층 — 정본 트랙 메모 "31층 '이름 없는 곳'은 명소 층 표에 한 줄 더한다". 5막 끝 무명왕이 서는 곳(먹은 이름들이 세 시대 모습으로 번갈아 나온다) */
    { floor: 31, key: 'nameless', name: '이름 없는 곳', hanja: '無名處', emoji: '🌑',
      intro: '비석 숲 한가운데, 글자가 다 지워진 비석들이 빛 기둥처럼 서 있다 — 삼켜진 이름들이 저마다 다른 모습으로 일어난다',
      guard: { name: '이름을 삼키는 무명왕', emoji: '🌑', base: '대요술사', color: '#3a3a4a', desc: '먹은 이름의 수만큼 모습을 바꾸는 왕 — 장수, 폭주족, 기계가 번갈아 나온다',
        sig: { name: '삼킨 이름들', kind: 'summon', at: [0.66, 0.33], add: '원혼', n: 3, line: '삼킨 이름들이 세 시대의 모습으로 일어난다' } },
      rooms: [
        { kind: 'fight', title: '비석 숲', pat: 'hall', foes: [['원혼', 3], ['해골무사', 2]] },
        { kind: 'shrine', title: '지워진 이름의 제단', pat: 'open', foes: [['풋귀', 2]] },
        { kind: 'elite', title: '도시 잔해 조각', pat: 'ring', foes: [['역병강시', 1, true], ['원혼', 3]] },
        { kind: 'trove', title: '빛 기둥 곁', pat: 'cross', foes: [['요술사', 1]] },
        { kind: 'boss', title: '이름 없는 곳', pat: 'hall', foes: [['노왕도깨비', 2]] }
      ] }
  ];
  /** 방 기둥 배치 — 방 크기 비율(x, y). 판정은 없고 눈으로만(makeDecor 의 기둥과 같다) */
  var FIXED_PAT = {
    hall:  [[0.30, 0.24], [0.50, 0.24], [0.70, 0.24], [0.30, 0.76], [0.50, 0.76], [0.70, 0.76]],
    ring:  [[0.60, 0.20], [0.80, 0.35], [0.80, 0.65], [0.60, 0.80], [0.40, 0.65], [0.40, 0.35]],
    cross: [[0.40, 0.30], [0.40, 0.70], [0.75, 0.30], [0.75, 0.70]],
    open:  [[0.25, 0.20], [0.25, 0.80]]
  };
  function fixedOf(floor) {
    for (var i = 0; i < FIXED.length; i++) { if (FIXED[i].floor === floor) { return FIXED[i]; } }
    return null;
  }

  function themeOf(floor) {
    var t = THEMES[0];
    for (var i = 0; i < THEMES.length; i++) { if (floor >= THEMES[i].from) { t = THEMES[i]; } }
    return t;
  }

  /**
   * 축복(祝福) — PLAN §5.1(2026-09-18, 은사를 회차 빌드로 재해석).
   * 옛 은사(BOONS)는 전부 스탯 %(공격력·체력·속도…)라 "뭘 골라도 같았다" —
   * 그 자리를 세 축으로 대신한다. `axis`(skill/hero/world)·`rarity`
   * (common/rare/legendary) 로 나뉘고, `dungeon.js` `rollBoonChoice()`가
   * 축마다 하나씩 뽑아 세 장을 만든다(같은 축이 두 번 나올 수 없다 —
   * 축 하나에 후보 하나씩 뽑는 구조라 자동으로 충족된다).
   *
   *   skill 축   걸어 둔 무예의 모양(shape)을 강화한다 — 모양별로 common
   *              1개 + legendary 1개(수치 2배 + skillPct 보너스 합성).
   *              "무예 4칸 중 하나"가 아니라 **그 모양을 쓰는 무예 전부**에
   *              걸린다(어느 칸인지 세이브·UI로 추적하지 않는 단순화 —
   *              PLAN §5.1 원문보다 후하지만 로그라이트 특성상 문제 없다).
   *   hero  축   서명 무예(activeSigSkill)를 강화 — 쿨감/위력/그림자 서명.
   *   world 축   원소 시너지 12조합 — 실제 판정은 dungeon.js strike()/kill()
   *              안의 전용 분기(worldSynergy*)가 한다. eff 는 legendary
   *              둘만 "두 효과 합성"의 둘째 효과(skillPct)로 쓰인다.
   *
   *   max   같은 축복을 몇 번까지 겹칠 수 있는지 — 새 축복은 전부 1(다시
   *         안 나온다). 옛 %스탯 은사와 달리 "몇 겹" 개념이 없다.
   *   eff   dungeon.js 가 boonVal(key)로 읽는 범용 수치(있으면 합산).
   *         world 축의 특수 판정(화상·시너지 피해 등)은 eff가 아니라
   *         run.boons에 키가 있는지(hasBoon)만으로 켜진다.
   *
   * 대가로 옛 체계가 주던 hpPct·atkPct 같은 순수 스탯 성장은 사라졌다 —
   * 생존력 성장은 §5.2(유품)·§5.8(손맛)이 다른 축에서 맡는 쪽으로
   * 사용자와 방향을 맞췄다(HANDOFF 2026-09-18 참고).
   */
  var BOONS = [
    /* ── 무예 축 — 모양 아홉 × (common·legendary) ────────────── */
    { key: 'sk_swing_c', axis: 'skill', rarity: 'common', shape: 'swing', max: 1,
      name: '검세 확장(劍勢)', emoji: '⚔️', desc: '베기(swing) 무예의 범위 +25%',
      eff: { swingRangePct: 25 } },
    { key: 'sk_swing_l', axis: 'skill', rarity: 'legendary', shape: 'swing', max: 1,
      name: '검세 극(劍勢極)', emoji: '⚔️', desc: '베기 무예의 범위 +50% · 무예 위력 +10%',
      eff: { swingRangePct: 50, skillPct: 10 } },
    { key: 'sk_bolt_c', axis: 'skill', rarity: 'common', shape: 'bolt', max: 1,
      name: '연사(連射)', emoji: '🏹', desc: '기공탄(bolt) 무예가 +1발 나간다',
      eff: { boltShotAdd: 1 } },
    { key: 'sk_bolt_l', axis: 'skill', rarity: 'legendary', shape: 'bolt', max: 1,
      name: '연사 극(連射極)', emoji: '🏹', desc: '기공탄 무예가 +2발 · 무예 위력 +10%',
      eff: { boltShotAdd: 2, skillPct: 10 } },
    { key: 'sk_nova_c', axis: 'skill', rarity: 'common', shape: 'nova', max: 1,
      name: '이중 파동(二重波動)', emoji: '💥', desc: '터짐(nova) 무예가 한 번 더 터진다',
      eff: { novaExtraRing: 1 } },
    { key: 'sk_nova_l', axis: 'skill', rarity: 'legendary', shape: 'nova', max: 1,
      name: '삼중 파동(三重波動)', emoji: '💥', desc: '터짐 무예가 두 번 더 터진다 · 무예 위력 +10%',
      eff: { novaExtraRing: 2, skillPct: 10 } },
    { key: 'sk_dash_c', axis: 'skill', rarity: 'common', shape: 'dash', max: 1,
      name: '신법 가속(身法)', emoji: '🏃', desc: '돌진(dash) 무예의 무적 시간 +0.1초',
      eff: { dashInvulnAdd: 0.1 } },
    { key: 'sk_dash_l', axis: 'skill', rarity: 'legendary', shape: 'dash', max: 1,
      name: '신법 극(身法極)', emoji: '🏃', desc: '돌진 무예의 무적 시간 +0.2초 · 무예 위력 +10%',
      eff: { dashInvulnAdd: 0.2, skillPct: 10 } },
    { key: 'sk_chain_c', axis: 'skill', rarity: 'common', shape: 'chain', max: 1,
      name: '연환 확장(連環)', emoji: '🔗', desc: '연환(chain) 무예가 +2번 더 튄다',
      eff: { chainHopsAdd: 2 } },
    { key: 'sk_chain_l', axis: 'skill', rarity: 'legendary', shape: 'chain', max: 1,
      name: '연환 극(連環極)', emoji: '🔗', desc: '연환 무예가 +4번 더 튄다 · 무예 위력 +10%',
      eff: { chainHopsAdd: 4, skillPct: 10 } },
    { key: 'sk_summon_c', axis: 'skill', rarity: 'common', shape: 'summon', max: 1,
      name: '분신 증원(分身增員)', emoji: '👥', desc: '분신(summon) 무예의 소환 수 +1',
      eff: { summonCountAdd: 1 } },
    { key: 'sk_summon_l', axis: 'skill', rarity: 'legendary', shape: 'summon', max: 1,
      name: '분신 극(分身極)', emoji: '👥', desc: '분신 무예의 소환 수 +2 · 무예 위력 +10%',
      eff: { summonCountAdd: 2, skillPct: 10 } },
    { key: 'sk_curse_c', axis: 'skill', rarity: 'common', shape: 'curse', max: 1,
      name: '저주 지속(呪縛)', emoji: '🕸️', desc: '저주(curse) 무예의 지속시간 +40%',
      eff: { curseDurPct: 40 } },
    { key: 'sk_curse_l', axis: 'skill', rarity: 'legendary', shape: 'curse', max: 1,
      name: '저주 극(呪縛極)', emoji: '🕸️', desc: '저주 무예의 지속시간 +80% · 무예 위력 +10%',
      eff: { curseDurPct: 80, skillPct: 10 } },
    { key: 'sk_heal_c', axis: 'skill', rarity: 'common', shape: 'heal', max: 1,
      name: '치유 증폭(治癒)', emoji: '🌿', desc: '치유(heal) 무예의 회복량 +30%',
      eff: { healBonusPct: 30 } },
    { key: 'sk_heal_l', axis: 'skill', rarity: 'legendary', shape: 'heal', max: 1,
      name: '치유 극(治癒極)', emoji: '🌿', desc: '치유 무예의 회복량 +60% · 무예 위력 +10%',
      eff: { healBonusPct: 60, skillPct: 10 } },
    { key: 'sk_buff_c', axis: 'skill', rarity: 'common', shape: 'buff', max: 1,
      name: '기세 지속(氣勢)', emoji: '🔥', desc: '기세(buff) 무예의 지속시간 +50%',
      eff: { buffDurPct: 50 } },
    { key: 'sk_buff_l', axis: 'skill', rarity: 'legendary', shape: 'buff', max: 1,
      name: '기세 극(氣勢極)', emoji: '🔥', desc: '기세 무예의 지속시간 +100% · 무예 위력 +10%',
      eff: { buffDurPct: 100, skillPct: 10 } },

    /* ── 인물 축 — 서명 무예 강화 ────────────────────────────── */
    { key: 'hr_cd_c', axis: 'hero', rarity: 'common', max: 1,
      name: '심법 단축(心法)', emoji: '👤', desc: '서명 무예 쿨다운 -25%',
      eff: { sigCdPct: 25 } },
    { key: 'hr_dmg_c', axis: 'hero', rarity: 'common', max: 1,
      name: '심법 증폭(心法增幅)', emoji: '👤', desc: '서명 무예 위력 +40% · 발동 시 부대 전원 흔들림',
      eff: { sigDmgPct: 40 } },
    { key: 'hr_cd_r', axis: 'hero', rarity: 'rare', max: 1,
      name: '심법 단축 상(心法上)', emoji: '👤', desc: '서명 무예 쿨다운 -32%',
      eff: { sigCdPct: 32 } },
    { key: 'hr_dmg_r', axis: 'hero', rarity: 'rare', max: 1,
      name: '심법 증폭 상(心法增幅上)', emoji: '👤', desc: '서명 무예 위력 +50% · 발동 시 부대 전원 흔들림',
      eff: { sigDmgPct: 50 } },
    { key: 'hr_combo_l', axis: 'hero', rarity: 'legendary', max: 1,
      name: '심법 대성(心法大成)', emoji: '👤', desc: '서명 무예 쿨다운 -15% · 위력 +25% (합성)',
      eff: { sigCdPct: 15, sigDmgPct: 25 } },
    { key: 'hr_shadow_l', axis: 'hero', rarity: 'legendary', max: 1,
      name: '그림자 서명(影銘)', emoji: '🌑', desc: '부대 3~5번째 인물의 서명 무예가 20% 확률로 평타에 얹힌다',
      eff: { shadowSigPct: 20 } },

    /* ── 세계 축 — 원소 시너지 12조합. 실제 판정은 dungeon.js
       worldSynergyStrike()/worldSynergyOnKill() — eff 는 legendary 둘의
       "두 효과 합성" 둘째 효과(skillPct)에만 쓰인다. */
    { key: 'wd_fire_lit', axis: 'world', rarity: 'common', max: 1, pair: ['fire', 'lit'],
      name: '폭발(爆發)', emoji: '💥', desc: '화+뇌 — 처치 시 반경 80 안 적에게 화상을 건다', eff: {} },
    { key: 'wd_cold_chi', axis: 'world', rarity: 'common', max: 1, pair: ['cold', 'chi'],
      name: '결빙(結氷)', emoji: '❄️', desc: '빙+기 — 슬로우된 적에게 주는 피해 +30%', eff: {} },
    { key: 'wd_phys_fire', axis: 'world', rarity: 'common', max: 1, pair: ['phys', 'fire'],
      name: '작열(灼熱)', emoji: '🔥', desc: '물리+화 — 콤보 6 이상에서 물리 타격에 화상이 붙는다', eff: {} },
    { key: 'wd_phys_cold', axis: 'world', rarity: 'common', max: 1, pair: ['phys', 'cold'],
      name: '빙인(氷刃)', emoji: '🗡️', desc: '물리+빙 — 치명타가 대상을 얼려 슬로우를 건다', eff: {} },
    { key: 'wd_phys_chi', axis: 'world', rarity: 'common', max: 1, pair: ['phys', 'chi'],
      name: '경혈(經穴)', emoji: '🌀', desc: '물리+기 — 3연속 타격마다 기력을 되찾는다', eff: {} },
    { key: 'wd_phys_pois', axis: 'world', rarity: 'common', max: 1, pair: ['phys', 'pois'],
      name: '부패(腐敗)', emoji: '☠️', desc: '물리+독 — 처치 시 반경 80 안 적에게 독을 퍼뜨린다', eff: {} },
    { key: 'wd_pois_emp', axis: 'world', rarity: 'rare', max: 1, pair: ['pois', 'emp'],
      name: '부식(腐蝕)', emoji: '🧪', desc: '독+전자 — 적의 저항 -20', eff: {} },
    { key: 'wd_phys_lit', axis: 'world', rarity: 'rare', max: 1, pair: ['phys', 'lit'],
      name: '감전(感電)', emoji: '⚡', desc: '물리+뇌 — 처치 시 가까운 적 하나에게 번개가 옮는다', eff: {} },
    { key: 'wd_phys_emp', axis: 'world', rarity: 'rare', max: 1, pair: ['phys', 'emp'],
      name: '저지(沮止)', emoji: '🧲', desc: '물리+전자 — 처치 시 반경 80 안 적을 슬로우 건다', eff: {} },
    { key: 'wd_fire_cold', axis: 'world', rarity: 'rare', max: 1, pair: ['fire', 'cold'],
      name: '빙염(氷炎)', emoji: '🌡️', desc: '화+빙 — 화상과 슬로우가 겹친 적에게 피해 +15%', eff: {} },
    { key: 'wd_fire_chi', axis: 'world', rarity: 'legendary', max: 1, pair: ['fire', 'chi'],
      name: '폭기(爆氣)', emoji: '💫', desc: '화+기 — 치명타가 반경 80 안 적에게 화상을 퍼뜨린다 · 무예 위력 +8%',
      eff: { skillPct: 8 } },
    { key: 'wd_cold_lit', axis: 'world', rarity: 'legendary', max: 1, pair: ['cold', 'lit'],
      name: '뇌빙(雷氷)', emoji: '🌩️', desc: '빙+뇌 — 슬로우된 적을 치면 반드시 치명타 · 무예 위력 +8%',
      eff: { skillPct: 8 } }
  ];

  function boonByKey(k) {
    for (var i = 0; i < BOONS.length; i++) { if (BOONS[i].key === k) { return BOONS[i]; } }
    return null;
  }

  /** 방마다 놓이는 항아리 수 — 원작에서 부술 것이 방마다 널려 있다 */
  var JARS = { min: 2, max: 5 };

  /** 방 종류 — 층마다 이 비율로 섞인다 */
  var ROOMS = [
    { key: 'fight',    weight: 46 },
    { key: 'trove',    weight: 12 },   // 보물방 — 상자 하나
    { key: 'well',     weight: 10 },   // 우물방 — 체력 회복
    { key: 'shrine',   weight: 16 },   // 사당방 — 은사 하나를 바로 준다
    /* POI(PLAN 11절) — 처음 둘. 잡졸·보물·우물·사당만 있던 문 목록에
       "가 볼 만한 곳" 을 늘린다. 판정은 기존 elite·boss 갈래를 그대로
       재사용한다(정예·보스 자체는 이미 다양화가 끝났다 — 새 규칙이 아니라
       새 자리다) */
    { key: 'elite',    weight: 10 },   // 정예 소굴 — 반드시 정예 하나를 낀다
    { key: 'miniboss', weight: 6 },    // 미니보스 — 부하 없이 혼자, 보스급 노획
    { key: 'cave',     weight: 8 },    // 채광방(POI: Cave) — 광맥을 캐면 세공 재료
    { key: 'merchant', weight: 7 },    // 행상(POI: Merchant) — 이 자리에서만 파는 재고 셋
    { key: 'puzzle',   weight: 6 },    // 퍼즐방(POI: Puzzle) — 제단 셋을 맞는 순서로 밟는다
    { key: 'event',    weight: 7 },    // 이벤트방(POI: Event, PLAN 35절 "NPC Rescue") — 잡혀 있는 이를 구한다
    { key: 'forage',   weight: 8 }     // 채집·낚시방(POI: Forage, PLAN 12절, 2026-08-30 추가) — 약초 셋 + 못 하나
  ];

  /** 부적(符籍) 변형자(§5.3) — 나이트메어 던전에 얹힌다. 값은 dungeon.js
   *  각 훅 자리(strike·resistOf·엔진 loop 등)가 `mods` 배열에 키가 있는지로
   *  읽는다 — 여기는 이름·설명뿐이고 수치 자체는 이 판 규칙대로 dungeon.js
   *  쪽에 있다(은사(BOONS)가 eff 를 들고, dungeon.js 가 읽기만 하는 것과는
   *  반대 결이다 — 변형자 수치는 전투 코드 곳곳에 걸쳐 있어 한 곳에 모으는
   *  이득이 없었다). */
  var MODS = [
    { key: 'speed',   name: '광란(狂亂)',       emoji: '💨', desc: '적 이동속도 +30%' },
    { key: 'resist',  name: '수호(守護)',       emoji: '🛡️', desc: '적이 지정한 원소 결에 저항 +40%' },
    { key: 'elite2x', name: '군단(軍團)',       emoji: '👥', desc: '정예가 두 배 자주 나온다' },
    { key: 'loot',    name: '풍요(豊饒)',       emoji: '💰', desc: '노획물 +50%' },
    { key: 'timer',   name: '촉박(促迫)',       emoji: '⏱️', desc: '방마다 75초 안에 끝내야 한다' },
    { key: 'jar',     name: '매복(埋伏)',       emoji: '🏺', desc: '항아리를 깨면 적이 튀어나올 수 있다' },
    { key: 'dark',    name: '암흑(暗黑)',       emoji: '🌑', desc: '시야가 좁아진다' },
    { key: 'regen',   name: '재생(再生)',       emoji: '💚', desc: '적 체력이 초당 1% 아문다' },
    { key: 'glass',   name: '유리대포(琉璃大砲)', emoji: '💎', desc: '주고받는 피해가 50%씩 는다' }
  ];
  var MOD_ELEMS = ['fire', 'cold', 'lit', 'pois', 'emp'];

  function modByKey(k) {
    for (var i = 0; i < MODS.length; i++) { if (MODS[i].key === k) { return MODS[i]; } }
    return null;
  }

  /** 부적 id 로 변형자 2~3개를 결정적으로 뽑는다(PLAN §5.3 "core.hash2(부적
   *  id) 로 결정적" — 같은 부적을 두 번 굴려도 같은 결과가 나와야 한다).
   *  'resist' 가 뽑히면 지정할 원소도 같이 결정적으로 고른다. */
  function rollMods(sigilId) {
    var core = global.DG.core;
    var n = core.hash2(sigilId, 90) < 0.5 ? 2 : 3;
    var chosen = [], guard = 0;
    while (chosen.length < n && guard < 30) {
      var k = MODS[Math.floor(core.hash2(sigilId, 91 + chosen.length + guard) * MODS.length)].key;
      guard++;
      if (chosen.indexOf(k) < 0) { chosen.push(k); }
    }
    var resistElem = chosen.indexOf('resist') >= 0
      ? MOD_ELEMS[Math.floor(core.hash2(sigilId, 95) * MOD_ELEMS.length)] : null;
    return { mods: chosen, resistElem: resistElem };
  }

  global.DG = global.DG || {};
  global.DG.dungeonData = {
    THEMES: THEMES, BOONS: BOONS, ROOMS: ROOMS, JARS: JARS, MODS: MODS,
    themeOf: themeOf, boonByKey: boonByKey, modByKey: modByKey, rollMods: rollMods,
    /** 층당 방 수 · 보스 주기 */
    roomsFor: function (floor) { return 4 + Math.min(5, Math.floor(floor / 3)); },
    isBossFloor: function (floor) { return floor % 3 === 0; },
    FIXED: FIXED, FIXED_PAT: FIXED_PAT, fixedOf: fixedOf
  };
})(window);
