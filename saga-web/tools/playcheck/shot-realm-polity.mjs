// W-0399 ⑤ — 5천하 내 성 창 「나라」 칸·외교 시트 💍 단추 촬영(D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-realm-polity.mjs   → shots/w0399/{city,diplo}.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8877, BASE = `http://127.0.0.1:${PORT}/saga-realm/`;
const OUT = path.join(HERE, 'shots', 'w0399'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('나라'); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
  await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
  await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(3500);
  // 성 창 — 나라 칸까지 스크롤
  await page.evaluate(() => { const R = DG.rtk; DG.ui.openCity(R.citiesOf(R.me())[0]); }); await sleep(1200);
  const info = await page.evaluate(() => {
    const el = document.querySelector('[data-polity="age"]'); if (!el) { return 'no-polity-card'; }
    el.scrollIntoView({ block: 'center' });
    return { age: el.textContent, focus: document.querySelectorAll('[data-polity^="focus:"]').length, law: document.querySelectorAll('[data-polity^="law:"]').length };
  });
  console.log('city', JSON.stringify(info)); await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'city.png') });
  // 외교 시트 — 💍 단추
  await page.evaluate(() => { DG.ui.openSheet('diplo'); }); await sleep(1200);
  const d = await page.evaluate(() => { const el = document.querySelector('[data-marry]'); if (!el) { return 'no-marry-btn'; } el.scrollIntoView({ block: 'center' }); return { n: document.querySelectorAll('[data-marry]').length, first: el.textContent, disabled: el.disabled }; });
  console.log('diplo', JSON.stringify(d)); await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'diplo.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
