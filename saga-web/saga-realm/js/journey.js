/**
 * 사가천하 — 원정(여러 달에 걸친 실시간 이동) · war.js 에서 떼어 냄(R-4 2026-10-08, 1,778줄 → 1,500줄 아래)
 * ---------------------------------------------------------------
 * 같은 이름표(`DG.war`)에 붙인다 — 부르는 쪽(rtk.js 달 넘기기·ui-rtk·진단)은 그대로 `DG.war.startJourney()` 등.
 * 판정은 여전히 war.js `fight()` 한 곳(아래 fight·encamp·capture·reinforce 는 war.js 것을 그대로 빌린다).
 * 반드시 war.js 바로 뒤에 싣는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var ID = global.DG.item;
  var W = global.DG.war;
  var fight = W.fight, encamp = W.encamp, capture = W.capture, reinforce = W.reinforce;

  /* ── 원정 (여러 달에 걸친 실시간 이동, 2026-09-04) ───────────────────
   * 위 "진영(camp, 陣)"은 **친 뒤 못 떨어뜨려 눌러앉은 상태**다. 여기 원정은
   * **치기 전, 국경까지 오가는 중인 상태** — 서로 다른 것이다(화면 문구도
   * 갈랐다, `ui-rtk.js` 참고. 내부 변수·주석에 남은 옛 "원정"(camp 쪽)은
   * 그대로 둔다 — 뜻은 늘 문맥으로 갈렸었고, 굳이 다 갈아엎지 않는다).
   *
   * 출진(march)은 "인접한 성 하나로 그 자리에서" 만 붙는 구조를 그대로 둔다
   * (개입형 전투가 설 자리를 지키려고). 원정은 그 앞에 얹는 상위 명령이다 —
   * **내 땅·주인 없는 빈 땅만 거쳐**(`CD.path`, 물길은 뺀다) 먼 성 앞까지
   * 병력을 여러 달에 걸쳐 옮기고, 국경(경로의 마지막 통과 칸)에 닿으면 그
   * 마지막 한 걸음은 지금의 `march()` 를 그대로 쓴다 — **새 판정을 만들지
   * 않는다.**
   */

  /**
   * 원정 도중 사건(PLAN §16 "랜덤 이벤트", README 로드맵 Phase 9) — `rtk.js`의
   * `DISASTERS`(성마다 달마다 굴리는 재해)와 같은 결의 표를 원정군에 얹는다.
   * **새 판정을 만들지 않는다** — 국경 도착(`arriveJourney`)의 전투는 여전히
   * `fight()` 한 곳뿐이고, 이 표는 그 전 "가는 길"에서만 원정 상태(`troops`·
   * `morale`·`monthsTotal`)와 진영 금고(`gold`)를 살짝 흔든다.
   */
  var JOURNEY_EVENTS = [
    { key: 'ambush',   name: '매복',      emoji: '⚔️', troopsMul: 0.92,
      text: '숲 그늘에서 매복을 만나 병사를 잃었다.' },
    { key: 'bandit',   name: '도적떼',    emoji: '🏴', goldDelta: -300,
      text: '지나던 도적떼에게 노잣돈을 뜯겼다.' },
    { key: 'treasure', name: '보물 발견', emoji: '💰', goldDelta: 400, good: true,
      text: '길가 옛 무덤에서 부장품을 찾아냈다.' },
    { key: 'village',  name: '마을의 환대', emoji: '🏘️', moraleDelta: 0.05, good: true,
      text: '마을 사람들이 술과 밥을 내어 사기가 올랐다.' },
    { key: 'lost',     name: '길 잃음',   emoji: '🌫️', delayMonths: 1,
      text: '안개 속에서 길을 잃어 하루를 더 걷는다.' },
    /* 2026-09-09 — 원작의 "보물" 을 원정 사건에 얹었다
       (data-item.js). 장비창은 없다 — 원정 간 장수 중 하나가 곧바로 씌운다 */
    { key: 'relic',    name: '유물 발견', emoji: '🏺', grantItem: true, good: true,
      text: '옛 무덤에서 나온 물건을 장수 하나가 챙겼다.' },
    /* 2026-09-11 — 균열·폐허(균열/폐허 두 확장 지역, PLAN 26-4절 "완전
       퓨전" 방향)를 만들고 나서 "지역 콘텐츠"뿐 아니라 판 전체에 걸치는
       축 하나를 더했다. 시간이 뒤섞인다는 그 지역의 설정이 원정 중
       아무 데서나(균열 근처가 아니어도) 새어 나온다는 발상 — `lost`
       (길 잃음, +1달)의 정반대다. `delayMonths` 가 처음으로 음수를
       받는 경우라 아래 clamp(elapsed+1 미만으로는 안 줄어든다)를 같이 뒀다 */
    { key: 'timeRift', name: '시간 뒤틀림', emoji: '⏳', delayMonths: -1, good: true,
      text: '길이 갑자기 접혔다 — 균열의 여파인지, 여정이 하루 앞당겨졌다.' }
  ];

  /** 원정 하나가 이번 달 사건을 만나는가 — `rollDisasters()` 와 같은 확률 손잡이 결 */
  function rollJourneyEvent(j) {
    if (Math.random() > core.tuned('war.journeyEventChance', 0.16)) { return null; }
    var e = JOURNEY_EVENTS[Math.floor(Math.random() * JOURNEY_EVENTS.length)];
    var R = global.DG.rtk, off = global.DG.off, f = R.force(j.force);
    var text = e.text;
    if (e.troopsMul) { j.troops = Math.max(1, Math.round(j.troops * e.troopsMul)); }
    if (e.goldDelta && f) { f.gold = Math.max(0, f.gold + e.goldDelta); }
    if (e.moraleDelta) { j.morale = Math.max(0.5, Math.min(1.5, (j.morale || 1) + e.moraleDelta)); }
    if (e.delayMonths) { j.monthsTotal = Math.max((j.monthsElapsed || 0) + 1, j.monthsTotal + e.delayMonths); }
    if (e.grantItem && ID && off && j.officers.length) {
      var oid = j.officers[Math.floor(Math.random() * j.officers.length)];
      var it = ID.randomItem();
      off.equip(oid, it.id);
      var h = off.find(oid);
      text += ' (' + it.emoji + it.name + ' → ' + (h ? h.name : oid) + ')';
    }
    j.lastEvent = { key: e.key, emoji: e.emoji, text: text, good: !!e.good };
    core.log(e.emoji + ' ' + R.forceName(j.force) + ' 원정군 — ' + text, e.good ? 'good' : 'warn');
    core.emit('rtk:journeyEvent', { id: j.id, force: j.force, key: e.key });
    return e;
  }

  function journeys() {
    var st = global.DG.rtk.state();
    if (!st.journeys) { st.journeys = []; }
    return st.journeys;
  }

  function journeysOf(forceId) {
    var list = journeys(), out = [], i;
    for (i = 0; i < list.length; i++) { if (list[i].force === forceId) { out.push(list[i]); } }
    return out;
  }

  function journeyById(id) {
    var list = journeys(), i;
    for (i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  /** 그 성이 지금 원정의 통행로로 쓸 수 있는가 — 내 성이거나 주인 없음 */
  function journeyPassable(cityId, forceId) {
    var c = global.DG.rtk.city(cityId);
    return !!c && (c.force === forceId || c.force === null);
  }

  /** 원정을 시작할 수 있는가 — `canMarch` 와 달리 **인접일 필요가 없다**,
   *  대신 통과할 수 있는 땅만으로 이어지는 `CD.path` 가 있어야 한다. */
  function canJourney(fromId, toId, troops) {
    var R = global.DG.rtk;
    var from = R.city(fromId), to = R.city(toId);
    if (!from || !to) { return { ok: false, why: '없는 성' }; }
    if (from.force === to.force) { return { ok: false, why: '우리 성입니다' }; }
    if (troops > from.troops) { return { ok: false, why: '병력이 모자랍니다' }; }
    if (troops < 500) { return { ok: false, why: '오백은 넘겨야 군대라 하지요' }; }
    /* 원정 군량 — march 와 같은 공식(두 달치)을 그대로 쓴다. 남은 여러 달은
       실려 가는 도중 소모하지 않고 국경에 닿아서야 성에 그대로 부린다(v1
       단순화 — 도중 보급·아사는 범위 밖, camp 쪽만 그 사정을 진다) */
    var need = Math.round(troops / 1000 * R.FOOD_PER_1000 * 2);
    if (from.food < need) { return { ok: false, why: '군량이 모자랍니다 (' + core.fmt(need) + ' 필요)' }; }
    if (global.DG.diplo && global.DG.diplo.blocked(from.force, to.force)) {
      return { ok: false, why: '맹약이 있어 칠 수 없습니다' };
    }
    var myForce = from.force;
    var p = CD.path(fromId, toId, function (cid) { return journeyPassable(cid, myForce); });
    if (!p) { return { ok: false, why: '갈 수 있는 길이 없습니다 (남의 땅에 막혔습니다)' }; }
    return { ok: true, food: need, path: p, months: CD.pathMonths(p) };
  }

  /**
   * 원정을 보낸다. `march()` 처럼 그 자리에서 붙지 않는다 — `chk.months` 달
   * 뒤에야 국경에 닿고, 그때 가서 `resolveJourneys()` 가 `march()` 를 부른다.
   */
  function startJourney(fromId, toId, officerIds, troops) {
    var R = global.DG.rtk, off = global.DG.off;
    var chk = canJourney(fromId, toId, troops);
    if (!chk.ok) { return chk; }

    var from = R.city(fromId), i, valid = [];
    for (i = 0; i < officerIds.length; i++) {
      var r = off.rec(officerIds[i]);
      if (r.city === fromId && r.force === from.force && !r.hurt && !r.camp && !r.journey) {
        valid.push(officerIds[i]);
      }
    }
    if (!valid.length) { return { ok: false, why: '데려갈 장수가 없습니다' }; }

    from.troops -= troops;
    from.food -= chk.food;

    var st = R.state();
    st.journeySeq = (st.journeySeq || 0) + 1;
    var j = {
      id: 'journey' + st.journeySeq, force: from.force, from: fromId, to: toId,
      path: chk.path, troops: troops, officers: valid.slice(),
      train: from.train, tech: from.tech, morale: 1, food: chk.food,
      monthsTotal: chk.months, monthsElapsed: 0
    };
    journeys().push(j);
    for (i = 0; i < valid.length; i++) { off.rec(valid[i]).journey = j.id; }
    off.gainExpAll(valid, off.EXP.march);

    core.log('🚩 ' + R.forceName(j.force) + ' 이(가) ' + CD.find(toId).name +
      ' 을(를) 향해 원정을 떠났다 (' + j.monthsTotal + '달 예상)', 'info');
    core.emit('rtk:journey', { kind: 'start', id: j.id, force: j.force, from: fromId, to: toId, months: j.monthsTotal });
    core.emit('changed');
    core.persist();
    return { ok: true, id: j.id, months: j.monthsTotal };
  }

  /** 원정을 목록에서 뺀다 — 장수에 붙은 표시도 함께 뗀다 */
  function dropJourney(j) {
    var off = global.DG.off, list = journeys(), i = list.indexOf(j);
    if (i >= 0) { list.splice(i, 1); }
    for (i = 0; i < j.officers.length; i++) { off.rec(j.officers[i]).journey = null; }
  }

  /** 물러날 곳 — 떠난 성이 아직 우리 것이면 그리로, 아니면 가장 가까운 우리 성
   *  (camp 의 `homeFor()` 와 같은 요령) */
  function homeForJourney(j) {
    var R = global.DG.rtk;
    var from = R.city(j.from);
    if (from && from.force === j.force) { return j.from; }
    var mine = R.citiesOf(j.force), best = null, bd = 1e9, i, d;
    for (i = 0; i < mine.length; i++) {
      d = CD.hops(j.from, mine[i]);
      if (d >= 0 && d < bd) { bd = d; best = mine[i]; }
    }
    return best;
  }

  /** 경로가 도중에 끊겼다(중간 성이 남의 손에 넘어갔다) — 되돌아간다.
   *  돌아갈 나라마저 없으면 camp 의 `disband()` 와 같은 꼴로 그 자리에서
   *  흩어진다(장수는 사로잡힌 것으로 둔다 — 조용히 지우지 않는다). */
  function retreatJourney(j, why) {
    var R = global.DG.rtk, off = global.DG.off;
    var home = homeForJourney(j);
    var i;
    if (!home) {
      for (i = 0; i < j.officers.length; i++) {
        off.placeAt(j.officers[i], j.from, null);
        off.rec(j.officers[i]).found = true;
        off.rec(j.officers[i]).loyal = 0;
        R.state().captives[j.officers[i]] = j.from;
      }
      dropJourney(j);
      core.log('🏳️ 돌아갈 곳을 잃은 원정군이 ' + CD.find(j.from).name + ' 앞에서 흩어졌다', 'warn');
      core.emit('rtk:journey', { kind: 'disband', id: j.id, force: j.force, to: j.from });
      return;
    }
    var h = R.city(home);
    h.troops += j.troops; h.food += j.food;
    for (i = 0; i < j.officers.length; i++) {
      off.placeAt(j.officers[i], home, j.force);
      off.addLoyal(j.officers[i], -2);
    }
    dropJourney(j);
    core.log('🔙 ' + R.forceName(j.force) + ' 의 원정이 ' + why + ' — ' +
      CD.find(home).name + ' 으로 물러났다', 'warn');
    core.emit('rtk:journey', { kind: 'retreat', id: j.id, force: j.force, home: home });
  }

  /**
   * 국경에 닿았다 — 목적지를 곧바로 친다.
   *
   * **`march()` 를 부르지 않는다.** `march()`는 "내가 가진 성에서" 병력을
   * 차출하는 구조라 국경 마지막 칸(경로의 두 번째 끝, "거점")이 있어야
   * 하는데, 원정의 흔한 그림 — 주인 없는 빈 땅만 거쳐 목적지까지 가는 것
   * — 에서는 그 거점이 애초에 내 성이 아니다(주인 없는 땅). 대신 `camp`
   * (진영)의 `resolveCamp()` 와 **같은 요령**을 쓴다 — 원정군 스스로의
   * 병력·장수(어느 성에도 안 속한다)로 `fight()` 에 직접 붙고, 결과에 따라
   * `capture()`(함락) · 물러남(`retreatJourney`) · `encamp()`(못 떨어뜨려
   * 그 자리에 진을 침 — 이러면 다음 달부터는 평범한 진영으로 이어진다)
   * 셋 중 하나로 갈린다. **판정은 fight() 한 곳뿐이다.**
   */
  function arriveJourney(j) {
    var R = global.DG.rtk, off = global.DG.off, i;
    var to = R.city(j.to);
    if (!to) { dropJourney(j); return; }

    if (to.force === j.force) {
      /* 이미 우리 성이 됐다(동맹이 먼저 먹었거나 자기 성이 됐거나) — 싸움
         없이 그대로 합류한다 */
      to.troops += j.troops;
      to.food += j.food;
      for (i = 0; i < j.officers.length; i++) { off.placeAt(j.officers[i], j.to, j.force); }
      core.log('🚩 ' + CD.find(j.to).name + ' 에 이미 우리 깃발이 있어 원정군이 그대로 합류했다', 'good');
      dropJourney(j);
      core.emit('rtk:journey', { kind: 'join', id: j.id, force: j.force, to: j.to });
      return;
    }

    if (global.DG.diplo && global.DG.diplo.blocked(j.force, to.force)) {
      retreatJourney(j, '맹약이 맺어져 칠 수 없어');
      return;
    }

    var relief = reinforce(j.to);
    var land = CD.landOf(j.to);
    var atk = {
      side: 'atk', force: j.force, troops: j.troops, start: j.troops,
      train: j.train, tech: j.tech, officers: j.officers.slice(), morale: j.morale,
      water: false, ships: 0
    };
    var def = {
      side: 'def', force: to.force, troops: to.troops, start: to.troops,
      train: to.train, tech: to.tech,
      officers: off.atCity(j.to, to.force).map(function (h) { return h.id; }), morale: 1,
      water: false, ships: 0
    };
    off.gainExpAll(j.officers, off.EXP.march);

    var report = fight(atk, def, to, j.to, land, false);
    report.from = j.from; report.to = j.to; report.relief = relief;
    report.force = j.force; report.defForce = def.force; report.journeyId = j.id;
    if (relief > 0) { report.log.splice(1, 0, '🚩 이웃 성에서 구원군 ' + core.fmt(relief) + ' 이 들어왔다'); }

    if (report.won) {
      dropJourney(j);
      to.food += j.food;
      capture(j.to, j.force, atk, def, report);
    } else if (report.routed) {
      to.troops = def.troops;
      j.troops = atk.troops;
      retreatJourney(j, '공격이 무너져');
    } else {
      to.troops = def.troops;
      j.troops = atk.troops;
      dropJourney(j);
      var cp = encamp(j.from, j.to, atk, j.food, report);
      report.campId = cp.id;
    }

    core.emit('rtk:battle', report);
    core.emit('rtk:journey', { kind: 'arrive', id: j.id, force: j.force, to: j.to, won: !!report.won });
  }

  /**
   * endMonth 가 부른다(`resolveAll()` 다음) — 가고 있는 원정이 저마다 한 달을
   * 더 간다. 목록을 **베껴 두고** 돈다 — 도착·철군으로 목록이 줄기 때문이다.
   */
  function resolveJourneys() {
    var list = journeys().slice(), out = [], i, j, k, broke;
    for (i = 0; i < list.length; i++) {
      j = list[i];
      broke = false;
      /* 경로 무결성 — 마지막 칸(목적지)은 애초에 통과 검사 대상이 아니었으니
         뺀다. 시작 칸(j.from)도 여기선 안 본다 — 거긴 arriveJourney() 가
         도착 순간에 다시 본다(짧은 원정은 중간 칸이 아예 없어서다) */
      for (k = 1; k < j.path.length - 1; k++) {
        if (!journeyPassable(j.path[k], j.force)) { broke = true; break; }
      }
      if (broke) {
        retreatJourney(j, '길이 끊겨');
        out.push(j);
        continue;
      }
      j.monthsElapsed += 1;
      if (j.monthsElapsed < j.monthsTotal) { rollJourneyEvent(j); continue; }
      arriveJourney(j);
      out.push(j);
    }
    if (out.length) { core.emit('changed'); core.persist(); }
    return out.length ? out : null;
  }

  global.DG = global.DG || {};

  W.journeys = journeys; W.journeysOf = journeysOf; W.journeyById = journeyById;
  W.canJourney = canJourney; W.startJourney = startJourney;
  W.homeForJourney = homeForJourney; W.resolveJourneys = resolveJourneys;
  W.JOURNEY_EVENTS = JOURNEY_EVENTS; W.rollJourneyEvent = rollJourneyEvent;
})(window);
