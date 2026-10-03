#!/usr/bin/env node
/**
 * 판 폴더 정적 서버 — `run.bat`·`start_server.bat` 이 부른다 (python http.server 대신, W-0021).
 *
 *   node serve-game.mjs <포트> <판 폴더>
 *
 * 판 폴더를 그대로 서빙하되 `/_shared/…` 는 `saga-web/shared/…` 로 잇는다 — 통일 3D 에셋(shared/assets)을 판마다 복사하지 않고
 * 한 벌로 읽기 위해서다(공개 페이지에서는 `../shared/` 가 같은 곳을 가리킨다). 읽기 전용·0.0.0.0 바인딩(폰 접속용)·캐시는 브라우저에 맡긴다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2]), root = path.resolve(process.argv[3] || '.');
const SHARED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'shared');
if (!port || !fs.existsSync(root)) { console.error('사용: node serve-game.mjs <포트> <판 폴더>'); process.exit(1); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream', '.vrm': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.hdr': 'application/octet-stream', '.ktx2': 'image/ktx2',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
  if (rel.endsWith('/')) { rel += 'index.html'; }
  let base = root, sub = rel;
  if (rel.startsWith('/_shared/')) { base = SHARED; sub = rel.slice('/_shared'.length); }
  const abs = path.join(base, sub);
  if (!abs.startsWith(base)) { res.writeHead(403); res.end(); return; }
  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('없습니다: ' + rel); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(port, '0.0.0.0', () => console.log('serving', root, 'on', port, '(/_shared → saga-web/shared)'));
