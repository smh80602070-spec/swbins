// 사가국지 RTS 습격 확인(W-0033) — 습격을 앞당겨 파도가 나오고 HUD·루프가 오류 없이 도는지 본다. 화면 촬영 없음.
//   node pw-rts-raid.mjs        서버 :8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const r = await open('saga-realm');
const { page } = r;
await page.addInitScript(() => { window.DG_NO_ACCOUNT = true; });   // 가입 화면 없이 진단 키로 시작
await page.goto(r.url('rts.html?diff=1&mode=rts')); await sleep(1500);
const out = await page.evaluate(async () => {
  const V = DG.rts.view, S = V.state(), res = {};
  S.speed = 4; S.raid.next = S.tick + 5;
  await new Promise((ok) => setTimeout(ok, 1500));
  res.raiders = Object.values(S.units).filter((u) => u.team === 1).length;
  res.raidN = S.raid.n;
  res.hud = document.getElementById('rts-top').textContent.replace(/\s+/g, ' ').slice(0, 160);
  S.cHp = 1; S.raid.next = S.tick + 1;
  Object.values(S.units).filter((u) => u.team === 1).forEach((u) => { u.x = S.buildings[1].x + 3.4; u.y = S.buildings[1].y + 1.5; u.path = []; });
  await new Promise((ok) => setTimeout(ok, 1500));
  res.ask = !!document.getElementById('rts-diff') && /무너졌다/.test(document.getElementById('rts-diff').textContent);
  document.querySelector('#rts-diff button[data-diff="0"]').click(); const N = DG.rts.view.state();
  res.restart = !N.over && N.diff === 0 && N.day === 1 && !document.getElementById('rts-diff');
  res.over = S.over; res.tip = document.getElementById('rts-tip') ? document.getElementById('rts-tip').textContent : '';
  return res;
});
console.log(JSON.stringify(out));
// 둘째 판 — 적 기지를 쳐서 승리(W-0034)
await page.goto(r.url('rts.html?diff=1&mode=rts')); await sleep(1500);
const win = await page.evaluate(async () => {
  const S = DG.rts.view.state(), sb = S.buildings[-1], U = DG.rts.units; S.raid.next = 1e9; S.speed = 4; sb.hp = 3;
  U.spawn(S, 'soldier', 0, sb.x - 0.5, sb.y + 1.5);
  await new Promise((ok) => setTimeout(ok, 1200));
  return { won: S.won, tip: document.getElementById('rts-tip').textContent, hud: document.getElementById('rts-top').textContent.replace(/s+/g, ' ').slice(-40) };
});
console.log(JSON.stringify(win));
console.log('오류', r.errors.length, r.errors.slice(0, 3).join(' | '), '· 404', r.notFound.length);
await r.close();
process.exit(0);
