/**
 * 끌어 놓기 — W-0362 (정본 shared/js/dragdrop.js → tools/sync-shared.mjs 가 판 js/ 로 복사)
 *
 * 사용자 10-20 "장비나 아이템 드래그 … 모바일은 터치". 마우스·터치 한 길(Pointer Events):
 *   마우스(펜 포함) — 누르고 HOLD_PX(6px) 움직이면 집는다. 안 움직이고 떼면 그냥 누르기(click) 그대로.
 *   터치 — HOLD_MS(350ms) 길게 눌러야 집는다. 집은 뒤 브라우저가 스크롤을 가져가면(pointercancel) "들고 있는 채"가 된다 — 스크롤해 받는 칸을 누르면 놓고, 딴 데를 누르면 취소.
 *    그 전에 MOVE_PX(8px) 넘게 움직이면 스크롤에 넘긴다(touch-action 기본 — 스크롤 안 막음).
 *   집으면 떠 있는 사본이 손가락을 따라가고, 받을 수 있는 칸은 금빛·못 받는 칸은 붉은 테. 놓은 칸이 받으면 drop, 아니면 취소. Esc·pointercancel 도 취소.
 * 판은 `DG.dragdrop.bind(root, { accepts(item, key, el), drop(item, key, el) })` 만 준다 — 끌 칸은 `data-dd="<값>"`, 받을 칸은 `data-dd-drop="<열쇠>"`.
 * 실제 끼기·벗기는 판의 기존 함수가 한다(이 파일은 세이브를 모른다). 기존 단추 길은 그대로(접근성).
 * 순수 판정 `decide(kind, ms, px)` 는 진단이 부른다. 겉모양은 ui-kit.css 의 "끌어 놓기" 절.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var HOLD_MS = 350, HOLD_PX = 6, MOVE_PX = 8;

  /** 순수 — 누른 뒤 ms 지나 px 움직였을 때: 'wait'(아직) · 'pick'(집음) · 'scroll'(터치가 먼저 움직임 — 넘김) */
  function decide(kind, ms, px) {
    if (kind === 'touch') { return px > MOVE_PX ? 'scroll' : (ms >= HOLD_MS ? 'pick' : 'wait'); }
    return px >= HOLD_PX ? 'pick' : 'wait';
  }

  var cur = null;   // { cfg, root, src, item, id, kind, x0, y0, t0, timer, picked, ghost, hover }

  function dist(e) { return Math.hypot(e.clientX - cur.x0, e.clientY - cur.y0); }
  function targets() { return [].slice.call(cur.root.querySelectorAll('[data-dd-drop]')); }
  /* 터치로 집은 뒤엔 브라우저가 스크롤을 시작하며 pointercancel 을 낸다(touch-action 은 누를 때 정해져 바꿀 수 없다) —
     그래서 집은 터치는 touchmove·touchend 로 따라간다(스크롤은 막고). 마우스는 pointer 그대로 */
  function noTouchScroll(e) {
    if (!cur || !cur.picked || cur.sticky) { return; }
    e.preventDefault();
    var t = cur.kind === 'touch' && e.touches && e.touches[0];
    if (t) { cur.tracked = true; moveTo(t.clientX, t.clientY); }   // 이 뒤로는 touchend 가 끝낸다(pointerup 은 건너뜀)
  }
  function touchEnd(e) { if (cur && cur.picked && cur.kind === 'touch' && !cur.sticky) { var t = e.changedTouches && e.changedTouches[0]; if (t) { cur.lx = t.clientX; cur.ly = t.clientY; } hoverAt(cur.lx, cur.ly); end(e.type === 'touchend'); } }
  function moveTo(x, y) {
    cur.lx = x; cur.ly = y;
    if (cur.ghost) { cur.ghost.style.left = x + 'px'; cur.ghost.style.top = y + 'px'; }
    hoverAt(x, y);
  }

  function pick() {
    if (!cur || cur.picked) { return; }
    cur.picked = true;
    if (!cur.src.isConnected) {   // 누른 뒤 집기 전에 판이 창을 다시 그렸으면(innerHTML) 같은 값의 새 칸으로
      var nv = [].slice.call(cur.root.querySelectorAll('[data-dd]')).filter(function (x) { return x.getAttribute('data-dd') === cur.item; })[0];
      if (nv) { cur.src = nv; }
    }
    var r = cur.src.getBoundingClientRect(), g = cur.src.cloneNode(true);
    g.className += ' dd-ghost'; g.removeAttribute('data-dd'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.style.left = cur.lx + 'px'; g.style.top = cur.ly + 'px';
    doc.body.appendChild(g); cur.ghost = g;
    cur.src.classList.add('dd-src'); cur.root.classList.add('dd-on');
    targets().forEach(function (t) { t.classList.add(cur.cfg.accepts(cur.item, t.getAttribute('data-dd-drop'), t) ? 'dd-ok' : 'dd-no'); });
    try { cur.src.setPointerCapture(cur.id); } catch (e) { /* 합성 이벤트(진단)는 잡을 포인터가 없다 */ }
    cur.sc = scrollerOf(cur.src) || scrollerOf(doc.elementFromPoint ? doc.elementFromPoint(cur.lx, cur.ly) : null); if (cur.sc && global.requestAnimationFrame) { cur.raf = global.requestAnimationFrame(edgeStep); }
    if (global.navigator && global.navigator.vibrate && cur.kind === 'touch') { try { global.navigator.vibrate(12); } catch (e) { /* 없음 */ } }
  }

  /* 가장자리 스크롤 — 창(시트)이 길어 가방(아래)과 인형 칸(위)이 한 화면에 안 들 때: 집은 채 스크롤 칸의 위·아래 EDGE px 안에 있으면 그쪽으로 민다 */
  var EDGE = 56, SPEED = 840;   // px/초 — 판이 무거워 프레임이 드물어도 같은 빠르기(프레임마다 고정 px 면 느린 폰에서 기어간다)
  function scrollerOf(el) {
    for (var e = el && el.parentElement; e && e !== doc.body; e = e.parentElement) {
      var oy = global.getComputedStyle ? global.getComputedStyle(e).overflowY : '';
      if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 4) { return e; }
    }
    return null;
  }
  function edgeStep() {
    if (!cur || !cur.picked) { return; }
    var sc = cur.sc;
    if (sc) {
      var r = sc.getBoundingClientRect(), y = cur.ly, d = y < r.top + EDGE ? -1 : (y > r.bottom - EDGE ? 1 : 0);
      var now = Date.now(), dt = Math.min(0.25, (now - (cur.edgeT || now)) / 1000); cur.edgeT = now;
      if (d && dt > 0) { var k = d < 0 ? (r.top + EDGE - y) / EDGE : (y - (r.bottom - EDGE)) / EDGE; sc.scrollTop += d * Math.ceil(SPEED * dt * Math.min(1.5, Math.max(0.3, k))); hoverAt(cur.lx, cur.ly); }
    }
    cur.raf = global.requestAnimationFrame ? global.requestAnimationFrame(edgeStep) : null;
  }

  function hoverAt(x, y) {
    var el = doc.elementFromPoint ? doc.elementFromPoint(x, y) : null, t = el && el.closest ? el.closest('[data-dd-drop]') : null;
    if (t && !cur.root.contains(t)) { t = null; }
    if (cur.hover !== t) { if (cur.hover) { cur.hover.classList.remove('dd-hover'); } if (t) { t.classList.add('dd-hover'); } cur.hover = t; }
    return t;
  }

  function end(ok) {
    if (!cur) { return false; }
    var c = cur, done = false;
    cur = null;
    if (c.timer) { clearTimeout(c.timer); }
    if (c.raf && global.cancelAnimationFrame) { global.cancelAnimationFrame(c.raf); }
    if (c.picked) {
      var t = c.hover;
      if (ok && t && c.cfg.accepts(c.item, t.getAttribute('data-dd-drop'), t)) { done = c.cfg.drop(c.item, t.getAttribute('data-dd-drop'), t) !== false; }
      if (c.ghost) { c.ghost.remove(); }
      c.src.classList.remove('dd-src'); c.root.classList.remove('dd-on', 'dd-sticky-on');
      if (!done && global.DG.core && global.DG.core.emit) { global.DG.core.emit('changed'); }   // 끄는 동안 미룬 다시 그리기(판 renderSheet 가 active 면 쉰다) — 놓아 끼웠으면 판 함수가 이미 냈다
      [].slice.call(c.root.querySelectorAll('.dd-ok, .dd-no, .dd-hover')).forEach(function (x) { x.classList.remove('dd-ok', 'dd-no', 'dd-hover'); });
      /* 집었다 놓은 뒤 따라오는 click 은 원래 단추(칸 고르기·벗기)를 누르지 않게 한 번 삼킨다 — 진짜 손만(합성 이벤트 진단은 click 이 안 따라온다) */
      if (c.trusted) { var eat = function (e) { e.stopPropagation(); e.preventDefault(); doc.removeEventListener('click', eat, true); };
      doc.addEventListener('click', eat, true); setTimeout(function () { doc.removeEventListener('click', eat, true); }, 400); }
    }
    return done;
  }

  function onDown(e) {
    if (cur && cur.sticky) {   // 들고 있는 채(터치 — 브라우저가 스크롤을 가져갔다): 받는 칸을 누르면 놓고, 다른 데를 누르면 내려놓는다(취소)
      var tg = e.target && e.target.closest ? e.target.closest('[data-dd-drop]') : null;
      if (cur.hover) { cur.hover.classList.remove('dd-hover'); } cur.hover = tg && cur.root.contains(tg) ? tg : null;
      if (e.preventDefault) { e.preventDefault(); }
      end(!!cur.hover); return;
    }
    if (cur || (e.button !== undefined && e.button > 0)) { return; }
    var root = this, cfg = root.__dd, src = e.target && e.target.closest ? e.target.closest('[data-dd]') : null;
    if (!cfg || !src || !root.contains(src)) { return; }
    var kind = e.pointerType === 'touch' ? 'touch' : 'mouse';
    cur = { cfg: cfg, root: root, src: src, item: src.getAttribute('data-dd'), id: e.pointerId, kind: kind, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: Date.now(), timer: null, picked: false, ghost: null, hover: null, trusted: e.isTrusted !== false };
    if (kind === 'touch') { cur.timer = setTimeout(function () { if (cur && decide('touch', Date.now() - cur.t0, 0) === 'pick') { pick(); hoverAt(cur.lx, cur.ly); } }, HOLD_MS); }
  }
  function onMove(e) {
    if (!cur || cur.sticky || e.pointerId !== cur.id) { return; }
    cur.lx = e.clientX; cur.ly = e.clientY;
    if (!cur.picked) {
      var d = decide(cur.kind, Date.now() - cur.t0, dist(e));
      if (d === 'scroll') { end(false); return; }
      if (d === 'pick') { pick(); } else { return; }
    }
    moveTo(e.clientX, e.clientY);
    e.preventDefault();
  }
  function onUp(e) { if (cur && !cur.sticky && e.pointerId === cur.id && !(cur.picked && cur.kind === 'touch' && cur.tracked)) { if (cur.picked) { hoverAt(e.clientX, e.clientY); } end(true); } }
  function onCancel(e) {
    if (!cur || (e && e.pointerId !== cur.id)) { return; }
    if (cur.picked && cur.kind === 'touch') { goSticky(); return; }   // 집은 뒤 브라우저가 스크롤을 가져감 → 들고 있는 채로(놓을 칸을 눌러서)
    end(false);
  }
  function goSticky() {
    if (!cur || cur.sticky) { return; }
    cur.sticky = true;
    if (cur.raf && global.cancelAnimationFrame) { global.cancelAnimationFrame(cur.raf); cur.raf = null; }
    if (cur.ghost) { cur.ghost.classList.add('dd-sticky'); }
    cur.root.classList.add('dd-sticky-on');
  }

  var wired = false;
  /** root 아래 [data-dd] 칸을 끌 수 있게 — 한 root 에 한 번(다시 부르면 cfg 만 갈아 낌). 창을 다시 그려도 위임이라 그대로 된다 */
  function bind(root, cfg) {
    if (!root || !cfg || !cfg.accepts || !cfg.drop) { return false; }
    var had = !!root.__dd;
    root.__dd = cfg;
    if (!had) { root.addEventListener('pointerdown', onDown); }
    if (!wired && doc) {
      wired = true;
      doc.addEventListener('pointermove', onMove, { passive: false });
      doc.addEventListener('pointerup', onUp);
      doc.addEventListener('pointercancel', onCancel);
      doc.addEventListener('touchmove', noTouchScroll, { passive: false });   // 집은 뒤에만 막는다 — 길게 누르기 전엔 스크롤 그대로
      doc.addEventListener('touchend', touchEnd); doc.addEventListener('touchcancel', touchEnd);
      doc.addEventListener('scroll', function () { if (cur && !cur.picked) { end(false); } }, true);   // 창이 스크롤되면 집기 취소(집은 뒤 가장자리 스크롤은 그대로)
      global.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) { end(false); e.stopImmediatePropagation(); } }, true);
    }
    return true;
  }

  global.DG = global.DG || {};
  global.DG.dragdrop = {
    bind: bind, decide: decide, HOLD_MS: HOLD_MS, HOLD_PX: HOLD_PX, MOVE_PX: MOVE_PX,
    active: function () { return !!(cur && cur.picked); }, _state: function () { return cur ? { picked: cur.picked, sc: cur.sc ? (cur.sc.id || cur.sc.className) : null, raf: !!cur.raf, lx: cur.lx, ly: cur.ly } : null; }, cancel: function () { return end(false); },
    /** 진단용 — DOM 이벤트를 쏘지 않고 손놀림을 먹인다(문서까지 올라간 합성 pointer 가 판의 '첫 눌림'·소리 풀기를 건드리지 않게). type = down|move|up, e = { target, clientX, clientY, pointerId, pointerType } */
    _feed: function (type, e, root) { var ev = { preventDefault: function () {}, button: 0, isTrusted: false, target: e.target, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType }; if (type === 'down') { onDown.call(root, ev); } else if (type === 'move') { onMove(ev); } else if (type === 'cancel') { onCancel(ev); } else { onUp(ev); } },
    /** 진단용 — 길게 누르기 시계를 기다리지 않고 지금 집는다(터치) */
    _holdNow: function () { if (cur && !cur.picked) { if (cur.timer) { clearTimeout(cur.timer); } cur.t0 -= HOLD_MS; pick(); hoverAt(cur.lx, cur.ly); } return !!(cur && cur.picked); }
  };
})(window);
