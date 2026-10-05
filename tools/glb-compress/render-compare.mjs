#!/usr/bin/env node
/**
 * 압축 전후 GLB 를 같은 카메라로 그려 화소 차를 잰다 — K-0071 단계 5 "촬영 전후 비교, 그림은 안 남긴다".
 *   node render-compare.mjs <after-root> [--per 4] [--ref HEAD] [--size 320] [--mean 2] [--frac 1]
 *     after-root  압축이 끝난 폴더(예: saga-web/saga-go/assets). 그 안 `.glb-compress-manifest.json` 의 result=ok 항목에서
 *                 크기 순으로 고르게 --per 개를 뽑고, "전" 은 `git show <ref>:<경로>` 로 꺼낸다(작업 트리는 안 건드린다).
 *   문턱: 평균 절대 차(RGB, 0~255) ≤ --mean(기본 2) 이고 채널 차 24 넘는 화소 비율 ≤ --frac %(기본 1) 이면 OK. 하나라도 FAIL 이면 종료 1.
 *   렌더: 이 PC 크롬 헤드리스(swiftshader) + 판 vendor `three.iife.js`(GLTFLoader·MeshoptDecoder 번들) — 사가의 로더와 같은 길.
 *   playwright-core 는 saga-web/tools/playcheck/node_modules 것을 빌려 쓴다(없으면 그 폴더에서 npm install).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const target = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
if (!target) { console.error('사용법: node render-compare.mjs <after-root> [--per 4] [--ref HEAD] [--size 320]'); process.exit(1); }
const PER = +opt('--per', 4), REF = opt('--ref', 'HEAD'), SIZE = +opt('--size', 320);
const MEAN_MAX = +opt('--mean', 2), FRAC_MAX = +opt('--frac', 1);

const afterRoot = path.resolve(target);
const manifestPath = path.join(afterRoot, '.glb-compress-manifest.json');
if (!fs.existsSync(manifestPath)) { console.error('manifest 없음: ' + manifestPath); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ok = Object.entries(manifest).filter(([, v]) => v.result === 'ok').sort((a, b) => b[1].size - a[1].size);
if (ok.length === 0) { console.log('비교할 ok 항목 없음'); process.exit(0); }
const picks = [];
for (let i = 0; i < Math.min(PER, ok.length); i++) picks.push(ok[Math.floor(i * ok.length / Math.min(PER, ok.length))][0]);

const beforeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glb-compare-'));
const repoRel = (rel) => path.relative(ROOT, path.join(afterRoot, rel)).split(path.sep).join('/');
for (const rel of picks) {
  const out = path.join(beforeDir, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const buf = execFileSync('git', ['show', `${REF}:${repoRel(rel)}`], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(out, buf);
}

const THREE_JS = path.join(ROOT, 'saga-web', 'saga-go', 'js', 'vendor', 'three.iife.js');
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#808080">
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script src="/three.iife.js"></script>
<script>
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1); renderer.setSize(${SIZE}, ${SIZE}, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const loader = new THREE.GLTFLoader();
if (THREE.MeshoptDecoder) loader.setMeshoptDecoder(THREE.MeshoptDecoder);
window.render = async function (url, cam) {
  const gltf = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x808080);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(3, 5, 2); scene.add(sun);
  const model = gltf.scene; scene.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  if (!cam) {
    const d = Math.max(size.x, size.y, size.z, 1e-3) * 1.6;
    cam = { pos: [center.x + d * 0.8, center.y + d * 0.6, center.z + d * 0.8], at: [center.x, center.y, center.z], near: d * 0.01, far: d * 10 };
  }
  const camera = new THREE.PerspectiveCamera(40, 1, cam.near, cam.far);
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]); camera.lookAt(cam.at[0], cam.at[1], cam.at[2]);
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const px = new Uint8Array(${SIZE} * ${SIZE} * 4);
  gl.readPixels(0, 0, ${SIZE}, ${SIZE}, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = ''; for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
  model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return { cam, px: btoa(s), bbox: [size.x, size.y, size.z] };
};
</script>`;

const server = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  let f = null;
  if (p === '/') { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(PAGE); return; }
  if (p === '/three.iife.js') f = THREE_JS;
  else if (p.startsWith('/b/')) f = path.join(beforeDir, p.slice(3));
  else if (p.startsWith('/a/')) f = path.join(afterRoot, p.slice(3));
  if (!f || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'cache-control': 'no-store' });
  s.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(path.join(ROOT, 'saga-web', 'tools', 'playcheck', 'package.json'));
const { chromium } = require('playwright-core');
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '/');

function decode(b64) { return Buffer.from(b64, 'base64'); }
function compare(A, B) {
  let sum = 0, bad = 0, covA = 0, covB = 0; const n = A.length / 4;
  for (let i = 0; i < A.length; i += 4) {
    const d0 = Math.abs(A[i] - B[i]), d1 = Math.abs(A[i + 1] - B[i + 1]), d2 = Math.abs(A[i + 2] - B[i + 2]);
    sum += d0 + d1 + d2;
    if (d0 > 24 || d1 > 24 || d2 > 24) bad++;
    if (Math.abs(A[i] - 128) > 6 || Math.abs(A[i + 1] - 128) > 6 || Math.abs(A[i + 2] - 128) > 6) covA++;
    if (Math.abs(B[i] - 128) > 6 || Math.abs(B[i + 1] - 128) > 6 || Math.abs(B[i + 2] - 128) > 6) covB++;
  }
  return { mean: sum / (3 * n), frac: bad / n * 100, covA: covA / n * 100, covB: covB / n * 100 };
}

console.log(`| 파일 | 전 KB | 후 KB | 보임 % 전/후 | 평균 차 | >24 화소 % | 판정 |`);
console.log(`|---|---|---|---|---|---|---|`);
let fails = 0;
for (const rel of picks) {
  const u = rel.split(path.sep).join('/');
  try {
    const rb = await page.evaluate((url) => window.render(url, null), `${base}/b/${u}`);
    const ra = await page.evaluate(([url, cam]) => window.render(url, cam), [`${base}/a/${u}`, rb.cam]);
    const c = compare(decode(rb.px), decode(ra.px));
    const sizeB = fs.statSync(path.join(beforeDir, rel)).size, sizeA = fs.statSync(path.join(afterRoot, rel)).size;
    const okv = c.mean <= MEAN_MAX && c.frac <= FRAC_MAX && c.covB > 0.5;
    if (!okv) fails++;
    console.log(`| ${u} | ${(sizeB / 1024).toFixed(0)} | ${(sizeA / 1024).toFixed(0)} | ${c.covA.toFixed(1)}/${c.covB.toFixed(1)} | ${c.mean.toFixed(2)} | ${c.frac.toFixed(2)} | ${okv ? 'OK' : 'FAIL'} |`);
  } catch (e) {
    fails++;
    console.log(`| ${u} | | | | | | FAIL(${String(e.message || e).split('\n')[0].slice(0, 80)}) |`);
  }
}
if (errors.length) console.log('페이지 예외: ' + errors.slice(0, 3).join(' · '));
await browser.close();
server.close();
fs.rmSync(beforeDir, { recursive: true, force: true });
console.log(fails ? `FAIL ${fails}/${picks.length}` : `OK ${picks.length}/${picks.length} (문턱 평균 ≤${MEAN_MAX}, >24 화소 ≤${FRAC_MAX}%)`);
process.exit(fails ? 1 : 0);
