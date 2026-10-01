  /* ── 회차 ─────────────────────────────────────────────── */

  /* ── 난도(難度) — 원작의 노멀 · 나이트메어 · 헬 ───
   * 원작에서 한 바퀴를 돈 사람은 같은 땅을 **더 사나운 규칙**으로 다시 돈다.
   * 여기서는 최고 층으로 열린다 — 열 층을 밟으면 험(險), 스무 층이면 절(絕).
   */
  var MODES = [
    { key: 'normal', name: '평(平)', need: 0,  hp: 1,    dmg: 1,   bias: 0,  gold: 1,   exp: 1,
      desc: '처음 내려가는 길.' },
    { key: 'hard',   name: '험(險)', need: 10, hp: 1.8,  dmg: 1.5, bias: 12, gold: 1.6, exp: 1.5, resist: 10,
      desc: '적이 두 배 가까이 버티고 손도 맵다. 저항도 붙는다. 대신 나오는 것이 좋아진다.' },
    { key: 'hell',   name: '절(絕)', need: 20, hp: 3.2,  dmg: 2.2, bias: 26, gold: 2.4, exp: 2.2, resist: 20,
      desc: '한 대가 치명적이다. 저항이 두껍다. 부문(符文)도 여기서 잘 나온다.' }
  ];

  function modeOf(key) {
    for (var i = 0; i < MODES.length; i++) { if (MODES[i].key === key) { return MODES[i]; } }
    return MODES[0];
  }

  /** 지금 열려 있는 난도들 */
  function modesOpen() {
    var best = dstate().best || 0;
    return MODES.filter(function (m) { return best >= m.need; });
  }

  /** 이번 회차의 난도 (던전 밖이면 고른 값) */
  function mode() {
    if (run && run.mode) { return modeOf(run.mode); }
    return modeOf(dstate().mode);
  }

  function setMode(key) {
    var m = modeOf(key);
    if ((dstate().best || 0) < m.need) { return false; }
    dstate().mode = m.key;
    core.emit('changed');
    core.persist();
    return true;
  }

  function dstate() {
    var s = core.save;
    if (!s.dungeon) { s.dungeon = { best: 0, runs: 0, kills: 0, clears: 0, mode: 'normal' }; }
    if (!s.dungeon.mode) { s.dungeon.mode = 'normal'; }
    /* 월드 보스(§5.4) — 슬롯(15분 단위)마다 마을·자리가 결정적으로 갈린다.
       `bossDone`은 슬롯 번호를 키로 이중 보상을 막는다(끝없이 안 늘게
       stepWorldBoss가 지난 슬롯을 솎아 낸다). */
    if (!s.dungeon.world) { s.dungeon.world = { slot: null, townId: null, spawned: false, bossDone: {} }; }
    return s.dungeon;
  }

  function active() { return !!run; }

  /**
   * 던전에 들어간다.
   * @param opts {floor} 시작 층 (기본 1)
   */
  /** 결사로 스러진 판인가 — 그렇다면 더 못 내려간다 */
  function fallen() { return !!(core.save.dungeon && core.save.dungeon.fallen); }

  function enter(opts) {
    if (fallen()) {
      core.emit('toast', '☠️ 결사로 스러진 판입니다 — 새 이름으로 시작하세요');
      return false;
    }
    opts = opts || {};
    if (!core.save.party.length) {
      core.emit('toast', '⚠️ 부대가 없습니다 — 먼저 인물을 등용하세요');
      return false;
    }
    if (run) { return false; }
    var horde = !!opts.horde;
    /* 부적(§5.3) — 굴혈 앞에서 쓸 부적 하나를 미리 고른다. 여기서 없으면
       (남이 먼저 썼거나 id 오타) 아예 안 들어간다 — run을 만들기 전에
       실패해야 이도 저도 아닌 상태가 안 생긴다. */
    var IT0 = global.DG.item;
    var sig = opts.sigilId && IT0 && IT0.sigilById ? IT0.sigilById(opts.sigilId) : null;
    if (opts.sigilId && !sig) {
      core.emit('toast', '⚠️ 그 부적을 찾을 수 없습니다');
      return false;
    }
    /* 시련(§5.11) — 열린 단계까지만. 제10층을 밟아야 열린다(부적과 같은 문턱) */
    var trialLv = 0;
    if (opts.trial && !horde && !sig) {
      trialLv = Math.round(opts.trial);
      if (!trialReady() || trialLv < 1 || trialLv > trialState().open) {
        core.emit('toast', '⚠️ 아직 열리지 않은 시련입니다');
        return false;
      }
    }
    var nmMods = sig ? DD.rollMods(sig.seed) : null;
    /* 난입(§5.5)·부적(§5.3)은 층이 없다 — 지금까지 밟은 최고 층을 적 배율
       기준으로만 빌린다(spawnEnemy 가 floor 인자를 요구해서다, 화면엔 안
       보인다). 부적은 최소 10층부터(드랍 조건과 맞춘다). */
    var floor = horde ? Math.max(1, dstate().best || 1) :
      (sig || trialLv) ? Math.max(10, dstate().best || 10) : Math.max(1, Math.round(opts.floor || 1));
    /* 난도는 들어갈 때 정해지고 회차 내내 바뀌지 않는다 */
    var md = modeOf(opts.mode || dstate().mode);
    if ((dstate().best || 0) < md.need) { md = MODES[0]; }
    if (sig) { IT0.removeSigil(sig.id); }     // 여기서부터는 실패해도 되돌리지 않는다(원작도 소모품)
    run = {
      mode: horde ? 'horde' : md.key, horde: horde,
      /* 부적(§5.3) — 없으면 null. `run.nightmare.roomT` 는 'timer' 변형자일
         때만 뜻이 있다(없으면 그냥 안 줄어든 채로 논다). */
      nightmare: sig ? { sigilId: sig.id, tier: sig.tier, mods: nmMods.mods,
        resistElem: nmMods.resistElem, roomT: 75 } :
        /* 시련(§5.11)은 부적 던전의 틀(방·문·적 배율 1+0.35×단계)을 빌린다 — 변형자는 없다 */
        trialLv ? { sigilId: null, tier: trialLv, mods: [], resistElem: null, roomT: 75, trial: true } : null,
      trial: trialLv ? { lv: trialLv, t: TRIAL_SEC, prog: 0, guardian: false, won: false, deaths: 0 } : null,
      floor: floor, startFloor: floor,
      boons: {}, choice: null, boonPicks: 0,   // 축복(§5.1) — 회차 전체 상한 8은 boonPicks로 센다
      hpMax: 0, hp: 0,
      buffs: {}, minions: [],          // 잠깐짜리 무예 · 분신 (회차 안에서만 산다)
      mp: MP_MAX, mpMax: MP_MAX,
      shots: [],                          // 기공파 투사체
      foeShots: [],                       // 궁수·조총병이 쏘는 것 (몬스터 다양화)
      roomIdx: 0, rooms: [], room: null,
      loot: { gold: 0, items: [] },
      fieldSpawnCd: 4,                    // 들판 로머 보충 주기(초) — PLAN 10절 "필드 사냥"
      fieldTreasureCd: 90,                 // 필드 보물 조우 재확인 주기(초) — PLAN §60 후보 1
      fieldMerchantCd: 60,                 // 필드 방랑 상인 재확인 주기(초) — PLAN §60 후보 1 나머지 절반
      hitstopT: 0,                        // 타격 정지(hitstop) 남은 초 — 2026-09-10 "전투가 심심하다"
      slowT: 0,                           // §5.8② 저스트 회피 슬로우 남은 초(2026-09-18)
      combo: 0, comboT: 0,                // 연속 타격 수 · 끊기는 문턱(초)
      /* 난입(§5.5) 전용 — 일반 회차에서는 안 건드린다 */
      hordeT: 0, hordeWaveCd: HORDE_WAVE_INTERVAL, hordeWave: 0, hordeLevel: 1,
      kills: 0, startedAt: Date.now(), dead: false
    };
    run.hpMax = hpMaxOf();
    run.hp = run.hpMax;
    if (horde) {
      buildHordeRoom();
      dstate().horde = dstate().horde || { best: 0, runs: 0 };
      dstate().horde.runs += 1;
      core.log('⚔️ 난입(亂入) 시작', 'info');
    } else if (trialLv) {
      buildNightmareRoom();
      run.roomTotal = TRIAL_ROOMS;           // 방은 끝없이 — 끝은 진척 막대와 수호자가 정한다
      trialState().runs += 1;
      core.log('⏳ 시련(試鍊) · 제' + trialLv + '단계 — 15분 안에 수호자를 쓰러뜨려라', 'info');
    } else if (sig) {
      buildNightmareRoom();
      core.log('📜 부적 던전 · 티어 ' + sig.tier + ' 진입', 'info');
    } else {
      buildFloor();
      dstate().runs += 1;
      core.log('🕳️ 던전 진입 · 제' + floor + '층 (' + DD.themeOf(floor).name + ') · ' +
        md.name, 'info');
      registerRegion(floor);
    }
    /* 손이 비어 있으면 첫 무예 하나를 얹어 준다 — 배운 게 없으면 평타밖에 없다 */
    if (global.DG.skill) { global.DG.skill.ensureStarter(leadId()); }
    core.emit('dungeon:enter', run);
    core.emit('changed');
    return true;
  }

  /** 플레이어 전투 상태 하나 — 층 진입(`buildFloor`)·난입 진입
   *  (`buildHordeRoom`)이 똑같이 쓴다(§5.5, 2026-09-18 분리). */
  function makePlayer() {
    return {
      x: WALL + 40, y: ROOM_H * 0.5, atkCd: 0, phase: 0, walking: false, facing: 1, hurt: 0,
      atkAnim: 0,                         // 공격 자세 남은 시간(초) — 3D·2D 렌더가 읽는다
      cds: [0, 0, 0, 0],                  // 스킬 쿨다운 (남은 초)
      dash: null,                         // 돌진 중 { t, dx, dy, hit } (무예 "돌진" 모양)
      invuln: 0,                          // 무적 남은 초 (돌진·회피)
      rallyUntil: 0,                      // 사기 버프가 끝나는 시각 (ms)
      /* 2026-09-10 — "강공격이랑 전용 회피 버튼도"(사용자). 스킬(Z X C V,
         MP 소모·슬롯 필요)과 달리 **누구나 처음부터 쓰는 기본기**다 —
         쿨다운만 있고 MP·무예 습득이 필요 없다. */
      heavyCd: 0,                         // 강공격 재사용 대기(초)
      dodge: null,                        // 회피 중 { t, dx, dy } (dash와 달리 적을 안 벤다)
      dodgeCd: 0,                         // 회피 재사용 대기(초)
      /* 2026-09-10 — "방어구 세트마다 특색 스킬"(사용자). 투장 세 점을
         한 인물이 다 걸쳐야 손에 잡히는 세트 전용 무예 — 강공격·회피와
         같은 자리(쿨다운만, MP·슬롯 안 씀)에 셋째로 놓는다. */
      setSkCd: 0,                         // 투장 무예 재사용 대기(초)
      /* 2026-09-11 — "캐릭터마다 스킬이 달라야 해"(사용자). 인물별 서명
         무예 — 장비가 아니라 이 인물이 선두면 상시 켜지는 넷째 기본기. */
      sigSkCd: 0                          // 서명 무예 재사용 대기(초)
    };
  }

  function buildFloor() {
    var fdef = fixedFor(run.floor);
    run.fixed = fdef;
    var total = fdef ? fdef.rooms.length : DD.roomsFor(run.floor);
    run.rooms = [];
    run.roomIdx = 0;
    var firstKind = 'fight';
    run.room = fdef ? makeFixedRoom(fdef, 0) : makeRoom(firstKind, run.floor, 0, total);
    run.roomTotal = total;
    run.room.doors = fdef ? fixedDoors(fdef, 0) : makeDoors(run.floor, 0, total);
    if (fdef) {
      var fst = fixedState()[fdef.floor];
      core.log(fdef.emoji + ' 명소 — ' + fdef.name + '(' + fdef.hanja + ') · ' + fdef.intro, 'info');
      core.emit('toast', fdef.emoji + ' ' + fdef.name + (fst && fst.clears ? ' · 답파 ' + fst.clears + '번' : ' — ' + fdef.intro));
    }
    run.corridors = doorCorridors(run.room.doors);   // PLAN §28-4 Phase 2
    run.player = makePlayer();
    run.shots = [];
    run.foeShots = [];
    /* 동행(同行) — 부대 2번째 인물이 있으면 용병처럼 곁에서 같이 싸운다
       (PLAN §51, 2026-09-06 사용자 요청 "동료도 따라다니면서 같이
       싸우던지 용병처럼"). 층이 바뀔 때만 다시 잡는다 — `run.player`와
       같은 주기다. */
    run.companion = spawnCompanion();
    var heal = boonVal('healOnFloor');
    if (heal) { healBy(run.hpMax * heal / 100); }
    /* 역참(驛站) — 원작의 웨이포인트. **다섯 층마다** 밟으면 다음부터 거기서 시작한다.
       "최고의 절반" 하나로 갈음하던 자리를, 원작처럼 **밟은 곳**으로 바꿨다 */
    if (run.floor % WAYPOINT_EVERY === 0) { markWaypoint(run.floor); }
    /* 유품(§5.2) — 이 층에 지난 사망의 노획물이 있으면 첫 방에 표식을 세운다 */
    var gv = dstate().grave;
    if (gv && gv.floor === run.floor) {
      run.room.grave = { x: ROOM_W * 0.3, y: ROOM_H * 0.5, taken: false };
      core.emit('toast', '🪦 유품이 이 층에 있다');
    }
    run.fieldSpawnCd = 3;
    spawnFieldEncounters(8 + Math.min(4, Math.floor(run.floor / 4)));   // §5.19 두 무리쯤으로 시작
  }

  /* ── 난입(亂入, §5.5) ─────────────────────────────────────
   * 방 하나에 파도로 계속 밀어붙인다 — 문도 상자도 없다, 15분 생존 또는
   * 사망으로 끝난다. `dungeon.js` 의 방·전투·축복 시스템을 그대로 빌려
   * 쓴다(PLAN 원문 "기존 spawnEnemy·축복 3택 UI 를 전부 재사용"). 방
   * 크기를 원문대로 3배로 키우려면 `ROOM_W`/`ROOM_H` 를 쓰는 렌더·이동·
   * 필드 코드 전부를 방마다 다른 크기로 다시 짜야 해서(2D·3D·미니맵·
   * 코너 경계 전부) 범위를 넘는다고 보고 **표준 방 크기 그대로** 썼다 —
   * PLAN 원문에 없던 판단이라 여기 적는다. */
  var HORDE_WAVE_INTERVAL = 30;     // 파도 간격(초)
  var HORDE_ENEMY_CAP = 40;         // 동시 적 상한
  var HORDE_DURATION = 900;         // 생존 목표(초) = 15분

  function buildHordeRoom() {
    run.rooms = [];
    run.roomIdx = 0;
    run.roomTotal = 1;
    run.room = makeRoom('fight', run.floor, 0, 1);
    run.room.enemies = [];            // 파도가 직접 채운다
    run.room.doors = [];              // 문 없음 — 나가는 길은 "나간다" 뿐
    run.room.cleared = true;
    run.corridors = [];
    run.player = makePlayer();
    run.shots = [];
    run.foeShots = [];
    run.companion = spawnCompanion();
    spawnHordeWave();
  }

  /** 파도 하나 — 적 수 6+2×파도(상한 40), 티어는 파도/8 (PLAN §5.5 수치표) */
  function spawnHordeWave() {
    if (!run || !run.horde) { return; }
    run.hordeWave += 1;
    var room = run.room;
    var want = Math.min(HORDE_ENEMY_CAP - room.enemies.length, 6 + 2 * run.hordeWave);
    var tier = Math.floor(run.hordeWave / 8);
    for (var i = 0; i < want; i++) {
      room.enemies.push(spawnEnemy(run.floor + tier, false, { spawned: true }));
    }
    room.cleared = false;
    core.emit('toast', '⚔️ 파도 ' + run.hordeWave);
    core.emit('changed');
  }

  /** 레벨(처치 경험) — 파도와 별개로 누적 처치(`run.kills`)가 기준이다.
   *  레벨 L 을 찍으려면 처치가 L² × 10 이 되어야 한다(§5.5 "경험 곡선"). */
  function hordeLevelCheck() {
    if (!run || !run.horde || run.choice) { return; }
    var leveled = false, guard = 0;
    while (run.kills >= run.hordeLevel * run.hordeLevel * 10 && guard < 5) {
      run.hordeLevel += 1;
      leveled = true;
      guard++;
    }
    if (!leveled) { return; }
    var c = rollBoonChoice();
    if (c.length) {
      run.choice = c;
      sfx('shrine');
      core.emit('toast', '⭐ 레벨 ' + run.hordeLevel + ' · 하나를 고르세요');
    }
  }

  /** 15분 생존 — 시간 비례 보상을 주고 끝낸다(사망은 `die()` 의 별도 갈래) */
  function endHordeSurvive() {
    if (!run || !run.horde) { return null; }
    var secs = Math.round(run.hordeT);
    var gold = Math.round(secs * 0.8), feat = Math.max(1, Math.round(secs / 20));
    core.save.player.gold += gold;
    core.gainFeat(feat, '난입 완주');
    var hs = dstate().horde || (dstate().horde = { best: 0, runs: 0 });
    if (secs > (hs.best || 0)) { hs.best = secs; }
    /* 10분 이상이면 부적 1(PLAN 원문, §5.3 착수로 이제 줄 자리가 생겼다) */
    if (secs >= 600 && global.DG.item && global.DG.item.addSigil) {
      global.DG.item.addSigil(1);
    }
    var s = settleLoot('난입 완주');
    run = null;
    core.emit('dungeon:end', { reason: 'horde', floor: 0,
      horde: { secs: secs, gold: gold, feat: feat }, loot: s });
    core.log('🏆 난입 완주 · ' + secs + '초 생존 · 금 +' + core.fmt(gold), 'good');
    core.emit('toast', '🏆 난입 완주! ' + secs + '초 생존');
    core.emit('changed');
    core.persist();
    return { secs: secs, gold: gold, feat: feat };
  }

  /* ── 부적(符籍) 던전 — 나이트메어 티어(§5.3) ──────────────────
   * 5방 고정(문·복도 구조는 그대로, `goRoom`/`makeDoors`를 같이 쓴다),
   * 보스층 없이 마지막 방만 정예 무리. 적 배율·보상 배율은 티어(T)로,
   * 변형자는 부적 seed 로 결정적이다(§5.3 진단 문안).
   */
  var NM_ROOM_TOTAL = 5;
  var NM_ROOM_TIMER = 75;         // 'timer' 변형자일 때 방마다 이만큼(초)

  function nmHasMod(key) { return !!(run && run.nightmare && run.nightmare.mods.indexOf(key) >= 0); }
  /* 부적 '암흑' 변형자(§5.3) — 예전엔 아이콘만 뜨고 아무 일도 없었다(PLAN §7.2, 2026-09-23 닫음).
     시야 반경(방 논리 좌표, 방은 560×360) 밖의 적은 미니맵 점에서 빠지고(minimap.js),
     화면은 가장자리가 어두운 덧씌우기로 덮인다(dungeon-view.js #dg-dark). 3D 안개·판정은 안 건드린다 */
  var NM_DARK_R = 150;
  function darkSight() { return nmHasMod('dark') ? NM_DARK_R : 0; }
  /** 적 배율 — 1 + 0.35×T (§5.3 수치표, 진단이 이 형태를 그대로 잰다) */
  function nmMul() { return (run && run.nightmare) ? 1 + 0.35 * run.nightmare.tier : 1; }
  /** 보상 배율 — 티어분(1+0.25×T) × 변형자 '풍요'(있으면 1.5) */
  function nmLootMul() {
    if (!run || !run.nightmare) { return 1; }
    var m = 1 + 0.25 * run.nightmare.tier;
    if (nmHasMod('loot')) { m *= 1.5; }
    return m;
  }

  /** 방마다 문은 하나뿐이다 — 5방 고정이라 상자방·사당방 같은 갈림길이
   *  없다(makeDoors의 다양한 kind 는 이 회차엔 안 맞는다, PLAN "5방 고정"
   *  이 뜻하는 대로 "가 볼 곳"이 아니라 "다음"만 있다). 마지막 방은
   *  descend() 대신 endNightmareClear() 로 가게 kind 를 'stair' 로 둔다. */
  function nmDoors(isLast) { return [{ kind: isLast ? 'stair' : 'fight', y: ROOM_H * 0.5 }]; }

  function buildNightmareRoom() {
    run.rooms = [];
    run.roomIdx = 0;
    run.roomTotal = NM_ROOM_TOTAL;
    run.room = makeRoom('fight', run.floor, 0, NM_ROOM_TOTAL);
    run.room.doors = nmDoors(false);
    run.corridors = doorCorridors(run.room.doors);
    run.player = makePlayer();
    run.shots = [];
    run.foeShots = [];
    run.companion = spawnCompanion();
    if (nmHasMod('timer')) { run.nightmare.roomT = NM_ROOM_TIMER; }
  }

  /** 방이 다 찼는데(5방) 시간 안에 못 끝냈다 — 노획물만 잃고 마을로 */
  function endNightmareFail() {
    if (!run || !run.nightmare) { return null; }
    var tier = run.nightmare.tier;
    core.log('⏱️ 부적 던전 · 티어 ' + tier + '에서 시간이 다 되어 실패했다', 'bad');
    core.emit('toast', '⏱️ 시간 초과 — 부적 던전 실패');
    run = null;
    core.emit('dungeon:end', { reason: 'nightmare-fail', floor: 0, nightmare: { tier: tier } });
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 5방을 다 치웠다 — 노획물 확정 + 다음 티어 부적 60% */
  function endNightmareClear() {
    if (!run || !run.nightmare) { return null; }
    var tier = run.nightmare.tier;
    var s = settleLoot('부적 던전 완주');
    core.gainFeat(4 + tier, '부적 던전 완주');
    var nm = dstate();
    if (tier > (nm.nmBest || 0)) { nm.nmBest = tier; }
    var got = null;
    if (tier < 10 && Math.random() < 0.6) {
      var r = global.DG.item.addSigil(tier + 1);
      if (r.ok) { got = r.sigil; }
    }
    run = null;
    core.log('📜 부적 던전 완주 · 티어 ' + tier +
      (got ? (' · 다음 부적(티어 ' + got.tier + ') 획득') : ''), 'good');
    core.emit('toast', '📜 부적 던전 완주! 티어 ' + tier);
    core.emit('dungeon:end', { reason: 'nightmare', floor: 0,
      nightmare: { tier: tier, nextSigil: !!got }, loot: s });
    core.emit('changed');
    core.persist();
    return { tier: tier, gotNext: !!got };
  }

  /* ── 시련(試鍊, §5.11) — 대균열식 시간 도전 ─────────────────────
   * 원작 3편 대균열 자리. 단계를 골라 들어가 **15분 안에** 진척 막대(100)를
   * 채우면 시련 수호자가 나온다 — 쓰러뜨리면 완주, 기록이 순위표에 남고
   * 전설 한 점(비전이 붙는다, §5.10)을 받는다. 절반(7분 30초) 넘게 남기면 두 단계가 열린다.
   * 죽어도 끝나지 않는다 — 시계가 30초 깎이고 그 자리에서 일어선다(원작도 시간만 잃는다).
   * 시간이 다 되면 주운 것은 챙겨 나온다(기록·보상 없음). 적 배율은 부적과 같은 1+0.35×단계. */
  var TRIAL_SEC = 900, TRIAL_GOAL = 100, TRIAL_DEATH_SEC = 30, TRIAL_MAX = 100;
  var TRIAL_ROOMS = 999, TRIAL_BOARD = 10, TRIAL_NEED = 10;

  function trialState() {
    var d = dstate();
    if (!d.trial || typeof d.trial !== 'object') { d.trial = {}; }
    var ts = d.trial;
    if (typeof ts.best !== 'number') { ts.best = 0; }
    if (typeof ts.open !== 'number' || ts.open < 1) { ts.open = 1; }
    if (typeof ts.runs !== 'number') { ts.runs = 0; }
    if (!Array.isArray(ts.board)) { ts.board = []; }
    return ts;
  }
  function trialReady() { return (dstate().best || 0) >= TRIAL_NEED; }

  /** 처치 하나가 채우는 진척 — 정예 8 · 보스 10 · 갈라진 그림자 1 · 잡졸 3 */
  function trialPts(e) {
    if (e.trialGuardian) { return 0; }
    if (e.boss) { return 10; }
    if (e.elite) { return 8; }
    if (e.shade || e.spawned) { return 1; }
    return 3;
  }

  function trialOnKill(e) {
    var T = run.trial;
    if (e.trialGuardian) { T.won = true; return; }   // 끝내기는 다음 틱(stepTrial) — kill() 도중 run 을 비우지 않는다
    if (T.guardian) { return; }
    T.prog = Math.min(TRIAL_GOAL, T.prog + trialPts(e));
    if (T.prog >= TRIAL_GOAL) { summonTrialGuardian(); }
  }

  function summonTrialGuardian() {
    var T = run.trial, p = run.player;
    var g = spawnEnemy(run.floor, true, {
      x: core.clamp(p.x + 140, WALL + 30, ROOM_W - WALL - 30), y: ROOM_H * 0.5
    });
    g.trialGuardian = true;
    run.room.enemies.push(g);
    run.room.cleared = false;
    T.guardian = true;
    fx.push({ t: 'ring', x: g.x, y: g.y, life: 0.8 });
    core.log('⏳ 시련 수호자 — ' + enemyName(g) + ' 이(가) 나타났다', 'info');
    core.emit('toast', '⏳ 시련 수호자 등장!');
  }

  /** 순위표 — 높은 단계, 같은 단계면 빨리 끝낸 순. 들어간 자리(1~10)를 돌려준다, 밖이면 0 */
  function recordTrial(entry) {
    var ts = trialState();
    ts.board.push(entry);
    ts.board.sort(function (a, b) { return (b.lv - a.lv) || (a.sec - b.sec) || (a.at - b.at); });
    if (ts.board.length > TRIAL_BOARD) { ts.board.length = TRIAL_BOARD; }
    return ts.board.indexOf(entry) + 1;
  }

  /** @returns {boolean} 회차가 끝났으면 true */
  function stepTrial(dt) {
    var T = run.trial;
    if (T.won) { endTrialClear(); return true; }
    T.t -= dt;
    if (T.t <= 0) { endTrialFail(); return true; }
    return false;
  }

  /** 시련 중 쓰러짐 — 시계 30초를 내고 그 자리에서 일어선다 */
  function reviveTrial() {
    var T = run.trial;
    T.deaths += 1;
    T.t -= TRIAL_DEATH_SEC;
    dstate().deaths = (dstate().deaths || 0) + 1;
    if (T.t <= 0) { endTrialFail(); return; }
    run.hp = run.hpMax;
    run.player.invuln = 2;
    run.player.dots = [];
    fx.push({ t: 'ring', x: run.player.x, y: run.player.y, life: 0.7 });
    core.log('💀 시련 · 쓰러졌다 — 시계 ' + TRIAL_DEATH_SEC + '초를 내고 다시 일어선다', 'bad');
    core.emit('toast', '💀 −' + TRIAL_DEATH_SEC + '초 · 다시 일어선다');
  }

  function endTrialClear() {
    var T = run.trial, lv = T.lv;
    var left = Math.max(0, Math.round(T.t)), used = TRIAL_SEC - left;
    /* 완주 보상 — 전설 한 점(비전이 붙는다). 노획물에 얹어 같이 확정한다 */
    var IT = global.DG.item;
    if (IT && IT.roll) { run.loot.items.push(IT.roll(run.floor + lv, { tier: 4 })); }
    var s = settleLoot('시련 완주');
    core.gainFeat(6 + lv, '시련 완주');
    var ts = trialState(), jump = left >= TRIAL_SEC / 2 ? 2 : 1;
    if (lv > ts.best) { ts.best = lv; }
    ts.open = Math.min(TRIAL_MAX, Math.max(ts.open, lv + jump));
    var rank = recordTrial({ lv: lv, sec: used, hero: leadId(), deaths: T.deaths, at: Date.now() });
    run = null;
    core.log('🏆 시련 제' + lv + '단계 완주 · ' + core.fmtTime(used) + (rank ? ' · 순위 ' + rank + '위' : '') +
      ' · 제' + ts.open + '단계까지 열림', 'good');
    core.emit('toast', '🏆 시련 제' + lv + '단계 완주!');
    core.emit('dungeon:end', { reason: 'trial', floor: 0,
      trial: { lv: lv, sec: used, left: left, jump: jump, rank: rank, open: ts.open }, loot: s });
    core.emit('changed');
    core.persist();
    return { lv: lv, sec: used, rank: rank, jump: jump };
  }

  function endTrialFail() {
    var lv = run.trial.lv;
    var s = settleLoot('시련 시간 초과');
    run = null;
    core.log('⏱️ 시련 제' + lv + '단계 · 시간이 다 되었다 — 주운 것만 챙겨 나온다', 'bad');
    core.emit('toast', '⏱️ 시련 시간 초과');
    core.emit('dungeon:end', { reason: 'trial-fail', floor: 0, trial: { lv: lv }, loot: s });
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 다음 방으로 */
  function goRoom(kind) {
    if (!run || !run.room.cleared) { return false; }
    if (kind === 'stair') { return run.nightmare ? endNightmareClear() : descend(); }
    run.roomIdx += 1;
    var isLast = run.roomIdx >= run.roomTotal - 1;
    if (run.nightmare) {
      /* 마지막 방 — "정예 무리"(PLAN 원문). 일반 elite 방(하나만 정예)과
         달리 방 전체를 정예로 채운다 — `spawnEnemy`의 forceElite 를 그대로
         재사용해 스탯 계산(등급별 hp/dmg 배율)을 새로 안 만든다. */
      run.room = makeRoom('fight', run.floor, run.roomIdx, run.roomTotal);
      if (isLast) {
        var packN = 4 + Math.min(3, Math.floor(run.nightmare.tier / 3));
        run.room.enemies = [];
        for (var pi = 0; pi < packN; pi++) {
          run.room.enemies.push(spawnEnemy(run.floor, false, { forceElite: true }));
        }
        run.room.cleared = false;
      }
      run.room.doors = nmDoors(isLast);
      run.nightmare.roomT = NM_ROOM_TIMER;
    } else {
      if (run.fixed) {
        run.room = makeFixedRoom(run.fixed, run.roomIdx);
        run.room.doors = fixedDoors(run.fixed, run.roomIdx);
        core.emit('toast', run.fixed.emoji + ' ' + run.room.title + (isLast ? ' — ' + run.fixed.guard.desc : ''));
      } else {
        var isBoss = DD.isBossFloor(run.floor) && isLast;
        run.room = makeRoom(isBoss ? 'boss' : kind, run.floor, run.roomIdx, run.roomTotal);
        run.room.doors = makeDoors(run.floor, run.roomIdx, run.roomTotal);
      }
    }
    run.corridors = doorCorridors(run.room.doors);   // PLAN §28-4 Phase 2
    run.player.x = WALL + 40;
    run.player.y = ROOM_H * 0.5;
    if (run.companion) { run.companion.x = WALL + 70; run.companion.y = ROOM_H * 0.5 + 34; }
    target = null;
    if (!run.nightmare) {
      run.fieldSpawnCd = 4;
      spawnFieldEncounters(2 + Math.min(2, Math.floor(run.floor / 6)));
    }
    core.emit('dungeon:room', run.room);
    return true;
  }

  /* 결사 서약자(정본 side_vow) — 결사(하드코어)로 굴혈 깊이 10·20·30·36층을 처음 지나면 사관 묵향이 서약자 기록에 대사 한 줄을 적는다(판마다 한 번, 금·업적).
     안 해도 되는 곁가지 — 결사가 아니면 아무 일도 없다 */
  var VOW_LINES = {
    10: '사관 묵향: 결사를 걸고 열 층을 내려오셨군요. 서약자의 이름은 기록에 따로 적어 두겠습니다.',
    20: '사관 묵향: 스무 층… 되돌아갈 길을 지우고 내려온 분은 제 기록에 몇 안 됩니다. 이 줄만큼은 먹이 마르지 않게 적겠습니다.',
    30: '사관 묵향: 서른 층입니다. 결사의 서약이 이렇게 오래 이어진 적은 기록에 없습니다. 지워진 이름보다 오래 남을 줄이 될 것입니다.',
    36: '사관 묵향: 비석 너머까지 오셨군요. 이제 서약자가 아니라 이 굴혈의 증인이라 적겠습니다.'
  };
  var VOW_GOLD = 4000, VOW_FEAT = 25;
  function vowMilestone(floor) {
    if (!hardcore() || !VOW_LINES[floor]) { return false; }
    var ds = dstate();
    if (!ds.vow || typeof ds.vow !== 'object') { ds.vow = {}; }
    if (ds.vow[floor]) { return false; }
    ds.vow[floor] = true;
    core.save.player.gold = (core.save.player.gold || 0) + VOW_GOLD;
    core.gainFeat(VOW_FEAT, '결사 서약');
    core.log('☠️ ' + VOW_LINES[floor] + ' · 금 +' + core.fmt(VOW_GOLD), 'good');
    core.emit('toast', '☠️ ' + VOW_LINES[floor]);
    return true;
  }

  /** 층을 내려간다 — 노획물이 확정되고, 3층마다(보스층 주기와 같다)
   *  축복(§5.1)을 하나 고른다. 8스택 다 찼으면 더 안 뜬다. */
  function descend() {
    settleLoot('층 답파');
    dstate().clears += 1;
    if (run.floor > dstate().best) {
      dstate().best = run.floor;
      if (global.DG.prestige) { global.DG.prestige.gainSeal(1, '던전 최고 층 갱신'); }
    }
    core.gainFeat(2 + Math.floor(run.floor / 2), '던전 답파');
    run.floor += 1;
    vowMilestone(run.floor);                       // 결사 서약자 곁가지(정본 side_vow)
    run.hpMax = hpMaxOf();
    run.choice = (DD.isBossFloor(run.floor) && (run.boonPicks || 0) < BOON_MAX_STACK)
      ? rollBoonChoice() : null;
    buildFloor();
    core.log('🪜 제' + run.floor + '층으로 내려간다', 'good');
    /* 장비가 닳는다 — 원작처럼 쓰면 닳고 다 닳으면 부서진다.
       한 대 맞을 때마다 깎으면 판정 층 한복판을 건드려야 해서,
       **층을 내려가는 이 자리 하나**로 모았다 */
    if (global.DG.item.wearAll) { global.DG.item.wearAll(1); }
    registerRegion(run.floor);
    core.emit('dungeon:floor', run.floor);
    core.emit('changed');
    return true;
  }

  /** 축복(§5.1) 회차 전체 상한 — 3층마다 1 + 사당방 보너스, 합쳐서 8 */
  var BOON_MAX_STACK = 8;
  /** 희귀도 가중치 — 일반 60 · 희귀 30 · 전설 10 */
  function rollRarity(seedBase, salt) {
    var r = core.hash2(seedBase, salt);
    if (r < 0.10) { return 'legendary'; }
    if (r < 0.40) { return 'rare'; }
    return 'common';
  }
  function axisPool(axis, rarity, shapes) {
    return DD.BOONS.filter(function (b) {
      if (b.axis !== axis || b.rarity !== rarity) { return false; }
      if (axis === 'skill' && !shapes[b.shape]) { return false; }
      return true;
    });
  }
  /** 축 하나에서 카드 하나 — 등급을 굴리고, 그 등급에 후보가 없으면
   *  (예: 아직 장착한 무예가 그 모양이 아니다) 한 단계씩 물러선다. */
  function rollFromAxis(axis, shapes, seedBase, saltRarity, saltPick) {
    var order = ['legendary', 'rare', 'common'];
    var rarity = rollRarity(seedBase, saltRarity);
    var start = order.indexOf(rarity);
    var pool = [];
    for (var i = start; i < order.length && !pool.length; i++) {
      pool = axisPool(axis, order[i], shapes);
    }
    if (!pool.length) { return null; }
    var idx = Math.floor(core.hash2(seedBase, saltPick) * pool.length);
    return pool[idx].key;
  }

  /**
   * 축복 후보 셋 — 무예·인물·세계 세 축에서 하나씩(§5.1). 같은 축이 두
   * 번 나올 수 없다(축 하나당 후보 하나씩 뽑는 구조라 저절로 그렇다).
   * `Math.random()`을 안 쓴다 — `tryCatchPet()`과 같은 이유(이 파일 위쪽
   * 주석 참고)로, 진단이 100회를 돌려도 다른 자리의 Math 수열을 안 민다.
   */
  function rollBoonChoice() {
    /* 난입(§5.5)은 8스택 상한을 안 본다 — 15분 동안 레벨이 그 이상 오른다
       (원문 "회차 한정 아니라 난입 한정"). 일반 회차 상한은 그대로. */
    if (!run || (!run.horde && (run.boonPicks || 0) >= BOON_MAX_STACK)) { return []; }
    var equipped = slotSkills(), shapes = {}, i;
    for (i = 0; i < equipped.length; i++) {
      if (equipped[i]) { shapes[equipped[i].sk.shape] = true; }
    }
    var seedBase = run.floor * 131 + (run.boonPicks || 0) * 17 + run.kills;
    var out = [], skillKey = rollFromAxis('skill', shapes, seedBase, 1, 2),
      heroKey = rollFromAxis('hero', shapes, seedBase, 3, 4),
      worldKey = rollFromAxis('world', shapes, seedBase, 5, 6);
    if (skillKey) { out.push(skillKey); }
    if (heroKey) { out.push(heroKey); }
    if (worldKey) { out.push(worldKey); }
    return out;
  }

  /** 처음 본 축복은 "은사첩"에 남는다(메타 진행, §5.1) — 유적·펫 도감과
   *  같은 결(dex:new → ui.js checkDexComplete). 회차가 끝나도 안 지워진다. */
  function registerBoonDex(key) {
    var dex = core.save.dex.boons;
    if (!dex || dex[key]) { return; }
    dex[key] = true;
    core.emit('dex:new', { cat: 'boons', id: key });
  }

  /** 축복 하나를 실제로 얹는다 — 고르기(`pickBoon`)와 구출 보상(이벤트방)이
   *  같이 쓴다. 상한 확인·체력 재계산·즉시 회복까지 여기 한 곳에 모았다. */
  function applyBoon(key) {
    var b = DD.boonByKey(key);
    if (!b) { return null; }
    if ((run.boons[key] || 0) >= b.max) { return null; }
    run.boons[key] = (run.boons[key] || 0) + 1;
    run.boonPicks = (run.boonPicks || 0) + 1;
    run.hpMax = hpMaxOf();
    var heal = b.eff.healOnPick;
    if (heal) { healBy(run.hpMax * heal / 100); }
    registerBoonDex(key);
    core.emit('changed');
    return b;
  }

  function pickBoon(key) {
    if (!run || !run.choice || run.choice.indexOf(key) < 0) { return false; }
    var b = applyBoon(key);
    if (!b) { return false; }
    run.choice = null;
    core.log('🎴 축복 · ' + b.name + ' (' + b.rarity + ')', 'good');
    return true;
  }

  /** 축복을 거절한다 — 금 30×층을 내고 이번 기회를 넘긴다(§5.1). */
  function rejectBoon() {
    if (!run || !run.choice) { return false; }
    var cost = 30 * run.floor;
    core.save.player.gold = Math.max(0, core.save.player.gold - cost);
    run.choice = null;
    core.log('🎴 축복을 거절했다 · 금 -' + core.fmt(cost), 'warn');
    core.emit('toast', '🎴 축복 거절 · 금 -' + core.fmt(cost));
    core.emit('changed');
    return true;
  }

  /** 사당방에서 바로 하나 받는다 — 8스택 다 찼으면 조용히 빈 채로 온다. */
  function shrineBoon() {
    var c = rollBoonChoice();
    if (!c.length) { return null; }
    run.choice = c;
    return c;
  }

