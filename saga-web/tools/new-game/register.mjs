#!/usr/bin/env node
/**
 * new-game.mjs 가 만든 새 판을 저장소 도구 넷에 등록한다 — "손으로 등록할 곳" 체크리스트 중
 * 기계적인 네 곳(루트 CLAUDE.md 표 · precheck.sh · asset-audit WEB_GAMES · content-editor GAMES)만.
 * 다루지 않는 것(README·HANDOFF 에 남아 있다): C:\swbins2\services.json 허브 카드(별개 저장소),
 * icons/ 를 이 판 것으로 바꾸기, PLAN §1 원작·정체성 채우기.
 *
 *   node saga-web/tools/new-game/register.mjs --folder saga-xxx --title 사가무엇 --port 8796 \
 *        --save-base saga-xxx/save --origin "원작 오마주 한 줄" [--dry] [--root <저장소 루트>]
 *
 * 이미 등록돼 있으면 그 파일은 건드리지 않는다(다시 돌려도 안전). --dry 는 바뀔 곳만 보여 준다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..', '..', '..'); // saga-web/tools/new-game/ → 저장소 루트

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);

const folder = arg('folder');
const title = arg('title');
const port = Number(arg('port'));
const saveBase = arg('save-base', folder ? folder + '/save' : null);
const origin = arg('origin', '(원작 오마주)');
const dry = flag('dry');
const ROOT = path.resolve(arg('root', DEFAULT_ROOT));

function die(msg) { console.error('✘ ' + msg); process.exit(1); }
if (!folder || !title || !port) {
  die('사용법: node register.mjs --folder saga-xxx --title 사가무엇 --port 8796 --save-base saga-xxx/save [--origin ".."] [--dry] [--root ..]');
}
if (!/^saga-[a-z][a-z0-9-]*$/.test(folder)) die('폴더 이름은 saga-소문자 형식: ' + folder);
if (!(port >= 1024 && port <= 65535)) die('포트가 이상하다: ' + port);
if (!/^[a-z0-9-]+\/save$/.test(saveBase)) die('세이브 키는 "<이름>/save" 형식: ' + saveBase);

const changes = []; // { file, done, note }

function editFile(rel, fn) {
  const p = path.join(ROOT, rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) { changes.push({ file: rel, done: false, note: '이미 있음(안 바꿈)' }); return; }
  if (!dry) fs.writeFileSync(p, after, 'utf8');
  changes.push({ file: rel, done: true, note: dry ? '[dry] 바뀔 예정' : '바꿈' });
}

// 1) 루트 CLAUDE.md — "다섯 판" 표에 한 줄 (CRLF 파일이라 줄바꿈은 원본 것을 그대로 쓴다)
editFile('CLAUDE.md', (s) => {
  if (s.includes('`saga-web/' + folder + '`')) return s;
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const lastRow = /\|[^\n]*\| `saga-web\/saga-realm` \|[^\n]*\|\r?\n/;
  const m = lastRow.exec(s);
  if (!m) die('CLAUDE.md 표에서 사가천하 줄을 못 찾았다 — 손으로 넣을 것');
  const row = `| ${title} | \`saga-web/${folder}\` | ${port} | ${origin} | \`${saveBase}/<프로필>\` |${eol}`;
  return s.slice(0, m.index + m[0].length) + row + s.slice(m.index + m[0].length);
});

// 2) tools/precheck.sh — js 구문 대상 기본값 + data.js md5 판 목록
editFile('tools/precheck.sh', (s) => {
  let out = s;
  const targetsLine = /(targets=\("\$@"\); \[ \$\{#targets\[@\]\} -eq 0 \] && targets=\([^)]*)(\))/;
  if (targetsLine.test(out) && !new RegExp('saga-web/' + folder + '\\b').test(out)) {
    out = out.replace(targetsLine, (whole, head, tail) => `${head} saga-web/${folder}${tail}`);
  }
  const md5Line = /(for g in saga-go saga-dungeon saga-forest saga-story saga-realm)(; do)/;
  if (md5Line.test(out) && !new RegExp('\\bfor g in [^\\n]*\\b' + folder + '\\b').test(out)) {
    out = out.replace(md5Line, (whole, head, tail) => `${head} ${folder}${tail}`);
  }
  return out;
});

// 3) tools/asset-audit/audit.py — WEB_GAMES
editFile('tools/asset-audit/audit.py', (s) => {
  const re = /WEB_GAMES = \[([^\]]*)\]/;
  const m = re.exec(s);
  if (!m) die('audit.py 에서 WEB_GAMES 를 못 찾았다 — 손으로 넣을 것');
  if (m[1].includes(`'${folder}'`)) return s;
  return s.replace(re, `WEB_GAMES = [${m[1].replace(/\s*$/, '')}, '${folder}']`);
});

// 4) saga-web/tools/content-editor/server.js — GAMES
editFile('saga-web/tools/content-editor/server.js', (s) => {
  const re = /const GAMES = \[([^\]]*)\];/;
  const m = re.exec(s);
  if (!m) die('content-editor/server.js 에서 GAMES 를 못 찾았다 — 손으로 넣을 것');
  if (m[1].includes(`'${folder}'`)) return s;
  return s.replace(re, `const GAMES = [${m[1].replace(/\s*$/, '')}, '${folder}'];`);
});

console.log(`${dry ? '[dry] ' : ''}${folder} 등록:`);
for (const c of changes) console.log(`  ${c.done ? '✓' : '·'} ${c.file} — ${c.note}`);
console.log('\n이 스크립트가 안 건드리는 것(README·HANDOFF 체크리스트에 남아 있다):');
console.log('  - C:\\swbins2\\services.json 허브 카드(별개 저장소)');
console.log('  - icons/ 를 사가마을에서 복사해 온 임시본 → 이 판 것으로');
console.log('  - PLAN.md §1 정체성·원작 오마주 채우기');
