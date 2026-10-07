// Claude Code statusline — statusline-command.sh 를 node 한 프로세스로 옮긴 것.
// (2026-09-23) bash 판은 렌더마다 Git Bash(MSYS) bash + git + node 를 띄웠는데,
// Claude Code 가 렌더를 버리고 부모를 끝내도 bash·git 이 안 끝나고 남아
// 하루 만에 bash 97개 + git 11개가 쌓였다(node 쪽은 09-21 수정으로 멈춘 상태였다).
// 여기서는 자식 프로세스를 하나도 안 띄우고(브랜치는 .git/HEAD 를 직접 읽음),
// 무슨 일이 있어도 2초 뒤엔 스스로 끝난다.
// 정본 = 저장소 tools/claude-home/statusline.js — install.js 가 ~/.claude 로 복사한다.
// K-0079: saga 저장소(위로 tools/autorun/run.mjs 가 있는 곳) 안 세션이면 문맥 % 를 tools/autorun/_ctx/<session>.json 에 남긴다
// (훅 ctx-guard.js 가 읽는다 — 훅 입력엔 문맥 % 가 없다). 쓰기 실패해도 상태줄은 그대로 그린다.
'use strict';
const fs = require('fs');
const path = require('path');

setTimeout(() => process.exit(0), 2000).unref();

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', () => render(buf));
process.stdin.on('error', () => render(buf));

function gitBranch(dir) {
  try {
    let d = path.resolve(dir);
    for (;;) {
      const g = path.join(d, '.git');
      if (fs.existsSync(g)) {
        let gitDir = g;
        if (fs.statSync(g).isFile()) {
          const m = /gitdir:\s*(.+)/.exec(fs.readFileSync(g, 'utf8'));
          if (!m) return '';
          gitDir = path.resolve(d, m[1].trim());
        }
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        const m = /^ref: refs\/heads\/(.+)$/.exec(head);
        return m ? m[1] : '';
      }
      const up = path.dirname(d);
      if (up === d) return '';
      d = up;
    }
  } catch (e) { return ''; }
}

function sagaRoot(dir) {
  try {
    let d = path.resolve(dir);
    for (let i = 0; i < 12; i++) {
      if (fs.existsSync(path.join(d, 'tools', 'autorun', 'run.mjs'))) return d;
      const up = path.dirname(d);
      if (up === d) return '';
      d = up;
    }
  } catch (e) { /* 없음 */ }
  return '';
}

function writeCtx(cwd, sid, pct, model) {
  try {
    if (!cwd || !sid || !/^[\w-]{8,80}$/.test(sid)) return;
    const root = sagaRoot(cwd);
    if (!root) return;
    const dir = path.join(root, 'tools', 'autorun', '_ctx');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, sid + '.json');
    let cur = {};
    try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { cur = {}; }
    cur.pct = pct; cur.model = model || cur.model || ''; cur.ts = Date.now();
    fs.writeFileSync(f, JSON.stringify(cur));
  } catch (e) { /* 상태줄은 계속 */ }
}

function fmtTokens(n) {
  n = Number(n);
  if (!isFinite(n)) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.trunc(n));
}

function bar(pct) {
  const filled = Math.max(0, Math.min(10, Math.trunc(pct / 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function remaining(resetsAt) {
  const diff = Math.floor(Number(resetsAt) - Date.now() / 1000);
  if (!(diff > 0)) return '0m';
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function has(v) { return v !== undefined && v !== null && v !== ''; }

function render(input) {
  let o = {};
  try { o = JSON.parse(input || '{}'); } catch (e) { o = {}; }
  const get = (p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);

  const parts = [];

  const cwd = get('workspace.current_dir') || get('cwd');
  if (cwd) {
    const name = path.basename(cwd);
    const br = gitBranch(cwd);
    parts.push(br ? `[${name}] (${br})` : `[${name}]`);
  }

  const model = get('model.display_name');
  if (has(model)) parts.push(String(model));
  const effort = get('effort.level');
  if (has(effort)) parts.push(String(effort));

  const used = get('context_window.used_percentage');
  if (has(used)) {
    const pct = Math.round(Number(used));
    const tok = (Number(get('context_window.total_input_tokens')) || 0) +
                (Number(get('context_window.total_output_tokens')) || 0);
    parts.push(`CTX:[${bar(pct)}] ${fmtTokens(tok)}/${fmtTokens(get('context_window.context_window_size'))}(${pct}%)`);
    writeCtx(cwd, get('session_id'), pct, get('model.id'));
  } else {
    parts.push('CTX:--');
  }

  for (const [label, key] of [['5h', 'five_hour'], ['7d', 'seven_day']]) {
    const p = get(`rate_limits.${key}.used_percentage`);
    const r = get(`rate_limits.${key}.resets_at`);
    if (has(p) && has(r)) {
      const pct = Math.round(Number(p));
      parts.push(`${label}:[${bar(pct)}] ${pct}%(${remaining(r)})`);
    }
  }

  process.stdout.write(parts.join(' | ') + '\n', () => process.exit(0));
}
