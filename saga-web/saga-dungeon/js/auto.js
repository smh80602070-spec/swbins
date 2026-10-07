/**
 * 자동 순회 — 던전을 대신 돌아 준다
 * ---------------------------------------------------------------
 * 지도를 걷는 게임(deungyong-go)의 auto.js 에서 던전 부분만 떼어 왔다.
 * 원칙은 그대로다: **규칙을 새로 만들지 않는다.** 목표만 고르고 조작은
 * dungeon.js 의 공개 함수(moveTo · castSkill · goRoom · pickBoon · answerQuiz · leave)로
 * 넣는다. 그래서 손으로 할 때와 기대값이 어긋나지 않는다.
 *
 * 화면을 보고 있는 동안에만 돈다(requestAnimationFrame).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  var FLAGS = [
    /* 2026-09-28 실기 Q7 "사가나락 자동 퀘스트"(전체 테스트용) — 사가만리 📖 이야기와 같은 결: 목표만 고르고 원래 조작(town.moveTo·dungeon.enter/goRoom)으로 */
    { key: 'quest', name: '퀘스트', emoji: '📜',
      desc: '지역 사연(토벌·흔적·정예·우두머리)을 따라 들판을 걷고, 없으면 메인 퀘스트에 맞춰 던전 층·방을 고른다' },
    { key: 'grow', name: '승급 · 장비', emoji: '✨',
      desc: '승급 조건을 채운 인물을 올리고, 노획 장비를 갈아입힌다' },
    { key: 'retry', name: '다시 들어가기', emoji: '🔁',
      desc: '나오거나 쓰러지면 잠시 뒤 다시 내려간다' }
  ];

  var acc = { grow: 0, dg: 0, retry: 0, quest: 0 };
  var doing = '';
  var lastLog = 0;

  /* 세이브의 자동 설정. **빠진 칸은 채워 넣는다** — 옛 세이브나 다른 게임에서 넘어온
     모양이면 칸이 없어서 기능이 조용히 꺼진 것처럼 보인다(실제로 그렇게 헤맸다). */
  var DEFAULTS = { on: false, quest: true, grow: true, retry: true };

  function st() {
    var s = core.save, k;
    if (!s.auto) { s.auto = {}; }
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) && s.auto[k] === undefined) {
        s.auto[k] = DEFAULTS[k];
      }
    }
    return s.auto;
  }

  function on(flag) { return !!st()[flag]; }
  function active() { return !!st().on; }

  function flagByKey(k) {
    for (var i = 0; i < FLAGS.length; i++) { if (FLAGS[i].key === k) { return FLAGS[i]; } }
    return null;
  }

  function setOn(v) {
    var s = st();
    v = !!v;
    if (s.on === v) { return v; }
    s.on = v;
    doing = v ? '내려갈 준비' : '';
    core.log(v ? '🤖 자동 순회를 켰다' : '🤖 자동 순회를 껐다', 'info');
    core.emit('toast', v ? '🤖 자동 순회 시작' : '⏸️ 자동 순회 정지');
    core.emit('changed');
    core.persist();
    return v;
  }

  function toggle() { return setOn(!st().on); }

  function toggleFlag(key) {
    if (!flagByKey(key)) { return false; }
    var s = st();
    s[key] = !s[key];
    core.emit('changed');
    core.persist();
    return !!s[key];
  }

  /* ── 승급 · 장비 ──────────────────────────────────────── */

  function autoRankUp() {
    var ids = Object.keys(core.save.dex.heroes), best = null, bestR = -1, i;
    for (i = 0; i < ids.length; i++) {
      var chk = global.DG.hero.rankUpCheck(ids[i]);
      if (!chk.ok) { continue; }
      var h = global.DG.data.find(ids[i]);
      var score = h ? h.rarity : 0;
      if (score > bestR) { bestR = score; best = ids[i]; }
    }
    if (best) { global.DG.hero.rankUp(best); return true; }
    return false;
  }

  function tickGrow(dt) {
    acc.grow += dt;
    if (acc.grow < 6) { return; }
    acc.grow = 0;
    autoRankUp();
    if (global.DG.item) {
      global.DG.item.autoEquip();
      global.DG.item.autoClean();
    }
  }

  /* ── 던전 ─────────────────────────────────────────────── */

  /** 축복(§5.1) 점수 — 옛 BOONS(스탯%, 고정 키 표)가 세 축 체계로
   *  갈렸다(2026-09-18). 이제 키 하나하나가 아니라 **축·희귀도**로 매긴다 —
   *  "오래 버티는 쪽을 먼저 집는다"는 옛 취지를 인물 축(생존기·위력)을
   *  가장 높게 쳐서 그대로 이어간다. */
  var BOON_AXIS_SCORE = { hero: 70, skill: 60, world: 50 };
  var BOON_RARITY_BONUS = { legendary: 20, rare: 10, common: 0 };
  function boonScore(key) {
    var b = global.DG.dungeonData ? global.DG.dungeonData.boonByKey(key) : null;
    if (!b) { return 40; }
    return (BOON_AXIS_SCORE[b.axis] || 40) + (BOON_RARITY_BONUS[b.rarity] || 0);
  }

  /** 다음 방 우선순위 — 체력이 깎였으면 우물부터 */
  function doorScore(kind, hpRatio) {
    var want = on('quest') ? mainReq() : null;
    if (want && want.t === 'discover' && kind === want.room) { return 150; }   // 📜 찾을 방이면 그 문
    if (want && want.t === 'floor' && kind === 'stair') { return 120; }        // 📜 층 내려가기면 계단
    if (kind === 'stair') { return 55; }
    if (kind === 'well') { return hpRatio < 0.7 ? 200 : 30; }
    if (kind === 'trove') { return 90; }
    if (kind === 'shrine') { return 80; }
    return 50;
  }

  function nearestOf(list, p) {
    var best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.hp !== undefined && o.hp <= 0) { continue; }
      var d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best ? { o: best, d: bd } : null;
  }

  function fightSkills(run, near) {
    var D = global.DG.dungeon;
    var p = run.player, room = run.room, i, alive = 0, close = 0;
    for (i = 0; i < room.enemies.length; i++) {
      var e = room.enemies[i];
      if (e.hp <= 0) { continue; }
      alive++;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 80) { close++; }
    }
    if (!alive) { return; }
    if (close >= 2) { D.castSkill(0); }            // 회전참 — 몰려 있을 때
    D.castSkill(3);                                 // 사기 — 되면 항상
    if (near && near.d > 90) { D.castSkill(2); }   // 기공파 — 멀리 있는 놈에게
    if (near && near.d > 150) { D.castSkill(1); }  // 돌진 — 거리를 좁힌다
  }

  function countAlive(room) {
    var n = 0;
    for (var i = 0; i < room.enemies.length; i++) { if (room.enemies[i].hp > 0) { n++; } }
    return n;
  }

  var dropAim = { o: null, t: 0 };
  function tickDungeon(dt) {
    var D = global.DG.dungeon;
    var run = D.raw();                              // 읽기만 한다 (화면과 같은 방식)
    if (!run) { return; }
    var p = run.player;
    var hpRatio = run.hpMax ? run.hp / run.hpMax : 1;

    if (run.choice) {                               // 축복 고르기(§5.1)
      var bestKey = null, bs = -1;
      for (var i = 0; i < run.choice.length; i++) {
        var sc = boonScore(run.choice[i]);
        if (sc > bs) { bs = sc; bestKey = run.choice[i]; }
      }
      if (bestKey) { D.pickBoon(bestKey); }
      doing = '🎴 은사를 고르는 중';
      return;
    }

    /* 위험하면 **먼저 마신다** — 원작에서 사람이 하는 첫 동작이다.
       탈출은 마실 것이 다 떨어졌을 때의 마지막 수단이지, 첫 수단이 아니다.
       작은 것부터 쓴다(potion.useBest) — 큰 것을 아껴 둔다. */
    var P = global.DG.potion;
    if (P && hpRatio < 0.45) {
      if (P.useBest('hp').ok) { doing = '🍶 단약을 마시는 중'; return; }
    }
    if (P) {
      /* 기력은 급하지 않으니 마시고 나서 하던 일을 이어 간다 (return 하지 않는다) */
      var stt = D.status();
      if (stt.mpMax && stt.mp / stt.mpMax < 0.2) { P.useBest('mp'); }
    }

    /* 마실 것도 없이 위험하면 나온다 — 노획물을 지키는 쪽이 이득이다 */
    if (hpRatio < 0.22 && !(run.room.well && !run.room.well.used)) {
      doing = '🚪 체력이 낮아 탈출';
      D.leave();
      return;
    }

    var room = run.room;
    var near = nearestOf(room.enemies, p);

    if (near) {
      var ux = (near.o.x - p.x) / near.d, uy = (near.o.y - p.y) / near.d;
      var stop = near.o.r + 18;
      D.moveTo(near.o.x - ux * stop, near.o.y - uy * stop);
      fightSkills(run, near);
      doing = '⚔️ 제' + run.floor + '층 · 남은 적 ' + countAlive(room) + '마리';
      return;
    }

    /* 벽·기둥 너머라 못 줍는 노획물에 1분 넘게 붙어 있었다(09-28 헤드리스) — 같은 것을 4초 넘게 못 주우면 건너뛴다 */
    var drop = nearestOf(room.drops.filter(function (o) { return !o._autoSkip; }), p);
    if (drop) {
      if (dropAim.o !== drop.o) { dropAim.o = drop.o; dropAim.t = 0; }
      dropAim.t += dt;
      if (dropAim.t > 4) { drop.o._autoSkip = true; dropAim.o = null; return; }
      D.moveTo(drop.o.x, drop.o.y);
      doing = '💰 노획물 수습';
      return;
    }

    var obj = null;
    if (room.well && !room.well.used && hpRatio < 0.98) { obj = room.well; }
    else if (room.chest && !room.chest.taken) { obj = room.chest; }
    else if (room.shrine && !room.shrine.used) { obj = room.shrine; }
    if (obj) {
      D.moveTo(obj.x, obj.y);
      doing = '🔎 방을 둘러보는 중';
      return;
    }

    acc.dg += dt;
    if (acc.dg >= 0.6) {
      acc.dg = 0;
      var doors = room.doors || [], pickKind = null, ps = -1;
      for (var j = 0; j < doors.length; j++) {
        var s2 = doorScore(doors[j].kind, hpRatio);
        if (s2 > ps) { ps = s2; pickKind = doors[j].kind; }
      }
      if (pickKind) {
        D.goRoom(pickKind);
        doing = '🚪 다음 방으로 (' + pickKind + ')';
      }
    }
  }

  /** 📜 지금 메인 퀘스트의 요구 { t: floor|kill|discover, n, room?, tag? } — 다 끝났으면 null */
  function mainReq() {
    var QD = global.DG.questData, q = core.save.quest;
    var m = QD && QD.MAIN && q ? QD.MAIN[q.mainIdx || 0] : null;
    return m ? m.req : null;
  }

  /** 📜 들판 목표 — 열린 지역 사연 중 가장 가까운 걸음의 자리 { x, y, label } · 없으면 null */
  function questFieldGoal(tr) {
    var Q = global.DG.quest, WM = global.DG.worldMap;
    if (!Q || !WM || !tr || !tr.player) { return null; }
    var p = tr.player, st = Q.status(), best = null, bd = Infinity;
    questWait = '';
    (st.chains || []).forEach(function (ch) {
      if (ch.locked || ch.done) { return; }
      var spot = null;
      if (ch.step === 1) { spot = WM.clueSpot(ch.key); }
      else if (ch.step === 3) {
        /* 우두머리는 위험 = 그 자리 위험 + 4(dungeon.js RB_LV_ADD) — 던전에서 그 층까지 닿기 전엔 미룬다.
           새 계정 부대가 곧장 덤벼 쓰러지고 마을로 돌아가길 되풀이했다(09-28 헤드리스). 그동안은 메인 퀘스트(던전)로 큰다 */
        spot = WM.bossSpot(ch.key);
        var rbLv = spot ? WM.levelAt(spot.x, spot.y) + 4 : 0, bestF = global.DG.dungeon.status().best || 0;
        if (spot && bestF < rbLv) { questWait = ch.title + ' 우두머리는 던전 ' + rbLv + '층에 닿은 뒤로'; return; }
      }
      else {
        /* 토벌(0)·정예(2) — 그 지역에 선 들판 몬스터(정예면 정예만) 가장 가까운 것, 없으면 지역 안쪽(흔적 자리)으로 들어가 찾는다 */
        var en = (tr.room && tr.room.enemies) || [], ed = Infinity;
        en.forEach(function (e) {
          if (e.hp <= 0 || !e.field || (ch.step === 2 && !e.elite && !e.boss)) { return; }
          if (WM.regionAt(e.x, e.y).key !== ch.key) { return; }
          var dd = Math.hypot(e.x - p.x, e.y - p.y);
          if (dd < ed) { ed = dd; spot = { x: e.x, y: e.y }; }
        });
        if (!spot) { spot = WM.clueSpot(ch.key); }
      }
      if (!spot) { return; }
      var d = Math.hypot(spot.x - p.x, spot.y - p.y);
      if (d < bd) { bd = d; best = { x: spot.x, y: spot.y, d: d, label: (ch.emoji || '📜') + ' ' + ch.title + ' · ' + ch.stepName + (ch.need ? ' ' + ch.have + '/' + ch.need : '') }; }
    });
    return best;
  }

  /** 📜 마을·들판 한 박자 — 맡았으면 true(던전에 안 내려간다) */
  function tickQuestField(dt) {
    var T = global.DG.town, tr = T && T.raw ? T.raw() : null;
    if (!tr) { return false; }
    acc.quest += dt;
    if (acc.quest < 0.5) { return !!questDoing; }
    acc.quest = 0;
    var g = questFieldGoal(tr);
    if (!g) { questDoing = ''; return false; }
    /* 막힘 풀기 — 길 찾기가 없어 나무·바위·담에 붙으면 제자리. 2초 동안 30보도 못 가면 옆으로 400보 비켰다가 다시 */
    var p = tr.player;
    if (qStuck.side) {
      qStuck.t += 0.5;
      if (qStuck.t < 2.5 && Math.hypot(qStuck.side.x - p.x, qStuck.side.y - p.y) > 20) { T.moveTo(qStuck.side.x, qStuck.side.y); doing = '📜 막혀서 옆으로 돌아가는 중'; return true; }
      qStuck.side = null; qStuck.t = 0;
    }
    if (Math.hypot(p.x - qStuck.x, p.y - qStuck.y) > 30) { qStuck.x = p.x; qStuck.y = p.y; qStuck.t = 0; } else { qStuck.t += 0.5; }
    if (qStuck.t >= 2 && g.d > 60) {
      var ux = (g.x - p.x) / g.d, uy = (g.y - p.y) / g.d, sg = (qStuck.n = (qStuck.n || 0) + 1) % 2 ? 1 : -1;
      qStuck.side = { x: p.x - uy * 400 * sg - ux * 80, y: p.y + ux * 400 * sg - uy * 80 }; qStuck.t = 0;
      T.moveTo(qStuck.side.x, qStuck.side.y);
      doing = '📜 막혀서 옆으로 돌아가는 중';
      return true;
    }
    T.moveTo(g.x, g.y);
    questDoing = '📜 ' + g.label + ' — ' + Math.round(g.d) + '보';
    doing = questDoing;
    return true;
  }
  var questWait = '', questDoing = '', qStuck = { x: 0, y: 0, t: 0, side: null, n: 0 };

  /** 본영에 있을 때 — 다시 내려간다 */
  function tickEntry(dt) {
    if (!on('retry')) { doing = '🏯 본영에서 대기 (다시 들어가기 꺼짐)'; return; }
    acc.retry += dt;
    if (acc.retry < 4) { doing = '🕳️ 다시 내려갈 준비'; return; }
    acc.retry = 0;
    if (!core.save.party.length) {
      doing = '⚠️ 동행이 없어 내려갈 수 없습니다';
      return;
    }
    var s = global.DG.dungeon.status();
    var floor = s.best >= 2 ? Math.max(1, Math.floor(s.best / 2)) : 1;
    /* 📜 층 내려가기 퀘스트면 닿은 곳부터 — 절반에서 시작하면 새 층까지 한참 걸린다 */
    var mq = on('quest') ? mainReq() : null;
    if (mq && mq.t === 'floor' && s.best >= 1) { floor = Math.max(1, Math.min(s.best, mq.n)); }
    global.DG.dungeon.enter({ floor: floor });
    if (mq) { doing = '📜 메인 퀘스트 — 제' + floor + '층부터 (' + mq.t + (mq.n ? ' ' + mq.n : '') + ')' + (questWait ? ' · ' + questWait : ''); }
  }

  function update(dt) {
    if (!active()) { return; }
    if (global.DG.dungeon.active()) { tickDungeon(dt); }
    else if (!(on('quest') && tickQuestField(dt))) { tickEntry(dt); }
    if (on('grow')) { tickGrow(dt); }
  }

  function status() {
    return { on: active(), doing: doing, flags: st(), mainReq: mainReq() };
  }

  global.DG = global.DG || {};
  global.DG.auto = {
    FLAGS: FLAGS, flagByKey: flagByKey,
    state: st, active: active, on: on,
    setOn: setOn, toggle: toggle, toggleFlag: toggleFlag,
    update: update, status: status,
    /** 자가진단용 */
    _tickDungeon: tickDungeon, _tickEntry: tickEntry,
    _autoRankUp: autoRankUp, _doorScore: doorScore, _mainReq: mainReq, _questFieldGoal: questFieldGoal
  };
})(window);
