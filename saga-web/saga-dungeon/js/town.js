/**
 * 마을(村) — 판이 시작하고, 돌아오는 자리
 * ---------------------------------------------------------------
 * 예전 첫 화면은 카드 한 장이었다. 층을 버튼으로 고르고 난도를 버튼으로 골랐다.
 * 그런데 원작에서 바깥은 **메뉴가 아니라 장소**다 — 야영지를 걸어
 * 다니며 대장장이에게 가고, 역참 돌을 밟고, 굴혈로 걸어 들어간다.
 * 고르는 것이 아니라 **가는 것**이다. 그 차이가 이 게임의 결을 정한다.
 *
 * 그래서 마을을 던전과 **같은 공간**으로 만들었다. 그림·조작·조명·조작판은
 * 전부 dungeon-view.js 것을 그대로 쓴다 — 이 파일이 하는 일은 dungeon.js 와
 * **같은 모양의 상태**를 내놓는 것뿐이다(raw · status · fx · setInput ·
 * moveTo · update). 화면은 자기가 마을을 그리는지 던전을 그리는지 몰라도 된다.
 *
 * 여기에 판정은 없다. 적도 피해도 없다 — 마을에서 하는 일은 걷는 것과 닿는 것뿐이다.
 *
 * ── 오버월드(PLAN 28-1절, 2026-09-02 구현) ──────────────────────────
 * 마을은 이제 **넷**이다 — 모루골(중심) · 갈대나루(동, 나루터) · 자작재(북, 산길) ·
 * 소금벌(남, 염전). 던전 굴혈은 모루골에만 있다(원작에서도 야영지가 하나다).
 * 마을 사이는 "들길" 표식(들판 출구, `exit_<대상마을id>`)으로 잇는다 — 이미
 * 검증된 마을 필드전투 확장(`dungeon.js`의 fieldBoundPlayer 등)을 그대로 써서
 * 방 밖 들판을 충분히 걸어야 닿는 자리에 둔다. 별(★)형 연결이다 — 위성 마을
 * 셋은 서로 안 이어지고 모루골로만 통한다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* 던전 방과 **같은 크기**였다(560×380). 처음에는 720×460 으로 넓게 잡았는데,
     폰에서 그만큼 작게 그려졌다 — 아이소메트릭 마름모의 가로세로 비는 1.83:1 로
     고정이라(IX/IY), 폰 세로 화면에서는 늘 **가로가 병목**이다. 방이 넓어지면
     그 병목에 맞춰 축소되어 사람이 개미만 해진다. 그래서 던전과 같은 스케일로
     줄이고, 대신 사람을 3×3 으로 촘촘히 앉혔었다.
     (390px 실측: 이 크기에서 마름모 가로가 화면의 1.2배 — 거의 한눈에 들어온다)

     **2026-08-30 — 데스크톱에서만 다시 키운다.** 폰의 그 병목은 화면이 좁아서
     생기는 문제지 방 크기 자체의 문제가 아니다 — `dungeon-view.js`(2D)의
     `fit`도 `dungeon3d.js`(3D)의 `camAim` 거리도 **화면·방 크기에 맞춰 저절로
     다시 잡힌다**(둘 다 순수하게 W·H·화면 크기의 함수다). 그래서 화면이 넉넉히
     넓은(가로가 세로보다 크고 900px 이상인) 곳에서만 기준 크기의 1.4배로 켠다 —
     폰 세로 화면은 `BASE_W`·`BASE_H` 그대로다. NPC·표식·장식은 전부 `BASE_W`·
     `BASE_H` 기준 좌표로 적어 두고 `scalePt` 로 실제 방 크기에 맞춰 늘린다 —
     그래야 두 크기에서 배치 비율이 그대로 유지된다. */
  var BASE_W = 560, BASE_H = 380, WALL = 30, P_R = 13;
  function wideDesktop() {
    try { return global.innerWidth >= 900 && global.innerWidth > global.innerHeight; }
    catch (e) { return false; }
  }
  /* 2026-09-06 — 사용자가 "마을이 너무 작다"고 지적. `BASE_W`/`BASE_H` 자체를
     키우면 바로 위 주석의 폰 병목(아이소 마름모 1.83:1, 세로 화면에서 가로가
     늘 병목)이 그대로 재현돼 사람이 개미만 해진다 — 그건 안 건드린다. 대신
     이 상수(데스크톱 전용 배율)만 1.4→1.7로 올려 데스크톱에서만 더 넓게
     쓴다. 폰은 예전과 완전히 같다(회귀 없음). 건물 밀도는 DECOR_MORU와
     위성 마을 decor에 집을 하나씩 더 얹는 쪽으로 늘렸다(아래) — 좌표
     자체는 그대로 두고 배율만 커지므로 밀도 문제와는 서로 안 얽힌다.

     **PLAN §28-8 Phase 4(2026-09-06, 이어지는 세션) — 한 단계 더 올린다.**
     1.7→2.0. 세계 앵커 간격(`ANCHOR_DIST=4800`)과 안 겹치는지부터 다시
     쟀다 — 마을 발판 최대치(`ROOM_W`=BASE_W×2.0=1120)에 필드 반경 최대치
     (`fieldRadiusUnits()`, HIGH 등급 6×CHUNK(200)=1200)를 양쪽으로 다
     더해도 1120+1200×2=3520으로, 4800에서 1280 여유가 남는다(§28-8 Phase 1이
     1.7 기준으로 재 둔 "넉넉잡아 3400" 여유가 아직 더 있었다). 밀도는
     `placePoints()`를 재사용해 아래(hand 마을 supplemental decor, 절차
     생성 마을 decor 4종)에서 같이 올렸다 — 이 상수는 물리적 치수만 맡는다. */
  var DESK_SCALE = 2.0;
  var wide = wideDesktop();
  var ROOM_W = wide ? Math.round(BASE_W * DESK_SCALE) : BASE_W;
  var ROOM_H = wide ? Math.round(BASE_H * DESK_SCALE) : BASE_H;
  var SX = ROOM_W / BASE_W, SY = ROOM_H / BASE_H;
  function scalePt(x, y) { return { x: x * SX, y: y * SY }; }
  /* 2026-09-07 — 사용자 실기기 제보("NPC들이 너무 붙어있다"). 손으로 지은
     넷(모루골 등)의 NPC 좌표는 BASE_W×BASE_H(560×380) 기준으로 손수 골라
     둔 값이라, 폰(`wide`가 거짓 — scalePt가 1배)에서는 예전 그대로의
     간격(100~170)으로 좁게 남는다(데스크톱은 최대 2배로 벌어져 있어
     문제가 덜 드러났다). 좌표를 다시 손으로 재지 않고, 방 중심에서
     바깥쪽으로 배율만큼 밀어내 간격을 넓힌다 — 상대 배치(누가 왼쪽·
     오른쪽인지)는 그대로 유지되고, 벽 여유(`WALL+P_R+20`, `placePoints()`
     와 같은 여백)를 넘지 않게 잘라 담·소품과 새로 겹치지 않게 한다. */
  var HAND_NPC_SPREAD = 1.28;
  var HAND_NPC_DECOR_CLEAR = 55;   // 소품과 이만큼은 떨어져야 한다(집 문간에 서지 않게)
  /* `_test.html`의 "한 자리에서 둘이 동시에 걸리지 않는다"가 NPC·표식 전부를
     TALK_R*2(=80, BASE 단위 — SX=SY라 배율에 안 흔들린다) 문턱으로 잰다.
     그 문턱과 같은 값(여유를 살짝 얹어 82)으로 표식도 같이 피한다 — 안
     그러면 중심에서 밀어낸 NPC가 마침 그 방향에 있던 표식(예: 결사비) 쪽으로
     더 다가서 버린다(2026-09-07, 자가진단으로 실제로 걸림). */
  var HAND_NPC_MARK_CLEAR = 82;
  /** @param obstacles [{x,y,clear}] — 배율을 최대까지 올렸을 때 그중 하나와도
   *  너무 가까워지면, 부딪히지 않는 선까지 배율을 도로 낮춘다. 원래 좌표
   *  (배율 1)는 손으로 이미 거리를 재 둔 값이라(위 NPC_DEFS 자리 주석들)
   *  항상 안전한 하한이다. */
  function handTownNpcSpread(x, y, obstacles) {
    var cx = BASE_W / 2, cy = BASE_H / 2;
    var lo = WALL + P_R + 20, hiX = BASE_W - lo, hiY = BASE_H - lo;
    var f, nx, ny, i, ok;
    for (f = HAND_NPC_SPREAD; f > 1.0; f -= 0.04) {
      nx = Math.max(lo, Math.min(hiX, cx + (x - cx) * f));
      ny = Math.max(lo, Math.min(hiY, cy + (y - cy) * f));
      ok = true;
      for (i = 0; obstacles && i < obstacles.length; i++) {
        if (Math.hypot(nx - obstacles[i].x, ny - obstacles[i].y) < obstacles[i].clear) { ok = false; break; }
      }
      if (ok) { return { x: nx, y: ny }; }
    }
    return { x: x, y: y };
  }
  function handTownNpcObstacles(cfg) {
    var out = [], i;
    for (i = 0; i < cfg.decor.length; i++) { out.push({ x: cfg.decor[i].x, y: cfg.decor[i].y, clear: HAND_NPC_DECOR_CLEAR }); }
    if (cfg.hasGate) {
      for (i = 0; i < MARKS.length; i++) {
        if (MARKS[i].key === 'gate') { continue; }   // 굴혈은 이 방에 안 선다(위 exits 주석)
        out.push({ x: MARKS[i].x, y: MARKS[i].y, clear: HAND_NPC_MARK_CLEAR });
      }
    }
    return out;
  }
  var SPD = 158;                        // 마을 걸음 (던전보다 조금 빠르다 — 볼일만 보는 곳이라)
  var RSCALE = (SX + SY) / 2;           // 닿는 판정 반경도 방 크기를 따라간다
  var TALK_R = 40 * RSCALE;             // 이만큼 다가서면 말이 걸린다
  var LEAVE_R = 58 * RSCALE;            // 이만큼 떨어져야 다시 걸린다 (문턱 — 아래 armed 설명)

  /**
   * 마을 사람 정의 — 이름·그림·닿았을 때 여는 시트는 **직군 하나마다 하나뿐**이다
   * (여러 마을이 같은 직군을 나눠 들 수 있게). 어느 마을에 서 있는지는 아래
   * TOWNS[id].npcs 가 좌표로 정한다.
   *   sheet   닿으면 열리는 시트 (ui.js 의 그것과 같은 이름)
   *   trait   생김새를 정한다 (sprite.js 의 ruleLook 이 읽는다)
   *   color   옷 빛깔 — 진영색을 쓰지 않는다. 마을 사람은 어느 진영도 아니다
   */
  var NPC_DEFS = {
    captain: { name: '군교(軍校)', emoji: '⚔️', sheet: 'party',
      color: '#8a6f4e', trait: 'might',  rarity: 3,
      line: '부대를 세우십시오. 앞에 설 자를 고르는 일이 먼저입니다.' },
    quarter: { name: '치중(輜重)', emoji: '🎒', sheet: 'gear',
      color: '#6b7383', trait: 'virtue', rarity: 2,
      line: '주워 오신 것을 봐 드리지요. 걸치실 것과 파실 것을 가릅니다.' },
    master:  { name: '교두(敎頭)', emoji: '📜', sheet: 'skill',
      color: '#5c6b8a', trait: 'wisdom', rarity: 4,
      line: '손에 든 것이 무예를 정합니다. 각궁을 들면 궁장의 길입니다.' },
    smith:   { name: '야장(冶匠)', emoji: '🔨', sheet: 'craft',
      color: '#7a4a32', trait: 'might',  rarity: 3,
      line: '구멍 뚫린 물건을 가져오시오. 박아 드리리다.' },
    pedlar:  { name: '행상(行商)', emoji: '🧺', sheet: 'vendor',
      color: '#6f5a8a', trait: 'virtue', rarity: 2,
      line: '한 회차마다 물건이 바뀝니다. 오늘 것을 보시겠소?' },
    scribe:  { name: '사관(史官)', emoji: '📖', sheet: 'dex',
      color: '#4e6b5a', trait: 'wisdom', rarity: 3,
      line: '이 판에서 만난 인물을 적어 두었습니다.' },
    /* 2026-09-06 — 사용자 요청("콘텐츠가 많아야 함")으로 일곱째 직군을 얹었다.
       현상판(퀘스트 시트)을 맡아 볼 자리가 마을에 없었다 — 여태 독(dock)
       단추로만 열렸다. 새 시트·새 대사 체계 없이 기존 'quest' 시트만
       연결한다(sheet 값이 곧 openSheet() 인자라 이 한 줄로 끝난다). */
    herald:  { name: '포교(捕校)', emoji: '🪧', sheet: 'quest',
      color: '#8a4a3a', trait: 'might', rarity: 2,
      line: '오늘 새로 붙은 방문(榜文)이 있소이다. 살펴보시겠소?' }
  };

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
  function eraFolkSpot(cfg) {
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
  function nameStoneSpot(cfg) {
    var avoid = [{ x: 195, y: 240 }], i, salt = 90011, ef = ERA_FOLK_ON() ? eraFolkSpot(cfg) : null;
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

  /**
   * 표식 셋 — 사람이 아니라 **밟는 것**이다. 모루골에만 있다(원작에도 야영지가
   * 하나뿐이라 굴혈·역참·결사비도 하나씩이다).
   *   gate      굴혈 입구. 밟으면 제1층부터 (원작의 던전 입구 — 고르는 창이 없다)
   *   waypoint  역참 돌. 밟으면 밟아 둔 층 목록이 뜬다 (원작의 웨이포인트가 정확히 이것)
   *   vow       결사비. 되돌릴 수 없는 것이라 확인을 한 번 받는다
   */
  var MARKS = [
    /* 굴혈은 **가운데 아래**다 — 화면 앞쪽이라 손이 가장 먼저 닿는 자리고,
       원작에서도 야영지의 출구가 그쯤이다 */
    { key: 'gate',     name: '굴혈(窟穴)', emoji: '🕳️', x: 280, y: 300 },
    /* 소용돌이다. 예전에 돌(🪨)을 썼다가 **흰 사각형**으로 떴다 —
       U+1FAA8 은 글꼴에 없는 기기가 아직 흔하다. 원작의 웨이포인트가
       파란 소용돌이 포탈이므로 이쪽이 그림으로도 맞다. */
    { key: 'waypoint', name: '역참(驛站)', emoji: '🌀', x: 280, y: 180 },
    { key: 'vow',      name: '결사비(決死碑)', emoji: '☠️', x: 110, y: 310 },
    /* 난입(亂入, §5.5, 2026-09-18) — 결사비 옆에 세운다(PLAN 원문 자리 그대로).
       vow 에서 95 이상 떨어뜨려 TALK_R(40)*2 안쪽에서 서로 안 겹치게 했다. */
    { key: 'horde',    name: '난입(亂入)', emoji: '⚔️', x: 205, y: 335 }
  ];

  /* 모루골 장식 — 매번 같아야 한다. 집이 매번 옮겨 다니면 그건 마을이 아니다.
     그래서 던전처럼 굴리지 않고 **박아 둔다**. */
  var DECOR_MORU = [
    { t: 'torch',  x: 120, y: WALL - 4, seed: 0.4 },
    { t: 'torch',  x: 290, y: WALL - 4, seed: 2.1 },
    { t: 'torch',  x: 460, y: WALL - 4, seed: 4.3 },
    { t: 'torch',  x: WALL - 4, y: 130, seed: 1.2 },
    { t: 'torch',  x: WALL - 4, y: 280, seed: 5.0 },
    /* 모닥불 하나 — 벽 횃불과 같은 그림(drawTorch)이지만 **바닥 한복판**에 둔다.
       불이 없으면 사람만 아홉 서 있는 빈 마당으로 보인다. 원작 야영지의 그 불이다.
       사람이 앉은 3×3 격자의 **빈 칸**에만 놓을 수 있다 — 아홉 자리가 다 찼으니
       빈 칸은 넷뿐이고, 그중 하나는 **서는 자리**(195,240)라 비워 둔다.
       둘을 놓았다가 불이 내 머리 위에서 타올랐다. */
    { t: 'torch',  x: 370, y: 145, seed: 3.1 },
    { t: 'pillar', x: 370, y: 255 },
    { t: 'pillar', x: 190, y: 130 },
    { t: 'crack',  x: 330, y: 210, a: 0.6, len: 36 },
    { t: 'crack',  x: 230, y: 150, a: 2.2, len: 26 },
    /* 집 셋 · 우물 · 대장간 — 3D로 세울 때(`dungeon3d.js` `TOWN3D`) 빈 돌방이
       아니라 진짜 마을로 보이게 한다. */
    { t: 'house', x: 60, y: 60, h: 130, seed: 11 },
    { t: 'house', x: 500, y: 60, h: 130, seed: 23 },
    { t: 'house', x: 55, y: 235, h: 120, seed: 37 },
    /* 2026-09-06 — "마을이 너무 작다"(사용자) 콘텐츠 밀도 보강. 기존 소품·
       NPC·스폰(195,240)에서 전부 100 이상 떨어진 자리를 좌표로 확인하고
       얹었다(벨타워가 스폰에 너무 가까웠던 함정, 위 주석 참고 — 같은
       실수를 안 반복하려 거리부터 쟀다). */
    { t: 'house', x: 430, y: 150, h: 130, seed: 41 },
    { t: 'well', x: 280, y: 250, h: 34 },
    { t: 'blacksmith', x: 520, y: 235, h: 140 },
    /* 2026-09-04 — SAGA WEB.md "E. 건물"의 "탑". 모루골(중심 마을)에만
       하나 세운다 — 위성 마을은 각자 여관·마방·방앗간으로 이미 갈렸다.
       **밟은 함정**: 처음엔 (190,300)에 뒀는데, 스폰 자리(195,240, 위
       player 정의부 주석 참고)에서 겨우 60 떨어져 있었다 — 탑 높이(209)에
       비해 너무 가까워, 시작하자마자 카메라가 탑 벽에 거의 박혀 화면
       전체가 돌벽으로 뒤덮이는 것으로 보였다(스크린샷으로 재현·확인함).
       스폰에서 258 떨어지고 다른 장식과도 87 이상 떨어진 자리로 옮겼다. */
    { t: 'belltower', x: 373, y: 53, h: 110 }
  ];

  /** 세계 앵커(PLAN §28-8, 2026-09-06 — 오픈월드 A안) — 마을 4개가 이제
   *  "위장 전환"(§28-2~§28-4의 corridor 시스템, 은퇴)이 아니라 **하나의
   *  연속된 좌표계**에 실제로 앉는다. 각 마을의 로컬 원점(0,0)이 서 있는
   *  세계 좌표가 여기 값이다 — field3d.CHUNK(200) 배수로 잡아 칸 경계와
   *  안 어긋나게 한다. 간격(칸 경계 정렬을 위해 CHUNK 배수를 유지하는
   *  한 아래에서 더 키울 수 있다)은 어느 마을의 발판+필드 반경을 다
   *  합쳐도(넉넉잡아 3400 안팎, ROOM_W/H 최대치 + R*2) 겹치지 않을 만큼
   *  넉넉해야 한다 — 겹치면 두 마을이 동시에 "활성"으로 판정될 수 있다.
   *  moru 를 원점으로 두고 나머지는 exits 의 방향 그대로 배치한다.
   *
   *  2026-09-07 — "맵 배치가 이상해, 자연스럽지가 않아"(사용자, 실제로
   *  `DG.town.overworld.list()`를 찍어 13×13 격자를 그려 보니 완전한
   *  바둑판이었다 — 사가고가 이미 겪은 "맵이 바둑판처럼 지저분함"과 같은
   *  증상). 4800→6400으로 늘려 자리마다 여유(발판+반경 최대치의 2배인
   *  4640과의 차)를 1760으로 넉넉히 벌리고, 그 여유 안에서(아래
   *  `TOWN_JITTER`, 최대 600 — 최악의 경우 서로 마주 보고 반대로 흔들려도
   *  6400-2×600=5200 > 4640으로 안전 마진 560이 남는다) 절차 생성 마을마다
   *  결정적 해시로 살짝 흔들어 둔다(generateTowns() 참고) — 격자 위에
   *  있다는 사실 자체는 안 바뀌지만(자가진단의 "세계 앵커... 안 겹친다"가
   *  격자 정렬을 전제하지는 않으므로 문제없다), 직선으로 안 늘어서 보인다.
   *  손으로 지은 넷(모루골 등)은 특별한 자리라 이번에도 격자 원점에 그대로
   *  둔다(안 흔든다) — 흔들리는 100개와 대비돼 "여긴 다르다"는 신호도 된다. */
  var ANCHOR_DIST = 6400;
  /** 절차 생성 마을 앵커를 흔드는 최대 반경(위 안전 마진 계산 참고). */
  var TOWN_JITTER = 600;
  var WORLD_ANCHOR = {
    moru: { x: 0, y: 0 },
    jajak: { x: 0, y: -ANCHOR_DIST },
    galdae: { x: ANCHOR_DIST, y: 0 },
    sogeum: { x: 0, y: ANCHOR_DIST }
  };
  function anchorOf(id) { return WORLD_ANCHOR[id] || WORLD_ANCHOR.moru; }
  /** 마을 발판 한복판의 세계 좌표 — 안전지대·길(road) 양쪽이 "마을의 대표 점"으로 쓴다. */
  function townCenter(id) {
    var a = anchorOf(id);
    return { x: a.x + ROOM_W * 0.5, y: a.y + ROOM_H * 0.5 };
  }
  var ROAD_SEGMENTS = [];   // connectAndRoadTowns()가 채운다 — field3d.kindOf()가 읽는다(길 강제)

  /**
   * 마을 넷 — id·이름·색감(테마)·거기 사는 직군·장식·들길(exits) 을 정의한다.
   * 좌표는 전부 BASE_W·BASE_H 기준(scalePt 로 실제 방 크기에 맞춘다).
   *   exits[].dir   그 마을 안에서 이 들길이 나가는 방향(N/E/S/W) — exitPoint 가 읽는다
   *   exits[].to    들길 끝에 닿는 마을 id
   * 위성 마을(갈대나루·자작재·소금벌)은 모루골로만 통한다(별형 연결) —
   * 서로 안 잇는다. 상점 배치는 모루골의 여섯 직군 중 셋만 간추렸다.
   */
  var TOWNS = {
    moru: {
      id: 'moru', name: '모루골', dirFromHub: null,
      theme: { name: '모루골', floor: '#3b322a', wall: '#5c4e3d',
        tint: 'rgba(210,170,100,0.10)', town: true },
      hasGate: true,
      npcs: [
        { key: 'captain', x: 110, y: 90 },  { key: 'quarter', x: 280, y: 70 },
        { key: 'master',  x: 450, y: 95 },
        /* 2026-09-07 — "NPC 위치도 원작 스타일로"(사용자). 야장(대장장이)은
           대장간(blacksmith, 520,235) 옆에, 행상은 우물(280,250) 옆(원작
           원작 첫 마을의 행상·짐마차가 광장 우물가에 서는 것과 같은 자리)에
           서게 옮겼다 — 소품과 55 이상, 다른 NPC·표식과도 거리를 손으로
           재서 골랐다(handTownNpcObstacles의 최소 간격 그대로 지킨다). */
        { key: 'smith',   x: 470, y: 210 },
        { key: 'pedlar',  x: 340, y: 250 }, { key: 'scribe',  x: 110, y: 200 },
        /* 2026-09-06 — 좌표는 손으로 계산해 골랐다(가장 가까운 기존 자리에서도
           88 이상 — 이 방은 이미 아홉 자리가 찬 3×3 이라 100을 다 채우진
           못했지만, NPC는 벨타워 같은 큰 3D 구조물이 아니라 사람 하나라
           §28-4 이전의 "화면이 온통 돌벽" 함정과는 성격이 다르다).
           2026-09-18 — §5.5(난입) 표식 'horde'(205,335)가 결사비(vow) 옆에
           들어오며 이 자리(200,300)와 겨우 35 떨어져 실제로 겹쳤다(자가진단
           "한 자리에서 둘이 동시에 걸리지 않는다"가 그 자리에서 잡았다).
           horde는 PLAN 원문이 못박은 "결사비 옆" 자리라 옮기지 않고, 이쪽을
           위로(y 300→235) 밀어 아홉 자리 전부와 다시 95 이상 벌렸다. */
        { key: 'herald', x: 200, y: 235 }
      ],
      decor: DECOR_MORU,
      /* 'W' 방면 — PLAN §28-4 Phase 1(던전도 "걸어서 이어지게"). 굴혈(gate)
         입구를 마을방 안 고정 표식에서 이 들길로 옮긴다. to:'dungeon'은
         다른 마을 id가 아니라 던전 입구라는 신호 — build()의 exits 루프와
         ui.js의 town:mark 라우팅이 이 값을 특별히 다룬다. */
      exits: [ { dir: 'N', to: 'jajak' }, { dir: 'E', to: 'galdae' },
               { dir: 'S', to: 'sogeum' }, { dir: 'W', to: 'dungeon' } ]
    },
    galdae: {
      id: 'galdae', name: '갈대나루', dirFromHub: 'E',
      theme: { name: '갈대나루', floor: '#28383c', wall: '#3d5458',
        tint: 'rgba(120,190,205,0.12)', town: true },
      hasGate: false,
      npcs: [ { key: 'quarter', x: 170, y: 150 }, { key: 'pedlar', x: 390, y: 150 },
              { key: 'scribe',  x: 280, y: 280 },
              /* 2026-09-06 — 위성 마을 셋에도 현상판 직군을 더했다(가장 가까운
                 기존 자리에서도 100 이상 떨어진 좌표를 계산해 골랐다). */
              { key: 'herald',  x: 100, y: 225 } ],
      decor: [
        { t: 'torch', x: 120, y: WALL - 4, seed: 0.7 }, { t: 'torch', x: 440, y: WALL - 4, seed: 3.2 },
        { t: 'pillar', x: 280, y: 90 }, { t: 'crack', x: 200, y: 230, a: 1.1, len: 30 },
        /* 2026-09-04 — SAGA WEB.md 감사(PLAN 11절 "맵의 밀도"). NPC 셋만 서 있는
           빈 돌방이던 위성 마을 셋에 집·우물을 더한다(모루골과 같은 GLB, 씨앗은
           자리 좌표로 저절로 갈린다 — `dungeon3d.js` house/well 렌더 참고) */
        { t: 'house', x: 60, y: 60, h: 130 },
        /* 이어서(2026-09-04) — 셋 다 집+우물뿐이라 테마가 안 살아서, 나루터답게
           나그네 쉼터(여관)를 하나씩 다르게 얹었다(자작재=마방, 소금벌=방앗간) */
        { t: 'inn', x: 500, y: 60, h: 130 },
        { t: 'well', x: 280, y: 330, h: 34 },
        /* 2026-09-06 — "마을이 너무 작다"(사용자). 위성 마을도 집 하나씩
           더 — NPC·기존 소품과 100 이상 떨어진 자리로 골랐다. */
        { t: 'house', x: 420, y: 250, h: 120, seed: 51 }
      ],
      /* 2026-09-06 — PLAN §28-3 Phase 1(갈대나루↔자작재) + 후속(갈대나루↔소금벌).
         위성↔위성 지름길(모루골을 안 거치고 옆 사분면으로 바로 감), 대칭 왕복.
         자작재-소금벌(N-S)은 설계안이 "모루골을 그대로 관통해 새 통로 의미가
         없다"고 뺀 조합이라 여전히 안 잇는다. */
      exits: [ { dir: 'W', to: 'moru' },
               { dir: 'N', to: 'jajak' },
               { dir: 'S', to: 'sogeum' } ]
    },
    jajak: {
      id: 'jajak', name: '자작재', dirFromHub: 'N',
      theme: { name: '자작재', floor: '#333c2c', wall: '#4a5940',
        tint: 'rgba(150,185,110,0.10)', town: true },
      hasGate: false,
      npcs: [ { key: 'captain', x: 170, y: 150 }, { key: 'smith', x: 390, y: 150 },
              { key: 'master',  x: 280, y: 280 },
              { key: 'herald',  x: 280, y: 140 } ],
      decor: [
        { t: 'torch', x: 120, y: WALL - 4, seed: 1.4 }, { t: 'torch', x: 440, y: WALL - 4, seed: 4.6 },
        { t: 'pillar', x: 200, y: 210 }, { t: 'pillar', x: 360, y: 210 },
        { t: 'house', x: 60, y: 60, h: 130 }, { t: 'stable', x: 500, y: 60, h: 130 },
        { t: 'well', x: 280, y: 330, h: 34 },
        { t: 'house', x: 450, y: 300, h: 120, seed: 52 }
      ],
      exits: [ { dir: 'S', to: 'moru' },
               { dir: 'E', to: 'galdae' } ]
    },
    sogeum: {
      id: 'sogeum', name: '소금벌', dirFromHub: 'S',
      theme: { name: '소금벌', floor: '#4a4636', wall: '#6b6550',
        tint: 'rgba(230,220,180,0.12)', town: true },
      hasGate: false,
      npcs: [ { key: 'pedlar', x: 170, y: 150 }, { key: 'quarter', x: 390, y: 150 },
              { key: 'captain', x: 280, y: 280 },
              { key: 'herald',  x: 180, y: 255 } ],
      decor: [
        { t: 'torch', x: 120, y: WALL - 4, seed: 2.3 }, { t: 'torch', x: 440, y: WALL - 4, seed: 5.8 },
        { t: 'crack', x: 220, y: 120, a: 0.4, len: 40 }, { t: 'pillar', x: 340, y: 230 },
        { t: 'house', x: 60, y: 60, h: 130 }, { t: 'mill', x: 500, y: 60, h: 130 },
        { t: 'well', x: 280, y: 330, h: 34 },
        { t: 'house', x: 420, y: 300, h: 120, seed: 53 }
      ],
      /* 2026-09-06 — PLAN §28-3 후속(갈대나루↔소금벌, galdae 쪽과 대칭 왕복). */
      exits: [ { dir: 'N', to: 'moru' },
               { dir: 'E', to: 'galdae' } ]
    }
  };
  var TOWN_ORDER = ['moru', 'galdae', 'jajak', 'sogeum'];

  /**
   * 절차 생성 마을(PLAN §28-8 Phase 3, 2026-09-06) — 손으로 지은 넷에 더해,
   * 격자 위 빈 칸에 마을을 자동으로 앉힌다. **Math.random()을 안 쓴다** —
   * core.hash2(고정 입력...) 순수 해시로만 정해 자가진단의 공유 RNG
   * 수열을 안 건드린다(PLAN이 반복 경고하는 함정). 모듈 로드 시 한 번만
   * 돌고, 그 뒤로는 TOWNS[id]·WORLD_ANCHOR[id]·TOWN_ORDER에 손으로 지은
   * 마을과 완전히 같은 모양으로 섞여 들어간다 — build()·pickActiveTown·
   * 자동지도 등 나머지 코드는 "이게 손으로 지은 건지 절차 생성인지"
   * 전혀 모른다(새 분기 없음).
   *
   * 배치 — ANCHOR_DIST 간격 격자 칸(gx,gz)에 하나씩(이미 쓴 넷은 제외).
   * 격자라 간격이 늘 ANCHOR_DIST 이상이라 겹칠 수 없다("세계 앵커" 자가
   * 진단이 넷+생성분 전부를 다시 잰다). 후보를 결정적으로 뒤섞어 앞에서
   * 부터 GENERATED_TOWN_COUNT개를 쓴다.
   *
   * biome — 2×2 격자 블록 단위로 재서 이웃 마을끼리 성격이 뭉치게 한다
   * ("현실화" 요청, 2026-09-06 — 실제 지도를 베끼는 게 아니라 순수 절차
   * 규칙일 뿐이다). `theme.name`(표시 이름·HUD)과는 별도로 `theme.biome`
   * 에 "town:"+biome을 적어 두고, dungeon.js의 fieldBlockedAt·
   * dungeon3d.js의 buildField/clutterAt이 `biome||name` 순서로 THEME_BIAS
   * 를 찾게 살짝 고쳤다(없으면 예전처럼 name — 손으로 지은 넷은 회귀 없음).
   *
   * 이름 — 뜻말(NAME_DESC) + biome별 지명 접미사(NAME_SUFFIX)를 합친다
   * (예: 산 계열은 "재·령·봉"). 손으로 지은 넷과 안 겹치게 usedNames로 막는다.
   *
   * NPC·decor — `safePoint()`가 하던 "겹치면 밀어낸다"를 `placePoints()`로
   * 일반화했다(최소 간격만 지키는 범용 배치기). 직군은 7개 중 셋(위성
   * 마을과 같은 패턴), decor는 집 하나·우물 하나·횃불 둘(§28-7 밀도 보강
   * 이전 위성 마을과 같은 기본 구성 — 밀도는 Phase 4 몫, PLAN §44).
   */
  /* PLAN §28-8 "다음에 이어받을 것" — 20→100. 후보(GEN_GRID_RADIUS)를 5→6으로
     같이 올렸다 — 5는 (2*5+1)^2-4=117개뿐이라 100개를 뽑으면 남는 여유가
     17개뿐이었다(격자 후보가 부족하면 seededShuffle 뒤 앞에서부터 자르는
     로직이 그냥 못 채우고 조용히 100개 미만으로 멈춘다 — 에러가 안 나서
     알아채기 어렵다).
     2026-09-07 — "맵 배치가 부자연스럽다"(사용자) 후속으로 6→7. 100개를
     그대로 두고 후보 칸만 늘려(칸이 늘어도 뽑는 개수는 그대로라 밀도만
     낮아진다) 채움 비율을 165칸 중 100개(61%)에서 221칸 중 100개(45%)로
     낮춰 "칸마다 거의 다 찼다"는 느낌을 줄인다. 앵커 최대 거리
     (7*ANCHOR_DIST=44800, ANCHOR_DIST도 같은 날 4800→6400으로 올렸다)에
     방 반폭(1120)·흔들림(TOWN_JITTER 600)을 더해도 46520으로
     WORLD_LIMIT(60000)까지 13480 여유가 남는다 — 안전하다. */
  var GENERATED_TOWN_COUNT = 100;
  var GEN_GRID_RADIUS = 7;      // (2r+1)^2-4 후보
  var BIOME_KEYS = ['forest', 'ruins', 'swamp', 'mountain', 'shrine'];
  var NAME_DESC = [
    '달빛', '별빛', '청록', '백로', '흑요', '황금', '적송', '녹수', '심연', '유수',
    '한들', '설원', '풍차', '화전', '수련', '목단', '은강', '옥천', '자류', '비단',
    '안개', '노을', '새벽', '저녁', '구름', '바람', '이슬', '서리', '불꽃', '물결'
  ];
  var NAME_SUFFIX = {
    forest: ['골', '촌', '림'], ruins: ['성', '채', '루'], swamp: ['벌', '포', '늪'],
    mountain: ['재', '령', '봉'], shrine: ['당', '원', '단']
  };
  var BIOME_ROOM_COLOR = {
    forest:   { floor: '#2e3b28', wall: '#44543c', tint: 'rgba(140,190,110,0.10)' },
    ruins:    { floor: '#3a352c', wall: '#564f40', tint: 'rgba(200,180,140,0.10)' },
    swamp:    { floor: '#33362a', wall: '#4c5040', tint: 'rgba(150,170,110,0.10)' },
    mountain: { floor: '#33302e', wall: '#4d4946', tint: 'rgba(180,180,190,0.10)' },
    shrine:   { floor: '#302a3a', wall: '#493f56', tint: 'rgba(180,150,220,0.10)' }
  };
  var GEN_NPC_POOL = ['captain', 'quarter', 'master', 'smith', 'pedlar', 'scribe', 'herald'];

  /** 결정적 뒤섞기 — Fisher-Yates, 난수 자리에 core.hash2(seed)만 쓴다. */
  function seededShuffle(arr, salt) {
    var a = arr.slice(), i, j, tmp;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(core.hash2(salt + i * 31 + 1, salt * 7 + i * 13 + 3) * (i + 1));
      tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  /** 2×2 격자 블록 단위 biome — 이웃 칸끼리 같은 성격으로 뭉친다. */
  function macroBiome(gx, gz) {
    var mx = Math.floor(gx / 2), mz = Math.floor(gz / 2);
    var h = core.hash2(mx * 131 + 7, mz * 131 + 13);
    return BIOME_KEYS[Math.min(BIOME_KEYS.length - 1, Math.floor(h * BIOME_KEYS.length))];
  }
  function genName(biome, usedNames, salt) {
    var suf = NAME_SUFFIX[biome] || NAME_SUFFIX.forest, tries = 0, name, di, si;
    do {
      di = Math.floor(core.hash2(salt * 3 + tries * 17 + 1, salt + 5) * NAME_DESC.length);
      si = Math.floor(core.hash2(salt * 5 + tries * 11 + 2, salt + 9) * suf.length);
      name = NAME_DESC[Math.min(NAME_DESC.length - 1, di)] + suf[Math.min(suf.length - 1, si)];
      tries++;
    } while (usedNames[name] && tries < 50);
    usedNames[name] = true;
    return name;
  }
  /** 최소 간격(minDist)만 지키며 좌표를 결정적으로 뽑는다 — safePoint()의
   *  "겹치면 옆으로 민다"를 일반화한 것. avoid에 미리 피할 점(스폰 자리
   *  등)을 넣어 두면 그것과도 간격을 지킨다.
   *  **반환 좌표는 늘 BASE_W·BASE_H 기준**이다 — cfg.decor/cfg.npcs가 전부
   *  그 기준으로 적혀 있고 build()가 scalePt()로 한 번만 늘린다. Phase 4
   *  (2026-09-06)에서 여기가 ROOM_W·ROOM_H(데스크톱에서 이미 DESK_SCALE이
   *  한 번 곱해진 값)를 썼던 것을 잡았다 — 폰·좁은 창(SX=SY=1)에서는
   *  ROOM_W===BASE_W라 안 드러났지만, 넓은 데스크톱 창에서 절차 생성
   *  마을(gen*)의 NPC·decor가 scalePt()에서 **두 번째로** DESK_SCALE만큼
   *  더 늘어나 방 밖으로 튀어나갔다(실측: 1200×900 창에서 herald가 방
   *  953×646 인데 local (1300, 638)에 섬 — CDP 프로브로 확인).
   *
   *  **반환 길이가 count보다 짧을 수 있다** — Phase 4 후속(2026-09-06,
   *  실기기 제보)에서 잡은 두 번째 버그: 시도가 다 떨어지면(기존엔 40번)
   *  **간격을 못 지킨 좌표를 그냥 그대로 써 왔다.** 모루골처럼 이미 소품·
   *  NPC 20개가 빽빽이 들어찬 방에서 이게 실제로 터졌다 — 추가된 집
   *  (h=130)이 스폰 자리에서 겨우 60(BASE 30) 떨어진 곳에 놓여, 시작하자
   *  마자 카메라가 그 집 벽에 거의 박힌 것으로 보였다(2026-09-04 벨타워
   *  건과 같은 종류 — 그때도 못 지킨 자리를 그냥 썼다면 똑같이 터졌을
   *  것). 이제 시도를 40→200으로 늘리고(더 빽빽해도 어지간하면 찾는다),
   *  그래도 못 찾으면 **그 자리는 건너뛴다**(내놓는 개수가 count보다
   *  적어질 수 있다) — 억지로 겹치는 것보다 하나 덜 놓는 쪽이 안전하다.
   *  호출부(생성 마을 decor·손으로 지은 넷의 밀도 보강) 둘 다 배열
   *  길이가 짧아질 수 있다고 보고 방어적으로 읽는다 — 각 항목에 원래
   *  요청한 순번(`i`)을 같이 내주므로, 중간 순번 하나가 빠져도(건너뛴
   *  자리) 나머지가 밀려서 엉뚱한 종류로 짝지어지는 일이 없다(예: 3번째
   *  요청이 빠지면 배열은 [0,1,3]으로 나오지 결코 [0,1,2]로 밀리지 않는다
   *  — 호출부가 `i`로 어느 종류인지 되짚는다). */
  function placePoints(count, minDist, avoid, salt) {
    var lo = WALL + P_R + 20, hiX = BASE_W - WALL - P_R - 20, hiY = BASE_H - WALL - P_R - 20;
    var pts = avoid.slice(), out = [], i, tries, x, y, ok, j;
    for (i = 0; i < count; i++) {
      tries = 0;
      do {
        x = lo + core.hash2(salt + i * 41 + tries * 3 + 1, salt * 3 + 7) * (hiX - lo);
        y = lo + core.hash2(salt + i * 53 + tries * 5 + 2, salt * 5 + 11) * (hiY - lo);
        ok = true;
        for (j = 0; j < pts.length; j++) {
          if (Math.hypot(x - pts[j].x, y - pts[j].y) < minDist) { ok = false; break; }
        }
        tries++;
      } while (!ok && tries < 200);
      if (!ok) { continue; }   // 200번 다 실패 — 억지로 겹치게 놓지 않고 건너뛴다
      pts.push({ x: x, y: y });
      out.push({ x: x, y: y, i: i });
    }
    return out;
  }

  /** PLAN §28-8 Phase 4(2026-09-06) — 손으로 지은 넷(모루골·갈대나루·자작재·
   *  소금벌)도 밀도를 한 단계 올린다. Phase 3가 만든 placePoints()를 그대로
   *  재사용해, 이미 있는 소품·NPC·스폰(195,240)에서 100 이상 떨어진 자리에
   *  집 하나·기둥 하나를 결정적으로 더 앉힌다 — 좌표를 손으로 다시 재지
   *  않는다. TOWN_ORDER가 아직 이 넷뿐일 때(절차 생성 마을은 아래
   *  generateTowns()가 나중에 덧붙인다) 돈다.
   *
   *  **실기기 제보로 잡은 버그(같은 날 후속)** — `placePoints()`가 간격을
   *  못 지키면 그냥 무시하고 쓰던 시절, 모루골(이미 소품·NPC 20개가 빽빽한
   *  방)에서 새 집이 스폰 자리에서 겨우 60(스케일 적용 전 BASE 30) 떨어진
   *  곳에 놓여 시작하자마자 카메라가 그 집 벽에 거의 박힌 것으로 보였다.
   *  `placePoints()`를 "못 찾으면 건너뛴다"로 고친 지금은 `extra`의 길이가
   *  2보다 짧을 수 있어(마을이 이미 너무 빽빽하면 하나만 놓이거나 아예
   *  안 놓일 수 있다) 인덱스로 바로 안 읽고 있는 만큼만 방어적으로 쓴다 —
   *  집을 못 놓으면 그 마을은 그냥 밀도를 덜 얻고 넘어간다(억지로 겹치는
   *  것보다 훨씬 낫다). */
  var HAND_TOWN_DENSITY_SALT = { moru: 40001, galdae: 40002, jajak: 40003, sogeum: 40004 };
  var HAND_TOWN_DENSITY_TYPE = ['house', 'pillar'];
  (function addHandTownDensity() {
    var i, id, cfg, avoid, k, salt, extra, houseSeed, add, ti;
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      salt = HAND_TOWN_DENSITY_SALT[id];
      if (!salt) { continue; }
      cfg = TOWNS[id];
      avoid = [{ x: 195, y: 240 }];
      for (k = 0; k < cfg.decor.length; k++) { avoid.push({ x: cfg.decor[k].x, y: cfg.decor[k].y }); }
      for (k = 0; k < cfg.npcs.length; k++) { avoid.push({ x: cfg.npcs[k].x, y: cfg.npcs[k].y }); }
      extra = placePoints(HAND_TOWN_DENSITY_TYPE.length, 100, avoid, salt);
      houseSeed = Math.floor(core.hash2(salt + 7, salt + 13) * 1000);
      add = [];
      for (ti = 0; ti < extra.length; ti++) {
        var etype = HAND_TOWN_DENSITY_TYPE[extra[ti].i];   // 원래 요청한 순번으로 종류를 되짚는다(건너뛴 자리가 있어도 안 밀린다)
        if (etype === 'house') {
          add.push({ t: 'house', x: Math.round(extra[ti].x), y: Math.round(extra[ti].y), h: 130, seed: houseSeed });
        } else if (etype === 'pillar') {
          add.push({ t: 'pillar', x: Math.round(extra[ti].x), y: Math.round(extra[ti].y) });
        }
      }
      cfg.decor = cfg.decor.concat(add);
    }
  })();

  (function generateTowns() {
    var usedNames = {}, i;
    for (i = 0; i < TOWN_ORDER.length; i++) { usedNames[TOWNS[TOWN_ORDER[i]].name] = true; }

    var candidates = [], gx, gz;
    for (gz = -GEN_GRID_RADIUS; gz <= GEN_GRID_RADIUS; gz++) {
      for (gx = -GEN_GRID_RADIUS; gx <= GEN_GRID_RADIUS; gx++) {
        if (gx === 0 && gz === 0) { continue; }         // moru
        if (gx === 1 && gz === 0) { continue; }         // galdae
        if (gx === 0 && gz === -1) { continue; }        // jajak
        if (gx === 0 && gz === 1) { continue; }          // sogeum
        candidates.push({ gx: gx, gz: gz });
      }
    }
    candidates = seededShuffle(candidates, 9001);

    var n = Math.min(GENERATED_TOWN_COUNT, candidates.length), idx;
    for (idx = 0; idx < n; idx++) {
      var cell = candidates[idx];
      var id = 'gen' + (idx + 1);
      var salt = 20000 + idx * 97;
      /* 2026-09-07 — 격자 원점 그대로 두면 완전한 바둑판으로 보인다(위
         ANCHOR_DIST 주석 참고). 결정적 해시로 방향·거리를 뽑아 최대
         TOWN_JITTER만큼 흔든다 — 칸을 벗어나는 일은 없다(반경이 칸
         절반보다 훨씬 작다), 그저 격자선 위에 안 놓인다. */
      var jitAng = core.hash2(salt + 71, salt + 73) * Math.PI * 2;
      var jitMag = core.hash2(salt + 79, salt + 83) * TOWN_JITTER;
      var anchor = {
        x: Math.round(cell.gx * ANCHOR_DIST + Math.cos(jitAng) * jitMag),
        y: Math.round(cell.gz * ANCHOR_DIST + Math.sin(jitAng) * jitMag)
      };
      /* 고정 세계 지도(§5.12) — 마을 성격은 그 자리 지역에서 받는다(설산엔 산 마을,
         개펄엔 늪 마을). world-map.js 가 없으면 옛 2×2 블록 규칙 */
      var WMg = global.DG.worldMap;
      var region = WMg ? WMg.regionAt(anchor.x, anchor.y) : null;
      var biome = region ? region.town : macroBiome(cell.gx, cell.gz);
      var name = genName(biome, usedNames, salt);
      var npcKeys = seededShuffle(GEN_NPC_POOL, salt + 3).slice(0, 3);
      /* 2026-09-07 — 사용자 실기기 제보("NPC들이 너무 붙어있다")로 100→150.
         NPC는 셋뿐이라(위 slice(0,3)) 이 방(BASE_W×BASE_H=560×380) 안에서
         150 간격은 여전히 넉넉히 자리를 찾는다. */
      var npcPts = placePoints(npcKeys.length, 150, [{ x: 195, y: 240 }], salt + 11);
      /* placePoints()가 간격을 못 지키면 이제 그 자리를 건너뛴다(위 함수
         주석 참고, 2026-09-06 후속 — 실기기 제보로 잡음: 억지로 겹치게
         놓았다가 스폰 바로 옆에 집이 서는 사고가 났었다) — 그래서 npcPts가
         npcKeys보다 짧을 수 있다. 인덱스로 바로 안 읽고 실제로 나온 점
         개수만큼만 NPC를 세운다(마을이 너무 빽빽하면 NPC가 하나 덜 설
         수 있다 — 겹치는 것보다 훨씬 낫다). */
      var npcs = npcPts.map(function (pt) {
        return { key: npcKeys[pt.i], x: Math.round(pt.x), y: Math.round(pt.y) };
      });
      var decorAvoid = [{ x: 195, y: 240 }].concat(npcPts);
      /* PLAN §28-8 Phase 4(2026-09-06) — 집·우물뿐이던 밀도를 기둥·균열
         둘을 더 얹어 손으로 지은 넷(모루골 등, pillar·crack이 이미 있다)에
         가깝게 맞춘다. 자리만 placePoints()로 늘리고, 씨앗은 기존 것과
         안 겹치는 salt 오프셋(+53·+61·+67 — 위 house/well이 쓰는 +31·+37과
         겹치지 않는 자리)로 결정적으로 뽑는다. */
      var decorPts = placePoints(4, 100, decorAvoid, salt + 23);   // 집·우물·기둥·균열(모자랄 수 있음)
      var houseSeed = Math.floor(core.hash2(salt + 31, salt + 37) * 1000);
      var crackAngle = core.hash2(salt + 53, salt + 59) * Math.PI * 2;
      var crackLen = 24 + core.hash2(salt + 61, salt + 67) * 20;
      var GEN_DECOR_TYPE = ['house', 'well', 'pillar', 'crack'];
      var decor = [
        { t: 'torch', x: 120, y: WALL - 4, seed: core.hash2(salt + 41, 1) * 6 },
        { t: 'torch', x: 440, y: WALL - 4, seed: core.hash2(salt + 43, 2) * 6 }
      ];
      for (var di = 0; di < decorPts.length; di++) {
        var dp = decorPts[di], dx = Math.round(dp.x), dy = Math.round(dp.y), dtype = GEN_DECOR_TYPE[dp.i];
        if (dtype === 'house') { decor.push({ t: 'house', x: dx, y: dy, h: 130, seed: houseSeed }); }
        else if (dtype === 'well') { decor.push({ t: 'well', x: dx, y: dy, h: 34 }); }
        else if (dtype === 'pillar') { decor.push({ t: 'pillar', x: dx, y: dy }); }
        else if (dtype === 'crack') { decor.push({ t: 'crack', x: dx, y: dy, a: crackAngle, len: crackLen }); }
      }
      var rc = BIOME_ROOM_COLOR[biome];
      TOWNS[id] = {
        id: id, name: name, dirFromHub: null,
        theme: { name: name, biome: 'town:' + biome, floor: rc.floor, wall: rc.wall, tint: rc.tint, town: true,
                 region: region ? region.key : null },
        hasGate: false,
        npcs: npcs, decor: decor, exits: []
      };
      WORLD_ANCHOR[id] = anchor;
      TOWN_ORDER.push(id);
    }
  })();

  /* 2026-09-07 — "다른 마을로 가는 길을 연결해줘"(사용자). 손으로 지은 넷
     사이의 exits(§28-2~4 시절 corridor 시스템)는 §28-8에서 이미 "은퇴"했고
     (24행 부근 주석), 지금 exits는 굴혈(exit_dungeon) 표식 말고는 화면에
     아무것도 안 남긴다 — 다른 마을로의 exits는 순전히 데이터일 뿐, 실제로
     밟히는 길은 없었다. 절차 생성 마을(gen*, 100개)은 exits가 아예 빈
     배열이라 연결 개념 자체가 없었다.
     **exits 배열은 안 건드린다** — 자가진단이 "위성 마을의 exits 데이터는
     그대로다(PLAN §28-3)"를 명시적으로 지킨다(갈대나루 3·자작재 2·소금벌 2
     로 못박아 둠). 대신 실제로 밟히는 길은 exits와 완전히 별개인 좌표
     선분(ROAD_SEGMENTS)으로 둔다 — ① 격자에서 실제로 이웃(간격이 정확히
     ANCHOR_DIST)인 마을 쌍을 전부 잇고, ② 손으로 지은 넷의 기존 exits
     (갈대나루↔자작재처럼 격자 이웃이 아닌 대각 쌍도 있다)도 데이터는 안
     바꾼 채 읽기만 해서 같이 잇는다. `field3d.js`의 `kindOf()`가 이 선분
     근처 조각을 'road'(9절에 이미 있는 kind, 새로 안 늘림)로 강제해 실제
     흙길이 생긴다. 마을이 최대 사방 격자로 이어지므로 먼 마을로 가는 길이
     이웃을 갈아타는 여러 갈래로 자연히 갈린다("길이 다양하게", 사용자
     후속 요청). */
  (function buildTownRoads() {
    var cellOf = {}, i, id, ax, az;
    function keyOf(x, z) { return x + ',' + z; }
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      ax = Math.round(WORLD_ANCHOR[id].x / ANCHOR_DIST);
      az = Math.round(WORLD_ANCHOR[id].y / ANCHOR_DIST);
      cellOf[keyOf(ax, az)] = id;
    }
    var segs = [];
    /* E·N 두 방향만 봐도 격자 인접 쌍을 빠짐없이 한 번씩만 줍는다 —
       대칭인 W·S는 그 이웃 쪽에서 자기 E·N을 볼 때 이미 걸린다. */
    var NBRS = [{ dx: 1, dz: 0 }, { dx: 0, dz: -1 }];
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      ax = Math.round(WORLD_ANCHOR[id].x / ANCHOR_DIST);
      az = Math.round(WORLD_ANCHOR[id].y / ANCHOR_DIST);
      var c1 = townCenter(id);
      for (var d = 0; d < NBRS.length; d++) {
        var nbId = cellOf[keyOf(ax + NBRS[d].dx, az + NBRS[d].dz)];
        if (!nbId) { continue; }
        var c2 = townCenter(nbId);
        segs.push({ ax: c1.x, az: c1.y, bx: c2.x, bz: c2.y });
      }
    }
    /* 손으로 지은 넷의 기존 exits(격자 인접이 아닌 대각 쌍 포함, 예:
       갈대나루↔자작재) — 데이터는 읽기만 한다, 안 바꾼다. */
    var seenPair = {};
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      var cfg = TOWNS[id], c3 = townCenter(id);
      for (var e = 0; e < cfg.exits.length; e++) {
        var to = cfg.exits[e].to;
        if (to === 'dungeon' || !TOWNS[to]) { continue; }
        var pairKey = id < to ? (id + '|' + to) : (to + '|' + id);
        if (seenPair[pairKey]) { continue; }
        seenPair[pairKey] = true;
        var c4 = townCenter(to);
        segs.push({ ax: c3.x, az: c3.y, bx: c4.x, bz: c4.y });
      }
    }
    ROAD_SEGMENTS = segs;
  })();

  /* 2026-09-10 — PLAN §60 후보 2 "길 위의 목적지형 콘텐츠". 지금까지 길은
     순수 시각 요소였다(위 buildTownRoads 주석) — 길목에 고정 좌표로 작은
     발견 거리를 심는다("제단·비석·조난자 등, MARKS처럼").
     `core.hash2`(순수 함수, Math.random() 이 아니다)로만 정해서 마을
     배치·장식과 같은 결로 **세계 그 자체의 일부**가 되게 한다 — 다시
     불러도, 다른 플레이어라도 같은 길목에 같은 것이 있다. 선분 길이의
     30~70% 지점에만 둬(ANCHOR_DIST 4800 기준 최소 1440 떨어짐) 양끝
     마을의 TOWN_SAFE_R(1300)과 절대 안 겹친다. 약 45%의 길목에만 둬
     "가끔 있다"는 느낌을 지킨다(전부 있으면 과하다). */
  var ROAD_MARK_KINDS = [
    { key: 'roadAltar', name: '길가 제단', emoji: '⛩️', verb: '빌었다' },
    { key: 'roadTomb', name: '옛 비석', emoji: '🪦', verb: '읽었다' },
    { key: 'roadStranded', name: '지친 나그네', emoji: '🧎', verb: '도왔다' }
  ];
  var ROAD_MARK_GOLD = 14, ROAD_MARK_FEAT = 1;
  var ROAD_MARKS = [];
  (function buildRoadMarks() {
    var out = [], i, s, roll, t, kind;
    for (i = 0; i < ROAD_SEGMENTS.length; i++) {
      s = ROAD_SEGMENTS[i];
      roll = core.hash2(i * 7 + 3, i * 11 + 5);
      if (roll >= 0.45) { continue; }
      t = 0.3 + core.hash2(i * 13 + 1, i * 17 + 9) * 0.4;
      kind = ROAD_MARK_KINDS[Math.floor(core.hash2(i * 19 + 2, i * 23 + 4) * ROAD_MARK_KINDS.length)];
      out.push({
        id: 'road:' + i, kind: kind,
        x: s.ax + (s.bx - s.ax) * t, y: s.az + (s.bz - s.az) * t
      });
    }
    ROAD_MARKS = out;
  })();
  var ROAD_MARK_ACTIVE_R = 500;   // 이 안쪽에 들어와야 room.marks 에 실제로 얹는다(매 틱 전수조사 안 하려고)
  var roadMarkCd = 1;

  /** 플레이어 둘레에 아직 안 밟은 길목 발견거리를 room.marks 에 얹는다.
   *  build() 가 room 을 통째로 새로 지을 때마다(마을이 갈릴 때마다) 비므로
   *  다시 다가서면 다시 얹힌다 — 좌표는 ROAD_MARKS 에 고정이라 매번 같다. */
  function spawnNearbyRoadMarks() {
    if (!room || !room.marks) { return; }
    var done = (core.save.town && core.save.town.roadMarks) || {};
    for (var i = 0; i < ROAD_MARKS.length; i++) {
      var rm = ROAD_MARKS[i];
      if (done[rm.id]) { continue; }
      if (Math.hypot(player.x - rm.x, player.y - rm.y) >= ROAD_MARK_ACTIVE_R) { continue; }
      var already = false, j;
      for (j = 0; j < room.marks.length; j++) { if (room.marks[j].key === rm.id) { already = true; break; } }
      if (already) { continue; }
      room.marks.push({
        key: rm.id, roadMark: true, kindKey: rm.kind.key,
        name: rm.kind.name, emoji: rm.kind.emoji, verb: rm.kind.verb,
        x: rm.x, y: rm.y
      });
    }
  }

  /** 길목 발견거리 하나를 밟았다 — 보상을 주고 자리에서 치운다.
   *  `js/ui.js` 가 `town:mark`(roadMark 표시가 있는 것)에서 부른다. */
  function rewardRoadMark(mark) {
    if (!core.save.town) { core.save.town = {}; }
    if (!core.save.town.roadMarks) { core.save.town.roadMarks = {}; }
    if (core.save.town.roadMarks[mark.key]) { return; }   // 이중 발동 방지
    core.save.town.roadMarks[mark.key] = 1;
    var i = room.marks.indexOf(mark);
    if (i >= 0) { room.marks.splice(i, 1); }
    core.save.player.gold += ROAD_MARK_GOLD;
    core.gainFeat(ROAD_MARK_FEAT, mark.name);
    core.log(mark.emoji + ' ' + mark.name + ' — ' + mark.verb + ' · 금 +' + core.fmt(ROAD_MARK_GOLD), 'good');
    core.emit('toast', mark.emoji + ' ' + mark.name + ' — ' + mark.verb + ' · 🪙 +' + ROAD_MARK_GOLD);
    core.emit('changed');
  }

  /* 2026-09-10 — PLAN §60 후보 4 "필드 수집품". 길가 발견거리(위 ROAD_MARKS)와
     달리 **길에서 벗어나야** 닿는다 — 디아4의 "릴리스 제단"처럼 정해진 자리
     전부를 모으는 도감류 수집이다. 같은 길 선분을 기준점으로 삼되(새 좌표계를
     안 만든다), 선분의 수직 방향으로 180~400 떨어뜨려(길 대역 TOWN_ROAD_BAND=70
     밖) "길 옆 숲·바위 사이"에 둔다. 도감(js/ui.js DEX_COMPLETE)에 새 갈래
     'relics'로 얹는다 — 새 도감 시스템을 만들지 않고 기존 것에 얹는다. */
  var FIELD_RELIC_KINDS = [
    { name: '옛 석표(石標)', emoji: '🗿' },
    { name: '이끼 낀 종', emoji: '🔔' },
    { name: '금 간 청동거울', emoji: '🪞' },
    { name: '녹슨 인장', emoji: '🔏' }
  ];
  var FIELD_RELIC_GOLD = 20, FIELD_RELIC_FEAT = 4;
  var FIELD_RELICS = [];
  (function buildFieldRelics() {
    var out = [], i, s, roll, t, dx, dz, len, bx, by, side, offR, kind;
    for (i = 0; i < ROAD_SEGMENTS.length; i++) {
      s = ROAD_SEGMENTS[i];
      roll = core.hash2(i * 31 + 101, i * 37 + 103);
      if (roll >= 0.3) { continue; }   // 길목 발견거리(45%)보다 더 드물게 — 릴리스 제단처럼 귀해야 한다
      t = 0.3 + core.hash2(i * 41 + 7, i * 43 + 11) * 0.4;
      dx = s.bx - s.ax; dz = s.bz - s.az;
      len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      bx = s.ax + (s.bx - s.ax) * t;
      by = s.az + (s.bz - s.az) * t;
      side = core.hash2(i * 53 + 13, i * 59 + 17) < 0.5 ? -1 : 1;
      offR = 180 + core.hash2(i * 61 + 19, i * 67 + 23) * 220;   // 180~400, 길 대역(70) 밖
      kind = FIELD_RELIC_KINDS[Math.floor(core.hash2(i * 71 + 29, i * 73 + 31) * FIELD_RELIC_KINDS.length)];
      out.push({
        id: 'relic:' + i, kind: kind,
        x: bx + (-dz) * offR * side, y: by + dx * offR * side
      });
    }
    FIELD_RELICS = out;
  })();
  var FIELD_RELIC_ACTIVE_R = 500;
  var relicMarkCd = 1;

  function spawnNearbyFieldRelics() {
    if (!room || !room.marks) { return; }
    var found = (core.save.dex && core.save.dex.relics) || {};
    for (var i = 0; i < FIELD_RELICS.length; i++) {
      var fr = FIELD_RELICS[i];
      if (found[fr.id]) { continue; }
      if (Math.hypot(player.x - fr.x, player.y - fr.y) >= FIELD_RELIC_ACTIVE_R) { continue; }
      var already = false, j;
      for (j = 0; j < room.marks.length; j++) { if (room.marks[j].key === fr.id) { already = true; break; } }
      if (already) { continue; }
      room.marks.push({
        key: fr.id, fieldRelic: true,
        name: fr.kind.name, emoji: fr.kind.emoji,
        x: fr.x, y: fr.y
      });
    }
  }

  /** 필드 유적 하나를 밟았다 — 도감에 등록하고 보상을 준 뒤 자리에서 치운다.
   *  `js/ui.js` 가 `town:mark`(fieldRelic 표시가 있는 것)에서 부른다. */
  function rewardFieldRelic(mark) {
    if (!core.save.dex.relics) { core.save.dex.relics = {}; }
    if (core.save.dex.relics[mark.key]) { return; }   // 이중 발동 방지
    core.save.dex.relics[mark.key] = true;
    var i = room.marks.indexOf(mark);
    if (i >= 0) { room.marks.splice(i, 1); }
    core.save.player.gold += FIELD_RELIC_GOLD;
    core.gainFeat(FIELD_RELIC_FEAT, mark.name);
    core.log(mark.emoji + ' ' + mark.name + ' 발견 · 금 +' + core.fmt(FIELD_RELIC_GOLD), 'good');
    core.emit('toast', mark.emoji + ' 유적 발견 · ' + mark.name);
    core.emit('dex:new', { cat: 'relics', id: mark.key });
    core.emit('changed');
  }

  function dirEmoji(dir) {
    return dir === 'N' ? '⬆️' : dir === 'S' ? '⬇️' : dir === 'E' ? '➡️' : '⬅️';
  }

  /* DECOR 는 그대로 두고(BASE_W·BASE_H 기준 좌표), 실제 방 크기에 맞춘 사본을
     마을마다 한 번씩만 만들어 캔다 — 순수 배경이라 정확히 맞을 필요는 없지만,
     방마다 다시 계산할 것도 아니다. h·seed·a·len 은 좌표가 아니라 그대로 둔다. */
  var _decorCache = {};
  function scaledDecorFor(cfg) {
    if (_decorCache[cfg.id]) { return _decorCache[cfg.id]; }
    var arr = cfg.decor.map(function (d) {
      var p = scalePt(d.x, d.y), o = {};
      for (var k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) { o[k] = d[k]; } }
      o.x = p.x; o.y = p.y;
      return o;
    });
    _decorCache[cfg.id] = arr;
    return arr;
  }

  var CURRENT_TOWN = null;              // 첫 enter() 에서 세이브(core.save.town.current)로 정한다
  var room = null;                      // 마을 방 (마을을 옮길 때마다 다시 짓는다)
  var player = null;
  var on = false;
  var input = { dx: 0, dy: 0 };
  var target = null;                    // 걸어가는 목표 {x, y}
  var fx = [];
  var armed = {};                       // 닿아서 이미 발동한 것 — 벗어나야 풀린다

  /* 마을 둘레 필드 전투 — 던전이 이미 검증해 둔 메커니즘(dungeon.js 의
     fieldBoundPlayer·spawnFieldRoamers·stepFieldCombat)을 그대로 빌려 쓴다.
     체력·투사체는 마을 자신의 것이라 여기 module 레벨에 붙들고 있는다 —
     raw() 는 매 틱 새 객체를 만들지만 이 배열·수는 그 안에서 참조만 한다. */
  var fhp = 1, fhpMax = 1, fmp = 100, fmpMax = 100;
  var fshots = [], ffoeShots = [];
  var fieldSpawnCd = 4;                 // 던전과 같은 4초 주기(dungeon.js FIELD 보충과 동일)
  var fieldTreasureCd = 90;             // 던전과 같은 필드 보물 조우 재확인 주기(PLAN §60 후보 1)
  var fieldMerchantCd = 60;             // 던전과 같은 방랑 상인 재확인 주기(PLAN §60 후보 1 나머지 절반)

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function D() { return global.DG.dungeon; }
  function cfgOf(id) { return TOWNS[id] || TOWNS.moru; }
  function currentCfg() { return cfgOf(CURRENT_TOWN); }
  /** 활성 마을이 있으면 그 테마, 들판(활성 마을 없음)이면 가장 가까운
   *  마을의 테마로 지형·색감을 잇는다(PLAN §28-8) — 마을에 다가설수록
   *  자연스럽게 그 마을 결로 이어지는 효과도 겸한다. */
  function currentTheme() {
    if (CURRENT_TOWN) { return currentCfg().theme; }
    if (!player) { return TOWNS.moru.theme; }
    return cfgOf(nearestTownId(player.x, player.y)).theme;
  }

  /**
   * 들길이 나가는 자리 — 방 밖 들판, 필드 반경(D().fieldRadiusUnits())의
   * 70% 지점. 정확히 그 반경 끝에 두면 걸어서 닿기도 전에 값이 흔들릴 수
   * 있어(창 크기·손잡이에 따라 반경 자체가 바뀐다) 안쪽으로 여유를 둔다.
   */
  var FIELD_EXIT_FRAC = 0.7;
  function exitPointRaw(dir) {
    var R = D().fieldRadiusUnits();
    var lo = WALL + P_R, hiX = ROOM_W - WALL - P_R, hiY = ROOM_H - WALL - P_R;
    var cx = ROOM_W / 2, cy = ROOM_H / 2, off = R * FIELD_EXIT_FRAC;
    if (dir === 'N') { return { x: cx, y: lo - off }; }
    if (dir === 'S') { return { x: cx, y: hiY + off }; }
    if (dir === 'E') { return { x: hiX + off, y: cy }; }
    return { x: lo - off, y: cy };                      // 'W'
  }
  /**
   * 들판 소품(나무·바위 따위)이 하필 그 자리에 있으면 옆으로 밀어 비켜 준다 —
   * 절차 생성 씨앗이 마을 이름마다 다르므로 우연히 막힌 자리가 나올 수 있다.
   */
  function safePoint(x, y, theme) {
    if (!D().fieldBlockedAt) { return { x: x, y: y }; }
    var ctx = { roomW: ROOM_W, roomH: ROOM_H, pr: P_R, floor: 0, roomIdx: undefined, theme: theme };
    if (!D().fieldBlockedAt(x, y, ctx)) { return { x: x, y: y }; }
    var tries = 10, i;
    for (i = 1; i <= tries; i++) {
      var step = i * 26, sign = (i % 2 === 0) ? 1 : -1;
      var tx = x + sign * step, ty = y + sign * step * 0.4;
      if (!D().fieldBlockedAt(tx, ty, ctx)) { return { x: tx, y: ty }; }
    }
    return { x: x, y: y };                              // 못 찾으면 원래 자리(드묾)
  }
  function exitPoint(dir, theme) {
    var p = exitPointRaw(dir);
    return safePoint(p.x, p.y, theme);
  }
  /** 건너온 마을에서 들어서는 자리 — 들길 표식보다 살짝 안쪽(곧바로 다시 안 나가게) */
  function entryPoint(dir, theme) {
    var e = exitPoint(dir, theme);
    var cx = ROOM_W / 2, cy = ROOM_H / 2;
    var vx = cx - e.x, vy = cy - e.y, d = Math.hypot(vx, vy) || 1;
    return safePoint(e.x + vx / d * 60, e.y + vy / d * 60, theme);
  }

  /**
   * 이 세계 좌표(x,y)가 어느 마을의 "활성 구역"(발판 + 필드 반경 R) 안인가 —
   * PLAN §28-8. 앵커 간격(4800)이 발판+R 최대치보다 넉넉히 커서 둘 이상이
   * 동시에 걸리는 일은 설계상 없다(각주마다 첫 매치를 그냥 돌려준다).
   * 아무 데도 안 걸리면 null(들판 — 어느 마을 발판도 아니다).
   */
  function footprintDist(id, x, y) {
    var a = anchorOf(id);
    var lo = WALL + P_R;
    var x0 = a.x + lo, x1 = a.x + ROOM_W - lo, y0 = a.y + lo, y1 = a.y + ROOM_H - lo;
    var dx = x < x0 ? x0 - x : (x > x1 ? x - x1 : 0);
    var dy = y < y0 ? y0 - y : (y > y1 ? y - y1 : 0);
    return Math.hypot(dx, dy);
  }
  function pickActiveTown(x, y) {
    var R = D().fieldRadiusUnits(), i, id;
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      if (footprintDist(id, x, y) <= R) { return id; }
    }
    return null;
  }
  /** 이웃 마을 자산 프리페치 몫(PLAN §28-8 후속, 2026-09-06) — §28-8 Phase 1이
   *  마을 사이 exit_* 표식을 없애면서(걸어서 자연히 건너간다) 옛
   *  "표식에 다가서면 당긴다" 프리페치 트리거가 마을 간 이동에는 더는
   *  안 걸리게 됐다(§28-2 Phase 4가 만든 것, dungeon3d.js의
   *  prefetchTownDest 참고). 마을이 104개인 지금 "앱 시작 때 다 당긴다"도
   *  답이 아니라, 대신 **아직 활성은 아니지만 곧 활성이 될 만큼 가까운**
   *  이웃을 매 틱 저렴하게(footprintDist, TOWN_ORDER 전부라 해 봤자 O(수백))
   *  걸러 낸다 — dungeon3d.js가 이 목록으로 그 마을의 decor 자산만 미리
   *  굽는다(prefetchTownDest 자체는 마을당 한 번만 실제로 일하는 기억이
   *  있어 매 틱 불러도 두 번째부터는 헛수고 없다). */
  var PREFETCH_TOWN_MARGIN = 900;   // R(최대 1200)에 더해 총 반경 최대 2100 안팎 — 다음 마을에 들어서기 한참 전
  function nearbyTownIds(x, y) {
    var R = D().fieldRadiusUnits(), lim = R + PREFETCH_TOWN_MARGIN, out = [], i, id;
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      if (id === CURRENT_TOWN) { continue; }        // 이미 활성 — 프리페치할 것 없음
      if (footprintDist(id, x, y) <= lim) { out.push(id); }
    }
    return out;
  }
  /** 들판(활성 마을이 없을 때)에서 지형·테마를 고를 기준 — 가장 가까운 마을 */
  function nearestTownId(x, y) {
    /* 빠른 길(§5.12 세계 지도 굽기가 칸 23만 개를 묻는다) — 앵커 격자(ANCHOR_DIST)
       ±2 칸 안에서 찾은 거리가 NEAR_EXACT 보다 가까우면 그게 전체 최솟값이다:
       ±3 칸 밖 마을 발판까지는 적어도 3×6400 − 3200(칸 절반) − 600(흔들림) − 방 폭(≤1120)
       = 14280 떨어져 있다. 같은 거리면 TOWN_ORDER 앞쪽(아래 느린 길과 같은 규칙) */
    var idx = townGridIndex(), gx = Math.round(x / ANCHOR_DIST), gz = Math.round(y / ANCHOR_DIST);
    var fb = null, fbd = Infinity, fbo = Infinity, ox, oz, L, j, dd, oi;
    for (oz = -2; oz <= 2; oz++) {
      for (ox = -2; ox <= 2; ox++) {
        L = idx[(gx + ox) + ',' + (gz + oz)];
        if (!L || !L.length) { continue; }
        for (j = 0; j < L.length; j++) {
          dd = footprintDist(L[j].id, x, y); oi = L[j].o;
          if (dd < fbd || (dd === fbd && oi < fbo)) { fbd = dd; fb = L[j].id; fbo = oi; }
        }
      }
    }
    if (fb && fbd < NEAR_EXACT) { return fb; }
    var best = TOWN_ORDER[0], bd = Infinity, i, d;
    for (i = 0; i < TOWN_ORDER.length; i++) {
      d = footprintDist(TOWN_ORDER[i], x, y);
      if (d < bd) { bd = d; best = TOWN_ORDER[i]; }
    }
    return best;
  }
  var NEAR_EXACT = 14000, townGrid = null;
  function townGridIndex() {
    if (townGrid && townGrid._n === TOWN_ORDER.length) { return townGrid; }   // 마을이 늘면(부팅 중) 다시
    townGrid = { _n: TOWN_ORDER.length };
    for (var i = 0; i < TOWN_ORDER.length; i++) {
      var a = anchorOf(TOWN_ORDER[i]);
      var k = Math.round(a.x / ANCHOR_DIST) + ',' + Math.round(a.y / ANCHOR_DIST);
      (townGrid[k] = townGrid[k] || []).push({ id: TOWN_ORDER[i], o: i });
    }
    return townGrid;
  }

  /**
   * 칸 하나(cx,cz)의 지형 종류(PLAN §28-8 Phase 2, 자동지도용) — 그 칸에서
   * 가장 가까운 마을을 기준으로 ring·씨앗·테마를 재서 field3d.kindOf()를
   * 그대로 부른다. **dungeon.js의 fieldBlockedAt·dungeon3d.js의 buildField가
   * 쓰는 것과 정확히 같은 산식**이어야 한다 — 안 그러면 "자동지도엔 숲인데
   * 실제로 걸으면 바위에 막힌" 어긋남이 생긴다(§28-2 Phase 3가 이미 겪은
   * 함정과 같은 종류). 순수 함수, three 필요 없다.
   */
  function worldKindAt(cx, cz) {
    var F = global.DG.field3d;
    if (!F) { return null; }
    /* 고정 세계 지도(§5.12) — 그림·충돌과 같은 표 하나 */
    var WMk = global.DG.worldMap;
    if (WMk) { return WMk.kindAt(cx, cz, ROOM_W, ROOM_H); }
    var wx = cx * F.CHUNK + F.CHUNK / 2, wy = cz * F.CHUNK + F.CHUNK / 2;
    var id = nearestTownId(wx, wy), a = anchorOf(id), cfg = cfgOf(id);
    var acx = Math.floor(a.x / F.CHUNK), acz = Math.floor(a.y / F.CHUNK);
    var ring = F.ringOf(cx - acx, cz - acz, ROOM_W, ROOM_H);
    if (ring === 0) { return 'town'; }        // 마을 발판 자체 — 지형이 아니다
    /* dungeon.js의 fieldBlockedAt·dungeon3d.js의 buildField와 같은 이유로
       같은 순서(seed는 name 고유, kindOf 가중치만 biome 우선)를 쓴다 —
       안 그러면 자동지도(Phase 2)가 그리는 색이 실제 걸을 때 밟히는
       지형·충돌과 어긋난다. */
    var seed = F.seedOf(0, undefined, cfg.theme.name);
    return F.kindOf(cx, cz, seed, ring, cfg.theme.biome || cfg.theme.name);
  }

  /**
   * 칸 하나에 실제로 서는 소품(2026-09-10, 사용자: "전체지도에서 현재
   * 화면처럼 바닥도 보여야 하고 축소했다고 보면 될 것 같다" · "점만
   * 보여"). `worldKindAt()`과 똑같은 자리에서 **종류(kindOf) 대신
   * 소품 목록(chunkAt)**을 낸다 — 자동지도가 단색 칸이 아니라 실제로
   * 그 자리에 서는 나무·바위·폐허·제단을 작은 점으로 찍을 수 있게.
   * dungeon3d.js의 buildField와 똑같은 산식(seed·ring·theme)을 쓴다 —
   * 안 그러면 지도에 보이는 소품과 실제로 걸어서 만나는 소품이 어긋난다.
   * 밀도(dens)는 그래픽 등급과 안 엮는다 — 지도는 늘 같은 모습이어야
   * 한다(등급 바뀔 때마다 지도가 다시 그려지면 헷갈린다), 기본값 1로 고정.
   */
  function worldPropsAt(cx, cz) {
    var F = global.DG.field3d;
    if (!F) { return []; }
    var WMp = global.DG.worldMap;
    if (WMp) { return WMp.pieces(cx, cz, ROOM_W, ROOM_H); }
    var wx = cx * F.CHUNK + F.CHUNK / 2, wy = cz * F.CHUNK + F.CHUNK / 2;
    var id = nearestTownId(wx, wy), a = anchorOf(id), cfg = cfgOf(id);
    var acx = Math.floor(a.x / F.CHUNK), acz = Math.floor(a.y / F.CHUNK);
    var ring = F.ringOf(cx - acx, cz - acz, ROOM_W, ROOM_H);
    if (ring === 0) { return []; }        // 마을 발판 — 건물은 따로 그려진다, 여긴 없음
    var seed = F.seedOf(0, undefined, cfg.theme.name);
    return F.chunkAt(cx, cz, seed, ring, 1, cfg.theme.biome || cfg.theme.name);
  }

  /**
   * 밝힌 칸(포그오브워, PLAN §28-8 Phase 2) — 자동지도가 "지나온 곳을
   * 기억"하게 세이브(core.save.town.seen)에 "cx,cz" 키로 쌓는다. 마을
   * 발판(ring 0)은 따로 안 밝힌다 — 마을 자체는 시작부터 다 아는 곳이라
   * 자동지도가 늘 보여준다(아래 minimap.js), 들판만 실제로 걸어야 밝혀진다.
   */
  var VISION_CHUNKS = 2;
  var lastSeenCx = null, lastSeenCz = null;
  var TOWN_DISCOVER_GOLD = 30, TOWN_DISCOVER_FEAT = 3;   // 탐험 보상(PLAN §60 후보3, 절반: 마을 첫 발견)
  /* 2026-09-10 — PLAN §60 후보 3 나머지 절반 "포그오브워 비율 보상".
     세계 전체 면적을 분모로 삼는 "%"는 못 쓴다 — WORLD_LIMIT(60000)
     기준 칸(CHUNK=200) 수가 9만 개에 육박해 분모 자체가 의미가 없고,
     들판 렌더 반경(fieldRadiusUnits)은 그래픽 등급에 따라 흔들려(2/4/6칸)
     "고정된 분모"가 못 된다. 대신 **밝힌 칸 누적 수의 문턱(milestone)**
     으로 간다 — "몇 %" 대신 "지도를 이만큼 밝혔다"는 감각은 같고, 구현은
     `core.save.town.seen`(이미 있음) 길이 하나만 보면 된다. */
  var EXPLORE_MILESTONES = [50, 150, 350, 700, 1200, 2000];
  var EXPLORE_GOLD = 25, EXPLORE_FEAT = 2;
  function checkExploreMilestones() {
    if (!core.save.town || !core.save.town.seen || !core.save.player) { return; }
    var total = 0, k;
    for (k in core.save.town.seen) { if (Object.prototype.hasOwnProperty.call(core.save.town.seen, k)) { total++; } }
    var got = core.save.town.exploreMilestone || 0;
    while (got < EXPLORE_MILESTONES.length && total >= EXPLORE_MILESTONES[got]) {
      core.save.player.gold += EXPLORE_GOLD;
      core.gainFeat(EXPLORE_FEAT, '지도 ' + EXPLORE_MILESTONES[got] + '칸 밝힘');
      core.emit('toast', '🗺️ 지도를 ' + EXPLORE_MILESTONES[got] + '칸 밝혔다 · 🪙 +' + EXPLORE_GOLD);
      got++;
    }
    core.save.town.exploreMilestone = got;
  }
  function markSeen(x, y) {
    var F = global.DG.field3d;
    if (!F || !core.save.town) { return; }
    var ccx = Math.floor(x / F.CHUNK), ccz = Math.floor(y / F.CHUNK);
    if (ccx === lastSeenCx && ccz === lastSeenCz) { return; }   // 같은 칸이면 다시 안 돈다
    lastSeenCx = ccx; lastSeenCz = ccz;
    if (!core.save.town.seen) { core.save.town.seen = {}; }
    var seen = core.save.town.seen, dx, dz;
    for (dz = -VISION_CHUNKS; dz <= VISION_CHUNKS; dz++) {
      for (dx = -VISION_CHUNKS; dx <= VISION_CHUNKS; dx++) {
        seen[(ccx + dx) + ',' + (ccz + dz)] = 1;
      }
    }
    checkExploreMilestones();
  }
  function isSeen(cx, cz) {
    return !!(core.save.town && core.save.town.seen && core.save.town.seen[cx + ',' + cz]);
  }

  /* 2026-09-08 — "다른 마을 가기가 너무 불편해"(사용자). 마을 사이가
     전부 걸어서만 이어지는 건(§28-8) 그대로 두고, **가 본 마을**로 한정한
     역참(웨이포인트, 이미 있는 원작 개념 — 위 waypoint 표식이 이제껏
     던전 층만 목록으로 냈다)을 마을에도 얹는다. `core.save.town.seen`은
     칸(포그오브워) 단위라 "마을 자체를 가 봤다"를 못 가른다 — id별로
     따로 쌓는다. */
  /** @returns {boolean} 이 마을을 **처음** 밟는 참이면 true(호출부가 탐험
   *  보상을 줄지 판단하는 데 쓴다, PLAN §60 후보3) */
  function markTownVisited(id) {
    if (!id || !core.save.town) { return false; }
    if (!core.save.town.visited) { core.save.town.visited = {}; }
    var fresh = !core.save.town.visited[id];
    core.save.town.visited[id] = 1;
    return fresh;
  }
  /** 가 본 마을 id 목록(지금 있는 곳은 뺀다) — TOWN_ORDER 순서 그대로 */
  function visitedTownIds() {
    var v = (core.save.town && core.save.town.visited) || {}, out = [], i, id;
    for (i = 0; i < TOWN_ORDER.length; i++) {
      id = TOWN_ORDER[i];
      if (v[id] && id !== CURRENT_TOWN) { out.push(id); }
    }
    return out;
  }
  /**
   * 역참으로 가 본 마을로 곧장 옮긴다 — 걸어가지 않고 그 마을의 기본
   * 스폰(defaultSpawn)에 세운다. 가 본 적 없는 마을은 거절한다(원작
   * 웨이포인트가 밟은 곳만 여는 것과 같은 규칙). 전투 중 상태(fx·armed)는
   * 굳이 안 지운다 — `_reset()`(자가진단 전용)과 달리 실제 진행을 건드리지
   * 않는다, 방(room)만 새 마을 것으로 다시 짓는다.
   */
  function travelToTown(id) {
    if (!player || !TOWNS[id]) { return false; }
    if (!(core.save.town && core.save.town.visited && core.save.town.visited[id])) { return false; }
    var sp = defaultSpawn(id);
    player.x = sp.x; player.y = sp.y;
    target = null;
    CURRENT_TOWN = id;
    room = null;
    build();
    saveWorldPos();
    core.persist();
    return true;
  }

  /**
   * 마을 하나를 세계 좌표에 짓는다(PLAN §28-8) — CURRENT_TOWN 이 가리키는
   * 마을을 anchorOf(CURRENT_TOWN) 자리에 앉힌다. **플레이어 위치는 안
   * 건드린다** — 이제 위치는 이 마을에 매인 것이 아니라 세계 전체에 걸친
   * 하나의 연속값이라, 마을이 바뀌어도(활성 마을이 갈릴 때마다 다시 불림)
   * 그대로 이어진다.
   */
  /* 2026-09-07 — "이동할 때마다 화면이 갈색(빈 화면)"(PC·모바일 둘 다) 제보.
     `update()`가 마을 경계를 넘을 때마다(§28-8, pickActiveTown) `CURRENT_TOWN`을
     먼저 새 값으로 바꾼 **다음** build()를 부른다(위 update() 참고) — 그런데
     buildInner()가 도중에 던지면 `CURRENT_TOWN`은 이미 새 마을인데 `room`은
     옛 마을 것 그대로 남는다. 다음 틱엔 `nextTown === CURRENT_TOWN`이라
     재시도도 안 걸려, 그 어긋난 상태가 그대로 굳는다 — dungeon3d.js가 그
     어긋난 room을 그리려다 계속 실패하면 "이동할 때마다"(걸을 때마다 칸이
     바뀌어 다시 그리려 들 때마다) 딱 들어맞는다. 실패하면 CURRENT_TOWN도
     같이 안전한 값(들판)으로 되돌려 어긋남 자체를 없앤다 — game.js
     start()/startInner()와 같은 요령이다. */
  function build() {
    try {
      buildInner();
    } catch (e) {
      if (global.console) { console.warn('[마을] build() 실패 — 들판(빈 방)으로 되돌린다', e); }
      CURRENT_TOWN = null;
      buildInner();
    }
  }
  function buildInner() {
    armed = {};
    if (!CURRENT_TOWN) {
      /* 들판 한복판(PLAN §28-8) — 활성 마을이 없다. 장식·NPC·표식 없는 빈
         방을 두고, 지형은 noRoom 모드(raw() 참고)의 chunkAt/fieldBlockedAt
         이 세계 좌표 그대로 그린다 — 어느 마을 발판도 아니다. */
      room = {
        kind: 'town', index: 0, cleared: true, last: true,
        enemies: [], drops: [], doors: [], chest: null, well: null, shrine: null,
        decor: [], npcs: [], marks: []
      };
      fhpMax = fhp = global.DG.hero ? Math.max(1, Math.round(global.DG.hero.partyPower().def * 3 + 60)) : 100;
      fshots.length = 0; ffoeShots.length = 0;
      fieldSpawnCd = 4;
      return;
    }
    var cfg = currentCfg();
    var anchor = anchorOf(CURRENT_TOWN);
    var i, n, p;
    room = {
      kind: 'town', index: 0, cleared: true, last: true,
      enemies: [], drops: [], doors: [], chest: null, well: null, shrine: null,
      decor: scaledDecorFor(cfg).map(function (d) {
        var o = {}, k;
        for (k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) { o[k] = d[k]; } }
        o.x = d.x + anchor.x; o.y = d.y + anchor.y;
        return o;
      }),
      npcs: [], marks: []
    };
    /* 원본(NPC_DEFS·MARKS·TOWNS)은 건드리지 않는다 — 진단이 마을을 여러 번
       세우고 오갈 수 있다. 좌표는 BASE_W·BASE_H 기준으로 적혀 있어 실제
       방 크기에 맞춘 뒤 세계 앵커를 더한다. */
    /* 스프레드는 **손으로 지은 넷**(모루골 등)만 받는다 — 절차 생성 마을의
       NPC 좌표는 이미 placePoints()가 소품과의 최소 간격을 보장해 뽑은
       값이라(위 generateTowns), 여기서 다시 밀어내면 오히려 그 보장이
       깨진다(2026-09-07, 자가진단으로 실제로 걸림 — gen 마을에서 NPC가
       기존 집·우물 쪽으로 밀려났었다). */
    var isHandTown = !!HAND_TOWN_DENSITY_SALT[cfg.id];
    var handObstacles = isHandTown ? handTownNpcObstacles(cfg) : null;
    for (i = 0; i < cfg.npcs.length; i++) {
      var spot = cfg.npcs[i], def = NPC_DEFS[spot.key];
      var spread = isHandTown ? handTownNpcSpread(spot.x, spot.y, handObstacles) : spot;
      p = scalePt(spread.x, spread.y);
      room.npcs.push({
        key: spot.key, name: def.name, emoji: def.emoji, sheet: def.sheet, line: def.line,
        x: anchor.x + p.x, y: anchor.y + p.y, color: def.color,
        ref: { id: 'town_' + spot.key, name: def.name, trait: def.trait, rarity: def.rarity },
        phase: core.hash2(i + 1, 7) * 6.28, facing: spot.x > 380 ? -1 : 1
      });
    }
    /* 세 시대 손님(§5.20) — 위 직군과 달리 시트가 없다(ui.js 가 말만 띄운다) */
    var efSpot = ERA_FOLK_ON() ? eraFolkSpot(cfg) : null;
    if (efSpot) {
      var efKey = eraFolkKeyOf(cfg.id), ef = ERA_FOLK[efKey];
      p = scalePt(efSpot.x, efSpot.y);
      room.npcs.push({
        key: efKey, name: ef.name, emoji: ef.emoji, sheet: null, line: ef.lines[0], lines: ef.lines, story: ef.story || null,
        era: ef.era, model: ef.model, x: anchor.x + p.x, y: anchor.y + p.y, color: ef.color,
        ref: { id: 'town_' + efKey, name: ef.name, trait: 'virtue', rarity: 2 },
        phase: core.hash2(cfg.npcs.length + 1, 7) * 6.28, facing: efSpot.x > 380 ? -1 : 1
      });
    }
    if (cfg.hasGate) {
      for (i = 0; i < MARKS.length; i++) {
        n = MARKS[i];
        /* 굴혈(gate)은 더 안 세운다 — 아래 exits 루프가 'W' 들길(exit_dungeon)
           로 옮겨 세운다. 하나만 남아야 한다(입구가 둘이면 혼란). MARKS 표
           자체는 손 안 댐(역참·결사비가 그대로 읽는다). */
        if (n.key === 'gate') { continue; }
        p = scalePt(n.x, n.y);
        room.marks.push({ key: n.key, name: n.name, emoji: n.emoji, x: anchor.x + p.x, y: anchor.y + p.y });
      }
    }
    /* 지워진 이름의 비석 — 마을마다 하나(정본 side_names_*) */
    var nsSpot = nameStoneSpot(cfg);
    if (nsSpot) {
      p = scalePt(nsSpot.x, nsSpot.y);
      room.marks.push({ key: 'namestone:' + cfg.id, nameStone: true, townId: cfg.id, name: '지워진 이름의 비석', emoji: '🪦', x: anchor.x + p.x, y: anchor.y + p.y });
    }
    /* 굴혈(던전 입구) — cfg.exits 중 목적지가 'dungeon'인 것만 실제 발동
       표식으로 세운다. **다른 마을로의 exits는 더는 표식을 안 세운다** —
       §28-8부터 마을 사이는 걸어서 자연히 건너간다(활성 마을이 세계
       좌표로 저절로 갈린다, pickActiveTown 참고) — 옛 "들길을 밟으면
       travel()" 트리거는 필요가 없어져 은퇴했다(Phase 2 자동지도가 이웃
       마을 방향을 대신 그릴 것이다). */
    for (i = 0; i < cfg.exits.length; i++) {
      var ex = cfg.exits[i];
      if (ex.to !== 'dungeon') { continue; }
      var ep = exitPoint(ex.dir, cfg.theme);
      room.marks.push({
        key: 'exit_dungeon', name: '굴혈(窟穴)', emoji: '🕳️',
        x: anchor.x + ep.x, y: anchor.y + ep.y
      });
    }
    /* 체력도 던전과 같은 산식으로 — 부대 방어력이 오르면 마을 필드에서도 더 버틴다.
       마을에 들어설 때마다(활성 마을이 갈릴 때) 채운다 — "마을은 안전지대"라는
       옛 취지 그대로다. */
    fhpMax = fhp = global.DG.hero ? Math.max(1, Math.round(global.DG.hero.partyPower().def * 3 + 60)) : 100;
    fshots.length = 0; ffoeShots.length = 0;
    fieldSpawnCd = 4;
  }

  /** 처음 세계에 놓일 때 쓰는 자리 — moru의 로컬 (195,240)과 같은 뜻(역참·
   *  굴혈 어느 쪽에도 안 닿는 자리)을 그 마을의 세계 좌표로 낸다. */
  function defaultSpawn(townId) {
    var a = anchorOf(townId), p = scalePt(195, 240);
    return { x: a.x + p.x, y: a.y + p.y };
  }

  /** 세이브에 세계 좌표를 적어 둔다 — 불러오면 그 자리로 돌아온다(PLAN §28-8) */
  function saveWorldPos() {
    if (!player) { return; }
    if (!core.save.town) { core.save.town = { pos: { x: player.x, y: player.y } }; }
    else { core.save.town.pos = { x: player.x, y: player.y }; }
  }

  /* ── 드나들기 ─────────────────────────────────────────── */

  function enter(opts) {
    opts = opts || {};
    if (!player) {
      /* 첫 진입 — 세이브에 세계 좌표(pos)가 있으면 그 자리, 없으면(옛
         세이브 — §28-1~§28-7 시절, 마을 id 하나만 있었다) 그 마을의 앵커
         스폰으로 한 번 마이그레이션, 그것도 없으면 모루골 스폰. */
      var saved = core.save.town, sp;
      if (saved && saved.pos) { sp = { x: saved.pos.x, y: saved.pos.y }; }
      else { sp = defaultSpawn((saved && saved.current) || 'moru'); }
      player = {
        x: sp.x, y: sp.y, phase: 0, walking: false, facing: 1, hurt: 0,
        cds: [0, 0, 0, 0], dash: null, invuln: 0, rallyUntil: 0,
        dirX: 0, dirY: -1,
        atkCd: 0, atkAnim: 0          // 필드 로머 자동공격용 — dungeon.js stepFieldCombat 이 쓴다
      };
    }
    /* 던전에서 막 나온 참이면 반드시 모루골(굴혈은 거기에만 있다) —
       그 밖엔 지금 세계 좌표가 어느 마을 발판 안인지로 갈린다(§28-8,
       마을 사이는 걸어서 자연히 건너가므로 "지금 있던 마을"이라는 개념이
       CURRENT_TOWN 에 저장돼 있지 않고 매번 좌표로 다시 구해진다). */
    CURRENT_TOWN = opts.fromDungeon ? 'moru' : pickActiveTown(player.x, player.y);
    markTownVisited(CURRENT_TOWN);
    build();
    /* 던전에서 막 나온 참이면 굴혈 앞에 세운다 — 나온 자리에 서 있어야
       "다시 들어간다" 가 한 걸음이다. 다만 입구에 **닿은 채로** 세우면
       그 자리에서 곧바로 다시 빨려 들어간다. 그래서 한 발 물려 세우고
       그 표식은 발동을 잠가 둔다(armed). */
    if (opts.fromDungeon) {
      var anchor = anchorOf('moru');
      var gp = entryPoint('W', currentCfg().theme);
      player.x = anchor.x + gp.x; player.y = anchor.y + gp.y;
      armed.exit_dungeon = true;
    }
    on = true;
    input.dx = 0; input.dy = 0;
    target = null;
    fx.length = 0;
    markSeen(player.x, player.y);           // 포그오브워 — 처음 서는 자리 둘레는 바로 밝힌다
    /* 고정 세계 지도(§5.12) — 들어서는 지역은 조용히 기억만(배너는 걸어서 넘어갈 때),
       세계 칸 표는 뒤에서 잠깐씩 나눠 미리 굽는다(진단·그림 없는 판은 안 굽는다) */
    var WMe = global.DG.worldMap;
    if (WMe) {
      regionNow = WMe.regionAt(player.x, player.y).key; regionPend = null; regionPendT = 0;
      if (!global.DG_NO_DRAW) { WMe.bakeInBackground(ROOM_W, ROOM_H); }
    }
    saveWorldPos();
    core.emit('town:enter', null);
    core.emit('changed');
    return true;
  }

  function leave() {
    on = false;
    input.dx = 0; input.dy = 0;
    target = null;
    return true;
  }

  function active() { return on; }

  /** 오버월드 지도(ui.js 의 M키 전체지도)가 읽는 자리 — 고정 배치 + 지금 위치.
   *  §28-8부터 마을 사이는 걸어서 자연히 건너간다(travel() 은퇴) — current()
   *  는 활성 마을이 없으면(들판 한복판) null 일 수 있다, Phase 2가 이 경우를
   *  마저 다룬다. anchor 는 Phase 2 자동지도가 실제 지형을 그리는 데 쓴다. */
  var overworld = {
    current: function () { return CURRENT_TOWN; },
    list: function () {
      return TOWN_ORDER.map(function (id) {
        var c = TOWNS[id];
        return { id: c.id, name: c.name, dirFromHub: c.dirFromHub, anchor: anchorOf(id) };
      });
    }
  };

  /* ── 조작 ─────────────────────────────────────────────── */

  function setInput(dx, dy) { input.dx = dx; input.dy = dy; if (dx || dy) { target = null; } }
  function moveTo(x, y) { target = { x: x, y: y }; }

  /** 마을에서는 무예가 나가지 않는다 — 벨 것이 없다 */
  function castSkill() { return false; }

  /* 2026-09-10 — d()가 던전/마을 중 지금 켜진 쪽을 내주므로(위 dungeon-view.js
     의 그 약속) #dg-actions 버튼 셋(강공격·회피·투장 무예)이 마을에서 눌려도
     안 죽어야 한다. castSkill과 같은 자리 — 마을엔 벨 것이 없다. */
  function heavyAttack() { return false; }
  function doDodge() { return false; }
  function castSetSkill() { return false; }
  function castSigSkill() { return false; }

  /** 단약도 마실 일이 없다(늘 가득) — potion.js 가 이 값을 보고 알을 아낀다 */
  function refill() { return false; }

  /* ── 닿음 ─────────────────────────────────────────────── */

  /**
   * 닿으면 발동한다 — 폰에서 "지목해서 말 걸기" 는 손이 갑절로 든다.
   * 대신 **벗어나기 전까지 다시 발동하지 않는다**(armed). 이 문턱이 없으면
   * 대장장이 옆에 서 있는 동안 창이 끝없이 다시 열린다.
   */
  function touchCheck() {
    var i, o, d;
    for (i = 0; i < room.npcs.length; i++) {
      o = room.npcs[i];
      d = dist(player, o);
      if (d <= TALK_R && !armed[o.key]) {
        armed[o.key] = true;
        o.facing = player.x > o.x ? 1 : -1;
        core.emit('town:npc', o);
      } else if (d > LEAVE_R && armed[o.key]) {
        armed[o.key] = false;
      }
    }
    for (i = 0; i < room.marks.length; i++) {
      o = room.marks[i];
      d = dist(player, o);
      if (d <= TALK_R && !armed[o.key]) {
        armed[o.key] = true;
        core.emit('town:mark', o);
      } else if (d > LEAVE_R && armed[o.key]) {
        armed[o.key] = false;
      }
    }
  }

  /** 지금 닿아 있는 것 (화면이 이름표를 띄울 때 쓴다) */
  function nearest() {
    var best = null, bd = TALK_R + 22, i, d;
    for (i = 0; i < room.npcs.length; i++) {
      d = dist(player, room.npcs[i]);
      if (d < bd) { bd = d; best = room.npcs[i]; }
    }
    for (i = 0; i < room.marks.length; i++) {
      d = dist(player, room.marks[i]);
      if (d < bd) { bd = d; best = room.marks[i]; }
    }
    return best;
  }

  /* ── 한 틱 ────────────────────────────────────────────── */

  /* ── 지역 진입(§5.12) — 원작의 "○○ 에 들어섰다" ──────────────
   * 경계가 굽어 있어 선을 따라 걸으면 들락날락할 수 있다 — 새 지역에 1.2초
   * 머물러야 바뀐 것으로 친다(배너가 깜빡이지 않게). */
  var regionNow = null, regionPend = null, regionPendT = 0, REGION_HOLD = 1.2;
  var questFieldCd = 0;
  function fieldLevel() {
    var WM = global.DG.worldMap;
    return (WM && player) ? WM.levelAt(player.x, player.y) : 0;
  }
  function fieldRegionKey() {
    var WM = global.DG.worldMap;
    return (WM && player) ? WM.regionAt(player.x, player.y).key : null;
  }
  function stepRegion(dt) {
    var WM = global.DG.worldMap;
    if (!WM || !player) { return; }
    var rg = WM.regionAt(player.x, player.y);
    if (regionNow === null) { regionNow = rg.key; return; }
    if (rg.key === regionNow) { regionPend = null; regionPendT = 0; return; }
    if (rg.key !== regionPend) { regionPend = rg.key; regionPendT = 0; }
    regionPendT += dt;
    if (regionPendT < REGION_HOLD) { return; }
    regionNow = rg.key; regionPend = null; regionPendT = 0;
    var lvNow = WM.levelAt(player.x, player.y);
    core.log(rg.emoji + ' ' + rg.name + '(' + rg.hanja + ') 에 들어섰다 — ' + rg.desc + ' · 위험 ' + lvNow, 'info');
    core.emit('toast', rg.emoji + ' ' + rg.name + '(' + rg.hanja + ') · 위험 ' + lvNow + ' — ' + rg.desc);
    core.emit('region:enter', rg.key);
  }

  function update(dt) {
    if (!on || !player) { return; }
    dt = Math.min(dt, 0.05);
    var px0 = player.x, py0 = player.y;

    var dx = input.dx, dy = input.dy;
    if (!dx && !dy && target) {
      var tdx = target.x - player.x, tdy = target.y - player.y;
      var td = Math.hypot(tdx, tdy);
      if (td < 6) { target = null; }
      else { dx = tdx / td; dy = tdy / td; }
    }
    var len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      var MTt = global.DG.mount, spdT = SPD * (MTt && MTt.speedMul ? MTt.speedMul() : 1);   // 탈것 배율(mount.js)
      player.x += dx * spdT * dt;
      player.y += dy * spdT * dt;
      player.walking = true;
      player.phase += dt * 9;
      if (dx) { player.facing = dx > 0 ? 1 : -1; }
      player.dirX = dx; player.dirY = dy;
    } else {
      player.walking = false;
    }
    /* 활성 마을이 걸으면서 갈릴 수 있다(PLAN §28-8) — 마을 발판을 벗어나
       거나 다른 마을 발판에 들어서면 그 자리에서 장식·NPC·표식을 다시
       짓는다. 안 바뀌었으면(같은 마을, 또는 들판→들판) 아무 것도 안
       한다 — 매 틱 다시 짓지 않는다. **반드시 raw()/ctx 를 만들기 전에**
       해야 한다 — 그래야 이 틱의 클램프(boundPlayer)가 이미 갈린 마을
       기준으로 걸린다(안 그러면 경계에서 한 틱 늦게 반응해 순간적으로
       옛 방 사각형에 도로 갇힐 수 있다). */
    var nextTown = pickActiveTown(player.x, player.y);
    if (nextTown !== CURRENT_TOWN) {
      CURRENT_TOWN = nextTown;
      var freshTown = markTownVisited(CURRENT_TOWN);
      build();
      /* 탐험 보상(PLAN §60 후보3, "르나운류") — 걸어서 마을을 **처음**
         밟는 순간에만 한 번(재방문·재부팅 복귀는 markTownVisited가
         false를 돌려줘 다시 안 준다). 새 자원 종류를 안 만들고 기존
         금·공적(feat)만 조금 준다 */
      if (freshTown && core.save.player) {
        core.save.player.gold += TOWN_DISCOVER_GOLD;
        core.gainFeat(TOWN_DISCOVER_FEAT, '마을 발견');
        core.log('🗺️ ' + cfgOf(CURRENT_TOWN).theme.name + ' 을(를) 처음 밟았다', 'good');
        core.emit('toast', '🗺️ 새로운 마을 발견! +' + TOWN_DISCOVER_GOLD + ' 🪙');
      }
      /* 세이브 갈무리 — 옛 travel()이 마을을 건널 때마다 세이브했던 것과
         같은 자리(활성 마을이 갈리는 순간)에 건다. 매 틱 저장하면 너무
         잦다 — 이 정도 빈도면 충분하고, 앱이 죽어도 최근 지난 마을/들판
         전환 지점까지는 복구된다. */
      saveWorldPos();
      core.persist();
    }

    /* 던전이 이미 검증해 둔 필드 확장(방 밖 들판까지 넓히고, 눈에 보이는
       소품과는 부딪힌다)을 마을도 그대로 쓴다 — 방 치수가 다르므로 ctx 로
       넘긴다(위 raw() 참고). */
    var ctx = raw();
    D().fieldBoundPlayer(player, px0, py0, ctx);
    markSeen(player.x, player.y);           // 포그오브워(PLAN §28-8 Phase 2) — 실제로 선 자리 기준
    stepRegion(dt);

    /* 들판 로머 — 던전과 같은 주기·상한(PLAN 10절 "필드 사냥"과 동일 규칙) */
    fieldSpawnCd -= dt;
    if (fieldSpawnCd <= 0) {
      fieldSpawnCd = 3;
      /* §5.19 — 상한 6 → 18(dg.fieldCap), 한 마리씩 → 모자란 만큼(최대 5, 한 무리) */
      var capT = D().FIELD_CAP ? D().FIELD_CAP() : D().FIELD_ENEMY_CAP, haveT = D().fieldRoamerCount(ctx);
      if (haveT < capT) { D().spawnFieldRoamers(Math.min(5, capT - haveT), ctx); }
    }
    fieldTreasureCd -= dt;
    if (fieldTreasureCd <= 0) {
      fieldTreasureCd = 90;
      D().spawnFieldTreasure(ctx);
    }
    fieldMerchantCd -= dt;
    if (fieldMerchantCd <= 0) {
      fieldMerchantCd = 60;
      D().spawnFieldMerchant(ctx);
    }
    roadMarkCd -= dt;
    if (roadMarkCd <= 0) {
      roadMarkCd = 1;
      spawnNearbyRoadMarks();
    }
    relicMarkCd -= dt;
    if (relicMarkCd <= 0) {
      relicMarkCd = 1;
      spawnNearbyFieldRelics();
    }
    D().stepFieldCombat(dt, ctx, fx);
    D().pickupField(ctx, fx);
    D().stepWorldBoss(ctx, fx);   // 세계 보스(§5.4) — 예고·출현·75초 제한을 스스로 관리한다
    if (D().stepRegionBoss) { D().stepRegionBoss(ctx); }   // 지역 우두머리(§5.13) — 고정 자리에 다가가면
    questFieldCd -= dt;
    if (questFieldCd <= 0 && global.DG.quest && global.DG.quest.stepField) {
      questFieldCd = 0.4;
      global.DG.quest.stepField(player.x, player.y);   // 지역 사연(§5.14) — 사슬 열기·흔적 자리
    }
    /* 체력이 0까지 떨어지면 던전과 완전히 같게 처리한다(hurtPlayer→die() 그대로) —
       dungeon:end 가 곧바로 town.enter({fromDungeon:true})를 다시 불러 굴혈 앞으로
       돌려보낸다. 마을은 안전지대 예외를 안 둔다(사용자 확정) — 대신 돌아온
       자리에서는 다시 온전하다. */
    fhp = ctx.hp <= 0 ? fhpMax : ctx.hp;

    /* 마을 사람은 제자리에서 숨만 쉰다 — 돌아다니게 하면 볼일 보러 쫓아다녀야 한다 */
    for (var i = 0; i < room.npcs.length; i++) { room.npcs[i].phase += dt * 1.2; }

    for (i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= dt;
      if (fx[i].life <= 0) { fx.splice(i, 1); }
    }

    touchCheck();
  }

  /** 들판 방랑 상인을 만났다 — 재고를 고르는 동안 자리에서 치운다
   *  (PLAN §60 후보 1 나머지 절반). `js/ui.js`가 `town:npc`에서 부른다. */
  function consumeFieldMerchant(npc) {
    var i = room.npcs.indexOf(npc);
    if (i >= 0) { room.npcs.splice(i, 1); }
  }

  /** 표식 위에 글자 하나 띄운다 (역참을 밟았다 같은 것) */
  function note(text, color) {
    fx.push({ t: 'get', x: player.x, y: player.y, text: text,
              color: color || '#f0c45a', life: 1.1 });
  }

  /* ── 화면이 읽어 가는 것 — dungeon.js 와 같은 모양 ────── */

  /**
   * dungeon.js 의 run 과 같은 모양이다 — 이 객체를 그대로 dungeon.js 의
   * fieldBoundPlayer·spawnFieldRoamers·stepFieldCombat 에 ctx 로 넘긴다.
   * roomW·roomH·wall·pr 은 이 방 치수가 던전과 달라서(마을은 데스크톱에서
   * 1.4배로 커진다) 그 함수들이 씨앗·경계를 마을 크기에 맞게 계산하게 한다.
   * theme 는 지금 서 있는 마을의 것 — 마을마다 달라 필드 씨앗(field3d.seedOf)도
   * 마을마다 다른 들판을 그린다.
   */
  function raw() {
    if (!on) { return null; }
    /* PLAN §28-8 — 활성 마을이 있으면 그 앵커에 방 사각형(발판)을 두고,
       없으면(들판 한복판) noRoom 모드다: 방 사각형 없이 세계 경계만 두고
       소품 충돌만 축분리로 본다(dungeon.js boundPlayer 참고). anchor 는
       들판에서도 필요하다 — 가장 가까운 마을 기준으로 ring(멀고 가까움)
       을 재야 지형이 마을에 다가설수록 자연스럽게 옅어진다. */
    var wild = !CURRENT_TOWN;
    var anchor = anchorOf(wild ? nearestTownId(player.x, player.y) : CURRENT_TOWN);
    return {
      town: true, wild: wild, theme: currentTheme(),
      /* townId(2026-09-18, §5.4 월드 보스) — 지금 활성 마을 id 그대로.
         `theme.name`으로 되짚을 수도 있지만, 슬롯 배정(town.js 밖,
         dungeon.js stepWorldBoss)이 TOWNS 키를 직접 쓰므로 여기서 그대로 준다. */
      townId: CURRENT_TOWN,
      /* 지역 위험도(§5.13) — 들판 싸움의 층 노릇(적 세기·내 원소 피해·전리품·경험치).
         중원은 0 이라 예전과 같다. region 은 지역 몬스터 명단 키 */
      floor: fieldLevel(), startFloor: 0, roomIdx: undefined,
      region: fieldRegionKey(),
      roomW: ROOM_W, roomH: ROOM_H, wall: WALL, pr: P_R,
      anchor: anchor, noRoom: wild,
      room: room, player: player, shots: fshots, foeShots: ffoeShots,
      boons: {}, choice: null,
      loot: { gold: 0, items: [] },
      hp: fhp, hpMax: fhpMax, mp: fmp, mpMax: fmpMax,
      kills: 0, dead: false
    };
  }

  /**
   * 조작판(구슬·무예·요대)이 이 값을 읽는다. 마을에서도 판은 그대로 있다 —
   * 원작에서 야영지에 들어섰다고 조작판이 사라지지 않는다.
   * 구슬은 가득 찬다. 마을은 쉬는 자리다.
   */
  function status() {
    var st = D().status();               // 던전이 쉬는 중일 때의 통계(최고 층 따위)
    var skills = [], got = D().slotSkills ? D().slotSkills() : [];
    for (var i = 0; i < 4; i++) {
      if (!got[i]) {
        skills.push({ key: null, name: '비었다', emoji: '·', desc: '무예를 걸어 두세요',
                      cost: 0, cd: 0, cdMax: 1, ready: false, empty: true });
        continue;
      }
      var sk = got[i].sk;
      skills.push({
        key: sk.key, name: sk.name, emoji: sk.emoji,
        desc: '마을에서는 쓰지 않습니다 — ' + sk.desc,
        rank: got[i].rank, cost: sk.cost, cd: 0, cdMax: sk.cd, ready: false
      });
    }
    return {
      active: true, town: true, floor: 0, theme: currentTheme(),
      /* 지역(§5.12~13) — HUD 가 "어디·얼마나 위험한가" 를 말한다 */
      wild: !CURRENT_TOWN, regionKey: fieldRegionKey(), dangerLv: fieldLevel(),
      hp: Math.max(0, Math.round(fhp)), hpMax: fhpMax, mp: Math.round(fmp), mpMax: fmpMax,
      skills: skills, rally: false,
      room: 1, roomTotal: 1, cleared: true, kind: 'town',
      loot: { gold: 0, items: 0 },
      boons: {}, choice: null,
      kills: 0, best: st.best || 0,
      atk: 0, reach: 0,
      /* 월드 보스(§5.4) HUD — 지금 마을이 이번 슬롯의 대상일 때만 채운다.
         순수 조회다(dungeon-view.js 렌더 전용, 상태를 안 바꾼다). */
      wb: worldBossHud()
    };
  }

  /** status() 의 wb 필드 — 예고 중이면 카운트다운, 전투 중이면 이름·HP%·
   *  부위 3·남은 시간을 낸다. 둘 다 아니면 null(HUD가 그 줄을 안 그린다). */
  function worldBossHud() {
    var D2 = D(), W = D2.state().world;
    if (!W || W.townId !== CURRENT_TOWN) { return null; }
    var now = D2.wbNow();
    var slot = Math.floor(now / D2.WB_SLOT_MS), slotStart = slot * D2.WB_SLOT_MS;
    if (W.slot !== slot) { return null; }   // 이 마을이 다음 슬롯 대상이 되기 전(다른 슬롯 잔상 방지)
    if (now >= slotStart - D2.WB_NOTICE_MS && now < slotStart) {
      return { phase: 'notice', remain: Math.max(0, Math.ceil((slotStart - now) / 1000)) };
    }
    if (now >= slotStart && now < slotStart + D2.WB_FIGHT_MS) {
      var b = D2.worldBossIn(room);
      if (!b) { return null; }
      return {
        phase: 'active', name: D2.enemyName(b),
        hp: Math.max(0, Math.round(b.hp)), hpMax: b.hpMax,
        remain: Math.max(0, Math.ceil((b.wbEndAt - now) / 1000)),
        parts: { weapon: !b.wbWeaponBroken, armor: !b.wbArmorBroken, helm: !b.wbHelmBroken }
      };
    }
    return null;
  }

  global.DG = global.DG || {};
  global.DG.town = {
    ROOM_W: ROOM_W, ROOM_H: ROOM_H, WALL: WALL, P_R: P_R,
    TALK_R: TALK_R, MARKS: MARKS,
    active: active, enter: enter, leave: leave, update: update,
    npcKeys: function () { return Object.keys(NPC_DEFS); },   // §5.16 몸짓 표 진단
    npcDefs: NPC_DEFS,                                        // 2D 사람 시트 굽기(sprite.peopleList)가 옷 빛깔을 읽는다
    FOLK_STORY_GOLD: 5000, NAME_STONE_GOLD: NAME_STONE_GOLD, nameStoneNameOf: nameStoneNameOf, nameStoneSpot: function (id) { return TOWNS[id] ? nameStoneSpot(TOWNS[id]) : null; }, rewardNameStone: rewardNameStone, eraFolk: ERA_FOLK, eraFolkKeyOf: eraFolkKeyOf, eraFolkSpot: function (id) { return TOWNS[id] ? eraFolkSpot(TOWNS[id]) : null; },
    townIds: function () { return TOWN_ORDER.slice(); },
    setInput: setInput, moveTo: moveTo, castSkill: castSkill, refill: refill,
    heavyAttack: heavyAttack, doDodge: doDodge, castSetSkill: castSetSkill,
    castSigSkill: castSigSkill,
    nearest: nearest, note: note, consumeFieldMerchant: consumeFieldMerchant,
    rewardRoadMark: rewardRoadMark,
    rewardFieldRelic: rewardFieldRelic,
    /** 도감 'relics' 탭(js/ui.js)이 총 개수·목록을 읽는다 — 참조 그대로 주지
     *  않는다(호출자가 실수로 고치면 세계 배치가 흔들린다). */
    fieldRelics: function () { return FIELD_RELICS.map(function (r) { return { id: r.id, name: r.kind.name, emoji: r.kind.emoji }; }); },
    overworld: overworld,
    status: status,
    exitPointRaw: exitPointRaw,
    /** PLAN §28-8(2026-09-06, 오픈월드 A안) — 세계 앵커·활성 마을 판정.
     *  자가진단·Phase 2(자동지도) 가 읽는다. anchorOf 는 참조 그대로 주지
     *  않는다(호출자가 실수로 고치면 앵커가 전부 흔들린다) — 얕은 복사. */
    anchorOf: function (id) { var a = anchorOf(id); return { x: a.x, y: a.y }; },
    worldAnchors: function () {
      var out = {}, i, id;
      for (i = 0; i < TOWN_ORDER.length; i++) { id = TOWN_ORDER[i]; out[id] = { x: WORLD_ANCHOR[id].x, y: WORLD_ANCHOR[id].y }; }
      return out;
    },
    pickActiveTown: pickActiveTown, nearestTownId: nearestTownId, footprintDist: footprintDist,
    nearbyTownIds: nearbyTownIds,
    /** 역참(웨이포인트)의 "다른 마을로" 목록 — ui.js openWaypoint()가 읽는다 */
    visitedTownIds: visitedTownIds, travelToTown: travelToTown,
    nameOf: function (id) { return cfgOf(id).name; },
    /** 자가진단(§5.12) — 마을 테마(biome·region) 읽기 전용 */
    themeOf: function (id) { var t = cfgOf(id).theme; return { name: t.name, biome: t.biome, region: t.region }; },
    /** PLAN §28-8 Phase 2(자동지도) — minimap.js가 읽는다. worldKindAt·
     *  isSeen 은 순수(three 필요 없음), currentAnchor 는 raw()와 같은 값을
     *  raw() 없이(town 이 꺼져 있어도) 셀 수 있게 한다. */
    worldKindAt: worldKindAt, worldPropsAt: worldPropsAt, isSeen: isSeen,
    /** 고정 세계 지도(§5.12) — 지금 선 지역 키(배너 기준, 머묾 1.2초 반영) */
    regionKey: function () { return regionNow; },
    _stepRegion: stepRegion,
    currentAnchor: function () { return anchorOf(CURRENT_TOWN ? CURRENT_TOWN : nearestTownId(player ? player.x : 0, player ? player.y : 0)); },
    /** 지역 진입 전 미리 로드(PLAN 39절, `dungeon3d.js`의 `prefetchTownDest()`가
     *  읽는다) — 그 마을 decor 에 쓰이는 건물 종류(house·well·inn 등)를
     *  중복 없이 돌려준다. 순수 함수, three 필요 없다. */
    decorTypesOf: function (id) {
      var cfg = cfgOf(id), seen = {}, out = [], i, t;
      for (i = 0; i < cfg.decor.length; i++) {
        t = cfg.decor[i].t;
        if (seen[t]) { continue; }
        seen[t] = true;
        out.push(t);
      }
      return out;
    },
    /** 자가진단용 — 그 마을의 exits 원본(dir·to·len)을 그대로 돌려준다(읽기 전용). */
    exitsOf: function (id) { return cfgOf(id).exits.slice(); },
    /** 마을 간 길(도로) 선분 목록 — `field3d.js`의 `kindOf()`가 지연 조회로
     *  읽는다(로드 순서상 field3d가 town.js보다 늦게 실려 이쪽에서 먼저
     *  못 넘긴다 — 그래서 콜백이 아니라 함수를 얹어 두고 나중에 부르게
     *  한다). 읽기 전용 — 얕은 복사로 내준다. */
    roadSegments: function () { return ROAD_SEGMENTS.slice(); },
    /** 화면 전용 — 상태를 직접 읽는다 (쓰지는 말 것) */
    raw: raw,
    moveTarget: function () { return target; },
    fx: function () { return fx; },
    /** 자가진단용 — 마을을 처음 상태로 되돌린다. townId 를 주면 그 마을로
     *  (기본 모루골) — 그 마을의 기본 스폰 세계 좌표에 플레이어도 같이
     *  둔다(§28-8부터 위치가 CURRENT_TOWN 을 결정하므로, 옮겨만 놓고
     *  좌표를 안 맞추면 다음 update()에서 도로 튕겨 나간다). */
    _reset: function (townId) {
      var id = townId && TOWNS[townId] ? townId : 'moru';
      var sp = defaultSpawn(id);
      if (!player) {
        player = { x: sp.x, y: sp.y, phase: 0, walking: false, facing: 1, hurt: 0,
          cds: [0, 0, 0, 0], dash: null, invuln: 0, rallyUntil: 0, dirX: 0, dirY: -1,
          atkCd: 0, atkAnim: 0 };
      } else { player.x = sp.x; player.y = sp.y; }
      CURRENT_TOWN = id;
      room = null; armed = {};
      on = true;
      build();
    },
    /** 자가진단용 — 그 자리로 순간 옮긴다 (걸어가지 않고) */
    _put: function (x, y) { if (player) { player.x = x; player.y = y; } },
    /** 자가진단용(PLAN §28-8) — 앱을 처음부터 다시 켠 것처럼 player 를
     *  잊는다. 다음 enter() 가 세이브(pos, 없으면 옛 current 마이그레이션)
     *  로 다시 서는 실제 첫 진입 경로를 타는지 확인할 때 쓴다. */
    _forgetPlayer: function () { player = null; on = false; }
  };
})(window);
