// W-0389 ③-4 걷기 초반 재기 — 1만리 2D 들판을 폰처럼(390×844·dpr2·CPU 4배·LOW 고정) 띄우고 걷기 키를 누른 순간부터
//   1초마다 FPS·가장 긴 프레임과 field2d 조각 셈(굽기·다시 굽기·미리 굽기·굽기 ms)을 적는다. pw-phone-budget 은 걷기 8초 뒤 3초만 재서
//   "걷기 초반(조각 굽기·그림 받기)"이 안 보였다 — 이 도구는 그 초반을 초 단위로 본다. 읽기만(판정 없음).
//   node pw-walk-ramp.mjs [--secs=14] [--runs=2] [--tune 키=값 …] [--base http://127.0.0.1:8871/]   (서버는 돌리는 쪽이 띄운다 · serve.mjs)
//   --profile  걷는 동안 CDP 프로파일 → 함수별 포함·자기 시간 상위 + 내장(getImageData·restore…) 호출자   --stacks  fill·drawImage 부른 자리 표본
//   늘 적는 것: 초마다 캔버스 호출 수(perFrame — 숲으로 걸어 들어가면 늘던 것을 이걸로 찾았다)·물들이기 시트(tint)·스탬프 캐시 · 끝에 CPU 줄 =
//   렌더러 메인 스레드 실제 CPU ms/프레임(벽시계 FPS 는 다른 세션 GPU 경합으로 호출마다 2배 흔들려, 코드 비교는 이 줄로)
// 결과 results/pw-walk-ramp.json(runs[].sec[] · 평균 줄) + 콘솔 표.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs } from './cdp.mjs';
import { clearOverlays } from './overlay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : (process.env.PW_BASE || 'http://127.0.0.1:8871/')).replace(/\/?$/, '/');
const opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? +a.slice(k.length + 3) : d; };
const SECS = opt('secs', 14), RUNS = opt('runs', 2), PROF = argv.includes('--profile');   // --profile: 걷는 동안 CDP 프로파일 → 포함(inclusive)·자기(self) 시간 상위 표
let profs = [], cpu = [];
const TUNES = [['perf.auto', 0], ['perf.startTier', 'LOW']].concat(argv.map((a, i) => (a === '--tune' ? argv[i + 1] : null)).filter(Boolean)
  .map((kv) => { const j = kv.indexOf('='), v = kv.slice(j + 1); return [kv.slice(0, j), /^-?\d+(\.\d+)?$/.test(v) ? +v : v]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 페이지 안 — secs 초 동안 1초 칸마다 프레임 수·가장 긴 프레임·조각 셈 */
const RAMP = async (secs) => {
  const F = () => (DG.field2d && DG.field2d.chunkStats ? DG.field2d.chunkStats() : {});
  const CP = CanvasRenderingContext2D.prototype, cnt = { drawImage: 0, fill: 0, getImageData: 0, fillText: 0, createCanvas: 0 }, keep = {};
  const stk = () => (new Error().stack || '').split('\n').slice(3, 6).map((l) => { const m = l.match(/at (\S+)/), q = l.match(/:(\d+):\d+\)?$/); return (m ? m[1] : '?') + ':' + (q ? q[1] : ''); }).join(' < ');
  ['drawImage', 'fill', 'getImageData', 'fillText'].forEach((k) => { keep[k] = CP[k]; CP[k] = function () { cnt[k]++; if (window.__WR_STACK && (k === 'fill' || k === 'drawImage') && cnt[k] % 23 === 0) { const B = window.__WR_STACK, kk = k + ' ' + stk(); B[kk] = (B[kk] || 0) + 1; } return keep[k].apply(this, arguments); }; });
  const dce = document.createElement; document.createElement = function (t) { if (t === 'canvas') { cnt.createCanvas++; } return dce.apply(this, arguments); };
  const out = []; let n = 0, worst = 0, last = performance.now(), t0 = last, s0 = F();
  await new Promise((done) => {
    const tick = () => {
      const t = performance.now(); worst = Math.max(worst, t - last); last = t; n++;
      if (t - t0 >= 1000) { const s = F(); out.push({ fps: +(n * 1000 / (t - t0)).toFixed(1), worstMs: Math.round(worst), bakes: (s.bakes || 0) - (s0.bakes || 0), rebakes: (s.rebakes || 0) - (s0.rebakes || 0), pre: (s.pre || 0) - (s0.pre || 0), bakeMs: (s.ms || 0) - (s0.ms || 0), resets: (s.resets || 0) - (s0.resets || 0), n: s.n, px: s.px, tint: DG.mode2d && DG.mode2d._sheetStats ? DG.mode2d._sheetStats() : null, stamp: DG.sprite && DG.sprite.stampStats ? DG.sprite.stampStats() : null, tall: DG.field2d && DG.field2d.tall ? DG.field2d.tall().length : null, pos: DG.core && DG.core.save && DG.core.save.player ? [Math.round(DG.core.save.player.pos.x), Math.round(DG.core.save.player.pos.y)] : null, kind: (() => { try { const p = DG.core.save.player.pos, W = DG.world; return W && W.terrainAt ? W.terrainAt(Math.floor(p.x / 48), Math.floor(p.y / 48)) : null; } catch (e) { return null; } })(), perFrame: Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, +(v / Math.max(1, n)).toFixed(1)])) }); Object.keys(cnt).forEach((k) => { cnt[k] = 0; }); n = 0; worst = 0; t0 = t; s0 = s; }
      if (out.length < secs) { requestAnimationFrame(tick); } else { Object.keys(keep).forEach((k) => { CP[k] = keep[k]; }); document.createElement = dce; done(); }
    };
    requestAnimationFrame(tick);
  });
  return out;
};

async function one(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page), url = BASE + 'saga-go/?mode=2d';
  try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없음 */ }
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(1500);
  await page.evaluate((tn) => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('예산'); tn.forEach(([k, v]) => DG.core.setTune(k, v)); }, TUNES);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }); await sleep(4000);
  await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(4000);
  await clearOverlays(page, 'saga-go'); await sleep(6000);
  if (PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); }
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' }).catch(() => cdp.send('Performance.enable'));
  const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const m0 = await pm();
  await page.keyboard.down('w');
  if (PROF) { await cdp.send('Profiler.start'); }
  if (argv.includes('--stacks')) { await page.evaluate(() => { window.__WR_STACK = {}; }); }
  const sec = await page.evaluate(RAMP, SECS);
  if (argv.includes('--stacks')) { const B = await page.evaluate(() => window.__WR_STACK); Object.entries(B).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log('STACK ' + v + ' ' + k)); }
  if (PROF) { profs.push((await cdp.send('Profiler.stop')).profile); }
  const m1 = await pm(); await page.keyboard.up('w');
  await ctx.close();
  const frames = sec.reduce((a, x) => a + x.fps, 0);   // 1초 칸마다 fps = 그 칸 프레임 수
  cpu.push({ threadMs: +((m1.ThreadTime - m0.ThreadTime) * 1000).toFixed(0), scriptMs: +((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0), frames: Math.round(frames), msPerFrame: +((m1.ThreadTime - m0.ThreadTime) * 1000 / Math.max(1, frames)).toFixed(1) });
  return sec;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs({ gpu: true }) });
const runs = [];
try { for (let k = 0; k < RUNS; k++) { runs.push(await one(browser)); } } finally { await browser.close(); }
/** 프로파일 → 함수(이름 @파일)별 포함·자기 ms — 포함은 한 표본 스택에서 같은 함수를 한 번만 센다 */
function tally(P) {
  const byId = new Map(), parent = new Map(), inc = new Map(), self = new Map(), callers = new Map();
  P.nodes.forEach((n) => { byId.set(n.id, n); (n.children || []).forEach((c) => parent.set(c, n.id)); });
  const key = (n) => { const f = n.callFrame; return (f.functionName || '(anon)') + ' @' + (f.url || '').split('/').slice(-2).join('/') + ':' + f.lineNumber; };
  const dts = P.timeDeltas || [];
  P.samples.forEach((id, i) => { const dt = (dts[i + 1] != null ? dts[i + 1] : 0) / 1000, seen = new Set(); let n = byId.get(id); const sk = key(n); self.set(sk, (self.get(sk) || 0) + dt);
    if (/^(restore|getImageData|drawImage|save|fill|putImageData) @/.test(sk)) { const p = byId.get(parent.get(n.id)), pk = sk.split(' ')[0] + ' ← ' + (p ? key(p) : '?'); callers.set(pk, (callers.get(pk) || 0) + dt); }
    while (n) { const k = key(n); if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) || 0) + dt); } n = byId.get(parent.get(n.id)); } });
  return { inc, self, callers, total: (P.endTime - P.startTime) / 1000 };
}
if (PROF) { profs.forEach((P, r) => { const t = tally(P), top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log('— run ' + (r + 1) + ' 전체 ' + Math.round(t.total) + 'ms · 포함 상위');
  top(t.inc, 45).forEach(([k, v]) => console.log('  inc ' + (v / t.total * 100).toFixed(1) + '% ' + k));
  console.log('  · 내장 호출자'); top(t.callers, 16).forEach(([k, v]) => console.log('  call ' + (v / t.total * 100).toFixed(1) + '% ' + k)); console.log('  · 자기 상위'); top(t.self, 20).forEach(([k, v]) => console.log('  self ' + (v / t.total * 100).toFixed(1) + '% ' + k)); }); }
const avg = (i, f) => +(runs.reduce((a, r) => a + (r[i] ? r[i][f] : 0), 0) / runs.length).toFixed(1);
const mean = runs[0].map((_, i) => ({ s: i + 1, fps: avg(i, 'fps'), worstMs: avg(i, 'worstMs'), bakes: avg(i, 'bakes'), rebakes: avg(i, 'rebakes'), pre: avg(i, 'pre'), bakeMs: avg(i, 'bakeMs') }));
const all = (f) => +(mean.reduce((a, x) => a + x[f], 0) / mean.length).toFixed(1);
console.log('초 fps 최악ms 굽기 다시 미리 굽기ms');
mean.forEach((x) => console.log(`${x.s} ${x.fps} ${x.worstMs} ${x.bakes} ${x.rebakes} ${x.pre} ${x.bakeMs}`));
console.log('CPU ' + cpu.map((c) => c.msPerFrame + 'ms/프레임(스레드 ' + c.threadMs + 'ms · 스크립트 ' + c.scriptMs + 'ms · ' + c.frames + '프레임)').join(' | ') + ' · 평균 ' + (cpu.reduce((a, c) => a + c.msPerFrame, 0) / cpu.length).toFixed(1) + 'ms/프레임');
console.log(`WALKRAMP 평균 ${all('fps')}fps · 앞 5초 ${+(mean.slice(0, 5).reduce((a, x) => a + x.fps, 0) / 5).toFixed(1)} · 굽기ms 합 ${+mean.reduce((a, x) => a + x.bakeMs, 0).toFixed(0)} · tunes ${JSON.stringify(TUNES.slice(2))} · runs ${RUNS}`);
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'pw-walk-ramp.json'), JSON.stringify({ at: new Date().toISOString(), tunes: TUNES, runs, mean, cpu }, null, 1));
