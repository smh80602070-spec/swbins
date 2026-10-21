// 2D 카메라 배율 세 장(W-0365) — 폰 세로(390×844 · isMobile)로 판을 띄워 공용 cam2d 배율을 def·min·max 로 바꿔 찍고 한 장(가로 셋)으로 붙인다.
//   node pw-cam2d.mjs [판…] [--base http://127.0.0.1:8871/]   → shots/cam2d_<판>.png(커밋 안 함) + results/pw-cam2d.json(판별 key·def·min·max·저장 되읽기)
//   --base 가 없으면 serve.mjs 를 빈 포트에 스스로 띄우고 끝에 끈다. 판마다 새 컨텍스트(세이브 없음). 판정에는 안 닿는다(읽기만 — 배율만 바꿈).
// 볼 것: def 에서 나와 둘레(몸 길이 3~4)가 보이나 · max 에서 몸이 화면 1/3 이하 · min 에서 화면 끝이 빈 땅/검은 밖이 아님.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';
import { clearOverlays } from './overlay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 판별 cam2d 이름·첫 관문(pw-cover 와 같은 단추) */
const ADAPT = {
  'saga-go': { key: 'field' },
  'saga-dungeon': { key: 'dungeon', gate: async (page) => { await page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((x) => x.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); } },
  'saga-forest': { key: 'village' },
  'saga-story': { key: 'side', gate: async (page) => { await page.evaluate(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; if (st) { S.enter(st.key); } }); await sleep(3000); } },
  'saga-realm': { key: 'realm', gate: async (page) => { await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); } }
};
async function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }

async function one(browser, g) {
  const A = ADAPT[g];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없음 */ }
  const r = { game: g, key: A.key, shots: [], errors: [] };
  page.on('pageerror', (e) => r.errors.push(e.message.slice(0, 160)));
  const url = BASE + g + '/';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('배율'); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
    await clearOverlays(page, g);
    if (A.gate) { await A.gate(page); await clearOverlays(page, g); }
    await sleep(1500); await clearOverlays(page, g);
    const info = await page.evaluate((k) => { const c = DG.cam2d && DG.cam2d.get(k); return c ? { def: c.def, min: c.min, max: c.max, now: c.get() } : null; }, A.key);
    if (!info) { throw new Error('cam2d "' + A.key + '" 없음'); }
    Object.assign(r, info);
    for (const [name, v] of [['def', info.def], ['min', info.min], ['max', info.max]]) {
      await page.evaluate(([k, x]) => DG.cam2d.get(k).set(x), [A.key, v]); await sleep(900);
      r.shots.push({ name, v, png: (await page.screenshot()).toString('base64') });
    }
    r.reread = await page.evaluate((k) => { const s = []; for (let i = 0; i < localStorage.length; i++) { const n = localStorage.key(i); if (/\/cam2d$/.test(n)) { s.push(n + '=' + localStorage.getItem(n)); } } return s.join(' | '); }, A.key);
    /* 한 장으로 — 가로 셋, 위에 이름표 */
    const sheet = await page.evaluate(async (T) => { const cv = document.createElement('canvas'); cv.width = 390 * 3; cv.height = 844 + 22; const g2 = cv.getContext('2d'); g2.fillStyle = '#222'; g2.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < T.length; i++) { const im = new Image(); im.src = 'data:image/png;base64,' + T[i].png; await im.decode(); g2.drawImage(im, i * 390, 22); g2.fillStyle = '#fff'; g2.font = 'bold 15px sans-serif'; g2.fillText(T[i].name + ' ×' + T[i].v, i * 390 + 8, 16); }
      return cv.toDataURL('image/png').split(',')[1]; }, r.shots);
    fs.writeFileSync(path.join(HERE, 'shots', `cam2d_${g}.png`), Buffer.from(sheet, 'base64'));
  } catch (e) { r.errors.push('중단 ' + e.message.slice(0, 160)); }
  r.shots = r.shots.map((s) => ({ name: s.name, v: s.v }));
  await ctx.close().catch(() => {});
  return r;
}

let BASE, server = null;
if (bi >= 0) { BASE = argv[bi + 1].replace(/\/?$/, '/'); } else {
  const port = await freePort();
  server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { cwd: HERE, stdio: 'ignore' });
  BASE = `http://127.0.0.1:${port}/`; await sleep(900);
}
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true }); fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const out = []; let bad = 0;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({}) });
try {
  for (const g of (games.length ? games : ALL)) {
    const r = await one(browser, g); out.push(r); const ok = !r.errors.length && r.shots.length === 3; if (!ok) { bad++; }
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${g} ${r.key} def ${r.def} min ${r.min} max ${r.max} · 저장 ${r.reread || '-'}` + (r.errors.length ? ' · ' + r.errors.slice(0, 2).join(' | ') : '') + ` → shots/cam2d_${g}.png`);
  }
} finally {
  await browser.close().catch(() => {});
  if (server) { try { server.kill(); } catch (e) { /* 이미 끝남 */ } }
}
fs.writeFileSync(path.join(HERE, 'results', 'pw-cam2d.json'), JSON.stringify({ at: new Date().toISOString(), runs: out }, null, 1) + '\n');
console.log(`PW-CAM2D 실패 ${bad} / ${out.length}`);
process.exit(bad);
