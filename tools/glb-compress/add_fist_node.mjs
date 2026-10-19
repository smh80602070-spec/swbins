#!/usr/bin/env node
/**
 * K-0122 — 뼈 없는 사람꼴 몸(creature_fill 루트 동작)에 오른손 자리 노드 `FistR` 를 더한다(무장이 무기를 쥐는 자리).
 *
 *   node tools/glb-compress/add_fist_node.mjs <폴더> --ids a,b,c [--band 0.30,0.62]
 *
 * 몸은 +Z(glTF) 를 보므로 오른손은 -X 쪽이다(saga-realm asset3d.js assembleTrooper 와 같은 약속).
 * 어림: 키(밑 0) 의 band 구간(기본 30~62%) 안 점 중 X 가 가장 작은 쪽 2% 의 평균 → 그 자리.
 * 노드는 `MotionRoot`(creature_fill 이 만든 움직이는 노드) 밑에 둬 몸과 함께 움직인다. 뼈(joint)가 아니라 그냥 노드라
 * 웹 boneOf(isBone 만) 는 못 찾는다 — 웹은 이름으로 Object3D 를 찾게 고칠 것(수신함 줄). 이미 있으면 자리만 다시 쓴다.
 * 출력 끝 줄 FIST_OK n.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const a = process.argv.slice(2);
const dir = a[0];
const opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const ids = (opt('--ids', '') || '').split(',').filter(Boolean);
const [b0, b1] = opt('--band', '0.30,0.62').split(',').map(Number);
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function mul(m, p) { // 열 우선 4x4 × 점
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
function inv(m) { // 아핀 4x4 역행렬(열 우선)
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20);
  const i = [(a11 * a22 - a12 * a21) / det, (a02 * a21 - a01 * a22) / det, (a01 * a12 - a02 * a11) / det,
    (a12 * a20 - a10 * a22) / det, (a00 * a22 - a02 * a20) / det, (a02 * a10 - a00 * a12) / det,
    (a10 * a21 - a11 * a20) / det, (a01 * a20 - a00 * a21) / det, (a00 * a11 - a01 * a10) / det];
  const t = [m[12], m[13], m[14]];
  const r = [-(i[0] * t[0] + i[1] * t[1] + i[2] * t[2]), -(i[3] * t[0] + i[4] * t[1] + i[5] * t[2]), -(i[6] * t[0] + i[7] * t[1] + i[8] * t[2])];
  return [i[0], i[3], i[6], 0, i[1], i[4], i[7], 0, i[2], i[5], i[8], 0, r[0], r[1], r[2], 1];
}

let n = 0;
for (const id of ids) {
  const f = path.join(dir, id + '.glb');
  if (!fs.existsSync(f)) { console.log('없음', id); continue; }
  const doc = await io.read(f);
  const root = doc.getRoot();
  const motion = root.listNodes().find((x) => x.getName() === 'MotionRoot');
  if (!motion) { console.log('MotionRoot 없음 — creature_fill 먼저', id); continue; }
  const pts = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const v = [0, 0, 0];
      for (let k = 0; k < pos.getCount(); k++) { pos.getElement(k, v); pts.push(mul(w, v)); }
    }
  }
  let ymin = Infinity, ymax = -Infinity;
  for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
  const h = ymax - ymin;
  const band = pts.filter((p) => p[1] >= ymin + b0 * h && p[1] <= ymin + b1 * h).sort((p, q) => p[0] - q[0]);
  const take = band.slice(0, Math.max(8, Math.round(band.length * 0.02)));
  const c = [0, 1, 2].map((k) => take.reduce((s, p) => s + p[k], 0) / take.length);
  const local = mul(inv(motion.getWorldMatrix()), c);
  let fist = motion.listChildren().find((x) => x.getName() === 'FistR');
  if (!fist) { fist = doc.createNode('FistR'); motion.addChild(fist); }
  fist.setTranslation(local);
  await io.write(f, doc);
  console.log('FIST', id, 'world', c.map((v) => v.toFixed(2)).join(','), 'h', h.toFixed(2), 'x/h', (c[0] / h).toFixed(2), 'y/h', ((c[1] - ymin) / h).toFixed(2));
  n++;
}
console.log('FIST_OK', n);
