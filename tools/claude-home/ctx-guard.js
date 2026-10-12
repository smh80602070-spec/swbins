// K-0098 자동 이어하기 훅(K-0079 를 고침) — 켜 둔 대화 세션(VS Code 등)에서 "<갈래> 이어해" 를 한 번 치면,
// 티켓을 끝내고 멈추려 할 때 같은 창·같은 대화에 다음 "이어해" 를 돌려 넣는다. 문맥 70% 면 체크포인트 커밋 후 그 창에서 멈춘다.
//   UserPromptSubmit : "<갈래> 이어해" 면 갈래 기록·자동 이어하기 켬·갈래 잠금(다른 창이 쥐고 있으면 알림만) / 다른 말이면 자동 이어하기 끔
//   PostToolUse      : 70% 넘었으면 지시 한 번 · 갈래 잠금 숨 쉬기
//   Stop             : 70% 넘었으면 한 번 막고 체크포인트 지시 → 그 뒤엔 통과·잠금 풂.
//                      70% 아래면 — 마지막 말이 질문·"⏸" 가 아니고 그 턴에 자기 갈래 티켓 번호(W-/G-/U-/K-NNNN) 커밋이 생겼을 때만 막고 다음 "이어해".
// 여러 창: 상태는 세션마다(_ctx/<session>.json), 갈래 잠금 _ctx/lane-<갈래>.lock(20분 소식 없으면 풀림) — 같은 갈래 두 창이 같은 티켓을 잡지 않게.
// 문맥 % 는 상태줄(statusline.js)이 _ctx/<session>.pct 에 쓴다. 없거나 낡으면 transcript 끝의 usage 로 셈한다.
// 저장소 밖 세션·갈래 모르는 세션은 아무것도 안 한다(입력 파싱 전에 cwd 로 거른다).
// 설치: node tools/claude-home/install.js. 끄기: SAGA_CTX_GUARD=0(전부) · SAGA_LOOP=0 또는 _ctx/LOOP-OFF 파일(이어하기만) · 문턱 SAGA_CTX_LIMIT(70).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LIMIT = Number(process.env.SAGA_CTX_LIMIT || 70);
const LOOP_MAX = Number(process.env.SAGA_LOOP_MAX || 30);
const WINDOW = Number(process.env.SAGA_CTX_WINDOW || 1000000);
const LOCK_TTL = 20 * 60000;
const KEEP_DAYS = 7;
const LANES = { '웹': 'web', '고돗': 'godot', '유니티': 'unity', '자체툴': 'tools' };
const PROMPT = { web: '사가웹 이어해', godot: '사가고돗 이어해', unity: '사가유니티 이어해', tools: '사가자체툴 이어해' };
const TICKET = { web: 'W', godot: 'G', unity: 'U', tools: 'K' };
const say70 = (lane) => `문맥이 ${LIMIT}% 를 넘었다(K-0098). 새 단계는 시작하지 말고, 지금 하던 단계를 티켓 메모에 ✔ 체크포인트로 적어 ` +
  `커밋·푸시(bash tools/push.sh)한 뒤 "⏹ 문맥 ${LIMIT}% — 새 대화에서 '${PROMPT[lane] || '<갈래> 이어해'}'" 한 줄로 끝내라. 자동 이어하기는 여기서 멈춘다.`;
const sayNext = (lane, n, pct) => `[자동 이어하기 ${n}/${LOOP_MAX} · 문맥 ${pct}%] ${PROMPT[lane]} — tasks/README.md 절차대로 ` +
  `tasks/${lane}/QUEUE.md 맨 위 티켓부터. 큐가 비었거나·막혔거나·사람 판단이 필요하면 질문하거나 마지막 줄을 "⏸ 멈춤: <이유>" 로 끝내라(그러면 안 이어 간다).`;

setTimeout(() => process.exit(0), 9000).unref();
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', () => main(buf));
process.stdin.on('error', () => main(buf));

function sagaRoot(dir) {
  let d = path.resolve(dir || '.');
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'tools', 'autorun', 'run.mjs'))) return d;
    const up = path.dirname(d);
    if (up === d) return '';
    d = up;
  }
  return '';
}

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {}; } }
function writeJson(f, o) { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); } catch (e) { /* 무시 */ } }
function out(obj) { process.stdout.write(JSON.stringify(obj), () => process.exit(0)); }

/* transcript 끝 256KB 를 거꾸로 읽어 마지막 assistant 줄들 */
function tailEntries(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size, n = Math.min(size, 262144);
    const b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, size - n);
    fs.closeSync(fd);
    const lines = b.toString('utf8').split('\n');
    const res = [];
    for (let i = lines.length - 1; i >= 1 && res.length < 40; i--) {   // 0 번 줄은 잘렸을 수 있다
      try { const e = JSON.parse(lines[i]); if (e && e.type === 'assistant' && e.message) res.push(e.message); } catch (e) { /* 건너뜀 */ }
    }
    return res;
  } catch (e) { return []; }
}

function lastText(o, msgs) {
  if (typeof o.last_assistant_message === 'string') return o.last_assistant_message;
  for (const m of msgs) {
    const t = (Array.isArray(m.content) ? m.content : []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (t.trim()) return t;
  }
  return '';
}

function pctOf(dir, sid, msgs) {
  const p = readJson(path.join(dir, sid + '.pct'));
  if (isFinite(Number(p.pct)) && Date.now() - Number(p.ts || 0) < 15 * 60000) return Number(p.pct);
  const u = (msgs.find((m) => m.usage) || {}).usage;
  if (!u) return NaN;
  const used = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);
  return Math.round((used / (Number(p.size) || WINDOW)) * 100);
}

/* 그 턴(since 이후)에 생긴 자기 갈래 티켓 번호 커밋 수 — 같은 트리 남의 창(다른 갈래) 커밋은 안 센다 */
function laneCommits(root, lane, since) {
  if (process.env.SAGA_TEST_COMMITS) return Number(process.env.SAGA_TEST_COMMITS);
  try {
    const log = execFileSync('git', ['-C', root, 'log', '-40', '--format=%ct\t%s'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const re = new RegExp(`\\b${TICKET[lane]}-\\d{4}\\b`);
    return log.split('\n').filter((l) => { const [ct, s] = l.split('\t'); return Number(ct) * 1000 >= since - 5000 && re.test(s || ''); }).length;
  } catch (e) { return 0; }
}

const QUESTION = /([?？]\s*$)|(할까요|될까요|줄까요|좋을까요|갈까요|볼까요|알려\s?주세요|골라\s?주세요|정해\s?주세요|답해\s?주세요)/;

function sweep(dir) {
  try {
    const old = Date.now() - KEEP_DAYS * 86400000;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (f !== 'LOOP-OFF' && fs.statSync(p).mtimeMs < old) fs.unlinkSync(p);
    }
  } catch (e) { /* 무시 */ }
}

async function main(input) {
  if (process.env.SAGA_CTX_GUARD === '0') return process.exit(0);
  // 저장소 밖 세션은 큰 입력(tool_response)을 파싱하기 전에 끝낸다
  const cm = /"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(input || '');
  if (!cm) return process.exit(0);
  let cwd = '';
  try { cwd = JSON.parse('"' + cm[1] + '"'); } catch (e) { return process.exit(0); }
  const root = sagaRoot(cwd);
  if (!root) return process.exit(0);
  const dir = path.join(root, 'tools', 'autorun', '_ctx');
  const sm = /"session_id"\s*:\s*"([\w-]{8,80})"/.exec(input);
  if (!sm) return process.exit(0);
  const sid = sm[1];
  const f = path.join(dir, sid + '.json');
  const st = readJson(f);
  const save = () => writeJson(f, st);
  const ev = (/"hook_event_name"\s*:\s*"(\w+)"/.exec(input) || [])[1];

  const lockFile = (lane) => path.join(dir, `lane-${lane}.lock`);
  const lockHolder = (lane) => { const l = readJson(lockFile(lane)); return l.sid && Date.now() - Number(l.ts || 0) < LOCK_TTL ? l.sid : ''; };
  const beat = () => { if (st.lane && st.owner && lockHolder(st.lane) === sid) writeJson(lockFile(st.lane), { sid, ts: Date.now() }); };

  if (ev === 'PostToolUse') {
    // 매 도구마다 불린다 — 큰 입력은 파싱하지 않고, 잠금은 1분에 한 번만 숨 쉰다
    if (!st.lane) return process.exit(0);
    if (st.owner && Date.now() - Number(readJson(lockFile(st.lane)).ts || 0) > 60000) beat();
    if (st.handoff) return process.exit(0);
    const p = readJson(path.join(dir, sid + '.pct'));
    if (!(Number(p.pct) >= LIMIT)) return process.exit(0);
    st.handoff = 'told'; save();
    return out({ hookSpecificOutput: { hookEventName: ev, additionalContext: say70(st.lane) } });
  }

  let o = {};
  try { o = JSON.parse(input || '{}'); } catch (e) { return process.exit(0); }

  if (ev === 'UserPromptSubmit') {
    const m = /(?:사가)?\s*(웹|고돗|유니티|자체툴)\s*이어해/.exec(String(o.prompt || ''));
    const ctx = [];
    if (m) {
      const lane = LANES[m[1]];
      if (st.lane && st.lane !== lane && st.owner && lockHolder(st.lane) === sid) { try { fs.unlinkSync(lockFile(st.lane)); } catch (e) { /* 없음 */ } }
      st.lane = lane; st.auto = true; st.loops = 0; st.turnTs = Date.now();
      if (st.handoff && pctOf(dir, sid, []) < LIMIT) delete st.handoff;   // /compact 등으로 문맥이 줄었으면 70% 지시를 다시 쓸 수 있게
      const h = lockHolder(lane);
      st.owner = !h || h === sid;
      if (st.owner) writeJson(lockFile(lane), { sid, ts: Date.now() });
      else ctx.push(`자동 이어하기 꺼짐(K-0098) — ${PROMPT[lane]} 갈래는 다른 창(${h.slice(0, 8)})이 자동으로 돌리는 중이다. ` +
        '같은 큐 맨 위 티켓을 잡으면 부딪치니, 시작 전에 사용자에게 한 줄로 알리고 다른 티켓인지 확인하라.');
    } else if (st.lane) {
      st.auto = false;   // 사용자가 다른 말을 쳤다 — 이 세션은 손으로 돈다
    }
    save();
    if (st.lane && !st.handoff) {
      const pct = pctOf(dir, sid, []);
      if (pct >= LIMIT) { st.handoff = 'told'; save(); ctx.push(say70(st.lane)); }
    }
    if (ctx.length) return out({ hookSpecificOutput: { hookEventName: ev, additionalContext: ctx.join('\n') } });
    return process.exit(0);
  }

  if (ev !== 'Stop' || !st.lane) return process.exit(0);
  sweep(dir);
  const msgs = tailEntries(String(o.transcript_path || ''));
  const pct = pctOf(dir, sid, msgs);
  const stop = (why) => { st.waiting = why; st.waitAt = Date.now(); save(); process.exit(0); };

  if (pct >= LIMIT) {
    if (!st.handoff) { st.handoff = 'told'; save(); return out({ decision: 'block', reason: say70(st.lane) }); }
    if (st.owner && lockHolder(st.lane) === sid) { try { fs.unlinkSync(lockFile(st.lane)); } catch (e) { /* 없음 */ } }
    st.auto = false; st.owner = false;
    return stop(`문맥 ${pct}% — 멈춤`);
  }
  if (!st.auto) return stop('손으로 도는 턴');
  if (!st.owner) return stop('다른 창이 갈래 잠금');
  beat();
  if (!isFinite(pct)) return stop('문맥 % 모름');
  if (process.env.SAGA_LOOP === '0' || fs.existsSync(path.join(dir, 'LOOP-OFF'))) return stop('이어하기 꺼짐');
  const text = lastText(o, msgs).trim();
  if (/[⏸⏹]/.test(text)) return stop('⏸ 멈춤 표시');
  if (QUESTION.test(text.slice(-300))) return stop('질문하고 멈춤');
  if (!laneCommits(root, st.lane, Number(st.turnTs || 0))) return stop('이 턴에 갈래 커밋 없음');
  if ((st.loops || 0) >= LOOP_MAX) return stop(`이어하기 상한 ${LOOP_MAX}`);
  st.loops = (st.loops || 0) + 1; st.turnTs = Date.now(); st.waiting = ''; save();
  return out({ decision: 'block', reason: sayNext(st.lane, st.loops, pct) });
}
