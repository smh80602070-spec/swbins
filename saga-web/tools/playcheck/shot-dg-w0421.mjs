// W-0421 2나락 피 구슬·저주받은 상자 — 명품 프리셋으로 굴혈 1층에 들어가 내 곁에 피 구슬 셋과 열린 저주받은 상자(고리)를 세워 PC·폰으로 찍는다.
//   node shot-dg-w0421.mjs   → shots/w0421/<pc|phone>.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0421');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-dungeon', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  const skip = async () => { for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기|닫기|확인/.test(b.textContent) && b.offsetParent && !b.closest('#title')) { b.click(); } }); }); await sleep(250); } };
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('_admin.html'), { timeout: 90000 }); await sleep(2000);
    await page.locator('[data-tab="preset"]').click(); await sleep(300);
    await page.locator('#presets .preset', { hasText: '⚔️ 명품 한 벌 갖춘 판' }).click(); await sleep(600);
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await skip();
    const ok = await ev(() => { if (DG.town) { DG.town.leave(); } return DG.dungeon.enter({ floor: 1 }); });
    await sleep(1500); await skip();
    const info = await ev(() => {
      const run = DG.dungeon.raw(), p = run.player; run.hp = Math.round(run.hpMax * 0.4);
      run.room.enemies.forEach((e) => { e.x = 640; e.y = 60; });
      run.room.bloodOrbs = [{ x: p.x + 55, y: p.y - 30, t: 25 }, { x: p.x + 75, y: p.y + 10, t: 25 }, { x: p.x + 50, y: p.y + 35, t: 2 }];
      run.room.cursedChest = { x: p.x - 70, y: p.y, st: 'open', t: 17.4, next: 99 };
      return { ok: true, hp: run.hp, max: run.hpMax };
    });
    await sleep(120);
    const f = path.join(OUT, kind + '.png'); await page.screenshot({ path: f });
    await sleep(900);
    const after = await ev(() => { const run = DG.dungeon.raw(); return { hp: run.hp, orbs: (run.room.bloodOrbs || []).length, chest: run.room.cursedChest && run.room.cursedChest.st, t: run.room.cursedChest && run.room.cursedChest.t, choice: !!run.choice, merch: !!run.merchantChoice, paused: !!(DG.dungeon.paused && DG.dungeon.paused()), focus: document.hasFocus() }; });
    console.log(kind, JSON.stringify({ ok, info, after }), 'errors', r.errors.length, f);
    if (r.errors.length) { console.log(r.errors.slice(0, 3).join('\n')); }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
