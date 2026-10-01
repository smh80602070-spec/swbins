#!/usr/bin/env node
/**
 * 그래픽 기준 촬영 비교 — SAGA-ARCH §4.5 "그래픽 게이트". 기준 폴더와 새 촬영 폴더의 PNG 를 이름으로 짝지어 차이를 숫자로 낸다.
 *
 *   node tools/shot_diff.mjs <기준폴더> <새폴더> [--ssim=0.90] [--hist=0.15]
 *   node tools/shot_diff.mjs --selftest        합성 PNG 로 도구 자체를 점검(게임 안 띄움)
 *
 * 파일 이름 `<이름>_<W>x<H>.png`(probe_shots.gd 가 쓰는 꼴)의 <이름> 으로 짝짓는다.
 * 컷마다 한 줄 `이름 ssim=… hist=… mad=… OK|FAIL`, 끝에 `SHOT_DIFF fails=N cuts=M`. N>0 이면 종료 1, 해상도가 다르거나 인자가 틀리면 종료 2.
 *   ssim = 회색조 8×8 블록 평균(C1=6.5025, C2=58.5225) · hist = RGB 32구간 L1 거리(0~1)의 세 채널 평균 · mad = 평균 절대차/255.
 *   FAIL = ssim < 문턱 또는 hist > 문턱, 또는 한쪽 폴더에만 있는 컷. 문턱 기본값은 첫 기준 촬영 뒤 같은 장면을 두 번 찍어 보고 조정한다.
 * PNG: 8비트 RGB·RGBA·회색, 비인터레이스(Godot save_png 꼴). 의존 없는 node 한 파일.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

class SizeError extends Error {}

export function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('PNG 아님');
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; inter = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 6: 4 }[ctype];
  if (!ch || depth !== 8 || inter !== 0) throw new Error(`지원 안 하는 PNG(색종류 ${ctype}·${depth}비트·인터레이스 ${inter})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0, b = y > 0 ? px[dst - stride + x] : 0, c = x >= ch && y > 0 ? px[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  // RGB 로 통일
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    if (ch === 1) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = px[i];
    else { rgb[i * 3] = px[i * ch]; rgb[i * 3 + 1] = px[i * ch + 1]; rgb[i * 3 + 2] = px[i * ch + 2]; }
  }
  return { w, h, rgb };
}

export function encodePng(w, h, rgb) {
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8);
    b.writeUInt32BE(zlib.crc32(b.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function metrics(A, B) {
  const { w, h } = A;
  const gray = (img, i) => 0.299 * img.rgb[i * 3] + 0.587 * img.rgb[i * 3 + 1] + 0.114 * img.rgb[i * 3 + 2];
  const C1 = 6.5025, C2 = 58.5225;
  let sum = 0, blocks = 0;
  for (let by = 0; by + 8 <= h; by += 8) for (let bx = 0; bx + 8 <= w; bx += 8) {
    let mx = 0, my = 0, xx = 0, yy = 0, xy = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = (by + y) * w + bx + x, a = gray(A, i), b = gray(B, i);
      mx += a; my += b; xx += a * a; yy += b * b; xy += a * b;
    }
    mx /= 64; my /= 64;
    const vx = xx / 64 - mx * mx, vy = yy / 64 - my * my, cxy = xy / 64 - mx * my;
    sum += ((2 * mx * my + C1) * (2 * cxy + C2)) / ((mx * mx + my * my + C1) * (vx + vy + C2));
    blocks++;
  }
  const ssim = blocks ? sum / blocks : 1;
  const n = w * h;
  let hist = 0, mad = 0;
  for (let c = 0; c < 3; c++) {
    const ha = new Float64Array(32), hb = new Float64Array(32);
    for (let i = 0; i < n; i++) { ha[A.rgb[i * 3 + c] >> 3]++; hb[B.rgb[i * 3 + c] >> 3]++; mad += Math.abs(A.rgb[i * 3 + c] - B.rgb[i * 3 + c]); }
    let d = 0;
    for (let k = 0; k < 32; k++) d += Math.abs(ha[k] - hb[k]);
    hist += d / (2 * n);
  }
  return { ssim, hist: hist / 3, mad: mad / (3 * n * 255) };
}

function cutsOf(dir) {
  const m = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.png')) continue;
    const mm = /^(.*)_\d+x\d+\.png$/i.exec(f);
    m.set(mm ? mm[1] : f.slice(0, -4), path.join(dir, f));
  }
  return m;
}

export function compareDirs(baseDir, newDir, opt = {}) {
  const ssimMin = opt.ssim ?? 0.90, histMax = opt.hist ?? 0.15;
  const a = cutsOf(baseDir), b = cutsOf(newDir);
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  const lines = []; let fails = 0;
  for (const n of names) {
    if (!a.has(n) || !b.has(n)) { lines.push(`${n} ${a.has(n) ? '새 촬영에 없음' : '기준에 없음'} FAIL`); fails++; continue; }
    const A = decodePng(fs.readFileSync(a.get(n))), B = decodePng(fs.readFileSync(b.get(n)));
    if (A.w !== B.w || A.h !== B.h) throw new SizeError(`${n}: 해상도 다름 ${A.w}x${A.h} ≠ ${B.w}x${B.h}`);
    const m = metrics(A, B);
    const ok = m.ssim >= ssimMin && m.hist <= histMax;
    if (!ok) fails++;
    lines.push(`${n} ssim=${m.ssim.toFixed(3)} hist=${m.hist.toFixed(3)} mad=${m.mad.toFixed(3)} ${ok ? 'OK' : 'FAIL'}`);
  }
  return { lines, fails, cuts: names.length };
}

function synth(w, h, kind) {
  const rgb = Buffer.alloc(w * h * 3);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 40 + (x * 150) / w, g = 60 + (y * 120) / h, b = 120 - (x * 50) / w;
    if (x > w * 0.2 && x < w * 0.45 && y > h * 0.3 && y < h * 0.8) { r = 200; g = 80; b = 60; }
    if ((x - w * 0.7) ** 2 + (y - h * 0.4) ** 2 < (h * 0.25) ** 2) { r = 240; g = 230; b = 90; }
    if (kind === 'noise') { r += (rnd() - 0.5) * 12; g += (rnd() - 0.5) * 12; b += (rnd() - 0.5) * 12; }
    if (kind === 'invert') { r = 255 - r; g = 255 - g; b = 255 - b; }
    const i = (y * w + x) * 3;
    rgb[i] = Math.max(0, Math.min(255, r)); rgb[i + 1] = Math.max(0, Math.min(255, g)); rgb[i + 2] = Math.max(0, Math.min(255, b));
  }
  return rgb;
}

function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot_diff_'));
  const put = (dir, name, w, h, kind) => { fs.mkdirSync(path.join(tmp, dir), { recursive: true }); fs.writeFileSync(path.join(tmp, dir, `${name}_${w}x${h}.png`), encodePng(w, h, synth(w, h, kind))); };
  const W = 160, H = 96;
  put('base', 'same', W, H, 'plain'); put('new', 'same', W, H, 'plain');
  put('base', 'noisy', W, H, 'plain'); put('new', 'noisy', W, H, 'noise');
  put('base', 'inv', W, H, 'plain'); put('new', 'inv', W, H, 'invert');
  const r = compareDirs(path.join(tmp, 'base'), path.join(tmp, 'new'));
  const get = n => r.lines.find(l => l.startsWith(n + ' '));
  const checks = [
    ['같은 그림 ssim=1.000 OK', /ssim=1\.000 hist=0\.000 mad=0\.000 OK$/.test(get('same'))],
    ['약한 잡음 OK', /OK$/.test(get('noisy')) && /ssim=0\.9\d\d/.test(get('noisy'))],
    ['색 반전 FAIL', /FAIL$/.test(get('inv'))],
    ['실패 합계 1', r.fails === 1],
  ];
  put('base', 'big', 320, 192, 'plain'); put('new', 'big', W, H, 'plain');
  let sizeErr = false;
  try { compareDirs(path.join(tmp, 'base'), path.join(tmp, 'new')); } catch (e) { sizeErr = e instanceof SizeError; }
  checks.push(['크기 다름 → 종료 2 경로', sizeErr]);
  fs.rmSync(tmp, { recursive: true, force: true });
  let bad = 0;
  for (const [name, ok] of checks) { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) bad++; }
  r.lines.forEach(l => console.log('   ', l));
  console.log(bad ? `SELFTEST FAIL ${bad}` : 'SELFTEST OK');
  return bad ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(selftest());
  const opt = {}; const pos = [];
  for (const a of args) {
    const m = /^--(ssim|hist)=([0-9.]+)$/.exec(a);
    if (m) opt[m[1]] = Number(m[2]); else if (a.startsWith('--')) { console.error('알 수 없는 인자: ' + a); process.exit(2); } else pos.push(a);
  }
  if (pos.length !== 2 || !pos.every(d => fs.existsSync(d) && fs.statSync(d).isDirectory())) {
    console.error('사용: node tools/shot_diff.mjs <기준폴더> <새폴더> [--ssim=0.90] [--hist=0.15]  |  --selftest'); process.exit(2);
  }
  try {
    const r = compareDirs(pos[0], pos[1], opt);
    if (r.cuts === 0) { console.error('비교할 PNG 컷이 없다(두 폴더 다 비었거나 경로가 틀림)'); process.exit(2); }
    r.lines.forEach(l => console.log(l));
    console.log(`SHOT_DIFF fails=${r.fails} cuts=${r.cuts}`);
    process.exit(r.fails > 0 ? 1 : 0);
  } catch (e) {
    console.error(e.message); process.exit(e instanceof SizeError ? 2 : 3);
  }
}
