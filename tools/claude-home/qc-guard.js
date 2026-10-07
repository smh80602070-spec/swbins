// QC 자동 실행 훅(사용자 10-07 "실기 요청할 때 자동으로 돌리는 거지") — Stop 훅.
//   세션이 끝내려는 마지막 말에 "실기 확인·눈 확인·확인 대기·사용자가 확인" 류가 있는데 이 세션 동안 QC(tools/qc.mjs)가 안 돌았으면
//   한 번 막고(decision block) 지시한다: 사람에게 넘기지 말고 `node tools/qc.mjs --game <판>` 을 돌려 결과와 촬영 PNG 눈 판정을 적으라고.
//   QC 가 돌았으면(tools/_out/qc-last.json 이 이 세션 시작 뒤 것) 그대로 끝낸다. 한 세션에 한 번만 막는다(되풀이 금지).
// saga 저장소 밖 세션은 아무것도 안 한다. 끄기: SAGA_QC_GUARD=0. 설치: node tools/claude-home/install.js
'use strict';
const fs = require('fs');
const path = require('path');

const WORDS = /실기\s*확인|실기에서|눈\s*확인|확인\s*대기|사용자(가|께서)?\s*(직접\s*)?(확인|봐|보고|판정)|실기기|폰에서\s*확인|확인\s*전\b|시트\s*대기/;
const SAY = '"실기 확인 대기·눈 확인" 으로 사람에게 넘기지 말 것(INTAKE §4·QC 자동). 지금 `node tools/qc.mjs --game <판>` 을 돌리고(갈래가 웹이 아니면 ' +
  '`--branch <갈래>`), tools/_out/qc-last.md 의 결과(RESULT·재미표준·FAIL 줄)와 "Claude 눈 판정 목록" 의 PNG 를 Read 로 직접 보고 ○△× 를 ' +
  '티켓 메모·features note 에 적은 뒤 끝내라. 사람 몫은 재미·손맛·그림체 고르기뿐이다.';

setTimeout(() => process.exit(0), 8000).unref();
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', () => main(buf));
process.stdin.on('error', () => main(buf));

function sagaRoot(dir) {
  let d = path.resolve(dir || '.');
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'SAGA-ARCH.md')) && fs.existsSync(path.join(d, 'tools', 'qc.mjs'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return null;
}
function lastAssistantText(transcript) {
  try {
    const lines = fs.readFileSync(transcript, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0 && i > lines.length - 400; i--) {
      if (!lines[i]) continue;
      let o; try { o = JSON.parse(lines[i]); } catch (e) { continue; }
      if (o.type !== 'assistant' || !o.message || !Array.isArray(o.message.content)) continue;
      const txt = o.message.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (txt.trim()) return txt;
    }
  } catch (e) { /* 못 읽으면 안 막는다 */ }
  return '';
}
function main(input) {
  if (process.env.SAGA_QC_GUARD === '0') return process.exit(0);
  let o; try { o = JSON.parse(input || '{}'); } catch (e) { return process.exit(0); }
  if (o.hook_event_name !== 'Stop' || o.stop_hook_active) return process.exit(0);
  const root = sagaRoot(o.cwd || process.cwd());
  if (!root) return process.exit(0);
  const stateDir = path.join(root, 'tools', 'autorun', '_ctx');
  fs.mkdirSync(stateDir, { recursive: true });
  const stF = path.join(stateDir, (o.session_id || 'nosession') + '.qc.json');
  let st = {}; try { st = JSON.parse(fs.readFileSync(stF, 'utf8')); } catch (e) { st = {}; }
  if (st.told) return process.exit(0);                         // 한 세션에 한 번만
  const text = lastAssistantText(o.transcript_path || '');
  if (!text || !WORDS.test(text)) return process.exit(0);
  let qcAt = 0; try { qcAt = Date.parse(JSON.parse(fs.readFileSync(path.join(root, 'tools', '_out', 'qc-last.json'), 'utf8')).at) || 0; } catch (e) { qcAt = 0; }
  let startAt = 0; try { startAt = fs.statSync(o.transcript_path).birthtimeMs || 0; } catch (e) { startAt = 0; }
  if (qcAt && qcAt >= startAt - 60000) return process.exit(0);  // 이 세션 중 QC 가 돌았다
  st.told = new Date().toISOString(); fs.writeFileSync(stF, JSON.stringify(st));
  process.stdout.write(JSON.stringify({ decision: 'block', reason: SAY }));
  process.exit(0);
}
