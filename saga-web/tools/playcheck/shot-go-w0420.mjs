// W-0420 ②③ 1만리 대치·핏빛 달 — 새 계정으로 들어가 밤 22시·붉은 밤으로 붙들고, 내 앞 어그로+1m 에 쉬는 무리 셋을 세워
// 대치(⚔)·달려듦(!)·한 칼(일격!) 세 순간과 붉은 막을 PC·폰으로 찍는다.
//   node shot-go-w0420.mjs   → shots/w0420/<pc|phone>-1-standoff.png · -2-cue.png · -3-strike.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0420');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-go', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  const snap = async (n) => { const f = path.join(OUT, kind + '-' + n + '.png'); await page.screenshot({ path: f }); return f; };
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    await ev(() => { const sv = DG.core.save; sv.settings = sv.settings || {}; sv.settings.autoBattle = false; if (sv.auto) { sv.auto.on = false; } DG.core.setTune('go.bloodMoon', 2); DG.bloodMoon._setNowForTest(() => new Date(2026, 9, 25, 22, 0).getTime()); });
    let blood = false; for (let i = 0; i < 20 && !blood; i++) { await sleep(400); blood = await ev(() => DG.bloodMoon.active()); }
    const info = await ev(() => {
      const FC = DG.fieldCombat, FS = DG.fieldStandoff, S = FC.state(), p = DG.core.save.player.pos, k = FC.KDVf();
      FS._rng(() => 0.99);
      const d = (12 + 1) * k;
      FC.spawnCamp(S, { key: 'shot_w0420', x: p.x + d * 0.3, y: p.y - d * 0.95, tier: 1, kind: 'plain', foes: [{ kind: 'boar', dx: 0, dy: 0 }, { kind: 'boar', dx: 1.2, dy: -0.8 }, { kind: 'boar', dx: -1.2, dy: -0.8 }] });
      return { k, d };
    });
    let so = false; for (let i = 0; i < 20 && !so; i++) { await sleep(150); so = await ev(() => !!DG.fieldStandoff.state()); }
    const f1 = await snap('1-standoff');
    const st = await ev(() => new Promise((res) => { const FS = DG.fieldStandoff; let n = 0; const iv = setInterval(() => { const s = FS.state(); n++; if ((s && s.ph === 'lunge') || n > 200) { clearInterval(iv); setTimeout(() => { const S = DG.fieldCombat.state(), p = DG.core.save.player.pos, ph = FS.state() && FS.state().ph; S.atkCd = 0; const r = DG.fieldCombat.attack(S, p.x, p.y); res({ ph, r: r && { standoff: r.standoff, n: r.n } }); }, 200); } }, 10); }));
    const f2 = null;
    await sleep(250);
    const f3 = await snap('3-strike');
    console.log(kind, JSON.stringify({ blood, info, so, st }), 'errors', r.errors.length, [f1, f2, f3].join(' '));
    if (r.errors.length) { console.log(r.errors.slice(0, 3).join('\n')); }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
