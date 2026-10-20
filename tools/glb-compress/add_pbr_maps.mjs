/**
 * K-0152 — 환경 GLB 에 자체 사실 재질 맵(법선·거칠기)을 더한다. 색 그림·형태·UV·이름은 그대로, 맵만 더한다(멱등 — 이미 있으면 건너뜀).
 *
 * 사용법: node tools/glb-compress/add_pbr_maps.mjs --ids a,b,c [--sets web,toon] [--size 512] [--dry] [--fix-webp]
 *   맵 형식: web = WebP(EXT_texture_webp) · toon = JPEG q90(유니티 glTFast 가 WebP 를 못 읽는다 — K-0153 · PNG 는 30개 +12MB 라 원래 색 그림과 같은 JPEG, 고돗도 같은 파일)
 *   --fix-webp: toon 에 이미 들어간 WebP 그림을 JPEG 로 바꾸고 EXT_texture_webp 를 뗀다(K-0152 1차 30개 고침)
 *   대상 = saga-assets/world/<set>/<id>.glb (제자리 갈아 끼움 — 정본 · 배치는 place.py)
 *
 * 맵 식(tools/ai-art/pbr_from_albedo.py 와 같은 결 — 남의 텍스처 0, 그 재질 색 그림에서 계산):
 *   높이   = 밝기 − 흐린 밝기(반경 = 짧은 변/24) → 0~1
 *   법선   = 높이 기울기(감싸 읽어 이음매 유지) × strength, OpenGL Y+(glTF 와 같음)
 *   거칠기 = 0.62 + 0.30·(1 − 밝기) − 0.12·채도 + 0.15·|높이 고역| → 0.45~0.95 (G 채널) · 금속(B) = 0
 * 단색 재질 = 맵 없이 roughnessFactor 0.8 · metallicFactor 0(glTF 기본 금속 1 이 PBR 트랙에서 쇠처럼 보이는 것 바로잡기, 이름에 metal·iron·steel·gold 면 그대로)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const ids = (arg('--ids', '') || '').split(',').filter(Boolean);
const sets = arg('--sets', 'web,toon').split(',');
const SIZE = +arg('--size', 512);
const dry = process.argv.includes('--dry');
const STRENGTH = 2.2;
const fixWebp = process.argv.includes('--fix-webp');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

async function maps(bytes, fmt) {
  const img = sharp(bytes).ensureAlpha();
  const meta = await img.metadata();
  const sc = Math.min(1, SIZE / Math.max(meta.width, meta.height));
  const w = Math.max(4, Math.round(meta.width * sc)), h = Math.max(4, Math.round(meta.height * sc));
  const rgba = await img.resize(w, h).raw().toBuffer();
  const L = new Float32Array(w * h), S = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    S[i] = mx > 1e-4 ? (mx - mn) / mx : 0;
  }
  const rad = Math.max(1, Math.round(Math.min(w, h) / 24));
  const blur = await sharp(Buffer.from(L.map((v) => v * 255)), { raw: { width: w, height: h, channels: 1 } }).blur(rad / 2 + 0.3).raw().toBuffer();
  const H = new Float32Array(w * h);
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < w * h; i++) { H[i] = L[i] - blur[i] / 255; lo = Math.min(lo, H[i]); hi = Math.max(hi, H[i]); }
  const span = Math.max(1e-4, hi - lo);
  const nrm = Buffer.alloc(w * h * 3), mr = Buffer.alloc(w * h * 3);
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = (at(x + 1, y) - at(x - 1, y)) / span * STRENGTH, dy = (at(x, y + 1) - at(x, y - 1)) / span * STRENGTH;
      let nx = -dx, ny = dy, nz = 1;                                     // OpenGL Y+ (그림 y 는 아래로 → 부호 뒤집음)
      const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
      nrm[i * 3] = Math.round((nx * 0.5 + 0.5) * 255); nrm[i * 3 + 1] = Math.round((ny * 0.5 + 0.5) * 255); nrm[i * 3 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      const rough = Math.min(0.95, Math.max(0.45, 0.62 + 0.30 * (1 - L[i]) - 0.12 * S[i] + 0.15 * Math.abs((H[i] - lo) / span - 0.5)));
      mr[i * 3] = 255; mr[i * 3 + 1] = Math.round(rough * 255); mr[i * 3 + 2] = 0;
    }
  }
  const enc = (buf) => { const im = sharp(buf, { raw: { width: w, height: h, channels: 3 } }); return (fmt === 'jpeg' ? im.jpeg({ quality: 90, chromaSubsampling: '4:4:4' }) : im.webp({ quality: 85 })).toBuffer(); };
  return { nrm: await enc(nrm), mr: await enc(mr), w, h };
}

const METAL = /metal|iron|steel|gold|bronze|copper/i;
let files = 0, mats = 0, added = 0, before = 0, after = 0;
for (const set of sets) {
  for (const id of ids) {
    const f = path.join(ROOT, 'saga-assets', 'world', set, id + '.glb');
    if (!fs.existsSync(f)) { continue; }
    const doc = await io.read(f);
    const root = doc.getRoot();
    const fmt = set === 'web' ? 'webp' : 'jpeg';
    const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';
    let changed = false;
    if (fmt === 'webp' && !root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_texture_webp')) { doc.createExtension(EXTTextureWebP).setRequired(true); }
    if (fmt === 'jpeg' && fixWebp) {                                    // K-0153: WebP 그림 → JPEG, 확장 떼기
      for (const t of root.listTextures()) {
        if (t.getMimeType() === 'image/webp') { t.setImage(await sharp(Buffer.from(t.getImage())).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer()).setMimeType('image/jpeg'); t.setURI(t.getURI().replace(/\.webp$/, '.jpg')); changed = true; }
      }
      for (const e of root.listExtensionsUsed()) { if (e.extensionName === 'EXT_texture_webp' && !root.listTextures().some((t) => t.getMimeType() === 'image/webp')) { e.dispose(); changed = true; } }
    }
    const cache = new Map();
    for (const m of root.listMaterials()) {
      mats++;
      if (m.getNormalTexture()) { continue; }                          // 멱등
      const base = m.getBaseColorTexture();
      if (!base) {
        if (!METAL.test(m.getName())) { m.setMetallicFactor(0); m.setRoughnessFactor(0.8); changed = true; }
        continue;
      }
      let mp = cache.get(base);
      if (!mp) {
        mp = await maps(Buffer.from(base.getImage()), fmt);
        const nt = doc.createTexture(base.getName() + '_n').setImage(mp.nrm).setMimeType(mime);
        const rt = doc.createTexture(base.getName() + '_r').setImage(mp.mr).setMimeType(mime);
        mp = { ...mp, nt, rt };
        cache.set(base, mp);
      }
      const ti = m.getBaseColorTextureInfo();
      m.setNormalTexture(mp.nt).setNormalScale(1);
      m.getNormalTextureInfo().setTexCoord(ti.getTexCoord());
      m.setMetallicRoughnessTexture(mp.rt);
      m.getMetallicRoughnessTextureInfo().setTexCoord(ti.getTexCoord());
      m.setRoughnessFactor(1);
      if (!METAL.test(m.getName())) { m.setMetallicFactor(0); }
      added++;
      changed = true;
    }
    files++;
    const b0 = fs.statSync(f).size;
    before += b0;
    if (changed && !dry) {
      fs.writeFileSync(f, await io.writeBinary(doc));                  // 바이너리 그대로(경로로 쓰면 확장자 따라 .gltf + 떨어진 그림이 된다 — 10-20 함정)
    }
    after += fs.statSync(f).size;
  }
}
console.log(`PBR_MAPS 파일 ${files} · 재질 ${mats} · 맵 더함 ${added} · 크기 ${(before / 1048576).toFixed(2)}MB → ${(after / 1048576).toFixed(2)}MB${dry ? ' (dry)' : ''}`);
