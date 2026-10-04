#!/usr/bin/env node
/**
 * 에셋 측정 — K-0046 단계 1 "예산표는 측정으로 채운다(추측 금지)". 웹 압축 GLB 를 읽어 모델마다
 *   삼각형 수 · 드로콜(프리미티브 수) · 텍스처 장수 · 텍스처 GPU 메모리 추정(가로×세로×4B × 1.33 밉맵, 한 모델이 쓰는 고유 텍스처 합) · 뼈 수
 * 를 재고, 묶음(인물·세계 소품 …)별 분포(최소·중앙값·p95·최대)를 `tools/glb-compress/data/budget_measured.json` 에 쓴다.
 *
 *   node measure.mjs [--out data/budget_measured.json]
 * 대상: saga-web/shared/assets/characters3d(299) · world3d(세계 소품·건물·무기·장비·실내). 읽기만 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0 ? path.resolve(process.argv[outArg + 1]) : path.join(HERE, 'data', 'budget_measured.json');

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const texCache = new Map();
async function texInfo(t) {
  const key = t.getURI() || t.getName();
  if (texCache.has(key)) return texCache.get(key);
  const img = t.getImage();
  let w = 0, h = 0;
  if (img) { const m = await sharp(Buffer.from(img)).metadata(); w = m.width || 0; h = m.height || 0; }
  const v = { w, h, mb: (w * h * 4 * 1.33) / 1048576 };
  texCache.set(key, v);
  return v;
}

async function measure(file) {
  const doc = await io.read(file);
  let tris = 0, prims = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      prims++;
      const idx = p.getIndices();
      const pos = p.getAttribute('POSITION');
      tris += idx ? idx.getCount() / 3 : (pos ? pos.getCount() / 3 : 0);
    }
  }
  const texs = new Set();
  let texMb = 0;
  for (const mat of doc.getRoot().listMaterials()) {
    for (const t of [mat.getBaseColorTexture(), mat.getNormalTexture(), mat.getEmissiveTexture(), mat.getOcclusionTexture(), mat.getMetallicRoughnessTexture()]) {
      if (t && !texs.has(t)) { texs.add(t); texMb += (await texInfo(t)).mb; }
    }
  }
  const joints = Math.max(0, ...doc.getRoot().listSkins().map((s) => s.listJoints().length));
  return { tris: Math.round(tris), prims, textures: texs.size, tex_mb: Math.round(texMb * 10) / 10, joints };
}

function dist(vals) {
  const a = [...vals].sort((x, y) => x - y);
  const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  return { min: a[0], median: q(0.5), p95: q(0.95), max: a[a.length - 1] };
}

const GROUPS = {
  characters: path.join(ROOT, 'saga-web', 'shared', 'assets', 'characters3d'),
  world: path.join(ROOT, 'saga-web', 'shared', 'assets', 'world3d'),
};
const result = { note: 'K-0046 단계 1 — 웹 압축 GLB 실측. tex_mb = 고유 텍스처 GPU 메모리 추정(가로×세로×4B×1.33). 트랙·기기 등급별 목표는 이 분포를 보고 정한다.', measured_at: new Date().toISOString().slice(0, 10), groups: {} };
for (const [name, dir] of Object.entries(GROUPS)) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).sort();
  const rows = {};
  for (const f of files) {
    try { rows[f.replace('.glb', '')] = await measure(path.join(dir, f)); } catch (e) { rows[f] = { error: String(e).slice(0, 80) }; }
  }
  const ok = Object.values(rows).filter((r) => !r.error);
  result.groups[name] = {
    count: ok.length,
    errors: Object.keys(rows).length - ok.length,
    tris: dist(ok.map((r) => r.tris)),
    prims: dist(ok.map((r) => r.prims)),
    tex_mb: dist(ok.map((r) => r.tex_mb)),
    textures: dist(ok.map((r) => r.textures)),
    joints: dist(ok.map((r) => r.joints)),
    heaviest_tris: Object.entries(rows).filter(([, r]) => !r.error).sort((a, b) => b[1].tris - a[1].tris).slice(0, 5).map(([k, r]) => ({ id: k, tris: r.tris })),
  };
  result.groups[name].per_model = rows;
  console.log(name, JSON.stringify({ count: ok.length, tris: result.groups[name].tris, prims: result.groups[name].prims, tex_mb: result.groups[name].tex_mb }));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log('MEASURE →', OUT);
