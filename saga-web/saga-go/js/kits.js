/**
 * 고유·갈래 스킬 표 — 인물마다 원소 스킬(E)·원소 해방(Q)이 다르다 (PLAN §5 ⑲-11, saga-godot PLAN 106 ㉔㉖)
 * ---------------------------------------------------------------
 *   고유 다섯(SIGS)   나 · 현책 · 해장 · 결사 · 노궁 — 그 갈래의 "대표"라 갈래보다 한 단 위
 *   갈래(FAMILIES)   도감 trait 가 틀 — 무용 돌격/검기 · 통솔 호령/군기 · 인덕 방패/맹세
 *   원소(EXTRA)      갈래 스킬에 이름 앞말과 덧붙는 것 하나 — 같은 틀이라도 원소마다 쓰임이 갈린다
 *   지략·도감 밖     null → field-combat 의 ⑫ 모양(id 해시)과 해방 기본 그대로
 * 원소 자체는 field-combat `elementOf`(id 해시) 가 정한다. 표만 든 순수 모듈 — 쓰는 곳은 field-combat.js
 * `kitSkill`·`kitBurst`. 세이브 없음. 수치는 이 판 척도(기본 스킬 ×2.2·해방 ×4.5·기력 60)로 새로 잡았다.
 */
(function (global) {
  'use strict';

  /*
   * 스킬 type: dash(앞으로 돌진하며 지나간 길) · shells(앞 적 몇 자리에 늦게 떨어지는 탄) ·
   *   guard(둘레를 치고 명단 보호막) · zone(발밑 진 — 인물을 바꿔도 남아 몇 초마다 가까운 적을 친다) ·
   *   gust(앞 부채꼴·밀어냄) · wave(앞으로 길·앞으로 밀어냄, 나는 제자리) — ⑲-17 · updraft(둘레 적을 끌어 치고 나는 솟구쳐 날개) — ⑲-43
   * 해방 type(모두 먼저 둘레 r 에 mul 한 번): infuse(그 인물 기본·강·낙하 공격에 원소 부여) · rally(명단 공격 곱) ·
   *   ward(명단이 받는 피해 곱) · haste(명단 스킬 대기가 두 배로 돌고 다른 인물 기력) · vortex(앞 지점에 적을 빨아들이는 소용돌이) ·
   *   feast(바람 자리 — 안에 선 지금 인물 회복·안의 적) · rain(명단 기본·강·낙하 공격 뒤 물 노가 따라 친다) — ⑲-17
   */
  var SIGS = {
    _me: {
      skill: { name: '불꽃 돌진', type: 'dash', cd: 6, len: 5.5, w: 2, mul: 3.0, text: '앞으로 5.5m 돌진하며 지나간 길의 적을 벤다(돌진 중 무적)' },
      burst: { name: '불새 깃', type: 'infuse', r: 6, mul: 3.8, sec: 8, nmul: 1.2, text: '둘레 6m 를 태우고, 8초 동안 기본·강·낙하 공격에 원소가 실린다(피해 ×1.2)' }
    },
    sg_zhugeliang: {
      skill: { name: '팔괘진', type: 'zone', cd: 12, r: 4.5, sec: 10, every: 1.5, n: 2, mul: 1.0, energy: 1.2,
        text: '발밑에 10초 진 — 1.5초마다 안의 가까운 적 둘을 치고, 맞힐 때마다 명단 기력 +1.2. 인물을 바꿔도 남는다' },
      burst: { name: '천기 뇌우', type: 'haste', r: 7, mul: 3.0, sec: 12, energy: 9, text: '둘레 7m 를 치고, 12초 동안 명단 원소 스킬 대기가 두 배로 돌며 다른 인물 기력 +9' }
    },
    kr_yisunsin: {
      skill: { name: '일제 포격', type: 'shells', cd: 7, reach: 12, n: 3, delay: 0.6, r: 2.5, mul: 2.4, text: '12m 안 적 셋 자리에 0.6초 뒤 포탄(둘레 2.5m) — 적이 없으면 앞 8m 에 하나' },
      burst: { name: '학날개 진', type: 'rally', r: 8, mul: 3.4, sec: 10, atk: 1.2, text: '둘레 8m 를 쏘고, 10초 동안 명단 공격 +20%' }
    },
    kr_gyebaek: {
      skill: { name: '결사 방진', type: 'guard', cd: 12, r: 3.5, mul: 1.9, shield: 0.25, sec: 12, text: '둘레 3.5m 를 치고, 명단에 보호막(지금 인물 최대 체력 25%, 12초)' },
      burst: { name: '오천의 맹세', type: 'ward', r: 7, mul: 3.0, sec: 10, taken: 0.7, text: '둘레 7m 를 치고, 10초 동안 명단이 받는 피해 -30%' }
    },
    sg_huangzhong: {
      skill: { name: '화살비', type: 'shells', cd: 8, reach: 14, n: 4, delay: 0.5, r: 1.8, mul: 1.9, text: '14m 안 적 넷 자리에 0.5초 뒤 화살비(둘레 1.8m) — 적이 없으면 앞 8m 에 하나' },
      burst: { name: '돌개 화살', type: 'vortex', r: 5, mul: 2.4, ahead: 7, sec: 8, every: 0.5, tick: 0.5, pull: 5, text: '둘레 5m 를 쏘고, 앞 7m 에 8초 소용돌이 — 적을 빨아들이며 0.5초마다 친다' }
    },
    /* ⑲-15 이야기 동료(story.js MEMBERS) — saga-godot 106 ㉛ 을 이 판 척도로 */
    story_scholar: {
      skill: { name: '비문 탁본', type: 'zone', cd: 10, r: 4.5, sec: 9, every: 1.5, n: 4, mul: 0.7, energy: 1.5,
        text: '발밑에 9초 탁본 — 1.5초마다 안의 적 넷까지 초 원소로 치고, 맞힐 때마다 명단 기력 +1.5. 인물을 바꿔도 남는다' },
      burst: { name: '옛 글자 풀이', type: 'lore', r: 7.5, mul: 2.8, sec: 12, rmul: 1.4, text: '둘레 7.5m 를 치고, 12초 동안 명단 원소 반응 피해 ×1.4' }
    },
    story_wanderer: {
      skill: { name: '그림자 걸음', type: 'blink', cd: 8, reach: 10, back: 1.5, r: 2.5, mul: 3.2, mark: 8, markMul: 1.25, len: 4,
        text: '10m 안 가까운 적을 지나 그 뒤 1.5m 로 돌진(무적) — 도착 둘레 2.5m 를 베고, 그 적에 8초 표식(누구에게든 받는 피해 ×1.25)' },
      burst: { name: '가면 벗기', type: 'echo', r: 6, mul: 3.4, reach: 15, n: 3, every: 0.3, emul: 1.5,
        text: '둘레 6m 를 베고, 15m 안 표식 난 적마다 0.3초 간격 메아리 셋(적을 따라감) — 표식 난 적이 없으면 가까운 둘' }
    },
    /* ⑲-17 치유·협동 공격 — saga-godot 106 ㉟ 을 이 판 척도로 */
    story_elder: {
      skill: { name: '부채 바람', type: 'gust', cd: 8, r: 6, arc: 0.2, mul: 2.3, knock: 7, heal: 0.06,
        text: '앞 6m 부채꼴을 풍 원소로 치고 7m 밀어내며, 명단 모두 체력 6% 회복' },
      burst: { name: '잔칫날 순풍', type: 'feast', r: 6, mul: 2.5, sec: 10, every: 1, fheal: 0.05, emul: 0.5,
        text: '둘레 6m 를 치고, 10초 바람 자리 — 1초마다 안에 선 지금 인물 체력 5% 회복·안의 적을 풍 원소로 친다' }
    },
    story_ferryman: {
      skill: { name: '노 물결', type: 'wave', cd: 9, len: 9, w: 2, mul: 2.9, knock: 6,
        text: '앞으로 9m·폭 2m 물결 — 길 위의 적을 수 원소로 치고 앞으로 6m 밀어낸다(나는 제자리)' },
      burst: { name: '뱃노래', type: 'rain', r: 5, mul: 2.3, sec: 15, reach: 8, n: 2, gap: 1, rmul: 0.85,
        text: '둘레 5m 를 치고, 15초 동안 명단 누구든 기본·강·낙하 공격이 맞으면 1초에 한 번 8m 안 가까운 적 둘에 물 노(수 원소)' }
    },
    /* ⑲-20 해솔(9장 끝 합류) — saga-godot 106 ㊳ 을 이 판 척도로. 있는 틀(shells·infuse)만 쓴다 */
    story_haesol: {
      skill: { name: '먹구름 벼락', type: 'shells', cd: 8, reach: 12, n: 3, delay: 0.5, r: 2.4, mul: 2.3,
        text: '12m 안 적 셋 자리에 0.5초 뒤 벼락(둘레 2.4m, 뇌 원소) — 적이 없으면 앞 8m 에 하나' },
      burst: { name: '가면 없는 노래', type: 'infuse', r: 6.5, mul: 3.6, sec: 10, nmul: 1.2,
        text: '둘레 6.5m 를 치고, 10초 동안 기본·강·낙하 공격에 뇌 원소가 실린다(피해 ×1.2)' }
    },
    /* ⑲-30 하람(12장 끝 합류) — saga-godot 106 ㊺-4 를 이 판 척도로. 있는 틀(zone·rally)만 쓴다 */
    story_haram: {
      skill: { name: '휴대 관측기', type: 'zone', cd: 11, r: 5, sec: 10, every: 1.2, n: 2, mul: 0.8, energy: 1.5,
        text: '발밑에 10초 관측기 — 1.2초마다 5m 안 가까운 적 둘에 신호탄(화 원소, 맞힐 때마다 명단 기력 +1.5). 인물을 바꿔도 남는다' },
      burst: { name: '맑음 예보', type: 'rally', r: 7, mul: 3.2, sec: 12, atk: 1.25, text: '둘레 7m 에 신호탄 비, 12초 동안 명단 공격 +25%' }
    },
    /* ⑲-36 달음(15장 끝 합류) — saga-godot 106 ㊼-3 을 이 판 척도로. 있는 틀(dash·ward)만 쓴다 */
    story_dareum: {
      skill: { name: '파발 질주', type: 'dash', cd: 7, len: 6, w: 2.2, mul: 2.8, text: '말 달리듯 앞으로 6m 돌진 — 지나간 길의 적을 암 원소로 친다(돌진 중 무적)' },
      burst: { name: '마패 호령', type: 'ward', r: 7, mul: 3.6, sec: 10, taken: 0.75, text: '둘레 7m 에 바위를 내리찍고, 10초 동안 명단이 받는 피해 -25%' }
    },
    /* ⑲-40 도담(18장 끝 합류) — saga-godot 106 ㊽-4 를 이 판 척도로(노 물결·천기 뇌우 비율). 있는 틀(wave·haste)만 쓴다 */
    story_dodam: {
      skill: { name: '선로 전류', type: 'wave', cd: 8, len: 10, w: 2.2, mul: 2.9, knock: 4,
        text: '앞으로 10m·폭 2.2m 곧게 선로 전류 — 길 위의 적을 뇌 원소로 치고 앞으로 4m 밀어낸다(나는 제자리)' },
      burst: { name: '막차 출발 신호', type: 'haste', r: 7, mul: 3.4, sec: 10, energy: 7, text: '둘레 7m 에 기적과 번개, 10초 동안 명단 원소 스킬 대기가 두 배로 돌며 다른 인물 기력 +7' }
    },
    /* ⑲-43 한별(20장 끝 합류) — saga-godot 106 ㊾-3 을 이 판 척도로. 견인줄은 새 틀 updraft(솟구침은 키보드 판 땅 위만), 해방은 있는 vortex */
    story_hanbyeol: {
      skill: { name: '별배 견인줄', type: 'updraft', cd: 9, r: 4.5, mul: 2.6, pull: 6, lift: 15,
        text: '둘레 4.5m 적을 견인줄로 끌어당겨 풍 원소로 치고, 나는 15m 위로 솟구쳐 날개를 편다 — 그대로 활공하거나 낙하 공격' },
      burst: { name: '틈 닫기', type: 'vortex', r: 6, mul: 3.6, ahead: 8, sec: 8, every: 0.5, tick: 0.7, pull: 7,
        text: '둘레 6m 를 치고, 앞 8m 에 8초 틈 닫기 소용돌이 — 적을 빨아들이며 0.5초마다 풍 원소로 친다' }
    },
    /* ⑲-47 물새(23장 끝 합류) — saga-godot 106 ㊿-4 를 이 판 척도로. 있는 틀(blink·feast)만 쓴다 */
    story_mulsae: {
      skill: { name: '자맥질', type: 'blink', cd: 7, reach: 9, back: 1.4, r: 2.5, mul: 2.8, mark: 8, markMul: 1.2, len: 4,
        text: '9m 안 가까운 적 뒤 1.4m 로 물질하듯 파고들어(무적) 둘레 2.5m 를 빗창으로 벤다 — 그 적에 8초 표식(누구에게든 받는 피해 ×1.2)' },
      burst: { name: '숨비소리', type: 'feast', r: 6, mul: 2.4, sec: 10, every: 1, fheal: 0.05, emul: 0.3,
        text: '둘레 6m 를 치고, 10초 숨비소리 자리 — 1초마다 안에 선 지금 인물 체력 5% 회복·안의 적을 수 원소로 친다' }
    },
    /* ⑲-60 초롱(32장 끝 합류) — saga-godot 106 53-4 를 이 판 척도로. 있는 틀(zone·rain)만 쓴다 */
    story_chorong: {
      skill: { name: '태엽 괘종', type: 'zone', cd: 10, r: 5, sec: 10, every: 1, n: 2, mul: 0.8, energy: 1.5,
        text: '발밑에 10초 괘종시계 — 1초마다 5m 안 가까운 적 둘에 호박 초침(암 원소, 맞힐 때마다 명단 기력 +1.5). 인물을 바꿔도 남는다' },
      burst: { name: '되감은 시간', type: 'rain', r: 5, mul: 2.2, sec: 12, reach: 8, n: 2, gap: 1, rmul: 0.85,
        text: '둘레 5m 를 치고, 12초 동안 명단 누구든 기본·강·낙하 공격이 맞으면 1초에 한 번 8m 안 가까운 적 둘에 되감긴 초침(암 원소)' }
    },
    /* ⑲-51 하늬(26장 끝 합류) — saga-godot 106 51-4 를 이 판 척도로. 있는 틀(shells·lore)만 쓴다 */
    story_haneul: {
      skill: { name: '얼음 관측 풍선', type: 'shells', cd: 8, reach: 12, n: 3, delay: 0.6, r: 2.5, mul: 2.2,
        text: '12m 안 적 셋 자리에 0.6초 뒤 얼음 관측 풍선이 터진다(둘레 2.5m, 빙 원소) — 적이 없으면 앞 8m 에 하나' },
      burst: { name: '한파 예보', type: 'lore', r: 7, mul: 2.6, sec: 12, rmul: 1.35, text: '둘레 7m 에 찬바람을 몰아치고, 12초 동안 명단 원소 반응 피해 ×1.35' }
    }
  };

  /* 갈래 — 고유보다 한 단 낮게. text 의 {el} 자리에 원소 이름 */
  var FAMILIES = {
    might: {
      label: '무용',
      skill: { noun: '돌격', type: 'dash', cd: 7, len: 5, w: 1.8, mul: 2.6, text: '앞으로 5m 돌진하며 지나간 길의 적을 {el} 원소로 벤다(돌진 중 무적)' },
      burst: { noun: '검기', type: 'infuse', r: 6, mul: 3.6, sec: 8, nmul: 1.15, text: '둘레 6m 를 치고, 8초 동안 기본·강·낙하 공격이 {el} 원소(피해 ×1.15)' }
    },
    command: {
      label: '통솔',
      skill: { noun: '호령', type: 'shells', cd: 8, reach: 10, n: 2, delay: 0.6, r: 2.2, mul: 2.2, text: '10m 안 적 둘 자리에 0.6초 뒤 {el} 원소 탄(둘레 2.2m) — 적이 없으면 앞 8m 에 하나' },
      burst: { noun: '군기', type: 'rally', r: 7, mul: 3.0, sec: 10, atk: 1.15, text: '둘레 7m 를 {el} 원소로 치고, 10초 동안 명단 공격 +15%' }
    },
    virtue: {
      label: '인덕',
      skill: { noun: '방패', type: 'guard', cd: 12, r: 3, mul: 1.6, shield: 0.2, sec: 12, text: '둘레 3m 를 {el} 원소로 치고, 명단에 보호막(지금 인물 최대 체력 20%, 12초)' },
      burst: { noun: '맹세', type: 'ward', r: 6.5, mul: 2.8, sec: 10, taken: 0.8, text: '둘레 6.5m 를 {el} 원소로 치고, 10초 동안 명단이 받는 피해 -20%' }
    }
  };

  /*
   * 원소가 갈래 스킬에 붙이는 것 — heal 명단 회복(최대 체력 비율) · team 다른 인물 기력 · cdAdd 스킬 대기 더하기 ·
   * smul 스킬 피해 곱 · bmul 해방 피해 곱 · secAdd 해방 효과 시간 · shield 보호막(방패 틀이면 그 보호막에 더하고, 아니면 새로)
   */
  var EXTRA = {
    fire:  { word: '불꽃', burst: { bmul: 1.15 }, noteB: '해방 피해 ×1.15' },
    water: { word: '물결', skill: { heal: 0.04 }, burst: { heal: 0.08 }, noteS: '명단 체력 4% 회복', noteB: '명단 체력 8% 회복' },
    elec:  { word: '번개', skill: { team: 2 }, burst: { team: 6 }, noteS: '다른 인물 기력 +2', noteB: '다른 인물 기력 +6' },
    wind:  { word: '바람', skill: { cdAdd: -1.5 }, noteS: '대기 1.5초 짧음' },
    ice:   { word: '서리', skill: { smul: 1.15 }, noteS: '스킬 피해 ×1.15' },
    rock:  { word: '바위', skill: { shield: 0.12 }, noteS: '보호막 +12%' },
    grass: { word: '덩굴', burst: { secAdd: 3 }, noteB: '해방 효과 3초 더' }
  };
  var EL_NAME = { fire: '화', water: '수', elec: '뇌', wind: '풍', ice: '빙', rock: '암', grass: '초' };

  function copy(o) { var r = {}, k; for (k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { r[k] = o[k]; } } return r; }

  /** 갈래 × 원소 → 스킬·해방 한 벌. **순수 함수** */
  function familyKit(trait, el) {
    var F = FAMILIES[trait], X = EXTRA[el] || { word: '' };
    if (!F) { return null; }
    var s = copy(F.skill), b = copy(F.burst), xs = X.skill || {}, xb = X.burst || {}, en = EL_NAME[el] || '';
    s.name = X.word + ' ' + F.skill.noun; b.name = X.word + ' ' + F.burst.noun;
    s.text = F.skill.text.replace('{el}', en) + (X.noteS ? ' · ' + X.noteS : '');
    b.text = F.burst.text.replace('{el}', en) + (X.noteB ? ' · ' + X.noteB : '');
    if (xs.cdAdd) { s.cd += xs.cdAdd; }
    if (xs.smul) { s.mul *= xs.smul; }
    if (xs.heal) { s.heal = xs.heal; }
    if (xs.team) { s.team = xs.team; }
    if (xs.shield) { s.shieldAdd = xs.shield; }
    if (xb.bmul) { b.mul *= xb.bmul; }
    if (xb.heal) { b.heal = xb.heal; }
    if (xb.team) { b.team = xb.team; }
    if (xb.secAdd) { b.sec += xb.secAdd; }
    return { family: trait, label: F.label, sig: false, skill: s, burst: b };
  }

  /**
   * 인물 → 스킬 한 벌 { family, label, sig, skill, burst } 또는 null(지략·도감 밖 — ⑫ 모양 그대로).
   * trait 를 안 주면 도감(`DG.data.find`)에서 읽는다. **순수 함수**(표·도감만 읽는다)
   */
  function kitOf(id, el, trait) {
    if (SIGS[id]) {
      var g = SIGS[id];
      return { family: 'sig', label: '고유', sig: true, skill: copy(g.skill), burst: copy(g.burst) };
    }
    if (trait === undefined) {
      var D = global.DG.data, h = D && D.find ? D.find(id) : null;
      trait = h ? h.trait : null;
    }
    return trait ? familyKit(trait, el) : null;
  }
  /** 인물 상세에 붙이는 갈래 이름 — 고유·무용·통솔·인덕, 아니면 지략(도감 밖은 '') */
  function labelOf(id, el) {
    var k = kitOf(id, el);
    if (k) { return k.label; }
    var D = global.DG.data;
    return D && D.find && D.find(id) ? '지략' : '';
  }

  global.DG = global.DG || {};
  global.DG.kits = {
    SIGS: SIGS, FAMILIES: FAMILIES, EXTRA: EXTRA,
    familyKit: familyKit, kitOf: kitOf, labelOf: labelOf
  };
})(window);
