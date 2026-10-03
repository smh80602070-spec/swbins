// 2D 모드 배경 층·바닥 타일이 실제로 받아지고 그려지는지 본다 — mode2d 의 drawBg·fillTile (W-0019)
//   node pw-web2d.mjs <판 폴더>        예) node pw-web2d.mjs saga-story
// 판의 DG.cfg.mode2d.region(사냥터→지역)·tile(종류→타일) 에 적힌 이름을 전부 받아, 오프스크린 캔버스에 그려
// 불투명 화소 비율을 찍는다(스크린샷 아님). 받기 실패·빈 그림이 있으면 종료 1.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const game = process.argv[2];
if (!game) { console.log('사용: node pw-web2d.mjs saga-story'); process.exit(1); }
const r = await open(game);
const { page } = r;
await page.goto(r.url('index.html')); await sleep(1500);
const out = await page.evaluate(async () => {
  const M = window.DG.mode2d, cfg = window.DG.cfg.mode2d;
  const regions = [...new Set(Object.values(cfg.region || {}))], tiles = [...new Set(Object.values(cfg.tile || {}))];
  regions.forEach((g) => M.preloadBg(g));
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  const wait = async (f) => { for (let i = 0; i < 80 && !f(); i++) { await new Promise((ok) => setTimeout(ok, 100)); } return f(); };
  const res = { regions: {}, tiles: {} };
  const solid = (y0, y1) => { const d = x.getImageData(0, y0, 1280, y1 - y0).data; let n = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] > 250) { n++; } } return +(n / (d.length / 4)).toFixed(3); };
  for (const g of regions) {
    const ok = await wait(() => M.bgReady(g));
    x.clearRect(0, 0, 1280, 720);
    const a = ok && M.drawBg(x, { region: g, camX: 0, W: 1280, H: 720, base: 560 });
    const s0 = solid(0, 560);
    x.clearRect(0, 0, 1280, 720);
    M.drawBg(x, { region: g, camX: 2100, W: 1280, H: 720, base: 560 });
    res.regions[g] = { ready: ok, drew: !!a, skyFill: s0, scrolledFill: solid(0, 560) };
  }
  for (const t of tiles) {
    const ok = await wait(() => M.tile(t));
    x.clearRect(0, 0, 1280, 720);
    const a = ok && M.fillTile(x, { id: t, x: 0, y: 560, w: 1280, h: 160, dx: 123 });
    res.tiles[t] = { ready: !!ok, drew: !!a, fill: solid(560, 720) };
    if (M.fillIso) {   // 아이소 바닥(사가블로) — 마름모 한가운데 한 점이 불투명이어야 한다
      x.clearRect(0, 0, 1280, 720);
      const iso = M.fillIso(x, { id: t, a: 0.84, b: 0.46, c: -0.84, d: 0.46, e: 640, f: 100, W: 600, H: 600, tint: '#2a2620' });
      const px = x.getImageData(640, 100 + 0.46 * 600, 1, 1).data[3];
      res.tiles[t].iso = !!iso && px === 255;
    }
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
const bad = [];
Object.entries(out.regions).forEach(([k, v]) => { if (!v.ready || !v.drew || v.skyFill < 0.95 || v.scrolledFill < 0.95) { bad.push(k); } });
Object.entries(out.tiles).forEach(([k, v]) => { if (!v.ready || !v.drew || v.fill < 0.99 || v.iso === false) { bad.push(k); } });
console.log(bad.length ? 'FAIL ' + bad.join(',') : 'OK 지역 ' + Object.keys(out.regions).length + ' · 타일 ' + Object.keys(out.tiles).length);
await r.close();
process.exit(bad.length ? 1 : 0);
