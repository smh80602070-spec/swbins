// W-0396 촬영 — 2나락 부대 시트 「🏆 시즌」·「⚙️ 장비 숙련」 카드 (D2 근거). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-dg-w0396.mjs   → shots/w0396/party.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8879, BASE = `http://127.0.0.1:${PORT}/saga-dungeon/`;
const OUT = path.join(HERE, 'shots', 'w0396'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('시즌'); });
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(1500);
  await page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3000);
  for (let i = 0; i < 3; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 2500 }).catch(() => {}); await sleep(800); }   // 첫 장 컷신 덮개
  const info = await page.evaluate(() => {
    const S = DG.dgSeason, M = DG.gearMastery, C = DG.core, t = Date.now();
    S.record('A', 2, t); S.record('S', 1, t); S.record('B', 3, t);
    const lead = C.save.party[0], eq = lead && DG.item ? DG.item.equipped(lead) : null;
    if (eq && eq.weapon) { eq.weapon.mx = 34; }
    C.emit('changed');
    const b = document.querySelector('#dock button[data-sheet="party"]'); if (b) { b.click(); } else { DG.ui.openSheet('party'); }
    return { score: S.score(), stage: S.stageOf(S.score()).name, weapon: eq && eq.weapon ? eq.weapon.name + ' ' + M.stageOf(eq.weapon.mx) : 'none', atk: M.atkPct() };
  });
  await sleep(1200);
  const ok = await page.evaluate(() => { const h = document.querySelector('.sheet, #sheet'); const t = h ? h.textContent : ''; return { season: t.indexOf('시즌') >= 0, mastery: t.indexOf('장비 숙련') >= 0 }; });
  console.log('party', JSON.stringify(info), JSON.stringify(ok)); await sleep(400);
  await page.screenshot({ path: path.join(OUT, 'party.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
