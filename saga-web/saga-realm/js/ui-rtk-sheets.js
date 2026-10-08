/**
 * 사가천하 — 시트 화면(성·진영·무장·외교·학당·기록) · ui-rtk.js 에서 떼어 냄(R-4 2026-10-08)
 * ---------------------------------------------------------------
 * 몸통은 ui-rtk.js 에 있던 글자 그대로다. 바깥 것은 make(U) 로 받는다 —
 *   U.esc·pt·ptBig·ico·forceColor·bar·DEBATE_TIP  그림·글 도우미(ui-rtk 것 그대로)
 *   U.now()  지금 고른 성(openCityId)·고른 명령(pickOrder)·문답(quizCur) — 시트는 **읽기만** 한다
 * 보기 함수마다 들어올 때 now() 로 셋을 맞춘 뒤 옛 몸통을 그대로 부른다.
 * 반드시 ui-rtk.js **앞에** 싣는다(ui-rtk 가 실릴 때 make 를 부른다).
 */
(function (global) {
  'use strict';

  global.DG = global.DG || {};
  global.DG.rtkSheets = { make: function (U) {

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var ID = global.DG.item;
  function R() { return global.DG.rtk; }
  function off() { return global.DG.off; }
  var esc = U.esc, pt = U.pt, ptBig = U.ptBig, ico = U.ico, forceColor = U.forceColor, bar = U.bar, DEBATE_TIP = U.DEBATE_TIP;
  var openCityId = null, pickOrder = null, quizCur = null;
  function sync() { var n = U.now(); openCityId = n.openCityId; pickOrder = n.pickOrder; quizCur = n.quizCur; }
  function wrap(fn) { return function () { sync(); return fn.apply(null, arguments); }; }

  /* ── 성 ───────────────────────────────────────────────── */


  function viewCity() {
    if (!openCityId) {
      return '<div class="hint">지도에서 성을 누르십시오.</div>';
    }
    var d = CD.find(openCityId), c = R().city(openCityId);
    var land = CD.landOf(openCityId);
    var mine = c.force === R().me();
    var html = '';

    html += '<div class="sec"><div class="card">' +
      '<div class="stat-row"><span><b>' + esc(d.name) + '</b> <span class="muted">' +
        esc(d.hanja) + ' · ' + esc(CD.provName(d.prov)) + ' · ' + land.name + '</span></span>' +
        '<span class="tag" style="background:' + forceColor(c.force) + '33;border-color:' +
        forceColor(c.force) + '">' + esc(R().forceName(c.force)) + '</span></div>' +
      '<small class="muted">' + esc(d.desc) + '</small>' +
      (c.disaster
        ? '<div class="warn">' + R().disasterByKey(c.disaster).emoji + ' ' +
          esc(R().disasterByKey(c.disaster).text) + ' <span class="muted">(' + c.dLeft + '개월)</span></div>'
        : '') +
      '</div></div>';

    html += '<div class="sec"><h4>살림</h4><div class="card">' +
      bar('🌾 농업', c.agri, R().capOf(openCityId, 'agri')) +
      bar('🏪 상업', c.comm, R().capOf(openCityId, 'comm')) +
      bar('🔨 기술', c.tech, 900) +
      bar('🪧 치안', c.sec, 100) +
      bar('🎯 훈련', c.train, 100) +
      bar('🧱 성벽', c.wall, c.maxWall) +
      '<div class="stat-row"><span>👥 인구</span><b>' + core.fmt(c.pop) + '</b></div>' +
      '<div class="stat-row"><span>🪖 병력</span><b>' + core.fmt(c.troops) + '</b></div>' +
      '<div class="stat-row"><span>🍚 군량</span><b>' + core.fmt(c.food) +
        ' <span class="muted">(월 ' + core.fmt(R().eatOf(openCityId)) + ' 소모)</span></b></div>' +
      (d.land === 'river'
        ? '<div class="stat-row"><span>🛶 배</span><b>' + core.fmt(c.ships || 0) +
          '척 <span class="muted">(' + core.fmt((c.ships || 0) * global.DG.war.SHIP_CREW) +
          '명까지 실린다)</span></b></div>'
        : '') +
      (mine
        ? '<div class="stat-row"><span>🪙 이 성의 달 수입</span><b>' +
          core.fmt(R().goldOf(openCityId)) + '</b></div>'
        : '') +
      '</div></div>';

    return html + (mine ? myCity(c, d) : enemyCity(c, d));
  }

  function myCity(c, d) {
    var html = '';
    var ready = R().readyAt(openCityId);
    var here = off().atCity(openCityId, c.force);

    /* 태수 */
    var gov = c.gov ? off().find(c.gov) : null;
    html += '<div class="sec"><h4>태수</h4><div class="card">' +
      '<div class="stat-row"><span>지금</span><b>' + (gov ? esc(gov.name) : '비어 있음') +
        '</b> <span class="muted">×' + R().govMul(openCityId).toFixed(2) + '</span></div>' +
      '<small class="muted">태수의 <b>지력·통솔</b>이 수입과 수확에 곱해집니다. ' +
      '비어 있으면 계략에 훤히 열립니다.</small><div class="bagtools">';
    for (var i = 0; i < Math.min(5, here.length); i++) {
      html += '<button class="btn tiny' + (c.gov === here[i].id ? ' primary' : '') +
        '" data-act="set-gov" data-id="' + here[i].id + '">' + esc(here[i].name) + '</button>';
    }
    html += '</div></div></div>';

    /* 시장 — 금↔군량 환전(명령이 아니다, 몇 번이든 쓸 수 있다) */
    var rate = R().marketRate(openCityId);
    html += '<div class="sec"><h4>시장 <span class="muted">환율 🍚1 = 🪙' + rate.toFixed(2) +
      ' (상업이 클수록 후해진다)</span></h4><div class="card">' +
      '<div class="bagtools">' +
      '<button class="btn tiny" data-act="trade" data-dir="sell">💰 군량을 판다</button>' +
      '<button class="btn tiny" data-act="trade" data-dir="buy">🌾 군량을 산다</button>' +
      '</div></div></div>';

    /* 명령 */
    html += '<div class="sec"><h4>명령 <span class="muted">이 달에 쓸 수 있는 장수 ' +
      ready.length + '명</span></h4>';
    if (!ready.length) {
      html += '<div class="hint">이 성의 장수가 이 달의 명령을 다 썼습니다. ' +
        '<b>다음 달</b>로 넘기십시오.</div>';
    } else if (!pickOrder) {
      html += '<div class="ordgrid">';
      for (var j = 0; j < R().ORDERS.length; j++) {
        var o = R().ORDERS[j];
        var afford = R().force(c.force).gold >= o.gold;
        /* 조선(造船)은 강을 낀 성에서만 — 아닌 성에서는 아예 못 고르게 둔다 */
        var dry = o.key === 'ships' && d.land !== 'river';
        html += '<button class="ordbtn' + (afford && !dry ? '' : ' poor') +
          (dry ? ' disabled" disabled' : '"') + ' data-act="sel-order" data-key="' +
          o.key + '" title="' + esc(dry ? '물길이 없는 성입니다' : o.desc) +
          '"><span>' + o.emoji + '</span><b>' + o.name +
          '</b><small>' + (dry ? '물길 없음' : '🪙' + o.gold) + '</small></button>';
      }
      html += '</div><small class="muted">명령을 고르면 <b>그 일에 맞는 사람</b> 순으로 뜹니다.</small>';
    } else {
      var od = R().orderByKey(pickOrder);
      var sorted = ready.slice().sort(function (a, b) {
        return off().stats(b.id)[od.stat] - off().stats(a.id)[od.stat];
      });
      html += '<div class="card"><div class="stat-row"><span>' + od.emoji + ' <b>' +
        od.name + '</b> <span class="muted">' + off().STAT_KOR[od.stat] + '을(를) 본다</span></span>' +
        '<button class="btn tiny ghost" data-act="sel-order" data-key="">그만</button></div>' +
        '<small class="muted">' + esc(od.desc) + '</small></div>';
      for (var k = 0; k < sorted.length; k++) {
        var s = off().stats(sorted[k].id);
        var gain = pickOrder === 'search' || pickOrder === 'hire' ? null
          : Math.round(od.base + s[od.stat] * od.per);
        html += '<button class="offrow" data-act="do-order" data-id="' + sorted[k].id + '">' +
          pt(sorted[k], 36) + '<span class="offname">' + esc(sorted[k].name) +
          '<small class="muted">' + off().STAT_KOR[od.stat] + ' ' + s[od.stat] +
          ' · 충성 ' + off().loyalOf(sorted[k].id) + ' · ' + traitEmoji(sorted[k].id) + '</small></span>' +
          '<b>' + (gain === null ? '—' : '+' + core.fmt(gain)) + '</b></button>';
      }
    }
    html += '</div>';

    /* 이 성에서 찾아낸 재야 · 포로 */
    var freeHere = off().freeAt(openCityId, true);
    var capHere = [];
    var st = R().state();
    for (var ck in st.captives) {
      if (Object.prototype.hasOwnProperty.call(st.captives, ck) && st.captives[ck] === openCityId) {
        var ch = off().find(ck);
        if (ch) { capHere.push(ch); }
      }
    }
    if (freeHere.length || capHere.length) {
      html += '<div class="sec"><h4>부를 수 있는 사람</h4>';
      var caller = ready.length ? ready[0] : null;
      var pool = freeHere.concat(capHere);
      for (var m = 0; m < pool.length; m++) {
        var isCap = capHere.indexOf(pool[m]) >= 0;
        var ps = off().stats(pool[m].id);
        html += '<div class="offrow">' + pt(pool[m], 36) +
          '<span class="offname">' + esc(pool[m].name) +
          (isCap ? ' <span class="tag">포로</span>' : ' <span class="muted">재야</span>') +
          '<small class="muted">무 ' + ps.might + ' 지 ' + ps.wisdom + ' 통 ' + ps.command + ' · ' + traitEmoji(pool[m].id) + ' ' +
            traitNames(pool[m].id) + '</small></span>' +
          (caller
            ? '<button class="btn tiny primary" data-act="hire-one" data-by="' + caller.id +
              '" data-id="' + pool[m].id + '" title="' + DEBATE_TIP + '">🗣️ 등용</button>'
            : '<span class="muted">쓸 장수 없음</span>') +
          '</div>';
      }
      html += '</div>';
    }

    /* 이웃 */
    html += '<div class="sec"><h4>이웃한 성</h4>';
    for (var n = 0; n < d.adj.length; n++) {
      var nid = d.adj[n], nc = R().city(nid), nd = CD.find(nid);
      var ours = nc.force === c.force;
      html += '<div class="card"><div class="stat-row">' +
        '<span><b class="lnk" data-act="open-city" data-city="' + nid + '">' + esc(nd.name) + '</b> ' +
          '<span class="muted">' + esc(R().forceName(nc.force)) + '</span></span>' +
        '<span class="muted">🪖 ' + core.fmt(nc.troops) + ' · 🧱 ' + core.fmt(nc.wall) + '</span></div>' +
        (ours
          ? '<button class="btn tiny wide" data-act="send-troops" data-to="' + nid + '">🚚 병력을 보낸다</button>'
          : '<button class="btn tiny wide primary" data-act="march" data-from="' + openCityId +
            '" data-to="' + nid + '">⚔️ 출진</button>') +
        '</div>';
    }
    html += '</div>';

    /* 원정 — 인접하지 않은 먼 성. 내 땅·주인 없는 땅만 거쳐 가는 실제 경로가
       있는 곳만 고른다(2026-09-04, 출진의 "그 자리에서 인접" 한계를 벗어나는
       새 상위 명령) */
    var passable = function (cid) {
      var pc = R().city(cid);
      return !!pc && (pc.force === c.force || pc.force === null);
    };
    var farHtml = '';
    for (var f = 0; f < CD.CITIES.length; f++) {
      var fd = CD.CITIES[f];
      if (fd.id === openCityId || d.adj.indexOf(fd.id) >= 0) { continue; }
      var fc = R().city(fd.id);
      if (fc.force === c.force) { continue; }
      var p = CD.path(openCityId, fd.id, passable);
      if (!p) { continue; }
      farHtml += '<div class="card"><div class="stat-row">' +
        '<span><b class="lnk" data-act="open-city" data-city="' + fd.id + '">' + esc(fd.name) +
        '</b> <span class="muted">' + esc(R().forceName(fc.force)) + ' · ' + CD.pathMonths(p) + '달</span></span>' +
        '<span class="muted">🪖 ' + core.fmt(fc.troops) + '</span></div>' +
        '<button class="btn tiny wide" data-act="journey" data-from="' + openCityId +
        '" data-to="' + fd.id + '">🚩 원정</button></div>';
    }
    if (farHtml) {
      html += '<div class="sec"><h4>원정 <span class="muted">내 땅·빈 땅만 거쳐 여러 달에 걸쳐 옮깁니다</span></h4>' +
        farHtml + '</div>';
    }
    return html;
  }

  function enemyCity(c, d) {
    var html = '<div class="sec"><h4>여기서 할 수 있는 것</h4>';
    var D = global.DG.diplo;
    if (!D.touching(R().me(), openCityId)) {
      return html + '<div class="hint">우리 성과 맞닿아 있지 않습니다 — 손이 닿지 않습니다.</div></div>';
    }
    /* 계략을 걸 사람 — 맞닿은 우리 성에서 지력이 가장 높은, 아직 안 쓴 사람 */
    var by = null, bv = -1, i, j;
    for (i = 0; i < d.adj.length; i++) {
      if (!R().isMine(d.adj[i])) { continue; }
      var ready = R().readyAt(d.adj[i]);
      for (j = 0; j < ready.length; j++) {
        var w = off().stats(ready[j].id).wisdom;
        if (w > bv) { bv = w; by = ready[j]; }
      }
    }
    if (!by) {
      html += '<div class="hint">계략을 걸 장수가 없습니다 (이웃한 우리 성의 장수가 다 명령을 썼습니다).</div>';
    } else {
      html += '<div class="card"><div class="stat-row"><span>거는 사람</span><b>' +
        esc(by.name) + ' <span class="muted">지력 ' + bv + '</span></b></div>' +
        '<small class="muted">계략은 그 성의 <b>태수 지력</b>이 막습니다. ' +
        '성공률을 숨기지 않습니다 — 보고 거십시오.</small></div>';
      for (i = 0; i < D.PLOTS.length; i++) {
        var p = D.PLOTS[i];
        var ch = D.plotChance(p.key, by.id, openCityId, null);
        var afford = R().myForce().gold >= p.gold;
        html += '<div class="card"><div class="stat-row"><span>' + p.emoji + ' <b>' +
          p.name + '</b></span><span class="muted">🪙 ' + p.gold + ' · ' +
          Math.round(ch * 100) + '%</span></div>' +
          '<small class="muted">' + esc(p.desc) + '</small>' +
          '<button class="btn tiny wide' + (afford ? ' primary' : '') + '"' +
          (afford ? '' : ' disabled') + ' data-act="plot" data-kind="' + p.key +
          '" data-by="' + by.id + '">건다</button></div>';
      }
    }
    /* 출진 — 맞닿은 우리 성에서 */
    html += '</div><div class="sec"><h4>출진</h4>';
    for (i = 0; i < d.adj.length; i++) {
      if (!R().isMine(d.adj[i])) { continue; }
      var fc = R().city(d.adj[i]);
      var wet = CD.isWater(d.adj[i], openCityId);
      var cap = (fc.ships || 0) * global.DG.war.SHIP_CREW;
      html += '<div class="card"><div class="stat-row"><span><b>' + esc(CD.find(d.adj[i]).name) +
        '</b>에서</span><span class="muted">🪖 ' + core.fmt(fc.troops) + '</span></div>' +
        (wet
          ? '<small class="muted">🌊 <b>물길</b>입니다 — 배로만 건넙니다. ' +
            '🛶 ' + core.fmt(fc.ships || 0) + '척 · ' + core.fmt(cap) + '명까지. ' +
            '수전은 <b>성벽이 소용없고</b> 화공이 터집니다.</small>'
          : '') +
        '<button class="btn tiny wide' + (wet && cap < 500 ? '' : ' primary') +
        '" data-act="march" data-from="' + d.adj[i] +
        '" data-to="' + openCityId + '">' + (wet ? '🌊 물길로 친다' : '⚔️ 친다') +
        '</button></div>';
    }
    return html + '</div>';
  }

  /* ── 진영 (여러 달에 걸치는 원정) ─────────────────────── */

  function viewCamp() {
    var W = global.DG.war;
    var camps = W.campsOf(R().me());
    var jn = W.journeysOf(R().me());
    var html = '';

    if (!camps.length) {
      html += '<div class="hint">나가 있는 진(陣)이 없습니다.<br><br>' +
        '남의 성을 눌러 <b>친다</b> 를 고르면, 그 달에 못 떨어뜨린 군대는 ' +
        '물러나지 않고 성 밖에 <b>진(陣)</b> 을 칩니다. 진은 달마다 한 번씩 더 치고, ' +
        '<b>치중이 바닥나거나 사기가 꺾이면 스스로 물러납니다</b>.</div>';
    } else {
      html += '<div class="sec"><h4>나가 있는 진(陣) <span class="muted">' + camps.length + '</span></h4>' +
        '<small class="muted">출진할 때 들고 나가는 군량은 <b>두 달치</b>입니다. ' +
        '그보다 길게 에워싸려면 맞닿은 우리 성에서 <b>보급</b>해야 합니다. ' +
        '에워싸인 성은 그동안 <b>수확을 거두지 못합니다</b>.</small></div>';
      for (var i = 0; i < camps.length; i++) { html += campCard(camps[i]); }
    }

    if (jn.length) {
      html += '<div class="sec"><h4>가고 있는 원정 <span class="muted">' + jn.length + '</span></h4>' +
        '<small class="muted">내 땅·주인 없는 땅만 거쳐 먼 성까지 실시간으로 옮겨 가는 중입니다. ' +
        '국경(경로의 마지막 성)에 닿으면 그 자리에서 자동으로 붙습니다.</small></div>';
      for (var j = 0; j < jn.length; j++) { html += journeyCard(jn[j]); }
    }
    return html;
  }

  /** 가고 있는 원정 한 줄 — 진행률만 보여준다(v1엔 회군 명령이 없다) */
  function journeyCard(j) {
    var d = CD.find(j.to);
    var pct = Math.round(core.clamp(j.monthsElapsed / j.monthsTotal, 0, 1) * 100);
    var names = j.officers.map(function (id) {
      var h = off().find(id);
      return h ? esc(h.name) : id;
    }).join(' · ');
    return '<div class="card">' +
      '<div class="stat-row"><span>🚩 <b>' + esc(d.name) + '</b> 을(를) 향해</span>' +
      '<span class="muted">' + j.monthsElapsed + ' / ' + j.monthsTotal + '달</span></div>' +
      '<div class="bar sm"><i style="width:' + pct + '%"></i></div>' +
      '<div class="stat-row"><span class="muted">병력</span><b>🪖 ' + core.fmt(j.troops) + '</b></div>' +
      (j.lastEvent
        ? '<div class="warn">' + j.lastEvent.emoji + ' ' + esc(j.lastEvent.text) + '</div>'
        : '') +
      '<small class="muted">장수 — ' + names + '</small></div>';
  }

  function campCard(cp) {
    var W = global.DG.war;
    var d = CD.find(cp.to), to = R().city(cp.to);
    var left = W.monthsLeft(cp);
    var home = R().city(cp.from);
    var canFeed = !!home && home.force === R().me();
    var names = cp.officers.map(function (id) {
      var h = off().find(id);
      return h ? esc(h.name) : id;
    }).join(' · ');

    var html = '<div class="card">' +
      '<div class="stat-row"><span>' + (cp.water ? '⛵' : '🏕️') + ' <b>' + esc(d.name) +
      '</b> 을(를) 에워쌌다' + (cp.water ? ' <span class="tag">수채</span>' : '') + '</span>' +
      '<span class="muted">' + cp.months + '달째</span></div>' +
      '<div class="stat-row"><span class="muted">우리 군</span><b>🪖 ' + core.fmt(cp.troops) +
      ' · 🌾 ' + core.fmt(cp.food) + ' <span class="muted">(' + left + '달치)</span></b></div>' +
      (cp.water
        ? '<div class="stat-row"><span class="muted">배</span><b>🛶 ' + core.fmt(cp.ships || 0) +
          '척 <span class="muted">(' +
          core.fmt(Math.max(0, (cp.ships || 0) * global.DG.war.SHIP_CREW - cp.troops)) +
          '명 더 탄다)</span></b></div>'
        : '') +
      '<div class="stat-row"><span class="muted">사기 · 훈련</span><b>' +
      Math.round(cp.morale * 100) + ' · ' + cp.train + '</b></div>' +
      '<div class="stat-row"><span class="muted">성 안</span><b>🪖 ' + core.fmt(to.troops) +
      ' · 🧱 ' + core.fmt(to.wall) + '</b></div>' +
      '<small class="muted">장수 — ' + names + '</small>';

    if (canFeed) {
      html += '<div class="camp-acts">' +
        '<button class="btn tiny" data-act="camp-food" data-id="' + cp.id + '">🌾 보급</button>' +
        '<button class="btn tiny" data-act="camp-men" data-id="' + cp.id + '">🪖 증원</button></div>' +
        '<small class="muted">' + esc(CD.find(cp.from).name) + '에서 보냅니다 — 🪖 ' +
        core.fmt(home.troops) + ' · 🌾 ' + core.fmt(home.food) + '</small>';
    } else {
      html += '<div class="hint" style="margin-top:8px">보급할 성이 없습니다 — ' +
        esc(CD.find(cp.from).name) + ' 이(가) 우리 손을 떠났습니다.</div>';
    }
    return html + '<button class="btn tiny wide" data-act="camp-quit" data-id="' + cp.id +
      '">↩️ 포위를 푼다</button></div>';
  }

  /* ── 무장 ─────────────────────────────────────────────── */

  function viewOfficers() {
    var list = off().ofForce(R().me());
    var html = '<div class="sec"><h4>우리 무장 <span class="muted">' + list.length + '명</span></h4>' +
      '<small class="muted">충성이 <b>바닥</b>나면 스스로 떠납니다. 금을 내려 붙듭니다.<br>' +
      '일을 시키면 <b>경험</b>이 붙어 능력치가 오르고, 쌓인 <b>공</b>으로 <b>승진</b>시키면 ' +
      '능력치와 충성이 함께 오릅니다.</small></div>';
    var byCity = {};
    for (var i = 0; i < list.length; i++) {
      var r = off().rec(list[i].id);
      (byCity[r.city] = byCity[r.city] || []).push(list[i]);
    }
    var keys = Object.keys(byCity);
    for (var k = 0; k < keys.length; k++) {
      html += '<div class="sec"><h4>' + esc(CD.find(keys[k]).name) + '</h4>';
      for (var j = 0; j < byCity[keys[k]].length; j++) {
        html += officerCard(byCity[keys[k]][j], keys[k]);
      }
      html += '</div>';
    }
    return html + (global.DG.tacticsView ? global.DG.tacticsView.annalsHtml(pt) : '');   // 열전(W-0108)
  }

  /** 지니고 있는 보물 한 줄 — 없으면 빈 문자열(2026-09-09, data-item.js) */
  function itemBadge(itemId) {
    if (!itemId || !ID) { return ''; }
    var it = ID.itemById(itemId);
    if (!it) { return ''; }
    var gr = ID.gradeOf ? ID.gradeOf(it) : null;
    return '<div class="stat-row"><span class="muted">보물</span><b>' + ico('equip', it.id, 22, it.emoji) + ' ' +
      esc(it.name) + (gr && gr.name ? ' <small style="color:' + gr.color + '">' + esc(gr.name) + '</small>' : '') +
      ' <span class="muted">(' + (off().STAT_KOR[it.stat] || it.stat) +
      ' +' + it.bonus + ')</span></b></div>';
  }

  /** 명마 한 줄 + 바꾸기 단추(mount.js) — 우리 세력 장수만. 말이 하나도 안 열렸으면 감춘다 */
  function mountRow(id, mine) {
    var M = global.DG.mount;
    if (!M || !M.on() || !mine) { return ''; }
    var cur = M.mountOf(id), can = M.freeFor(id).length > 0;
    if (!cur && !can) { return ''; }
    return '<div class="stat-row"><span class="muted">명마</span><b>' +
      (cur ? cur.emoji + ' ' + esc(cur.name) + ' <span class="muted">(땅 싸움 부대 힘 ×' + cur.mul + ')</span>' : '<span class="muted">없음</span>') +
      ' <button class="btn tiny" data-act="mount-eq" data-id="' + id + '">🐎 ' + (cur ? '바꾸기' : '태우기') + '</button></b></div>';
  }

  /** 특성 배지 둘(PLAN §5-1) — 이모지 + 이름, 설명은 title */
  function traitTags(id) {
    return off().traitsOf(id).map(function (t) {
      return '<span class="tag trait" title="' + esc(t.desc) + '">' + t.emoji + ' ' + t.name + '</span>';
    }).join(' ');
  }
  function traitEmoji(id) { return off().traitsOf(id).map(function (t) { return t.emoji; }).join(''); }
  function traitNames(id) { return off().traitsOf(id).map(function (t) { return t.name; }).join('·'); }

  /** 야망 한 줄 + 진행 막대. 이루면 ✓, 좌절이면 경고 문구 */
  function ambRow(id) {
    var v = off().ambView(id);
    if (!v) { return ''; }
    var pct = v.done ? 100 : Math.round(100 * v.prog / v.need);
    return '<div class="rstat amb' + (v.frustrated ? ' frus' : '') + '"><span>' + v.emoji + ' 야망 ' + esc(v.name) + '</span>' +
      '<div class="bar sm gold"><i style="width:' + pct + '%"></i></div><b>' + (v.done ? '✓' : v.prog + '/' + v.need) + '</b></div>' +
      '<small class="muted">' + esc(v.text) + (v.done ? ' — 이루었다' : '') + (v.frustrated ? ' — 좌절해 충성이 깎입니다' : '') + '</small>';
  }

  /** 무장 한 장 — 능력치 · 충성 · 열전. 도감 상세를 여기로 옮겼다 */
  function officerCard(h, cityId) {
    var s = off().stats(h.id);
    var r = off().rec(h.id);
    var g = global.DG.hero.info(h.id);
    var isLord = off().lordOf(r.force) === h.id;
    var mine = r.force === R().state().me;
    var bio = global.DG.data.bio ? global.DG.data.bio(h.id) : '';
    var c = R().city(cityId);
    return '<div class="card offcard">' +
      '<div class="dt-top">' + ptBig(h) +
        '<div class="dt-name"><b>' + esc(h.name) + '</b> <span class="muted">' +
          esc(h.hanja || '') + ' · ' + off().age(h.id) + '세</span>' +
          (isLord ? ' <span class="tag">군주</span>' : '') +
          (mine && !isLord && off().lordAgingOn() && off().heirOf(r.force) === h.id ? ' <span class="tag">후계</span>' : '') +
          (c && c.gov === h.id ? ' <span class="tag">태수</span>' : '') +
          /* 균열·폐허(2026-09-10·11 확장) 수비 무장은 사람이 아니다 —
             등용해서 데려온 뒤에도 이름·초상만 보고는 "괴물"임을 놓치기
             쉬워 배지 하나를 더한다. `h.monster`(asset3d.js `heroRecipe()`
             가 읽는 그 필드) 유무만 본다 — 새 판정 없이 이미 있는 값 */
          (h.monster ? ' <span class="tag">괴물</span>' : '') +
          (off().age(h.id) > 60 ? ' <span class="tag warnt">노쇠</span>' : '') +
          (r.hurt ? ' <span class="tag warnt">부상 ' + r.hurt + '개월</span>' : '') +
          (r.done ? ' <span class="muted">· 이 달 명령 씀</span>' : '') +
          (r.camp ? ' <span class="tag">진 치는 중</span>' : '') +
          (r.journey ? ' <span class="tag">원정 중</span>' : '') +
        '<div class="dt-stats"><span>무 <b>' + s.might + '</b></span>' +
          '<span>지 <b>' + s.wisdom + '</b></span>' +
          '<span>통 <b>' + s.command + '</b></span>' +
          '<span class="muted">Lv.' + g.lv + '</span></div>' +
        '</div></div>' +
      '<div class="traits">' + traitTags(h.id) + '</div>' +
      (itemBadge(r.item)) +
      mountRow(h.id, mine) +
      '<div class="rstat"><span>충성</span><div class="bar sm' +
        (r.loyal < 25 ? ' bad' : '') + '"><i style="width:' + r.loyal + '%"></i></div>' +
        '<b>' + r.loyal + '</b></div>' +
      growRow(h) +
      ambRow(h.id) +
      (bio ? '<small class="muted dt-bio">' + esc(bio) + '</small>' : '') +
      (h.quote ? '<small class="quote">“' + esc(h.quote) + '”</small>' : '') +
      /* 군주는 상도 승진도 없다 — 제 나라에서 제가 올라갈 자리가 없다 */
      (isLord ? '' :
        '<div class="camp-acts">' +
          '<button class="btn tiny" data-act="reward" data-id="' + h.id + '">🎁 금 300</button>' +
          promoteBtn(h) +
          heirBtn(h, r, mine) +
        '</div>') +
      '</div>';
  }

  /** 관직과 경험 — 무장이 자라는 것이 보여야 기르는 뜻이 산다 */
  function growRow(h) {
    var H = global.DG.hero;
    var g = off().grow(h.id);
    var need = H.expNeed(g.lv);
    var pct = g.lv >= H.MAX_LV ? 100 : Math.round(core.clamp(g.exp / need, 0, 1) * 100);
    return '<div class="rstat"><span>' + esc(off().rankName(h.id)) + '</span>' +
      '<div class="bar sm gold"><i style="width:' + pct + '%"></i></div>' +
      '<b>' + (g.lv >= H.MAX_LV ? '만렙' : g.exp + '/' + need) + '</b></div>';
  }

  /** 후계 지정 단추 — 군주 노쇠·계승(PLAN §5-8)을 켰을 때만, 우리 세력 무장에게만 */
  function heirBtn(h, r, mine) {
    if (!mine || !off().lordAgingOn()) { return ''; }
    var on = off().heirOf(r.force) === h.id;
    var set = R().state().forces[r.force].heir === h.id;
    return '<button class="btn tiny' + (set ? ' primary' : '') + '" data-act="set-heir" data-id="' + h.id + '"' +
      ' title="' + (set ? '지정을 풀면 충성 높은 사람이 자동으로 잇는다' : '군주가 별세하면 이 사람이 잇는다') + '">🎌 ' +
      (set ? '후계 해제' : (on ? '후계(자동)' : '후계 지정')) + '</button>';
  }

  function promoteBtn(h) {
    var chk = off().promoteCheck(h.id);
    var g = off().grow(h.id);
    if (g.rank >= global.DG.hero.MAX_RANK) {
      return '<button class="btn tiny" disabled>✨ 더 올릴 자리 없음</button>';
    }
    var c = off().promoteCost(g.rank);
    return '<button class="btn tiny' + (chk.ok ? ' primary' : '') + '"' +
      (chk.ok ? '' : ' disabled') + ' data-act="promote" data-id="' + h.id +
      '" title="' + esc(chk.ok ? '올린다' : chk.why) + '">✨ 승진 <span class="muted">공 ' +
      off().rec(h.id).feats + '/' + c.feats + ' · 🪙' + c.gold + '</span></button>';
  }

  /* ── 외교 ─────────────────────────────────────────────── */

  function viewDiplo() {
    var D = global.DG.diplo;
    var me = R().me();
    var rank = R().ranking().filter(function (f) { return f.id !== me; });
    /* 사자 — 아무 성에서나, 아직 명령을 안 쓴 사람 중 지력 으뜸 */
    var by = null, bv = -1, cs = R().citiesOf(me), i, j;
    for (i = 0; i < cs.length; i++) {
      var ready = R().readyAt(cs[i]);
      for (j = 0; j < ready.length; j++) {
        var w = off().stats(ready[j].id).wisdom;
        if (w > bv) { bv = w; by = ready[j]; }
      }
    }
    var html = '<div class="sec"><div class="card">' +
      '<div class="stat-row"><span>사자</span><b>' + (by ? esc(by.name) + ' (지력 ' + bv + ')' : '없음') + '</b></div>' +
      '<small class="muted">사자는 <b>그 달의 명령 한 번</b>을 씁니다. ' +
      '동맹·화친 동안에는 서로 칠 수 없습니다.</small></div></div>';

    for (i = 0; i < rank.length; i++) {
      var f = rank[i];
      var rel = D.relation(me, f.id);
      var ally = D.alliedWith(me, f.id), truce = D.trucedWith(me, f.id);
      var mf = R().force(me);
      html += '<div class="card"><div class="stat-row">' +
        '<span><i class="fdot" style="background:' + forceColor(f.id) + '"></i> <b>' +
          esc(f.name) + '</b>' +
          (ally ? ' <span class="tag">동맹 ' + mf.allies[f.id] + '개월</span>' : '') +
          (truce ? ' <span class="tag">화친 ' + mf.truce[f.id] + '개월</span>' : '') + '</span>' +
        '<span class="muted">🏯 ' + f.cities + ' · 🪖 ' + core.fmt(f.troops) + '</span></div>' +
        '<div class="rstat"><span>우호</span><div class="bar sm"><i style="width:' + rel +
          '%"></i></div><b>' + rel + '</b></div>';
      if (by && !ally) {
        html += '<div class="bagtools">' +
          (truce ? '' :
            '<button class="btn tiny" data-act="envoy" data-kind="truce" data-to="' + f.id +
            '" data-by="' + by.id + '" title="' + DEBATE_TIP + '">🗣️ 화친 ' + Math.round(D.envoyChance('truce', me, f.id, by.id, 200) * 100) + '%</button>') +
          '<button class="btn tiny" data-act="envoy" data-kind="ally" data-to="' + f.id +
            '" data-by="' + by.id + '" title="' + DEBATE_TIP + '">🗣️ 동맹 ' + Math.round(D.envoyChance('ally', me, f.id, by.id, 200) * 100) + '%</button>' +
          '<button class="btn tiny ghost" data-act="envoy" data-kind="tribute" data-to="' + f.id +
            '" data-by="' + by.id + '">🎁 조공 600</button>' +
          '</div>';
      }
      html += '</div>';
    }
    return html;
  }

  /* ── 학당 (문답 — 곁가지) ─────────────────────────────── */

  function viewSchool() {
    var QD = global.DG.quizData;
    var pr = global.DG.quiz.progress();
    var st = R().state();
    var html = '<div class="sec"><div class="card">' +
      '<div class="stat-row"><span>익힌 문답</span><b>' + pr.learned + ' / ' + pr.total + '</b></div>' +
      '<div class="stat-row"><span>학식</span><b>' + (st.lore || 0) + ' / ' + R().LORE_PER_FIND + '</b></div>' +
      '<small class="muted">문답을 <b>처음</b> 맞히면 군자금이 들어오고 <b>학식</b>이 쌓입니다. ' +
      '학식이 차면 우리 땅에 묻힌 <b>재야 하나가 저절로 드러납니다</b> — 수색 명령을 아끼는 길입니다. ' +
      '이 판의 알맹이는 삼국지이고, 학당은 곁가지입니다.</small></div></div>';

    if (!quizCur) {
      html += '<div class="sec"><h4>분야</h4>' +
        '<button class="btn primary wide" data-act="q-start" data-cat="">🎲 전 분야 섞어서</button>' +
        '<div class="qcats">';
      for (var i = 0; i < QD.CATS.length; i++) {
        var c = QD.CATS[i], per = pr.per[c.key];
        html += '<button class="qcat-btn" data-act="q-start" data-cat="' + c.key + '">' +
          '<span style="color:' + c.color + '">' + c.emoji + '</span><b>' + esc(c.name) +
          '</b><small>' + per.learned + ' / ' + per.total + '</small></button>';
      }
      return html + '</div></div>';
    }

    var p = quizCur.p, cat = QD.catOf(p.cat);
    html += '<div class="sec"><div class="qbox">' +
      '<div class="qb-head"><b style="color:' + cat.color + '">' + cat.emoji + ' ' +
        esc(cat.name) + '</b><span class="muted">' + p.lvName + '</span>' +
      '<button class="btn tiny ghost" data-act="q-quit" style="margin-left:auto">그만</button></div>' +
      '<p class="qq">' + esc(p.q) + '</p>';
    if (!quizCur.result) {
      html += '<div class="qchoices">';
      for (var j = 0; j < p.choices.length; j++) {
        html += '<button class="qchoice" data-act="q-answer" data-i="' + j + '"><b>' +
          (j + 1) + '</b> ' + esc(p.choices[j]) + '</button>';
      }
      html += '</div>';
    } else {
      var r = quizCur.result;
      html += '<div class="qresult ' + (r.ok ? 'good' : 'bad') + '">' +
        (r.ok ? (r.first ? '✅ 정답 — 새로 익혔습니다' : '✅ 정답 (복습)') : '❌ 오답') +
        '<b> ' + esc(r.answerText) + '</b></div><p class="qwhy">' + esc(r.why) + '</p>';
      var bits = [];
      if (r.reward.gold) { bits.push('🪙 +' + r.reward.gold); }
      if (r.reward.school && r.reward.school.found) {
        bits.push('🔍 ' + r.reward.school.found.name + ' 이(가) 드러났다');
      }
      if (bits.length) { html += '<div class="qreward">' + bits.join(' · ') + '</div>'; }
      html += '<button class="btn primary wide" data-act="q-next">다음 문제</button>';
    }
    return html + '</div></div>';
  }

  /* ── 기록 ─────────────────────────────────────────────── */

  function viewLog() {
    var log = core.save.log, out = '', vs = R().state().victories || [];
    if (vs.length) {
      out += '<div class="loglist">';
      for (var v = 0; v < vs.length; v++) {
        var vk = vs[v].kind, vn = vk === 'conquest' ? '👑 천하통일' : R().VICTORY[vk].emoji + ' ' + R().VICTORY[vk].name + ' 승리';
        out += '<div class="lrow good">🏆 ' + esc(vn) + ' — 시작부터 ' + vs[v].month + '달째</div>';
      }
      out += '</div>';
    }
    var chains = global.DG.event ? global.DG.event.activeView() : [];
    if (chains.length) {
      out += '<div class="loglist">';
      for (var ci = 0; ci < chains.length; ci++) {
        out += '<div class="lrow info">' + chains[ci].emoji + ' ' + esc(chains[ci].name) + ' — ' + chains[ci].step + '번째 이야기 · ' +
          (chains[ci].in ? chains[ci].in + '달 뒤' : '곧') + ' (' + esc(chains[ci].who.join(' · ')) + ')</div>';
      }
      out += '</div>';
    }
    var scn = global.DG.scenario ? global.DG.scenario.lines() : [];
    if (scn.length) {
      out += '<div class="loglist"><div class="lrow info"><b>📖 이야기</b></div>';
      var lastAct = 0;
      for (var si = 0; si < scn.length; si++) {
        var sl = scn[si];
        if (sl.act !== lastAct) { lastAct = sl.act; out += '<div class="lrow info"><small class="muted">' + esc(global.DG.scenarioData.ACTS[sl.act] || (sl.act + '막')) + '</small></div>'; }
        out += '<div class="lrow ' + (sl.state === 'done' ? 'good' : 'info') + '">' + sl.emoji + ' ' + esc(sl.title) + ' — ' + (sl.state === 'done' ? '✅ 끝' : sl.state === 'legacy' ? '지나온 길' : sl.state === 'next' ? '▶ 다음 사건' : sl.state === 'goal' ? '🎯 ' + esc(sl.note) : '·') + '</div>';
      }
      out += '</div>';
    }
    if (!log.length) { return out + '<div class="hint">아직 기록이 없습니다.</div>'; }
    out += '<div class="loglist">';
    for (var i = 0; i < log.length; i++) {
      out += '<div class="lrow ' + log[i].kind + '">' + esc(log[i].text) + '</div>';
    }
    return out + '</div>';
  }

  return {
    viewCity: wrap(viewCity), viewCamp: wrap(viewCamp), viewOfficers: wrap(viewOfficers),
    viewDiplo: wrap(viewDiplo), viewSchool: wrap(viewSchool), viewLog: wrap(viewLog),
    traitEmoji: traitEmoji, traitNames: traitNames
  };
  } };
})(window);
