// 5천하 조조전식 장 흐름 한 바퀴(W-0450) — 새 계정 → 시나리오·세력 → 노선도 → 1장 이야기 → 고름 → 진영(탭 넷) → 출진 → 자동 전투 → 결과 → 2장 열림
//   node realm-campaign.mjs [저장 폴더] [W=1280] [H=720]   (서버 :8871 — 돌리는 쪽이 띄우고 끈다) → 콘솔 STEP 줄 + 사진(노선도·이야기·진영·전투·결과)
import { open, sleep } from './pw.mjs';
const out = process.argv[2] || '.', W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const r = await open('saga-realm', { w: W, h: H, mobile: W < 600 });
const ev = (f, a) => r.page.evaluate(f, a);
const shot = (n) => r.page.screenshot({ path: out + '/cp_' + n + (W < 600 ? '_phone' : '') + '.png' });
const click = (sel) => ev((s) => { const b = document.querySelector(s); if (b) { b.click(); return true; } return false; }, sel);
const state = () => ev(() => { const c = DG.campaign && DG.campaign.state(); const h = document.getElementById('campaign'); return { ch: c && c.ch, step: c && c.step, gold: c && c.gold, cleared: c && Object.keys(c.cleared || {}), shown: !!(h && h.style.display !== 'none'), nodes: h ? h.querySelectorAll('.cpg-node').length : 0 }; });
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await ev(() => { localStorage.clear(); DG.account.create('장흐름'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await click('#title-continue'); await sleep(2000);
  await r.page.locator('[data-act="pick-scen"]').first().click(); await sleep(600);
  await r.page.locator('[data-act="pick-force"]').first().click(); await sleep(2500);
  console.log('STEP route', JSON.stringify(await state())); await shot('route');
  await click('.cpg-node.now'); await sleep(800);
  console.log('STEP story', JSON.stringify(await state())); await shot('story');
  await click('[data-cp="choose"]'); await sleep(600);
  console.log('STEP camp', JSON.stringify(await state())); await shot('camp');
  if (await ev(() => { const id = DG.campaign.party()[0]; if (!DG.realmClass || !id) { return false; } DG.off.grow(id).lv = 5; DG.campaignView.show('camp'); return true; })) { await sleep(400); await shot('camp_cls'); await click('[data-cp="cls"]'); await sleep(400); await shot('camp_cls2'); }   // W-0457 Lv5 → 전직 고름 · 고른 뒤
  for (const t of ['gear', 'shop', 'talk', 'party']) { await click('[data-cp="tab"][data-t="' + t + '"]'); await sleep(300); if (t !== 'party') { if (t === 'gear') { await click('[data-cp="bag"]'); await sleep(200); } await shot(t); } }
  await click('[data-cp="go"]'); await sleep(2500);
  console.log('STEP battle', JSON.stringify(await ev(() => ({ tac: !!document.querySelector('#cpg-tac.show'), cells: document.querySelectorAll('#cpg-tac [data-c], #cpg-tac .tv-cell, #cpg-tac td').length })))); await shot('battle');
  if (await ev(() => { const g = document.querySelector('#cpg-tac g.tv-unit[data-uid^="me:"]:not([data-uid*=":m"])'); if (!g) { return false; } g.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })) { await sleep(400); await shot('battle_cmd'); }   // W-0455 장수 골라 지휘 범위
  const ul = await ev(() => { const V = DG.tacticsView, U = DG.ultimate, T = DG.tactics, v = V && V.cur(); if (!v || !U) { return null; } const b = v.b, u = T.alive(b, 'me').filter((x) => x.kind === 'officer')[0], f = T.alive(b, 'foe')[0]; if (!u || !f) { return null; }   // W-0456 필살 컷인 — 장수를 적 곁에 두고 게이지 채워 쓴다
    const fr = [[-1, 0], [0, -1], [0, 1], [1, 0]].map((d) => [f.x + d[0], f.y + d[1]]).filter((c) => { const t = T.cellAt(b, c[0], c[1]); return t && t !== "river" && t !== "wall" && !b.units.some((o) => o.hp > 0 && o.x === c[0] && o.y === c[1]); })[0]; if (!fr) { return null; } u.x = fr[0]; u.y = fr[1]; u.sp = 100; u.acted = false; u.moved = false; V.tap(u.x, u.y); const k = U.kindOf(u); const btn = document.querySelector('#cpg-tac [data-tv="ult"]'); if (btn) { btn.click(); } if (k !== 'chonggong') { V.tap(f.x, f.y); } return { kind: k, log: (b.ultLog || []).length, btn: !!btn }; });
  console.log('STEP ult', JSON.stringify(ul)); await ev(() => { const v = DG.tacticsView.cur(); v.ultHold = 600; DG.tacticsView.plotMode(null); }); await shot('battle_ult'); await ev(() => { DG.tacticsView.cur().ultHold = null; });   // 헤드리스는 포커스가 없어 타이머·애니메이션이 늦다 — 컷 0.6초 자리로 당겨 다시 그려 찍는다
  await click('#cpg-tac [data-tv="auto"]');
  for (let i = 0; i < 40 && !(await ev(() => !!document.querySelector('#cpg-tac [data-tv="go"]'))); i++) { await sleep(500); }
  await click('#cpg-tac [data-tv="go"]'); await sleep(1200);
  console.log('STEP result', JSON.stringify(await ev(() => { const h = document.querySelector('.cpg-result'); return h ? h.innerText.replace(/\s+/g, ' ').slice(0, 160) : null; }))); await shot('result');
  await click('[data-cp="route"],[data-cp="camp"]'); await sleep(800);
  console.log('STEP after', JSON.stringify(await state())); await shot('after');
} catch (e) { console.log('ERR', e.message.slice(0, 300)); }
console.log('errors', JSON.stringify(r.errors.filter((e) => !/404/.test(e)).slice(0, 5)));
await r.close();
