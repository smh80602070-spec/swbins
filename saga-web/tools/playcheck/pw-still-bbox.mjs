// 한 장 모드(정면·옆·뒤 정지 그림) 풀의 알파 범위를 잰다 — mode2d `still` 표의 body·foot 근거. (W-0032)
//   node pw-still-bbox.mjs        서버 :8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const r = await open('saga-forest');
const { page } = r;
await page.goto(r.url('index.html')); await sleep(800);
const out = await page.evaluate(async () => {
  const pools = ['beast_big', 'beast_bird', 'beast_dog', 'beast_fish', 'beast_small', 'beast_wolf', 'companion_archer', 'companion_mage', 'companion_warrior', 'hero_f', 'hero_m', 'villager_a', 'villager_b', 'villager_c'];
  const res = {};
  for (const p of pools) {
    res[p] = {};
    for (const v of ['front', 'side', 'back']) {
      const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '../shared/assets/web2d/moving/' + p + '/' + v + '.webp'; });
      if (!im) { res[p][v] = null; continue; }
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let t = 9999, b = -1, l = 9999, rr = -1;
      for (let yy = 0; yy < c.height; yy++) { for (let xx = 0; xx < c.width; xx++) { if (d[(yy * c.width + xx) * 4 + 3] > 40) { if (yy < t) t = yy; if (yy > b) b = yy; if (xx < l) l = xx; if (xx > rr) rr = xx; } } }
      res[p][v] = { w: c.width, h: c.height, top: t, bottom: b, left: l, right: rr };
    }
  }
  return res;
});
for (const p of Object.keys(out)) { console.log(p, JSON.stringify(out[p])); }
await r.close();
process.exit(0);
