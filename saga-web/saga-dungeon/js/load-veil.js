/**
 * 로딩 가림막(W-0275) — 사용자 10-17 "화면 로딩 되는 부분이 보기 싫어".
 * ---------------------------------------------------------------
 * 마을·던전 층에 처음 들어설 때 3D 모델(건물·내 몸·동료)이 다 오기 전엔 갈색 대역 상자가 섰다가 하나씩 툭 바뀌었다.
 * 들어선 지 80ms 에 높은 줄(asset3d.hiPending — 마을 사람 몸은 낮은 줄이라 안 기다린다)이 남아 있으면
 * 짙은 막 + 지명 + 진행 막대로 가렸다가, 다 오면(또는 최대 6초) 0.35초에 걷는다. 이미 받아 둔 곳은 막이 안 뜬다.
 * 이야기 장면(#scnbox)이 떠 있으면 그 위를 가리지 않는다. 진단(DG_NO_DRAW)·2D(받을 것이 없다)에선 안 뜬다.
 * 손잡이 `loadVeil.on`(1) · `loadVeil.maxMs`(6000).
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var el = null, bar = null, key = null, armAt = 0, armed = false, shownAt = 0, maxP = 0, hiding = false;
  var MIN_MS = 300;

  function tuned(k, d) { var C = global.DG && global.DG.core; return C && C.tuned ? C.tuned(k, d) : d; }
  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }
  function pending() { var A = global.DG && global.DG.asset3d; return A && A.hiPending ? A.hiPending() : 0; }
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
  function step() {
    if (!tuned('loadVeil.on', 1)) { if (el) { hide(); } return; }
    var a = area(), t = now();
    if (a !== key) { key = a; armed = !!a; armAt = t; }
    if (armed && t - armAt >= 80) {
      armed = false;
      if (pending() > 0 && !scen()) { show(a); }
    }
    if (el && !hiding) {
      var p = pending(); maxP = Math.max(maxP, p);
      if (bar) { bar.style.width = Math.round(100 * (1 - p / maxP)) + '%'; }
      if (p === 0 && t - shownAt > MIN_MS) { hide('done'); } else if (t - shownAt > tuned('loadVeil.maxMs', 6000)) { hide('max'); } else if (scen()) { hide('scene'); } else if (a !== key || !a) { hide('area'); }
    }
  }

  global.DG = global.DG || {};
  global.DG.loadVeil = { step: step, shown: function () { return !!el && !hiding; }, why: function () { return why; }, _hide: hide };
  if (!global.DG_NO_DRAW && global.setInterval) { global.setInterval(step, 100); }
})(window);
