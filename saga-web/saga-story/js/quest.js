/**
 * 사명 — 받고, 채우고, 바친다
 * ---------------------------------------------------------------
 * 원작의 퀘스트가 그렇듯 셋으로 돈다: **받는다 → 채운다 → 바친다.**
 * 받지 않은 사명은 세어 주지 않는다(원작도 그렇다).
 *
 * 세이브
 *   save.quests = { key: { taken: 시각, n: 센 수, done: 바친 횟수 } }
 *
 * **세는 방법이 둘이다.**
 *   쌓이는 것(kill·boss) — 받은 뒤부터 알림('side:kill')을 듣고 하나씩 센다
 *   보는 것(gear·skill·gold·level) — 셀 것이 없다. **물어볼 때마다 지금 값을 본다**
 * 뒤엣것을 굳이 세어 두면 장비를 벗었다 껴도 수가 남아 어긋난다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var QD = global.DG.questData;

  function st() {
    var s = core.save;
    if (!s.quests) { s.quests = {}; }
    return s.quests;
  }

  function rec(key) {
    var q = st();
    if (!q[key]) { q[key] = { taken: 0, n: 0, done: 0 }; }
    return q[key];
  }

  function taken(key) { return !!rec(key).taken; }
  function doneCount(key) { return rec(key).done || 0; }

  /* ── 일일 사명(PLAN 33절) ─────────────────────────────────
   * 되받는 사명(repeat)은 바치자마자 다시 받을 수 있는데, 일일 사명은
   * **하루에 한 번**만 — turnIn() 이 남긴 lastDoneDay 가 오늘과 같으면 잠긴다.
   * 실제 시각이 아니라 로컬 달력의 '그 날'만 본다(자정에 넘어간다). */
  function todayKey(t) {
    var d = new Date(t || Date.now());
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }
  function doneToday(key) { return rec(key).lastDoneDay === todayKey(); }

  /* ── 지금 얼마나 찼나 ─────────────────────────────────── */

  /** 보는 것 — 세어 두지 않고 그때그때 읽는다 */
  function look(goal) {
    var G = global.DG.gear, J = global.DG.job;
    if (goal.type === 'gear') {
      if (!G) { return 0; }
      var e = G.equipped(), n = 0, k;
      for (k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) { n++; } }
      return n;
    }
    if (goal.type === 'skill') { return J ? J.spSpent() : 0; }
    if (goal.type === 'gold') { return core.save.player.gold; }
    if (goal.type === 'level') { return core.save.player.level; }
    return -1;                                  // 쌓이는 것
  }

  function progress(key) {
    var def = QD.find(key);
    if (!def) { return 0; }
    var seen = look(def.goal);
    return seen >= 0 ? seen : (rec(key).n || 0);
  }

  function full(key) {
    var def = QD.find(key);
    return !!def && progress(key) >= def.goal.n;
  }

  /* ── 목록 ─────────────────────────────────────────────── */

  /** 지금 화면에 보일 사명들 — 레벨이 되면 뜨고, 한 번뿐인 것은 바치면 사라진다 */
  function list() {
    var lv = core.save.player.level, out = [];
    for (var i = 0; i < QD.QUESTS.length; i++) {
      var d = QD.QUESTS[i];
      if (lv < d.need) { continue; }
      if (!d.repeat && doneCount(d.key) > 0) { continue; }
      out.push({
        ref: d, taken: taken(d.key), n: progress(d.key), goal: d.goal.n,
        full: taken(d.key) && full(d.key), done: doneCount(d.key),
        lockedToday: !!d.daily && doneToday(d.key)
      });
    }
    return out;
  }

  /* ── 받기 · 바치기 ────────────────────────────────────── */

  /** 소리 한 번 — sfx.js 가 없어도 규칙은 그대로 돈다(진단·데모가 그렇다) */
  function sfx(key) {
    var S = global.DG.sfx;
    if (S) { S.play(key); }
  }

  function take(key) {
    var d = QD.find(key);
    if (!d) { return false; }
    if (core.save.player.level < d.need) {
      core.emit('toast', '⚠️ Lv.' + d.need + ' 부터입니다');
      return false;
    }
    if (taken(key)) { return false; }
    if (d.daily && doneToday(key)) {
      core.emit('toast', '⚠️ 오늘은 이미 받았습니다 — 자정이 지나면 다시');
      return false;
    }
    var r = rec(key);
    r.taken = Date.now();
    r.n = 0;                                    // 받은 뒤부터 센다
    r.visited = null;                           // 'visit' 전용 — 밟은 사냥터 집합도 새로 센다
    core.save.track = key;                      // 목표판(§5-6) — 사명 받으면 자동 추적
    sfx('quest');
    core.log('📋 사명을 받았다 — ' + d.name, 'info');
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 바친다 — 조건을 채웠으면 보상을 준다 */
  function turnIn(key) {
    var d = QD.find(key);
    if (!d || !taken(key)) { return false; }
    if (!full(key)) { core.emit('toast', '⚠️ 아직 채우지 못했습니다'); return false; }
    var r = rec(key);
    r.done = (r.done || 0) + 1;
    r.taken = 0;
    r.n = 0;
    if (d.daily) { r.lastDoneDay = todayKey(); }

    var rw = d.reward || {}, bits = [];
    if (rw.exp) { core.gainExp(rw.exp); bits.push('경험치 ' + core.fmt(rw.exp)); }
    if (rw.gold) { core.save.player.gold += rw.gold; bits.push('🪙 ' + core.fmt(rw.gold)); }
    if (rw.potion) {
      global.DG.side.state().potions += rw.potion;
      bits.push('🧪 ' + rw.potion);
    }
    if (rw.scroll && global.DG.gear) {
      global.DG.gear.addScroll(rw.scroll, 1);
      bits.push('📜 ' + global.DG.gearData.scroll(rw.scroll).name);
    }
    if (rw.gear && global.DG.gear) {
      global.DG.gear.put(global.DG.gear.make(rw.gear));
      bits.push('📦 ' + global.DG.gearData.find(rw.gear).name);
    }
    core.gainFeat(6 + Math.round(d.need / 2), '사명');
    sfx('questdone');
    core.log('📋 ' + d.name + ' 을(를) 마쳤다 — ' + bits.join(' · '), 'good');
    core.emit('toast', '📋 ' + d.name + ' 완수!');
    core.emit('questdone', d.name);   // 화면 배너(PLAN 35절) — js/side.js 가 받는다
    /* 목표판(§5-6) — 방금 바친 게 추적 중이던 것이면 다음 것을 자동으로 문다 */
    if (core.save.track === key) { autoAdvanceTrack(); }
    core.emit('changed');
    core.persist();
    return true;
  }

  /* ── 쌓이는 것 세기 ───────────────────────────────────── */

  /* 목표판(§5-6) "이번 접속" 줄 전용 — 사명과 달리 **받지 않아도** 세어 둔다.
     새로고침·재부팅마다 새로 시작하는 메모리 값이라 세이브에 안 담는다(PLAN
     "session{...}는 메모리만"). 금은 이벤트가 따로 없어 core.save.player.gold
     의 오름폭만 누적한다(써서 준 것은 안 뺀다 — "이번 접속에 번 금"이 목적). */
  var session = { kills: 0, bossKills: 0, gathers: 0, gold: 0, visited: {}, goldSeen: undefined, goal: null };

  function onChanged() {
    var g = core.save.player.gold;
    if (session.goldSeen === undefined) { session.goldSeen = g; return; }
    if (g > session.goldSeen) { session.gold += (g - session.goldSeen); }
    session.goldSeen = g;
  }

  function onKill(info) {
    var q = st(), i;
    session.kills += 1;
    if (info.boss) { session.bossKills += 1; }
    for (i = 0; i < QD.QUESTS.length; i++) {
      var d = QD.QUESTS[i];
      if (!taken(d.key)) { continue; }
      var g = d.goal;
      if (g.type === 'kill') {
        if (g.stage && g.stage !== info.stage) { continue; }
        rec(d.key).n += 1;
      } else if (g.type === 'boss' && info.boss) {
        if (g.stage && g.stage !== info.stage) { continue; }   // 그 사냥터의 보스만(2026-09-23)
        rec(d.key).n += 1;
      }
    }
    void q;
  }

  /** 채집(PLAN 15절 "아이템 수집") — side.js 가 캘 때마다 알린다 */
  function onGather(info) {
    session.gathers += 1;
    for (var i = 0; i < QD.QUESTS.length; i++) {
      var d = QD.QUESTS[i];
      if (!taken(d.key) || d.goal.type !== 'gather') { continue; }
      if (d.goal.kind && d.goal.kind !== info.kind) { continue; }
      rec(d.key).n += 1;
    }
  }

  /** 사냥터 밟기(PLAN 15절 "특정 장소 방문·탐험") — 처음 밟는 곳만 센다.
   *  세는 방법이 kill·gather 와 다르다: 같은 곳을 두 번 밟아도 늘지 않아야 해서
   *  집합(record.visited)에 넣어 두고 그 크기를 잰다. */
  function onStage(run) {
    if (!run || !run.stage || run.stage.gateArena) { return; }   // R-5 관문 자리(임시 판)는 「밟은 곳」이 아니다
    var key = run.stage.key;
    session.visited[key] = true;
    for (var i = 0; i < QD.QUESTS.length; i++) {
      var d = QD.QUESTS[i];
      if (!taken(d.key) || d.goal.type !== 'visit') { continue; }
      var r = rec(d.key);
      if (!r.visited) { r.visited = {}; }
      if (!r.visited[key]) {
        r.visited[key] = true;
        r.n = Object.keys(r.visited).length;
      }
    }
  }

  /** 말 걸기(PLAN 15절 "NPC 대화") — 마을 사람 아무나 말을 걸 때마다 센다 */
  function onTalk(info) {
    for (var i = 0; i < QD.QUESTS.length; i++) {
      var d = QD.QUESTS[i];
      if (!taken(d.key) || d.goal.type !== 'talk') { continue; }
      rec(d.key).n += 1;
    }
    void info;
  }

  /* ── 목표판(§5-6) — 추적 사명 · 이번 접속 목표 · 다음 예고 ──────────
   * §5-4(관문 대장·주간)가 아직 없어(로드맵 Phase 3), PLAN 이 적은 "이번
   * 주" 줄은 **다음 예고**(추적이 끝나면 이어질 사명)로 대신 채운다 —
   * 그 절이 들어오면 이 자리를 바꾼다(HANDOFF 에 남긴다). */

  /** "지금 화면에 보일 수 있나" — 다 찼어도(바치기 전까지는) 그대로 보여준다.
   *  **읽기 전용**이다. autoAdvanceTrack() 을 부르지 않는다 — 예전엔 이 자리에서
   *  바로 물게 했더니, HUD 를 그리는 renderGoals() 가 'changed' 마다(거의 매
   *  clearQuests() 마다) 이 함수를 불러 **테스트가 기대하지 않은 사명을 조용히
   *  자동으로 받아 버려**, "받기 전엔 0 이어야 한다" 류의 기존 사명 진단이 깨졌다
   *  (2026-09-19 발견). 판정을 바꾸는 자리는 ensureDailyTrack()·turnIn() 뿐이다. */
  function trackable(key) { return !!key && !!QD.find(key) && taken(key); }

  /** 추적할 만한 사명 하나를 고른다. `exclude` 를 주면 그것 말고 찾는다
   *  (다음 예고용) — 이미 받아 둔 것(못 채운 것) 중에서 먼저 찾고,
   *  없으면 새로 받을 수 있는 것 중 첫 번째를 고른다. */
  function findCandidate(exclude) {
    var lv = core.save.player.level, i, d;
    for (i = 0; i < QD.QUESTS.length; i++) {
      d = QD.QUESTS[i];
      if (d.key === exclude || lv < d.need) { continue; }
      if (taken(d.key) && !full(d.key)) { return d.key; }
    }
    for (i = 0; i < QD.QUESTS.length; i++) {
      d = QD.QUESTS[i];
      if (d.key === exclude || lv < d.need) { continue; }
      if (!d.repeat && doneCount(d.key) > 0) { continue; }
      if (d.daily && doneToday(d.key)) { continue; }
      if (taken(d.key)) { continue; }
      return d.key;
    }
    return null;
  }

  /** 실제로 추적을 바꾸는 유일한 두 자리(ensureDailyTrack·turnIn)가 부른다.
   *  화면을 그리는 쪽(trackedInfo)은 절대 이걸 부르지 않는다. */
  function autoAdvanceTrack() {
    var key = findCandidate(null);
    if (!key) { core.save.track = null; return null; }
    if (!taken(key)) { take(key); }              // take() 가 core.save.track 을 스스로 문다
    else { core.save.track = key; }
    return key;
  }

  /** 하루 첫 부팅(PLAN §5-6 "일일 사명 2 자동 추적") — 아직 안 받았고
   *  오늘 몫이 남은 일일 사명을 전부 받아 둔다. 추적 중인 게 없으면 새로 문다. */
  function ensureDailyTrack() {
    for (var i = 0; i < QD.QUESTS.length; i++) {
      var d = QD.QUESTS[i];
      if (d.daily && !taken(d.key) && !doneToday(d.key)) { take(d.key); }
    }
    if (!trackable(core.save.track)) { autoAdvanceTrack(); }
  }

  /** HUD 1줄 — 추적 중인 사명. **읽기만 한다**(위 trackable() 주석 참고) —
   *  아무것도 추적 중이 아니면 null 을 돌려주고, HUD 는 "없습니다"로 보여준다.
   *  다음 부팅(ensureDailyTrack)이나 다음 사명 완수(turnIn)가 되면 저절로 채워진다. */
  function trackedInfo() {
    var key = core.save.track;
    if (!trackable(key)) { return null; }
    var d = QD.find(key);
    return { key: key, name: d.name, n: progress(key), goal: d.goal.n };
  }

  var SESSION_GOALS = [
    { type: 'kill', n: 30, label: '사냥 30마리', get: function () { return session.kills; } },
    { type: 'boss', n: 1, label: '두목 1마리 토벌', get: function () { return session.bossKills; } },
    { type: 'gather', n: 20, label: '채집 20개', get: function () { return session.gathers; } },
    { type: 'gold', n: 3000, label: '금 3000 벌기', get: function () { return session.gold; } },
    { type: 'visit', n: 2, label: '사냥터 2곳 밟기', get: function () { return Object.keys(session.visited).length; } }
  ];

  /** HUD 2줄 — "이번 접속" 목표. 다 채우면 그 자리에서 다음 후보를 새로 고른다
   *  (부팅마다 하나가 아니라, 이 접속 동안 계속 이어지게). */
  function sessionGoalInfo() {
    if (!session.goal) { session.goal = core.pick(SESSION_GOALS); }
    var g = session.goal, n = g.get();
    if (n >= g.n) {
      var next = core.pick(SESSION_GOALS);
      session.goal = next; g = next; n = g.get();
    }
    return { label: g.label, n: Math.min(n, g.n), goal: g.n };
  }

  /** HUD 3줄 — 다음 예고(§5-4 관문 대장이 들어오기 전까지의 대역, 위 주석 참고) */
  function nextInfo() {
    var key = findCandidate(core.save.track);
    if (!key) { return null; }
    var d = QD.find(key);
    return { key: key, name: d.name, need: d.need };
  }

  /** 세션 마무리 카드(§5-6)의 "다음에 할 것 1개" — 미완 추적 사명 > 열린 전직 > 다음 예고 순 */
  function nextTodo() {
    var t = trackedInfo();
    if (t) { return '📋 ' + t.name + ' (' + t.n + '/' + t.goal + ')'; }
    var J = global.DG.job, JD = global.DG.jobData;
    if (J && JD) {
      var opts = JD.nextJobs(core.save.job);
      for (var i = 0; i < opts.length; i++) {
        if (!J.canJoin(opts[i].key)) { return '🎓 ' + opts[i].name + ' 로 전직할 수 있습니다'; }
      }
    }
    var n = nextInfo();
    if (n) { return '🔜 ' + n.name + '(Lv.' + n.need + ')'; }
    return '🏃 사냥터로 돌아가기';
  }

  var bound = false;
  function init() {
    if (bound) { return; }
    bound = true;
    core.on('side:kill', onKill);
    core.on('side:gather', onGather);
    core.on('side:enter', onStage);
    core.on('side:travel', onStage);
    core.on('side:talk', onTalk);
    core.on('changed', onChanged);
    ensureDailyTrack();
  }

  global.DG = global.DG || {};
  global.DG.quest = {
    state: st, init: init,
    list: list, take: take, turnIn: turnIn,
    taken: taken, progress: progress, full: full, doneCount: doneCount,
    _onKill: onKill, _onGather: onGather, _onStage: onStage, _onTalk: onTalk,
    /** 진단 전용 — 일일 사명(PLAN 33절)의 '오늘' 표기. 실제 시각 없이도
     *  세이브에 이 문자열을 직접 넣어 "이미 오늘 했다"를 흉내낼 수 있다 */
    _todayKey: todayKey, doneToday: doneToday,
    /* 목표판(§5-6) */
    ensureDailyTrack: ensureDailyTrack, trackedInfo: trackedInfo,
    sessionGoalInfo: sessionGoalInfo, nextInfo: nextInfo, nextTodo: nextTodo,
    _session: session   // 진단 전용 — 초기화 없이 그대로 들여다본다
  };
})(window);
