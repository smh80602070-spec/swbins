// W-0479 — 5천하 민란(치안 5 성 달 끝 굴림) 촬영. 서버는 직접 띄운다.
//   node saga-web/tools/playcheck/shot-realm-revolt.mjs   → shots/w0479/revolt.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 8878, BASE = `http://127.0.0.1:${PORT}/saga-realm/`;
const OUT = path.join(HERE, 'shots', 'w0479'); fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.join(HERE, '..', '..'), String(PORT)], { cwd: HERE, stdio: 'ignore' });
await sleep(900);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: false }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('나라'); DG.core.setTune('realm.campaign', 0); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(3000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
  await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
  await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(3500);
  const info = await page.evaluate(() => { const R = DG.rtk, st = R.state(), me = R.me(), id = R.citiesOf(me)[0], c = R.city(id); c.sec = 5; c.troops = 1000; let hit = -1; for (let m = 1; m <= 12 && hit < 0; m++) { if (DG.revolt.roll(st.scen || '194', st.year, m, id, 5)) { hit = m; } } if (hit < 0) { for (let y = st.year; y < st.year + 30 && hit < 0; y++) { for (let m = 1; m <= 12 && hit < 0; m++) { if (DG.revolt.roll(st.scen || '194', y, m, id, 5)) { st.year = y; hit = m; } } } } st.month = hit; const before = { troops: c.troops, gold: R.force(me).gold }; DG.revolt.monthly(); const lg = (DG.core.save.log || []).filter((x) => /민란/.test(x.text)).map((x) => x.text); return { lg, hit, before, after: { troops: R.city(id).troops, sec: R.city(id).sec, gold: R.force(me).gold } }; });
  console.log('revolt', JSON.stringify(info)); await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'revolt.png') });
} finally { await browser.close(); server.kill(); }
console.log('SHOT_OK', OUT);
