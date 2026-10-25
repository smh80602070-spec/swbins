// W-0423 촬영 — 4종횡 사냥터 콤보 킬 글·경험치 구슬·룬 화살표 창(2D) + 사냥터 시트 「🃏 괴물 카드」 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-st-w0423.mjs   → shots/w0423/<hunt|cards>-<pc|phone>.png
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
const OUT = path.join(HERE, 'shots', 'w0423'); fs.mkdirSync(OUT, { recursive: true });
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
    const info = await page.evaluate(() => {
      const run = DG.side.raw(), fx = DG.side.fx(), K = DG.comboKill, R = DG.rune, p = run.player;
      let r = null; for (let i = 0; i < 12; i++) { K.tick(run, 0.5); r = K.onKill(run, fx, { x: p.x + 90, y: p.y, w: 34 }, 20); }
      const rn = R.spawn(run); p.x = rn.x - 13; R.tick(run, 0.05); R.press(rn.seq[0], run);
      return { combo: r, orbs: run.drops.filter((d) => d.kind === 'exporb').length, rune: rn.state, box: !!document.getElementById('rune-box') };
    });
    await sleep(250);
    await page.screenshot({ path: path.join(OUT, 'hunt-' + kind + '.png') });
    await page.evaluate(() => { const run = DG.side.raw(); if (run.rune) { DG.rune.press('x', run); } DG.side.leave && DG.side.leave(); }); await sleep(1500);
    await page.evaluate(() => {
      const M = DG.mobCards, L = M.species(); M.book().c = {}; L.slice(0, 6).forEach((s, i) => { M.book().c[s.name] = i < 2 ? 5 : Math.min(4, i); });
      DG.core.emit('changed');
      const b = document.querySelector('#dock button[data-sheet="field"]'); if (b) { b.click(); } else { DG.ui.openSheet('field'); }
    }); await sleep(1200);
    const has = await page.evaluate(() => document.body.textContent.indexOf('괴물 카드') >= 0);
    await page.screenshot({ path: path.join(OUT, 'cards-' + kind + '.png') });
    console.log(kind, JSON.stringify(info), 'cards', has, 'errors', errs.length, errs.join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
