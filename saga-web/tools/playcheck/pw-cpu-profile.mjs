// CPU 프로파일(W-0302 · W-0315 기준선) — 판 하나를 폰 흉내(390×844@2, GPU, CPU 감속)로 띄워 첫 장면에서 3초 CDP 프로파일 → 함수별 자기 시간(self) 상위 표.
//   node pw-cpu-profile.mjs <판> [--throttle=4] [--sec=3] [--scene=0] [--runs=1] [--base=http://127.0.0.1:8871/]   → 콘솔 표 + results/pw-cpu-<판>.json
//   node pw-cpu-profile.mjs <판> --accept-baseline   마지막 결과를 baseline/cpu-<판>.json 으로 굳힌다(기준선은 이 길로만 바뀐다 — 이유는 커밋 메시지에)
// 장면 들어가기는 pw-phone-budget.mjs 의 SCENES 를 그대로 쓴다(import). 서버: node serve.mjs C:/swbins/saga-web 8871 (또는 --base)
// W-0315 — 함수 키는 `이름 @원본파일`(줄·열 번호 없음 — 번들이 바뀌어 줄이 밀려도 같은 함수로 본다). ( 로 시작하는 (program)·(garbage collector)·(idle) 은 비교에서 뺀다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const g = argv.find((a) => !a.startsWith('--')) || 'saga-go', TH = +opt('throttle', 4), SEC = +opt('sec', 3), SC = +opt('scene', 0), WAIT = +opt('wait', 20), RUNS = +opt('runs', 1);   // wait = 장면 뒤 더 기다릴 초(처음 셰이더 컴파일·텍스처 올리기가 끝나게)
const BASE = opt('base', 'http://127.0.0.1:8871/').replace(/\/?$/, '/'), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RES = path.join(HERE, 'results', 'pw-cpu-' + g + '.json'), BASELINE = path.join(HERE, 'baseline', 'cpu-' + g + '.json');

if (argv.includes('--accept-baseline')) {
  const j = JSON.parse(fs.readFileSync(RES, 'utf8'));
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify({ game: g, at: j.at, gpu: j.gpu, throttle: j.throttle, runs: j.runs, rows: j.rows.map((r) => ({ key: r.key, pct: r.pct })) }, null, 1) + '\n');
  console.log('BASELINE ' + path.relative(HERE, BASELINE) + ' ← ' + j.rows.length + '줄 (' + j.at + ')');
  process.exit(0);
}

process.env.PW_BUDGET_LIB = '1';
const { SCENES, clearIntro } = await import('./pw-phone-budget.mjs');
const WEB = path.resolve(HERE, '..', '..'), marks = {};
/* dist 번들의 줄 → 원본 파일(번들이 파일 앞마다 남기는 /*@ js/… 표시) */
function srcOf(url, line) {
  const m = /(saga-[a-z]+)\/dist\/(app\d?\.js)/.exec(url);
  if (!m) { return null; }
  const k = m[1] + '/' + m[2];
  if (!marks[k]) { marks[k] = []; fs.readFileSync(path.join(WEB, m[1], 'dist', m[2]), 'utf8').split('\n').forEach((l, i) => { const x = /^\/\*@ ([^*]+)\*\//.exec(l); if (x) { marks[k].push([i, x[1]]); } }); }
  let s = null; for (const [i, f] of marks[k]) { if (i <= line) { s = f; } else { break; } }
  return s;
}

/** 한 번 재기 → { gpu, total(ms), self: Map(key → {ms, at}) } */
async function once(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없음 */ }
  const url = BASE + g + '/';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('예산'); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: TH });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }); await sleep(4000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(4000);
  await clearIntro(page);
  for (let i = 0; i <= SC; i++) { await SCENES[g][i][1](page); await clearIntro(page); await sleep(8000); await clearIntro(page); }
  await sleep(WAIT * 1000);
  const gpu = await page.evaluate(() => { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'), d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await sleep(SEC * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  await ctx.close();
  /* 자기 시간 — 표본 수 × 간격. 키 = 함수 이름 @원본 파일(줄 번호 없음) · at = 처음 본 자리(참고용) */
  const byId = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map(), dt = profile.timeDeltas || [];
  (profile.samples || []).forEach((id, i) => {
    const cf = byId.get(id).callFrame, key = (cf.functionName || '(익명)') + ' @' + (srcOf(cf.url || '', cf.lineNumber) || (cf.url || '').replace(BASE, ''));
    const cur = self.get(key) || { ms: 0, at: (cf.url || '').split('/').pop() + ':' + cf.lineNumber + ':' + cf.columnNumber };
    cur.ms += (dt[i] || 0) / 1000; self.set(key, cur);
  });
  return { gpu, total: (profile.endTime - profile.startTime) / 1000, self };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: true }) });
const all = [];
try { for (let k = 0; k < RUNS; k++) { all.push(await once(browser)); } } finally { await browser.close(); }
/* 여러 번이면 함수마다 % 평균(없던 회차는 0) */
const keys = new Set(); all.forEach((r) => r.self.forEach((_, k) => keys.add(k)));
const rows = [...keys].map((k) => {
  const pcts = all.map((r) => (r.self.has(k) ? r.self.get(k).ms / r.total * 100 : 0)), ms = all.map((r) => (r.self.has(k) ? r.self.get(k).ms : 0));
  const at = (all.find((r) => r.self.has(k)) || all[0]).self.get(k).at;
  return { key: k, fn: k + ' [' + at + ']', ms: Math.round(ms.reduce((a, b) => a + b, 0) / all.length), pct: +(pcts.reduce((a, b) => a + b, 0) / all.length).toFixed(1) };
}).sort((a, b) => b.pct - a.pct).slice(0, 30);
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(RES, JSON.stringify({ game: g, at: new Date().toISOString(), gpu: all[0] && all[0].gpu, throttle: TH, sec: SEC, scene: SC, runs: all.length, totalMs: Math.round(all.reduce((a, r) => a + r.total, 0) / all.length), rows }, null, 1));
rows.forEach((r) => console.log(String(r.pct).padStart(5) + '% ' + String(r.ms).padStart(6) + 'ms  ' + r.fn.slice(0, 150)));
process.exit(0);
