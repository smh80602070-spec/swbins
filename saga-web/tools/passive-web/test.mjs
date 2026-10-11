#!/usr/bin/env node
// 패시브 그물 시험 (W-0179) — vm 에 엔진(shared/js/passive-web.js)과 데모 정의를 올려 규칙을 본다. 끝 줄 `PW-TEST n/n`.
// 사용: node saga-web/tools/passive-web/test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, validate, stats, render, MIN } from './gen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '../../shared/js/passive-web.js');
const vocab = (await import(pathToFileURL(path.join(HERE, 'demo.vocab.mjs')).href)).default;

let pass = 0, total = 0;
const ok = (name, cond, info) => { total++; if (cond) { pass++; console.log('  ok   ' + name); } else { console.log('  FAIL ' + name + (info ? ' — ' + info : '')); } };

/** 엔진 + 정의 파일을 새 vm 에 올린다 */
function boot(def) {
  const box = {};
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), box, { filename: ENGINE });
  vm.runInContext(render(def, 'test'), box, { filename: 'def.js' });
  return box.DG;
}

const def = generate(vocab, null), s = stats(def);
console.log(`데모 정의: 마디 ${s.nodes} · 작은 ${s.small} · 이름난 ${s.notable} · 규칙 ${s.keystone} · 시작점 ${s.starts} · 간선 ${s.edges}`);

// ① 크기
ok('① 크기 기준(마디≥300·이름난≥40·규칙≥8·시작점=어휘 수)', s.nodes >= MIN.nodes && s.notable >= MIN.notable && s.keystone >= MIN.keystone && s.starts === vocab.starts.length, JSON.stringify(s));
// ② 이음
const bad = validate(def, vocab);
ok('② 시작점마다 모든 마디에 닿음(다른 시작점 안 지남)·id/간선 온전', bad.length === 0, bad.join(' · '));

const DG = boot(def), PW = DG.passiveWeb, D = DG.passiveDef;
let pts = 20;
const store = { start: null, taken: [] }, api = PW.make(D, store, { points: () => pts });
const adj = PW.index(D).adj, id = (i) => D.nodes[i].id, idx = (x) => PW.index(D).byId[x];

// ③ 찍기 거절
const o = D.nodes.find((n) => n.k === 'o' && n.s === 'iron');
const far = D.nodes.find((n) => n.k === 'n');
const noStart = !api.canTake(far.id) && api.why(far.id) === 'nostart';
api.take(o.id);
// 시작점 옆 마디 nb 와, nb 에만 붙은(시작점 옆이 아닌) nb2 — 그래야 nb 가 길목
const oi = idx(o.id), nbi = adj[oi].find((i) => adj[i].some((j) => j !== oi && D.nodes[j].k !== 'o' && !adj[oi].includes(j)));
const nb = id(nbi), nb2 = id(adj[nbi].find((j) => j !== oi && D.nodes[j].k !== 'o' && !adj[oi].includes(j)));
const farId = D.nodes.find((n, i) => n.k === 's' && !adj[idx(o.id)].includes(i) && api.why(n.id) === 'far').id;
const farRej = !api.take(farId);
pts = 0; const noPts = !api.take(nb) && api.why(nb) === 'points'; pts = 20;
const nbOk = api.take(nb) && store.taken[0] === nb;
const otherStart = D.nodes.find((n) => n.k === 'o' && n.s !== 'iron');
ok('③ 이웃 아니면·점수 없으면·시작점 없으면 거절, 이웃은 찍힘', noStart && farRej && noPts && nbOk && !api.canTake(otherStart.id), `${noStart} ${farRej} ${noPts} ${nbOk}`);

// ④ 끊기는 drop 거절, 잎은 허용
api.take(nb2);
const midRej = !api.canDrop(nb) && !api.drop(nb);
const leafOk = api.canDrop(nb2) && api.drop(nb2) && api.canDrop(nb) && api.drop(nb) && store.taken.length === 0;
ok('④ 끊기는 되돌리기 거절, 잎은 허용', midRej && leafOk, `${midRej} ${leafOk}`);

// ⑤ 같은 씨앗 두 번 → 같은 결과
ok('⑤ 같은 씨앗 → 같은 정의', JSON.stringify(generate(vocab, null)) === JSON.stringify(def));

// ⑥ 어휘에 마디 하나 더해 다시 → 옛 id·좌표·간선 그대로
const v2 = { ...vocab, notable: vocab.notable.concat([{ key: 'added', name: '새로 단 마디', stats: { hp: 10, atk: 5 }, theme: 'hp' }]), keystone: vocab.keystone.concat([{ key: 'added_k', name: '새 규칙', rule: 'added_k', desc: '시험' }]) };
const def2 = generate(v2, JSON.parse(JSON.stringify(def)));
const same = def.nodes.every((n, i) => def2.nodes[i].id === n.id && def2.nodes[i].x === n.x && def2.nodes[i].y === n.y) && def.edges.every((e, i) => def2.edges[i][0] === e[0] && def2.edges[i][1] === e[1]);
const grew = def2.nodes.some((n) => n.id === 'n_added') && def2.nodes.some((n) => n.id === 'k_added_k') && validate(def2, v2).length === 0;
let lostFail = false;
try { generate({ ...vocab, notable: vocab.notable.slice(1) }, JSON.parse(JSON.stringify(def))); } catch (e) { lostFail = /사라짐/.test(e.message); }
ok('⑥ 어휘 더해 다시 → 옛 id·좌표·간선 그대로, 새 마디 이어짐, 옛 id 사라지면 FAIL', same && grew && lostFail, `same=${same} grew=${grew} lostFail=${lostFail} ${validate(def2, v2).join(' · ')}`);

// ⑦ sum·has·pathTo·takePath·세이브 왕복
const ks = D.nodes.find((n) => n.k === 'k');
pts = 400;
const p = api.pathTo(ks.id);
const took = p && api.takePath(ks.id);
const hasRule = api.has(ks.rule);
let want = {};
[o.id].concat(store.taken).forEach((x) => { const st = D.nodes[idx(x)].stats || {}; for (const k in st) { want[k] = (want[k] || 0) + st[k]; } });
const sumOk = Object.keys(want).length > 0 && Object.keys(want).every((k) => Math.abs(api.sum(k) - want[k]) < 1e-9) && api.sum('없는키') === 0;
const saved = JSON.parse(JSON.stringify(store));
const api2 = PW.make(D, saved, { points: () => pts });
const round = api2.has(ks.rule) && api2.used() === store.taken.length && api2.left() === pts - store.taken.length;
const keyDrop = api.drop(ks.id) && !api.has(ks.rule);
api.reset();
ok('⑦ sum·has·경로 찍기·세이브 왕복·되돌리면 규칙 꺼짐', took && p.cost === p.path.length && hasRule && sumOk && round && keyDrop && store.taken.length === 0 && api.sum(Object.keys(want)[0]) === (D.nodes[idx(o.id)].stats[Object.keys(want)[0]] || 0), `took=${took} has=${hasRule} sum=${sumOk} round=${round} drop=${keyDrop}`);

// ⑧ 낡은 세이브 정리: 모르는 id·끊긴 마디는 걸러진다
const dirty = { start: 'iron', taken: ['없는id', farId, nb] };
PW.make(D, dirty, { points: () => 10 });
ok('⑧ 낡은 세이브 정리(모르는 id·끊긴 마디 걸러냄)', dirty.taken.length === 1 && dirty.taken[0] === nb, JSON.stringify(dirty.taken));

// 모양 참고(실패 아님): 간선 교차·가장 가까운 두 마디
const P = D.nodes, cr = (a, b, c, d) => { const f = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return f(a, b, c) * f(a, b, d) < -1e-12 && f(c, d, a) * f(c, d, b) < -1e-12; };
let xs = 0;
for (let i = 0; i < D.edges.length; i++) { for (let j = i + 1; j < D.edges.length; j++) { const [a, b] = D.edges[i], [c, d] = D.edges[j]; if (a !== c && a !== d && b !== c && b !== d && cr(P[a], P[b], P[c], P[d])) { xs++; } } }
let md = 9;
for (let i = 0; i < P.length; i++) { for (let j = i + 1; j < P.length; j++) { md = Math.min(md, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y)); } }
console.log(`모양: 간선 교차 ${xs} · 가장 가까운 두 마디 ${md.toFixed(3)} · 고리 수 ${D.edges.length - D.nodes.length + 1}`);
console.log(`PW-TEST ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
