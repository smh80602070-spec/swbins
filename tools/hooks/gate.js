#!/usr/bin/env node
// saga 프로젝트 훅 게이트 — .claude/settings.json 이 SessionStart·PreToolUse 에서 부른다.
// stdin 으로 훅 JSON 을 받고, 막아야 하면 exit 2(stderr 가 모델에게 전달된다).
//   SessionStart            세션 절차를 짧게 컨텍스트에 넣는다
//   PreToolUse Bash         `git commit` 이면 tools/precheck.sh 를 먼저 돌리고 실패 시 커밋을 막는다
//   PreToolUse Edit/Write   PLAN.md 에 날짜 세션 기록(`**2026-09-16 — …` 식 문단)을 넣으면 막는다
// 규칙의 근거는 SAGA-DESIGN.md §8-5·§9. 서버·브라우저는 절대 띄우지 않는다.
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch (e) { /* stdin 없음 */ }
let ev = {};
try { ev = JSON.parse(raw || '{}'); } catch (e) { process.exit(0); }

const name = ev.hook_event_name || '';
const tool = ev.tool_name || '';
const inp = ev.tool_input || {};

function block(msg) { process.stderr.write(msg + '\n'); process.exit(2); }

// 인물 변환본(저장소 밖, .gitignore)이 이 PC 에 없으면 백그라운드로 만든다 — 다른 PC 에서 git pull 뒤 손으로 안 해도 되게(K-0065·G-0022).
// setup_local.sh 는 이미 있으면 아무것도 안 하고 자기 잠금으로 겹쳐 돌지 않는다. 끄려면 환경변수 SAGA_NO_AUTOSETUP=1.
function autoSetup() {
  if (process.env.SAGA_NO_AUTOSETUP || !fs.existsSync('tools/char-forge/setup_local.sh')) return '';
  const r = spawnSync('bash', ['tools/char-forge/setup_local.sh', '--check'], { encoding: 'utf8', timeout: 5000 });
  if (r.error || r.status !== 1) return '';                                  // 1 = 빠진 트랙 있음 · 0 = 이미 있음 · 그 밖 = 건드리지 않는다
  try {
    require('child_process').spawn('bash', ['tools/char-forge/setup_local.sh', '--bg'], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) { return ''; }
  return '이 PC 에 인물 변환본(' + String(r.stdout).trim().split('\n').pop() + ')이 없어 백그라운드로 설치를 시작했다 — 로그 tools/char-forge/_out/setup_local.log, 끝나면 엔진을 한 번 열어 .import/.meta 를 만든다. 끄려면 SAGA_NO_AUTOSETUP=1.\n';
}

if (name === 'SessionStart') {
  process.stdout.write(autoSetup() + [
    'saga 세션 절차(tasks/README.md, 체제 SAGA-ARCH.md): ① 다음 일 = tasks/QUEUE.md 의 갈래(웹·고돗·유니티·자체툴) 큐 맨 위 티켓. 큐 줄이 "진행중"이면 티켓 메모 체크포인트·git status 로 다음 단계부터. 티켓과 그 "파일" 칸만 읽는다(첫 턴 20KB). PLAN·HANDOFF·HISTORY 는 티켓이 시킬 때만 절만 sed -n.',
    '② 티켓의 목표·파일·단계·검증·완료 조건 중 빈 칸이면 멈추고 보고. 상태 "초안"이면 R-0 로 티켓만 완성·커밋하고 끝(실행은 다음 세션). 큐가 비면 tasks/RECURRING.md. 새 기능은 티켓 없이 만들지 않는다.',
    '③ 검증은 티켓 명령 그대로 한 번. 3회 실패면 되돌리고 멈춘다. ④ 커밋 전 bash tools/precheck.sh (훅이 자동 실행·차단), git commit -F <파일> -- <경로>. ⑤ 세션 기록은 티켓 메모·커밋 메시지뿐. 도감 data.js 는 다섯 벌 함께 + md5. 서버·크롬은 검증 명령이 스스로 띄우고 끈다.'
  ].join('\n') + '\n');
  process.exit(0);
}

if (name === 'PreToolUse' && tool === 'Bash') {
  const cmd = String(inp.command || '');
  if (/\bgit\s+commit\b/.test(cmd) && !/precheck\.sh/.test(cmd)) {
    const r = spawnSync('bash', ['tools/precheck.sh'], { encoding: 'utf8' });
    if (r.error || r.status !== 0) {
      const lines = String(r.stdout || '').split('\n').filter(l => /FAIL|OVER|MISMATCH/.test(l));
      block('precheck 실패 — 커밋을 막았다. 고친 뒤 다시 커밋:\n' + lines.join('\n') + (r.stderr ? '\n' + r.stderr : '') + (r.error ? '\n' + r.error.message : ''));
    }
  }
  process.exit(0);
}

if (name === 'PreToolUse' && /^(Edit|Write|MultiEdit)$/.test(tool)) {
  const fp = String(inp.file_path || '');
  if (/[\\/]tasks[\\/](?:[^\\/]+[\\/])*[WGUK]-\d+\.md$/.test(fp)) {
    let size = null;
    if (typeof inp.content === 'string') size = Buffer.byteLength(inp.content);
    else if (typeof inp.new_string === 'string' && typeof inp.old_string === 'string') {
      try {
        const cur = fs.readFileSync(fp, 'utf8');
        size = Buffer.byteLength(inp.replace_all ? cur.split(inp.old_string).join(inp.new_string) : cur.replace(inp.old_string, () => inp.new_string));
      } catch (e) { /* 새 파일·못 읽음 — 커밋 전 precheck 가 다시 본다 */ }
    }
    if (size !== null && size > 6144) block('티켓은 6144B 를 넘기지 않는다(' + size + 'B) — 줄이거나 나눈다: ' + fp.split(/[\\/]/).pop());
  }
  if (/PLAN\.md$/i.test(fp)) {
    let txt = '';
    if (typeof inp.new_string === 'string') txt = inp.new_string;
    else if (typeof inp.content === 'string') txt = inp.content;
    else if (Array.isArray(inp.edits)) txt = inp.edits.map(e => e && e.new_string || '').join('\n');
    const hit = txt.split(/\r?\n/).find(l => /^\s*>?\s*\*\*20\d\d-\d\d-\d\d/.test(l) || /^#{2,4} .*(세션|이어서|다음 세션).*20\d\d-\d\d-\d\d/.test(l));
    if (hit) block('PLAN.md 에는 날짜 세션 기록을 넣지 않는다(SAGA-DESIGN §9 — 설계 층). 이 내용은 그 판 HANDOFF.md / docs/HISTORY.md 에 append 하고, PLAN 에는 바뀐 결정만 남긴다:\n  ' + hit.slice(0, 100));
  }
  process.exit(0);
}

process.exit(0);
