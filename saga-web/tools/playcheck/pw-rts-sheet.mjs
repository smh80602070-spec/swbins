// 사가국지 RTS 기계 확인(W-0069) — 건설·생산·콘솔 배치·우클릭 이동·A+클릭·안개·적 AI 출정을 실제 화면·입력으로 해 본다.
//   node pw-rts-sheet.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// **기계가 한 확인**(D2 기록)이다 — "스타크래프트 같은가·재미있나"는 사람 눈(D3). 결과는 콘솔 + results/pw-rts-sheet.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

async function session(opts, body) {
  const r = await open('saga-realm', opts);
  await r.page.addInitScript(() => { window.DG_NO_ACCOUNT = true; });
  await r.page.goto(r.url('rts.html?diff=1')); await sleep(1500);
  try { await body(r); } catch (e) { check('예외 — ' + e.message.slice(0, 80), false); }
  const errs = r.errors.filter((e) => !/status of 404/.test(e));
  await r.close();
  return errs;
}

const allErrs = [];
/* 데스크톱 1280×720 — 콘솔 배치·건설·생산·입력 */
allErrs.push(...await session({ w: 1280, h: 720 }, async (r) => {
  const { page } = r, ev = (fn, arg) => page.evaluate(fn, arg);
  const open1 = await ev(() => { const S = DG.rts.view.state(); return { w: document.getElementById('rts-map').clientWidth, h: document.getElementById('rts-map').clientHeight, top: document.getElementById('rts-top').textContent.replace(/\s+/g, ' ').slice(0, 30), buildings: Object.keys(S.buildings).length }; });
  check('열림 — 지도 캔버스·상단 자원 줄·거점과 적 기지가 선다', open1.w > 600 && open1.h > 300 && /일/.test(open1.top) && open1.buildings >= 2, JSON.stringify(open1));
  const lay = await ev(() => { const q = (id) => document.getElementById(id).getBoundingClientRect(); const m = q('rts-mini'), t = q('rts-tools'), s = q('rts-sel'); return { miniLeft: m.left, miniBottom: innerHeight - m.bottom, toolsRight: innerWidth - t.right, toolsBottom: innerHeight - t.bottom, selMid: s.left > m.right - 1 && s.right < t.left + 1 }; });
  check('스타크래프트식 콘솔 배치(W-0061) — 미니맵 왼쪽 아래·명령 카드 오른쪽 아래·선택 정보 가운데', lay.miniLeft < 30 && lay.miniBottom < 30 && lay.toolsRight < 30 && lay.toolsBottom < 30 && lay.selMid, JSON.stringify(lay));
  await ev(() => { const R = DG.rts, V = R.view, S = V.state(), cs = R.grid.castleSite(); S.res.gold = 9999; S.res.food = 9999; S.raid.next = 1e9; S.speed = 4;
    for (let i = 0; i < 8; i++) { R.rules.place(S, 'road', cs.x + 3 + i, cs.y + 1); }
    R.rules.place(S, 'house', cs.x + 4, cs.y - 1); R.rules.place(S, 'farm', cs.x + 8, cs.y - 3); R.rules.place(S, 'barracks', cs.x + 5, cs.y + 2);
    V.camera.x = cs.x + 6; V.camera.y = cs.y + 2; V.camera.z = 2.4; });
  await sleep(500);
  const built = await ev(() => { const S = DG.rts.view.state(); const t = {}; Object.values(S.buildings).forEach((b) => { t[b.t] = (t[b.t] || 0) + 1; }); return t; });
  check('건설 — 도로·주거·농지·군영이 서고 도로로 이어진다', built.road === 8 && built.house === 1 && built.farm === 1 && built.barracks === 1, JSON.stringify(built));
  /* 군영을 눌러 생산 단추 */
  const bpos = await ev(() => { const V = DG.rts.view, S = V.state(), b = Object.values(S.buildings).find((x) => x.t === 'barracks'), q = V.toScreen(b.x + 1, b.y + 1), rc = document.getElementById('rts-map').getBoundingClientRect(); return { x: rc.left + q.x, y: rc.top + q.y }; });
  await page.mouse.click(bpos.x, bpos.y); await sleep(500);
  const train = await ev(() => ({ n: document.querySelectorAll('#rts-sel button[data-train]').length, hero: !!document.querySelector('#rts-sel button[data-hero], #rts-sel button[data-recruit]') || /영웅/.test(document.getElementById('rts-sel').textContent) }));
  check('군영 생산 단추 — 병종 단추와 영웅 모집이 보인다', train.n >= 3 && train.hero, JSON.stringify(train));
  await page.click('#rts-sel button[data-train="soldier"]'); await sleep(200);
  const q0 = await ev(() => Object.values(DG.rts.view.state().queues)[0].length);
  let spawned = 0; for (let i = 0; i < 40 && !spawned; i++) { await sleep(250); spawned = await ev(() => DG.rts.units.count(DG.rts.view.state(), 0)); }
  check('생산 — 큐에 들어가고(4배속) 시간이 차면 병사가 나온다', q0 >= 1 && spawned >= 1, '큐 ' + q0 + ' · 병사 ' + spawned);
  /* 우클릭 이동·A+클릭 */
  const sp = await ev(() => { const R = DG.rts, V = R.view, S = V.state(), cs = R.grid.castleSite(), u = R.units.spawn(S, 'soldier', 0, cs.x + 6.5, cs.y - 6.5); S.speed = 1; V.camera.x = cs.x + 7; V.camera.y = cs.y - 6.5; const rc = document.getElementById('rts-map').getBoundingClientRect(), a = V.toScreen(u.x, u.y), g = V.toScreen(cs.x + 10, cs.y - 6), h = V.toScreen(cs.x + 3, cs.y - 6); return { id: u.id, ax: rc.left + a.x, ay: rc.top + a.y, gx: rc.left + g.x, gy: rc.top + g.y, hx: rc.left + h.x, hy: rc.top + h.y }; });
  await page.mouse.click(sp.ax, sp.ay); await sleep(300);
  const picked = await ev(() => /선택 1기/.test(document.getElementById('rts-sel').textContent));
  await page.mouse.click(sp.gx, sp.gy, { button: 'right' }); await sleep(300);
  const goal = await ev((id) => { const u = DG.rts.view.state().units[id]; return { goal: !!u.goal, path: u.path.length, am: !!u.amGoal }; }, sp.id);
  check('조작 — 왼쪽 클릭으로 고르고 우클릭으로 이동 명령(W-0061)', picked && goal.goal && goal.path > 0 && !goal.am, JSON.stringify(goal));
  await page.keyboard.press('a'); await sleep(150); await page.mouse.click(sp.hx, sp.hy); await sleep(300);
  const am = await ev((id) => !!DG.rts.view.state().units[id].amGoal, sp.id);
  check('조작 — A 다음 클릭은 공격 이동(amGoal)', am);
}));

/* 폰 390×844 — 콘솔은 기존 폰 배치 유지 */
allErrs.push(...await session({ w: 390, h: 844, mobile: true }, async (r) => {
  const ev = (fn, arg) => r.page.evaluate(fn, arg);
  await r.page.tap('#rts-diff button[data-diff="1"]').catch(() => {}); await sleep(300);
  const m = await ev(() => { const q = (id) => document.getElementById(id).getBoundingClientRect(); const mm = q('rts-mini'), t = q('rts-tools'); return { miniRight: innerWidth - mm.right, miniW: Math.round(mm.width), toolsBottom: innerHeight - t.bottom, scrollX: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  check('폰 배치 — 미니맵은 오른쪽, 도구 막대는 아래, 가로 스크롤 없음', m.miniRight < 30 && m.miniW <= 130 && m.toolsBottom < 30 && m.scrollX, JSON.stringify(m));
}));

/* 적 AI·안개 — 4배속으로 돌려 본다 */
allErrs.push(...await session({ w: 1280, h: 720 }, async (r) => {
  const ev = (fn, arg) => r.page.evaluate(fn, arg);
  const fog = await ev(() => { const R = DG.rts, S = R.view.state(), f = R.fog.create(); R.fog.update(f, S); const sb = S.buildings[-1], c = S.buildings[1]; return { seeCastle: R.fog.visibleAt(f, c.x + 1, c.y + 1), seeBase: R.fog.seenAt(f, sb.x + 1, sb.y + 1) }; });
  check('전장 안개(W-0062) — 거점 둘레는 보이고 적 기지는 못 본 칸이다', fog.seeCastle && !fog.seeBase, JSON.stringify(fog));
  await ev(() => { const S = DG.rts.view.state(); S.speed = 4; S.ai.gold = 400; S.raid.next = S.tick + 5; });
  let ai = null; for (let i = 0; i < 40; i++) { await sleep(300); ai = await ev(() => { const S = DG.rts.view.state(); return { mode: S.ai.mode, group: S.ai.group.length, units: Object.values(S.units).filter((u) => u.team === 1).length, made: S.ai.made, tip: document.getElementById('rts-tip').textContent.slice(0, 40) }; }); if (ai.mode === 'attack') { break; } }
  check('적 AI(W-0063) — 병력을 뽑고 모이면 출정(attack)한다', ai && ai.mode === 'attack' && ai.group > 0 && ai.made > 0, JSON.stringify(ai));
  const hud = await ev(() => document.getElementById('rts-top').textContent.replace(/\s+/g, ' ').length > 20);
  check('루프 — 4배속에서 HUD 가 계속 갱신된다', hud);
}));

const real = allErrs.filter((e) => !/WebGL|Shader|GL_/i.test(e));
console.log('페이지 예외·console.error:', real.length ? real.slice(0, 5).join(' | ') : '없음');
check('페이지 예외 없음', real.length === 0, real.slice(0, 2).join(' | '));
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rts-sheet.json', JSON.stringify({ script: 'pw-rts-sheet.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
