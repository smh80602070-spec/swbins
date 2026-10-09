/**
 * 윈도 10 빈 네모 이모지 대신 옛 이모지 (W-0135) — 정본 saga-web/shared/js/, 다섯 판에 sync-shared 로 복사
 * ---------------------------------------------------------------
 * 🪙(돈)·🪧(팻말)·🪨(바위)·🪖(투구) 같은 2020년 이후 이모지는 윈도 10 글꼴(Segoe UI Emoji)에 없어
 * 크롬이 빈 네모(□)를 그린다. 데이터(data.js 도감 설명·HUD 글자)는 그대로 두고, **이 기기가 못 그리는 글자만**
 * 화면에 나갈 때 아래 표의 옛 이모지로 바꾼다.
 *
 *   판정   글자마다 캔버스에 검은 글씨로 한 번 그려 색 픽셀이 있나 본다 — 색 이모지면 지원, 흑백 네모면 미지원
 *   바꿈   미지원이 하나라도 있을 때만: 문서 글자 노드·title(지금 + MutationObserver 로 새로 붙는 것) ·
 *          캔버스 fillText·strokeText·measureText(2D 이름표·3D 스프라이트 글자)
 *   비용   폰·윈도 11 처럼 다 그리는 기기에선 판정 한 번(글자 40여 개)뿐 — 관찰자·감싸기 안 붙인다
 * 진단(_test.html)은 원래 글자를 비교하므로 `window.DG_EMOJI_COMPAT_OFF = true` 로 바꾸기를 끄고 표만 검사한다. DG.emojiCompat 로 판정 결과를 본다.
 */
(function (global) {
  'use strict';

  /* 새 이모지 → 윈도 10 에도 있는 옛 이모지(뜻이 가까운 것) */
  var MAP = {
    '\u{1FA99}': '💰', '\u{1FAA8}': '⛰️', '\u{1FAA2}': '➰', '\u{1FA82}': '🎈', '\u{1FAA6}': '⚰️', '\u{1FAAD}': '🎐',
    '\u{1FA79}': '💊', '\u{1FA93}': '🔨', '\u{1FAB7}': '🌸', '\u{1F977}': '👤', '\u{1FAB6}': '🕊️', '\u{1FA96}': '⛑️',
    '\u{1FAA7}': '📋', '\u{1F6D6}': '🏠', '\u{1FA78}': '💧', '\u{1FA7B}': '💀', '\u{1FAB8}': '🌿', '\u{1FA7A}': '💊',
    '\u{1FAE7}': '💧', '\u{1FAB1}': '🐛', '\u{1FAB4}': '🌱', '\u{1FA81}': '🎏', '\u{1FACF}': '🐴', '\u{1FAD0}': '🍇',
    '\u{1FABD}': '🕊️', '\u{1FAB5}': '🌲', '\u{1FA9C}': '🔽', '\u{1FA77}': '💗', '\u{1FA9E}': '🔮', '\u{1FA91}': '💺',
    '\u{1FA8F}': '⛏️', '\u{1FABB}': '🌷', '\u{1FADA}': '🥔', '\u{1FAB0}': '🦟', '\u{1FAB2}': '🐞', '\u{1F9A3}': '🐘',
    '\u{1FAE5}': '😶', '\u{1FA90}': '🌌'
  };

  /** 이 글자를 이 기기가 색 이모지로 그리나 — 캔버스 한 칸에 그려 색 픽셀을 센다 */
  var probe = null;
  function supports(ch) {
    try {
      if (!probe) {
        var cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
        probe = cv.getContext('2d', { willReadFrequently: true });
      }
      if (!probe) { return true; }
      probe.clearRect(0, 0, 32, 32);
      probe.fillStyle = '#000';
      probe.textBaseline = 'top';
      probe.font = '24px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      probe.fillText(ch, 2, 2);
      var d = probe.getImageData(0, 0, 32, 32).data, n = 0;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 40 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 50) { n++; }
      }
      return n > 6;
    } catch (e) { return true; }   // 판정 못 하면 건드리지 않는다
  }

  var bad = [], RE = null, RE1 = null;
  function fix(s) { return (RE && typeof s === 'string' && RE1.test(s)) ? s.replace(RE, function (m) { return MAP[m] || m; }) : s; }

  function fixText(node) {
    var v = node.nodeValue;
    if (v && RE1.test(v)) { node.nodeValue = fix(v); }
  }
  function fixAttr(el) {
    var a = ['title', 'placeholder', 'aria-label'];
    for (var i = 0; i < a.length; i++) {
      var v = el.getAttribute && el.getAttribute(a[i]);
      if (v && RE1.test(v)) { el.setAttribute(a[i], fix(v)); }
    }
  }
  function fixTree(root) {
    if (!root) { return; }
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) { return; }
    if (root.nodeType === 1) { fixAttr(root); }
    var w = document.createTreeWalker(root, 1 | 4), n;   // 요소 + 글자
    while ((n = w.nextNode())) { if (n.nodeType === 3) { fixText(n); } else { fixAttr(n); } }
  }

  function wrapCanvas(proto) {
    if (!proto || proto.__emojiCompat) { return; }
    ['fillText', 'strokeText', 'measureText'].forEach(function (k) {
      var orig = proto[k];
      if (typeof orig !== 'function') { return; }
      proto[k] = function (t) {
        if (typeof t === 'string' && RE1.test(t)) { var a = Array.prototype.slice.call(arguments); a[0] = fix(t); return orig.apply(this, a); }
        return orig.apply(this, arguments);
      };
    });
    proto.__emojiCompat = true;
  }

  function start() {
    for (var ch in MAP) { if (!supports(ch)) { bad.push(ch); } }
    if (!bad.length) { return; }
    var src = bad.map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
    RE = new RegExp(src, 'gu'); RE1 = new RegExp(src, 'u');
    wrapCanvas(global.CanvasRenderingContext2D && global.CanvasRenderingContext2D.prototype);
    wrapCanvas(global.OffscreenCanvasRenderingContext2D && global.OffscreenCanvasRenderingContext2D.prototype);
    if (document.title && RE1.test(document.title)) { document.title = fix(document.title); }
    fixTree(document.body || document.documentElement);
    if (global.MutationObserver) {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'characterData') { fixText(m.target); }
          else if (m.type === 'attributes') { fixAttr(m.target); }
          else { for (var j = 0; j < m.addedNodes.length; j++) { fixTree(m.addedNodes[j]); } }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
    }
  }

  global.DG = global.DG || {};
  global.DG.emojiCompat = { MAP: MAP, bad: bad, fix: function (s) { return fix(s); }, supports: supports };
  if (typeof document !== 'undefined' && !global.DG_EMOJI_COMPAT_OFF) { try { start(); } catch (e) { /* 못 해도 게임은 돈다 — 네모가 남을 뿐 */ } }
})(window);
