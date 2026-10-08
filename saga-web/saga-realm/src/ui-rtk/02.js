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
    s += '<svg class="rmap" style="--lz:' + labelZ() + '" viewBox="' + mapViewBox() + '" preserveAspectRatio="xMidYMid meet">' + (global.DG.map2d ? global.DG.map2d.terrain(CD.CITIES) + global.DG.map2d.territory(CD.CITIES, st, forceColor) : '');   // 2D 모드 지형 바닥(W-0023)·세력 영토 면(W-0027)

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

  /** 2026-09-10 — 효과음(사가나락·사가종횡·사가마을 설정 시트와 같은 결).
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

  /* ── 시트 화면(성·진영·무장·외교·학당·기록) — ui-rtk-sheets.js 로 떼어 냄(R-4 2026-10-08) ──
     몸통은 그쪽에 글자 그대로. 여기는 도우미와 지금 상태(고른 성·명령·문답)를 넘겨 이어 붙일 뿐이다 */
  function bar(label, val, max, extra) {
    var pct = Math.round(core.clamp(val / max, 0, 1) * 100);
    return '<div class="rstat"><span>' + label + '</span>' +
      '<div class="bar sm"><i style="width:' + pct + '%"></i></div>' +
      '<b>' + core.fmt(val) + (extra || '') + '</b></div>';
  }
  var SH = global.DG.rtkSheets.make({ esc: esc, pt: pt, ptBig: ptBig, ico: ico, forceColor: forceColor, bar: bar, DEBATE_TIP: DEBATE_TIP,
    now: function () { return { openCityId: openCityId, pickOrder: pickOrder, quizCur: quizCur }; } });
  var viewCity = SH.viewCity, viewCamp = SH.viewCamp, viewOfficers = SH.viewOfficers, viewDiplo = SH.viewDiplo, viewSchool = SH.viewSchool, viewLog = SH.viewLog;
  var traitEmoji = SH.traitEmoji, traitNames = SH.traitNames;

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
    if (liveOn && global.DG.tacticsView && global.DG.tacticsView.cur()) { global.DG.tacticsView.quit(); global.DG.tacticsView.go(); }   // 전술판이 열린 채 닫으면 무승부로 접고 남은 합을 굴린다
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
  var EV_AXIS = { atk: '⚔️', def: '🛡️', util: '💡' }; function speakerHtml(v) { var h = v.speaker && off().find(v.speaker); return h ? '<div style="display:flex;gap:10px;align-items:center;margin:10px 0 2px;text-align:left"><div style="flex:0 0 64px;width:64px;height:64px;border-radius:10px;overflow:hidden">' + pt(h, 64) + '</div><div><b>' + esc(h.name) + '</b><br><i>“' + esc(v.line || '') + '”</i></div></div>' : ''; }   // 영내 소식 초상 + 한 줄(W-0105)
  function showEvent() {
    var E = global.DG.event, v = E && E.view();
    if (!v) { return; }
    if (v.pre && !v.pre.done) { showEventPre(v); return; }
    var kd = v.kind ? global.DG.relData.KINDS[v.kind] : null, html, i;
    html = '<div style="text-align:center">' + (global.DG.cutscene ? global.DG.cutscene.banner('realm', String(v.id).replace(/_end$/, '')) : '') + '<div class="enc-big">' + v.emoji + '</div>' +
      '<h3 style="margin:6px 0 2px;font-size:19px;color:var(--gold)">' + esc(v.name) + '</h3>' +
      '<small class="muted">' + (kd ? kd.emoji + ' ' + kd.name + ' · ' : '') + (v.tag || (v.step > 1 ? v.step + '번째 이야기' : '사연')) + '</small></div>' +
      speakerHtml(v) + '<div class="enc-hist">' + esc(v.text) + '</div>';
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
    showEncQueued('<div style="text-align:center">' + (global.DG.cutscene ? global.DG.cutscene.banner('realm', String(v.id).replace(/_end$/, '')) : '') + '<div class="enc-big">' + v.emoji + '</div>' +
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
    centerAt: function (x, y) { mapCx = x; mapCy = y; applyMapViewNow(); }, _setOrder: function (k) { pickOrder = k; },
    _quiz: function () { return quizCur; }
  };
})(window);
