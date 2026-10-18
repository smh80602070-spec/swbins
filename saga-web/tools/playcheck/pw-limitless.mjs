// "웹엔 한계가 없다" 측정(W-0310) — _demo.html#limitless 를 실제 GPU(d3d11) 헤드리스 1280×720 으로 열어
//   군중 N 명(기본 300) 켠 뒤 FPS·그리기 수·삼각형·JS 힙·군중 CPU ms 를 3초씩 재고, 군중을 끈 바탕값과 견준다.
//   node saga-web/tools/playcheck/pw-limitless.mjs [--n=300] [--phone] [--swiftshader]   → results/pw-limitless.json + 콘솔 표 + shots/limitless-<n>.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const N = +opt('n', 300), PHONE = argv.includes('--phone'), SW = argv.includes('--swiftshader');
const PORT = 8919, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
const args = ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'].concat(SW ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args });
const MEASURE = async () => {
  const T = window.THREE; let rdr = null, mc = 0, mt = 0; const P0 = T && T.Object3D.prototype, orig = P0.onBeforeRender, origA = P0.onAfterRender;
  P0.onBeforeRender = function (renderer) { if (this.isScene) { rdr = renderer; } return orig && orig.apply(this, arguments); };
  P0.onAfterRender = function (renderer) { if (this.isScene && renderer.info) { mc = Math.max(mc, renderer.info.render.calls); mt = Math.max(mt, renderer.info.render.triangles); } return origA && origA.apply(this, arguments); };
  let n = 0, t0 = performance.now(), worst = 0, last = t0; const tick = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; n++; if (t - t0 < 3000) { requestAnimationFrame(tick); } };
  await new Promise((r) => { requestAnimationFrame(tick); setTimeout(r, 3300); });
  P0.onBeforeRender = orig; P0.onAfterRender = origA;
  const gl = rdr && rdr.getContext(), dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { fps: +(n / ((last - t0) / 1000)).toFixed(1), worstMs: Math.round(worst), calls: mc, tris: mt, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, crowd: DG.limitless ? DG.limitless.stats() : null };
};
const out = { at: new Date().toISOString(), n: N, phone: PHONE, gpu: !SW, rows: [] };
try {
  const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' } : { viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on("console", (m) => { if (m.type() === "error" || /shader|THREE/i.test(m.text())) { errs.push(m.text().slice(0, 300)); } }); page.on("pageerror", (e) => errs.push("PAGE " + String(e.message).slice(0, 300)));
  if (PHONE) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  const B = `http://127.0.0.1:${PORT}/`;
  await page.goto(B + '_demo.html#limitless,n=' + N, { waitUntil: 'load' });
  for (let i = 0; i < 90; i++) { await sleep(1000); const st = await page.evaluate(() => DG.limitless && DG.limitless.stats()); if (st && (st.ready || st.err)) { if (st.err) { console.log('ERR', st.err); } break; } }
  await sleep(2500);
  const on = await page.evaluate(MEASURE); out.rows.push({ name: '군중 ' + N, ...on });
  fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
  await page.screenshot({ path: path.join(HERE, 'shots', 'limitless-' + N + (PHONE ? '-phone' : '') + '.png') });
  await page.evaluate(() => DG.limitless.stop()); await sleep(1500);
  const off = await page.evaluate(MEASURE); out.rows.push({ name: '군중 0(바탕)', ...off });
  out.gpuName = on.gpu; out.errors = errs.slice(0, 8); if (errs.length) { console.log("콘솔 오류 " + errs.length + ": " + errs.slice(0, 3).join(" | ")); }
  const costMs = on.fps && off.fps ? +((1000 / on.fps) - (1000 / off.fps)).toFixed(1) : null;
  out.summary = { fpsOn: on.fps, fpsOff: off.fps, costMs, callsAdded: on.calls - off.calls, heapAddedMB: on.heapMB != null && off.heapMB != null ? +(on.heapMB - off.heapMB).toFixed(1) : null, cpuMs: on.crowd && on.crowd.ms, texKB: on.crowd && on.crowd.texKB };
  console.log('장면 | fps | 최악ms | 그리기 | 삼각형 | 힙MB');
  for (const r of out.rows) { console.log(`${r.name} | ${r.fps} | ${r.worstMs} | ${r.calls} | ${r.tris} | ${r.heapMB}`); }
  console.log('GPU', on.gpu, '· 군중', JSON.stringify(on.crowd), '· 비용', costMs, 'ms/프레임 · 그리기 +' + (on.calls - off.calls));
} catch (e) { console.log('ERR', e.message); out.err = e.message; }
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'pw-limitless.json'), JSON.stringify(out, null, 1));
await browser.close(); srv.kill();
