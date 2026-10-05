#!/usr/bin/env node
/**
 * GLB 압축 파이프라인 — 다섯 판(saga-go·saga-dungeon·saga-forest·saga-story·
 * saga-realm) 이 공통으로 쓴다. 각 판은 assets/models/ 밑에 실제 GLB 파일을
 * 제 폴더에 따로 갖고 있다("다섯 벌 복사" 방침 그대로) — 이 스크립트는 그
 * 파일들을 갈아 끼우는 **도구**일 뿐이라 게임 폴더 밖(tools/)에 둔다.
 *
 * 무엇을 하나: geometry+animation 은 Meshopt로, 텍스처는 WebP로 다시
 * 압축한다(둘 다 three.js GLTFLoader가 별도 서버 설정 없이 그대로 읽는다 —
 * WebP는 EXT_texture_webp로 브라우저가 직접 디코드하고, Meshopt는
 * MeshoptDecoder.module.js가 파일 안에 wasm을 base64로 갖고 있어 file://
 * 단독판에서도 그대로 돈다). 뼈대(JOINTS/WEIGHTS)·애니메이션 클립 개수는
 * 그대로 두고 **용량만 줄인다** — simplify(정점 삭감)·palette·join·flatten·
 * instance 는 전부 꺼서 모양·구조를 안 건드린다.
 *
 * 사용법: node compress.mjs <대상 폴더> [--dry] [--force] [--mesh-only]
 *   대상 폴더    예: ../../saga-web/saga-dungeon/assets/models
 *   --dry        실제로 바꾸지 않고 크기 변화만 미리 본다
 *   --force      이미 처리 표시(manifest)가 있어도 다시 돌린다
 *   --mesh-only  (K-0071 웹 모드) 메시·애니만 Meshopt, **텍스처는 바이트 하나 안 건드린다**(WebP 변환·축소 없음).
 *                이미 EXT_meshopt_compression 이 들어 있는 파일은 건너뛰고, gltf-transform 이 모르는 확장(VRM)이 든 파일은
 *                optimize 가 그 데이터를 버리므로 원본을 지킨다. 산출은 verify.mjs(삼각형·쉼 자세 바운딩·스킨·애니·
 *                그림 바이트)를 통과한 것만 제자리 교체한다. 화질 안 깎기 규칙(사용자).
 *
 * 처리 기록은 대상 폴더 안 `.glb-compress-manifest.json`에 남는다 — 이미
 * 압축된 파일을 또 압축하면(특히 손실 WebP) 화질이 거듭 깎이므로, 한 번
 * 처리한 파일은 그 표를 보고 건너뛴다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* .cmd 래퍼로 spawnSync 하면 윈도우에서 EINVAL 이 난다(node 20 알려진 함정) —
   node 로 cli.js 를 직접 부른다, OS 가리지 않는다 */
const CLI_JS = path.join(HERE, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const force = args.includes('--force');
const meshOnly = args.includes('--mesh-only');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('사용법: node compress.mjs <대상 폴더> [--dry] [--force] [--mesh-only]');
  process.exit(1);
}

const root = path.resolve(target);
if (!fs.existsSync(root)) {
  console.error('없는 폴더: ' + root);
  process.exit(1);
}

const manifestPath = path.join(root, '.glb-compress-manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const verifyPair = meshOnly ? (await import('./verify.mjs')).verifyPair : null;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) { walk(p, out); }
    else if (name.isFile() && name.name.toLowerCase().endsWith('.glb')) { out.push(p); }
  }
  return out;
}

/* GLB 머리(12B) 다음 첫 청크 = JSON. extensionsUsed 만 본다(파일 전체를 파싱하지 않는다) */
function glbExtensions(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(20);
    fs.readSync(fd, head, 0, 20, 0);
    if (head.readUInt32LE(0) !== 0x46546C67) return null;
    const len = head.readUInt32LE(12);
    const json = Buffer.alloc(len);
    fs.readSync(fd, json, 0, len, 20);
    const j = JSON.parse(json.toString('utf8'));
    return new Set([...(j.extensionsUsed || []), ...(j.extensionsRequired || [])]);
  } finally { fs.closeSync(fd); }
}
/* gltf-transform 이 모르는 확장(VRM 등)은 optimize 가 **버린다** — 그런 파일은 원본을 지킨다 */
const KNOWN_EXT = meshOnly ? new Set((await import('@gltf-transform/extensions')).ALL_EXTENSIONS.map((e) => e.EXTENSION_NAME)) : null;

const files = walk(root, []);
console.log(`${files.length}개 GLB 발견 (${root})` + (meshOnly ? ' — 메시만(--mesh-only), 텍스처 그대로' : ''));

const OPTIMIZE_FLAGS = [
  '--compress', 'meshopt', '--meshopt-level', 'high',
  ...(meshOnly ? ['--texture-compress', 'false'] : ['--texture-compress', 'webp', '--texture-size', '1024']),
  '--simplify', 'false', '--palette', 'false', '--join', 'false',
  '--flatten', 'false', '--instance', 'false',
  '--resample', 'true', '--prune', 'true', '--weld', 'true', '--sparse', 'true'
];

let totalBefore = 0, totalAfter = 0, done = 0, skipped = 0, failed = 0, already = 0, rejected = 0, unknownExt = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const before = fs.statSync(file).size;
  const rec = manifest[rel];
  if (!force && rec && rec.size === before) {
    skipped++;
    totalBefore += before; totalAfter += before;
    continue;
  }
  if (meshOnly) {
    const ext = glbExtensions(file);
    if (ext && ext.has('EXT_meshopt_compression')) {
      already++;
      totalBefore += before; totalAfter += before;
      continue;
    }
    const unknown = ext ? [...ext].filter((e) => !KNOWN_EXT.has(e)) : [];
    if (unknown.length) {
      unknownExt++;
      manifest[rel] = { size: before, result: 'kept-unknown-ext', ext: unknown, at: new Date().toISOString() };
      totalBefore += before; totalAfter += before;
      console.log(`- ${rel}  ${(before / 1024).toFixed(0)}KB → 그대로(모르는 확장 ${unknown.join(',')} — optimize 가 버린다)`);
      continue;
    }
  }
  const tmp = file + '.tmp.glb';
  try {
    execFileSync(process.execPath, [CLI_JS, 'optimize', file, tmp, ...OPTIMIZE_FLAGS], { stdio: ['ignore', 'ignore', 'pipe'] });
    const after = fs.statSync(tmp).size;
    if (after <= 0 || after > before) {
      /* 압축이 오히려 커지면(이미 작은 파일 등) 원본을 그대로 둔다 */
      fs.unlinkSync(tmp);
      manifest[rel] = { size: before, result: 'kept-original', at: new Date().toISOString() };
      totalBefore += before; totalAfter += before;
      console.log(`- ${rel}  ${(before / 1024).toFixed(0)}KB → 그대로(이미 작음)`);
      continue;
    }
    if (verifyPair) {
      const v = await verifyPair(file, tmp, { keepImages: true });
      if (!v.ok) {
        fs.unlinkSync(tmp);
        rejected++;
        manifest[rel] = { size: before, result: 'verify-failed', why: v.why, at: new Date().toISOString() };
        totalBefore += before; totalAfter += before;
        console.log(`✘ ${rel}  검사 탈락 → 원본 유지: ${v.why.join(' · ')}`);
        continue;
      }
    }
    if (!dry) { fs.renameSync(tmp, file); } else { fs.unlinkSync(tmp); }
    manifest[rel] = { size: dry ? before : after, result: 'ok', mode: meshOnly ? 'mesh-only' : 'full', at: new Date().toISOString() };
    totalBefore += before; totalAfter += after;
    done++;
    console.log(`✔ ${rel}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB` + (dry ? ' (dry-run, 실제로는 안 바꿈)' : ''));
  } catch (e) {
    failed++;
    totalBefore += before; totalAfter += before;
    if (fs.existsSync(tmp)) { fs.unlinkSync(tmp); }
    console.error(`✘ ${rel}  실패: ${(e.stderr || e.message || e).toString().split('\n')[0]}`);
  }
}

if (!dry) { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); }

console.log('---');
console.log(`처리 ${done} · 건너뜀(이미 처리) ${skipped} · 이미 Meshopt ${already} · 모르는 확장 유지 ${unknownExt} · 검사 탈락 ${rejected} · 실패 ${failed}`);
console.log(`용량 ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB` +
  (totalBefore > 0 ? ` (${(100 - totalAfter / totalBefore * 100).toFixed(0)}% 감소)` : ''));
