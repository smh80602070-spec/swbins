// 배포 확인(W-0258) — 공개 Pages 주소에서 판을 실제 사용자처럼: 서비스 워커를 켠 새 브라우저로
//   첫 방문 → 가입(이름·동의·시작) → 판별 첫 관문 → 들어감 → ☰ 메뉴 → 첫 칸 창 → 새로 고침 → 이어하기 → 다시 들어감
//   + 배포된 sw.js VERSION 이 로컬과 같은지(다르면 아직 배포 전 — 푸시 뒤 몇 분 지연).
//   node pw-deploy.mjs [판…] [--base https://…/saga-web/]   → results/pw-deploy.json · shots/deploy/<판>.png
// 한계: 이 PC 의 네트워크에서 본다 — 사용자 기기·회사망의 차단(“사이트에 연결할 수 없음”)은 못 잡는다.
// 공개 주소엔 GET 과 브라우저 저장소만 쓴다(판엔 서버 저장이 없다). 크롬은 스스로 닫는다.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearOverlays, beforeShot } from './overlay.mjs';   // W-0317 ⑦ 가리는 창 공용

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : 'https://smh80602070-spec.github.io/swbins/saga-web/').replace(/\/?$/, '/');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.join(HERE, 'shots', 'deploy'), { recursive: true });
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });

const localVer = (g) => { const m = /var VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'saga-web', g, 'sw.js'), 'utf8')); return m ? m[1] : null; };

/** 들어갔나 — 가입 카드 없음 · 부팅 지킴 띠 없음 · 독 보임 */
const inGame = (page) => page.evaluate(() => {
  const g = document.getElementById('boot-guard'), d = document.getElementById('dock');
  const shown = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');   // fixed 라 offsetParent 는 늘 null
  return !document.querySelector('#acc-host.show') && !shown(g) && (shown(d) || shown(document.getElementById('campaign')));   // 5천하 W-0450 장 흐름은 #campaign 이 독을 덮는다
});
/** 이야기 장면·안내 카드 걷기(판마다 첫 장면이 다르다) */
/** 판별 첫 관문 */
async function firstGate(page, g) {
  if (g === 'saga-realm') {
    await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
    await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000);
  } else if (g === 'saga-dungeon') {
    await page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500);
  }
  await clearOverlays(page, g);
}

async function one(browser, g) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });   // 서비스 워커 켬(사용자와 같게)
  const page = await ctx.newPage();
  try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없어도 된다 */ }
  const errors = [], bad = [], steps = [];
  page.on('pageerror', (e) => errors.push('EXC ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|license\.json/.test(m.text())) { errors.push('console ' + m.text().slice(0, 200)); } });
  page.on('response', (r) => { if (r.status() >= 400 && !/license\.json|favicon/.test(r.url())) { bad.push(r.status() + ' ' + r.url().replace(BASE, '')); } });
  const url = BASE + g + '/';
  const step = async (name, fn) => { const t = Date.now(); let ok = false, why = ''; try { ok = !!(await fn()); } catch (e) { why = e.message.slice(0, 160); } steps.push({ name, ok, ms: Date.now() - t, why }); return ok; };
  let ver = null, covered = [];
  try {
    await step('첫 방문', async () => { const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000); return r && r.status() < 400; });
    await step('가입', async () => {
      if (!(await page.evaluate(() => !!document.querySelector('#acc-host.show input[type=text]')))) { return false; }
      await page.fill('#acc-host input[type=text]', '배포확인');
      await page.evaluate(() => { document.querySelectorAll('#acc-host input[type=checkbox]').forEach((c) => { if (!c.checked) { c.click(); } }); const b = [...document.querySelectorAll('#acc-host button')].find((x) => /시작/.test(x.textContent)); if (b) { b.click(); } });
      await sleep(3500);
      return !(await page.evaluate(() => !!document.querySelector('#acc-host.show')));
    });
    await step('첫 관문', async () => { await firstGate(page, g); await sleep(1500); return inGame(page); });
    await step('☰ 메뉴 → 창', async () => {
      if (!(await page.evaluate(() => { const b = document.getElementById('btn-menu'); if (b) { b.click(); } return !!document.querySelector('#menu-grid.show'); }))) { return false; }
      await page.evaluate(() => { const c = document.querySelector('#menu-grid .mg-cell'); if (c) { c.click(); } }); await sleep(1200);
      return page.evaluate(() => !!(document.querySelector('#sheet.show, #encounter.show, #detail.show, #overworld-map.show') || (DG.passiveWebUI && DG.passiveWebUI.isOpen()) || (DG.minimap && DG.minimap.isBig && DG.minimap.isBig())));
    });
    await step('새로 고침 → 이어하기', async () => {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
      await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
      await clearOverlays(page, g); await sleep(800);
      return inGame(page);
    });
    ver = await page.evaluate(async (u) => { try { const t = await (await fetch(u + 'sw.js', { cache: 'no-store' })).text(); const m = /var VERSION = '([^']+)'/.exec(t); return m ? m[1] : null; } catch (e) { return null; } }, url);
    covered = await beforeShot(page, g);
    await page.screenshot({ path: path.join(HERE, 'shots', 'deploy', g + '.png') });
  } catch (e) { errors.push('ERR ' + e.message.slice(0, 200)); }
  await ctx.close();
  const local = localVer(g);
  return { game: g, ok: steps.length === 5 && steps.every((s) => s.ok) && !errors.length && !bad.length, steps, errors: errors.slice(0, 8), bad: bad.slice(0, 8), deployed: ver, local, sameVersion: ver === local, covered };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const out = [];
try {
  for (const g of (games.length ? games : ALL)) {
    const r = await one(browser, g);
    out.push(r);
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${g} · ${r.steps.map((s) => (s.ok ? '○' : '×') + s.name).join(' ')} · 버전 ${r.sameVersion ? '같음' : '다름(배포 ' + r.deployed + ' · 로컬 ' + r.local + ')'}${r.errors.length ? ' · 오류 ' + r.errors.join(' | ') : ''}${r.bad.length ? ' · ' + r.bad.join(' | ') : ''}`);
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(HERE, 'results', 'pw-deploy.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), games: out }, null, 1));
process.exit(out.every((r) => r.ok) ? 0 : 1);
