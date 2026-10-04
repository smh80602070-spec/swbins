#!/usr/bin/env node
/**
 * 펫·탈것·몬스터 동작 빈 칸 메우기 (K-0031 단계 3, 세션 임시 선택 = "대체 동작") — 뼈 이름이 리그마다 달라 CC0 동작을 복사할 수 없는 칸을
 * **몸 전체 루트 노드의 이동·회전·크기 키프레임**으로 만든다. 뼈를 건드리지 않아 어떤 리그(AnimalArmature·Fish_Armature·정적 모델)에도 붙는다.
 *
 * 입력 = `creature_std_names.py --apply` 가 만든 이름 맞춘 사본(tools/_out/creature_std). 표준 이름 Idle·Walk·Run·Attack·Hit·Death·Special 중
 * 파일에 없는 칸만 더한다(있는 클립은 안 건드린다). 장면 루트의 자식을 새 노드 `MotionRoot` 밑으로 옮겨 그 노드를 움직인다.
 * 앞쪽(전진 축)은 몸 바운딩 박스의 긴 가로축(+) — 틀리면 달려듦이 옆으로 보일 수 있어 시험 시트에서 계통별로 본다.
 *
 * 사용법: node creature_fill.mjs <입력 폴더> <출력 폴더> [--only 종이름,..] [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const force = args.includes('--force');
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',') : null;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
if (pos.length < 2) { console.error('사용법: node creature_fill.mjs <입력 폴더> <출력 폴더> [--only 종,..] [--force]'); process.exit(1); }
const [src, dst] = pos.map((p) => path.resolve(p));
fs.mkdirSync(dst, { recursive: true });
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const STD = ['Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death', 'Special'];
const D2R = Math.PI / 180;
const qAxis = (ax, deg) => { const h = deg * D2R / 2, s = Math.sin(h); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(h)]; };
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];

function makeClips(b) {
  const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
  const alongX = w > d;
  const F = alongX ? [1, 0, 0] : [0, 0, 1];          // 전진 축
  const S = alongX ? [0, 0, 1] : [1, 0, 0];          // 옆 축(피치 축)
  const L = Math.max(w, d), W = Math.min(w, d), H = Math.max(h, 0.05);
  const pos = (f, y = 0, side = 0) => [F[0] * f + S[0] * side, y, F[2] * f + S[2] * side];
  // 한 칸 = {t, p:[x,y,z], pitch°(옆 축 둘레, +는 앞으로 숙임), roll°(전진 축 둘레), yaw°, s:[x,y,z]}
  const K = (t, o = {}) => ({ t, p: o.p || [0, 0, 0], pitch: o.pitch || 0, roll: o.roll || 0, yaw: o.yaw || 0, s: o.s || [1, 1, 1] });
  return {
    Idle: [K(0), K(1.2, { s: [1, 1.018, 1], pitch: -0.8 }), K(2.4)],
    Walk: [K(0, { roll: -2 }), K(0.25, { p: pos(0, 0.035 * H), roll: 0, pitch: 1 }), K(0.5, { roll: 2 }), K(0.75, { p: pos(0, 0.035 * H), roll: 0, pitch: 1 }), K(1.0, { roll: -2 })],
    Run: [K(0, { pitch: 5, roll: -3 }), K(0.15, { p: pos(0, 0.07 * H), pitch: 8 }), K(0.3, { pitch: 5, roll: 3 }), K(0.45, { p: pos(0, 0.07 * H), pitch: 8 }), K(0.6, { pitch: 5, roll: -3 })],
    Attack: [K(0), K(0.15, { p: pos(-0.08 * L), pitch: -8 }), K(0.3, { p: pos(0.38 * L), pitch: 12, s: [1, 0.96, 1.04] }), K(0.45, { p: pos(0.2 * L), pitch: 5 }), K(0.7)],
    Hit: [K(0), K(0.08, { p: pos(-0.14 * L, 0.02 * H), pitch: -11, s: [1.04, 0.92, 1.04] }), K(0.2, { p: pos(-0.07 * L), pitch: -5 }), K(0.4)],
    Death: [K(0), K(0.15, { p: pos(-0.06 * L), pitch: -8 }), K(0.7, { p: pos(-0.1 * L, 0.5 * W), roll: 70, pitch: -4 }), K(1.1, { p: pos(-0.1 * L, 0.5 * W), roll: 90 })],
    Special: [K(0), K(0.2, { s: [1.05, 0.9, 1.05] }), K(0.5, { p: pos(0, 0.42 * H), yaw: 90, pitch: -6 }), K(0.8, { p: pos(0), yaw: 180 }), K(1.0, { s: [1.04, 0.94, 1.04], yaw: 180 }), K(1.3, { yaw: 360 })],
  };
}

function addClip(doc, root, name, frames, loop, F, S) {
  const buf = doc.getRoot().listBuffers()[0];
  const t = new Float32Array(frames.map((f) => f.t));
  const mk = (arr, type, comps) => doc.createAccessor().setArray(new Float32Array(arr)).setType(type).setBuffer(buf);
  const tr = [], ro = [], sc = [];
  for (const f of frames) {
    tr.push(...f.p);
    let q = qAxis([0, 1, 0], f.yaw);
    q = qMul(q, qAxis(S, f.pitch));
    q = qMul(q, qAxis(F, f.roll));
    ro.push(...q);
    sc.push(...f.s);
  }
  const anim = doc.createAnimation(name);
  const tin = mk(t, 'SCALAR');
  for (const [path, arr, type] of [['translation', tr, 'VEC3'], ['rotation', ro, 'VEC4'], ['scale', sc, 'VEC3']]) {
    const smp = doc.createAnimationSampler().setInput(tin).setOutput(mk(arr, type)).setInterpolation('LINEAR');
    anim.addSampler(smp);
    anim.addChannel(doc.createAnimationChannel().setTargetNode(root).setTargetPath(path).setSampler(smp));
  }
}

const files = fs.readdirSync(src).filter((f) => f.endsWith('.glb') && (!only || only.some((o) => f.startsWith(o + '__'))));
let made = 0, added = 0, skipped = 0, failed = 0;
const report = [];
for (const f of files) {
  const out = path.join(dst, f);
  if (!force && fs.existsSync(out)) { skipped++; continue; }
  try {
    const doc = await io.read(path.join(src, f));
    const have = new Set(doc.getRoot().listAnimations().map((a) => a.getName()));
    const miss = STD.filter((n) => !have.has(n));
    if (!miss.length) { skipped++; continue; }
    const scene = doc.getRoot().listScenes()[0];
    const b = getBounds(scene);
    const root = doc.createNode('MotionRoot');
    for (const c of scene.listChildren()) { scene.removeChild(c); root.addChild(c); }
    scene.addChild(root);
    const clips = makeClips(b);
    const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2];
    const F = w > d ? [1, 0, 0] : [0, 0, 1], S = w > d ? [0, 0, 1] : [1, 0, 0];
    for (const n of miss) addClip(doc, root, n, clips[n], n === 'Idle' || n === 'Walk' || n === 'Run', F, S);
    await io.write(out, doc);
    made++; added += miss.length;
    report.push({ file: f, added: miss, bbox: [w, b.max[1] - b.min[1], d].map((v) => +v.toFixed(2)) });
  } catch (e) {
    failed++; console.error('실패', f, String(e.message || e).slice(0, 120));
  }
}
fs.writeFileSync(path.join(dst, '_report.json'), JSON.stringify(report, null, 1));
console.log(`CREATURE_FILL 몸 ${made} · 더한 클립 ${added} · 건너뜀 ${skipped} · 실패 ${failed}`);
