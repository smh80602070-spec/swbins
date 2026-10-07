  /* ── 숲 NPC(PLAN 40절 PHASE 4 NPC 칸) ─────────────────────────
   * 이미 세운 지형지물마다 한 명씩 고정으로 세운다(PLAN 10절). 움직이지
   * 않으므로 animal.js 같은 매 프레임 갱신이 필요 없다 — 여기서 자리만
   * 한 번 정한다.
   */
  function npcAt(kind, x, y) { return { id: 'npc_' + kind, kind: kind, x: x, y: y, facing: 1 }; }

  function buildNpcs() {
    npcs = [];
    var cs = caveSpot();
    if (cs) {
      npcs.push(npcAt('keeper', cs.tx * TILE + TILE * 0.5, (cs.ty + 3) * TILE + TILE * 0.5));
    }
    var lc = lakeCenter();
    if (lc) {
      npcs.push(npcAt('angler', lc.tx * TILE + TILE * 0.5, (lc.ty - lc.r - 2) * TILE + TILE * 0.5));
    }
    var hs = hamletSpot();
    if (hs) {
      npcs.push(npcAt('merchant', hs.tx * TILE + TILE * 0.5 - TILE * 0.2, hs.ty * TILE + TILE * 0.5 - TILE * 1.3));
    }
    var wf = waterfallSpot();
    if (wf) {
      var ety = wf.ty - 4;
      var ecx = riverCenterX(ety);
      if (ecx !== null) {
        npcs.push(npcAt('explorer', (ecx + RIVER_HALF_W + 2.2) * TILE + TILE * 0.5, ety * TILE + TILE * 0.5));
      }
    }
    var hb = firstBiomeSpot('mushroom');
    if (hb) {
      npcs.push(npcAt('herbalist', hb.tx * TILE + TILE * 0.5, hb.ty * TILE + TILE * 0.5));
    }
    /* 나그네(2026-09-10) — 두 번째 캠프(hamlet2Spot)에 처음 세우는 사람.
       buildProps() 의 hamlet2House 바로 앞(남쪽으로 0.6칸)에 세운다 —
       merchant 가 hamletHouse 앞에 서는 것과 같은 자리 잡기 */
    var hs2 = hamlet2Spot();
    if (hs2) {
      npcs.push(npcAt('wanderer', hs2.tx * TILE + TILE * 0.5 + TILE * 0.2, hs2.ty * TILE + TILE * 0.5 - TILE * 1.0));
    }
    /* 배달원(2026-09-11, PLAN 45절) — 우주기지(spaceBaseSpot) 한복판에 선다.
       다른 여섯과 같은 자리 배치 방식(npcAt), 다른 점은 QUESTS가 아니라
       talkNpc() 의 courier 특수 분기 + interact() 의 pickupParcel() 을 탄다 */
    var sb = spaceBaseSpot();
    if (sb) {
      npcs.push(npcAt('courier', sb.tx * TILE + TILE * 0.5, sb.ty * TILE + TILE * 0.5 + TILE * 0.4));
    }
  }

  /**
   * 부탁 하나가 끝났는지(PLAN 19절 "미니 퀘스트") — 데이터의 type 셋만
   * 안다. 새 사물·자원을 위한 새 type 을 늘리지 않는다(PLAN 19절 "복잡한
   * 시스템은 필요 없다").
   *   bagcat  가방의 그 갈래 합계가 count 이상
   *   meetnpc 나(자신 뺀) 숲 NPC를 count 명 이상 만나 봤나
   *   chest   동굴 보물을 count 개 이상 열어 봤나
   */
  function questProgress(kind) {
    var q = VD.QUESTS[kind];
    if (!q) { return null; }
    var s = st();
    var have = 0;
    if (q.type === 'bagcat') { have = bagCatCount(q.cat); }
    else if (q.type === 'chest') { have = Object.keys(s.caveOpened || {}).length; }
    else if (q.type === 'meetnpc') {
      have = 0;
      for (var k in (s.metNpcs || {})) {
        if (Object.prototype.hasOwnProperty.call(s.metNpcs, k) && k !== kind && s.metNpcs[k]) { have++; }
      }
    }
    return { have: have, need: q.count, done: !!(s.quests || {})[kind] };
  }

  /** 숲 NPC에게 말을 건다(PLAN 17절·40절 PHASE 4 "Quest"). 다섯 다 데이터
   *  하나(VD.QUESTS)로 정해 둔 부탁이 하나씩 있다 — 아직 안 끝났으면 그
   *  부탁을, 끝났으면 원래 인사말을 돌려준다. 만나 본 적을 남겨야
   *  explorer(탐험가)의 "다 만나 봤나" 부탁을 셀 수 있다. */
  /** NPC 인사말 — 하트 5 해제 "고유 대화"(§5.4 HEART_UNLOCKS)면 `def.uniq`
   *  셋 중 하루 단위로 고정된 하나를, 아니면 평소 `def.line`을 돌려준다. */
  function npcLine(npc, def) {
    if (def.uniq && def.uniq.length && heartOf(npc.id) >= heartUnlockAt('고유 대화')) {
      var i = Math.floor(core.hash2(idNum(npc.id), st().day) * def.uniq.length) % def.uniq.length;
      return def.uniq[i];
    }
    return def.line;
  }

  function talkNpc(npc) {
    var def = VD.NPCS[npc.kind];
    if (!def) { return null; }
    var s = st();
    if (!s.metNpcs) { s.metNpcs = {}; }
    if (!s.metNpcs[npc.kind]) {
      s.metNpcs[npc.kind] = true;
      core.persist();
    }
    /* 하트(PLAN §5.4) "대화" +1 — 주민과 같은 결로, 오늘 이 NPC와 처음
       말을 건 것이면 한 번만. NPC 일곱도 "주민 5 + NPC 7" 중 하나다 —
       지금까지는 이 대화 자리에서만 하트가 오르고(부탁 완수는 아래),
       선물은 아직 못 준다(§10 열린 질문 감). */
    var hr0 = heartRec(npc.id);
    if (hr0.lastTalk !== s.day) { hr0.lastTalk = s.day; bumpHeart(npc.id, 1); }
    /* 배달원(PLAN 45절, 2026-09-11)은 QUESTS 표가 없는 유일한 NPC라 아래
       일반 흐름(한 번뿐인 부탁)을 안 타고 여기서 갈라진다 — talkCourier() 참고 */
    /* 택배 사슬(PLAN §5.7) — 소포가 이 사람(상인·나그네)에게 가는 것이면 부탁 대신 배달을 받는다 */
    if (npc.kind !== 'courier' && global.DG.parcel && s.delivery && s.delivery.carrying) {
      var dr = global.DG.parcel.deliverToNpc(npc, def.name);
      if (dr) { bumpHeart(npc.id, 2); return dr; }
    }
    if (npc.kind === 'courier') { return talkCourier(); }
    var q = VD.QUESTS[npc.kind];
    if (!q) { return { kind: 'talk', name: def.name, text: npcLine(npc, def) }; }
    if (!s.quests) { s.quests = {}; }
    if (s.quests[npc.kind]) { return { kind: 'talk', name: def.name, text: npcLine(npc, def) }; }
    var prog = questProgress(npc.kind);
    if (prog.have < prog.need) {
      return { kind: 'quest', name: def.name,
        text: q.description + ' (' + prog.have + '/' + prog.need + ')' };
    }
    s.quests[npc.kind] = true;
    core.save.player.gold += q.reward;
    bumpHeart(npc.id, 2);   // 부탁 완수 — 주민과 같은 결(PLAN §5.4)
    core.gainFeat(1, '부탁');
    core.gainExp(12);
    core.log('🧭 ' + def.name + '의 부탁 「' + q.title + '」을 마쳤다 — 🪙 ' + core.fmt(q.reward), 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'quest', name: def.name,
      text: '「' + q.title + '」을 마쳤다! 🪙 ' + core.fmt(q.reward) };
  }

  /** 배달원과의 대화(PLAN 45절, 2026-09-11) — 소포가 없으면 심부름만 알려
   *  주고, 있으면 받고 보상을 준다. **무제한 반복**(사용자가 고른 세
   *  결정 중 하나) — s.quests 같은 "한 번뿐" 플래그가 없다, s.delivery
   *  하나로만 오간다(가방·item 카테고리를 새로 안 늘렸다 — PLAN 19절
   *  "복잡한 시스템은 안 만든다"). */
  var DELIVERY_REWARD = core.tuned('delivery.reward', 220);
  function talkCourier() {
    var def = VD.NPCS.courier;
    var s = st();
    if (!s.delivery) { s.delivery = { carrying: false, n: 0 }; }
    if (!s.delivery.carrying) {
      return { kind: 'talk', name: def.name,
        text: heartOf('npc_courier') >= heartUnlockAt('고유 대화')
          ? npcLine({ id: 'npc_courier' }, def)
          : '아직 소포가 없구먼 — 마을 택배 접수대에서 받아 오게' };
    }
    /* 택배 사슬(PLAN §5.7) — 소포 종류·거리·사슬 보상은 parcel.js 가 계산한다. 이 아래는 그 파일이 없을 때의 옛 흐름 */
    var PC = global.DG.parcel;
    if (PC) {
      var pr = PC.deliver('space', def.name);
      if (pr && pr.kind === 'quest') { bumpHeart('npc_courier', 2); }
      return pr;
    }
    s.delivery.carrying = false;
    s.delivery.n = (s.delivery.n || 0) + 1;
    core.save.player.gold += DELIVERY_REWARD;
    bumpHeart('npc_courier', 2);   // 배달 완수 — 부탁 완수와 같은 결(PLAN §5.4)
    core.gainFeat(1, '배달');
    core.gainExp(10);
    core.log('📦 ' + def.name + '에게 소포를 전했다 — 🪙 ' + core.fmt(DELIVERY_REWARD) +
      ' (누적 ' + s.delivery.n + '건)', 'good');
    checkTasks();
    core.emit('changed');
    core.persist();
    return { kind: 'quest', name: def.name,
      text: '소포 잘 받았네! 🪙 ' + core.fmt(DELIVERY_REWARD) + ' (누적 ' + s.delivery.n + '건)' };
  }

  /** 택배 접수대(마을 안, courierPost) — 소포가 없을 때만 하나 내준다.
   *  이미 들고 있으면 배달원에게 먼저 갖다 주라고 한다 — 한 번에 하나씩,
   *  무제한 반복 */
  function pickupParcel(kind, dest) {
    var s = st();
    if (!s.delivery) { s.delivery = { carrying: false, n: 0 }; }
    if (s.delivery.carrying) {
      return { kind: 'no', text: '이미 소포를 갖고 있습니다 — 먼저 가져다 주세요' };
    }
    /* 택배 사슬(PLAN §5.7) — 접수대는 소포 셋(보통·깨지기·시간제한) 중 하나를 고르는 시트를 연다.
       종류를 넘기면 그 소포를 곧바로 받는다(시트의 버튼·진단) */
    var PC = global.DG.parcel;
    if (PC) {
      if (kind) { return PC.take(kind, dest); }
      core.emit('village:open', 'parcel');
      return { kind: 'open', text: '택배 접수대', place: 'parcel' };
    }
    s.delivery.carrying = true;
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: '택배 접수대', text: '📦 소포를 받았다 — 배달원에게 가져다 주게' };
  }

  /** 진단·QA 전용 — 지금 소포를 들고 있는지, 몇 건 배달했는지(순수 조회) */
  function deliveryState() {
    var s = st();
    return { carrying: !!(s.delivery && s.delivery.carrying), n: (s.delivery && s.delivery.n) || 0 };
  }

  function init() {
    st();
    buildProps();
    buildResidents();
    buildAnimals();
    buildNpcs();
    if (global.DG.mail) { global.DG.mail.ensureMoveIn(); }
    rollDay();
    if (!st().tasks) { rollTasks(today()); }   // 첫 부팅 — rollDay()가 "오늘=오늘"로 건너뛴 자리
    if (!st().dayMark) { snapshotDayMark(); }
    syncPlanted();
  }

  /**
   * 날이 바뀌었으면 채집물을 되살리고 부탁을 새로 받는다.
   * **이사와 편지도 여기서만 굴린다** — 프레임마다 굴리면 하루가 몇 번씩 지나간다.
   * 부탁을 지우기 **전에** 어제 누구를 도왔는지 먼저 챙긴다(감사장이 거기서 나온다).
   */
  /* ── 오늘의 일과판 (PLAN §5.1, 표준 A·H) ──────────────────────
   * 값을 내는 함수(`counterOf`·`taskList`·`weeklyTaskInfo`)는 세이브를 **읽기만**
   * 한다. 세이브가 바뀌는 곳은 `rollTasks()`(날이 바뀔 때, `rollDay()`가 부른다)
   * 와 `checkTasks()`(진행이 다 찼는지, 채집·선물·기증·잡초·배달 결과 자리마다
   * 한 줄씩 부른다) 둘뿐이다.
   */

  /** 일과 종류별 지금 값 — 전부 **팔아도 줄지 않는 누계**(`caughtCatCount`·
   *  `s.gathered`·`s.giftTotal`·`s.donateTotal`·`s.weedPulled`·`s.delivery.n`) */
  function counterOf(kind, cat) {
    var s = st();
    if (kind === 'gather') { return cat ? caughtCatCount(cat) : (s.gathered || 0); }
    if (kind === 'gatherAny') { return s.gathered || 0; }
    if (kind === 'gift') { return s.giftTotal || 0; }
    if (kind === 'donate') { return s.donateTotal || 0; }
    if (kind === 'weed') { return s.weedPulled || 0; }
    if (kind === 'deliver') { return (s.delivery && s.delivery.n) || 0; }
    if (kind === 'fest') { return global.DG.festival ? global.DG.festival.counter() : 0; }   // 행사날 놀이(PLAN §5.6)
    return 0;
  }

  /** 날이 바뀔 때만 부른다(`rollDay()` 안에서) — 오늘 셋 + 이번 주 하나를 새로 뽑는다.
   *  행사일이면 셋째(탐험) 줄이 그 행사 전용 과제로 바뀐다(§5.1 "행사날은 1줄 고정") */
  function rollTasks(d) {
    var s = st();
    var picks = VD.pickDayTasks(d).slice();
    var ev = VD.eventOf();     // town.js 의 event()와 같은 결 — 날짜 밀기(dayShift)는 아직 안 탄다
    var evTask = VD.eventTaskOf(ev);
    if (evTask) { picks[2] = evTask; }
    var allDoneBefore = s.tasks && s.tasks.list && s.tasks.list.length &&
      s.tasks.list.every(function (t) { return t.done; }) &&
      (!s.tasks.weekly || s.tasks.weekly.done);
    s.tasks = {
      day: d,
      list: picks.map(function (p) {
        return { key: p.key, name: p.name, kind: p.kind, cat: p.cat || null,
          need: p.n, reward: p.reward, base: counterOf(p.kind, p.cat), done: false };
      }),
      week: s.tasks ? s.tasks.week : null,
      weekly: s.tasks ? s.tasks.weekly : null,
      streak: allDoneBefore ? ((s.tasks && s.tasks.streak) || 0) + 1 : 0
    };
    var wk = global.DG.turnip ? global.DG.turnip.week(d) : Math.floor(d / 7);
    if (s.tasks.week !== wk || !s.tasks.weekly) {
      var wp = VD.pickWeekTask(wk);
      s.tasks.week = wk;
      s.tasks.weekly = { key: wp.key, name: wp.name, kind: wp.kind,
        need: wp.n, reward: wp.reward, base: counterOf(wp.kind, null), done: false };
    }
  }

  /** 화면이 보는 오늘 셋 — 진행·완료 여부까지 얹어 순수하게 낸다 */
  function taskList() {
    var s = st();
    if (!s.tasks || !s.tasks.list) { return []; }
    return s.tasks.list.map(function (t, i) {
      var have = Math.max(0, counterOf(t.kind, t.cat) - t.base);
      return { i: i, key: t.key, name: t.name, got: Math.min(have, t.need), need: t.need,
        pct: Math.min(100, Math.round(have / t.need * 100)), done: !!t.done };
    });
  }

  /** 화면이 보는 이번 주 과제 */
  function weeklyTaskInfo() {
    var s = st();
    if (!s.tasks || !s.tasks.weekly) { return null; }
    var w = s.tasks.weekly;
    var have = Math.max(0, counterOf(w.kind, null) - w.base);
    return { key: w.key, name: w.name, got: Math.min(have, w.need), need: w.need,
      pct: Math.min(100, Math.round(have / w.need * 100)), done: !!w.done };
  }

  function applyTaskReward(t) {
    core.save.player.gold += t.reward;
    core.gainFeat(2, '일과');
    core.log('✅ 일과 완료 — ' + t.name + ' · 🪙 +' + core.fmt(t.reward), 'good');
    core.emit('toast', '✅ ' + t.name + ' · 🪙 +' + t.reward);
  }

  /**
   * 진행이 다 찼는지 살핀다 — 채집(bagAdd)·선물(giveGift)·기증(museum.donate)
   * ·잡초(pullWeed)·배달(talkCourier) 결과 자리마다 한 줄씩 부른다.
   */
  function checkTasks() {
    var s = st();
    if (!s.tasks) { return []; }
    var filled = [], i;
    for (i = 0; i < (s.tasks.list || []).length; i++) {
      var t = s.tasks.list[i];
      if (t.done) { continue; }
      if (counterOf(t.kind, t.cat) - t.base >= t.need) { t.done = true; applyTaskReward(t); filled.push(t); }
    }
    var w = s.tasks.weekly;
    if (w && !w.done && counterOf(w.kind, null) - w.base >= w.need) {
      w.done = true; applyTaskReward(w); filled.push(w);
    }
    if (filled.length) { core.emit('changed'); }
    return filled;
  }

  /**
   * 하루 마무리 카드(§5.2, 표준 B)의 재료 — 날이 바뀔 때(`rollDay()`)만 다룬다.
   *   `snapshotDayMark()`  새 하루가 열리자마자 "그 시점" 값을 박아 둔다
   *   위 값과 **오늘 끝난 시점**(다음 rollDay() 첫머리) 값의 차이가 dayLog 다
   */
  function snapshotDayMark() {
    var s = st();
    s.dayMark = {
      gathered: s.gathered || 0,
      gold: core.save.player.gold,
      donated: s.donateTotal || 0,
      friend: JSON.parse(JSON.stringify(s.friend || {})),
      rating: global.DG.town ? global.DG.town.beauty().score : 0
    };
  }

  function buildDayLog(prevDay) {
    var s = st(), mark = s.dayMark;
    if (!mark) { return; }
    var bestId = null, bestUp = 0, id2;
    for (id2 in (s.friend || {})) {
      if (!Object.prototype.hasOwnProperty.call(s.friend, id2)) { continue; }
      var up = (s.friend[id2] || 0) - (mark.friend[id2] || 0);
      if (up > bestUp) { bestUp = up; bestId = id2; }
    }
    s.dayLog = {
      date: prevDay,
      gathered: Math.max(0, (s.gathered || 0) - mark.gathered),
      gold: core.save.player.gold - mark.gold,
      donated: Math.max(0, (s.donateTotal || 0) - mark.donated),
      metId: bestId, metUp: bestUp,
      ratingBefore: mark.rating, ratingAfter: global.DG.town ? global.DG.town.beauty().score : mark.rating,
      shown: false
    };
  }

  /**
   * §5.1 트리거 ① — 침구(요) 상호작용 "오늘을 마친다".
   * **`rollDay()`를 부르지 않는다**(실시간 규칙, PLAN §5.1) — 날짜·과제·
   * 마을은 그대로 두고, 지금까지 쌓인 값만 `buildDayLog()`로 미리 카드에
   * 띄워 본다. 자정이 넘으면 `rollDay()`가 다시 온전한 하루치로 갈아 낸다.
   */
  function sleepNow() {
    buildDayLog(st().day);
    core.persist();
    return { kind: 'sleep', text: '🛌 오늘을 돌아봅니다' };
  }

  /** 화면이 보는 어제 요약 — 아직 안 보여줬으면 true */
  function dayLogPending() { var l = st().dayLog; return !!(l && !l.shown); }
  /** 오늘 첫 일과 미리보기 = "내일 한 가지" */
  function dayLogInfo() {
    var l = st().dayLog;
    if (!l) { return null; }
    var next = taskList()[0];
    return {
      gathered: l.gathered, gold: l.gold, donated: l.donated,
      metId: l.metId, metUp: l.metUp,
      ratingBefore: l.ratingBefore, ratingAfter: l.ratingAfter,
      next: next ? next.name : null
    };
  }
  function dayLogSeen() { var l = st().dayLog; if (l) { l.shown = true; } }

  function rollDay() {
    var s = st(), d = today();
    if (s.day === d) { return false; }

    buildDayLog(s.day);             // 어제가 남긴 값 — 리셋 전에
    var helped = [], gifted = [], written = [], id;
    for (id in s.requests) {
      if (!Object.prototype.hasOwnProperty.call(s.requests, id)) { continue; }
      if (s.requests[id].done) { helped.push(id); }
    }
    for (id in s.gifted) {         // 어제 선물을 받은 사람 — 답례가 거기서 나온다
      if (!Object.prototype.hasOwnProperty.call(s.gifted, id)) { continue; }
      if (s.gifted[id] === s.day) { gifted.push(id); }
    }
    for (id in (s.wrote || {})) {   // 어제 내가 편지를 부친 사람 — 답장이 거기서 나온다
      if (!Object.prototype.hasOwnProperty.call(s.wrote, id)) { continue; }
      if (s.wrote[id] === s.day) { written.push(id); }
    }

    /* 어젯밤에 빈 소원 — **날짜를 갈기 전에** 세어 둔다 */
    var wishes = global.DG.town ? global.DG.town.wishesOn(s.day) : 0;

    s.day = d;
    s.used = {};
    s.requests = {};
    rollTasks(d);                  // 오늘의 일과 3 + 이번 주 과제(§5.1)
    snapshotDayMark();              // 오늘의 마무리 카드(§5.2) 재료 — 오늘이 끝날 때 이 값과 비교한다
    growWeeds();                   // 안 뽑으면 날마다 는다
    buildProps();                  // 갈라진 자리와 조개는 아침마다 자리가 바뀐다
    syncPlanted();                 // 하루가 지났으니 묘목이 자랐을 수 있다

    if (global.DG.mail) {
      var r = global.DG.mail.onNewDay(helped, gifted, written, wishes);
      if (r && r.moved) { buildResidents(); }    // 오가는 사람이 있었으면 자리를 다시 잡는다
    }
    if (global.DG.bug) { global.DG.bug.reset(); }   // 계절·시간대가 바뀌었을 수 있다
    if (global.DG.folk) { global.DG.folk._reset(); }  // 날이 바뀌면 이야기도 새로 뽑는다

    core.log('🌅 날이 밝았습니다 — 마을이 다시 여물었습니다', 'good');
    return true;
  }

  /* ── 걷기 ─────────────────────────────────────────────── */

  /* 2026-09-09 — "키세팅이 있어야겠지"(사가나락와 같은 요청). WASD·방향키는
     그대로 두고(실수로 못 쓰게 되면 안 된다), 방향별로 하나 더 쓸 키만
     고르게 한다. */
  var KEYMAP_DEFAULT = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
  var remapping = null;
  function keymap() {
    var s = core.save && core.save.settings;
    var km = s && s.keymap;
    if (!km) { return KEYMAP_DEFAULT; }
    var out = {}, k;
    for (k in KEYMAP_DEFAULT) { out[k] = km[k] || KEYMAP_DEFAULT[k]; }
    return out;
  }
  function setKeymapKey(action, key) {
    if (!core.save || !core.save.settings) { return; }
    core.save.settings.keymap = keymap();
    core.save.settings.keymap[action] = key;
    core.persist();
  }
  function beginRemap(action) { remapping = action; }

  function bindKeys() {
    global.addEventListener('keydown', function (e) {
      if (remapping) {
        if (e.key !== 'Escape') { setKeymapKey(remapping, e.key.toLowerCase()); }
        remapping = null;
        core.emit('dg:keyremap');
        e.preventDefault();
        return;
      }
      keys[e.key.toLowerCase()] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) {
        if (e.target === document.body) { e.preventDefault(); }
      }
      if (e.key === ' ') { interact(); }
    });
    global.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    global.addEventListener('blur', function () { keys = {}; });
  }

  function walkTo(x, y) { target = { x: x, y: y }; }

  /** 걸을 수 없는 자리에 서 있으면(떠서 물 위에서 내렸을 때 등) 가장 가까운 걸을 수 있는 칸 가운데로 옮긴다 — 옮겼으면 true */
  function snapToLand() {
    if (indoors || caveIn || walkable(player.x, player.y)) { return false; }
    var tx0 = Math.floor(player.x / TILE), ty0 = Math.floor(player.y / TILE), best = null, bd = Infinity, r, tx, ty;
    for (r = 1; r <= 24 && !best; r++) {
      for (ty = ty0 - r; ty <= ty0 + r; ty++) {
        for (tx = tx0 - r; tx <= tx0 + r; tx++) {
          if (Math.max(Math.abs(tx - tx0), Math.abs(ty - ty0)) !== r) { continue; }
          var cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
          if (!walkable(cx, cy)) { continue; }
          var d = Math.hypot(cx - player.x, cy - player.y);
          if (d < bd) { bd = d; best = { x: cx, y: cy }; }
        }
      }
    }
    if (!best) { return false; }
    player.x = best.x; player.y = best.y; target = null;
    return true;
  }

  /* 2026-09-09 — 가상 조이스틱(village-view.js #vjoy). walkTo(절대 좌표)는
     화면을 계속 눌러 끄는 예전 조작에 맞춰져 있어, 고정 조이스틱처럼
     "이 방향으로 계속" 을 표현할 자리가 없었다. keys(WASD)와 같은 자리에
     방향 벡터 하나만 더 둔다 — 손을 떼면 반드시 (0,0)으로 돌아와야 한다
     (그렇지 않으면 마지막 방향으로 계속 걷는다). */
  var joy = { x: 0, y: 0 };
  function setJoy(dx, dy) { joy.x = dx; joy.y = dy; }

  function update(dt) {
    stepForest(dt);
    var km = keymap();
    var dx = 0, dy = 0;
    if (keys.w || keys.arrowup || keys[km.up]) { dy -= 1; }
    if (keys.s || keys.arrowdown || keys[km.down]) { dy += 1; }
    if (keys.a || keys.arrowleft || keys[km.left]) { dx -= 1; }
    if (keys.d || keys.arrowright || keys[km.right]) { dx += 1; }
    if (!(dx || dy) && (joy.x || joy.y)) { dx = joy.x; dy = joy.y; }
    if (dx || dy) {
      target = null;
      /* 3D 가 켜져 있으면 키·조이스틱을 카메라 방위만큼 돌린다(2026-09-28, 실기 보고 Q12 — 사가만리 Q1 과 같은 처방).
         오른쪽 끌기로 시점을 돌린 뒤에도 W 는 화면 안쪽, D 는 화면 오른쪽이다. az 0 이면 예전 그대로 */
      var VV3 = global.DG.villageView3d;
      if (VV3 && VV3.camAz && VV3.active && VV3.active()) {
        var az = VV3.camAz(), ca = Math.cos(az), sa = Math.sin(az), rx = ca * dx + sa * dy;
        dy = -sa * dx + ca * dy; dx = rx;
      }
    }
    else if (target) {
      var tx = target.x - player.x, ty = target.y - player.y;
      var td = Math.sqrt(tx * tx + ty * ty);
      if (td < 4) { target = null; }
      else { dx = tx / td; dy = ty / td; }
    }

    player.walking = !!(dx || dy);
    if (player.walking) {
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      /* 살금살금이면 느리다. 그 대신 벌레가 달아나지 않는다 (bug.js).
         벌에 쏘인 날은 하루 종일 걸음이 무겁다 */
      var MTv = global.DG.mount, flyOn = !!(MTv && MTv.flying && MTv.flying());
      var sp = SPEED * (sneaking() ? 0.42 : 1) *
               (global.DG.bug && global.DG.bug.stung() ? 0.8 : 1) * speedMul() * (MTv && MTv.speedMul ? MTv.speedMul() : 1);   // 탈것 배율(mount.js)
      var nx = player.x + (dx / len) * sp * dt;
      var ny = player.y + (dy / len) * sp * dt;
      /* 축마다 따로 막는다 — 벽을 스치며 걸을 수 있게. 떠서 가는 탈것(학·용)은 물·나무 칸을 넘는다(마을 둘레 EDGE_TILES 칸 안) */
      if (walkable(nx, player.y) || (flyOn && MTv.canFly(nx, player.y))) { player.x = nx; }
      if (walkable(player.x, ny) || (flyOn && MTv.canFly(player.x, ny))) { player.y = ny; }
      if (dx) { player.facing = dx > 0 ? 1 : -1; } player.dirX = dx; player.dirY = dy;   // 2D 앞·뒤 모습(W-0073)
      player.phase += dt * 7;
    }
    /* 집 안에서는 마을이 돌지 않는다 — 주민도 벌레도 낚시도 밖의 일이다 */
    if (indoors) { return; }

    if (global.DG.bug) { global.DG.bug.update(dt); }
    if (global.DG.spirit && !indoors) { global.DG.spirit.tick(dt); }   // 숨죽임 수수께끼(PLAN §5.5)
    if (global.DG.parcel) { global.DG.parcel.tick(dt); }                // 깨지기 소포(PLAN §5.7)
    if (global.DG.festival) { global.DG.festival.tick(dt); }            // 꽃놀이·줄다리기 시간(PLAN §5.6)
    /* 주민의 거동과 잡담은 folk.js 가 맡는다.
       **멀리 걷지는 않는다** — 제 자리 둘레만 돈다. 멀리 가면 부탁을 들어주려고
       사람을 찾아 헤매게 된다 */
    if (global.DG.folk) { global.DG.folk.update(dt); }
    /* 짐승의 어슬렁·달아남은 animal.js 가 맡는다 — 마을 밖에서도 계속 돈다 */
    if (global.DG.animal) { global.DG.animal.update(dt); }

    /* 낚시터에서 멀어지면 줄이 끊긴다 (걷는 중인지와 무관하게 거리로만 본다) */
    if (fishing) {
      var pr = null, i;
      for (i = 0; i < props.length; i++) { if (props[i].id === fishing.propId) { pr = props[i]; } }
      if (pr && Math.hypot(pr.x - player.x, pr.y - player.y) > REACH * 1.4) {
        fishing = null;
        core.emit('village:fish', { state: 'miss' });
      }
    }
    tickFish();
  }

  /* ── 손이 닿는 것 ─────────────────────────────────────── */

  /**
   * 지금 상호작용할 수 있는 것 하나.
   * 밖에서는 **벌레가 가장 앞선다** — 달아나기 전에 손이 가야 하기 때문이다.
   * 그 다음이 사물, 그 다음이 주민.
   * 집 안에서는 가구와 문만 본다.
   */
  function focus() {
    var i, d;

    if (caveIn) {
      var dr3 = caveDoor();
      var best3 = null, bd3 = REACH;
      var chests = caveChests();
      for (i = 0; i < chests.length; i++) {
        d = Math.hypot(chests[i].x - player.x, chests[i].y - player.y);
        if (d < bd3) { bd3 = d; best3 = { type: 'chest', obj: chests[i], dist: d }; }
      }
      d = Math.hypot(dr3.x - player.x, dr3.y - player.y);
      if (d < bd3) { best3 = { type: 'cavedoor', obj: dr3, dist: d }; }
      return best3;
    }

    if (indoors) {
      var H = global.DG.home;
      var dr = H.door();
      var best2 = null, bd2 = REACH;
      var items = H.state().items;
      for (i = 0; i < items.length; i++) {
        d = Math.hypot(items[i].x - player.x, items[i].y - player.y);
        if (d < bd2) { bd2 = d; best2 = { type: 'furn', obj: items[i], dist: d }; }
      }
      d = Math.hypot(dr.x - player.x, dr.y - player.y);
      if (d < bd2) { best2 = { type: 'door', obj: dr, dist: d }; }
      return best2;
    }

    if (global.DG.bug) {
      var b = global.DG.bug.nearest(player.x, player.y);
      if (b) {
        return { type: 'bug', obj: b,
                 dist: Math.hypot(b.x - player.x, b.y - player.y) };
      }
    }

    var best = null, bd = REACH;
    for (i = 0; i < props.length; i++) {
      if (props[i].deco) { continue; }    // 숲 고리 장식(PLAN 40절 PHASE 3) — 손이 안 닿는다
      d = Math.hypot(props[i].x - player.x, props[i].y - player.y);
      if (d < bd) { bd = d; best = { type: 'prop', obj: props[i], dist: d }; }
    }
    for (i = 0; i < residents.length; i++) {
      d = Math.hypot(residents[i].x - player.x, residents[i].y - player.y);
      if (d < bd) { bd = d; best = { type: 'resident', obj: residents[i], dist: d }; }
    }
    /* 숲 NPC(PLAN 40절 PHASE 4 Interaction 칸) — 마을 주민과 같은 REACH,
       같은 focus() 한 자리를 쓴다. InteractionManager 를 새로 만들지 않고
       이 표에 한 줄만 보탠 것이 PLAN 35절이 말하는 "오브젝트마다 딴 이벤트
       코드를 안 만든다" 그 자체다 */
    for (i = 0; i < npcs.length; i++) {
      d = Math.hypot(npcs[i].x - player.x, npcs[i].y - player.y);
      if (d < bd) { bd = d; best = { type: 'npc', obj: npcs[i], dist: d }; }
    }
    /* 떠돌이 방문객(PLAN §5.9, visitor.js) — 숲 NPC 와 같은 자리(type 'npc')로 잡힌다. obj.visitor 로 가른다 */
    var vis = global.DG.visitor ? global.DG.visitor.list() : [];
    for (i = 0; i < vis.length; i++) {
      d = Math.hypot(vis[i].x - player.x, vis[i].y - player.y);
      if (d < bd) { bd = d; best = { type: 'npc', obj: vis[i], dist: d }; }
    }
    return best;
  }

  /** 그 사물을 오늘 이미 썼나 */
  function spent(prop) {
    var def = VD.PROPS[prop.kind];
    if (!def || !def.gather) { return false; }
    if (!def.reset) { return false; }          // 낚시터는 몇 번이든
    return st().used[prop.id] === st().day;
  }

  function bagAdd(item, n) {
    var s = st();
    s.bag[item.key] = (s.bag[item.key] || 0) + (n || 1);
    s.gathered += (n || 1);
    /* 도감 — 한 번이라도 손에 넣은 것은 여기 남는다 (팔아도 지워지지 않는다) */
    if (!s.caught) { s.caught = {}; }
    s.caught[item.key] = (s.caught[item.key] || 0) + (n || 1);
    checkTasks();   // 오늘의 일과(§5.1) — "채집" 축은 여기 한 곳으로 다 지나간다
  }

  /** 이 종류를 잡아 본 적이 있나 (도감) */
  function caughtCount(key) { return (st().caught || {})[key] || 0; }

  function bagCount(key) { return st().bag[key] || 0; }

  /** 가방 안 한 갈래(cat)의 합계 — 낱개 종류를 안 가리고 센다(퀘스트 "꽃 5개" 같은 데 쓴다) */
  function bagCatCount(cat) {
    var list = VD.ITEMS[cat], n = 0, i;
    if (!list) { return 0; }
    for (i = 0; i < list.length; i++) { n += bagCount(list[i].key); }
    return n;
  }

  /** `bagCatCount`와 달리 **팔아도 줄지 않는다** — 일과 진행은 늘 앞으로만 가야
   *  한다(§5.1). `s.caught`(도감, 잡아 본 적이 있으면 남는다)를 센다 */
  function caughtCatCount(cat) {
    var list = VD.ITEMS[cat], n = 0, i, s = st();
    if (!list) { return 0; }
    for (i = 0; i < list.length; i++) { n += (s.caught && s.caught[list[i].key]) || 0; }
    return n;
  }

  function bagList() {
    var s = st(), out = [], k;
    for (k in s.bag) {
      if (!Object.prototype.hasOwnProperty.call(s.bag, k) || !s.bag[k]) { continue; }
      var it = VD.item(k);
      if (it) { out.push({ item: it, n: s.bag[k] }); }
    }
    out.sort(function (a, b) { return b.item.price - a.item.price; });
    return out;
  }

  /* ── 낚시 ─────────────────────────────────────────────────
   * 낚시터만은 하루 몫이 없다(`reset: 0`). 그래서 즉시 획득으로 두면
   * **자동이 낚시터 하나를 무한히 반복한다** — 실제로 그랬다.
   * 원작처럼 찌를 던지고 **입질을 기다렸다 당기는** 것으로 바꿨다.
   * 시간이 드니 수확이 정상 범위로 내려오고, 손으로 할 때도 할 일이 된다.
   *
   *   던진다 → 1.2~3.5초 뒤 입질 → 0.7초 안에 당기면 잡는다
   *   성급하면 놓치고, 늦어도 놓친다
   */

  var CAST_MIN = core.tuned('fish.castMin', 1200);
  var CAST_VAR = core.tuned('fish.castVar', 2300);
  var BITE_WINDOW = core.tuned('fish.biteWindow', 700);

  var fishing = null;      // { propId, biteAt, ends }

  function fishState() {
    if (!fishing) { return null; }
    var now = Date.now();
    return {
      propId: fishing.propId,
      state: now < fishing.biteAt ? 'wait' : (now <= fishing.ends ? 'bite' : 'late'),
      leftMs: Math.max(0, fishing.ends - now)
    };
  }

  function castLine(prop) {
    fishing = { propId: prop.id, biteAt: Date.now() + CAST_MIN + Math.random() * CAST_VAR, ends: 0 };
    fishing.ends = fishing.biteAt + BITE_WINDOW;
    core.emit('village:fish', { state: 'cast' });
    return { kind: 'cast', text: '🎣 찌를 던졌다 — 입질을 기다린다' };
  }

  /** 당긴다. 입질 창 안이면 잡는다 */
  function hookLine() {
    if (!fishing) { return null; }
    var now = Date.now();
    var early = now < fishing.biteAt;
    var late = now > fishing.ends;
    fishing = null;
    if (early) {
      core.emit('village:fish', { state: 'miss' });
      return { kind: 'miss', text: '성급했다 — 물고기가 달아났다' };
    }
    if (late) {
      core.emit('village:fish', { state: 'miss' });
      return { kind: 'miss', text: '늦었다 — 놓쳤다' };
    }
    var got = VD.pick('fish');
    if (!got) { return null; }
    bagAdd(got, 1);
    core.gainFeat(1, '낚시');
    core.gainExp(8);
    core.log(got.emoji + ' ' + got.name + ' 을 낚았다', 'good');
    core.emit('village:fish', { state: 'catch', item: got });
    core.emit('changed');
    core.persist();
    return { kind: 'gather', text: got.emoji + ' ' + got.name + ' ×1', item: got };
  }

  /** 시간이 지나 입질을 놓쳤으면 줄을 거둔다 (update 가 부른다) */
  function tickFish() {
    if (!fishing) { return; }
    if (Date.now() > fishing.ends + 400) {
      fishing = null;
      core.emit('village:fish', { state: 'miss' });
      core.emit('toast', '🎣 입질을 놓쳤다');
    }
  }

  /** 채집 손맛 표준 C(§5.8①) "연속 채집 3회마다 리듬 보너스" — 손을 안 쉬고
   *  이어 채집하면(GATHER_GAP 안에 다음 것) 연속이 쌓인다. 시간이 아니라
   *  타이밍을 보는 이유는 손맛 자체(연타/콤보)를 재려는 것이지 "하루에 몇
   *  번"을 재려는 게 아니라서다(그건 §5.1 일과가 이미 한다). */
  var GATHER_GAP = 8000;
  function bumpGatherStreak() {
    var s = st(), now = Date.now();
    s.gatherStreak = (s.gatherStreakAt && now - s.gatherStreakAt <= GATHER_GAP)
      ? (s.gatherStreak || 0) + 1 : 1;
    s.gatherStreakAt = now;
    return s.gatherStreak;
  }

  /**
   * 손을 쓴다 — 사물이면 채집, 주민이면 말을 건다.
   * @returns {{kind, text}} 화면에 띄울 한 줄 (없으면 null)
   */
  function interact() {
    if (global.DG.mount && global.DG.mount.onInteract) { global.DG.mount.onInteract(); }   // 탈것 위에선 손이 안 닿는다 — 먼저 내려앉는다(mount.js)
    var f = focus();
    /* 손에 닿는 것이 없으면 하늘을 본다 — 별똥별이 흐르면 소원을 빈다 */
    if (!f) {
      if (!indoors && global.DG.town && global.DG.town.starNow()) {
        return global.DG.town.wish();
      }
      return null;
    }

    /* 집 안 — 문이면 나가고, 가구면 거둔다 */
    if (f.type === 'door') { return leaveHome(); }
    if (f.type === 'furn') { return global.DG.home.pickUp(f.obj); }

    /* 동굴 안 — 문이면 나가고, 상자면 연다 */
    if (f.type === 'cavedoor') { return leaveCave(); }
    if (f.type === 'chest') { return openChest(f.obj); }

    if (f.type === 'bug') { return global.DG.bug.swing(f.obj); }
    if (f.type === 'resident') { return talk(f.obj); }
    if (f.type === 'npc') { return f.obj.visitor ? global.DG.visitor.talk(f.obj) : talkNpc(f.obj); }

    var prop = f.obj, def = VD.PROPS[prop.kind];
    if (!def) { return null; }
    if (def.gather === 'fish') {
      /* 던져 놓은 줄이 있으면 당기고, 없으면 던진다 */
      if (fishing && fishing.propId === prop.id) { return hookLine(); }
      if (fishing) { fishing = null; }          // 다른 낚시터로 옮기면 줄을 거둔다
      return castLine(prop);
    }
    if (prop.kind === 'sapling') {
      return { kind: 'empty', text: '아직 묘목입니다 — ' + (prop.leftDays || 1) + '일 더' };
    }
    /* 번들 시설(PLAN §5.3) — 시트를 열 게 없는 그냥 구경거리라 sapling 과
       같은 결로 toast 만 띄운다(village:open 을 부르면 ui.js SHEET_TITLE 에
       없는 이름이라 엉뚱하게 "기록" 시트가 열린다) */
    if (prop.kind === 'stele') {
      return { kind: 'empty', text: '🪧 화석을 모두 갖춘 사고를 기려 세운 비석입니다' };
    }
    if (prop.kind === 'rebuilt') {
      return { kind: 'empty', text: '🏯 흩어진 탑성 조각을 다 모아 쌓은 정자입니다 — 폐허의 옛 우체통이 이쪽으로도 편지를 부친다고 합니다' };
    }
    if (prop.kind === 'starpost') {
      var sd = (st().scenario && st().scenario.done) || {};
      return { kind: 'empty', text: sd.y2_bloom
        ? '🌠 별 우체통 — 옛 우체통과 한 쌍이 되어 이어 쌓는 중입니다. 부친 편지에 여러 시대가 답장합니다'
        : '🌠 별 우체통 — 하늘 금이 내려앉은 우체통입니다. 이 마을이 여러 시대에 기억되는 한 사라지지 않는다고 합니다' };
    }
    if (prop.kind === 'fireflyplot') {
      return { kind: 'empty', text: '✨ 낮에는 그저 풀밭이지만, 밤이 되면 반딧불이가 모여든다고 합니다' };
    }
    if (prop.kind === 'spiritmark') { return global.DG.spirit ? global.DG.spirit.interact(prop) : null; }
    if (prop.grid !== undefined) { return global.DG.grid ? global.DG.grid.interact(prop) : null; }
    if (prop.visit !== undefined) { return global.DG.visitor ? global.DG.visitor.pick(prop) : null; }   // 방문객 조각(§5.9)
    if (prop.fest) { return global.DG.festival ? global.DG.festival.interact(prop) : null; }
    if (prop.kind === 'weed') { return pullWeed(prop); }
    if (prop.kind === 'home') { return enterHome(); }
    if (prop.kind === 'cave') { return enterCave(); }
    if (prop.kind === 'courierPost') { return pickupParcel(); }
    if (prop.kind === 'oldpost') {
      var PCO = global.DG.parcel, s0 = st().delivery;
      if (!PCO || !s0 || !s0.carrying) {
        return { kind: 'no', text: '📮 낡은 우체통 — 폐허행 소포를 넣는 곳입니다(접수대에서 받아 오세요)' };
      }
      return PCO.deliver('ruin', '옛 우체통');
    }
    if (prop.kind === 'rover') {
      return { kind: 'empty', text: '🚙 탐사차에 앉아 봤다 — 지평선 너머까지 달릴 수 있을 것 같다(언젠가)' };
    }
    if (!def.gather) {
      if (prop.kind === 'museum') {
        core.emit('village:open', 'museum');
        return { kind: 'open', text: def.name, place: 'museum' };
      }
      if (prop.kind === 'tailor') {
        core.emit('village:open', 'wear');
        return { kind: 'open', text: def.name, place: 'wear' };
      }
      if (prop.kind === 'board' || prop.kind === 'pole') {
        core.emit('village:open', 'town');
        return { kind: 'open', text: def.name, place: 'town' };
      }
      core.emit('village:open', prop.kind);         // 전방·게시판·우편함은 화면이 받는다
      return { kind: 'open', text: def.name, place: prop.kind };
    }
    if (spent(prop)) {
      return { kind: 'empty', text: def.name + '은(는) 오늘 몫을 다 냈습니다' };
    }
    /* 나무는 열매만 내주지 않는다 — 원작처럼 가구·돈주머니·벌집이 섞인다 */
    if (prop.kind === 'tree' || prop.kind === 'pine') {
      var sh = shake(prop, def);
      if (sh) { return sh; }
    }
    /* 도구가 있어야 손이 가는 것 — 갈라진 자리엔 삽이 든다 */
    if (def.tool && !hasTool(def.tool)) {
      var td = VD.TOOLS[def.tool];
      return { kind: 'no', text: td.emoji + ' ' + td.name + ' 이(가) 없습니다 — 전방에서 살 수 있습니다' };
    }
    /* 교배로 핀 꽃은 드문 것을 낸다 */
    var got = (prop.hybrid && def.gather === 'flower') ? VD.pickHybrid() : VD.pick(def.gather);
    if (!got) { return null; }
    var streak = bumpGatherStreak();
    var bonus = streak > 0 && streak % 3 === 0;         // 리듬 보너스 — 3연속마다
    var n = 1 + (Math.random() < 0.25 ? 1 : 0) + (bonus ? 1 : 0) +
            (global.DG.festival && global.DG.festival.gatherBoost() && Math.random() < 0.5 ? 1 : 0);   // 칠석 소원의 답례(PLAN §5.6)
    bagAdd(got, n);
    if (def.reset) { st().used[prop.id] = st().day; }
    core.gainFeat(1, '채집');
    core.gainExp(6);
    core.log(got.emoji + ' ' + got.name + ' ×' + n + ' 을 얻었다 (' + def.name + ')' +
      (bonus ? ' — 🎵 리듬 보너스!' : ''), 'good');
    /* 화면 층(흔들림·팝·효과음, §5.8①)이 듣는 신호 — 판정은 한 줄도 안 바뀐다 */
    core.emit('village:gather', { item: got, n: n, streak: streak, bonus: bonus, propId: prop.id });
    core.emit('changed');
    core.persist();
    return { kind: 'gather', text: got.emoji + ' ' + got.name + ' ×' + n +
      (bonus ? ' 🎵' : ''), item: got, streak: streak, bonus: bonus };
  }

  /* ── 잡초 ─────────────────────────────────────────────────
   * 원작에서 며칠 안 들르면 마을이 잡초로 뒤덮이던 그 자리다.
   * **날마다 는다.** 자리는 세이브에 남으니 뽑기 전에는 사라지지 않는다 —
   * 그래야 "며칠 안 왔구나" 가 눈에 보인다.
   */
  var WEED_MAX = core.tuned('weed.max', 40);
  var WEED_PER_DAY = core.tuned('weed.perDay', 3);   // 하루에 이 수 안에서 난다

  function growWeeds() {
    var s = st();
    if (!s.weeds) { s.weeds = []; }
    var n = 1 + Math.floor(core.hash2(s.day * 13 + 7, s.day % 521) * WEED_PER_DAY);
    for (var k = 0; k < n && s.weeds.length < WEED_MAX; k++) {
      for (var tries = 0; tries < 20; tries++) {
        var h1 = core.hash2(s.day * 31 + k * 97 + tries, s.day % 733 + k);
        var h2 = core.hash2(s.day % 617 + k * 53, s.day * 7 + tries * 11);
        var tx = Math.floor(h1 * W), ty = Math.floor(h2 * H);
        if (tileAt(tx, ty) !== 'grass') { continue; }
        s.weeds.push({ x: tx * TILE + TILE * 0.5, y: ty * TILE + TILE * 0.5 });
        break;
      }
    }
  }

  function pullWeed(prop) {
    var s = st();
    var i = parseInt(prop.id.slice(2), 10);
    if (isNaN(i) || !s.weeds[i]) { return null; }
    s.weeds.splice(i, 1);
    s.weedPulled = (s.weedPulled || 0) + 1;
    buildProps();
    syncPlanted();
    core.gainFeat(1, '잡초');
    checkTasks();
    core.emit('changed');
    core.persist();
    return { kind: 'weed', text: '🌿 잡초를 뽑았다 (남은 것 ' + s.weeds.length + ')' };
  }

  function weedCount() { return (st().weeds || []).length; }

  /* ── 전방이 자란다 ────────────────────────────────────────
   * 원작의 상점이 커지던 그 자리다. **판 금 누계**로 오른다 —
   * 마을을 부지런히 돌수록 전방이 커지고, 커진 전방은 물건이 늘고 값을 더 쳐준다.
   */
  var SHOP_TIERS = [
    { at: 0,      name: '전방',        add: 0, bonus: 1.00 },
    { at: 30000,  name: '저잣거리 전방', add: 1, bonus: 1.04 },
    { at: 120000, name: '상단(商團)',   add: 2, bonus: 1.08 },
    { at: 400000, name: '도가(都家)',   add: 3, bonus: 1.12 }
  ];

  function shopLevel() {
    var g = st().soldGold || 0, t = SHOP_TIERS[0], i;
    for (i = 0; i < SHOP_TIERS.length; i++) { if (g >= SHOP_TIERS[i].at) { t = SHOP_TIERS[i]; } }
    var idx = SHOP_TIERS.indexOf(t);
    return { n: idx, name: t.name, add: t.add, bonus: t.bonus,
             sold: g, next: SHOP_TIERS[idx + 1] || null };
  }

  /* ── 나무 흔들기 ──────────────────────────────────────────
   * 원작에서 나무를 흔들면 열매만 떨어지지 않는다. 가구가 걸리고, 돈주머니가 떨어지고,
   * 재수 없으면 **벌집**이 떨어진다. 그 셋이 있어야 나무 앞에서 손이 망설여진다.
   *
   * 가구와 돈은 **하루 몫이 있다**(가구 둘·돈 하나). 없으면 나무를 도는 것이
   * 곧 돈을 찍는 일이 된다 — 그건 원작도 막아 두었다.
   *
   * 여기는 사람이 누를 때만 도는 자리라 공용 난수를 써도 된다
   * (프레임마다 도는 bug.js·folk.js 와 다르다).
   */
  var SHAKE_BEE = core.tuned('shake.bee', 0.08);
  var SHAKE_FURN = core.tuned('shake.furn', 0.06);
  var SHAKE_GOLD = core.tuned('shake.gold', 0.05);
  var SHAKE_FURN_MAX = core.tuned('shake.furnMax', 2);

  function shake(prop, def) {
    var s = st();
    if (s.shakeDay !== s.day) { s.shakeDay = s.day; s.shakeFurn = 0; s.shakeGold = 0; }
    var r = Math.random();

    if (r < SHAKE_BEE && global.DG.bug) {
      s.used[prop.id] = s.day;                       // 벌집을 건드렸으니 오늘은 끝이다
      global.DG.bug.swarm(prop.x, prop.y);
      core.log('🐝 ' + def.name + ' 에서 벌집이 떨어졌다 — 벌떼가 쫓아온다!', 'warn');
      core.emit('changed');
      return { kind: 'bees', text: '🐝 벌집이다! 달아나거나 채로 받아친다' };
    }

    if (r < SHAKE_BEE + SHAKE_FURN) {
      /* 이 칸에 걸렸는데 하루 몫이 끝났으면 **열매로 떨어진다**.
         다음 칸(돈주머니)으로 흘려보내면 몫이 뒤섞인다 */
      if (s.shakeFurn >= SHAKE_FURN_MAX || !global.DG.home) { return null; }
      s.shakeFurn += 1;
      s.used[prop.id] = s.day;
      var all = VD.FURNITURE.filter(function (x) { return !x.fest; });     // 행사 가구는 놀이로만(PLAN §5.6)
      var f = all[Math.floor(Math.random() * all.length)];
      global.DG.home.stockAdd(f.key, 1);
      core.gainFeat(2, '채집');
      core.log('🪑 ' + def.name + ' 에 걸려 있던 ' + f.name + ' 이(가) 떨어졌다', 'good');
      core.emit('changed');
      core.persist();
      return { kind: 'furn', text: '🪑 ' + f.name + ' 이(가) 떨어졌다 — 창고로' };
    }

    if (r < SHAKE_BEE + SHAKE_FURN + SHAKE_GOLD) {
      if (s.shakeGold) { return null; }
      s.shakeGold = 1;
      s.used[prop.id] = s.day;
      var gold = 300 + Math.floor(Math.random() * 600);
      core.save.player.gold += gold;
      core.gainFeat(2, '채집');
      core.log('🪙 ' + def.name + ' 에서 돈주머니가 떨어졌다 (+' + core.fmt(gold) + ')', 'good');
      core.emit('changed');
      core.persist();
      return { kind: 'gold', text: '🪙 돈주머니! +' + core.fmt(gold) };
    }
    return null;                                     // 여느 때처럼 열매가 떨어진다
  }

  /* ── 주민 ─────────────────────────────────────────────── */

  function friendOf(id) { return st().friend[id] || 0; }

  /**
   * 하트(PLAN §5.4 "관계 하트") — `friend`(친밀도) 는 예전부터 있던 값인데
   * **상한이 없고 화면에 안 보인다**(세배 삯·§5.2 카드가 계속 읽으므로 그건
   * 그대로 둔다). 하트는 그 옆에 두는 **새 0~10 게이지**다 — 하루 상한
   * +4, 해제 문턱(3·5·7·10)이 있어야 "쌓임" 이 눈에 보인다.
   */
  var HEART_MAX = 10, HEART_DAILY_CAP = 4;

  function heartRec(id) {
    var s = st();
    if (!s.hearts[id]) { s.hearts[id] = { h: 0, lastTalk: 0, gainDay: 0, gained: 0 }; }
    return s.hearts[id];
  }

  function heartOf(id) { return heartRec(id).h; }

  /** 오늘 이미 하루 상한(+4)만큼 올랐으면 나머지는 버린다(음수 delta — 선물이
   *  싫은 것일 때 — 는 상한에 안 걸린다, 벌은 늘 다 들어간다) */
  function bumpHeart(id, delta) {
    var s = st(), r = heartRec(id);
    if (r.gainDay !== s.day) { r.gainDay = s.day; r.gained = 0; }
    var applied = delta;
    if (delta > 0) {
      applied = Math.max(0, Math.min(delta, HEART_DAILY_CAP - r.gained));
      r.gained += applied;
    }
    r.h = Math.max(0, Math.min(HEART_MAX, r.h + applied));
    return applied;
  }

  /** 다음 해제 문턱 — 화면에 "다음: n♥ 에 …" 를 보여줄 때 쓴다 */
  function heartNext(id) {
    var h = heartOf(id), U = VD.HEART_UNLOCKS, i;
    for (i = 0; i < U.length; i++) { if (h < U[i].at) { return U[i]; } }
    return null;
  }

  /** 하트로 푸는 해제 하나의 문턱 — `HEART_UNLOCKS`(§5.4)를 이름으로 찾는다.
   *  표 순서·값이 바뀌어도 자리(인덱스)에 안 얽매이게. 없는 이름이면 못
   *  풀리는 것으로(Infinity) 본다. */
  function heartUnlockAt(name) {
    var U = VD.HEART_UNLOCKS;
    for (var i = 0; i < U.length; i++) { if (U[i].name === name) { return U[i].at; } }
    return Infinity;
  }

  /** 5♥ 해제 "고유 대화"(§5.4 HEART_UNLOCKS) — 주민은 실제 역사 인물이라
   *  새로 쓰지 않고, 이미 실명 없이 다듬어진 열전(BIOS, data.js §"열전")
   *  한 줄을 그대로 돌려쓴다. 절차적 생성 인물(saga-go 전용 genchar) 등
   *  BIOS가 없는 인물은 아직 못 여는 것으로(null) 본다 — 새로 지어내지 않는다. */
  function uniqLineOf(id) {
    if (heartOf(id) < heartUnlockAt('고유 대화')) { return null; }
    var bio = global.DG.data ? global.DG.data.bio(id) : '';
    return bio ? '문득 지난 이야기가 떠오르는구려... ' + bio : null;
  }

  /** 하트 10(기념품 해제) 주민 사연 — 사람마다 한 번. 틀 셋 가운데 인물 id 로 하나를 고르고 도감 열전 한 줄을 끼운다. 아직 못 들었으면 그 결과를, 아니면 null */
  function mementoStory(res) {
    var s = st(), id = res.id;
    if (s.memento[id] || heartOf(id) < heartUnlockAt('기념품')) { return null; }
    var FR = VD.MEMENTO_FRAMES, fr = FR[idNum(id) % FR.length], bio = global.DG.data ? global.DG.data.bio(id) : '';
    s.memento[id] = fr.key;
    core.save.player.gold += VD.MEMENTO_GOLD;
    core.gainFeat(VD.MEMENTO_FEAT, '기념품');
    core.log('🎁 ' + res.ref.name + ' 의 사연을 들었다 — 기념품 🪙 +' + core.fmt(VD.MEMENTO_GOLD), 'good');
    core.emit('changed');
    core.persist();
    return { kind: 'talk', name: res.ref.name, memento: fr.key,
             text: fr.emoji + ' ' + fr.text.replace('{이름}', res.ref.name).replace('{bio}', bio || '') + ' (🪙 +' + core.fmt(VD.MEMENTO_GOLD) + ')' };
  }

  /** 동행(PLAN §5.4, 7♥ 해제) — 자격 판정은 여기(하트를 쥔 쪽)가 하고,
   *  실제 "따라 걷기"는 `folk.js` 몫이다. */
  function canFollow(id) { return heartOf(id) >= heartUnlockAt('동행'); }

  function requestFollow(id) {
    if (!canFollow(id)) { return { kind: 'no', text: '아직 그 정도로 정이 깊지 않습니다' }; }
    var F = global.DG.folk;
    if (!F || !F.startFollow(id)) {
      return { kind: 'no', text: '이미 다른 이와 함께 걷고 있습니다' };
    }
    var h = global.DG.data ? global.DG.data.find(id) : null;
    core.log('🚶 ' + (h ? h.name : id) + ' 이(가) 잠시 함께 걷습니다', 'good');
    core.emit('changed');
    return { kind: 'follow', text: '🚶 ' + (h ? h.name : id) + ' 와(과) 함께 걷습니다 (' +
      F.FOLLOW_SEC + '초)' };
  }

  /** 부탁 하나를 만든다 — 오늘 안에 가져오면 금과 친밀도 */
  /**
   * 부탁 하나를 만든다.
   * **지금 나는 것 중에서만** 청한다(`VD.pick`) — 표에서 그냥 뽑으면 한겨울에 매실을,
   * 맑은 날에 미꾸라지를 가져오라고 한다. 오늘 안에 채울 수 없는 부탁은 부탁이 아니다.
   */
  function makeRequest(id) {
    /* 청하는 갈래는 **성격이 정한다** — 학구는 광물과 화석을, 다정은 꽃을 청한다.
       사람마다 청하는 것이 늘 비슷해야 그 사람으로 기억된다 */
    var t = global.DG.folk ? global.DG.folk.typeOf(id) : null;
    var cats = t ? t.req : ['fruit', 'nut', 'ore', 'flower', 'fish'];
    var cat = core.pick(cats);
    var want = VD.pick(cat);
    if (!want) { want = VD.pick('fruit') || VD.ITEMS.fruit[0]; }
    var n = core.pick(VD.REQUEST_N);
    return { want: want.key, n: n, done: false };
  }

  function requestOf(id) {
    var s = st();
    if (!s.requests[id]) { s.requests[id] = makeRequest(id); }
    return s.requests[id];
  }

  /** 말을 건다 — 부탁을 받거나, 채웠으면 건네고 보상을 받는다 */
  function talk(res) {
    var s = st();
    var req = requestOf(res.id);
    var it = VD.item(req.want);

    /* 하트(PLAN §5.4) "대화" +1 — 오늘 이 사람과 처음 말을 건 것이면 한 번만.
       세배·부탁 완수 등 아래 갈림길과 무관하게, 말을 걸었다는 사실 자체에 준다 */
    var hr0 = heartRec(res.id);
    if (hr0.lastTalk !== s.day) { hr0.lastTalk = s.day; bumpHeart(res.id, 1); }

    /* 설날 — 첫 인사는 세배다. 사람마다 한 번, 정이 깊을수록 두둑하다 */
    if (global.DG.town && global.DG.town.isNewYear()) {
      if (!s.bow) { s.bow = {}; }
      if (s.bow[res.id] !== s.day) {
        s.bow[res.id] = s.day;
        var money = 500 + friendOf(res.id) * 150;
        core.save.player.gold += money;
        bumpHeart(res.id, 2);   // 행사날 세배 — PLAN §5.4 "행사날 세배·나눔 +2"
        core.gainFeat(2, '세배');
        core.log('🧧 ' + res.ref.name + ' 에게 세배했다 — 세뱃돈 🪙 +' + core.fmt(money), 'good');
        core.emit('changed');
        core.persist();
        var bowDone = global.DG.festival ? global.DG.festival.onBow() : null;      // 세배 돌기(PLAN §5.6)
        return { kind: 'bow', name: res.ref.name,
                 text: '새해 복 많이 받으시오. 🧧 🪙 +' + core.fmt(money) + (bowDone ? ' · ' + bowDone : '') };
      }
    }
    /* 동지 팥죽 나눔(PLAN §5.6) — 쑨 팥죽이 남았으면 말 건 주민에게 한 그릇 */
    if (global.DG.festival) {
      var soup = global.DG.festival.share(res);
      if (soup) { return soup; }
    }

    /* 떠날 뜻을 비친 사람 — 붙잡는 것이 다른 무엇보다 먼저다.
       부탁을 들어준 뒤라야 붙잡힌다(mail.keep 이 그 판정을 갖는다) */
    var lv = global.DG.mail ? global.DG.mail.leavingOf(res.id) : null;
    if (lv) {
      var kept = global.DG.mail.keep(res.id);
      if (kept && kept.kind === 'keep') {
        return { kind: 'keep', name: res.ref.name, text: kept.text };
      }
      return { kind: 'leaving', name: res.ref.name, req: req, item: it,
               text: '떠날 뜻을 굳혔소 (' + lv.left + '일 남음). ' +
                     (kept ? kept.text : '') };
    }

    var mem = mementoStory(res);                     // 하트 10 — 사람마다 한 번 사연과 기념품
    if (mem) { return mem; }

    var F = global.DG.folk;
    var ty = F ? F.typeOf(res.id) : null;

    if (req.done) {
      var uniq = uniqLineOf(res.id);
      return { kind: 'talk', name: res.ref.name,
               text: uniq ? uniq
                        : ty ? ty.idle
                        : '오늘은 고마웠소. ' + VD.phaseOf(new Date().getHours()).hello + '.' };
    }
    if (bagCount(req.want) >= req.n) {
      s.bag[req.want] -= req.n;
      req.done = true;
      var gold = it.price * req.n * 2;
      var fame = 8 + req.n * 3;
      core.save.player.gold += gold;
      core.save.player.fame += fame;
      s.friend[res.id] = friendOf(res.id) + 1;
      bumpHeart(res.id, 2);   // 부탁 완수 — PLAN §5.4
      s.helped += 1;
      core.gainFeat(4, '심부름');
      core.gainExp(18);
      core.log('🤝 ' + res.ref.name + ' 의 부탁을 들어주었다 — 🪙 +' + core.fmt(gold) +
        ' · 🎖️ +' + fame + ' · 친밀도 ' + s.friend[res.id] + ' · 💗 ' + heartOf(res.id) + '/10', 'good');
      core.emit('changed');
      core.persist();
      return { kind: 'reward', name: res.ref.name,
               text: (ty ? ty.done + ' ' : '') +
                     it.emoji + ' ' + it.name + ' ×' + req.n + ' — 🪙 +' + core.fmt(gold) };
    }
    return { kind: 'request', name: res.ref.name, req: req, item: it,
             text: ty ? F.say(ty.ask, it, req.n, bagCount(req.want))
                      : it.emoji + ' ' + it.name + ' ' + req.n + '개를 구해 줄 수 있겠소? (' +
                        bagCount(req.want) + '/' + req.n + ')' };
  }

  /* ── 선물 ─────────────────────────────────────────────────
   * 원작에서 정을 쌓는 두 번째 길이다. 부탁은 그 사람이 청한 것을 가져다 주는 것이고,
   * 선물은 **내가 골라서** 주는 것이다.
   *
   * 사람마다 좋아하는 갈래가 있다(인물 id 로 정해지니 늘 같다).
   * 좋아하는 것을 주면 정이 훨씬 는다 — 아무거나 안겨서는 안 된다.
   * 사람마다 **하루 한 번**이다.
   */
  var GIFT_CATS = ['fruit', 'nut', 'ore', 'flower', 'fish', 'bug', 'shell', 'fossil'];

  function idNum(id) {
    var n = 0;
    for (var i = 0; i < id.length; i++) { n = (n * 31 + id.charCodeAt(i)) % 100000; }
    return n;
  }

  /** 이 사람이 좋아하는 갈래 — **성격이 정한다** */
  function giftLike(id) {
    var t = global.DG.folk ? global.DG.folk.typeOf(id) : null;
    if (t && t.like) { return t.like; }
    var n = idNum(id);
    return GIFT_CATS[Math.floor(core.hash2(n, n % 977 + 13) * GIFT_CATS.length) % GIFT_CATS.length];
  }

  /** 이 사람이 싫어하는 갈래(PLAN §5.4 하트 취향표) — 없으면(성격표에 없으면) 없다고 본다.
   *  기존 `friend`(loved 이분법)는 안 건드리고, 하트만 이 표로 -1 을 준다 */
  function giftDislike(id) {
    var t = global.DG.folk ? global.DG.folk.typeOf(id) : null;
    return (t && t.dislike) || null;
  }

  function giftedToday(id) { return st().gifted[id] === st().day; }

  /** 곁에 있는 주민에게 가방의 것 하나를 준다 */
  function giveGift(heroId, key) {
    var s = st(), it = VD.item(key), i, res = null;
    for (i = 0; i < residents.length; i++) { if (residents[i].id === heroId) { res = residents[i]; } }
    if (!res) { return { kind: 'no', text: '그 사람은 이 마을에 없습니다' }; }
    if (Math.hypot(res.x - player.x, res.y - player.y) > REACH) {
      return { kind: 'no', text: res.ref.name + ' 곁으로 가야 건넬 수 있습니다' };
    }
    if (!it) { return { kind: 'no', text: '없는 물건입니다' }; }
    if (bagCount(key) < 1) { return { kind: 'no', text: '가진 것이 없습니다' }; }
    if (giftedToday(heroId)) {
      return { kind: 'no', text: '오늘은 이미 ' + res.ref.name + ' 에게 건넸습니다' };
    }

    var like = giftLike(heroId);
    var loved = it.cat === like;
    var up = (loved ? 3 : 1) + (it.price >= 200 ? 1 : 0);
    /* 하트(PLAN §5.4) — friend 의 이분법(loved/아님)과 달리 싫어함(-1)도 있다 */
    var hUp = loved ? 3 : (it.cat === giftDislike(heroId) ? -1 : 1);
    bumpHeart(heroId, hUp);

    s.bag[key] -= 1;
    s.gifted[heroId] = s.day;
    s.giftTotal = (s.giftTotal || 0) + 1;   // 팔아도 안 주는 것과 달리 늘 앞으로만 간다(§5.1)
    s.friend[heroId] = friendOf(heroId) + up;
    core.save.player.fame += up * 5;
    core.gainFeat(3, '선물');
    core.gainExp(10);
    var hTxt = ' · 💗 ' + (hUp >= 0 ? '+' + hUp : hUp) + ' (' + heartOf(heroId) + '/10)';
    core.log('🎁 ' + res.ref.name + ' 에게 ' + it.emoji + ' ' + it.name + ' 을(를) 건넸다 — ' +
      (loved ? '아주 반긴다! ' : '') + '친밀도 +' + up + ' (' + s.friend[heroId] + ')' + hTxt, 'good');
    checkTasks();
    core.emit('changed');
    core.persist();
    return { kind: 'gift', name: res.ref.name, loved: loved,
             text: (loved ? '아주 반긴다! ' : (hUp < 0 ? '떨떠름해한다. ' : '고맙게 받는다. ')) +
                   '친밀도 +' + up + hTxt };
  }

