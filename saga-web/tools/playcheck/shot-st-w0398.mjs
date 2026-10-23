// W-0398 촬영 — 4종횡 사냥터 시트 「🏯 문파」·「👑 숨은 우두머리」 카드 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-st-w0398.mjs   → shots/w0398/field.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8880, BASE = `http://127.0.0.1:${PORT}/saga-story/`;
const OUT = path.join(HERE, 'shots', 'w0398'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('문파'); });
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  for (let i = 0; i < 3; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 2500 }).catch(() => {}); await sleep(700); }
  const info = await page.evaluate(() => {
    const SE = DG.sect, HB = DG.hiddenBoss, C = DG.core;
    SE.join('sword'); SE.book().pts = 140; HB.read('field');
    C.emit('changed');
    const b = document.querySelector('#dock button[data-sheet="field"]'); if (b) { b.click(); } else { DG.ui.openSheet('field'); }
    return { sect: SE.current().name, rank: SE.rankName(SE.stageOf(140)), quest: SE.questStage() && SE.questStage().name, stele: HB.hasStele('field') };
  });
  await sleep(1200);
  const ok = await page.evaluate(() => { const t = document.body.textContent; return { sect: t.indexOf('문파') >= 0, hidden: t.indexOf('숨은 우두머리') >= 0, leave: !!document.querySelector('[data-sect="leave"]') }; });
  console.log('field', JSON.stringify(info), JSON.stringify(ok)); await sleep(400);
  await page.screenshot({ path: path.join(OUT, 'field.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
