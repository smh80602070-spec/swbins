// 어드민 화면 자가진단(_admin.html?selftest → 제목 "ADMIN n/m")을 Playwright 로 돌려 결과를 남긴다. (D0 어드민 기능의 D2 기록)
//   node pw-admin-selftest.mjs [판 폴더…]   (인자 없으면 다섯 판 전부 — 어드민 selftest 가 있는 판만 세어진다)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 새 컨텍스트 = 새 프로필(어드민 selftest 는 임시 저장 키를 쓰고 되돌린다).
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const games = process.argv.slice(2).length ? process.argv.slice(2) : ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const rows = [];
for (const g of games) {
  const r = await open(g);
  const { page } = r;
  let title = '', has = false;
  try {
    await page.goto(r.url('index.html')); await sleep(1200);
    await page.evaluate(() => { DG.account && DG.account.create && DG.account.create('확인'); });
    await page.goto(r.url('_admin.html?selftest')); await sleep(6000);
    title = await page.title();
    has = await page.evaluate(() => !!document.getElementById('selfout'));
  } catch (e) { title = 'ERR ' + e.message.split('\n')[0]; }
  const m = /ADMIN (\d+)\/(\d+)/.exec(title);
  const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED/.test(e));
  const row = { game: g, title: title, hasSelfOut: has, pass: m ? +m[1] : null, total: m ? +m[2] : null, ok: !!m && m[1] === m[2] && +m[2] > 0, pageErrors: real.slice(0, 3) };
  rows.push(row);
  console.log((row.ok ? 'PASS ' : (m ? 'FAIL ' : 'NONE ')) + g + ' — ' + title + (real.length ? ' · 예외 ' + real.length : ''));
  await r.close();
}
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-admin-selftest.json', JSON.stringify({ script: 'pw-admin-selftest.mjs', games: rows }, null, 1) + '\n');
process.exit(0);
