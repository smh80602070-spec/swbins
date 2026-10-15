/**
 * 3마을 마을 시트(게시판 · 깃대 — 마을 이름·기·오늘과 다음 행사·과제 판)와 전체지도 — ui.js 에서 떼어 냄(R-4, 줄 수 상한).
 * ---------------------------------------------------------------
 * ui.js 가 `setup({ esc })` 로 손잡이를 넘기고 같은 이름(viewTown·viewMap)으로 부른다. 나머지는 DG.* 에서 바로 읽는다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var data = global.DG.data;
  var esc;
  var api = null;
  function setup(h) { esc = h.esc; return api; }

  /* 원작의 게시판 자리다. 마을 이름과 마을 기, 그리고 오늘·다음 행사가 여기 붙는다.
     게시판이 여태 주민 시트를 열고 있었는데, 이제 제 몫이 생겼다. */
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

  api = { setup: setup, viewTown: viewTown, viewMap: viewMap };
  global.DG = global.DG || {};
  global.DG.uiTown = api;
})(typeof window !== 'undefined' ? window : this);
