// W-0430 1만리 등용 「무(武)로 겨루자」 = 실시간 결투 — 새 계정으로 들어가 내 앞에 인물 하나를 세워 등용 카드를 열고 ⚔️ 를 눌러
// 카드(전)·결투 무리(후)를 PC·폰으로 찍는다.   node shot-go-duel.mjs → shots/w0430/<pc|phone>-card.png · -duel.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0430');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-go', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    await ev(() => { const sv = DG.core.save; sv.settings = sv.settings || {}; sv.settings.autoBattle = false; if (sv.auto) { sv.auto.on = false; } sv.items.scroll = 9; sv.player.fame = 999;
      const p = sv.player.pos, k = DG.fieldCombat.KDVf() || 1, h = DG.data.heroes[12], sp = { uid: 88801, kind: 'hero', ref: h, x: p.x + 4 * k, y: p.y - 6 * k, bornAt: Date.now() };
      DG.world.spawns.push(sp); DG.encounter.open(sp); });
    await sleep(900);
    const f1 = path.join(OUT, kind + '-card.png'); await page.screenshot({ path: f1 });
    const info = await ev(() => { const b = document.querySelector('[data-appeal="might"]'); if (b) { b.click(); } const S = DG.fieldCombat.state(); return { clicked: !!b, duel: !!(S && S.duel), foes: S && S.duel ? (S.camps[S.duel.camp] || { uids: [] }).uids.length : 0 }; });
    await sleep(1500);
    const f2 = path.join(OUT, kind + '-duel.png'); await page.screenshot({ path: f2 });
    console.log(kind, JSON.stringify(info), 'errors', r.errors.length, f1, f2);
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
