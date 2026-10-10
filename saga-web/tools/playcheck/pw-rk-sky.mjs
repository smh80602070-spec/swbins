// 5천하 3D 지도 하늘·물·재질 확인 그림(W-0141) — 낮·밤 × 위(기본 시점)·낮게(끌어 지평선이 보이게) 네 장.
//   node pw-rk-sky.mjs [real 0|1] [출력 접두어]   (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// real 0 = 손잡이 realm3d.real 0(옛 화면) 비교용. 헤드리스(swiftshader)는 지도를 두 번 끌면 옛 화면에서도 탭이 죽어서 끌기는 한 번뿐이다.
import { open, sleep } from './pw.mjs';

const [real, OUT] = [process.argv[2] || '1', process.argv[3] || 'shots/rk-sky/sky'];
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r = await open('saga-realm'); const { page } = r; const ev = (f, a) => page.evaluate(f, a);
await page.addInitScript(SEED);
const stats = () => ev(() => ({ sky: DG.realmSky3d.stats(), water: DG.realmWater3d.stats(), tier: DG.realm3d.tier() }));
const setTime = async (tm) => { await ev((x) => { DG.core.setTune('realm3d.skyTime', x); DG.core.emit('changed'); }, tm); await sleep(3500); };
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
  await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
  const sc = page.locator('[data-act="pick-scen"]'); if (await sc.count()) { await sc.first().click(); await sleep(800); await page.locator('[data-act="pick-force"]').first().click(); await sleep(2500); }
  for (let i = 0; i < 8; i++) { await ev(() => { try { DG.ui.closeEnc(); DG.ui.closeSheet(); } catch (e) { /* 없음 */ } }); await sleep(200); }
  await ev((v) => { DG.core.setTune('realm3d.real', +v); }, real);
  if (!await ev(() => DG.realm3d.active())) { await page.locator('#btn-3d').click(); }
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await ev(() => DG.realm3d.staticCullStats().drawn) > 0) { break; } }
  await sleep(3000);
  await setTime('noon'); console.log('noon', JSON.stringify(await stats())); await page.screenshot({ path: OUT + '-noon-top.png' });
  await setTime('night'); console.log('night', JSON.stringify(await stats())); await page.screenshot({ path: OUT + '-night-top.png' });
  const box = await page.locator('#realm3d').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy - 260, { steps: 12 }); await page.mouse.up(); await sleep(2500);
  await page.screenshot({ path: OUT + '-night-low.png' });
  await setTime('noon'); await page.screenshot({ path: OUT + '-noon-low.png' });
  await ev(() => { DG.core.setTune('realm3d.skyTime', 'auto'); });
  console.log('errors', r.errors.length, r.errors.slice(0, 3).join(' | '));
} finally { await r.close(); }
