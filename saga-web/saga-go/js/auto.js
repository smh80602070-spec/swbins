/**
 * 자동 순행(自動巡行) — 손으로 못 걸을 때 대신 굴려 주는 조종사
 * ---------------------------------------------------------------
 * 이 게임은 원래 "걸어야" 돌아간다. 그런데 사무실·집에 앉아 있는 동안에는
 * 걸을 수가 없다. 그래서 **판단만 대신하는 층**을 하나 얹었다.
 *
 * 규칙을 새로 만들지 않는 것이 이 파일의 첫째 원칙이다.
 * 걷기·조우·문답·던전의 규칙은 각 모듈에 그대로 두고, 여기서는
 * "무엇을 목표로 삼을지" 고르고 **원래 있던 공개 함수만 부른다**:
 *
 *   지도    world.walkTo()          — 손으로 탭하는 것과 같은 길
 *           encounter.autoResolve() — 미니게임 확률을 그대로 굴린다
 *
 * 그래서 자동으로 얻는 기대값이 손으로 하는 것과 어긋나지 않는다.
 *
 * 일부러 자동화하지 않은 것
 *   - **실제 위치(GPS)** 는 대신 걸을 수 없다. 자동을 켜면 키보드 이동으로
 *     바꾼다 — 위치 공급자를 흉내 내는 것보다 정직하다.
 *
 * 화면을 보고 있는 동안에만 돈다(requestAnimationFrame). 창을 덮어 두면
 * 멈춘다 — 방치 수익을 새로 만들지 않기 위해 일부러 이렇게 뒀다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /* 무엇을 자동으로 할지 — 화면에서 켜고 끈다 */
  var FLAGS = [
    /* 2026-09-28 실기 Q5 "전체 테스트용 자동 퀘스트" — 이야기 목표까지 걸어가 말을 걸고 대화를 넘긴다.
       싸움(무찌르기·결투·지키기)은 🤖 자동 전투(field-combat autoFight)가 맡고, 여기서는 붙은 동안 안 걷는다 */
    { key: 'story', name: '이야기', emoji: '📖',
      desc: '지금 이야기 목표로 걸어가 말을 걸고 대화를 넘긴다 (다른 자동보다 먼저)' },
    { key: 'meet', name: '등용 · 포획', emoji: '🤝',
      desc: '사거리 안의 대상을 미니게임 확률대로 상대한다' },
    { key: 'grow', name: '승급 · 장비', emoji: '✨',
      desc: '승급 조건을 채운 인물을 올리고, 노획 장비를 갈아입힌다' },
    { key: 'omen', name: '길조 유지', emoji: '🔮',
      desc: '온라인일 때 천기를 물어 보정을 이어 붙인다 (토큰 소모)' },
    { key: 'stop', name: '역참 들르기', emoji: '🏮',
      desc: '채워진 역참으로 걸어가 보급을 받고, 점거된 역참은 이길 만하면 물린다' },
    { key: 'fort', name: '성채 공략', emoji: '🏯',
      desc: '이길 만한 성채에 도전하고, 점령한 성채의 공물을 걷는다' }
  ];

  /* 걷기 목표를 다시 정하는 간격 — 대상이 배회하므로 계속 따라간다 */
  var RETARGET = 0.45;
  var PATROL_MIN = 90, PATROL_MAX = 260;   // 순행 목표 거리 (m)

  var acc = { aim: 0, meet: 0, grow: 0, omen: 0, stop: 0, fort: 0, talk: 0, story: 0 };
  var patrol = null;                       // 순행 목표 {x, y}
  var aimUid = null;                       // 지금 쫓는 대상
  var doing = '';                          // 화면에 보여 줄 한 줄
  var lastLog = 0;

  var DEFAULTS = { on: false, story: true, meet: true, grow: true, omen: false, stop: true, fort: true };

  function st() {
    var s = core.save;
    /* 빠진 칸은 채워 넣는다 — 옛 세이브에는 없던 칸이 있다 */
    if (!s.auto) { s.auto = {}; }
    var k;
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

  /* ── 켜고 끄기 ────────────────────────────────────────── */

  function setOn(v) {
    var s = st();
    v = !!v;
    if (s.on === v) { return v; }
    s.on = v;
    if (v) {
      /* 실제 위치로는 대신 걸을 수 없다 — 키보드 이동으로 돌려놓는다 */
      if (global.DG.world.mode === 'geo') {
        global.DG.world.useKeyboard();
        core.emit('toast', '🤖 자동 순행 — 실제 위치 대신 지도 위를 걷습니다');
      } else {
        core.emit('toast', '🤖 자동 순행 시작');
      }
      core.log('🤖 자동 순행을 켰다', 'info');
      patrol = null; aimUid = null; doing = '길을 고르는 중…';
    } else {
      doing = '';
      core.log('🤖 자동 순행을 껐다', 'info');
      core.emit('toast', '⏸️ 자동 순행 정지');
    }
    core.emit('changed');
    core.persist();
    return v;
  }

  function toggle() { return setOn(!st().on); }

  function toggleFlag(key) {
    var s = st();
    if (!flagByKey(key)) { return false; }
    s[key] = !s[key];
    core.emit('changed');
    core.persist();
    return !!s[key];
  }

  /* ── 지도 ─────────────────────────────────────────────── */

  /** 이 대상을 상대할 밑천이 있나 */
  function affordable(spawn) {
    if (spawn.kind === 'hero') {
      return core.save.items.scroll >= 1 &&
             core.save.player.fame >= spawn.ref.rarity * 12;
    }
    return core.save.items.feed >= 1;
  }

  /**
   * 목표 고르기 — 귀한 대상을 앞세우되 거리를 깎는다.
   * 도감에 없는 것은 크게 얹는다(도감을 채우는 게 본편의 목적이므로).
   */
  function scoreSpawn(s, pos) {
    var d = Math.hypot(s.x - pos.x, s.y - pos.y);
    var dex = s.kind === 'hero' ? core.save.dex.heroes : core.save.dex.pets;
    var fresh = !dex[s.ref.id];
    return s.ref.rarity * 12 + (fresh ? 40 : 0) - d * 0.14;
  }

  function bestTarget() {
    var pos = core.save.player.pos;
    var list = global.DG.world.spawns, best = null, bs = -1e9;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!affordable(s)) { continue; }
      var sc = scoreSpawn(s, pos);
      if (sc > bs) { bs = sc; best = s; }
    }
    return best;
  }

  /**
   * 지금 갈 만한 역참 — 채워져 있는 것 중 가장 가까운 것.
   * 원작에서 볼이 떨어지면 스탑을 돌러 가는 그 행동이다.
   */
  function bestStation() {
    var list = global.DG.world.stationsNear(), stn = global.DG.station;
    var R = global.DG.rogue;
    for (var i = 0; i < list.length; i++) {
      /* 점거된 역참은 보급을 주지 않는다 — 밑천을 채우러 갈 자리가 아니다.
         물리치는 것은 아래 사거리 갈래가 따로 판단한다(이길 만할 때만 붙는다) */
      if (R && R.occupied(list[i])) { continue; }
      if (stn.stateOf(list[i].key).ready) { return list[i]; }
    }
    return null;
  }

  /** 밑천이 없으면 걷는다 — 250m 마다 보급이 들어오므로 이게 회복 수단이다 */
  function repatrol() {
    var pos = core.save.player.pos;
    var ang = Math.random() * Math.PI * 2;
    var d = PATROL_MIN + Math.random() * (PATROL_MAX - PATROL_MIN);
    patrol = { x: pos.x + Math.cos(ang) * d, y: pos.y + Math.sin(ang) * d };
  }

  /* ── 이야기 ──────────────────────────────────────────── */

  var TALK_GAP = 0.45;           // 대화 한 줄 넘기는 간격(초) — 글이 흘러나오는 것을 한 번은 보이게
  var WARP_MIN = 600;            // 이보다 먼 목표는 더 가까운 순간이동 지점이 있으면 뛴다
  var STUCK_T = 2.5;             // 이만큼 걸으려 했는데 1m 도 못 갔으면 막힌 것(집·강)
  var stuck = { x: 0, y: 0, t: 0, side: null };

  /** 막힘 풀기 — 목표 쪽이 막혀 제자리면 옆으로 12m 비켰다가 다시 간다(길 찾기가 없다) */
  function walkToward(w, tx, ty, dt, run) {
    var p = core.save.player.pos;
    if (stuck.side) {
      if (Math.hypot(stuck.side.x - p.x, stuck.side.y - p.y) > 2 && stuck.t < 4) { stuck.t += dt; w.walkTo(stuck.side.x, stuck.side.y, run); return; }
      stuck.side = null; stuck.t = 0;
    }
    if (Math.hypot(p.x - stuck.x, p.y - stuck.y) > 1) { stuck.x = p.x; stuck.y = p.y; stuck.t = 0; }
    else { stuck.t += dt; }
    if (stuck.t > STUCK_T) {
      var dx = tx - p.x, dy = ty - p.y, dl = Math.hypot(dx, dy) || 1, sg = Math.random() < 0.5 ? 1 : -1;
      stuck.side = { x: p.x - dy / dl * 12 * sg - dx / dl * 3, y: p.y + dx / dl * 12 * sg - dy / dl * 3 };
      stuck.t = 0;
      w.walkTo(stuck.side.x, stuck.side.y, run);
      return;
    }
    /* 멀면(40m+) 달린다 — 가까이선 걸어야 대화·채집 자리를 지나치지 않는다 */
    w.walkTo(tx, ty, run || Math.hypot(tx - p.x, ty - p.y) > 40);
  }

  /** 그 풀의 채집점 — 지금 자리 900m 안, 없으면 1.2·2.4·3.6·4.8km 둘레 열두 방향을 훑어 가장 가까운 것 { x, y, item } */
  function findNode(CK, item, p) {
    var best = null, bd = Infinity, rings = [0, 1200, 2400, 3600, 4800], ri, k;
    for (ri = 0; ri < rings.length && !best; ri++) {
      for (k = 0; k < (rings[ri] ? 12 : 1); k++) {
        var a = k / 12 * Math.PI * 2, cx = p.x + Math.cos(a) * rings[ri], cy = p.y + Math.sin(a) * rings[ri];
        CK.near(cx, cy, 900).forEach(function (nd) {
          if (nd.item !== item || !CK.available(nd)) { return; }
          var dd = Math.hypot(nd.x - p.x, nd.y - p.y);
          if (dd < bd) { bd = dd; best = nd; }
        });
      }
    }
    return best;
  }

  /** 요리 계획 — 모자란 재료 수가 가장 적고 그 재료가 모두 나는(findNode) 요리 · 가장 가까운 모자란 채집점 { rk, n, node } */
  function cookPlan(CK, p) {
    var best = null, memo = {};
    CK.ORDER.forEach(function (rk) {
      var r = CK.RECIPES[rk], n = 0, ok = true, node = null, nd = Infinity, k;
      for (k in r.ing) {
        if (!r.ing.hasOwnProperty(k) || CK.count(k) >= r.ing[k]) { continue; }
        n += r.ing[k] - CK.count(k);
        var f = memo[k] !== undefined ? memo[k] : (memo[k] = findNode(CK, k, p));
        if (!f) { ok = false; continue; }
        var dd = Math.hypot(f.x - p.x, f.y - p.y);
        if (dd < nd) { nd = dd; node = f; }
      }
      if (ok && node && (!best || n < best.n || (n === best.n && nd < best.d))) { best = { rk: rk, n: n, node: node, d: nd }; }
    });
    return best;
  }

  /** 이야기 한 박자 — 맡았으면 true(다른 자동은 이번엔 쉰다). 장이 잠겼거나 목표가 없으면 false */
  function tickStory(dt) {
    var S = global.DG.story, w = global.DG.world;
    if (!S || !S.on || !S.on()) { return false; }
    if (S.talking()) {
      acc.talk += dt;
      if (acc.talk >= TALK_GAP) {
        acc.talk = 0;
        var line = S.curLine();
        S.next(line && line[0] === '?' ? 0 : undefined);        // 고르는 줄은 첫째 대답
      }
      doing = '📖 대화 중';
      return true;
    }
    var st = S.step();
    if (!st) {
      if (!S.done() && S.locked()) { doing = '📖 다음 장은 모험 레벨 ' + S.chapter().ar + ' 부터 — 그동안 순행'; }
      return false;
    }
    var t = S.targetOf(st);
    if (!t) { doing = '📖 ' + (st.text || st.type) + ' — 목표 자리를 아직 못 찾음'; return false; }
    var p = core.save.player.pos, d = Math.hypot(t.x - p.x, t.y - p.y);
    var FC = global.DG.fieldCombat, FS = FC && FC.state ? FC.state() : null;
    if (FS && FC.inCombat && FC.inCombat(FS, p.x, p.y)) {   // engaged 는 멀리서 쫓거나 제단만 치는 적까지 잡아 멈춰 섰다
      /* 붙어 있게 — 가장 가까운 적의 몸 가장자리가 5m 넘게 벌어지면 다가간다(회피로 밀려나 적이 추격을 그만두던 것) */
      var near = null, nd0 = Infinity;
      FC.living(FS).forEach(function (f) { if (f.st === 'idle' || f.st === 'return') { return; } var dd = Math.hypot(f.x - p.x, f.y - p.y) - FC.BODY(f); if (dd < nd0) { nd0 = dd; near = f; } });
      if (near && nd0 > 5) { w.walkTo(near.x, near.y); } else { w.walkTo(p.x, p.y); }
      doing = '📖 ⚔️ ' + (t.label || st.text || '') + ' — 싸우는 중';
      return true;
    }
    /* 숨은 터(비경) — 입구 곁이면 들어가고(domain.enter), 파도는 🤖 자동 전투가, 끝나면 보상 나무(원기 모자라면 두고 나온다).
       이야기는 domain:clear 로 넘어간다 */
    var DM = global.DG.domain;
    if (DM && DM.active && DM.active()) {
      var rn = DM.run();
      if (rn.phase === 'tree') { var cl = DM.claim(); if (!cl.ok) { DM.leave(); } doing = '📖 🌳 숨은 터 보상 ' + (cl.ok ? cl.text : '— ' + cl.why + ' · 두고 나옴'); return true; }
      if (Math.hypot(rn.x - p.x, rn.y - p.y) > DM.ARENA_R(false) * 0.5) { w.walkTo(rn.x, rn.y); }
      doing = '📖 🌀 ' + rn.d.name + ' — ' + (rn.phase === 'wait' ? '곧 적이 나타난다' : '싸우는 중');
      return true;
    }
    if (st.type === 'domain' && DM && d <= DM.ENTER_R(false)) {
      var dObj = st.did ? DM.byId(st.did) : null;
      if (!dObj) { DM.list().forEach(function (x) { if (x.kind === 'weekly' && (!dObj || Math.hypot(x.x - t.x, x.y - t.y) < Math.hypot(dObj.x - t.x, dObj.y - t.y))) { dObj = x; } }); }
      var en = dObj ? DM.enter(dObj, 0) : { ok: false, why: '숨은 터를 못 찾음' };
      w.walkTo(p.x, p.y);
      doing = '📖 🌀 ' + (en.ok ? (dObj.name + ' 들어감') : (t.label + ' — ' + en.why));
      return true;
    }
    /* 채집 — 900m 안에 그 풀이 없으면(다 꺾어 다시 자라는 중·그 풀이 안 나는 지역) story 는 고향을 가리킨다 →
       채집점 자리는 순수 함수라 동심원으로 멀리까지 찾아 가장 가까운 것으로 간다(멀면 순간이동) */
    var CKg = global.DG.cooking;
    if (st.type === 'gather' && CKg) {
      var any = CKg.near(p.x, p.y, 900).some(function (nd) { return nd.item === st.item && CKg.available(nd); });
      if (!any) {
        var far = findNode(CKg, st.item, p);
        if (!far) { doing = '📖 🌿 ' + (st.text || '') + ' — 5km 안에 안 난다'; return false; }
        t = { x: far.x, y: far.y, r: 0, label: st.text + '(먼 군락)' }; d = Math.hypot(t.x - p.x, t.y - p.y);
      }
    }
    /* 솥 요리 — 만들 수 있는 요리가 없으면 모자란 재료가 가까이(700m) 나는 요리를 골라 그 채집점으로(곁 1.5m 면 저절로 줍는다),
       있으면 솥으로 가서 보통 품질로 만든다 */
    var CK = global.DG.cooking;
    if (st.type === 'cook' && CK) {
      var ready = null, ri;
      for (ri = 0; ri < CK.ORDER.length && !ready; ri++) { if (CK.cookCheck(CK.ORDER[ri], true).ok) { ready = CK.ORDER[ri]; } }
      if (!ready) {
        var plan = cookPlan(CK, p);
        if (!plan) { doing = '📖 🍲 요리 재료가 가까이 안 난다 — 순행'; return false; }
        acc.story += dt;
        if (acc.story >= RETARGET) { acc.story = 0; walkToward(w, plan.node.x, plan.node.y, RETARGET); }
        doing = '📖 🌿 ' + CK.RECIPES[plan.rk].name + ' 재료 — ' + CK.ITEMS[plan.node.item].name + ' 으로 ' + Math.round(Math.hypot(plan.node.x - p.x, plan.node.y - p.y)) + 'm';
        return true;
      }
      if (CK.atPot()) {
        var made = CK.cook(ready, 1);
        w.walkTo(p.x, p.y);
        doing = '📖 🍲 ' + CK.RECIPES[ready].name + (made ? ' 만듦' : ' 못 만듦');
        return true;
      }
    }
    /* 바람·시간 기둥(sky) — 기둥 안(DRAFT_R)에 서서 점프하면 솟아 섬·관측대에 내려선다(landform) */
    var LFs = global.DG.landform, SKs = global.DG.skyIsle;
    if (st.type === 'sky' && LFs && LFs.glideAlt && LFs.glideAlt() !== null && SKs && SKs.padById) {
      /* 솟는 중 — 섬(발판) 윗면보다 높아지면 섬 쪽으로 활공해 내려선다(섬 가운데는 기둥에서 27m 북쪽) */
      var pad = SKs.padById(st.pad || 'isle');
      if (pad && LFs.glideAlt() > pad.top + 1) { w.walkTo(pad.x, pad.y); doing = '📖 🪂 ' + pad.name + ' 쪽으로 활공'; return true; }
      w.walkTo(p.x, p.y);
      doing = '📖 🌬️ 기둥을 타고 솟는 중';
      return true;
    }
    if (st.type === 'sky' && t.r && d <= t.r * 0.7) {
      w.walkTo(p.x, p.y);
      acc.talk += dt;
      if (LFs && LFs.jump && acc.talk >= 1.2) { acc.talk = 0; LFs.jump(); }
      doing = '📖 🌬️ ' + (st.text || '') + ' — 기둥 안에서 점프';
      return true;
    }
    /* 불 밝히기·석등 — 제단(석등은 다음 차례 것) 곁에 서서 원소 스킬(E). 스킬 고리가 닿으면 story.onElement 가 켠다 */
    if (st.type === 'light' || st.type === 'seal') {
      var goal = t;
      if (st.type === 'seal') {
        var lamps = S.sealLamps(st), want = (st.order || S.SEAL_ORDER)[S.sealLit()];
        for (var li = 0; li < lamps.length; li++) { if (lamps[li].k === want) { goal = lamps[li]; } }
      }
      var dg = Math.hypot(goal.x - p.x, goal.y - p.y);
      if (dg <= 1.8) {
        w.walkTo(p.x, p.y);
        var mm = FS && FS.party ? FS.party[FS.active] : null;
        if (mm && mm.skillCd <= 0 && FC.act) { FC.act('skill'); }
        doing = '📖 ✨ ' + (st.text || '') + ' — 원소 스킬' + (mm && mm.skillCd > 0 ? ' (' + mm.skillCd.toFixed(1) + '초)' : '');
        return true;
      }
      acc.story += dt;
      if (acc.story >= RETARGET) { acc.story = 0; walkToward(w, goal.x, goal.y, RETARGET); }
      doing = '📖 ' + (st.text || st.type) + ' 으로 ' + Math.round(dg) + 'm';
      return true;
    }
    if (S.isTalk(st) && d <= t.r) {
      w.walkTo(p.x, p.y);
      if (!S.talkStart()) { doing = '📖 ' + t.label + ' 곁 — 말을 걸 수 없는 때(다른 창)'; }
      return true;
    }
    /* 멀면(600m+) 목표에 더 가까운 순간이동 지점으로 뛴다 — 사람이 지도(M)에서 누르는 것과 같은 길(overworld.jump, 키보드 판만) */
    var OW = global.DG.overworld;
    if (d > WARP_MIN && w.mode === 'keyboard' && OW && OW.nearestWay && OW.jump) {
      var nw = OW.nearestWay(t.x, t.y);
      if (nw && nw.d + 150 < d && OW.jump(nw.key)) { doing = '📖 🌀 ' + nw.name + ' 으로 순간이동 — ' + (t.label || st.text || ''); return true; }
    }
    acc.story += dt;
    /* 쫓기(도둑이 초속 13m)·따라가기는 매 프레임 목표를 고친다 — 쫓기는 달려야 따라잡는다 */
    var chasing = st.type === 'chase' || st.type === 'follow';
    if (acc.story >= RETARGET || chasing) {
      var gap = acc.story;
      acc.story = 0;
      patrol = null; aimUid = null;
      /* 반지름이 있는 목표(대화·가기·오르기)는 그 안까지, 없는 것(무찌르기·결투)은 그 자리로 */
      walkToward(w, t.x, t.y, gap, st.type === 'chase');
    }
    doing = '📖 ' + (t.label || st.text || st.type) + ' 으로 ' + Math.round(d) + 'm';
    return true;
  }

  function tickMap(dt) {
    var w = global.DG.world;
    if (global.DG.encounter.active) { doing = '조우 화면이 열려 있습니다'; return; }
    if (on('story')) {
      /* 자동이 새면 game.js 루프(다음 프레임 예약)까지 멎는다 — 이야기 한 박자는 통째로 감싼다 */
      try { if (tickStory(dt)) { return; } } catch (e) { doing = '📖 자동 이야기 오류 — ' + e.message; if (global.console) { console.warn('[auto] tickStory', e); } }
    }

    acc.aim += dt;
    if (acc.aim >= RETARGET) {
      acc.aim = 0;
      var t = bestTarget();
      if (t) {
        aimUid = t.uid;
        patrol = null;
        w.walkTo(t.x, t.y);
        var dist = Math.hypot(t.x - core.save.player.pos.x, t.y - core.save.player.pos.y);
        doing = (t.kind === 'hero' ? '🤝 ' : '🐾 ') + t.ref.name +
          '(' + global.DG.data.rarity[t.ref.rarity].name + ') 으로 ' + Math.round(dist) + 'm';
      } else {
        aimUid = null;
        var pos = core.save.player.pos;
        /* 상대할 대상이 없다 = 밑천이 없다는 뜻이 대부분이다.
           채워진 역참이 있으면 순행보다 그쪽이 빠르다. */
        var stt = on('stop') ? bestStation() : null;
        if (stt) {
          patrol = null;
          w.walkTo(stt.x, stt.y);
          doing = '🏮 ' + stt.name + ' 으로 ' +
            Math.round(Math.hypot(stt.x - pos.x, stt.y - pos.y)) + 'm — 보급을 받으러';
        } else {
          if (!patrol || Math.hypot(patrol.x - pos.x, patrol.y - pos.y) < 8) { repatrol(); }
          w.walkTo(patrol.x, patrol.y);
          doing = '🚶 순행 — 보급을 모으는 중 (📜' + core.save.items.scroll +
            ' 🍖' + core.save.items.feed + ')';
        }
      }
    }

    /* 사거리 안의 성채 — 이길 만하면 도전하고, 내 것이면 공물을 걷는다 */
    acc.fort += dt;
    if (on('fort') && acc.fort >= 2.2) {
      acc.fort = 0;
      var nf = w.nearestFort();
      if (nf && nf.inRange) {
        /* 적장이 들었으면 성채보다 그쪽이 먼저다 */
        var rd = global.DG.raid.current(nf.fort);
        if (rd) {
          var rr = global.DG.raid.autoFight(rd);
          if (rr) {
            core.emit('toast', '⚔️ ' + rd.hero.name +
              (rr.win ? (rr.caught ? ' 격파·등용!' : ' 격파!') : ' 격파 실패'));
          }
          return;
        }
        var act = global.DG.fort.autoAct(nf.fort);
        if (act && act.did === 'fight') {
          core.emit('toast', '🏯 ' + nf.fort.name + (act.win ? ' 점령!' : ' 공략 실패'));
        } else if (act && act.did === 'collect') {
          core.emit('toast', '🏯 ' + nf.fort.name + ' 공물 🪙 +' + act.gold);
        }
      }
    }

    /* 지나는 길에 채워진 역참이 있으면 들른다 (밑천이 넉넉해도 원작처럼 줍고 간다) */
    acc.stop += dt;
    if (on('stop') && acc.stop >= 1.3) {
      acc.stop = 0;
      var ns = w.nearestStation();
      if (ns && ns.inRange) {
        /* 적도가 들어 있으면 보급보다 그쪽이 먼저다 — 이길 만할 때만 붙는다.
           (성채에서 적장이 성채보다 먼저인 것과 같은 손) */
        var R = global.DG.rogue;
        var rg = R ? R.at(ns.station) : null;
        if (rg) {
          var rres = R.autoFight(rg);
          if (rres) {
            core.emit('toast', '🏴 ' + rg.station.name +
              (rres.win ? ' 탈환! · 🌑 ' + rres.dark.name + ' 이(가) 남았다' : ' 탈환 실패'));
          }
          return;
        }
        if (global.DG.station.stateOf(ns.station.key).ready) {
          var got = global.DG.station.autoVisit(ns.station);
          if (got.ok) {
            core.emit('toast', '🏮 ' + got.name + ' — 📜 +' + got.reward.scroll +
              ' · 🍖 +' + got.reward.feed + ' · 🪙 +' + got.reward.gold);
          }
        }
      }
    }

    /* 사거리 안이면 상대한다 — 확률은 미니게임 규칙 그대로 */
    acc.meet += dt;
    if (on('meet') && acc.meet >= 1.1) {
      acc.meet = 0;
      var n = w.nearest();
      if (n && n.inRange && affordable(n.spawn)) {
        global.DG.encounter.autoResolve(n.spawn);
      }
    }
  }

  /* ── 승급 · 장비 ──────────────────────────────────────── */

  /** 승급 조건을 채운 인물 중 등급이 높은 쪽부터 한 명 */
  function autoRankUp() {
    var ids = Object.keys(core.save.dex.heroes), best = null, bestR = -1, i;
    for (i = 0; i < ids.length; i++) {
      var chk = global.DG.hero.rankUpCheck(ids[i]);
      if (!chk.ok) { continue; }
      var h = global.DG.data.find(ids[i]);
      var score = h ? h.rarity : 0;
      if (score > bestR) { bestR = score; best = ids[i]; }
    }
    if (best) {
      global.DG.hero.rankUp(best);
      if (global.DG.perk) { global.DG.perk.autoPick(best); }    // 자동은 첫 카드(PLAN §5 ⑦)
      return true;
    }
    return false;
  }

  function tickGrow(dt) {
    acc.grow += dt;
    if (acc.grow < 6) { return; }
    acc.grow = 0;
    autoRankUp();
    /* 받아만 둔 천거장은 걸어도 줄지 않는다 — 빈 칸이 있으면 채워 둔다 */
    global.DG.letter.autoFill();
  }

  /* ── 길조 유지 ────────────────────────────────────────── */

  function tickOmen(dt) {
    acc.omen += dt;
    if (acc.omen < 30) { return; }
    acc.omen = 0;
    if (!global.DG.net.online()) { return; }
    if (global.DG.ai.buffLeft() > 30) { return; }     // 아직 살아 있으면 아낀다
    global.DG.ai.omen();
  }

  /* ── 매 프레임 ────────────────────────────────────────── */

  function update(dt) {
    if (!active()) { return; }
    tickMap(dt);
    if (on('grow')) { tickGrow(dt); }
    if (on('omen')) { tickOmen(dt); }
  }

  function status() {
    return {
      on: active(), doing: doing,
      flags: st(),
      aim: aimUid
    };
  }

  global.DG = global.DG || {};
  global.DG.auto = {
    FLAGS: FLAGS, flagByKey: flagByKey,
    state: st, active: active, on: on,
    setOn: setOn, toggle: toggle, toggleFlag: toggleFlag,
    update: update, status: status,
    /** 자가진단용 — 한 판단만 굴려 본다 */
    _tickMap: tickMap, _autoRankUp: autoRankUp, _tickStory: tickStory
  };
})(window);
