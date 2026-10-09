/**
 * 오류 수집 — SAGA-DESIGN §8-2 "사용자 제보가 스택으로 온다"
 * ---------------------------------------------------------------
 * 폰에서 "이동하면 화면이 갈색이 됐어요" 같은 증상만 오면 원인을 못 좁힌다.
 * `window.onerror`·`unhandledrejection` 을 여기서 잡아 localStorage 에
 * 링버퍼(50건)로 쌓아 두면, `_admin.html` "오류" 탭에서 스택으로 볼 수 있다.
 *
 * **아주 먼저 실린다** — `index.html` 맨 첫 스크립트라 다른 모든 파일이
 * 던지는 오류도(파싱 오류만 빼고) 잡는다. `DG.core` 도 아직 없을 수 있어
 * 손잡이(`errlog.on`)는 있으면 보고 없으면 켠 것으로 친다.
 *
 *   record(entry)   한 줄 넣는다(자동으로 t 를 붙인다)
 *   list()          지금 쌓인 것(오래된 것부터)
 *   clear()         비운다
 *   push(arr, e)    **순수 함수** — 50건 넘으면 오래된 것부터 미는 셈만 한다
 *
 * **정본은 saga-web/shared/js/errlog.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 저장 키는 판마다 다르다(`<SAVE_BASE 앞쪽>/errlog`, 예 `deungyong-go/errlog`) — `core.js` 가 `SAVE_BASE` 를 내놓기 전에
 * 난 오류는 메모리에 담아 뒀다가 키가 생기면(다음 기록·목록·load 때) 한꺼번에 저장한다.
 */
(function (global) {
  'use strict';

  var MAX = 50;
  /** 판의 저장 키 — `core.SAVE_BASE`('deungyong-go/save' 꼴)의 `/save` 를 `/errlog` 로.
   *  W-0123 — core 가 서기 전(부팅 중 data·core 자체가 던진 오류 — 제보가 가장 필요한 때)엔 주소의 판 폴더로 옛 키를 고른다.
   *  공용화(38e0503a5) 전엔 판마다 키를 글자로 박아 바로 저장했는데, 공용화 뒤엔 메모리에만 남아 사라졌다. 키 글자는 옛 것 그대로 */
  var OLD_KEY = { 'saga-go': 'deungyong-go', 'saga-dungeon': 'yeoksa-dungeon', 'saga-forest': 'yeoksa-village', 'saga-story': 'yeoksa-side', 'saga-realm': 'saga-realm' };
  function keyOfPath(p) { var m = /\/(saga-go|saga-dungeon|saga-forest|saga-story|saga-realm)\//.exec(String(p || '')); return m ? OLD_KEY[m[1]] + '/errlog' : null; }
  function storageKey() {
    var core = global.DG && global.DG.core, base = core && core.SAVE_BASE;
    return base ? String(base).replace(/\/save$/, '') + '/errlog' : keyOfPath(global.location && global.location.pathname);
  }
  var pending = [];   // 키가 생기기 전에 난 오류(메모리)

  function ON() {
    var core = global.DG && global.DG.core;
    return core && core.tuned ? (core.tuned('errlog.on', 1) ? true : false) : true;
  }

  function load() {
    var key = storageKey();
    if (!key) { return pending.slice(); }
    try {
      var raw = global.localStorage ? global.localStorage.getItem(key) : null;
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function persist(arr) {
    var key = storageKey();
    if (!key) { pending = arr.slice(); return; }
    try { if (global.localStorage) { global.localStorage.setItem(key, JSON.stringify(arr)); } }
    catch (e) { /* 저장소 꽉 참 등 — 조용히 넘어간다, 오류 수집이 또 오류를 내면 안 된다 */ }
  }

  /** 링버퍼 셈 — 순수 함수, 자가진단이 세 번 넣어 3/50/51건을 값으로 본다 */
  function push(arr, entry) {
    var out = (arr || []).concat([entry]);
    if (out.length > MAX) { out = out.slice(out.length - MAX); }
    return out;
  }

  /** 키가 생겼으면 메모리에 담아 둔 것을 저장소 앞쪽에 합친다 */
  function flush() {
    if (!pending.length || !storageKey()) { return; }
    var held = pending; pending = [];
    var arr = load();
    held.forEach(function (e) { arr = push(arr, e); });
    persist(arr);
  }

  function record(entry) {
    flush();
    entry = entry || {};
    if (!entry.t) { entry.t = Date.now(); }
    var arr = push(load(), entry);
    persist(arr);
    return arr;
  }

  function list() { flush(); return load(); }
  function clear() { persist([]); return []; }

  function fromErrorEvent(ev) {
    return {
      kind: 'error',
      msg: (ev && ev.message) || String(ev),
      src: (ev && ev.filename) || '',
      line: (ev && ev.lineno) || 0,
      col: (ev && ev.colno) || 0,
      stack: (ev && ev.error && ev.error.stack) || ''
    };
  }
  function fromRejectionEvent(ev) {
    var r = ev && ev.reason;
    return {
      kind: 'rejection',
      msg: (r && (r.message || String(r))) || 'unhandled rejection',
      stack: (r && r.stack) || ''
    };
  }

  var installed = false;
  function install() {
    if (installed || !global.addEventListener) { return; }
    installed = true;
    global.addEventListener('error', function (ev) {
      if (ON()) { record(fromErrorEvent(ev)); }
    });
    global.addEventListener('unhandledrejection', function (ev) {
      if (ON()) { record(fromRejectionEvent(ev)); }
    });
    global.addEventListener('load', flush);
  }

  global.DG = global.DG || {};
  global.DG.errlog = {
    MAX: MAX, ON: ON,
    record: record, list: list, clear: clear, push: push,
    fromErrorEvent: fromErrorEvent, fromRejectionEvent: fromRejectionEvent,
    install: install, storageKey: storageKey, keyOfPath: keyOfPath, flush: flush
  };
  install();
})(window);
