  /* ── 신호로 끝나는 단계 ───────────────────────────────── */

  function onGuard(e) { var st = step(), t = st && st.type === 'boss' ? targetOf(st) : null; if (t && e && e.region === t.rk) { advance(); } }
  function onClear(e) {
    var st = step();
    if (st && st.type === 'defend' && e && typeof e.camp === 'string' && e.camp.indexOf(keyOf() + ':w') === 0) {
      defState().clr[+e.camp.slice(keyOf().length + 2)] = true;     // 마지막 물결까지 다 잡았는지는 stepDefend 가 본다
      return;
    }
    if (!st || (st.type !== 'kill' && st.type !== 'duel') || !e || e.camp !== keyOf()) { return; }
    if (st.type === 'duel') { dropAdds(); toast(st.win || '🎭 검은 가면이 먹구름 속으로 달아났다 — 졸개도 흩어진다'); }
    advance();
  }
  /** 원소 신호(e)와 한 점 사이 — 돌진·찌르기(x0,y0 가 있으면)는 지나간 선까지의 거리 */
  function elemDist(e, x, y) {
    if (typeof e.x0 !== 'number' || typeof e.y0 !== 'number') { return Math.hypot(e.x - x, e.y - y); }
    var vx = e.x - e.x0, vy = e.y - e.y0, L2 = vx * vx + vy * vy;
    var u = L2 > 0 ? Math.max(0, Math.min(1, ((x - e.x0) * vx + (y - e.y0) * vy) / L2)) : 0;
    return Math.hypot(x - (e.x0 + vx * u), y - (e.y0 + vy * u));
  }
  function onElement(e) {
    var st = step();
    if (!st || !e) { return; }
    if (st.type === 'seal') { onSeal(st, e); return; }
    if (st.type !== 'light') { return; }
    var t = targetOf(st);
    if (!t || elemDist(e, t.x, t.y) > (e.r || 3) + LIGHT_R()) { return; }
    if (st.perch && !gps()) {                                        // ⑲-47 등대 등롱 — 키보드 판은 그 기둥 위(난간 판)에 서야 닿는다
      var LFe = global.DG.landform, pe = LFe && LFe.perched ? LFe.perched() : null;
      if (pe !== st.perch) { toast(st.away || '🔥 불이 닿지 않는다 — 더 높이 올라서야 한다'); return; }
    }
    if (st.bell) {                                                  // ⑲-39 종각 종 — 불 대신 울린다
      var SPb = global.DG.skyport;
      if (SPb && SPb.ringBell) { SPb.ringBell(); }
      toast('🔔 뎅— 삼백 년 만에 절터 종이 울린다'); advance(); return;
    }
    toast(st.done || '🔥 옛 제단에 불이 붙었다 — 비문이 빛난다'); advance();
  }
  /* ⑲-14 석등 차례 — 켠 수는 저장 안 함 */
  var seal = { key: '', n: 0 };
  function sealLit() { return seal.key === keyOf() ? seal.n : 0; }
  function orderText(st) { return (st.order || SEAL_ORDER).map(function (k) { return SEAL_MARKS[k].name; }).join(' → '); }
  function onSeal(st, e) {
    var hits = sealLamps(st).filter(function (l) { return elemDist(e, l.x, l.y) <= (e.r || 3) + LIGHT_R(); }).map(function (l) { return l.k; });
    if (!hits.length) { return; }
    var order = st.order || SEAL_ORDER, was = sealLit(), n = sealHit(was, hits, order);
    seal = { key: keyOf(), n: n };
    if (n > was) {
      toast('🏮 ' + SEAL_MARKS[order[n - 1]].name + ' 석등이 켜졌다 (' + n + '/' + order.length + ')');
      if (n >= order.length) { toast('✨ 석등 셋이 다 켜졌다 — 봉인이 풀린다'); advance(); }
    } else if (n === 0 && was > 0) {
      toast('💨 차례가 틀렸다 — 석등이 모두 꺼졌다 (' + orderText(st) + ')');
    } else if (n === 0) {
      toast('💨 불이 붙지 않는다 — 비문 차례는 ' + orderText(st));
    }
  }
  /* ⑲-14 이야기 보스 — 2단계(방패·졸개) 여부. 저장 안 함 */
  var duel = null;          // { key, p2 }
  function addKey() { return keyOf() + ':add'; }
  /** 무리 하나를 통째로 치운다(흩어짐) */
  function dropCamp(key) {
    var F = FC(), S = F && F.state ? F.state() : null, cp = S ? S.camps[key] : null;
    if (!cp) { return; }
    cp.uids.forEach(function (u) { delete S.foes[u]; });
    delete S.camps[key];
    delete S.cleared[key];
  }
  function dropAdds() { dropCamp(addKey()); }
  /** 보스 한 박자 — 절반에서 뇌 방패 + 졸개 둘, 전멸해 되돌아가 다시 온전해지면 처음으로 */
  function duelBoss() {
    var F = FC(), S = F && F.state ? F.state() : null, cp = S ? S.camps[keyOf()] : null;
    return cp ? S.foes[cp.uids[0]] || null : null;
  }
  /** 2단계 방패 원소·졸개는 단계 칸(shield·adds, ⑲-16) — 없으면 6장 값 */
  function stepDuel() {
    var F = FC(), S = F && F.state ? F.state() : null, b = duelBoss(), st = step() || {};
    if (!b || b.dead) { return; }
    if (!duel || duel.key !== keyOf()) { duel = { key: keyOf(), p2: false }; }
    if (!duel.p2 && b.hp <= b.hpMax * DUEL_P2_AT) {
      var shEl = st.shield || 'elec';
      duel.p2 = true;
      b.layers = [shEl]; b.layer = 0; b.shEl = shEl;
      b.shieldMax = b.shield = Math.round(b.hpMax * DUEL_P2_SHIELD);
      F.spawnCamp(S, { key: addKey(), x: b.x, y: b.y, tier: b.tier, kind: 'story', sky: !!st.sky,
        foes: (st.adds || DUEL_ADDS).map(function (k, i) { return { kind: k, dx: i ? 3 : -3, dy: 2 }; }) });
      S.camps[addKey()].uids.forEach(function (u) { S.foes[u].st = 'chase'; });
      toast(st.p2 || '⛈️ 검은 가면이 먹구름을 둘렀다 — 불로 깨라! 가면 졸개가 뛰어든다');
    } else if (duel.p2 && b.st === 'idle' && b.hp >= b.hpMax) {
      duel.p2 = false;
      b.layers = []; b.layer = 0; b.shEl = null; b.shield = b.shieldMax = 0;
      dropAdds();
    }
  }
  /* ⑲-16 제단 지키기 — 제단 체력·물결은 저장 안 함(불러오면 그 단계 처음) */
  var def = null;           // { key, wave(-1 = 아직), t(이 물결 뒤 초), rest(쉬는 틈 초), hp, hpMax, warned, clr{물결: 다 잡음} }
  function defState() {
    if (!def || def.key !== keyOf()) { def = { key: keyOf(), wave: -1, t: 0, rest: 0, hp: 0, hpMax: 0, warned: false, clr: {} }; }
    return def;
  }
  function waveKey(n) { return keyOf() + ':w' + n; }
  function wavesOf(st) { return st.waves || DEFEND_WAVES; }
  /** 무리가 나오는 제단 기준 자리(dx, dy) — 단계 dirs(도, 북 0 시계 방향, ⑲-29)가 있으면 그 방향들만, 없으면 둘레 열두 자리 */
  function defendSlots(st) {
    if (!st.dirs) { return ringAt(0, 0, DEFEND_RING, DEFEND_SLOTS); }
    var ESd = global.DG.eraSites, dirs = st.dirs === 'land' ? (ESd ? ESd.landDirs() : [90, 135, 180, 225, 270]) : st.dirs;   // ⑲-34 바다 쪽 빼고
    return dirs.map(function (g) { var a = g * Math.PI / 180; return { x: Math.sin(a) * DEFEND_RING, y: -Math.cos(a) * DEFEND_RING }; });
  }
  function altarHpMax(c) { var F = FC(); return Math.round(DEFEND_HITS * (F && F.foeAtk ? F.foeAtk('boar', F.tierAt(c.x, c.y)) : 80)); }
  /** 물결 n — 둘레 열두 자리 중 4n 째부터, 처음부터 제단으로 곧장(siege) */
  function spawnWave(st, n) {
    var F = FC(), S = F && F.state ? F.state() : null, c = posOf(st), d = defState(), ks = wavesOf(st)[n];
    if (!S || !c || !ks) { return false; }
    var slots = defendSlots(st);
    F.spawnCamp(S, { key: waveKey(n), x: c.x, y: c.y, tier: F.tierAt(c.x, c.y), kind: 'story', sky: !!st.sky,   // ⑲-43 섬 위 물결
      foes: ks.map(function (k, i) { var q = slots[(n * 4 + i) % slots.length]; return { kind: k, dx: q.x, dy: q.y }; }) });
    S.camps[waveKey(n)].uids.forEach(function (u) { S.foes[u].siege = { x: c.x, y: c.y }; S.foes[u].st = 'chase'; });
    d.wave = n; d.t = 0;
    toast('🌊 물결 ' + (n + 1) + '/' + wavesOf(st).length + ' — ' + (st.who || '가면 무리가') + ' ' + (st.name || '제단') + '으로 몰려온다');
    return true;
  }
  /** 무너짐·전멸 — 무리가 흩어지고 DEFEND_REST 초 쉰 뒤 그 단계 처음부터 */
  function resetDefend(msg) {
    var st = step(), d = defState(), W = st ? wavesOf(st) : DEFEND_WAVES;
    for (var n = 0; n < W.length; n++) { dropCamp(waveKey(n)); }
    def = { key: keyOf(), wave: -1, t: 0, rest: DEFEND_REST, hp: d.hpMax, hpMax: d.hpMax, warned: false, clr: {} };
    toast(msg);
  }
  /** 한 박자 — 가까이 오면 첫 물결, 다 잡았거나 DEFEND_WAVE_SEC 초면 다음, 마지막까지 다 잡으면 다음 단계 */
  function stepDefend(dt) {
    var st = step();
    if (!st || st.type !== 'defend') { return null; }
    var F = FC(), S = F && F.state ? F.state() : null, c = posOf(st), d = defState(), W = wavesOf(st), p = pos();
    if (!S || !c) { return null; }
    if (!d.hpMax) { d.hpMax = d.hp = altarHpMax(c); }
    if (d.rest > 0) { d.rest = Math.max(0, d.rest - (dt || 0)); return d; }
    if (d.wave < 0) {
      if (Math.hypot(p.x - c.x, p.y - c.y) <= DEFEND_START()) { spawnWave(st, 0); }
      return d;
    }
    d.t += dt || 0;
    if (d.wave + 1 < W.length) {
      if (d.clr[d.wave] || d.t >= DEFEND_WAVE_SEC) { spawnWave(st, d.wave + 1); }
      return d;
    }
    for (var n = 0; n < W.length; n++) { if (!d.clr[n]) { return d; } }
    toast('🛡️ ' + (st.name || '제단') + '을 지켜 냈다 — 무리가 물러간다');
    advance();
    return null;
  }
  function onSiege(e) {
    var st = step();
    if (!st || st.type !== 'defend' || !e || typeof e.camp !== 'string' || e.camp.indexOf(keyOf() + ':w') !== 0) { return; }
    var d = defState(), nm = st.name || '제단';
    if (!d.hpMax || d.rest > 0) { return; }
    d.hp = Math.max(0, d.hp - (e.dmg || 0));
    if (d.hp <= 0) { resetDefend('💥 ' + nm + '이 무너졌다 — 무리가 흩어진다. ' + DEFEND_REST + '초 뒤 처음부터'); return; }
    if (!d.warned && d.hp <= d.hpMax / 2) { d.warned = true; toast('⚠️ ' + nm + '이 흔들린다 — 절반이 깎였다!'); }
  }
  function onWipe() {
    var st = step();
    if (st && st.type === 'defend' && def && def.key === keyOf() && def.wave >= 0) { resetDefend('🏳️ 물러난 사이 무리가 흩어졌다 — ' + DEFEND_REST + '초 뒤 처음부터'); }
  }
  function onDomain(e) {
    var st = step();
    if (!st || st.type !== 'domain' || !e) { return; }
    if (st.did ? e.id === st.did : e.kind === 'weekly') { advance(); }
  }
  /* 채집 센 수 — 단계 키가 바뀌면 0 부터(저장 안 함) */
  var prog = { key: '', n: 0 };
  function gathered() { return prog.key === keyOf() ? prog.n : 0; }
  function onGather(e) {
    var st = step();
    if (!st || st.type !== 'gather' || !e || e.item !== st.item) { return; }
    if (prog.key !== keyOf()) { prog = { key: keyOf(), n: 0 }; }
    prog.n += 1;
    if (prog.n >= st.count) { advance(); } else { toast('📖 ' + st.text + ' ' + prog.n + '/' + st.count); }
  }
  function onCook() { var st = step(); if (st && st.type === 'cook') { advance(); } }

  /* ── 따라가기 ─────────────────────────────────────────── */

  var fol = null;           // { key, i(지난 길 점), x, y, walking } — 저장 안 함
  /** 따라가는 길 점 — 단계 path([이름 붙은 자리, off]…, ⑲-28)가 있으면 그것, 없으면 4장 나그네 길. 자리를 모르면 null */
  function followPts(st) {
    var L = st.path ? st.path.map(function (e) { return spotPos(e[0], e[1]); }) : WANDER_PATH.map(function (o) { return at('home', o); });
    for (var i = 0; i < L.length; i++) { if (!L[i]) { return null; } }
    return L;
  }
  function followState() {
    var st = step();
    if (!st || st.type !== 'follow') { fol = null; return null; }
    if (!fol || fol.key !== keyOf()) {
      var pts = followPts(st);
      if (!pts) { fol = null; return null; }
      fol = { key: keyOf(), i: 0, x: pts[0].x, y: pts[0].y, walking: false };
    }
    return fol;
  }
  /** 한 박자 — 내가 가까우면 단계 speed(없으면 FOLLOW_SPEED)로 다음 길 점까지 걷고, 멀면 선다. 길 끝이면 단계를 끝낸다 */
  function stepFollow(dt) {
    var fs = followState();
    if (!fs) { return null; }
    var st = step(), pts = followPts(st), p = pos();
    if (Math.hypot(p.x - fs.x, p.y - fs.y) > FOLLOW_NEAR()) { fs.walking = false; return fs; }
    var left = ((!gps() && st.speed) || FOLLOW_SPEED) * (dt || 0);   // GPS 판은 실제 걸음이라 늘 FOLLOW_SPEED
    while (left > 0 && fs.i < pts.length - 1) {
      var nx = pts[fs.i + 1], d = Math.hypot(nx.x - fs.x, nx.y - fs.y);
      if (d <= left) { fs.x = nx.x; fs.y = nx.y; fs.i += 1; left -= d; }
      else { fs.x += (nx.x - fs.x) / d * left; fs.y += (nx.y - fs.y) / d * left; left = 0; }
    }
    fs.walking = true;
    if (fs.i >= pts.length - 1) { fol = null; toast(st.arrive || '🎭 나그네가 걸음을 멈췄다'); advance(); return null; }
    return fs;
  }

  /* ── 도둑 쫓기(⑲-19) ─────────────────────────────────── */

  var chase = null;         // { key, npc, i(지난 길 점), x, y, run(달아나는 중), pause } — 저장 안 함
  /** ⑲-21 달리는 인물 k 의 길 점 i — 그 인물 땅(zone) 탑 기준 runPath(도둑은 THIEF_PATH) */
  function runAt(k, i) { var n = NPCS[k] || NPCS.thief, o = (n.runPath || THIEF_PATH)[i]; return n.runSpot ? spotPos(n.runSpot, o) : at(n.zone, o); }   // ⑲-36 runSpot = 이름 붙은 자리 기준
  function runLen(k) { var n = NPCS[k] || NPCS.thief; return (n.runPath || THIEF_PATH).length; }
  function chaseState() {
    var st = step();
    if (!st || st.type !== 'chase') { chase = null; return null; }
    if (!chase || chase.key !== keyOf()) {
      var p0 = runAt(st.npc, 0);
      chase = p0 ? { key: keyOf(), npc: st.npc, i: 0, x: p0.x, y: p0.y, run: false, pause: 0 } : null;
    }
    return chase;
  }
  /** 달리는 인물 자리(기본 노 도둑) — 쫓는 중이면 달리는 곳, 아니면 길 첫 점 */
  function thiefAt(k) {
    k = k || 'thief';
    return chase && chase.key === keyOf() && chase.npc === k ? { x: chase.x, y: chase.y } : runAt(k, 0);
  }
  /**
   * 한 박자 — 잡혔나 먼저 보고(CHASE_CATCH), 서 있으면 CHASE_START 안에 들 때 달아난다. 달아나는 중엔 CHASE_SPEED 로
   * 다음 점까지, 점에 닿으면 CHASE_PAUSE 초 숨 고르기. 길 끝이면 놓친 것 — 처음 자리로
   */
  function stepChase(dt) {
    var cs = chaseState();
    if (!cs) { return null; }
    var p = pos(), d = Math.hypot(p.x - cs.x, p.y - cs.y);
    var cst = step() || {};
    if (d <= CHASE_CATCH()) { chase = null; toast(cst.caught || '🏃 노 도둑을 붙잡았다 — 노를 되찾았다'); advance(); return null; }
    if (!cs.run) {
      if (d <= CHASE_START()) { cs.run = true; cs.pause = 0; toast(cst.flee || '🏃 도둑이 노를 메고 달아난다 — 달려라!'); }
      return cs;
    }
    if (cs.pause > 0) { cs.pause = Math.max(0, cs.pause - (dt || 0)); return cs; }
    var left = CHASE_SPEED() * (dt || 0);
    while (left > 0 && cs.i < runLen(cs.npc) - 1) {
      var nx = runAt(cs.npc, cs.i + 1), nd = Math.hypot(nx.x - cs.x, nx.y - cs.y);
      if (nd <= left) { cs.x = nx.x; cs.y = nx.y; cs.i += 1; cs.pause = CHASE_PAUSE(); left = 0; }
      else { cs.x += (nx.x - cs.x) / nd * left; cs.y += (nx.y - cs.y) / nd * left; left = 0; }
    }
    if (cs.i >= runLen(cs.npc) - 1) {
      var p0 = runAt(cs.npc, 0);
      cs.i = 0; cs.x = p0.x; cs.y = p0.y; cs.run = false; cs.pause = 0;
      toast(cst.lost || '💨 놓쳤다 — 도둑이 처음 자리로 숨어들었다. 다시 가까이 가면 달아난다');
    }
    return cs;
  }

  /* ── 배(⑲-19) ───────────────────────────────────────── */

  /** sail 대화가 끝났을 때 — 키보드 판은 그 자리로 옮긴다(순간이동과 같은 길). GPS 판은 몸이 거기 있어 안 옮긴다 */
  function sail(st) {
    var W = global.DG.world, q = spotPos(st.to, st.toOff);
    if (!q) { return false; }
    if (W && W.mode === 'keyboard') {
      var p = pos();
      p.x = q.x; p.y = q.y;
      if (W.walkTo) { W.walkTo(p.x, p.y); }
      core().emit('region:teleport', { key: 'sail:' + st.to });
      if (st.sky) {                                                  // ⑲-43 하늘 섬으로 — 층을 올린다(발판 위일 때만)
        var LFs = global.DG.landform, SKs = global.DG.skyIsle;
        if (LFs && LFs.setSky && SKs && SKs.layerOn && SKs.layerOn() && SKs.padAt(p.x, p.y)) { LFs.setSky(true); }
      }
      toast(st.arrive || (st.to === 'isle' ? '⛵ 사공의 배가 물살을 가른다 — 바위섬에 닿았다' : '⛵ 배가 갈대 나루에 닿았다'));   // ⑲-42 단계 글
      return true;
    }
    toast(st.walk || ('⛵ 사공이 배를 띄웠다 — 물가를 따라 ' + (st.to === 'isle' ? '바위섬으로' : '나루로') + ' 걸어가자'));
    return false;
  }

  /** 한 박자 — go 도착·boss 이미 쓰러짐·kill 무리 세우기·혼잣말 */
  var lastIdle = {};
  function check() {
    if (!on()) { return; }
    var st = step(), p = pos(), t;
    if (st && st.type === 'go') {
      t = targetOf(st);
      if (t && Math.hypot(p.x - t.x, p.y - t.y) <= t.r) { advance(); return; }
    } else if (st && st.type === 'party') {
      if (partyOk(st)) { toast('🤝 세 시대의 동료가 한 명단에 모였다'); advance(); return; }
    } else if (st && st.type === 'boss') {
      t = targetOf(st);
      var FB = global.DG.fieldBoss;
      if (t && FB && FB.bloomAt && FB.bloomAt(t.rk) !== null) { advance(); return; }   // 이미 쓰러져 꽃을 기다린다
    } else if (st && st.type === 'climb' && st.pole) {
      /* ⑲-34 기중기 — 키보드 판은 들보 위에 서야(landform 기둥 타기), GPS 판은 기중기 곁에 닿으면 */
      var LFp = global.DG.landform;
      t = targetOf(st);
      var pid = LFp && LFp.perched ? LFp.perched() : null, want = typeof st.pole === 'string' ? st.pole : null;   // ⑲-38 pole: 'id' 면 그 기둥 위라야
      if (!gps() && pid && (!want || pid === want)) { toast(st.done || '✨ 들보 위 — 박혀 있던 날개 조각을 빼냈다'); advance(); return; }
      if (gps() && t && Math.hypot(p.x - t.x, p.y - t.y) <= POLE_GPS_R) { toast(st.gpsDone || '✨ 기중기 밑 — 다온이 걸어 둔 줄로 날개 조각을 끌어내렸다'); advance(); return; }
    } else if (st && st.type === 'climb') {
      t = targetOf(st);
      if (t && Math.hypot(p.x - t.x, p.y - t.y) <= t.r) { toast('⛰️ 봉우리 꼭대기에 올랐다'); advance(); return; }
    } else if (st && st.type === 'sky' && st.pad) {
      /* ⑲-35 키보드 판은 그 발판(관측대)에 내려서야, GPS 판은 시간 기둥 곁에 닿으면 */
      var SKo = global.DG.skyIsle, LFo = global.DG.landform, pdo;
      if (SKo && SKo.layerOn()) {
        pdo = LFo.onSky() ? SKo.padAt(p.x, p.y) : null;
        if (pdo && pdo.id === st.pad) { toast(st.done || '🔭 떠 있는 관측대에 내려섰다 — 틈새 파수가 지키고 있다'); advance(); return; }
      } else {
        t = targetOf(st);
        if (t && Math.hypot(p.x - t.x, p.y - t.y) <= CLIMB_R()) { toast(st.gpsDone || '⏳ 시간 기둥 곁에 닿았다 — 관측대 이야기는 이 둘레에서 이어진다'); advance(); return; }
      }
    } else if (st && st.type === 'sky') {
      /* ⑲-20 키보드 판은 섬 윗면에 내려서야, GPS 판은 기둥 곁(봉우리 둘레)에 닿으면 */
      var SKc = global.DG.skyIsle, LFc = global.DG.landform;
      if (SKc && SKc.layerOn()) {
        if (LFc.onSky()) { toast('☁️ 구름섬에 올라섰다 — 먹구름 무리가 지키고 있다'); advance(); return; }
      } else {
        t = targetOf(st);
        if (t && Math.hypot(p.x - t.x, p.y - t.y) <= CLIMB_R()) { toast('🌬️ 바람 기둥 곁에 닿았다 — 구름섬 이야기는 이 둘레에서 이어진다'); advance(); return; }
      }
    } else if (st && (st.type === 'kill' || st.type === 'duel')) {
      t = targetOf(st);
      var F = FC(), S = F && F.state ? F.state() : null, key = keyOf();
      if (t && S && !S.camps[key] && Math.hypot(p.x - t.x, p.y - t.y) < KILL_NEAR) {
        var ks = st.type === 'duel' ? [st.kind] : st.kinds;
        F.spawnCamp(S, { key: key, x: t.x, y: t.y, tier: F.tierAt(t.x, t.y), kind: 'story', sky: !!st.sky,
          foes: ks.map(function (k, i) { var a = i * 1.571, rr = ks.length === 1 ? 0 : 3; return { kind: k, dx: Math.cos(a) * rr, dy: Math.sin(a) * rr }; }) });
        toast(st.enter || (st.type === 'duel' ? '🎭 검은 가면이 봉우리에 내려섰다' : '⚔️ 먹구름 졸개가 나타났다'));
      }
      if (st.type === 'duel') { stepDuel(); }
    }
    /* 지금 단계가 아닌 인물 곁 — 혼잣말 한 줄(45초에 한 번) */
    var now = Date.now();
    for (var i = 0; i < NPC_KEYS.length; i++) {
      var k = NPC_KEYS[i], np = visible(k) ? npcPos(k) : null;
      if (!np || (st && (isTalk(st) || st.type === 'follow' || st.type === 'chase') && st.npc === k)) { continue; }
      if (Math.hypot(p.x - np.x, p.y - np.y) <= IDLE_R && (!lastIdle[k] || now - lastIdle[k] > IDLE_GAP)) {
        lastIdle[k] = now;
        var inf = npcInfo(k);
        toast('💬 ' + inf.name + ' — ' + inf.idle);
      }
    }
  }

  /* ── 대화 ─────────────────────────────────────────────── */

  var talk = null;          // { st, i, shown(나온 글자 수), since(마지막 글자 뒤 초), reply(고른 대답|null) } — 창이 열려 있으면
  /** 말을 걸 수 있는 단계들 — 따라가는 줄 · (세계 임무를 따라가면) 이야기 · 맡은 세계 임무의 다음 · 맡을 수 있는 세계 임무 첫 대화 */
  function talkables() {
    var out = [step()], tq = tracking(), w = wqs();
    if (tq) { out.push(storyStep()); }
    if (WQD) {
      WQD.ORDER.forEach(function (id) {
        if (id === tq) { return; }
        if (typeof w.steps[id] === 'number') { out.push(wqDef(id).steps[w.steps[id]]); } else if (wqAvail(id)) { out.push(wqDef(id).steps[0]); }
      });
    }
    return out;
  }
  /** 곁(TALK_R)에서 말을 걸 수 있는 가장 가까운 대화 단계 — 같으면 따라가는 줄이 먼저 */
  function nearTalk() {
    var L = talkables(), p = pos(), best = null, bd = Infinity;
    for (var i = 0; i < L.length; i++) {
      var st = L[i];
      if (!isTalk(st) || !visible(st.npc)) { continue; }
      var sa = stepAt(st), np = npcPos(st.npc, sa.c, sa.i, sa.wq), d = np ? Math.hypot(p.x - np.x, p.y - np.y) : Infinity;
      if (d <= TALK_R() && d < bd - 1e-9) { bd = d; best = st; }
    }
    return best;
  }
  function busy() {
    var D = global.DG;
    return !!((D.encounter && D.encounter.active) || (D.duel && D.duel.active) || (D.domain && D.domain.active && D.domain.active()) ||
      (document.body && document.body.classList.contains('sheet-open')));
  }
  /** 지금 창에 나온 줄 — 고른 대답이 있으면 "나" 의 줄 */
  function curLine() { return !talk ? null : (talk.reply !== null ? ['나', talk.reply] : talk.st.lines[talk.i]); }
  function lineLen(line) { return line && line[0] !== '?' ? String(line[1]).length : 0; }
  function fresh() { talk.shown = REVEAL_CPS() > 0 ? 0 : lineLen(curLine()); talk.since = 0; }
  /** 곁이면 대화를 연다 */
  function talkStart() {
    var st = nearTalk();
    if (!st || talk || busy()) { return false; }
    /* ⑲-21 그 대화의 줄로 넘어간다 — 안 맡은 세계 임무면 맡는다 */
    var sa = stepAt(st);
    if (sa.wq) { if (wqStepOf(sa.wq) === null) { wqStart(sa.wq); } else { setTrack(sa.wq); } } else { setTrack(null); }
    if (step() !== st) { return false; }
    talk = { st: st, i: 0, shown: 0, since: 0, reply: null };
    fresh();
    paintTalk();
    return true;
  }
  function talking() { return !!talk; }
  /** 줄이 다 나왔나 */
  function lineFull() { var l = curLine(); return !l || l[0] === '?' || talk.shown >= lineLen(l); }
  /**
   * 누르기 한 번 — 글이 흘러나오는 중이면 줄 전체를 보이고, 다 나왔으면 다음 줄.
   * 고르는 줄이면 choice(0·1)로 대답을 고른다(대답이 "나" 의 줄로 한 번 나온다). 마지막 줄 뒤면 단계를 끝낸다
   */
  function next(choice) {
    if (!talk) { return false; }
    var line = curLine();
    if (line[0] === '?') {
      if (typeof choice !== 'number' || !line[1][choice]) { return false; }
      talk.reply = line[1][choice];
      fresh(); paintTalk();
      return true;
    }
    if (!lineFull()) { talk.shown = lineLen(line); talk.since = 0; paintTalk(); return true; }
    if (talk.reply !== null) { talk.reply = null; }
    talk.i += 1;
    if (talk.i >= talk.st.lines.length) {
      var done0 = talk.st;
      talk = null; paintTalk();
      if (done0.type === 'sail') { sail(done0); }                         // ⑲-19 배
      advance();
      return true;
    }
    fresh(); paintTalk();
    return true;
  }
  function speakerOf(name, fallback) {
    if (name === '?' || name === '나') { return 'me'; }
    for (var i = 0; i < NPC_KEYS.length; i++) { if (NPCS[NPC_KEYS[i]].short === name) { return NPC_KEYS[i]; } }
    return fallback;
  }
  /**
   * 대화 연출이 읽는 값(world3d → talkface) — 대화가 없으면 null.
   * { who('me'|인물 key), npc(대화 상대 key), spk·lst({x,y} 말하는 이·듣는 이), speaking, vowel, open(0~1), emo, line }
   */
  function talkShot() {
    if (!talk) { return null; }
    var TF = global.DG.talkface, k = talk.st.npc, np = npcPos(k), p = pos(), line = curLine();
    if (!np) { return null; }
    var who = speakerOf(line[0], k), me = who === 'me', n = Math.floor(talk.shown);
    var txt = line[0] === '?' ? '' : String(line[1]);
    var open = txt && n > 0 ? Math.max(0, 1 - talk.since / (TF ? TF.MOUTH_CLOSE : 0.14)) : 0;
    return {
      who: who, npc: k, spk: me ? { x: p.x, y: p.y } : np, lst: me ? np : { x: p.x, y: p.y },
      speaking: !!txt && (n < txt.length || talk.since < 0.4), vowel: TF && n > 0 ? TF.vowelOf(txt.charAt(n - 1)) : null,
      open: open, emo: line[2] || null, line: talk.i * 2 + (talk.reply !== null ? 1 : 0)
    };
  }

  /* ── 화면 ─────────────────────────────────────────────── */

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDist(d) { return d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm'; }
  /** 추적 한 줄 글 — 세이브·자리만 읽는다 */
  function trackText() {
    var tq = on() ? tracking() : null;
    if (!on() || (!tq && done())) { return ''; }
    var ch = chapter();
    if (!tq && locked()) { return '📖 ' + ch.name + ' — 여정 등급 ' + ch.ar + ' 에 열린다'; }
    var st = step(), t = targetOf(st), p = pos(), d = t ? Math.hypot(p.x - t.x, p.y - t.y) : 0;
    var what = st.text;
    if (st.type === 'gather') { what += ' ' + gathered() + '/' + st.count; }
    if (st.type === 'party') { var pe0 = partyEras(); what += ' — ' + (st.eras || ['과거', '현대', '미래']).map(function (k) { return k + (pe0[k] ? ' ✔' : ' ✗'); }).join(' '); }
    if (st.type === 'follow' && d > FOLLOW_LOST()) { what = '너무 멀다, 가까이!'; }
    if (st.type === 'chase') { what = chase && chase.key === keyOf() && chase.run ? NPCS[st.npc].name + ' ' + Math.round(d) + 'm — 달려라!' : st.text + ' (가까이 가면 달아난다)'; }   // ⑲-19
    if (st.type === 'seal') { what += ' ' + sealLit() + '/' + (st.order || SEAL_ORDER).length + ' (' + orderText(st) + ')'; }
    if (st.type === 'duel') {
      var b = duelBoss(), FF = FC() && FC().FOES[st.kind];
      if (b && !b.dead) {
        what = (FF ? FF.name : '검은 가면') + ' ' + Math.ceil(100 * b.hp / b.hpMax) + '%' +
          (b.shield > 0 ? ' · ' + ({ elec: '⚡', water: '💧' }[b.shEl] || '🛡️') + '방패 ' + b.shield : '');
      }
    }
    if (st.type === 'defend') {                                // ⑲-16
      var dd = def && def.key === keyOf() ? def : null;
      if (dd && dd.rest > 0) { what += ' · ' + Math.ceil(dd.rest) + '초 뒤 다시'; }
      else if (dd && dd.wave >= 0) { what = (st.name || '제단') + ' ' + Math.ceil(100 * dd.hp / dd.hpMax) + '% · 물결 ' + (dd.wave + 1) + '/' + wavesOf(st).length; }
      else { what += ' (가까이 가면 무리가 온다)'; }
    }
    return (tq ? '🔷 ' + wqDef(tq).name : '📖 ' + ch.name) + ' — ' + what + (t ? ' · ◆ ' + fmtDist(d) : '');
  }
  function el(id, cls) {
    var e = document.getElementById(id);
    if (!e && document.body) { e = document.createElement('div'); e.id = id; if (cls) { e.className = cls; } document.body.appendChild(e); }
    return e;
  }
  var lastTrack = '', lastBtn = '';
  function paintHud() {
    if (!document.body) { return; }
    var tr = el('story-track'), txt = trackText();
    if (txt !== lastTrack) { lastTrack = txt; tr.textContent = txt; tr.style.display = txt ? '' : 'none'; }
    var b = el('story-btn'), st = !talk && !busy() ? nearTalk() : null, bt = st ? '💬 ' + NPCS[st.npc].short + (NPCS[st.npc].era ? '(' + NPCS[st.npc].era + ')' : '') + '와 이야기 (F)' : '';
    if (bt !== lastBtn) { lastBtn = bt; b.textContent = bt; b.style.display = bt ? '' : 'none'; }
  }
  function shownText() { var l = curLine(); return String(l[1]).slice(0, Math.floor(talk.shown)); }
  function paintTalk() {
    var box = el('story-talk');
    if (!box) { return; }
    if (!talk) { box.classList.remove('show'); box.innerHTML = ''; return; }
    var line = curLine(), acts;
    if (line[0] === '?') {
      acts = line[1].map(function (a, i) { return '<button class="btn primary" data-st-pick="' + i + '">' + esc(a) + '</button>'; }).join('');
      box.innerHTML = '<div class="st-box"><b class="st-who">나</b><p class="st-line">……</p><div class="st-acts">' + acts + '</div></div>';
    } else {
      box.innerHTML = '<div class="st-box" data-st-next="1"><b class="st-who">' + esc(line[0]) + '</b><p class="st-line">' + esc(shownText()) + '</p>' +
        '<div class="st-acts"><small class="muted">' + (talk.i + 1) + '/' + talk.st.lines.length + '</small>' +
        '<button class="btn primary" data-st-next="1">' + (talk.i + 1 < talk.st.lines.length || talk.reply !== null ? '다음 ▸' : '끝') + '</button></div></div>';
    }
    box.classList.add('show');
  }
  /** 흘러나오는 동안은 글 한 줄만 바꾼다 — 창을 통째로 다시 쓰면 누르던 단추가 바뀌어 누름이 빠진다 */
  function paintLine() {
    var box = document.getElementById('story-talk'), p = box && box.querySelector('.st-line');
    if (p && talk && curLine()[0] !== '?') { p.textContent = shownText(); }
  }
  /** 글자 흘리기 한 박자 */
  function reveal(dt) {
    if (!talk) { return; }
    var line = curLine(), len = lineLen(line), cps = REVEAL_CPS();
    if (line[0] !== '?' && talk.shown < len && cps > 0) {
      var was = Math.floor(talk.shown);
      talk.shown = Math.min(len, talk.shown + cps * (dt || 0));
      if (Math.floor(talk.shown) !== was) { talk.since = 0; if (!global.DG_NO_DRAW) { paintLine(); } return; }
    }
    talk.since += dt || 0;
  }
  /** O 목록 — 장마다 끝남·지금(단계 ✓)·잠김 */
  function listHtml() {
    var s = sv(), out = '<div class="st-box"><div class="st-head"><b class="st-who">📖 이야기 임무</b><span class="st-head-btns">' +
      (canAutoWalk() ? '<button class="btn ghost" data-st-go="1">' + (autoWalk ? '⏹ 자동 이동 끄기' : '🧭 자동 이동') + '</button>' : '') +
      '<button class="btn ghost" data-st-close="1" aria-label="닫기">✕</button></span></div><div class="st-scroll">';
    var doneN = 0, hidLock = 0;
    for (var c = 0; c < CHAPTERS.length; c++) {
      if (c < s.ch) { doneN++; if (c === s.ch - 1) { out += '<div class="st-ch"><small class="muted">✅ 끝난 이야기 ' + doneN + '장</small></div>'; } continue; }
      if (c > s.ch + 2) { hidLock++; if (c === CHAPTERS.length - 1) { out += '<div class="st-ch"><small class="muted">🔒 그 뒤 ' + hidLock + '장</small></div>'; } continue; }
      var ch = CHAPTERS[c], state = c < s.ch ? '✅ 끝' : (c === s.ch ? ((core().save.player.level || 1) < ch.ar ? '🔒 여정 등급 ' + ch.ar : '▶ 진행 중') : '🔒 여정 등급 ' + ch.ar);
      out += '<div class="st-ch"><b>' + esc(ch.name) + '</b> <small>' + state + '</small>';
      if (c === s.ch && state === '▶ 진행 중') {
        for (var i = 0; i < ch.steps.length; i++) {
          out += '<small style="display:block" class="' + (i < s.step ? 'muted' : '') + '">' + (i < s.step ? '✓' : (i === s.step ? '◆' : '◇')) + ' ' + esc(ch.steps[i].text) + '</small>';
        }
      }
      out += '</div>';
    }
    /* ⑲-21 세계 임무 — 끝·따라가는 중·맡음(따라가기 단추)·맡을 수 있음(! 누구에게)·잠김 */
    if (WQD) {
      var w = wqs(), tq = tracking(), lv = core().save.player.level || 1;
      out += '<b class="st-who" style="display:block;margin-top:10px">🔷 세계 임무</b>';
      WQD.ORDER.forEach(function (id) {
        var q = wqDef(id), g = NPCS[q.giver], got = typeof w.steps[id] === 'number', fin = w.done.indexOf(id) >= 0;
        var state = fin ? '✅ 끝' : (id === tq ? '▶ 따라가는 중' : (got ? '◇ 맡음' : (lv >= q.ar ? '❗ ' + q.place + ' ' + g.short + '에게' : '🔒 여정 등급 ' + q.ar)));
        out += '<div class="st-ch"><b>' + esc(q.name) + '</b> <small>' + state + '</small>';
        if (got && id !== tq) { out += ' <button class="btn ghost" data-wq-track="' + id + '">따라가기</button>'; }
        if (id === tq) {
          for (var j = 0; j < q.steps.length; j++) {
            out += '<small style="display:block" class="' + (j < w.steps[id] ? 'muted' : '') + '">' + (j < w.steps[id] ? '✓' : (j === w.steps[id] ? '◆' : '◇')) + ' ' + esc(q.steps[j].text) + '</small>';
          }
        }
        out += '</div>';
      });
      if (tq && !done()) { out += '<div class="st-ch"><button class="btn ghost" data-wq-track="">📖 이야기 임무 따라가기</button></div>'; }
    }
    return out + '</div><div class="st-acts"><button class="btn ghost" data-st-close="1">닫기 (O)</button></div></div>';
  }

  /* ── 자동 이동 — 지금 임무 표식까지 저절로 걸어간다(키보드 판 전용 — GPS 판은 사람이 걷는다) ─────────
     끄는 때: 표식 가까이 닿았을 때 · 직접 조작(스틱·키·탭)했을 때 · 대화가 시작됐을 때 · 표식이 없을 때.
     싸움 중엔 world 가 걷기를 막으니 그 동안은 기다린다(무리를 쓰러뜨리면 이어 걷는다). */
  var autoWalk = false, awArmed = false, awAcc = 0, awLast = { x: 0, y: 0 };
  function canAutoWalk() {
    var W = global.DG.world;
    return !!(W && W.walkTo && !gps());
  }
  function setAutoWalk(v) {
    autoWalk = !!v && canAutoWalk();
    awArmed = false; awAcc = 0;
    if (!autoWalk) { var W = global.DG.world; if (W && W.walkingTo && W.walkingTo() && W.walkTo) { /* 걷던 목표는 그대로 두면 도착까지 간다 */ } }
    lastGo = null;
    if (listOpen) { toggleList(true); }
  }
  function stepAutoWalk(dt) {
    if (!autoWalk) { return; }
    var W = global.DG.world, st = step(), t = st ? targetOf(st) : null;
    if (!W || !t || talk) { if (!t || talk) { setAutoWalk(false); } return; }
    var p = pos(), d = Math.hypot(t.x - p.x, t.y - p.y), stopR = Math.max((t.r || 0) * 0.7, 5);
    if (d <= stopR) { setAutoWalk(false); return; }
    var wt = W.walkingTo();
    if (awArmed) {                            // 우리가 건 걷기가 아니게 됐다 — 도착이 아니라면(멀다) 사람이 직접 조작(스틱·다른 곳 탭)한 것
      if (!wt || Math.hypot(wt.x - awLast.x, wt.y - awLast.y) > 1) {
        awArmed = false;
        if (d > stopR + 8) { setAutoWalk(false); return; }
      } else if (Math.hypot(t.x - awLast.x, t.y - awLast.y) > 3) {
        awArmed = false;                      // 표식이 움직였다(따라가기·추격) — 새로 건다
      }
    }
    awAcc += dt || 0;
    if (!awArmed && awAcc > 0.25 && !W.inputBlocked()) {
      awAcc = 0;
      W.walkTo(t.x, t.y, d > 45);
      awLast = { x: t.x, y: t.y };
      awArmed = true;
    }
  }
  var lastGo = null;
  function paintGo() {
    var b = el('story-go'), t = !talk && !busy() && canAutoWalk() ? (step() && targetOf(step()) ? (autoWalk ? '⏹' : '🧭') : '') : '';
    if (!t && autoWalk && !talk) { setAutoWalk(false); }
    if (t !== lastGo) {
      lastGo = t; b.textContent = t; b.style.display = t ? '' : 'none';
      b.title = autoWalk ? '자동 이동 끄기' : '임무 표식까지 자동 이동';
      b.classList.toggle('on', autoWalk);
    }
  }
  var listOpen = false;
  function toggleList(v) {
    var box = el('story-list');
    listOpen = typeof v === 'boolean' ? v : !listOpen;
    if (!box) { return; }
    box.innerHTML = listOpen ? listHtml() : '';
    box.classList.toggle('show', listOpen);
  }

  /* 3D — 목표 금빛 기둥 · 옛 제단(light·defend 단계) */
  var fx = {}, clock = 0;
  /** ⑲-16 제단 체력 몫(0~1) → 기둥 빛깔(빨강 0xff4040 ↔ 초록 0x4cd964) */
  function pillarHex(k) {
    k = Math.max(0, Math.min(1, k));
    var r = Math.round(0xff + (0x4c - 0xff) * k), g = Math.round(0x40 + (0xd9 - 0x40) * k), b = Math.round(0x40 + (0x64 - 0x40) * k);
    return (r << 16) | (g << 8) | b;
  }
  function W3() { var w = global.DG.world3d; return w && w.active && w.active() ? w : null; }
  function dropFx(k) { var w = W3(); if (w && fx[k]) { w.removeFx(fx[k]); } delete fx[k]; }
  function paint3d(dt) {
    clock += dt || 0;
    var w = W3(), st = step(), t = st && !talk ? targetOf(st) : null, p = pos();
    if (!w || !t || Math.hypot(t.x - p.x, t.y - p.y) > 900) { dropFx('pillar'); dropFx('altar'); dropFx('seal'); return; }
    var T3 = w.three();
    if (!T3) { return; }
    var gy = w.standY ? w.standY(t.x, t.y, skyOf(st)) : (w.groundY ? w.groundY(t.x, t.y) : 0);   // ⑲-20 섬 위 목표는 섬 윗면에
    if (!fx.pillar) {
      var g = new T3.Group();
      var mat = new T3.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, depthWrite: false, blending: T3.AdditiveBlending, fog: false });
      var cyl = new T3.Mesh(new T3.CylinderGeometry(0.9, 0.9, 60, 12, 1, true), mat);
      cyl.position.y = 30; g.add(cyl);
      w.addFx(g); fx.pillar = g;
    }
    fx.pillar.position.set(t.x, gy, t.y);
    fx.pillar.children[0].material.opacity = 0.28 + Math.sin(clock * 2.2) * 0.08;
    /* ⑲-16 지키는 동안은 기둥이 제단 체력 — 초록 → 빨강 */
    var dd = st.type === 'defend' && def && def.key === keyOf() && def.hpMax && def.wave >= 0 ? def : null;
    fx.pillar.children[0].material.color.setHex(dd ? pillarHex(dd.hp / dd.hpMax) : 0xffd24a);
    if ((st.type === 'light' && !st.bell && !st.bare) || (st.type === 'defend' && !st.bare)) {   // ⑲-39·40 종·변전함은 등롱 없이(장치가 skyport 에 있다)
      if (!fx.altar) {
        var A = global.DG.asset3d, m = A && A.build ? A.build('lantern', { id: 'story_altar' }) : null, ag = new T3.Group();
        if (m) { m.scale.set(1.8, 1.8, 1.8); ag.add(m); }
        w.addFx(ag); fx.altar = ag;
      }
      fx.altar.position.set(t.x, gy, t.y);
    } else { dropFx('altar'); }
    /* ⑲-14 석등 셋 — 등롱 위에 빛깔 구슬, 켜지면 밝고 크게 */
    if (st.type === 'seal') {
      var L = sealLamps(st), order = st.order || SEAL_ORDER, lit = order.slice(0, sealLit());
      if (!fx.seal || fx.seal.userData.key !== keyOf()) {
        dropFx('seal');
        var sg = new T3.Group(), A3 = global.DG.asset3d;
        sg.userData.key = keyOf();
        L.forEach(function (l) {
          var lg = new T3.Group(), lm = A3 && A3.build ? A3.build('lantern', { id: 'story_seal_' + l.k }) : null;
          if (lm) { lm.scale.set(1.4, 1.4, 1.4); lg.add(lm); }
          var orb = new T3.Mesh(new T3.SphereGeometry(0.45, 14, 10),
            new T3.MeshBasicMaterial({ color: new T3.Color(SEAL_MARKS[l.k].color), transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
          orb.position.y = 3.2; lg.add(orb);
          lg.userData = { k: l.k, x: l.x, y: l.y, orb: orb };
          sg.add(lg);
        });
        w.addFx(sg); fx.seal = sg;
      }
      fx.seal.children.forEach(function (lg) {
        var on = lit.indexOf(lg.userData.k) >= 0, u = lg.userData;
        lg.position.set(u.x, w.standY ? w.standY(u.x, u.y, skyOf(st)) : (w.groundY ? w.groundY(u.x, u.y) : gy), u.y);   // ⑲-43 섬 위 석등은 윗면에
        u.orb.material.opacity = on ? 0.95 : 0.25 + Math.sin(clock * 3) * 0.05;
        u.orb.scale.setScalar(on ? 1.35 : 1);
      });
    } else { dropFx('seal'); }
  }

  /** ⑲-22 활 조준에 잠길 것 — 따라가는 줄의 안 켠 석등(seal)·옛 제단(light) [{kind, x, y}]. 충전 화살이 멈추면 원소 신호 */
  function aimPoints() {
    var st = on() ? step() : null;
    if (!st) { return []; }
    if (st.type === 'seal') {
      var lit = (st.order || SEAL_ORDER).slice(0, sealLit());
      return sealLamps(st).filter(function (l) { return lit.indexOf(l.k) < 0; }).map(function (l) { return { kind: 'lamp', x: l.x, y: l.y }; });
    }
    if (st.type === 'light') { var t = targetOf(st); return t ? [{ kind: 'altar', x: t.x, y: t.y }] : []; }
    return [];
  }
  /** ⑲-21 맡을 사람 머리 위 푸른 ! (코드 그림 — 막대 + 점). 맡을 수 있는 것은 밝게, 이어 갈 것은 흐리게 */
  var markFx = {};
  function paintMarks3d() {
    var w = W3(), T3 = w && w.three(), seen = {}, k, p = pos();
    if (T3) {
      wqMarks().forEach(function (m) {
        if (Math.hypot(m.x - p.x, m.y - p.y) > 150) { return; }
        seen[m.k] = true;
        if (!markFx[m.k]) {
          var g = new T3.Group(), mat = new T3.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.95, fog: false });
          var bar = new T3.Mesh(new T3.BoxGeometry(0.16, 0.6, 0.16), mat); bar.position.y = 0.5; g.add(bar);
          var dot = new T3.Mesh(new T3.SphereGeometry(0.1, 10, 8), mat); g.add(dot);
          markFx[m.k] = w.addFx(g);
        }
        var gy = w.standY ? w.standY(m.x, m.y, false) : (w.groundY ? w.groundY(m.x, m.y) : 0);
        markFx[m.k].position.set(m.x, gy + 2.5 + Math.sin(clock * 2.5) * 0.12, m.y);
        markFx[m.k].rotation.y = clock * 1.4;
        markFx[m.k].children[0].material.opacity = m.fresh ? 0.95 : 0.55;
      });
    }
    for (k in markFx) { if (markFx.hasOwnProperty(k) && !seen[k]) { if (w) { w.removeFx(markFx[k]); } delete markFx[k]; } }
  }

  /** 지금 세울 이야기 인물 — folk.live 와 같은 모양 `{p, x, y, walking, phase, ang, dist}`. 대화 상대는 나를 본다 */
  function live(p0, tms) {
    if (!on() || !p0) { return []; }
    var out = [], i, pp = pos(), fs = fol && step() && step().type === 'follow' ? fol : null;
    for (i = 0; i < NPC_KEYS.length; i++) {
      var k = NPC_KEYS[i], n = NPCS[k], q = visible(k) ? npcPos(k) : null;
      if (!q) { continue; }
      var d = Math.hypot(q.x - p0.x, q.y - p0.y);
      if (d > 110) { continue; }
      var face = talk && talk.st.npc === k, inf = npcInfo(k), fw = !!(fs && fs.walking && step().npc === k);
      /* 바라보는 곳 — 대화 상대면 나 · 길(path)을 걷는 중이면 다음 길 점(⑲-28) · 아니면 제 땅 탑(spot 인물은 그 자리) */
      var a = fw && step().path ? followPts(step())[Math.min(fs.i + 1, step().path.length - 1)] : (n.spot ? spotPos(n.spot) : anchorOf(n.zone));
      out.push({ p: { id: n.id, name: inf.name, color: n.color, rarity: 3, trait: 'virtue', story: k, mask: inf.mask, pet: n.pet || null }, sky: inf.sky,
        x: q.x, y: q.y, walking: !!(fw || (n.runPath && chase && chase.npc === k && chase.run && !(chase.pause > 0))), phase: (tms || 0) / 480,
        ang: face ? Math.atan2(pp.y - q.y, pp.x - q.x) : (a ? Math.atan2(a.y - q.y, a.x - q.x) : 0), dist: d });
    }
    return out;
  }
  /** 미니맵 점 — 목표 하나(테두리에도) */
  function marker() {
    var st = step(), t = st ? targetOf(st) : null;
    return t ? { x: t.x, y: t.y, name: st.text } : null;
  }

  var acc = 0, bound = false;
  function tick(dt) {
    if (!on()) { return; }
    acc += dt || 0;
    if (acc > 0.5) { acc = 0; check(); }
    stepAutoWalk(dt);
    stepFollow(dt);
    stepChase(dt);
    stepDefend(dt);
    reveal(dt);
    if (!global.DG_NO_DRAW) { paintHud(); paintGo(); paint3d(dt); paintMarks3d(); }
  }
  function bind() {
    if (bound) { return; }
    bound = true;
    var c = core();
    c.on('field:guard', onGuard);
    c.on('field:clear', onClear);
    c.on('field:element', onElement);
    c.on('field:siege', onSiege);
    c.on('field:wipe', onWipe);
    c.on('domain:clear', onDomain);
    c.on('cook:gather', onGather);
    c.on('cook:done', onCook);
    if (!global.addEventListener || !document.body) { return; }
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) { return; }
      if (t.closest('#story-btn')) { talkStart(); }
      else if (t.closest('[data-st-pick]')) { next(+t.closest('[data-st-pick]').getAttribute('data-st-pick')); }
      else if (t.closest('[data-st-next]')) { next(); }
      else if (t.closest('[data-st-close]')) { toggleList(false); }
      else if (t.closest('[data-st-go]')) { setAutoWalk(!autoWalk); toggleList(false); }
      else if (t.closest('#story-go')) { setAutoWalk(!autoWalk); }
      else if (t.closest('[data-wq-track]')) { setTrack(t.closest('[data-wq-track]').getAttribute('data-wq-track') || null); toggleList(true); }
      else if (t.closest('#story-track')) { toggleList(); }
    });
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (!on() || e.repeat || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      if (global.DG.fishing && global.DG.fishing.active) { return; }       // ⑲-24 낚시 중 F 는 낚시 것
      var k = (e.key || '').toLowerCase();
      if (talk) {
        if (curLine()[0] === '?') { if (k === '1' || k === '2') { e.preventDefault(); next(+k - 1); } return; }
        if (k === 'f' || k === ' ' || k === 'enter') { e.preventDefault(); next(); }
        return;
      }
      if (k === 'f' && nearTalk()) { e.preventDefault(); talkStart(); }
      else if (k === 'o') { toggleList(); }
      else if (k === 'g' && canAutoWalk() && step()) { setAutoWalk(!autoWalk); }
      else if (k === 'escape' && listOpen) { toggleList(false); }
    });
  }
  function init() { hookFind(); if (on()) { sv(); catchUp(); } bind(); }

  global.DG = global.DG || {};
  global.DG.story = {
    NPCS: NPCS, CHAPTERS: CHAPTERS, MEMBERS: MEMBERS, join: join, catchUp: catchUp, hasMember: hasMember, STEP_EXP: STEP_EXP, WANDER_PATH: WANDER_PATH, FOLLOW_SPEED: FOLLOW_SPEED,
    POLE_GPS_R: POLE_GPS_R, SEAL_R: SEAL_R, SEAL_LAYOUT: SEAL_LAYOUT, SEAL_ORDER: SEAL_ORDER, SEAL_MARKS: SEAL_MARKS, SPOTS: SPOTS, CLIMB_R: CLIMB_R,
    MEMBER_TIME: MEMBER_TIME, memberTime: memberTime, partyEras: partyEras, partyOk: partyOk, autoParty: autoParty,
    DUEL_P2_AT: DUEL_P2_AT, DUEL_P2_SHIELD: DUEL_P2_SHIELD, peakSpot: peakSpot, spotPos: spotPos, placeOf: placeOf,
    DEFEND_RING: DEFEND_RING, DEFEND_WAVE_SEC: DEFEND_WAVE_SEC, DEFEND_REST: DEFEND_REST, DEFEND_HITS: DEFEND_HITS, DEFEND_WAVES: DEFEND_WAVES, DEFEND_START: DEFEND_START,
    CAPE_CLEAR: CAPE_CLEAR, capeSpot: capeSpot, landAt: landAt, ringAt: ringAt, stepDefend: stepDefend, defState: function () { return def && def.key === keyOf() ? def : null; },
    waveKey: waveKey, pillarHex: pillarHex,
    THIEF_PATH: THIEF_PATH, CHASE_SPEED: CHASE_SPEED, CHASE_PAUSE: CHASE_PAUSE, CHASE_START: CHASE_START, CHASE_CATCH: CHASE_CATCH, ISLE_R: ISLE_R,
    isleSpot: isleSpot, elemDist: elemDist, wetNeighbors: wetNeighbors, stepChase: stepChase, thiefAt: thiefAt, chaseState: function () { return chase && chase.key === keyOf() ? chase : null; }, isTalk: isTalk,
    sealLamps: sealLamps, sealHit: sealHit, sealLit: sealLit, duelBoss: duelBoss, stepDuel: stepDuel, npcInfo: npcInfo, skyOf: skyOf,
    WQ: WQD, wqs: wqs, wqDef: wqDef, wqStepOf: wqStepOf, tracking: tracking, setTrack: setTrack, wqStart: wqStart, wqAvail: wqAvail, wqMarks: wqMarks, mapMarks: mapMarks, revealed: revealed,
    talkables: talkables, storyStep: storyStep, stepAt: stepAt, aimPoints: aimPoints,
    FOLLOW_NEAR: FOLLOW_NEAR, FOLLOW_LOST: FOLLOW_LOST,
    HARAM_OBS: HARAM_OBS, HARAM_SHIP: HARAM_SHIP, HARAM_FORT: HARAM_FORT, frostSpot: frostSpot, followPts: followPts,
    CAVE_FIGHT: CAVE_FIGHT, BANDI_CAVE: BANDI_CAVE, HEART: HEART, DAREUM_SHIP: DAREUM_SHIP, CAPTAIN_PATH: CAPTAIN_PATH, SEED_DRONE_PATH: SEED_DRONE_PATH, VAULT_DRONE_PATH: VAULT_DRONE_PATH, AMBER_THIEF_PATH: AMBER_THIEF_PATH, WING_SEAM: WING_SEAM, FORT_GATE: FORT_GATE, BAWOO_GATE: BAWOO_GATE, BEACON: BEACON, LAKE_SEAL: LAKE_SEAL, BAWOO_LAKE: BAWOO_LAKE, BEACON_DIRS: BEACON_DIRS, defendSlots: defendSlots,
    on: on, anchorOf: anchorOf, npcPos: npcPos, visible: visible, targetOf: targetOf, trackText: trackText, listHtml: listHtml,
    state: sv, chapter: chapter, step: step, locked: locked, done: done, keyOf: keyOf, gathered: gathered,
    advance: advance, check: check, stepFollow: stepFollow, nearTalk: nearTalk, talkStart: talkStart, talking: talking, next: next,
    lineFull: lineFull, curLine: curLine, reveal: reveal, talkShot: talkShot,
    live: live, marker: marker, toggleList: toggleList, init: init, tick: tick,
    autoWalk: function () { return autoWalk; }, setAutoWalk: setAutoWalk,
    _resetForTest: function () {
      talk = null; lastIdle = {}; anchorMemo = {}; lastTrack = ''; lastBtn = ''; listOpen = false;
      fol = null; prog = { key: '', n: 0 }; aimMemo = { k: '', v: null }; seal = { key: '', n: 0 }; duel = null; peakMemo = null;
      def = null; capeMemo = null; chase = null; isleMemo = null;
    }
  };
})(window);
