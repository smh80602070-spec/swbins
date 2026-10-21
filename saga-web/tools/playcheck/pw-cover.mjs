// 폰 HUD 가림 측정(W-0363) — 폰 세로(390×844 · isMobile)로 판을 띄워 장면마다 "게임판이 몇 % 가려졌나" 를 잰다.
//   node pw-cover.mjs [판…] [--base http://127.0.0.1:8871/] [--shot] [--max=15]
//   --base 가 없으면 serve.mjs 를 빈 포트에 스스로 띄우고 끝에 끈다. 판마다 새 컨텍스트(세이브 없음 · 씨앗 mulberry32(20260824)).
// 셈: 12px 격자 점마다 elementsFromPoint 를 위에서부터 훑어 "칠하는" 첫 요소(바탕색·그림·테·글자 줄·img/svg/작은 캔버스)를 찾는다.
//   게임판(가장 큰 캔버스)이나 body 까지 내려가면 안 가림. pointer-events:none 인 알림·배너도 잡히게 잴 때만 전부 auto 로 바꾼다.
//   + 캔버스에 그리는 오버레이는 DG.hudRects(그리는 쪽이 이번 프레임 사각형 {x,y,w,h,name} 을 등록)를 같은 격자로 더한다.
//   + "캔버스 미등록 의심": 화면 가운데 1/3 의 등록 안 된 자리에서 아주 밝은 흰 글자 화소 비율(2D 캔버스만 읽힘)을 경고로 남긴다.
// 한 장면 = 0.8초 간격 세 번 잰 평균(알림·피해 숫자처럼 잠깐 뜨는 것 때문에) — 최대값도 남긴다.
// 장면: 첫 화면(이어하기 직후 — 지역 배너·알림이 뜨는 때) · 싸움 없음(1만리 — 곁 적을 치워 독·이야기 줄이 뜨는 때) · 싸움 중(가까운 무리 곁 · 자동 전투 4초).
// --fine: 묶음 대신 낱 요소 40위(어디를 줄일지 찾을 때).
// 결과: 콘솔 표 + results/pw-cover.json(판·장면별 % · 1위~10위 요소). --shot 이면 shots/cover_<판>_<장면>.png(커밋 안 함).
// 종료 코드 = --max(기본 15) 를 넘은 장면 수(calm 은 참고값 INFO — 셈 밖). 판정·게임 코드에는 안 닿는다(읽기만).
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
const SHOT = argv.includes('--shot'), FINE = argv.includes('--fine');   // --fine: 묶음 대신 낱 요소(크기 포함) 40위까지
const MAX = +((argv.find((a) => a.startsWith('--max=')) || '--max=15').slice(6));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* 판별 첫 관문(pw-mobile ADAPT 와 같은 단추)·싸움 들어가기 */
const ADAPT = {
  'saga-go': {
    /* 싸움 없음 — 들판엔 적이 늘 곁에 있어(22m 안이면 fc-on) 첫 화면도 싸움 HUD 다. 곁 적을 멀리 치우고 잔다(진단용, 게임 코드는 그대로) */
    calm: async (page) => { await page.evaluate(() => { const S = DG.fieldCombat.state(); for (const k in S.foes) { const f = S.foes[k]; f.x += 5000; f.y += 5000; f.st = 'idle'; } S.calmT = 99; DG.core.save.settings.autoBattle = false; }); await sleep(2500); },
    fight: async (page) => {
      for (let k = 0; k < 8; k++) {
        const ok = await page.evaluate(() => { const F = DG.fieldCombat, S = F && F.state && F.state(), p = DG.core.save.player.pos; if (!S) { return false; } let best = null, bd = 1e9;
          for (const key in S.camps) { const cp = S.camps[key]; if (cp.kind === 'guard' || cp.sky) { continue; } const d = Math.hypot(cp.x - p.x, cp.y - p.y); if (d < bd) { bd = d; best = cp; } }
          if (!best) { p.x += 300; return false; } p.x = best.x - 7; p.y = best.y; return true; });
        if (ok) { break; } await sleep(1500);
      }
      await sleep(2500); await page.evaluate(() => { DG.core.save.settings.autoBattle = true; }); await sleep(4000);
    }
  },
  'saga-dungeon': { gate: async (page) => { await page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((x) => x.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); },
    fight: async (page) => { await page.evaluate(() => { if (DG.town && DG.town.active && DG.town.active()) { DG.town.leave(); } DG.dungeon.enter({ floor: 1 }); if (DG.auto && DG.auto.setOn) { DG.auto.setOn(true); } }); await sleep(6000); } },
  'saga-forest': {},
  'saga-story': { gate: async (page) => { await page.evaluate(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; if (st) { S.enter(st.key); } }); await sleep(3000); },
    fight: async (page) => { await page.evaluate(() => { if (DG.auto && DG.auto.setOn) { DG.auto.setOn(true); } }); await sleep(5000); } },
  'saga-realm': { gate: async (page) => { await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); } }
};

/* ── 페이지 안 측정 ── */
function coverMeasure(fine) {
  const W = innerWidth, H = innerHeight, STEP = 12;
  const cvs = [...document.querySelectorAll('canvas')].filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(c).visibility !== 'hidden'; });
  const area = (c) => { const r = c.getBoundingClientRect(); return Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)); };
  const boardArea = cvs.reduce((m, c) => Math.max(m, area(c)), 0);
  const isBoard = (c) => area(c) >= boardArea * 0.8 && boardArea >= W * H * 0.4;   // 겹친 3D·2D 캔버스 둘 다 게임판
  const st = document.createElement('style'); st.id = '__cover_pe'; st.textContent = '*{pointer-events:auto !important}'; document.head.appendChild(st);
  const label = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { if (n.id) { return '#' + n.id; } } return e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''); };
  /* 바깥(id 있는) 묶음 이름 — 가장 바깥 고정/절대 위치 조상 중 id 있는 것 */
  const groupOf = (e) => { let g = null; for (let n = e; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if ((p === 'fixed' || p === 'absolute') && n.id) { g = '#' + n.id; } } return g || label(e); };
  const fineOf = (e) => { const r = e.getBoundingClientRect(); return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/s+/).slice(0, 2).join('.') : '') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); };
  const paintCache = new Map();
  const rgbaA = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) { return 0; } const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
  const effOpacity = (e) => { let o = 1; for (let n = e; n && n !== document.documentElement; n = n.parentElement) { o *= +getComputedStyle(n).opacity; } return o; };
  const boxPaints = (e) => { if (paintCache.has(e)) { return paintCache.get(e); } const cs = getComputedStyle(e); let v = false;
    if (cs.visibility !== 'hidden' && effOpacity(e) > 0.05) {
      const tag = e.tagName; if (tag === 'IMG' || tag === 'SVG' || tag === 'svg' || tag === 'VIDEO') { v = true; }
      else if (rgbaA(cs.backgroundColor) > 0.05 || (cs.backgroundImage && cs.backgroundImage !== 'none')) { v = true; }
      else if (parseFloat(cs.borderTopWidth) > 0 && rgbaA(cs.borderTopColor) > 0.05 && parseFloat(cs.borderLeftWidth) > 0) { v = true; }
      else if (cs.boxShadow && cs.boxShadow !== 'none' && cs.backdropFilter && cs.backdropFilter !== 'none') { v = true; }
    } paintCache.set(e, v); return v; };
  const textHit = (e, x, y) => { if (getComputedStyle(e).visibility === 'hidden' || effOpacity(e) <= 0.05) { return false; } for (const n of e.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) { continue; } const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) { if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { return true; } } } return false; };
  const veils = new Set(); const isVeil = (e) => { const r = e.getBoundingClientRect(); const big = r.width * r.height >= W * H * 0.7; if (big) { veils.add(label(e)); } return big; };
  const counts = new Map(); let tot = 0, cov = 0, canvasCov = 0;
  const rects = (window.DG && Array.isArray(DG.hudRects)) ? DG.hudRects.slice() : [];
  const inRect = (x, y) => rects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  for (let y = STEP / 2; y < H; y += STEP) { for (let x = STEP / 2; x < W; x += STEP) {
    tot++; let hit = null;
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === document.body || e === document.documentElement) { break; }
      if (e.tagName === 'CANVAS') { if (isBoard(e)) { break; } hit = e; break; }
      if (isVeil(e)) { continue; }   // 온 화면 막(비네트·감싸는 틀) — 장식이지 HUD 가 아니다
      if (boxPaints(e) || textHit(e, x, y)) { hit = e; break; }
    }
    if (!hit) { const r = inRect(x, y); if (r) { hit = { canvasRect: r.name || '캔버스' }; } }
    if (hit) { cov++; const k = hit.canvasRect ? '◇' + hit.canvasRect : fine ? groupOf(hit) + ' ' + fineOf(hit) : groupOf(hit); if (hit.canvasRect) { canvasCov++; } counts.set(k, (counts.get(k) || 0) + 1); }
  } }
  st.remove();
  /* 캔버스 미등록 의심 — 2D 캔버스 가운데 1/3 의 아주 밝은(흰 글자) 화소 비율 */
  let suspect = null;
  const board = cvs.find(isBoard);
  try { const c2 = cvs.filter(isBoard).map((c) => c.getContext && c.getContext('2d', { willReadFrequently: true })).find(Boolean);
    if (c2 && board) { const cw = c2.canvas.width, ch = c2.canvas.height, d = c2.getImageData(Math.floor(cw / 3), Math.floor(ch / 3), Math.floor(cw / 3), Math.floor(ch / 3)).data; let n = 0, b = 0; for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245 && d[i + 3] > 200) { b++; } } suspect = +(100 * b / n).toFixed(2); } } catch (e) { /* 3D 캔버스 */ }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, fine ? 40 : 10).map(([k, n]) => ({ el: k, pct: +(100 * n / tot).toFixed(1) }));
  return { W, H, veils: [...veils].slice(0, 6), pct: +(100 * cov / tot).toFixed(1), canvasPct: +(100 * canvasCov / tot).toFixed(1), hudRects: rects.length, whiteMidPct: suspect, top };
}

async function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }

async function one(browser, g) {
  const A = ADAPT[g] || {};
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없음 */ }
  const r = { game: g, scenes: [], errors: [] };
  page.on('pageerror', (e) => r.errors.push(e.message.slice(0, 160)));
  const url = BASE + g + '/';
  /* 알림·피해 숫자는 잠깐 뜨는 것이라 한 장만 찍으면 그 순간에 따라 갈린다 — 0.8초 간격 세 번 재서 평균(pct)·최대(peak), 목록은 가운데 것 */
  const scene = async (name) => { const ms = []; for (let i = 0; i < 3; i++) { if (i) { await sleep(800); } ms.push(await page.evaluate(coverMeasure, FINE)); }
    const m = { ...ms[1], pct: +(ms.reduce((a, x) => a + x.pct, 0) / 3).toFixed(1), peak: Math.max(...ms.map((x) => x.pct)), samples: ms.map((x) => x.pct) }; r.scenes.push({ name, ...m });
    if (SHOT) { await page.screenshot({ path: path.join(HERE, 'shots', `cover_${g}_${name}.png`) }).catch(() => {}); } };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('가림'); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
    await clearOverlays(page, g);
    if (A.gate) { await A.gate(page); await clearOverlays(page, g); }
    await sleep(1500); await clearOverlays(page, g);
    await scene('first');
    if (A.calm) { await A.calm(page); await clearOverlays(page, g); await scene('calm'); }
    if (A.fight) { await A.fight(page); await clearOverlays(page, g); await scene('fight'); }
  } catch (e) { r.errors.push('중단 ' + e.message.slice(0, 160)); }
  await ctx.close().catch(() => {});
  return r;
}

let BASE, server = null;
if (bi >= 0) { BASE = argv[bi + 1].replace(/\/?$/, '/'); } else {
  const port = await freePort();
  server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '..', '..'), String(port)], { cwd: HERE, stdio: 'ignore' });
  BASE = `http://127.0.0.1:${port}/`; await sleep(900);
}
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
if (SHOT) { fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true }); }
const out = []; let over = 0;
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({}) });
try {
  for (const g of (games.length ? games : ALL)) {
    const r = await one(browser, g); out.push(r);
    for (const s of r.scenes) { const info = s.name === 'calm', bad = !info && s.pct > MAX; if (bad) { over++; }   // calm 은 참고값(완료 조건은 첫 화면·싸움 중 — W-0363)
      console.log(`${info ? 'INFO' : bad ? 'OVER' : 'OK  '} ${g} ${s.name} 가림 ${s.pct}% (최대 ${s.peak} · 캔버스 ${s.canvasPct}% · hudRects ${s.hudRects}${s.whiteMidPct != null ? ' · 가운데 흰 화소 ' + s.whiteMidPct + '%' : ''}) · ` + s.top.slice(0, 6).map((t) => t.el + ' ' + t.pct).join(' · ')); }
    if (r.errors.length) { console.log('  예외 ' + r.errors.slice(0, 3).join(' | ')); }
  }
} finally {
  await browser.close().catch(() => {});
  if (server) { try { server.kill(); } catch (e) { /* 이미 끝남 */ } }
}
fs.writeFileSync(path.join(HERE, 'results', 'pw-cover.json'), JSON.stringify({ at: new Date().toISOString(), max: MAX, runs: out }, null, 1) + '\n');
console.log(`PW-COVER 넘침 ${over} (상한 ${MAX}%)`);
process.exit(over);
