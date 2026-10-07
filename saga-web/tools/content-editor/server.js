/**
 * saga-web 콘텐츠 에디터 — HEROES/PETS/BIOS(data.js)를 다섯 판에 동시에
 * 반영하는 로컬 전용 서버. 게임 서버가 아니다 — 켜 두어도 게임이 움직이지
 * 않고, `run-editor.bat` 으로 사용자가 직접 켤 때만 뜬다.
 *
 * 다섯 판의 data.js 는 HEROES/PETS/BIOS 구간이 전부 바이트 단위로 동일하다
 * (사가만리만 그 뒤에 자기 전용 코드가 더 붙어 있을 뿐). 그래서 한 판(캐노니컬
 * = saga-go)에서 만든 "옛 엔트리 텍스트"를 다섯 판 파일에서 그대로
 * indexOf 로 찾아 정확히 한 번만 일치할 때만 교체한다 — 못 찾거나 두 번 이상
 * 걸리면 그 판은 실패로 보고하고 건드리지 않는다(이미 어긋나 있었다는 뜻).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fmt = require('./datajs-format');
const a3d = require('./asset3d-format');
const realname = require('./realname');
const tables = require('./tables');
const swbump = require('./swbump');
const obj2glb = require('./obj2glb');
const story = require('./story');       // 대사·퀘스트 편집기(story.html)
const gameserve = require('../lib/gameserve'); // /play/<판>/ — 편집기 안 "▶ 실행" 창

// saga-web/ — 시험할 땐 SAGA_WEB_ROOT 로 복사본을 가리킨다(맵 편집기와 같다)
const ROOT = process.env.SAGA_WEB_ROOT ? path.resolve(process.env.SAGA_WEB_ROOT) : path.join(__dirname, '..', '..');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const CANONICAL = 'saga-go';
const PORT = +process.env.SAGA_EDITOR_PORT || 8799;

function dataJsPath(game) {
  return path.join(ROOT, game, 'js', 'data.js');
}

function asset3dPath(game) {
  return path.join(ROOT, game, 'js', 'asset3d.js');
}

function gameRoot(game) {
  return path.join(ROOT, game);
}

const MODEL_EXT = new Set(['.glb', '.gltf']);
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg']);

function scanDir(absDir, relToGame) {
  if (!fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { recursive: true, withFileTypes: true });
  const out = [];
  entries.forEach((d) => {
    if (!d.isFile()) return;
    const ext = path.extname(d.name).toLowerCase();
    let type = null;
    if (MODEL_EXT.has(ext)) type = 'model';
    else if (IMAGE_EXT.has(ext)) type = 'image';
    else return;
    const full = path.join(d.parentPath || d.path, d.name);
    const rel = path.relative(relToGame, full).split(path.sep).join('/');
    out.push({ path: rel, type });
  });
  return out;
}

/** assets/models(3D 모델)·assets/textures(순수 이미지) 밑을 전부 훑는다.
 *  모델 폴더 안에 섞여 있는 webp(예: 동물 텍스처)도 image 로 잡힌다. */
function listAssetFiles(game) {
  const root = gameRoot(game);
  const out = scanDir(path.join(root, 'assets', 'models'), root)
    .concat(scanDir(path.join(root, 'assets', 'textures'), root));
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function loadModelDefaults(game) {
  const text = fs.readFileSync(asset3dPath(game), 'utf8');
  const prefixVars = a3d.collectStringVars(text);
  const entries = a3d.parseDefaults(text);
  const list = entries.map((e) => {
    const c = a3d.classify(e.raw, prefixVars);
    return { key: e.key, kind: c.kind, path: c.path || null, raw: e.raw };
  });
  return { entries: list, prefixVars };
}

function readGame(game) {
  return fs.readFileSync(dataJsPath(game), 'utf8');
}

function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

/** 파일 하나에서 HEROES/PETS/BIOS 세 구간을 파싱한다. */
function parseFile(text) {
  const heroes = fmt.parseArray(text, 'HEROES');
  const pets = fmt.parseArray(text, 'PETS');
  const bios = fmt.parseObjectOfStrings(text, 'BIOS');
  return { heroes, pets, bios };
}

/** 세 구간(HEROES 배열+PETS 배열+BIOS 객체) 텍스트만 뽑아 붙인 것의 md5 —
 *  판마다 달라도 되는 뒤쪽 코드(사가만리 전용 genchar-jp/cn 등)는 영향 없다. */
function contentHash(text) {
  const p = parseFile(text);
  const region =
    text.slice(p.heroes.openBracket, p.heroes.arrayClose + 1) +
    text.slice(p.pets.openBracket, p.pets.arrayClose + 1) +
    text.slice(p.bios.openBrace, p.bios.objClose + 1);
  return md5(region);
}

function loadContent() {
  const text = readGame(CANONICAL);
  const p = parseFile(text);
  const heroes = p.heroes.entries.map((e) => {
    const obj = fmt.evalEntry(text.slice(e.start, e.end));
    obj._group = e.group;
    return obj;
  });
  const pets = p.pets.entries.map((e) => {
    const obj = fmt.evalEntry(text.slice(e.start, e.end));
    obj._group = e.group;
    return obj;
  });
  const bios = {};
  p.bios.entries.forEach((e) => {
    bios[e.key] = fmt.evalEntry('(' + text.slice(e.start, e.end).replace(/^[^:]+:/, '') + ')');
  });
  const eras = [];
  heroes.forEach((h) => { if (h.era && eras.indexOf(h.era) === -1) eras.push(h.era); });
  const petGroups = [];
  pets.forEach((pt) => { if (pt._group && petGroups.indexOf(pt._group) === -1) petGroups.push(pt._group); });
  return { heroes, pets, bios, eras, petGroups };
}

/** anchorOldText 뒤에 새 조각을 끼워 넣는다. anchor 뒤에 이미 쉼표가 있으면
 *  그 쉼표 뒤에(끝에 쉼표를 붙여) 끼우고, anchor 가 마지막 항목이라 쉼표가
 *  없으면 anchor 뒤에 쉼표를 새로 달고 그 뒤에 끼운다(끝 항목이 된다). */
function insertAfterAnchor(text, anchorOldText, serializedNewEntry) {
  const idx = text.indexOf(anchorOldText);
  if (idx === -1 || text.indexOf(anchorOldText, idx + 1) !== -1) return null;
  const afterAnchor = idx + anchorOldText.length;
  let k = afterAnchor;
  while (/\s/.test(text[k])) k++;
  if (text[k] === ',') {
    const insertAt = k + 1;
    const frag = '\n    ' + serializedNewEntry + ',';
    return text.slice(0, insertAt) + frag + text.slice(insertAt);
  }
  const frag = ',\n    ' + serializedNewEntry;
  return text.slice(0, afterAnchor) + frag + text.slice(afterAnchor);
}

function removeEntry(text, oldEntryText) {
  const idx = text.indexOf(oldEntryText);
  if (idx === -1 || text.indexOf(oldEntryText, idx + 1) !== -1) return null;
  const end = idx + oldEntryText.length;
  let j = end;
  while (/\s/.test(text[j])) j++;
  if (text[j] === ',') return text.slice(0, idx) + text.slice(j + 1);
  let k = idx - 1;
  while (/\s/.test(text[k])) k--;
  if (text[k] === ',') return text.slice(0, k) + text.slice(end);
  return text.slice(0, idx) + text.slice(end);
}

/** 다섯 판 전체에 oldText -> newText 치환을 적용한다. oldText 가 null 이면
 *  "새로 추가"(anchorText 뒤에 삽입), newText 가 null 이면 "삭제". */
function applyAcrossGames({ oldText, newText, anchorText }) {
  const results = {};
  GAMES.forEach((game) => {
    const p = dataJsPath(game);
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch (err) {
      results[game] = { ok: false, reason: '파일 없음: ' + err.message };
      return;
    }
    let next;
    if (oldText == null) {
      next = insertAfterAnchor(text, anchorText, newText);
      if (next == null) { results[game] = { ok: false, reason: '기준 항목을 못 찾음(이미 어긋난 판)' }; return; }
    } else if (newText == null) {
      next = removeEntry(text, oldText);
      if (next == null) { results[game] = { ok: false, reason: '삭제 대상 항목을 못 찾음(이미 어긋난 판)' }; return; }
    } else {
      const idx = text.indexOf(oldText);
      if (idx === -1 || text.indexOf(oldText, idx + 1) !== -1) {
        results[game] = { ok: false, reason: '옛 항목을 정확히 한 번 못 찾음(이미 어긋난 판)' };
        return;
      }
      next = text.slice(0, idx) + newText + text.slice(idx + oldText.length);
    }
    fs.writeFileSync(p, next, 'utf8');
    results[game] = { ok: true, sw: swbump.bump(gameRoot(game), game) };
  });
  return results;
}

function statusPayload() {
  const games = GAMES.map((game) => {
    try {
      const text = readGame(game);
      return { game, exists: true, md5: md5(text), contentHash: contentHash(text) };
    } catch (err) {
      return { game, exists: false, error: err.message };
    }
  });
  const hashes = games.filter((g) => g.exists).map((g) => g.contentHash);
  const synced = hashes.length > 0 && hashes.every((h) => h === hashes[0]);
  return { games, synced };
}

function findHeroAnchor(text, era) {
  const p = fmt.parseArray(text, 'HEROES');
  const matching = p.entries.filter((e) => {
    const o = fmt.evalEntry(text.slice(e.start, e.end));
    return o.era === era;
  });
  const anchorEntry = matching.length ? matching[matching.length - 1] : p.entries[p.entries.length - 1];
  return text.slice(anchorEntry.start, anchorEntry.end);
}

function findPetAnchor(text, group) {
  const p = fmt.parseArray(text, 'PETS');
  const matching = p.entries.filter((e) => e.group === group);
  const anchorEntry = matching.length ? matching[matching.length - 1] : p.entries[p.entries.length - 1];
  return text.slice(anchorEntry.start, anchorEntry.end);
}

function findBioAnchor(text) {
  const p = fmt.parseObjectOfStrings(text, 'BIOS');
  const last = p.entries[p.entries.length - 1];
  return text.slice(last.start, last.end);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

const UPLOAD_MAX = 200 * 1024 * 1024; // GLB 모델은 수십 MB 도 흔하다

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > UPLOAD_MAX) { req.destroy(); reject(new Error('파일이 너무 큼(200MB 초과)')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeFileName(name) {
  const base = path.basename(String(name || ''));
  const cleaned = base.replace(/[^A-Za-z0-9_.-]/g, '_');
  return cleaned || ('file_' + Date.now());
}

/** 같은 이름이 이미 있으면 -2, -3 ... 을 붙여 절대 덮어쓰지 않는다. */
function uniquePath(dir, fileName) {
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - ext.length);
  let candidate = fileName;
  let n = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = stem + '-' + n + ext;
    n++;
  }
  return candidate;
}

/** OBJ(+MTL·텍스처 묶음) → GLB 로 바꿔 assets/models/_uploaded/ 에 넣는다(obj2glb.js, 의존성 없음).
 *  텍스처는 GLB 안에 들어가므로 따로 파일을 남기지 않는다. files: [{ name, buf }] */
function handleObjUpload(game, files) {
  if (GAMES.indexOf(game) === -1) return { error: '알 수 없는 판: ' + game };
  const out = obj2glb.convert(files);
  if (out.error) return { error: out.error };
  const objFile = files.find((f) => path.extname(f.name).toLowerCase() === '.obj');
  const dir = path.join(gameRoot(game), 'assets', 'models', '_uploaded');
  fs.mkdirSync(dir, { recursive: true });
  const finalName = uniquePath(dir, safeFileName(objFile.name).replace(/\.obj$/i, '.glb'));
  fs.writeFileSync(path.join(dir, finalName), out.glb);
  return { ok: true, path: 'assets/models/_uploaded/' + finalName, type: 'model', warnings: out.warnings, stats: out.stats };
}

/** FBX/OBJ·GLB/GLTF·이미지 업로드. FBX 는 fbx2gltf(로컬 node_modules, 저장소
 *  루트에 있으면)로, OBJ 는 obj2glb.js 로 GLB 변환까지 해서 assets/models/_uploaded/ 에 넣는다
 *  (MTL·텍스처까지 함께 올리려면 /api/upload-obj). 이미 있는 파일은 절대 덮어쓰지 않고 새 이름을 붙인다. */
async function handleUpload(game, fileName, buffer) {
  if (GAMES.indexOf(game) === -1) return { error: '알 수 없는 판: ' + game };
  const ext = path.extname(fileName).toLowerCase();
  const clean = safeFileName(fileName);
  const root = gameRoot(game);

  if (ext === '.glb' || ext === '.gltf') {
    const dir = path.join(root, 'assets', 'models', '_uploaded');
    fs.mkdirSync(dir, { recursive: true });
    const finalName = uniquePath(dir, clean);
    fs.writeFileSync(path.join(dir, finalName), buffer);
    return { ok: true, path: 'assets/models/_uploaded/' + finalName, type: 'model' };
  }
  if (IMAGE_EXT.has(ext)) {
    const dir = path.join(root, 'assets', 'textures', '_uploaded');
    fs.mkdirSync(dir, { recursive: true });
    const finalName = uniquePath(dir, clean);
    fs.writeFileSync(path.join(dir, finalName), buffer);
    return { ok: true, path: 'assets/textures/_uploaded/' + finalName, type: 'image' };
  }
  if (ext === '.fbx') {
    let convert;
    try { convert = require('fbx2gltf'); } catch (err) {
      return { error: 'FBX 변환 도구(fbx2gltf)가 안 깔려 있음 — 저장소 루트에서 npm install fbx2gltf 실행 필요' };
    }
    const dir = path.join(root, 'assets', 'models', '_uploaded');
    fs.mkdirSync(dir, { recursive: true });
    const tmpFbx = path.join(os.tmpdir(), 'upload-' + crypto.randomBytes(6).toString('hex') + '.fbx');
    fs.writeFileSync(tmpFbx, buffer);
    const finalName = uniquePath(dir, clean.replace(/\.fbx$/i, '.glb'));
    const destPath = path.join(dir, finalName);
    try {
      await convert(tmpFbx, destPath, []);
    } catch (err) {
      return { error: 'FBX 변환 실패: ' + err.message };
    } finally {
      try { fs.unlinkSync(tmpFbx); } catch (e) { /* 임시파일 못 지워도 치명적이지 않음 */ }
    }
    return { ok: true, path: 'assets/models/_uploaded/' + finalName, type: 'model' };
  }
  if (ext === '.obj') return handleObjUpload(game, [{ name: fileName, buf: buffer }]);
  if (ext === '.mtl') return { error: 'MTL 은 혼자 못 올림 — OBJ·텍스처와 함께 골라 올린다' };
  return { error: '지원하지 않는 확장자: ' + ext + ' (fbx·obj·glb·gltf·webp·png·jpg만)' };
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function handleHeroSave(body) {
  const fields = body.fields;
  const g = realname.guard('인물 ' + fields.id, fields.name, fields.hanja, fields.quote, fields.faction);
  if (g) return { error: g };
  const isNew = !!body.isNew;
  const canonicalText = readGame(CANONICAL);
  const p = fmt.parseArray(canonicalText, 'HEROES');
  const existing = p.entries.find((e) => fmt.evalEntry(canonicalText.slice(e.start, e.end)).id === fields.id);
  const newText = fmt.serializeHero(fields);
  if (isNew || !existing) {
    if (existing) return { error: 'id 중복: ' + fields.id };
    const anchorText = findHeroAnchor(canonicalText, fields.era);
    return { results: applyAcrossGames({ oldText: null, newText, anchorText }) };
  }
  const oldText = canonicalText.slice(existing.start, existing.end);
  return { results: applyAcrossGames({ oldText, newText }) };
}

function handlePetSave(body) {
  const fields = body.fields;
  const g = realname.guard('펫 ' + fields.id, fields.name, fields.desc);
  if (g) return { error: g };
  const isNew = !!body.isNew;
  const canonicalText = readGame(CANONICAL);
  const p = fmt.parseArray(canonicalText, 'PETS');
  const existing = p.entries.find((e) => fmt.evalEntry(canonicalText.slice(e.start, e.end)).id === fields.id);
  const newText = fmt.serializePet(fields);
  if (isNew || !existing) {
    if (existing) return { error: 'id 중복: ' + fields.id };
    const anchorText = findPetAnchor(canonicalText, fields._group || null);
    return { results: applyAcrossGames({ oldText: null, newText, anchorText }) };
  }
  const oldText = canonicalText.slice(existing.start, existing.end);
  return { results: applyAcrossGames({ oldText, newText }) };
}

function handleBioSave(body) {
  const id = body.id;
  const text = body.text || '';
  const g = realname.guard('열전 ' + id, text);
  if (g) return { error: g };
  const canonicalText = readGame(CANONICAL);
  const p = fmt.parseObjectOfStrings(canonicalText, 'BIOS');
  const existing = p.entries.find((e) => e.key === id);
  const newText = id + ': ' + fmt.jsStr(text);
  if (!existing) {
    const anchorText = findBioAnchor(canonicalText);
    return { results: applyAcrossGames({ oldText: null, newText, anchorText }) };
  }
  const oldText = canonicalText.slice(existing.start, existing.end);
  return { results: applyAcrossGames({ oldText, newText }) };
}

function handleDelete(kind, id) {
  const canonicalText = readGame(CANONICAL);
  if (kind === 'hero' || kind === 'pet') {
    const varName = kind === 'hero' ? 'HEROES' : 'PETS';
    const p = fmt.parseArray(canonicalText, varName);
    const existing = p.entries.find((e) => fmt.evalEntry(canonicalText.slice(e.start, e.end)).id === id);
    if (!existing) return { error: '항목을 못 찾음: ' + id };
    const oldText = canonicalText.slice(existing.start, existing.end);
    return { results: applyAcrossGames({ oldText, newText: null }) };
  }
  return { error: 'BIOS 는 삭제를 지원하지 않음(빈 문자열로 저장하세요)' };
}

function handleModelsList(game) {
  if (GAMES.indexOf(game) === -1) return { error: '알 수 없는 판: ' + game };
  const { entries } = loadModelDefaults(game);
  const files = listAssetFiles(game);
  return { entries, files };
}

function handleModelSave(game, body) {
  if (GAMES.indexOf(game) === -1) return { error: '알 수 없는 판: ' + game };
  const key = body.key;
  const newPath = body.newPath;
  const filePath = asset3dPath(game);
  const text = fs.readFileSync(filePath, 'utf8');
  const prefixVars = a3d.collectStringVars(text);
  const entries = a3d.parseDefaults(text);
  const existing = entries.find((e) => e.key === key);
  if (!existing) return { error: '항목을 못 찾음: ' + key };
  const cls = a3d.classify(existing.raw, prefixVars);
  if (cls.kind === 'complex') return { error: '복잡한 표현식이라 이 에디터에서는 못 바꿉니다: ' + key };
  const newRaw = a3d.serializeValue(newPath, prefixVars);
  const next = text.slice(0, existing.valueStart) + newRaw + text.slice(existing.valueEnd);
  fs.writeFileSync(filePath, next, 'utf8');
  return { ok: true, key, newPath, raw: newRaw };
}

const MODEL_MIME = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webp': 'image/webp', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };

/** 게임 폴더 밑 정적 파일을 서빙한다(3D 미리보기용 GLB·vendor three.js 전용,
 *  경로 탈출 방지를 위해 반드시 그 게임 루트 안쪽인지 확인한다). */
function serveStatic(res, game, relPath) {
  if (GAMES.indexOf(game) === -1) { sendJson(res, 404, { error: 'unknown game' }); return; }
  const base = gameRoot(game);
  const target = path.join(base, relPath);
  if (!target.startsWith(base + path.sep) && target !== base) { sendJson(res, 403, { error: 'forbidden' }); return; }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { sendJson(res, 404, { error: 'not found' }); return; }
  const ext = path.extname(target).toLowerCase();
  const body = fs.readFileSync(target);
  res.writeHead(200, { 'Content-Type': MODEL_MIME[ext] || 'application/octet-stream', 'Content-Length': body.length });
  res.end(body);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  try {
    if (gameserve.handle(req, res, u, ROOT, GAMES)) return;
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/editor.html')) {
      const filePath = path.join(__dirname, 'editor.html');
      const body = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && u.pathname === '/api/content') {
      return sendJson(res, 200, loadContent());
    }
    if (req.method === 'GET' && u.pathname === '/api/status') {
      return sendJson(res, 200, statusPayload());
    }
    if (req.method === 'POST' && u.pathname === '/api/hero/save') {
      return readBody(req).then((body) => sendJson(res, 200, handleHeroSave(body)));
    }
    if (req.method === 'POST' && u.pathname === '/api/pet/save') {
      return readBody(req).then((body) => sendJson(res, 200, handlePetSave(body)));
    }
    if (req.method === 'POST' && u.pathname === '/api/bio/save') {
      return readBody(req).then((body) => sendJson(res, 200, handleBioSave(body)));
    }
    if (req.method === 'GET' && u.pathname === '/api/tables') {
      return sendJson(res, 200, { tables: tables.list(ROOT, GAMES) });
    }
    if (req.method === 'GET' && u.pathname === '/api/table') {
      return sendJson(res, 200, tables.read(ROOT, GAMES, u.searchParams.get('game'), u.searchParams.get('file'), u.searchParams.get('name')));
    }
    if (req.method === 'POST' && u.pathname === '/api/table/save') {
      return readBody(req).then((body) => sendJson(res, 200, tables.save(ROOT, GAMES, body, (g) => swbump.bump(gameRoot(g), g))));
    }
    if (req.method === 'POST' && u.pathname === '/api/delete') {
      return readBody(req).then((body) => sendJson(res, 200, handleDelete(body.kind, body.id)));
    }
    if (req.method === 'GET' && u.pathname === '/story.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(__dirname, 'story.html')));
    }
    if (req.method === 'GET' && u.pathname === '/api/story/list') {
      return sendJson(res, 200, { items: story.list(ROOT) });
    }
    if (req.method === 'GET' && u.pathname === '/api/story/read') {
      return sendJson(res, 200, story.read(ROOT, u.searchParams.get('id')));
    }
    if (req.method === 'POST' && u.pathname === '/api/story/check') {
      return readBody(req).then((body) => sendJson(res, 200, story.check(ROOT, body)));
    }
    if (req.method === 'POST' && u.pathname === '/api/story/save') {
      return readBody(req).then((body) => sendJson(res, 200, story.save(ROOT, body, (g) => swbump.bump(gameRoot(g), g))));
    }
    if (req.method === 'GET' && u.pathname === '/preview3d.html') {
      const body = fs.readFileSync(path.join(__dirname, 'preview3d.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(body);
      return;
    }
    {
      const mModelsSave = u.pathname.match(/^\/api\/models\/([a-z-]+)\/save$/);
      if (req.method === 'POST' && mModelsSave) {
        return readBody(req).then((body) => sendJson(res, 200, handleModelSave(mModelsSave[1], body)));
      }
      const mModelsList = u.pathname.match(/^\/api\/models\/([a-z-]+)$/);
      if (req.method === 'GET' && mModelsList) {
        return sendJson(res, 200, handleModelsList(mModelsList[1]));
      }
      const mUpload = u.pathname.match(/^\/api\/upload\/([a-z-]+)$/);
      if (req.method === 'POST' && mUpload) {
        const fileName = u.searchParams.get('name') || 'upload.bin';
        return readRawBody(req)
          .then((buf) => handleUpload(mUpload[1], fileName, buf))
          .then((out) => sendJson(res, 200, out))
          .catch((err) => sendJson(res, 400, { error: err.message }));
      }
      const mUploadObj = u.pathname.match(/^\/api\/upload-obj\/([a-z-]+)$/);
      if (req.method === 'POST' && mUploadObj) {
        // 몸: JSON { files: [{ name, data(base64) }] } — OBJ 하나 + MTL·텍스처
        return readRawBody(req)
          .then((buf) => {
            let body;
            try { body = JSON.parse(buf.toString('utf8')); } catch (e) { return { error: '요청 JSON 이 깨짐' }; }
            const files = (Array.isArray(body.files) ? body.files : []).map((f) => ({ name: String(f.name || ''), buf: Buffer.from(String(f.data || ''), 'base64') }));
            return handleObjUpload(mUploadObj[1], files);
          })
          .then((out) => sendJson(res, 200, out))
          .catch((err) => sendJson(res, 400, { error: err.message }));
      }
      const mStatic = u.pathname.match(/^\/static\/([a-z-]+)\/(.+)$/);
      if (req.method === 'GET' && mStatic) {
        return serveStatic(res, mStatic[1], decodeURIComponent(mStatic[2]));
      }
    }
    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message, stack: err.stack });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('saga-web 콘텐츠 에디터: http://127.0.0.1:' + PORT + '/');
  console.log('다섯 판 data.js 를 직접 고칩니다. 게임 서버가 아닙니다. 끝나면 Ctrl+C.');
});
