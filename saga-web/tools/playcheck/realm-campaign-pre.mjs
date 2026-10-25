// 5천하 장 흐름 ③ 전투 앞 설전·일기토(W-0450) — 장 번호를 바로 놓고 진영 → 출진 → 앞 단계 창 → 설전/일기토 끝 → 진영 줄에 결과 → 전투로
//   node realm-campaign-pre.mjs [장 번호=9] [저장 폴더]   (서버 :8871) → 콘솔 STEP 줄 + 사진
import { open, sleep } from './pw.mjs';
const no = +(process.argv[2] || 9), out = process.argv[3] || '.';
const r = await open('saga-realm', { w: 1280, h: 720 });
const ev = (f, a) => r.page.evaluate(f, a);
const click = (sel) => ev((s) => { const b = document.querySelector(s); if (b) { b.click(); return true; } return false; }, sel);
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await ev(() => { localStorage.clear(); DG.account.create('앞단계'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await click('#title-continue'); await sleep(2000);
  await r.page.locator('[data-act="pick-scen"]').first().click(); await sleep(600);
  await r.page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);
  await ev((n) => { const cp = DG.campaign.state(); cp.ch = n; for (let i = 1; i < n; i++) { cp.cleared[i] = 1; } DG.campaignView.show('camp'); }, no);
  console.log('STEP stage', JSON.stringify(await ev((n) => { const s = DG.campaign.stageOf(n); return s ? { kind: s.kind, title: s.title, actors: DG.campaign.preActors(n) } : null; }, no)));
  await click('[data-cp="go"]'); await sleep(500); await r.page.screenshot({ path: out + '/cp_pre_' + no + '.png' });
  await click('[data-cp="pre-go"]'); await sleep(800);
  for (let i = 0; i < 40; i++) {
    const did = await ev(() => { for (const s of ['[data-act="deb-go"]', '[data-act="deb-answer"]', '[data-act="deb-next"]', '[data-act="duel-pick"]', '[data-act="duel-go"]']) { const b = document.querySelector('#encounter.show ' + s); if (b) { b.click(); return s; } } return null; });
    if (i === 2) { await r.page.screenshot({ path: out + '/cp_pre_' + no + '_card.png' }); }
    if (!did) { break; }
    await sleep(500);
  }
  await sleep(800);
  console.log('STEP after', JSON.stringify(await ev((n) => ({ pre: DG.campaign.state().pre, brief: (document.querySelector('.cpg-brief:last-of-type') || {}).innerText, foeTroops: DG.campaign.battleOpts(n).foeTroops[0] }), no)));
  await r.page.screenshot({ path: out + '/cp_pre_' + no + '_after.png' });
} catch (e) { console.log('ERR', e.message.slice(0, 300)); }
console.log('errors', JSON.stringify(r.errors.filter((e) => !/404/.test(e)).slice(0, 5)));
await r.close();
