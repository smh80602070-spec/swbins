/**
 * 통일 3D 에셋 조회 한 곳 (W-0021) — 건물·지물·지형·탈것(`world3d/<id>.glb`)과 인물 몸(`characters3d/<영웅id>.glb`).
 *
 * **정본은 saga-web/shared/js/assets3d.js** — 판별 복사본은 tools/sync-shared.mjs 가 만든다(직접 고치지 않는다).
 * 파일은 자체툴(K-0017·K-0024)이 `saga-web/shared/assets/` 한 벌로 놓는다 — 판마다 복사하지 않는다(몸만 174MB).
 *   공개 페이지·`file:` 은 `../shared/assets/`, 로컬 서버(tools/serve-game.mjs)는 `_shared/assets/` — 둘을 차례로 시험해 되는 쪽을 쓴다.
 *   (`DG.cfg.assets3d.base` 로 고정할 수도 있다)
 *
 * **못 찾았거나 아직 시험 중이면 `url()` 은 null** — 부르는 쪽이 옛 모델 경로로 간다(오류 0·기존 동작 그대로).
 * 어느 영웅·지물에 GLB 가 있나는 `assets3d-ids.js`(tools/gen-assets3d-ids.mjs 가 폴더에서 생성) 표가 안다.
 * 끄는 손잡이: `core.tuned('assets3d.on', 1)` 이 0 이면 늘 null.
 */
(function (global) {
  'use strict';

  var state = 'init', root = null, sets = null;      // init → probing → ok | fail

  function cfg() { return (global.DG && global.DG.cfg && global.DG.cfg.assets3d) || {}; }
  function ids() { return (global.DG && global.DG.assets3dIds) || { hero: [], world: [] }; }
  function set(kind) {
    if (!sets) {
      sets = { hero: {}, world: {} };
      var t = ids(), k, i;
      for (k in sets) { for (i = 0; i < (t[k] || []).length; i++) { sets[k][t[k][i]] = 1; } }
    }
    return sets[kind] || {};
  }

  /** 시험할 기준 주소들 — 공개 페이지·file: 은 `../shared/` 를 먼저, 로컬 서버는 `_shared/` 를 먼저 */
  function bases() {
    var c = cfg(); if (c.base) { return [c.base]; }
    var L = global.location || {}, pub = L.protocol === 'file:' || /github\.io$/.test(L.hostname || '');
    var a = '../shared/assets/', b = '_shared/assets/';
    return pub ? [a, b] : [b, a];
  }

  /** 한 번만 — 기준 주소 후보를 차례로 두드려 되는 쪽을 정한다(작은 출처 파일 하나) */
  function probe() {
    if (state !== 'init') { return; }
    if (!global.fetch) { state = 'fail'; return; }
    state = 'probing';
    var list = bases(), i = 0;
    (function next() {
      if (i >= list.length) { state = 'fail'; return; }
      var b = list[i++];
      global.fetch(b + 'world3d/altar_01.license.json').then(function (r) {
        if (r && r.ok) { root = b; state = 'ok'; whenLoaded(applyProps); } else { next(); }
      })['catch'](next);
    })();
  }

  function whenLoaded(f) {
    if (!global.document || global.document.readyState === 'complete') { setTimeout(f, 0); } else { global.addEventListener('load', f); }
  }

  /**
   * 판별 소품 표(`DG.cfg.assets3d.prop` = { 소품이름: [world3d id…] })를 사가고 `prop3d` 의 등록 표에 얹는다 — 있는 자리만 바꾼다
   * (집·등롱·우물…). 시험이 ok 일 때만, 표에 있는 id 가 실제 GLB 일 때만. 안 되면 옛 표 그대로. 얹은 뒤 미리 받기를 한 번 더 부른다.
   */
  function applyProps() {
    return applyProp3d() + applyReg();
  }

  /** 판별 배우·소품 표(`DG.cfg.assets3d.reg` = { asset3d 키: [world3d id…] })를 `asset3d.register` 로 얹는다(사가블로 — 키마다 한 줄 표). 같은 규칙: 되는 id 만 */
  function applyReg() {
    var A3 = global.DG && global.DG.asset3d, t = cfg().reg, key, list, i, urls, n = 0;
    if (!A3 || !A3.register || !t || !tunedOn()) { return 0; }
    for (key in t) {
      if (!t.hasOwnProperty(key)) { continue; }
      list = t[key]; urls = [];
      for (i = 0; i < list.length; i++) { var u = url('world', list[i]); if (u) { urls.push(u); } }
      if (urls.length) { A3.register(key, urls.length === 1 ? urls[0] : urls); n++; }   // 한 칸이면 문자열 그대로(옛 표기와 같은 꼴)
    }
    return n;
  }

  function applyProp3d() {
    var P3 = global.DG && global.DG.prop3d, t = cfg().prop, name, list, i, urls, n = 0;
    if (!P3 || !P3.register || !t || !tunedOn()) { return 0; }
    for (name in t) {
      if (!t.hasOwnProperty(name)) { continue; }
      list = t[name]; urls = [];
      for (i = 0; i < list.length; i++) { var u = url('world', list[i]); if (u) { urls.push(u); } }
      if (urls.length) { P3.register(name, 'all', urls); n++; }
    }
    if (n && P3.preload) { P3.preload(); }
    return n;
  }

  function tunedOn() {
    var C = global.DG && global.DG.core;
    return !(C && C.tuned && !C.tuned('assets3d.on', 1));
  }

  /** 통일 GLB 주소 — kind 'hero'(영웅 id) · 'world'(건물·지물·지형·탈것 id). 없으면 null */
  function url(kind, id) {
    if (state === 'init') { probe(); }
    if (state !== 'ok' || !id || !tunedOn() || !set(kind)[id]) { return null; }
    return root + (kind === 'hero' ? 'characters3d/' : 'world3d/') + id + '.glb';
  }

  global.DG = global.DG || {};
  /** 통일 2D 스프라이트(`world2d/<id>.webp`, 256px 알파 한 장) 주소 — 3D 와 같은 id. 없으면 null */
  function spriteUrl(id) {
    if (state === 'init') { probe(); }
    if (state !== 'ok' || !id || !tunedOn() || !set('world')[id]) { return null; }
    return root + 'world2d/' + id + '.webp';
  }

  /** 영웅 몸 레시피(asset3d `heroRecipe` 맨 앞) — 통일 GLB 가 있으면 `{key, body}`(몸짓은 몸에서 읽어 굽는다 = anim-own), 없으면 null */
  function heroRecipe(ref) {
    var id = ref && typeof ref === 'object' ? ref.id : String(ref || '').replace(/^hero:/, ''), u = url('hero', id);   // 사가블로는 'hero:<id>' 문자열 씨앗을 준다
    return u ? { key: 'uni:' + id, body: u } : null;
  }

  global.DG.assets3d = {
    url: url, spriteUrl: spriteUrl, probe: probe, heroRecipe: heroRecipe, applyProps: applyProps,
    has: function (kind, id) { return !!set(kind)[id]; },
    /** 진단·점검용 — 'init' | 'probing' | 'ok' | 'fail' */
    state: function () { return state; },
    root: function () { return root; },
    /** 시험이 끝나면(되든 안 되든) 부른다 — 이미 끝났으면 바로 */
    whenSettled: function (cb) {
      probe();
      (function wait() { if (state === 'ok' || state === 'fail') { cb(state === 'ok'); } else { setTimeout(wait, 50); } })();
    },
    _reset: function () { state = 'init'; root = null; sets = null; }
  };
  probe();
})(typeof window !== 'undefined' ? window : this);
