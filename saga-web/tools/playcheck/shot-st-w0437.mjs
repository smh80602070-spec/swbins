// W-0437 촬영 — 4종횡 사냥터 몰이 파도(띠·몰려온 몹)와 사냥터 시트 세트·고유 효과 줄 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-st-w0437.mjs   → shots/w0437/<wave|sheet>-<pc|phone>.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8885, BASE = `http://127.0.0.1:${PORT}/saga-story/`;
const OUT = path.join(HERE, 'shots', 'w0437'); fs.mkdirSync(OUT, { recursive: true });
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
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('몰이'); });
    await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
    for (let i = 0; i < 3; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 2500 }).catch(() => {}); await sleep(700); }
    await page.evaluate(() => { if (!DG.side.enter('field')) { DG.side.enter('field', DG.sideData.stage('field')); } }); await sleep(2000);
    const info = await page.evaluate(() => { const run = DG.side.raw(), hw = DG.huntWave.start(run, DG.side.fx()); return { wave: hw.i, n: DG.huntWave.alive(run) }; });
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, 'wave-' + kind + '.png') });
    await page.evaluate(() => { const G = DG.gear, w = { weapon: { key: 'u_sword' }, ring: { key: 'ring3' }, necklace: { key: 'neck3' }, earring: { key: 'ear3' }, glove: { key: 'glv3' } }; G.equipped = () => w; G.defOf = () => ({ need: 1 }); DG.core.emit('changed'); const b = document.querySelector('#dock button[data-sheet="field"]'); if (b) { b.click(); } else { DG.ui.openSheet('field'); } });
    await sleep(1200);
    await page.evaluate(() => { const el = [...document.querySelectorAll('h4')].find((h) => /세트/.test(h.textContent)); if (el) { el.scrollIntoView(); } });
    await sleep(400);
    await page.screenshot({ path: path.join(OUT, 'sheet-' + kind + '.png') });
    console.log(kind, JSON.stringify(info), 'errors', errs.length, errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
