/**
 * K-0190 — 유니티 자연물 사실판: 고돗 K-0127·K-0104 사실판 gltf(공용 아틀라스·결 그림을 밖에 둔 꼴)를 유니티가 받는 GLB 한 덩이로 묶는다.
 * 그림은 안에 넣되 긴 변 1024 로 줄인다(PNG 는 PNG — 잎 카드 알파 컷아웃, JPEG 는 JPEG · 유니티 glTFast 는 WebP 를 못 읽는다, K-0153).
 *
 *   node tools/glb-compress/k190_unity_nature.mjs [--out <폴더>] [--dry]
 *     짝 = PAIRS(유니티 id → 사실판 gltf) · 산출 <out>/<유니티 id>_real.glb + .license.json(원본 license + 묶은 법)
 *     기본 out = saga-unity/Assets/SagaCore/Resources/World · 표(높이 옛→새·비·삼각형 옛→새·KB)를 찍는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FOL = path.join(ROOT, 'saga-godot', 'assets', 'world', 'foliage');
const UNITY = path.join(ROOT, 'saga-unity', 'Assets', 'SagaCore', 'Resources', 'World');
const K190 = path.join(ROOT, 'tools', 'world-forge', '_out', 'k190');
const PAIRS = {
  tree_broadleaf_01: path.join(FOL, 'tree_broadleaf_01_real.gltf'),
  tree_broadleaf_02: path.join(FOL, 'tree_broadleaf_02_real.gltf'),
  tree_broadleaf_03: path.join(FOL, 'tree_broadleaf_03_real.gltf'),
  tree_pine_01: path.join(FOL, 'tree_pine_01_real.gltf'),
  tree_pine_02: path.join(FOL, 'tree_pine_02_real.gltf'),
  tree_pine_03: path.join(FOL, 'tree_pine_03_real.gltf'),
  tree_birch_01: path.join(FOL, 'tree_birch_01_real.gltf'),
  rock_large_01: path.join(FOL, 'rock_large_01_real.gltf'),
  rock_large_02: path.join(FOL, 'rock_large_02_real.gltf'),
  rock_moss_01: path.join(FOL, 'rock_moss_01_real.gltf'),
  grass_tuft_01: path.join(FOL, 'grass_clump_01.gltf'),          // 고돗 K-0127 짝과 같음(K-0104 들풀)
  grass_tuft_02: path.join(FOL, 'grass_clump_02.gltf'),
  reed_clump_01: path.join(K190, 'reed_clump_01_real.gltf'),     // K-0190 새 레시피(build_foliage.py reed_clump_01_real)
};

const a = process.argv.slice(2);
const OUT = a.includes('--out') ? path.resolve(a[a.indexOf('--out') + 1]) : UNITY;
const DRY = a.includes('--dry');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function tris(doc) {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return Math.round(t);
}
const height = (doc) => { const b = getBounds(doc.getRoot().listScenes()[0]); return b.max[1] - b.min[1]; };

const rows = [];
for (const [id, src] of Object.entries(PAIRS)) {
  if (!fs.existsSync(src)) { console.log('NOSRC', id, src); continue; }
  const doc = await io.read(src);
  // 잎 아틀라스 바탕색(알파 컷아웃)만 PNG 1024, 나머지(나무껍질·바위 바탕색·법선·거칠기)는 JPEG 1024 q85 — 유니티 Resources 용량(처음 PNG 그대로 13개 78MB)
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', quality: 85, resize: [1024, 1024], slots: /^(?!baseColor)/ }),
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', quality: 85, resize: [1024, 1024], slots: /baseColor/, pattern: /^(?!.*atlas).*$/i }),
    textureCompress({ encoder: sharp, resize: [1024, 1024], slots: /baseColor/, pattern: /atlas/i }));
  const oldP = path.join(UNITY, id + '.glb');
  const old = fs.existsSync(oldP) ? await io.read(oldP) : null;
  let hNew = height(doc), fit = 1;
  const hOld = old ? height(old) : NaN;
  if (old && (hNew / hOld < 0.93 || hNew / hOld > 1.06)) {            // K-0127 기준 0.93~1.06 밖이면 옛 높이에 맞춰 균등 배율(유니티 배치 수치 그대로 쓰게)
    fit = hOld / hNew;
    for (const n of doc.getRoot().listScenes()[0].listChildren()) n.setScale(n.getScale().map((v) => v * fit));
    hNew = height(doc);
  }
  const out = path.join(OUT, id + '_real.glb');
  let kb = 0;
  if (!DRY) {
    fs.mkdirSync(OUT, { recursive: true });
    await io.write(out, doc);
    kb = Math.round(fs.statSync(out).size / 1024);
    const licSrc = src.replace(/\.gltf$/, '.license.json');
    const lic = fs.existsSync(licSrc) ? JSON.parse(fs.readFileSync(licSrc, 'utf8')) : {};
    lic.id = id + '_real';
    lic.ticket = 'K-0190';
    lic.packed = 'tools/glb-compress/k190_unity_nature.mjs — 고돗 사실판 gltf → GLB 한 덩이, 그림 긴 변 1024(형식 그대로)';
    lic.source_gltf = path.relative(ROOT, src).replace(/\\/g, '/');
    if (fit !== 1) lic.fit_scale = +fit.toFixed(3);
    fs.writeFileSync(out.replace(/\.glb$/, '.license.json'), JSON.stringify(lic, null, 1));
  }
  rows.push({ id, h_old: +hOld.toFixed(2), h_new: +hNew.toFixed(2), ratio: +(hNew / hOld).toFixed(2), fit: +fit.toFixed(2), tris_old: old ? tris(old) : null, tris_new: tris(doc), kb });
}
console.table(rows);
console.log('K190', JSON.stringify(rows));
