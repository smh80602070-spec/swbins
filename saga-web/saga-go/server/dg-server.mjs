/**
 * 사가고 온라인 모드 서버
 * ---------------------------------------------------------------
 * 하는 일이 두 가지뿐이다.
 *
 *   1) 게임 파일을 그대로 내려 준다 (정적 서버)
 *   2) /dg-ai/* 로 오는 요청을 Claude 에게 넘기고, **토큰 사용량을 돌려준다**
 *
 * API 키는 **여기(서버)에만** 둔다. 브라우저에 키를 심으면 그 순간 공개되므로,
 * 게임은 절대 Anthropic 을 직접 부르지 않고 이 서버를 통해서만 부른다.
 *
 * 키 조달: 환경변수 ANTHROPIC_API_KEY, 또는 `ant auth login` 프로필.
 *          (SDK 가 알아서 찾는다 — 이 파일에 키를 적지 않는다)
 *
 * 실행:  node server/dg-server.mjs            → http://127.0.0.1:8790
 *        PORT=9000 node server/dg-server.mjs
 *        HOST=0.0.0.0 node server/dg-server.mjs  ← 폰에서 붙일 때
 *
 * 오프라인으로 그냥 놀 때 쓰는 정적 서버는 따로 있다 — run.bat / start_server.bat 의
 * python http.server 8791. AI(사관)를 쓰려면 그쪽 대신 이 서버(8790)로 접속한다.
 *
 * 게임을 같은 출처에서 내려 주므로 CORS 도, 서비스 워커 예외도 필요 없다.
 *
 * https: server/certs/dg-server.{crt,key} 가 있으면 **자동으로 https 로 뜬다.**
 *        아이폰 사파리는 안전하지 않은 출처에서 위치 API 를 막으므로,
 *        폰에서 GPS 를 쓰려면 https 가 필요하다 (→ node server/make-cert.mjs).
 */

import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '127.0.0.1';   // 폰에서 붙일 때만 0.0.0.0

/* ── 모델 · 단가 ────────────────────────────────────────────────
 * 단가는 게임 안에서 '천기(天機)' 를 깎는 데 쓴다. 모델을 바꾸면 여기도 바꾼다.
 * (2026-06 기준 Claude Opus 5: 입력 $5 / 출력 $25 per 1M)
 */
const MODEL = process.env.DG_MODEL || 'claude-opus-5';
const PRICE = {
  in: 5 / 1e6,
  out: 25 / 1e6,
  cacheRead: 0.5 / 1e6,      // 입력의 0.1배
  cacheWrite: 6.25 / 1e6     // 입력의 1.25배
};

/** 하루에 이 금액(USD)까지만 쓴다. 서버가 마지막 방어선이다. */
const DAILY_CAP = Number(process.env.DG_DAILY_CAP || 0.5);

const client = new Anthropic();

/* ── 사용량 장부 ────────────────────────────────────────────────
 * 게임 쪽(브라우저)에도 잔량을 두지만 그건 표시용이다.
 * 실제 한도는 서버가 잡는다 — 클라이언트 숫자는 못 믿는다.
 */
const LEDGER = path.join(HERE, 'usage.json');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readLedger() {
  try {
    const j = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    if (j.day !== today()) { return { day: today(), cost: 0, calls: 0, inTok: 0, outTok: 0 }; }
    return j;
  } catch {
    return { day: today(), cost: 0, calls: 0, inTok: 0, outTok: 0 };
  }
}

function writeLedger(l) {
  try { fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2)); } catch { /* 장부는 있으면 좋고 */ }
}

function costOf(u) {
  return (u.input_tokens || 0) * PRICE.in
    + (u.output_tokens || 0) * PRICE.out
    + (u.cache_read_input_tokens || 0) * PRICE.cacheRead
    + (u.cache_creation_input_tokens || 0) * PRICE.cacheWrite;
}

/* ── 프롬프트 ───────────────────────────────────────────────────
 * 게임 상태는 클라이언트가 요약해 보낸다(js/ai.js summary). 여기서는 말투와 분량만 정한다.
 * 분량을 짧게 못 박는 이유는 그게 곧 '천기' 소모량이기 때문이다.
 *
 * 본편에 없는 것을 여기서 말하게 하면 사관이 거짓말을 한다.
 * 지금 본편의 축은 셋뿐이다 — **걷기 보급 · 조우(등용·포획) · 서당 문답**.
 * 경영(영지·태수·교역)은 삭제됐고, 던전·전투·장비·환생·방치는 js/_expansion/ 으로 빠졌다.
 */
const SYSTEM = `당신은 한국형 위치기반 게임 "사가고"의 사관(史官)입니다.
플레이어는 실제 지도를 걸으며 세 가지를 합니다.
 - 걷는다: 걸은 거리만큼 등용서·사료 같은 보급을 받는다
 - 만난다: 근처에 나타난 삼국지·한국사 인물을 설득해 등용하고, 짐승을 길들여 도감을 채운다
 - 배운다: 서당에서 문답(역사·사자성어·상식·유행어·세계사·속담)을 풀어 공적과 금을 얻는다
동행으로 데리고 다니는 인물은 레벨과 승급(★)이 오릅니다.

말투: 사극 문어체를 살짝 얹은 한국어. 과장 없이 담백하게.
분량: 요청별 지정 분량을 넘기지 마십시오. 넘기면 플레이어의 자원이 낭비됩니다.
금지: 전투·영지·던전·장비처럼 지금 이 게임에 없는 것을 권하거나 있다고 말하지 마십시오.
      수치를 지어내지 마십시오 — 주어진 형편에 적힌 숫자만 쓰십시오.`;

const KINDS = {
  // 지금 형편을 보고 다음에 뭘 할지 (걷기·수집·문답 안에서)
  advise: {
    max: 420,
    build: (p) => `다음은 지금 내 여정의 형편이다.

${p.state}

무엇을 먼저 해야 하겠는가? **세 가지**를 짚어라.
걷기·등용과 포획·서당 문답, 이 셋 안에서만 고르라.
각 항목은 한 줄(40자 내외)로, 근거를 위 숫자로 들라. 서론과 맺음말은 쓰지 마라.`
  },
  // 동행(또는 집에 있는) 인물에게 말을 건다
  talk: {
    max: 300,
    build: (p) => `아래 인물이 되어 대답하라.

이름: ${p.name} (${p.hanja || ''})
시대·세력: ${p.era} · ${p.faction}
기질: ${p.trait}
열전: ${p.bio}
지금 상태: ${p.status}

주공(플레이어)의 말: "${p.say}"

주공은 지금 지도를 걸으며 사람을 만나고 글을 익히는 중이다.
그 인물의 말투로 **두세 문장**만 답하라. 지문 없이 대사만.`
  },
  // 앞길에 대한 예언 한 줄 (길조면 잠시 보정이 붙는다 — js/ai.js OMEN_BOONS)
  omen: {
    max: 200,
    build: (p) => `천기를 읽어라.

${p.state}

앞으로 걸을 길에 대한 **예언 한 문장**과, 그에 어울리는 **길조/흉조 하나**를 말하라.
형식은 정확히 이렇게:
예언: <한 문장>
징조: <길조|흉조> <다섯 자 이내>`
  }
};

/* 확장(js/_expansion/item.js) 을 되살릴 때 KINDS 에 도로 넣을 것.
 * 지금 본편에는 장비가 없어서 빼 두었다 — 여기 남겨 두면 /dg-ai/health 가
 * 없는 기능을 있다고 광고하게 된다.
 *
 * appraise: {
 *   max: 260,
 *   build: (p) => `아래 물건을 감정하라.\n\n종류: ${p.base}\n등급: ${p.tier}\n붙은 기운: ${p.opts}\n\n` +
 *     `이 물건에 어울리는 **이름 하나**와 **유래 두 문장**을 지어라.\n형식은 정확히 이렇게:\n이름: <이름>\n유래: <두 문장>`
 * }
 */

/* ── HTTP ───────────────────────────────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'content-type': type || 'application/json; charset=utf-8',
    'cache-control': type ? 'no-cache' : 'no-store'
  });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj));
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('요청이 너무 큽니다')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleAsk(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req) || '{}');
  } catch (e) {
    sendJson(res, 400, { error: '본문을 읽지 못했습니다: ' + e.message });
    return;
  }

  const spec = KINDS[payload.kind];
  if (!spec) {
    sendJson(res, 400, { error: '알 수 없는 요청 종류: ' + payload.kind });
    return;
  }

  const ledger = readLedger();
  if (ledger.cost >= DAILY_CAP) {
    sendJson(res, 429, { error: '오늘 몫의 천기를 다 썼습니다', ledger, cap: DAILY_CAP });
    return;
  }

  try {
    // 클라이언트가 보낸 문자열은 길이를 잘라서 쓴다 (프롬프트 폭주 방지)
    const p = {};
    for (const k of Object.keys(payload.p || {})) {
      p[k] = String(payload.p[k] ?? '').slice(0, 1400);
    }

    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: spec.max,
      // 게임 대사는 짧다 — 낮은 노력으로 충분하고, 그만큼 천기를 아낀다
      output_config: { effort: 'low' },
      // 정책 거절 시 서버가 알아서 다른 모델로 이어 답하게 한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: spec.build(p) }]
    });

    let text = '';
    for (const b of msg.content) {
      if (b.type === 'text') { text += b.text; }
    }

    const u = msg.usage || {};
    const cost = costOf(u);
    ledger.cost += cost;
    ledger.calls += 1;
    ledger.inTok += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
    ledger.outTok += (u.output_tokens || 0);
    writeLedger(ledger);

    sendJson(res, 200, {
      kind: payload.kind,
      text: text.trim(),
      refused: msg.stop_reason === 'refusal',
      model: msg.model,
      usage: {
        in: u.input_tokens || 0,
        out: u.output_tokens || 0,
        cacheRead: u.cache_read_input_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0
      },
      cost: cost,
      ledger: { day: ledger.day, cost: ledger.cost, calls: ledger.calls },
      cap: DAILY_CAP
    });
  } catch (e) {
    const status = (e && e.status) || 500;
    sendJson(res, status, { error: (e && e.message) || '알 수 없는 오류', status: status });
  }
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') { rel = '/index.html'; }
  /* `/_shared/…` → saga-web/shared (통일 3D 에셋 한 벌, W-0021) */
  const base = rel.startsWith('/_shared/') ? path.resolve(ROOT, '..', 'shared') : ROOT;
  const abs = path.join(base, rel.startsWith('/_shared/') ? rel.slice('/_shared'.length) : rel);
  if (!abs.startsWith(base)) { send(res, 403, '금지', 'text/plain; charset=utf-8'); return; }
  fs.readFile(abs, (err, buf) => {
    if (err) { send(res, 404, '없습니다: ' + rel, 'text/plain; charset=utf-8'); return; }
    send(res, 200, buf, MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
  });
}

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/dg-ai/health') {
    const ledger = readLedger();
    sendJson(res, 200, {
      ok: true, model: MODEL, cap: DAILY_CAP,
      ledger: { day: ledger.day, cost: ledger.cost, calls: ledger.calls },
      kinds: Object.keys(KINDS),
      price: { in: PRICE.in * 1e6, out: PRICE.out * 1e6 }
    });
    return;
  }
  if (url.pathname === '/dg-ai/ask' && req.method === 'POST') {
    await handleAsk(req, res);
    return;
  }
  if (url.pathname.indexOf('/dg-ai/') === 0) {
    sendJson(res, 404, { error: '없는 경로' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, '허용되지 않은 메서드', 'text/plain; charset=utf-8');
    return;
  }
  serveStatic(req, res, url.pathname);
};

/* ── 기동 ────────────────────────────────────────────────────
 * 인증서가 있으면 https, 없으면 http. 폰에서 GPS 를 쓰려면 https 여야 한다.
 */
const CRT = path.join(HERE, 'certs', 'dg-server.crt');
const KEY = path.join(HERE, 'certs', 'dg-server.key');
const secure = fs.existsSync(CRT) && fs.existsSync(KEY);

const server = secure
  ? https.createServer({ cert: fs.readFileSync(CRT), key: fs.readFileSync(KEY) }, handler)
  : http.createServer(handler);

function lanIps() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const a of ifs[name] || []) {
      if (a.family === 'IPv4' && !a.internal) { out.push(a.address); }
    }
  }
  return out;
}

server.listen(PORT, HOST, () => {
  const proto = secure ? 'https' : 'http';
  console.log('사가고 서버 (' + proto + ') → ' + proto + '://127.0.0.1:' + PORT + '/index.html');
  if (HOST === '0.0.0.0') {
    for (const ip of lanIps()) {
      console.log('  폰에서 → ' + proto + '://' + ip + ':' + PORT + '/index.html');
    }
    if (!secure) {
      console.log('  ⚠️ http 라서 아이폰에서는 GPS 가 막힙니다 — node server/make-cert.mjs 로 인증서를 만드세요.');
    }
  }
  console.log('  모델 ' + MODEL + ' · 하루 한도 $' + DAILY_CAP);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ⚠️ ANTHROPIC_API_KEY 가 없습니다 — `ant auth login` 프로필을 쓰거나 키를 넣으세요.');
    console.log('     (키가 없으면 게임은 오프라인 모드로만 돌아갑니다)');
  }
});
