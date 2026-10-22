// 5천하 폰 2D 지도 무게(W-0367) — 폰 세로(390×844 · DPR 3 · CPU 4배 감속)로 지도를 띄워 잰다:
//   ① 첫 화면: #realm DOM 노드 수 · JS 힙 MB(CDP Runtime.getHeapUsage) · DOM 카운터(노드·리스너) · 성 <g.rcity> 수
//   ② 다음 달 열 번: renderMap 한 번 ms(평균·최대)·불린 수 · 다음 달 한 번 전체 ms
//   ③ 지도 끌기 30번(두 손가락 아님 — 한 손가락 끌기, CDP 터치): 그동안 renderMap 불린 수·한 번 ms · 끝난 뒤 노드 수
//   node pw-realm2d.mjs [--throttle=4] [--base http://127.0.0.1:8871/]  → 콘솔 표 + results/pw-realm2d.json(전후 견줄 때 --tag=before|after)
// 판정·게임 코드에는 안 닿는다(재기만 — renderMap 을 감싸 시간만 잰다).
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
const THROTTLE = +((argv.find((a) => a.startsWith('--throttle=')) || '--throttle=4').slice(11));
const TAG = (argv.find((a) => a.startsWith('--tag=')) || '--tag=now').slice(6);
const PROF = argv.includes('--prof') || argv.includes('--prof-render');   // --prof: 다음 달 세 번 동안 CDP CPU 프로파일 → 함수별 포함 시간(inclusive)·자기 시간 상위
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), marks = {};
/* dist 번들 줄 → 원본 파일(번들이 파일 앞마다 남기는 표시) — pw-cpu-profile.mjs 와 같은 셈 */
function srcOf(url, line) {
  const m = /(saga-[a-z]+)\/dist\/(app\d?\.js)/.exec(url);
  if (!m) { return null; }
  const k = m[1] + '/' + m[2];
  if (!marks[k]) { marks[k] = []; fs.readFileSync(path.join(WEB, m[1], 'dist', m[2]), 'utf8').split('\n').forEach((l, i) => { const x = /^\/\*@ ([^*]+)\*\//.exec(l); if (x) { marks[k].push([i, x[1]]); } }); }
  let r = null; for (const [i, n] of marks[k]) { if (i <= line) { r = n; } else { break; } }
  return r;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }

let BASE, server = null;
if (bi >= 0) { BASE = argv[bi + 1].replace(/\/?$/, '/'); } else {
  const port = await freePort();
  server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { cwd: HERE, stdio: 'ignore' });
  BASE = `http://127.0.0.1:${port}/`; await sleep(900);
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: argv.includes('--gpu') }) });   // 기본 swiftshader(다른 판 측정과 같게) — --gpu 면 실제 GPU
const res = { tag: TAG, at: new Date().toISOString(), throttle: THROTTLE, errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +((argv.find((a) => a.startsWith("--dpr=")) || "--dpr=3").slice(6)), isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });   // 씨앗 고정 mulberry32(20260824) — AI 결정이 실행마다 같게
  page.on('pageerror', (e) => res.errors.push(e.message.slice(0, 160)));
  const url = BASE + 'saga-realm/';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('무게'); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
  await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000);
  await clearOverlays(page, 'saga-realm'); await sleep(1000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  /* renderMap 감싸기 — 불린 수·ms */
  /* renderMap 은 판 안 클로저로 불려 DG.ui 를 감싸도 안 잡힌다 — #realm 통째 갈이(innerHTML)를 MutationObserver 로 센다 */
  await page.evaluate(() => { window.__rm = []; new MutationObserver((ms) => { for (const m of ms) { if (m.target.id === 'realm' && m.addedNodes.length) { window.__rm.push(1); } } }).observe(document.getElementById('realm'), { childList: true }); });
  const snap = async (name) => {
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const h = await cdp.send('Runtime.getHeapUsage'); const dc = await cdp.send('Memory.getDOMCounters').catch(() => ({}));
    const d = await page.evaluate(() => ({ realmNodes: document.querySelectorAll('#realm *').length, cities: document.querySelectorAll('#realm .rcity').length, images: document.querySelectorAll('#realm image').length, docNodes: document.getElementsByTagName('*').length }));
    const img = await page.evaluate(async () => { const urls = new Set(); document.querySelectorAll('img').forEach((e) => { if (e.currentSrc || e.src) { urls.add(e.currentSrc || e.src); } }); document.querySelectorAll('image').forEach((e) => { const h = e.getAttribute('href') || e.getAttribute('xlink:href'); if (h) { urls.add(new URL(h, location.href).href); } }); document.querySelectorAll('*').forEach((e) => { const b = getComputedStyle(e).backgroundImage; const m = b && b.match(/url\("?([^")]+)"?\)/); if (m) { urls.add(new URL(m[1], location.href).href); } }); let px = 0, n = 0, big = []; for (const u of urls) { if (/^data:image\/svg/.test(u)) { continue; } const im = new Image(); im.src = u; try { await im.decode(); } catch (e) { continue; } n++; px += im.naturalWidth * im.naturalHeight; big.push([u.split('/').slice(-2).join('/'), im.naturalWidth + 'x' + im.naturalHeight]); } big.sort((a, b) => { const f = (s) => s[1].split('x').reduce((x, y) => x * y, 1); return f(b) - f(a); }); return { n, decodedMB: +(px * 4 / 1048576).toFixed(1), top: big.slice(0, 6) }; });
    return { name, img, heapMB: +(h.usedSize / 1048576).toFixed(1), nodes: dc.nodes, listeners: dc.jsEventListeners, ...d };
  };
  const stat = (a) => a.length ? { n: a.length, avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), max: +Math.max(...a).toFixed(1) } : { n: 0 };
  res.render = await page.evaluate(async () => { for (let k = 0; k < 5; k++) { DG.ui.renderMap(); } const a = []; for (let k = 0; k < 10; k++) { await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30))); const t = performance.now(); DG.ui.renderMap(); a.push(performance.now() - t); } a.sort((x, y) => x - y); return { med: +a[5].toFixed(1), min: +a[0].toFixed(1), max: +a[9].toFixed(1) }; });   // 데우기 다섯 번 뒤 프레임마다 한 번씩 열 번(첫 몇 번은 JIT 전이라 3~4배 — 출렁임이 커서) · 힙 스냅 전에
  res.first = await snap('첫 화면');
  /* 지도 한 번 그리기(renderMap 직접 다섯 번 — 다음 달 계산 빼고 그리기만) ms */
  /* 다음 달 한 번에 renderMap 이 몇 번 불리나 — 판 안 클로저 호출이라 DG.ui 를 감싸도 안 잡혀 #realm 갈이를 센다(아래 __rm) */
  if (PROF) {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
    if (argv.includes('--prof-render')) { await page.evaluate(() => { for (let k = 0; k < 10; k++) { DG.ui.renderMap(); } }); } else { for (let k = 0; k < 3; k++) { await page.evaluate(() => { const b = document.querySelector('[data-act="next-month"]'); if (b && !b.disabled) { b.click(); } }); await sleep(400); await clearOverlays(page, 'saga-realm'); } }   // --prof-render: 지도 그리기만 열 번
    const { profile } = await cdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map(), self = new Map(), incl = new Map(), dt = profile.timeDeltas || [];
    profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
    const keyOf = (n) => (n.callFrame.functionName || '(익명)') + ' @' + (srcOf(n.callFrame.url || '', n.callFrame.lineNumber) || (n.callFrame.url || '').split('/').pop());
    (profile.samples || []).forEach((id, i) => { const ms = (dt[i] || 0) / 1000, n0 = byId.get(id); const k0 = keyOf(n0); self.set(k0, (self.get(k0) || 0) + ms);
      const seen = new Set(); for (let n = n0; n; n = byId.get(parent.get(n.id))) { const k = keyOf(n); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + ms); } } });
    const top = (m) => [...m.entries()].filter(([k]) => !/^\(/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => [k, +v.toFixed(0)]);
    res.prof = { totalMs: +((profile.endTime - profile.startTime) / 1000).toFixed(0), incl: top(incl), self: top(self) };
    console.log('포함 시간 상위:'); res.prof.incl.forEach((x) => console.log('  ', x[1] + 'ms', x[0]));
    console.log('자기 시간 상위:'); res.prof.self.slice(0, 10).forEach((x) => console.log('  ', x[1] + 'ms', x[0]));
  }
  /* ② 다음 달 열 번 — 단추를 직접 누름(같은 손잡이) */
  const months = [];
  for (let k = 0; k < 10; k++) {
    await page.evaluate(() => { window.__rm = []; });
    const t0 = Date.now();
    const ok = await page.evaluate(() => { const b = document.querySelector('[data-act="next-month"]'); if (!b || b.disabled) { return -1; } const t = performance.now(); b.click(); return +(performance.now() - t).toFixed(1); });   /* 다음 달 손잡이 한 번(동기 — 달 계산 + 지도·윗줄·시트 다시 그리기) ms */
    await sleep(600); await clearOverlays(page, 'saga-realm');
    const rm = await page.evaluate(() => window.__rm.slice());
    months.push({ clickMs: ok, wallMs: Date.now() - t0, renders: rm.length });
  }
  res.months = months;
  res.month = { renders: months.reduce((a, m) => a + m.renders, 0), click: stat(months.map((m) => m.clickMs).filter((x) => x >= 0)) };
  res.afterMonths = await snap('다음 달 열 번 뒤');
  /* ③ 지도 끌기 — 한 손가락으로 30번 왔다갔다 */
  await page.evaluate(() => { window.__rm = []; });
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const t1 = Date.now();
  for (let k = 0; k < 30; k++) { const dx = (k % 2 ? -1 : 1) * 120; await T('touchStart', [[195, 420]]); for (let s = 1; s <= 4; s++) { await T('touchMove', [[195 + dx * s / 4, 420 + dx * s / 8]]); } await T('touchEnd', []); }
  res.drag = { wallMs: Date.now() - t1, renders: (await page.evaluate(() => window.__rm.length)) };
  res.afterDrag = await snap('끌기 뒤');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
} catch (e) { res.errors.push('중단 ' + e.message.slice(0, 200)); }
await browser.close().catch(() => {});
if (server) { try { server.kill(); } catch (e) { /* 이미 끝남 */ } }
const F = path.join(HERE, 'results', 'pw-realm2d.json');
let all = {}; try { all = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) { /* 처음 */ }
all[TAG] = res; fs.mkdirSync(path.dirname(F), { recursive: true }); fs.writeFileSync(F, JSON.stringify(all, null, 1) + '\n');
const f = res.first || {}, a = res.afterDrag || {};
console.log(`[${TAG}] 지도 한 번 그리기 중앙 ${res.render ? res.render.med : '-'}ms 최대 ${res.render ? res.render.max : '-'}ms · 다음 달 손잡이 ${res.month && res.month.click ? res.month.click.avg + 'ms 평균 ' + res.month.click.max + 'ms 최대' : '-'} · 첫 화면 힙 ${f.heapMB}MB · 노드 ${f.nodes}(#realm ${f.realmNodes} · 성 ${f.cities} · image ${f.images}) · 다음 달 열 번: renderMap ${res.month ? res.month.renders : '-'}번 평균 ${res.month ? res.month.renderAvg : '-'}ms 최대 ${res.month ? res.month.renderMax : '-'}ms · 끌기 30번 renderMap ${res.drag ? res.drag.renders.n : '-'}번 · 끌기 뒤 힙 ${a.heapMB}MB 노드 ${a.nodes}` + (res.errors.length ? ' · ERR ' + res.errors.slice(0, 2).join(' | ') : ''));
