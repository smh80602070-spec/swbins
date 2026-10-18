// 2나락 로딩 순서 탐침(사용자 10-17 "화면 로딩 되는 부분이 보기 싫어" · W-0325) — 이어하기 누른 뒤 0.5·1.5·3·8·12초 사진 + 몸 상태
//   box = **보이는** 대역 상자(GLB 를 기다리며 숨은 것은 안 셈) · boxOnScreen = 그중 카메라 시야 안 · glb = GLB 로 바뀐 몸 · veil = 가림막 · ratio = 시야 안 GLB 비율
//   node dg-load-seq.mjs   (서버 :8871 — 돌리는 쪽이 띄우고 끈다)   → results/dg-load-seq.json · shots/dg_load_<ms>.png
//   QC(tools/qc.mjs "로딩" 줄)가 읽는다: 3초 시야 안 상자 > 0 이거나 8초 > 10 이면 WARN.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = await open('saga-dungeon', { w: 1600, h: 900, gpu: !process.env.PW_SWIFT });   // 실제 GPU(QC 렌더러 줄과 같게) — swiftshader 는 PW_SWIFT=1
const BODIES = () => r.page.evaluate(() => {
  try {
    const D3 = DG.dungeon3d; if (!D3 || !D3.three) { return null; }
    const T = D3.three(), n = new T.Object3D(); D3.addFx(n); let sc = n.parent; if (n.parent) { n.parent.remove(n); }
    while (sc && sc.parent) { sc = sc.parent; }
    const cam = D3.camNode ? D3.camNode() : null, fr = new T.Frustum(), m = new T.Matrix4(), v = new T.Vector3();
    if (cam) { cam.updateMatrixWorld(); m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(m); }
    const c = { glb: 0, box: 0, boxOnScreen: 0, ghost: 0, fail: 0 };
    if (sc) {
      sc.traverse((o) => {
        const k = o.userData && o.userData.assetState; if (!k || !o.visible) { return; }
        if (k === 'glb') { c.glb++; return; }
        if (k === 'fail') { c.fail++; return; }
        const g = o.userData.ghost, shown = g ? g.visible : o.children.some((x) => x.visible);
        if (!shown) { c.ghost++; return; }
        c.box++; o.getWorldPosition(v); if (cam && fr.containsPoint(v)) { c.boxOnScreen++; }
      });
    }
    return { veil: !!(DG.loadVeil && DG.loadVeil.shown()), why: DG.loadVeil && DG.loadVeil.why ? DG.loadVeil.why() : null, pend: DG.asset3d.hiPending ? DG.asset3d.hiPending() : null, ratio: DG.asset3d.readyRatio ? +DG.asset3d.readyRatio().toFixed(2) : null, ...c };
  } catch (e) { return { err: 'ERR ' + e.message }; }
});
const out = { at: new Date().toISOString(), rows: [], re: [], glbAt: [] };
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await r.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} DG.account.create('로딩'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(3500);
  await r.page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  await r.page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
  await r.page.evaluate(() => { window.__veil = []; let prev = null; const s0 = performance.now(); setInterval(() => { const s = DG.loadVeil.shown(); if (s !== prev) { window.__veil.push([Math.round(performance.now() - s0), s, DG.loadVeil.why(), DG.asset3d.hiPending(), +DG.asset3d.readyRatio().toFixed(2)]); prev = s; } }, 50); });
  let t0 = Date.now();
  for (const at of [500, 1500, 3000, 8000, 12000]) {
    while (Date.now() - t0 < at) { await sleep(50); }
    await r.page.evaluate(() => { if (DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) { DG.scenario.skip(); } });
    const b = await BODIES();
    await r.page.screenshot({ path: path.join(HERE, 'shots', `dg_load_${at}.png`) });
    out.rows.push({ ms: at, ...b });
    console.log('t', at, JSON.stringify(b));
  }
  out.veil = await r.page.evaluate(() => window.__veil); out.tier = await r.page.evaluate(() => (DG.perf && DG.perf.tier ? DG.perf.tier().key : null)); console.log('veil', JSON.stringify(out.veil), 'tier', out.tier);
  /* 새로 고침 → 이어하기(돌아온 사용자 경로) */
  await r.page.reload({ waitUntil: 'domcontentloaded' });
  t0 = Date.now();
  for (const at of [800, 2500, 5000]) {
    while (Date.now() - t0 < at) { await sleep(50); }
    await r.page.screenshot({ path: path.join(HERE, 'shots', `dg_load_re_${at}.png`) });
    const b = await BODIES(); out.re.push({ ms: at, ...b });
    console.log('re', at, JSON.stringify(b));
    if (at === 2500) { await r.page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await clearOverlays(r.page, 'saga-dungeon'); }
  }
  out.glbAt = await r.page.evaluate(() => performance.getEntriesByType('resource').filter((x) => /.glb/.test(x.name)).map((x) => x.name.split('/').slice(-2).join('/') + '@' + Math.round(x.responseEnd)).slice(0, 40));
  console.log('404', r.notFound.slice(0, 8).join(' | '));
  console.log('glb', JSON.stringify(out.glbAt.slice(0, 30)));
} catch (e) { console.log('ERR', e.message); out.err = e.message; }
out.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 6);
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'dg-load-seq.json'), JSON.stringify(out, null, 1));
await r.close();
