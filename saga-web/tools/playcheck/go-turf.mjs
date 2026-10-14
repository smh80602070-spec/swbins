// W-0209 1만리 3D 발밑 잔풀 확인 — 풀 칸 한가운데로 옮겨 한낮에 여름·가을 한 장씩, 바람 천후에서 0.3초 간격 두 장(발밑 확대).
//   node go-turf.mjs [접두어]   → shots/<접두어>_<summer|autumn|wind_a|wind_b>.jpg · 콘솔 JSON(풀 칸·잔풀 수·흔들림 폭)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 의 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';

const tag = process.argv[2] || 'turf';
const r = await open('saga-go', { w: 1280, h: 720 });
const { page } = r;
const ev = (fn, a) => page.evaluate(fn, a);
const out = {};
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('풀'); DG.core.setTune({ 'perf.auto': 0, 'perf.startTier': 'HIGH' }); });   // 헤드리스 저 fps 는 자동 LOW(잔풀 없음) — HIGH 로 못박음
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(7000);
  for (let i = 0; i < 12; i++) { const k = await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); if (!k) { break; } await page.keyboard.press('Escape'); await sleep(250); }
  /* 가까운 풀 칸 — 둘레 3칸도 풀인 곳(사방이 잔풀) */
  out.cell = await ev(() => {
    const W = DG.world, p = DG.core.save.player.pos, g0x = Math.floor(p.x / 48), g0y = Math.floor(p.y / 48);
    const grass = (x, y) => W.terrainAt(x, y) === 'grass';
    for (let rr = 1; rr < 40; rr++) {
      for (let dx = -rr; dx <= rr; dx++) {
        for (let dy = -rr; dy <= rr; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) { continue; }
          const x = g0x + dx, y = g0y + dy;
          if (grass(x, y) && grass(x + 1, y) && grass(x - 1, y) && grass(x, y + 1) && grass(x, y - 1)) { p.x = (x + 0.5) * 48; p.y = (y + 0.5) * 48; return { x, y, rr }; }
        }
      }
    }
    return null;
  });
  await ev(() => { const d = new Date(); d.setHours(12, 0, 0, 0); DG.world3d.forceTime(d.getTime()); DG.weather.force('clear'); });
  await sleep(2500);
  for (const s of ['summer', 'autumn']) {
    await ev((k) => { DG.season.force(k); }, s);
    await sleep(1800);
    await page.screenshot({ path: `shots/${tag}_${s}.jpg`, type: 'jpeg', quality: 82 });
  }
  await ev(() => { DG.season.force('summer'); DG.weather.force('wind'); });
  await sleep(1500);
  const clip = { x: 340, y: 380, width: 600, height: 320 };
  await page.screenshot({ path: `shots/${tag}_wind_a.jpg`, type: 'jpeg', quality: 88, clip });
  await sleep(300);
  await page.screenshot({ path: `shots/${tag}_wind_b.jpg`, type: 'jpeg', quality: 88, clip });
  out.state = await ev(() => { let n = null; DG.world3d.scene && DG.world3d.scene().traverse((o) => { if (o.name === 'turf3d') { n = o.count; } }); return { turf: n, sway: DG.ground3d.turfSway('wind'), tier: DG.perf && DG.perf.tierName ? DG.perf.tierName() : null, season: DG.season.now().key }; }).catch((e) => ({ err: e.message }));
  await ev(() => { DG.season.force(null); DG.weather.force(null); DG.world3d.forceTime(null); });
  out.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 4);
} catch (e) { out.err = e.message; }
console.log(JSON.stringify(out));
await r.close();
process.exit(0);
