// 사가국지 RTS 영웅(W-0035) — 군영을 눌러 영웅 모집 단추 → 영웅이 나오면 상자 선택 → Q 일격. 화면 촬영 없음.
//   node pw-rts-hero.mjs        서버 :8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const r = await open('saga-realm');
const { page } = r;
await page.addInitScript(() => { window.DG_NO_ACCOUNT = true; });
await page.goto(r.url('rts.html?diff=1&mode=rts')); await sleep(1500);
const info = await page.evaluate(() => {
  const R = DG.rts, V = R.view, S = V.state(), cs = R.grid.castleSite(); S.res.gold = 9999; S.res.food = 9999; S.raid.next = 1e9; S.speed = 1;
  for (let i = 0; i < 8; i++) { R.rules.place(S, 'road', cs.x + 3 + i, cs.y + 1); }
  const b = R.rules.place(S, 'barracks', cs.x + 5, cs.y + 2);
  V.camera.x = b.x + 1.5; V.camera.y = b.y + 1; V.camera.z = 1.5;
  const p = V.toScreen(b.x + 1.5, b.y + 1), rc = document.getElementById('rts-map').getBoundingClientRect();
  return { x: rc.left + p.x, y: rc.top + p.y, bid: b.id };
});
await page.mouse.click(info.x, info.y); await sleep(500);
const panel = await page.evaluate(() => ({ hero: !!document.querySelector('#rts-sel button[data-hero]'), html: document.getElementById('rts-sel').textContent.replace(/\s+/g, ' ').slice(0, 80) }));
await page.click('#rts-sel button[data-hero]'); await sleep(300);
const q = await page.evaluate((bid) => { const S = DG.rts.view.state(); return { queued: (S.queues[bid] || []).map((x) => x.t + ':' + x.hid) }; }, info.bid);
// 영웅을 바로 내고 적 하나 곁에 세워 Q
const cast = await page.evaluate(async () => {
  const R = DG.rts, V = R.view, S = V.state(), U = R.units, cs = R.grid.castleSite();
  const h = U.spawn(S, 'hero', 0, cs.x + 6.5, cs.y - 8.5, 'sg_guanyu'), foe = U.spawn(S, 'cavalry', 1, cs.x + 8, cs.y - 8.5);
  V.camera.x = h.x; V.camera.y = h.y; V.camera.z = 2;
  const a = V.toScreen(h.x, h.y), rc = document.getElementById('rts-map').getBoundingClientRect();
  return { sx: rc.left + a.x, sy: rc.top + a.y, hid: h.id, fid: foe.id, hp0: foe.hp };
});
await page.keyboard.press('Escape');
await page.mouse.move(cast.sx - 40, cast.sy - 40); await page.mouse.down(); await page.mouse.move(cast.sx + 40, cast.sy + 40, { steps: 5 }); await page.mouse.up(); await sleep(400);
const skill = await page.evaluate(() => !!document.querySelector('#rts-sel button[data-skill]'));
await page.keyboard.press('q'); await sleep(300);
const after = await page.evaluate((c) => { const S = DG.rts.view.state(); const f = S.units[c.fid]; return { foeHp: f ? f.hp : 'dead', cd: S.units[c.hid] ? S.units[c.hid].skillCd : null }; }, cast);
console.log(JSON.stringify({ panel, q, skill, hp0: cast.hp0, after }));
console.log('오류', r.errors.length, r.errors.slice(0, 3).join(' | '));
await r.close();
process.exit(0);
