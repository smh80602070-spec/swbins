// 2D 시트 풀의 몸 크기를 잰다 — mode2d 의 `poolH`(프레임 안 몸 높이)·발 위치를 정하는 근거. (W-0019)
//   node pw-sheet-bbox.mjs <판 폴더>        예) node pw-sheet-bbox.mjs saga-dungeon
// 판의 assets/sprites2d_sheets/index.json 풀마다 idle·walk 옆모습(1행) 8프레임의 알파 범위를 모아 {poolH, top, bottom} 을 찍는다.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const game = process.argv[2];
if (!game) { console.log('사용: node pw-sheet-bbox.mjs saga-dungeon'); process.exit(1); }
const r = await open(game);
const { page } = r;
await page.goto(r.url('index.html')); await sleep(1500);
const out = await page.evaluate(async () => {
  const idx = await (await fetch('assets/sprites2d_sheets/index.json')).json();
  const res = {};
  for (const pool of idx.sheets) {
    let top = 999, bottom = -1;
    for (const clip of ['idle', 'walk']) {
      const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'assets/sprites2d_sheets/' + pool + '/' + clip + '.webp'; });
      if (!im) { continue; }
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      for (let f = 0; f < 8; f++) {
        const d = x.getImageData(f * 128, 128, 128, 128).data;
        for (let yy = 0; yy < 128; yy++) { for (let xx = 0; xx < 128; xx++) { if (d[(yy * 128 + xx) * 4 + 3] > 40) { if (yy < top) { top = yy; } if (yy > bottom) { bottom = yy; } } } }
      }
    }
    res[pool] = { top: top, bottom: bottom, h: bottom - top + 1 };
  }
  return res;
});
const poolH = {}; let foot = 0, n = 0;
Object.keys(out).forEach((k) => { poolH[k] = out[k].h; foot += out[k].bottom / 128; n++; });
console.log('poolH:', JSON.stringify(poolH));
console.log('foot(발 위치, 프레임 높이 비율 평균):', (foot / Math.max(1, n)).toFixed(3));
console.log(JSON.stringify(out));
await r.close();
process.exit(0);
