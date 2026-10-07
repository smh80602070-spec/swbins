#!/usr/bin/env node
/**
 * 무인 기동 러너 — K-0074. 사람이 "이어해" 를 치지 않아도 갈래 큐를 돈다(사용자 10-05 "완전 자동화 — 여러 에이전트가 각자 맡은 업무").
 *
 *   node tools/autorun/run.mjs --branch tools|web|godot|unity [--max-tickets 1] [--max-minutes 120] [--budget-usd 20] [--model claude-opus-5-5] [--dry]
 *   node tools/autorun/run.mjs --selftest                 claude -p 가 이 환경(설정 폴더·로그인)에서 뜨는지 10초 시험
 *   node tools/autorun/run.mjs --register tools [--at 02:30]   Windows 작업 스케줄러에 매일 등록(사용자가 시킬 때만) · --unregister tools
 *
 * 한 번 기동 = ① STOP 파일(tools/autorun/STOP) 있으면 종료 ② 트리가 더럽거나 origin 과 갈라졌으면 종료(남의 세션 보호)
 *   ③ 큐 맨 위 티켓이 없으면 "큐 비었음" 종료 ④ `claude -p "<갈래> 이어해"` 를 bypassPermissions·예산 상한·시간 상한으로 띄운다
 *   ⑤ HEAD 가 안 움직였으면 멈춘다(같은 티켓을 되풀이해 토큰을 태우지 않는다) ⑥ 안 올라간 커밋이 있으면 push.
 * 로그 tools/autorun/_log/<날짜시각>-<갈래>.log(git 제외). 게이트(precheck 훅·WIP 동결)는 세션 안에서 그대로 돈다.
 * 비용 상한: --budget-usd(기본 20 달러/티켓 — 10-05 실측: 문맥 로드만으로 0.5달러를 넘는다) — claude --max-budget-usd 로 넘긴다. 설정 폴더는 CLAUDE_CONFIG_DIR 를 그대로 쓴다.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const LOG_DIR = path.join(HERE, '_log');
const STOP = path.join(HERE, 'STOP');

const BRANCHES = {
  tools: { queue: 'tasks/tools/QUEUE.md', prompt: '사가자체툴 이어해', task: 'saga-autorun-tools' },
  web:   { queue: 'tasks/web/QUEUE.md',   prompt: '사가웹 이어해',    task: 'saga-autorun-web' },
  godot: { queue: 'tasks/godot/QUEUE.md', prompt: '사가고돗 이어해',  task: 'saga-autorun-godot' },
  unity: { queue: 'tasks/unity/QUEUE.md', prompt: '사가유니티 이어해', task: 'saga-autorun-unity' },
};

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const branch = opt('--branch', null) || opt('--register', null) || opt('--unregister', null);
const MAX_TICKETS = +opt('--max-tickets', 1), MAX_MIN = +opt('--max-minutes', 120), BUDGET = +opt('--budget-usd', 20);
/* 무인 티켓 실행 = Opus 5.5(10-07 사용자 — 소넷 5.5 폐지). --model 로 바꿀 수 있다 */
const MODEL = opt('--model', 'claude-opus-5-5');
const dry = has('--dry');

fs.mkdirSync(LOG_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const logPath = path.join(LOG_DIR, `${stamp}-${branch || 'selftest'}.log`);
const log = (s) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${s}`; console.log(line); fs.appendFileSync(logPath, line + '\n'); };

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
/* claude 실행 파일을 PATH 에서 직접 찾는다(이 PC 는 ~/.local/bin/claude.exe — cmd 는 'claude.cmd' 를 모른다). shell 없이 절대 경로로 띄운다 */
function findClaude() {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const names = process.platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'] : ['claude'];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const n of names) { const p = path.join(dir, n); if (dir && fs.existsSync(p)) return p; }
  }
  const local = path.join(process.env.USERPROFILE || process.env.HOME || '', '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  if (fs.existsSync(local)) return local;
  throw new Error('claude 실행 파일을 PATH·~/.local/bin 에서 못 찾음 — CLAUDE_BIN 환경 변수로 지정');
}
const claudeBin = findClaude();

function queueTop(queueRel) {
  const txt = fs.readFileSync(path.join(ROOT, queueRel), 'utf8');
  const m = txt.match(/^\| *\d+ *\| *\[([KWGU]-\d{4})\][^|]*\| *([^\n]*?) *\|\s*$/m);
  return m ? { id: m[1], status: m[2].trim() } : null;
}

function runClaude(prompt, minutes, budget, model) {
  return new Promise((resolve) => {
    const a = ['-p', prompt, '--permission-mode', 'bypassPermissions', '--max-budget-usd', String(budget), '--output-format', 'text', ...(model ? ['--model', model] : [])];
    log(`claude ${a.map((x) => (x.includes(' ') ? JSON.stringify(x) : x)).join(' ')}`);
    const child = spawn(claudeBin, a, { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(logPath, { flags: 'a' });
    child.stdout.pipe(out, { end: false }); child.stderr.pipe(out, { end: false });
    const timer = setTimeout(() => { log(`시간 상한 ${minutes}분 → 세션 종료`); child.kill(); }, minutes * 60 * 1000);
    child.on('close', (code) => { clearTimeout(timer); out.end(); resolve(code); });
  });
}

async function selftest() {
  log(`selftest: claude=${claudeBin} · CLAUDE_CONFIG_DIR=${process.env.CLAUDE_CONFIG_DIR || '(없음 → 기본 ~/.claude)'}`);
  /* 첫 요청만으로 프로젝트 문맥(CLAUDE.md·메모리·훅)이 실려 0.5달러를 넘는다(10-05 실측) → 하이쿠·3달러 */
  const code = await runClaude('답은 숫자 하나만: 3+4', 3, 3, 'claude-haiku-4-5-20251001');
  const tail = fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-2).join(' | ');
  log(`selftest exit=${code} → ${tail}`);
  process.exit(code === 0 ? 0 : 4);
}

function register(name, unregister) {
  const b = BRANCHES[name];
  if (!b) { console.error('갈래: tools|web|godot|unity'); process.exit(2); }
  if (unregister) {
    execFileSync('schtasks', ['/Delete', '/TN', b.task, '/F'], { stdio: 'inherit' });
    log(`작업 스케줄러에서 뺌: ${b.task}`); return;
  }
  const at = opt('--at', '02:30');
  /* 계정 = 설정 폴더(이 PC 의 PowerShell 함수 claude2 는 claude.exe + CLAUDE_CONFIG_DIR=~/.claude-account2). 작업 스케줄러에는 그 값을 박아 둔다 */
  const cfgDir = opt('--config-dir', process.env.CLAUDE_CONFIG_DIR || '');
  const cfg = cfgDir ? `set CLAUDE_CONFIG_DIR=${cfgDir}&& ` : '';
  const tr = `cmd /c "${cfg}node ${path.join(HERE, 'run.mjs')} --branch ${name} --max-tickets ${MAX_TICKETS}"`;
  execFileSync('schtasks', ['/Create', '/SC', 'DAILY', '/ST', at, '/TN', b.task, '/TR', tr, '/F'], { stdio: 'inherit' });
  log(`작업 스케줄러 등록: ${b.task} 매일 ${at} → ${tr}`);
}

async function main() {
  if (has('--selftest')) return selftest();
  if (has('--register') || has('--unregister')) return register(branch, has('--unregister'));
  const b = BRANCHES[branch];
  if (!b) { console.error('사용법: node tools/autorun/run.mjs --branch tools|web|godot|unity [--max-tickets 1] [--max-minutes 120] [--budget-usd 20] [--dry]'); process.exit(2); }
  if (fs.existsSync(STOP)) { log('STOP 파일 있음 → 안 돈다'); process.exit(2); }
  const dirty = git('status', '--porcelain');
  if (dirty && !dry) { log(`트리가 더럽다(${dirty.split('\n').length}줄, 다른 세션 것일 수 있다) → 안 돈다`); process.exit(3); }
  if (dirty) log(`(dry) 트리가 더럽다(${dirty.split('\n').length}줄) — 실제 기동이면 여기서 멈춘다, 파싱은 계속`);
  try { git('fetch', '-q', 'origin'); } catch (e) { log('fetch 실패: ' + e.message.split('\n')[0]); }
  const behind = +git('rev-list', '--count', 'HEAD..origin/main'), ahead = +git('rev-list', '--count', 'origin/main..HEAD');
  if (ahead > 0 && behind > 0) { log(`origin 과 갈라짐(ahead ${ahead}, behind ${behind}) → 안 돈다`); process.exit(3); }
  if (behind > 0) { git('pull', '-q', '--ff-only', 'origin', 'main'); log(`origin 따라감(${behind})`); }
  for (let n = 1; n <= MAX_TICKETS; n++) {
    const top = queueTop(b.queue);
    if (!top) { log('큐 비었음 → 종료'); break; }
    const before = git('rev-parse', 'HEAD');
    log(`#${n} 큐 맨 위 ${top.id} [${top.status.slice(0, 60)}] → "${b.prompt}"`);
    if (dry) { log('(dry) 세션은 안 띄움'); break; }
    const code = await runClaude(b.prompt, MAX_MIN, BUDGET, MODEL);
    const after = git('rev-parse', 'HEAD');
    log(`세션 끝 exit=${code} · 커밋 ${before.slice(0, 8)} → ${after.slice(0, 8)}`);
    if (after === before) { log('HEAD 가 안 움직였다(사람 대기·막힘) → 되풀이 안 함'); break; }
    if (+git('rev-list', '--count', 'origin/main..HEAD') > 0) {
      try { git('push', '-q', 'origin', 'main'); log('push'); } catch (e) { log('push 실패: ' + e.message.split('\n')[0]); break; }
    }
  }
  log('끝');
}
main().catch((e) => { log('오류 ' + (e.stack || e)); process.exit(4); });
