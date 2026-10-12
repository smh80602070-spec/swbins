/**
 * 패시브 그물 (W-0179) — 다섯 판이 같이 쓰는 그물형 패시브 나무의 로직·세이브. DOM 없음(화면은 passive-web-ui.js).
 * 정의 `DG.passiveDef` = { v, seed, starts:[{key,name,x,y,color}], nodes:[{id,k,x,y,name,stats,rule?,desc?,s?,t?}], edges:[[i,j]] }
 *   k = 's' 작은 · 'n' 이름난 · 'k' 규칙 · 'o' 시작점(s = 시작점 key). 판별 js/data-passive.js 는 생성기가 쓴다(손으로 안 고침).
 * 세이브 칸 `store` = { start:null, taken:[] } — 판이 세이브 안 평범한 객체를 준다(키만 더하고 기존 키는 안 바꿈).
 * 찍기 규칙: 시작점은 공짜, 나머지 한 마디 1점 · 이미 찍은 마디(또는 고른 시작점)에 이웃해야 찍힌다 · 다른 시작점은 지나가지 못한다.
 * 정본 shared/js/passive-web.js (tools/sync-shared.mjs).
 */
(function (global) {
  'use strict';
  global.DG = global.DG || {};

  /** 정의 → 이웃 표(번호) · id→번호 · 시작점 key→번호. 같은 정의는 한 번만 센다 */
  function index(def) {
    if (def._pw) { return def._pw; }
    var n = def.nodes.length, adj = [], byId = {}, startOf = {}, i;
    for (i = 0; i < n; i++) { adj.push([]); byId[def.nodes[i].id] = i; if (def.nodes[i].k === 'o') { startOf[def.nodes[i].s] = i; } }
    def.edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    Object.defineProperty(def, '_pw', { value: { adj: adj, byId: byId, startOf: startOf }, enumerable: false });
    return def._pw;
  }

  function make(def, store, opt) {
    opt = opt || {};
    var ix = index(def), N = def.nodes, adj = ix.adj, byId = ix.byId;
    var subs = [], sums = null, takenSet = {};
    if (!store.taken) { store.taken = []; }
    if (store.start === undefined) { store.start = null; }

    function points() { var p = opt.points ? opt.points() : 0; return p > 0 ? p : 0; }
    function used() { return store.taken.length; }
    function left() { return points() - used(); }
    function startIdx() { return store.start != null && ix.startOf[store.start] != null ? ix.startOf[store.start] : -1; }
    function rebuild() { takenSet = {}; store.taken.forEach(function (id) { takenSet[id] = 1; }); sums = null; }
    function isTaken(id) { return !!takenSet[id] || (byId[id] != null && byId[id] === startIdx()); }
    function fire() { rebuild(); subs.slice().forEach(function (fn) { try { fn(); } catch (e) { /* 듣는 쪽 잘못은 삼킨다 */ } }); }

    /** 시작점에서 찍은 마디만 밟아 닿는 곳(번호 표). skip = 빼 보고 셀 번호 */
    function reach(skip) {
      var s = startIdx(), seen = {}, q, i, j, a;
      if (s < 0) { return seen; }
      seen[s] = 1; q = [s];
      while (q.length) {
        i = q.shift(); a = adj[i];
        for (j = 0; j < a.length; j++) {
          if (seen[a[j]] || a[j] === skip || !takenSet[N[a[j]].id]) { continue; }
          seen[a[j]] = 1; q.push(a[j]);
        }
      }
      return seen;
    }
    /** 정의가 바뀌었거나 세이브가 낡았을 때: 모르는 id·시작점과 끊긴 마디를 걸러 낸다 */
    function sanitize() {
      if (store.start != null && ix.startOf[store.start] == null) { store.start = null; }
      var keep = store.taken.filter(function (id, p) { return byId[id] != null && N[byId[id]].k !== 'o' && store.taken.indexOf(id) === p; });
      if (store.start == null) { keep = []; }
      store.taken = keep; rebuild();
      var r = reach(-1);
      store.taken = store.taken.filter(function (id) { return r[byId[id]]; });
      rebuild();
    }

    /** 찍을 수 없는 까닭 — '' 면 찍힌다 */
    function why(id) {
      var i = byId[id];
      if (i == null) { return 'none'; }
      if (isTaken(id)) { return 'taken'; }
      var nd = N[i];
      if (nd.k === 'o') { return store.start == null ? '' : 'start'; }
      if (store.start == null) { return 'nostart'; }
      if (left() < 1) { return 'points'; }
      var s = startIdx(), a = adj[i], j;
      for (j = 0; j < a.length; j++) { if (a[j] === s || takenSet[N[a[j]].id]) { return ''; } }
      return 'far';
    }
    function canTake(id) { return why(id) === ''; }
    function take(id) {
      if (!canTake(id)) { return false; }
      if (N[byId[id]].k === 'o') { store.start = N[byId[id]].s; store.taken = []; } else { store.taken.push(id); }
      fire(); return true;
    }
    function canDrop(id) {
      if (!takenSet[id]) { return false; }
      var i = byId[id], r = reach(i), k;
      for (k = 0; k < store.taken.length; k++) { if (store.taken[k] !== id && !r[byId[store.taken[k]]]) { return false; } }
      return true;
    }
    function drop(id) {
      if (!canDrop(id)) { return false; }
      store.taken.splice(store.taken.indexOf(id), 1); fire(); return true;
    }
    /** 찍은 곳에서 id 까지 가장 짧은 길 — { path:[아직 안 찍은 id…], cost } · 못 닿으면 null */
    function pathTo(id) {
      var t = byId[id];
      if (t == null) { return null; }
      if (isTaken(id)) { return { path: [], cost: 0 }; }
      if (N[t].k === 'o') { return store.start == null ? { path: [id], cost: 0 } : null; }
      var s = startIdx();
      if (s < 0) { return null; }
      var prev = {}, q = [], i, j, a, nb;
      prev[s] = -1; q.push(s);
      store.taken.forEach(function (tid) { var b = byId[tid]; prev[b] = -1; q.push(b); });
      while (q.length) {
        i = q.shift();
        if (i === t) { break; }
        a = adj[i];
        for (j = 0; j < a.length; j++) {
          nb = a[j];
          if (prev[nb] !== undefined || N[nb].k === 'o') { continue; }
          prev[nb] = i; q.push(nb);
        }
      }
      if (prev[t] === undefined) { return null; }
      var path = [];
      for (i = t; prev[i] !== -1; i = prev[i]) { path.unshift(N[i].id); }
      return { path: path, cost: path.length };
    }
    /** 길째 찍기 — 점수가 모자라면 아무것도 안 찍는다 */
    function takePath(id) {
      var p = pathTo(id);
      if (!p || !p.path.length) { return false; }
      if (N[byId[id]].k === 'o') { return take(id); }
      if (p.cost > left()) { return false; }
      p.path.forEach(function (pid) { store.taken.push(pid); });
      fire(); return true;
    }
    function eachTaken(fn) {
      var s = startIdx();
      if (s >= 0) { fn(N[s]); }
      store.taken.forEach(function (id) { fn(N[byId[id]]); });
    }
    function sum(key) {
      if (!sums) {
        sums = {};
        eachTaken(function (nd) { var st = nd.stats || {}, k; for (k in st) { if (typeof st[k] === 'number') { sums[k] = (sums[k] || 0) + st[k]; } } });
      }
      return sums[key] || 0;
    }
    function has(rule) { var hit = false; eachTaken(function (nd) { if (nd.rule === rule) { hit = true; } }); return hit; }
    /** 전부 되돌리기 — all 이면 시작점도 비운다 */
    function reset(all) { store.taken = []; if (all) { store.start = null; } fire(); }
    function setStart(key) {
      if (ix.startOf[key] == null) { return false; }
      if (store.start !== key) { store.start = key; store.taken = []; fire(); }
      return true;
    }
    /** 화면용 상태: 'taken' · 'can'(지금 찍힘) · 'no' */
    function state(id) { return isTaken(id) ? 'taken' : (canTake(id) ? 'can' : 'no'); }
    function onChange(fn) { subs.push(fn); return function () { var p = subs.indexOf(fn); if (p >= 0) { subs.splice(p, 1); } }; }

    sanitize();
    return {
      def: def, store: store,
      canTake: canTake, why: why, take: take, canDrop: canDrop, drop: drop, pathTo: pathTo, takePath: takePath,
      sum: sum, has: has, left: left, used: used, points: points, reset: reset, setStart: setStart,
      isTaken: isTaken, state: state, onChange: onChange,
      neighbors: function (id) { var i = byId[id]; return i == null ? [] : adj[i].map(function (j) { return N[j].id; }); },
      node: function (id) { return byId[id] == null ? null : N[byId[id]]; },
      start: function () { return store.start; },
    };
  }

  global.DG.passiveWeb = { make: make, index: index, V: 1 };
})(typeof window !== 'undefined' ? window : this);
