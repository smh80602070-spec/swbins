/**
 * 기기별 화면 — 폰은 2D, PC 는 3D (사용자 10-19 "모바일은 2D 웹은 3D 로 되게 자동으로 잡아줘")
 *
 * 다섯 판의 "3D 를 원하나" 함수(1만리 world3d.wanted·시점 tiltMode · 2나락 dungeon3d.wanted · 3마을 village-view3d.ON ·
 * 4종횡 side-view3d.ON · 5천하 realm3d.ON)가 이 한 곳에 묻는다:
 *   DG.deviceMode.want3d(key, saved)  폰이면 **이 탭에서 🧊 로 켰을 때만** true(저장된 값은 안 읽는다 — 3D 세이브로 열자마자 죽는 일을 막는다),
 *                                     PC 면 saved(판의 손잡이·설정 그대로)
 *   DG.deviceMode.mark(key, on)       🧊 를 눌렀을 때 — 이 탭 동안만 기억(sessionStorage). 새로 열면 폰은 다시 2D
 *   DG.deviceMode.phone()             폰인가(한 번 재고 기억) · test(ua, touch, w, h) 는 순수 함수(진단용)
 * 폰 판정: 모바일 UA(iPhone·iPod·Android+Mobile·iPad) 또는 (터치 + 화면 짧은 변 ≤ 520px). 손잡이 `?mode=2d|3d` 로 그 탭만 억지로 바꿀 수 있다.
 * 정본은 saga-web/shared/js/device-mode.js — 판별 사본은 tools/sync-shared.mjs.
 */
(function (global) {
  'use strict';
  var PRE = 'saga-3d/', cached = null;
  function ss() { try { return global.sessionStorage; } catch (e) { return null; } }
  /** 순수 — UA·터치·화면 크기로 폰인가 */
  function test(ua, touch, w, h) {
    ua = String(ua || '');
    if (/iPhone|iPod|iPad/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))) { return true; }
    var s = Math.min(w || 0, h || 0);
    return !!touch && s > 0 && s <= 520;
  }
  function phone() {
    if (cached !== null) { return cached; }
    var q = (global.location && global.location.search) || '';
    if (/[?&]mode=2d\b/.test(q)) { cached = true; return cached; }
    if (/[?&]mode=3d\b/.test(q)) { cached = false; return cached; }
    var n = global.navigator || {}, sc = global.screen || {};
    var touch = ('ontouchstart' in global) || (n.maxTouchPoints > 0);
    /* iPadOS 사파리는 데스크톱 UA 를 보낸다 — 맥 UA + 터치면 아이패드로 본다 */
    var ipad = /Macintosh/.test(n.userAgent || '') && n.maxTouchPoints > 1;
    cached = ipad || test(n.userAgent, touch, sc.width, sc.height);
    return cached;
  }
  function want3d(key, saved) {
    if (!phone()) { return !!saved; }
    var s = ss(); var v = s ? s.getItem(PRE + key) : null;
    return v === '1';
  }
  function mark(key, on) { var s = ss(); if (s) { try { s.setItem(PRE + key, on ? '1' : '0'); } catch (e) { /* 막힘 */ } } }
  /* W-0389 ③-5 — HUD 유리 흐림(backdrop-filter)은 그 밑 캔버스가 매 프레임 바뀌면 GPU 가 매 프레임 다시 흐린다— 가설. 1만리 폰 LOW A/B 가 쌍마다 뒤집혀(2쌍 끔이 빠름, 3쌍 켬이 빠름) 근거 없음 → 기본 켬.
     html.no-blur(규칙은 ui-kit.css) · 손잡이 ui.blur(1 = 흐림 기본, 0 = 끔) · 2초마다 맞춘다 — 다섯 판 공용 */
  function syncBlur() { var d = global.document && global.document.documentElement, C = global.DG && global.DG.core; if (!d) { return; } var v = C && C.tuned ? +C.tuned('ui.blur', 1) : 1; d.classList.toggle('no-blur', !v); }
  if (global.setInterval && global.document) { global.setInterval(syncBlur, 2000); global.setTimeout(syncBlur, 50); }
  global.DG = global.DG || {};
  global.DG.deviceMode = { phone: phone, want3d: want3d, mark: mark, test: test, _reset: function () { cached = null; } };
})(window);
