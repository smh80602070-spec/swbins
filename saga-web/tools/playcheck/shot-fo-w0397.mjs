// W-0397 촬영 — 3마을 집 시트 「⚗️ 물약 달이기」 카드·「🏠 계절 심사」 줄 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-fo-w0397.mjs   → shots/w0397/home.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8881, BASE = `http://127.0.0.1:${PORT}/saga-forest/`;
const OUT = path.join(HERE, 'shots', 'w0397'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('달이기'); });
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  for (let i = 0; i < 8; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 1500 }).catch(() => {}); await sleep(600); }
  const info = await page.evaluate(() => {
    const V = DG.village, Hm = DG.home, B = DG.brew, HJ = DG.homeJudge, C = DG.core, s = V.state();
    s.bag.mugwort = (s.bag.mugwort || 0) + 2; s.bag.apple = (s.bag.apple || 0) + 1; s.bag.peach = (s.bag.peach || 0) + 1;
    const hs = Hm.state(); hs.items = (hs.items || []).concat([{ key: 'mulhang', x: 0, y: 0 }]);
    B.brew('apple');
    C.emit('changed');
    const b = document.querySelector('#dock button[data-sheet="home"]'); if (b) { b.click(); } else { DG.ui.openSheet('home'); }
    return { effect: B.effectToday(), preview: HJ.preview().total, star: HJ.preview().star, season: HJ.seasonKey() };
  });
  await sleep(1200);
  for (let i = 0; i < 4; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 1000 }).catch(() => {}); await sleep(500); }
  const ok = await page.evaluate(() => { const t = document.body.textContent; return { brew: t.indexOf('물약 달이기') >= 0, judge: !!document.querySelector('[data-judge]'), btn: document.querySelectorAll('[data-brew]').length }; });
  console.log('home', JSON.stringify(info), JSON.stringify(ok)); await sleep(400);
  await page.screenshot({ path: path.join(OUT, 'home.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
