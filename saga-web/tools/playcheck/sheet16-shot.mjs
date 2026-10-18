// W-0311 16방향 시트 길 촬영 — K 시트가 오기 전, 칸마다 "r행 f프레임" 과 그 행이 보는 쪽 화살표를 그린 시험 시트를 페이지에서 만들어
// characters2d16/ 요청을 가로채(page.route) 넣고, mode2d.draw 로 16방향을 원으로 그린다. 바깥 회색 선 = 부른 방향, 칸 안 빨간 화살표 = 시트 행이 보는 쪽.
// 둘이 겹치면 행·뒤집기가 맞다. 가운데 줄은 걷기 보폭 위상 0~1 → 프레임 12장.
//   node sheet16-shot.mjs [판]   → shots/sheet16_<판>.jpg   서버: node serve.mjs C:/swbins/saga-web 8871
import { open, sleep } from './pw.mjs';

const game = process.argv[2] || 'saga-go';
const r = await open(game, { w: 1100, h: 900 });
const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
const out = {};
try {
  await page.goto(r.url('index.html')); await sleep(3000);
  /* 시험 시트(행 9 × 프레임 n, 칸 192) — 행 r 은 정면(아래)에서 오른쪽으로 r×22.5° 돈 쪽을 본다 */
  const make = (n) => ev((n) => {
    const P = 192, c = document.createElement('canvas'); c.width = P * n; c.height = P * 9; const g = c.getContext('2d');
    for (let r = 0; r < 9; r++) for (let f = 0; f < n; f++) {
      const x = f * P, y = r * P, a = r * Math.PI / 8;
      g.fillStyle = `hsla(${r * 40},60%,55%,0.85)`; g.fillRect(x + 50, y + 30, 92, 140);
      g.strokeStyle = '#c00'; g.lineWidth = 8; g.beginPath(); g.moveTo(x + 96, y + 100); g.lineTo(x + 96 + Math.sin(a) * 60, y + 100 + Math.cos(a) * 60); g.stroke();
      g.fillStyle = '#000'; g.font = 'bold 30px sans-serif'; g.fillText('r' + r, x + 62, y + 60); g.font = '22px sans-serif'; g.fillText('f' + f, x + 62, y + 160);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, n);
  const sheets = { idle: Buffer.from(await make(8), 'base64'), walk: Buffer.from(await make(12), 'base64') };
  await page.route('**/characters2d16/**', (route) => { const m = /characters2d16\/[^/]+\/([a-z_]+)\.webp/.exec(route.request().url()); const b = m && sheets[m[1]]; if (b) { route.fulfill({ status: 200, contentType: 'image/png', body: b }); } else { route.fulfill({ status: 404 }); } });
  const draw = () => ev(() => {
    const M = DG.mode2d, I = DG.assets3dIds; I.hero2d16 = I.hero2d16 || {}; I.hero2d16.w311_probe = { dirs: 16, px: 192, cam_z: 1.15, roles: ['idle', 'walk'] };
    const cf = DG.cfg.mode2d; cf.on = () => true;
    let cv = document.getElementById('w311'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'w311'; cv.width = 1100; cv.height = 900; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff'; document.body.appendChild(cv); }
    const g = cv.getContext('2d'); g.clearRect(0, 0, 1100, 900); g.fillStyle = '#fff'; g.fillRect(0, 0, 1100, 900);
    const cx = 550, cy = 380, R = 290; let ok = 0;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, dx = Math.sin(a), dy = Math.cos(a), x = cx + dx * R, y = cy + dy * R + 40;
      g.strokeStyle = '#999'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * (R - 70), cy + dy * (R - 70)); g.stroke();
      if (M.draw(g, { pool: 'vroid:w311_probe', clip: 'idle', dirX: dx, dirY: dy, ms: 0, x, y, scale: 1.4 })) { ok++; }
    }
    for (let k = 0; k < 6; k++) { if (M.draw(g, { pool: 'vroid:w311_probe', clip: 'walk', dirX: 1, dirY: 0, stride: k / 6 + 0.01, x: 120 + k * 170, y: 890, scale: 1.1 })) { ok++; } }
    g.fillStyle = '#000'; g.font = '18px sans-serif'; g.fillText('W-0311 16방향 길 — 회색 선 = 부른 방향 · 빨간 화살표 = 시트 행 · 아래 = 걷기 보폭 0~5/6 (12장)', 20, 24);
    return ok;
  });
  await draw(); await sleep(1500); out.drawn = await draw();
  await page.screenshot({ path: `shots/sheet16_${game}.jpg`, type: 'jpeg', quality: 85 });
  out.shot = `shots/sheet16_${game}.jpg`; out.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 4);
} catch (e) { out.err = e.message; }
console.log(JSON.stringify(out));
await r.close();
process.exit(0);
