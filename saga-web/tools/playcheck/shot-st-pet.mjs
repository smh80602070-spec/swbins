// W-0478 촬영 — 4종횡 사냥터 콤보 킬 글·경험치 구슬·룬 화살표 창(2D) + 사냥터 시트 「🃏 괴물 카드」 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-st-w0478.mjs   → shots/w0478/<hunt|cards>-<pc|phone>.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8882, BASE = `http://127.0.0.1:${PORT}/saga-story/`;
const OUT = path.join(HERE, 'shots', 'w0478'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  for (const kind of ['pc', 'phone']) {
    const phone = kind === 'phone';
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('룬'); });
    await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
    for (let i = 0; i < 3; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 2500 }).catch(() => {}); await sleep(700); }
    await page.evaluate(() => { if (!DG.side.enter('field')) { DG.side.enter('field', DG.sideData.stage('field')); } }); await sleep(2000);
    const info = await page.evaluate(() => { const run = DG.side.raw(), p = run.player; run.drops.push({ kind: 'potion', x: p.x + 120, y: p.y + 54, vy: 0, n: 3 }, { kind: 'gold', x: p.x + 160, y: p.y + 54, vy: 0, n: 5 }, { kind: 'gear', x: p.x - 140, y: p.y + 54, vy: 0 }); return { pot: DG.side.state ? 0 : 0 }; });
    await sleep(350);
    await page.screenshot({ path: path.join(OUT, 'pet-' + kind + '.png') });
    await sleep(1800);
    const after = await page.evaluate(() => { const run = DG.side.raw(); return { drops: run.drops.map((d) => d.kind), pet: !!run.pet }; });
    await page.screenshot({ path: path.join(OUT, 'pet-after-' + kind + '.png') });
    console.log(kind, JSON.stringify({ info, after }), 'errs', errs.length);
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
