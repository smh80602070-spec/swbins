// Playwright 공용 부분 — playwright-core + 이 PC 에 깔린 크롬(브라우저 내려받기 없음).
// 쓰는 법: import { open } from './pw.mjs'; const r = await open('saga-forest'); ... await r.close();
// 서버(node serve.mjs C:/swbins/saga-web 8871)는 사용자가 아니라 이 스크립트를 돌리는 쪽이 띄우고 끈다.
// 매번 새 컨텍스트(= 새 프로필)라 남은 세이브가 결과를 흔들지 않는다.
import { chromium } from 'playwright-core';

const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const BASE = process.env.PW_BASE || 'http://127.0.0.1:8871/';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 새 크롬(헤드리스, swiftshader)·새 컨텍스트로 연다. errors 에 페이지 예외·console.error 를 모은다 */
export async function open(game, { w = 1280, h = 720, mobile = false } = {}) {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, serviceWorkers: 'block',
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {})
  });
  const page = await ctx.newPage();
  /* 헤드리스는 document.hasFocus() 가 거짓이라, 포커스가 없으면 루프를 쉬는 판(사가종횡)이 멎는다 — 포커스를 켜 둔다 */
  try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없어도 대부분 판은 돈다 */ }
  const errors = [], notFound = [];
  page.on('response', (res) => { if (res.status() === 404) { notFound.push(res.url().replace(BASE, '')); } });
  page.on('pageerror', (e) => errors.push('EXC ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error ' + m.text().slice(0, 200)); });
  const url = (file) => BASE + game + '/' + file;
  return { browser, ctx, page, errors, notFound, url, game, async close() { await browser.close(); } };
}
