/**
 * 어드민 — QA 운영판 (`_admin.html` 이 부른다)
 * ---------------------------------------------------------------
 * 게임을 켜지 않고 **세이브와 손잡이만** 다룬다. 그림도 루프도 없다.
 * 사가만리·사가마을·사가종횡의 어드민과 같은 결이다 — 이 판에는 여태 없었다.
 *
 *   세이브     재화·성장·동행(부대)·진행 비우기
 *   던전·사명  최고 도달층·난도·역참·결사 · 사명 넷(메인·지역·이벤트·무작위)을
 *              실제 판정 함수(quest._onKill 등)로 진행시킨다
 *   장비       한 벌 갖추기·감정·가방·벨트(단약)·연단(조합 상자) 재료
 *   직업·무예  대표 무기를 채워 직업을 바꾸고, 그 나무를 찍는다
 *   3D 손잡이  `dg3d.*` — 이 판에는 콘솔로만 두드리던 것을 여기로 옮겼다
 *   프리셋     확인하려는 상황을 한 번에 만든다 + 스냅샷 세 칸
 *
 * 이 판은 **로그라이크**다 — 던전 회차(run)는 게임 창에서만 돈다. 어드민은
 * 회차를 넘어 남는 값(최고 도달층·역참·인물 성장·장비·세이브의 사명 진행)만
 * 다루고, 판을 대신 굴리지 않는다.
 *
 * 고친 뒤에는 `core.POKE_KEY` 를 두드린다. 게임 창이 열려 있으면 그것을 보고
 * 세이브를 다시 읽는다 — 게임이 틈틈이 저장하므로, 안 그러면 곧 덮인다.
 *
 * `core.js` 에는 이 어드민을 만들며 처음으로 손잡이 층(`tuned`/`setTune`/
 * `POKE_KEY`)을 얹었다 — 사가만리·사가마을·사가종횡와 **같은 이름**이다.
 * `dungeon3d.js`·`asset3d.js` 는 이미 "있으면 쓴다" 로 짜여 있어서 그 층만
 * 얹으면 `dg3d.*` 가 콘솔이 아니라 여기서 잡힌다.
 */
(function (global) {
  'use strict';

  var DG = global.DG;
  var C = DG.core, A = DG.account, D = DG.data, H = DG.hero;
  var IT = DG.item, ID = DG.itemData;
  var SK = DG.skill, SKD = DG.skillData;
  var HS = DG.heroSkillData;
  var DN = DG.dungeon, DD = DG.dungeonData;
  var Q = DG.quest, QD = DG.questData;
  var PO = DG.potion, VD = DG.vendor, AU = DG.auto;
  function GD() { return DG.gemData; }

  /* ── 잔손 ─────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html !== undefined) { n.innerHTML = html; }
    return n;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var logT = null;
  function say(msg) {
    var b = $('log');
    b.textContent = msg;
    b.classList.add('show');
    if (logT) { clearTimeout(logT); }
    logT = setTimeout(function () { b.classList.remove('show'); }, 2600);
  }

  /** 숫자 칸 하나 — 읽고(get) 쓰는(set) 짝을 받는다 */
  function numField(host, label, get, set) {
    var f = el('div', 'fld');
    f.appendChild(el('label', null, label));
    var i = el('input');
    i.type = 'number';
    i.value = get();
    i.addEventListener('change', function () {
      var v = Number(i.value);
      set(isFinite(v) ? v : 0);
      renderAll();
    });
    f.appendChild(i);
    host.appendChild(f);
    return i;
  }

  function btn(host, label, cls, fn) {
    var b = el('button', cls, label);
    b.addEventListener('click', fn);
    host.appendChild(b);
    return b;
  }

  /* ── 프로필 ───────────────────────────────────────── */

  function profiles() {
    var l = A.list();
    if (!l.length) { l = [{ id: 'v1', name: '(가입 전 세이브)' }]; }
    return l;
  }
  function keyFor(id) { return id === 'v1' ? (C.SAVE_BASE + '/v1') : A.keyOf(id); }

  function fillProfiles() {
    var sel = $('prof');
    sel.innerHTML = '';
    profiles().forEach(function (p) {
      var o = el('option');
      o.value = p.id; o.textContent = p.name + ' (' + p.id + ')';
      sel.appendChild(o);
    });
    var cur = A.current();
    if (cur) { sel.value = cur.id; }
    openProfile(sel.value);
  }

  function openProfile(id) {
    C.setSaveKey(keyFor(id));
    var ok = C.load();
    /* 사명·행상 표를 세운다 — 둘 다 "처음 읽을 때 지연 초기화" 라서
       한 번 status()/ensure() 를 불러 둬야 core.save.quest·core.save.vendor 가 생긴다 */
    try { Q.status(); } catch (e) { /* 무시 */ }
    try { VD.ensure(); } catch (e) { /* 무시 */ }
    say(ok ? '프로필을 읽었습니다 · ' + C.SAVE_KEY : '세이브가 비어 있어 새 판으로 엽니다');
    renderAll();
  }

  /** 저장 — 게임 창이 열려 있으면 그 창도 다시 읽게 두드린다 */
  function commit(msg) {
    C.persist();
    try { localStorage.setItem(C.POKE_KEY, String(Date.now())); } catch (e) { /* 무시 */ }
    renderAll();
    say(msg || '저장했습니다');
  }

  /* ── 요약 ─────────────────────────────────────────── */

  function renderSummary() {
    var p = C.save.player, ds = DN.state(), pw = H.partyPower(), au = AU.state();
    $('sum').innerHTML =
      'Lv.' + p.level + ' · 경험치 ' + C.fmt(p.exp) + '/' + C.fmt(C.expNeed(p.level)) +
      ' · 🪙 ' + C.fmt(p.gold) + ' · 🏅 ' + C.fmt(p.feat) +
      ' · 동행 ' + C.save.party.length + '/5 · 전투력 공 ' + pw.atk + ' 방 ' + pw.def + '<br>' +
      '🏆 최고 제' + (ds.best || 0) + '층 · 회차 ' + (ds.runs || 0) + ' · 답파 ' + (ds.clears || 0) +
      ' · 난도 ' + DN.modeOf(ds.mode).name +
      (ds.fallen ? ' · <span style="color:var(--bad)">☠️ 결사로 스러짐</span>' : '') +
      ' · 🤖 자동 순회 ' + (au.on ? 'ON' : 'off');
  }

  /* ── 세이브 탭 ────────────────────────────────────── */

  function renderBasics() {
    var host = $('basics');
    host.innerHTML = '';
    var p = C.save.player;
    numField(host, '레벨', function () { return p.level; }, function (v) {
      p.level = Math.max(1, Math.round(v)); p.exp = 0;
    });
    numField(host, '경험치', function () { return p.exp; }, function (v) { p.exp = Math.max(0, v); });
    numField(host, '금 🪙', function () { return p.gold; }, function (v) { p.gold = Math.max(0, v); });
    numField(host, '공적 🏅', function () { return p.feat; }, function (v) { p.feat = Math.max(0, v); });
    numField(host, '명성 🎖️', function () { return p.fame; }, function (v) { p.fame = Math.max(0, v); });
  }

  /** 도감에 있는(= 쓸 수 있는) 인물 목록 */
  function ownedHeroes() {
    var out = [], dex = C.save.dex.heroes, id;
    for (id in dex) {
      if (!Object.prototype.hasOwnProperty.call(dex, id)) { continue; }
      var h = D.find(id);
      if (h) { out.push(h); }
    }
    return out;
  }

  /** 도감에 없으면 넣어 준다 — 어드민은 "그 상황으로 곧장" 가는 자리다 */
  function giveHero(id) {
    var dex = C.save.dex.heroes;
    if (!dex[id]) { dex[id] = { count: 1, firstAt: Date.now() }; }
    H.ensure(id);
  }

  function renderParty() {
    var sel = $('lead');
    sel.innerHTML = '';
    var list = ownedHeroes();
    if (!list.length) { list = D.heroes.slice(0, 12); }
    list.forEach(function (h) {
      var o = el('option');
      o.value = h.id; o.textContent = h.name;
      sel.appendChild(o);
    });
    var lead = C.save.party[0];
    if (lead) { sel.value = lead; }
    var ref = lead ? D.find(lead) : null;
    $('leadinfo').textContent = ref
      ? (ref.name + ' — 무력 ' + H.stats(lead).might + ' · 지력 ' + H.stats(lead).wisdom +
         ' · 통솔 ' + H.stats(lead).command + ' · ' + (H.info(lead).rank || 0) + '성 · Lv.' + H.info(lead).lv)
      : '동행이 비어 있습니다 — 던전에 못 들어갑니다';
  }

  /* ── 던전 · 사명 탭 ───────────────────────────────── */

  function renderDgBasics() {
    var host = $('dgbasics');
    host.innerHTML = '';
    var ds = DN.state();
    numField(host, '최고 도달 층', function () { return ds.best || 0; },
      function (v) { ds.best = Math.max(0, Math.round(v)); });
    numField(host, '회차 수', function () { return ds.runs || 0; },
      function (v) { ds.runs = Math.max(0, Math.round(v)); });
    numField(host, '누적 처치', function () { return ds.kills || 0; },
      function (v) { ds.kills = Math.max(0, Math.round(v)); });
    numField(host, '누적 답파', function () { return ds.clears || 0; },
      function (v) { ds.clears = Math.max(0, Math.round(v)); });
    numField(host, '역참(밟은 최고층)', function () { return ds.waypoint || 0; },
      function (v) { ds.waypoint = Math.max(0, Math.round(v)); });

    var modes = $('modes');
    modes.innerHTML = '';
    DN.MODES.forEach(function (md) {
      var b = btn(modes, md.name + (md.need ? (' (최고 ' + md.need + '층 부터)') : ''),
        ds.mode === md.key ? 'on' : null, function () {
          ds.mode = md.key;
          commit('난도 · ' + md.name);
        });
      b.title = md.desc || '';
    });

    $('hcinfo').textContent = DN.hardcore()
      ? '☠️ 결사 켜짐 — 이 프로필은 쓰러지면 그 회차가 통째로 끝납니다'
      : '평시 — 쓰러져도 노획물만 잃습니다';
    $('hardcore-on').disabled = DN.hardcore();
    $('hardcore-on').textContent = DN.hardcore() ? '☠️ 이미 결사입니다' : '☠️ 결사(하드코어) 켜기 — 되돌릴 수 없습니다';
  }

  function renderRunInfo() {
    var run = DN.raw();
    $('runinfo').innerHTML = run
      ? ('▶️ 제' + run.floor + '층 · 방 ' + (run.room.index + 1) + '/' + run.roomTotal +
         ' · 체력 ' + Math.round(run.hp) + '/' + run.hpMax +
         ' · 기력 ' + Math.round(run.mp) + '/' + run.mpMax +
         ' · 이 회차 처치 ' + run.kills + ' · 노획 금 ' + Math.round(run.loot.gold))
      : '던전 중이 아닙니다 (이 창에서는 늘 그렇습니다 — 화면·루프가 없는 창입니다)';
  }

  function renderQuestStatus() {
    var st = Q.status();
    var lines = [];
    lines.push(st.main
      ? ('🚩 메인 · ' + esc(st.main.name) + ' — ' + st.main.have + '/' + st.main.need)
      : (st.mainDone ? '🚩 메인 — 전부 마쳤습니다' : '🚩 메인 없음'));
    st.regions.forEach(function (r, i) {
      lines.push('🗺️ 지역' + (i + 1) + ' · ' + esc(r.name) +
        (r.locked ? ' — 잠김' : (r.done ? ' — 완료' : (' — ' + r.have + '/' + r.need))));
    });
    lines.push(st.event
      ? ('🎗️ 이벤트 · ' + esc(st.event.name) + ' — ' + st.event.have + '/' + st.event.need)
      : (st.eventDone ? '🎗️ 이벤트 — 전부 마쳤습니다' : '🎗️ 이벤트 없음'));
    lines.push('🎲 현상 · ' + esc(st.random.name) + ' — ' + st.random.have + '/' + st.random.need);
    $('qstatus').innerHTML = lines.join('<br>');
  }

  function bestFloor() { return (C.save.dungeon && C.save.dungeon.best) || 1; }

  function fillMain() {
    var q = C.save.quest;
    var m = q ? QD.MAIN[q.mainIdx] : null;
    if (!m) { say('메인 사명이 없거나 다 마쳤습니다'); return; }
    if (m.req.t === 'floor') { Q._onFloor(m.req.n); }
    else if (m.req.t === 'kill') {
      for (var i = 0; i < m.req.n; i++) {
        Q._onKill({ e: { elite: m.req.tag === 'elite', boss: m.req.tag === 'boss' }, floor: bestFloor() });
      }
    } else if (m.req.t === 'discover') { Q._onRoom({ kind: m.req.room }); }
    commit('메인 · ' + m.name + ' 을(를) 채웠습니다');
  }

  function fillRegion() {
    Q.status();      // unlockRegions 를 한 번 돌려 열린 지역을 최신으로 만든다
    var q = C.save.quest, i;
    for (i = 0; i < DD.THEMES.length; i++) {
      var rq = q.region[i];
      if (!rq || rq.done) { continue; }
      var def = QD.regionQuest(i, DD.THEMES[i].name);
      for (var k = 0; k < def.req.n; k++) { Q._onKill({ e: {}, floor: DD.THEMES[i].from }); }
      commit('지역 · ' + def.name + ' 을(를) 채웠습니다');
      return;
    }
    say('열려 있고 아직 안 끝난 지역이 없습니다 — 최고 도달 층을 먼저 올리세요');
  }

  function fillEvent() {
    var q = C.save.quest;
    var ev = q ? QD.EVENT[q.eventIdx] : null;
    if (!ev) { say('이벤트 사명이 없거나 다 마쳤습니다'); return; }
    for (var i = 0; i < ev.req.n; i++) { Q._onRescue(); }
    commit('이벤트 · ' + ev.name + ' 을(를) 채웠습니다');
  }

  function fillRandom() {
    Q.status();       // 아직 한 번도 안 열었으면 이때 처음 굴려 둔다
    var q = C.save.quest;
    if (!q || !q.random) { say('현상판이 없습니다'); return; }
    var r = q.random;
    if (r.req.t === 'kill') {
      for (var i = 0; i < r.req.n; i++) {
        Q._onKill({ e: { elite: r.req.tag === 'elite', boss: r.req.tag === 'boss' }, floor: bestFloor() });
      }
    } else if (r.req.t === 'discover') { Q._onRoom({ kind: r.req.room }); }
    commit('현상 · ' + r.name + ' 을(를) 채웠습니다');
  }

  /* ── 장비 탭 ──────────────────────────────────────── */

  function renderGearSets() {
    var host = $('gearsets');
    host.innerHTML = '';
    ID.TIERS.forEach(function (t) {
      btn(host, t.name + ' 한 벌', null, function () { equipTier(t.key); });
    });
  }

  /** 선두에게 그 등급의 장비 여덟 부위를 채운다 — 요구 레벨은 맞춰 올린다 */
  function equipTier(t) {
    var lead = C.save.party[0];
    if (!lead) { say('동행이 없습니다'); return; }
    var ilvl = Math.max(1, t * 7 + 1);
    ID.SLOTS.forEach(function (slot) {
      var it = IT.roll(ilvl, { slot: slot, tier: t, unid: false });
      var need = IT.reqLevel(it);
      var info = H.ensure(lead);
      if (info.lv < need) { info.lv = Math.min(H.MAX_LV, need); }
      IT.add(it);
      IT.equip(lead, it.uid);
    });
    commit(ID.tier(t).name + ' 한 벌을 갖췄습니다');
  }

  function renderBagInfo() {
    $('baginfo').textContent = '가방 ' + IT.bag().length + '/' + IT.bagCap() + ' · 감정서 ' + IT.scrolls();
    $('scrolls').value = IT.scrolls();
  }

  function renderBeltInfo() {
    var b = PO.belt();
    var out = [];
    for (var i = 0; i < b.length; i++) {
      out.push((i + 1) + '. ' + (b[i] ? (PO.label(b[i].kind, b[i].g) + ' ×' + b[i].n) : '(비었음)'));
    }
    $('beltinfo').textContent = out.join(' · ');
  }

  /* ── 직업 · 무예 탭 ───────────────────────────────── */

  function classWeaponBase(clsKey) {
    var looks = SKD.weaponsFor(clsKey);
    if (!looks.length) { return null; }
    for (var i = 0; i < ID.BASES.length; i++) {
      if (ID.BASES[i].slot === 'weapon' && ID.BASES[i].look === looks[0]) { return ID.BASES[i]; }
    }
    return null;
  }

  function renderClasses() {
    var host = $('classes');
    host.innerHTML = '';
    var lead = C.save.party[0];
    var cur = lead ? SK.classOf(lead).key : null;
    SKD.CLASSES.forEach(function (cls) {
      var b = btn(host, cls.emoji + ' ' + cls.name, cur === cls.key ? 'on' : null, function () {
        if (!lead) { say('동행이 없습니다'); return; }
        var base = classWeaponBase(cls.key);
        if (!base) { say('대표 무기를 못 찾았습니다'); return; }
        var it = IT.roll(Math.max(1, bestFloor()), { base: base.key, tier: 2, unid: false });
        var need = IT.reqLevel(it);
        var info = H.ensure(lead);
        if (info.lv < need) { info.lv = Math.min(H.MAX_LV, need); }
        IT.add(it);
        IT.equip(lead, it.uid);
        commit(cls.name + ' — ' + base.name + ' 을(를) 채웠습니다');
      });
      b.title = cls.desc || '';
    });
    var j = lead ? SK.classOf(lead) : null;
    $('classinfo').innerHTML = lead
      ? (j.emoji + ' <b>' + esc(j.name) + '</b> — ' + esc(j.desc || '') +
         ' · 무예 점수 ' + SK.pointsLeft(lead) + '/' + SK.pointsTotal(lead) + ' (쓴 것 ' + SK.pointsSpent(lead) + ')')
      : '동행이 없습니다';
  }

  function renderSkills() {
    var host = $('skills');
    host.innerHTML = '';
    var lead = C.save.party[0];
    if (!lead) {
      host.appendChild(el('div', null, '<span style="font-size:11.5px;color:var(--dim)">동행이 없습니다</span>'));
      $('barrow').innerHTML = '';
      return;
    }
    var cls = SK.classOf(lead).key;
    SKD.skillsOf(cls).forEach(function (sk) {
      var rank = SK.rankOf(lead, sk.key);
      var card = el('div', 'one');
      var fm = el('div', 'fm');
      fm.innerHTML = '<b>' + sk.emoji + ' ' + esc(sk.name) + ' ' + rank + '/' + SKD.MAX_RANK + '</b>' +
        '<small>' + esc(sk.desc || '') + '</small>' +
        '<small>' + (sk.shape === 'passive' ? '상시' : ('기력 ' + sk.cost + ' · 재냉각 ' + sk.cd + '초')) + '</small>';
      card.appendChild(fm);
      var fb = el('div', 'fb');
      btn(fb, '＋1', null, function () {
        var r = SK.learn(lead, sk.key);
        if (!r.ok) { say('못 올렸습니다 — ' + r.reason); return; }
        commit(sk.name + ' ' + r.rank);
      });
      card.appendChild(fb);
      host.appendChild(card);
    });

    var bar = $('barrow');
    bar.innerHTML = '';
    SK.equipped(lead).forEach(function (got, i) {
      var c = got
        ? el('span', 'chip on', (i + 1) + ' ' + got.sk.emoji + ' ' + esc(got.sk.name) + ' ' + got.rank)
        : el('span', 'chip', (i + 1) + ' 비었음');
      bar.appendChild(c);
    });
  }

  /** 인물별 서명 무예 — 105명 전부를 고를 수 있는 목록(도감 소유 여부 무관,
   *  위 renderParty()의 #lead 와 달리 시험은 등용 전 인물도 눌러 봐야 하니
   *  ownedHeroes()로 좁히지 않는다). 서명 무예가 없는 인물도 "(없음)"으로
   *  그대로 보여 — 105명 중 어디까지 채워졌는지 이 목록만 봐도 안다. */
  function renderSigTester() {
    var sel = $('sig-hero');
    if (!sel) { return; }               // 이 카드가 없는 옛 캐시 대비 방어적 가드
    var keepVal = sel.value;
    sel.innerHTML = '';
    D.heroes.forEach(function (h) {
      var sig = HS && HS.sigOf(h.id);
      var o = el('option');
      o.value = h.id;
      o.textContent = h.name + (sig ? (' · ' + sig.emoji + ' ' + sig.name) : ' · (없음)');
      sel.appendChild(o);
    });
    if (keepVal) { sel.value = keepVal; }
  }

  /**
   * 인물 하나의 서명 무예를 실제로 발동시켜 본다 — `dungeon.js`의
   * `castSigSkill()`을 그대로 부른다(가짜 계산이 아니라 실제 판정 경로).
   * **지금 프로필의 동행·회차 기록은 시험 전으로 그대로 되돌린다** —
   * 위 `selftest()`가 임시 프로필을 쓰는 것과 달리, 이건 지금 열어 둔
   * 진짜 프로필에서 바로 눌러 보는 자리라 흔적을 남기면 안 된다.
   */
  function testSigSkill(id) {
    var sig = HS && HS.sigOf(id);
    if (!sig) { return { ok: false, reason: 'no-sig' }; }
    var keepParty = C.save.party.slice();
    var keepHeroRec = C.save.heroes[id];
    var keepRuns = DN.state().runs;
    if (DN.raw()) { DN.leave(); }       // 남은 회차가 있으면(드묾) 먼저 치운다
    H.ensure(id);
    C.save.party = [id];
    var entered = DN.enter({ floor: 4, mode: 'easy' });
    var result;
    if (!entered) {
      result = { ok: false, reason: 'enter-failed' };
    } else {
      var fired = DN.castSigSkill();
      var st = DN.status();
      DN.leave();
      result = { ok: true, fired: fired, sig: sig, cdAfter: st.sigSkill.cd };
    }
    C.save.party = keepParty;
    DN.state().runs = keepRuns;
    if (keepHeroRec === undefined) { delete C.save.heroes[id]; } else { C.save.heroes[id] = keepHeroRec; }
    return result;
  }

  /** 선두 레벨을 만렙까지 올리고, 갈래마다 낮은 단부터 되는 데까지 찍는다 */
  function fillSkillTree() {
    var lead = C.save.party[0];
    if (!lead) { say('동행이 없습니다'); return; }
    var info = H.ensure(lead);
    info.lv = H.MAX_LV;
    var cls = SK.classOf(lead).key;
    var byBr = {};
    SKD.skillsOf(cls).forEach(function (sk) { (byBr[sk.br] = byBr[sk.br] || []).push(sk); });
    Object.keys(byBr).forEach(function (br) {
      byBr[br].sort(function (a, b) { return a.row - b.row; });
      byBr[br].forEach(function (sk) {
        for (var r = 0; r < SKD.MAX_RANK; r++) { if (!SK.learn(lead, sk.key).ok) { break; } }
      });
    });
    commit('무예를 되는 데까지 찍었습니다 (점수가 모자라면 낮은 단부터 남습니다)');
  }

  /* ── 3D 손잡이 탭 ─────────────────────────────────── */

  var KNOBS = [
    ['dg3d.on',        '3D 켜기',        1,    1,    '0 이면 예전 캔버스 2D 화면으로 돌아간다'],
    ['dg3d.zoom',      '카메라 거리',     1,    0.1,  '작을수록 방을 당겨 본다'],
    ['dg3d.tilt',      '카메라 기울기',   0.62, 0.05, '0 완전 위쪽 부감 · 1 낮게 눕힌 시점'],
    ['dg3d.dark',      '어둠 깊이',       0.45, 0.05, '1 이면 횃불 밖이 새까맣다'],
    ['dg3d.field',     '방 밖 들판',      1,    1,    '0 이면 1단계의 허공에 뜬 상자로 돌아간다'],
    ['dg3d.fieldR',    '들판 반경(조각)', null, 1,    '비우면 그래픽 품질(AUTO)을 따른다'],
    ['dg3d.fieldDens', '들판 밀도',       null, 0.1,  '비우면 그래픽 품질(AUTO)을 따른다'],
    ['dg3d.shadow',    '그림자',          null, 1,    '0/1 · 비우면 그래픽 품질(AUTO)을 따른다']
  ];

  function renderTune() {
    var host = $('tunefields');
    host.innerHTML = '';
    var grid = el('div', 'grid');
    KNOBS.forEach(function (k) {
      var f = el('div', 'fld');
      var lab = el('label', null, esc(k[1]));
      lab.title = k[4] || '';
      f.appendChild(lab);
      var i = el('input');
      i.type = 'number';
      i.step = k[3];
      i.placeholder = k[2] === null ? '자동' : String(k[2]);
      var cur = C.tune()[k[0]];
      i.value = (cur === undefined || cur === null) ? '' : cur;
      i.addEventListener('change', function () {
        C.setTune(k[0], i.value === '' ? null : Number(i.value));
        renderTunePill();
        say(i.value === '' ? (k[1] + ' 을(를) 놓았습니다') : (k[1] + ' = ' + i.value));
      });
      f.appendChild(i);
      f.appendChild(el('span', 'def', k[2] === null ? '기본 자동' : ('기본 ' + k[2])));
      grid.appendChild(f);
    });
    host.appendChild(grid);
  }

  function renderTunePill() {
    var t = C.tune(), n = 0, k;
    for (k in t) { if (Object.prototype.hasOwnProperty.call(t, k)) { n++; } }
    var pill = $('tunepill');
    pill.className = 'pill ' + (n ? 'tuned' : 'clean');
    pill.textContent = n ? ('손잡이 ' + n + '개') : '손잡이 없음';
    var sum = $('tunesum');
    if (sum) {
      sum.textContent = n
        ? (n + '개가 잡혀 있습니다 — 게임 창이 다음에 3D 무대를 다시 세울 때(방을 나가고 들어올 때) 반영됩니다')
        : '전부 코드의 기본값입니다';
    }
  }

  /* ── 프리셋 ───────────────────────────────────────── */

  var PRESETS = [
    ['🐣 갓 시작한 판', 'Lv.1 · 맨몸 · 던전 기록 0 · 동행 없음',
      function () {
        var p = C.save.player;
        p.level = 1; p.exp = 0; p.gold = 120; p.feat = 0;
        C.save.party = [];
        C.save.dex.heroes = {};
        C.save.heroes = {};
        C.save.gear = { seq: 1, bag: [], equip: {}, mats: { gem: {}, rune: {}, jewel: [] } };
        C.save.skills = {}; C.save.slots = {};
        C.save.belt = [];
        C.save.quest = { mainIdx: 0, mainHave: 0, region: {}, eventIdx: 0, eventHave: 0, random: null };
        C.save.dungeon = { best: 0, runs: 0, kills: 0, clears: 0, mode: 'normal' };
      }],
    ['⚔️ 명품 한 벌 갖춘 판', 'Lv.10 · 동행 셋 · 선두 명품 한 벌 · 최고 3층',
      function () {
        ensureParty(3);
        C.save.player.level = 10;
        equipTier(2);
        C.save.dungeon.best = Math.max(C.save.dungeon.best || 0, 3);
      }],
    ['🛡️ 보물 한 벌 갖춘 판', 'Lv.20 · 험(險) 난도 · 선두 보물 한 벌 · 최고 10층',
      function () {
        ensureParty(3);
        C.save.player.level = 20;
        C.save.dungeon.best = Math.max(C.save.dungeon.best || 0, 10);
        C.save.dungeon.mode = 'hard';
        equipTier(3);
      }],
    ['🏆 다 갖춘 판', 'Lv.30 만렙 · 절(絕) 난도 · 전설 한 벌 · 무예 되는 데까지 · 금 100만',
      function () {
        ensureParty(3);
        var p = C.save.player;
        p.level = 30; p.gold = 1000000; p.feat = 5000;
        C.save.dungeon.best = Math.max(C.save.dungeon.best || 0, 25);
        C.save.dungeon.mode = 'hell';
        equipTier(4);
        fillSkillTree();
      }],
    ['🎒 가방이 가득', '무작위 등급 물건으로 가방을 채운다 — 못 줍는 자리를 본다',
      function () {
        var cap = IT.bagCap();
        while (IT.bag().length < cap) {
          var t = Math.random() < 0.6 ? 0 : (Math.random() < 0.7 ? 1 : 2);
          IT.add(IT.roll(Math.max(1, bestFloor()), { tier: t, unid: false }));
        }
      }],
    ['💎 연단 재료 창고', '보석 다섯 종류 조(粗) 12개 + 부문 셋 6개 — 연단 조합을 바로 본다',
      function () {
        GD().GEMS.forEach(function (g) { IT.addMat('gem', g.key, 0, 12); });
        GD().RUNES.slice(0, 3).forEach(function (r) { IT.addMat('rune', r.key, 0, 6); });
      }],
    ['🔎 미확인 감정 대기', '가방을 명품 등급 미확인으로 채우고 감정서 10장을 둔다',
      function () {
        for (var i = 0; i < 6 && IT.bag().length < IT.bagCap(); i++) {
          IT.add(IT.roll(Math.max(1, bestFloor()), { tier: 2 }));
        }
        IT.addScroll(10 - IT.scrolls());
      }],
    ['🍶 벨트 가득', '회복·기력단으로 요대 네 칸을 채운다',
      function () {
        C.save.belt = [];
        PO.add('heal', 1); PO.add('heal', 1); PO.add('mana', 1); PO.add('mana', 0);
      }],
    ['☠️ 결사(하드코어) 판', '결사를 켠 새 판 — 쓰러지면 그 회차로 끝난다',
      function () {
        ensureParty(3);
        DN.setHardcore(true);
      }],
    ['🤖 자동 순회 켬', '자동을 켜고 최고층 절반부터 다시 내려가게 한다',
      function () {
        ensureParty(3);
        AU.setOn(true);
      }],
    ['📋 사명 진행 채우기', '지금 메인 목표를 실제 판정 함수로 채운다',
      function () {
        ensureParty(3);
        Q.status();
        fillMainQuiet();
      }],
    ['🎲 행상 재고 새로', '재고 · 투전 목록을 다시 굴린다 (되사기 목록도 비운다)',
      function () { VD.refresh(); }]
  ];

  /** 프리셋 안에서 쓰는, 저장 없이 채우는 조용한 버전 */
  function fillMainQuiet() {
    var q = C.save.quest;
    var m = q ? QD.MAIN[q.mainIdx] : null;
    if (!m) { return; }
    if (m.req.t === 'floor') { Q._onFloor(m.req.n); }
    else if (m.req.t === 'kill') {
      for (var i = 0; i < m.req.n; i++) {
        Q._onKill({ e: { elite: m.req.tag === 'elite', boss: m.req.tag === 'boss' }, floor: bestFloor() });
      }
    } else if (m.req.t === 'discover') { Q._onRoom({ kind: m.req.room }); }
  }

  /** 동행이 n명이 안 되면 도감의 낮은 등급부터 채워 넣는다 */
  function ensureParty(n) {
    var list = ownedHeroes();
    if (list.length < n) { list = D.heroes.slice(0, n); }
    var ids = list.slice(0, n).map(function (h) { giveHero(h.id); return h.id; });
    ids.forEach(function (id) { if (C.save.party.indexOf(id) < 0) { C.save.party.push(id); } });
    C.save.party = C.save.party.slice(0, 5);
  }

  function renderPresets() {
    var host = $('presets');
    host.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = el('button', 'preset', '<b>' + esc(p[0]) + '</b><small>' + esc(p[1]) + '</small>');
      b.addEventListener('click', function () {
        try { p[2](); } catch (e) { say('만들지 못했습니다: ' + e.message); return; }
        commit(p[0] + ' — 만들었습니다');
      });
      host.appendChild(b);
    });
  }

  /* ── 스냅샷 — 세이브와 별개 칸, 이 기기에만 ────────── */

  var SNAP = 'yeoksa-dungeon/admin/snap/';

  function renderSnaps() {
    var host = $('snaps');
    host.innerHTML = '';
    for (var i = 1; i <= 3; i++) {
      (function (n) {
        var raw = null;
        try { raw = localStorage.getItem(SNAP + n); } catch (e) { /* 무시 */ }
        var wrap = el('span');
        btn(wrap, '📷 ' + n + '칸에 뜬다', null, function () {
          try {
            localStorage.setItem(SNAP + n, JSON.stringify(C.save));
            renderSnaps();
            say(n + '칸에 떴습니다');
          } catch (e) { say('뜨지 못했습니다: ' + e.message); }
        });
        btn(wrap, '↩️ ' + n + '칸으로', raw ? 'go' : null, function () {
          if (!raw) { say(n + '칸이 비었습니다'); return; }
          try {
            localStorage.setItem(C.SAVE_KEY, raw);
            C.load();
            commit(n + '칸으로 돌렸습니다');
          } catch (e) { say('돌리지 못했습니다: ' + e.message); }
        });
        wrap.appendChild(el('span', null,
          '<span style="font-size:11px;color:var(--dim)">' +
          (raw ? (Math.round(raw.length / 1024) + 'KB') : '비었음') + '</span>&nbsp;&nbsp;'));
        host.appendChild(wrap);
      })(i);
    }
  }

  /* ── 오류 (SAGA-DESIGN §8-2) ──────────────────────── */

  function renderErr() {
    var E = global.DG && global.DG.errlog;
    var list = E ? E.list() : [];
    $('err-max').textContent = E ? E.MAX : 50;
    if (!list.length) { $('err-out').value = ''; return; }
    $('err-out').value = list.slice().reverse().map(function (e) {
      var when = e.t ? new Date(e.t).toLocaleString() : '?';
      var head = '[' + when + '] ' + (e.kind || 'error') + ' — ' + (e.msg || '');
      var where = e.src ? ('\n  ' + e.src + ':' + (e.line || 0) + ':' + (e.col || 0)) : '';
      var stack = e.stack ? ('\n' + e.stack) : '';
      return head + where + stack;
    }).join('\n\n');
  }

  /* ── 자가점검 ─────────────────────────────────────── */

  /**
   * 어드민이 세이브·손잡이를 제대로 읽고 쓰는지 스스로 본다.
   * **지금 프로필을 건드리지 않는다** — 따로 만든 칸에서 확인하고 지운다.
   */
  function selftest() {
    var out = [], keep = C.SAVE_KEY, tmp = C.SAVE_BASE + '/__admincheck';
    function ok(name, cond, extra) {
      out.push((cond ? '<span style="color:var(--good)">✔</span> ' : '<span style="color:var(--bad)">✘</span> ') +
        esc(name) + (extra ? (' <span style="color:var(--dim)">— ' + esc(extra) + '</span>') : ''));
      return !!cond;
    }
    try {
      C.setSaveKey(tmp);
      C.reset();
      C.load();

      ok('세이브 키가 폴더 이름이 아니라 yeoksa-dungeon 이다', C.SAVE_BASE === 'yeoksa-dungeon/save', C.SAVE_BASE);
      C.save.player.gold = 4321;
      C.persist();
      C.save.player.gold = 0;
      C.load();
      ok('저장한 값이 다시 읽힌다', C.save.player.gold === 4321, '금 ' + C.save.player.gold);

      var hid = D.heroes[0].id;
      giveHero(hid);
      C.save.party = [hid];
      var before = H.stats(hid).might;
      H.ensure(hid).lv = 10;
      ok('레벨이 오르면 능력치가 오른다', H.stats(hid).might > before, before + ' → ' + H.stats(hid).might);

      var it = IT.roll(5, { slot: 'weapon', tier: 2, unid: false });
      IT.add(it);
      var equipped = IT.equip(hid, it.uid);
      ok('장비를 끼면 능력치가 오른다', equipped && IT.statBonus(hid).flat.might >= 0, '');

      var cls = SK.classOf(hid).key;
      var tree = SKD.skillsOf(cls).filter(function (s) { return s.row === 0; });
      var learned = tree.length ? SK.learn(hid, tree[0].key).ok : false;
      ok('무예는 앞 단계부터 배운다', learned, cls + ' · ' + (tree[0] && tree[0].name));

      /* 프리셋 전부를 임시 프로필에서 실제로 눌러 본다 — 한 곳이라도 예외를
         내면 그 프리셋은 QA 창에서 회색 화면(콘솔 에러)으로 보였을 자리다. */
      var presetErr = '';
      for (var pi = 0; pi < PRESETS.length && !presetErr; pi++) {
        try { PRESETS[pi][2](); } catch (pe) { presetErr = PRESETS[pi][0] + ' — ' + pe.message; }
      }
      ok('프리셋 ' + PRESETS.length + '개가 예외 없이 돈다', !presetErr, presetErr);

      ok('던전 최고층은 세이브(dungeon.best)에 남는다', typeof DN.state().best === 'number');
      DN.state().best = 7;
      ok('어드민이 고친 최고층이 그대로 읽힌다', DN.state().best === 7);

      Q.status();
      var q0 = QD.MAIN[0];
      if (q0.req.t === 'floor') { Q._onFloor(q0.req.n); }
      ok('사명은 실제 판정 함수(quest._onFloor 등)로 진행된다',
        C.save.quest.mainIdx > 0 || C.save.quest.mainHave >= q0.req.n);

      var beforeTune = C.tuned('dg3d.dark', 0.45);
      C.setTune('dg3d.dark', 0.9);
      ok('손잡이를 잡으면 그 값이 나온다', C.tuned('dg3d.dark', 0.45) === 0.9, String(C.tuned('dg3d.dark', 0.45)));
      C.setTune('dg3d.dark', beforeTune === 0.45 ? null : beforeTune);
      ok('손잡이를 놓으면 기본값으로 돌아온다', C.tuned('dg3d.dark', 0.45) === 0.45);

      ok('어드민은 게임 창을 두드릴 자리를 안다',
        typeof C.POKE_KEY === 'string' && C.POKE_KEY.indexOf('yeoksa-dungeon') === 0, C.POKE_KEY);
    } catch (e) {
      out.push('<span style="color:var(--bad)">✘</span> 점검 중에 멈췄습니다 — ' + esc(e.message));
    }
    try { localStorage.removeItem(tmp); } catch (e) { /* 무시 */ }
    C.setSaveKey(keep);
    C.load();
    try { Q.status(); } catch (e) { /* 무시 */ }
    try { VD.ensure(); } catch (e) { /* 무시 */ }
    renderAll();

    var bad = out.filter(function (s) { return s.indexOf('✘') >= 0; }).length;
    out.push('<b>' + (out.length - bad) + '/' + out.length + '</b>');
    $('selfout').innerHTML = out.join('<br>');
  }

  /* ── 그리기 ───────────────────────────────────────── */

  function renderAll() {
    renderSummary();
    renderBasics();
    renderParty();
    renderDgBasics();
    renderRunInfo();
    renderQuestStatus();
    renderGearSets();
    renderBagInfo();
    renderBeltInfo();
    renderClasses();
    renderSkills();
    renderSigTester();
    renderTunePill();
    renderSnaps();
    renderErr();
  }

  /* ── 붙이기 ───────────────────────────────────────── */

  function bind() {
    var nav = document.querySelector('nav');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
      if (!b) { return; }
      Array.prototype.forEach.call(nav.querySelectorAll('button'), function (x) { x.classList.remove('sel'); });
      b.classList.add('sel');
      Array.prototype.forEach.call(document.querySelectorAll('main section'), function (s) { s.classList.remove('show'); });
      var sec = $('tab-' + b.getAttribute('data-tab'));
      if (sec) { sec.classList.add('show'); }
    });

    $('prof').addEventListener('change', function () { openProfile($('prof').value); });
    $('save').addEventListener('click', function () { commit('저장했습니다'); });
    $('reload').addEventListener('click', function () { openProfile($('prof').value); });

    $('lead-apply').addEventListener('click', function () {
      var id = $('lead').value;
      giveHero(id);
      var p = C.save.party;
      var i = p.indexOf(id);
      if (i >= 0) { p.splice(i, 1); }
      p.unshift(id);
      C.save.party = p.slice(0, 5);
      commit('동행 맨 앞에 세웠습니다');
    });
    $('party-fill').addEventListener('click', function () { ensureParty(3); commit('셋을 채웠습니다'); });
    $('party-rank').addEventListener('click', function () {
      var id = C.save.party[0];
      if (!id) { say('선두가 없습니다'); return; }
      var chk = H.rankUpCheck(id);
      if (!chk.ok) { say('승급 조건이 안 됩니다 — ' + chk.why); return; }
      H.rankUp(id);
      commit((D.find(id).name) + ' — ' + H.info(id).rank + '성');
    });

    Array.prototype.forEach.call(document.querySelectorAll('button[data-clear]'), function (b) {
      b.addEventListener('click', function () {
        var what = b.getAttribute('data-clear');
        if (what === 'dungeon') { C.save.dungeon = { best: 0, runs: 0, kills: 0, clears: 0, mode: 'normal' }; }
        if (what === 'fallen') { if (C.save.dungeon) { delete C.save.dungeon.fallen; } }
        if (what === 'quest') { C.save.quest = { mainIdx: 0, mainHave: 0, region: {}, eventIdx: 0, eventHave: 0, random: null }; }
        if (what === 'bag') {
          C.save.gear = { seq: 1, bag: [], equip: (C.save.gear && C.save.gear.equip) || {}, mats: { gem: {}, rune: {}, jewel: [] }, stash: [] };
        }
        if (what === 'belt') { C.save.belt = []; }
        if (what === 'vendor') { VD.refresh(); }
        if (what === 'log') { C.save.log = []; }
        if (what === 'all') {
          if (!confirm('정말 이 프로필의 진행을 통째로 지울까요?')) { return; }
          C.reset();
          C.load();
        }
        commit('비웠습니다 — ' + what);
      });
    });

    $('hardcore-on').addEventListener('click', function () {
      if (DN.hardcore()) { return; }
      if (!confirm('결사(하드코어)를 켤까요? 되돌릴 수 없습니다.')) { return; }
      DN.setHardcore(true);
      commit('☠️ 결사를 켰습니다');
    });

    $('q-main').addEventListener('click', fillMain);
    $('q-region').addEventListener('click', fillRegion);
    $('q-event').addEventListener('click', fillEvent);
    $('q-random').addEventListener('click', fillRandom);
    $('q-reroll').addEventListener('click', function () { Q.reroll(); commit('현상판을 다시 뽑았습니다'); });

    $('gear-strip').addEventListener('click', function () {
      var lead = C.save.party[0];
      if (!lead) { say('동행이 없습니다'); return; }
      var eq = IT.equipped(lead), slot;
      for (slot in eq) {
        if (Object.prototype.hasOwnProperty.call(eq, slot) && eq[slot]) { IT.unequip(lead, slot); }
      }
      commit('선두를 다 벗겼습니다');
    });
    $('gear-repair').addEventListener('click', function () {
      var r = IT.repairAll();
      if (!r.ok) { say('수리할 것이 없거나(reason: ' + r.reason + ')'); return; }
      commit('장비 ' + r.n + '점 수리 · 금 -' + C.fmt(r.cost));
    });

    $('scroll-apply').addEventListener('click', function () {
      var v = Math.max(0, Math.round(Number($('scrolls').value) || 0));
      IT.addScroll(v - IT.scrolls());
      commit('감정서 ' + IT.scrolls() + '장');
    });
    $('ident-all').addEventListener('click', function () {
      var r = IT.identifyAll();
      commit('감정 ' + r.done + '점 · 남은 미확인 ' + r.left);
    });
    $('bag-fill').addEventListener('click', function () {
      var cap = IT.bagCap();
      while (IT.bag().length < cap) {
        var t = Math.random() < 0.6 ? 0 : (Math.random() < 0.7 ? 1 : 2);
        IT.add(IT.roll(Math.max(1, bestFloor()), { tier: t, unid: false }));
      }
      commit('가방을 채웠습니다');
    });
    $('bag-clean').addEventListener('click', function () {
      var r = IT.autoClean();
      commit('자동 정리 · ' + r.sold + '점 매각 (금 +' + C.fmt(r.gold) + ')');
    });

    $('belt-fill').addEventListener('click', function () {
      C.save.belt = [];
      PO.add('heal', 2); PO.add('heal', 1); PO.add('mana', 2); PO.add('mana', 1);
      commit('벨트를 채웠습니다');
    });
    $('belt-clear').addEventListener('click', function () { C.save.belt = []; commit('벨트를 비웠습니다'); });

    $('mat-gem').addEventListener('click', function () {
      GD().GEMS.forEach(function (g) { IT.addMat('gem', g.key, 0, 12); });
      commit('보석(조) 재료를 채웠습니다');
    });
    $('mat-gem-top').addEventListener('click', function () {
      GD().GEMS.forEach(function (g) { IT.addMat('gem', g.key, 4, 4); });
      commit('보석(완) 재료를 채웠습니다');
    });
    $('mat-rune').addEventListener('click', function () {
      GD().RUNES.slice(0, 3).forEach(function (r) { IT.addMat('rune', r.key, 0, 6); });
      commit('부문 재료를 채웠습니다');
    });
    $('mat-clear').addEventListener('click', function () {
      if (C.save.gear) { C.save.gear.mats = { gem: {}, rune: {}, jewel: [] }; }
      commit('세공 재료를 비웠습니다');
    });

    $('skill-max').addEventListener('click', fillSkillTree);
    $('skill-clear').addEventListener('click', function () {
      var lead = C.save.party[0];
      if (!lead) { say('동행이 없습니다'); return; }
      var spent = SK.respec(lead);
      commit('환원 — ' + spent + '점을 돌려받았습니다');
    });

    $('sig-test').addEventListener('click', function () {
      var id = $('sig-hero').value;
      var h = D.find(id);
      var out = $('sig-result');
      var r = testSigSkill(id);
      if (!r.ok) {
        out.textContent = r.reason === 'no-sig'
          ? (h ? h.name : id) + ' — 서명 무예가 아직 없습니다.'
          : '시험 진입에 실패했습니다(부대·세이브 상태를 확인하세요).';
        return;
      }
      out.innerHTML = (r.fired ? '<span style="color:var(--good)">✔ 발동됨</span>' : '<span style="color:var(--bad)">✘ 발동 실패</span>') +
        ' — ' + r.sig.emoji + ' <b>' + esc(r.sig.name) + '</b> · ' + esc(r.sig.desc) +
        '<br>모양 ' + esc(r.sig.shape) + ' · 재사용 ' + r.sig.cd + '초 · 발동 직후 남은 쿨다운 ' +
        r.cdAfter.toFixed(1) + '초 (동행·회차 기록은 시험 전으로 되돌렸습니다)';
    });

    $('tune-clear').addEventListener('click', function () {
      C.clearTune();
      renderTune();
      renderTunePill();
      say('손잡이를 다 놓았습니다');
    });

    $('dump').addEventListener('click', function () {
      $('json').value = JSON.stringify(C.save, null, 2);
      var n = 0;
      try { n = (localStorage.getItem(C.SAVE_KEY) || '').length; } catch (e) { /* 무시 */ }
      $('usage').textContent = Math.round(n / 1024) + 'KB · ' + C.SAVE_KEY;
    });
    $('load').addEventListener('click', function () {
      var raw = $('json').value.trim();
      if (!raw) { say('붙여 넣은 것이 없습니다'); return; }
      try {
        var o = JSON.parse(raw);
        localStorage.setItem(C.SAVE_KEY, JSON.stringify(o));
        C.load();
        try { Q.status(); } catch (e) { /* 무시 */ }
        try { VD.ensure(); } catch (e) { /* 무시 */ }
        commit('덮었습니다');
      } catch (e) { say('읽지 못했습니다: ' + e.message); }
    });

    $('selftest').addEventListener('click', selftest);

    $('err-refresh').addEventListener('click', renderErr);
    $('err-copy').addEventListener('click', function () {
      $('err-out').select();
      try { document.execCommand('copy'); say('복사했습니다'); } catch (e) { say('직접 복사해 주세요'); }
    });
    $('err-clear').addEventListener('click', function () {
      var E = global.DG && global.DG.errlog;
      if (E) { E.clear(); }
      renderErr();
      say('비웠습니다');
    });
  }

  /* ── 부트 ─────────────────────────────────────────── */

  bind();
  fillProfiles();
  renderTune();
  renderPresets();

  /* `_admin.html?selftest` 로 열면 스스로 점검하고 **제목에 결과를 적는다.**
     어드민은 눌러야 도는 화면이라 진단(`_test.html`)이 붙지 못한다 — 헤드리스로
     확인할 수 있는 유일한 자리다:
       chrome --headless=new --dump-dom "…/_admin.html?selftest"  →  ADMIN n/n */
  if (global.location && global.location.search.indexOf('selftest') >= 0) {
    setTimeout(function () {
      selftest();
      var txt = $('selfout').textContent || '';
      var bad = (txt.match(/✘/g) || []).length;
      var all = (txt.match(/[✔✘]/g) || []).length;
      document.title = 'ADMIN ' + (all - bad) + '/' + all;
    }, 60);
  }

  /** 자가진단이 부를 수 있게 열어 둔다 (화면 없이 확인하는 자리) */
  global.DG.admin = {
    KNOBS: KNOBS, PRESETS: PRESETS,
    equipTier: equipTier, fillSkillTree: fillSkillTree, selftest: selftest
  };

})(window);
