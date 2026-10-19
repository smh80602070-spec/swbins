/**
 * 부팅 지킴 — 5천하 전용 (W-0187)
 * ---------------------------------------------------------------
 * 폰에서 "첫 페이지 5천하 카드로 안 들어가진다" 는 제보가 왔는데 재현이 안 됐다.
 * 부팅이 막히면 화면은 비거나 타이틀에서 멈추고, 까닭은 `errlog`(localStorage)에만
 * 남아 `_admin.html` 을 열 줄 아는 사람만 본다. 그래서 **막힌 까닭을 화면에 띠로**
 * 띄우고 빠져나갈 단추를 단다.
 *
 * **`dist/app.js` 보다 먼저, 따로 실린다** — 번들이 통째로 못 읽히는 경우(옛 브라우저
 * 구문 오류·옛 캐시가 섞인 404)에도 이 파일은 돈다. 그래서 DG·core 에 기대지 않는다
 * (있으면 쓰고 없으면 세이브 키를 프로필 목록에서 직접 읽는다).
 *
 *   잡는 것   ① window 'error'(번들 밖으로 새어 나온 것·구문 오류)
 *             ② 번들이 파일마다 감싼 try/catch 가 errlog 에 남긴 것(kind 'error', 부팅 뒤 시각)
 *             ③ 불이 안 켜짐 — load 뒤 20초가 지나도 타이틀도 지도 머리줄도 없음
 *   언제까지  게임이 서고(`DG.rtk.state()`) 타이틀이 닫힌 채 5초가 지나면 끝(그 뒤 오류는 띠 없이 errlog 만)
 *   단추      [세이브 내려받기] — saga-realm/ 로 시작하는 저장 칸 전부를 JSON 파일로
 *             [이 프로필 새로 시작(백업 남김)] — 세이브를 지우지 않고 `<키>.bak-<날짜>` 로 옮긴 뒤 새로고침
 *             「캐시 비우기」 — `_swreset.html`(옛 서비스 워커 캐시가 섞였을 때) · ✕ 닫기
 *
 * 손잡이 없음(늘 켬). 세이브 키는 그대로(`saga-realm/save/<프로필>`).
 * 자가진단은 순수 함수(bakKey·firstError·saveKeyOf)만 본다 — `_test.html` 은 DG_NO_ACCOUNT 라 띠를 안 세운다.
 */
(function (global) {
  'use strict';

  var BASE = 'saga-realm/save';
  var STORE = BASE + '/accounts';
  var HOLD_MS = 5000;     // 지도가 이만큼 멀쩡히 서 있으면 부팅 끝
  var DARK_MS = 20000;    // load 뒤 이만큼 아무 화면도 없으면 "안 켜짐"

  var t0 = Date.now();
  var own = [];           // window 'error' 로 잡은 것
  var done = false, shown = false, okSince = 0;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 순수 — 백업 키. `<키>.bak-YYYYMMDD-HHMM` */
  function bakKey(key, d) {
    d = d || new Date();
    return key + '.bak-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }
  /** 순수 — 비어 있는 백업 키(R-5: 같은 분에 두 번 누르면 원본 백업을 덮어썼다) — 있으면 -2, -3 … */
  function bakFree(key, has, d) {
    var b = bakKey(key, d), k = b, n = 2;
    while (has(k) && n < 100) { k = b + '-' + n++; }
    return k;
  }

  /** 순수 — 프로필 목록 글(JSON)에서 지금 프로필의 세이브 키. 없으면 null */
  function saveKeyOf(accountsRaw) {
    try {
      var o = accountsRaw ? JSON.parse(accountsRaw) : null;
      return o && o.cur ? BASE + '/' + o.cur : null;
    } catch (e) { return null; }
  }

  /** 순수 — 부팅 시각(since) 뒤의 첫 오류. own(window 오류)과 errlog 기록을 시각순으로 */
  function firstError(ownList, logList, since) {
    var all = [], i, e;
    for (i = 0; i < (ownList || []).length; i++) { all.push(ownList[i]); }
    for (i = 0; i < (logList || []).length; i++) {
      e = logList[i];
      if (e && e.kind === 'error' && (e.t || 0) >= since) { all.push(e); }
    }
    /* R-5 교차 출처 "Script error."(출처 없음) — 인앱 브라우저가 끼운 남의 스크립트라 부팅 실패가 아니다 */
    all = all.filter(function (x) { return !(/^Script error.?$/i.test(String(x.msg || '')) && !x.src); });
    if (!all.length) { return null; }
    all.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
    e = all[0];
    var where = e.src ? String(e.src).split('/').pop() + (e.line ? ':' + e.line : '') : '';
    return String(e.msg || '알 수 없는 오류').split('\n')[0] + (where ? ' (' + where + ')' : '');
  }

  function curKey() {
    var k = null;
    try { k = saveKeyOf(localStorage.getItem(STORE)); } catch (e) { /* 사설 모드 */ }
    var core = global.DG && global.DG.core;
    return k || (core && core.SAVE_KEY) || null;
  }

  function logList() {
    var E = global.DG && global.DG.errlog;
    try { return E && E.list ? E.list() : []; } catch (e) { return []; }
  }

  /* ── 단추 ──────────────────────────────────────────────── */

  function download() {
    var o = {}, i, k;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (k && k.indexOf('saga-realm/') === 0) { o[k] = localStorage.getItem(k); }
      }
    } catch (e) { /* 읽을 수 없으면 빈 파일이라도 */ }
    var d = new Date();
    var name = 'saga-realm-save-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
    var url = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.parentNode && a.parentNode.removeChild(a); }, 1500);
  }

  function restart() {
    var key = curKey();
    if (!key) { location.reload(); return; }
    if (!confirm('이 프로필을 새로 시작할까요?\n지금 세이브는 지우지 않고 백업 칸으로 옮겨 둡니다.')) { return; }
    try {
      var raw = localStorage.getItem(key);
      if (raw) { localStorage.setItem(bakFree(key, function (k) { return localStorage.getItem(k) !== null; }), raw); localStorage.removeItem(key); }
    } catch (e) {
      alert('저장소에 쓰지 못했습니다 — 먼저 [세이브 내려받기]로 받아 두세요.');
      return;
    }
    location.reload();
  }

  /* ── 띠 ───────────────────────────────────────────────── */

  function show(text) {
    if (shown || !document.body) { return; }
    shown = true;
    var st = document.createElement('style');
    st.textContent = '#boot-guard{position:fixed;left:0;right:0;top:0;z-index:9999;padding:calc(10px + env(safe-area-inset-top)) 14px 12px;' +
      'background:#3a1518;border-bottom:2px solid #e06565;color:#fbe9e9;font:400 13px/1.6 "Malgun Gothic",system-ui;box-shadow:0 8px 24px rgba(0,0,0,.5)}' +
      '#boot-guard b{color:#ffb3b3}#boot-guard .msg{display:block;margin:2px 0 8px;font:12px/1.5 Consolas,monospace;word-break:break-all;user-select:text;-webkit-user-select:text}' +
      '#boot-guard button,#boot-guard a{display:inline-block;margin:0 6px 6px 0;padding:8px 12px;border-radius:10px;font:700 12.5px "Malgun Gothic",system-ui;' +
      'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);color:#fbe9e9;text-decoration:none;cursor:pointer}' +
      '#boot-guard .primary{background:#f5b445;border-color:#f5b445;color:#22190a}#boot-guard .x{position:absolute;right:8px;top:calc(6px + env(safe-area-inset-top));margin:0;padding:4px 10px}' +
      '#boot-guard small{display:block;color:#d9b3b3;font-size:11px}';
    document.head.appendChild(st);
    var el = document.createElement('div');
    el.id = 'boot-guard';
    el.setAttribute('role', 'alert');
    el.innerHTML = '<b>시작 중 오류</b><span class="msg"></span>' +
      '<button class="primary" data-a="dl">세이브 내려받기</button>' +
      '<button data-a="re">이 프로필 새로 시작(백업 남김)</button>' +
      '<a href="_swreset.html">캐시 비우기</a>' +
      '<button class="x" data-a="x" title="닫기">✕</button>' +
      '<small>이 글을 그대로 알려 주시면 고칩니다. 세이브는 지워지지 않습니다.</small>';
    el.querySelector('.msg').textContent = text;
    el.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'dl') { download(); }
      else if (a === 're') { restart(); }
      else if (a === 'x') { el.parentNode.removeChild(el); }
    });
    document.body.appendChild(el);
  }

  /* ── 지켜보기 ─────────────────────────────────────────── */

  function titleUp() { var h = document.getElementById('acc-host'); return !!(h && /\bshow\b/.test(h.className)); }
  function gameUp() {
    var R = global.DG && global.DG.rtk;
    try { return !!(R && R.state && R.state() && document.getElementById('profile') && document.getElementById('profile').textContent); }
    catch (e) { return false; }
  }

  var loadedAt = 0;
  function tick() {
    if (done || shown) { return; }
    var err = firstError(own, logList(), t0);
    if (err) { show(err); return; }
    var now = Date.now();
    if (gameUp() && !titleUp()) {
      if (!okSince) { okSince = now; }
      if (now - okSince >= HOLD_MS) { done = true; return; }
    } else { okSince = 0; }
    if (loadedAt && now - loadedAt >= DARK_MS && !titleUp() && !gameUp()) {
      show('화면이 뜨지 않았습니다 — 게임 파일을 다 못 받았거나 옛 캐시가 섞였을 수 있습니다' +
        (global.DG && global.DG.core ? '' : ' (게임 코드가 실리지 않음)'));
      return;
    }
    setTimeout(tick, 500);
  }

  /* ── 지난번에 죽었나(10-19 — 아이폰 크롬 "이 페이지를 열 수 없음") ─────────────
   * 아이폰은 GPU·메모리를 넘기면 탭을 통째로 죽이고, 그땐 우리 코드가 아무것도 못 남긴다. 그래서 열 때 `saga-realm/alive` 를 쓰고
   * 정상으로 나갈 때(탭 숨김·pagehide) 지운다. 다음에 열 때 그 칸이 남아 있으면 지난번이 죽은 것 — 번들(core)이 손잡이를 읽기 **전에**
   * 3D(`realm3d.on`)를 끄고 품질을 low 로 내려 2D 로 연다. 손잡이 표 `saga-realm/tune` 만 고친다(세이브는 안 건드림) · 🧊·⚙️ 로 되돌릴 수 있다. */
  var ALIVE_KEY = 'saga-realm/alive', TUNE_KEY = 'saga-realm/tune', ALIVE_MAX_MS = 7 * 864e5;
  /** 순수 — 남은 alive 칸(JSON 객체 또는 null)·손잡이 표(객체)·지금 → { crashed, n, tune(고친 표 또는 null), was3d } */
  function crashPlan(alive, tune, now) {
    if (!alive || typeof alive.t !== 'number' || now - alive.t > ALIVE_MAX_MS || now < alive.t) { return { crashed: false, n: 0, tune: null, was3d: false }; }
    var t = {}, k, was3d = false;
    for (k in (tune || {})) { if (Object.prototype.hasOwnProperty.call(tune, k)) { t[k] = tune[k]; } }
    was3d = !!(t['realm3d.on'] && t['realm3d.on'] !== '0');
    t['realm3d.on'] = 0; t['realm3d.quality'] = 'low';
    return { crashed: true, n: (alive.n || 0) + 1, tune: t, was3d: was3d };
  }
  global.DG = global.DG || {};
  global.DG.bootGuard = { bakKey: bakKey, bakFree: bakFree, saveKeyOf: saveKeyOf, firstError: firstError, HOLD_MS: HOLD_MS, DARK_MS: DARK_MS, crashPlan: crashPlan, ALIVE_KEY: ALIVE_KEY };

  if (global.DG_NO_ACCOUNT || !global.addEventListener) { return; }   // 자가진단 — 순수 함수만
  (function sentinel() {
    var ls = null; try { ls = global.localStorage; } catch (x) { return; }
    if (!ls) { return; }
    var jget = function (k) { try { return JSON.parse(ls.getItem(k) || 'null'); } catch (x) { return null; } };
    var now = Date.now(), plan = crashPlan(jget(ALIVE_KEY), jget(TUNE_KEY) || {}, now), n = plan.crashed ? plan.n : 0;
    if (plan.crashed) {
      try { ls.setItem(TUNE_KEY, JSON.stringify(plan.tune)); } catch (x) { /* 꽉 참 */ }
      var say = function () {
        if (!document.body || document.getElementById('boot-safe')) { return; }
        var el = document.createElement('div'); el.id = 'boot-safe';
        el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:9998;padding:10px 40px 10px 14px;border-radius:12px;' +
          'background:#1d2b44;border:1px solid #5aaef2;color:#eef4fb;font:13px/1.5 "Malgun Gothic",system-ui;box-shadow:0 6px 20px rgba(0,0,0,.5)';
        el.innerHTML = '<b>지난번에 열다가 멈췄습니다</b><br>' + (plan.was3d ? '3D 지도를 끄고 ' : '') + '그래픽을 낮음으로 낮춰 가볍게 열었습니다. ' +
          '⚙️ 설정·🧊 로 다시 올릴 수 있어요.' + (n >= 2 ? ' (' + n + '번째 — 계속 멈추면 이 글을 알려 주세요)' : '') +
          '<button type="button" style="position:absolute;right:6px;top:6px;padding:2px 8px;border:0;background:transparent;color:#eef4fb;font-size:16px;cursor:pointer" aria-label="닫기">✕</button>';
        el.querySelector('button').addEventListener('click', function () { el.remove(); });
        document.body.appendChild(el);
        global.setTimeout(function () { if (el.parentNode) { el.remove(); } }, 15000);
      };
      if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', say); } else { say(); }
    }
    var mark = function () { try { ls.setItem(ALIVE_KEY, JSON.stringify({ t: Date.now(), n: n })); } catch (x) { /* */ } };
    var clear = function () { try { ls.removeItem(ALIVE_KEY); } catch (x) { /* */ } };
    mark();
    global.setTimeout(function () { n = 0; if (!document.hidden) { mark(); } }, 30000);   // 30초 멀쩡하면 연속 횟수 0
    global.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { clear(); } else { mark(); } });
  })();
  global.addEventListener('error', function (ev) {
    if (done || shown || (ev && ev.target && ev.target !== global)) { return; }   // R-5 띠가 선 뒤엔 안 쌓는다(매 프레임 예외면 끝없이 컸다)   // 그림·소리 못 받음(자원 오류)은 부팅 실패가 아니다
    own.push({ kind: 'error', t: Date.now(), msg: (ev && ev.message) || '오류', src: (ev && ev.filename) || '', line: (ev && ev.lineno) || 0 });
  });
  global.addEventListener('load', function () { loadedAt = Date.now(); });
  setTimeout(tick, 500);
})(window);
