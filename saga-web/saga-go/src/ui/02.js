  /* ── 인물 · 펫 상세 — js/ui-detail.js(R-4). 같은 이름 한 줄 넘김 · growth·buddy 는 시트도 써서 여기 남김 ─────── */
  function growth() { return global.DG.growth || null; }
  function buddy() { return global.DG.buddy || null; }
  var udH = null; function UD() { return global.DG.uiDetail.setup(udH || (udH = { $: $, esc: esc, els: els, hero: hero, net: net, ico: ico, distLabel: distLabel, p3src: p3src, p3tag: p3tag, growth: growth, buddy: buddy })); }
  function detailHost() { return UD().host(); }
  function openDetail(kind, id) { UD().open(kind, id); }
  function closeDetail() { UD().close(); }
  function renderDetail() { UD().render(); }

  /* ── 토스트 ───────────────────────────────────────────── */

  /**
   * 갈래 있는 토스트 + 짧은 큐(축1, 2026-09-06 "알림이 약하다").
   * 여태는 문자열 하나뿐이라 늘 같은 금테로 떴다 — `type`('good'|'bad'|'find')을
   * 얹으면 색이 갈리고, `find`(걷다가 무언가 찾은 것)는 더 밝고 오래 뜬다.
   * 옛 호출(`toast(문자열)`, `core.emit('toast', 문자열)`)은 그대로 `info`로 온다.
   * 짧은 사이에 여럿이 몰리면(걷기 흥 토스트가 실제로 그렇다) 그냥 덮어쓰던 것을
   * 큐에 쌓아 하나씩 보여준다 — 안 그러면 스치는 알림이 서로를 지운다.
   */
  var toastTimer = null;
  var toastQueue = [];
  var toastBusy = false;

  function pumpToast() {
    if (toastBusy || !toastQueue.length) { return; }
    var t = toastQueue.shift();
    toastBusy = true;
    els.toast.textContent = t.msg;
    els.toast.className = 'show' + (t.type !== 'info' ? ' t-' + t.type : '');
    if (toastTimer) { clearTimeout(toastTimer); }
    var dur = global.innerWidth <= 520 ? 2500 : t.type === 'find' ? 3400 : 2600;   // W-0363 폰은 맨 위 한 줄 2.5초
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
      toastBusy = false;
      setTimeout(pumpToast, 140);
    }, dur);
  }

  function toast(msg, type) {
    if (msg && typeof msg === 'object') { type = msg.type; msg = msg.msg; }
    if (!msg) { return; }
    toastQueue.push({ msg: msg, type: type || 'info' });
    while (toastQueue.length > 4) { toastQueue.shift(); }   // 너무 밀리면 오래된 것부터 버린다
    pumpToast();
  }

  /**
   * 레벨 업 — 여태 `core.log`(기록 시트에나 남는 글자 한 줄)뿐이었다(축3,
   * "레벨업도 숫자 말고는 연출이 약하다"). `core.emit('levelup', lv)`는
   * 이미 있었는데 듣는 곳이 없었다 — 화면 가운데 잠깐 뜨는 띠 하나만 붙인다.
   * 조작을 막지 않는다(pointer-events:none) — 걷거나 싸우는 중에도 그냥 지나간다.
   */
  var levelupTimer = null;
  function showLevelUp(lv) {
    if (!els.levelup) { return; }
    els.levelup.innerHTML = '<div class="lv-banner"><b>LEVEL UP</b><span>' + (global.DG.adventure ? '여정 등급 ' : 'Lv.') + lv + '</span></div>';
    els.levelup.classList.remove('show');
    void els.levelup.offsetWidth;               // 리플로우를 강제해 연타 레벨업도 매번 다시 재생한다
    els.levelup.classList.add('show');
    if (levelupTimer) { clearTimeout(levelupTimer); }
    levelupTimer = setTimeout(function () { els.levelup.classList.remove('show'); }, 1800);
  }

  /**
   * 마무리 카드 — PLAN §5 ④, 표준 B(세션 마무리 카드). `visibilitychange hidden`
   * ·5분 무입력·자동 순행 끔에서 game.js 가 diff(걸음·만남·금)를 재서 부른다.
   * `#encounter`(조우 모달)를 그대로 빌려 쓴다 — game.js 가 부르기 전에
   * `event.live`(다른 조우가 열려 있는지)를 먼저 살핀다.
   */
  var sessionCardTimer = null;
  function showSessionCard(diff) {
    var el = $('encounter');
    if (!el) { return; }
    var rate = global.DG.codex ? global.DG.codex.rate() : null;
    el.innerHTML =
      '<div class="enc-card">' +
        '<h3 style="margin:0 0 6px;font-size:17px">🌙 이번 나들이</h3>' +
        '<div class="stat-row"><span>걸음</span><b>' + core.fmt(diff.steps) + 'm</b></div>' +
        '<div class="stat-row"><span>만남</span><b>' + core.fmt(diff.meet) + '</b></div>' +
        '<div class="stat-row"><span>금</span><b>🪙 ' + core.fmt(diff.gold) + '</b></div>' +
        (rate ? '<div class="stat-row"><span>도감</span><b>' + rate.pct + '%</b></div>' : '') +
        '<div class="p-goal now" style="margin-top:8px">다음 · 🧭 ' + goalNowText() + '</div>' +
        '<button class="btn primary wide" id="daily-card-ok">확인</button>' +
      '</div>';
    el.classList.add('show');
    var close = function () {
      el.classList.remove('show'); el.innerHTML = '';
      if (sessionCardTimer) { clearTimeout(sessionCardTimer); sessionCardTimer = null; }
    };
    var btn = $('daily-card-ok');
    if (btn) { btn.addEventListener('click', close); }
    if (sessionCardTimer) { clearTimeout(sessionCardTimer); }
    sessionCardTimer = setTimeout(close, 5000);
  }

  /** 매 프레임이 아니라 주기적으로만 갱신한다 */
  function tickRefresh() {
    renderTop();
    renderNear();
    renderAutoBar();
    syncHeaderStack();
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'INPUT') && els['sheet-body'].contains(a)) { return; }
    if (openTab === 'oracle' || openTab === 'dungeon') { renderSheet(); }
  }

  /**
   * 상단 띠(#top)의 실제 높이는 고정이 아니다 — 손잡이 줄(🎛️)이 붙거나 지갑이
   * 두 줄로 접히면 늘어난다. `#autobar`·`#minimap` 이 그걸 모른 채 `top:106px`
   * 같은 값으로 박혀 있으면 그 밑에 겹쳐 버린다(자동 순행 문구가 지갑을 덮은
   * 실기기 신고로 잡았다) — 매 갱신마다 실제로 재서 CSS 변수로 넘긴다.
   */
  function syncHeaderStack() {
    if (!els.wallet) { return; }
    var topBottom = Math.ceil(els.wallet.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--top-bottom', topBottom + 'px');
    var belowHeader = topBottom;
    var root = document.documentElement.style, autoH = 0;
    if (els.autobar && els.autobar.classList.contains('show')) {
      var ab = els.autobar.getBoundingClientRect();
      belowHeader = Math.max(belowHeader, Math.ceil(ab.bottom));
      autoH = Math.ceil(ab.height) + 6;
    }
    /* 폰 세로 — 지역 사명·이야기 추적 줄이 `top:58px`·`86px` 고정이라 두 줄로 불어난 윗 카드
       위에 겹쳤다. 자동 순행 띠 밑으로 차례로 쌓고(CSS 600px 규칙), 미니맵은 그 밑으로 */
    if (isPhonePortrait()) {
      root.setProperty('--autobar-h', autoH + 'px');
      var rm = document.getElementById('region-mission'), mh = 0;
      if (rm && rm.style.display !== 'none' && rm.textContent) { mh = Math.ceil(rm.getBoundingClientRect().height) + 4; }
      root.setProperty('--mission-h', mh + 'px');
      ['region-mission', 'story-track'].forEach(function (id) {
        var e = document.getElementById(id);
        if (e && e.style.display !== 'none' && e.textContent) { belowHeader = Math.max(belowHeader, Math.ceil(e.getBoundingClientRect().bottom)); }
      });
    }
    root.setProperty('--below-header', belowHeader + 'px'); var stk = document.getElementById('story-track'), sb = stk && stk.style.display !== 'none' && stk.textContent ? Math.ceil(stk.getBoundingClientRect().bottom) : 0; root.setProperty('--toast-top', Math.max(84, sb + 6) + 'px');   // W-0127 — 알림이 이야기 띠(#story-track)를 덮지 않게 그 밑으로
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
  /* 2026-09-09 — "움직이는 게 너무 힘들다"(사가나락 등과 같은 재신고).
     이 판은 실제 GPS 로 걷는 게 원작 컨셉이라 오버월드 이동에 조이스틱은
     안 맞지만, PC 프로토타입용 "키보드(모의 이동)" 모드(world.js
     mode==='keyboard')에는 그대로 맞는다 — world.js 에 이미 있던
     setStick(dx,dy) 채널(그때까지 아무 화면도 안 부르고 있었다)에 연결한다.
     GPS 로 전환하면(#btn-geo) 숨긴다 — 실제로 걷는 동안 손가락 조작이
     끼어들면 안 된다. */
  function stickSync() {
    var joyEl = $('gjoy'), padEl = $('gpad');
    if (!joyEl || !padEl) { return; }
    var W = global.DG.world;
    var on = !!(W && W.mode === 'keyboard');
    var isTouch = !!(('ontouchstart' in global) || (navigator.maxTouchPoints > 0));
    joyEl.classList.toggle('show', on && isTouch);
    padEl.classList.toggle('show', on && !isTouch);
  }
  function initStick() {
    var joyEl = $('gjoy'), joyKnob = $('gjoy-knob'), padEl = $('gpad');
    if (!joyEl || !joyKnob || !padEl) { return; }
    stickSync();
    var W = global.DG.world;
    var joyId = null, joyCX = 0, joyCY = 0;
    var JOY_R = 46, JOY_DEAD = 8;
    function knobAt(dx, dy) { joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    function reset() { joyId = null; knobAt(0, 0); W.setStick(0, 0, false); joyEl.classList.remove('held'); }   // W-0363 폰: 받침 원은 누를 때만(.held)
    joyEl.addEventListener('pointerdown', function (e) {
      if (joyId !== null) { return; }
      var r = joyEl.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      joyId = e.pointerId; joyEl.classList.add('held');
      joyEl.setPointerCapture && joyEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', function (e) {
      if (e.pointerId !== joyId) { return; }
      var dx = e.clientX - joyCX, dy = e.clientY - joyCY;
      var len = Math.hypot(dx, dy);
      var kx = len > JOY_R ? dx / len * JOY_R : dx, ky = len > JOY_R ? dy / len * JOY_R : dy;
      knobAt(kx, ky);
      if (len < JOY_DEAD) { W.setStick(0, 0, false); return; }
      W.setStick(dx / len, dy / len, !!(global.DG.keys && global.DG.keys.joyRun(len, JOY_R)));   // W-0174 끝까지(85%↑) 밀면 달린다(Shift 와 같은 ×2.2)
      e.preventDefault();
    });
    function release(e) { if (e.pointerId === joyId) { reset(); } }
    joyEl.addEventListener('pointerup', release);
    joyEl.addEventListener('pointercancel', release);
    joyEl.addEventListener('pointerleave', release);

    var held = { up: false, down: false, left: false, right: false };
    function apply() {
      var dx = (held.left ? -1 : 0) + (held.right ? 1 : 0);
      var dy = (held.up ? -1 : 0) + (held.down ? 1 : 0);
      var len = Math.hypot(dx, dy);
      W.setStick(len ? dx / len : 0, len ? dy / len : 0, !!(len && global.DG.keys && global.DG.keys.padRun()));   // W-0174 두 번 톡 = 달리기(keys.js)
    }
    var btns = padEl.querySelectorAll('button[data-dir]');
    for (var pi = 0; pi < btns.length; pi++) {
      (function (btn) {
        var dir = btn.getAttribute('data-dir');
        btn.addEventListener('pointerdown', function (e) {
          held[dir] = true; apply();
          btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        function rel() { held[dir] = false; apply(); }
        btn.addEventListener('pointerup', rel);
        btn.addEventListener('pointercancel', rel);
        btn.addEventListener('pointerleave', rel);
      })(btns[pi]);
    }
  }

  global.DG.ui = {
    init: init, toast: toast, tickRefresh: tickRefresh,
    openSheet: openSheet, closeSheet: closeSheet,
    openDetail: openDetail, closeDetail: closeDetail,
    renderPanel: renderSheet, renderHud: renderTop,
    syncStick: stickSync,
    goalNowText: goalNowText, showSessionCard: showSessionCard
  };
})(window);
