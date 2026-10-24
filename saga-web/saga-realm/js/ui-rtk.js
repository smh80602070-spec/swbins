/**
 * 화면 — 사가천하 (삼국지)
 * ---------------------------------------------------------------
 * 가운데는 **지도**다. 이 판에는 원래 지도가 없었다(강역이 목록이었다) —
 * 삼국지로 옮기면서 성 서른 곳과 그 사이의 길이 판 그 자체가 되었다.
 *
 *   지도    성을 누르면 그 성이 열린다. 우리 성이면 명령, 남의 성이면 출진·계략
 *   상단    연·월 · 세력 · 금 · 병력 · 군량 · 성 수 + **다음 달**
 *   독      🏯 성 · 👤 무장 · 🤝 외교 · 📚 학당(문답) · 📜 기록
 *
 * 판정은 한 줄도 여기 없다. 전부 rtk / war / diplo 를 부른다 —
 * 화면에서 셈을 하면 자가진단이 못 짚는 곳에 규칙이 생긴다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var FD = global.DG.forceData;
  var ID = global.DG.item;

  var els = {};
  var openTab = null;
  var openCityId = null;
  var pickOrder = null;        // 명령을 고른 뒤 사람을 고르는 두 걸음
  var quizCur = null;
  var lastBattle = null;
  var pickScen = '194';        // 세력을 고르기 **전에** 고른 시나리오
  var pickChallenge = false;   // 이번 주 도전으로 세력을 고르는 중인가(§5-7)

  /* 개입형 실시간 전투(showBattleLive) — 지금 명령을 기다리는 중이면 여기 담긴다.
     act() 의 'bat-cmd' 손잡이가 이걸 불러 다음 합으로 잇는다 */
  var liveStep = null;
  /* 지형 전술(PLAN §5-6) — 이번 합 프롬프트가 들고 온 "쓸 수 있는 전술" 과, 출진 카드에서 직접 고른 진형(없으면 자동) */
  var liveTactic = null, marchForm = '', liveGrid = false;   // liveGrid — 이번 합에 격자 전술판(W-0108)을 열 수 있는가
  var LAND_ICON = { plain: '🌾', hill: '⛰️', river: '🌊', mount: '🏔️' };
  var liveRepStub = null;
  var liveBase = null;
  /* 실시간 전장(2026-09-28, 실기 보고 Q9) — 합을 누를 때마다가 아니라 **시계로** 저절로 넘긴다.
     명령 단추는 "다음 합부터 이렇게" 를 바꿀 뿐(돌격·수비·정공법은 바꿀 때까지 이어진다, 전술은 한 번).
     ⏸ 멈춤 · ⏩ 두 배 · ⏭ 바로 다음 합. 판정은 그대로 war.js stepRound — 부르는 박자만 바뀌었다.
     손잡이: battle.roundMs(한 합 2600ms, 첫 합은 두 군이 다가오는 동안 ×1.7) */
  var liveClock = null, liveStance = null, liveQueued = null, livePaused = false, liveSpeed = 1, liveOn = false, liveRound = 0;
  function liveRoundMs() { return Math.max(300, core.tuned('battle.roundMs', 2600)) * (liveRound === 0 ? 1.7 : 1) / liveSpeed; }
  function stopLiveClock() { if (liveClock) { global.clearTimeout(liveClock); liveClock = null; } }
  function armLiveClock() {
    stopLiveClock();
    var ck = $('bclock');
    if (!liveStep || livePaused) { if (ck) { ck.innerHTML = ''; } return; }
    var ms = liveRoundMs();
    if (ck) { ck.innerHTML = '<i style="animation-duration:' + Math.round(ms) + 'ms"></i>'; }
    liveClock = global.setTimeout(function () { liveClock = null; fireLiveRound(); }, ms);
  }
  /** 지금 명령으로 한 합을 친다 — 시계·⏭·키 모두 여기로 */
  function fireLiveRound() {
    var step = liveStep;
    if (!step) { return; }
    liveStep = null;
    stopLiveClock();
    var cmd = liveStance;
    if (liveQueued) { cmd = { cmd: liveStance, tactic: liveQueued }; liveQueued = null; }
    step(cmd);
  }
  /** 싸움 도중 화면을 닫으면 남은 합을 지금 명령대로 끝까지 굴린다(예전엔 멈춘 채 남았다) */
  function finishLiveNow() {
    liveOn = false;
    for (var guard = 0; liveStep && guard < 40; guard++) { fireLiveRound(); }
    stopLiveClock();
  }
  /** 싸움이 끝났다 — 전장은 그대로 두고 그 위에 결과 판을 띄운다(예전엔 요약 카드로 갈아 끼우고 처음부터 다시 재생했다) */
  function showLiveResult(rep) {
    var el = $('liveresult');
    if (!el) { showBattle(rep); return; }
    stopLiveClock();
    var kind = rep.won ? 'won' : (rep.routed ? 'routed' : 'dusk');
    if (global.DG.battle3d && global.DG.battle3d.armyEnd) { global.DG.battle3d.armyEnd(kind); }
    var head = rep.won ? '🏆 승리' : (rep.routed ? '↩️ 물러났다' : '🌒 날이 저물었다');
    var tail = rep.log.slice(-4).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('');
    el.innerHTML = '<div class="bres ' + (rep.won ? 'good' : 'bad') + '"><h3>' + head + '</h3>' +
      '<div class="bres-sub">잃은 병력 — 아군 ' + core.fmt(rep.lossA || 0) + ' · 적 ' + core.fmt(rep.lossD || 0) + '</div>' +
      '<div class="bres-log">' + tail + '</div>' +
      '<button class="btn primary wide" data-act="close-enc">확인</button></div>';
    var cmdEl = $('livecmd');
    if (cmdEl) { cmdEl.innerHTML = ''; }
    liveOn = false;
  }
  function popLoss(row, d) {
    if (!row || !(d >= 1)) { return; }
    var sp = document.createElement('span');
    sp.className = 'bloss';
    sp.textContent = '−' + core.fmt(Math.round(d));
    row.appendChild(sp);
    global.setTimeout(function () { if (sp.parentNode) { sp.parentNode.removeChild(sp); } }, 1300);
  }
  /** 전장 단축키 — 1 돌격 · 2 수비 · 3 정공법 · 4 전술 · 5 전술판 · 스페이스 멈춤 · F 빠르게 · Enter 다음 합 · R 퇴각 */
  function liveKey(k) {
    if (!liveOn || !liveStep) { return false; }
    var map = { '1': 'press', '2': 'hold', '3': 'none', '4': 'tactic', '5': 'grid', r: 'retreat' };
    var fake = function (o) { return { getAttribute: function (a) { return o[a] || null; } }; };
    if (map[k]) {
      if (map[k] === 'tactic') {
        if (!(liveTactic && liveTactic.ok && liveTactic.tactic)) { return true; }
        act('bat-cmd', fake({ 'data-cmd': 'tactic', 'data-tactic': liveTactic.tactic.key }));
      } else { act('bat-cmd', fake({ 'data-cmd': map[k] })); }
      return true;
    }
    if (k === ' ') { act('bat-pause', fake({})); return true; }
    if (k === 'f') { act('bat-speed', fake({})); return true; }
    if (k === 'enter') { act('bat-now', fake({})); return true; }
    return false;
  }
  /* 일기토 손 싸움(PLAN §5-3) — 한 수를 기다리는 중이면 step 이 담긴다 / 설전 카드 진행(사절·등용 앞의 세 문답) */
  var duelStep = null;
  var debCur = null;
  var DEBATE_TIP = '설전 — 세 문답의 정답 수로 성공률이 ×0.8 ~ ×1.3 이 된다';

  function $(id) { return document.getElementById(id); }

  var ico = global.DG.itemicon ? global.DG.itemicon.fn('saga-realm') : function (k, i, s, f) { return f || ''; };   /* 아이템 아이콘(W-0025) */ function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function R() { return global.DG.rtk; }
  function off() { return global.DG.off; }

  /**
   * 초상 <img> 에 붙일 이름표. `portrait3d` 가 실제 모델로 그림을 다 구우면
   * 이 표를 보고 `src` 를 갈아 끼운다. 못 쓸 자리(three 없음 · 손잡이 내림)
   * 에서는 빈 문자열이라 **여태 그림이 그대로 남는다**.
   */
  function p3tag(ref, w, h) {
    var P3 = global.DG.portrait3d;
    if (!P3 || !P3.ready()) { return ''; }
    if (!p3tag.timer) {
      p3tag.timer = global.setTimeout(function () {
        p3tag.timer = null;
        P3.sweep();
      }, 40);
    }
    return ' data-p3="' + P3.keyOf('hero', ref, w, h) + '"';
  }

  /** 이미 구워 둔 3D 초상이 있으면 그걸로 바로 시작한다 — 없으면 fallback 그림.
   *  매번 캔버스 그림으로 시작했다가 40ms 뒤 갈아 끼우면, 이미 구운 인물도
   *  다시 볼 때마다 2D 그림이 잠깐 비쳤다 3D 로 바뀌어 깜빡이는 것처럼 보였다
   *  (2026-09-19, "초상이 2D 스프라이트랑 겹쳐서 깜빡인다" 제보로 발견). */
  function p3src(ref, w, h, fallback) {
    var P3 = global.DG.portrait3d;
    var baked = P3 && P3.of ? P3.of('hero', ref, w, h) : null;
    if (baked) { return { src: baked, done: ' data-p3-done="1"' }; }
    /* 3D 로 꼭 갈아 끼워질 자리는 코드 스프라이트 대신 자리표시로 시작한다(SAGA-DESIGN §11 Phase 0) */
    if (P3 && P3.willSwap && P3.willSwap('hero', ref, w, h)) { return { src: P3.holder(w, h), done: ' data-p3-holder="1"' }; }
    return { src: typeof fallback === 'function' ? fallback() : fallback, done: '' };
  }

  function pt(ref, size) {
    var sz = size || 40;
    var p = p3src(ref, sz, sz, function () { return global.DG.sprite.portrait('hero', ref, sz); });
    return '<img class="pt" alt=""' + p3tag(ref, sz, sz) + p.done + ' src="' +
      p.src + '">';
  }

  /**
   * 무장 카드 큰 초상 — `pt()` 와 달리 정사각이 아니라 액자 비율이다.
   * CSS(`.pt{width:100%;height:100%}`)가 카드 폭만큼 늘려 보여주는데, 여태
   * `pt(h,52)` 로 52px 짜리를 그 자리에 늘여 써서 흐릿하게 뭉갰다(2026-09-03) —
   * 구울 해상도 자체를 표시 크기에 맞춘다. 되돌아가는 그림도 목록용 작은
   * `sprite.portrait()` 대신 액자·배경이 있는 `sprite.portraitCard()` 로 맞춘다.
   */
  function ptBig(ref, w, h) {
    w = w || 200; h = h || 224;
    var p = p3src(ref, w, h, function () { return global.DG.sprite.portraitCard('hero', ref, w, h); });
    var img = '<img class="pt" alt=""' + p3tag(ref, w, h) + p.done + ' src="' + p.src + '">', LP = global.DG.livePortrait, lv = LP && ref && LP.has(ref.id) && LP.on() ? LP.html(ref.id, '', img) : null;
    return lv || img;   /* W-0251 군주 여섯은 움직이는 초상(K-0110) — 받기 전엔 정지 초상 */
  }

  function forceColor(id) {
    var f = FD.force(id);
    return f ? f.color : '#5b6572';
  }

  /* ── 지도 이동·확대(2026-09-10) ───────────────────────────
   * 세계가 삼국지 한 판이던 때는 늘 전체를 한눈에 보여주는 것으로 충분했다 —
   * 한국·일본·교주 등으로 늘어난 지금은 전체를 다 보여주면 성 하나하나가
   * 점 하나로 뭉개져 "내가 어느 땅을 가졌는지" 알아보기 어렵다. `renderMap()`
   * 의 viewBox 를 고정 문자열 대신 여기 상태(mapCx·mapCy·mapZoom)로 계산해
   * 확대·이동이 되게 한다 — **성·길 좌표(CD.CITIES)는 그대로다**, 보여주는
   * 창(viewBox)만 좁힌다. MAP_VB 는 `renderMap()` 이 그리는 전체 지도 범위와
   * 반드시 같아야 한다(그쪽 viewBox 주석 참고).
   */
  /* 2026-09-10 — 균열(아홉째 확장) 이 일본 동쪽(x 최대 158) 너머로 더
     뻗어(x 최대 205) w 를 225→270 으로 다시 넓혔다. y 는 그대로다.
     2026-09-11 — 폐허(열째 확장) 가 균열 너머로 더 뻗어(x 최대 236)
     w 를 270→300 으로 다시 넓혔다.
     2026-09-22 — 대진(열두째 확장) 이 서역 서쪽으로 x 최소 -120 까지
     뻗어 x·w 를 -60/300 → -140/380 으로(오른쪽 240 은 그대로 유지),
     선비(열셋째)가 막북 북쪽으로 y 최소 -40 까지 뻗어 y·h 를
     -30/180 → -55/205 로(아래쪽 150 은 그대로 유지) 다시 넓혔다. */
  var MAP_VB = { x: -140, y: -55, w: 380, h: 205 };
  var MAP_ZOOM_MAX = 6;
  /* W-0400 지역 단위 전략 지도(region-view.js) — 전체 범위 MAP_VB 를 지금 지역 경계로 바꿔 끼우고 그 지역 성만 그린다. 손잡이 realm.regionView 0 = 옛 전체 */
  var MAP_VB_ALL = { x: -140, y: -55, w: 380, h: 205 }, regionShown = null;
  function RVw() { var V = global.DG.regionView; return V && V.on() ? V : null; }
  function inRegion(d) { var V = RVw(); return !V || V.regionOf(d.id) === regionShown; }
  function regionSync() { var V = RVw(), rid = V ? V.current() : null, b = (rid && V.bbox(rid)) || MAP_VB_ALL; if (rid === regionShown && (rid || MAP_VB.w === b.w)) { return false; } regionShown = rid; MAP_VB.x = b.x; MAP_VB.y = b.y; MAP_VB.w = b.w; MAP_VB.h = b.h; mapCx = b.x + b.w / 2; mapCy = b.y + b.h / 2; mapZoom = 1; return true; }
  /** 이웃 지역 화살표 — 이웃마다 하나(지역 밖으로 나가는 첫 길 쪽), 누르면 그 지역(data-region) */
  function regionArrows() {
    var V = RVw(), L = V ? V.links(regionShown) : [], seen = {}, out = '', i, a, b, dx, dy, d, x, y, B = MAP_VB;
    for (i = 0; i < L.length; i++) {
      if (seen[L[i].rid]) { continue; } seen[L[i].rid] = 1;
      a = L[i].from; b = L[i].to; dx = b.x - a.x; dy = b.y - a.y; d = Math.max(0.001, Math.hypot(dx, dy));
      x = core.clamp(a.x + dx / d * 5, B.x + 7, B.x + B.w - 7); y = core.clamp(a.y + dy / d * 5, B.y + 5, B.y + B.h - 7);
      out += '<g class="rgo" data-region="' + L[i].rid + '" style="cursor:pointer"><line x1="' + a.x + '" y1="' + a.y + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#f3d27a" stroke-width="0.4" stroke-dasharray="0.9 0.6"/>' +
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.5" fill="rgba(30,22,10,0.78)" stroke="#f3d27a" stroke-width="0.5"/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 0.55).toFixed(1) + '" font-size="1.5" text-anchor="middle" fill="#f3d27a">➜</text>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 3.4).toFixed(1) + '" font-size="1.7" text-anchor="middle" fill="#fff4d6" stroke="rgba(0,0,0,0.7)" stroke-width="0.5" paint-order="stroke">' + V.name(L[i].rid) + '</text></g>';
    }
    return out;
  }
  /** W-0400 ③ 「🗺 천하도」 — 지도 왼쪽 위 단추(지금 지역 이름) · 누르면 지역 카드 목록(이름·성·내 성·⚔ 맞닿음). 지형 그림 없음, 카드를 누르면 그 지역 */
  var regionListOpen = false, regionHudEl = null;
  /** 화면 고정 층(#rregion-hud) — 2D 지도 상자(#realm)는 3D 모드에서 숨어 있어 그 안에 두면 PC 에서 안 보였다. 3D 면 왼쪽 위 행동 줄 아래, 2D 면 지도 왼쪽 아래 */
  function regionPanel(st) {
    var V = RVw(), doc = global.document, s2 = '', i, r, L, mine, foe, j, c, d3 = !!(global.DG.realm3d && global.DG.realm3d.active && global.DG.realm3d.active());
    if (!regionHudEl && doc && doc.body) {
      regionHudEl = doc.createElement('div'); regionHudEl.id = 'rregion-hud'; doc.body.appendChild(regionHudEl);
      regionHudEl.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act="region-list"],[data-region]'); if (!t || !RVw()) { return; }
        if (t.getAttribute('data-act') === 'region-list') { regionListOpen = !regionListOpen; } else { regionListOpen = false; RVw().set(t.getAttribute('data-region')); }
        renderMap();
      });
    }
    if (!regionHudEl) { return ''; }
    if (!V || !st.started) { regionHudEl.innerHTML = ''; return ''; }
    regionHudEl.style.cssText = 'position:fixed;left:12px;' + (d3 ? 'top:205px' : 'bottom:114px') + ';z-index:40;max-width:calc(100vw - 24px)';
    s2 += '<div class="rregion-btn" data-act="region-list" style="display:inline-block;padding:6px 10px;border-radius:10px;background:rgba(30,22,10,0.82);border:1px solid #f3d27a;color:#fff4d6;font-weight:700;font-size:14px;cursor:pointer">🗺 ' + esc(V.name(regionShown || V.current())) + ' ▾</div>';
    if (regionListOpen) {
      s2 += '<div class="rregion-list" style="position:absolute;left:0;' + (d3 ? 'top:40px' : 'bottom:42px') + ';width:min(520px,calc(100vw - 24px));max-height:55vh;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:8px;border-radius:12px;background:rgba(20,15,8,0.94);border:1px solid #f3d27a">';
      for (i = 0; i < V.REGIONS.length; i++) {
        r = V.REGIONS[i]; L = V.cities(r.id); mine = 0; foe = 0;
        for (j = 0; j < L.length; j++) { c = st.cities[L[j].id]; if (c && c.force === st.me) { mine++; } else if (c && c.force) { foe++; } }
        s2 += '<div class="rregion-card" data-region="' + r.id + '" style="cursor:pointer;padding:6px 8px;border-radius:8px;background:' + (r.id === regionShown ? 'rgba(243,210,122,0.28)' : 'rgba(255,255,255,0.06)') + ';border:1px solid rgba(243,210,122,0.45);color:#fff4d6;font-size:13px">' +
          '<b>' + esc(r.name) + '</b>' + (mine && foe ? ' ⚔' : '') + '<br><span style="opacity:.85">성 ' + L.length + (mine ? ' · 내 성 ' + mine : '') + '</span></div>';
      }
      s2 += '</div>';
    }
    regionHudEl.innerHTML = s2;
    return '';
  }
  function regionAt(e) { var els2 = global.document.elementsFromPoint ? global.document.elementsFromPoint(e.clientX, e.clientY) : [], i, g; for (i = 0; i < els2.length; i++) { g = els2[i].closest && els2[i].closest('[data-region]'); if (g) { return g; } } return null; }
  var mapCx = MAP_VB.x + MAP_VB.w / 2, mapCy = MAP_VB.y + MAP_VB.h / 2, mapZoom = 1;
  var MAP_PAN_SPEED = 0.022;   // 조이스틱을 완전히 기울였을 때 프레임당 이동(뷰포트 폭의 비율)

  function clampMapCenter() {
    var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom;
    mapCx = core.clamp(mapCx, MAP_VB.x + w / 2, MAP_VB.x + MAP_VB.w - w / 2);
    mapCy = core.clamp(mapCy, MAP_VB.y + h / 2, MAP_VB.y + MAP_VB.h - h / 2);
  }
  function mapViewBox() {
    clampMapCenter();
    var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom;
    return (mapCx - w / 2).toFixed(2) + ' ' + (mapCy - h / 2).toFixed(2) + ' ' +
      w.toFixed(2) + ' ' + h.toFixed(2);
  }
  /** renderMap() 을 통째로 다시 돌리지 않고 보이는 창만 바꾼다(조이스틱을
   *  쥔 동안 매 프레임 불러도 가볍다) */
  var rendWin = null; function mapWin() { var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom, m = 0.35; clampMapCenter(); return { x0: mapCx - w * (0.5 + m), x1: mapCx + w * (0.5 + m), y0: mapCy - h * (0.5 + m), y1: mapCy + h * (0.5 + m), w: w, h: h }; } function inWin(W, d) { return d.x >= W.x0 && d.x <= W.x1 && d.y >= W.y0 && d.y <= W.y1; } function winOut() { if (!rendWin) { return false; } var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom; return mapCx - w / 2 < rendWin.x0 || mapCx + w / 2 > rendWin.x1 || mapCy - h / 2 < rendWin.y0 || mapCy + h / 2 > rendWin.y1 || w > rendWin.w * 1.6; } /* W-0367 그린 창(+35%) · 보이는 창이 그 밖으로 나가거나 많이 물러나면 다시 그린다 */ function labelZ() { return Math.pow(mapZoom, -0.6).toFixed(3); } function applyMapViewNow() { if (winOut()) { renderMap(); return; }   // labelZ — W-0106 성 이름 글자가 확대해도 지도만큼 커지지 않게(겹침)
    var svg = els.realm && els.realm.querySelector('.rmap');
    if (svg) { svg.setAttribute('viewBox', mapViewBox()); svg.style.setProperty('--lz', labelZ()); declutterLabels(svg); }
  }  var labFsCache = {}; function declutterLabels(svg) { var M2 = global.DG.mode2d, ls = svg && svg.querySelectorAll ? svg.querySelectorAll('.rlab') : [], list = [], i, fs; if (!M2 || !M2.labels || !ls.length) { return; } var lzK = labelZ() + '|' + global.innerWidth; if (labFsCache[lzK] !== undefined) { fs = labFsCache[lzK]; } else { try { fs = parseFloat(global.getComputedStyle(ls[0]).fontSize); } catch (e) { fs = 0; } labFsCache[lzK] = fs; }   /* W-0367 글자 크기는 배율·화면 폭마다 한 번만 읽는다 — 매번 읽으면 새 지도 전체 스타일 계산을 그 자리에서 강제(폰 4배 감속 48ms) */ fs = fs > 0 ? fs : 2.5 * +labelZ(); if (svg.__labFs === fs && svg.__labN === ls.length) { return; } svg.__labFs = fs; svg.__labN = ls.length; for (i = 0; i < ls.length; i++) { var el = ls[i], t = el.textContent || ''; list.push({ el: el, x: +el.getAttribute('x'), y: +el.getAttribute('y'), w: (t.length + 0.4) * fs, h: fs * 1.15, pri: +(el.getAttribute('data-p') || 0), keep: el.getAttribute('data-m') === '1', dist: 0 }); } M2.labels(list, { stack: 1, gap: 0 }); for (i = 0; i < list.length; i++) { list[i].el.classList.toggle('rlab-off', !list[i].alpha); } }   // W-0348 성 이름 겹침 — 글자 크기(SVG 단위) 바뀔 때만 이름 상자를 어림해 공용 labels(), 겹친 작은 성 이름 숨김 · 내 성 늘 보임 · 쌓지 않음(이름이 성을 떠나면 헷갈린다)
  function panMapBy(dx, dy) {
    var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom;
    mapCx += dx * w * MAP_PAN_SPEED;
    mapCy += dy * h * MAP_PAN_SPEED;
    applyMapViewNow();
  }
  function zoomMapBy(factor) { zoomAt(factor); } var CAM2 = null; function rcam() { var C2 = global.DG.cam2d; if (!CAM2 && C2) { var fill = global.innerHeight > global.innerWidth ? Math.max(1, Math.round(10 * (global.innerHeight - 228) / (global.innerWidth * MAP_VB.h / MAP_VB.w)) / 10) : 1; CAM2 = C2.register('realm', { store: 'saga-realm/save/cam2d', min: Math.min(fill, MAP_ZOOM_MAX - 1), max: MAP_ZOOM_MAX, def: 1, onChange: function (v) { if (Math.abs(v - mapZoom) > 0.051) { zoomAt(v / mapZoom); } } }); } return CAM2; }   /* W-0365 공용 cam2d — 지도 배율 기기별 기억(±·핀치·휠은 이 판 것 그대로, 세력 고른 직후 "내 땅으로" 맞춤이 먼저 · 폰 세로 최소 = 지도가 화면 높이를 채우는 배율) */
  /** 확대 — 화면 점(x, y)을 주면 그 자리를 붙든 채(W-0177 휠), 안 주면 가운데 */
  function zoomAt(factor, x, y) {
    var svg = els.realm && els.realm.querySelector('.rmap'), r = svg && x !== undefined ? svg.getBoundingClientRect() : null;
    var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom, z = core.clamp(mapZoom * factor, rcam() ? CAM2.min : 1, MAP_ZOOM_MAX), k = mapZoom / z;
    if (r && r.width && r.height) { var px = mapCx - w / 2 + (x - r.left) / r.width * w, py = mapCy - h / 2 + (y - r.top) / r.height * h; mapCx = px + (mapCx - px) * k; mapCy = py + (mapCy - py) * k; }
    mapZoom = z; if (rcam()) { CAM2.set(z); }
    applyMapViewNow();
  }
  /** "내 땅으로" — 내 성들의 무게중심으로 지도(2D·3D 다)를 옮기고, **내 땅의
   *  실제 넓이에 맞춰** 당긴다. 세력을 고른 직후에도 불러 처음부터 내 땅이
   *  보이게 한다.
   *
   *  2026-09-10 정정 — "시작시 너무 멀리서 시작해, 이동이 되면 멀리서 볼
   *  필요가 있나?"(사용자 피드백). 예전엔 늘 고정 배율(2.6)로만 당겨서
   *  전 세계 일부가 여전히 함께 보였다 — 이제 조이스틱·드래그·핀치로 얼마든
   *  더 넓게 볼 수 있으니, 기본값은 **내 성 몇 개만 꽉 차게 바짝** 당기고
   *  더 보고 싶으면 손으로 나가면 된다는 판단이다. 내 성들의 실제 좌표
   *  범위(bounding box)를 재서 그게 화면에 꽉 차는 배율을 스스로 구한다 —
   *  성 하나뿐이거나 다닥다닥 붙어 있어도 최소 폭(MIN_SPAN)만큼은 보장해
   *  카메라가 도시 안으로 파고들지 않게 한다.
   */
  var MIN_SPAN = 10;   // 지도 단위(0~100대, data-city.js 와 같은 잣대) — 성 하나뿐이어도 이만큼은 보여준다
  function centerOnMine(zoomTo) {
    var st = R().state();
    if (!st.started) { return; }
    if (RVw() && (RVw().set(RVw().home()) || regionSync())) { renderMap(); }   // W-0400 내 땅으로 = 내 지역으로
    var xs = [], ys = [], i;
    for (i = 0; i < CD.CITIES.length; i++) {
      var d = CD.CITIES[i];
      if (st.cities[d.id].force === st.me) { xs.push(d.x); ys.push(d.y); }
    }
    if (!xs.length) { return; }
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    /* 패딩 ×2 — 성 이름표·인접 성 일부까지 여백으로 보이게. 스팬이 0(성 하나)
       이어도 MIN_SPAN 이 바닥을 받쳐 카메라가 도시 안으로 안 들어간다 */
    var spanX = Math.max(maxX - minX, MIN_SPAN) * 2;
    var spanY = Math.max(maxY - minY, MIN_SPAN) * 2;
    var z = zoomTo || core.clamp(Math.min(MAP_VB.w / spanX, MAP_VB.h / spanY), 2, MAP_ZOOM_MAX);
    mapCx = cx; mapCy = cy; mapZoom = rcam() ? Math.max(z, CAM2.min) : z;   // W-0365 폰 세로는 지도가 화면 높이를 채우는 배율 밑으로 안 간다(가운데 띠만 보이고 위아래가 비었다)
    applyMapViewNow();
    if (global.DG.realm3d && global.DG.realm3d.panTo) {
      global.DG.realm3d.panTo(cx, cy, Math.max(spanX, spanY));
    }
  }

  /** 조이스틱(#rjoy) — 쥐고 있는 동안 2D(뷰박스) · 3D(궤도 중심) 중 지금
   *  보이는 쪽을 매 프레임 옮긴다. 판정은 없다 — 화면 이동뿐 */
  var mjoyId = null, mjoyCX = 0, mjoyCY = 0, mjoyDX = 0, mjoyDY = 0, mjoyLoop = false;
  var MJOY_R = 46, MJOY_DEAD = 8;
  function initMapStick() {
    var joyEl = $('rjoy'), knobEl = $('rjoy-knob');
    if (!joyEl || !knobEl) { return; }
    function knobAt(x, y) { knobEl.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
    function reset() { mjoyId = null; mjoyDX = 0; mjoyDY = 0; knobAt(0, 0); }
    function startLoop() {
      if (mjoyLoop) { return; }
      mjoyLoop = true;
      requestAnimationFrame(function tick() {
        if (mjoyDX || mjoyDY) {
          var R3 = global.DG.realm3d;
          if (R3 && R3.active()) { R3.panBy(mjoyDX, mjoyDY); } else { panMapBy(mjoyDX, mjoyDY); }
        }
        if (mjoyId !== null || mjoyDX || mjoyDY) { requestAnimationFrame(tick); }
        else { mjoyLoop = false; }
      });
    }
    joyEl.addEventListener('pointerdown', function (e) {
      if (mjoyId !== null) { return; }
      var r = joyEl.getBoundingClientRect();
      mjoyCX = r.left + r.width / 2; mjoyCY = r.top + r.height / 2;
      mjoyId = e.pointerId;
      joyEl.setPointerCapture && joyEl.setPointerCapture(e.pointerId);
      startLoop();
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (e) {
      if (e.pointerId !== mjoyId) { return; }
      var dx = e.clientX - mjoyCX, dy = e.clientY - mjoyCY;
      var len = Math.hypot(dx, dy);
      var kx = len > MJOY_R ? dx / len * MJOY_R : dx, ky = len > MJOY_R ? dy / len * MJOY_R : dy;
      knobAt(kx, ky);
      if (len < MJOY_DEAD) { mjoyDX = 0; mjoyDY = 0; return; }
      mjoyDX = dx / len; mjoyDY = dy / len;
      e.preventDefault();
    });
    function release(e) { if (e.pointerId === mjoyId) { reset(); } }
    joyEl.addEventListener('pointerup', release);
    joyEl.addEventListener('pointercancel', release);
    joyEl.addEventListener('pointerleave', release);
  }

  /** 키보드 이동(2026-09-11) — 방향키·WASD 로 국토 지도를 민다(2D·3D 다
   *  통한다, 조이스틱과 같은 요령: 눌려 있는 동안 매 프레임 `panBy`/
   *  `panMapBy` 를 부른다). 입력칸(설정 화면 등)에 포커스가 있으면 무시한다 */
  var kbKeys = {}, kbLoop = false;
  var KB_MAP = { arrowup: 'u', arrowdown: 'd', arrowleft: 'l', arrowright: 'r',
    w: 'u', s: 'd', a: 'l', d: 'r' };
  function kbAxis() {
    var dx = (kbKeys.r ? 1 : 0) - (kbKeys.l ? 1 : 0);
    var dy = (kbKeys.d ? 1 : 0) - (kbKeys.u ? 1 : 0);
    if (!dx && !dy) { return null; }
    var len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }
  function kbStartLoop() {
    if (kbLoop) { return; }
    kbLoop = true;
    requestAnimationFrame(function tick() {
      var ax = kbAxis();
      if (ax) {
        var R3 = global.DG.realm3d;
        if (R3 && R3.active()) { R3.panBy(ax.x, ax.y); } else { panMapBy(ax.x, ax.y); }
      }
      if (ax) { requestAnimationFrame(tick); } else { kbLoop = false; }
    });
  }
  function initMapKeyboard() {
    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
      var dir = KB_MAP[e.key.toLowerCase()];
      if (!dir) { return; }
      kbKeys[dir] = true;
      kbStartLoop();
      e.preventDefault();
    });
    global.addEventListener('keyup', function (e) {
      var dir = KB_MAP[e.key.toLowerCase()];
      if (dir) { kbKeys[dir] = false; }
    });
  }

  /** 2D 지도 한 손가락 드래그 + 두 손가락 핀치(2026-09-10) — "맵 이동이
   *  편해야 한다"는 신고로 조이스틱만으로는 부족하다고 보고 더한다. 지도를
   *  직접 밀고 두 손가락으로 오므리는 게 가장 자연스러운 손짓이다(구글지도·
   *  이 판 3D 지도(`realm3d.js` `bindPointer()`)와 같은 결). 손가락이 하나면
   *  드래그(살짝만 움직이면 성 탭, 크게 끌면 이동으로 가른다), 둘이면 핀치—
   *  `realm3d.js`의 pointers 표·twoPointerDist() 요령을 그대로 옮겼다 */
  var mapPointers = {}, mapDragMoved = false, mapPinchDist = 0;
  var mapVelX = 0, mapVelY = 0, mapMomentumOn = false;
  function mapPointerCount() {
    var n = 0, k;
    for (k in mapPointers) { if (mapPointers.hasOwnProperty(k)) { n++; } }
    return n;
  }
  function mapTwoDist() {
    var ks = Object.keys(mapPointers);
    if (ks.length < 2) { return 0; }
    var a = mapPointers[ks[0]], b = mapPointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  /** 손을 뗀 뒤에도 살짝 미끄러져 멎는다(2026-09-10, "맵이동이 편해야 한다"
   *  이어서) — 마지막 프레임의 픽셀 속도(mapVelX/Y)를 그대로 이어받아 매
   *  프레임 10%씩 줄이며 민다. 드래그 쪽과 똑같은 픽셀→지도단위 환산을 쓴다 */
  function startMapMomentum() {
    if (mapMomentumOn) { return; }
    mapMomentumOn = true;
    function step() {
      /* 2026-09-10 버그 수정 — 이 검사가 없으면 손을 다시 대서(pointerdown이
         mapMomentumOn = false 로 끔) 이 관성을 끊으려 해도, 이미 예약돼 있던
         requestAnimationFrame(step) 은 그 사실을 모른 채 한 번 더(사실상
         속도가 죽을 때까지 계속) 돌아 새 드래그와 밀어내기 싸움을 벌였다 —
         매 프레임 이 값부터 다시 확인해야 밖에서 끈 게 그 자리에서 먹힌다 */
      if (!mapMomentumOn) { return; }
      var svg = els.realm.querySelector('.rmap');
      mapVelX *= 0.9; mapVelY *= 0.9;
      if (!svg || Math.abs(mapVelX) + Math.abs(mapVelY) < 0.4) { mapMomentumOn = false; return; }
      var r = svg.getBoundingClientRect();
      if (r.width && r.height) {
        var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom;
        mapCx -= mapVelX / r.width * w;
        mapCy -= mapVelY / r.height * h;
        applyMapViewNow();
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function bindMapDrag() {
    els.realm.addEventListener('pointerdown', function (e) {
      if (!els.realm.querySelector('.rmap')) { return; }
      mapPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { els.realm.setPointerCapture(e.pointerId); } catch (ex) { /* noop */ }
      if (mapPointerCount() === 1) { mapDragMoved = false; mapVelX = 0; mapVelY = 0; mapMomentumOn = false; }
      if (mapPointerCount() === 2) { mapPinchDist = mapTwoDist(); }
    });
    els.realm.addEventListener('pointermove', function (e) {
      var p = mapPointers[e.pointerId];
      if (!p) { return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      var svg = els.realm.querySelector('.rmap');
      var r = svg ? svg.getBoundingClientRect() : null;
      if (mapPointerCount() === 1) {
        if (Math.abs(dx) + Math.abs(dy) > 3) { mapDragMoved = true; }
        if (svg && r && r.width && r.height) {
          var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom;
          mapCx -= dx / r.width * w;
          mapCy -= dy / r.height * h;
          applyMapViewNow();
        }
        mapVelX = dx; mapVelY = dy;
      } else if (mapPointerCount() === 2) {
        var nd = mapTwoDist();
        if (mapPinchDist > 0 && nd > 0) { zoomMapBy(nd / mapPinchDist); }
        mapPinchDist = nd;
        mapDragMoved = true;
        mapVelX = 0; mapVelY = 0;   // 핀치 중엔 관성을 안 쌓는다
      }
      mapPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    function endDrag(e) {
      var wasSingleDrag = mapPointerCount() === 1 && mapDragMoved;
      delete mapPointers[e.pointerId];
      if (wasSingleDrag && mapPointerCount() === 0) { startMapMomentum(); }
    }
    els.realm.addEventListener('pointerup', endDrag);
    els.realm.addEventListener('pointercancel', endDrag);
  }

  /** 지도 화면일 때만 조이스틱·홈·확대 손잡이를 보여준다(세력 고르기 전 ·
   *  시트가 지도를 덮었을 때는 숨긴다 — saga-go 의 #gjoy 와 같은 결) */
  function syncMapControls() {
    var show = R().state().started && !openTab;
    ['rjoy', 'rmapctl'].forEach(function (id) {
      var el = $(id);
      if (el) { el.classList.toggle('show', show); }
    });
  }

  /* ── 배선 ─────────────────────────────────────────────── */

  function init() {
    ['profile', 'wallet', 'realm', 'dock', 'sheet', 'sheet-title', 'sheet-body',
     'sheet-close', 'sheet-map', 'scrim', 'encounter', 'toast'].forEach(function (id) { els[id] = $(id); });
    var mo = $('top-more'), b3 = $('btn-3d'); if (mo && b3 && global.innerWidth <= 520) { mo.insertBefore(b3, mo.firstChild); }   /* W-0364 폰: 🧊 는 ⋯ 안으로(손잡이 그대로) */ document.body.classList.add('hud-diet'); [els.profile, els.wallet].forEach(function (el) { if (el) { el.addEventListener('click', function (e) { if (e.target.closest('button')) { return; } if (!hudFold(el)) { el.classList.remove('hud-open'); } }); } });   // W-0364 폰 세로 HUD 접기(공용 ui-kit.css) — 윗 카드·지갑 탭 = 펼침, 다시 탭 = 접음(지갑 안 단추는 제 일)

    els.dock.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sheet]');
      if (!b) { return; }
      var name = b.getAttribute('data-sheet');
      if (openTab === name) { closeSheet(); } else { openSheet(name); }
    });
    els['sheet-close'].addEventListener('click', closeSheet);
    els['sheet-map'].addEventListener('click', closeSheet);
    els.scrim.addEventListener('click', closeSheet);
    global.addEventListener('keydown', function (e) {
      if (els.encounter.classList.contains('battle') && !e.ctrlKey && !e.metaKey && !e.altKey && liveKey(e.key.toLowerCase())) {
        e.preventDefault(); e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Escape') {
        if (els.encounter.classList.contains('show')) { return; }
        if (openTab) { closeSheet(); }
      }
      /* M — 핵앤슬래시식 "지도로" 단축키. 이 판은 국토 지도가 늘 화면 밑에 깔려 있고
         성안·기록 등은 그 위 시트라, M 은 열린 시트를 닫아 국토 지도를 드러낸다.
         encounter(전투 결과·시나리오 선택 등 응답 대기 중인 카드)는 Escape 처럼 건드리지 않는다 */
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (els.encounter.classList.contains('show')) { return; }
        if (openTab) { closeSheet(); }
      }
    });

    els.realm.addEventListener('click', function (e) {
      if (mapDragMoved) { mapDragMoved = false; return; }
      var rg = RVw() && (e.target.closest('[data-region]') || regionAt(e)); if (rg) { regionListOpen = false; RVw().set(rg.getAttribute('data-region')); renderMap(); return; }   // W-0400 이웃 지역 화살표·천하도 카드
      var n = e.target.closest('[data-city]') || (global.DG.cpanel && global.DG.cpanel.at(e));   /* 지도 포인터 캡처 때문에 마우스 클릭은 #realm 으로 온다 — 좌표로 성을 찾는다(W-0027) */
      if (n) { if (global.DG.cpanel && global.DG.cpanel.pick(n.getAttribute('data-city'))) { return; } openCity(n.getAttribute('data-city')); return; }
      if (e.target.closest('[data-act="center-mine"]')) { centerOnMine(); }
    });
    bindMapDrag();
    var mapHome = $('btn-map-home'), mapZin = $('btn-map-zoomin'), mapZout = $('btn-map-zoomout');
    if (mapHome) { mapHome.addEventListener('click', function () { centerOnMine(); }); }
    if (mapZin) { mapZin.addEventListener('click', function () { zoomMapBy(1.5); }); }
    if (mapZout) { mapZout.addEventListener('click', function () { zoomMapBy(1 / 1.5); }); }
    initMapStick();
    initMapKeyboard();
    els['sheet-body'].addEventListener('click', onAct);
    els.encounter.addEventListener('click', onAct);
    /* 음량 슬라이더 — 끌 때마다(input) 바로 듣고, 값칸만 직접 고쳐 슬라이더가
       손 밑에서 튀지 않게 한다(전체 renderSheet() 는 안 부른다) */
    els['sheet-body'].addEventListener('input', function (e) {
      var el = e.target, a0 = el.getAttribute('data-act');
      if (a0 === 'snd-vol') {
        var SF = global.DG.sfx;
        if (!SF) { return; }
        var v = SF.setVolume((parseInt(el.value, 10) || 0) / 100);
        var lbl = el.nextElementSibling;
        if (lbl) { lbl.textContent = Math.round(v * 100) + '%'; }
      }
    });

    core.on('toast', toast);
    core.on('changed', function () { renderTop(); mapSeq++; if (!mapRaf && global.requestAnimationFrame) { mapRaf = global.requestAnimationFrame(function () { mapRaf = 0; if (mapSeq > mapDone) { renderMap(); } }); } else if (!global.requestAnimationFrame) { renderMap(); } renderSheet(); syncDock(); });   /* W-0367 'changed' 의 지도 다시 그리기는 다음 프레임 한 번으로 — 그 사이 손잡이가 직접 그렸으면(mapDone) 건너뜀(다음 달 한 번에 두 번 그리던 것) */
    core.on('rtk:battle', function (rep) {
      /* 내 세력이 친 싸움만 띄운다. 진영에서 벌어진 것(달을 넘긴 원정)도 여기로 온다 */
      if (rep.force === R().me()) {
        lastBattle = rep;
        if (liveOn && $('liveresult')) { showLiveResult(rep); } else { showBattle(rep); }
      }
    });
    core.on('rtk:camp', function () { syncDock(); });
    core.on('rtk:end', function (kind) { showEnd(kind); });
    core.on('rtk:milestone', function (list) { showMilestone(list); });
    core.on('rtk:victory', function (card) { showVictory(card); }); core.on('rtk:comeback', function (e) { showComeback(e); });
    core.on('rtk:challenge', function (res) { showChallenge(res); });

    if (!R().state().started) { showScenPick(); }
    else { centerOnMine(); showEvent(); }
    renderTop(); renderMap();
  }

  function onAct(e) {
    var b = e.target.closest('[data-act]');
    if (!b) { return; }
    act(b.getAttribute('data-act'), b);
  }

  /* ── 손잡이 ───────────────────────────────────────────── */

  function act(a, b) {
    var g = function (k) { return b.getAttribute(k); };

    if (a === 'pick-scen') {
      pickScen = g('data-id');
      pickChallenge = false;
      showForcePick(pickScen);
      return;
    }
    if (a === 'pick-challenge') {
      pickScen = 'chaos';
      pickChallenge = g('data-kind') === 'day' ? 'day' : true;   // W-0244 오늘의 도전
      showForcePick('chaos');
      return;
    }
    if (a === 'back-scen') { pickChallenge = false; showScenPick(); return; } if (a === 'c3-on') { if (global.DG.city3d && global.DG.city3d.set3d) { global.DG.city3d.set3d(true); } renderSheet(); return; }   /* W-0346 폰 성 3D 켜기 */
    if (a === 'lordaging-toggle') {
      core.setTune('rtk.lordAging', off().lordAgingOn() ? 0 : 1);
      renderSheet();
      return;
    }
    if (a === 'monthcard-toggle') {
      core.setTune('rtk.monthCard', monthCardOn() ? 0 : 1);
      renderSheet();
      return;
    }
    if (a === 'snd-toggle') {
      var SF0 = global.DG.sfx;
      if (SF0) { SF0.setEnabled(!SF0.enabled()); renderSheet(); }
      return;
    }
    if (a === 'shake-toggle') {
      core.setTune('battle3d.shake', core.tuned('battle3d.shake', 1) ? 0 : 1);
      renderSheet();
      return;
    }
    /* 지도 위 배우(PLAN §5-10) — 끄면 옛 지도(원정은 🚩), 다시 지어 곧바로 반영한다 */
    if (a === 'actors-toggle') {
      core.setTune('realm3d.actors', core.tuned('realm3d.actors', 1) ? 0 : 1);
      if (global.DG.realm3d && global.DG.realm3d.active()) { global.DG.realm3d.rebuild(); }
      renderSheet();
      return;
    }
    if (a === 'cityzoom-toggle') {
      core.setTune('realm3d.cityZoom', core.tuned('realm3d.cityZoom', 1) ? 0 : 1);
      renderSheet();
      return;
    }
    if (a === 'quality-set') {
      var R3q = global.DG.realm3d;
      if (R3q && R3q.setQuality) { R3q.setQuality(g('data-level')); }
      renderSheet();
      return;
    }
    if (a === 'pick-force') {
      if (pickChallenge) { R().setupChallenge(g('data-id'), null, pickChallenge === 'day'); pickChallenge = false; }
      else { R().setup(g('data-id'), pickScen); }
      closeEnc();
      centerOnMine();
      renderTop(); renderMap(); syncDock();
      return;
    }
    if (a === 'next-round') {
      var nrr = R().nextRound();
      if (!nrr.ok) { toast(nrr.why); return; }
      closeEnc();
      centerOnMine();
      renderTop(); renderMap(); syncDock();
      toast('🔁 ' + nrr.n + '회차');
      return;
    }
    if (a === 'next-month') {
      var was = R().state();
      if (was.result) { return; }
      var moved = R().endMonth();
      renderTop(); renderMap(); renderSheet();
      /* 이정표·승리·도전 카드가 이미 떠 있으면 그 뒤에 줄을 선다. 판이 닫혔으면 끝 카드만 */
      var inCard = moved && moved.report && monthCardOn() && !R().state().result && showMonthCard(moved.report);   // W-0177 고를 사연·소식은 그 카드 안 칸으로
      if (!R().state().result && !inCard) { showEvent(); }
      return;
    }
    if (a === 'close-enc') { closeEnc(); return; }
    if (a === 'ev-pick') {
      var er = global.DG.event.choose(g('data-k'));
      if (!er.ok) { toast(er.why); return; }
      showEnc('<div style="text-align:center"><div class="enc-big">📜</div></div><div class="enc-hist">' + esc(er.text) + '</div>' +
        '<button class="btn primary wide" data-act="close-enc">확인</button>');
      renderTop(); renderMap(); renderSheet();
      return;
    }
    if (a === 'ask-part') {
      var rg = $('askrange');
      if (rg) {
        rg.value = String(Math.max(1, Math.round(parseInt(rg.max, 10) * parseFloat(g('data-p')))));
        askShow();
      }
      return;
    }
    if (a === 'ask-ok') {
      var rv = $('askrange');
      var val = rv ? parseInt(rv.value, 10) : 0;
      var cb = askCb; askCb = null; closeEnc();
      if (cb) { cb(val); }
      return;
    }
    if (a === 'ask-no') { askCb = null; closeEnc(); return; }
    if (a === 'ev-pre') { runEventPre(); return; }
    if (a === 'duel-pick' || a === 'duel-go') {
      var ds = duelStep; duelStep = null;
      if (ds) { ds(a === 'duel-pick' ? g('data-pick') : undefined); }
      return;
    }
    if (a === 'deb-answer') {
      if (debCur && !debCur.last) {
        debCur.last = global.DG.quiz.debateAnswer(debCur.qs[debCur.i], parseInt(g('data-i'), 10));
        if (debCur.last && debCur.last.ok) { debCur.ok++; }
        renderDebate();
      }
      return;
    }
    if (a === 'deb-next') { if (debCur) { debCur.i++; debCur.last = null; renderDebate(); } return; }
    if (a === 'deb-quit') { debCur = null; closeEnc(); return; }
    if (a === 'deb-go' || a === 'deb-skip') {
      var dd = debCur; debCur = null; closeEnc();
      if (dd) { dd.done(a === 'deb-go' ? global.DG.quiz.debateMul(dd.ok) : 1, a === 'deb-go' ? dd.ok : 0); }
      return;
    }
    if (a === 'open-city') { openCity(g('data-city')); return; }

    if (a === 'sel-order') { pickOrder = g('data-key'); renderSheet(); return; }
    if (a === 'do-order') {
      var res = R().order(openCityId, g('data-id'), pickOrder);
      if (!res.ok) { toast(res.why); } else { if (res.text) { toast(res.text); } if (global.DG.rtkHand) { global.DG.rtkHand.pop(openCityId, pickOrder, res); } }   // W-0177 지도 위 숫자
      pickOrder = null;
    } else if (a === 'set-gov') {
      R().setGov(openCityId, g('data-id') || null);
    } else if (a === 'promote') {
      var pr = off().promote(g('data-id'));
      toast(pr.ok ? '✨ ' + pr.name + ' — 충성 ' + pr.loyal : pr.why);
    } else if (a === 'mount-eq') {
      var me2 = global.DG.mount.cycleEquip(g('data-id'));
      toast(me2.ok ? (me2.mount ? '🐎 ' + me2.mount.name + ' — 이 장수가 든 부대가 땅 싸움에서 ×' + me2.mount.mul : '🐎 말을 내렸다') : me2.why);
    } else if (a === 'reward') {
      var rr = R().reward(g('data-id'), 300);
      toast(rr.ok ? '🎁 충성 ' + rr.loyal : rr.why);
    } else if (a === 'set-heir') {
      var hs = off().setHeir(R().state().me, g('data-id'));
      toast(hs.ok ? (hs.heir ? '🎌 후계로 지정했다' : '🎌 지정을 풀었다 — 자동으로 정한다') : hs.why);
    } else if (a === 'hire-one') {
      var hBy = g('data-by'), hId = g('data-id'), hCity = openCityId;
      startDebate({
        title: '설전 — ' + off().find(hBy).name + ' → ' + off().find(hId).name, by: hBy,
        done: function (mul) {
          var hr = R().tryHire(hCity, hBy, hId, mul);
          toast(hr.ok ? hr.text : hr.why);
          if (hr.ok) { off().rec(hBy).done = true; }
          afterAct();
        }
      });
      return;
    } else if (a === 'move-officer') {
      var mv = global.DG.war.moveOfficer(g('data-id'), g('data-to'));
      toast(mv.ok ? '🚶 옮겼습니다' : mv.why);
    } else if (a === 'send-troops') {
      var sFrom = openCityId, sTo = g('data-to');
      var sc = R().city(sFrom);
      if (sc.troops < 1) { toast('보낼 병력이 없습니다'); return; }
      askNumber({
        title: '🚚 ' + CD.find(sFrom).name + ' → ' + CD.find(sTo).name,
        hint: '몇 명을 보낼까요? 성에 🪖 ' + core.fmt(sc.troops) +
          ' <span class="muted">(군량도 그만큼 딸려 갑니다)</span>',
        max: sc.troops, value: Math.floor(sc.troops * 0.5), ok: '🚚 보낸다',
        done: function (n) {
          var tr = global.DG.war.transfer(sFrom, sTo, n, Math.round(n / 1000 * 20));
          toast(tr.ok ? '🚚 ' + core.fmt(tr.troops) + ' 을 보냈습니다' : tr.why);
          core.persist(); renderTop(); renderMap(); renderSheet();
        }
      });
      return;
    } else if (a === 'march') {
      doMarch(g('data-from'), g('data-to'));
      return;
    } else if (a === 'journey') {
      doJourney(g('data-from'), g('data-to'));
      return;
    } else if (a === 'march-form') {
      marchForm = g('data-form') || '';
      var mfb = els.encounter.querySelectorAll('[data-act="march-form"]'), mi;
      for (mi = 0; mi < mfb.length; mi++) {
        var on = (mfb[mi].getAttribute('data-form') || '') === marchForm;
        mfb[mi].classList.toggle('primary', on);
        mfb[mi].classList.toggle('ghost', !on);
      }
      return;
    } else if (a === 'bat-cmd') {
      /* 실시간 전장 — 퇴각만 바로, 나머지는 "다음 합부터" (돌격·수비·정공법은 이어지고 전술은 한 번) */
      var cmd = g('data-cmd');
      if (cmd === 'grid') { if (liveGrid && liveStep) { var stepG = liveStep; liveStep = null; stopLiveClock(); renderLiveCmd(false); stepG('grid'); } return; }   // 전술판 — 시계를 세우고 판을 연다, 끝나면 war.js 가 같은 합을 다시 묻는다
      if (cmd === 'retreat') {
        var stepR = liveStep; liveStep = null;
        stopLiveClock();
        renderLiveCmd(false);
        if (stepR) { stepR('retreat'); }
        return;
      }
      if (cmd === 'tactic') { liveQueued = liveQueued ? null : g('data-tactic'); }
      else {
        liveStance = (!cmd || cmd === 'none') ? null : cmd;
        if (global.DG.battle3d && global.DG.battle3d.setStance) { global.DG.battle3d.setStance(liveStance); }
      }
      renderLiveCmd(!!liveStep);
      return;
    } else if (a === 'bat-pause') {
      livePaused = !livePaused;
      renderLiveCmd(!!liveStep);
      armLiveClock();
      return;
    } else if (a === 'bat-speed') {
      liveSpeed = liveSpeed === 1 ? 2 : 1;
      renderLiveCmd(!!liveStep);
      armLiveClock();
      return;
    } else if (a === 'bat-now') {
      fireLiveRound();
      return;
    } else if (a === 'camp-food' || a === 'camp-men') {
      doSupply(g('data-id'), a === 'camp-men');
      return;
    } else if (a === 'camp-quit') {
      var wr = global.DG.war.withdraw(g('data-id'));
      toast(wr.ok ? '↩️ 포위를 풀었습니다' : wr.why);
    } else if (a === 'plot') {
      var pr = global.DG.diplo.plot(g('data-kind'), g('data-by'), openCityId, null);
      toast(pr.ok ? pr.text : pr.why);
    } else if (a === 'trade') {
      doTrade(openCityId, g('data-dir'));
      return;
    } else if (a === 'envoy') {
      var eKind = g('data-kind'), eTo = g('data-to'), eBy = g('data-by'), eGold = eKind === 'tribute' ? 600 : 200;
      var runEnvoy = function (mul) {
        var er = global.DG.diplo.envoy(eKind, eTo, eBy, eGold, mul);
        toast(er.ok ? (er.done ? '🤝 이루어졌습니다' : er.text) : er.why);
        afterAct();
      };
      if (eKind === 'tribute') { runEnvoy(); return; }
      /* 문답을 다 풀고 나서야 "금이 모자랍니다" 를 듣지 않도록 미리 본다 */
      var eRec = off().rec(eBy), eForce = R().force(eRec.force);
      if (!eForce || eRec.done || eRec.hurt || eForce.gold < eGold + 100) {
        runEnvoy(); return;                       // diplo.envoy 가 이유를 말해 준다
      }
      startDebate({ title: '설전 — ' + off().find(eBy).name + ' → ' + R().forceName(eTo), by: eBy, done: runEnvoy });
      return;
    } else if (a === 'q-start') {
      quizCur = { p: global.DG.quiz.draw(g('data-cat') || null), result: null };
      if (!quizCur.p) { quizCur = null; toast('낼 문제가 없습니다'); }
    } else if (a === 'q-answer') {
      if (quizCur && quizCur.p && !quizCur.result) {
        quizCur.result = global.DG.quiz.answer(quizCur.p, parseInt(g('data-i'), 10));
      }
    } else if (a === 'q-next') {
      quizCur = { p: global.DG.quiz.draw(quizCur && quizCur.cat), result: null };
    } else if (a === 'q-quit') {
      quizCur = null;
    } else { return; }

    core.persist();
    renderTop(); renderMap(); renderSheet();
  }

  /** act() 꼬리와 같은 뒷정리 — 카드 콜백(설전 끝)이 부른다 */
  function afterAct() {
    core.persist();
    renderTop(); renderMap(); renderSheet();
  }

  function doMarch(fromId, toId) {
    var c = R().city(fromId);
    var ready = R().readyAt(fromId);
    if (!ready.length) { toast('출진할 장수가 없습니다'); return; }
    var wet = CD.isWater(fromId, toId);
    var max = wet ? Math.min(c.troops, (c.ships || 0) * global.DG.war.SHIP_CREW) : c.troops;
    if (wet && max < 500) { toast('배가 모자랍니다 — 조선(造船)으로 지으십시오'); return; }
    if (max < 500) { toast('오백은 넘겨야 군대라 하지요'); return; }
    var lead = off().sortByPower(ready).slice(0, 3).map(function (h) { return h.id; });
    marchForm = '';
    askNumber({
      title: (wet ? '🌊 ' : '⚔️ ') + CD.find(fromId).name + ' → ' + CD.find(toId).name,
      hint: '몇 명을 이끌고 갈까요? 성에 🪖 ' + core.fmt(c.troops) +
        (wet ? ' · <b>물길</b>이라 배로 ' + core.fmt(max) + '까지' : '') +
        '<br>장수 — ' + lead.map(function (id) { return esc(off().find(id).name); }).join(' · ') +
        formationHint(lead) + formationPick(lead) + terrainHint(toId),
      max: max, value: Math.floor(max * 0.8), ok: (wet ? '🌊 물길로 친다' : '⚔️ 친다'),
      done: function (t) { runMarch(fromId, toId, lead, t); }
    });
  }

  /** 이 장수들로 나가면 진형이 서는가 — 서면 미리 알려 준다(war.js FORMATIONS) */
  function formationHint(officerIds) {
    var f = global.DG.war.formationOf(officerIds);
    return f ? '<br><span class="tag">' + f.emoji + ' ' + esc(f.name) + ' 발동 (위력 ×' +
      f.mul.toFixed(2) + ')</span>' : '';
  }

  /** 진형을 직접 고르는 줄(PLAN §5-6 (b)) — 자동이 기본이다. 문턱에 못 미치는 진형도 고를 수 있으나 위력의 덧붙는 몫이 반이 된다 */
  function formationPick(lead) {
    var W = global.DG.war, h = '<br><span class="muted">진형 </span><button class="btn tiny primary" data-act="march-form" data-form="">자동</button>';
    W.FORMATIONS.forEach(function (f) {
      var fo = W.formationOf(lead, f.key);
      h += ' <button class="btn tiny ghost" data-act="march-form" data-form="' + f.key + '" title="' + esc(f.desc) + '">' + f.emoji + ' ' + esc(f.name) +
        (fo && fo.weak ? ' ½' : '') + '</button>';
    });
    return h + '<br><small class="muted">직접 고른 진형이 문턱에 못 미치면 위력이 반으로 줍니다(½)</small>';
  }

  /** 싸울 땅과 거기서 쓸 수 있는 전술 한 줄 */
  function terrainHint(toId) {
    var W = global.DG.war, land = CD.landOf(toId), tac = W.TACTICS[land.key];
    return '<br><span class="tag">' + (LAND_ICON[land.key] || '') + ' ' + esc(land.name) + '</span>' +
      (tac ? ' <span class="muted">전술 ' + tac.emoji + ' ' + esc(tac.name) + ' — ' + esc(tac.desc) + ' (' +
        ({ wisdom: '지력', might: '무력', command: '통솔' })[tac.stat] + ' ' + tac.req + '+, 한 번)</span>' : '');
  }

  /** 출진 전 잠깐 — 성에서 성으로 행군하는 모습(2026-09-22, "보는 재미" 요청:
   *  "전투를 나가는 장수하고 병사들도"). 3D 국토 지도가 떠 있을 때만 보인다
   *  (`realm3d.available()`) — 안 떠 있으면 그냥 즉시 전투로 넘어간다(예전 그대로). */
  var MARCH_OUT_MS = 900;
  function runMarch(fromId, toId, lead, t) {
    if (!(t > 0)) { return; }
    for (var i = 0; i < lead.length; i++) { off().rec(lead[i]).done = true; }
    var R3 = global.DG.realm3d;
    if (R3 && R3.available() && R3.active()) {
      R3.showMarch(fromId, toId, MARCH_OUT_MS, forceColor(R().me()));
      global.setTimeout(function () { showBattleLive(fromId, toId, lead, t); }, MARCH_OUT_MS);
    } else {
      showBattleLive(fromId, toId, lead, t);
    }
  }

  /** 원정 — 인접하지 않은 먼 성으로 병력을 보낸다. `doMarch()` 와 같은 꼴이지만
   *  그 자리에서 붙지 않는다 — 몇 달 뒤 국경에 닿아야 `war.js` 가 알아서 붙인다 */
  function doJourney(fromId, toId) {
    var c = R().city(fromId);
    var ready = R().readyAt(fromId);
    if (!ready.length) { toast('보낼 장수가 없습니다'); return; }
    if (c.troops < 500) { toast('오백은 넘겨야 군대라 하지요'); return; }
    var path = CD.path(fromId, toId, function (cid) {
      var pc = R().city(cid); return !!pc && (pc.force === c.force || pc.force === null);
    });
    if (!path) { toast('갈 수 있는 길이 없습니다 (남의 땅에 막혔습니다)'); return; }
    var lead = off().sortByPower(ready).slice(0, 3).map(function (h) { return h.id; });
    askNumber({
      title: '🚩 ' + CD.find(fromId).name + ' → ' + CD.find(toId).name + ' (원정)',
      hint: '몇 명을 보낼까요? 성에 🪖 ' + core.fmt(c.troops) +
        '<br>거리 — 약 <b>' + CD.pathMonths(path) + '달</b> 예상' +
        '<br>장수 — ' + lead.map(function (id) { return esc(off().find(id).name); }).join(' · ') +
        formationHint(lead),
      max: c.troops, value: Math.floor(c.troops * 0.8), ok: '🚩 원정을 보낸다',
      done: function (t) { runJourney(fromId, toId, lead, t); }
    });
  }

  function runJourney(fromId, toId, lead, t) {
    if (!(t > 0)) { return; }
    var res = global.DG.war.startJourney(fromId, toId, lead, t);
    if (!res.ok) { toast(res.why); return; }
    for (var i = 0; i < lead.length; i++) { off().rec(lead[i]).done = true; }
    toast('🚩 원정을 떠났습니다 (' + res.months + '달 예상)');
    renderTop(); renderMap(); renderSheet(); syncDock();
  }

  /** 시장 — 명령이 아니라 물류라 askNumber 로 바로 받는다(장수를 안 고른다) */
  function doTrade(cityId, dir) {
    var c = R().city(cityId), rate = R().marketRate(cityId);
    if (dir === 'sell') {
      if (c.food < 1) { toast('팔 군량이 없습니다'); return; }
      askNumber({
        title: '💰 ' + CD.find(cityId).name + ' — 군량을 판다',
        hint: '군량 🍚 ' + core.fmt(c.food) + ' 중 얼마나 팔까요? (환율 🪙' + rate.toFixed(2) + ')',
        max: c.food, value: Math.floor(c.food * 0.3), ok: '💰 판다',
        done: function (n) {
          var r = R().trade(cityId, 'sell', n);
          toast(r.ok ? '💰 군량 ' + core.fmt(-r.food) + ' → 금 ' + core.fmt(r.gold) : r.why);
          core.persist(); renderTop(); renderSheet();
        }
      });
    } else {
      var f = R().force(c.force);
      if (!f || f.gold < Math.round(1 / rate)) { toast('살 만한 금이 없습니다'); return; }
      var maxBuy = Math.floor(f.gold * rate);
      askNumber({
        title: '🌾 ' + CD.find(cityId).name + ' — 군량을 산다',
        hint: '금 🪙 ' + core.fmt(f.gold) + ' 로 최대 🍚 ' + core.fmt(maxBuy) +
          ' 까지 살 수 있습니다 (환율 🪙' + rate.toFixed(2) + ')',
        max: maxBuy, value: Math.floor(maxBuy * 0.3), ok: '🌾 산다',
        done: function (n) {
          var r = R().trade(cityId, 'buy', n);
          toast(r.ok ? '🌾 금 ' + core.fmt(-r.gold) + ' → 군량 ' + core.fmt(r.food) : r.why);
          core.persist(); renderTop(); renderSheet();
        }
      });
    }
  }

  /** 개입형 실시간 전투 — 합마다 끊어 명령(돌격·수비·정공법·퇴각)을 받는다.
   *  끝나면 war.js 가 'rtk:battle' 을 쏘고, 그 리스너(위 init())가 showBattle()
   *  로 이 화면을 표준 요약(전체 재생 포함)으로 갈아 끼운다 — 여기선 진행
   *  중일 때만 그린다 */
  /** 이 땅의 전술 버튼 — 못 쓰면 흐리게(이유는 title). 전투당 한 번 */
  function tacticButton() {
    var tt = liveTactic && liveTactic.tactic;
    if (!tt) { return ''; }
    var queued = liveQueued === tt.key;
    return '<button class="btn tiny' + (queued ? ' primary' : ' ghost') + '" data-act="bat-cmd" data-cmd="tactic" data-tactic="' + tt.key + '"' +
      (liveTactic.ok ? '' : ' disabled') + ' title="' + esc(liveTactic.ok ? tt.desc : liveTactic.why) + '">🎯 ' + tt.emoji + ' ' + esc(tt.name) +
      (queued ? ' ✓' : '') + '</button>';
  }

  function renderLiveCmd(show) {
    var el = $('livecmd');
    if (!el) { return; }
    var on = function (k) { return liveStance === k ? ' primary' : ' ghost'; };
    el.innerHTML = !show ? '' :
      '<div class="brow">' +
      '<button class="btn tiny' + on('press') + '" data-act="bat-cmd" data-cmd="press" title="1 — 더 베고 더 맞는다">⚔️ 돌격</button>' +
      '<button class="btn tiny' + on('hold') + '" data-act="bat-cmd" data-cmd="hold" title="2 — 덜 베고 덜 맞는다">🛡️ 수비</button>' +
      '<button class="btn tiny' + on(null) + '" data-act="bat-cmd" data-cmd="none" title="3">➡️ 정공법</button>' +
      tacticButton() +
      '<button class="btn tiny ghost" data-act="bat-cmd" data-cmd="retreat" title="R — 바로 물린다">↩️ 퇴각</button>' +
      '</div><div class="brow">' + (liveGrid ? '<button class="btn tiny" data-act="bat-cmd" data-cmd="grid" title="5 — 장수끼리 격자 판에서 3턴을 손으로 둔다(한 출진에 한 번)">♟️ 전술판</button>' : '') +
      '<button class="btn tiny ghost" data-act="bat-pause" title="스페이스">' + (livePaused ? '▶ 이어서' : '⏸ 멈춤') + '</button>' +
      '<button class="btn tiny ghost" data-act="bat-speed" title="F">' + (liveSpeed === 1 ? '⏩ ×2' : '⏩ ×1') + '</button>' +
      '<button class="btn tiny ghost" data-act="bat-now" title="Enter — 이번 합을 바로 친다">⏭ 다음 합</button>' +
      '</div>';
  }

  function liveAppendLog(s) {
    var el = $('livelog');
    if (!el) { return; }
    var d = document.createElement('div');
    d.textContent = s;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function liveShowState(state) {
    if (liveBase && liveRepStub && global.DG.battle3d) {
      global.DG.battle3d.showState(liveRepStub, liveBase, state);
    }
  }

  /** 실시간 전투 현황판 — 3D 디오라마(깃발 다발)만으로는 지금 몇 대 몇인지
   *  숫자로 읽을 수가 없다는 신고(2026-09-10)로 더한다. `.rstat`(성 시트가
   *  쓰는 그 줄)를 그대로 재사용해 아군·적군 병력과(물길이 아니면) 성벽을
   *  막대+숫자로 보여주고, 합마다 `updateBattleHud()`가 값만 갈아 끼운다 —
   *  판정은 없다, war.js 가 이미 낸 수치를 그대로 읽을 뿐이다 */
  /* 겨루기 카드 그림(일기토·설전·전황 막대)은 js/ui-rtk-cards.js(R-4) — 띄우기·상태만 여기 */
  var cardsObj = null; function CK() { return cardsObj || (cardsObj = global.DG.rtkCards.make({ esc: esc, pt: pt, bar: bar, DEBATE_TIP: DEBATE_TIP })); }
  function duelCaptionHtml(rep) { return CK().duelCaptionHtml(rep); }
  /** 일기토 손 싸움 카드(PLAN §5-3) — 판정은 war.js duelBout(), 그림은 rtkCards */
  function showDuelCard(view, step) { duelStep = step; showEnc(CK().duelCardHtml(view)); }

  /** 설전(PLAN §5-3) — 사절·등용 앞의 세 문답. 정답 수가 성공률 배율이 된다. opt = { title, by, done(mul) } */
  function startDebate(opt) {
    var qs = global.DG.quiz.debateDraw(off().stats(opt.by).wisdom);
    if (!qs.length) { opt.done(1); return; }
    debCur = { title: opt.title, qs: qs, i: 0, ok: 0, last: null, done: opt.done, must: !!opt.must };
    renderDebate();
  }

  function renderDebate() { if (!debCur) { return; } showEnc(CK().debateHtml(debCur)); }

  function battleHudHtml(rep) { return CK().battleHudHtml(rep); }
  function setBarRow(row, val, max) { return CK().setBarRow(row, val, max); }
  function updateBattleHud(rep, state) {
    var el = $('bhud');
    if (!el || !rep) { return; }
    var rows = el.querySelectorAll('.rstat');
    setBarRow(rows[0], state.atk != null ? state.atk : rep.atkStart, rep.atkStart);
    setBarRow(rows[1], state.def != null ? state.def : rep.defStart, rep.defStart);
    if (!rep.water && rows[2]) { setBarRow(rows[2], state.wall != null ? state.wall : rep.wallFrom, rep.wallFrom || 1); }
    var rd = $('bhud-round');
    if (rd && state.r != null) { rd.textContent = state.r > 0 ? state.r + '합째' : '전투 시작'; }
  }

  function showBattleLive(fromId, toId, lead, t) {
    liveStep = null; liveRepStub = null; liveBase = null; liveTactic = null; liveGrid = false; stopLiveClock();
    liveStance = null; liveQueued = null; livePaused = false; liveRound = 0; liveOn = false;
    var res = global.DG.war.marchInteractive(fromId, toId, lead, t, {
      formation: marchForm || undefined,
      onDuel: showDuelCard,
      onIntro: function (lines, repStub) {
        var html = (global.DG.battle3d ? '<canvas id="battle3d"></canvas>' : '') +
          '<div class="btop"><h3>⚔️ 전황 (진행 중)' +
            (repStub.land ? ' <small class="muted">' + (LAND_ICON[repStub.land] || '') + ' ' + esc(CD.LANDS[repStub.land].name) + '</small>' : '') + '</h3>' +
          battleHudHtml(repStub) + '<div class="bclock" id="bclock"></div></div>' +
          '<div class="bdock"><div class="warlog blog" id="livelog"></div><div class="bcmd" id="livecmd"></div></div><div id="liveresult"></div><div class="tacview" id="tacview"></div>';
        showEnc(html, 'battle');
        liveOn = true;
        liveRepStub = repStub;
        repStub._last = { atk: repStub.atkStart, def: repStub.defStart, wall: repStub.wallFrom };
        for (var i = 0; i < lines.length; i++) { liveAppendLog(lines[i]); }
        if (global.DG.battle3d) {
          liveBase = global.DG.battle3d.beginLive(repStub);
          liveShowState({ atk: repStub.atkStart, def: repStub.defStart, wall: repStub.wallFrom,
            duelPhase: repStub.duel ? 'done' : null });
        }
      },
      onLog: liveAppendLog,
      onRound: function (frame, r) {
        /* 이 합에 잃은 수를 막대 곁에 띄운다(−523) — war.js 가 낸 값의 차이일 뿐 */
        var rows = document.querySelectorAll('#bhud .rstat'), prev = liveRepStub && liveRepStub._last;
        if (prev) {
          popLoss(rows[0], prev.atk - frame.atk);
          popLoss(rows[1], prev.def - frame.def);
          if (!liveRepStub.water) { popLoss(rows[2], prev.wall - frame.wall); }
        }
        if (liveRepStub) { liveRepStub._last = { atk: frame.atk, def: frame.def, wall: frame.wall }; }
        liveShowState({ atk: frame.atk, def: frame.def, wall: frame.wall,
          duelPhase: liveRepStub && liveRepStub.duel ? 'done' : null, roundTick: true });
        updateBattleHud(liveRepStub, { atk: frame.atk, def: frame.def, wall: frame.wall, r: r });
        liveRound = r;
        var SFX = global.DG.sfx;
        if (SFX) { SFX.play('round_clash'); }
      },
      onTactics: function (ctx, done) { ctx.face = function (id) { var h = off().find(id); return h ? p3src(h, 64, 64, function () { return global.DG.sprite.portrait('hero', h, 64); }).src : ''; }; global.DG.tacticsView.open($('tacview'), ctx, done); },
      onPrompt: function (state, step) {
        liveStep = step; liveGrid = !!state.grid;
        liveTactic = state.tactic || null;
        if (liveQueued && !(liveTactic && liveTactic.ok)) { liveQueued = null; }
        renderLiveCmd(true);
        armLiveClock();
      },
      onDone: function () {
        liveStep = null; stopLiveClock(); renderLiveCmd(false);
        if ((global.DG.event && global.DG.event.view() || {}).id === 'tac_fallen') { showEvent(); }   // 전술판에서 쓰러진 장수의 열전 카드 — 결과 판 「확인」 뒤에 줄을 선다
      }
    });
    if (res && res.ok === false) {
      for (var j = 0; j < lead.length; j++) { off().rec(lead[j]).done = false; }
      toast(res.why);
    }
  }

  /** 진영에 군량이나 병력을 보낸다 */
  function doSupply(campId, men) {
    var W = global.DG.war;
    var cp = W.campById(campId);
    if (!cp) { toast('없는 진영입니다'); return; }
    var home = R().city(cp.from);
    if (!home || home.force !== R().me()) { toast('보급할 성이 없습니다'); return; }
    var have = men ? home.troops : home.food;
    if (have < 1) { toast('보낼 것이 없습니다'); return; }
    /* 물 위의 진영은 배에 타는 만큼만 더 받는다 — 물어보기 전에 그만큼으로 줄인다 */
    if (men && cp.water) {
      have = Math.min(have, Math.max(0, (cp.ships || 0) * W.SHIP_CREW - cp.troops));
      if (have < 1) { toast('배가 다 찼습니다'); return; }
    }
    askNumber({
      title: (men ? '🪖 증원' : '🌾 보급') + ' — ' + CD.find(cp.from).name + ' → ' +
        CD.find(cp.to).name + ' 진중',
      hint: CD.find(cp.from).name + '에 ' + (men ? '🪖 ' : '🌾 ') + core.fmt(have) +
        '<br>지금 치중 ' + core.fmt(cp.food) + ' (' + W.monthsLeft(cp) + '달치)',
      max: have, value: Math.floor(have * 0.4), ok: '🚚 보낸다',
      done: function (n) {
        var res = men ? W.supply(campId, n, 0, cp.from) : W.supply(campId, 0, n, cp.from);
        toast(res.ok ? '🚚 보냈습니다 — 치중 ' + res.left + '달치' : res.why);
        renderTop(); renderMap(); renderSheet(); syncDock();
      }
    });
  }

  /* ── 상단 ─────────────────────────────────────────────── */

  var MONTH_SEASON = ['', '초봄', '봄', '늦봄', '초여름', '여름', '늦여름',
                      '초가을', '가을', '늦가을', '초겨울', '겨울', '늦겨울'];
  var foldTimers = {}; function hudFold(el) { if (!el || !(global.innerWidth <= 520) || el.classList.contains('hud-open')) { return false; } el.classList.add('hud-open'); clearTimeout(foldTimers[el.id]); foldTimers[el.id] = setTimeout(function () { el.classList.remove('hud-open'); }, 6000); return true; }   /* W-0364 폰 세로(≤520)에서 접힌 판이면 펼치고 참(6초 뒤 다시 접힘) */
  function renderTop() {
    var st = R().state();
    if (!st.started) {
      els.profile.innerHTML = '<div class="p-meta"><div class="p-title">5천하 — 다스리고 꾀고 친다</div>' +
        '<div class="p-sub">세력을 고르십시오</div></div>';
      els.wallet.innerHTML = '';
      return;
    }
    var s = R().summary();
    var lord = off().find(off().lordOf(st.me));

    els.profile.innerHTML =
      (lord ? '<span class="avatar-pt">' + pt(lord, 40) + '</span>' : '') +
      '<div class="p-meta">' +
        '<div class="p-title">' + esc(s.name) + ' — ' + st.year + '년 ' + st.month + '월' +
          ' <span class="muted">' + MONTH_SEASON[st.month] + '</span>' +
          ' <span class="tag">' + esc((FD.current() || {}).name || '') + '</span></div>' +
        '<div class="p-sub">🏯 성 <b>' + s.cities + '/' + CD.CITIES.length + '</b>' +
          ' · 👤 <b>' + s.officers + '</b>' +
          ' · 수입 <b>' + core.fmt(s.income - s.upkeep) + '</b>/월</div>' +
        goalLine() +
      '</div>';

    els.wallet.innerHTML =
      coin('🪙', core.fmt(s.gold), '금') +
      coin('🪖', core.fmt(s.troops), '병력') +
      coin('🍚', core.fmt(s.food), '군량').replace('class="coin"', 'class="coin hud-keep"') +   // W-0364 폰 접힌 지갑 = 금·군량·▶ 다음 달
      '<button class="btn ghost rkh-all" data-rkh-del="*" title="내 성 전부 — 이 달 안 움직인 무장에게 명령을 맡긴다"' + (st.result ? ' disabled' : '') + '>🤝 전부</button>' +   // W-0177
      '<button class="btn primary next-btn hud-keep" data-act="next-month" title="다음 달 (Enter · N)"' + (st.result ? ' disabled' : '') + '>▶ 다음 달</button>';
    var nb = els.wallet.querySelector('.next-btn');
    if (nb) { nb.addEventListener('click', function () { act('next-month', nb); }); }
  }

  /** 상단 목표 두 줄 — ① 지금 겨냥하는 이정표(§5-4) ② 가장 가까운 승리 조건과 진척 %(§5-5) */
  function goalLine() {
    var mv = R().milestoneView();
    if (!mv) { return ''; }
    var line1;
    if (!mv.cur) { line1 = '<div class="p-goal">🚩 <b>' + mv.total + '/' + mv.total + '</b> 이정표를 모두 넘었다</div>'; }
    else {
      var pg = mv.progress;
      var pct = Math.min(100, Math.round(100 * pg.cur / Math.max(1, pg.need)));
      line1 = '<div class="p-goal" title="' + esc(mv.cur.desc) + '">🚩 <b>' + (mv.idx + 1) + '/' + mv.total + '</b> ' +
        esc(mv.cur.name) + ' <span class="gbar"><i style="width:' + pct + '%"></i></span> ' +
        pg.cur + '/' + pg.need + (pg.note ? ' · ' + pg.note : '') + '</div>';
    }
    var vn = R().victoryNext();
    if (!vn) { return line1; }
    var vp = Math.min(100, Math.round(100 * vn.pct));
    return line1 + '<div class="p-goal p-vic" title="' + esc(vn.note) + '">' + vn.emoji + ' <b>' + esc(vn.name) + '</b> ' +
      '<span class="gbar"><i style="width:' + vp + '%"></i></span> ' + vp + '% <span class="vnote">' + esc(vn.note) + '</span></div>';
  }

  function coin(icon, val, label) {
    return '<div class="coin" title="' + label + '"><span>' + icon + '</span>' + val + '</div>';
  }

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

  var mapDone = 0, mapSeq = 0, mapRaf = 0; function renderMap() { mapDone = mapSeq; regionSync(); var WIN = mapWin(), VIS = CD.CITIES.filter(function (d) { return inWin(WIN, d) && inRegion(d); }); rendWin = WIN;   /* W-0367 보이는 창 +35% 안의 성만 그린다(폰 탭이 죽던 지도 통째 그리기) — 창이 그 밖으로 나가면 applyMapViewNow 가 다시 그린다 */
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
    s += '<svg class="rmap" style="--lz:' + labelZ() + '" viewBox="' + mapViewBox() + '" preserveAspectRatio="xMidYMid meet">' + (global.DG.map2d ? global.DG.map2d.terrain(CD.CITIES, VIS) + global.DG.map2d.territory(VIS, st, forceColor) + (global.DG.map2d.provLabels ? global.DG.map2d.provLabels(CD.CITIES) : '') : '');   // 2D 모드 지형 바닥(W-0023)·세력 영토 면(W-0027)·지방 붓글씨(W-0264)

    /* 길 — 인접한 성끼리. 같은 편이면 밝게 */
    var drawn = {};
    for (i = 0; i < CD.CITIES.length; i++) {
      var a = CD.CITIES[i];
      for (j = 0; j < a.adj.length; j++) {
        var b = CD.find(a.adj[j]);
        var key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if (drawn[key] || (!inWin(WIN, a) && !inWin(WIN, b)) || !inRegion(a) || !inRegion(b)) { continue; }
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

    /* 성 */ var labs = '';   // W-0348 이름은 성을 다 그린 뒤 한 층에 — 성 안에 두면 다음 성 그림이 앞 성 이름을 덮는다
    for (i = 0; i < VIS.length; i++) {
      var d = VIS[i], c = st.cities[d.id];
      var mine = c.force === st.me;
      var rad = 1.5 + Math.min(2.2, c.troops / 12000);
      s += '<g class="rcity' + (mine ? ' mine' : '') + '" data-city="' + d.id + '">' +
        /* 손가락이 닿는 목표 — 성 점은 화면에서 8px 남짓이라 폰에서 못 누른다.
           보이지 않는 큰 원을 하나 깔아 둔다(그림은 그대로, 손만 커진다) */
        '<circle class="rhit" cx="' + d.x + '" cy="' + d.y + '" r="6"/>' +   // W-0177 4.2 → 6
        '<circle cx="' + d.x + '" cy="' + d.y + '" r="' + rad.toFixed(2) + '" fill="' +
          forceColor(c.force) + '"/>' + (global.DG.map2d ? global.DG.map2d.castle(d, rad) : '') +
        (mine ? '<circle cx="' + d.x + '" cy="' + d.y + '" r="' + (rad + 1.1).toFixed(2) +
          '" class="ring"/>' : '') +
        (c.disaster ? '<text class="rdis" x="' + (d.x + rad + 0.6) + '" y="' + (d.y - rad) +
          '">' + R().disasterByKey(c.disaster).emoji + '</text>' : '') +
        (global.DG.war.besieged(d.id) ? mapMark('camp', d.x - rad - 0.9, d.y - rad, 3, 'rdis', '🏕️') : '') +   // W-0330 진 그림(map_camp)
        '</g>';
      labs += '<text class="rlab" data-p="' + rad.toFixed(2) + '"' + (mine ? ' data-m="1"' : '') + ' x="' + d.x + '" y="' + (d.y + rad + 2.6) + '">' + esc(d.name) + '</text>';
    } s += '<g class="rlabs">' + labs + '</g>';

    /* 가고 있는 원정 — 경로 위 지금 자리에 깃발 하나(2026-09-04) */
    function mapMark(k, x, y, sz, cls, fb, fill) { var M2 = global.DG.map2d; return M2 && M2.mark ? M2.mark(k, x, y, sz, cls, fb, fill) : '<text class="' + cls + '" x="' + x + '" y="' + y + '"' + (fill ? ' fill="' + fill + '"' : '') + '>' + fb + '</text>'; }
    var jn = global.DG.war.journeys();
    for (i = 0; i < jn.length; i++) {
      var pos = journeyPos(jn[i]);
      if (!pos) { continue; }
      s += mapMark('flag', pos.x, pos.y, 3.4, 'rjourney', '🚩', forceColor(jn[i].force));   // W-0330 깃발 그림(map_flag)
    }
    if (global.DG.supplyLine) { s += global.DG.supplyLine.svg(); } if (global.DG.trade) { s += global.DG.trade.svg(); } s += regionArrows() + '</svg>';   // W-0278 진 뒤 보급 길(초록 이어짐·빨강 끊김)

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
    s += regionPanel(st);   // W-0400 ③

    els.realm.innerHTML = s; declutterLabels(els.realm.querySelector('.rmap')); if (global.DG.rtkHand) { global.DG.rtkHand.redraw(); }   // W-0177 솟는 결과 글자를 다시 그려도 잃지 않게
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

  /** 다음 달 카드(§5-7) — 이번 달 일어난 일 셋·재정·다음 달 권고 하나·진척. W-0177 부터 고를 사연·영내 소식도 같은 카드 아래 칸에
   *  (`rtk-hand.js monthHtml` — 줄 세운 카드를 하나씩 닫던 것). 사연을 실었으면 true — 그때는 따로 showEvent 를 안 띄운다 */
  function showMonthCard(rp) {
    var h = global.DG.rtkHand.monthHtml(rp);
    showEncQueued(h.html);
    return h.withEvent;
  }

  /** 주간 도전을 마친 카드 — 점수·최고 기록·공유 코드. 판은 이어진다 */
  function showChallenge(res) {
    showEncQueued('<div style="text-align:center"><div class="enc-big">🎯</div>' +
      '<h3 style="margin:6px 0 2px;font-size:20px;color:var(--gold)">' + (res.daily ? '오늘의 도전 ' : '이번 주 도전 ') + (res.how === 'lose' ? '— 멸망' : '끝') + '</h3>' +
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
  var EXPR_IDS = { fu_jongwang: 1, ru_geohae: 1, sg_caocao: 1, sg_liubei: 1, sg_sunquan: 1, tb_baekgi: 1 }; function exprFace(id, emo) { var IL = global.DG.illust && global.DG.illust.url(id, emo); if (IL) { return '<img class="enc-expr" alt="" src="' + IL + '" onerror="this.remove()">'; } return id && EXPR_IDS[id] ? '<img class="enc-expr" alt="" src="assets/portraits/expr/' + id + '__' + emo + '_c.webp" onerror="this.remove()">' : ''; } function myLord() { var o = off(), me = R().state().me; return o && o.lordOf ? o.lordOf(me) : null; } function compImg(name, cls) { var A3 = global.DG.assets3d, r = A3 && A3.root && A3.root(); return r ? '<img class="' + cls + '" alt="" src="' + r + 'competition/' + name + '.png" onerror="this.remove()">' : ''; } function medalOf(best, daily) { var k = daily ? 0.2 : 1; return best ? compImg(best >= 300 * k ? 'medal_1' : (best >= 150 * k ? 'medal_2' : 'medal_3'), 'chal-medal') : ''; } function resultHtml(card, over) {   // W-0265 K-0047 군주 여섯 표정(대사에 감정 줄이 없어 사건 고정: 승리·통일 joy · 멸망 sorrow · 재기 anger, 그림 없는 군주는 빈칸) · K-0050 경쟁 그림(공용 competition/ — 도전 배너·최고 기록 메달)
    var html = '<div style="text-align:center">' + exprFace(myLord(), 'joy') + '<div class="enc-big">' + card.emoji + '</div>' +
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

  function showVictory(card) { showEncQueued(resultHtml(card, false)); } function comebackHtml(e) { /* W-0249 재기 카드 — 토스트·로그만 스쳐 가던 재기(W-0248)를 한 장으로: 성·함께 나온 사람·받은 것·한 번뿐·첫 수 */ var off = global.DG.off, c = (e && CD.find(e.city)) || {}, ids = e ? [e.lord].concat(e.with || []) : [], row = function (id, i) { var h = off.find(id), s = off.stats ? off.stats(id) : null; return h ? '<div>' + (i ? '⛓️ ' : '👑 ') + '<b>' + esc(h.name) + '</b>' + (s ? ' <small class="muted">무 ' + s.might + ' · 지 ' + s.wisdom + ' · 통 ' + s.command + '</small>' : '') + (i ? ' <small class="muted">— 갇혀 있다 함께 빠져나옴</small>' : '') + '</div>' : ''; }; return '<div style="text-align:center">' + exprFace(e && e.lord, 'anger') + '<div class="enc-big">🔥</div><h3 style="margin:6px 0 2px;font-size:20px;color:var(--gold)">재기 — ' + esc(c.name || (e && e.city) || '') + '에서 다시 일어서다</h3><small class="muted">성을 모두 잃었으나 판은 끝나지 않았습니다 · 재기는 판마다 한 번뿐</small></div><div class="enc-hist">' + ids.map(row).join('') + '</div><div class="enc-hist"><span class="good">🏯 성 1 · 병력 1,000 · 군량 2,000 · 성벽 반</span><br>🪙 금고·명부는 그대로<br><span style="color:var(--bad)">⚠ 다시 성을 모두 잃으면 그때는 끝</span></div><small class="muted">첫 수 — 징병으로 병력을 채우고, 성에 포로가 있으면 등용으로 사람을 늘리십시오</small><button class="btn primary wide" data-act="close-enc">다시 일어선다</button>'; } function showComeback(e) { centerOnMine(); showEncQueued(comebackHtml(e)); }

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
    html += '<button class="fcard wide-card" data-act="pick-challenge">' + compImg('banner_weekly', 'chal-banner') +
      '<b>' + medalOf(best) + '🎯 이번 주 도전 · ' + esc(wk.key) + ' <span class="stars chal">★★★</span></b>' +
      '<small class="muted">무작위 판 · ' + R().CHALLENGE_MONTHS + '달 뒤 점수(성×10 + 무장 + 보물×20)</small>' +
      '<small class="muted">' + (best ? '내 최고 ' + best + '점' : '아직 기록이 없습니다') + ' · 같은 주엔 누구나 같은 판입니다</small>' +
      '</button>' + (R().challengeDay ? (function () { var dk = R().challengeDay(), db = R().bests()[dk.key]; return '<button class="fcard wide-card" data-act="pick-challenge" data-kind="day">' + compImg('banner_daily', 'chal-banner') + '<b>' + medalOf(db, true) + '📅 오늘의 도전 · ' + esc(dk.key.slice(1)) + ' <span class="stars chal">★★</span></b><small class="muted">무작위 판 · ' + R().DAILY_MONTHS + '달 뒤 점수(성×10 + 무장 + 보물×20) — 날마다 새 판</small><small class="muted">' + (db ? '오늘 최고 ' + db + '점' : '오늘 기록이 없습니다') + ' · 놓쳐도 잃는 것 없음</small></button>'; })() : '');   // W-0244
    showEnc(html + '</div>');
  }

  function showForcePick(scenId) {
    var sc = FD.scenario(scenId || pickScen);
    pickScen = sc.id;
    FD.use(sc.id);               // 이 화면이 보여 줄 표를 그 시나리오 것으로 갈아 끼운다
    var html = '<h3 style="margin:0 0 2px;font-size:19px">' + (pickChallenge ? (pickChallenge === 'day' ? '📅 오늘의 도전' : '🎯 이번 주 도전') + ' — 어느 깃발로' : '삼국지 ' + sc.year + '년 — ' + esc(sc.name)) + '</h3>' +
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
    showEnc((kind === 'win' ? '' : '<div style="text-align:center">' + exprFace(myLord(), 'sorrow') + '</div>') + '<h3 style="margin:0 0 6px;font-size:20px">' +
      (kind === 'win' ? '👑 천하통일' : '🏳️ 멸망') + '</h3>' +
      '<small class="muted">' + st.year + '년 ' + st.month + '월. ' +
      (kind === 'win' ? '온 땅의 성이 모두 한 깃발 아래 들었습니다.'
                      : '성을 모두 잃었습니다. 새 판으로 바로 다시 고릅니다 — 회차·주간 도전 최고 기록은 남습니다.') +
      '</small>' + (kind === 'win' ? '' : '<button class="btn primary wide" data-act="back-scen">🔁 새 판</button>') + '<button class="btn ' + (kind === 'win' ? 'primary' : 'ghost') + ' wide" data-act="close-enc">' + (kind === 'win' ? '확인' : '지도 보기') + '</button>');
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
    closeEnc: closeEnc, _comebackHtml: comebackHtml, _exprFace: exprFace, _medalOf: medalOf,   // W-0249·W-0265 진단
    /** 자가진단용 */
    _act: act, _tab: function () { return openTab; }, _city: function () { return openCityId; },
    centerAt: function (x, y) { mapCx = x; mapCy = y; applyMapViewNow(); }, _setOrder: function (k) { pickOrder = k; }, zoomAt: zoomAt, _view: function () { return { cx: mapCx, cy: mapCy, z: mapZoom }; },
    _quiz: function () { return quizCur; }
  };
})(window);
