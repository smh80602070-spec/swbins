/**
 * 폰 배치 점검 — 페이지 안에서 도는 측정 함수(스크린샷 없이 rect 숫자만).
 * probe.js 가 문자열로 떠서 Runtime.evaluate 로 부른다. 바깥 변수를 쓰지 말 것.
 *
 * 돌려주는 것: { vw, vh, hscroll, off[], clip[], font[], tap[], covered[], overlap[] }
 *   off      화면 밖으로 나간 UI(스크롤 상자 안은 뺀다 — 그건 스크롤로 닿는다)
 *   unreach  스크롤 상자의 시작 쪽 밖으로 밀려 스크롤로도 못 닿는 단추
 *   clip     overflow:hidden 부모에 30% 넘게 잘린 단추
 *   font     글자 11px 미만(글자를 직접 가진 요소)
 *   tap      터치 대상 40px 미만(짧은 변)
 *   covered  단추 가운데를 다른 요소가 덮음(elementFromPoint)
 *   overlap  떠 있는(fixed/absolute) UI 덩어리끼리 겹침
 *   modal    화면 60% 넘게 덮은 창이 가린 단추 수(결함으로 안 센다 — 창이 열린 장면)
 */
function __sagaMeasure(opt) {
  opt = opt || {};
  var MIN_FONT = opt.minFont || 11, MIN_TAP = opt.minTap || 40;
  var vw = innerWidth, vh = innerHeight;
  var ignore = opt.ignore ? new RegExp(opt.ignore) : null;
  var modalSel = opt.modal || null;   /* 판이 창으로 쓰는 투명 덮개(사가스토리 #storybox 처럼 배경 없이 화면을 덮는 것) */

  function name(el) {
    if (!el || el.nodeType !== 1) { return '?'; }
    var s = el.tagName.toLowerCase();
    if (el.id) { return s + '#' + el.id; }
    var c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (c.length) { s += '.' + c.join('.'); }
    /* 이름 없는 요소는 가까운 id 조상을 붙여 어디인지 읽히게 */
    var p = el.parentElement, hop = 0;
    while (p && !p.id && hop < 6) { p = p.parentElement; hop++; }
    if (p && p.id) { s = '#' + p.id + ' ' + s; }
    return s;
  }
  function text(el) {
    var t = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').trim();
    return t.length > 18 ? t.slice(0, 18) + '…' : t;
  }
  function vis(el) {
    if (!el.checkVisibility || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) { return false; }
    var r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  }
  function ownText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && /\S/.test(n.nodeValue)) { return true; }
    }
    return false;
  }
  function interactive(el) {
    var t = el.tagName;
    if (t === 'BUTTON' || t === 'SELECT' || t === 'TEXTAREA' || t === 'SUMMARY') { return true; }
    if (t === 'INPUT') { return el.type !== 'hidden'; }
    if (t === 'A' && el.hasAttribute('href')) { return true; }
    if (el.hasAttribute('onclick')) { return true; }
    var role = el.getAttribute('role');
    return role === 'button' || role === 'tab' || role === 'link';
  }
  /* 스크롤·잘림 조상 — 가장 가까운 것 */
  function clipAncestor(el) {
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var cs = getComputedStyle(p), ox = cs.overflowX, oy = cs.overflowY;
      if (ox !== 'visible' || oy !== 'visible') { return { el: p, scroll: /auto|scroll/.test(ox + oy) }; }
      if (cs.position === 'fixed') { return null; }
    }
    return null;
  }
  function keep(el) { return !(ignore && ignore.test(name(el))); }

  /* scope — 시트 장면처럼 그 창 안쪽만 잴 때(창 밖 HUD 가 창 밑에 깔린 건 결함이 아니다) */
  var root = opt.scope ? document.querySelector(opt.scope) : document.body;
  if (!root) { root = document.body; }
  var all = Array.prototype.slice.call(root.querySelectorAll('*')).filter(function (el) {
    var t = el.tagName;
    if (t === 'SCRIPT' || t === 'STYLE' || t === 'CANVAS' || t === 'svg' || t === 'SVG' || t === 'BR' || t === 'OPTION') { return false; }
    if (el.closest('svg')) { return false; }
    return vis(el) && keep(el);
  });

  var off = [], unreach = [], clip = [], font = [], tap = [], covered = [], overlap = [], modal = {};
  /* 창(모달) — 덮은 요소의 fixed 조상이 화면의 60% 넘게 덮으면 그 창이 열린 것. 그 밑 단추가 가린 건 결함이 아니다 */
  function modalOf(el) {
    for (var p = el; p && p !== document.body; p = p.parentElement) {
      if (modalSel && p.matches(modalSel)) { return p; }
      var cs = getComputedStyle(p);
      if (cs.position === 'fixed' && p.tagName !== 'CANVAS') {
        var r = p.getBoundingClientRect();
        var painted = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || cs.backdropFilter !== 'none';
        if (painted && r.width * r.height > vw * vh * 0.6) { return p; }
      }
    }
    return null;
  }
  var seen = { font: {}, tap: {}, off: {} };

  all.forEach(function (el) {
    var r = el.getBoundingClientRect();
    var ui = interactive(el) || ownText(el);
    if (ui) {
      var ca = clipAncestor(el);
      if (!ca) {
        var o = Math.max(r.right - vw, -r.left, r.bottom - vh, -r.top);
        if (o > 2) {
          var k = name(el);
          if (!seen.off[k]) {
            seen.off[k] = 1;
            off.push({ el: k, text: text(el), out: Math.round(o), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
          }
        }
      } else if (ca.scroll && interactive(el)) {
        /* 스크롤 상자에서 **시작 쪽(왼쪽·위) 밖**으로 밀린 단추는 스크롤로도 못 닿는다(flex-end + overflow 함정) */
        var q = ca.el.getBoundingClientRect();
        var lo = (q.left - ca.el.scrollLeft) - r.left, to = (q.top - ca.el.scrollTop) - r.top;
        if (lo > 2 || to > 2) { unreach.push({ el: name(el), text: text(el), by: name(ca.el), out: Math.round(Math.max(lo, to)) }); }
      } else if (!ca.scroll && interactive(el)) {
        var a = ca.el.getBoundingClientRect();
        var iw = Math.max(0, Math.min(r.right, a.right) - Math.max(r.left, a.left));
        var ih = Math.max(0, Math.min(r.bottom, a.bottom) - Math.max(r.top, a.top));
        var lost = 1 - (iw * ih) / (r.width * r.height);
        if (lost > 0.3) { clip.push({ el: name(el), text: text(el), by: name(ca.el), lost: Math.round(lost * 100) }); }
      }
    }
    if (ownText(el)) {
      var fs = parseFloat(getComputedStyle(el).fontSize);
      if (el instanceof SVGElement && el.getScreenCTM) { var ctm = el.getScreenCTM(); if (ctm) { fs *= Math.hypot(ctm.a, ctm.b); } }   /* SVG 글자는 좌표 단위 — 화면에 그려진 크기로 잰다 */
      if (fs < MIN_FONT - 0.01) {
        var kf = name(el);
        if (!seen.font[kf]) { seen.font[kf] = 1; font.push({ el: kf, text: text(el), px: Math.round(fs * 10) / 10 }); }
      }
    }
    if (interactive(el) && getComputedStyle(el).pointerEvents !== 'none') {
      var inView = r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
      if (inView && !el.disabled) {
        var m = Math.min(r.width, r.height);
        if (m < MIN_TAP - 0.5) {
          var kt = name(el);
          if (!seen.tap[kt]) { seen.tap[kt] = 1; tap.push({ el: kt, text: text(el), w: Math.round(r.width), h: Math.round(r.height) }); }
        }
        /* 덮은 게 제 조상이면(스크롤 상자 여백·label) 가린 게 아니다.
           가운데는 보이는 부분(화면·스크롤 상자와 겹친 곳)의 가운데 — 스크롤로 반쯤 밀려난 단추는 남은 쪽을 본다 */
        var L = Math.max(r.left, 0), T = Math.max(r.top, 0), R = Math.min(r.right, vw), B = Math.min(r.bottom, vh);
        var sa = clipAncestor(el);
        if (sa) { var q = sa.el.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); }
        var hit = (R - L > 2 && B - T > 2) ? document.elementFromPoint((L + R) / 2, (T + B) / 2) : null;
        var cx = Math.round((L + R) / 2), cy = Math.round((T + B) / 2);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
          var layer = modalOf(hit);
          if (layer && !layer.contains(el)) { modal[name(layer)] = (modal[name(layer)] || 0) + 1; }
          else { covered.push({ el: name(el), text: text(el), by: name(hit), byText: text(hit), at: [Math.round(cx), Math.round(cy)] }); }
        }
      }
    }
  });

  /* 떠 있는 UI 덩어리 — fixed/absolute 중 화면의 60% 미만, 글자나 단추를 품은 것 */
  var area = vw * vh;
  var floats = all.filter(function (el) {
    var cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && cs.position !== 'sticky') { return false; }
    if (cs.pointerEvents === 'none' && !(el.innerText || '').trim()) { return false; }
    var r = el.getBoundingClientRect();
    if (r.width * r.height > area * 0.6) { return false; }
    if (r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh) { return false; }
    return !!(el.innerText || '').trim() || interactive(el) || !!el.querySelector('button,input,select,a[href],[onclick],[role=button]');
  });
  /* 조상이 이미 목록에 있으면 그 조상으로 대표(같은 덩어리 안 부품끼리는 비교 안 함) */
  floats = floats.filter(function (el) {
    for (var p = el.parentElement; p; p = p.parentElement) { if (floats.indexOf(p) >= 0) { return false; } }
    return true;
  });
  /* 겹침은 덩어리 상자가 아니라 **속 내용**(글자·단추·그림) 사각형끼리 본다 — 빈 여백끼리 닿는 건 안 보인다 */
  function parts(el) {
    var o = [];
    [el].concat(Array.prototype.slice.call(el.querySelectorAll('*'))).forEach(function (e) {
      if (!vis(e)) { return; }
      if (interactive(e) || e.tagName === 'IMG' || e.tagName === 'CANVAS') { o.push(e.getBoundingClientRect()); }
      else if (ownText(e)) {
        /* 글자 상자는 블록 폭 전체가 아니라 실제 글자가 앉은 자리(가운데 정렬 안내 줄 등) */
        var rg = document.createRange(); rg.selectNodeContents(e);
        var tr = rg.getBoundingClientRect();
        o.push(tr.width > 0 ? tr : e.getBoundingClientRect());
      }
    });
    return o;
  }
  var P = floats.map(parts);
  for (var i = 0; i < floats.length; i++) {
    for (var j = i + 1; j < floats.length; j++) {
      var best = null;
      P[i].forEach(function (A) {
        P[j].forEach(function (B) {
          var ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
          var oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
          if (ox > 4 && oy > 4 && (!best || ox * oy > best[0] * best[1])) { best = [ox, oy]; }
        });
      });
      if (best) {
        overlap.push({ a: name(floats[i]), aText: text(floats[i]), b: name(floats[j]), bText: text(floats[j]), size: Math.round(best[0]) + 'x' + Math.round(best[1]) });
      }
    }
  }

  var de = document.documentElement;
  var hs = Math.max(de.scrollWidth, document.body.scrollWidth) - vw;
  return { vw: vw, vh: vh, hscroll: hs > 1 ? hs : 0, off: off, unreach: unreach, clip: clip, font: font, tap: tap, covered: covered, overlap: overlap, modal: modal };
}
if (typeof module !== 'undefined') { module.exports = __sagaMeasure; }
