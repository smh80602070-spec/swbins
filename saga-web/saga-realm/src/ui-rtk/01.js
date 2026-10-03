/**
 * 화면 — 사가국지 (삼국지)
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
  var liveTactic = null, marchForm = '';
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
  /** 전장 단축키 — 1 돌격 · 2 수비 · 3 정공법 · 4 전술 · 스페이스 멈춤 · F 빠르게 · Enter 다음 합 · R 퇴각 */
  function liveKey(k) {
    if (!liveOn || !liveStep) { return false; }
    var map = { '1': 'press', '2': 'hold', '3': 'none', '4': 'tactic', r: 'retreat' };
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
    return '<img class="pt" alt=""' + p3tag(ref, w, h) + p.done + ' src="' +
      p.src + '">';
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
  function applyMapViewNow() {
    var svg = els.realm && els.realm.querySelector('.rmap');
    if (svg) { svg.setAttribute('viewBox', mapViewBox()); }
  }
  function panMapBy(dx, dy) {
    var w = MAP_VB.w / mapZoom, h = MAP_VB.h / mapZoom;
    mapCx += dx * w * MAP_PAN_SPEED;
    mapCy += dy * h * MAP_PAN_SPEED;
    applyMapViewNow();
  }
  function zoomMapBy(factor) {
    mapZoom = core.clamp(mapZoom * factor, 1, MAP_ZOOM_MAX);
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
    mapCx = cx; mapCy = cy; mapZoom = z;
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
      var n = e.target.closest('[data-city]');
      if (n) { openCity(n.getAttribute('data-city')); return; }
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
    core.on('changed', function () { renderTop(); renderMap(); renderSheet(); syncDock(); });
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
    core.on('rtk:victory', function (card) { showVictory(card); });
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
      pickChallenge = true;
      showForcePick('chaos');
      return;
    }
    if (a === 'back-scen') { pickChallenge = false; showScenPick(); return; }
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
      if (pickChallenge) { R().setupChallenge(g('data-id')); pickChallenge = false; }
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
      if (moved && moved.report && monthCardOn() && !R().state().result) { showMonthCard(moved.report); }
      if (!R().state().result) { showEvent(); }
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
      if (!res.ok) { toast(res.why); } else if (res.text) { toast(res.text); }
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
      '</div><div class="brow">' +
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
  /** 일기토 예고장 — "OOO ⚔️ OOO"(초상 곁들여). 삼국지 게임들이 결투 전에
   *  두 장수를 마주 세워 보여주는 그 카드와 같은 결이다(2026-09-10). 이름·
   *  초상 다 안 바뀌는 값이라(합마다 그림이 바뀌는 건 3D 쪽 몫) 여기 한 번만
   *  적어 두고 갱신은 안 한다 — battle3d.js 의 실제 캐릭터 대결과 짝을 이룬다 */
  function duelCaptionHtml(rep) {
    if (!rep.duel || !rep.duel.a || !rep.duel.d) { return ''; }
    var oa = off().find(rep.duel.a), od = off().find(rep.duel.d);
    if (!oa || !od) { return ''; }
    return '<div class="bduel">' + pt(oa, 30) + '<b>' + esc(oa.name) + '</b>' +
      '<span>⚔️</span><b>' + esc(od.name) + '</b>' + pt(od, 30) + '</div>';
  }
  /** 일기토 손 싸움 카드(PLAN §5-3) — 한 수씩 고르고, 승부가 나면 결과를 보여 준 뒤 전황으로 넘어간다.
   *  판정은 war.js duelBout() 이 한다. 여기는 그 결과를 그릴 뿐이다 */
  function showDuelCard(view, step) {
    duelStep = step;
    var oa = off().find(view.a), od = off().find(view.d), S = view.stances, i, k, key;
    var html = '<h3 style="margin:0 0 6px;font-size:18px">🤺 일기토' +
      (view.done ? ' — 승부가 났다' : ' — ' + (view.bouts.length + 1) + '번째 수') + '</h3>' +
      '<div class="bduel">' + pt(oa, 30) + '<b>' + esc(oa.name) + '</b><span>⚔️</span><b>' + esc(od.name) + '</b>' + pt(od, 30) + '</div>' +
      '<div class="bhud">' + bar(esc(oa.name), view.ah, 100) + bar(esc(od.name), view.dh, 100) + '</div>';
    if (view.bouts.length) {
      html += '<div class="enc-hist">';
      for (i = 0; i < view.bouts.length; i++) {
        var b = view.bouts[i], mine = 0;
        for (k = 0; k < b.rounds.length; k++) { if (b.rounds[k] === 'a') { mine++; } }
        html += (i ? '<br>' : '') + (i + 1) + '수 — ' + S[b.pick].emoji + ' ' + S[b.pick].name + ' 대 ' + S[b.foe].emoji + ' ' + S[b.foe].name +
          ' · ' + (b.res === 'win' ? '✅ 이겼다' : (b.res === 'tie' ? '➖ 비겼다' : '❌ 졌다')) + ' ×' + b.mul.toFixed(1) +
          ' <span class="muted">(' + mine + ' : ' + (b.rounds.length - mine) + ')</span>';
      }
      html += '</div>';
    }
    if (view.done) {
      var res = view.result, won = res.winner === view.a;
      html += '<div class="qresult ' + (won ? 'good' : 'bad') + '">' + (won ? '🏆 ' : '💢 ') + esc(res.text) +
        (res.hurt ? ' — ' + esc(off().find(res.loser).name) + ' 이(가) 다쳤다' : '') + '</div>' +
        '<button class="btn primary wide" data-act="duel-go">' + esc(view.cont || '▶ 전황으로') + '</button>';
    } else {
      if (view.habit) {
        html += '<div class="enc-hist">' + S[view.habit].emoji + ' 적은 방금 이긴 <b>' + esc(S[view.habit].name) + '</b> 을(를) 되풀이할 낌새다.</div>';
      }
      html += '<div class="qchoices">';
      for (key in S) {
        if (!Object.prototype.hasOwnProperty.call(S, key)) { continue; }
        html += '<button class="qchoice" data-act="duel-pick" data-pick="' + key + '"><b>' + S[key].emoji + '</b> ' +
          esc(S[key].name) + ' <small class="muted">— ' + esc(S[key].desc) + '</small></button>';
      }
      html += '</div><small class="muted">베기 &gt; 찌르기 &gt; 막기 &gt; 베기. 이기면 내가 칠 확률 ×1.3, 지면 ×0.8 — 한 수가 네 합을 다스린다.</small>' +
        '<div class="camp-acts" style="margin-top:6px"><button class="btn tiny ghost" data-act="duel-pick" data-pick="auto">🎲 남은 합은 맡긴다</button></div>';
    }
    showEnc(html);
  }

  /** 설전(PLAN §5-3) — 사절·등용 앞의 세 문답. 정답 수가 성공률 배율이 된다. opt = { title, by, done(mul) } */
  function startDebate(opt) {
    var qs = global.DG.quiz.debateDraw(off().stats(opt.by).wisdom);
    if (!qs.length) { opt.done(1); return; }
    debCur = { title: opt.title, qs: qs, i: 0, ok: 0, last: null, done: opt.done, must: !!opt.must };
    renderDebate();
  }

  function renderDebate() {
    var d = debCur, Q = global.DG.quiz, QD = global.DG.quizData;
    if (!d) { return; }
    var html = '<h3 style="margin:0 0 4px;font-size:17px">🗣️ ' + esc(d.title) + '</h3>';
    if (d.i >= d.qs.length) {
      var mul = Q.debateMul(d.ok);
      html += '<div class="qresult ' + (mul >= 1 ? 'good' : 'bad') + '">정답 ' + d.ok + ' / ' + d.qs.length + ' — 성공률 ×' + mul + '</div>' +
        '<div class="camp-acts"><button class="btn primary" data-act="deb-go">📜 청한다</button>' +
        (d.must ? '' : '<button class="btn ghost" data-act="deb-quit">그만</button>') + '</div>';
    } else {
      var p = d.qs[d.i], cat = QD.catOf(p.cat), j;
      html += '<small class="muted">제 ' + (d.i + 1) + ' / ' + d.qs.length + ' 문 · 맞힌 ' + d.ok + ' · ' + esc(DEBATE_TIP) + '</small>' +
        '<div class="qbox"><div class="qb-head"><b style="color:' + cat.color + '">' + cat.emoji + ' ' + esc(cat.name) + '</b>' +
        '<span class="muted">' + p.lvName + '</span></div><p class="qq">' + esc(p.q) + '</p>';
      if (!d.last) {
        html += '<div class="qchoices">';
        for (j = 0; j < p.choices.length; j++) {
          html += '<button class="qchoice" data-act="deb-answer" data-i="' + j + '"><b>' + (j + 1) + '</b> ' + esc(p.choices[j]) + '</button>';
        }
        html += '</div>';
        if (d.i === 0 && !d.must) { html += '<button class="btn tiny ghost" data-act="deb-skip">설전 없이 청한다 (×1)</button> '; }
        if (!d.must) { html += '<button class="btn tiny ghost" data-act="deb-quit">그만</button>'; }
      } else {
        html += '<div class="qresult ' + (d.last.ok ? 'good' : 'bad') + '">' + (d.last.ok ? '✅ 정답 ' : '❌ 오답 ') +
          '<b>' + esc(d.last.answerText) + '</b></div><p class="qwhy">' + esc(d.last.why) + '</p>' +
          '<button class="btn primary wide" data-act="deb-next">' + (d.i + 1 >= d.qs.length ? '결과 ▶' : '다음 문 ▶') + '</button>';
      }
      html += '</div>';
    }
    showEnc(html);
  }

  function battleHudHtml(rep) {
    var af = FD.force(rep.force), df = FD.force(rep.defForce);
    return '<div class="bhud" id="bhud">' +
      duelCaptionHtml(rep) +
      bar((af ? esc(af.name) : '아군') + ' ⚔️', rep.atkStart, rep.atkStart) +
      bar((df ? esc(df.name) : '적군') + ' 🛡️', rep.defStart, rep.defStart) +
      (rep.water ? '' : bar('성벽', rep.wallFrom || 1, rep.wallFrom || 1)) +
      '<div class="bhud-round" id="bhud-round">전투 시작</div>' +
      '</div>';
  }
  function setBarRow(row, val, max) {
    if (!row) { return; }
    var pct = Math.round(core.clamp(val / Math.max(1, max), 0, 1) * 100);
    var i = row.querySelector('.bar > i');
    if (i) { i.style.width = pct + '%'; }
    var b = row.querySelector('b');
    if (b) { b.textContent = core.fmt(Math.max(0, Math.round(val))); }
  }
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
    liveStep = null; liveRepStub = null; liveBase = null;
    liveTactic = null;
    stopLiveClock();
    liveStance = null; liveQueued = null; livePaused = false; liveRound = 0; liveOn = false;
    var res = global.DG.war.marchInteractive(fromId, toId, lead, t, {
      formation: marchForm || undefined,
      onDuel: showDuelCard,
      onIntro: function (lines, repStub) {
        var html = (global.DG.battle3d ? '<canvas id="battle3d"></canvas>' : '') +
          '<div class="btop"><h3>⚔️ 전황 (진행 중)' +
            (repStub.land ? ' <small class="muted">' + (LAND_ICON[repStub.land] || '') + ' ' + esc(CD.LANDS[repStub.land].name) + '</small>' : '') + '</h3>' +
          battleHudHtml(repStub) + '<div class="bclock" id="bclock"></div></div>' +
          '<div class="bdock"><div class="warlog blog" id="livelog"></div><div class="bcmd" id="livecmd"></div></div><div id="liveresult"></div>';
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
      onPrompt: function (state, step) {
        liveStep = step;
        liveTactic = state.tactic || null;
        if (liveQueued && !(liveTactic && liveTactic.ok)) { liveQueued = null; }
        renderLiveCmd(true);
        armLiveClock();
      },
      onDone: function () {
        liveStep = null;
        stopLiveClock();
        renderLiveCmd(false);
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

  function renderTop() {
    var st = R().state();
    if (!st.started) {
      els.profile.innerHTML = '<div class="p-meta"><div class="p-title">사가국지 — 다스리고 꾀고 친다</div>' +
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
      coin('🍚', core.fmt(s.food), '군량') +
      '<button class="btn primary next-btn" data-act="next-month"' +
        (st.result ? ' disabled' : '') + '>▶ 다음 달</button>';
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

