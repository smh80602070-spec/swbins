/**
 * 어드민 — QA 운영판 (`_admin.html` 이 부른다)
 * ---------------------------------------------------------------
 * 게임을 켜지 않고 **세이브와 손잡이만** 다룬다. 지도도 루프도 없다.
 * 사가만리·사가마을·사가종횡·사가나락의 어드민과 같은 결이다 — 이 판에는 여태 없었다.
 *
 *   세이브     연·월·시나리오 새로 세우기·순위·진행 비우기
 *   성(城)     서른 성의 소속·내정·살림을 표로 고친다
 *   무장       내 세력·재야·포로 — 충성·승진·등용을 곧장 다룬다
 *   전쟁·외교  진(陣) 목록·철수, 세력 간 동맹·화친
 *   손잡이     `rtk.*` — 무장 봉급·군량 소모·상업/농업 배수·태수 보정·재해 확률
 *   프리셋     확인하려는 상황을 한 번에 만든다 + 스냅샷 세 칸
 *
 * 이 판은 **턴제**다 — rAF 루프가 없다. `rtk.js` 의 상수 손잡이는 대부분 모듈이
 * 뜰 때 한 번만 읽으므로, 잡은 뒤에는 게임 창을 **새로고침**해야 듣는다.
 *
 * 고친 뒤에는 `core.POKE_KEY` 를 두드린다. 게임 창이 열려 있으면 그것을 보고
 * 세이브를 다시 읽는다 — 게임이 틈틈이 저장하므로, 안 그러면 곧 덮인다.
 *
 * `core.js` 에는 이 어드민을 만들며 처음으로 손잡이 층(`tuned`/`setTune`/
 * `POKE_KEY`)을 얹었다 — 사가만리·사가마을·사가종횡·사가나락와 **같은 이름**이다.
 * `rtk.js` 의 무장 봉급·군량 소모 등 여섯 상수도 이때 `core.tuned(...)` 로
 * 바꿔 얹었다 — 그 전에는 손잡이로 뽑을 자리 자체가 없었다.
 *
 * **성을 강제로 넘길 때는 `war.capture` 를 부르지 않는다.** 그 함수는 전투 보고서
 * (atk/def)를 요구하고 수비 무장을 달아나게/사로잡게 만드는 등 부작용이 커서,
 * 어드민에서 사본만 만들어 부르면 오히려 세이브가 어긋난다. 대신 소속·치안·태수를
 * **직접** 고쳐 "막 빼앗은 성" 의 상태를 흉내낸다 — 판정 함수는 손대지 않는다.
 */
(function (global) {
  'use strict';

  var DG = global.DG;
  var C = DG.core, A = DG.account, D = DG.data, H = DG.hero;
  var CD = DG.cityData, FD = DG.forceData, QD = DG.quizData;
  var R = DG.rtk, OFF = DG.off, WAR = DG.war, DIP = DG.diplo;

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

  function td(html, cls) {
    var c = document.createElement('td');
    if (cls) { c.className = cls; }
    if (html instanceof Node) { c.appendChild(html); } else { c.innerHTML = html; }
    return c;
  }
  function numInput(val, step, onSet) {
    var i = el('input');
    i.type = 'number';
    if (step) { i.step = step; }
    i.value = val;
    i.addEventListener('change', function () {
      var v = Number(i.value);
      onSet(isFinite(v) ? v : 0);
      commit();
    });
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
    say(ok ? '프로필을 읽었습니다 · ' + C.SAVE_KEY : '세이브가 비어 있어 새 판으로 엽니다');
    renderAll();
  }

  /** 저장 — 게임 창이 열려 있으면 그 창도 다시 읽게 두드린다 */
  function commit(msg) {
    C.persist();
    try { localStorage.setItem(C.POKE_KEY, String(Date.now())); } catch (e) { /* 무시 */ }
    renderAll();
    if (msg) { say(msg); }
  }

  /* ── 세이브 탭 ────────────────────────────────────── */

  function renderSummary() {
    var st = R.state();
    if (!st.started) {
      $('sum').innerHTML = '아직 판이 시작되지 않았습니다 — 아래에서 시나리오와 세력을 골라 새로 세우세요.';
      return;
    }
    var sc = FD.scenario(st.scen);
    var sm = R.summary(R.me());
    $('sum').innerHTML =
      st.year + '년 ' + st.month + '월 · ' + esc(sc.name) + '(' + esc(sc.hanja) + ') · ' +
      '내 세력 ' + esc(R.forceName(R.me())) + ' · 성 ' + sm.cities + '/' + Object.keys(st.cities).length +
      ' · 금 ' + C.fmt(sm.gold) + ' (수입 ' + C.fmt(sm.income) + ' · 봉급 ' + C.fmt(sm.upkeep) + ')' +
      ' · 병력 ' + C.fmt(sm.troops) + ' · 무장 ' + sm.officers + ' · 배 ' + sm.ships +
      (st.result
        ? (' · <b style="color:' + (st.result === 'win' ? 'var(--good)' : 'var(--bad)') + '">' +
           (st.result === 'win' ? '👑 승리' : '🏳️ 패배') + '</b>')
        : '');
  }

  function fillScenPick() {
    var scenSel = $('scen'), forceSel = $('meforce');
    if (scenSel.options.length) { return; }     // 한 번만 채운다
    FD.SCENARIOS.forEach(function (sc) {
      var o = el('option');
      o.value = sc.id; o.textContent = sc.year + '년 ' + sc.name + '(' + sc.hanja + ')';
      scenSel.appendChild(o);
    });
    var sync = function () {
      forceSel.innerHTML = '';
      var sc = FD.scenario(scenSel.value);
      sc.forces.forEach(function (f) {
        var o = el('option');
        o.value = f.id; o.textContent = f.name + ' (' + (OFF.find(f.lord) || { name: f.lord }).name + ')';
        forceSel.appendChild(o);
      });
    };
    scenSel.addEventListener('change', sync);
    scenSel.value = '194';
    sync();
  }

  function renderYm() {
    var host = $('ymfields');
    host.innerHTML = '';
    var st = R.state();
    if (!st.started) { return; }
    var f = document.createElement('div');
    var yi = numInput(st.year, 1, function (v) { st.year = Math.max(180, Math.round(v)); });
    var mi = numInput(st.month, 1, function (v) { st.month = C.clamp(Math.round(v), 1, 12); });
    ['연도', '월'].forEach(function (lab, i) {
      var ff = el('div', 'fld');
      ff.appendChild(el('label', null, lab));
      ff.appendChild(i === 0 ? yi : mi);
      host.appendChild(ff);
    });
  }

  function renderRanking() {
    var tbl = $('ranktable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없습니다</td></tr>'; return; }
    var rows = ['<tr><th>순위</th><th>세력</th><th>성</th><th>금</th><th>병력</th><th>무장</th></tr>'];
    R.ranking().forEach(function (s, i) {
      rows.push('<tr><td>' + (i + 1) + (s.id === R.me() ? ' 👑' : '') + '</td><td>' +
        esc(s.name) + '</td><td>' + s.cities + '</td><td>' + C.fmt(s.gold) + '</td><td>' +
        C.fmt(s.troops) + '</td><td>' + s.officers + '</td></tr>');
    });
    tbl.innerHTML = rows.join('');
  }

  /* ── 성(城) 탭 ────────────────────────────────────── */

  function renderCityTable() {
    var tbl = $('citytable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없어 표시할 것이 없습니다 — 세이브 탭에서 먼저 새로 세우세요</td></tr>'; return; }
    var head = '<tr><th>성</th><th>州</th><th>지형</th><th>소속</th><th>병력</th><th>군량</th>' +
      '<th>배</th><th>농업</th><th>상업</th><th>기술</th><th>치안</th><th>훈련</th><th>성벽</th><th></th></tr>';
    var forceIds = Object.keys(st.forces);
    tbl.innerHTML = '';
    tbl.insertAdjacentHTML('beforeend', head);
    CD.CITIES.forEach(function (d) {
      var c = R.city(d.id);
      if (!c) { return; }
      var tr = document.createElement('tr');
      tr.appendChild(td(esc(d.name)));
      tr.appendChild(td(esc(CD.provName(d.prov))));
      tr.appendChild(td(esc(d.land)));

      var sel = el('select');
      forceIds.forEach(function (fid) {
        var o = el('option');
        o.value = fid; o.textContent = R.forceName(fid);
        if (c.force === fid) { o.selected = true; }
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { takeCity(d.id, sel.value); });
      tr.appendChild(td(sel));

      tr.appendChild(td(numInput(c.troops, 100, function (v) { c.troops = Math.max(0, Math.round(v)); })));
      tr.appendChild(td(numInput(c.food, 100, function (v) { c.food = Math.max(0, Math.round(v)); })));
      tr.appendChild(td(numInput(c.ships || 0, 5, function (v) { c.ships = Math.max(0, Math.round(v)); })));
      tr.appendChild(td(numInput(c.agri, 10, function (v) { c.agri = C.clamp(Math.round(v), 0, R.capOf(d.id, 'agri')); })));
      tr.appendChild(td(numInput(c.comm, 10, function (v) { c.comm = C.clamp(Math.round(v), 0, R.capOf(d.id, 'comm')); })));
      tr.appendChild(td(numInput(c.tech, 10, function (v) { c.tech = C.clamp(Math.round(v), 0, R.capOf(d.id, 'tech')); })));
      tr.appendChild(td(numInput(c.sec, 5, function (v) { c.sec = C.clamp(Math.round(v), 0, 100); })));
      tr.appendChild(td(numInput(c.train, 5, function (v) { c.train = C.clamp(Math.round(v), 0, 100); })));
      tr.appendChild(td(numInput(c.wall, 100, function (v) { c.wall = Math.max(0, Math.round(v)); })));

      var fb = document.createElement('div');
      fb.style.display = 'flex'; fb.style.gap = '4px';
      var b1 = el('button', null, '만땅');
      b1.addEventListener('click', function () { maxCity(d.id); commit(); });
      fb.appendChild(b1);
      tr.appendChild(td(fb));

      tbl.appendChild(tr);
    });
  }

  /** 성을 강제로 넘긴다 — war.capture 를 부르지 않고 소속·치안·태수만 흉내낸다 */
  function takeCity(cityId, forceId) {
    var c = R.city(cityId);
    if (!c || c.force === forceId) { return; }
    c.force = forceId;
    c.gov = null;
    c.sec = Math.max(10, Math.round(c.sec * 0.5));
    commit(CD.find(cityId).name + ' 을(를) ' + R.forceName(forceId) + ' 에 넘겼습니다');
  }

  function maxCity(cityId) {
    var c = R.city(cityId);
    if (!c) { return; }
    c.agri = R.capOf(cityId, 'agri');
    c.comm = R.capOf(cityId, 'comm');
    c.tech = R.capOf(cityId, 'tech');
    c.sec = 100; c.train = 100;
    c.wall = c.maxWall;
    if (CD.find(cityId).land === 'river') { c.ships = R.capOf(cityId, 'ships'); }
  }

  /* ── 무장 탭 ──────────────────────────────────────── */

  /** 재야가 아닌, 곧장 등용 성공을 흉내낸다 (tryHire 의 성공 경로와 같다) */
  function forceRecruit(id, cityId, forceId) {
    delete R.state().captives[id];
    var r = OFF.placeAt(id, cityId, forceId);
    r.loyal = OFF.baseLoyal(id, forceId);
    r.found = true;
    r.done = true;
  }

  function forcePromote(id) {
    var g = OFF.grow(id);
    if (g.rank >= H.MAX_RANK) { say('이미 최고 관직입니다'); return; }
    g.rank += 1;
    OFF.addLoyal(id, 12);
  }

  function officerRow(h, showCity) {
    var r = OFF.rec(h.id), s = OFF.stats(h.id), g = OFF.grow(h.id);
    var tr = document.createElement('tr');
    tr.appendChild(td(esc(h.name) + (h.era !== '삼국지' ? ' <span class="chip">' + esc(h.era) + '</span>' : '')));
    if (showCity) { tr.appendChild(td(esc((CD.find(r.city) || {}).name || '?'))); }
    tr.appendChild(td('무 ' + s.might + ' 지 ' + s.wisdom + ' 통 ' + s.command));
    tr.appendChild(td(numInput(g.lv, 1, function (v) { g.lv = C.clamp(Math.round(v), 1, H.MAX_LV); })));
    tr.appendChild(td(esc(OFF.rankName(h.id)) + ' (' + g.rank + '/' + H.MAX_RANK + ')'));
    tr.appendChild(td(numInput(r.loyal, 5, function (v) { r.loyal = C.clamp(Math.round(v), 0, 100); })));
    tr.appendChild(td(numInput(r.feats, 10, function (v) { r.feats = Math.max(0, Math.round(v)); })));
    tr.appendChild(td(r.hurt ? ('🩹 ' + r.hurt + '달') : '성함'));
    var fb = document.createElement('div');
    fb.style.display = 'flex'; fb.style.gap = '4px'; fb.style.flexWrap = 'wrap';
    btn(fb, '승진', null, function () { forcePromote(h.id); commit(h.name + ' → ' + OFF.rankName(h.id)); });
    if (r.hurt) { btn(fb, '부상 해제', null, function () { r.hurt = 0; commit(); }); }
    tr.appendChild(td(fb));
    return tr;
  }

  function renderOfficerTable() {
    var tbl = $('offtable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없습니다</td></tr>'; return; }
    var head = '<tr><th>무장</th><th>능력치</th><th>Lv</th><th>관직</th><th>충성</th><th>공(功)</th><th>부상</th><th></th></tr>';
    tbl.innerHTML = '';
    tbl.insertAdjacentHTML('beforeend', head);
    OFF.ofForce(R.me()).forEach(function (h) { tbl.appendChild(officerRow(h, false)); });
  }

  function renderFreeTable() {
    var tbl = $('freetable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없습니다</td></tr>'; return; }
    var head = '<tr><th>재야</th><th>있는 성</th><th>등급</th><th>찾음?</th><th></th></tr>';
    tbl.innerHTML = '';
    tbl.insertAdjacentHTML('beforeend', head);
    var mine = R.citiesOf(R.me()), any = false;
    mine.forEach(function (cid) {
      OFF.freeAt(cid, false).forEach(function (h) {
        any = true;
        var r = OFF.rec(h.id);
        var tr = document.createElement('tr');
        tr.appendChild(td(esc(h.name)));
        tr.appendChild(td(esc(CD.find(cid).name)));
        tr.appendChild(td('★'.repeat(h.rarity || 1)));
        tr.appendChild(td(r.found ? '<span class="chip on">찾음</span>' : '<span class="chip">숨음</span>'));
        var fb = document.createElement('div');
        fb.style.display = 'flex'; fb.style.gap = '4px';
        if (!r.found) { btn(fb, '찾아낸다', null, function () { r.found = true; commit(); }); }
        btn(fb, '강제 등용', 'go', function () {
          forceRecruit(h.id, cid, R.me());
          commit(h.name + ' 이(가) 합류했습니다');
        });
        tr.appendChild(td(fb));
        tbl.appendChild(tr);
      });
    });
    if (!any) { tbl.appendChild(el('tr', null, '<td colspan="5" style="color:var(--dim)">내 성에 재야가 없습니다</td>')); }
  }

  function renderCapTable() {
    var tbl = $('captable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없습니다</td></tr>'; return; }
    var head = '<tr><th>포로</th><th>갇힌 성</th><th></th></tr>';
    tbl.innerHTML = '';
    tbl.insertAdjacentHTML('beforeend', head);
    var caps = st.captives, any = false, id;
    for (id in caps) {
      if (!Object.prototype.hasOwnProperty.call(caps, id)) { continue; }
      any = true;
      var h = OFF.find(id), cityId = caps[id];
      var tr = document.createElement('tr');
      tr.appendChild(td(esc(h ? h.name : id)));
      tr.appendChild(td(esc((CD.find(cityId) || {}).name || '?')));
      var fb = document.createElement('div');
      fb.style.display = 'flex'; fb.style.gap = '4px';
      btn(fb, '풀어준다', null, function () { return function () {
        delete caps[id]; commit(); };
      }());
      var forceOfCity = (R.city(cityId) || {}).force;
      if (forceOfCity) {
        btn(fb, '내 성이면 강제 등용', 'go', function () { return function () {
          if (forceOfCity !== R.me()) { say('내 성에 갇힌 포로가 아닙니다'); return; }
          forceRecruit(id, cityId, R.me());
          commit();
        }; }());
      }
      tr.appendChild(td(fb));
      tbl.appendChild(tr);
    }
    if (!any) { tbl.appendChild(el('tr', null, '<td colspan="3" style="color:var(--dim)">포로가 없습니다</td>')); }
  }

  /* ── 전쟁 · 외교 탭 ─────────────────────────────────── */

  function renderCampTable() {
    var tbl = $('camptable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없습니다</td></tr>'; return; }
    var head = '<tr><th>세력</th><th>어디서</th><th>어디로</th><th>병력</th><th>치중(달)</th><th>사기</th><th></th></tr>';
    tbl.innerHTML = '';
    tbl.insertAdjacentHTML('beforeend', head);
    var list = WAR.camps();
    if (!list.length) { tbl.appendChild(el('tr', null, '<td colspan="7" style="color:var(--dim)">진영이 없습니다</td>')); return; }
    list.forEach(function (cp) {
      var tr = document.createElement('tr');
      tr.appendChild(td(esc(R.forceName(cp.force))));
      tr.appendChild(td(esc((CD.find(cp.from) || {}).name || cp.from)));
      tr.appendChild(td(esc((CD.find(cp.to) || {}).name || cp.to)));
      tr.appendChild(td(C.fmt(cp.troops)));
      tr.appendChild(td(String(WAR.monthsLeft(cp))));
      tr.appendChild(td((Math.round((cp.morale || 1) * 100)) + '%'));
      var fb = document.createElement('div');
      btn(fb, '철수', 'danger', function () { WAR.withdraw(cp.id); commit('진영을 철수시켰습니다'); });
      tr.appendChild(td(fb));
      tbl.appendChild(tr);
    });
  }

  function fillDiploPick() {
    var a = $('dip-a'), b = $('dip-b');
    if (a.options.length) { return; }
    FD.FORCES.forEach(function (f) {
      [a, b].forEach(function (sel) {
        var o = el('option');
        o.value = f.id; o.textContent = f.name;
        sel.appendChild(o);
      });
    });
    if (FD.FORCES.length > 1) { b.selectedIndex = 1; }
  }

  function renderDiploTable() {
    var tbl = $('diptable'), st = R.state();
    if (!st.started) { tbl.innerHTML = '<tr><td>판이 없습니다</td></tr>'; return; }
    var head = '<tr><th>상대</th><th>우호</th><th>상태</th></tr>';
    tbl.innerHTML = '';
    tbl.insertAdjacentHTML('beforeend', head);
    var me = R.me();
    Object.keys(st.forces).forEach(function (fid) {
      if (fid === me) { return; }
      var tr = document.createElement('tr');
      tr.appendChild(td(esc(R.forceName(fid))));
      tr.appendChild(td(String(DIP.relation(me, fid))));
      var state = DIP.alliedWith(me, fid) ? '<span class="chip on">동맹</span>'
        : (DIP.trucedWith(me, fid) ? '<span class="chip on">화친</span>' : '<span class="chip">보통</span>');
      tr.appendChild(td(state));
      tbl.appendChild(tr);
    });
  }

  /* ── 손잡이 탭 ────────────────────────────────────── */

  var KNOBS = [
    ['rtk.upkeep',        '무장 봉급/달',      12,   1,    '무장 한 사람의 달 봉급(금)'],
    ['rtk.foodPer1000',   '군량 소모/1000명',  10,   1,    '병사 1000명이 한 달에 먹는 군량'],
    ['rtk.goldMul',       '상업 → 금 배수',    0.55, 0.05, '도시 상업치가 이 배수로 금이 된다'],
    ['rtk.foodMul',       '농업 → 군량 배수',  6,    0.5,  '도시 농업치가 이 배수로 군량이 된다(수확 달만)'],
    ['rtk.govCap',        '태수 보정 상한',    0.35, 0.05, '태수의 지력·통솔이 수입에 얹는 최대 배수'],
    ['rtk.disasterChance','달마다 재해 확률',  0.42, 0.05, '넘으면 그 달엔 재해가 없다'],
    ['war.journeyEventChance','원정 중 사건 확률', 0.16, 0.02, '원정군이 가는 길에 매복·보물 등을 만날 확률(도착하는 달은 안 굴린다)'],
    ['rtk.scoutChance',   '세작 소문 확률/달',  0.12, 0.02, '"무장 수집" — 문답 없이도 달마다 이 확률로 재야 하나가 저절로 드러난다'],
    ['rtk.eventChance',   '달마다 사연 확률',   0.18, 0.02, '인물 관계·자리에서 생기는 사연이 세력마다 이 확률로 뜬다(0이면 없다). 한 세력에 동시 체인은 둘까지'],
    ['rtk.agingDeathMul', '노환 사망 확률 배수', 1,    0.1,  '65세 이후 자연사 확률에 곱한다(0이면 안 죽는다). 군주는 아래 손잡이를 켜기 전엔 이 축에서 빠진다'],
    ['rtk.lordAging',     '군주 노쇠·계승(0/1)', 0,  1,    '1 이면 군주도 나이를 먹고(능력 감소) 65세부터 부하의 절반 확률로 별세 → 후계가 즉위한다(PLAN §5-8). 기본 0(끔) — ⚙️ 설정에서도 켠다'],
    ['rtk.victory.hegemony', '패권 승리(0/1)', 1, 1, '관문 성 4곳 이상 + 세력 1위를 24달 이으면 이긴다 — 0 이면 끈다'],
    ['rtk.victory.culture', '문화 승리(0/1)', 1, 1, '문답 정답 200 + 서로 다른 보물 8종 — 0 이면 끈다'],
    ['rtk.victory.diplomacy', '외교 승리(0/1)', 1, 1, '살아 있는 모든 세력과 동맹·화친을 36달 연속 — 0 이면 끈다'],
    ['rtk.victory.survival', '생존 승리(0/1)', 1, 1, '균열의 왕 판 전용 — 240달 버티기. 0 이면 끈다'],
    ['asset3d.asianTower','동양풍 탑(0/1)', 1, 1, '1등급 성채를 CC0 BellStructure.glb로 — 2026-09-10 채택, 기본 켜짐. 0으로 두면 서양풍 Watchtower로 되돌아간다. 새로고침 필요']
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
      i.placeholder = String(k[2]);
      var cur = C.tune()[k[0]];
      i.value = (cur === undefined || cur === null) ? '' : cur;
      i.addEventListener('change', function () {
        C.setTune(k[0], i.value === '' ? null : Number(i.value));
        renderTunePill();
        say(i.value === '' ? (k[1] + ' 을(를) 놓았습니다') : (k[1] + ' = ' + i.value));
      });
      f.appendChild(i);
      f.appendChild(el('span', 'def', '기본 ' + k[2]));
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
        ? (n + '개가 잡혀 있습니다 — 게임 창을 새로고침해야 듣습니다')
        : '전부 코드의 기본값입니다';
    }
  }

  /* ── 프리셋 ───────────────────────────────────────── */

  /** 세력 forceId 에게 아직 아니라면 도시 cityId 를 넘긴다(결정적 — 무작위 없음) */
  function grant(cityId, forceId) {
    var c = R.city(cityId);
    if (!c || c.force === forceId) { return; }
    c.force = forceId; c.gov = null; c.sec = Math.max(10, Math.round(c.sec * 0.5));
  }

  var PRESETS = [
    ['🏁 갓 시작한 판', '194년 군웅할거 · 인형(소패 한 성)',
      function () { R.setup('bei', '194'); }],
    ['⚔️ 관도 직전', '200년 관도 · 패헌 — 고문과 마주 선 판',
      function () { R.setup('cao', '200'); }],
    ['🔥 적벽 — 손유 동맹', '208년 적벽 · 인형 — 시나리오가 스스로 벽해와 동맹을 건다',
      function () { R.setup('bei', '208'); }],
    ['🏰 1위 세력 (12성)', '194년 · 패헌이 등용도 전쟁도 없이 12성을 쥔 판',
      function () {
        R.setup('cao', '194');
        var i = 0;
        for (; i < CD.CITIES.length && R.citiesOf('cao').length < 12; i++) {
          grant(CD.CITIES[i].id, 'cao');
        }
      }],
    ['💀 패배 직전', '194년 · 인형이 소패 한 성만 남고 나머지는 다 패헌 것',
      function () {
        R.setup('bei', '194');
        CD.CITIES.forEach(function (d) { if (d.id !== 'xiaopei') { grant(d.id, 'cao'); } });
      }],
    ['👑 천하통일 직전', '194년 · 인형이 업(鄴) 한 성만 빼고 천하를 다 쥔 판',
      function () {
        R.setup('bei', '194');
        CD.CITIES.forEach(function (d) { if (d.id !== 'ye') { grant(d.id, 'bei'); } });
      }],
    ['💰 재정 · 공적 넉넉', '194년 · 인형 — 금 100만 · 전원 공 900(승진 가능) · 내 성 내정 만땅',
      function () {
        R.setup('bei', '194');
        R.force('bei').gold = 1000000;
        OFF.ofForce('bei').forEach(function (h) { OFF.rec(h.id).feats = 900; });
        R.citiesOf('bei').forEach(function (cid) { maxCity(cid); });
      }],
    ['🕵️ 재야 인재 발견', '194년 · 인형 — 내 성의 재야를 모두 찾아낸 상태로',
      function () {
        R.setup('bei', '194');
        R.citiesOf('bei').forEach(function (cid) {
          OFF.freeAt(cid, false).forEach(function (h) { OFF.rec(h.id).found = true; });
        });
      }],
    ['⛺ 원정 진행 중', '194년 · 인형 — 여남 앞에 우리 진(陣)이 하나 서 있는 판',
      function () {
        R.setup('bei', '194');
        var st = R.state(), off1 = OFF.ofForce('bei')[0];
        st.campSeq = (st.campSeq || 0) + 1;
        var cp = {
          id: 'camp' + st.campSeq, force: 'bei', from: 'xiaopei', to: 'runan',
          troops: 4000, officers: off1 ? [off1.id] : [], train: 50, tech: 100, morale: 0.9,
          water: false, ships: 0, food: 400, months: 1
        };
        st.camps.push(cp);
        cp.officers.forEach(function (id) { OFF.rec(id).camp = cp.id; });
      }],
    /* SAGA-DESIGN §8 QA 프리셋(PLAN §7-2 "QA 프리셋") — 게임을 열자마자 그
       상황이 카메라 앞에 있게 만든다. 다섯 QA 프리셋이 실기 확인 8항목 중
       1(3D 지도)·3(확장 지역)·4(전투 3D)·5(괴물 지역)·6(시장·원정 사건·유물)·
       8(노쇠)을 겨눈다. 2(지도 조작)·7(가명)은 상태를 안 타는 항목이라
       프리셋 없이 아무 판이나 열어서 보면 된다(2026-09-18, 아래 두 프리셋
       추가로 마저 닫음 — HANDOFF.md 참고). */
    ['🌊 해협 접경', '194년 · 인형이 소패 대신 김해·대마도만 쥔 판 — 3D 지도 카메라가 열자마자 해협을 향한다',
      function () {
        R.setup('bei', '194');
        grant('xiaopei', 'cao');
        grant('gimhae', 'bei');
        grant('tsushima', 'bei');
      }],
    ['👹 균열 접경', '194년 · 인형이 소패 대신 야마토만 쥔 판 — 균열 문턱, 균열 9종 몬스터 모델을 눈으로 보러 가는 출발점',
      function () {
        R.setup('bei', '194');
        grant('xiaopei', 'cao');
        grant('yamato', 'bei');
      }],
    ['🤺 일기토 강제', '194년 · 인형 — 우리 으뜸 무장과 무력이 가장 가까운 성으로 원정 중(도착만 하면 확률 35%로 일기토, war.js DUEL_GAP=25)',
      function () {
        R.setup('bei', '194');
        var st = R.state();
        var mine = OFF.ofForce('bei')[0];
        if (!mine) { return; }
        var myMight = OFF.stats(mine.id).might;
        var best = null, bestGap = Infinity;
        CD.CITIES.forEach(function (d) {
          var c = R.city(d.id);
          if (!c || !c.force || c.force === 'bei') { return; }
          var top = OFF.atCity(d.id, c.force)[0];
          if (!top) { return; }
          var gap = Math.abs(OFF.stats(top.id).might - myMight);
          if (gap < bestGap) { bestGap = gap; best = d.id; }
        });
        if (!best) { return; }
        st.campSeq = (st.campSeq || 0) + 1;
        var cp = {
          id: 'camp' + st.campSeq, force: 'bei', from: 'xiaopei', to: best,
          troops: 6000, officers: [mine.id], train: 60, tech: 100, morale: 0.9,
          water: false, ships: 0, food: 500, months: 1
        };
        st.camps.push(cp);
        OFF.rec(mine.id).camp = cp.id;
      }],
    /* 2026-09-18 — §7-1 나머지 중 6(유물 카드·시장·원정 사건)·8(노쇠 문턱)을
       마저 겨눈다. 시장 💰판다·🌾산다 버튼은 위 "재정 · 공적 넉넉" 프리셋의
       금 100만으로 이미 눌러볼 수 있어 새로 안 만들었다. 2(지도 조작)·
       7(가명)은 상태를 안 타는 항목이라 프리셋이 필요 없다 — 아무 판이나
       열어서 손 감각·이름 표기만 보면 된다. */
    ['⏳ 노쇠 · 유물 확인', '208년에서 20년을 더 밀어(228년) 로스터에 60/65/90세 문턱이 고루 걸리게, 새 유물 3종(균열·폐허·묘역)을 장수 셋에게 채워 카드로 보임',
      function () {
        R.setup('bei', '208');
        R.state().year = 228;
        var mine = OFF.ofForce('bei');
        ['itm_timeshard', 'itm_purifier', 'itm_boneseal'].forEach(function (itemId, i) {
          if (mine[i]) { OFF.equip(mine[i].id, itemId); }
        });
      }],
    ['🕰️ 원정 사건 뻥튀기', '194년 · 인형 — 원정 사건 확률을 100%로 올리고 갈 수 있는 가장 먼 성으로 원정을 보낸다. "한 달 진행"을 눌러 시간 뒤틀림·유물 발견 등 6종 사건을 본다(1달짜리 길이 걸리면 사건 없이 바로 도착 — 그땐 다시 눌러 다른 목적지로)',
      function () {
        R.setup('bei', '194');
        C.setTune('war.journeyEventChance', 1);
        var mine = OFF.ofForce('bei');
        if (!mine.length) { return; }
        var farthest = null, bestMonths = 0;
        CD.CITIES.forEach(function (d) {
          var chk = WAR.canJourney('xiaopei', d.id, 2000);
          if (chk.ok && chk.months > bestMonths) { bestMonths = chk.months; farthest = d.id; }
        });
        if (!farthest) { return; }
        WAR.startJourney('xiaopei', farthest, [mine[0].id], 2000);
      }]
  ];

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

  var SNAP = 'saga-realm/admin/snap/';

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

  /* ── 자가점검 ─────────────────────────────────────── */

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

      ok('세이브 키가 폴더 이름이 아니라 saga-realm 이다', C.SAVE_BASE === 'saga-realm/save', C.SAVE_BASE);
      C.save.player.gold = 4321;
      C.persist();
      C.save.player.gold = 0;
      C.load();
      ok('저장한 값이 다시 읽힌다', C.save.player.gold === 4321, '금 ' + C.save.player.gold);

      R.setup('bei', '194');
      ok('새로 세우면 내 세력·성이 생긴다', R.me() === 'bei' && R.citiesOf('bei').length > 0,
        R.citiesOf('bei').length + '성');

      var mine = OFF.ofForce('bei')[0];
      ok('내 세력에 무장이 있다', !!mine, mine && mine.name);
      if (mine) {
        var before = OFF.stats(mine.id).might;
        OFF.grow(mine.id).lv = 20;
        ok('레벨이 오르면 능력치가 오른다', OFF.stats(mine.id).might > before,
          before + ' → ' + OFF.stats(mine.id).might);

        var rankBefore = OFF.grow(mine.id).rank;
        forcePromote(mine.id);
        ok('강제 승진이 관직을 올린다', OFF.grow(mine.id).rank === rankBefore + 1);
      }

      var beforeCity = R.city('ye').force;
      takeCity('ye', 'bei');
      ok('성 소속을 강제로 넘길 수 있다', R.city('ye').force === 'bei', beforeCity + ' → bei');

      var relBefore = DIP.relation('bei', 'cao');
      DIP.setPact('bei', 'cao', 'ally', 18);
      ok('외교는 diplo.setPact 로 맺는다', DIP.alliedWith('bei', 'cao'), '우호 ' + relBefore + ' → 동맹');

      /* 프리셋 전부를 임시 프로필에서 실제로 눌러 본다 */
      var presetErr = '';
      for (var pi = 0; pi < PRESETS.length && !presetErr; pi++) {
        try { PRESETS[pi][2](); } catch (pe) { presetErr = PRESETS[pi][0] + ' — ' + pe.message; }
      }
      ok('프리셋 ' + PRESETS.length + '개가 예외 없이 돈다', !presetErr, presetErr);

      var beforeTune = C.tuned('rtk.upkeep', 12);
      C.setTune('rtk.upkeep', 99);
      ok('손잡이를 잡으면 그 값이 나온다', C.tuned('rtk.upkeep', 12) === 99, String(C.tuned('rtk.upkeep', 12)));
      C.setTune('rtk.upkeep', beforeTune === 12 ? null : beforeTune);
      ok('손잡이를 놓으면 기본값으로 돌아온다', C.tuned('rtk.upkeep', 12) === 12);

      ok('어드민은 게임 창을 두드릴 자리를 안다',
        typeof C.POKE_KEY === 'string' && C.POKE_KEY.indexOf('saga-realm') === 0, C.POKE_KEY);
    } catch (e) {
      out.push('<span style="color:var(--bad)">✘</span> 점검 중에 멈췄습니다 — ' + esc(e.message));
    }
    try { localStorage.removeItem(tmp); } catch (e) { /* 무시 */ }
    C.setSaveKey(keep);
    C.load();
    renderAll();

    var bad = out.filter(function (s) { return s.indexOf('✘') >= 0; }).length;
    out.push('<b>' + (out.length - bad) + '/' + out.length + '</b>');
    $('selfout').innerHTML = out.join('<br>');
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

  /* ── 그리기 ───────────────────────────────────────── */

  function renderAll() {
    renderSummary();
    renderYm();
    renderRanking();
    renderCityTable();
    renderOfficerTable();
    renderFreeTable();
    renderCapTable();
    renderCampTable();
    renderDiploTable();
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

    $('setup-go').addEventListener('click', function () {
      if (!confirm('정말 이 프로필의 삼국지 판을 새로 세울까요? 지금 진행이 초기 배치로 되돌아갑니다.')) { return; }
      R.setup($('meforce').value, $('scen').value);
      commit('새로 세웠습니다 — ' + $('scen').value + '년');
    });

    $('result-clear').addEventListener('click', function () {
      if (R.state().started) { R.state().result = null; }
      commit('승패를 되돌렸습니다');
    });
    $('month-end').addEventListener('click', function () {
      if (!R.state().started) { say('판이 없습니다'); return; }
      R.endMonth();
      commit('한 달이 지났습니다 — ' + R.state().year + '년 ' + R.state().month + '월');
    });
    $('months-12').addEventListener('click', function () {
      if (!R.state().started) { say('판이 없습니다'); return; }
      for (var i = 0; i < 12 && !R.state().result; i++) { R.endMonth(); }
      commit('12달을 진행했습니다 — ' + R.state().year + '년 ' + R.state().month + '월');
    });

    Array.prototype.forEach.call(document.querySelectorAll('button[data-clear]'), function (b) {
      b.addEventListener('click', function () {
        var what = b.getAttribute('data-clear');
        if (what === 'quiz') { C.save.quiz = { learned: {}, wrongs: {}, total: 0, correct: 0, streak: 0, bestStreak: 0 }; }
        if (what === 'log') { C.save.log = []; }
        if (what === 'all') {
          if (!confirm('정말 이 프로필의 진행을 통째로 지울까요?')) { return; }
          C.reset();
          C.load();
        }
        commit('비웠습니다 — ' + what);
      });
    });

    $('city-capall').addEventListener('click', function () {
      if (!R.state().started) { say('판이 없습니다'); return; }
      R.citiesOf(R.me()).forEach(maxCity);
      commit('내 성 내정을 만땅으로 채웠습니다');
    });
    $('city-secall').addEventListener('click', function () {
      if (!R.state().started) { say('판이 없습니다'); return; }
      R.citiesOf(R.me()).forEach(function (cid) { var c = R.city(cid); c.sec = 100; c.train = 100; });
      commit('내 성 치안·훈련을 100으로 채웠습니다');
    });

    $('off-loyalmax').addEventListener('click', function () {
      OFF.ofForce(R.me()).forEach(function (h) { OFF.rec(h.id).loyal = 100; });
      commit('전원 충성 100');
    });
    $('off-featmax').addEventListener('click', function () {
      OFF.ofForce(R.me()).forEach(function (h) { OFF.rec(h.id).feats = 900; });
      commit('전원 공(功) 900');
    });
    $('off-healall').addEventListener('click', function () {
      OFF.ofForce(R.me()).forEach(function (h) { OFF.rec(h.id).hurt = 0; });
      commit('전원 부상 해제');
    });

    $('dip-set').addEventListener('click', function () {
      var a = $('dip-a').value, b = $('dip-b').value, kind = $('dip-kind').value;
      if (a === b) { say('같은 세력입니다'); return; }
      DIP.setPact(a, b, kind, kind === 'ally' ? 18 : 8);
      commit(R.forceName(a) + ' - ' + R.forceName(b) + ' ' + (kind === 'ally' ? '동맹' : '화친'));
    });
    $('dip-rel100').addEventListener('click', function () {
      var a = $('dip-a').value, b = $('dip-b').value;
      DIP.addRelation(a, b, 100 - DIP.relation(a, b));
      commit('우호 100');
    });

    $('tune-clear').addEventListener('click', function () {
      C.clearTune();
      renderTune();
      renderTunePill();
      say('손잡이를 다 놓았습니다 — 게임 창을 새로고침하세요');
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
  fillScenPick();
  fillDiploPick();
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
    takeCity: takeCity, maxCity: maxCity, forceRecruit: forceRecruit, forcePromote: forcePromote,
    selftest: selftest
  };

})(window);
