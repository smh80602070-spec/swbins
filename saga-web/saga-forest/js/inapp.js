/**
 * 앱 안 브라우저 안내 띠(W-0331) — 구글 앱·카카오톡·인스타·페이스북·네이버·라인 등 앱 속 브라우저(WebView)는
 * 서비스워커·저장소·위치·WebGL 메모리가 막히거나 작고, 위아래 바가 화면 높이를 바꾼다. 알아보면 맨 위에 띠 하나 —
 * "사파리/크롬으로 열기" · "주소 복사" · 닫기(이 탭 동안 안 뜸). 게임을 막지 않는다.
 *
 *   DG.inApp.test(ua)   → 앱 이름(문자열) 또는 null — 순수 함수(진단용)
 *   DG.inApp.name       → 지금 기기의 판정
 *   DG.inApp.show()     → 띠를 띄운다(판정이 null 이어도 — 확인용)
 *
 * errlog.js 바로 뒤에 실린다(게임 코드가 죽어도 띠는 뜬다). DG_NO_DRAW(진단)면 띄우지 않는다.
 * 같은 판정이 루트 index.html 에 인라인으로 한 벌 더 있다 — 고치면 둘 다.
 */
(function (global) {
  'use strict';
  var KEY = 'saga-inapp-closed';
  var RULES = [
    [/\bGSA\//, '구글 앱'], [/KAKAOTALK/i, '카카오톡'], [/\bInstagram\b/, '인스타그램'], [/FBAN|FBAV|FB_IAB/, '페이스북'],
    [/NAVER\(inapp|NAVER\//, '네이버'], [/\bLine\//, '라인'], [/DaumApps/, '다음'], [/everytimeApp/, '에브리타임'],
    [/; wv\)/, '앱 속 브라우저'],
    // iOS 에서 Safari·크롬·파이어폭스·엣지가 아닌데 WebKit 이면 앱 속 WebView(사파리 UA 의 "Safari/" 가 없다)
    [function (ua) { return /iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua); }, '앱 속 브라우저']
  ];
  function test(ua) {
    ua = String(ua || '');
    for (var i = 0; i < RULES.length; i++) { var r = RULES[i][0]; if (typeof r === 'function' ? r(ua) : r.test(ua)) { return RULES[i][1]; } }
    return null;
  }
  function openOut() {
    var href = global.location.href, ua = global.navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) { global.location.href = 'x-safari-' + href; return; }                 // iOS 17+ 사파리로 넘기기
    if (/Android/.test(ua)) { global.location.href = 'intent://' + href.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'; }
  }
  function copy(btn) {
    var href = global.location.href, done = function () { btn.textContent = '복사됨 ✓'; };
    try { if (global.navigator.clipboard && global.navigator.clipboard.writeText) { global.navigator.clipboard.writeText(href).then(done, function () { manual(btn); }); return; } } catch (e) { /* 아래로 */ }
    manual(btn);
  }
  function manual(btn) {                                                                                        // 복사가 막힌 웹뷰 — 주소를 골라 쓸 수 있게
    var box = btn.parentNode, inp = global.document.createElement('input');
    inp.value = global.location.href; inp.readOnly = true; inp.style.cssText = 'flex:1 1 100%;margin-top:6px;padding:4px 6px;font:12px monospace;border-radius:4px;border:1px solid #fff6;background:#0006;color:#fff';
    box.appendChild(inp); inp.focus(); inp.select(); btn.textContent = '길게 눌러 복사';
  }
  function show() {
    var doc = global.document;
    if (!doc || !doc.body || doc.getElementById('inapp-band')) { return; }
    var el = doc.createElement('div'); el.id = 'inapp-band';
    el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;display:flex;flex-wrap:wrap;gap:6px;align-items:center;' +
      'padding:calc(8px + env(safe-area-inset-top)) 12px 8px;background:#1d2b44;color:#fff;font:13px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 2px 10px #0008';
    var b = 'padding:4px 10px;border:1px solid #fff9;border-radius:6px;background:transparent;color:#fff;font:inherit;cursor:pointer';
    el.innerHTML = '<span style="flex:1 1 180px">📱 <b>' + (api.name || '앱 속 브라우저') + '</b> 안이라 저장·3D 가 막힐 수 있어요. 사파리나 크롬으로 열어 주세요.</span>' +
      '<button type="button" data-a="out" style="' + b + '">밖에서 열기</button><button type="button" data-a="copy" style="' + b + '">주소 복사</button>' +
      '<button type="button" data-a="x" aria-label="닫기" style="' + b + ';border:0">✕</button>';
    el.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('button') : null; if (!t) { return; }
      var a = t.getAttribute('data-a');
      if (a === 'out') { openOut(); } else if (a === 'copy') { copy(t); } else { el.remove(); try { global.sessionStorage.setItem(KEY, '1'); } catch (e) { /* 막힘 */ } }
    });
    doc.body.appendChild(el);
  }
  var api = { test: test, name: test(global.navigator && global.navigator.userAgent), show: show };
  global.DG = global.DG || {};
  global.DG.inApp = api;
  if (api.name && !global.DG_NO_DRAW) {
    var closed = false; try { closed = global.sessionStorage.getItem(KEY) === '1'; } catch (e) { /* 막힘 */ }
    if (!closed) { if (global.document.readyState === 'loading') { global.document.addEventListener('DOMContentLoaded', show); } else { show(); } }
  }
})(window);
