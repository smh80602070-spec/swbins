#!/usr/bin/env node
/**
 * LOD 생성 — K-0046 단계 2. 원본은 안 건드리고 `<id>_lod1.glb`(삼각형 ≈50%)·`<id>_lod2.glb`(≈20%) 를 만든다.
 * meshoptimizer simplify(가장자리 고정 lockBorder·오차 한도 error)를 쓰고 뼈대·가중치·재질·UV 는 그대로 둔다(화질을 낮추는 설정이 아니라 멀리서만 쓰는 낭비 제거).
 *
 *   node lod.mjs <입력 GLB 또는 폴더> <출력 폴더> [--ids a,b] [--l1 0.5] [--l2 0.2] [--err1 0.001] [--err2 0.004]
 * 화질 판정은 `tools/graphics-gate/diff.mjs`(화면 비교)로 따로 한다 — 이 도구는 삼각형 감소율만 보고한다.
 * 입력은 웹 압축 GLB(Meshopt·WebP) 그대로 읽고, 출력은 같은 확장으로 다시 쓴다(웹이 읽는다). 엔진용은 decode.mjs 로 푼 gltf 에 같은 도구를 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !['--ids', '--l1', '--l2', '--err1', '--err2'].includes(args[i - 1]));
if (pos.length < 2) { console.error('사용법: node lod.mjs <입력 GLB|폴더> <출력 폴더> [--ids a,b] [--l1 0.5] [--l2 0.2]'); process.exit(1); }
const src = path.resolve(pos[0]);
const dst = path.resolve(pos[1]);
const ids = opt('--ids', '') ? opt('--ids', '').split(',') : null;
const L1 = Number(opt('--l1', '0.5')), L2 = Number(opt('--l2', '0.2')), E1 = Number(opt('--err1', '0.001')), E2 = Number(opt('--err2', '0.004'));
fs.mkdirSync(dst, { recursive: true });

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function countTris(doc) {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); t += i ? i.getCount() / 3 : 0; }
  return Math.round(t);
}

const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter((f) => f.endsWith('.glb')).map((f) => path.join(src, f)) : [src];
const rows = [];
for (const f of files) {
  const id = path.basename(f, '.glb');
  if (ids && !ids.includes(id)) continue;
  const base = await io.read(f);
  const t0 = countTris(base);
  const row = { id, tris: t0 };
  for (const [tag, ratio, err] of [['lod1', L1, E1], ['lod2', L2, E2]]) {
    const doc = await io.read(f);
    await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: err, lockBorder: true }));
    await io.write(path.join(dst, `${id}_${tag}.glb`), doc);
    row[tag] = countTris(doc);
    row[tag + '_ratio'] = Math.round((row[tag] / t0) * 100) / 100;
    row[tag + '_kb'] = Math.round(fs.statSync(path.join(dst, `${id}_${tag}.glb`)).size / 1024);
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(dst, 'lod_report.json'), JSON.stringify({ note: 'K-0046 LOD 시험 — 삼각형 감소율(화질 판정은 graphics-gate 로 따로)', l1: L1, l2: L2, err1: E1, err2: E2, rows }, null, 1));
console.log('LOD', rows.length, '→', dst);
