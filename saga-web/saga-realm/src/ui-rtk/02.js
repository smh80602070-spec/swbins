  /* ── 지도 ─────────────────────────────────────────────── */

  /** 원정 하나가 경로 위 지금 어디쯤 있는가(화면 x·y, 0~100대) — 구간별 실제
   *  거리로 나눠 잡는다(칸 수 균등이 아니라 `CD.pathMonths()`와 같은 잣대) */
  function journeyPos(j) {
    var path = j.path, i;
    if (!path || path.length < 2) {
      var only = path && CD.find(path[0]);
      return only ? { x: only.x, y: only.y } : null;
    }
    var frac = core.clamp((j.monthsElapsed || 0) / (j.monthsTotal || 1), 0, 0.999);
    var segs = [], total = 0;
    for (i = 0; i < path.length - 1; i++) {
      var a = CD.find(path[i]), b = CD.find(path[i + 1]);
      if (!a || !b) { continue; }
      var len = Math.hypot(a.x - b.x, a.y - b.y);
      segs.push({ a: a, b: b, len: len });
      total += len;
    }
    if (!segs.length) { return null; }
    if (!total) { return { x: segs[0].a.x, y: segs[0].a.y }; }
    var target = frac * total, acc = 0;
    for (i = 0; i < segs.length; i++) {
      if (acc + segs[i].len >= target || i === segs.length - 1) {
        var segFrac = segs[i].len > 0 ? core.clamp((target - acc) / segs[i].len, 0, 1) : 0;
        return { x: segs[i].a.x + (segs[i].b.x - segs[i].a.x) * segFrac,
                 y: segs[i].a.y + (segs[i].b.y - segs[i].a.y) * segFrac };
      }
      acc += segs[i].len;
    }
    return { x: segs[segs.length - 1].b.x, y: segs[segs.length - 1].b.y };
  }

  function renderMap() {
    if (global.DG.mount && global.DG.mount.frame) { global.DG.mount.frame(); }
    var st = R().state();
    if (!st.started) { els.realm.innerHTML = ''; return; }
    var i, j, s = '';

    /* viewBox 를 100→125→165(폭)·100→120(높이) 로 넓혀 왔다(2026-09-03 한국,
       2026-09-09 일본·교주 지역 확장) — 전부 동·남쪽(양수 좌표) 빈 자리였다.
       서역(2026-09-09 넷째)은 반대로 **서쪽**인데 무위(x:15)·성도(x:14)가
       이미 0 에 바짝 붙어 있어 그 결로는 room이 없었다 — 그래서 기존 51성
       좌표는 하나도 안 건드리고 **원점을 음수 쪽으로 옮겼다**
       (min-x -60·min-y -30, 너비 225·높이 150). 천축(여섯째)·막북(일곱째)은
       기존 120·-30 높이 안에 다 들어와 손 안 댔다. 임읍(여덟째, 2026-09-10)만
       y:118~134 로 아래로 더 뻗어 **높이를 150→180 으로 다시 넓혔다** —
       x/y 값 자체는 CD.CITIES 데이터가 그대로 쥐고 있어 여기 말고 고칠 곳이 없다.
       2026-09-22 — 대진(열두째)·선비(열셋째)·남해(열넷째) 세 지역을 한
       세션에 같이 넣으면서 x 최소 -120(대진 대진 도성)·y 최소 -40(선비
       적산) 까지 뻗었다 — MAP_VB 와 함께 x:-140~240·y:-55~150 으로
       다시 넓혔다(위 "지도 이동·확대" 절 주석 참고).
     전체 범위 자체(MAP_VB, 위 "지도 이동·확대" 절)는 여기 -140/-55/380/205 와
     반드시 같아야 한다 — 보이는 창(viewBox)은 mapViewBox() 가 이동·확대
     상태에 따라 그 범위 **안의 일부**를 계산해 낸다(2026-09-10) */
    s += '<svg class="rmap" viewBox="' + mapViewBox() + '" preserveAspectRatio="xMidYMid meet">' + (global.DG.map2d ? global.DG.map2d.terrain(CD.CITIES) + global.DG.map2d.territory(CD.CITIES, st, forceColor) : '');   // 2D 모드 지형 바닥(W-0023)·세력 영토 면(W-0027)

    /* 길 — 인접한 성끼리. 같은 편이면 밝게 */
    var drawn = {};
    for (i = 0; i < CD.CITIES.length; i++) {
      var a = CD.CITIES[i];
      for (j = 0; j < a.adj.length; j++) {
        var b = CD.find(a.adj[j]);
        var key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if (drawn[key]) { continue; }
        drawn[key] = true;
        var fa = st.cities[a.id].force, fb = st.cities[b.id].force;
        var same = fa && fa === fb;
        var wet = CD.isWater(a.id, b.id);
        s += '<line class="rlink' + (same ? ' same' : '') + (wet ? ' water' : '') +
          '" x1="' + a.x + '" y1="' + a.y +
          '" x2="' + b.x + '" y2="' + b.y + '"' +
          (same && !wet ? ' stroke="' + forceColor(fa) + '"' : '') + '/>';
      }
    }

    /* 성 */
    for (i = 0; i < CD.CITIES.length; i++) {
      var d = CD.CITIES[i], c = st.cities[d.id];
      var mine = c.force === st.me;
      var rad = 1.5 + Math.min(2.2, c.troops / 12000);
      s += '<g class="rcity' + (mine ? ' mine' : '') + '" data-city="' + d.id + '">' +
        /* 손가락이 닿는 목표 — 성 점은 화면에서 8px 남짓이라 폰에서 못 누른다.
           보이지 않는 큰 원을 하나 깔아 둔다(그림은 그대로, 손만 커진다) */
        '<circle class="rhit" cx="' + d.x + '" cy="' + d.y + '" r="4.2"/>' +
        '<circle cx="' + d.x + '" cy="' + d.y + '" r="' + rad.toFixed(2) + '" fill="' +
          forceColor(c.force) + '"/>' + (global.DG.map2d ? global.DG.map2d.castle(d, rad) : '') +
        (mine ? '<circle cx="' + d.x + '" cy="' + d.y + '" r="' + (rad + 1.1).toFixed(2) +
          '" class="ring"/>' : '') +
        (c.disaster ? '<text class="rdis" x="' + (d.x + rad + 0.6) + '" y="' + (d.y - rad) +
          '">' + R().disasterByKey(c.disaster).emoji + '</text>' : '') +
        (global.DG.war.besieged(d.id) ? '<text class="rdis" x="' + (d.x - rad - 2.4) +
          '" y="' + (d.y - rad) + '">🏕️</text>' : '') +
        '<text class="rlab" x="' + d.x + '" y="' + (d.y + rad + 2.6) + '">' + esc(d.name) + '</text>' +
        '</g>';
    }

    /* 가고 있는 원정 — 경로 위 지금 자리에 깃발 하나(2026-09-04) */
    var jn = global.DG.war.journeys();
    for (i = 0; i < jn.length; i++) {
      var pos = journeyPos(jn[i]);
      if (!pos) { continue; }
      s += '<text class="rjourney" x="' + pos.x + '" y="' + pos.y +
        '" fill="' + forceColor(jn[i].force) + '">🚩</text>';
    }
    s += '</svg>';

    /* 범례 — 살아 있는 세력 */
    var rank = R().ranking();
    s += '<div class="rlegend">';
    for (i = 0; i < rank.length; i++) {
      var mine = rank[i].id === st.me;
      s += '<span class="rlg' + (mine ? ' me' : '') + '"' +
        (mine ? ' data-act="center-mine" title="내 땅으로"' : '') + '>' +
        '<i style="background:' + forceColor(rank[i].id) + '"></i>' +
        esc(rank[i].name) + ' <b>' + rank[i].cities + '</b></span>';
    }
    s += '</div>';

    els.realm.innerHTML = s;
    syncMapControls();
  }

  /* ── 시트 ─────────────────────────────────────────────── */

  var SHEET_TITLE = { city: '🏯 성', officers: '👤 무장', camp: '🏕️ 진·원정',
                      diplo: '🤝 외교', school: '📚 학당', log: '📜 기록', settings: '⚙️ 설정' };

  /** 2026-09-10 — 효과음(사가블로·사가스토리·사가의숲 설정 시트와 같은 결).
   *  진·BGM·진동은 없어(sfx.js 에 그 손잡이 자체가 없다) 효과음만 둔다.
   *  상단 더보기(⋯)의 🔊 는 그대로 둔다(빠른 켬/끔 — 이 시트로 대체하지 않는다).
   *  2026-09-17 — 그래픽 품질 3단(SAGA-DESIGN §8 성능 상한, PLAN §7-2) 추가.
   *  `realm3d.js`에 등급표(QUALITY_PRESET)가 생겨 여기 손잡이를 둔다 —
   *  지도 소품 밀도는 `buildStaticOnce()`가 켤 때 한 번만 도는 정적값이라
   *  새로고침해야 반영된다(문구로 안내). */
  function viewSettings() {
    var SF = global.DG.sfx;
    if (!SF) { return '<div class="hint">소리 모듈을 찾을 수 없습니다</div>'; }
    var on = SF.enabled(), vol = Math.round(SF.volume() * 100);
    var shakeOn = core.tuned('battle3d.shake', 1) ? true : false;
    var R3 = global.DG.realm3d;
    var qRow = '';
    if (R3 && R3.setQuality) {
      var qLevels = [['auto', '자동'], ['low', '저'], ['medium', '중'], ['high', '고']];
      var qCur = core.tuned('realm3d.quality', 'auto');
      qRow = '<div class="key-row"><b>지도 화질</b><div class="bagtools">' +
        qLevels.map(function (p) {
          return '<button class="btn tiny' + (qCur === p[0] ? ' primary' : '') +
            '" data-act="quality-set" data-level="' + p[0] + '">' + p[1] + '</button>';
        }).join('') +
        '</div></div><small class="muted">소품 밀도·해상도 — 바꾸면 새로고침해야 반영됩니다.</small>';
    }
    return '<div class="key-row"><b>효과음</b>' +
        '<button data-act="snd-toggle">' + (on ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>음량</b>' +
        '<input type="range" min="0" max="100" value="' + vol + '" data-act="snd-vol"' +
        (on ? '' : ' disabled') + '>' +
        '<span class="key-cur">' + vol + '%</span></div>' + (global.DG.bgm ? global.DG.bgm.settingsHtml() : '') +
      /* 2026-09-10 — 전투 화면에 성벽 붕괴 카메라 흔들림(wallShake)을 더하면서
         같이 둔다. 부드러운 것(라운드 충격 거리·일기토 근접 컷)은 안 가리고
         진짜 화면이 떨리는 것만 끌 수 있다 */
      '<div class="key-row"><b>전투 화면 흔들림</b>' +
        '<button data-act="shake-toggle">' + (shakeOn ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row"><b>다음 달 카드</b>' +
        '<button data-act="monthcard-toggle">' + (monthCardOn() ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row" title="켜면 군주도 늙고 65세부터 세상을 떠난다 — 후계가 잇고 나머지는 흔들린다"><b>군주 노쇠·계승</b>' +
        '<button data-act="lordaging-toggle">' + (off().lordAgingOn() ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row" title="원정군·태수·싸움·재야가 3D 지도 위에서 움직인다 — 끄면 깃발만"><b>지도 위 인물</b>' +
        '<button data-act="actors-toggle">' + (core.tuned('realm3d.actors', 1) ? '켜짐' : '꺼짐') + '</button></div>' +
      '<div class="key-row" title="성을 누르면 카메라가 그 성 태수 앞으로 다가간다"><b>성 누르면 다가가기</b>' +
        '<button data-act="cityzoom-toggle">' + (core.tuned('realm3d.cityZoom', 1) ? '켜짐' : '꺼짐') + '</button></div>' +
      qRow;
  }

  function openSheet(name) {
    openTab = name;
    els['sheet-title'].textContent = SHEET_TITLE[name] || name;
    els.sheet.setAttribute('data-tab', name);
    els.sheet.classList.add('show');
    document.body.classList.add('sheet-open');
    if (global.innerWidth <= 780) { els.scrim.classList.add('show'); }
    syncDock();
    syncMapControls();
    renderSheet();
  }

  function openCity(id) {
    openCityId = id;
    pickOrder = null;
    openSheet('city');
  }

  function closeSheet() {
    openTab = null;
    els.sheet.classList.remove('show');
    document.body.classList.remove('sheet-open');
    els.scrim.classList.remove('show');
    syncDock();
    syncMapControls();
  }

  function syncDock() {
    var bs = els.dock.querySelectorAll('[data-sheet]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('on', bs[i].getAttribute('data-sheet') === openTab);
    }
    /* 나가 있는 진·원정 수 — 눌러 보지 않으면 잊기 쉬운 칸이다 */
    var cb = els.dock.querySelector('[data-sheet="camp"]');
    if (!cb) { return; }
    var n = R().state().started ?
      global.DG.war.campsOf(R().me()).length + global.DG.war.journeysOf(R().me()).length : 0;
    var badge = cb.querySelector('i.badge');
    if (n > 0) {
      if (!badge) { badge = document.createElement('i'); badge.className = 'badge'; cb.appendChild(badge); }
      badge.textContent = String(n);
    } else if (badge) { badge.parentNode.removeChild(badge); }
  }

  function renderSheet() {
    if (!openTab) { return; }
    /* 설정은 게임을 시작하기 전(세력을 고르기 전)에도 소리를 끄고 싶을 수 있어
       "시작함" 문턱을 건너뛴다 — 나머지 시트는 국토 자체가 없어 그 문턱이 맞다 */
    if (openTab !== 'settings' && !R().state().started) { return; }
    var v = openTab === 'settings' ? viewSettings()
          : openTab === 'city' ? viewCity()
          : openTab === 'officers' ? viewOfficers()
          : openTab === 'camp' ? viewCamp()
          : openTab === 'diplo' ? viewDiplo()
          : openTab === 'school' ? viewSchool() : viewLog();
    els['sheet-body'].innerHTML = v;
    if (openTab === 'city' && openCityId && global.DG.city3d) {
      global.DG.city3d.render(openCityId);
    }
  }

  /* ── 성 ───────────────────────────────────────────────── */

  function bar(label, val, max, extra) {
    var pct = Math.round(core.clamp(val / max, 0, 1) * 100);
    return '<div class="rstat"><span>' + label + '</span>' +
      '<div class="bar sm"><i style="width:' + pct + '%"></i></div>' +
      '<b>' + core.fmt(val) + (extra || '') + '</b></div>';
  }

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
    return html;
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

  /* ── 덮개 화면 ────────────────────────────────────────── */

  /* ── 수를 묻는다 (prompt 대신) ────────────────────────
   * 폰에서 `prompt()` 는 숫자 키패드가 아니라 글자판을 띄우고, 홈 화면에 담아
   * 띄운 앱(standalone)에서는 아예 뜨지 않는 기기가 있다. 출진·보급·병력 보내기는
   * 이 판에서 가장 자주 누르는 자리라, 막히면 폰에서는 놀 수가 없다.
   * 그래서 **자체 카드**로 바꿨다 — 미는 막대와 ¼·½·⅘·전부.
   */
  var askCb = null;

  function askNumber(opt) {
    askCb = opt.done;
    var max = Math.max(1, Math.floor(opt.max));
    var init = Math.max(1, Math.min(max, Math.floor(opt.value || max)));
    showEnc(
      '<h3 style="margin:0 0 2px;font-size:17px">' + esc(opt.title) + '</h3>' +
      (opt.hint ? '<small class="muted">' + opt.hint + '</small>' : '') +
      '<div class="numask">' +
        '<b id="asknum">' + core.fmt(init) + '</b>' +
        '<input id="askrange" type="range" min="1" max="' + max + '" value="' + init + '">' +
        '<div class="camp-acts">' +
          '<button class="btn tiny" data-act="ask-part" data-p="0.25">¼</button>' +
          '<button class="btn tiny" data-act="ask-part" data-p="0.5">½</button>' +
          '<button class="btn tiny" data-act="ask-part" data-p="0.8">⅘</button>' +
          '<button class="btn tiny" data-act="ask-part" data-p="1">전부</button>' +
        '</div>' +
        '<div class="camp-acts">' +
          '<button class="btn primary" data-act="ask-ok">' + esc(opt.ok || '보낸다') + '</button>' +
          '<button class="btn ghost" data-act="ask-no">그만</button>' +
        '</div>' +
      '</div>');
    var rg = $('askrange');
    if (rg) { rg.addEventListener('input', askShow); }
  }

  function askShow() {
    var rg = $('askrange'), n = $('asknum');
    if (rg && n) { n.textContent = core.fmt(parseInt(rg.value, 10)); }
  }

  function showEnc(html, cls) {
    els.encounter.innerHTML = '<div class="enc-card' + (cls ? ' ' + cls : '') + '">' + html + '</div>';
    els.encounter.classList.toggle('battle', cls === 'battle');
    els.encounter.classList.add('show');
  }

  /** 다른 카드가 떠 있으면 줄을 세웠다가 그 카드를 닫을 때 띄운다(이정표 카드가 전황 카드를 덮지 않게) */
  var encQueue = [];
  function showEncQueued(html) {
    if (els.encounter.classList.contains('show')) { encQueue.push(html); } else { showEnc(html); }
  }

  function closeEnc() {
    if (liveStep && liveOn) { finishLiveNow(); return; }   // 결과가 새 카드로 뜬다
    stopLiveClock();
    liveOn = false; liveStep = null;
    els.encounter.classList.remove('show', 'battle');
    els.encounter.innerHTML = '';
    if (encQueue.length) { showEnc(encQueue.shift()); }
  }

  function monthCardOn() { return core.tuned('rtk.monthCard', 1) !== 0; }

  function delta(o) {
    var d = o.to - o.from;
    return '<b>' + core.fmt(o.to) + '</b> <span class="' + (d >= 0 ? 'good' : 'meh') + '">' + (d >= 0 ? '+' : '') + core.fmt(d) + '</span>';
  }

  /** 다음 달 카드(§5-7) — 이번 달 일어난 일 셋·재정·다음 달 권고 하나·진척. 닫으면 그대로 진행 */
  function showMonthCard(rp) {
    var html = '<h3 style="margin:0 0 4px;font-size:18px">📅 ' + rp.year + '년 ' + rp.month + '월</h3>' +
      '<div class="enc-hist">', i;
    for (i = 0; i < rp.lines.length; i++) { html += (i ? '<br>' : '') + esc(rp.lines[i]); }
    html += '</div><div class="enc-hist">🪙 ' + delta(rp.gold) + ' · 🍚 ' + delta(rp.food) + '<br>🪖 ' + delta(rp.troops) +
      ' · 🏯 ' + delta(rp.cities) + '</div>';
    if (rp.next) { html += '<div class="enc-hist"><b>💡 다음 달 권고</b><br>' + esc(rp.next) + '</div>'; }
    var prog = '';
    if (rp.milestone) { prog += '🚩 ' + rp.milestone.idx + '/' + rp.milestone.total + ' ' + esc(rp.milestone.name) + ' ' + rp.milestone.cur + '/' + rp.milestone.need + '<br>'; }
    if (rp.victory) { prog += rp.victory.emoji + ' ' + esc(rp.victory.name) + ' ' + Math.min(100, Math.round(100 * rp.victory.pct)) + '% · ' + esc(rp.victory.note) + '<br>'; }
    if (rp.challenge && !rp.challenge.done) {
      prog += '🎯 도전 ' + rp.challenge.month + '/' + rp.challenge.months + '달 · 점수 ' + rp.challenge.score +
        (rp.challenge.best ? ' · 최고 ' + rp.challenge.best : '') + '<br>';
    }
    if (prog) { html += '<small class="muted">' + prog + '</small>'; }
    showEncQueued(html + '<button class="btn primary wide" data-act="close-enc">확인</button>');
  }

  /** 주간 도전을 마친 카드 — 점수·최고 기록·공유 코드. 판은 이어진다 */
  function showChallenge(res) {
    showEncQueued('<div style="text-align:center"><div class="enc-big">🎯</div>' +
      '<h3 style="margin:6px 0 2px;font-size:20px;color:var(--gold)">이번 주 도전 ' + (res.how === 'lose' ? '— 멸망' : '끝') + '</h3>' +
      '<small class="muted">' + esc(res.week) + ' · ' + res.months + '달째</small></div>' +
      '<div class="enc-hist"><b>점수 ' + res.score + '</b>' + (res.isBest ? ' <span class="good">최고 기록!</span>' : '') +
      '<br>이 주 최고 ' + res.best + '점<br><small class="muted">공유 코드 ' + esc(res.code) + '</small></div>' +
      '<button class="btn primary wide" data-act="close-enc">' + (res.how === 'time' ? '이어하기' : '확인') + '</button>' +
      '<button class="btn wide" data-act="back-scen">새 판</button>');
  }

  /** 사연 카드(§5-2) — 세 갈래를 고를 때까지 안 닫힌다. 고르지 않고 나가도 세이브에 남아 다시 뜬다 */
  var EV_AXIS = { atk: '⚔️', def: '🛡️', util: '💡' };
  function showEvent() {
    var E = global.DG.event, v = E && E.view();
    if (!v) { return; }
    if (v.pre && !v.pre.done) { showEventPre(v); return; }
    var kd = v.kind ? global.DG.relData.KINDS[v.kind] : null, html, i;
    html = '<div style="text-align:center"><div class="enc-big">' + v.emoji + '</div>' +
      '<h3 style="margin:6px 0 2px;font-size:19px;color:var(--gold)">' + esc(v.name) + '</h3>' +
      '<small class="muted">' + (kd ? kd.emoji + ' ' + kd.name + ' · ' : '') + (v.tag || (v.step > 1 ? v.step + '번째 이야기' : '사연')) + '</small></div>' +
      '<div class="enc-hist">' + esc(v.text) + '</div>';
    for (i = 0; i < v.choices.length; i++) {
      var c = v.choices[i];
      html += '<button class="btn wide' + (c.k === 'atk' ? ' primary' : '') + '" data-act="ev-pick" data-k="' + c.k + '"' + (c.ok ? '' : ' disabled') + '>' +
        EV_AXIS[c.k] + ' ' + esc(c.label) + '<br><small>' + esc(c.hint) + (c.ok || !c.cost ? '' : ' (금이 모자랍니다)') + '</small></button>';
    }
    showEncQueued(html);
  }

  /** 사연 앞 단 — 시나리오 카드가 설전·일기토를 먼저 치르게 한다. 카드는 도입 글과 단추 하나, 치른 뒤 결과 카드가 열린다 */
  function showEventPre(v) {
    var duel = v.pre.kind === 'duel';
    showEncQueued('<div style="text-align:center"><div class="enc-big">' + v.emoji + '</div>' +
      '<h3 style="margin:6px 0 2px;font-size:19px;color:var(--gold)">' + esc(v.name) + '</h3>' +
      '<small class="muted">' + esc(v.tag || '') + '</small></div>' +
      '<div class="enc-hist">' + esc(v.pre.intro) + '</div>' +
      '<button class="btn wide primary" data-act="ev-pre">' + (duel ? '🤺 일기토에 나선다' : '🗣️ 설전에 나선다') + '</button>');
  }

  function runEventPre() {
    var E = global.DG.event, v = E && E.view();
    if (!v || !v.pre || v.pre.done) { showEvent(); return; }
    if (v.pre.kind === 'duel') {
      global.DG.war.duelHand(v.pre.a, v.pre.d, showDuelCard, function (res) {
        E.setPre({ won: res.winner === v.pre.a });
        closeEnc();
        showEvent();
      }, '▶ 결과로');
    } else {
      startDebate({ title: v.name, by: v.pre.by, must: true, done: function (mul, ok) { E.setPre({ ok: ok || 0 }); showEvent(); } });
    }
  }

  /** 이정표를 깬 달의 카드 — 보상(금·소문·보물)과 다음 이정표 */
  function showMilestone(list) {
    var html = '<div style="text-align:center"><div class="enc-big">🚩</div>', i;
    for (i = 0; i < list.length; i++) {
      var g = list[i];
      html += '<h3 style="margin:6px 0 2px;font-size:19px;color:var(--gold)">' + esc(g.name) + '</h3>' +
        '<small class="muted">이정표 ' + (g.idx + 1) + '/5 · ' + esc(g.desc) + '</small>' +
        '<div class="enc-hist"><span class="good">🪙 금 +' + core.fmt(g.gold) + '</span>' +
        (g.found.length ? '<br>🔍 ' + esc(g.found.join(' · ')) + ' 의 소문이 돈다' : '') +
        (g.relic ? '<br>' + g.relic.emoji + ' ' + esc(g.relic.name) + ' → ' + esc(g.relic.who) : '') +
        '</div>';
    }
    var mv = R().milestoneView();
    html += '<small class="muted">' + (mv && mv.cur
      ? '다음 — ' + esc(mv.cur.name) + ': ' + esc(mv.cur.desc)
      : '다섯 이정표를 모두 넘었습니다.') + '</small></div>' +
      '<button class="btn primary wide" data-act="close-enc">확인</button>';
    showEncQueued(html);
  }

  /** 결과 카드(§5-5) — 걸린 달·성·인물 다섯·기록 셋·다음 도전. 이룬 승리는 이어하기가 기본이고 새 판은 단추로 */
  function resultHtml(card, over) {
    var html = '<div style="text-align:center"><div class="enc-big">' + card.emoji + '</div>' +
      '<h3 style="margin:6px 0 2px;font-size:20px;color:var(--gold)">' + esc(card.name) + '</h3>' +
      '<small class="muted">' + card.year + '년 ' + card.mon + '월 · 시작부터 ' + card.month + '달째' +
      (over ? '' : ' · 판은 이어집니다') + '</small></div>' +
      '<div class="enc-hist"><b>🧑‍✈️ 이끈 사람</b><br>';
    for (var i = 0; i < card.top.length; i++) {
      html += esc(card.top[i].name) + ' <span class="muted">' + card.top[i].power + '</span>' + (i < card.top.length - 1 ? ' · ' : '');
    }
    html += '<br><b>📜 기록</b>';
    for (i = 0; i < card.lines.length; i++) { html += '<br>' + esc(card.lines[i]); }
    if (card.next) { html += '<br><b>🎯 다음 도전</b><br>' + esc(card.next); }
    html += '</div>';
    /* 회차(§5-14) — 이긴 판이면 같은 깃발로 다시. 조건을 카드에 미리 적는다 */
    var nr = card.nr, nrBtn = '';
    if (nr) {
      html += '<div class="enc-hist"><b>🔁 ' + nr.n + '회차</b><br>다른 세력 병력·금 ×' + nr.foe.toFixed(1) + ' · 금 +' + core.fmt(nr.gold) +
        (nr.folk.length ? '<br>돌아올 사람 ' + nr.folk.map(function (id) { return esc(off().find(id).name); }).join(' · ') : '<br><small class="muted">시간 틈 사람을 모셔 두면 다음 회차에 돌아옵니다</small>') + '</div>';
      nrBtn = '<button class="btn wide" data-act="next-round">🔁 ' + nr.n + '회차로 — 같은 깃발</button>';
    }
    return html + (over
      ? '<button class="btn primary wide" data-act="back-scen">새 판</button>' + nrBtn + '<button class="btn wide" data-act="close-enc">닫기</button>'
      : '<button class="btn primary wide" data-act="close-enc">이어하기</button>' + nrBtn + '<button class="btn wide" data-act="back-scen">새 판</button>');
  }

  function showVictory(card) { showEncQueued(resultHtml(card, false)); }

  /** 먼저 **판(시나리오)** 을 고른다 */
  function showScenPick() {
    var html = '<h3 style="margin:0 0 2px;font-size:19px">어느 해에서 시작하시겠습니까</h3>' +
      '<small class="muted">누가 어디서 시작하는지가 판마다 다릅니다. ★ 은 어려운 정도입니다.' +
        (R().roundBest() ? ' · 🔁 최고 ' + R().roundBest() + '회차 클리어' : '') + '</small>' +
      '<div class="fpick scen">';
    for (var i = 0; i < FD.SCENARIOS.length; i++) {
      var sc = FD.SCENARIOS[i];
      html += '<button class="fcard wide-card" data-act="pick-scen" data-id="' + sc.id + '">' +
        '<b>' + sc.year + '년 · ' + esc(sc.name) +
          ' <span class="stars">' + '★★★'.slice(0, sc.stars || 1) + '</span></b>' +
        '<small class="muted">' + esc(sc.hanja) + ' · 세력 ' + sc.forces.length + '</small>' +
        '<small class="muted">' + esc(sc.desc) + '</small>' +
        '</button>';
    }
    /* §5-7 — 일곱 번째 카드: 이번 주 도전(무작위 판을 그 주의 씨앗으로, 60달 점수) */
    var wk = R().challengeWeek(), best = R().bests()[wk.key];
    html += '<button class="fcard wide-card" data-act="pick-challenge">' +
      '<b>🎯 이번 주 도전 · ' + esc(wk.key) + ' <span class="stars chal">★★★</span></b>' +
      '<small class="muted">무작위 판 · ' + R().CHALLENGE_MONTHS + '달 뒤 점수(성×10 + 무장 + 보물×20)</small>' +
      '<small class="muted">' + (best ? '내 최고 ' + best + '점' : '아직 기록이 없습니다') + ' · 같은 주엔 누구나 같은 판입니다</small>' +
      '</button>';
    showEnc(html + '</div>');
  }

  function showForcePick(scenId) {
    var sc = FD.scenario(scenId || pickScen);
    pickScen = sc.id;
    FD.use(sc.id);               // 이 화면이 보여 줄 표를 그 시나리오 것으로 갈아 끼운다
    var html = '<h3 style="margin:0 0 2px;font-size:19px">' + (pickChallenge ? '🎯 이번 주 도전 — 어느 깃발로' : '삼국지 ' + sc.year + '년 — ' + esc(sc.name)) + '</h3>' +
      '<small class="muted">' + esc(sc.desc) + ' 성이 적을수록 어렵습니다.</small>' +
      '<button class="btn tiny ghost" data-act="back-scen" style="margin:8px 0 0">↩ 다른 해</button>' +
      '<div class="fpick">';
    var list = FD.FORCES.filter(function (f) {
      return !sc.playable || sc.playable.indexOf(f.id) >= 0;
    }).sort(function (a, b) { return b.cities.length - a.cities.length; });
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var lord = off().find(f.lord);
      var CREED_KOR = { aggressive: '공격', balanced: '균형', turtle: '수성' };
      html += '<button class="fcard" data-act="pick-force" data-id="' + f.id + '"' +
        ' style="border-color:' + f.color + '">' +
        (lord ? pt(lord, 44) : '') +
        '<b>' + esc(f.name) + '</b>' +
        '<small>🏯 ' + f.cities.length + ' · 👤 ' + (f.officers.length + 1) + '</small>' +
        '<small class="muted">' + (sc.shuffle ? '🎲 무작위' : esc(CD.find(f.cities[0]).name)) + ' · ' +
          CREED_KOR[f.creed] + '</small>' +
        '</button>';
    }
    showEnc(html + '</div>');
  }

  /** 개입 없이 끝난 싸움(AI 가 친 것 · 진영 재개 등)도 실시간으로 숫자가
   *  바뀐다(2026-09-10) — 처음엔 시작 대 끝만 못박아 뒀는데("합마다 갈아
   *  끼우지 않는다"), battle3d.render() 가 이미 합·라운드마다 디오라마를
   *  갈아 끼우면서도 그 타이밍을 밖으로 안 알려 줘서 HUD 만 멈춰 있었다 —
   *  이제 render() 의 둘째 인자(onFrame)로 같은 타이밍을 받아 개입형 실시간
   *  전투(`updateBattleHud`, `showBattleLive` 참고)와 같은 함수로 갱신한다 */
  function showBattle(rep) {
    var html = (global.DG.battle3d ? '<canvas id="battle3d"></canvas>' : '') +
      '<h3 style="margin:0 0 6px;font-size:18px">⚔️ 전황</h3>' +
      battleHudHtml(rep) +
      '<div class="warlog">';
    for (var i = 0; i < rep.log.length; i++) {
      html += '<div>' + esc(rep.log[i]) + '</div>';
    }
    html += '</div><button class="btn primary wide" data-act="close-enc">확인</button>';
    showEnc(html);
    if (global.DG.battle3d) {
      global.DG.battle3d.render(rep, function (state) { updateBattleHud(rep, state); });
    }
  }

  function showEnd(kind) {
    var st = R().state();
    if (kind === 'win') { showEnc(resultHtml(R().resultCard('conquest'), true)); return; }
    showEnc('<h3 style="margin:0 0 6px;font-size:20px">' +
      (kind === 'win' ? '👑 천하통일' : '🏳️ 멸망') + '</h3>' +
      '<small class="muted">' + st.year + '년 ' + st.month + '월. ' +
      (kind === 'win' ? '온 땅의 성이 모두 한 깃발 아래 들었습니다.'
                      : '성을 모두 잃었습니다. 처음부터(↺) 다시 시작할 수 있습니다.') +
      '</small><button class="btn primary wide" data-act="close-enc">확인</button>');
  }

  function showHelp() {
    showEnc('<h3 style="margin:0 0 4px;font-size:18px">📜 노는 법</h3><div class="helplist">' +
      '<div><b>달</b> 무장 한 사람이 한 달에 <b>명령 하나</b>를 씁니다. 다 쓰면 ▶ 다음 달</div>' +
      '<div><b>내정</b> 성을 눌러 개간·상업·기술·치안·축성·징병·훈련·수색·등용</div>' +
      '<div><b>금</b> 세력 금고 하나. <b>군량</b>은 성마다 따로 — 6·10월에 거둡니다</div>' +
      '<div><b>태수</b> 지력·통솔이 그 성의 수입과 수확에 곱해지고, 계략을 막습니다</div>' +
      '<div><b>출진</b> 맞닿은 성에만. 수비도 이웃에서 <b>구원군</b>을 부릅니다</div>' +
      '<div><b>일기토</b> 무력이 엇비슷한 장수끼리 붙습니다. 이기면 그 싸움 내내 기세를 탑니다</div>' +
      '<div><b>충성</b> 바닥나면 떠납니다. 금을 내려 붙듭니다 — 적의 이간이 노리는 곳입니다</div>' +
      '<div><b>재야</b> 한국사·일본사·세계사 인물은 재야입니다. 수색해야 보입니다</div>' +
      '<div><b>학당</b> 문답은 곁가지입니다 — 군자금과 <b>재야 하나</b>를 드러냅니다</div>' +
      '</div><button class="btn primary wide" data-act="close-enc">확인</button>');
  }

  /* ── 알림 ─────────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2400);
  }

  global.DG = global.DG || {};
  global.DG.ui = {
    init: init, toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, openCity: openCity,
    renderTop: renderTop, renderMap: renderMap, renderSheet: renderSheet,
    showScenPick: showScenPick, showForcePick: showForcePick,
    showHelp: showHelp, showBattle: showBattle, showMilestone: showMilestone, showEvent: showEvent,
    closeEnc: closeEnc,
    /** 자가진단용 */
    _act: act, _tab: function () { return openTab; }, _city: function () { return openCityId; },
    _setOrder: function (k) { pickOrder = k; },
    _quiz: function () { return quizCur; }
  };
})(window);
