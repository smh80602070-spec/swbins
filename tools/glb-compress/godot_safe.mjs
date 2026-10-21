/**
 * K-0166 — 고돗 4.7 GLTFDocument 가 못 읽는 필수 확장(KHR_mesh_quantization · EXT_meshopt_compression · EXT_texture_webp)을
 * 모두 푼 "고돗 엔진판" 사본을 만든다. unity_safe.mjs(K-0153, 양자화는 둠)와 같은 길에 양자화 풀기(dequantize)만 더.
 * 웹 압축 정본은 그대로, 고돗 place 항목이 이 출력 폴더를 읽는다.
 *
 * 사용법: node tools/glb-compress/godot_safe.mjs <입력 폴더> <출력 폴더> [--ids a,b] [--prefix pet_pk_,pet_pt_magpie]
 *   (입력 폴더의 *.glb + 같은 이름 .license.json)
 *   WebP 그림 → JPEG q90(4:4:4), 알파를 실제로 쓰면 PNG · Meshopt 풀기 · 양자화 풀기(float32) · sparse 접근자 빽빽하게
 *   출력 GLB 의 extensionsRequired 가 비지 않으면 GODOT_SAFE_FAIL
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [inDir, outDir] = pos;
const only = opt('--ids') ? new Set(opt('--ids').split(',')) : null;
const prefixes = opt('--prefix') ? opt('--prefix').split(',') : null;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(outDir, { recursive: true });
const DROP = ['EXT_meshopt_compression', 'EXT_texture_webp', 'KHR_mesh_quantization'];
let n = 0, bad = 0, b0 = 0, b1 = 0, png = 0;
for (const f of fs.readdirSync(inDir).filter((x) => x.endsWith('.glb')).sort()) {
  const id = f.slice(0, -4);
  if (only && !only.has(id)) { continue; }
  if (prefixes && !prefixes.some((p) => id.startsWith(p))) { continue; }
  const doc = await io.read(path.join(inDir, f));
  const root = doc.getRoot();
  for (const t of root.listTextures()) {
    if (t.getMimeType() !== 'image/webp') { continue; }
    const src = Buffer.from(t.getImage());
    const opaque = (await sharp(src).stats()).isOpaque;
    if (opaque) {
      t.setImage(await sharp(src).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer()).setMimeType('image/jpeg');
      t.setURI((t.getURI() || '').replace(/\.webp$/, '.jpg'));
    } else {
      t.setImage(await sharp(src).png({ compressionLevel: 9 }).toBuffer()).setMimeType('image/png');
      t.setURI((t.getURI() || '').replace(/\.webp$/, '.png'));
      png++;
    }
  }
  await doc.transform(dequantize());
  // 성긴(sparse) 접근자는 고돗 4.7.2 가 "Sparse indices buffer view size did not exactly match" 로 거른다
  // (gltf-transform 이 버퍼 뷰를 4바이트로 채워서) → 모두 빽빽하게 쓴다(값 같음).
  for (const a of root.listAccessors()) { a.setSparse(false); }
  for (const e of root.listExtensionsUsed()) {
    if (DROP.includes(e.extensionName)) { e.dispose(); }
  }
  const out = path.join(outDir, f);
  fs.writeFileSync(out, await io.writeBinary(doc));
  const lic = path.join(inDir, id + '.license.json');
  if (fs.existsSync(lic)) {
    const L = JSON.parse(fs.readFileSync(lic, 'utf8'));
    L.godot_safe = 'K-0166 tools/glb-compress/godot_safe.mjs — 고돗 4.7 용(WebP→JPEG/PNG · Meshopt·양자화 풂), 모양·그림 같음';
    fs.writeFileSync(path.join(outDir, id + '.license.json'), JSON.stringify(L, null, 1));
  }
  const b = fs.readFileSync(out), L = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + L));
  const req = j.extensionsRequired || [];
  if (req.length) { bad++; console.log('남은 필수 확장', id, req.join(',')); }
  n++; b0 += fs.statSync(path.join(inDir, f)).size; b1 += b.length;
}
console.log(`${bad ? 'GODOT_SAFE_FAIL' : 'GODOT_SAFE_OK'} ${n} (PNG 그림 ${png}) · ${(b0 / 1048576).toFixed(2)}MB → ${(b1 / 1048576).toFixed(2)}MB`);
