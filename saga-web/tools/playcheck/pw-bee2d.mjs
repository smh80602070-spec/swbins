// W-0498 2D 꿀벌 확인 그림 — 2나락 1층 방에 꿀벌떼를 곁에 세워 한 장.  node pw-bee2d.mjs <저장 png>
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const dest = process.argv[2] || 'shots/bee2d.png';
const r = await open('saga-dungeon', { w: 1280, h: 720 });
const { page } = r; const ev = (fn, a) => page.evaluate(fn, a);
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
  await clearOverlays(page, 'saga-dungeon', { keep: [] });
  await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3000);
  if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2500); }
  await ev(() => { if (DG.town && DG.town.leave) { DG.town.leave(); } DG.dungeon.enter({ floor: 1 }); }); await sleep(2500);
  for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); }); await sleep(400); }
  const n = await ev(() => {
    const raw = DG.dungeon.raw(), room = raw.room || (raw.rooms && raw.rooms[raw.roomIdx]), ref = DG.enemyData.byName('꿀벌떼'), p = raw.player; raw.hp = raw.hpMax = 999999;
    const rr = room || raw.curRoom; if (!rr || !rr.enemies) { return 'noroom ' + Object.keys(raw).join(','); }
    rr.enemies.length = 0;
    for (let i = 0; i < 3; i++) { rr.enemies.push({ x: p.x + 90 + i * 60, y: p.y - 40 + i * 50, hp: 99999, hpMax: 99999, ref, name: ref.name, tier: 1, phase: i, cd: 99, speed: 0, aggro: i === 1 }); }
    return 'ok ' + rr.enemies.length;
  });
  console.log(n); await sleep(1500);
  await page.screenshot({ path: dest });
} finally { await r.close(); }
