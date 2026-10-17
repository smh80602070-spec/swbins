// 2나락 로딩 순서 탐침(사용자 10-17 "화면 로딩 되는 부분이 보기 싫어") — 이어하기 누른 뒤 0.5·1.5·3·6·12초 사진 + 몸 상태(GLB/대역 상자) 수
import { open, sleep } from './pw.mjs';
const r = await open('saga-dungeon', { w: 1600, h: 900 });
const BODIES = () => r.page.evaluate(() => {
  try {
    const D3 = DG.dungeon3d; if (!D3 || !D3.three) { return null; }
    const n = new (D3.three().Object3D)(); D3.addFx(n); let sc = n.parent; if (n.parent) { n.parent.remove(n); }
    while (sc && sc.parent) { sc = sc.parent; }
    const c = { glb: 0, shape: 0, fail: 0, other: 0 };
    if (sc) { sc.traverse((o) => { const k = o.userData && o.userData.assetState; if (k && o.visible) { c[c[k] !== undefined ? k : 'other']++; } }); }
    const guard = document.getElementById('boot-guard');
    return { veil: !!(DG.loadVeil && DG.loadVeil.shown()), pend: DG.asset3d.hiPending ? DG.asset3d.hiPending() : null, c, guard: guard ? getComputedStyle(guard).display + ':' + (guard.textContent || '').trim().slice(0, 40) : null, overlay: [...document.querySelectorAll('[id*=load], [class*=load]')].filter((e) => e.offsetParent).map((e) => e.id || e.className).slice(0, 4) };
  } catch (e) { return 'ERR ' + e.message; }
});
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await r.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} DG.account.create('로딩'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(3500);
  await r.page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  await r.page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
  let t0 = Date.now();
  for (const at of [500, 1500, 3000, 6000, 12000]) {
    while (Date.now() - t0 < at) { await sleep(50); }
    await r.page.evaluate(() => { if (DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) { DG.scenario.skip(); } });
    const b = await BODIES();
    await r.page.screenshot({ path: `shots/dg_load_${at}.png` });
    console.log('t', at, JSON.stringify(b));
  }
  /* 새로 고침 → 이어하기(돌아온 사용자 경로) */
  await r.page.reload({ waitUntil: 'domcontentloaded' });
  t0 = Date.now();
  for (const at of [800, 2500, 5000]) {
    while (Date.now() - t0 < at) { await sleep(50); }
    await r.page.screenshot({ path: `shots/dg_load_re_${at}.png` });
    console.log('re', at, JSON.stringify(await BODIES()));
    if (at === 2500) { await r.page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); }
  }
  console.log('404', r.notFound.slice(0, 8).join(' | '));
  console.log('glb', JSON.stringify(await r.page.evaluate(() => performance.getEntriesByType('resource').filter((x) => /.glb/.test(x.name)).map((x) => x.name.split('/').slice(-2).join('/') + '@' + Math.round(x.responseEnd)).slice(0, 30))));
  console.log('pending', JSON.stringify(await r.page.evaluate(() => { const A = DG.asset3d || DG.assets3d; return A && A.stats ? A.stats() : Object.keys(A || {}).slice(0, 30); })));
} catch (e) { console.log('ERR', e.message); }
await r.close();
