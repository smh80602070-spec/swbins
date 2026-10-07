// 사가천하 전장 턴 전투 기계 확인(W-0081) — 실제 화면·입력(데스크톱 클릭·폰 탭)으로 고르기·이동·공격·턴 끝·저장·자동을 해 본다.
//   node pw-rts-turn.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// **기계가 한 확인**(D2 기록)이다 — "조조전 같은가·재미있나"는 사람 눈(D3, W-0082 시트). 결과는 콘솔 + results/pw-rts-turn.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

async function idle(page, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (!(await page.evaluate(() => DG.rts.view.turn().busy))) { return true; } await sleep(60); } return false; }

async function flow(label, mobile) {
  const r = await open('saga-realm', mobile ? { w: 390, h: 844, mobile: true } : { w: 1280, h: 720 });
  const { page } = r, ev = (fn, arg) => page.evaluate(fn, arg);
  const press = async (x, y) => { if (mobile) { await page.touchscreen.tap(x, y); } else { await page.mouse.click(x, y); } await sleep(120); await idle(page); };
  await page.addInitScript(() => { window.DG_NO_ACCOUNT = true; });
  await page.goto(r.url('rts.html?diff=1&fast=1')); await sleep(1500);
  try {
    const o = await ev(() => { const S = DG.rts.view.state(), v = Object.values(S.units); return { on: DG.rts.view.turn().on, a: v.filter((u) => u.team === 0).length, e: v.filter((u) => u.team === 1).length, turn: S.tb.turn, tools: !!document.getElementById('rts-tools'), end: !!document.querySelector('#rts-turn [data-end]') }; });
    check(label + ' 열림 — 턴 모드·양편 유닛·건설 막대 없음·턴 끝 단추', o.on && o.a >= 2 && o.e >= 2 && o.turn === 1 && !o.tools && o.end, JSON.stringify(o));

    /* 고르기 — 화면에 보이는 첫 보병을 누른다 */
    const u0 = await ev(() => { const S = DG.rts.view.state(), u = Object.values(S.units).find((x) => x.team === 0 && x.t === 'soldier'), p = DG.rts.view.toScreen(u.x, u.y), c = document.getElementById('rts-map').getBoundingClientRect(); return { id: u.id, x: u.x, y: u.y, sx: p.x + c.left, sy: p.y + c.top }; });
    await press(u0.sx, u0.sy);
    const m1 = await ev(() => DG.rts.view.turn());
    check(label + ' 고르기 — 내 유닛을 누르면 파란 칸이 생긴다', m1.sel === u0.id && m1.reach > 1, JSON.stringify(m1));

    /* 이동 — 가장 멀리 닿는 파란 칸을 누른다 */
    const dst = await ev((id) => { const S = DG.rts.view.state(), T = DG.rts.tactics, u = S.units[id], l = T.reach(S, u), q = l[l.length - 1], p = DG.rts.view.toScreen(q.x + 0.5, q.y + 0.5), c = document.getElementById('rts-map').getBoundingClientRect(); return { x: q.x, y: q.y, sx: p.x + c.left, sy: p.y + c.top }; }, u0.id);
    await press(dst.sx, dst.sy);
    const mv = await ev((id) => { const u = DG.rts.view.state().units[id]; return { x: Math.floor(u.x), y: Math.floor(u.y), moved: !!DG.rts.view.state().tb.moved[id] }; }, u0.id);
    check(label + ' 이동 — 파란 칸을 누르면 그 칸으로 간다', mv.x === dst.x && mv.y === dst.y && mv.moved, JSON.stringify({ dst: [dst.x, dst.y], mv }));

    /* 공격 — 아직 안 움직인 아군 옆에 적 하나를 세우고(시험 배치), 고른 뒤 그 적을 누른다 */
    const fx = await ev(() => {
      const S = DG.rts.view.state(), T = DG.rts.tactics, U = DG.rts.units, a = Object.values(S.units).find((x) => x.team === 0 && x.t !== 'archer' && !S.tb.moved[x.id] && !S.tb.acted[x.id]);
      const e = Object.values(S.units).find((x) => x.team === 1 && x.t === 'soldier'), ax = Math.floor(a.x), ay = Math.floor(a.y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (U.walkable(S, ax + dx, ay + dy) && !T.unitAt(S, ax + dx, ay + dy)) { e.x = ax + dx + 0.5; e.y = ay + dy + 0.5; break; } }
      return { a: a.id, e: e.id, hp: e.hp };
    });
    await sleep(400);   // 안개가 새 자리를 연다(200ms 마다)
    const sp = await ev((ids) => { const S = DG.rts.view.state(), c = document.getElementById('rts-map').getBoundingClientRect(), f = (u) => { const p = DG.rts.view.toScreen(u.x, u.y); return [p.x + c.left, p.y + c.top]; }; return { a: f(S.units[ids.a]), e: f(S.units[ids.e]) }; }, fx);
    await press(sp.a[0], sp.a[1]);
    const tg = await ev(() => DG.rts.view.turn().targets);
    await press(sp.e[0], sp.e[1]);
    const hit = await ev((ids) => { const S = DG.rts.view.state(), e = S.units[ids.e]; return { hp: e ? e.hp : 0, acted: !!S.tb.acted[ids.a] }; }, fx);
    check(label + ' 공격 — 붙은 적이 빨갛게 뜨고, 누르면 체력이 준다', tg > 0 && hit.hp < fx.hp && hit.acted, JSON.stringify({ targets: tg, before: fx.hp, after: hit.hp }));

    /* 턴 끝 → 적 차례 → 2턴 · 새로고침 뒤 그대로 */
    await page.locator('#rts-turn [data-end]').click(); await sleep(150); await idle(page, 30000);
    const t2 = await ev(() => { const S = DG.rts.view.state(); return { turn: S.tb.turn, side: S.tb.side, n: Object.keys(S.units).length, top: document.getElementById('rts-top').textContent.replace(/\s+/g, ' ') }; });
    check(label + ' 턴 끝 — 적 차례가 돌고 2턴 아군 차례로 돌아온다', t2.turn === 2 && t2.side === 0 && /2턴/.test(t2.top) && /아군 차례/.test(t2.top), JSON.stringify(t2));
    await page.reload(); await sleep(1500);
    const t3 = await ev(() => { const S = DG.rts.view.state(); return { turn: S.tb.turn, n: Object.keys(S.units).length }; });
    check(label + ' 저장 — 새로고침 뒤 턴·유닛 수가 같다', t3.turn === t2.turn && t3.n === t2.n, JSON.stringify(t3));

    /* 자동 — 켜면 끝까지 두고 결과 창이 뜬다 */
    await page.locator('#rts-turn [data-auto]').click();
    let done = null; for (let i = 0; i < 300; i++) { await sleep(200); done = await ev(() => { const S = DG.rts.view.state(), b = document.getElementById('rts-diff'); return b ? { won: S.won, over: S.over, turn: S.tb.turn, box: b.textContent.slice(0, 40) } : null; }); if (done) { break; } }
    check(label + ' 자동 — 30턴 안에 결판이 나고 결과 창이 뜬다', !!done && (done.won || done.over) && done.turn <= 31, JSON.stringify(done));
    const scroll = await ev(() => document.documentElement.scrollWidth <= innerWidth + 1);
    check(label + ' 배치 — 가로 스크롤 없음', scroll);
  } catch (e) { check(label + ' 예외 — ' + e.message.slice(0, 120), false); }
  const errs = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e));
  check(label + ' 페이지 예외·console.error 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await r.close();
}

await flow('[PC]', false);
await flow('[폰]', true);
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rts-turn.json', JSON.stringify({ script: 'pw-rts-turn.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
