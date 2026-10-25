// W-0429 촬영 — 4종횡 사냥터 엘리트(어두운 막·띠·큰 몸)와 엘리트 보스(남은 초) 2D (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-st-w0429.mjs   → shots/w0429/<elite|boss>-<pc|phone>.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8883, BASE = `http://127.0.0.1:${PORT}/saga-story/`;
const OUT = path.join(HERE, 'shots', 'w0429'); fs.mkdirSync(OUT, { recursive: true });
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
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('엘리트'); });
    await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
    for (let i = 0; i < 3; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 2500 }).catch(() => {}); await sleep(700); }
    await page.evaluate(() => { if (!DG.side.enter('field')) { DG.side.enter('field', DG.sideData.stage('field')); } }); await sleep(2000);
    const info1 = await page.evaluate(() => {
      const run = DG.side.raw(), fx = DG.side.fx(), FE = DG.fieldElite; DG.core.setTune('st.fieldElite.every', 1);
      const el = FE.onKill(run, fx, { ref: { name: '잡몹' } }); DG.core.setTune('st.fieldElite.every', 300);
      return { elite: el && el.ref.name, hp: el && el.hpMax };
    });
    await sleep(700);
    await page.screenshot({ path: path.join(OUT, 'elite-' + kind + '.png') });
    const info2 = await page.evaluate(() => {
      const run = DG.side.raw(), fx = DG.side.fx(), FE = DG.fieldElite; let b = null;
      for (let k = 0; k < 3; k++) { const el = run.enemies.filter((e) => e.elite && e.hp > 0)[0]; if (el) { el.hp = 0; run.enemies.splice(run.enemies.indexOf(el), 1); b = FE.onKill(run, fx, el) || b; } if (k < 2) { DG.core.setTune('st.fieldElite.every', 1); FE.onKill(run, fx, { ref: { name: '잡몹' } }); DG.core.setTune('st.fieldElite.every', 300); } }
      return { boss: b && b.ref.name, t: b && b.eliteT };
    });
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, 'boss-' + kind + '.png') });
    const info = Object.assign({}, info1, info2);
    console.log(kind, JSON.stringify(info), 'errors', errs.length, errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
