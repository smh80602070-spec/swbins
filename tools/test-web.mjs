#!/usr/bin/env node
/**
 * 웹 판 헤드리스 러너 — `_test.html` 을 빈 포트에 띄워 헤드리스 크롬으로 돌리고 RESULT n/m·실패 줄을 찍는다.
 *
 *   node tools/test-web.mjs                     다섯 판 전부(all 도 같음)
 *   node tools/test-web.mjs saga-story saga-go  고른 판만
 *   --runs=N                                    판마다 N 번(기본 1). 통과·실패 이름 목록의 md5 가 다르면 DIFF
 *   --budget=ms                                 virtual-time-budget(기본 45000, 사가천하 180000)
 *   --dump                                      크롬이 뱉은 DOM 을 tools/_out/last-<판>.html 에 저장(실패 줄 원인 볼 때)
 *
 * 종료 코드: 실패 0·DIFF 없음 → 0, 아니면 1. 결과는 tools/_out/test-web.json({판:{n,m,fails,at}}).
 * 서버는 포트 0(빈 포트), 크롬은 tools/_prof/<판> 전용 프로필 — 끝나면 **그 PID 만** taskkill(사용자 크롬 안 건드림).
 * 본보기: saga-web/tools/mobile-layout/probe.js. 판 파일은 읽기만 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'saga-web');
const gameserve = require(path.join(ROOT, 'tools', 'lib', 'gameserve.js'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const BUDGET = { 'saga-realm': 180000 };
const HARD_TIMEOUT = 10 * 60 * 1000;

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => {
  const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
let games = argv.filter(a => !a.startsWith('--'));
if (!games.length || games.includes('all')) games = ALL;
const runs = Math.max(1, Number(opt.runs || 1));

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (!gameserve.handle(req, res, u, ROOT, ALL)) { res.writeHead(404); res.end(); }
});

let chrome = null, dumpN = 0;
function killChrome() {
  if (chrome && chrome.pid) {
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) { /* 이미 끝남 */ }
  }
  chrome = null;
}
process.on('exit', killChrome);
process.on('SIGINT', () => { killChrome(); process.exit(1); });

function runOnce(game, port) {
  return new Promise(resolve => {
    const prof = path.join(HERE, '_prof', game);
    fs.rmSync(prof, { recursive: true, force: true }); // 남은 세이브로 결과가 흔들리지 않게 매번 새 프로필
    fs.mkdirSync(prof, { recursive: true });
    const budget = Number(opt.budget || BUDGET[game] || 45000);
    let out = '', done = false;
    const finish = r => { if (done) return; done = true; clearTimeout(timer); killChrome(); resolve(r); };
    chrome = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', `--user-data-dir=${prof}`,
      `--virtual-time-budget=${budget}`, '--dump-dom', `http://127.0.0.1:${port}/play/${game}/_test.html`,
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    chrome.stdout.setEncoding('utf8');   // 조각 경계에서 한글이 잘려 깨지면 결과 지문(md5)이 흔들린다
    chrome.stdout.on('data', d => { out += d; });
    chrome.on('error', e => finish({ error: '크롬 실행 실패 ' + e.message }));
    chrome.on('close', () => {
      if (opt.dump) { fs.mkdirSync(path.join(HERE, '_out'), { recursive: true }); fs.writeFileSync(path.join(HERE, '_out', 'last-' + game + (opt.runs > 1 ? '-' + (dumpN++) : '') + '.html'), out); }
      const m = /<title>RESULT (\d+)\/(\d+)<\/title>/.exec(out);
      if (!m) return finish({ error: 'RESULT 없음(출력 ' + out.length + 'B)' });
      const names = [];
      const re = /<span class="(pass|fail)">(?:PASS|FAIL)<\/span>\s*([^<]*)/g;
      let x; const fails = [];
      const body = out.replace(/<script[\s\S]*?<\/script>/g, ''); // 소스 안의 리터럴을 줄로 오인하지 않게
      while ((x = re.exec(body))) { names.push(x[1] + ' ' + x[2].trim()); if (x[1] === 'fail') fails.push(x[2].trim()); }
      finish({ n: Number(m[1]), m: Number(m[2]), fails, md5: crypto.createHash('md5').update(names.join('\n')).digest('hex').slice(0, 8) });
    });
    const timer = setTimeout(() => finish({ error: '10분 시간 초과' }), HARD_TIMEOUT);
  });
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const result = {}; let bad = false;
  for (const g of games) {
    if (!ALL.includes(g) || !fs.existsSync(path.join(ROOT, g, '_test.html'))) { console.log(`${g} 모르는 판`); bad = true; continue; }
    const rs = [];
    for (let i = 0; i < runs; i++) rs.push(await runOnce(g, port));
    const err = rs.find(r => r.error);
    if (err) { console.log(`${g} FAIL ${err.error}`); result[g] = { n: 0, m: 0, fails: [err.error], at: new Date().toISOString() }; bad = true; continue; }
    const same = rs.every(r => r.md5 === rs[0].md5);
    const r = rs[rs.length - 1];
    console.log(`${g} RESULT ${r.n}/${r.m} runs=${runs} ${same ? 'SAME' : 'DIFF ' + rs.map(x => x.md5).join(',')}`);
    const fails = [...new Set(rs.flatMap(x => x.fails))];
    fails.forEach(f => console.log('  FAIL ' + f));
    result[g] = { n: r.n, m: r.m, fails, at: new Date().toISOString() };
    if (fails.length || !same || r.n !== r.m) bad = true;   // W-0123 — 제목 RESULT 가 n<m 인데 FAIL 줄을 못 찾아도(설명 글 속 FAIL 등) 실패로
  }
  const outDir = path.join(HERE, '_out');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'test-web.json');
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 처음 */ }
  fs.writeFileSync(file, JSON.stringify(Object.assign(prev, result), null, 1));
  server.close();
  killChrome();
  process.exit(bad ? 1 : 0);
})();
