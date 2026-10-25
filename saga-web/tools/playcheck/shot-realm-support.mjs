// W-0425 5천하 지원 단계 — 새 계정으로 들어가 내 장수 셋으로 SRPG 전술판(#tacview)을 열고, 앞 둘을 이웃에 세워 지원 A 를 심은 뒤
// 판(칸 표식 🤝A·명중 %)과 장수 상세 시트(🤝 지원 줄)를 PC·폰으로 찍는다.
//   node shot-realm-support.mjs   → shots/w0425/<pc|phone>-board.png · -sheet.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0425');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-realm', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); });
    await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);
    await page.locator('[data-act="pick-force"]').first().click(); await sleep(2500);
    for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    const info = await ev(() => {
      const st = DG.rtk.state(), me = DG.rtk.me ? DG.rtk.me() : null, ids = Object.keys(st.officers || {});
      const mine = ids.filter((id) => { const o = st.officers[id]; return o && !o.dead && (o.force === me || o.f === me); }).slice(0, 3);
      const use = mine.length >= 2 ? mine : ids.slice(0, 3), foes = ids.filter((id) => use.indexOf(id) < 0).slice(0, 2);
      DG.core.setTune('tactics3d', 0); document.querySelectorAll('.show').forEach((e) => { if (/help|modal|sheet/.test(e.id + ' ' + e.className)) { e.classList.remove('show'); } }); st.support = st.support || {}; st.support[DG.support.key(use[0], use[1])] = 12;
      let host = document.getElementById('tacview'); if (!host) { const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;inset:0;z-index:50;background:#10161c;overflow:auto;padding:8px'; host = document.createElement('div'); host.className = 'tacview'; host.id = 'tacview'; wrap.appendChild(host); document.body.appendChild(wrap); }
      const cur = DG.tacticsView.open(host, { srpg: true, seed: 'shot-w0425', land: 'plain', siege: false, goal: 'rout', mine: use, foes: foes, foeTroops: [2000] }, () => {});
      const b = cur.b, u = b.units.filter((x) => x.side === 'me' && x.kind === 'officer');
      if (u.length >= 2) { u[1].x = u[0].x; u[1].y = u[0].y + 1; if (b.units.some((x) => x !== u[1] && x.x === u[1].x && x.y === u[1].y)) { u[1].y = u[0].y - 1; } }
      cur.sel = u[0].uid; DG.tacticsView.plotMode(null);
      return { use, foes, lv: DG.support.level(use[0], use[1]), near: DG.support.bestNear(b, u[0]), marks: (host.innerHTML.match(/🤝/g) || []).length };
    });
    await sleep(600);
    const f1 = path.join(OUT, kind + '-board.png'); await page.screenshot({ path: f1 });
    console.log(kind, JSON.stringify(info), 'errors', r.errors.length, f1);
    if (r.errors.length) { console.log(r.errors.slice(0, 3).join('\n')); }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
