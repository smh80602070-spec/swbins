// 사가만리 확인 닫기 ③(2026-10-08, D1 → D2) — 사냥 흔적(고향 300m 밖)·결투(실시간 전투) 화면을 실제 판에서 한 번씩.
//   node pw-go-close3.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 흔적: 고향 밖으로 몸을 옮겨 둘레 흔적 표식이 서는지 보고(그림 shots/qc/saga-go-track.png), 흔적 위로 걸어가면 저절로 읽힌다.
// 결투: 결투 창을 열고 실제 Space(속공)·D(회피) 키 — 기세(적 체력) 숫자가 준다(그림 shots/qc/saga-go-duel.png).
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-go-close3.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-go');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(5000);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { DG.core.setTune('world3d.dayNight', 0); });

  /* go.track — 고향(300m) 밖으로 옮기면 둘레에 흔적 표식, 그 위로 가면 저절로 읽힌다 */
  const t0 = await ev(() => { var TK = DG.track, p = DG.core.save.player.pos; p.x += 900; p.y += 120; return { on: TK.on(), read0: TK.readCount(), home: TK.HOME_R }; });
  await sleep(2500);
  const t1 = await ev(() => {
    var TK = DG.track, p = DG.core.save.player.pos, n = TK.nearestUnread(p, 600), m = TK.marks(p, 400).filter((x) => x.t === 'trail').length;
    if (n) { var a = Math.atan2(p.y - n.y, p.x - n.x); p.x = n.x + Math.cos(a) * 28; p.y = n.y + Math.sin(a) * 28; }   // 표식이 보이게 28m 앞에 선다
    return { marks: m, near: n ? { kind: n.kind, x: Math.round(n.x), y: Math.round(n.y) } : null };
  });
  await sleep(2500);
  await page.screenshot({ path: 'shots/qc/saga-go-track.png' });
  const t2 = await ev((nn) => { var p = DG.core.save.player.pos; if (nn) { p.x = nn.x; p.y = nn.y; } return true; }, t1.near);
  await sleep(2500);
  const t3 = await ev(() => ({ read: DG.track.readCount() }));
  check('go.track 흔적 — 고향 밖에선 둘레에 흔적 표식이 서고, 흔적 위로 가면 저절로 읽혀 읽은 수가 는다', t0.on && t1.marks > 0 && !!t1.near && t2 && t3.read === t0.read0 + 1, JSON.stringify({ t0, t1, t3 }));

  /* go.rogue-action — 결투 창 + 실제 키(Space 속공 · D 회피): 기세가 줄고 창이 산다 */
  /* 실제 교전과 같게 — 상대는 도감 인물 초상(stage3d), 내 쪽은 동행 선두(party[0]) */
  await ev(() => { var H = DG.data.heroes || [], sv = DG.core.save; if (!(sv.party && sv.party[0]) && H[0]) { sv.party = [H[0].id]; } var foe = H[5] || H[1];
    DG.duel.open({ title: '시험 결투', foeHp: 3000, myAtk: 120, myDef: 5000, foeName: foe ? foe.name : '시험', stage3d: foe ? { kind: 'hero', ref: foe } : null, onDone: function () { window.__duelDone = true; } }); }); await sleep(15000);   // 3D 무대의 두 몸(GLB)이 설 때까지
  const hpOf = () => ev(() => { var m = (document.body.innerText || '').match(/기세\s*([\d,]+)/); return m ? +m[1].replace(/,/g, '') : -1; });
  const h0 = await hpOf();
  for (let i = 0; i < 8; i++) { await page.keyboard.press(' '); await sleep(450); }
  await page.keyboard.press('d'); await sleep(400);
  await page.screenshot({ path: 'shots/qc/saga-go-duel.png' });
  const h1 = await hpOf();
  const d1 = await ev(() => ({ active: DG.duel.active }));
  check('go.rogue-action 결투 — 창이 열리고 실제 Space(속공)를 누르면 기세(적 체력)가 줄며, D(회피)에도 창이 산다', h0 > 0 && h1 >= 0 && h1 < h0 && (d1.active || await ev(() => !!window.__duelDone)), JSON.stringify({ h0, h1, d1 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|tile\.openstreetmap|overpass/i.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-go-close3.json', JSON.stringify({ script: 'pw-go-close3.mjs', game: 'saga-go', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
