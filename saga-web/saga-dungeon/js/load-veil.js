/**
 * 로딩 가림막(W-0275) — 사용자 10-17 "화면 로딩 되는 부분이 보기 싫어".
 * ---------------------------------------------------------------
 * 마을·던전 층에 처음 들어설 때 3D 모델(건물·내 몸·동료)이 다 오기 전엔 갈색 대역 상자가 섰다가 하나씩 툭 바뀌었다.
 * 들어선 지 80ms 에 높은 줄(asset3d.hiPending — 마을 사람 몸은 낮은 줄이라 안 기다린다)이 남아 있으면
 * 짙은 막 + 지명 + 진행 막대로 가렸다가, 다 오면(또는 최대 6초) 0.35초에 걷는다. 이미 받아 둔 곳은 막이 안 뜬다.
 * 이야기 장면(#scnbox)이 떠 있으면 그 위를 가리지 않는다. 진단(DG_NO_DRAW)·2D(받을 것이 없다)에선 안 뜬다.
 * W-0325(10-19): 걷는 조건 = 높은 줄이 다 옴 **또는 카메라 시야 안 몸의 GLB 비율 ≥ loadVeil.ratio(0.8)** · 상한 loadVeil.maxMs **8000**(옛 6000 — 상자 투성이 광장이 20초 보였다).
 * 순수 판정 `shouldHide(pending, ratio, ms)` 는 three 없이 돈다 — 자가진단이 본다.
 * 손잡이 `loadVeil.on`(1) · `loadVeil.maxMs`(8000) · `loadVeil.ratio`(0.8).
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var el = null, bar = null, key = null, armAt = 0, armed = false, shownAt = 0, maxP = 0, hiding = false;
  var MIN_MS = 300;

  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }
  function ratio() { var A = global.DG && global.DG.asset3d; return A && A.readyRatio ? A.readyRatio() : 1; }
  /** 걷을 때인가 — 'done'(다 옴)·'ratio'(시야 안 80%)·'max'(상한)·'' */
  function shouldHide(p, r, ms) { if (ms <= MIN_MS) { return ''; } if (p === 0) { return 'done'; } if (r >= tuned('loadVeil.ratio', 0.8)) { return 'ratio'; } if (ms > tuned('loadVeil.maxMs', 8000)) { return 'max'; } return ''; }
  function is3d() { var D3 = global.DG && global.DG.dungeon3d; return !!(D3 && ((D3.active && D3.active()) || (D3.wanted && D3.wanted()))); }
  /** W-0405 3D 몸 받기 줄 — 2D 면 0(2D 는 3D 몸을 안 그리는데 뒤에서 받는 GLB 를 기다려 마을·층 넘김이 최대 8초 막에 덮였다) */
  function pending() { var A = global.DG && global.DG.asset3d; return is3d() && A && A.hiPending ? A.hiPending() : 0; }
  function scen() { var S = global.DG && global.DG.scenario; return !!(S && S.isOpen && S.isOpen()); }
  function area() {
    var D = global.DG || {}, T = D.town, G = D.dungeon;
    if (doc.querySelector('#acc-host.show')) { return null; }   // 첫 화면(이어하기·가입) 동안은 아직 안 들어섰다
    if (T && T.active && T.active()) { return 'town'; }
    if (G && G.active && G.active()) { var r = G.raw ? G.raw() : null; return 'dungeon:' + (r ? r.floor : ''); }
    return null;
  }
  function label(a) {
    if (a === 'town') { return '마을로 들어서는 중'; }
    var f = String(a || '').split(':')[1];
    return f ? '제 ' + f + ' 층으로 내려가는 중' : '불러오는 중';
  }
  function css() {
    if (doc.getElementById('load-veil-css')) { return; }
    var st = doc.createElement('style'); st.id = 'load-veil-css';
    st.textContent = '#load-veil{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'background:radial-gradient(ellipse at center,#2a2118 0%,#120e0a 70%,#0a0806 100%);color:#e8d3a4;font:600 18px/1.4 serif;letter-spacing:.08em;' +
      'opacity:1;transition:opacity .35s ease;pointer-events:none}' +
      '#load-veil.out{opacity:0}#load-veil .lv-bar{width:min(52vw,320px);height:3px;background:rgba(232,211,164,.18);border-radius:2px;overflow:hidden}' +
      '#load-veil .lv-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#9c7a3c,#f0d58e);transition:width .2s}';
    doc.head.appendChild(st);
  }
  function show(a) {
    css();
    if (el) { el.remove(); why = 'again'; }
    el = doc.createElement('div'); el.id = 'load-veil';
    el.style.zIndex = String(String(a).indexOf('dungeon') === 0 ? 61 : 59);   // 던전은 #dungeon(60) 위 · 마을은 이야기 장면(#scnbox 60) 아래
    el.innerHTML = '<div class="lv-t"></div><div class="lv-bar"><i></i></div>';
    el.querySelector('.lv-t').textContent = label(a);
    bar = el.querySelector('.lv-bar i');
    doc.body.appendChild(el);
    shownAt = now(); hiding = false; maxP = Math.max(1, pending());
  }
  var why = '';
  function hide(w) {
    if (!el || hiding) { return; }
    why = w || '';
    hiding = true;
    if (bar) { bar.style.width = '100%'; }
    var e = el; e.classList.add('out');
    global.setTimeout(function () { if (e.parentNode) { e.parentNode.removeChild(e); } if (el === e) { el = null; bar = null; hiding = false; } }, 380);
  }
  /* W-0405 화면 넘김(사용자 10-25 「맵들을 분리해줘 화면이 넘어가면 넘어가는 형식으로」) — 방·층·던전 들어감·마을로 돌아옴(dungeon:room/floor/enter/end)마다 곧장 어둡게 덮고,
     3D 짓기 줄(dungeon3d.busy)이 비고 높은 줄 그림(pending)이 다 오면 0.3초에 걷는다(최소 0.18초 · 최대 loadVeil.cutMax 1.6초). 손잡이 loadVeil.cut(1) */
  var cutEl = null, cutAt = 0, hooked = false;
  function cutBusy() { var D3 = global.DG && global.DG.dungeon3d; return !!(D3 && D3.busy && D3.busy()); }
  function cut() {
    if (!doc || !doc.body || global.DG_NO_DRAW || !+tuned('loadVeil.cut', 1)) { return false; }
    if (!cutEl) { cutEl = doc.createElement('div'); cutEl.id = 'zone-cut'; cutEl.style.cssText = 'position:fixed;inset:0;z-index:62;background:#0b0907;opacity:0;pointer-events:none'; doc.body.appendChild(cutEl); }
    cutEl.style.transition = 'none'; cutEl.style.opacity = '1'; cutAt = now();
    return true;
  }
  function cutStep() {
    if (!cutEl || cutEl.style.opacity !== '1') { return; }
    var ms = now() - cutAt;
    var D3 = global.DG && global.DG.dungeon3d, d3 = !!(D3 && D3.active && D3.active());   // 2D 는 3D 짓기·그림 줄을 안 기다린다(0.18초 넘김만)
    if (ms < 180 || (d3 && ms < tuned('loadVeil.cutMax', 1600) && (cutBusy() || pending() > 0))) { return; }
    cutEl.style.transition = 'opacity .3s ease-out'; cutEl.style.opacity = '0';
  }
  function hook() { var C = global.DG && global.DG.core; if (hooked || !C || !C.on) { return; } hooked = true; ['dungeon:room', 'dungeon:floor', 'dungeon:enter', 'dungeon:end'].forEach(function (e) { C.on(e, function () { cut(); }); }); }
  function step() {
    hook(); cutStep();
    if (!tuned('loadVeil.on', 1)) { if (el) { hide(); } return; }
    var a = area(), t = now();
    if (a !== key) { key = a; armed = !!a; armAt = t; }
    /* 10-26 「아직 맵이 짤리는 느낌」 — 80ms 한 번만 보던 것: 그때 3D 가 아직 안 켜졌거나 줄이 비었거나 이야기 장면이 떠 있으면 막을 놓쳐
       빈 광장이 8초 동안 솟아올랐다(dg-load-seq 3초 집·사람 0). 들어선 뒤 loadVeil.armMs(2000) 동안 계속 보고, 장면이 떠 있는 동안은 기다린다.
       마을 막은 장면(#scnbox 60) 아래라 장면 중에도 띄운다. */
    var town = a === 'town';
    if (armed && t - armAt >= 80) {
      if (pending() > 0 && (town || !scen())) { armed = false; show(a); }
      else if (scen() && !town) { armAt = t - 80; }
      else if (t - armAt > tuned('loadVeil.armMs', 2000)) { armed = false; }
    }
    if (el && !hiding) {
      var p = pending(); maxP = Math.max(maxP, p);
      if (bar) { bar.style.width = Math.round(100 * (1 - p / maxP)) + '%'; }
      var hw = shouldHide(p, ratio(), t - shownAt); if (hw) { hide(hw); } else if (scen() && !town) { hide('scene'); } else if (a !== key || !a) { hide('area'); }
    }
  }

  global.DG = global.DG || {};
  global.DG.loadVeil = { shouldHide: shouldHide, step: step, cut: cut, cutShown: function () { return !!cutEl && cutEl.style.opacity === '1'; }, shown: function () { return !!el && !hiding; }, why: function () { return why; }, _hide: hide };
  if (!global.DG_NO_DRAW && global.setInterval) { global.setInterval(step, 100); }
})(window);
