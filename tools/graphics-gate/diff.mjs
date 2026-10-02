#!/usr/bin/env node
/**
 * 그래픽 게이트 공통 도구 — SAGA-ARCH §4.5. 세 트랙(godot·web·unity)의 기준 촬영과 새 촬영을 판별로 비교한다.
 * saga-godot/tools/shot_diff.mjs(G-0009)를 고치지 않고 import 해서 쓴다. **촬영은 안 한다**(사용자 요청 때만).
 *
 *   node tools/graphics-gate/diff.mjs --all                         트랙×판 전부(기준 PNG 가 있는 칸만)
 *   node tools/graphics-gate/diff.mjs --track godot --game go       한 칸
 *   node tools/graphics-gate/diff.mjs --collect web go <원본폴더>   원본 PNG 를 graphics/latest/web/go/ 로 모은다(_<W>x<H> 를 붙임)
 *   node tools/graphics-gate/diff.mjs --selftest                    합성 PNG 로 도구 자체를 점검(게임 안 띄움)
 *   옵션: --ssim=0.90 --hist=0.15 --no-sheet --root=<저장소 루트>(점검용)
 *
 * 폴더 규격: 기준(사용자 승인 PNG) godot = saga-godot/graphics/baseline/<판>/ · web·unity = graphics/baseline/<트랙>/<판>/
 *           새 촬영 graphics/latest/<트랙>/<판>/ (git 제외). 판 = go·dungeon·forest·story·realm.
 * 칸마다 컷 한 줄 `이름 ssim=… hist=… mad=… OK|FAIL`, 끝에 `GFX_GATE fails=N cuts=M skipped=K`.
 * 종료 코드: 0 통과(기준이 없어 건너뛴 칸은 실패가 아니다) · 1 문턱 초과 컷이 있다 · 2 인자·해상도 오류.
 * FAIL 컷이 있으면 tasks/sheets/gfx-<날짜>.md 에 "사용자 판정 대기" 표를 쓴다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareDirs, encodePng } from '../../saga-godot/tools/shot_diff.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRACKS = ['godot', 'web', 'unity'];
const GAMES = ['go', 'dungeon', 'forest', 'story', 'realm'];

const baseDir = (root, track, game) => track === 'godot'
  ? path.join(root, 'saga-godot', 'graphics', 'baseline', game)
  : path.join(root, 'graphics', 'baseline', track, game);
const latestDir = (root, track, game) => path.join(root, 'graphics', 'latest', track, game);

function pngs(dir) {
  try { return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')); } catch { return []; }
}
const stem = (f) => { const m = /^(.*)_\d+x\d+\.png$/i.exec(f); return m ? m[1] : f.replace(/\.png$/i, ''); };

/** 칸 하나 비교 → {skip?, lines, fails, cuts} (해상도 오류는 throw) */
function runCell(root, track, game, opt) {
  const b = baseDir(root, track, game), n = latestDir(root, track, game);
  if (!pngs(b).length) return { skip: '기준 없음', lines: [], fails: 0, cuts: 0 };
  if (!pngs(n).length) return { skip: '새 촬영 없음', lines: [], fails: 0, cuts: 0 };
  return { ...compareDirs(b, n, opt), b, n };
}

function writeSheet(root, rows) {
  const d = new Date(), ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const file = path.join(root, 'tasks', 'sheets', `gfx-${ymd}.md`);
  const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
  const out = [`# 그래픽 게이트 판정 시트`, `${d.toISOString().slice(0, 10)} · 문턱 초과 컷 ${rows.length}개 — 새 촬영이 기준과 다릅니다. 의도한 변화면 ○(기준 교체 승인), 아니면 ×.`, '',
    '| 컷 | 트랙/판 | 수치 | 기준 | 새 촬영 | ○/× (사용자 판정 대기) |', '|---|---|---|---|---|---|'];
  for (const r of rows) out.push(`| ${r.name} | ${r.track}/${r.game} | ${r.metric} | \`${rel(r.base)}\` | \`${rel(r.neu)}\` | |`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n') + '\n');
  return file;
}

/** 여러 칸 실행 → {fails, cuts, skipped, sizeErr, sheet?} */
export function gate(root, cells, opt = {}, sheet = true, log = console.log) {
  let fails = 0, cuts = 0, skipped = 0, sizeErr = false; const rows = [];
  for (const [track, game] of cells) {
    let r;
    try { r = runCell(root, track, game, opt); } catch (e) {
      log(`== ${track}/${game}\n  ${e.message}`); sizeErr = true; continue;
    }
    if (r.skip) { skipped++; log(`== ${track}/${game} — ${r.skip}, 건너뜀`); continue; }
    log(`== ${track}/${game} (${r.cuts}컷)`);
    for (const line of r.lines) {
      log('  ' + line);
      if (line.endsWith('FAIL')) {
        const name = line.split(' ')[0];
        const bf = pngs(r.b).find((f) => stem(f) === name), nf = pngs(r.n).find((f) => stem(f) === name);
        rows.push({ name, track, game, metric: line.slice(name.length + 1, -5) || line.slice(name.length + 1),
          base: path.join(r.b, bf || ''), neu: path.join(r.n, nf || '') });
      }
    }
    fails += r.fails; cuts += r.cuts;
  }
  let sheetFile = null;
  if (rows.length && sheet) { sheetFile = writeSheet(root, rows); log(`판정 시트: ${path.relative(root, sheetFile).replace(/\\/g, '/')}`); }
  log(`GFX_GATE fails=${fails} cuts=${cuts} skipped=${skipped}`);
  return { fails, cuts, skipped, sizeErr, sheet: sheetFile };
}

/** 원본 PNG 를 latest 로 복사 — IHDR 로 읽은 해상도를 `_<W>x<H>` 로 붙인다 */
export function collect(root, track, game, src) {
  const dst = latestDir(root, track, game);
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of pngs(src)) {
    const buf = fs.readFileSync(path.join(src, f));
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const name = /_\d+x\d+\.png$/i.test(f) ? f : f.replace(/\.png$/i, '') + `_${w}x${h}.png`;
    fs.writeFileSync(path.join(dst, name), buf); n++;
  }
  return { n, dst };
}

function synth(w, h, kind) {
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 40 + (x * 150) / w, g = 60 + (y * 120) / h, b = 120 - (x * 50) / w;
    if (x > w * 0.2 && x < w * 0.45 && y > h * 0.3 && y < h * 0.8) { r = 200; g = 80; b = 60; }
    if (kind === 'invert') { r = 255 - r; g = 255 - g; b = 255 - b; }
    const i = (y * w + x) * 3; rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b;
  }
  return encodePng(w, h, rgb);
}

function selftest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx_gate_'));
  let ok = 0, n = 0; const t = (name, cond) => { n++; if (cond) ok++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); };
  const put = (dir, f, buf) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, f), buf); };
  const quiet = () => {};
  try {
    const gb = baseDir(root, 'godot', 'go'), gn = latestDir(root, 'godot', 'go');
    put(gb, 'a_64x48.png', synth(64, 48, 'x')); put(gb, 'b_64x48.png', synth(64, 48, 'x'));
    put(gn, 'a_64x48.png', synth(64, 48, 'x')); put(gn, 'b_64x48.png', synth(64, 48, 'invert'));
    const cells = TRACKS.flatMap((tr) => GAMES.map((g) => [tr, g]));
    const r = gate(root, cells, {}, true, quiet);
    t('같은 컷 OK·뒤집은 컷 FAIL → fails=1 cuts=2', r.fails === 1 && r.cuts === 2);
    t('기준 없는 칸은 건너뜀(14칸)', r.skipped === 14);
    t('FAIL 이 있으면 판정 시트가 생긴다', !!r.sheet && fs.readFileSync(r.sheet, 'utf8').includes('| b | godot/go |'));
    put(gn, 'b_64x48.png', synth(64, 48, 'x'));
    const r2 = gate(root, cells, {}, true, quiet);
    t('모두 같으면 fails=0', r2.fails === 0 && r2.cuts === 2);
    const wb = baseDir(root, 'web', 'dungeon'); put(wb, 'c_64x48.png', synth(64, 48, 'x'));
    const r3 = gate(root, [['web', 'dungeon']], {}, false, quiet);
    t('새 촬영이 없으면 건너뜀(실패 아님)', r3.skipped === 1 && r3.fails === 0);
    const src = path.join(root, 'src'); put(src, 'c.png', synth(64, 48, 'x'));
    const c = collect(root, 'web', 'dungeon', src);
    t('collect 가 _<W>x<H> 를 붙인다', c.n === 1 && fs.existsSync(path.join(latestDir(root, 'web', 'dungeon'), 'c_64x48.png')));
    t('collect 뒤 비교 통과', gate(root, [['web', 'dungeon']], {}, false, quiet).fails === 0);
    put(latestDir(root, 'web', 'dungeon'), 'c_32x24.png', synth(32, 24, 'x'));
    fs.rmSync(path.join(latestDir(root, 'web', 'dungeon'), 'c_64x48.png'));
    t('해상도가 다르면 sizeErr', gate(root, [['web', 'dungeon']], {}, false, quiet).sizeErr === true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  console.log(`SELFTEST ${ok === n ? 'OK' : 'FAIL'} ${ok}/${n}`);
  return ok === n ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = {}, pos = []; let root = path.resolve(HERE, '..', '..'), sheet = true, track = null, game = null, mode = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]; const m = /^--(ssim|hist)=([\d.]+)$/.exec(a);
    if (m) opt[m[1]] = Number(m[2]);
    else if (a === '--selftest') mode = 'selftest';
    else if (a === '--all') mode = 'all';
    else if (a === '--collect') mode = 'collect';
    else if (a === '--no-sheet') sheet = false;
    else if (a.startsWith('--root=')) root = path.resolve(a.slice(7));
    else if (a === '--track') track = args[++i];
    else if (a === '--game') game = args[++i];
    else if (a.startsWith('--')) { console.error('알 수 없는 인자: ' + a); process.exit(2); }
    else pos.push(a);
  }
  const usage = () => { console.error('사용: diff.mjs --all | --track <godot|web|unity> --game <go|dungeon|forest|story|realm> | --collect <트랙> <판> <원본폴더> | --selftest'); process.exit(2); };
  if (mode === 'selftest') process.exit(selftest());
  if (mode === 'collect') {
    const [tr, g, src] = pos;
    if (!TRACKS.includes(tr) || !GAMES.includes(g) || !src || !fs.existsSync(src)) usage();
    const r = collect(root, tr, g, path.resolve(src));
    console.log(`COLLECT ${r.n}장 → ${path.relative(root, r.dst).replace(/\\/g, '/')}`);
    process.exit(r.n ? 0 : 2);
  }
  let cells;
  if (mode === 'all') cells = TRACKS.flatMap((t) => GAMES.map((g) => [t, g]));
  else if (track || game) {
    if (!TRACKS.includes(track) || !GAMES.includes(game)) usage();
    cells = [[track, game]];
  } else usage();
  const r = gate(root, cells, opt, sheet);
  process.exit(r.sizeErr ? 2 : r.fails > 0 ? 1 : 0);
}
