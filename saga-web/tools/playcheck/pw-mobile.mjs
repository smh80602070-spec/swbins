// 모바일 실태 측정(W-0335) — 다섯 판을 아이폰(WebKit · iPhone 15 Pro 402×874 DPR 3)·안드(크롬 · Pixel 7 412×915 DPR 2.6) 로 연다.
//   node pw-mobile.mjs [판…] [--iphone|--android] [--play=60] [--base http://127.0.0.1:8871/]
//   --base 가 없으면 serve.mjs 를 빈 포트에 스스로 띄우고 끝에 끈다. 판×기기마다 새 컨텍스트(세이브 없음).
// 흐름: 첫 화면(키 아트) → 가입 → 판별 첫 관문(pw-play 와 같은 손잡이) → 들어감 → N초 놀이(키·자동·다음 달) → 가로로 돌림 → 다시 세로.
// 측정 여섯: ① 죽음(page 'crash')·예외·실패 요청 ② fps(놀이 중 2초 rAF 세 번 — 최소·평균) ③ 조작 — 탭 목표 44px 미만 단추 수·가로 넘침·
//   가로 돌림 뒤 HUD 겹침·화면 밖으로 잘린 고정 요소(100vh 어긋남) ④ 글자 12px 미만 수·대비 4.5 미만 수 ⑤ 받은 양 MB(resource timing)·JS 힙·캔버스 화소
//   ⑥ 앱 안 브라우저 띠(W-0331 — 보통 UA 에선 없어야 · 카톡 UA 판정은 돼야)·세로 키 아트(_key_v) 띠
// 결과: 콘솔 + results/pw-mobile.json · 사진 shots/mobile_<판>_<기기>_<장면>.png(커밋 안 함). 판정에는 안 닿는다(종료 코드 = 죽은 수).
// 주의: 이 PC 의 WebKit·크롬은 GPU 메모리 한도가 없다 — "죽음 0" 이 실제 폰이 안 죽는다는 뜻은 아니다.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright-core';
import { clearOverlays } from './overlay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
const KINDS = argv.includes('--iphone') ? ['iphone'] : argv.includes('--android') ? ['android'] : ['iphone', 'android'];
const PLAY_S = +((argv.find((a) => a.startsWith('--play=')) || '--play=60').slice(7));
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const DEV = {
  iphone: { engine: 'webkit', name: '아이폰', profile: { ...devices['iPhone 15 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 } },
  android: { engine: 'chromium', name: '안드', profile: { ...devices['Pixel 7'] } }
};
const KAKAO_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0';

/* 판별 첫 관문·놀이 손잡이(pw-play ADAPT 와 같은 단추) */
const ADAPT = {
  'saga-go': {},
  'saga-dungeon': { gate: async (page) => { await page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((x) => x.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); } },
  'saga-forest': {},
  'saga-story': { keys: ['KeyD', 'KeyA'], gate: async (page) => { await page.evaluate(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; if (st) { S.enter(st.key); } }); await sleep(3000); } },
  'saga-realm': { gate: async (page) => { await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); },
    tick: async (page) => { await page.evaluate(() => { const b = document.querySelector('[data-act="next-month"]'); if (b && b.offsetParent) { b.click(); } }); } }
};

/* ── 페이지 안 측정(순수 DOM) ── */
function domMeasure() {
  const W = innerWidth, H = innerHeight;
  const vis = (e) => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) { return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.left < W && r.top < H; };
  const name = (e) => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  /* ③ 탭 목표 — 누를 수 있는 것 중 짧은 변 44 미만 */
  const taps = [...document.querySelectorAll('button, a[href], [role="button"], [data-act], input, select')].filter((e) => vis(e) && getComputedStyle(e).pointerEvents !== 'none');
  const small = taps.filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; });
  /* ③ 가로 넘침 · 화면 밖으로 잘린 고정 요소 */
  const overflowX = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0) - W;
  const fixed = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); return (cs.position === 'fixed' || cs.position === 'absolute') && cs.pointerEvents !== 'none' && vis(e); });
  const cut = fixed.filter((e) => { const r = e.getBoundingClientRect(); return r.width >= 24 && r.height >= 24 && r.width < W && r.height < H && (r.bottom > H + 2 || r.right > W + 2 || r.top < -2 || r.left < -2); }).map(name);
  /* ③ HUD 겹침(pw-play 와 같은 셈) */
  const big = fixed.filter((e) => { const r = e.getBoundingClientRect(); return r.width >= 40 && r.height >= 40 && (r.width * r.height) < W * H * 0.5; });
  const over = [];
  for (let i = 0; i < big.length; i++) { for (let j = i + 1; j < big.length; j++) {
    const a = big[i], b = big[j]; if (a.contains(b) || b.contains(a)) { continue; }
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 0 && h > 0 && w * h / Math.min(ra.width * ra.height, rb.width * rb.height) >= 0.5) { over.push(name(a) + '↔' + name(b)); }
  } }
  /* ④ 글자 — 글자를 직접 가진 보이는 요소의 크기·대비(바탕은 위로 올라가며 첫 불투명 색, 그림 바탕이면 셈 밖) */
  const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) { return null; } const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== 'none') { return null; } const c = rgb(cs.backgroundColor); if (c && c.a >= 0.9) { return c; } } return null; };
  const texts = [...document.querySelectorAll('body *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /[가-힣A-Za-z0-9]/.test(n.textContent)) && vis(e) && !e.closest('svg'));   // 그림 글자(이모지·기호)만 든 단추는 셈 밖 · SVG 글자는 viewBox 좌표 단위라 셈 밖(5천하 지도 1.1)
  const tiny = [], lowC = []; let judged = 0;
  for (const e of texts) {
    const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize) || 0;
    if (fs < 12) { tiny.push((e.parentElement ? name(e.parentElement) + '>' : '') + name(e) + ' ' + fs.toFixed(1) + 'px' + (e.style.fontSize ? '(인라인)' : '')); }
    const fg = rgb(cs.color), bg = bgOf(e);
    if (fg && bg) { judged++; const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); if (ratio < 4.5) { lowC.push(name(e) + ' ' + ratio.toFixed(1)); } }
  }
  /* ⑤ 캔버스 화소 · 힙 · 받은 양 */
  const cv = [...document.querySelectorAll('canvas')].reduce((a, c) => a + c.width * c.height, 0);
  const res = performance.getEntriesByType('resource');
  const bytes = res.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0);
  const heap = performance.memory ? performance.memory.usedJSHeapSize : null;
  return {
    W, H, taps: taps.length, smallTaps: small.length, smallEx: small.slice(0, 16).map((e) => { const r = e.getBoundingClientRect(); return name(e) + ' ' + Math.round(r.width) + '×' + Math.round(r.height); }), overflowX, cut: cut.slice(0, 6), cutN: cut.length,
    overlap: over.slice(0, 6), overlapN: over.length, texts: texts.length, tiny: tiny.length, tinyEx: tiny.slice(0, 6), judged, lowC: lowC.length, lowCEx: lowC.slice(0, 6),
    canvasMP: +(cv / 1e6).toFixed(2), mb: +(bytes / 1048576).toFixed(1), resN: res.length, heapMB: heap ? +(heap / 1048576).toFixed(1) : null,
    inappBand: !!(document.getElementById('inapp-band') && vis(document.getElementById('inapp-band')))
  };
}
function keyArt() {
  const W = innerWidth, H = innerHeight, out = [];
  document.querySelectorAll('*').forEach((e) => { const cs = getComputedStyle(e), src = (e.currentSrc || e.src || '') + ' ' + cs.backgroundImage; if (/_key_v|_key\./.test(src)) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { out.push({ el: e.id || e.tagName.toLowerCase(), v: /_key_v/.test(src), w: Math.round(r.width), h: Math.round(r.height), fit: e.tagName === 'IMG' ? cs.objectFit : cs.backgroundSize }); } } });
  const inapp = window.DG && DG.inApp ? { name: DG.inApp.name, kakao: DG.inApp.test ? DG.inApp.test(arguments[0]) : null } : null;
  return { W, H, art: out.slice(0, 3), inapp };
}
const fpsOnce = (page) => page.evaluate(() => new Promise((r) => { let k = 0; const t0 = performance.now(); (function f() { k++; const t = performance.now() - t0; if (t < 2000) { requestAnimationFrame(f); } else { r(Math.round(k / (t / 1000))); } })(); setTimeout(() => r(0), 6000); }));

async function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }

async function one(browsers, g, kind) {
  const D = DEV[kind], A = ADAPT[g] || {};
  const ctx = await browsers[D.engine].newContext({ ...D.profile, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  const r = { game: g, device: kind, engine: D.engine, crash: 0, errors: [], failed: [], steps: [], shots: [] };
  page.on('crash', () => { r.crash++; });
  page.on('pageerror', (e) => r.errors.push(e.message.slice(0, 160)));
  page.on('requestfailed', (q) => { const u = q.url(), why = (q.failure() || {}).errorText || ''; if (!/openstreetmap|overpass|favicon|license\.json|google|cdn/.test(u) && !/cancelled|ERR_ABORTED/i.test(why)) { r.failed.push(u.replace(BASE, '').slice(0, 120) + ' ' + why.slice(0, 40)); } });   // 소리 미리 받기 취소(WebKit cancelled·크롬 ABORTED)는 실패 아님
  page.on('response', (s) => { if (s.status() === 404 && !/license\.json|favicon/.test(s.url())) { r.failed.push('404 ' + s.url().replace(BASE, '').slice(0, 120)); } });
  const shot = async (k) => { const f = path.join(SHOTS, `mobile_${g}_${kind}_${k}.png`); try { await page.screenshot({ path: f }); r.shots.push(path.relative(HERE, f).replace(/\\/g, '/')); } catch (e) { /* 죽은 탭 */ } };
  const step = (name, ok, detail) => r.steps.push({ name, ok: !!ok, detail: String(detail || '').slice(0, 200) });
  const url = BASE + g + '/';
  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(4000);
    r.title = await page.evaluate(keyArt, KAKAO_UA).catch((e) => ({ err: e.message.slice(0, 80) }));
    await shot('title');
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('모바일'); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await clearOverlays(page, g);
    if (A.gate) { await A.gate(page).catch((e) => step('첫 관문', false, e.message.slice(0, 120))); }
    await clearOverlays(page, g); await sleep(1500); await clearOverlays(page, g);
    const inGame = await page.evaluate(() => { const shown = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); return !document.querySelector('#acc-host.show') && !shown(document.getElementById('boot-guard')) && (shown(document.getElementById('dock')) || !!(window.DG && DG.core && DG.core.save && DG.core.save.player)); });   // 1만리엔 #dock 이 없다
    r.bootMs = Date.now() - t0;
    step('들어감', inGame, r.bootMs + 'ms');
    r.portrait = await page.evaluate(domMeasure);
    await shot('game');
    /* N초 놀이 — 키 한 방향 1초씩 돌고, 자동이 있으면 켜고, 5천하는 다음 달 */
    const keys = A.keys || ['KeyD', 'KeyS', 'KeyA', 'KeyW'], fps = [];
    await page.evaluate(() => { if (window.DG && DG.auto && DG.auto.setOn) { try { DG.auto.setOn(true); } catch (e) { /* 판마다 */ } } }).catch(() => {});
    const tEnd = Date.now() + PLAY_S * 1000; let k = 0;
    while (Date.now() < tEnd && !r.crash) {
      const code = keys[k++ % keys.length];
      await page.keyboard.down(code).catch(() => {}); await sleep(1000); await page.keyboard.up(code).catch(() => {});
      if (A.tick && k % 8 === 0) { await A.tick(page).catch(() => {}); }
      if (k % 6 === 3) { await clearOverlays(page, g); fps.push(await fpsOnce(page).catch(() => 0)); }
    }
    await page.evaluate(() => { if (window.DG && DG.auto && DG.auto.setOn) { try { DG.auto.setOn(false); } catch (e) { /* 판마다 */ } } }).catch(() => {});
    r.fps = { min: fps.length ? Math.min(...fps) : 0, avg: fps.length ? Math.round(fps.reduce((a, b) => a + b, 0) / fps.length) : 0, n: fps.length };
    r.afterPlay = await page.evaluate(domMeasure);
    await shot('play');
    /* 가로로 돌림 → 재고 → 다시 세로 */
    const vp = D.profile.viewport;
    await page.setViewportSize({ width: vp.height, height: vp.width }); await sleep(1800);
    r.landscape = await page.evaluate(domMeasure);
    await shot('land');
    await page.setViewportSize(vp); await sleep(1500);
    r.back = await page.evaluate(domMeasure);
    step('세로로 돌아와 넘침 없음', r.back.overflowX <= 1, '넘침 ' + r.back.overflowX + 'px');
  } catch (e) { step('예외로 중단', false, e.message.slice(0, 160)); }
  await ctx.close().catch(() => {});
  r.ok = !r.crash && r.steps.every((s) => s.ok);
  return r;
}

let BASE, server = null;
if (bi >= 0) { BASE = argv[bi + 1].replace(/\/?$/, '/'); } else {
  const port = await freePort();
  server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { cwd: HERE, stdio: 'ignore' });
  BASE = `http://127.0.0.1:${port}/`; await sleep(900);
}
const browsers = {};
const out = [];
try {
  if (KINDS.includes('iphone')) { browsers.webkit = await webkit.launch({ headless: true }); }
  if (KINDS.includes('android')) { browsers.chromium = await chromium.launch({ executablePath: CHROME, headless: true }); }
  for (const g of (games.length ? games : ALL)) {
    for (const kind of KINDS) {
      const r = await one(browsers, g, kind);
      out.push(r);
      const p = r.portrait || {}, l = r.landscape || {};
      console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${g} ${DEV[kind].name} · 죽음 ${r.crash} · 예외 ${r.errors.length} · 실패요청 ${r.failed.length} · fps ${r.fps ? r.fps.min + '/' + r.fps.avg : '-'} · 작은 단추 ${p.smallTaps}/${p.taps} · 넘침 ${p.overflowX} · 가로 겹침 ${l.overlapN} 잘림 ${l.cutN} · 글자<12 ${p.tiny} · 대비<4.5 ${p.lowC}/${p.judged} · ${p.mb}MB 힙 ${p.heapMB} 캔버스 ${p.canvasMP}MP` + (r.steps.some((s) => !s.ok) ? ' · ' + r.steps.filter((s) => !s.ok).map((s) => s.name + ' ' + s.detail).join(' | ') : ''));
    }
  }
} finally {
  for (const b of Object.values(browsers)) { await b.close().catch(() => {}); }
  if (server) { try { server.kill(); } catch (e) { /* 이미 끝남 */ } }
}
fs.writeFileSync(path.join(HERE, 'results', 'pw-mobile.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), play: PLAY_S, note: '이 PC WebKit·크롬은 GPU 메모리 한도가 없다 — 죽음 0 ≠ 폰 안 죽음', runs: out }, null, 1) + '\n');
const dead = out.filter((r) => r.crash).length;
console.log(`PW-MOBILE 죽음 ${dead} · 실패 ${out.filter((r) => !r.ok).length} / ${out.length}`);
process.exit(dead);
