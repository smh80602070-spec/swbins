#!/usr/bin/env node
/**
 * 사진측량(photoscan) GLB 줄이기 — UV 조각이 잘게 갈라진 모델용.
 *
 * 왜 따로 있나: 사진측량 모델은 UV 섬마다 정점이 갈라져 있어(정점 수가 삼각형의
 * 1.5~2배) meshoptimizer simplify 가 그 경계(seam)를 지키느라 거의 못 줄인다.
 * `gltf-transform simplify --error 0.01 --lock-border false` 로도 184만→120만이 바닥
 * (사가만리 chengde_temple.glb, 2026-09-23 실측).
 *
 * 어떻게: ① 같은 위치의 정점을 하나로 본 색인으로 simplify(경계가 사라진다)
 *         ② 남은 삼각형 꼭짓점마다, 그 위치에 있던 원래 정점들 중 세 꼭짓점의 UV
 *            둘레가 가장 짧아지는 조합을 골라 원래 정점을 다시 붙인다
 *            (UV 섬을 가로지르는 삼각형도 한 섬 안에 들도록 — 번짐 최소화)
 *         ③ 쓰지 않게 된 정점을 걷어낸다(compactPrimitive)
 * 새 정점을 만들지 않으니 UV·법선·색은 원래 값 그대로다. 재질·텍스처·노드·애니는 안 건드린다.
 * 압축(Meshopt·WebP)은 이 뒤에 compress.mjs 나 `cli.js meshopt` 로 따로 건다.
 *
 * 사용법: node seam-simplify.mjs <in.glb> <out.glb> [--ratio 0.08] [--error 0.01]
 *   --ratio  남길 삼각형 비율 목표(프리미티브마다)   --error  허용 오차(메시 반경 대비)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? parseFloat(args[i + 1]) : d; };
const [src, dst] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!src || !dst) { console.error('사용법: node seam-simplify.mjs <in.glb> <out.glb> [--ratio 0.08] [--error 0.01]'); process.exit(1); }
const RATIO = opt('--ratio', 0.08), ERROR = opt('--error', 0.01);

await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(src);

let before = 0, after = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== 4) continue;
    const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idxAcc = prim.getIndices();
    const n = pos.getCount();
    const idx = idxAcc ? Uint32Array.from(idxAcc.getArray()) : Uint32Array.from({ length: n }, (_, i) => i);
    const triCount = idx.length / 3;
    before += triCount;
    const target = Math.max(3, Math.floor(triCount * RATIO) * 3);
    if (triCount < 64) { after += triCount; continue; }

    // ① 위치가 같은 정점 → 대표 하나(canon)
    const p = [0, 0, 0], t = [0, 0];
    const P = new Float32Array(n * 3), UV = new Float32Array(n * 2);
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) {
      pos.getElement(i, p); P.set(p, i * 3);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      if (uv) { uv.getElement(i, t); UV.set(t, i * 2); }
    }
    const q = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1e-6 || 1e-9;
    const key = new Map(), canonOf = new Uint32Array(n), members = [];
    const canonPos = [];
    for (let i = 0; i < n; i++) {
      const k = Math.round(P[i * 3] / q) + ',' + Math.round(P[i * 3 + 1] / q) + ',' + Math.round(P[i * 3 + 2] / q);
      let c = key.get(k);
      if (c === undefined) { c = members.length; key.set(k, c); members.push([]); canonPos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
      canonOf[i] = c; members[c].push(i);
    }
    const cidx = idx.map((v) => canonOf[v]);
    // JS 판은 [색인, 도달 오차] 를 돌려준다(두 번째는 개수가 아니다)
    const [out] = MeshoptSimplifier.simplify(cidx, new Float32Array(canonPos), 3, target, ERROR, []);

    // ② 꼭짓점마다 원래 정점 다시 고르기 — UV 둘레 최소 조합
    const res = new Uint32Array(out.length);
    const d2 = (a, b) => { const x = UV[a * 2] - UV[b * 2], y = UV[a * 2 + 1] - UV[b * 2 + 1]; return x * x + y * y; };
    for (let f = 0; f < out.length; f += 3) {
      const A = members[out[f]], B = members[out[f + 1]], C = members[out[f + 2]];
      let best = Infinity, ba = A[0], bb = B[0], bc = C[0];
      if (uv && (A.length > 1 || B.length > 1 || C.length > 1)) {
        for (const a of A.slice(0, 8)) for (const b of B.slice(0, 8)) {
          const ab = d2(a, b); if (ab >= best) continue;
          for (const c of C.slice(0, 8)) {
            const s = ab + d2(b, c) + d2(c, a);
            if (s < best) { best = s; ba = a; bb = b; bc = c; }
          }
        }
      }
      res[f] = ba; res[f + 1] = bb; res[f + 2] = bc;
    }
    const acc = doc.createAccessor().setType('SCALAR').setArray(n > 65535 ? res : Uint16Array.from(res))
      .setBuffer(doc.getRoot().listBuffers()[0]);
    prim.setIndices(acc);
    compactPrimitive(prim);
    after += res.length / 3;
  }
}
await doc.transform(prune());
// 압축은 여기서 풀어 둔 채 쓴다(뒤 단계 meshopt/compress.mjs 가 다시 건다)
for (const e of doc.getRoot().listExtensionsUsed()) {
  if (e.extensionName === 'EXT_meshopt_compression' || e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
}
await io.write(dst, doc);
console.log(`삼각형 ${before.toLocaleString()} → ${after.toLocaleString()} (${(after / before * 100).toFixed(1)}%)`);
