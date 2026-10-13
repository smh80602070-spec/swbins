// W-0197 3D 걸음새 확인 — 1만리 3D 에서 서기·걷기(W)·달리기(Shift+W)를 하며 내 몸의 클립 자리·클립 빠르기·잰 키/초를 찍고, 달리기 중 0.1초 간격 4장을 남긴다.
//   node go-gait.mjs [접두어]   → shots/<접두어>_run{0..3}.jpg · 콘솔 JSON
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 의 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';

const tag = process.argv[2] || 'gait';
const r = await open('saga-go', { w: +(process.env.GW || 1280), h: +(process.env.GH || 720) });   // W-0198 폰 세로: GW=390 GH=844
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const probe = () => ev(() => {
  const n = DG.world3d && DG.world3d.actorNode && DG.world3d.actorNode('me'), u = n && n.userData;
  if (!u || !u.mixer) { return { mesh: false }; }
  return { anim: u.anim, rate: +u.mixer.timeScale.toFixed(2), hps: +((u.gaitSt && u.gaitSt.v) || 0).toFixed(2), run: u.clipMap && u.clipMap.run, walk: u.clipMap && u.clipMap.walk, lean: +(n.rotation.z * 180 / Math.PI).toFixed(1) };
});
const out = {};
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('걸음'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(6000);
  for (let i = 0; i < 12; i++) { const k = await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); if (!k) { break; } await page.keyboard.press('Escape'); await sleep(250); }
  await page.screenshot({ path: `shots/${tag}_idle.jpg`, type: 'jpeg', quality: 80 });   // 처음 선 자리(qc 1-world3d 와 같은 씨앗)
  out.w3 = await ev(() => !!(DG.world3d && DG.world3d.active && DG.world3d.active()));
  await page.mouse.click(640, 200); await sleep(300);
  out.idle = await probe();
  await page.keyboard.down('w'); await sleep(1500); out.walk = await probe();
  await page.keyboard.down('Shift'); await sleep(1500); out.run = await probe();
  for (let i = 0; i < 4; i++) { await page.screenshot({ path: `shots/${tag}_run${i}.jpg`, type: 'jpeg', quality: 80 }); await sleep(100); }
  await page.keyboard.down('a'); await sleep(400); out.turn = await probe(); await page.keyboard.up('a');
  await page.keyboard.up('Shift'); await sleep(800); out.walk2 = await probe();
  await page.keyboard.up('w'); await sleep(800); out.stop = await probe();
  out.errors = r.errors.slice(0, 4);
} catch (e) { out.err = e.message; }
console.log(JSON.stringify(out, null, 1));
await r.close();
process.exit(0);
