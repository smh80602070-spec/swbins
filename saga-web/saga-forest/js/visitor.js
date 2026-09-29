/**
 * 떠돌이 방문객 — 날마다 다른 손님 (PLAN §5.9, 2026-09-24 사용자 선택)
 * ---------------------------------------------------------------
 * 원작의 떠돌이 상인·박물관장·마스코트 손님 자리다. 매일 날짜 해시로 한 명이 마을 광장에
 * 들른다. 퓨전 방향(과거·현대·미래·괴물 허용)대로 사람만 오지 않는다.
 *
 *   🦊 여우 화상 호연    오늘만 귀한 가구 하나를 1.5배 값에 판다(한 번 더 말 걸면 산다)
 *   🧭 난파 선원 풍랑    나침반 조각 다섯이 **바깥 숲**에 흩어졌다 → 다 찾아 주면 선장의 궤짝
 *   👻 도깨비불 반디     제 몸 조각 다섯이 바깥 숲에 흩어졌다 → 다 모아 주면 도깨비 등롱
 *   🎣 낚시 명인 청파    물고기 셋을 보여 주면(가방에서 가져간다) 명인의 어탁
 *   🦋 곤충 박사 나비    곤충 셋을 보여 주면 나비 표본 액자
 *   🤖 시간 여행자 K-7   광석 둘과 화석 하나로 "미래 부품"을 만든다 → 시간의 탁상시계
 *   👺 도깨비 대장 두두   숨바꼭질하던 꼬마 셋이 바깥 숲 덤불에 숨었다 → 찾으면 광장으로 뛰어온다(§5.10)
 *   👽 불시착 탐사원 루미 탐사선 부품 넷이 바깥 숲에 흩어졌다 → 별 지도 액자(§5.10)
 *
 * §5.10 단골·눌러앉기 — 같은 손님의 부탁을 세 번 들어주면(`s.visitBond[key]`) 그다음 부탁을
 * 마친 날 "여기 눌러앉아도 되겠소?" 하고 묻는다(한 번 더 말 걸면 허락). 눌러앉은 손님은
 * (`s.visitSettled`) 날마다 광장 둘레 제자리에 서고, 하루 한 번 작은 선물을 준다.
 * 몸짓 — 곁에 서면 나를 보고 손짓(👋), 그날 부탁을 다 들어주면 제자리에서 춤(깡충)을 춘다.
 *
 * §5.11 이웃 — 눌러앉은 손님은 하나에 마을 평가 +6(town.beauty). 광장에 손님이 둘 이상인 날은
 * 날짜 해시로 한 쌍이 서로 마주 보고 수다를 떤다(말을 걸면 그 대화가 들린다).
 *
 * "맵이 큰 것에 비해 NPC 가 없다"(사용자) — 선원·도깨비불 날엔 바깥 고리 다섯 자리에 일이 생긴다.
 * 한 사람과의 일은 하루 한 번(그날이 지나면 새 손님). 보상 가구는 전방에서 안 판다(`fest:'visit'`).
 *
 * 숲 NPC 일곱(`village.js` `npcs`)과 **따로 둔다** — 그 일곱은 자리·수·애니메 아바타가 못박혀 있다.
 * 화면은 `village.raw().visitors` 를 NPC 와 같은 길로 그린다(`n.def` 가 있으면 그것을 쓴다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  function V() { return global.DG.village; }
  function VD() { return global.DG.villageData; }

  /* 세 시대 손님(§5.13 · SAGA-DESIGN §13) — era 는 표시·진단용(past·modern·future·myth), body 는 3D 몸
     (제 클립 든 CC0 GLB — 없으면 사람 기본 몸). 사가고 ⑱·사가블로에서 복사해 온 Quaternius 파일 */
  var M = 'assets/models/';
  var VISITORS = [
    { key: 'fox', name: '여우 화상 호연', emoji: '🦊', type: 'shop', era: 'myth',
      line: '눈이 밝은 손님만 알아보는 물건이 있지요 — 오늘 하루뿐이랍니다' },
    { key: 'sailor', name: '난파 선원 풍랑', emoji: '🧭', type: 'collect', piece: 'visitcompass', n: 5,
      line: '배가 뒤집혀 나침반이 산산이… 숲 어디에 조각이 떨어졌을 텐데', gold: 800, furn: 'visit_sailor', era: 'past' },
    { key: 'wisp', name: '도깨비불 반디', emoji: '👻', type: 'collect', piece: 'visitwisp', n: 5,
      line: '히잉… 놀라서 몸이 다섯 조각으로 흩어졌어. 숲에서 좀 찾아 줘', gold: 1000, furn: 'visit_wisp', era: 'myth', body: M + 'monsters/Ghost.glb' },
    { key: 'angler', name: '낚시 명인 청파', emoji: '🎣', type: 'bring', cat: 'fish', n: 3,
      line: '이 마을 물고기 구경 좀 하세나 — 셋만 보여 주게', gold: 700, furn: 'visit_angler', era: 'past' },
    { key: 'bugdoc', name: '곤충 박사 나비', emoji: '🦋', type: 'bring', cat: 'bug', n: 3,
      line: '표본이 모자라요! 곤충 세 마리만 나눠 주실래요?', gold: 700, furn: 'visit_bug', era: 'modern' },
    { key: 'traveler', name: '시간 여행자 K-7', emoji: '🤖', type: 'bring', cat: 'ore', n: 2, cat2: 'fossil', n2: 1,
      line: '삐빗. 2387년에서 왔습니다. 광석 둘과 화석 하나가 있으면 귀환 부품을 만들 수 있습니다', gold: 900, furn: 'visit_future', era: 'future', body: M + 'foes/Robot_Walker.glb' },
    { key: 'dokkaebi', name: '도깨비 대장 두두', emoji: '👺', type: 'collect', piece: 'visitkid', n: 3, back: true,
      line: '우리 꼬마 셋이 숨바꼭질하다 안 돌아와 — 바깥 숲 흔들리는 덤불 속 어딘가야', gold: 900, furn: 'visit_dokkaebi', era: 'myth', body: M + 'standin/Orc.gltf' },
    { key: 'alien', name: '불시착 탐사원 루미', emoji: '👽', type: 'collect', piece: 'visitufo', n: 4,
      line: '삐— 탐사선 부품 넷이 숲에 흩어졌어요. 찾아 주면 별 지도를 드릴게요', gold: 1100, furn: 'visit_alien', era: 'future', body: M + 'people/space/Astronaut1.glb' },
    /* 현대 손님 둘(§5.13) — 과거·신화·미래는 있는데 현대가 곤충 박사 하나뿐이었다 */
    { key: 'courier', name: '택배 기사 달음', emoji: '📦', type: 'collect', piece: 'visitparcel', n: 4,
      line: '주소가 지도에 없는 동네라 헤매다 소포 넷을 숲길에 떨어뜨렸어요 — 좀 찾아 주실래요?', gold: 900, furn: 'visit_parcel', era: 'modern', body: M + 'people/folk/m_Worker.glb' },
    { key: 'photo', name: '사진작가 찰나', emoji: '📷', type: 'bring', cat: 'fish', n: 1, cat2: 'bug', n2: 1,
      line: '이 숲 도감 사진을 찍는 중이에요 — 물고기 하나, 곤충 하나만 모델이 돼 주면 좋겠는데', gold: 800, furn: 'visit_photo', era: 'modern', body: M + 'people/folk/m_Hoodie.glb' }
  ];
  /** 조각 이름(주웠을 때 한 줄) */
  var PIECE_TXT = { visitcompass: '🧭 나침반 조각', visitwisp: '👻 도깨비불 조각', visitkid: '🧒 도깨비 꼬마를 찾았다', visitufo: '🔩 탐사선 부품', visitparcel: '📦 떨어진 소포' };
  /** 눌러앉은 손님의 하루 선물(🪙) · 한마디 */
  var SETTLE_N = 3;
  var GIFT = { fox: 300, sailor: 250, wisp: 200, angler: 220, bugdoc: 220, traveler: 280, dokkaebi: 240, alien: 300, courier: 240, photo: 220 };
  var SETTLE_LINE = {
    fox: '이 마을 손님들 눈이 밝아 장사할 맛이 나오', sailor: '바다는 멀어도 여기 바람이 좋구려',
    wisp: '히히, 밤마다 마을 등불 옆에서 놀아', angler: '오늘 물때가 좋네 — 같이 낚으러 가겠나',
    bugdoc: '이 숲의 곤충 도감을 새로 쓰는 중이에요', traveler: '삐빗. 귀환 일정을 무기한 미뤘습니다',
    dokkaebi: '꼬마들이 마을 아이들이랑 잘 논다', alien: '이 별, 정착지로 등록했어요',
    courier: '이 마을은 제가 맡을게요 — 주소도 이제 다 외웠어요', photo: '오늘 빛이 좋아요, 한 장 찍어 드릴까요?'
  };
  /** 눌러앉은 손님 열의 각자 사연(정본 side_guest_*) — 눌러앉은 뒤 처음 말을 걸면 한 번 들려준다. 사연마다 글 한 토막 + 금·업적 */
  var STORY = {
    fox: '실은 내가 시대를 넘나드는 장사꾼이 된 까닭이 있소. 젊을 적 아끼던 옛 방울 하나를 어느 시대 시장에선가 잃어버렸다오. 그걸 찾으려 물건을 사고팔며 떠돌았지. 이 마을 좌판에서 그 방울 소리를 들은 것 같은 날이 있소.',
    sailor: '내 옛 항구는 바다가 물러나며 뭍이 되었다오. 배 없는 뱃사람이 되고 나서야 배가 나를 태운 게 아니라 내가 배를 아꼈다는 걸 알았소. 이 호수에 박힌 배가 내 고향의 마지막 돛대라오.',
    wisp: '히히, 나는 옛날 이 숲 길 잃은 나그네를 밝혀 주던 등불이었어. 나그네가 다 떠나고 나서도 불이 안 꺼져서 도깨비불이 됐지. 마을 등불 옆이 제일 따뜻해서 눌러앉았어!',
    angler: '낚싯대를 처음 잡은 건 일곱 살, 할아버지 곁이었소. 못 가장자리에서 한나절 아무것도 못 잡고도 할아버지는 웃으셨지. 낚시란 물고기가 아니라 기다림을 잡는 일이라 하셨소. 그 말뜻을 이제야 알겠구려.',
    bugdoc: '제가 곤충 박사가 된 건 어릴 적 나비 한 마리 때문이에요. 날개 무늬가 어느 도감에도 없었거든요. 그 나비를 찾아 이 숲까지 왔는데, 도감을 새로 쓰다 보니 어쩌면 제가 그 나비의 이름을 짓게 될지도 몰라요.',
    traveler: '삐빗. 기록: 저의 귀환 일정은 원래 사흘이었습니다. 그런데 이 숲의 기록판에서 처음으로 ‘사라진 숲’ 이 ‘이어진 숲’ 으로 바뀌는 것을 보았습니다. 관측자가 결과를 바꾸는 사례는 흔치 않아 일정을 무기한 미뤘습니다.',
    dokkaebi: '허허, 내 꼬마들이 원래는 쓸쓸한 폐허의 도깨비불이었다네. 이 마을 아이들이 겁내지 않고 놀아 주니 꼬마들이 처음으로 웃는 걸 보았지. 대장으로서 이보다 더한 선물은 없네.',
    alien: '제 모선은 별을 세는 배예요. 그런데 이 별에서 밥을 하루 세 번 먹는 사람들을 보고 처음으로 별을 세는 것보다 이웃을 세고 싶어졌어요. 모선에는 정착지 등록 신호를 이미 보냈답니다.',
    courier: '제가 처음 배달한 소포는 주소가 없는 소포였어요. 받을 사람을 못 찾아 사흘을 헤맸는데, 결국 소포를 열어 보니 안에 든 건 ‘누군가에게 전해질 마음’ 이라는 쪽지였죠. 그 뒤로 저는 주소보다 사람을 먼저 봐요.',
    photo: '제 첫 사진은 흐릿한 새벽 풍경이었어요. 잘 안 찍혔다고 버리려는데 옆 사람이 ‘이 흐릿함이 좋다’ 고 하더라고요. 그때 알았어요, 사진은 잘 찍는 게 아니라 누구와 같이 보느냐라는 걸요.'
  };
  var STORY_GOLD = 1500, STORY_FEAT = 10;

  /** 수다(§5.11) — 먼저 꺼내는 말 · 받는 말. 둘을 이어 붙여 한 쌍의 대화가 된다 */
  var CHAT_OPEN = {
    fox: '요즘 바다 건너 물건값이 부쩍 올랐다오', sailor: '어젯밤 바람 냄새가 폭풍 전날 같았소',
    wisp: '히히, 어제 등불 셋을 몰래 껐다 켰어', angler: '못 가장자리에 큰 놈이 하나 사는 게 틀림없네',
    bugdoc: '이 숲 나비 날개 무늬가 도감이랑 달라요', traveler: '삐빗. 이 시대 달력은 계산이 어렵습니다',
    dokkaebi: '우리 꼬마들이 마을 아이들 신발을 숨겼대', alien: '이 별 사람들은 밥을 하루 세 번이나 먹어요',
    courier: '갓 쓴 분께 소포를 드렸더니 절을 하시더라고요', photo: '어제 찍은 사진에 도깨비불이 찍혔어요'
  };
  var CHAT_REPLY = {
    fox: '그런 건 내가 싸게 구해 주리다, 수수료만 조금', sailor: '허허, 뱃사람 앞에서 그런 얘기를',
    wisp: '헤에, 그럼 오늘 밤에 같이 보러 가자', angler: '기다리는 게 반이지, 서두르지 말게',
    bugdoc: '어머, 그거 새 종일지도 몰라요!', traveler: '삐빗. 기록해 두겠습니다',
    dokkaebi: '크하하, 그 정도는 장난도 아니지', alien: '제 별에선 그걸 "우정" 이라고 불러요',
    courier: '배송 완료, 도장 꾹!', photo: '그 순간을 놓치면 안 되죠'
  };
  var GUEST_BEAUTY = 6;
  /** 광장 둘레 눌러앉는 자리(가운데 기준 칸) — 걸을 수 없으면 둘레를 정해진 순서로 찾는다 */
  var SETTLE_SPOTS = [[4, -3], [-5, 2], [4, 3], [-5, -2], [0, 5], [1, -6], [-2, 5], [6, 0]];
  var BY = {};
  VISITORS.forEach(function (v) { BY[v.key] = v; });
  var FOX_MUL = 1.5;
  var SPOT = [-3, -3];              // 마을 가운데에서 이만큼 어긋난 풀밭(축제 소품 자리와 안 겹친다)
  var DIRS = ['동', '남동', '남', '남서', '서', '북서', '북', '북동'];

  /** 오늘의 손님 — 날짜 해시(같은 날이면 늘 같다) */
  function whoOn(day) { return VISITORS[Math.floor(core.hash2(day * 13 + 7, 911) * 2 * VISITORS.length) % VISITORS.length]; }
  function today() { var s = V().state(); return whoOn(s.day); }

  /** 오늘 기록 — 날이 바뀌면 새로. 손을 쓸 때(talk·pick)만 세이브에 만든다 */
  function rec() {
    var s = V().state(), k = whoOn(s.day).key;
    /* 손님이 바뀌었으면(날 또는 손님 표가 늘어 그날 손님이 달라졌을 때) 새로 */
    if (!s.visit || s.visit.day !== s.day || (s.visit.key && s.visit.key !== k)) {
      s.visit = { day: s.day, key: k, got: {}, done: false, offered: false };
    }
    return s.visit;
  }
  /** 읽기 전용 — 소품 세우기·화면·상태는 세이브를 안 건드린다("살피기 세이브 불변") */
  function peek() {
    var s = V().state(), k = whoOn(s.day).key;
    return s.visit && s.visit.day === s.day && (!s.visit.key || s.visit.key === k) ? s.visit
      : { day: s.day, key: k, got: {}, done: false, offered: false };
  }

  function centerTile() { var v = V(); return { tx: Math.floor(v.W / 2), ty: Math.floor(v.H / 2) }; }

  /** 손님이 서는 자리 */
  function spot() {
    var v = V(), c = centerTile(), T = v.TILE;
    var x = (c.tx + SPOT[0]) * T + T * 0.5, y = (c.ty + SPOT[1]) * T + T * 0.5;
    return { x: x, y: y };
  }

  /* ── 단골·눌러앉기(§5.10) ── */
  function bonds() { var s = V().state(); return s.visitBond || {}; }
  function settled() { var s = V().state(); return Array.isArray(s.visitSettled) ? s.visitSettled : []; }
  function isSettled(k) { return settled().indexOf(k) >= 0; }
  var settleCache = {};
  /** 눌러앉은 손님 i 번째 자리 — 걸을 수 있는 칸을 정해진 순서로 찾는다(무작위 없음) */
  function settleSpot(i) {
    var v = V(), c = centerTile(), T = v.TILE, base = SETTLE_SPOTS[i % SETTLE_SPOTS.length], r, dx, dy;
    var ck = i + '|' + c.tx + ',' + c.ty;
    if (settleCache[ck]) { return settleCache[ck]; }
    for (r = 0; r <= 3; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) { continue; }
          var x = (c.tx + base[0] + dx) * T + T * 0.5, y = (c.ty + base[1] + dy) * T + T * 0.5;
          if (!v.walkable || v.walkable(x, y)) { return (settleCache[ck] = { x: x, y: y }); }
        }
      }
    }
    return (settleCache[ck] = { x: (c.tx + base[0]) * T + T * 0.5, y: (c.ty + base[1]) * T + T * 0.5 });
  }
  /** 찾아 준 도깨비 꼬마 — 대장 곁(광장 반대쪽)으로 뛰어와 선다 */
  function kidList(d, r, p) {
    if (!d.back) { return []; }
    var T = V().TILE, out = [];
    Object.keys(r.got).sort().forEach(function (gi, j) {
      out.push({ id: 'visit_kid' + gi, kind: 'visit_kid', visitor: d.key, kid: true, x: p.x - T * (1.4 + j * 0.9), y: p.y + T * 1.3,
        facing: 1, gesture: 'dance', def: { name: '도깨비 꼬마', emoji: '🧒', line: '헤헤, 들켰다!' } });
    });
    return out;
  }

  /** 오늘 수다 떠는 한 쌍 — 광장에 선 손님(오늘 손님 + 눌러앉은 손님) 둘 이상일 때, 날짜 해시로 */
  function chatPair(people, day) {
    if (people.length < 2) { return null; }
    var n = people.length, i = Math.floor(core.hash2(day * 23 + 5, 331) * 2 * n) % n;
    var j = (i + 1 + Math.floor(core.hash2(day * 29 + 9, 557) * 2 * (n - 1)) % (n - 1)) % n;
    var a = people[i], b = people[j];
    return { a: a, b: b, text: a.def.emoji + ' "' + (CHAT_OPEN[a.visitor] || '…') + '" — ' + b.def.emoji + ' "' + (CHAT_REPLY[b.visitor] || '…') + '"' };
  }
  function listRaw() {
    if (!V() || !V().state) { return []; }
    var d = today(), p = spot(), r = peek();
    var out = [{ id: 'visit_' + d.key, kind: 'visit_' + d.key, visitor: d.key, x: p.x, y: p.y, facing: 1,
      gesture: r.done ? 'dance' : 'wave', body: d.body || null, def: { name: d.name, emoji: d.emoji, line: d.line } }];
    out = out.concat(kidList(d, r, p));
    settled().forEach(function (k, i) {
      var sv = BY[k];
      if (!sv || k === d.key) { return; }        // 제 손님 날엔 광장 한가운데(위)에 선다
      var q = settleSpot(i);
      out.push({ id: 'settle_' + k, kind: 'settle_' + k, visitor: k, settled: true, x: q.x, y: q.y, facing: 1,
        gesture: 'wave', body: sv.body || null, def: { name: sv.name, emoji: sv.emoji, line: SETTLE_LINE[k] || sv.line } });
    });
    return out;
  }
  /** 오늘 손님 한 명 + 눌러앉은 손님들(화면·focus 가 읽는다). 일을 다 끝냈어도 그날은 광장에 머문다.
   *  수다 한 쌍은 서로를 보고(faceX·faceY) 대화 한 줄(chat)을 들고 있다 */
  function list() {
    var out = listRaw();
    if (!out.length) { return out; }
    var people = out.filter(function (x) { return !x.kid; }), pr = chatPair(people, V().state().day);
    if (pr) {
      pr.a.chat = pr.b.chat = pr.text;
      pr.a.faceX = pr.b.x; pr.a.faceY = pr.b.y; pr.b.faceX = pr.a.x; pr.b.faceY = pr.a.y;
      pr.a.chatWith = pr.b.visitor; pr.b.chatWith = pr.a.visitor;
    }
    return out;
  }

  /** 바깥 숲 조각 자리 — 그날·세이브 해시, 서로 12타일 넘게 떨어진다 */
  var pieceCache = null;
  function pieces() {
    var v = V(), s = v.state(), d = today();
    if (d.type !== 'collect') { return []; }
    var key = s.day + '|' + (s.seed || 0) + '|' + v.forestMargin();
    if (pieceCache && pieceCache.key === key) { return pieceCache.list; }
    var m = v.forestMargin(), W = v.W, H = v.H, out = [], tries = 0;
    while (out.length < d.n && tries < 4000) {
      tries++;
      var tx = Math.floor(-m + 2 + core.hash2(s.day * 31 + tries * 7, tries * 13 + 3) * 2 * (W + 2 * m - 4));
      var ty = Math.floor(-m + 2 + core.hash2(s.day * 17 + tries * 5 + 1, tries * 29 + 11) * 2 * (H + 2 * m - 4));
      if (!v.ringSpotOk(tx, ty)) { continue; }
      /* 정령의 터·발견 격자 자리와 겹치지 않게(그 둘레는 비워 두는 약속이 있다) */
      var SPI = global.DG.spirit, GRD = global.DG.grid;
      if (SPI && SPI.blocked && SPI.blocked(tx, ty)) { continue; }
      if (GRD && GRD.blocked && GRD.blocked(tx, ty)) { continue; }
      if (SPI && SPI.spots && SPI.spots().some(function (q) { return Math.max(Math.abs(q.tx - tx), Math.abs(q.ty - ty)) <= (SPI.CLEAR || 2) + 1; })) { continue; }
      var far = out.every(function (p) { return Math.hypot(p.tx - tx, p.ty - ty) > 12; });
      if (!far) { continue; }
      out.push({ i: out.length, tx: tx, ty: ty });
    }
    pieceCache = { key: key, list: out };
    return out;
  }

  /** 소품으로 세울 조각 — 이미 주운 것은 뺀다 */
  function marks() {
    var d = today(), T = V().TILE, r = peek();
    if (d.type !== 'collect' || r.done) { return []; }
    return pieces().filter(function (p) { return !r.got[p.i]; }).map(function (p) {
      return { id: 'vp' + p.i, kind: d.piece, x: p.tx * T + T * 0.5, y: p.ty * T + T * 0.5, visit: p.i };
    });
  }

  function dirOf(tx, ty) {
    var c = centerTile(), a = Math.atan2(ty - c.ty, tx - c.tx);
    return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  }

  /** 조각을 줍는다 */
  function pick(prop) {
    var d = today(), r = rec();
    if (d.type !== 'collect' || r.done || r.got[prop.visit]) { return null; }
    r.got[prop.visit] = true;
    var n = Object.keys(r.got).length;
    V().buildProps();
    core.persist();
    return { kind: 'gather', text: (PIECE_TXT[d.piece] || '조각') + ' (' + n + '/' + d.n + ') — ' +
      (n >= d.n ? '다 모았다! 광장의 ' + d.name + '에게 가져가자' : '아직 ' + (d.n - n) + '개 남았다') };
  }

  /* ── 가방 ── */
  function takeCat(cat, n) {
    var v = V();
    if (v.bagCatCount(cat) < n) { return false; }
    var bag = v.state().bag, left = n;
    (VD().ITEMS[cat] || []).forEach(function (it) {
      while (left > 0 && (bag[it.key] || 0) > 0) { bag[it.key] -= 1; left--; }
    });
    return left === 0;
  }

  function bondUp(k) {
    var s = V().state();
    if (!s.visitBond || typeof s.visitBond !== 'object') { s.visitBond = {}; }
    s.visitBond[k] = (s.visitBond[k] || 0) + 1;
    return s.visitBond[k];
  }
  function reward(d) {
    var H = global.DG.home;
    bondUp(d.key);
    core.save.player.gold += d.gold;
    if (H && d.furn) { H.stockAdd(d.furn, 1); }
    core.gainFeat(1, '방문객');
    core.gainExp(15);
    var f = VD().FURNITURE.filter(function (x) { return x.key === d.furn; })[0];
    core.log(d.emoji + ' ' + d.name + '의 부탁을 들어줬다 — 🪙 ' + core.fmt(d.gold) + (f ? ' · ' + f.name : ''), 'good');
    core.emit('village:visit', { key: d.key });
    core.emit('changed');
    core.persist();
    return f;
  }

  /** 여우 화상의 오늘 물건 — 전방 물건 중 비싼 쪽에서 날짜 해시로 */
  function foxItem(day) {
    var all = VD().FURNITURE.filter(function (f) { return !f.fest && f.price >= 1400; });
    return all[Math.floor(core.hash2(day * 7 + 3, 577) * 2 * all.length) % all.length];
  }

  /** 눌러앉은 손님 — 하루 한 번 선물, 그 뒤엔 한마디 */
  function talkSettled(d) {
    var s = V().state();
    if (!s.visitGift || s.visitGift.day !== s.day) { s.visitGift = { day: s.day, got: {} }; }
    if (s.visitGift.got[d.key]) {
      var me = list().filter(function (x) { return x.settled && x.visitor === d.key; })[0];
      return { kind: 'talk', name: d.name, text: me && me.chat ? '(수다 중) ' + me.chat : d.emoji + ' ' + (SETTLE_LINE[d.key] || d.line) };
    }
    if (!s.visitStory) { s.visitStory = {}; }
    if (!s.visitStory[d.key] && STORY[d.key]) {                       // 눌러앉은 뒤 처음 — 각자 사연 한 번(선물은 이 말 뒤에)
      s.visitStory[d.key] = true;
      core.save.player.gold += STORY_GOLD;
      core.gainFeat(STORY_FEAT, '손님 사연');
      core.log(d.emoji + ' ' + d.name + '의 사연을 들었다 — 🪙 ' + core.fmt(STORY_GOLD), 'good');
      core.emit('changed'); core.persist();
      return { kind: 'talk', name: d.name, story: true, text: d.emoji + ' ' + STORY[d.key] + ' (🪙 +' + core.fmt(STORY_GOLD) + ')' };
    }
    s.visitGift.got[d.key] = true;
    var g = GIFT[d.key] || 200;
    core.save.player.gold += g;
    core.gainExp(5);
    core.log(d.emoji + ' ' + d.name + '의 선물 — 🪙 ' + core.fmt(g), 'good');
    core.emit('changed'); core.persist();
    return { kind: 'quest', name: d.name, text: '이웃 좋다는 게 이런 거지 — 🪙 ' + core.fmt(g) + ' 받아 두시오' };
  }
  /** 부탁을 마친 날, 단골이면 눌러앉기를 청한다(한 번 더 말 걸면 허락) */
  function settleAsk(d, r) {
    if (isSettled(d.key) || (bonds()[d.key] || 0) < SETTLE_N || settled().length >= SETTLE_SPOTS.length) { return null; }
    if (!r.askSettle) {
      r.askSettle = true;
      return { kind: 'talk', name: d.name, text: d.emoji + ' 벌써 ' + bonds()[d.key] + '번째로구려… 이 마을에 눌러앉아도 되겠소? (한 번 더 말 걸면 허락)' };
    }
    var s = V().state();
    if (!Array.isArray(s.visitSettled)) { s.visitSettled = []; }
    s.visitSettled.push(d.key);
    core.log('🏡 ' + d.emoji + ' ' + d.name + '이(가) 마을에 눌러앉았다', 'good');
    core.emit('village:settle', { key: d.key });
    core.emit('changed'); core.persist();
    return { kind: 'quest', name: d.name, text: '고맙소! 내일부터는 광장 곁에서 지내겠소 — 들르면 작은 선물을 드리리다' };
  }

  /** 말을 건다 — village.interact() 가 방문객이면 여기로 보낸다 */
  function talk(npc) {
    if (npc && npc.kid) { return { kind: 'talk', name: '도깨비 꼬마', text: '🧒 헤헤, 들켰다! 다음엔 더 꼭꼭 숨을 거야' }; }
    if (npc && npc.settled && BY[npc.visitor]) { return talkSettled(BY[npc.visitor]); }
    var d = BY[npc.visitor] || today(), r = rec(), f;
    if (r.done) {
      var ask = settleAsk(d, r);
      if (ask) { return ask; }
      return { kind: 'talk', name: d.name, text: d.emoji + ' 오늘 고마웠소 — 또 들르리다' };
    }
    if (d.type === 'shop') {
      var it = foxItem(V().state().day), price = Math.round(it.price * FOX_MUL);
      if (!r.offered) {
        r.offered = true;
        return { kind: 'talk', name: d.name, text: '오늘의 물건은 「' + it.name + '」 — 🪙 ' + core.fmt(price) + '. 마음에 들면 한 번 더 말을 거시오' };
      }
      if (core.save.player.gold < price) { return { kind: 'talk', name: d.name, text: '🪙 ' + core.fmt(price) + ' 이 있어야 하오 — 오늘 해 지기 전에 다시 오시오' }; }
      core.save.player.gold -= price;
      global.DG.home.stockAdd(it.key, 1);
      r.done = true;
      bondUp(d.key);
      core.log('🦊 ' + d.name + '에게서 「' + it.name + '」을 샀다 — 🪙 ' + core.fmt(price), 'good');
      core.emit('changed'); core.persist();
      return { kind: 'quest', name: d.name, text: '「' + it.name + '」 — 좋은 눈이시오. 집 창고에 넣어 두었소' };
    }
    if (d.type === 'collect') {
      var n = Object.keys(r.got).length;
      if (n < d.n) {
        var left = pieces().filter(function (p) { return !r.got[p.i]; }).map(function (p) { return dirOf(p.tx, p.ty); });
        return { kind: 'quest', name: d.name, text: d.line + ' (' + n + '/' + d.n + ') — 마을 ' + left.join('·') + '쪽 숲 어딘가' };
      }
      r.done = true; f = reward(d);
      return { kind: 'quest', name: d.name, text: '다 찾아 줬구려! 🪙 ' + core.fmt(d.gold) + (f ? ' · 「' + f.name + '」' : '') };
    }
    /* bring — 가방에서 가져간다 */
    var have = V().bagCatCount(d.cat), have2 = d.cat2 ? V().bagCatCount(d.cat2) : 0;
    if (have < d.n || (d.cat2 && have2 < d.n2)) {
      return { kind: 'quest', name: d.name, text: d.line + ' (' + Math.min(have, d.n) + '/' + d.n +
        (d.cat2 ? ' · ' + Math.min(have2, d.n2) + '/' + d.n2 : '') + ')' };
    }
    takeCat(d.cat, d.n);
    if (d.cat2) { takeCat(d.cat2, d.n2); }
    r.done = true; f = reward(d);
    return { kind: 'quest', name: d.name, text: '고맙소! 🪙 ' + core.fmt(d.gold) + (f ? ' · 「' + f.name + '」' : '') };
  }

  /** 이 칸에 오늘 조각이 있나(둘레 한 칸 포함) — 숲 고리 사물이 그 위에 안 서게 */
  function blocked(tx, ty) {
    var d = today();
    if (d.type !== 'collect') { return false; }
    return pieces().some(function (p) { return Math.abs(p.tx - tx) <= 1 && Math.abs(p.ty - ty) <= 1; });
  }

  function status() {
    var d = today(), r = peek();
    return { key: d.key, name: d.name, emoji: d.emoji, type: d.type, done: r.done, got: Object.keys(r.got).length, n: d.n || 0,
             bond: bonds()[d.key] || 0, settled: settled().slice() };
  }

  global.DG = global.DG || {};
  global.DG.visitor = {
    VISITORS: VISITORS, byKey: function (k) { return BY[k] || null; }, FOX_MUL: FOX_MUL,
    whoOn: whoOn, today: today, list: list, spot: spot, pieces: pieces, marks: marks, foxItem: foxItem, blocked: blocked,
    /* 세이브가 바뀌는 곳 */
    pick: pick, talk: talk, rec: rec, status: status,
    STORY: STORY, STORY_GOLD: STORY_GOLD, SETTLE_N: SETTLE_N, SETTLE_SPOTS: SETTLE_SPOTS, GIFT: GIFT, settleSpot: settleSpot, settled: settled, bonds: bonds,
    GUEST_BEAUTY: GUEST_BEAUTY, CHAT_OPEN: CHAT_OPEN, CHAT_REPLY: CHAT_REPLY,
    /** 마을 평가(town.beauty)가 읽는다 — 눌러앉은 손님 몫 */
    beautyBonus: function () { return settled().length * GUEST_BEAUTY; },
    _reset: function () { pieceCache = null; settleCache = {}; }
  };
})(window);
