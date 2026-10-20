// W-0339 다섯 판 3D 룩 비교 — 같은 조건(HIGH·맑음·낮·1280×720·실제 GPU)으로 3D 캔버스만 찍어 평균 휘도·색온도를 숫자로.
//   node pw-look-compare.mjs [판…] [--base http://127.0.0.1:8871/] [--tune 키=값]…   (서버는 돌리는 쪽이 띄운다)
// 진입 순서는 pw-gfx.mjs 와 같다(HIGH 손잡이 → 새 계정 → 이어하기 → 판별 3D 켜기). HUD·창은 숨기고 가장 큰 캔버스만 보이게 해서 찍는다.
// 숫자: Y = 평균 상대 휘도(선형, 0~1) · K = 평균 선형 RGB → XYZ → McCamy 색온도 · 판 사이 차 = (최대−최소)/중앙값.
// 판정(티켓 W-0339): 휘도 차 ≤ 15% · 색온도 차 ≤ 800K. 결과 results/pw-look.json + shots/look/<판>.png + compare.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs, gpuInfo } from './cdp.mjs';
import { clearOverlays } from './overlay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : (process.env.PW_BASE || 'http://127.0.0.1:8871/')).replace(/\/?$/, '/');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base' && argv[i - 1] !== '--tune');
const EXTRA = argv.map((a, i) => (a === '--tune' ? argv[i + 1] : null)).filter(Boolean).map((kv) => { const j = kv.indexOf('='), v = kv.slice(j + 1); return [kv.slice(0, j), /^-?\d+(\.\d+)?$/.test(v) ? +v : v]; });
const SHOTS = path.join(HERE, 'shots', 'look');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* pw-gfx.mjs 와 같은 값 — 가장 좋은 품질 + 시각 고정(같은 낮으로 재야 판끼리 견준다 — 3마을은 실제 시계라 측정 사이 낮→저녁에 3,700K 로 튀었다) */
const HIGH = {
  'saga-go': [['perf.startTier', 'HIGH'], ['perf.auto', 0], ['world3d.dayNight', 0]],   // 정오(실제 시계 대신)
  'saga-dungeon': [['dg3d.quality', 'high']],
  'saga-forest': [['village3d.quality', 'high'], ['village3d.on', 1], ['time.phase', 'day']],   // 3마을은 실제 시계 — 낮으로
  'saga-story': [],
  'saga-realm': [['realm3d.on', 1], ['realm3d.quality', 'high'], ['realm3d.skyTime', 'noon']]   // 5천하는 게임 달 — 정오로
};
/* pw-gfx.mjs 와 같은 진입 + 낮·맑음으로 붙든다(판마다 시각 축 이름이 달라 있는 것만) */
const ENTER = {
  'saga-go': async (p) => { await p.evaluate(() => { if (DG.weather && DG.weather.force) { DG.weather.force('clear'); } for (let i = 0; i < 4 && DG.world.tiltMode !== 2; i++) { const b = document.getElementById('btn-tilt'); if (b) { b.click(); } } }); },
  'saga-dungeon': async (p) => { await p.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); },
  'saga-forest': async (p) => { await p.evaluate(() => { const V = DG.villageView3d; if (V && V.available && V.available() && !V.active()) { V.toggle(); } }); },
  'saga-story': async (p) => { await p.evaluate(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; if (st) { S.enter(st.key); } const V = DG.sideView3d; if (V && V.setQuality) { V.setQuality('high'); } if (V && V.available && V.available() && !V.active()) { V.toggle(); } }); await sleep(2500); },
  'saga-realm': async (p) => { await p.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await p.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); }
};

/** 페이지 안 — 가장 큰 캔버스만 보이게(HUD·창·미니맵 숨김) */
const ISOLATE = () => {
  const cs = [...document.querySelectorAll('canvas')].filter((c) => { const r = c.getBoundingClientRect(); return r.width > 200 && r.height > 200 && getComputedStyle(c).display !== 'none'; });
  cs.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; });
  const big = cs.filter((c) => { try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })[0] || cs[0];
  if (!big) { return null; }
  big.setAttribute('data-look', '1');
  const st = document.createElement('style'); st.id = 'look-iso';
  st.textContent = 'body *{visibility:hidden!important} canvas[data-look]{visibility:visible!important} #vignette{display:none!important}';
  document.head.appendChild(st);
  return big.id || big.className || 'canvas';
};
const UNISOLATE = () => { const s = document.getElementById('look-iso'); if (s) { s.remove(); } };

/** 페이지 안 — PNG(data URL)의 평균 선형 RGB · 휘도 · 색온도 */
const STATS = async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = 320, H = Math.round(img.height * W / img.width), c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); g += lin(d[i + 1]); b += lin(d[i + 2]); n++; }
  r /= n; g /= n; b /= n;
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b, s = X + Y + Z || 1;
  const cx = X / s, cy = Y / s, nn = (cx - 0.3320) / (0.1858 - cy), K = 449 * nn * nn * nn + 3525 * nn * nn + 6823.3 * nn + 5520.33;
  return { r: +r.toFixed(4), g: +g.toFixed(4), b: +b.toFixed(4), Y: +Y.toFixed(4), K: Math.round(K) };
};

async function one(browser, g) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없어도 된다 */ }
  const url = BASE + g + '/';
  let res = { game: g, err: '' };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);
    await page.evaluate((hi) => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('룩'); hi.forEach(([k, v]) => DG.core.setTune(k, v)); }, HIGH[g].concat(EXTRA));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await clearOverlays(page, g);
    await ENTER[g](page); await clearOverlays(page, g);
    await sleep(6000);
    res.canvas = await page.evaluate(ISOLATE);
    await sleep(400);
    const file = path.join(SHOTS, g + '.png');
    await page.screenshot({ path: file });
    await page.evaluate(UNISOLATE);
    res.look = await page.evaluate(() => (window.DG && DG.look3d ? { on: DG.look3d.on(), game: DG.look3d.game(), cal: DG.look3d.cal() } : null));
    res.post = await page.evaluate(() => (window.DG && DG.post3d && DG.post3d.last ? DG.post3d.last() : null));
    const p2 = await ctx.newPage();
    res.stats = await p2.evaluate(STATS, 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'));
    await p2.close();
  } catch (e) { res.err = e.message.slice(0, 200); }
  await ctx.close();
  return res;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs() });
let gpu = null;
{ const p0 = await browser.newPage(); gpu = await gpuInfo(p0); await p0.close(); }
const out = [];
try {
  for (const g of (games.length ? games : ALL)) {
    const r = await one(browser, g); out.push(r);
    console.log(g.padEnd(13), r.err ? 'ERR ' + r.err : `Y ${r.stats.Y.toFixed(3)} · ${r.stats.K}K · rgb ${r.stats.r}/${r.stats.g}/${r.stats.b}` + (r.look ? ` · look ${r.look.on ? '켬' : '끔'} 노출×${r.look.cal.exposure} wb ${r.look.cal.wb.join('/')}` : ' · look 없음') + (r.post ? ` · 후처리 ${r.post.on ? r.post.tier : '꺼짐'}` : ''));
  }
  const imgs = out.filter((r) => fs.existsSync(path.join(SHOTS, r.game + '.png')));
  if (imgs.length) {
    const ctx = await browser.newContext({ viewport: { width: 400 * imgs.length, height: 260 } });
    const p = await ctx.newPage();
    await p.setContent('<body style="margin:0;background:#111;display:flex">' + imgs.map((r) => `<div style="width:400px"><img style="width:400px;height:225px;display:block" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, r.game + '.png')).toString('base64')}"><div style="color:#eee;font:13px sans-serif;padding:6px">${r.game} · Y ${r.stats ? r.stats.Y.toFixed(3) : '-'} · ${r.stats ? r.stats.K : '-'}K</div></div>`).join('') + '</body>');
    await sleep(300); await p.screenshot({ path: path.join(SHOTS, 'compare.png') }); await ctx.close();
  }
} finally { await browser.close(); }
const ok = out.filter((r) => r.stats);
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const Ys = ok.map((r) => r.stats.Y), Ks = ok.map((r) => r.stats.K);
const yDiff = ok.length ? (Math.max(...Ys) - Math.min(...Ys)) / med(Ys) : 0, kDiff = ok.length ? Math.max(...Ks) - Math.min(...Ks) : 0;
const pass = ok.length === out.length && yDiff <= 0.15 && kDiff <= 800;
fs.writeFileSync(path.join(HERE, 'results', 'pw-look.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, gpu, medY: ok.length ? med(Ys) : null, medK: ok.length ? med(Ks) : null, yDiff: +yDiff.toFixed(3), kDiff, pass, runs: out }, null, 1));
console.log(`PW-LOOK ${pass ? 'PASS' : 'WARN'} · 휘도 차 ${(yDiff * 100).toFixed(1)}% (≤15) · 색온도 차 ${kDiff}K (≤800) · 중앙 Y ${ok.length ? med(Ys).toFixed(3) : '-'} · ${ok.length ? med(Ks) : '-'}K`);
process.exit(0);
