// W-0199 1만리 3D 빛 확인 — 같은 자리에서 낮(12시)·노을(17:30)·밤(22시)을 대비 손잡이 켬/끔(light3d.contrast 1/0)으로 찍는다.
//   node go-light.mjs [접두어]   → shots/<접두어>_<noon|dusk|night>_<new|old>.jpg · 콘솔 JSON(그림자 켬·상자 반폭·평균 fps)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 의 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';

const tag = process.argv[2] || 'light';
const r = await open('saga-go', { w: +(process.env.GW || 1280), h: +(process.env.GH || 720) });
const { page } = r;
const ev = (fn, a) => page.evaluate(fn, a);
const out = {};
const TIERX = process.env.TIER || 'high';
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev((tx) => { DG.account.create('빛'); if (tx !== 'auto') { DG.core.setTune({ 'perf.auto': 0, 'perf.startTier': 'HIGH' }); } }, TIERX);   // 헤드리스 10fps 는 자동으로 LOW(그림자·빛 꺼짐) — 기본은 HIGH 로 못박아 빛을 본다
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(7000);
  for (let i = 0; i < 12; i++) { const k = await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); if (!k) { break; } await page.keyboard.press('Escape'); await sleep(250); }
  await page.keyboard.down('w'); await sleep(1800); await page.keyboard.up('w'); await sleep(800);   // 집 곁에서 비켜 땅·몸 그림자가 보이게
  for (const [name, h, m] of [['noon', 12, 0], ['dusk', 17, 30], ['night', 22, 0]]) {
    for (const [lab, k] of [['new', 1], ['old', 0]]) {
      await ev(([hh, mm, kk]) => { const d = new Date(); d.setHours(hh, mm, 0, 0); DG.world3d.forceTime(d.getTime()); DG.core.setTune({ 'light3d.contrast': kk }); }, [h, m, k]);
      await sleep(1600);
      await page.screenshot({ path: `shots/${tag}_${name}_${lab}.jpg`, type: 'jpeg', quality: 80 });
    }
  }
  out.state = await ev(() => { const n = DG.world3d.actorNode && DG.world3d.actorNode('me'); let cast = 0; if (n) { n.traverse((o) => { if (o.isMesh && o.castShadow) { cast++; } }); } return { castMeshes: cast, perf: DG.perf && DG.perf.tierName ? DG.perf.tierName() : null }; });
  await ev(() => { DG.core.setTune({ 'light3d.contrast': null }); DG.world3d.forceTime(null); });
  out.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 4);
} catch (e) { out.err = e.message; }
console.log(JSON.stringify(out));
await r.close();
process.exit(0);
