// W-0393 촬영 — 3마을 2D 집 곁 우리(공장 시트 꼬꼬·매매 + 울타리 그림) · 시트·울타리가 실제로 그려지는지(drawBeast/drawPen true). 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-fo-w0393.mjs   → shots/w0393/pen.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8882, BASE = `http://127.0.0.1:${PORT}/saga-forest/`;
const OUT = path.join(HERE, 'shots', 'w0393'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('우리'); });
  await page.goto(BASE + '?mode=2d', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  for (let i = 0; i < 8; i++) { await page.locator('button:has-text("건너뛰기")').first().click({ timeout: 1500 }).catch(() => {}); await sleep(600); }
  const moved = await page.evaluate(() => {
    const V = DG.village, s = V.state();
    s.livestock = { pen: true, list: [{ kind: 'chick', heart: 2 }, { kind: 'goat', heart: 1 }, { kind: 'chick', heart: 0 }] };
    // 집 곁으로 — 알려진 꼴만 시도(실패해도 촬영은 한다)
    let home = null; try { const P = s.props; const list = Array.isArray(P) ? P : Object.values(P || {}); home = list.find((p) => p && p.kind === 'home') || null; } catch (e) { /* */ }
    let pos = null; try { pos = s.player && typeof s.player.x === 'number' ? s.player : (DG.core.save.player && DG.core.save.player.pos) || null; } catch (e) { /* */ }
    if (home && pos) { pos.x = home.x + 1.2; pos.y = home.y + 1.0; }
    DG.core.emit('changed');
    return { home: !!home, pos: !!pos };
  });
  await sleep(3500);   // 시트·울타리 그림 받기
  const probe = await page.evaluate(() => {
    const LS = DG.livestock, c = document.createElement('canvas'); c.width = 160; c.height = 120; const ctx = c.getContext('2d');
    const beast = LS.drawBeast(ctx, { kind: 'chick' }, 80, 100, 1, false, performance.now(), 1), goat = LS.drawBeast(ctx, { kind: 'goat' }, 80, 100, -1, true, performance.now(), 1), pen = LS.drawPen(ctx, 80, 110, 100, 40, 1);
    return { beast, goat, pen };
  });
  console.log('pen', JSON.stringify(moved), JSON.stringify(probe)); await sleep(300);
  await page.screenshot({ path: path.join(OUT, 'pen.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
