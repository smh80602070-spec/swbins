// 사가천하 RTS 화면 한 장 촬영(W-0043) — 건물·유닛을 깔아 놓고 찍는다. 사용자가 화면 확인을 요청했을 때만 쓴다(작업 중 습관적 촬영 금지).
//   node pw-rts-shot.mjs <저장 경로.png>        서버 :8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';
const r = await open('saga-realm', { w: 1100, h: 700 });
await r.page.addInitScript(() => { window.DG_NO_ACCOUNT = true; });
await r.page.goto(r.url('rts.html?diff=1&qa=1&mode=rts')); await sleep(1500);
await r.page.evaluate(() => {
  const R = DG.rts, V = R.view, S = V.state(), cs = R.grid.castleSite(), U = R.units; S.speed = 0;
  for (let i = 0; i < 10; i++) { R.rules.place(S, 'road', cs.x + 3 + i, cs.y + 1); }
  R.rules.place(S, 'house', cs.x + 4, cs.y - 1); R.rules.place(S, 'house', cs.x + 7, cs.y - 1);
  R.rules.place(S, 'farm', cs.x + 10, cs.y - 3); R.rules.place(S, 'market', cs.x + 4, cs.y + 2); R.rules.place(S, 'barracks', cs.x + 7, cs.y + 2);
  R.rules.place(S, 'workshop', cs.x + 11, cs.y + 2); R.rules.place(S, 'well', cs.x + 2, cs.y - 2); R.rules.place(S, 'tower', cs.x - 2, cs.y + 4);
  for (let i = 0; i < 6; i++) { R.rules.place(S, 'wall', cs.x - 4, cs.y - 2 + i); }
  U.spawn(S, 'soldier', 0, cs.x + 6.5, cs.y + 5.5); U.spawn(S, 'archer', 0, cs.x + 8, cs.y + 5.5); U.spawn(S, 'cavalry', 0, cs.x + 9.5, cs.y + 5.5); U.spawn(S, 'hero', 0, cs.x + 11, cs.y + 5.5, 'sg_guanyu');
  U.spawn(S, 'soldier', 1, cs.x + 8, cs.y + 8); U.spawn(S, 'archer', 1, cs.x + 10, cs.y + 8);
  V.camera.x = cs.x + 7; V.camera.y = cs.y + 3; V.camera.z = 2.4;
});
await sleep(4500);
await r.page.screenshot({ path: process.argv[2] || '_rts.png' });
console.log('오류', r.errors.filter((e) => !/404/.test(e)).slice(0, 3).join(' | '), 'nf', r.notFound.slice(0, 4).join(','));
await r.close(); process.exit(0);
