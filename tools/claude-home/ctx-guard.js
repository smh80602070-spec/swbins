// K-0079 문맥 넘기기 훅 — 대화 세션 문맥이 70% 를 넘으면 지금 단계를 커밋하고 멈추게 하고, 멈추면 autorun 데몬이 같은 갈래로 새 세션을 띄운다.
//   UserPromptSubmit : 프롬프트가 "<갈래> 이어해" 면 그 갈래를 기록 · 70% 넘었으면 지시 한 번
//   PostToolUse      : 70% 넘었으면 지시 한 번(한 턴이 길어 사용자 말이 안 올 때)
//   Stop             : 넘었는데 아직 지시를 못 봤으면 한 번 막고(decision block) 지시, 지시를 본 뒤 멈추면 데몬에 넘김
// 문맥 % 는 상태줄(statusline.js)이 tools/autorun/_ctx/<session>.json 에 쓴다. saga 저장소 밖 세션·갈래 모르는 세션은 아무것도 안 한다.
// 설치: node tools/claude-home/install.js (~/.claude 로 복사·훅 등록). 끄기: 환경변수 SAGA_CTX_GUARD=0 또는 install.js --uninstall.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const LIMIT = Number(process.env.SAGA_CTX_LIMIT || 70);
const PORT = Number(process.env.SAGA_AUTORUN_PORT || 8798);
const LANES = { '웹': 'web', '고돗': 'godot', '유니티': 'unity', '자체툴': 'tools' };
const SAY = `문맥이 ${LIMIT}% 를 넘었다(K-0079). 새 단계는 시작하지 말고, 지금 하던 단계를 티켓 메모에 ✔ 체크포인트로 적어 ` +
  '커밋·푸시(bash tools/push.sh)한 뒤 "넘김 — 다음 세션이 이어 감" 한 줄로 끝내라. 끝나면 autorun 이 같은 갈래로 새 세션을 띄운다.';

setTimeout(() => process.exit(0), 8000).unref();
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

function out(obj) { process.stdout.write(JSON.stringify(obj), () => process.exit(0)); }

function post(lane, sid) {
  return new Promise((res) => {
    const q = http.request({ host: '127.0.0.1', port: PORT, method: 'POST', path: `/api/run?branch=${lane}&from=${encodeURIComponent(sid.slice(0, 12))}`, timeout: 3000 },
      (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => res(r.statusCode + ' ' + b)); });
    q.on('error', (e) => res('데몬 없음: ' + e.code));
    q.on('timeout', () => { q.destroy(); res('데몬 응답 없음'); });
    q.end();
  });
}

async function main(input) {
  if (process.env.SAGA_CTX_GUARD === '0') return process.exit(0);
  let o = {};
  try { o = JSON.parse(input || '{}'); } catch (e) { return process.exit(0); }
  const sid = String(o.session_id || '');
  const root = sagaRoot(o.cwd);
  if (!root || !/^[\w-]{8,80}$/.test(sid)) return process.exit(0);
  const dir = path.join(root, 'tools', 'autorun', '_ctx');
  const f = path.join(dir, sid + '.json');
  let st = {};
  try { st = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { st = {}; }
  const save = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, JSON.stringify(st)); } catch (e) { /* 무시 */ } };
  const ev = o.hook_event_name;

  if (ev === 'UserPromptSubmit') {
    const m = /(?:사가)?\s*(웹|고돗|유니티|자체툴)\s*이어해/.exec(String(o.prompt || ''));
    if (m) { st.lane = LANES[m[1]]; save(); }
  }
  const over = Number(st.pct) >= LIMIT && st.lane;
  if (!over) return process.exit(0);

  if (ev === 'UserPromptSubmit' || ev === 'PostToolUse') {
    if (st.handoff) return process.exit(0);
    st.handoff = 'told'; save();
    return out({ hookSpecificOutput: { hookEventName: ev, additionalContext: SAY } });
  }
  if (ev === 'Stop') {
    if (!st.handoff && !o.stop_hook_active) { st.handoff = 'told'; save(); return out({ decision: 'block', reason: SAY }); }
    if (st.handoff === 'told') {
      st.handoff = 'sent'; st.sent = await post(st.lane, sid); st.sentAt = Date.now(); save();
    }
  }
  process.exit(0);
}
