/**
 * 2나락 마을 — 세 시대 손님·지워진 이름의 비석 (R-4, 2026-10-11 `town.js` 에서 떼어 냄)
 * ---------------------------------------------------------------
 * 표(ERA_FOLK·NAME_STONE_NAMES)와 자리 셈·비석 보상. 자리 셈은 town.js 의 MARKS·placePoints 를 인자로 받는다
 * (맵 편집기가 town.js 에서 읽는 그 둘은 안 옮겼다). town.js 는 같은 이름으로 받아 둔다. `town.js` 보다 **먼저** 실린다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  /**
   * 세 시대 마을 손님(PLAN §5.20 · SAGA-DESIGN §13, 2026-09-25) — 마을마다 한 명, 볼일(시트) 없이 말만 한다.
   * NPC_DEFS 에 안 넣는다(일곱 직군 표·몸짓 진단 그대로). 누가 서는지는 마을 id 해시(현대 둘·미래 둘 중 하나),
   * 자리는 방을 지을 때 기존 NPC·소품·표식·스폰에서 ERA_FOLK_GAP 이상 떨어진 빈자리(`placePoints`) — 못 찾으면
   * 그 마을은 손님 없이 넘어간다(억지로 겹치지 않는다). model 은 asset3d `folk:*`(제 몸·제 옷). 역할 이름뿐이라 실명 없음
   */
  var ERA_FOLK = {
    courier: { name: '택배 기사', emoji: '📦', era: 'modern', model: 'folk:courier', color: '#6a7a4a', lines: [
      '받는 분이 갑옷 차림이던데… 서명은 붓으로 하시더라고요.',
      '굴혈 쪽 주소는 지도에 안 나와서 늘 헤매요.',
      '들판에 폭주 청년들이 수레를 막아요. 가시는 길에 좀 혼내 주세요.',
      '야장 어르신이 제 수레 바퀴를 공짜로 벼려 주셨어요.' ],
      story: [
        '제가 처음 배달한 짐은 주소 없는 상자였어요. 받는 사람을 못 찾아 사흘을 헤맸죠.',
        '결국 상자를 열어 봤는데 안에는 "누군가에게 전해질 마음"이라 적힌 쪽지 한 장뿐이더라고요.',
        '그 쪽지를 들고 다니다 이 시대까지 왔어요. 신기하게 여기선 받을 사람이 자꾸 나타나요.',
        '어제 마을 사관님께 쪽지를 보여 드렸더니 "내 기록에도 없는 글씨네" 하셨어요. 주소가 생겼네요!' ] },
    officeworker: { name: '출장 온 회사원', emoji: '💼', era: 'modern', model: 'folk:officeworker', color: '#3a3a4a', lines: [
      '회의가 저 굴혈 밑에서 잡혔다는데, 농담이겠죠?',
      '여기 비단값이면 본사에서 칭찬받겠어요.',
      '방역복 입은 사람들이 개펄 쪽을 뒤지고 다녀요. 뭘 찾는 걸까요.',
      '신호가 한 칸도 안 잡혀요. 봉화라도 올려야 하나.' ],
      story: [
        '저는 원래 본사 지시서만 따라 움직이는 사람이었어요. 출장도 지시서대로 왔죠.',
        '그런데 도착하니 지시서에 없는 일이 하나도 안 멈추는 거예요. 굴혈에서 사람 이름이 지워지는 일 같은.',
        '지시서를 접어 넣고 처음으로 제 판단으로 한 일이 지워진 이름 하나를 적어 두는 거였어요.',
        '오늘 사관님이 그 이름을 기록에 올려 주셨어요. 보고서로 쓰면 한 줄일 일인데 이렇게 마음이 무겁네요.' ] },
    timetraveler: { name: '시간 여행자', emoji: '⌛', era: 'future', model: 'folk:timetraveler', color: '#5a8aa8', lines: [
      '제가 온 해에는 이 마을이 유리 탑 숲이었어요.',
      '경비 보행기가 제 뒤를 따라 넘어왔나 봐요. 미안해요.',
      '여기 무예는 우리 시대 기록에도 전설로 남아 있어요.',
      '지옥 균열은… 우리 때까지도 안 닫혀요. 조심하세요.' ],
      story: [
        '제 귀환 일정은 원래 사흘이었어요. 이 시대를 관찰하고 돌아가는 일이었죠.',
        '그런데 관찰이란 게 이상해요. 제가 보면 보는 대로 이 마을이 조금씩 바뀌더라고요.',
        '그래서 일정을 미뤘어요. 바뀌는 걸 끝까지 보고 싶어서요. 우리 시대 기록에 이 마을은 없거든요.',
        '어제 굴혈 이름 없는 비석 앞에서 한참 서 있었어요. 우리 시대에도 그 자리에 비석이 있어요. 이름이 없는 채로요.' ] },
    explorer: { name: '탐사 대원', emoji: '🧑‍🚀', era: 'future', model: 'folk:explorer', color: '#c9c9d0', lines: [
      '과거 신호가 겹쳐 잡히는 좌표예요. 흥미롭네요.',
      '정찰 드론이 길을 잃었어요. 보이면 떨어뜨려 주세요.',
      '강철 거신은 옛 전장 쇳물로 만든 거래요. 무섭죠?',
      '이 시대 햇빛은 약해서 충전이 더뎌요.' ] }
  };
  var ERA_FOLK_KEYS = ['courier', 'timetraveler', 'officeworker', 'explorer'];   // 현대·미래가 번갈아 오게
  var ERA_FOLK_GAP = 100;
  function ERA_FOLK_ON() { return !core.tuned || core.tuned('dg.eraFolk', 1) ? true : false; }
  function eraFolkKeyOf(id) {
    var h = 2166136261, i, s = String(id || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ERA_FOLK_KEYS[(h >>> 0) % ERA_FOLK_KEYS.length];
  }
  /** 이 마을 손님이 설 자리(BASE 좌표) — 없으면 null. 결정적(마을 id 해시 소금) */
  function eraFolkSpot(cfg, MARKS, placePoints) {
    var avoid = [{ x: 195, y: 240 }], i, salt = 70001;
    for (i = 0; i < cfg.npcs.length; i++) { avoid.push({ x: cfg.npcs[i].x, y: cfg.npcs[i].y }); }
    for (i = 0; i < (cfg.decor || []).length; i++) { if (typeof cfg.decor[i].x === 'number') { avoid.push({ x: cfg.decor[i].x, y: cfg.decor[i].y }); } }
    if (cfg.hasGate) { for (i = 0; i < MARKS.length; i++) { if (typeof MARKS[i].x === 'number') { avoid.push({ x: MARKS[i].x, y: MARKS[i].y }); } } }
    for (i = 0; i < String(cfg.id).length; i++) { salt += String(cfg.id).charCodeAt(i) * (i + 7); }
    var pts = placePoints(1, ERA_FOLK_GAP, avoid, salt);
    return pts.length ? pts[0] : null;
  }

  /**
   * 지워진 이름의 비석(정본 side_names_*) — 마을마다 하나, 밟으면 굴혈이 삼킨 이름 하나가 보이고 사관 묵향의 기록에 적힌다(마을마다 한 번 금·업적).
   * 이름은 가상 음절 조합(실명 없음)이고 마을 id 해시로 정해 늘 같다. 자리는 손님·NPC·소품·표식에서 떨어진 빈자리(`placePoints`).
   */
  var NAME_STONE_NAMES = ['서하', '온유', '도윤', '해담', '가람', '이든', '나루', '다솜', '보리', '새롬', '아람', '우솔', '초록', '한결', '여울', '슬기', '미르', '별찬', '소담', '푸름', '하늬', '려온', '지안', '단비'];
  var NAME_STONE_GOLD = 600, NAME_STONE_FEAT = 8;
  function nameStoneNameOf(id) {
    var h = 5381, i, s = String(id || '');
    for (i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
    return NAME_STONE_NAMES[h % NAME_STONE_NAMES.length];
  }
  function nameStoneSpot(cfg, MARKS, placePoints) {
    var avoid = [{ x: 195, y: 240 }], i, salt = 90011, ef = ERA_FOLK_ON() ? eraFolkSpot(cfg, MARKS, placePoints) : null;
    if (ef) { avoid.push({ x: ef.x, y: ef.y }); }
    for (i = 0; i < cfg.npcs.length; i++) { avoid.push({ x: cfg.npcs[i].x, y: cfg.npcs[i].y }); }
    for (i = 0; i < (cfg.decor || []).length; i++) { if (typeof cfg.decor[i].x === 'number') { avoid.push({ x: cfg.decor[i].x, y: cfg.decor[i].y }); } }
    if (cfg.hasGate) { for (i = 0; i < MARKS.length; i++) { if (typeof MARKS[i].x === 'number') { avoid.push({ x: MARKS[i].x, y: MARKS[i].y }); } } }
    for (i = 0; i < String(cfg.id).length; i++) { salt += String(cfg.id).charCodeAt(i) * (i + 11); }
    var pts = placePoints(1, ERA_FOLK_GAP, avoid, salt);
    return pts.length ? pts[0] : null;
  }
  /** 비석을 밟았다 — 마을마다 한 번 기록·보상. 다시 밟으면 이미 적어 둔 이름만 보인다. `ui.js` 가 `town:mark`(nameStone)에서 부른다 */
  function rewardNameStone(mark) {
    var sv = core.save, id = mark.townId, nm = nameStoneNameOf(id);
    if (!sv.nameStones || typeof sv.nameStones !== 'object') { sv.nameStones = {}; }
    if (sv.nameStones[id]) { core.emit('toast', mark.emoji + ' 비석에 새겨진 이름 — ' + nm + ' (이미 기록해 두었다)'); return false; }
    sv.nameStones[id] = nm;
    sv.player.gold = (sv.player.gold || 0) + NAME_STONE_GOLD;
    core.gainFeat(NAME_STONE_FEAT, '지워진 이름');
    core.log(mark.emoji + ' 지워진 이름 "' + nm + '" — 묵향의 기록에 적었다 · 금 +' + core.fmt(NAME_STONE_GOLD), 'good');
    core.emit('toast', mark.emoji + ' 지워진 이름을 찾았다 — ' + nm + ' · 🪙 +' + core.fmt(NAME_STONE_GOLD) + ' (' + Object.keys(sv.nameStones).length + '번째)');
    core.emit('changed'); core.persist();
    return true;
  }

  global.DG = global.DG || {};
  global.DG.townFolk = {
    ERA_FOLK: ERA_FOLK, ERA_FOLK_KEYS: ERA_FOLK_KEYS, ERA_FOLK_GAP: ERA_FOLK_GAP, ERA_FOLK_ON: ERA_FOLK_ON, eraFolkKeyOf: eraFolkKeyOf, eraFolkSpot: eraFolkSpot,
    NAME_STONE_NAMES: NAME_STONE_NAMES, NAME_STONE_GOLD: NAME_STONE_GOLD, NAME_STONE_FEAT: NAME_STONE_FEAT, nameStoneNameOf: nameStoneNameOf, nameStoneSpot: nameStoneSpot,
    rewardNameStone: rewardNameStone
  };
})(window);
