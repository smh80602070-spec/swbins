#!/usr/bin/env node
/**
 * 웹 에셋 크기 표 — K-0071 단계 1 "측정 먼저". 폴더마다 GLB 개수·합계·평균과 Meshopt 로 싸인 개수, PNG/WebP 합계를 센다.
 *   node size-table.mjs [saga-web]            기본 saga-web(shared + 다섯 판 assets)
 *   node size-table.mjs <폴더> [<폴더>…]       고른 폴더만
 * 읽기만 한다. 출력은 마크다운 표 한 장(티켓 메모에 그대로 붙인다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const GAMES = ['shared', 'saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];

let dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (dirs.length === 0 || (dirs.length === 1 && dirs[0] === 'saga-web')) {
  dirs = GAMES.map((g) => path.join(ROOT, 'saga-web', g, 'assets'));
}

function hasMeshopt(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(20);
    fs.readSync(fd, head, 0, 20, 0);
    if (head.readUInt32LE(0) !== 0x46546C67) return false;
    const len = head.readUInt32LE(12);
    const json = Buffer.alloc(Math.min(len, 8 * 1024 * 1024));
    fs.readSync(fd, json, 0, json.length, 20);
    return json.latin1Slice().includes('EXT_meshopt_compression');
  } finally { fs.closeSync(fd); }
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p);
  }
  return out;
}

const MB = (b) => (b / 1048576).toFixed(1);
console.log('| 폴더 | GLB | 합계 | 평균 | Meshopt | 안 눌린 합계 | PNG | WebP |');
console.log('|---|---|---|---|---|---|---|---|');
let T = { glb: 0, glbB: 0, mo: 0, rawB: 0, png: 0, pngB: 0, webp: 0, webpB: 0 };
for (const d of dirs) {
  if (!fs.existsSync(d)) { console.log(`| ${d} | (없음) |`); continue; }
  const S = { glb: 0, glbB: 0, mo: 0, rawB: 0, png: 0, pngB: 0, webp: 0, webpB: 0 };
  for (const f of walk(d, [])) {
    const ext = path.extname(f).toLowerCase();
    const sz = fs.statSync(f).size;
    if (ext === '.glb') { S.glb++; S.glbB += sz; if (hasMeshopt(f)) S.mo++; else S.rawB += sz; }
    else if (ext === '.png') { S.png++; S.pngB += sz; }
    else if (ext === '.webp') { S.webp++; S.webpB += sz; }
  }
  const rel = path.relative(ROOT, d).split(path.sep).join('/');
  console.log(`| ${rel} | ${S.glb} | ${MB(S.glbB)}MB | ${S.glb ? (S.glbB / S.glb / 1024).toFixed(0) : 0}KB | ${S.mo}/${S.glb} | ${MB(S.rawB)}MB | ${S.png}/${MB(S.pngB)}MB | ${S.webp}/${MB(S.webpB)}MB |`);
  for (const k of Object.keys(T)) T[k] += S[k];
}
console.log(`| **합** | ${T.glb} | ${MB(T.glbB)}MB | ${T.glb ? (T.glbB / T.glb / 1024).toFixed(0) : 0}KB | ${T.mo}/${T.glb} | ${MB(T.rawB)}MB | ${T.png}/${MB(T.pngB)}MB | ${T.webp}/${MB(T.webpB)}MB |`);
