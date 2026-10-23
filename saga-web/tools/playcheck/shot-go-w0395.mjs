// W-0395 촬영 — 1만리 2D: ① 가만히 서면 바람 가닥 ③ 나 시트 「🐾 신수 일꾼」 칸 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-go-w0395.mjs   → shots/w0395/{wind,workers}.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8878, BASE = `http://127.0.0.1:${PORT}/saga-go/`;
const OUT = path.join(HERE, 'shots', 'w0395'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('바람'); });
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3500);
  const w = await page.evaluate(() => { const W = DG.windGuide; const d = W ? W.dir(DG.core.save.player.pos) : null; return { on: !!W, dir: d ? { dx: +d.dx.toFixed(2), dy: +d.dy.toFixed(2), goal: d.goal.id } : null }; });
  console.log('wind', JSON.stringify(w)); await sleep(2500);   // 가만히 1.2초 + 0.6초 → 가닥
  await page.screenshot({ path: path.join(OUT, 'wind.png') });
  // 신수 일꾼 — 가진 신수를 넣고 나 시트
  const k = await page.evaluate(() => { const C = DG.core; C.save.dex = C.save.dex || {}; C.save.dex.pets = Object.assign({}, C.save.dex.pets || {}, { pt_samjogo: 1, pt_haetae: 1, pt_cheongryong: 1 }); DG.petWorkers.collect(Date.now()); C.emit('changed'); DG.ui.openSheet('party'); return DG.petWorkers.seated(); });
  await sleep(1200);
  const ok = await page.evaluate(() => { const el = document.querySelector('[data-worker]'); if (!el) { return 'no-worker-btn'; } el.scrollIntoView({ block: 'center' }); return { n: document.querySelectorAll('[data-worker]').length, first: el.textContent }; });
  console.log('workers', JSON.stringify(k), JSON.stringify(ok)); await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'workers.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
