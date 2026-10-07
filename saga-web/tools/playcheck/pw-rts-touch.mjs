// 사가천하 RTS 폰 입력·난이도 고르기(W-0036) — 새 판에서 난이도 창 → 쉬움, 터치로 유닛 고르기·땅 눌러 이동·전군 선택. 화면 촬영 없음.
//   node pw-rts-touch.mjs        서버 :8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const r = await open('saga-realm', { w: 390, h: 760, mobile: true });
const { page } = r;
await page.addInitScript(() => { window.DG_NO_ACCOUNT = true; });
await page.goto(r.url('rts.html?mode=rts')); await sleep(1500);
const ask = await page.evaluate(() => ({ overlay: !!document.getElementById('rts-diff'), speed: DG.rts.view.state().speed }));
await page.tap('#rts-diff button[data-diff="0"]'); await sleep(300);
const set = await page.evaluate(() => { const S = DG.rts.view.state(); return { gone: !document.getElementById('rts-diff'), diff: S.diff, hp: S.buildings[-1].hp, speed: S.speed }; });
const prep = await page.evaluate(() => {
  const R = DG.rts, V = R.view, S = V.state(), U = R.units, cs = R.grid.castleSite(); S.raid.next = 1e9;
  const a = U.spawn(S, 'soldier', 0, cs.x + 6.5, cs.y - 8.5), b = U.spawn(S, 'archer', 0, cs.x + 8.5, cs.y - 8.5);
  V.camera.x = cs.x + 7; V.camera.y = cs.y - 8.5; V.camera.z = 2; V.tool('select');
  const rc = document.getElementById('rts-map').getBoundingClientRect(), pa = V.toScreen(a.x, a.y), pg = V.toScreen(cs.x + 7, cs.y - 12);
  return { ax: rc.left + pa.x, ay: rc.top + pa.y, gx: rc.left + pg.x, gy: rc.top + pg.y, a: a.id };
});
await page.touchscreen.tap(prep.ax, prep.ay); await sleep(300);
const picked = await page.evaluate(() => document.getElementById('rts-sel').textContent.replace(/\s+/g, ' ').slice(0, 40));
await page.touchscreen.tap(prep.gx, prep.gy); await sleep(300);
const moved = await page.evaluate((id) => { const u = DG.rts.view.state().units[id]; return { goal: !!u.goal, path: u.path.length }; }, prep.a);
await page.evaluate(() => { document.getElementById('rts-map'); });
await page.keyboard.press('Escape'); await sleep(200);
const all = await page.evaluate(() => !!document.querySelector('#rts-sel button[data-all]'));
await page.tap('#rts-sel button[data-all]'); await sleep(300);
const allSel = await page.evaluate(() => document.getElementById('rts-sel').textContent.replace(/\s+/g, ' ').slice(0, 40));
console.log(JSON.stringify({ ask, set, picked, moved, all, allSel }));
console.log('오류', r.errors.length, r.errors.slice(0, 3).join(' | '));
await r.close();
process.exit(0);
