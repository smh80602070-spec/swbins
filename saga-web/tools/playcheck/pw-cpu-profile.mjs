// CPU 프로파일(W-0302) — 판 하나를 폰 흉내(390×844@2, GPU, CPU 감속)로 띄워 첫 장면에서 3초 CDP 프로파일 → 함수별 자기 시간(self) 상위 표.
//   node pw-cpu-profile.mjs <판> [--throttle=4] [--sec=3] [--scene=0]   → 콘솔 표 + results/pw-cpu-<판>.json
// 장면 들어가기는 pw-phone-budget.mjs 의 SCENES 를 그대로 쓴다(import). 서버: node serve.mjs C:/swbins/saga-web 8871
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const g = argv.find((a) => !a.startsWith('--')) || 'saga-go', TH = opt('throttle', 4), SEC = opt('sec', 3), SC = opt('scene', 0), WAIT = opt('wait', 20);   // wait = 장면 뒤 더 기다릴 초(처음 셰이더 컴파일·에셋 받기가 끝난 뒤를 잰다)
const BASE = 'http://127.0.0.1:8871/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.env.PW_BUDGET_LIB = '1';
const { SCENES, clearIntro } = await import('./pw-phone-budget.mjs');
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required'] });
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
await sleep(WAIT * 1000); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await sleep(SEC * 1000);
const { profile } = await cdp.send('Profiler.stop');
await browser.close();
/* dist 번들의 줄 → 원본 파일(번들이 파일 앞마다 남기는 /*@ js/… 표시) */
const WEB = path.resolve(HERE, '..', '..'), marks = {};
function srcOf(url, line) {
  const m = /(saga-[a-z]+)\/dist\/(app\d?\.js)/.exec(url);
  if (!m) { return null; }
  const k = m[1] + '/' + m[2];
  if (!marks[k]) { marks[k] = []; fs.readFileSync(path.join(WEB, m[1], 'dist', m[2]), 'utf8').split('\n').forEach((l, i) => { const x = /^\/\*@ ([^*]+)\*\//.exec(l); if (x) { marks[k].push([i, x[1]]); } }); }
  let s = null; for (const [i, f] of marks[k]) { if (i <= line) { s = f; } else { break; } }
  return s;
}
/* 자기 시간 — 표본 수 × 간격. 노드 id → (함수, 파일:줄) */
const byId = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map();
const dt = profile.timeDeltas || [], total = (profile.endTime - profile.startTime) / 1000;
(profile.samples || []).forEach((id, i) => { const n = byId.get(id), cf = n.callFrame, key = (cf.functionName || '(익명)') + ' @' + (srcOf(cf.url || '', cf.lineNumber) || (cf.url || '').replace(BASE, '')) + ' [' + (cf.url || '').split('/').pop() + ':' + cf.lineNumber + ':' + cf.columnNumber + ']'; self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000); });
const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, ms]) => ({ fn: k, ms: Math.round(ms), pct: +(ms / total * 100).toFixed(1) }));
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'pw-cpu-' + g + '.json'), JSON.stringify({ game: g, throttle: TH, sec: SEC, scene: SC, totalMs: Math.round(total), rows }, null, 1));
rows.forEach((r) => console.log(String(r.pct).padStart(5) + '% ' + String(r.ms).padStart(6) + 'ms  ' + r.fn.slice(0, 150)));
process.exit(0);
