#!/usr/bin/env node
/**
 * VRM(VRoid) GLB 다이어트 — 다섯 판이 같은 파일을 한 벌씩 갖는 `assets/models/people/anime/*.glb` 용.
 *
 * 왜: VRoid 가 내보낸 몸은 (1) 얼굴에 표정 모프 타깃 54~57개(파일의 절반 이상, 이 게임은 표정을 안 움직인다)
 * (2) 머리카락이 재질 1~4개인데 프리미티브가 73~118개 — 프리미티브가 곧 드로우콜이라 캐릭터 한 명이
 * 재질 수의 열 배쯤으로 그려진다(그림자·외곽선·SSAO 패스마다 또 곱해진다).
 *
 * 무엇을: ① 모프 타깃과 mesh.weights 를 뗀다 ② 한 메시 안에서 **같은 재질** 프리미티브를 하나로 합친다
 * (정점 버퍼는 원래 프리미티브끼리 공유라, 인덱스만 이어 붙인다 — 정점 복제 없음·모양 그대로).
 * 뼈·스킨·재질·텍스처·애니메이션은 한 글자도 안 건드린다. `extensions.VRM`(메타·휴머노이드)은 통째 다시 붙인다
 * (gltf-transform 이 모르는 확장이라 떨어뜨린다) — 단 blendShapeMaster 의 모프 결합은 가리킬 곳이 없어 비운다.
 *
 * 사용법: node vrm-slim.mjs <입력.glb> [출력.glb] [--keep-morph Fcl_MTH_A,Fcl_EYE_Close,…]   (출력 생략 시 입력을 덮어쓴다)
 * --keep-morph(K-0078): 이름 끝(`Fcl_…`)이 목록에 든 모프만 남기고 나머지만 뗀다 — 입·눈 깜박임용. 남은 모프 이름은
 *   `extras.targetNames` 에 `Fcl_MTH_A` 처럼 접두 없이 적는다(샘플마다 접두가 달라 엔진이 이름으로 찾기 어렵다).
 * 다섯 판 복사본은 md5 가 같아야 하니 **한 번만 돌려 나온 파일을 다섯 곳에 복사**한다.
 */
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const argv = process.argv.slice(2);
const ki = argv.indexOf('--keep-morph');
const KEEP = ki >= 0 ? new Set(argv.splice(ki, 2)[1].split(',').filter(Boolean)) : new Set();
const [inp, outArg] = argv;
if (!inp) { console.error('사용법: node vrm-slim.mjs <입력.glb> [출력.glb] [--keep-morph 이름,…]'); process.exit(1); }
const fclName = (n) => { const i = String(n).lastIndexOf('Fcl_'); return i >= 0 ? String(n).slice(i) : String(n); };
const out = outArg || inp;

function readJson(buf) {
  const jl = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jl).toString('utf8'));
}

const srcBuf = fs.readFileSync(inp);
const srcJson = readJson(srcBuf);
const vrmExt = srcJson.extensions && srcJson.extensions.VRM;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);   // unlit·texture_transform 을 알아야 재질이 안 바뀐다
const doc = await io.read(inp);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];

let primsBefore = 0, primsAfter = 0, targetsDropped = 0, targetsKept = 0;

for (const mesh of root.listMeshes()) {
  const prims = mesh.listPrimitives();
  primsBefore += prims.length;
  const extras = mesh.getExtras() || {};
  const names = Array.isArray(extras.targetNames) ? extras.targetNames : [];
  const keepIdx = names.map((n, i) => (KEEP.has(fclName(n)) ? i : -1)).filter((i) => i >= 0);
  for (const p of prims) {
    const ts = p.listTargets();
    ts.forEach((t, i) => { if (!keepIdx.includes(i)) { p.removeTarget(t); t.dispose(); targetsDropped++; } else { targetsKept++; } });
  }
  mesh.setWeights(keepIdx.map(() => 0));
  if (names.length) { mesh.setExtras(Object.assign({}, extras, { targetNames: keepIdx.map((i) => fclName(names[i])) })); }
  /* 재질(같은 mode) 별로 묶는다. 순서는 처음 나온 순서 그대로 */
  const groups = new Map();
  for (const p of prims) {
    const key = (p.getMaterial() ? root.listMaterials().indexOf(p.getMaterial()) : -1) + ':' + p.getMode();
    if (!groups.has(key)) { groups.set(key, []); }
    groups.get(key).push(p);
  }
  for (const list of groups.values()) {
    primsAfter++;
    if (list.length === 1) { continue; }
    const first = list[0];
    /* 같은 정점 버퍼를 공유하는지 확인 — 다르면 인덱스만 이어 붙일 수 없다 */
    const posAcc = first.getAttribute('POSITION');
    for (const p of list) {
      if (p.getAttribute('POSITION') !== posAcc) { throw new Error(mesh.getName() + ': 정점 버퍼가 프리미티브마다 다르다 — 이 도구로는 못 합친다'); }
      if (!p.getIndices()) { throw new Error(mesh.getName() + ': 인덱스 없는 프리미티브'); }
    }
    let total = 0;
    for (const p of list) { total += p.getIndices().getCount(); }
    const merged = new Uint32Array(total);
    let o = 0;
    for (const p of list) { const a = p.getIndices().getArray(); merged.set(a, o); o += a.length; }
    const useU16 = posAcc.getCount() < 65536;
    const idxAcc = doc.createAccessor().setType('SCALAR').setBuffer(buffer)
      .setArray(useU16 ? new Uint16Array(merged) : merged);
    first.setIndices(idxAcc);
    for (const p of list.slice(1)) { mesh.removePrimitive(p); p.dispose(); }
  }
}

/* 안 쓰이게 된 모프 접근자·옛 인덱스를 치운다 */
for (const acc of root.listAccessors()) {
  if (acc.listParents().filter((x) => x.propertyType !== 'Root').length === 0) { acc.dispose(); }
}

const glb = await io.writeBinary(doc);

/* extensions.VRM 다시 붙이기 — JSON 청크만 갈아 끼운다 */
let final = Buffer.from(glb);
if (vrmExt) {
  const j = readJson(final);
  const bmg = vrmExt.blendShapeMaster && vrmExt.blendShapeMaster.blendShapeGroups;
  if (bmg) { for (const g of bmg) { g.binds = []; } }
  j.extensions = Object.assign({}, j.extensions, { VRM: vrmExt });
  j.extensionsUsed = Array.from(new Set([].concat(j.extensionsUsed || [], ['VRM'])));
  let js = Buffer.from(JSON.stringify(j), 'utf8');
  const pad = (4 - (js.length % 4)) % 4;
  js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const oldJl = final.readUInt32LE(12);
  const rest = final.slice(20 + oldJl);               // BIN 청크(머리 포함)
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + js.length + rest.length, 8);
  head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
  final = Buffer.concat([head, js, rest]);
}

fs.writeFileSync(out, final);
console.log(`${inp.split(/[\\/]/).pop()}  ${(srcBuf.length / 1e6).toFixed(2)}MB → ${(final.length / 1e6).toFixed(2)}MB` +
  `  프리미티브 ${primsBefore} → ${primsAfter}  모프 타깃 ${targetsDropped}개 뗌` + (KEEP.size ? ` · ${targetsKept}개 남김` : ''));
