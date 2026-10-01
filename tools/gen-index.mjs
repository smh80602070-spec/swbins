#!/usr/bin/env node
/**
 * 판별 `js/manifest.json` ↔ `index.html`·`_test.html` 의 `<script src>` 줄 — 순서를 한 곳에 둔다(SAGA-ARCH §4.2-3).
 *
 *   node tools/gen-index.mjs --init                 manifest 가 없는 판에 지금 html 에서 뽑아 만든다(있으면 건드리지 않는다)
 *   node tools/gen-index.mjs                        manifest 대로 html 의 script 줄을 다시 쓴다
 *   node tools/gen-index.mjs --check                쓰지 않고 비교만. 다르면 줄을 찍고 종료 1 (precheck 가 부른다)
 *   node tools/gen-index.mjs --add <판> <js/새.js> --after <js/앞.js> [--index|--test]
 *                                                   앞 파일이 든 묶음에 한 줄 끼운다(옵션이 없으면 앞 파일이 있는 쪽 전부)
 *
 * manifest 꼴: {"index": [[src…],[src…]], "test": [[…]]}. 묶음(run) = html 에서 `<script src="X"></script>` 한 줄짜리가
 * **연속**한 덩어리다. 사이에 낀 인라인 <script>·주석·async 태그는 묶음을 가르고, 이 도구는 그런 줄에 손대지 않는다.
 * 이미 있는 줄은 원문(들여쓰기·뒤 주석)을 그대로 쓴다. 판 동작·로드 순서는 바꾸지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'saga-web');
const GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const KINDS = { index: 'index.html', test: '_test.html' };
const PLAIN = /^(\s*)<script src="([^"]+)"><\/script>(\s*<!--.*-->)?\s*$/;

const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const check = flag('--check'), init = flag('--init'), addAt = argv.indexOf('--add');

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const runs = []; let cur = null;
  lines.forEach((l, i) => {
    const m = PLAIN.exec(l);
    if (m) { if (!cur) { cur = { start: i, items: [] }; runs.push(cur); } cur.items.push({ src: m[2], line: l, indent: m[1] }); }
    else cur = null;
  });
  return { lines, eol, runs };
}
function srcRuns(p) { return p.runs.map(r => r.items.map(x => x.src)); }
function render(parsed, runs) {
  /** 뒤 묶음부터 갈아 끼운다(앞 줄 번호가 안 밀리게) */
  const lines = parsed.lines.slice();
  for (let i = parsed.runs.length - 1; i >= 0; i--) {
    const r = parsed.runs[i], keep = new Map(r.items.map(x => [x.src, x.line]));
    const indent = r.items[0].indent;
    const out = runs[i].map(s => keep.get(s) || `${indent}<script src="${s}"></script>`);
    lines.splice(r.start, r.items.length, ...out);
  }
  return lines.join(parsed.eol);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mfPath = g => path.join(WEB, g, 'js', 'manifest.json');
const readMf = g => JSON.parse(fs.readFileSync(mfPath(g), 'utf8'));
const writeMf = (g, m) => fs.writeFileSync(mfPath(g), JSON.stringify(m, null, 1) + '\n');

if (addAt >= 0) {
  const [g, js] = [argv[addAt + 1], argv[addAt + 2]];
  const after = argv[argv.indexOf('--after') + 1];
  if (!GAMES.includes(g) || !js || !after || argv.indexOf('--after') < 0) { console.error('사용: --add <판> <js/새.js> --after <js/앞.js> [--index|--test]'); process.exit(1); }
  const m = readMf(g);
  const kinds = flag('--index') ? ['index'] : flag('--test') ? ['test'] : ['index', 'test'];
  let did = 0;
  for (const k of kinds) {
    const run = m[k].find(r => r.includes(after));
    if (!run) { continue; }
    if (m[k].some(r => r.includes(js))) { console.log(`${g} ${k}: 이미 있음`); did++; continue; }
    run.splice(run.indexOf(after) + 1, 0, js); did++;
    console.log(`${g} ${k}: ${after} 뒤에 ${js}`);
  }
  if (!did) { console.error(`${after} 이 든 묶음이 없다(${kinds.join('·')})`); process.exit(1); }
  writeMf(g, m);
  const sw = path.join(WEB, g, 'sw.js');
  if (fs.existsSync(sw) && !fs.readFileSync(sw, 'utf8').includes(`'./${js}'`)) console.log(`주의: ${g}/sw.js SHELL 에 './${js}' 가 없다 — 넣고 VERSION 을 올릴 것`);
  // 아래 기본 실행(html 다시 쓰기)으로 이어 간다
}

let bad = 0, wrote = 0;
for (const g of GAMES) {
  const pk = Object.fromEntries(Object.entries(KINDS).map(([k, f]) => [k, parse(path.join(WEB, g, f))]));
  if (init) {
    if (fs.existsSync(mfPath(g))) { console.log(`${g}: manifest 있음(건드리지 않음)`); continue; }
    writeMf(g, { index: srcRuns(pk.index), test: srcRuns(pk.test) });
    console.log(`${g}: manifest 만듦 (index ${pk.index.runs.length}묶음 · test ${pk.test.runs.length}묶음)`);
    continue;
  }
  if (!fs.existsSync(mfPath(g))) { console.log(`FAIL ${g}: js/manifest.json 없음 — --init`); bad++; continue; }
  const m = readMf(g);
  for (const [k, f] of Object.entries(KINDS)) {
    const p = pk[k];
    if (m[k].length !== p.runs.length) { console.log(`FAIL ${g}/${f}: 묶음 수 manifest ${m[k].length} ≠ html ${p.runs.length}`); bad++; continue; }
    if (check) {
      p.runs.forEach((r, i) => { if (!same(r.items.map(x => x.src), m[k][i])) { console.log(`DIFF ${g}/${f} ${r.start + 1}줄~ 묶음 ${i + 1} ≠ manifest`); bad++; } });
      continue;
    }
    const out = render(p, m[k]);
    const file = path.join(WEB, g, f);
    if (out !== fs.readFileSync(file, 'utf8')) { fs.writeFileSync(file, out); wrote++; console.log(`쓴 파일 ${g}/${f}`); }
  }
}
if (check) console.log(bad ? `FAIL manifest 와 다른 html ${bad}곳 — node tools/gen-index.mjs` : `OK ${GAMES.length}판`);
else if (!init) console.log(`html ${wrote}개 갱신`);
process.exit(bad ? 1 : 0);
