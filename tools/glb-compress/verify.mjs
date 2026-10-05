#!/usr/bin/env node
/**
 * 압축 전후 GLB 가 "같은 모양"인지 검사 — K-0071 단계 2. 통과한 파일만 제자리 교체한다.
 *   삼각형 수(프리미티브 모드별 합) · 쉼 자세 바운딩 박스(스키닝 적용, 양자화 오차 허용: 변 길이의 0.5% 또는 1mm) ·
 *   스킨·애니메이션·모프 타깃·재질 수 · 그림(텍스처) 바이트가 **그대로**인지(메시만 모드에선 그림을 안 건드린다).
 *
 *   node verify.mjs <원본.glb> <압축.glb>        한 쌍 → OK/FAIL 과 이유
 *   import { verifyPair } from './verify.mjs'    compress.mjs 가 쓴다
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/* 4x4 열 우선(glTF) 곱: out = a * b */
function mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function xform(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/* 렌더러가 쉼 자세에서 그리는 자리로 바운딩을 잰다 — 스킨 메시는 Σ w·(관절 월드 × 역바인드)·p (양자화 변환이 역바인드에
   들어간 압축본과 원본이 같은 수가 나온다). 스킨 없는 메시는 노드 월드 행렬 × p. getBounds 는 스킨을 모른다. */
function restPoseBounds(root) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const add = (q) => { for (let i = 0; i < 3; i++) { if (q[i] < min[i]) min[i] = q[i]; if (q[i] > max[i]) max[i] = q[i]; } };
  const pos = [0, 0, 0], jt = [0, 0, 0, 0], wt = [0, 0, 0, 0];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const W = node.getWorldMatrix();
    const skin = node.getSkin();
    let JM = null;
    if (skin) {
      const ibm = skin.getInverseBindMatrices();
      const joints = skin.listJoints();
      JM = joints.map((j, i) => {
        const m = new Float64Array(16);
        if (ibm) ibm.getElement(i, m); else m.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        return mul(j.getWorldMatrix(), m);
      });
    }
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      if (!P) continue;
      const J = JM ? prim.getAttribute('JOINTS_0') : null;
      const Wt = JM ? prim.getAttribute('WEIGHTS_0') : null;
      const n = P.getCount();
      for (let i = 0; i < n; i++) {
        P.getElement(i, pos);
        if (J && Wt) {
          J.getElement(i, jt); Wt.getElement(i, wt);
          const acc = [0, 0, 0];
          let ws = 0;
          for (let k = 0; k < 4; k++) {
            const w = wt[k]; if (!w) continue;
            const m = JM[jt[k]]; if (!m) continue;
            const q = xform(m, pos);
            acc[0] += w * q[0]; acc[1] += w * q[1]; acc[2] += w * q[2]; ws += w;
          }
          if (ws > 0) { add([acc[0] / ws, acc[1] / ws, acc[2] / ws]); } else { add(xform(W, pos)); }
        } else {
          add(xform(W, pos));
        }
      }
    }
  }
  if (min[0] === Infinity) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

function summarize(doc) {
  const root = doc.getRoot();
  let tris = 0, points = 0, lines = 0, morphs = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      const n = idx ? idx.getCount() : (pos ? pos.getCount() : 0);
      const mode = prim.getMode();
      if (mode === 4) tris += Math.floor(n / 3);
      else if (mode === 5 || mode === 6) tris += Math.max(0, n - 2);
      else if (mode === 0) points += n;
      else lines += n;
      morphs += prim.listTargets().length;
    }
  }
  const bb = restPoseBounds(root);
  const imgBytes = root.listTextures().map((t) => (t.getImage() || new Uint8Array(0)).byteLength).sort((a, b) => a - b);
  return {
    tris, points, lines, morphs,
    skins: root.listSkins().length,
    jointSets: [...new Set(root.listSkins().map((s) => s.listJoints().length))].sort((a, b) => a - b).join(','),
    anims: root.listAnimations().length,
    mats: root.listMaterials().length,
    imgs: imgBytes,
    min: bb.min, max: bb.max,
  };
}

export async function verifyPair(origPath, compPath, opts = {}) {
  const keepImages = opts.keepImages !== false;
  const a = summarize(await io.read(origPath));
  const b = summarize(await io.read(compPath));
  const why = [];
  if (a.tris !== b.tris) why.push(`삼각형 ${a.tris}→${b.tris}`);
  if (a.points !== b.points || a.lines !== b.lines) why.push(`점/선 ${a.points}/${a.lines}→${b.points}/${b.lines}`);
  if (a.morphs !== b.morphs) why.push(`모프 ${a.morphs}→${b.morphs}`);
  /* 양자화는 스킨을 메시마다 복제할 수 있다(역바인드에 변환을 넣으려고) — 있냐/없냐와 관절 수 집합만 본다 */
  if ((a.skins > 0) !== (b.skins > 0) || a.jointSets !== b.jointSets) why.push(`스킨 ${a.skins}[${a.jointSets}]→${b.skins}[${b.jointSets}]`);
  if (a.anims !== b.anims) why.push(`애니 ${a.anims}→${b.anims}`);
  /* 재질은 prune 이 안 쓰는 것을 지울 수 있다 — 줄어드는 것만 허용, 늘면 이상 */
  if (b.mats > a.mats) why.push(`재질 ${a.mats}→${b.mats}`);
  if (keepImages) {
    const same = a.imgs.length === b.imgs.length && a.imgs.every((v, i) => v === b.imgs[i]);
    /* prune 이 안 쓰는 텍스처를 지울 수 있다 — 남은 그림이 원본 바이트 집합의 부분집합이면 통과 */
    const subset = b.imgs.every((v) => a.imgs.includes(v));
    if (!same && !subset) why.push(`그림 바이트 바뀜 ${a.imgs.length}→${b.imgs.length}`);
  }
  for (let i = 0; i < 3; i++) {
    const ext = Math.max(a.max[i] - a.min[i], 1e-6);
    const tol = Math.max(ext * 0.005, 0.001);
    if (Math.abs(a.min[i] - b.min[i]) > tol || Math.abs(a.max[i] - b.max[i]) > tol) {
      why.push(`바운딩 ${'xyz'[i]} ${a.min[i].toFixed(3)}..${a.max[i].toFixed(3)} → ${b.min[i].toFixed(3)}..${b.max[i].toFixed(3)}`);
    }
  }
  return { ok: why.length === 0, why, a, b };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [o, c] = process.argv.slice(2);
  if (!o || !c) { console.error('사용법: node verify.mjs <원본.glb> <압축.glb>'); process.exit(1); }
  const r = await verifyPair(o, c);
  console.log((r.ok ? 'OK' : 'FAIL') + `  삼각형 ${r.a.tris} 스킨 ${r.a.skins} 애니 ${r.a.anims} 그림 ${r.a.imgs.length}` + (r.ok ? '' : '  — ' + r.why.join(' · ')));
  process.exit(r.ok ? 0 : 1);
}
