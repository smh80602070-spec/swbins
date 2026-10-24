// 임시(커밋 안 함) — 2나락 폰 2D: 마을·들판에서 네 방향 각 4초 걷기(키보드·조이스틱 끌기 둘) — 플레이어 화면 좌표가 가운데 근처에 머무나
import { webkit, devices } from 'playwright-core';
const B = 'http://127.0.0.1:8871/saga-dungeon/';
const OUT = 'C:/Users/Windows/AppData/Local/Temp/claude/C--swbins/d8f69dd5-86d4-4331-851c-f2d2be5f0076/scratchpad/iphone/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
await page.goto(B, { waitUntil: 'domcontentloaded' }); await sleep(6000);
await page.fill('#acc-host input[type=text]', 'QA').catch(() => {});
await page.evaluate(() => { document.querySelectorAll('#acc-host input[type=checkbox]').forEach((c) => { if (!c.checked) { c.click(); } }); const b = [...document.querySelectorAll('#acc-host button')].find((x) => /시작/.test(x.innerText)); if (b) { b.click(); } });
await sleep(3000);
await page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
await sleep(6000);
for (let k = 0; k < 8; k++) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /건너뛰기|닫기|확인/.test(x.innerText) && x.offsetParent); if (b) { b.click(); } }).catch(() => {}); await sleep(700); }
await sleep(1500);
const probe = () => page.evaluate(() => {
  const D = window.DG, T = D.town, r = T && T.raw ? T.raw() : null, p = r && r.player, V = D.dungeonView || {};
  const sp = p && V._proj ? V._proj(p.x, p.y) : null;
  return { p: p ? [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] : null, sc: sp ? [Math.round(sp.x), Math.round(sp.y)] : null, wild: !!(r && r.wild), town: !!(T && T.active && T.active()) };
});
console.log('시작', JSON.stringify(await probe()));
const keyRun = async (k, ms) => { await page.keyboard.down(k); for (let t = 0; t < ms; t += 1000) { await sleep(1000); console.log('  키', k, JSON.stringify(await probe())); } await page.keyboard.up(k); };
await keyRun('KeyD', 5000); await keyRun('KeyS', 5000); await keyRun('KeyA', 8000); await keyRun('KeyW', 8000);
await page.screenshot({ path: OUT + 'dgcam2_key.png' });
// 조이스틱 끌기(손가락) — 조작판 자리를 찾아 오른쪽 위로 6초
const joy = await page.evaluate(() => { const j = document.querySelector('#joy, .joy, #joystick, [class*=joy]'); if (!j) { return null; } const r = j.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: j.id || j.className }; });
console.log('조이스틱', JSON.stringify(joy));
if (joy) {
  const cdp = await ctx.newCDPSession(page).catch(() => null);
  await page.touchscreen.tap(joy.x, joy.y).catch(() => {});
  await page.mouse.move(joy.x, joy.y); await page.mouse.down();
  for (let i = 0; i < 6; i++) { await page.mouse.move(joy.x + 50, joy.y - 50, { steps: 3 }); await sleep(1000); console.log('  끌기', JSON.stringify(await probe())); }
  await page.mouse.up();
}
await page.screenshot({ path: OUT + 'dgcam2_joy.png' });
if (errs.length) { console.log('오류', errs.slice(0, 3).join(' | ')); }
await browser.close();
