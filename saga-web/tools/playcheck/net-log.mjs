// 에셋 요청 로그(K-0073 ③) — 판마다 `_demo.html#<장면>` 다섯을 헤드리스 크롬으로 열고, 그 사이 **이 스크립트가 띄운 정적 서버가 받은 요청 경로**를 모은다.
// 크롬 플래그·CDP 없이도 네트워크 로그가 된다(서버가 곧 로그다). 스크린샷 없음. 끝나면 그 크롬 PID 만 taskkill.
//   node saga-web/tools/playcheck/net-log.mjs saga-go [saga-dungeon …|all] [--budget=45000] [--scenes=index,3d]
//   --scenes 를 주면 그 장면만 열고 기존 netlog_<판>.json 에 **합친다**(`index` = 진짜 게임 index.html — _demo.html 엔 빠진 스크립트가 있을 수 있다)
// 결과: tools/asset-audit/out/netlog_<판>.json { scenes:{장면:[경로]}, requested:[에셋 경로…], missing:[404 경로…], placed:n, unrequested:[배치됐으나 요청 안 된 에셋…], other:[js·html·json 요청…] }
// 끝 줄: NETLOG <판> requested n placed m unrequested k missing j
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..');                      // saga-web/
const ROOT = path.resolve(WEB, '..');                            // 저장소
const OUT = path.join(ROOT, 'tools', 'asset-audit', 'out');
const PROF = path.join(HERE, 'chrome-prof-netlog');              // .gitignore chrome-prof*/
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
// 판마다 데모 장면 다섯 — _demo.html 이 hash 로 받는 키(장면이 없으면 기본 화면)
const SCENES = {
  'saga-go': ['3d', 'land', 'people', 'pet', 'fort'],
  'saga-dungeon': ['dg', 'gear3d', 'me3d', 'loot', 'fx'],
  'saga-forest': ['town', 'room', 'folks', 'fish', 'museum'],
  'saga-story': ['town', 'hunt', 'boss', 'gorge', 'herodetail'],
  'saga-realm': ['map', 'city', 'war', 'officers', 'chibi'],
};
const ASSET_EXT = new Set(['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.ogg', '.mp3', '.wav', '.hdr', '.woff2']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream' };
const SW_STUB = "self.addEventListener('install',function(){self.skipWaiting();});self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}).then(function(){return self.registration.unregister();}));});";

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
let games = argv.filter(a => !a.startsWith('--'));
if (!games.length || games.includes('all')) games = ALL;
const budget = Number(opt.budget || 45000);
const onlyScenes = opt.scenes ? String(opt.scenes).split(',').filter(Boolean) : null;
const HARD = budget * 2 + 30000;   // 3D 장면은 dump-dom 이 예산 안에 안 끝난다 — 요청은 앞쪽에 몰리니 2배+30초에서 끊는다

let log = null;                      // 현재 장면의 요청 모음 {paths:Set, missing:Set}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let rel;
  try { rel = decodeURIComponent(u.pathname).replace(/^\/+/, ''); } catch (e) { res.writeHead(404); res.end(); return; }
  const target = path.resolve(WEB, rel);
  if (!target.startsWith(WEB + path.sep)) { res.writeHead(403); res.end(); return; }
  if (/^[a-z0-9-]+\/sw\.js$/.test(rel)) { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }); res.end(SW_STUB); return; }
  let st = null;
  try { st = fs.statSync(target); } catch (e) { /* 없음 */ }
  if (log) { (st && st.isFile() ? log.paths : log.missing).add(rel); }
  if (!st || !st.isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
});

let chrome = null;
function killChrome() {
  if (chrome && chrome.pid) { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) { /* 이미 끝남 */ } }
  chrome = null;
}
process.on('exit', killChrome);
process.on('SIGINT', () => { killChrome(); process.exit(1); });

function openScene(game, scene, port) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); killChrome(); resolve(); };
    const timer = setTimeout(finish, HARD);
    chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', `--user-data-dir=${PROF}`, '--disk-cache-size=1',
      `--virtual-time-budget=${budget}`, '--dump-dom', scene === 'index' ? `http://127.0.0.1:${port}/${game}/index.html` : `http://127.0.0.1:${port}/${game}/_demo.html#${scene}`], { stdio: ['ignore', 'pipe', 'ignore'] });
    chrome.stdout.on('data', () => { /* DOM 은 안 쓴다 — 네트워크만 */ });
    chrome.on('error', finish);
    chrome.on('close', finish);
  });
}

function placedAssets(game) {
  const dirs = [path.join(WEB, 'shared', 'assets'), path.join(WEB, 'shared', 'audio'), path.join(WEB, game, 'assets')];
  const out = [];
  const walk = d => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (ASSET_EXT.has(path.extname(e.name).toLowerCase())) out.push(path.relative(WEB, p).replace(/\\/g, '/')); } };
  dirs.forEach(walk);
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(PROF, { recursive: true, force: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  for (const g of games) {
    if (!SCENES[g]) { console.log(`${g}: 모르는 판`); continue; }
    const file = path.join(OUT, `netlog_${g}.json`);
    let prev = null;
    if (onlyScenes) { try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { prev = null; } }
    const scenes = Object.assign({}, prev && prev.scenes || {}), all = new Set(), missing = new Set(prev && prev.missing || []), other = new Set(prev && prev.other || []);
    for (const sc of (onlyScenes || SCENES[g])) {
      log = { paths: new Set(), missing: new Set() };
      const t0 = Date.now();
      await openScene(g, sc, port);
      const assets = [...log.paths].filter(p => ASSET_EXT.has(path.extname(p).toLowerCase())).sort();
      scenes[sc] = assets;
      assets.forEach(p => all.add(p));
      [...log.paths].filter(p => !ASSET_EXT.has(path.extname(p).toLowerCase())).forEach(p => other.add(p));
      log.missing.forEach(p => missing.add(p));
      console.log(`  ${g}#${sc} 요청 ${log.paths.size} (에셋 ${assets.length}, 404 ${log.missing.size}) ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      log = null;
    }
    Object.values(scenes).forEach(list => list.forEach(p => all.add(p)));   // 합친 장면 전부의 합집합
    const placed = placedAssets(g);
    const unrequested = placed.filter(p => !all.has(p));
    const j = { game: g, date: new Date().toISOString().slice(0, 10), budget, scenes, requested: [...all].sort(), missing: [...missing].sort(),
      placed: placed.length, unrequested, other: [...other].sort() };
    fs.writeFileSync(file, JSON.stringify(j, null, 1));
    console.log(`NETLOG ${g} requested ${all.size} placed ${placed.length} unrequested ${unrequested.length} missing ${missing.size}`);
  }
  server.close();
  killChrome();
  fs.rmSync(PROF, { recursive: true, force: true });
}
main().catch(e => { console.log('ERR', e.message); killChrome(); process.exit(1); });
