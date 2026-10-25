// W-0415 5천하 3D 들판 섞음 결(field_mix, K-0193) 전후 사진 — 손잡이 realm3d.fieldMix 0(옛 풀 법선)·1(섞음 결 + 바탕 결 곱) 두 장.
//   node rm-fieldmix.mjs [저장 폴더]   (서버 :8871 — PW_BASE 로 바꿀 수 있다)
import { open, sleep } from './pw.mjs';
const out = process.argv[2] || '.';
for (const fm of [0, 1]) {
  const r = await open('saga-realm', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
  const ev = (fn, a) => r.page.evaluate(fn, a);
  try {
    await r.page.addInitScript(() => { document.hasFocus = () => true; });
    await r.page.goto(r.url('index.html')); await sleep(1500);
    await ev((k) => { DG.account.create('들판'); DG.core.setTune('realm3d.fieldMix', k); DG.core.setTune('realm3d.on', 1); if (DG.deviceMode && DG.deviceMode.mark) { DG.deviceMode.mark('r3', true); } }, fm);
    await r.page.goto(r.url('index.html')); await sleep(3000);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    await r.page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
    await r.page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(8000);
    await ev(() => { document.querySelectorAll('.modal, .sheet, #sheet, .overlay').forEach((e) => { if (e.style) { e.style.display = 'none'; } }); });
    await r.page.screenshot({ path: out + '/rm_fieldmix_' + fm + '.png' });
    const st = await ev(() => ({ pg: DG.pbrground3d.stats(), fm: DG.core.tuned('realm3d.fieldMix', 1) }));
    console.log(JSON.stringify({ fm, st, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
  } finally { await r.close(); }
}
