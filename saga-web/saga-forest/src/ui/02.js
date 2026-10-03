  /* ── 집 ───────────────────────────────────────────────────
   * 창고에서 고르고, **선 자리에 놓는다**(심기와 같은 규칙).
   * 넓히려면 증축을 신청하고 빚을 갚는다 — 원작의 융자다.
   */
  function viewHome() {
    var Hm = global.DG.home, V = global.DG.village, VD = global.DG.villageData;
    var stt = Hm.status(), html = '', i;
    var can = Hm.canPlaceHere();

    html += '<div class="sec"><h4>' + esc(stt.room.name) + '</h4><div class="card">' +
      '<div class="stat-row"><span>집 평가</span><b>' + esc(stt.grade) + ' · ' + stt.score + '점</b></div>' +
      '<div class="stat-row"><span>놓은 것</span><b>🪑 ' + stt.n + '점 · 어울림 ' + stt.bonus + '</b></div>' +
      '<div class="stat-row"><span>방 크기</span><b>' + stt.room.tw + ' × ' + stt.room.th + '</b></div>' +
      (stt.debt
        ? '<div class="stat-row"><span>남은 빚</span><b>🪙 ' + core.fmt(stt.debt) + '</b></div>'
        : '') +
      '<small class="muted">같은 계열을 셋 이상 놓으면 어울림 점수가 붙습니다. ' +
      '날이 바뀌면 평가서가 편지로 옵니다.</small></div></div>';

    /* 증축(융자) */
    html += '<div class="sec"><h4>증축</h4><div class="card">';
    if (stt.debt) {
      html += '<div class="stat-row"><span>갚아야 할 빚</span><b>🪙 ' + core.fmt(stt.debt) + '</b></div>' +
        '<button class="btn primary wide" data-act="v-repay" data-n="0">🪙 갚을 수 있는 만큼 갚는다</button>' +
        '<small class="muted">빚을 다 갚아야 다음 증축을 신청할 수 있습니다.</small>';
    } else if (stt.next) {
      html += '<div class="stat-row"><span>다음</span><b>' + esc(stt.next.name) +
          ' (' + stt.next.w + ' × ' + stt.next.h + ')</b></div>' +
        '<div class="stat-row"><span>빚</span><b>🪙 ' + core.fmt(stt.next.cost) + '</b></div>' +
        '<button class="btn primary wide" data-act="v-expand">🏠 증축을 신청한다</button>' +
        '<small class="muted">신청하면 그 자리에서 넓어지고 빚이 생깁니다.</small>';
    } else {
      html += '<small class="muted">이미 가장 큰 집입니다.</small>';
    }
    html += '</div></div>';

    /* 벽지와 장판 — 가진 것 중에서 고른다 */
    html += '<div class="sec"><h4>벽지와 장판</h4><div class="card">' +
      '<div class="stat-row"><span>지금</span><b>🎨 ' + esc(stt.wall.name) +
        ' · ' + esc(stt.floor.name) + '</b></div>' +
      '<div class="stat-row"><span>평가에 보탠 것</span><b>+' + stt.finish + '점</b></div>' +
      '</div>';
    [['wall', stt.walls, stt.wall, '벽'], ['floor', stt.floors, stt.floor, '바닥']]
      .forEach(function (e) {
        html += '<div class="card gearcard"><div class="gearname">' + e[3] + '</div>' +
          '<div class="bagtools">';
        for (var i = 0; i < e[1].length; i++) {
          var f = e[1][i], on = f.key === e[2].key;
          html += '<button class="btn tiny ' + (on ? 'primary' : 'ghost') + '"' +
            (on ? ' disabled' : '') + ' data-act="v-setfin" data-kind="' + e[0] +
            '" data-id="' + f.key + '">' + esc(f.name) + (on ? ' ✔' : '') + '</button>';
        }
        html += '</div></div>';
      });
    html += '<small class="muted">전방(🎒 가방 시트)에 날마다 벽지 한 벌 · 장판 한 벌이 ' +
      '들어옵니다. 기본이 아닌 것을 바르면 집 평가가 각각 +12 오릅니다.</small></div>';

    /* 창고 → 놓기 */
    html += '<div class="sec"><h4>창고</h4>';
    if (!stt.stock.length) {
      html += '<div class="hint">창고가 비었습니다 — 전방(🎒 가방 시트)에 날마다 가구 넉 점이 들어옵니다.</div>';
    } else {
      for (i = 0; i < stt.stock.length; i++) {
        var e = stt.stock[i];
        var set = VD.FURN_SETS[e.furn.set];
        html += '<div class="card gearcard">' +
          '<div class="gearname">' + ico('furniture', e.furn.key, 24, '🪑') + ' ' + esc(e.furn.name) + gradeTag('goods', e.furn.price) +
            ' <small class="muted">×' + e.n + ' · ' + esc(set ? set.name : '') +
            ' · 🪙 ' + core.fmt(e.furn.price) + '</small></div>' +
          '<div class="bagtools">' +
            '<button class="btn tiny ' + (can.ok ? 'primary' : 'ghost') + '"' +
              (can.ok ? '' : ' disabled') +
              ' data-act="v-place" data-id="' + e.furn.key + '">여기 놓는다</button>' +
            '<button class="btn tiny ghost" data-act="v-sellfurn" data-id="' + e.furn.key +
              '">되판다 (🪙 ' + core.fmt(Math.floor(e.furn.price / 2)) + ')</button>' +
          '</div></div>';
      }
      html += '<div class="hint">' +
        (stt.inside
          ? (can.ok ? '지금 선 자리에 놓을 수 있습니다.' : '지금 자리에는 못 놓습니다 — ' + esc(can.why) + '.')
          : '집 안에 들어가야 놓을 수 있습니다 (🏠 앞에서 ' + core.actHint() + ').') +
        ' 놓인 것 곁에서 <b>' + core.actHint() + '</b> 를 누르면 다시 거둡니다.</div>';
    }
    html += '</div>';
    return html;
  }



  /* ── 마을 (게시판 · 깃대) ─────────────────────────────────
   * 원작의 게시판 자리다. 마을 이름과 마을 기, 그리고 오늘·다음 행사가 여기 붙는다.
   * 게시판이 여태 주민 시트를 열고 있었는데, 이제 제 몫이 생겼다.
   */
  /**
   * 전체지도(PLAN 34-1절) — 핵앤슬래시 M키식 토글. 구면 투영 마을은 코앞만
   * 보이므로, 여기서는 project()/unproject() 를 전혀 쓰지 않고 village.js 가
   * 이미 들고 있는 **타일 좌표 그대로**(tileAt/props/lakeCenter 등)를 위에서
   * 내려다본 평면으로 펼친다 — 화면에 보이는 굽은 땅과는 다른, "진짜 모양"이다.
   */
  var MAP_TILE_COLOR = {
    grass: '#a7d488', grass_meadow: '#d8d689', grass_dark: '#5f7a5a',
    grass_mush: '#b79bc9', grass_rocky: '#b3ab97',
    sand: '#e8d9a0', water: '#7ab8e0', path: '#c9a86a'
  };
  var MAP_PROP_ICON = {
    shop: '🏪', home: '🏠', mail: '📮', tailor: '🧵', board: '🪧',
    museum: '🏛️', pole: '🚩',
    /* 나그네 야영(§5.5 ①)·폐허 옛 우체통(§5.7)·행사 안내판(§5.6) — 찾아가야 하는 자리라 지도에 표시한다 */
    gridcamp: '⛺', oldpost: '📪', festboard: '🎏',
    /* 다리(2026-09-09) — buildProps() 가 세우는 프롭(kind:'bridge')이
       하나뿐이라 hamlet/cave 처럼 따로 Spot() 을 부를 필요 없이 이 표
       한 줄로 끝난다 */
    bridge: '🌉',
    /* 폐허(2026-09-10, 퓨전 방향) — 사고(museum, 🏛️)와 헷갈리지 않게
       다른 이모지를 쓴다. 두 번째 캠프가 이 표에서 빠졌던 조용한 구멍
       (2026-09-09 항목)을 다시 겪지 않으려고 새 자리를 만들 때마다
       이 표부터 챙긴다 */
    ruinArch: '🏚️'
  };
  function viewMap() {
    var V = global.DG.village;
    var raw = V.raw();
    var TILE = V.TILE, W = V.W, H = V.H;
    var m = V.forestMargin();
    var minTx = -m, minTy = -m, maxTx = W + m, maxTy = H + m;
    var minX = minTx * TILE, minY = minTy * TILE;
    var vw = (maxTx - minTx) * TILE, vh = (maxTy - minTy) * TILE;

    var SAMPLE = 4;
    var svg = '<svg viewBox="' + minX + ' ' + minY + ' ' + vw + ' ' + vh + '" ' +
      'preserveAspectRatio="xMidYMid meet" class="mapsvg">';
    var tx, ty;
    for (ty = minTy; ty < maxTy; ty += SAMPLE) {
      for (tx = minTx; tx < maxTx; tx += SAMPLE) {
        var t = V.tileAt(tx, ty);
        var col = MAP_TILE_COLOR[t] || '#a7d488';
        svg += '<rect x="' + (tx * TILE) + '" y="' + (ty * TILE) + '" ' +
          'width="' + (SAMPLE * TILE) + '" height="' + (SAMPLE * TILE) + '" fill="' + col + '"/>';
      }
    }

    /* 강 — 호수에서 폭포까지 굽이치는 물길 (riverCenterX 를 그대로 따라간다) */
    var lake = V.lakeCenter(), wf = V.waterfallSpot();
    if (lake && wf) {
      var pts = '', ry;
      for (ry = lake.ty - lake.r; ry <= wf.ty; ry += 2) {
        var rx = V.riverCenterX(ry);
        if (rx === null) { continue; }
        pts += (rx * TILE) + ',' + (ry * TILE) + ' ';
      }
      if (pts) {
        svg += '<polyline points="' + pts + '" fill="none" stroke="#7ab8e0" ' +
          'stroke-width="' + (TILE * 1.4) + '" stroke-linecap="round"/>';
      }
    }

    /* 이름 붙은 자리 — 마을 건물 + 호수/폭포/작은마을/동굴 */
    var marks = [];
    var props = raw.props || [];
    for (var i = 0; i < props.length; i++) {
      var ic = MAP_PROP_ICON[props[i].kind];
      if (ic) { marks.push({ x: props[i].x, y: props[i].y, icon: ic }); }
    }
    if (lake) { marks.push({ x: lake.tx * TILE, y: lake.ty * TILE, icon: '🌊' }); }
    if (wf) { marks.push({ x: wf.tx * TILE, y: wf.ty * TILE, icon: '💦' }); }
    var hamlet = V.hamletSpot();
    if (hamlet) { marks.push({ x: hamlet.tx * TILE, y: hamlet.ty * TILE, icon: '🏘️' }); }
    /* 두 번째 캠프(2026-09-09) — hamletSpot()과 같은 방식으로 마크만 하나
       더 얹는다. 첫 캠프(🏘️)와 다른 아이콘(🏕️)으로 지도에서 구분되게 한다 */
    var hamlet2 = V.hamlet2Spot();
    if (hamlet2) { marks.push({ x: hamlet2.tx * TILE, y: hamlet2.ty * TILE, icon: '🏕️' }); }
    var cave = V.caveSpot();
    if (cave) { marks.push({ x: cave.tx * TILE, y: cave.ty * TILE, icon: '🕳️' }); }
    /* 폐허(2026-09-10, 퓨전 방향) — 위 넷과 같은 요령으로 마크 하나 더 */
    var ruin = V.ruinSpot();
    if (ruin) { marks.push({ x: ruin.tx * TILE, y: ruin.ty * TILE, icon: '🏚️' }); }
    /* 우주기지(§5.7 택배 목적지) — 처음부터 지도에 있는 고정 마을이다 */
    var sbase = V.spaceBaseSpot();
    if (sbase) { marks.push({ x: sbase.tx * TILE, y: sbase.ty * TILE, icon: '🚀' }); }
    /* 소포를 들고 있으면 가야 할 곳에 📦 (§5.7) */
    var PCm = global.DG.parcel, pst = PCm ? PCm.status() : null;
    if (pst && pst.carrying) {
      var pd = PCm.dests().filter(function (q) { return q.key === pst.dest; })[0];
      if (pd) {
        svg += '<circle cx="' + ((pd.tx + 0.5) * TILE) + '" cy="' + ((pd.ty + 0.5) * TILE) + '" r="' + (TILE * 2.2) +
          '" fill="none" stroke="#e6a23c" stroke-width="' + (TILE * 0.25) + '" stroke-dasharray="' + (TILE * 0.7) + ' ' + (TILE * 0.5) + '"/>';
        marks.push({ x: (pd.tx + 0.5) * TILE, y: (pd.ty + 0.5) * TILE - TILE * 2.6, icon: '📦' });
      }
    }
    /* 나그네가 일러 준 정령의 터(§5.5 ①) — 금빛 원 안 어딘가에 있다 */
    var GRm = global.DG.grid, hn = GRm ? GRm.hint() : null;
    if (hn) {
      svg += '<circle cx="' + hn.x + '" cy="' + hn.y + '" r="' + hn.r + '" fill="rgba(255,215,90,.22)" stroke="#ffd75a" stroke-width="' +
        (TILE * 0.25) + '"/>';
    }

    var fontSize = TILE * 1.1;
    for (i = 0; i < marks.length; i++) {
      svg += '<text x="' + marks[i].x + '" y="' + marks[i].y + '" ' +
        'font-size="' + fontSize + '" text-anchor="middle" dominant-baseline="central">' +
        marks[i].icon + '</text>';
    }

    /* 나 — 늘 맨 위에, 눈에 띄는 고리로 */
    if (raw.player) {
      var pr = TILE * 0.9;
      svg += '<circle cx="' + raw.player.x + '" cy="' + raw.player.y + '" r="' + pr +
        '" fill="#e6472e" stroke="#fff" stroke-width="' + (TILE * 0.18) + '"/>';
    }
    svg += '</svg>';

    var html = '<div class="sec"><div class="card" style="padding:8px">' + svg + '</div></div>';
    html += '<div class="sec"><h4>보는 법</h4><div class="card">' +
      '<small class="muted">' +
      '🔴 지금 내 자리 · 🏠 집 · 📮 편지함 · 🏪 전방 · 🧵 침선방 · 🪧 게시판 · ' +
      '🏛️ 사고(史庫) · 🚩 마을기 · 🌊 호수 · 💦 폭포 · 🏘️ 작은 마을 · 🏕️ 두 번째 캠프 · ' +
      '🌉 다리(강을 건너는 유일한 자리) · 🕳️ 동굴 · 🏚️ 폐허 · 🚀 우주기지 · ⛺ 나그네 야영(정령의 터 힌트를 판다) · ' +
      '📪 옛 우체통 · 🎏 행사 안내판 · 금빛 원 = 일러 준 정령의 터 · 점선 원 + 📦 = 소포를 가져갈 곳' +
      '</small><br><small class="muted">' +
      '땅빛은 실제 걸어본 굽은 마을을 그대로 위에서 펼친 것입니다 — ' +
      '풀빛·모래·물·바이옴(풀밭/그늘숲/버섯/돌밭)의 진짜 모양이 여기서만 한눈에 보입니다.' +
      '</small></div></div>';
    return html;
  }

  /** 오늘의 일과판(§5.1, 표준 A·H) — 게시판(🪧) 상호작용이 여는 마을(town) 시트
   *  맨 위에 얹는다. 셋 다 완료하고 이번 주 과제까지 마치면 연속(streak)이 는다. */
  function taskBoardSection() {
    var V = global.DG.village;
    if (!V || !V.taskList) { return ''; }
    var list = V.taskList(), w = V.weeklyTaskInfo();
    var s = V.state();
    var html = (global.DG.scenario ? global.DG.scenario.cardHtml() : '') + '<div class="sec"><h4>오늘의 일과 <small class="muted">' +
      (s.tasks ? (s.tasks.streak || 0) + '일째' : '') + '</small></h4>';
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      html += '<div class="card' + (t.done ? ' done' : '') + '">' +
        '<div class="stat-row"><span>' + esc(t.name) + '</span>' +
          '<b>' + (t.done ? '✓ 완료' : t.got + ' / ' + t.need) + '</b></div>' +
        (t.done ? '' : '<div class="bar sm"><i style="width:' + t.pct + '%"></i></div>') +
      '</div>';
    }
    if (w) {
      html += '<div class="card' + (w.done ? ' done' : '') + '"><div class="stat-row">' +
        '<span>🗓️ ' + esc(w.name) + '</span>' +
        '<b>' + (w.done ? '✓ 완료' : w.got + ' / ' + w.need) + '</b></div>' +
        (w.done ? '' : '<div class="bar sm"><i style="width:' + w.pct + '%"></i></div>') +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function viewTown() {
    var T = global.DG.town, V = global.DG.village, VD = global.DG.villageData;
    var stt = T.status(), VV = global.DG.villageView;
    var html = taskBoardSection(), i;

    html += '<div class="sec"><h4>마을</h4><div class="card">' +
      '<div class="flagrow">' +
        '<img class="flagimg" src="' + VV.flagIcon(96) + '" alt="마을 기">' +
        '<div class="flagmeta"><b>' + esc(stt.name) + '</b>' +
          '<small class="muted">' + esc(stt.bg.name) + ' 바탕에 ' +
            esc(stt.fg.name) + ' ' + esc(stt.sym.name) + '</small></div>' +
      '</div>' +
      '<button class="btn wide" data-act="v-townname">✏️ 마을 이름을 바꾼다</button>' +
      '</div></div>';

    /* 오늘 · 다음 행사 */
    html += '<div class="sec"><h4>오늘의 하늘</h4><div class="card">' +
      '<div class="stat-row"><span>날씨</span><b>' + stt.weather.icon + ' ' +
        esc(stt.weather.name) + '</b></div>' +
      '<small class="muted">' +
        (stt.weather.key === 'rain'
          ? '비 오는 날에만 나오는 것이 있습니다 — 🐌 달팽이 · 🪱 미꾸라지. ' +
            '대신 나는 벌레는 몸을 숨깁니다.'
          : stt.weather.key === 'snow' ? '눈이 내립니다.'
          : stt.weather.key === 'cloud' ? '해가 구름에 가렸습니다.'
          : '해와 달과 별이 다 보입니다.') +
      ' 날씨는 <b>날짜로 정해집니다</b> — 같은 날이면 같은 하늘입니다.</small></div></div>';

    html += '<div class="sec"><h4>행사</h4><div class="card">';
    if (stt.event) {
      html += '<div class="stat-row"><span>오늘</span><b>🎊 ' + esc(stt.event.name) + '</b></div>' +
        '<small class="muted">' + esc(stt.event.hello) + '. ' + esc(stt.event.desc) + '</small>';
    } else {
      html += '<div class="stat-row"><span>오늘</span><b>여느 날</b></div>';
    }
    if (stt.next) {
      html += '<div class="stat-row"><span>다음</span><b>' + esc(stt.next.event.name) +
        ' — ' + stt.next.left + '일 뒤</b></div>';
    }
    html += '<small class="muted">행사날에는 어떤 갈래가 비싸게 팔리고, ' +
      '밤하늘이나 나무가 달라집니다.</small></div>';
    html += '<div class="card"><div class="gearname">한 해의 행사</div><div class="bagtools">';
    for (i = 0; i < VD.EVENTS.length; i++) {
      var e = VD.EVENTS[i];
      var on = stt.event && stt.event.key === e.key;
      html += '<span class="chip' + (on ? ' on' : '') + '">' + e.m + '/' + e.d + ' ' +
        esc(e.name) + '</span>';
    }
    html += '</div></div></div>';

    /* 마을 기 고르기 */
    html += '<div class="sec"><h4>마을 기</h4>';
    [['bg', VD.FLAG_BGS, '바탕'], ['fg', VD.FLAG_FGS, '무늬색'], ['sym', VD.FLAG_SYMS, '무늬']]
      .forEach(function (e) {
        html += '<div class="card gearcard"><div class="gearname">' + e[2] + '</div>' +
          '<div class="bagtools">';
        for (var j = 0; j < e[1].length; j++) {
          var o = e[1][j], sel = stt.flag[e[0]] === o.key;
          var lockedSym = e[0] === 'sym' && global.DG.town.symLocked(o.key);
          var prev = VV.flagIconOf(
            e[0] === 'bg' ? o.key : stt.flag.bg,
            e[0] === 'fg' ? o.key : stt.flag.fg,
            e[0] === 'sym' ? o.key : stt.flag.sym, 34);
          html += '<button class="btn tiny flagpick' + (sel ? ' primary' : ' ghost') + '"' +
            (lockedSym ? ' disabled title="사고 네 갈래를 다 채우면 열립니다"' : '') +
            ' data-act="v-flag" data-kind="' + e[0] + '" data-id="' + o.key + '">' +
            '<img src="' + prev + '" alt="">' + (lockedSym ? '🔒 ' : '') + esc(o.name) + (sel ? ' ✔' : '') + '</button>';
        }
        html += '</div></div>';
      });
    html += '<small class="muted">깃대(🚩)에 걸립니다. 점을 찍어 그리는 대신 ' +
      '바탕·무늬색·무늬 셋을 고릅니다.</small></div>';

    /* 마을 평가 — 잡초를 뽑고 꽃을 심은 값. §5.8② — 별 5로 보여주고
       조건(잡초·꽃·심은 나무·집·사고)을 공개한다. */
    var bt = stt.beauty, sh = V.shopLevel();
    var warn = global.DG.town.beautyWarning ? global.DG.town.beautyWarning() : null;
    /* 숲의 정령(PLAN §5.5 ②) — 도감. 바이옴별로 묶어 보이고, 다음 씨앗 보상 한 줄 */
    if (global.DG.spirit) {
      var spi = global.DG.spirit.summary(), spHtml = '', gridSum = global.DG.grid ? global.DG.grid.summary() : null;
      Object.keys(spi.byBiome).forEach(function (bk) {
        var bb = spi.byBiome[bk];
        spHtml += '<div class="stat-row"><span>' + esc(bb.name) + '</span><b>✨ ' + bb.found + ' / ' + bb.total + '</b></div>';
      });
      html += '<div class="sec"><h4>숲의 정령</h4><div class="card">' +
        '<div class="stat-row"><span>만난 정령</span><b>' + spi.found + ' / ' + spi.total + '</b></div>' +
        '<div class="stat-row"><span>🌱 씨앗</span><b>' + spi.seeds + '개' +
          (spi.next ? ' (다음 보상 ' + spi.next.at + '개)' : ' (모두 모았다)') + '</b></div>' +
        spHtml +
        (gridSum ? '<div class="stat-row"><span>🗺️ 숲의 만남</span><b>' + gridSum.cells + '곳 (연 것 ' + gridSum.opened + ')</b></div>' +
          '<small class="muted">🧰 상자 ' + gridSum.byKind.chest + ' · 🍾 쪽지 병 ' + gridSum.byKind.bottle + ' · 💎 채집터 ' + gridSum.byKind.node +
          ' · 🦌 짐승 무리 ' + gridSum.byKind.herd + ' · ⛺ 나그네 야영 ' + gridSum.byKind.camp +
          (gridSum.hint ? ' — 금빛 원을 미니맵에서 찾아 보세요' : ' — 야영의 나그네는 🪙 으로 가까운 정령의 터를 알려 줍니다') + '</small>' : '') +
        '<small class="muted">숲 고리에 ✨ 정령의 터가 숨어 있습니다. 가까이 가서 손을 쓰면 무엇을 해야 하는지 알려 줍니다.</small>' +
        '</div></div>';
    }

    html += '<div class="sec"><h4>마을 평가</h4><div class="card">' +
      '<div class="stat-row"><span>' + esc(bt.grade) + '</span><b>' +
        '★'.repeat(bt.stars) + '☆'.repeat(5 - bt.stars) + ' · ' + bt.score + '점</b></div>' +
      '<div class="stat-row"><span>잡초</span><b>🌿 ' + bt.weeds + '포기 (-' + bt.weeds * 3 + ')</b></div>' +
      '<div class="stat-row"><span>꽃</span><b>🌸 ' + bt.flowers + '송이</b></div>' +
      '<div class="stat-row"><span>심어 둔 것</span><b>🌱 ' + bt.planted + '</b></div>' +
      '<div class="stat-row"><span>집 꾸미기</span><b>🏠 +' + Math.round(bt.home / 4) + '</b></div>' +
      '<div class="stat-row"><span>사고 기증</span><b>🏛️ +' + bt.museum * 2 + '</b></div>' +
      (bt.guests ? '<div class="stat-row"><span>이웃 손님</span><b>🏡 +' + bt.guests + '</b></div>' : '') +
      (warn ? '<small class="muted" style="color:var(--bad,#c0392b)">⚠ ' + esc(warn.text) + '</small>'
            : '<small class="muted">잡초는 <b>안 뽑으면 날마다 늡니다</b>. ' +
              '평가가 높으면 주민이 잘 떠나지 않습니다. 평가서는 월요일 아침에 옵니다.</small>') +
      /* §5.3 "4개 완성 시 마을 평가 상한 해제"(2026-09-18) — 상한에 막혀
         있을 때만 보인다. 이미 네 갈래를 다 채웠으면(bundlesFull) 조용히
         빠진다 — 더 알릴 것이 없다. */
      (bt.capped ? '<small class="muted">🏛️ 사고 네 갈래(곤충·물고기·화석·조개)를 다 채우면 ' +
              '최고 등급까지 오를 수 있습니다.</small>' : '') +
      '</div></div>';

    /* 전방 */
    html += '<div class="sec"><h4>전방</h4><div class="card">' +
      '<div class="stat-row"><span>지금</span><b>🏪 ' + esc(sh.name) + '</b></div>' +
      '<div class="stat-row"><span>판 금 누계</span><b>🪙 ' + core.fmt(sh.sold) + '</b></div>' +
      '<div class="stat-row"><span>값 웃돈</span><b>+' +
        Math.round((sh.bonus - 1) * 100) + '%</b></div>' +
      (sh.next
        ? '<div class="stat-row"><span>다음</span><b>' + esc(sh.next.name) + ' — 🪙 ' +
            core.fmt(sh.next.at - sh.sold) + ' 더</b></div>'
        : '<small class="muted">더 커질 수 없습니다.</small>') +
      '<small class="muted">전방에 판 금이 쌓이면 커집니다. 커지면 ' +
      '<b>가구가 더 들어오고 값을 더 쳐줍니다.</b></small></div></div>';

    /* 마을 현황 */
    var mu = global.DG.museum.count();
    var hm = global.DG.home.status();
    var raw = V.raw();
    html += '<div class="sec"><h4>마을 현황</h4><div class="card">' +
      '<div class="stat-row"><span>주민</span><b>🏡 ' + raw.residents.length + '명</b></div>' +
      '<div class="stat-row"><span>사고</span><b>🏛️ ' + esc(global.DG.museum.grade().name) +
        ' · ' + mu.done + '/' + mu.total + '</b></div>' +
      '<div class="stat-row"><span>내 집</span><b>🏠 ' + esc(hm.grade) + ' · ' + hm.score + '점</b></div>' +
      '<div class="stat-row"><span>심어 둔 것</span><b>🌱 ' + V.status().planted + '</b></div>' +
      '<div class="stat-row"><span>내 차림</span><b>🧵 ' +
        esc(global.DG.wear.status().name) + '</b></div>' +
      '</div></div>';
    return html;
  }

  /* ── 침선방 (옷) ──────────────────────────────────────────
   * 원작의 재봉실이다. 사면 옷장에 남고, 옷장에 있는 것만 입는다.
   * 날마다 바뀌는 진열은 두지 않았다 — 옷은 취향이라 "오늘 것" 으로 막으면 답답하다.
   */
  /** 택배 접수대(PLAN §5.7) — 소포 셋 중 하나를 고른다. 셋은 종류(안전·깨지기·시간제한)와 목적지가 다 다르다 */
  function viewParcel() {
    var PC = global.DG.parcel, VDd = global.DG.villageData, stt = PC.status(), html = '', i;
    html += '<div class="sec"><h4>배달 기록</h4><div class="card">' +
      '<div class="stat-row"><span>누적 배달</span><b>📦 ' + stt.n + '건</b></div>' +
      '<div class="stat-row"><span>연속 (깨지거나 늦으면 끊김)</span><b>🔗 ' + stt.chain + '건' +
        (stt.chain + 1 >= PC.CHAIN_AT ? ' — 다음 배달 ×' + PC.CHAIN_MUL : ' (' + PC.CHAIN_AT + '건째부터 ×' + PC.CHAIN_MUL + ')') + '</b></div>' +
      '<div class="stat-row"><span>등급</span><b>🎖️ ' + (stt.grade ? esc(VDd.DELIVERY_GRADES[stt.grade - 1].name) : '견습') + '</b></div>' +
      (stt.next ? '<small class="muted">다음 등급 「' + esc(stt.next.name) + '」까지 ' + (stt.next.at - stt.n) + '건 — ' + esc(stt.next.note) + '</small>'
                : '<small class="muted">배달 등급을 모두 채웠습니다.</small>') +
      '</div></div>';
    if (stt.carrying) {
      var pk = VDd.PARCEL_KINDS[stt.kind];
      html += '<div class="sec"><h4>지금 들고 있는 소포</h4><div class="card">' +
        '<div class="gearname">' + pk.emoji + ' ' + esc(pk.name) + ' → ' + esc(stt.destName) + '</div>' +
        '<small class="muted">' + (stt.broken ? '🥚 깨졌습니다 — 보상이 절반이 됩니다. ' : '') + esc(pk.note) + '</small></div></div>';
      return html;
    }
    var offers = PC.offers();
    html += '<div class="sec"><h4>소포 고르기</h4>';
    for (i = 0; i < offers.length; i++) {
      var o = offers[i], k = VDd.PARCEL_KINDS[o.kind], dd = VDd.DELIVERY_DESTS[o.dest];
      html += '<div class="card gearcard"><div class="gearname">' + k.emoji + ' ' + esc(k.name) + ' → ' + dd.emoji + ' ' + esc(o.destName) + '</div>' +
        '<small class="muted">' + esc(k.note) + (o.limit ? ' · 시한 ' + o.limit + '초' : '') + ' · 거리 ' + o.dist + '칸</small>' +
        '<div class="bagtools"><button class="btn tiny primary" data-act="v-parcel" data-kind="' + o.kind + '" data-dest="' + o.dest +
        '">받는다 (🪙 ' + core.fmt(o.reward) + ')</button></div></div>';
    }
    return html + '</div>';
  }

  /** 상단에 "소포 → 어디" 한 줄 — 들고 있을 때만 */
  function parcelChip() {
    var PC = global.DG.parcel;
    if (!PC) { return ''; }
    var p = PC.status();
    if (!p.carrying) { return ''; }
    var t = '';
    if (p.deadline) { var d = new Date(p.deadline); t = ' ⏱️' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '까지'; }
    return (p.broken ? '🥚 깨짐' : '📦 소포') + ' → ' + esc(p.destName) + t + ' · ';
  }

  function viewWear() {
    var W2 = global.DG.wear, stt = W2.status();
    var html = '', i, j;

    html += '<div class="sec"><h4>지금 차림</h4><div class="card">' +
      '<div class="stat-row"><span>입은 것</span><b>🧵 ' + esc(stt.name) + '</b></div>' +
      '<small class="muted">고른 것은 마을을 걷는 <b>내 모습</b>에 그대로 나타납니다. ' +
      '도감의 인물 그림은 그대로입니다 — 옷은 내 것이지 그 사람의 것이 아니니까요.' +
      '</small></div></div>';

    for (i = 0; i < stt.parts.length; i++) {
      var p = stt.parts[i];
      html += '<div class="sec"><h4>' + esc(p.part.name) + '</h4>';
      for (j = 0; j < p.list.length; j++) {
        var e = p.list[j];
        html += '<div class="card gearcard' + (e.on ? ' hi' : '') + '">' +
          '<div class="gearname">' +
            (e.it.c ? '<span class="swatch" style="background:' + e.it.c + '"></span>' : ico('wear', e.it.key, 24, '🧵') + ' ') +
            esc(e.it.name) + gradeTag('goods', e.it.price) +
            (e.on ? ' <small class="muted">— 입고 있음</small>' : '') + '</div>' +
          '<div class="bagtools">' +
            (e.own
              ? (e.on
                  ? '<button class="btn tiny ghost" disabled>입고 있음</button>'
                  : '<button class="btn tiny primary" data-act="v-wset" data-kind="' +
                    p.part.key + '" data-id="' + e.it.key + '">입는다</button>')
              : (e.it.unlock
                  ? '<button class="btn tiny ghost" disabled>🔒 배달 ' + e.it.at + '건</button>'
                  : '<button class="btn tiny" data-act="v-wbuy" data-kind="' + p.part.key +
                    '" data-id="' + e.it.key + '">짓는다 (🪙 ' + core.fmt(e.it.price) + ')</button>')) +
          '</div></div>';
      }
      html += '</div>';
    }
    return html;
  }

  /* ── 사고(史庫) ───────────────────────────────────────────
   * 원작의 박물관. **도감과 다른 것**이라는 게 눈에 보여야 한다 —
   * 도감은 잡아 본 것이고, 사고는 가방에서 한 점을 실제로 내어 놓은 것이다.
   * 그래서 기증은 사고 **앞에서만** 받는다.
   */
  function viewMuseum() {
    var M = global.DG.museum, VD = global.DG.villageData, V = global.DG.village;
    var stt = M.status(), html = '', i, j;

    html += '<div class="sec"><h4>사고</h4><div class="card">' +
      '<div class="stat-row"><span>등급</span><b>' + esc(stt.grade) + '</b></div>' +
      '<div class="stat-row"><span>들인 것</span><b>🏛️ ' + stt.done + ' / ' + stt.total + '종</b></div>' +
      '<small class="muted">' +
        (stt.near ? '지금 사고 앞입니다 — 아래에서 들일 수 있습니다.'
                  : '기증은 <b>사고(🏛️) 앞에서만</b> 받습니다. 마을 가운데 왼쪽에 있습니다.') +
      ' 들인 것은 가방에서 한 점이 빠집니다. 대신 <b>명성</b>이 오릅니다.</small></div></div>';

    /* 지금 들일 수 있는 것 */
    html += '<div class="sec"><h4>들일 수 있는 것</h4>';
    if (!stt.offer.length) {
      html += '<div class="hint">가방에 아직 사고에 없는 것이 없습니다 — ' +
        '곤충🦋 · 물고기🐟 · 화석🦴 · 조개🐚 를 모아 오세요.</div>';
    } else {
      for (i = 0; i < stt.offer.length; i++) {
        var e = stt.offer[i];
        html += '<div class="card gearcard">' +
          '<div class="gearname">' + ico('material', e.item.key, 24, e.item.emoji) + ' ' + esc(e.item.name) +
            ' <small class="muted">×' + e.n + ' · 🎖️ +' +
            (20 + Math.floor(e.item.price / 10)) + '</small></div>' +
          '<div class="bagtools">' +
            '<button class="btn tiny ' + (stt.near ? 'primary' : 'ghost') + '"' +
              (stt.near ? '' : ' disabled') +
              ' data-act="v-donate" data-id="' + e.item.key + '">🏛️ 들인다</button>' +
          '</div></div>';
      }
    }
    html += '</div>';

    /* 전시실 — 갈래를 다 채우면 마을에 시설이 서는 번들(PLAN §5.3, 2026-09-17) */
    var bundles = VD.BUNDLES || {};
    for (i = 0; i < stt.cats.length; i++) {
      var c = stt.cats[i], rows = '', bd = bundles[c.cat.key];
      var bundleDone = bd && c.total > 0 && c.done >= c.total;
      for (j = 0; j < c.all.length; j++) {
        var it = c.all[j];
        var has = M.donated(it.key);
        rows += '<span class="biocell' + (has ? '' : ' off') + '" title="' +
          esc(it.name) + (has ? ' — 사고에 있음' : ' — 아직') + '">' +
          (has ? ico('material', it.key, 26, it.emoji) : '❔') + '</span>';
      }
      html += '<div class="sec"><h4>' + c.cat.icon + ' ' + c.cat.name + '</h4>' +
        dexBar(c.done, c.total) + '<div class="biogrid">' + rows + '</div>' +
        (bd ? '<small class="muted">' + (bundleDone ? '✓ 다 채웠습니다 — 마을에 시설이 섰습니다'
                                                     : '다 채우면 마을에 시설이 하나 섭니다') + '</small>' : '') +
        '</div>';
    }
    return html;
  }

  /* ── 도감 ─────────────────────────────────────────────── */


  function viewDex() {
    var hC = Object.keys(core.save.dex.heroes).length;
    var pC = Object.keys(core.save.dex.pets).length;
    return '<div class="sec"><h4>인물</h4>' + dexBar(hC, data.heroes.length) +
             dexGrid(data.heroes, core.save.dex.heroes) + '</div>' +
           '<div class="sec"><h4>펫</h4>' + dexBar(pC, data.pets.length) +
             dexGrid(data.pets, core.save.dex.pets) + '</div>' +
           bioDex() +
           '<div class="hint">카드를 누르면 열전·승급·펫 장착 화면이 열립니다. ' +
           '같은 인물을 또 등용하면 <b>중복(+n)</b>이 쌓여 승급 재료가 됩니다.</div>';
  }

  /* ── 채집 도감 ────────────────────────────────────────────
   * 한 번이라도 손에 넣은 것은 여기 남는다 — **팔아도 지워지지 않는다**.
   * 곤충과 물고기는 계절·시간대를 타므로, 다 채우려면 일 년을 돌아야 한다.
   * 원작의 박물관이 하던 일을 이 한 절이 대신한다.
   */
  function bioDex() {
    var V = global.DG.village, VD = global.DG.villageData;
    var cats = [{ key: 'bug', name: '곤충', icon: '🦋' },
                { key: 'fish', name: '물고기', icon: '🐟' }];
    var html = '', c, i;
    for (c = 0; c < cats.length; c++) {
      var all = VD.ITEMS[cats[c].key], got = 0, rows = '';
      for (i = 0; i < all.length; i++) {
        var n = V.caughtCount(all[i].key);
        if (n) { got++; }
        rows += '<span class="biocell' + (n ? '' : ' off') + '" title="' +
          esc(all[i].name) + (n ? ' ×' + n : ' — 아직') + '">' +
          (n ? all[i].emoji : '❔') + '</span>';
      }
      html += '<div class="sec"><h4>' + cats[c].icon + ' ' + cats[c].name + '</h4>' +
        dexBar(got, all.length) + '<div class="biogrid">' + rows + '</div></div>';
    }
    var mu = global.DG.museum.count();
    html += '<div class="sec"><div class="card">' +
      '<div class="stat-row"><span>사고에 들인 것</span><b>🏛️ ' + mu.done + ' / ' + mu.total + '종</b></div>' +
      '<button class="btn wide" data-act="v-museum">🏛️ 사고를 열어 본다</button>' +
      '<small class="muted">도감은 <b>잡아 본 것</b>이고 사고는 <b>들여 놓은 것</b>입니다 — ' +
      '다른 자리입니다.</small></div></div>';
    return html;
  }

  function dexBar(n, total) {
    return '<div class="dexbar"><div class="bar"><i style="width:' + (n / total * 100) + '%"></i></div>' +
      '<small>' + n + ' / ' + total + '</small></div>';
  }

  function dexGrid(list, owned) {
    var out = '<div class="dexgrid">';
    var sorted = list.slice().sort(function (a, b) {
      return b.rarity - a.rarity || a.name.localeCompare(b.name, 'ko');
    });
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i], have = !!owned[e.id], rar = data.rarity[e.rarity];
      var kind = e.stats ? 'hero' : 'pet';
      var dup = have ? owned[e.id].count - 1 : 0;
      out += '<button class="dcell' + (have ? '' : ' locked') + '" style="border-color:' +
        (have ? rar.color : 'transparent') + '" title="' +
        esc(e.name + ' · ' + rar.name + (have ? (dup ? ' · 중복 ' + dup : '') : ' (미획득)')) + '"' +
        ' data-act="detail" data-kind="' + kind + '" data-id="' + e.id + '">' +
        (have ? '<span class="de">' + pt(kind, e, 52) + '</span>'
              : '<span class="de locked-mark">❔</span>') +
        '<small>' + (have ? esc(e.name) : '???') + '</small>' +
        (dup > 0 ? '<i class="cnt">+' + dup + '</i>' : '') + '</button>';
    }
    return out + '</div>';
  }

  /* ── 기록 ─────────────────────────────────────────────── */

  function viewLog() {
    var log = core.save.log;
    if (!log.length) { return '<div class="hint">아직 기록이 없습니다.</div>'; }
    var out = '<div class="loglist">';
    for (var i = 0; i < log.length; i++) {
      var t = new Date(log[i].t);
      var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      out += '<div class="lrow ' + log[i].kind + '"><span>' + hh + '</span>' + esc(log[i].text) + '</div>';
    }
    return out + '</div>';
  }

  /* ── 사관 (온라인 모드) ───────────────────────────────── */


  /* ── 자동 순행 ────────────────────────────────────────────
   * 사관 시트에 뒀지만 **오프라인에서도 그대로 돈다** — 판단은 규칙이고,
   * AI(사관)를 쓰는 건 '길조 유지' 하나뿐이다. 그 점을 화면에 적어 둔다.
   */
  function sectionAuto() {
    var A = global.DG.auto;
    var stt = A.status();
    var html = '<div class="sec"><h4>자동 순행</h4><div class="card">' +
      '<button class="btn wide ' + (stt.on ? 'primary' : '') + '" data-act="auto-on">' +
        (stt.on ? '⏸️ 자동 순행 멈춤' : '🤖 자동 순행 시작') + '</button>';
    if (stt.on) {
      html += '<div class="stat-row"><span>지금</span><b>' + esc(stt.doing || '…') + '</b></div>';
    }
    html += '<div class="autoflags">';
    for (var i = 0; i < A.FLAGS.length; i++) {
      var f = A.FLAGS[i];
      var onf = A.on(f.key);
      html += '<button class="btn tiny ' + (onf ? 'primary' : 'ghost') + '" ' +
        'data-act="auto-flag" data-flag="' + f.key + '" title="' + esc(f.desc) + '">' +
        f.emoji + ' ' + f.name + '</button>';
    }
    html += '</div>' +
      '<small class="muted">마을 규칙은 <b>손으로 할 때와 같습니다</b> — ' +
      '자동은 어디로 갈지(아직 여문 사물·부탁을 채운 주민)만 고릅니다.<br>' +
      '<b>새 문답은 대신 풀지 않습니다</b> (익힌 문제 복습만).<br>' +
      '창을 보고 있는 동안에만 돕니다 — 덮어 두면 멈춥니다.</small>' +
      '</div></div>';
    return html;
  }


  /* ── 인물 · 펫 상세 ───────────────────────────────────────
   * 도감 카드에서 열린다. 능력치는 hero.breakdown() 이 계산해 준 값만 보여준다.
   */

  function detailHost() {
    var el = $('detail');
    if (!el) {                       // 자가진단 페이지처럼 뼈대가 없는 곳에서도 동작하게
      el = document.createElement('div');
      el.id = 'detail';
      document.body.appendChild(el);
      els.detail = el;
    }
    return el;
  }

  function openDetail(kind, id) {
    if (!id) { return; }
    openDetailRef = { kind: kind, id: id };
    renderDetail();
    detailHost().classList.add('show');
  }

  function closeDetail() {
    openDetailRef = null;
    var el = detailHost();
    el.classList.remove('show');
    el.innerHTML = '';
  }

  function rankStars(rank) {
    if (!rank) { return ''; }
    var out = ' ';
    for (var i = 0; i < rank; i++) { out += '✦'; }
    return out;
  }

  function statRow(label, base, grown, fin, cap) {
    var pct = core.clamp(fin / cap, 0, 1) * 100;
    var extra = fin - base;
    return '<div class="st">' +
      '<span class="st-l">' + label + '</span>' +
      '<span class="stbar"><i style="width:' + pct + '%"></i>' +
        (grown > base ? '<u style="width:' + (core.clamp(base / cap, 0, 1) * 100) + '%"></u>' : '') +
      '</span>' +
      '<b class="st-v">' + fin + (extra > 0 ? '<em>+' + extra + '</em>' : '') + '</b>' +
    '</div>';
  }

  function renderDetail() {
    if (!openDetailRef) { return; }
    var host = detailHost();
    var ref = data.find(openDetailRef.id);
    if (!ref) { closeDetail(); return; }
    host.innerHTML = openDetailRef.kind === 'pet' ? detailPet(ref) : detailHero(ref);
  }

  function detailHero(h) {
    var owned = !!core.save.dex.heroes[h.id];
    var rar = data.rarity[h.rarity];
    var fac = data.faction(h.faction);
    var g = hero().info(h.id);
    var bk = hero().breakdown(h.id);
    var need = hero().expNeed(g.lv);
    var maxLv = g.lv >= hero().MAX_LV;
    var inParty = core.save.party.indexOf(h.id) >= 0;
    var chk = hero().rankUpCheck(h.id);
    var cost = chk.cost || hero().rankUpCost(g.rank);

    var p3h = p3src('hero', h, 150, 172, function () { return global.DG.sprite.portraitCard('hero', h, 150, 172); });
    var out = '<div class="dt-card">' +
      '<button class="icon-btn sm dt-x" data-act="dt-close">✕</button>' +
      '<div class="dt-top">' +
        '<img class="dt-portrait" alt=""' + p3tag('hero', h, 150, 172) + p3h.done + ' src="' +
          p3h.src + '">' +
        '<div class="dt-head">' +
          '<div class="dt-name"><b>' + esc(h.name) + '</b>' +
            (h.hanja ? '<span class="hanja">' + esc(h.hanja) + '</span>' : '') + '</div>' +
          '<div class="dt-tags">' +
            '<span class="tag fac" style="background:' + fac.color + '">' + fac.mark + ' ' + esc(h.faction) + '</span>' +
            '<span class="tag">' + esc(h.era) + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + '</span>' +
            '<span class="tag">' + data.traitMark[h.trait] + '</span>' +
          '</div>';

    if (owned) {
      out += '<div class="dt-lv">Lv.<b>' + g.lv + '</b>' +
        (maxLv ? ' <span class="tag">최대</span>' : '') +
        (g.rank ? ' <span class="rankmark">승급 ' + rankStars(g.rank).trim() + '</span>' : '') +
        '</div>' +
        '<div class="bar sm"><i style="width:' + (maxLv ? 100 : g.exp / need * 100) + '%"></i></div>' +
        '<small class="muted">' + (maxLv ? '더 오를 곳이 없습니다' : '경험치 ' + g.exp + ' / ' + need) +
          ' · 성장 배율 ×' + bk.mul.toFixed(2) + '</small>' +
        '<div class="dt-where">' + (inParty ? '🧭 동행 중' : '🏠 집에서 대기 중') + '</div>';
    } else {
      out += '<div class="dt-lv muted">아직 등용하지 않은 인물입니다</div>';
    }
    out += '</div></div>';

    if (owned) {
      var cap = 200;      // 능력치 바의 만점 기준 (Lv.30 ★5 까지 자랄 자리를 남긴다)
      out += '<div class="dt-stats">' +
        statRow('무력', bk.base.might, bk.grown.might, bk.final.might, cap) +
        statRow('지력', bk.base.wisdom, bk.grown.wisdom, bk.final.wisdom, cap) +
        statRow('통솔', bk.base.command, bk.grown.command, bk.final.command, cap) +
        '</div>' +
        '<div class="dt-line"><span>인물 됨됨이</span><b>' + core.fmt(hero().power(h.id)) + '</b></div>';

      out += '<div class="dt-pet"><span>🐾 펫</span>' +
        '<select data-equip="' + h.id + '">' + petOptions(h.id) + '</select>' +
        (bk.pet ? '<small class="muted">' + esc(bk.pet.name) + ' · ' +
          statKor(bk.pet.bonus.stat) + ' +' + bk.pet.bonus.value + '</small>'
                : '<small class="muted">장착하면 능력치가 더해집니다</small>') +
        '</div>';
    }

    var bio = data.bio(h.id);
    if (owned) {
      if (bio) { out += '<p class="dt-bio">' + esc(bio) + '</p>'; }
      out += '<p class="quote">"' + esc(h.quote) + '"</p>';
    } else {
      out += '<p class="dt-bio muted">등용하면 열전이 열립니다.</p>';
    }

    if (owned) {
      out += '<div class="dt-acts">';
      if (g.rank >= hero().MAX_RANK) {
        out += '<button class="btn ghost wide" disabled>✨ 최대 승급 (★' + g.rank + ')</button>';
      } else {
        out += '<button class="btn ' + (chk.ok ? 'primary' : 'ghost') + ' wide"' +
          (chk.ok ? '' : ' disabled') + ' data-act="rankup" data-id="' + h.id + '">' +
          '✨ 승급 ★' + (g.rank + 1) + ' · 중복 ' + hero().dupOf(h.id) + '/' + cost.dup +
          ' · 🪙 ' + core.fmt(cost.gold) + '</button>';
      }
      if (net().online()) {
        out += '<button class="btn wide" data-act="dt-talk" data-id="' + h.id + '">💬 말을 건다 (사관)</button>';
      }
      out += (inParty
        ? '<button class="btn ghost wide" data-act="drop" data-id="' + h.id + '">동행에서 뺀다</button>'
        : '<button class="btn wide"' + (core.save.party.length >= 5 ? ' disabled' : '') +
          ' data-act="join" data-id="' + h.id + '">동행에 넣는다' +
          (core.save.party.length >= 5 ? ' (가득 찼음)' : '') + '</button>');
      out += '</div>' +
        '<small class="muted dt-tip">이 마을 주민은 부탁을 들어줄수록 친밀도가 오릅니다. ' +
        '승급은 <b>중복분</b>과 금을 씁니다.</small>';
    }

    return out + '</div>';
  }

  function petOptions(heroId) {
    var owned = Object.keys(core.save.dex.pets);
    var equipped = core.save.petEquip[heroId] || '';
    var used = {}, k;
    for (k in core.save.petEquip) {
      if (Object.prototype.hasOwnProperty.call(core.save.petEquip, k) && k !== heroId) {
        used[core.save.petEquip[k]] = true;
      }
    }
    var out = '<option value="">— 펫 없음 —</option>';
    for (var i = 0; i < owned.length; i++) {
      var p = data.find(owned[i]);
      if (!p || used[p.id]) { continue; }
      out += '<option value="' + p.id + '"' + (equipped === p.id ? ' selected' : '') + '>' +
        p.emoji + ' ' + p.name + ' (' + statKor(p.bonus.stat) + ' +' + p.bonus.value + ')</option>';
    }
    return out;
  }

  function statKor(s) { return ({ might: '무력', wisdom: '지력', command: '통솔', virtue: '덕망' })[s] || s; }

  function detailPet(p) {
    var d = core.save.dex.pets[p.id];
    var owned = !!d;
    var rar = data.rarity[p.rarity];
    var wearer = null, k;
    for (k in core.save.petEquip) {
      if (Object.prototype.hasOwnProperty.call(core.save.petEquip, k) &&
          core.save.petEquip[k] === p.id) { wearer = data.find(k); }
    }
    var p3p = p3src('pet', p, 150, 172, function () { return global.DG.sprite.portraitCard('pet', p, 150, 172); });
    return '<div class="dt-card">' +
      '<button class="icon-btn sm dt-x" data-act="dt-close">✕</button>' +
      '<div class="dt-top">' +
        '<img class="dt-portrait" alt=""' + p3tag('pet', p, 150, 172) + p3p.done + ' src="' +
          p3p.src + '">' +
        '<div class="dt-head">' +
          '<div class="dt-name"><b>' + esc(p.name) + '</b></div>' +
          '<div class="dt-tags">' +
            '<span class="tag fac" style="background:' + (p.kind === 'divine' ? '#8a5cc0' : '#5f7a4a') + '">' +
              (p.kind === 'divine' ? '神 신수' : '獸 동물') + '</span>' +
            '<span class="tag" style="color:' + rar.color + '">' + rar.name + ' ' + rar.label + '</span>' +
          '</div>' +
          '<div class="dt-lv">' + (owned
            ? '보유 ' + d.count + '마리' + (wearer ? ' · ' + esc(wearer.name) + ' 장착 중' : ' · 장착 안 됨')
            : '<span class="muted">아직 포획하지 않았습니다</span>') + '</div>' +
          '<small class="muted">기본 포획률 ' + Math.round(p.catchBase * 100) + '%</small>' +
        '</div>' +
      '</div>' +
      '<div class="dt-line"><span>장착 보정</span><b>' + statKor(p.bonus.stat) + ' +' + p.bonus.value + '</b></div>' +
      '<p class="dt-bio">' + esc(p.desc || '') + '</p>' +
      '<small class="muted dt-tip">펫은 인물에게 하나씩 장착합니다. 인물 상세 화면에서 고르세요.</small>' +
      '</div>';
  }

  /* ── 토스트 ───────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2600);
  }

  /**
   * 하루 마무리 카드(§5.2, 표준 B) — 자정 넘겨 첫 부팅(=`rollDay()`가 실제로 돈
   * 뒤) 딱 한 번 뜬다. `#encounter`(이 판에선 안 쓰던 자리)를 빌려 쓴다.
   * 8초 뒤 저절로 닫히거나 눌러서 닫는다 — 닫히면 `dayLogSeen()`으로 다시 안 뜨게 한다.
   */
  var dayCardTimer = null;
  function showDayCard(info) {
    var el = $('encounter');
    if (!el) { return; }
    var ratingUp = info.ratingAfter - info.ratingBefore;
    var metLine = info.metId && global.DG.data ? global.DG.data.find(info.metId) : null;
    var warn = global.DG.town && global.DG.town.beautyWarning ? global.DG.town.beautyWarning() : null;
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 6px;font-size:17px">🌙 어제 하루</h3>' +
        '<div class="stat-row"><span>채집</span><b>' + core.fmt(info.gathered) + '</b></div>' +
        '<div class="stat-row"><span>금</span><b>🪙 ' + (info.gold >= 0 ? '+' : '') + core.fmt(info.gold) + '</b></div>' +
        (info.donated ? '<div class="stat-row"><span>기증</span><b>' + info.donated + '</b></div>' : '') +
        '<div class="stat-row"><span>마을 평가</span><b>' + (ratingUp >= 0 ? '+' : '') + ratingUp + '</b></div>' +
        (metLine ? '<div class="stat-row"><span>가장 가까워진 사람</span><b>' + esc(metLine.name) + '</b></div>' : '') +
        (warn ? '<div class="p-goal" style="margin-top:8px;color:var(--bad,#c0392b)">⚠ ' + esc(warn.text) + '</div>' : '') +
        (info.next ? '<div class="p-goal" style="margin-top:8px">오늘 · 🎯 ' + esc(info.next) + '</div>' : '') +
        '<button class="btn primary wide" id="daylog-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var close = function () {
      el.classList.remove('show'); el.innerHTML = '';
      if (dayCardTimer) { clearTimeout(dayCardTimer); dayCardTimer = null; }
    };
    var btn = $('daylog-ok');
    if (btn) { btn.addEventListener('click', close); }
    if (dayCardTimer) { clearTimeout(dayCardTimer); }
    dayCardTimer = setTimeout(close, 8000);
    global.DG.village.dayLogSeen();
  }

  function checkDayCard() {
    var V = global.DG.village;
    if (!V || !V.dayLogPending || !V.dayLogPending()) { return; }
    showDayCard(V.dayLogInfo());
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderFocus();
    renderAutoBar();
    checkDayCard();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    /* 공사 시트는 **선 칸을 가운데로 한 3×3** 을 보여 준다 — 걸어가면 따라와야 한다.
       안 그러면 화면에 그린 칸과 실제로 고쳐지는 칸이 어긋난다 */
    if (openTab === 'bag' || openTab === 'folks' || openTab === 'build') { renderSheet(); }
  }

  /* ── 자동 순행 상태줄 ─────────────────────────────────── */

  var autoKey = null;
  function renderAutoBar() {
    var bar = els.autobar;
    if (!bar) { return; }
    var A = global.DG.auto;
    if (!A || !A.active()) {
      if (autoKey !== null) { bar.classList.remove('show'); bar.innerHTML = ''; autoKey = null; }
      return;
    }
    var stt = A.status();
    var key = stt.doing;
    if (key !== autoKey) {
      autoKey = key;
      bar.innerHTML = '<div class="auto-card"><b>🤖 자동 순행</b>' +
        '<span>' + esc(stt.doing || '…') + '</span>' +
        '<button class="btn tiny ghost" data-act="auto-stop">멈춤</button></div>';
    }
    bar.classList.add('show');
  }

  global.DG = global.DG || {};
  global.DG.ui = {
    init: init, toast: toast, tickRefresh: tickRefresh,
    openSheet: openSheet, closeSheet: closeSheet,
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop, renderFocus: renderFocus,
    doInteract: doInteract
  };
})(window);
