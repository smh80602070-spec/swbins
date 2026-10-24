// W-0414 구역 넘김 막 탐침 — 판마다 새 계정으로 들어가 경계 동작 하나를 일으키고 #zone-cut2 불투명도를 0.05·0.3·0.8·2초에 잰다.
//   node zone-cut-check.mjs [판…]   (서버 :8871 — 돌리는 쪽이 띄우고 끈다)   → 콘솔 한 줄씩. 덮였다(1) → 걷혔다(0) 면 OK
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const ACT = {
  'saga-go': () => { DG.core.emit('region:teleport', { key: 'probe' }); },
  'saga-forest': () => { DG.core.emit('village:home', { inside: true }); },
  'saga-story': () => { DG.core.emit('side:travel', { key: 'probe' }); },
  'saga-realm': () => { const R = DG.regionView, cur = R.current(), o = R.REGIONS.find((g) => g.id !== cur) || R.REGIONS[0]; R.set(o.id); },
};
const games = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ACT);
for (const game of games) {
  const r = await open(game, { w: 1280, h: 720 });
  const ev = (fn, a) => r.page.evaluate(fn, a);
  try {
    await r.page.goto(r.url('index.html')); await sleep(1500);
    await ev(() => { DG.account.create('막'); });
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    await clearOverlays(r.page, game, { keep: [] });
    if (game === 'saga-realm') { await r.page.locator('[data-act="pick-scen"]').first().click(); await sleep(800); await r.page.locator('[data-act="pick-force"]').first().click(); await sleep(2500); }
    await sleep(800);
    const has = await ev(() => !!(DG.zoneCut && DG.zoneCut.cut));
    await ev(ACT[game]);
    const t0 = Date.now(), seq = [];
    for (const ms of [50, 300, 800, 2000, 4000]) { await sleep(Math.max(0, ms - (Date.now() - t0))); seq.push(ms + 'ms ' + await ev(() => { const e = document.getElementById('zone-cut2'); return e ? (+getComputedStyle(e).opacity).toFixed(2) : '없음'; })); }
    const ok = has && /^50ms 1/.test(seq[0]) && / 0\.00$/.test(seq[seq.length - 1]);
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + game + ' · ' + seq.join(' · ') + (has ? '' : ' · DG.zoneCut 없음') + (r.errors.filter((e) => !/404/.test(e)).length ? ' · 오류 ' + r.errors.filter((e) => !/404/.test(e)).slice(0, 2).join(' | ') : ''));
  } catch (e) { console.log('ERR  ' + game + ' ' + e.message.split('\n')[0]); } finally { await r.close(); }
}
