/**
 * 2나락 방 생성 — 방 종류 고르기·벽·장애물·문·상자·샘·제단·적 무리 배치(층 씨앗으로 결정적) — dungeon.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * dungeon.js 가 `bind({ DD, ROOM_W, ROOM_H, WALL, spawnEnemy, addPacks })` 로 손잡이를 넘기고 같은 이름으로 부른다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var G = null, DD, ROOM_W, ROOM_H, WALL, spawnEnemy, addPacks;
  var api = null;
  function bind(g) { if (G !== g) { G = g; DD = g.DD; ROOM_W = g.ROOM_W; ROOM_H = g.ROOM_H; WALL = g.WALL; spawnEnemy = g.spawnEnemy; addPacks = g.addPacks; } return api; }

  /* ── 방 생성 ─────────────────────────────────────────── */

  function pickRoomKind() {
    var total = 0, i;
    for (i = 0; i < DD.ROOMS.length; i++) { total += DD.ROOMS[i].weight; }
    var r = Math.random() * total;
    for (i = 0; i < DD.ROOMS.length; i++) {
      r -= DD.ROOMS[i].weight;
      if (r <= 0) { return DD.ROOMS[i].key; }
    }
    return 'fight';
  }

  /**
   * 방 하나를 만든다.
   * @param kind 'fight' | 'trove' | 'well' | 'shrine' | 'elite' | 'miniboss' | 'cave' | 'merchant' | 'puzzle' | 'event' | 'forage' | 'boss' | 'stair'
   */
  function makeRoom(kind, floor, index, total) {
    var room = {
      kind: kind, index: index, cleared: false,
      enemies: [], drops: [], doors: [], chest: null, well: null, shrine: null, vein: null,
      merchant: null, puzzle: null, captive: null, forage: null, grave: null
    };
    var n;
    if (kind === 'boss') {
      room.enemies.push(spawnEnemy(floor, true));
      n = Math.min(6, 2 + Math.floor(floor / 5));         // 보스도 부하를 몰고 온다
      for (var b = 0; b < n; b++) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'fight') {
      /* 원작처럼 몰려온다 — 4~7 + 층 보정, 상한 12 (성능·화면 밀도) */
      n = Math.min(12, 4 + Math.floor(Math.random() * 4) + Math.min(6, Math.floor(floor / 3)));
      for (var i = 0; i < n; i++) { room.enemies.push(spawnEnemy(floor, false)); }
      addPacks(room, index);
    } else if (kind === 'trove') {
      room.chest = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, taken: false };
      if (Math.random() < 0.5) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'well') {
      room.well = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
    } else if (kind === 'shrine') {
      room.shrine = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
    } else if (kind === 'elite') {
      /* 정예 소굴(POI: Elite) — 반드시 정예 하나를 낀 채로 나온다. 잡졸 수는
         전투방보다 적다(정예 하나가 이미 벅차다) */
      n = Math.min(8, 3 + Math.floor(Math.random() * 3) + Math.min(3, Math.floor(floor / 5)));
      room.enemies.push(spawnEnemy(floor, false, { forceElite: true }));
      for (var ei = 1; ei < n; ei++) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'miniboss') {
      /* 미니보스(POI: MiniBoss) — 층 끝 보스와 달리 부하 없이 혼자 나온다.
         `kill()` 이 `e.boss` 만 보고 이미 보스급 노획(확정 드랍·재료·단약·
         감정서)을 주므로 여기서 따로 더 챙길 것은 없다 */
      room.enemies.push(spawnEnemy(floor, true));
    } else if (kind === 'cave') {
      /* 채광방(POI: Cave) — PLAN 12절 "희귀 광석" 을 문 하나로 꺼낸다.
         광맥을 캐면(우물과 같은 손짓) 세공 재료가 확정으로 둘 나온다 —
         행상에서 사는 것보다 후하게(우물의 회복량 40% 만큼 후한 셈이다) */
      room.vein = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
      if (Math.random() < 0.35) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'merchant') {
      /* 행상(POI: Merchant, PLAN 12절 "랜덤 상인") — 지나가는 길에 만난다.
         본영의 행상(vendor.js)과는 따로다 — 그쪽은 "회차가 끝나야 재고가
         새로 온다" 는 규칙이 있어 던전 안에서 함부로 같이 쓰면 그 규칙이
         깨진다. 대신 이 자리에서만 파는 재고를 셋 굴린다(한 번뿐이다). */
      room.merchant = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, used: false };
      if (Math.random() < 0.15) { room.enemies.push(spawnEnemy(floor, false)); }
    } else if (kind === 'puzzle') {
      /* 퍼즐방(POI: Puzzle) — 제단 셋을 **맞는 순서**로 밟는다(원작에도 있는
         "손잡이 셋" 류 장치). 순서는 방마다 새로 섞는다 — 틀리면 처음부터
         (벌은 없다, 몸이 아니라 머리로 푸는 방이라 몸싸움을 안 섞었다) */
      var order = [0, 1, 2];
      for (var pi = order.length - 1; pi > 0; pi--) {
        var pj = Math.floor(Math.random() * (pi + 1));
        var tmp = order[pi]; order[pi] = order[pj]; order[pj] = tmp;
      }
      room.puzzle = {
        pods: [
          { x: ROOM_W * 0.55, y: ROOM_H * 0.28, idx: 0, lit: false },
          { x: ROOM_W * 0.72, y: ROOM_H * 0.5,  idx: 1, lit: false },
          { x: ROOM_W * 0.55, y: ROOM_H * 0.72, idx: 2, lit: false }
        ],
        order: order, progress: 0, solved: false
      };
    } else if (kind === 'event') {
      /* 이벤트방(POI: Event, PLAN 35절 "NPC Rescue") — 잡혀 있는 이를
         구한다. 지키는 잡졸을 다 치우면 풀려나 은사를 하나 갚는다(고르지
         않고 바로 얹는다 — 사당과 다르게 "받은 은혜" 라 고를 처지가
         아니다) + 노획물도 조금. Monster Ambush·Elite Monster·Merchant·
         Shrine·Mini Boss 는 PLAN 35절에도 같이 있지만 이미 다른 POI 로
         있으므로(elite·miniboss·merchant·shrine·fight) 여기서 새로 만든
         것은 이 구출뿐이다. */
      n = Math.min(6, 2 + Math.floor(Math.random() * 3) + Math.min(2, Math.floor(floor / 6)));
      for (var evi = 0; evi < n; evi++) { room.enemies.push(spawnEnemy(floor, false)); }
      room.captive = { x: ROOM_W * 0.72, y: ROOM_H * 0.5, freed: false };
    } else if (kind === 'forage') {
      /* 채집·낚시방(POI: Forage, PLAN 12절 "채집"·"낚시 가능한 지역") —
         사용자가 2026-08-30에 직접 요청해 넣었다. 사가마을(생활 시뮬 모방)
         이 이미 낚시·채집을 담당하고 있어 처음엔 이 판(원작 모방)엔
         안 맞다고 봤는데, 뜻이 분명해 넣었다 — 대신 **이 판의 결로**
         옮긴다: 밭을 갈지 않고 낚싯대를 들지 않는다. 약초 셋은 **항아리와
         같은 손짓**(지나가며 스치면 단약이 뜬다 — `dropPotion` 을 그대로
         쓴다)이고, 못은 **우물·사당과 같은 손짓**(방을 다 치운 뒤 한 번,
         "손맛" 하나) 이다. 새 재료·인벤 칸을 만들지 않았다 — 이미 있는
         드랍 셋(potion·mat·gold·item)만 쓴다. */
      room.forage = {
        herbs: [
          { x: ROOM_W * 0.30, y: ROOM_H * 0.30, picked: false },
          { x: ROOM_W * 0.50, y: ROOM_H * 0.68, picked: false },
          { x: ROOM_W * 0.66, y: ROOM_H * 0.32, picked: false }
        ],
        pond: { x: ROOM_W * 0.80, y: ROOM_H * 0.62, used: false }
      };
      if (Math.random() < 0.25) { room.enemies.push(spawnEnemy(floor, false)); }
    }
    if (!room.enemies.length) { room.cleared = true; }
    room.last = index >= total - 1;
    room.decor = makeDecor(kind, floor, index);
    return room;
  }

  /**
   * 방 장식 — 기둥 · 횃불 · 균열. 통과에는 영향이 없고 눈으로만 쓴다
   * (충돌까지 넣으면 좁은 방에서 길이 막히는 사고가 난다).
   */
  function makeDecor(kind, floor, index) {
    var out = [], i;
    var cols = 2 + Math.floor(Math.random() * 3);
    for (i = 0; i < cols; i++) {
      out.push({
        t: 'pillar',
        x: ROOM_W * (0.22 + Math.random() * 0.6),
        y: ROOM_H * (0.18 + Math.random() * 0.64)
      });
    }
    var torches = kind === 'boss' ? 4 : 2;
    for (i = 0; i < torches; i++) {
      out.push({
        t: 'torch',
        x: WALL + 8 + (ROOM_W - WALL * 2 - 16) * ((i + 0.5) / torches),
        y: WALL - 4,
        seed: Math.random() * 6.28
      });
    }
    /* 항아리 — 원작에서 방마다 널려 있고, 부수면 뭔가 나온다.
       "지나가며 다 깨는" 그 손버릇이 원작의 리듬이다 */
    var jn = DD.JARS.min + Math.floor(Math.random() * (DD.JARS.max - DD.JARS.min + 1));
    for (i = 0; i < jn; i++) {
      out.push({
        t: 'jar', broken: false,
        x: WALL + 24 + Math.random() * (ROOM_W - WALL * 2 - 48),
        y: WALL + 24 + Math.random() * (ROOM_H - WALL * 2 - 48),
        seed: Math.random() * 6.28
      });
    }
    /* 함정(dg:spikes) — `dungeon3d.js`의 `buildClutter`가 방 네 귀퉁이에
       세우는 잡동사니 중 하나다(순수 장식으로 시작했다). 그림과 어긋나지
       않도록 **같은 계산을 그대로 되풀이**해 자리를 맞춘다(seed·귀퉁이
       좌표·해시 다 동일) — 여기서만 그중 '가시'를 판정으로 집어낸다.
       2026-09-04: 밟으면 실제로 아프게(사용자 결정) — 새 공식을 만들지
       않고 독(毒) dot 그대로(`applyElem`과 같은 패턴, update() 참고). */
    var F3 = global.DG.field3d;
    if (F3) {
      var clSeed = F3.seedOf(floor, index, 'clutter');
      var CLUTTER_KIND = ['dg:barrel', 'dg:crate', 'dg:crates', 'dg:chair', 'dg:shield', 'dg:spikes'];
      var corners = [[50, 50], [ROOM_W - 50, 50], [50, ROOM_H - 50], [ROOM_W - 50, ROOM_H - 50]];
      for (i = 0; i < corners.length; i++) {
        var ch = (clSeed + i * 2654435761) >>> 0;
        if (ch % 5 < 3) { continue; }               // 다섯 중 셋은 비워 둔다 — buildClutter와 동일
        if (CLUTTER_KIND[ch % CLUTTER_KIND.length] !== 'dg:spikes') { continue; }
        out.push({ t: 'spike', x: corners[i][0], y: corners[i][1], r: 30, cd: 0 });
      }
    }
    var cracks = 2 + Math.floor(Math.random() * 3);
    var crackList = [];
    for (i = 0; i < cracks; i++) {
      var cr = {
        t: 'crack',
        x: ROOM_W * (0.15 + Math.random() * 0.7),
        y: ROOM_H * (0.2 + Math.random() * 0.6),
        a: Math.random() * 3.14,
        len: 18 + Math.random() * 34
      };
      out.push(cr);
      crackList.push(cr);
    }
    /* 비밀(POI: Secret) — 문에 안 뜨고 숨어 있다. 겉보기엔 여느 균열과
       똑같다 — **닿아 봐야 안다**(그래서 room.decor 항목에 얹지, 문
       목록엔 아예 없다). 방마다 8% 확률로 균열 하나가 사실은 숨은 틈이다.
       보스방은 뺀다(정신없는 싸움 중에 발밑을 뒤질 계제가 아니다).
       **`Math.random()` 을 안 쓴다** — 여기서 하나 더 뽑으면 이 뒤로 도는
       모든 굴림(전리품 등급·원소 접사…)이 한 칸씩 밀린다. 자가진단이
       던전을 3000틱 자동으로 돌리는 항목이 있어(다른 방을 수백 번 만든다),
       그 밀림이 한참 뒤 엉뚱한 테스트(원소 접사 값)까지 흔드는 걸 실제로
       겪었다 — 대신 층·방 번호로만 결정되는 순수 해시(`core.hash2`)를
       쓴다(자리를 옮기지 않는 층 테마·바닥 무늬와 같은 요령). */
    if (kind !== 'boss' && crackList.length) {
      var secRoll = core.hash2((floor || 0) * 131 + (index || 0) * 7, crackList.length * 29 + 3);
      if (secRoll < 0.08) {
        var pickH = core.hash2((floor || 0) * 131 + (index || 0) * 7 + 1, crackList.length * 29 + 11);
        var sc = crackList[Math.min(crackList.length - 1, Math.floor(pickH * crackList.length))];
        sc.secret = true;
        sc.found = false;
      }
    }
    return out;
  }

  api = { bind: bind, pickRoomKind: pickRoomKind, makeRoom: makeRoom };
  global.DG = global.DG || {};
  global.DG.dungeonRoom = api;
})(typeof window !== 'undefined' ? window : this);
