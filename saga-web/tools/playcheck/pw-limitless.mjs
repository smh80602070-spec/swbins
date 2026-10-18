// "웹엔 한계가 없다" 측정(W-0310) — _demo.html#limitless 를 실제 GPU(d3d11) 헤드리스 1280×720 으로 열어
//   군중 N 명(기본 300) → +물리(래그돌 20·돌 12·풀 눕힘) → +지평선(먼 땅 고리 2.2km·숲 임포스터) → +비 2만 → +눈 2만 → 전부 끈 바탕, 장면마다 FPS·그리기 수·삼각형·JS 힙·군중 CPU ms 를 3초씩 잰다.
//   node saga-web/tools/playcheck/pw-limitless.mjs [--n=300] [--drops=20000] [--ragdoll=20] [--rocks=12] [--trees=2500] [--phone] [--swiftshader]   → results/pw-limitless.json + 콘솔 표 + shots/limitless-*.png
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const N = +opt('n', 300), DROPS = +opt('drops', 20000), RAG = +opt('ragdoll', 20), ROCKS = +opt('rocks', 12), TREES = +opt('trees', 2500), PHONE = argv.includes('--phone'), SW = argv.includes('--swiftshader');
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
  return { fps: +(n / ((last - t0) / 1000)).toFixed(1), worstMs: Math.round(worst), calls: mc, tris: mt, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, tier: DG.perf && DG.perf.tier ? DG.perf.tier().key : null, st: DG.limitless ? DG.limitless.stats() : null };
};
const out = { at: new Date().toISOString(), n: N, drops: DROPS, ragdoll: RAG, rocks: ROCKS, trees: TREES, phone: PHONE, gpu: !SW, rows: [] };
try {
  const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' } : { viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('console', (m) => { if (m.type() === 'error' || /shader|THREE/i.test(m.text())) { errs.push(m.text().slice(0, 300)); } }); page.on('pageerror', (e) => errs.push('PAGE ' + String(e.message).slice(0, 300)));
  if (PHONE) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  const B = `http://127.0.0.1:${PORT}/`;
  /* 품질 높음 고정(pw-gfx 와 같은 손잡이) — 자동이면 첫 멈춤에서 LOW 로 떨어져 집이 민짜가 된다 */
  await page.goto(B + '_demo.html#limitless,n=' + N + ',physics=0,horizon=0,ragdoll=' + RAG + ',rocks=' + ROCKS, { waitUntil: 'load' });
  /* PC 는 높음 고정(자동이면 첫 멈춤에서 LOW 로 떨어진다) · 폰은 자동 단계 그대로(시연이 밀도를 줄이는지 본다) */
  await page.evaluate((ph) => { if (DG.perf && DG.perf.pin) { DG.perf.pin(ph ? 'LOW' : 'HIGH'); } }, PHONE);   // 데모는 DG_NO_TUNE 이라 setTune+reload 는 사라진다 — 시연이 2.5초 뒤 서기 전에 단계를 못박는다
  for (let i = 0; i < 90; i++) { await sleep(1000); const st = await page.evaluate(() => DG.limitless && DG.limitless.stats()); if (st && (st.ready || st.err)) { if (st.err) { console.log('ERR', st.err); } break; } }
  await sleep(2500);
  fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
  const shot = (name) => page.screenshot({ path: path.join(HERE, 'shots', 'limitless-' + name + (PHONE ? '-phone' : '') + '.png') });
  /* 장면마다 두 번 재서 fps 높은 쪽(첫 3초는 셰이더 컴파일·그림자 굽기 멈춤이 섞인다) */
  const row = async (name) => { const a = await page.evaluate(MEASURE); const b = await page.evaluate(MEASURE); const r = b.fps >= a.fps ? b : a; out.rows.push({ name, ...r, first: a.fps }); return r; };
  const on = await row('군중 ' + N); await shot(N);
  await page.evaluate(() => DG.limitless.physics(1)); await sleep(2500);
  const phys = await row('군중 + 물리(래그돌 ' + RAG + '·돌 ' + ROCKS + ')'); await shot(N + '-phys');
  await page.evaluate(() => DG.limitless.physics(0)); await sleep(800);
  await page.evaluate((n) => { DG.core.setTune('far3d.trees', n); DG.limitless.horizon(1); }, TREES); await sleep(2500);
  const far = await row('군중 + 지평선(고리 2.2km·임포스터)'); await shot(N + '-far');
  await page.evaluate(() => DG.limitless.horizon(0)); await sleep(800);
  await page.evaluate((d) => { DG.core.setTune('weather3d.n', d); DG.limitless.weather('rain'); }, DROPS); await sleep(2000);
  const rain = await row('군중 + 비 ' + DROPS); await shot(N + '-rain');
  await page.evaluate(() => DG.limitless.weather('snow')); await sleep(2000);
  const snow = await row('군중 + 눈 ' + DROPS); await shot(N + '-snow');
  await page.evaluate(() => { DG.limitless.weather('off'); DG.limitless.stop(); }); await sleep(1500);
  const off = await row('전부 끔(바탕)');
  /* ⑤ WebGPU 손잡이 — 같은 페이지를 webgpu=1 로 다시 열어 렌더러 종류·이유만 적는다(WebGL 빌드라 되돌아와야 정상) */
  if (!PHONE) { await page.goto(B + '_demo.html#limitless,n=0,physics=0,horizon=0,webgpu=1', { waitUntil: 'load' }); await page.reload({ waitUntil: 'load', timeout: 90000 }); await sleep(4000); }   // 해시만 바뀌면 다시 안 열려 reload
  out.webgpu = PHONE ? null : await page.evaluate(() => (DG.limitless && DG.limitless.stats().renderer) || null); if (!PHONE) { await shot('webgpu'); }
  out.gpuName = on.gpu; out.errors = errs.slice(0, 8); if (errs.length) { console.log('콘솔 오류 ' + errs.length + ': ' + errs.slice(0, 3).join(' | ')); }
  const ms = (a, b) => a.fps && b.fps ? +((1000 / a.fps) - (1000 / b.fps)).toFixed(1) : null;
  out.summary = { fpsCrowd: on.fps, fpsPhys: phys.fps, fpsFar: far.fps, fpsRain: rain.fps, fpsSnow: snow.fps, fpsOff: off.fps, crowdMs: ms(on, off), physMs: ms(phys, on), farMs: ms(far, on), rainMs: ms(rain, on), snowMs: ms(snow, on), callsCrowd: on.calls - off.calls, callsPhys: phys.calls - on.calls, callsFar: far.calls - on.calls, trisFar: far.tris - on.tris, farSt: far.st && far.st.far, callsRain: rain.calls - on.calls, cpuMs: on.st && on.st.ms, physCpuMs: phys.st && phys.st.physMs, ragdolls: phys.st && phys.st.ragdolls, texKB: on.st && on.st.texKB };
  console.log('장면 | fps | 최악ms | 그리기 | 삼각형 | 힙MB | 단계');
  for (const r of out.rows) { console.log(`${r.name} | ${r.fps} | ${r.worstMs} | ${r.calls} | ${r.tris} | ${r.heapMB} | ${r.tier}${r.st && r.st.density < 1 ? ' ×' + r.st.density : ''}`); }
  console.log('WebGPU 손잡이', JSON.stringify(out.webgpu));
  console.log('GPU', on.gpu, '· 군중', JSON.stringify(on.st), '· 비용 군중', out.summary.crowdMs, 'ms · 물리', out.summary.physMs, 'ms(CPU ' + out.summary.physCpuMs + ', 래그돌 ' + out.summary.ragdolls + ') · 지평선', out.summary.farMs, 'ms(그리기 +' + out.summary.callsFar + ', 삼각형 +' + out.summary.trisFar + ', ' + JSON.stringify(out.summary.farSt) + ') · 비', out.summary.rainMs, 'ms · 눈', out.summary.snowMs, 'ms · 그리기 군중 +' + out.summary.callsCrowd + ' 물리 +' + out.summary.callsPhys + ' 비 +' + out.summary.callsRain);
} catch (e) { console.log('ERR', e.message); out.err = e.message; }
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'pw-limitless' + (PHONE ? '-phone' : '') + '.json'), JSON.stringify(out, null, 1));   // PC·폰 결과를 따로
await browser.close(); srv.kill();
