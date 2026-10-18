// W-0303 모션 묶음 1 — 판마다 한 장: 실제 게임 루프에서 몸짓이 걸리는지(강제로 틀지 않는다).
//   2나락 마을·3마을·4종횡: 가만히 서 있으면 pose3d.life → 앉기(손잡이 pose3d.sitAfter 를 1초로 줄여 찍는다)
//   5천하: 성 시트의 3D 성 안 일꾼(city3d) — 자체 몸짓 몸이면 Pose_heavy(훈련)·Pose_pick(일)
//   node pose-games.mjs [판,판…]   → shots/pose_<판>.jpg · 콘솔 JSON(오류 줄)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 1만리는 pose-shot.mjs.
import { open, sleep } from './pw.mjs';

const games = (process.argv[2] || 'saga-dungeon,saga-forest,saga-story,saga-realm').split(',');
const out = {};
async function clearIntro(ev, page, g) {
  for (let i = 0; i < 10; i++) {
    const k = await ev(() => { let n = 0; if (DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) { if (DG.scenario.skip) { DG.scenario.skip(); } n++; } return n; });
    if (g === 'saga-story') { await ev(() => { if (DG.menuGrid && DG.menuGrid.close) { DG.menuGrid.close(); } }); } else { await page.keyboard.press('Escape'); }   // 4종횡은 Esc 가 메뉴를 연다
    await sleep(250);
    if (!k && i > 2) { break; }
  }
}
for (const g of games) {
  const r = await open(g, { w: 1280, h: 720 }), { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  const o = out[g] = {};
  try {
    await page.goto(r.url('index.html')); await sleep(1500);
    await ev(() => { try { localStorage.clear(); } catch (e) {} if (DG.account && DG.account.create) { DG.account.create('몸짓'); } });
    await page.goto(r.url('index.html')); await sleep(3500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    if (g === 'saga-dungeon') { await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((x) => x.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(4000); }
    if (g === 'saga-realm') {
      await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
      await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000);
    }
    await clearIntro(ev, page, g);
    await ev(() => { DG.core.setTune('pose3d.sitAfter', 1); window.__wa = {}; const w = DG.ownAnim.weaponAction; DG.ownAnim.weaponAction = function (u, s) { const v = w.apply(this, arguments); if (/^Pose_/.test(s)) { window.__wa[s] = v === s; } return v; }; });   // 실제로 그 몸에 구운 Pose_ 이름을 센다
    if (g === 'saga-realm') {
      o.city = await ev(() => { const R = DG.rtk, me = R.state().me, c = R.citiesOf(me)[0]; DG.ui.openCity(c); return c; });
      await sleep(9000);
    } else { await sleep(7000); await clearIntro(ev, page, g); await ev(() => { document.querySelectorAll('[data-act="story-skip"]').forEach((b) => b.click()); }); await sleep(7000); }   // 몸 GLB 받기 + 가만히 1초 + 블렌드(헤드리스 초당 1~2프레임)
    o.baked = await ev(() => window.__wa);
    const me = g === 'saga-dungeon' ? await ev(() => DG.dungeon3d._meScreen && DG.dungeon3d._meScreen()) : null;
    const box = me && me.x != null ? { x: Math.max(0, me.x * 1280 - 120), y: Math.max(0, me.y * 720 - 60), width: 240, height: 200 } : g === 'saga-realm' ? await ev(() => { const c = [...document.querySelectorAll('canvas')].filter((x) => x.offsetParent && x.getBoundingClientRect().width < 600 && x.getBoundingClientRect().width > 100)[0]; if (!c) { return null; } const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }) : null;
    await page.screenshot({ path: `shots/pose_${g}.jpg`, type: 'jpeg', quality: 82, ...(box ? { clip: box, scale: 'device' } : {}) });
    o.shot = `shots/pose_${g}.jpg`;
    o.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 4);
  } catch (e) { o.err = e.message; }
  await r.close();
}
console.log(JSON.stringify(out, null, 1));
process.exit(0);
