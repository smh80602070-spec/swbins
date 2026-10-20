/**
 * K-0153 — 유니티 glTFast 가 못 읽는 필수 확장(EXT_texture_webp · EXT_meshopt_compression — 유니티에 meshopt 패키지 없음)을 푼 판을 만든다.
 * KHR_mesh_quantization 은 glTFast 가 기본으로 읽으므로 둔다(풀면 펫 28개 11MB → 38MB).
 * 웹용 압축 정본은 그대로 두고, 유니티 배치용 사본 폴더를 따로 쓴다(place 항목이 그 폴더를 읽는다).
 *
 * 사용법: node tools/glb-compress/unity_safe.mjs <입력 폴더> <출력 폴더> [--ids a,b]   (입력 폴더의 *.glb + 같은 이름 .license.json)
 *   WebP 그림 → JPEG q90(4:4:4) · Meshopt 풀기(읽을 때 디코더) · 남은 필수 확장이 양자화 말고 있으면 UNITY_SAFE_FAIL
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inDir, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ia = process.argv.indexOf('--ids');
const only = ia >= 0 ? new Set(process.argv[ia + 1].split(',')) : null;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(outDir, { recursive: true });
let n = 0, bad = 0, b0 = 0, b1 = 0;
for (const f of fs.readdirSync(inDir).filter((x) => x.endsWith('.glb')).sort()) {
  const id = f.slice(0, -4);
  if (only && !only.has(id)) { continue; }
  const doc = await io.read(path.join(inDir, f));
  const root = doc.getRoot();
  for (const t of root.listTextures()) {
    if (t.getMimeType() === 'image/webp') {
      t.setImage(await sharp(Buffer.from(t.getImage())).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer()).setMimeType('image/jpeg');
      t.setURI(t.getURI().replace(/\.webp$/, '.jpg'));
    }
  }
  for (const e of root.listExtensionsUsed()) {
    if (['EXT_meshopt_compression', 'EXT_texture_webp'].includes(e.extensionName)) { e.dispose(); }
  }
  const out = path.join(outDir, f);
  fs.writeFileSync(out, await io.writeBinary(doc));
  const lic = path.join(inDir, id + '.license.json');
  if (fs.existsSync(lic)) {
    const L = JSON.parse(fs.readFileSync(lic, 'utf8'));
    L.unity_safe = 'K-0153 tools/glb-compress/unity_safe.mjs — 유니티 glTFast 용(WebP→JPEG · Meshopt 풂, 양자화는 둠), 모양·그림 같음';
    fs.writeFileSync(path.join(outDir, id + '.license.json'), JSON.stringify(L, null, 1));
  }
  const b = fs.readFileSync(out), L = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + L));
  const req = (j.extensionsRequired || []).filter((e) => e !== 'KHR_mesh_quantization');
  if (req.length) { bad++; console.log('남은 필수 확장', id, req.join(',')); }
  n++; b0 += fs.statSync(path.join(inDir, f)).size; b1 += b.length;
}
console.log(`${bad ? 'UNITY_SAFE_FAIL' : 'UNITY_SAFE_OK'} ${n} · ${(b0 / 1048576).toFixed(2)}MB → ${(b1 / 1048576).toFixed(2)}MB`);
