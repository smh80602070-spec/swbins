// 늦게 오는 그림의 「누가 불렀나」 추적(W-0449 남은 것) — dist 번들 대신 manifest 낱개 js 를 sourceURL 붙여 싣고(함수 이름·줄이 보임),
//   img.src·fetch 를 부른 호출 경로를 남긴다. 막이 걷힌 뒤 받기가 시작된 그림·모델만 경로 위 3칸을 찍는다.
//   node popin-trace.mjs <판> [2d|3d] [secs=16]   (서버 :8871)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const game = process.argv[2] || 'saga-dungeon', mode = process.argv[3] || '3d', secs = +(process.argv[4] || 16);
const man = JSON.parse(fs.readFileSync(path.join(ROOT, game, 'js', 'manifest.json'), 'utf8'));
const bundles = Array.isArray(man.bundle) ? man.bundle : [man.bundle];
const r = await open(game, { w: 1280, h: 720, gpu: true });
const ev = (f, a) => r.page.evaluate(f, a);
await r.page.route('**/' + game + '/dist/*.js', async (route) => {
  const u = route.request().url(), name = 'dist/' + u.split('/dist/')[1].split('?')[0], gi = Math.max(0, bundles.indexOf(name));
  const files = (man.index[gi] || []);
  const body = files.map((f) => { let src = ''; try { src = fs.readFileSync(path.join(ROOT, game, f), 'utf8'); } catch (e) { return '/* 없음 ' + f + ' */'; } return '(0,eval)(' + JSON.stringify(src + '\n//# sourceURL=' + f) + ');'; }).join('\n');
  await route.fulfill({ status: 200, contentType: 'application/javascript', body });
});
await r.page.addInitScript(() => {
  Error.stackTraceLimit = 40; const ASSET = /\.(glb|gltf|webp|png|jpe?g|ktx2)(\?|#|$)/i, t0 = performance.now();
  window.__tr = [];
  const rec = (url) => { if (!ASSET.test(String(url))) { return; } const st = (new Error().stack || '').split('\n').slice(2).map((s) => s.trim()).filter((s) => /js\//.test(s) && !/zone-cut|popin|vendor\//.test(s)).slice(0, 5); window.__tr.push([Math.round(performance.now() - t0), String(url).replace(/^.*?\/(saga-web\/)?/, '').split('?')[0], st]); };
  const IP = HTMLImageElement.prototype, d = Object.getOwnPropertyDescriptor(IP, 'src');
  Object.defineProperty(IP, 'src', { configurable: true, get: d.get, set: function (v) { rec(v); return d.set.call(this, v); } });
  const f0 = window.fetch; window.fetch = function (u) { rec(typeof u === 'string' ? u : (u && u.url)); return f0.apply(this, arguments); };
});
try {
  await r.page.goto(r.url('index.html?mode=' + mode), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await ev(() => { try { localStorage.clear(); } catch (e) { /* noop */ } DG.account.create('추적'); });
  await r.page.goto(r.url('index.html?mode=' + mode), { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await ev(() => { window.__veilOff = 0; let on = false; setInterval(() => { const lv = document.getElementById('load-veil'); let s = !!(lv && !lv.classList.contains('out')); for (const id of ['zone-cut', 'zone-cut2']) { const z = document.getElementById(id); if (z && z.style.opacity === '1') { s = true; } } if (on && !s) { window.__veilOff = performance.now(); } on = s; }, 50); });
  await ev(() => {   // 대기열(async) 너머 시작점 — 판의 3D 짓기 입구(asset3d.build·buildHero)를 부른 경로도 남긴다
    const A = window.DG && DG.asset3d; if (!A) { return; }
    ['build', 'buildHero'].forEach((k) => { const f = A[k]; if (typeof f !== 'function') { return; } A[k] = function (a) { const st = (new Error().stack || '').split('\n').slice(2).map((s) => s.trim()).filter((s) => /js\//.test(s) && !/vendor\//.test(s)).slice(0, 5); window.__tr.push([Math.round(performance.now()), k + ':' + (typeof a === 'string' ? a : (a && (a.id || a.kind || a.key)) || '?'), st]); return f.apply(this, arguments); }; });
  });
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  if (game === 'saga-dungeon') { await sleep(1500); await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); }
  const tEnd = Date.now() + secs * 1000;
  while (Date.now() < tEnd) { await sleep(700); await clearOverlays(r.page, game).catch(() => {}); }
  const res = await ev(() => ({ tr: window.__tr, off: window.__veilOff }));
  const t0p = await ev(() => 0);
  const late = res.tr.filter(([t]) => res.off && t > res.off + 400 - 0);
  console.log('veilOff(ms since nav)', Math.round(res.off), 'late', late.length, '/', res.tr.length, t0p);
  const by = {};
  for (const [t, u, st] of late) { const k = st.join(' ← ') || '(경로 없음)'; (by[k] = by[k] || []).push(t + 'ms ' + u.split('/').slice(-2).join('/')); }
  for (const k of Object.keys(by)) { console.log('PATH', k.replace(/https?:\/\/[^ ]*?\/(saga-[a-z]+\/)?/g, '')); by[k].slice(0, 4).forEach((x) => console.log('    ', x)); }
} catch (e) { console.log('ERR', e.message.slice(0, 300)); }
console.log('errors', JSON.stringify(r.errors.filter((e) => !/404/.test(e)).slice(0, 3)));
await r.close();
