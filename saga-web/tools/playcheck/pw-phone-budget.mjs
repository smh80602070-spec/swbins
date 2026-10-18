// 폰 예산 측정(W-0302) — 다섯 판을 폰처럼(390×844 · 화소비 2 · CPU 4배 감속 · 품질 "자동") 띄워 장면마다
//   ① 첫 화면까지 받은 용량(CDP Network.loadingFinished encodedDataLength 합) ② FPS(3초 rAF 셈) ③ 그리기 수(draw call)·삼각형·텍스처 수 ④ JS 힙
// 을 재고 상한(용량 25MB · FPS 30 · draw call 300)과 견준다. 3회 평균(--runs=N). 결과 results/pw-phone-budget.json + 콘솔 표.
//   node pw-phone-budget.mjs [판…] [--runs=3] [--base http://127.0.0.1:8871/] [--gpu]   (서버는 돌리는 쪽이 띄운다)
// --gpu: 헤드리스 크롬이 실제 GPU(d3d11)로 그린다 — FPS 를 믿을 수 있는 건 이때뿐. 없으면 swiftshader(소프트웨어)라 FPS 는 상대 비교용(표에 표시).
// 판정에는 안 닿는다(읽기만). 품질 손잡이는 안 건드린다 — 판의 "자동" 단계가 폰에서 어디까지 내려가는지가 곧 재는 대상이다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : (process.env.PW_BASE || 'http://127.0.0.1:8871/')).replace(/\/?$/, '/');
const RUNS = +((argv.find((a) => a.startsWith('--runs=')) || '--runs=3').slice(7));
const GPU = argv.includes('--gpu'), THROTTLE = +((argv.find((a) => a.startsWith('--throttle=')) || '--throttle=4').slice(11));   // CPU 감속 배수(1 = 감속 없음)
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base' && argv[i - 1] !== '--tune');
/* --tune 키=값 (여러 번) — 계정 만든 뒤 손잡이를 덧붙인다(켬·끔 A/B) */
const TUNES = argv.map((a, i) => (a === '--tune' ? argv[i + 1] : null)).filter(Boolean).map((kv) => { const j = kv.indexOf('='), v = kv.slice(j + 1); return [kv.slice(0, j), /^-?\d+(\.\d+)?$/.test(v) ? +v : v]; });
export const BUDGET = { mb: 25, fps: 30, calls: 300 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function clearIntro(p) {
  for (let i = 0; i < 12; i++) {
    const open = await p.evaluate(() => !!((window.DG && DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (window.DG && DG.story && DG.story.isOpen && DG.story.isOpen())));
    if (!open) { break; }
    await p.evaluate(() => { if (DG.scenario && DG.scenario.skip) { DG.scenario.skip(); } else if (DG.story && DG.story.skip) { DG.story.skip(); } }); await sleep(250);
  }
  await p.evaluate(() => {
    document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } });
    const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); }
    if (DG.menuGrid && DG.menuGrid.close) { DG.menuGrid.close(); }
  });
}
/** 판마다 장면 — [이름, 들어가기] 차례로. 첫 장면 = 첫 화면(용량은 여기까지 센다) */
export const SCENES = {
  'saga-go': [['들판', async () => {}], ['걷기', async (p) => { await p.keyboard.down('w'); }]],
  'saga-dungeon': [['마을', async (p) => { await p.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); }],
    ['던전', async (p) => { await p.evaluate(() => { if (DG.town && DG.town.active && DG.town.active()) { DG.town.leave(); } DG.dungeon.enter({ floor: 1 }); }); await sleep(4000); }]],
  'saga-forest': [['마을', async (p) => { await p.evaluate(() => { const V = DG.villageView3d; if (V && V.available && V.available() && !V.active()) { V.toggle(); } }); }],
    ['걷기', async (p) => { await p.keyboard.down('d'); }]],
  'saga-story': [['사냥터', async (p) => { await p.evaluate(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; if (st) { S.enter(st.key); } const V = DG.sideView3d; if (V && V.available && V.available() && !V.active()) { V.toggle(); } }); await sleep(2500); }],
    ['자동 사냥', async (p) => { await p.evaluate(() => { if (DG.auto && DG.auto.setOn) { DG.auto.setOn(true); } }); }]],
  'saga-realm': [['지도', async (p) => { await p.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await p.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); }],
    ['성', async (p) => { await p.evaluate(() => { const R = DG.rtk; DG.ui.openCity(R.citiesOf(R.state().me)[0]); }); await sleep(3000); }]]
};

/** 페이지 안 — 3초 rAF 로 FPS, 그 사이 렌더러를 붙잡아 info */
const MEASURE = async () => {
  const T = window.THREE; let rdr = null, mc = 0, mt = 0; const P0 = T && T.Object3D.prototype, orig = P0 && P0.onBeforeRender, origA = P0 && P0.onAfterRender;
  /* 장면 렌더 하나의 그리기 수 = 그 장면 직후 info(후처리 화면 사각형 한 장이 마지막에 덮어써 1 로 보이던 것) — 프레임 안 가장 큰 장면 값 */
  if (P0) { P0.onBeforeRender = function (renderer) { if (this.isScene) { rdr = renderer; } return orig && orig.apply(this, arguments); }; P0.onAfterRender = function (renderer) { if (this.isScene && renderer.info) { mc = Math.max(mc, renderer.info.render.calls); mt = Math.max(mt, renderer.info.render.triangles); } return origA && origA.apply(this, arguments); }; }
  let n = 0, t0 = performance.now(), worst = 0, last = t0; const tick = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; n++; if (t - t0 < 3000) { requestAnimationFrame(tick); } };
  await new Promise((r) => { requestAnimationFrame(tick); setTimeout(r, 3300); });
  if (P0) { P0.onBeforeRender = orig; P0.onAfterRender = origA; }
  const fps = n / ((last - t0) / 1000), info = rdr && rdr.info, gl = rdr && rdr.getContext && rdr.getContext(), dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  const q = (window.DG && ((DG.perf && DG.perf.tier && DG.perf.tier().key) || (DG.dungeon3d && DG.dungeon3d.quality && DG.dungeon3d.quality()) || (DG.villageView3d && DG.villageView3d.quality && DG.villageView3d.quality()) || (DG.sideView3d && DG.sideView3d.quality && DG.sideView3d.quality()) || (DG.realm3d && DG.realm3d.quality && DG.realm3d.quality()))) || '?';
  return { fps: +fps.toFixed(1), worstMs: Math.round(worst), calls: info ? mc : null, tris: info ? mt : null, tex: info ? info.memory.textures : null, geo: info ? info.memory.geometries : null,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, quality: typeof q === 'object' ? JSON.stringify(q) : String(q), three: !!rdr };
};

async function one(browser, g) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  let bytes = 0, firstBytes = null; const big = new Map(), urls = new Map();
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  cdp.on('Network.responseReceived', (e) => { urls.set(e.requestId, e.response.url); });
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; const u = urls.get(e.requestId); if (u) { big.set(u, e.encodedDataLength || 0); } });
  try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없음 */ }
  const url = BASE + g + '/', res = { game: g, scenes: [], err: '' };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
    await page.evaluate((tn) => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('예산'); tn.forEach(([k, v]) => DG.core.setTune(k, v)); }, TUNES);
    bytes = 0; big.clear();   // 계정 만들기 전 첫 받기는 빼고, 진짜 첫 화면(이어하기)부터 센다 — 캐시 끔이라 다시 다 받는다
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }); await sleep(4000);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(4000);
    await clearIntro(page);
    for (let i = 0; i < SCENES[g].length; i++) {
      const [name, enter] = SCENES[g][i];
      await enter(page); await clearIntro(page); await sleep(8000); await clearIntro(page);
      if (i === 0) { firstBytes = bytes; }
      const m = await page.evaluate(MEASURE);
      res.scenes.push({ name, ...m });
    }
  } catch (e) { res.err = e.message.slice(0, 200); }
  res.firstMB = +((firstBytes == null ? bytes : firstBytes) / 1048576).toFixed(2);
  res.totalMB = +(bytes / 1048576).toFixed(2);
  res.top = [...big.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([u, b]) => [u.replace(BASE, ''), +(b / 1048576).toFixed(2)]);
  await ctx.close();
  return res;
}

if (!process.env.PW_BUDGET_LIB) {   // pw-cpu-profile.mjs 가 SCENES·clearIntro 만 가져다 쓸 때는 안 돈다
const args = ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'].concat(GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu']);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args });
const out = [];
try {
  for (const g of (games.length ? games : ALL)) {
    const runs = [];
    for (let k = 0; k < RUNS; k++) { runs.push(await one(browser, g)); }
    const avg = (f) => { const v = runs.map(f).filter((x) => typeof x === 'number'); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
    const names = (runs[0].scenes || []).map((s) => s.name);
    const r = { game: g, runs: runs.length, firstMB: avg((x) => x.firstMB), totalMB: avg((x) => x.totalMB), top: runs[0].top, err: runs.map((x) => x.err).filter(Boolean)[0] || '',
      scenes: names.map((nm, i) => ({ name: nm, fps: avg((x) => x.scenes[i] && x.scenes[i].fps), worstMs: avg((x) => x.scenes[i] && x.scenes[i].worstMs), calls: avg((x) => x.scenes[i] && x.scenes[i].calls), tris: avg((x) => x.scenes[i] && x.scenes[i].tris), tex: avg((x) => x.scenes[i] && x.scenes[i].tex), heapMB: avg((x) => x.scenes[i] && x.scenes[i].heapMB), quality: runs[0].scenes[i] && runs[0].scenes[i].quality, gpu: runs[0].scenes[i] && runs[0].scenes[i].gpu })) };
    r.over = [];
    if (r.firstMB > BUDGET.mb) { r.over.push('용량 ' + r.firstMB + 'MB'); }
    r.scenes.forEach((s) => { if (GPU && s.fps != null && s.fps < BUDGET.fps) { r.over.push(s.name + ' FPS ' + s.fps); } if (s.calls != null && s.calls > BUDGET.calls) { r.over.push(s.name + ' 그리기 ' + s.calls); } });
    out.push(r);
    console.log(`${r.over.length ? 'WARN' : 'OK  '} ${g} · 첫 화면 ${r.firstMB}MB(전체 ${r.totalMB}) · ` + r.scenes.map((s) => `${s.name} ${s.fps}fps 그리기 ${s.calls} 삼각 ${s.tris} 텍스처 ${s.tex} 힙 ${s.heapMB}MB [${s.quality}]`).join(' · ') + (r.over.length ? ' · 넘음 ' + r.over.join(', ') : '') + (r.err ? ' · ERR ' + r.err : ''));
  }
} finally { await browser.close(); }
const gpuName = out[0] && out[0].scenes[0] && out[0].scenes[0].gpu;
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
/* 판 몇 개만 다시 재도 다른 판 결과는 남긴다(합쳐 쓰기) — 판마다 그 판을 잰 때(at)를 붙인다 */
const RES = path.join(HERE, 'results', 'pw-phone-budget.json'), now = new Date().toISOString();
let prev = []; try { prev = JSON.parse(fs.readFileSync(RES, 'utf8')).runs || []; } catch (e) { /* 처음 */ }
out.forEach((r) => { r.at = now; r.gpu = GPU; r.cpuThrottle = THROTTLE; });
const merged = prev.filter((p) => !out.some((r) => r.game === p.game)).concat(out).sort((a, b) => ALL.indexOf(a.game) - ALL.indexOf(b.game));
fs.writeFileSync(RES, JSON.stringify({ at: now, base: BASE, gpu: GPU, gpuName, budget: BUDGET, cpuThrottle: THROTTLE, viewport: '390x844@2', runs: merged }, null, 1));
console.log(`PHONE-BUDGET 넘은 판 ${out.filter((r) => r.over.length).length} / ${out.length} · GPU ${GPU ? gpuName : 'swiftshader(FPS 상대값)'}`);
process.exit(0);
}
