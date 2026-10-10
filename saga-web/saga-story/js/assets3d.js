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
      sets = { hero: {}, world: {}, world2d: {} };   // world2d — GLB 짝 없는 2D 그림(W-0114)
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
    /* W-0074 — 동기 한 번으로 정한다. 비동기로 두면 시험이 끝나기 전에 세운 사람(부팅 직후 주민·주인공)이 url() null 을 받아
       옛 몸(VRoid 샘플·QRPG·mpfb)으로 서 버리고 다시 안 바뀌었다(사가마을 주민·주인공에서 확인). 작은 출처 파일 하나·부팅 때 한 번뿐 */
    if (global.XMLHttpRequest) {
      var sl = bases(), si;
      for (si = 0; si < sl.length; si++) {
        try {
          var x = new global.XMLHttpRequest();
          x.open('GET', sl[si] + 'world3d/altar_01.license.json', false); x.send();
          if (x.status >= 200 && x.status < 300) { root = sl[si]; state = 'ok'; whenLoaded(applyProps); return; }
        } catch (e) { /* file: 등 — 다음 후보 */ }
      }
      state = 'fail'; return;
    }
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
   * 판별 소품 표(`DG.cfg.assets3d.prop` = { 소품이름: [world3d id…] })를 사가만리 `prop3d` 의 등록 표에 얹는다 — 있는 자리만 바꾼다
   * (집·등롱·우물…). 시험이 ok 일 때만, 표에 있는 id 가 실제 GLB 일 때만. 안 되면 옛 표 그대로. 얹은 뒤 미리 받기를 한 번 더 부른다.
   */
  function applyProps() {
    return applyProp3d() + applyReg();
  }

  /** 판별 배우·소품 표(`DG.cfg.assets3d.reg` = { asset3d 키: [world3d id…] })를 `asset3d.register` 로 얹는다(사가나락 — 키마다 한 줄 표). 같은 규칙: 되는 id 만 */
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
    if (state !== 'ok' || !id || !tunedOn() || !(set('world')[id] || set('world2d')[id])) { return null; }
    return root + 'world2d/' + id + '.webp';
  }

  /** 영웅 몸 레시피(asset3d `heroRecipe` 맨 앞) — 통일 GLB 가 있으면 `{key, body}`(몸짓은 몸에서 읽어 굽는다 = anim-own), 없으면 null */
  function heroRecipe(ref) {
    var id = refId(ref), u = url('hero', id);
    return u ? { key: 'uni:' + id, body: u } : null;
  }
  /** 씨앗 → 인물 id. 사가나락는 'hero:<id>'·동료는 'ally:<id>' 문자열 씨앗을 준다(동료도 제 몸을 입게 — W-0074) */
  function refId(ref) { return ref && typeof ref === 'object' ? ref.id : String(ref || '').replace(/^(hero|ally):/, ''); }

  /**
   * 빌린 몸(W-0074) — 통일 몸이 없는 사람(주민·이야기 NPC·사람 적·절차 인물)에게 **이 판 도감과 안 겹치는** 통일 몸을 입힌다.
   * 옛 몸(VRoid 샘플 넷·Quaternius·OGA·poly.pizza)을 대신한다. 설정 `DG.cfg.assets3d.borrow` 가 있는 판만 켜진다:
   *   named: [씨앗…]  이름 있는 사람 — 이 순서대로 서로 다른 몸을 하나씩(겹치지 않는다)
   *   skip:  [씨앗…]  빌리지 않는다(현대·미래 옷이 곧 그 사람인 경우 — 맞는 새 몸이 아직 없다)
   *   skipEra: [ref.era…]  같은 뜻을 시대로(사가만리 땅 사람 folk_modern·folk_future)
   *   same:  {씨앗: 씨앗}  같은 사람(가면 벗은 참이름 등)은 같은 몸
   *   exclude: [id…]  풀에서 더 뺄 몸(도감 105 는 늘 빠진다)
   *   pool: 'all'  도감 몸도 빌린다(사가천하 — 판 인물이 299 전부라 안 겹치는 몸이 없다. 얼굴이 장수와 겹친다)
   * 나머지(절차 인물·이름 없는 적)는 named 가 안 쓴 몸에서 씨앗 해시로 고른다. 손잡이 `assets3d.borrow` 0 이면 늘 null.
   */
  var borrowed = null;   // { named: {씨앗: 몸id}, rest: [몸id…] }
  function borrowTable() {
    if (borrowed) { return borrowed; }
    var c = cfg().borrow, D = global.DG && global.DG.data, own = {}, i;
    borrowed = { named: {}, rest: [] };
    if (!c) { return borrowed; }
    /* W-0121 — 도감 끝에 붙은 사가천하 장수 사본(`realm`)·새 가상 인물(`late`)은 빼지 않는다. W-0115 로 299 몸 전부가 도감에 들자
       빌릴 몸이 0 이 돼 주민·적이 3D 는 옛 몸, 2D 는 옛 한 장 그림(흰 도포 노인)으로 떨어졌다 — 빌리는 몸은 W-0115 전과 같은 194 */
    if (c.pool !== 'all') { ((D && D.heroes) || []).forEach(function (h) { if (!h.realm && !h.late) { own[h.id] = 1; } }); }
    (c.exclude || []).forEach(function (x) { own[x] = 1; });
    var pool = (ids().hero || []).filter(function (x) { return !own[x]; }).sort();
    var names = c.named || [], step = Math.max(1, Math.floor(pool.length / Math.max(1, names.length))), used = {};
    for (i = 0; i < names.length && i < pool.length; i++) {   // 고르게 띄엄띄엄 — 같은 갈래(서역·선비…) 몸이 한 마을에 몰리지 않게
      var k = (i * step) % pool.length;
      while (used[pool[k]]) { k = (k + 1) % pool.length; }
      used[pool[k]] = 1; borrowed.named[names[i]] = pool[k];
    }
    borrowed.rest = pool.filter(function (x) { return !used[x]; });
    /* W-0150 — 성별을 아는 사람(인물 표의 sex)은 같은 성별 몸에서 고른다(전엔 해시뿐이라 사가나락 확장 30 중 12 가 반대 성별 몸). 표는 여기서 한 번만 */
    var hs = ids().heroSex || {};
    borrowed.bySex = { f: borrowed.rest.filter(function (x) { return hs[x] === 'f'; }), m: borrowed.rest.filter(function (x) { return hs[x] === 'm'; }) };
    borrowed.sexOf = {}; ((D && D.heroes) || []).forEach(function (h) { if (h.sex === 'f' || h.sex === 'm') { borrowed.sexOf[h.id] = h.sex; } });
    return borrowed;
  }
  /** 빌릴 몸 id 고르기(주소 없이 — 진단이 센다) — { id, seed } 또는 null */
  function borrowPick(ref) {
    var c = cfg().borrow, C = global.DG && global.DG.core;
    if (!c || (C && C.tuned && !C.tuned('assets3d.borrow', 1))) { return null; }
    var seed = ref && typeof ref === 'object' ? ref.id : String(ref || ''), id = refId(ref);
    if (!seed || set('hero')[id] || (c.skip || []).indexOf(seed) >= 0) { return null; }
    if (ref && typeof ref === 'object' && (c.skipEra || []).indexOf(ref.era) >= 0) { return null; }
    if ((c.same || {})[seed]) { seed = c.same[seed]; }
    var t = borrowTable(), b = t.named[seed], i, h = 0, sx = (ref && typeof ref === 'object' && ref.sex) || (t.sexOf && t.sexOf[id]);
    var rest = sx && t.bySex && t.bySex[sx] && t.bySex[sx].length ? t.bySex[sx] : t.rest;   // W-0150 — 성별 아는 사람은 같은 성별 몸만
    if (!b && rest.length) {
      for (i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
      b = rest[h % rest.length];
    }
    return b ? { id: b, seed: seed } : null;
  }
  function borrowRecipe(ref) {
    var p = borrowPick(ref), u = p && url('hero', p.id);
    return u ? { key: 'uni:' + p.id, body: u, borrowedFor: p.seed } : null;
  }

  global.DG.assets3d = {
    url: url, spriteUrl: spriteUrl, probe: probe, heroRecipe: heroRecipe, borrowRecipe: borrowRecipe, borrowPick: borrowPick, borrowTable: borrowTable, applyProps: applyProps,
    has: function (kind, id) { return !!set(kind)[id]; },
    /** 진단·점검용 — 'init' | 'probing' | 'ok' | 'fail' */
    state: function () { return state; },
    root: function () { return root; },
    /** 시험이 끝나면(되든 안 되든) 부른다 — 이미 끝났으면 바로 */
    whenSettled: function (cb) {
      probe();
      (function wait() { if (state === 'ok' || state === 'fail') { cb(state === 'ok'); } else { setTimeout(wait, 50); } })();
    },
    _reset: function () { state = 'init'; root = null; sets = null; borrowed = null; }
  };
  probe();
})(typeof window !== 'undefined' ? window : this);
