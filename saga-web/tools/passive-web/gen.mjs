#!/usr/bin/env node
// 패시브 그물 생성기 (W-0179) — 어휘 → saga-web/<판>/js/data-passive.js (DG.passiveDef, 엔진 shared/js/passive-web.js)
//
// 사용: node saga-web/tools/passive-web/gen.mjs <판|demo> [--vocab <파일>] [--out <파일>] [--prev <파일>] [--fresh]
//   기본 어휘 saga-web/tools/passive-web/<판에서 saga- 뗀 이름>.vocab.mjs · 기본 출력 saga-web/<판>/js/data-passive.js
//   demo = demo.vocab.mjs → _out/demo-passive.js(커밋 안 함). 출력이 이미 있으면 그 id·좌표·간선을 그대로 두고 새 마디만 더한다
//   (--prev 로 다른 옛 파일, --fresh 로 처음부터). 옛 id 가 어휘에서 사라지면 FAIL — 세이브가 id 를 쥔다.
//
// 어휘 형식(export default):
//   seed?   씨앗(기본 20260824) · step? 이음길 마디 간격(기본 0.09) · minNodes? 최소 마디(기본 300)
//   starts  [{ key, name, color, center?, theme?:[small key…], stats? }] 4~7 — center:true 하나는 가운데, 나머지는 반지름 0.55 고리
//   small   [{ key, name, stats:{키:값} }] — 작은 마디 효과. 묶음·이음길이 theme 에 맞춰 고른다
//   notable [{ key, name, stats, theme?:small key, desc? }] ≥40 — 하나가 바퀴 묶음 하나(이름난 1 + 작은 4~6)
//   keystone[{ key, name, rule, desc, stats? }] ≥8 — 바깥 고리에서 외길 2~3마디 끝
//   id: 시작점 o_<key> · 이름난 n_<key> · 규칙 k_<key> · 작은 s<번호>(작은 마디는 t = small key)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
export const MIN = { nodes: 300, notable: 40, keystone: 8, starts: [4, 7] };
const RINGS = [0.27, 0.74, 0.97], START_R = 0.55, WHEEL_R = 0.055, SPOKE_R = 0.06, KEY_STEP = 0.06;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function cross(p, q, r, s) {   // 선분 pq·rs 가 끝점이 아닌 곳에서 만나나
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p, q, r), d2 = d(p, q, s), d3 = d(r, s, p), d4 = d(r, s, q);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}

/** 그물 짜는 판 — 마디·간선을 쌓는다 */
function Board(vocab, rnd, nodes, edges) {
  const B = { nodes, edges, rnd, set: new Set(edges.map(([a, b]) => a < b ? a + ',' + b : b + ',' + a)) };
  const smallBy = Object.fromEntries(vocab.small.map((s) => [s.key, s]));
  let sn = nodes.reduce((m, n) => n.k === 's' ? Math.max(m, +n.id.slice(1) || 0) : m, 0);
  B.add = (o) => { o.x = r3(o.x); o.y = r3(o.y); nodes.push(o); return nodes.length - 1; };
  B.link = (a, b) => {
    if (a === b) { return; }
    const k = a < b ? a + ',' + b : b + ',' + a;
    if (!B.set.has(k)) { B.set.add(k); edges.push([a, b]); }
  };
  B.small = (x, y, theme) => {
    const th = (theme || []).filter((k) => smallBy[k]);
    const sm = th.length && rnd() < 0.8 ? smallBy[th[Math.floor(rnd() * th.length)]] : vocab.small[Math.floor(rnd() * vocab.small.length)];
    return B.add({ id: 's' + (++sn), k: 's', x, y, name: sm.name, stats: { ...sm.stats }, t: sm.key });
  };
  /** 두 마디 사이를 이음길 작은 마디로 채워 잇는다 */
  B.road = (a, b, theme, step) => {
    const A = nodes[a], C = nodes[b], c = Math.max(0, Math.round(dist(A, C) / step) - 1);
    let prev = a;
    for (let i = 1; i <= c; i++) {
      const t = i / (c + 1), j = B.small(A.x + (C.x - A.x) * t, A.y + (C.y - A.y) * t, theme);
      B.link(prev, j); prev = j;
    }
    B.link(prev, b);
  };
  /** 바퀴 묶음: 이름난 가운데 + 작은 4~6 이 활꼴로 이어짐, 이름난은 활 가운데에 */
  B.wheel = (cx, cy, nt) => {
    const n = B.add({ id: 'n_' + nt.key, k: 'n', x: cx, y: cy, name: nt.name, stats: { ...nt.stats }, ...(nt.desc ? { desc: nt.desc } : {}) });
    const m = 4 + Math.floor(rnd() * 3), a0 = rnd() * Math.PI * 2, sm = [];
    for (let j = 0; j < m; j++) {
      const a = a0 + (j + 0.5) * Math.PI * 2 / (m + 1);
      sm.push(B.small(cx + Math.cos(a) * WHEEL_R, cy + Math.sin(a) * WHEEL_R, nt.theme ? [nt.theme] : []));
      if (j) { B.link(sm[j - 1], sm[j]); }
    }
    B.link(n, sm[Math.floor((m - 1) / 2)]); B.link(n, sm[Math.ceil((m - 1) / 2)]);
    return { c: { x: cx, y: cy }, entries: sm, theme: nt.theme ? [nt.theme] : [], n };
  };
  B.start = (st, x, y) => {
    const o = B.add({ id: 'o_' + st.key, k: 'o', s: st.key, x, y, name: st.name, stats: { ...(st.stats || {}) } });
    const sp = [], a0 = rnd() * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const a = a0 + j * Math.PI / 2, s = B.small(x + Math.cos(a) * SPOKE_R, y + Math.sin(a) * SPOKE_R, st.theme);
      B.link(o, s); sp.push(s);
    }
    sp.forEach((s, j) => B.link(s, sp[(j + 1) % sp.length]));   // 둘레 고리 — 막다른 살이 없게(다른 시작점에서도 닿는다)
    return { c: { x, y }, entries: sp, theme: st.theme || [], n: o };
  };
  /** 규칙 마디: from 에서 바깥으로 외길 2~3 + 끝 */
  B.keystone = (from, ks) => {
    const F = nodes[from], len = Math.hypot(F.x, F.y) || 1, ux = F.x / len, uy = F.y / len, c = 2 + (rnd() < 0.5 ? 1 : 0);
    let prev = from;
    for (let i = 1; i <= c; i++) { const j = B.small(F.x + ux * KEY_STEP * i, F.y + uy * KEY_STEP * i, nodes[from].t ? [nodes[from].t] : []); B.link(prev, j); prev = j; }
    const k = B.add({ id: 'k_' + ks.key, k: 'k', x: F.x + ux * KEY_STEP * (c + 1), y: F.y + uy * KEY_STEP * (c + 1), name: ks.name, rule: ks.rule, stats: { ...(ks.stats || {}) }, desc: ks.desc || '' });
    B.link(prev, k);
    return k;
  };
  B.entryToward = (hub, p) => hub.entries.reduce((b, e) => dist(nodes[e], p) < dist(nodes[b], p) ? e : b, hub.entries[0]);
  return B;
}

function fresh(vocab, step) {
  const rnd = mulberry32(vocab.seed ?? 20260824), B = Board(vocab, rnd, [], []);
  const center = vocab.starts.filter((s) => s.center).slice(0, 1), ring = vocab.starts.filter((s) => s !== center[0]);
  const hubs = [], ringHubs = [];
  center.forEach((s) => hubs.push(B.start(s, 0, 0)));
  const sa = rnd() * Math.PI * 2;
  ring.forEach((s, i) => { const a = sa + i * Math.PI * 2 / ring.length, h = B.start(s, Math.cos(a) * START_R, Math.sin(a) * START_R); h.st = s; hubs.push(h); ringHubs.push(h); });
  // 묶음 자리: 고리 셋에 둘레 비례
  const N = vocab.notable.length, sumR = RINGS.reduce((a, b) => a + b, 0), cnt = RINGS.map((r) => Math.round(N * r / sumR));
  cnt[2] += N - cnt.reduce((a, b) => a + b, 0);
  const spots = [];
  RINGS.forEach((r, ri) => {
    const a0 = rnd() * Math.PI * 2, gap = Math.PI * 2 / cnt[ri];
    for (let i = 0; i < cnt[ri]; i++) {
      const a = a0 + i * gap + (rnd() - 0.5) * gap * 0.5, rr = r + (rnd() - 0.5) * 0.06;
      spots.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, ring: ri });
    }
  });
  // 이름난 배정: 가까운 시작점의 theme 와 맞는 것 먼저(구역 맛)
  const left = vocab.notable.slice();
  const clusters = spots.map((p) => {
    const near = ringHubs.reduce((b, h) => !b || dist(h.c, p) < dist(b.c, p) ? h : b, null);
    const th = (near && near.theme) || [];
    let i = left.findIndex((nt) => th.includes(nt.theme));
    if (i < 0) { i = 0; }
    const w = B.wheel(p.x, p.y, left.splice(i, 1)[0]); w.ring = p.ring;
    hubs.push(w);
    return w;
  });
  // 묶음끼리: 최소 신장 나무(시작점 빼고 — 시작점은 지나갈 수 없으니 길목이 되면 안 된다)
  //   → 시작점마다 가까운 묶음 둘에 붙임 → 고리를 만드는 가외 줄(겹치지 않게)
  const H = hubs.length, hl = [], hadj = hubs.map(() => new Set()), S0 = vocab.starts.length;
  const hlink = (a, b) => { hl.push([a, b]); hadj[a].add(b); hadj[b].add(a); };
  const crosses = (a, b) => hl.some(([c, d]) => c !== a && c !== b && d !== a && d !== b && cross(hubs[a].c, hubs[b].c, hubs[c].c, hubs[d].c));
  // 시작점 곁을 지나는 줄은 무겁게 — 시작점 둘레 고리를 가로지르지 않게
  const wgt = (i, j) => dist(hubs[i].c, hubs[j].c) + (hubs.slice(0, S0).some((h) => segDist(h.c, hubs[i].c, hubs[j].c) < 0.11) ? 10 : 0);
  const inT = { [S0]: true }, best = hubs.map((h, i) => [wgt(i, S0), S0]);
  for (let k = S0 + 1; k < H; k++) {
    let m = -1;
    for (let i = S0; i < H; i++) { if (!inT[i] && (m < 0 || best[i][0] < best[m][0])) { m = i; } }
    inT[m] = true; hlink(best[m][1], m);
    for (let i = S0; i < H; i++) { const d = wgt(i, m); if (!inT[i] && d < best[i][0]) { best[i] = [d, m]; } }
  }
  for (let a = 0; a < S0; a++) {
    const near = clusters.map((c, i) => S0 + i).sort((p, q) => dist(hubs[p].c, hubs[a].c) - dist(hubs[q].c, hubs[a].c));
    let got = 0;
    for (const b of near) { if (got >= 2) { break; } if (!crosses(a, b)) { hlink(a, b); got++; } }
  }
  const hops = (a, b) => { const seen = new Map([[a, 0]]), q = [a]; while (q.length) { const i = q.shift(); if (i === b) { return seen.get(i); } for (const j of hadj[i]) { if (!seen.has(j)) { seen.set(j, seen.get(i) + 1); q.push(j); } } } return 99; };
  const pairs = [];
  for (let a = S0; a < H; a++) { for (let b = a + 1; b < H; b++) { const d = dist(hubs[a].c, hubs[b].c); if (d < 0.5) { pairs.push([d, a, b]); } } }
  pairs.sort((p, q) => p[0] - q[0]);
  let extra = 0;
  for (const [, a, b] of pairs) {
    if (extra >= Math.ceil(H * 0.4)) { break; }
    if (hadj[a].has(b) || hops(a, b) < 3) { continue; }
    const P = hubs[a].c, Q = hubs[b].c;
    if (crosses(a, b)) { continue; }
    if (hubs.some((h, i) => i !== a && i !== b && segDist(h.c, P, Q) < 0.09)) { continue; }
    hlink(a, b); extra++;
  }
  for (const [a, b] of hl) {
    const ea = B.entryToward(hubs[a], hubs[b].c), eb = B.entryToward(hubs[b], B.nodes[ea]);
    B.road(ea, eb, [...new Set([...hubs[a].theme, ...hubs[b].theme])], step);
  }
  // 규칙 마디: 바깥 고리 묶음에서 고르게
  const outer = clusters.filter((c) => c.ring === 2), used = new Set(), ka = rnd() * Math.PI * 2;
  vocab.keystone.forEach((ks, i) => {
    const a = ka + i * Math.PI * 2 / vocab.keystone.length;
    const cand = outer.filter((c) => !used.has(c)).sort((p, q) => angDiff(Math.atan2(p.c.y, p.c.x), a) - angDiff(Math.atan2(q.c.y, q.c.x), a))[0] || outer[i % outer.length];
    used.add(cand);
    const from = cand.entries.reduce((b, e) => Math.hypot(B.nodes[e].x, B.nodes[e].y) > Math.hypot(B.nodes[b].x, B.nodes[b].y) ? e : b, cand.entries[0]);
    B.keystone(from, ks);
  });
  return { nodes: B.nodes, edges: B.edges };
}
function angDiff(a, b) { const d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; }
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

/** 옛 정의 위에 새 마디만 더한다 — 옛 id·좌표·간선은 그대로 */
function grow(vocab, prev, step) {
  const by = (arr) => Object.fromEntries(arr.map((v) => [v.key, v]));
  const S = by(vocab.starts), SM = by(vocab.small), NT = by(vocab.notable), KS = by(vocab.keystone);
  const nodes = prev.nodes.map((n) => JSON.parse(JSON.stringify(n))), edges = prev.edges.map((e) => e.slice());
  const lost = [];
  for (const n of nodes) {   // 어휘에서 이름·효과를 새로 받는다(id·좌표는 그대로)
    const v = n.k === 'o' ? S[n.s] : n.k === 'n' ? NT[n.id.slice(2)] : n.k === 'k' ? KS[n.id.slice(2)] : SM[n.t];
    if (!v) { lost.push(n.id); continue; }
    n.name = v.name;
    if (n.k === 's' || n.k === 'n' || n.k === 'o') { n.stats = { ...(v.stats || {}) }; }
    if (n.k === 'n') { if (v.desc) { n.desc = v.desc; } else { delete n.desc; } }
    if (n.k === 'k') { n.rule = v.rule; n.stats = { ...(v.stats || {}) }; n.desc = v.desc || ''; }
  }
  if (lost.length) { throw new Error('옛 마디가 어휘에서 사라짐(세이브가 id 를 쥔다): ' + lost.join(', ')); }
  const rnd = mulberry32((vocab.seed ?? 20260824) ^ Math.imul(nodes.length, 2654435761)), B = Board(vocab, rnd, nodes, edges);
  const have = new Set(nodes.map((n) => n.id));
  const deg = () => { const d = nodes.map(() => 0); edges.forEach(([a, b]) => { d[a]++; d[b]++; }); return d; };
  // 규칙 외길(규칙에서 거꾸로 차수 2 인 마디들)은 붙일 곳에서 뺀다
  const chainSet = () => {
    const d = deg(), adj = nodes.map(() => []), out = new Set();
    edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    nodes.forEach((n, i) => { if (n.k !== 'k') { return; } out.add(i); let p = i, c = adj[i][0]; while (c != null && d[c] === 2 && nodes[c].k === 's') { out.add(c); const nx = adj[c].find((x) => x !== p); p = c; c = nx; } });
    return out;
  };
  const free = (p) => Math.min(...nodes.map((n) => dist(n, p)));
  const spot = (rad) => {   // 기존 마디에서 가장 먼 빈자리
    let bestP = null, bestD = -1;
    for (const r of rad) { for (let i = 0; i < 96; i++) { const a = i * Math.PI * 2 / 96 + rnd() * 0.02, p = { x: Math.cos(a) * r, y: Math.sin(a) * r }, d = free(p); if (d > bestD) { bestD = d; bestP = p; } } }
    return bestP;
  };
  const attach = (hub, k) => {   // 새 묶음을 가까운 기존 작은 마디 k 곳에 이음길로
    const ch = chainSet(), mine = new Set([hub.n, ...hub.entries]);
    const cand = nodes.map((n, i) => i).filter((i) => !mine.has(i) && nodes[i].k === 's' && !ch.has(i) && have.has(nodes[i].id))
      .sort((a, b) => dist(nodes[a], hub.c) - dist(nodes[b], hub.c));
    let done = 0;
    for (const t of cand) {
      if (done >= k) { break; }
      const e = B.entryToward(hub, nodes[t]);
      if (edges.some(([a, b]) => a !== t && b !== t && cross(nodes[e], nodes[t], nodes[a], nodes[b]))) { continue; }
      B.road(e, t, hub.theme, step); done++;
    }
    if (!done && cand.length) { B.road(B.entryToward(hub, nodes[cand[0]]), cand[0], hub.theme, step); }
  };
  for (const st of vocab.starts) {
    if (have.has('o_' + st.key)) { continue; }
    const p = st.center ? { x: 0, y: 0 } : spot([START_R]);
    attach(B.start(st, p.x, p.y), 2);
  }
  for (const nt of vocab.notable) {
    if (have.has('n_' + nt.key)) { continue; }
    const p = spot(RINGS), w = B.wheel(p.x, p.y, nt);
    attach(w, 2);
  }
  for (const ks of vocab.keystone) {
    if (have.has('k_' + ks.key)) { continue; }
    const ka = nodes.filter((n) => n.k === 'k').map((n) => Math.atan2(n.y, n.x));
    let a = 0, bd = -1;
    for (let i = 0; i < 72; i++) { const t = i * Math.PI / 36, d = Math.min(Math.PI, ...ka.map((x) => angDiff(x, t))); if (d > bd) { bd = d; a = t; } }
    const ch = chainSet();
    const from = nodes.map((n, i) => i).filter((i) => nodes[i].k === 's' && !ch.has(i) && Math.hypot(nodes[i].x, nodes[i].y) > 0.85)
      .sort((p, q) => angDiff(Math.atan2(nodes[p].y, nodes[p].x), a) - angDiff(Math.atan2(nodes[q].y, nodes[q].x), a))[0];
    B.keystone(from, ks);
  }
  return { nodes, edges };
}

/** 어휘 → 정의. prev 가 있으면 그 위에 더한다 */
export function generate(vocab, prev) {
  if (prev && prev.nodes && prev.nodes.length) {
    const g = grow(vocab, prev, vocab.step || 0.09);
    return pack(vocab, g);
  }
  // 마디 수가 모자라면 이음길 간격을 좁혀 다시(같은 씨앗 — 결정적)
  let step = vocab.step || 0.09, g;
  for (let k = 0; k < 12; k++, step -= 0.006) { g = fresh(vocab, step); if (g.nodes.length >= (vocab.minNodes || MIN.nodes)) { break; } }
  return pack(vocab, g);
}
function pack(vocab, g) {
  const starts = vocab.starts.map((s) => { const n = g.nodes.find((x) => x.id === 'o_' + s.key); return { key: s.key, name: s.name, x: n.x, y: n.y, color: s.color || '#cccccc' }; });
  return { v: 1, seed: vocab.seed ?? 20260824, starts, nodes: g.nodes, edges: g.edges };
}

/** 크기·이음 점검 — 문제 줄 목록(빈 배열이면 OK) */
export function validate(def, vocab) {
  const bad = [], n = def.nodes.length, cnt = (k) => def.nodes.filter((x) => x.k === k).length;
  if (n < (vocab?.minNodes || MIN.nodes)) { bad.push(`마디 ${n} < ${vocab?.minNodes || MIN.nodes}`); }
  if (cnt('n') < MIN.notable) { bad.push(`이름난 ${cnt('n')} < ${MIN.notable}`); }
  if (cnt('k') < MIN.keystone) { bad.push(`규칙 ${cnt('k')} < ${MIN.keystone}`); }
  if (cnt('o') < MIN.starts[0] || cnt('o') > MIN.starts[1]) { bad.push(`시작점 ${cnt('o')} (4~7)`); }
  const ids = new Set();
  def.nodes.forEach((x) => { if (ids.has(x.id)) { bad.push('id 겹침 ' + x.id); } ids.add(x.id); });
  const adj = def.nodes.map(() => []), seenE = new Set();
  def.edges.forEach(([a, b]) => {
    if (a === b || a < 0 || b < 0 || a >= n || b >= n) { bad.push(`간선 틀림 ${a}-${b}`); return; }
    const k = a < b ? a + ',' + b : b + ',' + a;
    if (seenE.has(k)) { bad.push('간선 겹침 ' + k); } seenE.add(k);
    adj[a].push(b); adj[b].push(a);
  });
  // 시작점마다 — 다른 시작점은 지나가지 않고 — 모든 마디에 닿나(시작점이 길목이면 어떤 시작은 반쪽 그물이 된다)
  def.nodes.forEach((x, i) => {
    if (x.k !== 'o') { return; }
    const seen = new Set([i]), q = [i];
    while (q.length) { const c = q.shift(); for (const j of adj[c]) { if (!seen.has(j) && def.nodes[j].k !== 'o') { seen.add(j); q.push(j); } } }
    const lone = def.nodes.filter((y, j) => y.k !== 'o' && !seen.has(j)).map((y) => y.id);
    if (lone.length) { bad.push(`${x.id} 에서 못 닿는 마디 ${lone.length}: ${lone.slice(0, 6).join(',')}`); }
  });
  return bad;
}

export function stats(def) {
  const c = (k) => def.nodes.filter((x) => x.k === k).length;
  return { nodes: def.nodes.length, small: c('s'), notable: c('n'), keystone: c('k'), starts: c('o'), edges: def.edges.length };
}

export function loadDef(file) {
  if (!file || !fs.existsSync(file)) { return null; }
  const box = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), box, { filename: file });
  return box.DG && box.DG.passiveDef ? JSON.parse(JSON.stringify(box.DG.passiveDef)) : null;
}

export function render(def, tag) {
  const s = stats(def), J = (v) => JSON.stringify(v);
  const edges = [];
  for (let i = 0; i < def.edges.length; i += 16) { edges.push('    ' + def.edges.slice(i, i + 16).map(J).join(',')); }
  return [
    `/* 생성물 — node saga-web/tools/passive-web/gen.mjs ${tag} (W-0179). 손으로 고치지 않는다 — 어휘 파일을 고치고 다시 돌린다(옛 id·좌표는 그대로 남는다).`,
    ` * 마디 ${s.nodes} · 작은 ${s.small} · 이름난 ${s.notable} · 규칙 ${s.keystone} · 시작점 ${s.starts} · 간선 ${s.edges} */`,
    '(function (g) {',
    '  g.DG = g.DG || {};',
    '  g.DG.passiveDef = {',
    `  v: ${def.v}, seed: ${def.seed},`,
    '  starts: [',
    ...def.starts.map((x) => '    ' + J(x) + ','),
    '  ],',
    '  nodes: [',
    ...def.nodes.map((x) => '    ' + J(x) + ','),
    '  ],',
    '  edges: [',
    edges.join(',\n'),
    '  ],',
    '  };',
    "})(typeof window !== 'undefined' ? window : this);",
    '',
  ].join('\n');
}

async function main(argv) {
  const game = argv[0];
  if (!game) { console.error('사용: node gen.mjs <판|demo> [--vocab f] [--out f] [--prev f] [--fresh]'); process.exit(2); }
  const opt = (k) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : null; };
  const short = game.replace(/^saga-/, '');
  const vocabFile = path.resolve(opt('--vocab') || path.join(HERE, short + '.vocab.mjs'));
  const out = path.resolve(opt('--out') || (game === 'demo' ? path.join(HERE, '_out', 'demo-passive.js') : path.join(ROOT, 'saga-web', game, 'js', 'data-passive.js')));
  const vocab = (await import(pathToFileURL(vocabFile).href)).default;
  const prev = argv.includes('--fresh') ? null : loadDef(opt('--prev') ? path.resolve(opt('--prev')) : out);
  let def;
  try { def = generate(vocab, prev); } catch (e) { console.error('FAIL ' + e.message); process.exit(1); }
  const bad = validate(def, vocab);
  if (bad.length) { console.error('FAIL ' + bad.join(' · ')); process.exit(1); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(def, game));
  const s = stats(def);
  console.log(`OK ${path.relative(ROOT, out).replace(/\\/g, '/')} — 마디 ${s.nodes} · 작은 ${s.small} · 이름난 ${s.notable} · 규칙 ${s.keystone} · 시작점 ${s.starts} · 간선 ${s.edges}${prev ? ' (옛 정의 위에 더함)' : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) { main(process.argv.slice(2)); }
