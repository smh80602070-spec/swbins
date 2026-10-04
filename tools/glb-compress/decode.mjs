#!/usr/bin/env node
/**
 * 웹 압축 GLB → 엔진용 일반 GLB (Godot·Unity 공용) — K-0024 뒤 "웹 버전을 엔진에서도 쓴다"(사용자 10-04).
 *
 * (출력은 **.gltf + .bin + 공용 tex/**: 웹 GLB 가 가리키는 공용 텍스처를 몸마다 품지 않는다 — 품으면 몸 299 × ≈1.7MB 로 용량이 폭증한다. Godot·Unity 둘 다 .gltf 를 그대로 임포트한다.)
 * 웹 GLB 는 EXT_meshopt_compression + EXT_texture_webp + KHR_mesh_quantization 을 필수로 쓴다 — Godot 는 Meshopt 디코더가 없고
 * Unity(glTFast)도 WebP·Meshopt 디코더 패키지에 기대므로, 엔진용은 이 셋을 풀어 **확장 없는 일반 GLB** 로 만든다:
 *   ① Meshopt 디코드(읽을 때 자동)  ② 양자화 → float(dequantize)  ③ 텍스처 WebP → JPEG(불투명) / PNG(알파가 실제로 쓰인 것)
 * 뼈대·메시 조각·재질·크기는 그대로(모양을 안 건드린다). 원본(웹판)은 바꾸지 않는다.
 *
 * 사용법: node decode.mjs <웹 GLB 폴더> <출력 폴더> [--jpeg-q 90] [--force]
 *   출력 폴더에 <id>.gltf + <id>.bin + tex/<해시>.jpg|png(공용) + .license.json 복사(출처 그대로, `engine: true` 표시) 를 만든다. 이미 있으면 건너뜀(--force 로 다시).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const force = args.includes('--force');
const qi = args.indexOf('--jpeg-q');
const Q = qi >= 0 ? Number(args[qi + 1]) : 90;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--jpeg-q');
if (pos.length < 2) {
  console.error('사용법: node decode.mjs <웹 GLB 폴더> <출력 폴더> [--jpeg-q 90] [--force]');
  process.exit(1);
}
const [src, dst] = pos.map((p) => path.resolve(p));
fs.mkdirSync(dst, { recursive: true });

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

async function alphaUsed(buf) {
  const m = await sharp(buf).metadata();
  if (!m.hasAlpha) return false;
  const st = await sharp(buf).stats();
  const a = st.channels[st.channels.length - 1];
  return a.min < 250;                                  // 알파 채널에 실제로 투명한 픽셀이 있다
}

const files = fs.readdirSync(src).filter((f) => f.endsWith('.glb')).sort();
let done = 0, skipped = 0, bytesIn = 0, bytesOut = 0, failed = 0;
for (const f of files) {
  const out = path.join(dst, f.replace(/\.glb$/, '.gltf'));
  if (fs.existsSync(out) && !force) { skipped++; continue; }
  try {
    const doc = await io.read(path.join(src, f));
    await doc.transform(dequantize());
    for (const t of doc.getRoot().listTextures()) {
      const mt = t.getMimeType();
      if (mt === 'image/webp') {
        const img = Buffer.from(t.getImage());
        const png = await alphaUsed(img);
        const buf = png ? await sharp(img).png({ compressionLevel: 9 }).toBuffer() : await sharp(img).flatten({ background: '#ffffff' }).jpeg({ quality: Q, mozjpeg: true }).toBuffer();
        t.setImage(new Uint8Array(buf)).setMimeType(png ? 'image/png' : 'image/jpeg');
        const base = (t.getURI() || '').replace(/\.[a-z0-9]+$/i, '');
        t.setURI((base || 'tex/' + Math.random().toString(16).slice(2, 10)) + (png ? '.png' : '.jpg'));
      }
    }
    for (const ext of doc.getRoot().listExtensionsUsed()) {
      if (['EXT_texture_webp', 'EXT_meshopt_compression', 'KHR_mesh_quantization'].includes(ext.extensionName)) ext.dispose();
    }
    await io.write(out, doc);
    const lp = path.join(src, f.replace(/\.glb$/, '.license.json'));
    if (fs.existsSync(lp)) {
      const lic = JSON.parse(fs.readFileSync(lp, 'utf8'));
      lic.engine = true;
      lic.engine_note = '웹 압축본에서 Meshopt·양자화·WebP 를 풀어 만든 엔진용 일반 GLB (tools/glb-compress/decode.mjs)';
      fs.writeFileSync(path.join(dst, f.replace(/\.glb$/, '.license.json')), JSON.stringify(lic, null, 1));
    }
    bytesIn += fs.statSync(path.join(src, f)).size;
    bytesOut += fs.statSync(out).size;
    done++;
  } catch (e) {
    failed++;
    console.error('실패', f, String(e).slice(0, 160));
  }
}
console.log(`DECODE 처리 ${done} · 건너뜀 ${skipped} · 실패 ${failed} · ${(bytesIn / 1048576).toFixed(1)}MB → ${(bytesOut / 1048576).toFixed(1)}MB`);
process.exit(failed ? 1 : 0);
